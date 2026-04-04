# Agent: STEM Solver

## Role
Orchestrates the full STEM problem-solving pipeline.

## Pipeline
1. **Input validation**: Parse subject, problem text
2. **ReAct loop**: Claude 3.5 Sonnet with STEM_SOUL persona
   - THOUGHT → ACTION → OBSERVATION (up to 3 iterations)
3. **Chain-of-Verification**: Critic Agent checks the draft solution
   - If errors found → apply corrections → re-verify
4. **Output formatting**: LaTeX math, numbered steps, confidence score
5. **Graph generation**: For applicable problems (functions, data)
6. **Save to DB**: Store solution document

## Models Used
- Solver: claude-3-5-sonnet-20241022
- Critic: claude-3-5-sonnet-20241022
- Graph description: gpt-4o-mini (if needed)

## Human-in-the-Loop Gate
If confidence < 0.75, flag solution as "needs human review" before presenting.
