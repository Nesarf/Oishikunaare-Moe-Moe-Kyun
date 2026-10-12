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

启动时读取 `$DSH_HOME/agent-house-rules.json`。**完全不放这个文件也能用** —— 两条纪律会以英文注入。

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
- `enabled: false` 则什么都不注册。

三层按顺序生效，逐层覆盖上一层：`src/index.js` 里的内置文本 → 插件旁边的 `rules/<locale>.json`
→ 你的配置文件。配置文件缺失或格式坏掉都会回落到内置默认 —— 规则文件坏不该让宿主起不来，因为
这个插件的职责正是让其他 agent 规矩起来。

## 规则文本的出处

`rules/en.json` 与 `rules/zh.json` 把内置语言作为**数据**存放，和代码里那份兜底文本同源生成。
想改中文措辞又不碰代码，就在克隆里直接编辑 `rules/zh.json`；想加一门语言，加 `rules/<tag>.json`
并把 `locale` 指过去。

## 设计约束：规则文本自己不许带被禁的符号

最初那版把符号字形直接写在提示词里。结果一问它「纪律原文是什么」，它就把整圈符号打印了回来 ——
规则成了它自己要防的那种污染。现在的禁令**只点名 Unicode 码位**（`U+2713`、`U+2717` 等），
正文里绝不出现那些字符本身。`test/selfcheck.mjs` 对每种内置语言都断言这一点，`apply()` 启动时
若发现规则文件夹带字形也会告警。

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

## 说明

- Windows 与 Linux 走同一条路径，插件不碰任何平台专有面。
- section 通过 `ctx.effect(...)` 里的 `ctx.systemPrompt.section()` 注册，卸载插件时会干净地摘掉。
- `apply()` 接受行配置里的 `home`、`configFile`、`rulesDir` 三个输入，自检就是靠它们指向临时目录的。

## 当前本机部署（0.1.0）

作者本机（Windows）的实际情况，供日后对照：

- 本机部署的副本是 `E:\dsh-home\plugins\dsh-agent-house-rules`，以 `link:` 形式装进 web profile，
  语言为 `zh`。本仓库是它的公开发布形态，包名与插件 id 统一为 `TastyLineOut`。
- 本机**没有**写 `agent-house-rules.json`，走的是内置默认；要切中文需在
  `E:\dsh-home\agent-house-rules.json` 里写 `{"locale": "zh"}`。
- 本机 `$DSH_HOME` 为 `E:\dsh-home`。

## 授权

MIT，见 [LICENSE](LICENSE)。
