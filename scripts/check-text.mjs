#!/usr/bin/env node
/**
 * Report what the rules currently resolve to, and judge a piece of text against them.
 *
 * The rules are live data: a config file, a palette, two judges. Until now the only way to see what
 * they resolved to was to start a host and ask an agent, which is a lot of ceremony for "would this
 * sentence be refused?". This prints the resolved state and, given a string or stdin, the verdict.
 *
 * It reads the same files the plugin reads and calls the same judge, so a verdict here is the verdict
 * the hook would reach. It cannot see a running host's in-memory state - it reads the files on disk,
 * which is what a running host reads too on the next step.
 *
 * Usage:
 *   node scripts/check-text.mjs --status
 *   node scripts/check-text.mjs --text "the words to judge"
 *   echo "..." | node scripts/check-text.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const mod = await import(pathToFileURL(path.join(ROOT, 'lib', 'index.js')).href);
const SHIPPED = path.join(ROOT, 'rules', 'kaomoji.json');

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(name);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : undefined;
};

const home = process.env.DSH_HOME ?? mod.dshHome();
// Built from the resolved home rather than asking again: a home resolver that gets consulted twice can
// disagree with itself, and one of those answers was pointing the config lookup at the wrong directory.
const configFile = flag('--config') ?? path.join(home, 'agent-house-rules.json');
const config = fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, 'utf8')) : {};

/** Resolve the rules the way the plugin does, including the judge. */
function resolve() {
  const libraryFiles = mod.libraryPaths(config.kaomojiLibrary, SHIPPED);
  const resolveRules = mod.makeRulesResolver({
    file: configFile,
    libraryFiles,
    shippedLibrary: SHIPPED,
    warn: (message) => console.error(`warning: ${message}`),
  });
  return resolveRules();
}

const built = resolve();
const status = () => {
  console.log(`config:        ${configFile}${fs.existsSync(configFile) ? '' : ' (absent, packaged defaults)'}`);
  console.log(`enabled:       ${built.enabled}`);
  console.log(`locale:        ${built.locale}   sources: ${built.sources.join(' > ')}`);
  console.log(`rules:         ${built.text.length} characters`);
  console.log(`palette:       ${built.library} faces from ${mod.libraryPaths(config.kaomojiLibrary, SHIPPED).length} file(s)`);
  console.log(`judge:         ${built.judge.mode === 'allow' ? 'allow-list' : 'deny-list'} judge`);
  if (built.judge.mode === 'allow') console.log(`               seeded with ${built.judge.derived.size} code points from the rules and the palette`);
  else console.log(`               ban list: ${built.judge.exclusion === '' ? '(empty - every named glyph was excused)' : built.judge.exclusion}`);
  if (built.judge.mode === 'allow' && built.leak.length > 0) {
    console.log(`               WARNING: the rules themselves use refused code points: ${built.leak.join(', ')}`);
  }
  console.log(`self-check:    ${config.selfCheck === false ? 'off' : `on, ${config.selfCheckMax ?? 3} symbol notice(s), ${config.kaomojiCheck === false ? 'kaomoji check off' : `${config.kaomojiCheckMax ?? 1} kaomoji reminder(s)`}`}`);
  console.log(`kaomoji floor: one per ${config.kaomojiFloor ?? 5} prose sentences`);
};

const text = flag('--text') ?? (args.includes('--status') || process.stdin.isTTY ? undefined : fs.readFileSync(0, 'utf8'));

if (text === undefined) {
  status();
  process.exit(0);
}

const glyphs = mod.judgeText(text, built.judge);
const verdict = mod.judgeKaomoji(text);
console.log(`text:          ${text.length} characters`);
console.log(`judge:         ${glyphs.length === 0 ? 'passes' : 'refused: ' + glyphs.join(', ')}`);
console.log(`kaomoji:       ${verdict.sentences} prose sentence(s), ${verdict.faces} face(s), needs ${verdict.needed} -> ${verdict.meets ? 'meets the floor' : 'below the floor'}`);
if (verdict.repeated.length > 0) console.log(`               repeats a face back to back: ${verdict.repeated.join(' ')}`);
if (args.includes('--status')) status();
process.exit(glyphs.length === 0 ? 0 : 1);
