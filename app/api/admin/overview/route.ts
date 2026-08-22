import { bindings, database, ensureDefaultSurvey, listSurveys, requireAdmin } from "../../../../lib/server";

export async function GET(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const db = database();
    await ensureDefaultSurvey(db);
    const surveys = await listSurveys(db);
    const requestedId = Number(new URL(request.url).searchParams.get("surveyId"));
    const survey = surveys.find((candidate) => candidate.id === requestedId) ?? surveys[0];
    if (!survey) return Response.json({ error: "No surveys are available." }, { status: 404 });
    const statsRow = await db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'imported' THEN 1 ELSE 0 END) AS imported, SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent, SUM(CASE WHEN status = 'opened' THEN 1 ELSE 0 END) AS opened, SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) AS submitted FROM recipients WHERE survey_id = ?").bind(survey.id).first<Record<string, number>>();
    const recipients = await db.prepare("SELECT r.id, r.first_name, r.last_name, r.email, r.status, r.sent_at, r.opened_at, r.submitted_at, r.reminder_count, p.answers_json FROM recipients r LEFT JOIN responses p ON p.recipient_id = r.id WHERE r.survey_id = ? ORDER BY r.created_at DESC LIMIT 1000").bind(survey.id).all();
    return Response.json({ surveys: surveys.map(({ id, title, status }) => ({ id, title, status })), activeSurveyId: survey.id, survey: { id: survey.id, title: survey.title, questions: survey.questions, emailTemplate: survey.emailTemplate }, stats: { total: Number(statsRow?.total ?? 0), imported: Number(statsRow?.imported ?? 0), sent: Number(statsRow?.sent ?? 0), opened: Number(statsRow?.opened ?? 0), submitted: Number(statsRow?.submitted ?? 0) }, recipients: recipients.results, configuration: { emailReady: Boolean(bindings().RESEND_API_KEY && bindings().SENDER_EMAIL), senderEmail: bindings().SENDER_EMAIL ?? null } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Dashboard unavailable." }, { status: 500 });
  }
}
