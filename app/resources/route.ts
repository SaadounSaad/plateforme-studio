import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET() {
  try {
    const filePath = join(process.cwd(), '..', 'awesome-claude-code', 'resources.json')
    const data = readFileSync(filePath, 'utf-8')
    return new NextResponse(data, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  } catch {
    return NextResponse.json({ error: 'resources.json introuvable' }, { status: 404 })
  }
}
