import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const response = await fetch('http://localhost:8001/api/split', {
      method: 'POST',
      body: formData,
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Backend error' }))
      return NextResponse.json({ error: error.detail }, { status: response.status })
    }
    const blob = await response.blob()
    const contentType = response.headers.get('content-type') || 'application/pdf'
    const contentDisposition = response.headers.get('content-disposition') || 'attachment; filename="result.pdf"'
    return new NextResponse(blob, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
      }
    })
  } catch {
    return NextResponse.json({ error: 'Backend unreachable. Is pdf-backend running?' }, { status: 503 })
  }
}
