# 作祟 38 交互子账本：The Sinister Soiree

> 状态：`contract-ready`。这是邻居宴会作祟，核心是 Ring 多次攻击、降低来客数、Kitchen 复活和 Neighbors 增生。

## 1. 源段锁定

| 项 | 内容 |
| --- | --- |
| 英雄书 | `betrayal-3e-secrets-of-survival-en.md` p47 |
| 叛徒书 | `betrayal-3e-traitors-tome-en.md` p44 |
| 剧本卡 / 触发预兆 | A Mysterious Invitation / Ring |
| 叛徒 | 作祟揭秘者 |
| 类型 | 一名叛徒 + 怪物增生 + Ring 攻击连段 |

## 2. 公开步骤

- 公开英雄目标是杀死所有 Neighbors。
- 公开 Ring of Feasts 可让英雄连续攻击 Neighbors，但获得当回合不能用，且用过当回合不能交易。
- 公开数字轨决定怪物回合末新增 Neighbors 数。

## 私密可见性

- 英雄可见：Ring 持有人、Neighbors 数量、Kitchen 复活点和数字轨新增压力。
- 叛徒可见：Neighbors 行动、Kitchen 复活、Ring 转移限制和新增怪物节奏。
- Ring 攻击 / 交易限制是公开物品状态，必须在持有区直接提示。

## 3. setup 队列

英雄侧：
1. 英雄无额外 setup。
2. 作祟揭秘者左侧玩家先行动。

叛徒侧：
1. 若 Kitchen 未发现，从房间堆搜索并放到一楼，尽可能远离 Entrance Hall。
2. 叛徒治疗全部属性。
3. 数字轨设为 2/3/4/4。
4. 在事件符号房间各放置 3/4/5/6 个 Neighbors；事件房间不足时，剩余放 Entrance Hall。
5. Monster Card 放在叛徒左侧，Neighbors 在叛徒后行动。

## 4. 目标模型

| 阵营 | 胜利条件 |
| --- | --- |
| 英雄 | 全部 Neighbors 死亡 |
| 叛徒 | 所有英雄死亡 |

## 5. 特殊行动 / Ring 规则

| 行动 | 使用者 | 条件 | 检定 / 结果 | UI 承接 |
| --- | --- | --- | --- | --- |
| 取消派对 | 英雄 | 在事件符号房间 | 知识或速度检定；6+ 数字轨 -1；0-5 无事 | 房间动作 + 来客数轨道 |
| Ring 连续攻击 | 持有 Ring 的英雄 | 攻击 Neighbors；本回合不是刚获得 Ring | 可用 Ring 任意次数攻击，直到一次 Ring 攻击失败 | 攻击面板 + 连击状态 |

## 6. 持续 / 触发规则

- 叛徒死亡时，治疗全部属性并移动到 Kitchen，然后把 Ring 交给杀死叛徒的英雄。
- 英雄不能在获得 Ring 的同一回合用 Ring 攻击。
- 英雄本回合用 Ring 攻击后，不能把 Ring 交易给其他英雄。
- 叛徒回合后 Neighbors 行动。
- 怪物回合结束时，按数字轨当前值新增 Neighbors；优先每个事件符号房间 1 个，若新怪物多于事件房间数，剩余不放。
- Neighbors 被伤害时死亡而不是击晕。

## 7. token / 怪物合同

| 对象 | 数量 | 状态真相 |
| --- | ---: | --- |
| Neighbors | 3/4/5/6 起，可变 | 房间、死亡/存活、是否新增 |
| 数字轨 | 1 | 怪物回合末新增数量 |
| Ring | 1 | 当前持有人、获得回合、是否本回合攻击过 |

Neighbors 属性：力量 5、速度 2、神志 3、知识 5。

## 8. UI 承接

- 主目标条显示 Neighbors 剩余数和数字轨新增压力。
- Ring 卡要显示“本回合刚获得不可用 / 已攻击不可交易 / 连击中直到失败”。
- 怪物回合末新增 Neighbors 应有事件房间高亮和未放置说明。

## 9. 验证

- 单测：Kitchen 搜索放置；Neighbor 初始和新增规则；Ring 刚获得不可攻击；Ring 攻击失败停止连击；Ring 用过不可交易；叛徒死亡复活到 Kitchen 并交 Ring。
- 页面测试：Ring 连击、取消派对、Neighbors 增生。
- E2E：覆盖降低数字轨后清空 Neighbors 胜利。
