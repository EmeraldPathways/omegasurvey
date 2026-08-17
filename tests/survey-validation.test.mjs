import assert from "node:assert/strict";
import test from "node:test";

import { normalizeSurveyQuestions, normalizeSurveyTitle } from "../lib/survey-validation.mjs";

test("normalizes editable questions for storage", () => {
  const questions = normalizeSurveyQuestions([
    { id: "customer mood", number: 99, text: "  How did we do?  ", type: "choice", options: ["Yes", "Yes", " No "], required: false },
    { id: "rating", text: "Rate us", type: "scale", lowLabel: "Poor", highLabel: "Excellent", required: true },
  ]);

  assert.deepEqual(questions, [
    { id: "customer_mood", number: 1, text: "How did we do?", type: "choice", options: ["Yes", "No"], required: false },
    { id: "rating", number: 2, text: "Rate us", type: "scale", min: 1, max: 10, lowLabel: "Poor", highLabel: "Excellent", required: true },
  ]);
});

test("rejects a choice question without enough options", () => {
  assert.throws(() => normalizeSurveyQuestions([{ text: "Choose", type: "choice", options: ["Only one"] }]), /at least two answer options/);
});

test("trims and limits survey titles", () => {
  assert.equal(normalizeSurveyTitle("  Client follow-up  "), "Client follow-up");
  assert.throws(() => normalizeSurveyTitle(""), /name for this survey/);
});
