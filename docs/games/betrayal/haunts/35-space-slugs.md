# 作祟 35 交互子账本：Space Slugs

> 状态：`contract-ready`。这是蛞蝓感染作祟，核心是 Salt、Nest、Mind Controlled 阵营转换和蛞蝓群攻后死亡。

## 1. 源段锁定

| 项 | 内容 |
| --- | --- |
| 英雄书 | `betrayal-3e-secrets-of-survival-en.md` p44 |
| 叛徒书 | `betrayal-3e-traitors-tome-en.md` p40 |
| 剧本卡 / 触发预兆 | A Strange Disappearance / Skull |
| 叛徒 | 作祟揭秘者 |
| 类型 | 一名叛徒 + Nest 目标 + 怪物感染转阵营 |

## 2. 公开步骤

- 公开英雄要找到 Salt 并摧毁两个 Nest。
- 公开 Salt 可交易，携带者死亡时掉落在死亡房间。
- 公开 Slug 攻击英雄成功会让英雄 Mind Controlled，加入叛徒目标并可读叛徒书。

## 私密可见性

- 英雄可见：Salt token、Nest、Space Slug 位置和感染 / Mind Controlled 状态。
- 叛徒可见：蛞蝓感染、群攻后死亡和阵营转换目标。
- Mind Controlled 是公开阵营状态，必须立即影响目标条和可攻击对象。

## 3. setup 队列

英雄侧：
1. 英雄无额外 setup。
2. 叛徒左侧玩家先行动。

叛徒侧：
1. 叛徒保留探索者，Monster Card 放在叛徒左侧。
2. 在任意地下室房间放 1 个 Nest，在任意二楼房间放 1 个 Nest。
3. 在叛徒房间放置 2/3/4/5 个 Slug。

## 4. 目标模型

| 阵营 | 胜利条件 |
| --- | --- |
| 英雄 | 摧毁两个 Nest |
| 叛徒 | 所有英雄死亡或 Mind Controlled |

## 5. 特殊行动

| 行动 | 使用者 | 条件 | 检定 / 结果 | UI 承接 |
| --- | --- | --- | --- | --- |
| 找盐 | 英雄 | 在可找盐房间 | 知识或速度检定；5+ 获得 Salt；2-4 无事；0-1 在自己房间放 Slug | 房间动作 + Salt 池 |
| 摧毁 Nest | 英雄 | 与 Nest 同房间 | 速度检定；可弃任意 Salt，每个 +2；9+ 摧毁 Nest，若两个都毁则英雄胜利；5-8 无事；0-4 在自己房间放 Slug | Nest 动作 + Salt 弃置 |
| 召唤群体 | 叛徒 | 在 Nest 房间 | 在该房间放 2 个 Slug | Nest 动作 |

可找盐房间：Kitchen、Dining Room、Underground Lake、Larder、Laboratory、Gymnasium。

## 6. 持续 / 触发规则

- Slug 被伤害时死亡而不是击晕。
- Slug 用神志攻击。
- 所有 Slug 必须先完成移动，然后才开始攻击。
- Slug 攻击时，同房间每个其他 Slug 让攻击结果 +1。
- Slug 攻击英雄成功时，该英雄 Mind Controlled，成为叛徒一方，并共享叛徒目标、可读叛徒书。
- Slug 攻击后，该房间所有 Slug 死亡，无论攻击是否成功。

## 7. token / 怪物合同

| 对象 | 数量 | 状态真相 |
| --- | ---: | --- |
| Slug | 2/3/4/5 起，可变 | 房间、状态、群体攻击加值、攻击后死亡 |
| Nest | 2 | 地下室/二楼位置、是否摧毁 |
| Salt | 5 | 房间或持有人、可交易、死亡掉落、弃置加值 |
| Mind Controlled | 可变 | 玩家阵营转换、可见叛徒书 |

Slug 属性：力量 3、速度 4、神志 3、知识 5。

## 8. UI 承接

- 主目标条显示两个 Nest 状态和 Salt 持有人。
- Slug 攻击面板必须显示同房间加值和“攻击后本房间 Slug 全死”。
- Mind Controlled 是阵营变化，不能只作为日志文字。

## 9. 验证

- 单测：Nest 一地下室一二楼；找盐三段结果；Salt 弃置加值；摧毁两个 Nest 胜利；Slug 群攻加值；攻击后 Slug 死亡；Mind Controlled 阵营转换。
- 页面测试：Salt 交易/掉落、Nest 摧毁、蛞蝓攻击说明。
- E2E：覆盖英雄摧毁双 Nest 和 Slug 感染最后英雄。
