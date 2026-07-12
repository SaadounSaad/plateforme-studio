import { NextRequest, NextResponse } from 'next/server';
import { SYSTEM_PROMPT, buildUserPrompt } from '@/app/explique-moi/lib/prompt-system';
import { createRateLimiter, getClientIp, sanitizeForLog } from '@/app/api/lib/security';

const ALLOWED_MODELS = new Set([
  'claude-sonnet-5',
  'claude-haiku-4',
  'claude-opus-4-8',
  // Models used by the ExpliqueMoi UI
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-5-20251001',
  'claude-opus-4-8-20251001',
]);

const ALLOWED_LEVELS = new Set(['simple', 'approfondir']);
const ALLOWED_ACTIONS = new Set(['', 'Approfondir', 'Simplifier davantage']);

const MAX_TERM_LENGTH = 500;
const MAX_DOMAIN_LENGTH = 100;
const MAX_ACTION_LENGTH = 50;
const MAX_PREVIOUS_LENGTH = 3000;

const isRateLimited = createRateLimiter(60_000, 10);

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[api/explique] ANTHROPIC_API_KEY missing');
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    console.warn(`[api/explique] Rate limit exceeded for ${ip}`);
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  const term = typeof b.term === 'string' ? b.term.trim() : '';
  if (!term || term.length === 0 || term.length > MAX_TERM_LENGTH) {
    return NextResponse.json({ error: 'Terme invalide' }, { status: 400 });
  }

  const level = typeof b.level === 'string' ? b.level : 'simple';
  if (!ALLOWED_LEVELS.has(level)) {
    return NextResponse.json({ error: 'Niveau invalide' }, { status: 400 });
  }

  const domain = typeof b.domain === 'string' ? b.domain.trim() : '';
  if (domain.length > MAX_DOMAIN_LENGTH) {
    return NextResponse.json({ error: 'Domaine trop long' }, { status: 400 });
  }

  const model = typeof b.model === 'string' ? b.model : 'claude-sonnet-5';
  if (!ALLOWED_MODELS.has(model)) {
    return NextResponse.json({ error: 'Modèle non autorisé' }, { status: 400 });
  }

  const action = typeof b.action === 'string' ? b.action : '';
  if (!ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
  }

  const previousResponse = typeof b.previousResponse === 'string' ? b.previousResponse : '';
  if (previousResponse.length > MAX_PREVIOUS_LENGTH) {
    return NextResponse.json({ error: 'Réponse précédente trop longue' }, { status: 400 });
  }

  try {
    const userPrompt = buildUserPrompt({
      term,
      level,
      domain,
      model,
      action,
      previousResponse,
    });

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!res.ok) {
      console.error(`[api/explique] Anthropic error ${res.status} for ${ip}`);
      return NextResponse.json({ error: 'Upstream request failed' }, { status: 502 });
    }

    const data = await res.json();
    const rawText = data.content?.[0]?.text ?? '';

    console.info(`[api/explique] ${ip} -> ${model} term="${sanitizeForLog(term)}"`);
    return NextResponse.json({ raw: rawText, model });
  } catch (err) {
    console.error('[api/explique] Unexpected error:', err);
    return NextResponse.json({ error: 'Service unavailable' }, { status: 500 });
  }
}
