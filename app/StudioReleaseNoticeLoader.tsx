"use client";
import { Component, useEffect, useState, type ComponentType, type ReactNode } from "react";
import { withLocalChunkRecovery } from "./stale-chunk-recovery";
import type { StudioReleaseNoticeProps } from "./StudioReleaseNotice";

export async function loadStudioReleaseNotice(active: () => boolean, loaded: (panel: ComponentType<StudioReleaseNoticeProps>) => void, load = () => import("./StudioReleaseNotice")) {
  try {
    const result = await withLocalChunkRecovery(load);
    if (active()) loaded(result.default);
  } catch { /* Optional update awareness must never interrupt the open editor. */ }
}
class OptionalNotice extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}
export default function StudioReleaseNoticeLoader(props: StudioReleaseNoticeProps) {
  const [Panel, setPanel] = useState<ComponentType<StudioReleaseNoticeProps> | null>(null);
  useEffect(() => {
    let active = true;
    void loadStudioReleaseNotice(() => active, module => setPanel(() => module));
    return () => { active = false; };
  }, []);
  return Panel ? <OptionalNotice><Panel {...props}/></OptionalNotice> : null;
}
