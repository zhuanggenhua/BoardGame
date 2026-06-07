# 冲突解决汇报：feat/smashup-yuanhou-factions

## 1. 背景
- base: `main`
- head: `feat/smashup-yuanhou-factions`
- 合并触发状态: 当时 `MERGE_HEAD` 存在，本次在 `main` 上完成未提交 merge 的最终收口
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
- commit: `358ef5f6506b8c6cb20c097040537806b2bcc9fd`
- 分支: `main`
- 提交标题: `合并猿猴四派系并收口 SmashUp 规则与交互回归`

## 8. Addendum（2026-06-06）：赛博守护者回归根因与门禁漏检复盘
- 用户追问“赛博守护者为什么没有效果”后，已在当前主工作树重新定位并修复：真正丢失的是 `src/games/smashup/Board.tsx` 内承接 `Cyberback` 弃牌持续行动真实入口的 shared UI seam，而不是 `yuanhou.ts` 规则本体缺失。
- 直接证据：
  - feature 分支提交 `a391958e` 与 `787ad147` 都修改过 `src/games/smashup/Board.tsx`。
  - merge commit `358ef5f6` 的结果中，`src/games/smashup/Board.tsx` blob 与父1 `main` 完全相同，与父2 `feat/smashup-yuanhou-factions` 不同。
  - 因而 `cyberbackDiscardActionOptions`、`play_action_to_cyberback`、`cyberbackDiscardTargetUids` 以及弃牌堆持续行动到宿主随从的真实入口没有被带进主线。
- 为什么当时没从审计留档里看出来：
  - 本文第 2 节“高风险文件”列了 `DeckDiscardZone`、`PromptOverlay`、`BaseZone`，但没有列真正的入口汇总层 `src/games/smashup/Board.tsx`。
  - 第 5 节验证只抽测了 `Secret Agent` 与 `Time Walk` 两条代表 E2E，没有覆盖 `Cyberback` 这条 shared interaction family 的对象级真实入口。
  - 旧 evidence 当时虽然声称 `Cyberback` 有真实入口，但截图说明仍写成“点击基地后”，而当前真实交互载体其实是“点击被高亮的赛博守护者宿主”；这让旧 E2E 和旧留档一起变成了 stale 证据。
- 为什么 `pre-push` 也没拦住：
  - `quality:changed:pre-push` 运行的是 `scripts/infra/run-changed-quality-gate.mjs pre-push`，其日志口径本来就是“pre-push 最新提交范围模式”，对游戏源码改动不再默认回归整游戏全量测试。
  - 当次 merge 的增量门禁没有自动强制跑 `e2e/smashup-yuanhou-factions.e2e.ts` 里的 `Cyberback` 对象级用例，只抽到了代表性 smoke / 指定用例。
  - 更关键的是，旧 merge 守卫要求 merge commit message 里显式记录 `Conflicts:`/`# path` 才会进入严格冲突审计；而 `358ef5f6` 的提交信息没有这类文件列表，导致守卫直接跳过。
  - 旧独立审计脚本的 fallback 还存在算法盲区：它只审计“最终结果相对双亲都发生变化”的文件，像 `Board.tsx` 这种“最终结果完全退回父1”的文件会天然从候选集合里消失。
- 本轮已补：
  - 当前主工作树已补回 `Board.tsx` 的 `Cyberback` 真实入口，并通过对象级 E2E 复跑。
  - merge 审计脚本与 `pre-push` 包装已收紧为“无冲突文件列表时，退化审计 merge-base 到双亲都改过的重叠文件”，用于拦截这类单边吞并式回归。
