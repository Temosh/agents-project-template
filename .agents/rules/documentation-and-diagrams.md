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

An ADR keeps the reason for a decision that nothing else in the repository explains. Docs say what the project **is**; an ADR says only **why** one option was chosen over the others. Each ADR is one more document a later session may read and follow after it has gone stale, so ADRs stay rare and short.

### When To Write One

By default, do not. Write an ADR only when the developer asks for one, or when the decision passes this test: a developer reading the code and docs in two months would likely question or undo it, because its reason is not written anywhere else. Typical cases: one viable architecture, data model, or external service chosen over another, or a deliberate trade-off that looks wrong without its constraint, measurement, or failed attempt.

When you are not sure the decision passes, ask the developer in one line before writing it, for example "ADR? Chose X over Y because Z". With no one to ask, leave the ADR out: write the reason as a sentence in the relevant doc and name the candidate in your report. Name every ADR you write in your final report.

A reason that fits in a sentence goes next to the fact in the relevant doc instead, for example "Payments go through X; Y has no refunds in our region." That is the default home for a reason.

Never write an ADR for:

- Library, framework, runtime, or tool upgrades, or the steps of a migration that was already decided.
- Bug fixes, refactors, renames, moved files, formatting, or performance tuning.
- Work the developer or the product docs already asked for: carrying out a decision is not a new decision.
- Choices most competent developers would make the same way.
- Conventions (they go in `.agents/rules/`) or current-state facts (they go in `docs/`).
- Anything a doc or an existing ADR already explains.
- The specs written during project initialization: they are the baseline.

A project gathers a handful of ADRs over its life, not one per task or per feature.

### Location And Naming

- `docs/adr/NNNN-kebab-case-title.md`, numbered sequentially from `0001`. Numbers are never reused.
- `docs/adr/README.md` is the index: one line per ADR with number, title, status.

### Format

```markdown
# NNNN. Title In Imperative Form

- Status: Accepted            <!-- Proposed | Accepted | Superseded by NNNN | Deprecated -->
- Date: YYYY-MM-DD

## Decision

One or two sentences.

## Why

The reason a later reader would not find in the code or docs.

## Alternatives Rejected

- Alternative: why it was rejected, in one line.
```

An ADR fits on one screen, about 20 lines. It holds no current-state detail (versions, configuration, APIs, file layout, commands); it links to the doc that has it.

### Lifecycle

- An ADR is immutable once Accepted. Only its status line may change.
- To change a decision, write a new ADR and mark the old one `Superseded by NNNN`. The new ADR has to pass the same test as any other.
- When an ADR is accepted, update the affected docs and rules in the same change so they state the new facts. The docs hold the current state; the ADR holds the reasoning.

### Reading Rule For Agents

- Do not read ADRs by default; they are not needed for routine work.
- Before proposing to change, reverse, or work around something the docs state as settled, check `docs/adr/README.md` and read the relevant ADR.

### Links

- ADRs may link to `docs/` and `.agents/rules/`. Docs, rules, and tasks may link to ADRs.
- ADRs never link to task notes, which are temporary.

## Reports

A report is a dated record of one examination: a code review, an audit, a security check, a test run, or a measurement on a device. It is evidence of what was found at that time, not a description of the project; docs and rules hold the current state.

### When To Write One

Only when the developer asks for a review, an audit, a test run, or a measurement, or when a task's verification asks for recorded results. When unsure, ask the developer in one line before writing it.

Not reports, and never written to `reports/`:

- Plans, working notes, and handoffs: they go in the task note.
- A summary of finished work, analysis, or recommendations: they go in the chat response.
- Current facts, conventions, and decision reasons: they go in `docs/`, `.agents/rules/`, or an ADR.
- Tool output such as logs, profiler captures, or export reports: it stays where the tool writes it, and a report may cite it.

### Location And Format

- `reports/YYYY-MM-DD-kind-topic.md` at the repository root, outside `docs/`, for example `reports/2026-10-15-security-audit.md`. The folder appears with the first report.
- The report opens with a summary a reader can stop after: the date, the commit or build examined, what was examined and how, and the main results, in at most about ten lines. The details follow, as long as the evidence needs.

### Lifecycle

- In the same change, findings that settle a fact or a convention go into `docs/` or `.agents/rules/`, which may cite the report as evidence. Findings that need work are listed in the chat response; the developer decides what becomes a task.
- A report is not edited after it is written; a later examination gets a new report. Agents never delete a report; the developer may.

### Reading Rule For Agents

- Do not read reports by default.
- Read one only when the task needs its evidence: a follow-up the developer points to, or a new measurement to compare with the last one.
- Its findings describe the code at the commit it names; check them against the current code and docs before acting on any of them.

### Links

- Reports may link to `docs/`, `.agents/rules/`, and ADRs. Docs, rules, ADRs, and tasks may cite reports.
- Reports never link to task notes, which are temporary.
