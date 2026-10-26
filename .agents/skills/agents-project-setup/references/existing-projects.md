# Existing Projects

How to fold a project's existing agent instructions into the template's structure. Every move, merge, and deletion here needs the user's approval; list them in the plan (workflow step 2).

## Principle

One source of truth: conventions every agent should follow live in `AGENTS.md` or `.agents/rules/`. A tool's own file keeps only what is specific to that tool, plus a pointer to `AGENTS.md`, or goes away when the tool reads `AGENTS.md` itself.

Keep the meaning of every instruction. Do not drop rules because they look minor, do not rewrite them into generic advice, and do not silently resolve contradictions: where an existing instruction contradicts a template rule, the project's instruction stays and the user hears about the conflict.

## AGENTS.md With Project Content

The plan reports `keep AGENTS.md`. Keep all project content and add the template sections it lacks, taken from `<skill>/assets/AGENTS.template.md`:

- the opening paragraphs on `AGENTS.md` as the entry point and on conventions living in the repository,
- Before Working, Diagrams, Task Notes, Decision Records, Rule Index, and Skill Index.

Existing sections that cover the same ground (commands, project, stack, source layout) stay and take the place of the template's placeholders for them.

## CLAUDE.md With Its Own Content

The plan reports `migrate CLAUDE.md`.

- Move every instruction to where it belongs: commands, project facts, and source layout into the matching `AGENTS.md` sections; coding conventions into the matching `.agents/rules/` file, or a new rule file (with approval) when none fits.
- Notes that only make sense for Claude Code (its permissions, its tools) may stay in `CLAUDE.md` below the import.
- Then `CLAUDE.md` starts with `@AGENTS.md`.
- `CLAUDE.local.md` is personal; leave it alone.

## Other Tools' Instruction Files

`.cursor/rules/`, `.cursorrules`, `.github/copilot-instructions.md`, `.github/instructions/`, `.windsurfrules`, `.windsurf/rules/`, `.roo/rules/`, `.roorules`, `.junie/guidelines.md`, `.kiro/steering/`, `.amazonq/rules/`, `GEMINI.md`:

- Move shared conventions into `AGENTS.md` or `.agents/rules/` as above.
- Keep the tool's file when the tool does not read `AGENTS.md` itself, reduced to a pointer ("Follow AGENTS.md and the rules it lists") plus anything specific to that tool. Support for `AGENTS.md` changes quickly; check the tool's current documentation when unsure.
- Scoping metadata (Cursor globs, Copilot `applyTo`) has no equivalent in `AGENTS.md`: state the scope in the rule file's opening line ("Use this file for ..."), and keep the tool's scoped file as a pointer when the scoping matters.
- Delete a tool's file only with approval and only when nothing tool-specific is left in it.

## Real Folders Where The Links Belong

- `.claude/rules/` or `.clinerules/` as folders: after the move (`--adopt`) their rule files apply to every agent, so read them first and flag anything meant for one tool only.
- `.claude/skills/`: its skills move into `.agents/skills/` (`--adopt`). Typical when this skill was copied there to run it.
- Entries that clash with files already in `.agents/` block the adoption: compare them, merge by hand with approval, and rerun `plan`.
- `.clinerules` as a single file: treat its content like `CLAUDE.md` content, then delete the file (approval) so the link can take its place.

## .gitignore

`setup.py` appends `.clinerules` and `.claude`, as in the template. When the project tracks other files under `.claude/` (shared settings, commands, agents), it appends `.claude/rules` and `.claude/skills` instead, so those files stay committable. It never removes or reorders existing lines.

## Rule Files Already In .agents/rules

From an earlier template version or the project itself: `plan` shows `keep` with the bundled file to diff against, or `note` for files the template does not have. Project rules stay. For files that started from the template, propose taking template improvements while keeping project-specific edits.
