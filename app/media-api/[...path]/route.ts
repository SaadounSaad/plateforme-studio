import { NextRequest, NextResponse } from 'next/server'

const BACKEND = 'http://localhost:7880'
const CSRF_TOKEN = process.env.MEDIA_BACKEND_CSRF_TOKEN || 'media-backend-local-token-change-me'

// Frontend hits /media-api/<x>. Map to backend:
//   health        -> /health
//   <anything else> -> /api/<anything else>
function targetUrl(segments: string[], search: string) {
  const path = segments.join('/')
  const backendPath = path === 'health' ? '/health' : `/api/${path}`
  return `${BACKEND}${backendPath}${search}`
}

async function proxy(request: NextRequest, segments: string[]) {
  const url = targetUrl(segments, request.nextUrl.search)
  try {
    const init: RequestInit = {
      method: request.method,
      headers: { 'X-Local-Request': CSRF_TOKEN },
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const ct = request.headers.get('content-type') || ''
      // Forward body as-is; preserve content-type for JSON and multipart
      init.body = await request.arrayBuffer()
      if (ct) (init.headers as Record<string, string>)['content-type'] = ct
    }
    const res = await fetch(url, init)
    // Stream the response body through (videos / zips can be large)
    const headers = new Headers()
    const cd = res.headers.get('content-disposition')
    const ctype = res.headers.get('content-type')
    if (cd) headers.set('Content-Disposition', cd)
    if (ctype) headers.set('Content-Type', ctype)
    return new NextResponse(res.body, { status: res.status, headers })
  } catch {
    return NextResponse.json(
      {
        error: 'Media backend hors ligne.',
        hint: 'Ce service nécessite un serveur local avec yt-dlp, ffmpeg et whisper.',
        action: 'Lancez `node media-backend/server.js` sur votre machine.',
      },
      { status: 503 }
    )
  }
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  return proxy(request, path)
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  return proxy(request, path)
}
