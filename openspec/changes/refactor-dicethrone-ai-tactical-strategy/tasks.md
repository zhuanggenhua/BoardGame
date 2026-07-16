## 1. Preflight
- [ ] 1.1 审计当前 `src/games/dicethrone/ai.ts` 中合法动作生成、骰面计划、响应窗口、scorer、profile 与 `projectDiceThroneAction` 调用边界。
- [ ] 1.2 对照 `refactor-dicethrone-roll-context-unification` 与 `refactor-dicethrone-extra-dice-unification`，列出本轮可完整覆盖和必须保守降级的骰子上下文。
- [ ] 1.3 记录现有 DiceThrone AI 代表性测试入口，作为重构前后对照基线。

## 2. Module Split
- [ ] 2.1 新增 DiceThrone AI 子目录，将 `legalActions`、`dicePlanning`、`evaluation`、`projection`、`search`、`profiles`、`scorers` 拆为深 Module。
- [ ] 2.2 保持 `src/games/dicethrone/ai.ts` 作为 `GameAiRuntime` 适配层，继续导出既有 public 函数。
- [ ] 2.3 保持所有候选动作仍来自 `AiDecisionContext.legalActions` 与正式命令校验，不新增 AI 专用命令协议。

## 3. Board Evaluation
- [ ] 3.1 新增 `evaluateDiceThroneBoardState()`，返回总分与结构化 breakdown。
- [ ] 3.2 覆盖生命安全、伤害竞速、资源经济、升级引擎、状态/token、骰面计划和阶段节奏。
- [ ] 3.3 将现有分散 scorer 中可共享的价值判断迁移到统一评估 helper，保留必要的动作类型基础偏好。
- [ ] 3.4 补局面价值函数单测，覆盖低血线防守、斩杀窗口、资源不足、升级收益、状态/token 清理和骰面命中率。

## 4. Response Value Gate
- [ ] 4.1 为响应窗口新增“可阻止实际收益”评估，显式比较改骰/防御/跳过的机会成本。
- [ ] 4.2 覆盖用户指出的原始症状：真人投出普攻或低价值攻击时，AI 不应稳定花改骰牌。
- [ ] 4.3 覆盖关键反例：真人投出大招、斩杀、高伤害、强状态或强资源技能时，AI 必须优先考虑有效响应。
- [ ] 4.4 将响应收益、阻止目标、机会成本和降级原因写入 AI trace。

## 5. Action Delta Projection
- [ ] 5.1 将可安全模拟的 `projectDiceThroneAction` 改为当前局面价值与动作后局面价值的差值。
- [ ] 5.2 对无法安全模拟的交互、额外骰、未知 custom action 保留 scorer/fallback，不制造非法或不可复现投影。
- [ ] 5.3 将投影分数、局面差值 breakdown、响应收益门槛和降级原因写入 trace。
- [ ] 5.4 补动作后差值测试，证明同一改骰牌在普攻和关键技能下评分反转。

## 6. In-Phase Tactical Search
- [ ] 6.1 新增阶段内短线搜索，深度默认 2，允许 hard/expert 在预算内扩到 3。
- [ ] 6.2 掷骰阶段覆盖锁骰 -> 改骰牌/被动重掷 -> 重投/确认 -> 选技能。
- [ ] 6.3 主阶段覆盖卖牌 -> 解锁出牌/升级 -> 后续动作收益。
- [ ] 6.4 响应窗口覆盖防御牌/token/改骰干扰 -> 伤害或技能收益变化 -> 是否跳过。
- [ ] 6.5 每步执行后重新生成合法动作，禁止复用旧状态候选。
- [ ] 6.6 将序列最佳路径、累计收益、剪枝和降级原因写入 trace。

## 7. Hero Strategy Profiles
- [ ] 7.1 扩展 DiceThrone 英雄 AI profile 数据结构，覆盖爆发、续航、防御、token、升级、改骰和响应依赖。
- [ ] 7.2 为首批已完成英雄配置策略权重，并保留默认平衡 profile。
- [ ] 7.3 将 profile 接入局面价值函数、响应门槛和动作/序列评分。
- [ ] 7.4 补 profile 差异测试，验证同局势下不同英雄能产生可解释排序差异。

## 8. Prediction Boundary
- [ ] 8.1 明确 AI 预测只基于当前公开状态、`playerView` 和自身合法动作投影。
- [ ] 8.2 禁止读取真人隐藏手牌、真实牌堆顺序或把真人未来主观选择当作确定事实。
- [ ] 8.3 对缺少统一掷骰上下文的额外骰链路记录保守降级，不冒充完整预测。

## 9. Regression
- [ ] 9.1 运行 DiceThrone AI 定向 Vitest。
- [ ] 9.2 运行 DiceThrone 响应窗口、奖励骰、主阶段候选和基础命令代表性测试。
- [ ] 9.3 运行 `npx eslint` 覆盖本次修改的 `.ts` 文件。
- [ ] 9.4 大范围重构后运行 `npx tsc --noEmit --pretty false --skipLibCheck`。
- [ ] 9.5 在收口说明中明确 MCTS、远程大模型实时落子、神经网络/强化学习未实施。

## 10. Explicitly Deferred
- [ ] 10.1 完整 MCTS 本轮明确跳过，后续如实施需单独 proposal。
- [ ] 10.2 远程大模型实时落子本轮明确跳过。
- [ ] 10.3 神经网络/强化学习训练本轮明确跳过。
- [ ] 10.4 统一掷骰上下文本体仍由既有 roll-context / extra-dice proposals 承接，本轮只做 AI 兼容边界。
