#!/usr/bin/env node
/**
 * Repository invariant: the source and every shipped document are ASCII-only, with exactly three
 * documented exceptions:
 *
 *   1. `src/index.js`, and only inside its PACKAGED locale table, which holds the localized rule
 *      text as `\uXXXX` escapes. Those sequences are ASCII; the rule is that the region may hold
 *      escaped non-ASCII, while the rest of the file may not. This is what lets a bilingual rule
 *      ship from an ASCII source tree - the same idea as mega-index-map's sensitive-pattern
 *      exception, applied to prompt copy instead of a regex.
 *   2. `rules/*.json` (including `rules/voices/*.json`) and `README.zh-CN.md`: the localized data layer
 *      prose in Chinese is the point of those files.
 *   3. `LICENSE` and `NOTICE`: the licence text is authoritative in Chinese, and NOTICE is the
 *      attribution it names. Both are the licensor's words, not this repository's prose.
 *
 * Anything else carrying a non-ASCII character fails the check. Rationale: an ASCII source tree
 * survives any encoding mishap on any machine, and localized copy is data that a user may replace.
 *
 * Usage: node scripts/check-ascii.mjs      (exit 1 on any other non-ASCII character)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SKIP_DIRS = new Set(['node_modules', '.git']);
const LOCALIZED_DOC = path.join(ROOT, 'README.zh-CN.md');
const ESCAPE_REGION_FILE = path.join(ROOT, 'src', 'index.js');

/** Line range of the PACKAGED locale table, the one region allowed to hold escape sequences. */
function escapeRegion(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const start = lines.findIndex((l) => l.includes('const PACKAGED = {'));
  const end = lines.findIndex((l, i) => i > start && /^};/.test(l));
  return start < 0 || end < 0 ? null : { start: start + 1, end: end + 1 };
}

const region = escapeRegion(ESCAPE_REGION_FILE);
// The generated artifact is the source verbatim behind a three-line banner (scripts/build.mjs), so the
// same table sits in it at a shifted line number. Giving it the same exception keeps the rule applied
// to the same text; without it every localized line would be reported twice, once per copy.
const BUILT_FILE = path.join(ROOT, 'lib', 'index.js');
const builtRegion = fs.existsSync(BUILT_FILE) ? escapeRegion(BUILT_FILE) : null;
const isNonAscii = (ch) => ch.codePointAt(0) > 0x7f;
const describe = (ch) => `"${ch}" U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;

/** Collect the offending characters of one file, with the file-relative reason. */
function scanFile(file) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  // rules/*.json is the localized data layer: the kaomoji palette and the voice tables are made of
  // non-ASCII on purpose, and a user is expected to edit or replace them.
  // The licence text and its NOTICE are the licensor's own words (Chinese is authoritative there), the
  // same category as the localized doc: data a user may read, keep or replace.
  if (rel === 'README.zh-CN.md' || rel === 'LICENSE' || rel === 'NOTICE' || rel.startsWith('rules/')) return [];
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const findings = [];
  lines.forEach((line, index) => {
    const fileRegion = rel === 'src/index.js' ? region : (rel === 'lib/index.js' ? builtRegion : null);
    const inRegion = fileRegion !== null && index + 1 >= fileRegion.start && index + 1 <= fileRegion.end;
    for (const ch of line) {
      if (!isNonAscii(ch)) continue;
      if (inRegion) continue;
      findings.push(`${rel}:${index + 1} ${describe(ch)}`);
    }
  });
  return findings;
}

/** Whether a file is binary, judged from a small prefix. Binary assets are not text, so the rule
 *  does not apply to them; the prefix read keeps a multi-megabyte image from being decoded as UTF-8. */
function isBinary(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(8192);
    const read = fs.readSync(fd, buf, 0, buf.length, 0);
    return buf.subarray(0, read).includes(0);
  } finally {
    fs.closeSync(fd);
  }
}

/** Walk the repository, skipping VCS and installed trees. */
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (!isBinary(full)) out.push(full);
  }
  return out;
}

const findings = walk(ROOT).filter((f) => f !== LOCALIZED_DOC).flatMap(scanFile);
if (region === null) findings.push('src/index.js: PACKAGED locale table not found, the ASCII exception cannot be scoped');

if (findings.length > 0) {
  console.error(`check-ascii: ${findings.length} non-ASCII character(s) outside the documented exceptions`);
  for (const f of findings.slice(0, 40)) console.error(`  ${f}`);
  if (findings.length > 40) console.error(`  ... and ${findings.length - 40} more`);
  process.exit(1);
}
console.log('check-ascii: clean (exceptions: src PACKAGED table escapes, rules/*.json, README.zh-CN.md, LICENSE + NOTICE)');
