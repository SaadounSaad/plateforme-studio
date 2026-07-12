import { NextRequest, NextResponse } from 'next/server'
import { createRateLimiter, getClientIp, sanitizeForLog } from '@/app/api/lib/security'

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || ''
const OCR_ENDPOINT = 'https://api.mistral.ai/v1/ocr'

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
])

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 5

const isRateLimited = createRateLimiter(RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS)

function validateFileMagicBytes(buffer: ArrayBuffer, mimeType: string): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 16))
  const text = new TextDecoder().decode(bytes)

  switch (mimeType) {
    case 'application/pdf':
      return text.startsWith('%PDF')
    case 'image/png':
      return text.startsWith('\x89PNG')
    case 'image/jpeg':
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    case 'image/webp':
      return text.startsWith('RIFF') && text.includes('WEBP')
    default:
      return false
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  if (isRateLimited(ip)) {
    console.warn(`[api/pdf/ocr] Rate limit exceeded for ${ip}`)
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  if (!MISTRAL_API_KEY) {
    console.error('[api/pdf/ocr] MISTRAL_API_KEY missing')
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Fichier requis' }, { status: 400 })
  }

  const format = typeof formData.get('format') === 'string'
    ? (formData.get('format') as string)
    : 'txt'
  if (format !== 'txt' && format !== 'md') {
    return NextResponse.json({ error: "format must be 'txt' or 'md'" }, { status: 400 })
  }

  if (file.size === 0) {
    return NextResponse.json({ error: 'Fichier vide' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Fichier trop volumineux (max 20 MB)' }, { status: 400 })
  }

  const mimeType = file.type || 'application/pdf'
  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    return NextResponse.json(
      { error: `Type de fichier non supporté: '${mimeType}'` },
      { status: 400 }
    )
  }

  try {
    const arrayBuffer = await file.arrayBuffer()

    if (!validateFileMagicBytes(arrayBuffer, mimeType)) {
      return NextResponse.json(
        { error: `Le contenu du fichier ne correspond pas au type ${mimeType}` },
        { status: 400 }
      )
    }

    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const dataUri = `data:${mimeType};base64,${base64}`

    const document = mimeType === 'application/pdf'
      ? { type: 'document_url', document_url: dataUri }
      : { type: 'image_url', image_url: dataUri }

    const res = await fetch(OCR_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MISTRAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-ocr-latest',
        document,
        extract_header: true,
        extract_footer: true,
      }),
    })

    if (!res.ok) {
      console.error(`[api/pdf/ocr] Mistral error ${res.status} for ${ip}`)
      return NextResponse.json({ error: 'OCR service failed' }, { status: 502 })
    }

    const data = await res.json()
    const pages = (data.pages || []).map((p: any) => ({
      markdown: p.markdown || '',
    }))

    console.info(`[api/pdf/ocr] ${ip} -> ${sanitizeForLog(file.name)} type=${mimeType} size=${file.size} pages=${pages.length}`)
    return NextResponse.json({ pages, total: pages.length })
  } catch (err) {
    console.error('[api/pdf/ocr] Unexpected error:', err)
    return NextResponse.json({ error: 'OCR failed' }, { status: 500 })
  }
}
