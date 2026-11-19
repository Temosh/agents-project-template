// Building blocks for setup.mjs and verify.mjs: Node.js versions of the Python standard-library
// behaviour that setup.py and verify.py rely on (path resolution, directory walks, sort order,
// text decoding, output), so both pairs of scripts print and do the same.
//
// Requires Node.js 18+, built-in modules only.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const IS_WINDOWS = process.platform === 'win32';

// Python writes "\n" as "\r\n" on Windows, to its output and to files opened as text.
const NEWLINE = IS_WINDOWS ? '\r\n' : '\n';

export function nativeNewlines(text) {
  return text.replace(/\n/g, NEWLINE);
}

export function print(text = '') {
  process.stdout.write(nativeNewlines(`${text}\n`));
}

export function printError(text) {
  process.stderr.write(nativeNewlines(`${text}\n`));
}

// ---------------------------------------------------------------------------
// Strings

// What str.isspace() accepts, which is also what \s matches in Python's re.
export const PY_SPACE = '\\t-\\r\\x1c-\\x20\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
const EDGE_SPACE = new RegExp(`^[${PY_SPACE}]+|[${PY_SPACE}]+$`, 'g');
const LINE_BREAK = new RegExp('\\r\\n|[\\n\\v\\f\\r\\x1c\\x1d\\x1e\\x85\\u2028\\u2029]');

// str.strip()
export function strip(text) {
  return text.replace(EDGE_SPACE, '');
}

// str.splitlines()
export function splitLines(text) {
  if (!text) {
    return [];
  }
  const lines = text.split(LINE_BREAK);
  if (lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}

// text[:count] counts code points, not UTF-16 units.
export function firstCodePoints(text, count) {
  return Array.from(text).slice(0, count).join('');
}

// Python orders strings by code point; JavaScript's < compares UTF-16 units.
export function compareStrings(a, b) {
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const x = a.codePointAt(i);
    const y = b.codePointAt(i);
    if (x !== y) {
      return x < y ? -1 : 1;
    }
    if (x > 0xffff) {
      i += 1;
    }
  }
  return a.length - b.length;
}

// Python sorts Path objects part by part, and without regard to case on Windows.
export function comparePaths(a, b) {
  const x = pathKey(a).split(path.sep);
  const y = pathKey(b).split(path.sep);
  for (let i = 0; i < Math.min(x.length, y.length); i += 1) {
    const order = compareStrings(x[i], y[i]);
    if (order !== 0) {
      return order;
    }
  }
  return x.length - y.length;
}

export function sortedStrings(items) {
  return [...items].sort(compareStrings);
}

export function sortedPaths(items) {
  return [...items].sort(comparePaths);
}

// The form in which Python compares two Path objects for equality.
export function pathKey(file) {
  return IS_WINDOWS ? file.toLowerCase() : file;
}

// ---------------------------------------------------------------------------
// Files

const UTF8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

// Path.read_text(encoding="utf-8"), with "" for a file that is unreadable or not UTF-8.
export function readText(file) {
  try {
    return UTF8.decode(fs.readFileSync(file)).replace(/\r\n?/g, '\n');
  } catch {
    return '';
  }
}

function statOf(file) {
  try {
    return fs.statSync(file);
  } catch {
    return null;
  }
}

function lstatOf(file) {
  try {
    return fs.lstatSync(file);
  } catch {
    return null;
  }
}

export function exists(file) {
  return statOf(file) !== null;
}

export function lexists(file) {
  return lstatOf(file) !== null;
}

export function isFile(file) {
  return statOf(file)?.isFile() ?? false;
}

export function isDir(file) {
  return statOf(file)?.isDirectory() ?? false;
}

// True for symlinks and, on Windows, directory junctions: Node reports both as links.
export function isLink(file) {
  return lstatOf(file)?.isSymbolicLink() ?? false;
}

// Path.relative_to(base).as_posix(), with "" for base itself.
export function relativePosix(base, file) {
  return path.relative(base, file).split(path.sep).join('/');
}

// Path.glob(pattern) for a pattern without "/": entries of any kind, hidden ones included,
// matched without regard to case on Windows. test receives the name to match.
export function globDir(directory, test) {
  let names;
  try {
    names = fs.readdirSync(directory);
  } catch {
    return [];
  }
  return names.filter((name) => test(IS_WINDOWS ? name.toLowerCase() : name)).map((name) => path.join(directory, name));
}

// Path.rglob(pattern): the directory and every directory below it, without entering links.
export function rglobDir(directory, test) {
  const found = [];
  const visit = (current) => {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const file = path.join(current, entry.name);
      if (test(IS_WINDOWS ? entry.name.toLowerCase() : entry.name)) {
        found.push(file);
      }
      if (entry.isDirectory()) {
        visit(file);
      }
    }
  };
  visit(directory);
  return found;
}

// os.walk(top): top-down steps of { dirpath, dirnames, filenames }. A caller prunes the walk by
// changing step.dirnames in place (keepDirs) before asking for the next step. Links to
// directories are listed among the directories but not entered. Names come in directory
// order; the callers sort them, as the Python scripts do.
export function* walk(top) {
  let entries;
  try {
    entries = fs.readdirSync(top, { withFileTypes: true });
  } catch {
    return;
  }
  const dirnames = [];
  const filenames = [];
  for (const entry of entries) {
    const isDirectory = entry.isSymbolicLink() ? isDir(path.join(top, entry.name)) : entry.isDirectory();
    (isDirectory ? dirnames : filenames).push(entry.name);
  }
  const step = { dirpath: top, dirnames, filenames };
  yield step;
  for (const name of step.dirnames) {
    const child = path.join(top, name);
    if (!isLink(child)) {
      yield* walk(child);
    }
  }
}

// dirnames[:] = names
export function keepDirs(step, names) {
  step.dirnames.splice(0, step.dirnames.length, ...names);
}

// ---------------------------------------------------------------------------
// Path resolution

// os.path.realpath() and Path.resolve(): every link in an existing part resolved, missing
// parts kept as written, relative paths taken from the current directory. Never fails.
export function realpath(file) {
  return IS_WINDOWS ? windowsRealpath(file) : posixRealpath(file);
}

function posixRealpath(file) {
  const absolute = file.startsWith('/') ? file : `${process.cwd()}/${file}`;
  return path.posix.resolve(joinRealpath('', absolute, new Map())[0]);
}

// posixpath._joinrealpath: resolves links before applying a later "..", as the OS does.
function joinRealpath(start, remaining, seen) {
  let current = start;
  let rest = remaining;
  if (rest.startsWith('/')) {
    rest = rest.slice(1);
    current = '/';
  }
  while (rest) {
    const slash = rest.indexOf('/');
    const name = slash === -1 ? rest : rest.slice(0, slash);
    rest = slash === -1 ? '' : rest.slice(slash + 1);
    if (!name || name === '.') {
      continue;
    }
    if (name === '..') {
      if (current) {
        const [head, tail] = posixSplit(current);
        current = tail === '..' ? posixJoin(head, '..', '..') : head;
      } else {
        current = '..';
      }
      continue;
    }
    const next = posixJoin(current, name);
    if (!isLink(next)) {
      current = next;
      continue;
    }
    if (seen.has(next)) {
      const cached = seen.get(next);
      if (cached !== null) {
        current = cached;
        continue;
      }
      return [posixJoin(next, rest), false]; // A link loop: the rest stays unresolved.
    }
    seen.set(next, null);
    const [resolved, ok] = joinRealpath(current, fs.readlinkSync(next), seen);
    if (!ok) {
      return [posixJoin(resolved, rest), false];
    }
    seen.set(next, resolved);
    current = resolved;
  }
  return [current, true];
}

// posixpath.split
function posixSplit(file) {
  const cut = file.lastIndexOf('/') + 1;
  let head = file.slice(0, cut);
  if (head && head !== '/'.repeat(head.length)) {
    head = head.replace(/\/+$/, '');
  }
  return [head, file.slice(cut)];
}

// posixpath.join
function posixJoin(first, ...parts) {
  let joined = first;
  for (const part of parts) {
    if (part.startsWith('/')) {
      joined = part;
    } else if (!joined || joined.endsWith('/')) {
      joined += part;
    } else {
      joined += `/${part}`;
    }
  }
  return joined;
}

// ntpath.realpath: the final path of the longest part Windows can open, links it cannot
// follow read by hand, and the rest joined on.
function windowsRealpath(file) {
  let current = path.resolve(file);
  let tail = '';
  for (;;) {
    try {
      const real = fs.realpathSync.native(current);
      return tail ? path.join(real, tail) : real;
    } catch {
      const followed = readlinkDeep(current);
      if (followed !== current) {
        return tail ? path.join(followed, tail) : followed;
      }
      const parent = path.dirname(current);
      if (parent === current) {
        return tail ? path.join(current, tail) : current;
      }
      tail = tail ? path.join(path.basename(current), tail) : path.basename(current);
      current = parent;
    }
  }
}

function readlinkDeep(file) {
  const seen = new Set();
  let current = file;
  while (!seen.has(current.toLowerCase())) {
    seen.add(current.toLowerCase());
    let target;
    try {
      target = fs.readlinkSync(current);
    } catch {
      break;
    }
    current = path.resolve(path.dirname(current), target);
  }
  return current;
}

// ---------------------------------------------------------------------------
// Helpers both Python scripts define

// subprocess.run(text=True) of git: None when git is missing, newlines as "\n". Git writes
// UTF-8 on every platform.
export function git(project, ...args) {
  const result = spawnSync('git', ['-C', project, ...args], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) {
    return null;
  }
  const text = (value) => (value || '').replace(/\r\n?/g, '\n');
  return { returncode: result.status, stdout: text(result.stdout), stderr: text(result.stderr) };
}

// True for a Windows symlink whose target uses "/". Windows does not resolve it, though
// realpath() does, so a realpath comparison alone would accept the link. Node writes "\"
// itself; older versions of setup.py wrote "/".
export function windowsCannotFollow(file) {
  if (!IS_WINDOWS || !isLink(file)) {
    return false;
  }
  try {
    return fs.readlinkSync(file).includes('/');
  } catch {
    return false;
  }
}
