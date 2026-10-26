---
name: agents-project-setup
description: Sets up the agents project template in an empty or existing project, so the project ends up as if it had been started from the template and given its first agent pass. Installs AGENTS.md as the single entry point for every agent, a CLAUDE.md that imports it, the shared rules in .agents/rules, the project-initialization skill, the task-note and decision-record conventions, and local discovery links for Claude Code and Cline, without overwriting anything; then runs project-initialization to describe the project. Use it when the user wants to make a repository agent-ready, add AGENTS.md or this agent setup to a new or existing codebase, fold CLAUDE.md, Cursor, Copilot or Cline instructions into one shared setup, recreate the discovery links after cloning, or re-check or update an existing setup from a newer template.
compatibility: Needs file access and a shell in the project. The scripts need Python 3.8+ with the standard library only; references/manual-setup.md covers machines without Python. On Windows without symlink rights the links become directory junctions.
---

# Agents Project Setup

This skill is the agents project template in portable form. `assets/` holds the template's files under names that agent tools do not load on their own: `AGENTS.template.md`, `CLAUDE.template.md`, `README.template.md`, `gitignore.template`, `rules/`, and `skills/project-initialization/SKILL.template.md`. `scripts/setup.py` installs them into a project; the template's `project-initialization` skill then does the first pass, exactly as in a project started from the template.

In the commands below, `<skill>` is this skill's folder wherever it is installed, and `<project>` is the project root (the git root when there is one). Use `python` instead of `python3` where that is the interpreter's name.

## What The Project Gets

- `AGENTS.md`: the entry point for every agent. `CLAUDE.md`: only `@AGENTS.md`.
- `.agents/rules/`: the shared conventions. The first pass keeps the ones the stack needs.
- `.agents/skills/`: `project-initialization` and this skill.
- `.agents/tasks/` and `docs/adr/`: conventions only; the folders appear with the first task note or decision.
- `docs/`: written by the first pass.
- `.gitignore`: the template's, or the project's own with the entries for the links appended.
- Discovery links, local to each clone and ignored by git as in the template's `.gitignore`: `.claude/rules -> ../.agents/rules`, `.claude/skills -> ../.agents/skills`, `.clinerules -> ./.agents/rules`. Tools look for rules and skills at these paths before the model reads any prompt, so a pointer file is no substitute for a link.

## Workflow

Copy this checklist and keep it current:

- [ ] 1. Inspect
- [ ] 2. Plan and get approval
- [ ] 3. Install
- [ ] 4. Consolidate existing instructions
- [ ] 5. Run the first pass
- [ ] 6. Verify
- [ ] 7. Report

### 1. Inspect

Run `python3 <skill>/scripts/setup.py inspect <project>`. It prints the project kind (new or existing), the git state, the agent setup found, instructions to consolidate, the state of each discovery link, and stack signals with the rule files they suggest.

The `setup` line sets the course:

| `setup` | Meaning | Steps |
|---------|---------|-------|
| `none` | No agent setup yet | All |
| `template` | Template files with placeholders; first pass not done | All; install only fills gaps |
| `foreign` | Agent instructions from another convention | All; step 4 carries the weight |
| `initialized` | Set up and described before | Re-check: steps 1-3, 6 and 7 with `--rules none`; no first pass |

Then:

- Read every file the `consolidate` line lists, and `AGENTS.md`, `CLAUDE.md`, and `README.md` when present.
- Uncommitted changes: tell the user and suggest committing or stashing first, so the setup arrives as one reviewable diff. Do not commit, stash, or run `git init` yourself.

### 2. Plan And Get Approval

- Run `python3 <skill>/scripts/setup.py plan <project>`. It changes nothing. By default it installs every bundled rule file, as the template does; the first pass removes the ones the stack does not need. On an `initialized` project add `--rules none` and handle rule updates as in Re-Check below.
- A real `.claude/rules`, `.claude/skills`, or `.clinerules` folder blocks its link (`conflict`). Typical case: the user copied this skill into `.claude/skills/`. `--adopt` moves the folder's contents into `.agents/` and puts the link in its place; use it once the user agrees, and rerun `plan` with it.
- Present the plan in chat in plain words: what gets created, appended, moved, and left alone, and what step 4 will consolidate.
- Wait for approval when the project has any content. In a new, empty project, state the plan and continue.

### 3. Install

- Run `python3 <skill>/scripts/setup.py apply <project>` with the flags from the approved plan. It never overwrites: existing files show up as `same` or `keep` (differs), and rerunning is safe.
- `conflict` lines stay until step 4 or the user resolves them; rerun `apply` afterwards.
- Without Python, follow `references/manual-setup.md`.

### 4. Consolidate Existing Instructions

Only when inspect listed something to consolidate, or the plan shows `migrate`, or `keep AGENTS.md` with project content. Follow `references/existing-projects.md`: one source of truth in `AGENTS.md` and `.agents/rules/`, no instruction lost, and every move, merge, and deletion approved first (list them in the step 2 plan).

### 5. Run The First Pass

- Read `<project>/.agents/skills/project-initialization/SKILL.md` and carry out its workflow. It inspects, asks what cannot be inferred, presents its own file plan for approval, writes the initial docs, replaces placeholders, and prunes rule files.
- Reuse what steps 1-4 already established instead of asking again.
- Skip this step for an `initialized` project unless the user asks to redo the docs. If the user wants only the structure, skip it too and say the placeholders remain until `project-initialization` runs.

### 6. Verify

Run `python3 <skill>/scripts/verify.py <project>` after the first pass. Fix every error; fix every warning or say why it stays (for example a recommended doc deliberately not written yet). Rerun `inspect`: `setup` reads `initialized` unless a placeholder was deliberately kept with an open question.

### 7. Report

In the final response:

- What was created, appended, moved, consolidated, and left alone; conflicts still open.
- The first pass's own report: docs written, assumptions, open questions.
- The verify result.
- That the discovery links are local and ignored by git, and that after a fresh clone `python3 .agents/skills/agents-project-setup/scripts/setup.py links .` recreates them.

## Re-Check And Template Updates

For an `initialized` project, or when a newer version of this skill is available:

- `plan --rules none` lists template files that differ from the bundled ones as `keep`, with the asset to diff against. Diff each and propose updates file by file: template improvements come in; project content (filled placeholders, project rules, local decisions) stays. Apply only approved updates.
- `note` lines show bundled rule files that are present but not selected, and the project's own rule files; leave them unless the user asks.
- `keep .agents/skills/agents-project-setup/` means another version of this skill is installed in the project; offer to replace it with this one after showing what changed.
- Missing links, for example after a clone: `python3 <skill>/scripts/setup.py links <project>`.

## Maintaining The Bundled Template

In the template repository, after changing `AGENTS.md`, `CLAUDE.md`, `README.md`, `.gitignore`, a rule file, or another template skill, refresh this skill's copies with `python3 <skill>/scripts/setup.py sync-assets <template-root>`; `--check` only reports drift. It refuses a folder whose `AGENTS.md` has no placeholders, so it does not run against a real project by accident.

## Rules

- Never overwrite, move, or delete existing content without the user's approval. The scripts only create, append, and (with `--adopt`) move.
- Keep provider folders as links to `.agents/`; never replace them with copies or pointer files.
- Do not commit, push, stash, or run `git init`; the user decides when the setup is committed.
- Change no source, build, or configuration file beyond the `.gitignore` entries for the links. The first pass has the same limit.
- Analysis and recommendations belong in the chat response; files carry settled facts.

## Done When

- `inspect` shows every link `ok`, and `setup` reads `initialized` (or the open placeholders are reported).
- `verify.py` reports no errors, and each warning is fixed or explained.
- Every conflict is resolved or reported, and no existing instruction was lost.
- The first pass met its own completion criteria (not applicable in re-check mode).
