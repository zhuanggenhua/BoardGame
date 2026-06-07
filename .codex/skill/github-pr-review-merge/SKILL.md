---
name: github-pr-review-merge
description: "BoardGame 对全局 github-pr-review-merge 的项目补充层。用于把通用 PR 审查/修复/合并流程收紧到本仓库的 worktree、权限判定、终态和收口要求。"
---

# BoardGame PR Review Merge Overlay

> 先使用全局 `github-pr-review-merge`，本文件只补充 BoardGame 项目差异，不重复维护通用 PR workflow 正文。

## 适用范围

当本项目中的任务涉及以下内容时使用本补充 skill：

- 审查 GitHub PR
- 修复 PR 中的问题
- 把修复推回 PR 分支
- 合并 PR
- 清理中间 PR / 临时 PR

如果只是普通代码解释、单纯本地调试或不涉及 PR 生命周期，则不使用本补充 skill。

## 项目默认终态

除非用户明确要求停在某一步，否则本项目里处理 PR 的默认终态必须是：

1. 原始 PR 已 merge
2. 原始 PR 已关闭
3. 不存在仍然打开、等待用户手动点按钮的中间 PR

不合格的收尾方式包括：

- “我已经推了，你去点 merge”
- “我已经修好了，等你手动关 PR”
- “我新开了一个 merge PR，你自己收尾”

## 默认流程

1. 读取原始 PR、review threads、机器人评论、CI 状态，并额外确认 `head repo / head ref / head sha / maintainerCanModify`
2. 读取仓库根 `AGENTS.md` 和相关规范
3. 若为跨仓库 PR，先确认当前执行身份对 `head repo` 的真实权限；**不能只看** `maintainerCanModify=true`
4. 先做静态审查，形成 **findings 草案**，但不要急着把 blocking review 提交到 GitHub
5. 若原始 PR head 可写，且用户目标是“修完并合并”：
   - 优先判断是否需要隔离 worktree
   - 主工作区已脏、PR 与 `main` 漂移较大、或预判有冲突风险时，默认直接创建/使用该 PR 的隔离 worktree
   - 先在隔离 worktree 中修复 blocking 问题并补验证
   - 修复后直接 push 回原 PR head 分支
6. 若跨仓库 PR 真实权限验证显示 `push=false`，必须立即改走 fallback；常见 fallback 为：把修复后的 PR 内容直接收口到主仓库可写分支，再关闭原 PR
7. push 成功后再更新最终 review 结论；门禁满足则继续执行 merge
8. 检查最终状态，确认原始 PR 已关闭

## 真实写权限判定（强制）

- `maintainerCanModify=true` 只能说明“作者允许维护者修改”，**不能单独当作可写证明**。
- 对 fork / 跨仓库 PR，进入“推回原 PR head”前，至少满足其一：
  - GitHub API 明确返回当前身份对 `head repo` 具有 `push: true`
  - 已完成一次真实写操作验证（例如成功 push 到 `head ref`）
- 若 API 返回 `push: false`、写操作失败、或 token/网络链路无法证明可写：
  - 不得继续假定“稍后应该能 push”
  - 必须向用户明确说明：当前是**真实写权限不足**，不是单纯流程未跑完
  - 并切到用户确认过的 fallback 路线

## review 提交时机（强制）

- **默认禁止“先发 blocking review 再说”**：如果 PR 可写、问题范围可控、且用户目标是合并，则应优先直接修复，不把 `REQUEST CHANGES` 当默认起手。
- 可以先在本地或临时文档里整理 `Findings`，但只有在以下场景才向 GitHub 提交 blocking review：
  - 用户明确要求“只审查”
  - `maintainerCanModify=false`、GitHub API / 实际写入验证显示 `push=false`、fork 权限受限，或 push 回原 PR head 失败
  - 已尝试自动修复，但仍有 blocker 无法消除
  - 需要显式阻止误合并，且暂时无法继续代修
- 若问题已被你直接修好并推回原 PR head，则最终 review 应反映“已修复并可 merge”，而不是保留过时的阻塞性结论

## 中间分支 / worktree 规则

- `worktree`、`merge-main/*`、临时验证分支都只是执行手段，不是最终交付物
- 默认不创建中间 PR
- 当仓库根目录主工作区已脏，或 PR 与 `main` 改动面明显交叠时，**默认允许为该 PR 创建隔离 worktree**；这属于本 workflow 的正常执行手段，不需要再把“能不能建 worktree”当成额外 blocker
- 若已有明确服务该 PR 的 worktree，优先复用；若没有，就按 PR 号/分支名新建一个隔离 worktree
- 如果因为历史流程、平台限制或已有工作区而使用了中间分支，结束时也不能把用户留在“还要手动 merge / close”的状态

## 允许停止的情况

只有以下情况可以不 merge：

- 用户明确说只审查或只推送
- 权限不足，无法对原始 PR 执行 merge
- 分支保护、必需审批、CI 门禁尚未满足
- 仍存在未解决的 blocking findings

此时必须明确汇报：

- 为什么不能 merge
- 卡在哪个门禁
- 还差哪一步

## 输出要求

仍然使用统一结构：

- `Findings`
- `Open Questions / Assumptions`
- `Summary`

但 `Summary` 里必须额外写清：

- 原始 PR 是否已 merge
- 原始 PR 是否已关闭
- 是否还存在任何中间 PR 或人工收尾步骤
