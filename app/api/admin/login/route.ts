import { bindings, makeSessionCookie, passwordMatches } from "../../../../lib/server";

export async function POST(request: Request) {
  if (!bindings().ADMIN_PASSWORD || !bindings().SESSION_SECRET) return Response.json({ error: "Administrator access has not been configured yet." }, { status: 503 });
  const payload = await request.json().catch(() => ({})) as { password?: string };
  if (!payload.password || !(await passwordMatches(payload.password))) return Response.json({ error: "The password is incorrect." }, { status: 401 });
  return Response.json({ ok: true }, { headers: { "set-cookie": await makeSessionCookie(request) } });
}
