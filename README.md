# Agents Project Template

Reusable starter template for projects that should work well with AI coding agents such as Claude Code, Codex, Copilot, and Cline.

The template keeps agent instructions in one shared place and exposes them through the file layouts each tool already understands.

## Structure

```text
.
├── AGENTS.md                 # Shared entry point for agents
├── CLAUDE.md                 # Thin reference to AGENTS.md
├── docs/                     # Project docs: current facts (created by project initialization)
│   └── adr/                  # Architecture decision records, added after the baseline
├── .agents/
│   ├── rules/                # Source of truth for agent rules
│   ├── skills/               # Reusable agent skills
│   └── tasks/                # Task-specific agent notes, created as needed
│       └── <task-name>/
│           └── TASK.md       # Main task plan, findings, and handoff note
├── .claude/
│   ├── rules -> ../.agents/rules
│   └── skills -> ../.agents/skills
└── .clinerules -> ./.agents/rules
```

## Symlink Requirement

This template uses symlinks so agent tools can discover shared rules and skills from their hardcoded paths while `.agents/` remains the source of truth.

Do not replace these symlinks with plain pointer files. Some tools discover rules and skills before the model sees the first prompt, so a Markdown note that points elsewhere is not equivalent.

Required symlinks:

- `.clinerules -> ./.agents/rules`
- `.claude/rules -> ../.agents/rules`
- `.claude/skills -> ../.agents/skills`

## Rule Files

| File | Purpose |
|------|---------|
| `.agents/rules/code-conventions.md` | Language-agnostic code conventions |
| `.agents/rules/code-conventions-typescript.md` | TypeScript-specific conventions |
| `.agents/rules/code-conventions-react.md` | React-specific conventions |
| `.agents/rules/architecture-react-app.md` | Standard React app source layout and dependency rules |
| `.agents/rules/code-conventions-java.md` | Java-specific conventions |
| `.agents/rules/code-conventions-swift-macos.md` | Swift desktop macOS app conventions |
| `.agents/rules/stack.md` | Stack, tooling, dependency, configuration, persistence, and integration rules |
| `.agents/rules/documentation-and-diagrams.md` | Documentation conventions and mandatory Mermaid diagram rules |

## Skills

| Skill | Purpose |
|-------|---------|
| `.agents/skills/project-initialization/SKILL.md` | First setup pass for a new project: gather context, ask clarifying questions, create initial docs, and replace template placeholders with real project guidance |

## Task Notes

Use `.agents/tasks/<task-name>/TASK.md` for persistent notes about a specific task or workstream. The uppercase `TASK.md` filename intentionally mirrors `SKILL.md`; use it as the main task document for the objective, current state, plan, decisions, findings, and handoff notes.

Keep reusable conventions in `.agents/rules/`, reusable procedures in `.agents/skills/`, and product or architecture documentation in `docs/`. Use `.agents/tasks/` only when task context needs to survive beyond the current conversation.

## Decision Records

Significant decisions made after the initial project baseline are recorded as ADRs in `docs/adr/NNNN-title.md`, indexed in `docs/adr/README.md`. Docs describe the current state; ADRs explain why a decision was made and which alternatives were rejected, so agents do not re-propose them. Agents read ADRs only before changing something settled. Full rules: `.agents/rules/documentation-and-diagrams.md`.

## Using The Template

1. Create a new project from this repository.
2. Run the `project-initialization` skill to replace placeholders in `AGENTS.md` and `.agents/rules/stack.md` with the real project commands and stack.
3. Keep reusable conventions in `.agents/rules/`.
4. Use `.agents/tasks/<task-name>/TASK.md` for task-specific plans, findings, and handoffs that should persist across sessions.
5. Add project-specific product context in docs such as `docs/project-brief.md`.
6. Add or remove rule files as the project stack requires.

## Guidance

- Keep `.agents/rules/` as the source of truth.
- Define every cross-agent project convention in `AGENTS.md` or `.agents/`; do not rely solely on provider-specific or externally injected instructions.
- Use symlinks or thin references for agent-specific folders instead of duplicating rules.
- Keep project-specific examples out of this template unless they are intentionally reusable.
- Update `AGENTS.md` when adding, renaming, or removing rule files.
- Record significant post-baseline decisions as ADRs in `docs/adr/`; keep docs describing the current state.
