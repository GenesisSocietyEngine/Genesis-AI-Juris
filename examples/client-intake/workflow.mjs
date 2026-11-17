/** Local fixture identities. The browser role picker is for review only. */
export const staff = "staff-qa";
export const client = "client-qa";
export const caseId = "CV-010-QA";

export function createWorkflow() {
  let current = 1;
  let active = true;
  const versions = new Map([[1, "Synthetic engagement summary. Review the requested follow-up."]]);
  const events = [];
  const find = (action, version) => events.find(e => e.action === action && e.version === version);
  function record(actor, action, version, extra = {}) {
    const event = Object.freeze({ sequence: events.length + 1, caseId, document: "engagement-summary",
      version, recipient: client, actor, action, at: new Date().toISOString(), ...extra });
    events.push(event);
    return event;
  }

  return {
    view(actor) {
      if (actor !== staff && (actor !== client || !active)) return null;
      return { version: current, text: versions.get(current), active, recipient: client,
        intake: find("intake", current), authorization: find("authorize", current),
        signature: find("sign", current), history: [...events] };
    },
    submit(actor, version, answer) {
      if (actor !== client || !active || current !== version || !answer?.trim() || answer.length > 500)
        throw Error("intake");
      const prior = find("intake", version);
      if (prior && prior.answer !== answer.trim()) throw Error("immutable");
      return prior ?? record(actor, "intake", version, { answer: answer.trim() });
    },
    authorize(actor, version) {
      if (actor !== staff || !active || current !== version || !find("intake", version))
        throw Error("authorization");
      return find("authorize", version) ?? record(actor, "authorize", version);
    },
    sign(actor, version, confirmed) {
      const permission = find("authorize", version);
      if (actor !== client || !active || current !== version || !permission || confirmed !== true)
        throw Error("signature");
      return find("sign", version) ?? record(actor, "sign", version, {
        authorizationSequence: permission.sequence, intakeSequence: find("intake", version).sequence,
        documentText: versions.get(version),
      });
    },
    revise(actor) {
      if (actor !== staff || !active) throw Error("revision");
      current++;
      versions.set(current, "Synthetic engagement summary. Review the updated follow-up (revision " + current + ").");
      record(actor, "revise", current);
    },
    revoke(actor) {
      if (actor !== staff) throw Error("revocation");
      if (active) record(actor, "revoke", current);
      active = false;
    },
  };
}
