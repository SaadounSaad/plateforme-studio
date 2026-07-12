import { NextRequest, NextResponse } from 'next/server'
import { createRateLimiter, getClientIp, sanitizeForLog } from '@/app/api/lib/security'

/* ============================================================
   Hardened Anthropic proxy
   ============================================================ */

const ALLOWED_MODELS = new Set([
  'claude-sonnet-5',
  'claude-haiku-4',
  'claude-opus-4-8',
])

const MAX_TOKENS = 8192
const MAX_MESSAGE_LENGTH = 10_000
const MAX_TOTAL_MESSAGE_LENGTH = 50_000
const MAX_TOOLS = 3
const MAX_TOOL_SCHEMA_SIZE = 4_000
const MAX_SYSTEM_LENGTH = 5_000

const isRateLimited = createRateLimiter(60_000, 20)

function isValidRole(role: unknown): role is 'user' | 'assistant' {
  return role === 'user' || role === 'assistant'
}

function validateToolSchema(schema: unknown): boolean {
  if (!schema || typeof schema !== 'object') return false
  const s = schema as Record<string, unknown>
  if (s.type !== 'object') return false
  if (s.properties && typeof s.properties !== 'object') return false
  if (s.required && !Array.isArray(s.required)) return false
  return JSON.stringify(schema).length <= MAX_TOOL_SCHEMA_SIZE
}

function validateBody(body: unknown): { ok: true; payload: object } | { ok: false; message: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, message: 'Invalid JSON body' }
  }

  const b = body as Record<string, unknown>

  // Model
  if (typeof b.model !== 'string' || !ALLOWED_MODELS.has(b.model)) {
    return { ok: false, message: 'Model not allowed' }
  }

  // max_tokens
  if (typeof b.max_tokens !== 'number' || !Number.isFinite(b.max_tokens) || b.max_tokens < 1 || b.max_tokens > MAX_TOKENS) {
    return { ok: false, message: 'max_tokens out of range' }
  }

  // messages
  if (!Array.isArray(b.messages) || b.messages.length === 0 || b.messages.length > 50) {
    return { ok: false, message: 'messages must be a non-empty array' }
  }

  let totalLength = 0
  for (const m of b.messages) {
    if (!m || typeof m !== 'object') {
      return { ok: false, message: 'Invalid message object' }
    }
    const msg = m as Record<string, unknown>
    if (!isValidRole(msg.role)) {
      return { ok: false, message: 'Invalid message role' }
    }
    if (typeof msg.content !== 'string') {
      return { ok: false, message: 'Invalid message content' }
    }
    if (msg.content.length > MAX_MESSAGE_LENGTH) {
      return { ok: false, message: 'Message too long' }
    }
    totalLength += msg.content.length
  }
  if (totalLength > MAX_TOTAL_MESSAGE_LENGTH) {
    return { ok: false, message: 'Total message length exceeded' }
  }

  // system (optional)
  if ('system' in b && b.system !== undefined) {
    if (typeof b.system !== 'string' || b.system.length > MAX_SYSTEM_LENGTH) {
      return { ok: false, message: 'Invalid system prompt' }
    }
  }

  // tools (optional)
  if ('tools' in b && b.tools !== undefined) {
    if (!Array.isArray(b.tools) || b.tools.length > MAX_TOOLS) {
      return { ok: false, message: 'Too many tools' }
    }
    for (const t of b.tools) {
      if (!t || typeof t !== 'object') {
        return { ok: false, message: 'Invalid tool object' }
      }
      const tool = t as Record<string, unknown>
      if (typeof tool.name !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(tool.name)) {
        return { ok: false, message: 'Invalid tool name' }
      }
      if (typeof tool.description !== 'string' || tool.description.length > 500) {
        return { ok: false, message: 'Invalid tool description' }
      }
      if (!validateToolSchema(tool.input_schema)) {
        return { ok: false, message: 'Invalid tool input_schema' }
      }
    }
  }

  // tool_choice (optional, only forced single tool allowed)
  if ('tool_choice' in b && b.tool_choice !== undefined) {
    if (!b.tool_choice || typeof b.tool_choice !== 'object') {
      return { ok: false, message: 'Invalid tool_choice' }
    }
    const tc = b.tool_choice as Record<string, unknown>
    if (tc.type !== 'tool' || typeof tc.name !== 'string') {
      return { ok: false, message: 'tool_choice must be {type:"tool",name:"..."}' }
    }
  }

  // Strip any unknown top-level fields to reduce attack surface
  const safe: Record<string, unknown> = {
    model: b.model,
    max_tokens: b.max_tokens,
    messages: b.messages,
  }
  if ('system' in b && b.system !== undefined) safe.system = b.system
  if ('tools' in b && b.tools !== undefined) safe.tools = b.tools
  if ('tool_choice' in b && b.tool_choice !== undefined) safe.tool_choice = b.tool_choice

  return { ok: true, payload: safe }
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('[v1/messages] ANTHROPIC_API_KEY missing')
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  const ip = getClientIp(request)
  if (isRateLimited(ip)) {
    console.warn(`[v1/messages] Rate limit exceeded for ${ip}`)
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const validation = validateBody(body)
  if (!validation.ok) {
    console.warn(`[v1/messages] Validation failed for ${ip}: ${validation.message}`)
    return NextResponse.json({ error: validation.message }, { status: 400 })
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(validation.payload),
    })

    const data = await res.json()
    console.info(`[v1/messages] ${ip} -> ${(validation.payload as { model: string }).model} status=${res.status}`)
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    console.error('[v1/messages] Anthropic proxy error:', err)
    return NextResponse.json({ error: 'Upstream request failed' }, { status: 502 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
