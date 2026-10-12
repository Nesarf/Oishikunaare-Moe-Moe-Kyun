# TastyLineOut

> English documentation: [README.md](README.md)

给 DSH profile 里**所有 agent** 的输出纪律（house rules），以一条全局 system prompt section 的形式下发。

profile 级插件由 roster 只挂载一次，因此它注册的这条 section 覆盖所有加入该 standing scope 的
agent：全部 preset、全部工作区、每个新会话，连 subagent 一起。这也是为什么要做成插件而不是改
preset —— preset 是副本，副本会漂。

当前内置两条纪律：

1. **禁符号**：回复里、写出的文件里都不要用对勾与叉这类「对错标记」符号。理由是它们会污染上下文
   与回归参数，而今天写出的文件明天会被读回上下文，所以禁令覆盖文件，不只覆盖回复。
   改用纯文字：通过 / 不通过、成功 / 失败、已生效 / 未生效、是 / 否。
2. **颜文字习惯**：在对话里习惯性带一点日式颜文字，让文字有活人味。只用于对话 —— 文件内容、代码、
   命令、提交信息里一律不用。关键是分寸：一段回复最多一两个，报错堆栈或严肃结论旁边一个都不挂。

## 安装

```sh
# 从 GitHub 直装
dsh plugin --profile web add github:Nesarf/TastyLineOut

# 或从本地克隆装
git clone https://github.com/Nesarf/TastyLineOut
dsh plugin --profile web add link:E:/TastyLineOut

# 然后重启 dsh web —— 插件行在启动时装载
```

升级已装的副本要用 `update` 而不是 `add`：`add` 会报 resolution step is skipped，把 lockfile 留在旧
commit 上。

```sh
dsh plugin --profile web update TastyLineOut
```

## 配置

`$DSH_HOME/agent-house-rules.json` **每个模型步都会重新读取**，不是只在启动时读一次。
**完全不放这个文件也能用** —— 两条纪律会以英文注入。

```json
{
  "locale": "zh",
  "bannedSymbols": "整段替换禁符号纪律",
  "kaomoji": "",
  "append": "第三条纪律，追加在两条之后",
  "enabled": true
}
```

- `locale` 选择内置规则集：`en`（默认）或 `zh`。`zh-CN` 这类语言标签会解析到 `zh`；不认识的值回落 `en`。
- `bannedSymbols` 与 `kaomoji` 各自整段替换一条纪律；给空字符串就是只关掉那一条。
- `rules: { "bannedSymbols": "...", "kaomoji": "..." }` 一次替换两条。
- `append` 是追加块，排在最后。
- `kaomojiLibrary` 选颜文字库：`true`/不填 = 内置库，`false` = 不带库，
  给路径或路径数组 = 用你自己的库。**给数组是替换内置库**，想两个都要就把内置路径也写进数组。
- `kaomojiLibraryMax` 限制进入提示词的颜文字数量（默认 60）。
- `kaomojiLibraryCollapse: true` 让每类压成一行，更省。
- `enabled: false` 让这条 section 变空，什么都不注入。
- `selfCheck`（默认开）与 `selfCheckMax`（默认 3）控制下面的自检。
- `selfCheckMode`：`"deny"`（默认）点名对错标记那一族、其余放行；`"allow"` 只允许明确的文本类区块、
  其余一律拒绝。`allowExtra` 用来把字符或码位加进允许列表。

### 颜文字库

`rules/kaomoji.json` 内置 9 类共 59 个字形（开心、平和、苦笑、出状况、害羞、有干劲、困惑、疲惫、亲昵），
每个都带它传达的情绪与一句短标签。库会渲染进提示词、接在两条纪律之后，于是 agent 手里有一盘颜料可取，
而不是把同一个字形用到像抽动。标签两种语言都有：`feel`/`use`/`label` 是英文渲染，
`feelZh`/`useZh`/`labelZh` 是中文渲染。

要扩充，直接改 `rules/kaomoji.json`，或用 `kaomojiLibrary` 指向你自己的同形文件：

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
量级参考：59 个字形的中文渲染约 1000 字符，英文约 1600 字符。

### 自检：有牙齿的那一层

提示词本身不会发现任何事，所以插件还会看着。它订阅 `agent/pre-step`（每个模型步之前触发），
检查 agent 自己刚刚说过的话。当它的正文或思考里出现了被禁字形，**下一条**消息前会多一条通知：
点名码位，要求改用纯文字。历史记录一个字都不改。

- **会被判**：模型自己写的正文与思考。**不会判**：工具输出、文件内容、抓来的网页 ——
  规则要求的是不许转述，而不是替测试器打印出来的东西背锅。
- **豁免**：围栏代码与行内代码（那里的例子是数据），以及规则自己要求的码位引用。
- 每条违规消息只通知一次，每个会话有通知预算（默认三条）；超出后只记日志、不再注入。
- `selfCheck: false` 关掉它；`selfCheckMax` 调预算。

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
    - id: TastyLineOut
      name: TastyLineOut
YML

dsh --profile headless --patch "$DSH_HOME/house-rules-verify.yml" \
  "不要调用任何工具。原样引用系统提示里关于输出符号与颜文字的纪律。"
```

判据两条：回答里出现**只有本插件才有的措辞**（码位清单，或颜文字分寸那一行），
并且回答本身不含任何被禁符号。


### 两层检查，两个文件

- `test/selfcheck.mjs` 直接调用导出的函数：查逻辑、规则、库。
- `test/acceptance.mjs` 按宿主的运行方式跑插件：一个精简但忠实的事件派发器（处理器用 `ctx.on` 注册、
  通过 `next()` 链式传递），`apply()` 把它挂上去，然后真的驱动若干步。它证明的是「某一步上出现违规，
  会变成一条抵达模型的通知」—— 而且跑的是构建产物，所以顺带证明构建。两者都在 `npm run verify` 里。

## 说明

- Windows 与 Linux 走同一条路径，插件不碰任何平台专有面。
- section 通过 `ctx.effect(...)` 里的 `ctx.systemPrompt.section()` 注册，卸载插件时会干净地摘掉。
- `apply()` 接受行配置里的 `home`、`configFile`、`rulesDir` 三个输入，自检就是靠它们指向临时目录的。

## 当前本机部署

作者本机（Windows）的实际情况，供日后对照：

- 正式来源是本仓库：`dsh plugin --profile web add github:Nesarf/TastyLineOut`，
  在本机解析到 `E:\dsh-home\profiles\web\node_modules\TastyLineOut`，并由
  `profiles/web/package.json` 的 bundles 装载。早期那份自建副本
  （`plugins\dsh-agent-house-rules`，以 `link:` 装过）已从 profile 摘除，目录留作参考。
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

MIT，见 [LICENSE](LICENSE)。
