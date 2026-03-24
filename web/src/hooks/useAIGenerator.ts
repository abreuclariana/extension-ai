import { useCallback, useState } from 'react'
import type { GenerateRequest, GenerateResponse } from '../types'

async function postJSON<TResponse>(url: string, body: unknown): Promise<TResponse> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed (${res.status})`)
  }

  return (await res.json()) as TResponse
}

export function useAIGenerator() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async (req: GenerateRequest) => {
    setError(null)
    setIsLoading(true)
    try {
      const base = (import.meta as any)?.env?.VITE_API_BASE || ''
      // Vercel serverless function (same origin) or local dev (set VITE_API_BASE).
      const data = await postJSON<GenerateResponse>(`${base}/api/generate`, req)
      return data
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setError(message)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { generate, isLoading, error }
}

