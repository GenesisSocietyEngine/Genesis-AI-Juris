chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.tab?.id === undefined || !sender.url?.startsWith('http://127.0.0.1:4197/') || message?.channel !== 'genesis-ds1-zoom') return false;
  (async () => {
    if (message.action === 'set') {
      if (![1, 2].includes(message.factor)) throw new Error('Only 100% or 200% permitted');
      await chrome.tabs.setZoomSettings(sender.tab.id, {mode: 'automatic', scope: 'per-tab'});
      await chrome.tabs.setZoom(sender.tab.id, message.factor);
    }
    const factor = await chrome.tabs.getZoom(sender.tab.id);
    const settings = await chrome.tabs.getZoomSettings(sender.tab.id);
    sendResponse({ok: true, factor, settings, tabId: sender.tab.id, api: 'chrome.tabs.getZoom'});
  })().catch(error => sendResponse({ok: false, error: String(error)}));
  return true;
});
