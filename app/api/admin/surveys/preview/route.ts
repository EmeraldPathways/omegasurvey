import { database, ensureDefaultSurvey, getSurvey, requireAdmin } from "../../../../../lib/server";

export async function GET(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const surveyId = Number(new URL(request.url).searchParams.get("surveyId"));
  if (!Number.isInteger(surveyId) || surveyId < 1) return Response.json({ error: "Choose a valid survey first." }, { status: 400 });
  try {
    const db = database();
    await ensureDefaultSurvey(db);
    const survey = await getSurvey(db, surveyId);
    if (!survey) return Response.json({ error: "That survey could not be found." }, { status: 404 });
    return Response.json({ status: "preview", firstName: "", title: survey.title, questions: survey.questions });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The survey preview could not be loaded." }, { status: 500 });
  }
}
