## 1. 现状盘点
- [x] 1.1 盘点 DiceThrone 当前所有会推动攻击收口的入口：`offensiveRoll`、`targetingRoll`、`defensiveRoll`、Token 响应关闭、奖励骰结算、`postDamage` 选择。
- [x] 1.2 列出当前 `PendingAttack` 上所有结算相关布尔位及其真实含义、写入点、消费点与已知混叠。

## 2. 领域模型重构
- [x] 2.1 为 `PendingAttack` 设计显式攻击结算阶段模型，替代当前依赖多个布尔位拼接的收口语义。
- [x] 2.2 让主伤害落地只允许从单一入口发出一次，并把 `postDamage` 后续选择改为阶段推进，不再允许回到主伤害入口。
- [x] 2.3 拆分“奖励骰结算完成”与“攻击后续选择完成”的语义，移除对 `bonusDiceResolved` 的跨职责复用。
- [x] 2.4 收敛 `targetingRoll` / `preDefense` / `postDamage` / `ATTACK_RESOLVED` 的 autoContinue 门禁，使其只依赖显式阶段。

## 3. 回归验证
- [x] 3.1 补领域测试：同一笔攻击的主伤害最多只能落地一次。
- [x] 3.2 补领域测试：4 人 / 2v2 `targetingRoll` + `postDamage` 选择不会重复发出 `DAMAGE_DEALT`。
- [x] 3.3 补领域测试：奖励骰、Token 响应、不可防御攻击、闪避/潜行等路径在新阶段模型下不回归。
- [x] 3.4 补专项测试：`惊心动魄`、`无情劫掠`、`做好标记` 等已暴露过问题的链路持续通过。

## 4. 规范与文档
- [x] 4.1 更新 DiceThrone 专项规范，明确“主伤害单次落地”与“攻击后续选择不得重放主伤害”的不变量。
- [x] 4.2 更新文档索引入口，要求后续修改 DiceThrone 共享攻击流前先读专项规范。
