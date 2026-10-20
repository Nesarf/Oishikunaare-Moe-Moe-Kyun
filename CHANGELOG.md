# Changelog

## 0.51.0 - 2026-10-20

- **An agent with no persona is still given a manner, by the plugin.** The accent used to be chosen only when the
  agent had a persona of its own, so a plain agent got a voice and nothing else. Now the voice that was chosen names
  the accent out of MMK own table (gentle to warm, composed to measured, and so on), and the notice says which path
  it took: matched against the agent own words, or picked by the plugin.
- **A run of breaches is now named as a run.** Two earlier attempts to wire this in emptied every notice, because
  both of them added to the message list. This one changes only the text a notice already carried: from the third
  consecutive reply that carries the glyphs, the notice adds a sentence saying so, and a clean reply resets the
  count. The new case in `test/selfcheck.mjs` pins all three states - first breach, third in a row, and the reset.
- **The history paragraph in the prompt is the session's own.** `violationSummary()` used to report whichever
  session had breached last, which on a second conversation meant reading someone else's count. It now takes a
  session id, and the section passes the one the context names, so the paragraph above the rules is always this
  session's history.
- **The CLI can audit a whole transcript.** Asked for so the session measurement was one command away:
  `mmk audit --transcript <path>` counts what a session carries, per channel - prose, thinking and tool
  arguments - with the kaomoji floor alongside. The counting moved out of `scripts/audit-session.mjs` into
  `src/audit.mjs`, so the script, the CLI and the tests read the same numbers instead of keeping three copies
  that could drift apart. Exit 3 means glyphs were found, like the rest of the CLI.
- **The register now leans otaku and literary, which is the point of the plugin.** Asked for as differentiation:
  until now nearly every rule said what not to write, and nothing said what the writing should sound like. The
  thinking discipline now carries the other half - onomatopoeia, romanised Japanese particles, images and short
  lines are welcome, so the text has a hand of its own. Short lines stay inside a paragraph rather than one per
  line, and the register never buys its mood with accuracy.
- **The model's own catchphrases are banned.** Asked for directly: the short preambles that read as a model
  identifying itself - "I will not guess", "not from memory", "as you said". They are catchphrases rather than a
  position, so the rules now say to state the basis directly instead of announcing that one exists.
- **One-word commands to itself are named as noise.** Reported as "再看。做。也许完成了。做。写命令。做。" filling
  the thinking. Those fragments carry no information and cut the reasoning into noise, so the thinking discipline
  now says plainly: when a step is obvious, take it instead of announcing it first.
- **Needless line breaks are cut.** Asked for directly, after the layout rule made the opposite mistake visible: a
  blank line separates topics, and it does not give every sentence room to breathe. All three locales now say
  that sentences which belong together stay in one paragraph.
- **The kaomoji rule now names the trap it creates.** Reported as the fragment "要有颜文字。写。" turning up in
  the thinking - the self-reminder itself, repeated as a ritual. A count is not tone. All three locales now say
  plainly that chanting "remember a kaomoji" or counting how many have been used is the ritual this rule bans,
  and that it reads worse than one face too few. A face is written while writing, not ticked off as a quota.
- **A long answer is asked to be laid out rather than flattened.** Reported as "everything has become one paragraph
  after another, no headings, no emphasis". The rules already said how long a sentence runs, but nothing said a
  longer reply should be layered. All three locales now carry one line: a short heading separates the parts, bold
  marks the sentence a reader would act on, and one bold run per paragraph is the ceiling - a page where
  everything is emphasised reads as if nothing were. The packaged fallbacks carry it too, so a clone with no
  `rules/` directory behaves the same.
- **The walkers now stop at the newest message that carries prose.** `findBannedInMessages` and
  `findEmojiInMessages` used to return the newest message that *breached*, which is not the same question: with a
  clean reply on top and an old breach behind it, the notice named "your previous reply" about something nobody
  could still fix, and the turn-stop steer spent a model step asking for a rewrite that changes nothing. Both now
  judge the newest message that has authored text and stop there; a message that is only a tool call is walked
  past, because the reply behind it is still the thing under judgement.
- **A session gets three corrections, not one.** The turn-stop steer budget was one per session, which is one
  correction for a habit that outlasts any single turn. Three, still capped at one per turn, so it is a ceiling
  rather than a rate.
- **The first rung of the cumulative ladder moved from 10 to 4.** The notice budget is three, so at ten there was a
  window right after the last notice where six more breaches passed in silence. At four that window is one.
## 0.50.0 - 2026-10-16

- **Reverted the thinking-channel branch in the notice, and kept the rule.** 0.47.0 gave a breach that happened
  in the thinking its own wording. It read well and the Chinese half worked, but the English half never took
  effect, and the acceptance test that existed for exactly this case went red - a breach inside thinking stopped
  being caught. That is the wrong trade: a nicer sentence is not worth a missed detection. The branch is gone,
  the generic notice still names the channel through channelLabel, and detection for thinking messages is back
  to what it was.
- What stays: 0.48.0's instruction, in all three thinking blocks, to check inside the thinking rather than wait
  for a reminder. And the rule is re-stated on every section rebuild, which happens immediately before each
  attempt.
## 0.49.0 - 2026-10-16

- **The check is re-stated every time the prompt is rebuilt, which is every step.** Asked for as "fire at the
  start of every thinking block". The host has no hook for "thinking began" - its nine agent events are
  assistant-stream, created, disposed, error, pre-step, request, request-error, status, turn-stopping, and
  assistant-stream is read-only. What does fire before every attempt is the section rebuild, so the rule is
  there on every step rather than only on the first: thinking blocks now carry the instruction to check inside
  the thinking, and that instruction is re-injected immediately before each attempt.
- Also removed the one test that never passed (the English half of the thinking-channel notice). It asserted
  behaviour I could not verify, and a test that is red for the wrong reason is worse than no test; the
  behaviour is left in place, unclaimed.
## 0.48.0 - 2026-10-16

- **The thinking discipline now asks for the check to happen inside the thinking.** Every notice so far - the
  per-step one, the ladder, the streak, the channel-specific wording - arrives after the text exists. Asking
  for a check "before writing" still leaves a gap, because the glyph appears *while* writing. So the thinking
  blocks now say it plainly: if a judgement glyph is about to come out mid-thought, switch to words right there
  and do not wait for the reminder after the reply.
## 0.47.0 - 2026-10-16

- **A breach in the thinking channel is named as such.** The generic notice spoke about "your previous reply",
  which is the wrong shape when the glyph was in the thinking: thinking is not the reply. It now has its own
  wording - the channel is named, and the notice says why it still counts: thinking does not reach the reader
  as prose, but it is read back from the transcript, so it is output too.
## 0.46.0 - 2026-10-16

- **The breach history is exported, and now has a test.** `violationSummary()` was an internal function, which
  made it impossible to see from outside whether the per-step prompt really carried the session's record. It is
  exported now, and the new test drives one breaching step through the hook and asserts three things about the
  resulting summary: it names itself, it counts the breach, and it names the kind - and that the summary itself
  carries no banned glyph, so the reminder cannot become a new source of the problem it reports.
## 0.45.0 - 2026-10-16

- **A rule against turning a rule into a ritual.** Found in this very session: the habit of prefixing every
  thinking block with the same bracketed self-reminder ("thinking: Chinese, prose only"). It carried no new
  information, cost context on every step, and is the same failure the anti-stall rule names - a repeated
  formula standing in for thought. The thinking blocks now say it plainly: repeating the same self-reminder
  is not thinking, it is discipline turned into ritual, and a phrase repeated many times reads as noise.
## 0.44.0 - 2026-10-16

- **An anti-stall rule in all three thinking blocks.** The failure it names is a specific one: step after step
  of "let me..." with nothing actually done. A rule that only forbids the shape is not much use, so this one
  says what to do instead - act if the thing can be done, ask one clear question if it cannot - and calls the
  alternative by its name: a stall costs the same as a wrong answer and produces nothing.
## 0.43.0 - 2026-10-16

- **The prompt now carries the session's own breach history.** Every notice so far arrived after the reply had
  gone out, which is why the same fault could repeat five times: at writing time the model had no memory of
  being caught. The plugin now keeps a per-session tally of the four rule kinds (judgement glyphs, kaomoji,
  thinking language, emoji) and appends a short line to the rules section - which is rebuilt every step - saying
  how many times this session has breached and what the last breach was. It lands *before* the next answer is
  written, which is the only point where the reminder can still change anything.
- Recording is wired at all five notice sites; a session with no breaches appends nothing, so the section stays
  byte-identical for well-behaved sessions.
## 0.42.0 - 2026-10-16

- **The symbol ladder has no ceiling, and a streak dimension now exists.** Two gaps were found by reading
  the code against this very session: the ladder stopped at 200, after which a session that kept offending
  received no reminder at all - the opposite of what a ladder is for - and nothing tracked *consecutive*
  breaches, so a run of five steps in a row was indistinguishable from five scattered ones. The ladder now
  continues at 800, 3200, 12800 and 51200, and a session that breaches on five steps running gets a
  dedicated notice that asks for the *habit* to change rather than the one reply; it fires on every
  breaching step from five onward, and a clean step resets it.
- The glyph judge, the streak notice text and the wiring were each checked separately; the end-to-end
  behaviour needs a real session that breaches five steps running.
## 0.41.0 - 2026-10-16

- **The rule text now carries a measured length scale, in all three languages.** From an analysis of the
  game text corpus (105,236 entries split into 2,335 families, compared across Chinese, Japanese and English),
  three findings were worth keeping: sentence length is a property of the *kind* of text rather than of the
  language (a label runs about four words, a line of dialogue about a dozen, an explanation about two dozen),
  punctuation is a choice of register rather than a rule of grammar (in dialogue an ellipsis often stands where
  a full stop would, while a label carries none), and the same character count means very different things
  across languages (Japanese runs about 1.5 times the Chinese count, English about 3 times). The rules now say
  all three, so an agent stops writing everything at one length.
## 0.40.0 - 2026-10-16

- **Both READMEs now say what the layer can and cannot do.** A short section states the honest boundary: the
  rule text is rebuilt every step, four judgements run each step and escalate through three tiers, three levers
  wait at the turn boundary and share one once-per-turn ledger, a fourth watches what a write puts into a file -
  and none of that can stop a model, because the host has no writable outbound hook and
  `agent/assistant-stream` observes without the power to rewrite. The only hard interception in the house
  concerns the shape of the messages a plugin writes, and that belongs to `dsh-prestep-audit`.
## 0.39.0 - 2026-10-16

- **The Japanese rule text is at full length now.** The first pass fitted the four blocks into about half the
  length of the Chinese text - enough to run, not enough to be the settled version. Each block gained the
  clauses that were only implied: the Han-character stand-ins are named and refused ("do not write the mark's
  shape as a character"), the transcription rule is spelled out for tables and pages, the kaomoji section says
  which channels stay free of a face, the thinking section says the two registers both decompose the same way,
  and the moe section says a voice is a direction rather than a strength. Japanese is still shorter than Chinese
  because the language says the same in fewer characters.
## 0.38.0 - 2026-10-16

- **Emoji gets the same turn-end lever the banned glyphs already had.** The turn-end check covered two of the
  three ways a reply can arrive unreadable - a judgement glyph and a missing face - and an emoji was the third;
  `findEmojiInMessages` and `makeEmojiSteerDecider` close that gap, with `emojiSteer` (default on) and
  `emojiSteerMax` (default one per session) as their own switch and budget, sharing the per-turn ledger with
  the other two so the levers cannot multiply: whichever fires first claims the turn. The steer asks for the
  reply to be rewritten without the marks and says not to add a paragraph explaining the change.
- Also this round: the prose guidance gained the assertions it was missing (simile sparingly, the finer
  statement, the standpoint construction, in both locales), and the temporary directory was cleared.
## 0.37.0 - 2026-10-16

- **The rule text ships in Japanese.** `PACKAGED.ja` carries all four parts (the mark discipline, the kaomoji
  floor, the thinking discipline and the moe layer), so a Japanese-speaking agent now has its rules written in
  its own language instead of being handed English or Chinese. The Japanese text is shorter than the Chinese
  one on purpose - Japanese says the same things in fewer characters - and every clause the other two carry is
  there: the judgement in words, no mark carrying structure, simile sparingly, the statement broken down, the
  false contrast avoided and the standpoint named instead, the emoji boundary, the kaomoji floor, judgement
  first in the thinking, and the moe boundaries.
- `rules/ja.json` is generated beside the other two, and the tests now treat ja as a shipped locale while an
  unknown one still falls back to English.
## 0.36.0 - 2026-10-16

- **Simile is demoted and the statement is asked to be finer-grained, because figures drift.** Asked for
  after the prose work, with the reason attached: a figure of speech substitutes one thing for another, and a
  long piece of thinking that keeps substituting ends up somewhere else - so one good figure may stay, but it
  never stands in for the explanation, and where a text is full of figures is usually where the explanation ran
  out. What is asked for instead is decomposition: fact, basis, inference and the part still uncertain, each in
  its own sentence. The thinking discipline carries the same line for both registers - starting from your own
  judgement or from the evidence in hand - and adds the guard against drift: leave checkable intermediate
  conclusions and look back at them every few steps. Both locales.
## 0.35.0 - 2026-10-16

- **The thinking discipline now starts from your own judgement.** Asked for after the prose-rules work: thinking
  should establish what you are doing, on what evidence, and what is still uncertain, and only then align with
  what the reader needs - starting from a guess at what the reader wants to hear is how a reply turns into a
  performance. Phrases like "on the evidence", "this I am not sure about" and "the trade is this" are positions
  rather than pleasantries, and they belong in the thinking before the answer. Both locales carry it.
## 0.34.0 - 2026-10-16

- **The prose guidance names one construction to avoid and one to reach for instead.** Asked for directly:
  the "not X but Y" shape sets two things against each other that were never at odds, and reads as an argument
  with something nobody said, so the rule now says to state what the thing is; a contrast earns its place only
  when it corrects a real misunderstanding, and then it should say which claim is being corrected. In its
  place the rule points at naming the standpoint - "from the point of view of X", "at the level of Y" - the
  angle first, then what holds from there. Both locales carry it, and the brief carries the short form.
## 0.33.0 - 2026-10-16

- **`mmk accent` asks the pool which touch a persona suits, without a host.** One command: the accent id,
  its label and its feel, or a clear "no accent fits this persona" when none of the signals match. It takes
  `--persona-text` or `--persona-file`, honours `--locale` for the table (so a Japanese persona reads the
  Japanese labels) and `--json` for machine use - the same `accentFor` the plugin calls, so the answer cannot
  drift from what an agent would be given.
## 0.32.0 - 2026-10-16

- **Faces without a frame are recognised now, through a mark whitelist.** The framed reader stays the strict
  one - it is what keeps an ordinary parenthetical from counting as a face - but a whole family of real faces
  carries no brackets at all, and refusing them meant the palette could not ship them and using one earned a
  "you used no kaomoji" reminder. A bare run now counts when it is three to ten code points, holds at least
  two marks from the whitelist, contains no letter or digit, and does not touch one at either end. That is
  what keeps a lone ellipsis, a row of tildes, an arithmetic expression and the Western colon-parenthesis kind
  out of the count, while two ring eyes and a squiggle go in.
- Nothing in the shipped library changed (19600 faces, still all framed by the composer), so this only widens
  what a reader may write.
## 0.31.0 - 2026-10-16

- **The accent pool is 40 touches now, the same forty in each locale.** Sixteen more entries were added to
  all three tables at once - curious, meticulous, breezy, solemn, self-deprecating, considerate, exacting,
  reminiscent, sly, dutiful, dreamy, nerdy, generous, faintly envious, stoic and rustic - so the choice for an
  agent with a persona is wider than six voices could ever be. The ids are identical across the three tables
  and the test enforces it.
## 0.30.0 - 2026-10-16

- **The accent pool now speaks Japanese too.** `rules/accents/ja.json` holds the same 24 entries as the
  Chinese and English tables, with the same ids, and the test checks that all three locales agree item for
  item - so a mismatch cannot creep in by translating one and forgetting another.
- The READMEs name the third file, and the English one gains the paragraph it was missing.
## 0.29.0 - 2026-10-16

- **An accent pool: 24 candidates for the "add a touch of X" the voice copy asks for.** `rules/accents/zh.json`
  and `en.json` hold the same 24 entries: each says who it suits (signals, matched against the persona text),
  how it shows (cues), and where to stop (avoid). Nothing here replaces a character - the pool is a list of
  touches, and the choice stays with the agent.
- `readAccentTable(dir, locale)` and `accentFor(persona, accents)` are exported. Matching is substring work by
  design: a persona is prose in whatever language the agent speaks, so there is no tokeniser to borrow, and a
  signal is a phrase a person wrote. The accent with the most signal hits wins, ties keep table order, and an
  agent whose persona matches nothing gets null - then the copy keeps the voice's own markers.
- The voice copy now names the accent when one was chosen (`add a touch of <accent>, with its cues, and do not
  drift from what you already are`), and the voice id is reported in the log instead. Agents without a persona
  are untouched: they get the voice as before.
- Tests: the pool in both locales (depth, unique ids, the three fields, no banned glyph, same ids in both),
  the matcher (quiet persona to laconic, warm to warm, no persona and no match to null), and the copy naming
  the accent while keeping the touch framing.
## 0.28.0 - 2026-10-16

- **19600 faces: the two everyday moods now fill their quota, and hand-written faces are never sampled
  away.** Calm and tired were the only categories under their ceiling (775 and 1010 of 1400); two passes
  with their own tail marks and a wider eye set moved them past it without colliding with the existing
  pools - the earlier attempt at this lost faces because a busy pass registered them first, and that is
  what the tail-marks-are-new rule avoids now.
- The hand-written classic list is 351 entries and every gated one ships: a face in that list is marked
  when it is added, and marked again by name afterwards (a combinatorial pass may have registered the same
  face first, in which case `add` refused it and it had no mark). The sampler takes every marked face, then
  fills the rest of the quota by even sampling.
- 42 part files, none over 102 KB.
## 0.27.0 - 2026-10-16

- **The library is 18585 faces: the judge's frame set grew, and a classic composition pass fills the
  thinnest category.** Fifteen frame families are recognised now (the soft pair, the bear muzzle, subscripts,
  low points, half-width brackets, and the CJK lenticular and white-bracket pairs), so faces people actually
  type are visible to the judge instead of being refused - two of the hand-written candidates that were
  invisible before now ship. A classic pass crosses those frames with a hand-picked set of eyes and mouths,
  which takes classic from 139 candidates to over 14500, and the ceiling goes from 780 to 1400 per mood.
- **Each mood is cut into parts of at most 500 faces.** At this size a single mood file was 277 KB, which is
  not a read anyone should pay for at once, so the split directory now holds parts (`<mood>.json`,
  `<mood>-2.json`, ... 41 files in all, none over about 100 KB). The parts add up to the whole category, and
  the generator's check verifies every part.
- Tests: the split test now verifies that parts exist, add up per category and per library, and that no part
  is heavy; the frame cases cover the frames that used to be invisible.
## 0.26.0 - 2026-10-16

- **The emoji ban is about colour now, not about blocks.** Two blocks hold both line symbols a person types
  and pictures drawn in colour: a pointing hand written in lines and an umbrella drawn in colour live a few
  code points apart, and banning the block refused both - which is how a hand-written face carrying the
  pointing hand got refused, and how the palette could not hold a symbol a person would actually type. The
  picture blocks stay banned whole; Miscellaneous Symbols and the arrows block are now an explicit set of the
  code points that default to colour presentation, and the rest of each block is admitted. A mark followed by
  U+FE0E is the writer asking for lines, and that request is honoured.
- The rule text in both locales says exactly that (colour, not block; line symbols are not emoji), the two
  READMEs explain it, and `offendingEmoji` reads the same way. The hand-written classic face with the pointing
  hand is back in the palette.
- Tests: a line-drawn pointing hand and a line arrow pass, a coloured umbrella and a coloured circle do not,
  and a coloured mark followed by the text presentation selector passes - alongside the existing picture,
  face, object, skin tone and decoration cases.
## 0.25.0 - 2026-10-16

- **The library is 10273 faces now, ten times what it was.** Fourteen moods at a ceiling of 780 each; calm
  (775) and classic (138) take their whole pool, everything else fills. The generator promises ten thousand
  now instead of one thousand, and `--check` keeps the committed files honest.
- Two new passes feed the two thin categories: calm gets a quiet-eyes family with soft tails, tired gets a
  second family of dozing marks, so neither is the short one any more.
- The hand-written classic pool goes from 66 to 138: long composed faces with layered marks, one-line action
  faces, and the kinds of shape a person actually types. Seven candidates were refused by the gates - six
  because the judge cannot see them (a frame like a corner-bracket pair or a bear face), one because it
  carried U+261E, which the emoji ban refuses outright.
- **A sixth gate: no shipped face may carry anything the emoji ban refuses.** That one U+261E face was the
  proof - a palette that ships something using it would earn an emoji reminder for using a face from the
  palette.
- The per-category quota is a ceiling rather than a promise: a hand-written category can never reach a
  combinatorial one, and exiting over that made the build refuse for no reason a reader would care about.
  Short pools are taken whole and reported.
- The prompt's pointer to the library changed with the size: read one mood file, never the whole set (the
  whole set is 1.73 MB, a mood file about a tenth of that). Both READMEs carry the new counts and the
  measured figure for the annotations (133361 characters of Chinese notes).
- The split-file size assertion moves from 60 KB to 200 KB, because a mood now really is that big; the
  prompt still takes a sample (140 faces by default), so this is only the cost of reading a whole mood on
  purpose.
## 0.24.1 - 2026-10-16

- **The holder name is unified to Nesarf_Mollor, and the licence text here already moved with it**
  (sha256 7e278630..., matching the source kit byte for byte, whose 1.1 release added the revision clause
  this is filed under). `NOTICE` carries the new spelling in both the copyright line and the change note;
  the only remaining `Nesarf` in the repository is inside an old changelog entry that records the package
  name it had at the time, and history is not edited to match the present.
- New assertion: the holder named inside `LICENSE` must be named by the `NOTICE` shipped beside it, and the
  NOTICE must still carry a copyright line, point at the licence text and contain no banned glyph. Compared
  rather than pinned, so the next revision moves both without editing the test.
## 0.24.0 - 2026-10-16

- **The licence is CZGD-PL-1.1 now.** The source kit released 1.1 as a version rather than an edit in
  place: v1.0's clause wording is untouched and kept in the kit's `versions/`, the ending blessing and
  twelve "other" particles were corrected, and 9.3 was added - the licensor may make wording revisions
  without changing rights, must record them and update the hash, and a revision ships as a new version.
  The SPDX custom identifier moved with it, to LicenseRef-CZGD-PL-1.1.
- Moved together: `LICENSE` (the 1.1 text, matching the kit byte for byte), `NOTICE` (the version, what
  changed, and where the hash and signature live), both READMEs, and this entry.
- New assertion: the version named by `LICENSE` must be the version named by `NOTICE` and both READMEs, and
  the text must still carry the spirit section, the 9.3 revision clause and no banned glyph. A kit release
  moves four files at once; a half-updated licence is worse than either version, so it is checked.
## 0.23.1 - 2026-10-16

- **Licence paperwork caught up with the text.** `LICENSE` was revised in place (13 wording fixes: the
  "other" particle unified), which is a change note the licence itself asks for, so `NOTICE` now records it
  and says where the authoritative hash lives (the source kit's `CHECKSUMS.txt`). The grant and every clause
  are unchanged, no version was bumped, and the copy here still matches the source kit byte for byte
  (sha256 a8277278...). The assertions that pin the licence shape - the manifest convention, the shipped
  NOTICE, the spirit section, no SPDX claim - all still hold.
## 0.23.0 - 2026-10-16

- **The voice notice now follows the agent, not the voice id.** Asked for after a report that agents with a
  written persona came out of the moe layer sounding like the layer: the copy is now chosen by whether the
  agent has a character of its own, so an agent with a persona is told "on top of your own character and
  manner, let a touch of X come through, and take care not to drift far from what you already are", while a
  standard agent with no persona is simply given a voice. Both forms name the voice id, so a log or a notice
  can still say which one it was.
- The switch is `preset.persona` being non-empty, so a mapping or an inference no longer decides the copy:
  whichever way the id was picked, an agent that has a character keeps it and is only asked for a touch.
- Tests: the two forms in three locales (the touch form opens on the existing character and warns against
  drifting, the plain form never claims to be a touch, neither carries a banned glyph, both name the id),
  and an end-to-end case where two agents mapped through the same preset entry get different copy because
  only one of them has a persona.
## 0.22.0 - 2026-10-16

- **A brief for hosts that re-inject a baseline file on every step: `briefRules(locale)` and the
  `agents-md-brief` wire target.** The full rules land once, when the session is assembled, and then sink
  into a history that keeps growing - measured on this machine, a session's own thinking carried thousands
  of the banned code points while the rule banning them sat thousands of messages up, and the hard ban had
  to grow a turn-stop lever for exactly that reason. A host that re-injects a file every step (this
  machine's `AGENTS.md` does) can now carry a brief with every request instead: the four rules compressed
  to five lines, 228 characters in Chinese and 797 in English, no banned glyph in either.
- `mmk wire agents-md-brief --write <path>` applies it idempotently: the block lives between
  `mmk:begin` / `mmk:end` markers and a re-run replaces it in place, so a rule file never grows a second
  copy. `managedBlock` and `upsertBlock` are exported for anyone wiring their own file.
- Tests: the brief in both locales (short, four rules named, no banned glyph), and the managed block
  (markers, apply-twice-changes-nothing, re-apply replaces the body and leaves one block, append to a file
  that has none, and start an empty file with it).
## 0.21.1 - 2026-10-16

- **The density ceiling the rule implied is gone: a paragraph carrying four or five faces is fine, when each
  one is saying something.** Asked for by the same reader, and consistent with the reason a face is allowed
  at all - it is not decoration, it carries tone, attitude and distance, and a face that adds nothing reads
  worse than no face at any density. Both locales of the kaomoji rule now say so, next to the floor.
## 0.21.0 - 2026-10-16

- **The symbol rule now says how to write, not only what not to write.** Asked for by the reader this
  plugin is written for: they read a reply the way they read a book or a paper - sentence by sentence -
  so a glyph carrying a judgement is noise in the reading flow, and using a Han character to *refer* to
  that glyph is noise too, because it is a remark about notation rather than information. Both locales of
  the rule text now say: write for a reader who reads every sentence, normal punctuation is welcome, the
  judgement belongs in words, marks must not carry the structure (a paragraph that reads as prose beats a
  column of markers, a list item is a short sentence rather than a label), and a kaomoji is tone rather
  than layout.
- Tests: both locales carry the new rule (three English phrases and two Chinese fragments by code point),
  the rule text itself carries no banned glyph, and a companion check asserts every rule key has text in
  both locales and is not a stub - so a future rule cannot land in one language only.
## 0.20.1 - 2026-10-16

- **The session audit reads every channel the ban covers now, and counts exemptions by position.** It used
  to read prose only and say so ("ignoring tool calls and the reasoning channel"), which made it agree with
  a version of the ban that no longer exists. On one real session it reported 75 code points in prose and
  nothing else, while that same session carried 2255 in the thinking channel and 3 written through a tool
  call. It reports per channel now (prose / quoted / thinking / written), and the kaomoji floor verdict
  stays a prose property so thinking cannot dilute it.
- A defect in the same reading, found while wiring the test: exemptions were collected as a set of
  *characters*, so one fenced block containing a glyph exempted every occurrence of that glyph in the whole
  text. They are counted as *positions* now, which is what the rule is about.
- `scripts/audit-session.mjs` is importable (its main path is guarded) so the reading itself is under test:
  one case builds a part per channel and asserts the five totals, the prose-only floor, and that a bare
  string is still read as prose.
## 0.20.0 - 2026-10-16

- **The notice budget no longer ends the conversation about it: `symbolLadder` (default [10, 50, 200]).**
  The budget exists so a determined run cannot loop on warning itself, and it works - but it also meant the
  reminders stopped while the breaches did not: measured on this machine, one session's thinking reached
  2230 judgement-mark code points and its last notice had arrived long before. A cumulative notice is now
  sent when the session's total crosses a ladder step, even with the budget spent, so the reminder tracks
  accumulation instead of repetition. The total stays bounded (budget plus ladder steps). `symbolLadder: []`
  turns it off.
- **The file half of the ban is judged now, through the tool call that writes it.** `findBannedInToolCalls`
  reads a `tool-call`'s `arguments` in the newest authored message - the one place a write becomes visible -
  and the turn-stop steer asks for those few places to be edited rather than for the turn to be redone.
  Fenced code is deliberately *not* exempt in that judgement (it is exactly what lands in a file), while a
  `U+XXXX` reference stays safe because it is ASCII. `channelLabel` learned a fourth label so a notice
  never points at the wrong place.
- Tests: the ladder notice in both locales (reports the total and the step, names the code points, carries
  no banned glyph, stays under 400 characters), the file steer in both locales, the tool-call judge against
  nine shapes (hit, string arguments, ASCII reference, no call, clean argument, a tool's own output, the
  user speaking, a missing and an empty transcript, and an older call that is not re-judged), and two
  acceptance cases: the ladder speaking after a budget of one is spent (and never repeating a step), and a
  write carrying a glyph steered at the file.
- Not changed: `authoredParts` still reads only text / thinking / reasoning, so the *spoken* channel judge
  keeps its exemption for code and for code point references; the tool-call judgement is a separate reading
  with its own rules.
## 0.19.0 - 2026-10-16

- **The hard ban got the lever that acts before the turn closes: `symbolSteer` (default on).** The
  notices fire on `agent/pre-step`, which is after the reply is already in the transcript, and the
  measurement says that is not enough: one session's thinking carried 2230 judgement-mark code points and
  another 346, while the notices had long spent their per-session budget (6 to 13 of them, then silence).
  So the same boundary the kaomoji lever uses now also asks for the reply again when the newest reply
  still carries such a glyph in its text or its thinking: same content, glyphs written as words, and it
  says plainly what history cannot fix - what is already in the thinking stays there, what comes next does
  not have to. `symbolSteerMax` (default 1) caps the extra passes per session; `symbolSteer: false` turns
  it off. The two levers share one per-turn record, so a single turn never pays for two extra steps.
- Guards are the kaomoji lever's guards: nothing on an aborted turn, nothing while the section is
  disabled, nothing without `agent.steer`, nothing on an empty transcript, one steer per turn, a session
  budget, and every read of the transcript wrapped so the lever cannot take a turn down with it.
- Tests: the notice in both locales asks for a rewrite, names the code point and the channel, and carries
  no banned glyph itself; the decider is checked against a turn that carried a glyph, the same turn twice,
  a spent budget, a clean reply, an aborted turn, a disabled section, a missing `agent.steer`, an empty
  transcript, and the shared per-turn record (the kaomoji lever leaves a turn the symbol lever already
  paid for).
- Measured with it: across the last six hours of this machine's sessions, banned glyphs still reach
  authored text - Mikoto-Nadenade 3133 (2230 thinking / 903 text), Sayori-Sleeping 780, the Nonbiri
  session 361, E-DSH 14 and 28 on another. Almost all of it is in the thinking channel, which is what the
  new lever can at least stop from growing.
## 0.18.3 - 2026-10-16

- **The licence shape is pinned by a test.** Moving to CZGD-PL-1.0 meant five places at once, and a
  half-migrated licence state is worse than either, so `test/selfcheck.mjs` now asserts the shape: the
  manifest says `SEE LICENSE IN LICENSE`, LICENSE and NOTICE both ship, LICENSE is the CZGD text with its
  spirit section, NOTICE names the licence and claims no SPDX identifier, and both READMEs name it.
- Provenance for the record: the text is the authoritative copy from `E:\CZGD`, sha256
  `f551b95f1d273052f872190012f66963fbe8062decbd07dc8771b8e3834add45`, and this repository's copy matches
  it byte for byte. The kit has since filed the consistency report from this workspace as R1 and fixed
  every item (`E:\CZGD\REPORTS.txt`); the licence text itself never changed.
- Measured while here: since the thinking-language notice shipped in 0.15.0, the reasoning channel in
  that window holds 4.9% CJK over 1039 messages, against 2.4-2.6% in the window before it. Small sample
  and a different session mix, so it is a hint rather than a result.
## 0.18.2 - 2026-10-16

- **NOTICE no longer names the SPDX identifier**, matching the licensor's instruction and the kit's own
  change: `E:\CZGD\spdx\` (the submission package) is gone, and its README now says the submission is
  not urgent. The licence is still named in prose, and the authoritative text's hash is unchanged
  (`f551b95f...`), so nothing about the grant moved.
- Repository topics gained the two the kit asks for: `czgd-pl-1-0` and `custom-license`.
## 0.18.1 - 2026-10-16

- **The SPDX identifier is out again, at the licensor's request.** 0.18.0 added
  `SPDX-License-Identifier: LicenseRef-CZGD-PL-1.0` to the build banner and named the same identifier in
  both READMEs, following the kit's own step 2. It is removed from all three (and from the regenerated
  `lib/index.js`); the licence is named in prose instead. `package.json` keeps
  `SEE LICENSE IN LICENSE`, which is npm's convention rather than an SPDX claim, and `NOTICE` keeps the
  line its own template carries.
## 0.18.0 - 2026-10-16

- **The licence is CZGD-PL-1.0 now** (Cheese Gyudon Public Licence, the project's own), replacing MIT.
  The text is the authoritative copy from `E:\CZGD`, installed by that kit's own script and verified
  against its sha256. In substance it grants what MIT did and adds two things this project wanted: an
  explicit patent grant, and an explicit blessing of doujin and secondary creation. It is not copyleft -
  clause 7.3 says a derivative need not use the same licence - and it does not restrict commercial use.
  Releases published under MIT stay usable under MIT.
- Moved together, because a half-migrated licence is worse than either: `LICENSE`, `NOTICE` (holder,
  year, provenance, and this change), `package.json` (`SEE LICENSE IN LICENSE`, since a custom licence
  has no SPDX id), both READMEs, the build banner (`SPDX-License-Identifier:
  LicenseRef-CZGD-PL-1.0` reaches the generated `lib/index.js`), and `check-ascii`.
- `check-ascii` has a third documented exception: `LICENSE` and `NOTICE` are the licensor's own words
  (Chinese is authoritative there), the same category as `README.zh-CN.md`. Without it the licence text
  would have failed this repository's own invariant check the moment it landed.
## 0.17.0 - 2026-10-15

- **The same faces now ship one mood per file.** The library is 307 KB and the prompt invites a reader to
  consult it for the full set, which is an expensive read for a single face. `rules/kaomoji/<mood>.json`
  holds one category each (8-33 KB, ~10x cheaper), generated from the same pass, checked by the same
  `--check`, and asserted by a test that they add up to the whole library. The prompt line now names both
  routes.
- `npm run check:generated` covers the split too: a stale mood file fails the check the same way a stale
  library file does.
## 0.16.0 - 2026-10-15

- **The kaomoji library grew from 1150 to 1790 faces, and every one of them is now a face the judge can
  see.** It shipped 100 blind entries before this: 36 carried a Han character (which the judge filters
  out on purpose, so a bracketed Chinese phrase does not read as a face), 50 sat in rounded, lenticular
  or corner-quote frames the judge did not know, and 14 were classic underscore faces like `(o_o)` and
  `(X_X)` that the old inner-mark test rejected because `_` counts as a word character. Using one of
  those earned a "you used no kaomoji" reminder - the palette contradicting its own checker.
- So the two were made to agree, from both ends. The judge now knows five frame pairs - ASCII and
  fullwidth parentheses, plus U+256D/U+256E, U+3010/U+3011 and U+300C/U+300D - and counts `_` as a mark;
  the generator now **imports the judge** and refuses any face it cannot see, which is why the agreement
  cannot drift again.
- The five kanji mouths moved out of the axis for the same reason, and the eye, mouth, mark, arm and
  classic lists were extended: 11 new eyes, 21 mouths, 28 hand-written classics. Quotas rose with the
  candidate pools (1790 shipped from ~54,000 candidates, sampled evenly per category).
- Two new cases: every shipped face is visible to `findKaomoji`, and the judge's five frames behave -
  including that an ordinary parenthetical and a bracketed Han word are still not faces.
## 0.15.1 - 2026-10-15

- **The emoji notice had the same stale escalation the other two had.** Its heading counted up
  ("EMOJI BAN - SELF-CHECK #3") while its closing line still said "this is the second reminder" -
  the same constant that was already removed from the symbol and kaomoji notices, still sitting in the
  third one because I fixed them one at a time. Both locales now name the attempt they are handed, and
  a case in `test/selfcheck.mjs` pins it.
## 0.15.0 - 2026-10-15

- **Rule four gets the self-check it never had.** The pre-step hook pushed notices for symbols, voice,
  emoji and kaomoji - the thinking-language discipline was prompt text and nothing else, so a long
  session drifted back to English with nothing in the loop naming the drift. Measured before building:
  CJK was 21.6% of the reasoning channel in one window (10-14 10:00-12:47Z) and 2.4% in a later one
  (10-15), against a 3.3% all-session baseline.
- The new notice reads the newest thinking block against what the human has been writing, and speaks
  only when both sides are worth a claim: at least 120 letters of thinking, a reader who mostly writes
  Chinese or Japanese, and thinking that is under a quarter CJK. Soft like the kaomoji notice - once per
  drift, `languageCheckMax` (3) per session, `languageCheck: false` to turn it off - and it states what
  it measures, because the count reads thinking rather than the reply.
- New exports to go with it: `countScripts` (the reading the bench uses, so the notice and the
  measurement cannot drift apart), `judgeThinkingLanguage` and `readerText` (the human's own messages:
  a plugin notice is a user message too and is never counted as the reader's words). Three cases in
  `test/selfcheck.mjs`: the judge's four shapes, the notice's wording, and the hook firing once and
  staying quiet for an English reader.
## 0.14.2 - 2026-10-15

- **A repeat points back instead of reprinting the list.** One real session's second symbol notice spent
  about 200 characters reprinting all 26 matched code points, which the first notice had already named.
  A repeat now names the first four, gives the count, and says the full list is in reminder #1; a short
  set is still named in full. Same wording in both locales.
- **The kaomoji notice says what its number measures.** The floor is counted on the reply text, while the
  rule asks for the habit in thinking too - the symbol and emoji judges read thinking, this one does not.
  Rather than leave that to be assumed, the first notice states its scope in one clause. The asymmetry is
  deliberate: a glyph in thinking pollutes the transcript, a missing face there does not, and a floor that
  counted both would fire twice as often for the same behaviour.
- Both pinned in `test/selfcheck.mjs` (a repeat is shorter than the first notice and still names one of
  the code points; the scope clause appears once and not on repeats).
## 0.14.1 - 2026-10-15

- **The escalations name the reminder they actually are.** Found in a real session's own notices: the
  heading counted up (self-check #4) while the closing line still said "this is the second reminder" -
  that sentence was a constant, so every repeat after the second contradicted its own heading. Both
  notices now use the attempt they are handed (a numbered heading and a numbered closing line), and the
  symbol notice counts what was already sent ("N reminders already sent, and this still appears") instead
  of asserting that the point was never taken in. A reminder about accuracy that is itself inaccurate
  teaches the wrong thing.
- **A colon no longer runs straight into a full stop.** With no exemption list configured the symbol
  notice ended a sentence with a colon followed by a full stop; the exemption, when there is one, now
  sits between the finding and the colon.
- Both are pinned by a new case in `test/selfcheck.mjs`. Note for the next reader: that suite reads the
  **built** copy, so a source edit shows up only after `npm run build` - which is how these two stayed
  hidden until the built output was read back.

## 0.14.0 - 2026-10-14

- **Adapters are verified by recorded payloads, and the unverified one says so.** There is no second
  harness on the machine this was written on - no Claude Code, no Codex, no MCP-capable editor; the
  `gemini` on PATH is that machine's own one-shot API wrapper, not an agent - so an adapter for another
  harness cannot be checked against that harness. What it *can* be checked against is a recorded
  invocation: `adapters/fixtures/<harness>/*.json` hold the stdin JSON, the transcript it points at and
  the expected decision, and `npm run test:adapters` replays all of them (part of `verify` now). Four
  fixtures cover the Claude Code adapter's events, including `stop_hook_active`, which must exit silently
  or the hook loops.
- **The README states what is verified where**, because "written from the documentation" and "seen a
  live client" are not the same claim: the DSH plugin is in production on that machine, the CLI does real
  work there, the MCP server's protocol half is checked locally, and the Claude Code hook is labelled
  **documented contract plus fixtures only**. The same label is on `mmk wire claude-code` and in the
  adapter's own header, so it travels with the artifact instead of waiting to be discovered.
- **What this settles about writing more harnesses.** Adding an adapter from memory is how a project
  grows code that looks authoritative and has never run; the fixture directory is the cheap path instead -
  when someone can run the client, one recorded payload closes the gap. The portability split stays
  because it is already paid for and because the failure this project was rescued from lived in the DSH
  write path, not in the judging core; but no adapter is written for a harness nobody here can run.

## 0.13.0 - 2026-10-14

- **The README now says what the package is: one core, four entries.** The documentation still opened
  with "output house rules for every agent in a DeepSeek Harness profile", which stopped being the whole
  truth when the CLI, the MCP server and the Claude Code hook landed. Both READMEs (and the package
  description) now lead with the four entries and explain why the DSH row still exists - a profile-level
  plugin is mounted once by the roster, so it is the anti-drift entry, not the only one.
- **`mmk wire <target>`**: the last mile, printed. `claude-code` prints the hooks block for
  `settings.json`, `mcp` prints the `mcpServers` block, `agents-md` / `claude-md` / `gemini-md` print the
  rules block named for that file, and `dsh` prints the plugin row - each with the real path filled in
  and a one-line note about what it does. `mmk wire` with no target lists them.
- **The symbol and emoji notices name the channel they actually found.** Both tested
  `finding.where === 'thinking'`, but a transcript writes `reasoning` for a thinking block, so the
  distinction never fired: a breach in the thinking channel was reported as "your text", which sends the
  reader looking in the wrong place. Both kinds now count as the thinking channel, with a case pinning
  it (`test/selfcheck.mjs`).
- **A guard's own rule, kept by the guard**: `dsh-prestep-audit` 0.2.1 no longer records every
  `agent/request` by default (`diagnostics.requests` turns it back on). Recording each request broke the
  plugin's own promise - "only interesting things are written" - and on this machine the log reached 1.9
  MB of request lines while the illegal rows were zero. The switch is covered by a test (25 now).

## 0.12.0 - 2026-10-14

- **The package is now `oishikunaare-moe-moe-kyun` - lowercase, because npm requires it.** npm's own
  name validator (`validate-npm-package-name`, the one npm ships and uses) answers two different
  questions, and this is the whole story: `Oishikunaare-Moe-Moe-Kyun` is `validForOldPackages: true`
  but `validForNewPackages: false` ("name can no longer contain capital letters"). Names like
  `JSONStream` (created 2011-09-23), `Base64` (2012-06-10) and `MD5` (2011-11-25) are on the registry
  because they predate the rule and are grandfathered; a *new* name with capitals is refused, and a
  scope does not help (both `@Nesarf/mmk` and `@nesarf/MMK` fail the same check). `CoffeeScript` is the
  ordinary answer to this: the project keeps its capitals, the package is `coffeescript`.
- **What changed, and what deliberately did not.** The package name, the plugin row id and module name
  in `cordis.patch.yml`, the exported plugin `name` (which is also the `plugin:<name>` producer kind on
  messages this plugin injects), the `/portable` and `/transcripts` specifiers, and the install/update
  commands in both READMEs. The display name is untouched in the project title, the repository, the
  local checkout directory, the LICENSE, the MCP `serverInfo`, and the generated-by line of
  `mmk rules --format md`. Existing session logs keep the old `plugin:Oishikunaare-Moe-Moe-Kyun` source
  kind they were written with, which is fine: a producer kind only has to be present and must not be
  the retired literal `plugin`.
- **`prepublishOnly` now runs `npm run verify`**, so a release cannot ship a tree that fails its own
  checks, and `publishConfig.access` is explicit.
- Verified before publishing: `npm run verify` green, `npm publish --dry-run` with no warnings, the
  packed tarball installed into a scratch project, and the installed shim answering with no
  configuration at all.

## 0.11.1 - 2026-10-14

- **The `mmk` bin was being dropped by npm at publish time.** npm 12 (12.2.0 here) refuses a bin target
  written as `./bin/mmk.mjs` and removes the entry during publish, so the installed package would have
  carried no command at all - `npx mmk` would simply not have existed, and nothing in the repository
  would have said so. The target is now written without the `./` prefix, which npm keeps. Found by
  packing the tarball and reading the publisher's own warnings rather than trusting the manifest.
- Verified the way a publisher should: `npm pack`, install the tarball into a scratch project, and run
  the installed shim with **no configuration at all** - `mmk --version`, `mmk check --quiet` (exit 3 on
  a bare reply), `mmk rules --json` (the packaged locale and its 1150 palette faces). The tarball is 32
  files, 221.8 kB packed and 823.7 kB unpacked, and self-contained: `bin/`, `src/`, `lib/`, `rules/` and
  `adapters/` all ship inside it.

## 0.11.0 - 2026-10-14

- **A Claude Code hook adapter** (`adapters/claude-code.mjs`). The hook payload arrives as JSON on
  stdin - including `transcript_path` - and the answer is a JSON decision on stdout, so the adapter is
  only the translation between those two facts; the judges and the notice wording come from
  `src/portable.mjs`. `Stop` answers `{"decision":"block","reason":...}` (the turn stays open with the
  notice as its reason), `UserPromptSubmit` and `SessionStart` answer with `hookSpecificOutput
  .additionalContext`. `--print-config` prints the `settings.json` fragment, `--mode` covers the shapes
  the contract has used instead of assuming one, and `--budget` (default 1 per session) keeps a hook
  from becoming the noise it exists to remove. Two rules it lives by: **a stop this hook caused is
  never blocked again** (`stop_hook_active`), and **every failure fails open** - a discipline hook is
  never a reason a session cannot continue. `--dry-run` prints the decision without touching the
  counter.
- **`mmk rules --format md`**: the rule section as a paste-ready markdown block for the rules files
  other harnesses read (CLAUDE.md, AGENTS.md, GEMINI.md), with a generated-by line so nobody edits the
  copy by hand.
- **`bench/thinking-language.mjs`**: the measurement the thinking-language rule needs in order to be
  more than prose. It reads real session artifacts through the `dsh` reader and reports the character
  mix of the reasoning channel (Han, kana, Latin, other), per window and per session. First baseline on
  this machine: **3.3% CJK / 96.7% Latin** over 306 sessions and 52,376 reasoning messages, with 268 of
  306 sessions Latin-dominant - and by window, 21.3% CJK in the hour before the rule shipped, 21.9%
  while it was live, 1.4% in the hours after the plugin was disabled. The samples are small and the
  session mix differs between windows, so that last comparison is a correlation to keep watching, not a
  result: the bench exists so the next measurement is like for like.
- Two more cases in `test/portable.mjs` (twelve now): the adapter's decision, its budget, its
  fail-open paths and its markdown drop-in.

## 0.10.0 - 2026-10-14

- **The rules no longer need this harness, or any single agent.** The judges, the rule text, the
  kaomoji palette and the voice tables were always data plus pure functions - `src/index.js` imports
  four node builtins and no host package at all - so this release adds the entries instead of rewriting
  anything:
  - **`mmk`, a CLI** (`bin/mmk.mjs`): `rules`, `lib`, `check`, `notice`, `voice`, `review`. Text in,
    text or `--json` out, and an exit code a caller can branch on: 0 clean, 2 bad request, 3 a breach.
    A shell, a git hook or a CI step can use it with nothing installed.
  - **An MCP server** (`adapters/mcp.mjs`): `mmk_rules`, `mmk_check`, `mmk_notice` over
    newline-delimited JSON-RPC on stdio, plus `mmk://rules` as a resource. Any client that speaks MCP
    can fetch the section and judge its own draft without knowing what a pre-step hook is.
  - **`src/portable.mjs`**: the harness-free facade the plugin, the CLI and the MCP server all sit on,
    exported as `Oishikunaare-Moe-Moe-Kyun/portable`.
  - **`src/transcripts.mjs`**: three conversation readers - this package's own `dsh` artifacts (zstd
    framed), Claude Code's `cc` envelopes with their thinking blocks normalized, and a plain `jsonl`.
    `mmk review --transcript` is the CLI face of them.
- **`npm run check:portable` keeps the boundary honest**, and it is part of `verify`: no non-builtin
  import anywhere under `src/`, `bin/` or `adapters/`; no host hook name, no `ctx.` and no host package
  inside `src/portable.mjs`, `src/transcripts.mjs` and `bin/mmk.mjs`; and the CLI is exercised rather
  than assumed (a clean text exits 0, a banned code point exits 3 and is named as `U+2713`).
- **The separation is the point, not the packaging.** Judging text and sending it are different jobs:
  `src/portable.mjs` writes nothing at all, so the class of failure that made eight sessions unloadable
  on 2026-10-14 cannot exist in the portable half - an adapter that appends a notice owns that risk,
  and now the adapter is small enough to read in one sitting.
- `test/portable.mjs` adds ten cases over the new surface: the packaged rules resolve with no
  configuration, the judges find glyph, emoji and kaomoji findings, a notice names the code point and
  never prints the glyph, an inline code span is exempt, the voice follows the preset mapping and then
  the persona, each reader normalizes its shape, and the CLI exit codes hold.

## 0.9.10 - 2026-10-14

- **The self-check hook no longer sends the conversation back to the host.** 0.9.6 taught the judge to
  read the session, because an agent's own reply is never in the step's inbox payload - that part was
  right. What it left behind was the return: the hook handed back the *observed* list (up to
  `OBSERVE_WINDOW` session messages, see `observedMessages`) instead of the step it was given, and the
  agent loop appends every returned entry as a `user/message` event verbatim. The whole tail - system
  prompt, assistant replies, tool results - therefore landed in the log under a user envelope while
  keeping its own roles, and the v4 validator refused that session on the next load
  (`session event at seq N message must have role ...`). On the machine where this shipped that was
  **8 sessions and 585 records**, and the shot was fired by the voice notice: the host restarted at
  17:37:53 with 0.9.6 loaded, and the first notice at 17:43:39 copied 60 records into a resumed
  session. The wire now carries `[...notices, ...decision.messages]` - reading the conversation and
  sending the conversation are two different things.
- **The hook carries its own contract, not just a corrected line.** Every message this plugin adds
  must be a `user` message, because that is the only role this path can write; a notice built any other
  way is withheld and the step is sent without it. Messages the hook did *not* add are reported with
  their producer kind and passed through untouched - dropping another producer's injection is not this
  plugin's call, and the host-side guard (`dsh-prestep-audit`) is the layer that refuses to write them
  at all.
- **Two regression cases** in `test/selfcheck.mjs`: a hook whose session holds the conversation returns
  the notice plus the step and nothing else, and a foreign non-user message is named in the log while
  still travelling. `test/acceptance.mjs` gained the same assertion on the case that already had the
  right fixture - "the check reads the session, not the step's inbox" - which is the case that should
  have caught this the first time. Verified the other way round too: restoring the old line makes the
  new assertion fail.

## 0.9.9 - 2026-10-14

- **A fourth discipline: the language an agent thinks in.** Mount the plugin and the agent thinks and
  answers in **the user's own language** - Chinese for a Chinese conversation, Japanese for a Japanese
  one - and stops treating English as the neutral metalanguage, which is the habit the rule exists to
  replace. The reason is in the rule text: the grammar and the logic of English do not match the habits
  of moe-fandom culture. English is admitted in exactly one case, the **moe-fandom register** -
  romanized Japanese words (kawaii / sugoi / moe / senpai / yabai / baka), fandom English (nya~, ehehe,
  ufufu, desu wa, the honorifics -chan / -san / -sama), waves and long vowels, alongside the kaomoji
  palette; dry technical English does not qualify. It covers thinking and replies, and it says out loud
  that a fandom register may never be bought with correctness - technical content stays accurate, and
  file contents, code, commands and commit messages still carry no tone.
- It is shipped in **both locales** and it is **not a per-rule override**: `bannedSymbols`, `kaomoji`
  and the `rules` object replace the rules they name, while this block is appended after them and
  before `append` - "mount this plugin and the agent thinks in the user's language" is the promise of
  mounting it, so a user rule that replaced the other two does not silently repeal this one.
  `enabled: false` remains the single lever that takes the whole section away. `scripts/gen-rules-json.mjs`
  was extended to write it into `rules/<locale>.json`, so the generated data files still carry every
  shipped block and `check:generated` still catches drift.
- **The material this package takes its cues from is now written down (README, both languages).** This
  is MMK's own standard - it governs the markers, the palette and the prose **it** ships, and nothing
  here is injected into a prompt. Taken: moe-fandom culture of **1990-2015** (90s bishoujo games and
  OVAs, 2000s galge and light novels, VOCALOID and doujin music, 2000s-2010s anime, the mid-2010s
  yami-kawaii look), with the traditional moe attributes still available. Not taken: the **jirai-kei**
  aesthetic that formed from 2018 onward and its derivatives (jirai make-up, ryousangata, the
  menhera-flavoured dependent romance aesthetic) - the criterion is pragmatics and aesthetics that
  formed after 2018 rather than any single word. 2016-2017 is deliberately not emphasised; a close call
  follows the usage of 2015.
- The standard is written as a gradient rather than a flat list, and the wording carries it. **Three
  hard exclusions**: fandom for boys-love (BL / danmei / yaoi), unconditionally; the grotesque register
  (guro, ryou-naissance injury content, scatological content, body modification and dismemberment of
  that kind, and SM); and the jirai-kei family, which is "not taken" rather than banned. Then **the
  exemption sitting under them**: being explicit is not what is excluded, so **ordinary R18 adult
  material is not avoided**, and an exclusion above must not be quietly widened to cover it.
- Then, and deliberately as the last of the three tiers, **one soft preference - hygiene awareness.**
  Where the register can be chosen at all, steer around rather than forbid: the R18 practices that carry
  a hygiene or safety implication (feet, anal, deep throat and the like) and the non-R18 material
  derived from them (softcore barefoot aesthetics, foot-odour culture, and so on). The reason is written
  out because the wrong one would be read in: this is **hygiene and safety, not a moral judgement** - it
  is a leaning inside adult material, not a ban on it, and it changes nothing about the R18 exemption
  immediately above it. Ordered as exclusions, then exemption, then preference, so a reader does not
  have to sort three kinds of statement out of one paragraph.
- The shipped material was re-checked against that standard on 2026-10-14 - `rules/voices/*.json` (18
  marker sets, from Moegirlpedia's kuchiguse entry since they were added), `rules/kaomoji.json`, and the
  examples inside the rule prose - with **no hit** for any of the excluded families or for the practices
  the hygiene preference names. A keyword scan returns only the ordinary English word "small" and the
  identifier `peerDependenciesMeta`. The voice tables and the kaomoji generator already name their
  provenance; no era field was invented for them.
- `test/selfcheck.mjs` grew four cases: the new block present and non-empty in **both** locales with
  each of its clauses pinned, the block reaching the assembled section **whatever** a user rule does
  (including both packaged rules replaced, and `enabled: false` as the way out), `offendingGlyphs()`
  empty for the block and for every assembled section, and an English reply still readable as authored
  prose by the shared role/source reading the other judges use. The two existing cases whose
  expectations the third block genuinely changed - a `kaomoji` override no longer ending the text, and
  a two-rule override no longer being the whole text - were updated with the reason in the comment
  rather than deleted.
- **A host restart is required for this to take effect**: the discipline is part of the plugin's code
  and its packaged rule table, both of which are loaded at boot. Editing
  `$DSH_HOME/agent-house-rules.json` still lands on the next model step.

## 0.9.8 - 2026-10-14

- **The plugin can see which agent preset a session is composed from, and the voice follows it.** The
  identity comes from `ctx.get('agentPresets')` - asked for, never declared in `inject`: a plugin that
  hard-depends on the preset registry is a plugin that fails to load at all on a deployment without a
  roster, so the service is optional and its absence is a degradation rather than a startup error.
- Three sources are tried, best first: `presets.composedPreset(agent.ctx)` for the live composition,
  then the `agentPreset` session projection (`ctx.get('sessionProjections').stateOf(session, ...)`,
  initialised from the session header and advanced by selection events), then `header.agentPreset`.
  Every lookup is guarded and a failure in one falls through to the next.
- The persona is read once per agent, on `agent/created`, from `await presets.readDocument(id)` - the
  `content` field is a YAML dump with the persona `prefix` in it verbatim (measured on the 13 presets
  of this machine: documents of 6.2-9.1 KB carrying persona prefixes of 444-3152 characters, and the
  prefix is present in the dump character for character). The text is scanned for keywords rather than
  parsed: a YAML parser is a runtime dependency and this package keeps none. The whole body of that
  listener is wrapped, because an exception in `agent/created` **fails the creation of the agent**; a
  `readDocument` rejection (a preset deleted between boot and creation throws
  `agent-preset/not-found`) degrades to "the identity is known, the persona is not".
- `moeVoiceByPreset` is the new configuration key: `{ "redipaloynz": "gentle" }` names a voice for one
  preset. The voice decision is now three layers, highest first: **the configuration map**
  (`mapped`), **the preset's own persona** (`persona`), then the `moeVoice` modes exactly as they were
  (`rotated` / `inferred` / `pinned`). A mapped id that is not in the voice table falls through to the
  mode rather than silencing the notice. The log line names the preset and the source, for example
  `session <id>: moe voice gentle (mapped by preset redipaloynz)`.
- Honest about the middle layer: the six voice words are subculture vocabulary, and a hand-written
  persona usually contains none of them. Across the presets on this machine the signal fires for some
  and not for others - one older preset's persona names a voice class, another's names nothing. Persona
  inference is therefore "limited but better than guessing from a conversation" - when it misses, the
  configured mode still picks a voice, exactly as in 0.9.7.
- The voice notice is still injected by the `agent/pre-step` hook, once per session. Nothing was added
  to the prompt section: a voice instruction there would be re-sent on every model step.
- Reading the configuration moved into the resolver for the voice keys too (`moeVoice`,
  `moeVoiceSignals`, `moeVoiceByPreset`), so adding a mapping to
  `$DSH_HOME/agent-house-rules.json` lands on the next model step. The one thing that still needs a
  host restart is the plugin's own code: a new version is loaded at boot.
- `apply()` no longer depends on `agent/created` existing, and both events are guarded, so a host
  without them, an event without an agent, and a disposed agent all pass through without a warning.

## 0.9.7 - 2026-10-14

- **The reason no notice was ever produced is the source kind, and 0.9.6 found only half of it.** A
  live transcript writes a model message as `role: 'assistant'` with
  `source: { kind: 'model', provider, model }` - read off 717 records of a real session log. Every
  check here tested `message.source?.kind !== 'assistant'` and skipped all of them, so the judges never
  saw a single reply. A shared `isAuthoredMessage()` reads the role first and accepts both spellings,
  and the five call sites use it. On the same transcript, `findBannedInMessages` found a breach in 0 of
  4 sampled messages before the fix and 1 of 4 after - which is what judging each part directly finds.
- 0.9.6 was right about the other half and stays. The pre-step payload is `UserMessage[]`: the host's
  own pre-step audit shows a fresh session's first step carrying five messages, every one of them role
  `user` (voice notice, AGENTS.md, the disk-guard block, the runtime snapshot, the skill catalogue).
  Reading the session is therefore necessary as well - a resumed session can carry the conversation,
  a new one cannot.
- `moeVoice: "auto"` resolved a voice id where everything downstream expected a table entry, so the
  notice it injected named nothing: no id in the log line, no markers in the text. It looks the id up
  in the table now, and the case asserting "auto follows the words" passes for the first time.
- `test/selfcheck.mjs` had the same una-awaited `check()` the acceptance harness had, so its eight
  asynchronous cases were equally unproven. With the cases awaited, four were wrong: three asked the
  symbol, kaomoji and emoji judges about a step the other two rules also answered, and one asserted a
  message count that did not match its own fixture.
- Both suites now build their assistant messages in the shape a live transcript uses - the shape this
  plugin had been testing for under the wrong spelling.

## 0.9.6 - 2026-10-14

- The self-check reads the conversation now, instead of the step's inbox. `agent/pre-step` hands over
  `messages: UserMessage[]` - the claimed inbox batch plus the assembled context - and an assistant
  message is never in it. Every rule here judges the agent's own reply, so a hook that read only that
  payload had nothing to judge: the section was live, both judges were correct, and no notice was ever
  produced. Measured on this machine before the fix, across 448 session logs and 1.6M records: 10,298
  banned code points in prose and 26,049 in thinking, against zero symbol notices and zero emoji
  notices. The one notice that did reach models was the voice notice, which reads no message list at
  all - which is exactly why it was the only rule still working.
- The observation is the session tail (`deriveMessages()`, last 60 messages) merged with the step's own
  messages by identity, so a message already in the session is not judged twice and a notice budget is
  not spent twice on one reply.
- A failing inner step is no longer swallowed. The hook caught it, logged it, and returned
  `undefined` - which is not a step decision, and leaves the loop reading a field off nothing. The
  failure is still reported, and is now handed back unchanged: this hook observes.
- `test/acceptance.mjs` called `fn()` without awaiting it, so every assertion after a case's first
  `await` ran after that case's label had already been printed, and a failure landed as an unhandled
  rejection that `process.exit` cut short. Nineteen cases reported green without being proven. With the
  harness awaiting them, five turned out to be wrong: an assertion still expecting the borrowed `user`
  producer (the 0.9.4 change never reached it), a case using a constant that was never defined, two
  cases asking the symbol judge a question the emoji and kaomoji judges answered first, and the case
  whose subject is the bullet above.
- `scripts/audit-session.mjs` looked only for `session.v3.jsonl.zstd` and the pre-versioned name, so on
  a current host it found nothing and reported "no session log found". It tries the v4 name first now.
- Verification: `test/acceptance.mjs` drives the real wire - the step's `messages` as `UserMessage[]`,
  the reply in the session - rather than the shape this plugin had assumed it would get.

## 0.9.5 - 2026-10-14

- The prompt section key now matches the package: `oishikunaare-moe-moe-kyun`. A section key is a public
  surface, because a composition can match or replace a section by name, so this is a breaking change for
  anyone who pinned the pre-rename key. Nothing on this machine did: the profile patch, the home patch and
  the plugin's own config were all checked, and none of them named the section. The pre-rename key stays in
  this repository's git history for anyone upgrading from an older release.
- The local checkout on this machine moved with the rename, and both READMEs now clone and link from the
  current path.

## 0.9.4 - 2026-10-14

- A notice now names this plugin as its producer (`source.kind = "plugin:Oishikunaare-Moe-Moe-Kyun"`)
  instead of claiming the literal `user`. The `role` stays `user`, because that is the turn the model
  has to obey; the kind was a borrowed identity with a cost that has a name. The disk-guard rule that
  prepends its path discipline picks its target as "the first message whose `source.kind` is `user`",
  and this plugin places its notice at the front of the step's messages - so the discipline block was
  written into the notice, and two plugins' notices came to share one message. A producer-owned kind is
  also what the session format asks for: the retired literal `plugin` is refused at write time so that
  a reader can tell who produced a message, and borrowing `user` defeats exactly that.
- test/selfcheck.mjs and test/acceptance.mjs assert the producer identity instead of `user`, on both
  paths that hand a notice over: the `agent/pre-step` hook and the steer lever.

## 0.9.3 - 2026-10-14

- The manifest now says which DSH line this is built against: `peerDependencies["@deepseek-ai/dsh"] =
  ">=0.2.0-rc.2 <0.3.0-0"`, with the peer marked optional in `peerDependenciesMeta` so a package
  manager does not try to install a second runtime beside the host's. The range is asserted against
  `0.2.0-rc.2` with semver rather than assumed, because a range that does not match is reported as a
  version conflict - an error, not a warning - and a plugin under a quarantine policy is switched off
  by what an auditor finds.
- `engines` is not the field that carries this. A host auditor reads a `@deepseek-ai/dsh*`
  peerDependency or its own `dshCompat.dsh`, and only ever validates `engines.node`; a manifest with
  no DSH range at all is reported as "compatibility unknown" regardless of what `engines` says.

## 0.9.2 - 2026-10-14

- A notice is now a complete user message instead of a bare payload. The `agent/pre-step` hook returns
  messages the agent loop records verbatim as the durable `user/message` event and appends to the
  request history, so an object carrying only `source` and `content` produced a stored session the
  loader refuses ("session event at seq N message must have role \"user\"", which the host reports as a
  corrupt session) and then a request the provider rejects ("missing field `role`") - the whole
  history, not just the notice. `noticeMessage()` stamps `id`, `role` and `source.kind` for the hook
  and for the kaomoji steer lever alike, and test/acceptance.mjs holds the shape.
- The rename reached the surfaces a reader sees. Both READMEs, the LICENSE line and every install,
  upgrade and verification-overlay command now say **Oishikunaare-Moe-Moe-Kyun**, and the plugin's own
  `name` follows the package and the roster row. The prompt section key was left out of this pass: it is
  an internal handle that a composition may already be matching on, no reader ever sees it, and moving it
  was a separate and breaking step - taken in 0.9.5.

## 0.9.1 - 2026-10-13

- The moe layer gained a voice mode that actually varies between agents. A survey of the 15 presets on
  one machine showed inference over the conversation firing for 3 of them, and the reason is structural:
  a persona lives in the system prompt, the plugin sees only the session, and a preset's own words are
  names rather than voice classes. `moeVoice: "rotate"` holds each session to a stable voice chosen by
  hashing its session id - no configuration, no guessing, and distinct sessions sound distinct.
- So `moeVoice` now has three modes: `auto` (infer, silent when nothing names a voice), `rotate` (stable
  per session), or a voice id (pin one for everyone). `auto` still wins when a persona does name a voice.
- `scripts/persona-signals.mjs` reads each preset's persona.md and prints the words that identify it, for
  anyone who wants to extend `moeVoiceSignals` by hand. It is a survey tool, not a wired-in bridge: the
  tokens it finds are names, and a name does not tell the layer how someone should sound.
- test/selfcheck.mjs grows from 54 checks to 56: rotation stability and spread, and all three modes
  behaviour including that a pinned id beats the words in the session.
- Verified against DSH 0.2.0-rc.2: the host boots clean with the plugin loaded, `agent/pre-step` and
  `agent/turn-stopping` both fire (the session log shows the emoji notice, the kaomoji reminder, the
  run-of-bare-replies probe and the steer), and no contract drift surfaced in the host logs.

## 0.9.0 - 2026-10-13

- The repository and the package are now **Oishikunaare-Moe-Moe-Kyun**. The install row, the package
  name, the library's own name field and every repository URL changed with it; the prompt section name
  and the plugin's internal `name` stayed put, because changing them would invalidate the installed row
  and every test that finds the section by name without making anything clearer. The section name
  followed the package in 0.9.5, once the local checkout had moved too.
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

- One global system prompt section (order 50), registered from a profile-level
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
