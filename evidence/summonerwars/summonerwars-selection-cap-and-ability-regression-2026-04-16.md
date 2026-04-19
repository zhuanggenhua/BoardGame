# Summoner Wars Selection Cap / Ability Regression Evidence

- 日期：2026-04-16
- 范围：
  - `src/games/summonerwars/ui/FactionSelectionAdapter.tsx`
  - `src/games/summonerwars/Board.tsx`
  - `src/games/summonerwars/ui/HandArea.tsx`
  - `src/games/summonerwars/ui/useCellInteraction.ts`
  - `e2e/summonerwars/summonerwars-selection.e2e.ts`
- 目标：
  - 修正阵营选择页在命中 `900px` cap 时 `inline-unit` 与逻辑舞台宽度不一致的问题。
  - 收紧 `holy_arrow` / `withdraw` 的 UI 交互限制，避免本地 UI 走到并不存在的 interaction option。

## 已通过验证

### 1. 900px cap 横屏视口
- 命令：
  - `npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars-selection.e2e.ts "mobile landscape capped viewport keeps faction selection inline unit synced to 900px stage"`
- 截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-selection.e2e\mobile-landscape-capped-viewport-keeps-faction-selection-inline-unit-synced-to-900px-stage\selection-phone-landscape-capped-entry.png`
- 我实际看到：
  - 手机横屏视口下，阵营选择页主舞台仍占满屏幕的物理宽度，但逻辑舞台宽度被收敛到 `900px`，没有继续按更宽逻辑宽度膨胀。
  - 新增断言已经直接检查 `stage.style.width === "900px"` 与 `--sw-selection-inline-unit === 9px`，证明 cap 生效后尺寸基准同步。
- 判定：
  - 达到“命中 900px cap 时 inline-unit 与逻辑舞台同源”的验收标准。

### 2. 既有横屏构图不回退
- 命令：
  - `npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars-selection.e2e.ts "mobile landscape keeps faction selection aligned with pc composition"`
- 截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-selection.e2e\mobile-landscape-keeps-faction-selection-aligned-with-pc-composition\selection-phone-landscape-entry.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-selection.e2e\mobile-landscape-keeps-faction-selection-aligned-with-pc-composition\selection-phone-landscape-both-picked.png`
- 我实际看到：
  - 阵营卡主区、预览区、玩家状态区仍维持原有 PC 同构层次，没有因为 cap 修正被误改成窄布局。
  - 双方选完后，下方预览图与状态卡仍完整处于屏幕内。
- 判定：
  - 达到“修 cap 不破坏既有横屏构图”的验收标准。

## 未通过项 / 当前阻塞

### 1. withdraw 收紧 E2E
- 命令：
  - `npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars-barbaric-abilities.e2e.ts "撤退：攻击后消耗充能移动"`
- 结果：
  - 当前隔离 Playwright runtime 下持续在该用例超时，未能拿到通过结果。
- 已观察到的现象：
  - 失败快照里可以看到 `撤退：选择消耗类型` 横幅已经出现，说明攻击后主链路至少进入了费用步骤。
  - 但这条现有 E2E 链路在继续推进到“点击费用 -> 落点 -> 完成移动”时仍会挂死，尚不能把它当作已收口证据。
- 判定：
  - 该项仍是 blocker，不能据此宣称 withdraw E2E 已完全收口。

### 2. holy_arrow 同名副本 E2E
- 命令：
  - `npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars-paladin-discard.e2e.ts "圣光箭：同名副本只允许选择真实 interaction option"`
- 结果：
  - 当前在线房间初始化链路超时，未能跑到断言阶段。
- 判定：
  - 该项也仍需后续继续排障，当前只能以实现修复 + 领域单测通过作为辅助证据，不能当作 E2E 收口。

## 辅助静态 / 单测门禁

- `npm run typecheck`：通过
- `node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/ui/__tests__/FactionSelectionAdapter.test.tsx --configLoader native --maxWorkers 1`：`13 passed`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-paladin.test.ts --configLoader native --maxWorkers 1`：`31 passed`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-barbaric.test.ts --configLoader native --maxWorkers 1`：`54 passed`
