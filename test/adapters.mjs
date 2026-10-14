// Adapter verification, driven by recorded payloads.
//
// An adapter for a harness that is not on this machine cannot be tested against that harness. What it
// CAN be tested against is a recorded payload: one real invocation, written down, replayed forever. That
// is the difference between "written to a documented contract" and "verified", and the label each
// adapter carries in the README depends on which one it is.
//
// Each fixture is a JSON file under `adapters/fixtures/<harness>/`:
//
//   { name, harness, note,
//     payload,                        // the JSON the harness hands the hook on stdin
//     transcript,                     // lines of the transcript it points at
//     args,                           // extra argv for the adapter; "<TMP>" is substituted
//     expect: { status, stdout, stdoutKeys, stdoutContains, stdoutExcludes, stderrContains } }
//
// `stdout: ""` means "say nothing"; `stdoutKeys` is a subset match on the parsed stdout object. Add one
// fixture per event a harness can raise, and a new adapter starts its life already exercised.
//
// Fixtures stay ASCII (a banned glyph is written as \u2713 and decodes at runtime); this machine's
// check-ascii rule is not relaxed for a test file.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const FIXTURES = path.join(ROOT, 'adapters', 'fixtures');

function scratchRoot() {
  const configured = process.env.MMK_TMP;
  if (typeof configured === 'string' && configured.trim() !== '') return configured.trim();
  const designated = 'E:\\DaShaoHuo\\cache\\tmp';
  if (process.platform === 'win32' && fs.existsSync(designated)) return designated;
  return os.tmpdir();
}

const TMP = fs.mkdtempSync(path.join(scratchRoot(), 'mmk-adapters-'));
const substitute = (value) => (typeof value === 'string' ? value.split('<TMP>').join(TMP.replace(/\\/g, '/')) : value);
const substituteDeep = (value) => {
  if (Array.isArray(value)) return value.map(substituteDeep);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, substituteDeep(v)]));
  return substitute(value);
};

/** A partial match: every key named in `expected` must match, extra keys in `actual` are allowed. */
function assertSubset(actual, expected, label) {
  for (const [key, value] of Object.entries(expected)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) assertSubset(actual?.[key] ?? {}, value, `${label}.${key}`);
    else assert.equal(actual?.[key], value, `${label}.${key}`);
  }
}

const harnesses = fs.existsSync(FIXTURES) ? fs.readdirSync(FIXTURES, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name) : [];
let passed = 0;
let failed = 0;

for (const harness of harnesses) {
  const dir = path.join(FIXTURES, harness);
  const adapter = path.join(ROOT, 'adapters', `${harness}.mjs`);
  if (!fs.existsSync(adapter)) {
    console.log(`FAIL  ${harness}: fixtures exist but adapters/${harness}.mjs does not`);
    failed += 1;
    continue;
  }
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort()) {
    const title = `${harness}/${file}`;
    try {
      const fixture = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      const payload = substituteDeep(fixture.payload ?? {});
      // Write the transcript the payload points at.
      if (Array.isArray(fixture.transcript)) {
        const target = payload.transcript_path;
        if (typeof target === 'string') fs.writeFileSync(target, `${fixture.transcript.map((line) => JSON.stringify(line)).join('\n')}\n`, 'utf8');
      }
      const args = substituteDeep(fixture.args ?? []);
      const run = spawnSync(process.execPath, [adapter, ...args], { encoding: 'utf8', input: JSON.stringify(payload) });
      const expect = fixture.expect ?? {};
      assert.equal(run.status, expect.status ?? 0, `status (stderr: ${run.stderr.trim().slice(0, 200)})`);
      if (expect.stdout === '') assert.equal(run.stdout.trim(), '', 'stdout is empty');
      if (expect.stdoutKeys) assertSubset(JSON.parse(run.stdout), expect.stdoutKeys, 'stdout');
      for (const needle of expect.stdoutContains ?? []) assert.ok(run.stdout.includes(needle), `stdout contains ${JSON.stringify(needle)}`);
      for (const needle of expect.stdoutExcludes ?? []) assert.equal(run.stdout.includes(needle), false, `stdout does not contain ${JSON.stringify(needle)}`);
      for (const needle of expect.stderrContains ?? []) assert.ok(run.stderr.includes(needle), `stderr contains ${JSON.stringify(needle)}`);
      passed += 1;
      console.log(`pass  ${title}  ${fixture.note ? `- ${fixture.note.slice(0, 70)}` : ''}`);
    } catch (error) {
      failed += 1;
      console.log(`FAIL  ${title}`);
      console.log(`      ${error?.message ?? error}`);
    }
  }
}

if (harnesses.length === 0) {
  console.log('FAIL  no fixture directory found under adapters/fixtures');
  failed += 1;
}
fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed (${harnesses.length} harness(es): ${harnesses.join(', ')})`);
process.exitCode = failed === 0 ? 0 : 1;
