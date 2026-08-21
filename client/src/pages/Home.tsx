import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import { Link } from "wouter";
import { jsPDF } from "jspdf";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { extractLocalDocumentText, suggestDocumentContextLabel } from "@/lib/documentText";
import { budgetDocumentContext, type ContextDocument } from "@/lib/documentContextBudget";
import { OUTPUT_FEEDBACK } from "@/lib/outputFeedback";
import {
  ArrowRight, AudioLines, BrainCircuit, Check, Clipboard, Clock3, Copy, Download,
  FileText, History, Leaf, LockKeyhole, Mail, Map, MessageCircle, Mic, MicOff,
  RotateCcw, Save, ShieldCheck, Sparkles, Trash2, Upload, WandSparkles, X,
} from "lucide-react";

const TRAITS = ["Think in maps or connected systems", "Know the pattern before the route", "Meaning arrives as examples or stories", "Need time to find the noun", "Write in fragments first", "Need context kept intact", "Prefer direct, plain language", "Need one step at a time", "Words are easier after a pause", "Energy or task-starting varies"];

type IconComponent = ComponentType<{ size?: number; strokeWidth?: number }>;
type GuestDraft = {
  traits: string[]; profileDescription: string; sourceText: string; purpose: string;
  outputStyle: string; extraContext: string; preserveEmotion: boolean; meaningMap: string; translation: string;
};

type DocumentContext = ContextDocument;

const DESTINATIONS: Array<{ label: string; icon: IconComponent; highStakes?: boolean }> = [
  { label: "Clear and structured professional letter", icon: FileText, highStakes: true },
  { label: "Private message or WhatsApp", icon: MessageCircle },
  { label: "Public or social-media post", icon: WandSparkles },
  { label: "Help me say this", icon: BrainCircuit },
  { label: "Simple timeline", icon: Clock3 },
  { label: "Direct email or inquiry", icon: Mail },
  { label: "Action plan or next steps list", icon: Leaf },
];

const STYLES = ["Clear and neutral", "Warm and collaborative", "Professional", "Formal", "Very concise", "Detailed", "Bullet points", "Easy Read"];
const GUEST_DRAFT_KEY = "bridge-guest-draft-to-save-v1";

function downloadFile(filename: string, content: BlobPart, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadWord(text: string) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Bridge translation</title></head><body><h1>Bridge translation</h1>${text.split("\n").map((line) => `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") || "&nbsp;"}</p>`).join("")}</body></html>`;
  downloadFile("bridge-translation.doc", html, "application/msword");
}

function downloadPdf(text: string) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const lines = pdf.splitTextToSize(text, pageWidth - margin * 2);
  let y = margin;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  lines.forEach((line: string) => {
    if (y > pageHeight - margin) { pdf.addPage(); y = margin; }
    pdf.text(line, margin, y);
    y += 16;
  });
  pdf.save("bridge-translation.pdf");
}

function goToWorkspace() {
  document.getElementById("bridge-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const utils = trpc.useUtils();
  const [traits, setTraits] = useState<string[]>([]);
  const [profileDescription, setProfileDescription] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [purpose, setPurpose] = useState(DESTINATIONS[0].label);
  const [outputStyle, setOutputStyle] = useState(STYLES[0]);
  const [extraContext, setExtraContext] = useState("");
  const [mapAddition, setMapAddition] = useState("");
  const [preserveEmotion, setPreserveEmotion] = useState(true);
  const [meaningMap, setMeaningMap] = useState("");
  const [translation, setTranslation] = useState("");
  const [stage, setStage] = useState<"input" | "mapped" | "final">("input");
  const [uiError, setUiError] = useState("");
  const [comingSoon, setComingSoon] = useState("");
  const [copied, setCopied] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isImportingDocument, setIsImportingDocument] = useState(false);
  const [restoredForSave, setRestoredForSave] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const translationFileInputRef = useRef<HTMLInputElement>(null);
  const [translationDropActive, setTranslationDropActive] = useState(false);
  const [documentContext, setDocumentContext] = useState<DocumentContext[]>([]);
  const [showOutputFeedback, setShowOutputFeedback] = useState(false);

  const historyQuery = trpc.history.list.useQuery(undefined, { enabled: isAuthenticated });
  const profileQuery = trpc.profiles.list.useQuery(undefined, { enabled: isAuthenticated });
  const mapMutation = trpc.translate.mapMeaning.useMutation({
    onSuccess: (data) => { setMeaningMap(data.meaningMap); setStage("mapped"); setUiError(""); setTimeout(() => document.getElementById("meaning-map")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50); },
    onError: (error) => setUiError(error.message),
  });
  const finalizeMutation = trpc.translate.finalize.useMutation({
    onSuccess: (data) => { setTranslation(data.translation); setStage("final"); setUiError(""); setTimeout(() => document.getElementById("translation-result")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50); },
    onError: (error) => setUiError(error.message),
  });
  const saveTranslationMutation = trpc.translate.save.useMutation({
    onSuccess: async () => { await utils.history.list.invalidate(); sessionStorage.removeItem(GUEST_DRAFT_KEY); setRestoredForSave(false); setUiError(""); },
    onError: (error) => setUiError(error.message),
  });
  const transcribeMutation = trpc.voice.transcribe.useMutation({
    onSuccess: (data) => { setSourceText((current) => `${current}${current ? "\n\n" : ""}${data.text}`); setIsTranscribing(false); setUiError(""); },
    onError: (error) => { setIsTranscribing(false); setUiError(error.message); },
  });
  const saveProfileMutation = trpc.profiles.save.useMutation({ onSuccess: async () => { await utils.profiles.list.invalidate(); setUiError(""); }, onError: (error) => setUiError(error.message) });
  const deleteHistoryMutation = trpc.history.delete.useMutation({ onSuccess: () => utils.history.list.invalidate() });
  const clearHistoryMutation = trpc.history.clear.useMutation({ onSuccess: () => utils.history.list.invalidate() });
  const deleteSavedDataMutation = trpc.account.deleteSavedData.useMutation({ onSuccess: async () => { await Promise.all([utils.history.list.invalidate(), utils.profiles.list.invalidate()]); setUiError(""); }, onError: (error) => setUiError(error.message) });

  const selectedDestination = DESTINATIONS.find((item) => item.label === purpose) ?? DESTINATIONS[0];
  const busy = mapMutation.isPending || finalizeMutation.isPending || saveTranslationMutation.isPending || isTranscribing;

  useEffect(() => {
    if (!isAuthenticated) return;
    const raw = sessionStorage.getItem(GUEST_DRAFT_KEY);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as GuestDraft;
      setTraits(draft.traits); setProfileDescription(draft.profileDescription); setSourceText(draft.sourceText);
      setPurpose(draft.purpose); setOutputStyle(draft.outputStyle); setExtraContext(draft.extraContext);
      setPreserveEmotion(draft.preserveEmotion); setMeaningMap(draft.meaningMap); setTranslation(draft.translation);
      setStage("final"); setRestoredForSave(true);
      setTimeout(() => document.getElementById("translation-result")?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
    } catch { sessionStorage.removeItem(GUEST_DRAFT_KEY); }
  }, [isAuthenticated]);

  function currentDraft(): GuestDraft {
    return { traits, profileDescription, sourceText, purpose, outputStyle, extraContext, preserveEmotion, meaningMap, translation };
  }

  function clearSession() {
    if (!window.confirm("Clear this guest session? Any files you have already downloaded will stay on your device.")) return;
    sessionStorage.removeItem(GUEST_DRAFT_KEY);
    setTraits([]); setProfileDescription(""); setSourceText(""); setDocumentContext([]); setPurpose(DESTINATIONS[0].label); setOutputStyle(STYLES[0]); setExtraContext(""); setMapAddition(""); setPreserveEmotion(true); setMeaningMap(""); setTranslation(""); setStage("input"); setRestoredForSave(false); setUiError("");
  }

  function beginSaveLogin() {
    sessionStorage.setItem(GUEST_DRAFT_KEY, JSON.stringify(currentDraft()));
    startLogin();
  }

  function handleSaveTranslation() {
    if (!translation || !meaningMap) return;
    if (!isAuthenticated) { beginSaveLogin(); return; }
    saveTranslationMutation.mutate({ ...currentDraft(), meaningMap, translation });
  }

  function toggleTrait(trait: string) { setTraits((current) => current.includes(trait) ? current.filter((item) => item !== trait) : [...current, trait]); }
  async function addDocumentContext(files: FileList | File[]) {
    const availableSlots = 10 - documentContext.length;
    const selected = Array.from(files).slice(0, availableSlots);
    if (!selected.length) { setUiError("You can keep up to ten document sources in this context shelf. Remove one to add another."); return; }
    setIsImportingDocument(true); setUiError("");
    const added: DocumentContext[] = [];
    const errors: string[] = [];
    try {
      for (const file of selected) {
        try {
          const imported = await extractLocalDocumentText(file);
          if (!imported.text.trim()) throw new Error("No readable text was found in this document.");
          added.push({ id: crypto.randomUUID(), name: file.name, contextLabel: suggestDocumentContextLabel(file.name, imported.text), text: imported.text, truncated: imported.truncated });
        } catch (error) {
          errors.push(`${file.name}: ${error instanceof Error ? error.message : "Bridge could not read this document."}`);
        }
      }
      if (added.length) setDocumentContext((current) => [...current, ...added].slice(0, 10));
      if (errors.length) setUiError(errors.join(" "));
      else if (selected.length < Array.from(files).length) setUiError("Bridge added the first ten documents. Remove one before adding another.");
    } finally {
      setIsImportingDocument(false);
      if (translationFileInputRef.current) translationFileInputRef.current.value = "";
    }
  }
  function handleTranslationDrop(event: React.DragEvent<HTMLDivElement>) { event.preventDefault(); setTranslationDropActive(false); void addDocumentContext(event.dataTransfer.files); }
  function saveCurrentProfile() {
    if (!isAuthenticated) { setUiError("Profiles are optional. Sign in only if you want to save this one in your account."); return; }
    const name = window.prompt("Name this communication profile", traits.length ? traits.join(" + ") : "My Bridge profile");
    if (name?.trim()) saveProfileMutation.mutate({ name: name.trim(), traits, description: profileDescription });
  }
  function handleMap() {
    if (!sourceText.trim()) { setUiError("Add your account in your own words first. Fragments and tangents are welcome."); return; }
    setUiError(""); setStage("input"); mapMutation.mutate({ sourceText, documentContext: budgetDocumentContext(documentContext), traits, profileDescription, purpose, outputStyle, extraContext, preserveEmotion });
  }
  function handleFinalize() {
    if (!meaningMap.trim()) { setUiError("Review the meaning map first, then confirm or edit it before drafting the output."); return; }
    setUiError(""); finalizeMutation.mutate({ sourceText, documentContext: budgetDocumentContext(documentContext), traits, profileDescription, purpose, outputStyle, extraContext, preserveEmotion, meaningMap });
  }
  function handleMapAddition() {
    if (!mapAddition.trim()) { setUiError("Add the detail, correction, reference, or clarification you want Bridge to include first."); return; }
    const updatedExtraContext = [extraContext.trim(), `Additional context added during meaning-map review:\n${mapAddition.trim()}`].filter(Boolean).join("\n\n");
    setExtraContext(updatedExtraContext); setMapAddition(""); setTranslation(""); setUiError("");
    mapMutation.mutate({ sourceText, documentContext: budgetDocumentContext(documentContext), traits, profileDescription, purpose, outputStyle, extraContext: updatedExtraContext, preserveEmotion });
  }
  async function handleCopy() {
    if (!translation) return;
    await navigator.clipboard.writeText(translation); setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  }
  async function blobToDataUrl(blob: Blob) { return await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onloadend = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); }); }
  async function startRecording() {
    if (!isAuthenticated) { setUiError("Voice input currently needs sign-in because recordings pass through temporary storage. You can still type or paste without an account."); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setUiError("Voice input is not available in this browser. You can still type or paste your words."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onstop = async () => { stream.getTracks().forEach((track) => track.stop()); const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }); setIsTranscribing(true); transcribeMutation.mutate({ audioBase64: await blobToDataUrl(blob), mimeType: (recorder.mimeType || "audio/webm").split(";")[0] as "audio/webm" | "audio/mp4" | "audio/mpeg" | "audio/wav" | "audio/ogg" | "audio/x-m4a", language: "en" }); };
      recorder.start(); recorderRef.current = recorder; setIsRecording(true); setUiError("");
    } catch { setUiError("The microphone could not be opened. Check your browser permission, or type instead."); }
  }
  function stopRecording() { recorderRef.current?.stop(); setIsRecording(false); }
  function loadHistory(item: { traitsJson: string; profileDescription: string | null; sourceText: string; purpose: string; outputStyle: string; extraContext: string | null; meaningMap: string | null; translation: string }) {
    try { setTraits(JSON.parse(item.traitsJson) as string[]); } catch { setTraits([]); }
    setProfileDescription(item.profileDescription ?? ""); setSourceText(item.sourceText); setPurpose(item.purpose); setOutputStyle(item.outputStyle); setExtraContext(item.extraContext ?? ""); setMeaningMap(item.meaningMap ?? ""); setTranslation(item.translation); setStage("final"); goToWorkspace();
  }

  return (
    <div className="bridge-page">
      <header className="bridge-shell bridge-header">
        <a className="bridge-brand" href="#top" aria-label="Bridge home"><span className="bridge-mark"><img className="bridge-mark-image" src="/wobblywanderer-32.png" alt="" /></span><span className="bridge-brand-word">BRIDGE</span></a>
        <div className="bridge-header-note"><span className="bridge-dot" /> meaning stays yours</div>
        <div className="bridge-action-row" style={{ marginTop: 0 }}>
          {isAuthenticated ? <button className="bridge-button ghost" onClick={() => void logout()}>{user?.name ? `Sign out · ${user.name.split(" ")[0]}` : "Sign out"}</button> : <button className="bridge-button ghost" onClick={() => startLogin()}>{loading ? "Checking…" : "Sign in to save"}</button>}
        </div>
      </header>

      <main id="top" className="bridge-shell">
        <section className="bridge-hero" aria-labelledby="bridge-title">
          <div><p className="bridge-eyebrow">A translation layer for real people</p><h1 id="bridge-title" className="serif">Bring the map.<br />Cross the bridge.</h1><p className="bridge-hero-copy">Bridge carries your meaning from natural, connected communication into a clear form another person, service, or institution can understand.</p><div className="bridge-hero-actions"><button className="bridge-button primary" onClick={goToWorkspace}>Try Bridge now <ArrowRight size={16} /></button><span className="bridge-login-note"><LockKeyhole size={14} style={{ verticalAlign: "-2px", marginRight: ".3rem" }} /> No account needed to try, copy, or download.</span></div></div>
          <div className="bridge-hero-visual" aria-hidden="true"><div className="bridge-orbit" /><div className="bridge-map-card"><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".65rem" }}><span className="bridge-eyebrow" style={{ margin: 0, fontSize: ".64rem" }}>meaning map</span><Map size={18} color="var(--bridge-plum)" /></div><h3 className="serif">A route through the story</h3><p>Connected details become a sequence without losing the relationships that made them matter.</p><div className="bridge-map-lines"><span className="bridge-map-line" /><span className="bridge-map-line" /><span className="bridge-map-line" /></div></div><div className="bridge-map-tag">your words · their format</div></div>
        </section>

        <section className="bridge-section" aria-labelledby="start-title">
          <div className="bridge-section-heading"><div><p className="bridge-eyebrow">Choose your crossing</p><h2 id="start-title" className="serif">Start with the job<br />you actually have.</h2></div><p>Translate a message, complete the exact form you were sent, or start an evidence trail. No sprawling catalogue required.</p></div>
          <div className="bridge-card-grid">
            <button type="button" className="bridge-card bridge-module-button" onClick={goToWorkspace}><div className="bridge-card-icon"><Map size={19} /></div><h3>Bridge Translate <span className="bridge-live">live</span></h3><p>Turn your natural account into a clear draft, simple timeline, message, or post.</p></button>
            <Link href="/forms" className="bridge-card bridge-module-button" style={{ display: "block", textDecoration: "none" }}><div className="bridge-card-icon"><Clipboard size={19} /></div><h3>Bridge Forms <span className="bridge-live">live</span></h3><p>Paste the exact form link or upload your own copy, then answer naturally.</p></Link>
            <Link href="/evidence" className="bridge-card bridge-module-button" style={{ display: "block", textDecoration: "none" }}><div className="bridge-card-icon"><Clock3 size={19} /></div><span className="bridge-development-status">In development · not live yet</span><h3>Bridge Evidence</h3><p>Try the limited local download-only prototype; it is not yet a live evidence-storage or timeline service.</p></Link>
          </div>
        </section>

        <section className="bridge-section" aria-labelledby="how-it-helps"><div className="bridge-section-heading"><h2 id="how-it-helps" className="serif">Less translation friction.<br />More meaningful participation.</h2><p>Short, respectful scaffolding for the moments when a system expects a shape your thoughts did not arrive in.</p></div><div className="bridge-card-grid"><article className="bridge-card"><div className="bridge-card-icon"><BrainCircuit size={19} /></div><h3>Your language is valid</h3><p>Tangents, fragments, metaphors, and functional descriptions are welcome input.</p></article><article className="bridge-card"><div className="bridge-card-icon" style={{ background: "var(--bridge-blush)" }}><Sparkles size={19} /></div><h3>The map comes first</h3><p>Bridge checks the meaning before it drafts the outside version.</p></article><article className="bridge-card"><div className="bridge-card-icon" style={{ background: "var(--bridge-mint)" }}><ShieldCheck size={19} /></div><h3>You keep the pen</h3><p>Every result stays editable. Nothing is ready to send until you decide it is.</p></article></div></section>

        <section id="bridge-workspace" className="bridge-workspace" aria-labelledby="workspace-title"><div className="bridge-workspace-shell">
          <div className="bridge-workspace-top"><div><p className="bridge-eyebrow">Bridge Translate · guest-friendly</p><h2 id="workspace-title" className="serif">Start where you are.</h2><p>No need to organise the story before you bring it here. You can map, edit, copy, download, or clear this session without an account.</p></div></div>
          <div className="bridge-banner"><ShieldCheck size={16} style={{ flex: "none" }} /><span><strong>Try first; save only if you choose.</strong> Guest work is not added to Bridge history. Sign in only when you want to keep a crossing in your own account. Do not add passwords, bank-card details, or someone else’s private information unless you have a clear right to use it.</span></div>
          <div className="bridge-step"><div className="bridge-step-label"><span className="bridge-step-number">1</span> Help Bridge understand how your words arrive</div><p className="bridge-helper">Choose any descriptions that fit, or skip straight to your own words. No label or diagnosis is needed.</p><div className="bridge-chip-grid" role="group" aria-label="Communication pattern descriptions">{TRAITS.map((trait) => <button key={trait} type="button" className="bridge-chip" aria-pressed={traits.includes(trait)} onClick={() => toggleTrait(trait)}>{traits.includes(trait) && <Check size={13} style={{ marginRight: ".25rem", verticalAlign: "-2px" }} />}{trait}</button>)}</div><div style={{ marginTop: "1rem" }}><label className="bridge-input-label" htmlFor="profile-description">Describe anything else in your own words <span style={{ fontWeight: 400, color: "var(--bridge-muted)" }}>optional</span></label><textarea id="profile-description" className="bridge-input bridge-textarea compact" value={profileDescription} onChange={(event) => setProfileDescription(event.target.value)} placeholder="For example: I think in maps, I know the pattern before I can explain the route, or I lose nouns but not meaning." /><div className="bridge-action-row"><button className="bridge-button soft" type="button" onClick={saveCurrentProfile}><Save size={15} /> Save this profile</button>{profileQuery.data && profileQuery.data.length > 0 && <span className="bridge-input-note">{profileQuery.data.length} saved profile{profileQuery.data.length === 1 ? "" : "s"} available in your account.</span>}</div></div></div>
          <div className="bridge-step"><div className="bridge-step-label"><span className="bridge-step-number">2</span> Add document context <span style={{ fontWeight: 400, color: "var(--bridge-muted)" }}>optional · up to ten</span></div><p className="bridge-helper">Documents are background context for Bridge. They stay separate from your own words and are not saved to Bridge. Screenshots and scanned PDFs are read with browser OCR.</p><div className={`bridge-dropzone ${translationDropActive ? "is-dragging" : ""}`} role="button" tabIndex={0} aria-label="Drop or choose up to ten documents, screenshots, or scans for Bridge Translate context" onClick={() => translationFileInputRef.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); translationFileInputRef.current?.click(); } }} onDragOver={(event) => { event.preventDefault(); setTranslationDropActive(true); }} onDragLeave={() => setTranslationDropActive(false)} onDrop={handleTranslationDrop}><Upload size={21} aria-hidden="true" /><strong>{isImportingDocument ? "Reading your document context…" : "Drop up to ten documents or screenshots here"}</strong><p>{isImportingDocument ? "Bridge is extracting text in this browser; your sources are not saved to Bridge." : "PDF, Word .docx, JPG, PNG, WebP, XML, EML, or text. Scans and screenshots use OCR; all sources stay separate from your request."}</p><input ref={translationFileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.txt,.md,.csv,.rtf,.html,.xml,.eml,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tif,.tiff,text/plain,text/markdown,text/csv,text/xml,message/rfc822,application/pdf,application/rtf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp,image/gif,image/bmp,image/tiff" style={{ display: "none" }} onChange={(event) => void addDocumentContext(event.target.files ?? [])} /></div>{documentContext.length > 0 && <div className="bridge-document-shelf" aria-label="Attached document context">{documentContext.map((document) => <article className="bridge-document-card" key={document.id}><FileText size={17} /><div><strong>{document.name}</strong><label className="bridge-input-note" htmlFor={`context-${document.id}`}>What is this document? <span style={{ fontWeight: 400 }}>You can edit this context label.</span></label><input id={`context-${document.id}`} className="bridge-input" value={document.contextLabel} onChange={(event) => setDocumentContext((current) => current.map((item) => item.id === document.id ? { ...item, contextLabel: event.target.value } : item))} />{document.truncated && <span className="bridge-input-note">Bridge holds an opening and closing excerpt from this very long document as context.</span>}</div><button className="bridge-button danger" type="button" aria-label={`Remove ${document.name}`} onClick={() => setDocumentContext((current) => current.filter((item) => item.id !== document.id))}><Trash2 size={14} /> Remove</button></article>)}</div>}<div className="bridge-step-label" style={{ marginTop: "1.2rem" }}><span className="bridge-step-number">3</span> Say it in your own words</div><p className="bridge-helper">This box is for what is happening and what you need now. Fragments, repetition, emotion, uncertain dates, tangents, and relational descriptions are allowed.</p><label className="bridge-input-label" htmlFor="natural-input">Your natural input</label><textarea id="natural-input" className="bridge-input bridge-textarea" value={sourceText} onChange={(event) => setSourceText(event.target.value)} placeholder="Start with what you need Bridge to do with the document context. You do not need to be linear, polished, or organised first…" /><div className="bridge-action-row">{!isRecording ? <button className="bridge-button mint" type="button" onClick={() => void startRecording()} disabled={busy}><Mic size={15} /> Speak instead</button> : <button className="bridge-button danger" type="button" onClick={stopRecording}><MicOff size={15} /> Stop and transcribe</button>}{isTranscribing && <span className="bridge-input-note"><AudioLines size={14} style={{ verticalAlign: "-2px", marginRight: ".3rem" }} /> Turning speech into text…</span>}<button className="bridge-button danger" type="button" onClick={clearSession}><Trash2 size={15} /> Clear this session</button></div></div>
          <div className="bridge-step"><div className="bridge-step-label"><span className="bridge-step-number">4</span> Choose where the meaning needs to go</div><div className="bridge-destination-grid" role="group" aria-label="Output purpose">{DESTINATIONS.map(({ label, icon: Icon }) => <button key={label} type="button" className="bridge-destination" aria-pressed={purpose === label} onClick={() => setPurpose(label)}><Icon size={17} /><span>{label}</span></button>)}</div><div style={{ marginTop: ".85rem" }}><button className="bridge-button soft" type="button" onClick={() => setShowOutputFeedback((current) => !current)} aria-expanded={showOutputFeedback} aria-controls="output-category-feedback"><Sparkles size={15} /> Think Bridge needs another output category?</button>{showOutputFeedback && <aside id="output-category-feedback" className="bridge-banner" style={{ marginTop: ".75rem" }}><Sparkles size={16} style={{ flex: "none", marginTop: ".1rem" }} /><div><strong>{OUTPUT_FEEDBACK.title}</strong><p className="bridge-input-note" style={{ margin: ".25rem 0 0", lineHeight: 1.6 }}>{OUTPUT_FEEDBACK.copy}</p><p className="bridge-input-note" style={{ margin: ".4rem 0 0", lineHeight: 1.6 }}>{OUTPUT_FEEDBACK.gardenNote}</p><div className="bridge-action-row" style={{ marginTop: ".65rem" }}>{OUTPUT_FEEDBACK.contacts.map((contact) => <a key={contact.label} className="bridge-button ghost" href={contact.href} target="_blank" rel="noreferrer">{contact.label} <ArrowRight size={14} /></a>)}</div></div></aside>}</div><div className="bridge-two-col" style={{ marginTop: "1rem" }}><div><label className="bridge-input-label" htmlFor="output-style">Output style</label><select id="output-style" className="bridge-select" value={outputStyle} onChange={(event) => setOutputStyle(event.target.value)}>{STYLES.map((style) => <option key={style}>{style}</option>)}</select></div><div><label className="bridge-input-label" htmlFor="extra-context">Extra context <span style={{ fontWeight: 400, color: "var(--bridge-muted)" }}>optional</span></label><input id="extra-context" className="bridge-input" value={extraContext} onChange={(event) => setExtraContext(event.target.value)} placeholder="Audience, deadline, word limit, desired outcome…" /></div></div><label className="bridge-input-note" style={{ display: "flex", alignItems: "center", gap: ".45rem", marginTop: "1rem", cursor: "pointer" }}><input type="checkbox" checked={preserveEmotion} onChange={(event) => setPreserveEmotion(event.target.checked)} /> Preserve emotional meaning where it helps the reader understand the impact.</label><div className="bridge-action-row"><button className="bridge-button primary" type="button" onClick={handleMap} disabled={busy}>{mapMutation.isPending ? <><RotateCcw size={15} className="animate-spin" /> Mapping your meaning…</> : <><Map size={15} /> Map my meaning</>}</button><span className="bridge-login-note">This creates a draft, not a saved record.</span></div></div>
          {uiError && <div className="bridge-banner high-stakes" role="alert"><X size={16} style={{ flex: "none", marginTop: ".1rem" }} /><span>{uiError}</span></div>}
          {stage !== "input" && <div id="meaning-map" className="bridge-result"><div className="bridge-result-card"><h3><Map size={16} /> Meaning map</h3><p className="bridge-input-note" style={{ margin: "0 0 .7rem" }}>Check this before Bridge drafts anything for the outside world. Edit freely.</p><textarea className="bridge-output" value={meaningMap} onChange={(event) => setMeaningMap(event.target.value)} aria-label="Meaning map to review" /><div style={{ marginTop: "1rem" }}><label className="bridge-input-label" htmlFor="map-addition">Add or correct context <span style={{ fontWeight: 400, color: "var(--bridge-muted)" }}>optional</span></label><textarea id="map-addition" className="bridge-input bridge-textarea compact" value={mapAddition} onChange={(event) => setMapAddition(event.target.value)} placeholder="A reference number, correction, new detail, clarification, or something Bridge has missed…" /><p className="bridge-input-note" style={{ marginTop: ".5rem" }}>Bridge will remap using this addition alongside your original words and document context. Nothing is sent or saved until you choose an action below.</p></div><div className="bridge-action-row"><button className="bridge-button soft" type="button" onClick={handleMapAddition} disabled={busy || !mapAddition.trim()}>{mapMutation.isPending ? <><RotateCcw size={15} className="animate-spin" /> Updating the map…</> : <><Map size={15} /> Update the meaning map</>}</button><button className="bridge-button primary" type="button" onClick={handleFinalize} disabled={busy}>{finalizeMutation.isPending ? <><RotateCcw size={15} className="animate-spin" /> Building draft…</> : <><ArrowRight size={15} /> Build the destination draft</>}</button><button className="bridge-button danger" type="button" onClick={clearSession}><Trash2 size={15} /> Clear this session</button></div></div><div className="bridge-result-card"><h3><Clipboard size={16} /> What happens next</h3><p className="bridge-input-note" style={{ margin: 0, lineHeight: 1.7 }}>You can edit the map directly, or add a missing reference or clarification and ask Bridge to update the map. When it reflects your meaning, Bridge will shape it for <strong>{purpose}</strong> without filling gaps with guesses.</p><div className="bridge-banner" style={{ marginBottom: 0, marginTop: "1rem" }}><ShieldCheck size={16} style={{ flex: "none" }} /><span>High-stakes drafts still need your review before sending.</span></div></div></div>}
          {stage === "final" && translation && <div id="translation-result" className="bridge-result" style={{ marginTop: "1rem" }}><div className="bridge-result-card"><h3><Sparkles size={16} /> Your editable draft</h3><p className="bridge-input-note" style={{ margin: "0 0 .7rem" }}>You are the editor-in-chief. Change anything before copying or downloading.</p><textarea className="bridge-output" value={translation} onChange={(event) => setTranslation(event.target.value)} aria-label="Editable Bridge translation" /><div className="bridge-action-row"><button className="bridge-button soft" type="button" onClick={() => void handleCopy()}>{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy"}</button><button className="bridge-button ghost" type="button" onClick={() => downloadWord(translation)}><Download size={15} /> Word</button><button className="bridge-button ghost" type="button" onClick={() => downloadFile("bridge-translation.txt", translation, "text/plain;charset=utf-8")}><Download size={15} /> TXT</button><button className="bridge-button ghost" type="button" onClick={() => downloadPdf(translation)}><Download size={15} /> PDF</button><button className="bridge-button primary" type="button" onClick={handleSaveTranslation} disabled={saveTranslationMutation.isPending}>{saveTranslationMutation.isPending ? <><RotateCcw size={15} className="animate-spin" /> Saving…</> : <><Save size={15} /> {isAuthenticated ? "Save to my account" : "Sign in to save"}</>}</button><button className="bridge-button danger" type="button" onClick={clearSession}><Trash2 size={15} /> Clear this session</button></div>{restoredForSave && isAuthenticated && <div className="bridge-banner"><ShieldCheck size={16} style={{ flex: "none" }} /><span>You are signed in. This restored draft is still local until you choose <strong>Save to my account</strong>.</span></div>}</div><div className="bridge-result-card"><h3><ShieldCheck size={16} /> Review before using</h3><div className="bridge-banner high-stakes" style={{ marginTop: 0 }}><ShieldCheck size={16} style={{ flex: "none" }} /><span>For {selectedDestination.label}, check names, dates, evidence, tone, and the exact outcome you want before sending.</span></div><p className="bridge-input-note" style={{ lineHeight: 1.7 }}>Bridge structures language. It does not provide legal, medical, benefits, or professional advice.</p><button className="bridge-button ghost" type="button" onClick={() => { setStage("input"); setTranslation(""); setMeaningMap(""); goToWorkspace(); }}><RotateCcw size={15} /> Start a new crossing</button></div></div>}
          {isAuthenticated && <div className="bridge-history"><div className="bridge-section-heading" style={{ marginBottom: ".75rem" }}><h2 className="serif" style={{ fontSize: "1.8rem" }}><History size={20} style={{ verticalAlign: "-2px", marginRight: ".4rem" }} /> Your saved crossings</h2><div className="bridge-action-row" style={{ marginTop: 0 }}><button className="bridge-button danger" type="button" onClick={() => { if (window.confirm("Clear your saved translation history?")) clearHistoryMutation.mutate(); }} disabled={!historyQuery.data?.length}><Trash2 size={14} /> Clear history</button><button className="bridge-button danger" type="button" onClick={() => { if (window.confirm("Delete all saved Bridge data in this account? This removes saved translations, profiles, forms, and Evidence records from Bridge.")) deleteSavedDataMutation.mutate(); }}><Trash2 size={14} /> Delete saved Bridge data</button></div></div>{historyQuery.isLoading ? <p className="bridge-empty">Loading your saved crossings…</p> : historyQuery.data?.length ? <div className="bridge-history-list">{historyQuery.data.map((item) => <div className="bridge-history-item" key={item.id}><button type="button" onClick={() => loadHistory(item)} style={{ flex: 1, border: 0, background: "transparent", textAlign: "left", cursor: "pointer", padding: 0 }}><strong>{item.purpose} · {item.outputStyle}</strong><span>{item.createdAt ? new Date(item.createdAt).toLocaleString() : "Saved crossing"}</span></button><button className="bridge-button ghost" type="button" aria-label={`Delete ${item.purpose} translation`} onClick={() => deleteHistoryMutation.mutate({ id: item.id })}><Trash2 size={14} /></button></div>)}</div> : <p className="bridge-empty">Your completed crossings will appear here. This is your account history; guest working text is not added automatically.</p>}</div>}
        </div></section>

        <section className="bridge-section" aria-labelledby="ecosystem-title"><div className="bridge-section-heading"><h2 id="ecosystem-title" className="serif">One bridge.<br />Several crossings.</h2><p><strong>Live now:</strong> Translate and Forms. <strong>Bridge Evidence is in development, not live:</strong> its current local download-only packet is a limited prototype, not evidence storage or a completed timeline service. Voice, Coach, and API are on the roadmap only — they are in development and not functional yet.</p></div><div className="bridge-card-grid">{[{ label: "Bridge Voice", copy: "Planned live conversation support for people who speak more easily than they write.", icon: AudioLines }, { label: "Bridge Coach", copy: "Planned plain-language help for recognising what different systems are functionally asking for.", icon: BrainCircuit }, { label: "Bridge API", copy: "Planned accessibility infrastructure for services that want to embed Bridge in their own work.", icon: Sparkles }].map(({ label, copy, icon: Icon }) => <button key={label} type="button" className="bridge-card bridge-module-button" onClick={() => setComingSoon(`${label} is in development and not functional yet. It is a future part of the wider Bridge map, not a live tool.`)}><div className="bridge-card-icon"><Icon size={19} /></div><span className="bridge-development-status">In development · not functional yet</span><h3>{label}</h3><p>{copy}</p></button>)}</div>{comingSoon && <div className="bridge-banner" role="status"><Sparkles size={16} style={{ flex: "none" }} /><span>{comingSoon}</span><button type="button" aria-label="Dismiss module notice" onClick={() => setComingSoon("")} style={{ marginLeft: "auto", border: 0, background: "transparent", color: "inherit", cursor: "pointer" }}><X size={15} /></button></div>}</section>

        <section className="bridge-section" aria-labelledby="privacy-title"><div className="bridge-section-heading"><div><p className="bridge-eyebrow">Privacy and safety</p><h2 id="privacy-title" className="serif">You choose what stays.</h2></div><p>Bridge is for drafting and organising. It does not submit anything, make decisions, or replace a clinician, advocate, lawyer, or benefits adviser.</p></div><div className="bridge-card-grid"><article className="bridge-card"><div className="bridge-card-icon"><ShieldCheck size={19} /></div><h3>Guest work</h3><p>Try, edit, copy, and download without an account. Use Clear this session whenever you want to remove the current working copy.</p></article><article className="bridge-card"><div className="bridge-card-icon" style={{ background: "var(--bridge-blush)" }}><Save size={19} /></div><h3>Saved work</h3><p>Deletion removes the Bridge account record and makes its attached item inaccessible through Bridge. Bridge has no restore button. Your own downloads stay on your device; limited platform technical logs or recovery systems may follow their own retention cycle outside Bridge’s control.</p></article><article className="bridge-card"><div className="bridge-card-icon" style={{ background: "var(--bridge-mint)" }}><LockKeyhole size={19} /></div><h3>Use care with sensitive material</h3><p>Avoid passwords, card details, and third-party private information unless you have a clear reason and right to use it.</p></article></div></section>

        <section className="bridge-section" aria-labelledby="about-title"><div className="bridge-section-heading"><div><p className="bridge-eyebrow">About / why Bridge exists</p><h2 id="about-title" className="serif">Built from the gap<br />between a life and a form.</h2></div><p>Bridge is a service-user-built accessibility prototype: a practical response to how easily connected lived experience gets flattened when systems only accept disconnected boxes.</p></div><div className="bridge-two-col"><article className="bridge-card"><div className="bridge-card-icon"><History size={19} /></div><h3>Public evidence timeline</h3><p>Explore the public chronology map behind the wider timeline work: a long-form record organised across places, systems, and time.</p><div className="bridge-action-row"><a className="bridge-button ghost" href="https://black-audhd-evidence-timeline.mariemeronym.workers.dev/" target="_blank" rel="noreferrer">Open public timeline <ArrowRight size={15} /></a></div></article><article className="bridge-card"><div className="bridge-card-icon" style={{ background: "var(--bridge-mint)" }}><Map size={19} /></div><h3>Wobbly Wanderer context</h3><p>Read the wider context, questions, and systems patterns that led to this work on access, documentation, and meaningful participation.</p><div className="bridge-action-row"><a className="bridge-button ghost" href="https://sites.google.com/view/wobblywanderer/context" target="_blank" rel="noreferrer">Read the context <ArrowRight size={15} /></a></div></article></div></section>

        <section className="bridge-section bridge-support-section" aria-labelledby="support-title"><div className="bridge-support-copy"><p className="bridge-eyebrow">Optional support</p><h2 id="support-title" className="serif">Bridge is free to use.</h2><p>You do not need to pay, donate, or use a referral link to try Bridge, download a draft, or decide it is not for you.</p><p>If Bridge has been useful and you are already choosing to try Manus, use Ree’s invitation: <strong>you get 500 credits and Ree gets 500 credits too.</strong> Ree’s credits directly resource further Bridge and public timeline work.</p><div className="bridge-action-row"><a className="bridge-button ghost" href="https://manus.im/invitation/6QV3G5TW9PK0W?utm_source=invitation&utm_medium=social&utm_campaign=copy_link" target="_blank" rel="noreferrer">Try Manus with Ree’s invitation <ArrowRight size={15} /></a></div></div><div className="bridge-support-qr"><img src="/manus-storage/bridge-gofundme-qr_30c2abd8.png" alt="QR code for Ree’s GoFundMe fundraiser supporting safe housing, mobility repairs, and advocacy." /><p>Optional direct support for Ree’s fundraiser.</p><a className="bridge-button ghost" href="https://gofund.me/5f42ef66c" target="_blank" rel="noreferrer">Open Ree’s GoFundMe <ArrowRight size={15} /></a></div></section>
      </main>
      <footer className="bridge-shell bridge-footer"><span>Bridge · accessibility translation layer</span><span className="bridge-future">Translate · Forms · Evidence (in development)</span></footer>
    </div>
  );
}
