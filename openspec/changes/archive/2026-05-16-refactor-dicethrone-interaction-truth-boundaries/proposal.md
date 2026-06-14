# Change: 收束 DiceThrone 交互真相边界与阻塞前台承载

## Why
DiceThrone 当前把三类不同职责混在了一起：

- `simple-choice` 同时承载“真正的分支选择”和“4 人 targetingRoll 受击者选择”。
- 部分阻塞式前台交互已经走 modal stack，但 `compare-roll-choice`、交互型 `dt:bonus-dice` 仍绕过栈直接以前景 overlay 呈现。
- 结果是“本不该弹选择的弹了选择”“弹到一半被别的阻塞前台抢走”“同一条攻击链上 ownership 消失”这类问题重复出现。

这不是单点 bug，而是底层语义边界与前台承载约束不够严格。

## What Changes
- 把 DiceThrone 的“受击者选择”从 `simple-choice` / 通用 `selectPlayer` 语义中剥离，建立专用交互模型。
- 收束 `simple-choice` 的职责，只保留真正的通用分支/数值/按钮选择。
- 统一约束：凡由 `sys.interaction` 或 `responseWindow` 驱动、会阻塞业务推进的前台交互，默认必须通过 modal stack 承载。
- 将 `compare-roll-choice` 与交互型 `dt:bonus-dice` 纳入 modal stack；仅纯展示、非阻塞的 bonus die spotlight 允许保留 overlay。
- 更新通用规范，明确“单一真相”“单一职责”“阻塞交互默认栈化”的底层约束。

## Impact
- Affected specs:
  - `interaction-system`
  - `manage-modals`
- Affected code:
  - `src/games/dicethrone/domain/*` 中与 targetingRoll、interaction、bonus die、compare roll 相关实现
  - `src/games/dicethrone/Board.tsx`
  - `src/games/dicethrone/hooks/useDiceThroneState.ts`
  - `src/games/dicethrone/ui/*` 中相关前台组件
  - 现有 DiceThrone 测试与证据文档
