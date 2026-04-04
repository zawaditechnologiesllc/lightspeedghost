/**
 * Context Window Manager — OpenClaw Two-Layer Memory Architecture.
 * Manages long documents (thesis, research papers) to prevent context amnesia.
 * Uses: sliding window for current section + key facts across entire document.
 */

export interface DocumentChunk {
  index: number;
  content: string;
  wordCount: number;
  keyFacts: string[];
}

const MAX_CHUNK_WORDS = 700;
const STOP_WORDS = new Set(["a","an","the","and","or","but","in","on","at","to","for","of","with","by","is","are","was","were"]);

export function chunkDocument(content: string): DocumentChunk[] {
  const sentences = content.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  const chunks: DocumentChunk[] = [];
  let current = "";
  let idx = 0;

  for (const sentence of sentences) {
    const projected = (current + " " + sentence).split(/\s+/).filter(Boolean);
    if (projected.length > MAX_CHUNK_WORDS && current.trim()) {
      chunks.push({
        index: idx++,
        content: current.trim(),
        wordCount: current.split(/\s+/).filter(Boolean).length,
        keyFacts: extractKeyFacts(current),
      });
      current = sentence;
    } else {
      current += " " + sentence;
    }
  }

  if (current.trim()) {
    chunks.push({
      index: idx,
      content: current.trim(),
      wordCount: current.split(/\s+/).filter(Boolean).length,
      keyFacts: extractKeyFacts(current),
    });
  }

  return chunks;
}

function extractKeyFacts(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter(
      (s) =>
        /\b(therefore|thus|conclude|demonstrate|show|prove|find|result|define|is defined as|hypothesis|thesis|main argument|key finding)\b/i.test(s) ||
        /\b\d+(\.\d+)?%\b/.test(s) ||
        s.length < 80
    )
    .slice(0, 4)
    .map((s) => s.trim());
}

export function buildContextWindow(
  chunks: DocumentChunk[],
  currentIndex: number,
  windowSize = 2
): string {
  const allKeyFacts = chunks
    .flatMap((c) => c.keyFacts)
    .filter(Boolean)
    .slice(0, 15)
    .join("\n• ");

  const windowStart = Math.max(0, currentIndex - windowSize);
  const windowEnd = Math.min(chunks.length - 1, currentIndex + windowSize);
  const windowContent = chunks
    .slice(windowStart, windowEnd + 1)
    .map((c) => c.content)
    .join("\n\n");

  return `[DOCUMENT KEY FACTS — maintain consistency with these throughout]\n• ${allKeyFacts}\n\n[CURRENT SECTION]\n${windowContent}`;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function trimToTokenBudget(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n[...content truncated for context window]";
}
