"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Logo from "./Logo";

type Question = {
  id: string;
  number: number;
  text: string;
  type: "choice" | "scale" | "textarea";
  options?: string[];
  min?: number;
  max?: number;
  lowLabel?: string;
  highLabel?: string;
  required: boolean;
};

type SurveyData = { status: "active" | "submitted" | "preview"; firstName: string; title: string; questions: Question[] };

export default function SurveyForm({ token, previewSurveyId }: { token?: string; previewSurveyId?: number }) {
  const preview = previewSurveyId !== undefined;
  const endpoint = preview ? `/api/admin/surveys/preview?surveyId=${encodeURIComponent(previewSurveyId)}` : token ? `/api/survey/${encodeURIComponent(token)}` : "";
  const [survey, setSurvey] = useState<SurveyData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [state, setState] = useState<"loading" | "active" | "submitting" | "submitted" | "invalid">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!endpoint) { setState("invalid"); return; }
    fetch(endpoint, { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error();
      const data = await response.json() as SurveyData;
      setSurvey(data);
      setState(data.status === "submitted" ? "submitted" : "active");
    }).catch(() => setState("invalid"));
  }, [endpoint]);

  const progress = useMemo(() => {
    if (!survey) return 0;
    const required = survey.questions.filter((question) => question.required);
    const complete = required.filter((question) => answers[question.id] !== undefined && answers[question.id] !== "").length;
    return Math.round((complete / required.length) * 100);
  }, [answers, survey]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (preview || !token) return;
    setError("");
    setState("submitting");
    const response = await fetch(`/api/survey/${encodeURIComponent(token)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error ?? "Your response could not be submitted. Please try again."); setState("active"); return; }
    setState("submitted");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (state === "loading") return <main className="survey-shell"><div className="loader survey-loader" aria-label="Loading survey" /></main>;
  if (state === "invalid") return <Message title={preview ? "Preview unavailable" : "This survey link is not available"} body={preview ? "Sign in as an administrator to view this survey preview." : "Please check that you opened the complete link from your Omega Financial email."} />;
  if (state === "submitted") return <Message title="Thank you for your feedback" body="Your response has been received. We appreciate you taking the time to help us improve our service." success />;
  if (!survey) return null;

  return <main className="survey-shell">
    <header className="survey-header"><Logo /><span>Secure client survey</span></header>
    <div className="survey-progress"><span style={{ width: `${progress}%` }} /></div>
    <section className="survey-intro"><span className="eyebrow">CLIENT EXPERIENCE</span><h1>{survey.title}{survey.firstName ? `, ${survey.firstName}` : ""}.</h1><p>This short survey should take approximately two minutes. Your feedback will help us continue to improve the service we provide.</p><div className="identity-notice"><span>i</span><p>Your responses are confidential within Omega Financial and are linked to the email address that received this invitation.</p></div></section>
    <form className="survey-form" onSubmit={submit}>
      {survey.questions.map((question) => <fieldset key={question.id} className="survey-question">
        <legend className="visually-hidden">{question.text}{!question.required ? " Optional" : ""}</legend>
        <div className="question-heading" aria-hidden="true"><span>{String(question.number).padStart(2, "0")}</span><strong>{question.text}</strong>{!question.required && <small>Optional</small>}</div>
        {question.type === "choice" && <div className="choice-grid">{question.options?.map((option) => <label key={option} className={answers[question.id] === option ? "selected" : ""}><input type="radio" name={question.id} value={option} checked={answers[question.id] === option} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option }))} required={question.required} /><span>{option}</span><b>✓</b></label>)}</div>}
        {question.type === "scale" && <div className="scale-wrap"><div className="scale-grid">{Array.from({ length: (question.max ?? 10) - (question.min ?? 1) + 1 }, (_, index) => (question.min ?? 1) + index).map((value) => <label key={value} className={answers[question.id] === value ? "selected" : ""}><input type="radio" name={question.id} value={value} checked={answers[question.id] === value} onChange={() => setAnswers((current) => ({ ...current, [question.id]: value }))} required={question.required} /><span>{value}</span></label>)}</div><div className="scale-labels"><span>{question.lowLabel}</span><span>{question.highLabel}</span></div></div>}
        {question.type === "textarea" && <textarea name={question.id} value={String(answers[question.id] ?? "")} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} placeholder="Share any suggestions or comments…" rows={5} maxLength={3000} />}
      </fieldset>)}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="submit-row"><p>By submitting, you confirm that you are happy for Omega Financial to review this feedback.</p><button type="submit" className="button primary" disabled={state === "submitting"}>{state === "submitting" ? "Submitting…" : "Submit feedback"}</button></div>
    </form>
    <footer className="survey-footer"><p>OFM Financial Ltd T/A Omega Financial Management, regulated by the Central Bank of Ireland.</p><span>Secure survey · Your response is protected</span></footer>
  </main>;
}

function Message({ title, body, success = false }: { title: string; body: string; success?: boolean }) {
  return <main className="survey-shell message-shell"><Logo /><section className="message-card"><span className={success ? "message-icon success" : "message-icon"}>{success ? "✓" : "!"}</span><h1>{title}</h1><p>{body}</p><a href="https://omegafinancial.ie">Visit Omega Financial</a></section><footer className="survey-footer"><p>OFM Financial Ltd T/A Omega Financial Management, regulated by the Central Bank of Ireland.</p></footer></main>;
}
