#!/usr/bin/env node
/**
 * Version sync check: the package version, the newest CHANGELOG entry and the newest README.zh-CN.md
 * entry must agree. A published plugin whose changelog lags its version is how a release becomes a
 * rumour, so the invariant is enforced in CI rather than remembered.
 *
 * Usage: node scripts/check-version.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const problems = [];

/** Newest version heading in a changelog, e.g. "## 0.1.0 - 2026-10-12". */
function newestChangelogVersion(file) {
  if (!fs.existsSync(file)) return null;
  const match = fs.readFileSync(file, 'utf8').match(/^##\s+([0-9]+\.[0-9]+\.[0-9]+)/m);
  return match ? match[1] : null;
}

const changelog = newestChangelogVersion(path.join(ROOT, 'CHANGELOG.md'));
if (changelog === null) problems.push('CHANGELOG.md: no version heading found');
else if (changelog !== pkg.version) problems.push(`CHANGELOG.md newest entry ${changelog} does not match package.json ${pkg.version}`);

const zh = fs.existsSync(path.join(ROOT, 'README.zh-CN.md'))
  ? fs.readFileSync(path.join(ROOT, 'README.zh-CN.md'), 'utf8')
  : '';
if (!zh.includes(pkg.version)) problems.push(`README.zh-CN.md does not mention version ${pkg.version}`);

if (problems.length > 0) {
  console.error(`check-version: ${problems.length} problem(s)`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`check-version: package.json, CHANGELOG.md and README.zh-CN.md all say ${pkg.version}`);
