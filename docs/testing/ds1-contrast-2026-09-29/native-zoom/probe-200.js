new Promise(resolve => {
  let timeout;
  const handler = event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.channel !== 'genesis-ds1-zoom-response') return;
    window.removeEventListener('message', handler);
    clearTimeout(timeout);
    requestAnimationFrame(() => requestAnimationFrame(() => resolve({
      receipt: event.data.receipt,
      url: location.href,
      width: innerWidth, height: innerHeight,
      outerWidth, outerHeight, dpr: devicePixelRatio,
      visualViewport: {width: visualViewport.width, height: visualViewport.height, scale: visualViewport.scale},
      cssZoom: getComputedStyle(document.documentElement).zoom,
      bodyZoom: getComputedStyle(document.body).zoom,
      userAgent: navigator.userAgent
    })));
  };
  window.addEventListener('message', handler);
  window.postMessage({channel:'genesis-ds1-zoom-request', action:'set', factor:2}, location.origin);
  timeout = setTimeout(() => {window.removeEventListener('message', handler);resolve({error:'Extension receipt timeout'});}, 5000);
})
