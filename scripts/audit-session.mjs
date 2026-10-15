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
 * Reported per part the agent authored: prose and thinking separately, plus the arguments it handed to a
 * tool - the only place a write into a file becomes visible - with a sentence estimate and kaomoji count
 * for prose (the floor is a prose rule and thinking must not dilute it). The totals say whether the
 * kaomoji floor is being met, and how many banned code points reached prose, thinking, or a file.
 *
 * This read used to take only `text` and say so: "ignoring tool calls and the reasoning channel". That
 * made it agree with a version of the ban that no longer exists - measured on this machine, the
 * overwhelming majority of these code points appear in the thinking channel, so an audit that skipped it
 * reported a number that looked reassuring and was wrong.
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

/**
 * Where the ban does not reach: fenced code and inline code - by position, not by character.
 *
 * The first version collected the *characters* that appeared inside code into a set, which exempts every
 * occurrence of those characters anywhere in the text: one fenced block containing an x made every x in
 * the paragraph exempt. Positions are what the rule is about, so positions are what this returns.
 */
function exemptOffsets(text) {
  const skip = new Set();
  for (const match of text.matchAll(/```[\s\S]*?```|`[^`\n]*`/g)) {
    for (let i = match.index; i < match.index + match[0].length; i++) skip.add(i);
  }
  return skip;
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

/**
 * Every channel the agent authored, in the shape the judge reads them.
 *
 * `text` and `thinking` are the two the hook judges; `tool` is the arguments of a tool call, which is
 * where a glyph written into a file shows up and the only place it can be seen at all.
 */
function assistantParts(records) {
  const out = [];
  for (const record of records) {
    if (record?.type !== 'assistant/message') continue;
    const content = record.data?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part?.type === 'text' && typeof part.text === 'string' && part.text.trim() !== '') {
        out.push({ channel: 'text', text: part.text });
      } else if ((part?.type === 'thinking' || part?.type === 'reasoning')
        && typeof part.text === 'string' && part.text.trim() !== '') {
        out.push({ channel: 'thinking', text: part.text });
      } else if (part?.type === 'tool-call') {
        const args = part.arguments;
        const body = typeof args === 'string'
          ? args
          : args && typeof args === 'object'
            ? (() => { try { return JSON.stringify(args); } catch { return ''; } })()
            : '';
        if (body !== '') out.push({ channel: 'tool', text: body });
      }
    }
  }
  return out;
}

/** A plain string is prose: the shape this function accepted before thinking and tool calls were read. */
const asPart = (entry) => (typeof entry === 'string' ? { channel: 'text', text: entry } : entry);

export function audit(entries) {
  const parts = (Array.isArray(entries) ? entries : []).map(asPart).filter((p) => p && typeof p.text === 'string');
  const rows = parts.map(({ channel, text }) => {
    const prose = channel === 'text';
    const skip = exemptOffsets(text);
    const hits = [...text.matchAll(/./gu)]
      .map((match) => ({ cp: match[0].codePointAt(0), index: match.index }))
      .filter((hit) => bannedCodes.has(hit.cp));
    // A tool argument is what gets written into a file, so nothing in it is "quoted by accident": the
    // plugin's tool-call reading does not exempt fenced code either, because that is what lands in the
    // file. Prose and thinking keep the exemption, exactly as the hook judges them.
    const outside = channel === 'tool' ? hits : hits.filter((hit) => !skip.has(hit.index));
    const sentences = prose ? sentenceCount(text) : 0;
    const faces = prose ? kaomojiOf(text) : [];
    return {
      channel,
      sentences,
      kaomoji: faces.length,
      perKaomoji: faces.length === 0 ? null : Number((sentences / faces.length).toFixed(1)),
      need: Math.ceil(sentences / 5),
      meetsFloor: prose ? faces.length >= Math.ceil(sentences / 5) : null,
      bannedInProse: outside.length,
      bannedQuoted: hits.length - outside.length,
      codes: [...new Set(hits.map((hit) => 'U+' + hit.cp.toString(16).toUpperCase().padStart(4, '0')))],
    };
  });
  const sum = (key) => rows.reduce((n, r) => n + (r[key] ?? 0), 0);
  const inChannel = (channel) => rows.filter((r) => r.channel === channel);
  const proseRows = inChannel('text');
  const overChannel = (channel, key) => inChannel(channel).reduce((n, r) => n + (r[key] ?? 0), 0);
  return {
    messages: proseRows.length,
    parts: rows.length,
    sentences: sum('sentences'),
    kaomoji: sum('kaomoji'),
    perKaomoji: sum('kaomoji') === 0 ? null : Number((sum('sentences') / sum('kaomoji')).toFixed(1)),
    floorMet: proseRows.filter((r) => r.meetsFloor).length,
    bannedInProse: overChannel('text', 'bannedInProse'),
    bannedQuoted: overChannel('text', 'bannedQuoted'),
    bannedInThinking: overChannel('thinking', 'bannedInProse'),
    bannedWritten: overChannel('tool', 'bannedInProse'),
    rows,
  };
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const named = args.find((a) => !a.startsWith('--'));
  const file = named ? path.resolve(named) : newestSession();
  if (!file || !fs.existsSync(file)) {
    console.error('audit-session: no session log found (pass one explicitly)');
    process.exit(2);
  }
  const { records, frames, torn } = readRecords(file);
  const report = audit(assistantParts(records));
  if (asJson) {
    console.log(JSON.stringify({ file, frames, torn, ...report }, null, 2));
    process.exit(0);
  }
  console.log(`session: ${file}`);
  console.log(`frames: ${frames} (unreadable: ${torn})   parts read: ${report.parts} (${report.messages} of them prose)`);
  console.log('');
  console.log('  channel   sentences  kaomoji  per  floor  banned(prose)  banned(quoted)');
  for (const row of report.rows.slice(-14)) {
    console.log(`  ${row.channel.padEnd(9)}  ${String(row.sentences).padStart(9)}  ${String(row.kaomoji).padStart(7)}  ${String(row.perKaomoji ?? '-').padStart(3)}  ${String(row.meetsFloor === null ? '-' : row.meetsFloor ? 'yes' : 'NO ').padStart(5)}  ${String(row.bannedInProse).padStart(13)}  ${String(row.bannedQuoted).padStart(14)}`);
  }
  console.log('');
  console.log(`total: ${report.sentences} sentences / ${report.kaomoji} kaomoji -> one per ${report.perKaomoji ?? 'n/a'} sentences (floor: five)`);
  console.log(`       floor met in ${report.floorMet}/${report.messages} prose part(s)`);
  console.log(`       banned code points: ${report.bannedInProse} in prose, ${report.bannedQuoted} inside quoted code,`);
  console.log(`                           ${report.bannedInThinking} in thinking, ${report.bannedWritten} written through a tool call`);
}

// Importable for tests: the reading above is the part worth checking, and it should not drag a session
// log and an exit code along with it.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
