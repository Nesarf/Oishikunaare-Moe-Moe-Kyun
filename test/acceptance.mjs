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
const check = (label, fn) => {
  try {
    fn();
    console.log(`pass  ${label}`);
  } catch (error) {
    failures++;
    console.log(`FAIL  ${label}\n      ${String(error.message).split('\n')[0]}`);
  }
};

/**
 * A minimal event dispatcher matching the contract the real host gives plugins:
 * `ctx.on(event, fn)` registers, and an emission walks the handlers in registration order with
 * `next()` stepping inwards. The innermost `next()` returns the step decision.
 */
function makeHost() {
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tastylineout-acc-'));
  if (config !== undefined) fs.writeFileSync(path.join(dir, 'agent-house-rules.json'), JSON.stringify(config), 'utf8');
  return dir;
}

/** The step decision the host would produce: enter, with the conversation to send. */
const enterWith = (messages) => async () => ({ kind: 'enter', messages });

/** An assistant message in the shape the real transcript uses. */
const assistant = (id, parts) => ({ id, source: { kind: 'assistant' }, content: parts });

/** Drive one step through a host and report what would reach the model. */
async function runStep(host, messages, config) {
  const home = tempHome(config);
  mod.apply(host.ctx, { home, shippedLibrary: SHIPPED });
  try {
    const decision = await host.emit('agent/pre-step', { agent: { session: { id: 'acc' } }, messages }, enterWith(messages));
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
  const { decision } = await runStep(host, messages, { locale: 'zh' });
  const notice = noticeOf(decision);
  assert.ok(notice, 'a notice should reach the model');
  assert.equal(decision.messages[0], notice, 'and it should be first');
  assert.ok(notice.content[0].text.includes('U+2713'), 'naming the code point');
  assert.equal(decision.messages.length, messages.length + 1, 'history is added to, never rewritten');
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
  const messages = [assistant('m1', [{ type: 'text', text: `shipped it ${THUMBS_UP}` }])];
  const off = await runStep(makeHost(), messages, { locale: 'zh' });
  assert.equal(noticeOf(off.decision), undefined, 'deny mode allows the hand emoji family only after 0.1.4 - use one it still misses');
  const on = await runStep(host, messages, { locale: 'zh', selfCheckMode: 'allow' });
  const notice = noticeOf(on.decision);
  assert.ok(notice, 'allow mode should catch a glyph outside its permitted blocks');
  assert.ok(notice.content[0].text.includes('U+1F44D'));
});

check('switching the self-check off leaves the step untouched', async () => {
  const host = makeHost();
  const messages = [assistant('m1', [{ type: 'text', text: `bad ${CHECK}` }])];
  const { decision, logs } = await runStep(host, messages, { locale: 'zh', selfCheck: false });
  assert.equal(noticeOf(decision), undefined);
  assert.ok(!logs.some((l) => l.includes('self-check on')), 'and it should not claim to be listening');
  assert.ok(!host.listening('agent/pre-step'), 'nor register a handler at all');
});

check('a hook that throws does not take the step down with it', async () => {
  const host = makeHost();
  const home = tempHome({ locale: 'zh' });
  mod.apply(host.ctx, { home, shippedLibrary: SHIPPED });
  // A decision that is not an enter passes through untouched, which is what a stop looks like.
  const stopped = await host.emit('agent/pre-step', { agent: { session: { id: 'acc' } } }, async () => ({ kind: 'stop' }));
  assert.equal(stopped.kind, 'stop');
  // And an inner failure surfaces rather than being swallowed by the notice path.
  await assert.rejects(() => host.emit('agent/pre-step', { agent: { session: { id: 'acc' } } }, async () => { throw new Error('inner boom'); }));
  assert.ok(host.logs.some((l) => l.includes('could not observe the step')), 'and is reported');
  fs.rmSync(home, { recursive: true, force: true });
});

check('switching the judge mid-session takes effect on the next step', async () => {
  const host = makeHost();
  const home = tempHome({ locale: 'zh' });
  const file = path.join(home, 'agent-house-rules.json');
  mod.apply(host.ctx, { home, shippedLibrary: SHIPPED });
  const messages = [assistant('m1', [{ type: 'text', text: `shipped it ${SPARKLES}` }])];
  const first = await host.emit('agent/pre-step', { agent: { session: { id: 'acc' } }, messages }, enterWith(messages));
  assert.equal(noticeOf(first), undefined, 'the deny judge has no reason to object to a sparkle');
  // Flip the judge the way a user would: edit the config. No restart and no re-mount.
  fs.writeFileSync(file, JSON.stringify({ locale: 'zh', selfCheckMode: 'allow' }), 'utf8');
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
console.log(`\n${failures === 0 ? 'all acceptance checks pass' : failures + ' acceptance check(s) failed'}`);
process.exit(failures === 0 ? 0 : 1);
