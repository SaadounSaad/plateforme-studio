import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'

const SKILLS_DIR = path.join(os.homedir(), '.claude', 'skills')

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/)
  if (!match) return {}
  const fm: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w[\w-]*):\s*(.+)$/)
    if (m) fm[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '')
  }
  return fm
}

export async function GET() {
  if (!fs.existsSync(SKILLS_DIR)) {
    return NextResponse.json([])
  }
  const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
  const resources = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const skillFile = path.join(SKILLS_DIR, entry.name, 'SKILL.md')
    if (!fs.existsSync(skillFile)) continue
    const content = fs.readFileSync(skillFile, 'utf8')
    const fm = parseFrontmatter(content)
    resources.push({
      id: entry.name,
      name: fm.name || entry.name,
      type: 'skill',
      category: 'Code',
      tags: [],
      description: fm.description || '',
      path: skillFile,
    })
  }
  return NextResponse.json(resources)
}
