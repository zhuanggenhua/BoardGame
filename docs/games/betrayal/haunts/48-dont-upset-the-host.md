# 作祟 48 交互子账本：Don't Upset the Host!

> 状态：`contract-ready`。这是房主之首作祟，核心是 Head of the House 携带 Skull、英雄夺头骨送到 Panic Room、头骨回合末咬人、叛徒和房主复活。

## 1. 源段锁定

| 项 | 内容 |
| --- | --- |
| 英雄书 | `betrayal-3e-secrets-of-survival-en.md` p57 |
| 叛徒书 | `betrayal-3e-traitors-tome-en.md` p57 |
| 剧本卡 / 触发预兆 | A Mysterious Invitation / Skull |
| 叛徒 | 最高力量 |
| 类型 | 一名叛徒 + 房主怪物 + Skull 携带物 + 指定房间送达 |

## 2. 公开步骤

- 公开英雄击败 Head of the House 时会杀死它而不是击晕，并拿到 Skull。
- 公开携带 Skull 的英雄回合末要进行速度检定，失败受 2 物理伤害。
- 公开携带 Skull 到 Panic Room 时英雄胜利。

## 3. 私密可见性

- 英雄可见：Head of the House 位置、Skull 当前持有人、Panic Room 是否已发现。
- 叛徒可见：Revive the Host、叛徒死亡回到 Bloody Room、房主怪物回合。
- Skull 是公开物理目标；不能只放在 Monster Card 文本里。

## 4. setup 队列

英雄侧：
1. 英雄无额外 setup。
2. 作祟后首回合由叛徒左侧玩家开始。

叛徒侧：
1. 叛徒保留探索者并成为叛徒。
2. 叛徒治疗全部属性，并获得 1 步力量。
3. Monster Card 放在叛徒左侧；Head of the House 在叛徒回合后行动。
4. 若 Bloody Room 未发现，从房间堆找出并放在一楼。
5. 在 Bloody Room 放 Head of the House token。
6. 将 Skull 放在 Monster Card 下，表示 Head of the House 正携带 Skull。

## 5. 目标模型

| 阵营 | 胜利条件 |
| --- | --- |
| 英雄 | 携带 Skull 到达 Panic Room |
| 叛徒 | 所有英雄死亡 |

## 6. 特殊行动

| 行动 | 使用者 | 条件 | 检定 / 结果 | UI 承接 |
| --- | --- | --- | --- | --- |
| 击败房主之首 | 英雄 | 攻击 Head of the House 且获胜 | Head of the House 死亡而不是击晕，移出房屋；攻击者拿到 Skull | 怪物攻击结算 + Skull 转移 |
| 携头骨抵达 Panic Room | 携带 Skull 的英雄 | 进入或位于 Panic Room | 英雄立即胜利 | 房间到达触发 |
| 复活房主 | 叛徒 | 叛徒持有 Skull；每回合 1 次 | 将 Head of the House 放到叛徒房间，然后把 Skull 放回 Monster Card 下 | Skull 动作 |

## 7. 持续 / 触发规则

- 每个英雄回合末，若该英雄携带 Skull，进行速度检定：5+ 无事；0-4 受到 2 物理伤害。
- 叛徒死亡时，将叛徒放到 Bloody Room 并治疗全部属性；叛徒不会因此退出游戏。
- Head of the House 被攻击击败时死亡，不进入击晕状态。
- Panic Room 是地下室房间；若未发现，英雄需要通过正常探索或规则允许的找房间流程找到它。

## 8. token / 怪物合同

| 对象 | 数量 | 状态真相 |
| --- | ---: | --- |
| Head of the House | 1 | 房间 / 死亡移出 / 被复活，是否携带 Skull |
| Skull | 1 | Monster Card / 英雄持有 / 叛徒持有 |
| Bloody Room | 1 | 叛徒复活点，必要时搜索放置 |
| Panic Room | 1 | 英雄目标房间，地下室 |

Head of the House 属性：力量 6、速度 6、神志 6、知识 8。

## 9. UI 承接

- 主目标条显示 Skull 当前归属和 Panic Room 是否已发现。
- 携带 Skull 的英雄回合末必须有咬人检定提示和伤害预览。
- Head of the House 被击败时要用 Skull 转移动画 / 短提示表达目标变化，不只写日志。

## 10. 验证

- 单测：最高力量叛徒选择；Bloody Room 搜索；Skull 初始在 Head；击败 Head 改为死亡并转移 Skull；Skull 回合末咬人；携 Skull 到 Panic Room 胜利；叛徒死亡回 Bloody Room；叛徒复活 Head。
- 页面测试：Skull 归属、Panic Room 目标、Head 死亡 / 复活。
- E2E：覆盖英雄击败 Head、承受 Skull 风险并到达 Panic Room 胜利。

