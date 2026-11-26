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
import { accentFor, briefRules, judgeFormulaic, measureShape, presetRootOf, readAccentTable, readBaseline, readFormulaWords, readPresetPersonaFromDisk } from '../src/index.js';
import { applyExpand, clientCandidate, guessDshRoot, revertExpand } from '../src/client-patch.mjs';

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
  persona               read one preset's persona off the disk, and what MMK would choose from it
  review                judge a transcript's newest authored message
  audit                 count what a whole transcript carries, per channel
  expand                patch the installed DSH transcript so every disclosure starts open
  corpus                read the shipped text corpus (list chapters, print one, pick lines, search)

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
  --style               also print the shape: sentence and paragraph medians, dialogue share, pairs
  --against <book>      compare that shape with a shipped corpus (genji, suzumiya)

notice
  --kind <symbol|emoji|kaomoji>
  --glyphs <U+2713,U+2714>   code points the finding names
  --sentences <n> --faces <n>  kaomoji counts, for --kind kaomoji

voice / accent / persona
  --preset <id>         the preset to ask about (name it, or give a persona file instead)
  --persona-text <s>    the persona text itself
  --persona-file <path> read the persona from this file
  --presets <dir>       where the presets live (default: $DSH_HOME/.agent-presets)

audit
  --transcript <path>   measure this transcript (--format as for review)
  --style               measure the whole transcript's prose the way a step notice does
  the totals name prose, thinking and tool arguments separately, and exit 3 means glyphs were found

expand
  --dsh <path>          the DeepSeek Harness package root (default: guessed)
  --revert              put the original client back
  the patch targets DeepSeek Harness; a DSH upgrade replaces the package, so run it again

corpus
  --book <name>         which shipped corpus to read (default: genji)
  --chapter <n>         print that chapter's text
  --excerpt <n>         print the three lines picked for that chapter
  --find <text>         report every chapter carrying this text, with the line around it
  --formula             print the measured proportions: the shape a formulaic voice is missing
  --exemplars [n]       print the lines that already write that way (all of them, or chapter n)
  the text itself is one file with a character offset per chapter, so nothing is loaded twice
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
  const text = inputText();
  const findings = judgeText(text, state, floor);
  const clean = findings.glyphs.length === 0 && findings.emoji.length === 0 && findings.kaomoji.bare !== true;
  // The shape report answers a different question from the verdict: not "would this be refused" but
  // "what does this look like next to a book". Both are printed in one call because a person holding
  // a draft wants the answer once.
  const against = value('against');
  const shape = has('style') || against !== undefined ? measureShape(text) : null;
  const words = shape === null ? { stock: [] } : readFormulaWords(path.join(HERE, '..', 'rules', 'formula'), state.locale);
  const leaned = shape === null || words.stock.length === 0 ? null : judgeFormulaic(text, words);
  const baseline = against === undefined ? null : readBaseline(path.join(HERE, '..', 'rules', 'corpus'), against);
  if (has('json')) {
    json({
      clean,
      locale: state.locale,
      glyphs: findings.glyphs,
      emoji: findings.emoji,
      kaomoji: { ...findings.kaomoji, floor, sentences: findings.kaomoji.sentences },
      shape,
      leaned,
      baseline,
      notices: noticesFor(findings, state, { attempt: number('attempt', 1) }),
    });
  } else if (!has('quiet')) {
    if (clean) out('clean');
    else {
      if (findings.glyphs.length > 0) out(`judgement glyphs: ${findings.glyphs.join(', ')}`);
      if (findings.emoji.length > 0) out(`emoji: ${findings.emoji.join(', ')}`);
      if (findings.kaomoji.bare === true) out(`kaomoji: ${findings.kaomoji.faces} face(s) in ${findings.kaomoji.sentences} sentence(s), floor ${floor}`);
      for (const notice of noticesFor(findings, state, { attempt: number('attempt', 1) })) out(`\n${notice}`);
    }
    if (shape !== null) {
      out('');
      out(`shape: ${shape.chars} characters, ${shape.sentences} sentences, ${shape.paragraphs} paragraphs`);
      out(`  sentence median ${shape.sentenceMedian}, p90 ${shape.sentenceP90}, longest ${shape.sentenceMax}`);
      out(`  paragraph median ${shape.paragraphMedian}, dialogue ${shape.dialogueShare}%, stacked commas ${shape.commaStackedShare}%`);
      out(`  possessive per 1000 ${shape.dePer1000}, exclamation per 1000 ${shape.exclaimPer1000}, "not X but Y" ${shape.adversativePairs}`);
      if (leaned !== null) {
        const named = leaned.found.length === 0 ? '' : ` (${leaned.found.join(', ')})`;
        out(`  stock phrases ${leaned.stock}${named}`);
      }
      if (baseline !== null) {
        out(`  against ${against}: sentence median ${baseline.book.sentenceMedian}, paragraph median ${baseline.book.paragraphMedian},`
          + ` stock ${baseline.book.stockPhrases} in ${baseline.book.chars}, pairs ${baseline.book.adversativePairs}`);
      } else if (against !== undefined) {
        out(`  against ${against}: not shipped`);
      }
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
if (command === 'persona') {
  // What the plugin would read for one preset, without a host: the same disk reader the prewarm falls
  // back to, then the same matchers. It answers "can MMK see this agent's setting at all" from a shell,
  // which is the question a notice can only answer after a session has already started.
  const id = value('preset');
  if (id === undefined) fail('persona needs --preset <id>');
  const root = value('presets');
  const found = readPresetPersonaFromDisk(id, root);
  const table = readAccentTable(path.join(HERE, '..', 'rules', 'accents'), state.locale);
  const accent = found.text === '' ? null : accentFor(found.text, table.accents);
  const speech = voiceFor({ preset: id, persona: found.text === '' ? undefined : found.text, state });
  if (has('json')) {
    json({ preset: id, presetRoot: presetRootOf(root), chars: found.text.length, file: found.file, accent, voice: speech });
  } else {
    out(`preset ${id}: ${found.text === '' ? 'no persona found on disk' : `${found.text.length} characters read from ${found.file}`}`);
    out(`voice ${speech.id === null ? `none (${speech.how})` : `${speech.id} (${speech.how})`}`);
    out(accent === null ? 'accent: none fits this persona' : `accent: ${accent.id} (${accent.label}) - ${accent.feel}`);
  }
  process.exit(found.text === '' ? 3 : 0);
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
  // The same measurement the step-side notice uses, over the whole transcript. This is how one run is
  // compared with the run before it, which is the only way to see whether the habit is moving at all.
  const authoredProse = read.messages
    .filter((message) => message && message.role === 'assistant' && Array.isArray(message.content))
    .flatMap((message) => message.content)
    .filter((part) => part && part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n');
  const shape = has('style') ? measureShape(authoredProse) : null;
  const formulaWords = shape === null ? { stock: [] } : readFormulaWords(path.join(HERE, '..', 'rules', 'formula'), state.locale);
  const leaned = shape === null || formulaWords.stock.length === 0 ? null : judgeFormulaic(authoredProse, formulaWords);
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
      shape,
      leaned,
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
    if (shape !== null) {
      out('');
      out(`style: ${shape.chars} characters, ${shape.sentences} sentences, ${shape.paragraphs} paragraphs`);
      out(`       sentence median ${shape.sentenceMedian}, p90 ${shape.sentenceP90}`);
      out(`       paragraph median ${shape.paragraphMedian}, dialogue ${shape.dialogueShare}%, stacked commas ${shape.commaStackedShare}%`);
      out(`       possessive per 1000 ${shape.dePer1000}, exclamation per 1000 ${shape.exclaimPer1000}, pairs ${shape.adversativePairs}`);
      if (leaned !== null) out(`       stock phrases ${leaned.stock}`);
    }
  }
  process.exit(carried > 0 ? 3 : 0);
}

if (command === 'expand') {
  // The transcript's disclosures are React-local state inside another package, so the only lever is
  // the installed bundle: this rewrites the two defaults, keeps the original beside it, and reverts
  // from that copy. It is DeepSeek Harness-specific on purpose and says so.
  const root = value('dsh') ?? guessDshRoot();
  if (root === undefined || root === null) fail('expand found no DSH installation; pass --dsh <path to the DeepSeek Harness package>');
  const file = clientCandidate(root);
  if (!fs.existsSync(file)) fail(`expand found no chat client at ${file}`);
  const result = has('revert') ? revertExpand(file) : applyExpand(file);
  const failed = result.failed === true;
  if (has('json')) json({ command: has('revert') ? 'revert' : 'apply', file, ...result });
  else {
    out(`file: ${file}`);
    if (failed) out(has('revert') ? 'revert failed: no backup beside the client' : 'patch failed: this client does not carry the expected defaults');
    else if (result.already) out('already open by default: nothing to change');
    else if (result.reverted) out('reverted: the original client is back');
    else out('patched: disclosures now start open');
    if (result.backup) out(`backup: ${result.backup}`);
    if (!failed && !has('revert')) out('refresh the browser; a DSH upgrade replaces the package, so run this again');
  }
  process.exit(failed ? 2 : 0);
}

if (command === 'corpus') {
  // The corpus is shipping data, not a rule: it is read here so a person or a program can quote the
  // tale without shipping a second copy of the text. One file plus offsets, so a chapter costs a
  // slice rather than a parse.
  const book = value('book') ?? 'genji';
  const dir = path.join(HERE, '..', 'rules', 'corpus', book);
  const manifestFile = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestFile)) fail(`corpus "${book}" is not shipped (expected ${manifestFile})`);
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const fullFile = path.join(HERE, '..', manifest.file);
  if (!fs.existsSync(fullFile)) fail(`corpus "${book}" names ${manifest.file}, which is missing`);
  const full = () => fs.readFileSync(fullFile, 'utf8');

  const chapterNo = number('chapter', Number.NaN);
  const excerptNo = number('excerpt', Number.NaN);
  const needle = value('find');

  const findChapter = (n) => {
    const row = manifest.table.find((entry) => entry.n === n);
    if (row === undefined) fail(`no chapter ${n} in ${book} (1..${manifest.chapters})`);
    return row;
  };

  if (Number.isFinite(chapterNo)) {
    const row = findChapter(chapterNo);
    // The block starts with its own `=== name ===` marker so a reader of the raw file can find it;
    // a caller that asked for chapter N already knows which one it is, so the marker is dropped here.
    const block = full().slice(row.offset, row.offset + row.length);
    const text = block.replace(/^=== [^\n]*===\s*\n+/, '').trim();
    if (has('json')) json({ book, chapter: row.n, name: row.name, chars: row.chars, text });
    else out(text);
    process.exit(0);
  }

  if (Number.isFinite(excerptNo)) {
    const row = findChapter(excerptNo);
    const quotesFile = path.join(dir, 'quotes.json');
    const quotes = fs.existsSync(quotesFile) ? JSON.parse(fs.readFileSync(quotesFile, 'utf8')) : { quotes: [] };
    const picked = quotes.quotes.filter((q) => q.chapter === row.name).map((q) => q.text);
    if (has('json')) json({ book, chapter: row.n, name: row.name, quotes: picked });
    else for (const line of picked) out(`- ${line}`);
    process.exit(0);
  }

  // The corpus exists to teach a habit, so the two useful readings are the measured shape and the pool
  // of lines that already write that way - not a wall of story.
  if (has('formula')) {
    const file = path.join(dir, 'formula.json');
    if (!fs.existsSync(file)) fail(`corpus "${book}" ships no formula.json (run: npm run gen:corpus)`);
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (has('json')) json({ book, ...doc });
    else {
      out(`${book}: ${doc.book.chars} characters, ${doc.book.sentences} sentences, ${doc.book.paragraphs} paragraphs`);
      for (const [key, value] of Object.entries(doc.book)) {
        if (key === 'chars' || key === 'sentences' || key === 'paragraphs') continue;
        out(`  ${key.padEnd(20)} ${String(value).padStart(8)}   ${doc.fields[key] ?? ''}`);
      }
    }
    process.exit(0);
  }

  if (has('exemplars')) {
    const file = path.join(dir, 'exemplars.json');
    if (!fs.existsSync(file)) fail(`corpus "${book}" ships no exemplars.json (run: npm run gen:corpus)`);
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    const exemplarNo = number('exemplars', Number.NaN);
    const wanted = Number.isFinite(exemplarNo) ? findChapter(exemplarNo).name : undefined;
    const picked = wanted === undefined ? doc.exemplars : doc.exemplars.filter((e) => e.chapter === wanted);
    if (has('json')) json({ book, chapter: wanted ?? null, count: picked.length, exemplars: picked });
    else for (const e of picked) { out(e.chapter); out(`  ${e.text}`); out(''); }
    process.exit(0);
  }

  if (needle !== undefined) {
    const text = full();
    const hits = [];
    const table = manifest.table;
    for (let i = 0; i < table.length; i += 1) {
      const row = table[i];
      const next = table[i + 1];
      const start = row.offset;
      const end = next === undefined ? text.length : next.offset;
      const slice = text.slice(start, end);
      let at = slice.indexOf(needle);
      let count = 0;
      const context = [];
      while (at !== -1) {
        count += 1;
        if (context.length < 2) context.push(slice.slice(Math.max(0, at - 22), at + needle.length + 22).replace(/\s+/g, ' '));
        at = slice.indexOf(needle, at + needle.length);
      }
      if (count > 0) hits.push({ chapter: row.n, name: row.name, count, context });
    }
    if (has('json')) json({ book, needle, chapters: hits.length, hits });
    else if (hits.length === 0) out(`no hit for "${needle}" in ${book}`);
    else {
      out(`${hits.length} chapter(s) carry "${needle}" (${hits.reduce((s, h) => s + h.count, 0)} occurrence(s))`);
      for (const h of hits) {
        out(`  ${String(h.chapter).padStart(3, '0')} ${h.name}  x${h.count}`);
        for (const c of h.context) out(`      ...${c}...`);
      }
    }
    process.exit(hits.length > 0 ? 0 : 3);
  }

  if (has('json')) json({ book, title: manifest.title, author: manifest.author, translator: manifest.translator, source: manifest.source, chapters: manifest.chapters, chars: manifest.chars, table: manifest.table });
  else {
    out(`${manifest.title} ${manifest.author} / ${manifest.translator}  (${manifest.chapters} chapters, ${manifest.chars} characters)`);
    out(`source: ${manifest.source}`);
    for (const row of manifest.table) out(`  ${String(row.n).padStart(3, '0')}  ${row.name.padEnd(18, ' ')} ${String(row.chars).padStart(7, ' ')} chars`);
  }
  process.exit(0);
}

fail(`unknown command "${command}" (try --help)`);
