## 1. Audit
- [x] 1.1 盘点所有游戏的准备阶段 AI 选择动作，确认只有 DiceThrone / SmashUp / Summoner Wars 需要本轮改造。
- [x] 1.2 标记现有固定优先级、纯随机、固定断言测试的位置。

## 2. Strategy Profiles
- [x] 2.1 为 SmashUp 建立派系组合 profile 与 pair 协同评分。
- [x] 2.2 将 Summoner Wars 改为基于 `selectable` 阵营池的无倾向随机选择。
- [x] 2.3 将 DiceThrone 改为基于已完成角色池的无倾向随机选择。

## 3. Implementation
- [x] 3.1 重构 SmashUp setup faction scorer，移除固定优先级主导。
- [x] 3.2 重构 Summoner Wars setup faction scorer，移除固定优先级和阵营打法倾向。
- [x] 3.3 重构 DiceThrone setup character scorer，移除角色风格、对手和队友倾向。
- [x] 3.4 确保 trace/reasoningSummary 能说明单选随机或 SmashUp 组合依据。

## 4. Tests
- [x] 4.1 更新 SmashUp 选派系测试，覆盖分布与组合解释。
- [x] 4.2 更新 Summoner Wars 选派系测试，覆盖可选池与无倾向随机分布。
- [x] 4.3 更新 DiceThrone 选角测试，覆盖已完成角色池与无倾向随机分布。
- [x] 4.4 移除或改写固定“必选某角色/派系”的旧断言。

## 5. Verification
- [x] 5.1 运行相关 Vitest 单文件/目标用例。
- [x] 5.2 运行 OpenSpec strict validate。
- [x] 5.3 汇总外部资料依据、改动范围和残余风险。
