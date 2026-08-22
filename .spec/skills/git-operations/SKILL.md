---
name: git-operations
description: "BoardGame Git 操作入口。用于提交、推送、同步主分支、pre-push 阻塞、PR、worktree、fork、merge 等协作场景。"
---

# Git 操作 Skill

本 skill 只规定本项目里的 Git 操作边界。根 `AGENTS.md` 保留不可越过的红线；复杂提交、推送、PR、worktree 和 merge 细则以本文为准。

## 触发

用户要求以下动作时使用：

- `git status`、diff、commit、push。
- “检查一下没问题就提交 / 看下再推”。
- 同步 `main`、处理 pre-push、远端失败。
- PR、merge、fork、worktree、跨仓库写回。

## 基本原则

- 默认工作区可能是脏的，陌生改动先判断影响；无关就绕开，不顺手清。
- 不擅自 `stash`、`restore`、`checkout --`、`clean`、`reset`、`rebase`、`revert`。
- 不擅自创建、切换、删除分支或 worktree。
- Git 操作只处理用户当前授权目标，不自动升级成同步主线、修 bug、跑专项验证或整理全仓。
- 需要用户判断时先说现实含义，再给代码证据；不要只甩测试名、字段名或错误码。

## 看改动

日常审查顺序：

1. `git status --short --branch`
2. `git diff --stat`
3. 按目标读取关键文件 diff

审查时先把改动分类：用户可见行为、业务规则、测试/mock/fixture、生成物/evidence、文档规范、纯格式。拿不准、会恢复旧行为、触及用户刚修链路、改生产逻辑、改测试期望、影响 E2E 证据或合并裁定时，先上报现实含义和风险，不直接吞进提交。

## 提交

默认只提交本轮明确范围内的改动。

用户说“都提交 / 全修改 / 所有修改 / 全部改动”时，解释为审查当前仓库内已暂存、未暂存和未跟踪文件；不包含 ignored 文件。

提交规则：

- `git commit -m` 默认中文，标题写清业务对象和动作，不能写“修复问题 / 更新代码”。
- 大提交用中文多行消息，覆盖主要文件簇、行为变化、测试/evidence 和用户点名事项。
- 提交消息必须来自真实 diff 审查；关键改动映射不上消息时，先继续审查。
- 提交前发现待提交对象超过 10MB，先判断是否应进仓库；诊断、trace、视频、临时 evidence、构建产物、日志和压缩包默认不提交。超过 50MB 需强理由；超过 100MB 视为 GitHub 推送硬阻塞。
- 涉及 i18n 或可见文案时，首次提交前默认跑 `npm run i18n:check` 或等价最小检查。

提交切线：

- 当目标是“检查后提交 / 提交后 push”时，以首次提交前完成的审查和暂存范围作为本次提交切线。
- `git commit` 成功后新出现的未跟踪、截图、测试输出、后台产物或并发改动，默认不纳入本次提交。
- 若后续 push 的 hook 失败且必须修改当前已提交内容才能通过，才回到门禁修复路径。

## 推送

目标涉及 push 时，默认先 `git fetch --prune origin`。fetch 只更新远端跟踪信息，不等于授权 pull、merge、rebase 或 stash。

fetch 后：

- 只是 `ahead N`：继续推送当前提交。
- 出现 `behind` 或 `ahead + behind`：不得自动 pull / merge / rebase / stash；说明远端已有新提交，让用户选择合并主线继续当前 PR、从最新主线重开、或暂缓同步。
- 用户当轮已明确要求“处理远端更新后继续推 / 同步后再推 / 合并远端再推 / 改到能 push”时，先锁定合并方向、工作区归属和双边范围，再推进。

push 失败先分网络/协议、hook、真实测试失败、权限失败。GitHub `403 / Permission denied / Write access denied` 通常表示不能直推上游主仓；贡献代码默认切 fork + PR，而不是索要上游写权限。

绕过门禁、guard 或预算限制不是默认动作；没有用户当轮明确允许，不使用 `--no-verify` 或 bypass 环境变量。

## “检查后提交/推”的动作上限

“检查没问题 / 看下再提交 / 看下再推”默认是静态审查后 Git 动作，不等于主动跑测试，也不等于授权修复。

即使 diff 含 UI，也不得自动启动 UI 审计、截图、Playwright、E2E、构建、lint 或 typecheck。只有用户点名、Git hook 自动触发，或静态审查发现需要机器确认的具体风险，才追加命令。

如果静态审查、hook 或生成脚本暴露需要编辑代码的问题：

- 默认停止在 finding / blocker，说明现实后果、证据和最小修法。
- 只有用户已给“修复后提交 / 补齐门禁 / 改到能 push / 自动修掉再推”等授权，才切到 fix-then-git。
- 纯机械 i18n key、格式、小类型字段等在持续授权内可直接最小修补；但触及生产逻辑、测试期望、用户刚修症状、旧行为回补、截图/evidence 语义或业务文案含义时，先上报。

用户明确“无校验 / 不跑 E2E / 直接无校验 push”时，不主动跑任何测试、E2E、构建、lint 或 typecheck；若同时明确允许跳过 hook，才只对本次 Git 动作使用 `--no-verify`。

## Pre-push 失败

先分类：

1. 网络/协议失败：HTTPS 失败且 SSH 可用时，切 SSH。
2. Hook / 质量门禁失败：按失败项归类，不笼统说 push 失败。
3. 门禁脚本锁冲突：区分 stale lock、预算冷却、实际 E2E 失败；当前目标只推本工作树时，不跨 worktree 排障或清理。
4. 真实测试失败：按失败用例定位，不能说成只是网络问题。

ESLint warning-only：

- 若 TypeScript / 构建 / 测试未失败、ESLint 为 0 errors、阻塞只是新增 warning，且 warning 不指向运行时崩溃、安全泄漏、数据丢失或用户点名症状，归类为质量门禁阻塞，不包装成玩法 bug。
- 用户当轮明确放行 warning-only 或无校验 push 时，可在汇报剩余 warning 与风险后继续推送。
- 不适用于 ESLint error、typecheck、测试、构建、安全、真实业务链路、生成文件未审 diff 或需要业务裁定的问题。

持续授权下的机械修补可以继续 commit/push，但修法必须让门禁自然通过；禁止吞异常、删断言、降覆盖、只改测试不改真实逻辑或临时绕过。

## 远端与身份

默认优先 SSH；SSH 已验证可用时，fetch / pull / push / ls-remote 都优先 SSH，不在 HTTPS 443 不稳定时反复重试。

维护者或有上游写权限的工作树：

- `origin` 默认指向主仓 SSH：`git@github.com:zhuanggenhua/BoardGame.git`

外部协作者、不可写账号或 fork PR 场景：

- `origin` 指向协作者 fork。
- `upstream` 指向主仓。

若 `origin` 是 HTTPS 且目标涉及远端操作，只能在同一仓库身份内切协议；不得把协作者 fork 的 `origin` 改成主仓 SSH。

## Fork / PR

不能直推主仓时，默认走 fork + PR：

- 推到可写 fork 分支。
- 从 `fork:<branch>` 向主仓目标分支创建 PR。
- fork 推送成功但 PR 创建失败时，继续尝试可用认证通道；仍失败再汇报“本地已提交 + fork 已推送 + PR 未创建”，说明源/目标分支和失败原因。

代码 PR 与素材上传、部署、服务器 HEAD 回查要拆开：主仓写权限只影响代码写回；服务器 token、SSH 或主机指纹只阻塞外部发布动作。

PR 标题、正文、评论、release 等 GitHub 文本默认中文并按 UTF-8 发送。创建或更新后必须回读；出现乱码时立即用 UTF-8 body 修正。不得为绕过编码问题改成英文。

## Worktree 与分支

未获用户明确许可，不创建、切换、删除分支或 worktree。

任务涉及多个 worktree 时：

- 先核对哪个 worktree 承载当前任务，哪些候选 worktree 已有相关脏改，哪个运行页/端口属于哪棵树。
- 两个以上候选都直接相关且无法唯一锁定时，停止并向用户确认。
- 专项 worktree 已承载该任务线最新分支、计划、evidence、运行页面或实现修改时，默认视为唯一实现真相源。
- 已并回 `main` 且工作树干净的专项 worktree，默认降级为历史现场；删除前必须同时满足“提交已并回 + 无未提交/未跟踪独有内容”。

发现根目录误改而专项 worktree 才是正确落点时，先回专项 worktree 读真相，再吸收或重做误改中有价值部分；不得把误改现场反向升级成主现场。

## 同步主线

协作者更新主线前先 fetch。干净 fast-forward 且无本地独有提交/脏改/待保留现场时可继续；否则先让用户选路线：

- 合并主线继续当前 PR：适合同一 PR 后续改动或必须叠在旧分支上。
- 从最新主线重开：适合旧 PR 已提交且后续不依赖旧现场。
- 暂缓同步：适合不确定现场归属或当前只想先提交/推送。

“从最新主线重开”不等于删除旧分支或覆盖旧工作区；必须用户确认旧现场可放弃或已有备份。

## Merge / 吸收 / 收口

用户说“合并 / 收口 / 同步回去 / 准备并回 main / 重新合并”时，默认先做内容裁定，不等于授权执行 merge。

必须先锁方向：

- `main -> 当前专项线`
- `当前专项线 -> main`
- `A 分支 -> B 分支`

只有同时满足以下条件，才执行 merge 命令：

- 用户当轮明确要求现在执行合并。
- 已锁定双方和方向。
- 已完成双边内容级比对，知道哪些吸收、哪些放弃、哪些双保留。
- 当前工作区没有未归属脏改会被误吞。

合并只能整合双边现有内容；如果开始按自己理解重写 UI、逻辑或测试，就已经变成新实施，必须重新锁定目标和验收。

`Your local changes would be overwritten by merge` 时：

- 未授权并入当前未提交改动：停下汇报具体文件，不 stash。
- 用户已明确同批提交：先审查未提交 diff，提交后再 merge。
- 未提交改动跨出当前目标或无法判断归属：停下，不借合并吞掉脏工作区。

## Git command guard

规范约束 AI；要拦命令本身，依赖仓库可控入口：

- `simple-git-hooks` 的 `pre-rebase` 原生硬拦 `git rebase`。
- `scripts/infra/git-command-guard.mjs` 可拦 `stash / restore / clean / rebase / pull --rebase / reset / revert / switch / checkout / 受控 branch/worktree`。

PowerShell 当前会话启用：

```powershell
. .\scripts\infra\enable-boardgame-git-guard.ps1
```

用户当轮明确授权危险 Git 动作时，必须显式留下绕过痕迹：

```powershell
$env:BOARDGAME_GIT_GUARD_BYPASS='1'
git rebase ...
```

guard 的目标是把高风险命令硬停到授权与裁决口径，不替代判断。
