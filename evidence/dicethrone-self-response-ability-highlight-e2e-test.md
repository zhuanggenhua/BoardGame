# DiceThrone 响应期技能高亮 E2E 证据

## 范围

- 目标：当本地玩家正处于响应窗口时，不应把“自己要重新选技能”这件事提前暴露出来；但当前正在观察的对手可选技能仍应保持高亮，方便观察战局。
- 代码范围：
  - `src/games/dicethrone/Board.tsx`
  - `e2e/dicethrone-defense-selection.e2e.ts`

## 验证命令

```bash
npm run test:e2e:ci:file -- e2e/dicethrone-defense-selection.e2e.ts "自己处于响应窗口时应高亮对方可选技能"
```

## 截图证据

### 1. 自己响应期间，对方可选技能仍保持高亮

![响应期间对方技能高亮](../test-results/evidence-screenshots/dicethrone-defense-selection.e2e/自己处于响应窗口时应高亮对方可选技能/self-response-window-opponent-highlight.png)

人工观察结论：

- 右下角仍能看到 `可以响应 / 跳过` 按钮，说明当前确实还处于响应窗口中，而不是已经退出响应链。
- 画面自动观察的是对手 Monk 面板，多个技能槽边缘存在明显的浅红色高亮描边，说明“对方当前可选技能”仍在提示中。
- 底部手牌仍是本地玩家的响应手牌，没有把本地玩家拉回自己的技能面板去要求再次点技能；也就是“能观察对方高亮”与“自己不被要求重选”同时成立。

## 结果

- 定向 E2E 已通过。
- 当前实现满足新的交互口径：响应期间保留对手技能高亮观察，不把本地玩家自己的技能重新暴露为待选。
