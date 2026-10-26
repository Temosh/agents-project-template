# Manual Setup

For machines without Python. These steps do what `setup.py apply` does, and like it they never overwrite an existing file. Inspect and plan by reading the project yourself: list what exists before creating anything.

## macOS, Linux, Git Bash

```bash
SKILL=/path/to/agents-project-setup   # this skill's folder
P=/path/to/project                    # project root

put() { [ -e "$2" ] || [ -L "$2" ] || { mkdir -p "$(dirname "$2")" && cp "$1" "$2"; }; }

put "$SKILL/assets/AGENTS.template.md" "$P/AGENTS.md"
put "$SKILL/assets/CLAUDE.template.md" "$P/CLAUDE.md"
put "$SKILL/assets/README.template.md" "$P/README.md"
for rule in "$SKILL"/assets/rules/*.md; do put "$rule" "$P/.agents/rules/$(basename "$rule")"; done
(cd "$SKILL/assets/skills" && find . -type f ! -name .DS_Store) | while read -r file; do
  rel="${file#./}"
  case "$rel" in
    */SKILL.template.md) dest="${rel%SKILL.template.md}SKILL.md" ;;
    *) dest="$rel" ;;
  esac
  put "$SKILL/assets/skills/$rel" "$P/.agents/skills/$dest"
done
mkdir -p "$P/.agents/skills"
[ -e "$P/.agents/skills/$(basename "$SKILL")" ] || cp -R "$SKILL" "$P/.agents/skills/"

mkdir -p "$P/.claude"
[ -e "$P/.claude/rules" ] || [ -L "$P/.claude/rules" ] || ln -s ../.agents/rules "$P/.claude/rules"
[ -e "$P/.claude/skills" ] || [ -L "$P/.claude/skills" ] || ln -s ../.agents/skills "$P/.claude/skills"
[ -e "$P/.clinerules" ] || [ -L "$P/.clinerules" ] || ln -s ./.agents/rules "$P/.clinerules"
```

Git Bash creates copies instead of links unless `MSYS=winsymlinks:nativestrict` is set and Windows allows symlinks; use the Command Prompt steps below if it does not.

## Windows Command Prompt

Directory junctions need no symlink rights. Copy the files as above (File Explorer or `copy`, never replacing existing files), then from the project root:

```bat
mkdir .claude
mklink /J .claude\rules .agents\rules
mklink /J .claude\skills .agents\skills
mklink /J .clinerules .agents\rules
```

## .gitignore

- No `.gitignore`: copy `assets/gitignore.template` to `.gitignore`.
- Otherwise append, unless already ignored:

```gitignore
# Agents
.clinerules
.claude
```

When the project tracks other files under `.claude/` (`git ls-files .claude`), write `.claude/rules` and `.claude/skills` instead of `.claude`.

Then continue with workflow step 4. Verification without Python means checking the items `scripts/verify.py` lists in its header by hand.
