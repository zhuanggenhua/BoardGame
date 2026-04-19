# SmashUp 移动端 pinch-pan 黑边回归验证（2026-04-10）

- 反馈 ID：`69d71d2e932fe508b2420c25`
- 反馈标题：拖拽时把整个屏幕拖拽出去了，有一半是黑屏
- 验证目标：移动端横屏双指缩放后继续拖拽战场时，不应把视口拖出到黑边/黑屏区域。

## 本轮改动

- `src/components/game/framework/MobileBoardShell.tsx`
  - 将 content-target 的逻辑边界计算改为优先基于**当前渲染后的子内容真实矩形**反推逻辑 bounds，避免 flex 居中内容在 `offsetLeft=0` 时被误判成可继续向外拖拽。
- `src/components/game/framework/__tests__/MobileBoardShell.test.tsx`
  - 补强 centered content-target 回归测试，显式覆盖“子内容视觉居中但 offsetLeft/offsetTop 不可信”的场景。

## 静态/单测验证

1. `npx eslint src/components/game/framework/MobileBoardShell.tsx src/components/game/framework/__tests__/MobileBoardShell.test.tsx --quiet`
2. `node scripts/infra/vitest-cli-safe.mjs run src/components/game/framework/__tests__/MobileBoardShell.test.tsx --configLoader native -t "clamps centered content-target panning to the actual child bounds instead of exposing empty black margins"`

结果：通过。

## E2E 验证

执行命令：

```bash
$env:PW_WORKERS='2'; $env:PW_RUNTIME_SCOPE='manual-mobile-blackedge-multi'; npm run test:e2e:ci:file -- smashup-4p-layout-test.e2e.ts "移动端横屏 pinch 后仍可拖拽战场，避免 pan 锁死回归"
```

结果：通过。

关键截图：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-4p-layout-test.e2e\移动端横屏-pinch-后仍可拖拽战场，避免-pan-锁死回归\04f-mobile-battlefield-pan-still-works-after-pinch.png`

## 肉眼验收结论

### 04f-mobile-battlefield-pan-still-works-after-pinch.png

1. 我实际看到左侧和上侧仍是桌面背景色，而不是之前用户反馈中的黑屏/黑边；说明拖拽没有把战场内容整体拖出到视口外黑区。
2. 右侧基地区、手牌区、结束回合按钮仍完整留在视口内，说明 pinch 后继续 pan 时主战场仍可操作，没有出现“拖一下就把整个屏幕带走”的现象。
3. 该截图已达到本轮验收标准：修复目标是消除拖拽后的黑边/黑屏暴露，而不是强制让所有基地始终铺满整个横向视口；当前没有黑边且关键交互区仍完整可见，可据此收口。
