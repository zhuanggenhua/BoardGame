# 幻想国度基础版多人流程任务

> 说明：当前仓库里可能已经存在基础版多人流程相关的探索实现与验证记录；在 `0.1` 未完成前，它们只能算“草案对应的探索产物”，不能按正式 change 收口。

## 0. Approval Gate
- [x] 0.1 用户明确批准 `add-fantasyrealms-standard-multiplayer-flow` 的范围与边界

## 1. Domain flow
- [x] 1.1 为 3~6 人对局实现基础版 setup：开局各发 7 张手牌
- [x] 1.2 按人数切换抽牌数、弃牌要求与结束阈值
- [x] 1.3 在基础版结束态用正式计分裁出胜者/平局

## 2. Runtime surface
- [x] 2.1 更新 `manifest.ts` 与 `game.ts` 的玩家人数边界
- [x] 2.2 更新 Board 文案，使其能区分双人变体与基础版

## 3. Verification
- [x] 3.1 更新/新增领域测试，覆盖基础版 setup 与流程
- [x] 3.2 运行 `openspec validate add-fantasyrealms-standard-multiplayer-flow --strict --no-interactive`
- [x] 3.3 运行 `npx vitest run` 的 fantasyrealms 定向测试集
- [x] 3.4 运行 `npm run generate:manifests`
