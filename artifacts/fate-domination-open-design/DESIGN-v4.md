# Fate/Domination OpenDesign 开放式牌桌候选稿 v4

## 状态

- `open-design-artifact-candidate`
- 人工设计验收：`not-approved`
- v4 是基于用户新棋盘标注的重构稿；v2/v3 仅保留作历史，不再作为当前布局依据。

## 参考与核心判断

- 用户提供的 `repository-relative-reference-not-committed` 仅是棋盘交互分区的坐标参考，不进入画面。
- 参考图的空间语言采用开放式牌桌：中央棋盘、左右席位、顶部牌库、底部扇形手牌、右下阶段按钮。
- 手牌区参考 DiceThrone 的实体牌堆：五张真实牌重叠排列，选中上浮，检查入口在牌外沿。

## 方格交互合同

- 测试阶段默认开启 `测试标记`。
- A1/A2、B1/B2/B3、C、D1/D2、E、F、G、H 均为可点击热点。
- 每个热点使用白色半透明遮罩覆盖对应方格，并显示原图字母/区域编号。
- 点击后热点变为 cyan 高亮，底部短提示同步显示区域编号与语义。
- 顶部 `测试标记` 开关只隐藏覆盖层，不删除热点的布局定义；正式态可继续复用同一坐标映射。

## 区域映射

| 标记 | 交互责任 |
|---|---|
| A1 / A2 | 事件牌槽与中央局势/区域卡面 |
| B1 | 目标牌槽 |
| B2-1..3 | 深山町三个区域格 |
| B3-1..2 | 新都两个区域格 |
| C1..4 | 远坂工房四个资源格 |
| D1-1..2 | 深山町加成格 |
| D2-1..2 | 新都加成格 |
| E1..3 | 各区域行动出口 |
| F1..2 | 右侧 Servant 轨道分区 |
| G | 侦察入口 |
| H | 分数轨道 |

## 区域职责

| 区域 | 责任 |
|---|---|
| 中央棋盘 | 唯一主视觉，承载所有可交互方格和测试标记 |
| 左右席位 | 对手/竞争者的简短位置与 VP |
| 顶部 | 回合、牌库、供应/记录/菜单、测试开关 |
| 底部扇形手牌 | 真实手牌、选择态、检查入口 |
| 左下 YOU | 当前身份与资源 |
| 右下阶段 | 当前阶段与下一阶段确认 |

## 素材账本

- `assets/fuyuki-city.webp`：项目正式未标注冬木市棋盘，作为实际主棋盘画面。
- `repository-relative-reference-not-committed`：仅作为交互坐标参考图，不进入设计稿画面；画面中的白色遮罩和字母均由 HTML 交互层绘制。
- `assets/event-back.webp`：项目正式事件牌背。
- `assets/master-emiya.webp`、`assets/master-slot-b.webp`：项目正式 Master 素材。
- `assets/attack-magic-low.webp`、`assets/attack-strength-high.webp`、`assets/skill-luck.webp`、`assets/skill-moment.webp`：项目正式手牌素材。
- 未生成新媒体，未使用 CSS 卡牌占位图。

## 验收尺寸

- PC：1920×1080，无横向溢出，棋盘、席位、手牌和阶段控件同屏。
- 移动：390×844，棋盘先展示，手牌与阶段控件继续按层级纵向滚动。
- OpenDesign artifact：`fate-domination-v4-2.html`
- 设计项目：`b4bb4fbb-ee71-4465-9e34-e4c24f397155`
