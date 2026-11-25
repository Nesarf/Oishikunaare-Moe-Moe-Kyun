import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { EXPAND_STRINGS, applyExpand, clientCandidate, isOpenByDefault, revertExpand } from '../src/client-patch.mjs';

const roots = [];
function fixture(label, body) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `mmk-expand-${label}-`));
  roots.push(root);
  const file = clientCandidate(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body, 'utf8');
  return file;
}

// The spaced shape this patch was first written against.
const pristine = `// fixture\n${EXPAND_STRINGS.oldDisclosure}\n// middle\n${EXPAND_STRINGS.oldCard}\n// tail\n`;
const file = fixture('spaced', pristine);

const first = applyExpand(file);
assert.equal(first.changed, true, 'the pristine fixture should be patched');
assert.equal(isOpenByDefault(fs.readFileSync(file, 'utf8')), true, 'the patched file should carry the marker');
assert.ok(fs.existsSync(`${file}.orig`), 'the original should be kept beside the client');
assert.equal(fs.readFileSync(`${file}.orig`, 'utf8'), pristine, 'the backup is the pristine text');

const second = applyExpand(file);
assert.equal(second.already, true, 'a second run should report already patched');
assert.equal(second.changed, false, 'and change nothing');

// The minified shape a later DSH ships: no indentation, no spaces around the operators.
const pristineMin = `// fixture\n${EXPAND_STRINGS.oldDisclosureMin}\n// middle\n${EXPAND_STRINGS.oldCardMin}\n// tail\n`;
const fileMin = fixture('min', pristineMin);

const minFirst = applyExpand(fileMin);
assert.equal(minFirst.changed, true, 'a minified fixture should be patched through the second anchor pair');
const patchedMin = fs.readFileSync(fileMin, 'utf8');
assert.ok(patchedMin.includes(EXPAND_STRINGS.newDisclosureMin), 'the minified disclosure becomes the collapsed one');
assert.ok(patchedMin.includes(EXPAND_STRINGS.newCardMin), 'the minified card opens by default');
assert.ok(!patchedMin.includes(EXPAND_STRINGS.oldDisclosureMin), 'the minified anchor it replaced is gone');
assert.ok(!patchedMin.includes(EXPAND_STRINGS.oldCardMin), 'the minified card anchor it replaced is gone');
assert.equal(fs.readFileSync(`${fileMin}.orig`, 'utf8'), pristineMin, 'the minified backup is the pristine text');
assert.equal(isOpenByDefault(patchedMin), true, 'the marker is readable in the minified shape too');

const minSecond = applyExpand(fileMin);
assert.equal(minSecond.already, true, 'a second run on a minified bundle reports already patched, not a failure');

// Half of each pair is not a match: an upgrade that produced only one of the two shapes must fail loudly
// rather than replace half the edit and leave the client inconsistent.
const mixed = `// fixture\n${EXPAND_STRINGS.oldDisclosure}\n// middle\n${EXPAND_STRINGS.oldCardMin}\n// tail\n`;
const fileMixed = fixture('mixed', mixed);
const mixedResult = applyExpand(fileMixed);
assert.equal(mixedResult.failed, true, 'a mixed pair of anchors is reported as a failure');
assert.equal(mixedResult.changed, false, 'and nothing is written');
assert.equal(fs.readFileSync(fileMixed, 'utf8'), mixed, 'the mixed fixture is untouched');
assert.equal(fs.existsSync(`${fileMixed}.orig`), false, 'a failure leaves no backup behind');

// Neither shape at all: a bundle this patch was never written against.
const fileBare = fixture('bare', '// fixture\nnothing recognisable here\n');
const bareResult = applyExpand(fileBare);
assert.equal(bareResult.failed, true, 'an unknown bundle fails instead of pretending');
assert.equal(fs.existsSync(`${fileBare}.orig`), false, 'and writes no backup');

const reverted = revertExpand(file);
assert.equal(reverted.reverted, true, 'revert should copy the backup back');
assert.equal(fs.readFileSync(file, 'utf8'), pristine, 'and the file is pristine again');

const missing = revertExpand(`${file}.nope`);
assert.equal(missing.failed, true, 'revert without a backup fails rather than guessing');

for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
console.log('client-patch: all checks pass');
