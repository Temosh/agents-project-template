#!/usr/bin/env node
// Runs the Python and Node.js versions of setup and verify on the same sample projects and
// compares what they print, their exit codes, and the files they leave behind.
//
//   node evals/parity.mjs [--keep]
//
// For maintainers of this skill: needs Python 3.8+ (python3, python, or the PYTHON variable),
// Node.js 18+, and git. --keep leaves the sample projects, as the Node.js run left them, in the
// temporary folder. This folder is not copied into projects.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = path.dirname(path.dirname(fs.realpathSync(fileURLToPath(import.meta.url))));
const SKILL_NAME = path.basename(SKILL_DIR);
const TEMPLATE_ROOT = path.resolve(SKILL_DIR, '..', '..', '..');
const IN_TEMPLATE = fs.existsSync(path.join(TEMPLATE_ROOT, 'AGENTS.md'))
  && fs.readFileSync(path.join(TEMPLATE_ROOT, 'AGENTS.md'), 'utf8').includes('Placeholder:')
  && fs.existsSync(path.join(TEMPLATE_ROOT, '.agents', 'skills', SKILL_NAME));

const PROJECT = '<project>'; // stands for the sample project's path in step arguments
const LINKS = [['.claude/rules', '../.agents/rules'], ['.claude/skills', '../.agents/skills'], ['.clinerules', './.agents/rules']];
const BOX = String.fromCodePoint(0x250c, 0x2500, 0x2510);
const BOM = String.fromCodePoint(0xfeff);

// ---------------------------------------------------------------------------
// Building sample projects

function at(root, rel) {
  return path.join(root, ...rel.split('/'));
}

function write(root, rel, content) {
  fs.mkdirSync(path.dirname(at(root, rel)), { recursive: true });
  fs.writeFileSync(at(root, rel), content);
}

function asset(rel) {
  return fs.readFileSync(at(path.join(SKILL_DIR, 'assets'), rel), 'utf8');
}

function dirLink(root, rel, target) {
  const file = at(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (process.platform === 'win32') {
    fs.symlinkSync(path.resolve(path.dirname(file), target), file, 'junction');
  } else {
    fs.symlinkSync(target, file);
  }
}

function isCache(name) {
  return name === '__pycache__' || name === '.DS_Store' || name.endsWith('.pyc');
}

function copyTree(source, destination, skip) {
  fs.mkdirSync(destination, { recursive: true });
  for (const name of fs.readdirSync(source)) {
    if (isCache(name) || skip(name, source)) {
      continue;
    }
    const from = path.join(source, name);
    const to = path.join(destination, name);
    if (fs.statSync(from).isDirectory()) {
      copyTree(from, to, skip);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

// The skill as a user would copy it: without evals/ and caches.
function copySkill(root, rel) {
  copyTree(SKILL_DIR, at(root, rel), (name, directory) => directory === SKILL_DIR && name === 'evals');
}

function gitIn(root, ...args) {
  const result = spawnSync('git', [
    '-C', root, '-c', 'init.defaultBranch=main', '-c', 'user.name=parity', '-c', 'user.email=parity@example.invalid',
    '-c', 'commit.gpgsign=false', ...args,
  ], { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed in ${root}: ${result.error || result.stderr}`);
  }
}

// ---------------------------------------------------------------------------
// Scenarios

const setup = (...args) => ({ script: 'setup', args });
const verify = (...args) => ({ script: 'verify', args });
const usage = (step) => ({ ...step, usage: true }); // help and argument errors: compare exit codes only
const from = (skill, step) => ({ ...step, from: skill }); // run the copy of the skill inside the project
const act = (change) => ({ act: change });

const INITIALIZED_AGENTS = `# AGENTS.md

Shop backend: orders and payments. Install with the <Product> CLI.

## Commands

\`\`\`bash
npm test
\`\`\`

See \`docs/architecture.md\`, \`docs/api.md\`, \`docs/\`, \`.agents/tasks/<task-name>/TASK.md\`,
\`docs/adr/README.md\`, and \`.agents/rules/*.md\`.

## Rule Index

| File | Purpose |
|------|---------|
| \`.agents/rules/code-conventions.md\` | Code |
| \`.agents/rules/stack.md\` | Stack |
| \`.agents/rules/gone.md\` | Removed |

## Skill Index

| Skill | Purpose |
|-------|---------|
| \`.agents/skills/project-initialization/SKILL.md\` | First pass |
| \`.agents/skills/missing-skill/SKILL.md\` | Gone |
`;

const SCENARIOS = [
  {
    name: 'new empty project',
    build: (p) => gitIn(p, 'init', '-q'),
    steps: [
      setup('inspect', PROJECT),
      setup('plan', PROJECT),
      setup('apply', PROJECT),
      setup('inspect', PROJECT),
      verify(PROJECT),
      setup('apply', PROJECT),
      act((p) => LINKS.forEach(([rel]) => fs.rmSync(at(p, rel)))), // as after a fresh clone
      setup('links', 'project'),
      verify(PROJECT),
      setup('plan', PROJECT, '--rules', 'none'),
    ],
  },
  {
    name: "existing project with other tools' instructions",
    build: (p) => {
      gitIn(p, 'init', '-q');
      write(p, '.gitignore', 'node_modules/');
      write(p, 'CLAUDE.md', '# Notes\n\nUse pnpm, never npm.\n');
      write(p, '.cursor/rules/style.mdc', '---\nglobs: "*.ts"\n---\nPrefer named exports.\n');
      write(p, '.github/copilot-instructions.md', 'Write tests first.\n');
      write(p, 'GEMINI.md', 'Be brief.\n');
      write(p, 'package.json', JSON.stringify({
        dependencies: { react: '18.3.1', vite: '5.4.0' }, devDependencies: { typescript: '5.6.3' },
      }));
      write(p, 'tsconfig.json', '{}\n');
      write(p, 'src/main.tsx', 'export {};\n');
      write(p, '.claude/settings.json', '{}\n');
      gitIn(p, 'add', '.claude/settings.json');
    },
    steps: [
      setup('inspect', PROJECT),
      setup('plan', PROJECT),
      setup('plan', PROJECT, '--rul', 'code-conventions, code-conventions-typescript.md,stack', '--ad'),
      setup('apply', PROJECT, '--rules=code-conventions,code-conventions-typescript,stack'),
      setup('inspect', PROJECT),
      verify(PROJECT),
      setup('plan', PROJECT, '--rules', 'none'),
    ],
  },
  {
    name: 'skill copied into .claude/skills and run from there',
    build: (p) => {
      gitIn(p, 'init', '-q');
      copySkill(p, `.claude/skills/${SKILL_NAME}`);
      write(p, '.claude/skills/deploy/SKILL.md', '---\nname: deploy\ndescription: Deploys.\n---\nRun make deploy.\n');
      write(p, '.claude/rules/team.md', '# Team\n\nReview every pull request.\n');
      write(p, 'README.md', '# Shop\n');
      write(p, 'requirements.txt', 'flask\n');
      write(p, 'app/main.py', 'print("hi")\n');
      gitIn(p, 'add', '-A');
      gitIn(p, 'commit', '-q', '--no-verify', '-m', 'sample');
    },
    steps: [
      from(`.claude/skills/${SKILL_NAME}`, setup('inspect', PROJECT)),
      from(`.claude/skills/${SKILL_NAME}`, setup('plan', PROJECT)),
      from(`.claude/skills/${SKILL_NAME}`, setup('plan', PROJECT, '--adopt')),
      from(`.claude/skills/${SKILL_NAME}`, setup('apply', PROJECT, '--adopt')),
      from(`.agents/skills/${SKILL_NAME}`, setup('links', PROJECT)),
      from(`.agents/skills/${SKILL_NAME}`, setup('inspect', PROJECT)),
      from(`.agents/skills/${SKILL_NAME}`, setup('plan', PROJECT, '--rules', 'none')),
      verify(PROJECT),
    ],
  },
  {
    name: 'conflicting folders and links',
    build: (p) => {
      gitIn(p, 'init', '-q');
      write(p, '.clinerules', 'Always write tests.\n');
      write(p, 'elsewhere/rules/old.md', '# Old\n');
      dirLink(p, '.claude/rules', '../elsewhere/rules');
      write(p, '.claude/skills/review/SKILL.md', '---\nname: review\n---\nVersion A.\n');
      write(p, '.agents/skills/review/SKILL.md', '---\nname: review\n---\nVersion B.\n');
    },
    steps: [
      setup('inspect', PROJECT),
      setup('plan', PROJECT),
      setup('plan', PROJECT, '--adopt'),
      setup('apply', PROJECT, '--adopt'),
      setup('links', PROJECT),
      verify(PROJECT),
    ],
  },
  {
    name: 'template files from another version',
    build: (p) => {
      write(p, 'AGENTS.md', `${asset('AGENTS.template.md')}\n<!-- an older copy -->\n`);
      write(p, 'CLAUDE.md', '@AGENTS.md\n');
      for (const name of fs.readdirSync(path.join(SKILL_DIR, 'assets', 'rules'))) {
        write(p, `.agents/rules/${name}`, asset(`rules/${name}`));
      }
      write(p, '.agents/rules/stack.md', `${asset('rules/stack.md')}\nUse pnpm.\n`);
      write(p, '.agents/rules/team-rules.md', '# Team rules\n');
      copySkill(p, `.agents/skills/${SKILL_NAME}`);
      write(p, `.agents/skills/${SKILL_NAME}/NOTES.md`, 'Local notes.\n');
    },
    steps: [
      setup('inspect', PROJECT),
      setup('plan', PROJECT),
      setup('plan', PROJECT, '--rules', 'none'),
      setup('apply', PROJECT, '--rules', 'stack'),
      verify(PROJECT),
    ],
  },
  {
    name: 'initialized project',
    build: (p) => {
      gitIn(p, 'init', '-q');
      write(p, 'AGENTS.md', INITIALIZED_AGENTS);
      write(p, 'CLAUDE.md', `${BOM}@AGENTS.md\n`);
      write(p, 'README.md', '# Agents Project Template\n\nShop backend.\n');
      write(p, '.gitignore', 'node_modules/\n');
      write(p, '.agents/rules/code-conventions.md', asset('rules/code-conventions.md'));
      write(p, '.agents/rules/stack.md', asset('rules/stack.md'));
      write(p, '.agents/rules/extra.md', '# Extra\n');
      write(p, '.agents/skills/project-initialization/SKILL.md', asset('skills/project-initialization/SKILL.template.md'));
      copySkill(p, `.agents/skills/${SKILL_NAME}`);
      write(p, '.agents/tasks/fix-login/TASK.md', '---\ntitle: Fix login\n---\nSee .agents/tasks/fix-login/notes.md\n');
      write(p, 'docs/architecture.md', `# Architecture\n\n${`${BOX}\n`.repeat(7)}See \`.agents/tasks/fix-login/TASK.md\`.\n`);
      write(p, 'docs/a-b.md', 'Placeholder: first\n');
      write(p, 'docs/a/x.md', 'Placeholder: second\n');
      write(p, 'docs/crlf.md', 'Placeholder: a Windows line\r\nnext\r\n');
      write(p, 'docs/latin1.md', Buffer.from('Placeholder: caf\xe9\n', 'latin1'));
      write(p, 'docs/adr/0001-use-postgres.md', '# 0001. Use Postgres\n');
      write(p, 'docs/adr/README.md', '# ADRs\n');
      write(p, 'notes/plan.md', 'Next: .agents/tasks/fix-login/TASK.md\n');
      LINKS.forEach(([rel, target]) => dirLink(p, rel, target));
      gitIn(p, 'add', '-f', '.clinerules');
    },
    steps: [
      setup('inspect', PROJECT),
      verify(PROJECT),
      setup('plan', PROJECT, '--rules', 'none'),
      setup('plan', PROJECT),
    ],
  },
  {
    name: 'stack signals',
    build: (p) => {
      write(p, 'game/ProjectSettings/ProjectVersion.txt', 'm_EditorVersion: 6000.0.23f1\nm_EditorVersionWithRevision: x\n');
      write(p, 'game/Packages/manifest.json', JSON.stringify({ dependencies: {
        'com.unity.render-pipelines.universal': '17.0.3', 'com.unity.inputsystem': '1.11.2', 'com.unity.xr.openxr': '1.13.0',
      } }));
      write(p, 'game/Assembly-CSharp.csproj', '<Project/>\n');
      write(p, 'service/pom.xml', '<project/>\n');
      write(p, 'service/src/main/java/App.java', 'class App {}\n');
      write(p, 'android/build.gradle.kts', '\n');
      write(p, 'android/app/src/main/kotlin/Main.kt', 'fun main() {}\n');
      write(p, 'empty-jvm/build.gradle', '\n');
      write(p, 'mac/Package.swift', 'platforms: [.macOS(.v14)]\n');
      write(p, 'ios/App.xcodeproj/project.pbxproj', 'SDKROOT = iphoneos;\n');
      write(p, 'desktop/Desk.xcodeproj/project.pbxproj', 'SDKROOT = macosx;\n');
      write(p, 'tools/Tool.csproj', '<Project/>\n');
      write(p, 'tools/Tools.sln', '\n');
      write(p, 'py/pyproject.toml', '[project]\n');
      write(p, 'go/go.mod', 'module x\n');
      write(p, 'rs/Cargo.toml', '[package]\n');
      write(p, 'rb/Gemfile', 'source "x"\n');
      write(p, 'php/composer.json', '{}\n');
      write(p, 'flutter/pubspec.yaml', 'name: x\n');
      write(p, 'web/package.json', JSON.stringify({ dependencies: { next: '15.0.0', react: '19.0.0', express: '4.0.0' } }));
      write(p, 'broken/package.json', '{ not json');
      write(p, 'nulls/package.json', '{"dependencies": null}');
      write(p, 'a/b/c/package.json', '{}'); // deepest level searched
      write(p, 'a/b/c/d/package.json', '{}'); // too deep
      write(p, 'node_modules/x/package.json', '{}');
      write(p, '.hidden/package.json', '{}');
      write(p, 'build/package.json', '{}');
      for (let i = 1; i <= 8; i += 1) {
        write(p, `more/m${i}/go.mod`, 'module m\n'); // past the 25 findings shown
      }
    },
    steps: [setup('inspect', PROJECT)],
  },
  {
    name: 'arguments and refusals',
    build: (p) => {
      write(p, 'AGENTS.md', '# A real project\n');
      write(p, '.claude', 'Not a folder.\n');
    },
    steps: [
      usage(setup()),
      usage(setup('-h')),
      usage(setup('nonsense', PROJECT)),
      usage(setup('plan')),
      usage(setup('plan', PROJECT, '--rules')),
      usage(setup('plan', PROJECT, '--bogus')),
      usage(setup('plan', PROJECT, 'extra')),
      usage(setup('inspect', PROJECT, '--adopt')),
      usage(verify()),
      usage(verify('-h')),
      setup('plan', PROJECT, '--rules', 'stack,nope'),
      setup('inspect', `${PROJECT}/missing`),
      setup('inspect', `${PROJECT}/AGENTS.md`),
      verify(`${PROJECT}/missing`),
      setup('sync-assets', PROJECT, '--check'),
      setup('links', PROJECT),
      setup('plan', PROJECT),
      setup('inspect', PROJECT),
      verify(PROJECT),
    ],
  },
  {
    name: 'sync-assets --check in the template repository',
    needsTemplate: true,
    project: TEMPLATE_ROOT, // read only: no sample project
    steps: [setup('sync-assets', PROJECT, '--check')],
  },
  {
    name: 'sync-assets in a copy of the template repository',
    needsTemplate: true,
    build: (p) => {
      for (const rel of ['AGENTS.md', 'CLAUDE.md', 'README.md', '.gitignore']) {
        fs.copyFileSync(at(TEMPLATE_ROOT, rel), at(p, rel));
      }
      copyTree(at(TEMPLATE_ROOT, '.agents/rules'), at(p, '.agents/rules'), () => false);
      copyTree(at(TEMPLATE_ROOT, '.agents/skills'), at(p, '.agents/skills'), () => false);
      write(p, '.agents/rules/stack.md', `${fs.readFileSync(at(p, '.agents/rules/stack.md'), 'utf8')}\nChanged.\n`);
      write(p, `.agents/skills/${SKILL_NAME}/assets/rules/retired.md`, '# Retired\n');
      fs.rmSync(at(p, `.agents/skills/${SKILL_NAME}/assets/README.template.md`));
    },
    steps: [
      from(`.agents/skills/${SKILL_NAME}`, setup('sync-assets', PROJECT, '--check')),
      from(`.agents/skills/${SKILL_NAME}`, setup('sync-assets', PROJECT)),
      from(`.agents/skills/${SKILL_NAME}`, setup('sync-assets', PROJECT, '--check')),
      from(`.agents/skills/${SKILL_NAME}`, setup('sync-assets', 'project', '--force', '--check')),
    ],
  },
];

// ---------------------------------------------------------------------------
// Running and comparing

function findPython() {
  const candidates = process.env.PYTHON ? [[process.env.PYTHON]] : [['python3'], ['python'], ['py', '-3']];
  for (const [command, ...args] of candidates) {
    const probe = spawnSync(command, [...args, '-c', 'import sys; print(sys.version_info >= (3, 8))'], { encoding: 'utf8' });
    if (!probe.error && probe.status === 0 && probe.stdout.trim() === 'True') {
      return [command, ...args];
    }
  }
  return null;
}

function snapshot(root) {
  const lines = [];
  const visit = (directory) => {
    for (const name of fs.readdirSync(directory).sort()) {
      const file = path.join(directory, name);
      const rel = path.relative(root, file).split(path.sep).join('/');
      if (rel === '.git') {
        continue;
      }
      const info = fs.lstatSync(file);
      if (info.isSymbolicLink()) {
        lines.push(`link ${rel} -> ${fs.readlinkSync(file)}`);
      } else if (info.isDirectory()) {
        lines.push(`dir  ${rel}`);
        visit(file);
      } else {
        lines.push(`file ${rel} ${createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16)}`);
      }
    }
  };
  visit(root);
  return lines;
}

function runScenario(scenario, runtime, root) {
  const project = scenario.project || path.join(root, 'project');
  if (!scenario.project) {
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(project, { recursive: true });
    scenario.build?.(project);
  }
  const steps = [];
  for (const step of scenario.steps) {
    if (step.act) {
      step.act(project);
      continue;
    }
    const skill = step.from ? at(project, step.from) : SKILL_DIR;
    const script = path.join(skill, 'scripts', `${step.script}${runtime.extension}`);
    const [command, ...prefix] = runtime.command;
    const result = spawnSync(command, [...prefix, script, ...step.args.map((arg) => arg.replace(PROJECT, project))], {
      cwd: scenario.project ? project : root,
      encoding: 'utf8',
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    });
    if (result.error) {
      throw result.error;
    }
    const neutral = (text) => text.replace(/setup\.mjs/g, 'setup.py').replace(/verify\.mjs/g, 'verify.py');
    steps.push({
      label: [step.from ? `(${step.from})` : '', step.script, ...step.args].filter(Boolean).join(' '),
      usage: Boolean(step.usage),
      exit: result.status,
      stdout: neutral(result.stdout),
      stderr: neutral(result.stderr),
    });
  }
  return { steps, files: scenario.project ? [] : snapshot(project) };
}

function firstDifference(label, a, b) {
  if (a === b) {
    return [];
  }
  const x = a.split('\n');
  const y = b.split('\n');
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) {
    i += 1;
  }
  const show = (lines) => JSON.stringify(i < lines.length ? lines[i] : '<end>');
  return [`${label}: line ${i + 1} differs\n      python: ${show(x)}\n      node:   ${show(y)}`];
}

function compareRuns(python, node) {
  const problems = [];
  python.steps.forEach((a, index) => {
    const b = node.steps[index];
    if (a.exit !== b.exit) {
      problems.push(`${a.label}: exit code ${a.exit} with Python, ${b.exit} with Node.js`);
    }
    if (!a.usage) {
      problems.push(...firstDifference(`${a.label}: stdout`, a.stdout, b.stdout));
      problems.push(...firstDifference(`${a.label}: stderr`, a.stderr, b.stderr));
    }
  });
  problems.push(...firstDifference('files left', python.files.join('\n'), node.files.join('\n')));
  return problems;
}

function main(argv) {
  const python = findPython();
  if (python === null) {
    console.error('parity: no Python 3.8+ found; set PYTHON to its path');
    return 2;
  }
  const runtimes = {
    python: { command: python, extension: '.py' },
    node: { command: [process.execPath], extension: '.mjs' },
  };
  const scenarios = SCENARIOS.filter((scenario) => !scenario.needsTemplate || IN_TEMPLATE);
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-setup-parity-'));
  let failures = 0;
  scenarios.forEach((scenario, index) => {
    const root = path.join(base, String(index + 1));
    const problems = compareRuns(runScenario(scenario, runtimes.python, root), runScenario(scenario, runtimes.node, root));
    const steps = scenario.steps.filter((step) => !step.act).length;
    console.log(`${problems.length ? 'DIFF' : 'ok  '}  ${scenario.name} (${steps} runs)`);
    problems.forEach((problem) => console.log(`    ${problem}`));
    failures += problems.length ? 1 : 0;
  });
  if (argv.includes('--keep')) {
    console.log(`sample projects kept in ${base}`);
  } else {
    fs.rmSync(base, { recursive: true, force: true });
  }
  if (!IN_TEMPLATE) {
    console.log('sync-assets scenarios skipped: the skill is not inside the template repository');
  }
  console.log(failures ? `${failures} of ${scenarios.length} scenarios differ` : `all ${scenarios.length} scenarios match`);
  return failures ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
