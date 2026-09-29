window.addEventListener('message', event => {
  if (event.source !== window || event.origin !== 'http://127.0.0.1:4197' || event.data?.channel !== 'genesis-ds1-zoom-request') return;
  chrome.runtime.sendMessage({channel: 'genesis-ds1-zoom', action: event.data.action, factor: event.data.factor}, response => {
    window.postMessage({channel: 'genesis-ds1-zoom-response', receipt: response ?? {ok: false, error: chrome.runtime.lastError?.message}}, event.origin);
  });
});
