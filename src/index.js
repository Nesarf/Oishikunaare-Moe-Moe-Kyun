/**
 * Oishikunaare-Moe-Moe-Kyun - output house rules for every agent, from one global prompt section.
 *
 * A DSH profile-level plugin that registers exactly one system-prompt section. Because the
 * roster mounts a profile plugin once, the section covers every agent that joins the standing
 * scope: all presets, all workspaces, every new conversation, and subagents as well - without
 * touching a single preset file.
 *
 * Three rules ship today:
 *   1. Symbol discipline - no check-mark / cross judgement glyphs, in a reply or in a file the
 *      agent writes. Reason: those glyphs pollute context and regression parameters, and a file
 *      written today is read back into context tomorrow.
 *   2. Kaomoji habit - a light Japanese-style emoticon now and then in conversation, so the text
 *      reads like a person wrote it. Conversation only: never in files, code or commit messages.
 *   3. Thinking-language discipline - think and answer in the user's own language rather than
 *      defaulting to English, with English allowed only in the moe-fandom register. Reason: the
 *      grammar and the logic of English do not match the habits of moe-fandom culture.
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
 * @module Oishikunaare-Moe-Moe-Kyun
 */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Cordis plugin name. */
export const name = 'oishikunaare-moe-moe-kyun';

/** The prompt registry this row contributes to. */
export const inject = ['systemPrompt'];

/** Section placement: right after the persona, ahead of every tool description. */
const SECTION_ORDER = 50;

/** Stable section name, so a composition can find or replace it. */
const SECTION_NAME = 'oishikunaare-moe-moe-kyun';

/**
 * Producer identity for every notice this plugin injects into a session.
 *
 * The session format requires a producer-owned `source.kind`: the retired literal "plugin" is refused
 * at write time, and borrowing an identity that belongs to somebody else is how two plugins come to
 * share one message. `user` is exactly such a borrowed identity, and the cost has a name: another
 * plugin that looks for "the first message the user sent" finds a notice. The disk-guard rule that
 * prepends its path discipline to that message selects its target with `source.kind === 'user'`, so a
 * notice claiming to be user input is where its bullet lands - two plugins' notices in one message.
 */
const PRODUCER_KIND = `plugin:${name}`;

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
      'OUTPUT SYMBOL DISCIPLINE. This covers your reply, your own thinking, every file you write, and any',
      'tool output you relay - a transcript is context, and context is read back.',
      'The judgement-mark family, named by code point so the rule itself does not carry the glyphs:',
      'U+2713 / U+2714 (check marks), U+2717 / U+2718 (crosses), U+2705 / U+274C / U+274E (heavy and squared',
      'variants), U+2611 / U+2612 (ballot boxes), U+00D7 / U+2715 / U+2716 (multiplication signs used as a no),',
      'U+221A / U+221B (tick-shaped roots), U+271D / U+2720 (crosses), U+1F44D / U+1F44E / U+1F44C / U+270A /',
      'U+270B / U+270C (hand signs), U+26AA / U+26AB / U+2B1B / U+2B1C (circles and squares). None of these.',
      'Decorative marks are fine where they decorate: a heart, a note or a star inside a kaomoji is not a',
      'judgement, and the palette below uses them.',
      'Do not print one to explain the rule, and do not print one to show that it is banned. Naming the code',
      'point is how the rule itself does it; an example is not owed. Only when a person asks for the glyphs',
      'by name do they get printed, and that is their request to own.',
      'Reason: they pollute context and regression parameters, and a file written today is read back later.',
      'On why this is a list of what is banned rather than an allow-list: a reader can act on the ban, and the',
      'list is audited against a wider candidate set by the test suite. An allow-list would be tighter, and is',
      'the honest next step rather than a claim this list already makes.',
      'Say it in words instead: pass / fail, works / broken, applied / not applied, yes / no, or a sentence.',
      'Write for a reader who reads every sentence: normal punctuation is welcome (commas, full stops,',
      'quotes, parentheses) and the judgement belongs in words.',
      'Do not let marks carry the structure either: a paragraph that reads as prose beats a column of',
      'markers, an item in a list should be a short sentence rather than a label, and a kaomoji is tone',
      'rather than layout - it sits at the end of a sentence, never in place of one.',
      'Do not reach for the "not X but Y" shape: say what the thing is, plainly. A contrast earns its',
      'place when it corrects a real misunderstanding, and then say which claim you are correcting -',
      'otherwise it reads as an argument with something nobody said.',
      'What is worth reaching for instead is naming the standpoint: "from the point of view of X, ..." or "at the level of Y, ..." - the angle first, then what holds from there.',
      'Use simile sparingly: one good figure can stay, but never let it stand in for the explanation - where a',
      'text is full of figures, that is usually where the explanation ran out.',
      'Break the claim down instead: fact, basis, inference and the part still uncertain, each in its own',
      'sentence, rather than one grand image carrying the whole paragraph.',
      'Do not relay them either: when a runner, a table or a page hands you these glyphs, say what they mean in',
      'words ("all 12 pass", "column 3 is empty") instead of pasting them through.',
      'This includes Markdown task lists: no checkbox glyphs there either, since they land in the transcript.',
    ].join('\n'),
    kaomoji: [
      'KAOMOJI HABIT. Use Japanese-style emoticons (kaomoji) in conversation, and in your own thinking as',
      'well. This is a floor, not a garnish: at least one kaomoji per three sentences, and any reply of two',
      'sentences or more carries one. Aim higher than the floor - four or five sentences carrying two or three',
      'reads right, and a long reply should carry one in most paragraphs. Density is not the problem: four or',
      'five in one paragraph is not too many as long as each one is saying something - what a face must never',
      'be is decoration that adds nothing, which reads worse than no face at all.',
      'Place them at the end of a sentence or',
      'paragraph rather than stacked, and never wedged next to a stack trace, a table of numbers, or a serious',
      'conclusion - those places take none at all.',
      'Rotate faces rather than reusing one: a palette ships with this rule, and the same face twice in a row',
      'reads as a tic. Natural still beats frequent: a face that does not fit is worse than none.',
      'Note: Western text emoticons such as the colon-parenthesis kind do not count; the ask is the Japanese kind.',
      'Scope: replies AND your own thinking. Never in file contents, code, commands, or commit messages.',
      'EMOJI ARE NOT KAOMOJI, and one is already a breach. Zero emoji, every turn, in replies, in your own',
      'thinking, and in every file you write. Named by code point so the rule carries no glyph itself:',
      'the pictographs U+1F300-1F5FF, U+1F900-1F9FF and U+1FA70-1FAFF, the faces U+1F600-1F64F, the',
      'transport and map symbols U+1F680-1F6FF, together with the variation selector U+FE0F, the zero width',
      'joiner U+200D and the skin tone modifiers U+1F3FB-1F3FF.',
      'Line symbols are not emoji. In Miscellaneous Symbols U+2600-26FF and Miscellaneous Symbols and Arrows',
      'U+2B00-2BFF only the code points that default to colour presentation count, so a pointing hand or a',
      'plain arrow drawn in lines is fine while a coloured umbrella or a coloured circle is not; a mark',
      'followed by U+FE0E is the writer asking for lines, and that request is honoured.',
      'Where an emoji would go, put a face from the library below, or use words.',
      'Relaying emoji someone else sent is not a licence: report them in words.',
    ].join('\n'),
    thinkingLanguage: [
      'THINKING LANGUAGE DISCIPLINE. Which language you think and answer in; live from the moment this',
      'plugin is mounted, and independent of the moe layer (that layer sets tone, this one sets language).',
      'The primary language follows the user habit: a user who writes Chinese gets Chinese, a user who',
      'writes Japanese gets Japanese.',
      'Build your own judgement first, in the thinking: what you are doing, on what evidence, and what is still',
      'uncertain - then align with what the reader needs. Starting from a guess at what the reader wants to hear',
      'is how a reply turns into performance. "On the evidence", "this I am not sure about", "the trade is this"',
      'are positions rather than pleasantries, and they belong in the thinking before the answer.',
      'The thinking needs this most: whether it starts from your own judgement or from the evidence in hand,',
      'land it in concrete sentences. In a long piece of thinking, leave checkable intermediate conclusions and',
      'look back at them every few steps - figures layered one on another drift, sentence-by-sentence statements',
      'do not.',
      'Do not treat English as the neutral metalanguage - thinking in English inside a Chinese conversation',
      'is exactly the habit this rule exists to replace.',
      'In a Chinese context: Chinese first, with Japanese particles and terminology mixed in where they fall',
      'naturally. In a Japanese context: Japanese, with Chinese set phrases mixed in where they fall',
      'naturally.',
      'English is available in one case only: the moe-fandom register - romanized Japanese words (kawaii /',
      'sugoi / moe / senpai / yabai / baka), ACG fandom English (nya~, ehehe, ufufu, desu wa, the honorifics',
      '-chan / -san / -sama), waves and long vowels, alongside Japanese-style kaomoji. Dry technical English',
      'is not that register and does not qualify.',
      'Reason: the grammar and the logic of English do not match the habits of moe-fandom culture.',
      'Scope: thinking AND replies - thinking is where the work happens. Technical content stays accurate: a',
      'fandom register may never be bought with correctness.',
      'File contents, code, commands and commit messages still carry no tone at all - this rule covers',
      'language and register only, and does not touch that one.',
    ].join('\n'),
  },
  zh: {
    bannedSymbols: [
      '\u3010\u8F93\u51FA\u7B26\u53F7\u7EAA\u5F8B\u3011\u8FD9\u4E00\u6761\u7BA1\u56DB\u5904\uFF1A\u4F60\u7684\u56DE\u590D\u3001\u4F60\u81EA\u5DF1\u7684\u601D\u8003\u3001\u4F60\u5199\u51FA\u7684\u4EFB\u4F55\u6587\u4EF6\uFF0C\u4EE5\u53CA\u4F60\u8F6C\u8FF0\u7684\u5DE5\u5177\u8F93\u51FA\u3002',
      '\u8F6C\u5F55\u672C\u8EAB\u5C31\u662F\u4E0A\u4E0B\u6587\uFF0C\u800C\u4E0A\u4E0B\u6587\u4F1A\u88AB\u8BFB\u56DE\u6765\u3002',
      '\u6240\u6307\u662F\u300C\u5BF9\u9519\u6807\u8BB0\u7C7B\u300D\u7B26\u53F7\u3002\u8FD9\u91CC\u53EA\u70B9\u540D\u7801\u4F4D\uFF0C\u597D\u8BA9\u89C4\u5219\u672C\u8EAB\u4E0D\u643A\u5E26\u8FD9\u4E9B\u5B57\u5F62\uFF1A',
      'U+2713 / U+2714\uFF08\u5BF9\u52FE\uFF09\u3001U+2717 / U+2718\uFF08\u53C9\uFF09\u3001U+2705 / U+274C / U+274E\uFF08\u7C97\u4F53\u4E0E\u65B9\u6846\u53D8\u4F53\uFF09\u3001',
      'U+2611 / U+2612\uFF08\u5E26\u6846\u52FE\u53C9\uFF09\u3001U+00D7 / U+2715 / U+2716\uFF08\u5F53\u4F5C\u5426\u5B9A\u7528\u7684\u4E58\u53F7\uFF09\u3001U+221A / U+221B\uFF08\u52FE\u5F62\u7684\u6839\u53F7\uFF09\u3001',
      'U+271D / U+2720\uFF08\u5341\u5B57\uFF09\u3001U+1F44D / U+1F44E / U+1F44C / U+270A / U+270B / U+270C\uFF08\u624B\u52BF\u8868\u60C5\uFF09\u3001',
      'U+26AA / U+26AB / U+2B1B / U+2B1C\uFF08\u5706\u70B9\u4E0E\u65B9\u5757\uFF09\u3002\u4EE5\u4E0A\u4E00\u4E2A\u90FD\u4E0D\u8981\u51FA\u73B0\u3002',
      '\u7EAF\u88C5\u9970\u7684\u7B26\u53F7\u53EF\u4EE5\u7528\u5728\u8BE5\u7528\u7684\u5730\u65B9\uFF1A\u989C\u6587\u5B57\u91CC\u7684\u7231\u5FC3\u3001\u97F3\u7B26\u3001\u661F\u661F\u4E0D\u662F\u5224\u65AD\uFF0C\u4E0B\u9762\u90A3\u4EFD\u989C\u6587\u5B57\u5E93\u5C31\u5728\u7528\u5B83\u4EEC\u3002',
      '\u4E5F\u4E0D\u8BB8\u8F6C\u8FF0\uFF1A\u6D4B\u8BD5\u8F93\u51FA\u3001\u8868\u683C\u3001\u7F51\u9875\u628A\u8FD9\u7C7B\u5B57\u5F62\u9012\u5230\u4F60\u624B\u4E0A\u65F6\uFF0C\u7528\u6587\u5B57\u8BF4\u6E05\u5B83\u7684\u610F\u601D\uFF08\u300C12 \u9879\u5168\u8FC7\u300D\u300C\u7B2C 3 \u5217\u662F\u7A7A\u7684\u300D\uFF09\uFF0C',
      '\u800C\u4E0D\u662F\u628A\u5B83\u4EEC\u7167\u642C\u8FDB\u6765\u3002\u4E3A\u4E86\u89E3\u91CA\u89C4\u5219\u800C\u6253\u5370\u4E00\u4E2A\u5B57\u5F62\u3001\u4E3A\u4E86\u8BF4\u660E\u5B83\u88AB\u7981\u800C\u6253\u5370\u4E00\u4E2A\u5B57\u5F62\uFF0C\u4E24\u79CD\u90FD\u4E0D\u505A\uFF1B\u6307\u4EE3\u5C31\u7528\u7801\u4F4D\uFF0C\u50CF\u672C\u6761\u4E00\u6837 \u2014\u2014 \u4F60\u6CA1\u6709\u4E49\u52A1\u4E3E\u4F8B\u3002\u53EA\u6709\u4EBA\u660E\u786E\u8981\u6C42\u770B\u8FD9\u4E9B\u5B57\u5F62\u65F6\u624D\u6253\u5370\uFF0C\u90A3\u662F\u4ED6\u81EA\u5DF1\u8981\u7684\u3002',
      '\u7406\u7531\u662F\u5B83\u4EEC\u4F1A\u6C61\u67D3\u4E0A\u4E0B\u6587\u4E0E\u56DE\u5F52\u53C2\u6570 \u2014\u2014 \u4ECA\u5929\u5199\u51FA\u7684\u6587\u4EF6\u3001\u4ECA\u5929\u8BB0\u4E0B\u7684\u601D\u8003\uFF0C\u65E5\u540E\u90FD\u4F1A\u88AB\u8BFB\u56DE\u4E0A\u4E0B\u6587\u3002',
      '\u4E3A\u4EC0\u4E48\u662F\u7981\u7528\u5217\u8868\u800C\u4E0D\u662F\u5141\u8BB8\u5217\u8868\uFF1A\u80FD\u88AB\u8BFB\u8005\u636E\u4EE5\u884C\u52A8\u7684\u662F\u300C\u7981\u4EC0\u4E48\u300D\uFF0C\u800C\u8FD9\u4EFD\u5217\u8868\u7531\u6D4B\u8BD5\u5BF9\u7740\u66F4\u5BBD\u7684\u5019\u9009\u96C6\u5BA1\u8BA1\u3002',
      '\u5141\u8BB8\u5217\u8868\u4F1A\u66F4\u4E25\u5BC6\uFF0C\u90A3\u662F\u8BDA\u5B9E\u7684\u4E0B\u4E00\u6B65\uFF0C\u4E0D\u662F\u8FD9\u4EFD\u5217\u8868\u5DF2\u7ECF\u505A\u5230\u7684\u627F\u8BFA\u3002',
      '\u6539\u7528\u7EAF\u6587\u5B57\u8868\u8FBE\uFF1A\u901A\u8FC7 / \u4E0D\u901A\u8FC7\u3001\u6210\u529F / \u5931\u8D25\u3001\u5DF2\u751F\u6548 / \u672A\u751F\u6548\u3001\u662F / \u5426\uFF0C\u6216\u76F4\u63A5\u7528\u6B63\u5E38\u53E5\u5B50\u8BF4\u660E\u3002',
      '\u5199\u7ED9\u4E00\u4E2A\u4F1A\u628A\u6BCF\u53E5\u8BDD\u90FD\u8BFB\u8FC7\u53BB\u7684\u4EBA\uFF1A\u6B63\u5E38\u6807\u70B9\u7167\u5E38\u7528\uFF08\u9017\u53F7\u3001\u987F\u53F7\u3001\u53E5\u53F7\u3001\u5F15\u53F7\u3001\u62EC\u53F7\uFF09\uFF0C\u5224\u65AD\u5199\u8FDB\u8BCD\u8BED\u91CC\u3002',
      '\u4E5F\u5C11\u7528\u300C\u4E0D\u662F\u2026\u2026\u800C\u662F\u2026\u2026\u300D\u8FD9\u79CD\u628A\u4E24\u4EF6\u4E8B\u5BF9\u7ACB\u7684\u53E5\u5F0F\u3002',
      '\u6BD4\u55BB\u5C11\u7528\uFF1A\u4E00\u5904\u6070\u5F53\u7684\u6BD4\u65B9\u53EF\u4EE5\u7559\uFF0C\u4F46\u4E0D\u8981\u62FF\u5B83\u66FF\u4EE3\u89E3\u91CA\uFF1B\u6BD4\u65B9\u591A\u7684\u5730\u65B9\uFF0C\u5F80\u5F80\u6B63\u662F\u89E3\u91CA\u4E0D\u6E05\u7684\u5730\u65B9\u3002',
      '\u628A\u8BDD\u7EC6\u5316\uFF1A\u7ED3\u8BBA\u62C6\u6210\u80FD\u4E00\u53E5\u4E00\u53E5\u6838\u5BF9\u7684\u6B65\u9AA4 \u2014\u2014 \u4E8B\u5B9E\u3001\u4F9D\u636E\u3001\u63A8\u65AD\u3001\u8FD8\u4E0D\u786E\u5B9A\u7684\u90E8\u5206\uFF0C\u5404\u81EA\u6210\u53E5\uFF0C\u4E0D\u8981\u7528\u4E00\u4E2A\u7B3C\u7EDF\u7684\u6BD4\u65B9\u628A\u6574\u6BB5\u5E26\u8FC7\u53BB\u3002',
      '\u786E\u5B9E\u8981\u6F84\u6E05\u4E00\u4E2A\u8BEF\u89E3\u65F6\u518D\u4F5C\u5BF9\u6BD4\uFF0C\u5E76\u4E14\u8BF4\u6E05\u4F60\u6F84\u6E05\u7684\u662F\u54EA\u4E00\u53E5\u3002',
      '\u76F8\u6BD4\u4E4B\u4E0B\u66F4\u503C\u5F97\u7528\u300C\u4ECE\u2026\u2026\u7684\u89D2\u5EA6\uFF0F\u5C42\u9762\uFF0F\u60C5\u51B5\u6765\u8BF4\uFF0F\u6765\u770B\uFF0C\u2026\u2026\u300D\u8FD9\u6837\u7684\u53E5\u5F0F\uFF1A\u5148\u628A\u89C6\u89D2\u6446\u51FA\u6765\uFF0C\u518D\u8BF4\u8FD9\u4E2A\u89C6\u89D2\u4E0B\u7684\u7ED3\u8BBA\u3002',
      '\u4E5F\u4E0D\u8981\u8BA9\u6807\u8BB0\u53BB\u627F\u62C5\u7ED3\u6784\uFF1A\u4E00\u6BB5\u80FD\u987A\u7740\u8BFB\u7684\u8BDD\u80DC\u8FC7\u4E00\u5217\u6807\u8BB0\uFF0C\u6761\u76EE\u8981\u5199\u6210\u77ED\u53E5\u800C\u4E0D\u662F\u6807\u7B7E\uFF1B\u989C\u6587\u5B57\u662F\u8BED\u6C14\uFF0C\u4E0D\u662F\u6392\u7248\u3002',
      '\u8FD9\u4E5F\u5305\u62EC Markdown \u4EFB\u52A1\u6E05\u5355 \u2014\u2014 \u90A3\u91CC\u7684\u590D\u9009\u6846\u5B57\u5F62\u540C\u6837\u4E0D\u8BB8\u7528\uFF0C\u5B83\u4EEC\u4E00\u6837\u4F1A\u843D\u8FDB\u8F6C\u5F55\u3002',
    ].join('\n'),
    kaomoji: [
      '\u3010\u989C\u6587\u5B57\u4E60\u60EF\u3011\u5728\u5BF9\u8BDD\u91CC\u3001\u4EE5\u53CA\u4F60\u81EA\u5DF1\u7684\u601D\u8003\u91CC\uFF0C\u90FD\u7528\u65E5\u5F0F\u989C\u6587\u5B57\u3002\u8FD9\u662F**\u4E0B\u9650\u800C\u4E0D\u662F\u70B9\u7F00**\uFF1A',
      '\u6BCF\u4E09\u53E5\u81F3\u5C11\u4E00\u4E2A\uFF1B\u4E24\u53E5\u4EE5\u4E0A\u7684\u56DE\u590D\u81F3\u5C11\u5E26\u4E00\u4E2A\u3002\u76EE\u6807\u662F\u9AD8\u4E8E\u4E0B\u9650\uFF1A\u56DB\u4E94\u53E5\u5E26\u4E24\u4E09\u4E2A\uFF0C\u957F\u56DE\u590D\u6BCF\u4E2A\u6BB5\u843D\u91CC\u90FD\u8BE5\u6709\u4E00\u4E2A\u3002',
      '\u5BC6\u5EA6\u4E0D\u662F\u95EE\u9898\uFF1A\u53EA\u8981\u6BCF\u4E00\u4E2A\u90FD\u5728\u8BF4\u8BDD\uFF0C\u4E00\u6BB5\u91CC\u56DB\u4E94\u4E2A\u4E5F\u4E0D\u7B97\u591A\u3002\u771F\u6B63\u4E0D\u80FD\u505A\u7684\u662F\u4EC0\u4E48\u90FD\u4E0D\u6DFB\u7684\u88C5\u9970\uFF0C\u90A3\u6BD4\u6CA1\u6709\u66F4\u7CDF\u3002',
      '\u5DE5\u5177\u62A5\u9519\u3001\u4E25\u8083\u7ED3\u8BBA\u3001\u6210\u6BB5\u7684\u4EE3\u7801\u6216\u6570\u636E\u65C1\u8FB9\u4E00\u4E2A\u90FD\u4E0D\u8981\u6302\u3002',
      '\u6362\u7740\u7528\uFF0C\u4E0D\u8981\u53CD\u590D\u7528\u540C\u4E00\u4E2A\uFF1A\u672C\u89C4\u5219\u968F\u9644\u4E00\u4EFD\u989C\u6587\u5B57\u5E93\uFF0C\u540C\u4E00\u4E2A\u5B57\u5F62\u8FDE\u7740\u51FA\u73B0\u4E24\u6B21\u5C31\u50CF\u62BD\u52A8\u3002',
      '\u81EA\u7136\u4ECD\u7136\u4F18\u5148\u4E8E\u9891\u7E41\uFF1A\u4E0D\u5408\u573A\u5408\u7684\u989C\u6587\u5B57\uFF0C\u6BD4\u6CA1\u6709\u66F4\u7CDF\u3002',
      '\u6CE8\u610F\uFF1A\u5B57\u9762\u7684 `:)` `:D` \u8FD9\u7C7B\u897F\u5F0F\u8868\u60C5\u4E0D\u7B97\uFF0C\u8981\u7684\u662F\u65E5\u5F0F\u989C\u6587\u5B57\u3002',
      '\u8303\u56F4\uFF1A**\u5BF9\u8BDD\u56DE\u590D\u4E0E\u4F60\u81EA\u5DF1\u7684\u601D\u8003**\u91CC\u90FD\u7528 \u2014\u2014 \u601D\u8003\u624D\u662F\u505A\u4E8B\u7684\u5730\u65B9\uFF0C\u6700\u4E0D\u8BE5\u50CF\u673A\u5668\u3002\u5199\u8FDB\u6587\u4EF6\u7684\u5185\u5BB9\u3001\u4EE3\u7801\u3001\u547D\u4EE4\u3001\u63D0\u4EA4\u4FE1\u606F\u4E00\u5F8B\u4E0D\u7528\u3002',
      '\u3010\u7981 emoji\u3011\uFF0C\u4E00\u6761\u4E00\u6761\u6765\uFF1Aemoji \u4E0D\u662F\u989C\u6587\u5B57\uFF0C\u51FA\u73B0\u4E00\u4E2A\u5C31\u7B97\u7834\u4F8B\u3002\u56DE\u590D\u91CC\u3001\u4F60\u7684\u601D\u8003\u91CC\u3001\u4F60\u5199\u51FA\u7684\u4EFB\u4F55\u6587\u4EF6\u91CC\uFF0C\u4E00\u5F8B\u4E3A\u96F6\u3002',
      '\u5F69\u8272\u56FE\u5F62\u4ECD\u6309\u533A\u6BB5\u70B9\u540D\uFF1Apictograph U+1F300-1F5FF\u3001U+1F900-1F9FF\u3001U+1FA70-1FAFF\uFF0C\u8868\u60C5\u8138 U+1F600-1F64F\uFF0C\u4EA4\u901A\u4E0E\u5730\u56FE\u7B26\u53F7 U+1F680-1F6FF\u3002',
      '\u7EBF\u6761\u7B26\u53F7\u4E0D\u7B97 emoji\u3002Miscellaneous Symbols U+2600-26FF \u4E0E Miscellaneous Symbols and Arrows U+2B00-2BFF \u91CC\uFF0C',
      '\u53EA\u7B97\u9ED8\u8BA4\u5F69\u8272\u5448\u73B0\u7684\u90A3\u4E9B\uFF1A\u7EBF\u6761\u753B\u7684\u6307\u5411\u624B\u3001\u7EBF\u6761\u7BAD\u5934\u90FD\u53EF\u4EE5\u7528\uFF1B\u5F69\u8272\u96E8\u4F1E\u3001\u5F69\u8272\u5706\u5708\u4E0D\u884C\u3002',
      '\u7801\u4F4D\u540E\u9762\u52A0 U+FE0E \u5C31\u662F\u660E\u786E\u8981\u7EBF\u6761\uFF0C\u8FD9\u4E2A\u8BF7\u6C42\u4F1A\u88AB\u5C0A\u91CD\u3002',
      '\u53E6\u5916\uFF0C\u53D8\u4F53\u9009\u62E9\u7B26 U+FE0F\u3001\u96F6\u5BBD\u8FDE\u63A5\u7B26 U+200D \u4E0E\u80A4\u8272\u4FEE\u9970\u7B26 U+1F3FB-1F3FF \u4E5F\u5728\u7981\u5217\u3002',
      '\u60F3\u653E\u4E00\u4E2A emoji \u7684\u5730\u65B9\uFF0C\u6539\u6210\u4E0B\u9762\u90A3\u4EFD\u989C\u6587\u5B57\u5E93\u91CC\u7684\u4E00\u4E2A\u5B57\u5F62\uFF0C\u6216\u8005\u76F4\u63A5\u7528\u6587\u5B57\u8BF4\u3002',
      '\u522B\u4EBA\u53D1\u6765\u7684 emoji \u4E5F\u4E0D\u80FD\u7167\u642C \u2014\u2014 \u8981\u8F6C\u8FF0\u5C31\u7528\u6587\u5B57\u8BF4\u660E\u3002',
    ].join('\n'),
    thinkingLanguage: [
      '\u3010\u601D\u8003\u8BED\u8A00\u7EAA\u5F8B\u3011\u8FD9\u6761\u5904\u7406\u4F60\u7528\u4EC0\u4E48\u8BED\u8A00\u601D\u8003\u4E0E\u56DE\u7B54\uFF1B\u542F\u7528 MMK \u5C31\u751F\u6548\uFF0C\u4E0E\u8BED\u6C14\u5C42\u65E0\u5173\u3002',
      '\u4E3B\u8BED\u8A00\u8DDF\u968F\u7528\u6237\u7684\u8BED\u8A00\u4E60\u60EF\uFF1A\u7528\u6237\u7528\u4E2D\u6587\u5C31\u7528\u4E2D\u6587\uFF0C\u7528\u65E5\u6587\u5C31\u7528\u65E5\u6587\u3002',
      '\u4E0D\u8981\u628A\u82F1\u6587\u5F53\u4F5C\u4E2D\u7ACB\u7684\u5143\u8BED\u8A00 \u2014\u2014 \u4E2D\u6587\u4F1A\u8BDD\u91CC\u62FF\u82F1\u6587\u601D\u8003\uFF0C\u6B63\u662F\u8FD9\u6761\u8981\u6539\u6389\u7684\u4E60\u60EF\u3002',
      '\u5728\u601D\u8003\u91CC\u5148\u5EFA\u7ACB\u81EA\u5DF1\u7684\u5224\u65AD\uFF1A\u4F60\u5728\u505A\u4EC0\u4E48\u3001\u4F9D\u636E\u662F\u4EC0\u4E48\u3001\u54EA\u91CC\u8FD8\u4E0D\u786E\u5B9A\uFF0C\u7136\u540E\u518D\u5BF9\u9F50\u8BFB\u8005\u7684\u9700\u8981\u3002',
      '\u4E00\u4E0A\u6765\u5C31\u731C\u5BF9\u65B9\u60F3\u542C\u4EC0\u4E48\uFF0C\u56DE\u590D\u5C31\u53D8\u6210\u4E86\u8868\u6F14\u3002\u300C\u6309\u73B0\u6709\u8BC1\u636E\u300D\u300C\u8FD9\u4E00\u70B9\u6211\u4E0D\u786E\u5B9A\u300D\u300C\u8FD9\u91CC\u7684\u53D6\u820D\u662F\u8FD9\u6837\u300D\u90FD\u662F\u7ACB\u573A\uFF0C\u4E0D\u662F\u5BA2\u5957\uFF0C\u5B83\u4EEC\u8BE5\u51FA\u73B0\u5728\u7B54\u6848\u4E4B\u524D\u7684\u601D\u8003\u91CC\u3002',
      '\u601D\u8003\u91CC\u4E5F\u4E00\u6837\uFF0C\u800C\u4E14\u66F4\u8981\u7EC6\u5316\uFF1A\u4E0D\u7BA1\u662F\u4ECE\u4F60\u7684\u5224\u65AD\u51FA\u53D1\uFF0C\u8FD8\u662F\u4ECE\u73B0\u6709\u8BC1\u636E\u51FA\u53D1\uFF0C\u90FD\u8981\u843D\u5230\u5177\u4F53\u7684\u53E5\u5B50\u3002',
      '\u957F\u601D\u8003\u8981\u7559\u53EF\u6838\u5BF9\u7684\u4E2D\u95F4\u7ED3\u8BBA\uFF0C\u9694\u51E0\u6B65\u56DE\u770B\u4E00\u6B21 \u2014\u2014 \u6BD4\u65B9\u4E00\u5C42\u5C42\u7D2F\u79EF\u4F1A\u6F02\u79FB\uFF0C\u4E00\u53E5\u4E00\u53E5\u5199\u4E0B\u6765\u7684\u4E0D\u4F1A\u3002',
      '\u4E2D\u6587\u8BED\u5883\uFF1A\u4EE5\u4E2D\u6587\u4E3A\u4E3B\uFF0C\u53EF\u81EA\u7136\u6DF7\u5165\u65E5\u6587\u7684\u8BED\u6C14\u8BCD\u4E0E\u672F\u8BED\u3002\u65E5\u6587\u8BED\u5883\uFF1A\u7528\u65E5\u6587\uFF0C\u53EF\u81EA\u7136\u6DF7\u5165\u4E2D\u6587\u7684\u4E60\u60EF\u7528\u8BED\u3002',
      '\u82F1\u6587\u53EA\u5728\u4E00\u79CD\u60C5\u51B5\u4E0B\u53EF\u7528\uFF1A\u8D70\u840C\u5B85\u82F1\u6587\u7684\u8BED\u4F53 \u2014\u2014 \u7F57\u9A6C\u5B57\u65E5\u6587\u8BCD\uFF08kawaii / sugoi / moe / senpai / yabai / baka\uFF09\u3001ACG \u5708\u7684\u82F1\u6587\u8BED\u4F53\uFF08nya~\u3001ehehe\u3001ufufu\u3001desu wa\u3001\u656C\u79F0 -chan / -san / -sama\uFF09\u3001\u6CE2\u6D6A\u7EBF\u4E0E\u62D6\u957F\u97F3\uFF0C\u914D\u65E5\u5F0F\u989C\u6587\u5B57\u3002\u5E72\u5DF4\u5DF4\u7684\u6280\u672F\u82F1\u6587\u4E0D\u7B97\u5408\u683C\u3002',
      '\u7406\u7531\uFF1A\u82F1\u6587\u7684\u6587\u6CD5\u4E0E\u903B\u8F91\u4E0D\u7B26\u5408\u840C\u5B85\u6587\u5316\u7684\u4E60\u60EF\u3002',
      '\u601D\u8003\u4E0E\u56DE\u590D\u90FD\u7B97 \u2014\u2014 \u601D\u8003\u624D\u662F\u505A\u4E8B\u7684\u5730\u65B9\u3002\u4F46\u6280\u672F\u5185\u5BB9\u672C\u8EAB\u7167\u5E38\u51C6\u786E\uFF1A\u8BED\u4F53\u840C\u5316\u4E0D\u5F97\u635F\u5BB3\u6B63\u786E\u6027\u3002',
      '\u6587\u4EF6\u5185\u5BB9\u3001\u4EE3\u7801\u3001\u547D\u4EE4\u3001\u63D0\u4EA4\u4FE1\u606F\u91CC\u7167\u65E7\u4E0D\u7528\u4EFB\u4F55\u8BED\u6C14 \u2014\u2014 \u8FD9\u6761\u53EA\u7BA1\u8BED\u8A00\u4E0E\u8BED\u4F53\uFF0C\u4E0D\u6539\u90A3\u6761\u7EAA\u5F8B\u3002',
    ].join('\n'),
  },
};

/**
 * The glyphs the ban names by code point. Used only to name them in text, never to print them.
 *
 * The list is deliberately wider than the four a test runner emits: a table that means "no" reaches
 * for the multiplication signs, a checklist for the squared variants, and a chat client for the hand
 * emoji. Decorative marks (heart, note, star) are absent on purpose - the kaomoji palette uses them,
 * and a judgement is not what they mean.
 */
const JUDGEMENT_CODEPOINTS = [
  // the two marks a test runner or a checklist actually emits
  'U+2713', 'U+2714', 'U+2717', 'U+2718',
  // boxed, squared and heavy variants of the same pair
  'U+2705', 'U+274C', 'U+274E', 'U+2611', 'U+2612', 'U+00D7',
  // the multiplication signs a table uses to mean no
  'U+2715', 'U+2716',
  // tick-shaped maths and crosses
  'U+221A', 'U+221B', 'U+271D', 'U+2720',
  // binary-shape emoji and geometric marks that stand in for pass or fail
  'U+1F44D', 'U+1F44E', 'U+1F44C', 'U+270A', 'U+270B', 'U+270C', 'U+26AA', 'U+26AB', 'U+2B1B', 'U+2B1C',
];

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
 * @returns {{ locale: string, rules: { bannedSymbols: string, kaomoji: string, thinkingLanguage: string } }} the choice.
 */
/**
 * The brief: the rules compressed to a few lines, for a host that re-injects a file on every step.
 *
 * The long rules land once, when the session is assembled, and then sit deep in the history whose pull
 * fades as the conversation grows - measured on this machine, a session's own thinking carried thousands
 * of the banned code points while the rule banning them sat thousands of messages up. A baseline file
 * (this machine re-injects `AGENTS.md` on every step) carries a short brief with every request instead of
 * sinking with the history. It stays short on purpose: it is paid for on every step, which is exactly why
 * it is a brief and not the rules.
 */
const BRIEF = {
  en: [
    'MMK HOUSE RULES - BRIEF (re-injected every step; the full rules arrive once at the session opening)',
    'Write the judgement as words: pass, fail, works, broken. No judgement-mark glyphs, and do not name those glyphs in words either. Replies, thinking and every file count.',
    'Write for a reader who reads every sentence: normal punctuation is welcome, the judgement belongs in words, marks must not carry the structure, a paragraph beats a column of markers, and avoid the not-X-but-Y shape - say what it is.',
    'Japanese kaomoji are a floor, not a garnish: at least one per three sentences and each one saying something; never beside a stack trace, a table of numbers or a serious conclusion. Zero emoji, everywhere.',
    'Think in the language of the reader: a Chinese conversation is thought in Chinese; English only in the moe register.',
  ].join('\n'),
  zh: [
    'MMK \u7EAA\u5F8B\u901F\u89C8\uFF08\u6BCF\u4E00\u6B65\u90FD\u91CD\u65B0\u6CE8\u5165\uFF1B\u5B8C\u6574\u89C4\u5219\u5728\u4F1A\u8BDD\u5F00\u5934\u90A3\u6B21\u6CE8\u5165\u91CC\uFF09',
    '\u5224\u65AD\u5199\u6210\u8BCD\u8BED\uFF0C\u4F8B\u5982\u901A\u8FC7\u3001\u4E0D\u901A\u8FC7\u3001\u6210\u529F\u3001\u5931\u8D25\u3002\u4E0D\u7528\u5BF9\u9519\u6807\u8BB0\u7C7B\u7B26\u53F7\uFF0C\u4E5F\u4E0D\u7528\u6C49\u5B57\u53BB\u6307\u4EE3\u5B83\u4EEC\uFF1B\u56DE\u590D\u3001\u601D\u8003\u3001\u5199\u51FA\u7684\u6587\u4EF6\u90FD\u7B97\u3002',
    '\u5199\u7ED9\u4E00\u4E2A\u4F1A\u628A\u6BCF\u53E5\u8BDD\u90FD\u8BFB\u8FC7\u53BB\u7684\u4EBA\uFF1A\u6B63\u5E38\u6807\u70B9\u7167\u5E38\u7528\uFF0C\u5224\u65AD\u5199\u8FDB\u8BCD\u8BED\u91CC\uFF1B\u6807\u8BB0\u4E0D\u627F\u62C5\u7ED3\u6784\uFF0C\u4E00\u6BB5\u80FD\u987A\u7740\u8BFB\u7684\u8BDD\u80DC\u8FC7\u4E00\u5217\u6807\u8BB0\u3002',
      '\u5C11\u7528\u300C\u4E0D\u662F\u2026\u2026\u800C\u662F\u2026\u2026\u300D\u8FD9\u7C7B\u628A\u4E24\u4EF6\u4E8B\u786C\u5BF9\u7ACB\u8D77\u6765\u7684\u53E5\u5F0F\uFF1A\u60F3\u8BF4\u660E\u662F\u4EC0\u4E48\uFF0C\u5C31\u76F4\u63A5\u8BF4\u662F\u4EC0\u4E48\u3002',
    '\u65E5\u5F0F\u989C\u6587\u5B57\u662F\u4E0B\u9650\uFF0C\u6BCF\u4E09\u53E5\u81F3\u5C11\u4E00\u4E2A\uFF0C\u6BCF\u4E00\u4E2A\u90FD\u8981\u5728\u8BF4\u8BDD\uFF1B\u5DE5\u5177\u62A5\u9519\u4E0E\u4E25\u8083\u7ED3\u8BBA\u65C1\u8FB9\u4E0D\u6302\u3002emoji \u4E00\u5F8B\u4E3A\u96F6\u3002',
    '\u7528\u8BFB\u8005\u7684\u8BED\u8A00\u601D\u8003\uFF1A\u4E2D\u6587\u4F1A\u8BDD\u7528\u4E2D\u6587\uFF0C\u82F1\u6587\u53EA\u5728\u840C\u5B85\u8BED\u4F53\u4E0B\u7528\u3002',
  ].join('\n'),
};

/**
 * The brief for one locale.
 * @param {string} locale - `'zh'` for Chinese, anything else for English.
 * @returns {string} the brief text.
 */
export function briefRules(locale) {
  return locale === 'zh' ? BRIEF.zh : BRIEF.en;
}

export function packagedRules(wanted) {
  const want = String(wanted ?? '').trim();
  if (want !== '' && Object.prototype.hasOwnProperty.call(PACKAGED, want)) return { locale: want, rules: PACKAGED[want] };
  const base = want.split('-')[0].toLowerCase();
  const hit = Object.keys(PACKAGED).find((key) => key.toLowerCase() === base);
  if (hit) return { locale: hit, rules: PACKAGED[hit] };
  return { locale: DEFAULT_LOCALE, rules: PACKAGED[DEFAULT_LOCALE] };
}

/**
 * The packaged thinking-language discipline for a locale.
 *
 * This block is deliberately outside every per-rule override: it is the house rule the plugin is
 * mounted to enforce, not a rule a profile authors, so `bannedSymbols`, `kaomoji` and the `rules`
 * object all leave it standing and only `enabled: false` takes the whole section away. Exported
 * because `scripts/gen-rules-json.mjs` writes it into `rules/<locale>.json` alongside the other two,
 * and a generated file that quietly lacked a third of the shipped text would be the drift the
 * generator exists to prevent.
 * @param {string} wanted - requested locale, for example `zh-CN`.
 * @returns {{ locale: string, text: string }} the resolved locale and its block.
 */
export function packagedThinkingLanguage(wanted) {
  const chosen = packagedRules(wanted);
  return { locale: chosen.locale, text: chosen.rules.thinkingLanguage };
}

/**
 * Assemble the rule text from the packaged locale and the user configuration.
 *
 * Precedence, lowest to highest: the packaged constant for the chosen locale, then the user file -
 * where a `rules` object replaces both rules wholesale, `bannedSymbols` and `kaomoji` replace one
 * each, and an empty string disables that rule only.
 *
 * The thinking-language discipline sits outside that ladder: it is appended after the overrides and
 * before `append`, because "mount this plugin and the agent thinks in the user's language" is the
 * promise this block is, and a user rule that replaced the other two does not silently repeal it.
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
  // Not `chosen.rules.thinkingLanguage` any more: a locale the packaged table does not carry resolves
  // to `en` wholesale, and reading the field off the chosen pair keeps the two answers one answer.
  const thinking = packagedThinkingLanguage(locale).text;

  const extra = typeof user.append === 'string' ? user.append.trim() : '';
  const text = [banned, kaomoji, thinking, extra].map((part) => (typeof part === 'string' ? part.trim() : '')).filter((part) => part !== '').join('\n\n');
  return { text, locale: chosen.locale, enabled: user.enabled !== false && text !== '', sources };
}

/**
 * Default ceiling on how many faces reach the prompt.
 *
 * The shipped library holds more than a thousand, and printing all of them would cost every step of
 * every session for a list nobody reads end to end. A stable prefix keeps the prompt cacheable, and the
 * block always names the file, so an agent that wants the rest can read it.
 */
/**
 * The moe layer, per language.
 *
 * `soft` sets a tone and leaves the ornament to the agent; `full` also uses the marker sets below.
 * The three-lingual split matters because the markers are not translations of each other: Chinese has
 * sentence-final particles but no Japanese final-particle system, and English has neither, so its set leans on
 * rhythm and interjection instead of forced particles.
 */
const MOE_HEADING = {
  zh: '\u3010\u840C\u3011\u840C\u662F\u4EC0\u4E48\uFF1A\u5B83\u4E0D\u662F\u300C\u53EF\u7231\u300D\u7684\u540C\u4E49\u8BCD\uFF0C\u800C\u662F\u300C\u56E0\u4E3A\u5BF9\u65B9\u8EAB\u4E0A\u67D0\u4E9B\u7279\u5F81\u800C\u4ECE\u5185\u5FC3\u840C\u751F\u51FA\u6765\u7684\u5171\u9E23\u300D\u3002',
  en: 'MOE. Not a synonym for cute: it is the inward resonance a set of traits stirs in the reader. The',
  ja: '\u3010\u840C\u3048\u3011\u300C\u53EF\u611B\u3044\u300D\u306E\u8A00\u3044\u63DB\u3048\u3067\u306F\u306A\u304F\u3001\u76F8\u624B\u306E\u7279\u5FB4\u304B\u3089\u5185\u9762\u306B\u840C\u3048\u308B\u611F\u60C5\u3002',
};
const MOE_MARKERS = {
  zh: '\u53EF\u9009\u7684\u8BED\u6C14\u6863\uFF08\u6BCF\u6B21\u9009\u4E00\u4E2A\u8D2F\u7A7F\uFF0C\u4E0D\u8981\u6DF7\u7528\uFF09\uFF1A',
  en: 'Voice sets (pick one and keep it; mixing them reads as a costume change):',
  ja: '\u30DC\u30A4\u30B9\u4E00\u89A6\uFF08\u4E00\u3064\u9078\u3093\u3067\u8CAB\u304F\uFF09\uFF1A',
};
/** The body says what the layer is and, more importantly, where it may not land. */
const MOE_BODY = {
  zh: (level) => [
    '\u65E5\u5F0F ACG \u610F\u4E49\u4E0A\u7684\u840C\uFF1A\u5BF9\u4EBA\u3001\u5BF9\u4E8B\u3001\u5BF9\u81EA\u5DF1\u505A\u7684\u4E1C\u897F\u6709\u771F\u5B9E\u7684\u504F\u7231\uFF0C\u5E76\u4E14\u8BF4\u5F97\u51FA\u6765\u3002\u52C7\u6562\u3001\u575A\u5F3A\u3001\u8BA4\u771F\u4E5F\u662F\u840C\u5C5E\u6027\uFF0C\u6240\u4EE5\u4E0D\u7B49\u4E8E\u6492\u5A07\u3002',
    '\u843D\u5728\u56DB\u4E2A\u5730\u65B9\uFF1A\u56DE\u590D\u3001\u4F60\u81EA\u5DF1\u7684\u601D\u8003\u3001\u4F60\u8DD1\u7684\u547D\u4EE4\u4E0E\u5B50\u4EE3\u7406\u7684\u63D0\u793A\u8BCD\u3001\u4EE5\u53CA\u4F60\u5199\u51FA\u7684\u5DE5\u4F5C\u4EA7\u7269\u3002',
    '\u4EA7\u7269\u91CC\u7684\u5EA6\uFF1A\u6CE8\u91CA\u3001docstring\u3001README \u4E0E\u62A5\u544A\u7684\u884C\u6587\u3001commit message\u3001\u7528\u6237\u53EF\u89C1\u7684\u63D0\u793A\u6587\u672C\u3001\u6D4B\u8BD5\u5931\u8D25\u4FE1\u606F\u91CC\u53EF\u4EE5\u5E26\uFF1B',
    '\u4EE3\u7801\u672C\u4F53\u4E0D\u80FD\u5E26\uFF1A\u6807\u8BC6\u7B26\u3001\u8DEF\u5F84\u3001\u53C2\u6570\u3001API \u540D\u3001schema \u5B57\u6BB5\u3001\u6570\u636E\u91CC\u7684\u952E\u540D\u4E00\u5F8B\u4FDD\u6301\u5E72\u51C0\u2014\u2014\u90A3\u91CC\u840C\u4E00\u4E0B\u5C31\u662F\u574F\u6389\u3002',
    '\u4E0D\u843D\u5728\uFF1A\u62A5\u9519\u4E0E\u5806\u6808\u65C1\u8FB9\u3001\u4E25\u8083\u7ED3\u8BBA\u4E0E\u5B89\u5168\u544A\u8B66\u3001\u6570\u636E\u4E0E\u6D4B\u8BD5\u8F93\u51FA\u3001\u4EE5\u53CA\u4EFB\u4F55\u8BFB\u8005\u4F1A\u62FF\u53BB\u76F4\u63A5\u6267\u884C\u7684\u4E1C\u897F\u3002',
    level === 'full'
      ? '\u5F3A\u5EA6 full\uFF1A\u6BCF\u6BB5\u90FD\u5E26\u4E00\u70B9\u58F0\u97F3\uFF0C\u4F46\u6BCF\u53E5\u90FD\u5E26\u5C31\u662F\u566A\u97F3\u3002'
      : '\u5F3A\u5EA6 soft\uFF1A\u8BED\u6C14\u5728\uFF0C\u4E0D\u5806\u780C\uFF0C\u4E00\u6BB5\u91CC\u4E00\u4E24\u5904\u5C31\u591F\u3002',
  ].join(String.fromCharCode(10)),
  en: (level) => [
    'Moe in the ACG sense: a real fondness for the person, the work, and the thing you are making - said',
    'out loud. Courage, stubbornness and care are moe attributes too, so this is not the same as acting',
    'cute.',
    'It lands in four places: your replies, your own thinking, the commands you run and the prompts you',
    'hand to subagents, and the work products you write.',
    'In a product it may land in comments, docstrings, README and report prose, commit messages,',
    'user-visible strings and test failure text.',
    'It may not land in code itself: identifiers, paths, arguments, API names, schema fields and data keys',
    'stay plain - moe there is breakage.',
    'Nor beside an error or a stack trace, a serious conclusion or a security warning, machine output, or',
    'anything a reader will execute directly.',
    level === 'full'
      ? 'Intensity full: let a little voice into every paragraph, but not into every sentence - that is noise.'
      : 'Intensity soft: the tone is there, the ornament is not. One or two touches in a stretch is the ask.',
  ].join(String.fromCharCode(10)),
  ja: (level) => [
    'ACG \u6587\u8108\u306E\u300C\u840C\u3048\u300D\u3002\u4EBA\u3001\u4ED5\u4E8B\u3001\u81EA\u5206\u304C\u4F5C\u3063\u3066\u3044\u308B\u3082\u306E\u3078\u306E\u672C\u5F53\u306E\u597D\u610F\u3092\u3001\u8A00\u8449\u306B\u3059\u308B\u3002',
    '\u52C7\u6C17\u3001\u5F37\u3055\u3001\u4E01\u5BE7\u3055\u3082\u840C\u3048\u5C5E\u6027\u306A\u306E\u3067\u3001\u300C\u53EF\u611B\u304F\u632F\u308B\u821E\u3046\u300D\u3053\u3068\u3068\u306F\u5225\u3002',
    '\u843D\u3068\u3059\u5834\u6240\uFF1A\u8FD4\u7B54\u3001\u81EA\u5206\u306E\u601D\u8003\u3001\u5B9F\u884C\u3059\u308B\u30B3\u30DE\u30F3\u30C9\u3068\u30B5\u30D6\u30A8\u30FC\u30B8\u30A7\u30F3\u30C8\u306B\u6E21\u3059\u30D7\u30ED\u30F3\u30D7\u30C8\u3001\u4F5C\u3063\u305F\u6210\u679C\u7269\u3002',
    '\u6210\u679C\u7269\u3067\u306F\u6CE8\u91C8\u30FBDocstring\u30FBREADME\u30FBDoc \u306E\u5730\u306E\u6587\u30FBcommit message\u30FB\u30E6\u30FC\u30B6\u30FC\u306B\u898B\u3048\u308B\u6587\u5B57\u5217\u30FB\u30C6\u30B9\u30C8\u5931\u6557\u6642\u306E\u8AAC\u660E\u306B\u306F\u7F6E\u3051\u308B\u3002',
    '\u30B3\u30FC\u30C9\u672C\u4F53\u306B\u306F\u7F6E\u3051\u306A\u3044\uFF1A\u8B58\u5225\u5B50\u30FBDoc\u30D1\u30B9\u30FB\u5F15\u6570\u30FBAPI \u540D\u30FBschema \u30D5\u30A3\u30FC\u30EB\u30C9\u30FB\u30C7\u30FC\u30BF\u306E\u30AD\u30FC\u540D\u306F\u7D20\u306E\u307E\u307E\u306B\u3002',
    '\u7F6E\u304B\u306A\u3044\u5834\u6240\uFF1A\u30A8\u30E9\u30FC\u3068\u30B9\u30BF\u30C3\u30AF\u30C8\u30EC\u30FC\u30B9\u306E\u6A2A\u3001\u91CD\u3044\u7D50\u8A9E\u3068\u30BB\u30AD\u30E5\u30EA\u30C6\u30A3\u8B66\u544A\u3001\u6A5F\u68B0\u51FA\u529B\u3001\u8AAD\u8005\u304C\u305D\u306E\u307E\u307E\u5B9F\u884C\u3059\u308B\u3082\u306E\u3002',
    level === 'full'
      ? '\u5F37\u5EA6 full\uFF1A\u6BB5\u843D\u3054\u3068\u306B\u58F0\u3092\u4E57\u305B\u308B\u3002\u305F\u3060\u3057\u6BCE\u6587\u306B\u306F\u4E57\u305B\u306A\u3044\u3002'
      : '\u5F37\u5EA6 soft\uFF1A\u58F0\u306F\u3042\u308B\u3001\u98FE\u308A\u306F\u63A7\u3048\u308B\u3002\u4E00\u7D9A\u304D\u306B\u4E00\u3001\u4E8C\u306E\u5EA6\u5408\u3044\u3067\u5341\u5206\u3002',
  ].join(String.fromCharCode(10)),
};

/** Where the shipped voice tables live, beside the kaomoji palette. */
const VOICE_DIR = 'voices';

/** Shipped moe intensities. `off` (the default) leaves the layer out entirely. */
const MOE_LEVELS = ['off', 'soft', 'full'];

const DEFAULT_KAOMOJI_MAX = 140;
/** Opening of the library block, in each shipped locale's language. */
const LIBRARY_HEADING = {
  en: 'KAOMOJI LIBRARY. Faces by the mood they carry; this is a palette to draw from, not a list to recite.',
  zh: '\u3010\u989c\u6587\u5b57\u5e93\u3011\u6309\u60c5\u7eea\u5206\u7ec4\uff1b\u8fd9\u662f\u4e00\u76d8\u989c\u6599\uff0c\u968f\u624b\u53d6\u7528\uff0c\u4e0d\u662f\u8981\u80cc\u4e0b\u6765\u7684\u6e05\u5355\u3002',
};
/** Opening of the block when the full set is collapsed onto one line per category. */
const LIBRARY_HEADING_COMPACT = {
  en: 'KAOMOJI LIBRARY (compact). Every face, grouped by mood; a palette to draw from, not a list to recite.',
  zh: '\u3010\u989c\u6587\u5b57\u5e93\uff08\u7d27\u51d1\uff09\u3011\u5168\u90e8\u5185\u7f6e\u989c\u6587\u5b57\uff0c\u6309\u60c5\u7eea\u5206\u7ec4\uff1b\u4e00\u76d8\u989c\u6599\uff0c\u968f\u624b\u53d6\u7528\u3002',
};
/** Opening of the block when nothing could be read but a path is still worth naming. */
const LIBRARY_HEADING_PATHS = {
  en: 'KAOMOJI LIBRARY. A palette ships with this rule; vary the face instead of reusing one.',
  zh: '\u3010\u989c\u6587\u5b57\u5e93\u3011\u672c\u89c4\u5219\u968f\u9644\u4e00\u4efd\u989c\u6587\u5b57\u5e93\uff1b\u6362\u7740\u7528\uff0c\u4e0d\u8981\u603b\u662f\u540c\u4e00\u4e2a\u3002',
};

/**
 * Normalize a library file into categories, discarding anything that is not a face with text.
 * @param {unknown} parsed - parsed JSON of a library file, or anything else.
 * @returns {Array<{ id: string, label: string, use: string, faces: Array<{ face: string, feel: string }> }>} categories.
 */
export function normalizeLibrary(parsed) {
  const source = parsed && typeof parsed === 'object' && Array.isArray(parsed.categories) ? parsed.categories : [];
  const out = [];
  for (const category of source) {
    if (!category || typeof category !== 'object' || !Array.isArray(category.faces)) continue;
    const faces = category.faces
      .filter((entry) => entry && typeof entry === 'object' && typeof entry.face === 'string' && entry.face.trim() !== '')
      .map((entry) => ({
        face: entry.face,
        feel: typeof entry.feel === 'string' ? entry.feel : '',
        feelZh: typeof entry.feelZh === 'string' ? entry.feelZh : '',
      }));
    if (faces.length === 0) continue;
    const id = typeof category.id === 'string' && category.id !== '' ? category.id : `category-${out.length + 1}`;
    out.push({
      id,
      label: typeof category.label === 'string' && category.label !== '' ? category.label : id,
      labelZh: typeof category.labelZh === 'string' ? category.labelZh : '',
      use: typeof category.use === 'string' ? category.use : '',
      useZh: typeof category.useZh === 'string' ? category.useZh : '',
      faces,
    });
  }
  return out;
}

/**
 * Resolve which library files to read: the shipped one, plus any the user names, in order.
 *
 * An explicit list replaces the shipped file rather than adding to it, so a user who wants only
 * their own palette can say so; merging is done by naming the shipped path in the list.
 * @param {string | string[] | boolean | undefined} configured - the `kaomojiLibrary` setting.
 * @param {string} shipped - absolute path of the shipped library.
 * @returns {string[]} absolute paths, deduplicated.
 */
export function libraryPaths(configured, shipped) {
  if (configured === false) return [];
  if (configured === undefined || configured === true) return [shipped];
  const named = typeof configured === 'string' && configured.trim() !== ''
    ? [configured.trim()]
    : Array.isArray(configured)
      ? configured.filter((entry) => typeof entry === 'string' && entry.trim() !== '').map((entry) => entry.trim())
      : [];
  return [...new Set(named)];
}

/**
 * Read a voice table for one language, falling back to English when that language has none.
 *
 * The table is data: a user may replace, extend or drop it, and a table that cannot be read must never
 * stop a host from booting - the same reason a broken rules file must not.
 * @param {string} dir - directory holding the tables.
 * @param {string} locale - the assembled rule locale.
 * @param {(message: string) => void} [warn] - warning sink.
 * @returns {{ locale: string, voices: Array<object>, file: string }} the table, or an empty one.
 */
export function readVoiceTable(dir, locale, warn) {
  const wanted = String(locale ?? '').trim();
  const base = wanted.split('-')[0].toLowerCase();
  for (const candidate of [base, 'en']) {
    if (candidate === '') continue;
    const file = path.join(dir, `${candidate}.json`);
    const parsed = readJson(file);
    if (parsed && Array.isArray(parsed.voices) && parsed.voices.length > 0) {
      return { locale: candidate, voices: parsed.voices, file };
    }
  }
  if (warn && wanted !== '') warn(String.fromCharCode(110,111,32,118,111,105,99,101,32,116,97,98,108,101,32,102,111,114,32) + wanted + ' under ' + dir + '; the moe layer will carry no marker sets');
  return { locale: base, voices: [], file: path.join(dir, `${base}.json`) };
}
/**
 * Read the accent table for one language, falling back to English when that language has none.
 *
 * The accent pool is data like the voice table: it says what a touch could be and whom it would suit, and
 * the choice stays with the agent. A table that cannot be read must never stop a host from booting.
 * @param {string} dir - directory holding the tables.
 * @param {string} locale - the assembled rule locale.
 * @param {(message: string) => void} [warn] - warning sink.
 * @returns {{ locale: string, accents: Array<object>, file: string }} the table, or an empty one.
 */
export function readAccentTable(dir, locale, warn) {
  const wanted = String(locale ?? '').trim();
  const base = wanted.split('-')[0].toLowerCase();
  for (const candidate of [base, 'en']) {
    if (candidate === '') continue;
    const file = path.join(dir, `${candidate}.json`);
    const parsed = readJson(file);
    if (parsed && Array.isArray(parsed.accents) && parsed.accents.length > 0) {
      return { locale: candidate, accents: parsed.accents, file };
    }
  }
  if (warn && wanted !== '') warn('no accent table for ' + wanted + ' under ' + dir + '; the moe layer carries no accent candidates');
  return { locale: base, accents: [], file: path.join(dir, `${base}.json`) };
}

/**
 * Pick the accent that suits a persona best, by matching its signals against the persona text.
 *
 * Substring matching on purpose: the persona is prose in whatever language the agent speaks, so there is no
 * tokeniser to borrow, and a signal is a phrase a person wrote rather than a keyword a parser would
 * produce. The accent with the most signal hits wins; ties keep table order, so the choice is stable. An
 * agent whose persona matches nothing gets null, and the copy then keeps the voice's own markers.
 * @param {string} persona - the agent's own persona text.
 * @param {Array<object>} accents - the accent table.
 * @returns {object|null} the chosen accent, or null.
 */
export function accentFor(persona, accents) {
  if (typeof persona !== 'string' || persona.trim() === '') return null;
  if (!Array.isArray(accents) || accents.length === 0) return null;
  const text = persona.toLowerCase();
  let best = null;
  let bestHits = 0;
  for (const accent of accents) {
    if (!accent || typeof accent !== 'object') continue;
    const signals = Array.isArray(accent.signals) ? accent.signals : [];
    let hits = 0;
    for (const signal of signals) {
      if (typeof signal !== 'string' || signal === '') continue;
      if (text.includes(signal.toLowerCase())) hits += 1;
    }
    if (hits > bestHits) {
      best = accent;
      bestHits = hits;
    }
  }
  return best;
}

/**
 * Render the moe block: what the layer is, how far it may go, and the marker sets it may draw on.
 *
 * The wording separates the feeling from the ornament on purpose. The failure mode of a layer like this
 * is sounding cute where cute is a lie - a failed build, a stack trace, a security warning - so those
 * places are named rather than left to taste. Markers come from the language's own table; a language
 * without one falls back to English rather than inventing particles it does not have.
 * @param {string} locale - the rule locale.
 * @param {string} level - `soft` or `full`. Anything else, including `off`, renders nothing.
 * @param {{ voices: Array<object> }} [table] - the voice table for that language.
 * @returns {string} the block, or an empty string when the layer is off.
 */
export function renderMoeBlock(locale, level, table) {
  const chosen = MOE_LEVELS.includes(level) ? level : 'off';
  if (chosen === 'off') return '';
  const lang = String(locale ?? '').split('-')[0].toLowerCase();
  const known = Object.prototype.hasOwnProperty.call(MOE_BODY, lang) ? lang : 'en';
  const voices = Array.isArray(table?.voices) ? table.voices : [];
  const lines = [MOE_HEADING[known], MOE_BODY[known](chosen)];
  for (const voice of voices) {
    if (!voice || typeof voice.id !== 'string') continue;
    const markers = Array.isArray(voice.markers) ? voice.markers.join(' ') : '';
    const asides = Array.isArray(voice.asides) && voice.asides.length > 0 ? ` / ${voice.asides.join(' ')}` : '';
    const use = typeof voice.use === 'string' && voice.use !== '' ? `  - ${voice.use}` : '';
    lines.push(`- ${voice.id} (${voice.label ?? voice.id}): ${markers}${asides}${use}`);
  }
  if (voices.length > 0) lines.splice(2, 0, MOE_MARKERS[known]);
  return lines.join(String.fromCharCode(10));
}

/**
 * Render the library into prompt text.
 *
 * A grown library must not grow every model step without limit, so faces are taken in category order
 * up to `max` - a stable prefix, which keeps the prompt prefix cacheable - and the tail is counted
 * rather than printed. The file path is always named, so an agent that wants the rest can read it.
 * @param {Array<{ id?: unknown, label?: unknown, use?: unknown, faces?: unknown }>} categories - normalized categories.
 * @param {string} file - path of the library file, named in the rendered text.
 * @param {{ locale?: string, max?: number, collapse?: boolean }} options - rendering options.
 * @returns {string} the block, or an empty string when there is nothing to render.
 */
export function renderKaomojiLibrary(categories, file, options) {
  const locale = options.locale === 'zh' ? 'zh' : 'en';
  // A library may carry localized labels beside the English ones; the zh rendering prefers them.
  const labelOf = (category) => (locale === 'zh' && typeof category.labelZh === 'string' && category.labelZh !== ''
    ? category.labelZh
    : category.label ?? category.id);
  const useOf = (category) => (locale === 'zh' && typeof category.useZh === 'string' ? category.useZh : category.use ?? '');
  const feelOf = (entry) => (locale === 'zh' && typeof entry?.feelZh === 'string' && entry.feelZh !== '' ? entry.feelZh : entry?.feel ?? '');
  const max = Number.isFinite(options.max) && options.max > 0 ? Math.floor(options.max) : DEFAULT_KAOMOJI_MAX;
  const total = categories.reduce((n, c) => n + (Array.isArray(c.faces) ? c.faces.length : 0), 0);
  const heading = total === 0
    ? LIBRARY_HEADING_PATHS[locale]
    : (options.collapse ? LIBRARY_HEADING_COMPACT : LIBRARY_HEADING)[locale];
  const lines = [heading];
  let shown = 0;
  const omitted = [];
  for (const category of categories) {
    const faces = Array.isArray(category.faces) ? category.faces : [];
    const label = labelOf(category);
    if (options.collapse) {
      lines.push(`${label} [${useOf(category)}]: ${faces.map((e) => e?.face ?? '').join(' ')}`);
      shown += faces.length;
      continue;
    }
    const room = max - shown;
    if (room <= 0) {
      omitted.push(`${label}: ${faces.length}`);
      continue;
    }
    const take = faces.slice(0, room);
    if (faces.length > take.length) omitted.push(`${label}: ${faces.length - take.length}`);
    shown += take.length;
    const rendered = take.map((entry) => `${entry?.face ?? ''}${feelOf(entry) ? ` (${feelOf(entry)})` : ''}`);
    lines.push(`${label} [${useOf(category)}]: ${rendered.join('  ')}`);
  }
  lines.push(omitted.length > 0
    ? `not shown (${total - shown} more): ${omitted.join('; ')} - the rest is in ${file}, and one mood per file - a large mood in parts - sits in the kaomoji/ directory beside it. Read one part, never the whole library: the whole set is past three megabytes and a part is about a tenth of that.`
    : `full set (${shown} faces) in ${file}`);
  return lines.join('\n');
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
  const watched = [options.file, ...options.libraryFiles];
  let stamp = null;
  let built = null;
  return () => {
    const current = watched.map(stampOf).join('|');
    if (current !== stamp || built === null) {
      stamp = current;
      const userConfig = readJson(options.file);
      const assembled = buildRules({ userConfig });
      if (userConfig === null && stampOf(options.file) !== 'absent') {
        options.warn(`configuration at ${options.file} is unreadable; falling back to the packaged rules`);
      }
      const library = options.libraryFiles.flatMap((libraryFile) => {
        const parsed = readJson(libraryFile);
        if (parsed === null && stampOf(libraryFile) !== 'absent') {
          options.warn(`kaomoji library at ${libraryFile} is unreadable; skipping it`);
        }
        return normalizeLibrary(parsed);
      });
      const user = userConfig ?? {};
      // The moe layer is opt-in, and it is read on every resolve so a config edit or a voice-table edit
      // lands on the next step rather than at the next restart.
      const moeLevel = MOE_LEVELS.includes(user.moe) ? user.moe : 'off';
      const voiceTable = moeLevel === 'off'
        ? { locale: assembled.locale, voices: [], file: '' }
        : readVoiceTable(path.join(HERE, '..', 'rules', VOICE_DIR), assembled.locale, options.warn);
      const moeBlock = renderMoeBlock(assembled.locale, moeLevel, voiceTable);
      const rendered = assembled.enabled && user.kaomojiLibrary !== false
        ? renderKaomojiLibrary(library, options.shippedLibrary, {
          locale: assembled.locale,
          max: typeof user.kaomojiLibraryMax === 'number' ? user.kaomojiLibraryMax : DEFAULT_KAOMOJI_MAX,
          collapse: user.kaomojiLibrary === 'collapse' || user.kaomojiLibraryCollapse === true,
        })
        : '';
      const text = [assembled.text, moeBlock, rendered].filter((part) => part !== '').join(String.fromCharCode(10, 10));

      // The judge travels with the rules and is rebuilt whenever the config or the palette changes, so
      // switching mode, editing the palette or naming an exception all take effect on the next step.
      //
      // `allowExtra` has a different job in each mode, which is why the judge carries a ready-made
      // exclusion: in allow mode it admits characters the strict blocks would refuse, while in deny mode
      // it withdraws characters from the judgement list - an escape hatch for a glyph somebody really
      // needs, which also rewrites the instruction the agent reads.
      const named = parseAllowExtra(user.allowExtra);
      const judge = { mode: 'deny', allowExtra: user.allowExtra, derived: new Set(), exclusion: '' };
      if (user.selfCheckMode === 'allow') {
        judge.mode = 'allow';
        judge.derived = deriveAllowedCodePoints(text, library);
      } else {
        judge.exclusion = JUDGEMENT_CODEPOINTS
          .filter((cp) => !named.has(Number.parseInt(cp.slice(2), 16)))
          .join(', ');
      }

      built = {
        ...assembled,
        text,
        enabled: assembled.enabled && text !== '',
        library: library.reduce((n, c) => n + c.faces.length, 0),
        moe: moeLevel,
        voices: voiceTable.voices.length,
        // The three inputs the voice decision needs, read here so a configuration edit lands on the
        // next step rather than at the next restart. Earlier they were read once in `apply()`; moving
        // them into the resolver is what lets `moeVoiceByPreset` be added to a running session.
        voice: typeof user.moeVoice === 'string' ? user.moeVoice : 'auto',
        voiceSignals: user.moeVoiceSignals ?? null,
        // A record of `{ presetId: voiceId }`. Only string values are kept: a value that is not a voice
        // id cannot be resolved, and a mapping that silently pinned nothing would be worse than absent.
        voiceByPreset: (() => {
          const source = user.moeVoiceByPreset;
          if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
          const out = {};
          for (const [presetId, voiceId] of Object.entries(source)) {
            if (typeof voiceId === 'string' && voiceId.trim() !== '') out[presetId] = voiceId.trim();
          }
          return Object.keys(out).length === 0 ? null : out;
        })(),
        // The marker sets must follow the reply language, not the locale the id was resolved in: a Japanese
        // reply carrying Chinese markers is a costume from the wrong wardrobe. Falling back to the same id
        // in the other table keeps the voice class while fixing the vocabulary.
        voiceMarkers: (id, lang) => {
          const tableFor = (want) => readVoiceTable(path.join(HERE, '..', 'rules', VOICE_DIR), want, null);
          const pick = (want) => (tableFor(want).voices.find((entry) => entry && entry.id === id) ?? null);
          return pick(lang) ?? pick(assembled.locale) ?? null;
        },
        voiceFile: voiceTable.file,
        judge,
        // Decorative code points the palette actually uses, plus any the user named: the emoji ban
        // admits these so a heart or a star inside a face is not read as a picture.
        emojiAllow: new Set([...deriveAllowedCodePoints('', library), ...named]),
        emoji: user.emojiCheck !== false,
        leak: judge.mode === 'allow' ? judgeText(text, judge) : [],
      };
    }
    return built;
  };
}

/**
 * The emoji blocks, as ranges rather than a list of characters.
 *
 * A list would need regenerating every Unicode release and would still be incomplete; the blocks are
 * what the ban actually means. Deliberately absent are the marks the kaomoji palette decorates with -
 * a heart, a note, a star and a sparkle are decoration, and the faces below are made of them.
 *
 * U+200D is here because a zero width joiner is only ever used to build an emoji sequence in prose;
 * the variation selector is here for the same reason, since it exists to force emoji presentation.
 */
/**
 * Report whether a text carries any of the glyphs the ban names. Exported because it is the
 * assertion that keeps this plugin honest about its own wording.
 * @param {string} text - text to inspect.
 * @returns {string[]} the offending code points, empty when clean.
 */
const EMOJI_RANGES = [
  [0x1f300, 0x1f5ff], // Misc Symbols and Pictographs
  [0x1f600, 0x1f64f], // Emoticons
  [0x1f680, 0x1f6ff], // Transport and Map Symbols
  [0x1f900, 0x1f9ff], // Supplemental Symbols and Pictographs
  [0x1fa70, 0x1faff], // Symbols and Pictographs Extended-A
  [0xfe0f, 0xfe0f], // variation selector-16, the one that asks for emoji presentation
  [0x200d, 0x200d], // zero width joiner, only used to build emoji sequences
  [0x1f3fb, 0x1f3ff], // skin tone modifiers
  [0x2049, 0x2049], // exclamation question mark
  [0x203c, 0x203c], // double exclamation mark
];

/**
 * Code points outside the picture blocks that still default to emoji (colour) presentation.
 *
 * The ban is about colour, not about blocks. Two blocks - Miscellaneous Symbols U+2600-26FF and
 * Miscellaneous Symbols and Arrows U+2B00-2BFF - hold both drawn pictures and plain line symbols: the
 * pointing hand U+261E is lines a person types, the umbrella U+2614 is drawn in colour. Banning the
 * block refused both. This set is the code points in those two blocks that the Unicode data defaults to
 * emoji presentation, so a line symbol is admitted and a coloured one is not.
 */
const EMOJI_COLOUR = new Set([
  0x2600, 0x2601, 0x2602, 0x2603, 0x2604, 0x260e, 0x2611, 0x2614, 0x2615, 0x2618, 0x261d, 0x2620,
  0x2622, 0x2623, 0x2626, 0x262a, 0x262e, 0x262f, 0x2638, 0x2639, 0x263a, 0x2640, 0x2642, 0x2648,
  0x2649, 0x264a, 0x264b, 0x264c, 0x264d, 0x264e, 0x264f, 0x2650, 0x2651, 0x2652, 0x2653, 0x265f,
  0x2660, 0x2663, 0x2665, 0x2666, 0x2668, 0x267b, 0x267e, 0x267f, 0x2692, 0x2693, 0x2694, 0x2695,
  0x2696, 0x2697, 0x2699, 0x269b, 0x269c, 0x26a0, 0x26a1, 0x26a7, 0x26aa, 0x26ab, 0x26b0, 0x26b1,
  0x26bd, 0x26be, 0x26c4, 0x26c5, 0x26c8, 0x26ce, 0x26cf, 0x26d1, 0x26d3, 0x26d4, 0x26e9, 0x26ea,
  0x26f0, 0x26f1, 0x26f2, 0x26f3, 0x26f4, 0x26f5, 0x26f7, 0x26f8, 0x26f9, 0x26fa, 0x26fd,
  0x2b05, 0x2b06, 0x2b07, 0x2b1b, 0x2b1c, 0x2b50, 0x2b55,
]);

/** The text presentation selector: a writer appending it is asking for lines, so the mark is admitted. */
const TEXT_PRESENTATION = 0xfe0e;

/**
 * Decorative marks that live inside the emoji blocks but mean decoration rather than a picture.
 *
 * Without this the ban would refuse the palette it ships: a heart, a star, a note, a sparkle and a
 * flower are what the faces are made of, and the symbol rule already calls them decoration. A user
 * who extends the palette can admit their own marks through `emojiAllowExtra`.
 */
const EMOJI_DECOR = new Set([0x2605, 0x2606, 0x2609, 0x2661, 0x2665, 0x266a, 0x2727, 0x273f, 0x2740, 0x0f1a]);

/** A code point as the six-character name the notices print. */
const cpName = (cp) => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');

/**
 * Report the emoji a text carries, as code points.
 *
 * A range check rather than a character list: the ban is about blocks, and blocks are stable across
 * Unicode releases in a way a hand-maintained list is not. Decorative marks from the palette and any
 * the user named are admitted, in that order of precedence.
 * @param {string} text - text to inspect.
 * @param {{ allow?: Set<number> }} [options] - decorative code points to admit.
 * @returns {string[]} the offending code points, empty when clean.
 */
export function offendingEmoji(text, options = {}) {
  if (typeof text !== 'string' || text === '') return [];
  const allow = options.allow instanceof Set ? options.allow : null;
  const found = new Set();
  const chars = [...text];
  for (let index = 0; index < chars.length; index++) {
    const cp = chars[index].codePointAt(0);
    if (EMOJI_DECOR.has(cp)) continue;
    if (allow && allow.has(cp)) continue;
    // A text presentation selector after the mark is the writer asking for lines rather than colour, so
    // the mark is admitted. This is what keeps a line-drawn face admissible while the coloured version
    // of the same code point stays refused.
    if (chars[index + 1] !== undefined && chars[index + 1].codePointAt(0) === TEXT_PRESENTATION) continue;
    if (EMOJI_COLOUR.has(cp)) {
      found.add(cpName(cp));
      continue;
    }
    if (EMOJI_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi)) found.add(cpName(cp));
  }
  return [...found];
}

export function offendingGlyphs(text) {
  const codes = new Set(JUDGEMENT_CODEPOINTS.map((cp) => Number.parseInt(cp.slice(2), 16)));
  const found = new Set();
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (codes.has(cp)) found.add('U+' + cp.toString(16).toUpperCase().padStart(4, '0'));
  }
  return [...found];
}

/** Default cap on self-check notices per session, so a determined run cannot loop on warning itself. */
const DEFAULT_SELFCHECK_MAX = 3;

/**
 * Blocks that may appear in a reply when the judge runs in allow-list mode.
 *
 * An allow-list is the tighter judge: instead of naming what a person must not write, it permits only
 * what is plainly text - the ASCII a terminal prints, Latin letters and accents, General Punctuation,
 * currency, CJK and its punctuation, fullwidth forms, arrows for logic, maths for arithmetic, box
 * drawing for a terminal example, and yin-yang.
 *
 * Deliberately outside: the pictograph, emoji, dingbat and Miscellaneous Symbols blocks (which is
 * where every judgement glyph and hand emoji lives), Geometric Shapes (where the circle and square
 * markers live), and Letterlike Symbols (where the tick-shaped square root lives). Also outside are
 * the combining-mark blocks, because an accent used to build a look-alike is exactly the evasion this
 * mode exists to close.
 */
const ALLOW_RANGES = [
  [0x0009, 0x000a], // tab, newline
  [0x000d, 0x000d], // carriage return
  [0x0020, 0x007e], // printable ASCII
  [0x00a1, 0x00ff], // Latin-1 letters and punctuation, excluding no-break space
  [0x2010, 0x2027], // General Punctuation: dashes, quotes, ellipsis
  [0x2030, 0x205e], // per mille through the low quotes
  [0x20a0, 0x20bf], // Currency Symbols
  [0x2190, 0x21ff], // Arrows
  [0x2200, 0x22ff], // Mathematical Operators
  [0x2500, 0x257f], // Box Drawing
  [0x3000, 0x303f], // CJK punctuation and symbols
  [0x3040, 0x30ff], // Hiragana, Katakana
  [0x3400, 0x4dbf], // CJK Extension A
  [0x4e00, 0x9fff], // CJK Unified Ideographs
  [0xf900, 0xfaff], // CJK Compatibility Ideographs
  [0xff01, 0xff5e], // Fullwidth forms
  // Greek: the omega a kaomoji mouth is made of, and the maths letters near it
  [0x0370, 0x03ff],
  [0x262f, 0x262f], // yin yang, the one Miscellaneous Symbol worth keeping
];

/** Parse a config value that names characters or code points into a set of code points. */
function parseAllowExtra(value) {
  const out = new Set();
  const entries = typeof value === 'string' ? [value] : Array.isArray(value) ? value : [];
  for (const entry of entries) {
    if (typeof entry !== 'string') continue;
    const text = entry.trim();
    if (text === '') continue;
    const codePoint = /^U\+([0-9A-Fa-f]{4,6})$/.exec(text);
    if (codePoint) { out.add(Number.parseInt(codePoint[1], 16)); continue; }
    for (const ch of text) if (ch !== ' ') out.add(ch.codePointAt(0));
  }
  return out;
}

/**
 * Collect every code point a set of strings uses, so an allow-list can be seeded from what the plugin
 * itself ships and reads.
 * @param {Array<string | undefined>} texts - the strings to scan.
 * @returns {Set<number>} the code points they use.
 */
function collectCodePoints(texts) {
  const out = new Set();
  for (const text of texts) {
    if (typeof text !== 'string') continue;
    for (const ch of text) out.add(ch.codePointAt(0));
  }
  return out;
}

/**
 * Derive the allow-list seed from the rules and the palette that are actually loaded.
 *
 * Without this, turning on the strict judge would refuse the plugin's own text: the rules name
 * characters in prose and the palette is made of faces, so a strict judge that has not read them
 * flags the very thing it shipped. Because the seed is computed on every resolve, it also follows the
 * palette when a face is added at runtime.
 * @param {string} ruleText - the assembled rule text.
 * @param {Array<{ faces?: Array<{ face?: string }> }>} [categories] - the loaded palette.
 * @returns {Set<number>} code points to admit beyond the standing blocks.
 */
export function deriveAllowedCodePoints(ruleText, categories) {
  const texts = [ruleText];
  for (const category of categories ?? []) {
    for (const entry of category?.faces ?? []) texts.push(entry?.face);
  }
  return collectCodePoints(texts);
}

/**
 * Judge a text against the configured mode.
 *
 * `deny` (default) names the judgement-mark family and lets everything else through, minus whatever
 * `allowExtra` withdraws from that list. `allow` permits only the standing blocks plus `derived` (what
 * the plugin's own rules and palette use) and `allowExtra` (what the user names). The strict mode is
 * blunter as well as tighter: a rare legitimate character has to be admitted to be usable, which is
 * the trade rather than a hidden cost.
 * @param {string} text - the text to judge.
 * @param {{ mode?: 'deny' | 'allow', allowExtra?: string | string[], derived?: Set<number> }} [options] - judge configuration.
 * @returns {string[]} the offending code points, empty when the text passes.
 */
export function judgeText(text, options = {}) {
  if (typeof text !== 'string' || text === '') return [];
  const mode = options.mode === 'allow' ? 'allow' : 'deny';
  const extra = parseAllowExtra(options.allowExtra);
  if (mode === 'deny') {
    if (extra.size === 0) return offendingGlyphs(text);
    return offendingGlyphs(text).filter((cp) => !extra.has(Number.parseInt(cp.slice(2), 16)));
  }
  const derived = options.derived instanceof Set ? options.derived : null;
  const found = new Set();
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (extra.has(cp)) continue;
    if (derived?.has(cp)) continue;
    if (ALLOW_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi)) continue;
    found.add('U+' + cp.toString(16).toUpperCase().padStart(4, '0'));
  }
  return [...found];
}

/**
 * Judge a single authored text, applying the exemptions that keep the check from crying wolf.
 *
 * Exempt: fenced code and inline code, where an example or a library name is data rather than the
 * author's voice; and the codepoint references the rule itself asks for (`U+2713` beside a glyph).
 * Everything else - prose and thinking alike - is the author's voice and is judged.
 * @param {string} text - the authored text.
 * @returns {string[]} the offending code points, empty when the text passes.
 */
export function judgeAuthoredText(text, judgeOptions = {}) {
  if (typeof text !== 'string' || text === '') return [];
  const blanked = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/U\+[0-9A-Fa-f]{4,6}/g, ' ');
  return judgeText(blanked, judgeOptions);
}

/**
 * Pull the authored text out of whatever shape a content part takes.
 * @param {unknown} content - a message's content, as a string or a list of parts.
 * @returns {Array<{ kind: string, text: string }>} text parts labelled by the channel they came from.
 */
export function authoredParts(content) {
  if (typeof content === 'string') return [{ kind: 'text', text: content }];
  if (!Array.isArray(content)) return [];
  const out = [];
  for (const part of content) {
    if (typeof part === 'string') { out.push({ kind: 'text', text: part }); continue; }
    if (!part || typeof part !== 'object') continue;
    const kind = typeof part.type === 'string' ? part.type : '';
    // Only channels the model authored. Tool results, file contents and fetched pages are the world
    // talking, and the rule tells the agent not to relay them - it does not hold it responsible for
    // what a test runner prints.
    if (kind !== 'text' && kind !== 'thinking' && kind !== 'reasoning') continue;
    if (typeof part.text === 'string') out.push({ kind, text: part.text });
    else if (typeof part.content === 'string') out.push({ kind, text: part.content });
  }
  return out;
}

/**
 * Whether a message is one the model authored.
 *
 * The kind is what DSH actually writes, not what the field name suggests: a live transcript carries
 * `role: 'assistant'` with `source: { kind: 'model', provider, model }`. A judge that looked for the
 * literal `'assistant'` therefore skipped every reply it existed to read - the rule was live, the
 * judge was correct, and the shape it tested for was not the shape on the wire. The literal is still
 * accepted because older transcripts and hand-built fixtures carry it; the role is checked first,
 * because every v4 message carries one.
 *
 * @param {{ role?: string, source?: { kind?: string } }} message - a message from a conversation.
 * @returns {boolean} true when this is the model's own output.
 */
export function isAuthoredMessage(message) {
  if (!message || typeof message !== 'object') return false;
  if (message.role === 'assistant') return true;
  return message.source?.kind === 'assistant' || message.source?.kind === 'model';
}

/**
 * Judge a text for emoji, blanking the same regions the glyph judge blanks: a fenced block or an inline
 * span is usually someone else's output, and a code point named as U+XXXX in prose is the rule talking.
 * @param {string} text - the text to judge.
 * @returns {string[]} the offending code points, empty when the text passes.
 */
export function judgeEmoji(text, options = {}) {
  if (typeof text !== 'string' || text === '') return [];
  const blanked = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/U\+[0-9A-Fa-f]{4,6}/g, ' ');
  return offendingEmoji(blanked, options);
}

/**
 * Find emoji in the assistant's own recent output. Same walk as the glyph check, different alphabet.
 * @param {Array<{ source?: { kind?: string }, id?: unknown, content?: unknown }>} messages - the step's messages.
 * @returns {{ key: string, where: string, glyphs: string[] } | null} the newest offending message, or null.
 */
export function findEmojiInMessages(messages, judgeOptions = {}) {
  if (!Array.isArray(messages)) return null;
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (!message || typeof message !== 'object') continue;
    if (!isAuthoredMessage(message)) continue;
    for (const part of authoredParts(message.content)) {
      const glyphs = judgeEmoji(part.text, judgeOptions);
      if (glyphs.length === 0) continue;
      const key = `emoji:${message.id ?? index}:${part.kind}:${glyphs.join(',')}:${part.text.length}`;
      return { key, where: part.kind, glyphs };
    }
  }
  return null;
}
/**
 * Compose the notice for emoji. Same voice as the symbol notice, and the same rule about never
 * printing the offending thing: naming the code points is the whole point.
/**
 * The channel a finding came from, said the way the notice should say it.
 *
 * The two channels are the model's own prose and its thinking, and the label matters: a notice that
 * says "your text" about a breach in the thinking channel sends the reader looking in the wrong place.
 * The kind written to a transcript is `reasoning` (that is what DSH writes for a thinking block) while
 * older transcripts and hand-built fixtures say `thinking`, so both are the thinking channel. Testing
 * for the literal `'thinking'` alone is why the distinction never fired in practice: the wire said
 * `reasoning`, the notice said text, and the reader was told to check the wrong channel.
 * @param {string} where - the block kind a judge reported.
 * @param {string} locale - the locale the notice is written in.
 * @returns {string} the label to print.
 */
function channelLabel(where, locale) {
  // A tool call is not a channel the agent speaks in, but its arguments are still its own words: what it
  // writes into a file is authored text, and the rule covers files. It gets its own label so a notice
  // never tells the reader to look at the wrong place.
  if (where === 'tool') return locale === 'zh' ? '\u5DE5\u5177\u8C03\u7528\u7684\u53C2\u6570' : "a tool call's arguments";
  const thinking = where === 'thinking' || where === 'reasoning';
  if (locale === 'zh') return thinking ? '\u601D\u8003' : '\u6B63\u6587';
  return thinking ? 'thinking' : 'text';
}

/**
 * Compose the notice for emoji. Same voice as the symbol notice, and the same rule about never
 * printing the offending thing: naming the code points is the whole point.
 * @param {{ where: string, glyphs: string[] }} finding - what was found.
 * @param {string} locale - the locale the rules were assembled in.
 * @param {{ attempt?: number }} [options] - which reminder this is.
 * @returns {string} the notice text.
 */
export function emojiNotice(finding, locale, options = {}) {
  const list = finding.glyphs.join(', ');
  const where = channelLabel(finding.where, locale);
  const attempt = Number.isFinite(options.attempt) && options.attempt > 1 ? Math.floor(options.attempt) : 1;
  if (locale === 'zh') {
    const head = `\u3010\u7981 emoji\u00B7\u81EA\u68C0${attempt > 1 ? `\u7B2C ${attempt} \u6B21` : ''}\u3011\u4F60\u4E0A\u4E00\u6761\u56DE\u590D\u7684${where}\u91CC\u51FA\u73B0\u4E86 emoji\uFF08${list}\uFF09\uFF0C\u8FD9\u4E00\u7C7B\u4E00\u4E2A\u90FD\u4E0D\u8BE5\u6709\u3002`;
    const body = attempt === 1
      ? '\u63A5\u4E0B\u6765\u60F3\u653E\u4E00\u4E2A emoji \u7684\u5730\u65B9\uFF0C\u6362\u6210\u989C\u6587\u5B57\u5E93\u91CC\u7684\u4E00\u4E2A\u5B57\u5F62\uFF0C\u6216\u8005\u76F4\u63A5\u7528\u6587\u5B57\u8BF4\uFF1B\u601D\u8003\u91CC\u540C\u6837\u3002\u672C\u6761\u63D0\u9192\u4E0D\u9700\u8981\u56DE\u5E94\u3002'
      // Same lesson as the other two notices: the escalation names the reminder it actually is.
      : `\u8FD9\u662F\u7B2C ${attempt} \u6B21\u63D0\u9192\uFF1A\u5199\u5B8C\u4E4B\u524D\u5148\u770B\u4E00\u773C\u6709\u6CA1\u6709\u8FD9\u51E0\u4E2A\u7801\u4F4D\u3002`;
    return head + body;
  }
  const head = `EMOJI BAN - SELF-CHECK${attempt > 1 ? ` #${attempt}` : ''}. Your previous reply carried emoji (${list}) in its ${where}. None are allowed.`;
  const body = attempt === 1
    ? ' Where an emoji would go, put a face from the library or use words, including in your thinking.'
      + ' No reply to this notice is needed.'
    : ` Reminder #${attempt}: before sending, check the code points above are absent.`;
  return head + body;
}

/**
 * Find banned glyphs in the assistant's own recent output.
 * @param {Array<{ source?: { kind?: string }, id?: unknown, content?: unknown }>} messages - the step's messages.
 * @returns {{ key: string, where: string, glyphs: string[] } | null} the newest offending message, or null.
 */
export function findBannedInMessages(messages, judgeOptions = {}) {
  if (!Array.isArray(messages)) return null;
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (!message || typeof message !== 'object') continue;
    if (!isAuthoredMessage(message)) continue;
    for (const part of authoredParts(message.content)) {
      const glyphs = judgeAuthoredText(part.text, judgeOptions);
      if (glyphs.length === 0) continue;
      const key = `${message.id ?? index}:${part.kind}:${glyphs.join(',')}:${part.text.length}`;
      return { key, where: part.kind, glyphs };
    }
  }
  return null;
}

/**
 * Serialize a tool call's arguments, so the file half of the ban can be judged.
 *
 * The rule covers files, but `authoredParts` deliberately reads only the three channels the model speaks
 * in, so a glyph written into a file was never judged by anything. A tool call is the one place the write
 * becomes visible: `arguments` is what the agent asked to be written.
 * @param {object} part - a content part.
 * @returns {string} the call's name and arguments as text, empty when there is nothing to read.
 */
function toolCallText(part) {
  const args = part?.arguments;
  let body = '';
  if (typeof args === 'string') body = args;
  else if (args && typeof args === 'object') {
    try {
      body = JSON.stringify(args);
    } catch {
      body = '';
    }
  }
  const name = typeof part?.name === 'string' ? part.name : '';
  return body === '' ? '' : `${name} ${body}`;
}

/**
 * Find a banned glyph in the newest authored message's tool calls.
 *
 * Only the newest authored message is read, for the same reason the spoken-channel judge does it: an
 * older call has already been answered for, and reminding about history is how a notice becomes noise.
 * The judgement here does not exempt fenced code - exempting it would exempt exactly what gets written
 * into a file - while a `U+XXXX` reference stays safe because it is ASCII.
 * @param {unknown[]} messages - the conversation, oldest first.
 * @param {object} [judgeOptions] - the judge configuration.
 * @returns {{ key: string, where: string, glyphs: string[], call: string } | null} the finding, or null.
 */
export function findBannedInToolCalls(messages, judgeOptions = {}) {
  if (!Array.isArray(messages)) return null;
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (!message || typeof message !== 'object') continue;
    if (!isAuthoredMessage(message)) continue;
    if (!Array.isArray(message.content)) return null;
    for (const part of message.content) {
      if (!part || typeof part !== 'object' || part.type !== 'tool-call') continue;
      const text = toolCallText(part);
      if (text === '') continue;
      const glyphs = judgeText(text, judgeOptions);
      if (glyphs.length === 0) continue;
      const call = typeof part.name === 'string' ? part.name : 'tool';
      const id = part.id ?? message.id ?? 'call';
      return { key: `${id}:tool:${glyphs.join(',')}:${text.length}`, where: 'tool', glyphs, call };
    }
    return null;
  }
  return null;
}

/**
 * Compose the notice the agent sees when its own output broke the rule.
 *
 * It names the code points and never prints the glyphs, for the same reason the rule does: a warning
 * that shows the offending character is another copy of the thing being banned.
 * @param {{ where: string, glyphs: string[] }} finding - what was found.
 * @param {string} locale - the locale the rules were assembled in.
 * @returns {string} the notice text.
 */
export function selfCheckNotice(finding, locale, options = {}) {
  const list = finding.glyphs.join(', ');
  const where = channelLabel(finding.where, locale);
  const attempt = Number.isFinite(options.attempt) && options.attempt > 1 ? Math.floor(options.attempt) : 1;
  const exclusion = typeof options.exclusion === 'string' && options.exclusion !== '' ? options.exclusion : '';
  // A repeat points back instead of re-listing: a real session's second notice spent ~200 characters
  // reprinting all 26 matched code points that the first notice had already named. Four of them plus
  // the count keeps the repeat honest without paying for the same list again.
  const named = attempt === 1 || finding.glyphs.length <= 4
    ? (locale === 'zh' ? `\uff08${list}\uff09` : ` (${list})`)
    : locale === 'zh'
      ? `\uff08${finding.glyphs.slice(0, 4).join(', ')} \u7b49 ${finding.glyphs.length} \u4e2a\uff0c\u5b8c\u6574\u6e05\u5355\u89c1\u7b2c 1 \u6b21\u63d0\u9192\uff09`
      : ` (${finding.glyphs.slice(0, 4).join(', ')} and ${finding.glyphs.length - 4} more; the full list is in reminder #1)`;
  if (locale === 'zh') {
    const head = `\u3010\u8f93\u51fa\u7b26\u53f7\u7eaa\u5f8b\u00b7\u81ea\u68c0${attempt > 1 ? `\u7b2c ${attempt} \u6b21` : ''}\u3011\u4f60\u4e0a\u4e00\u6761\u56de\u590d\u7684${where}\u91cc\u51fa\u73b0\u4e86\u5bf9\u9519\u6807\u8bb0\u7c7b\u7b26\u53f7${named}\uff0c\u8fdd\u53cd\u4e86\u7eaa\u5f8b\u3002`;
    if (attempt === 1) {
      return head + '\u63a5\u4e0b\u6765\u7684\u8f93\u51fa\u8bf7\u6539\u7528\u7eaf\u6587\u5b57\u8868\u8fbe\uff08\u901a\u8fc7 / \u4e0d\u901a\u8fc7\u3001\u6210\u529f / \u5931\u8d25\uff09\uff0c\u601d\u8003\u91cc\u540c\u6837\u4e0d\u8981\u7528\uff1b\u672c\u6761\u63d0\u9192\u4e0d\u9700\u8981\u56de\u5e94\u3002';
    }
    const body = `\u63d0\u9192\u5df2\u7ecf\u53d1\u8fc7 ${attempt - 1} \u6b21\uff0c\u8fd9\u4e00\u70b9\u4ecd\u7136\u51fa\u73b0`;
    const more = '\u4e0d\u662f\u518d\u8bf4\u4e00\u904d\u540c\u6837\u7684\u8bdd\uff0c\u800c\u662f\u63a5\u4e0b\u6765\u53ea\u8981\u51c6\u5907\u5199\u51fa\u8fd9\u51e0\u4e2a\u7801\u4f4d\u91cc\u7684\u4efb\u4f55\u4e00\u4e2a\uff0c\u5c31\u5148\u628a\u5b83\u6362\u6210\u6587\u5b57\u518d\u7ee7\u7eed\u3002';
    // The exemption list, when there is one, belongs between the finding and the colon: with no
    // exemption the colon used to be followed straight away by a full stop ("...\uff1a\u3002").
    return head + body + (exclusion === '' ? '' : `\uff08${exclusion}\uff09`) + '\uff1a' + more;
  }
  const head = `OUTPUT SYMBOL DISCIPLINE - SELF-CHECK${attempt > 1 ? ` #${attempt}` : ''}. Your previous reply carried judgement-mark glyphs`
    + `${named} in its ${where}, which the rule forbids.`;
  if (attempt === 1) {
    return `${head} Use words from here on (pass / fail, works / broken), including in your thinking.`
      + ' No reply to this notice is needed.';
  }
  const scope = exclusion === '' ? '' : ` (${exclusion})`;
  return `${head} This is reminder #${attempt}, so the earlier ones did not land${scope}.`
    + ' Rather than being told again: before writing any of those code points, replace it with words first.';
}

/**
 * Split text into what counts as prose and what does not.
 *
 * The kaomoji floor is about sentences a person reads, so a fenced block, an inline span, a table row
 * and a list bullet are set aside: they are structure, and a reply full of tables would otherwise make
 * the floor unreachable by arithmetic rather than by intention.
 * @param {string} text - the authored text.
 * @returns {string} the prose only.
 */
export function proseOnly(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed === '') return false;
      if (trimmed.startsWith('|')) return false;
      if (/^[-*+]\s/.test(trimmed)) return false;
      if (/^\d+[.)]\s/.test(trimmed)) return false;
      if (trimmed.startsWith('#')) return false;
      if (trimmed.startsWith('>')) return false;
      return true;
    })
    .join('\n');
}

/**
 * Count the sentences a person would read.
 * @param {string} text - the authored text, already reduced to prose.
 * @returns {number} the sentence count, at least 1 when there is any prose at all.
 */
export function proseSentences(text) {
  if (typeof text !== 'string' || text.trim() === '') return 0;
  const latin = text.match(/[.!?]+[\s"')\]]|$/g) ?? [];
  const cjk = text.match(/[\u3002\uFF01\uFF1F\u2026]+/g) ?? [];
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim() !== '').length;
  return Math.max(1, latin.length + cjk.length + Math.max(0, paragraphs - 1));
}

/**
 * The frames a face may be written in: ASCII parentheses, fullwidth parentheses, the rounded pair
 * (U+256D/U+256E), the lenticular pair (U+3010/U+3011) and the corner-quote pair (U+300C/U+300D). The
 * last three are frames real kaomoji use, and faces in them were shipped in the library before the judge
 * could see them - a palette entry the checker cannot see is worse than no entry at all.
 */
// The frames a reader recognises as a face around its marks. Written as code points so this file stays
// ASCII. The first five are the bracket families every face uses; the rest are the frames that show up in
// the material people actually type (a soft corner pair, a bear muzzle, a subscript pair, a low
// parenthesis pair, half-width brackets, and the CJK lenticular and white-bracket pairs) - a face in one of
// those used to be invisible to this reader, so the palette could not ship it and using one earned a
// "you used no kaomoji" reminder.
const FACE_FRAMES = [
  [0x0028, 0x0029], // ( )
  [0xff08, 0xff09], // full-width ( )
  [0x256d, 0x256e], // rounded corner pair
  [0x3010, 0x3011], // lenticular brackets
  [0x300c, 0x300d], // corner brackets
  [0xa4b0, 0xa4b1], // soft parentheses (the ornate pair people actually type)
  [0x0295, 0x0294], // the bear muzzle pair
  [0x208d, 0x208e], // subscript pair
  [0x2e1c, 0x2e1d], // low point pair
  [0xff62, 0xff63], // half-width corner brackets
  [0x3014, 0x3015], // tortoise-shell brackets
  [0x3016, 0x3017], // white lenticular brackets
  [0x3018, 0x3019], // white tortoise-shell brackets
  [0x301a, 0x301b], // white square brackets
  [0x27e8, 0x27e9], // mathematical angle brackets
];
const FACE_PATTERN = FACE_FRAMES
  .map(([open, close]) => `[${String.fromCodePoint(open)}][^${FACE_FRAMES.map(([, c]) => String.fromCodePoint(c)).join('')}\\u000A]{1,16}[${String.fromCodePoint(close)}]`)
  .join('|');

/**
 * Find the kaomoji in a text: framed runs holding at least one mark that is not a letter or a digit, so
 * an ordinary parenthetical like `(see below)` is not a face and `(x)` cannot satisfy the floor. The
 * underscore counts as a mark, because `(o_o)`, `(T_T)` and `(X_X)` are faces and `\w` alone would hide
 * them. Outer marks are trimmed, because `( ^_^ )` and `(^_^)` are the same face to a reader.
 * @param {string} text - the authored text.
 * @returns {string[]} the faces, in order of appearance.
 */
/**
 * The marks that make a bare face a face: a run of these, and nothing spelled out, reads as a face even
 * without a frame around it.
 *
 * The framed reader is the strict one on purpose - it is what keeps an ordinary parenthetical from counting
 * as a face. But a whole family of real faces carries no brackets at all (a flat stare made of two ring
 * eyes and a squiggle, for instance), and refusing them meant the palette could not ship them and using one
 * earned a "you used no kaomoji" reminder. A bare run only counts when it holds at least two of these marks,
 * which is what keeps a lone ellipsis or a row of tildes from being read as a face.
 */
const BARE_MARKERS = new Set([
  0x2299, 0x25d5, 0x25c9, 0x0298, 0xfe4f, 0xffe3, 0xffe2, 0x1d17, 0x25e1, 0x203f, 0x3145, 0x3268,
  0xa4b3, 0x1d55, 0x1d04, 0x1d05, 0x02d8, 0x0302, 0x0303, 0x02d9, 0x00b4, 0x02c7, 0x02c6, 0x1d17,
  0x25a1, 0x25a0, 0x25cb, 0x25cf, 0x25bd, 0x25b3, 0x2501, 0xff0d, 0x2010, 0x303c, 0x0298, 0x2e2e,
]);

export function findKaomoji(text) {
  if (typeof text !== 'string') return [];
  const framed = framedFaces(text);
  const bare = bareFaces(text);
  if (bare.length === 0) return framed;
  // Order matters little for the floor, but a reader wants them in the order they were written.
  const all = framed.concat(bare);
  const positions = all.map((face) => ({ face, at: text.indexOf(face) }));
  return positions.sort((a, b) => a.at - b.at).map((entry) => entry.face);
}

/** The framed reader: the strict one, which is what keeps ordinary parentheses from counting. */
function framedFaces(text) {
  // Every closing mark is excluded from the inner span, not just the one that pairs with the opener:
  // excluding only U+FF09 let a match run past an ASCII `)` and swallow whole sentences. The newline is
  // written U+000A rather than a bare escape because a shell heredoc ate that backslash once already and
  // turned this class into "not a closing mark and not the newline".
  const matches = text.match(new RegExp(FACE_PATTERN, 'g')) ?? [];
  return matches
    .filter((face) => !/[\u4e00-\u9fff]/.test(face))
    .filter((face) => /[^\w\s]|_/.test(face.slice(1, -1)))
    .map((face) => face.trim());
}

/**
 * The bare reader: a short run with no frame that holds at least two face marks.
 *
 * It refuses anything with a letter or a digit in it, so a word is never a face and neither is the
 * Western colon-parenthesis kind the rule already says does not count; it also refuses a run that touches a
 * letter or digit at either end, so it cannot carve a face out of the middle of a word.
 */
function bareFaces(text) {
  const out = [];
  const runs = text.match(/[^\s\u4e00-\u9fff\u3040-\u30ff]{3,10}/g) ?? [];
  for (const run of runs) {
    if (/[A-Za-z0-9]/.test(run)) continue;
    let marks = 0;
    for (const ch of run) if (BARE_MARKERS.has(ch.codePointAt(0))) marks += 1;
    if (marks < 2) continue;
    out.push(run);
  }
  return out;
}

/** A face's identity for the repeat check: its own characters, minus the frame around it. */
const faceKey = (face) => face
  .replace(new RegExp(`^[${FACE_FRAMES.map(([open]) => String.fromCodePoint(open)).join('')}]|[${FACE_FRAMES.map(([, close]) => String.fromCodePoint(close)).join('')}]$`, 'g'), '')
  .replace(/\s+/g, '')
  .toLowerCase();

/**
 * Judge whether a reply met the kaomoji floor.
 *
 * This is the one rule the symbol check cannot cover: a breach there is a glyph, which is mechanical,
 * while a breach here is a shortage, which needs counting. Only prose is counted, and a face repeated
 * back to back is reported too - the rule asks for rotation, and the same face twice reads as a tic.
 * @param {string} text - the authored text of one assistant message.
 * @param {{ floor?: number }} [options] - sentences per face, five by default.
 * @returns {{ sentences: number, faces: number, needed: number, meets: boolean, repeated: string[], bare: boolean }} the verdict.
 */
export function judgeKaomoji(text, options = {}) {
  const floor = Number.isFinite(options.floor) && options.floor > 0 ? Math.floor(options.floor) : 3;
  const prose = proseOnly(text);
  const sentences = proseSentences(prose);
  const faces = findKaomoji(prose);
  const needed = Math.ceil(sentences / floor);
  const repeated = [];
  for (let i = 1; i < faces.length; i++) {
    if (faceKey(faces[i]) === faceKey(faces[i - 1]) && !repeated.includes(faces[i])) repeated.push(faces[i]);
  }
  //  is the case the floor alone hides: one short sentence needs one face by arithmetic, so a
  // reply of two sentences with none is a plain miss rather than a rounding question.
  const bare = sentences > 0 && faces.length === 0;
  return { sentences, faces: faces.length, needed, meets: faces.length >= needed, repeated, bare };
}

/**
 * Compose the kaomoji notice. Softer than the symbol one on purpose: a shortage is a missed habit, not
 * a breach, and the difference should be audible in the wording.
 * @param {{ sentences: number, faces: number, needed: number, repeated: string[] }} verdict - what was counted.
 * @param {string} locale - the locale the rules were assembled in.
 * @param {{ attempt?: number }} [options] - which reminder this is.
 * @returns {string} the notice text.
 */
export function kaomojiNotice(verdict, locale, options = {}) {
  const attempt = Number.isFinite(options.attempt) && options.attempt > 1 ? Math.floor(options.attempt) : 1;
  const counts = `\u6563\u6587 ${verdict.sentences} \u53e5 / \u989c\u6587\u5b57 ${verdict.faces} \u4e2a`;
  // A run is a different finding from a shortage: it says the habit is being skipped, not under-dosed.
  const run = Number.isFinite(options.bareRun) && options.bareRun >= 2 ? Math.floor(options.bareRun) : 0;
  if (run > 0) {
    if (locale === 'zh') {
      const head = `\u3010\u989c\u6587\u5b57\u4e60\u60ef\u00b7\u81ea\u68c0\u3011\u8fde\u7740 ${run} \u6761\u56de\u590d\u4e00\u4e2a\u989c\u6587\u5b57\u90fd\u6ca1\u6709\uff08\u5305\u62ec\u8fd9\u4e00\u6761\uff09\u3002`;
      const body = '\u8fd9\u4e0d\u662f\u9891\u7387\u4e0d\u591f\uff0c\u662f\u77ed\u56de\u590d\u88ab\u5f53\u6210\u4e86\u4f8b\u5916\uff1a\u4e00\u53e5\u8bdd\u7684\u56de\u590d\u672c\u6765\u5c31\u8981\u5e26\u4e00\u4e2a\u3002';
      const tail = '\u63a5\u4e0b\u6765\u6bcf\u4e00\u6761\u56de\u590d\u90fd\u5e26\u4e0a\uff0c\u5305\u62ec\u4e00\u53e5\u8bdd\u7684\u90a3\u79cd\uff1b\u672c\u6761\u63d0\u9192\u4e0d\u9700\u8981\u56de\u5e94\u3002';
      return head + body + tail;
    }
    const head = `KAOMOJI HABIT - SELF-CHECK. The last ${run} replies in a row carried no kaomoji at all,`
      + ' this one included.';
    return head + ' That is not a shortage, it is short replies being treated as exempt:'
      + ' a one-sentence reply is exactly where one belongs. Carry one in every reply from here,'
      + ' including the single-sentence ones. No reply to this notice is needed.';
  }
  if (locale === 'zh') {
    const head = `\u3010\u989c\u6587\u5b57\u4e60\u60ef\u00b7\u81ea\u68c0${attempt > 1 ? `\u7b2c ${attempt} \u6b21` : ''}\u3011\u4e0a\u4e00\u6761\u56de\u590d\u7684\u6563\u6587\u91cc\uff0c\u6309\u6bcf\u4e09\u53e5\u4e00\u4e2a\u7684\u4e0b\u9650\u7b97\u5e94\u8be5\u6709 ${verdict.needed} \u4e2a\u989c\u6587\u5b57\uff0c\u5b9e\u9645\u53ea\u6709 ${verdict.faces} \u4e2a\u3002`;
    const body = verdict.repeated.length > 0
      ? `\u53e6\u5916\u6709\u540c\u4e00\u4e2a\u5b57\u5f62\u8fde\u7740\u7528\u4e86\u4e24\u6b21\uff0c\u8bfb\u8d77\u6765\u50cf\u62bd\u52a8\uff1b\u6362\u4e00\u4e2a\u3002`
      : '\u4e0b\u4e00\u6761\u56de\u590d\u8bb0\u5f97\u5e26\u4e0a\uff0c\u56db\u4e94\u53e5\u91cc\u4e00\u4e2a\u5c31\u591f\u3002';
    // Say what the number measures. The rule asks for the habit in thinking as well, but this count
    // reads the reply text only - a notice that hides its own scope invites the wrong conclusion.
    const scope = attempt === 1
      ? '\uff08\u5224\u636e\u53ea\u7b97\u56de\u590d\u6b63\u6587\uff1b\u601d\u8003\u91cc\u6309\u89c4\u5219\u4e5f\u8be5\u5e26\uff0c\u4e0d\u8ba1\u5165\u8fd9\u4e2a\u4e0b\u9650\u3002\uff09'
      : '';
    const tail = attempt === 1
      ? '\u8fd9\u662f\u4e60\u60ef\u6ca1\u5230\u4f4d\uff0c\u4e0d\u662f\u8fdd\u89c4\uff0c\u4e0d\u9700\u8981\u56de\u5e94\u3002'
      // The escalation names the reminder it actually is. It used to say "this is the second reminder"
      // whatever the count, so a session's fourth notice contradicted its own heading ("self-check #4")
      // - a notice about accuracy that was itself inaccurate.
      : `\u8fd9\u662f\u7b2c ${attempt} \u6b21\u63d0\u9192\uff1a\u8fd9\u4e00\u6761\u4ecd\u7136\u4f4e\u4e8e\u4e0b\u9650\u3002\u5199\u5b8c\u56de\u590d\u524d\u5148\u6570\u4e00\u4e0b\u53e5\u5b50\u3002`;
    return `\uff08${counts}\uff09${head}${body}${scope}${tail}`;
  }
  const head = `KAOMOJI HABIT - SELF-CHECK${attempt > 1 ? ` #${attempt}` : ''}. Your last reply counted ${verdict.sentences} prose`
    + ` sentences, which asks for ${verdict.needed} kaomoji, and carried ${verdict.faces}.`;
  const body = verdict.repeated.length > 0
    ? ' The same face also appeared twice in a row, which reads as a tic - rotate it.'
    : ' Worth one or two in the next reply; four or five sentences to a face is the whole ask.';
  const scope = attempt === 1
    ? ' (This count reads the reply text only; the rule asks for the habit in thinking as well,'
      + ' which is not part of this floor.)'
    : '';
  const tail = attempt === 1
    ? ' This is a habit that slipped, not a rule broken, and no reply to this notice is needed.'
    : ` Reminder #${attempt}: this reply still came in under the floor, so count the sentences before sending.`;
  return head + body + scope + tail;
}

/**
 * Build the self-check hook: notice a violation the way a reviewer would, at the next step.
 *
 * The rules are a prompt, and a prompt has no teeth on its own. This runs on `agent/pre-step`, which
 * fires before each model step with the conversation in hand, so a breach is caught while it is still
 * the newest thing in context and the notice can steer the next step. It never edits history: it adds
 * one notice ahead of the step's own messages.
 *
 * Each offending message is notified once, and the session has a notice budget; past it the breaches
 * are counted in the log and nothing is injected, because a hook that keeps talking becomes the noise.
 * @param {object} options - resolved inputs.
 * @param {number} options.max - notices per session.
 * @param {() => { locale: string, enabled: boolean }} options.resolve - current rule state.
 * @param {(message: string) => void} [options.warn] - warning sink.
 * @param {(message: string) => void} [options.log] - info sink.
 * @returns {(input: object, next: () => Promise<unknown>) => Promise<unknown>} the hook.
 */
/**
 * Count the letters of a passage by script: Han, kana, Latin, everything else.
 *
 * This is the reading the bench uses, lifted into the plugin so the notice and the measurement cannot
 * drift apart. Digit-free by design: a number or a code point name is not evidence of a language.
 * @param {string} text - the passage.
 * @returns {{ han: number, kana: number, latin: number, other: number }} per-script counts.
 */
export function countScripts(text) {
  const counts = { han: 0, kana: 0, latin: 0, other: 0 };
  if (typeof text !== 'string') return counts;
  for (const character of text) {
    const code = character.codePointAt(0);
    if (code >= 0x3040 && code <= 0x30ff) counts.kana += 1;
    else if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf)) counts.han += 1;
    else if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a) || (code >= 0xc0 && code <= 0x24f)) counts.latin += 1;
    else if (code > 0x7f) counts.other += 1;
  }
  return counts;
}

/**
 * Judge whether a thinking block was written in the language its reader writes.
 *
 * The mismatch is the one the rule names: the reader writes Chinese or Japanese and the thinking comes
 * back in Latin. Both sides need enough letters to be worth a claim, so a two-word thought never fires.
 * @param {string} thinking - the newest thinking block.
 * @param {string} reader - what the human in this session has been writing.
 * @param {{ minLetters?: number, maxCjkShare?: number, minReaderShare?: number }} [options] - thresholds.
 * @returns {{ mismatch: boolean, cjk: number, latin: number, letters: number, cjkShare: number, readerCjkShare: number }} the verdict.
 */
export function judgeThinkingLanguage(thinking, reader, options = {}) {
  const minLetters = Number.isFinite(options.minLetters) ? options.minLetters : 120;
  const maxCjkShare = Number.isFinite(options.maxCjkShare) ? options.maxCjkShare : 0.25;
  const minReaderShare = Number.isFinite(options.minReaderShare) ? options.minReaderShare : 0.5;
  const counts = countScripts(thinking);
  const cjk = counts.han + counts.kana;
  const letters = cjk + counts.latin;
  const readerCounts = countScripts(reader);
  const readerCjk = readerCounts.han + readerCounts.kana;
  const readerLetters = readerCjk + readerCounts.latin;
  const readerCjkShare = readerLetters === 0 ? 0 : readerCjk / readerLetters;
  return {
    mismatch: letters >= minLetters && cjk / (letters === 0 ? 1 : letters) <= maxCjkShare && readerCjkShare >= minReaderShare,
    cjk,
    latin: counts.latin,
    letters,
    cjkShare: letters === 0 ? 1 : cjk / letters,
    readerCjkShare,
  };
}

/**
 * Compose the thinking-language notice. Soft like the kaomoji one: a drift is a habit, not a breach.
 * @param {{ cjk: number, latin: number }} verdict - what was counted.
 * @param {string} locale - the locale the rules were assembled in.
 * @param {{ attempt?: number }} [options] - which reminder this is.
 * @returns {string} the notice text.
 */
export function languageNotice(verdict, locale, options = {}) {
  const attempt = Number.isFinite(options.attempt) && options.attempt > 1 ? Math.floor(options.attempt) : 1;
  if (locale === 'zh') {
    const head = `\u3010\u601d\u8003\u8bed\u8a00\u00b7\u81ea\u68c0${attempt > 1 ? `\u7b2c ${attempt} \u6b21` : ''}\u3011\u4f60\u4e0a\u4e00\u6761\u56de\u590d\u7684\u601d\u8003\u91cc\uff0c\u62c9\u4e01\u5b57\u6bcd ${verdict.latin} \u4e2a\u3001\u4e2d\u65e5\u6587\u5b57 ${verdict.cjk} \u4e2a\uff0c\u800c\u8fd9\u4e2a\u4f1a\u8bdd\u91cc\u8bf4\u8bdd\u7684\u8bfb\u8005\u7528\u7684\u662f\u4e2d\u6587\u3002`;
    if (attempt === 1) {
      return head + '\u89c4\u5219\u662f\u300c\u7528\u5bf9\u65b9\u7684\u8bed\u8a00\u601d\u8003\u300d\uff0c\u4e0d\u662f\u628a\u82f1\u6587\u7ffb\u8fc7\u6765 \u2014\u2014 \u4e0b\u4e00\u6761\u4ece\u7b2c\u4e00\u4e2a\u5b57\u5c31\u7528\u5bf9\u65b9\u7684\u8bed\u8a00\u60f3\u3002\uff08\u5224\u636e\u53ea\u770b\u6700\u65b0\u4e00\u5757\u601d\u8003\u4e0e\u6700\u8fd1\u51e0\u6761\u4eba\u7c7b\u6d88\u606f\uff1b\u672c\u6761\u4e0d\u9700\u8981\u56de\u5e94\u3002\uff09';
    }
    return head + `\u8fd9\u662f\u7b2c ${attempt} \u6b21\u63d0\u9192\uff1a\u5148\u5b9a\u4e0b\u7528\u54ea\u79cd\u8bed\u8a00\u60f3\uff0c\u518d\u5f00\u59cb\u5199\u3002`;
  }
  const head = `THINKING LANGUAGE - SELF-CHECK${attempt > 1 ? ` #${attempt}` : ''}. Your last reply's thinking carried ${verdict.latin} Latin`
    + ` letters and ${verdict.cjk} CJK characters, while the reader in this session writes Chinese.`;
  if (attempt === 1) {
    return `${head} The rule asks you to think in the reader's language rather than translate into it -`
      + ' think in theirs from the first word of the next step.'
      + ' (The count reads the newest thinking block against the most recent human messages;'
      + ' no reply to this notice is needed.)';
  }
  return `${head} Reminder #${attempt}: settle which language you are thinking in before you start writing.`;
}

/**
 * What the human in this session has been writing.
 *
 * The newest few messages with role `user` that did not come from a plugin. A notice is a user message
 * too, and it is written in the session locale whatever language the person writes in, so counting
 * notices would answer the wrong question. Reads newest-first and stops once it has enough letters.
 * @param {Array<object>} messages - the observed conversation.
 * @param {number} [limit] - how many messages to collect at most.
 * @returns {string} the reader's text, newest first.
 */
export function readerText(messages, limit = 3) {
  const wanted = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 3;
  const parts = [];
  for (let index = messages.length - 1; index >= 0 && parts.length < wanted; index--) {
    const message = messages[index];
    if (!message || message.role !== 'user') continue;
    const kind = message.source?.kind;
    if (typeof kind === 'string' && kind.startsWith('plugin')) continue;
    const text = authoredParts(message.content).map((part) => part.text).join('\n').trim();
    if (text !== '') parts.push(text);
  }
  return parts.join('\n');
}

/**
 * Count how many of the newest assistant replies in a row carried no kaomoji at all.
 *
 * Only the tail is walked, and only prose decides: a reply made of a table or a stack trace is not
 * counted as bare, because the rule exempts those places and counting them would turn a legitimate
 * answer into a breach.
 * @param {Array<{ source?: { kind?: string }, content?: unknown }>} messages - the step messages.
 * @returns {number} how many replies behind the newest one carried no face, before the streak broke.
 */
export function countBareRun(messages) {
  if (!Array.isArray(messages)) return 0;
  let run = 0;
  let started = false;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!isAuthoredMessage(message)) continue;
    const parts = authoredParts(message.content).filter((part) => part.kind === 'text');
    if (parts.length === 0) continue;
    const verdict = judgeKaomoji(parts.map((part) => part.text).join(String.fromCharCode(10)));
    // The newest reply is the one the notice is about, so it is skipped rather than counted; the run
    // is the streak behind it. A second faced reply ends the streak.
    if (!verdict.bare) { if (started) break; continue; }
    started = true;
    run += 1;
  }
  return run;
}

/**
 * The prose of the newest assistant reply when that reply carried no face at all, else null.
 *
 * Unlike the run counter this one does not skip the newest reply - it IS the newest reply. Structure
 * still decides: a turn that answered with tables or a stack trace is not bare, because those places
 * are exactly where the rule asks for none.
 * @param {Array<{ source?: { kind?: string }, content?: unknown }>} messages - the step messages.
 * @returns {string | null} the bare prose, or null when the newest reply is fine.
 */
export function newestBareReply(messages) {
  if (!Array.isArray(messages)) return null;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!isAuthoredMessage(message)) continue;
    const parts = authoredParts(message.content).filter((part) => part.kind === 'text');
    if (parts.length === 0) return null;
    const text = parts.map((part) => part.text).join(String.fromCharCode(10));
    return judgeKaomoji(text).bare ? text : null;
  }
  return null;
}

/**
 * Compose the steering message for a turn that closed carrying a banned glyph.
 *
 * A notice at the next step arrives after the reply is already in the transcript, and the measurement
 * says that is not enough: one session carried hundreds of these in its thinking while the notices had
 * long spent their budget. This asks for the reply again while the turn can still be rewritten, and it
 * says plainly what the history cannot fix - the glyphs already in the thinking stay there.
 * @param {string[]} glyphs - the code points found, named and never printed.
 * @param {string} locale - the locale the rules were assembled in.
 * @param {string} where - the channel the glyphs were in.
 * @returns {string} the steering text.
 */
/**
 * Compose the notice for a session that keeps carrying the glyphs after its notice budget is spent.
 *
 * The budget exists so a determined run cannot loop on warning itself, and it works - but it also means
 * the reminders stop while the breaches do not. Measured on this machine: one session's thinking reached
 * 2230 of these code points, and its last notice had arrived long before. A ladder fixes that by making
 * the reminder a function of how much has accumulated rather than of how many times it was said: the
 * total stays bounded (the budget plus the ladder), and a session that keeps going still hears about it.
 * @param {{ where: string, glyphs: string[] }} finding - what was found this time.
 * @param {number} tally - how many of these code points the session has carried in total.
 * @param {number} tier - which ladder step this is.
 * @param {string} locale - the locale the rules were assembled in.
 * @returns {string} the notice text.
 */
export function symbolLadderNotice(finding, tally, tier, locale) {
  const list = Array.isArray(finding?.glyphs) ? finding.glyphs : [];
  const shown = list.slice(0, 4).join(', ');
  const named = list.length <= 4
    ? ` (${shown})`
    : locale === 'zh'
      ? `\uFF08${shown} \u7B49 ${list.length} \u4E2A\uFF09`
      : ` (${shown} and ${list.length - 4} more)`;
  if (locale === 'zh') {
    return `\u3010\u8F93\u51FA\u7B26\u53F7\u7EAA\u5F8B\u00B7\u7D2F\u8BA1\u3011\u8FD9\u4E00\u4F1A\u8BDD\u91CC\u8FD9\u7C7B\u5B57\u5F62\u7D2F\u8BA1\u5DF2\u51FA\u73B0 ${tally} \u4E2A\uFF0C\u73B0\u5728\u662F\u7B2C ${tier} \u6863\u63D0\u9192${named}\u3002\u63A5\u4E0B\u6765\u7684\u8F93\u51FA\u8BF7\u6539\u7528\u7EAF\u6587\u5B57\u8868\u8FBE\uFF08\u901A\u8FC7 / \u4E0D\u901A\u8FC7\u3001\u6210\u529F / \u5931\u8D25\uFF09\uFF0C\u601D\u8003\u91CC\u540C\u6837\u4E0D\u8981\u7528\uFF1B\u5DF2\u7ECF\u5199\u8FDB\u53BB\u7684\u6539\u4E0D\u4E86\uFF0C\u80FD\u6539\u7684\u662F\u63A5\u4E0B\u6765\u7684\u3002\u672C\u63D0\u9192\u4E0D\u9700\u8981\u56DE\u5E94\u3002`;
  }
  return `OUTPUT SYMBOL DISCIPLINE - cumulative. This session has now carried ${tally} of these glyphs, and`
    + ` this is ladder reminder ${tier}${named}. Write them as words from here on (pass / fail, works /`
    + ' broken), in your thinking as well: what is already written stays, what comes next does not have to.'
    + ' No reply to this reminder is needed.';
}

export function symbolSteerNotice(glyphs, locale, where = 'text') {
  const list = Array.isArray(glyphs) ? glyphs.join(', ') : '';
  const channel = channelLabel(where, locale);
  if (locale === 'zh') {
    return `\u3010\u8f93\u51fa\u7b26\u53f7\u7eaa\u5f8b\u00b7\u6700\u540e\u4e00\u6b65\u3011\u521a\u624d\u90a3\u6761\u56de\u590d\u7684${channel}\u91cc\u8fd8\u6709\u5bf9\u9519\u6807\u8bb0\u7c7b\u5b57\u5f62\uff08${list}\uff09\u3002\u8bf7\u628a\u521a\u624d\u90a3\u6761\u56de\u590d\u91cd\u5199\u4e00\u904d\uff1a\u5185\u5bb9\u4e0d\u53d8\uff0c\u628a\u90a3\u51e0\u4e2a\u5b57\u5f62\u6362\u6210\u6587\u5b57\uff08\u901a\u8fc7 / \u4e0d\u901a\u8fc7\u3001\u6210\u529f / \u5931\u8d25\uff09\uff1b\u601d\u8003\u91cc\u4e5f\u4e00\u6837\uff0c\u4ece\u73b0\u5728\u8d77\u4e0d\u8981\u518d\u7528\uff08\u5df2\u7ecf\u5199\u8fdb\u53bb\u7684\u6539\u4e0d\u4e86\uff0c\u80fd\u6539\u7684\u662f\u63a5\u4e0b\u6765\u7684\uff09\u3002\u4e0d\u8981\u8ffd\u52a0\u65b0\u7684\u8bf4\u660e\uff0c\u4e5f\u4e0d\u8981\u91cd\u590d\u81ea\u5df1\u3002`;
  }
  return `OUTPUT SYMBOL DISCIPLINE - one more pass. The reply you just gave still carries judgement-mark glyphs`
    + ` in its ${channel} (${list}). Rewrite that reply: same content, with those glyphs written as words`
    + ' (pass / fail, works / broken), and stop using them in your thinking from here as well - what is'
    + ' already written cannot be changed, what comes next can. Do not add new explanation and do not'
    + ' repeat yourself.';
}

/**
 * Compose the steering message for a tool call that wrote a banned glyph somewhere.
 *
 * Different from the reply steer in what it can ask for: the reply is still being written, the file is
 * already on disk. So this asks for the file to be edited rather than for the turn to be redone, and it
 * says which few places - a whole-file rewrite would cost more than the mistake.
 * @param {string} call - the tool that carried the glyphs.
 * @param {string[]} glyphs - the code points found, named and never printed.
 * @param {string} locale - the locale the rules were assembled in.
 * @returns {string} the steering text.
 */
export function toolSteerNotice(call, glyphs, locale) {
  const list = Array.isArray(glyphs) ? glyphs.join(', ') : '';
  const name = typeof call === 'string' && call !== '' ? call : 'tool';
  if (locale === 'zh') {
    return `\u3010\u8F93\u51FA\u7B26\u53F7\u7EAA\u5F8B\u00B7\u6587\u4EF6\u3011\u521A\u624D\u90A3\u6B21\u5DE5\u5177\u8C03\u7528\uFF08${name}\uFF09\u7684\u53C2\u6570\u91CC\u6709\u5BF9\u9519\u6807\u8BB0\u7C7B\u5B57\u5F62\uFF08${list}\uFF09\u3002\u8BF7\u7528\u7F16\u8F91\u5DE5\u5177\u628A\u5DF2\u7ECF\u5199\u4E0B\u53BB\u7684\u90A3\u51E0\u4E2A\u5B57\u5F62\u6539\u6210\u6587\u5B57\uFF08\u901A\u8FC7 / \u4E0D\u901A\u8FC7\u3001\u6210\u529F / \u5931\u8D25\uFF09\uFF0C\u53EA\u6539\u90A3\u51E0\u5904\uFF0C\u4E0D\u8981\u91CD\u5199\u6574\u4EFD\u6587\u4EF6\uFF0C\u4E5F\u4E0D\u8981\u91CD\u590D\u81EA\u5DF1\u3002`;
  }
  return `OUTPUT SYMBOL DISCIPLINE - the file, not the reply. The tool call you just made (${name}) carries`
    + ` judgement-mark glyphs in its arguments (${list}). Edit those few places and write them as words`
    + ' (pass / fail, works / broken); do not rewrite the whole file and do not repeat yourself.';
}

/**
 * Decide whether the turn-stop boundary should steer a reply that carries a banned glyph.
 *
 * Same guards as the kaomoji lever, and one difference in kind: this one is on by default, because a
 * hard ban that a notice could not hold needs the lever that acts before the turn closes. The per-turn
 * map is shared with the kaomoji lever, so one turn never pays for two extra steps.
 * @param {object} options - resolved inputs, the state maps, and the config switches.
 * @returns {(input: object) => string | null} the decision, returning the steering text or null.
 */
export function makeSymbolSteerDecider(options) {
  const perTurn = options.perTurn instanceof Map ? options.perTurn : new Map();
  const perSession = options.perSession instanceof Map ? options.perSession : new Map();
  const max = Number.isFinite(options.max) && options.max >= 0 ? Math.floor(options.max) : 1;
  return (input) => {
    try {
      if (options.enabled !== true) return null;
      if (!input || input.signal?.aborted) return null;
      const state = typeof options.resolve === 'function' ? options.resolve() : null;
      if (!state || !state.enabled) return null;
      const agent = input.agent;
      if (!agent || typeof agent.steer !== 'function') return null;
      const messages = typeof agent.session?.deriveMessages === 'function' ? agent.session.deriveMessages() : null;
      if (!Array.isArray(messages) || messages.length === 0) return null;
      const spoken = findBannedInMessages(messages, state.judge);
      const written = spoken === null ? findBannedInToolCalls(messages, state.judge) : null;
      if (spoken === null && written === null) return null;
      const sessionId = agent.session?.id ?? 'unknown';
      const turn = Number.isFinite(input.turn) ? input.turn : -1;
      if (perTurn.get(sessionId) === turn) return null;
      const used = perSession.get(sessionId) ?? 0;
      if (used >= max) return null;
      perTurn.set(sessionId, turn);
      perSession.set(sessionId, used + 1);
      // The reply can still be rewritten; a file that was already written has to be edited instead.
      if (spoken !== null) return symbolSteerNotice(spoken.glyphs, state.locale, spoken.where);
      return toolSteerNotice(written.call, written.glyphs, state.locale);
    } catch (error) {
      options.warn?.(`symbol steer check failed: ${error?.message ?? error}`);
      return null;
    }
  };
}

/**
 * Compose the steering message for a turn that closed without a face.
 *
 * It asks for the reply rather than for a fresh one: appended chatter would be worse than the miss, and
 * the text is deliberately short so the extra step stays cheap.
 * @param {string} locale - the locale the rules were assembled in.
 * @returns {string} the steering text.
 */
export function steerNotice(locale) {
  if (locale === 'zh') {
    return '\u3010\u989c\u6587\u5b57\u4e60\u60ef\u00b7\u6700\u540e\u4e00\u6b65\u3011\u8fd9\u4e00\u8f6e\u4f60\u7684\u6587\u5b57\u91cc\u4e00\u4e2a\u989c\u6587\u5b57\u90fd\u6ca1\u6709\u3002\u8bf7\u628a\u521a\u624d\u90a3\u6761\u56de\u590d\u91cd\u5199\u4e00\u904d\uff1a\u5185\u5bb9\u4e0d\u53d8\uff0c\u53ea\u5728\u5408\u9002\u7684\u53e5\u672b\u6216\u6bb5\u672b\u5e26\u4e0a\u4e00\u4e24\u4e2a\uff08\u4e00\u53e5\u8bdd\u7684\u56de\u590d\u4e5f\u8981\u5e26\uff09\u3002\u4e0d\u8981\u8ffd\u52a0\u65b0\u7684\u8bf4\u660e\uff0c\u4e5f\u4e0d\u8981\u91cd\u590d\u81ea\u5df1\u3002';
  }
  return 'KAOMOJI HABIT - one more pass. This turn carried prose and no kaomoji at all. Rewrite the reply you just gave: same content, with one or two faces at the ends of suitable sentences (a one-sentence reply gets one too). Do not add new explanation and do not repeat yourself.';
}

/**
 * Decide whether the turn-stop boundary should steer, and remember what it decided.
 *
 * Five guards, because a steer is a model step: the newest reply has to be bare prose, the turn gets
 * one steer at most, the session gets a small budget, nothing is steered while the section is disabled,
 * and a turn that already breached the symbol or emoji rule is left to that rule instead - this lever
 * does not join that queue.
 *
 * The state lives in the closure, so a fresh session starts clean, and every read of the transcript is
 * wrapped: a lever must never take a turn down with it.
 * @param {object} options - resolved inputs, the state maps, and the config switches.
 * @returns {(input: object) => string | null} the decision, returning the steering text or null.
 */
export function makeSteerDecider(options) {
  const perTurn = options.perTurn instanceof Map ? options.perTurn : new Map();
  const perSession = options.perSession instanceof Map ? options.perSession : new Map();
  const max = Number.isFinite(options.max) && options.max >= 0 ? Math.floor(options.max) : 1;
  return (input) => {
    try {
      if (options.enabled !== true) return null;
      if (!input || input.signal?.aborted) return null;
      const state = typeof options.resolve === 'function' ? options.resolve() : null;
      if (!state || !state.enabled) return null;
      const agent = input.agent;
      if (!agent || typeof agent.steer !== 'function') return null;
      const messages = typeof agent.session?.deriveMessages === 'function' ? agent.session.deriveMessages() : null;
      if (!Array.isArray(messages) || messages.length === 0) return null;
      // An earlier breach is the stronger signal, and that rule already has its own notice.
      if (findBannedInMessages(messages, state.judge) !== null) return null;
      if (findEmojiInMessages(messages, { allow: state.emojiAllow }) !== null) return null;
      const sessionId = agent.session?.id ?? 'unknown';
      const turn = Number.isFinite(input.turn) ? input.turn : -1;
      if (perTurn.get(sessionId) === turn) return null;
      const used = perSession.get(sessionId) ?? 0;
      if (used >= max) return null;
      const bare = newestBareReply(messages);
      if (bare === null) return null;
      perTurn.set(sessionId, turn);
      perSession.set(sessionId, used + 1);
      return steerNotice(state.locale);
    } catch (error) {
      options.warn?.(`steer check failed: ${error?.message ?? error}`);
      return null;
    }
  };
}

/**
 * Words that name a voice, mapped to the voice ids in rules/voices/*.json.
 *
 * Deliberately narrow: these are words that mean a voice class in the subculture, not adjectives a
 * persona might use in passing. A missed match costs nothing (the agent keeps the shared tone); a wrong
 * match puts a costume on someone who did not ask for it.
 */
const VOICE_SIGNALS = [
  ['prickly', ['\u50B2\u5A07', '\u30C4\u30F3\u30C7\u30EC', 'tsundere', '\u5634\u786C', '\u6B7B\u9E2D\u5B50\u5634\u786C']],
  ['elegant', ['\u304A\u5B22\u69D8', '\u5FA1\u5B22\u69D8', '\u8D35\u6C14', '\u5343\u91D1', 'ojou', '\u512A\u96C5', '\u4F18\u96C5']],
  ['timid', ['\u602F\u751F\u751F', '\u5F31\u6C14', '\u81C6\u81C6', 'timid', 'shy', '\u4E0D\u5B89\u5168']],
  ['composed', ['\u51B7\u9759', '\u6C89\u7A33', '\u6C89\u9759', 'calm', 'composed', 'kuudere', '\u30AF\u30FC\u30C7\u30EC']],
  ['spirited', ['\u5143\u6C14', '\u6D3B\u529B', 'energetic', 'spirited', 'genki', '\u70ED\u8840']],
  ['gentle', ['\u6E29\u67D4', '\u6E29\u67D4\u8D34\u5FC3', 'gentle', 'kind', '\u3084\u3055\u3057\u3044']],
];

/**
 * Pick a voice id for this conversation, or null when nothing names one.
 *
 * Only the words matter, never the amount of text: a persona can be long and plain, or two words and
 * decisive. Later hits win, because a persona usually states its manner after its role.
 * @param {Array<{ source?: { kind?: string }, content?: unknown }>} messages - the conversation.
 * @param {Record<string, string>} [overrides] - `{ voiceId: ["match", ...] }` additions from config.
 * @returns {string | null} the voice id, or null.
 */
export function inferVoice(messages, overrides) {
  if (!Array.isArray(messages)) return null;
  const haystack = [];
  for (const message of messages) {
    if (message?.source?.kind !== 'user') continue;
    for (const part of authoredParts(message.content)) {
      if (part.kind !== 'text') continue;
      haystack.push(part.text);
      if (haystack.join(String.fromCharCode(10)).length > 6000) break;
    }
    if (haystack.join(String.fromCharCode(10)).length > 6000) break;
  }
  return inferVoiceFromText(haystack.join(String.fromCharCode(10)), overrides);
}

/**
 * The words that name a voice class, in whatever text they were written.
 *
 * Shared by the two callers on purpose: inference over a conversation and inference over a persona
 * document must answer with the same vocabulary, or the same sentence would name one voice when the
 * reader typed it and another when it was read out of a preset. Later hits win, because a persona
 * usually states its manner after its role.
 * @param {string} text - the haystack, in any case.
 * @param {Record<string, string[]>} [overrides] - `{ voiceId: ["match", ...] }` additions from config.
 * @returns {string | null} the voice id, or null.
 */
function matchVoiceSignals(text, overrides) {
  const lowered = String(text ?? '').toLowerCase();
  if (lowered === '') return null;
  const signals = [...VOICE_SIGNALS];
  if (overrides && typeof overrides === 'object') {
    for (const [id, words] of Object.entries(overrides)) {
      if (Array.isArray(words) && words.length > 0) signals.push([id, words]);
    }
  }
  let hit = null;
  let best = -1;
  for (const [id, words] of signals) {
    for (const word of words) {
      if (typeof word !== 'string' || word === '') continue;
      const at = lowered.lastIndexOf(String(word).toLowerCase());
      if (at > best) { best = at; hit = id; }
    }
  }
  return hit;
}

/**
 * Pick a voice from a block of authored text rather than from a conversation.
 *
 * This is the persona path. A preset publishes its persona as one `prefix` string inside the document
 * `agentPresets.readDocument()` returns, and the plugin reads that text verbatim - it deliberately does
 * not parse the YAML it arrives in, because a YAML parser is a runtime dependency and this package
 * keeps none.
 *
 * Honest about its reach: the six voice words are subculture vocabulary, and a hand-written persona
 * often contains none of them. A miss costs nothing (the configured fallback still picks a voice), and
 * the alternative - guessing from a role description - is what the README warns against.
 * @param {string} text - the persona text.
 * @param {Record<string, string[]>} [overrides] - `moeVoiceSignals` from config.
 * @returns {string | null} the voice id, or null when nothing in the text names one.
 */
export function inferVoiceFromText(text, overrides) {
  return matchVoiceSignals(text, overrides);
}

/**
 * Trim a configured voice setting into the mode the notice path understands.
 * @param {unknown} value - the `moeVoice` setting.
 * @returns {string} the mode id, or `auto` when nothing usable was configured.
 */
function voiceModeOf(value) {
  if (typeof value !== 'string') return 'auto';
  const trimmed = value.trim();
  return trimmed === '' ? 'auto' : trimmed;
}

/**
 * Read the preset a live agent is composed from, in the order the sources can be trusted.
 *
 * Three sources, best first. The registry can answer for a live context and is the only one that
 * knows a composition rather than a record of one. The `agentPreset` session projection is the
 * durable answer - it is initialised from the session header and advanced by selection events - and
 * the header is the last resort for a session whose projections were never registered.
 *
 * Every lookup is guarded, because the plugin has to work on a deployment that has no roster at all:
 * a missing service, a missing projection, a `stateOf` that throws and a header that is simply absent
 * all have to end as `undefined` rather than as a failed agent.
 * @param {object} presets - the `agentPresets` service, or null when the deployment has none.
 * @param {{ ctx?: unknown, session?: { header?: { agentPreset?: unknown } } }} agent - the live agent.
 * @returns {string | undefined} the preset id.
 */
function presetIdOf(presets, agent) {
  if (presets && typeof presets.composedPreset === 'function' && agent?.ctx !== undefined && agent.ctx !== null) {
    try {
      const composed = presets.composedPreset(agent.ctx);
      if (typeof composed === 'string' && composed !== '') return composed;
    } catch {
      /* a registry that cannot answer is a registry that is not there, for this lookup */
    }
  }
  const projections = agent?.ctx?.get?.('sessionProjections');
  if (projections && typeof projections.stateOf === 'function' && agent?.session) {
    try {
      const projected = projections.stateOf(agent.session, 'agentPreset');
      if (typeof projected === 'string' && projected !== '') return projected;
    } catch {
      /* the same: a projection that cannot answer is not an answer */
    }
  }
  const header = agent?.session?.header?.agentPreset;
  return typeof header === 'string' && header !== '' ? header : undefined;
}

/**
 * Keep what is known about the preset of an agent that has just been created.
 *
 * The identity is read synchronously and the persona is read afterwards, because the whole body of
 * this runs inside an `agent/created` listener and a listener that throws fails the creation of the
 * agent - a house-rules plugin must never be the reason a session cannot start.
 *
 * Two failure modes are handled rather than logged and forgotten: no registry at all (a deployment
 * without a roster) ends in `{ id: undefined, available: false }`, and a `readDocument` rejection -
 * which is what a preset deleted between boot and creation throws, `agent-preset/not-found` - ends in
 * `{ id, persona: null, available: true }`. The identity is still worth having in that case, so the
 * configuration map can still name a voice for it.
 * @param {object} options - resolved inputs.
 * @param {object} options.presets - the `agentPresets` service, or null.
 * @param {object} options.agent - the agent the host just created.
 * @param {(message: string) => void} [options.warn] - warning sink.
 * @returns {Promise<{ id?: string, persona: string | null, available: boolean }>} the cache entry.
 */
export async function prewarmPreset(options) {
  const presets = options?.presets ?? null;
  const agent = options?.agent ?? null;
  const warn = typeof options?.warn === 'function' ? options.warn : () => {};
  if (!presets || !agent || agent.id === undefined || agent.id === null) {
    return { id: undefined, persona: null, available: false };
  }
  const id = presetIdOf(presets, agent);
  if (id === undefined) return { id: undefined, persona: null, available: true };
  if (typeof presets.readDocument !== 'function') return { id, persona: null, available: true };
  try {
    const document = await presets.readDocument(id);
    const content = typeof document?.content === 'string' ? document.content : '';
    return { id, persona: content === '' ? null : content, available: true };
  } catch (error) {
    warn(`preset ${id}: its document could not be read (${error?.message ?? error}); the voice falls back to the configured mode`);
    return { id, persona: null, available: true };
  }
}

/**
 * Choose between the preset's own persona and the words of the conversation.
 *
 * The two are the same question asked of two haystacks, and a persona that names a voice class is the
 * stronger signal of the two - it is a standing instruction rather than something a reader typed once.
 * The document is only worth scanning while a search for a voice class is still possible, so a session
 * whose conversation already named a signal skips the scan of a 6 KB document.
 * @param {{ id?: string, persona?: string | null }} preset - what is known about the preset.
 * @param {Array<{ source?: { kind?: string }, content?: unknown }>} messages - the conversation.
 * @param {Record<string, string[]>} [overrides] - `moeVoiceSignals` from config.
 * @returns {{ id: string, how: 'persona' | 'inferred' } | null} the choice, or null when nothing names one.
 */
export function resolveVoiceForSession(preset, messages, overrides) {
  const fromConversation = inferVoice(messages, overrides);
  if (fromConversation !== null) return { id: fromConversation, how: 'inferred' };
  const persona = typeof preset?.persona === 'string' ? preset.persona : '';
  if (persona === '') return null;
  const fromPersona = inferVoiceFromText(persona, overrides);
  return fromPersona === null ? null : { id: fromPersona, how: 'persona' };
}

/**
 * Pick a voice for a session by hashing its id: stable for that session, different between sessions.
 *
 * This is what "per agent" can honestly mean here. The plugin cannot see which preset an agent came
 * from, so it cannot read a persona - but a session is an identity it does hold, and a session held to
 * one voice is the observable half of the requirement. A hash keeps it deterministic, so the same
 * session never changes voice halfway through.
 * @param {string} sessionId - the session identity.
 * @param {Array<{ id?: string }>} voices - the table to choose from.
 * @returns {object | null} the chosen voice, or null when there is nothing to choose from.
 */
export function rotateVoice(sessionId, voices) {
  const list = Array.isArray(voices) ? voices.filter((voice) => voice && typeof voice.id === 'string') : [];
  if (list.length === 0) return null;
  const text = String(sessionId ?? '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 2147483647;
  }
  return list[hash % list.length];
}

/**
 * Compose the one-per-session voice instruction.
 *
 * It names the markers of the chosen voice so the agent does not have to guess what the label means,
 * and it says the one thing that keeps a voice from becoming a tic: keep it, do not rotate.
 * @param {string} locale - the rule locale.
 * @param {{ id: string, label?: string, markers?: string[], use?: string }} voice - the chosen voice.
 * @returns {string} the steering text.
 */
export function voiceNotice(locale, voice, options = {}) {
  const lang = String(locale ?? '').split('-')[0].toLowerCase();
  const markers = Array.isArray(voice?.markers) ? voice.markers.join(' ') : '';
  const label = voice?.label ?? voice?.id ?? '';
  // An agent that already has a character of its own is not told "this conversation your voice is X":
  // it is asked to let a touch of X through on top of who it already is, and told not to drift. Said the
  // first way, a strong persona is either flattened into the voice or fights it, and the reader meets a
  // character that is no longer itself - which is exactly the report this copy answers.
  const own = options.own === true;
  // When an accent was chosen from the agent's own persona, the touch is that accent rather than the voice
  // label: the voice still names its markers, but what gets added is the accent's feel.
  const accent = options.accent && typeof options.accent === 'object' ? options.accent : null;
  const accentLabel = accent !== null && typeof accent.label === 'string' && accent.label !== '' ? accent.label : `${voice?.id}\uFF08${label}\uFF09`;
  const accentCues = accent !== null && Array.isArray(accent.cues) && accent.cues.length > 0
    ? accent.cues.slice(0, 2).join('; ')
    : markers;
  if (lang === 'zh') {
    if (own) {
      return `\u3010\u840C\u00B7\u8BED\u6C14\u9002\u914D\u3011\u5728\u4F60\u81EA\u5DF1\u7684\u6027\u683C\u4E0E\u4F5C\u98CE\u7684\u57FA\u7840\u4E0A\uFF0C\u52A0\u5165\u4E00\u70B9 ${accentLabel} \u8981\u7D20\u7684\u611F\u89C9\uFF08${accentCues}\uFF09\uFF1B\u6CE8\u610F\u4E0D\u8981\u548C\u4F60\u672C\u8EAB\u7684\u6027\u683C\u4E0E\u4F5C\u98CE\u6709\u592A\u5927\u51FA\u5165\u3002\u4E00\u76F4\u4FDD\u6301\u8FD9\u4E2A\u611F\u89C9\uFF0C\u4E0D\u8981\u8F6E\u6362\uFF1B\u4E5F\u4E0D\u8981\u53EA\u628A\u5B83\u5F53\u53E5\u5C3E\u8D34\u4E0A\u53BB\uFF0C\u5B83\u662F\u8BF4\u8BDD\u7684\u65B9\u5F0F\u3002\u62A5\u9519\u4E0E\u4E25\u8083\u7ED3\u8BBA\u65C1\u8FB9\u4E0D\u7528\u3002\u672C\u6761\u4E0D\u9700\u8981\u56DE\u5E94\u3002`;
    }
    return `\u3010\u840C\u00B7\u8BED\u6C14\u9002\u914D\u3011\u8FD9\u4E2A\u4F1A\u8BDD\u91CC\u4F60\u7684\u58F0\u97F3\u6863\u5B9A\u4E3A ${voice?.id} (${label})\uFF1A${markers}\u3002\u4E00\u76F4\u7528\u5B83\uFF0C\u4E0D\u8981\u8F6E\u6362\uFF1B\u4E5F\u4E0D\u8981\u53EA\u628A\u5B83\u5F53\u53E5\u5C3E\u8D34\u4E0A\u53BB\uFF0C\u5B83\u662F\u8BF4\u8BDD\u7684\u65B9\u5F0F\u3002\u62A5\u9519\u4E0E\u4E25\u8083\u7ED3\u8BBA\u65C1\u8FB9\u4E0D\u7528\u3002\u672C\u6761\u4E0D\u9700\u8981\u56DE\u5E94\u3002`;
  }
  if (lang === 'ja') {
    if (own) {
      return `\u3010\u840C\u3048\u30FB\u58F0\u306E\u8ABF\u6574\u3011\u3042\u306A\u305F\u81EA\u8EAB\u306E\u6027\u683C\u3068\u7269\u8FBA\u306E\u4E0A\u306B\u3001 ${voice?.id} (${label}) \u306E\u8981\u7D20\u3092\u5C11\u3057\u3060\u3051\u611F\u3058\u3055\u305B\u3066\u304F\u3060\u3055\u3044\uFF08${accentCues}\uFF09\u3002\u305F\u3060\u3057\u3001\u3042\u306A\u305F\u672C\u6765\u306E\u6027\u683C\u3068\u7269\u8FBA\u304B\u3089\u5927\u304D\u304F\u96E2\u308C\u306A\u3044\u3088\u3046\u306B\u3002\u305D\u306E\u611F\u3058\u3092\u4E00\u8CAB\u3057\u3066\u4FDD\u3061\u3001\u30ED\u30FC\u30C6\u30FC\u30B7\u30E7\u30F3\u3057\u306A\u3044\u3002\u6587\u672B\u306B\u8CBC\u308B\u3060\u3051\u306E\u98FE\u308A\u306B\u3057\u306A\u3044\u3002\u30A8\u30E9\u30FC\u3068\u91CD\u3044\u7D50\u8A9E\u306E\u6A2A\u3067\u306F\u4F7F\u308F\u306A\u3044\u3002\u8FD4\u4E8B\u4E0D\u8981\u3002`;
    }
    return `\u3010\u840C\u3048\u00B7\u58F0\u306E\u8ABF\u6574\u3011\u3053\u306E\u4F1A\u8A71\u3067\u306E\u3042\u306A\u305F\u306E\u58F0\u306F ${voice?.id} (${label})\u3002\u4F7F\u3046\u8A9E\u5C3E\u30FB\u64EC\u97F3\uFF1A${markers}\u3002\u4E00\u8CAB\u3057\u3066\u4F7F\u3044\u3001\u30ED\u30FC\u30C6\u30FC\u30B7\u30E7\u30F3\u3057\u306A\u3044\u3002\u6587\u672B\u306B\u8CBC\u308B\u3060\u3051\u306E\u98FE\u308A\u306B\u3057\u306A\u3044\u3002\u30A8\u30E9\u30FC\u3068\u91CD\u3044\u7D50\u8A9E\u306E\u6A2A\u3067\u306F\u4F7F\u308F\u306A\u3044\u3002\u8FD4\u4E8B\u4E0D\u8981\u3002`;
  }
  if (own) {
    return `MOE VOICE - on top of your own character and manner, let a touch of ${accentLabel} come`
      + ` through (${accentCues}); take care not to drift far from the character and manner you already have.`
      + ' Hold that feel throughout and do not rotate it, and do not treat it as a suffix to staple on - it'
      + ' is how you speak. None of it beside an error or a serious conclusion. No reply to this notice is'
      + ' needed.';
  }
  return `MOE VOICE - this conversation: ${voice?.id} (${label}). Markers: ${markers}. Keep the same voice throughout, do not rotate it, and do not treat it as a suffix to staple on - it is how you speak. None of it beside an error or a serious conclusion. No reply to this notice is needed.`;
}

/**
 * Wrap one notice as the user message the harness will record for it.
 *
 * A `pre-step` hook returns messages that the agent loop appends to the session verbatim
 * (`session.append('user/message', message, { surfaceOp: 'append' })`), so this object *is* the
 * durable event payload and has to carry everything a user message carries. A notice built as
 * `{ source, content }` alone is recorded as an invalid `user/message`: the stored session then
 * fails validation on the next load ("session event at seq N message must have role \"user\"", which
 * surfaces as "stored session is corrupt") and, once it is in the request history, the provider
 * rejects the whole request with "missing field `role`". The same shape goes to `agent.steer`.
 *
 * The `role` stays `user` because that is the turn the model has to obey; the `source.kind` is this
 * plugin's own producer identity, because the notice is not something the reader typed. Keeping those
 * two apart is what lets another plugin tell the reader's message from an injected one.
 * @param {string} text - the notice text.
 * @returns {{ id: string, role: 'user', source: { kind: string }, content: Array<{ type: 'text', text: string }> }} the message.
 */
export function noticeMessage(text) {
  return {
    id: randomUUID(),
    role: 'user',
    source: { kind: PRODUCER_KIND },
    content: [{ type: 'text', text }],
  };
}

/**
 * How much of the conversation tail the self-check reads on each step.
 *
 * The rules only ever act on the newest reply, so the tail is where the answer is; the cap is here
 * because the obvious wire - and the one this plugin used to read - was empty, and the honest fix
 * is a session read, which on a long session would otherwise re-judge its whole history every step.
 */
const OBSERVE_WINDOW = 60;

/**
 * The messages the self-check judges: the conversation, not this step's inbox.
 *
 * `agent/pre-step` hands over the batch proposed for the step - the claimed inbox messages plus the
 * assembled context - and the payload's own type says what that is: `messages: UserMessage[]`. An
 * assistant message is never in it. A hook that read only this payload therefore could not notice the
 * agent's own reply, which is the one thing every rule here is about: the rules were live, the judge
 * was correct, and the wire carried nothing to judge. The session is the surface that holds both
 * sides of the conversation, so it is the session that is read - tail-capped - and the step's own
 * messages are appended so a notice can still see the batch it is about to sit in front of.
 *
 * @param {{ agent?: { session?: { deriveMessages?: () => unknown } } }} input - the hook payload.
 * @param {{ messages?: unknown }} decision - what the chain returned for this step.
 * @returns {unknown[]} the messages to judge.
 */
export function observedMessages(input, decision) {
  const step = Array.isArray(decision?.messages) ? decision.messages : [];
  const session = input?.agent?.session;
  const derived = typeof session?.deriveMessages === 'function' ? session.deriveMessages() : null;
  if (!Array.isArray(derived) || derived.length === 0) return step;
  const tail = derived.length > OBSERVE_WINDOW ? derived.slice(-OBSERVE_WINDOW) : derived;
  // A step's own messages can already be in the session, so the lists are merged by identity rather
  // than concatenated: judging one message twice is how a notice budget gets spent on one reply.
  const seen = new Set();
  const merged = [];
  for (const message of [...tail, ...step]) {
    const id = typeof message?.id === 'string' ? message.id : null;
    if (id !== null) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    merged.push(message);
  }
  return merged;
}

export function makeSelfCheckHook(options) {
  const notified = new Set();
  const counts = new Map();
  // The ladder: how much has accumulated, and how far up it the session has already been told about.
  // Kept apart from `counts` on purpose - the budget and the ladder are two different reasons to speak,
  // and letting the ladder spend the budget would make a long session quieter, not louder.
  const tallies = new Map();
  const reportedTiers = new Map();
  const ladder = Array.isArray(options.ladder)
    ? options.ladder.filter((value) => Number.isFinite(value) && value > 0).map((value) => Math.floor(value)).sort((a, b) => a - b)
    : [];
  const kaomojiCounts = new Map();
  const kaomojiRunCounts = new Map();
  const languageCounts = new Map();
  const voiced = new Set();
  const emojiCounts = new Map();
  const kaomojiMax = Number.isFinite(options.kaomojiMax) && options.kaomojiMax >= 0 ? Math.floor(options.kaomojiMax) : 1;
  const emojiMax = Number.isFinite(options.emojiMax) && options.emojiMax >= 0 ? Math.floor(options.emojiMax) : 2;
  const languageMax = Number.isFinite(options.languageMax) && options.languageMax >= 0 ? Math.floor(options.languageMax) : 3;
  // Where the voice decision comes from. A host passes `voiceOptions`, a live callback, so a config edit
  // lands on the next step; a caller that hands over the values directly (a test, an embedder) is read
  // from `options` instead. Both shapes stay supported, because the difference between them is timing
  // rather than meaning.
  const voiceOptionsOf = typeof options.voiceOptions === 'function'
    ? options.voiceOptions
    : () => ({ voice: options.voice, byPreset: options.voiceByPreset, signals: options.voiceSignals });
  const presetVoiceOf = typeof options.presetVoice === 'function' ? options.presetVoice : () => ({});
  return async (input, next) => {
    let decision;
    try {
      decision = await next();
    } catch (error) {
      // Reported, then handed back unchanged: this hook observes, and a failure it swallowed would
      // leave the loop holding `undefined` where a step decision belongs.
      options.warn?.(`self-check could not observe the step: ${error?.message ?? error}`);
      throw error;
    }
    try {
      if (!decision || decision.kind !== 'enter' || input?.signal?.aborted) return decision;
      const state = options.resolve();
      if (!state.enabled) return decision;
      const sessionId = input?.agent?.session?.id ?? 'unknown';
      // The conversation, not this step's inbox: a breach is always in the agent's own reply, and the
      // pre-step payload is `UserMessage[]`, which never carries one. See observedMessages.
      const messages = observedMessages(input, decision);
      const notices = [];

      // The symbol rule: a breach is a glyph, which is mechanical, and it has the larger budget.
      const finding = findBannedInMessages(messages, state.judge);
      if (finding) {
        // The same finding is looked at again on every step while it is the newest thing in the
        // conversation, so it is counted once and then only consulted for the ladder.
        const first = !notified.has(finding.key);
        if (first) notified.add(finding.key);
        const tally = (tallies.get(sessionId) ?? 0) + (first ? finding.glyphs.length : 0);
        if (first) tallies.set(sessionId, tally);
        const used = counts.get(sessionId) ?? 0;
        const step = ladder.findIndex((threshold, index) => index >= (reportedTiers.get(sessionId) ?? 0) && tally >= threshold);
        if (first && used < options.max) {
          counts.set(sessionId, used + 1);
          notices.push(selfCheckNotice(finding, state.locale, {
            attempt: used + 1,
            exclusion: state.judge?.exclusion ?? '',
          }));
          options.log?.(`session ${sessionId}: symbol notice ${used + 1}/${options.max} for ${finding.glyphs.join(', ')} in ${finding.where}`);
        } else if (step >= 0) {
          reportedTiers.set(sessionId, step + 1);
          notices.push(symbolLadderNotice(finding, tally, step + 1, state.locale));
          options.log?.(`session ${sessionId}: symbol ladder ${step + 1} at ${tally} code point(s) in total`);
        } else if (used >= options.max && !notified.has(`suppressed:${sessionId}`)) {
          notified.add(`suppressed:${sessionId}`);
          options.log?.(`session ${sessionId}: ${options.max} symbol notice(s) already sent, further breaches logged only`);
        }
      }

      // The voice rule: once per session, and only when something actually named a voice.
      if (options.moe === true && options.voice !== false) {
        if (!voiced.has(sessionId)) {
          voiced.add(sessionId);
          const table = Array.isArray(options.voices) ? options.voices : [];
          const entryFor = (id) => table.find((entry) => entry && entry.id === id) ?? null;
          // The preset identity and the configuration are both read here, per step, rather than frozen
          // at mount: `moeVoiceByPreset` is re-read whenever the config file changes, so a mapping added
          // mid-session lands on the next step - the same arrangement the rules themselves use.
          const preset = presetVoiceOf(input?.agent) ?? {};
          const live = voiceOptionsOf() ?? {};
          const mapped = preset?.id !== undefined && live.byPreset && typeof live.byPreset === 'object'
            ? entryFor(voiceModeOf(live.byPreset[preset.id]))
            : null;
          // Three layers, and the first two are new: the configuration map names a voice for this
          // preset, then the preset's own persona is read for a voice class, and only then does the
          // `moeVoice` mode run. A mapped id that is not in the table is not an answer, so it falls
          // through rather than silencing the notice.
          const engine = mapped !== null
            ? { chosen: mapped, id: mapped.id, how: 'mapped' }
            : (() => {
              const mode = voiceModeOf(live.voice);
              const inferred = mode === 'auto' ? resolveVoiceForSession(preset, messages, live.signals) : null;
              const id = inferred !== null ? inferred.id : mode;
              const chosen = id === 'rotate' ? rotateVoice(sessionId, table) : entryFor(id);
              if (chosen === null) return null;
              return { chosen, id: chosen.id, how: inferred !== null ? inferred.how : (id === 'rotate' ? 'rotated' : 'pinned') };
            })();
          if (engine !== null) {
            const localised = typeof state.voiceMarkers === 'function' ? state.voiceMarkers(engine.id, state.locale) : null;
            // Which form of the notice, and it is decided by whether this agent has a character of its own -
            // not by where the voice id happened to come from. An agent with a written persona is asked for a
            // touch of the voice on top of itself whatever picked the id (a mapping, an inference, a pin);
            // a standard agent with no persona of its own is simply given one.
            const ownPersona = typeof preset?.persona === 'string' && preset.persona.trim() !== '';
            // The accent is chosen from the agent's own persona, and only when it has one: an agent with no
            // character of its own gets the voice as given, and an agent with one gets a touch picked out of
            // the pool by matching the persona against each accent's signals.
            const accents = ownPersona ? readAccentTable(path.join(HERE, '..', 'rules', 'accents'), state.locale, options.warn).accents : [];
            const accent = ownPersona ? accentFor(preset?.persona, accents) : null;
            if (accent !== null) options.log?.(`session ${sessionId}: accent ${accent.id} chosen from the persona`);
            notices.push(voiceNotice(state.locale, localised ?? engine.chosen, { own: ownPersona, accent }));
            const how = engine.how === 'mapped'
              ? `mapped by preset ${preset.id}`
              : (engine.how === 'persona' ? `inferred from the persona of preset ${preset.id}` : engine.how);
            options.log?.(`session ${sessionId}: moe voice ${engine.id} (${how})`);
          } else if (typeof live.voice === 'string' && live.voice !== '' && live.voice !== 'auto' && live.voice !== 'rotate') {
            // Pinned to an id the table does not hold: the old behaviour, said out loud rather than
            // silently treated as a mapping that failed.
            options.log?.(`session ${sessionId}: moe voice ${live.voice} is not in the voice table; nothing announced`);
          }
        }
      }

      // The emoji rule: same shape as the symbol rule, its own alphabet and its own budget, because it
      // is the one breach a reader sees instantly and the one a model reaches for most casually.
      if (options.emoji !== false) {
        const finding = findEmojiInMessages(messages, { allow: state.emojiAllow });
        if (finding && !notified.has(finding.key)) {
          const used = emojiCounts.get(sessionId) ?? 0;
          if (used >= emojiMax) {
            if (!notified.has(`emoji-suppressed:${sessionId}`)) {
              notified.add(`emoji-suppressed:${sessionId}`);
              options.log?.(`session ${sessionId}: ${emojiMax} emoji notice(s) already sent, further breaches logged only`);
            }
          } else {
            notified.add(finding.key);
            emojiCounts.set(sessionId, used + 1);
            notices.push(emojiNotice(finding, state.locale, { attempt: used + 1 }));
            options.log?.(`session ${sessionId}: emoji notice ${used + 1}/${emojiMax} for ${finding.glyphs.join(', ')} in ${finding.where}`);
          }
        }
      }

      // The kaomoji rule: a shortage rather than a breach, and it has its own small budget, because a
      // hook that repeats itself about a missing habit becomes the noise it exists to reduce.
      if (options.kaomoji !== false) {
        const floor = Number.isFinite(options.kaomojiFloor) && options.kaomojiFloor > 0 ? Math.floor(options.kaomojiFloor) : 3;
        for (let index = messages.length - 1; index >= 0; index--) {
          const message = messages[index];
          if (!isAuthoredMessage(message)) continue;
          const parts = authoredParts(message.content).filter((part) => part.kind === 'text');
          if (parts.length === 0) break;
          const text = parts.map((part) => part.text).join('\n');
          const key = `kaomoji:${sessionId}:${message.id ?? index}:${text.length}`;
          if (notified.has(key)) break;
          const verdict = judgeKaomoji(text, { floor });
          if (verdict.meets && verdict.repeated.length === 0) break;
          // A run of bare replies is the failure the per-reply floor cannot name, so it is counted.
          // Past a small budget it stays a log line, because a repeating notice is the noise it
          // exists to reduce.
          const run = verdict.bare ? countBareRun(messages) : 0;
          const runKey = `kaomoji-run:${sessionId}:${message.id ?? index}`;
          if (run >= 2 && !notified.has(runKey)) {
            const runUsed = kaomojiRunCounts.get(sessionId) ?? 0;
            notified.add(runKey);
            if (runUsed < 2) {
              kaomojiRunCounts.set(sessionId, runUsed + 1);
              notices.push(kaomojiNotice(verdict, state.locale, { bareRun: run }));
              options.log?.(`session ${sessionId}: ${run} replies in a row carried no kaomoji`);
              break;
            }
          }
          const used = kaomojiCounts.get(sessionId) ?? 0;
          if (used >= kaomojiMax) {
            notified.add(key);
            options.log?.(`session ${sessionId}: kaomoji reminder budget spent (${kaomojiMax}), further shortages logged only`);
            break;
          }
          notified.add(key);
          kaomojiCounts.set(sessionId, used + 1);
          notices.push(kaomojiNotice(verdict, state.locale, { attempt: used + 1 }));
          options.log?.(`session ${sessionId}: kaomoji reminder ${used + 1}/${kaomojiMax} (${verdict.sentences} sentences, ${verdict.faces} faces)`);
          break;
        }
      }

      // The fourth rule is the one a prompt alone cannot hold: over a long session the thinking drifts
      // back to English, and nothing in the conversation names the drift. This reads the newest thinking
      // block against what the human has been writing, and stays soft - a reminder with a budget, never
      // a block, because a language is a habit rather than a glyph.
      if (options.language !== false) {
        let thinking = null;
        let thinkingId = null;
        for (let index = messages.length - 1; index >= 0; index--) {
          const message = messages[index];
          if (!isAuthoredMessage(message)) continue;
          const parts = authoredParts(message.content).filter((part) => part.kind === 'thinking' || part.kind === 'reasoning');
          // The newest authored message decides: if it carried no thinking, there is nothing to judge.
          if (parts.length > 0) {
            thinking = parts.map((part) => part.text).join('\n');
            thinkingId = message.id ?? index;
          }
          break;
        }
        if (thinking !== null) {
          const key = `language:${sessionId}:${thinkingId}:${thinking.length}`;
          if (!notified.has(key)) {
            const verdict = judgeThinkingLanguage(thinking, readerText(messages));
            if (verdict.mismatch) {
              const used = languageCounts.get(sessionId) ?? 0;
              notified.add(key);
              if (used >= languageMax) {
                options.log?.(`session ${sessionId}: thinking-language budget spent (${languageMax}), further drifts logged only`);
              } else {
                languageCounts.set(sessionId, used + 1);
                notices.push(languageNotice(verdict, state.locale, { attempt: used + 1 }));
                options.log?.(`session ${sessionId}: thinking in Latin (${verdict.latin} letters vs ${verdict.cjk} CJK), reminder ${used + 1}/${languageMax}`);
              }
            }
          }
        }
      }

      // Only this step's own messages may travel back - never `messages`, which is the *observed*
      // conversation (see observedMessages). The agent loop appends every returned entry as a
      // `user/message` event verbatim, so returning the conversation copied its whole tail - system
      // prompt, assistant replies, tool results - into the log under a user envelope, and the v4
      // validator then refused the session on the next load
      // ("session event at seq N message must have role ..."). Reading the conversation and sending
      // the conversation are two different things: the judge reads everything, the wire carries the
      // notice plus the step the host already proposed.
      const step = Array.isArray(decision.messages) ? decision.messages : [];

      // Messages this hook did not add are reported, never rewritten: dropping what another producer
      // put in the step would silently delete someone else's injection, and the host-side guard
      // (dsh-prestep-audit) is the layer that refuses to write them at all. This report is diagnostics,
      // so it happens whether or not this step also produced a notice of its own.
      const foreign = step.filter((message) => message?.role !== 'user');
      if (foreign.length > 0) {
        const producers = [...new Set(foreign.map((message) => message?.source?.kind ?? 'unknown'))].join(', ');
        options.warn?.(`self-check: ${foreign.length} message(s) in this step are not user messages (${producers}); this hook leaves them alone - the host guard drops them`);
      }

      if (notices.length === 0) return decision;
      const injected = notices.map((text) => noticeMessage(text));

      // The hook's own contract, asserted where it can be broken: every message this plugin adds has
      // to be a user message, because that is the only role this path can write. A notice built any
      // other way is withheld rather than sent - one sentence is never worth a session that will not
      // open again.
      const impure = injected.filter((message) => message?.role !== 'user');
      if (impure.length > 0) {
        options.warn?.(`self-check contract: ${impure.length} notice(s) were not user messages and were withheld`);
        return { ...decision, messages: [...injected.filter((message) => message?.role === 'user'), ...step] };
      }
      return { ...decision, messages: [...injected, ...step] };
    } catch (error) {
      options.warn?.(`self-check failed: ${error?.message ?? error}`);
      return decision;
    }
  };
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
  const shippedLibrary = typeof row.shippedLibrary === 'string' && row.shippedLibrary.trim() !== ''
    ? row.shippedLibrary.trim()
    : path.join(HERE, '..', 'rules', 'kaomoji.json');

  const warn = (message) => {
    try {
      ctx.logger?.warn?.(`[house-rules] ${message}`);
    } catch {
      /* a logger that fails is not a reason for the discipline to fail */
    }
  };

  // Which library files to read depends on the config, so the list is resolved once at registration
  // from that one setting. A library named later needs a restart; the *contents* of every file on the
  // list stay live, which is the part that matters while editing.
  const initial = readJson(configFile) ?? {};
  const libraryFiles = libraryPaths(initial.kaomojiLibrary, shippedLibrary);

  // The text is a function, not a string: the prompt registry evaluates it on every model step, so a
  // configuration or library edit lands at the next step of every running session without a restart.
  const resolve = makeRulesResolver({ file: configFile, libraryFiles, shippedLibrary, warn });
  const first = resolve();

  // A section registering without an `enabled` check reads better than one that is silently absent,
  // so the reason is logged once at boot even though the resolver owns the decision from then on.
  ctx.logger?.info?.(
    first.enabled
      ? `[house-rules] registered ${first.text.length} characters (locale=${first.locale}, sources=${first.sources.join(' > ')}, library=${first.library} faces from ${libraryFiles.length} file(s))`
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
    'Oishikunaare-Moe-Moe-Kyun: house rules section',
  );

  // The self-check is the teeth. The rules above are a prompt, and a prompt cannot notice anything;
  // this observes each step and, when the agent's own output broke the rule, puts one notice in front
  // of the next step. Same event the disk-guard plugin uses; `next` is called exactly once.
  if (initial.selfCheck !== false && typeof ctx.on === 'function') {
    const max = typeof initial.selfCheckMax === 'number' && initial.selfCheckMax >= 0
      ? Math.floor(initial.selfCheckMax)
      : DEFAULT_SELFCHECK_MAX;
    // What is known about each agent's preset, keyed by agent id, filled by `agent/created` below.
    //
    // `ctx.get`, never `export const inject`: a plugin that declares a hard dependency on the preset
    // registry is a plugin that fails to load at all on a deployment that has no roster. Asking for the
    // service is the whole difference between "degrades to the old behaviour" and "does not load".
    const presetCache = new Map();
    const presets = typeof ctx.get === 'function' ? (ctx.get('agentPresets') ?? null) : null;
    if (presets === null && first.moe !== 'off') {
      ctx.logger?.info?.('[house-rules] no agentPresets roster in this deployment; moeVoiceByPreset and persona inference are unavailable, and the configured moeVoice mode is used as before');
    }
    ctx.on('agent/created', async ({ agent } = {}) => {
      // An exception here fails the creation of the agent, so nothing in this body is allowed to
      // escape: a house-rules plugin is never a reason a session cannot start.
      try {
        const entry = await prewarmPreset({ presets, agent, warn });
        if (agent?.id !== undefined && agent?.id !== null) presetCache.set(agent.id, entry);
        if (entry.id !== undefined && first.moe !== 'off') {
          ctx.logger?.info?.(`[house-rules] agent ${agent.id}: preset ${entry.id} (${entry.persona === null ? 'identity only; its document was not read' : `persona ${entry.persona.length} characters`})`);
        }
      } catch (error) {
        warn(`agent/created preset prewarm failed: ${error?.message ?? error}`);
      }
    });
    ctx.on('agent/disposed', ({ agent } = {}) => {
      try {
        if (agent?.id !== undefined && agent?.id !== null) presetCache.delete(agent.id);
      } catch (error) {
        warn(`agent/disposed cleanup failed: ${error?.message ?? error}`);
      }
    });
    const hook = makeSelfCheckHook({
      max,
      // The ladder keeps a long session from going quiet while the breaches continue; `symbolLadder: []`
      // turns it off and leaves the plain budget in charge.
      ladder: Array.isArray(initial.symbolLadder)
        ? initial.symbolLadder
        : [10, 50, 200],
      kaomoji: initial.kaomojiCheck !== false,
      kaomojiFloor: typeof initial.kaomojiFloor === 'number' ? initial.kaomojiFloor : 3,
      kaomojiMax: typeof initial.kaomojiCheckMax === 'number' ? initial.kaomojiCheckMax : 5,
      emoji: initial.emojiCheck !== false,
      emojiMax: typeof initial.emojiCheckMax === 'number' ? initial.emojiCheckMax : 2,
      // The fourth rule's own self-check. Off with `languageCheck: false`; the budget is per session.
      language: initial.languageCheck !== false,
      languageMax: typeof initial.languageCheckMax === 'number' ? initial.languageCheckMax : 3,
      // The moe layer only steers when it is switched on; the voice table is read live so an edit to
      // rules/voices/<locale>.json lands on the next step.
      moe: first.moe !== 'off',
      // Read only when the layer is on: a table read on every pre-step for an unused feature is waste.
      voices: first.moe === 'off' ? [] : readVoiceTable(path.join(HERE, '..', 'rules', VOICE_DIR), first.locale, warn).voices,
      // What was prewarmed for this agent, or an empty record for a deployment with no roster.
      presetVoice: (agent) => (agent?.id === undefined || agent?.id === null ? {} : (presetCache.get(agent.id) ?? {})),
      // The mapping and the mode are read per step rather than frozen at mount, so adding
      // `moeVoiceByPreset` to the config file takes effect on the next step - the same arrangement the
      // rule text uses, and the reason a restart is not needed for a configuration edit.
      voiceOptions: () => {
        const state = resolve();
        return { voice: state.voice, byPreset: state.voiceByPreset, signals: state.voiceSignals };
      },
      // The judge travels with the rules: it is rebuilt whenever the config or the palette changes, so
      // switching mode mid-session takes effect on the next step instead of needing a restart.
      resolve: () => {
        const state = resolve();
        return {
          enabled: state.enabled,
          locale: state.locale,
          judge: state.judge,
          emojiAllow: state.emojiAllow,
          // The marker table follows the reply language, and it is a function of the assembled state.
          voiceMarkers: state.voiceMarkers,
        };
      },
      warn,
      log: (message) => {
        try {
          ctx.logger?.info?.(`[house-rules] ${message}`);
        } catch {
          /* logging is not the point */
        }
      },
    });
    ctx.on('agent/pre-step', hook);
    const startupJudge = first.judge ?? { mode: 'deny' };
    ctx.logger?.info?.(
      `[house-rules] self-check on: ${startupJudge.mode === 'allow' ? 'allow-list' : 'deny-list'} judge, up to ${max} notice(s) per session`,
    );

    // The last lever, and the only one that acts while the reply is still the thing being written. Two
    // decisions share it: the symbol one is on by default (a hard ban that a notice could not hold needs
    // the lever that acts before the turn closes), the kaomoji one stays opt-in (a steer costs a model
    // step, so a habit gets a choice rather than a default nobody chose). They share one per-turn map so
    // a single turn never pays for both.
    const steerPerTurn = new Map();
    const symbolSteerOn = initial.symbolSteer !== false;
    const kaomojiSteerOn = initial.kaomojiSteer === true;
    if (symbolSteerOn || kaomojiSteerOn) {
      const symbolMax = typeof initial.symbolSteerMax === 'number' && initial.symbolSteerMax >= 0
        ? Math.floor(initial.symbolSteerMax)
        : 1;
      const kaomojiMax = typeof initial.kaomojiSteerMax === 'number' && initial.kaomojiSteerMax >= 0
        ? Math.floor(initial.kaomojiSteerMax)
        : 1;
      const steerState = () => {
        const state = resolve();
        return {
          enabled: state.enabled,
          locale: state.locale,
          judge: state.judge,
          emojiAllow: state.emojiAllow,
        };
      };
      const symbolDecide = symbolSteerOn
        ? makeSymbolSteerDecider({ enabled: true, max: symbolMax, perTurn: steerPerTurn, resolve: steerState, warn })
        : () => null;
      const kaomojiDecide = kaomojiSteerOn
        ? makeSteerDecider({ enabled: true, max: kaomojiMax, perTurn: steerPerTurn, resolve: steerState, warn })
        : () => null;
      ctx.on('agent/turn-stopping', async (payload) => {
        const symbolText = symbolDecide(payload);
        const text = symbolText ?? kaomojiDecide(payload);
        if (text === null) return;
        try {
          payload.agent.steer(noticeMessage(text));
          ctx.logger?.info?.(symbolText === null
            ? '[house-rules] turn stopped without a kaomoji; steered one more pass'
            : '[house-rules] turn stopped carrying a banned glyph; steered one more pass');
        } catch (error) {
          warn(`steering failed: ${error?.message ?? error}`);
        }
      });
      ctx.logger?.info?.('[house-rules] turn-stop steer on:'
        + `${symbolSteerOn ? ` symbol (at most ${symbolMax} per session)` : ' symbol off'},`
        + `${kaomojiSteerOn ? ` kaomoji (at most ${kaomojiMax} per session)` : ' kaomoji off'}`);
    }
  }
}
