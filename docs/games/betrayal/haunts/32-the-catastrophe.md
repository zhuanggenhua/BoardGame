# 作祟 32 交互子账本：The Catastrophe

> 状态：`contract-ready`。这是 Bakeneko 与亡灵猫作祟，核心是火 token、猫群强化、诱猫和全屋着火胜利。

## 1. 源段锁定

| 项 | 内容 |
| --- | --- |
| 英雄书 | `betrayal-3e-secrets-of-survival-en.md` p40 |
| 叛徒书 | `betrayal-3e-traitors-tome-en.md` p36-p37 |
| 剧本卡 / 触发预兆 | Paranormal Investigators / Skull |
| 叛徒 | 作祟揭秘者 |
| 类型 | 叛徒死亡转怪物 + 火焰扩散 + 小怪群体 |

## 2. 公开步骤

- 公开叛徒探索者已死亡并转为 Bakeneko，叛徒控制 Bakeneko 和 Undead Cats。
- 公开火 token 房间进入时需要速度检定。
- 公开英雄要清理区域内 Undead Cats 后用力量攻击击败 Bakeneko。

## 私密可见性

- 英雄可见：Fire token 位置、亡灵猫数量、诱猫目标和全屋着火风险。
- 叛徒可见：Bakeneko / 亡灵猫行动、火势推进和最后 Fire token 胜利。
- Fire token 是公开地图状态；不能只在怪物回合日志里增加。

## 3. setup 队列

英雄侧：
1. 英雄无额外 setup。
2. 叛徒左侧玩家先行动。

叛徒侧：
1. 叛徒探索者死亡；掩埋其物品和预兆，立牌移出。
2. 在叛徒原房间放 Bakeneko token。
3. Monster Card 放在叛徒左侧，怪物回合替代叛徒回合。
4. 准备 6/5/4/3 个 Fire token，其他移出本作祟。
5. 在叛徒所在区域放置 3/4/5/7 个 Undead Cat。

## 4. 目标模型

| 阵营 | 胜利条件 |
| --- | --- |
| 英雄 | 在 Bakeneko 所在区域没有 Undead Cat 时，用力量攻击击败 Bakeneko |
| 叛徒 | 所有英雄死亡，或最后一个 Fire token 被放置 |

## 5. 特殊行动

| 行动 | 使用者 | 条件 | 检定 / 结果 | UI 承接 |
| --- | --- | --- | --- | --- |
| 诱猫 | 英雄 | 与 Undead Cat 同房间，掩埋 1 张自己的物品或预兆 | 移动该 Undead Cat 最多 4 格并击晕；不算攻击 | Cat token 动作 + 路径选择 |
| 点燃一切 | Bakeneko | 任意房间 | 选择视线内没有 Fire token 的房间放 Fire token；放下最后一个 Fire token 时叛徒胜利 | 怪物动作 + 视线房间 |
| 召唤猫咪 | Bakeneko | 在预兆符号房间 | 在当前房间放 1 个 Undead Cat | 怪物动作 |

## 6. 持续 / 触发规则

- 英雄进入有 Fire token 的房间时速度检定：5+ 无事，0-4 受 1 物理伤害。
- 英雄攻击 Undead Cat 获胜时，Undead Cat 死亡而不是击晕。
- 英雄用力量攻击击败 Bakeneko 时，若其区域没有 Undead Cat，英雄胜利；否则 Bakeneko 仅被击晕。
- Bakeneko 力量等于 3 + 所在区域 Undead Cat 数，最高 8。
- Bakeneko 回合后，每只 Undead Cat 行动。
- Undead Cat 受伤害死亡而不是击晕；也可被其他方式击晕。
- Undead Cat 用速度攻击，每次最多造成 2 点伤害；本次 Undead Cat 回合中已受过伤害的英雄不能再被 Undead Cat 攻击。

## 7. token / 怪物合同

| 对象 | 数量 | 状态真相 |
| --- | ---: | --- |
| Bakeneko | 1 | 房间、区域猫数加力、是否击晕 |
| Undead Cat | 3/4/5/7 起 | 房间、状态、本怪物回合已伤害目标 |
| Fire token | 6/5/4/3 | 房间、剩余数量、进入伤害 |

Bakeneko 属性：力量 3+区域猫数（最高 8）、速度 6、神志 6、知识 2。Undead Cat 属性：力量 3、速度 6、神志 2、知识 4。

## 8. UI 承接

- 地图显示火房间进入风险和 Bakeneko 视线可点燃范围。
- Bakeneko 怪物卡实时显示区域猫数加成后的力量。
- 英雄攻击 Bakeneko 前应显示“当前区域仍有猫，成功也只会击晕”的短状态。

## 9. 验证

- 单测：Fire token 人数数量；火房间进入伤害；诱猫不算攻击；Bakeneko 力量上限；区域猫存在时 Bakeneko 只击晕；最后 Fire token 胜利；Undead Cat 同回合不重复伤害同英雄。
- 页面测试：火 token、猫群加值、Bakeneko 胜利门槛提示。
- E2E：覆盖英雄清区后击败 Bakeneko 胜利。
