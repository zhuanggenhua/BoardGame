# Smash Up 弃牌继续按钮边框回归 E2E 证据

## 背景

- 用户反馈：大杀四方右下角“继续”圆按钮边框丢失，但进入下一轮后的正常结束回合按钮边框正常。
- 结论：这是样式分叉回归，不是交互逻辑问题。

## 回归来源

- 可疑提交：`4b2b4fcc966c008fc661e53de8dfd1629258e6aa`
- 提交时间：`2026-03-29 20:57:49 +0800`
- 提交标题：`收口剩余游戏适配、E2E、文档与资源更新`
- 该次改动给正常 `FINISH TURN` 圆按钮补了 `border-white/95` 与 `ring-white/55`，但没有同步给弃牌态“继续”按钮，导致两个状态样式分叉。

## 修复点

- 文件：`src/games/smashup/Board.tsx`
- 位置：弃牌态 `SU_COMMANDS.DISCARD_TO_LIMIT` 对应的右下角圆按钮
- 修复：补回与正常结束回合同款的 `border-solid border-4 border-white/95 ring-1 ring-white/55`

## 验证

- 用例文件：`e2e/smashup/smashup-4p-layout-test.e2e.ts`
- 用例名：`手牌超限时继续按钮应保持与结束回合同款白色描边`
- 命令：

```bash
npm run test:e2e:ci:file -- smashup-4p-layout-test.e2e.ts "手牌超限时继续按钮应保持与结束回合同款白色描边"
```

- 结果：`1 passed`

## 截图

- 截图路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-4p-layout-test.e2e\手牌超限时继续按钮应保持与结束回合同款白色描边\14-discard-continue-border-restored.png`

## 肉眼观察

- 右下角“继续”圆按钮外圈存在清晰的浅色描边，不再是纯深色实心圆。
- 描边外侧还能看到一层更淡的高光 ring，视觉效果与正常结束回合按钮一致。
- 顶部红色提示条显示“你需要丢弃 1 张牌以继续游戏”，说明截图确实处在弃牌继续态，而不是下一轮普通结束回合态。
