# Summoner Wars UI 设计合同

本文件只写 Summoner Wars 的长期 UI 合同。源码现状以 [`Board.tsx`](../../src/games/summonerwars/Board.tsx)、[`manifest.ts`](../../src/games/summonerwars/manifest.ts) 和 [`ui/`](../../src/games/summonerwars/ui/) 为准；一次性实现计划和历史任务不写进这里。

## 当前边界

- **模式**：仅在线对战；[`games.config.tsx`](../../src/config/games.config.tsx) 与 [`manifest.ts`](../../src/games/summonerwars/manifest.ts) 均为 `allowLocalMode: false`，不要为本地同屏另起 UI 壳层。
- **主入口**：局内布局由 [`Board.tsx`](../../src/games/summonerwars/Board.tsx) 编排，核心组件是 [`MapContainer`](../../src/games/summonerwars/ui/MapContainer.tsx)、[`BoardGrid`](../../src/games/summonerwars/ui/BoardGrid.tsx)、[`HandArea`](../../src/games/summonerwars/ui/HandArea.tsx)、[`PhaseTracker`](../../src/games/summonerwars/ui/PhaseTracker.tsx)、[`StatusBanners`](../../src/games/summonerwars/ui/StatusBanners.tsx) 和 [`CardSprite`](../../src/games/summonerwars/ui/CardSprite.tsx)。
- **牌组入口**：自定义牌组已有 [`DeckBuilderDrawer`](../../src/games/summonerwars/ui/DeckBuilderDrawer.tsx)、[`CustomDeckCard`](../../src/games/summonerwars/ui/CustomDeckCard.tsx)、[`useDeckBuilder`](../../src/games/summonerwars/ui/deckbuilder/useDeckBuilder.ts)、[`deckSerializer`](../../src/games/summonerwars/config/deckSerializer.ts) 和 [`deckBuilder`](../../src/games/summonerwars/config/deckBuilder.ts)；文档只指向这些真相源，不维护第二套规则接口。

## 设计原则

- **实体卡牌**：手牌、棋盘单位、牌库和弃牌堆应保持“同一实体卡牌”的语义；不要做成卡牌打出后消失、只剩抽象单位的表现。
- **对象直选**：玩家操作以点击 / 触屏选择对象、再选择合法目标为主；拖拽只能是补充体验，不能成为唯一合法路径。
- **职责分层**：`HandArea` 负责手牌可见性和手牌选择；`BoardGrid` 负责格子、单位、移动和攻击目标；`StatusBanners` 负责解释当前待响应选择；`PhaseTracker` 只表达阶段和结束动作。
- **同构多端**：桌面和移动端复用同一局内结构，差异只落在尺寸、安全区、触控反馈和可读性，不新增平行页面。

## 布局合同

- 棋盘是第一视觉层，承载地图、格子、单位卡牌和目标高亮。
- 手牌位于底部，必须能展示卡牌图、费用 / 不可用状态、选中态和放大查看入口。
- 阶段、魔力、牌库、弃牌堆和结束阶段按钮是边缘操作区；不得遮挡棋盘关键格子或手牌目标。
- 事件卡、弃牌、牌组和自定义牌组入口使用局内卡牌视觉语言，不做独立样式体系。

## 状态反馈

- 合法目标必须在执行前可见：召唤、移动、攻击、事件卡目标分别用可区分的高亮或提示。
- 非法目标必须明确拒绝：费用不足、阶段不符、目标不合法、对象不可用时，要让玩家知道当前不能做什么。
- 单位状态必须贴在实体卡牌上：伤害、增益 / 减益、已行动、被选中、濒死或销毁都不能只出现在日志里。
- 状态文案只解释当前选择和后果，不把规则书长段落塞进局内主视图。

## 动效合同

- 动画必须跟随真实结算事件：召唤、移动、攻击、受伤、死亡、弃牌、魔力变化和阶段切换不得只做本地假动画。
- 动效优先表达因果：从来源对象到目标对象、从命令到结果、从消耗到数值变化。
- 动效可以降级，但降级后仍要保留可见结果、目标对象和结算反馈。

## 资源与数据

- 卡图统一通过 `CardSprite` 与图集配置渲染；不要在设计文档里维护 `cardId -> frameIndex` 手写表。
- 新阵营、新卡牌和新图集的真相源在游戏配置、资源 manifest 与对应数据文件；本文件只规定 UI 如何消费。
- 牌组构筑规则以现有 `deckbuilder` / `deckSerializer` / 域类型实现为准；文档不保留过时接口草案。

## 验收口径

- 新增或改动交互时，先用最窄真实入口证明玩家可以完成动作、看到结果、收到非法分支拒绝。
- 进入主黄金链前，局部机制必须已接入正式 UI、规则结算和可解释结果；不能用 fixture、截图数量或相邻机制外推为已覆盖。
- 视觉验收只在稳定候选阶段做；过程截图只能作为诊断证据，不作为本合同完成信号。
