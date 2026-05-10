# Smash Up：弃牌阶段手牌布局与普通状态一致

## 问题

- 场景：抽牌阶段后手牌超过上限，进入弃牌选择态。
- 用户最新口径：弃牌阶段不需要特殊布局，只要和普通手牌状态一致；如果普通状态本身过挤，应调整普通基线，弃牌态同步跟随。
- 旧结论作废：此前文档中“弃牌选择态应保持正间距并横向滚动”的判断不符合当前验收口径。

## 修复范围

- `src/games/smashup/ui/HandArea.tsx` / `e2e/src/games/smashup/ui/HandArea.tsx`
  - 不保留弃牌阶段特殊横向滚动或特殊正间距逻辑。
  - 弃牌选择态继续使用普通手牌区的动态负间距压缩规则。
  - 普通手牌区增加最大重叠上限：桌面最多重叠 `3.4vw`，紧凑布局最多重叠 `4.2vw`，避免多牌时继续无限挤压。
- `src/games/smashup/__tests__/HandArea.discardLayout.test.tsx`
  - 覆盖 12 张手牌时弃牌选择态与普通手牌态的 `margin-left` 完全一致。
  - 覆盖弃牌选择态不启用 `overflow-x-auto` / `smashup-h-scrollbar`。
  - 覆盖桌面多牌时最大负间距不超过 `-3.4vw`。
- `e2e/smashup/smashup-discard-hand-overflow.e2e.ts`
  - 覆盖真实弃牌阶段与普通出牌阶段的手牌布局一致性。

## 验证

```bash
npm run test -- src/games/smashup/__tests__/HandArea.discardLayout.test.tsx
```

结果：1 passed。

```bash
$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-discard-hand-overflow.e2e.ts "弃牌阶段多手牌布局与普通手牌状态一致"
```

结果：1 passed。

说明：第一次 E2E 启动被已有同类重任务守卫拦截；按守卫提示显式放开并发后，隔离端口 `6274/20101/21101` 跑通。

## 截图核对

1. 弃牌选择态：
   - 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-discard-hand-overflow.e2e\弃牌阶段多手牌布局与普通手牌状态一致\discard-hand-overflow-draw-phase.png`
   - 观察：顶部提示需要弃 4 张牌，底部手牌为多张重叠排列。
   - 观察：手牌没有展开成横向滚动列表，也没有特殊拉开间距；多牌压缩方式与普通状态一致，且不会继续压到超过桌面重叠上限。
   - 结论：达到“弃牌阶段和普通状态一致”的验收点。

2. 普通出牌态：
   - 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-discard-hand-overflow.e2e\弃牌阶段多手牌布局与普通手牌状态一致\discard-hand-overflow-normal-phase.png`
   - 观察：阶段切到出牌阶段后，底部手牌仍是同样的多牌重叠排列。
   - 观察：E2E 同时读取两种状态下容器 className 与卡牌 `margin-left`，结果完全一致，且最小负间距不小于 `-3.4vw`。
   - 结论：普通态与弃牌态布局一致，未引入弃牌态专用滚动或专用间距。

## 剩余风险

- 本轮截图覆盖桌面 `1920x1080`；移动端横屏若后续另有视觉反馈，需要单独补移动端截图证据。
