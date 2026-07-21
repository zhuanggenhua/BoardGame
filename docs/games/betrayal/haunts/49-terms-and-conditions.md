# 作祟 49 交互子账本：Terms and Conditions

> 状态：`contract-ready`。这是恶魔合同作祟，核心是 Contract 不能被叛徒持有、英雄血 token、恶魔持合同不可击晕、偷合同、焚烧合同和叛徒收集所有血。

## 1. 源段锁定

| 项 | 内容 |
| --- | --- |
| 英雄书 | `betrayal-3e-secrets-of-survival-en.md` p58 |
| 叛徒书 | `betrayal-3e-traitors-tome-en.md` p58 |
| 剧本卡 / 触发预兆 | For Sale / Dagger |
| 叛徒 | 作祟揭秘者 |
| 类型 | 一名叛徒 + Demon 怪物 + Contract token + 每英雄 Blood token |

## 2. 公开步骤

- 公开 Contract 可以在英雄之间交易，但叛徒不能持有或触碰。
- 公开英雄可用力量攻击 Demon，成功时可偷走 Contract 替代造成伤害。
- 公开英雄失去自己的 Blood token 后，回合末会受精神伤害；叛徒可收集掉落的血完成仪式。

## 3. 私密可见性

- 英雄可见：自己 Blood token 是否仍在、Contract 归属、火房间、Demon 是否持合同。
- 叛徒可见：已收集哪些英雄 Blood token、Demon 位置和仪式完成条件。
- Blood token 的位置和归属会直接影响双方目标，必须是可追溯状态。

## 4. setup 队列

英雄侧：
1. 每名英雄拿 1 个 Blood token，放在自己角色板上。
2. 作祟后首回合由叛徒左侧玩家开始。

叛徒侧：
1. 叛徒保留探索者并成为叛徒。
2. 叛徒治疗全部属性。
3. Monster Card 放在叛徒左侧；Demon 在叛徒回合后行动。
4. 叛徒获得 0/1/2/2 步力量和速度。
5. 在距离 Basement Landing 最远的地下室房间放 Demon token。
6. 将 Contract token 放在 Demon 上，表示 Demon 持有合同。

## 5. 目标模型

| 阵营 | 胜利条件 |
| --- | --- |
| 英雄 | 焚烧 Contract |
| 叛徒 | 将所有英雄的 Blood token 带到 Demon 所在房间完成仪式，或所有英雄死亡 |

## 6. 特殊行动

| 行动 | 使用者 | 条件 | 检定 / 结果 | UI 承接 |
| --- | --- | --- | --- | --- |
| 从 Demon 偷合同 | 英雄 | 用力量攻击 Demon 并获胜，且 Demon 持有 Contract | 可偷走 Contract 替代造成伤害 | 攻击胜利替代选择 |
| 焚烧合同 | 持有 Contract 的英雄 | 持有 Contract；每回合 1 次 | 知识检定；若在有火房间 +4；7+ 英雄胜利；4-6 无事；0-3 受 1 物理伤害 | Contract 动作 + 火房间加值 |
| 血魔法 | 拥有自己 Blood token 的英雄 | 每回合 1 次 | 受到 1 骰精神伤害，并获得 1 步力量 | 角色动作 + 属性轨预览 |
| 神志攻击英雄 | 叛徒 | 攻击英雄且未使用武器 | 可改用神志攻击；失败者受精神伤害 | 攻击声明面板 |
| 拾取血 token | 叛徒 | 与任意 Blood token 同房间 | 可拾取并放在叛徒角色板 | token 动作 |
| 完成血契仪式 | 叛徒 | 进入 Demon 房间，且持有所有英雄 Blood token | 叛徒胜利 | 到达触发 |

有火房间：Furnace Room、Ritual Room、Kitchen、Laboratory、Charred Room。

## 7. 持续 / 触发规则

- Contract 可按正常交易规则在英雄之间交易。
- 叛徒不能持有或触碰 Contract；任何交易、拾取、偷取候选都必须排除叛徒。
- 英雄死亡或受到物理伤害时，将自己的 Blood token 放到所在房间。
- Blood token 不能交易；英雄不能拾取已掉落的 Blood token。
- 英雄回合末如果没有自己的 Blood token，受到 1 骰精神伤害。
- Demon 如果持有 Contract，不能被击晕。

## 8. token / 怪物合同

| 对象 | 数量 | 状态真相 |
| --- | ---: | --- |
| Blood token | 每名英雄 1 | 角色板 / 房间 / 叛徒角色板，绑定原英雄 |
| Contract token | 1 | Demon / 英雄持有；禁止叛徒持有 |
| Demon | 1 | 房间、是否持有 Contract、是否可击晕 |

Demon 属性：力量 6、速度 4、神志 4、知识 5。

## 9. UI 承接

- 主目标条双向显示：英雄的 Contract 焚烧进度、叛徒已收集 Blood token 数。
- Contract 详情必须显示“叛徒不能持有”，并在非法拾取 / 交易时给出短原因。
- Blood token 失去后，英雄回合末精神伤害必须在回合结束按钮前预告。

## 10. 验证

- 单测：Blood token 初始；物理伤害 / 死亡掉落；英雄不能拾取掉落血；叛徒拾血；Contract 不能给叛徒；Demon 持合同不可击晕；力量攻击偷合同；火房间焚烧 +4；血魔法伤害和力量提升；叛徒仪式胜利。
- 页面测试：Contract 归属、Blood token 归属、焚烧合同、叛徒收集进度。
- E2E：覆盖英雄偷合同并在火房间焚烧胜利。

