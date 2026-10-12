# Changelog

## 0.4.0 - 2026-10-12

- The strict judge seeds itself from what the plugin actually ships. Turning on allow mode used to
  refuse the plugin own text: the rules name characters in prose and the palette is made of faces, so
  a judge that had not read them flagged the thing it had just shipped. The seed is derived from the
  assembled rules and every loaded face, and recomputed on each resolve, so a face added at runtime
  is covered too. A strict judge that cannot read its own palette is not strict, it is broken.
- Both judges now travel with the rules instead of being frozen at registration, which makes the mode
  switchable mid-session: edit selfCheckMode and the next step is judged by the other one, in a
  session that was already running. Same for the palette and for allowExtra.
- allowExtra means something in each mode. Under allow it admits a character the strict blocks refuse;
  under deny it withdraws a character from the judgement list, which also rewrites the list the agent
  reads - so an exception is stated in the instruction, not only applied in the checker.
- A repeated reminder stops repeating itself. The second notice in a session says which reminder it is,
  names the scope it is holding the agent to, and asks for the change before the code point is written
  rather than after. A fixed sentence invites a fixed response.
## 0.3.0 - 2026-10-12

- Two judges, one switch. `selfCheckMode: "allow"` stops naming what is forbidden and permits only
  what is plainly text: printable ASCII, Latin letters and accents, General Punctuation, currency,
  Greek (the omega a kaomoji mouth is made of), CJK and its punctuation, fullwidth forms, arrows,
  maths, box drawing, and yin yang. Emoji, dingbats, Geometric Shapes, Letterlike Symbols and the
  combining-mark blocks all fall outside it - a combining accent used to build a look-alike is
  exactly the evasion this mode closes. `allowExtra` names characters or code points to let through.
  The trade is stated rather than hidden: a rare legitimate character has to be named to be usable.
- An acceptance harness, `test/acceptance.mjs`, runs in `npm run verify`. It builds a small but
  faithful event dispatcher (handlers registered with ctx.on, chained through next()), mounts the
  plugin with apply(), drives real steps, and asserts what reaches the model. This is the proof the
  self-check never had: a step carrying a breach now produces a notice in front of the messages,
  in the same run that proves the build. Nine cases cover registration, the notice, clean steps,
  a breach inside thinking, no double notice, tool output left alone, the two judges differing,
  the off switch, and a failing inner step not being swallowed.
## 0.2.0 - 2026-10-12

- The rules now have teeth. A prompt cannot notice anything, so the plugin also subscribes to
  `agent/pre-step` - which fires before each model step with the conversation in hand - and looks at
  what the agent itself just said. When its own prose or thinking carries a banned glyph, one notice
  is placed in front of the next step naming the code points and asking for words instead.
- It judges only channels the model authored: text and thinking. Tool results, file contents and
  fetched pages are the world talking, and the rule tells the agent not to relay them rather than
  holding it responsible for what a test runner prints.
- Exemptions keep it from crying wolf: fenced code and inline code (an example is data), and the
  code-point references the rule itself asks for. A warning that printed the offending glyph would
  be another copy of the thing being banned, so the notice names code points only.
- Each offending message is notified once, and a session has a notice budget (three by default).
  Past it, breaches are logged and nothing is injected, because a hook that keeps talking becomes
  the noise it exists to reduce. `selfCheck: false` turns the whole thing off, `selfCheckMax` sets
  the budget.

  Honest limit: the notice path is covered by unit tests that feed it synthetic messages, but no
  live breach has been observed yet - two attempts to make a model emit a banned glyph on purpose
  were both refused, which is the prompt rule working rather than the check being proven.
## 0.1.4 - 2026-10-12

- The symbol ban was too narrow to be hard. An audit against the wider judgement-mark family
  found the code-point list covered 9 glyphs and missed 19: the multiplication signs a table uses
  for no, the squared variant of the cross, tick-shaped roots, and the hand emoji. The list now
  names 26, and the audit is pinned as a test so a future edit cannot quietly shrink it.
- Decorative marks are exempt on purpose: a heart, a note or a star inside a kaomoji is not a
  judgement, and the shipped palette uses them. The test asserts both directions.
- Scope now names tool output: a test runner, a table or a web page that hands over these glyphs
  must be reported in words rather than pasted through, because the transcript is context.
  Markdown task-list checkboxes are named too, for the same reason.
- The rule states its own weakness instead of hiding it: naming what is banned is what a reader
  can act on, an allow-list would be tighter, and that is the honest next step.
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
