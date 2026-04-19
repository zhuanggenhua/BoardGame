# 登录注册与反馈表单移动端 E2E 验收

## 范围

- 登录/注册弹窗：`src/components/auth/AuthModal.tsx`
- 账户设置与换绑邮箱弹窗：`src/components/auth/AccountSettingsModal.tsx`、`src/components/auth/EmailBindModal.tsx`
- 反馈弹窗：`src/components/system/FeedbackModal.tsx`
- 相关样式：`src/index.css`
- 相关 E2E：`e2e/auth-account-login.e2e.ts`、`e2e/lobby.e2e.ts`、`e2e/dicethrone.e2e.ts`

## 本轮运行记录

- `npm run typecheck`
- `npx eslint src/components/auth/AuthModal.tsx src/components/auth/AccountSettingsModal.tsx src/components/auth/EmailBindModal.tsx src/components/system/FeedbackModal.tsx e2e/auth-account-login.e2e.ts e2e/account-settings.e2e.ts`
- `npm run test:e2e:ci:file -- auth-account-login.e2e.ts`
- `npm run test:e2e:ci:file -- e2e/account-settings.e2e.ts`
- `npm run test:e2e:ci:file -- lobby.e2e.ts "移动端反馈"`
- `npm run test:e2e:ci:file -- e2e/dicethrone.e2e.ts "Tutorial landscape feedback keeps inputs visible in game HUD"`
- `npm run test:e2e:ci:file -- dicethrone.e2e.ts "Tutorial landscape feedback keeps inputs visible in game HUD"`（2026-04-08 复跑，通过）
- `npx eslint e2e/lobby.e2e.ts e2e/auth-account-login.e2e.ts src/components/auth/AuthModal.tsx src/components/auth/AccountSettingsModal.tsx src/components/auth/EmailBindModal.tsx src/components/auth/AvatarUpdateModal.tsx src/components/common/overlays/ConfirmModal.tsx src/components/common/overlays/PasswordEntryModal.tsx src/components/lobby/CreateRoomModal.tsx src/components/lobby/RoomList.tsx src/components/social/FriendsChatModal.tsx src/components/system/FeedbackModal.tsx`
- `npm run test:e2e:ci:file -- lobby.e2e.ts "移动端创建房间输入聚焦后不应把弹窗顶飞出可视区"`（2026-04-08 复跑，通过）
- `npm run test:e2e:ci:file -- auth-account-login.e2e.ts "AuthModal register should keep mobile inputs visible and editable on narrow screens"`（2026-04-08 复跑，通过）
- `npx eslint src/components/lobby/CreateRoomModal.tsx src/components/social/FriendList.tsx src/components/game/framework/widgets/GameHUD.tsx e2e/review.e2e.ts`
- `npm run test:e2e:ci:file -- auth-account-login.e2e.ts "AuthModal register should keep mobile inputs visible and editable on narrow screens"`（2026-04-09 复跑，通过）
- `npm run test:e2e:ci:file -- account-settings.e2e.ts "移动端账户设置与邮箱绑定输入应保持可见可编辑"`（2026-04-09 复跑，通过）
- `npm run test:e2e:ci:file -- social.e2e.ts "移动端社交聊天输入聚焦后仍应保持可见"`（2026-04-09 复跑，通过）
- `PW_SERVER_RUNTIME=tsx node scripts/infra/run-e2e-single.mjs ci --file e2e/review.e2e.ts --case "移动端评价输入聚焦后仍应保持可见"`（2026-04-09 复跑，通过；详见 `evidence/review-mobile-input-e2e-test.md`）
- `PW_SERVER_RUNTIME=tsx BG_HEAVY_MEMORY_MIN_FREE_GB=1 node scripts/infra/run-e2e-single.mjs ci --file e2e/lobby.e2e.ts --case "移动端创建房间输入聚焦后不应把弹窗顶飞出可视区"`（2026-04-09 复跑，通过）
- `PW_SERVER_RUNTIME=tsx BG_HEAVY_MEMORY_MIN_FREE_GB=1 node scripts/infra/run-e2e-single.mjs ci --file e2e/lobby.e2e.ts --case "移动端私密房间密码输入聚焦后仍应保持可见"`（2026-04-09 复跑，通过；详见 `evidence/private-room-password-mobile-e2e-test.md`）

## 截图核验

### 1. 桌面端登录弹窗

- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\auth-modal-desktop-login-filled.png`
- 我实际看到的现象：
  - 桌面端登录弹窗完整居中显示，没有被移动端样式挤压成窄条或超高单列。
  - 邮箱输入框里能直接看到 `test@example.com`，密码框里有已输入的掩码点，说明输入内容没有出现“框打开了但字看不见”的问题。
  - “登录”主按钮和“忘记密码？”入口都还在桌面端原有布局里，没有被挤出弹窗底部。
- 是否达到本轮验收标准：达到。
  - 已证明这轮移动端适配没有把 PC 登录弹窗带歪，桌面端仍保持可用且输入内容可见。

### 2. 移动端注册弹窗

- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\auth-modal-mobile-register-filled.png`
- 我实际看到的现象：
  - 当前这张快照实际拍到的是注册弹窗的下半段：能看到昵称、密码输入区和主提交按钮都还在同一个弹窗内，没有被键盘态挤掉。
  - 主提交按钮完整可见，说明短高度下弹窗底部主操作区仍留在可操作区域。
  - 这张图没有直接把邮箱/验证码区域拍进去，因此它本身不足以单独证明顶部输入区；顶部输入区可见性来自同一用例里的值断言与布局断言：`remembered@example.com`、`123456` 成功写入，且 `emailBottom / codeBottom / submitBottom <= runtimeViewportHeight`。
- 是否达到本轮验收标准：达到，但这张截图只能作为部分证据。
  - 登录/注册移动端输入区是否仍可见，最终以同一条 E2E 的真实输入值断言和布局断言为主；截图补充证明了下半段输入区与提交按钮没有被挤飞。

### 3. 游戏内横屏反馈弹窗

- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-feedback-modal-landscape.png`
- 我实际看到的现象：
  - 这是 2026-04-08 复跑得到的整页视口截图，背景仍是游戏页而不是大厅替代页，说明证据来自游戏内 HUD 真实入口。
  - 横屏短高度下，描述输入框、`附带操作日志`、`附带状态快照`、联系方式输入框和底部提交按钮都同时留在视口内，没有再把联系方式输入区挤出底部。
  - 实际输入值 `游戏内横屏反馈输入可见性校验` 与 `tester@example.com` 清晰可见，说明不是“弹窗开了但输入内容看不见”。
  - 游戏内已知 `gameId` 会直接带入反馈上下文，因此横屏场景下不会再额外占一行游戏选择输入。
- 是否达到本轮验收标准：达到。
  - 已证明你刚强调的“游戏里是横屏”这条真实链路下，反馈输入区、联系方式输入框和提交区都没有再被短高度挤掉。

### 4. 移动端账户设置弹窗

- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\account-settings-mobile-password-inputs.png`
- 我实际看到的现象：
  - 账户设置弹窗在手机宽度下仍完整显示，密码编辑区展开后 3 个密码输入框都在弹窗内部，没有横向溢出。
  - 输入后能看到 3 行密码掩码点，说明不是“打开输入框但内容看不见”。
  - 底部“取消 / 修改密码 / 关闭”按钮仍留在可操作区域里，没有被输入区挤出弹窗。
- 是否达到本轮验收标准：达到。
  - 已证明账户设置里最容易出问题的密码输入链路，在移动端仍可见、可编辑。

### 5. 移动端换绑邮箱弹窗

- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\email-bind-mobile-verify-input.png`
- 我实际看到的现象：
  - 换绑邮箱已经进入验证码校验步骤，6 位验证码输入区完整可见，输入值 `1 2 3 4 5 6` 清楚显示。
  - “确认绑定”主按钮和“60秒后可重新发送 / 取消”都还在视口内，没有被键盘区或底部安全区顶掉。
  - 当前邮箱与目标邮箱都能在弹窗正文里看到，说明换绑链路的关键信息和输入区没有被遮挡。
- 是否达到本轮验收标准：达到。
  - 已证明邮箱绑定/换绑链路在移动端验证步骤下，输入区与主操作按钮仍然可见。

### 6. 移动端反馈弹窗

- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\lobby-feedback-modal-mobile.png`
- 我实际看到的现象：
  - 反馈弹窗覆盖在页面之上，头部、游戏选择、类型、优先级、描述、联系方式和提交按钮都完整可见。
  - 类型和优先级仍保持双列信息关系，没有被我改成不必要的单列手机稿。
  - 描述输入框里能看到“移动端反馈输入可见性校验”，输入内容清晰可辨。
  - 底部“提交反馈”按钮没有被键盘区、安全区或 FAB 面板遮挡。
- 是否达到本轮验收标准：达到。
  - 已证明反馈表单的关键输入区与提交区在移动端仍然可见、可输入、可提交。

### 7. 移动端创建房间弹窗

- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\create-room-modal-mobile-keyboard-safe.png`
- 我实际看到的现象：
  - 建房弹窗主体完整保留，房间名称、房间密码、房间保存和加入 AI 这几个核心输入/选择区都还在同一张弹窗里，没有被键盘态顶飞。
  - 房间名输入值和密码 `123456` 都已经落进输入框可视区，说明不是“聚焦后只有输入框壳子还在，输入内容看不见”。
  - 底部“取消 / 确认创建”按钮仍留在弹窗底部可操作区，没有掉到键盘下方。
  - 这张图来自真实大厅 -> 游戏详情 -> 创建房间链路，在布局断言通过后对当前弹窗 DOM 快照取图，只用于稳定留证，不改变业务样式或交互逻辑。
- 是否达到本轮验收标准：达到。
  - 已证明创建房间这条用户刚重点指出的输入链路，在移动端键盘态下输入区和确认按钮都还可见。

### 8. 移动端社交聊天输入

- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\social-chat-mobile-input-visible.png`
- 我实际看到的现象：
  - 这次截图已经是聊天详情页，不再是旧的好友列表页；顶部能看到“返回 / 好友甲 / 在线”，中间是消息记录，底部是输入框与发送按钮。
  - 输入框里清楚能看到 `移动端社交聊天输入可见性校验`，说明不是“输入框聚焦了但内容看不见”。
  - 输入框仍完整留在弹窗底部可视区，发送按钮没有被键盘态或底部安全区顶掉。
- 是否达到本轮验收标准：达到。
  - 已证明社交聊天这条移动端输入链路当前可见、可编辑、可发送。

## 当前补充收口

### A. 创建房间 / 私密房间密码链路已补齐独立证据

- 最新通过命令：`PW_SERVER_RUNTIME=tsx BG_HEAVY_MEMORY_MIN_FREE_GB=1 node scripts/infra/run-e2e-single.mjs ci --file e2e/lobby.e2e.ts --case "移动端私密房间密码输入聚焦后仍应保持可见"`
- 最新有效证据：`evidence/private-room-password-mobile-e2e-test.md`
- 当前状态：
  - 2026-04-09 这轮已经补到真实密码弹窗截图 `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\private-room-password-modal-mobile.png`，不再是大厅页误截图。
  - 弹窗标题、密码输入框、眼睛按钮、取消/确认按钮都在同一张图内可见，因此这条链路现在可以作为已验收通过的有效证据。
  - 本文档保留这里只做总表汇总；私密房密码的逐图观察和最终结论，以独立证据文档为准。

### B. 用户可见输入入口横向排查结论

- 本轮额外用代码搜索复查了用户可见范围内的输入组件：`AuthModal`、`AccountSettingsModal`、`EmailBindModal`、`FeedbackModal`、`ReviewForm`、`CreateRoomModal`、`PasswordEntryModal`、`FriendList`、`ChatWindow`、`GameHUD`、`SetupOptionsFields`、`SummonerWars/MyDeckPanel`。
- 排查口径明确排除了 `admin / devtools / debug-config / UGC builder` 这类非普通用户主流程页面，避免把后台和调试面板混进本轮收口。
- 复查中补到的剩余缺口有两个：
  - `SetupOptionsFields` 的 `select` 仍写着 `text-sm`；现已补成 `text-base sm:text-sm`，确保建房模态里的游戏自定义 setup 选项在移动端也遵守 16px 输入基线。
  - `SummonerWars/MyDeckPanel` 的牌组命名输入框原来也是 `text-sm`；现已补成 `text-base sm:text-sm`，避免移动端牌组保存时再次出现“输入框里字太小 / 聚焦易被系统缩放干扰”的同类问题。

## 记住输入验收

- 对应 E2E：`AuthModal should preserve remembered identifiers across mode switches and persist drafts`
- 本轮实际验证了三件事：
  - 注册态填写邮箱与昵称后，切到登录态时账号输入框会带回邮箱。
  - 再切回注册态时，邮箱与昵称不会丢。
  - 关闭弹窗后重新打开注册弹窗，邮箱与昵称仍会从 remembered draft 回填。
- 验收边界：
  - 只记住非敏感识别信息：账号、邮箱、昵称、找回密码邮箱。
  - 验证码、密码、确认密码不会被持久化。

## 结论

- 已稳定拿到并肉眼核对的有效证据：登录/注册、账户设置、换绑邮箱、移动端反馈、游戏内横屏反馈、评价弹窗、创建房间、私密房间密码、社交聊天。
- 这轮额外把 `CreateRoomModal`、`SetupOptionsFields`、`SummonerWars/MyDeckPanel`、社交添加搜索输入、游戏内聊天输入补成了 **移动端 16px 优先 / PC 保持原样** 的条件化输入字号，不改 PC 基线。
- PC 登录弹窗已回归核验，没有被移动端输入适配带坏。
- 登录/注册流程的“记住输入”当前已覆盖切模式和关闭重开两类场景，但只保留非敏感字段。
- 评价弹窗已在 2026-04-09 通过最新复跑并单独落地 `evidence/review-mobile-input-e2e-test.md`。
- 创建房间/私密房间密码链路已在 2026-04-09 通过最新复跑并单独落地 `evidence/private-room-password-mobile-e2e-test.md`，总表状态同步更新为已收口。
