import { database, ensureDefaultSurvey, requireAdmin } from "../../../../lib/server";

type IncomingRecipient = { firstName?: string; lastName?: string; email?: string };

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const payload = await request.json().catch(() => ({})) as { recipients?: IncomingRecipient[] };
  const unique = new Map<string, IncomingRecipient>();
  for (const recipient of payload.recipients ?? []) {
    const email = recipient.email?.trim().toLowerCase() ?? "";
    if (recipient.firstName?.trim() && recipient.lastName?.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) unique.set(email, { ...recipient, email });
  }
  const recipients = [...unique.values()].slice(0, 500);
  if (!recipients.length) return Response.json({ error: "No valid recipients were provided." }, { status: 400 });
  const db = database();
  await ensureDefaultSurvey(db);
  let added = 0;
  for (const recipient of recipients) {
    const result = await db.prepare("INSERT OR IGNORE INTO recipients (id, survey_id, first_name, last_name, email, status) VALUES (?, 1, ?, ?, ?, 'imported')").bind(crypto.randomUUID(), recipient.firstName?.trim() ?? "", recipient.lastName?.trim() ?? "", recipient.email).run();
    added += Number(result.meta.changes ?? 0);
  }
  return Response.json({ added, skipped: recipients.length - added });
}
