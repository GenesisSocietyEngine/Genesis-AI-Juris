import { NavigationController } from "../../app/navigation-controller";
import { WorkController, type FirmCase } from "../../app/work/work-controller";
import { changeWorkflowLibrary, EMPTY_LIBRARY } from "../../app/work/workflow-templates";

export function firmHarness() {
  const actor = "actor_synthetic_firm_owner";
  const org = { id: "org_synthetic_firm_workspace", name: "Synthetic firm", kind: "team", status: "active", role: "org_owner", revision: 1, membershipRevision: 1, actorId: actor, selection: `org_synthetic_firm_workspace.1.1.${actor}` };
  const session = { authenticated: true, identity: { displayName: "Synthetic owner", email: "firm@example.test", authSource: "chatgpt" }, actorId: actor, organizations: [org], selected: org, profileRequired: false };
  const navigation = new NavigationController({ transport: async () => Response.json(session), clear: () => {}, leave: () => {} });
  let library = EMPTY_LIBRARY, serial = 0, lose = false, fail = false;
  const posts: string[] = [], receipts = new Map<string, unknown>();
  const cases: FirmCase[] = Array.from({ length: 27 }, (_, index) => ({ id: `case_${index}`, title: index===0 ? "Supplier dispute · synthetic" : `Synthetic case ${index+1}`, participants: [{ id: `person_${index}`, actorId: actor, name: "Alex Morgan", active: true }], plan: { revision: 1, items: [{ id: `work_${index}`, kind: index%3===0?"event":"task", title: index===0?"Review alternatives and prepare outcome report":"Review supporting documents", description: "Synthetic preview only", dueDate: index===26?null:`2026-11-${String(6+index%20).padStart(2,"0")}`, assignee: `person_${index}`, priority: "normal", status: "open", checklist: [], workflow: null }] } }));
  const transport = async (path: string, init?: RequestInit) => {
    if (path.startsWith("/api/work/templates")) {
      if (init?.method !== "POST") return Response.json({ library, canManage: true });
      posts.push(String(init.body)); const command = JSON.parse(String(init.body));
      if (receipts.has(command.operationKey)) return Response.json(receipts.get(command.operationKey));
      if (command.expectedRevision !== library.revision) return Response.json({ error: "Templates changed. Refresh and compare." }, { status: 409 });
      library = changeWorkflowLibrary(library, command, () => `wf_synthetic_${++serial}`);
      const receipt = { library, operation: command.operationKey }; receipts.set(command.operationKey, receipt);
      if (lose) { lose = false; throw Error("Synthetic lost response"); }
      return Response.json(receipt);
    }
    if (fail && path.includes("cursor=")) return Response.json({ error: "Synthetic failure" }, { status: 503 });
    const second = path.includes("cursor=");
    return Response.json({ scope: org.selection, cases: second ? cases.slice(25) : cases.slice(0,25), nextCursor: second ? null : "page-two" });
  };
  const controller = new WorkController(navigation, transport);
  return { navigation, controller, transport, org, posts, cases, start: () => navigation.refresh(), read: () => library, loseNext: () => { lose=true; }, failRead: (value:boolean) => { fail=value; }, externalEdit: () => { library=changeWorkflowLibrary(library,{action:"create",template:{title:"Concurrent template",archived:false,steps:[{title:"Review",kind:"task",days:0}]}},()=>`wf_synthetic_${++serial}`); } };
}
