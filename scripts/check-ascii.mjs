#!/usr/bin/env node
/**
 * Repository invariant: the source and every shipped document are ASCII-only, with exactly two
 * documented exceptions:
 *
 *   1. `src/index.js`, and only inside its PACKAGED locale table, which holds the localized rule
 *      text as `\uXXXX` escapes. Those sequences are ASCII; the rule is that the region may hold
 *      escaped non-ASCII, while the rest of the file may not. This is what lets a bilingual rule
 *      ship from an ASCII source tree - the same idea as mega-index-map's sensitive-pattern
 *      exception, applied to prompt copy instead of a regex.
 *   2. `rules/*.json` and `README.zh-CN.md`, the localized content and the one localized document:
 *      prose in Chinese is the point of those files.
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
function escapeRegion() {
  const lines = fs.readFileSync(ESCAPE_REGION_FILE, 'utf8').split('\n');
  const start = lines.findIndex((l) => l.includes('const PACKAGED = {'));
  const end = lines.findIndex((l, i) => i > start && /^};/.test(l));
  return start < 0 || end < 0 ? null : { start: start + 1, end: end + 1 };
}

const region = escapeRegion();
const isNonAscii = (ch) => ch.codePointAt(0) > 0x7f;
const describe = (ch) => `"${ch}" U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;

/** Collect the offending characters of one file, with the file-relative reason. */
function scanFile(file) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (rel === 'README.zh-CN.md' || rel.startsWith('rules/')) return [];
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const findings = [];
  lines.forEach((line, index) => {
    const inRegion = rel === 'src/index.js' && region && index + 1 >= region.start && index + 1 <= region.end;
    for (const ch of line) {
      if (!isNonAscii(ch)) continue;
      if (inRegion) continue;
      findings.push(`${rel}:${index + 1} ${describe(ch)}`);
    }
  });
  return findings;
}

/** Walk the repository, skipping VCS and installed trees. */
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
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
console.log('check-ascii: clean (exceptions: src PACKAGED table escapes, rules/*.json, README.zh-CN.md)');
