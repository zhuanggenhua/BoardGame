# SmashUp 反馈 69d8834670d52ddbd0c190a8 收口记录（2026-04-11）

## 反馈

- ID：`69d8834670d52ddbd0c190a8`
- 标题：`放大缩小变流畅了，但是无法拖动位置了`
- 诊断包：`temp/feedback-closeout/2026-04-10T16-45-00-000Z/69d8834670d52ddbd0c190a8.md`

## 诊断结论

- 这条反馈描述的现象与此前移动端反馈 `69d71d2e932fe508b2420c25` 的后半段口径一致：**pinch 后 pan 被锁死 / 无法继续拖动战场**。
- 当前仓库里的主修复仍在 `src/components/game/framework/MobileBoardShell.tsx`：
  - 继续按真实渲染后的子内容边界夹紧平移范围；
  - 允许缩放后反向拖拽继续生效，不会出现“放大缩小流畅了，但战场拖不动”的回归。
- 本轮另外发现一个验证层回归：
  - `e2e/smashup/smashup-4p-layout-test.e2e.ts`
  - `e2e/smashup/smashup-tutorial.e2e.ts`
  - 这两个文件错误地从 `../src/shared/referenceViewports` 引用共享视口常量，导致 Playwright 无法加载测试文件。
  - 已改为正确路径 `../../src/shared/referenceViewports`，恢复 E2E 门禁，便于重新证明该反馈已经收口。

## 本轮验证

1. `npx eslint e2e/smashup/smashup-4p-layout-test.e2e.ts e2e/smashup/smashup-tutorial.e2e.ts src/components/game/framework/MobileBoardShell.tsx src/components/game/framework/__tests__/MobileBoardShell.test.tsx --quiet`
   - 结果：通过
2. `node scripts/infra/vitest-cli-safe.mjs run src/components/game/framework/__tests__/MobileBoardShell.test.tsx --configLoader native -t "clamps centered content-target panning to the actual child bounds instead of exposing empty black margins"`
   - 结果：通过
3. `$env:PW_WORKERS='2'; $env:PW_RUNTIME_SCOPE='manual-mobile-blackedge-feedback-69d883-rerun'; npm run test:e2e:ci:file -- smashup-4p-layout-test.e2e.ts "移动端横屏 pinch 后仍可拖拽战场，避免 pan 锁死回归"`
   - 结果：通过

## 关键截图

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-4p-layout-test.e2e\移动端横屏-pinch-后仍可拖拽战场，避免-pan-锁死回归\04f-mobile-battlefield-pan-still-works-after-pinch.png`

## 肉眼验收

### 04f-mobile-battlefield-pan-still-works-after-pinch.png

1. 我实际看到战场主体仍留在视口中央，没有用户反馈中的“拖不动后只剩一块固定死板区域”或黑边暴露；说明 pinch 后继续 pan 仍然生效。
2. 右侧“结束回合”按钮、上方基地区、底部手牌区都还在各自位置，没有随着一次拖拽被锁死或整体甩出屏幕。
3. 该截图达到本轮验收标准：当前移动端横屏在 pinch 后仍可继续拖动战场，不再复现“放大缩小变流畅了，但是无法拖动位置了”。

## 结论

- 这条反馈可判定为 **resolved**。
- 用户描述的问题已被 `MobileBoardShell` 的 pinch-pan 边界修复覆盖；本轮重新恢复并跑通 E2E 后，已再次证明当前代码不再复现。
