import { database, ensureDefaultSurvey, sha256 } from "../../../../lib/server";
import { surveyQuestions, surveyTitle } from "../../../../lib/survey";

type RecipientRow = { id: string; first_name: string; status: string; submitted_at: string | null };

async function findRecipient(token: string) {
  const db = database();
  await ensureDefaultSurvey(db);
  const tokenHash = await sha256(token);
  const recipient = await db.prepare("SELECT id, first_name, status, submitted_at FROM recipients WHERE survey_id = 1 AND token_hash = ?").bind(tokenHash).first<RecipientRow>();
  return { db, recipient };
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const { db, recipient } = await findRecipient(token);
  if (!recipient) return Response.json({ error: "Survey link not found." }, { status: 404 });
  if (recipient.status !== "submitted") await db.prepare("UPDATE recipients SET status = 'opened', opened_at = COALESCE(opened_at, CURRENT_TIMESTAMP) WHERE id = ?").bind(recipient.id).run();
  return Response.json({ status: recipient.status === "submitted" ? "submitted" : "active", firstName: recipient.first_name, title: surveyTitle, questions: surveyQuestions });
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const { db, recipient } = await findRecipient(token);
  if (!recipient) return Response.json({ error: "Survey link not found." }, { status: 404 });
  if (recipient.status === "submitted") return Response.json({ error: "This survey has already been completed." }, { status: 409 });
  const payload = await request.json().catch(() => ({})) as { answers?: Record<string, string | number> };
  const answers = payload.answers ?? {};
  for (const question of surveyQuestions) {
    const answer = answers[question.id];
    if (question.required && (answer === undefined || answer === "")) return Response.json({ error: `Please answer question ${question.number}.` }, { status: 400 });
    if (question.type === "choice" && answer !== undefined && !question.options?.includes(String(answer))) return Response.json({ error: `Question ${question.number} contains an invalid answer.` }, { status: 400 });
    if (question.type === "scale" && answer !== undefined && (Number(answer) < (question.min ?? 1) || Number(answer) > (question.max ?? 10))) return Response.json({ error: `Question ${question.number} contains an invalid rating.` }, { status: 400 });
  }
  if (String(answers.improvements ?? "").length > 3000) return Response.json({ error: "The comment is too long." }, { status: 400 });
  try {
    await db.batch([
      db.prepare("INSERT INTO responses (id, recipient_id, answers_json) VALUES (?, ?, ?)").bind(crypto.randomUUID(), recipient.id, JSON.stringify(answers)),
      db.prepare("UPDATE recipients SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP WHERE id = ?").bind(recipient.id),
    ]);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "This survey has already been completed." }, { status: 409 });
  }
}
