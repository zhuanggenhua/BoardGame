# 作祟 31 交互子账本：A Ghost of a Chance

> 状态：`contract-ready`。这是诅咒物品作祟，核心是物品/预兆转成怪物、解除诅咒、Holy Symbol 逃离和叛徒偷取。

## 1. 源段锁定

| 项 | 内容 |
| --- | --- |
| 英雄书 | `betrayal-3e-secrets-of-survival-en.md` p39 |
| 叛徒书 | `betrayal-3e-traitors-tome-en.md` p34 |
| 剧本卡 / 触发预兆 | Paranormal Investigators / Holy Symbol |
| 叛徒 | 作祟揭秘者 |
| 类型 | 一名叛徒 + Cursed Item 怪物 + 逃离收集目标 |

## 2. 公开步骤

- 公开所有物品和预兆会被集中成 Cursed Items，英雄需要击晕并解除诅咒后拿回。
- 公开英雄持有 Holy Symbol 和足够其他物品/预兆，在 Entrance Hall 回合结束时胜利。
- 公开 Holy Symbol 持有者每回合结束受伤，除非已在 Entrance Hall 且满足胜利数量。

## 私密可见性

- 英雄可见：Cursed Item 位置、对应卡牌、解除诅咒状态和 Holy Symbol 持有人。
- 叛徒可见：偷取物品 / 预兆、Cursed Item 行动和怪物化压力。
- 诅咒物品对应关系是作祟目标状态，不能只展示为普通怪物 token。

## 3. setup 队列

英雄侧：
1. 英雄无额外 setup。
2. 叛徒左侧玩家先行动。

叛徒侧：
1. 叛徒保留探索者并治疗全部属性。
2. Monster Card 放在叛徒左侧，Cursed Items 在叛徒后行动。
3. 从所有玩家处收走全部物品和预兆；从 Holy Symbol 开始，按人数留下 4/5/7/9 张面朝上，若不足则全部留下。
4. 掩埋剩余物品和预兆。
5. 用一组 Number token 放在留下的卡牌上，匹配的 Number token 放到屋内不同物品/预兆符号房间；若仍有剩余，放入口大厅。

## 4. 目标模型

| 阵营 | 胜利条件 |
| --- | --- |
| 英雄 | 持有 Holy Symbol 和 3/4/5/7 个其他物品或预兆，并在 Entrance Hall 回合结束 |
| 叛徒 | 所有英雄死亡 |

## 5. 特殊行动 / 攻击规则

| 行动 | 使用者 | 条件 | 检定 / 结果 | UI 承接 |
| --- | --- | --- | --- | --- |
| 解除诅咒 | 英雄 | 与已击晕 Cursed Item 同房间 | 移除 token 并获得对应物品/预兆卡；该对象不再被诅咒 | Cursed Item token 动作 |
| 与灵体交谈 | 英雄 | 在 spiritual energy 房间 | 受 1 骰一般伤害，并提升任意属性 1 步 | 房间动作 + 属性选择 |
| 通灵攻击 Cursed Item | 英雄 | 与 Cursed Item 同房间且不使用武器 | 可用神志或知识攻击；若失败受精神伤害 | 攻击声明 |
| 通灵爆发 | 叛徒 | 与 Cursed Item 同房间 | 移除该 token，获得对应卡牌，选择同区域英雄受 2 骰一般伤害 | token 动作 + 英雄目标 |
| 偷取持有物 | 叛徒或英雄 | 用力量攻击对应敌人并获胜 | 可偷 1 张物品或预兆替代造成伤害 | 攻击胜利替代选择 |

Spiritual Energy 房间：Gallery、Graveyard、Operating Theatre、Soundproofed Room。

## 6. 持续 / 触发规则

- Cursed Item 的 Number token 与对应物品/预兆卡绑定。
- Cursed Item 若对应卡牌是武器，可使用该武器攻击；Dagger 不触发失去速度。
- 英雄回合结束时，若持有 Holy Symbol 且不满足 Entrance Hall 胜利条件，受 1 骰一般伤害。
- Cursed Items 在叛徒回合后行动。

## 7. token / 怪物合同

| 对象 | 数量 | 状态真相 |
| --- | ---: | --- |
| Cursed Item token | 4/5/7/9 或更少 | 编号、对应卡牌、房间、状态、是否已解除 |
| Holy Symbol | 1 | 当前持有人、胜利关键卡、回合末伤害来源 |
| Number token 对 | 同 Cursed Item | 卡牌上编号与地图 token 编号一一对应 |

Cursed Item 属性：力量 5、速度 4、神志 5、知识 5。

## 8. UI 承接

- 主目标条显示 Holy Symbol 持有人和所需其他物品/预兆数量。
- 地图 Cursed Item 必须能查看对应编号，但未解除前不直接变成普通持有物。
- 解除诅咒必须只对击晕 Cursed Item 开放。

## 9. 验证

- 单测：按人数设置 Cursed Item 数；Holy Symbol 起始保留；解除诅咒获得对应卡；Holy Symbol 回合末伤害；Cursed Item 武器攻击；Entrance Hall 收集胜利。
- 页面测试：编号绑定、击晕后解除、持有物数量目标条。
- E2E：覆盖英雄解除足够 Cursed Item 并带 Holy Symbol 逃离胜利。
