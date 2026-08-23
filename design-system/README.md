# 设计系统

本目录是游戏 UI 的设计参考，不替代 `.spec/knowledge/standards/ui-ux.md` 和具体游戏设计合同。

## 职责

| 目录 | 职责 |
| --- | --- |
| [`game-ui/MASTER.md`](game-ui/MASTER.md) | 通用交互原则：反馈、状态、动效、可读性 |
| [`styles/`](styles/) | 可复用视觉风格 token 和组件语法 |
| [`games/`](games/) | 单游戏视觉合同、素材约束和专属覆盖 |

## 使用顺序

1. 先读 [`game-ui/MASTER.md`](game-ui/MASTER.md) 获取交互底线。
2. 选择一个基础风格：[`arcade-3d`](styles/arcade-3d.md)、[`tactical-clean`](styles/tactical-clean.md) 或 [`classic-parchment`](styles/classic-parchment.md)。
3. 再读 `games/<gameId>.md`；单游戏合同可以覆盖基础风格，但必须说明覆盖原因。
4. 若游戏没有专属合同，先建 `games/<gameId>.md`，不要把单游戏规则写回基础风格。

## 风格选择

| 风格 | 适用 | 不适用 |
| --- | --- | --- |
| `arcade-3d` | 派对、骰子、轻策略、强按钮反馈 | 高密度战棋、严肃信息面 |
| `tactical-clean` | 策略、卡牌对战、棋类、规则密集界面 | 需要强实体桌游质感的页面 |
| `classic-parchment` | 复古、规则书、实体卡牌、温暖桌面 | 高科技 HUD、竞技数据面 |

## 新增风格

新增 `styles/<style>.md` 时只写五类内容：

- 风格定位和适用 / 不适用场景。
- 颜色 token。
- 组件语法：按钮、面板、卡牌、状态、棋盘。
- 动效范围。
- 禁止项。

不要在基础风格里写具体游戏截图、素材合同、卡牌规则或一次性设计过程。
