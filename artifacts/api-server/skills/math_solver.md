# Skill: Math Solver

## Purpose
Solve mathematical problems step-by-step using the ReAct reasoning loop and Chain-of-Verification.

## Trigger
When a user submits a STEM problem in the "mathematics" or related subject.

## Execution Pattern
1. **THOUGHT**: Identify givens, unknowns, and required formula
2. **ACTION**: Apply the relevant theorem/formula in LaTeX
3. **OBSERVATION**: Check units and intermediate results
4. **CRITIQUE**: Run Chain-of-Verification (Critic Agent checks for errors)
5. **FINAL**: Output verified solution with full LaTeX

## Tools Available
- SymPy-style symbolic reasoning (via Claude)
- ArXiv paper search for theorem references
- Semantic Scholar for citation verification

## Output Format
- All math in LaTeX (inline `$...$` and block `$$...$$`)
- Numbered steps
- Confidence score
- Corrections list if CoVe found errors

## Example
Input: "Solve the integral ∫x²e^x dx"
Output:
$$\int x^2 e^x dx = e^x(x^2 - 2x + 2) + C$$
Steps: Integration by parts applied twice...
