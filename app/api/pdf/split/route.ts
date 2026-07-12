import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import { createRateLimiter, getClientIp } from '@/app/api/lib/security'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB
const MAX_TOTAL_PAGES = 500
const MAX_RANGES = 50

const isRateLimited = createRateLimiter(60_000, 10)

function parseRanges(rangesStr: string, pageCount: number): Array<{ start: number; end: number }> {
  const segments = rangesStr.replace(/,/g, ';').split(';').map(s => s.trim()).filter(Boolean)
  if (!segments.length) throw new Error('No valid ranges provided')
  if (segments.length > MAX_RANGES) throw new Error(`Max ${MAX_RANGES} plages`)

  return segments.map(seg => {
    if (seg.includes('-')) {
      const [startStr, endStr] = seg.split('-', 2)
      const start = parseInt(startStr.trim(), 10)
      const end = parseInt(endStr.trim(), 10)
      if (isNaN(start) || isNaN(end) || start < 1 || end < start || end > pageCount) {
        throw new Error(`Range '${seg}' is out of bounds for a ${pageCount}-page document`)
      }
      return { start: start - 1, end: end - 1 }
    }
    const page = parseInt(seg, 10)
    if (isNaN(page) || page < 1 || page > pageCount) {
      throw new Error(`Page ${seg} is out of bounds for a ${pageCount}-page document`)
    }
    return { start: page - 1, end: page - 1 }
  })
}

function isPdf(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 5))
  const text = new TextDecoder().decode(bytes)
  return text.startsWith('%PDF-')
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const ranges = formData.get('ranges')

    if (!(file instanceof File)) return NextResponse.json({ error: 'Fichier PDF requis' }, { status: 400 })
    if (typeof ranges !== 'string') return NextResponse.json({ error: 'Paramètre ranges requis' }, { status: 400 })
    if (file.size === 0) return NextResponse.json({ error: 'Fichier vide' }, { status: 400 })
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 50 MB)' }, { status: 400 })
    }

    const srcBytes = await file.arrayBuffer()
    if (!isPdf(srcBytes)) {
      return NextResponse.json({ error: 'Le fichier doit être un PDF' }, { status: 400 })
    }

    const srcDoc = await PDFDocument.load(srcBytes)
    const pageCount = srcDoc.getPageCount()
    if (pageCount > MAX_TOTAL_PAGES) {
      return NextResponse.json({ error: `Max ${MAX_TOTAL_PAGES} pages` }, { status: 400 })
    }

    const parsedRanges = parseRanges(ranges, pageCount)

    // Single range → single PDF
    if (parsedRanges.length === 1) {
      const { start, end } = parsedRanges[0]
      const outDoc = await PDFDocument.create()
      const pages = await outDoc.copyPages(srcDoc, Array.from({ length: end - start + 1 }, (_, i) => start + i))
      pages.forEach(p => outDoc.addPage(p))
      const outBytes = await outDoc.save()
      console.info(`[api/pdf/split] ${ip} pages=${pageCount} range=1`)
      return new NextResponse(Buffer.from(outBytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="split_result.pdf"',
        },
      })
    }

    // Multiple ranges → zip
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    for (let i = 0; i < parsedRanges.length; i++) {
      const { start, end } = parsedRanges[i]
      const outDoc = await PDFDocument.create()
      const pages = await outDoc.copyPages(srcDoc, Array.from({ length: end - start + 1 }, (_, j) => start + j))
      pages.forEach(p => outDoc.addPage(p))
      const outBytes = await outDoc.save()
      zip.file(`part_${i + 1}.pdf`, outBytes)
    }
    const zipBytes = await zip.generateAsync({ type: 'uint8array' })
    console.info(`[api/pdf/split] ${ip} pages=${pageCount} ranges=${parsedRanges.length}`)
    return new NextResponse(Buffer.from(zipBytes), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="split_results.zip"',
      },
    })
  } catch (err: any) {
    const message = err?.message ?? 'PDF split failed'
    const status = message.includes('out of bounds') || message.includes('No valid') || message.includes('Max')
      ? 400
      : 500
    if (status === 500) console.error('[api/pdf/split] error:', err)
    return NextResponse.json({ error: status === 400 ? message : 'PDF split failed' }, { status })
  }
}
