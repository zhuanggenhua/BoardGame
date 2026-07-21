# 作祟 47 交互子账本：A Knight to Remember

> 状态：`contract-ready`。这是传送门 / 另一维度作祟，核心是 Trapped 英雄、Portal token、逃离传送门、关闭传送门和叛徒按目标状态改变攻击方式。

## 1. 源段锁定

| 项 | 内容 |
| --- | --- |
| 英雄书 | `betrayal-3e-secrets-of-survival-en.md` p56 |
| 叛徒书 | `betrayal-3e-traitors-tome-en.md` p56 |
| 剧本卡 / 触发预兆 | Paranormal Investigators / Armor |
| 叛徒 | 作祟揭秘者 |
| 类型 | 一名不死叛徒 + Portal token + Trapped 状态 |

## 2. 公开步骤

- 公开持有自己 Hero token 的英雄处于 Trapped 状态。
- 公开 Trapped 英雄不能和非 Trapped 英雄交易，并在回合开始用速度掷骰决定移动。
- 公开英雄需要让 Trapped 英雄逃离传送门，再由非 Trapped 英雄关闭所有 Portal。

## 3. 私密可见性

- 英雄可见：每名英雄是否 Trapped、Portal 位置、关闭进度。
- 叛徒可见：每名英雄本回合是否已被攻击、按 Trapped 状态切换的攻击属性。
- Trapped 状态是公开阵营状态；不能只藏在英雄 token 持有物里。

## 4. setup 队列

英雄侧：
1. 英雄无额外 setup。
2. 作祟后首回合由叛徒左侧玩家开始。

叛徒侧：
1. 叛徒保留探索者并成为叛徒。
2. 叛徒治疗全部属性。
3. 找出 2/3/4/5 个 Portal token。
4. 对每名英雄，在该英雄所在区域中距离该英雄最远的房间放置 1 个 Portal token。
5. 给每名英雄其匹配 Hero token；持有 Hero token 的英雄为 Trapped。

## 5. 目标模型

| 阵营 | 胜利条件 |
| --- | --- |
| 英雄 | 关闭全部 Portal |
| 叛徒 | 所有英雄死亡 |

## 6. 特殊行动

| 行动 | 使用者 | 条件 | 检定 / 结果 | UI 承接 |
| --- | --- | --- | --- | --- |
| 穿越维度移动 | Trapped 英雄 | 自己回合开始 | 速度检定决定本回合可移动房间数，最低 1 | 回合开始骰盘 + 移动力 HUD |
| 逃离传送门 | Trapped 英雄 | 在 Portal 房间；每回合 1 次 | 知识检定；若同房间有非 Trapped 英雄 +2；6+ 将 Hero token 交给叛徒，不再 Trapped；0-5 获得 1 知识 | Portal 动作 |
| 关闭传送门 | 非 Trapped 英雄 | 在 Portal 房间；每回合 1 次 | 知识或神志检定；4+ 移除该 Portal，若是最后一个则英雄胜利；0-3 受到 1 骰精神伤害 | Portal 动作 + 剩余进度 |
| 残酷骑士攻击 | 叛徒 | 每个存活英雄每回合最多攻击 1 次 | 对 Trapped 英雄：神志攻击且 +2，获胜造成物理伤害；对非 Trapped 英雄：力量攻击，获胜不给伤害而给目标 Trapped token；叛徒失败不受伤 | 攻击面板按目标状态变形 |

## 7. 持续 / 触发规则

- Trapped 英雄不能与非 Trapped 英雄交易。
- 叛徒每回合可攻击次数等于存活英雄数量，但同一英雄每回合最多被叛徒攻击 1 次。
- 叛徒若将要死亡，改为治疗全部属性；叛徒不可被真正杀死。
- Portal token 被关闭后移出房屋；最后一个关闭立即英雄胜利。

## 8. token / 怪物合同

| 对象 | 数量 | 状态真相 |
| --- | ---: | --- |
| Portal token | 2/3/4/5 | 房间、是否关闭、对应区域放置来源 |
| Hero token | 每名英雄 1 | 持有人：英雄表示 Trapped；叛徒表示已逃离 |
| 本回合叛徒攻击记录 | 每名英雄 1 | 是否已被叛徒攻击，防止重复 |

## 9. UI 承接

- 角色板必须显示 Trapped / 非 Trapped，并解释交易限制和叛徒攻击差异。
- Portal 地图要显示哪些英雄能逃离、哪些英雄能关闭，不能把两种动作混成一个按钮。
- 叛徒攻击选择目标时，面板必须提前展示本次是神志攻击造成伤害，还是力量攻击施加 Trapped。

## 10. 验证

- 单测：Portal 数量和最远房间放置；Trapped 交易限制；Trapped 回合开始移动骰；逃离 +2；关闭 Portal；叛徒多次攻击上限；Trapped / 非 Trapped 攻击差异；叛徒不死。
- 页面测试：Trapped 状态、Portal 双动作、叛徒攻击目标预览。
- E2E：覆盖至少一名英雄逃离后关闭最后 Portal 胜利。

