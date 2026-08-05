# summonerwars-core Specification

## Purpose
TBD - created by archiving change add-summonerwars-mvp. Update Purpose after archive.
## Requirements
### Requirement: 战场网格与初始部署
系统 SHALL 以配置驱动创建战场网格，并根据阵营配置放置召唤师、城门与起始单位；同时按先后手设置初始魔力值。

#### Scenario: 初始化战场
- **WHEN** 游戏进入 setup
- **THEN** 战场网格创建完成
- **AND** 每位玩家的召唤师/城门/起始单位位于配置位置
- **AND** 先手魔力为 2，后手魔力为 3

### Requirement: 回合阶段流程
系统 SHALL 使用阶段机制按“召唤→移动→建造→攻击→魔力→抽牌”顺序推进，并限制命令只能在对应阶段执行。

#### Scenario: 阶段顺序与门禁
- **GIVEN** 当前处于召唤阶段
- **WHEN** 执行阶段推进命令
- **THEN** 阶段进入移动阶段
- **AND** 非移动阶段的移动命令被拒绝

### Requirement: 召唤规则
系统 SHALL 允许玩家在召唤阶段支付魔力并将单位放置于己方城门相邻空格；召唤的单位当回合可移动与攻击。

#### Scenario: 正常召唤
- **GIVEN** 玩家有足够魔力且城门相邻空格为空
- **WHEN** 玩家执行召唤命令
- **THEN** 单位被放置在相邻空格
- **AND** 玩家魔力减少相应费用

### Requirement: 移动规则
系统 SHALL 允许玩家在移动阶段移动最多 3 个单位，每个单位最多 2 格，且只能水平/垂直移动，不能穿越其他卡牌；建筑不可移动。

#### Scenario: 禁止对角线移动
- **GIVEN** 玩家在移动阶段尝试对角线移动
- **WHEN** 提交移动命令
- **THEN** 系统拒绝该命令并保持状态不变

### Requirement: 建造规则
系统 SHALL 允许玩家在建造阶段支付费用并放置建筑，位置仅限召唤师相邻或己方后 3 排。

#### Scenario: 建造位置限制
- **GIVEN** 目标位置不在允许区域
- **WHEN** 玩家提交建造命令
- **THEN** 系统拒绝建造并提示位置无效

### Requirement: 攻击解析
系统 SHALL 在攻击阶段允许最多 3 个单位攻击；近战仅相邻目标、远程直线 ≤3 格；掷骰数=力量值；仅匹配符号造成伤害。

#### Scenario: 远程攻击掷骰
- **GIVEN** 远程单位攻击直线 2 格目标
- **WHEN** 掷出与远程符号匹配的结果
- **THEN** 目标受到等于匹配结果数量的伤害

### Requirement: 伤害与摧毁奖励
系统 SHALL 记录伤害并在生命值降至 0 时摧毁卡牌；摧毁敌方卡牌时获得 1 点魔力。

#### Scenario: 摧毁奖励
- **GIVEN** 玩家摧毁一张敌方单位卡
- **WHEN** 卡牌生命值降至 0
- **THEN** 该卡牌被弃置
- **AND** 摧毁方获得 1 点魔力

### Requirement: 不活动惩罚
系统 SHALL 在攻击阶段结束时若未对任何敌方卡牌进行攻击，则对当前玩家召唤师造成 1 点伤害。

#### Scenario: 未攻击触发惩罚
- **GIVEN** 攻击阶段内未声明任何攻击
- **WHEN** 阶段结束
- **THEN** 当前玩家召唤师受到 1 点伤害

### Requirement: 魔力阶段与轨道限制
系统 SHALL 允许玩家在魔力阶段弃置任意数量卡牌以获得等量魔力，魔力范围为 0-15。

#### Scenario: 魔力上限限制
- **GIVEN** 玩家当前魔力为 15
- **WHEN** 玩家弃置卡牌尝试获得魔力
- **THEN** 魔力保持为 15 不再增加

### Requirement: 抽牌阶段
系统 SHALL 在抽牌阶段将手牌补至 5 张；若牌堆为空或不足，则抽取剩余卡牌且不洗弃牌堆。

#### Scenario: 牌堆不足抽牌
- **GIVEN** 玩家手牌为 2 且牌堆只剩 2 张
- **WHEN** 抽牌阶段开始
- **THEN** 玩家仅抽到 2 张并结束抽牌

### Requirement: 胜利条件
系统 SHALL 在对方召唤师被摧毁时判定胜利；若双方召唤师同时被摧毁，则当前回合玩家获胜。

#### Scenario: 召唤师被摧毁
- **GIVEN** 对方召唤师生命值降至 0
- **WHEN** 伤害结算完成
- **THEN** 系统判定当前玩家获胜

### Requirement: Summoner Wars 交互必须进入 InteractionSystem
系统 SHALL 将 Summoner Wars 中所有“事件触发且需要玩家选择/确认的交互”建模为 InteractionSystem 交互（simple-choice / multistep-choice），不得仅依赖 UI 本地 mode 状态机。

#### Scenario: 事件触发后创建交互
- **GIVEN** 触发了 SUMMON_FROM_DISCARD_REQUESTED / GRAB_FOLLOW_REQUESTED / SOUL_TRANSFER_REQUESTED / MIND_CAPTURE_REQUESTED / ice_shards_damage / feed_beast_check
- **WHEN** 系统需要玩家进行选择或确认
- **THEN** `sys.interaction.current` 被创建并仅对拥有者可见
- **AND** 交互提供可解选项或安全取消/跳过路径

#### Scenario: AI 可见且可解
- **GIVEN** AI 控制的玩家触发了上述交互
- **WHEN** AI 计算合法动作
- **THEN** AI 能从 InteractionSystem 的描述中生成至少一个合法响应命令

### Requirement: Summoner Wars 跟进交互必须走引擎交互系统
Summoner Wars SHALL 将所有“等待玩家输入”的跟进交互建模为 `sys.interaction` 中的引擎交互，而不是仅存在于客户端本地 UI mode。AI、真人 UI 与服务端诊断都必须以同一交互状态为真相源。

#### Scenario: 领域事件触发的后续选择进入 sys.interaction
- **GIVEN** 某个 Summoner Wars 能力或事件在执行后需要玩家进一步选择
- **WHEN** 领域层生成该后续交互
- **THEN** 当前对局状态中出现对应的 `sys.interaction.current` 或队列项
- **AND** 该交互不再只依赖 `useGameEvents` / `useCellInteraction` / `useEventCardModes` 的本地 mode 才可继续

#### Scenario: AI 能看见并解决跟进交互
- **GIVEN** 当前待处理交互的归属玩家为 AI
- **WHEN** AI 读取 legal actions 或交互描述符
- **THEN** AI 可以构造至少一个合法响应命令
- **AND** 若无合法业务选择，系统仍提供合法 cancel / skip / pass 收口

#### Scenario: 对手看不到不应暴露的交互细节
- **GIVEN** 某个 Summoner Wars 跟进交互仅属于一名玩家
- **WHEN** 其他玩家接收其 `playerView`
- **THEN** 对手不会看到不应暴露的候选细节
- **AND** 服务端与归属 seat 仍能诊断该交互是否阻塞对局

### Requirement: Summoner Wars 多步选择必须使用引擎多步交互或显式简单交互
Summoner Wars SHALL 将多步技能/事件卡选择链路映射为 `multistep-choice` 或一组显式 `simple-choice` 交互，不得继续把“步骤进度 + 待确认结果”仅存放在本地 React state 中。

#### Scenario: 多步技能进度由引擎交互持有
- **GIVEN** 某个技能需要先选单位，再选位置/方向/卡牌后才能确认
- **WHEN** 玩家进行该多步交互
- **THEN** 当前步骤与中间结果由引擎交互状态表示
- **AND** UI 刷新或 AI 接管时仍能读取当前进度

#### Scenario: 取消或跳过不会留下悬空本地 mode
- **GIVEN** 玩家取消或跳过某个 Summoner Wars 跟进交互
- **WHEN** 交互被系统 resolve
- **THEN** 不会遗留只存在于本地 UI 的悬空 mode 状态
- **AND** 阶段推进与后续命令恢复到一致状态

### Requirement: Summoner Wars 可见对象优先由棋盘本体承接
Summoner Wars SHALL 将棋盘上已经可见的单位、传送门和落点作为主交互入口；领域层不得把对象组合预展开成按钮组合，适配层不得把对象选择统一路由为状态横幅按钮。

#### Scenario: 组合效果按规则顺序逐步选择
- **GIVEN** 某个能力依次需要选择单位、传送门/区域、落点或数量
- **WHEN** 领域层创建跟进交互
- **THEN** 当前步骤只暴露当前类别的合法候选
- **AND** 单位、传送门和落点由棋盘本体点击与高亮承接
- **AND** 只有数量、确认、跳过或取消等无法由对象本体表达的语义保留为按钮

#### Scenario: 适配层不制造对象代理按钮墙
- **GIVEN** `sys.interaction` 选项带有棋盘对象或位置的真实坐标
- **WHEN** UI 适配器计算交互路由
- **THEN** 路由进入棋盘对象/位置点击链
- **AND** 不会为同一批对象额外渲染组合文字按钮
- **AND** 同一步只保留一个可见的跳过/取消入口

