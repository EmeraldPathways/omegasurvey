import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const surveyFormSource = await readFile(new URL("../app/components/SurveyForm.tsx", import.meta.url), "utf8");
const stylesSource = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("question headings are rendered inside their cards", () => {
  assert.match(surveyFormSource, /<legend className="visually-hidden">\{question\.text\}/);
  assert.match(surveyFormSource, /<div className="question-heading" aria-hidden="true">/);
  assert.match(stylesSource, /\.question-heading\s*\{/);
  assert.doesNotMatch(stylesSource, /\.survey-question legend\s*\{/);
});
