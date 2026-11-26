#!/usr/bin/env node
/**
 * Hygiene: the text a host injects must not carry the builder's own leftovers.
 *
 * Three defects of one shape shipped this month. A backtick written as a quote put the concatenation
 * operator inside the English corpus brief. Three U+FFFD code points sat in the middle of a Japanese
 * word. The thinking-habit notice named the oldest block in the session instead of the newest. All
 * three were text that arrived with something extra or something wrong, and every one of them passed,
 * because each assertion asked whether the right text had arrived and none asked what else had.
 *
 * This walks what a host actually injects - the rule section and the palette block in every locale the
 * package ships, plus one notice of each kind - and refuses a fixed list of leftovers.
 *
 * The coverage assertion matters as much as the content one. `--locale` moves only the notice wording,
 * while the rule text follows the configuration file; the first version of this scan ran
 * `rules --locale en` and read the Chinese text three times, reporting three clean locales. A locale
 * therefore gets a configuration file of its own, and two locales producing byte-identical rules fail
 * the run rather than passing it.
 *
 * Usage: node test/hygiene.mjs
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const CLI = path.join(ROOT, 'bin', 'mmk.mjs');
const LOCALES = ['en', 'zh', 'ja'];

/** What must never reach a prompt: the builder's punctuation, and what a broken code point becomes. */
const LEFTOVERS = [
  { name: 'concatenation operator', re: /\+ '/ },
  { name: 'concatenation operator (double quote)', re: /\+ "/ },
  { name: 'unexpanded template placeholder', re: /\$\{/ },
  { name: 'undefined', re: /\bundefined\b/ },
  { name: 'NaN', re: /\bNaN\b/ },
  { name: 'object stringified', re: /\[object Object\]/ },
  { name: 'unreplaced upper-case placeholder', re: /\{[A-Z][A-Z_]{2,}\}/ },
  { name: 'replacement character', re: /\uFFFD/ },
  { name: 'trailing whitespace', re: /[ \t]+\n/ },
];

/** Run the CLI under the same interpreter that runs this file, never a bare "node". */
function run(args) {
  return execFileSync(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    // stderr carries the CLI's own notes ("rules text ships in zh"), which are not findings.
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

let failures = 0;
let passes = 0;
const cases = [];

function check(name, fn) {
  try {
    fn();
    passes += 1;
    console.log(`pass  ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL  ${name}\n      ${String(error.message).split('\n')[0]}`);
  }
  cases.push(name);
}

const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'mmk-hygiene-'));
const configFor = (locale) => {
  const file = path.join(workdir, `cfg-${locale}.json`);
  // Only the locale: everything else keeps its default, so the run measures shipped text rather than
  // one machine's preferences.
  fs.writeFileSync(file, JSON.stringify({ locale }, null, 2), 'utf8');
  return file;
};

const sizes = new Map();

try {
  for (const locale of LOCALES) {
    const config = configFor(locale);

    for (const [kind, args] of [
      ['rules', ['rules', '--config', config]],
      ['palette', ['lib', '--config', config]],
      ['notice: symbol', ['notice', '--kind', 'symbol', '--glyphs', 'U+2713,U+2714', '--locale', locale]],
      ['notice: emoji', ['notice', '--kind', 'emoji', '--glyphs', 'U+1F600', '--locale', locale]],
      ['notice: kaomoji', ['notice', '--kind', 'kaomoji', '--sentences', '40', '--faces', '2', '--locale', locale]],
    ]) {
      check(`${kind} (${locale}) carries no leftovers`, () => {
        const text = run(args);
        assert.ok(text.length > 0, 'the command produced nothing at all');
        sizes.set(`${kind} ${locale}`, text.length);
        for (const { name, re } of LEFTOVERS) {
          const match = re.exec(text);
          if (match === null) continue;
          const at = match.index;
          const context = text.slice(Math.max(0, at - 50), at + 50).replace(/\n/g, '\\n');
          assert.fail(`carried ${name} at offset ${at}: ...${context}...`);
        }
      });
    }
  }

  // Coverage, stated out loud. Without this a scan that read one locale five times reports five passes
  // and looks exactly like a scan that read five different texts.
  check('each locale produced its own rule text', () => {
    const byLocale = LOCALES.map((locale) => ({ locale, size: sizes.get(`rules ${locale}`) }));
    for (const entry of byLocale) assert.ok(entry.size > 0, `no rule text was read for ${entry.locale}`);
    const distinct = new Set(byLocale.map((entry) => entry.size));
    assert.equal(
      distinct.size,
      LOCALES.length,
      `expected ${LOCALES.length} distinct rule sizes, got ${byLocale.map((e) => `${e.locale}=${e.size}`).join(' ')}`,
    );
  });
} finally {
  fs.rmSync(workdir, { recursive: true, force: true });
}

console.log(`\n${failures === 0 ? `all hygiene checks pass (${passes})` : `${failures} hygiene check(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
