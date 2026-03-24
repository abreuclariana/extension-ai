/**
 * AI Context Bridge — LinkedIn content script
 *
 * Goal:
 * - Detect when the user focuses a comment editor
 * - Extract a robust-ish post context (author + post text)
 * - Send it to the extension runtime (background → side panel)
 * - Receive "insert text" and inject into the focused editor (with events)
 */

/** @type {HTMLElement | null} */
let lastFocusedEditor = null

function isEditableElement(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false
  const element = /** @type {HTMLElement} */ (el)
  if (element.getAttribute?.('contenteditable') === 'true') return true
  const tag = element.tagName?.toLowerCase()
  return tag === 'textarea' || tag === 'input'
}

function getEditorFromEventTarget(target) {
  if (!target || target.nodeType !== Node.ELEMENT_NODE) return null
  const el = /** @type {HTMLElement} */ (target)
  const editable = el.closest?.('[contenteditable="true"], textarea, input')
  return /** @type {HTMLElement | null} */ (editable)
}

function firstNonEmptyText(root, selectors) {
  for (const sel of selectors) {
    const node = root.querySelector(sel)
    const text = node?.textContent?.trim()
    if (text) return text
  }
  return ''
}

function clampText(text, max = 1200) {
  const t = (text || '').trim().replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
  if (t.length <= max) return t
  return t.slice(0, max - 1) + '…'
}

function findPostContainer(fromEl) {
  if (!fromEl) return null

  // Heuristics: LinkedIn feed posts are often inside <article> or data-urn containers.
  const candidates = [
    'article',
    '[data-urn]',
    '.feed-shared-update-v2',
    '.scaffold-finite-scroll__content',
  ]

  for (const sel of candidates) {
    const found = fromEl.closest(sel)
    if (found) return /** @type {HTMLElement} */ (found)
  }

  // Fallback: climb up a bit to avoid grabbing the whole page.
  let cur = fromEl
  for (let i = 0; i < 8 && cur; i++) {
    if (cur.parentElement) cur = cur.parentElement
  }
  return cur
}

function extractAuthor(container) {
  if (!container) return ''
  return firstNonEmptyText(container, [
    // Newer UI
    '.update-components-actor__name span[aria-hidden="true"]',
    '.update-components-actor__name',
    // Older UI
    '.feed-shared-actor__name span[aria-hidden="true"]',
    '.feed-shared-actor__name',
    // Generic fallbacks
    'a[data-test-app-aware-link] span[aria-hidden="true"]',
    'span[dir="ltr"]',
  ])
}

function extractPostText(container) {
  if (!container) return ''

  const text = firstNonEmptyText(container, [
    '.update-components-text',
    '.feed-shared-update-v2__description',
    '.feed-shared-text',
    'span.break-words',
  ])

  if (text) return clampText(text)

  // Fallback: grab some text but avoid nav/sidebars by using the container only.
  const raw = container.innerText || ''
  return clampText(raw)
}

function buildContext(editorEl) {
  const container = findPostContainer(editorEl)
  const author = extractAuthor(container)
  const text = extractPostText(container)
  const url = location.href

  return {
    author,
    text,
    type: 'comment',
    url,
    capturedAt: Date.now(),
  }
}

async function sendContext(context) {
  try {
    await chrome.runtime.sendMessage({ type: 'AICB_POST_CONTEXT', payload: { context } })
  } catch {
    // ignored
  }
}

function notifyIfEditorFocused(target) {
  const editor = getEditorFromEventTarget(target)
  if (!editor) return

  // Ignore some known false positives (search fields, etc.) by requiring it to be in main feed.
  if (editor.closest?.('header')) return

  lastFocusedEditor = editor
  const ctx = buildContext(editor)
  if (ctx.text) void sendContext(ctx)
}

function dispatchLinkedInEvents(el) {
  try {
    el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }))
  } catch {
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function insertIntoTextarea(el, text) {
  const input = /** @type {HTMLInputElement | HTMLTextAreaElement} */ (el)
  input.focus()
  input.value = text
  dispatchLinkedInEvents(input)
}

function insertIntoContentEditable(el, text) {
  el.focus()

  // Try execCommand first (still the most compatible path for many rich editors).
  let ok = false
  try {
    ok = document.execCommand('insertText', false, text)
  } catch {
    ok = false
  }

  if (!ok) {
    el.textContent = text
  }

  dispatchLinkedInEvents(el)
}

function handleInsertText(text) {
  const target =
    lastFocusedEditor ||
    (document.activeElement && isEditableElement(document.activeElement)
      ? /** @type {HTMLElement} */ (document.activeElement)
      : null) ||
    getEditorFromEventTarget(document.activeElement)

  if (!target) return { ok: false, error: 'No focused editor found' }

  const tag = target.tagName?.toLowerCase()
  if (tag === 'textarea' || tag === 'input') {
    insertIntoTextarea(target, text)
    return { ok: true }
  }

  if (target.getAttribute?.('contenteditable') === 'true') {
    insertIntoContentEditable(target, text)
    return { ok: true }
  }

  return { ok: false, error: 'Unsupported editor element' }
}

// Detect focus via click + focusin (LinkedIn uses many nested nodes)
document.addEventListener(
  'click',
  (ev) => {
    notifyIfEditorFocused(ev.target)
  },
  true,
)
document.addEventListener(
  'focusin',
  (ev) => {
    notifyIfEditorFocused(ev.target)
  },
  true,
)

// Receive insert command from background
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return
  if (msg.type !== 'AICB_INSERT_TEXT') return
  const text = msg?.payload?.text
  if (typeof text !== 'string') {
    sendResponse?.({ ok: false, error: 'Invalid payload.text' })
    return
  }
  const result = handleInsertText(text)
  sendResponse?.(result)
  return true
})

