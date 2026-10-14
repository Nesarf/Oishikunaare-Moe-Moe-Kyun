#!/usr/bin/env node
/**
 * The same house rules as a Claude Code hook.
 *
 * This is the thinnest possible adapter: Claude Code hands a hook a JSON payload on stdin (including
 * `transcript_path`), and reads a JSON decision on stdout. Everything between those two facts is the
 * portable core - the rules, the judges and the notice wording are not re-implemented here.
 *
 *   Stop               the reply just ended, so this is the moment a breach can still be corrected.
 *                      A block decision keeps the turn open and hands the notice back as the reason.
 *   UserPromptSubmit   context can be attached to the prompt before the model sees it.
 *   SessionStart       attach the rule section once, so the session starts knowing the rules.
 *
 * Flags
 *   --event <name>     override the event name (default: `hook_event_name` from the payload)
 *   --mode <m>         auto (default) | context | block | text | exit2
 *   --budget <n>       notices per session (default 1; 0 means no cap)
 *   --state <dir>      where the per-session counter lives (default: MMK_STATE, else the OS temp dir)
 *   --locale <l>       notice language
 *   --floor <n>        kaomoji sentences per face
 *   --print-config     print the settings.json fragment instead of running as a hook
 *   --dry-run          judge and print the decision, without touching the counter
 *
 * Two rules this adapter lives by, both learned the hard way:
 *
 *   1. **Fail open.** A discipline hook is never a reason a session cannot continue: any error exits 0
 *      with a line on stderr. The worst case is a missing reminder, never a stuck turn.
 *   2. **Never write to the conversation.** The only thing printed is a decision; the harness decides
 *      what to do with it. Nothing is appended to the transcript, and the state file holds a counter,
 *      not content.
 *
 * The documented hook contract is per-event and has moved between releases, so `--mode` exists rather
 * than one hard-coded shape: a caller that knows its version wins, and `auto` picks the shape each
 * event documents today.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveState, reviewConversation } from '../src/portable.mjs';
import { readTranscript } from '../src/transcripts.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const USAGE = `claude-code-adapter - moe house rules for Claude Code hooks

usage: node adapters/claude-code.mjs [options]        (as a hook: JSON on stdin, decision on stdout)

  --event <name>     Stop | SubagentStop | UserPromptSubmit | SessionStart (default: from the payload)
  --mode <m>         auto | context | block | text | exit2   (default auto)
  --budget <n>       notices per session, default 1; 0 disables the cap
  --state <dir>      counter directory (default MMK_STATE, else the OS temporary directory)
  --locale <l>       notice language (zh | ja | en)
  --floor <n>        kaomoji prose sentences per face (default 3)
  --print-config     print the settings.json fragment and exit
  --dry-run          judge, print the decision, and do not touch the counter
  --help             this text
`;

const argv = process.argv.slice(2);
const flags = new Map();
for (let index = 0; index < argv.length; index++) {
  const token = argv[index];
  if (!token.startsWith('--')) continue;
  const [key, inline] = token.slice(2).split('=');
  if (inline !== undefined) flags.set(key, inline);
  else if (argv[index + 1] !== undefined && !argv[index + 1].startsWith('--')) flags.set(key, argv[++index]);
  else flags.set(key, true);
}
const has = (name) => flags.has(name);
const value = (name) => (typeof flags.get(name) === 'string' ? flags.get(name) : undefined);
const fail = (message) => {
  process.stderr.write(`mmk-hook: ${message}\n`);
  process.exit(0); // fail open, always
};

if (has('help')) {
  process.stdout.write(USAGE);
  process.exit(0);
}

const HOOK = path.join(HERE, 'claude-code.mjs').replace(/\\/g, '/');

if (has('print-config')) {
  const command = `node "${HOOK}"`;
  process.stdout.write(`${JSON.stringify({
    hooks: {
      SessionStart: [{ hooks: [{ type: 'command', command }] }],
      Stop: [{ hooks: [{ type: 'command', command }] }],
      UserPromptSubmit: [{ hooks: [{ type: 'command', command }] }],
    },
  }, null, 2)}\n`);
  process.exit(0);
}

/** Read the hook payload: JSON on stdin, or an empty object when there is none. */
function payload() {
  let text = '';
  try {
    text = fs.readFileSync(0, 'utf8');
  } catch {
    return {};
  }
  if (text.trim() === '') return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

const input = payload();
const event = value('event') ?? (typeof input.hook_event_name === 'string' ? input.hook_event_name : 'Stop');

// A stop that this hook already caused must not be blocked again: the payload carries the flag the
// harness sets for exactly this, and ignoring it is how a hook turns into an infinite loop.
if (input.stop_hook_active === true) process.exit(0);

const transcript = value('transcript') ?? (typeof input.transcript_path === 'string' ? input.transcript_path : undefined);
if (transcript === undefined || transcript === '') {
  // No transcript: nothing to judge. Not an error - some events are not about a reply at all.
  process.exit(0);
}

let review;
let state;
try {
  state = resolveState({ warn: (message) => process.stderr.write(`mmk-hook: ${message}\n`) });
  const locale = value('locale');
  if (locale !== undefined) state.locale = locale;
  const floor = Number.isFinite(Number(value('floor'))) ? Number(value('floor')) : 3;
  const read = readTranscript(transcript, value('format') ?? 'auto');
  review = reviewConversation(read.messages, state, { kaomojiFloor: floor, attempt: 1 });
} catch (error) {
  fail(`could not review ${transcript}: ${error?.message ?? error}`);
}

let notices = review.notices;
if (notices.length === 0) process.exit(0);

const mode = value('mode') ?? 'auto';
const stateDir = value('state') ?? process.env.MMK_STATE ?? path.join(os.tmpdir(), 'mmk-state');
const sessionId = typeof input.session_id === 'string' && input.session_id !== '' ? input.session_id : 'unknown';
const budget = Number.isFinite(Number(value('budget'))) ? Number(value('budget')) : 1;

/** How many notices this session has already been sent, and the record of it. */
function counterFile() {
  return path.join(stateDir, `${sessionId.replace(/[^A-Za-z0-9._-]/g, '_')}.json`);
}
function readCounter() {
  try {
    const parsed = JSON.parse(fs.readFileSync(counterFile(), 'utf8'));
    return { sent: Number.isInteger(parsed.sent) ? parsed.sent : 0, at: parsed.at ?? null };
  } catch {
    return { sent: 0, at: null };
  }
}
function writeCounter(sent) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(counterFile(), JSON.stringify({ sent, at: new Date().toISOString(), session: sessionId }), 'utf8');
  } catch (error) {
    process.stderr.write(`mmk-hook: could not record the notice counter: ${error?.message ?? error}\n`);
  }
}

const counter = readCounter();
if (budget > 0 && counter.sent >= budget) {
  process.stderr.write(`mmk-hook: ${counter.sent} notice(s) already sent for this session; staying quiet\n`);
  process.exit(0);
}

const reason = notices.join('\n\n');

/** Which output shape this event documents today. */
function shapeFor(name) {
  if (mode !== 'auto') return mode;
  if (name === 'UserPromptSubmit' || name === 'SessionStart') return 'context';
  return 'block';
}
const shape = shapeFor(event);

if (has('dry-run')) {
  process.stdout.write(`${JSON.stringify({ shape, event, reason, findings: review.findings, glyphKey: review.glyphKey, emojiKey: review.emojiKey }, null, 2)}\n`);
  process.exit(0);
}

if (shape === 'context') {
  process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: reason } })}\n`);
} else if (shape === 'block') {
  process.stdout.write(`${JSON.stringify({ decision: 'block', reason })}\n`);
} else if (shape === 'text') {
  process.stdout.write(`${reason}\n`);
} else if (shape === 'exit2') {
  process.stderr.write(`${reason}\n`);
  writeCounter(counter.sent + 1);
  process.exit(2);
} else {
  fail(`unknown mode "${shape}"`);
}

writeCounter(counter.sent + 1);
process.exit(0);
