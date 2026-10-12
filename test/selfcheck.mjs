#!/usr/bin/env node
/**
 * Behaviour check for the built plugin. Runs `apply()` against a fake cordis context and asserts
 * what actually matters: the section registers, both rules reach it, locale selection works,
 * configuration overrides both rules, disabling is honoured, and the rule text never carries the
 * glyphs it bans.
 *
 * Usage: node test/selfcheck.mjs        (runs against lib/index.js, i.e. the built artifact)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
/** The shipped library, passed explicitly so a test never depends on where the package is installed. */
const SHIPPED = path.join(ROOT, 'rules', 'kaomoji.json');
// pathToFileURL, not a bare Windows path: the ESM loader rejects "E:\..." as a URL scheme.
const mod = await import(pathToFileURL(path.join(ROOT, 'lib', 'index.js')).href);

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

/** A context exposing only the surface this plugin touches, recording what was registered. */
function fakeCtx() {
  const seen = { sections: [], effects: [], logs: [], errors: [] };
  const ctx = {
    logger: {
      info: (m) => seen.logs.push(String(m)),
      warn: (m) => seen.logs.push('warn: ' + String(m)),
    },
    effect(fn, label) {
      seen.effects.push(label);
      return fn();
    },
    systemPrompt: {
      /** The real service owns placement; here it is a stub that still proves the call shape. */
      getSectionOrder: () => 50,
      section(section) {
        if (!Number.isFinite(section.order)) seen.errors.push('order is not a finite number');
        const kind = typeof section.text;
        if (kind !== 'string' && kind !== 'function') seen.errors.push('text is neither a string nor a function');
        if (kind === 'string' && section.text === '') seen.errors.push('text is empty');
        seen.sections.push(section);
        return () => {};
      },
    },
  };
  return { ctx, seen };
}

/** A throwaway DSH home, so configuration behaviour is tested end to end rather than mocked. */
function tempHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tastylineout-'));
  return dir;
}

check('exports name, inject, apply', () => {
  assert.equal(typeof mod.name, 'string');
  assert.deepEqual(mod.inject, ['systemPrompt']);
  assert.equal(typeof mod.apply, 'function');
});

check('offendingGlyphs finds banned glyphs and clears clean text', () => {
  assert.deepEqual(mod.offendingGlyphs('pass / fail'), []);
  assert.deepEqual(mod.offendingGlyphs('U+2713 named, not printed'), []);
  const found = mod.offendingGlyphs('looks good ' + String.fromCodePoint(0x2713));
  assert.deepEqual(found, ['U+2713']);
});

check('the ban covers the whole judgement-mark family, and decorates are left alone', () => {
  // The set the ban must cover: every glyph a test runner, a checklist, a table or a chat client
  // reaches for when it means pass or fail. Named here so a future edit cannot quietly shrink it -
  // this is the audit, pinned.
  const mustCover = [
    0x2713, 0x2714, 0x2717, 0x2718, 0x2705, 0x274c, 0x274e, 0x2611, 0x2612, 0x00d7,
    0x2715, 0x2716, 0x221a, 0x221b, 0x271d, 0x2720,
    0x1f44d, 0x1f44e, 0x1f44c, 0x270a, 0x270b, 0x270c, 0x26aa, 0x26ab, 0x2b1b, 0x2b1c,
  ];
  const found = new Set(mod.offendingGlyphs(mustCover.map((cp) => String.fromCodePoint(cp)).join('')).map((s) => Number.parseInt(s.slice(2), 16)));
  const missing = mustCover.filter((cp) => !found.has(cp)).map((cp) => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0'));
  assert.deepEqual(missing, [], `the ban should cover these: ${missing.join(', ')}`);

  // Decoration is not judgement: the palette uses hearts, notes and stars, so the ban must not
  // swallow them, or the library becomes a violation of the rule that ships it.
  for (const cp of [0x2665, 0x266a, 0x2727, 0x2606, 0x2605, 0x2666, 0x266b]) {
    assert.deepEqual(mod.offendingGlyphs(String.fromCodePoint(cp)), [], `U+${cp.toString(16).toUpperCase()} should stay allowed`);
  }
});

check('buildRules text never carries a banned glyph (en and zh)', () => {
  for (const locale of ['en', 'zh', 'zh-CN', 'ja', '']) {
    const built = mod.buildRules({ userConfig: { locale }, loadRulesFile: () => null });
    assert.deepEqual(mod.offendingGlyphs(built.text), [], `locale ${locale} leaked a glyph`);
    assert.ok(built.text.length > 200, `locale ${locale} produced suspiciously short text`);
  }
});

check('locale selection prefers exact, then language, then default', () => {
  assert.equal(mod.packagedRules('zh').locale, 'zh');
  assert.equal(mod.packagedRules('zh-CN').locale, 'zh');
  assert.equal(mod.packagedRules('ZH').locale, 'zh');
  assert.equal(mod.packagedRules('en-GB').locale, 'en');
  assert.equal(mod.packagedRules('ja').locale, 'en');
  assert.equal(mod.packagedRules(undefined).locale, 'en');
});

check('both rules are present in a default build', () => {
  const built = mod.buildRules({ userConfig: {}, loadRulesFile: () => null });
  assert.ok(built.text.includes('U+2713'));
  assert.ok(/kaomoji/i.test(built.text));
  assert.equal(built.locale, 'en');
});

check('registration records one section with a finite order and non-empty text', () => {
  const { ctx, seen } = fakeCtx();
  mod.apply(ctx, { home: tempHome(), shippedLibrary: SHIPPED });
  assert.equal(seen.sections.length, 1);
  assert.equal(seen.sections[0].name, 'tasty-line-out');
  assert.deepEqual(seen.errors, []);
  assert.equal(seen.effects.length, 1);
  assert.ok(seen.logs.some((l) => l.includes('registered')));
});

check('the user config replaces one rule, then both at once', () => {
  const zhPackaged = mod.buildRules({ userConfig: { locale: 'zh' } });
  const one = mod.buildRules({ userConfig: { locale: 'zh', kaomoji: 'USER KAOMOJI RULE' } });
  assert.ok(one.text.startsWith(zhPackaged.text.split('\n\n')[0]), 'the banned rule should survive a kaomoji-only override');
  assert.ok(one.text.endsWith('USER KAOMOJI RULE'));
  assert.deepEqual(one.sources, ['packaged:zh', 'user-config']);

  const both = mod.buildRules({ userConfig: { locale: 'zh', rules: { bannedSymbols: 'ONLY THIS', kaomoji: 'AND THIS' } } });
  assert.equal(both.text, 'ONLY THIS\n\nAND THIS');
  assert.ok(both.sources.includes('rules-object'));
});

check('append is added last', () => {
  const built = mod.buildRules({ userConfig: { locale: 'en', append: 'THIRD RULE' } });
  assert.ok(built.text.endsWith('THIRD RULE'));
});

check('an empty rule disables only that rule', () => {
  const built = mod.buildRules({ userConfig: { locale: 'en', kaomoji: '' } });
  // The ban rule now mentions the word kaomoji (it exempts decorative marks inside one), so the
  // assertion has to look for the rule's own opening rather than the word.
  assert.ok(!built.text.includes('KAOMOJI HABIT'));
  assert.ok(built.text.includes('U+2713'));
});

check('the section carries a function, so the registry re-reads it every step', () => {
  const { ctx, seen } = fakeCtx();
  mod.apply(ctx, { home: tempHome(), shippedLibrary: SHIPPED });
  assert.equal(typeof seen.sections[0].text, 'function');
});

check('the shipped kaomoji library parses, is unique, and reaches the prompt', () => {
  const parsed = JSON.parse(fs.readFileSync(SHIPPED, 'utf8'));
  const categories = mod.normalizeLibrary(parsed);
  const faces = categories.flatMap((c) => c.faces.map((f) => f.face));
  assert.ok(categories.length >= 8, `expected several categories, got ${categories.length}`);
  assert.ok(faces.length >= 40, `expected a real library, got ${faces.length} faces`);
  assert.equal(new Set(faces).size, faces.length, 'every face in the library should be unique');
  assert.ok(faces.every((f) => f.trim() !== ''));

  const rendered = mod.renderKaomojiLibrary(categories, SHIPPED, { locale: 'en', max: 60 });
  assert.ok(rendered.includes('KAOMOJI LIBRARY'));
  assert.ok(rendered.includes('cheerful'));
  assert.ok(rendered.includes(SHIPPED), 'the block should name the file it came from');

  const home = tempHome();
  const { ctx, seen } = fakeCtx();
  mod.apply(ctx, { home, shippedLibrary: SHIPPED });
  assert.ok(seen.sections[0].text({}).includes('KAOMOJI LIBRARY'), 'the library should ride along with the rules');
  assert.ok(seen.logs.some((l) => l.includes('library=')), 'the boot line should count the faces');
  fs.rmSync(home, { recursive: true, force: true });
});

check('the rendered library respects its ceiling and counts what it left out', () => {
  const categories = mod.normalizeLibrary(JSON.parse(fs.readFileSync(SHIPPED, 'utf8')));
  const small = mod.renderKaomojiLibrary(categories, SHIPPED, { locale: 'en', max: 5 });
  const shown = small.split('\n').filter((l) => /: /.test(l) && !l.startsWith('not shown')).join(' ');
  assert.ok(shown.split('(').length - 1 <= 12, 'a tight ceiling should keep the block short');
  assert.ok(small.includes('not shown ('), 'and say how much was held back');
  assert.ok(small.includes(SHIPPED));
});

check('libraryPaths defaults to the shipped file and honours an explicit list', () => {
  assert.deepEqual(mod.libraryPaths(undefined, SHIPPED), [SHIPPED]);
  assert.deepEqual(mod.libraryPaths(true, SHIPPED), [SHIPPED]);
  assert.deepEqual(mod.libraryPaths(false, SHIPPED), []);
  assert.deepEqual(mod.libraryPaths('E:/mine.json', SHIPPED), ['E:/mine.json']);
  assert.deepEqual(mod.libraryPaths(['E:/a.json', 'E:/b.json', 'E:/a.json'], SHIPPED), ['E:/a.json', 'E:/b.json']);
});

check('editing a library file changes the prompt on the next read, with no restart', () => {
  const home = tempHome();
  const libraryFile = path.join(home, 'my-kaomoji.json');
  fs.writeFileSync(libraryFile, JSON.stringify({ categories: [{ id: 'mine', label: 'mine', use: 'test', faces: [{ face: '(TEST_FACE_A)', feel: 'first' }] }] }), 'utf8');
  fs.writeFileSync(path.join(home, 'agent-house-rules.json'), JSON.stringify({ locale: 'en', kaomojiLibrary: libraryFile }), 'utf8');

  const { ctx, seen } = fakeCtx();
  mod.apply(ctx, { home, shippedLibrary: SHIPPED });
  const read = () => seen.sections[0].text({});
  assert.ok(read().includes('(TEST_FACE_A)'));

  fs.writeFileSync(libraryFile, JSON.stringify({ categories: [{ id: 'mine', label: 'mine', use: 'test', faces: [{ face: '(TEST_FACE_B)', feel: 'second' }] }] }), 'utf8');
  assert.ok(read().includes('(TEST_FACE_B)'), 'the new face should land on the next read');
  assert.ok(!read().includes('(TEST_FACE_A)'), 'and the old one should be gone');
  fs.rmSync(home, { recursive: true, force: true });
});

check('the frequency floor is stated in both shipped locales, and the judge agrees with the words', () => {
  // The words and the judge default are two places holding one decision. A floor that says "every three
  // sentences" while the judge asks for one per five is how a rule quietly stops being the rule it
  // claims to be -- and the text is what a reader measures themselves against.
  assert.ok(mod.packagedRules('en').rules.kaomoji.includes('per three sentences'));
  assert.ok(mod.packagedRules('zh').rules.kaomoji.includes('\u6bcf\u4e09\u53e5\u81f3\u5c11\u4e00\u4e2a'));
  const three = mod.judgeKaomoji('\u7b2c\u4e00\u53e5\u3002\u7b2c\u4e8c\u53e5\u3002\u7b2c\u4e09\u53e5\u3002');
  assert.equal(three.meets, false, 'three bare sentences are below a floor of one per three');
  assert.ok(three.needed >= 1, 'the default judge asks for at least one face');
});

// --- the self-check: the teeth ------------------------------------------------------------

const CHECK = String.fromCodePoint(0x2713);
const CROSS = String.fromCodePoint(0x2717);

check('the judge reads prose and thinking, and stays quiet about code and code-point names', () => {
  assert.deepEqual(mod.judgeAuthoredText(`all good ${CHECK}`), ['U+2713']);
  assert.deepEqual(mod.judgeAuthoredText('pass / fail, nothing else'), []);
  assert.deepEqual(mod.judgeAuthoredText(''), []);
  // An example inside code is data, not the author's voice.
  assert.deepEqual(mod.judgeAuthoredText('```\n' + CHECK + ' ok\n```'), []);
  assert.deepEqual(mod.judgeAuthoredText('the runner printed `' + CHECK + '`'), []);
  // And the rule itself asks for code-point references, which must not trip the check.
  assert.deepEqual(mod.judgeAuthoredText('U+2713 is banned'), []);
  assert.deepEqual(mod.judgeAuthoredText('named U+2713 and printed ' + CHECK), ['U+2713']);
});

check('only the assistant own channels are judged', () => {
  const parts = mod.authoredParts([
    { type: 'text', text: `mine ${CHECK}` },
    { type: 'thinking', text: `thinking ${CROSS}` },
    { type: 'tool-result', text: `tool said ${CHECK}` },
    { type: 'image', data: 'ignored' },
  ]);
  assert.deepEqual(parts.map((p) => p.kind), ['text', 'thinking'], 'tool results are the world talking');
});

check('a breach in the newest assistant message is found; tool and user messages are not', () => {
  const messages = [
    { source: { kind: 'user' }, content: [{ type: 'text', text: `user wrote ${CHECK}` }] },
    { source: { kind: 'tool' }, content: [{ type: 'text', text: `runner printed ${CHECK}` }] },
    { id: 'm1', source: { kind: 'assistant' }, content: [{ type: 'text', text: 'clean reply' }] },
  ];
  assert.equal(mod.findBannedInMessages(messages), null, 'no assistant breach here');
  messages.push({ id: 'm2', source: { kind: 'assistant' }, content: [{ type: 'thinking', text: `counted ${CROSS}` }] });
  const found = mod.findBannedInMessages(messages);
  assert.ok(found);
  assert.deepEqual(found.glyphs, ['U+2717']);
  assert.equal(found.where, 'thinking');
  assert.equal(mod.findBannedInMessages([]), null);
  assert.equal(mod.findBannedInMessages(undefined), null);
});

check('the notice names code points and never prints the glyph', () => {
  const zh = mod.selfCheckNotice({ where: 'text', glyphs: ['U+2713'] }, 'zh');
  const en = mod.selfCheckNotice({ where: 'thinking', glyphs: ['U+2717'] }, 'en');
  assert.ok(zh.includes('U+2713'));
  assert.ok(en.includes('SELF-CHECK'));
  assert.deepEqual(mod.offendingGlyphs(zh + en), [], 'a warning that shows the glyph is another copy of it');
});

check('the hook injects one notice per breach, and respects its budget', async () => {
  const notices = [];
  const hook = mod.makeSelfCheckHook({
    max: 2,
    resolve: () => ({ enabled: true, locale: 'en' }),
    log: (m) => notices.push(m),
  });
  const breach = (id) => ({ id, source: { kind: 'assistant' }, content: [{ type: 'text', text: `bad ${CHECK}` }] });
  const step = (messages) => hook({ agent: { session: { id: 's1' } }, messages }, async () => ({ kind: 'enter', messages }));

  const first = await step([breach('m1')]);
  assert.equal(first.messages.length, 2, 'the notice goes in front of the step messages');
  assert.equal(first.messages[0].source.kind, 'user');
  assert.ok(first.messages[0].content[0].text.includes('SELF-CHECK'));

  const again = await step([breach('m1')]);
  assert.equal(again.messages.length, 1, 'the same message is not notified twice');

  const second = await step([breach('m1'), breach('m2')]);
  assert.equal(second.messages.length, 3, 'a new message gets its own notice');

  const third = await step([breach('m1'), breach('m2'), breach('m3')]);
  assert.equal(third.messages.length, 3, 'past the budget nothing is injected');
  assert.ok(notices.some((n) => n.includes('logged only')), 'and the suppression is recorded');

  const clean = await step([{ id: 'm9', source: { kind: 'assistant' }, content: [{ type: 'text', text: 'all good' }] }]);
  assert.equal(clean.messages.length, 1);
});

check('the strict judge is seeded from what the plugin actually ships', () => {
  const categories = mod.normalizeLibrary(JSON.parse(fs.readFileSync(SHIPPED, 'utf8')));
  const zh = mod.packagedRules('zh').rules;
  const text = [zh.bannedSymbols, zh.kaomoji].join(String.fromCharCode(10));

  const derived = mod.deriveAllowedCodePoints(text, categories);
  assert.ok(derived.size > 100, 'the rules and palette together use plenty of characters');
  // A palette glyph the strict blocks would otherwise refuse: the derivation is what saves it.
  const heart = String.fromCodePoint(0x2665);
  assert.ok(derived.has(0x2665));
  assert.deepEqual(mod.judgeText(heart, { mode: 'allow' }), ['U+2665'], 'a plain allow-list refuses the palette');
  assert.deepEqual(mod.judgeText(heart, { mode: 'allow', derived }), [], 'the derived seed admits it');
  // And it does not become a blanket amnesty: an emoji is still refused.
  assert.deepEqual(mod.judgeText(String.fromCodePoint(0x1f680), { mode: 'allow', derived }), ['U+1F680']);
  // The plugin must not flag its own text when the strict judge is on.
  assert.deepEqual(mod.judgeText(text, { mode: 'allow', derived }), []);
});

check('allowExtra names exceptions in both modes', () => {
  const check = String.fromCodePoint(0x2713);
  // allow mode: admits what the strict blocks would refuse.
  assert.deepEqual(mod.judgeText(String.fromCodePoint(0x1f680), { mode: 'allow', allowExtra: 'U+1F680' }), []);
  // deny mode: withdraws a glyph from the judgement list, for someone who really needs it.
  assert.deepEqual(mod.judgeText(check, { mode: 'deny', allowExtra: 'U+2713' }), []);
  assert.deepEqual(mod.judgeText(check, { mode: 'deny' }), ['U+2713']);
});

check('a later notice says something different from the first', () => {
  const finding = { where: 'text', glyphs: ['U+2713'] };
  const first = mod.selfCheckNotice(finding, 'en', { attempt: 1, exclusion: 'U+2713' });
  const second = mod.selfCheckNotice(finding, 'en', { attempt: 2, exclusion: 'U+2713' });
  const firstZh = mod.selfCheckNotice(finding, 'zh', { attempt: 1 });
  const secondZh = mod.selfCheckNotice(finding, 'zh', { attempt: 2 });
  assert.notEqual(first, second, 'the second notice should not be the same sentence again');
  assert.ok(second.includes('#2'));
  assert.notEqual(firstZh, secondZh);
  for (const text of [first, second, firstZh, secondZh]) assert.deepEqual(mod.offendingGlyphs(text), []);
});
check('the kaomoji judge counts prose, not structure', () => {
  // Six CJK sentences in a row with no face: the shortage case.
  const bare = '\u7b2c\u4e00\u53e5\u3002\u7b2c\u4e8c\u53e5\u3002\u7b2c\u4e09\u53e5\u3002\u7b2c\u56db\u53e5\u3002\u7b2c\u4e94\u53e5\u3002\u7b2c\u516d\u53e5\u3002';
  const verdict = mod.judgeKaomoji(bare);
  assert.ok(verdict.sentences >= 5, 'six sentences should count as at least five');
  assert.equal(verdict.faces, 0);
  assert.ok(verdict.needed >= 1);
  assert.equal(verdict.meets, false, 'a reply with no face is below the floor');

  // Structure is not prose: a table row, a bullet and a fenced block do not raise the bar.
  const structural = '| a | b |\n| - | - |\n- bullet\n```\ncode\n```';
  assert.equal(mod.proseSentences(mod.proseOnly(structural)), 0);
  assert.equal(mod.judgeKaomoji(structural).meets, true, 'nothing to decorate means nothing owed');

  // An ordinary parenthetical is not a face, or (see below) would satisfy the floor.
  assert.deepEqual(mod.findKaomoji('(see below)'), []);
  assert.deepEqual(mod.findKaomoji('(x)'), []);
  assert.deepEqual(mod.findKaomoji('face (\u30fb\u03c9\u30fb) here'), ['(\u30fb\u03c9\u30fb)']);
  assert.deepEqual(mod.findKaomoji('\uff08\u30fb\u03c9\u30fb\uff09fullwidth'), ['\uff08\u30fb\u03c9\u30fb\uff09']);
});

check('a face repeated back to back is reported', () => {
  const twice = mod.judgeKaomoji('\u8fde\u7740\u4e24\u4e2a (^_^) \u7136\u540e (^_^) \u518d\u6765');
  assert.equal(twice.faces, 2);
  assert.deepEqual(twice.repeated, ['(^_^)'], 'the same face twice reads as a tic');
  const varied = mod.judgeKaomoji('\u6362\u7740\u7528 (^_^) \u548c (\u30fb\u03c9\u30fb)');
  assert.deepEqual(varied.repeated, []);
});

check('the kaomoji notice is softer than the symbol one, and escalates', () => {
  const verdict = { sentences: 12, faces: 1, needed: 3, repeated: [] };
  const first = mod.kaomojiNotice(verdict, 'en', { attempt: 1 });
  const second = mod.kaomojiNotice(verdict, 'en', { attempt: 2 });
  assert.ok(first.includes('KAOMOJI HABIT'));
  assert.ok(first.includes('12'), 'it should say what was counted');
  assert.ok(first.includes('not a rule broken'), 'a shortage is a slipped habit, and the wording should say so');
  assert.ok(second.includes('#2'));
  assert.notEqual(first, second);
  const zh = mod.kaomojiNotice(verdict, 'zh', { attempt: 1 });
  assert.ok(zh.includes('\u4e60\u60ef\u6ca1\u5230\u4f4d'));
  for (const t of [first, second, zh]) assert.deepEqual(mod.offendingGlyphs(t), []);
});

check('the hook reminds about the kaomoji floor once, and not when it is off', async () => {
  const bare = '\u7b2c\u4e00\u53e5\u3002\u7b2c\u4e8c\u53e5\u3002\u7b2c\u4e09\u53e5\u3002\u7b2c\u56db\u53e5\u3002\u7b2c\u4e94\u53e5\u3002\u7b2c\u516d\u53e5\u3002';
  const messages = [{ id: 'm1', source: { kind: 'assistant' }, content: [{ type: 'text', text: bare }] }];
  const hook = mod.makeSelfCheckHook({ max: 3, kaomoji: true, kaomojiMax: 1, resolve: () => ({ enabled: true, locale: 'en', judge: { mode: 'deny' } }) });
  const step = () => hook({ agent: { session: { id: 'k1' } }, messages }, async () => ({ kind: 'enter', messages }));
  const first = await step();
  assert.equal(first.messages.length, 2, 'one reminder goes in');
  assert.ok(first.messages[0].content[0].text.includes('KAOMOJI HABIT'));
  const second = await step();
  assert.equal(second.messages.length, 1, 'the same shortage is not repeated past its budget');

  const off = mod.makeSelfCheckHook({ max: 3, kaomoji: false, resolve: () => ({ enabled: true, locale: 'en', judge: { mode: 'deny' } }) });
  const quiet = await off({ agent: { session: { id: 'k2' } }, messages }, async () => ({ kind: 'enter', messages }));
  assert.equal(quiet.messages.length, 1, 'kaomojiCheck:false means silence about the floor');
});
check('the hook leaves disabled sessions and aborted steps alone', async () => {
  const breach = { id: 'm1', source: { kind: 'assistant' }, content: [{ type: 'text', text: `bad ${CHECK}` }] };
  const off = mod.makeSelfCheckHook({ max: 3, resolve: () => ({ enabled: false, locale: 'en' }) });
  const disabled = await off({ agent: { session: { id: 's' } }, messages: [breach] }, async () => ({ kind: 'enter', messages: [breach] }));
  assert.equal(disabled.messages.length, 1, 'a disabled section means no self-check either');

  const on = mod.makeSelfCheckHook({ max: 3, resolve: () => ({ enabled: true, locale: 'en' }) });
  const aborted = await on({ agent: { session: { id: 's' } }, messages: [breach], signal: { aborted: true } }, async () => ({ kind: 'enter', messages: [breach] }));
  assert.equal(aborted.messages.length, 1);

  const stopped = await on({ agent: { session: { id: 's' } }, messages: [breach] }, async () => ({ kind: 'stop' }));
  assert.equal(stopped.kind, 'stop', 'a non-enter decision passes through untouched');
});

check('editing the config file changes the prompt on the next read, with no restart', () => {
  const home = tempHome();
  const file = path.join(home, 'agent-house-rules.json');
  const { ctx, seen } = fakeCtx();
  mod.apply(ctx, { home, shippedLibrary: SHIPPED });
  const read = () => seen.sections[0].text({});
  assert.ok(read().includes('U+2713'), 'packaged rules should arrive first');
  assert.ok(!read().includes('LIVE EDIT'), 'nothing should be there before the edit');

  // A different byte length, so the stamp check cannot miss the change.
  fs.writeFileSync(file, JSON.stringify({ append: 'LIVE EDIT APPLIED' }), 'utf8');
  assert.ok(read().includes('LIVE EDIT APPLIED'), 'the edit should land on the next read');
  fs.rmSync(home, { recursive: true, force: true });
});

check('enabled:false in the config empties the section at read time', () => {
  const home = tempHome();
  const file = path.join(home, 'agent-house-rules.json');
  fs.writeFileSync(file, JSON.stringify({ enabled: false }), 'utf8');
  const { ctx, seen } = fakeCtx();
  mod.apply(ctx, { home, shippedLibrary: SHIPPED });
  assert.ok(seen.logs.some((l) => l.includes('disabled')));
  assert.equal(seen.sections[0].text({}), '', 'a disabled section contributes nothing');
  fs.rmSync(home, { recursive: true, force: true });
});

check('a broken config file falls back to the packaged rules instead of throwing', () => {
  const home = tempHome();
  const file = path.join(home, 'agent-house-rules.json');
  fs.writeFileSync(file, '{ this is not JSON', 'utf8');
  const { ctx, seen } = fakeCtx();
  mod.apply(ctx, { home, shippedLibrary: SHIPPED });
  assert.equal(seen.sections.length, 1);
  assert.ok(seen.sections[0].text({}).includes('U+2713'));
  assert.ok(seen.logs.some((l) => l.includes('unreadable')), 'a broken file should be reported, not swallowed');
  fs.rmSync(home, { recursive: true, force: true });
});

check('a config file on disk reaches the section, and survives further edits', () => {
  const home = tempHome();
  const file = path.join(home, 'agent-house-rules.json');
  fs.writeFileSync(file, JSON.stringify({ locale: 'zh', append: 'APPENDED' }), 'utf8');
  const { ctx, seen } = fakeCtx();
  mod.apply(ctx, { home });
  const read = () => seen.sections[0].text({});
  assert.ok(read().includes('APPENDED'));
  assert.ok(read().includes('\u3010'));
  fs.writeFileSync(file, JSON.stringify({ locale: 'en' }), 'utf8');
  assert.ok(!read().includes('\u3010'), 'switching locale should drop the Chinese text');
  assert.ok(!read().includes('APPENDED'), 'and drop an override that is no longer configured');
  fs.rmSync(home, { recursive: true, force: true });
});

check('package.json ships what the installed copy needs', () => {
  // Twice now a tool has been added to the working tree and left out of the published package, and
  // both times the first sign was a cannot-find-module from an installed copy. This is the assertion
  // that would have caught both.
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const shipped = new Set(pkg.files ?? []);
  for (const entry of ['lib', 'src', 'rules', 'scripts', 'test', 'cordis.patch.yml', 'README.md', 'README.zh-CN.md']) {
    assert.ok(shipped.has(entry), `${entry} is part of the package and must be listed in files`);
  }
  for (const file of ['scripts/check-text.mjs', 'scripts/audit-session.mjs', 'rules/kaomoji.json', 'test/acceptance.mjs']) {
    assert.ok(shipped.has(file.split('/')[0]), `${file} needs its directory shipped`);
    assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} should exist`);
  }
});
check('dshHome prefers the environment over the profile default', () => {
  const saved = process.env.DSH_HOME;
  process.env.DSH_HOME = 'E:/tmp-home';
  assert.equal(mod.dshHome(), 'E:/tmp-home');
  delete process.env.DSH_HOME;
  assert.ok(mod.dshHome().length > 0);
  if (saved !== undefined) process.env.DSH_HOME = saved;
});

console.log(`\n${failures === 0 ? 'all checks pass' : failures + ' check(s) failed'}`);
process.exit(failures === 0 ? 0 : 1);
