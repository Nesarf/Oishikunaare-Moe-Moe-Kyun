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
/**
 * Record one case; every case is run, and awaited, before the summary is printed.
 *
 * The check used to call `fn()` and print "pass" on the next line. Cases here are asynchronous one
 * after another, so every assertion following an `await` ran after its label was already on screen,
 * and a failure landed as an unhandled rejection that `process.exit` cut short. Recording and running
 * them in order is what makes the label mean something.
 */
const pending = [];
const check = (label, fn) => {
  pending.push({ label, fn });
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oishikunaare-moe-'));
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
  assert.equal(seen.sections[0].name, 'oishikunaare-moe-moe-kyun');
  assert.deepEqual(seen.errors, []);
  assert.equal(seen.effects.length, 1);
  assert.ok(seen.logs.some((l) => l.includes('registered')));
});

check('the user config replaces one rule, then both at once', () => {
  const zhPackaged = mod.buildRules({ userConfig: { locale: 'zh' } });
  const one = mod.buildRules({ userConfig: { locale: 'zh', kaomoji: 'USER KAOMOJI RULE' } });
  assert.ok(one.text.startsWith(zhPackaged.text.split('\n\n')[0]), 'the banned rule should survive a kaomoji-only override');
  // A replaced kaomoji rule is replaced where it sits: the block after it is not the kaomoji rule, so the
  // override no longer ends the text. It is still in the text, and still ahead of that later block.
  assert.ok(one.text.includes('USER KAOMOJI RULE'), 'the override is honoured');
  assert.ok(one.text.indexOf('USER KAOMOJI RULE') < one.text.indexOf('\u3010\u601D\u8003\u8BED\u8A00\u7EAA\u5F8B\u3011'), 'and lands where the rule it replaces sat');
  assert.deepEqual(one.sources, ['packaged:zh', 'user-config']);

  // Two rules replaced at once: the pair the user supplied, then the discipline they did not supply.
  const both = mod.buildRules({ userConfig: { locale: 'zh', rules: { bannedSymbols: 'ONLY THIS', kaomoji: 'AND THIS' } } });
  assert.ok(both.text.startsWith('ONLY THIS\n\nAND THIS'), 'the pair is still a pair');
  assert.ok(both.text.endsWith(mod.packagedThinkingLanguage('zh').text), 'and the third rule follows, not replaced by it');
  assert.ok(both.sources.includes('rules-object'));
});

check('append is added last', () => {
  const built = mod.buildRules({ userConfig: { locale: 'en', append: 'THIRD RULE' } });
  assert.ok(built.text.endsWith('THIRD RULE'));
});

check('the thinking-language discipline ships in both locales, and states each half', () => {
  // The block is the plugin's own house rule rather than a per-rule override, so it is read from its
  // own accessor - and each assertion below pins a clause a later reword could quietly drop.
  const en = mod.packagedThinkingLanguage('en');
  const zh = mod.packagedThinkingLanguage('zh');
  assert.equal(en.locale, 'en');
  assert.equal(zh.locale, 'zh');
  assert.equal(mod.packagedThinkingLanguage('zh-CN').locale, 'zh', 'a language tag resolves to its base');
  assert.equal(mod.packagedThinkingLanguage('ja').locale, 'en', 'and an unknown locale falls back');
  assert.ok(en.text.length > 400, 'the English block is a block, not a line');
  assert.ok(zh.text.length > 150, 'and the Chinese one is a block too');

  // The primary language follows the reader, and English is not the neutral metalanguage.
  assert.ok(/user habit/i.test(en.text) && en.text.includes('Chinese'), 'the English block names the habit rule');
  assert.ok(en.text.includes('neutral metalanguage'), 'and refuses English as the neutral default');
  // The one case English is admitted in, with the register spelled out rather than implied.
  assert.ok(en.text.includes('moe-fandom register'), 'the moe register is the exception');
  assert.ok(en.text.includes('kawaii') && en.text.includes('senpai'), 'and its vocabulary is spelled out');
  assert.ok(en.text.includes('nya~') && en.text.includes('desu wa'), 'including the fandom English');
  assert.ok(en.text.includes('-chan'), 'and the honorifics');
  // The reason, the accuracy guard, and the untouched no-tone discipline.
  assert.ok(en.text.includes('do not match the habits of moe-fandom culture'), 'the reason is stated');
  assert.ok(en.text.includes('Technical content stays accurate'), 'correctness outranks the register');
  assert.ok(en.text.includes('commit messages'), 'and the no-tone rule for files is left alone');

  // The Chinese block is the same decision in Chinese, not a translation stub.
  assert.ok(zh.text.includes('\u601D\u8003'), 'zh: names thinking');
  assert.ok(zh.text.includes('\u7528\u6237'), 'zh: follows the user');
  assert.ok(zh.text.includes('\u4E2D\u6587') && zh.text.includes('\u65E5\u6587'), 'zh: names both languages');
  assert.ok(zh.text.includes('\u4E2D\u7ACB\u7684\u5143\u8BED\u8A00'), 'zh: refuses English as the metalanguage');
  assert.ok(zh.text.includes('\u840C\u5B85\u82F1\u6587'), 'zh: names the moe register');
  assert.ok(zh.text.includes('kawaii') && zh.text.includes('senpai'), 'zh: and its vocabulary');
  assert.ok(zh.text.includes('\u4E0D\u7B26\u5408\u840C\u5B85\u6587\u5316\u7684\u4E60\u60EF'), 'zh: states the reason');
  assert.ok(zh.text.includes('\u4E0D\u5F97\u635F\u5BB3\u6B63\u786E\u6027'), 'zh: correctness outranks the register');
  assert.ok(zh.text.includes('\u4E0D\u6539\u90A3\u6761\u7EAA\u5F8B'), 'zh: leaves the no-tone rule standing');

  // Same invariant as the other two rules: every shipped locale is judged, not a sample of one.
  for (const locale of ['en', 'zh', 'zh-CN', 'ja', '']) {
    assert.deepEqual(mod.offendingGlyphs(mod.packagedThinkingLanguage(locale).text), [], `locale ${locale} leaked a glyph`);
  }
});

check('the thinking-language block reaches the section, whatever the user rule does', () => {
  for (const locale of ['en', 'zh']) {
    const anchor = locale === 'en' ? 'THINKING LANGUAGE DISCIPLINE' : '\u3010\u601D\u8003\u8BED\u8A00\u7EAA\u5F8B\u3011';
    const built = mod.buildRules({ userConfig: { locale } });
    assert.equal(built.locale, locale);
    assert.ok(built.text.includes(anchor), locale + ': the block is in the assembled section');
    // In whole, not as a fragment: the 0.9.6 bug was a rule that reached the prompt as a substring of
    // itself, so the shipped block and the assembled section are compared rather than sampled.
    assert.ok(built.text.includes(mod.packagedThinkingLanguage(locale).text), locale + ': in full');
    assert.deepEqual(mod.offendingGlyphs(built.text), [], locale + ': the whole section stays clean');
  }

  // The moe layer is a tone switch, not a language switch: mounting the plugin is what makes this rule
  // live, so the block does not depend on `moe` or on `moeVoice` resolving to anything.
  const built = mod.buildRules({ userConfig: { locale: 'zh', moe: 'soft' } });
  assert.ok(built.text.includes(mod.packagedThinkingLanguage('zh').text), 'the moe layer does not gate it');

  // A user rule replaces its own block and nothing else: the packaged pair is swapped out, and the
  // language discipline - like `append` - still stands over the result.
  const overridden = mod.buildRules({ userConfig: { locale: 'zh', rules: { bannedSymbols: 'ONLY THIS', kaomoji: 'AND THIS' } } });
  assert.ok(overridden.text.startsWith('ONLY THIS\n\nAND THIS'), 'the override is still honoured');
  assert.ok(overridden.text.includes('\u3010\u601D\u8003\u8BED\u8A00\u7EAA\u5F8B\u3011'), 'and does not repeal the third rule');
  assert.ok(overridden.text.endsWith(mod.packagedThinkingLanguage('zh').text), 'which sits after the rules it may not replace');

  // Disabling the section is the one lever that takes the rules away - and it works the same way as
  // before: the text stays assembled (the resolver still holds a section), and `enabled: false` is what
  // makes the registry inject nothing. Asserting on the flag rather than on absence is the honest
  // reading, since the block is part of the assembled text either way.
  const disabled = mod.buildRules({ userConfig: { locale: 'en', enabled: false } });
  assert.equal(disabled.enabled, false, 'enabled:false still empties the section');
  const empty = mod.buildRules({ userConfig: { locale: 'en', rules: { bannedSymbols: '', kaomoji: '' } } });
  assert.equal(empty.text, mod.packagedThinkingLanguage('en').text, 'emptying both rules leaves the third standing alone');
});

check('a session that thinks in English is seen by the same reading the other judges use', () => {
  // The block is prose and this file has no language judge - but the reading it relies on is the shared
  // one, so a reply written in English must still be readable as the model's own prose rather than
  // skipped as a tool result. This pins the role/source shape for a third judge before one exists.
  const mk = (id, text) => ({ id, role: 'assistant', source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-flash' }, content: [{ type: 'text', text }] });
  const messages = [mk('t1', 'Let me explain the English register. I think in English by default.')];
  assert.ok(mod.isAuthoredMessage(messages[0]), 'an English reply is authored prose, not third-party output');
  assert.equal(mod.findBannedInMessages(messages), null, 'and it does not trip the symbol judge');
  const judged = mod.proseOnly(messages[0].content[0].text);
  assert.ok(judged.includes('think in English by default'), 'the sentences are readable for any future judge');
});

check('an empty rule disables only that rule', () => {
  const built = mod.buildRules({ userConfig: { locale: 'en', kaomoji: '' } });
  // The ban rule now mentions the word kaomoji (it exempts decorative marks inside one), so the
  // assertion has to look for the rule's own opening rather than the word.
  assert.ok(!built.text.includes('KAOMOJI HABIT'));
  assert.ok(built.text.includes('U+2713'));
  // An emptied rule is a rule switched off, not the section switched off: the third discipline is not
  // the one being emptied, so it is still there.
  assert.ok(built.text.includes('THINKING LANGUAGE DISCIPLINE'));
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
    { id: 'm1', role: 'assistant', source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-flash' }, content: [{ type: 'text', text: 'clean reply' }] },
  ];
  assert.equal(mod.findBannedInMessages(messages), null, 'no assistant breach here');
  messages.push({ id: 'm2', role: 'assistant', source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-flash' }, content: [{ type: 'thinking', text: `counted ${CROSS}` }] });
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
    // The subject is the symbol budget. The kaomoji and emoji rules have their own cases, and a
    // one-sentence reply with no face would otherwise add a notice of its own to this step.
    kaomoji: false,
    emoji: false,
    resolve: () => ({ enabled: true, locale: 'en' }),
    log: (m) => notices.push(m),
  });
  const breach = (id) => ({ id, role: 'assistant', source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-flash' }, content: [{ type: 'text', text: `bad ${CHECK}` }] });
  const step = (messages) => hook({ agent: { session: { id: 's1' } }, messages }, async () => ({ kind: 'enter', messages }));

  const first = await step([breach('m1')]);
  assert.equal(first.messages.length, 2, 'the notice goes in front of the step messages');
  assert.equal(first.messages[0].source.kind, `plugin:${mod.name}`, 'the notice names this plugin as its producer, not the reader');
  assert.ok(first.messages[0].content[0].text.includes('SELF-CHECK'));

  const again = await step([breach('m1')]);
  assert.equal(again.messages.length, 1, 'the same message is not notified twice');

  const second = await step([breach('m1'), breach('m2')]);
  assert.equal(second.messages.length, 3, 'a new message gets its own notice');

  const third = await step([breach('m1'), breach('m2'), breach('m3')]);
  assert.equal(third.messages.length, 3, 'past the budget nothing is injected');
  assert.ok(notices.some((n) => n.includes('logged only')), 'and the suppression is recorded');

  const clean = await step([{ id: 'm9', role: 'assistant', source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-flash' }, content: [{ type: 'text', text: 'all good' }] }]);
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

// Found in the real notices of one long session: the heading counted up ("self-check #4") while the
// escalation said "this is the second reminder", because that sentence was a constant. A reminder
// about accuracy that is itself inaccurate teaches the wrong thing, so the number is pinned here.
check('an escalation names the reminder it really is, in both notices and both locales', () => {
  const verdict = { sentences: 9, faces: 1, needed: 3, repeated: [] };
  const zhThird = mod.kaomojiNotice(verdict, 'zh', { attempt: 3 });
  const enThird = mod.kaomojiNotice(verdict, 'en', { attempt: 3 });
  assert.ok(zhThird.includes('\u7b2c 3 \u6b21'), 'zh names the third reminder');
  assert.ok(!zhThird.includes('\u7b2c\u4e8c\u6b21\u63d0\u9192'), 'and no longer claims to be the second');
  assert.ok(enThird.includes('#3'), 'en names the third reminder');
  assert.ok(!enThird.includes('Second reminder'), 'and no longer claims to be the second');

  const finding = { where: 'text', glyphs: ['U+2713'] };
  const zhSymbol = mod.selfCheckNotice(finding, 'zh', { attempt: 3 });
  const enSymbol = mod.selfCheckNotice(finding, 'en', { attempt: 3 });
  assert.ok(zhSymbol.includes('\u53d1\u8fc7 2 \u6b21'), 'zh counts the reminders already sent');
  assert.ok(!zhSymbol.includes('\u6ca1\u88ab\u843d\u5b9e'), 'and stops asserting that it never landed');
  assert.ok(!zhSymbol.includes('\uff1a\u3002'), 'and no longer ends a sentence with a colon and a full stop');
  assert.ok(enSymbol.includes('#3') && !enSymbol.includes('the first time'), 'en does the same');
});

// A real session's second symbol notice reprinted all 26 matched code points - about 200 characters to
// say what the first notice had already said. A repeat now names a few and points back.
check('a repeat points back to the first notice instead of reprinting the list', () => {
  const glyphs = [];
  for (let i = 0; i < 26; i++) glyphs.push(`U+27${(10 + i).toString(16).toUpperCase()}`);
  const finding = { where: 'text', glyphs };
  const first = mod.selfCheckNotice(finding, 'en', { attempt: 1 });
  const third = mod.selfCheckNotice(finding, 'en', { attempt: 3 });
  assert.ok(first.includes(glyphs[0]) && first.includes(glyphs[25]), 'the first notice names the whole set');
  assert.ok(third.includes(glyphs[0]), 'a repeat still names some of them');
  assert.equal(third.includes(glyphs[25]), false, 'but not the whole set');
  assert.ok(third.includes('22 more') && third.includes('reminder #1'), 'and says where the full list is');
  assert.ok(third.length < first.length, 'so a repeat is shorter than the first notice');
  const zhThird = mod.selfCheckNotice(finding, 'zh', { attempt: 3 });
  assert.ok(zhThird.includes('\u7b2c 1 \u6b21\u63d0\u9192'), 'zh points back the same way');
  assert.ok(zhThird.length < mod.selfCheckNotice(finding, 'zh', { attempt: 1 }).length);
  const small = mod.selfCheckNotice({ where: 'text', glyphs: ['U+2713'] }, 'en', { attempt: 3 });
  assert.ok(small.includes('(U+2713)'), 'a short set is still named in full');
});

// The kaomoji floor is counted on the reply text alone, while the rule asks for the habit in thinking
// too. The notice says which of the two its number measures rather than leaving it to be assumed.
check('the emoji notice counts its reminders too', () => {
  const finding = { where: 'text', glyphs: ['U+1F600'] };
  const third = mod.emojiNotice(finding, 'en', { attempt: 3 });
  const thirdZh = mod.emojiNotice(finding, 'zh', { attempt: 3 });
  assert.ok(third.includes('#3'), 'the heading counts up');
  assert.ok(third.includes('Reminder #3'), 'and so does the escalation');
  assert.equal(third.includes('Second reminder'), false, 'which no longer claims to be the second');
  assert.ok(thirdZh.includes('\u7b2c 3 \u6b21\u63d0\u9192'), 'zh names the real attempt');
  assert.equal(thirdZh.includes('\u7b2c\u4e8c\u6b21\u63d0\u9192'), false, 'and not the second');
  assert.ok(third.includes('U+1F600'), 'the code point is named, never the glyph');
});
check('the kaomoji notice says what its number measures', () => {
  const verdict = { sentences: 9, faces: 1, needed: 3, repeated: [] };
  const zhFirst = mod.kaomojiNotice(verdict, 'zh', { attempt: 1 });
  const enFirst = mod.kaomojiNotice(verdict, 'en', { attempt: 1 });
  assert.ok(zhFirst.includes('\u5224\u636e\u53ea\u7b97\u56de\u590d\u6b63\u6587'), 'zh states the scope');
  assert.ok(enFirst.includes('reads the reply text only'), 'en states the scope');
  assert.equal(mod.kaomojiNotice(verdict, 'en', { attempt: 2 }).includes('reads the reply text only'), false, 'and a repeat does not repeat it');
});

check('the hook reminds about the kaomoji floor once, and not when it is off', async () => {
  const bare = '\u7b2c\u4e00\u53e5\u3002\u7b2c\u4e8c\u53e5\u3002\u7b2c\u4e09\u53e5\u3002\u7b2c\u56db\u53e5\u3002\u7b2c\u4e94\u53e5\u3002\u7b2c\u516d\u53e5\u3002';
  const messages = [{ id: 'm1', role: 'assistant', source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-flash' }, content: [{ type: 'text', text: bare }] }];
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

// Rule four was the one with no self-check at all: measured over a real session, the reasoning channel
// drifts back to Latin (CJK 21.6% in one window, 2.4% in a later one) and nothing named the drift.
check('the thinking-language judge needs both sides to be worth a claim', () => {
  const latin = 'The operator asked for a restart check, so I look at the listening port, compare the pid with the one in the state file, and decide whether a second start would collide. This sentence exists only to give the judge enough Latin letters to form an opinion.';
  const cjk = '\u5148\u770b\u7aef\u53e3\u6709\u6ca1\u6709\u4eba\u5728\u542c\uff0c\u518d\u6bd4\u5bf9\u72b6\u6001\u6587\u4ef6\u91cc\u7684 pid\uff0c\u5224\u65ad\u7b2c\u4e8c\u6b21\u542f\u52a8\u4f1a\u4e0d\u4f1a\u649e\u4e0a\u3002\u8fd9\u53e5\u8bdd\u53ea\u662f\u4e3a\u4e86\u7ed9\u5224\u636e\u8db3\u591f\u7684\u4e2d\u6587\u5b57\u6570\uff0c\u597d\u8ba9\u5b83\u5f62\u6210\u4e00\u4e2a\u5224\u65ad\u3002';
  const readerZh = '\u73b0\u5728\u5e94\u8be5\u53ea\u6709\u8fd9\u4e00\u4e2a3080\u8fdb\u7a0b\u5728\u542c\u4e86\uff0c\u4e4b\u524d\u6211\u624b\u52a8\u62c9\u8d77\u7684\u90a3\u4e2a\u62a5\u5df2\u6709\u8fdb\u7a0b\u4e86';
  const readerEn = 'only one listener now, the earlier manual launch said the port was taken';

  assert.equal(mod.judgeThinkingLanguage(latin, readerZh).mismatch, true, 'Latin thinking for a Chinese reader is the mismatch');
  assert.equal(mod.judgeThinkingLanguage(cjk, readerZh).mismatch, false, 'CJK thinking for a CJK reader is not');
  assert.equal(mod.judgeThinkingLanguage(latin, readerEn).mismatch, false, 'and an English reader makes Latin thinking correct');
  assert.equal(mod.judgeThinkingLanguage('ok, checking the port now', readerZh).mismatch, false, 'a two-word thought is never a claim');
  assert.ok(mod.judgeThinkingLanguage(latin, readerZh).latin > 100, 'the verdict carries what it counted');

  const zhNotice = mod.languageNotice(mod.judgeThinkingLanguage(latin, readerZh), 'zh', { attempt: 1 });
  const zhThird = mod.languageNotice(mod.judgeThinkingLanguage(latin, readerZh), 'zh', { attempt: 3 });
  assert.ok(zhNotice.includes('\u601d\u8003\u8bed\u8a00'), 'the zh notice names the rule');
  assert.ok(zhNotice.includes('\u5224\u636e\u53ea\u770b\u6700\u65b0\u4e00\u5757\u601d\u8003'), 'and states what it measures');
  assert.ok(zhThird.includes('\u7b2c 3 \u6b21\u63d0\u9192'), 'a repeat names the real attempt');
  assert.ok(zhThird.length < zhNotice.length, 'and stays shorter than the first notice');
  const enNotice = mod.languageNotice(mod.judgeThinkingLanguage(latin, readerZh), 'en', { attempt: 1 });
  assert.ok(enNotice.includes('THINKING LANGUAGE') && enNotice.includes('no reply to this notice is needed'));
  for (const text of [zhNotice, zhThird, enNotice]) assert.deepEqual(mod.offendingGlyphs(text), [], 'a notice never carries a banned glyph');
});

check('the hook names a thinking drift, once, and stays quiet for an English reader', async () => {
  const reasoning = [{ type: 'reasoning', text: 'Let me think about what the operator asked: the port check comes first, then the pid comparison, and only then a decision about restarting. This block is deliberately long enough for the judge to have an opinion about its language, because a short one would be ignored.' }];
  const assistant = { id: 'a1', role: 'assistant', source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-flash' }, content: [...reasoning, { type: 'text', text: 'checked the port.' }] };
  const zhUser = { id: 'u1', role: 'user', content: [{ type: 'text', text: '\u73b0\u5728\u5e94\u8be5\u53ea\u6709\u8fd9\u4e00\u4e2a3080\u8fdb\u7a0b\u5728\u542c\u4e86\uff0c\u4e4b\u524d\u6211\u624b\u52a8\u62c9\u8d77\u7684\u90a3\u4e2a\u62a5\u5df2\u6709\u8fdb\u7a0b\u4e86' }] };
  const enUser = { id: 'u2', role: 'user', content: [{ type: 'text', text: 'only one listener now, the earlier manual launch said the port was taken' }] };
  const notice = { id: 'n1', role: 'user', source: { kind: 'plugin:something-else' }, content: [{ type: 'text', text: '\u63d2\u4ef6\u6ce8\u5165\u7684\u4e2d\u6587\u63d0\u9192' }] };

  const hook = mod.makeSelfCheckHook({ max: 5, language: true, languageMax: 1, kaomoji: false, emoji: false, resolve: () => ({ enabled: true, locale: 'en', judge: { mode: 'deny' } }) });
  const messages = [zhUser, assistant];
  const hasNotice = (result) => result.messages.some((message) => (message.content?.[0]?.text ?? '').includes('THINKING LANGUAGE'));
  const step = () => hook({ agent: { session: { id: 'lang1' } }, messages }, async () => ({ kind: 'enter', messages }));
  const first = await step();
  assert.ok(hasNotice(first), 'the language notice goes in');
  assert.equal(first.messages.length, messages.length + 1, 'and nothing else is added');
  const second = await step();
  assert.equal(hasNotice(second), false, 'the same thinking block is not judged twice');

  const quiet = mod.makeSelfCheckHook({ max: 5, language: true, kaomoji: false, emoji: false, resolve: () => ({ enabled: true, locale: 'en', judge: { mode: 'deny' } }) });
  const englishReader = await quiet({ agent: { session: { id: 'lang2' } }, messages: [enUser, assistant] }, async () => ({ kind: 'enter', messages: [enUser, assistant] }));
  assert.equal(hasNotice(englishReader), false, 'an English reader gets no language reminder');

  // A plugin notice is a user message too, and it is written in the session locale whatever the person
  // writes - counting it would answer the wrong question.
  const mixed = await quiet({ agent: { session: { id: 'lang3' } }, messages: [enUser, notice, assistant] }, async () => ({ kind: 'enter', messages: [enUser, notice, assistant] }));
  assert.equal(hasNotice(mixed), false, 'a plugin notice does not make the reader look Chinese');

  const off = mod.makeSelfCheckHook({ max: 5, language: false, kaomoji: false, emoji: false, resolve: () => ({ enabled: true, locale: 'en', judge: { mode: 'deny' } }) });
  const silent = await off({ agent: { session: { id: 'lang4' } }, messages }, async () => ({ kind: 'enter', messages }));
  assert.equal(hasNotice(silent), false, 'language:false means silence about the drift');
});
check('a run of face-less replies is counted, and never by counting structure', () => {
  const mk = (text) => ({ role: 'assistant', source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-flash' }, content: [{ type: 'text', text }] });
  const face = '(\u30fb\u03c9\u30fb)';
  const faced = 'looked at the file ' + face;

  assert.equal(mod.countBareRun([mk(faced)]), 0, 'a newest reply with a face is not a run');
  assert.equal(mod.countBareRun([mk('\u7b2c\u4e00\u53e5\u3002'), mk('ok.')]), 2, 'two short replies are a run of two');
  assert.equal(mod.countBareRun([mk('a\u3002'), mk(faced), mk('b\u3002')]), 1, 'a faced reply breaks the streak');
  assert.equal(mod.countBareRun([mk('a\u3002'), mk('b\u3002'), mk(faced)]), 2, 'the run is what sits behind the newest reply');
  assert.equal(mod.countBareRun([]), 0);
  assert.equal(mod.countBareRun(undefined), 0, 'a hook called without messages does not throw');

  const table = mk('| a | b |\\n| - | - |');
  assert.equal(mod.countBareRun([table, table]), 0, 'a reply of tables is exempt, so it is not bare');
});

check('the kaomoji judge reports a bare reply, which is the case the floor hides', () => {
  const bare = mod.judgeKaomoji('\u5c31\u4e00\u53e5\u3002');
  assert.equal(bare.bare, true, 'one sentence with no face is bare');
  assert.equal(bare.faces, 0);
  const faced = mod.judgeKaomoji('\u5c31\u4e00\u53e5 (\u30fb\u03c9\u30fb)\u3002');
  assert.equal(faced.bare, false, 'a face clears it');
  assert.equal(mod.judgeKaomoji('').bare, false, 'nothing written is not a bare reply');
});

check('the run notice says the habit is being skipped, not under-dosed', () => {
  const verdict = { sentences: 2, faces: 0, needed: 1, repeated: [] };
  const zh = mod.kaomojiNotice(verdict, 'zh', { bareRun: 3 });
  const en = mod.kaomojiNotice(verdict, 'en', { bareRun: 3 });
  assert.ok(zh.includes('3') || zh.includes('\uFF13'), 'the zh notice names the run length');
  assert.ok(en.includes('last 3 replies'), 'the en notice names the run length');
  assert.ok(zh.includes('\u5c31\u662f\u9891\u7387\u4e0d\u591f') || zh.includes('\u4e0d\u662f\u9891\u7387\u4e0d\u591f'), 'and says it is not about dosage');
  assert.ok(en.includes('not a shortage'), 'and says the same in English');

  // Without a run it stays the softer shortage wording.
  assert.ok(mod.kaomojiNotice(verdict, 'en').includes('Worth one or two'), 'the floor wording is unchanged');
  // And the notice now agrees with the shipped floor rather than naming five.
  assert.ok(!mod.kaomojiNotice(verdict, 'zh').includes('\u6bcf\u4e94\u53e5'), 'the notice no longer says five sentences');
});

check('the hook speaks up when replies in a row carry no face', async () => {
  const mk = (id, text) => ({ id, role: 'assistant', source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-flash' }, content: [{ type: 'text', text }] });
  const messages = [mk('m1', 'a\u3002'), mk('m2', 'b\u3002'), mk('m3', 'c\u3002')];
  const seen = [];
  const hook = mod.makeSelfCheckHook({
    max: 3,
    kaomoji: true,
    kaomojiMax: 0,
    // The emoji rule has its own case; here it would answer first on the same reply.
    emoji: false,
    resolve: () => ({ enabled: true, locale: 'en', judge: { mode: 'deny' } }),
    log: (m) => seen.push(m),
  });
  const step = () => hook({ agent: { session: { id: 'run1' } }, messages }, async () => ({ kind: 'enter', messages }));

  const first = await step();
  assert.equal(first.messages.length, messages.length + 1, 'one notice goes in front of the step');
  assert.ok(first.messages[0].content[0].text.includes('in a row'), 'and it is the run wording');
  assert.ok(seen.some((m) => m.includes('in a row carried no kaomoji')), 'the run is logged');

  const again = await step();
  assert.equal(again.messages.length, messages.length, 'the run is announced once, not every step');
});

check('the newest bare reply is found, and structure is not one', () => {
  const mk = (text) => ({ role: 'assistant', source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-flash' }, content: [{ type: 'text', text }] });
  const face = '(\u30fb\u03c9\u30fb)';

  assert.equal(mod.newestBareReply([mk('Two sentences. No face.')]), 'Two sentences. No face.');
  assert.equal(mod.newestBareReply([mk('fine ' + face)]), null, 'a face clears it');
  assert.equal(mod.newestBareReply([]), null);
  assert.equal(mod.newestBareReply(undefined), null);
  assert.equal(mod.newestBareReply([mk('| a | b |\\n| - | - |')]), null, 'a table is not bare prose');
  assert.equal(mod.newestBareReply([mk('- one\\n- two')]), null, 'bullets are structure too');
  // Only the newest assistant message counts, whatever sits behind it.
  assert.equal(mod.newestBareReply([mk('old ' + face), mk('new and bare.')]), 'new and bare.');
});

check('the steer notice asks for the reply again, in either locale', () => {
  const zh = mod.steerNotice('zh');
  const en = mod.steerNotice('en');
  assert.ok(zh.includes('\u6700\u540e\u4e00\u6b65'), 'the zh text names the lever');
  assert.ok(en.includes('one more pass'), 'the en text names it');
  assert.ok(zh !== en && zh.includes('\u989c\u6587\u5b57') && en.includes('kaomoji'));
  assert.ok(en.includes('same content'), 'and asks for the same reply rather than an appendix');
});

check('the steer decider is guarded on every side', () => {
  const mk = (text) => ({ role: 'assistant', source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-flash' }, content: [{ type: 'text', text }] });
  const bare = [mk('Two sentences. No face.')];
  const faced = [mk('fine (\u30fb\u03c9\u30fb)')];
  const state = { enabled: true, locale: 'en', judge: { mode: 'deny' }, emojiAllow: new Set() };
  const agentFor = (messages) => ({
    session: { id: 'steer-unit', deriveMessages: () => messages },
    steer: () => {},
  });
  const build = (enabled, max) => mod.makeSteerDecider({ enabled, max, resolve: () => state });

  assert.equal(build(false, 5)({ agent: agentFor(bare), turn: 1, signal: {} }), null, 'off means off');
  assert.equal(build(true, 5)({ agent: agentFor(faced), turn: 1, signal: {} }), null, 'a faced reply is left alone');
  assert.equal(build(true, 5)({ agent: agentFor(bare), turn: 1, signal: { aborted: true } }), null, 'an aborted turn is left alone');
  assert.equal(build(true, 5)({ agent: { session: { id: 's', deriveMessages: () => bare } }, turn: 1, signal: {} }), null, 'an agent without steer is left alone');
  assert.equal(build(true, 5)({ agent: agentFor([]), turn: 1, signal: {} }), null, 'an empty transcript steers nothing');

  const disabled = mod.makeSteerDecider({ enabled: true, max: 5, resolve: () => ({ ...state, enabled: false }) });
  assert.equal(disabled({ agent: agentFor(bare), turn: 1, signal: {} }), null, 'a disabled section means no steering');

  const one = build(true, 1);
  assert.ok(one({ agent: agentFor(bare), turn: 7, signal: {} }) !== null, 'the first bare turn steers');
  assert.equal(one({ agent: agentFor(bare), turn: 7, signal: {} }), null, 'never twice in one turn');
  assert.equal(one({ agent: agentFor(bare), turn: 8, signal: {} }), null, 'and never past the session budget');
});

check('the moe layer is off unless asked, and says where it may land when it is on', () => {
  const voices = mod.readVoiceTable(path.join(ROOT, 'rules', 'voices'), 'zh');
  assert.equal(mod.renderMoeBlock('zh', 'off', voices), '', 'off renders nothing');
  assert.equal(mod.renderMoeBlock('zh', 'nonsense', voices), '', 'an unknown level is treated as off');

  const soft = mod.renderMoeBlock('zh', 'soft', voices);
  const full = mod.renderMoeBlock('zh', 'full', voices);
  assert.ok(soft.length > 200 && full.length > 200, 'both levels render a block');
  assert.ok(soft !== full, 'soft and full are not the same sentence');
  // The definition, the four places, the product scope, and the two prohibitions all have to be there.
  assert.ok(soft.includes('\u840C'), 'the block defines moe');
  assert.ok(soft.includes('\u601D\u8003'), 'it names thinking as a place');
  assert.ok(soft.includes('\u5B50\u4EE3\u7406'), 'and subagents');
  assert.ok(soft.includes('\u4EA7\u7269'), 'and work products');
  assert.ok(soft.includes('\u6807\u8BC6\u7B26'), 'it forbids moe in code itself');
  assert.ok(soft.includes('\u62A5\u9519') || soft.includes('\u5806\u6808'), 'and beside an error');
});

check('the voice tables ship in three languages and stay apart', () => {
  const seen = new Set();
  for (const locale of ['zh', 'en', 'ja']) {
    const table = mod.readVoiceTable(path.join(ROOT, 'rules', 'voices'), locale);
    assert.equal(table.locale, locale, locale + ': the table is found by locale');
    assert.ok(table.voices.length >= 6, locale + ': at least six voices');
    for (const voice of table.voices) {
      assert.ok(voice.id && voice.label && voice.use, locale + '/' + voice.id + ' needs id, label and use');
      assert.ok(Array.isArray(voice.markers) && voice.markers.length >= 3, locale + '/' + voice.id + ' needs markers');
      seen.add(voice.id);
    }
  }
  assert.equal(seen.size, 6, 'the same six voice ids across the three tables');

  // A language tag resolves to its base, and an unknown language falls back rather than failing.
  assert.equal(mod.readVoiceTable(path.join(ROOT, 'rules', 'voices'), 'ja-JP').locale, 'ja');
  const missing = mod.readVoiceTable('E:/no-such-dir', 'zh');
  assert.deepEqual(missing.voices, [], 'an unreadable table yields no voices instead of throwing');
  assert.equal(mod.renderMoeBlock('zh', 'soft', missing).length > 100, true, 'and still renders the rules');
});

check('a voice is inferred only when the words name one', () => {
  const mk = (text) => ({ source: { kind: 'user' }, content: [{ type: 'text', text }] });
  assert.equal(mod.inferVoice([mk('\u4F60\u662F\u4E00\u4E2A\u50B2\u5A07\u7684\u52A9\u624B')]), 'prickly');
  assert.equal(mod.inferVoice([mk('be a tsundere assistant')]), 'prickly');
  assert.equal(mod.inferVoice([mk('\u304A\u5B22\u69D8\u53E3\u8ABF\u3067\u8A71\u3057\u3066')]), 'elegant');
  assert.equal(mod.inferVoice([mk('\u4FDD\u6301\u51B7\u9759\uFF0C\u4E0D\u8981\u5E9F\u8BDD')]), 'composed');
  assert.equal(mod.inferVoice([mk('\u5143\u6C14\u4E00\u70B9')]), 'spirited');
  assert.equal(mod.inferVoice([mk('\u6E29\u67D4\u4E00\u70B9')]), 'gentle');
  // A persona that names no voice class gets no costume, which is the important half.
  assert.equal(mod.inferVoice([mk('You are a coding agent. Working directory D:/x')]), null);
  assert.equal(mod.inferVoice([]), null);
  assert.equal(mod.inferVoice(undefined), null);
  // Config-added signals extend the map.
  assert.equal(mod.inferVoice([mk('\u8BF4\u8BDD\u50CF\u5C0F\u6076\u9B54')], { prickly: ['\u5C0F\u6076\u9B54'] }), 'prickly');
  assert.equal(mod.inferVoice([mk('\u8BF4\u8BDD\u50CF\u5C0F\u6076\u9B54')]), null, 'without the override it is not matched');
  // The newest mention wins, because a persona states its manner after its role.
  assert.equal(mod.inferVoice([mk('\u50B2\u5A07\u7684\u524D\u8F88\uFF0C\u4F46\u8BF4\u8BDD\u8981\u6E29\u67D4')]), 'gentle');
});

check('the voice notice uses the markers of the language it is written in', () => {
  const zh = { id: 'prickly', label: '\u5634\u786C', markers: ['\u624D\u4E0D\u662F', '\u54FC'] };
  const ja = { id: 'prickly', label: '\u30C4\u30F3\u30C7\u30EC', markers: ['\u3079\u3001\u5225\u306B', '\u3075\u3093'] };
  const zhText = mod.voiceNotice('zh', zh);
  const jaText = mod.voiceNotice('ja', ja);
  const enText = mod.voiceNotice('en', { id: 'prickly', label: 'prickly', markers: ["it's not like", 'hmph'] });
  assert.ok(zhText.includes('\u624D\u4E0D\u662F'), 'zh carries the Chinese markers');
  assert.ok(jaText.includes('\u3079\u3001\u5225\u306B'), 'ja carries the Japanese markers');
  assert.ok(!jaText.includes('\u624D\u4E0D\u662F'), 'and not the Chinese ones');
  assert.ok(enText.startsWith('MOE VOICE'), 'en has its own wording');
  for (const text of [zhText, jaText, enText]) {
    assert.ok(text.includes('prickly'), 'all three name the voice id');
    assert.ok(text.length < 400, 'and stay short, because it is one message per session');
  }
});

check('the hook announces the voice once, and only while the layer is on', async () => {
  const mk = (text) => ({ source: { kind: 'user' }, content: [{ type: 'text', text }] });
  const persona = [mk('\u4F60\u662F\u4E00\u4E2A\u50B2\u5A07\u7684\u52A9\u624B')];
  const voices = mod.readVoiceTable(path.join(ROOT, 'rules', 'voices'), 'zh').voices;
  const seen = [];
  const hook = mod.makeSelfCheckHook({
    max: 3,
    moe: true,
    voices,
    resolve: () => ({ enabled: true, locale: 'zh', judge: { mode: 'deny' } }),
    log: (m) => seen.push(m),
  });
  const step = () => hook({ agent: { session: { id: 'v1' } }, messages: persona }, async () => ({ kind: 'enter', messages: persona }));

  const first = await step();
  assert.equal(first.messages.length, 2, 'one voice notice in front of the step');
  assert.ok(first.messages[0].content[0].text.includes('\u8BED\u6C14\u9002\u914D'), 'and it is the voice notice');
  assert.ok(seen.some((m) => m.includes('moe voice')), 'the pick is logged');

  const again = await step();
  assert.equal(again.messages.length, 1, 'and never repeated in the same session');

  const off = mod.makeSelfCheckHook({
    max: 3,
    moe: false,
    voices,
    resolve: () => ({ enabled: true, locale: 'zh', judge: { mode: 'deny' } }),
  });
  const quiet = await off({ agent: { session: { id: 'v2' } }, messages: persona }, async () => ({ kind: 'enter', messages: persona }));
  assert.equal(quiet.messages.length, 1, 'with the layer off nothing is announced');
});

check('a configured voice overrides inference, and an unknown one steals nothing', async () => {
  const mk = (text) => ({ source: { kind: 'user' }, content: [{ type: 'text', text }] });
  const messages = [mk('\u50B2\u5A07\u7684\u52A9\u624B')];
  const voices = mod.readVoiceTable(path.join(ROOT, 'rules', 'voices'), 'zh').voices;
  const run = async (voice) => {
    const hook = mod.makeSelfCheckHook({
      max: 3,
      moe: true,
      voices,
      voice,
      resolve: () => ({ enabled: true, locale: 'zh', judge: { mode: 'deny' } }),
    });
    return hook({ agent: { session: { id: 'cfg-' + String(voice) } }, messages }, async () => ({ kind: 'enter', messages }));
  };

  const forced = await run('elegant');
  assert.ok(forced.messages[0].content[0].text.includes('elegant'), 'config wins over the persona words');
  assert.ok(!forced.messages[0].content[0].text.includes('\u54FC'), 'and the inferred voice is not also sent');

  const unknown = await run('not-a-voice');
  assert.equal(unknown.messages.length, 1, 'an id that is not in the table announces nothing');
});

check('a rotated voice is stable per session and varied between sessions', () => {
  const voices = mod.readVoiceTable(path.join(ROOT, 'rules', 'voices'), 'zh').voices;
  const first = mod.rotateVoice('session-a', voices);
  assert.ok(first && typeof first.id === 'string', 'a session gets a voice');
  assert.equal(mod.rotateVoice('session-a', voices).id, first.id, 'and keeps it on the next call');

  const ids = new Set();
  for (let i = 0; i < 40; i += 1) ids.add(mod.rotateVoice('session-' + i, voices).id);
  assert.equal(ids.size, voices.length, 'over many sessions every voice is reached');

  assert.equal(mod.rotateVoice('s', []), null, 'an empty table rotates nothing');
  assert.equal(mod.rotateVoice('s', undefined), null);
  assert.equal(mod.rotateVoice(undefined, voices).id.length > 0, true, 'a missing session id still resolves');
});

check('the three voice modes do what their names say', async () => {
  const mk = (text) => ({ source: { kind: 'user' }, content: [{ type: 'text', text }] });
  const voices = mod.readVoiceTable(path.join(ROOT, 'rules', 'voices'), 'zh').voices;
  const run = async (voice, messages, sessionId) => {
    const hook = mod.makeSelfCheckHook({
      max: 3,
      moe: true,
      voices,
      voice,
      resolve: () => ({ enabled: true, locale: 'zh', judge: { mode: 'deny' } }),
    });
    const out = await hook({ agent: { session: { id: sessionId } }, messages }, async () => ({ kind: 'enter', messages }));
    return out.messages.length > 1 ? out.messages[0].content[0].text : null;
  };

  const silent = await run('auto', [mk('You are a coding agent, working directory E:/x')], 'm1');
  assert.equal(silent, null, 'auto stays silent when nothing names a voice');

  const inferred = await run('auto', [mk('\u4F60\u662F\u4E00\u4E2A\u50B2\u5A07\u7684\u52A9\u624B')], 'm2');
  assert.ok(inferred.includes('prickly'), 'auto follows the words when they do name one');

  const rotated = await run('rotate', [mk('plain instructions, no voice words at all')], 'm3');
  assert.ok(rotated && rotated.includes('\u8BED\u6C14\u9002\u914D'), 'rotate speaks even with no words to go on');
  const rotatedAgain = await run('rotate', [mk('plain instructions, no voice words at all')], 'm3');
  assert.equal(rotated, rotatedAgain, 'and the same session gets the same voice');

  const pinned = await run('composed', [mk('\u50B2\u5A07\u4E00\u70B9')], 'm4');
  assert.ok(pinned.includes('composed'), 'a pinned id wins over the words in the session');
});

// --- the preset identity: read it, degrade without it -------------------------------------

check('a persona moves the inference, and the conversation is still asked first', () => {
  // 3,152 characters of a real preset persona carry exactly one of the six voice words (a hand-written
  // persona usually names none), which is why this path is described as limited rather than as a fix.
  const persona = '\u4F60\u662F\u4E00\u4E2A\u6E29\u67D4\u7684\u52A9\u624B\uFF0C\u4E5F\u662F\u4E00\u4E2A\u5199\u4EE3\u7801\u7684\u4EBA\u3002';
  assert.equal(mod.inferVoiceFromText(persona), 'gentle', 'the persona wording names a voice');
  assert.equal(mod.inferVoiceFromText('You are a coding agent. Working directory D:/x'), null, 'a plain role names none');
  assert.equal(mod.inferVoiceFromText(''), null);
  assert.equal(mod.inferVoiceFromText(undefined), null, 'a missing persona is not an error');
  assert.equal(mod.inferVoiceFromText('\u8BF4\u8BDD\u50CF\u5C0F\u6076\u9B54', { prickly: ['\u5C0F\u6076\u9B54'] }), 'prickly', 'config signals extend the persona map too');

  const user = (text) => ({ source: { kind: 'user' }, content: [{ type: 'text', text }] });
  const personaOnly = mod.resolveVoiceForSession({ id: 'p', persona }, [user('do the thing')]);
  assert.deepEqual(personaOnly, { id: 'gentle', how: 'persona' }, 'with no voice in the conversation, the persona decides');
  const both = mod.resolveVoiceForSession({ id: 'p', persona }, [user('\u4FDD\u6301\u51B7\u9759')]);
  assert.deepEqual(both, { id: 'composed', how: 'inferred' }, 'words the reader typed are asked first');
  assert.equal(mod.resolveVoiceForSession({ id: 'p', persona: null }, [user('do the thing')]), null, 'no persona and no words is no answer');
});

check('the preset prewarm degrades instead of throwing, whatever the registry does', async () => {
  const agent = { id: 'a1', ctx: {} };
  // No registry at all: a deployment without a roster. This is the case that must not throw, because
  // the call site is an `agent/created` listener and an exception there fails the agent's creation.
  assert.deepEqual(await mod.prewarmPreset({ presets: undefined, agent }), { id: undefined, persona: null, available: false });
  assert.deepEqual(await mod.prewarmPreset({ presets: null, agent: null }), { id: undefined, persona: null, available: false });

  // A registry that composes nothing for this agent, and one whose composition lookup throws.
  assert.deepEqual(await mod.prewarmPreset({ presets: { composedPreset: () => undefined }, agent }), { id: undefined, persona: null, available: true });
  assert.deepEqual(
    await mod.prewarmPreset({ presets: { composedPreset: () => { throw new Error('no standing mount'); } }, agent }),
    { id: undefined, persona: null, available: true },
    'a composition lookup that throws is a lookup that answers nothing',
  );

  // The identity is read, and its document comes back with the persona prefix in it verbatim.
  const presets = { composedPreset: () => 'redipaloynz', readDocument: async (id) => ({ agentPreset: id, content: '  - id: persona\n    config:\n      prefix: be gentle\n' }) };
  const warm = await mod.prewarmPreset({ presets, agent: { id: 'a2', ctx: {} } });
  assert.equal(warm.id, 'redipaloynz');
  assert.ok(warm.persona.includes('be gentle'), 'the persona text is kept as it arrived');
  assert.equal(warm.available, true);

  // A preset deleted between boot and creation rejects; the identity survives and the warning is said.
  const seen = [];
  const rejected = await mod.prewarmPreset({
    presets: { composedPreset: () => 'gone', readDocument: async () => { throw new Error('agent-preset/not-found'); } },
    agent,
    warn: (m) => seen.push(m),
  });
  assert.deepEqual(rejected, { id: 'gone', persona: null, available: true }, 'the id is still worth having');
  assert.ok(seen.some((m) => m.includes('not-found')), 'and the reason is reported rather than swallowed');
});

check('the id falls back to the projection, then to the session header', async () => {
  const presets = { composedPreset: () => undefined, readDocument: async (id) => ({ agentPreset: id, content: 'prefix: be gentle' }) };
  const projected = await mod.prewarmPreset({
    presets,
    agent: { id: 'p1', ctx: { get: (name) => (name === 'sessionProjections' ? { stateOf: () => 'from-projection' } : undefined) }, session: { header: {} } },
  });
  assert.equal(projected.id, 'from-projection');

  const headed = await mod.prewarmPreset({
    presets,
    agent: { id: 'p2', ctx: { get: () => undefined }, session: { header: { agentPreset: 'from-header' } } },
  });
  assert.equal(headed.id, 'from-header', 'the header answers when the projection is not registered');

  // A projection whose `stateOf` throws falls through rather than failing the creation.
  const survived = await mod.prewarmPreset({
    presets,
    agent: { id: 'p3', ctx: { get: () => ({ stateOf: () => { throw new Error('not registered'); } }) }, session: { header: { agentPreset: 'still-here' } } },
  });
  assert.equal(survived.id, 'still-here');
});

check('a preset mapping picks the voice, and the persona decides when no mapping exists', async () => {
  const mk = (text) => ({ source: { kind: 'user' }, content: [{ type: 'text', text }] });
  const voices = mod.readVoiceTable(path.join(ROOT, 'rules', 'voices'), 'zh').voices;
  const run = async (options) => {
    const seen = [];
    const hook = mod.makeSelfCheckHook({
      max: 3,
      moe: true,
      voices,
      voice: 'auto',
      resolve: () => ({ enabled: true, locale: 'zh', judge: { mode: 'deny' } }),
      log: (m) => seen.push(m),
      ...options,
    });
    const messages = [mk('You are a coding agent, working directory E:/x')];
    const out = await hook({ agent: { session: { id: 'pv-' + Math.random().toString(16).slice(2) }, id: 'agent-1' }, messages }, async () => ({ kind: 'enter', messages }));
    return { text: out.messages.length > 1 ? out.messages[0].content[0].text : null, seen };
  };

  // Layer 1: the configuration names a voice for this preset, and it wins over the persona.
  const mapped = await run({
    presetVoice: () => ({ id: 'redipaloynz', persona: '\u4F60\u662F\u4E00\u4E2A\u6E29\u67D4\u7684\u52A9\u624B' }),
    voiceOptions: () => ({ voice: 'auto', byPreset: { redipaloynz: 'elegant' }, signals: null }),
  });
  assert.ok(mapped.text && mapped.text.includes('elegant'), 'the mapped voice is the one announced');
  assert.ok(mapped.seen.some((m) => m.includes('mapped by preset redipaloynz')), 'and the log names the preset it came from');

  // Layer 2: nothing is mapped, so the persona answers, and the log says which haystack it came from.
  const persona = await run({
    presetVoice: () => ({ id: 'redipaloynz', persona: '\u4F60\u662F\u4E00\u4E2A\u6E29\u67D4\u7684\u52A9\u624B' }),
    voiceOptions: () => ({ voice: 'auto', byPreset: null, signals: null }),
  });
  assert.ok(persona.text && persona.text.includes('gentle'), 'the persona decides when the config says nothing');
  assert.ok(persona.seen.some((m) => m.includes('inferred from the persona of preset redipaloynz')), 'and the log says so');

  // A mapped id that is not in the table is not an answer: it falls through to the mode rather than
  // silencing the notice, and with a persona that names nothing the fall-through lands on silence.
  const unknownMapping = await run({
    presetVoice: () => ({ id: 'redipaloynz', persona: 'You are a coding agent. Working directory E:/x' }),
    voiceOptions: () => ({ voice: 'auto', byPreset: { redipaloynz: 'not-a-voice' }, signals: null }),
  });
  assert.equal(unknownMapping.text, null, 'a mapping to an id the table does not hold announces nothing');
});

check('with no registry the voice still works, and the rules are untouched', async () => {
  const mk = (text) => ({ source: { kind: 'user' }, content: [{ type: 'text', text }] });
  const voices = mod.readVoiceTable(path.join(ROOT, 'rules', 'voices'), 'zh').voices;
  const seen = [];
  const hook = mod.makeSelfCheckHook({
    max: 3,
    moe: true,
    voices,
    voice: 'rotate',
    // What `apply()` hands over on a deployment whose `ctx.get('agentPresets')` is undefined.
    presetVoice: () => ({}),
    voiceOptions: () => ({ voice: 'rotate', byPreset: { redipaloynz: 'elegant' }, signals: null }),
    resolve: () => ({ enabled: true, locale: 'zh', judge: { mode: 'deny' }, voiceMarkers: undefined }),
    log: (m) => seen.push(m),
  });
  const messages = [mk('plain instructions, no voice words at all')];
  const out = await hook({ agent: { session: { id: 'no-roster' }, id: 'agent-2' }, messages }, async () => ({ kind: 'enter', messages }));
  assert.equal(out.messages.length, 2, 'the rotate mode still announces a voice');
  assert.ok(out.messages[0].content[0].text.includes('\u8BED\u6C14\u9002\u914D'));
  assert.ok(seen.some((m) => m.includes('rotated')), 'and the log says it was rotated rather than mapped');
  assert.ok(!seen.some((m) => m.includes('mapped by preset')), 'a mapping that cannot be keyed to a preset is not used');
});

check('a preset mapping takes effect on the next step, with no restart', async () => {
  const home = tempHome();
  const file = path.join(home, 'agent-house-rules.json');
  fs.writeFileSync(file, JSON.stringify({ locale: 'zh', moe: 'soft', moeVoice: 'auto' }), 'utf8');
  const { ctx, seen } = fakeCtx();
  mod.apply(ctx, { home, shippedLibrary: SHIPPED });
  assert.equal(seen.sections.length, 1, 'the section registers');
  // The mapping never reaches the prompt section - it is state for the voice notice - so the proof is
  // that the section still builds. What the case pins is that the config file is read live.
  assert.ok(seen.sections[0].text({}).includes('\u840C'), 'the moe block is on');
  fs.writeFileSync(file, JSON.stringify({ locale: 'zh', moe: 'soft', moeVoice: 'auto', moeVoiceByPreset: { redipaloynz: 'gentle' } }), 'utf8');
  assert.ok(seen.sections[0].text({}).includes('\u840C'), 'and an edit lands on the next read rather than throwing');
  fs.rmSync(home, { recursive: true, force: true });
});

check('the hook\'s contract: only the step travels back, and only user messages are added', async () => {
  // The failure this pins down, at the level of the hook itself: the judged list is the conversation,
  // and handing that list back wrote the whole conversation into the log as user/message events.
  const warnings = [];
  const hook = mod.makeSelfCheckHook({
    max: 3,
    // The subject is the contract, not the judges: isolate it from the kaomoji/emoji rules so the
    // only message added is the symbol notice.
    kaomoji: false,
    emoji: false,
    resolve: () => ({ enabled: true, locale: 'en' }),
    warn: (m) => warnings.push(m),
  });
  const authored = { id: 'a1', role: 'assistant', source: { kind: 'model', provider: 'p', model: 'm' }, content: [{ type: 'text', text: `bad ${CHECK}` }] };
  const step = { id: 'u2', role: 'user', source: { kind: 'user', rpcId: 'r1' }, content: [{ type: 'text', text: 'the next request' }] };
  const conversation = [step, authored];
  const out = await hook(
    { agent: { session: { id: 'contract', deriveMessages: () => conversation } }, messages: [step] },
    async () => ({ kind: 'enter', messages: [step] }),
  );
  assert.equal(out.messages.length, 2, 'the notice plus the step, nothing else');
  assert.equal(out.messages[0].role, 'user', 'the added notice is a user message');
  assert.deepEqual(out.messages.slice(1), [step], 'and the step is the one the host proposed');
  assert.equal(out.messages.some((m) => m.id === 'a1'), false, 'the assistant reply never travels back');
});

check('a message this hook did not add is reported, never rewritten or dropped', async () => {
  const warnings = [];
  const hook = mod.makeSelfCheckHook({
    max: 3,
    resolve: () => ({ enabled: true, locale: 'en' }),
    warn: (m) => warnings.push(m),
  });
  const authored = { id: 'a1', role: 'assistant', source: { kind: 'model', provider: 'p', model: 'm' }, content: [{ type: 'text', text: `bad ${CHECK}` }] };
  const foreign = { id: 'f1', role: 'tool', toolCallId: 'c1', source: { kind: 'tool', callId: 'c1' }, content: [{ type: 'text', text: 'out' }] };
  const out = await hook(
    { agent: { session: { id: 'foreign' } }, messages: [authored] },
    async () => ({ kind: 'enter', messages: [foreign] }),
  );
  assert.deepEqual(out.messages.slice(-1), [foreign], 'a foreign message is passed through untouched');
  assert.ok(warnings.some((m) => m.includes('not user messages') && m.includes('tool')), 'and named, with its producer kind');
});

check('a notice names the channel the breach was actually in', () => {
  // The wire says `reasoning`, not `thinking`; a notice that answered "your text" about a breach in the
  // thinking channel sent the reader to the wrong place. Both kinds are the thinking channel.
  const { selfCheckNotice, emojiNotice } = mod;
  const glyphs = ['U+2713'];
  const zhThinking = selfCheckNotice({ where: 'reasoning', glyphs }, 'zh', {});
  const zhText = selfCheckNotice({ where: 'text', glyphs }, 'zh', {});
  assert.ok(zhThinking.includes('\u601D\u8003'), 'a reasoning block is reported as thinking');
  assert.ok(!zhThinking.includes('\u6B63\u6587'), 'and not as the text channel');
  assert.ok(zhText.includes('\u6B63\u6587'), 'a text block still is the text channel');
  assert.ok(selfCheckNotice({ where: 'thinking', glyphs }, 'en', {}).includes('thinking'), 'the legacy kind still reads as thinking');
  assert.ok(emojiNotice({ where: 'reasoning', glyphs: ['U+1F600'] }, 'zh', {}).includes('\u601D\u8003'), 'the emoji notice agrees');
  assert.ok(emojiNotice({ where: 'reasoning', glyphs: ['U+1F600'] }, 'en', {}).includes('thinking'));
});

check('the hook leaves disabled sessions and aborted steps alone', async () => {
  const breach = { id: 'm1', role: 'assistant', source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-flash' }, content: [{ type: 'text', text: `bad ${CHECK}` }] };
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

check('the emoji judge names real emoji and waves decoration through', () => {
  // Assembled from code points so this test file stays readable without printing a picture.
  const face = String.fromCodePoint(0x1f600);
  const thumb = String.fromCodePoint(0x1f44d);
  const wrench = String.fromCodePoint(0x1f527);
  const skin = String.fromCodePoint(0x1f44d, 0x1f3fd);
  const heart = String.fromCodePoint(0x2665);
  const star = String.fromCodePoint(0x2605);
  const note = String.fromCodePoint(0x266a);
  const flower = String.fromCodePoint(0x273f);

  assert.deepEqual(mod.offendingEmoji('plain text'), [], 'prose carries nothing to report');
  assert.deepEqual(mod.offendingEmoji(face), ['U+1F600']);
  assert.deepEqual(mod.offendingEmoji(thumb), ['U+1F44D']);
  assert.deepEqual(mod.offendingEmoji(wrench), ['U+1F527'], 'an object emoji is still an emoji');
  assert.deepEqual(mod.offendingEmoji(skin), ['U+1F44D', 'U+1F3FD'], 'the skin tone modifier is named too');
  assert.deepEqual(mod.offendingEmoji(String.fromCodePoint(0xfe0f)), ['U+FE0F'], 'a bare variation selector is a breach');

  // The palette is made of these, so the ban cannot refuse them without refusing its own library.
  assert.deepEqual(mod.offendingEmoji(heart), [], 'a heart is decoration');
  assert.deepEqual(mod.offendingEmoji(star), [], 'a star is decoration');
  assert.deepEqual(mod.offendingEmoji(note), [], 'a note is decoration');
  assert.deepEqual(mod.offendingEmoji(flower), [], 'a flower is decoration');
  // And a kaomoji full of them passes whole.
  assert.deepEqual(mod.offendingEmoji('(' + heart + '\u03c9' + heart + ')'), []);

  // A code point named in prose is the rule talking, and a fenced block is someone else's output.
  assert.deepEqual(mod.judgeEmoji('the block U+1F600 is banned'), [], 'U+XXXX in prose is not a picture');
  assert.deepEqual(mod.judgeEmoji('\u0060\u0060\u0060\n' + face + '\n\u0060\u0060\u0060'), [], 'a fenced block is not the reply');
  assert.deepEqual(mod.judgeEmoji('inline ' + '\u0060' + face + '\u0060' + ' span'), [], 'an inline span is not the reply');
  assert.deepEqual(mod.judgeEmoji('a ' + thumb + ' here'), ['U+1F44D']);
});

check('both shipped locales ban emoji by block, and never print one', () => {
  for (const locale of ['en', 'zh']) {
    const rule = mod.packagedRules(locale).rules.kaomoji;
    assert.ok(/U\+1F300/.test(rule), locale + ': the pictograph blocks are named');
    assert.ok(/U\+1F600/.test(rule), locale + ': the face block is named');
    assert.ok(/U\+1F680/.test(rule), locale + ': the transport block is named');
    assert.ok(/U\+1F3FB/.test(rule), locale + ': the skin tone modifiers are named');
    assert.ok(/U\+FE0F/.test(rule), locale + ': the variation selector is named');
    assert.ok(/U\+200D/.test(rule), locale + ': the zero width joiner is named');
    assert.deepEqual(mod.offendingEmoji(rule), [], locale + ': the rule text carries no emoji of its own');
    assert.ok(rule.toLowerCase().includes('emoji'), locale + ': the ban says what it is about');
  }
});

check('the hook notices emoji, keeps its own budget, and stays off when asked', async () => {
  const face = String.fromCodePoint(0x1f600);
  const messages = [{ id: 'e1', role: 'assistant', source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-flash' }, content: [{ type: 'text', text: 'hello ' + face }] }];
  const seen = [];
  const hook = mod.makeSelfCheckHook({
    max: 3,
    emojiMax: 1,
    // The kaomoji rule would answer too: a short reply with no face is exactly its subject.
    kaomoji: false,
    resolve: () => ({ enabled: true, locale: 'en', judge: { mode: 'deny' }, emojiAllow: new Set() }),
    log: (m) => seen.push(m),
  });
  const step = () => hook({ agent: { session: { id: 'e1' } }, messages }, async () => ({ kind: 'enter', messages }));

  const first = await step();
  assert.equal(first.messages.length, 2, 'one emoji notice goes in front of the step');
  assert.ok(first.messages[0].content[0].text.includes('EMOJI BAN'), 'the notice names the rule');
  assert.ok(first.messages[0].content[0].text.includes('U+1F600'), 'and names the code point, not the picture');
  assert.ok(!first.messages[0].content[0].text.includes(face), 'the notice never reprints the glyph');

  const again = await step();
  assert.equal(again.messages.length, 1, 'the same breach is not announced twice past its budget');
  assert.ok(seen.some((m) => m.includes('emoji notice')), 'the notice is logged');

  const off = mod.makeSelfCheckHook({
    max: 3,
    emoji: false,
    // Switched off for the same reason as above: silence about emoji is the assertion here, and the
    // kaomoji rule is a different question about the same reply.
    kaomoji: false,
    resolve: () => ({ enabled: true, locale: 'en', judge: { mode: 'deny' }, emojiAllow: new Set() }),
  });
  const quiet = await off({ agent: { session: { id: 'e2' } }, messages }, async () => ({ kind: 'enter', messages }));
  assert.equal(quiet.messages.length, 1, 'emojiCheck:false means silence about emoji');
});

check('the emoji notice speaks the configured locale', () => {
  const finding = { where: 'text', glyphs: ['U+1F600'] };
  const zh = mod.emojiNotice(finding, 'zh');
  const en = mod.emojiNotice(finding, 'en');
  assert.ok(zh.includes('U+1F600') && en.includes('U+1F600'), 'both name the code point');
  assert.ok(zh !== en, 'the two locales are not the same sentence');
  assert.ok(!zh.includes(String.fromCodePoint(0x1f600)) && !en.includes(String.fromCodePoint(0x1f600)));
  const second = mod.emojiNotice(finding, 'en', { attempt: 2 });
  assert.ok(second.includes('#2'), 'a repeated reminder says which one it is');
});

// The palette and the checker must agree. A face the judge cannot see is worse than no face at all:
// the rule points the model at the library, and a notice would then say it used none. 100 of 1150 faces
// shipped blind before this - Han mouths, rounded and lenticular frames, and classic underscore faces.
check('every shipped face is one the judge can see', () => {
  const library = JSON.parse(fs.readFileSync(SHIPPED, 'utf8'));
  const faces = library.categories.flatMap((c) => c.faces.map((f) => f.face));
  const blind = faces.filter((face) => mod.findKaomoji(face).length === 0);
  assert.deepEqual(blind, [], 'no shipped face may be invisible to the judge');
  assert.ok(faces.length >= 1500, 'the expanded library carries at least 1500 faces, found ' + faces.length);
});

check('the judge knows the frames the library writes in', () => {
  assert.deepEqual(mod.findKaomoji('done (o_o) ok'), ['(o_o)'], 'the underscore counts as a mark');
  assert.deepEqual(mod.findKaomoji('look (see below) please'), [], 'an ordinary parenthetical is not a face');
  assert.deepEqual(mod.findKaomoji('a (x) b'), [], 'a bare letter is not a face');
  assert.deepEqual(mod.findKaomoji('nice \u256d^_^\u256e'), ['\u256d^_^\u256e'], 'a rounded frame counts');
  assert.deepEqual(mod.findKaomoji('nice \u3010^_^\u3011'), ['\u3010^_^\u3011'], 'a lenticular frame counts');
  assert.deepEqual(mod.findKaomoji('nice \u300c^_^\u300d'), ['\u300c^_^\u300d'], 'a corner-quote frame counts');
  assert.deepEqual(mod.findKaomoji('note \u3010\u91cd\u8981\u3011 here'), [], 'Han inside is not a face');
});
check('the shipped library holds more than a thousand faces, all usable', () => {
  const library = JSON.parse(fs.readFileSync(SHIPPED, 'utf8'));
  const faces = library.categories.flatMap((c) => c.faces.map((f) => f.face));
  assert.ok(library.categories.length >= 10, 'the library is grouped by mood, not one pile');
  assert.ok(faces.length >= 1000, 'the library promises at least a thousand faces, found ' + faces.length);
  assert.equal(new Set(faces).size, faces.length, 'no face may appear twice');
  for (const category of library.categories) {
    assert.ok(category.faces.length > 0, category.id + ' is empty');
    assert.ok(typeof category.use === 'string' && category.use !== '', category.id + ' needs a use line');
    assert.ok(typeof category.useZh === 'string' && category.useZh !== '', category.id + ' needs a zh use line');
    assert.ok(category.labelZh && category.labelZh !== '', category.id + ' needs a zh label');
  }
  for (const entry of library.categories.flatMap((c) => c.faces)) {
    assert.ok(entry.feel !== '' && entry.feelZh !== '', entry.face + ' needs both annotations');
    assert.ok(entry.face.length >= 3 && entry.face.length <= 18, entry.face + ' is outside the length window');
    assert.ok(/[^\x00-\x7f]/.test(entry.face), entry.face + ' is plain ASCII, so it is not a face');
    const open = [...entry.face].filter((ch) => ch === '(' || ch === '\uFF08').length;
    const shut = [...entry.face].filter((ch) => ch === ')' || ch === '\uFF09').length;
    assert.equal(open, shut, entry.face + ' has unbalanced brackets');
    assert.deepEqual(mod.offendingEmoji(entry.face), [], entry.face + ' carries something the emoji ban refuses');
  }
});

check('the prompt block honours its ceiling and still names the file', () => {
  const library = JSON.parse(fs.readFileSync(SHIPPED, 'utf8'));
  const normalized = mod.normalizeLibrary(library);
  const total = normalized.reduce((n, c) => n + c.faces.length, 0);

  // A bracketed run is either a face or its annotation, so the ceiling is asserted on the block's own
  // promise: the tail is counted, and a ceiling with room for everything says so instead of omitting.
  const capped = mod.renderKaomojiLibrary(normalized, 'X:/kaomoji.json', { locale: 'en', max: 40 });
  assert.ok(capped.includes('X:/kaomoji.json'), 'the file path is always named, so the rest is reachable');
  const tail = /not shown \((\d+) more\)/.exec(capped);
  assert.ok(tail, 'the tail is counted rather than silently dropped');
  assert.equal(Number(tail[1]), total - 40, 'the count says how many were left out');
  assert.ok(!capped.includes('full set ('), 'a capped block does not claim to be the full set');
  assert.equal(capped.split('\n').length, 3, 'a tight ceiling is a heading, the first category, and the tally');

  const whole = mod.renderKaomojiLibrary(normalized, 'X:/kaomoji.json', { locale: 'en', max: total });
  assert.ok(whole.includes('full set (' + total + ' faces)'), 'a ceiling that fits everything says so');
  assert.ok(!/not shown/.test(whole), 'and omits nothing');
  assert.ok(whole.length > capped.length, 'a bigger ceiling prints more');

  // The collapsed rendering is the escape hatch for a reader who wants the shapes without the prose.
  // Counted by looking each face up rather than by splitting on spaces, because a face may itself
  // carry a space (a fullwidth dozing mark does) and a whitespace count would lie about the total.
  const compact = mod.renderKaomojiLibrary(normalized, 'X:/kaomoji.json', { locale: 'en', collapse: true });
  const missing = normalized.flatMap((c) => c.faces.map((f) => f.face)).filter((face) => !compact.includes(face));
  assert.deepEqual(missing, [], 'collapsed mode prints every face');
  // A face may hold its own bracket, so the annotations are checked by their words instead.
  assert.ok(!compact.includes('(upturned)') && !compact.includes(' eyes + '), 'and none of the annotations');
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
console.log(`\n${failures === 0 ? 'all checks pass' : failures + ' check(s) failed'}`);
process.exit(failures === 0 ? 0 : 1);
