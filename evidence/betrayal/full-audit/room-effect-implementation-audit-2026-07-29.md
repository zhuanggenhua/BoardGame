# 小黑屋房间效果实现审计（2026-07-29）

> 2026-07-29 接续边界：本文件是房间效果的下游实现消费索引，只消费当前房间配置、只读代码/测试和 `object-l0-l4-matrix.md` 中的房间证据；它不是发现牌整牌库 S0 主合同，不能替代 74 张事件/物品/预兆对象全集，也不能授权 Board/UI、E2E、截图或“整牌库完成”宣称。后续引用本文件时，必须同时保留 `room-effect-matrix-indexed / downstream-open` 口径。

## 审计范围

本文件只审 `src/games/betrayal` 当前 42 个房间中的显式房间效果，不审房间 atlas、美术裁图、门位结构或无显式效果房间的视觉呈现。当前命中 11 个带效果房间：礼拜堂、火炉房、器械库、书房、图书馆、倒塌房间、体育馆、神秘电梯、洗衣滑槽、储物间、杂物间。

## 结论等级

结论等级：`room-effect-matrix-indexed / downstream-open`。

含义：房间效果对象全集已从当前运行配置锁定，领域和部分页面代表链存在；但仍不能宣称 42 个房间效果实现全部完成。带效果房间必须继续逐项补触发时机、目标、结算、清理、负向断言和玩家可见结果。

## 权威来源

| 类型 | 当前来源 |
| --- | --- |
| 对象全集 | `evidence/betrayal/full-audit/object-inventory.json` |
| 运行配置 | `src/games/betrayal/scenarioConfig.ts` 的 `discoveryEffect`、`endTurnEffect`、`enterEffect` |
| 领域消费 | `src/games/betrayal/game.ts` 的房间发现、回合结束和神秘电梯消费链 |
| 页面承接 | `src/games/betrayal/Board.tsx` 的房间效果提示、探索放置、神秘电梯和回合结束 UI |
| 测试证据 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts`、`src/games/betrayal/__tests__/Board.foundation.test.tsx` |
| 总矩阵 | `evidence/betrayal/full-audit/object-l0-l4-matrix.md` |

## 逐项结论

| 房间 | 触发 | 当前实现消费 | 当前证据等级 | 残余范围 |
| --- | --- | --- | --- | --- |
| 礼拜堂 | 发现时神志 +1 | `discoveryEffect: gainSanity1`，发现后走属性轨道提升，发现确认队列会列出房间效果 | `min-domain-verified / Board discovery queue representative / partial-ui` | 真实 Playwright / 截图、重复发现负向断言、属性上限和日志/UI 文案归属仍未闭合。 |
| 书房 | 发现时知识 +1 | `discoveryEffect: gainKnowledge1`，与图书馆同消费者；已有独立知识提升领域断言 | `min-domain-verified / Board discovery queue representative / partial-ui` | 真实 Playwright / 截图、重复发现负向断言、属性上限和书房/图书馆 UI 文案归属仍未闭合。 |
| 图书馆 | 发现时知识 +1 | `discoveryEffect: gainKnowledge1`，与书房同消费者；已有独立知识提升领域断言 | `min-domain-verified / Board discovery queue representative / partial-ui` | 真实 Playwright / 截图、重复发现负向断言、属性上限和书房/图书馆 UI 文案归属仍未闭合。 |
| 体育馆 | 发现时速度 +1 | `discoveryEffect: gainSpeed1`，已有速度提升领域断言，发现确认队列会列出房间效果 | `min-domain-verified / Board discovery queue representative / partial-ui` | 真实 Playwright / 截图、重复发现负向断言、属性上限和速度重复数值格展示仍未闭合。 |
| 储物间 | 发现时力量 +1 | `discoveryEffect: gainMight1`，已有力量提升领域断言，发现确认队列会列出房间效果 | `min-domain-verified / Board discovery queue representative / partial-ui` | 真实 Playwright / 截图、重复发现负向断言、属性上限和日志/UI 文案仍未闭合。 |
| 器械库 | 发现时抽到武器为止 | `discoveryEffect: drawUntilWeapon`，发现后抽武器并进持有区；已有真实页面发现结果和持有区代表链 | `L3 representative / partial-combo` | 物品牌堆耗尽、非武器跳过/归位、抽到多武器后的交易/使用限制组合仍未闭合。 |
| 杂物间 | 发现时放障碍标记，离开成本 +2 | `discoveryEffect: placeObstacleToken`，已有障碍标记领域断言，发现确认队列会列出房间效果 | `min-domain-verified / Board discovery queue representative / partial-ui` | 真实 Playwright / 截图、障碍 token 持久化/清理、不同移动来源和怪物/作祟移动边界仍未闭合。 |
| 火炉房 | 回合结束造成 1 点物理伤害 | `endTurnEffect: physicalDamage1`，回合结束进入伤害分配链；Board 已显示结束回合提示和伤害分配页；作祟叛徒可忽略伤害性房间效果 | `min-domain-verified / Board component representative / partial-ui` | 真实 Playwright / 截图、盔甲/奇异护符/胸针/头骨/死亡保护和更多作祟伤害组合仍未闭合。 |
| 倒塌房间 | 回合结束速度检定，失败坠落地下室并受伤 | `endTurnEffect: speedCheckFallToBasement`，写入房间回合末 recentRoll 和后续坠落伤害；已有成功不坠落、失败坠落、兔脚、幸运硬币、狗/面具加值和作祟叛徒坠落免伤领域链；Board 已覆盖提示、投骰阻塞和伤害分配 | `combo-domain-verified / Board component representative / partial-ui` | 真实 Playwright / 截图、死亡保护、天使之羽和更多重掷/加值组合仍未闭合。 |
| 洗衣滑槽 | 回合结束移动到地下室起始点 | `endTurnEffect: moveToBasementLanding`，已有结束回合移动领域断言；Board 已覆盖结束回合提示和结算反馈；作祟叛徒仍必须结算 | `min-domain-verified / Board component representative / partial-ui` | 真实 Playwright / 截图、楼层切换 UI、重复触发和特殊回合组合仍未闭合。 |
| 神秘电梯 | 进入后投骰并移动电梯到允许楼层未探索房间 | `enterEffect: mysticElevator`，按 2 颗骰结果选可用楼层和目的地；Board 已覆盖按钮、执行和已用禁用原因；领域链覆盖按骰点移动、一回合一次、兔脚重掷和作祟后叛徒可用 | `combo-domain-verified / Board component representative / partial-ui` | 真实 Playwright / 截图、全部骰值楼层分支、无目的地分支和移动后门位/朝向可见状态仍未闭合。 |

## 验证证据

| 检查 | 结果 |
| --- | --- |
| 房间效果全集提取 | 已从 `object-inventory.json` 提取 11 个带效果房间；无显式效果房间不在本专项矩阵内。 |
| 实现入口搜索 | 已定位 `scenarioConfig.ts` 配置、`game.ts` 消费链、`Board.tsx` 提示/入口、领域和组件测试引用。 |
| 领域代表链 | `firstScenarioRuntime.test.ts` 已有 11 个带效果房间的属性提升、抽武器、障碍、结束回合伤害/移动、倒塌房间坠落和神秘电梯代表链；作祟期叛徒忽略/必须结算边界也有代表链。 |
| Board 组件代表链 | `Board.foundation.test.tsx` 已有发现确认队列、火炉房结束回合提示和伤害分配、洗衣滑槽提示和反馈、倒塌房间投骰/伤害分配、神秘电梯按钮/已用禁用原因代表链。 |
| 机器矩阵同步 | 已重新生成 `object-l0-l4-matrix.md`，带效果房间均标为“房间效果需独立审计”。 |
| 文档自检 | 已运行 `npm run audit:evidence:selfcheck -- evidence/betrayal/full-audit/room-effect-implementation-audit-2026-07-29.md`；结果 OK。 |

## 共享根因与残余范围

共享根因：旧矩阵把“房间结构已锁 / 代表链存在”与“房间效果逐项完成”放在同一行，容易把房间 atlas、楼层、门位或单一代表截图误读成 42 个房间规则都完成。

残余范围：

- 属性加点房间已补多属性领域链和发现确认队列代表链；仍需真实 Playwright / 截图、重复发现负向断言、属性上限和日志/UI 文案归属。
- 抽牌/障碍房间已补器械库真实页面代表链和杂物间障碍领域/队列代表链；仍需牌堆耗尽、非武器跳过/归位、token 持久化/清理、不同移动来源和怪物/作祟移动边界。
- 回合结束房间已补火炉房、倒塌房间、洗衣滑槽领域/Board 代表链；仍需真实 Playwright / 截图、死亡保护、天使之羽和更多重掷/替换/加值组合。
- 神秘电梯已补领域/Board 代表链；仍需真实 Playwright / 截图、全部骰值楼层分支、无目的地分支和移动后门位/朝向可见状态。

## 修订记录

| 项 | 结论 |
| --- | --- |
| 旧矩阵风险 | `object-l0-l4-matrix.md` 原先多处写“family 判等 / L2 已覆盖”，容易被误读为房间效果完成。 |
| 本轮修订 | 生成器已把带效果房间统一标成“房间效果需独立审计”；本文件新增 11 个房间效果专项矩阵，并在当前续跑中补回已有领域/Board 代表链，避免把旧“需补完整链”误读成完全未实现。 |
| 当前状态 | `downstream-open`，不是完成。 |
