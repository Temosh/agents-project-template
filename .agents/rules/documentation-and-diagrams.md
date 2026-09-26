# Documentation And Diagrams

Use these rules for project documentation, task notes, plans, explanations, reviews, and other written artifacts.

## Diagrams

- When a diagram would improve communication, use Mermaid wherever Mermaid can express the content.
- Use Mermaid for architecture diagrams, workflows, sequences, state transitions, dependency graphs, decision trees, entity relationships, timelines, and similar visual structures.
- Do not create ASCII-art, ANSI-art, or Unicode box-drawing diagrams.
- Do not use text characters to imitate nodes, boxes, arrows, connectors, swimlanes, or other diagram elements.
- Use plain prose, lists, or tables when the content is not meaningfully a diagram or Mermaid cannot express it clearly.
- Keep Mermaid source valid and renderable. Quote node labels that contain punctuation or other syntax-sensitive text.

## Documentation

- Keep documentation close to its intended audience and source of truth.
- Prefer concise, concrete language over generic guidance.
- Update documentation when a change makes existing instructions or diagrams inaccurate.
- Do not duplicate detailed guidance across files; link to the source of truth instead.

## Architecture Decision Records

Docs describe what the project **is**. ADRs record **why** a significant decision was made and which alternatives were rejected, so agents and people do not re-propose settled alternatives.

### When To Write One

Write an ADR for a decision made after the initial project baseline when at least one applies:

- It is hard or expensive to reverse.
- It affects several modules, layers, or workflows.
- Real alternatives were considered and rejected.
- It is likely to be questioned again later.
- It changes or reverses a decision that the docs state as settled.

ADRs cover architecture and other significant project decisions (product, process, tooling). Do not write ADRs for small implementation choices, code style (use `.agents/rules/`), or plain facts (use `docs/`).

The initial specs created during project initialization are the baseline and are not recorded as ADRs.

### Location And Naming

- `docs/adr/NNNN-kebab-case-title.md`, numbered sequentially from `0001`. Numbers are never reused.
- `docs/adr/README.md` is the index: one line per ADR with number, title, status.

### Format

```markdown
# NNNN. Title In Imperative Form

- Status: Accepted            <!-- Proposed | Accepted | Superseded by NNNN | Deprecated -->
- Date: YYYY-MM-DD

## Context

The problem and the forces at play, in a few sentences.

## Decision

What was decided.

## Alternatives Rejected

- Alternative: why it was rejected.

## Consequences

What becomes easier or harder; follow-up obligations.
```

Keep ADRs short: 10-30 lines is typical.

### Lifecycle

- An ADR is immutable once Accepted. Only its status line may change.
- To change a decision, write a new ADR and mark the old one `Superseded by NNNN`.
- When an ADR is accepted, update the affected docs and rules in the same change so they state the new facts. The docs hold the current state; the ADR holds the reasoning.

### Reading Rule For Agents

- Do not read ADRs by default; they are not needed for routine work.
- Before proposing to change, reverse, or work around something the docs state as settled, check `docs/adr/README.md` and read the relevant ADR.

### Links

- ADRs may link to `docs/` and `.agents/rules/`. Docs, rules, and tasks may link to ADRs.
- ADRs never link to task notes, which are temporary.
