# SmashUp 教程随从入场动画重复播放回归验证（2026-04-08）

## 反馈背景

用户反馈：**教程 / 他人出牌时，随从入场动画会像“开头反复播放”一样卡在中间**。

本轮没有用“关掉动画”收口，而是直接约束动画触发条件：
- 只有**新进入基地的新 UID 随从**才允许播放入场动画
- 已经在基地上的旧 UID 随从，后续因为教程步骤切换、Overlay 重排或普通重渲染时，**不应再次触发初始入场动画**

## 本轮实现

### 1. BaseZone 入场动画触发改为显式按 UID 增量判断
- 文件：`src/games/smashup/ui/BaseZone.tsx`
- 辅助工具：`src/games/smashup/ui/baseZoneEntryAnimation.ts`

核心逻辑：
- 先按 `controller -> minion uid set` 建当前快照
- 再与上一拍快照比较
- 只有当前存在、上一拍不存在的 uid 才进 `shouldAnimateEntry`
- `MinionCard` 的 `initial={{ scale: 0.3, y: -60, opacity: 0 }}` 现在只在 `shouldAnimateEntry === true` 时生效

这样可以避免：
- 教程 step 切换导致旧随从重新跑“从上方掉入”的初始动画
- 纯重渲染把旧随从误当成“刚打出”

### 2. 补纯逻辑回归
- 文件：`src/games/smashup/__tests__/ui-interaction-manual.test.ts`

新增断言：
- **初次挂载** 时，现有随从不应被误判成新入场
- **仅新增 uid** 时，只给新增随从播放入场动画，旧 uid 不重播

### 3. 补真实教程 E2E
- 文件：`e2e/smashup/smashup-tutorial.e2e.ts`
- 用例：`主教程首个已入场随从在后续步骤切换时不应重复播放入场动画`

验证方式不是只看一张截图，而是：
- 真实走完主教程前半段，打出 `tut-1`
- 进入下一步 `playAction` 后，对同一个 `[data-minion-uid="tut-1"]` 连续采样 6 次
- 断言该元素在后续步骤切换期间：
  - `top/left` 漂移保持在极小阈值内
  - `width/height` 不再出现“从小变大”的重复入场尺度变化
  - `opacity` 保持接近 `1`

## 执行命令

### ESLint
```powershell
npx eslint src/games/smashup/ui/BaseZone.tsx src/games/smashup/ui/baseZoneEntryAnimation.ts src/games/smashup/__tests__/ui-interaction-manual.test.ts e2e/smashup/smashup-tutorial.e2e.ts src/games/smashup/Board.tsx src/components/tutorial/TutorialOverlay.tsx src/games/smashup/tutorial.ts
```

结果：**0 errors**（`Board.tsx` 有仓库现存 `Date.now()` purity warning，非本轮新增阻断项）

### Vitest
```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/ui-interaction-manual.test.ts src/games/smashup/__tests__/tutorial.test.ts --configLoader native --maxWorkers 1
```

结果：**20 passed**

### E2E
```powershell
node scripts/infra/run-e2e-single.mjs ci --file e2e/smashup/smashup-tutorial.e2e.ts --case "主教程首个已入场随从在后续步骤切换时不应重复播放入场动画"
```

结果：**1 passed**

## 截图证据

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-tutorial.e2e\主教程首个已入场随从在后续步骤切换时不应重复播放入场动画\main-tutorial-minion-no-reentry-animation.png`

## 验收结论

这轮已经把“旧随从因教程/重渲染而重复播入场动画”的核心风险锁住：

- 代码层：入场动画只对新增 UID 生效
- 单测层：初挂载 / 增量新增 两条关键语义已锁住
- E2E 层：真实教程链路里，`tut-1` 在进入后续步骤后保持稳定，没有再次走入场动画的位移/缩放轨迹

因此，这条问题现在可归档为：**已修并完成回归验证**。
