# 冲突解决汇报：PR50

## 1. 背景
- base: `origin/main` @ `12c881cfa3a919bf7e86a57d03a586ba0034b0e5`
- head: `codex/smashup-pod-four-factions` @ `3175113728068c3717b645c7ae1209ce4e02713c`
- 触发命令: `git merge origin/main --no-commit --no-ff`
- 任务目的: 把 `PR #50` 同步到最新 `main`，消除 GitHub `CONFLICTING / DIRTY`，并保留本 PR 的 POD 派系与共享泰坦实现。

## 2. 冲突文件
- `src/games/smashup/domain/atlasCatalog.ts`

## 3. 自动合并后重点审计文件
- `public/locales/en/game-smashup.json`
- `public/locales/zh-CN/game-smashup.json`
- `src/games/smashup/__tests__/factionSelection.test.ts`
- `src/games/smashup/domain/atlasCatalog.ts`

## 4. 解决策略
### `src/games/smashup/domain/atlasCatalog.ts`
- 策略：保留 `main` 的 POD 图集路径约定，并把 `PR #50` 新增的 atlas ID 映射合并进同一张表。
- 合并要点：
  - 保留 `main` 已切换成的相对资源路径格式，如 `smashup/cards/tts_atlas_1`。
  - 补回 `PR #50` 新增的 `tts_atlas_54`、`55`、`56`、`78`、`79`、`8789f47742`。
  - 不回退 `main` 的默认 fallback：`smashup/pod-assets/${atlasId}`。
- 原因：
  - `main` 已经统一了 Critical Image / atlas 解析约定，不能被旧的绝对路径写法覆盖回去。
  - `PR #50` 需要新增 POD 卡图与共享泰坦图集映射，必须完整保留新增 atlas。

## 5. 风险与验证
- 风险点：
  - POD 图集路径合并错误会导致 Smash Up 牌面或共享泰坦预热失败。
  - `main` 与 `PR #50` 同时改到 `bury` / `factionSelection` 测试，若自动合并丢断言，可能出现 startTurn 窗口或 POD 选秀回归。
  - 先前对 `Deputy` 与四人局 smoke 的修复若在同步 `main` 后被覆盖，会重新引入决斗链路或测试构造错误。
- 验证命令：
  - `node .\node_modules\eslint\bin\eslint.js src/games/smashup/domain/ongoingEffects.ts src/games/smashup/domain/duel.ts src/games/smashup/abilities/samurai.ts src/games/smashup/__tests__/smashup.smoke.test.ts`
  - `node .\node_modules\vitest\vitest.mjs run src/games/smashup/__tests__/criticalImageResolver.test.ts --configLoader native`
  - `node .\node_modules\vitest\vitest.mjs run src/games/smashup/__tests__/factionSelection.test.ts -t "Ancient Egyptians POD" --configLoader native`
  - `node .\node_modules\vitest\vitest.mjs run src/games/smashup/__tests__/buryEngine.test.ts -t "at startTurn, uncovering a buried onTurnStart minion should still resolve in the same window" --configLoader native`
  - `node .\node_modules\vitest\vitest.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts -t "cowboys_deputy" --configLoader native`
  - `node .\node_modules\vitest\vitest.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts -t "AI legal actions 支持四人局派系选择" --configLoader native`
  - `npm run merge:audit -- HEAD`
  - `npm run merge:audit:strict -- HEAD`
- 验证结果：
  - ESLint：0 error，只有既有 warning。
  - Vitest：上述 5 组 Smash Up 定向测试全部通过。
  - Merge audit：4 个审计文件全部为“混合结果”，`完全等于父1/父2` 都是 0。

## 6. 回归与行为变化登记
- 原 PR 目标问题：
  - 补齐 `Ancient Egyptians / Samurai / Cowboys / Vikings POD` 数据、共享泰坦与相关图集、locale、测试。
  - 修复 `Deputy` 在 POD 决斗链路中的识别缺口。
  - 修复 `smashup.smoke` 中四人局 `playerIds` 没有真正传入 `GameTestRunner` 的问题。
  - 修复 `ongoingEffects.ts` 非法空白字符导致的 `quality-gate` 失败。
- 本次额外发现的真实回归：
  - `samuraiRoninOnPlay()` 中保留了一段 `return` 后的死代码；已删除，避免后续维护者误判真实行为。
- 仅业务口径 / 规则变化：
  - 无。本次没有新增规则口径变更，也不需要额外同步 `rule/` 或 `.spec/knowledge/standards/`。

## 7. 结果
- 合并提交：`afab2a8f885647604644bbfe9fadf4a0081104fa`
- 推送目标：`deathcats4/codex/smashup-pod-four-factions`
