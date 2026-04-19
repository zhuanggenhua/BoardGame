# Summoner Wars 悬浮球“强制结束 AI 当前阶段”入口 E2E 证据

## 范围

- 目标：在悬浮球中新增“强制结束 AI 当前阶段”入口，并满足“放撤回上面”的顺序要求。
- 关联文件：
  - `src/components/game/framework/widgets/GameHUD.tsx`
  - `src/pages/MatchRoom.tsx`
  - `e2e/summonerwars/summonerwars.e2e.ts`

## 本轮执行

### 静态检查

```bash
npx eslint src/components/game/framework/widgets/GameHUD.tsx e2e/src/components/game/framework/widgets/GameHUD.tsx
```

结果：0 errors，只有既有 warnings。

### E2E

```bash
npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars.e2e.ts "在线 AI watchdog/卡死兜底：阻止 AI seat 建连后，服务端仍应自动收口到真人回合且不误推进真人"
```

结果：1 passed。

## 关键截图

### 1. 悬浮球展开顺序截图

- 路径：
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\在线-AI-watchdog-卡死兜底：阻止-AI-seat-建连后，服务端仍应自动收口到真人回合且不误推进真人\watchdog-fab-force-end-order.png`

#### 我实际看到什么

1. 右侧悬浮球已展开为一列卫星按钮，不是只有主球单独显示，说明这张图来自真实悬浮球链路。
2. 在主球上方的按钮列里，可以看到琥珀色警告三角按钮位于撤回箭头按钮的上方，符合“放撤回上面”的要求。
3. “行为日志”面板仍能正常从该按钮列展开，说明这次顺序调整没有把共享 FAB 面板链路弄坏。

#### 是否达到验收标准

- **达到。**
- 这张图配合 E2E 中基于真实按钮几何位置的排序断言，已经证明“强制结束 AI 当前阶段”入口存在，并且视觉顺序位于撤回按钮上方（离主球更远）。

## 结论

- 本轮“悬浮球新增强制结束 AI 当前阶段入口，并放在撤回上面”的目标已完成。
- 本次修正的根因是：`FabMenu` 会对卫星按钮做反转渲染，因此 `GameHUD` 中的 push 顺序需要与最终视觉顺序反向布置。
