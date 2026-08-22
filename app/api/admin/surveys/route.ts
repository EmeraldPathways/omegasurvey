import { database, ensureDefaultSurvey, getSurvey, requireAdmin } from "../../../../lib/server";
import { normalizeSurveyQuestions, normalizeSurveyTitle, surveyQuestions } from "../../../../lib/survey";
import { normalizeEmailTemplate } from "../../../../lib/email-template";

type SurveyPayload = {
  surveyId?: number;
  title?: unknown;
  questions?: unknown;
  emailTemplate?: unknown;
};

function validSurveyId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const payload = await request.json().catch(() => ({})) as SurveyPayload;
  let title: string;
  let questions;
  try {
    title = normalizeSurveyTitle(payload.title);
    questions = normalizeSurveyQuestions(payload.questions ?? surveyQuestions);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The survey could not be created." }, { status: 400 });
  }
  try {
    const db = database();
    await ensureDefaultSurvey(db);
    const result = await db.prepare("INSERT INTO surveys (title, questions_json, status) VALUES (?, ?, 'active')").bind(title, JSON.stringify(questions)).run();
    const id = Number(result.meta.last_row_id ?? 0);
    const survey = await getSurvey(db, id);
    if (!survey) return Response.json({ error: "The survey was created but could not be loaded." }, { status: 500 });
    return Response.json({ survey }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The survey could not be created." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const payload = await request.json().catch(() => ({})) as SurveyPayload;
  const surveyId = validSurveyId(payload.surveyId);
  if (!surveyId) return Response.json({ error: "Choose a valid survey first." }, { status: 400 });
  try {
    const db = database();
    await ensureDefaultSurvey(db);
    const current = await getSurvey(db, surveyId);
    if (!current) return Response.json({ error: "That survey could not be found." }, { status: 404 });
    const title = payload.title === undefined ? current.title : normalizeSurveyTitle(payload.title);
    const questions = payload.questions === undefined ? current.questions : normalizeSurveyQuestions(payload.questions);
    const emailTemplate = payload.emailTemplate === undefined ? current.emailTemplate : normalizeEmailTemplate(payload.emailTemplate);
    await db.prepare("UPDATE surveys SET title = ?, questions_json = ?, email_template_json = ? WHERE id = ?").bind(title, JSON.stringify(questions), JSON.stringify(emailTemplate), surveyId).run();
    const survey = await getSurvey(db, surveyId);
    if (!survey) return Response.json({ error: "The survey could not be loaded after saving." }, { status: 500 });
    return Response.json({ survey });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The survey could not be saved." }, { status: 400 });
  }
}
