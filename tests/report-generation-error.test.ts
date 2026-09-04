import assert from "node:assert/strict";
import test from "node:test";
import { reportGenerationErrorMessage } from "../app/report-generation-error";
import { ReportGraphLayoutError } from "../app/report-graph-layout";

test("report generation exposes bounded printable-frame diagnostics without case text", () => {
  const error = new ReportGraphLayoutError(
    "NODE_EXCEEDS_PRINTABLE_FRAME",
    "SECRET node title must never be displayed",
    { nodeId: "decision-17", requiredHeight: 121_500, availableHeight: 96_000 },
  );
  const message = reportGenerationErrorMessage(error, "en");
  assert.match(message, /Node: decision-17/);
  assert.match(message, /121\.5 mm/);
  assert.match(message, /96\.0 mm/);
  assert.doesNotMatch(message, /SECRET/);
});

test("report generation safely localizes known layout codes and hides malformed context", () => {
  const message = reportGenerationErrorMessage({
    name: "ReportGraphLayoutError",
    code: "INPUT_INVALID",
    message: "SECRET relationship data",
    context: { nodeId: "<script>SECRET</script>" },
  }, "ru");
  assert.match(message, /Граф отчёта/);
  assert.doesNotMatch(message, /SECRET|script/);
});

test("report generation gives an actionable governed-font diagnostic without raw text", () => {
  const message = reportGenerationErrorMessage({
    name: "ReportGraphLayoutError",
    code: "INPUT_INVALID",
    message: "SECRET 👩‍⚖️",
    context: { codePoint: "U+1F469", field: "documentDefinition", reason: "FONT_UNSUPPORTED" },
  }, "en");
  assert.match(message, /governed PDF font/);
  assert.match(message, /U\+1F469/);
  assert.doesNotMatch(message, /SECRET|👩/);
});

test("report generation retains a generic fallback for unrecognized failures", () => {
  const message = reportGenerationErrorMessage(new Error("SECRET transport failure"), "en");
  assert.equal(message, "The report could not be created. Review the case data and try again.");
  assert.doesNotMatch(message, /SECRET/);
});
