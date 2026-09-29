/** Overview scale fits both axes. It never mutates node layout or the model. */
export function graphOverviewScale(viewport: { width: number; height: number }, bounds: { width: number; height: number }) {
  if (![viewport.width, viewport.height, bounds.width, bounds.height].every(value => Number.isFinite(value) && value > 0)) return 1;
  return Math.min(1, Math.max(1, viewport.width - 28) / bounds.width, Math.max(1, viewport.height - 28) / bounds.height);
}
