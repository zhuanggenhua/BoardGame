# DiceThrone E2E 重写记录

## 结论

- `e2e/dicethrone/dicethrone.e2e.ts` 已收敛为 3 个基于 `GameTestContext + setupScene + TestHarness` 的核心用例。
- 2026-03-28 本地复跑通过：`e2e/dicethrone/dicethrone.e2e.ts` **3/3 passed**。
- 本轮没有再走旧的在线房间/教学长链路，而是改成可控的本地测试场景，避免之前的随机性和无关流程噪音。

## 当前用例

1. `main flow: moon elf reaches defensive roll`
   - 直接构造 Moon Elf `longbow-5-1` 待结算攻击
   - 验证 `offensiveRoll -> defensiveRoll` 转换
   - 断言 `pendingAttack` 的 attacker / defender / ability / damage

2. `regression: targeted adds 2 damage and removes after hit`
   - 构造 `TARGETED` 目标与 `longbow-3-1`
   - 验证结算后目标生命从 `50 -> 45`
   - 验证 `TARGETED` 在触发 +2 伤害后被移除

3. `ui stability: die lock toggle syncs state`
   - 点击骰子锁定/解锁
   - 验证 TestHarness 状态同步变化

## 本轮关键修正

- 第一条主流程用例不再依赖不稳定的“预置骰面后再走整段确认/选技 UI”链路；
  改为直接构造 `pendingAttack`，聚焦验证真正要保的阶段迁移与攻击数据。
- `targeted` 回归用例不再伪造一个未完成的 `defensiveRoll` 场景；
  改为从可直接结算的 `offensiveRoll` 进入，避免无效防御态导致的假失败。
- 保留一条真实 UI 交互用例（骰子锁定切换），确保不是纯状态补丁测试。

## 验证命令

```bash
$env:PW_USE_DEV_SERVERS='true'
$env:PW_ALLOW_FULL_RUN='true'
$env:VITE_DEV_PORT='6173'
$env:PW_GAME_SERVER_PORT='20000'
$env:GAME_SERVER_PORT='20000'
$env:API_SERVER_PORT='21000'
npx playwright test e2e/dicethrone/dicethrone.e2e.ts --workers=1
```

## 验证结果

```text
Running 3 tests using 1 worker
  ok 1 [chromium] › e2e\dicethrone\dicethrone.e2e.ts › main flow: moon elf reaches defensive roll
  ok 2 [chromium] › e2e\dicethrone\dicethrone.e2e.ts › regression: targeted adds 2 damage and removes after hit
  ok 3 [chromium] › e2e\dicethrone\dicethrone.e2e.ts › ui stability: die lock toggle syncs state

  3 passed
```

## 截图证据

- `test-results/evidence-screenshots/dicethrone/dicethrone.e2e/main-flow-moon-elf-reaches-defensive-roll/`
- `test-results/evidence-screenshots/dicethrone/dicethrone.e2e/regression-targeted-adds-2-damage-and-removes-after-hit/`
- `test-results/evidence-screenshots/dicethrone/dicethrone.e2e/ui-stability-die-lock-toggle-syncs-state/`

## 备注

- 本 worktree 仍有其他历史脏文件（如 `findings.md` / `progress.md` / `task_plan.md` / 部分 infra 脚本）；本次结论仅以上述 DiceThrone E2E 相关文件和验证为准。
