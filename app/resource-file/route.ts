import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'

const SKILLS_DIR = path.join(os.homedir(), '.claude', 'skills')

export async function GET(request: NextRequest) {
  const filePath = request.nextUrl.searchParams.get('path')
  if (!filePath) {
    return NextResponse.json({ error: 'Paramètre path manquant' }, { status: 400 })
  }
  try {
    // Security: only serve files within the skills directory
    const abs = path.resolve(filePath)
    const safeBase = path.resolve(SKILLS_DIR)
    if (!abs.startsWith(safeBase + path.sep) && abs !== safeBase) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }
    if (!fs.existsSync(abs)) {
      return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 })
    }
    const content = fs.readFileSync(abs, 'utf-8')
    return new NextResponse(content, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch {
    return NextResponse.json({ error: 'Erreur lecture fichier' }, { status: 500 })
  }
}
