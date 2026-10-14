/**
 * Conversation readers, so the judges can be pointed at a transcript that belongs to some other
 * harness. A reader's only job is to produce messages of the shape the judges already understand:
 * `{ id, role, source, content }`.
 *
 * Three readers, and the split is deliberate:
 *
 *   - `jsonl`: one JSON object per line, either a message (`{role, content}`) or an envelope carrying
 *     one (`{message: {...}}`). This is the lowest common denominator and the format to write a new
 *     adapter against.
 *   - `cc`: the transcript a Claude Code hook is handed, where each line is an envelope whose
 *     `message` is the provider-shaped message and whose thinking blocks carry their text under
 *     `thinking` rather than `text`. Normalizing that here is the reader's whole reason to exist.
 *   - `dsh`: this machine's own session artifact - a header line plus event rows, zstd framed. Kept
 *     because it is how the plugin's own history is audited, not because the judges need it.
 *
 * Nothing here writes, and nothing here imports a host SDK: node builtins only.
 *
 * @module Oishikunaare-Moe-Moe-Kyun/transcripts
 */
import fs from 'node:fs';
import zlib from 'node:zlib';

const ZSTD_MAGIC = 0xfd2fb528;

/** Message-producing event types, mapped to where the message actually sits. */
const EVENT_SLOTS = {
  'user/message': null,
  'system/message': 'message',
  'developer/message': 'message',
  'assistant/message': 'message',
  'tool/result': 'message',
};

/** Split a zstd artifact into its complete frames without decompressing anything else. */
function zstdFrames(buffer) {
  const frames = [];
  let offset = 0;
  while (offset < buffer.length) {
    const start = offset;
    if (buffer.length - offset < 4 || buffer.readUInt32LE(offset) !== ZSTD_MAGIC) break;
    offset += 4;
    if (offset === buffer.length) break;
    const descriptor = buffer.readUInt8(offset);
    offset += 1;
    const contentSizeFlag = descriptor >>> 6;
    const singleSegment = (descriptor & 32) !== 0;
    const checksum = (descriptor & 4) !== 0;
    const dictionaryFlag = descriptor & 3;
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag;
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag;
    const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes;
    if (buffer.length - offset < remainingHeaderBytes) break;
    offset += remainingHeaderBytes;
    for (;;) {
      if (buffer.length - offset < 3) return { frames, torn: true };
      const blockHeader = buffer.readUIntLE(offset, 3);
      offset += 3;
      const lastBlock = (blockHeader & 1) !== 0;
      const blockType = (blockHeader >>> 1) & 3;
      const blockSize = blockHeader >>> 3;
      if (blockType === 3) return { frames, torn: true };
      const payloadBytes = blockType === 1 ? 1 : blockSize;
      if (buffer.length - offset < payloadBytes) return { frames, torn: true };
      offset += payloadBytes;
      if (lastBlock) break;
    }
    if (checksum) {
      if (buffer.length - offset < 4) return { frames, torn: true };
      offset += 4;
    }
    frames.push({ start, end: offset });
  }
  return { frames, torn: false };
}

/** Decompress a framed artifact, or throw a message that says which Node release is needed. */
function decodeZstdFrames(buffer) {
  if (typeof zlib.zstdDecompressSync !== 'function') {
    throw new Error('this Node release has no zstd support; use Node 22.15 or newer to read a framed session log');
  }
  const { frames, torn } = zstdFrames(buffer);
  if (frames.length === 0) throw new Error('no zstd frame found in the artifact');
  const parts = frames.map((frame) => zlib.zstdDecompressSync(buffer.subarray(frame.start, frame.end)));
  return { text: Buffer.concat(parts).toString('utf8'), frames: frames.length, torn };
}

/** Parse JSONL text into objects, skipping lines that are not complete JSON. */
function parseLines(text) {
  const out = [];
  let skipped = 0;
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      skipped += 1;
    }
  }
  return { rows: out, skipped };
}

/** Normalize one content value so thinking blocks carry their text where the judges look for it. */
function normalizeContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return [];
  return content.map((block) => {
    if (!block || typeof block !== 'object') return block;
    if (typeof block.text === 'string') return block;
    if (block.type === 'thinking' && typeof block.thinking === 'string') return { ...block, text: block.thinking };
    if (typeof block.content === 'string') return block;
    return block;
  });
}

/** One envelope-shaped line into a message, or null when the line carries none. */
function messageFromEnvelope(row, index) {
  const inner = row && typeof row === 'object' && row.message && typeof row.message === 'object' ? row.message : null;
  if (inner !== null && typeof inner.role === 'string') {
    return {
      id: row.uuid ?? inner.id ?? `line-${index}`,
      role: inner.role,
      source: inner.source ?? { kind: row.type === 'assistant' ? 'model' : inner.role },
      content: normalizeContent(inner.content),
    };
  }
  if (row && typeof row === 'object' && typeof row.role === 'string') {
    return {
      id: row.id ?? `line-${index}`,
      role: row.role,
      source: row.source ?? (row.role === 'assistant' ? { kind: 'model' } : { kind: row.role }),
      content: normalizeContent(row.content),
    };
  }
  return null;
}

/** One DSH event row into a message, using the same slots the v4 format declares. */
function messageFromEvent(row, index) {
  const type = row?.type;
  if (typeof type !== 'string' || !(type in EVENT_SLOTS)) return null;
  const slot = EVENT_SLOTS[type];
  const data = row.data ?? {};
  const message = slot === null ? data : data[slot];
  if (message === null || typeof message !== 'object') return null;
  return {
    id: message.id ?? `seq-${row.seq ?? index}`,
    role: message.role,
    source: message.source ?? null,
    content: normalizeContent(message.content),
  };
}

/** The reader for this machine's own session artifacts. */
function readDsh(text, note) {
  const { rows, skipped } = parseLines(text);
  const header = rows.find((row) => row && row.type === 'session') ?? null;
  const messages = rows.map(messageFromEvent).filter((message) => message !== null);
  note.format = 'dsh';
  note.header = header === null ? null : {
    id: header.id ?? null,
    version: header.version ?? null,
    cwd: header.cwd ?? null,
    preset: header.agentPreset ?? null,
    createdAt: header.createdAt ?? null,
  };
  note.events = rows.filter((row) => row?.type !== 'session').length;
  note.skipped = skipped;
  return messages;
}

/**
 * Read a transcript.
 * @param {string} file - path to the transcript.
 * @param {'auto'|'jsonl'|'cc'|'dsh'} [format] - reader to use; `auto` sniffs.
 * @returns {{ format: string, messages: object[], note: object }}
 */
export function readTranscript(file, format = 'auto') {
  const buffer = fs.readFileSync(file);
  const note = { file, bytes: buffer.length, format: format, frames: null, events: null, skipped: 0, header: null };
  const framed = buffer.length >= 4 && buffer.readUInt32LE(0) === ZSTD_MAGIC;
  let text;
  if (framed) {
    const decoded = decodeZstdFrames(buffer);
    text = decoded.text;
    note.frames = decoded.frames;
    note.torn = decoded.torn;
  } else {
    text = buffer.toString('utf8');
  }
  let chosen = format;
  if (chosen === 'auto') {
    if (framed) chosen = 'dsh';
    else {
      const first = parseLines(text).rows[0] ?? null;
      if (first !== null && first.type === 'session') chosen = 'dsh';
      else if (first !== null && (typeof first.sessionId === 'string' || typeof first.uuid === 'string')) chosen = 'cc';
      else chosen = 'jsonl';
    }
    note.format = chosen;
  }
  if (chosen === 'dsh') return { format: 'dsh', messages: readDsh(text, note), note };
  const { rows, skipped } = parseLines(text);
  note.rows = rows.length;
  note.skipped = skipped;
  note.format = chosen;
  return { format: chosen, messages: rows.map(messageFromEnvelope).filter((message) => message !== null), note };
}

/** Whether a file exists, for a caller that would rather ask than catch. */
export function exists(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}
