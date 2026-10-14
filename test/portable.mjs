// The portable half, without a harness: the rules resolve, the judges judge, the notices name code
// points rather than printing them, and each transcript reader normalizes its own shape.
//
// Fixtures are written under a scratch directory, never inside the repository: a machine with a
// designated scratch directory (MMK_TMP, or this one's cache/tmp) keeps them off the system drive,
// and anywhere else falls back to the OS temporary directory.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

function scratchRoot() {
  const configured = process.env.MMK_TMP;
  if (typeof configured === 'string' && configured.trim() !== '') return configured.trim();
  const designated = 'E:\\DaShaoHuo\\cache\\tmp';
  if (process.platform === 'win32' && fs.existsSync(designated)) return designated;
  return os.tmpdir();
}

const TMP = fs.mkdtempSync(path.join(scratchRoot(), 'mmk-portable-'));
const mod = await import(pathToFileURL(path.join(ROOT, 'src', 'portable.mjs')).href);
const transcripts = await import(pathToFileURL(path.join(ROOT, 'src', 'transcripts.mjs')).href);

let passed = 0;
let failed = 0;
const checks = [];
const check = (title, fn) => checks.push({ title, fn });

const BANNED = String.fromCodePoint(0x2713);
const EMOJI = String.fromCodePoint(0x1f600);

/** A configuration file, so the mapping and the locale are exercised rather than assumed. */
function configFile(extra = {}) {
  const file = path.join(TMP, `config-${Math.random().toString(16).slice(2)}.json`);
  fs.writeFileSync(file, JSON.stringify({ locale: 'zh', moe: 'soft', moeVoice: 'auto', ...extra }), 'utf8');
  return file;
}

check('the rules resolve with no harness at all', () => {
  const state = mod.resolveState({ configFile: configFile() });
  assert.equal(state.enabled, true, 'the section is live');
  assert.ok(state.text.length > 1000, 'and carries the shipped blocks');
  assert.equal(state.locale, 'zh');
  assert.ok(state.library > 100, 'and the palette');
});

check('a machine with no configuration still gets the packaged rules', () => {
  const state = mod.resolveState({ configFile: path.join(TMP, 'absent.json') });
  assert.equal(state.enabled, true);
  assert.equal(state.locale, 'en', 'the shipped default');
});

check('the judges find what they exist to find', () => {
  const state = mod.resolveState({ configFile: configFile() });
  const glyphs = mod.judgeText(`counted ${BANNED} of them`, state);
  assert.deepEqual(glyphs.glyphs, ['U+2713']);
  const emoji = mod.judgeText(`all done ${EMOJI}`, state);
  assert.deepEqual(emoji.emoji, ['U+1F600']);
  const bare = mod.judgeText('One sentence with no face at all.', state);
  assert.equal(bare.kaomoji.bare, true, 'a bare reply is a shortage');
  const shaped = mod.judgeText('One sentence with a face (^_^) at the end.', state);
  assert.equal(shaped.kaomoji.bare, false);
});

check('a notice names the code point and never prints the glyph', () => {
  const state = mod.resolveState({ configFile: configFile() });
  const findings = mod.judgeText(`counted ${BANNED} of them`, state);
  const notices = mod.noticesFor(findings, state);
  assert.ok(notices.length >= 1);
  assert.ok(notices[0].includes('U+2713'), 'the code point is named');
  assert.equal(notices.some((notice) => notice.includes(BANNED)), false, 'and the glyph itself is never carried');
});

check('an inline code span is the world talking, not the author', () => {
  const state = mod.resolveState({ configFile: configFile() });
  const findings = mod.judgeText(`the rule names \`${BANNED}\` as an example`, state);
  assert.deepEqual(findings.glyphs, [], 'a fenced or inline span is blanked before judging');
});

check('the voice follows the preset mapping, then the persona', () => {
  const state = mod.resolveState({ configFile: configFile({ moeVoiceByPreset: { redipaloynz: 'gentle' } }) });
  const mapped = mod.voiceFor({ preset: 'redipaloynz', state });
  assert.equal(mapped.id, 'gentle');
  assert.ok(mapped.how.includes('mapped by preset'));
  const inferred = mod.voiceFor({ preset: 'unknown-preset', persona: 'a gentle, quiet, soft-spoken character', state });
  assert.ok(['gentle', 'composed', 'timid'].includes(inferred.id), `persona inference gave ${inferred.id}`);
});

check('the generic reader takes a message per line', () => {
  const file = path.join(TMP, 'plain.jsonl');
  fs.writeFileSync(file, [
    JSON.stringify({ role: 'user', content: 'hello' }),
    JSON.stringify({ role: 'assistant', content: [{ type: 'text', text: `done ${BANNED}` }] }),
  ].join('\n'), 'utf8');
  const read = transcripts.readTranscript(file, 'auto');
  assert.equal(read.format, 'jsonl');
  assert.equal(read.messages.length, 2);
  assert.equal(read.messages[1].role, 'assistant');
});

check('the claude-code reader normalizes an envelope and its thinking blocks', () => {
  const file = path.join(TMP, 'cc.jsonl');
  fs.writeFileSync(file, [
    JSON.stringify({ type: 'user', sessionId: 's1', uuid: 'u1', message: { role: 'user', content: 'hello' } }),
    JSON.stringify({
      type: 'assistant',
      sessionId: 's1',
      uuid: 'u2',
      message: { role: 'assistant', content: [{ type: 'thinking', thinking: 'quiet thinking' }, { type: 'text', text: `done ${BANNED}` }] },
    }),
  ].join('\n'), 'utf8');
  const read = transcripts.readTranscript(file, 'auto');
  assert.equal(read.format, 'cc');
  assert.equal(read.messages.length, 2);
  assert.equal(read.messages[1].source.kind, 'model', 'an assistant envelope is the model talking');
  const parts = mod.authoredParts(read.messages[1].content);
  assert.equal(parts.length, 2, 'the thinking block carries text where the judges look for it');
  const state = mod.resolveState({ configFile: configFile() });
  const review = mod.reviewConversation(read.messages, state);
  assert.deepEqual(review.findings.glyphs, ['U+2713']);
});

check('the dsh reader walks a framed artifact and skips the rows that carry no message', () => {
  if (typeof zlib.zstdCompressSync !== 'function') return;
  const header = { type: 'session', version: 4, id: 'synthetic', createdAt: 1, cwd: 'X:', isSeeded: false, delegationDepth: 0 };
  const events = [
    { type: 'turn/start', seq: 0, time: 1, data: { turn: 1 } },
    { type: 'system/message', seq: 1, time: 1, data: { turn: 1, step: 1, message: { id: 'sys', role: 'system', source: { kind: 'system-prompt' }, content: [{ type: 'text', text: 'You are an agent.' }] } } },
    { type: 'user/message', seq: 2, time: 1, data: { id: 'u1', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'do the thing' }] }, surfaceOp: 'append' },
    { type: 'repair/mmk-context-copy', seq: 3, time: 1, ignorable: true, data: { reason: 'a row with no message slot' } },
    { type: 'assistant/message', seq: 4, time: 1, data: { turn: 1, step: 1, message: { id: 'a1', role: 'assistant', source: { kind: 'model', provider: 'p', model: 'm' }, content: [{ type: 'text', text: `done ${BANNED}` }] } }, surfaceOp: 'append' },
  ];
  const frame = (text) => zlib.zstdCompressSync(Buffer.from(text, 'utf8'));
  const body = Buffer.concat([
    frame(`${JSON.stringify(header)}\n`),
    frame(`${events.map((event) => JSON.stringify(event)).join('\n')}\n`),
  ]);
  const file = path.join(TMP, 'synthetic.v4.jsonl.zstd');
  fs.writeFileSync(file, body);
  const read = transcripts.readTranscript(file, 'auto');
  assert.equal(read.format, 'dsh');
  assert.equal(read.note.frames, 2);
  assert.equal(read.note.events, 5, 'every row is counted, message or not');
  assert.equal(read.messages.length, 3, 'and only the message slots become messages');
  assert.deepEqual(read.messages.map((message) => message.role), ['system', 'user', 'assistant']);
  const state = mod.resolveState({ configFile: configFile() });
  assert.deepEqual(mod.reviewConversation(read.messages, state).findings.glyphs, ['U+2713']);
});

check('the cli exposes the same judgement, with an exit code a hook can branch on', () => {
  const cli = path.join(ROOT, 'bin', 'mmk.mjs');
  const clean = spawnSync(process.execPath, [cli, 'check', '--text', 'One sentence with a face (^_^) here.', '--quiet'], { encoding: 'utf8' });
  assert.equal(clean.status, 0, `a clean text exits 0 (stderr: ${clean.stderr})`);
  const breach = spawnSync(process.execPath, [cli, 'check', '--text', `counted ${BANNED}`, '--json'], { encoding: 'utf8' });
  assert.equal(breach.status, 3, 'a breach exits 3');
  const payload = JSON.parse(breach.stdout);
  assert.equal(payload.clean, false);
  assert.deepEqual(payload.glyphs, ['U+2713']);
  assert.ok(payload.notices[0].includes('U+2713'));
  const version = spawnSync(process.execPath, [cli, '--version'], { encoding: 'utf8' });
  assert.equal(version.status, 0);
  assert.match(version.stdout.trim(), /^[0-9]+\.[0-9]+\.[0-9]+$/);
  const usage = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
  assert.equal(usage.status, 0);
  assert.ok(usage.stdout.includes('usage: mmk'));
});

check('the claude-code adapter answers a hook without a harness to test against', () => {
  const adapter = path.join(ROOT, 'adapters', 'claude-code.mjs');
  const transcript = path.join(TMP, 'hook-cc.jsonl');
  fs.writeFileSync(transcript, [
    JSON.stringify({ type: 'user', sessionId: 'h1', uuid: 'u1', message: { role: 'user', content: 'do the thing' } }),
    JSON.stringify({ type: 'assistant', sessionId: 'h1', uuid: 'u2', message: { role: 'assistant', content: [{ type: 'text', text: `done, all ${BANNED} clear` }] } }),
  ].join('\n'), 'utf8');
  const stateDir = path.join(TMP, 'hook-state');
  const hook = (payload) => spawnSync(process.execPath, [adapter, '--state', stateDir], { encoding: 'utf8', input: JSON.stringify(payload) });

  const config = spawnSync(process.execPath, [adapter, '--print-config'], { encoding: 'utf8' });
  assert.equal(config.status, 0);
  assert.ok(JSON.parse(config.stdout).hooks.Stop, 'the fragment wires the Stop event');

  const stop = hook({ session_id: 's1', hook_event_name: 'Stop', transcript_path: transcript });
  assert.equal(stop.status, 0, 'a hook never fails the session');
  const decision = JSON.parse(stop.stdout);
  assert.equal(decision.decision, 'block', 'a breach keeps the turn open');
  assert.ok(decision.reason.includes('U+2713'));
  assert.equal(decision.reason.includes(BANNED), false, 'and never prints the glyph');

  const again = hook({ session_id: 's1', hook_event_name: 'Stop', transcript_path: transcript });
  assert.equal(again.stdout.trim(), '', 'the budget keeps it from repeating within a session');

  const other = hook({ session_id: 's2', hook_event_name: 'Stop', transcript_path: transcript, stop_hook_active: true });
  assert.equal(other.stdout.trim(), '', 'a stop this hook caused is never blocked again');

  const missing = hook({ session_id: 's3', hook_event_name: 'Stop', transcript_path: path.join(TMP, 'nope.jsonl') });
  assert.equal(missing.status, 0, 'an unreadable transcript fails open');
  assert.equal(missing.stdout.trim(), '');

  const prompt = hook({ session_id: 's4', hook_event_name: 'UserPromptSubmit', transcript_path: transcript });
  const context = JSON.parse(prompt.stdout);
  assert.equal(context.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.ok(context.hookSpecificOutput.additionalContext.includes('U+2713'), 'a prompt event gets context instead of a block');

  const cleanTranscript = path.join(TMP, 'hook-clean.jsonl');
  fs.writeFileSync(cleanTranscript, JSON.stringify({ type: 'assistant', sessionId: 'h2', uuid: 'u3', message: { role: 'assistant', content: [{ type: 'text', text: 'One sentence with a face (^_^) in it.' }] } }), 'utf8');
  const clean = hook({ session_id: 's5', hook_event_name: 'Stop', transcript_path: cleanTranscript });
  assert.equal(clean.stdout.trim(), '', 'a clean reply says nothing');
});

check('the rules block drops into a markdown rules file', () => {
  const cli = path.join(ROOT, 'bin', 'mmk.mjs');
  const md = spawnSync(process.execPath, [cli, 'rules', '--format', 'md'], { encoding: 'utf8' });
  assert.equal(md.status, 0);
  assert.ok(md.stdout.startsWith('<!-- generated by mmk rules --format md'), 'it says where it came from');
  assert.ok(md.stdout.includes('## Moe house rules'));
  assert.ok(md.stdout.includes('U+2713'), 'and carries the shipped rules');
});

// ---------------------------------------------------------------------------

for (const { title, fn } of checks) {
  try {
    await fn();
    passed += 1;
    console.log(`pass  ${title}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL  ${title}`);
    console.log(`      ${error?.message ?? error}`);
  }
}
fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed === 0 ? 0 : 1;
