const STORAGE_KEY = 'AICB_APP_URL'
const DEFAULT_APP_URL = 'https://extension-ai-ruddy.vercel.app'
const LAST_CONTEXT_KEY = 'AICB_LAST_CONTEXT_MSG'

/** @type {HTMLInputElement | null} */
const appUrlInput = document.getElementById('appUrl')
/** @type {HTMLIFrameElement | null} */
const appFrame = document.getElementById('appFrame')
/** @type {HTMLButtonElement | null} */
const saveUrlBtn = document.getElementById('saveUrl')
/** @type {HTMLButtonElement | null} */
const captureNowBtn = document.getElementById('captureNow')
/** @type {HTMLDivElement | null} */
const bridgeStatus = document.getElementById('bridgeStatus')

function setStatus(text) {
  if (bridgeStatus) bridgeStatus.textContent = `Bridge: ${text}`
}

function getOrigin(url) {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

async function loadAppUrl() {
  const stored = await chrome.storage.sync.get([STORAGE_KEY])
  const url = stored[STORAGE_KEY] || DEFAULT_APP_URL
  if (appUrlInput) appUrlInput.value = url
  if (appFrame) appFrame.src = url
}

async function saveAppUrl() {
  const url = appUrlInput?.value?.trim() || DEFAULT_APP_URL
  await chrome.storage.sync.set({ [STORAGE_KEY]: url })
  if (appFrame) appFrame.src = url
}

function postToApp(message) {
  if (!appFrame?.contentWindow) return
  const url = appFrame.src || DEFAULT_APP_URL
  const origin = getOrigin(url)
  // If we can determine origin, target it; otherwise fallback.
  appFrame.contentWindow.postMessage(message, origin ?? '*')
}

// Receive messages from background → forward to iframe app
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || typeof msg !== 'object') return

  if (msg.type === 'AICB_POST_CONTEXT') {
    setStatus('context received (runtime)')
    postToApp(msg)
  }
})

// Fallback channel: receive latest context from storage updates.
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return
  const next = changes?.[LAST_CONTEXT_KEY]?.newValue
  if (next?.type === 'AICB_POST_CONTEXT') {
    setStatus('context received (storage)')
    postToApp(next)
  }
})

// Receive messages from iframe app → forward to background
window.addEventListener('message', (ev) => {
  const msg = ev.data
  if (!msg || typeof msg !== 'object') return

  if (msg.type === 'AICB_INSERT_TEXT') {
    chrome.runtime.sendMessage(msg)
  }
})

saveUrlBtn?.addEventListener('click', async () => {
  await saveAppUrl()
  setStatus('app url saved')
})
captureNowBtn?.addEventListener('click', async () => {
  setStatus('capturing...')
  const resp = await chrome.runtime
    .sendMessage({ type: 'AICB_REQUEST_CONTEXT' })
    .catch((e) => ({ ok: false, error: String(e?.message || e) }))

  if (!resp?.ok) {
    setStatus(`capture failed: ${resp?.error || 'unknown error'}`)
    return
  }

  if (resp?.context) {
    const msg = { type: 'AICB_POST_CONTEXT', payload: { context: resp.context } }
    postToApp(msg)
    setStatus('captured from active tab')
    return
  }

  setStatus('capture request sent')
})
void loadAppUrl().then(async () => {
  // Ask background for any cached context so the panel opens "warm".
  const msg = await chrome.runtime.sendMessage({ type: 'AICB_GET_LAST_CONTEXT' }).catch(
    () => null,
  )
  if (msg?.type === 'AICB_POST_CONTEXT') {
    setStatus('loaded cached context')
    postToApp(msg)
  }

  // Extra fallback: read last context from local storage.
  const stored = await chrome.storage.local.get([LAST_CONTEXT_KEY]).catch(() => ({}))
  const cachedMsg = stored?.[LAST_CONTEXT_KEY]
  if (cachedMsg?.type === 'AICB_POST_CONTEXT') {
    setStatus('loaded storage context')
    postToApp(cachedMsg)
  }

  // Keep panel and iframe synced even if one message is dropped.
  setInterval(async () => {
    const recent = await chrome.runtime
      .sendMessage({ type: 'AICB_GET_LAST_CONTEXT' })
      .catch(() => null)
    if (recent?.type === 'AICB_POST_CONTEXT') postToApp(recent)
  }, 2000)
})

