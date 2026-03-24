type PostContextType = 'post' | 'comment'

interface PostContext {
  author: string
  text: string
  type: PostContextType
  url: string
  capturedAt: number
}

interface GenerateRequestBody {
  context: PostContext
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function clamp(s: string, max: number) {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}

/**
 * Vercel Serverless Function: /api/generate
 * Keep this file dependency-free (no @vercel/node types) to simplify builds.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const env = ((globalThis as any)?.process?.env ?? {}) as Record<string, string | undefined>
  const apiKey = env.OPENROUTER_API_KEY
  const model = env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'

  if (!isNonEmptyString(apiKey)) {
    res.status(500).json({ error: 'Missing OPENROUTER_API_KEY' })
    return
  }

  const body = req.body as GenerateRequestBody | undefined
  const context = body?.context

  if (!context || !isNonEmptyString(context.text)) {
    res.status(400).json({ error: 'Missing context.text' })
    return
  }

  const author = isNonEmptyString(context.author) ? clamp(context.author.trim(), 120) : 'o autor'
  const postText = clamp(context.text.trim(), 1400)
  const url = isNonEmptyString(context.url) ? clamp(context.url.trim(), 300) : ''

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)

  try {
    const prompt = [
      `Gere uma resposta profissional, engajadora e humana para um comentário no LinkedIn.`,
      `Regras:`,
      `- Escreva em português.`,
      `- 3 a 6 frases, tom confiante e gentil.`,
      `- Traga 1 insight prático ou pergunta inteligente no final.`,
      `- Não use emojis.`,
      `- Não invente fatos além do contexto.`,
    ].join('\n')

    const user = [
      `Autor do post: ${author}`,
      url ? `URL: ${url}` : null,
      `Contexto do post:`,
      postText,
    ]
      .filter(Boolean)
      .join('\n')

    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // Recommended by OpenRouter:
        'HTTP-Referer': req.headers.referer || 'http://localhost',
        'X-Title': 'AI Context Bridge',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: user },
        ],
        temperature: 0.6,
        max_tokens: 300,
      }),
    })

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      res.status(502).json({ error: errText || `OpenRouter error (${resp.status})` })
      return
    }

    const data = (await resp.json()) as any
    const text: string | undefined = data?.choices?.[0]?.message?.content

    if (!isNonEmptyString(text)) {
      res.status(502).json({ error: 'No completion text returned' })
      return
    }

    res.status(200).json({ text: text.trim() })
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      res.status(504).json({ error: 'AI request timed out' })
      return
    }
    res.status(500).json({ error: String(e?.message || e) })
  } finally {
    clearTimeout(timeout)
  }
}

