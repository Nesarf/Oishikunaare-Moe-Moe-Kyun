#!/usr/bin/env node
/**
 * Repository invariant: the portable half stays portable.
 *
 * What ties a package like this to one harness is never the idea, it is three imports and a hook name.
 * The judges, the rule text, the palette and the voice tables are data plus pure functions, so the
 * checks here are about keeping them that way:
 *
 *   1. `src/*.mjs`, `bin/*.mjs` and `adapters/*.mjs` import node builtins and relative files only. A
 *      host SDK import is how a portable tool quietly becomes one harness's plugin.
 *   2. The harness-free core (`src/portable.mjs`, `src/transcripts.mjs`) and the CLI
 *      (`bin/mmk.mjs`) name no host hook, no host context object and no host package. `src/index.js`
 *      is the DSH adapter and is exempt on purpose: it is the file that is allowed to know.
 *   3. The CLI still answers: `--version` prints a version, `--help` exits 0, a clean text exits 0 and
 *      a text carrying a banned code point exits 3. A boundary that is not exercised is a comment.
 *
 * Usage: node scripts/check-portable.mjs     (exit 1 on any violation)
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[^;\n]*?from\s+['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const BARE_OK = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);

/** Files where a host name must not appear at all, because they are the harness-free half. */
const HARNESS_FREE = ['src/portable.mjs', 'src/transcripts.mjs', 'bin/mmk.mjs'];
const HOST_MARKERS = [
  { marker: '@deepseek-ai', why: 'a harness package' },
  { marker: 'agent/pre-step', why: 'a harness hook' },
  { marker: 'agent/created', why: 'a harness hook' },
  { marker: 'agent/turn-stopping', why: 'a harness hook' },
  { marker: 'system-prompt/assemble', why: 'a harness hook' },
  { marker: 'cordis', why: 'the DSH plugin framework' },
  { marker: 'ctx.', why: 'a host context object' },
];

const findings = [];
/** Strip comments before the import scan: a JSDoc `import('cordis').Context` is a type, not a coupling. */
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\n)\s*\/\/[^\n]*/g, '$1');
const specifiersOf = (source) => {
  const found = [];
  for (const re of [IMPORT_RE, DYNAMIC_IMPORT_RE]) {
    re.lastIndex = 0;
    let match = re.exec(source);
    while (match !== null) {
      found.push(match[1]);
      match = re.exec(source);
    }
  }
  return found;
};

const collect = (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collect(full);
    return entry.name.endsWith('.mjs') || entry.name.endsWith('.js') ? [full] : [];
  });
};

const targets = [...collect(path.join(ROOT, 'src')), ...collect(path.join(ROOT, 'bin')), ...collect(path.join(ROOT, 'adapters'))];
for (const file of targets) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const source = fs.readFileSync(file, 'utf8');
  for (const specifier of specifiersOf(stripComments(source))) {
    const bare = !specifier.startsWith('.') && !specifier.startsWith('/');
    if (bare && !BARE_OK.has(specifier)) findings.push(`${rel}: imports "${specifier}", which is not a node builtin and not a relative file`);
  }
  if (!HARNESS_FREE.includes(rel)) continue;
  for (const { marker, why } of HOST_MARKERS) {
    if (!source.includes(marker)) continue;
    const line = source.slice(0, source.indexOf(marker)).split('\n').length;
    findings.push(`${rel}:${line} names "${marker}" (${why}); this file has to stay harness free`);
  }
}

/** The CLI has to answer, not merely exist. */
function cli(args, input) {
  return spawnSync(process.execPath, [path.join(ROOT, 'bin', 'mmk.mjs'), ...args], { encoding: 'utf8', input });
}
const version = cli(['--version']);
if (version.status !== 0 || !/^[0-9]+\.[0-9]+\.[0-9]+$/.test(version.stdout.trim())) {
  findings.push(`bin/mmk.mjs --version exited ${version.status} with "${version.stdout.trim()}"`);
}
const help = cli(['--help']);
if (help.status !== 0 || !help.stdout.includes('usage: mmk')) findings.push(`bin/mmk.mjs --help exited ${help.status}`);
const clean = cli(['check', '--text', 'A single sentence with a face (^_^) in it.', '--quiet']);
if (clean.status !== 0) findings.push(`a clean text exited ${clean.status}, expected 0: ${clean.stderr.trim()}`);
const breach = cli(['check', '--text', `carrying ${String.fromCodePoint(0x2713)}`, '--json']);
if (breach.status !== 3) findings.push(`a text with a banned code point exited ${breach.status}, expected 3`);
else {
  let payload = null;
  try {
    payload = JSON.parse(breach.stdout);
  } catch {
    findings.push('bin/mmk.mjs check --json did not print JSON');
  }
  if (payload !== null && !(payload.glyphs ?? []).includes('U+2713')) findings.push('the JSON finding did not name U+2713');
}

if (findings.length > 0) {
  console.error(`check-portable: ${findings.length} violation(s)`);
  for (const finding of findings) console.error(`  ${finding}`);
  process.exit(1);
}
console.log(`check-portable: clean (${targets.length} module(s) inspected, ${HARNESS_FREE.length} harness-free file(s), CLI answers)`);
