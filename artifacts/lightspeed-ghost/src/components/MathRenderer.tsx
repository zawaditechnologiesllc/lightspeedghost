import { useEffect, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface MathRendererProps {
  text: string;
  className?: string;
  displayMode?: boolean;
}

/**
 * Renders mixed text with embedded LaTeX math expressions.
 * Supports:
 *   - Block math: $$...$$  → display mode (centered, large)
 *   - Inline math: $...$   → inline mode (fits in text flow)
 */
export default function MathRenderer({ text, className = "", displayMode = false }: MathRendererProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    // If pure block mode (single expression), render directly
    if (displayMode) {
      try {
        const cleanExpr = text.replace(/^\$\$/, "").replace(/\$\$$/, "").trim();
        ref.current.innerHTML = katex.renderToString(cleanExpr, {
          displayMode: true,
          throwOnError: false,
          trust: false,
        });
      } catch {
        ref.current.textContent = text;
      }
      return;
    }

    // Split text into segments: block math, inline math, and plain text
    const segments = splitMathSegments(text);
    const container = document.createDocumentFragment();

    for (const seg of segments) {
      if (seg.type === "block") {
        const div = document.createElement("div");
        div.className = "my-3 overflow-x-auto";
        try {
          div.innerHTML = katex.renderToString(seg.content, {
            displayMode: true,
            throwOnError: false,
            trust: false,
          });
        } catch {
          div.textContent = `$$${seg.content}$$`;
        }
        container.appendChild(div);
      } else if (seg.type === "inline") {
        const span = document.createElement("span");
        try {
          span.innerHTML = katex.renderToString(seg.content, {
            displayMode: false,
            throwOnError: false,
            trust: false,
          });
        } catch {
          span.textContent = `$${seg.content}$`;
        }
        container.appendChild(span);
      } else {
        // Plain text — preserve newlines
        const lines = seg.content.split("\n");
        lines.forEach((line, i) => {
          if (line) container.appendChild(document.createTextNode(line));
          if (i < lines.length - 1) container.appendChild(document.createElement("br"));
        });
      }
    }

    ref.current.innerHTML = "";
    ref.current.appendChild(container);
  }, [text, displayMode]);

  return <div ref={ref} className={`math-renderer leading-relaxed ${className}`} />;
}

interface Segment {
  type: "block" | "inline" | "text";
  content: string;
}

function splitMathSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  // Match $$...$$ first (block), then $...$ (inline)
  const pattern = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      segments.push({ type: "block", content: match[1].trim() });
    } else if (match[2] !== undefined) {
      segments.push({ type: "inline", content: match[2].trim() });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }

  return segments;
}
