# 作祟 21 交互子账本：Spooky McMasters Presents...

> 状态：`contract-ready`。这是小说家和恐怖怪作祟，核心是 Book 争夺、Library 固定怪物、火焰房间烧书和代写效果表。

## 1. 源段锁定

| 项 | 内容 |
| --- | --- |
| 英雄书 | `betrayal-3e-secrets-of-survival-en.md` p29 |
| 叛徒书 | `betrayal-3e-traitors-tome-en.md` p22-p23 |
| 剧本卡 / 触发预兆 | A Strange Disappearance / Book |
| 叛徒 | 作祟揭秘者 |
| 类型 | 叛徒 + 固定房间 Boss + 召唤怪物 + 书本目标 |

## 2. 公开步骤

- 公开 Library 是核心地点；若未发现，需要搜索并放到非叛徒所在区域。
- 公开 Book 当前由 Spooky McMasters 持有，英雄要夺回并带到火焰房间烧掉。
- 公开 Spooky 和 Horror 在叛徒回合后依次行动。

## 私密可见性

- 英雄可见：Book 当前持有人、可烧书房间、小说家位置和恐怖怪数量。
- 叛徒可见：小说家固定房间、召唤 / 代写效果和怪物行动。
- Book 争夺和烧毁进度是双方目标核心，必须公开承接。

## 3. setup 队列

英雄侧：
1. 若 Library 未在屋内，从房间堆搜索并放到非叛徒所在区域。
2. 叛徒左侧玩家先行动。

叛徒侧：
1. 叛徒保留探索者，治疗全部属性，并按人数获得 1/1/2/3 力量和速度。
2. Monster Card 放在叛徒左侧。
3. Demon token 放在 Library，代表 Spooky McMasters。
4. 将 Book Omen 给 Spooky，放在 Monster Card 旁。
5. 在叛徒房间放置 1 个 Horror。

## 4. 目标模型

| 阵营 | 胜利条件 |
| --- | --- |
| 英雄 | 在火焰房间成功烧掉 Book |
| 叛徒 | 所有英雄死亡 |

## 5. 特殊行动 / 物品规则

| 行动 | 使用者 | 条件 | 检定 / 结果 | UI 承接 |
| --- | --- | --- | --- | --- |
| 烧书 | 持有 Book 的英雄 | 在火焰房间 | 神志检定；5+ 英雄胜利；0-4 无事 | Book 卡动作 + 火焰房间高亮 |
| 塑造角色 | 英雄 | 在 Library | 神志检定；4+ 提升 1 力量或速度；0-3 在自己房间放 1 个 Horror | Library 动作 + 属性选择 |
| 夺回 Book | 英雄 | 用力量攻击 Spooky，且 Spooky 持有 Book | 攻击胜利时拿走 Book | Spooky 攻击结果替代 |
| 归还 Book | 叛徒 | 叛徒在 Library 且 Spooky 在场 | 可把 Book 交还给 Spooky | 叛徒动作 |
| 偷 Book | 叛徒 | 用力量攻击持 Book 英雄并获胜 | 可偷 Book 替代造成伤害 | 攻击胜利后的替代选择 |
| 代写 | Spooky | Spooky 持有 Book | 选择一个房间，掷 2 骰：4 该房间每名探索者受 3 物理伤害；2-3 每名探索者受 2 骰精神伤害并放 1 个 Horror；0-1 放 2 个 Horror | 怪物特殊行动 + 房间选择 + 表格结果 |

火焰房间：Furnace Room、Ritual Room、Kitchen、Laboratory、Charred Room。

## 6. 持续 / 触发规则

- 持有 Book 的英雄可用任意属性攻击 Horror。
- Spooky 不能离开 Library，不能被击晕，可持有 Book。
- Spooky 持有 Book 时，Book 放在 Monster Card 旁。
- 叛徒回合后 Spooky 行动；Spooky 行动后 Horror 行动。

## 7. token / 怪物合同

| 对象 | 数量 | 状态真相 |
| --- | ---: | --- |
| Spooky McMasters | 1 | 固定 Library、是否持有 Book、不可击晕 |
| Horror | 可变 | 房间、状态、来源 |
| Book | 1 | 持有人：Spooky / 英雄 / 叛徒；是否已烧毁 |

Spooky 属性：力量 6、速度 6、神志 6、知识 8。Horror 属性：力量 5、速度 3、神志 4、知识 3。

## 8. UI 承接

- 主目标条显示 Book 当前持有人和火焰房间目标。
- Library 固定 Spooky 状态应显示“不能离开 / 不能击晕”。
- 代写行动必须用表格结果承接，不允许简化成固定召唤。

## 9. 验证

- 单测：Library 搜索放置；叛徒人数加值；Book 给 Spooky；英雄用任意属性攻击 Horror；代写三结果；Spooky 固定 Library 且不可击晕；烧书胜利。
- 页面测试：Book 争夺、烧书动作、Spooky 代写房间选择。
- E2E：覆盖英雄夺 Book 后烧毁胜利。
