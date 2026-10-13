/**
 * Build per-agent voice signals from the presets' own persona files.
 *
 * Why this exists: inference reads the conversation, but a persona lives in the system prompt, so on this
 * machine only 3 of 15 presets name a voice class in words the built-in map knows. A survey confirmed it.
 * The fix is not a cleverer guess - it is giving the map the words each preset actually uses, read from
 * that preset's own persona file.
 *
 * The output is a config fragment, not a plugin change: the plugin already accepts `moeVoiceSignals`, and
 * a user can edit what this produces. Nothing here writes the live config on its own.
 *
 * Usage:
 *   node scripts/persona-signals.mjs                 print the fragment
 *   node scripts/persona-signals.mjs --write <file>  write it beside a config for review
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const presetRoot = args.includes('--presets')
  ? args[args.indexOf('--presets') + 1]
  : (process.env.DSH_HOME ? path.join(process.env.DSH_HOME, '.agent-presets') : 'E:/dsh-home/.agent-presets');

/** Words too common in a persona to identify it: they would make every preset match every other. */
const STOPWORDS = new Set([
  'the', 'and', 'you', 'your', 'are', 'with', 'that', 'this', 'for', 'not', 'but', 'her', 'his', 'she',
  'he', 'it', 'is', 'of', 'to', 'in', 'on', 'as', 'at', 'be', 'by', 'or', 'an', 'a', 'i', 'we',
  '\u4F60', '\u6211', '\u4ED6', '\u5979', '\u7684', '\u4E86', '\u662F', '\u5728', '\u548C', '\u4E0E',
  'persona', 'agent', 'assistant', 'user', '\u89D2\u8272', '\u4EBA\u683C', '\u52A9\u624B',
]);

/** Pull the candidate identity words out of one persona: the longest distinct tokens it uses. */
function tokensOf(text) {
  const words = text
    .toLowerCase()
    .split(/[^0-9a-z\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]+/u)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word));
  // Two-character CJK runs and longer Latin words both identify a persona; dedupe, keep order.
  return [...new Set(words)];
}

const report = [];
if (!fs.existsSync(presetRoot)) {
  console.error(`no preset directory at ${presetRoot}`);
  process.exit(1);
}

for (const name of fs.readdirSync(presetRoot)) {
  const dir = path.join(presetRoot, name);
  if (!fs.statSync(dir).isDirectory()) continue;
  const personaFile = path.join(dir, 'persona.md');
  if (!fs.existsSync(personaFile)) continue;
  const text = fs.readFileSync(personaFile, 'utf8');
  const tokens = tokensOf(text);
  report.push({ name, tokens: tokens.slice(0, 40), chars: text.length });
}

const signals = {};
const conflicts = [];
const owner = new Map();
for (const preset of report) {
  for (const token of preset.tokens) {
    // A token two presets share cannot identify either of them.
    if (owner.has(token) && owner.get(token) !== preset.name) {
      conflicts.push(token);
      continue;
    }
    owner.set(token, preset.name);
  }
}

console.log(`presets with a persona: ${report.length}`);
console.log(`shared tokens dropped: ${new Set(conflicts).size}`);
console.log('\nper-preset candidate signals (the first few each):');
for (const preset of report) {
  const own = preset.tokens.filter((token) => owner.get(token) === preset.name);
  preset.own = own;
  console.log(`  ${preset.name.padEnd(20)} ${own.slice(0, 6).join(' ') || '(none - persona is all shared words)'}`);
}
void signals;

const payload = {
  note: 'Per-preset voice signals, generated from each preset\'s own persona.md. Extend or trim freely: a token listed here makes the moe layer pick the named voice when that word appears in the session.',
  generatedFrom: presetRoot,
  presets: report.map((preset) => ({ preset: preset.name, tokens: preset.own.slice(0, 12) })),
};

const writeAt = args.includes('--write') ? args[args.indexOf('--write') + 1] : null;
if (writeAt) {
  fs.mkdirSync(path.dirname(writeAt), { recursive: true });
  fs.writeFileSync(writeAt, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`\nwritten: ${writeAt}`);
} else {
  console.log('\n' + JSON.stringify(payload, null, 2));
}
