import React from "react";

/**
 * Renders a string with inline markdown converted to React elements.
 * Handles **bold**, *italic*, and strips lone # / * characters that
 * leak through from AI model output.
 */
export function renderInlineMd(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const pattern = /(\*\*(.+?)\*\*|\*([^*\n]+?)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) parts.push(stripHashHeaders(text.slice(last, m.index)));
    if (m[2] !== undefined) parts.push(<strong key={m.index}>{m[2]}</strong>);
    else if (m[3] !== undefined) parts.push(<em key={m.index}>{m[3]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(stripHashHeaders(text.slice(last)));
  return parts;
}

/** Strip leading markdown header markers (##, ###, etc.) from a text fragment. */
function stripHashHeaders(s: string): string {
  return s.replace(/^#{1,6}\s+/gm, "");
}

/**
 * Plain-text version: strips markdown symbols entirely (no HTML elements).
 * Used in DOM-based renderers like MathRenderer where React nodes aren't available.
 */
export function stripMd(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*([^*\n]+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/_{2}(.+?)_{2}/g, "$1");
}
