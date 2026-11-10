# Dice Throne 全量失败跟踪（2026-11-05）

命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 --reporter=dot`。退出码 1：193 文件中 15 失败，31 项失败、2928 项通过、1 项跳过。原始输出保留在 `.tmp/thor-dicethrone-full-20261105.log`。

以下是该次失败项的逐条状态；未完成对照的事项不称基线或已修复。

1. `src/games/dicethrone/__tests__/active-modifiers-undo.test.ts > 攻击修正指示器撤回测试 > RightSidebar 在 selectDie 交互中应根据 diceOwnerId 显示队友骰池提示` — 待核实：用例仍向 RightSidebar 传旧 interaction 属性，当前组件消费 diceInteraction 合同；需以正式调用及真实交互确认行为，不能只改断言。
2. `src/games/dicethrone/__tests__/active-modifiers-undo.test.ts > 攻击修正指示器撤回测试 > 反馈 6a3a97e8 的 any 改骰交互快照应能正常渲染右侧骰区` — 待核实：用例仍向 RightSidebar 传旧 interaction 属性，当前组件消费 diceInteraction 合同；需以正式调用及真实交互确认行为，不能只改断言。
3. `src/games/dicethrone/__tests__/active-modifiers-undo.test.ts > 攻击修正指示器撤回测试 > 反馈 6a3cb53f 的对手重掷交互快照缺少 initialResult 时也不应渲染崩溃` — 待核实：用例仍向 RightSidebar 传旧 interaction 属性，当前组件消费 diceInteraction 合同；需以正式调用及真实交互确认行为，不能只改断言。
4. `src/games/dicethrone/__tests__/active-modifiers-undo.test.ts > 攻击修正指示器撤回测试 > 改骰提示框应按内容撑高，不应被固定高度或裁剪样式截断` — 待核实：用例仍向 RightSidebar 传旧 interaction 属性，当前组件消费 diceInteraction 合同；需以正式调用及真实交互确认行为，不能只改断言。
5. `src/games/dicethrone/__tests__/artificer-mechanics.test.ts > DiceThrone 工匠 L2 核心机制 > 扳手攻击 II 在正式命令链中可由升级后玩家板能力进入电能分支并推进到 defensiveRoll` — 待核实：须对照对应生产调用、规则和运行前版本，尚不能认定本轮回归或历史基线。
6. `src/games/dicethrone/__tests__/artificer-mechanics.test.ts > DiceThrone 工匠 L2 核心机制 > 真本能量的机器人激活链会二次请求且第二次不能重复选择同一机器人` — 待核实：须对照对应生产调用、规则和运行前版本，尚不能认定本轮回归或历史基线。
7. `src/games/dicethrone/__tests__/artificer-mechanics.test.ts > DiceThrone 工匠 L2 核心机制 > 单次机器人激活窗口也应允许跳过，并在跳过后继续伤害前链路` — 待核实：须对照对应生产调用、规则和运行前版本，尚不能认定本轮回归或历史基线。
8. `src/games/dicethrone/__tests__/artificer-mechanics.test.ts > DiceThrone 工匠 L2 核心机制 > 治疗机器人通过正式响应命令掷骰后，需普通确认右侧奖励骰盘再治疗并释放攻击流程` — 待核实：须对照对应生产调用、规则和运行前版本，尚不能认定本轮回归或历史基线。
9. `src/games/dicethrone/__tests__/artificer-mechanics.test.ts > DiceThrone 工匠 L2 核心机制 > 伤害前机器人选择生成后应暂停攻击结算并保留 pendingAttack` — 待核实：须对照对应生产调用、规则和运行前版本，尚不能认定本轮回归或历史基线。
10. `src/games/dicethrone/__tests__/configReviewAdapter.test.ts > DiceThrone configReviewAdapter > 工匠 0CP 电弧盾在配置表中识别为响应型升级牌，不当作普通免费技能升级` — 待核实：须对照对应生产调用、规则和运行前版本，尚不能认定本轮回归或历史基线。
11. `src/games/dicethrone/__tests__/cross-hero.test.ts > cross hero battles > gunslinger vs monk > duel win creates choice and prevent-half branch works` — 待核实：须对照对应生产调用、规则和运行前版本，尚不能认定本轮回归或历史基线。
12. `src/games/dicethrone/__tests__/customaction-category-consistency.test.ts > CustomAction categories 与 handler 输出一致性审计 > categories 声明 damage 的 handler 应当产生 DAMAGE_DEALT（反向检查）` — 待核实：须对照对应生产调用、规则和运行前版本，尚不能认定本轮回归或历史基线。
13. `src/games/dicethrone/__tests__/flow.test.ts > 王权骰铸流程测试 > 基础测试 > '初始设置：体力/CP/手牌数量'` — 已复跑通过：测试工具按目录实际选择奇异博士作为第二角色，其牌库与武僧不同；更新为该角色起始牌库后两项通过。
14. `src/games/dicethrone/__tests__/flow.test.ts > 王权骰铸流程测试 > 基础测试 > '非先手收入阶段获得1CP与1张牌'` — 已复跑通过：测试工具按目录实际选择奇异博士作为第二角色，其牌库与武僧不同；更新为该角色起始牌库后两项通过。
15. `src/games/dicethrone/__tests__/monk-coverage.test.ts > Monk 技能完整覆盖测试 > 禅忘 (zen-forget) - 二选一分支 > 触发禅忘二选一后应关闭当前提示并标记前置选择已完成` — 待核实：须对照对应生产调用、规则和运行前版本，尚不能认定本轮回归或历史基线。
16. `src/games/dicethrone/__tests__/monk-coverage.test.ts > Monk 技能完整覆盖测试 > 清修 (meditation) - 防御骰组合 > 防御骰=0太极+4拳: 获得0太极+对攻击方造成4伤害` — 待核实：须对照对应生产调用、规则和运行前版本，尚不能认定本轮回归或历史基线。
17. `src/games/dicethrone/__tests__/monk-coverage.test.ts > Monk 技能完整覆盖测试 > 基础技能变体覆盖 > 雷霆一击: 3掌投掷3骰造成总和伤害` — 待核实：须对照对应生产调用、规则和运行前版本，尚不能认定本轮回归或历史基线。
18. `src/games/dicethrone/__tests__/monk-coverage.test.ts > Monk 技能完整覆盖测试 > 端到端完整对局 > 三回合对局:验证回合3-4流程(含Token响应)` — 待核实：须对照对应生产调用、规则和运行前版本，尚不能认定本轮回归或历史基线。
19. `src/games/dicethrone/__tests__/monk-coverage.test.ts > Monk 技能完整覆盖测试 > 端到端完整对局 > 多回合对局:双方互相攻击(含Token响应窗口处理)` — 待核实：须对照对应生产调用、规则和运行前版本，尚不能认定本轮回归或历史基线。
20. `src/games/dicethrone/__tests__/paladin-tokens.test.ts > 圣骑士 Token 定义 > 确认骰面窗口拒绝受伤响应牌，且“下次一定”过了投掷阶段后不可使用` — 待核实：须对照对应生产调用、规则和运行前版本，尚不能认定本轮回归或历史基线。
21. `src/games/dicethrone/__tests__/rule-consistency.test.ts > Property 9: 4 人玩家目标交互验证 > 无默认 defender 的 4 人无伤害技能仍会执行 preDefense 交互效果` — 待核实：须对照对应生产调用、规则和运行前版本，尚不能认定本轮回归或历史基线。
22. `src/games/dicethrone/__tests__/tianshi-behavior.test.ts > 炽天使领域行为 > 圣洁光辉获得飞行后须在对手防御前保留进攻阶段使用机会` — 待核实：须对照对应生产调用、规则和运行前版本，尚不能认定本轮回归或历史基线。
23. `src/games/dicethrone/__tests__/tianshi-behavior.test.ts > 炽天使领域行为 > 圣洁光辉选定后不应自动跳过进攻阶段，显式推进后进入防御并结算伤害` — 待核实：须对照对应生产调用、规则和运行前版本，尚不能认定本轮回归或历史基线。
24. `src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts > DiceThrone Treant 能力与卡牌合同 > Rooted 防御投出两树叶时应选择养成 1 树灵后再结算伤害` — 待核实：防御伤害或交互续接不符；不得仅凭测试文件未变归类为基线，须检查真实命令链与共享续接。
25. `src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts > DiceThrone Treant 能力与卡牌合同 > Rooted II 防御应掷 4 骰，并在两树灵时选择 1 名玩家获得生命源泉` — 待核实：防御伤害或交互续接不符；不得仅凭测试文件未变归类为基线，须检查真实命令链与共享续接。
26. `src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts > DiceThrone Treant 能力与卡牌合同 > Rooted II 同时投出双树叶与双树灵时应同时处理养成和生命源泉目标` — 待核实：防御伤害或交互续接不符；不得仅凭测试文件未变归类为基线，须检查真实命令链与共享续接。
27. `src/games/dicethrone/__tests__/tutorial-practices.test.ts > 骰铸教程只保留无法自然进入主线的机制练习 > 目录只有连续主线和自然起手无法触发的手牌上限练习` — 待核实：须对照对应生产调用、规则和运行前版本，尚不能认定本轮回归或历史基线。
28. `src/games/dicethrone/__tests__/tutorial-practices.test.ts > 骰铸教程只保留无法自然进入主线的机制练习 > 超限出售、CP 上限、牌库耗尽后收入重洗抽牌` — 待核实：须对照对应生产调用、规则和运行前版本，尚不能认定本轮回归或历史基线。
29. `src/games/dicethrone/__tests__/vampire-lord-mechanics.test.ts > DiceThrone 吸血鬼领主机制实现矩阵 > 血色杀戮按图面从抽牌堆任选 1 张牌、洗混剩余牌库、获得 2 鲜血之力并造成 10 攻击伤害` — 待核实：须对照对应生产调用、规则和运行前版本，尚不能认定本轮回归或历史基线。
30. `src/games/dicethrone/domain/__tests__/damage-pipeline-migration.test.ts > 伤害计算管线迁移 > 正式事件输出合同 > DiceThrone 生产伤害路径不得裸调用 toEvents 丢失副作用事件` — 已修复并复跑：补充伤害传播完整事件列表；damage-pipeline、奇异博士实际追加伤害、Thor、伤害原语共 141 项通过。
31. `src/games/dicethrone/ui/__tests__/compatLayout.test.tsx > DiceThrone compatibility sizing > 牌池选择时为手牌预留底部安全余量，保持卡牌完整落在视口内` — 待核实：须对照对应生产调用、规则和运行前版本，尚不能认定本轮回归或历史基线。
