import StudioDeferredPanel from "./StudioDeferredPanel";
import type { StudioSimulationPanelProps } from "./StudioSimulationPanel";
const load = () => import("./StudioSimulationPanel");
export default function StudioSimulationPanelLoader(props: StudioSimulationPanelProps) {
  return <StudioDeferredPanel load={load} panelProps={props}/>;
}
