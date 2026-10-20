#!/usr/bin/env node
/**
 * Audit a real transcript against the rules, from a session log on disk.
 *
 * The counting itself lives in `src/audit.mjs`, so the CLI (`mmk audit`), this script and the tests read
 * the same numbers from one place. What stays here is the part that is only about this machine: finding
 * the newest session, and decoding a v4 log, which is one zstd frame per record and not a single stream.
 *
 * Frames that fail to decode (a torn tail) are counted, never guessed.
 *
 * Usage:
 *   node scripts/audit-session.mjs                       # newest session of this workspace
 *   node scripts/audit-session.mjs <session.jsonl.zstd>   # a specific one
 *   node scripts/audit-session.mjs --json                 # machine-readable
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { audit, partsFromRecords } from '../src/audit.mjs';

export { audit };

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
  const report = audit(partsFromRecords(records));
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
  // The same exit code the rest of the CLI uses for a breach, so a hook can branch on it.
  process.exit(report.bannedInProse + report.bannedInThinking + report.bannedWritten > 0 ? 3 : 0);
}

// Importable for tests: the reading above is the part worth checking, and it should not drag a session
// log and an exit code along with it.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
