import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { resolve, join } from 'path'

export async function GET(request: NextRequest) {
  const filePath = request.nextUrl.searchParams.get('path')
  if (!filePath) {
    return NextResponse.json({ error: 'Paramètre path manquant' }, { status: 400 })
  }
  try {
    const base = join(process.cwd(), '..', 'awesome-claude-code')
    const abs = resolve(base, filePath)
    if (!abs.startsWith(resolve(base))) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }
    if (!existsSync(abs)) {
      return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 })
    }
    const content = readFileSync(abs, 'utf-8')
    return new NextResponse(content, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch {
    return NextResponse.json({ error: 'Erreur lecture fichier' }, { status: 500 })
  }
}
