# Oishikunaare-Moe-Moe-Kyun

> Chinese documentation: [README.zh-CN.md](README.zh-CN.md)

## The mascot: Kirizawa Moeno

<img src="docs/moeno.png" alt="Kirizawa Moeno" width="360">

Kirizawa Moeno is what these rules look like when they are a person. The "moe" in her name is the one
from Moe Moe Kyun; the surname she picked herself.

Long pink twin tails, a frilled headband, a maid dress and an idol stage in one outfit, and a microphone she rarely
puts down. She treats register as a stage and discipline as a score: sweet when she smiles, not sweet at all while
editing. Her subject is one line - **what you send out should sound like you saying it.** Judgement glyphs go back
to being words, emoji give way to kaomoji, punctuation stays where the text needs it, and the thinking is written in
the language the reader is actually reading.

Output house rules for an AI agent: one core, and four ways to reach it. The rules are about how an
agent writes - judgement glyphs, emoji, the kaomoji habit, the language it thinks in - and none of that
is specific to one harness, so the package is not either.

| entry | what it is | how it is wired |
| --- | --- | --- |
| **CLI** `mmk` | `rules`, `lib`, `check`, `notice`, `voice`, `review`, `wire` | a shell, a git hook, CI, or a person asking whether a line would be refused. Exit 3 means a breach |
| **MCP server** | `mmk_rules`, `mmk_check`, `mmk_notice` and the `mmk://rules` resource | any MCP client, no assumption about which agent is on the other side |
| **Claude Code hook** | corrects a breach while the turn is still open | `Stop` answers `{"decision":"block","reason":<notice>}`, `UserPromptSubmit` and `SessionStart` attach context |
| **DSH plugin** | one global system prompt section for a whole profile | mounted once by the roster, so it reaches every preset, workspace, conversation and subagent |
| **modules** | `oishikunaare-moe-moe-kyun/portable`, `/transcripts` | writing another adapter: all of the above are thin layers over those two files |

`mmk wire <target>` prints the wiring for a specific place - the hook block, the MCP client block, the
`AGENTS.md` / `CLAUDE.md` / `GEMINI.md` rules block, the DSH plugin row - with real paths filled in.

### What is verified where

An entry that has never met the thing it is written for is not the same as one that has, and the
difference is worth stating instead of implying. This table is the honest version.

| entry | how it is verified |
| --- | --- |
| DSH plugin | In production on the machine this was written on: mounted in a live profile, and its rules and self-check are visible in real sessions |
| CLI `mmk` | Used on that machine for real work - auditing a session, answering whether a line would be refused - and exercised by `test/portable.mjs` |
| MCP server | The protocol is checked locally: a handshake, `tools/list`, every tool called, `resources/read`. The client half depends on the client |
| Claude Code hook | **Documented contract plus recorded fixtures only** (`npm run test:adapters`); never run against a live Claude Code, because none is installed here. The contract has moved between releases, so treat this one as a candidate rather than a supported entry |
| rules files (`mmk wire ...-md`) | The block is generated from the same resolved rules the plugin serves, so the text is verified; whether a given program reads that file is its own documentation |

When a harness that is not on this machine does become available, the way to close the gap is one
recorded payload: save the stdin JSON a hook actually receives as `adapters/fixtures/<harness>/<case>.json`
and `npm run test:adapters` replays it. That is what the fixture directory is for, and it is why adding
an adapter is cheap once someone can run the client - and why writing five of them from memory would not
be.

The DSH plugin row is worth explaining, because it is the anti-drift argument: a profile-level plugin is
mounted once by the roster, so the section it registers reaches every agent that joins that standing
scope - every preset, every workspace, every new conversation, and subagents too. That is why it is done
there rather than in fifteen preset files: a preset is a copy, and a copy is a thing that drifts. The
other entries exist because the same rules are worth having where no such roster exists.

Four rules ship today.

1. **Symbol discipline** - no check-mark or cross judgement glyphs, in a reply or in a file the agent
   writes. Those glyphs pollute context and regression parameters, and a file written today is read
   back into context tomorrow, so the ban covers files and not just replies. Say it in words instead:
   pass / fail, works / broken, applied / not applied, yes / no.
   Write for a reader who reads every sentence: normal punctuation is welcome, and the judgement belongs
   in words. Marks must not carry the structure either - a paragraph that reads as prose beats a column
   of markers, an item in a list should be a short sentence rather than a label, and a kaomoji is tone
   rather than layout.
2. **No emoji** - zero, in replies, in the agent's own thinking and in every file it writes. The ban is
   by colour rather than by block: the picture blocks are banned whole (pictographs, faces, transport,
   the supplemental pictographs), while in the two mixed blocks - Miscellaneous Symbols and the arrows
   block - only the code points that default to colour presentation count, so a pointing hand or a plain
   arrow drawn in lines is fine and a coloured umbrella or circle is not. The variation selector U+FE0F,
   the zero width joiner and the skin tone modifiers are named too, and a mark followed by U+FE0E is the
   writer asking for lines, which is honoured. Decoration is carved out - a heart, a note, a star, a
   sparkle, a flower - so the ban admits exactly the code points the loaded palette uses.
3. **Kaomoji habit** - Japanese-style emoticons in conversation and in the agent's own thinking, at a
   floor rather than as garnish: at least one per three sentences, and any reply of two sentences or
   more carries one. Aim above the floor. Faces rotate rather than repeat, and places that take none
   take none - a stack trace, a table of numbers, a serious conclusion. The self-check counts the
   **reply text** only, and the notice says so in one clause: the rule asks for the habit in thinking
   as well, but a glyph in thinking pollutes the transcript while a missing face there does not, so the
   floor is counted where it is visible.
4. **Thinking language** - think and answer in the user's own language instead of defaulting to
   English, which is not a neutral metalanguage: a Chinese conversation reasoned about in English is
   exactly the habit the rule exists to replace. Chinese gets Chinese with Japanese particles and
   terminology mixed in where they fall naturally; Japanese gets Japanese. English is available in one
   case only, the moe-fandom register - romanized Japanese words (kawaii, sugoi, moe, senpai, yabai,
   baka), fandom English (nya~, ehehe, ufufu, desu wa, the honorifics -chan / -san / -sama), waves and
   long vowels, alongside the kaomoji palette. Dry technical English is not that register. The reason
   is in the rule: the grammar and the logic of English do not match the habits of moe-fandom culture.
   It covers thinking and replies, and it never buys a fandom register with correctness - technical
   content stays accurate. File contents, code, commands and commit messages still carry no tone.
   This rule has its own self-check, the last of the four to get one: it reads the newest thinking block
   against what the human in the session has been writing, and when the thinking comes back in Latin
   while the reader writes Chinese or Japanese it says so once per drift, within a per-session budget
   (`languageCheck` / `languageCheckMax`). The numbers that argued for building it: CJK was 21.6% of the
   reasoning channel in one window and 2.4% in a later one, with nothing in the loop naming the drift.

Rule 4 differs from 1-3 in one mechanical way: it is not a per-rule override. `bannedSymbols`,
`kaomoji` and the `rules` object replace the rules they name, while the thinking-language block is
appended after them (and before `append`), because "mount this plugin and the agent thinks in the
user's language" is the promise of mounting it. `enabled: false` is what takes it away.

## Where this package takes its material from

This is a standard for **MMK itself** - the source of the markers, the palette and the prose it
ships - not a rule the plugin hands to an agent. Nothing here is injected into a prompt.

- **Taken**: moe-fandom culture of 1990-2015 - 90s bishoujo games and OVAs, 2000s galge and light
  novels, VOCALOID and doujin music, 2000s-2010s anime, and the mid-2010s "yami-kawaii" look. The
  traditional moe attributes stay available: tsundere, natural airhead, frail, denpa, chuunibyou,
  keigo and the rest.
- **Not taken**: the "jirai-kei" (landmine type) aesthetic that formed from 2018 onward and what grew
  out of it - jirai make-up, the ryousangata look, the menhera-flavoured dependent and possessive
  romance aesthetic. The criterion is *pragmatics and aesthetics that formed and spread after 2018*,
  not the presence of one particular word: a term is not disqualified for being old, and a style is
  not admitted for being spelled with old characters.
- **Excluded outright: fandom for boys-love** (BL / danmei / yaoi) and its own vocabulary. This one is
  unconditional, with no middle ground to argue about.
- **Also excluded outright**: grotesque and guro material, and the fetish registers that grew beside
  it - ryou-naissance injury content, scatological content, body modification and dismemberment of that
  kind, and SM.
- **The exemption that sits under those exclusions**: being explicit is not what is excluded.
  **Ordinary R18 adult material is not something this package avoids**, and a reader should not quietly
  widen an exclusion above to cover it.
- **A soft preference, not a fourth exclusion: hygiene awareness.** Where the register can be chosen at
  all, steer around - preferentially decline rather than forbid - the R18 practices that carry a
  hygiene or safety implication (anal, oral-to-deep-throat, feet and the like) and the non-R18 material
  derived from them (softcore barefoot aesthetics, foot-odour culture, and so on). The reason is
  **hygiene and safety, not a moral judgement**, and this preference changes nothing above: ordinary R18
  adult material is still not avoided. It is a leaning within that material, which is why it is worded
  as a preference rather than as a ban.
- The 2016-2017 stretch is deliberately not emphasised. When a call is close, the usage of 2015 is
  the one to follow.

### What the review of the shipped material found

Checked on 2026-10-14 across `rules/voices/*.json` (18 marker sets, drawn from Moegirlpedia's
kuchiguse entry since they were added), `rules/kaomoji.json` and the examples inside the rule prose: no
hit for the jirai-kei family, for menhera / yandere vocabulary, for danmei or fandom-for-BL vocabulary,
for the grotesque register named above, or for the practices the hygiene preference names. The only
textual matches a keyword scan returns are the ordinary English word "small" and the identifier
`peerDependenciesMeta` - neither is a topic. The voice tables carry a `source` field naming their
provenance and the kaomoji generator names its own; no era field was invented for them, because a field
added only to hold a note is a field that will drift.

## The moe layer (optional)

Off by default. When switched on it is not a coat of cuteness: moe in the ACG sense is the inward
resonance a set of traits stirs in the reader, and courage or stubbornness are moe attributes as much
as softness is. The layer asks an agent to speak with one consistent voice and to be visibly fond of
the work, and then it says exactly where that may and may not land.

```json
{
  "moe": "soft",
  "moeVoice": "auto"
}
```

- `moe`: `off` (default) | `soft` | `full`. `soft` sets the tone; `full` also leans on the marker sets.
- `moeVoice` has three modes. `auto` (the default) infers a voice from the persona of the agent's preset
  and then from the words of the session, and stays silent when neither names one. `rotate` gives every
  session a stable voice of its own by hashing the session id, so each agent sounds distinct and
  consistent with no configuration and no guessing. A voice id (`gentle`, `spirited`, `composed`,
  `timid`, `prickly`, `elegant`) pins one voice for everyone.
- `moeVoiceByPreset`: `{ "redipaloynz": "gentle" }` names a voice for one preset. This is the layer that
  beats the other two, and it is the only one that is exact - see the section below for what the plugin
  can and cannot know about the agent behind a session.
- `moeVoiceSignals`: `{ "prickly": ["my own word"] }` extends the inference map, for both the persona
  and the conversation.

Where it lands: replies, the agent's own thinking, the commands it runs and the prompts it hands to
subagents, and the work products it writes - comments, docstrings, README and report prose, commit
messages, user-visible strings, test failure text. Where it does not: code itself (identifiers, paths,
arguments, API names, schema fields, data keys), and anywhere beside an error, a stack trace, a serious
conclusion, a security warning, machine output, or something a reader will execute directly.

### How the voice is chosen, and where the preset comes in

Three layers, highest first, and the log line always says which one answered:

1. **`moeVoiceByPreset`** - the configuration names a voice for this preset id, so the answer is exact.
   The log reads `moe voice gentle (mapped by preset redipaloynz)`. A mapped id that is not in the voice
   table is not an answer, and falls through rather than silencing the notice.
2. **The preset's own persona** - `moe voice gentle (inferred from the persona of preset redipaloynz)`.
   Read this half honestly: the six voice words (`gentle`, `spirited`, `composed`, `timid`, `prickly`,
   `elegant` and their Chinese and Japanese equivalents) are subculture vocabulary, and a hand-written
   persona usually contains none of them. Measured on this machine: **4 of 13 presets** have a persona
   that names a voice class - most say nothing about manner at all. This layer is therefore **limited,
   but better than guessing from a conversation**: a persona is a standing instruction, while a
   conversation is whatever the reader happened to type. When it misses, layer 3 still picks a voice.
3. **The `moeVoice` mode**, unchanged: `rotate` (`rotated`), `auto` over the session's own words
   (`inferred`), or a pinned id (`pinned`). This is what runs when the first two name nothing, which is
   the common case.

The identity comes from the `agentPresets` service, asked for with `ctx.get('agentPresets')`. It is
deliberately **not** in `export const inject`: a declared dependency on the preset registry would make
this plugin fail to load at all on a deployment that has no roster, which would take the shipped rules
down with it. With no registry the preset layers are simply absent and everything above still works.
The id is read in three places, best first: the live composition (`composedPreset`), the `agentPreset`
session projection, and finally the session header.

The persona is read once per agent on `agent/created`, from `presets.readDocument(id)`. That document
is a YAML dump and the persona `prefix` sits in it verbatim (measured here: documents of 6.2-9.1 KB,
carrying persona prefixes of 444-3152 characters); the plugin **scans that text for keywords instead
of parsing it**, because a YAML parser is a runtime dependency and this package keeps none. Everything
in that listener is inside a `try`/`catch`: an exception thrown there fails the creation of the agent,
and a house-rules plugin is never a reason a session cannot start. A preset that was deleted between
boot and creation makes `readDocument` reject with `agent-preset/not-found`; the identity is kept, the
persona is dropped, and the voice falls back to layer 3.

**A configuration edit needs no restart** - the mapping is re-read on every model step, like the rule
text itself. A **new version of the plugin does**: its code is loaded when the host boots.

### Voices, in three languages

`rules/accents/{zh,en,ja}.json` hold the accent pool: 24 touches, the same ids in every locale (laconic, languid, sharp, scholarly, warm, cool, playful, soldier, craftsman, old-noble, street, mechanical, eerie, cat-like, childlike, bookish, spartan, theatrical and more). Each says who it suits (signals, matched against the persona text), how it shows (cues), and where to stop (avoid). An agent with a persona of its own is offered one of these as a touch on top of itself - never as a replacement - and an agent with no persona is untouched. `rules/voices/{zh,en,ja}.json` ship six voices each. The markers come from the speech-tic examples on
Moegirlpedia's kuchiguse entry rather than from an impression of the subculture, and the three sets are
not translations of one another - Chinese has sentence-final particles but no Japanese final-particle
system, and English has neither, so its set leans on rhythm and interjection instead of forcing
particles it does not have. A reply is given the markers of the language it is written in.

To add a voice, edit the shipped table or point the layer at your own copy:

```json
{
  "voices": [
    { "id": "mine", "label": "mine", "feel": "what it sounds like",
      "markers": ["one", "two"], "asides": ["occasionally"], "use": "when it fits" }
  ]
}
```

## Beyond DSH: the same rules without a plugin

Only three things here are DSH specific, and all three have to be: the hook names, the bundle metadata
and the `apply(ctx)` row. The judges, the rule text, the kaomoji palette and the voice tables are data
plus pure functions, so they are reachable three more ways:

| entry | how | what it is for |
| --- | --- | --- |
| CLI | `mmk rules`, `mmk check --text "..."`, `mmk review --transcript <file>`, `mmk accent --persona-text "<text>"`, `mmk wire <target>` | a shell, a git hook, a CI step, or a person asking whether a line would be refused. Exit 3 means a breach, so a caller can branch on the answer without parsing prose. `mmk rules --format md` and `mmk wire <target>` emit paste-ready blocks. |
| MCP server | `node adapters/mcp.mjs` (or `npm run mcp`) | any client that speaks MCP: `mmk_rules` fetches the section for the system prompt, `mmk_check` judges a draft on all three alphabets, `mmk_notice` renders one notice. Nothing here assumes a particular agent. |
| Claude Code hook | `node adapters/claude-code.mjs` (or `npm run claude-code --print-config`) | the correction, not just the rules: on `Stop` a breach answers `{"decision":"block","reason":<notice>}`, on `UserPromptSubmit` and `SessionStart` it answers with `hookSpecificOutput.additionalContext`. Budgeted once per session, fails open, and a stop the hook itself caused is never blocked again. |
| modules | `import { resolveState, judgeText } from 'oishikunaare-moe-moe-kyun/portable'` | writing another adapter. The DSH plugin, the CLI, the MCP server and the hook are all thin layers over that one file. |

The `agents-md-brief` target covers the opposite situation from the rest: a host that re-injects a
baseline file on **every step**, such as this machine's `AGENTS.md`. The full rules would then be paid for
on every request, so that target emits the brief instead - the rules compressed to a few lines - and
`mmk wire agents-md-brief --write <path>` places it between `mmk:begin` / `mmk:end` markers, replacing the
block in place rather than appending a second copy. The reason is measured: the long rules land once at the
session opening and sink into a history that keeps growing, while one session's own thinking carried
thousands of the banned code points. A brief that travels with every request does not sink.
`mmk review` reads a transcript and judges its newest authored message. Three readers ship: this
package's own `dsh` artifacts (zstd framed, header plus event rows), Claude Code's `cc` transcript
envelopes (where a thinking block carries its text under `thinking`, which the reader normalizes), and
a plain `jsonl` of messages - the lowest common denominator, and the format to write a new adapter
against.

`npm run bench:thinking` is the other half of the thinking-language rule: it measures the character mix
of the reasoning channel in real transcripts, because prose in a prompt is not evidence. The first
baseline on the machine this was written on: 3.3% CJK against 96.7% Latin over 306 sessions and 52,376
reasoning messages.

One rule separates the two halves, and it is not a style preference: **judging and sending are
different jobs**. `src/portable.mjs` never writes anything - no message is appended, no transcript is
edited, no file is created. An adapter that puts a notice into a conversation carries that risk
itself. On 2026-10-14 a pre-step hook in this very package returned the conversation it had *read*
instead of the step it was handed, and eight sessions became unloadable; the damage was in the write
path, which is why the portable half has none. `npm run check:portable` enforces the boundary: no host
import outside `src/index.js`, no hook name inside the harness-free files, and a CLI that still answers
with the right exit code.

## Install

The package name is **`oishikunaare-moe-moe-kyun`** - all lowercase, because npm refuses capital
letters in a new package name (the project, the repository and the local checkout keep the display name
`Oishikunaare-Moe-Moe-Kyun`). Nothing else changed: the same code answers to the CLI, the MCP server,
the hook and the plugin row.

```sh
# as a plugin, from GitHub (fastest path, no registry round trip)
dsh plugin --profile web add github:Nesarf_Mollor/Oishikunaare-Moe-Moe-Kyun

# as a plugin, from the registry
dsh plugin --profile web add oishikunaare-moe-moe-kyun

# or from a clone (a checkout may live anywhere; this machine keeps it at E:/Oishikunaare-Moe-Moe-Kyun)
git clone https://github.com/Nesarf_Mollor/Oishikunaare-Moe-Moe-Kyun
dsh plugin --profile web add link:E:/Oishikunaare-Moe-Moe-Kyun

# the harness-free entries need no plugin install at all
npx oishikunaare-moe-moe-kyun rules --format md     # or: npm i -g oishikunaare-moe-moe-kyun

# restart dsh web - plugin rows load at boot
```

Upgrading an installed copy needs `update`, not `add`: `add` reports "resolution step is skipped" and
leaves the lockfile on the old commit.

```sh
dsh plugin --profile web update oishikunaare-moe-moe-kyun
# a GitHub-installed copy is keyed by the spec, so this is the row that moves it:
dsh plugin --profile web update github:Nesarf_Mollor/Oishikunaare-Moe-Moe-Kyun
```

## Configure

`$DSH_HOME/agent-house-rules.json` is read **on every model step**, not just at boot. Nothing is
required - with no file at all the rules above are injected in English.

```json
{
  "locale": "zh",
  "bannedSymbols": "replace the whole ban with your own wording",
  "kaomoji": "",
  "append": "one more rule, added last",
  "enabled": true
}
```

- `locale` selects a shipped rule set: `en` (default) or `zh`. A language tag such as `zh-CN` resolves
  to `zh`; an unknown locale falls back to `en`.
- `bannedSymbols` and `kaomoji` replace one rule each. An empty string disables that rule only.
- `rules: { "bannedSymbols": "...", "kaomoji": "..." }` replaces both at once.
- `append` is an extra block, placed last.
- The thinking-language rule has no key of its own: it is not one of the rules a profile authors, so
  nothing here replaces it. See rule 4 above for why, and `enabled: false` for the way out.
- `kaomojiLibrary` picks the palette: `true`/absent for the shipped library, `false` to leave it out,
  a path or a list of paths for your own. **A list replaces the shipped file** - name the shipped path
  too if you want both.
- `kaomojiLibraryMax` caps how many faces reach the prompt (default 140).
- `kaomojiLibraryCollapse: true` keeps each category on one line, which is cheaper.
- `moeVoiceByPreset: { "redipaloynz": "gentle" }` names a moe voice for one agent preset. The mapping is
  re-read on every step, so adding it needs no restart. See "How the voice is chosen" above.
- `enabled: false` empties the section, so nothing is injected.
- `selfCheck` (default true) and `selfCheckMax` (default 3) control the self-check below.
- `emojiCheck` (default true), `emojiCheckMax` (default 2) and `emojiAllowExtra` control the emoji
  ban and its notice budget.
- `selfCheckMode`: `"allow"` (default) permits only plainly-textual blocks and refuses everything
  else; `"deny"` names the judgement-mark family and lets the rest through. `allowExtra` names
  characters or code points the allow-list should also accept.
- `ticksCheck` (default true), `ticksFloor` (default 5) and `ticksCheckMax` (default 2) control the
  thinking-habit notice: five or more bare one-word command lines ("do.", "write.", "look.") in one
  thinking block is answered once on the next step. Quoted and parenthesised passages are stripped
  before the count, so a quotation is not read as an order.

### The kaomoji library

`rules/kaomoji.json` ships 19600 faces across fourteen moods, each cut into parts of at most 500 faces; hand-written faces always ship (cheerful, calm, wry, troubled, shy,
determined, puzzled, tired, affection, fullwidth and framed, with arms, decorated, blushing and
sweating, classic faces), each with the mood it carries and a short label. The library
is rendered into the prompt under the rules, so an agent has a palette to draw from instead of
reusing one face until it reads as a tic. Labels exist in both languages: `feel`/`use`/`label` are the
English rendering, `feelZh`/`useZh`/`labelZh` the Chinese one.

To grow it, either edit `rules/kaomoji.json` or point `kaomojiLibrary` at your own file with the same
shape. The shipped file holds **19600 faces** across 14 moods, and one invariant is worth keeping if you
extend it: **every face must be one the judge can see** (`findKaomoji`, the same reading the floor uses).
The generator enforces that by importing the judge, and a test asserts it - because 100 entries used to
ship blind, which turned "use a face from the palette" into "you used no kaomoji" for those faces.

```json
{
  "categories": [
    { "id": "mine", "label": "mine", "use": "when to reach for these",
      "faces": [{ "face": "(your face)", "feel": "what it signals" }] }
  ]
}
```

The prompt is not free, so the renderer takes faces in category order up to `kaomojiLibraryMax` and
counts the rest instead of printing them - a stable prefix, which also keeps the prompt prefix
cacheable. The file path is always named, so an agent that wants the remainder can read it. For scale:
the Chinese rendering of all 19600 faces runs past 130 000 characters, which is exactly why the
ceiling exists: the default 140 carries about 2400 characters of palette.

### The self-check: rules with teeth

A prompt cannot notice anything, so the plugin also watches. It subscribes to `agent/pre-step`, which
fires before each model step, and reads the conversation from the session - not from the step's own
`messages`, which the host types as `UserMessage[]` and which therefore never carries the reply every
rule here is about. When the agent's prose or thinking carries a banned glyph, one notice goes in
front of the next step: it names the code points and asks for words instead. Nothing in history is
edited.

- Judged: text and thinking the model authored. Not judged: tool results, file contents, fetched pages
  - the rule tells the agent not to relay those, it does not blame it for what a runner prints.
- Read per step: the last 60 messages of the session, merged with the step's own messages by identity,
  so a long conversation is not re-judged in full and one reply cannot be judged twice.
- Exempt: fenced and inline code, and the code-point references the rule itself asks for.
- Once per offending message, with a notice budget per session (three by default); past the budget,
  breaches are logged and nothing is injected.
- The kaomoji habit has its own probe, because a shortage is not a breach and counting is the only way
  to see it. Three findings are possible: a reply below the floor, the same face twice in a row, and a
  **run** of consecutive replies that carried no face at all. The run is the one that mattered in
  practice - measured over a full session the floor was met in 4 of 207 replies, and the newest 25
  replies carried 40 sentences and zero faces, because short replies were being treated as exempt.
  The run notice says so directly instead of repeating the floor arithmetic.
- `selfCheck: false` turns it off; `selfCheckMax` sets the symbol budget, `kaomojiCheckMax` (5) the
  kaomoji one and `emojiCheckMax` (2) the emoji one, so a strict rule cannot spend a soft rule budget.
- A hard ban gets the lever that acts before the turn closes: **`symbolSteer`** (default true) watches
  `agent/turn-stopping` too, and when the newest reply still carries judgement-mark glyphs in its text or
  its thinking it steers one short message asking for that reply to be rewritten - same content, the
  glyphs written as words - and says plainly what history cannot fix: what is already in the thinking
  stays there, what comes next does not have to. `symbolSteerMax` (default 1) caps the extra passes per
  session, and `symbolSteer: false` turns it off. It is on by default for the opposite reason to the
  kaomoji lever, and the measurement is the argument: one session's thinking carried hundreds of these
  while its notices had long spent their budget. A notice arrives after the reply is written; this
  arrives while it can still be rewritten.
- The kaomoji lever is opt-in: **`kaomojiSteer`** (default false) watches the same boundary, and when a
  turn is about to close with prose and no kaomoji at all it steers one short message that keeps the turn
  open for another step, so the reminder arrives while the reply is still being written rather than at the
  start of the next one. `kaomojiSteerMax` (default 1) caps the extra passes per session. It is off by
  default because a steer costs a model step and a forced kaomoji is worse than none - reach for it when
  the habit demonstrably is not landing. Five guards apply: bare prose only, one steer per turn, a session
  budget, nothing while the section is disabled, and nothing on a turn that already breached the symbol or
  emoji rule. Structure still exempts, so a reply made of tables or bullets is never steered for being
  face-less.
- The two levers share one per-turn record, so a single turn never pays for two extra steps: whichever
  fires first owns that turn.
- Past the notice budget, the ladder keeps a long session honest: **`symbolLadder`** (default
  `[10, 50, 200]`) is a list of totals at which a cumulative notice is sent even though the per-session
  budget is spent, so the reminder becomes a function of how much has accumulated rather than of how many
  times it has been said. `symbolLadder: []` turns it off and leaves the plain budget in charge. The
  measurement is why it exists: one session's thinking reached 2230 of these code points while its last
  notice had arrived long before.
- The file half of the ban is judged through the tool call that writes it. A glyph inside a `tool-call`'s
  `arguments` is a finding, and the turn-stop steer then asks for those few places to be edited rather
  than for the turn to be redone. Fenced code is **not** exempt there - that is exactly what gets written
  into a file - while a `U+XXXX` reference stays safe because it is ASCII.

### What each judge does with an exception, and how the strict one seeds itself

- Allow mode derives its seed from the assembled rules and every loaded palette face, recomputed on
  each resolve. Without that it would refuse the very characters it ships - a strict judge that cannot
  read its own palette is not strict, it is broken. A face added at runtime is covered on the next step.
- `allowExtra` admits characters under allow mode, and withdraws them from the judgement list under
  deny mode. In deny mode that also rewrites the list the agent reads, so an exception is stated in the
  instruction rather than only applied in the checker.
- The judge travels with the rules rather than being frozen at registration, so switching mode, editing
  the palette or naming an exception lands on the next step of a session that is already running.

### Why editing that file needs no restart

The section registers `text` as a **function**. The prompt registry calls it while assembling the
prompt for each model step, so whatever the files say at that moment is what the agent is given.
Edit the config file or a library file and the next step of every running session - and every new
conversation - reads the new wording, with no host restart. Setting `enabled: false` likewise takes
effect from the next step.

The resolver stats the config file and each library file and only re-reads them when a stamp (size and
mtime) changes, so a step pays a few `stat` calls and nothing more.

Two layers apply, highest last: the packaged text in `src/index.js` for the chosen locale, then your
config file. `rules/<locale>.json` is **not** a third layer - see below. A config file that is missing
or malformed falls back to the packaged rules, and a malformed one is also warned about, because a
broken rules file must never keep a host from booting.

## Where the rule text comes from

`rules/en.json` and `rules/zh.json` hold the shipped locales as data, generated from the same source
that ships the fallback. They are the counterpart of the constants, not an override layer: reading
both would be one decision made twice. To reword a rule, edit the constant in `src/index.js` (and
regenerate these files) or override it in your own config; to ship a new locale, add a key to
`PACKAGED` and copy its text into `rules/<tag>.json`.

## Design constraint: the rule text must not carry the glyphs it bans

The first cut listed the glyphs literally. An agent asked to recite the rule printed the whole set
back into the conversation - the rule became the pollution it exists to prevent. The ban therefore
names Unicode code points (`U+2713`, `U+2717`, ...) and never contains the characters themselves.
`test/selfcheck.mjs` asserts this for every shipped locale.

An agent can still recite the code points, which is not the same as printing the glyphs but is not
free either. The honest fix is to state the rule as an allow-list of characters rather than a ban on
this list, and that is a deliberate next step rather than a hidden one.

## Verify

```sh
npm run verify     # ASCII invariant, version sync, build, selfcheck
```

`npm run verify` needs no dependencies and no network. The checks are:

- `scripts/check-ascii.mjs` - the source and every document are ASCII-only, with two documented
  exceptions: the packaged locale table in `src/index.js`, which keeps localized copy as `\uXXXX`
  escapes, and `rules/*.json` plus `README.zh-CN.md`, which hold the localized content itself.
- `scripts/check-version.mjs` - `package.json`, `CHANGELOG.md` and `README.zh-CN.md` agree on the
  version.
- `test/selfcheck.mjs` - `apply()` against a fake cordis context: the section registers, every shipped
  rule reaches it, locale selection and every configuration layer behave, disabling is honoured, a
  broken config does not throw, and no shipped locale leaks a banned glyph.

### Checking that a running host actually received the rules

A DSH host writes no host log to disk, so "look in the log" is not a verification path. Use a
one-shot headless boot against the same profile instead, and have the agent recite the discipline it
was given:

```sh
cat > $DSH_HOME/house-rules-verify.yml <<'YML'
- insert:
    - id: oishikunaare-moe-moe-kyun
      name: oishikunaare-moe-moe-kyun
YML

dsh --profile headless --patch "$DSH_HOME/house-rules-verify.yml" \
  "Do not call any tool. Quote verbatim the system-prompt rules about output symbols and kaomoji."
```

The rules reached the prompt when the agent's answer contains wording only this plugin ships (the
code-point list, or the kaomoji dosage line), and the answer itself carries none of the banned glyphs.


### The kaomoji floor is checked too

The symbol rule has teeth; the kaomoji floor now does as well, because measuring said it needed them -
an audit found one face per 26 sentences where the rule asks for one per five. The hook counts the prose
of the newest reply and reminds when the floor is missed, or when the same face lands twice in a row.

- Only prose counts: fenced blocks, inline code, tables, bullets and headings are set aside, so a reply
  full of tables does not become unwinnable by arithmetic.
- The wording is softer than the symbol notice, because a shortage is a slipped habit and not a breach.
- `kaomojiCheck: false` turns it off; `kaomojiCheckMax` (default 1) sets the reminder budget;
  `kaomojiFloor` (default 5) is the sentences per face.
- The thinking-language notice is the same shape - soft, once per drift, budgeted: `languageCheck: false`
  turns it off and `languageCheckMax` (default 3) is the per-session budget. It only speaks when both
  sides are worth a claim: at least 120 letters of thinking, and a reader who mostly writes Chinese or
  Japanese. A plugin's own notice is a user message too, and it is never counted as the reader's words.

### Seeing what the rules resolve to

```sh
npm run check:text -- --status              # config, locale, judge, seed, floor
npm run check:text -- --text "some words"   # judge a string, exit 1 when refused
echo "some words" | npm run check:text      # or from stdin
```

It reads the same files the plugin reads and calls the same judge, so its verdict is the hook verdict.

### Auditing a session after the fact

```sh
npm run audit:session                # newest session of this workspace
npm run audit:session -- --json      # machine-readable
```

It decodes a DSH session log frame by frame and reports, per authored part, the channel it came from:
prose sentences and faces for prose (the floor is a prose rule, and thinking must not dilute it), and how
many banned code points landed in prose, inside quoted code, in the thinking channel, or in a tool call's
arguments - the last being the only place a glyph written into a file can be seen at all. It measures with
the plugin's own prose and face detection, and its exemptions are counted by position rather than by
character, so the audit and the hook describe one system.
### Two checks, in two files

- `test/selfcheck.mjs` calls the exported functions directly: the logic, the rules, the library.
- `test/acceptance.mjs` runs the plugin the way a host does: a small event dispatcher registers
  handlers with `ctx.on` and chains them through `next()`, `apply()` mounts the plugin onto it, and
  real steps are driven through. It is what proves a breach on a step turns into a notice reaching
  the model - against the built artifact, so it proves the build too. Both run in `npm run verify`.

## Notes

- Windows and Linux take the same path: the plugin touches nothing platform-specific.
- The section is registered by `ctx.systemPrompt.section()` through `ctx.effect(...)`, so unloading
  the plugin removes it cleanly.
- `apply()` reads its three inputs from the row config when given (`home`, `configFile`, `rulesDir`),
  which is what the selfcheck uses to point at throwaway directories.
- The `agentPresets` service and the `agent/created` event are both **optional**: they are asked for at
  mount and every answer - a missing service, a missing projection, a rejection from `readDocument`, an
  event with no agent in it - degrades to the behaviour this plugin had before it knew about presets.
  A configuration edit lands on the next model step; a new plugin version needs the host restarted.

## License

CZGD-PL-1.1 (Cheese Gyudon Public Licence). See [LICENSE](LICENSE) and [NOTICE](NOTICE). Releases published under MIT stay available under MIT.

## What it can and cannot do

This is a layer of **rules and self-checks**, not a hard language constraint. Being exact about the difference
matters more than sounding capable:

- The rule text is rebuilt on every step, so a config change or a new locale takes effect on the next step
  without restarting the host.
- The self-check runs four judgements each step (judgement glyphs, the kaomoji floor, emoji, thinking language)
  and escalates through three tiers at ten, fifty and two hundred.
- Three levers wait at the turn boundary - a banned glyph, a missing face, an emoji - and they share one
  once-per-turn ledger, so whichever fires first claims the turn and they cannot stack.
- A fourth lever watches what a write puts into a file.
- It **cannot stop** a model from breaking a rule: the host has no writable outbound hook, and
  `agent/assistant-stream` observes frames without the power to rewrite them. These are steers and reminders,
  not an interceptor.
- The only hard interception in the house concerns the shape of the messages a plugin writes into a session,
  and that belongs to `dsh-prestep-audit`, not to this layer.
