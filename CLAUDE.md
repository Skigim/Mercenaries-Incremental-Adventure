# Tool Call Efficiency Rules
1. Do NOT issue diagnostic tool calls (e.g., `git status`, `ls`, `pwd`) after simple file writes unless an error occurs.
2. Group related file updates into a single response block.
3. Pipe or quiet test output (`vitest --reporter=dot` / `npm test -- --quiet`) to prevent terminal log dumps from bloating context.
4. Once a plan is approved, execute all file changes sequentially without asking for confirmation at each sub-step.
