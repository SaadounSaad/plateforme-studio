import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import { createRateLimiter, getClientIp, sanitizeForLog } from '@/app/api/lib/security'

const MAX_FILES = 20
const MAX_TOTAL_SIZE = 50 * 1024 * 1024 // 50 MB
const MAX_PAGES_PER_FILE = 500

const isRateLimited = createRateLimiter(60_000, 10)

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
    const rawFiles = formData.getAll('files')
    const files: File[] = []
    let totalSize = 0

    for (const f of rawFiles) {
      if (!(f instanceof File)) continue
      files.push(f)
      totalSize += f.size
    }

    if (files.length < 2) {
      return NextResponse.json(
        { error: 'Au moins 2 fichiers PDF requis pour la fusion' },
        { status: 400 }
      )
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Max ${MAX_FILES} fichiers` },
        { status: 400 }
      )
    }
    if (totalSize > MAX_TOTAL_SIZE) {
      return NextResponse.json(
        { error: 'Taille totale trop importante (max 50 MB)' },
        { status: 400 }
      )
    }

    const mergedDoc = await PDFDocument.create()
    let totalPages = 0

    for (const file of files) {
      const bytes = await file.arrayBuffer()
      if (!isPdf(bytes)) {
        return NextResponse.json(
          { error: `Fichier invalide : ${sanitizeForLog(file.name)} n'est pas un PDF` },
          { status: 400 }
        )
      }
      const srcDoc = await PDFDocument.load(bytes)
      const pageCount = srcDoc.getPageCount()
      totalPages += pageCount
      if (totalPages > MAX_PAGES_PER_FILE * MAX_FILES) {
        return NextResponse.json(
          { error: 'Nombre total de pages trop élevé' },
          { status: 400 }
        )
      }
      const pages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices())
      pages.forEach(p => mergedDoc.addPage(p))
    }

    const outBytes = await mergedDoc.save()
    console.info(`[api/pdf/merge] ${ip} files=${files.length} pages=${totalPages}`)
    return new NextResponse(Buffer.from(outBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="merged.pdf"',
      },
    })
  } catch (err) {
    console.error('[api/pdf/merge] error:', err)
    return NextResponse.json({ error: 'PDF merge failed' }, { status: 500 })
  }
}
