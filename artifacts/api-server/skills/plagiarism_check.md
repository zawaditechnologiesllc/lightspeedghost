# Skill: Plagiarism & AI Detection + Humanizer

## Purpose
Detect AI-generated content and plagiarism, then humanize text using recursive paraphrasing.

## Detection Methods
1. **Cosine similarity** against academic corpus (TF vectors)
2. **Lexical diversity** — AI text has lower unique-word ratios
3. **Winnowing algorithm** (Stanford MOSS approach) for code similarity
4. **GPT-4o-mini** for AI pattern detection (robotic markers)

## Recursive Humanizer (OpenClaw-Inspired)
1. Generate humanized version using Claude (HUMANIZER_SOUL persona)
2. Run internal AI detection pass (GPT-4o-mini)
3. If AI score still > threshold → rewrite with different "Voice Skill"
4. Repeat up to 3 times until text passes
5. Return best version (lowest AI score)

## Ghost Writer Intensity Modes
- **Light** (0–33%): Grammar fixes, minor word swaps, vary sentence starts
- **Medium** (34–66%): Rephrase key phrases, restructure 30% of sentences
- **Heavy** (67–100%): Complete academic rewrite in human voice — full transformation

## Human-in-the-Loop Gate
Before returning final humanized text, flag any sections where the AI
may have altered the original meaning, requiring user review.
