# DiceThrone 手牌长按放大 E2E 证据

## 目标

验证移动端手牌支持长按放大，并且长按后不会误触发出牌。

## 涉及用例

- 文件：`e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts`
- 用例：`mobile long press hand card should open magnify without playing card`
- 同类覆盖：`mobile narrow viewport should keep magnify entries visible and clickable`

## 断言

1. 长按手牌后，`[data-testid="board-magnify-overlay"]` 可见。
2. 长按后玩家手牌仍包含 `watch-out`（未误出牌）。

## 执行记录

### 4) 2026-05-10 同类多卡预览裁剪风险回归（通过）

命令：

```bash
npm run typecheck
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "mobile narrow viewport should keep magnify entries visible and clickable"
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "mobile long press hand card should open magnify without playing card"
```

结果：

- `typecheck` 通过。
- 窄横屏多入口放大 E2E：`1 passed`。
- 手牌长按放大 E2E：`1 passed`。

新增/复核断言：

- 弃牌堆多卡放大层必须出现 `dt-multi-card-magnify-strip`。
- 多卡 strip 高度不得超过裁剪父容器。
- 每张 atlas 卡面的 `top/bottom/height` 都必须留在 strip 内，防止横屏下只显示上半截或左上角。
- 每张多卡预览仍保持约 `0.61` 的卡牌宽高比。
- 玩家面板放大入口改为点击稳定的放大按钮，避免固定坐标受手牌/面板覆盖影响导致误判。

截图（绝对路径）：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\mobile-narrow-viewport-should-keep-magnify-entries-visible-and-clickable\14-mobile-discard-pile-inspect-open.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\mobile-long-press-hand-card-should-open-magnify-without-playing-card\13-mobile-hand-long-press-magnify-open.png`

肉眼观察：

- 弃牌堆预览里能看到横向多张卡和中央当前卡，卡面没有只剩左上角或只显示上半截；主内容没有被错误改成窄布局。
- HUD、技能板、骰子区和放大层仍在同一横屏视觉坐标系内，没有出现整体偏到左上角的问题。
- 手牌长按后的「看箭！」放大卡面完整居中，标题、插画、攻击修正标签、规则文本和底部边框都可见；长按后手牌仍保留 `watch-out`，没有误出牌。

### 3) 2026-05-09 修复放大卡面被父容器裁剪（通过）

命令：

```bash
npm run typecheck
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "mobile long press hand card should open magnify without playing card"
```

结果：

- `typecheck` 通过。
- E2E：`1 passed`。

新增断言：

- 长按后放大层里必须出现月精灵 `watch-out` 的 atlas 卡面。
- 放大卡面的 `getBoundingClientRect()` 宽高不得超过其裁剪父容器，防止再次出现“只显示左上/上半部分”的裁剪回归。
- 放大卡面宽高比约为 `0.61`。

截图（绝对路径）：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\mobile-long-press-hand-card-should-open-magnify-without-playing-card\13-mobile-hand-long-press-magnify-open.png`

肉眼观察：

- 放大层中央能看到完整的「看箭！」卡牌：标题、插画、攻击修正标签、下方规则文本和底部边框都在画面内。
- 卡牌没有只露出左上角或上半截；HUD、技能板和骰子区仍在背景同一坐标系中，没有被误改成窄布局。
- 长按后手牌仍保留 `watch-out`，没有误触发出牌。

### 1) dev 模式（通过）

命令：

```bash
node scripts/infra/run-e2e-command.mjs dev e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts --grep "mobile long press hand card should open magnify without playing card"
```

结果：

- `1 passed`

截图（绝对路径）：

- `F:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\mobile-long-press-hand-card-should-open-magnify-without-playing-card\13-mobile-hand-long-press-magnify-open.png`

相对路径引用：

![long-press-magnify-open](../../test-results/evidence-screenshots/dicethrone/dicethrone-watch-out-spotlight.e2e/mobile-long-press-hand-card-should-open-magnify-without-playing-card/13-mobile-hand-long-press-magnify-open.png)

### 1.1) 抽取通用 Hook 后回归（通过）

- 抽取内容：`src/hooks/ui/useTouchLongPress.ts`
- 回归命令与断言同上
- 结果：`1 passed`

### 2) ci 模式（环境失败）

命令：

```bash
node scripts/infra/run-e2e-command.mjs ci e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts --grep "mobile long press hand card should open magnify without playing card"
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

- 最新 ci 隔离模式 E2E 已通过：手牌长按可打开放大层，且不会误出牌。
- 已补充同类多卡/弃牌堆预览裁剪回归覆盖：横屏下多卡预览不会再只显示左上角或上半截。
