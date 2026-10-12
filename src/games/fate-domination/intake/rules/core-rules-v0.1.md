# Fate/Domination 核心规则合同 v0.2

主真相源：用户指定的 Fate/Domination Wiki `How to Play`、对象页和规则页。
本轮核对日期：2026-09-25。页面正文由浏览器检索得到；Fandom 原始 API / `action=raw`
在本机出现间歇性 403/连接超时，因此仍保留页面 URL 和抓取失败记录，不把失败响应当成空规则。

本文件只锁定能决定数据模型和主流程的规则。卡牌/角色逐条效果进入 `catalog/` 和对象
证据合同；未锁定的字段保持 `partial / disputed`，不由旧 prototype 补全。

## 1. 游戏目标

- Fate/Domination 是 2–7 人的战略战斗游戏；Wiki 主规则按 3–7 人书写，另有 2 人变体。
- 普通游戏为 11 轮，也可以选择 quickplay 变体。
- 每轮包含 `Prep`、`Outpost`、`Action`、`Combat` 四个阶段，随后执行回合末清理。
- 玩家通过战斗和侦察获得 VP；第 8、9、10 轮结束进行逐轮淘汰。
- 第 11 轮结束时 VP 最高者赢得圣杯。
- 第 11 轮并列时，比较本轮 Miyama 战斗胜者；仍无法决出时为全员失败。

状态：`locked`

## 2. Setup

- 选择普通 11 轮或 quickplay。
- 可选择是否加入 NPC；人数较少时推荐，但不是强制。
- 选择目标牌组，并将 20 张目标牌洗成牌堆。
- 将 10 张非高潮事件洗混，移出其中 2 张；再按规则顺序叠放 3 张高潮事件。
- 每位玩家选择一个 Master；Master 初始魔力为 4，魔力上限为 12。
- 每位玩家召唤一个 Servant；Servant 的真名与 Class 在初始状态应保持秘密。
- 随机决定首位玩家。

状态：`partial`

缺口：Master / Servant / Class 全集、NPC 具体组件、每个 Master 的完整组件和起始牌组、
目标 Set 选择规则、不同人数/quickplay 的完整差异仍需逐页录入。

## 3. 资源与区域

已确认的核心对象：

- Master：Master 卡、附属 Master 组件、Command Seals、地图上的 Master 棋子和 VP 标记。
- Servant：Servant Tarot、攻击手牌、Skill Zone、攻击牌库、弃牌堆和 Play Area。
- Mana：每位玩家独立持有，初始 4，封顶 12。
- Hand：可打出攻击牌；攻击牌在回合结束按规则进入弃牌或其它去向。
- Skill Zone：满足规则条件后可使用技能；技能使用后按规则回到 Skill Zone。
- Discard：攻击牌弃牌堆；Wiki 明确其内容对其他玩家隐藏。
- Play Area：已打出的牌所在区域，牌面文本与 power 在其处于 play 时生效。
- Battlefield / Recon：用于移动、战斗、侦察和 VP 结算的公共区域。

状态：`partial`

隐藏信息合同：这里的“隐藏”只表示其他玩家在游戏视图中不能看到该信息。
Fate/Domination 本轮没有本地模式需求，也不把反作弊、传输加密或额外服务端安全宣称
写进产品需求；后续若实现联机，只需保证玩家视图不渲染其他玩家的秘密 Servant、
Class、弃牌内容和面朝下牌面。

## 4. 回合结构

每轮按以下顺序执行：

1. `Prep`
   - 玩家从自己的攻击牌库补牌，直到手牌达到 3 张。
   - 抽取事件；每位玩家获得该事件的 mana 值。
   - 在 Miyama 公开翻开目标。
   - 在 Shinto 面朝下放置目标。
   - 按顺序执行各玩家的 Prep Turn；此阶段只能使用 Prep abilities。
2. `Outpost`
   - 按顺序执行各玩家的 Outpost Turn。
   - 可使用 Outpost abilities。
   - 尚未在棋盘上的玩家必须部署到除 Recon 外的任意位置。
   - 部署时结算 Workshop 的 mana 空间和所选地形优势。
   - 再次允许使用 Outpost abilities。
3. `Action`
   - 先翻开 Shinto 的面朝下目标。
   - 按顺序执行各玩家的 Action Turn。
   - 可使用 Action abilities。
   - 未被对手在同一战场争夺时，可以移动。
   - 再次允许使用 Action abilities。
   - 必须同时打出 2 张攻击牌；在战场上时至少 1 张面朝上，另一张可面朝下；
     不在战场上时，两张都可选择面朝上或面朝下。
   - 再次允许使用 Action abilities。
4. `Combat`
   - 按顺序执行各玩家的 Combat Turn；此阶段只能使用 Combat abilities。
   - 结算各战场玩家总 power，最高且未被击败者为胜者。
   - Recon 中的玩家固定获得 2 VP；战斗胜者按目标、争夺奖励、平分和其它奖励结算 VP。
5. 回合末清理
   - 结算 After Combat、移除棋盘上的玩家标记、弃置事件和目标。
   - 停用非永久攻击，弃置面朝下攻击，结算 End of Round 效果，结束到期的 ongoing effects。

状态：`locked`

## 5. 战场与目标

- Miyama 与 Shinto 是当前规则正文明确点名的目标/战斗区域。
- 目标在 Prep 阶段分别公开或面朝下放置，并在 Action 阶段揭示 Shinto 目标。
- 战斗 VP 由目标牌、争夺战奖励、胜者数量和额外效果共同决定。
- 不能把目标牌固定成运行时顺序；目标牌需要以牌堆和效果驱动。

状态：`partial`

缺口：完整战场全集、连接/移动图、地形空间、目标牌逐张文本和特殊条件仍需继续录入。

## 6. 事件

- 每轮 Prep 阶段抽取事件。
- 事件提供每位玩家本轮的 mana 收益，并可能承载其它事件效果。
- 规则正文明确包含 10 张非高潮事件和 3 张高潮事件；旧 intake 中“13 张事件牌全集”
  不能直接当作已锁定的对象清单，需逐张回查名称和图面。

状态：`partial`

缺口：事件完整名称、文本、牌面类型、结算时机和是否可响应。

## 7. 角色与战斗

- Master 与 Servant 是不同对象层级；每位玩家初始持有一个 Master 和一个秘密 Servant。
- Servant 通过攻击牌、技能牌、Class 和位置参与战斗。
- Attack power、Terrain Advantage、总 power 和 VP 结算必须按对应规则页的层级顺序实现。
- Servant 真名揭示、Class 隐藏、面朝下攻击和弃牌隐藏属于不同的信息状态，不得混成一个字段。

状态：`partial`

缺口：Master/Servant 完整字段、Servant deck、技能区、状态效果、击败处理和各类攻击
效果仍需逐对象录入。

## 8. 淘汰与终局

- 第 8 轮结束保留 VP 前 4 名。
- 第 9 轮结束保留 VP 前 3 名。
- 第 10 轮结束保留 VP 前 2 名。
- 淘汰比较出现并列时，相关玩家都不淘汰。
- 第 11 轮结束按 VP 决定胜者；最终并列按本轮 Miyama 战斗胜者裁定，
  再无法裁定则全员失败。

状态：`locked`

## 9. 必须继续锁定的规则原子

- 阶段：`Prep`、`Outpost`、`Action`、`Combat`、回合末清理。
- 权限：当前玩家、顺时针顺序、淘汰玩家、秘密 Servant/Class、公开目标和面朝下目标。
- 位置：部署、移动、争夺限制、Terrain Advantage、Recon。
- 资源：Mana、手牌、攻击牌库、弃牌、Skill Zone、Play Area。
- 战斗：攻击类型、面朝上/下、power 层级、胜者、目标 VP、争夺奖励。
- 效果：`Permanent`、`Passive`、`On Play`、`Alter`、`Ongoing`、`Temporary`、`Status`。
- 终局：第 8/9/10 轮淘汰、第 11 轮 VP、Miyama tie-break、全员失败。

## 10. 当前不允许下结论的内容

- 不能根据旧 intake 把游戏写成 2–4 人、每人 3 个 Servants 或 3 VP 先到即胜。
- 不能把 `Alter: or gain mana` 补成“获得 2 点魔力”或其它数量/目标。
- 不能把“其他玩家看不到”扩展成用户没有要求的反作弊或本地模式需求。
- 不能把 OpenDesign candidate、页面能打开或局部测试通过写成规则和新游戏完成。
- 在规则合同、对象全集、素材合同和用户批准的 OpenDesign 未闭合前，不进入正式 Board/UI 实施。
