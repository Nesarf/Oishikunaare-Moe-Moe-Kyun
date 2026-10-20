/**
 * Measure what a transcript actually carries, channel by channel.
 *
 * The self-check judges the newest message while it can still change. This answers the other question -
 * how the rules held up over a whole session - and it lives here rather than in a script so the CLI,
 * the DSH audit script and the tests all read the same numbers from one place.
 *
 * Three channels are read, because they are the three the model authors: prose, thinking, and the
 * arguments of a tool call (the only place a write into a file becomes visible). What a tool printed is
 * not read: that is the world talking.
 */
import { findKaomoji, offendingGlyphs, proseOnly, proseSentences } from './index.js';

/** Every judgement code point the current ban names, as numbers. Asked of the ban, never restated. */
const bannedCodes = new Set(
  offendingGlyphs(
    [...Array(0x3000).keys()].map((cp) => String.fromCodePoint(cp)).join('')
    + [0x1f44d, 0x1f44e, 0x1f44c].map((cp) => String.fromCodePoint(cp)).join(''),
  ).map((cp) => Number.parseInt(cp.slice(2), 16)),
);

const sentenceCount = (text) => proseSentences(proseOnly(text));
const kaomojiOf = (text) => findKaomoji(proseOnly(text));

/**
 * Where the ban does not reach: fenced code and inline code - by position, not by character.
 *
 * Collecting the characters that appeared inside code would exempt every occurrence of those characters
 * anywhere in the text, and one block containing an x would excuse every x in the paragraph.
 */
export function exemptOffsets(text) {
  const skip = new Set();
  for (const match of text.matchAll(/```[\s\S]*?```|`[^`\n]*`/g)) {
    for (let i = match.index; i < match.index + match[0].length; i++) skip.add(i);
  }
  return skip;
}

/** The arguments of a tool call, as the text that would be written. */
function callArguments(part) {
  const args = part?.arguments;
  if (typeof args === 'string') return args;
  if (args && typeof args === 'object') {
    try {
      return JSON.stringify(args);
    } catch {
      return '';
    }
  }
  return '';
}

/**
 * Every channel one message authored, in the shape the audit reads them.
 * @param {{ role?: string, content?: unknown }} message - a transcript message.
 * @returns {Array<{ channel: string, text: string }>} the parts.
 */
export function partsFromMessage(message) {
  if (!message || message.role !== 'assistant' || !Array.isArray(message.content)) return [];
  const out = [];
  for (const part of message.content) {
    if (!part || typeof part !== 'object') continue;
    if (part.type === 'text' && typeof part.text === 'string' && part.text.trim() !== '') {
      out.push({ channel: 'text', text: part.text });
    } else if ((part.type === 'thinking' || part.type === 'reasoning')
      && typeof part.text === 'string' && part.text.trim() !== '') {
      out.push({ channel: 'thinking', text: part.text });
    } else if (part.type === 'tool-call') {
      const body = callArguments(part);
      if (body !== '') out.push({ channel: 'tool', text: body });
    }
  }
  return out;
}

/**
 * Every authored channel across a transcript, prose first within each message.
 * @param {unknown[]} messages - transcript messages.
 * @returns {Array<{ channel: string, text: string }>} the parts.
 */
export function partsFromMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.flatMap((message) => partsFromMessage(message));
}

/**
 * The same walk over raw DSH records, for the script that reads a session log directly.
 * @param {Array<{ type?: string, data?: { message?: { content?: unknown } } }>} records - session records.
 * @returns {Array<{ channel: string, text: string }>} the parts.
 */
export function partsFromRecords(records) {
  if (!Array.isArray(records)) return [];
  const out = [];
  for (const record of records) {
    if (record?.type !== 'assistant/message') continue;
    out.push(...partsFromMessage({ role: 'assistant', content: record.data?.message?.content }));
  }
  return out;
}

/** A plain string is prose: the shape this accepted before thinking and tool calls were read. */
const asPart = (entry) => (typeof entry === 'string' ? { channel: 'text', text: entry } : entry);

/**
 * Judge every part and total it up.
 * @param {Array<string | { channel: string, text: string }>} entries - authored parts.
 * @returns {object} the report, with one row per part and the totals below.
 */
export function audit(entries) {
  const parts = (Array.isArray(entries) ? entries : []).map(asPart).filter((p) => p && typeof p.text === 'string');
  const rows = parts.map(({ channel, text }) => {
    const prose = channel === 'text';
    const skip = exemptOffsets(text);
    const hits = [...text.matchAll(/./gu)]
      .map((match) => ({ cp: match[0].codePointAt(0), index: match.index }))
      .filter((hit) => bannedCodes.has(hit.cp));
    // A tool argument is what lands in a file, so nothing in it is quoted by accident. Prose and
    // thinking keep the exemption, exactly as the hook judges them.
    const outside = channel === 'tool' ? hits : hits.filter((hit) => !skip.has(hit.index));
    const sentences = prose ? sentenceCount(text) : 0;
    const faces = prose ? kaomojiOf(text) : [];
    return {
      channel,
      sentences,
      kaomoji: faces.length,
      perKaomoji: faces.length === 0 ? null : Number((sentences / faces.length).toFixed(1)),
      need: Math.ceil(sentences / 5),
      meetsFloor: prose ? faces.length >= Math.ceil(sentences / 5) : null,
      bannedInProse: outside.length,
      bannedQuoted: hits.length - outside.length,
      codes: [...new Set(hits.map((hit) => 'U+' + hit.cp.toString(16).toUpperCase().padStart(4, '0')))],
    };
  });
  const sum = (key) => rows.reduce((n, r) => n + (r[key] ?? 0), 0);
  const inChannel = (channel) => rows.filter((r) => r.channel === channel);
  const proseRows = inChannel('text');
  const overChannel = (channel, key) => inChannel(channel).reduce((n, r) => n + (r[key] ?? 0), 0);
  return {
    messages: proseRows.length,
    parts: rows.length,
    sentences: sum('sentences'),
    kaomoji: sum('kaomoji'),
    perKaomoji: sum('kaomoji') === 0 ? null : Number((sum('sentences') / sum('kaomoji')).toFixed(1)),
    floorMet: proseRows.filter((r) => r.meetsFloor).length,
    bannedInProse: overChannel('text', 'bannedInProse'),
    bannedQuoted: overChannel('text', 'bannedQuoted'),
    bannedInThinking: overChannel('thinking', 'bannedInProse'),
    bannedWritten: overChannel('tool', 'bannedInProse'),
    rows,
  };
}
