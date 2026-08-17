"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import readXlsxFile from "read-excel-file/browser";
import { csvCells, parsePastedRows, rowsForImport, rowsFromGrid } from "../../lib/recipient-import.mjs";
import { previewSurveyPath } from "../../lib/preview-url.mjs";
import Logo from "./Logo";

type Recipient = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: "imported" | "sent" | "opened" | "submitted";
  sent_at: string | null;
  opened_at: string | null;
  submitted_at: string | null;
  reminder_count: number;
  answers_json: string | null;
};

type QuestionType = "choice" | "scale" | "textarea";

type Question = {
  id: string;
  number: number;
  text: string;
  type: QuestionType;
  options?: string[];
  min?: number;
  max?: number;
  lowLabel?: string;
  highLabel?: string;
  required: boolean;
};

type SurveySummary = { id: number; title: string; status: string };

type Overview = {
  surveys: SurveySummary[];
  activeSurveyId: number;
  survey: { id: number; title: string; questions: Question[] };
  stats: { total: number; imported: number; sent: number; opened: number; submitted: number };
  recipients: Recipient[];
  configuration: { emailReady: boolean; senderEmail: string | null };
};

type ImportRow = { firstName: string; lastName: string; email: string };
const tabs = ["Overview", "Recipients", "Responses", "Settings", "Preview"] as const;

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IE", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function statusLabel(status: Recipient["status"]) {
  return { imported: "Ready", sent: "Sent", opened: "Opened", submitted: "Completed" }[status];
}

function questionTypeLabel(type: QuestionType) {
  return type === "scale" ? "1–10 rating" : type === "textarea" ? "Long text" : "Single choice";
}

export default function AdminApp() {
  const [auth, setAuth] = useState<"loading" | "login" | "ready">("loading");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Overview");
  const [importOpen, setImportOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pendingRows, setPendingRows] = useState<ImportRow[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [surveyCreateOpen, setSurveyCreateOpen] = useState(false);
  const [surveyEditorOpen, setSurveyEditorOpen] = useState(false);
  const [newSurveyTitle, setNewSurveyTitle] = useState("");
  const [draftSurveyId, setDraftSurveyId] = useState<number | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftQuestions, setDraftQuestions] = useState<Question[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const parsedPasteRows = useMemo(() => parsePastedRows(pasteText), [pasteText]);
  const rowsToImport = pendingRows.length > 0 ? pendingRows : parsedPasteRows;

  const loadOverview = useCallback(async (surveyId?: number) => {
    const query = surveyId ? `?surveyId=${encodeURIComponent(surveyId)}` : "";
    const response = await fetch(`/api/admin/overview${query}`, { cache: "no-store" });
    if (response.status === 401) { setAuth("login"); return; }
    if (!response.ok) throw new Error("The dashboard could not be loaded.");
    setOverview(await response.json());
    setAuth("ready");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadOverview().catch(() => setAuth("login"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadOverview]);

  useEffect(() => {
    if (!overview || draftSurveyId === overview.activeSurveyId) return;
    setDraftSurveyId(overview.activeSurveyId);
    setDraftTitle(overview.survey.title);
    setDraftQuestions(overview.survey.questions);
  }, [overview, draftSurveyId]);

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setLoginError("");
    const response = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
    setBusy(false);
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setLoginError(result.error ?? "The password is incorrect.");
      return;
    }
    setPassword("");
    await loadOverview(overview?.activeSurveyId);
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setOverview(null);
    setAuth("login");
  }

  async function readFile(file: File) {
    try {
      let grid: unknown[][];
      if (file.name.toLowerCase().endsWith(".xlsx")) grid = (await readXlsxFile(file))[0]?.data ?? [];
      else grid = (await file.text()).split(/\r?\n/).filter(Boolean).map(csvCells);
      const rows = rowsFromGrid(grid);
      setPendingRows(rows);
      setNotice(rows.length ? `${rows.length} valid recipients found.` : "No valid email addresses were found.");
    } catch {
      setNotice("That file could not be read. Use an .xlsx or .csv file with First Name, Surname and Email columns.");
    }
  }

  function parsePasted() {
    const rows = parsePastedRows(pasteText);
    setPendingRows(rows);
    setNotice(rows.length ? `${rows.length} valid recipients found.` : "No valid email addresses were found.");
  }

  async function importRecipients() {
    const rows = rowsForImport(pasteText, pendingRows);
    if (!rows.length) {
      setNotice("Add at least one valid recipient before importing.");
      return;
    }
    setBusy(true);
    const response = await fetch("/api/admin/recipients", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ surveyId: overview?.activeSurveyId, recipients: rows }) });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) { setNotice(result.error ?? "The recipients could not be imported."); return; }
    setNotice(`${result.added} recipients added${result.skipped ? `; ${result.skipped} duplicates skipped` : ""}.`);
    setPendingRows([]);
    setPasteText("");
    setImportOpen(false);
    await loadOverview();
  }

  async function sendInvitations(mode: "initial" | "reminder") {
    setBusy(true);
    setNotice("");
    const response = await fetch("/api/admin/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ surveyId: overview?.activeSurveyId, mode }) });
    const result = await response.json();
    setBusy(false);
    setNotice(response.ok ? `${result.sent} email${result.sent === 1 ? "" : "s"} sent${result.failed ? `; ${result.failed} failed` : ""}.` : result.error);
    if (response.ok) await loadOverview(overview?.activeSurveyId);
  }

  async function switchSurvey(surveyId: number) {
    if (!surveyId || surveyId === overview?.activeSurveyId) return;
    setBusy(true);
    setNotice("");
    try {
      await loadOverview(surveyId);
    } catch {
      setNotice("That survey could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  async function createSurvey(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    const response = await fetch("/api/admin/surveys", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: newSurveyTitle }) });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setNotice(result.error ?? "The survey could not be created."); return; }
    setSurveyCreateOpen(false);
    setNewSurveyTitle("");
    setActiveTab("Settings");
    setSurveyEditorOpen(true);
    setNotice("Survey created. Add or edit its questions below.");
    await loadOverview(result.survey.id);
  }

  async function saveSurvey() {
    if (!overview) return;
    setBusy(true);
    setNotice("");
    const response = await fetch("/api/admin/surveys", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ surveyId: overview.activeSurveyId, title: draftTitle, questions: draftQuestions }) });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setNotice(result.error ?? "The survey could not be saved."); return; }
    setDraftTitle(result.survey.title);
    setDraftQuestions(result.survey.questions);
    setNotice("Survey changes saved.");
    await loadOverview(overview.activeSurveyId);
  }

  function addQuestion() {
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `question_${Date.now()}`;
    setDraftQuestions((current) => [...current, { id, number: current.length + 1, text: "", type: "choice", options: ["Yes", "No"], required: true }]);
  }

  function updateQuestion(questionId: string, changes: Partial<Question>) {
    setDraftQuestions((current) => current.map((question) => question.id === questionId ? { ...question, ...changes } : question));
  }

  function changeQuestionType(question: Question, type: QuestionType) {
    const changes: Partial<Question> = { type, options: undefined, min: undefined, max: undefined, lowLabel: undefined, highLabel: undefined };
    if (type === "choice") changes.options = question.options?.length ? question.options : ["Yes", "No"];
    if (type === "scale") Object.assign(changes, { min: 1, max: 10, lowLabel: "Low", highLabel: "High" });
    updateQuestion(question.id, changes);
  }

  function removeQuestion(questionId: string) {
    if (draftQuestions.length <= 1) { setNotice("A survey needs at least one question."); return; }
    setDraftQuestions((current) => current.filter((question) => question.id !== questionId).map((question, index) => ({ ...question, number: index + 1 })));
  }

  function exportResponses() {
    if (!overview) return;
    const headers = ["First name", "Surname", "Email", "Status", "Submitted", ...overview.survey.questions.map((question) => `Q${question.number}: ${question.text}`)];
    const lines = [headers, ...overview.recipients.filter((recipient) => recipient.answers_json).map((recipient) => {
      const answers = JSON.parse(recipient.answers_json ?? "{}") as Record<string, string | number>;
      return [recipient.first_name, recipient.last_name, recipient.email, statusLabel(recipient.status), recipient.submitted_at ?? "", ...overview.survey.questions.map((question) => answers[question.id] ?? "")];
    })].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","));
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `omega-survey-responses-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const filteredRecipients = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!overview || !term) return overview?.recipients ?? [];
    return overview.recipients.filter((recipient) => `${recipient.first_name} ${recipient.last_name} ${recipient.email}`.toLowerCase().includes(term));
  }, [overview, search]);

  if (auth === "loading") return <main className="login-shell"><div className="loader" aria-label="Loading" /></main>;

  if (auth === "login") {
    return <main className="login-shell"><section className="login-card"><Logo /><div className="login-copy"><span className="eyebrow">CLIENT FEEDBACK</span><h1>Welcome back</h1><p>Sign in to manage invitations and review client responses.</p></div><form onSubmit={login} className="login-form"><label htmlFor="password">Administrator password</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />{loginError && <p className="form-error" role="alert">{loginError}</p>}<button className="button primary full" disabled={busy}>{busy ? "Signing in…" : "Sign in securely"}</button></form><p className="secure-note">Protected management area</p></section></main>;
  }

  if (!overview) return null;
  const responseRate = overview.stats.total ? Math.round((overview.stats.submitted / overview.stats.total) * 100) : 0;
  const requiredQuestionCount = overview.survey.questions.filter((question) => question.required).length;
  const optionalQuestionCount = overview.survey.questions.length - requiredQuestionCount;
  const previewPath = previewSurveyPath(overview.activeSurveyId);

  return <main className="admin-shell">
    <aside className="sidebar"><Logo /><nav aria-label="Dashboard navigation">{tabs.map((tab) => <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}><span className="nav-dot" />{tab}</button>)}</nav><div className="sidebar-footer"><span className="avatar">OF</span><div><strong>Omega Financial</strong><small>Administrator</small></div><button onClick={logout} aria-label="Sign out" title="Sign out">↗</button></div></aside>
    <section className="dashboard">
      <header className="topbar"><div className="topbar-heading"><span className="eyebrow">CLIENT EXPERIENCE</span><h1>{activeTab}</h1><div className="survey-switcher"><label htmlFor="active-survey">Survey</label><select id="active-survey" value={overview.activeSurveyId} onChange={(event) => switchSurvey(Number(event.target.value))} disabled={busy}>{overview.surveys.map((survey) => <option key={survey.id} value={survey.id}>{survey.title}</option>)}</select><button className="text-button" onClick={() => setSurveyCreateOpen(true)}>New survey</button></div></div><div className="header-actions">{notice && <span className="notice" role="status">{notice}</span>}{activeTab === "Settings" && <button className="button secondary" onClick={() => setSurveyEditorOpen(true)}>Edit survey</button>}{activeTab === "Settings" && <a className="button secondary" href={previewPath} target="_blank" rel="noreferrer">Preview survey</a>}<button className="button secondary" onClick={() => setImportOpen(true)}>Add recipients</button><button className="button primary" onClick={() => sendInvitations("initial")} disabled={busy || !overview.configuration.emailReady || overview.stats.imported === 0}>Send invitations</button></div></header>

      {activeTab === "Overview" && <div className="content-grid">
        <section className="stats-grid" aria-label="Survey statistics"><article className="stat-card"><span>Recipients</span><strong>{overview.stats.total}</strong><small>{overview.stats.imported} ready to send</small></article><article className="stat-card"><span>Invitations sent</span><strong>{overview.stats.sent + overview.stats.opened + overview.stats.submitted}</strong><small>{overview.stats.opened} survey links opened</small></article><article className="stat-card accent"><span>Responses</span><strong>{overview.stats.submitted}</strong><small>{responseRate}% response rate</small></article><article className="stat-card"><span>Awaiting response</span><strong>{overview.stats.sent + overview.stats.opened}</strong><small>Eligible for a reminder</small></article></section>
        <section className="panel launch-panel"><div className="panel-heading"><div><span className="eyebrow">CAMPAIGN</span><h2>{overview.survey.title}</h2></div><span className="status-pill live">Ready</span></div><div className="launch-body"><div className="progress-ring" style={{ "--progress": `${responseRate * 3.6}deg` } as React.CSSProperties}><div><strong>{responseRate}%</strong><span>response</span></div></div><div className="launch-copy"><p>Your survey contains eight concise questions and takes approximately two minutes to complete.</p><div className="check-row"><span className="check">✓</span><div><strong>Survey ready</strong><small>Seven required questions and one optional comment</small></div></div><div className="check-row"><span className={overview.configuration.emailReady ? "check" : "check pending"}>{overview.configuration.emailReady ? "✓" : "!"}</span><div><strong>{overview.configuration.emailReady ? "Email delivery connected" : "Email delivery needs configuration"}</strong><small>{overview.configuration.senderEmail ?? "Add the existing Omega sender address and delivery key"}</small></div></div></div><div className="launch-actions"><button className="button secondary" onClick={() => setActiveTab("Settings")}>View setup</button><button className="text-button" onClick={() => setActiveTab("Responses")}>View responses →</button></div></div></section>
        <section className="panel recent-panel"><div className="panel-heading"><div><span className="eyebrow">RECENT ACTIVITY</span><h2>Recipients</h2></div><button className="text-button" onClick={() => setActiveTab("Recipients")}>View all →</button></div><RecipientTable recipients={overview.recipients.slice(0, 5)} /></section>
        <section className="panel survey-preview"><div className="panel-heading"><div><span className="eyebrow">QUESTIONNAIRE</span><h2>Survey preview</h2></div><span className="question-count">8 questions</span></div><div className="question-list">{overview.survey.questions.slice(0, 4).map((question) => <div key={question.id}><span>{question.number}</span><p>{question.text}</p><small>{question.type === "scale" ? "1–10 rating" : question.type === "textarea" ? "Comment" : "Single choice"}</small></div>)}</div><button className="text-button preview-more" onClick={() => setActiveTab("Settings")}>Review all questions →</button></section>
      </div>}

      {activeTab === "Recipients" && <section className="panel page-panel"><div className="panel-heading stacked-mobile"><div><span className="eyebrow">MAILING LIST</span><h2>All recipients</h2></div><div className="table-tools"><input aria-label="Search recipients" placeholder="Search by name or email" value={search} onChange={(event) => setSearch(event.target.value)} /><button className="button secondary" disabled={busy || !overview.configuration.emailReady || overview.stats.sent + overview.stats.opened === 0} onClick={() => sendInvitations("reminder")}>Send reminder</button></div></div><RecipientTable recipients={filteredRecipients} /></section>}

      {activeTab === "Responses" && <section className="panel page-panel"><div className="panel-heading stacked-mobile"><div><span className="eyebrow">IDENTIFIED RESPONSES</span><h2>Client feedback</h2></div><button className="button secondary" onClick={exportResponses} disabled={overview.stats.submitted === 0}>Export CSV</button></div><div className="response-list">{overview.recipients.filter((recipient) => recipient.answers_json).length === 0 ? <EmptyState title="No responses yet" body="Completed survey responses will appear here and remain matched to each recipient." /> : overview.recipients.filter((recipient) => recipient.answers_json).map((recipient) => { const answers = JSON.parse(recipient.answers_json ?? "{}") as Record<string, string | number>; return <details key={recipient.id} className="response-card"><summary><span className="avatar small">{recipient.first_name[0]}{recipient.last_name[0]}</span><span><strong>{recipient.first_name} {recipient.last_name}</strong><small>{recipient.email}</small></span><time>{formatDate(recipient.submitted_at)}</time><b>⌄</b></summary><div className="answer-grid">{overview.survey.questions.map((question) => <div key={question.id}><span>Question {question.number}</span><p>{question.text}</p><strong>{String(answers[question.id] ?? "No comment")}</strong></div>)}</div></details>; })}</div></section>}

      {activeTab === "Settings" && <div className="settings-grid"><section className="panel page-panel"><div className="panel-heading"><div><span className="eyebrow">QUESTIONNAIRE</span><h2>Current survey</h2></div><span className="status-pill live">Active</span></div><div className="settings-questions">{overview.survey.questions.map((question) => <div key={question.id}><span>{question.number}</span><div><strong>{question.text}</strong><small>{question.required ? "Required" : "Optional"} · {question.type === "scale" ? "1–10 rating" : question.type === "textarea" ? "Long text" : "Single choice"}</small></div></div>)}</div></section><aside className="panel configuration-card"><span className="eyebrow">DELIVERY & SECURITY</span><h2>Configuration</h2><div className="config-row"><span className={overview.configuration.emailReady ? "config-icon ready" : "config-icon"}>✉</span><div><strong>Email delivery</strong><small>{overview.configuration.emailReady ? overview.configuration.senderEmail : "Not connected"}</small></div></div><div className="config-row"><span className="config-icon ready">✓</span><div><strong>Administrator access</strong><small>Password protected</small></div></div><div className="config-row"><span className="config-icon ready">⌁</span><div><strong>Response matching</strong><small>Secure unique links</small></div></div><p className="privacy-copy">Recipients are informed that their responses are linked to the email address that received the invitation.</p></aside></div>}
      {activeTab === "Preview" && <section className="panel page-panel preview-page"><div className="panel-heading stacked-mobile"><div><span className="eyebrow">RECIPIENT VIEW</span><h2>Survey preview</h2></div><a className="button secondary" href={previewPath} target="_blank" rel="noreferrer">Open in new tab</a></div><div className="preview-copy"><p>This is the same questionnaire styling and response controls recipients will see from their email link. Preview mode is read-only and does not save responses.</p></div><div className="preview-frame-wrap"><iframe title="Survey preview" src={previewPath} /></div></section>}
    </section>

    {importOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setImportOpen(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="import-title"><div className="modal-heading"><div><span className="eyebrow">RECIPIENTS</span><h2 id="import-title">Add your client list</h2></div><button onClick={() => setImportOpen(false)} aria-label="Close">×</button></div><p>Upload an Excel or CSV file, or paste rows in the order: first name, surname, email.</p><button className="upload-zone" onClick={() => fileRef.current?.click()}><span>↑</span><strong>Choose an Excel or CSV file</strong><small>.xlsx or .csv · up to 500 recipients</small></button><input ref={fileRef} hidden type="file" accept=".xlsx,.csv" onChange={(event) => event.target.files?.[0] && readFile(event.target.files[0])} /><div className="or"><span>or paste a list</span></div><textarea value={pasteText} onChange={(event) => { setPasteText(event.target.value); setPendingRows([]); setNotice(""); }} placeholder={'First Name,Surname,Email\nAoife,Byrne,aoife@example.ie'} rows={5} /><button className="text-button" onClick={parsePasted}>Check pasted list</button>{notice && <p className="modal-notice">{notice}</p>}{pendingRows.length > 0 && <div className="import-preview"><strong>Preview</strong>{pendingRows.slice(0, 3).map((row) => <span key={row.email}>{row.firstName} {row.lastName} · {row.email}</span>)}{pendingRows.length > 3 && <small>and {pendingRows.length - 3} more</small>}</div>}<div className="modal-actions"><button className="button secondary" onClick={() => setImportOpen(false)}>Cancel</button><button className="button primary" disabled={busy || rowsToImport.length === 0} onClick={importRecipients}>{busy ? "Adding…" : `Add ${rowsToImport.length || ""} recipients`}</button></div></section></div>}
    {surveyEditorOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSurveyEditorOpen(false); }}><section className="modal survey-editor-modal" role="dialog" aria-modal="true" aria-labelledby="survey-editor-title"><div className="modal-heading"><div><span className="eyebrow">QUESTIONNAIRE</span><h2 id="survey-editor-title">Edit survey</h2></div><button type="button" onClick={() => setSurveyEditorOpen(false)} aria-label="Close">×</button></div><p>Change the survey name, question wording, required state, and response type. Choice answers are entered one per line.</p><form onSubmit={(event) => { event.preventDefault(); void saveSurvey(); }}><label className="editor-field"><span>Survey name</span><input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} maxLength={160} required /></label><div className="question-editor-list">{draftQuestions.map((question, index) => <article className="question-editor" key={question.id}><div className="question-editor-heading"><span>{String(index + 1).padStart(2, "0")}</span><div><strong>Question {index + 1}</strong><button type="button" className="text-button" onClick={() => removeQuestion(question.id)} disabled={draftQuestions.length === 1}>Remove</button></div></div><label className="editor-field"><span>Question text</span><input value={question.text} onChange={(event) => updateQuestion(question.id, { text: event.target.value })} maxLength={500} required /></label><div className="editor-grid"><label className="editor-field"><span>Response type</span><select value={question.type} onChange={(event) => changeQuestionType(question, event.target.value as QuestionType)}><option value="choice">Single choice</option><option value="scale">1–10 rating</option><option value="textarea">Long text</option></select></label><label className="checkbox-field"><input type="checkbox" checked={question.required} onChange={(event) => updateQuestion(question.id, { required: event.target.checked })} /><span>Required response</span></label></div>{question.type === "choice" && <label className="editor-field"><span>Answer options</span><textarea value={(question.options ?? []).join("\n")} onChange={(event) => updateQuestion(question.id, { options: event.target.value.split(/\r?\n/) })} rows={4} placeholder={'Yes\nNo'} /><small>Use at least two options.</small></label>}{question.type === "scale" && <div className="editor-grid"><label className="editor-field"><span>Low label</span><input value={question.lowLabel ?? ""} onChange={(event) => updateQuestion(question.id, { lowLabel: event.target.value })} maxLength={80} /></label><label className="editor-field"><span>High label</span><input value={question.highLabel ?? ""} onChange={(event) => updateQuestion(question.id, { highLabel: event.target.value })} maxLength={80} /></label></div>}</article>)}</div><button type="button" className="button secondary add-question" onClick={addQuestion}>Add question</button><div className="modal-actions"><button type="button" className="button secondary" onClick={() => setSurveyEditorOpen(false)}>Cancel</button><button type="submit" className="button primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button></div></form></section></div>}

    {surveyCreateOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSurveyCreateOpen(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="create-survey-title"><div className="modal-heading"><div><span className="eyebrow">SURVEYS</span><h2 id="create-survey-title">Create a survey</h2></div><button type="button" onClick={() => setSurveyCreateOpen(false)} aria-label="Close">×</button></div><p>Start with the standard questionnaire, then edit its questions and response types before adding recipients.</p><form onSubmit={createSurvey}><label className="editor-field"><span>Survey name</span><input value={newSurveyTitle} onChange={(event) => setNewSurveyTitle(event.target.value)} placeholder="e.g. Annual client experience survey" maxLength={160} required autoFocus /></label><div className="modal-actions"><button type="button" className="button secondary" onClick={() => setSurveyCreateOpen(false)}>Cancel</button><button type="submit" className="button primary" disabled={busy}>{busy ? "Creating…" : "Create survey"}</button></div></form></section></div>}

  </main>;
}

function RecipientTable({ recipients }: { recipients: Recipient[] }) {
  if (!recipients.length) return <EmptyState title="No recipients yet" body="Add a client list to prepare personalised survey invitations." />;
  return <div className="table-wrap"><table><thead><tr><th>Client</th><th>Status</th><th>Sent</th><th>Response</th><th>Reminders</th></tr></thead><tbody>{recipients.map((recipient) => <tr key={recipient.id}><td><div className="client-cell"><span className="avatar small">{recipient.first_name[0]}{recipient.last_name[0]}</span><span><strong>{recipient.first_name} {recipient.last_name}</strong><small>{recipient.email}</small></span></div></td><td><span className={`status-pill ${recipient.status}`}>{statusLabel(recipient.status)}</span></td><td>{formatDate(recipient.sent_at)}</td><td>{formatDate(recipient.submitted_at)}</td><td>{recipient.reminder_count || "—"}</td></tr>)}</tbody></table></div>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="empty-state"><span>○</span><strong>{title}</strong><p>{body}</p></div>;
}
