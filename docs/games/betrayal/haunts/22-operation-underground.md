# 作祟 22 交互子账本：Operation: Underground

> 状态：`contract-ready`。这是左侧玩家叛徒作祟，核心是地下室重洗、英雄逃离、骷髅看地下室堆和冷战僵尸封锁。

## 1. 源段锁定

| 项 | 内容 |
| --- | --- |
| 英雄书 | `betrayal-3e-secrets-of-survival-en.md` p30 |
| 叛徒书 | `betrayal-3e-traitors-tome-en.md` p24 |
| 剧本卡 / 触发预兆 | For Sale / Skull |
| 叛徒 | 作祟揭秘者左侧玩家 |
| 类型 | 一名叛徒 + 地下室重置 + 逃离目标 + 僵尸生成 |

## 2. 公开步骤

- 公开英雄全部被移到地下室登陆板，目标是从 Entrance Hall 或 Graveyard 逃离。
- 公开地下室非登陆板房间会重新洗回房间堆。
- 公开叛徒被限制在 Laboratory，直到有英雄到达一楼。

## 3. 私密可见性

- 双方没有隐藏身份；叛徒行动规则和僵尸生成应在首次触发时公开。
- 英雄的 Skull 持有者可查看下一张地下室房间并决定放回顶部或底部；这是英雄侧信息，不应自动公开给叛徒。

## 4. setup 队列

英雄侧：
1. 将所有地下室房间除 Basement Landing 外洗回房间堆。
2. 每名英雄立牌移到 Basement Landing。
3. 叛徒左侧玩家先行动。

叛徒侧：
1. 叛徒保留探索者，Monster Card 放在叛徒左侧。
2. 若 Laboratory 未发现，从房间堆搜索并放到一楼；叛徒移到 Laboratory。
3. Cold War Zombies 在叛徒回合后行动。

## 5. 目标模型

| 阵营 | 胜利条件 |
| --- | --- |
| 英雄 | 任一英雄在 Entrance Hall 或 Graveyard 成功逃离 |
| 叛徒 | 所有英雄死亡 |

## 6. 特殊行动

| 行动 | 使用者 | 条件 | 检定 / 结果 | UI 承接 |
| --- | --- | --- | --- | --- |
| 逃离房屋 | 英雄 | 在 Entrance Hall 或 Graveyard | 速度检定；若持有 Dynamite 或 Skeleton Key +2；6+ 英雄胜利；0-5 无事 | 房间动作 + 加值明细 |
| 研究平面图 | 持有 Skull 的英雄 | 持有 Skull | 知识检定；5+ 查看房间堆下一张地下室房间，可放回顶部或底部；0-4 无事 | Skull 卡动作 + 私密预览 |
| 制造干扰 | 叛徒 | 在 Laboratory | 从房间堆翻到下一张地下室房间，并放到地下室任意合法位置 | 叛徒动作 + 房间放置 |

## 7. 持续 / 触发规则

- 叛徒不能离开 Laboratory，直到至少一名英雄到达一楼。
- 叛徒回合结束时，在 Basement Landing 放置 0/0/1/1 个 Zombie；若叛徒仍在 Laboratory，则在每个地下室开放门位房间放置 1 个 Zombie；小怪物 token 不足时不再放置。
- Zombie 在叛徒回合后行动。
- Zombie 被伤害时死亡而不是击晕。
- Zombie 杀死英雄时，移除该英雄尸体，并掩埋其所有物品和预兆。

## 8. token / 怪物合同

| 对象 | 数量 | 状态真相 |
| --- | ---: | --- |
| Cold War Zombie | 可变 | 房间、状态、是否已杀死英雄 |
| Skull | 1 | 持有人、地下室堆预览权限 |
| 地下室房间堆 | 可变 | 被重洗、预览、顶部/底部放回 |

Zombie 属性：力量 5、速度 2、神志 2、知识 2。

## 9. UI 承接

- 主目标条显示“逃到 Entrance Hall / Graveyard”，并提示当前仍在地下室。
- 地下室重洗后，地图应保留 Basement Landing，其他地下室连接按移除后的图结构重算。
- Skull 预览不能公开显示给非持有人。

## 10. 验证

- 单测：地下室非登陆板重洗；英雄全移到 Basement Landing；Laboratory 搜索放置；叛徒离开限制；Zombie 生成规则；Zombie 击杀移除尸体和掩埋物品。
- 页面测试：Skull 预览、逃离动作、地下室重新探索。
- E2E：覆盖英雄逃离胜利和 Zombie 杀死英雄后的尸体移除。

