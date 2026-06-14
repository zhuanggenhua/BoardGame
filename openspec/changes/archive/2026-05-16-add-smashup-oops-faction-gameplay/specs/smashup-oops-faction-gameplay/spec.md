# smashup-oops-faction-gameplay Specification (delta)

## ADDED Requirements
### Requirement: Ancient Egyptians SHALL implement bury-driven gameplay and owner-visible buried UI
系统 SHALL 为 `Ancient Egyptians` 实现正式的埋葬玩法，包括埋葬、翻开、替代去向与玩家可见性展示。

#### Scenario: Mummy buries itself onto another base after scoring
- **GIVEN** `Mummy` 所在基地完成计分
- **WHEN** 其控制者选择改为埋葬到另一个基地
- **THEN** 系统 MUST 让 `Mummy` 离开原基地而不是进入弃牌堆
- **AND** MUST 将它作为埋葬牌放到所选目标基地旁

#### Scenario: Pharaoh uncovers your buried card before scoring and rewards later uncovers
- **GIVEN** `Pharaoh` 在即将计分的基地上
- **WHEN** 控制者在计分前翻开这里一张自己的埋葬牌
- **THEN** 该埋葬牌 MUST 按规则翻开并结算
- **AND** 当另一张埋葬牌被翻开时，`Pharaoh` 的控制者 MUST 抽一张牌

#### Scenario: Buried actions may resolve as uncover effects instead of normal extra plays
- **GIVEN** `You Can Take It With You`、`Tomb Trap` 或 `Blessing of Anubis` 被埋葬
- **WHEN** 其中一张牌被翻开
- **THEN** 系统 MUST 结算其 "when uncovered" 文本
- **AND** MUST 在结算后将该牌置入弃牌堆，而不是按普通额外行动牌打出

#### Scenario: Bury-this-card actions require an explicit target base when played
- **GIVEN** 玩家从手牌打出 `You Can Take It With You`、`Tomb Trap`、`Blessing of Anubis` 或 `Seal the Tomb`
- **WHEN** 该牌的规则要求“埋葬这张牌”或以埋葬方式落到基地
- **THEN** 系统 MUST 要求玩家选择一个合法目标基地
- **AND** MUST 将该牌放入所选基地的 `buriedCards`，而不是无目标移除

#### Scenario: Owner sees buried cards while opponent sees hidden state only
- **GIVEN** 某基地存在埋葬牌
- **WHEN** 控制者查看该基地
- **THEN** 控制者 MUST 能看到自己埋葬牌的卡面或等价可辨识信息
- **AND** 非控制者 MUST 只看到隐藏占位与数量级信息，不能看到真实 `defId`

### Requirement: Vikings SHALL implement bury/discard synergy and buried-card recovery
系统 SHALL 为 `Vikings` 实现围绕埋葬、弃牌与额外打出的正式玩法。

#### Scenario: Huscarl buries the top card of another player's deck
- **GIVEN** 玩家打出 `Huscarl`
- **WHEN** 其 on-play 结算
- **THEN** 系统 MUST 将另一位玩家牌库顶的一张牌埋葬到该基地或规则指定位置
- **AND** 被埋葬牌的所有权与可见性 MUST 正确处理

#### Scenario: Shield Maiden reacts to cards being buried or played here
- **GIVEN** `Shield Maiden` 在基地上
- **WHEN** 有牌被埋葬到该基地或被打到该基地
- **THEN** 系统 MUST 给予其直到回合结束的力量加成

#### Scenario: Valkyrie recovers a buried card the player owns
- **GIVEN** 玩家场上或相关效果允许回收埋葬牌
- **WHEN** `Valkyrie` 的效果结算
- **THEN** 系统 MUST 允许玩家从自己拥有的埋葬牌中选取并回到手牌

### Requirement: Cowboys SHALL implement duel, hand-size checks, movement, and destroy interactions
系统 SHALL 为 `Cowboys` 实现正式的决斗、移动、基于手牌数量的破坏与相关 action 效果。

#### Scenario: Gunfighter duels another player's minion
- **GIVEN** 玩家打出 `Gunfighter`
- **WHEN** 玩家选择另一位玩家的一个合法随从进行决斗
- **THEN** 系统 MUST 比较双方力量并消灭决斗失败者
- **AND** UI MUST 向玩家明确显示当前被选中的决斗目标

#### Scenario: Pinkerton destroys a minion with power less than hand size
- **GIVEN** 玩家打出 `Pinkerton`
- **WHEN** 玩家手牌数量大于目标随从力量
- **THEN** 系统 MUST 允许选择该目标并完成破坏

### Requirement: Samurai SHALL implement honor-based destruction, reactive movement, and replacement destination
系统 SHALL 为 `Samurai` 实现自毁换杀、响应移动、强制破坏与替代去向规则。

#### Scenario: Bushi may move when another player's minion is played
- **GIVEN** `Bushi` 已在某基地上
- **WHEN** 另一位玩家在别的基地打出随从
- **THEN** 系统 MUST 允许 `Bushi` 响应该事件并移动到该基地

#### Scenario: Ronin destroys itself to destroy another minion here
- **GIVEN** 玩家使用 `Ronin`
- **WHEN** 玩家选择同基地上的另一个合法随从
- **THEN** 系统 MUST 先销毁 `Ronin`
- **AND** MUST 按规则销毁被选中的另一个随从

#### Scenario: Shogun may go to the bottom of deck instead of discard
- **GIVEN** `Shogun` 将被破坏
- **WHEN** 其替代去向生效
- **THEN** 系统 MUST 允许将其放到牌库底而不是弃牌堆

### Requirement: Oops faction gameplay UI SHALL support new interaction types end-to-end
系统 SHALL 为本轮新增的埋葬、翻开、决斗、替代去向等交互类型提供可操作的 UI，而不是只在领域层生效。

#### Scenario: Buried source and target selection are playable from UI
- **GIVEN** 某效果要求玩家从手牌/弃牌堆选择埋葬来源，并再选择目标基地
- **WHEN** 玩家在 UI 中处理该交互
- **THEN** 系统 MUST 提供清晰的来源选择与目标基地选择流程
- **AND** 玩家完成后结果 MUST 与领域状态一致

#### Scenario: Replacement destination is surfaced to the controlling player
- **GIVEN** 某随从离场时存在“改为去其他区域”的替代效果
- **WHEN** 该效果触发
- **THEN** 控制玩家 MUST 能在 UI 中理解该替代结果或进行必要选择
