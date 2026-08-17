import { clearSessionCookie } from "../../../../lib/server";

export async function POST() {
  return Response.json({ ok: true }, { headers: { "set-cookie": clearSessionCookie() } });
}
