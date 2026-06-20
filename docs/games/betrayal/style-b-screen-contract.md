# 山屋惊魂运行时页面级布局合同（历史文件名保留）

> 用途：把当前继续收敛的运行时母版变成可直接承接前端 skeleton 的实现合同。
> 当前边界：本文件只服务 `foundation` 阶段的最小运行态、角色选择和终局界面，不代表完整玩法已进入实现。
> 说明：文件名里的 `style-b` 仅是历史命名保留；当前口径已经改成“沿用 `betrayal-runtime-prehaunt-board-v4` 继续收敛”，不再默认做独立风格分叉。

## 1. 当前基线

- 运行时布局母版：`docs/games/betrayal/design/generated/betrayal-runtime-prehaunt-board-v4.png`
- 历史风格参考：`docs/games/betrayal/design/generated/betrayal-runtime-prehaunt-style-b.png`
- 角色选择稿：`docs/games/betrayal/design/generated/betrayal-character-select-style-b.png`
- 终局稿：`docs/games/betrayal/design/generated/betrayal-endgame-style-b.png`

## 2. 当前统一风格口径

- 风格要求只有一个：和素材统一。
- 当前仍然保留山屋惊魂的暗绿墙纸、铜黄边框、旧纸卡面语法。
- `style-a / style-b / style-c` 不再是默认要比较的分支；这里只有一条继续收敛线。
- 当前继续线默认以 `betrayal-runtime-prehaunt-board-v4.png` 为版式合同：
  - 不新增新的常驻大区块；
  - 不把原右侧单一区改拆成多块状态面板；
  - 不在左侧再长出第二块焦点卡大区；
  - 任何规则补强都先在 `v4` 既有槽位内解决。

## 3. 当前代码可直接承接的骨架

当前仓库里已经存在以下可直接承接 `style-b` 的框架层骨架：

- 角色选择：`src/components/game/framework/CharacterSelectionSkeleton.tsx`
- 玩家面板：`src/components/game/framework/PlayerPanelSkeleton.tsx`
- 资源托盘：`src/components/game/framework/ResourceTraySkeleton.tsx`
- 操作栏：`src/components/game/framework/ActionBarSkeleton.tsx`
- 阶段 HUD：`src/components/game/framework/PhaseHudSkeleton.tsx`

结论：`style-b` 不要求从零发明一套 UI 组件；它更像是“给现有 skeleton 指定皮肤、槽位和数据合同”。

## 4. 运行时页面合同

### 4.1 页面目标

- 页面语义：`pre-haunt` 运行时主界面
- 页面职责：让玩家一眼看清 `当前是谁`、`当前在哪`、`当前手上有什么`、`当前更可能做什么`
- 页面禁止项：
  - 不出现资源目录页语义
  - 不常驻整张参考卡
  - 不常驻大段规则说明
  - 不在按钮下方或旁边常驻解释按钮功能
  - 不假装已经进入完整 haunt / 剧本交互

### 4.2 区域划分

1. 顶部状态条
   - 左：标题横幅 / 游戏名
   - 中：阶段
   - 右：当前回合玩家、剩余移动、设置入口
2. 左侧玩家区
   - 当前探索者大卡
   - 当前探索者属性轨道
   - 当前探索者持有区：要考虑超出 `2 Item + 1 Omen` 的承载，但默认只能通过同一区域内缩放、叠放、扇形或折叠处理，不新增第二块大焦点卡区
   - 其他玩家摘要
3. 中央主视区
   - 房间板块拼接区
   - 当前探索者所在房间高亮
   - 当前主行动对象优先在这里被看到
4. 右侧牌堆区
   - `Omen / Item / Event` 抽牌堆
   - 弃牌堆
   - 仅保留帮助 / 放大 / 查看入口，不展开参考卡正文，也不拆出额外状态区块
5. 底部动作条
   - 至少有：`move`、`explore`、`trade`、`use`、`end turn`
   - 其中一个动作可以高亮为当前推荐动作，同时要能区分 `可用 / 已完成 / 当前推荐`
   - 主 UI 里按钮只保留动作标签；功能解释只能通过 hover tip / 小问号入口 / 帮助层提供

### 4.3 最小动态状态

运行时 skeleton 至少要有以下状态字段，哪怕暂时用假数据：

- `phase`
- `currentPlayer`
- `movesRemaining`
- `recommendedAction`
- `activeRoomId`
- `currentExplorer`
- `currentExplorerTraits`
- `currentExplorerInventory`
- `otherExplorers`
- `deckCounts`
- `discardCounts`

### 4.4 与框架骨架的映射

- 顶部状态条：`PhaseHudSkeleton`
- 左侧玩家区：`PlayerPanelSkeleton`
- 右侧牌堆 / 当前持有区：`ResourceTraySkeleton`
- 底部动作条：`ActionBarSkeleton`

### 4.5 运行时最小素材合同

优先接入：

- `ui/title-banner.png`
- `ui/trait-track-0-9.png`
- `cards/back-omen.png`
- `cards/back-item.png`
- `cards/back-event.png`
- `explorers/*.png`

暂不要求：

- 正式房间单板块裁图
- 楼层大板正式切片
- 正式剧情 / 剧本图

### 4.6 “能不能友好进行游戏”的最低标准

- 玩家进入页面后 2 秒内应能判断当前轮到谁。
- 玩家进入页面后 2 秒内应能找到当前探索者的持有物。
- 玩家进入页面后 2 秒内应能判断谁和自己在同一房间、是否可以交易。
- 玩家进入页面后 2 秒内应能看出当前主视图是房间板块，不会误认成资源目录。
- 玩家进入页面后 2 秒内应能看出最可能的下一步动作。

## 5. 角色选择页面合同

### 5.1 页面目标

- 页面语义：开局前选探索者
- 页面职责：明确显示 `可选`、`已选`、`已占用`、`已准备`

### 5.2 区域划分

1. 顶部条
   - 游戏名
   - 当前玩家数
   - 设置入口
2. 左侧选中角色详情区
   - 放大后的探索者牌
   - 短属性摘要
   - 1 条短特性说明
3. 中央可选角色区
   - 使用探索者牌形状作为选择对象
   - 可选、已准备、占用状态直接叠在牌上
4. 底部房间席位区
   - 3-6 个玩家席位
   - ready / taken / empty 状态
5. 底部动作区
   - `random`
   - `confirm`
   - `back`

### 5.3 与框架骨架的映射

- 直接优先承接 `CharacterSelectionSkeleton`
- 如默认左右分区与最终落稿不完全一致，也应在该 skeleton 之上做皮肤和局部布局改造，而不是重写第二套选角框架

### 5.4 最小动态状态

- `playersJoined`
- `selectedExplorerBySeat`
- `readyStateBySeat`
- `availableExplorers`
- `takenExplorers`
- `hostSeat`
- `currentSeat`

## 6. 终局页面合同

### 6.1 页面目标

- 页面语义：一局结束后的胜负与结果总结
- 页面职责：让玩家快速知道 `谁赢了`、`哪边输了`、`这一局是什么剧本结果`、`接下来做什么`

### 6.2 区域划分

1. 顶部条
   - 游戏名
   - haunt 名称 / 结果标签
2. 中央视图结果区
   - `victory / defeated`
   - 剧本名
   - 目标 / 结果
   - 简短奖励 / 统计
3. 左侧幸存者区
   - 幸存者列表
4. 右侧叛徒方区
   - 叛徒 / 怪物方结果
5. 底部动作区
   - `rematch`
   - `lobby`
   - `log`

### 6.3 最小动态状态

- `result`
- `hauntName`
- `survivors`
- `traitorSide`
- `summaryStats`
- `availableNextActions`

## 7. 正式资源命名与目录口径

- 当前 `runtime-resource-map.json` 里的 `public/assets/betrayal/...` 仍是 intake 暂存口径。
- 一旦进入正式实施，运行时资源必须迁到：
  - `public/assets/i18n/zh-CN/betrayal/ui/...`
  - `public/assets/i18n/zh-CN/betrayal/thumbnails/...`
  - `public/assets/i18n/zh-CN/betrayal/cards/...`
  - `public/assets/i18n/zh-CN/betrayal/explorers/...`
  - `public/assets/i18n/zh-CN/betrayal/markers/...`

## 8. 当前仍未证明的事项

- 完整交互合同
- 真实房间对象与拼接规则
- 真实牌堆数据结构
- haunt / 剧本 / 叛徒 / 怪物逻辑
- 用户对当前 `v4` 继续收敛稿的最终批准
