import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const surveyFormSource = await readFile(new URL("../app/components/SurveyForm.tsx", import.meta.url), "utf8");

test("preview keeps the recipient-facing survey copy and controls", () => {
  assert.doesNotMatch(surveyFormSource, /preview \? "Admin preview/);
  assert.doesNotMatch(surveyFormSource, /preview \? "This is a read-only preview/);
  assert.doesNotMatch(surveyFormSource, /preview \? "Preview mode/);
  assert.doesNotMatch(surveyFormSource, /preview \? "Preview only/);
  assert.doesNotMatch(surveyFormSource, /preview \? "Admin preview/);
  assert.match(surveyFormSource, /<span>Secure client survey<\/span>/);
});
