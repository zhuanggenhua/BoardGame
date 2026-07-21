# 作祟 26 交互子账本：The Family's Blessing

> 状态：`contract-ready`。这是作祟揭秘者叛徒作祟，核心是祭坛、贡品破坏、亲族、暗道和 The Elder 第二回合登场。

## 1. 源段锁定

| 项 | 内容 |
| --- | --- |
| 英雄书 | `betrayal-3e-secrets-of-survival-en.md` p34 |
| 叛徒书 | `betrayal-3e-traitors-tome-en.md` p29 |
| 剧本卡 / 触发预兆 | A Mysterious Invitation / Holy Symbol |
| 叛徒 | 作祟揭秘者 |
| 类型 | 一名叛徒 + 祭坛目标 + 亲族怪物 + The Elder |

## 2. 公开步骤

- 公开英雄必须依次完成：破坏贡品、杀死叛徒、摧毁祭坛。
- 公开 Ritual Room 若未发现，需要放到地下室。
- 公开 The Elder 初始不在场，叛徒第二个回合结束时会在祭坛出现。

## 私密可见性

- 英雄可见：祭坛位置、贡品 / 亲族 token、The Elder 是否登场和目标进度。
- 叛徒可见：暗道行动、亲族 / Elder 行动和召唤节奏。
- 祭坛与贡品是公开地图目标，不能只在剧本书里描述。

## 3. setup 队列

英雄侧：
1. 将 Altar token 放在任意一楼房间。
2. 若 Ritual Room 未发现，从房间堆搜索并放到地下室。
3. 叛徒左侧玩家先行动。

叛徒侧：
1. 叛徒保留探索者并治疗全部属性。
2. Monster Card 放在叛徒左侧。
3. 在不同预兆符号房间放置 2/3/4/5 个 Relative；预兆房间不足时，剩余放入口大厅。
4. Dark Queen token 放一边，代表 The Elder。

## 4. 目标模型

| 阵营 | 胜利条件 |
| --- | --- |
| 英雄 | 叛徒死亡、贡品已破坏、并成功摧毁 Altar |
| 叛徒 | 所有英雄死亡 |

## 5. 特殊行动

| 行动 | 使用者 | 条件 | 检定 / 结果 | UI 承接 |
| --- | --- | --- | --- | --- |
| 破坏贡品 | 英雄 | 在 Ritual Room | 神志检定；4+ 标记贡品已被扰乱；0-3 受 1 物理伤害 | Ritual Room 动作 + 目标阶段 |
| 摧毁祭坛 | 英雄 | 在 Altar 所在房间；贡品已破坏且叛徒已死 | 力量检定；4+ 英雄胜利；0-3 受 1 精神伤害 | Altar token 动作 |
| 修剪家族树 | 英雄 | 在 Family Effigies 房间且有 Relative | 神志检定；5+ 移除 1 个 Relative；0-4 受 1 物理伤害 | 房间动作 + Relative 目标 |
| 使用暗道 | 叛徒 / Relative / The Elder | 在卧室房间 | 放置到任意房间 | 房间动作 + 目标房间选择 |

Family Effigies 房间：Gallery、Statuary Corridor。卧室房间：Guest Quarters、Primary Bedroom、Winter Bedroom。

## 6. 持续 / 触发规则

- 叛徒第二个回合结束时，将 The Elder 放在 Altar 房间。
- 叛徒回合后 Relative 行动；Relative 行动后若 The Elder 已登场，The Elder 行动。
- Relative 和 The Elder 都可使用暗道。

## 7. token / 怪物合同

| 对象 | 数量 | 状态真相 |
| --- | ---: | --- |
| Altar | 1 | 房间、是否可摧毁、The Elder 登场点 |
| Relative | 2/3/4/5 | 房间、状态、可暗道 |
| The Elder | 0/1 | 是否已登场、房间、可暗道 |
| Tribute 状态 | 1 | 是否已被破坏 |

Relative 属性：力量 4、速度 4、神志 3、知识 4。The Elder 属性：力量 7、速度 5、神志 6、知识 6。

## 8. UI 承接

- 主目标条必须显示三段门槛：破坏贡品、杀死叛徒、摧毁祭坛。
- Altar token 和 The Elder 登场倒计时要地图化表达。
- 暗道行动必须通过卧室房间本体触发，并选择目标房间。

## 9. 验证

- 单测：Altar 放置、Ritual Room 搜索、Relative 放置不足回入口、The Elder 第二回合登场、三段胜利门槛、暗道移动。
- 页面测试：阶段目标条、Altar 摧毁禁用原因、The Elder 登场提示。
- E2E：覆盖贡品已破坏且叛徒死亡后摧毁祭坛胜利。
