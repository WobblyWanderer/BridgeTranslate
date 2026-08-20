import { describe, expect, it } from "vitest";
import { OUTPUT_FEEDBACK } from "./outputFeedback";

describe("output-category feedback invitation", () => {
  it("keeps three public routes for lived-experience suggestions", () => {
    expect(OUTPUT_FEEDBACK.contacts.map((contact) => contact.label)).toEqual(["Facebook", "Instagram", "LinkedIn"]);
    expect(OUTPUT_FEEDBACK.copy).toContain("lived experience");
    expect(OUTPUT_FEEDBACK.gardenNote).toContain("manual-labour");
  });
});
