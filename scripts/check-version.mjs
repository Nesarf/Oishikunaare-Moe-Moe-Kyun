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

const zhPath = path.join(ROOT, 'README.zh-CN.md');
const zh = fs.existsSync(zhPath) ? fs.readFileSync(zhPath, 'utf8') : '';
// The localized README documents the deployment arrangement, not each release, so the invariant
// here is single-source rather than textual: the version lives in package.json, the changelog
// names it, and the Chinese README only has to avoid claiming a different one.
// A version-shaped match must not be part of an IP or a longer dotted run: 127.0.0.1 in a proxy
// example is not a claim about this package. Escaped dot, so it matches the literal character.
const VERSION_SHAPE = /(?<![\d.])([0-9]+\.[0-9]+\.[0-9]+)(?![\d.])/g;
const staleClaims = [...zh.matchAll(VERSION_SHAPE)].map((m) => m[1]).filter((v) => v !== pkg.version);
if (staleClaims.length > 0) problems.push(`README.zh-CN.md claims version ${staleClaims.join(', ')} but package.json says ${pkg.version}`);

if (problems.length > 0) {
  console.error(`check-version: ${problems.length} problem(s)`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`check-version: package.json ${pkg.version}, CHANGELOG.md ${changelog ?? "missing"}, README.zh-CN.md claims no other version`);
