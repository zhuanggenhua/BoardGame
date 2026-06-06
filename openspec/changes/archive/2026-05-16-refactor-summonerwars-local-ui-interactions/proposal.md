# Change: 重构 Summoner Wars 本地 UI 交互为引擎交互

## Why
Summoner Wars 目前仍保留多条“领域事件 / UI 按钮 -> 本地 mode 状态 -> 再 dispatch 业务命令”的链路。这些交互不进入 `sys.interaction`，导致：
- AI 看不到必须处理的后续交互，出现卡死、误跳过或只能靠 watchdog 止血
- 服务端/seat playerView 无法统一诊断“当前是否有待解决交互”
- UI 层维护多套本地状态机，违背项目对 `InteractionSystem` 的统一约束

## What Changes
- 将 Summoner Wars 中 AI 关键链路的本地 UI 交互迁移到 `InteractionSystem`
- 优先迁移会阻断 AI 或由领域事件触发的后续交互：感染、抓附跟随、灵魂转移、心灵捕获、寒冰碎屑、喂养巨食兽，以及同类 after-attack / after-move / active-event 跟进交互
- 为 Summoner Wars UI 提供统一的引擎交互消费层，逐步替换 `abilityMode` / `soulTransferMode` / `mindCaptureMode` / `grabFollowMode` / `useEventCardModes` 等本地状态机中的“等待玩家输入”职责
- 补齐 AI legal actions / hidden interaction / 真人保护审计与测试

## Impact
- Affected specs: `summonerwars-core`
- Affected code:
  - `src/games/summonerwars/ui/useGameEvents.ts`
  - `src/games/summonerwars/ui/useCellInteraction.ts`
  - `src/games/summonerwars/ui/useEventCardModes.ts`
  - `src/games/summonerwars/ui/StatusBanners.tsx`
  - `src/games/summonerwars/domain/**`
  - `src/games/summonerwars/ai.ts`
  - `src/engine/systems/InteractionSystem.ts`（如需补元数据/辅助函数）

## Non-Goals
- 不在本 change 内重写 Summoner Wars 全部普通阶段操作（如移动/攻击/建造的基础点击选择）
- 不修改 AI watchdog 的“只作用于 AI、不得误伤真人”总语义
- 不为了赶进度保留新的本地 mode 桥接层；若暂时兼容，必须明确迁移终点与清理条件
