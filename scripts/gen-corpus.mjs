#!/usr/bin/env node
/**
 * Build a shipped corpus from a directory of per-chapter text files.
 *
 * One book is one text file plus a manifest of character offsets: a reader slices the text instead of
 * parsing a directory. Each book also carries the measured shape of its prose (formula.json) and a
 * pool of lines that put a concrete thing in front of the reader (exemplars.json) - the two things a
 * habit can actually be trained on.
 *
 * The books are described in BOOKS, not hard-coded, and every Chinese literal lives in an escape
 * because the source tree is ASCII-only (`scripts/check-ascii.mjs`).
 *
 * Usage:
 *   node scripts/gen-corpus.mjs [--book genji|suzumiya] [--from <chapters dir>] [--out <dir>]
 *   node scripts/gen-corpus.mjs --check
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const checkMode = process.argv.includes('--check');

const argv = process.argv.slice(2);
const argOf = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
};

// Escaped once, used by both books: the corpora are Chinese prose by definition.
const ZH = Object.freeze({
  genji: {
    title: '\u6E90\u6C0F\u7269\u8BED',
    author: '\u7D2B\u5F0F\u90E8',
    translator: '\u4E30\u5B50\u607A',
    emptyBlock: '\uFF08\u6B64\u56DE\u4EC5\u5B58\u9898\u540D\uFF0C\u4F20\u672C\u65E0\u6B63\u6587\u3002\uFF09',
    emptyScroll: '\u7B2C\u56DB\u5341\u4E00\u56DE \u4E91\u9690',
  },
  suzumiya: {
    title: '\u51C9\u5BAB\u6625\u65E5\u7CFB\u5217',
    author: '\u8C37\u5DDD\u6D41',
    translator: '\u8BB8\u6167\u8D1E',
    emptyBlock: '\uFF08\u6B64\u56DE\u4E3A\u56FE\u7247\u9875\uFF0C\u65E0\u6B63\u6587\u6587\u5B57\u3002\uFF09',
    emptyScroll: '',
  },
});

const BOOKS = {
  genji: {
    dir: 'genji',
    from: ['D:', 'DaShaoHuo', 'downloads', '\u6E90\u6C0F\u7269\u8BED'].join('/'),
    emptyScroll: 43,
    source: '99csw.com/book/2540 (crawled 2026-11-26)',
    splitVolume: false,
    note: `One text file plus character offsets per chapter. ${ZH.genji.emptyScroll} is the title-only scroll and carries no prose.`,
  },
  suzumiya: {
    dir: 'suzumiya',
    from: ['D:', 'DaShaoHuo', 'downloads', '\u51C9\u5BAB\u6625\u65E5\u7CFB\u5217'].join('/'),
    emptyScroll: null,
    source: 'bilinovel.com / linovelib.com (crawled 2026-11-26)',
    splitVolume: true,
    note: 'One text file plus character offsets per chapter. The FANBOOK cast page has no prose; its 68 images are kept beside the source files.',
  },
};

const bookName = argOf('--book') ?? 'genji';
const book = BOOKS[bookName];
if (!book) {
  console.error(`gen-corpus: unknown book "${bookName}" (${Object.keys(BOOKS).join(', ')})`);
  process.exit(1);
}
const zh = ZH[bookName];
const from = argOf('--from') ?? book.from;
const out = argOf('--out') ?? path.join(ROOT, 'rules', 'corpus', book.dir);

const SENTENCE_END = /[\u3002\uFF01\uFF1F\u2026]$/;

function sentences(text) {
  const parts = [];
  let buffer = '';
  for (const ch of text) {
    buffer += ch;
    if (SENTENCE_END.test(buffer)) {
      const t = buffer.trim();
      if (t.length > 0) parts.push(t);
      buffer = '';
    }
  }
  if (buffer.trim().length > 0) parts.push(buffer.trim());
  return parts;
}

function pickQuotes(name, body) {
  const list = sentences(body).filter((s) => s.length >= 12 && s.length <= 80);
  if (list.length === 0) return [];
  const opening = list[0];
  const closing = list[list.length - 1];
  const half = list.slice(Math.floor(list.length / 2));
  const middle = half.reduce((best, s) => (s.length > best.length ? s : best), half[0] ?? opening);
  const picked = [opening, middle, closing].filter((s, i, arr) => arr.indexOf(s) === i && s !== undefined);
  return picked.map((text) => ({ chapter: name, text }));
}

// --- exemplars and the formulaic baseline -----------------------------------------------------
const CONCRETE = [
  '\u706F', '\u6708', '\u82B1', '\u96E8', '\u96EA', '\u98CE', '\u8863', '\u9999', '\u6247', '\u7434',
  '\u7B1B', '\u7B19', '\u7EB8', '\u7B14', '\u5E18', '\u5C4F', '\u7A97', '\u5E2D', '\u6C34', '\u5C71',
  '\u5EAD', '\u6C60', '\u9E1F', '\u8776', '\u67F3', '\u6885', '\u67AB', '\u9732', '\u9713', '\u9EC4\u660F',
];

const STOCK = [
  '\u4E0D\u7981', '\u4E0D\u7531\u5F97', '\u4EFF\u4F5B', '\u5B9B\u5982', '\u4F3C\u4E4E', '\u4EE4\u4EBA',
  '\u8BA9\u4EBA', '\u65E0\u6CD5\u8A00\u8BF4', '\u6CB9\u7136\u800C\u751F', '\u6D8C\u4E0A\u5FC3\u5934',
  '\u65E0\u4E0E\u4F26\u6BD4', '\u96BE\u4EE5\u5FD8\u6000', '\u60C5\u4E0D\u81EA\u7981',
];

const hasAny = (text, list) => list.some((piece) => text.includes(piece));

function pickExemplars(name, body) {
  const list = sentences(body).filter((s) => s.length >= 15 && s.length <= 46);
  const good = list.filter((s) => hasAny(s, CONCRETE) && !hasAny(s, STOCK));
  const chosen = [];
  const stride = Math.max(1, Math.floor(good.length / 4));
  for (let i = 0; i < good.length && chosen.length < 4; i += stride) {
    if (!chosen.includes(good[i])) chosen.push(good[i]);
  }
  return chosen.map((text) => ({ chapter: name, text }));
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100))];
}

function proportions(text) {
  const paras = text.split(/\n+/).map((p) => p.trim()).filter((p) => p !== '');
  const list = sentences(text);
  const chars = text.replace(/\s/g, '').length;
  const sentenceLens = list.map((s) => s.length);
  const per1000 = (n) => (chars === 0 ? 0 : Math.round((n * 10000) / chars) / 10);
  const count = (ch) => (text.match(new RegExp(ch, 'g')) ?? []).length;
  const commaStacked = list.filter((s) => (s.match(/\uFF0C/g) ?? []).length >= 4).length;
  const QUOTES = ['\u201C', '\u201D', '\u300C', '\u300D'];
  const dialogue = list.filter((s) => QUOTES.some((q) => s.includes(q))).length;
  return {
    chars,
    sentences: list.length,
    sentenceMedian: median(sentenceLens),
    sentenceP90: percentile(sentenceLens, 90),
    sentenceMax: sentenceLens.length > 0 ? Math.max(...sentenceLens) : 0,
    paragraphs: paras.length,
    paragraphMedian: median(paras.map((p) => p.length)),
    dialogueShare: list.length === 0 ? 0 : Math.round((dialogue / list.length) * 1000) / 10,
    commaStackedShare: list.length === 0 ? 0 : Math.round((commaStacked / list.length) * 1000) / 10,
    dePer1000: per1000(count('\u7684')),
    exclaimPer1000: per1000(count('\uFF01')),
    adversativePairs: (text.match(/\u4E0D\u662F[^\u3002]{0,40}\u800C\u662F/g) ?? []).length,
    stockPhrases: STOCK.reduce((sum, piece) => sum + (text.split(piece).length - 1), 0),
  };
}

const files = fs.existsSync(from)
  ? fs.readdirSync(from).filter((f) => /^\d{3}_.*\.txt$/.test(f)).sort()
  : [];

if (files.length === 0) {
  if (checkMode) {
    // A machine without the source text cannot rebuild the corpus; that is not drift, and failing
    // here would make `npm run verify` depend on a download that only one machine has.
    console.log(`gen-corpus: source ${from} is absent, nothing to compare`);
    process.exit(0);
  }
  console.error(`gen-corpus: no chapter files under ${from}`);
  process.exit(1);
}

const chapters = [];
const quotes = [];
const exemplars = [];
const perChapter = [];
let full = '';

for (const file of files) {
  const n = Number(file.slice(0, 3));
  const raw = fs.readFileSync(path.join(from, file), 'utf8').trim();
  const label = file.replace(/^\d{3}_/, '').replace(/\.txt$/, '');
  // A book that groups chapters by volume names them `<volume>__<chapter>`.
  let volume = '';
  let name = label;
  if (book.splitVolume && label.includes('__')) {
    const cut = label.indexOf('__');
    volume = label.slice(0, cut);
    name = label.slice(cut + 2);
  }
  const body = raw.replace(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n\\n`), '').trim();
  const text = n === book.emptyScroll || body === '' ? '' : body;
  const block = `=== ${volume ? `${volume} / ` : ''}${name} ===\n\n${text || zh.emptyBlock}\n\n`;
  chapters.push({
    n,
    volume,
    name,
    chars: text.replace(/\s/g, '').length,
    offset: full.length,
    length: block.length,
    head: text.slice(0, 40),
    tail: text.slice(-40),
  });
  full += block;
  for (const q of pickQuotes(name, text)) quotes.push(q);
  for (const e of pickExemplars(name, text)) exemplars.push(e);
  if (text !== '') perChapter.push({ n, volume, name, ...proportions(text) });
}

const digest = crypto.createHash('sha256').update(full, 'utf8').digest('hex');
const relFile = `rules/corpus/${book.dir}/full.txt`;

const manifest = {
  locale: 'zh',
  title: zh.title,
  author: zh.author,
  translator: zh.translator,
  source: book.source,
  note: book.note,
  file: relFile,
  chapters: chapters.length,
  chars: chapters.reduce((s, c) => s + c.chars, 0),
  sha256: digest,
  table: chapters,
};

const quoteDoc = {
  locale: 'zh',
  note: 'Three lines per chapter: the opening, a middle set piece, and the closing line. Chosen by a fixed rule so the file only changes when the text does.',
  count: quotes.length,
  quotes,
};

const exemplarDoc = {
  locale: 'zh',
  note: 'The pool a habit is trained on: medium-length lines that put a concrete prop in front of the reader and carry no stock opener. A stock phrase count near zero is the point - these lines show what writing without one looks like.',
  rule: 'length 15..46, at least one concrete prop, none of the stock openers listed in scripts/gen-corpus.mjs',
  count: exemplars.length,
  exemplars,
};

const formulaDoc = {
  locale: 'zh',
  note: 'Measured proportions, not opinions: every field is a count over full.txt, so it can be recomputed and argued with. What the corpus does not do is as usable as what it does - a near-zero stockPhrases count and a low exclaimPer1000 are the shape a formulaic voice is missing.',
  fields: {
    sentenceMedian: 'median characters per sentence (split on the four sentence enders)',
    sentenceP90: 'ninety-first percentile sentence length',
    sentenceMax: 'the longest sentence in the book',
    paragraphMedian: 'median characters per paragraph',
    dialogueShare: 'percentage of sentences carrying quotation marks',
    commaStackedShare: 'percentage of sentences with four or more commas in a row of clauses',
    dePer1000: 'occurrences of the possessive particle per thousand characters',
    exclaimPer1000: 'exclamation marks per thousand characters',
    adversativePairs: 'the "not X but Y" construction, counted as pairs',
    stockPhrases: 'openers and connectives that let a sentence avoid looking at anything',
  },
  book: proportions(full.replace(/^=== [^\n]*===\n+/gm, '')),
  chapters: perChapter,
};

const outputs = [
  { file: path.join(out, 'full.txt'), body: full },
  { file: path.join(out, 'manifest.json'), body: JSON.stringify(manifest, null, 2) + '\n' },
  { file: path.join(out, 'quotes.json'), body: JSON.stringify(quoteDoc, null, 2) + '\n' },
  { file: path.join(out, 'exemplars.json'), body: JSON.stringify(exemplarDoc, null, 2) + '\n' },
  { file: path.join(out, 'formula.json'), body: JSON.stringify(formulaDoc, null, 2) + '\n' },
];

if (checkMode) {
  const drift = outputs.filter((o) => !fs.existsSync(o.file) || fs.readFileSync(o.file, 'utf8') !== o.body);
  if (drift.length > 0) {
    for (const d of drift) console.error(`gen-corpus: ${path.relative(ROOT, d.file)} is out of date`);
    process.exit(1);
  }
  console.log(`gen-corpus: ${bookName} in sync (${chapters.length} chapters, ${manifest.chars} characters, sha256 ${digest.slice(0, 12)})`);
  process.exit(0);
}

fs.mkdirSync(out, { recursive: true });
for (const o of outputs) fs.writeFileSync(o.file, o.body, 'utf8');
console.log(`gen-corpus: wrote ${bookName} - ${chapters.length} chapters, ${manifest.chars} characters, ${quotes.length} quotes, sha256 ${digest.slice(0, 12)}`);
