# 幻想国度官方计分引擎任务

> 说明：当前仓库里可能已经存在官方计分引擎相关的探索实现与验证记录；在 `0.1` 未完成前，它们只能算“草案对应的探索产物”，不能按正式 change 收口。

## 0. Approval Gate
- [x] 0.1 用户明确批准 `add-fantasyrealms-official-scoring-engine` 的范围与边界

## 1. Scoring domain
- [x] 1.1 新增单一官方计分求值入口，支持野牌、`Book of Changes`、`Clears`、封印/减分与 `Necromancer`
- [x] 1.2 用官方计分结果替换当前基础分预估，更新 player summary
- [x] 1.3 在双人结束态返回正式胜者/平局与分数

## 2. Board 与文档
- [x] 2.1 更新 Board 文案与展示，不再宣称“正式计分待后续 change”
- [x] 2.2 同步更新 design/evidence 文档边界

## 3. Verification
- [x] 3.1 新增或更新领域测试，覆盖 FAQ 与代表性高分组合
- [x] 3.2 更新 Board 测试，锁住正式计分展示
- [x] 3.3 运行 `openspec validate add-fantasyrealms-official-scoring-engine --strict --no-interactive`
- [x] 3.4 运行 `npx vitest run` 的 fantasyrealms 定向测试集
