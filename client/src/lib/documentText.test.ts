import { File } from "node:buffer";
import { describe, expect, it, vi } from "vitest";

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {},
  getDocument: vi.fn(),
}));
vi.mock("tesseract.js", () => ({ createWorker: vi.fn() }));

import { getDocument } from "pdfjs-dist";
import { createWorker } from "tesseract.js";
import { extractLocalDocumentText, extractLocalFormText, limitFormText, suggestFormContextSummary } from "./documentText";

describe("Bridge document context intake", () => {
  it("keeps XML and EML sources as browser-held text context", async () => {
    const xml = new File(["<letter><subject>Housing repair update</subject></letter>"], "repair-update.xml", { type: "application/xml" });
    const email = new File(["From: housing@example.test\nSubject: Assessment date\n\nPlease confirm your availability."], "assessment.eml", { type: "message/rfc822" });

    await expect(extractLocalDocumentText(xml)).resolves.toEqual({
      text: "<letter><subject>Housing repair update</subject></letter>",
      truncated: false,
    });
    await expect(extractLocalDocumentText(email)).resolves.toEqual({
      text: "From: housing@example.test\nSubject: Assessment date\n\nPlease confirm your availability.",
      truncated: false,
    });
  });

  it("stages PST and OST archives instead of falsely accepting them", async () => {
    const archive = new File(["not parsed"], "outlook-archive.pst", { type: "application/octet-stream" });
    await expect(extractLocalDocumentText(archive)).rejects.toThrow("PST and OST archive import is not live yet");
  });

  it("keeps long text context below the browser-to-server payload ceiling", async () => {
    const longText = new File(["a".repeat(7_000)], "long-note.txt", { type: "text/plain" });
    const result = await extractLocalDocumentText(longText);

    expect(result.truncated).toBe(true);
    expect(result.text).toContain("Bridge context excerpt");
    expect(result.text.length).toBeLessThanOrEqual(6_100);
  });

  it("samples later sections from a long official form instead of retaining only the opening and closing", () => {
    const form = [
      "Question 1: identity details " + "a".repeat(700),
      "Question 24: preparing food and daily living support " + "b".repeat(700),
      "Question 47: moving around and mobility support " + "c".repeat(700),
      "Question 69: declaration " + "d".repeat(700),
    ].join("\n\n");
    const result = limitFormText(form, 1_800);

    expect(result.truncated).toBe(true);
    expect(result.text).toContain("Question 24");
    expect(result.text).toContain("Question 47");
    expect(result.text).toContain("Bridge form excerpt");
  });

  it("uses the same section sampling for long OCR text from a scanned form", () => {
    const scannedOcrText = [
      "Scanned page 1: identity questions " + "a".repeat(700),
      "Scanned page 9: preparing food functional question " + "b".repeat(700),
      "Scanned page 16: moving around functional question " + "c".repeat(700),
      "Scanned page 24: declaration " + "d".repeat(700),
    ].join("\n\n");
    const result = limitFormText(scannedOcrText, 1_800);

    expect(result.text).toContain("Scanned page 9");
    expect(result.text).toContain("Scanned page 16");
  });

  it("routes an OCR-only scanned PDF form through later-section sampling", async () => {
    const ocrPages = [
      "Scanned question 1: identity details " + "a".repeat(700),
      "Scanned question 18: preparing food functional question " + "b".repeat(700),
      "Scanned question 47: moving around functional question " + "c".repeat(700),
      "Scanned question 69: declaration " + "d".repeat(700),
    ];
    vi.mocked(getDocument).mockReturnValue({ promise: Promise.resolve({
      numPages: ocrPages.length,
      getPage: async () => ({
        getTextContent: async () => ({ items: [] }),
        getViewport: () => ({ width: 1, height: 1 }),
        render: () => ({ promise: Promise.resolve() }),
      }),
    }) } as never);
    vi.mocked(createWorker).mockResolvedValue({
      recognize: vi.fn().mockImplementation(async () => ({ data: { text: ocrPages.shift() || "" } })),
      terminate: vi.fn(),
    } as never);
    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => ({ width: 0, height: 0, getContext: () => ({}) }) } });

    try {
      const scannedPdf = new File(["scanned"], "scanned-pip-form.pdf", { type: "application/pdf" });
      const result = await extractLocalFormText(scannedPdf, 1_800);
      expect(result.text).toContain("Scanned question 18");
      expect(result.text).toContain("Scanned question 47");
    } finally {
      Object.defineProperty(globalThis, "document", { configurable: true, value: originalDocument });
    }
  });

  it("uses a readable first heading rather than a technical source filename for a local form summary", () => {
    expect(suggestFormContextSummary("council-tax-reduction-application.pdf", "Council Tax Reduction application form\n\nPlease complete each section.")).toBe("Council Tax Reduction application form");
  });
});
