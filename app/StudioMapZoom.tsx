"use client";

import { useCallback, type RefObject } from "react";

export default function StudioMapZoom({ locale, graphZoom, graphViewportRef, onZoom }: {
  locale: "en" | "ru"; graphZoom: number; graphViewportRef: RefObject<HTMLDivElement | null>; onZoom: (next: number) => void;
}) {
  const changeGraphZoom = useCallback((direction: -1 | 1) => {
    const viewport = graphViewportRef.current;
    if (!viewport) return;
    const next = Math.min(2, Math.max(0.1, Math.round((graphZoom + direction * 0.1) * 100) / 100));
    if ((direction < 0 && graphZoom <= 0.1) || next === graphZoom) return;
    const centerX = (viewport.scrollLeft + viewport.clientWidth / 2) / graphZoom;
    const centerY = (viewport.scrollTop + viewport.clientHeight / 2) / graphZoom;
    onZoom(next);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      if (graphViewportRef.current !== viewport) return;
      viewport.scrollTo({ left: Math.max(0, centerX * next - viewport.clientWidth / 2),
        top: Math.max(0, centerY * next - viewport.clientHeight / 2), behavior: "auto" });
    }));
  }, [graphZoom, graphViewportRef, onZoom]);
  return (<div className="graph-scale-bar" role="group" aria-label={locale === "en" ? "Map zoom" : "Масштаб карты"}>
          <button type="button" onClick={() => changeGraphZoom(-1)} disabled={graphZoom <= 0.1} aria-label={locale === "en" ? "Zoom out by 10%" : "Уменьшить масштаб на 10%"}>−10%</button>
          <output aria-live="polite" aria-label={locale === "en" ? "Current zoom" : "Текущий масштаб"}>{Math.round(graphZoom * 100)}%</output>
          <button type="button" onClick={() => changeGraphZoom(1)} disabled={graphZoom >= 2} aria-label={locale === "en" ? "Zoom in by 10%" : "Увеличить масштаб на 10%"}>+10%</button>
        </div>);
}
