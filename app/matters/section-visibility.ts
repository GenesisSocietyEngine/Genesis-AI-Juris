/** Move only the tab strip; never scroll the page away from an exact record. */
export function selectedTabScrollLeft(current: number, viewport: number, start: number, width: number): number {
  if (viewport <= 0) return current;
  if (start < current || width > viewport) return Math.max(0, start);
  if (start + width > current + viewport) return Math.max(0, start + width - viewport);
  return current;
}
