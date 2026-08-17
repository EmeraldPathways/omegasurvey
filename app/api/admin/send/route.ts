import { bindings, database, escapeHtml, randomToken, requireAdmin, sha256 } from "../../../../lib/server";

type RecipientRow = { id: string; first_name: string; last_name: string; email: string };

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const runtime = bindings();
  if (!runtime.RESEND_API_KEY || !runtime.SENDER_EMAIL) return Response.json({ error: "Email delivery is not configured. Add the Omega sender address and Resend API key first." }, { status: 503 });
  const payload = await request.json().catch(() => ({})) as { mode?: "initial" | "reminder" };
  const mode = payload.mode === "reminder" ? "reminder" : "initial";
  const condition = mode === "reminder" ? "status IN ('sent', 'opened')" : "status = 'imported'";
  const db = database();
  const rows = await db.prepare(`SELECT id, first_name, last_name, email FROM recipients WHERE survey_id = 1 AND ${condition} ORDER BY created_at LIMIT 500`).all<RecipientRow>();
  const origin = runtime.PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
  let sent = 0;
  let failed = 0;
  for (const recipient of rows.results) {
    const token = randomToken();
    const tokenHash = await sha256(token);
    const surveyUrl = `${origin}/survey/${token}`;
    const name = recipient.first_name ? escapeHtml(recipient.first_name) : "there";
    const subject = mode === "reminder" ? "Reminder: we would value your feedback" : "We would value your feedback";
    const introduction = mode === "reminder" ? "This is a friendly reminder about our short client experience survey." : "We would appreciate your feedback on your experience with Omega Financial.";
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
          text: `Hello ${recipient.first_name || "there"},\n\n${introduction}\n\nThe survey takes approximately two minutes. Your responses will be linked to the email address that received this invitation.\n\nComplete the survey: ${surveyUrl}\n\nOFM Financial Ltd T/A Omega Financial Management, regulated by the Central Bank of Ireland.`,
          html: `<div style="background:#f5f2eb;padding:36px 16px;font-family:Arial,sans-serif;color:#172b3a"><div style="max-width:600px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e4ded2"><div style="background:#102f3d;color:#fff;padding:25px 32px;font-size:18px;letter-spacing:.08em"><b>Ω OMEGA</b> <span style="font-size:11px;opacity:.75">FINANCIAL</span></div><div style="padding:38px 32px"><p style="color:#b8753b;font-size:12px;letter-spacing:.14em;font-weight:bold">CLIENT EXPERIENCE</p><h1 style="font-size:28px;margin:10px 0 18px">We value your feedback</h1><p>Hello ${name},</p><p style="line-height:1.7;color:#52636d">${introduction} The survey takes approximately two minutes to complete.</p><p style="margin:30px 0"><a href="${surveyUrl}" style="display:inline-block;background:#b8753b;color:#fff;text-decoration:none;padding:14px 22px;border-radius:8px;font-weight:bold">Complete the survey</a></p><p style="font-size:12px;line-height:1.6;color:#71808a">Your responses will be linked to the email address that received this invitation.</p></div><div style="border-top:1px solid #eee8de;padding:22px 32px;font-size:11px;line-height:1.5;color:#71808a">OFM Financial Ltd T/A Omega Financial Management, regulated by the Central Bank of Ireland.</div></div></div>`,
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
