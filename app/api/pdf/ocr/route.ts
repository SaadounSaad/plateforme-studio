import { NextRequest, NextResponse } from 'next/server'

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || ''
const OCR_ENDPOINT = 'https://api.mistral.ai/v1/ocr'

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
])

export async function POST(request: NextRequest) {
  if (!MISTRAL_API_KEY) {
    return NextResponse.json(
      { error: 'MISTRAL_API_KEY non configurée. Ajoutez-la dans les variables d\'environnement Vercel.' },
      { status: 500 }
    )
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const format = (formData.get('format') as string) || 'txt'

    if (!file) return NextResponse.json({ error: 'Fichier requis' }, { status: 400 })
    if (format !== 'txt' && format !== 'md') {
      return NextResponse.json({ error: "format must be 'txt' or 'md'" }, { status: 400 })
    }

    const mimeType = file.type || 'application/pdf'
    if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: `Type de fichier non supporté: '${mimeType}'. Supporté: PDF, PNG, JPEG, WEBP` },
        { status: 400 }
      )
    }

    // Convertit le fichier en data URI base64
    const arrayBuffer = await file.arrayBuffer()
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
      const err = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: (err as any).detail ?? `Mistral OCR error: HTTP ${res.status}` },
        { status: res.status }
      )
    }

    const data = await res.json()
    const pages = (data.pages || []).map((p: any) => ({
      markdown: p.markdown || '',
    }))

    return NextResponse.json({ pages, total: pages.length })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'OCR failed' },
      { status: 500 }
    )
  }
}
