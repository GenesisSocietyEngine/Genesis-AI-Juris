"use client";
import type { ComponentProps } from "react";
import StudioDeferredPanel from "./StudioDeferredPanel";
import type StudioRecoveryView from "./StudioRecoveryView";

const load = () => import("./StudioRecoveryView");

export default function StudioRecoveryViewLoader(props: ComponentProps<typeof StudioRecoveryView>) {
  return <StudioDeferredPanel load={load} panelProps={props}/>;
}
