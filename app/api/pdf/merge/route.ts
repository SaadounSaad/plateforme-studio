import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (files.length < 2) {
      return NextResponse.json(
        { error: 'Au moins 2 fichiers PDF requis pour la fusion' },
        { status: 400 }
      )
    }

    const mergedDoc = await PDFDocument.create()

    for (const file of files) {
      const bytes = await file.arrayBuffer()
      const srcDoc = await PDFDocument.load(bytes)
      const pages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices())
      pages.forEach(p => mergedDoc.addPage(p))
    }

    const outBytes = await mergedDoc.save()
    return new NextResponse(Buffer.from(outBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="merged.pdf"',
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'PDF merge failed' },
      { status: 500 }
    )
  }
}
