const STORAGE_KEY = 'AICB_APP_URL'
const DEFAULT_APP_URL = 'https://extension-ai-ruddy.vercel.app'

/** @type {HTMLInputElement | null} */
const appUrlInput = document.getElementById('appUrl')
/** @type {HTMLIFrameElement | null} */
const appFrame = document.getElementById('appFrame')
/** @type {HTMLButtonElement | null} */
const saveUrlBtn = document.getElementById('saveUrl')

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
    postToApp(msg)
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

saveUrlBtn?.addEventListener('click', () => void saveAppUrl())
void loadAppUrl().then(async () => {
  // Ask background for any cached context so the panel opens "warm".
  const msg = await chrome.runtime.sendMessage({ type: 'AICB_GET_LAST_CONTEXT' }).catch(
    () => null,
  )
  if (msg?.type === 'AICB_POST_CONTEXT') postToApp(msg)
})

