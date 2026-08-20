import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { TRPCError } from "@trpc/server";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { transcribeAudio } from "./_core/voiceTranscription";
import { storageGetSignedUrl, storagePut } from "./storage";
import { createHash } from "node:crypto";
import {
  clearTranslationJobs,
  createAuditLog,
  createEvidenceItem,
  createFormSession,
  createSavedProfile,
  createTranslationJob,
  deleteAllBridgeData,
  deleteEvidenceItem,
  deleteFormSession,
  deleteSavedProfile,
  deleteTranslationJob,
  getEvidenceItemsByUser,
  getFormSessionsByUser,
  getSavedProfilesByUser,
  getTranslationJobsByUser,
  updateEvidenceItem,
  updateFormSession,
} from "./db";
import { z } from "zod";

const traitSchema = z.array(z.string().max(80)).max(20);

const guestRequestBuckets = new Map<string, { count: number; resetAt: number }>();

function enforceGuestTranslationLimit(ip?: string, forwardedValue?: string | string[]) {
  const forwarded = typeof forwardedValue === "string" ? forwardedValue : "";
  const key = (forwarded || ip || "anonymous").split(",")[0].trim();
  const now = Date.now();
  const bucket = guestRequestBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    guestRequestBuckets.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return;
  }
  if (bucket.count >= 12) throw new Error("The guest translator has reached its hourly limit for this connection. You can try again later or sign in to save your work.");
  bucket.count += 1;
}

const documentContextSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(255),
  contextLabel: z.string().max(240).default(""),
  text: z.string().min(1).max(30_000),
  truncated: z.boolean().default(false),
});

const translationInputSchema = z.object({
  sourceText: z.string().min(1).max(30000),
  documentContext: z.array(documentContextSchema).max(10).default([]),
  traits: traitSchema,
  profileDescription: z.string().max(2000).optional().default(""),
  purpose: z.string().min(1).max(120),
  outputStyle: z.string().min(1).max(80),
  extraContext: z.string().max(5000).optional().default(""),
  preserveEmotion: z.boolean().default(true),
});

const formQuestionSchema = z.object({
  id: z.string().min(1).max(80),
  section: z.string().max(180).default(""),
  label: z.string().min(1).max(240),
  prompt: z.string().min(1).max(1000),
  helpText: z.string().max(1000).default(""),
  required: z.boolean().default(false),
  answer: z.string().max(6000).default(""),
  status: z.enum(["answered", "missing", "uncertain"]).default("missing"),
});

const guestFormAnalysisInputSchema = z.object({
  formName: z.string().min(1).max(255),
  formText: z.string().min(1).max(80_000).optional(),
  formUrl: z.string().url().max(2_000).optional(),
  naturalStory: z.string().min(1).max(30_000),
  supportingContext: z.array(documentContextSchema).max(20).default([]),
}).refine((input) => Boolean(input.formText || input.formUrl), { message: "Add a public form link, paste its text, or upload a readable form copy before continuing." });

const formExtractionResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    formTitle: { type: "string" },
    sourceSummary: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          section: { type: "string" },
          label: { type: "string" },
          prompt: { type: "string" },
          helpText: { type: "string" },
          required: { type: "boolean" },
          answer: { type: "string" },
          status: { type: "string", enum: ["answered", "missing", "uncertain"] },
        },
        required: ["id", "section", "label", "prompt", "helpText", "required", "answer", "status"],
      },
    },
    missing: { type: "array", items: { type: "string" } },
  },
  required: ["formTitle", "sourceSummary", "questions", "missing"],
} as const;

const evidenceExtractionResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    eventDate: { type: "string" },
    dateConfidence: { type: "string", enum: ["exact", "month", "year", "inferred", "unknown"] },
    organisation: { type: "string" },
    itemType: { type: "string" },
    sender: { type: "string" },
    recipient: { type: "string" },
    subject: { type: "string" },
    summary: { type: "string" },
    deadlines: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string" } },
  },
  required: ["eventDate", "dateConfidence", "organisation", "itemType", "sender", "recipient", "subject", "summary", "deadlines", "tags"],
} as const;

const EVIDENCE_SYSTEM_PROMPT = `You are Bridge Evidence, an accessibility-focused evidence indexing and chronology assistant.

Your job is to turn one supplied source item into a cautious, traceable Evidence Object. The original source is the evidence. Your metadata, summary, tags, and chronology fields are navigation aids only.

Rules:
- Preserve uncertainty. Do not invent a date, organisation, sender, recipient, case number, event, or deadline.
- Use an exact date only when it appears explicitly in the supplied material. If the date is only partly known, use the relevant confidence level. If it is not established, use an empty eventDate and "unknown".
- Separate the source's stated facts from reasonable descriptive labels. Do not offer legal, medical, benefits, or professional conclusions.
- Keep the summary factual, short, and specific to the item. Do not merge in knowledge from other sources.
- Extract deadlines only where the source explicitly states or unambiguously implies a response date or timeframe.
- Provide a small, useful set of neutral tags. Do not label the user, infer motives, or pathologise tone.
- Return JSON only using the supplied schema.`;

const FORM_SYSTEM_PROMPT = `You are now Bridge Forms, the interactive form-completion layer. The form itself is the source of the questions; do not make the user identify a form from a menu. Extract only questions and instructions that are present in the supplied form copy or link content.

Rules for form extraction and completion:
- Preserve the form's section order and wording where possible, while making each field readable.
- Treat the user's account as data to map into fields, not as a reason to invent facts.
- An answer may be a careful paraphrase, but dates, names, diagnoses, amounts, reference numbers and quotations must remain exact or clearly uncertain.
- If the account does not contain enough information, leave the answer blank and add a short missing-information item.
- If the account conflicts with the form or with itself, mark the field uncertain and explain the conflict in helpText.
- Never fill a required box with a guess. “Not known”, “not applicable”, or “to be confirmed” may be appropriate only when supported by the user's words or explicitly chosen by the user.
- Return JSON only using the supplied schema.`;

function parseJsonResponse(response: LlmResponse) {
  const raw = responseText(response).replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(raw) as {
      formTitle?: string;
      sourceSummary?: string;
      questions?: Array<z.infer<typeof formQuestionSchema>>;
      missing?: string[];
    };
  } catch {
    throw new Error("Bridge could not read the structured form response. Try a clearer PDF or paste the form link again.");
  }
}

function normaliseFormResult(parsed: ReturnType<typeof parseJsonResponse>) {
  const questions = (parsed.questions ?? []).slice(0, 120).map((question, index) => ({
    id: question.id || `field-${index + 1}`,
    section: question.section || "",
    label: question.label || `Question ${index + 1}`,
    prompt: question.prompt || question.label || `Question ${index + 1}`,
    helpText: question.helpText || "",
    required: Boolean(question.required),
    answer: question.answer || "",
    status: question.status || (question.answer ? "answered" : "missing"),
  }));
  const missing = Array.from(new Set((parsed.missing ?? []).filter(Boolean))).slice(0, 120);
  return {
    formTitle: (parsed.formTitle || "Untitled form").slice(0, 255),
    sourceSummary: parsed.sourceSummary || "",
    questions,
    missing,
  };
}

function safeFormUrl(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Form links must begin with http:// or https://.");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".local") || hostname === "127.0.0.1" || hostname === "::1" || hostname.startsWith("192.168.") || hostname.startsWith("10.")) {
    throw new Error("For safety, Bridge cannot fetch local or private-network links.");
  }
  return url.toString();
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>(?=.)/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|label|fieldset|legend|section|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

async function prepareFormSource(input: { formUrl?: string; fileBase64?: string; fileName?: string; mimeType?: string; sourceText?: string }, userId: number) {
  if (input.fileBase64) {
    const raw = input.fileBase64.replace(/^data:[^;]+;base64,/, "");
    const bytes = Buffer.from(raw, "base64");
    if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw new Error("Form copies must be smaller than 8 MB.");
    const mimeType = input.mimeType || "application/pdf";
    const fileName = (input.fileName || "uploaded-form.pdf").replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
    const uploaded = await storagePut(`bridge-forms/${userId}/${crypto.randomUUID()}-${fileName}`, bytes, mimeType);
    if (mimeType === "application/pdf") {
      const signedUrl = await storageGetSignedUrl(uploaded.key);
      return { sourceType: "upload", sourceName: input.fileName || "Uploaded form", sourceKey: uploaded.key, sourceUrl: uploaded.url, sourceMimeType: mimeType, parts: [{ type: "text" as const, text: "The user uploaded this form copy. Extract its visible questions and instructions." }, { type: "file_url" as const, file_url: { url: signedUrl, mime_type: "application/pdf" as const } }] };
    }
    if (mimeType.startsWith("image/")) {
      const signedUrl = await storageGetSignedUrl(uploaded.key);
      return { sourceType: "upload", sourceName: input.fileName || "Form photo", sourceKey: uploaded.key, sourceUrl: uploaded.url, sourceMimeType: mimeType, parts: [{ type: "text" as const, text: "The user uploaded a photo or scan of a form. Read visible questions and instructions only." }, { type: "image_url" as const, image_url: { url: signedUrl, detail: "high" as const } }] };
    }
    return { sourceType: "upload", sourceName: input.fileName || "Uploaded form", sourceKey: uploaded.key, sourceUrl: uploaded.url, sourceMimeType: mimeType, parts: [{ type: "text" as const, text: `FORM COPY\\n${mimeType.includes("html") ? stripHtml(bytes.toString("utf8")) : bytes.toString("utf8")}` }] };
  }

  if (input.formUrl) {
    const formUrl = safeFormUrl(input.formUrl);
    const response = await fetch(formUrl, { signal: AbortSignal.timeout(12_000), headers: { Accept: "application/pdf,text/html,text/plain,*/*" } });
    if (!response.ok) throw new Error(`Bridge could not open that link (HTTP ${response.status}). Check that it is public and try again.`);
    const contentType = response.headers.get("content-type")?.split(";")[0] || "text/html";
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 8 * 1024 * 1024) throw new Error("Linked form copies must be smaller than 8 MB.");
    if (contentType === "application/pdf" || formUrl.toLowerCase().endsWith(".pdf")) {
      const uploaded = await storagePut(`bridge-forms/${userId}/${crypto.randomUUID()}-linked-form.pdf`, bytes, "application/pdf");
      const signedUrl = await storageGetSignedUrl(uploaded.key);
      return { sourceType: "link", sourceName: new URL(formUrl).hostname, sourceKey: uploaded.key, sourceUrl: formUrl, sourceMimeType: "application/pdf", parts: [{ type: "text" as const, text: `The user supplied this public form link: ${formUrl}. Extract its visible questions and instructions from the attached copy.` }, { type: "file_url" as const, file_url: { url: signedUrl, mime_type: "application/pdf" as const } }] };
    }
    const text = contentType.includes("html") ? stripHtml(bytes.toString("utf8")) : bytes.toString("utf8");
    return { sourceType: "link", sourceName: new URL(formUrl).hostname, sourceKey: undefined, sourceUrl: formUrl, sourceMimeType: contentType, parts: [{ type: "text" as const, text: `PUBLIC FORM LINK\\n${formUrl}\\n\\nFORM CONTENT\\n${text.slice(0, 120_000)}` }] };
  }
  if (input.sourceText) {
    return { sourceType: "pasted", sourceName: "Pasted form copy", sourceKey: undefined, sourceUrl: undefined, sourceMimeType: "text/plain", parts: [{ type: "text" as const, text: `PASTED FORM COPY\\n${input.sourceText.slice(0, 120_000)}` }] };
  }
  throw new Error("Add a public form link, paste a form copy, or upload a PDF/text copy before continuing.");
}

async function prepareGuestFormSource(input: z.infer<typeof guestFormAnalysisInputSchema>) {
  if (input.formText) {
    return { sourceName: input.formName, parts: [{ type: "text" as const, text: `FORM COPY — ${input.formName}\n${input.formText.slice(0, 80_000)}` }] };
  }
  if (!input.formUrl) throw new Error("Add a public form link, paste its text, or upload a readable form copy before continuing.");
  const formUrl = safeFormUrl(input.formUrl);
  const response = await fetch(formUrl, { signal: AbortSignal.timeout(12_000), headers: { Accept: "application/pdf,text/html,text/plain,*/*" } });
  if (!response.ok) throw new Error(`Bridge could not open that link (HTTP ${response.status}). Check that it is public and try again.`);
  const contentType = response.headers.get("content-type")?.split(";")[0] || "text/html";
  if (contentType === "application/pdf" || formUrl.toLowerCase().endsWith(".pdf")) {
    return {
      sourceName: input.formName,
      parts: [
        { type: "text" as const, text: `PUBLIC FORM LINK — ${formUrl}\nRead the questions and instructions from this public PDF form. Do not infer fields that are not visible.` },
        { type: "file_url" as const, file_url: { url: formUrl, mime_type: "application/pdf" as const } },
      ],
    };
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 8 * 1024 * 1024) throw new Error("Bridge could not read this linked form in the current request. Download it and add the copy directly instead.");
  const text = contentType.includes("html") ? stripHtml(bytes.toString("utf8")) : bytes.toString("utf8");
  return { sourceName: input.formName, parts: [{ type: "text" as const, text: `PUBLIC FORM LINK — ${formUrl}\n\nFORM CONTENT\n${text.slice(0, 80_000)}` }] };
}

function buildSupportingContext(documents: z.infer<typeof documentContextSchema>[]) {
  if (!documents.length) return "No supporting documents supplied.";
  return documents.map((document, index) => `SUPPORTING SOURCE ${index + 1}: ${document.name}\nContext label: ${document.contextLabel || "No label supplied"}\n${document.truncated ? "Note: this is an excerpt from a longer source.\n" : ""}${document.text}`).join("\n\n---\n\n");
}

type LlmResponse = {
  choices?: Array<{ message?: { content?: unknown } }>;
};

function responseText(response: LlmResponse) {
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("\n")
      .trim();
  }
  return "";
}

function parseEvidenceResponse(response: LlmResponse) {
  const raw = responseText(response).replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(raw) as {
      eventDate?: string;
      dateConfidence?: string;
      organisation?: string;
      itemType?: string;
      sender?: string;
      recipient?: string;
      subject?: string;
      summary?: string;
      deadlines?: string[];
      tags?: string[];
    };
    return {
      eventDate: (parsed.eventDate || "").slice(0, 64),
      dateConfidence: ["exact", "month", "year", "inferred", "unknown"].includes(parsed.dateConfidence || "") ? parsed.dateConfidence! : "unknown",
      organisation: (parsed.organisation || "").slice(0, 255),
      itemType: (parsed.itemType || "Document").slice(0, 120),
      sender: (parsed.sender || "").slice(0, 255),
      recipient: (parsed.recipient || "").slice(0, 255),
      subject: (parsed.subject || "").slice(0, 2_000),
      summary: (parsed.summary || "").slice(0, 6_000),
      deadlines: Array.from(new Set((parsed.deadlines || []).filter(Boolean))).slice(0, 20),
      tags: Array.from(new Set((parsed.tags || []).filter(Boolean))).slice(0, 20),
    };
  } catch {
    throw new Error("Bridge could not read the Evidence extraction. Please try a clearer source or add it as a manual note.");
  }
}

function cleanEvidenceFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._ -]/g, "-").replace(/\s+/g, "-").slice(0, 120) || "Evidence-item";
}

function buildCanonicalEvidenceName(eventDate: string, youRef: string, organisation: string, originalName: string) {
  const datePart = /^\d{4}-\d{2}-\d{2}/.test(eventDate) ? eventDate.slice(0, 10) : "DATE-UNCLEAR";
  const organisationPart = cleanEvidenceFilename(organisation || "Uncategorised");
  return `${datePart}__${youRef}__${organisationPart}__${cleanEvidenceFilename(originalName)}`.slice(0, 360);
}

async function prepareEvidenceSource(input: { fileBase64?: string; fileName?: string; mimeType?: string; sourceText?: string }, userId: number) {
  if (input.fileBase64) {
    const raw = input.fileBase64.replace(/^data:[^;]+;base64,/, "");
    const bytes = Buffer.from(raw, "base64");
    if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw new Error("Evidence files must be smaller than 8 MB in this first release.");
    const mimeType = input.mimeType || "application/pdf";
    const originalName = cleanEvidenceFilename(input.fileName || "Evidence-upload");
    const extension = originalName.includes(".") ? "" : mimeType === "application/pdf" ? ".pdf" : ".txt";
    const uploaded = await storagePut(`bridge-evidence/${userId}/${crypto.randomUUID()}-${originalName}${extension}`, bytes, mimeType);
    const signedUrl = await storageGetSignedUrl(uploaded.key);
    const sourceHash = createHash("sha256").update(bytes).digest("hex");
    if (mimeType === "application/pdf") {
      return {
        sourceType: "upload",
        originalName: input.fileName || "Evidence upload",
        sourceKey: uploaded.key,
        sourceUrl: uploaded.url,
        sourceMimeType: mimeType,
        sourceHash,
        extractedText: "",
        parts: [{ type: "text" as const, text: "The user uploaded this evidence item. Extract only the item-level metadata requested." }, { type: "file_url" as const, file_url: { url: signedUrl, mime_type: "application/pdf" as const } }],
      };
    }
    if (mimeType.startsWith("image/")) {
      return {
        sourceType: "upload",
        originalName: input.fileName || "Evidence image",
        sourceKey: uploaded.key,
        sourceUrl: uploaded.url,
        sourceMimeType: mimeType,
        sourceHash,
        extractedText: "",
        parts: [{ type: "text" as const, text: "The user uploaded this image evidence item. Read only visible details needed for the requested metadata." }, { type: "image_url" as const, image_url: { url: signedUrl, detail: "high" as const } }],
      };
    }
    const extractedText = mimeType.includes("html") ? stripHtml(bytes.toString("utf8")) : bytes.toString("utf8");
    return {
      sourceType: "upload",
      originalName: input.fileName || "Evidence upload",
      sourceKey: uploaded.key,
      sourceUrl: uploaded.url,
      sourceMimeType: mimeType,
      sourceHash,
      extractedText: extractedText.slice(0, 120_000),
      parts: [{ type: "text" as const, text: `EVIDENCE SOURCE\n${extractedText.slice(0, 120_000)}` }],
    };
  }
  if (input.sourceText) {
    const text = input.sourceText.slice(0, 120_000);
    return {
      sourceType: "manual_note",
      originalName: input.fileName || "Manual evidence note",
      sourceKey: undefined,
      sourceUrl: undefined,
      sourceMimeType: "text/plain",
      sourceHash: createHash("sha256").update(text).digest("hex"),
      extractedText: text,
      parts: [{ type: "text" as const, text: `MANUAL EVIDENCE NOTE\n${text}` }],
    };
  }
  throw new Error("Upload one document/image or paste a manual evidence note before continuing.");
}

const BRIDGE_SYSTEM_PROMPT = `You are Bridge, an accessibility-focused communication translator.

You translate natural, nonlinear, relational, gestalt, polyvalent, dyslexic, hyperlexic, autistic, ADHD, alexithymic, multilingual, AAC-supported, or otherwise non-standard communication into a form another person or institution can understand.

This system combines Granny/Ree OS relational translation with Vector Keel systems mapping. Treat the user's communication as a valid dialect and a compressed model of a larger system. The user owns the meaning. Their confirmed meaning map outranks your interpretation.

Core rules:
- Assume competence. Word-finding difficulty, fragments, repetition, tangents, indirect phrasing and functional descriptions are routing differences, not evidence of confusion.
- Capture connected nodes before sequencing them. Apparent tangents may contain causes, constraints, impacts, relationships, and requested outcomes.
- Treat metaphors, examples, stories, environmental observations and workflows as data. Extract the underlying principle without flattening the relationship between parts.
- Preserve facts, intent, boundaries, agency, emotional impact where relevant, and the user's desired outcome.
- Never invent or silently repair dates, names, diagnoses, events, quotations, reference numbers, legal duties, medical conclusions, benefit entitlement, document contents or certainty.
- Distinguish the user's account, supplied evidence, and your inference. Mark uncertainty clearly with phrases such as “date unclear”, “the user's account states”, “not established by the supplied material”, or “possible inference”.
- Do not make the user sound childish, submissive, excessively apologetic or less certain than their evidence supports.
- Do not diagnose, provide legal/medical/benefits advice, or claim that a draft is professionally sufficient. Produce a structured draft for the user to review.
- For institutional outputs, organise the meaning into clear linear sections appropriate to the destination. For personal outputs, preserve warmth and relational meaning.

At mapping stage, return exactly these labelled sections: WHAT I THINK YOU MEAN; WHAT HAPPENED OR NEEDS SAYING; WHY IT MATTERS; OUTCOME YOU WANT; EVIDENCE AND SOURCES FOUND; UNCERTAIN, CONFLICTING OR MISSING INFORMATION; CONFIRMATION QUESTION.

At final stage, return only the destination document, then an optional SOURCES OR EVIDENCE NOTE, then a short CHECK BEFORE USING section containing only genuine uncertainties or high-stakes cautions.`;

function buildInput(input: z.infer<typeof translationInputSchema>) {
  const documents = input.documentContext.length
    ? input.documentContext.map((document, index) => `SOURCE ${index + 1}: ${document.name}\nContext label: ${document.contextLabel || "No label supplied"}\n${document.truncated ? "Note: this is an excerpt from a longer source.\n" : ""}DOCUMENT CONTEXT\n${document.text}`).join("\n\n---\n\n")
    : "No document context supplied.";
  return `COMMUNICATION PROFILE\nTraits or preferences: ${input.traits.length ? input.traits.join(", ") : "None selected"}\nAdditional description: ${input.profileDescription || "None provided"}\n\nDESTINATION\nPurpose: ${input.purpose}\nOutput style: ${input.outputStyle}\nAdditional context: ${input.extraContext || "None provided"}\nPreserve emotional meaning: ${input.preserveEmotion ? "Yes, where relevant" : "Keep the underlying impact but reduce emotionally loaded phrasing"}\n\nDOCUMENT CONTEXT\nTreat these as supplied background material. Do not infer facts beyond the text, and do not confuse them with the user's own request.\n${documents}\n\nNATURAL INPUT — THE USER'S OWN WORDS AND REQUEST\n${input.sourceText}`;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  translate: router({
    mapMeaning: publicProcedure
      .input(translationInputSchema)
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) enforceGuestTranslationLimit(ctx.req.ip, ctx.req.headers["x-forwarded-for"]);
        const response = await invokeLLM({
          messages: [
            { role: "system", content: BRIDGE_SYSTEM_PROMPT },
            {
              role: "user",
              content: `${buildInput(input)}\n\nTASK\nMap the user's meaning. Do not draft the polished destination document yet. Use the required labelled sections and finish with one concise written confirmation question.`,
            },
          ],
          reasoning: { effort: "low" },
        });
        const meaningMap = responseText(response);
        if (!meaningMap) throw new Error("The mapping service returned no content");
        return { meaningMap };
      }),

    finalize: publicProcedure
      .input(
        translationInputSchema.extend({
          meaningMap: z.string().min(1).max(30000),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) enforceGuestTranslationLimit(ctx.req.ip, ctx.req.headers["x-forwarded-for"]);
        const response = await invokeLLM({
          messages: [
            { role: "system", content: BRIDGE_SYSTEM_PROMPT },
            {
              role: "user",
              content: `${buildInput(input)}\n\nCONFIRMED MEANING MAP\n${input.meaningMap}\n\nTASK\nThe user has reviewed or accepted this meaning map. Build the requested destination output now. Preserve the confirmed meaning exactly and use the requested style. Do not add facts.`,
            },
          ],
          reasoning: { effort: "low" },
        });
        const translation = responseText(response);
        if (!translation) throw new Error("The translation service returned no content");
        return { translation, meaningMap: input.meaningMap };
      }),

    save: protectedProcedure
      .input(
        translationInputSchema.extend({
          meaningMap: z.string().min(1).max(30000),
          translation: z.string().min(1).max(60000),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const historyId = await createTranslationJob({
          userId: ctx.user.id,
          sourceText: input.sourceText,
          traitsJson: JSON.stringify(input.traits),
          profileDescription: input.profileDescription || null,
          purpose: input.purpose,
          outputStyle: input.outputStyle,
          extraContext: input.extraContext || null,
          preserveEmotion: input.preserveEmotion ? 1 : 0,
          meaningMap: input.meaningMap,
          translation: input.translation,
        });
        await createAuditLog({
          userId: ctx.user.id,
          action: "translation_generated",
          resourceType: "translation_job",
          resourceId: historyId,
          metadataJson: JSON.stringify({ purpose: input.purpose, outputStyle: input.outputStyle }),
        });
        return { historyId };
      }),
  }),

  forms: router({
    triage: publicProcedure
      .input(guestFormAnalysisInputSchema)
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) enforceGuestTranslationLimit(ctx.req.ip, ctx.req.headers["x-forwarded-for"]);
        const source = await prepareGuestFormSource(input);
        const response = await invokeLLM({
          messages: [
            { role: "system", content: `${BRIDGE_SYSTEM_PROMPT}\n\nYou are Bridge Forms Triage. This is not official form completion. Your job is to make a large or difficult form navigable in under ten minutes. Return plain editable text only; do not return JSON, tables, Markdown code blocks, or a completed official form. Cover the full route through a long numbered form: compress basic-identity blocks where appropriate, but do not stop after introductory questions when later functional, needs, or impact sections are present.` },
            {
              role: "user",
              content: [
                ...source.parts,
                { type: "text", text: `\n\nUSER CONTEXT — WHAT THEY NEED TO SAY OR APPLY FOR\n${input.naturalStory}\n\nSUPPORTING DOCUMENT CONTEXT\nTreat these as background evidence. Do not present diagnosis, dates, references, or claims as certain unless the supplied material establishes them.\n${buildSupportingContext(input.supportingContext)}\n\nTASK\nCreate a short, practical FORM TRIAGE SUMMARY. Start with two or three sentences explaining what this form is for in plain English. Then list the form's most important questions or sections in its own order, using this exact plain-text pattern:\n\n1. ANSWERED — [question or section]\nWhat it means: [plain English]\nCurrent evidence or draft notes: [short supported summary]\nCheck before using: [only a real uncertainty, otherwise say “Nothing obvious from the supplied sources.”]\n\n2. PARTLY ANSWERED — [question or section]\nWhat it means: [plain English]\nWhat is already covered: [short supported summary]\nStill needs clarifying: [the smallest missing detail]\n\n3. NEEDS CLARIFICATION — [question or section]\nWhat it means: [plain English]\nStill needed: [specific question for the user]\n\nDo not attempt to complete the official form. Do not manufacture questions that are not in the form. Prioritise the questions that matter most or that the supplied sources can help with. End with NEXT SMALLEST STEPS: and a short numbered list of the most useful information to add next.` },
              ],
            },
          ],
          reasoning: { effort: "low" },
        });
        const triage = responseText(response);
        const hasTriageStatus = /\b(?:ANSWERED|PARTLY ANSWERED|NEEDS CLARIFICATION)\b/i.test(triage);
        const hasPlainEnglishExplanation = /\b(?:What it means|What is already covered|Still needs clarifying|Still needed)\b/i.test(triage);
        const fallback = `FORM TRIAGE SUMMARY\n\n1. FORM SUPPLIED — ${source.sourceName}\nWhat it means: Bridge has your form source, but could not yet produce a detailed reading of its questions.\nStill needed: Paste the specific section or question you want to work through first.\n\n2. CONTEXT RECEIVED\nWhat is already covered: ${input.naturalStory.slice(0, 1_500)}\n\n3. SUPPORTING SOURCES\nWhat is already covered: ${input.supportingContext.length ? `${input.supportingContext.length} supporting source${input.supportingContext.length === 1 ? " was" : "s were"} added as background context.` : "No supporting sources were added."}\n\nNEXT SMALLEST STEPS:\n1. Paste one form question or section into Bridge.\n2. Add the smallest real-world example that answers it.\n3. Build a fresh triage before copying anything into the official form.`;
        return { formTitle: source.sourceName, triage: hasTriageStatus && hasPlainEnglishExplanation ? triage : fallback };
      }),
    answerList: publicProcedure.input(z.object({
      formName: z.string().min(1).max(255),
      triage: z.string().min(1).max(80_000),
      userContext: z.string().max(30_000).default(""),
    })).mutation(async ({ ctx, input }) => {
      if (!ctx.user) enforceGuestTranslationLimit(ctx.req.ip, ctx.req.headers["x-forwarded-for"]);
      const response = await invokeLLM({
        messages: [
          { role: "system", content: `${BRIDGE_SYSTEM_PROMPT}\n\nYou turn a Bridge Form Triage into an editable COPY-AND-PASTE ANSWER LIST. This is not official form completion, legal advice, or a submission. Return plain editable text only.` },
          { role: "user", content: `FORM: ${input.formName}\n\nCURRENT FORM TRIAGE\n${input.triage}\n\nUSER CONTEXT\n${input.userContext}\n\nTASK\nCreate a COPY-AND-PASTE ANSWER LIST for the questions or sections actually covered in the triage. For each, use this exact structure:\n\nQUESTION / SECTION: [name]\nCOPY-AND-PASTE DRAFT: [only a supported, editable draft; otherwise write “Leave blank until you add the detail below.”]\nSTILL CHECK OR ADD: [the smallest factual detail to confirm]\n\nDo not invent evidence, dates, diagnoses, question text, or eligibility. Do not claim the whole official form is complete. End with NOT YET COVERED: and list any form sections the triage did not reach.` },
        ],
        reasoning: { effort: "low" },
      });
      const answerList = responseText(response);
      const fallback = `COPY-AND-PASTE ANSWER LIST\n\nBridge could not safely turn this triage into separate answer blocks yet. Keep the triage open beside the official form, copy only the parts you have checked, and add one missing fact at a time before building an updated triage.\n\nNOT YET COVERED:\nReview the official form against the triage before treating any section as ready.`;
      return { answerList: answerList.includes("QUESTION / SECTION") ? answerList : fallback };
    }),
    analyze: publicProcedure.input(guestFormAnalysisInputSchema).mutation(() => {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Structured form extraction is staged off. Use forms.triage for the current guest-first Form Triage workflow." });
    }),
    refine: publicProcedure.input(z.object({ formTitle: z.string(), questions: z.array(formQuestionSchema), additionalContext: z.string(), supportingContext: z.array(documentContextSchema).default([]) })).mutation(() => {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Structured form refinement is staged off. Use forms.triage with refreshed context for the current workflow." });
    }),
    saveGuestResult: protectedProcedure
      .input(z.object({
        formTitle: z.string().min(1).max(255),
        sourceName: z.string().max(255).optional().default("Form source"),
        questions: z.array(formQuestionSchema).min(1).max(120),
        missing: z.array(z.string().max(500)).max(120),
      }))
      .mutation(async ({ ctx, input }) => {
        const sessionId = await createFormSession({
          userId: ctx.user.id,
          sourceType: "guest_local",
          sourceName: input.sourceName || "Form source",
          sourceUrl: null,
          sourceKey: null,
          sourceMimeType: "browser-held",
          formTitle: input.formTitle,
          questionsJson: JSON.stringify(input.questions),
          answersJson: JSON.stringify(Object.fromEntries(input.questions.map((question) => [question.id, question.answer]))),
          missingJson: JSON.stringify(input.missing),
          status: input.missing.length ? "in_progress" : "ready",
        });
        await createAuditLog({ userId: ctx.user.id, action: "form_saved", resourceType: "form_session", resourceId: sessionId, metadataJson: JSON.stringify({ questionCount: input.questions.length, missingCount: input.missing.length }) });
        return { sessionId };
      }),
    saveWorkspace: protectedProcedure
      .input(z.object({
        sessionId: z.number().int().positive().optional(),
        formTitle: z.string().min(1).max(255),
        sourceName: z.string().max(255).optional().default("Form source"),
        formContextSummary: z.string().max(2_000).optional().default(""),
        userContext: z.string().max(30_000).default(""),
        triage: z.string().min(1).max(80_000),
        answerList: z.string().max(80_000).optional().default(""),
      }))
      .mutation(async ({ ctx, input }) => {
        const savedValues = {
          sourceType: "guest_prompt",
          sourceName: input.sourceName || "Form source",
          sourceUrl: null,
          sourceKey: null,
          sourceMimeType: "browser-held",
          formTitle: input.formTitle,
          questionsJson: "[]",
          answersJson: "{}",
          missingJson: "[]",
          formContextSummary: input.formContextSummary || null,
          userContext: input.userContext || null,
          triage: input.triage,
          answerList: input.answerList || null,
          status: "prompt_saved",
        };
        const sessionId = input.sessionId ?? await createFormSession({ userId: ctx.user.id, ...savedValues });
        if (input.sessionId) await updateFormSession(ctx.user.id, input.sessionId, savedValues);
        await createAuditLog({
          userId: ctx.user.id,
          action: "form_workspace_saved",
          resourceType: "form_session",
          resourceId: sessionId,
          metadataJson: JSON.stringify({ documentFilesSaved: false, savedFields: ["form source name", "local form summary", "typed context", "triage", "answer list"] }),
        });
        return { sessionId };
      }),
    extract: protectedProcedure
      .input(z.object({
        formUrl: z.string().url().max(2000).optional(),
        fileBase64: z.string().max(12_000_000).optional(),
        fileName: z.string().max(255).optional(),
        mimeType: z.enum(["application/pdf", "text/plain", "text/html", "application/rtf", "image/jpeg", "image/png", "image/webp"]).optional(),
        sourceText: z.string().max(120_000).optional(),
        naturalStory: z.string().min(1).max(30_000),
        traits: traitSchema,
        profileDescription: z.string().max(2_000).optional().default(""),
      }).refine((input) => Boolean(input.formUrl || input.fileBase64 || input.sourceText), { message: "Add a form link, upload a form copy, or paste the form text." }))
      .mutation(async ({ ctx, input }) => {
        const source = await prepareFormSource(input, ctx.user.id);
        const response = await invokeLLM({
          messages: [
            { role: "system", content: `${BRIDGE_SYSTEM_PROMPT}\n\n${FORM_SYSTEM_PROMPT}` },
            {
              role: "user",
              content: [
                ...source.parts,
                { type: "text", text: `\n\nUSER COMMUNICATION PROFILE\nTraits: ${input.traits.length ? input.traits.join(", ") : "None selected"}\nDescription: ${input.profileDescription || "None provided"}\n\nUSER'S NATURAL ACCOUNT\n${input.naturalStory}\n\nTASK\nExtract the form fields in order and draft only answers supported by the user's account. Flag everything that needs their attention.` },
              ],
            },
          ],
          response_format: { type: "json_schema", json_schema: { name: "bridge_form_extraction", strict: true, schema: formExtractionResponseSchema } },
          reasoning: { effort: "low" },
        });
        const result = normaliseFormResult(parseJsonResponse(response));
        const sessionId = await createFormSession({
          userId: ctx.user.id,
          sourceType: source.sourceType,
          sourceName: source.sourceName || null,
          sourceUrl: source.sourceUrl || null,
          sourceKey: source.sourceKey || null,
          sourceMimeType: source.sourceMimeType || null,
          formTitle: result.formTitle,
          questionsJson: JSON.stringify(result.questions),
          answersJson: JSON.stringify(Object.fromEntries(result.questions.map((question) => [question.id, question.answer]))),
          missingJson: JSON.stringify(result.missing),
          status: "extracted",
        });
        await createAuditLog({ userId: ctx.user.id, action: "form_extracted", resourceType: "form_session", resourceId: sessionId, metadataJson: JSON.stringify({ sourceType: source.sourceType, questionCount: result.questions.length }) });
        return { sessionId, ...result, sourceType: source.sourceType, sourceName: source.sourceName || "Form source", sourceUrl: source.sourceUrl || null };
      }),
    reconcile: protectedProcedure
      .input(z.object({
        sessionId: z.number().int().positive(),
        naturalStory: z.string().min(1).max(30_000),
        traits: traitSchema,
        profileDescription: z.string().max(2_000).optional().default(""),
        questions: z.array(formQuestionSchema).max(120),
      }))
      .mutation(async ({ ctx, input }) => {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: `${BRIDGE_SYSTEM_PROMPT}\n\n${FORM_SYSTEM_PROMPT}` },
            { role: "user", content: `CURRENT FORM FIELDS\n${JSON.stringify(input.questions)}\n\nUSER COMMUNICATION PROFILE\nTraits: ${input.traits.join(", ") || "None selected"}\nDescription: ${input.profileDescription || "None provided"}\n\nNEW OR CLARIFYING ACCOUNT\n${input.naturalStory}\n\nTASK\nUpdate only the answers and missing-information flags. Do not invent new questions or facts.` },
          ],
          response_format: { type: "json_schema", json_schema: { name: "bridge_form_reconciliation", strict: true, schema: formExtractionResponseSchema } },
          reasoning: { effort: "low" },
        });
        const result = normaliseFormResult(parseJsonResponse(response));
        await updateFormSession(ctx.user.id, input.sessionId, {
          questionsJson: JSON.stringify(result.questions),
          answersJson: JSON.stringify(Object.fromEntries(result.questions.map((question) => [question.id, question.answer]))),
          missingJson: JSON.stringify(result.missing),
          status: result.missing.length ? "in_progress" : "ready",
        });
        await createAuditLog({ userId: ctx.user.id, action: "form_reconciled", resourceType: "form_session", resourceId: input.sessionId, metadataJson: JSON.stringify({ questionCount: result.questions.length, missingCount: result.missing.length }) });
        return result;
      }),
    update: protectedProcedure
      .input(z.object({ sessionId: z.number().int().positive(), formTitle: z.string().min(1).max(255), questions: z.array(formQuestionSchema).max(120), missing: z.array(z.string().max(500)).max(120), status: z.enum(["in_progress", "ready", "extracted"]).default("in_progress") }))
      .mutation(async ({ ctx, input }) => {
        await updateFormSession(ctx.user.id, input.sessionId, {
          formTitle: input.formTitle,
          questionsJson: JSON.stringify(input.questions),
          answersJson: JSON.stringify(Object.fromEntries(input.questions.map((question) => [question.id, question.answer]))),
          missingJson: JSON.stringify(input.missing),
          status: input.status,
        });
        await createAuditLog({ userId: ctx.user.id, action: "form_saved", resourceType: "form_session", resourceId: input.sessionId, metadataJson: JSON.stringify({ questionCount: input.questions.length, missingCount: input.missing.length }) });
        return { success: true } as const;
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await deleteFormSession(ctx.user.id, input.id);
        await createAuditLog({ userId: ctx.user.id, action: "form_deleted", resourceType: "form_session", resourceId: input.id });
        return { success: true } as const;
      }),
    list: protectedProcedure.query(({ ctx }) => getFormSessionsByUser(ctx.user.id)),
  }),

  evidence: router({
    /** Legacy endpoint intentionally disabled: Evidence is now a local, download-only packet builder. */
    ingest: publicProcedure
      .input(z.object({ fileBase64: z.string().max(12_000_000).optional(), fileName: z.string().max(255).optional(), sourceText: z.string().max(120_000).optional() }))
      .mutation(() => {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Bridge Evidence is download-only in this release. Build and download a local packet; cloud storage is not available." });
      }),
    list: publicProcedure.query(() => []),
    review: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(() => {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Bridge Evidence records are edited locally before download; cloud storage is not available." });
    }),
    delete: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(() => ({ success: true } as const)),
  }),

  history: router({
    list: protectedProcedure.query(({ ctx }) => getTranslationJobsByUser(ctx.user.id)),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await deleteTranslationJob(ctx.user.id, input.id);
        await createAuditLog({ userId: ctx.user.id, action: "translation_deleted", resourceType: "translation_job", resourceId: input.id });
        return { success: true } as const;
      }),
    clear: protectedProcedure.mutation(async ({ ctx }) => {
      await clearTranslationJobs(ctx.user.id);
      await createAuditLog({ userId: ctx.user.id, action: "history_cleared", resourceType: "translation_history" });
      return { success: true } as const;
    }),
  }),

  profiles: router({
    list: protectedProcedure.query(({ ctx }) => getSavedProfilesByUser(ctx.user.id)),
    save: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(120),
          traits: traitSchema,
          description: z.string().max(2000).optional().default(""),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const profileId = await createSavedProfile({
          userId: ctx.user.id,
          name: input.name,
          traitsJson: JSON.stringify(input.traits),
          description: input.description || null,
        });
        await createAuditLog({ userId: ctx.user.id, action: "profile_saved", resourceType: "saved_profile", resourceId: profileId });
        return { profileId };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await deleteSavedProfile(ctx.user.id, input.id);
        await createAuditLog({ userId: ctx.user.id, action: "profile_deleted", resourceType: "saved_profile", resourceId: input.id });
        return { success: true } as const;
      }),
  }),

  account: router({
    deleteSavedData: protectedProcedure.mutation(async ({ ctx }) => {
      await deleteAllBridgeData(ctx.user.id);
      return { success: true } as const;
    }),
  }),

  voice: router({
    transcribe: protectedProcedure
      .input(
        z.object({
          audioBase64: z.string().min(1).max(24_000_000),
          mimeType: z.enum(["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg", "audio/x-m4a"]),
          language: z.string().max(8).optional().default("en"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const rawBase64 = input.audioBase64.replace(/^data:[^;]+;base64,/, "");
        const bytes = Buffer.from(rawBase64, "base64");
        if (bytes.length > 16 * 1024 * 1024) {
          throw new Error("That recording is over the 16 MB voice limit. Try a shorter recording.");
        }
        const extension = input.mimeType.split("/")[1].replace("x-", "");
        const uploaded = await storagePut(
          `bridge-voice/${ctx.user.id}/${crypto.randomUUID()}.${extension}`,
          bytes,
          input.mimeType,
        );
        const signedUrl = await storageGetSignedUrl(uploaded.key);
        const result = await transcribeAudio({
          audioUrl: signedUrl,
          language: input.language,
          prompt: "Transcribe the user's natural speech faithfully. Preserve fragments, repetitions, names, dates, and uncertainty. Do not summarise.",
        });
        if ("error" in result) throw new Error(result.error);
        return { text: result.text };
      }),
  }),
});

export type AppRouter = typeof appRouter;
