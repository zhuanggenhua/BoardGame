## Context
- 当前《七大恨》已经具备独立剧本前置页，但正式棋盘仍同时承载地图判断、轮盘推进、势力行动、支付弃牌与若干瞬时选择。
- 用户已明确要求当前正式棋盘里的真实可操作 UI 必须有固定位置，说明类内容不得继续抢主交互槽位。
- 项目内已有成熟来源可复用：大杀四方的 `PromptOverlay`、`HandArea`、`MeFirstOverlay` 已验证“固定承载层 + 单一主焦点”模式。

## Goals
- 让《七大恨》棋盘形成稳定的右侧行动壳层与底部手牌壳层。
- 让轮盘推进、势力支付、手牌超限弃牌等关键步骤都具备明文 CTA。
- 让关键截图证据可一眼读懂，不再需要靠内部 test id 猜步骤。

## Non-Goals
- 不重做《七大恨》整套视觉风格。
- 不在本次变更里重写地图规则或区域工具链。

## Decisions
1. 右侧行动区作为“文本说明 + 候选按钮 + 状态条”的唯一主 rail，允许内部滚动，但不再把底部手牌选择职责塞进右侧栏。
2. 底部手牌区作为“支付/弃牌/手牌目标选择”的唯一承载层，相关确认条附着在底部槽位附近，不抢占右侧 rail。
3. 当轮盘阶段成为唯一下一步时，右侧 rail 必须出现明文 CTA 按钮组，左侧轮盘盘面只保留辅助可视化语义。
4. 关键证据截图必须用中文表达“页面/阶段 + 动作对象 + 状态”，避免目录本身再次成为歧义源。

## Source References
- `src/games/smashup/ui/PromptOverlay.tsx`
- `src/games/smashup/ui/HandArea.tsx`
- `src/games/smashup/ui/MeFirstOverlay.tsx`
- `design-system/game-ui/MASTER.md` 4.4 / 4.5 / 4.7 / 4.8 / 4.9
