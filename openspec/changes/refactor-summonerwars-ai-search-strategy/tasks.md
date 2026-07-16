## 1. Preflight
- [x] 1.1 审计当前 `src/games/summonerwars/ai.ts` 中合法动作生成、scorer、feature snapshot、assignment 与 `projectAction` 的调用边界。
- [x] 1.2 确认动作投影可使用的安全模拟路径，列出不能投影且必须保守降级的动作类型。
- [x] 1.3 记录现有召唤师战争 AI 代表性测试入口，作为重构前后对照基线。

## 2. Board Evaluation
- [x] 2.1 新增统一局面价值函数，返回总分与结构化 breakdown。
- [x] 2.2 抽离单位/卡牌价值、召唤师安全、威胁、经济、位置控制和节奏评估 helper。
- [x] 2.3 将现有分散 scorer 中可共享的价值判断迁移到统一评估 helper，保留必要的动作类型基础偏好。
- [x] 2.4 为局面价值函数补单测，覆盖防守、进攻、经济和位置控制。

## 3. Action Delta Projection
- [x] 3.1 将 `projectAction` 改为当前局面价值与动作后局面价值的差值。
- [x] 3.2 对无法安全模拟的动作保留现有 scorer/fallback，不制造非法或不可复现投影。
- [x] 3.3 将投影分数、差值 breakdown 和降级原因写入 AI trace。
- [x] 3.4 补动作后差值测试，证明移动、攻击、主动技能、召唤和不可安全投影降级在不同局势下评分符合预期。

## 4. In-Phase Sequence Search
- [x] 4.1 新增阶段内候选序列搜索，深度默认 2，允许按难度扩到 3。
- [x] 4.2 每步执行后重新生成合法动作，禁止复用旧状态候选。
- [x] 4.3 加入 shortlist、动作类型过滤、时间预算和提前停止条件。
- [x] 4.4 将序列最佳路径、累计增益与剪枝原因写入 trace。
- [x] 4.5 补安全投影序列测试，覆盖主动技能完整命令投影、移动后攻击窗口差值、召唤后续动作 trace；交互型技能/事件仍按 3.2 保守降级。

## 5. Faction Strategy Profiles
- [x] 5.1 新增召唤师战争派系 AI profile 数据结构和默认 profile。
- [x] 5.2 为亡灵、冰霜、哥布林、圣骑、蛮族、诡术配置首批策略权重。
- [x] 5.3 将派系 profile 接入局面价值函数和动作/序列评分。
- [x] 5.4 补派系差异测试，验证同局势下 profile 能产生可解释排序差异。

## 6. Regression
- [x] 6.1 运行召唤师战争 AI 定向 Vitest。
- [x] 6.2 运行召唤师战争交互链代表性测试，确认 AI 不会卡在 InteractionSystem。
- [x] 6.3 运行 `npx eslint` 覆盖本次修改的 `.ts` 文件。
- [x] 6.4 在收口说明中明确 MCTS 未实施，只保留未来扩展位。

## 7. Explicitly Deferred
- [x] 7.1 完整 MCTS 本轮明确跳过，后续如实施需单独 proposal。
- [x] 7.2 远程大模型实时落子本轮明确跳过。
- [x] 7.3 神经网络/强化学习训练本轮明确跳过。
