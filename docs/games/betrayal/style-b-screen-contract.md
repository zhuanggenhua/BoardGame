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
  - `v4` 的左 / 中 / 右 / 下分区是同一牌桌画布里的落位关系，不是四张独立容器卡；前端不得把每区都机械落成厚边框面板。

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
   - 右：当前回合玩家、剩余移动；设置入口移除后不得继续保留空白占位列
2. 左侧玩家区
   - 当前探索者大卡
   - 当前探索者属性轨道
  - 当前探索者持有区：要考虑超出 `2 Item + 1 Omen` 的承载，但默认应直接沿左下空位自然铺开；当前线按 `物品一排 + 预兆一排` 收纳，并继承通用规则：同一运行态下所有持有牌稳定同宽。至于单排露出多少、是否滚动、按钮与持有区的具体上下关系，属于这条游戏当前布局收敛，不上提为通用规则；`betrayal` 当前线仍禁止歪斜扇形、强旋转或明显借用其他游戏持有区语法
   - 持有物必须让玩家直接识别对象：有正式正面图或正面 atlas 时必须显示正面；未确认正面时只能用弱化牌背底纹 + 大号对象名 + 类别临时承接，缺素材原因写入 intake / evidence 并进入补源/索要素材链路；禁止拿 marker、属性 token、数字 token、参考卡碎片或其它素材拼成伪正面，也禁止把排障标签显示给玩家
   - 左下 `compact` 持有卡是轻量读牌槽，不是第二层重面板：不得为了强调状态再加大黑底条、重复标题区、双重对象名或独立顶部徽章排；同一张卡的对象名在常驻态默认只出现一次
3. 中央主视区
   - 房间板块拼接区
   - 当前探索者所在房间高亮
   - 当前主行动对象优先在这里被看到
   - 玩家指示物和怪物 token 必须落在房间 tile 上；左侧玩家面板、右侧队友区或怪物摘要都不能替代地图承载
   - 桌面常驻左侧当前玩家信息条、右侧队友摘要和底部队友卡只显示头像、姓名、房间和必要属性，不重复渲染玩家 token；玩家 token 的唯一常驻地图承载是房间 tile。移动端若复用 PC 左侧探索者 rail，按移动同构合同保留对应 token 承载，不得把该例外扩写回桌面面板。
   - 若规则或素材包存在玩家 / 怪物 token，地图上必须优先使用同对象 token；找不到时先回同尺寸组 intake 或询问素材位置，不能用探索者整板、怪物卡、队友面板、文字缩写或无关 marker 顶替
   - 房间内占位默认规则：玩家与怪物整体都落在房间中央区域，四周让给房间名与房间信息；若双方同场，则玩家组在中间偏左、怪物组在中间偏右；只有单边存在时整体居中；多个对象按竖直方向堆叠，不得再把当前玩家压到边角
   - 地图 token 的区分优先靠素材原形态 + 描边语义：自己绿色描边、队友黑色描边、怪物红色描边；不得额外自造黑色底座、顶部名字条或重复名字标签破坏素材本体
4. 右侧牌堆区
   - `Omen / Item / Event` 抽牌堆
   - 弃牌堆
   - 队友选择区：放在交互按钮下方；默认显示头像、用户名、房间名和最小属性数字；hover / focus 再展开更多信息；click 应把主视区移动到该队友所在房间
   - 仅保留帮助 / 放大 / 查看入口，不展开参考卡正文，也不拆出额外状态区块
5. 底部动作条
   - 至少有：`move`、`explore`、`trade`、`use`、`end turn`
   - 其中一个动作可以高亮为当前推荐动作，同时要能区分 `可用 / 已完成 / 当前推荐`
   - 主 UI 里按钮只保留动作标签；功能解释只能通过 hover tip / 小问号入口 / 帮助层提供

### 4.2.1 分区表现硬约束

- 运行时的“区域划分”默认通过位置、对齐、密度和轻量高亮成立，不通过每区一层大底板成立。
- 左侧玩家区允许保留探索者板本体的框体语法，但属性、持有物、队友摘要默认应像附着在同一左侧带上的对象，不应再各自套一层重边框卡片。
- 左下持有区若需要更多承载量，桌面态应直接脱离左栏布局约束，向中央下沿空位自然展开；禁止再用固定盒宽、独立面板包裹或假侧栏边界把它重新收成一个小框。
- 若某个承重对象确实需要框体，也应优先使用官方板件/牌框那种偏直边、旧纸板、压纹金属语法；禁止顺手做成现代大圆角卡片或毛玻璃盒子。
- 左侧属性区必须带分段轨语义，且危险 / 死亡端要有独立色相，不得退回成通用数据表。
- 右侧牌堆区默认应像牌桌边上自然摆放的牌堆、弃牌和小入口；禁止再包成两大块独立信息盒。
- 队友选择默认收在交互按钮下方，不再把完整详情常驻占掉左栏；常驻态允许保留最小属性数字，但更长的说明和持有数仍只在 hover / focus 时展开。
- 底部动作区默认应像贴着牌桌下沿的一组动作牌 / 铭牌；禁止外面再包一层宽大动作面板。
- 中央房间区的主闭合感来自房间牌拼接和整张牌桌背景，不来自再给中央区域套一层大圆角边框。
- 房间板块本体应保持“桌游板块/拼片”语法，禁止再把每张房间做成现代圆角信息卡；边缘高亮可以有，但不应把板块卡片化。
- `UndoFab` / 悬浮球 / 调试浮层不是运行时设计真相源；实现运行时布局时默认不为它们预留构图位，不得反向扭曲右下角布局。
- 被删除的设置 / 帮助 / 调试入口不得继续保留固定 grid track、空壳分栏或对齐占位；移除 UI 必须实际释放桌面空间。
- 右下角队友摘要常驻态至少保留头像 + 用户名 + 最小属性数字；交易、同房间、持有数和更长说明放到 hover / focus 浮层里，不得再堆成独立信息盒。

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

### 6.3.1 终局版式硬约束

- 终局页必须优先复刻目标稿的“整页外框 + 左中右三大区”关系，不能实现成 dashboard 卡片拼装。
- 左侧幸存者、中央结果纸面、右侧叛徒与统计，默认都属于同一整页结果板上的分区；除非设计稿本身显示独立卡片，否则不要各自做成现代圆角卡片。
- 中央结果区必须是主视觉锚点，且宽高比、留白和底部按钮关系应接近设计稿；不能被压成一张普通浅色内容卡。

### 6.3 最小动态状态

- `result`
- `hauntName`
- `survivors`
- `traitorSide`
- `summaryStats`
- `availableNextActions`

## 7. 正式资源命名与目录口径

- 当前正式运行时资源已经迁到 `public/assets/i18n/zh-CN/betrayal/...`；`public/assets/betrayal/...` 只保留为 intake 暂存层，不能作为运行时代码入口。
- 继续补资源时，运行时资源必须落到：
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
