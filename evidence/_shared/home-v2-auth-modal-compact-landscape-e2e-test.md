# Home V2 纸面弹窗统一验收（2026-05-16）

- 本轮修正目标：
  - 收回上一轮“把弹窗做大到接近满屏”的错误方向；
  - 以设计稿和同场景通用 UI 为真相源，统一 `AuthModal` 与 `CreateRoomModal` 的纸面壳层、标题/分割线、输入框与主按钮语法；
  - 保持输入聚焦时“不推动整个弹窗位置”的行为。

- 真相源：
  - 设计稿：`D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\artifacts\home-v2-design\home-v2-auth-modal-target.png`
  - 共享壳层：`D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\src\components\common\overlays\HomeV2PaperModalFrame.tsx`
  - 通用 token：`D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\src\components\common\overlays\homeV2PaperModalTheme.ts`

## 验证方式

- 运行真实 E2E：
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_RUNTIME_SCOPE=home-v2-modal-original-target-8 PW_SERVER_RUNTIME=tsx node scripts/infra/run-e2e-single.mjs ci e2e/lobby.e2e.ts "homeV2Draft 登录与创建房间弹窗统一使用纸面 modal" --project=chromium`
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_RUNTIME_SCOPE=home-v2-password-paper-4 PW_SERVER_RUNTIME=tsx node scripts/infra/run-e2e-single.mjs ci e2e/lobby.e2e.ts "homeV2Draft 详情页输入房间密码后可加入加密房间" --project=chromium`
- 运行环境：
  - 托管 isolated runtime，最后一轮端口为 `frontend=6277 / game=20100 / api=21100`
  - 真实移动横屏 context：`width=852 / height=393`，`isMobile=true`、`hasTouch=true`、Android WebView UA

## 关键截图

- 登录弹窗：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-登录与创建房间弹窗统一使用纸面-modal\homeV2Draft-登录与创建房间弹窗统一使用纸面-modal-auth-modal-unified-20260516.png`
- 创建房间弹窗：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-登录与创建房间弹窗统一使用纸面-modal\homeV2Draft-登录与创建房间弹窗统一使用纸面-modal-create-room-modal-unified-20260516.png`
- 加密房密码弹窗：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-详情页输入房间密码后可加入加密房间\homeV2Draft-详情页输入房间密码后可加入加密房间-locked-room-password-panel.png`

## 量测结果

- 登录弹窗：
  - `widthRatio=0.286`
  - `heightRatio=0.631`
  - `centerXRatio=0.500`
  - `centerYRatio=0.500`
  - `passwordInputHeight=17.89`
  - `passwordToForgotGap=11.36`
  - `forgotToSubmitGap=12.16`
  - `topDelta=0.00`
  - `centerYDelta=0.00`
- 创建房间弹窗：
  - `widthRatio=0.315`
  - `heightRatio=0.763`
  - `centerXRatio=0.500`
  - `centerYRatio=0.500`
  - `topDelta=0.00`
  - `centerYDelta=0.00`
- 加密房密码弹窗：
  - `surfaceWidthRatio=0.29`
  - `surfaceHeightRatio=0.48`
  - `centerXRatio=0.50`
  - `centerYRatio=0.50`
  - `inputHeight=17.89`
  - `confirmHeight=19.58`
  - `topDelta=0.00`
  - `centerYDelta=0.00`

## 我实际看到什么

- 登录弹窗直接对齐原始设计稿 `home-v2-auth-modal-target.png`，不再使用后来生成的“可实现目标稿”作为真相源；它已经回到书本中央的小纸面 modal，不再占据整屏。
- 登录与创建房间都使用同一套纸面壳层语法：浅金色纸面、同构标题、同构分割线、同类输入框、同类深绿色主按钮。
- 登录弹窗里的 `邮箱 / 密码 / 忘记密码 / 登录 / 登录|注册切换` 同时处于真实可视区；密码输入框恢复到可读但不臃肿的高度，E2E 已补 `passwordInputHeight` 与间距门禁。
- 创建房间弹窗与登录弹窗在宽度比例和水平居中上接近，能看出是同一类通用组件，而不是两个独立风格的弹窗。
- 加密房密码弹窗复用同一壳层并保持居中；它不再用登录弹窗的固定高度撑出大段空白，输入聚焦后也不会推动弹窗位置。
- 右上账号入口在未登录态显示 `登录`，没有再出现“玩家昵称”假文案。

## 是否达到本轮标准

- 达到：
  - 设计稿主语义已经恢复为“居中小纸面弹窗”，不是近满屏大面板；
  - `AuthModal`、`CreateRoomModal` 与加密房密码弹窗已统一到同一套通用纸面 modal 壳层；
  - 登录与加密房密码弹窗在输入聚焦后都没有整体位移，创建房间弹窗同样保持居中稳定。
- 仍保留后续审美优化空间：
  - 创建房间弹窗内容量大于登录目标稿，当前是“同壳层 + 内部滚动表单”的收敛方案；后续如果继续精修，重点应是压缩内部表单密度，而不是再改成满屏弹窗。
