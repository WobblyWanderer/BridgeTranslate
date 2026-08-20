import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { buildPortableEvidenceArchive, type PortableEvidenceItem } from "../client/src/lib/evidencePacket";

describe("portable Evidence packet", () => {
  it("creates a hostable chronology folder with the manual-note original and registers", async () => {
    const item: PortableEvidenceItem = {
      id: "local-1",
      youRef: "YOU-LOCAL-0001",
      originalName: "Manual-note.txt",
      canonicalName: "2026-08-18__YOU-LOCAL-0001__Example__Manual-note.txt",
      sourceMimeType: "text/plain",
      sourceText: "A manual note that must remain inside the downloaded packet.",
      eventDate: "2026-08-18",
      dateConfidence: "exact",
      organisation: "Example Council",
      itemType: "Note",
      sender: "",
      recipient: "",
      subject: "Housing contact",
      summary: "A factual local packet test.",
      tags: ["complaint"],
      deadlines: ["Reply by 2026-08-25"],
      reviewStatus: "reviewed",
      reviewNotes: "",
    };

    const { bytes, filename } = await buildPortableEvidenceArchive([item]);
    const files = unzipSync(bytes);
    const root = filename.replace(/\.zip$/, "");

    expect(Object.keys(files)).toEqual(expect.arrayContaining([
      `${root}/index.html`,
      `${root}/README.txt`,
      `${root}/manifest.json`,
      `${root}/chronology.csv`,
      `${root}/registers/deadlines.csv`,
      `${root}/registers/submissions.csv`,
      `${root}/sources/${item.canonicalName}`,
    ]));
    expect(strFromU8(files[`${root}/chronology.csv`])).toContain(item.youRef);
    expect(strFromU8(files[`${root}/sources/${item.canonicalName}`])).toContain("manual note");
    expect(strFromU8(files[`${root}/index.html`])).toContain("Bridge Evidence packet");
  });
});
