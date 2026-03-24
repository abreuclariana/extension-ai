import { useEffect, useMemo, useState } from 'react'
import type { PostContext } from '../types'

type BridgeMessage =
  | { type: 'AICB_POST_CONTEXT'; payload: { context: PostContext } }
  | { type: string; payload?: unknown }

function isPostContextMessage(msg: unknown): msg is {
  type: 'AICB_POST_CONTEXT'
  payload: { context: PostContext }
} {
  if (!msg || typeof msg !== 'object') return false
  const t = (msg as { type?: unknown }).type
  if (t !== 'AICB_POST_CONTEXT') return false
  const payload = (msg as { payload?: unknown }).payload
  if (!payload || typeof payload !== 'object') return false
  const ctx = (payload as { context?: unknown }).context
  if (!ctx || typeof ctx !== 'object') return false
  return true
}

/**
 * Receives context from the Chrome extension via window.postMessage
 * (extension sidepanel.html → iframe).
 */
export function usePostContext() {
  const [context, setContext] = useState<PostContext | null>(null)
  const [lastSeenAt, setLastSeenAt] = useState<number | null>(null)

  useEffect(() => {
    function onMessage(ev: MessageEvent<BridgeMessage>) {
      if (!isPostContextMessage(ev.data)) return
      setContext(ev.data.payload.context)
      setLastSeenAt(Date.now())
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const isConnected = useMemo(() => {
    // Heuristic: if embedded in extension iframe, window !== parent.
    // We also treat "recent message" as connected.
    const embedded = window.parent && window.parent !== window
    const recentlySeen = lastSeenAt ? Date.now() - lastSeenAt < 60_000 : false
    return Boolean(embedded || recentlySeen)
  }, [lastSeenAt])

  return { context, isConnected }
}

