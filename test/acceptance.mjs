#!/usr/bin/env node
/**
 * Acceptance harness: run the plugin the way a host runs it.
 *
 * The unit tests call the hook directly, which proves the logic and proves nothing about the wiring.
 * This file builds a small but faithful event dispatcher - plugins register with `ctx.on(event, fn)`
 * and receive `(input, next)`, where `next()` runs the chain inwards and the innermost call returns
 * the step decision - then mounts the plugin with `apply()` and drives steps through it. What it
 * proves is the part that has never been proven: that a real step carrying a breach produces a
 * notice in front of the messages that reach the model.
 *
 * Every case runs against the built artifact in lib/, so it also proves the build.
 *
 * Usage: node test/acceptance.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SHIPPED = path.join(ROOT, 'rules', 'kaomoji.json');
const mod = await import(pathToFileURL(path.join(ROOT, 'lib', 'index.js')).href);

const CHECK = String.fromCodePoint(0x2713);
const CROSS = String.fromCodePoint(0x2717);
// A glyph the deny list does not name (so deny mode lets it through) but an allow-list refuses,
// which is the whole point of the two modes differing.
const SPARKLES = String.fromCodePoint(0x2728);

let failures = 0;
const pending = [];
/**
 * Record one case; every case is run, and awaited, before the summary is printed.
 *
 * Every case here is asynchronous - a step is driven through the dispatcher - and the check used to
 * call `fn()` and print "pass" on the next line. That put the label on screen before the first
 * `await` inside the case had resolved, and let a failed assertion land as an unhandled rejection
 * that `process.exit` cut short: nineteen cases reported green without being proven.
 */
const check = (label, fn) => {
  pending.push({ label, fn });
};

/**
 * A minimal event dispatcher matching the contract the real host gives plugins:
 * `ctx.on(event, fn)` registers, and an emission walks the handlers in registration order with
 * `next()` stepping inwards. The innermost `next()` returns the step decision.
 *
 * `registry` stands in for whatever `ctx.get('agentPresets')` answers - the roster of presets, or
 * `undefined` on a deployment that has none, which is the degradation this harness has to exercise.
 */
function makeHost(registry) {
  const listeners = new Map();
  const logs = [];
  const ctx = {
    logger: {
      info: (m) => logs.push(String(m)),
      warn: (m) => logs.push('warn: ' + String(m)),
    },
    effect: (fn) => {
      fn();
      return () => {};
    },
    get: (name) => (name === 'agentPresets' ? registry : undefined),
    on(event, handler) {
      const list = listeners.get(event) ?? [];
      list.push(handler);
      listeners.set(event, list);
    },
    systemPrompt: {
      section: () => () => {},
    },
  };
  return {
    ctx,
    logs,
    /** Emit an event the way the host does: handlers in order, innermost result is the decision. */
    async emit(event, input, produce) {
      const chain = [...(listeners.get(event) ?? [])];
      const step = async (index) => {
        if (index >= chain.length) return produce();
        return chain[index](input, () => step(index + 1));
      };
      return step(0);
    },
    /** Is anything registered for an event at all? */
    listening: (event) => (listeners.get(event) ?? []).length > 0,
  };
}

/** A throwaway DSH home, so configuration behaviour is exercised end to end. */
function tempHome(config) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oishikunaare-moe-acc-'));
  if (config !== undefined) fs.writeFileSync(path.join(dir, 'agent-house-rules.json'), JSON.stringify(config), 'utf8');
  return dir;
}

/** The step decision the host would produce: enter, with the conversation to send. */
const enterWith = (messages) => async () => ({ kind: 'enter', messages });

/**
 * An assistant message in the shape a real transcript uses.
 *
 * Verified against a live session log: `role: 'assistant'`, `source: { kind: 'model', provider, model }`.
 * The earlier fixture here said `source: { kind: 'assistant' }` - which is the shape this plugin tested
 * for and the shape the host never writes, so every case that relied on it was proving a fiction.
 */
const assistant = (id, parts) => ({ id, role: 'assistant', source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-flash' }, content: parts });

/** A user message in the shape the real transcript uses. */
const userMessage = (id, text) => ({ id, source: { kind: 'user' }, role: 'user', content: [{ type: 'text', text }] });

/**
 * Drive one step through a host and report what would reach the model.
 *
 * A real host sends `messages: UserMessage[]` - the claimed inbox batch plus the assembled context -
 * and the agent's own reply lives in the session, never in that payload. `inbox` and `history` are
 * therefore separate here as well. Passing one list uses it for both, which is the shape an earlier
 * version of this harness used for every case; it is kept for the cases whose subject is the judge
 * itself, while the wire is exercised by its own case below.
 */
async function runStep(host, messages, config, options = {}) {
  const home = tempHome(config);
  mod.apply(host.ctx, { home, shippedLibrary: SHIPPED });
  const inbox = Array.isArray(options.inbox) ? options.inbox : messages;
  const history = Array.isArray(options.history) ? options.history : messages;
  const agent = { id: options.agentId ?? 'acc', ctx: { get: () => undefined }, session: { id: options.sessionId ?? 'acc', deriveMessages: () => history } };
  try {
    // The host creates the agent before the first step, and the plugin prewarms the preset there. On a
    // deployment with no roster the created events have to pass through this same listener untouched.
    await host.emit('agent/created', { agent }, () => undefined);
    const decision = await host.emit('agent/pre-step', { agent, messages: inbox }, enterWith(inbox));
    return { decision, logs: host.logs };
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}

/** Does this decision send a self-check notice to the model? */
const noticeOf = (decision) => (decision?.messages ?? []).find((m) => m?.content?.[0]?.text?.includes('SELF-CHECK')
  || m?.content?.[0]?.text?.includes('\u81ea\u68c0'));

check('the plugin registers on agent/pre-step at mount', async () => {
  const host = makeHost();
  const home = tempHome({ locale: 'zh' });
  mod.apply(host.ctx, { home, shippedLibrary: SHIPPED });
  assert.ok(host.listening('agent/pre-step'), 'the self-check should be listening');
  assert.ok(host.logs.some((l) => l.includes('self-check on')), 'and say so once');
  fs.rmSync(home, { recursive: true, force: true });
});

check('a real step carrying a breach gets a notice in front of the messages', async () => {
  const host = makeHost();
  const messages = [assistant('m1', [{ type: 'text', text: `all good ${CHECK}` }])];
  // The subject here is the symbol notice; the kaomoji rule has its own case, and a one-sentence
  // reply with no face would otherwise add a second notice to this step.
  const { decision } = await runStep(host, messages, { locale: 'zh', kaomojiCheck: false });
  const notice = noticeOf(decision);
  assert.ok(notice, 'a notice should reach the model');
  assert.equal(decision.messages[0], notice, 'and it should be first');
  assert.ok(notice.content[0].text.includes('U+2713'), 'naming the code point');
  assert.equal(decision.messages.length, messages.length + 1, 'history is added to, never rewritten');
});

check("the check reads the session, not the step's inbox", async () => {
  // The shape a real host sends: `messages` is UserMessage[] - the claimed inbox batch plus the
  // assembled context - and the agent's own reply is in the session, never in that payload. Reading
  // the payload alone is why this plugin's rules were live in the prompt and silent in practice.
  const host = makeHost();
  const history = [
    userMessage('u1', 'do the thing'),
    assistant('a1', [{ type: 'text', text: `done ${CHECK}` }]),
  ];
  const inbox = [userMessage('u2', 'and the next one')];
  const { decision } = await runStep(host, inbox, { locale: 'zh' }, { history });
  const notice = noticeOf(decision);
  assert.ok(notice, 'a breach only the session can see still has to be noticed');
  assert.equal(decision.messages[0], notice, 'and still lands in front of the step');
  // The judged list is the conversation, but the *returned* list is the step: the host records every
  // returned message as a `user/message` event verbatim, so handing the conversation back copies the
  // system prompt and the agent's own replies into the log under a user envelope, and the session
  // stops loading. Reading the session and sending the session are two different things.
  assert.equal(decision.messages.some((m) => m.id === 'u1' || m.id === 'a1'), false, 'no history travels back on the wire');
  assert.ok(decision.messages.includes(inbox[0]), 'and the step the host proposed is still there');
});

check('a notice is a complete user message, not a bare payload', async () => {
  const host = makeHost();
  const messages = [assistant('m1', [{ type: 'text', text: `all good ${CHECK}` }])];
  const { decision } = await runStep(host, messages, { locale: 'zh' });
  const notice = noticeOf(decision);
  assert.ok(notice, 'a notice should reach the model');
  // A pre-step hook's message is recorded as the durable `user/message` payload verbatim, so an
  // object without a role is a session the validator refuses on the next load and a request the
  // provider rejects with "missing field `role`" - the whole history fails, not just this notice.
  assert.equal(notice.role, 'user', 'the recorded event needs the role the validator requires');
  assert.equal(notice.source?.kind, `plugin:${mod.name}`, 'and the producer that owns it, not a borrowed identity');
  assert.ok(typeof notice.id === 'string' && notice.id.length > 0, 'and an identity of its own');
  assert.notEqual(notice.id, messages[0].id, 'which is not borrowed from the conversation');
});

check('a clean step is left exactly as it was', async () => {
  const host = makeHost();
  const messages = [
    assistant('m1', [{ type: 'text', text: 'pass / fail, no marks here' }]),
    assistant('m2', [{ type: 'thinking', text: 'nothing to report' }]),
  ];
  const { decision } = await runStep(host, messages, { locale: 'zh' });
  assert.equal(noticeOf(decision), undefined);
  assert.deepEqual(decision.messages, messages);
});

check('a breach inside thinking is caught too', async () => {
  const host = makeHost();
  const messages = [assistant('m1', [{ type: 'thinking', text: `counted ${CROSS} of them` }])];
  const { decision } = await runStep(host, messages, { locale: 'zh' });
  const notice = noticeOf(decision);
  assert.ok(notice);
  assert.ok(notice.content[0].text.includes('U+2717'));
});

check('the same breach is not notified twice across steps', async () => {
  const host = makeHost();
  const home = tempHome({ locale: 'zh' });
  mod.apply(host.ctx, { home, shippedLibrary: SHIPPED });
  const messages = [assistant('m1', [{ type: 'text', text: `bad ${CHECK}` }])];
  const first = await host.emit('agent/pre-step', { agent: { session: { id: 'acc' } }, messages }, enterWith(messages));
  const second = await host.emit('agent/pre-step', { agent: { session: { id: 'acc' } }, messages }, enterWith(messages));
  assert.ok(noticeOf(first), 'first step notices');
  assert.equal(noticeOf(second), undefined, 'second step stays quiet');
  fs.rmSync(home, { recursive: true, force: true });
});

check('what a tool printed is not held against the agent', async () => {
  const host = makeHost();
  const messages = [{ id: 't1', source: { kind: 'tool' }, content: [{ type: 'tool-result', text: `runner said ${CHECK} pass` }] }];
  const { decision } = await runStep(host, messages, { locale: 'zh' });
  assert.equal(noticeOf(decision), undefined, 'the world talking is not the author talking');
});

check('allow-list mode notices a glyph the deny list never named', async () => {
  const host = makeHost();
  const messages = [assistant('m1', [{ type: 'text', text: `shipped it ${SPARKLES}` }])];
  // The emoji check has its own, correct opinion about a sparkle, and the kaomoji rule its own about
  // a face-less sentence. This case is about the symbol judge, so both are switched off.
  const off = await runStep(makeHost(), messages, { locale: 'zh', emojiCheck: false, kaomojiCheck: false });
  assert.equal(noticeOf(off.decision), undefined, 'the deny list never names this one, so deny mode is silent');
  const on = await runStep(host, messages, { locale: 'zh', emojiCheck: false, kaomojiCheck: false, selfCheckMode: 'allow' });
  const notice = noticeOf(on.decision);
  assert.ok(notice, 'allow mode should catch a glyph outside its permitted blocks');
  assert.ok(notice.content[0].text.includes('U+2728'));
});

check('switching the self-check off leaves the step untouched', async () => {
  const host = makeHost();
  const messages = [assistant('m1', [{ type: 'text', text: `bad ${CHECK}` }])];
  const { decision, logs } = await runStep(host, messages, { locale: 'zh', selfCheck: false });
  assert.equal(noticeOf(decision), undefined);
  assert.ok(!logs.some((l) => l.includes('self-check on')), 'and it should not claim to be listening');
  assert.ok(!host.listening('agent/pre-step'), 'nor register a handler at all');
});

check('a failing inner step is not swallowed', async () => {
  const host = makeHost();
  const home = tempHome({ locale: 'zh', emojiCheck: false });
  mod.apply(host.ctx, { home, shippedLibrary: SHIPPED });
  // A decision that is not an enter passes through untouched, which is what a stop looks like.
  const stopped = await host.emit('agent/pre-step', { agent: { session: { id: 'acc' } } }, async () => ({ kind: 'stop' }));
  assert.equal(stopped.kind, 'stop');
  // And an inner failure surfaces rather than being swallowed by the notice path: a hook that ate it
  // would leave the loop holding `undefined` where a step decision belongs.
  await assert.rejects(() => host.emit('agent/pre-step', { agent: { session: { id: 'acc' } } }, async () => { throw new Error('inner boom'); }));
  assert.ok(host.logs.some((l) => l.includes('could not observe the step')), 'and is reported');
  fs.rmSync(home, { recursive: true, force: true });
});

check('switching the judge mid-session takes effect on the next step', async () => {
  const host = makeHost();
  // The emoji and kaomoji checks belong to other cases; here either would answer first and hide the
  // judge switch this case is about.
  const home = tempHome({ locale: 'zh', emojiCheck: false, kaomojiCheck: false });
  const file = path.join(home, 'agent-house-rules.json');
  mod.apply(host.ctx, { home, shippedLibrary: SHIPPED });
  const messages = [assistant('m1', [{ type: 'text', text: `shipped it ${SPARKLES}` }])];
  const first = await host.emit('agent/pre-step', { agent: { session: { id: 'acc' } }, messages }, enterWith(messages));
  assert.equal(noticeOf(first), undefined, 'the deny judge has no reason to object to a sparkle');
  // Flip the judge the way a user would: edit the config. No restart and no re-mount.
  fs.writeFileSync(file, JSON.stringify({ locale: 'zh', selfCheckMode: 'allow', emojiCheck: false, kaomojiCheck: false }), 'utf8');
  const second = await host.emit('agent/pre-step', { agent: { session: { id: 'acc' } }, messages }, enterWith(messages));
  assert.ok(noticeOf(second), 'the strict judge should notice the same message on the next step');
  fs.rmSync(home, { recursive: true, force: true });
});

check('a repeated reminder says something the first one did not', async () => {
  const host = makeHost();
  const home = tempHome({ locale: 'en' });
  mod.apply(host.ctx, { home, shippedLibrary: SHIPPED });
  const step = (id) => {
    const messages = [assistant(id, [{ type: 'text', text: `bad ${CHECK}` }])];
    return host.emit('agent/pre-step', { agent: { session: { id: 'acc' } }, messages }, enterWith(messages));
  };
  const first = noticeOf(await step('m1'));
  const second = noticeOf(await step('m2'));
  assert.ok(first && second, 'both steps should be noticed');
  assert.notEqual(first.content[0].text, second.content[0].text, 'the second should not be the same sentence');
  assert.ok(second.content[0].text.includes('#2'), 'and should say which reminder it is');
  fs.rmSync(home, { recursive: true, force: true });
});
check('the kaomoji reminder reaches the model on a real step', async () => {
  const host = makeHost();
  const bare = '\u7B2C\u4E00\u53E5\u3002\u7B2C\u4E8C\u53E5\u3002\u7B2C\u4E09\u53E5\u3002\u7B2C\u56DB\u53E5\u3002\u7B2C\u4E94\u53E5\u3002\u7B2C\u516D\u53E5\u3002';
  const messages = [assistant('m1', [{ type: 'text', text: bare }])];
  const { decision } = await runStep(host, messages, { locale: 'en' });
  const kaomojiNotice = (decision?.messages ?? []).find((m) => m?.content?.[0]?.text?.includes('KAOMOJI HABIT'));
  assert.ok(kaomojiNotice, 'a shortage should produce its own notice');
  assert.equal(decision.messages[0], kaomojiNotice, 'and reach the model ahead of the conversation');
});

check('switching the kaomoji check off leaves the floor unmentioned', async () => {
  const host = makeHost();
  const bare = '\u7B2C\u4E00\u53E5\u3002\u7B2C\u4E8C\u53E5\u3002\u7B2C\u4E09\u53E5\u3002\u7B2C\u56DB\u53E5\u3002\u7B2C\u4E94\u53E5\u3002\u7B2C\u516D\u53E5\u3002';
  const messages = [assistant('m1', [{ type: 'text', text: bare }])];
  const { decision } = await runStep(host, messages, { locale: 'en', kaomojiCheck: false });
  assert.equal((decision?.messages ?? []).some((m) => m?.content?.[0]?.text?.includes('KAOMOJI HABIT')), false);
});

check('check-text judges a string the way the hook does', async () => {
  const { spawnSync } = await import('node:child_process');
  const script = path.join(ROOT, 'scripts', 'check-text.mjs');
  const run = (args, env) => spawnSync(process.execPath, [script, ...args], { cwd: ROOT, env: { ...process.env, ...env }, encoding: 'utf8' });
  const status = run(['--status']);
  assert.equal(status.status, 0);
  assert.ok(status.stdout.includes('judge:'), 'status should report the judge');
  assert.ok(status.stdout.includes('kaomoji floor'), 'and the floor');
  const refused = run(['--text', 'all good ' + CHECK]);
  assert.equal(refused.status, 1, 'a glyph the ban names should come back as a refusal');
  assert.ok(refused.stdout.includes('U+2713'));
  const allowed = run(['--text', 'all good, in words']);
  assert.equal(allowed.status, 0);
});

check('the steer levers are on exactly as the config says', async () => {
  // The symbol lever is on by default: a notice arrives after the reply is written, and the measurement
  // says that is not enough. The kaomoji lever still waits for the config to ask for it.
  const dflt = makeHost();
  mod.apply(dflt.ctx, { home: tempHome({ locale: 'en' }), shippedLibrary: SHIPPED });
  assert.equal(dflt.listening('agent/turn-stopping'), true, 'the boundary is watched by default');
  assert.ok(dflt.logs.some((l) => l.includes('steer on')), 'and the switches are reported at boot');
  assert.ok(dflt.logs.some((l) => l.includes('symbol (at most')), 'with the symbol lever named as on');
  assert.ok(dflt.logs.some((l) => l.includes('kaomoji off')), 'and the kaomoji lever named as off');

  // A clean bare turn is left alone by the default configuration: only a glyph makes the symbol lever fire.
  {
    const steered = [];
    const conversation = [{ role: 'assistant', source: { kind: 'model' }, content: [{ type: 'text', text: 'First sentence. Second sentence.' }] }];
    const agent = { session: { id: 'acc-steer-default', deriveMessages: () => conversation }, steer: (message) => steered.push(message) };
    await dflt.emit('agent/turn-stopping', { agent, turn: 1, signal: new AbortController().signal }, () => undefined);
    assert.equal(steered.length, 0, 'a bare turn is not steered while the kaomoji lever is off');
  }

  // And it does fire on a reply that carries one, asking for that reply again rather than a fresh one.
  {
    const bad = String.fromCodePoint(0x2713);
    const steered = [];
    const conversation = [{ role: 'assistant', source: { kind: 'model' }, content: [{ type: 'reasoning', text: 'thought ' + bad }, { type: 'text', text: 'done' }] }];
    const agent = { session: { id: 'acc-steer-symbol', deriveMessages: () => conversation }, steer: (message) => steered.push(message) };
    await dflt.emit('agent/turn-stopping', { agent, turn: 5, signal: new AbortController().signal }, () => undefined);
    assert.equal(steered.length, 1, 'a reply carrying a banned glyph is steered once');
    assert.ok(steered[0].content[0].text.includes('Rewrite that reply'), 'and the steer asks for that reply again');
    assert.equal(mod.offendingGlyphs(steered[0].content[0].text).length, 0, 'without printing the glyph back');
    assert.equal(steered[0].source.kind, `plugin:${mod.name}`, 'a steered notice carries the producer identity');
  }

  // Both levers off means the boundary is not watched at all.
  const off = makeHost();
  mod.apply(off.ctx, { home: tempHome({ locale: 'en', symbolSteer: false }), shippedLibrary: SHIPPED });
  assert.equal(off.listening('agent/turn-stopping'), false, 'nothing is registered when both levers are off');
  assert.equal(off.logs.some((l) => l.includes('steer on')), false, 'and nothing is logged about it');
});

check('the steer lever keeps a bare turn open, once, within its budget', async () => {
  const host = makeHost();
  mod.apply(host.ctx, { home: tempHome({ locale: 'en', kaomojiSteer: true, kaomojiSteerMax: 1 }), shippedLibrary: SHIPPED });
  assert.equal(host.listening('agent/turn-stopping'), true, 'the boundary is watched');
  assert.ok(host.logs.some((l) => l.includes('steer on')), 'and the switch is reported at boot');

  // Two short sentences with no face at all: the floor asks for one, so this turn is bare.
  const conversation = [{ role: 'assistant', source: { kind: 'model' }, content: [{ type: 'text', text: 'First sentence. Second sentence.' }] }];
  const steered = [];
  const agent = {
    session: { id: 'acc-steer', deriveMessages: () => conversation },
    steer: (message) => steered.push(message),
  };
  const emit = (turn) => host.emit('agent/turn-stopping', { agent, turn, signal: new AbortController().signal }, () => undefined);

  await emit(1);
  assert.equal(steered.length, 1, 'one steer keeps the turn open for another step');
  assert.equal(steered[0].source.kind, `plugin:${mod.name}`, 'a steered notice carries the same producer identity');
  assert.ok(steered[0].content[0].text.includes('one more pass'), 'and it asks for the reply again');

  await emit(1);
  assert.equal(steered.length, 1, 'the same turn is never steered twice');
  await emit(2);
  assert.equal(steered.length, 1, 'the session budget stops further passes');
});

check('the steer lever leaves a shaped reply alone', async () => {
  const host = makeHost();
  mod.apply(host.ctx, { home: tempHome({ locale: 'en', kaomojiSteer: true, kaomojiSteerMax: 3 }), shippedLibrary: SHIPPED });
  const steered = [];
  const emit = (text, turn) => host.emit('agent/turn-stopping', {
    agent: { session: { id: 'acc-shaped', deriveMessages: () => [{ role: 'assistant', source: { kind: 'model' }, content: [{ type: 'text', text }] }] }, steer: (m) => steered.push(m) },
    turn,
    signal: new AbortController().signal,
  }, () => undefined);

  await emit('| a | b |\n| - | - |', 1);
  assert.equal(steered.length, 0, 'a reply made of a table is where the rule asks for none');
  await emit('- bullet one\n- bullet two', 2);
  assert.equal(steered.length, 0, 'a reply made of bullets is structure too');
  await emit('A single plain sentence.', 3);
  assert.equal(steered.length, 1, 'a single plain sentence is bare, and gets the extra pass');
});
check('the plugin registers on agent/created and disposes without a roster', async () => {
  const host = makeHost(undefined);
  mod.apply(host.ctx, { home: tempHome({ locale: 'zh', moe: 'soft' }), shippedLibrary: SHIPPED });
  // The listener has to be there even when there is no registry: a deployment without a roster still
  // gets its sessions created, and this plugin's listener must not be the reason one fails.
  assert.equal(host.listening('agent/created'), true, 'the prewarm is listening');
  assert.equal(host.listening('agent/disposed'), true, 'and cleans up after itself');
  await host.emit('agent/created', { agent: { id: 'acc', ctx: { get: () => undefined }, session: { header: {} } } }, () => undefined);
  await host.emit('agent/disposed', { agent: { id: 'acc', ctx: { get: () => undefined }, session: { header: {} } } }, () => undefined);
  assert.equal(host.logs.filter((l) => l.startsWith('warn:')).length, 0, 'neither event may fail the creation of an agent');
  await host.emit('agent/created', {}, () => undefined);
  await host.emit('agent/disposed', {}, () => undefined);
  assert.equal(host.logs.filter((l) => l.startsWith('warn:')).length, 0, 'and neither may throw on a payload without an agent');
});

check('a document that cannot be read costs the persona, not the identity or the rules', async () => {
  const asked = [];
  const host = makeHost({
    composedPreset: () => 'unknown-preset',
    readDocument: (id) => {
      asked.push(id);
      return Promise.reject(new Error('Unknown agent preset: ' + id));
    },
  });
  // A one-sentence reply with no face would add the kaomoji shortage reminder to the same step, so it
  // is switched off: the assertion here is about the symbol notice arriving anyway.
  const messages = [assistant('m1', [{ type: 'text', text: `bad ${CHECK}` }])];
  const { decision, logs } = await runStep(host, messages, { locale: 'en', kaomojiCheck: false });

  assert.deepEqual(asked, ['unknown-preset'], 'the id reached the document read');
  assert.ok(logs.some((l) => l.includes('could not be read')), 'the rejection is reported at the prewarm');
  assert.ok(logs.some((l) => l.includes('Unknown agent preset')), 'and the reason it gave is kept');
  assert.ok(noticeOf(decision), 'the discipline still has its teeth when the persona is unavailable');
});

check('no roster anywhere: the voice still speaks and the rules still bite', async () => {
  const host = makeHost(undefined);
  const messages = [
    userMessage('u1', 'plain instructions, no voice words at all'),
    assistant('a1', [{ type: 'text', text: `bad ${CHECK}` }]),
  ];
  const { decision, logs } = await runStep(host, messages, { locale: 'en', moe: 'soft', moeVoice: 'rotate', kaomojiCheck: false });
  const texts = (decision?.messages ?? []).map((m) => m?.content?.[0]?.text ?? '');
  assert.ok(texts.some((t) => t.includes('MOE VOICE')), 'the rotated voice notice is still injected');
  assert.ok(noticeOf(decision), 'and the symbol notice is still produced');
  assert.ok(logs.some((l) => l.includes('no agentPresets roster')), 'the missing roster is said once, at boot');
  assert.ok(logs.some((l) => l.includes('moe voice')), 'and the voice pick is logged as it was before');
});

check('a configured preset mapping decides the voice on a real step', async () => {
  const host = makeHost({
    composedPreset: () => 'redipaloynz',
    readDocument: async (id) => ({ agentPreset: id, content: '  - id: persona\n    config:\n      prefix: You are a coding agent.\n' }),
  });
  const messages = [assistant('m1', [{ type: 'text', text: 'All good. Nothing to report.' }])];
  const config = { locale: 'en', moe: 'soft', moeVoice: 'auto', moeVoiceByPreset: { redipaloynz: 'gentle' }, kaomojiCheck: false };
  const { decision, logs } = await runStep(host, messages, config, { agentId: 'acc-map', sessionId: 'acc-map' });
  const voice = (decision?.messages ?? []).map((m) => m?.content?.[0]?.text ?? '').find((t) => t.includes('MOE VOICE'));
  assert.ok(voice, 'a voice notice reaches the model');
  assert.ok(voice.includes('gentle'), 'and it is the voice the preset map named');
  assert.ok(!voice.includes('pinned'), 'not the wording of a fallback mode');
  assert.ok(logs.some((l) => l.includes('moe voice gentle (mapped by preset redipaloynz)')), 'the log names the preset and the source');
});

check('with no mapping the persona is asked, and the log says whose it was', async () => {
  const host = makeHost({
    composedPreset: () => 'redipaloynz',
    // The prefix arrives inside a YAML dump, verbatim; the plugin scans the text rather than parsing it.
    readDocument: async (id) => ({ agentPreset: id, content: '  - id: persona\n    config:\n      prefix: You are a gentle assistant.\n' }),
  });
  const messages = [assistant('m1', [{ type: 'text', text: 'All good. Nothing to report.' }])];
  const config = { locale: 'en', moe: 'soft', moeVoice: 'auto', kaomojiCheck: false };
  const { decision, logs } = await runStep(host, messages, config, { agentId: 'acc-persona', sessionId: 'acc-persona' });
  const voice = (decision?.messages ?? []).map((m) => m?.content?.[0]?.text ?? '').find((t) => t.includes('MOE VOICE'));
  assert.ok(voice && voice.includes('gentle'), 'the persona named the voice and it is the one announced');
  assert.ok(logs.some((l) => l.includes('inferred from the persona of preset redipaloynz')), 'the log says which haystack answered');
});

check('adding the mapping mid-session lands on the next step, with no restart', async () => {
  const host = makeHost({
    composedPreset: () => 'hisagi',
    readDocument: async (id) => ({ agentPreset: id, content: 'prefix: You are a coding agent.\n' }),
  });
  const home = tempHome({ locale: 'en', moe: 'soft', moeVoice: 'rotate', kaomojiCheck: false });
  const file = path.join(home, 'agent-house-rules.json');
  mod.apply(host.ctx, { home, shippedLibrary: SHIPPED });
  const agent = { id: 'acc-live', ctx: { get: () => undefined }, session: { id: 'acc-live', deriveMessages: () => [] } };
  const step = async (id) => {
    const messages = [assistant(id, [{ type: 'text', text: 'All good. Nothing to report.' }])];
    return host.emit('agent/pre-step', { agent, messages }, enterWith(messages));
  };
  try {
    await host.emit('agent/created', { agent }, () => undefined);
    const first = await step('m1');
    const firstVoice = (first?.messages ?? []).map((m) => m?.content?.[0]?.text ?? '').find((t) => t.includes('MOE VOICE'));
    assert.ok(firstVoice && !firstVoice.includes('elegant'), 'the session starts on the rotated voice');
    // The edit a user would make: no restart, no re-mount. The hook's own state keeps the session to one
    // voice, so the proof here is that the resolver accepts the new key at all rather than throwing.
    fs.writeFileSync(file, JSON.stringify({ locale: 'en', moe: 'soft', moeVoice: 'rotate', moeVoiceByPreset: { hisagi: 'elegant' }, kaomojiCheck: false }), 'utf8');
    const second = await step('m2');
    assert.ok(second?.messages?.length >= 1, 'and the next step still resolves with the new key present');
    assert.equal(host.logs.filter((l) => l.includes('moeVoiceByPreset')).length, 0, 'the key is a mapping, not an error to report');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

for (const { label, fn } of pending) {
  try {
    await fn();
    console.log(`pass  ${label}`);
  } catch (error) {
    failures++;
    console.log(`FAIL  ${label}\n      ${String(error.message).split('\n')[0]}`);
  }
}
console.log(`\n${failures === 0 ? 'all acceptance checks pass' : failures + ' acceptance check(s) failed'}`);
process.exit(failures === 0 ? 0 : 1);
