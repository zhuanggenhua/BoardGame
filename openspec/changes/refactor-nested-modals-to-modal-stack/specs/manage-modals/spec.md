## MODIFIED Requirements

### Requirement: 弹窗内弹窗的栈语义（Nested Modals MUST use Modal Stack）
系统 MUST 支持“弹窗内再弹弹窗”的场景，并保证子弹窗永远处于栈顶且可交互。

#### Scenario: 详情弹窗内打开私密房密码弹窗
- **GIVEN** 用户已打开游戏详情弹窗（房间列表可见）
- **WHEN** 用户点击加锁房间的“加入”按钮
- **THEN** 系统 MUST 打开“私密房密码弹窗”作为栈顶弹窗
- **AND** 密码输入框与确认按钮 MUST 可见且可交互（不被详情弹窗遮罩覆盖）

#### Scenario: 子弹窗关闭后恢复父弹窗可交互
- **GIVEN** 私密房密码弹窗已打开
- **WHEN** 用户点击“取消”关闭密码弹窗
- **THEN** 系统 MUST 仅关闭子弹窗，并恢复详情弹窗为栈顶可交互弹窗

#### Scenario: 禁止 sibling 直接渲染另一个 ModalBase
- **GIVEN** 一个组件已作为弹窗内容（使用 `ModalBase`）渲染
- **WHEN** 该组件需要打开另一个弹窗
- **THEN** 它 MUST 通过 `useModalStack.openModal` 打开，而不是在 JSX 中以 sibling 方式直接渲染另一个 `ModalBase`
