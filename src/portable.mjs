/**
 * The harness-free half of this package.
 *
 * Everything a host adapter needs and nothing a host owns: resolve the rules (packaged or from a
 * config file), judge text the way the prompt asks for, and render the notices that correct it. There
 * is no host import here and no host API - only node builtins and the pure core in `./index.js`.
 *
 * The split exists because the useful part of this package was never DeepSeek Harness specific: the
 * judges, the rule text, the kaomoji palette and the voice tables are data plus pure functions. What
 * ties them to a host is three things and only three - the hook names, the bundle metadata and the
 * `apply(ctx)` contract - and those live in `./index.js` for DSH, in `bin/mmk.mjs` for a shell, and in
 * `adapters/` for anything else.
 *
 * Reading a conversation and sending one are different jobs: this module judges messages, and it never
 * decides how they reach a host. An adapter that appends messages carries that risk, not this file.
 *
 * @module oishikunaare-moe-moe-kyun/portable
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  authoredParts,
  countBareRun,
  emojiNotice,
  findBannedInMessages,
  findEmojiInMessages,
  inferVoiceFromText,
  isAuthoredMessage,
  judgeAuthoredText,
  judgeEmoji,
  judgeKaomoji,
  kaomojiNotice,
  libraryPaths,
  makeRulesResolver,
  noticeMessage,
  readVoiceTable,
  renderKaomojiLibrary,
  resolveVoiceForSession,
  selfCheckNotice,
} from './index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Where the shipped data lives, resolved from this file rather than from a host. */
export function shippedPaths() {
  return {
    rulesDir: path.join(HERE, '..', 'rules'),
    library: path.join(HERE, '..', 'rules', 'kaomoji.json'),
    voices: path.join(HERE, '..', 'rules', 'voices'),
  };
}

/**
 * The home directory a configuration file is looked up in.
 * `MMK_HOME` first so the CLI works on a machine with no harness at all, then the harness home this
 * machine happens to use, then the user directory.
 * @returns {string} an absolute directory path.
 */
export function defaultHome() {
  const env = process.env.MMK_HOME ?? process.env.DSH_HOME;
  return typeof env === 'string' && env.trim() !== '' ? path.resolve(env.trim()) : os.homedir();
}

/** Read one JSON file, returning null when it is absent or unreadable rather than throwing. */
export function readJsonFile(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Resolve the rules, the palette, the judge and the voice settings once.
 *
 * Mirrors what the DSH adapter does at mount, so a shell, an MCP client and the plugin all judge with
 * the same configuration. The returned `resolve` re-reads the config and the palette on every call, so
 * an edit lands on the next use rather than at the next restart.
 *
 * @param {object} [options] - overrides, all optional.
 * @param {string} [options.home] - directory holding `agent-house-rules.json`.
 * @param {string} [options.configFile] - explicit configuration file.
 * @param {string} [options.shippedLibrary] - explicit palette file.
 * @param {(message: string) => void} [options.warn] - sink for configuration problems.
 * @returns {object} the resolved state plus `resolve()` to refresh it.
 */
export function resolveState(options = {}) {
  const home = options.home ?? defaultHome();
  const configFile = options.configFile ?? process.env.MMK_CONFIG ?? path.join(home, 'agent-house-rules.json');
  const shipped = shippedPaths();
  const shippedLibrary = options.shippedLibrary ?? shipped.library;
  const warnings = [];
  const warn = (message) => {
    warnings.push(message);
    try {
      options.warn?.(message);
    } catch {
      /* a sink that throws is not a reason to fail */
    }
  };
  const initial = readJsonFile(configFile) ?? {};
  const libraryFiles = libraryPaths(initial.kaomojiLibrary, shippedLibrary);
  const resolve = makeRulesResolver({ file: configFile, libraryFiles, shippedLibrary, warn });
  const first = resolve();
  return {
    ...first,
    home,
    configFile,
    shippedLibrary,
    libraryFiles,
    voicesDir: shipped.voices,
    warnings,
    resolve: () => ({ ...resolve(), home, configFile, shippedLibrary, libraryFiles, voicesDir: shipped.voices, warnings }),
  };
}

/** The voice table for a locale, read live so an edit lands on the next use. */
export function voiceTable(state, locale) {
  return readVoiceTable(state.voicesDir ?? shippedPaths().voices, locale ?? state.locale, null);
}

/**
 * Judge one authored text on all three alphabets.
 * @param {string} text - the text the model wrote.
 * @param {object} state - the resolved state from {@link resolveState}.
 * @param {number} [kaomojiFloor] - sentences per face the rule asks for.
 * @returns {{ glyphs: string[], emoji: string[], kaomoji: object }} the findings.
 */
export function judgeText(text, state, kaomojiFloor = 3) {
  return {
    glyphs: judgeAuthoredText(text, state.judge),
    emoji: judgeEmoji(text, { allow: state.emojiAllow }),
    kaomoji: judgeKaomoji(text, { floor: kaomojiFloor }),
  };
}

/**
 * Judge one message, using whichever content shape it carries.
 * @param {unknown} message - a message with `content` as a string or a list of parts.
 * @param {object} state - the resolved state.
 * @param {number} [kaomojiFloor] - sentences per face the rule asks for.
 * @returns {{ glyphs: string[], emoji: string[], kaomoji: object, authored: boolean, text: string }}
 */
export function judgeMessage(message, state, kaomojiFloor = 3) {
  const authored = isAuthoredMessage(message);
  const text = authoredParts(message?.content).filter((part) => part.kind === 'text' || part.kind === 'thinking'
    || part.kind === 'reasoning').map((part) => part.text).join('\n');
  if (!authored) return { glyphs: [], emoji: [], kaomoji: judgeKaomoji('', { floor: kaomojiFloor }), authored: false, text: '' };
  return { ...judgeText(text, state, kaomojiFloor), authored: true, text };
}

/**
 * The newest message the model authored, searching backwards.
 * @param {unknown[]} messages - a conversation in order.
 * @returns {object|null} the message, or null when the model wrote nothing.
 */
export function newestAuthored(messages) {
  if (!Array.isArray(messages)) return null;
  for (let index = messages.length - 1; index >= 0; index--) {
    if (isAuthoredMessage(messages[index])) return messages[index];
  }
  return null;
}

/** The code points a finding named, as the notice prints them. */
const glyphList = (findings) => [...new Set([...(findings.glyphs ?? []), ...(findings.emoji ?? [])])];

/**
 * Render the notices a correction should carry, in the order the plugin sends them.
 *
 * Only the text is produced: a host decides how a notice reaches the model (a message in DSH, a hook
 * reason in another harness, a line in a transcript review). Nothing here writes anything.
 *
 * @param {{ glyphs?: string[], emoji?: string[], kaomoji?: object }} findings - what the judge found.
 * @param {object} state - the resolved state.
 * @param {object} [options] - `attempt` numbers and a `bareRun` count for the kaomoji wording.
 * @returns {string[]} the notice texts, empty when there is nothing to say.
 */
export function noticesFor(findings, state, options = {}) {
  const locale = state.locale ?? 'en';
  const notices = [];
  const glyphs = findings.glyphs ?? [];
  if (glyphs.length > 0) {
    notices.push(selfCheckNotice({ key: 'api', where: 'text', glyphs }, locale, {
      attempt: options.glyphAttempt ?? 1,
      exclusion: state.judge?.exclusion ?? '',
    }));
  }
  const emoji = findings.emoji ?? [];
  if (emoji.length > 0) {
    notices.push(emojiNotice({ where: 'text', glyphs: emoji }, locale, { attempt: options.emojiAttempt ?? 1 }));
  }
  const verdict = findings.kaomoji;
  if (verdict && verdict.bare === true) {
    notices.push(kaomojiNotice(verdict, locale, {
      attempt: options.kaomojiAttempt ?? 1,
      bareRun: options.bareRun ?? 0,
    }));
  }
  return notices.filter((notice) => typeof notice === 'string' && notice !== '');
}

/**
 * The same walk the plugin uses, over a whole conversation instead of one step: the newest authored
 * breach on each alphabet, as the hook would find it.
 * @param {unknown[]} messages - a conversation in order.
 * @param {object} state - the resolved state.
 * @param {object} [options] - `kaomojiFloor` and the notice attempt numbers.
 * @returns {{ findings: object, notices: string[], glyphKey: string|null, emojiKey: string|null, bareRun: number }}
 */
export function reviewConversation(messages, state, options = {}) {
  const glyphFinding = findBannedInMessages(messages, state.judge);
  const emojiFinding = findEmojiInMessages(messages, { allow: state.emojiAllow });
  const newest = newestAuthored(messages);
  const kaomoji = judgeKaomoji(
    authoredParts(newest?.content).filter((part) => part.kind === 'text').map((part) => part.text).join('\n'),
    { floor: options.kaomojiFloor ?? 3 },
  );
  const findings = {
    glyphs: glyphFinding?.glyphs ?? [],
    emoji: emojiFinding?.glyphs ?? [],
    kaomoji,
  };
  return {
    findings,
    notices: noticesFor(findings, state, { ...options, bareRun: countBareRun(messages) }),
    glyphKey: glyphFinding?.key ?? null,
    emojiKey: emojiFinding?.key ?? null,
    bareRun: countBareRun(messages),
  };
}

/**
 * Decide which voice this conversation speaks in, without a host.
 *
 * Precedence matches the plugin: an explicit mapping for the preset, then the persona document, then
 * the configured mode. `rotate` stays a host concern (it hashes a session id) and is reported as-is.
 *
 * @param {object} input - `{ preset, persona, messages, state }`; only `state` is required.
 * @returns {{ id: string|null, how: string, voice: object|null }} the decision.
 */
export function voiceFor(input = {}) {
  const state = input.state ?? resolveState();
  const table = voiceTable(state, state.locale).voices;
  const entryFor = (id) => table.find((entry) => entry && entry.id === id) ?? null;
  const mapped = input.preset !== undefined && state.voiceByPreset
    ? state.voiceByPreset[input.preset]
    : undefined;
  if (typeof mapped === 'string') {
    const voice = entryFor(mapped);
    if (voice !== null) return { id: voice.id, how: `mapped by preset ${input.preset}`, voice };
  }
  const mode = state.voice ?? 'auto';
  if (mode === 'off' || table.length === 0) return { id: null, how: 'moe layer off or no voice table', voice: null };
  if (mode === 'auto' && typeof input.persona === 'string' && input.persona !== '') {
    const inferred = inferVoiceFromText(input.persona, state.voiceSignals ?? null);
    const voice = inferred === null ? null : entryFor(inferred.id ?? inferred);
    if (voice !== null) return { id: voice.id, how: 'inferred from the persona', voice };
  }
  if (mode === 'auto' && Array.isArray(input.messages)) {
    const voice = resolveVoiceForSession({ id: input.preset ?? null }, input.messages, {
      voice: mode,
      byPreset: state.voiceByPreset,
      signals: state.voiceSignals,
    });
    if (voice !== null) return { id: voice.id ?? null, how: 'resolved from the conversation', voice };
  }
  if (mode !== 'auto' && mode !== 'rotate') {
    const voice = entryFor(mode);
    if (voice !== null) return { id: voice.id, how: 'pinned in the configuration', voice };
  }
  return { id: null, how: `mode "${mode}" needs a session or a mapping`, voice: null };
}

/** Re-exported so an adapter needs one import, not two. */
export {
  authoredParts,
  isAuthoredMessage,
  judgeAuthoredText,
  judgeEmoji,
  judgeKaomoji,
  noticeMessage,
  renderKaomojiLibrary,
  glyphList,
};
