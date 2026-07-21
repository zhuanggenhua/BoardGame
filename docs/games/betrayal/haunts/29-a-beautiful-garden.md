# 作祟 29 交互子账本：A Beautiful Garden

> 状态：`contract-ready`。这是 Fae 作祟，核心是 Cold Iron、Fae 知识、Ring 组合加值和 Fae 速度视线攻击。

## 1. 源段锁定

| 项 | 内容 |
| --- | --- |
| 英雄书 | `betrayal-3e-secrets-of-survival-en.md` p37 |
| 叛徒书 | `betrayal-3e-traitors-tome-en.md` p32 |
| 剧本卡 / 触发预兆 | For Sale / Ring |
| 叛徒 | 作祟揭秘者 |
| 类型 | 一名叛徒 + Fae 怪物 + 仪式组合加值 |

## 2. 公开步骤

- 公开英雄需要收集 Cold Iron、Knowledge of the Fae 和 Ring，才能更容易绑定 Fae。
- 公开 Cold Iron 可交易，Knowledge of the Fae 不可交易。
- 公开 Fae 不能被击晕，并会用速度攻击视线内英雄。

## 私密可见性

- 英雄可见：Cold Iron、Fae 知识状态、Ring 组合加值和 Fae 位置。
- 叛徒可见：Fae 怪物行动、速度视线攻击和阻止仪式的目标。
- Fae 是否可被束缚 / 击败必须在目标选择时公开提示。

## 3. setup 队列

英雄侧：
1. 英雄无额外 setup。
2. 叛徒左侧玩家先行动。

叛徒侧：
1. 叛徒保留探索者，Monster Card 放在叛徒左侧。
2. 在叛徒房间放置 1/2/3/3 个 Fae。

## 4. 目标模型

| 阵营 | 胜利条件 |
| --- | --- |
| 英雄 | 在 Fae 所在房间成功执行绑定仪式 |
| 叛徒 | 所有英雄死亡 |

## 5. 特殊行动

| 行动 | 使用者 | 条件 | 检定 / 结果 | UI 承接 |
| --- | --- | --- | --- | --- |
| 撕取冷铁 | 英雄 | 在物品符号房间 | 力量检定；5+ 获得 Might token 作为 Cold Iron；0-4 无事 | 房间动作 + token 池 |
| 学习 Fae | 英雄 | 在 Fae 资料房间 | 知识检定；5+ 获得自己的 Hero token；0-4 无事 | 房间动作 |
| 绑定 Fae | 英雄 | 与 Fae 同房间 | 知识检定；拥有 Knowledge of the Fae、Cold Iron、Ring 各 +2；9+ 英雄胜利；0-8 无事 | Fae 对象动作 + 三项加值明细 |

Fae 资料房间：Library、Ritual Room。

## 6. 持续 / 触发规则

- Cold Iron 可按正常交易规则在英雄之间交易。
- Knowledge of the Fae 不可交易。
- 叛徒不用武器攻击英雄时，可用速度替代力量攻击。
- 叛徒回合后 Fae 行动。
- Fae 不能被击晕；用速度攻击任意视线内英雄。

## 7. token / 怪物合同

| 对象 | 数量 | 状态真相 |
| --- | ---: | --- |
| Fae | 1/2/3/3 | 房间、不可击晕、视线攻击 |
| Cold Iron | 2 | 持有人、可交易 |
| Knowledge of the Fae | 每名英雄 1 | 持有人、不可交易 |
| Ring | 1 | 当前持有人、绑定加值 |

Fae 属性：力量 2、速度 6、神志 4、知识 4。

## 8. UI 承接

- 主目标条显示三类准备项：知识、冷铁、Ring。
- 绑定 Fae 面板必须展示每项 +2 是否成立。
- Fae 视线攻击范围应地图高亮。

## 9. 验证

- 单测：Fae 数量按人数；Cold Iron 可交易；Knowledge 不可交易；绑定加值三项叠加；Fae 不可击晕；Fae 视线速度攻击。
- 页面测试：准备项清单、绑定动作、Fae 视线。
- E2E：覆盖三项准备齐全后绑定胜利。
