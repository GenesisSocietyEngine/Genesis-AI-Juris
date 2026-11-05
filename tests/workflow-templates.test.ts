import assert from "node:assert/strict";
import { test } from "node:test";
import { changeWorkflowLibrary, EMPTY_LIBRARY, previewTemplate, readWorkflowLibrary } from "../app/work/workflow-templates";
import { changePracticePlan, EMPTY_PLAN, parsePracticePlan } from "../app/matters/practice-plan";

test("template versions preserve applied work, negative offsets and explicit completion", () => {
  const fields = { title: "Hearing preparation", archived: false, steps: [{ title: "Review", kind: "task", days: -2 }, { title: "Hearing", kind: "event", days: 0 }] };
  const library = changeWorkflowLibrary(EMPTY_LIBRARY, { action: "create", template: fields }, () => "wf_review");
  const template = library.templates[0];
  assert.equal(previewTemplate(template, "2028-03-01")[0].dueDate, "2028-02-28");
  let id=0;
  const work = changePracticePlan(EMPTY_PLAN, { action: "apply_workflow", templateId: template.id, templateVersion: 1, anchor: "2028-03-01", assignee: null }, () => `work_${++id}`, template);
  const edited = changeWorkflowLibrary(library, { action: "update", id: template.id, template: { ...fields, title: "Renamed", archived: true } }, () => "unused");
  assert.equal(edited.templates[0].version, 2); assert.equal(library.templates[0].title, "Hearing preparation");
  assert.equal(work.items[0].workflowTitle, "Hearing preparation"); assert.equal(work.items[0].workflow, "wf_review@1:2028-03-01");
  assert.ok(work.items.every(i=>i.status==="open")); assert.deepEqual(parsePracticePlan(work),work);
  assert.throws(()=>changePracticePlan(work,{action:"apply_workflow",templateId:template.id,templateVersion:1,anchor:"2028-03-01"},()=>"unused",edited.templates[0]),/changed/);
  assert.throws(()=>previewTemplate(template,"0000-01-01"),/range/);
  assert.throws(()=>previewTemplate({...template,steps:[{title:"Later",kind:"task",days:2}]},"9999-12-31"),/range/);
  assert.throws(()=>changeWorkflowLibrary(library,{action:"update",id:template.id,template:{...fields,steps:[{title:"Bad",kind:"task",days:0.5}]}},()=>"unused"),/whole-day/);
  assert.throws(()=>readWorkflowLibrary({...library,templates:[template,template]}),/identity/);
});
