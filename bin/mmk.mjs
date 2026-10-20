#!/usr/bin/env node
/**
 * `mmk` - the house rules without a host.
 *
 * This is the entry point for anything that is not a DeepSeek Harness plugin: a shell, a git hook, a
 * CI job, another agent's hook, an MCP client calling out, or a person who just wants to know whether
 * a piece of text would be refused. It reads the same configuration and judges with the same code as
 * the plugin, because both sit on `src/portable.mjs`.
 *
 * Inputs are text and files; outputs are text on stdout, JSON with `--json`, and an exit code:
 *
 *   0  nothing to report
 *   2  the request itself was wrong (bad flag, unreadable file)
 *   3  a breach was found (so a hook or a CI step can branch on it)
 *
 * It never writes to the conversation it reads, and it never edits a file: an adapter that appends a
 * notice to a conversation is the adapter's decision, taken outside this program.
 *
 * Source, not the built bundle: `src/` ships with the package, and using it keeps the CLI working with
 * no build step.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  judgeText,
  noticesFor,
  resolveState,
  reviewConversation,
  shippedPaths,
  voiceFor,
} from '../src/portable.mjs';
import { readTranscript } from '../src/transcripts.mjs';
import { audit, partsFromMessages } from '../src/audit.mjs';
import { upsertBlock, wireTargets } from '../src/wire.mjs';
import { accentFor, briefRules, readAccentTable } from '../src/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const USAGE = `mmk - moe house rules, harness free

usage: mmk <command> [options]

commands
  rules                 print the prompt section a host should inject (--format text|md)
  wire [target]         print the wiring for one place (run with no target to list them)
  lib                   print only the kaomoji palette block
  check                 judge one text, and report what it carries
  notice                render the notice for a named finding
  voice                 decide which voice a preset or a persona speaks in
  accent                pick the accent a persona suits (--persona-text or --persona-file)
  review                judge a transcript's newest authored message
  audit                 count what a whole transcript carries, per channel

common options
  --locale <zh|ja|en>   rules and notice language (default: from config, else en)
  --home <dir>          directory holding agent-house-rules.json
  --config <file>       explicit configuration file
  --json                machine-readable output
  --help                this text
  --version             print the version

check / review
  --text <s>            judge this text
  --file <path>         judge this file's contents
  --stdin               judge standard input
  --transcript <path>   review a transcript (with --format)
  --format <auto|jsonl|cc|dsh>  transcript reader (default auto)
  --floor <n>           kaomoji sentences per face (default 3)
  --attempt <n>         which reminder this is, for the notice wording
  --quiet               print nothing; the exit code carries the answer

notice
  --kind <symbol|emoji|kaomoji>
  --glyphs <U+2713,U+2714>   code points the finding names
  --sentences <n> --faces <n>  kaomoji counts, for --kind kaomoji

audit
  --transcript <path>   measure this transcript (--format as for review)
  the totals name prose, thinking and tool arguments separately, and exit 3 means glyphs were found
`;

const argv = process.argv.slice(2);
const command = argv[0] !== undefined && !argv[0].startsWith('-') ? argv[0] : null;
const flags = new Map();
const rest = [];
for (let index = command === null ? 0 : 1; index < argv.length; index++) {
  const token = argv[index];
  if (token.startsWith('--')) {
    const [key, inline] = token.slice(2).split('=');
    if (inline !== undefined) flags.set(key, inline);
    else if (argv[index + 1] !== undefined && !argv[index + 1].startsWith('--')) flags.set(key, argv[++index]);
    else flags.set(key, true);
  } else {
    rest.push(token);
  }
}

const has = (name) => flags.has(name);
const value = (name) => (typeof flags.get(name) === 'string' ? flags.get(name) : undefined);
const number = (name, fallback) => {
  const raw = value(name);
  const parsed = raw === undefined ? Number.NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const fail = (message) => {
  process.stderr.write(`mmk: ${message}\n`);
  process.exit(2);
};
const out = (text) => process.stdout.write(`${text}\n`);

function version() {
  try {
    return JSON.parse(fs.readFileSync(path.join(HERE, '..', 'package.json'), 'utf8')).version;
  } catch {
    return 'unknown';
  }
}

if (has('version')) {
  out(version());
  process.exit(0);
}
if (has('help') || command === 'help') {
  out(USAGE.trimEnd());
  process.exit(0);
}
if (command === null) {
  // Nothing asked for: print the usage and fail, so a mistyped call is not mistaken for success.
  out(USAGE.trimEnd());
  process.exit(2);
}

const state = resolveState({
  home: value('home'),
  configFile: value('config'),
  warn: (message) => process.stderr.write(`mmk: ${message}\n`),
});
const locale = value('locale');
if (locale !== undefined) {
  // The notice wording follows `--locale`; the rule TEXT follows the configuration, because it is
  // assembled with the palette and the moe block that the configuration selects. Saying so out loud
  // beats printing one language and labelling it another.
  if (locale !== state.locale) process.stderr.write(`mmk: rules text ships in "${state.locale}"; --locale applies to notices (set locale in ${state.configFile} to change the rules)\n`);
  state.locale = locale;
}
const floor = number('floor', 3);

/** Read the text a `check` was pointed at. */
function inputText() {
  if (has('text')) return String(flags.get('text'));
  if (has('file')) {
    const file = value('file');
    if (file === undefined) fail('--file needs a path');
    try {
      return fs.readFileSync(file, 'utf8');
    } catch (error) {
      fail(`cannot read ${file}: ${error.message}`);
    }
  }
  if (has('stdin')) return fs.readFileSync(0, 'utf8');
  fail('check needs --text, --file or --stdin');
  return '';
}

const json = (payload) => out(JSON.stringify(payload, null, 2));

if (command === 'rules') {
  const built = state.resolve();
  const format = value('format') ?? 'text';
  if (has('json')) json({ locale: built.locale, enabled: built.enabled, moe: built.moe, voices: built.voices, library: built.library, length: built.text.length, configFile: built.configFile, sources: built.sources ?? null });
  else if (format === 'md' || format === 'markdown') {
    // A drop-in block for a rules file: CLAUDE.md, AGENTS.md, GEMINI.md and friends all read markdown,
    // and the generator note says where the text comes from so nobody edits this copy by hand.
    out(`<!-- generated by mmk rules --format md (Oishikunaare-Moe-Moe-Kyun ${version()}); edit the configuration, not this block -->\n## Moe house rules\n\n${built.text}`);
  } else if (format === 'text') out(built.text);
  else fail(`unknown --format "${format}" (text, md)`);
  process.exit(built.enabled ? 0 : 3);
}

if (command === 'wire') {
  // The last mile: every harness wants the same thing said in its own file. Printing the exact block,
  // with real paths filled in, is the difference between "there is an adapter" and "it is wired up".
  // The table itself lives in src/wire.mjs, the one module allowed to name another program's files.
  const here = path.join(HERE, '..').replace(/\\/g, '/');
  const targets = wireTargets({ here, version: version(), rules: state.resolve().text, brief: briefRules(state.locale) });
  const wanted = value('target') ?? rest[0];
  if (wanted === undefined) {
    if (has('json')) json(Object.fromEntries(Object.entries(targets).map(([name, entry]) => [name, { file: entry.file, note: entry.note }])));
    else {
      out('usage: mmk wire <target>');
      for (const [name, entry] of Object.entries(targets)) out(`  ${name.padEnd(16)} ${entry.file} - ${entry.note}`);
    }
    process.exit(0);
  }
  const target = targets[wanted];
  if (target === undefined) fail(`unknown wire target "${wanted}" (run: mmk wire)`);
  const writeTo = value('write');
  if (writeTo !== undefined) {
    // The block is placed between its markers, or appended when there are none, so running this twice
    // leaves one copy. A rule file that grows a second copy every time is worse than an unwired one.
    const before = fs.existsSync(writeTo) ? fs.readFileSync(writeTo, 'utf8') : '';
    const after = upsertBlock(before, wanted, target.block);
    const changed = after !== before;
    if (changed) fs.writeFileSync(writeTo, after, 'utf8');
    out(`${changed ? 'wrote' : 'unchanged'}: ${writeTo} (${wanted}${before === '' ? ', new file' : ''})`);
    process.exit(0);
  }
  if (has('json')) json({ target: wanted, file: target.file, note: target.note, block: target.block });
  else out(`# ${wanted} -> ${target.file}\n# ${target.note}\n\n${target.block}`);
  process.exit(0);
}

if (command === 'lib') {
  const built = state.resolve();
  // The palette is the last block of the section, and the section only carries it when the
  // configuration asks for one.
  const parts = built.text.split('\n\n');
  const palette = built.library > 0 ? parts[parts.length - 1] : '';
  if (has('json')) json({ locale: built.locale, faces: built.library, file: built.shippedLibrary, text: palette });
  else out(palette);
  process.exit(palette === '' ? 3 : 0);
}

if (command === 'check') {
  const findings = judgeText(inputText(), state, floor);
  const clean = findings.glyphs.length === 0 && findings.emoji.length === 0 && findings.kaomoji.bare !== true;
  if (has('json')) {
    json({ clean, locale: state.locale, glyphs: findings.glyphs, emoji: findings.emoji, kaomoji: { ...findings.kaomoji, floor, sentences: findings.kaomoji.sentences }, notices: noticesFor(findings, state, { attempt: number('attempt', 1) }) });
  } else if (!has('quiet')) {
    if (clean) out('clean');
    else {
      if (findings.glyphs.length > 0) out(`judgement glyphs: ${findings.glyphs.join(', ')}`);
      if (findings.emoji.length > 0) out(`emoji: ${findings.emoji.join(', ')}`);
      if (findings.kaomoji.bare === true) out(`kaomoji: ${findings.kaomoji.faces} face(s) in ${findings.kaomoji.sentences} sentence(s), floor ${floor}`);
      for (const notice of noticesFor(findings, state, { attempt: number('attempt', 1) })) out(`\n${notice}`);
    }
  }
  process.exit(clean ? 0 : 3);
}

if (command === 'notice') {
  const kind = value('kind');
  if (kind === undefined) fail('--kind is required');
  const glyphs = (value('glyphs') ?? '').split(',').map((part) => part.trim()).filter((part) => part !== '');
  const findings = { glyphs: [], emoji: [], kaomoji: { bare: false } };
  if (kind === 'symbol') findings.glyphs = glyphs.length > 0 ? glyphs : ['U+2713'];
  else if (kind === 'emoji') findings.emoji = glyphs.length > 0 ? glyphs : ['U+1F600'];
  else if (kind === 'kaomoji') {
    const sentences = number('sentences', 5);
    const faces = number('faces', 0);
    findings.kaomoji = { sentences, faces, needed: Math.ceil(sentences / floor), meets: faces >= Math.ceil(sentences / floor), repeated: [], bare: true };
  } else fail('--kind must be symbol, emoji or kaomoji');
  const notices = noticesFor(findings, state, { attempt: number('attempt', 1) });
  if (has('json')) json({ locale: state.locale, notices });
  else for (const notice of notices) out(notice);
  process.exit(notices.length > 0 ? 0 : 2);
}

if (command === 'voice') {
  const personaFile = value('persona-file');
  const persona = value('persona-text') ?? (personaFile === undefined ? undefined : fs.readFileSync(personaFile, 'utf8'));
  const decision = voiceFor({ preset: value('preset'), persona, state });
  if (has('json')) json(decision);
  else out(decision.id === null ? `no voice: ${decision.how}` : `${decision.id} (${decision.how})`);
  process.exit(decision.id === null ? 3 : 0);
}

if (command === 'accent') {
  const personaFile = value('persona-file');
  const persona = value('persona-text') ?? (personaFile === undefined ? undefined : fs.readFileSync(personaFile, 'utf8'));
  if (persona === undefined) fail('accent needs --persona-text or --persona-file');
  const table = readAccentTable(path.join(HERE, '..', 'rules', 'accents'), state.locale);
  const chosen = accentFor(persona, table.accents);
  if (has('json')) json({ locale: table.locale, persona, accent: chosen });
  else if (chosen === null) out('no accent fits this persona: the copy keeps the voice markers');
  else out(`${chosen.id} (${chosen.label}) - ${chosen.feel}`);
  process.exit(0);
}
if (command === 'review') {
  const file = value('transcript') ?? value('file');
  if (file === undefined) fail('review needs --transcript <path>');
  const format = value('format') ?? 'auto';
  const read = readTranscript(file, format);
  const review = reviewConversation(read.messages, state, { kaomojiFloor: floor, attempt: number('attempt', 1) });
  const payload = {
    file,
    format: read.format,
    messages: read.messages.length,
    authored: read.messages.filter((message) => message.role === 'assistant').length,
    findings: { glyphs: review.findings.glyphs, emoji: review.findings.emoji, kaomoji: { bare: review.findings.kaomoji.bare, sentences: review.findings.kaomoji.sentences, faces: review.findings.kaomoji.faces } },
    bareRun: review.bareRun,
    notices: review.notices,
    note: read.note,
  };
  if (has('json')) json(payload);
  else if (!has('quiet')) {
    if (review.notices.length === 0) out(`clean: ${read.messages.length} message(s) read from ${path.basename(file)} (${read.format})`);
    else for (const notice of review.notices) out(notice);
  }
  process.exit(review.notices.length > 0 ? 3 : 0);
}

if (command === 'audit') {
  // The whole transcript, not its newest message: what the rules add up to over a session is a
  // different question from whether the last reply would be refused, and it is the one a person asks
  // after a long conversation has gone wrong in a way the per-step notices did not stop.
  const file = value('transcript') ?? value('file');
  if (file === undefined) fail('audit needs --transcript <path>');
  const read = readTranscript(file, value('format') ?? 'auto');
  const report = audit(partsFromMessages(read.messages));
  const carried = report.bannedInProse + report.bannedInThinking + report.bannedWritten;
  if (has('json')) {
    json({
      file,
      format: read.format,
      messages: read.messages.length,
      sentences: report.sentences,
      kaomoji: report.kaomoji,
      perKaomoji: report.perKaomoji,
      floorMet: report.floorMet,
      proseParts: report.messages,
      parts: report.parts,
      banned: { prose: report.bannedInProse, quoted: report.bannedQuoted, thinking: report.bannedInThinking, written: report.bannedWritten },
      codes: [...new Set(report.rows.flatMap((row) => row.codes))],
      note: read.note,
    });
  } else if (!has('quiet')) {
    out(`file: ${file} (${read.format})   messages: ${read.messages.length}   authored parts: ${report.parts}`);
    out('');
    out(`total: ${report.sentences} sentences / ${report.kaomoji} kaomoji -> one per ${report.perKaomoji ?? 'n/a'} (floor: five)`);
    out(`       floor met in ${report.floorMet}/${report.messages} prose part(s)`);
    out(`       banned code points: ${report.bannedInProse} in prose, ${report.bannedQuoted} inside quoted code,`);
    out(`                           ${report.bannedInThinking} in thinking, ${report.bannedWritten} written through a tool call`);
    const codes = [...new Set(report.rows.flatMap((row) => row.codes))];
    if (codes.length > 0) out(`       code points seen: ${codes.join(', ')}`);
  }
  process.exit(carried > 0 ? 3 : 0);
}

fail(`unknown command "${command}" (try --help)`);
