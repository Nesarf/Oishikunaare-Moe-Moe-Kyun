# Oishikunaare-Moe-Moe-Kyun

> English documentation: [README.md](README.md)

给 AI agent 的输出纪律（house rules）：**一个内核，四条入口**。这些纪律讲的是 agent 怎么写东西 ——
对错标记符号、emoji、颜文字习惯、思考用什么语言 —— 它们本来就不属于某一个宿主，所以这个包也不属于。

| 入口 | 是什么 | 怎么接 |
| --- | --- | --- |
| **CLI** `mmk` | `rules`、`lib`、`check`、`notice`、`voice`、`review`、`wire` | shell、git hook、CI，或者只是想确认「这句话会不会被拒」的人。退出码 3 表示有违规 |
| **MCP server** | `mmk_rules`、`mmk_check`、`mmk_notice` 三个工具 + `mmk://rules` 资源 | 任何会说 MCP 的客户端，不假设对面是哪一个 agent |
| **Claude Code 钩子** | 在回合还开着的时候就纠正 | `Stop` 回 `{"decision":"block","reason":<通知>}`，`UserPromptSubmit` 与 `SessionStart` 附带上下文 |
| **DSH 插件** | 给整个 profile 一条全局 system prompt section | 由 roster 只挂载一次，覆盖全部 preset、工作区、新会话与 subagent |
| **模块** | `oishikunaare-moe-moe-kyun/portable`、`/transcripts` | 自己写适配器的人：上面每一个都是薄薄地架在这两个文件上 |

`mmk wire <target>` 会把某个地方要用的接法直接打出来 —— 钩子块、MCP 客户端块、
`AGENTS.md` / `CLAUDE.md` / `GEMINI.md` 的规则块、DSH 的插件行 —— 路径都填成真实路径。

### 哪一条验证到什么程度

「从没跟真正的宿主见过面」和「见过」不是一回事，而这个差别值得明说而不是暗示。这张表是诚实的版本。

| 入口 | 验证到什么程度 |
| --- | --- |
| DSH 插件 | 在写它的那台机器上就是生产状态：挂在活的 profile 里，规则与自检在真实会话里可见 |
| CLI `mmk` | 在那台机器上干过真活 —— 审一条会话、回答「这句话会不会被拒」—— 并由 `test/portable.mjs` 覆盖 |
| MCP server | 协议这半边在本机验过：握手、`tools/list`、逐个工具调用、`resources/read`。客户端那半边取决于客户端 |
| Claude Code 钩子 | **只有公开契约 + 录制的夹具**（`npm run test:adapters`）；本机没装 Claude Code，所以从没对活客户端跑过。契约在版本之间移动过，因此请把它当候选项，而不是已支持的入口 |
| 规则文件（`mmk wire ...-md`） | 段落与插件下发的是同一份已解析规则，所以文本是验过的；某个程序是否真读那个文件，是它自己的文档说了算 |

等哪天本机真的装上了别家宿主，补上缺口的方式就是**一条录制的载荷**：把钩子真正收到的 stdin JSON 存成
`adapters/fixtures/<harness>/<case>.json`，`npm run test:adapters` 会把它重放出来。夹具目录就是为这件事存在的 ——
也是为什么「能跑到那个客户端之后，加一个适配器很便宜」，而「凭记忆先写五个」不是。

DSH 那一条值得解释一句，因为它是「防漂」的论据：profile 级插件由 roster 只挂载一次，因此它注册的
section 覆盖所有加入该 standing scope 的 agent —— 全部 preset、全部工作区、每个新会话，连 subagent 一起。
这也是为什么要做成插件而不是改 preset：preset 是副本，副本会漂。另外三条入口存在的理由是：
同样的纪律在没有这种 roster 的地方也值得有。

当前内置四条纪律：

1. **禁符号**：回复里、写出的文件里都不要用对勾与叉这类「对错标记」符号。理由是它们会污染上下文
   与回归参数，而今天写出的文件明天会被读回上下文，所以禁令覆盖文件，不只覆盖回复。
   改用纯文字：通过 / 不通过、成功 / 失败、已生效 / 未生效、是 / 否。
2. **禁 emoji**：回复里、你自己的思考里、写出的任何文件里，emoji 一律为零。判定按区块而不是按
   字符清单（pictograph、表情脸、交通与地图符号、Miscellaneous Symbols、带 emoji 呈现的几何图形，
   外加变体选择符、零宽连接符与肤色修饰符），因为清单每次 Unicode 更新都要重做，而且仍然不全。
   装饰性符号单独放行 —— 心、音符、星星、火花、花 —— 所以禁的是图片，不是颜文字用的那些记号。
3. **颜文字习惯**：在对话里、以及你自己的思考里，都带日式颜文字。这是下限而不是点缀：每三句至少一个，
   两句以上的回复至少带一个，目标是高于下限。同一个字形不要连着用；工具报错、严肃结论、成段的
   代码或数据旁边一个都不挂。写进文件的内容、代码、命令、提交信息一律不用。自检的**判据只算回复正文**，
   通知里也会明说这一点：规则要求思考里同样带着，但思考里的字形会污染记录，而思考里少一个不会 ——
   所以下限只在看得见的地方计数。
4. **思考语言**：用**用户自己的语言**思考与回答，不要默认拿英文当底。英文不是中立的元语言 ——
   中文会话里拿英文思考，正是这条要改掉的习惯。中文语境以中文为主，可自然混入日文的语气词与术语；
   日文语境用日文，可自然混入中文的习惯用语。英文只在一种情况下可用：走**萌宅英文**的语体 ——
   罗马字日文词（kawaii、sugoi、moe、senpai、yabai、baka）、ACG 圈的英文语体（nya~、ehehe、
   ufufu、desu wa、敬称 -chan / -san / -sama）、波浪线与拖长音，配日式颜文字；干巴巴的技术英文
   不算合格。理由写在规则里：英文的文法与逻辑不符合萌宅文化的习惯。覆盖**思考与回复**，
   而且语体萌化不得损害正确性 —— 技术内容照常准确。文件内容、代码、命令、提交信息里照旧不用语气。
   这一条也有了自己的自检（四条里最后补上的）：判据读**最新一块思考**与**这个会话里人写的文字**，
   当思考是拉丁字母为主、而读者在用中文或日文时，每次漂移提醒一条，并受每会话预算约束
   （`languageCheck` / `languageCheckMax`）。造它之前先量过：思考通道的 CJK 占比在一个窗口里是 21.6%，
   在更晚的窗口里只有 2.4%，而整条链路里没有任何东西会指出这个漂移。

第 4 条与前三条有一处机制上的不同：它**不是**可逐条替换的规则。`bannedSymbols`、`kaomoji` 与
`rules` 对象替换它们各自点名的规则，而思考语言块是**追加在它们之后**（`append` 之前）的 ——
因为「挂上这个插件，agent 就用用户的语言思考」正是挂上它的意义。`enabled: false` 是唯一能把它
一起拿掉的开关。

## 本包的取材坐标

这是 **MMK 自身**的标准 —— 约束它产出的标记、颜文字库与文案取自哪里 —— **不是**插件下发给 agent
的纪律。这里没有任何内容会被注入提示词。

- **取**：1990–2015 的萌宅文化 —— 90 年代美少女游戏与 OVA、2000 年代 galgame 与轻小说、
  VOCALOID 与同人音乐、2000s–2010s 动画、2010 年代中期的「病みかわいい」。传统萌属性照旧可用：
  傲娇、天然、病弱、电波、中二、敬语等等。
- **不取**：2018 年起成型的「地雷系」及其衍生 —— 地雷メイク、量産型，以及メンヘラ 式的依存与
  束缚型恋爱美学。判据是「**2018 年之后成型并流行的语用与美学**」，不是抓单个词：一个词不会因为
  年头久就被排除，一种风格也不会因为用旧字形写就被纳入。
- **绝对排除：腐文化**（BL / 耽美 / yaoi / 腐向）及其专属语用。这一条无条件，没有可争的中间地带。
- **同样绝对排除**：G 向（グロ）与各种猎奇血腥向，以及随之长起来的那类癖好向内容 —— リョナ、
  スカトロ、肉体改造与切断这类，**包括 SM**。
- **这些排除项之下的豁免**：被排除的**不是「露骨」本身**。**正常的 R18 成人向内容不在规避之列** ——
  请不要为了「稳妥」把上面任何一条排除项悄悄扩大到它头上。
- **一条软倾向，不是第四条排除：卫生意识**。在可选择语体的时候，**在某种程度上尽量回避**（是「优先
  不选」，不是「禁止」）：算正常 R18 但带卫生 / 安全隐含的玩法（足、肛、深喉这类），以及由它们
  衍生的非 R18 内容（软色情裸足审美、脚臭文化之类）。理由照实写：这是**卫生与安全**上的考量，
  **不是道德判断**；它也不改变上一条豁免 —— 正常的 R18 成人向内容照旧不规避，这只是在 R18 之内的
  一种取向偏好，所以措辞是倾向而不是禁令。
- 中间的 2016–2017 不作强调；拿不准时，以 **2015 年**的语用为准。

### 对内材料复核的结论

2026-10-14 复核 `rules/voices/*.json`（18 组标记，自加入起即取自萌娘百科「口癖」条目）、
`rules/kaomoji.json` 以及规则文案里的举例：地雷系一族、メンヘラ / ヤンデレ 语用、耽美 / 腐向语用、
上面点名的猎奇与癖好向语体、以及卫生意识那一条点到的玩法与衍生题材，**均零命中**。关键词扫描唯一
命中的文本是英文常用词 "small" 与标识符 `peerDependenciesMeta` —— 两者都不是题材。语气表自带一个
`source` 字段注明出处、颜文字生成脚本也注明了自己的；**没有**为写一条年代说明硬造字段，因为只为放
一句注释而加的字段，迟早会漂。

## 萌层（可选）

默认关闭。打开之后它**不是给输出涂一层可爱**：ACG 意义上的萌是「因着对方的某些特征而从内心萌生
出来的共鸣」，勇敢、坚强与温柔一样是萌属性。这一层要 agent 用**一个稳定一致的声音**说话、对
自己在做的东西有真实的偏爱，然后明确告诉它这股劲**可以落在哪里、不可以落在哪里**。

```json
{
  "moe": "soft",
  "moeVoice": "auto"
}
```

- `moe`：`off`（默认）/ `soft` / `full`。`soft` 定语气；`full` 连标记表一起用起来。
- `moeVoice` 三种模式：`auto`（默认）先看**这个 agent 的预设人格**、再看会话里的话，两处都没指名就
  保持沉默；`rotate` 按会话 id 哈希给**每个会话一个固定的语气**，于是每个 agent 听起来都不一样而且
  稳定，零配置、不猜；直接写一个 id（`gentle`、`spirited`、`composed`、`timid`、`prickly`、
  `elegant`）则是全员钉死一种。
- `moeVoiceByPreset`：`{ "redipaloynz": "gentle" }` 给某一个预设指定语气。这是三层里最高的那一层，
  也是**唯一精确**的一层——插件能知道什么、不能知道什么，见下面那节。
- `moeVoiceSignals`：`{ "prickly": ["你自己的词"] }` 扩充推断映射，人格与会话两条路都用它。

**落点**：回复、你自己的思考、你跑的命令与交给子代理的提示词、以及你写出的工作产物（注释、
docstring、README 与报告的行文、commit message、用户可见的字符串、测试失败信息）。
**不落**：代码本体（标识符、路径、参数、API 名、schema 字段、数据键名），以及报错与堆栈旁边、
严肃结论、安全告警、机器输出、任何读者会直接拿去执行的东西。

### 语气是怎么定下来的，预设在哪一层

三层，从高到低，日志行永远会说明是哪一层答的：

1. **`moeVoiceByPreset`**——配置给这个预设 id 指定了语气，答案是精确的。日志形如
   `moe voice gentle (mapped by preset redipaloynz)`。映射到的 id 不在语气表里就不算答案，
   会往下一层落，而不是把通知吞掉。
2. **预设自带的人格文本**——日志形如
   `moe voice gentle (inferred from the persona of preset redipaloynz)`。
   这一半要诚实说清：那六个语气词（`gentle`、`spirited`、`composed`、`timid`、`prickly`、
   `elegant` 及其中日文对应词）是亚文化词汇，人手写的人格文本**往往一个都不含**。本机实测：
   13 个预设里只有 **4 个**的人格点到了语气类，其余对说话方式只字未提。所以这一层是**有限，
   但比猜会话文本强**：人格是常驻指令，而会话内容只是读者偶然打出来的字。它没命中时第 3 层照样定语气。
3. **`moeVoice` 模式本身**，行为不变：`rotate`（日志 `rotated`）、`auto` 看会话自己的话
   （`inferred`）、或钉死的 id（`pinned`）。前两层都没指名时走这里，而这是常态。

身份来自 `agentPresets` 服务，用 `ctx.get('agentPresets')` 去要。**故意不写进
`export const inject`**：把预设注册表声明成硬依赖，会让插件在**没有注册表的部署上整份加载失败**，
连带三条纪律一起没了。没有注册表时预设这两层就整体缺席，上面其余功能照常。id 有三级来源，
从高到低：实时组合（`composedPreset`）、`agentPreset` 这个 session 投影、最后是会话 header。

人格在每个 agent 创建时读一次（`agent/created`），来源是 `presets.readDocument(id)`。那份文档是
一份 YAML dump，人格 `prefix` 以原文躺在里面（本机实测：文档 6.2–9.1 KB，其中人格前缀 444–3152 字符）；
插件**只对这段文本做关键词扫描，不解析它**——YAML 解析器是运行时依赖，而这个包保持零依赖。
那个监听器的整个函数体都在 `try`/`catch` 里：**在 `agent/created` 里抛错会直接让 agent 创建失败**，
而一个纪律插件绝不能成为会话起不来的原因。预设若在启动与创建之间被删掉，`readDocument` 会以
`agent-preset/not-found` reject；此时身份保留、人格丢弃、语气落回第 3 层。

**改配置不需要重启**——映射和规则文本一样每个模型步重新读取。**换插件版本需要重启宿主**：
代码是启动时装载的。

### 三语语气表

`rules/voices/{zh,en,ja}.json` 各六种语气。标记取自萌娘百科「口癖」条目的实例，而不是凭印象编的；
三套表**不是互相翻译**——中文有句末语气词但没有日语的终助词体系，英文两者都没有，所以英文那套靠
节奏与感叹，而不是硬塞它没有的助词。**回复用哪种语言，就给哪套标记。**

要加一种语气，改内置表或把这一层指向你自己的副本：

```json
{
  "voices": [
    { "id": "mine", "label": "我的", "feel": "听起来是什么样",
      "markers": ["呀", "呢"], "asides": ["偶尔来一句"], "use": "什么时候用" }
  ]
}
```

## 不局限于 DSH：不装插件也能用同一套规则

这个包里只有三样东西是 DSH 专属的，而且只能如此：钩子名、打包元数据、以及 `apply(ctx)` 那一行。
判据、规则文本、颜文字库、语气表都是「数据 + 纯函数」，所以另外还有三个入口：

| 入口 | 怎么用 | 给谁用 |
| --- | --- | --- |
| CLI | `mmk rules`、`mmk check --text "…"`、`mmk review --transcript <文件>`、`mmk wire <target>` | shell、git hook、CI 步骤，或者只是想确认「这句话会不会被拒」的人。退出码 3 表示有违规，调用方不必去解析文本。`mmk rules --format md` 与 `mmk wire <target>` 直接产出可粘贴的段落 |
| MCP server | `node adapters/mcp.mjs`（或 `npm run mcp`） | 任何会说 MCP 的客户端：`mmk_rules` 取纪律段、`mmk_check` 判一段草稿、`mmk_notice` 渲染一条提醒。这里不假设对面是哪一个 agent |
| Claude Code 钩子 | `node adapters/claude-code.mjs`（或 `npm run claude-code --print-config`） | 不只是规则，而是「纠正」：`Stop` 时若有违规，回 `{"decision":"block","reason":<通知>}`；`UserPromptSubmit` 与 `SessionStart` 回 `hookSpecificOutput.additionalContext`。每会话限一次、任何异常一律放行、由自己引发的 stop 绝不会再被拦 |
| 模块 | `import { resolveState, judgeText } from 'oishikunaare-moe-moe-kyun/portable'` | 自己写适配器的人。DSH 插件、CLI、MCP server、钩子全都薄薄地架在这一个文件上 |

`mmk review` 读一份会话记录，判它最新的一条「模型自己写的」消息。自带三个读取器：本包自己的
`dsh` 产物（zstd 分帧、头行 + 事件行）、Claude Code 的 `cc` 记录信封（它的思考块把文本放在
`thinking` 字段里，由读取器归一化）、以及最朴素的 `jsonl`（一行一条消息）—— 写新适配器就照它写。

`npm run bench:thinking` 是「思考语言纪律」的另一半：它实测真实记录里 reasoning 通道的文字构成，
因为提示词里的散文不算证据。写它那台机器上的第一条基线：306 条会话、52376 条带 reasoning 的消息，
**CJK 3.3% / 拉丁 96.7%**。

两边分开的规则只有一条，而且它不是风格偏好：**判断和送达是两件事**。
`src/portable.mjs` 什么都不写 —— 不追加消息、不改记录、不建文件。往会话里放提醒的风险由做这件事的
适配器自己承担。2026-10-14 就是本包自己的一个 pre-step 钩子把「它读到的会话」当成「交给它的那一步」
返回，八条会话因此打不开；损害出在**写入路径**上，所以这一半根本没有写入路径。
`npm run check:portable` 守住这条界线：`src/index.js` 之外不许有宿主 import、无宿主文件里不许出现钩子名、
CLI 必须仍然给出正确退出码。

## 安装

包名是 **`oishikunaare-moe-moe-kyun`** —— 全小写，因为 npm 不允许新建的包名里带大写字母
（项目名、仓库名、本机克隆目录仍然保持显示名 `Oishikunaare-Moe-Moe-Kyun`）。别的什么都没变：
同一份代码同时是 CLI、MCP server、钩子和 DSH 插件行。

```sh
# 作为插件，从 GitHub 直装
dsh plugin --profile web add github:Nesarf/Oishikunaare-Moe-Moe-Kyun

# 作为插件，从 registry 装
dsh plugin --profile web add oishikunaare-moe-moe-kyun

# 或从本地克隆装（克隆目录叫什么都可以；本机的克隆在 E:/Oishikunaare-Moe-Moe-Kyun）
git clone https://github.com/Nesarf/Oishikunaare-Moe-Moe-Kyun
dsh plugin --profile web add link:E:/Oishikunaare-Moe-Moe-Kyun

# 那三个「不依赖宿主」的入口根本不用装插件
npx oishikunaare-moe-moe-kyun rules --format md     # 或：npm i -g oishikunaare-moe-moe-kyun

# 然后重启 dsh web —— 插件行在启动时装载
```

升级已装的副本要用 `update` 而不是 `add`：`add` 会报 resolution step is skipped，把 lockfile 留在旧
commit 上。

```sh
dsh plugin --profile web update oishikunaare-moe-moe-kyun
# 从 GitHub 装的那份是按 spec 记账的，所以移动它的是这一行：
dsh plugin --profile web update github:Nesarf/Oishikunaare-Moe-Moe-Kyun
```

## 配置

`$DSH_HOME/agent-house-rules.json` **每个模型步都会重新读取**，不是只在启动时读一次。
**完全不放这个文件也能用** —— 上面几条纪律会以英文注入。

```json
{
  "locale": "zh",
  "bannedSymbols": "整段替换禁符号纪律",
  "kaomoji": "",
  "append": "再追加一条，排在最后",
  "enabled": true
}
```

- `locale` 选择内置规则集：`en`（默认）或 `zh`。`zh-CN` 这类语言标签会解析到 `zh`；不认识的值回落 `en`。
- `bannedSymbols` 与 `kaomoji` 各自整段替换一条纪律；给空字符串就是只关掉那一条。
- `rules: { "bannedSymbols": "...", "kaomoji": "..." }` 一次替换两条。
- `append` 是追加块，排在最后。
- 思考语言那条**没有自己的键**：它不是由 profile 撰写的规则，所以这里没有任何东西能替换它 ——
  理由见上面第 4 条，要拿掉它只有 `enabled: false`。
- `kaomojiLibrary` 选颜文字库：`true`/不填 = 内置库，`false` = 不带库，
  给路径或路径数组 = 用你自己的库。**给数组是替换内置库**，想两个都要就把内置路径也写进数组。
- `kaomojiLibraryMax` 限制进入提示词的颜文字数量（默认 140）。
- `kaomojiLibraryCollapse: true` 让每类压成一行，更省。
- `moeVoiceByPreset: { "redipaloynz": "gentle" }` 给某一个 agent 预设指定萌语气。这份映射每个模型步
  都会重读，改完不用重启。细节见上面「语气是怎么定下来的」那一节。
- `enabled: false` 让这条 section 变空，什么都不注入。
- `selfCheck`（默认开）与 `selfCheckMax`（默认 3）控制下面的自检。
- `selfCheckMode`：`"deny"`（默认）点名对错标记那一族、其余放行；`"allow"` 只允许明确的文本类区块、
  其余一律拒绝。`allowExtra` 用来把字符或码位加进允许列表。

### 颜文字库

`rules/kaomoji.json` 内置 14 类共 1150 个字形（开心、平和、苦笑、出状况、害羞、有干劲、困惑、疲惫、
亲昵、全角与框式、带手臂、带装饰、脸红与冒汗、经典字形），
每个都带它传达的情绪与一句短标签。库会渲染进提示词、接在两条纪律之后，于是 agent 手里有一盘颜料可取，
而不是把同一个字形用到像抽动。标签两种语言都有：`feel`/`use`/`label` 是英文渲染，
`feelZh`/`useZh`/`labelZh` 是中文渲染。

要扩充，直接改 `rules/kaomoji.json`，或用 `kaomojiLibrary` 指向你自己的同形文件。
随包那份是 **14 种情绪、1790 个字形**，扩充时有一条不变量值得守：**每个字形都必须是判据看得见的**
（`findKaomoji`，与下限用的是同一套读数）。生成器靠**直接 import 判据**保证它，测试也钉住了 ——
以前有 100 条是判据看不见的，于是「从库里挑一个」对它们来说等于「你没有用颜文字」：

```json
{
  "categories": [
    { "id": "mine", "label": "我的", "use": "什么场合用它",
      "faces": [{ "face": "(你的字形)", "feel": "它传达什么" }] }
  ]
}
```

提示词不是免费的，所以渲染器按类别顺序取到 `kaomojiLibraryMax` 就停，剩下的只报数目不铺开 ——
这样前缀稳定，也让提示词前缀可缓存；库文件路径始终写在块里，想要剩下的可以自己去读。
量级参考：1150 个字形的中文渲染约 20000 字符 —— 这正是上限存在的理由：默认的 140 个约占 2400 字符。
库本身由 `scripts/gen-kaomoji.mjs` 生成（`npm run gen:kaomoji`），四道闸门保证质量：跨类唯一、
长度窗口、至少含一个非 ASCII 字符、括号配对。

### 自检：有牙齿的那一层

提示词本身不会发现任何事，所以插件还会看着。它订阅 `agent/pre-step`（每个模型步之前触发），
从**会话**里读对话 —— 而不是读这一步自己的 `messages`：宿主把那个载荷声明成 `UserMessage[]`，
它永远不会带上 agent 刚写的那条回复，而这条回复正是这里每条规则的对象。当正文或思考里出现了
被禁字形，**下一条**消息前会多一条通知：点名码位，要求改用纯文字。历史记录一个字都不改。

- **会被判**：模型自己写的正文与思考。**不会判**：工具输出、文件内容、抓来的网页 ——
  规则要求的是不许转述，而不是替测试器打印出来的东西背锅。
- **每步读多少**：会话的最后 60 条，按身份与本步自己的消息合并 —— 长会话不会被整体重判一遍，
  同一条回复也不会被判两次。
- **豁免**：围栏代码与行内代码（那里的例子是数据），以及规则自己要求的码位引用。
- 每条违规消息只通知一次，每个会话有通知预算（默认三条）；超出后只记日志、不再注入。
- **硬禁有自己的杠杆**：`symbolSteer`（默认**开**）同样挂在 `agent/turn-stopping` 上，当最新一条回复的
  正文或**思考**里还有对错标记类字形时，它 steer 一条短提醒，要求**把那条回复重写一遍**（内容不变，
  字形换成文字），并明说历史改不了什么：已经写进思考的就留在那里，接下来的不必再写。
  `symbolSteerMax`（默认 1）限制每个会话多跑几步，`symbolSteer: false` 可关。
  它默认**开**，理由与颜文字那条相反，而理由是实测：某条会话的思考里累计几百个字形，而它的通知预算早就
  用完了 —— 事后通知在回复写完**之后**才到，这条杠杆到得**还能改**的时候。
- `kaomojiSteer`（默认**关**）是另一道杠杆：挂在同一个边界上，当一轮**准备结束**而整轮文字一个颜文字
  都没有时，它 steer 一条短提醒**把回合撑住再跑一步**——提醒就在眼前，而不是等下一个回合开头才出现。
  `kaomojiSteerMax`（默认 1）限制每个会话多跑几步。默认关，因为 steer 会多花一次模型步，而规则自己也说了
  强行挂一个比不挂更糟：这是「习惯明显没落地」时才用的杠杆。五道闸门：只有真散文才算、每轮最多一次、
  会话有预算、section 关掉时不 steer、已经踩了符号或 emoji 纪律的那一轮交给那条纪律。结构仍然豁免——
  表格或列表那种回复不该为了「没颜文字」被 steer。
- 两道杠杆**共用同一份「每回合一次」的记录**，所以一轮最多只多跑一步：谁先命中，这一轮就归谁。
- `selfCheck: false` 关掉它；`selfCheckMax` 管符号预算，`kaomojiCheckMax`（5）管颜文字预算，
  `emojiCheckMax`（2）管 emoji 预算，互不挤占。
- 颜文字那头多了一个探针，因为「太少」不是「违规」，只有数出来才看得见。三种发现：单条低于下限、
  同一个字形连着用、以及**连着几条回复一个都没有**。最后那种是实测里真正的病根：整个会话里 207 条
  回复只有 4 条达标，最近 25 条是 40 句配 0 个字形——短回复被当成了例外。这条提醒会直说这件事，
  而不是再念一遍下限算术。

### 两个判据各自怎么处理例外，以及严格判据怎么给自己播种

- allow 模式的允许列表由「组装后的规则文本 + 每个已加载的字形」派生，并在每次解析时重算。
  没有这一步，它会把自己随附的字符也判成违规 —— **读不懂自己调色板的严格判据不是严格，是坏的**。
  运行时新增的字形会在下一步被覆盖到。
- `allowExtra` 在 allow 模式下是「放行」，在 deny 模式下是「从禁列里撤下」。deny 模式下它还会**改写
  agent 读到的那份禁列**，于是例外是写在指令里的，而不只是校验器里生效。
- 判据随规则一起解析，而不是在注册时冻住 —— 切换模式、改调色板、点名例外，都在**已经跑着的会话的下一步**生效。

### 为什么改这些文件都不需要重启

section 注册的 `text` 是一个**函数**。prompt 注册表在**拼装每个模型步的提示词时**才调用它，
所以那一刻文件里写的是什么，agent 拿到的就是什么。改配置文件或改库文件，**正在跑的会话的下一步**、
以及每个新对话，都会读到新内容 —— 不需要重启宿主。`enabled: false` 同理，从下一步起生效。

解析器对配置文件与每个库文件各做一次 `stat`，只有标记（大小与修改时间）变了才重新读取，
所以每个步只多付几次 `stat`。

生效优先级只有两层，后者覆盖前者：`src/index.js` 里对应语言的内置文本 → 你的配置文件。
配置文件缺失或格式坏掉都会回落到内置默认，格式坏掉还会额外告警 —— 规则文件坏不该让宿主起不来，
因为这个插件的职责正是让其他 agent 规矩起来。

## 规则文本的出处

`rules/en.json` 与 `rules/zh.json` 把内置语言作为**数据**存放，和代码里那份文本同源生成。
它们是内置常量在数据面的对应物，**不是覆盖层** —— 同时读两份等于同一个决定做两遍。
想改措辞，就改 `src/index.js` 里的常量（并重新生成这两个文件），或者用自己的配置覆盖；
想加一门语言，在 `PACKAGED` 里加一个键，并把文本复制进 `rules/<tag>.json`。

## 设计约束：规则文本自己不许带被禁的符号

最初那版把符号字形直接写在提示词里。结果一问它「纪律原文是什么」，它就把整圈符号打印了回来 ——
规则成了它自己要防的那种污染。现在的禁令**只点名 Unicode 码位**（`U+2713`、`U+2717` 等），
正文里绝不出现那些字符本身。`test/selfcheck.mjs` 对每种内置语言都断言这一点，
并且覆盖了「改配置文件后下一步就换文案」这条直播行为。

不过 agent 仍然可以复述码位。那和打印字形不是一回事，但也不是零成本。真正的解法是把规则写成
**允许字符集**而不是「禁这一串」，这是刻意留下的下一步，不是藏起来的问题。

## 验证

```sh
npm run verify     # ASCII 不变量、版本同步、构建、自检
```

`npm run verify` 不需要装任何依赖，也不需要联网。三项检查是：

- `scripts/check-ascii.mjs` —— 源码与所有文档保持纯 ASCII，只有两处**明文登记的例外**：
  `src/index.js` 里那张内置语言表（本地化文案以 `\uXXXX` 转义存放），以及
  `rules/*.json` 与 `README.zh-CN.md`（它们本身就是本地化内容）。
- `scripts/check-version.mjs` —— `package.json`、`CHANGELOG.md`、`README.zh-CN.md` 三处版本号一致。
- `test/selfcheck.mjs` —— 用假的 cordis ctx 跑 `apply()`：section 注册、两条纪律都到位、
  语言选择与每一层配置覆盖的行为、关闭开关、坏配置不抛异常、内置语言不漏字形。

### 确认运行中的宿主真的收到了纪律

DSH 宿主**默认不往磁盘写宿主日志**，所以「去日志里找」不是一条可行的验收路径。改用一次性的 headless
启动，让 agent 复述它收到的纪律：

```sh
cat > $DSH_HOME/house-rules-verify.yml <<'YML'
- insert:
    - id: oishikunaare-moe-moe-kyun
      name: oishikunaare-moe-moe-kyun
YML

dsh --profile headless --patch "$DSH_HOME/house-rules-verify.yml" \
  "不要调用任何工具。原样引用系统提示里关于输出符号与颜文字的纪律。"
```

判据两条：回答里出现**只有本插件才有的措辞**（码位清单，或颜文字分寸那一行），
并且回答本身不含任何被禁符号。


### 颜文字那条也有自检了

符号有牙齿，颜文字现在也有了 —— 因为量出来的数据说它需要：审计发现实际是每 26 句一个，而规则要求每 5 句一个。
钩子会数最新那条回复的散文句数，不够就提醒，同一个字形连着出现两次也提醒。

- **只数散文**：围栏代码、行内代码、表格、列表项、标题都排除，否则一份满是表格的回复会「按算术」永远达不到下限。
- 措辞比符号那条**更软**，因为缺颜文字是习惯没到位，不是违规。
- `kaomojiCheck: false` 关掉；`kaomojiCheckMax`（默认 5）是提醒预算；`kaomojiFloor`（默认 3）是每几句一个。
- 思考语言那条通知同形：**软、一次漂移一条、有预算**。`languageCheck: false` 关掉，`languageCheckMax`（默认 3）
  是每会话预算。它只在两侧都值得下判断时才说话：思考至少 120 个字母，且读者以中文/日文为主；
  插件自己的通知也是 user 消息，但**永远不会被当成读者写的话**。

### 看规则现在解析成什么

```sh
npm run check:text -- --status              # 配置、语言、判据、种子、下限
npm run check:text -- --text "一段文本"      # 判一段文本，被拒时退出码 1
echo "一段文本" | npm run check:text         # 或从 stdin
```

它读的是插件读的同一批文件、调的是同一个判据，所以它的结论就是钩子的结论。

### 事后审计一次会话

```sh
npm run audit:session                # 本工作区最新会话
npm run audit:session -- --json      # 机器可读
```

它逐帧解开 DSH 会话日志，按助手消息报告：散文句数、颜文字个数、以及被禁码位有多少落在散文里、多少在引文里。
量尺直接复用插件的散文与字形识别，所以审计与钩子不会各说各话。
### 两层检查，两个文件

- `test/selfcheck.mjs` 直接调用导出的函数：查逻辑、规则、库。
- `test/acceptance.mjs` 按宿主的运行方式跑插件：一个精简但忠实的事件派发器（处理器用 `ctx.on` 注册、
  通过 `next()` 链式传递），`apply()` 把它挂上去，然后真的驱动若干步。它证明的是「某一步上出现违规，
  会变成一条抵达模型的通知」—— 而且跑的是构建产物，所以顺带证明构建。两者都在 `npm run verify` 里。

## 说明

- Windows 与 Linux 走同一条路径，插件不碰任何平台专有面。
- section 通过 `ctx.effect(...)` 里的 `ctx.systemPrompt.section()` 注册，卸载插件时会干净地摘掉。
- `apply()` 接受行配置里的 `home`、`configFile`、`rulesDir` 三个输入，自检就是靠它们指向临时目录的。
- `agentPresets` 服务与 `agent/created` 事件**都是可选的**：挂载时去要，而每一种回答——服务不存在、
  投影没注册、`readDocument` reject、事件里没有 agent——都退化成「这个插件还不认识预设」时的那套
  行为。改配置在下一个模型步生效；换插件版本要重启宿主。

## 当前本机部署

作者本机（Windows）的实际情况，供日后对照：

- 正式来源是本仓库：`dsh plugin --profile web add github:Nesarf/Oishikunaare-Moe-Moe-Kyun`，
  在本机解析到 `E:\dsh-home\profiles\web\node_modules\Oishikunaare-Moe-Moe-Kyun`，并由
  `profiles/web/package.json` 的 bundles 装载。早期那份自建副本
  （`plugins\dsh-agent-house-rules`，以 `link:` 装过）已从 profile 摘除并删除。
- 本地克隆目录与仓库同名：`E:\Oishikunaare-Moe-Moe-Kyun`；上面「从本地克隆装」里的
  `link:E:/Oishikunaare-Moe-Moe-Kyun` 指的就是这个目录。
- 本机**明文配置语言为中文**：`E:\dsh-home\agent-house-rules.json` 内容是
  `{"locale": "zh", "enabled": true}`。删掉这个文件就会退回英文内置默认。
- 本机 `$DSH_HOME` 为 `E:\dsh-home`。
- **本机的出网兜底是 mihomo**（MAOMAOYUNAPP 内置的 `mihomo-windows-386`）。可用代理口是
  `127.0.0.1:10090`（也就是 Windows 系统代理里登记的那个口）。注意别把 `9790` 当代理：
  那是 mihomo 自己的 API（`GET /` 返回 `{"hello":"mihomo"}`），**不接 CONNECT**，
  拿它当代理只会拿到 405。本机未开 TUN（默认路由仍在 WLAN 网关上），所以兜底只有两条路：
  显式代理，或系统代理。
  已落地的配置：`git config --global http.proxy http://127.0.0.1:10090`，
  以及 `$DSH_HOME/.env` 里的 `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY`。
  实测证据：`git ls-remote` 的 `GIT_CURL_VERBOSE` 里出现
  `Establishing HTTP proxy tunnel to github.com:443`；`curl -x http://127.0.0.1:10090
  https://api.github.com/` 返回 200 且比直连更快。
  > 早先这个位置写的是「本机只能走 SSH，所以全局加了 `url.insteadOf` 传输替换」。
  > 那条已经不成立：替换只是绕开了当时那次连接被重置，用代理才是正解，
  > 现在 `.insteadOf` 已移除，git 与 pnpm 都能直接走 HTTPS。
- 验收方式（不需要宿主日志，DSH 默认不落盘）：用 headless 起一次真启动并加一个临时 overlay，
  见上文「确认运行中的宿主真的收到了纪律」。本机已于 2026-10-12 用这条路验证通过：
  agent 复述出了中文规则原文与码位清单，且回答本身不含任何被禁符号。

## 授权

CZGD·PL-1.0（Cheese Gyudon Public Licence，チーズ牛丼パブリックライセンス），见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)。此前以 MIT 发布的版本仍可按 MIT 使用。
