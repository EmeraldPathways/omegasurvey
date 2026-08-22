import { normalizeSurveyTitle, parseStoredSurveyQuestions, surveyQuestions, surveyTitle, SurveyQuestion } from "./survey";
import { EmailTemplate, parseStoredEmailTemplate } from "./email-template";

type RuntimeBindings = {
  DB?: D1Database;
  ADMIN_PASSWORD?: string;
  SESSION_SECRET?: string;
  RESEND_API_KEY?: string;
  SENDER_EMAIL?: string;
  REPLY_TO_EMAIL?: string;
  PUBLIC_APP_URL?: string;
};

export function bindings(): RuntimeBindings {
  return (globalThis as typeof globalThis & { __OMEGA_RUNTIME_ENV__?: RuntimeBindings }).__OMEGA_RUNTIME_ENV__ ?? {};
}

export function database(): D1Database {
  const db = bindings().DB;
  if (!db) throw new Error("The survey database is not available.");
  return db;
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

export async function passwordMatches(candidate: string) {
  const expected = bindings().ADMIN_PASSWORD;
  if (!expected) return false;
  return safeEqual(await sha256(candidate), await sha256(expected));
}

export async function makeSessionCookie(request: Request) {
  const secret = bindings().SESSION_SECRET;
  if (!secret) throw new Error("Session security is not configured.");
  const expires = Date.now() + 8 * 60 * 60 * 1000;
  const value = `${expires}.${await sign(String(expires), secret)}`;
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `omega_admin=${value}; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=28800`;
}

export function clearSessionCookie() {
  return "omega_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0";
}

export async function isAdmin(request: Request) {
  const secret = bindings().SESSION_SECRET;
  if (!secret) return false;
  const cookie = request.headers.get("cookie") ?? "";
  const value = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("omega_admin="))?.slice("omega_admin=".length);
  if (!value) return false;
  const [expiresText, signature] = value.split(".");
  if (!expiresText || !signature || Number(expiresText) < Date.now()) return false;
  return safeEqual(signature, await sign(expiresText, secret));
}

export async function requireAdmin(request: Request) {
  if (!(await isAdmin(request))) return Response.json({ error: "Please sign in to continue." }, { status: 401 });
  return null;
}

let schemaReady = false;

export async function ensureDefaultSurvey(db: D1Database) {
  if (!schemaReady) {
    await db.batch([
      db.prepare("CREATE TABLE IF NOT EXISTS surveys (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, title text NOT NULL, questions_json text NOT NULL, email_template_json text, status text DEFAULT 'active' NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL)"),
      db.prepare("CREATE TABLE IF NOT EXISTS recipients (id text PRIMARY KEY NOT NULL, survey_id integer NOT NULL, first_name text NOT NULL, last_name text NOT NULL, email text NOT NULL, token_hash text, status text DEFAULT 'imported' NOT NULL, email_message_id text, last_error text, sent_at text, opened_at text, submitted_at text, reminder_count integer DEFAULT 0 NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY (survey_id) REFERENCES surveys(id))"),
      db.prepare("CREATE TABLE IF NOT EXISTS responses (id text PRIMARY KEY NOT NULL, recipient_id text NOT NULL, answers_json text NOT NULL, submitted_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY (recipient_id) REFERENCES recipients(id))"),
      db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS recipients_survey_email_unique ON recipients (survey_id, email)"),
      db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS recipients_token_hash_unique ON recipients (token_hash)"),
      db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS responses_recipient_unique ON responses (recipient_id)"),
    ]);
    const surveyColumns = await db.prepare("PRAGMA table_info(surveys)").all<{ name: string }>();
    if (!surveyColumns.results.some((column) => column.name === "email_template_json")) {
      await db.prepare("ALTER TABLE surveys ADD COLUMN email_template_json text").run();
    }
    schemaReady = true;
  }
  await db.prepare("INSERT OR IGNORE INTO surveys (id, title, questions_json, status) VALUES (1, ?, ?, 'active')").bind(surveyTitle, JSON.stringify(surveyQuestions)).run();
}

export type SurveyRow = { id: number; title: string; questions_json: string; email_template_json: string | null; status: string; created_at: string };

export type SurveyDefinition = { id: number; title: string; questions: SurveyQuestion[]; emailTemplate: EmailTemplate; status: string; created_at: string };

export async function getSurvey(db: D1Database, id: number): Promise<SurveyDefinition | null> {
  const row = await db.prepare("SELECT id, title, questions_json, email_template_json, status, created_at FROM surveys WHERE id = ? AND status != 'archived'").bind(id).first<SurveyRow>();
  if (!row) return null;
  return { id: Number(row.id), title: normalizeSurveyTitle(row.title), questions: parseStoredSurveyQuestions(row.questions_json), emailTemplate: parseStoredEmailTemplate(row.email_template_json), status: row.status, created_at: row.created_at };
}

export async function listSurveys(db: D1Database): Promise<SurveyDefinition[]> {
  const rows = await db.prepare("SELECT id, title, questions_json, email_template_json, status, created_at FROM surveys WHERE status != 'archived' ORDER BY created_at ASC, id ASC").all<SurveyRow>();
  return rows.results.map((row: SurveyRow) => ({ id: Number(row.id), title: normalizeSurveyTitle(row.title), questions: parseStoredSurveyQuestions(row.questions_json), emailTemplate: parseStoredEmailTemplate(row.email_template_json), status: row.status, created_at: row.created_at }));
}

export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character] ?? character);
}
