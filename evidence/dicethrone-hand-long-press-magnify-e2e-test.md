# DiceThrone 手牌长按放大 E2E 证据

## 目标

验证移动端手牌支持长按放大，并且长按后不会误触发出牌。

## 涉及用例

- 文件：`e2e/dicethrone-watch-out-spotlight.e2e.ts`
- 用例：`mobile long press hand card should open magnify without playing card`

## 断言

1. 长按手牌后，`[data-testid="board-magnify-overlay"]` 可见。
2. 长按后玩家手牌仍包含 `watch-out`（未误出牌）。

## 执行记录

### 1) dev 模式（通过）

命令：

```bash
node scripts/infra/run-e2e-command.mjs dev e2e/dicethrone-watch-out-spotlight.e2e.ts --grep "mobile long press hand card should open magnify without playing card"
```

结果：

- `1 passed`

截图（绝对路径）：

- `F:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\mobile-long-press-hand-card-should-open-magnify-without-playing-card\13-mobile-hand-long-press-magnify-open.png`

相对路径引用：

![long-press-magnify-open](../test-results/evidence-screenshots/dicethrone-watch-out-spotlight.e2e/mobile-long-press-hand-card-should-open-magnify-without-playing-card/13-mobile-hand-long-press-magnify-open.png)

### 1.1) 抽取通用 Hook 后回归（通过）

- 抽取内容：`src/hooks/ui/useTouchLongPress.ts`
- 回归命令与断言同上
- 结果：`1 passed`

### 2) ci 模式（环境失败）

命令：

```bash
node scripts/infra/run-e2e-command.mjs ci e2e/dicethrone-watch-out-spotlight.e2e.ts --grep "mobile long press hand card should open magnify without playing card"
```

结果：

- 未稳定进入用例断言阶段（隔离模式环境不稳定）。
- 本轮最新失败点：`GameTestContext.waitForTestHarness` 超时（`__BG_TEST_HARNESS__` 未注册）。
- 另一次失败点：`global-setup` 阶段前端进程退出（`Vite exit code 1`）。

关键日志（绝对路径）：

- `F:\gongzuo\webgame\BoardGame\.tmp\playwright-bootstrap-pw-1773410344376-65lavl-worker-0.log`
- `F:\gongzuo\webgame\BoardGame\.tmp\playwright-bootstrap-pw-1773409625224-0k3rvu-worker-0.log`
- `F:\gongzuo\webgame\BoardGame\logs\vite-2026-03-13T13-47-13-810Z.log`

## 结论

- 业务行为已通过 dev E2E 证明：手牌长按可打开放大层，且不会误出牌。
- ci 隔离模式当前被基础环境启动问题阻塞，不是本次长按逻辑断言失败。
