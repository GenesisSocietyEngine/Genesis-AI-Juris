import StudioDeferredPanel from "./StudioDeferredPanel";
import type StudioNodeConnections from "./StudioNodeConnections";
const load = () => import("./StudioNodeConnections");
export default function StudioNodeConnectionsLoader(props: Parameters<typeof StudioNodeConnections>[0]) {
  return <StudioDeferredPanel load={load} panelProps={props}/>;
}
