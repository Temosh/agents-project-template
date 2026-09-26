# AGENTS.md

This repository is a reusable project template for AI-assisted development. It is intentionally technology-neutral until a real project chooses its stack, domain, and delivery workflow.

Use this file as the short entry point for Claude Code, Codex, Copilot, Cline, and other agents. Put detailed guidance in `.agents/rules/` and keep provider-specific folders as links or thin references to the same source of truth.

Any convention expected from every agent must be defined in this repository, either directly in `AGENTS.md` or in a referenced file under `.agents/`. Do not rely solely on provider-specific prompts, injected instructions, global configuration, or private agent memory for project rules.

## Before Working

1. Read the project-specific brief when it exists: `docs/project-brief.md`.
2. Read the relevant rules in `.agents/rules/` for the language, framework, and task.
3. Inspect the existing code before making assumptions about architecture or style.
4. Prefer small, focused changes that preserve user work already present in the tree.

## Diagrams

When a diagram would improve communication, use Mermaid wherever Mermaid can express the content. This applies to architecture diagrams, workflows, sequences, state transitions, dependency graphs, decision trees, entity relationships, and similar visual structures.

Do not create ASCII-art, ANSI-art, or Unicode box-drawing diagrams. Use plain prose, lists, or tables only when the content is not meaningfully a diagram or Mermaid cannot express it clearly. Follow `.agents/rules/documentation-and-diagrams.md` for the complete rule.

## Task Notes

Use `.agents/tasks/` for task-specific agent working notes that should persist across sessions, such as investigation findings, implementation plans, decisions, and handoff state.

Create one subfolder per meaningful task or workstream, for example `.agents/tasks/<task-name>/`, and name the main task note `TASK.md` to mirror the `SKILL.md` convention. Use `TASK.md` for the objective, current state, plan, decisions, findings, and handoff notes. Keep reusable guidance in `.agents/rules/`, project facts and user-facing documentation in `docs/`, and transient scratch notes in the current conversation unless they need to be handed off.

## Decision Records

Significant decisions made after the initial project baseline are recorded as ADRs in `docs/adr/`, indexed in `docs/adr/README.md`. Docs hold the current facts; ADRs hold why a decision was made and which alternatives were rejected.

- Do not read ADRs by default. Before proposing to change, reverse, or work around something the docs state as settled, check the index and read the relevant ADR.
- Accepted ADRs are immutable; a changed decision gets a new ADR that supersedes the old one, and the affected docs are updated in the same change.
- Follow `.agents/rules/documentation-and-diagrams.md` for when to write an ADR, the format, and the lifecycle.

## Commands

Replace these placeholders when a project is created:

```bash
<package-manager> install     # Install dependencies
<package-manager> dev         # Start local development server
<package-manager> build       # Build or compile the project
<package-manager> test        # Run tests
<package-manager> lint        # Run linting
<package-manager> format      # Format code
```

If a command is unknown, inspect project files such as `package.json`, `pom.xml`, `build.gradle`, `pyproject.toml`, `Cargo.toml`, `Makefile`, or CI configuration before guessing.

## Project

Placeholder: describe the product, target users, business domain, critical workflows, and non-goals here.

Recommended project docs:

| File | Purpose |
|------|---------|
| `docs/project-brief.md` | Product context, users, goals, terminology |
| `docs/architecture.md` | System architecture and folder ownership |
| `docs/domain-model.md` | Core domain entities, invariants, workflows |
| `docs/api.md` | External/internal API contracts |
| `docs/ui.md` | UX, layout, design-system rules for frontend projects |
| `docs/operations.md` | Deployment, observability, runbooks |
| `docs/adr/` | Architecture decision records, created when the first post-baseline decision is made |

## Stack

Placeholder: list the actual runtime, language versions, frameworks, package managers, and forbidden dependencies once the project stack is chosen.

## Rule Index

Use only the rules that apply to the current task:

| File | Purpose |
|------|---------|
| `.agents/rules/stack.md` | Runtime, framework, tooling, dependency, and integration rules |
| `.agents/rules/documentation-and-diagrams.md` | Documentation conventions and mandatory Mermaid diagram rules |
| `.agents/rules/code-conventions.md` | Language-agnostic code conventions |
| `.agents/rules/code-conventions-typescript.md` | TypeScript-specific conventions |
| `.agents/rules/code-conventions-react.md` | React-specific conventions |
| `.agents/rules/code-conventions-java.md` | Java-specific conventions |
| `.agents/rules/code-conventions-swift-macos.md` | Swift desktop macOS app conventions |
| `.agents/rules/architecture-react-app.md` | React app source layout and dependency rules |

## Skill Index

Use skills only when they match the task:

| Skill | Purpose |
|-------|---------|
| `.agents/skills/project-initialization/SKILL.md` | First setup pass for a new project: gather context, ask clarifying questions, create initial docs, and replace template placeholders with real project guidance |

## Source Layout

Placeholder: document the real module boundaries after the project is initialized.
