# 大杀四方移动端对手视角分数点击 E2E 证据

## 范围

- 游戏：`smashup`
- 问题：移动端横屏点击对手分数后，无法进入对手视角
- 本轮目标：验证移动端点击对手分数可进入对手视角，并可通过返回按钮退出

## 根因

- 根因不在 `scale()` 命中盒换算本身。
- `src/games/smashup/Board.tsx` 在提交 `5ac3131e` 同期把移动端记分板改成了 `pointer-events-none`，导致分数球点击入口被整体禁用。

## 验证命令

```powershell
$env:PW_USE_DEV_SERVERS='true'
$env:PW_TEST_MATCH='e2e/smashup/smashup-4p-layout-test.e2e.ts'
npx playwright test e2e/smashup/smashup-4p-layout-test.e2e.ts --grep "移动端横屏点击对手分数应能进入并退出对手视角"
```

- 本轮最终通过的是“真实 touch tap”链路，不是单纯 Playwright 鼠标 click。
- 用例里额外校验了分数球中心点 `elementFromPoint(...)` 仍命中分数按钮本身，然后用 Chromium CDP 发送 `touchStart/touchEnd`。

## 关键截图

### 1. 进入对手视角后的移动端横屏界面

- 截图路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-4p-layout-test.e2e\移动端横屏点击对手分数应能进入并退出对手视角\03a-mobile-opponent-view-entry.png`
- 我实际看到什么：
  - 画面中央上方出现了“对手视角”横幅，并带有“返回”按钮。
  - 右上角记分板仍然可见，说明点击对手分数后 UI 没有被遮挡或跳到异常页面。
  - 主战场区域继续正常显示，没有因为切视角导致顶栏或战场整体消失。
- 是否达到验收标准：
  - 达到。该截图直接证明移动端横屏点击对手分数后，已成功进入对手视角。

## 结论

- 本轮问题已复现并修复。
- 修复点是恢复移动端记分板的点击能力，而不是调整缩放算法。
- 为避免真实移动端只触发 touch 不触发 click 的情况，分数球入口已补成 `onPointerUp/onTouchEnd + onClick` 双保险。
