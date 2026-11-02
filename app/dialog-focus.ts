/** Modal keyboard lifecycle. Call after mount; invoke cleanup on unmount. */
export function containDialogFocus(dialog: HTMLElement, close: () => void) {
  const document = dialog.ownerDocument;
  const previous = document.activeElement as HTMLElement | null;
  const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>(
    'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],summary,[tabindex]:not([tabindex="-1"])',
  )).filter(control => control.tabIndex >= 0 && control.getClientRects().length > 0 && control.getAttribute('aria-hidden') !== 'true');
  const initial = controls();
  (initial.find(control => control.hasAttribute('data-dialog-initial-focus')) ?? initial[0] ?? dialog).focus();
  const keydown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (event.key !== 'Tab') return;
    const current = controls(), index = current.indexOf(document.activeElement as HTMLElement);
    if (!current.length) { event.preventDefault(); dialog.focus(); return; }
    if (event.shiftKey && index <= 0) { event.preventDefault(); current[current.length - 1].focus(); }
    else if (!event.shiftKey && (index < 0 || index === current.length - 1)) { event.preventDefault(); current[0].focus(); }
  };
  document.addEventListener('keydown', keydown);
  return () => {
    document.removeEventListener('keydown', keydown);
    if (previous?.isConnected && typeof previous.focus === 'function') previous.focus();
  };
}
