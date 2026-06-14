# Change: Summoner Wars 交互迁移至 InteractionSystem（AI 可见）

## Why
Summoner Wars 当前存在一批“领域事件 → UI 本地 mode”的交互链路（如 SUMMON_FROM_DISCARD_REQUESTED / GRAB_FOLLOW_REQUESTED / SOUL_TRANSFER_REQUESTED / MIND_CAPTURE_REQUESTED / ice_shards_damage / feed_beast_check）。这些交互不进入 `sys.interaction`，导致：
- AI 在共享态看不到交互，无法生成合法动作（卡死/循环/只能靠 watchdog 兜底）
- 真人交互与 AI 交互路径分叉，难以统一审计
- 本地 UI 模式成为规范明确的“历史债务/反模式”（engine-systems 指出 SummonerWars abilityMode）

## What Changes
- 将上述本地 UI 交互迁移为 InteractionSystem 交互（simple-choice / multistep-choice）。
- 交互数据只对 owning player 可见（playerView 过滤），同时提供取消/跳过/默认收口路径。
- UI 从 InteractionSystem 读取交互并渲染（不再以本地 mode 作为真相源）。
- AI legal actions 直接消费 InteractionSystem 描述，确保可解性。
- 补齐相关测试与审计证据。

## Impact
- Affected specs: `summonerwars-core`（新增“交互必须进入 InteractionSystem”要求）
- Affected code (planned):
  - `src/games/summonerwars/domain/*`
  - `src/games/summonerwars/ui/useGameEvents.ts`
  - `src/games/summonerwars/ui/useCellInteraction.ts`
  - `src/games/summonerwars/ai.ts`
  - `src/engine/systems/InteractionSystem.ts`（如需扩展描述字段）
- Risk/Notes:
  - 交互阻塞语义变强，必须确保不误伤真人流程
  - 交互选项需严格过滤，避免信息泄露或空选项卡死
