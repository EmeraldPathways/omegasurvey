import {
  defaultEmailTemplate as defaultTemplateRuntime,
  normalizeEmailTemplate as normalizeTemplateRuntime,
  parseStoredEmailTemplate as parseStoredTemplateRuntime,
} from "./email-template-validation.mjs";

export type EmailTemplate = {
  subject: string;
  eyebrow: string;
  heading: string;
  message: string;
  buttonLabel: string;
  responseNote: string;
};

export const defaultEmailTemplate = defaultTemplateRuntime as EmailTemplate;

export function normalizeEmailTemplate(value: unknown): EmailTemplate {
  return normalizeTemplateRuntime(value) as EmailTemplate;
}

export function parseStoredEmailTemplate(value: string | null | undefined): EmailTemplate {
  return parseStoredTemplateRuntime(value) as EmailTemplate;
}
