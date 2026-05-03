---
name: project-initialization
description: Use when starting a new project from this template or converting template placeholders into real project setup. Guides agents to inspect the repo, ask targeted clarification questions, create initial project docs such as project brief and architecture notes, update AGENTS.md and stack/rule placeholders, and produce a first usable AI-agent onboarding baseline.
---

# Project Initialization

Use this skill for the first serious setup pass after creating a project from the agents template.

Goal: turn generic template instructions into project-specific guidance without inventing facts. The result should let future agents understand the product, stack, commands, docs, and coding rules before making feature changes.

## Workflow

1. Inspect the repository before asking questions.
   - Read `AGENTS.md`, `README.md`, `.agents/rules/stack.md`, and relevant rule files.
   - Inspect manifest/build files if present: `package.json`, `pnpm-lock.yaml`, `pom.xml`, `build.gradle`, `Package.swift`, `*.xcodeproj`, `pyproject.toml`, `Cargo.toml`, `Makefile`, CI files.
   - Inspect existing docs under `docs/` if present.

2. Identify what is already knowable.
   - Project type: frontend, backend, desktop app, mobile app, library, CLI, monorepo.
   - Stack, runtime versions, package manager, commands, test tooling.
   - Existing source layout and architectural boundaries.
   - Missing placeholders in `AGENTS.md`, `.agents/rules/stack.md`, `README.md`, and docs.

3. Ask targeted questions only for facts that cannot be inferred.
   - Ask in small batches, usually 3-6 questions.
   - Prefer concrete questions over broad prompts.
   - Do not ask for information already present in files.
   - If the user gives partial answers, proceed with explicit assumptions and mark open questions in docs.

4. Create or update project docs.
   - Start with `docs/project-brief.md`.
   - Add other docs only when useful for the project: `docs/architecture.md`, `docs/domain-model.md`, `docs/api.md`, `docs/ui.md`, `docs/operations.md`.
   - Keep docs practical and agent-oriented. Prefer decisions, terminology, workflows, commands, and constraints over marketing prose.

5. Replace template placeholders.
   - Update `AGENTS.md` with real project summary, commands, docs, stack, and source layout.
   - Update `.agents/rules/stack.md` with real tooling, framework, dependency, config, persistence, and integration rules.
   - Keep reusable generic rules intact unless the project has a clear override.
   - Add or remove rule files only when the stack needs it.

6. Verify consistency.
   - Search for leftover placeholders and stale template-only text.
   - Ensure every file referenced in `AGENTS.md` exists or is intentionally planned.
   - Ensure rule filenames match the actual `.agents/rules/` files.
   - Run formatting/lint/docs checks only if configured and relevant.

## Clarification Questions

Use these as a menu, not a script. Ask only what is needed.

Product:
- What is the product name?
- Who are the primary users?
- What core workflows must the app support first?
- What are the explicit non-goals for the first version?
- What domain terminology should agents use?

Stack:
- Which language/runtime/framework versions should be used?
- Which package manager and lockfile policy should be enforced?
- What are the install, dev, build, test, lint, format, and preview commands?
- Are there forbidden dependencies or required libraries?
- What platforms and browsers/OS versions must be supported?

Architecture:
- Is this a frontend app, backend service, macOS desktop app, CLI, library, or monorepo?
- What source layout should be enforced?
- Which modules/layers may import from which others?
- Where should API clients, state, persistence, validation, and domain logic live?
- What should never be created at the root or source root?

Data and integrations:
- What external APIs, databases, queues, files, or local system services are involved?
- What authentication/authorization model is expected?
- What data is sensitive and must never be logged or committed?
- Are migrations, seeds, fixtures, or generated schemas required?

Quality:
- What test framework should be used?
- What coverage or critical-path tests are expected?
- What CI checks should pass before changes are considered done?
- What observability, logging, or diagnostics are required?

## Recommended Initial Docs

Create only the docs that add useful context.

`docs/project-brief.md`:
- Product summary
- Users and roles
- Goals and non-goals
- Core workflows
- Domain terminology
- Constraints and assumptions
- Open questions

`docs/architecture.md`:
- System shape
- Source layout
- Module boundaries
- Dependency direction
- Data flow
- Integration boundaries
- Testing strategy

`docs/domain-model.md`:
- Core entities
- Invariants
- State transitions
- Important calculations or policies
- Examples and edge cases

`docs/api.md`:
- API style and contracts
- Auth model
- Error model
- Retry/timeouts/idempotency
- Schema ownership

`docs/ui.md`:
- Navigation
- Layout patterns
- Design system
- Accessibility baseline
- Empty/loading/error states

`docs/operations.md`:
- Environment variables
- Local services
- Deployment
- Observability
- Runbooks

## Editing Rules

- Do not overwrite existing project decisions; preserve and refine them.
- Do not invent stack versions, commands, or product facts. Ask or mark as open.
- Keep placeholder text only when a decision is genuinely unknown.
- Prefer concise docs that future agents will actually read.
- Update references whenever a file is renamed, added, or removed.
- Mention unresolved questions in the final answer and in the relevant doc.

## Completion Criteria

The initialization pass is done when:

- `AGENTS.md` describes the real project instead of the template.
- `docs/project-brief.md` exists and captures the product baseline.
- `.agents/rules/stack.md` reflects the chosen stack or clearly lists open stack decisions.
- Rule files referenced by `AGENTS.md` exist.
- Placeholder/stale template text has been removed or intentionally retained with an open question.
- The final response lists changed files, assumptions, open questions, and any checks run.
