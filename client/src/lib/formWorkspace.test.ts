import { describe, expect, it } from "vitest";
import { clearCurrentFormSource } from "./formWorkspace";

describe("Forms source removal", () => {
  it("clears only the active form source fields and preserves the wider working session", () => {
    const result = clearCurrentFormSource({
      formUrl: "https://example.test/form.pdf",
      pastedText: "Pasted form copy",
      formSource: { name: "form.pdf" },
      formContextSummary: "A benefits form",
      userContext: "I need help completing this",
      triage: "Existing editable working map",
      answerList: "Existing answer list",
      supportingDocumentCount: 6,
    });

    expect(result).toMatchObject({
      formUrl: "",
      pastedText: "",
      formSource: null,
      formContextSummary: "",
      userContext: "I need help completing this",
      triage: "Existing editable working map",
      answerList: "Existing answer list",
      supportingDocumentCount: 6,
    });
  });
});
