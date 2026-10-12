#!/usr/bin/env node
/**
 * Regenerate rules/<locale>.json from the packaged rule constants in src/index.js.
 *
 * Those two files are the shipped locales in data form. They are generated from the same source as the
 * constants rather than maintained beside them, because two hand-kept copies of one decision drift:
 * the plugin reads the constants, so a data file that quietly disagrees is a bug waiting for someone to
 * read the wrong one.
 *
 * Usage:
 *   node scripts/gen-rules-json.mjs           write rules/en.json and rules/zh.json
 *   node scripts/gen-rules-json.mjs --check   fail when either file is not what the source produces
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packagedRules } from '../src/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const RULES = path.join(ROOT, 'rules');

const DESCRIPTION = {
  en: 'English rule text (shipped default). Replaceable by the user at runtime.',
  zh: 'Chinese rule text. Replaceable by the user at runtime.',
};

const locales = Object.keys(DESCRIPTION);
const checkMode = process.argv.includes('--check');
const drift = [];

for (const locale of locales) {
  const file = path.join(RULES, `${locale}.json`);
  const chosen = packagedRules(locale);
  if (chosen.locale !== locale) {
    console.error(`gen-rules-json: src/index.js does not carry a packaged table for "${locale}"`);
    process.exit(1);
  }
  const wanted = JSON.stringify({
    locale,
    description: DESCRIPTION[locale],
    bannedSymbols: chosen.rules.bannedSymbols,
    kaomoji: chosen.rules.kaomoji,
  }, null, 2) + '\n';
  if (checkMode) {
    const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (current !== wanted) drift.push(file);
    continue;
  }
  fs.writeFileSync(file, wanted, 'utf8');
  console.log(`wrote rules/${locale}.json (${wanted.length} bytes)`);
}

if (checkMode) {
  if (drift.length > 0) {
    for (const file of drift) console.error(`gen-rules-json: ${file} is out of date`);
    console.error('run: node scripts/gen-rules-json.mjs');
    process.exit(1);
  }
  console.log(`gen-rules-json: in sync (${locales.join(', ')})`);
}
