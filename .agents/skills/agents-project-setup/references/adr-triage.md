# ADR Triage

For projects whose `docs/adr/` grew under an earlier, looser ADR rule: many ADRs, long ones, ones that record upgrades or repeat the docs. Triage keeps the ADRs that pass the current rule in `.agents/rules/documentation-and-diagrams.md` and removes the rest without losing a reason anyone still needs. It reads every ADR, so it runs only when the user agrees. Every edit to an ADR, every fold, and every deletion goes into the plan (workflow step 2) and needs approval.

## 1. Bring The Rule Up To Date

New ADRs must follow the current rule, or the folder fills up again. Compare the project's ADR guidance with this skill's assets and propose the bundled wording, keeping project-specific additions:

- The Decision Records section and the "Finished tasks are deleted" bullet in `AGENTS.md` (compare with `assets/AGENTS.template.md`).
- The Architecture Decision Records section of `.agents/rules/documentation-and-diagrams.md` (compare with `assets/rules/documentation-and-diagrams.md`).
- Any other file that tells agents when to write an ADR, such as `CLAUDE.md` or another tool's instructions.

## 2. Sort The ADRs

Read each ADR once and give it one verdict:

| Verdict | When | Action |
|---------|------|--------|
| Keep | It passes the test: a developer reading the code and docs in two months would likely question or undo the decision without it, and no doc explains the reason. | Leave it. If it carries current-state detail (versions, configuration, APIs, file layout), offer to move that detail to the relevant doc and cut it from the ADR: a one-time exception to immutability, so it needs explicit approval. |
| Fold | The reason still matters but fits in a sentence or two. | Write the reason next to the fact in the relevant doc, then delete the ADR. |
| Delete | It records an upgrade, a fix, a refactor, or an obvious or requested change; it repeats what a doc says; it is superseded and its successor stands on its own; or the project no longer follows it. | Delete it. Facts it holds that no doc has yet go into the doc first. |

When a verdict is unclear, ask the user, or keep the ADR.

Present the verdicts in the plan as one table: number, title, verdict, and for a fold the doc that receives the reason.

## 3. Apply The Approved Verdicts

- Fold and delete as approved. Never renumber the remaining ADRs; gaps in the numbering are fine.
- Update `docs/adr/README.md` to list only the ADRs that remain. When none remains, delete `docs/adr/` with its index.
- Find links to the deleted ADRs in `AGENTS.md`, `README.md`, `docs/`, `.agents/rules/`, and `.agents/tasks/`, and point each to the doc that now holds the reason, or remove it.
- Report what was kept, what was folded and where each reason went, and what was deleted. Deleted ADRs stay in git history.
