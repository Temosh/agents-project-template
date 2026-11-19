#!/usr/bin/env node
// verify.py for machines with Node.js instead of Python: the same checks, report, and exit
// codes. Change both together, then run evals/parity.mjs.

import fs from 'node:fs';
import path from 'node:path';

import {
  PY_SPACE,
  exists,
  firstCodePoints,
  git,
  globDir,
  isDir,
  isFile,
  isLink,
  keepDirs,
  lexists,
  print,
  readText,
  realpath,
  relativePosix,
  rglobDir,
  sortedPaths,
  sortedStrings,
  splitLines,
  strip,
  walk,
  windowsCannotFollow,
} from './python-compat.mjs';

const USAGE = `Check a project's agent setup, typically after its first pass.

  verify.mjs <project>

Errors (exit 1): AGENTS.md missing, CLAUDE.md not importing it, discovery links missing or
pointing elsewhere, Windows symlinks with / in the target, Rule Index or Skill Index out of
step with the files, links from outside .agents/tasks/ into a task note.

Warnings: template placeholders left, paths in AGENTS.md that do not exist, skills missing
from the Skill Index, discovery links git does not ignore, box-drawing characters in the
agent Markdown (the template's diagram rule asks for Mermaid instead).

Requires Node.js 18+, built-in modules only. verify.py does the same with Python.
`;

const LINKS = [
  ['.claude/rules', '.agents/rules'],
  ['.claude/skills', '.agents/skills'],
  ['.clinerules', '.agents/rules'],
];

const TEMPLATE_LEFTOVERS = [
  'Placeholder:',
  '<package-manager>',
  '<Product>',
  '<PRODUCT>',
  'This is a template stub',
  'reusable project template',
  '# Agents Project Template',
];

const BOX_DRAWING = new RegExp('[\\u2500-\\u257f]');
const TASK_LINK = new RegExp(`\\.agents/tasks/([A-Za-z0-9][^${PY_SPACE}\`)\\]>"']*)`, 'g');
const AGENTS_PATH = new RegExp(`\`((?:\\.agents|docs)/[^\`${PY_SPACE}]*)\``, 'g');
const RULE_ENTRY = /`\.agents\/rules\/([^`/]+\.md)`/g;
const SKILL_ENTRY = /`\.agents\/skills\/([^`/]+)\/SKILL\.md`/g;
const ADR_NAME = /^[0-9]{4}-[\s\S]*\.md$/;

const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'Library', 'Temp', 'Obj', 'Logs', 'build', 'Build', 'Builds', 'dist',
  'out', 'target', '.venv', 'venv', 'Pods', 'DerivedData', '.gradle', '__pycache__', '.next',
  'coverage', '.build', '.idea', '.vscode',
]);

class Report {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.infos = [];
  }

  error(message) {
    this.errors.push(message);
  }

  warn(message) {
    this.warnings.push(message);
  }

  info(message) {
    this.infos.push(message);
  }
}

function markdownName(name) {
  return name.endsWith('.md');
}

// Lines of the '## title' section, up to the next level-2 heading; null when it is missing.
function section(text, title) {
  const lines = [];
  let inside = false;
  for (const line of splitLines(text)) {
    if (line.startsWith('## ')) {
      if (inside) {
        break;
      }
      inside = strip(line.slice(3)) === title;
      continue;
    }
    if (inside) {
      lines.push(line);
    }
  }
  return inside || lines.length ? lines.join('\n') : null;
}

// The Markdown files this setup owns: entry points, rules, and docs.
function agentMarkdown(project) {
  const files = ['AGENTS.md', 'CLAUDE.md', 'README.md'].map((name) => path.join(project, name));
  files.push(...sortedPaths(globDir(path.join(project, '.agents', 'rules'), markdownName)));
  const docs = path.join(project, 'docs');
  if (isDir(docs)) {
    files.push(...sortedPaths(rglobDir(docs, markdownName)));
  }
  return files.filter(isFile);
}

// Markdown files outside .agents/tasks/ and .agents/skills/.
function allMarkdown(project, limit = 5000) {
  const found = [];
  for (const step of walk(project)) {
    const rel = relativePosix(project, step.dirpath);
    keepDirs(step, sortedStrings(step.dirnames.filter(
      (d) => !SKIP_DIRS.has(d) && !['.agents/tasks', '.agents/skills'].includes(rel === '' ? d : `${rel}/${d}`),
    )));
    for (const name of sortedStrings(step.filenames)) {
      if (name.endsWith('.md')) {
        found.push(path.join(step.dirpath, name));
        if (found.length >= limit) {
          return found;
        }
      }
    }
  }
  return found;
}

function checkEntryPoints(project, report) {
  const agents = path.join(project, 'AGENTS.md');
  if (!isFile(agents)) {
    report.error('AGENTS.md is missing');
    return '';
  }
  const claude = path.join(project, 'CLAUDE.md');
  if (!isFile(claude)) {
    report.error('CLAUDE.md is missing; it should contain @AGENTS.md');
  } else if (!readText(claude).includes('@AGENTS.md') && !readText(claude).includes('@./AGENTS.md')) {
    report.error('CLAUDE.md does not import AGENTS.md (@AGENTS.md)');
  }
  return readText(agents);
}

function checkLinks(project, report) {
  const probe = git(project, 'rev-parse', '--git-dir');
  const isRepo = probe !== null && probe.returncode === 0;
  for (const [link, want] of LINKS) {
    const file = path.join(project, link);
    if (!lexists(file)) {
      report.error(`${link} is missing (setup.mjs links <project> creates it)`);
      continue;
    }
    if (!isLink(file)) {
      report.error(`${link} is a real ${isDir(file) ? 'folder' : 'file'}, not a link to ${want}`);
      continue;
    }
    if (windowsCannotFollow(file)) {
      report.error(`${link} is a symlink with / in its target, which Windows cannot follow: `
        + 'delete it with approval, then run setup.mjs links <project>');
      continue;
    }
    if (realpath(file) !== realpath(path.join(project, want))) {
      report.error(`${link} points to ${fs.readlinkSync(file)}, expected ${want}`);
      continue;
    }
    if (isRepo) {
      const ignored = git(project, 'check-ignore', '-q', '--no-index', '--', link);
      const tracked = git(project, 'ls-files', '--error-unmatch', '--', link);
      if (tracked !== null && tracked.returncode === 0) {
        report.info(`${link} is tracked by git`);
      } else if (ignored !== null && ignored.returncode !== 0) {
        report.warn(`${link} is not ignored by git`);
      }
    }
  }
}

function difference(a, b) {
  return sortedStrings([...a].filter((name) => !b.has(name)));
}

function captures(text, pattern) {
  return new Set([...text.matchAll(pattern)].map((match) => match[1]));
}

function checkRuleIndex(project, agentsText, report) {
  const rulesDir = path.join(project, '.agents', 'rules');
  const actual = new Set(isDir(rulesDir) ? globDir(rulesDir, markdownName).map((file) => path.basename(file)) : []);
  const body = section(agentsText, 'Rule Index');
  if (body === null) {
    report.error("AGENTS.md has no '## Rule Index' section");
    return;
  }
  const listed = captures(body, RULE_ENTRY);
  for (const name of difference(actual, listed)) {
    report.error(`rule file not in the Rule Index: .agents/rules/${name}`);
  }
  for (const name of difference(listed, actual)) {
    report.error(`Rule Index lists a missing file: .agents/rules/${name}`);
  }
}

function checkSkillIndex(project, agentsText, report) {
  const skillsDir = path.join(project, '.agents', 'skills');
  const skills = isDir(skillsDir)
    ? globDir(skillsDir, () => true).filter((dir) => isDir(dir) && exists(path.join(dir, 'SKILL.md')))
    : [];
  const actual = new Set(skills.map((dir) => path.basename(dir)));
  const body = section(agentsText, 'Skill Index');
  if (body === null) {
    report.error("AGENTS.md has no '## Skill Index' section");
    return;
  }
  const listed = captures(body, SKILL_ENTRY);
  for (const name of difference(listed, actual)) {
    report.error(`Skill Index lists a missing skill: .agents/skills/${name}/SKILL.md`);
  }
  for (const name of difference(actual, listed)) {
    report.warn(`skill not in the Skill Index: .agents/skills/${name}/SKILL.md`);
  }
}

function checkAgentsPaths(project, agentsText, report) {
  const seen = new Set();
  for (const match of agentsText.matchAll(AGENTS_PATH)) {
    const rel = match[1];
    if (seen.has(rel) || ['<', '*', 'NNNN', '...'].some((token) => rel.includes(token))) {
      continue;
    }
    seen.add(rel);
    // Task notes and ADRs appear when the first task or decision needs them.
    if (rel.startsWith('.agents/tasks') || rel.startsWith('docs/adr')) {
      continue;
    }
    if (!exists(path.join(project, rel.replace(/\/+$/, '')))) {
      report.warn(`AGENTS.md mentions ${rel}, which does not exist`);
    }
  }
}

function checkLeftovers(project, report) {
  for (const file of agentMarkdown(project)) {
    const rel = relativePosix(project, file);
    splitLines(readText(file)).forEach((line, index) => {
      if (TEMPLATE_LEFTOVERS.some((marker) => line.includes(marker))) {
        report.warn(`template text left in ${rel}:${index + 1}: ${firstCodePoints(strip(line), 100)}`);
      }
    });
  }
}

function checkBoxDrawing(project, report) {
  for (const file of agentMarkdown(project)) {
    const rel = relativePosix(project, file);
    const hits = [];
    splitLines(readText(file)).forEach((line, index) => {
      if (BOX_DRAWING.test(line)) {
        hits.push(index + 1);
      }
    });
    if (hits.length) {
      const shown = hits.slice(0, 5).join(', ') + (hits.length > 5 ? ' ...' : '');
      report.warn(`box-drawing characters in ${rel} (lines ${shown}); use Mermaid or plain lists`);
    }
  }
}

function checkTaskLinks(project, report) {
  for (const file of allMarkdown(project)) {
    const rel = relativePosix(project, file);
    splitLines(readText(file)).forEach((line, index) => {
      for (const match of line.matchAll(TASK_LINK)) {
        report.error(`${rel}:${index + 1} links into a task note: .agents/tasks/${match[1]}`);
      }
    });
  }
}

function checkRecords(project, report) {
  const adr = path.join(project, 'docs', 'adr');
  if (isDir(adr)) {
    const records = sortedStrings(globDir(adr, (name) => ADR_NAME.test(name)).map((file) => path.basename(file)));
    if (records.length) {
      report.info(`ADRs: ${records.join(', ')}`);
    }
  }
  const tasks = path.join(project, '.agents', 'tasks');
  if (isDir(tasks)) {
    const names = sortedStrings(fs.readdirSync(tasks).filter((name) => isDir(path.join(tasks, name))));
    if (names.length) {
      report.info(`task notes: ${names.join(', ')}`);
    }
  }
}

function main(argv) {
  if (argv.length !== 1 || argv[0] === '-h' || argv[0] === '--help') {
    print(USAGE);
    return 2;
  }
  const project = realpath(argv[0]);
  if (!isDir(project)) {
    print(`${project} is not a directory`);
    return 2;
  }
  const report = new Report();
  const agentsText = checkEntryPoints(project, report);
  checkLinks(project, report);
  if (agentsText) {
    checkRuleIndex(project, agentsText, report);
    checkSkillIndex(project, agentsText, report);
    checkAgentsPaths(project, agentsText, report);
  }
  checkLeftovers(project, report);
  checkBoxDrawing(project, report);
  checkTaskLinks(project, report);
  checkRecords(project, report);
  for (const [label, messages] of [['error', report.errors], ['warn', report.warnings], ['info', report.infos]]) {
    for (const message of messages) {
      print(`${label.padEnd(6)} ${message}`);
    }
  }
  print(`${report.errors.length} error(s), ${report.warnings.length} warning(s)`);
  return report.errors.length ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
