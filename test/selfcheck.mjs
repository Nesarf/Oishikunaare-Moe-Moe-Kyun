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
  mod.apply(ctx, { home: tempHome() });
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
  assert.ok(!/kaomoji/i.test(built.text));
  assert.ok(built.text.includes('U+2713'));
});

check('the section carries a function, so the registry re-reads it every step', () => {
  const { ctx, seen } = fakeCtx();
  mod.apply(ctx, { home: tempHome() });
  assert.equal(typeof seen.sections[0].text, 'function');
});

check('editing the config file changes the prompt on the next read, with no restart', () => {
  const home = tempHome();
  const file = path.join(home, 'agent-house-rules.json');
  const { ctx, seen } = fakeCtx();
  mod.apply(ctx, { home });
  const read = () => seen.sections[0].text({});
  assert.ok(read().includes('U+2713'), 'packaged rules should arrive first');
  assert.ok(!read().includes('LIVE EDIT'), 'nothing should be there before the edit');

  // A different byte length, so the stamp check cannot miss the change.
  fs.writeFileSync(file, JSON.stringify({ append: 'LIVE EDIT APPLIED' }), 'utf8');
  assert.ok(read().endsWith('LIVE EDIT APPLIED'), 'the edit should land on the next read');
  fs.rmSync(home, { recursive: true, force: true });
});

check('enabled:false in the config empties the section at read time', () => {
  const home = tempHome();
  const file = path.join(home, 'agent-house-rules.json');
  fs.writeFileSync(file, JSON.stringify({ enabled: false }), 'utf8');
  const { ctx, seen } = fakeCtx();
  mod.apply(ctx, { home });
  assert.ok(seen.logs.some((l) => l.includes('disabled')));
  assert.equal(seen.sections[0].text({}), '', 'a disabled section contributes nothing');
  fs.rmSync(home, { recursive: true, force: true });
});

check('a broken config file falls back to the packaged rules instead of throwing', () => {
  const home = tempHome();
  const file = path.join(home, 'agent-house-rules.json');
  fs.writeFileSync(file, '{ this is not JSON', 'utf8');
  const { ctx, seen } = fakeCtx();
  mod.apply(ctx, { home });
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
  assert.ok(read().endsWith('APPENDED'));
  assert.ok(read().includes('\u3010'));
  fs.writeFileSync(file, JSON.stringify({ locale: 'en' }), 'utf8');
  assert.ok(!read().includes('\u3010'), 'switching locale should drop the Chinese text');
  assert.ok(!read().includes('APPENDED'), 'and drop an override that is no longer configured');
  fs.rmSync(home, { recursive: true, force: true });
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
