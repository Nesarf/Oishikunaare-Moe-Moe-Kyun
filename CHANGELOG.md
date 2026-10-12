# Changelog

## 0.1.3 - 2026-10-12

- The kaomoji rule became a floor instead of a garnish: at least one kaomoji per five sentences, so
  a reply of five sentences or more carries at least one. The previous wording said one or two is
  the norm, which still left the habit invisible in practice.
- A kaomoji library ships: `rules/kaomoji.json` holds 59 unique faces across nine moods, each with
  the mood it carries. It is rendered into the prompt under the rules, so an agent draws from a
  palette rather than reusing one face. Labels carry both languages (`feel`/`use`/`label` and
  `feelZh`/`useZh`/`labelZh`).
- Grow it without touching code: edit that file, or point `kaomojiLibrary` at your own library file(s).
  A list replaces the shipped file; `kaomojiLibraryMax` caps how many faces reach the prompt, and
  the remainder is counted rather than printed, which keeps the prompt prefix stable and cacheable.
  `kaomojiLibraryCollapse` puts each category on one line.
- Library files are watched like the config file, so a face added at runtime lands on the next model
  step of every running session.
## 0.1.2 - 2026-10-12

- The rule text is now live. The section registers `text` as a function instead of a captured
  string, and the prompt registry evaluates it while assembling each model step - so an edit to
  `$DSH_HOME/agent-house-rules.json` lands at the next step of every running session and every new
  conversation, with no host restart. Before this, the text was frozen at registration and only a
  restart could change it. The resolver stats the file and rebuilds only when the stamp moves, and
  `enabled: false` now empties the section at read time rather than registering nothing.
- `rules/<locale>.json` is no longer a third override layer. It is the packaged locale in data form,
  generated from the same source as the constants, so reading both was one decision made twice.
- Selfcheck grew to 15 checks, covering the function-valued section, a config edit landing on the
  next read, a locale switch dropping the previous language, and a broken file being reported
  rather than swallowed.
  Verified live rather than by reading the code: a headless host was started with the config set to
  one value, the config was rewritten mid-run, and on its next step the agent reported the new text
  appearing in its own system prompt - it did not read any file to find it, and it said so. So an
  edit lands in a session that was already running, not only in sessions started afterwards.
## 0.1.1 - 2026-10-12

- The rules now name the thinking transcript explicitly. It is context too: a thought recorded on
  one turn is re-read on the next, so both disciplines cover thinking and not only replies -
  symbol discipline states it, and kaomoji scope became "replies AND your own thinking",
  because thinking is where the work happens and the last place that should sound like a machine.
- Kaomoji dosage raised. The first wording capped it at "at most one or two in a single reply",
  which reads as a ceiling and produced a habit that barely showed. It now says one or two is the
  norm and three in a longer reply is natural - a baseline rather than a limit.

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
