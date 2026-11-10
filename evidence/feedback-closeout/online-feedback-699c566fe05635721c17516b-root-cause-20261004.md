# 线上反馈 699c566fe05635721c17516b：破隐一击后武僧防御卡住

## 反馈原文

> 暗影贼使用破隐一击后对面武僧防御投掷后卡住进行不了了

## 根因定位

按反馈步骤重建为：暗影贼 `kidney-shot`（破隐一击）→ 武僧 `meditation` 防御→防御骰确认→武僧持有太极 Token。

领域状态在防御方点击 `ADVANCE_PHASE` 后会**有意停在**：

- `sys.phase = defensiveRoll`
- `sys.flowHalted = true`
- `sys.interaction.current.kind = dt:token-response`
- `sys.interaction.current.playerId = 1`
- `core.pendingDamage.responderId = 1`
- 可选动作：使用太极，或提交 `SKIP_TOKEN_RESPONSE`

因此卡住点不是破隐一击伤害计算，也不是防御骰未结算，而是防御结束后进入了武僧的 Token 响应窗口；此时继续点阶段按钮不会推进阶段，必须在武僧视角完成响应。

## 处理方式

- 保留领域层的响应窗口状态机：响应窗口打开时锁住 `ADVANCE_PHASE`，避免绕过 Token 响应。
- 在棋盘层按 `pendingDamage.responderId === rootPid` 显示统一响应提示，把 `USE_TOKEN` 与 `SKIP_TOKEN_RESPONSE` 直接接到武僧页面。
- 新增同一条反馈步骤的真实浏览器回归：验证武僧页面能看到 `dicethrone-response-pass-button`，点击后状态从 `defensiveRoll` 收口到 `main2`。

## 验证

- 领域：`kidney-shot-damage-bug.test.ts`、`shadow-thief-abilities.test.ts`、`tokenResponseChoiceContract.test.ts` —— 75 项通过。
- 浏览器：`e2e/dicethrone/feedback-699c566fe05635721c17516b.e2e.ts` —— 1 项通过。
- 当前工作树已证明该链在本地当前版本可完成；线上是否已生效仍取决于包含当前版本的生产发布，未在本轮擅自宣称已上线。
