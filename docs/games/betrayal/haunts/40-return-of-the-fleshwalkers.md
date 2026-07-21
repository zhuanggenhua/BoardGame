# 作祟 40 交互子账本：Return of the Fleshwalkers

> 状态：`contract-ready`。这是邪恶双胞胎作祟，核心是 Twin Identity、反射对象、Mask 杀任意双胞胎和水晶球击晕。

## 1. 源段锁定

| 项 | 内容 |
| --- | --- |
| 英雄书 | `betrayal-3e-secrets-of-survival-en.md` p49 |
| 叛徒书 | `betrayal-3e-traitors-tome-en.md` p48-p49 |
| 剧本卡 / 触发预兆 | For Sale / Mask |
| 叛徒 | 作祟揭秘者 |
| 类型 | 一名叛徒 + 每英雄反射怪物 + 指定击杀权限 |

## 2. 公开步骤

- 公开每个 Evil Twin 有一个 Reflection，由对应英雄 token 表示。
- 公开英雄可以杀死自己的 Evil Twin；持有 Mask 的英雄可以杀死任意 Evil Twin。
- 公开攻击叛徒获胜时可偷 Mask 替代造成伤害。

## 私密可见性

- 英雄可见：每个 Evil Twin 的 Reflection、Mask 持有人、Twin Identity 和可击杀条件。
- 叛徒可见：Evil Twin 行动、保护家人翻正、Mask 防守和反射对象压力。
- Twin Identity 是公开目标关系；攻击面板必须提前说明本次会杀死还是只击晕。

## 3. setup 队列

英雄侧：
1. 英雄无额外 setup。
2. 叛徒左侧玩家先行动。

叛徒侧：
1. 叛徒保留探索者并治疗全部属性。
2. Monster Card 放在叛徒左侧。
3. 在叛徒房间放置 2/3/4/5 个 Evil Twin。
4. 找出每名英雄对应 Hero token，作为 Twin Identity，每个 Evil Twin 下方放 1 个。

## 4. 目标模型

| 阵营 | 胜利条件 |
| --- | --- |
| 英雄 | 杀死全部 Evil Twin |
| 叛徒 | 所有英雄死亡 |

## 5. 特殊行动 / 攻击规则

| 行动 | 使用者 | 条件 | 检定 / 结果 | UI 承接 |
| --- | --- | --- | --- | --- |
| 咨询水晶球 | 英雄 | 在可占卜房间 | 知识检定；5+ 击晕 1 个 Evil Twin；0-4 无事 | 房间动作 + Evil Twin 目标 |
| 保护家人 | 叛徒 | 与已击晕 Evil Twin 同房间 | 翻正该 Evil Twin，使其不再击晕，下回合可正常行动 | Evil Twin token 动作 |
| 偷 Mask | 英雄 | 用力量攻击叛徒并获胜，叛徒持有 Mask | 可偷 Mask 替代造成伤害 | 攻击胜利替代选择 |

可占卜房间：Tower、Ritual Room。

## 6. 持续 / 触发规则

- Evil Twin 属性等于其 Reflection 的起始属性。
- Evil Twin 不掷移动骰；每个 Twin 可移动等于其速度的房间数。
- Evil Twin 可用任意属性攻击。
- 若 Evil Twin 被其 Reflection 或持有 Mask 的英雄造成伤害，该 Twin 死亡而不是击晕。
- 其他来源造成伤害时按普通怪物状态处理。
- 叛徒回合后 Evil Twin 行动。

## 7. token / 怪物合同

| 对象 | 数量 | 状态真相 |
| --- | ---: | --- |
| Evil Twin | 2/3/4/5 | 房间、Reflection、状态、起始属性快照 |
| Twin Identity | 每个 Evil Twin 1 | 对应英雄、是否公开 |
| Mask | 1 | 当前持有人、是否允许杀任意 Evil Twin |

Evil Twin 属性来源为对应英雄起始属性，不随英雄当前属性变化。

## 8. UI 承接

- Evil Twin 卡必须显示其 Reflection 中文角色名和四项起始属性。
- 攻击 Evil Twin 面板应提前显示“本次成功会杀死 / 只会击晕”的原因。
- Mask 持有人状态必须在目标选择时影响所有 Evil Twin。

## 9. 验证

- 单测：Evil Twin 数量按人数；属性来自 Reflection 起始值；不掷移动骰；Reflection/Mask 击杀规则；水晶球击晕；叛徒翻正。
- 页面测试：Twin Identity 显示、Mask 偷取、攻击结果预览。
- E2E：覆盖英雄拿到 Mask 后杀死最后 Evil Twin 胜利。
