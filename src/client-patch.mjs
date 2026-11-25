/**
 * Patch the installed DSH transcript client so every disclosure starts open.
 *
 * The transcript's disclosures (assistant reasoning, process groups, multi-line command cards) are
 * React-local state inside `dsh-client-ui-chat`. A host-side plugin cannot change another package's
 * component state, so the only lever is the installed bundle itself: this module rewrites the two
 * defaults, keeps the original beside it, and can put it back.
 *
 * It is DSH-specific on purpose and says so: on a host without that package it reports the path it
 * looked for instead of pretending to have patched something.
 */
import fs from 'node:fs';
import path from 'node:path';

const CHAT_CLIENT = path.join('node_modules', '@deepseek-ai', 'dsh-client-ui-chat', 'lib', 'client.js');

const OLD_DISCLOSURE = [
  '\t\tfunction useDisclosure(version = 0) {',
  '\t\t\tconst [expandedVersion, setExpandedVersion] = (0, react.useState)(null);',
  '\t\t\treturn {',
  '\t\t\t\texpanded: expandedVersion === version,',
  '\t\t\t\tsetExpanded: (0, react.useCallback)((open) => {',
  '\t\t\t\t\tsetExpandedVersion(open ? version : null);',
  '\t\t\t\t}, [version]),',
  '\t\t\t\ttoggle: (0, react.useCallback)(() => {',
  '\t\t\t\t\tsetExpandedVersion((previous) => previous === version ? null : version);',
  '\t\t\t\t}, [version])',
  '\t\t\t};',
  '\t\t}',
].join('\n');

const NEW_DISCLOSURE = [
  '\t\tfunction useDisclosure(version = 0) {',
  '\t\t\tconst [collapsedVersions, setCollapsedVersions] = (0, react.useState)(() => new Set());',
  '\t\t\tconst collapsed = collapsedVersions.has(version);',
  '\t\t\treturn {',
  '\t\t\t\texpanded: !collapsed,',
  '\t\t\t\tsetExpanded: (0, react.useCallback)((open) => {',
  '\t\t\t\t\tsetCollapsedVersions((previous) => {',
  '\t\t\t\t\t\tconst next = new Set(previous);',
  '\t\t\t\t\t\tif (open) next.delete(version); else next.add(version);',
  '\t\t\t\t\t\treturn next;',
  '\t\t\t\t\t});',
  '\t\t\t\t}, [version]),',
  '\t\t\t\ttoggle: (0, react.useCallback)(() => {',
  '\t\t\t\t\tsetCollapsedVersions((previous) => {',
  '\t\t\t\t\t\tconst next = new Set(previous);',
  '\t\t\t\t\t\tif (next.has(version)) next.delete(version); else next.add(version);',
  '\t\t\t\t\t\treturn next;',
  '\t\t\t\t\t});',
  '\t\t\t\t}, [version])',
  '\t\t\t};',
  '\t\t}',
].join('\n');

const OLD_CARD = '\t\tconst GenericCommandCard = (0, react.memo)(function GenericCommandCard({ node, t, runningSummary }) {\n\t\t\tconst [expanded, setExpanded] = (0, react.useState)(false);';

const NEW_CARD = '\t\tconst GenericCommandCard = (0, react.memo)(function GenericCommandCard({ node, t, runningSummary }) {\n\t\t\tconst [expanded, setExpanded] = (0, react.useState)(true);';

/** Where the chat client would sit below one DSH package root. */
export function clientCandidate(dshRoot) {
  return path.join(dshRoot, CHAT_CLIENT);
}

/**
 * Find an installed DSH package root.
 *
 * A guess is only a guess: `--dsh` is the reliable answer, and this list exists so a plain
 * `mmk expand` works on the common layouts instead of demanding a path first.
 */
export function guessDshRoot() {
  const candidates = [];
  if (typeof process.env.DSH_ROOT === 'string' && process.env.DSH_ROOT !== '') candidates.push(process.env.DSH_ROOT);
  if (typeof process.env.APPDATA === 'string' && process.env.APPDATA !== '') {
    candidates.push(path.join(process.env.APPDATA, 'npm', 'node_modules', '@deepseek-ai', 'dsh'));
  }
  candidates.push(path.join(process.cwd(), 'node_modules', '@deepseek-ai', 'dsh'));
  for (const root of candidates) {
    if (fs.existsSync(clientCandidate(root))) return root;
  }
  return null;
}

/** Whether this bundle already carries the default-open patch. */
export function isOpenByDefault(text) {
  if (!text.includes('collapsedVersions')) return false;
  // The marker has to be read in the shape the build actually uses: a minified bundle never carries
  // the spaced card opener, so asking only for that one made a second run report a failure instead of
  // "already patched".
  const openedSpaced = NEW_CARD.split('\n')[1];
  const openedMin = NEW_CARD_MIN.slice(NEW_CARD_MIN.indexOf('const[expanded'));
  return text.includes(openedSpaced) || text.includes(openedMin);
}

/**
 * Apply the patch, keeping the original beside it.
 *
 * The backup is written once and never overwritten, so a second run cannot replace a pristine copy
 * with an already-patched one.
 */
export function applyExpand(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (isOpenByDefault(text)) return { already: true, changed: false, backup: null };
  // The bundle ships in two shapes: the spaced build this patch was first written against, and the
  // minified one a later DSH produces. Both are tried, spaced first, so an upgrade does not silently
  // turn the patch into a no-op.
  const sets = [
    { disclosure: OLD_DISCLOSURE, card: OLD_CARD, nextDisclosure: NEW_DISCLOSURE, nextCard: NEW_CARD },
    { disclosure: OLD_DISCLOSURE_MIN, card: OLD_CARD_MIN, nextDisclosure: NEW_DISCLOSURE_MIN, nextCard: NEW_CARD_MIN },
  ];
  const hit = sets.find((set) => text.includes(set.disclosure) && text.includes(set.card));
  if (hit === undefined) return { already: false, changed: false, backup: null, failed: true };
  const backup = `${file}.orig`;
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
  let next = text.replace(hit.disclosure, hit.nextDisclosure);
  next = next.replace(hit.card, hit.nextCard);
  fs.writeFileSync(file, next, 'utf8');
  return { already: false, changed: true, backup };
}

/** Put the original client back, when a backup exists. */
export function revertExpand(file) {
  const backup = `${file}.orig`;
  if (!fs.existsSync(backup)) return { reverted: false, backup: null, failed: true };
  fs.copyFileSync(backup, file);
  return { reverted: true, backup };
}

// The same two edits against the minified bundle a later DSH ships: no indentation, no spaces around
// the operators. Kept as a second anchor pair rather than a regex so a mismatch fails loudly.
const OLD_DISCLOSURE_MIN = 'function useDisclosure(version=0){const[expandedVersion,setExpandedVersion]=(0,react.useState)(null);return{expanded:expandedVersion===version,setExpanded:(0,react.useCallback)(open=>{setExpandedVersion(open?version:null)},[version]),toggle:(0,react.useCallback)(()=>{setExpandedVersion(previous=>previous===version?null:version)},[version])}}';

const NEW_DISCLOSURE_MIN = 'function useDisclosure(version=0){const[collapsedVersions,setCollapsedVersions]=(0,react.useState)(()=>new Set());const collapsed=collapsedVersions.has(version);return{expanded:!collapsed,setExpanded:(0,react.useCallback)(open=>{setCollapsedVersions(previous=>{const next=new Set(previous);if(open)next.delete(version);else next.add(version);return next})},[version]),toggle:(0,react.useCallback)(()=>{setCollapsedVersions(previous=>{const next=new Set(previous);if(next.has(version))next.delete(version);else next.add(version);return next})},[version])}}';

const OLD_CARD_MIN = 'GenericCommandCard=(0,react.memo)(function GenericCommandCard({node,t,runningSummary}){const[expanded,setExpanded]=(0,react.useState)(false);';

const NEW_CARD_MIN = 'GenericCommandCard=(0,react.memo)(function GenericCommandCard({node,t,runningSummary}){const[expanded,setExpanded]=(0,react.useState)(true);';

/** The exact strings this patch replaces, exported so a test can build a fixture from them. */
export const EXPAND_STRINGS = Object.freeze({
  oldDisclosure: OLD_DISCLOSURE,
  newDisclosure: NEW_DISCLOSURE,
  oldCard: OLD_CARD,
  newCard: NEW_CARD,
  oldDisclosureMin: OLD_DISCLOSURE_MIN,
  newDisclosureMin: NEW_DISCLOSURE_MIN,
  oldCardMin: OLD_CARD_MIN,
  newCardMin: NEW_CARD_MIN,
});
