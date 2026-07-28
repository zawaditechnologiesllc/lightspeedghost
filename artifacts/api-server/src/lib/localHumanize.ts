/**
 * Local rule-based humaniser — a no-API, no-model, pure-TypeScript pass that
 * fills the same slot as a T5 paraphraser (humarin/chatgpt_paraphraser) for the
 * FREE tier: it strips the mechanical "AI tells" that detectors weight most,
 * without ever calling an LLM or an external service.
 *
 * It is deliberately conservative — it rewrites the giveaways (robotic
 * transitions, inflated verbs, throat-clearing openers, uniform hedging) and
 * introduces natural contractions and cadence, while preserving the author's
 * meaning verbatim everywhere else. It will not reach the 0%-detector score the
 * paid LLM engine targets, and we say so; but it measurably lowers the AI
 * signal and reads more human, for free.
 *
 * Deterministic and synchronous.
 */

// Throat-clearing / filler openers detectors love — remove them, capitalise next.
const FILLER_OPENERS = [
  "it is important to note that", "it is worth noting that", "it should be noted that",
  "it is essential to recognize that", "it is essential to understand that",
  "it is crucial to understand that", "it is important to understand that",
  "needless to say,", "as a matter of fact,", "it goes without saying that",
  "it is clear that", "it is evident that", "there is no doubt that",
];

// Robotic transitions → natural (or dropped). Order matters (longest first).
const TRANSITIONS: Array<[RegExp, string]> = [
  [/\bfurthermore,\s*/gi, "Also, "],
  [/\bmoreover,\s*/gi, "And "],
  [/\badditionally,\s*/gi, "Also, "],
  [/\bin addition,\s*/gi, "Also, "],
  [/\bconsequently,\s*/gi, "So "],
  [/\bsubsequently,\s*/gi, "Then "],
  [/\bnevertheless,\s*/gi, "Still, "],
  [/\bnonetheless,\s*/gi, "Even so, "],
  [/\bhence,\s*/gi, "So "],
  [/\bthus,\s*/gi, "So "],
  [/\btherefore,\s*/gi, "So "],
  [/\bin conclusion,\s*/gi, "In the end, "],
  [/\bto summarize,\s*/gi, "In short, "],
  [/\bin summary,\s*/gi, "In short, "],
  [/\boverall,\s*/gi, "On the whole, "],
];

// Inflated/AI-favoured vocabulary → plain words. Whole-word, case-insensitive.
const WORD_SWAPS: Array<[RegExp, string]> = [
  [/\butilize\b/gi, "use"], [/\butilizes\b/gi, "uses"], [/\butilized\b/gi, "used"], [/\butilizing\b/gi, "using"],
  [/\bfacilitate\b/gi, "help"], [/\bfacilitates\b/gi, "helps"], [/\bfacilitated\b/gi, "helped"],
  [/\bdemonstrate\b/gi, "show"], [/\bdemonstrates\b/gi, "shows"], [/\bdemonstrated\b/gi, "showed"],
  [/\bendeavor\b/gi, "try"], [/\bendeavour\b/gi, "try"],
  [/\bcommence\b/gi, "start"], [/\bcommenced\b/gi, "started"],
  [/\bterminate\b/gi, "end"], [/\bterminated\b/gi, "ended"],
  [/\bnumerous\b/gi, "many"], [/\bmyriad\b/gi, "many"], [/\ba plethora of\b/gi, "many"],
  [/\bin order to\b/gi, "to"], [/\bdue to the fact that\b/gi, "because"], [/\bin the event that\b/gi, "if"],
  [/\bwith regard to\b/gi, "about"], [/\bwith respect to\b/gi, "about"], [/\bin terms of\b/gi, "for"],
  [/\bat this point in time\b/gi, "now"], [/\bin the near future\b/gi, "soon"],
  [/\ba significant number of\b/gi, "many"], [/\bthe vast majority of\b/gi, "most"],
  [/\bit can be seen that\b/gi, ""], [/\bplays a (?:crucial|vital|key|pivotal) role in\b/gi, "matters for"],
];

// Contractions for a more natural register (applied for non-academic tones).
const CONTRACTIONS: Array<[RegExp, string]> = [
  [/\bit is\b/gi, "it's"], [/\bthat is\b/gi, "that's"], [/\bthere is\b/gi, "there's"],
  [/\bdo not\b/gi, "don't"], [/\bdoes not\b/gi, "doesn't"], [/\bdid not\b/gi, "didn't"],
  [/\bcannot\b/gi, "can't"], [/\bcan not\b/gi, "can't"], [/\bwill not\b/gi, "won't"],
  [/\bwould not\b/gi, "wouldn't"], [/\bshould not\b/gi, "shouldn't"], [/\bcould not\b/gi, "couldn't"],
  [/\bis not\b/gi, "isn't"], [/\bare not\b/gi, "aren't"], [/\bwas not\b/gi, "wasn't"], [/\bwere not\b/gi, "weren't"],
  [/\bhave not\b/gi, "haven't"], [/\bhas not\b/gi, "hasn't"], [/\bthey are\b/gi, "they're"],
  [/\bwe are\b/gi, "we're"], [/\byou are\b/gi, "you're"], [/\bwe will\b/gi, "we'll"],
];

function preserveCase(replacement: string, matched: string): string {
  if (matched && matched[0] === matched[0].toUpperCase() && replacement.length) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function capitaliseAfterDrop(text: string): string {
  // Fix sentence starts and leading lowercase left behind by removals.
  return text
    .replace(/([.!?]\s+)([a-z])/g, (_m, p, c) => p + c.toUpperCase())
    .replace(/^\s*([a-z])/, (_m, c) => c.toUpperCase())
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

export interface LocalHumanizeResult {
  text: string;
  changes: number;
  notes: string[];
}

export interface LocalHumanizeOptions {
  /** "academic" keeps full words (no contractions); others contract for a natural voice. */
  tone?: "academic" | "conversational" | "professional";
}

/**
 * Rewrite the mechanical AI tells out of `input`. Returns the transformed text,
 * a change count, and human-readable notes on what class of edits were applied.
 */
export function humanizeLocal(input: string, opts: LocalHumanizeOptions = {}): LocalHumanizeResult {
  const tone = opts.tone ?? "academic";
  let text = input;
  let changes = 0;
  const notes = new Set<string>();

  // 1. Drop throat-clearing openers.
  for (const filler of FILLER_OPENERS) {
    const re = new RegExp(filler.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    text = text.replace(re, () => { changes++; notes.add("Removed filler openers"); return ""; });
  }

  // 2. Naturalise robotic transitions.
  for (const [re, rep] of TRANSITIONS) {
    text = text.replace(re, (m) => { changes++; notes.add("Varied robotic transitions"); return preserveCase(rep, m); });
  }

  // 3. Deflate inflated vocabulary.
  for (const [re, rep] of WORD_SWAPS) {
    text = text.replace(re, (m) => { changes++; notes.add("Simplified inflated wording"); return rep ? preserveCase(rep, m) : ""; });
  }

  // 4. Natural contractions (skip for strict academic register).
  if (tone !== "academic") {
    for (const [re, rep] of CONTRACTIONS) {
      text = text.replace(re, (m) => { changes++; notes.add("Added natural contractions"); return preserveCase(rep, m); });
    }
  }

  text = capitaliseAfterDrop(text);

  return { text, changes, notes: [...notes] };
}
