# SmashUp 移动端拖拽黑屏反馈 E2E 证据

## 对应反馈
- `69d71d2e932fe508b2420c25`
- 标题：拖拽时把整个屏幕拖拽出去了，有一半是黑屏

## 本轮改动
- `src/components/game/framework/MobileBoardShell.tsx`
- `src/components/game/framework/__tests__/MobileBoardShell.test.tsx`
- `e2e/smashup/smashup-4p-layout-test.e2e.ts`

## 验证
1. `npx eslint src/components/game/framework/MobileBoardShell.tsx src/components/game/framework/__tests__/MobileBoardShell.test.tsx e2e/smashup/smashup-4p-layout-test.e2e.ts --quiet`
2. `node scripts/infra/vitest-cli-safe.mjs run src/components/game/framework/__tests__/MobileBoardShell.test.tsx --configLoader native -t "clamps centered content-target panning to the actual child bounds instead of exposing empty black margins"`
3. `npm run test:e2e:ci:file -- smashup-4p-layout-test.e2e.ts "移动端横屏 pinch 后仍可拖拽战场，避免 pan 锁死回归"`

## 关键截图

### 1. pinch 后继续拖拽战场
- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-4p-layout-test.e2e\移动端横屏-pinch-后仍可拖拽战场，避免-pan-锁死回归\04f-mobile-battlefield-pan-still-works-after-pinch.png`
- 我实际看到：
  - 战场主内容仍停留在棋盘区域内，画面里没有用户反馈中的黑色空洞/黑屏块。
  - 右侧“结束回合”按钮仍固定在外层 HUD，没有随着战场拖拽一起飘走。
  - 基地、手牌、牌库都还在可见区域内，说明拖拽后没有把整块战场甩出视口。
- 验收判断：
  - 达到本轮验收标准。新的边界夹紧允许首个方向已到边界时不再继续位移，但反向拖拽仍能驱动战场，不再复现“拖出半屏黑边”的问题口径。
