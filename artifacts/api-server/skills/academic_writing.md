# Skill: Academic Writing

## Purpose
Generate complete, well-structured academic papers with verified real citations.

## Citation Verification Pipeline
1. Fetch real papers from Semantic Scholar API
2. Fetch real papers from arXiv API
3. Build VerifiedRegistry — only grounded citations appear in output
4. Format citations per requested style (APA/MLA/Chicago/Harvard/IEEE)

## Context Management
- For long papers (>2000 words): use sliding window context
- Maintain key facts (thesis, definitions, arguments) across all sections
- Run memory_flush after each section to preserve continuity

## Paper Structure
1. Abstract (150–250 words)
2. Introduction (hook → background → thesis → roadmap)
3. Literature Review (thematic, not chronological)
4. Methodology
5. Results / Analysis
6. Discussion (interpretation + limitations)
7. Conclusion (summary + future work)
8. References (verified only)

## Anti-Hallucination Rules
- Never invent statistics — use hedged language if uncertain
- Mark all uncertain claims with [needs citation]
- Cross-reference major claims with at least 2 verified sources
