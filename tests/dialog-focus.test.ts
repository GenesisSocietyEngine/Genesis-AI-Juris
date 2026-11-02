import test from 'node:test';
import assert from 'node:assert/strict';
import { containDialogFocus } from '../app/dialog-focus';

// Modelled DOM contract tests, not production keyboard/browser acceptance.
function fixture() {
  let listener: ((event: KeyboardEvent) => void) | undefined;
  const document = {
    activeElement: null as unknown,
    addEventListener(_name: string, next: typeof listener) { listener = next; },
    removeEventListener(_name: string, next: typeof listener) { if (listener === next) listener = undefined; },
  };
  function control(initial = false, visible = true, tabIndex = 0) {
    return { isConnected: true, tabIndex,
      focus() { document.activeElement = this; },
      getClientRects: () => visible ? [{}] : [],
      getAttribute: () => null,
      hasAttribute: (name: string) => initial && name === 'data-dialog-initial-focus',
    };
  }
  const opener = control(), first = control(), preferred = control(true), last = control();
  let controls = [first, preferred, last, control(true, false), control(true, true, -1)];
  opener.focus();
  const dialog = { ownerDocument: document, querySelectorAll: () => controls,
    focus() { document.activeElement = this; } };
  function key(key: string, shiftKey = false, defaultPrevented = false) {
    const event = { key, shiftKey, defaultPrevented,
      preventDefault() { this.defaultPrevented = true; } };
    listener?.(event as KeyboardEvent);
    return event;
  }
  return { document, opener, first, preferred, last, dialog: dialog as unknown as HTMLElement,
    key, empty() { controls = []; } };
}

test('dialog focuses preferred visible control and wraps both directions', () => {
  const f = fixture();
  const cleanup = containDialogFocus(f.dialog, () => {});
  assert.equal(f.document.activeElement, f.preferred);
  assert.equal(f.key('Tab').defaultPrevented, false, 'normal middle traversal belongs to the browser');
  f.last.focus();
  assert.equal(f.key('Tab').defaultPrevented, true);
  assert.equal(f.document.activeElement, f.first);
  f.key('Tab', true);
  assert.equal(f.document.activeElement, f.last);
  f.opener.focus();
  f.key('Tab');
  assert.equal(f.document.activeElement, f.first);
  cleanup();
  assert.equal(f.document.activeElement, f.opener);
});

test('Escape closes once, respects handled events and cleanup removes listener', () => {
  const f = fixture(); let closed = 0;
  const cleanup = containDialogFocus(f.dialog, () => { closed++; });
  f.key('Escape', false, true);
  assert.equal(closed, 0);
  assert.equal(f.key('Escape').defaultPrevented, true);
  assert.equal(closed, 1);
  f.opener.isConnected = false;
  cleanup();
  assert.equal(f.document.activeElement, f.preferred, 'detached opener is not focused');
  f.key('Escape');
  assert.equal(closed, 1);
});

test('dialog without available controls retains keyboard focus at its root', () => {
  const f = fixture(); f.empty();
  const cleanup = containDialogFocus(f.dialog, () => {});
  assert.equal(f.document.activeElement, f.dialog);
  assert.equal(f.key('Tab').defaultPrevented, true);
  assert.equal(f.key('Tab', true).defaultPrevented, true);
  cleanup();
});
