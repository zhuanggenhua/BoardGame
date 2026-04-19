# SmashUp 移动端 pinch 后拖拽露出黑边修复验收

## 反馈
- 反馈 ID：`69d71d2e932fe508b2420c25`
- 标题：拖拽时把整个屏幕拖拽出去了，有一半是黑屏

## 本轮修复
- `src/components/game/framework/MobileBoardShell.tsx`
  - 继续使用按真实内容边界夹紧的 pinch / pan 逻辑。
- `src/games/smashup/Board.tsx`
  - 将移动端战场缩放目标从外层居中滚动容器切到实际战场内容条，避免把外层空白 gutter 一起参与缩放和平移。

## 验证
- `npx eslint src/components/game/framework/MobileBoardShell.tsx src/components/game/framework/__tests__/MobileBoardShell.test.tsx src/games/smashup/Board.tsx --quiet`
- `node scripts/infra/vitest-cli-safe.mjs run src/components/game/framework/__tests__/MobileBoardShell.test.tsx --configLoader native -t "clamps centered content-target panning to the actual child bounds instead of exposing empty black margins"`
- `npm run test:e2e:ci:file -- smashup-4p-layout-test.e2e.ts "移动端横屏 pinch 后仍可拖拽战场，避免 pan 锁死回归"`

## 关键截图
1. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏-pinch-后仍可拖拽战场，避免-pan-锁死回归\04f-mobile-battlefield-pan-still-works-after-pinch.png`
   - 我实际看到：三块基地和中间战场条带铺满主要视区，左侧不再出现“被拖出一大片空黑边/空背景”的异常空洞。
   - 我实际看到：结束回合按钮、右上记分板仍固定在外层 HUD 位置，没有随着战场一起横向漂移。
   - 验收判断：达到本轮验收标准，已证明 pinch 后继续拖拽时战场内容会被夹在真实内容范围内，而不是把整块外层空白拖出来。

## 结论
- 该反馈为真实 bug，当前已修复并通过组件级 + E2E 验证。
