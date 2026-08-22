import assert from "node:assert/strict";
import test from "node:test";

import { previewSurveyPath } from "../lib/preview-url.mjs";

test("builds a preview link for a selected survey", () => {
  assert.equal(previewSurveyPath(12), "/survey/preview?surveyId=12");
});

test("rejects an invalid survey id", () => {
  assert.throws(() => previewSurveyPath("12"), /valid survey id/);
});
