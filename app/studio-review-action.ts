import { caseTypePlaybook } from './case-type-playbooks';
import type { StudioDraft } from './types';
import type { StudioCheck } from './studio-validation';
import type { StudioActionTarget } from './StudioActionPanel';
export function studioReviewAction(draft: StudioDraft, check: StudioCheck): StudioActionTarget {
 const playbook = caseTypePlaybook(draft.caseType);
    if (!draft.nodes.length) return { step: 1, id: "studio-case-brief" };
    const group = playbook.requiredNodeGroups.find(group => `nodes:${group.id}` === check.id);
    if (group) return { step: 3, id: "studio-evidence-composer", nodeType: group.types.includes("evidence") ? "evidence" : group.types[0] };
    if (check.id === "brief") return { step: 3, id: draft.title.trim() ? "studio-publishable-context" : "studio-title" };
    if (check.id === "context") return { step: 3, id: "studio-publishable-context" };
    if (check.id === "identity" || check.id === "version") return { step: 3, id: check.id === "version" ? "studio-case-version" : "studio-case-identity", developer: true };
    if (check.id === "participants") return { step: 3, id: draft.jurisdiction.trim() ? "studio-role" : "studio-jurisdiction" };
    if (check.id === "legal-as-of") return { step: 3, id: "studio-legal-date" };
    if (check.id === "https-sources") return { step: 3, id: "studio-source-urls" };
    if (check.id === "compliance-gate") return { step: 3, id: "studio-compliance" };
    if (check.missingStart) return { step: 3, id: "studio-evidence-composer", nodeType: "trigger" };
    const exactNode = check.nodeIds?.find(id => draft.nodes.some(node => node.id === id));
    if (exactNode) return { step: 4, id: `studio-node-${exactNode}`, nodeId: exactNode };
    const connected = new Set(draft.links.flatMap(link => [link.from, link.to]));
    return { step: 4, id: "studio-connect-node", nodeId: draft.nodes.find(node => !connected.has(node.id))?.id ?? draft.nodes.find(node => node.type === "trigger")?.id ?? draft.nodes[0]?.id };
}
