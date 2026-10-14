#!/usr/bin/env node
/**
 * Audit a real transcript against the two rules.
 *
 * The self-check catches a breach while it is the newest thing in context. This answers the other
 * question - how the rules actually held up over a session - by measuring what was written.
 *
 * It reads a DSH session log: one zstd frame per record, each frame a JSON line, records shaped
 * `{ type, seq, time, data }` with assistant text under `data.message.content[]`. Frames that fail to
 * decode (a torn tail) are counted, never guessed.
 *
 * Reported per assistant message: sentence estimate, kaomoji count, code points the ban names, and
 * how many of those sat inside code or inline code (where the rule exempts them). The totals say
 * whether the kaomoji floor is being met and whether a banned glyph ever reached prose.
 *
 * Usage:
 *   node scripts/audit-session.mjs                       # newest session of this workspace
 *   node scripts/audit-session.mjs <session.jsonl.zstd>   # a specific one
 *   node scripts/audit-session.mjs --json                 # machine-readable
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const mod = await import(pathToFileURL(path.join(ROOT, 'lib', 'index.js')).href);
const SHIPPED = path.join(ROOT, 'rules', 'kaomoji.json');

/** Every judgement code point the current ban names, as numbers. */
const bannedCodes = new Set(
  mod.offendingGlyphs(
    // Feed each candidate so the ban reports which ones it covers, rather than restating the list here.
    [...Array(0x3000).keys()].map((cp) => String.fromCodePoint(cp)).join('')
    + [0x1f44d, 0x1f44e, 0x1f44c].map((cp) => String.fromCodePoint(cp)).join(''),
  ).map((cp) => Number.parseInt(cp.slice(2), 16)),
);

/** Sentence count comes from the plugin, so the audit and the hook cannot disagree. */
const sentenceCount = (text) => mod.proseSentences(mod.proseOnly(text));

/** Face detection comes from the plugin for the same reason. */
const kaomojiOf = (text) => mod.findKaomoji(mod.proseOnly(text));

/** Where the ban does not reach: fenced code and inline code. */
function exemptions(text) {
  const fenced = text.match(/```[\s\S]*?```/g) ?? [];
  const inline = text.match(/`[^`\n]*`/g) ?? [];
  return { fenced, inline };
}

/** Decode every frame of a session log into records. */
function readRecords(file) {
  const buf = fs.readFileSync(file);
  const offsets = [];
  for (let i = 0; i + 4 <= buf.length; i++) {
    if (buf[i] === 0x28 && buf[i + 1] === 0xb5 && buf[i + 2] === 0x2f && buf[i + 3] === 0xfd) offsets.push(i);
  }
  const records = [];
  let torn = 0;
  for (let k = 0; k < offsets.length; k++) {
    const start = offsets[k];
    const end = k + 1 < offsets.length ? offsets[k + 1] : buf.length;
    try {
      for (const line of zlib.zstdDecompressSync(buf.subarray(start, end)).toString('utf8').split('\n')) {
        if (!line.trim()) continue;
        try { records.push(JSON.parse(line)); } catch { torn++; }
      }
    } catch { torn++; }
  }
  return { records, frames: offsets.length, torn };
}

/** Newest session file for a workspace directory under $DSH_HOME/sessions. */
function newestSession() {
  const home = process.env.DSH_HOME ?? path.join(process.env.USERPROFILE ?? process.env.HOME ?? '.', '.dsh');
  const root = path.join(home, 'sessions');
  if (!fs.existsSync(root)) return null;
  const candidates = [];
  for (const workspace of fs.readdirSync(root)) {
    const dir = path.join(root, workspace);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const session of fs.readdirSync(dir)) {
      // Newest first: the v4 log is what a current host writes, and the older names stay so an
      // archive from before the format moved is still reachable.
      for (const name of ['session.v4.jsonl.zstd', 'session.v3.jsonl.zstd', 'session.jsonl.zstd']) {
        const file = path.join(dir, session, name);
        if (fs.existsSync(file)) candidates.push({ file, m: fs.statSync(file).mtimeMs });
      }
    }
  }
  candidates.sort((a, b) => b.m - a.m);
  return candidates[0]?.file ?? null;
}

/** Pull the assistant's own text out of a record, ignoring tool calls and the reasoning channel. */
function assistantTexts(records) {
  const out = [];
  for (const record of records) {
    if (record?.type !== 'assistant/message') continue;
    const content = record.data?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part?.type === 'text' && typeof part.text === 'string' && part.text.trim() !== '') out.push(part.text);
    }
  }
  return out;
}

export function audit(texts) {
  const rows = texts.map((text) => {
    const { fenced, inline } = exemptions(text);
    const exempt = new Set([...fenced, ...inline].flatMap((chunk) => [...chunk]));
    const hits = [...text].filter((ch) => bannedCodes.has(ch.codePointAt(0)));
    const prose = hits.filter((ch) => !exempt.has(ch));
    const sentences = sentenceCount(text);
    const faces = kaomojiOf(text);
    return {
      sentences,
      kaomoji: faces.length,
      perKaomoji: faces.length === 0 ? null : Number((sentences / faces.length).toFixed(1)),
      need: Math.ceil(sentences / 5),
      meetsFloor: faces.length >= Math.ceil(sentences / 5),
      bannedInProse: prose.length,
      bannedQuoted: hits.length - prose.length,
      codes: [...new Set(hits.map((ch) => 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')))],
    };
  });
  const sum = (key) => rows.reduce((n, r) => n + r[key], 0);
  return {
    messages: rows.length,
    sentences: sum('sentences'),
    kaomoji: sum('kaomoji'),
    perKaomoji: sum('kaomoji') === 0 ? null : Number((sum('sentences') / sum('kaomoji')).toFixed(1)),
    floorMet: rows.filter((r) => r.meetsFloor).length,
    bannedInProse: sum('bannedInProse'),
    bannedQuoted: sum('bannedQuoted'),
    rows,
  };
}

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const named = args.find((a) => !a.startsWith('--'));
const file = named ? path.resolve(named) : newestSession();
if (!file || !fs.existsSync(file)) {
  console.error('audit-session: no session log found (pass one explicitly)');
  process.exit(2);
}
const { records, frames, torn } = readRecords(file);
const texts = assistantTexts(records);
const report = audit(texts);
if (asJson) {
  console.log(JSON.stringify({ file, frames, torn, ...report }, null, 2));
  process.exit(0);
}
console.log(`session: ${file}`);
console.log(`frames: ${frames} (unreadable: ${torn})   assistant messages: ${report.messages}`);
console.log('');
console.log('  sentences  kaomoji  per  floor  banned(prose)  banned(quoted)');
for (const row of report.rows.slice(-14)) {
  console.log(`  ${String(row.sentences).padStart(9)}  ${String(row.kaomoji).padStart(7)}  ${String(row.perKaomoji ?? '-').padStart(3)}  ${(row.meetsFloor ? 'yes' : 'NO ').padStart(5)}  ${String(row.bannedInProse).padStart(13)}  ${String(row.bannedQuoted).padStart(14)}`);
}
console.log('');
console.log(`total: ${report.sentences} sentences / ${report.kaomoji} kaomoji -> one per ${report.perKaomoji ?? 'n/a'} sentences (floor: five)`);
console.log(`       floor met in ${report.floorMet}/${report.messages} messages`);
console.log(`       banned code points: ${report.bannedInProse} in prose, ${report.bannedQuoted} inside quoted code`);
