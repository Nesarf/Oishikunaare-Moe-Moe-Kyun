/**
 * TastyLineOut - output house rules for every agent, from one global prompt section.
 *
 * A DSH profile-level plugin that registers exactly one system-prompt section. Because the
 * roster mounts a profile plugin once, the section covers every agent that joins the standing
 * scope: all presets, all workspaces, every new conversation, and subagents as well - without
 * touching a single preset file.
 *
 * Two rules ship today:
 *   1. Symbol discipline - no check-mark / cross judgement glyphs, in a reply or in a file the
 *      agent writes. Reason: those glyphs pollute context and regression parameters, and a file
 *      written today is read back into context tomorrow.
 *   2. Kaomoji habit - a light Japanese-style emoticon now and then in conversation, so the text
 *      reads like a person wrote it. Conversation only: never in files, code or commit messages.
 *
 * The rule text is data, not code: `rules/<locale>.json` next to this file holds the shipped
 * locales (en, zh), and `$DSH_HOME/agent-house-rules.json` overrides file, locale, either rule,
 * or the whole set. Nothing here is locale-locked, and nothing here is ASCII-only at runtime -
 * the source stays ASCII and the localized text is decoded from escapes (see scripts/check-ascii.mjs).
 *
 * The one design constraint worth keeping: THE RULE TEXT MUST NOT CARRY THE GLYPHS IT BANS.
 * A first cut listed them literally, and an agent quoting the rule printed the whole set back -
 * the rule became the pollution it exists to prevent. The ban therefore names Unicode code
 * points instead, and the risk is that an agent recites codepoints at someone. Encoding the rule
 * as an allow-list would close that too, and is the honest next step rather than a hidden one.
 *
 * @module TastyLineOut
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Cordis plugin name. */
export const name = 'TastyLineOut';

/** The prompt registry this row contributes to. */
export const inject = ['systemPrompt'];

/** Section placement: right after the persona, ahead of every tool description. */
const SECTION_ORDER = 50;

/** Stable section name, so a composition can find or replace it. */
const SECTION_NAME = 'tasty-line-out';

/** Shipped locale used when neither the config nor the ask says otherwise. */
const DEFAULT_LOCALE = 'en';

/** Home of this module, kept for diagnostics: the packaged rules live in this file's own source. */
const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Packaged rules, keyed by locale. Kept in source so a clone works with no data files at all;
 * `rules/<locale>.json` and `$DSH_HOME/agent-house-rules.json` both take precedence.
 */
const PACKAGED = {
  en: {
    bannedSymbols: [
      'OUTPUT SYMBOL DISCIPLINE. Do not use check-mark or cross glyphs in a reply, do not use them in any file you write,',
      'and do not use them in your own thinking either - the thinking transcript is context too, and it is re-read on later turns.',
      'The set meant here is the judgement-mark family: U+2713 / U+2714 (check marks), U+2717 / U+2718 (crosses),',
      'U+2705 (white heavy check mark), U+274C (cross mark), U+2611 / U+2612 (ballot box with check or with X),',
      'and U+00D7 used as a judgement mark. In other words: the little pictures that mean pass or fail - none of them.',
      'Reason: they pollute context and regression parameters. A file written today, and a thought recorded today, are both',
      'read back into context later, so the ban covers files and thinking, not just replies.',
      'Say it in words instead: pass / fail, works / broken, applied / not applied, yes / no, or just a normal sentence.',
    ].join('\n'),
    kaomoji: [
      'KAOMOJI HABIT. Use a light Japanese-style emoticon (kaomoji) in conversation now and then, so the text reads like',
      'a person wrote it rather than a machine emitting a report. You already know how to write them - this rule is only',
      'about dosage. One or two in a reply is the norm and a longer reply carrying three is natural; place them at the end',
      'and never wedged next to a stack trace, a table of numbers, or a serious conclusion. In your own thinking the same',
      'applies, and it is where the habit matters most: thinking is where the work happens.',
      'Natural beats frequent: skipping it when it does not fit is what makes it a habit, and one on every line is noise.',
      'Note: Western text emoticons such as the colon-parenthesis kind do not count; the ask is the Japanese kind.',
      'Scope: replies AND your own thinking. Never in file contents, code, commands, or commit messages.',
    ].join('\n'),
  },
  zh: {
    bannedSymbols: [
      '\u3010\u8F93\u51FA\u7B26\u53F7\u7EAA\u5F8B\u3011\u56DE\u590D\u91CC\u4E0D\u8981\u7528\uFF0C\u4F60\u5199\u51FA\u7684\u6587\u4EF6\u91CC\u4E0D\u8981\u7528\uFF0C\u4F60\u81EA\u5DF1\u7684\u601D\u8003\u91CC\u4E5F\u4E0D\u8981\u7528 \u2014\u2014 \u601D\u8003\u8FC7\u7A0B\u540C\u6837\u662F\u4E0A\u4E0B\u6587\uFF0C\u540E\u9762\u7684\u8F6E\u6B21\u4F1A\u518D\u8BFB\u5230\u5B83\u3002\u6240\u6307\u662F\u300C\u5BF9\u9519\u6807\u8BB0\u7C7B\u300D\u7B26\u53F7\uFF1A',
      'U+2713 / U+2714\uff08\u5bf9\u52fe\uff09\u3001U+2717 / U+2718\uff08\u53c9\uff09\u3001U+2705\uff08\u767d\u8272\u7c97\u5bf9\u52fe\uff09\u3001U+274C\uff08\u53c9\u53f7\uff09\u3001U+2611 / U+2612\uff08\u5e26\u6846\u5bf9\u52fe\u4e0e\u53c9\uff09\uff0c',
      '\u4ee5\u53ca U+00D7 \u4e58\u53f7\u5f53\u5bf9\u9519\u7b26\u53f7\u7528\u65f6\u3002\u6362\u53e5\u8bdd\u8bf4\uff1a\u5c4f\u5e55\u4e0a\u90a3\u4e9b\u8868\u793a\u300c\u901a\u8fc7 / \u4e0d\u901a\u8fc7\u300d\u7684\u56fe\u5f62\u7b26\u53f7\uff0c\u4e00\u4e2a\u90fd\u4e0d\u8981\u51fa\u73b0\u3002',
      '\u7406\u7531\u662F\u5B83\u4EEC\u4F1A\u6C61\u67D3\u4E0A\u4E0B\u6587\u4E0E\u56DE\u5F52\u53C2\u6570 \u2014\u2014 \u5199\u51FA\u7684\u6587\u4EF6\u3001\u8BB0\u4E0B\u7684\u601D\u8003\uFF0C\u65E5\u540E\u90FD\u4F1A\u88AB\u8BFB\u56DE\u4E0A\u4E0B\u6587\uFF0C\u6240\u4EE5\u6587\u4EF6\u4E0E\u601D\u8003\u91CC\u540C\u6837\u4E0D\u8BB8\u7528\u3002',
      '\u6539\u7528\u7eaf\u6587\u5b57\u8868\u8fbe\uff1a\u901a\u8fc7 / \u4e0d\u901a\u8fc7\u3001\u6210\u529f / \u5931\u8d25\u3001\u5df2\u751f\u6548 / \u672a\u751f\u6548\u3001\u662f / \u5426\uff0c\u6216\u76f4\u63a5\u7528\u6b63\u5e38\u53e5\u5b50\u8bf4\u660e\u3002',
    ].join('\n'),
    kaomoji: [
      '\u3010\u989c\u6587\u5b57\u4e60\u60ef\u3011\u5728\u5bf9\u8bdd\u91cc\u4e60\u60ef\u6027\u5730\u5e26\u4e00\u70b9\u65e5\u5f0f\u989c\u6587\u5b57\uff08\u989c\u6587\u5b57 / kaomoji\uff09\uff0c\u8ba9\u6587\u5b57\u6709\u6d3b\u4eba\u5473\uff0c\u522b\u50cf\u673a\u5668\u5410\u51fa\u6765\u7684\u62a5\u544a\u3002',
      '\u4F60\u4F1A\u5199\u65E5\u5F0F\u989C\u6587\u5B57\uFF0C\u4E0D\u9700\u8981\u770B\u8303\u4F8B\u4E5F\u80FD\u5199\u5BF9\uFF1B\u8FD9\u91CC\u53EA\u7EA6\u675F\u5206\u5BF8\u3002\u4E00\u6BB5\u56DE\u590D\u91CC\u5E26\u4E00\u4E24\u4E2A\u662F\u5E38\u6001\uFF0C\u957F\u4E00\u70B9\u7684\u56DE\u590D\u4E09\u4E2A\u4E5F\u81EA\u7136\uFF1B\u653E\u5728\u53E5\u672B\u6216\u6BB5\u672B\uFF0C\u4E0D\u5806\u780C\uFF0C',
      '\u5de5\u5177\u62a5\u9519\u3001\u4e25\u8083\u7ed3\u8bba\u3001\u6210\u6bb5\u7684\u4ee3\u7801\u6216\u6570\u636e\u65c1\u8fb9\u4e0d\u8981\u786c\u585e\u3002\u5199\u5f97\u81ea\u7136\u6bd4\u5199\u5f97\u591a\u91cd\u8981 \u2014\u2014 \u8be5\u6ca1\u6709\u7684\u65f6\u5019\u6ca1\u6709\uff0c\u624d\u662f\u4e60\u60ef\uff1b\u6bcf\u53e5\u90fd\u6302\u4e00\u4e2a\u5c31\u6210\u4e86\u566a\u97f3\u3002',
      '\u6ce8\u610f\uff1a\u5b57\u9762\u7684 `:)` `:D` \u8fd9\u7c7b\u897f\u5f0f\u8868\u60c5\u4e0d\u7b97\uff0c\u8981\u7684\u662f\u65e5\u5f0f\u989c\u6587\u5b57\u3002',
      '\u8303\u56F4\uFF1A**\u5BF9\u8BDD\u56DE\u590D\u4E0E\u4F60\u81EA\u5DF1\u7684\u601D\u8003**\u91CC\u90FD\u7528 \u2014\u2014 \u601D\u8003\u624D\u662F\u505A\u4E8B\u7684\u5730\u65B9\uFF0C\u6700\u4E0D\u8BE5\u50CF\u673A\u5668\u3002\u5199\u8FDB\u6587\u4EF6\u7684\u5185\u5BB9\u3001\u4EE3\u7801\u3001\u547D\u4EE4\u3001\u63D0\u4EA4\u4FE1\u606F\u4E00\u5F8B\u4E0D\u7528\u3002',
    ].join('\n'),
  },
};

/** The glyphs the ban names by code point. Used only to name them in text, never to print them. */
const JUDGEMENT_CODEPOINTS = ['U+2713', 'U+2714', 'U+2717', 'U+2718', 'U+2705', 'U+274C', 'U+2611', 'U+2612', 'U+00D7'];

/**
 * Resolve `$DSH_HOME`, falling back to the platform's usual location.
 * @returns {string} absolute path of the harness home directory.
 */
export function dshHome() {
  if (process.env.DSH_HOME && process.env.DSH_HOME.trim() !== '') return process.env.DSH_HOME.trim();
  const profile = process.env.USERPROFILE ?? process.env.HOME ?? '.';
  return path.join(profile, '.dsh');
}

/**
 * Read a JSON file, returning null instead of throwing: a broken rules file must never stop a host
 * from booting, because the plugin's whole job is to make every other agent behave.
 * @param {string} file - absolute path.
 * @returns {object | null} parsed object, or null when absent or unreadable.
 */
function readJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

/** Identity of a file's content as far as a cheap check can tell. */
function stampOf(file) {
  try {
    const stat = fs.statSync(file, { throwIfNoEntry: false });
    return stat ? `${stat.size}:${stat.mtimeMs}` : 'absent';
  } catch {
    return 'absent';
  }
}

/**
 * Pick the shipped locale, preferring an exact match, then the language part, then the default.
 * @param {string} wanted - requested locale, for example `zh-CN`.
 * @returns {{ locale: string, rules: { bannedSymbols: string, kaomoji: string } }} the choice.
 */
export function packagedRules(wanted) {
  const want = String(wanted ?? '').trim();
  if (want !== '' && Object.prototype.hasOwnProperty.call(PACKAGED, want)) return { locale: want, rules: PACKAGED[want] };
  const base = want.split('-')[0].toLowerCase();
  const hit = Object.keys(PACKAGED).find((key) => key.toLowerCase() === base);
  if (hit) return { locale: hit, rules: PACKAGED[hit] };
  return { locale: DEFAULT_LOCALE, rules: PACKAGED[DEFAULT_LOCALE] };
}

/**
 * Assemble the rule text from the packaged locale and the user configuration.
 *
 * Precedence, lowest to highest: the packaged constant for the chosen locale, then the user file -
 * where a `rules` object replaces both rules wholesale, `bannedSymbols` and `kaomoji` replace one
 * each, and an empty string disables that rule only.
 *
 * `rules/<locale>.json` is deliberately not an override layer. It exists as the shipped locales in
 * data form, generated from the same source as the constants, so reading both would be one decision
 * made twice; a user edits the constant or their own config, never a file the package installs.
 * @param {object} options - resolved inputs.
 * @param {object | null} options.userConfig - parsed `$DSH_HOME/agent-house-rules.json`.
 * @returns {{ text: string, locale: string, enabled: boolean, sources: string[] }} the assembled rules.
 */
export function buildRules(options) {
  const user = options.userConfig ?? {};
  const locale = typeof user.locale === 'string' && user.locale.trim() !== '' ? user.locale.trim() : DEFAULT_LOCALE;
  const chosen = packagedRules(locale);
  const sources = [`packaged:${chosen.locale}`];

  let banned = chosen.rules.bannedSymbols;
  let kaomoji = chosen.rules.kaomoji;
  if (user && (typeof user.rules === 'object' || typeof user.bannedSymbols === 'string' || typeof user.kaomoji === 'string')) {
    sources.push('user-config');
    const merged = merge(user, { bannedSymbols: banned, kaomoji }, sources);
    banned = merged.bannedSymbols;
    kaomoji = merged.kaomoji;
  }

  const extra = typeof user.append === 'string' ? user.append.trim() : '';
  const text = [banned, kaomoji, extra].map((part) => (typeof part === 'string' ? part.trim() : '')).filter((part) => part !== '').join('\n\n');
  return { text, locale: chosen.locale, enabled: user.enabled !== false && text !== '', sources };
}

/**
 * Overlay one level's rule over another.
 * @param {object} layer - the higher-precedence object.
 * @param {{ bannedSymbols: string, kaomoji: string }} base - the lower-precedence pair.
 * @param {string[]} sources - source list, appended to when `rules` is used.
 * @returns {{ bannedSymbols: string, kaomoji: string }} the merged pair.
 */
function merge(layer, base, sources) {
  const out = { ...base };
  if (layer.rules && typeof layer.rules === 'object') {
    if (typeof layer.rules.bannedSymbols === 'string') out.bannedSymbols = layer.rules.bannedSymbols;
    if (typeof layer.rules.kaomoji === 'string') out.kaomoji = layer.rules.kaomoji;
    if (!sources.includes('rules-object')) sources.push('rules-object');
  }
  if (typeof layer.bannedSymbols === 'string') out.bannedSymbols = layer.bannedSymbols;
  if (typeof layer.kaomoji === 'string') out.kaomoji = layer.kaomoji;
  return out;
}

/**
 * Build a rules resolver that re-reads the user configuration whenever the file changes.
 *
 * This is what makes rule text live. The prompt registry evaluates a section whose `text` is a
 * function on every model step, so a resolver here means an edit to the config file lands at the
 * next step of every running session and every new one, with no host restart. A string `text` would
 * be captured once at registration and would need a restart - which is exactly the wart this fixes.
 *
 * The stamp check keeps the hot path cheap: every step stats one small file, and only a real change
 * re-reads and rebuilds the text.
 * @param {object} options - resolved inputs.
 * @param {string} options.file - user configuration path.
 * @param {(message: string) => void} options.warn - warning sink.
 * @returns {() => { text: string, locale: string, enabled: boolean, sources: string[] }} the resolver.
 */
export function makeRulesResolver(options) {
  let stamp = null;
  let built = null;
  return () => {
    const current = stampOf(options.file);
    if (current !== stamp || built === null) {
      stamp = current;
      const userConfig = readJson(options.file);
      built = buildRules({ userConfig });
      if (userConfig === null && current !== 'absent') options.warn(`configuration at ${options.file} is unreadable; falling back to the packaged rules`);
    }
    return built;
  };
}

/**
 * Report whether a text carries any of the glyphs the ban names. Exported because it is the
 * assertion that keeps this plugin honest about its own wording.
 * @param {string} text - text to inspect.
 * @returns {string[]} the offending code points, empty when clean.
 */
export function offendingGlyphs(text) {
  const codes = new Set(JUDGEMENT_CODEPOINTS.map((cp) => Number.parseInt(cp.slice(2), 16)));
  const found = new Set();
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (codes.has(cp)) found.add('U+' + cp.toString(16).toUpperCase().padStart(4, '0'));
  }
  return [...found];
}

/**
 * Register the house-rules section.
 * @param {import('cordis').Context} ctx - plugin context (profile / agent plane).
 * @param {object} [config] - cordis row config; the JSON file is the supported surface.
 */
export function apply(ctx, config) {
  const row = config && typeof config === 'object' ? config : {};
  const home = typeof row.home === 'string' && row.home.trim() !== '' ? row.home.trim() : dshHome();
  const configFile = typeof row.configFile === 'string' && row.configFile.trim() !== ''
    ? row.configFile.trim()
    : path.join(home, 'agent-house-rules.json');

  const warn = (message) => {
    try {
      ctx.logger?.warn?.(`[house-rules] ${message}`);
    } catch {
      /* a logger that fails is not a reason for the discipline to fail */
    }
  };

  // The text is a function, not a string: the prompt registry evaluates it on every model step, so
  // a configuration edit lands at the next step of every running session without a host restart.
  const resolve = makeRulesResolver({ file: configFile, warn });
  const first = resolve();

  // A section registering without an `enabled` check reads better than one that is silently absent,
  // so the reason is logged once at boot even though the resolver owns the decision from then on.
  ctx.logger?.info?.(
    first.enabled
      ? `[house-rules] registered ${first.text.length} characters (locale=${first.locale}, sources=${first.sources.join(' > ')})`
      : '[house-rules] disabled; no rules injected',
  );

  ctx.effect(
    () =>
      ctx.systemPrompt.section({
        name: SECTION_NAME,
        order: SECTION_ORDER,
        text: (context) => {
          const built = resolve();
          if (!built.enabled) return '';
          void context;
          return built.text;
        },
      }),
    'TastyLineOut: house rules section',
  );
}
