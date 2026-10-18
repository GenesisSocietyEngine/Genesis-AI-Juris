import StudioDeferredPanel from "./StudioDeferredPanel";
import type StudioDecisionList from "./StudioDecisionList";
const load = () => import("./StudioDecisionList");
export default function StudioDecisionListLoader(props: Parameters<typeof StudioDecisionList>[0]) {
  return <StudioDeferredPanel load={load} panelProps={props}/>;
}
