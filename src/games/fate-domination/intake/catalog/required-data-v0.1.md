# Fate/Domination 必要数据清单 v0.2

这份清单由 `rules/core-rules-v0.1.md` v0.2 反推，目标是先完成可跑通的最小规则切片，
再扩充完整对象全集。每个对象在进入实现前必须有 `locked / partial / blocked /
disputed` 状态。

## A. 当前已从规则锁定的对象类别

| 类别 | 规则用途 | 当前状态 | 下一步 |
| --- | --- | --- | --- |
| Master | 玩家身份、起始牌组、生命/淘汰 | `partial` | 抓完整 Master 列表、属性、能力和起始牌组 |
| Servant | 每位玩家 1 个秘密 Servant | `partial` | 抓完整 Servant 列表、Class、属性、生命、攻击和技能 |
| Class | Servant 选择限制与 Class 卡/能力 | `partial` | 抓 Class 规则和各 Class 数据 |
| Battlefield | 移动、控制、目标结算 | `partial` | 抓战场图、连接、区域规则和控制判定 |
| Objective | 每轮战场目标、VP 与场地效果 | `partial` | 20 张目标的名称/VP/效果/aspect 已有正文候选，仍需逐张图面和 ruling 核对 |
| Event | Prep 阶段事件与 mana 收益 | `partial` | 核对 10 张非高潮事件 + 3 张高潮事件的名称、文本和结算时机 |
| Attack | 战斗流程和攻击牌 | `partial` | 抓攻击类别、费用、目标、伤害和响应 |
| Skill | Servant/Master 技能 | `partial` | 抓技能区规则、费用、次数和目标 |
| Status | 持续、临时、失效和面朝下攻击 | `partial` | 抓状态词条、生命周期和互斥关系 |
| Game terms | 规则关键词和字段解释 | `partial` | 逐条归一化为规则原子 |

## B. 已抓到的目标牌全集（正文候选，需图面核对）

来源：Wiki `Objectives` 页面正文检索结果。

| # | Objective | VP | Effect | Aspect |
| --- | --- | ---: | --- | --- |
| 1 | Honorable Duel | 2 | Strength attacks +2 | Sun |
| 2 | Difficult Terrain | 2 | Agility attacks +2 | Sun |
| 3 | Sacrificial Grounds | 2 | Magic attacks +2 | Sun |
| 4 | Open Ley Line | 2 | Fighting here gives +2 Mana | Sun |
| 5 | Open Ley Line | 2 | Fighting here gives +2 Mana | Sun |
| 6 | Test of Strength | 3 | Strength attacks +3 | Stars |
| 7 | Suppressive Fire | 3 | Agility attacks +3 | Stars |
| 8 | Sacred Grounds | 3 | Magic attacks +3 | Stars |
| 9 | Fated Confrontation | 3 | Base power 1/2 cards become base power 5 | Stars |
| 10 | Synergize | 2 | Matching attack types give +4 Power | Stars |
| 11 | Bring Illya Back | 5 | No effect | Earth |
| 12 | Desperation Move | 4 | Bonus power for lowest VP player | Earth |
| 13 | Desperation Move | 4 | Bonus power for lowest VP player | Earth |
| 14 | Take High Ground | 3 | Doubles Terrain Advantage | Earth |
| 15 | Contain Neutral Threat | 2 | Strong Attacks +1 Power; winner restores 1 Command Seal | Earth |
| 16 | Ambush | 2 | Hidden Servants +5 Power | Moon |
| 17 | Ambush | 2 | Hidden Servants +5 Power | Moon |
| 18 | Break Bounded Field | 2 | Bans Specials and prevents movement | Moon |
| 19 | Break Bounded Field | 2 | Bans Specials and prevents movement | Moon |
| 20 | Scavenge Ground Zero | 3 | Negates Terrain Advantage | Moon |

状态：`partial`

说明：当前已确认 20 张对象、VP、效果和 aspect 的正文候选；
每张牌的精确条件、平分处理、图面字段和重复牌物理数量仍需逐张页面/图片核对。

## C. 事件牌候选清单（非锁定全集）

来源：Wiki `Events` 页面正文检索结果；仅作抓取候选，不覆盖
`How to Play` 已锁定的“10 张非高潮 + 3 张高潮”结构。

已直接核到的事件名 / 结构线索：

- `Angra Mainyu's Curse`：NP Ban，mana value 0。
- `The Night Fate Stood Still`：Miyama 与 Shinto 各加 1 个 bonus objective，mana value 4。
- `Heaven's Feel`：Miyama 加 2 个 bonus objectives，mana value 6。

状态：`partial`

说明：上述为当前正文能直接核到的候选项，不能称为官方全集；
每张牌的完整文本、是否属于高潮事件、触发时机、是否持续、是否可响应仍需逐张核对。

## D. 规则驱动的最小可玩数据切片

第一批不追求全站 870+ 页面，而是先锁定能支撑主流程的数据：

- 4 个可选 Master，覆盖 3–7 人普通 setup，并保留 2 人变体的身份约束；
- 每个 Master 至少 1 个起始牌组定义；
- 6 个以上 Servant，覆盖至少 3 个 Class；每个玩家初始只召唤 1 个 Servant；
- 1 个起始 Battlefield 和完整移动/控制规则；
- 20 张 Objective；
- 10 张非高潮 Event + 3 张高潮 Event；
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
