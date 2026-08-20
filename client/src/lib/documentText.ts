import mammoth from "mammoth";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const DEFAULT_CONTEXT_CHARS = 6_000;

export type ImportedDocumentText = {
  text: string;
  truncated: boolean;
};

function limitDocumentText(text: string, maxChars: number): ImportedDocumentText {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (cleaned.length <= maxChars) return { text: cleaned, truncated: false };
  const marker = "\n\n[Bridge context excerpt: middle of this very long document omitted]\n\n";
  const usable = Math.max(0, maxChars - marker.length);
  const opening = cleaned.slice(0, Math.floor(usable * 0.75));
  const closing = cleaned.slice(-Math.ceil(usable * 0.25));
  return { text: `${opening}${marker}${closing}`, truncated: true };
}

export function limitFormText(text: string, maxChars: number): ImportedDocumentText {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (cleaned.length <= maxChars) return { text: cleaned, truncated: false };
  const sections = cleaned.split(/\n{2,}/).map((section) => section.trim()).filter(Boolean);
  if (sections.length < 3) return limitDocumentText(cleaned, maxChars);
  const marker = "\n\n[Bridge form excerpt: sections sampled across this longer form so later questions remain visible]\n\n";
  const usable = Math.max(0, maxChars - marker.length);
  const sampleCount = Math.min(18, sections.length);
  const indexes = Array.from({ length: sampleCount }, (_, index) => Math.round(index * (sections.length - 1) / Math.max(1, sampleCount - 1)));
  const sampled = indexes.map((index) => sections[index]).join("\n\n");
  return { text: `${sampled.slice(0, usable)}${marker}`, truncated: true };
}

export function suggestFormContextSummary(fileName: string, text: string) {
  const heading = text
    .split(/\n{1,2}/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .find((line) => line.length > 8 && line.length < 190);
  const readableName = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return heading || readableName || "Form copy supplied for Bridge to map";
}

async function runOcr(source: File | HTMLCanvasElement): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const result = await worker.recognize(source);
    return result.data.text;
  } finally {
    await worker.terminate();
  }
}

async function extractImageText(file: File, maxChars: number): Promise<ImportedDocumentText> {
  return limitDocumentText(await runOcr(file), maxChars);
}

async function extractPdfOcr(pdf: Awaited<ReturnType<typeof getDocument>>["promise"] extends Promise<infer T> ? T : never, maxChars: number, sampleFormSections = false): Promise<ImportedDocumentText> {
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Bridge could not prepare this scanned PDF page for OCR.");
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    pages.push(await runOcr(canvas));
    if (pages.join("\n").length >= maxChars) break;
  }
  const ocrText = pages.join("\n\n");
  return sampleFormSections ? limitFormText(ocrText, maxChars) : limitDocumentText(ocrText, maxChars);
}

async function extractPdfText(file: File, maxChars: number): Promise<ImportedDocumentText> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data: bytes }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  const nativeText = pages.join("\n\n").trim();
  return nativeText ? limitDocumentText(nativeText, maxChars) : extractPdfOcr(pdf, maxChars);
}

async function extractDocxText(file: File, maxChars: number): Promise<ImportedDocumentText> {
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return limitDocumentText(result.value, maxChars);
}

export async function extractLocalDocumentText(file: File, maxChars = DEFAULT_CONTEXT_CHARS): Promise<ImportedDocumentText> {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return extractPdfText(file, maxChars);
  if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || name.endsWith(".docx")) return extractDocxText(file, maxChars);
  if (name.endsWith(".doc")) throw new Error("The older .doc format needs saving as .docx or PDF before Bridge can read it in the browser.");
  if (file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i.test(name)) return extractImageText(file, maxChars);
  if (file.type.startsWith("text/") || /\.(txt|md|csv|rtf|html?|xml|eml)$/i.test(name)) return limitDocumentText(await file.text(), maxChars);
  if (/\.(pst|ost)$/i.test(name)) throw new Error("PST and OST archive import is not live yet. Use the portable Evidence packet for individual items while the archive importer is built.");
  throw new Error("Use a PDF, Word .docx, screenshot/image, XML, EML, or plain-text document in Bridge Translate.");
}

export async function extractLocalFormText(file: File, maxChars = 80_000): Promise<ImportedDocumentText> {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocument({ data: bytes }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
    }
    const nativeText = pages.join("\n\n").trim();
    return nativeText ? limitFormText(nativeText, maxChars) : extractPdfOcr(pdf, maxChars, true);
  }
  if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || name.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return limitFormText(result.value, maxChars);
  }
  if (name.endsWith(".doc")) throw new Error("The older .doc format needs saving as .docx or PDF before Bridge can read it in the browser.");
  if (file.type.startsWith("text/") || /\.(txt|md|csv|rtf|html?|xml|eml)$/i.test(name)) return limitFormText(await file.text(), maxChars);
  return extractLocalDocumentText(file, maxChars);
}

export function suggestDocumentContextLabel(fileName: string, text: string) {
  const firstUsefulLine = text.split("\n").map((line) => line.replace(/\s+/g, " ").trim()).find((line) => line.length > 8) || "Document supplied as background context";
  return firstUsefulLine.slice(0, 150);
}
