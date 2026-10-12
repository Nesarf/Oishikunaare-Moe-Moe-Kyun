/**
 * Generate rules/kaomoji.json: at least 1000 unique kaomoji, grouped by the mood they carry.
 *
 * The faces are composed rather than invented one by one, but not randomly: every column is a part
 * that real kaomoji use (omega and dot eyes, the de and tsu mouths, the arabic and kannada marks, the
 * raised-sweat and hand signs), so a combination reads like something a person wrote. Each axis entry
 * carries its own annotation, and a face's `feel` is those annotations joined - which is why the
 * library can hold a thousand faces without the description becoming boilerplate.
 *
 * Three gates keep the file honest:
 *   - uniqueness across categories, so no face is listed twice
 *   - a length window and at least one non-ASCII character, so a fragment or a plain (o_o) is dropped
 *   - a per-category quota with even sampling, so the file lands at a size a person can read through
 *     instead of the tens of thousands the cross product would produce
 *
 * This file is ASCII-only, per the repository invariant: the Chinese labels it emits are written as
 * \\uXXXX escapes, and rules/*.json is the one place allowed to hold the resulting characters.
 *
 * Usage:
 *   node scripts/gen-kaomoji.mjs                 write rules/kaomoji.json
 *   node scripts/gen-kaomoji.mjs <path>          write somewhere else (for review)
 *   node scripts/gen-kaomoji.mjs --check         fail when the committed file is not what this produces
 *   node scripts/gen-kaomoji.mjs --check <path>  check that path instead
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const S = (...cp) => String.fromCodePoint(...cp);

// ---------------------------------------------------------------- eyes (both sides the same)
// [left, right, english annotation, chinese annotation, mood bucket]
const EYES = [
  ['^', '^', 'upturned', '\u4E0A\u5F2F', 'happy'],
  [S(0xff3e), S(0xff3e), 'fullwidth circumflex', '\u5168\u89D2\u6291\u626C', 'happy'],
  [S(0x02c6), S(0x02c6), 'circumflex', '\u6291\u626C', 'happy'],
  [S(0x02c7), S(0x02c7), 'caron', '\u6291\u626C\u7B26', 'happy'],
  ['o', 'o', 'round', '\u5706', 'happy'],
  [S(0xff4f), S(0xff4f), 'fullwidth round', '\u5168\u89D2\u5706', 'happy'],
  ['O', 'O', 'wide round', '\u5927\u5706', 'happy'],
  ['0', '0', 'zero', '\u96F6', 'wry'],
  [S(0x0434), S(0x0434), 'cyrillic de', '\u897F\u91CC\u5C14 d', 'puzzled'],
  [S(0x03c9), S(0x03c9), 'omega', '\u03C9', 'happy'],
  [S(0x03bc), S(0x03bc), 'mu', '\u03BC', 'happy'],
  [S(0x03b5), S(0x03b5), 'epsilon', '\u03B5', 'happy'],
  [S(0xff9f), S(0xff9f), 'halfwidth circle', '\u534A\u89D2\u5706', 'happy'],
  [S(0x2022), S(0x2022), 'bullet', '\u70B9', 'happy'],
  [S(0x00b7), S(0x00b7), 'middle dot', '\u4E2D\u70B9', 'calm'],
  [S(0x30fb), S(0x30fb), 'katakana middle dot', '\u4E2D\u9ED1\u70B9', 'calm'],
  [S(0x00b0), S(0x00b0), 'degree', '\u5EA6', 'wry'],
  ['*', '*', 'star', '\u661F', 'happy'],
  ['+', '+', 'plus', '\u5341', 'puzzled'],
  ['x', 'x', 'lowercase x', '\u5C0F\u53C9', 'wry'],
  ['X', 'X', 'uppercase x', '\u5927\u53C9', 'wry'],
  [S(0x00d7), S(0x00d7), 'multiplication', '\u4E58\u53F7', 'wry'],
  ['>', '<', 'narrow', '\u7A84', 'puzzled'],
  ['<', '>', 'inverted narrow', '\u5916\u7A84', 'puzzled'],
  [S(0xff1e), S(0xff1c), 'fullwidth narrow', '\u5168\u89D2\u7A84', 'puzzled'],
  ['T', 'T', 'latin tee', 'T', 'wry'],
  [S(0x0422), S(0x0422), 'cyrillic te', '\u897F\u91CC\u5C14 T', 'wry'],
  [S(0x0295), S(0x0295), 'inverted glottal', '\u5012\u6487', 'wry'],
  [S(0x02c8), S(0x02c8), 'vertical stroke', '\u91CD\u97F3', 'wry'],
  [S(0xff40), S(0xff40), 'fullwidth grave', '\u5168\u89D2\u53CD\u5F15\u53F7', 'wry'],
  ['`', '`', 'grave', '\u53CD\u5F15\u53F7', 'wry'],
  [S(0x00b4), S(0x00b4), 'acute', '\u6487\u53F7', 'wry'],
  [S(0xffe3), S(0xffe3), 'fullwidth macron', '\u5168\u89D2\u957F\u97F3', 'happy'],
  [S(0x30fc), S(0x30fc), 'katakana prolonged', '\u957F\u97F3', 'happy'],
  ['_', '_', 'underscore', '\u6A2A\u7EBF', 'wry'],
  [S(0x02d9), S(0x02d9), 'dot above', '\u4E0A\u70B9', 'wry'],
  [S(0x0ca0), S(0x0ca0), 'kannada ttha', '\u5361\u7EB3\u8FBE', 'puzzled'],
  [S(0x0642), S(0x0642), 'arabic qaf', '\u963F\u62C9\u4F2F qaf', 'puzzled'],
  [S(0x0639), S(0x0639), 'arabic ayn', '\u963F\u62C9\u4F2F ayn', 'puzzled'],
  [S(0x0637), S(0x0637), 'arabic tta', '\u963F\u62C9\u4F2F tta', 'puzzled'],
  [S(0x00ac), S(0x00ac), 'not sign', '\u5426\u5B9A', 'puzzled'],
  [S(0x2038), S(0x2038), 'caret', '\u63D2\u5165\u7B26', 'puzzled'],
  [S(0xff0f), S(0xff0f), 'fullwidth slash', '\u5168\u89D2\u659C\u7EBF', 'wry'],
  ['/', '/', 'slash', '\u659C\u7EBF', 'wry'],
  [';', ';', 'semicolon', '\u5206\u53F7', 'wry'],
  [S(0x02dc), S(0x02dc), 'small tilde', '\u5C0F\u6CE2\u6D6A', 'happy'],
  [S(0xff5e), S(0xff5e), 'fullwidth tilde', '\u5168\u89D2\u6CE2\u6D6A', 'happy'],
  [S(0x25bd), S(0x25bd), 'white down triangle', '\u767D\u4E0B\u4E09\u89D2', 'puzzled'],
  [S(0x25b3), S(0x25b3), 'white up triangle', '\u767D\u4E0A\u4E09\u89D2', 'puzzled'],
  [S(0xff0a), S(0xff0a), 'fullwidth asterisk', '\u5168\u89D2\u661F', 'happy'],
  [S(0x2606), S(0x2606), 'white star', '\u767D\u661F', 'happy'],
  [S(0x2661), S(0x2661), 'white heart', '\u767D\u5FC3', 'happy'],
  [S(0x2665), S(0x2665), 'heart', '\u5FC3', 'happy'],



  [S(0x0e22), S(0x0e22), 'thai yo', '\u6CF0\u6587 yo', 'puzzled'],
  [S(0x4e38), S(0x4e38), 'kanji maru', '\u4E38\u5B57', 'happy'],
  [S(0x30c4), S(0x30c4), 'katakana tsu', '\u7247\u5047\u540D \u30C4', 'puzzled'],
  [S(0x2609), S(0x2609), 'sun', '\u592A\u9633', 'calm'],
  [S(0x2299), S(0x2299), 'circled dot', '\u5706\u5708\u70B9', 'calm'],
  [S(0x25d0), S(0x25d0), 'left half circle', '\u534A\u5706', 'calm'],
  [S(0xff9e), S(0xff9e), 'halfwidth dakuten', '\u534A\u89D2\u6D4A\u70B9', 'wry'],
  [S(0x309b), S(0x309b), 'katakana dakuten', '\u6D4A\u70B9', 'wry'],
  [S(0x0e3f), S(0x0e3f), 'thai baht', '\u6CF0\u94E2', 'puzzled'],
  [S(0x00a4), S(0x00a4), 'currency', '\u8D27\u5E01', 'puzzled'],
  [S(0x2192), S(0x2192), 'right arrow', '\u53F3\u7BAD\u5934', 'puzzled'],
  [S(0xff62), S(0xff62), 'corner bracket', '\u89D2\u62EC\u53F7', 'puzzled'],
];

// ---------------------------------------------------------------- mouth / face (centre)
const MOUTHS = [
  ['_', 'flat', '\u5E73\u5634'],
  [S(0xff3f), 'fullwidth flat', '\u5168\u89D2\u5E73\u5634'],
  [S(0x3002), 'ideographic full stop', '\u53E5\u70B9'],
  [S(0xff0e), 'fullwidth period', '\u5168\u89D2\u53E5\u70B9'],
  [S(0x03c9), 'omega', '\u03C9'],
  [S(0x25bd), 'down triangle', '\u4E0B\u4E09\u89D2'],
  [S(0x25b3), 'up triangle', '\u4E0A\u4E09\u89D2'],
  [S(0x0414), 'cyrillic de capital', '\u0414'],
  [S(0x0434), 'cyrillic de', '\u0434'],
  [S(0x2200), 'for all', '\u2200'],
  [S(0x0417), 'cyrillic ze', '\u0417'],
  [S(0x30c4), 'katakana tsu', '\u30C4'],
  [S(0xff8a), 'halfwidth tsu', '\u534A\u89D2\u30C4'],
  [S(0x30ce), 'katakana no', '\u30CE'],
  [S(0xff9d), 'halfwidth no', '\u534A\u89D2\u30CE'],
  ['o', 'round', '\u5706'],
  ['O', 'wide round', '\u5927\u5706'],
  [S(0xff9f), 'halfwidth circle', '\u534A\u89D2\u5706'],
  ['w', 'latin w', 'w'],
  [S(0x03b5), 'epsilon', '\u03B5'],
  [S(0x03bc), 'mu', '\u03BC'],
  [S(0x2267), 'greater or equal', '\u5927\u7B49\u53F7'],
  [S(0x2266), 'less or equal', '\u5C0F\u7B49\u53F7'],
  ['>', 'greater', '\u5927\u4E8E'],
  ['<', 'less', '\u5C0F\u4E8E'],
  [S(0xff1e), 'fullwidth greater', '\u5168\u89D2\u5927\u4E8E'],
  ['v', 'latin v', 'v'],
  ['.', 'dot', '\u70B9'],
  ['..', 'two dots', '\u53CC\u70B9'],
  [S(0x2026), 'ellipsis', '\u7701\u7565'],
  ['~', 'tilde', '\u6CE2\u6D6A'],
  [S(0x301c), 'wave dash', '\u5168\u89D2\u6CE2\u6D6A'],
  ['-', 'hyphen', '\u77ED\u6A2A'],
  [S(0x30fc), 'katakana prolonged', '\u957F\u97F3'],
  ['=', 'equals', '\u7B49\u53F7'],
  [S(0xff1d), 'fullwidth equals', '\u5168\u89D2\u7B49\u53F7'],
  [S(0x2500), 'box drawing horizontal', '\u5236\u8868\u6A2A\u7EBF'],
  [S(0xfe4f), 'wavy low line', '\u6CE2\u6D6A\u7EBF'],
  [S(0x203f), 'undertie', '\u4E0B\u8FDE\u63A5'],
  [S(0x2040), 'character tie', '\u4E0A\u8FDE\u63A5'],
  [S(0x0e5a), 'thai angkhankhu', '\u6CF0\u6587\u5F2F'],
  [S(0x05d0), 'hebrew alef', '\u5E0C\u4F2F\u6765 alef'],
  [S(0x05d1), 'hebrew bet', '\u5E0C\u4F2F\u6765 bet'],
  ['*', 'asterisk', '\u661F'],
  ['+', 'plus', '\u5341'],
  [S(0x2203), 'there exists', '\u5B58\u5728\u53F7'],
  [S(0x4e09), 'kanji three', '\u4E09'],
  [S(0x516b), 'kanji eight', '\u516B'],
  [S(0x53e3), 'kanji mouth', '\u53E3'],
  [S(0x56db), 'kanji four', '\u56DB'],
  [S(0x5341), 'kanji ten', '\u5341'],
  [S(0x30fb), 'middle dot', '\u4E2D\u9ED1\u70B9'],
  ['3', 'digit three', '3'],
  [S(0x0295), 'inverted glottal', '\u5012\u6487'],
  [S(0x0561), 'armenian ayb', '\u4E9A\u7F8E\u5C3C\u4E9A a'],
  [S(0x0578), 'armenian vo', '\u4E9A\u7F8E\u5C3C\u4E9A o'],
  [S(0x03b4), 'delta', '\u03B4'],
  [S(0x03bb), 'lambda', '\u03BB'],
  [S(0x2261), 'identical', '\u5168\u7B49'],
  [S(0x2262), 'not identical', '\u4E0D\u5168\u7B49'],
  [S(0x2323), 'smile', '\u4E0A\u626C'],
  [S(0x2322), 'frown', '\u4E0B\u5F2F'],
  [S(0x25e1), 'lower half circle', '\u4E0B\u534A\u5706'],
  [S(0x25e0), 'upper half circle', '\u4E0A\u534A\u5706'],
  [S(0x2296), 'circled minus', '\u5706\u5708\u51CF'],
  [S(0x2295), 'circled plus', '\u5706\u5708\u52A0'],
  [S(0x03c3), 'sigma', '\u03C3'],
  [S(0x0423), 'cyrillic u', '\u0423'],
  [S(0xff8f), 'halfwidth ra', '\u534A\u89D2\u30E9'],
];

// ---------------------------------------------------------------- arms, marks, tails, frames
const ARMS = ['', '', '', '\\', '/', '\\/', '/\\', '\\\\', '//', S(0xff3e), S(0x30ce), '~', '\\~', '~/', S(0xff9d), '>', '<'];
const MARKS = ['', '', '', '', '', '', '', '', S(0x2727), S(0x2606), S(0x2605), S(0x2665), S(0x266a), S(0x2661), S(0x2022), S(0x00b0), '*', S(0x273f), S(0x2740), S(0x0f1a)];
const TAILS = ['', '', '', '', '', '', '', '', ';', "'", '!', '?', '.', S(0x00b0), '~', 'T', '*', S(0x201d), S(0x3001)];

const PARENS = [
  ['(', ')', '', ''],
  [S(0xff08), S(0xff09), 'fullwidth ', '\u5168\u89D2'],
  [S(0x256d), S(0x256e), 'rounded ', '\u5706\u6846'],
  [S(0xff62), S(0xff63), 'corner ', '\u89D2\u62EC'],
  [S(0x3010), S(0x3011), 'lenticular ', '\u65B9\u5934'],
  [S(0x300c), S(0x300d), 'corner quote ', '\u5F15\u53F7'],
];

// ---------------------------------------------------------------- symptoms: sweat, tears, hands
// [mark before the face, english, chinese]
const SYMPTOM_LEAD = [
  ['', 'plain', '\u7D20'],
  ['*', 'a star cheek', '\u661F\u661F\u816E\u7EA2'],
  [S(0x00b4) + ';', 'a raised sweat', '\u626C\u8D77\u7684\u4E00\u6EF4\u6C57'],
  [';', 'a small sweat', '\u4E00\u5C0F\u6EF4\u6C57'],
  ['\uFF40;', 'a low sweat', '\u4F4E\u5782\u7684\u4E00\u6EF4\u6C57'],
  ['\uFF9F;', 'a half sweat', '\u534A\u6EF4\u6C57'],
  [S(0x02c8) + ';', 'a jumping sweat', '\u8DF3\u8D77\u6765\u7684\u4E00\u6EF4\u6C57'],
  ['\u3064', 'a hiragana tsu', '\u5C0F\u3064'],
  ['\u30ce', 'a katakana no', '\u30CE'],
  ['\uFF1F', 'a question mark', '\u95EE\u53F7'],
  [';_;', 'tears', '\u6CEA'],
  ['\u0416', 'a cross', '\u5341\u5B57'],
  ['\u0E07', 'a raised paw', '\u62AC\u8D77\u7684\u722A'],
];
const SYMPTOM_TAIL = [
  ['', 'nothing after', '\u540E\u9762\u6CA1\u6709'],
  [';', 'a trailing sweat', '\u5C3E\u968F\u4E00\u6EF4\u6C57'],
  ['\uFF40;', 'a trailing low sweat', '\u5C3E\u968F\u4F4E\u6C57'],
  [S(0x02c8) + ';', 'a trailing jumping sweat', '\u5C3E\u968F\u8DF3\u6C57'],
  [S(0x00b4) + ';', 'a trailing raised sweat', '\u5C3E\u968F\u626C\u6C57'],
  ['*', 'a trailing star', '\u5C3E\u968F\u661F\u661F'],
  ['.', 'a full stop', '\u53E5\u70B9'],
  ['\uFF01', 'a trailing exclamation', '\u5C3E\u968F\u53F9\u53F7'],
  ['\u2665', 'a trailing heart', '\u5C3E\u968F\u5FC3'],
];
/** The leads that read as trouble rather than as a blush. */
const SWEATY = new Set(['a raised sweat', 'a small sweat', 'a low sweat', 'a half sweat', 'a jumping sweat', 'a hiragana tsu', 'a katakana no']);

const SHY_TAILS = [
  [';', 'a semicolon', '\u5206\u53F7'],
  ["'", 'an apostrophe', '\u6487\u53F7'],
  ['\uFF01', 'an exclamation', '\u5168\u89D2\u53F9\u53F7'],
  ['\uFF1F', 'a question mark', '\u95EE\u53F7'],
  ['\u3001', 'a comma', '\u987F\u53F7'],
  [S(0x00b4) + ';', 'a raised sweat', '\u626C\u8D77\u7684\u4E00\u6EF4\u6C57'],
  ['\uFF40;', 'a low sweat', '\u4F4E\u5782\u7684\u4E00\u6EF4\u6C57'],
];

const AFFECTION_MARKS = [
  [S(0x2727), 'a sparkle', '\u706B\u82B1'],
  [S(0x2606), 'a white star', '\u767D\u661F'],
  [S(0x2665), 'a heart', '\u5FC3'],
  [S(0x2661), 'a white heart', '\u767D\u5FC3'],
  [S(0x266a), 'a note', '\u97F3\u7B26'],
  [S(0x0f1a), 'a tibetan mark', '\u85CF\u6587\u8BB0\u53F7'],
  [S(0x273f), 'a flower', '\u82B1'],
  [S(0x2740), 'a flower bud', '\u82B1\u82DE'],
  [S(0x00b0), 'a degree', '\u5EA6\u53F7'],
  ['*', 'a star', '\u661F\u661F'],
];

// ---------------------------------------------------------------- trouble: marks around the face
const TROUBLE_LEAD = [
  ['(\uFF40;', 'a sweat drop in front', '\u524D\u9762\u4E00\u6EF4\u6C57'],
  ['\uFF9F;', 'a half sweat in front', '\u524D\u9762\u534A\u6EF4\u6C57'],
  ['(', 'a fullwidth sweat in front', '\u524D\u9762\u5168\u89D2\u6C57'],
  ['(\u30FE', 'a drunk mark in front', '\u524D\u9762\u53F9\u53F7'],
  ['(\u3064', 'a hiragana tsu in front', '\u524D\u9762\u5C0F\u3064'],
  ['(\uFF1F', 'a question mark in front', '\u524D\u9762\u95EE\u53F7'],
  ['\uFF89(', 'a hand in front', '\u524D\u9762\u4E00\u53EA\u624B'],
  ['\u10E7(', 'a georgian mark in front', '\u524D\u9762\u683C\u9C81\u5409\u4E9A\u8BB0\u53F7'],
];
const TROUBLE_TAIL = [
  [')\uFF40;', 'a sweat drop after', '\u540E\u9762\u4E00\u6EF4\u6C57'],
  [');', 'a sweat after', '\u540E\u9762\u4E00\u6EF4\u6C57'],
  [')\uFF89', 'a hand pushing after', '\u540E\u9762\u63A8\u5F00\u7684\u624B'],
  [')\uFF01', 'an exclamation after', '\u540E\u9762\u53F9\u53F7'],
  [')\uFF1F', 'a question mark after', '\u540E\u9762\u95EE\u53F7'],
  [')\uFF9F;', 'a half sweat after', '\u540E\u9762\u534A\u6EF4\u6C57'],
  [')\u3064', 'a hiragana tsu after', '\u540E\u9762\u5C0F\u3064'],
];

// ---------------------------------------------------------------- tired
const TIRED_EYES = ['_', '-', '=', 'o', 'O', '0', 'T', 'X', 'x', '\u30fc', '\uFF3F', '\uFF40', '`', '\u02c8', '\u02d9'];
const TIRED_TAILS = [
  ['\uFF5A\uFF5A\uFF3A', 'zzZ in fullwidth', 'zzZ'],
  ['\uFF5E', 'a trailing wave', '\u6CE2\u6D6A\u5C3E'],
  ['\u266A zzZ', 'a hum and zzZ', '\u4E00\u58F0\u54FC\u52A0 zzZ'],
  ['\uFF5A\uFF5A\uFF3A\uFF5E', 'zzZ with a wave', 'zzZ \u52A0\u6CE2\u6D6A'],
  ['\u3002\u3002\u3002', 'trailing full stops', '\u5C3E\u968F\u53E5\u70B9'],
  ['\uFF61', 'a halfwidth stop', '\u534A\u89D2\u53E5\u70B9'],
];

// ---------------------------------------------------------------- classic faces, written by hand
const CLASSIC = [
  ['(\uFF61\uFF61\uFF61)', 'speechless', '\u65E0\u8BED'],
  ['(\u2267\u25BD\u2266)', 'triumphant squint', '\u5F97\u610F'],
  ['(\uFF9F\uFF65\uFF9F)', 'flat stare', '\u9762\u65E0\u8868\u60C5'],
  ['(\u30FB\u03C9\u30FB)', 'quiet omega smile', '\u5B89\u9759\u7684 \u03C9 \u7B11'],
  ['(\uFF65\u03C9\uFF65)', 'spot eye smile', '\u70B9\u773C\u7B11'],
  ['(\u25D5\u203F\u25D5)', 'shining eyes', '\u53D1\u4EAE\u7684\u773C\u775B'],
  ['(\u25D5\u25E1\u25D5)', 'cheerful round eyes', '\u5706\u4EAE\u7684\u773C\u775B'],
  ['(\uFFE3\u25BD\uFFE3)', 'long eyelash look', '\u957F\u776B\u6BDB'],
  ['(\u0E51\u02C3\u1D17\u02C2\u0E51)', 'wide beaming', '\u6EE1\u8138\u53D1\u5149'],
  ['(\u0E51\u02C3\u1D17\u02C2\u0E51)\u0E05', 'wide beaming with a hand', '\u53D1\u5149\u52A0\u4E00\u53EA\u624B'],
  ['(\uFFE3\uFF9F\uFFE3)', 'half closed', '\u534A\u95ED\u7740\u773C'],
  ['(\uFF61\uFF9F\uFF61)', 'small flat', '\u5C0F\u5DE7\u7684\u9762\u65E0\u8868\u60C5'],
  ['(\u00B4\uFF65\u03C9\uFF65`)', 'sleepy smile', '\u56F0\u56F0\u7684\u7B11'],
  ['(*\u00B4\u03C9`*)', 'cozy', '\u8212\u670D'],
  ['(*\u00B4\u2200`*)', 'bright grin', '\u5F00\u5FC3\u54A7\u5634'],
  ['(\u0E07 \u0E30 \u0E07)', 'stare', '\u76EF\u7740'],
  ['(\uFF61\u25BD\uFF61)', 'deadpan', '\u6B7B\u9C7C\u773C'],
  ['(\uFF9F\u0414\uFF9F)', 'stiff face', '\u50F5\u786C'],
  ['\uFF9F(\uFF9F\u0414\uFF9F)\uFF9F', 'stiff with hands up', '\u50F5\u7740\u4E3E\u624B'],
  ['\uFF9F(\uFF9F\uFF65\uFF9F)\uFF9F', 'half hearted hands up', '\u534A\u5FC3\u4E3E\u624B'],
  ['(\uFF61\u2022\u0300\u1D25\u2022\u0301\uFF61)', 'soft sparkle eyes', '\u8F6F\u8F6F\u7684\u773C\u775B'],
  ['\u03A3(\uFF61\u0414\uFF61)', 'startled sideways', '\u4FA7\u8EAB\u4E00\u60CA'],
  ['(\uFF61\u0414\uFF61;)', 'startled', '\u4E00\u60CA'],
  ['(\uFF61\uFF9F\uFF61;)', 'startled and flat', '\u4E00\u60CA\u800C\u9762\u762B'],
  ['\uFF9F(\uFF9F\uFF65\uFF9F)\uFF9F\u2665', 'reluctant affection', '\u52C9\u5F3A\u7684\u5FC3'],
  ['(\u30FB\u2200\u30FB)', 'neutral grin', '\u4E2D\u6027\u54A7\u5634'],
  ['(\uFF65\u2200\uFF65)', 'neutral grin, spots', '\u70B9\u773C\u4E2D\u6027\u54A7\u5634'],
  ['(\u00B4\u25BD`)', 'sheepish', '\u4E0D\u597D\u610F\u601D'],
  ['(`\u25BD\u00B4)', 'sheepish, reversed', '\u4E0D\u597D\u610F\u601D\uFF0C\u53CD\u5411'],
  ['(\u02C8\uFF9F\u02C8)', 'awkward', '\u5C40\u4FC3'],
  ['(\u00B4\uFF9F`)', 'relieved', '\u677E\u4E86\u53E3\u6C14'],
  ['(\u00B4\u2022\uFF9F\u2022`)', 'relieved and round', '\u677E\u53E3\u6C14\uFF0C\u5706\u8138'],
  ['(\uFFE3\u2022\uFF9F\u2022\uFFE3)', 'wide relieved', '\u653E\u5927\u7248\u7684\u677E\u53E3\u6C14'],
  ['(\uFF61\u0414\uFF61)\uFF89', 'flat and pushing back', '\u9762\u762B\u7740\u63A8\u5F00'],
  ['\uFF89(\u00B4\u0414`)', 'pushing back with both hands', '\u4E24\u53EA\u624B\u63A8\u5F00'],
  ['\uFF89(\uFF61\uFF9F\uFF61)\uFF87', 'shrugging', '\u8038\u80A9'],
  ['(\u256F\u00B0\u25A1\u00B0\uFF09\u256F', 'table flip', '\u6380\u684C'],
  ['(\u30CE\u0CA0\u76CA\u0CA0)\u30CE', 'rage', '\u53D1\u706B'],
  ['\u0CA0_\u0CA0', 'unimpressed stare', '\u4E0D\u52A8\u58F0\u8272\u7684\u76EF'],
  ['\u0CA0\uFF9F\u0CA0', 'unimpressed, round', '\u4E0D\u52A8\u58F0\u8272\u7684\u76EF\uFF0C\u5706\u8138'],
  ['\u0295\u2022\u1D25\u2022\u0294', 'cat face', '\u732B\u8138'],
  ['(\u2267\u0414\u2266)', 'swagger', '\u56A3\u5F20'],
  ['\uFF9F(\u2267\u0414\u2266)\uFF9F', 'swagger with hands up', '\u56A3\u5F20\u4E3E\u624B'],
  ['(\u0E51\u00B4\u1D17`\u0E51)', 'sweet', '\u751C\u751C\u7684'],
  ['(\u0E51\u00B4\u1D17`\u0E51)\u0E05', 'sweet with a hand', '\u751C\u751C\u7684\uFF0C\u52A0\u4E00\u53EA\u624B'],
  ['(\u0E51\u02C3\u1D17\u02C2\u0E51)\u0E05\u0E05', 'sweet with both hands', '\u751C\u751C\u7684\uFF0C\u4E24\u53EA\u624B'],
  ['\u30FD(\u00B4\u03C9`)\u30CE', 'greeting', '\u6253\u62DB\u547C'],
  ['\u30FD(\u00B4\u2200`)\u30CE', 'greeting, grinning', '\u6253\u62DB\u547C\uFF0C\u54A7\u5634'],
  ['\u309C\uFF61\uFF9F(\u3064\uFF9F\uFF61)\uFF9F', 'shy paws', '\u5BB3\u7F9E\u7684\u722A\u5B50'],
  ['\u3064\uFF61\uFF9F\uFF61)\u3064', 'reaching out', '\u4F38\u624B'],
  ['(\u0E07\uFF65\uFF9F\uFF65)\u0E07', 'paws up', '\u4E24\u53EA\u722A'],
  ['\u2661(\uFF61\uFF9F\uFF61)\u2661', 'surrounded by hearts', '\u4E24\u65C1\u662F\u7231\u5FC3'],
  ['(\u30FB\u2200\u30FB)\u266A', 'humming', '\u54FC\u7740\u6B4C'],
  ['\uFF9F(\uFF65\u2200\uFF65)\uFF9F', 'content with hands up', '\u6EE1\u8DB3\u5730\u4E3E\u624B'],
  ['(\uFF61\u00B4\u03C9`\uFF61)', 'small cozy', '\u5C0F\u5C0F\u7684\u8212\u670D'],
  ['\uFF9F(\u00B4\uFF9F`)\uFF9F', 'hands up, relieved', '\u4E3E\u624B\uFF0C\u677E\u53E3\u6C14'],
  ['(\uFF61\u30FB\uFF9F\u30FB\uFF61)', 'blank', '\u7A7A\u767D'],
  ['(\u00B4\uFF65\uFF9F\uFF65`)', 'sleepy', '\u56F0'],
  ['\uFF9F(\uFF65\u0414\uFF65)\uFF9F', 'stiff and flat', '\u50F5\u7740\uFF0C\u9762\u762B'],
  ['(\u0E51\u2022\u0300\u1D25\u2022\u0301\u0E51)', 'sparkling sweet', '\u95EA\u95EA\u7684\u751C'],
  ['\u0E07(\uFF61\uFF9F\uFF61)\u0E07', 'paws up, flat', '\u4E24\u53EA\u722A\uFF0C\u9762\u762B'],
  ['(\uFF61\uFF9F\uFF61)\uFF89', 'pushing back, flat', '\u9762\u762B\u63A8\u5F00'],
  ['\uFF9F(\u00B4\uFF9F`)\uFF9F\u2665', 'affectionate hands up', '\u4EB2\u6635\u5730\u4E3E\u624B'],
  ['(\u30CE\uFF9F\u76CA\uFF9F)\u30CE', 'mild rage', '\u8F7B\u5FAE\u53D1\u706B'],
  ['(\uFF61\uFF9F\uFF61)\u30CE', 'flat pushing away', '\u9762\u762B\u63A8\u5F00'],
  ['(\uFF61\u0414\uFF61)\u30CE', 'startled pushing away', '\u4E00\u60CA\u63A8\u5F00'],
  ['\uFF9F(\uFF61\u0414\uFF61)\uFF9F', 'startled with hands up', '\u4E00\u60CA\u4E3E\u624B'],
];

// ---------------------------------------------------------------- categories and quotas
const CATS = [
  { id: 'cheerful', label: 'cheerful', labelZh: '\u5F00\u5FC3', use: 'good news, a job finished, agreement', useZh: '\u597D\u6D88\u606F\u3001\u4E8B\u60C5\u529E\u6210\u4E86\u3001\u8868\u793A\u540C\u610F', quota: 120 },
  { id: 'calm', label: 'calm', labelZh: '\u5E73\u548C', use: 'explaining, confirming, a passing remark', useZh: '\u8BB2\u89E3\u3001\u786E\u8BA4\u3001\u968F\u53E3\u4E00\u53E5', quota: 100 },
  { id: 'wry', label: 'wry', labelZh: '\u82E6\u7B11', use: 'a small joke, a shrug, light self-mockery', useZh: '\u5F00\u4E2A\u5C0F\u73A9\u7B11\u3001\u8038\u8038\u80A9\u3001\u5E26\u70B9\u81EA\u5632', quota: 120 },
  { id: 'troubled', label: 'troubled', labelZh: '\u51FA\u72B6\u51B5', use: 'a bug, a failure, bad news', useZh: '\u51FAbug\u3001\u5931\u8D25\u4E86\u3001\u574F\u6D88\u606F', quota: 110 },
  { id: 'shy', label: 'shy', labelZh: '\u5BB3\u7F9E', use: 'being praised, a small apology, a soft moment', useZh: '\u88AB\u5938\u3001\u8BA4\u4E2A\u5C0F\u9519\u3001\u67D4\u8F6F\u7684\u65F6\u523B', quota: 100 },
  { id: 'determined', label: 'determined', labelZh: '\u6709\u5E72\u52B2', use: 'fixed it, settled the plan, rolling up sleeves', useZh: '\u4FEE\u597D\u4E86\u3001\u5B9A\u4E0B\u65B9\u6848\u3001\u4E0B\u51B3\u5FC3', quota: 100 },
  { id: 'puzzled', label: 'puzzled', labelZh: '\u56F0\u60D1', use: 'a strange result, a question with no answer yet', useZh: '\u7ED3\u679C\u5947\u602A\u3001\u95EE\u9898\u8FD8\u6CA1\u7B54\u6848', quota: 100 },
  { id: 'tired', label: 'tired', labelZh: '\u75B2\u60EB', use: 'a long task, late at night', useZh: '\u957F\u4EFB\u52A1\u3001\u6DF1\u591C', quota: 30 },
  { id: 'affection', label: 'affection', labelZh: '\u4EB2\u6635', use: 'thanking, warmth, winning together', useZh: '\u9053\u8C22\u3001\u6E29\u6696\u3001\u4E00\u8D77\u8D62\u4E86', quota: 90 },
  { id: 'fullwidth', label: 'fullwidth and framed', labelZh: '\u5168\u89D2\u4E0E\u6846\u5F0F', use: 'the same moods in fullwidth or framed writing', useZh: '\u540C\u6837\u7684\u60C5\u7EEA\uFF0C\u5168\u89D2\u6216\u6846\u5F0F\u5199\u6CD5', quota: 60 },
  { id: 'arms', label: 'with arms', labelZh: '\u5E26\u624B\u81C2', use: 'waving, cheering, throwing hands up', useZh: '\u6325\u624B\u3001\u6B22\u547C\u3001\u644A\u624B', quota: 60 },
  { id: 'decorated', label: 'decorated', labelZh: '\u5E26\u88C5\u9970', use: 'a face with a sparkle, heart or note beside it', useZh: '\u65C1\u8FB9\u5E26\u661F\u661F\u3001\u7231\u5FC3\u6216\u97F3\u7B26', quota: 60 },
  { id: 'blushing', label: 'blushing and sweating', labelZh: '\u8138\u7EA2\u4E0E\u5192\u6C57', use: 'flustered, embarrassed, caught off guard', useZh: '\u614C\u4E71\u3001\u4E0D\u597D\u610F\u601D\u3001\u88AB\u6293\u5305', quota: 60 },
  { id: 'classic', label: 'classic faces', labelZh: '\u7ECF\u5178\u5B57\u5F62', use: 'the shapes everyone recognizes', useZh: '\u5927\u5BB6\u90FD\u8BA4\u5F97\u7684\u5F62\u72B6', quota: 40 },
];

// ---------------------------------------------------------------- collection
/** Mood bucket -> category id. One mapping, so a face never lands in two categories. */
const BUCKET_CAT = { happy: 'cheerful', calm: 'calm', wry: 'wry', puzzled: 'puzzled' };
const catById = new Map(CATS.map((c) => [c.id, c]));
/** Candidate pool per category: each pass registers faces, sampling picks the final set. */
const POOL = new Map(CATS.map((c) => [c.id, []]));
const pool = (id) => {
  const list = POOL.get(id);
  if (!list) throw new Error('unknown category: ' + id);
  return list;
};

const out = [];
const seen = new Set();
/**
 * Register a face once.
 *
 * Four gates: the face must be new, must sit in the length window, must carry at least one non-ASCII
 * character (so a plain `(o_o)` is not a face), and must hold balanced brackets - the composed passes
 * splice a mark onto one side, and an unbalanced face is a glyph nobody would type.
 */
function add(face, feelEn, feelZh) {
  if (seen.has(face)) return false;
  if (face.length < 3 || face.length > 18) return false;
  if (!/[^\x00-\x7f]/.test(face)) return false;
  const round = [...face].filter((ch) => ch === '(' || ch === '\uFF08').length;
  const shut = [...face].filter((ch) => ch === ')' || ch === '\uFF09').length;
  if (round !== shut) return false;
  seen.add(face);
  out.push({ face, feel: feelEn, feelZh });
  return true;
}

// 1) eyes x mouth: the core layer
for (const [el, er, ee, ez, eb] of EYES) {
  for (const [mouth, me, mz] of MOUTHS) {
    const face = `(${el}${mouth}${er})`;
    if (add(face, `${ee} eyes + ${me} mouth`, `${ez}\u773C + ${mz}\u5634`)) pool(BUCKET_CAT[eb]).push(out[out.length - 1]);
  }
}

// 2) the same core in another frame
for (const [lp, rp, pe, pz] of PARENS) {
  if (pe === '') continue;
  for (const [el, er, ee, ez] of EYES.slice(0, 46)) {
    for (const [mouth, me, mz] of MOUTHS.slice(0, 22)) {
      const face = `${lp}${el}${mouth}${er}${rp}`;
      if (add(face, `${pe}${ee} eyes + ${me} mouth`, `${pz}${ez}\u773C + ${mz}\u5634`)) pool('fullwidth').push(out[out.length - 1]);
    }
  }
}

// 3) arms up around the face
for (const [el, er, ee, ez] of EYES.slice(0, 30)) {
  for (const [mouth, me, mz] of MOUTHS.slice(0, 16)) {
    for (const arm of ['\\', '/', '/\\', '\\/']) {
      const face = `${arm}(${el}${mouth}${er})${arm === '\\' ? '/' : '\\'}`;
      if (add(face, `arms up, ${ee} eyes + ${me} mouth`, `\u4E3E\u624B\uFF0C${ez}\u773C + ${mz}\u5634`)) pool('arms').push(out[out.length - 1]);
    }
  }
}

// 4) a mark on both sides of the eyes
for (const [el, er, ee, ez] of EYES.slice(0, 34)) {
  for (const [mouth, me, mz] of MOUTHS.slice(0, 10)) {
    for (const mark of MARKS.slice(8, 16)) {
      const face = `(${mark}${el}${mouth}${er}${mark})`;
      if (add(face, `${ee} eyes + ${me} mouth with a ${mark}`, `${ez}\u773C + ${mz}\u5634\uFF0C\u65C1\u8FB9\u4E00\u4E2A\u88C5\u9970`)) pool('decorated').push(out[out.length - 1]);
    }
  }
}

// 5) symptoms beside the face: one lead or one tail, never both, so the marks never read as doubled
for (const [el, er, ee, ez] of EYES.slice(0, 40)) {
  for (const [mouth, me, mz] of MOUTHS.slice(0, 20)) {
    for (const [lead, le, lz] of SYMPTOM_LEAD) {
      if (lead === '') continue;
      const face = `(${lead}${el}${mouth}${er})`;
      const what = `${le}, ${ee} eyes + ${me} mouth`;
      const whatZh = `${lz}\uFF0C${ez}\u773C + ${mz}\u5634`;
      if (add(face, what, whatZh)) pool(SWEATY.has(le) ? 'blushing' : 'shy').push(out[out.length - 1]);
    }
    for (const [tail, te, tz] of SYMPTOM_TAIL) {
      if (tail === '') continue;
      const face = `(${el}${mouth}${er}${tail})`;
      const what = `${te}, ${ee} eyes + ${me} mouth`;
      const whatZh = `${tz}\uFF0C${ez}\u773C + ${mz}\u5634`;
      if (add(face, what, whatZh)) pool(SWEATY.has(te) ? 'blushing' : 'shy').push(out[out.length - 1]);
    }
  }
}

// 6) a small mark trailing the whole face
for (const [el, er, ee, ez] of EYES.slice(0, 40)) {
  for (const [mouth, me, mz] of MOUTHS.slice(0, 20)) {
    for (const [tail, te, tz] of SHY_TAILS) {
      const face = `(${el}${mouth}${er}${tail})`;
      if (add(face, `${te} trailing, ${ee} eyes + ${me} mouth`, `\u5C3E\u968F${tz}\uFF0C${ez}\u773C + ${mz}\u5634`)) pool('shy').push(out[out.length - 1]);
    }
  }
}

// 7) a mark on both sides of the mouth
for (const [el, er, ee, ez] of EYES.slice(0, 40)) {
  for (const [mouth, me, mz] of MOUTHS.slice(0, 16)) {
    for (const [mark, m2, mz2] of AFFECTION_MARKS) {
      const face = `(${mark}${el}${mouth}${er}${mark})`;
      if (add(face, `${m2} on both sides, ${ee} eyes + ${me} mouth`, `\u4E24\u4FA7\u5404\u4E00\u4E2A${mz2}\uFF0C${ez}\u773C + ${mz}\u5634`)) pool('affection').push(out[out.length - 1]);
    }
  }
}

// 8) arms outside the brackets
for (const [el, er, ee, ez] of EYES.slice(0, 24)) {
  for (const [mouth, me, mz] of MOUTHS.slice(0, 12)) {
    for (const arm of ARMS.slice(3, 9)) {
      const face = `${arm === '\\' || arm === '/' ? arm : ''}(${el}${mouth}${er})${arm}`;
      if (add(face, `${ee} eyes + ${me} mouth, arms out`, `${ez}\u773C + ${mz}\u5634\uFF0C\u5F20\u5F00\u624B\u81C2`)) pool('determined').push(out[out.length - 1]);
    }
  }
}

// 9) puzzled: the tilted eyes paired with every mouth
for (const [el, er, ee, ez] of EYES.filter((e) => e[4] === 'puzzled')) {
  for (const [mouth, me, mz] of MOUTHS) {
    const face = `(${el}${mouth}${er})`;
    if (add(face, `${ee} eyes + ${me} mouth, puzzled`, `${ez}\u773C + ${mz}\u5634\uFF0C\u6B6A\u7740\u5934`)) pool('puzzled').push(out[out.length - 1]);
  }
}

// 10) a heart, note or flower hanging off the face
for (const [el, er, ee, ez] of EYES.slice(0, 30)) {
  for (const [mouth, me, mz] of MOUTHS.slice(0, 10)) {
    for (const mark of [S(0x2665), S(0x2661), S(0x266a), S(0x273f), S(0x2740), S(0x0f1a)]) {
      const tail = `(${el}${mouth}${er}${mark})`;
      if (add(tail, `${ee} eyes + ${me} mouth with a ${mark}`, `${ez}\u773C + ${mz}\u5634\uFF0C\u5C3E\u90E8\u4E00\u4E2A\u5FC3/\u82B1`)) pool('affection').push(out[out.length - 1]);
      const lead = `(${mark}${el}${mouth}${er})`;
      if (add(lead, `${ee} eyes + ${me} mouth, a ${mark} in front`, `${ez}\u773C + ${mz}\u5634\uFF0C\u524D\u9762\u4E00\u4E2A\u5FC3/\u82B1`)) pool('affection').push(out[out.length - 1]);
    }
  }
}

// 11) trouble: the mark wraps the face instead of sitting inside the brackets
for (const [el, er, ee, ez] of EYES.filter((e) => e[4] === 'wry' || e[4] === 'puzzled')) {
  for (const [mouth, me, mz] of MOUTHS.slice(0, 30)) {
    for (const [before, fe, fz] of TROUBLE_LEAD) {
      const face = `${before}${el}${mouth}${er})`;
      if (add(face, `${fe}, ${ee} eyes + ${me} mouth`, `${fz}\uFF0C${ez}\u773C + ${mz}\u5634`)) pool('troubled').push(out[out.length - 1]);
    }
    for (const [after, ae, az] of TROUBLE_TAIL) {
      const face = `(${el}${mouth}${er}${after}`;
      if (add(face, `${ae}, ${ee} eyes + ${me} mouth`, `${az}\uFF0C${ez}\u773C + ${mz}\u5634`)) pool('troubled').push(out[out.length - 1]);
    }
  }
}

// 12) tired: half-closed eyes with a dozing mark trailing the face
for (const [el, er, ee, ez] of EYES.filter((e) => TIRED_EYES.includes(e[0]))) {
  for (const [mouth, me, mz] of MOUTHS.filter((m) => ['_', '-', '~', '=', '.', '\u2026', 'w', 'o', 'O', '\u25bd'].includes(m[0]))) {
    for (const [tail, te, tz] of TIRED_TAILS) {
      const face = `(${el}${mouth}${er})${tail}`;
      if (add(face, `${ee} eyes + ${me} mouth, ${te}`, `${ez}\u773C + ${mz}\u5634\uFF0C${tz}`)) pool('tired').push(out[out.length - 1]);
    }
  }
}

// 13) classic faces, written by hand
for (const [face, fe, fz] of CLASSIC) {
  if (add(face, fe, fz)) pool('classic').push(out[out.length - 1]);
}

// ---------------------------------------------------------------- sample and write
const render = () => ({
  name: 'TastyLineOut kaomoji library',
  version: 4,
  note: 'Faces grouped by the mood they carry. feel/use are English; feelZh/labelZh/useZh are the Chinese rendering. Extend it: add entries here, or point kaomojiLibrary at your own file(s).',
  categories: CATS.map((c) => ({
    id: c.id,
    label: c.label,
    labelZh: c.labelZh,
    use: c.use,
    useZh: c.useZh,
    faces: c.rows.map((r) => ({ face: r.face, feel: r.feel, feelZh: r.feelZh })),
  })),
});

// Even sampling across each candidate list: the picks cover the whole range instead of its first slice.
let chosen = [];
for (const c of CATS) {
  const candidates = POOL.get(c.id);
  if (candidates.length === 0) {
    console.error(`category ${c.id} has an empty candidate pool`);
    process.exit(1);
  }
  if (candidates.length < c.quota) {
    console.error(`category ${c.id} has only ${candidates.length} candidates, under its quota of ${c.quota}`);
    process.exit(1);
  }
  const step = candidates.length / c.quota;
  c.rows = Array.from({ length: c.quota }, (_, i) => candidates[Math.floor(i * step)]);
  chosen = chosen.concat(c.rows);
}

const total = chosen.length;
const unique = new Set(chosen.map((r) => r.face)).size;
if (total < 1000) {
  console.error(`only ${total} faces were generated, under the 1000 the library promises`);
  process.exit(1);
}
if (unique !== total) {
  console.error(`${total} faces hold only ${unique} unique shapes`);
  process.exit(1);
}

const args = process.argv.slice(2);
const checkMode = args[0] === '--check';
const target = path.resolve(checkMode ? (args[1] ?? path.join(ROOT, 'rules', 'kaomoji.json')) : (args[0] ?? path.join(ROOT, 'rules', 'kaomoji.json')));
const wanted = JSON.stringify(render(), null, 2) + '\n';

if (checkMode) {
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  if (current !== wanted) {
    console.error(`rules/kaomoji.json is out of date: ${current.split('\n').length} lines on disk, ${wanted.split('\n').length} expected`);
    console.error('run: node scripts/gen-kaomoji.mjs');
    process.exit(1);
  }
  console.log(`gen-kaomoji: in sync (${CATS.length} categories, ${total} faces)`);
} else {
  fs.writeFileSync(target, wanted, 'utf8');
  console.log(`wrote ${target}: ${CATS.length} categories / ${total} unique faces`);
  for (const c of CATS) {
    console.log(`  ${c.id.padEnd(12)} ${String(c.rows.length).padStart(4)} of ${String(POOL.get(c.id).length).padStart(6)} candidates   e.g. ${c.rows.slice(0, 5).map((r) => r.face).join(' ')}`);
  }
}
