# 正式开局 setup 与探索者配置补审（2026-08-01）

> 文档类型：规则实现补审证据
> 当前状态：active / current evidence
> 现实结论：这不是单纯“没留档”。正式开局状态来源此前没有被总账单列为必查维度，所以属于**审计维度缺失 + 留档缺失**；本文件补齐该维度，并记录本次补审发现的正式开局实现问题。

## 1. 本次补审对象

本文件只审计三个问题：

1. 正式开局 setup 是否按规则进入角色选择、起始房间、牌堆和剧本选择。
2. 当前首剧本「木乃伊横行」是否错误给探索者预发物品或预兆。
3. 运行时实际消费的探索者配置是否来自角色选择结果和当前 catalog。

本文件本身只证明正式开局会消费玩家选择的探索者配置，不单独替代逐角色数据审计。逐角色名称、卡面、能力、年龄、属性轨完整性属于角色数据专项审计；当前专项已在 `explorer-card-data-audit-2026-08-01.md` 和 `temp/betrayal-explorer-data-completion-2026-08-01.json` 中验证闭合。

## 2. 真相源

| 现实含义 | 真相源 |
| --- | --- |
| 官方 / 整理版开局规则 | `docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md`、`src/games/betrayal/rule/山屋惊魂小黑屋第三版规则汉化整理.md` |
| 正式开局共享配置 | `src/games/betrayal/scenarioConfig.ts` 的 `BETRAYAL_SHARED_PRE_HAUNT_SETUP` |
| 探索者候选配置 | `src/games/betrayal/scenarioConfig.ts` 的 `BETRAYAL_EXPLORER_CATALOG` |
| 剧本起始持有物配置 | `src/games/betrayal/scenarioConfig.ts` 的 `BETRAYAL_SCENARIO_CONFIGS['first-scenario'].startingInventoryByExplorerId` |
| 正式开始剧本的运行时链路 | `src/games/betrayal/game.ts` 的 `BetrayalDomain.setup`、`SCENARIO_STARTED`、`buildScenarioExplorers`、`scenarioInventoryForExplorer` |
| 机器回归 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 的“正式开始剧本后只从共享开局和所选角色配置装配探索者” |

## 3. 规则裁决

规则设置流程包含：选择角色、把四项属性夹子放到绿色起始值、洗混事件 / 物品 / 预兆牌堆、摆放三个起始板块、把每个探索者放在入口大厅、团队选择剧本卡，然后开始轮流行动。

规则设置流程不包含“给每名探索者开局发物品或预兆”。因此正式开局持有物采用负向不变量：**没有规则授权或剧本配置授权时，开局持有物必须为空。**

## 4. 实现链路裁决

| 审计点 | 当前裁决 | 证据 |
| --- | --- | --- |
| 进入正式开局前的状态 | 已补审通过 | `BetrayalDomain.setup()` 创建 `characterSelect`，玩家先选择并确认探索者，再确认剧本卡。 |
| 开始剧本前全员选择门禁 | 已发现问题并修复 | 本次补审前，3 个玩家只确认 2 个探索者也能开始，未选择玩家会被默认角色补上；现在 `START_SCENARIO` 要求 `core.playerIds` 中每位玩家都已选择并确认探索者。 |
| 开始剧本前全员剧本卡确认门禁 | 已补审通过 | `START_SCENARIO` 要求每位玩家都确认当前剧本卡，缺任一玩家确认时不能开始。 |
| 正式开始剧本后探索者来源 | 已补审通过 | `SCENARIO_STARTED` 调用 `buildScenarioExplorers()`；正式入口已禁止未选择玩家进入，所以探索者来自玩家选择结果。 |
| 起始房间来源 | 已补审通过 | `buildScenarioExplorers()` 使用 `BETRAYAL_SHARED_PRE_HAUNT_SETUP.explorerStartTileId`，当前为 `entrance-hall`。 |
| 牌堆数量来源 | 已补审通过 | 正式 core 的 `deckCounts` 来自 `BETRAYAL_INITIAL_DECK_COUNTS`，与共享 setup 的 9 预兆 / 22 物品 / 43 事件一致。 |
| 剧本起始背包来源 | 已补审通过 | `scenarioInventoryForExplorer()` 只读取当前剧本 `startingInventoryByExplorerId`；首剧本当前为 `{}`。 |
| 作祟骰数异常来源 | 已解释并补回归 | 如果正式配置里预发预兆，作祟骰数会按全员预兆总数被抬高；当前首剧本正式起始背包为空，第一次预兆检定只按新抽预兆计数。 |
| 测试 / 代表态边界 | 已补审口径 | `createBetrayalFoundationCore`、helper 手动塞牌、作祟 ready core 只能作为测试夹具，不能代表正式开局规则。 |

## 5. 探索者配置裁决

| 范围 | 当前裁决 | 现实含义 |
| --- | --- | --- |
| 当前运行时候选探索者 | 已确认被正式 setup 消费 | 当前 `BETRAYAL_EXPLORER_CATALOG` 已改为 12 名基础版正式角色；正式开始剧本会按玩家选择结果装配探索者。 |
| 角色属性是否会在开局写入 | 已确认消费 | `createExplorer()` 使用角色模板中的四项起始值和完整属性轨；本文件只证明 setup 消费该配置，逐角色字段裁决见探索者专项。 |
| 探索者图包 | 专项矩阵已完成并验证闭合 | `public/assets/i18n/zh-CN/betrayal/explorers/` 有 13 张探索者牌图，其中 12 张进入基础 catalog，Sara / Sera Nguyen 暂裁决为非基础扩展；专项状态文件为 `complete`。 |
| 探索者 token 图包 | 已建专项矩阵；不声明全量 token 完成 | 当前正式 token 为杰登、神父梁沃伦、米歇尔、斯蒂芬妮；其它基础角色回退头像，不能声明 12 人 token 全量完成。 |
| 角色能力 | 已裁决为无特殊能力 | 基础版角色背景不改变规则；catalog 中不再保留“大胆 / 攻击 +1”等假能力。 |

## 6. 本次补审后必须遵守的审计规则

1. 以后审计“作祟触发过快”时，不能只看作祟公式；必须同时审计正式开局是否错误预发预兆。
2. 任何初始状态字段都必须有规则来源或剧本配置来源；没有来源的开局持有物、状态、token 默认禁止。
3. 测试 helper、演示 ready core、手动构造 core 不允许当作正式开局状态证据。
4. 角色选择 setup 审计只能证明“已选择角色被消费”；未来若修改逐角色字段，必须回到 `explorer-card-data-audit-2026-08-01.md`、专项状态文件和领域 / 界面测试同步验证。
5. 新增或修改 setup 相关实现后，必须回到正式入口验证：`BetrayalDomain.setup()` → 选择探索者 → 确认剧本卡 → `START_SCENARIO`。

## 7. 回归验证入口

已新增回归测试：

- `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts`：`正式开始剧本后只从共享开局和所选角色配置装配探索者`
- `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts`：设置阶段测试覆盖“未选完探索者不能开始剧本”
- 探索者专项闭合报告：`temp/betrayal-explorer-data-completion-2026-08-01.json`
- 领域测试报告：`temp/betrayal-firstScenarioRuntime-report.json`，690/690 passed
- 界面测试报告：`temp/betrayal-Board-foundation-report.json`，180/180 passed

该测试锁定以下正式开局结果：

- 游戏进入 `preHaunt`。
- 玩家选择的 3 名基础角色被消费；未选择玩家不会再被默认角色补上。
- 未选择完全部玩家时，不能开始剧本。
- 探索者都在 `entrance-hall`。
- 三名探索者背包均为空。
- `turnStartInventoryCardIds` 为空。
- 牌堆数量匹配 9 预兆 / 22 物品 / 43 事件。
- 当前全员预兆总数为 0。
