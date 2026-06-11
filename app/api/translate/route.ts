import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { text, sourceLanguage, targetLanguage, style, apiKey } = await request.json()

    if (!apiKey) {
      return NextResponse.json({ error: 'Clé API Claude manquante' }, { status: 400 })
    }
    if (!text?.trim()) {
      return NextResponse.json({ error: 'Texte vide' }, { status: 400 })
    }

    const styleNote = style === 'Éloquent' ? ' Adopte un style éloquent et littéraire.'
      : style === 'Académique' ? ' Adopte un style académique et rigoureux.'
      : style === 'Simplifié' ? ' Utilise un langage simple et accessible.'
      : ''

    const sourceLang = sourceLanguage === 'Auto-détect' ? '' : ` depuis le ${sourceLanguage}`

    const prompt = `Traduis le texte suivant${sourceLang} vers le ${targetLanguage}.${styleNote}

RÈGLES :
- Traduis UNIQUEMENT le texte, ne l'explique pas
- Préserve le formatage Markdown (##, **, *, listes, tableaux)
- Préserve les séparateurs --- entre les pages
- Ne traduis pas les noms propres sauf si tu connais la traduction officielle

TEXTE À TRADUIRE :
${text}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: err.error?.message ?? `Erreur API Claude: HTTP ${res.status}` },
        { status: res.status }
      )
    }

    const data = await res.json()
    const translatedText = data.content?.[0]?.text ?? ''
    return NextResponse.json({ translatedText })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur traduction' }, { status: 500 })
  }
}
