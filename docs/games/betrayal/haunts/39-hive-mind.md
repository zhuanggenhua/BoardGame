# 作祟 39 交互子账本：Hive Mind

> 状态：`contract-ready`。这是最高知识叛徒作祟，核心是 Wasp Eggs、倒计时孵化、Worker Wasp 防御和 Giant Wasp。

## 1. 源段锁定

| 项 | 内容 |
| --- | --- |
| 英雄书 | `betrayal-3e-secrets-of-survival-en.md` p48 |
| 叛徒书 | `betrayal-3e-traitors-tome-en.md` p46-p47 |
| 剧本卡 / 触发预兆 | Cursed! / Book |
| 叛徒 | 最高知识，排除作祟揭秘者 |
| 类型 | 叛徒变大怪物 + 卵 token + 倒计时 |

## 2. 公开步骤

- 公开叛徒探索者变成 Giant Wasp，原物品和预兆掩埋。
- 公开英雄可拾取和交易 Wasp Eggs，并尝试销毁。
- 公开攻击 Giant Wasp 时，屋内和英雄持有的每个 Wasp Egg 都会让攻击结果 -1。

## 私密可见性

- 英雄可见：Wasp Egg 位置 / 持有人、倒计时、Worker Wasp 和 Giant Wasp 位置。
- 叛徒可见：产卵、Worker Wasp 防御、孵化倒计时和 Giant Wasp 攻击减值来源。
- Wasp Egg 的持有 / 房间状态是公开胜负状态，必须在攻击面板参与计算。

## 3. setup 队列

英雄侧：
1. 数字轨设为 5/4/4/3。
2. 叛徒左侧玩家先行动。

叛徒侧：
1. 叛徒完成变形：移除探索者，替换为 Giant Wasp，掩埋全部物品和预兆。
2. Monster Card 放在叛徒左侧，怪物回合替代叛徒回合。
3. 将 5 个 Nest token 分布在不同一楼和/或二楼房间，代表 Wasp Eggs。
4. 在 Giant Wasp 房间放置 0/2/3/5 个 Worker Wasp。

## 4. 目标模型

| 阵营 | 胜利条件 |
| --- | --- |
| 英雄 | 成功攻击并击败 Giant Wasp |
| 叛徒 | 所有英雄死亡，或数字轨到 0 |

## 5. 特殊行动

| 行动 | 使用者 | 条件 | 检定 / 结果 | UI 承接 |
| --- | --- | --- | --- | --- |
| 毁卵 | 持有 Wasp Eggs 的英雄 | 持有至少 1 个 Wasp Egg | 知识检定；5+ 将自己持有的全部 Wasp Eggs 交还叛徒，表示销毁；0-4 在自己房间放 1 个 Worker Wasp | 持有 token 动作 |
| 护卫蜂群 | Worker Wasp | 与英雄同房间 | 对该英雄造成 1 骰物理伤害，然后该 Worker Wasp 死亡 | 怪物动作 |
| 产卵 | Giant Wasp | 在有尸体房间，且有已移出屋内的 Wasp Eggs | 在尸体房间放 1 个 Wasp Egg，移除尸体并掩埋其物品和预兆 | 尸体动作 |

## 6. 持续 / 触发规则

- 英雄可拾取 Wasp Egg，并按正常交易规则交易。
- 英雄攻击 Giant Wasp 时，屋内所有 Wasp Eggs（包括英雄持有）每个 -1。
- Worker Wasp 被伤害时死亡而不是击晕。
- 叛徒回合中先让每个 Worker Wasp 行动，再让 Giant Wasp 行动。
- 叛徒回合结束时，每个 Wasp Egg 所在房间放 1 个 Worker Wasp；若同一房间多个 Wasp Egg，每个卵放 1 个。
- 若屋内仍有 Wasp Egg，数字轨 -1；到 0 叛徒胜利。

## 7. token / 怪物合同

| 对象 | 数量 | 状态真相 |
| --- | ---: | --- |
| Wasp Egg | 5 | 房间/持有人/已销毁/可被产卵恢复 |
| Worker Wasp | 0/2/3/5 起，可变 | 房间、状态、是否由卵生成 |
| Giant Wasp | 1 | 房间、怪物回合、被攻击减值 |
| 数字轨 | 1 | 孵化倒计时 |

Worker Wasp 属性：力量 3、速度 5、神志 4、知识 1。Giant Wasp 属性：力量 6、速度 5、神志 5、知识 5。

## 8. UI 承接

- 主目标条显示 Wasp Egg 剩余数、持有人和倒计时。
- 攻击 Giant Wasp 面板必须显示每个 Wasp Egg 带来的 -1。
- 怪物回合结束生成 Worker Wasp 要按每个卵逐个可见。

## 9. 验证

- 单测：Wasp Egg 分布；毁卵成功移出并失败生 Worker；Giant Wasp 攻击减值；Worker Wasp 护卫后死亡；回合末每卵生 Worker 并降轨；产卵消耗尸体。
- 页面测试：卵拾取/交易/销毁、倒计时、Giant Wasp 攻击减值。
- E2E：覆盖英雄减少卵后击败 Giant Wasp 胜利。
