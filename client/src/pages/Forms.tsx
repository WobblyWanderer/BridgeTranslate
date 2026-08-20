import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { extractLocalDocumentText, extractLocalFormText, suggestDocumentContextLabel, suggestFormContextSummary } from "@/lib/documentText";
import { budgetDocumentContext, type ContextDocument } from "@/lib/documentContextBudget";
import { clearCurrentFormSource } from "@/lib/formWorkspace";
import { jsPDF } from "jspdf";
import { ArrowRight, Check, Clipboard, Copy, Download, FileText, HelpCircle, History, Hourglass, Link as LinkIcon, Map, RotateCcw, Save, ShieldCheck, Sparkles, Trash2, Upload, X } from "lucide-react";

const GUEST_FORM_DRAFT_KEY = "bridge-guest-form-to-save-v1";
const FORM_TEXT_LIMIT = 80_000;
const SUPPORTING_CONTEXT_BUDGET = 30_000;

type QuestionItem = {
  id: string;
  section: string;
  label: string;
  prompt: string;
  helpText: string;
  required: boolean;
  answer: string;
  status: "answered" | "missing" | "uncertain";
};

type SavedFormSession = {
  id: number;
  formTitle: string;
  sourceName: string | null;
  questionsJson: string;
  missingJson: string;
  formContextSummary?: string | null;
  userContext?: string | null;
  triage?: string | null;
  answerList?: string | null;
  updatedAt: Date | string;
};

type FormSource = { name: string; text: string; truncated: boolean };

type GuestFormDraft = {
  formTitle: string;
  sourceName: string;
  userContext: string;
  questions: QuestionItem[];
  missing: string[];
  sourceSummary: string;
  formContextSummary: string;
  triage: string;
  answerList: string;
};

function downloadFile(filename: string, content: BlobPart, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function answersAsText(title: string, summary: string, questions: QuestionItem[]) {
  return `${title}\n\n${summary ? `FORM SUMMARY\n${summary}\n\n` : ""}${questions.map((question) => `${question.section ? `${question.section}\n` : ""}${question.label}${question.required ? " *" : ""}\n${question.answer || "(Still needs your answer)"}${question.helpText ? `\nNote: ${question.helpText}` : ""}`).join("\n\n")}`;
}

function downloadWord(title: string, summary: string, questions: QuestionItem[]) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1>${summary ? `<p><strong>Form summary:</strong> ${summary}</p>` : ""}${questions.map((question) => `<h3>${question.label}${question.required ? " *" : ""}</h3><p>${question.answer || "(Still needs your answer)"}</p>${question.helpText ? `<p><em>Note: ${question.helpText}</em></p>` : ""}`).join("")}</body></html>`;
  downloadFile("bridge-form-answers.doc", html, "application/msword");
}

function downloadPdf(title: string, summary: string, questions: QuestionItem[]) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let y = margin;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(title, margin, y);
  y += 26;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  const writeBlock = (block: string) => {
    pdf.splitTextToSize(block, pageWidth - margin * 2).forEach((line: string) => {
      if (y > pageHeight - margin) { pdf.addPage(); y = margin; }
      pdf.text(line, margin, y);
      y += 14;
    });
    y += 6;
  };
  if (summary) writeBlock(`FORM SUMMARY\n${summary}`);
  questions.forEach((question) => writeBlock(`${question.label}${question.required ? " *" : ""}\n${question.answer || "(Still needs your answer)"}${question.helpText ? `\nNote: ${question.helpText}` : ""}`));
  pdf.save("bridge-form-answers.pdf");
}

export default function FormsPage() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const utils = trpc.useUtils();
  const [sourceMode, setSourceMode] = useState<"link" | "upload" | "paste">("link");
  const [formUrl, setFormUrl] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [formSource, setFormSource] = useState<FormSource | null>(null);
  const [formContextSummary, setFormContextSummary] = useState("");
  const [userContext, setUserContext] = useState("");
  const [supportingDocuments, setSupportingDocuments] = useState<ContextDocument[]>([]);
  const [formTitle, setFormTitle] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceSummary, setSourceSummary] = useState("");
  const [triage, setTriage] = useState("");
  const [answerList, setAnswerList] = useState("");
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [additionalContext, setAdditionalContext] = useState("");
  const [savedSessionId, setSavedSessionId] = useState<number | null>(null);
  const [uiError, setUiError] = useState("");
  const [copied, setCopied] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [formDropActive, setFormDropActive] = useState(false);
  const [supportDropActive, setSupportDropActive] = useState(false);
  const formInputRef = useRef<HTMLInputElement>(null);
  const supportInputRef = useRef<HTMLInputElement>(null);

  const historyQuery = trpc.forms.list.useQuery(undefined, { enabled: isAuthenticated });
  const triageMutation = trpc.forms.triage.useMutation({
    onSuccess: (data) => {
      setFormTitle(data.formTitle); setSourceName(data.formTitle); setTriage(data.triage); setQuestions([]); setMissing([]); setSavedSessionId(null); setUiError("");
      setTimeout(() => document.getElementById("form-review")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    },
    onError: (error) => setUiError(error.message),
  });
  const answerListMutation = trpc.forms.answerList.useMutation({
    onSuccess: (data) => { setAnswerList(data.answerList); setUiError(""); setTimeout(() => document.getElementById("form-answer-list")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); },
    onError: (error) => setUiError(error.message),
  });
  const analyzeMutation = trpc.forms.analyze.useMutation({ onError: (error) => setUiError(error.message) });
  const refineMutation = trpc.forms.refine.useMutation({ onError: (error) => setUiError(error.message) });
  const saveMutation = trpc.forms.saveGuestResult.useMutation({
    onSuccess: async (data) => { setSavedSessionId(data.sessionId); await utils.forms.list.invalidate(); setUiError(""); sessionStorage.removeItem(GUEST_FORM_DRAFT_KEY); },
    onError: (error) => setUiError(error.message),
  });
  const saveWorkspaceMutation = trpc.forms.saveWorkspace.useMutation({
    onSuccess: async (data) => { setSavedSessionId(data.sessionId); await utils.forms.list.invalidate(); setUiError(""); sessionStorage.removeItem(GUEST_FORM_DRAFT_KEY); },
    onError: (error) => setUiError(error.message),
  });
  const updateMutation = trpc.forms.update.useMutation({
    onSuccess: async () => { await utils.forms.list.invalidate(); setUiError(""); },
    onError: (error) => setUiError(error.message),
  });
  const deleteMutation = trpc.forms.delete.useMutation({
    onSuccess: async () => { await utils.forms.list.invalidate(); setSavedSessionId(null); },
    onError: (error) => setUiError(error.message),
  });

  const busy = triageMutation.isPending || answerListMutation.isPending || analyzeMutation.isPending || refineMutation.isPending || saveWorkspaceMutation.isPending || isImporting;

  useEffect(() => {
    if (!isAuthenticated) return;
    const raw = sessionStorage.getItem(GUEST_FORM_DRAFT_KEY);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as GuestFormDraft;
      setFormTitle(draft.formTitle); setSourceName(draft.sourceName); setFormContextSummary(draft.formContextSummary || ""); setUserContext(draft.userContext); setTriage(draft.triage || ""); setAnswerList(draft.answerList || ""); setQuestions(draft.questions); setMissing(draft.missing); setSourceSummary(draft.sourceSummary); setSavedSessionId(null);
      setTimeout(() => document.getElementById("form-review")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    } catch { sessionStorage.removeItem(GUEST_FORM_DRAFT_KEY); }
  }, [isAuthenticated]);

  function currentDraft(): GuestFormDraft {
    return { formTitle: formTitle || formName(), sourceName: formSource?.name || sourceName || formName(), formContextSummary, userContext, triage, answerList, questions, missing, sourceSummary };
  }

  function clearSession() {
    if (!window.confirm("Clear this Forms session? Any files or answers you have already downloaded will stay on your device.")) return;
    sessionStorage.removeItem(GUEST_FORM_DRAFT_KEY);
    setFormUrl(""); setPastedText(""); setFormSource(null); setFormContextSummary(""); setUserContext(""); setSupportingDocuments([]); setFormTitle(""); setSourceName(""); setSourceSummary(""); setTriage(""); setAnswerList(""); setQuestions([]); setMissing([]); setAdditionalContext(""); setSavedSessionId(null); setUiError("");
  }

  async function readFormFile(file?: File) {
    if (!file) return;
    setIsImporting(true); setUiError("");
    try {
      const extracted = await extractLocalFormText(file, FORM_TEXT_LIMIT);
      if (!extracted.text.trim()) throw new Error("Bridge could not find readable questions in that form copy.");
      setSourceMode("upload"); setFormSource({ name: file.name, text: extracted.text, truncated: extracted.truncated }); setFormContextSummary(suggestFormContextSummary(file.name, extracted.text)); setFormTitle(""); setTriage(""); setAnswerList(""); setQuestions([]); setMissing([]); setSavedSessionId(null);
    } catch (error) {
      setUiError(error instanceof Error ? error.message : "Bridge could not read that form copy.");
    } finally { setIsImporting(false); }
  }

  async function addSupportingDocuments(files: FileList | File[]) {
    const available = 20 - supportingDocuments.length;
    const selected = Array.from(files).slice(0, available);
    if (!selected.length) { setUiError("You can keep up to twenty supporting sources in this Forms session. Remove one to add another."); return; }
    setIsImporting(true); setUiError("");
    try {
      const added: ContextDocument[] = [];
      const errors: string[] = [];
      for (const file of selected) {
        try {
          const extracted = await extractLocalDocumentText(file, 30_000);
          if (!extracted.text.trim()) throw new Error("Bridge could not find readable context in this file.");
          added.push({ id: crypto.randomUUID(), name: file.name, contextLabel: suggestDocumentContextLabel(file.name, extracted.text), text: extracted.text, truncated: extracted.truncated });
        } catch (error) { errors.push(`${file.name}: ${error instanceof Error ? error.message : "could not be read."}`); }
      }
      if (added.length) setSupportingDocuments((current) => [...current, ...added].slice(0, 20));
      if (errors.length) setUiError(errors.join(" "));
      else if (selected.length < Array.from(files).length) setUiError("Bridge added the first twenty supporting sources. Remove one to add another.");
    } finally { setIsImporting(false); }
  }

  function formName() {
    if (sourceMode === "upload") return formSource?.name || "Uploaded form copy";
    if (sourceMode === "link") { try { return new URL(formUrl).hostname; } catch { return "Public form link"; } }
    return "Pasted form copy";
  }

  function handleAnalyze() {
    const formText = sourceMode === "upload" ? formSource?.text : sourceMode === "paste" ? pastedText.trim() : undefined;
    if (sourceMode === "upload" && !formSource) { setUiError("Add the form copy first."); return; }
    if (sourceMode === "paste" && !pastedText.trim()) { setUiError("Paste the form questions or text first."); return; }
    if (sourceMode === "link" && !formUrl.trim()) { setUiError("Add the public form link first."); return; }
    if (!userContext.trim()) { setUiError("Add the context in your own words first. Bridge needs to know what you are trying to apply for or explain."); return; }
    setUiError("");
    triageMutation.mutate({ formName: formName(), formText, formUrl: sourceMode === "link" ? formUrl.trim() : undefined, naturalStory: userContext, supportingContext: budgetDocumentContext(supportingDocuments, SUPPORTING_CONTEXT_BUDGET, `${formText || formUrl}\n${userContext}`) });
  }

  function removeCurrentForm() {
    const cleared = clearCurrentFormSource({ formUrl, pastedText, formSource, formContextSummary });
    setFormUrl(cleared.formUrl); setPastedText(cleared.pastedText); setFormSource(cleared.formSource); setFormContextSummary(cleared.formContextSummary); setUiError("");
    if (formInputRef.current) formInputRef.current.value = "";
  }

  function handleUpdateTriage() {
    const formText = sourceMode === "upload" ? formSource?.text : sourceMode === "paste" ? pastedText.trim() : undefined;
    if (!triage.trim()) { setUiError("Build or write a triage summary before asking Bridge to update it."); return; }
    setUiError(""); setAnswerList("");
    triageMutation.mutate({ formName: formTitle || formName(), formText, formUrl: sourceMode === "link" ? formUrl.trim() : undefined, naturalStory: `${userContext}\n\nUSER-EDITED CURRENT TRIAGE — treat this as a correction or addition, not as evidence by itself:\n${triage}`, supportingContext: budgetDocumentContext(supportingDocuments, SUPPORTING_CONTEXT_BUDGET, `${formText || formUrl}\n${userContext}\n${triage}`) });
  }

  function handleGenerateAnswerList() {
    if (!triage.trim()) { setUiError("Build or write a triage summary before generating an answer list."); return; }
    setUiError(""); answerListMutation.mutate({ formName: formTitle || formName(), triage, userContext });
  }

  function handleRefine() {
    if (!additionalContext.trim()) { setUiError("Add the new detail, correction, or answer you want Bridge to consider first."); return; }
    setUiError("");
    refineMutation.mutate({ formTitle, questions, additionalContext, supportingContext: budgetDocumentContext(supportingDocuments, SUPPORTING_CONTEXT_BUDGET) });
  }

  function updateAnswer(id: string, answer: string) {
    setQuestions((current) => current.map((question) => question.id === id ? { ...question, answer, status: answer.trim() ? "answered" : "missing" } : question));
  }

  async function handleCopyAll() {
    await navigator.clipboard.writeText(answersAsText(formTitle, sourceSummary, questions));
    setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  }

  function handleSave() {
    if (!questions.length) return;
    if (!isAuthenticated) { sessionStorage.setItem(GUEST_FORM_DRAFT_KEY, JSON.stringify(currentDraft())); startLogin(); return; }
    if (savedSessionId) {
      updateMutation.mutate({ sessionId: savedSessionId, formTitle, questions, missing, status: missing.length ? "in_progress" : "ready" });
      return;
    }
    saveMutation.mutate({ formTitle, sourceName, questions, missing });
  }

  function handleSaveWorkspace() {
    if (!triage.trim()) { setUiError("Build or write a triage summary before saving a working prompt."); return; }
    if (!isAuthenticated) { sessionStorage.setItem(GUEST_FORM_DRAFT_KEY, JSON.stringify(currentDraft())); startLogin(); return; }
    saveWorkspaceMutation.mutate({ sessionId: savedSessionId ?? undefined, formTitle: formTitle || formName(), sourceName: formSource?.name || sourceName || formName(), formContextSummary, userContext, triage, answerList });
  }

  function openSavedSession(item: SavedFormSession) {
    try { setQuestions(JSON.parse(item.questionsJson) as QuestionItem[]); } catch { setQuestions([]); }
    try { setMissing(JSON.parse(item.missingJson) as string[]); } catch { setMissing([]); }
    setFormUrl(""); setPastedText(""); setFormSource(null); setSupportingDocuments([]); setFormTitle(item.formTitle); setSourceName(item.sourceName || "Saved form source"); setFormContextSummary(item.formContextSummary || ""); setUserContext(item.userContext || ""); setTriage(item.triage || ""); setAnswerList(item.answerList || ""); setSourceSummary(""); setSavedSessionId(item.id);
    setTimeout(() => document.getElementById("form-review")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  const unanswered = questions.filter((question) => !question.answer.trim() || question.status !== "answered");

  return (
    <div className="bridge-page bridge-forms-page">
      <header className="bridge-shell bridge-header">
        <Link className="bridge-brand" href="/" aria-label="Bridge home"><span className="bridge-mark"><span className="serif" style={{ fontSize: "1.6rem", lineHeight: 1 }}>B</span></span><span className="bridge-brand-word">BRIDGE</span></Link>
        <div className="bridge-header-note"><span className="bridge-dot" /> form in · answers out</div>
        <div className="bridge-action-row" style={{ marginTop: 0 }}><Link className="bridge-button ghost" href="/">Translate mode</Link>{isAuthenticated ? <button className="bridge-button ghost" onClick={() => void logout()}>{user?.name ? `Sign out · ${user.name.split(" ")[0]}` : "Sign out"}</button> : <button className="bridge-button ghost" onClick={() => startLogin()}>{loading ? "Checking…" : "Sign in"}</button>}</div>
      </header>

      <main className="bridge-shell">
        <section className="bridge-hero" style={{ paddingBottom: "2rem" }}><div><p className="bridge-eyebrow">Bridge Forms · guest-friendly</p><h1 className="serif">Bring the form.<br />Keep the meaning.</h1><p className="bridge-hero-copy">Use the exact form you have. Add the context and supporting sources that make the answers make sense. Bridge maps what is covered, shows what is still missing, and gives you editable answers to copy or download.</p></div><div className="bridge-hero-visual" aria-hidden="true"><div className="bridge-orbit" /><div className="bridge-map-card"><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".65rem" }}><span className="bridge-eyebrow" style={{ margin: 0, fontSize: ".64rem" }}>forms crossing</span><Clipboard size={18} color="#8d73a8" /></div><h3 className="serif">Answers with gaps visible</h3><p>The form stays editable. The person remains the editor-in-chief.</p></div></div></section>

        <section className="bridge-workspace" style={{ paddingTop: 0 }}><div className="bridge-workspace-shell">
          <div className="bridge-workspace-top"><div><p className="bridge-eyebrow">Bridge Forms · guest-first</p><h2 className="serif">Start with the form you actually have.</h2><p>Try, map, edit, generate copy-and-paste answers, download, or clear without an account. <strong>Sign-in is optional and is only used if you later choose to save this workspace to your own account for return visits.</strong></p></div></div>
          <div className="bridge-banner bridge-forms-readable" style={{ marginTop: 0 }}><ShieldCheck size={18} style={{ flex: "none" }} /><span><strong>Form answers, not form submission.</strong> Bridge helps you prepare clear, editable answers. It cannot submit an official form for you, and it does not replace legal, medical, benefits, immigration, or professional advice.</span></div>
          <div className="bridge-step"><div className="bridge-step-label"><span className="bridge-step-number">1</span> Add the actual form</div><p className="bridge-helper">Paste a public link, upload your own PDF, Word .docx, photo, scan, XML, EML, or text copy, or paste the questions. Bridge uses the version you have—not a stale catalogue.</p><div className="bridge-chip-grid" style={{ marginBottom: "1rem" }}><button type="button" className="bridge-chip" aria-pressed={sourceMode === "link"} onClick={() => setSourceMode("link")}><LinkIcon size={14} style={{ marginRight: ".3rem", verticalAlign: "-2px" }} /> Link</button><button type="button" className="bridge-chip" aria-pressed={sourceMode === "upload"} onClick={() => { setSourceMode("upload"); formInputRef.current?.click(); }}><Upload size={14} style={{ marginRight: ".3rem", verticalAlign: "-2px" }} /> Upload copy</button><button type="button" className="bridge-chip" aria-pressed={sourceMode === "paste"} onClick={() => setSourceMode("paste")}><FileText size={14} style={{ marginRight: ".3rem", verticalAlign: "-2px" }} /> Paste text</button></div><div className={`bridge-dropzone bridge-dropzone-compact ${formDropActive ? "is-dragging" : ""}`} role="button" tabIndex={0} aria-label="Drop or choose a form copy" onClick={() => { setSourceMode("upload"); formInputRef.current?.click(); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSourceMode("upload"); formInputRef.current?.click(); } }} onDragOver={(event) => { event.preventDefault(); setFormDropActive(true); }} onDragLeave={() => setFormDropActive(false)} onDrop={(event) => { event.preventDefault(); setFormDropActive(false); void readFormFile(event.dataTransfer.files?.[0]); }}><Upload size={21} aria-hidden="true" /><strong>{isImporting ? "Reading your form in this browser…" : "Drop the form here"}</strong><p>Or click to choose a PDF, Word .docx, text, photo, screenshot, scan, XML, or EML source.</p><span className="bridge-input-note">{formSource ? `Form copy ready: ${formSource.name}` : "Bridge reads the question text locally first. No arbitrary file-size rule is shown—only an honest error if a source cannot be processed."}</span><input ref={formInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.md,.csv,.rtf,.html,.xml,.eml,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tif,.tiff,text/plain,text/markdown,text/csv,text/xml,message/rfc822,application/pdf,application/rtf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp,image/gif,image/bmp,image/tiff" style={{ display: "none" }} onChange={(event) => void readFormFile(event.target.files?.[0])} /></div>{(formSource || (sourceMode === "link" && formUrl)) && <div className="bridge-form-source-summary"><div style={{ flex: 1 }}><label className="bridge-input-label" htmlFor="form-context-summary">What is this form about? <span style={{ fontWeight: 400 }}>You can edit this local summary.</span></label><input id="form-context-summary" className="bridge-input" value={formContextSummary} onChange={(event) => setFormContextSummary(event.target.value)} placeholder="For example: council tax reduction application, school admission, or disability-rights information form" /></div><button className="bridge-button danger" type="button" onClick={removeCurrentForm}><Trash2 size={14} /> Remove this form</button></div>}{sourceMode === "link" && <div style={{ marginTop: "1rem" }}><label className="bridge-input-label" htmlFor="form-url">Public form link</label><input id="form-url" className="bridge-input" value={formUrl} onChange={(event) => { setFormUrl(event.target.value); if (!formContextSummary.trim()) setFormContextSummary("Public form link supplied for Bridge to map"); }} placeholder="https://www.gov.uk/... or a public council, school, employer, charity, or service form" /></div>}{sourceMode === "paste" && <div style={{ marginTop: "1rem" }}><label className="bridge-input-label" htmlFor="pasted-form">Paste form questions or instructions</label><textarea id="pasted-form" className="bridge-input bridge-textarea compact" value={pastedText} onChange={(event) => { setPastedText(event.target.value); if (!formContextSummary.trim()) setFormContextSummary("Pasted form copy supplied for Bridge to map"); }} placeholder="Paste the form sections, questions, or instructions here…" /></div>}</div>

          <div className="bridge-step"><div className="bridge-step-label"><span className="bridge-step-number">2</span> Add your context</div><p className="bridge-helper">What is this form for? Who is it about? What are you trying to explain, apply for, request, or challenge? You can write in fragments, examples, stories, or connected nodes.</p><label className="bridge-input-label" htmlFor="form-context">Your context in your own words</label><textarea id="form-context" className="bridge-input bridge-textarea" value={userContext} onChange={(event) => setUserContext(event.target.value)} placeholder="For example: I am autistic and ADHD and need to complete a PIP form. These are the areas where daily life is difficult, and this is what I need the form to understand…" /></div>

          <div className="bridge-step"><div className="bridge-step-label"><span className="bridge-step-number">3</span> Add supporting documents <span style={{ fontWeight: 400, color: "var(--bridge-muted)" }}>optional · up to twenty</span></div><p className="bridge-helper">Add letters, diaries, assessments, benefit decisions, school reports, CVs, job descriptions, immigration evidence, or any other source that helps Bridge ground an answer. You can remove and replace sources before mapping.</p><div className={`bridge-dropzone bridge-dropzone-compact ${supportDropActive ? "is-dragging" : ""}`} role="button" tabIndex={0} aria-label="Drop or choose up to twenty supporting documents" onClick={() => supportInputRef.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); supportInputRef.current?.click(); } }} onDragOver={(event) => { event.preventDefault(); setSupportDropActive(true); }} onDragLeave={() => setSupportDropActive(false)} onDrop={(event) => { event.preventDefault(); setSupportDropActive(false); void addSupportingDocuments(event.dataTransfer.files); }}><Upload size={21} aria-hidden="true" /><strong>{isImporting ? "Reading supporting context in this browser…" : "Drop supporting documents or screenshots here"}</strong><p>PDF, Word .docx, JPG, PNG, WebP, XML, EML, or text. Screens and scanned PDFs use browser OCR.</p><input ref={supportInputRef} type="file" multiple accept=".pdf,.doc,.docx,.txt,.md,.csv,.rtf,.html,.xml,.eml,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tif,.tiff,text/plain,text/markdown,text/csv,text/xml,message/rfc822,application/pdf,application/rtf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp,image/gif,image/bmp,image/tiff" style={{ display: "none" }} onChange={(event) => void addSupportingDocuments(event.target.files ?? [])} /></div>{supportingDocuments.length > 0 && <div className="bridge-document-shelf" aria-label="Supporting document context">{supportingDocuments.map((document) => <article className="bridge-document-card" key={document.id}><FileText size={17} /><div><strong>{document.name}</strong><label className="bridge-input-note" htmlFor={`support-${document.id}`}>What does this help with? <span style={{ fontWeight: 400 }}>You can edit this context label.</span></label><input id={`support-${document.id}`} className="bridge-input" value={document.contextLabel} onChange={(event) => setSupportingDocuments((current) => current.map((item) => item.id === document.id ? { ...item, contextLabel: event.target.value } : item))} />{document.truncated && <span className="bridge-input-note">Bridge holds an opening and closing excerpt from this long source as context.</span>}</div><button className="bridge-button danger" type="button" aria-label={`Remove ${document.name}`} onClick={() => setSupportingDocuments((current) => current.filter((item) => item.id !== document.id))}><Trash2 size={14} /> Remove</button></article>)}</div>}</div>

          <div className="bridge-step"><div className="bridge-step-label"><span className="bridge-step-number">4</span> Build a form triage summary</div><p className="bridge-helper">Bridge will explain what the form is asking, sort the important sections into answered, partly answered, or needs clarification, and show the next smallest useful detail. Nothing is saved automatically.</p><div className="bridge-action-row"><button className="bridge-button primary" type="button" onClick={handleAnalyze} disabled={busy}>{triageMutation.isPending ? <><RotateCcw size={15} className="animate-spin" /> Building your triage…</> : <><Map size={15} /> Build editable triage summary</>}</button><span className="bridge-login-note">This creates a browser-held draft. Sign-in is not needed to use, copy, download, or clear it.</span><button className="bridge-button danger" type="button" onClick={clearSession}><Trash2 size={15} /> Clear this session</button></div></div>
          {triageMutation.isPending && <section className="bridge-processing" role="status" aria-live="polite"><Hourglass size={26} aria-hidden="true" /><div><strong>Please wait while Bridge summarises your uploads.</strong><p>Bridge is reading the form, your context, and the selected supporting sources. You can stay on this page; no account is needed and nothing is being saved automatically.</p></div></section>}
          <section className="bridge-result-card" aria-label="Forms results actions" style={{ marginTop: "1.25rem" }}><h3><Download size={16} /> Your results: copy, download, save, or clear</h3>{triage ? <><p className="bridge-input-note" style={{ lineHeight: 1.7 }}>The editable triage and answer list below can be copied or downloaded in the same three formats as Bridge Translate. <strong>Saving is optional.</strong></p><div className="bridge-action-row"><button className="bridge-button soft" type="button" onClick={() => { void navigator.clipboard.writeText(triage); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied triage" : "Copy triage"}</button><button className="bridge-button ghost" type="button" onClick={() => downloadWord(formTitle || "Bridge form triage", triage, [])}><Download size={14} /> Word</button><button className="bridge-button ghost" type="button" onClick={() => downloadFile("bridge-form-triage.txt", triage, "text/plain;charset=utf-8")}><Download size={14} /> TXT</button><button className="bridge-button ghost" type="button" onClick={() => downloadPdf(formTitle || "Bridge form triage", triage, [])}><Download size={14} /> PDF</button><button className="bridge-button primary" type="button" onClick={handleSaveWorkspace} disabled={saveWorkspaceMutation.isPending}>{saveWorkspaceMutation.isPending ? <><RotateCcw size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> {isAuthenticated ? savedSessionId ? "Save prompt changes" : "Save working prompt" : "Sign in to save prompt"}</>}</button>{answerList && <button className="bridge-button danger" type="button" onClick={() => setAnswerList("")}><Trash2 size={14} /> Clear answer list</button>}<button className="bridge-button danger" type="button" onClick={clearSession}><Trash2 size={14} /> Clear this session</button></div><div className="bridge-banner" style={{ marginBottom: 0, marginTop: "1rem" }}><ShieldCheck size={16} style={{ flex: "none" }} /><span><strong>What optional save keeps:</strong> the form’s source name, your local form summary, your typed context, and your editable triage/answer list in your own account. <strong>What it does not keep:</strong> the uploaded form, supporting documents, their extracted text, or their files. Re-upload documents on a later visit if you want Bridge to use them again.</span></div></> : <p className="bridge-input-note" style={{ marginBottom: 0 }}>Build the editable triage first. Its copy, Word, TXT, PDF, optional-save, answer-list clear, and session-clear controls will appear here.</p>}</section>
          {uiError && <div className="bridge-banner high-stakes" role="alert"><X size={16} style={{ flex: "none", marginTop: ".1rem" }} /><span>{uiError}</span></div>}

          {triage && <div id="form-review" className="bridge-result" style={{ marginTop: "2rem" }}><div className="bridge-result-card"><h3><Clipboard size={16} /> Your editable form triage summary</h3><p className="bridge-input-note" style={{ margin: "0 0 .8rem", lineHeight: 1.7 }}>This is a working map, not a completed official form. Edit it freely, use it to understand the next question, then copy the relevant bits into the official form when you are ready.</p><textarea className="bridge-output" style={{ minHeight: "34rem" }} value={triage} onChange={(event) => setTriage(event.target.value)} aria-label="Editable form triage summary" /><div className="bridge-action-row"><button className="bridge-button soft" type="button" onClick={() => { void navigator.clipboard.writeText(triage); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}</button><button className="bridge-button ghost" type="button" onClick={() => downloadWord(formTitle || "Bridge form triage", triage, [])}><Download size={14} /> Word</button><button className="bridge-button ghost" type="button" onClick={() => downloadFile("bridge-form-triage.txt", triage, "text/plain;charset=utf-8")}><Download size={14} /> TXT</button><button className="bridge-button ghost" type="button" onClick={() => downloadPdf(formTitle || "Bridge form triage", triage, [])}><Download size={14} /> PDF</button><button className="bridge-button danger" type="button" onClick={clearSession}><Trash2 size={14} /> Clear this session</button><button className="bridge-button soft" type="button" onClick={handleUpdateTriage} disabled={busy}>{triageMutation.isPending ? <><RotateCcw size={15} className="animate-spin" /> Updating…</> : <><RotateCcw size={15} /> Update triage with my edits</>}</button></div></div><div className="bridge-result-card bridge-triage-next"><h3><Sparkles size={16} /> Keep the working map moving</h3><p className="bridge-input-note" style={{ lineHeight: 1.7 }}>After you edit the triage or remember another detail, use <strong>Update triage with my edits</strong>. When the map is useful enough, create a separate answer list for final copy-and-paste into the official form.</p><button className="bridge-button primary" type="button" onClick={handleGenerateAnswerList} disabled={busy}>{answerListMutation.isPending ? <><RotateCcw size={15} className="animate-spin" /> Generating list…</> : <><Clipboard size={15} /> Generate copy-and-paste answers</>}</button><div className="bridge-banner" style={{ marginTop: "1rem", marginBottom: 0 }}><ShieldCheck size={16} style={{ flex: "none" }} /><span>Bridge does not submit official forms or decide eligibility. Check names, dates, evidence, and wording before using anything externally.</span></div></div></div>}

          {questions.length > 0 && <div id="form-review" className="bridge-result" style={{ marginTop: "2rem" }}><div className="bridge-result-card"><h3><Clipboard size={16} /> Form summary and answer map</h3><p className="bridge-input-note" style={{ lineHeight: 1.7 }}>{sourceSummary || "Bridge has mapped the available questions and context."}</p><div className="bridge-banner" style={{ marginBottom: ".8rem" }}><Check size={16} style={{ flex: "none" }} /><span><strong>{questions.length - unanswered.length} question{questions.length - unanswered.length === 1 ? "" : "s"} have a drafted answer.</strong> {unanswered.length ? `${unanswered.length} still need information or your review.` : "All extracted questions have a draft for your review."}</span></div>{(unanswered.length > 0 || missing.length > 0) && <div className="bridge-banner high-stakes"><HelpCircle size={16} style={{ flex: "none" }} /><div><strong>What the form still needs</strong><ul style={{ margin: ".35rem 0 0 1.2rem", padding: 0 }}>{unanswered.slice(0, 30).map((question) => <li key={question.id}>{question.label}{question.helpText ? ` — ${question.helpText}` : ""}</li>)}{missing.filter((item) => !unanswered.some((question) => item.includes(question.label))).map((item, index) => <li key={`gap-${index}`}>{item}</li>)}</ul></div></div>}<div style={{ marginTop: "1rem" }}><label className="bridge-input-label" htmlFor="form-addition">Add or correct context <span style={{ fontWeight: 400, color: "var(--bridge-muted)" }}>optional</span></label><textarea id="form-addition" className="bridge-input bridge-textarea compact" value={additionalContext} onChange={(event) => setAdditionalContext(event.target.value)} placeholder="Add a missing answer, reference number, correction, or new detail, then ask Bridge to update supported fields…" /><div className="bridge-action-row"><button className="bridge-button soft" type="button" onClick={handleRefine} disabled={busy || !additionalContext.trim()}>{refineMutation.isPending ? <><RotateCcw size={15} className="animate-spin" /> Updating answers…</> : <><Sparkles size={15} /> Update supported answers</>}</button><button className="bridge-button danger" type="button" onClick={clearSession}><Trash2 size={15} /> Clear this session</button></div></div></div><div className="bridge-result-card"><h3><ShieldCheck size={16} /> Review before using</h3><p className="bridge-input-note" style={{ lineHeight: 1.7 }}>Check every name, date, number, statement, and requested outcome against your source documents before copying answers into the official form.</p><div className="bridge-banner" style={{ marginBottom: 0 }}><ShieldCheck size={16} style={{ flex: "none" }} /><span>Bridge prepares editable answers. It cannot submit official forms or decide eligibility.</span></div></div></div>}

          {questions.length > 0 && <div className="bridge-result-card" style={{ marginTop: "1rem" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}><div><h3 style={{ marginBottom: ".2rem" }}><Sparkles size={16} /> Your editable form answers</h3><p className="bridge-input-note" style={{ margin: 0 }}>Edit anything. The output is for copy-and-paste or use alongside the official form.</p></div><div className="bridge-action-row" style={{ margin: 0 }}><button className="bridge-button soft" type="button" onClick={() => void handleCopyAll()}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy all"}</button><button className="bridge-button ghost" type="button" onClick={() => downloadWord(formTitle, sourceSummary, questions)}><Download size={14} /> Word</button><button className="bridge-button ghost" type="button" onClick={() => downloadFile("bridge-form-answers.txt", answersAsText(formTitle, sourceSummary, questions), "text/plain;charset=utf-8")}><Download size={14} /> TXT</button><button className="bridge-button ghost" type="button" onClick={() => downloadPdf(formTitle, sourceSummary, questions)}><Download size={14} /> PDF</button><button className="bridge-button primary" type="button" onClick={handleSave} disabled={saveMutation.isPending || updateMutation.isPending}>{saveMutation.isPending || updateMutation.isPending ? <><RotateCcw size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> {isAuthenticated ? savedSessionId ? "Save updates" : "Save to my account" : "Sign in to save"}</>}</button><button className="bridge-button danger" type="button" onClick={clearSession}><Trash2 size={14} /> Clear this session</button></div></div><div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>{questions.map((question) => <div key={question.id} style={{ padding: "1rem", borderRadius: ".8rem", border: "1px solid rgba(102,84,126,.15)", background: "rgba(255,255,255,.6)" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: ".8rem", marginBottom: ".4rem" }}><label className="bridge-input-label" htmlFor={`q-${question.id}`} style={{ margin: 0, color: "var(--bridge-ink)", fontSize: ".98rem" }}>{question.section ? <span style={{ display: "block", color: "var(--bridge-muted)", fontSize: ".74rem", marginBottom: ".2rem" }}>{question.section}</span> : null}{question.label} {question.required && <span style={{ color: "#a85454" }}>*</span>}</label><span className={`bridge-status ${question.status}`} style={{ fontSize: ".68rem", padding: ".15rem .5rem", borderRadius: "1rem", background: question.status === "answered" ? "rgba(111,154,126,.18)" : "rgba(168,84,84,.14)", color: question.status === "answered" ? "#426851" : "#8d3b3b" }}>{question.status}</span></div>{question.prompt !== question.label && <p className="bridge-helper" style={{ margin: "0 0 .4rem" }}>{question.prompt}</p>}{question.helpText && <p style={{ margin: "0 0 .5rem", fontSize: ".8rem", color: "#8d73a8", fontStyle: "italic" }}>What it still needs: {question.helpText}</p>}<textarea id={`q-${question.id}`} className="bridge-input bridge-textarea compact" value={question.answer} onChange={(event) => updateAnswer(question.id, event.target.value)} placeholder="Write or edit the answer here…" /></div>)}</div></div>}

          {isAuthenticated && <div className="bridge-history" style={{ marginTop: "2rem" }}><div className="bridge-section-heading" style={{ marginBottom: ".75rem" }}><h2 className="serif" style={{ fontSize: "1.7rem" }}><History size={19} style={{ verticalAlign: "-2px", marginRight: ".35rem" }} /> Your saved form sessions</h2></div>{historyQuery.data?.length ? <div className="bridge-history-list">{(historyQuery.data as SavedFormSession[]).map((item) => <div className="bridge-history-item" key={item.id}><button type="button" onClick={() => openSavedSession(item)} style={{ flex: 1, border: 0, background: "transparent", textAlign: "left", cursor: "pointer", padding: 0 }}><strong>{item.formTitle}</strong><span>{item.sourceName || "Form source"} · {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "Saved form"}</span></button><button className="bridge-button danger" type="button" aria-label={`Delete ${item.formTitle}`} onClick={() => { if (window.confirm("Delete this saved Form session from Bridge?")) deleteMutation.mutate({ id: item.id }); }}><Trash2 size={14} /> Delete</button></div>)}</div> : <p className="bridge-empty">No saved Forms yet. Guest work is not added automatically.</p>}</div>}
        </div></section>
        {answerList && <section id="form-answer-list" className="bridge-forms-follow-up"><div><h2 className="serif">Editable copy-and-paste answer list</h2><p>This is a working aid for the official form beside you. Check every factual detail before copying it anywhere.</p><textarea className="bridge-output" style={{ minHeight: "30rem" }} value={answerList} onChange={(event) => setAnswerList(event.target.value)} aria-label="Editable copy-and-paste answer list" /><div className="bridge-action-row"><button className="bridge-button soft" type="button" onClick={() => { void navigator.clipboard.writeText(answerList); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy answer list"}</button><button className="bridge-button ghost" type="button" onClick={() => downloadWord(`${formTitle || "Bridge form"} answer list`, answerList, [])}><Download size={14} /> Word</button><button className="bridge-button ghost" type="button" onClick={() => downloadFile("bridge-copy-and-paste-answers.txt", answerList, "text/plain;charset=utf-8")}><Download size={14} /> TXT</button><button className="bridge-button ghost" type="button" onClick={() => downloadPdf(`${formTitle || "Bridge form"} answer list`, answerList, [])}><Download size={14} /> PDF</button><button className="bridge-button danger" type="button" onClick={() => setAnswerList("")}><Trash2 size={14} /> Delete answer list</button></div></div></section>}
        {triage && <section className="bridge-forms-support" aria-label="Optional support"><div><p className="bridge-eyebrow">Optional support after you have tried Bridge</p><h2 className="serif">Keep this free tool growing</h2><p>Bridge is free to use. If this practice run reduced friction, optional support helps Ree keep building accessible tools, advocacy resources, and workable systems.</p></div><div className="bridge-action-row"><a className="bridge-button primary" href="https://manus.im/invitation/6QV3G5TW9PK0W?utm_source=invitation&utm_medium=social&utm_campaign=copy_link" target="_blank" rel="noreferrer">Try Manus · 500 credits each</a><a className="bridge-button mint" href="https://gofund.me/5f42ef66c" target="_blank" rel="noreferrer">Support on GoFundMe</a></div></section>}
      </main>
      <footer className="bridge-shell bridge-footer"><span>Bridge Forms · form answers without the friction</span><span className="bridge-future">Next on the map: Evidence · Voice · Coach · API</span></footer>
    </div>
  );
}
