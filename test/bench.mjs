#!/usr/bin/env node
/**
 * Measure the thinking channel against the house rules.
 *
 * `bench/thinking-language.mjs` answers which language the model thinks in; this one answers whether
 * the thinking looks like thinking at all. It reads real session artifacts through the same reader
 * the judges use (`readTranscript(file, 'dsh')`), takes the reasoning channel of every assistant
 * message, and reports over that channel only:
 *
 *   blocks              how many reasoning blocks were read
 *   chars / avgChars    their size
 *   withSymbols         blocks carrying a banned judgement glyph, and their share
 *   glyphsPerKilo       how dense that is per thousand characters
 *   withTicks           blocks whose bare-command lines reach the habit floor, and their share
 *
 * The point is to judge a rule change by a number: run it before the change and after it, on the same
 * window, and compare. Reads only; writes nothing.
 *
 *   node test/bench.mjs
 *   node test/bench.mjs --root "E:/dsh-home/sessions" --limit 200 --json
 */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';
import { readTranscript } from '../src/transcripts.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const mod = await import(pathToFileURL(path.join(ROOT, 'lib', 'index.js')).href);

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index === -1 || argv[index + 1] === undefined ? fallback : argv[index + 1];
};
const SESSIONS = flag('root', process.env.DSH_SESSIONS_ROOT ?? 'E:/dsh-home/sessions');
const LIMIT = Number(flag('limit', '40'));
const AS_JSON = argv.includes('--json');
const TICK_FLOOR = 3;

/** Every session log below one directory. */
function collect(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, out);
    else if (entry.name === 'session.v4.jsonl.zstd') out.push(full);
  }
  return out;
}

/** The reasoning text of one message, whatever the block type calls it. */
function reasoningOf(message) {
  if (!message || !Array.isArray(message.content)) return '';
  const parts = [];
  for (const block of message.content) {
    if (!block || typeof block !== 'object') continue;
    if (block.type !== 'thinking' && block.type !== 'reasoning') continue;
    if (typeof block.text === 'string') parts.push(block.text);
    else if (typeof block.content === 'string') parts.push(block.content);
  }
  return parts.join('\n');
}

const files = collect(SESSIONS)
  .map((file) => {
    try {
      return { file, size: fs.statSync(file).size };
    } catch {
      return { file, size: 0 };
    }
  })
  .sort((left, right) => right.size - left.size)
  .slice(0, LIMIT)
  .map((entry) => entry.file);

const stats = { blocks: 0, chars: 0, withSymbols: 0, glyphHits: 0, withTicks: 0 };
let read = 0;
let failed = 0;

for (const file of files) {
  let messages;
  try {
    messages = readTranscript(file, 'dsh').messages;
  } catch {
    failed += 1;
    continue;
  }
  read += 1;
  for (const message of messages) {
    if (message?.role !== 'assistant') continue;
    const text = reasoningOf(message);
    if (text === '') continue;
    stats.blocks += 1;
    stats.chars += text.length;
    const glyphs = mod.judgeAuthoredText(text);
    if (glyphs.length > 0) {
      stats.withSymbols += 1;
      stats.glyphHits += glyphs.length;
    }
    if (mod.countTicksWithoutQuotes(text) >= TICK_FLOOR) stats.withTicks += 1;
  }
}

const share = (part, whole) => (whole === 0 ? 0 : part / whole);
const report = {
  root: SESSIONS,
  sessions: { found: files.length, read, failed },
  blocks: stats.blocks,
  characters: stats.chars,
  avgChars: stats.blocks === 0 ? 0 : Math.round(stats.chars / stats.blocks),
  symbols: {
    blocks: stats.withSymbols,
    share: Number(share(stats.withSymbols, stats.blocks).toFixed(4)),
    glyphs: stats.glyphHits,
    perKilo: stats.chars === 0 ? 0 : Number(((stats.glyphHits * 1000) / stats.chars).toFixed(2)),
  },
  ticks: {
    floor: TICK_FLOOR,
    blocks: stats.withTicks,
    share: Number(share(stats.withTicks, stats.blocks).toFixed(4)),
  },
};

if (AS_JSON) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  const pct = (value) => `${(value * 100).toFixed(1)}%`;
  process.stdout.write([
    `root: ${report.root}`,
    `${read}/${report.sessions.found} session(s) read, ${failed} unreadable`,
    `reasoning blocks: ${report.blocks}, average ${report.avgChars} chars`,
    `blocks with a banned glyph: ${report.symbols.blocks} (${pct(report.symbols.share)}), ${report.symbols.perKilo} per 1k chars`,
    `blocks at the bare-command floor (${TICK_FLOOR}): ${report.ticks.blocks} (${pct(report.ticks.share)})`,
    '',
  ].join('\n'));
}
