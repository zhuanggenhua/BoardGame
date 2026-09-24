# Fate/Domination 必要数据清单 v0.1

这份清单由 `rules/core-rules-v0.1.md` 反推，目标是先完成可跑通的最小规则切片，
再扩充完整对象全集。每个对象在进入实现前必须有 `locked / partial / blocked /
disputed` 状态。

## A. 当前已从规则锁定的对象类别

| 类别 | 规则用途 | 当前状态 | 下一步 |
| --- | --- | --- | --- |
| Master | 玩家身份、起始牌组、生命/淘汰 | `partial` | 抓完整 Master 列表、属性、能力和起始牌组 |
| Servant | 3 个不同 Class 的战场单位 | `partial` | 抓完整 Servant 列表、Class、属性、生命、攻击和技能 |
| Class | Servant 选择限制与 Class 卡/能力 | `partial` | 抓 Class 规则和各 Class 数据 |
| Battlefield | 移动、控制、目标结算 | `partial` | 抓战场图、连接、区域规则和控制判定 |
| Objective | 每轮目标与目标点 | `locked` | 保留 20 张目标牌完整文本和特殊条件 |
| Event | 每轮事件阶段 | `locked` | 保留 13 张事件牌完整文本和结算时机 |
| Attack | 战斗流程和攻击牌 | `partial` | 抓攻击类别、费用、目标、伤害和响应 |
| Skill | Servant/Master 技能 | `partial` | 抓技能区规则、费用、次数和目标 |
| Status | 持续、临时、失效和面朝下攻击 | `partial` | 抓状态词条、生命周期和互斥关系 |
| Game terms | 规则关键词和字段解释 | `partial` | 逐条归一化为规则原子 |

## B. 已抓到的目标牌全集

来源：Wiki `Objectives` 页面搜索索引摘要。

1. The Grail
2. Protect the Grail
3. Control the North
4. Control the South
5. Control the East
6. Control the West
7. Control the Center
8. Control the Outer
9. Eliminate an Enemy
10. Damage the Enemy Master
11. Have the Most Servants
12. Have the Most Cards
13. Have the Most Life
14. Have the Most Power
15. Have the Most Mana
16. Have the Most Faith
17. Have the Most Bond
18. Have the Most Support
19. Have the Most Treasures
20. Have the Most Relics

状态：`partial`

说明：当前已确认名称清单和“每轮揭示 1 张、目标完成得 1 点”的规则摘要；
每张牌的精确条件、平分处理和图面字段仍需逐张页面/图片核对。

## C. 已抓到的事件牌全集

来源：Wiki `Events` 页面搜索索引摘要。

1. A New Day
2. Assassin's Creed
3. Battle Continuation
4. Blood Fort Andromeda
5. Caster's Workshop
6. Command Spell
7. Divine Words
8. Double Summon
9. Knight's Oath
10. Noble Phantasm
11. Reality Marble
12. The Counter Force
13. The World

状态：`partial`

说明：已确认 13 张事件牌名称和存在事件阶段；每张牌的完整文本、触发时机、
是否持续、是否可响应仍需逐张核对。

## D. 规则驱动的最小可玩数据切片

第一批不追求全站 870+ 页面，而是先锁定能支撑主流程的数据：

- 4 个可选 Master，至少覆盖 2–4 人 setup 的玩家身份；
- 每个 Master 至少 1 个起始牌组定义；
- 6 个以上 Servant，覆盖至少 3 个 Class；
- 1 个起始 Battlefield 和完整移动/控制规则；
- 20 张 Objective；
- 13 张 Event；
- 每类基础攻击至少 1 条；
- 至少 1 个技能、1 个状态效果、1 个 ongoing/temporary 效果；
- Master 被击败和 Servant 被击败的终局/淘汰数据。

这些数量是“验证主流程所需的最小切片”，不是官方总量，也不替代对象全集。

## E. 后续抓取顺序

1. `How to Play`、`Objectives`、`Events`：锁定主循环和每轮公开对象。
2. `Battlefields`、`Battlefields (Rules)`：锁定位置、控制和目标空间。
3. `Masters`、`Servants`、`Classes`：建立对象全集和选择约束。
4. `Attacks`、`Attack Types`、`Basic Attacks`、`Playing (Attack Cards)`：
   建立战斗数据合同。
5. `Cards`、`Skill Zone`、`Status Effect`、`Ongoing Effect`、`Temporary Card`：
   建立效果生命周期和消费边界。
6. `Game Terms`、`Keywords`、`Usage (Cards)`、`In Play (Zone)`：
   统一字段含义，清理重复或冲突表述。

## F. 当前明确缺口

- 完整 Master / Servant / Class 对象全集。
- 起始牌组组成和各牌的数量。
- Battlefield 的完整数量、连接和图面字段。
- 目标牌、事件牌、攻击牌、技能牌的逐张原文。
- 图片资源、卡面尺寸、牌背和图集/裁切信息。
- 页面正文无法直接抓取时的原始页面或截图证据。
