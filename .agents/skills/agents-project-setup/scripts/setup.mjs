#!/usr/bin/env node
// setup.py for machines with Node.js instead of Python: the same commands, flags, output, and
// exit codes. Change both together, then run evals/parity.mjs.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  IS_WINDOWS,
  compareStrings,
  exists,
  git,
  globDir,
  isDir,
  isFile,
  isLink,
  keepDirs,
  lexists,
  nativeNewlines,
  pathKey,
  print,
  printError,
  readText,
  realpath,
  relativePosix,
  sortedPaths,
  sortedStrings,
  splitLines,
  strip,
  walk,
  windowsCannotFollow,
} from './python-compat.mjs';

const USAGE = `Install the agents project template into a project without overwriting anything.

  setup.mjs inspect <project>
  setup.mjs plan <project> [--rules all|none|NAME[,NAME...]] [--adopt]
  setup.mjs apply <project> [--rules all|none|NAME[,NAME...]] [--adopt]
  setup.mjs links <project>
  setup.mjs sync-assets <template-root> [--check] [--force]

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

Requires Node.js 18+, built-in modules only. setup.py does the same with Python.`;

const SKILL_DIR = path.dirname(path.dirname(realpath(fileURLToPath(import.meta.url))));
const SKILL_NAME = path.basename(SKILL_DIR);
const ASSETS = path.join(SKILL_DIR, 'assets');

// Template files at the project root: asset name, project path.
const ROOT_FILES = [
  ['AGENTS.template.md', 'AGENTS.md'],
  ['CLAUDE.template.md', 'CLAUDE.md'],
  ['README.template.md', 'README.md'],
];
const GITIGNORE_ASSET = 'gitignore.template';
// Assets keep SKILL.md under another name, so this skill holds exactly one SKILL.md.
const SKILL_FILE_ASSET = 'SKILL.template.md';

// Link path, target as written into the link, directory it must resolve to.
const LINKS = [
  ['.claude/rules', '../.agents/rules', '.agents/rules'],
  ['.claude/skills', '../.agents/skills', '.agents/skills'],
  ['.clinerules', './.agents/rules', '.agents/rules'],
];
const LINKED_UNDER_CLAUDE = ['.claude/rules', '.claude/skills'];

// Other tools' instruction files that the consolidation step looks at.
const OTHER_INSTRUCTION_FILES = [
  'GEMINI.md',
  '.cursorrules',
  '.cursor/rules',
  '.windsurfrules',
  '.windsurf/rules',
  '.github/copilot-instructions.md',
  '.github/instructions',
  '.junie/guidelines.md',
  '.roorules',
  '.roo/rules',
  '.kiro/steering',
  '.amazonq/rules',
];

// Entries that do not make a project "existing": a fresh repository may already have them.
const NEW_PROJECT_ENTRIES = new Set([
  '.git', '.ds_store', '.gitignore', '.gitattributes', 'readme', 'readme.md', 'license',
  'license.md', 'license.txt', '.claude', '.agents', '.idea', '.vscode',
]);

// Directories never searched for stack signals.
const SKIP_DIRS = new Set([
  '.git', '.agents', '.claude', '.idea', '.vscode', 'node_modules', 'Library', 'Temp', 'Obj',
  'Logs', 'build', 'Build', 'Builds', 'dist', 'out', 'target', '.venv', 'venv', 'Pods',
  'DerivedData', '.gradle', '__pycache__', '.next', 'coverage', '.build',
]);

const PLACEHOLDER_MARKERS = ['Placeholder:', '<package-manager>'];

const UNFOLLOWABLE_LINK = 'symlink with / in its target, which Windows cannot follow';

const UNITY_PACKAGES = [
  ['com.unity.render-pipelines.universal', 'URP'],
  ['com.unity.render-pipelines.high-definition', 'HDRP'],
  ['com.unity.inputsystem', 'Input System'],
  ['com.unity.xr.openxr', 'OpenXR'],
  ['com.unity.xr.interaction.toolkit', 'XR Interaction Toolkit'],
];
const NODE_FRAMEWORKS = [
  ['next', 'Next.js'], ['vite', 'Vite'], ['vue', 'Vue'], ['@angular/core', 'Angular'],
  ['svelte', 'Svelte'], ['express', 'Express'],
];

// ---------------------------------------------------------------------------
// Small helpers

class ExitError extends Error {} // sys.exit(message): the message goes to stderr, exit code 1.

class UsageError extends Error {} // argparse errors: exit code 2.

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function entriesText(count) {
  return count === 1 ? '1 entry' : `${count} entries`;
}

function skippedName(name) {
  return name === '__pycache__' || name === '.DS_Store' || name.endsWith('.pyc');
}

// filecmp.cmp(shallow=False) on two regular files.
function sameFile(a, b) {
  const first = isFile(a) ? fs.statSync(a) : null;
  const second = isFile(b) ? fs.statSync(b) : null;
  if (first === null || second === null || first.size !== second.size) {
    return false;
  }
  return fs.readFileSync(a).equals(fs.readFileSync(b));
}

// Files under root by relative POSIX path, without caches and the given top-level dirs.
function treeFiles(root, skipTop = []) {
  const found = new Map();
  for (const step of walk(root)) {
    const relDir = relativePosix(root, step.dirpath);
    keepDirs(step, sortedStrings(step.dirnames.filter(
      (d) => !skippedName(d) && !(relDir === '' && skipTop.includes(d)),
    )));
    for (const name of sortedStrings(step.filenames)) {
      if (!skippedName(name)) {
        found.set(relDir ? `${relDir}/${name}` : name, path.join(step.dirpath, name));
      }
    }
  }
  return found;
}

function sameTree(a, b, skipTop = []) {
  const filesA = treeFiles(a, skipTop);
  const filesB = treeFiles(b, skipTop);
  if (filesA.size !== filesB.size || [...filesA.keys()].some((key) => !filesB.has(key))) {
    return false;
  }
  return [...filesA].every(([key, file]) => sameFile(file, filesB.get(key)));
}

function pointsTo(file, directory) {
  return realpath(file) === realpath(directory);
}

function visibleEntries(directory) {
  return sortedPaths(fs.readdirSync(directory).filter((name) => !skippedName(name))
    .map((name) => path.join(directory, name)));
}

function importsOnlyAgentsMd(file) {
  const meaningful = splitLines(readText(file)).map(strip).filter((line) => line && !line.startsWith('#'));
  return meaningful.length === 1 && ['@AGENTS.md', '@./AGENTS.md'].includes(meaningful[0]);
}

function hasPlaceholders(text) {
  return PLACEHOLDER_MARKERS.some((marker) => text.includes(marker));
}

// PurePath.stem
function stem(name) {
  const dot = name.lastIndexOf('.');
  return dot > 0 && dot < name.length - 1 ? name.slice(0, dot) : name;
}

function markdownName(name) {
  return name.endsWith('.md');
}

function bundledRules() {
  return sortedStrings(globDir(path.join(ASSETS, 'rules'), markdownName).map((file) => stem(path.basename(file))));
}

function parseRules(value) {
  const available = bundledRules();
  if (value === '' || value === 'all') {
    return available;
  }
  if (value === 'none') {
    return [];
  }
  const names = value.split(',').map((name) => {
    const trimmed = strip(name);
    return trimmed.endsWith('.md') ? trimmed.slice(0, -3) : trimmed;
  });
  const unknown = names.filter((name) => name && !available.includes(name));
  if (unknown.length) {
    throw new ExitError(`unknown rule file(s): ${unknown.join(', ')}. Bundled: ${available.join(', ')}`);
  }
  return available.filter((name) => names.includes(name));
}

// [asset, project path] for every file of the template's skills shipped in assets/skills/.
function skillAssets() {
  const root = path.join(ASSETS, 'skills');
  if (!isDir(root)) {
    return [];
  }
  return [...treeFiles(root)].sort((a, b) => compareStrings(a[0], b[0])).map(([rel, asset]) => {
    const parts = rel.split('/');
    if (parts[parts.length - 1] === SKILL_FILE_ASSET) {
      parts[parts.length - 1] = 'SKILL.md';
    }
    return [asset, `.agents/skills/${parts.join('/')}`];
  });
}

// [asset, project path] for every template file a run installs, .gitignore aside.
function templateFiles(rules) {
  return [
    ...ROOT_FILES.map(([asset, target]) => [path.join(ASSETS, asset), target]),
    ...rules.map((name) => [path.join(ASSETS, 'rules', `${name}.md`), `.agents/rules/${name}.md`]),
    ...skillAssets(),
  ];
}

// json.loads(text or "{}"), with {} for text that is not JSON.
function loadJson(text) {
  try {
    return JSON.parse(text || '{}');
  } catch {
    return {};
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function ownValue(object, key, fallback) {
  return isObject(object) && Object.prototype.hasOwnProperty.call(object, key) ? object[key] : fallback;
}

// Python's `key in container` for the JSON values a manifest may hold.
function contains(container, key) {
  if (typeof container === 'string' || Array.isArray(container)) {
    return container.includes(key);
  }
  return isObject(container) && Object.prototype.hasOwnProperty.call(container, key);
}

// Path(text): native separators, no trailing separator.
function pathFromText(text) {
  const normal = path.normalize(text);
  let end = normal.length;
  while (end > path.parse(normal).root.length && normal[end - 1] === path.sep) {
    end -= 1;
  }
  return normal.slice(0, end);
}

// ---------------------------------------------------------------------------
// Git

function gitRoot(project) {
  const result = git(project, 'rev-parse', '--show-toplevel');
  if (result === null || result.returncode !== 0) {
    return null;
  }
  return pathFromText(strip(result.stdout));
}

function gitTracked(project, file) {
  const result = git(project, 'ls-files', '--', file);
  if (result === null || result.returncode !== 0) {
    return [];
  }
  return splitLines(result.stdout).filter(Boolean);
}

function gitIgnores(project, file) {
  const result = git(project, 'check-ignore', '-q', '--no-index', '--', file);
  return result !== null && result.returncode === 0;
}

// ---------------------------------------------------------------------------
// Inspection

function projectKind(project) {
  const others = fs.readdirSync(project).filter((name) => !NEW_PROJECT_ENTRIES.has(name.toLowerCase()));
  return others.length ? ['existing', others.length] : ['new', 0];
}

function instructionsToConsolidate(project) {
  const found = [];
  const claude = path.join(project, 'CLAUDE.md');
  if (isFile(claude) && !importsOnlyAgentsMd(claude)) {
    found.push('CLAUDE.md (own content)');
  }
  for (const rel of OTHER_INSTRUCTION_FILES) {
    const file = path.join(project, rel);
    if (lexists(file)) {
      found.push(isDir(file) ? `${rel} (${entriesText(visibleEntries(file).length)})` : rel);
    }
  }
  for (const [linkRel] of LINKS) {
    const file = path.join(project, linkRel);
    if (lexists(file) && !isLink(file)) {
      found.push(`${linkRel} (real ${isDir(file) ? 'folder' : 'file'}, not a link)`);
    }
  }
  return found;
}

// none, template, initialized, or foreign (instructions from another convention).
function setupState(project) {
  const agents = path.join(project, 'AGENTS.md');
  const rules = path.join(project, '.agents', 'rules');
  if (isFile(agents)) {
    if (sameFile(agents, path.join(ASSETS, 'AGENTS.template.md')) || hasPlaceholders(readText(agents))) {
      return 'template';
    }
    return isDir(rules) ? 'initialized' : 'foreign';
  }
  if (isDir(rules) || instructionsToConsolidate(project).length) {
    return 'foreign';
  }
  return 'none';
}

function* walkLimited(project, depth = 3) {
  for (const step of walk(project)) {
    const rel = path.relative(project, step.dirpath);
    const level = rel === '' ? 0 : rel.split(path.sep).length;
    const bundles = sortedStrings(step.dirnames.filter((d) => d.endsWith('.xcodeproj')));
    keepDirs(step, sortedStrings(step.dirnames.filter(
      (d) => !SKIP_DIRS.has(d) && !d.startsWith('.') && !d.endsWith('.xcodeproj') && level < depth,
    )));
    for (const name of bundles) {
      yield path.join(step.dirpath, name);
    }
    for (const name of sortedStrings(step.filenames)) {
      yield path.join(step.dirpath, name);
    }
  }
}

function hasFiles(directory, suffix, limit = 2000) {
  let count = 0;
  for (const file of walkLimited(directory, 8)) {
    if (count > limit) {
      return false;
    }
    if (path.basename(file).endsWith(suffix)) {
      return true;
    }
    count += 1;
  }
  return false;
}

// [where, description, suggested rule files] for each stack signal found near the root.
function detectStack(project) {
  const findings = [];
  const unityRoots = new Set();
  for (const file of walkLimited(project)) {
    const rel = relativePosix(project, file);
    const name = path.basename(file);
    const parent = path.dirname(file);
    if (name === 'ProjectVersion.txt' && path.basename(parent) === 'ProjectSettings') {
      const root = path.dirname(parent);
      unityRoots.add(pathKey(root));
      let version = '';
      for (const line of splitLines(readText(file))) {
        if (line.startsWith('m_EditorVersion:')) {
          version = strip(line.slice(line.indexOf(':') + 1));
        }
      }
      const manifest = loadJson(readText(path.join(root, 'Packages', 'manifest.json')));
      const deps = ownValue(manifest, 'dependencies', {});
      const packages = UNITY_PACKAGES.filter(([key]) => contains(deps, key)).map(([, label]) => label);
      let description = strip(`Unity ${version}`);
      if (packages.length) {
        description += ` (${packages.join(', ')})`;
      }
      findings.push([rel, description, ['code-conventions-csharp', 'code-conventions-unity', 'architecture-unity-game']]);
    } else if (name === 'package.json') {
      const manifest = loadJson(readText(file));
      const deps = new Set();
      for (const key of ['dependencies', 'devDependencies', 'peerDependencies']) {
        const group = ownValue(manifest, key, null);
        if (isObject(group)) {
          Object.keys(group).forEach((dep) => deps.add(dep));
        }
      }
      const parts = ['Node'];
      const rules = [];
      if (deps.has('typescript') || exists(path.join(parent, 'tsconfig.json'))) {
        parts.push('TypeScript');
        rules.push('code-conventions-typescript');
      }
      if (deps.has('react')) {
        parts.push('React');
        rules.push('code-conventions-react', 'architecture-react-app');
      }
      for (const [dep, label] of NODE_FRAMEWORKS) {
        if (deps.has(dep)) {
          parts.push(label);
        }
      }
      findings.push([rel, parts.join(', '), rules]);
    } else if (['pom.xml', 'build.gradle', 'build.gradle.kts'].includes(name)) {
      const languages = [];
      const rules = [];
      if (hasFiles(parent, '.java')) {
        languages.push('Java');
        rules.push('code-conventions-java');
      }
      if (hasFiles(parent, '.kt')) {
        languages.push('Kotlin');
      }
      findings.push([rel, `JVM build (${languages.join(', ') || 'no sources yet'})`, rules]);
    } else if (name === 'Package.swift' || name.endsWith('.xcodeproj')) {
      const text = isFile(file) ? readText(file) : readText(path.join(file, 'project.pbxproj'));
      const isMacos = text.includes('.macOS(') || text.includes('SDKROOT = macosx');
      findings.push([rel, `Swift (${isMacos ? 'macOS' : 'platform not detected'})`,
        isMacos ? ['code-conventions-swift-macos'] : []]);
    } else if (name.endsWith('.csproj') || name.endsWith('.sln')) {
      if (!unityRoots.has(pathKey(parent)) && !isDir(path.join(parent, 'ProjectSettings'))) {
        findings.push([rel, '.NET (C#)', ['code-conventions-csharp']]);
      }
    } else if (['pyproject.toml', 'requirements.txt', 'setup.py'].includes(name)) {
      findings.push([rel, 'Python', []]);
    } else if (name === 'go.mod') {
      findings.push([rel, 'Go', []]);
    } else if (name === 'Cargo.toml') {
      findings.push([rel, 'Rust', []]);
    } else if (name === 'Gemfile') {
      findings.push([rel, 'Ruby', []]);
    } else if (name === 'composer.json') {
      findings.push([rel, 'PHP', []]);
    } else if (name === 'pubspec.yaml') {
      findings.push([rel, 'Dart/Flutter', []]);
    }
    if (findings.length >= 25) {
      break;
    }
  }
  return findings;
}

function linkStatus(project, linkRel, want) {
  const file = path.join(project, linkRel);
  if (!lexists(file)) {
    return 'missing';
  }
  if (isLink(file)) {
    if (windowsCannotFollow(file)) {
      return UNFOLLOWABLE_LINK;
    }
    return pointsTo(file, path.join(project, want)) ? 'ok' : `points to ${fs.readlinkSync(file)}`;
  }
  if (isDir(file)) {
    return `real folder (${entriesText(visibleEntries(file).length)})`;
  }
  return 'real file';
}

function cmdInspect(project) {
  const [kind, count] = projectKind(project);
  print(`project      ${project}`);
  print(`kind         ${kind === 'new' ? 'new' : `existing (${count} top-level entries)`}`);
  const root = gitRoot(project);
  if (root === null) {
    const result = git(project, '--version');
    print(`git          ${result === null ? 'git not found' : 'not a repository'}`);
  } else {
    const status = git(project, 'status', '--porcelain');
    const changes = splitLines(status ? status.stdout : '').filter(Boolean).length;
    const where = pointsTo(root, project) ? '' : ` (root ${root})`;
    print(`git          repository${where}, ${changes === 0 ? 'clean' : plural(changes, 'uncommitted change')}`);
  }
  print(`setup        ${setupState(project)}`);
  const found = instructionsToConsolidate(project);
  print(`consolidate  ${found.length ? found.join(', ') : 'nothing'}`);
  for (const [linkRel, , want] of LINKS) {
    print(`link         ${linkRel.padEnd(15)} ${linkStatus(project, linkRel, want)}`);
  }
  const suggested = ['code-conventions', 'documentation-and-diagrams', 'stack'];
  const stack = detectStack(project);
  for (const [where, description, rules] of stack) {
    print(`stack        ${where}: ${description}${rules.length ? ` -> ${rules.join(', ')}` : ''}`);
    suggested.push(...rules.filter((rule) => !suggested.includes(rule)));
  }
  if (!stack.length) {
    print('stack        no signals');
  }
  print(`rules        fitting the stack: ${suggested.join(', ')}`);
  return 0;
}

// ---------------------------------------------------------------------------
// Planning

class Action {
  constructor(kind, relPath, detail = '', { source = null, target = null, want = null, entries = null } = {}) {
    this.kind = kind; // create, copy, link, adopt, append, same, keep, migrate, note, conflict
    this.path = relPath; // project-relative path
    this.detail = detail;
    this.source = source; // asset to copy, or the asset to diff a kept file against
    this.target = target; // link target as written
    this.want = want; // directory a link must resolve to
    this.entries = entries; // .gitignore entries to append
  }
}

const CHANGING = ['create', 'copy', 'link', 'adopt', 'append'];

function ignoreEntriesNeeded(project) {
  const patterns = new Set();
  for (const raw of splitLines(readText(path.join(project, '.gitignore')))) {
    const line = strip(raw);
    if (line && !line.startsWith('#')) {
      patterns.add(line.replace(/^\/+|\/+$/g, ''));
    }
  }
  const tracked = gitTracked(project, '.claude');
  const sharedClaudeFiles = tracked.filter(
    (file) => !LINKED_UNDER_CLAUDE.some((link) => file === link || file.startsWith(`${link}/`)),
  );
  const wanted = ['.clinerules', ...(sharedClaudeFiles.length ? LINKED_UNDER_CLAUDE : ['.claude'])];

  const covered = (entry) => {
    if (patterns.has(entry) || (entry.startsWith('.claude/') && patterns.has('.claude'))) {
      return true;
    }
    return gitRoot(project) !== null && gitIgnores(project, entry);
  };

  return wanted.filter((entry) => !covered(entry));
}

function keptDetail(rel, projectFile, asset) {
  if (rel === 'AGENTS.md') {
    if (hasPlaceholders(readText(projectFile))) {
      return 'the template from another version; the first pass fills it';
    }
    return 'project content: add the template sections it lacks (references/existing-projects.md)';
  }
  if (rel === 'README.md') {
    return "the project's own README";
  }
  return `differs from the bundled version, diff against ${asset}`;
}

function computePlan(project, rules, adopt) {
  const plan = [];
  const claimed = new Map(); // target dir -> Map(entry name -> source path) for planned adoptions
  const adoptedDirs = [];

  const claudeDir = path.join(project, '.claude');
  const claudeBlocked = lexists(claudeDir) && (isLink(claudeDir) || !isDir(claudeDir));

  for (const [linkRel, target, want] of LINKS) {
    const file = path.join(project, linkRel);
    if (linkRel.startsWith('.claude/') && claudeBlocked) {
      plan.push(new Action('conflict', linkRel, '.claude is a file or a link, not a folder'));
      continue;
    }
    if (!lexists(file)) {
      plan.push(new Action('link', linkRel, `-> ${target}`, { target, want }));
      continue;
    }
    if (isLink(file)) {
      if (windowsCannotFollow(file)) {
        plan.push(new Action('conflict', linkRel, `${UNFOLLOWABLE_LINK}: delete it with approval, then rerun`));
      } else if (pointsTo(file, path.join(project, want))) {
        plan.push(new Action('same', linkRel, `link -> ${target}`));
      } else {
        plan.push(new Action('conflict', linkRel, `links to ${fs.readlinkSync(file)}, expected ${target}`));
      }
      continue;
    }
    if (!isDir(file)) {
      plan.push(new Action('conflict', linkRel,
        'a file, not a link: move its content into AGENTS.md or .agents/rules/ '
        + '(references/existing-projects.md), then remove it with approval'));
      continue;
    }
    const entries = visibleEntries(file);
    const destination = path.join(project, want);
    if (!claimed.has(want)) {
      claimed.set(want, new Map());
    }
    const taken = claimed.get(want);
    const clashes = [];
    for (const entry of entries) {
      const name = path.basename(entry);
      const earlier = taken.has(name) ? taken.get(name) : null;
      for (const other of [path.join(destination, name), earlier]) {
        if (other === null || !lexists(other)) {
          continue;
        }
        const identical = isFile(entry) ? sameFile(entry, other) : isDir(other) && sameTree(entry, other);
        if (!identical) {
          clashes.push(name);
        }
      }
    }
    if (clashes.length) {
      plan.push(new Action('conflict', linkRel,
        `a real folder whose entries clash with ${want}/: ${sortedStrings(new Set(clashes)).join(', ')}`));
    } else if (adopt) {
      for (const entry of entries) {
        taken.set(path.basename(entry), entry);
      }
      adoptedDirs.push(file);
      plan.push(new Action('adopt', linkRel,
        `move its ${entriesText(entries.length)} into ${want}/, then link -> ${target}`, { target, want }));
    } else {
      plan.push(new Action('conflict', linkRel,
        `a real folder with ${entriesText(entries.length)}: move them into ${want}/ (--adopt, with approval) `
        + 'so the link can replace it'));
    }
  }

  // The file or folder an adoption brings to rel, if any.
  const adoptedSource = (rel) => {
    for (const [want, taken] of claimed) {
      const prefix = `${want}/`;
      if (rel.startsWith(prefix)) {
        const remainder = rel.slice(prefix.length);
        const slash = remainder.indexOf('/');
        const first = slash === -1 ? remainder : remainder.slice(0, slash);
        const rest = slash === -1 ? '' : remainder.slice(slash + 1);
        if (taken.has(first)) {
          return rest ? path.join(taken.get(first), rest) : taken.get(first);
        }
      }
    }
    return null;
  };

  for (const [asset, rel] of templateFiles(rules)) {
    const file = path.join(project, rel);
    const brought = adoptedSource(rel);
    if (brought !== null && lexists(brought)) {
      if (sameFile(brought, asset)) {
        plan.push(new Action('same', rel, 'comes with the adoption'));
      } else {
        plan.push(new Action('keep', rel, `comes with the adoption; ${keptDetail(rel, brought, asset)}`));
      }
      continue;
    }
    if (rel === 'CLAUDE.md' && isFile(file) && !sameFile(file, asset)) {
      if (importsOnlyAgentsMd(file)) {
        plan.push(new Action('same', rel, 'imports AGENTS.md'));
      } else {
        plan.push(new Action('migrate', rel,
          'has its own content: move it into AGENTS.md or .agents/rules/, then reduce it to the import'));
      }
      continue;
    }
    if (!lexists(file)) {
      plan.push(new Action('create', rel, '', { source: asset }));
    } else if (sameFile(file, asset)) {
      plan.push(new Action('same', rel));
    } else {
      plan.push(new Action('keep', rel, keptDetail(rel, file, asset), { source: asset }));
    }
  }

  const rulesDir = path.join(project, '.agents', 'rules');
  if (isDir(rulesDir)) {
    const bundled = new Set(bundledRules());
    const own = [];
    for (const rule of sortedPaths(globDir(rulesDir, markdownName))) {
      const name = path.basename(rule);
      if (rules.includes(stem(name))) {
        continue;
      }
      if (bundled.has(stem(name))) {
        plan.push(new Action('note', `.agents/rules/${name}`, 'bundled rule present but not selected',
          { source: path.join(ASSETS, 'rules', name) }));
      } else {
        own.push(name);
      }
    }
    if (own.length) {
      plan.push(new Action('note', '.agents/rules/', `project rule files not in the template: ${own.join(', ')}`));
    }
  }

  const ownCopy = path.join(project, '.agents', 'skills', SKILL_NAME);
  const skillRel = `.agents/skills/${SKILL_NAME}/`;
  if (pointsTo(SKILL_DIR, ownCopy)) {
    plan.push(new Action('same', skillRel, 'this skill, running from the project'));
  } else if (adoptedDirs.some((dir) => pointsTo(path.dirname(SKILL_DIR), dir))) {
    plan.push(new Action('same', skillRel, 'this skill, moved by the adoption above'));
  } else if (lexists(ownCopy)) {
    if (sameTree(SKILL_DIR, ownCopy, ['evals'])) {
      plan.push(new Action('same', skillRel, 'this skill'));
    } else {
      plan.push(new Action('keep', skillRel, 'another version of this skill: compare before replacing it'));
    }
  } else {
    plan.push(new Action('copy', skillRel, 'this skill'));
  }

  for (const rel of OTHER_INSTRUCTION_FILES) {
    if (lexists(path.join(project, rel))) {
      plan.push(new Action('migrate', rel, "another tool's instructions (references/existing-projects.md)"));
    }
  }

  if (!exists(path.join(project, '.gitignore'))) {
    plan.push(new Action('create', '.gitignore', '', { source: path.join(ASSETS, GITIGNORE_ASSET) }));
  } else {
    const needed = ignoreEntriesNeeded(project);
    if (needed.length) {
      plan.push(new Action('append', '.gitignore', `+ ${needed.join(', ')}`, { entries: needed }));
    } else {
      plan.push(new Action('same', '.gitignore', 'discovery links already ignored'));
    }
  }
  return plan;
}

const ORDER = ['adopt', 'create', 'copy', 'link', 'append', 'same', 'keep', 'migrate', 'note', 'conflict'];

function printPlan(plan, heading) {
  print(heading);
  for (const action of [...plan].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))) {
    print(`  ${action.kind.padEnd(9)} ${action.path}${action.detail ? `  (${action.detail})` : ''}`);
  }
  const counts = new Map();
  for (const action of plan) {
    counts.set(action.kind, (counts.get(action.kind) || 0) + 1);
  }
  print(`summary: ${ORDER.filter((kind) => counts.has(kind)).map((kind) => `${counts.get(kind)} ${kind}`).join(', ')}`);
}

// ---------------------------------------------------------------------------
// Applying

function makeLink(file, target) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    // The platform's separator: Windows cannot follow a symlink whose target uses "/".
    fs.symlinkSync(target.split('/').join(path.sep), file, 'dir');
    return 'symlink';
  } catch (error) {
    if (!IS_WINDOWS) {
      throw error;
    }
    // Directory junctions need no symlink privilege on Windows.
    fs.symlinkSync(realpath(path.resolve(path.dirname(file), target)), file, 'junction');
    return 'junction';
  }
}

// shutil.copytree(symlinks=False): links are followed and what they point to is copied.
function copyTree(source, destination, ignore) {
  const names = fs.readdirSync(source);
  const ignored = new Set(ignore(source, names));
  fs.mkdirSync(destination, { recursive: true });
  for (const name of names) {
    if (ignored.has(name)) {
      continue;
    }
    const from = path.join(source, name);
    const to = path.join(destination, name);
    if (fs.statSync(from).isDirectory()) {
      copyTree(from, to, ignore);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

function copySkill(destination) {
  copyTree(SKILL_DIR, destination, (directory, names) => {
    const top = pathKey(realpath(directory)) === pathKey(SKILL_DIR);
    return names.filter((name) => skippedName(name) || (top && name === 'evals'));
  });
}

// shutil.rmtree, which refuses a link.
function removeTree(directory) {
  if (isLink(directory)) {
    throw new Error(`Cannot call rmtree on a symbolic link: ${directory}`);
  }
  fs.rmSync(directory, { recursive: true });
}

// shutil.move to a path that does not exist yet.
function move(source, destination) {
  try {
    fs.renameSync(source, destination);
    return;
  } catch (error) {
    if (error.code !== 'EXDEV') {
      throw error;
    }
  }
  if (isLink(source)) {
    fs.symlinkSync(fs.readlinkSync(source), destination);
    fs.unlinkSync(source);
  } else if (isDir(source)) {
    copyTree(source, destination, () => []);
    removeTree(source);
  } else {
    fs.copyFileSync(source, destination);
    fs.unlinkSync(source);
  }
}

// Set when an adoption moves the folder this skill runs from.
let movedSkillDir = null;

// Asset path after an adoption moved this skill; unchanged otherwise.
function relocated(file) {
  if (movedSkillDir === null) {
    return file;
  }
  const rel = path.relative(SKILL_DIR, file);
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    return file;
  }
  return path.join(movedSkillDir, rel);
}

function execute(project, action) {
  const file = path.join(project, action.path);
  if (action.kind === 'create') {
    if (lexists(file)) {
      return 'kept: appeared during apply';
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.copyFileSync(relocated(action.source), file);
    return 'created';
  }
  if (action.kind === 'copy') {
    if (lexists(file)) {
      return 'kept: appeared during apply';
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    copySkill(file);
    return 'copied';
  }
  if (action.kind === 'adopt') {
    const destination = path.join(project, action.want);
    fs.mkdirSync(destination, { recursive: true });
    const movesThisSkill = pointsTo(path.dirname(SKILL_DIR), file);
    for (const entry of visibleEntries(file)) {
      const existing = path.join(destination, path.basename(entry));
      if (lexists(existing)) {
        const identical = isFile(entry) ? sameFile(entry, existing) : sameTree(entry, existing);
        if (!identical) {
          return `stopped: ${path.basename(entry)} clashes with ${existing}`;
        }
        if (isDir(entry)) {
          removeTree(entry);
        } else {
          fs.unlinkSync(entry);
        }
      } else {
        move(entry, existing);
      }
    }
    for (const leftover of fs.readdirSync(file)) { // only cache files remain
      const cache = path.join(file, leftover);
      if (isDir(cache)) {
        removeTree(cache);
      } else {
        fs.unlinkSync(cache);
      }
    }
    fs.rmdirSync(file);
    if (movesThisSkill && movedSkillDir === null) {
      movedSkillDir = path.join(destination, SKILL_NAME);
    }
    return `adopted, ${makeLink(file, action.target)} created`;
  }
  if (action.kind === 'link') {
    if (lexists(file)) {
      return 'kept: appeared during apply';
    }
    fs.mkdirSync(path.join(project, action.want), { recursive: true });
    return `${makeLink(file, action.target)} created`;
  }
  if (action.kind === 'append') {
    const text = readText(file);
    const block = `${text.endsWith('\n') || !text ? '' : '\n'}\n# Agents\n${action.entries.join('\n')}\n`;
    fs.appendFileSync(file, nativeNewlines(block), 'utf8');
    return 'appended';
  }
  return '';
}

function cmdPlan(project, rules, adopt) {
  printPlan(computePlan(project, rules, adopt), `plan for ${project} (nothing changed)`);
  return 0;
}

function cmdApply(project, rules, adopt) {
  const plan = computePlan(project, rules, adopt);
  print(`apply to ${project}`);
  for (const kind of ['adopt', 'create', 'copy', 'link', 'append']) {
    for (const action of plan.filter((item) => item.kind === kind)) {
      const outcome = execute(project, action);
      print(`  ${kind.padEnd(9)} ${action.path}  ${outcome}`);
    }
  }
  const rest = plan.filter((action) => !CHANGING.includes(action.kind));
  if (rest.length) {
    printPlan(rest, 'unchanged and open items:');
  }
  return plan.some((action) => action.kind === 'conflict') ? 1 : 0;
}

function cmdLinks(project) {
  const missingDirs = LINKS.map(([, , want]) => want).filter((want) => !isDir(path.join(project, want)));
  if (missingDirs.length) {
    print(`missing ${sortedStrings(new Set(missingDirs)).join(', ')}: run apply first`);
    return 1;
  }
  let problems = 0;
  for (const [linkRel, target, want] of LINKS) {
    const status = linkStatus(project, linkRel, want);
    if (status === 'missing') {
      print(`  ${linkRel.padEnd(15)} ${makeLink(path.join(project, linkRel), target)} created`);
    } else if (status === 'ok') {
      print(`  ${linkRel.padEnd(15)} ok`);
    } else {
      problems += 1;
      const fix = status === UNFOLLOWABLE_LINK
        ? 'delete it with approval, then rerun links'
        : 'resolve it by hand (references/existing-projects.md)';
      print(`  ${linkRel.padEnd(15)} ${status}: ${fix}`);
    }
  }
  return problems ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Maintaining the bundled template

// [template file, asset] pairs that make up the bundled template.
function syncPairs(root) {
  const pairs = ROOT_FILES.map(([asset, target]) => [path.join(root, target), path.join(ASSETS, asset)]);
  pairs.push([path.join(root, '.gitignore'), path.join(ASSETS, GITIGNORE_ASSET)]);
  for (const rule of sortedPaths(globDir(path.join(root, '.agents', 'rules'), markdownName))) {
    pairs.push([rule, path.join(ASSETS, 'rules', path.basename(rule))]);
  }
  const skills = path.join(root, '.agents', 'skills');
  if (isDir(skills)) {
    const others = fs.readdirSync(skills).map((name) => path.join(skills, name))
      .filter((skill) => isDir(skill) && path.basename(skill) !== SKILL_NAME);
    for (const skill of sortedPaths(others)) {
      for (const [rel, source] of [...treeFiles(skill)].sort((a, b) => compareStrings(a[0], b[0]))) {
        const parts = rel.split('/');
        if (parts[parts.length - 1] === 'SKILL.md') {
          parts[parts.length - 1] = SKILL_FILE_ASSET;
        }
        pairs.push([source, path.join(ASSETS, 'skills', path.basename(skill), ...parts)]);
      }
    }
  }
  return pairs;
}

function cmdSyncAssets(root, check, force) {
  const agents = path.join(root, 'AGENTS.md');
  if (!force && !(isFile(agents) && hasPlaceholders(readText(agents)))) {
    print(`${root} does not look like the template repository (its AGENTS.md has no placeholders). `
      + 'Use --force to sync anyway.');
    return 1;
  }
  const pairs = syncPairs(root);
  const wanted = new Set(pairs.map(([, asset]) => pathKey(realpath(asset))));
  const stale = [...treeFiles(ASSETS).values()].filter((file) => !wanted.has(pathKey(realpath(file))));
  let drift = 0;
  for (const [source, asset] of pairs) {
    if (!exists(source)) {
      drift += 1;
      print(`  ${'missing'.padEnd(8)} ${source} (template file not found)`);
      continue;
    }
    if (sameFile(source, asset)) {
      continue;
    }
    drift += 1;
    print(`  ${(exists(asset) ? 'differs' : 'missing').padEnd(8)} ${path.relative(SKILL_DIR, asset)}`);
    if (!check) {
      fs.mkdirSync(path.dirname(asset), { recursive: true });
      fs.copyFileSync(source, asset);
    }
  }
  for (const file of stale) {
    drift += 1;
    print(`  ${'stale'.padEnd(8)} ${path.relative(SKILL_DIR, file)}`);
    if (!check) {
      fs.unlinkSync(file);
    }
  }
  if (check) {
    print(drift === 0 ? 'in sync' : `${drift} file(s) out of sync`);
    return drift ? 1 : 0;
  }
  print(drift === 0 ? 'in sync' : `${drift} file(s) updated`);
  return 0;
}

// ---------------------------------------------------------------------------
// Command line, as argparse reads it

const COMMANDS = {
  inspect: { positional: 'project', options: [] },
  plan: { positional: 'project', options: ['--rules', '--adopt'] },
  apply: { positional: 'project', options: ['--rules', '--adopt'] },
  links: { positional: 'project', options: [] },
  'sync-assets': { positional: 'root', options: ['--check', '--force'] },
};

// An option as given, or the one option it abbreviates.
function resolveOption(given, known) {
  if (known.includes(given)) {
    return given;
  }
  const matches = given.startsWith('--') ? known.filter((option) => option.startsWith(given)) : [];
  if (matches.length === 1) {
    return matches[0];
  }
  if (matches.length > 1) {
    throw new UsageError(`ambiguous option: ${given} could match ${matches.join(', ')}`);
  }
  throw new UsageError(`unrecognized arguments: ${given}`);
}

function parseArgs(argv) {
  if (argv.length === 0) {
    return { help: true, code: 2 };
  }
  const [command, ...rest] = argv;
  if (command === '-h' || (command.startsWith('--') && resolveOption(command, ['--help']) === '--help')) {
    return { help: true, code: 0 };
  }
  const spec = Object.prototype.hasOwnProperty.call(COMMANDS, command) ? COMMANDS[command] : null;
  if (spec === null) {
    const choices = Object.keys(COMMANDS).map((name) => `'${name}'`).join(', ');
    throw new UsageError(`argument command: invalid choice: '${command}' (choose from ${choices})`);
  }
  const args = { command, rules: 'all', adopt: false, check: false, force: false };
  const positionals = [];
  let onlyPositionals = false;
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (onlyPositionals || token === '-' || !token.startsWith('-')) {
      positionals.push(token);
      continue;
    }
    if (token === '--') {
      onlyPositionals = true;
      continue;
    }
    if (token === '-h') {
      return { help: true, code: 0 };
    }
    const equals = token.indexOf('=');
    const given = equals === -1 ? token : token.slice(0, equals);
    const inline = equals === -1 ? null : token.slice(equals + 1);
    const option = resolveOption(given, [...spec.options, '--help']);
    if (option === '--help') {
      return { help: true, code: 0 };
    }
    if (option === '--rules') {
      if (inline !== null) {
        args.rules = inline;
      } else if (i + 1 < rest.length && !rest[i + 1].startsWith('-')) {
        i += 1;
        args.rules = rest[i];
      } else {
        throw new UsageError('argument --rules: expected one argument');
      }
    } else if (inline !== null) {
      throw new UsageError(`argument ${option}: ignored explicit argument '${inline}'`);
    } else {
      args[option.slice(2)] = true;
    }
  }
  if (positionals.length === 0) {
    throw new UsageError(`the following arguments are required: ${spec.positional}`);
  }
  if (positionals.length > 1) {
    throw new UsageError(`unrecognized arguments: ${positionals.slice(1).join(' ')}`);
  }
  args[spec.positional] = positionals[0];
  return args;
}

function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) {
      throw error;
    }
    printError(`usage: setup.mjs {${Object.keys(COMMANDS).join(',')}} ... (setup.mjs -h for help)`);
    printError(`setup.mjs: error: ${error.message}`);
    return 2;
  }
  if (args.help) {
    print(USAGE);
    return args.code;
  }

  if (args.command === 'sync-assets') {
    return cmdSyncAssets(realpath(args.root), args.check, args.force);
  }
  const project = realpath(args.project);
  if (!isDir(project)) {
    print(`${project} is not a directory; create the project folder first`);
    return 2;
  }
  if (args.command === 'inspect') {
    return cmdInspect(project);
  }
  if (args.command === 'links') {
    return cmdLinks(project);
  }
  let rules;
  try {
    rules = parseRules(args.rules);
  } catch (error) {
    if (!(error instanceof ExitError)) {
      throw error;
    }
    printError(error.message);
    return 1;
  }
  if (args.command === 'plan') {
    return cmdPlan(project, rules, args.adopt);
  }
  return cmdApply(project, rules, args.adopt);
}

process.exitCode = main(process.argv.slice(2));
