# #95 合并主线冲突审计

## 对象

- PR：#95 `实装 Smash Up 漫威反派四派与共享图集资源`
- head：`codex/upstream-main-dev-20260707`
- base：`origin/main`
- 执行位置：`.tmp/pr95-merge-20260714-110815`

## 冲突范围

本次同步主线时出现 12 个真实冲突：

- `public/assets/i18n/assets-manifest.json`
- `public/assets/i18n/zh-CN/smashup/assets-manifest.json`
- `public/locales/en/game-smashup.json`
- `public/locales/zh-CN/game-smashup.json`
- `src/games/smashup/data/cards.ts`
- `src/games/smashup/domain/abilityHelpers.ts`
- `src/games/smashup/domain/atlasCatalog.ts`
- `src/games/smashup/domain/commands.ts`
- `src/games/smashup/domain/ids.ts`
- `src/games/smashup/domain/ongoingEffects.ts`
- `src/games/summonerwars/ui/BoardGrid.tsx`
- `src/games/summonerwars/ui/StatusBanners.tsx`

## 裁决

- 保留 #95 的漫威反派四派系、共享图集资源与对应注册入口。
- 保留主线已合入的 POD、Pretty Pretty、Cease and Desist 等 Smash Up 注册、文案、图集与能力修复。
- JSON 清单与 locale 文件按对象键递归合并；同 key 且值不同的 `zh-CN/summonerwars/hero/mogu/compressed/cards.variants.webp` hash/bytes 采用主线版本。
- Smash Up 领域冲突按双边有效逻辑合成：
  - `canControllerPlayTitan` 保留主线对同控制者多泰坦、Red Trooper POD 双泰坦上限的逻辑。
  - `validateManualSpecialScoringBase` 保留主线按 defId 判断 `anyBase` special 来源范围的逻辑。
  - `ongoingEffects` 保留主线对 base VP modifier POD alias 重复注册的防护。
- Summoner Wars UI 冲突按使用点保留：
  - `BoardGrid.tsx` 保留主线新增的 charge marker 样式常量，因为下方渲染已使用。
  - `StatusBanners.tsx` 保留 #95 已使用的 `getAbilityModeBannerFallbackText` import，删除冲突块中的重复 import。

## 验证

- `npm run i18n:check`
- `git diff --check`
- `npx tsc --noEmit --incremental false`
- `npx vitest run src/games/smashup/__tests__/abilities/marvel-villains.test.ts src/games/smashup/__tests__/marvelVillainsResourceContract.test.ts src/games/smashup/__tests__/marvelResourceContract.test.ts src/games/smashup/__tests__/abilities/marvel.test.ts --config vitest.config.core.ts --pool forks --no-file-parallelism --maxWorkers 1`
- `npx vitest run src/games/smashup/__tests__/factionSelection.test.ts src/games/smashup/__tests__/smashup.smoke.test.ts src/games/smashup/__tests__/ongoingEffects.test.ts src/games/smashup/__tests__/reactionQueueFireTriggersCallerContract.test.ts src/games/smashup/__tests__/reactionSessionResponseActionTargetContext.test.ts --config vitest.config.core.ts --pool forks --no-file-parallelism --maxWorkers 1`
- `npx vitest run src/games/summonerwars/__tests__/useGameEvents.test.ts src/games/summonerwars/__tests__/useGameEvents.rollback.test.tsx src/games/summonerwars/ui/__tests__/DiceResultOverlay.test.tsx --config vitest.config.core.ts --pool forks --no-file-parallelism --maxWorkers 1`
