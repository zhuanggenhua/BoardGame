## Context

当前 `fantasyrealms` 已经有两块核心能力：

- 双人变体抽弃循环
- 官方正式计分

但玩家人数层还是断的：2 人可以按变体玩，3~6 人完全不能开局。既然正式计分已经落地，再继续只做双人壳子没有意义，下一步就该把基础版标准流程接上。

## Goals / Non-Goals

- Goals:
  - 保留 2 人变体规则
  - 新增 3~6 人基础版 setup、抽弃循环和结束裁定
  - 更新 manifest / engine player count 边界
  - 让 Board 文案和按钮根据当前模式切换
- Non-Goals:
  - 不在本轮开启 `enabled`
  - 不在本轮加入 AI
  - 不在本轮做多人联机专项 UI 优化

## Decisions

- Decision: 用玩家人数推导模式，而不是再引入独立房间规则开关
  - Why: 当前官方规则已经把 2 人与 3~6 人明确按人数分成两套；对现阶段实现来说，用 `playerIds.length === 2` 区分最直接。

- Decision: 基础版仍复用现有 `DRAW_FROM_DECK / TAKE_FROM_DISCARD / DISCARD_CARD`
  - Why: 命令种类不需要变化，变化的是 setup、drawCount、discard requirement 与结束阈值。

- Decision: `manifest` 先开放 2~6 人选项，但保持 `enabled: false`
  - Why: 这能让运行时和 generated manifests 进入真实多人边界，同时不把它误表述成已经正式上架。

## Risks / Trade-offs

- Risk: Board 当前主要围绕双人文案写的，接入多人后若不改，会继续误导玩家
  - Mitigation: 本轮同步改 `getDrawDeckLabel()` / `getStageSummary()` / 结束阈值说明。

## Migration Plan

1. 新增 `fantasyrealms-standard-flow` change。
2. 实现 setup / drawCount / discard requirement / end threshold 的按人数切换。
3. 更新 manifest、Board 与测试。
