import { describe, expect, it } from "vitest";
import { budgetDocumentContext, MAX_DOCUMENT_CONTEXT_CHARS } from "./documentContextBudget";

describe("Bridge document context budget", () => {
  it("keeps all ten selected sources represented within the existing total request budget", () => {
    const sources = Array.from({ length: 10 }, (_, index) => ({
      id: `source-${index + 1}`,
      name: `Source ${index + 1}`,
      contextLabel: `Context ${index + 1}`,
      text: `${String(index + 1).repeat(3_600)} END-${index + 1}`,
      truncated: false,
    }));

    const budgeted = budgetDocumentContext(sources);

    expect(budgeted).toHaveLength(10);
    expect(budgeted.every((source, index) => source.name === `Source ${index + 1}`)).toBe(true);
    expect(budgeted.reduce((total, source) => total + source.text.length, 0)).toBeLessThanOrEqual(MAX_DOCUMENT_CONTEXT_CHARS);
    expect(budgeted.every((source) => source.truncated)).toBe(true);
    expect(budgeted[9]?.text).toContain("END-10");
  });

  it("leaves five or fewer short sources unchanged", () => {
    const sources = Array.from({ length: 5 }, (_, index) => ({
      id: `source-${index + 1}`,
      name: `Source ${index + 1}`,
      contextLabel: "",
      text: `Short source ${index + 1}`,
      truncated: false,
    }));

    expect(budgetDocumentContext(sources)).toEqual(sources);
  });

  it("prioritises a long source passage that matches the form focus", () => {
    const source = {
      id: "source-1",
      name: "supporting-letter.pdf",
      contextLabel: "Clinical evidence",
      text: `Administrative header ${"x".repeat(300)}\n\nDaily living and mobility: the person needs supervision when walking outdoors because fatigue and pain make falls more likely.\n\nClosing information ${"y".repeat(300)}`,
      truncated: false,
    };

    const [budgeted] = budgetDocumentContext([source], 360, "PIP mobility questions and walking outdoors");

    expect(budgeted?.text).toContain("mobility");
    expect(budgeted?.truncated).toBe(true);
  });
});
