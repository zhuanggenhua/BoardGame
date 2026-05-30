# 冲突解决汇报：feat/smashup-yuanhou-factions

## 1. 背景
- base: `main`
- head: `feat/smashup-yuanhou-factions`
- 当前状态: `MERGE_HEAD` 存在，说明本次仍是未提交的 merge 收口
- 目标: 把猿猴四派系及其依赖改动完整合入 `main`，解决冲突后删除旧分支与旧 worktree

## 2. 本次确认处理的高风险文件
- `public/locales/en/game-smashup.json`
- `public/locales/zh-CN/game-smashup.json`
- `src/games/smashup/abilities/index.ts`
- `src/games/smashup/abilities/titans.ts`
- `src/games/smashup/abilities/tricksters.ts`
- `src/games/smashup/ai.ts`
- `src/games/smashup/data/cards.ts`
- `src/games/smashup/domain/abilityHelpers.ts`
- `src/games/smashup/domain/atlasCatalog.ts`
- `src/games/smashup/domain/externalActionPlay.ts`
- `src/games/smashup/domain/extraPlay.ts`
- `src/games/smashup/domain/ids.ts`
- `src/games/smashup/domain/index.ts`
- `src/games/smashup/domain/ongoingEffects.ts`
- `src/games/smashup/domain/reactionSession.ts`
- `src/games/smashup/domain/reduce.ts`
- `src/games/smashup/domain/reducer.ts`
- `src/games/smashup/domain/types.ts`
- `src/games/smashup/ui/DeckDiscardZone.tsx`
- `src/games/smashup/ui/PromptOverlay.tsx`
- `src/games/smashup/ui/factionMeta.ts`
- `src/games/smashup/ui/interactionMode.ts`
- `src/games/smashup/ui/useGameEvents.ts`
- `src/games/smashup/ui/BaseZone.tsx`
- `src/games/smashup/ui/MeFirstOverlay.tsx`
- `src/server/storage/HybridStorage.ts`
- `src/server/storage/MongoStorage.ts`
- `src/services/matchApi.ts`

## 3. 解决策略
- locale 文件做块级合并，保留 `main` 已有文案并补入猿猴四派系与基地条目，不做整份单边覆盖。
- SmashUp 核心规则文件优先对齐旧 worktree 当前版本，避免 `main` 偏置导致猿猴四派系的 ongoing/reaction 语义只合进半套。
- 额外追补的语义文件：
  - `src/games/smashup/abilities/ongoing_modifiers.ts`
  - `src/games/smashup/abilities/vikings.ts`
  - `src/games/smashup/abilities/samurai.ts`
  - `src/games/smashup/abilities/cthulhu.ts`
  - `src/games/smashup/abilities/elder_things.ts`
  - `src/games/smashup/abilities/bear_cavalry.ts`
  - `src/games/smashup/abilities/steampunks.ts`
  - `src/games/smashup/abilities/princesses.ts`
  - `src/components/game/framework/widgets/GameHUD.tsx`
  - `src/pages/MatchRoom.tsx`
- 原因:
  - `ongoing_modifiers.ts` 缺失猿猴四派系 copied power / attached action power surface 适配，导致 `yuanhouFactionAbilities.test.ts` 15 条失败。
  - 多个老派系 trigger 注册仍保留旧 `playerContext`，导致 `reactionQueueEventPlayerContext.test.ts` 24 条失败。
  - `GameHUD.tsx` 与 `MatchRoom.tsx` 未完全对齐旧 worktree 时，E2E 首次加载出现过白屏；对齐后配合 Vite 依赖预构建稳定通过。

## 4. 风险评估
- 主要风险仍在 SmashUp 共享 UI 壳层与长链 reaction/ongoing 规则。
- 已用最集中的两组单测和两条真实入口 E2E 做回归，当前没有继续扩散的证据。
- 仍未对整仓所有新增测试做全量回归；本次以“收掉 merge + 验证猿猴四派系关键链路”为边界。

## 5. 验证清单
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
  - 结果: `256 passed`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/reactionQueueEventPlayerContext.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
  - 结果: `149 passed`
- `npm run test:e2e:ci:file -- e2e/smashup-yuanhou-factions.e2e.ts "超级间谍-Secret Agent-真实入口会让行动玩家自己选择弃掉剩余手牌"`
  - 结果: `1 passed`
- `npm run test:e2e:ci:file -- e2e/smashup-yuanhou-factions.e2e.ts "时间旅行者-Time Walk-真实入口会抽两张、把本牌沉到底并授予本回合额外随从与额外行动额度"`
  - 结果: `1 passed`

## 6. 行为变化登记
- 原 PR/分支目标:
  - 猿猴四派系数据、规则、E2E、审计证据整体并入
- 本次额外发现并修复的真实回归:
  - copied power / attached action power surface 未完整带入
  - 多个老派系 queued trigger 的 `playerContext` 仍停留在旧语义
  - 真实入口 E2E 首轮运行触发前端依赖预构建重载；稳定后已通过

## 7. 最终提交信息
- 待本次 merge commit 完成后回填
