import { useRef, useState, type ChangeEvent } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { downloadPortableEvidencePacket, type PortableEvidenceItem } from "@/lib/evidencePacket";
import { Download, FileArchive, FileText, FolderTree, ShieldCheck, Tags, Trash2, Upload, X } from "lucide-react";

type EvidenceMimeType = "application/pdf" | "text/plain" | "text/html" | "image/jpeg" | "image/png" | "image/webp";

type Draft = Omit<PortableEvidenceItem, "id" | "youRef" | "originalName" | "canonicalName" | "sourceMimeType" | "sourceFile" | "sourceText">;

const ACCEPTED_MIME_TYPES: EvidenceMimeType[] = ["application/pdf", "text/plain", "text/html", "image/jpeg", "image/png", "image/webp"];

const emptyDraft = (): Draft => ({
  eventDate: "", dateConfidence: "unknown", organisation: "", itemType: "Document", sender: "", recipient: "", subject: "", summary: "", tags: [], deadlines: [], reviewStatus: "needs_review", reviewNotes: "",
});

function cleanName(value: string) {
  return value.replace(/[^a-zA-Z0-9._ -]/g, "-").replace(/\s+/g, "-").slice(0, 120) || "Evidence-item";
}

function canonicalName(draft: Draft, youRef: string, originalName: string) {
  const date = /^\d{4}-\d{2}-\d{2}/.test(draft.eventDate) ? draft.eventDate : "DATE-UNCLEAR";
  return `${date}__${youRef}__${cleanName(draft.organisation || "Uncategorised")}__${cleanName(originalName)}`.slice(0, 360);
}

function registerLabel(item: PortableEvidenceItem) {
  if (item.tags.some((tag) => /complaint|appeal|escalation/i.test(tag))) return "Complaint / escalation";
  if (item.tags.some((tag) => /application|request/i.test(tag))) return "Application / request";
  return "Submission";
}

export default function EvidencePage() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"upload" | "note">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [noteTitle, setNoteTitle] = useState("Manual evidence note");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [items, setItems] = useState<PortableEvidenceItem[]>([]);
  const [uiError, setUiError] = useState("");
  const [evidenceDropActive, setEvidenceDropActive] = useState(false);

  function chooseEvidenceFile(chosen?: File) {
    if (!chosen) return;
    if (chosen.size > 8 * 1024 * 1024) { setUiError("This first packet release accepts files up to 8 MB. Larger PST/Takeout archives need the separate importer."); return; }
    if (!ACCEPTED_MIME_TYPES.includes(chosen.type as EvidenceMimeType)) { setUiError("Use a PDF, plain text, HTML, JPEG, PNG, or WebP source."); return; }
    setFile(chosen); setUiError("");
  }
  function handleFile(event: ChangeEvent<HTMLInputElement>) { chooseEvidenceFile(event.target.files?.[0]); }
  function handleEvidenceDrop(event: React.DragEvent<HTMLDivElement>) { event.preventDefault(); setEvidenceDropActive(false); chooseEvidenceFile(event.dataTransfer.files?.[0]); }

  function addToPacket() {
    if (mode === "upload" && !file) { setUiError("Choose one source file before adding it to the local packet."); return; }
    if (mode === "note" && !note.trim()) { setUiError("Write or paste the manual evidence note before adding it."); return; }
    const ordinal = String(items.length + 1).padStart(4, "0");
    const youRef = `YOU-LOCAL-${ordinal}`;
    const originalName = mode === "upload" ? file!.name : `${cleanName(noteTitle)}.txt`;
    const item: PortableEvidenceItem = {
      ...draft,
      id: crypto.randomUUID(),
      youRef,
      originalName,
      canonicalName: canonicalName(draft, youRef, originalName),
      sourceMimeType: mode === "upload" ? file!.type : "text/plain",
      sourceFile: mode === "upload" ? file! : undefined,
      sourceText: mode === "note" ? note : undefined,
    };
    setItems((current) => [...current, item]);
    setFile(null); setNote(""); setDraft(emptyDraft()); setUiError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const deadlines = items.filter((item) => item.deadlines.length > 0);
  const submissions = items.filter((item) => item.tags.some((tag) => /application|submission|complaint|appeal|request/i.test(tag)));

  return (
    <div className="bridge-page">
      <header className="bridge-shell bridge-header">
        <Link className="bridge-brand" href="/" aria-label="Bridge home"><span className="bridge-mark"><span className="serif" style={{ fontSize: "1.6rem", lineHeight: 1 }}>B</span></span><span className="bridge-brand-word">BRIDGE</span></Link>
        <div className="bridge-header-note"><span className="bridge-dot" /> originals stay with you</div>
        <nav className="bridge-nav" aria-label="Bridge modules"><Link href="/">Translate</Link><Link href="/forms">Forms</Link>{loading ? <span>Checking…</span> : isAuthenticated ? <button type="button" onClick={() => logout()}>Sign out · {user?.name ?? "account"}</button> : <span className="bridge-status">No account needed</span>}</nav>
      </header>

      <main className="bridge-shell">
        <aside className="bridge-prototype-stamp" role="note" aria-label="Bridge Evidence in-development boundary"><ShieldCheck size={19} style={{ flex: "none" }} /><div><p><strong>In development · not live yet:</strong> Bridge Evidence currently makes a limited chronology from individual items and downloads a self-contained ZIP evidence packet. It is not evidence storage, a complete timeline service, or a Drive connection. Bridge does not store, sync, or back up these sources. Keep the downloaded packet somewhere you control or upload the extracted folder to a host you choose. Automatic timeline-file downloads and organised folder mirroring are still being developed carefully in stages.</p><div className="bridge-prototype-links"><a href="https://manus.im/invitation/6QV3G5TW9PK0W?utm_source=invitation&utm_medium=social&utm_campaign=copy_link" target="_blank" rel="noreferrer">Try Manus with Ree’s invitation</a><a href="https://gofund.me/5f42ef66c" target="_blank" rel="noreferrer">Support the staged build on GoFundMe</a></div></div></aside>

        <section className="bridge-hero" style={{ paddingBottom: "2rem" }}><div><p className="bridge-eyebrow">Bridge Evidence · in development · not live yet</p><h1 className="serif">Keep the original.<br />Carry the thread.</h1><p className="bridge-hero-copy">Try this limited local prototype: build a small chronology in this browser, review it, then download one portable packet with the originals, registers, and a simple static index page.</p></div><div className="bridge-hero-visual" aria-hidden="true"><div className="bridge-orbit" /><div className="bridge-map-card"><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".65rem" }}><span className="bridge-eyebrow" style={{ margin: 0, fontSize: ".64rem" }}>portable evidence prototype</span><FolderTree size={18} color="#8d73a8" /></div><h3 className="serif">Source → YouRef → ZIP packet</h3><p>The original stays yours. The packet is the working copy.</p></div></div></section>

        <section className="bridge-workspace" style={{ paddingTop: 0 }}><div className="bridge-workspace-shell"><div className="bridge-workspace-top"><div><p className="bridge-eyebrow">Step 1 · add one source</p><h2 className="serif">Start with the piece you have.</h2><p>Everything stays in this browser until you download the packet.</p></div><span className="bridge-status">Local · download-only</span></div>
          <div className="bridge-chip-grid" style={{ marginBottom: "1rem" }}><button type="button" className="bridge-chip" aria-pressed={mode === "upload"} onClick={() => setMode("upload")}><Upload size={14} style={{ marginRight: ".3rem", verticalAlign: "-2px" }} /> Upload document or image</button><button type="button" className="bridge-chip" aria-pressed={mode === "note"} onClick={() => setMode("note")}><FileText size={14} style={{ marginRight: ".3rem", verticalAlign: "-2px" }} /> Manual note / pasted text</button></div>
          {mode === "upload" ? <div className="bridge-step"><div className="bridge-step-label"><span className="bridge-step-number">1</span> Choose a source file</div><p className="bridge-helper">PDF, plain text, HTML, JPEG, PNG, or WebP — up to 8 MB for this packet release.</p><div className={`bridge-dropzone ${evidenceDropActive ? "is-dragging" : ""}`} role="button" tabIndex={0} aria-label="Drop or choose an Evidence source file" onClick={() => fileInputRef.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); fileInputRef.current?.click(); } }} onDragOver={(event) => { event.preventDefault(); setEvidenceDropActive(true); }} onDragLeave={() => setEvidenceDropActive(false)} onDrop={handleEvidenceDrop}><Upload size={21} aria-hidden="true" /><strong>Drop an original source here</strong><p>Or click to choose a document or image. It stays in this browser until you download your local evidence packet.</p><span className="bridge-input-note">{file ? `Ready for packet: ${file.name}` : "PDF, text, HTML, JPEG, PNG, or WebP · up to 8 MB"}</span><input ref={fileInputRef} type="file" accept=".pdf,.txt,.html,.jpg,.jpeg,.png,.webp" style={{ display: "none" }} onChange={handleFile} /></div></div> : <div className="bridge-step"><div className="bridge-step-label"><span className="bridge-step-number">1</span> Add a manual evidence note</div><p className="bridge-helper">Useful for an event, conversation, observation, or context that has no existing document.</p><label className="bridge-input-label" htmlFor="note-title">Source label</label><input id="note-title" className="bridge-input" value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} /><label className="bridge-input-label" htmlFor="evidence-note" style={{ marginTop: "1rem" }}>Note or pasted text</label><textarea id="evidence-note" className="bridge-input bridge-textarea" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Write what happened, paste an email, or record the source context here…" /></div>}

          <div className="bridge-step"><div className="bridge-step-label"><span className="bridge-step-number">2</span> Make a reviewable entry</div><p className="bridge-helper">These are your local packet labels. Use only what the source establishes; leave something blank if it is unclear.</p><div className="bridge-two-col"><div><label className="bridge-input-label" htmlFor="event-date">Event date</label><input id="event-date" className="bridge-input" value={draft.eventDate} onChange={(event) => setDraft((value) => ({ ...value, eventDate: event.target.value }))} placeholder="YYYY-MM-DD or date as stated" /></div><div><label className="bridge-input-label" htmlFor="date-confidence">Date confidence</label><select id="date-confidence" className="bridge-select" value={draft.dateConfidence} onChange={(event) => setDraft((value) => ({ ...value, dateConfidence: event.target.value as Draft["dateConfidence"] }))}><option value="exact">Exact</option><option value="month">Month known</option><option value="year">Year known</option><option value="inferred">Inferred</option><option value="unknown">Unknown</option></select></div></div><label className="bridge-input-label" htmlFor="organisation" style={{ marginTop: ".8rem" }}>Organisation</label><input id="organisation" className="bridge-input" value={draft.organisation} onChange={(event) => setDraft((value) => ({ ...value, organisation: event.target.value }))} /><label className="bridge-input-label" htmlFor="subject" style={{ marginTop: ".8rem" }}>Subject / event label</label><input id="subject" className="bridge-input" value={draft.subject} onChange={(event) => setDraft((value) => ({ ...value, subject: event.target.value }))} /><label className="bridge-input-label" htmlFor="summary" style={{ marginTop: ".8rem" }}>Factual summary</label><textarea id="summary" className="bridge-input bridge-textarea compact" value={draft.summary} onChange={(event) => setDraft((value) => ({ ...value, summary: event.target.value }))} placeholder="What does this one source establish?" /><label className="bridge-input-label" htmlFor="tags" style={{ marginTop: ".8rem" }}>Tags (comma-separated)</label><input id="tags" className="bridge-input" value={draft.tags.join(", ")} onChange={(event) => setDraft((value) => ({ ...value, tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) }))} /><label className="bridge-input-label" htmlFor="deadlines" style={{ marginTop: ".8rem" }}>Explicit deadlines (one per line)</label><textarea id="deadlines" className="bridge-input bridge-textarea compact" value={draft.deadlines.join("\n")} onChange={(event) => setDraft((value) => ({ ...value, deadlines: event.target.value.split("\n").map((deadline) => deadline.trim()).filter(Boolean) }))} /><div className="bridge-action-row"><button className="bridge-button primary" type="button" onClick={addToPacket}><FileArchive size={15} /> Add to local packet</button></div></div>
          {uiError && <div className="bridge-banner high-stakes" role="alert" style={{ marginTop: "1rem" }}><X size={16} style={{ flex: "none" }} /><span>{uiError}</span></div>}
          <div className="bridge-banner high-stakes" style={{ marginTop: "1rem" }}><ShieldCheck size={16} style={{ flex: "none" }} /><span><strong>Archive boundary:</strong> PST, Google Takeout, MBOX, WhatsApp archives, and large media collections need a separate resumable importer. This release starts with individual items, then makes one packet you control.</span></div>
        </div></section>

        <section className="bridge-section" aria-labelledby="chronology-title"><div className="bridge-section-heading"><div><p className="bridge-eyebrow">Evidence register</p><h2 id="chronology-title" className="serif">One local chronology.<br />One portable packet.</h2></div><p>Review the list, remove anything you do not want, then download a ZIP containing the originals, a static index page, and CSV registers.</p></div><div className="bridge-action-row" style={{ marginBottom: "1rem" }}><button className="bridge-button primary" type="button" disabled={!items.length} onClick={() => void downloadPortableEvidencePacket(items)}><Download size={15} /> Download evidence packet (.zip)</button><span className="bridge-input-note">{items.length ? `${items.length} item${items.length === 1 ? "" : "s"} in this browser session` : "No local items yet"}</span></div><div className="bridge-result-card">{items.length ? <div className="bridge-register-list">{items.map((item) => <article key={item.id} className="bridge-register-row"><div><p className="bridge-eyebrow" style={{ margin: 0 }}>{item.youRef} · {item.eventDate || "date unclear"}</p><h3 className="serif" style={{ fontSize: "1.25rem", margin: ".2rem 0" }}>{item.subject || item.originalName}</h3><p className="bridge-input-note" style={{ margin: 0 }}>{item.organisation || "Organisation unclear"} · {item.summary || "No summary added"}</p></div><button className="bridge-button danger" type="button" onClick={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))}><Trash2 size={15} /> Remove</button></article>)}</div> : <div className="bridge-empty-state"><FileArchive size={22} /><h3 className="serif">No packet items yet</h3><p>Add one source above. Nothing has been uploaded to Bridge storage.</p></div>}</div></section>

        <section className="bridge-section" aria-labelledby="register-title"><div className="bridge-section-heading"><div><p className="bridge-eyebrow">Packet registers</p><h2 id="register-title" className="serif">Carry the useful lists too.</h2></div><p>The ZIP creates a chronology CSV, deadline register, submission register, manifest, source folder, and simple `index.html` page.</p></div><div className="bridge-card-grid"><article className="bridge-card"><div className="bridge-card-icon"><Tags size={19} /></div><h3>Applications / submissions</h3><p>{submissions.length ? `${submissions.length} local item${submissions.length === 1 ? "" : "s"} will appear in this register.` : "Tag an item as application, submission, complaint, appeal, or request."}</p></article><article className="bridge-card"><div className="bridge-card-icon" style={{ background: "var(--bridge-blush)" }}><FileText size={19} /></div><h3>Deadlines / response windows</h3><p>{deadlines.length ? `${deadlines.length} local item${deadlines.length === 1 ? "" : "s"} contain explicit deadlines.` : "Explicit deadlines go into their own portable register."}</p></article><article className="bridge-card"><div className="bridge-card-icon" style={{ background: "var(--bridge-mint)" }}><FolderTree size={19} /></div><h3>Host it your way</h3><p>Extract the ZIP to open the index locally, or upload the folder to your own static host when you are ready.</p></article></div></section>
      </main>
    </div>
  );
}
