#!/usr/bin/env python3
"""Install the agents project template into a project without overwriting anything.

  setup.py inspect <project>
  setup.py plan <project> [--rules all|none|NAME[,NAME...]] [--adopt]
  setup.py apply <project> [--rules all|none|NAME[,NAME...]] [--adopt]
  setup.py links <project>
  setup.py sync-assets <template-root> [--check] [--force]

inspect      Report the project's state: new or existing, git status, agent setup found,
             instructions to consolidate, discovery links, and stack signals.
plan         Show what apply would do. Changes nothing.
apply        Create what is missing: the template files, the template's skills and this
             skill under .agents/skills/, the discovery links, and their .gitignore entries.
             Existing files are kept and reported. Safe to rerun.
links        Create or repair only the discovery links, e.g. after a fresh clone.
sync-assets  For maintainers of the template repository: copy its files into this skill's
             assets. --check only reports drift and exits 1 when there is any.

--rules      Which bundled rule files apply installs: all (default, as the template does),
             none, or a comma-separated list of names without .md.
--adopt      Move the contents of real .claude/rules, .claude/skills or .clinerules folders
             into .agents/ so the links can replace them. Only with the user's approval.

Requires Python 3.8+, standard library only.
"""

import argparse
import filecmp
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
SKILL_NAME = SKILL_DIR.name
ASSETS = SKILL_DIR / "assets"

# Template files at the project root: asset name, project path.
ROOT_FILES = [
    ("AGENTS.template.md", "AGENTS.md"),
    ("CLAUDE.template.md", "CLAUDE.md"),
    ("README.template.md", "README.md"),
]
GITIGNORE_ASSET = "gitignore.template"
# Assets keep SKILL.md under another name, so this skill holds exactly one SKILL.md.
SKILL_FILE_ASSET = "SKILL.template.md"

# Link path, target as written into the link, directory it must resolve to.
LINKS = [
    (".claude/rules", "../.agents/rules", ".agents/rules"),
    (".claude/skills", "../.agents/skills", ".agents/skills"),
    (".clinerules", "./.agents/rules", ".agents/rules"),
]
LINKED_UNDER_CLAUDE = (".claude/rules", ".claude/skills")

# Other tools' instruction files that the consolidation step looks at.
OTHER_INSTRUCTION_FILES = [
    "GEMINI.md",
    ".cursorrules",
    ".cursor/rules",
    ".windsurfrules",
    ".windsurf/rules",
    ".github/copilot-instructions.md",
    ".github/instructions",
    ".junie/guidelines.md",
    ".roorules",
    ".roo/rules",
    ".kiro/steering",
    ".amazonq/rules",
]

# Entries that do not make a project "existing": a fresh repository may already have them.
NEW_PROJECT_ENTRIES = {
    ".git", ".ds_store", ".gitignore", ".gitattributes", "readme", "readme.md", "license",
    "license.md", "license.txt", ".claude", ".agents", ".idea", ".vscode",
}

# Directories never searched for stack signals.
SKIP_DIRS = {
    ".git", ".agents", ".claude", ".idea", ".vscode", "node_modules", "Library", "Temp", "Obj",
    "Logs", "build", "Build", "Builds", "dist", "out", "target", ".venv", "venv", "Pods",
    "DerivedData", ".gradle", "__pycache__", ".next", "coverage", ".build",
}

PLACEHOLDER_MARKERS = ("Placeholder:", "<package-manager>")


# ---------------------------------------------------------------------------
# Small helpers


def plural(count, word):
    return "{} {}{}".format(count, word, "" if count == 1 else "s")


def entries_text(count):
    return "1 entry" if count == 1 else "{} entries".format(count)


def skipped_name(name):
    return name in ("__pycache__", ".DS_Store") or name.endswith(".pyc")


def same_file(a, b):
    return Path(a).is_file() and Path(b).is_file() and filecmp.cmp(str(a), str(b), shallow=False)


def tree_files(root, skip_top=()):
    """Files under root by relative POSIX path, without caches and the given top-level dirs."""
    root = Path(root)
    found = {}
    for dirpath, dirnames, filenames in os.walk(str(root)):
        rel_dir = Path(dirpath).relative_to(root)
        dirnames[:] = sorted(
            d for d in dirnames
            if not skipped_name(d) and not (rel_dir == Path(".") and d in skip_top)
        )
        for name in filenames:
            if not skipped_name(name):
                found[(rel_dir / name).as_posix()] = Path(dirpath) / name
    return found


def same_tree(a, b, skip_top=()):
    files_a, files_b = tree_files(a, skip_top), tree_files(b, skip_top)
    return files_a.keys() == files_b.keys() and all(same_file(files_a[k], files_b[k]) for k in files_a)


def read_text(path):
    try:
        return Path(path).read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return ""


def is_link(path):
    """True for symlinks and, on Windows, directory junctions."""
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


def points_to(path, directory):
    return os.path.realpath(str(path)) == os.path.realpath(str(directory))


def visible_entries(directory):
    return sorted(p for p in Path(directory).iterdir() if not skipped_name(p.name))


def imports_only_agents_md(path):
    lines = [line.strip() for line in read_text(path).splitlines()]
    meaningful = [line for line in lines if line and not line.startswith("#")]
    return meaningful in (["@AGENTS.md"], ["@./AGENTS.md"])


def has_placeholders(text):
    return any(marker in text for marker in PLACEHOLDER_MARKERS)


def bundled_rules():
    return sorted(p.stem for p in (ASSETS / "rules").glob("*.md"))


def parse_rules(value):
    available = bundled_rules()
    if value in (None, "", "all"):
        return available
    if value == "none":
        return []
    names = [n.strip()[:-3] if n.strip().endswith(".md") else n.strip() for n in value.split(",")]
    unknown = [n for n in names if n and n not in available]
    if unknown:
        sys.exit("unknown rule file(s): {}. Bundled: {}".format(", ".join(unknown), ", ".join(available)))
    return [n for n in available if n in names]


def skill_assets():
    """(asset, project path) for every file of the template's skills shipped in assets/skills/."""
    root = ASSETS / "skills"
    entries = []
    if not root.is_dir():
        return entries
    for rel, asset in sorted(tree_files(root).items()):
        parts = rel.split("/")
        if parts[-1] == SKILL_FILE_ASSET:
            parts[-1] = "SKILL.md"
        entries.append((asset, ".agents/skills/" + "/".join(parts)))
    return entries


def template_files(rules):
    """(asset, project path) for every template file a run installs, .gitignore aside."""
    entries = [(ASSETS / asset, target) for asset, target in ROOT_FILES]
    entries += [(ASSETS / "rules" / (name + ".md"), ".agents/rules/" + name + ".md") for name in rules]
    entries += skill_assets()
    return entries


# ---------------------------------------------------------------------------
# Git


def git(project, *args):
    try:
        return subprocess.run(
            ["git", "-C", str(project)] + list(args),
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True,
        )
    except OSError:
        return None


def git_root(project):
    result = git(project, "rev-parse", "--show-toplevel")
    if result is None or result.returncode != 0:
        return None
    return Path(result.stdout.strip())


def git_tracked(project, path):
    result = git(project, "ls-files", "--", path)
    if result is None or result.returncode != 0:
        return []
    return [line for line in result.stdout.splitlines() if line]


def git_ignores(project, path):
    result = git(project, "check-ignore", "-q", "--no-index", "--", path)
    return result is not None and result.returncode == 0


# ---------------------------------------------------------------------------
# Inspection


def project_kind(project):
    entries = [p.name for p in project.iterdir()]
    others = [name for name in entries if name.lower() not in NEW_PROJECT_ENTRIES]
    return ("existing", len(others)) if others else ("new", 0)


def instructions_to_consolidate(project):
    found = []
    claude = project / "CLAUDE.md"
    if claude.is_file() and not imports_only_agents_md(claude):
        found.append("CLAUDE.md (own content)")
    for rel in OTHER_INSTRUCTION_FILES:
        path = project / rel
        if os.path.lexists(str(path)):
            if path.is_dir():
                found.append("{} ({})".format(rel, entries_text(len(visible_entries(path)))))
            else:
                found.append(rel)
    for link_rel, _, _ in LINKS:
        path = project / link_rel
        if os.path.lexists(str(path)) and not is_link(path):
            kind = "folder" if path.is_dir() else "file"
            found.append("{} (real {}, not a link)".format(link_rel, kind))
    return found


def setup_state(project):
    """none, template, initialized, or foreign (instructions from another convention)."""
    agents = project / "AGENTS.md"
    rules = project / ".agents" / "rules"
    if agents.is_file():
        if same_file(agents, ASSETS / "AGENTS.template.md") or has_placeholders(read_text(agents)):
            return "template"
        return "initialized" if rules.is_dir() else "foreign"
    if rules.is_dir() or instructions_to_consolidate(project):
        return "foreign"
    return "none"


def walk_limited(project, depth=3):
    project = Path(project)
    for dirpath, dirnames, filenames in os.walk(str(project)):
        rel = Path(dirpath).relative_to(project)
        level = 0 if rel == Path(".") else len(rel.parts)
        bundles = [d for d in dirnames if d.endswith(".xcodeproj")]
        dirnames[:] = sorted(
            d for d in dirnames
            if d not in SKIP_DIRS and not d.startswith(".") and not d.endswith(".xcodeproj") and level < depth
        )
        for name in bundles:
            yield Path(dirpath) / name
        for name in sorted(filenames):
            yield Path(dirpath) / name


def has_files(directory, suffix, limit=2000):
    for count, path in enumerate(walk_limited(directory, depth=8)):
        if count > limit:
            return False
        if path.name.endswith(suffix):
            return True
    return False


def detect_stack(project):
    """(where, description, suggested rule files) for each stack signal found near the root."""
    findings = []
    unity_roots = set()
    for path in walk_limited(project):
        rel = path.relative_to(project).as_posix()
        name = path.name
        if name == "ProjectVersion.txt" and path.parent.name == "ProjectSettings":
            root = path.parent.parent
            unity_roots.add(root)
            version = ""
            for line in read_text(path).splitlines():
                if line.startswith("m_EditorVersion:"):
                    version = line.split(":", 1)[1].strip()
            packages = []
            try:
                deps = json.loads(read_text(root / "Packages" / "manifest.json") or "{}").get("dependencies", {})
            except ValueError:
                deps = {}
            for key, label in (
                ("com.unity.render-pipelines.universal", "URP"),
                ("com.unity.render-pipelines.high-definition", "HDRP"),
                ("com.unity.inputsystem", "Input System"),
                ("com.unity.xr.openxr", "OpenXR"),
                ("com.unity.xr.interaction.toolkit", "XR Interaction Toolkit"),
            ):
                if key in deps:
                    packages.append(label)
            description = "Unity {}".format(version).strip()
            if packages:
                description += " ({})".format(", ".join(packages))
            findings.append((rel, description,
                             ["code-conventions-csharp", "code-conventions-unity", "architecture-unity-game"]))
        elif name == "package.json":
            try:
                manifest = json.loads(read_text(path) or "{}")
            except ValueError:
                manifest = {}
            deps = {}
            for key in ("dependencies", "devDependencies", "peerDependencies"):
                deps.update(manifest.get(key) or {})
            parts, rules = ["Node"], []
            if "typescript" in deps or (path.parent / "tsconfig.json").exists():
                parts.append("TypeScript")
                rules.append("code-conventions-typescript")
            if "react" in deps:
                parts.append("React")
                rules += ["code-conventions-react", "architecture-react-app"]
            for dep, label in (("next", "Next.js"), ("vite", "Vite"), ("vue", "Vue"),
                               ("@angular/core", "Angular"), ("svelte", "Svelte"), ("express", "Express")):
                if dep in deps:
                    parts.append(label)
            findings.append((rel, ", ".join(parts), rules))
        elif name in ("pom.xml", "build.gradle", "build.gradle.kts"):
            languages, rules = [], []
            if has_files(path.parent, ".java"):
                languages.append("Java")
                rules.append("code-conventions-java")
            if has_files(path.parent, ".kt"):
                languages.append("Kotlin")
            findings.append((rel, "JVM build ({})".format(", ".join(languages) or "no sources yet"), rules))
        elif name == "Package.swift" or name.endswith(".xcodeproj"):
            text = read_text(path) if path.is_file() else read_text(path / "project.pbxproj")
            is_macos = ".macOS(" in text or "SDKROOT = macosx" in text
            findings.append((rel, "Swift ({})".format("macOS" if is_macos else "platform not detected"),
                             ["code-conventions-swift-macos"] if is_macos else []))
        elif name.endswith(".csproj") or name.endswith(".sln"):
            if path.parent not in unity_roots and not (path.parent / "ProjectSettings").is_dir():
                findings.append((rel, ".NET (C#)", ["code-conventions-csharp"]))
        elif name in ("pyproject.toml", "requirements.txt", "setup.py"):
            findings.append((rel, "Python", []))
        elif name == "go.mod":
            findings.append((rel, "Go", []))
        elif name == "Cargo.toml":
            findings.append((rel, "Rust", []))
        elif name == "Gemfile":
            findings.append((rel, "Ruby", []))
        elif name == "composer.json":
            findings.append((rel, "PHP", []))
        elif name == "pubspec.yaml":
            findings.append((rel, "Dart/Flutter", []))
        if len(findings) >= 25:
            break
    return findings


def link_status(project, link_rel, want):
    path = project / link_rel
    if not os.path.lexists(str(path)):
        return "missing"
    if is_link(path):
        return "ok" if points_to(path, project / want) else "points to {}".format(os.readlink(str(path)))
    if path.is_dir():
        return "real folder ({})".format(entries_text(len(visible_entries(path))))
    return "real file"


def cmd_inspect(project):
    kind, count = project_kind(project)
    print("project      {}".format(project))
    print("kind         {}".format("new" if kind == "new" else "existing ({} top-level entries)".format(count)))
    root = git_root(project)
    if root is None:
        result = git(project, "--version")
        print("git          {}".format("git not found" if result is None else "not a repository"))
    else:
        status = git(project, "status", "--porcelain")
        changes = len([line for line in (status.stdout if status else "").splitlines() if line])
        where = "" if points_to(root, project) else " (root {})".format(root)
        print("git          repository{}, {}".format(where, "clean" if changes == 0 else
                                                     plural(changes, "uncommitted change")))
    print("setup        {}".format(setup_state(project)))
    found = instructions_to_consolidate(project)
    print("consolidate  {}".format(", ".join(found) if found else "nothing"))
    for link_rel, _, want in LINKS:
        print("link         {:<15} {}".format(link_rel, link_status(project, link_rel, want)))
    suggested = ["code-conventions", "documentation-and-diagrams", "stack"]
    stack = detect_stack(project)
    for where, description, rules in stack:
        print("stack        {}: {}{}".format(where, description, " -> " + ", ".join(rules) if rules else ""))
        suggested += [r for r in rules if r not in suggested]
    if not stack:
        print("stack        no signals")
    print("rules        fitting the stack: {}".format(", ".join(suggested)))
    return 0


# ---------------------------------------------------------------------------
# Planning


class Action(object):
    def __init__(self, kind, path, detail="", source=None, target=None, want=None, entries=None):
        self.kind = kind          # create, copy, link, adopt, append, same, keep, migrate, note, conflict
        self.path = path          # project-relative path
        self.detail = detail
        self.source = source      # asset to copy, or the asset to diff a kept file against
        self.target = target      # link target as written
        self.want = want          # directory a link must resolve to
        self.entries = entries    # .gitignore entries to append


CHANGING = ("create", "copy", "link", "adopt", "append")


def ignore_entries_needed(project):
    gitignore = project / ".gitignore"
    patterns = set()
    for line in read_text(gitignore).splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            patterns.add(line.strip("/"))
    tracked = git_tracked(project, ".claude")
    shared_claude_files = [
        path for path in tracked
        if not any(path == link or path.startswith(link + "/") for link in LINKED_UNDER_CLAUDE)
    ]
    wanted = [".clinerules"] + (list(LINKED_UNDER_CLAUDE) if shared_claude_files else [".claude"])

    def covered(entry):
        if entry in patterns or (entry.startswith(".claude/") and ".claude" in patterns):
            return True
        return git_root(project) is not None and git_ignores(project, entry)

    return [entry for entry in wanted if not covered(entry)]


def kept_detail(rel, project_file, asset):
    if rel == "AGENTS.md":
        if has_placeholders(read_text(project_file)):
            return "the template from another version; the first pass fills it"
        return "project content: add the template sections it lacks (references/existing-projects.md)"
    if rel == "README.md":
        return "the project's own README"
    return "differs from the bundled version, diff against {}".format(asset)


def compute_plan(project, rules, adopt):
    plan = []
    claimed = {}  # target dir -> {entry name: source path} for planned adoptions
    adopted_dirs = []

    claude_dir = project / ".claude"
    claude_blocked = os.path.lexists(str(claude_dir)) and (is_link(claude_dir) or not claude_dir.is_dir())

    for link_rel, target, want in LINKS:
        path = project / link_rel
        if link_rel.startswith(".claude/") and claude_blocked:
            plan.append(Action("conflict", link_rel, ".claude is a file or a link, not a folder"))
            continue
        if not os.path.lexists(str(path)):
            plan.append(Action("link", link_rel, "-> " + target, target=target, want=want))
            continue
        if is_link(path):
            if points_to(path, project / want):
                plan.append(Action("same", link_rel, "link -> " + target))
            else:
                plan.append(Action("conflict", link_rel, "links to {}, expected {}".format(os.readlink(str(path)), target)))
            continue
        if not path.is_dir():
            plan.append(Action("conflict", link_rel,
                               "a file, not a link: move its content into AGENTS.md or .agents/rules/ "
                               "(references/existing-projects.md), then remove it with approval"))
            continue
        entries = visible_entries(path)
        destination = project / want
        taken = claimed.setdefault(want, {})
        clashes = []
        for entry in entries:
            existing = destination / entry.name
            earlier = taken.get(entry.name)
            for other in (existing, earlier):
                if other is None or not os.path.lexists(str(other)):
                    continue
                identical = same_file(entry, other) if entry.is_file() else (Path(other).is_dir() and same_tree(entry, other))
                if not identical:
                    clashes.append(entry.name)
        if clashes:
            plan.append(Action("conflict", link_rel, "a real folder whose entries clash with {}/: {}".format(
                want, ", ".join(sorted(set(clashes))))))
        elif adopt:
            for entry in entries:
                taken[entry.name] = entry
            adopted_dirs.append(path)
            plan.append(Action("adopt", link_rel, "move its {} into {}/, then link -> {}".format(
                entries_text(len(entries)), want, target), target=target, want=want))
        else:
            plan.append(Action("conflict", link_rel,
                               "a real folder with {}: move them into {}/ (--adopt, with approval) "
                               "so the link can replace it".format(entries_text(len(entries)), want)))

    def adopted_source(rel):
        """The file or folder an adoption brings to rel, if any."""
        for want, taken in claimed.items():
            prefix = want + "/"
            if rel.startswith(prefix):
                first, _, rest = rel[len(prefix):].partition("/")
                source = taken.get(first)
                if source is not None:
                    return source / rest if rest else source
        return None

    for asset, rel in template_files(rules):
        path = project / rel
        brought = adopted_source(rel)
        if brought is not None and os.path.lexists(str(brought)):
            if same_file(brought, asset):
                plan.append(Action("same", rel, "comes with the adoption"))
            else:
                plan.append(Action("keep", rel, "comes with the adoption; " + kept_detail(rel, brought, asset)))
            continue
        if rel == "CLAUDE.md" and path.is_file() and not same_file(path, asset):
            if imports_only_agents_md(path):
                plan.append(Action("same", rel, "imports AGENTS.md"))
            else:
                plan.append(Action("migrate", rel, "has its own content: move it into AGENTS.md or "
                                                   ".agents/rules/, then reduce it to the import"))
            continue
        if not os.path.lexists(str(path)):
            plan.append(Action("create", rel, source=asset))
        elif same_file(path, asset):
            plan.append(Action("same", rel))
        else:
            plan.append(Action("keep", rel, kept_detail(rel, path, asset), source=asset))

    rules_dir = project / ".agents" / "rules"
    if rules_dir.is_dir():
        bundled = set(bundled_rules())
        own = []
        for rule in sorted(rules_dir.glob("*.md")):
            if rule.stem in rules:
                continue
            if rule.stem in bundled:
                plan.append(Action("note", ".agents/rules/" + rule.name,
                                   "bundled rule present but not selected", source=ASSETS / "rules" / rule.name))
            else:
                own.append(rule.name)
        if own:
            plan.append(Action("note", ".agents/rules/", "project rule files not in the template: " + ", ".join(own)))

    own_copy = project / ".agents" / "skills" / SKILL_NAME
    rel = ".agents/skills/{}/".format(SKILL_NAME)
    if points_to(SKILL_DIR, own_copy):
        plan.append(Action("same", rel, "this skill, running from the project"))
    elif any(points_to(SKILL_DIR.parent, d) for d in adopted_dirs):
        plan.append(Action("same", rel, "this skill, moved by the adoption above"))
    elif os.path.lexists(str(own_copy)):
        if same_tree(SKILL_DIR, own_copy, skip_top=("evals",)):
            plan.append(Action("same", rel, "this skill"))
        else:
            plan.append(Action("keep", rel, "another version of this skill: compare before replacing it"))
    else:
        plan.append(Action("copy", rel, "this skill"))

    for rel in OTHER_INSTRUCTION_FILES:
        if os.path.lexists(str(project / rel)):
            plan.append(Action("migrate", rel, "another tool's instructions (references/existing-projects.md)"))

    gitignore = project / ".gitignore"
    if not gitignore.exists():
        plan.append(Action("create", ".gitignore", source=ASSETS / GITIGNORE_ASSET))
    else:
        needed = ignore_entries_needed(project)
        if needed:
            plan.append(Action("append", ".gitignore", "+ " + ", ".join(needed), entries=needed))
        else:
            plan.append(Action("same", ".gitignore", "discovery links already ignored"))
    return plan


ORDER = ["adopt", "create", "copy", "link", "append", "same", "keep", "migrate", "note", "conflict"]


def print_plan(plan, heading):
    print(heading)
    for action in sorted(plan, key=lambda a: ORDER.index(a.kind)):
        line = "  {:<9} {}".format(action.kind, action.path)
        if action.detail:
            line += "  ({})".format(action.detail)
        print(line)
    counts = {}
    for action in plan:
        counts[action.kind] = counts.get(action.kind, 0) + 1
    print("summary: " + ", ".join("{} {}".format(counts[k], k) for k in ORDER if k in counts))


# ---------------------------------------------------------------------------
# Applying


def make_link(path, target):
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        os.symlink(target, str(path), target_is_directory=True)
        return "symlink"
    except OSError:
        if os.name != "nt":
            raise
        import _winapi  # Directory junctions need no symlink privilege on Windows.
        _winapi.CreateJunction(str((path.parent / target).resolve()), str(path))
        return "junction"


def copy_skill(destination):
    def ignore(directory, names):
        top = Path(directory).resolve() == SKILL_DIR
        return [n for n in names if skipped_name(n) or (top and n == "evals")]

    shutil.copytree(str(SKILL_DIR), str(destination), ignore=ignore)


# Set when an adoption moves the folder this skill runs from.
MOVED_SKILL_DIR = []


def relocated(path):
    """Asset path after an adoption moved this skill; unchanged otherwise."""
    if not MOVED_SKILL_DIR:
        return Path(path)
    try:
        return MOVED_SKILL_DIR[0] / Path(path).relative_to(SKILL_DIR)
    except ValueError:
        return Path(path)


def execute(project, action):
    path = project / action.path
    if action.kind == "create":
        if os.path.lexists(str(path)):
            return "kept: appeared during apply"
        path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(str(relocated(action.source)), str(path))
        return "created"
    if action.kind == "copy":
        if os.path.lexists(str(path)):
            return "kept: appeared during apply"
        path.parent.mkdir(parents=True, exist_ok=True)
        copy_skill(path)
        return "copied"
    if action.kind == "adopt":
        destination = project / action.want
        destination.mkdir(parents=True, exist_ok=True)
        moves_this_skill = points_to(SKILL_DIR.parent, path)
        for entry in visible_entries(path):
            existing = destination / entry.name
            if os.path.lexists(str(existing)):
                identical = same_file(entry, existing) if entry.is_file() else same_tree(entry, existing)
                if not identical:
                    return "stopped: {} clashes with {}".format(entry.name, existing)
                if entry.is_dir():
                    shutil.rmtree(str(entry))
                else:
                    entry.unlink()
            else:
                shutil.move(str(entry), str(existing))
        for leftover in path.iterdir():  # only cache files remain
            if leftover.is_dir():
                shutil.rmtree(str(leftover))
            else:
                leftover.unlink()
        path.rmdir()
        if moves_this_skill:
            MOVED_SKILL_DIR.append(destination / SKILL_NAME)
        return "adopted, " + make_link(path, action.target) + " created"
    if action.kind == "link":
        if os.path.lexists(str(path)):
            return "kept: appeared during apply"
        (project / action.want).mkdir(parents=True, exist_ok=True)
        return make_link(path, action.target) + " created"
    if action.kind == "append":
        text = read_text(path)
        block = ("" if text.endswith("\n") or not text else "\n") + "\n# Agents\n" + "\n".join(action.entries) + "\n"
        with open(str(path), "a", encoding="utf-8") as handle:
            handle.write(block)
        return "appended"
    return ""


def cmd_plan(project, rules, adopt):
    plan = compute_plan(project, rules, adopt)
    print_plan(plan, "plan for {} (nothing changed)".format(project))
    return 0


def cmd_apply(project, rules, adopt):
    plan = compute_plan(project, rules, adopt)
    by_kind = {kind: [a for a in plan if a.kind == kind] for kind in CHANGING}
    print("apply to {}".format(project))
    for kind in ("adopt", "create", "copy", "link", "append"):
        for action in by_kind[kind]:
            print("  {:<9} {}  {}".format(kind, action.path, execute(project, action)))
    rest = [a for a in plan if a.kind not in CHANGING]
    if rest:
        print_plan(rest, "unchanged and open items:")
    conflicts = [a for a in plan if a.kind == "conflict"]
    return 1 if conflicts else 0


def cmd_links(project):
    missing_dirs = [want for _, _, want in LINKS if not (project / want).is_dir()]
    if missing_dirs:
        print("missing {}: run apply first".format(", ".join(sorted(set(missing_dirs)))))
        return 1
    problems = 0
    for link_rel, target, want in LINKS:
        path = project / link_rel
        status = link_status(project, link_rel, want)
        if status == "missing":
            print("  {:<15} {} created".format(link_rel, make_link(path, target)))
        elif status == "ok":
            print("  {:<15} ok".format(link_rel))
        else:
            problems += 1
            print("  {:<15} {}: resolve it by hand (references/existing-projects.md)".format(link_rel, status))
    return 1 if problems else 0


# ---------------------------------------------------------------------------
# Maintaining the bundled template


def sync_pairs(root):
    """(template file, asset) pairs that make up the bundled template."""
    pairs = [(root / target, ASSETS / asset) for asset, target in ROOT_FILES]
    pairs.append((root / ".gitignore", ASSETS / GITIGNORE_ASSET))
    for rule in sorted((root / ".agents" / "rules").glob("*.md")):
        pairs.append((rule, ASSETS / "rules" / rule.name))
    skills = root / ".agents" / "skills"
    if skills.is_dir():
        for skill in sorted(p for p in skills.iterdir() if p.is_dir() and p.name != SKILL_NAME):
            for rel, source in sorted(tree_files(skill).items()):
                parts = rel.split("/")
                if parts[-1] == "SKILL.md":
                    parts[-1] = SKILL_FILE_ASSET
                pairs.append((source, ASSETS / "skills" / skill.name / "/".join(parts)))
    return pairs


def cmd_sync_assets(root, check, force):
    agents = root / "AGENTS.md"
    if not force and not (agents.is_file() and has_placeholders(read_text(agents))):
        print("{} does not look like the template repository (its AGENTS.md has no placeholders). "
              "Use --force to sync anyway.".format(root))
        return 1
    pairs = sync_pairs(root)
    wanted = {asset.resolve() for _, asset in pairs}
    stale = [p for p in tree_files(ASSETS).values() if p.resolve() not in wanted]
    drift = 0
    for source, asset in pairs:
        if not source.exists():
            drift += 1
            print("  {:<8} {} (template file not found)".format("missing", source))
            continue
        if same_file(source, asset):
            continue
        drift += 1
        label = "missing" if not asset.exists() else "differs"
        print("  {:<8} {}".format(label, asset.relative_to(SKILL_DIR)))
        if not check:
            asset.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(str(source), str(asset))
    for path in stale:
        drift += 1
        print("  {:<8} {}".format("stale", path.relative_to(SKILL_DIR)))
        if not check:
            path.unlink()
    if check:
        print("in sync" if drift == 0 else "{} file(s) out of sync".format(drift))
        return 1 if drift else 0
    print("in sync" if drift == 0 else "{} file(s) updated".format(drift))
    return 0


# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command")
    sub.add_parser("inspect").add_argument("project")
    for name in ("plan", "apply"):
        command = sub.add_parser(name)
        command.add_argument("project")
        command.add_argument("--rules", default="all")
        command.add_argument("--adopt", action="store_true")
    sub.add_parser("links").add_argument("project")
    sync = sub.add_parser("sync-assets")
    sync.add_argument("root")
    sync.add_argument("--check", action="store_true")
    sync.add_argument("--force", action="store_true")
    args = parser.parse_args()
    if args.command is None:
        parser.print_help()
        return 2

    if args.command == "sync-assets":
        return cmd_sync_assets(Path(args.root).resolve(), args.check, args.force)
    project = Path(args.project).resolve()
    if not project.is_dir():
        print("{} is not a directory; create the project folder first".format(project))
        return 2
    if args.command == "inspect":
        return cmd_inspect(project)
    if args.command == "links":
        return cmd_links(project)
    rules = parse_rules(args.rules)
    if args.command == "plan":
        return cmd_plan(project, rules, args.adopt)
    return cmd_apply(project, rules, args.adopt)


if __name__ == "__main__":
    sys.exit(main())
