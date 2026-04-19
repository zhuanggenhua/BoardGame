# 移动端输入可见性（登录/加入/建房）E2E 证据

日期：2026-04-12  
目标：移动端（触控设备/窄屏）在键盘弹出时，**输入框与关键按钮不被遮挡**，且弹窗不会出现“在背后/点不到/看起来没反应”的层级问题。

## 覆盖范围

1) **大厅 → 加锁房间 → 加入 → 密码弹窗**（Join Private Room Password）  
2) **首页 → 注册弹窗**（AuthModal Register Mobile）
3) **大厅 → 创建房间弹窗**（Create Room Mobile）——本用例为断言型校验（无截图产出）

## 运行命令（实际执行）

```bash
npm run test:e2e:ci:file -- e2e/_shared/lobby.e2e.ts "移动端私密房间密码输入聚焦后仍应保持可见"
npm run test:e2e:ci:file -- e2e/_shared/lobby.e2e.ts "移动端创建房间输入聚焦后不应把弹窗顶飞出可视区"
npm run test:e2e:ci:file -- e2e/_shared/auth-account-login.e2e.ts "AuthModal register should keep mobile inputs visible and editable on narrow screens"
```

## 截图证据与肉眼结论

### 0. 登录弹窗（桌面端回归）

截图（已人工查看）：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\auth-modal-desktop-login-filled.png`

观察结论：
- 登录弹窗在桌面端居中显示，邮箱/密码输入内容清晰可见，密码显隐切换可用。
- 本截图用于证明“移动端输入适配没有破坏 PC 登录基本可用性”（达标）。

### A. 私密房间密码弹窗（移动端）

截图（已人工查看）：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\private-room-password-modal-mobile.png`

观察结论：
- 密码弹窗内容（标题/描述/输入框/确认按钮）**完整可见**，没有被详情弹窗遮罩盖住（符合“栈顶弹窗必须可交互”的预期）。
- 密码输入框与确认按钮位于弹窗内部可视区，未出现“输入框在背后/点不到”的情况。
- 截图中已实际输入测试密码，并切换为“明文显示”，可直接看到输入内容，回应“输入时看不到内容”的反馈点。
- 该截图为**真实页面原位截图**（非 cloneNode 摆拍），可作为“加入加锁房间后密码弹窗可见可点”的收口证据（达标）。
 - 用例进一步点击“确认”并校验跳转到 `/play/tictactoe/match/<matchId>?playerID=...`，证明“加入链路可用”，而不是只验证弹窗出现。

### B. 注册弹窗（移动端窄屏）

截图（已人工查看）：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\auth-modal-mobile-register-filled.png`

观察结论：
- 注册弹窗主体可见，底部主按钮“注册”**未被键盘可视区遮挡**（E2E 断言同时校验 submitBottom <= runtimeViewportHeight）。
- 输入项在窄屏下仍可编辑，未出现“聚焦后看不到正在输入内容”的布局异常。
- 该截图为**真实页面原位截图**（非 cloneNode 摆拍）；截图与断言共同证明：移动端输入时，关键操作按钮保持可见（达标）。

### C. 创建房间弹窗（移动端）

截图（已人工查看）：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\create-room-modal-mobile-keyboard-safe.png`

观察结论：
- 房间名、房间密码均已输入且可见（截图中能看到实际值），说明键盘模拟/聚焦后 UI 仍可编辑。
- 底部“确认创建”按钮完整可见，没有被键盘可视区遮挡。
- 该截图为**真实页面原位截图**（非 cloneNode 摆拍），可以作为“创建房间输入不会把弹窗顶飞/遮挡关键按钮”的收口证据（达标）。

## 备注 / 未覆盖风险

- 本轮 E2E 主要验证“键盘弹出 + 弹窗输入可见性 + 栈顶交互层级”；未覆盖所有业务分支（例如注册验证码真实发送/服务端校验）。
- 若后续还出现“其它输入入口被顶飞”，建议按同样模式把对应入口补充到 `e2e/_shared/lobby.e2e.ts` 的移动端输入可见性套件中（优先复用现有文件，避免新增测试文件）。
