# SmashUp 移动端战场 content pinch-zoom 回归复验（2026-04-07）

## 范围

- 目标：复验 `MobileBoardShell / MobileBattlefieldViewport` 在 `content` 模式下的 pinch-zoom 回归是否收口。
- 关注点：
  - transform 只作用于真实 zoom target
  - 顶部 HUD / 右侧结束回合按钮 / 底部手牌不随战场一起放大
  - pinch 后战场内容不整体下沉
  - 缩放后的内容层仍可继续横向 pan

## 执行

- 单测：`npx vitest run src/components/game/framework/__tests__/MobileBoardShell.test.tsx`
- E2E：`npm run test:e2e:ci:file -- e2e/smashup/smashup-4p-layout-test.e2e.ts "移动端横屏应保持四人局布局可用，并支持手牌长按看牌与战场拖拽放大"`

## 我实际查看的截图

### 1. `04d-mobile-battlefield-pinch-zoom.png`

- 我实际看到：三块基地和战场卡牌被明显放大，但左上回合卡、右上记分板、右侧“结束回合”按钮、底部手牌仍保持原始尺寸与锚点。
- 我实际看到：放大后战场仍停留在中部战场带，没有出现整组基地向下沉的现象；顶部也没有扩出新的透明挡层。
- 验收判断：**达到“只放大战场内容层，不放大 HUD，且 pinch 后不整体下沉”的验收标准。**

### 2. `04e-mobile-battlefield-panned.png`

- 我实际看到：相对 `04d`，左侧第一块基地继续向屏幕外移动，第二、三块基地整体向左偏移，说明缩放后的内容层仍可继续横向 pan。
- 我实际看到：右侧“结束回合”按钮、顶部 HUD、底部手牌位置保持稳定，没有跟着战场内容一起横向漂移。
- 验收判断：**达到“缩放后仍可继续 pan，且外围 UI 不跟随漂移”的验收标准。**

## 结论

- 本轮 `content` 模式 pinch-zoom 回归已通过针对性单测与目标 E2E。
- 这次修复已经把几何锚点收敛到真实内容目标，同时保留了战场层的横向可移动空间。
