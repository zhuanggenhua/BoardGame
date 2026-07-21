# 作祟 28 交互子账本：We're Going to Need a Bigger House

> 状态：`contract-ready`。这是吞鲨和洪水作祟，核心是房间翻面淹没、炸药搜索、洪水扩张和幽灵鲨鱼。

## 1. 源段锁定

| 项 | 内容 |
| --- | --- |
| 英雄书 | `betrayal-3e-secrets-of-survival-en.md` p36 |
| 叛徒书 | `betrayal-3e-traitors-tome-en.md` p31 |
| 剧本卡 / 触发预兆 | Paranormal Investigators / Idol |
| 叛徒 | 作祟揭秘者 |
| 类型 | 叛徒死亡转怪物 + 洪水扩张 + 炸药终结 |

## 2. 公开步骤

- 公开叛徒探索者已被幽灵鲨鱼吞掉，叛徒改为控制 Great White Ghost Shark。
- 公开 Flooded 房间翻面，四边有门、无符号无效果，Landing 不会被 Flooded。
- 公开英雄需要搜索 Explosives，并在 Shark 房间强塞炸药。

## 私密可见性

- 英雄可见：Flooded 房间、爆炸物位置 / 持有人、幽灵鲨鱼位置和终结条件。
- 叛徒可见：洪水扩张、鲨鱼行动和全屋淹没胜利进度。
- Flooded 与爆炸物都是公开地图状态，不允许只在日志记录。

## 3. setup 队列

英雄侧：
1. 英雄无额外 setup。
2. 叛徒左侧玩家先行动。

叛徒侧：
1. 叛徒探索者和 Idol 移出游戏；叛徒所有物品和预兆掩埋。
2. Ghost Shark token 放在叛徒原房间。
3. Monster Card 放在叛徒左侧，Shark 替代叛徒回合。
4. 叛徒原房间翻面 Flooded；再翻面同区域 0/1/2/3 个房间为 Flooded。

## 4. 目标模型

| 阵营 | 胜利条件 |
| --- | --- |
| 英雄 | 在 Shark 房间强塞炸药并成功炸死 Shark |
| 叛徒 | 所有英雄死亡，或屋内所有非 Landing 房间 Flooded |

## 5. 特殊行动

| 行动 | 使用者 | 条件 | 检定 / 结果 | UI 承接 |
| --- | --- | --- | --- | --- |
| 搜索炸药 | 英雄 | 在物品符号房间 | 速度检定；4+ 获得 Trap token 作为 Explosives；0-3 无事 | 房间动作 + 炸药池 |
| 强塞炸药 | 英雄 | 与 Shark 同房间 | 力量检定；可弃任意 Explosives，每个 +2；若有 Dynamite +2；10+ 英雄胜利；0-9 受 2 物理伤害并结束回合 | Shark 对象动作 + 弃 token 多选 |
| 危险音乐 | Shark | Shark 回合 | 移动到任意 Flooded 房间 | 怪物动作 + Flooded 目标选择 |

## 6. 持续 / 触发规则

- 每个英雄回合开始时，翻面一个与 Flooded 房间相邻的非 Landing 房间；若无法这样做，则翻面一个与任意 Landing 相邻的非 Landing 房间。
- Flooded 房间无符号无效果，四边有门；Landing 不能 Flooded。
- Shark 不能被击晕。
- Shark 回合结束时，若所有非 Landing 房间都 Flooded，叛徒胜利。
- Explosives 可在英雄之间按正常交易规则交易。

## 7. token / 怪物合同

| 对象 | 数量 | 状态真相 |
| --- | ---: | --- |
| Ghost Shark | 1 | 房间、不可击晕、可传送至 Flooded 房间 |
| Explosives | 5 | 持有人、可交易、可被弃作 +2 |
| Flooded 房间 | 可变 | 原房间、翻面、非 Landing、四边门 |

Shark 属性：力量 8、速度 2、神志 4、知识 4。

## 8. UI 承接

- 地图必须显示 Flooded 连通扩张边界和 Landing 例外。
- 主目标条显示 Explosives 持有人数量、Shark 位置、洪水覆盖进度。
- 强塞炸药面板显示每个弃置 Explosives 的 +2 和 Dynamite +2。

## 9. 验证

- 单测：叛徒移出并掩埋物品；初始 Flooded 人数规则；英雄回合开始洪水扩张；Landing 不 Flooded；炸药加值；全屋 Flooded 叛徒胜利。
- 页面测试：Flooded 翻面、炸药搜索、Shark 传送。
- E2E：覆盖英雄炸死 Shark 和洪水吞屋两条终局。
