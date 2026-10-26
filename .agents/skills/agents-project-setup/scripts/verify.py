#!/usr/bin/env python3
"""Check a project's agent setup, typically after its first pass.

  verify.py <project>

Errors (exit 1): AGENTS.md missing, CLAUDE.md not importing it, discovery links missing or
pointing elsewhere, Rule Index or Skill Index out of step with the files, links from outside
.agents/tasks/ into a task note.

Warnings: template placeholders left, paths in AGENTS.md that do not exist, skills missing
from the Skill Index, discovery links git does not ignore, box-drawing characters in the
agent Markdown (the template's diagram rule asks for Mermaid instead).

Requires Python 3.8+, standard library only.
"""

import os
import re
import subprocess
import sys
from pathlib import Path

LINKS = [
    (".claude/rules", ".agents/rules"),
    (".claude/skills", ".agents/skills"),
    (".clinerules", ".agents/rules"),
]

TEMPLATE_LEFTOVERS = [
    "Placeholder:",
    "<package-manager>",
    "<Product>",
    "<PRODUCT>",
    "This is a template stub",
    "reusable project template",
    "# Agents Project Template",
]

BOX_DRAWING = re.compile("[─-╿]")
TASK_LINK = re.compile(r"\.agents/tasks/([A-Za-z0-9][^\s`)\]>\"']*)")
AGENTS_PATH = re.compile(r"`((?:\.agents|docs)/[^`\s]*)`")

SKIP_DIRS = {
    ".git", "node_modules", "Library", "Temp", "Obj", "Logs", "build", "Build", "Builds", "dist",
    "out", "target", ".venv", "venv", "Pods", "DerivedData", ".gradle", "__pycache__", ".next",
    "coverage", ".build", ".idea", ".vscode",
}


class Report(object):
    def __init__(self):
        self.errors = []
        self.warnings = []
        self.infos = []

    def error(self, message):
        self.errors.append(message)

    def warn(self, message):
        self.warnings.append(message)

    def info(self, message):
        self.infos.append(message)


def read_text(path):
    try:
        return Path(path).read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return ""


def section(text, title):
    """Lines of the '## title' section, up to the next level-2 heading."""
    lines, inside = [], False
    for line in text.splitlines():
        if line.startswith("## "):
            if inside:
                break
            inside = line[3:].strip() == title
            continue
        if inside:
            lines.append(line)
    return "\n".join(lines) if inside or lines else None


def is_link(path):
    path = str(path)
    if os.path.islink(path):
        return True
    isjunction = getattr(os.path, "isjunction", None)
    if isjunction is not None:
        return isjunction(path)
    if os.name == "nt":
        try:
            os.readlink(path)
            return True
        except (OSError, ValueError):
            return False
    return False


def git(project, *args):
    try:
        return subprocess.run(["git", "-C", str(project)] + list(args),
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)
    except OSError:
        return None


def agent_markdown(project):
    """The Markdown files this setup owns: entry points, rules, and docs."""
    files = [project / name for name in ("AGENTS.md", "CLAUDE.md", "README.md")]
    files += sorted((project / ".agents" / "rules").glob("*.md"))
    docs = project / "docs"
    if docs.is_dir():
        files += sorted(docs.rglob("*.md"))
    return [f for f in files if f.is_file()]


def all_markdown(project, limit=5000):
    """Markdown files outside .agents/tasks/ and .agents/skills/."""
    found = []
    for dirpath, dirnames, filenames in os.walk(str(project)):
        rel = Path(dirpath).relative_to(project).as_posix()
        dirnames[:] = [
            d for d in dirnames
            if d not in SKIP_DIRS and (d if rel == "." else rel + "/" + d) not in (".agents/tasks", ".agents/skills")
        ]
        for name in filenames:
            if name.endswith(".md"):
                found.append(Path(dirpath) / name)
                if len(found) >= limit:
                    return found
    return found


def check_entry_points(project, report):
    agents = project / "AGENTS.md"
    if not agents.is_file():
        report.error("AGENTS.md is missing")
        return ""
    claude = project / "CLAUDE.md"
    if not claude.is_file():
        report.error("CLAUDE.md is missing; it should contain @AGENTS.md")
    elif "@AGENTS.md" not in read_text(claude) and "@./AGENTS.md" not in read_text(claude):
        report.error("CLAUDE.md does not import AGENTS.md (@AGENTS.md)")
    return read_text(agents)


def check_links(project, report):
    probe = git(project, "rev-parse", "--git-dir")
    is_repo = probe is not None and probe.returncode == 0
    for link, want in LINKS:
        path = project / link
        if not os.path.lexists(str(path)):
            report.error("{} is missing (setup.py links <project> creates it)".format(link))
            continue
        if not is_link(path):
            report.error("{} is a real {}, not a link to {}".format(link, "folder" if path.is_dir() else "file", want))
            continue
        if os.path.realpath(str(path)) != os.path.realpath(str(project / want)):
            report.error("{} points to {}, expected {}".format(link, os.readlink(str(path)), want))
            continue
        if is_repo:
            ignored = git(project, "check-ignore", "-q", "--no-index", "--", link)
            tracked = git(project, "ls-files", "--error-unmatch", "--", link)
            if tracked is not None and tracked.returncode == 0:
                report.info("{} is tracked by git".format(link))
            elif ignored is not None and ignored.returncode != 0:
                report.warn("{} is not ignored by git".format(link))


def check_rule_index(project, agents_text, report):
    rules_dir = project / ".agents" / "rules"
    actual = {p.name for p in rules_dir.glob("*.md")} if rules_dir.is_dir() else set()
    body = section(agents_text, "Rule Index")
    if body is None:
        report.error("AGENTS.md has no '## Rule Index' section")
        return
    listed = set(re.findall(r"`\.agents/rules/([^`/]+\.md)`", body))
    for name in sorted(actual - listed):
        report.error("rule file not in the Rule Index: .agents/rules/{}".format(name))
    for name in sorted(listed - actual):
        report.error("Rule Index lists a missing file: .agents/rules/{}".format(name))


def check_skill_index(project, agents_text, report):
    skills_dir = project / ".agents" / "skills"
    actual = {p.parent.name for p in skills_dir.glob("*/SKILL.md")} if skills_dir.is_dir() else set()
    body = section(agents_text, "Skill Index")
    if body is None:
        report.error("AGENTS.md has no '## Skill Index' section")
        return
    listed = set(re.findall(r"`\.agents/skills/([^`/]+)/SKILL\.md`", body))
    for name in sorted(listed - actual):
        report.error("Skill Index lists a missing skill: .agents/skills/{}/SKILL.md".format(name))
    for name in sorted(actual - listed):
        report.warn("skill not in the Skill Index: .agents/skills/{}/SKILL.md".format(name))


def check_agents_paths(project, agents_text, report):
    seen = set()
    for match in AGENTS_PATH.finditer(agents_text):
        rel = match.group(1)
        if rel in seen or any(token in rel for token in ("<", "*", "NNNN", "...")):
            continue
        seen.add(rel)
        # Task notes and ADRs appear when the first task or decision needs them.
        if rel.startswith(".agents/tasks") or rel.startswith("docs/adr"):
            continue
        if not (project / rel.rstrip("/")).exists():
            report.warn("AGENTS.md mentions {}, which does not exist".format(rel))


def check_leftovers(project, report):
    for path in agent_markdown(project):
        rel = path.relative_to(project).as_posix()
        for number, line in enumerate(read_text(path).splitlines(), 1):
            for marker in TEMPLATE_LEFTOVERS:
                if marker in line:
                    report.warn("template text left in {}:{}: {}".format(rel, number, line.strip()[:100]))
                    break


def check_box_drawing(project, report):
    for path in agent_markdown(project):
        rel = path.relative_to(project).as_posix()
        hits = [n for n, line in enumerate(read_text(path).splitlines(), 1) if BOX_DRAWING.search(line)]
        if hits:
            shown = ", ".join(str(n) for n in hits[:5]) + (" ..." if len(hits) > 5 else "")
            report.warn("box-drawing characters in {} (lines {}); use Mermaid or plain lists".format(rel, shown))


def check_task_links(project, report):
    for path in all_markdown(project):
        rel = path.relative_to(project).as_posix()
        for number, line in enumerate(read_text(path).splitlines(), 1):
            for match in TASK_LINK.finditer(line):
                report.error("{}:{} links into a task note: .agents/tasks/{}".format(rel, number, match.group(1)))


def check_records(project, report):
    adr = project / "docs" / "adr"
    if adr.is_dir():
        records = sorted(p.name for p in adr.glob("[0-9][0-9][0-9][0-9]-*.md"))
        if records:
            report.info("ADRs: {}".format(", ".join(records)))
    tasks = project / ".agents" / "tasks"
    if tasks.is_dir():
        names = sorted(p.name for p in tasks.iterdir() if p.is_dir())
        if names:
            report.info("task notes: {}".format(", ".join(names)))


def main():
    if len(sys.argv) != 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        return 2
    project = Path(sys.argv[1]).resolve()
    if not project.is_dir():
        print("{} is not a directory".format(project))
        return 2
    report = Report()
    agents_text = check_entry_points(project, report)
    check_links(project, report)
    if agents_text:
        check_rule_index(project, agents_text, report)
        check_skill_index(project, agents_text, report)
        check_agents_paths(project, agents_text, report)
    check_leftovers(project, report)
    check_box_drawing(project, report)
    check_task_links(project, report)
    check_records(project, report)
    for label, messages in (("error", report.errors), ("warn", report.warnings), ("info", report.infos)):
        for message in messages:
            print("{:<6} {}".format(label, message))
    print("{} error(s), {} warning(s)".format(len(report.errors), len(report.warnings)))
    return 1 if report.errors else 0


if __name__ == "__main__":
    sys.exit(main())
