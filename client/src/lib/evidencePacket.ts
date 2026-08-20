import { strToU8, zipSync } from "fflate";

export type PortableEvidenceItem = {
  id: string;
  youRef: string;
  originalName: string;
  canonicalName: string;
  sourceMimeType: string;
  sourceFile?: File;
  sourceText?: string;
  eventDate: string;
  dateConfidence: "exact" | "month" | "year" | "inferred" | "unknown";
  organisation: string;
  itemType: string;
  sender: string;
  recipient: string;
  subject: string;
  summary: string;
  tags: string[];
  deadlines: string[];
  reviewStatus: "needs_review" | "reviewed" | "in_register";
  reviewNotes: string;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function rowsToCsv(header: string[], rows: string[][]) {
  return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}

function serialiseItem(item: PortableEvidenceItem) {
  const { sourceFile, sourceText, ...record } = item;
  return { ...record, sourcePath: `sources/${item.canonicalName}` };
}

function createIndexHtml(items: PortableEvidenceItem[]) {
  const rows = items
    .map((item) => `<tr><td>${escapeHtml(item.youRef)}</td><td>${escapeHtml(item.eventDate || "Date unclear")}</td><td>${escapeHtml(item.organisation)}</td><td>${escapeHtml(item.subject || item.originalName)}</td><td>${escapeHtml(item.summary)}</td><td><a href="sources/${encodeURIComponent(item.canonicalName)}">Open original</a></td></tr>`)
    .join("\n");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Bridge Evidence packet</title><style>body{max-width:1100px;margin:0 auto;padding:2rem;font:16px/1.55 Arial,sans-serif;color:#31293c;background:#fffdfd}h1{font-size:2rem}table{width:100%;border-collapse:collapse;margin-top:1.5rem}th,td{padding:.65rem;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}th{background:#f1ebf7}a{color:#513b73}.note{padding:1rem;border-left:5px solid #9a7431;background:#fff5d8}</style></head><body><h1>Bridge Evidence packet</h1><p class="note"><strong>Portable packet:</strong> this folder is the working copy. Keep it somewhere you control, make backups, or upload the extracted folder to a static host if you choose. Bridge does not store or sync these records.</p><p>Includes ${items.length} reviewed evidence item${items.length === 1 ? "" : "s"}. The originals are in the <code>sources</code> folder; the CSV registers are available beside this page.</p><table><thead><tr><th>YouRef</th><th>Date</th><th>Organisation</th><th>Subject</th><th>Summary</th><th>Original</th></tr></thead><tbody>${rows || "<tr><td colspan=6>No items included.</td></tr>"}</tbody></table></body></html>`;
}

export async function buildPortableEvidenceArchive(items: PortableEvidenceItem[]) {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const root = `bridge-evidence-packet-${dateStamp}`;
  const header = ["YouRef", "Event date", "Date confidence", "Organisation", "Type", "Sender", "Recipient", "Subject", "Summary", "Tags", "Deadlines", "Review status", "Source path"];
  const chronologyRows = items.map((item) => [item.youRef, item.eventDate, item.dateConfidence, item.organisation, item.itemType, item.sender, item.recipient, item.subject, item.summary, item.tags.join("; "), item.deadlines.join("; "), item.reviewStatus, `sources/${item.canonicalName}`]);
  const deadlineRows = items.filter((item) => item.deadlines.length > 0).map((item) => [item.youRef, item.eventDate, item.organisation, item.subject, item.deadlines.join("; ")]);
  const submissionRows = items.filter((item) => item.tags.some((tag) => /application|submission|complaint|appeal|request/i.test(tag))).map((item) => [item.youRef, item.eventDate, item.organisation, item.subject, item.tags.join("; ")]);
  const archive: Record<string, Uint8Array> = {
    [`${root}/index.html`]: strToU8(createIndexHtml(items)),
    [`${root}/manifest.json`]: strToU8(JSON.stringify({ packetVersion: 1, exportedAt: new Date().toISOString(), storage: "local-download-only", items: items.map(serialiseItem) }, null, 2)),
    [`${root}/chronology.csv`]: strToU8(rowsToCsv(header, chronologyRows)),
    [`${root}/registers/deadlines.csv`]: strToU8(rowsToCsv(["YouRef", "Event date", "Organisation", "Subject", "Explicit deadlines"], deadlineRows)),
    [`${root}/registers/submissions.csv`]: strToU8(rowsToCsv(["YouRef", "Event date", "Organisation", "Subject", "Tags"], submissionRows)),
    [`${root}/README.txt`]: strToU8("BRIDGE EVIDENCE PORTABLE PACKET\n\nThis packet is a local, download-only working copy. Bridge does not store, sync, or back up these records. Keep the ZIP somewhere you control; extract it to open index.html or upload the extracted folder to a static host of your choice.\n\nContents:\n- index.html: a simple static chronology page\n- chronology.csv and registers/: spreadsheet-friendly registers\n- sources/: original uploaded files and manual-note originals\n- manifest.json: machine-readable packet record\n"),
  };

  for (const item of items) {
    const sourcePath = `${root}/sources/${item.canonicalName}`;
    archive[sourcePath] = item.sourceFile ? new Uint8Array(await item.sourceFile.arrayBuffer()) : strToU8(item.sourceText || "");
  }

  return { bytes: zipSync(archive, { level: 6 }), filename: `${root}.zip` };
}

export async function downloadPortableEvidencePacket(items: PortableEvidenceItem[]) {
  const { bytes, filename } = await buildPortableEvidenceArchive(items);
  const blob = new Blob([bytes], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
