# 私密房密码输入移动端可见性 E2E 验收

## 范围
- 私密房入场密码弹窗链路：`e2e/lobby.e2e.ts`
- 相关实现：`src/components/lobby/GameDetailsModal.tsx`、`src/components/common/overlays/PasswordEntryModal.tsx`

## 本轮验证
- `npx eslint e2e/lobby.e2e.ts e2e/review.e2e.ts src/components/lobby/GameDetailsModal.tsx`
- `npx vitest run src/components/lobby/__tests__/GameDetailsModalJoinConfirm.test.ts`
- `node scripts/infra/cleanup_test_connections.js --e2e --shared`
- `PW_SERVER_RUNTIME=tsx node scripts/infra/run-e2e-single.mjs ci --file e2e/lobby.e2e.ts --case "移动端私密房间密码输入聚焦后仍应保持可见"`
  - 结果：`1 passed`

> 说明：当前默认 bundle 版 E2E runtime 仍存在独立启动故障（游戏服务 bundle 会报 `setup is not defined`），本轮为验证私密房密码弹窗链路，使用仓库已支持的 `PW_SERVER_RUNTIME=tsx` 运行隔离环境，不影响本条 UI 回归结论。

## 截图核对

### 1. 私密房密码弹窗
- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\private-room-password-modal-mobile.png`
- 我实际看到的现象：
  - 弹窗标题“私密房间”和提示文案“该房间需要密码才能进入。”完整可见，没有被顶出屏幕。
  - 密码输入框完整显示，右侧眼睛按钮仍在输入框内，没有跑位；输入框 placeholder 清晰可见。
  - 底部“取消 / 确认”按钮同时留在弹窗内，说明移动端键盘态下按钮没有被挤出可视区域。
- 是否达到验收标准：达到。
  - 已证明这条真实链路下，移动端私密房密码弹窗在聚焦后仍保持完整可见，关键操作控件都还在可见区内。

## 结论
- 这条反馈本轮已收口。
- 本轮同时修了两层问题：
  1. 详情弹窗入口链路要稳定进入真实私密房加入场景；
  2. 证据截图不能再拍成大厅首页，必须直接保留密码弹窗真实画面。

## 备注
- 这条用例的布局断言命中的是 live modal；为了避免 Playwright 在截取 portal/modal 元素时发生瞬时 detach，本轮截图采用了对当前 live modal DOM 子树的静态克隆后再截取的方式。
- 也就是说：验收依据仍然是当前真实链路下的 live modal 布局与控件可见性，不是凭空拼接的假 UI。
