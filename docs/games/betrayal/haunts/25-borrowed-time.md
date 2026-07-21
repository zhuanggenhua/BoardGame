# 作祟 25 交互子账本：Borrowed Time

> 状态：`contract-ready`。这是左侧玩家叛徒作祟，核心是四类材料、Armor 传递、叛徒不死和回合末四属性流失。

## 1. 源段锁定

| 项 | 内容 |
| --- | --- |
| 英雄书 | `betrayal-3e-secrets-of-survival-en.md` p33 |
| 叛徒书 | `betrayal-3e-traitors-tome-en.md` p28 |
| 剧本卡 / 触发预兆 | A Strange Disappearance / Armor |
| 叛徒 | 作祟揭秘者左侧玩家 |
| 类型 | 一名叛徒 + 材料 token + Armor 诅咒 |

## 2. 公开步骤

- 公开英雄要找到一定数量的材料 token，随后在 Armory 或 Ritual Room 破除 Armor 咒语。
- 公开叛徒会通过 Armor 维持存在，死亡后可在 Armor 所在房间复活。
- 公开叛徒力量攻击胜利时若持有 Armor，会把 Armor 交给英雄而不造成伤害。

## 私密可见性

- 英雄可见：四类材料位置 / 持有人、Armor 当前持有人、破甲咒准备进度。
- 叛徒可见：不死规则、回合末属性流失和阻止材料收集的行动。
- 材料 token 与 Armor 归属是公开目标状态，不能只作为个人背包文字。

## 3. setup 队列

英雄侧：
1. 准备力量、速度、知识、神志四个 Trait token 作为 Spell Ingredients。
2. 叛徒左侧玩家先行动。

叛徒侧：
1. 叛徒保留探索者并治疗全部属性。

## 4. 目标模型

| 阵营 | 胜利条件 |
| --- | --- |
| 英雄 | 在已放置 1/2/3/4 个材料后，于 Armory 或 Ritual Room 成功破咒 |
| 叛徒 | 所有英雄死亡 |

## 5. 特殊行动

| 行动 | 使用者 | 条件 | 检定 / 结果 | UI 承接 |
| --- | --- | --- | --- | --- |
| 寻找材料 | 英雄 | 在对应材料房间，且该 Trait token 尚未放置 | 按对应属性检定；4+ 在房间放置该 Trait token；0-3 无事 | 房间动作 + 材料清单 |
| 破除 Armor 咒语 | 英雄 | 在 Armory 或 Ritual Room；已放置 1/2/3/4 个材料 | 神志检定；5+ 英雄胜利；0-4 失去 1 神志 | 房间动作 + 已放材料门槛 |

材料房间：神志材料在 Operating Theatre、Graveyard、Bloody Room；力量材料在 Larder、Specimen Room、Dining Room；知识材料在 Furnace Room、Observatory、Library；速度材料在 Underground Lake、Conservatory、Kitchen。

## 6. 持续 / 触发规则

- 叛徒用力量攻击英雄并获胜时，若自己持有 Armor，不造成伤害，改为把 Armor 给该英雄。
- 叛徒回合开始时若已死亡，将叛徒放到 Armor 所在房间，治疗全部属性，并正常行动。
- 叛徒回合结束时，若英雄持有 Armor，该英雄四项属性各失去 1，叛徒四项属性各提升 1。
- 若叛徒持有 Armor，回合结束无事。

## 7. token / 怪物合同

| 对象 | 数量 | 状态真相 |
| --- | ---: | --- |
| Trait token 材料 | 4 | 类型、是否已放置、房间 |
| Armor | 1 | 当前持有人或房间；叛徒复活锚点；回合末流失来源 |
| 叛徒死亡状态 | 1 | 死亡/复活；回合开始触发 |

## 8. UI 承接

- 主目标条显示四类材料进度和当前破咒门槛。
- Armor 持有人必须高亮，因为它决定叛徒是否复活和谁流失属性。
- 回合末四属性流失需要轨道预览，不能直接扣裸数值。

## 9. 验证

- 单测：材料地点和属性对应；按人数门槛；破咒胜利；Armor 攻击传递替代伤害；叛徒死亡回合开始复活；英雄持 Armor 回合末四属性变化。
- 页面测试：材料清单、Armor 持有人、四属性流失预览。
- E2E：覆盖英雄收集足够材料并破咒胜利。
