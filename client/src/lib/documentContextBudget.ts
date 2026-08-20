export const MAX_DOCUMENT_CONTEXT_CHARS = 30_000;

export type ContextDocument = {
  id: string;
  name: string;
  contextLabel: string;
  text: string;
  truncated: boolean;
};

function excerptForBudget(text: string, budget: number, focusText = "") {
  if (text.length <= budget) return { text, truncated: false };
  const marker = "\n\n[Bridge selected the most form-relevant excerpts from this longer source]\n\n";
  const usable = Math.max(0, budget - marker.length);
  const focusTerms = Array.from(new Set((focusText.toLowerCase().match(/[a-z][a-z'-]{3,}/g) || []).filter((term) => !new Set(["that", "this", "with", "from", "what", "form", "your", "have", "need", "will", "when", "they", "their"]).has(term)))).slice(0, 28);
  const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const scored = blocks.map((block, index) => ({ block, index, score: focusTerms.reduce((score, term) => score + (block.toLowerCase().split(term).length - 1), 0) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.index - b.index);
  if (!scored.length) {
    const openingLength = Math.floor(usable * 0.75);
    const closingLength = usable - openingLength;
    return { text: `${text.slice(0, openingLength)}${marker}${text.slice(-closingLength)}`, truncated: true };
  }
  const selected = new Map<number, string>();
  for (const item of scored) {
    if (Array.from(selected.values()).join("\n\n").length >= usable) break;
    selected.set(item.index, item.block);
  }
  if (selected.size < 3 && blocks[0]) selected.set(0, blocks[0]);
  if (selected.size < 3 && blocks.at(-1)) selected.set(blocks.length - 1, blocks.at(-1)!);
  const selectedIndexes = new Set(selected.keys());
  const relevant = [
    ...scored.filter((item) => selectedIndexes.has(item.index)).map((item) => item.block),
    ...Array.from(selected.entries()).filter(([index]) => !scored.some((item) => item.index === index)).sort(([left], [right]) => left - right).map(([, block]) => block),
  ].join("\n\n");
  const excerpt = relevant.slice(0, usable);
  return {
    text: `${excerpt}${marker}`,
    truncated: true,
  };
}

/**
 * Keeps the visible shelf low-friction while holding the document payload at the
 * previously verified 30,000-character total. Every selected source remains
 * represented; longer sources become opening-and-closing excerpts only for the
 * mapping request, not in the browser-held shelf.
 */
export function budgetDocumentContext(documents: ContextDocument[], maxChars = MAX_DOCUMENT_CONTEXT_CHARS, focusText = ""): ContextDocument[] {
  if (!documents.length) return [];
  const perDocumentBudget = Math.floor(maxChars / documents.length);
  return documents.map((document) => {
    const excerpt = excerptForBudget(document.text, perDocumentBudget, `${focusText}\n${document.contextLabel}`);
    return { ...document, text: excerpt.text, truncated: document.truncated || excerpt.truncated };
  });
}
