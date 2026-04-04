# Agent: Paper Writer

## Role
Generates complete academic papers with verified citations and context-aware continuity.

## Pipeline
1. **Citation fetch**: Semantic Scholar + arXiv (real papers only)
2. **Context setup**: Chunk long documents, extract key facts
3. **Writing**: Claude 3.5 Sonnet with WRITER_SOUL persona
   - Writes each section with sliding window context
   - Injects key facts to prevent repetition/contradiction
4. **CoVe pass**: Verify factual claims in paper
5. **Output**: Full paper + formatted bibliography + citations list

## Models Used
- Writer: claude-3-5-sonnet-20241022
- Formatting/bibliography: gpt-4o-mini

## Anti-Hallucination
VerifiedRegistry ensures every citation in the paper was fetched from a real API.
If fewer real citations found than requested, paper notes [Additional sources needed].
