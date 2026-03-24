const lastContextByTab = new Map() // tabId -> last AICB_POST_CONTEXT

/**
 * Fan out messages to any extension views (side panel page, etc).
 * @param {any} msg
 */
async function broadcast(msg) {
  try {
    await chrome.runtime.sendMessage(msg)
  } catch {
    // No listeners yet (e.g. side panel not opened).
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.windowId) return
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId })
  } catch {
    // sidePanel.open may fail depending on channel / permissions.
  }
})

chrome.runtime.onInstalled?.addListener(() => {
  // Best UX: clicking the extension icon opens the side panel automatically.
  // If unsupported, ignore silently.
  chrome.sidePanel
    ?.setPanelBehavior?.({ openPanelOnActionClick: true })
    .catch?.(() => undefined)
})

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return

  if (msg.type === 'AICB_POST_CONTEXT') {
    const tabId = sender?.tab?.id
    if (typeof tabId === 'number') lastContextByTab.set(tabId, msg)
    void broadcast(msg)
    sendResponse?.({ ok: true })
    return true
  }

  if (msg.type === 'AICB_GET_LAST_CONTEXT') {
    // Prefer active tab's context; fallback to most recent.
    void (async () => {
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (active?.id && lastContextByTab.has(active.id)) {
        sendResponse(lastContextByTab.get(active.id))
        return
      }
      const last = Array.from(lastContextByTab.values()).at(-1) ?? null
      sendResponse(last)
    })()
    return true
  }

  if (msg.type === 'AICB_INSERT_TEXT') {
    void (async () => {
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true })
      const tabId = active?.id
      if (typeof tabId !== 'number') {
        sendResponse({ ok: false, error: 'No active tab' })
        return
      }
      await chrome.tabs.sendMessage(tabId, msg)
      sendResponse({ ok: true })
    })().catch((e) => {
      sendResponse({ ok: false, error: String(e?.message || e) })
    })
    return true
  }
})

