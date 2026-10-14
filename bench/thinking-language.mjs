#!/usr/bin/env node
/**
 * Measure the language an agent actually thinks in.
 *
 * The thinking-language rule (0.9.9) is prose in a prompt, and prose is not evidence. This bench reads
 * real transcripts, pulls the reasoning channel out of every message the model authored, and reports
 * the character mix: Han, kana, Latin, everything else. A reply is not counted - the rule is about
 * thinking, and the two channels can disagree.
 *
 *   node bench/thinking-language.mjs [--root <sessions dir>] [--since <ISO>] [--until <ISO>] [--json]
 *
 * Two numbers are worth watching after a rule change: the Latin share of the reasoning channel (it
 * should fall) and the number of sessions where Latin dominates (it should stop growing).
 *
 * Reads only. The transcripts are this machine's own session artifacts, so the path is a flag: a
 * checkout on another machine points it at whatever transcripts it has.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTranscript } from '../src/transcripts.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index === -1 || argv[index + 1] === undefined ? fallback : argv[index + 1];
};
const ROOT = flag('root', process.env.DSH_SESSIONS_ROOT ?? 'E:/dsh-home/sessions');
const SINCE = flag('since', null);
const UNTIL = flag('until', null);
const AS_JSON = argv.includes('--json');

/** Character classes as the rule's own coordinates name them. */
function classify(text) {
  let han = 0;
  let kana = 0;
  let latin = 0;
  let other = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if ((cp >= 0x3040 && cp <= 0x30ff) || (cp >= 0x31f0 && cp <= 0x31ff)) kana++;
    else if (cp >= 0x3400 && cp <= 0x9fff) han++;
    else if ((cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a) || (cp >= 0xc0 && cp <= 0x24f)) latin++;
    else if (cp > 0x7f) other++;
  }
  return { han, kana, latin, other };
}

const reasoningOf = (message) => (Array.isArray(message?.content) ? message.content : [])
  .filter((block) => block && (block.type === 'reasoning' || block.type === 'thinking') && typeof block.text === 'string')
  .map((block) => block.text)
  .join('\n');

const walk = (dir, out = []) => {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name === 'session.v4.jsonl.zstd') out.push(full);
  }
  return out;
};

const files = walk(ROOT);
const inWindow = (time) => {
  if (time === null) return true;
  const iso = new Date(time).toISOString();
  if (SINCE !== null && iso < SINCE) return false;
  if (UNTIL !== null && iso > UNTIL) return false;
  return true;
};

const total = { han: 0, kana: 0, latin: 0, other: 0 };
const perFile = [];
let read = 0;
let failed = 0;
let authored = 0;
let withReasoning = 0;

for (const file of files) {
  let messages;
  try {
    messages = readTranscript(file, 'dsh').messages;
  } catch {
    failed += 1;
    continue;
  }
  read += 1;
  const here = { han: 0, kana: 0, latin: 0, other: 0 };
  let replies = 0;
  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    authored += 1;
    if (!inWindow(message.time ?? null)) continue;
    const reasoning = reasoningOf(message);
    if (reasoning === '') continue;
    withReasoning += 1;
    replies += 1;
    const counts = classify(reasoning);
    for (const key of Object.keys(here)) here[key] += counts[key];
  }
  for (const key of Object.keys(total)) total[key] += here[key];
  const cjk = here.han + here.kana;
  const letters = cjk + here.latin;
  if (letters > 0 && here.latin > cjk) perFile.push({ file: path.basename(path.dirname(file)), latin: here.latin, cjk, share: here.latin / letters });
}

const sum = (o) => o.han + o.kana + o.latin + o.other;
const share = (part, whole) => (whole === 0 ? 0 : part / whole);
const all = sum(total);
const letters = total.han + total.kana + total.latin;
const report = {
  root: ROOT,
  window: { since: SINCE, until: UNTIL },
  sessions: { found: files.length, read, failed },
  messages: { authored, withReasoning },
  characters: { ...total, total: all },
  share: {
    han: share(total.han, letters),
    kana: share(total.kana, letters),
    latin: share(total.latin, letters),
    cjk: share(total.han + total.kana, letters),
  },
  latinDominant: perFile.sort((a, b) => b.share - a.share).slice(0, 10),
};

if (AS_JSON) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  const pct = (value) => `${(value * 100).toFixed(1)}%`;
  console.log(`root: ${ROOT}${SINCE === null && UNTIL === null ? '' : ` (window ${SINCE ?? '-'} .. ${UNTIL ?? '-'})`}`);
  console.log(`${read}/${files.length} session(s) read, ${authored} authored message(s), ${withReasoning} with a reasoning channel`);
  console.log(`characters: han ${total.han}, kana ${total.kana}, latin ${total.latin}, other ${total.other}`);
  console.log(`share of letters: CJK ${pct(report.share.cjk)} (han ${pct(report.share.han)}, kana ${pct(report.share.kana)}), latin ${pct(report.share.latin)}`);
  console.log(`sessions where latin dominates the reasoning channel: ${perFile.length}`);
  for (const entry of report.latinDominant.slice(0, 5)) {
    console.log(`  ${entry.share.toFixed(2)} latin  ${entry.latin} vs ${entry.cjk} CJK  ${entry.file}`);
  }
}
