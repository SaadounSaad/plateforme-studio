import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const response = await fetch('http://localhost:8001/api/ocr', {
      method: 'POST',
      body: formData,
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Backend error' }))
      return NextResponse.json({ error: error.detail }, { status: response.status })
    }
    const json = await response.json()
    return NextResponse.json(json)
  } catch {
    return NextResponse.json(
      { error: 'Le backend OCR est inaccessible. Lancez pdf-backend avec uvicorn.' },
      { status: 503 }
    )
  }
}
