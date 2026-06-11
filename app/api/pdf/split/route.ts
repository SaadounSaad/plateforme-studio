import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'

function parseRanges(rangesStr: string, pageCount: number): Array<{ start: number; end: number }> {
  const segments = rangesStr.replace(/,/g, ';').split(';').map(s => s.trim()).filter(Boolean)
  if (!segments.length) throw new Error('No valid ranges provided')

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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const ranges = formData.get('ranges') as string | null

    if (!file) return NextResponse.json({ error: 'Fichier PDF requis' }, { status: 400 })
    if (!ranges) return NextResponse.json({ error: 'Paramètre ranges requis (ex: "1-3; 5-8; 12")' }, { status: 400 })

    const srcBytes = await file.arrayBuffer()
    const srcDoc = await PDFDocument.load(srcBytes)
    const pageCount = srcDoc.getPageCount()
    const parsedRanges = parseRanges(ranges, pageCount)

    // Single range → single PDF
    if (parsedRanges.length === 1) {
      const { start, end } = parsedRanges[0]
      const outDoc = await PDFDocument.create()
      const pages = await outDoc.copyPages(srcDoc, Array.from({ length: end - start + 1 }, (_, i) => start + i))
      pages.forEach(p => outDoc.addPage(p))
      const outBytes = await outDoc.save()
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
    return new NextResponse(Buffer.from(zipBytes), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="split_results.zip"',
      },
    })
  } catch (err: any) {
    const message = err?.message ?? 'PDF split failed'
    const status = message.includes('out of bounds') || message.includes('Invalid') ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
