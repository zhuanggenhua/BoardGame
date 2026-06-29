# 七大恨教程覆盖矩阵

> 目的：把“规则条目 -> 教程章节 -> 证据截图/用例”先锁清，再继续扩教程实现。

## 当前章节设计

1. `basic-opening`
   - 目标：从真实开局主入口走完一次手牌行动和一次轮盘行动。
2. `diplomacy-and-hire`
   - 目标：从真实轮盘外交/雇佣入口进入，完成一次外交与雇佣结算。
3. `field-battle`
   - 目标：看懂一次野战的战果、承伤与战后占领。
4. `siege-and-occupation`
   - 目标：看懂城战胜利后，占领与围城的差别。
5. `season-flow`
   - 目标：看懂年中判定、新年维护与跨年结算摘要。

## 规则覆盖矩阵

| 规则条目 | 对应章节 | 章节内主步骤 | 预期证据 |
| :--- | :--- | :--- | :--- |
| 胜利目标：扩地 / 攻首都 / 3 威望 | `basic-opening` | `welcome` | 教程首屏截图 |
| 玩家回合骨架：一次手牌行动 + 一次轮盘行动 | `basic-opening` | `opening-entry` `wheel-move` | 基础章流程截图 |
| 手牌是主要资源，弃牌支付行动 | `basic-opening` | `hand-resource` `pay-cards` | 支付前后截图 |
| 先选地区再执行势力行动 | `basic-opening` | `select-region` `pick-action` | 地图选区与行动选择截图 |
| 势力行动会直接改变地图控制 | `basic-opening` | `action-result` | 控制权变化截图 |
| 部队等级也是士气，影响战斗强度 | `basic-opening` | `morale-level` | 地图等级提示截图 |
| 轮盘行动从真实轮盘可点入口进入 | `basic-opening` | `wheel-move` | 轮盘高亮与执行截图 |
| 外交：友好 / 附庸 / 移除控制标记 | `diplomacy-and-hire` | `choose-target` `place-friendly` | 外交前后截图 |
| 雇佣：在控制区建立 2 个等级 2 雇佣军 | `diplomacy-and-hire` | `hire-only` / `finish` | 雇佣结算后地图截图 |
| 同一次外交雇佣会一边处理标记一边结算雇佣 | `diplomacy-and-hire` | `place-friendly` `finish` | 历史记录 + 结果截图 |
| 野战：先决定承伤顺序，再看掷骰与幸存兵力 | `field-battle` | `casualty-priority` `battle-result` | 承伤选择 + 战果面板截图 |
| 野战胜利后可占领或回退 | `field-battle` | `occupy-region` | 战后占领截图 |
| 城战与野战不同，打赢后可能先围城 | `siege-and-occupation` | `result` `besiege-choice` | 围城选择截图 |
| 围城不会立刻改控制权 | `siege-and-occupation` | `finish` | 围城后摘要截图 |
| 年中：土地税赋 / 战败标记 / 人物判定 | `season-flow` | `midyear-summary` | 年中摘要截图 |
| 新年：防线维护 / 兵力耗损 / 纪年推进 | `season-flow` | `new-year-maintenance` `season-finish` | 新年维护与跨年摘要截图 |

## 当前缺口策略

1. 不再做“单条超长教程覆盖一切”。
2. 刷新会丢教程进度，因此优先保留短章节。
3. 新增章节必须满足：
   - 从该规则段真实入口进入。
   - 至少有一次真实结果反馈。
   - 至少有一张能指认“下一步点哪里”的截图。
