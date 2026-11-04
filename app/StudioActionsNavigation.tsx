"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

const emptySlot: { target: HTMLDivElement | null; setTarget: (node: HTMLDivElement | null) => void } = { target: null, setTarget: () => {} };
const StudioActionsContext = createContext(emptySlot);

// One current editor owns the action handlers. The sidebar only owns their DOM
// destination; drawer remounts must not copy or retain case/account callbacks.
export default function StudioActionsNavigation({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const value = useMemo(() => ({ target, setTarget }), [target]);
  return <StudioActionsContext.Provider value={value}>{children}</StudioActionsContext.Provider>;
}

export function useStudioActionsNavigation() { return useContext(StudioActionsContext); }
