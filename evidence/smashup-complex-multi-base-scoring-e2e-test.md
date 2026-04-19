# SmashUp 复杂多基地计分 afterScoring E2E 通过记录

## 测试目标

验证 Smash Up 在基地计分后，`afterScoring` 响应窗口能够正常打开，并在响应结束后正常关闭、推进后续流程。

## 最终通过命令

```powershell
cmd /c "set PW_USE_DEV_SERVERS=true&& set PW_WORKERS=1&& set VITE_DEV_PORT=6288&& set PW_PORT=6288&& set VITE_FRONTEND_URL=http://127.0.0.1:6288&& set GAME_SERVER_PORT=20188&& set API_SERVER_PORT=21188&& set PW_GAME_SERVER_PORT=20188&& set PW_API_SERVER_PORT=21188&& npx playwright test e2e/smashup-complex-multi-base-scoring.e2e.ts --workers=1 --reporter=list"
```

## 测试结果

- 结果：`1 passed`
- 用时：Playwright 总耗时约 `48.3s`
- 关键日志：
  - `推进后状态: { phase: 'scoreBases', windowType: 'afterScoring' }`
  - `afterScoring 首次 PASS 后状态: { phase: 'playCards', windowType: null }`

## 根因修复

### 1. 真实业务根因

`scoreBases` 阶段里，`afterScoring` 响应窗口虽然已被打开，但流程没有 `halt`，导致阶段继续向后推进。  
结果就是：

- 响应窗口可能挂在错误阶段
- `afterScoringInitialPowers` 无法在正确时机恢复重计分逻辑
- E2E 观察到窗口状态与 phase 不一致

修复点：

- `src/games/smashup/domain/index.ts`
- 在 `scoreBases` 结算过程中，一旦发现 `RESPONSE_WINDOW_EVENTS.OPENED` 且 `windowType === 'afterScoring'`，立即 `halt`

### 2. 测试稳定性修复

`afterScoring` 窗口里，P1 没有可响应内容时会被系统自动跳过。  
因此 E2E 不应强制点击第二次 PASS，而是要先判断窗口是否仍存在。

修复点：

- `e2e/smashup-complex-multi-base-scoring.e2e.ts`

### 3. Windows 截图偶发锁文件

Playwright 截图写入在 Windows 上偶发 `EBUSY/EPERM`。  
为避免测试因文件锁误失败，给截图与复制动作增加了轻量重试。

修复点：

- `e2e/framework/GameTestContext.ts`

## 关键截图

### 1) 场景注入成功

文件：

- `e2e/test-results/evidence-screenshots/smashup-complex-multi-base-scoring.e2e/基地计分后-afterScoring-响应窗口正常打开-01-scene-ready.png`

![场景就绪](../e2e/test-results/evidence-screenshots/smashup-complex-multi-base-scoring.e2e/基地计分后-afterScoring-响应窗口正常打开-01-scene-ready.png)

观察：

- 左侧基地显示 `13 / 12`，确认基地已满足计分条件
- 右下角仍是 `Finish Turn`，说明还处于出牌结束前
- 双方分数均为 `0`

### 2) afterScoring 窗口正常打开

文件：

- `e2e/test-results/evidence-screenshots/smashup-complex-multi-base-scoring.e2e/基地计分后-afterScoring-响应窗口正常打开-04-after-scoring-open.png`

![afterScoring 窗口打开](../e2e/test-results/evidence-screenshots/smashup-complex-multi-base-scoring.e2e/基地计分后-afterScoring-响应窗口正常打开-04-after-scoring-open.png)

观察：

- 中央明确出现 `AFTER SCORING RESPONSE`
- PASS 按钮可见，可执行响应/跳过
- 记分板显示 P0 已获得 `2 VP`
- 左上角显示 `Score`，说明仍停留在计分链路中等待响应

### 3) 响应结束后流程正常收束

文件：

- `e2e/test-results/evidence-screenshots/smashup-complex-multi-base-scoring.e2e/基地计分后-afterScoring-响应窗口正常打开-06-final-state.png`

![最终状态](../e2e/test-results/evidence-screenshots/smashup-complex-multi-base-scoring.e2e/基地计分后-afterScoring-响应窗口正常打开-06-final-state.png)

观察：

- `afterScoring` 覆盖层已关闭
- 当前已进入对手 `Play` 阶段
- 分数稳定为 `P0 = 2, P1 = 0`

## 结论

本次 E2E 已验证：

- 基地达标后，`afterScoring` 响应窗口会正常打开
- 响应窗口关闭后，流程会继续推进
- 分数结算结果正确
- 测试已实际运行通过，不再停留在超时/环境不稳阶段
