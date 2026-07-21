# 作祟 17 交互子账本：Forward This or Die

> 状态：`contract-ready`。这是邮件抽签作祟，核心是 Gremlin 可杀标记、手机研究和 DIE 伏击。

## 1. 源段锁定

| 项 | 内容 |
| --- | --- |
| 英雄书 | `betrayal-3e-secrets-of-survival-en.md` p25 |
| 叛徒书 | `betrayal-3e-traitors-tome-en.md` p17 |
| 剧本卡 / 触发预兆 | Cursed! / Dagger |
| 叛徒 | 作祟揭秘者 |
| 类型 | 叛徒 + Gremlin + 公开抽签压力 |

## 2. 公开步骤

- 公开 Gremlin 没有 Rune token 时不能被攻击；有 Rune token 时被攻击成功会死亡而不是击晕。
- 公开英雄回合结束会抽邮件；抽到 DIE 会引发 Gremlin 伏击。
- 公开叛徒保留探索者并控制 Gremlin。

## 私密可见性

- 英雄可见：Gremlin 位置、是否已被可杀标记、手机研究进度和公开抽签结果。
- 叛徒可见：DIE 伏击触发、Gremlin 行动和叛徒目标。
- 抽签 / 标记结果影响全桌风险，必须在目标条或地图状态公开承接。

## 3. setup 队列

英雄侧：
1. 英雄无额外 setup。
2. 作祟后首回合由叛徒左侧玩家开始。

叛徒侧：
1. 叛徒保留探索者，治疗全部属性。
2. Monster Card 放在叛徒左侧，Gremlin 在叛徒后行动。
3. 在叛徒房间放置 3 个 Gremlin。
4. 准备 6/5/4/3 张邮件签，其中只有 1 张为 DIE，其余为 X。

## 4. 目标模型

| 阵营 | 胜利条件 |
| --- | --- |
| 英雄 | 杀死叛徒和所有 Gremlin |
| 叛徒 | 所有英雄死亡 |

## 5. 特殊行动

| 行动 | 使用者 | 条件 | 检定 / 结果 | UI 承接 |
| --- | --- | --- | --- | --- |
| 手机研究 | 英雄 | 在有信号房间 | 知识检定；5+ 给一个 Gremlin 放 Rune token，使其可被攻击且成功攻击会杀死；0-4 受 1 精神伤害 | 房间动作 + Gremlin 目标选择 |

有信号房间：Tower、Gallery、Observatory。

## 6. 持续 / 触发规则

- 英雄不能攻击没有 Rune token 的 Gremlin。
- 有 Rune token 的 Gremlin 被成功攻击时死亡而不是击晕。
- 每个英雄回合结束抽 1 张邮件并给叛徒看。
- 抽到 X：无事，将该签放到一边。
- 抽到 DIE：所有邮件签放回池中；最多 2 个未击晕 Gremlin 移动到该英雄房间，并各自用力量攻击该英雄。
- Gremlin 在叛徒回合后行动。

## 7. token / 怪物合同

| 对象 | 数量 | 状态真相 |
| --- | ---: | --- |
| Gremlin | 3 | 房间、是否击晕、是否有 Rune token |
| Rune token | 3 | 绑定 Gremlin；使其可被杀 |
| 邮件签 | 6/5/4/3 | X/DIE、抽签池、已抽出集合 |

Gremlin 属性：力量 5、速度 6、神志 6、知识 2。

## 8. UI 承接

- 主目标条显示“标记 Gremlin -> 杀死 Gremlin -> 杀死叛徒”。
- Gremlin token 必须显示是否有 Rune token，未标记时攻击按钮禁用并说明原因。
- 邮件抽签是公开随机事件，DIE 触发时要选择最多 2 个未击晕 Gremlin。

## 9. 验证

- 单测：邮件池人数规则；X 移出、DIE 重置；Gremlin 伏击最多 2 个且需未击晕；未标记 Gremlin 不能被攻击；标记后成功攻击杀死。
- 页面测试：手机研究、Gremlin 标记、邮件抽签结果。
- E2E：覆盖抽到 DIE 伏击，以及英雄标记并杀死最后 Gremlin 胜利。
