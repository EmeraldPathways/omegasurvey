const questionTypes = new Set(["choice", "scale", "textarea"]);

export function normalizeSurveyTitle(value) {
  const title = typeof value === "string" ? value.trim() : "";
  if (!title) throw new Error("Enter a name for this survey.");
  if (title.length > 160) throw new Error("Survey names must be 160 characters or fewer.");
  return title;
}

function cleanQuestionId(value, index, used) {
  const source = typeof value === "string" ? value.trim() : "";
  const base = (source || `question_${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || `question_${index + 1}`;
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}_${suffix++}`;
  used.add(id);
  return id;
}

function cleanLabel(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : fallback;
}

export function normalizeSurveyQuestions(value) {
  if (!Array.isArray(value) || value.length === 0) throw new Error("Add at least one survey question.");
  if (value.length > 50) throw new Error("A survey can contain up to 50 questions.");
  const usedIds = new Set();
  return value.map((candidate, index) => {
    const question = candidate && typeof candidate === "object" ? candidate : {};
    const text = typeof question.text === "string" ? question.text.trim() : "";
    if (!text) throw new Error(`Question ${index + 1} needs some text.`);
    if (text.length > 500) throw new Error(`Question ${index + 1} must be 500 characters or fewer.`);
    const type = question.type;
    if (!questionTypes.has(type)) throw new Error(`Question ${index + 1} has an unsupported response type.`);
    const normalized = { id: cleanQuestionId(question.id, index, usedIds), number: index + 1, text, type, required: question.required !== false };
    if (type === "choice") {
      const options = Array.isArray(question.options)
        ? question.options.filter((option) => typeof option === "string").map((option) => option.trim()).filter(Boolean).filter((option, optionIndex, all) => all.indexOf(option) === optionIndex).slice(0, 20)
        : [];
      if (options.length < 2) throw new Error(`Question ${index + 1} needs at least two answer options.`);
      if (options.some((option) => option.length > 160)) throw new Error(`Answer options for question ${index + 1} must be 160 characters or fewer.`);
      normalized.options = options;
    }
    if (type === "scale") {
      const min = typeof question.min === "number" && Number.isInteger(question.min) ? question.min : 1;
      const max = typeof question.max === "number" && Number.isInteger(question.max) ? question.max : 10;
      if (min < 0 || max > 10 || min >= max || max - min > 10) throw new Error(`Question ${index + 1} has an invalid rating range.`);
      normalized.min = min;
      normalized.max = max;
      normalized.lowLabel = cleanLabel(question.lowLabel, "Low");
      normalized.highLabel = cleanLabel(question.highLabel, "High");
    }
    return normalized;
  });
}

export function parseStoredSurveyQuestions(value) {
  try {
    return normalizeSurveyQuestions(JSON.parse(value ?? "null"));
  } catch {
    return null;
  }
}
