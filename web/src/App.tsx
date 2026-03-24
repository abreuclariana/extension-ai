import { useMemo, useState } from 'react'
import type { PostContext } from './types'
import { useAIGenerator } from './hooks/useAIGenerator'
import { usePostContext } from './hooks/usePostContext'

function App() {
  const { context, isConnected } = usePostContext()
  const [draft, setDraft] = useState('')
  const { generate, isLoading, error } = useAIGenerator()

  const effectiveContext: PostContext | null = context
  const canGenerate = Boolean(effectiveContext?.text?.trim())

  const placeholder = useMemo(() => {
    if (!isConnected) return 'Abra o Side Panel via extensão para conectar ao LinkedIn…'
    if (!effectiveContext) return 'Clique em um campo de comentário no LinkedIn para capturar o contexto…'
    return 'Clique em Generate para criar uma resposta — depois ajuste o texto aqui.'
  }, [effectiveContext, isConnected])

  async function onGenerate() {
    if (!effectiveContext) return
    const result = await generate({ context: effectiveContext })
    if (result?.text) setDraft(result.text)
  }

  function onInsert() {
    if (!draft.trim()) return
    // When embedded inside the extension side panel, parent will relay this to the active tab.
    window.parent?.postMessage(
      { type: 'AICB_INSERT_TEXT', payload: { text: draft } },
      '*',
    )
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col gap-4 p-4">
      <header className="rounded-2xl border border-border bg-surface p-4 shadow-(--shadow-soft)">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold tracking-wide text-ink-3">
              AI Context Bridge
            </div>
            <div className="text-lg font-semibold leading-tight">
              LinkedIn Reply Copilot
            </div>
          </div>
          <div
            className={[
              'rounded-full px-2 py-1 text-xs font-medium',
              isConnected
                ? 'bg-brand-weak text-brand'
                : 'bg-zinc-100 text-zinc-600',
            ].join(' ')}
            title={isConnected ? 'Conectado à extensão' : 'Rodando fora da extensão'}
          >
            {isConnected ? 'Connected' : 'Standalone'}
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-border bg-surface-2 p-3">
          <div className="text-xs font-semibold text-ink-3">
            Contexto capturado
          </div>
          {effectiveContext ? (
            <div className="mt-1 space-y-1">
              <div className="text-sm font-semibold">
                {effectiveContext.author || 'Autor não detectado'}
              </div>
              <div className="max-h-28 overflow-auto whitespace-pre-wrap text-sm text-ink-2">
                {effectiveContext.text}
              </div>
            </div>
          ) : (
            <div className="mt-1 text-sm text-ink-2">
              {placeholder}
            </div>
          )}
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-surface p-4 shadow-(--shadow-soft)">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">Resposta</div>
          <button
            className={[
              'rounded-xl px-3 py-2 text-sm font-semibold',
              'border border-border',
              canGenerate && !isLoading
                ? 'bg-brand text-white hover:opacity-95'
                : 'bg-zinc-100 text-zinc-500',
            ].join(' ')}
            onClick={onGenerate}
            disabled={!canGenerate || isLoading}
          >
            {isLoading ? 'Generating…' : 'Generate'}
          </button>
        </div>

        <textarea
          className="mt-3 h-52 w-full resize-none rounded-xl border border-border bg-white p-3 text-sm leading-relaxed outline-none focus:ring-4 focus:ring-brand-weak"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
        />

        {error ? (
          <div className="mt-2 text-sm text-red-600">{error}</div>
        ) : null}

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            className="rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-surface-2"
            onClick={() => setDraft('')}
            disabled={!draft}
          >
            Clear
          </button>
          <button
            className={[
              'rounded-xl px-3 py-2 text-sm font-semibold',
              draft.trim()
                ? 'bg-brand text-white hover:opacity-95'
                : 'bg-zinc-100 text-zinc-500',
            ].join(' ')}
            onClick={onInsert}
            disabled={!draft.trim()}
            title="Insere o texto no campo de comentário focado no LinkedIn"
          >
            Insert
          </button>
        </div>
      </section>

      <footer className="pb-4 text-center text-xs text-ink-3">
        Clean Code over Speed · isolamento via side panel + message passing
      </footer>
    </div>
  )
}

export default App
