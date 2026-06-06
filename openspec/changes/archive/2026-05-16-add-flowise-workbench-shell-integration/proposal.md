# Change: 落地 Flowise fork 并收敛为工作台主交互壳

## Why

`add-ai-repo-workbench` 已经完成“选择 Flowise 作为 fork 起点”的架构裁决，但把上游源码直接内嵌在 BoardGame worktree 里，会让仓库职责、启动脚本、证据文档和后续升级边界持续混乱。

本轮要把 Flowise fork 迁到独立仓，BoardGame 只保留外链基线、启动入口和规范/证据引用，避免继续把 `forks/flowise` 当成主仓的一部分维护。

## What Changes

- 将 Flowise fork 从 `BoardGame-wt-ai-repo-workbench/forks/flowise` 迁出到独立仓 `D:/gongzuo/webgame/flowise-fork/`
- 将 BoardGame 本地启动脚本入口改为调用外部仓 `boardgame/scripts/start-boardgame-local.ps1`
- 更新 AI Repo Workbench 基线、OpenSpec 与证据文档中的本地源码路径口径
- 清理 BoardGame worktree 中已迁出的 `forks/flowise/**` 内嵌源码落点

## Impact

- Affected specs: `ai-repo-workbench`
- Affected code:
  - `D:/gongzuo/webgame/flowise-fork/**`
  - `package.json`
  - `package-lock.json`
  - `src/features/ai-repo-workbench/flowiseForkBaseline.ts`
  - `openspec/changes/add-flowise-workbench-shell-integration/*`
  - `evidence/_shared/flowise-ai-repo-workbench-runtime-smoke.md`
  - `evidence/_shared/flowise-internal-chat-clear-fix.md`
