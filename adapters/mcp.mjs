#!/usr/bin/env node
/**
 * The same house rules, as an MCP server.
 *
 * MCP is the one channel that is not tied to a single agent: any client that speaks it - a desktop
 * app, an editor, another CLI, a harness on another operating system - can ask these questions
 * without knowing what "agent/pre-step" means. The three tools mirror what the plugin does, minus the
 * one thing a plugin is for:
 *
 *   mmk_rules   the prompt section to inject (fetch it once per session and put it in the system prompt)
 *   mmk_check   judge a piece of authored text; the answer carries the notices that correct it
 *   mmk_notice  render one notice by kind, for a client that already knows what it found
 *
 * What this server does NOT do is write anything: no message is appended, no transcript is edited, no
 * file is created. Judging and sending are different jobs, and the risk of the second one belongs to
 * whoever owns the conversation - that separation is the whole reason the plugin corruption of
 * 2026-10-14 could not have happened here.
 *
 * Transport: newline-delimited JSON-RPC 2.0 over stdio, no dependencies beyond node builtins.
 * Usage: `node adapters/mcp.mjs` with a client that launches it, or pipe requests in by hand.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { judgeText, noticesFor, resolveState, shippedPaths } from '../src/portable.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VERSION = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(HERE, '..', 'package.json'), 'utf8')).version;
  } catch {
    return '0.0.0';
  }
})();

/** The protocol revision to answer with when the client does not name one we can echo. */
const FALLBACK_PROTOCOL = '2025-06-18';

const TOOLS = [
  {
    name: 'mmk_rules',
    description: 'Return the house-rules prompt section: the judgement-glyph ban, the kaomoji habit, the emoji ban, the thinking-language rule and the moe layer. Inject it into the system prompt once per session.',
    inputSchema: {
      type: 'object',
      properties: {
        locale: { type: 'string', description: 'Rule language: zh, ja or en. Defaults to the configuration, else en.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'mmk_check',
    description: 'Judge authored text on all three alphabets (judgement glyphs, emoji, kaomoji shortage) and return the code points plus the notice texts that correct them. Use it on your own draft before sending it.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The text to judge, for example a reply or a piece of thinking.' },
        floor: { type: 'number', description: 'Prose sentences per kaomoji the rule asks for (default 3).' },
      },
      required: ['text'],
      additionalProperties: false,
    },
  },
  {
    name: 'mmk_notice',
    description: 'Render one notice by kind, for a caller that already knows what it found. The notice names code points and never prints the offending glyph.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['symbol', 'emoji', 'kaomoji'] },
        glyphs: { type: 'array', items: { type: 'string' }, description: 'Code points the finding names, such as U+2713.' },
        sentences: { type: 'number', description: 'Prose sentence count, for kind=kaomoji.' },
        faces: { type: 'number', description: 'Kaomoji count, for kind=kaomoji.' },
        attempt: { type: 'number', description: 'Which reminder this is.' },
      },
      required: ['kind'],
      additionalProperties: false,
    },
  },
];

let state = null;
function stateOr() {
  if (state === null) state = resolveState({ warn: (message) => process.stderr.write(`mmk-mcp: ${message}\n`) });
  return state;
}

/** One tool call, as the text content the protocol expects. */
function callTool(name, args) {
  const current = stateOr();
  const locale = typeof args.locale === 'string' && args.locale !== '' ? args.locale : current.locale;
  const scoped = { ...current, locale };
  if (name === 'mmk_rules') {
    const built = current.resolve();
    return { locale: built.locale, length: built.text.length, text: built.text };
  }
  if (name === 'mmk_check') {
    if (typeof args.text !== 'string') throw new Error('mmk_check needs a text argument');
    const floor = Number.isFinite(args.floor) && args.floor > 0 ? Math.floor(args.floor) : 3;
    const findings = judgeText(args.text, scoped, floor);
    return {
      clean: findings.glyphs.length === 0 && findings.emoji.length === 0 && findings.kaomoji.bare !== true,
      locale: scoped.locale,
      glyphs: findings.glyphs,
      emoji: findings.emoji,
      kaomoji: { ...findings.kaomoji, floor },
      notices: noticesFor(findings, scoped, {}),
    };
  }
  if (name === 'mmk_notice') {
    const glyphs = Array.isArray(args.glyphs) ? args.glyphs.filter((entry) => typeof entry === 'string') : [];
    const findings = { glyphs: [], emoji: [], kaomoji: { bare: false } };
    if (args.kind === 'symbol') findings.glyphs = glyphs.length > 0 ? glyphs : ['U+2713'];
    else if (args.kind === 'emoji') findings.emoji = glyphs.length > 0 ? glyphs : ['U+1F600'];
    else if (args.kind === 'kaomoji') {
      const sentences = Number.isFinite(args.sentences) ? args.sentences : 5;
      const faces = Number.isFinite(args.faces) ? args.faces : 0;
      const needed = Math.ceil(sentences / 3);
      findings.kaomoji = { sentences, faces, needed, meets: faces >= needed, repeated: [], bare: true };
    } else throw new Error('mmk_notice kind must be symbol, emoji or kaomoji');
    return { locale: scoped.locale, notices: noticesFor(findings, scoped, { attempt: Number.isFinite(args.attempt) ? args.attempt : 1 }) };
  }
  throw new Error(`unknown tool "${name}"`);
}

function reply(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`);
}
function replyError(id, code, message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })}\n`);
}

/** Handle one parsed JSON-RPC message; returns nothing, writes the answer itself. */
function handle(message) {
  const method = message?.method;
  const id = message?.id ?? null;
  if (method === undefined) return; // a response to something we sent; we send none
  if (id === null && typeof method === 'string' && method.startsWith('notifications/')) return;
  switch (method) {
    case 'initialize':
      reply(id, {
        protocolVersion: typeof message.params?.protocolVersion === 'string' ? message.params.protocolVersion : FALLBACK_PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: { name: 'Oishikunaare-Moe-Moe-Kyun', version: VERSION },
        instructions: 'Moe house rules for any client: fetch mmk_rules into the system prompt, and judge your own drafts with mmk_check before sending them.',
      });
      return;
    case 'ping':
      reply(id, {});
      return;
    case 'tools/list':
      reply(id, { tools: TOOLS });
      return;
    case 'tools/call': {
      const name = message.params?.name;
      const args = message.params?.arguments && typeof message.params.arguments === 'object' ? message.params.arguments : {};
      try {
        const payload = callTool(name, args);
        const text = name === 'mmk_rules' ? payload.text : JSON.stringify(payload, null, 2);
        reply(id, { content: [{ type: 'text', text }], isError: false });
      } catch (error) {
        reply(id, { content: [{ type: 'text', text: `mmk: ${error?.message ?? error}` }], isError: true });
      }
      return;
    }
    case 'resources/list':
      reply(id, { resources: [{ uri: 'mmk://rules', name: 'house rules', mimeType: 'text/plain' }] });
      return;
    case 'resources/read': {
      if (message.params?.uri !== 'mmk://rules') {
        replyError(id, -32602, `unknown resource ${String(message.params?.uri)}`);
        return;
      }
      reply(id, { contents: [{ uri: 'mmk://rules', mimeType: 'text/plain', text: stateOr().resolve().text }] });
      return;
    }
    default:
      replyError(id, -32601, `method not found: ${String(method)}`);
  }
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  for (;;) {
    const newline = buffer.indexOf('\n');
    if (newline === -1) break;
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (line === '') continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      replyError(null, -32700, 'parse error');
      continue;
    }
    try {
      handle(message);
    } catch (error) {
      replyError(message?.id ?? null, -32603, `internal error: ${error?.message ?? error}`);
    }
  }
});
process.stdin.on('end', () => process.exit(0));

// Keep the data directory warm so a client that asks for the palette path gets a real one.
void shippedPaths();
