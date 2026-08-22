export const defaultEmailTemplate = {
  subject: "We value your feedback",
  eyebrow: "CLIENT EXPERIENCE",
  heading: "We value your feedback",
  message: "We would appreciate your feedback through our short client experience survey. It takes approximately two minutes to complete.",
  buttonLabel: "Complete the survey",
  responseNote: "Your responses will be linked to the email address that received this invitation.",
};

const limits = {
  subject: 160,
  eyebrow: 60,
  heading: 160,
  message: 1200,
  buttonLabel: 60,
  responseNote: 300,
};

export function normalizeEmailTemplate(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Enter the invitation email wording before saving.");
  }
  const normalized = {};
  for (const [field, maximum] of Object.entries(limits)) {
    const text = typeof value[field] === "string" ? value[field].trim() : "";
    if (!text) throw new Error(`The ${field.replace(/([A-Z])/g, " $1").toLowerCase()} cannot be empty.`);
    if (text.length > maximum) throw new Error(`The ${field.replace(/([A-Z])/g, " $1").toLowerCase()} is too long.`);
    normalized[field] = text;
  }
  return normalized;
}

export function parseStoredEmailTemplate(value) {
  if (!value) return defaultEmailTemplate;
  try {
    return normalizeEmailTemplate(JSON.parse(value));
  } catch {
    return defaultEmailTemplate;
  }
}
