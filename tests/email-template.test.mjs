import assert from "node:assert/strict";
import test from "node:test";
import { defaultEmailTemplate, normalizeEmailTemplate, parseStoredEmailTemplate } from "../lib/email-template-validation.mjs";

test("normalizes editable invitation wording", () => {
  const result = normalizeEmailTemplate({
    subject: "  A short survey  ",
    eyebrow: " Client experience ",
    heading: " Your feedback matters ",
    message: " Please share your experience. ",
    buttonLabel: " Begin survey ",
    responseNote: " Responses are linked to this invitation. ",
  });
  assert.equal(result.subject, "A short survey");
  assert.equal(result.buttonLabel, "Begin survey");
});

test("falls back to safe defaults for invalid stored content", () => {
  assert.deepEqual(parseStoredEmailTemplate("not-json"), defaultEmailTemplate);
  assert.throws(() => normalizeEmailTemplate({}), /cannot be empty/);
});
