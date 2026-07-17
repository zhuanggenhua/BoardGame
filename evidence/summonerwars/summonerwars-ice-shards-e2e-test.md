# 召唤师战争 - 寒冰碎屑自动结算 E2E 证据

## 本轮规则口径

- 目标对象：贾穆德「寒冰碎屑」（`ice_shards`）。
- 用户原始症状：有人反馈寒冰碎屑在魔力阶段触发且没有效果；旧截图只证明出现“确认 / 跳过”提示，没有证明伤害结果。
- 本轮裁定：寒冰碎屑应在攻击阶段开始时自动触发；不应出现确认、跳过或是否执行选择；结算后应消耗 1 点充能，并对每个与友方建筑相邻的敌方单位造成 1 点伤害。
- 当前用户故事：`docs/games/summonerwars/user-stories/ice-shards-attack-start-auto-2026-07-17.md`。

## 测试用例

- 最小真实页面用例：`e2e/summonerwars/summonerwars-ice-shards-minimal.e2e.ts`
  - 用例名：`寒冰碎屑：攻击阶段开始自动结算伤害且不出现确认跳过`
  - 断言：从建造阶段点击结束阶段进入攻击阶段；当前阶段为攻击阶段；没有寒冰碎屑选择交互；交互队列为空；敌方单位伤害从 0 变 1；贾穆德充能从 2 变 1。
- 极地矮人补充用例：`e2e/summonerwars/summonerwars-frost-abilities.e2e.ts`
  - 用例名：`寒冰碎屑：攻击阶段开始消耗充能对建筑相邻敌方造成伤害`
  - 用例名：`寒冰碎屑：充能不足时不触发伤害也不出现选择`

## 关键截图与观察

### 1) 建造阶段触发前

- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-ice-shards-minimal.e2e\寒冰碎屑：攻击阶段开始自动结算伤害且不出现确认跳过\01-寒冰碎屑-建造阶段触发前.jpg`
- 观察：页面仍在建造阶段，棋盘上已布置贾穆德、友方建筑和建筑相邻敌方单位。
- 结论：这是从真实页面阶段推进前开始，不是直接注入结算后状态。

### 2) 攻击阶段开始自动伤害结果

- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-ice-shards-minimal.e2e\寒冰碎屑：攻击阶段开始自动结算伤害且不出现确认跳过\02-寒冰碎屑-攻击阶段开始自动伤害结果.jpg`
- 观察：右侧阶段条停在「攻击」，没有出现寒冰碎屑确认、跳过或选择提示。
- 观察：E2E 状态断言确认敌方单位伤害为 1，贾穆德充能为 1；这证明结果已经落位，不只是提示出现。
- 结论：该截图和状态断言满足“攻击阶段开始自动触发并造成结果”的验收口径。

## 失效证据

- 旧目录 `build-结束时出现-confirm-skip-选择` 和旧用例 `寒冰碎屑：攻击阶段开始提示未处理时不能进入魔力阶段` 只证明错误的确认/跳过交互存在。
- 这些旧截图不得再作为寒冰碎屑正确规则证据；本轮以后只以“无选择 UI + 自动伤害/充能结果”作为收口证据。

## 验证命令

- `node scripts\infra\vitest-cli-safe.mjs run src\games\summonerwars\__tests__\interaction-chain-comprehensive.test.ts --configLoader native -t "ice_shards"`：通过，4 passed。
- `node scripts\infra\vitest-cli-safe.mjs run src\games\summonerwars\__tests__\abilities-frost.test.ts --configLoader native -t "寒冰碎屑|ice_shards"`：通过，5 passed。
- `node scripts\infra\vitest-cli-safe.mjs run src\games\summonerwars\__tests__\abilities-phase-triggered.test.ts --configLoader native -t "ice_shards"`：通过，6 passed。
- `node scripts\infra\vitest-cli-safe.mjs run src\games\summonerwars\__tests__\entity-chain-integrity.test.ts --configLoader native -t "ice_shards"`：通过，2 passed。
- `node scripts\infra\vitest-cli-safe.mjs run src\games\summonerwars\__tests__\flow.test.ts --configLoader native -t "flowHalted 的阶段结束技能应优先暴露交互选项"`：通过，1 passed。
- `node scripts\infra\vitest-cli-safe.mjs run src\games\summonerwars\__tests__\useGameEvents.test.ts --configLoader native -t "infection / feed_beast"`：通过，1 passed。
- `node scripts\infra\run-e2e-command.mjs ci e2e/summonerwars/summonerwars-ice-shards-minimal.e2e.ts --grep "寒冰碎屑：攻击阶段开始自动结算伤害且不出现确认跳过"`：通过，1 passed。
- `node scripts\infra\run-e2e-command.mjs ci e2e/summonerwars/summonerwars-frost-abilities.e2e.ts --grep "寒冰碎屑"`：通过，2 passed。
- `npx eslint ...` 针对本轮相关文件：0 errors；剩余 warning 为既有未清理 warning。
