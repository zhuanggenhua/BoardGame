# DiceThrone 右侧旧骰盘样式 E2E 验证 2026-06-30

## 目标

- 证明主线已恢复为右侧旧样式，不再出现棋盘内第二套 3D 骰台。
- 证明打出“选任意骰子重投”后，仍由右侧骰盘承接交互，且重投确认链路可继续。

## 执行命令

```powershell
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-board-dice-3d-toggle.e2e.ts "恢复旧样式后仍使用右侧 2D 骰盘并保持重投链可用"
```

## 结果

- Playwright 通过：`1 passed`
- 关键截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-board-dice-3d-toggle.e2e\恢复旧样式后仍使用右侧-2D-骰盘并保持重投链可用\01-打出选任意骰子重投卡牌-仍为右侧2D骰盘.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-board-dice-3d-toggle.e2e\恢复旧样式后仍使用右侧-2D-骰盘并保持重投链可用\02-点击重投后-仍无棋盘3D骰台且保持右侧2D样式.png`

## 看图结论

### 01-打出选任意骰子重投卡牌-仍为右侧2D骰盘

- 右侧仍是旧的竖排骰区，显示为 5 个平面 2D 骰面，不是 3D 骰子。
- 棋盘中央没有额外冒出第二套骰盘；选骰提示仍挂在右侧骰区旁边。
- 这张图对应“触发前/选择中”状态，下一步可以直接点右侧骰子并点击确认。

### 02-点击重投后-仍无棋盘3D骰台且保持右侧2D样式

- 点击确认后，右侧依然是 2D 竖排骰区，没有切成棋盘内 3D 骰台。
- 画面已回到可继续推进的状态，右下角仍可见后续主操作按钮。
- 这证明“恢复旧样式”没有把重投交互链打断。

---

## 棋盘 3D 骰子开关回归验证（2026-07-01）

## 目标

- 证明默认关闭时仍然走右侧旧 2D 骰盘，不被棋盘 3D 骰台污染。
- 证明开启后会切到棋盘内 3D 骰台，且骰子不是原地假转，而是有真实位移和姿态变化。
- 证明对方投掷阶段我方响应改骰时，关闭态仍是右侧旧骰盘，开启态才切到棋盘 3D 骰台。

## 执行命令

```powershell
npx eslint src/games/dicethrone/ui/DiceTray.tsx src/games/dicethrone/ui/Dice3D.tsx src/games/dicethrone/Board.tsx e2e/dicethrone/dicethrone-board-dice-3d-toggle.e2e.ts
npx tsc --noEmit --pretty false
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-board-dice-3d-toggle.e2e.ts
```

## 结果

- `eslint` 通过，只有 `src/games/dicethrone/Board.tsx` 里原有 2 条 hook warning。
- `tsc` 通过。
- Playwright 通过：`2 passed`。
- 关键截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-board-dice-3d-toggle.e2e\默认关闭，打开后切到棋盘-3D-骰子，重投时不是原地静止\01-默认关闭-仍使用右侧骰盘.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-board-dice-3d-toggle.e2e\默认关闭，打开后切到棋盘-3D-骰子，重投时不是原地静止\02-打开设置后-切到棋盘内3D骰子.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-board-dice-3d-toggle.e2e\默认关闭，打开后切到棋盘-3D-骰子，重投时不是原地静止\02a-切到棋盘3D骰台-局部.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-board-dice-3d-toggle.e2e\默认关闭，打开后切到棋盘-3D-骰子，重投时不是原地静止\03-确认重投后-3D骰子发生位移弹跳.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-board-dice-3d-toggle.e2e\默认关闭，打开后切到棋盘-3D-骰子，重投时不是原地静止\03a-确认重投后-3D骰子位移中-局部.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-board-dice-3d-toggle.e2e\对方投掷阶段我方响应改骰时，关闭-3D-仍走右侧骰盘，开启后才切到棋盘骰台\05-对方投掷阶段-开启3D后切到棋盘骰台.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-board-dice-3d-toggle.e2e\对方投掷阶段我方响应改骰时，关闭-3D-仍走右侧骰盘，开启后才切到棋盘骰台\05a-对方响应改骰-棋盘3D骰台-局部.png`

## 看图结论

### 01-默认关闭-仍使用右侧骰盘

- 默认关闭时，右侧仍是旧的竖排骰盘，棋盘中央没有出现第二套 3D 骰台。
- 交互提示仍然贴着右侧骰盘，说明关闭态承接物还是旧合同，不是新 3D 壳层换皮。

### 02-打开设置后-切到棋盘内3D骰子

- 开启后，右侧旧骰盘消失，棋盘下沿出现散落的 3D 骰子，开关分流生效。
- 这一轮已经不再出现前一版那种遮住整块棋盘的巨骰，静置态尺寸回到了可读范围。

### 02a-切到棋盘3D骰台-局部

- 局部图里 5 颗骰子都落在棋盘下沿附近，尺寸接近同一语义，不再有单颗骰子被放大成整屏主角。
- 不同骰子的朝向仍然不同，说明不是一组平面贴图或原地转圈假象。

### 03-确认重投后-3D骰子发生位移弹跳

- 确认后，至少一颗骰子离开原来的底部散落位，进入棋盘中部的运动轨迹。
- 画面里既有还在底部的骰子，也有正在中途飞出的骰子，说明这一步存在真实位移过程。

### 03a-确认重投后-3D骰子位移中-局部

- 局部图里可以直接看到一颗骰子浮在棋盘中部，其他骰子仍在底部，位移层次清楚。
- 运动中的骰子尺寸仍然受控，没有因为靠近镜头就重新膨胀成巨骰。

### 05-对方投掷阶段-开启3D后切到棋盘骰台

- 轮到对方投掷、我方响应改骰时，开启 3D 后也会切到棋盘内骰台，而不是只在自己投掷时生效。
- 右侧保留的是操作按钮和响应卡牌，不再重复塞一套旧骰盘。

### 05a-对方响应改骰-棋盘3D骰台-局部

- 对方响应场景下，3D 骰子同样维持了受控尺寸，没有出现响应场景专属的超大骰面。
- 局部图里可见多颗骰子角度不同、位置分散，仍然符合真实物理结果的可见表现。
