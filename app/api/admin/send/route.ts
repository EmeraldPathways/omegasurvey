import { bindings, database, ensureDefaultSurvey, escapeHtml, getSurvey, randomToken, requireAdmin, sha256 } from "../../../../lib/server";

type RecipientRow = { id: string; first_name: string; last_name: string; email: string };

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const runtime = bindings();
  if (!runtime.RESEND_API_KEY || !runtime.SENDER_EMAIL) return Response.json({ error: "Email delivery is not configured. Add the Omega sender address and Resend API key first." }, { status: 503 });
  const payload = await request.json().catch(() => ({})) as { mode?: "initial" | "reminder"; surveyId?: unknown };
  const mode = payload.mode === "reminder" ? "reminder" : "initial";
  const surveyId = payload.surveyId === undefined ? 1 : Number(payload.surveyId);
  if (!Number.isInteger(surveyId) || surveyId < 1) return Response.json({ error: "Choose a valid survey first." }, { status: 400 });
  const condition = mode === "reminder" ? "status IN ('sent', 'opened')" : "status = 'imported'";
  const db = database();
  await ensureDefaultSurvey(db);
  const survey = await getSurvey(db, surveyId);
  if (!survey) return Response.json({ error: "That survey could not be found." }, { status: 404 });
  const rows = await db.prepare(`SELECT id, first_name, last_name, email FROM recipients WHERE survey_id = ? AND ${condition} ORDER BY created_at LIMIT 500`).bind(survey.id).all<RecipientRow>();
  const origin = runtime.PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
  const logoUrl = `${origin}/omega-financial-logo-email.png`;
  let sent = 0;
  let failed = 0;
  for (const recipient of rows.results) {
    const token = randomToken();
    const tokenHash = await sha256(token);
    const surveyUrl = `${origin}/survey/${token}`;
    const name = recipient.first_name ? escapeHtml(recipient.first_name) : "there";
    const template = survey.emailTemplate;
    const subject = mode === "reminder" ? `Reminder: ${template.subject}` : template.subject;
    const message = mode === "reminder" ? `This is a friendly reminder.\n\n${template.message}` : template.message;
    const safeMessage = escapeHtml(message).replaceAll("\n", "<br>");
    await db.prepare("UPDATE recipients SET token_hash = ?, last_error = NULL WHERE id = ?").bind(tokenHash, recipient.id).run();
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${runtime.RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: runtime.SENDER_EMAIL.includes("<") ? runtime.SENDER_EMAIL : `Omega Financial <${runtime.SENDER_EMAIL}>`,
          to: [recipient.email],
          reply_to: runtime.REPLY_TO_EMAIL || undefined,
          subject,
          text: `Hello ${recipient.first_name || "there"},\n\n${message}\n\n${template.buttonLabel}: ${surveyUrl}\n\n${template.responseNote}\n\nOFM Financial Ltd T/A Omega Financial Management, regulated by the Central Bank of Ireland.`,
          html: `<div style="background:#f5f2eb;padding:36px 16px;font-family:Arial,sans-serif;color:#172b3a"><div style="max-width:600px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e4ded2"><div style="background:#102f3d;padding:22px 32px"><img src="${logoUrl}" width="220" alt="Omega Financial" style="display:block;width:220px;max-width:100%;height:auto;border:0"></div><div style="padding:38px 32px"><p style="color:#b8753b;font-size:12px;letter-spacing:.14em;font-weight:bold">${escapeHtml(template.eyebrow)}</p><h1 style="font-size:28px;margin:10px 0 18px">${escapeHtml(template.heading)}</h1><p>Hello ${name},</p><p style="line-height:1.7;color:#52636d">${safeMessage}</p><p style="margin:30px 0"><a href="${surveyUrl}" style="display:inline-block;background:#b8753b;color:#fff;text-decoration:none;padding:14px 22px;border-radius:8px;font-weight:bold">${escapeHtml(template.buttonLabel)}</a></p><p style="font-size:12px;line-height:1.6;color:#71808a">${escapeHtml(template.responseNote)}</p></div><div style="border-top:1px solid #eee8de;padding:22px 32px;font-size:11px;line-height:1.5;color:#71808a">OFM Financial Ltd T/A Omega Financial Management, regulated by the Central Bank of Ireland.</div></div></div>`,
        }),
      });
      const result = await response.json().catch(() => ({})) as { id?: string; message?: string };
      if (!response.ok) throw new Error(result.message ?? "Email delivery failed");
      await db.prepare("UPDATE recipients SET status = 'sent', email_message_id = ?, sent_at = CURRENT_TIMESTAMP, reminder_count = reminder_count + ?, last_error = NULL WHERE id = ?").bind(result.id ?? null, mode === "reminder" ? 1 : 0, recipient.id).run();
      sent += 1;
    } catch (error) {
      await db.prepare("UPDATE recipients SET last_error = ? WHERE id = ?").bind(error instanceof Error ? error.message.slice(0, 500) : "Email delivery failed", recipient.id).run();
      failed += 1;
    }
  }
  return Response.json({ sent, failed });
}
