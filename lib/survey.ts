import { normalizeSurveyQuestions as normalizeQuestionsRuntime, normalizeSurveyTitle as normalizeTitleRuntime, parseStoredSurveyQuestions as parseStoredQuestionsRuntime } from "./survey-validation.mjs";

export type SurveyQuestionType = "choice" | "scale" | "textarea";

export type SurveyQuestion = {
  id: string;
  number: number;
  text: string;
  type: SurveyQuestionType;
  options?: string[];
  min?: number;
  max?: number;
  lowLabel?: string;
  highLabel?: string;
  required: boolean;
};

export const surveyTitle = "Omega Financial Client Experience Survey";

export const surveyQuestions: SurveyQuestion[] = [
  { id: "needs_met", number: 1, text: "Did your Omega Financial adviser meet your needs?", type: "choice", options: ["Yes", "Partly", "No"], required: true },
  { id: "product_explanation", number: 2, text: "How clearly were the details of the financial product explained?", type: "choice", options: ["Very clearly", "Clearly", "Somewhat clearly", "Not clearly"], required: true },
  { id: "prompt_answers", number: 3, text: "Were your questions answered promptly?", type: "choice", options: ["Yes", "Mostly", "No", "Not applicable"], required: true },
  { id: "clear_answers", number: 4, text: "Were your questions answered clearly?", type: "choice", options: ["Yes", "Mostly", "No", "Not applicable"], required: true },
  { id: "future_business", number: 5, text: "Would you feel comfortable doing business with Omega Financial again?", type: "choice", options: ["Yes", "Maybe", "No"], required: true },
  { id: "overall_satisfaction", number: 6, text: "Overall, how satisfied are you with Omega Financial?", type: "scale", min: 1, max: 10, lowLabel: "Not satisfied", highLabel: "Extremely satisfied", required: true },
  { id: "recommendation", number: 7, text: "How likely are you to recommend Omega Financial to others?", type: "scale", min: 1, max: 10, lowLabel: "Not likely", highLabel: "Extremely likely", required: true },
  { id: "improvements", number: 8, text: "How could Omega Financial improve its service to clients?", type: "textarea", required: false },
];

export function normalizeSurveyTitle(value: unknown) {
  return normalizeTitleRuntime(value);
}

export function normalizeSurveyQuestions(value: unknown): SurveyQuestion[] {
  return normalizeQuestionsRuntime(value) as SurveyQuestion[];
}

export function parseStoredSurveyQuestions(value: string | null | undefined) {
  return (parseStoredQuestionsRuntime(value) as SurveyQuestion[] | null) ?? surveyQuestions;
}
