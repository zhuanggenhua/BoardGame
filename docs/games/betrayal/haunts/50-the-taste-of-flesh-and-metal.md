# 作祟 50 交互子账本：The Taste of Flesh and Metal

> 状态：`contract-ready`。这是血肉构装体作祟，核心是消耗房间翻面、爆炸物每区域放置、构装体吞尸加速、吞屋多次行动和全屋吞噬胜利。

## 1. 源段锁定

| 项 | 内容 |
| --- | --- |
| 英雄书 | `betrayal-3e-secrets-of-survival-en.md` p59 |
| 叛徒书 | `betrayal-3e-traitors-tome-en.md` p59 |
| 剧本卡 / 触发预兆 | Cursed! / Armor |
| 叛徒 | 作祟揭秘者 |
| 类型 | 叛徒变 Construct + Consumed 房间 + Explosive token |

## 2. 公开步骤

- 公开英雄通过掩埋物品或预兆设置 Explosive；当所有 Explosive 都已放置且每个区域至少 1 个时获胜。
- 公开 Consumed 房间翻面，没有符号和文字，四边都有门；Landing 不能被 Consumed。
- 公开 Construct 不能被击晕，并可吞噬尸体提升速度。

## 3. 私密可见性

- 英雄可见：Explosive 剩余、每区域是否已有爆炸物、Consumed 房间。
- 叛徒可见：Construct 速度数字轨、尸体吞噬目标、吞噬预兆房后传送选项。
- Consumed / Explosive 都是公开地图状态，不能只在怪物卡或日志里表达。

## 4. setup 队列

英雄侧：
1. 留出 3/4/4/5 个 Trap token，代表 Explosives。
2. 作祟后首回合由叛徒左侧玩家开始。

叛徒侧：
1. 叛徒被吞噬：掩埋叛徒全部物品和预兆，移除叛徒探索者，并用 Construct token 替换。
2. 将叛徒当前房间翻面；该房间成为 Consumed。
3. Monster Card 放在叛徒左侧；Construct 怪物回合替代叛徒回合。
4. 数字轨设为 2/3/3/4；这是 Construct 的速度。

## 5. 目标模型

| 阵营 | 胜利条件 |
| --- | --- |
| 英雄 | 全部 Explosive 已放置，且地下室 / 一楼 / 二楼每个区域至少有 1 个 Explosive |
| 叛徒 | 所有英雄死亡，或所有非 Landing 房间都被 Consumed |

## 6. 特殊行动

| 行动 | 使用者 | 条件 | 检定 / 结果 | UI 承接 |
| --- | --- | --- | --- | --- |
| 设置临时爆炸物 | 英雄 | 任意房间；每回合 1 次 | 先掩埋 1 张物品或预兆；再进行速度或知识检定；6+ 在当前房间放 Explosive，若储备已空可移动一个已放置 Explosive 到当前房间；0-5 不放置 Explosive | 房间动作 + 支付卡选择 |
| 吞噬尸体 | Construct | 与尸体同房间；每个 Construct 回合 1 次 | 移除尸体并掩埋该探索者物品和预兆；数字轨 +1 | 尸体目标动作 |
| 吞噬房屋 | Construct | 在未 Consumed 的非 Landing 房间 | 可多次执行：将当前房间翻面成为 Consumed；若所有非 Landing 房间都 Consumed，叛徒胜利 | 房间动作 |
| 预兆房传送 | Construct | 吞噬带预兆符号的房间后 | 可将 Construct 放到任一有英雄的房间；若这样做，失去本回合剩余移动 | 传送目标选择 |

## 7. 持续 / 触发规则

- Explosive 使用 Trap token 表示，但不是普通陷阱，不会因进入房间触发伤害。
- 设置爆炸物时，物品 / 预兆先被掩埋；检定失败也不会退还。
- Consumed 房间没有符号和文字，四边都有门。
- Landing 房间不能被 Consumed。
- Explosive 留在被 Consumed 的房间上；也允许在 Consumed 房间放置 Explosive。
- Construct 速度等于数字轨数值，并且每个 Construct 回合仍要按该速度掷骰决定移动。
- Construct 不能被击晕。

## 8. token / 怪物合同

| 对象 | 数量 | 状态真相 |
| --- | ---: | --- |
| Explosive | 3/4/4/5 | 房间、所在区域、是否可被移动 |
| Consumed room | 可变 | 房间是否翻面、是否 Landing 例外、原符号是否被吞噬 |
| 数字轨 | 1 | Construct 速度 |
| Construct | 1 | 房间、不可击晕、剩余移动、是否已吞尸 |
| 尸体 | 可变 | 房间、持有物 / 预兆是否已被掩埋 |

Construct 属性：力量 8、速度 = 数字轨、神志 4、知识 4。

## 9. UI 承接

- 主目标条显示 `Explosive 已放置数 / 总数` 和三大区域覆盖状态。
- 地图必须区分 Consumed 房间、Landing 例外、Explosive 所在区域和 Construct 当前可吞噬目标。
- 设置 Explosive 时要先让英雄选择要掩埋的物品 / 预兆，并预览失败也会失去该卡。

## 10. 验证

- 单测：Explosive 数量；设置爆炸物支付卡且失败不退；储备空时移动已放置 Explosive；每区域至少一个胜利；Consumed 房间四门 / 无符号；Landing 不能 Consumed；Explosive 留在 Consumed；Construct 吞尸加速；吞预兆房传送并失去剩余移动；全屋吞噬胜利。
- 页面测试：爆炸物区域进度、Consumed 地图、支付卡选择、Construct 吞屋 / 传送。
- E2E：覆盖英雄在三个区域完成 Explosive 布置胜利。

