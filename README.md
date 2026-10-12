# TastyLineOut

> Chinese documentation: [README.zh-CN.md](README.zh-CN.md)

Output house rules for every agent in a DeepSeek Harness profile, delivered as one global system
prompt section.

A profile-level plugin is mounted once by the roster, so the section it registers reaches every agent
that joins that standing scope: every preset, every workspace, every new conversation, and subagents
too. That is the whole point of doing it here rather than in fifteen preset files - a preset is a copy,
and a copy is a thing that drifts.

Two rules ship today.

1. **Symbol discipline** - no check-mark or cross judgement glyphs, in a reply or in a file the agent
   writes. Those glyphs pollute context and regression parameters, and a file written today is read
   back into context tomorrow, so the ban covers files and not just replies. Say it in words instead:
   pass / fail, works / broken, applied / not applied, yes / no.
2. **Kaomoji habit** - Japanese-style emoticons in conversation and in the agent's own thinking, at a
   floor rather than as garnish: at least one per five sentences, so a reply of five sentences or
   more carries at least one. Faces rotate rather than repeat, and places that take none take none -
   a stack trace, a table of numbers, a serious conclusion.

## Install

```sh
# from GitHub (fastest path, no registry round trip)
dsh plugin --profile web add github:Nesarf/TastyLineOut

# or from a clone
git clone https://github.com/Nesarf/TastyLineOut
dsh plugin --profile web add link:E:/TastyLineOut

# restart dsh web - plugin rows load at boot
```

Upgrading an installed copy needs `update`, not `add`: `add` reports "resolution step is skipped" and
leaves the lockfile on the old commit.

```sh
dsh plugin --profile web update TastyLineOut
```

## Configure

`$DSH_HOME/agent-house-rules.json` is read **on every model step**, not just at boot. Nothing is
required - with no file at all the two rules above are injected in English.

```json
{
  "locale": "zh",
  "bannedSymbols": "replace the whole ban with your own wording",
  "kaomoji": "",
  "append": "one more rule, added after the two above",
  "enabled": true
}
```

- `locale` selects a shipped rule set: `en` (default) or `zh`. A language tag such as `zh-CN` resolves
  to `zh`; an unknown locale falls back to `en`.
- `bannedSymbols` and `kaomoji` replace one rule each. An empty string disables that rule only.
- `rules: { "bannedSymbols": "...", "kaomoji": "..." }` replaces both at once.
- `append` is an extra block, placed last.
- `kaomojiLibrary` picks the palette: `true`/absent for the shipped library, `false` to leave it out,
  a path or a list of paths for your own. **A list replaces the shipped file** - name the shipped path
  too if you want both.
- `kaomojiLibraryMax` caps how many faces reach the prompt (default 60).
- `kaomojiLibraryCollapse: true` keeps each category on one line, which is cheaper.
- `enabled: false` empties the section, so nothing is injected.

### The kaomoji library

`rules/kaomoji.json` ships 59 faces across nine moods (cheerful, calm, wry, troubled, shy,
determined, puzzled, tired, affection), each with the mood it carries and a short label. The library
is rendered into the prompt under the two rules, so an agent has a palette to draw from instead of
reusing one face until it reads as a tic. Labels exist in both languages: `feel`/`use`/`label` are the
English rendering, `feelZh`/`useZh`/`labelZh` the Chinese one.

To grow it, either edit `rules/kaomoji.json` or point `kaomojiLibrary` at your own file with the same
shape:

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
the Chinese rendering of all 59 faces is about 1000 characters, the English about 1600.

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
- `test/selfcheck.mjs` - `apply()` against a fake cordis context: the section registers, both rules
  reach it, locale selection and every configuration layer behave, disabling is honoured, a broken
  config does not throw, and no shipped locale leaks a banned glyph.

### Checking that a running host actually received the rules

A DSH host writes no host log to disk, so "look in the log" is not a verification path. Use a
one-shot headless boot against the same profile instead, and have the agent recite the discipline it
was given:

```sh
cat > $DSH_HOME/house-rules-verify.yml <<'YML'
- insert:
    - id: TastyLineOut
      name: TastyLineOut
YML

dsh --profile headless --patch "$DSH_HOME/house-rules-verify.yml" \
  "Do not call any tool. Quote verbatim the system-prompt rules about output symbols and kaomoji."
```

The rules reached the prompt when the agent's answer contains wording only this plugin ships (the
code-point list, or the kaomoji dosage line), and the answer itself carries none of the banned glyphs.

## Notes

- Windows and Linux take the same path: the plugin touches nothing platform-specific.
- The section is registered by `ctx.systemPrompt.section()` through `ctx.effect(...)`, so unloading
  the plugin removes it cleanly.
- `apply()` reads its three inputs from the row config when given (`home`, `configFile`, `rulesDir`),
  which is what the selfcheck uses to point at throwaway directories.

## License

MIT. See [LICENSE](LICENSE).
