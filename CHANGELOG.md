# Changelog

## 0.9.0 - 2026-10-13

- The repository and the package are now **Oishikunaare-Moe-Moe-Kyun**. The install row, the package
  name, the library's own name field and every repository URL changed with it; the prompt section name
  (`tasty-line-out`) and the plugin's internal `name` stayed put, because changing them would invalidate
  the installed row and every test that finds the section by name without making anything clearer.
- **A moe layer**, off by default. It is defined from the subculture rather than from the word's drift
  into a synonym for cute: moe is the inward resonance a set of traits stirs in the reader, the source is
  explicit that courage and stubbornness are moe attributes too, so the layer is not "sound cute" - it is speaking as
  someone with a consistent voice, being visibly fond of the work, and letting the work carry the care.
- It lands in four places and is fenced out of two. In: replies, the agent's own thinking, the commands
  it runs and the prompts it hands to subagents, and the work products it writes - where comments,
  docstrings, README and report prose, commit messages, user-visible strings and test failure text may
  carry it. Out: code itself (identifiers, paths, arguments, API names, schema fields and data keys stay
  plain, because moe there is breakage), and anywhere beside an error, a stack trace, a serious
  conclusion, a security warning, machine output, or something the reader will execute directly.
- **Tri-lingual.** `rules/voices/{zh,en,ja}.json` ship six voices each (gentle, spirited, composed,
  timid, prickly, elegant), and their markers are lifted from the speech-tic examples on Moegirlpedia's
  kuchiguse entry - the onomatopoeic tics, the sentence-final particles, the star and note marks. The
  three sets are not translations of one another: Chinese has sentence-final particles but no Japanese
  final-particle system, and English has neither, so its set leans on rhythm and interjection rather than
  forcing particles it does not have. A reply in one language is given the markers of *that* language,
  not of the locale the voice was resolved in.
- **Per-agent adaptation**, both ways. `moeVoice: "auto"` (the default) infers a voice from the words of
  the session - tsundere / tsundere / tsundere, genki, reisei, ojou-sama and friends - and stays silent when nothing
  names one, because a wrong voice is worse than a plain one. `moeVoice: "elegant"` fixes it, and
  `moeVoiceSignals` extends the mapping with a user's own words.
- The voice instruction is injected once per session rather than printed into the shared prompt block: the
  block is registered once and shared, while the hook has the agent and its conversation in hand. Cost is
  one short message per session, and the table is only read while the layer is on.
- `moe: "off" | "soft" | "full"` (default off) is the switch. Off by default because a layer that changes
  how every agent in a profile sounds is a taste decision, and a taste decision ships as an opt-in.
- The allow-list judge reads the new block as language rather than as a leak: its seed is derived from the
  block and the tables, so Japanese kana in a marker set is admitted and nothing in the layer trips its
  own rule.
- `test/selfcheck.mjs` grows from 48 checks to 54, covering the off-by-default switch, the four places and
  both prohibitions, the three tables and their fallbacks, inference in all three languages (including the
  silence when nothing matches), the localised markers, the once-per-session injection, and a configured
  voice overriding inference.
- Housekeeping: `scripts/gen-voices.mjs` generates the tables and `check:generated` now fails when they
  drift, so `npm run gen` covers all three data layers.

## 0.8.0 - 2026-10-13

- The first two levers are both after the fact: the prompt section is read at assembly, and the pre-step
  notice lands at the start of the NEXT step. So a turn that closes with prose and no kaomoji is noticed
  only once it is already sent. DSH exposes one channel that is not after the fact - `agent/turn-stopping`
  is awaited before the boundary commits, and a listener that steers keeps the turn open for one more
  step - so the reminder can arrive while the reply is still the thing being written.
- `kaomojiSteer` (default **false**) turns it on; `kaomojiSteerMax` (default 1) caps the extra passes per
  session. Off by default because a steer costs a model step, and because the rule itself says a forced
  kaomoji is worse than none: this is a lever to reach for when the habit demonstrably is not landing,
  not a default behaviour nobody chose.
- It is guarded on five sides: the newest reply has to be bare prose, the turn gets one steer at most,
  the session gets its budget, a disabled section steers nothing, and a turn that already breached the
  symbol or emoji rule is left to that rule. Structure still exempts - a reply made of tables or bullets
  is exactly where the rule asks for none, so it is never steered for being face-less.
- The steering text asks for the reply it just gave rather than an appendix, in both locales, because
  appended chatter would be worse than the miss.
- Scope note: this lever is about the kaomoji habit only. The symbol ban and the emoji ban keep their own
  notices and their own budgets; a turn is never steered twice over two rules.
- test/selfcheck.mjs grows from 45 checks to 48 and test/acceptance.mjs from 14 to 17: the bare-reply
  reader, the notice, every guard on the decider, that nothing registers while the switch is off, and
  that a bare turn is steered exactly once within budget.

## 0.7.1 - 2026-10-13

- The kaomoji floor was met in 4 of 207 replies across a full session, and the newest 25 replies
  carried 40 sentences and zero faces. The cause was not dosage: the floor arithmetic already asks
  for one face on a single sentence, so the misses were short replies being treated as exempt, and a
  reminder that only ever looks at the newest reply cannot see a run of them.
- So the judge reports a bare reply (prose with no face at all), and the hook counts how many
  consecutive replies sit behind the newest one. A run of two or more gets its own wording - it says
  the habit is being skipped, not under-dosed - with its own small budget, and the run counter ignores
  structure, because a reply made of tables or a stack trace is exactly where the rule asks for none.
- The shortage notice said the floor was five sentences where the shipped rule says three; it now
  agrees with the rule it is reminding about.
- test/selfcheck.mjs grows from 41 checks to 45, pinning the run counter in both directions, the bare
  verdict, and the two wordings.
## 0.7.0 - 2026-10-12

- Emoji are banned outright, in replies, in thinking and in every written file. It is a block-level
  ban rather than a character list (pictographs, faces, transport, Miscellaneous Symbols, the
  geometric shapes that carry emoji presentation, plus the variation selector, the zero width joiner
  and the skin tone modifiers), because a list would need regenerating every Unicode release and
  would still be incomplete. Decoration is carved out: a heart, a note, a star, a sparkle, a flower
  and a solar mark are what the palette is made of, so the ban admits exactly the code points the
  loaded library uses - a judge that refuses its own palette is broken, not strict.
- The emoji ban has teeth of the same kind the symbol ban has: a breach in the newest assistant
  message injects one notice at the next step, naming the code points and never reprinting the
  glyph. It keeps its own budget (emojiCheckMax, default 2) so it cannot spend the symbol budget,
  and emojiCheck: false turns it off. emojiAllowExtra admits further decorative marks.
- The kaomoji library goes from 59 faces to 1150, in 14 mood categories. It is generated rather
  than hand-written: scripts/gen-kaomoji.mjs composes each face from parts real kaomoji use (omega
  and dot eyes, the de and tsu mouths, arabic and kannada marks, raised-sweat and hand signs), so a
  combination reads like something a person wrote, and every axis entry carries its own annotation
  so a face description is those annotations joined. Four gates keep it honest: uniqueness across
  categories, a length window, at least one non-ASCII character, and balanced brackets.
- The library would have been forty thousand faces without a cap, which is not a library anybody
  reads. Each category now samples its candidates evenly against a quota, so the file lands at a
  size a person can go through and every mood is represented.
- The prompt ceiling for the library goes from 60 faces to 140 (kaomojiLibraryMax), because a
  1150-face palette needs room to be a palette. A stable prefix keeps the prompt cacheable, the tail
  is counted rather than printed, and the block still names the file so the rest stays reachable.
- The kaomoji reminder budget goes from 4 per session to 5, aimed at the same measured problem the
  last two releases chased: one face per 22.5 sentences where the rule asks for one per three.
- scripts/gen-rules-json.mjs now generates rules/en.json and rules/zh.json from the packaged
  constants, and npm run verify fails when either the locale files or the library drift from what
  their sources produce. Two hand-kept copies of one decision is one copy too many.
- test/selfcheck.mjs grows from 35 checks to 41, pinning the emoji judge, the decorative carve-out,
  the notice and its budget, the block-level wording in both locales, and every promise the library
  makes about itself.
## 0.6.0 - 2026-10-12

- The kaomoji floor is raised from one per five sentences to one per three, and text now says two
  sentences or more carries one while four or five carrying two reads right. The old sentence was
  reachable by a reply that showed a single face and called it done.
- The reminder budget goes from one per session to four. That was the real defect: a single reminder
  fired early and never again, so the rule had exactly one chance to change anything. Measured before
  the change: one kaomoji per 22.5 sentences, floor met in 3 of 162 messages.
- Verification pins the words and the judge together: the shipped locales must say three, and the
  judge default must agree, because a floor that says three while the judge asks for five is a rule
  that quietly stops being the rule it claims to be. Both live settings are read per turn, so the
  stricter floor applies from the next step; the rule text needs a host restart.
## 0.5.0 - 2026-10-12

- The kaomoji rule got the check the symbol rule already had, because measurement said it needed one:
  auditing this repository own session found one kaomoji per 26 sentences where the rule asks for one
  per five, and the floor met in 0 of 58 messages. The hook now counts the prose of the newest reply
  and reminds when the floor is missed or a face repeats back to back. Structure is not counted -
  fenced blocks, inline code, tables, bullets and headings are set aside, so a reply full of tables does
  not become unwinnable by arithmetic. The wording is deliberately softer than the symbol notice: a
  shortage is a slipped habit, not a breach. `kaomojiCheck: false` turns it off, `kaomojiCheckMax`
  (default 1) sets its reminder budget, `kaomojiFloor` (default 5) the sentences per face.
- `scripts/audit-session.mjs` now measures with the plugin own prose and face detection rather than its
  own copy, so the audit and the hook cannot drift apart. On the same session the sentence estimate fell
  from 630 to 340 once structure was removed, and the ratio held: about one face per 26 sentences.
- The example exception is tightened. The rule already said to name code points instead of printing
  glyphs; it now says explicitly that printing one to explain the rule, or to show that it is banned, is
  also refused - only a person asking for the glyphs by name gets them printed.
- `scripts/check-text.mjs` (npm run check:text) reports what the rules currently resolve to - config,
  locale, rule length, palette size, which judge and its list or seed, the self-check settings and the
  floor - and judges a string from argv or stdin against the same judge the hook uses.
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
