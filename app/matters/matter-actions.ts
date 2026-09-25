import type { MatterDestination, ReadinessReason, SnapshotItem, OutputItem } from './matter-view-model';

export type MatterActionTarget = { destination: MatterDestination; id: string; requestId?: string; packageRefId?: string };
export type MatterAction = { title: string; detail: string; target: MatterActionTarget };

/** Only local, known controls are addressable. Server-provided URLs never become navigation code. */
export function actionForFinding(finding: ReadinessReason, snapshots: SnapshotItem[] = [], outputs: OutputItem[] = [], revision?: number): MatterAction {
  const id = finding.relatedObjectId;
  const target = (destination: MatterDestination, control: string, title: string): MatterAction => ({ title, detail: finding.explanation, target: { destination, id: control } });
  switch (finding.code) {
    case 'DOCUMENT_REQUIRED_MISSING': return target('documents', 'document-upload', 'Add a source document');
    case 'DOCUMENT_REVIEW_REQUIRED': return target('documents', id ? `document-${id}` : 'document-upload', 'Review the source document');
    case 'INFORMATION_REQUEST_OPEN':
    case 'INFORMATION_REQUEST_OVERDUE': return { title: 'Provide requested information', detail: finding.explanation, target: { destination: 'requests', id: id ? 'request-response' : 'request-create', requestId: id ?? undefined } };
    case 'AI_PROPOSAL_PENDING': return target('evidence', id ? `proposal-${id}` : 'proposal-review-title', 'Review the proposed change');
    case 'CONTRADICTION_UNRESOLVED': return target('evidence', id ? `assertion-${id}` : 'assertion-create', 'Review conflicting evidence');
    case 'SOURCE_ANCHOR_MISSING': return target('evidence', id ? `assertion-${id}` : 'anchor-create', 'Repair the evidence citation');
    case 'SOURCE_VERSION_STALE': return target('evidence', id ? `source-${id}` : 'anchor-create', 'Review the changed source');
    case 'CRITICAL_DEADLINE_MISSING': return target('requests', 'key-deadline-editor', 'Set the key case deadline');
    case 'CRITICAL_DEADLINE_OVERDUE': return target('requests', id ? `deadline-${id}` : 'deadline-register', 'Review the overdue deadline');
    case 'DECISION_GRAPH_INVALID': return { ...target('decision-packages', 'package-link', 'Link a verified decision map'), target: {destination:'decision-packages', id:'package-link', packageRefId:id ?? undefined} };
    case 'SIMULATION_FAILED':
    case 'SIMULATION_REQUIRED': return { ...target('decision-packages', 'package-link', 'Attach a completed simulation'), target: {destination:'decision-packages', id:'package-link', packageRefId:id ?? undefined} };
    case 'REVIEWER_APPROVAL_MISSING': {
      const output = id ? outputs.find(output => output.id === id && output.state === 'current') : outputs.find(output => output.state === 'current');
      if (output) return target('outputs', `output-${output.id}`, 'Review the current report');
      break;
    }
    case 'OUTPUT_STALE': return id ? target('outputs', `output-${id}`, 'Refresh the outdated report') : target('decision-packages', 'snapshot-create', 'Save current evidence for the report');
    case 'OUTPUT_REQUIRED': break;
    default: return target('overview', 'readiness-dimensions-title', 'Inspect the readiness finding');
  }
  return snapshots.some(snapshot => snapshot.sealed === true && snapshot.dossierRevision === revision && snapshot.manifestDigest)
    ? target('outputs', 'report-generate', 'Generate the decision report')
    : target('decision-packages', 'snapshot-create', 'Save evidence for the report');
}
