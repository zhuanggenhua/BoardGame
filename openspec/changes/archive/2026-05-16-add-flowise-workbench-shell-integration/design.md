## Context

当前 AI Repo Workbench 已明确选择 Flowise 作为上游宿主基线，但最初的落地方式是把 fork 直接 vendor 到 `forks/flowise/`，导致 BoardGame worktree 同时承担了：

- 工作台业务代码
- 上游 Flowise fork 源码
- 启动脚本与路径基线说明

这会放大两个问题：

1. BoardGame 仓库职责被上游 fork 污染，删除/移动时 diff 面极大。
2. 后续如果要单独维护、推送、升级 Flowise fork，很难和 BoardGame 业务改动解耦。

## Goals

- 把 Flowise fork 从 BoardGame worktree 迁到独立仓 `D:/gongzuo/webgame/flowise-fork/`
- 保持 AI Repo Workbench 的本地开发入口可用
- 让 BoardGame 仅保留外链基线与业务侧接线，不再内嵌上游源码
- 为后续单独维护 Flowise fork 的提交、推送和升级留出清晰边界

## Non-Goals

- 本次不要求重新实现工作台业务逻辑
- 本次不要求重跑完整 Flowise UI/服务端联调
- 本次不处理其他仍在演进中的 ai-repo-workbench 功能改动

## Decisions

- 决定 1：Flowise fork 固定落点改为 `D:/gongzuo/webgame/flowise-fork/`
  - 原因：独立仓才能直接走自己的提交、推送、升级节奏，不再绑在 BoardGame worktree 上

- 决定 2：BoardGame 通过外部脚本路径启动 Flowise 本地环境
  - 原因：保留现有本地工作流，同时避免在 BoardGame 内重复存放启动脚本副本

- 决定 3：BoardGame 继续以 `flowiseForkBaseline.ts` 作为业务侧单一真实来源
  - 原因：工作台其他代码不需要感知迁仓细节，只需要知道固定外链路径与上游基线元信息

## Risks / Trade-offs

- `../flowise-fork` 是本地固定路径约定，后续若目录迁移，需要同步更新基线与脚本
- 本次只做迁仓与引用切换，不等于已经重新完成一轮完整运行时回归
- 独立仓与 BoardGame 仓的提交节奏分离后，需要明确“先改哪边、再回填哪边”的操作纪律

## Migration Plan

1. 将 `forks/flowise/` 整体迁出到独立仓 `D:/gongzuo/webgame/flowise-fork/`
2. 将独立仓推到 GitHub 主分支，确保不再依赖临时迁移分支
3. 回填 BoardGame 的启动脚本入口与基线路径
4. 清理 BoardGame worktree 中已迁出的内嵌 fork 目录
5. 用静态校验确认 BoardGame 不再硬引用 `forks/flowise`
