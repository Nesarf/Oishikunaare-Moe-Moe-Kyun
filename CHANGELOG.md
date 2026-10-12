# Changelog

## 0.1.0 - 2026-10-12

First release.

- One global system prompt section (`tasty-line-out`, order 50), registered from a profile-level
  plugin, so it reaches every preset, every workspace, every new conversation and every subagent
  without editing a single preset file.
- Rule 1, symbol discipline: no check-mark or cross judgement glyphs in replies or in written files.
  The ban names Unicode code points instead of printing the glyphs - a first cut printed them, and an
  agent reciting the rule handed the whole set back into the conversation.
- Rule 2, kaomoji habit: a light Japanese-style emoticon in conversation, with dosage stated rather
  than examples stacked, and conversation-only scope.
- Rules as data: shipped locales `en` and `zh` in `src/index.js`, overridable per locale by
  `rules/<locale>.json` and per rule by `$DSH_HOME/agent-house-rules.json`
  (`locale`, `bannedSymbols`, `kaomoji`, `rules`, `append`, `enabled`).
- Self-contained by construction: no dependencies, no network, no build tooling beyond Node.
- Invariants checked in CI and by `npm run verify`: ASCII-only source and documents with two
  documented exceptions, version agreement across `package.json` / `CHANGELOG.md` /
  `README.zh-CN.md`, and behaviour asserted by `test/selfcheck.mjs` against the built artifact.
