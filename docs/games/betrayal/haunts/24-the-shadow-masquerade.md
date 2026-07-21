# 作祟 24 交互子账本：The Shadow Masquerade

> 状态：`contract-ready`。这是最高速度叛徒作祟，核心是 Seelie Flame 搬运到 Chapel、Ballroom 舞会和 Dark Queen 登场。

## 1. 源段锁定

| 项 | 内容 |
| --- | --- |
| 英雄书 | `betrayal-3e-secrets-of-survival-en.md` p32 |
| 叛徒书 | `betrayal-3e-traitors-tome-en.md` p26-p27 |
| 剧本卡 / 触发预兆 | A Mysterious Invitation / Mask |
| 叛徒 | 速度最高角色 |
| 类型 | 一名叛徒 + 搬运 token + 舞会房间战斗 |

## 2. 公开步骤

- 公开英雄要把所有 Seelie Flame 放到 Chapel。
- 公开 Seelie Flame 可携带、交易、死亡掉落，一人最多持有 1 个。
- 公开 Fae Dancer 只会在 Ballroom 攻击英雄，Dark Queen 会在 Ballroom 首次有人死亡后登场。

## 私密可见性

- 英雄可见：Seelie Flame 位置 / 持有人、Chapel 目标、Ballroom 状态和 Dark Queen 是否登场。
- 叛徒可见：Fae Dancer / Dark Queen 行动、舞会压力和叛徒目标。
- Seelie Flame 是公开目标 token；搬运和掉落不能当隐藏状态。

## 3. setup 队列

英雄侧：
1. 准备 2/3/4/5 个 Fire token 作为 Seelie Flame。
2. 若 Tower、Statuary Corridor、Conservatory、Graveyard、Underground Cavern、Underground Lake 已发现，在这些房间各放 1 个 Seelie Flame，剩余放一边。
3. 叛徒左侧玩家先行动。

叛徒侧：
1. 叛徒保留探索者并治疗全部属性。
2. 若 Ballroom 或 Chapel 未发现，从房间堆搜索并按正常规则放到一楼。
3. 叛徒和 1/2/3/4 个 Fae Dancer 放到 Ballroom。
4. Dark Queen token 放在一边，等待登场。

## 4. 目标模型

| 阵营 | 胜利条件 |
| --- | --- |
| 英雄 | 所有 Seelie Flame 都位于 Chapel |
| 叛徒 | 所有英雄死亡 |

## 5. 特殊行动

| 行动 | 使用者 | 条件 | 检定 / 结果 | UI 承接 |
| --- | --- | --- | --- | --- |
| 拾起火焰 | 英雄 | 在有 Seelie Flame 的房间且自己未持有 | 知识或速度检定；5+ 携带火焰；0-4 受 2 一般伤害后仍携带火焰 | Fire token 动作 |
| 自愿丢下火焰 | 持有 Seelie Flame 的英雄 | 自己回合任意时刻 | 将火焰放在当前房间 | 持有 token 动作 |
| 速度无武器攻击 | 叛徒 | 不使用武器攻击 | 可用速度攻击；胜利时不造成伤害，改为按本应造成的伤害点数移动双方各最多相应格数 | 攻击声明 + 双方路径选择 |
| 永恒之舞 | Dark Queen | Dark Queen 行动 | 掷 2 骰，可移动同区域一名英雄最多结果格数 | 怪物动作 + 目标路径 |

## 6. 持续 / 触发规则

- 发现带 Seelie Flame 的指定房间时，若还有未放置 Seelie Flame，在该房间放 1 个。
- 英雄死亡时若携带 Seelie Flame，token 掉落在死亡房间。
- 英雄回合结束时，若所有 Seelie Flame 都在 Chapel，英雄胜利。
- Ballroom 上首次有探索者死亡时，Dark Queen 放到 Ballroom。
- 叛徒回合后 Fae Dancer 逐个行动；Fae Dancer 完成后若 Dark Queen 已登场，Dark Queen 行动。
- Fae Dancer 使用速度攻击，只能攻击 Ballroom 中的英雄；英雄用速度防御，受物理伤害。

## 7. token / 怪物合同

| 对象 | 数量 | 状态真相 |
| --- | ---: | --- |
| Seelie Flame | 2/3/4/5 | 房间/持有人、是否在 Chapel、每人最多 1 个 |
| Fae Dancer | 1/2/3/4 | 房间、逐个行动、只攻击 Ballroom 英雄 |
| Dark Queen | 0/1 | 是否已登场、房间、行动权 |

Fae Dancer 属性：力量 3、速度 6、神志 3、知识 2。Dark Queen 属性：力量 7、速度 6、神志 4、知识 5。

## 8. UI 承接

- 主目标条显示 Seelie Flame 总数和已在 Chapel 数量。
- 持有火焰的英雄角色板要显示“不能再拾取第二个”。
- Ballroom 应有舞会危险状态，显示 Fae Dancer 只在那里攻击。

## 9. 验证

- 单测：火焰人数数量；指定房间已发现/后发现放置；拾取失败仍携带且受伤；全部在 Chapel 胜利；Dark Queen 登场；Fae Dancer 逐个行动和 Ballroom 限制。
- 页面测试：火焰携带/交易/掉落、Chapel 进度、Dark Queen 登场。
- E2E：覆盖搬运最后一个 Seelie Flame 到 Chapel 胜利。
