export function previewSurveyPath(surveyId) {
  if (!Number.isInteger(surveyId) || surveyId < 1) throw new Error("A valid survey id is required.");
  return `/survey/preview?surveyId=${encodeURIComponent(surveyId)}`;
}
