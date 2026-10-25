import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { EXPAND_STRINGS, applyExpand, clientCandidate, isOpenByDefault, revertExpand } from '../src/client-patch.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mmk-expand-'));
const file = clientCandidate(root);
fs.mkdirSync(path.dirname(file), { recursive: true });

const pristine = `// fixture\n${EXPAND_STRINGS.oldDisclosure}\n// middle\n${EXPAND_STRINGS.oldCard}\n// tail\n`;
fs.writeFileSync(file, pristine, 'utf8');

const first = applyExpand(file);
assert.equal(first.changed, true, 'the pristine fixture should be patched');
assert.equal(isOpenByDefault(fs.readFileSync(file, 'utf8')), true, 'the patched file should carry the marker');
assert.ok(fs.existsSync(`${file}.orig`), 'the original should be kept beside the client');
assert.equal(fs.readFileSync(`${file}.orig`, 'utf8'), pristine, 'the backup is the pristine text');

const second = applyExpand(file);
assert.equal(second.already, true, 'a second run should report already patched');
assert.equal(second.changed, false, 'and change nothing');

const reverted = revertExpand(file);
assert.equal(reverted.reverted, true, 'revert should copy the backup back');
assert.equal(fs.readFileSync(file, 'utf8'), pristine, 'and the file is pristine again');

const missing = revertExpand(`${file}.nope`);
assert.equal(missing.failed, true, 'revert without a backup fails rather than guessing');

fs.rmSync(root, { recursive: true, force: true });
console.log('client-patch: all checks pass');
