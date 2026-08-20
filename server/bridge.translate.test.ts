import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invokeLLM: vi.fn(),
  clearTranslationJobs: vi.fn(),
  createAuditLog: vi.fn(),
  createEvidenceItem: vi.fn(),
  createFormSession: vi.fn(),
  createSavedProfile: vi.fn(),
  createTranslationJob: vi.fn(),
  deleteAllBridgeData: vi.fn(),
  deleteEvidenceItem: vi.fn(),
  deleteFormSession: vi.fn(),
  deleteSavedProfile: vi.fn(),
  deleteTranslationJob: vi.fn(),
  getEvidenceItemsByUser: vi.fn(),
  getFormSessionsByUser: vi.fn(),
  getSavedProfilesByUser: vi.fn(),
  getTranslationJobsByUser: vi.fn(),
  updateEvidenceItem: vi.fn(),
  updateFormSession: vi.fn(),
}));

vi.mock("./_core/llm", () => ({ invokeLLM: mocks.invokeLLM }));
vi.mock("./db", () => ({
  clearTranslationJobs: mocks.clearTranslationJobs,
  createAuditLog: mocks.createAuditLog,
  createEvidenceItem: mocks.createEvidenceItem,
  createFormSession: mocks.createFormSession,
  createSavedProfile: mocks.createSavedProfile,
  createTranslationJob: mocks.createTranslationJob,
  deleteAllBridgeData: mocks.deleteAllBridgeData,
  deleteEvidenceItem: mocks.deleteEvidenceItem,
  deleteFormSession: mocks.deleteFormSession,
  deleteSavedProfile: mocks.deleteSavedProfile,
  deleteTranslationJob: mocks.deleteTranslationJob,
  getEvidenceItemsByUser: mocks.getEvidenceItemsByUser,
  getFormSessionsByUser: mocks.getFormSessionsByUser,
  getSavedProfilesByUser: mocks.getSavedProfilesByUser,
  getTranslationJobsByUser: mocks.getTranslationJobsByUser,
  updateEvidenceItem: mocks.updateEvidenceItem,
  updateFormSession: mocks.updateFormSession,
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function context(user: AuthenticatedUser | null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {}, ip: "127.0.0.1" } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

const sampleUser: AuthenticatedUser = {
  id: 42,
  openId: "bridge-test-user",
  email: "bridge@example.com",
  name: "Bridge Tester",
  loginMethod: "manus",
  role: "user",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

const baseInput = {
  sourceText: "The form keeps asking for the thing that proves what happened, but the dates are in different letters.",
  traits: ["Word-finding difficulty", "Networked thinking"],
  profileDescription: "I explain by relationships and examples.",
  purpose: "Simple timeline",
  outputStyle: "Bullet points",
  extraContext: "Keep the uncertainty visible.",
  preserveEmotion: true,
};

describe("Bridge guest and saved-work boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createTranslationJob.mockResolvedValue(88);
    mocks.createFormSession.mockResolvedValue(21);
    mocks.createEvidenceItem.mockResolvedValue(31);
    mocks.createSavedProfile.mockResolvedValue(9);
    mocks.getTranslationJobsByUser.mockResolvedValue([]);
    mocks.getEvidenceItemsByUser.mockResolvedValue([]);
    mocks.getFormSessionsByUser.mockResolvedValue([]);
    mocks.getSavedProfilesByUser.mockResolvedValue([]);
    mocks.createAuditLog.mockResolvedValue(undefined);
    mocks.deleteAllBridgeData.mockResolvedValue(undefined);
    mocks.deleteEvidenceItem.mockResolvedValue(undefined);
    mocks.deleteFormSession.mockResolvedValue(undefined);
    mocks.deleteTranslationJob.mockResolvedValue(undefined);
    mocks.updateEvidenceItem.mockResolvedValue(undefined);
    mocks.deleteSavedProfile.mockResolvedValue(undefined);
    mocks.clearTranslationJobs.mockResolvedValue(undefined);
  });

  it("allows a guest to map their meaning without creating a saved record", async () => {
    mocks.invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: "WHAT I THINK YOU MEAN\nThe guest is testing Bridge.\n\nCONFIRMATION QUESTION\nIs that right?" } }] });
    const caller = appRouter.createCaller(context(null));
    await expect(caller.translate.mapMeaning(baseInput)).resolves.toMatchObject({ meaningMap: expect.stringContaining("WHAT I THINK YOU MEAN") });
    expect(mocks.createTranslationJob).not.toHaveBeenCalled();
  });

  it("keeps uploaded document context separate from the user’s own request", async () => {
    mocks.invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: "WHAT I THINK YOU MEAN\nThe source is context; the user still owns the request.\n\nCONFIRMATION QUESTION\nIs that right?" } }] });
    const caller = appRouter.createCaller(context(null));
    await caller.translate.mapMeaning({
      ...baseInput,
      sourceText: "I need a clear reply about the adjustments I asked for.",
      documentContext: [{ id: "source-1", name: "Talbotts-chain.pdf", contextLabel: "Talbotts email chain", text: "The attached chain records earlier correspondence.", truncated: false }],
    });
    const request = mocks.invokeLLM.mock.calls[0][0];
    const prompt = String(request.messages[1].content);
    expect(prompt).toContain("SOURCE 1: Talbotts-chain.pdf");
    expect(prompt).toContain("Context label: Talbotts email chain");
    expect(prompt).toContain("NATURAL INPUT — THE USER'S OWN WORDS AND REQUEST\nI need a clear reply");
  });

  it("accepts ten distinct context sources while retaining the user-request boundary", async () => {
    mocks.invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: "WHAT I THINK YOU MEAN\nAll ten sources are background context.\n\nCONFIRMATION QUESTION\nIs that right?" } }] });
    const caller = appRouter.createCaller(context(null));
    const documentContext = Array.from({ length: 10 }, (_, index) => ({
      id: `source-${index + 1}`,
      name: `Source-${index + 1}.txt`,
      contextLabel: `Context ${index + 1}`,
      text: `Text from source ${index + 1}`,
      truncated: false,
    }));
    await expect(caller.translate.mapMeaning({ ...baseInput, documentContext })).resolves.toMatchObject({ meaningMap: expect.any(String) });
    const prompt = String(mocks.invokeLLM.mock.calls[0][0].messages[1].content);
    expect(prompt).toContain("SOURCE 10: Source-10.txt");
    expect(prompt).toContain("NATURAL INPUT — THE USER'S OWN WORDS AND REQUEST");
  });

  it("allows a guest to build Form Triage from browser-held supporting context without saving a session", async () => {
    mocks.invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: "FORM TRIAGE SUMMARY\n\n1. ANSWERED — Preparing food\nWhat it means: whether food can be prepared safely.\nCurrent evidence or draft notes: Support needs are described." } }] });
    const caller = appRouter.createCaller(context(null));
    const result = await caller.forms.triage({
      formName: "PIP 2 form",
      formText: "Question: tell us about preparing food.",
      naturalStory: "I am autistic and ADHD and need to complete a PIP form.",
      supportingContext: [{ id: "support-1", name: "Occupational therapist letter.pdf", contextLabel: "OT support evidence", text: "The letter records a need for kitchen support.", truncated: false }],
    });
    expect(result.formTitle).toBe("PIP 2 form");
    expect(result.triage).toContain("Current evidence or draft notes");
    expect(mocks.createFormSession).not.toHaveBeenCalled();
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
    const request = mocks.invokeLLM.mock.calls[0][0];
    const textPart = request.messages[1].content.find((part: { type?: string; text?: string }) => part.type === "text" && String(part.text).includes("USER CONTEXT"));
    expect(String(textPart.text)).toContain("SUPPORTING SOURCE 1: Occupational therapist letter.pdf");
    expect(String(textPart.text)).toContain("USER CONTEXT");
  });

  it("returns a plain-text Form Triage for a guest without fragile structured parsing or saving", async () => {
    mocks.invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: "FORM TRIAGE SUMMARY\n\n1. PARTLY ANSWERED — Preparing food\nWhat it means: whether food can be prepared safely.\nStill needs clarifying: how often support is needed." } }] });
    const caller = appRouter.createCaller(context(null));
    const result = await caller.forms.triage({
      formName: "PIP 2 form",
      formText: "Question: tell us about preparing food.",
      naturalStory: "I need help completing a PIP form.",
      supportingContext: [],
    });
    expect(result.triage).toContain("PARTLY ANSWERED");
    expect(mocks.createFormSession).not.toHaveBeenCalled();
    const prompt = String(mocks.invokeLLM.mock.calls[0][0].messages[1].content.find((part: { type?: string; text?: string }) => part.type === "text" && String(part.text).includes("FORM TRIAGE SUMMARY")).text);
    expect(prompt).toContain("Do not attempt to complete the official form.");
  });

  it("falls back to a usable Form Triage working summary when the model returns no text", async () => {
    mocks.invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: "" } }] });
    const caller = appRouter.createCaller(context(null));
    const result = await caller.forms.triage({
      formName: "PIP 2 form",
      formText: "Question: tell us about preparing food.",
      naturalStory: "I need help completing this form because fatigue affects daily activities.",
      supportingContext: [],
    });
    expect(result.triage).toContain("FORM TRIAGE SUMMARY");
    expect(result.triage).toContain("NEXT SMALLEST STEPS");
  });

  it("falls back to the working summary when the model returns non-empty but malformed Form Triage text", async () => {
    mocks.invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: "Here are some notes about the form without the requested triage structure." } }] });
    const caller = appRouter.createCaller(context(null));
    const result = await caller.forms.triage({
      formName: "PIP 2 form",
      formText: "Question: tell us about preparing food.",
      naturalStory: "I need help completing this form.",
      supportingContext: [],
    });
    expect(result.triage).toContain("FORM TRIAGE SUMMARY");
    expect(result.triage).toContain("Paste one form question or section");
  });

  it("generates a guest copy-and-paste answer list without creating a Form session", async () => {
    mocks.invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: "QUESTION / SECTION: Preparing food\nCOPY-AND-PASTE DRAFT: I need prompting to prepare food safely.\nSTILL CHECK OR ADD: Add one recent example.\n\nNOT YET COVERED: Mobility questions." } }] });
    const caller = appRouter.createCaller(context(null));
    const result = await caller.forms.answerList({
      formName: "PIP 2 form",
      triage: "FORM TRIAGE SUMMARY\n\n1. PARTLY ANSWERED — Preparing food\nWhat it means: whether food can be prepared safely.\nStill needs clarifying: one recent example.",
      userContext: "I need help completing a PIP form.",
    });
    expect(result.answerList).toContain("COPY-AND-PASTE DRAFT");
    expect(mocks.createFormSession).not.toHaveBeenCalled();
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
  });

  it("keeps Form account saving explicit and authenticated after guest analysis", async () => {
    const saveInput = {
      formTitle: "PIP 2 form",
      sourceName: "PIP 2.pdf",
      questions: [{ id: "daily-living", section: "Daily living", label: "Preparing food", prompt: "Tell us about preparing food.", helpText: "", required: true, answer: "I need prompting.", status: "answered" as const }],
      missing: [],
    };
    const guest = appRouter.createCaller(context(null));
    await expect(guest.forms.saveGuestResult(saveInput)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.createFormSession).not.toHaveBeenCalled();

    const caller = appRouter.createCaller(context(sampleUser));
    await expect(caller.forms.saveGuestResult(saveInput)).resolves.toEqual({ sessionId: 21 });
    expect(mocks.createFormSession).toHaveBeenCalledWith(expect.objectContaining({ userId: 42, formTitle: "PIP 2 form", sourceKey: null }));
    expect(mocks.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "form_saved", resourceType: "form_session", resourceId: 21 }));
  });

  it("saves an authenticated Form working prompt without retaining uploaded form or supporting-document files", async () => {
    const saveInput = {
      formTitle: "PIP 2 form",
      sourceName: "PIP 2.pdf",
      formContextSummary: "PIP daily living and mobility form",
      userContext: "I need the form to explain why fatigue affects preparing food.",
      triage: "FORM TRIAGE SUMMARY\n\n1. PARTLY ANSWERED — Preparing food",
      answerList: "QUESTION / SECTION: Preparing food\nCOPY-AND-PASTE DRAFT: I need prompting.",
    };
    const guest = appRouter.createCaller(context(null));
    await expect(guest.forms.saveWorkspace(saveInput)).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    const caller = appRouter.createCaller(context(sampleUser));
    await expect(caller.forms.saveWorkspace(saveInput)).resolves.toEqual({ sessionId: 21 });
    const saved = mocks.createFormSession.mock.calls[0]?.[0];
    expect(saved).toMatchObject({ userId: 42, sourceType: "guest_prompt", sourceName: "PIP 2.pdf", sourceUrl: null, sourceKey: null, sourceMimeType: "browser-held", formTitle: "PIP 2 form", userContext: saveInput.userContext, triage: saveInput.triage, answerList: saveInput.answerList, questionsJson: "[]" });
    expect(saved).not.toHaveProperty("formText");
    expect(saved).not.toHaveProperty("supportingContext");
    expect(mocks.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "form_workspace_saved", metadataJson: expect.stringContaining('"documentFilesSaved":false') }));
  });

  it("includes a review-stage correction as explicit additional context without saving it", async () => {
    mocks.invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: "WHAT I THINK YOU MEAN\nThe added reference belongs in the final draft.\n\nCONFIRMATION QUESTION\nIs that right?" } }] });
    const caller = appRouter.createCaller(context(null));
    await caller.translate.mapMeaning({
      ...baseInput,
      extraContext: "Keep the uncertainty visible.\n\nAdditional context added during meaning-map review:\nCourt reference: ABC-123.",
    });
    const request = mocks.invokeLLM.mock.calls[0][0];
    const prompt = String(request.messages[1].content);
    expect(prompt).toContain("Additional context added during meaning-map review:");
    expect(prompt).toContain("Court reference: ABC-123.");
    expect(mocks.createTranslationJob).not.toHaveBeenCalled();
  });

  it("rejects empty guest input before making an LLM call", async () => {
    const caller = appRouter.createCaller(context(null));
    await expect(caller.translate.mapMeaning({ ...baseInput, sourceText: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.invokeLLM).not.toHaveBeenCalled();
  });

  it("builds a guest final draft without automatic history persistence", async () => {
    mocks.invokeLLM
      .mockResolvedValueOnce({ choices: [{ message: { content: "WHAT I THINK YOU MEAN\nThe guest wants a short timeline.\n\nCONFIRMATION QUESTION\nIs that right?" } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: "Simple timeline\n- Date conflict remains unresolved." } }] });
    const caller = appRouter.createCaller(context(null));
    const mapped = await caller.translate.mapMeaning(baseInput);
    const result = await caller.translate.finalize({ ...baseInput, meaningMap: mapped.meaningMap });
    expect(result.translation).toContain("Simple timeline");
    expect(mocks.createTranslationJob).not.toHaveBeenCalled();
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
  });

  it("saves a reviewed draft only after an authenticated user explicitly asks", async () => {
    const caller = appRouter.createCaller(context(sampleUser));
    const result = await caller.translate.save({ ...baseInput, meaningMap: "Confirmed meaning", translation: "Editable draft" });
    expect(result.historyId).toBe(88);
    expect(mocks.createTranslationJob).toHaveBeenCalledWith(expect.objectContaining({ userId: 42, translation: "Editable draft" }));
    expect(mocks.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "translation_generated", resourceId: 88 }));
  });

  it("keeps account history and deletion behind authentication while Evidence is a local packet workflow", async () => {
    const guest = appRouter.createCaller(context(null));
    await expect(guest.history.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(guest.evidence.list()).resolves.toEqual([]);

    const caller = appRouter.createCaller(context(sampleUser));
    await expect(caller.account.deleteSavedData()).resolves.toEqual({ success: true });
    expect(mocks.deleteAllBridgeData).toHaveBeenCalledWith(42);
  });

  it("keeps voice input signed-in and disables legacy Evidence cloud ingestion", async () => {
    const caller = appRouter.createCaller(context(null));
    await expect(caller.voice.transcribe({ audioBase64: "data:audio/webm;base64,AAAA", mimeType: "audio/webm", language: "en" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.evidence.ingest({ sourceText: "Manual note about a dated letter.", fileName: "Note" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});
