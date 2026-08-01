# 小黑屋房间效果实现审计（2026-07-29）

> 2026-07-29 接续边界：本文件是房间效果的下游实现消费索引，只消费当前房间配置、只读代码/测试和 `object-l0-l4-matrix.md` 中的房间证据；它不是发现牌整牌库 S0 主合同，不能替代 74 张事件/物品/预兆对象全集，也不能授权 Board/UI、E2E、截图或“整牌库完成”宣称。后续引用本文件时，必须同时保留 `room-effect-matrix-indexed / downstream-open` 口径。

## 审计范围

本文件只审 `src/games/betrayal` 当前 42 个房间中的显式房间效果，不审房间 atlas、美术裁图、门位结构或无显式效果房间的视觉呈现。当前命中 11 个带效果房间：礼拜堂、火炉房、器械库、书房、图书馆、倒塌房间、体育馆、神秘电梯、洗衣滑槽、储物间、杂物间。

## 结论等级

结论等级：`room-effect-matrix-indexed / downstream-open`。

含义：房间效果对象全集已从当前运行配置锁定，11 个带显式效果房间已有领域代表链、Board 组件代表链和真实 Playwright / 截图代表链，当前补检暂无实现正确性阻塞；但仍不能宣称 42 个房间效果实现全部完成。带效果房间仍需自然整局、全部骰值 / 无目的地 / 死亡保护 / 重掷 / 特殊移动等边界组合补证。

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
| 礼拜堂 | 发现时神志 +1 | `discoveryEffect: gainSanity1`，发现后走属性轨道提升，发现确认队列会列出房间效果 | `domain + Board + Playwright representative` | 已有真实页面发现加点和确认截图；重复发现负向断言、属性上限和日志/UI 文案归属仍未闭合。 |
| 书房 | 发现时知识 +1 | `discoveryEffect: gainKnowledge1`，与图书馆同消费者；已有独立知识提升领域断言 | `domain + Board + Playwright representative` | 已有真实页面确认矩阵截图；重复发现负向断言、属性上限和书房/图书馆 UI 文案归属仍未闭合。 |
| 图书馆 | 发现时知识 +1 | `discoveryEffect: gainKnowledge1`，与书房同消费者；已有独立知识提升领域断言 | `domain + Board + Playwright representative` | 已有真实页面确认矩阵截图；重复发现负向断言、属性上限和书房/图书馆 UI 文案归属仍未闭合。 |
| 体育馆 | 发现时速度 +1 | `discoveryEffect: gainSpeed1`，已有速度提升领域断言，发现确认队列会列出房间效果 | `domain + Board + Playwright representative` | 已有真实页面确认矩阵截图；重复发现负向断言、属性上限和速度重复数值格展示仍未闭合。 |
| 储物间 | 发现时力量 +1 | `discoveryEffect: gainMight1`，已有力量提升领域断言，发现确认队列会列出房间效果 | `domain + Board + Playwright representative` | 已有真实页面确认矩阵截图；重复发现负向断言、属性上限和日志/UI 文案仍未闭合。 |
| 器械库 | 发现时抽到武器为止 | `discoveryEffect: drawUntilWeapon`，发现后抽武器并进持有区；已有真实页面发现结果和持有区代表链 | `L3 representative / partial-combo` | 物品牌堆耗尽、非武器跳过/归位、抽到多武器后的交易/使用限制组合仍未闭合。 |
| 杂物间 | 发现时放障碍标记，离开成本 +2 | `discoveryEffect: placeObstacleToken`，已有障碍标记领域断言，发现确认队列会列出房间效果 | `domain + Board + Playwright representative` | 已有真实页面障碍标记和离开扣 2 点移动截图；token 持久化/清理、不同移动来源和怪物/作祟移动边界仍未闭合。 |
| 火炉房 | 回合结束造成 1 点物理伤害 | `endTurnEffect: physicalDamage1`，回合结束进入伤害分配链；Board 已显示结束回合提示和伤害分配页；作祟叛徒可忽略伤害性房间效果 | `domain + Board + Playwright representative` | 已有真实页面结束回合伤害与结算反馈截图；盔甲/奇异护符/胸针/头骨/死亡保护和更多作祟伤害组合仍未闭合。 |
| 倒塌房间 | 回合结束速度检定，失败坠落地下室并受伤 | `endTurnEffect: speedCheckFallToBasement`，写入房间回合末 recentRoll 和后续坠落伤害；已有成功不坠落、失败坠落、兔脚、幸运硬币、狗/面具加值和作祟叛徒坠落免伤领域链；Board 已覆盖提示、投骰阻塞和伤害分配 | `combo-domain + Board + Playwright representative` | 已有桌面和移动横屏真实投骰、确认、伤害分配、坠落后回牌桌截图；死亡保护、天使之羽和更多重掷/加值组合仍未闭合。 |
| 洗衣滑槽 | 回合结束移动到地下室起始点 | `endTurnEffect: moveToBasementLanding`，已有结束回合移动领域断言；Board 已覆盖结束回合提示和结算反馈；作祟叛徒仍必须结算 | `domain + Board + Playwright representative` | 已有真实页面滑落地下室起始点和回牌桌截图；重复触发和特殊回合组合仍未闭合。 |
| 神秘电梯 | 进入后投骰并移动电梯到允许楼层未探索房间 | `enterEffect: mysticElevator`，按 2 颗骰结果选可用楼层和目的地；Board 已覆盖按钮、执行和已用禁用原因；本轮补齐“返回牌桌”后正式清理 `recentRoll` 的命令消费 | `combo-domain + Board + Playwright representative` | 已有真实页面启动、投骰、移动、回牌桌和“本回合已用”禁用状态截图；全部骰值楼层分支、无目的地分支和更多门位/朝向边界仍未闭合。 |

## 验证证据

| 检查 | 结果 |
| --- | --- |
| 房间效果全集提取 | 已从 `object-inventory.json` 提取 11 个带效果房间；无显式效果房间不在本专项矩阵内。 |
| 实现入口搜索 | 已定位 `scenarioConfig.ts` 配置、`game.ts` 消费链、`Board.tsx` 提示/入口、领域和组件测试引用。 |
| 领域代表链 | `firstScenarioRuntime.test.ts` 已有 11 个带效果房间的属性提升、抽武器、障碍、结束回合伤害/移动、倒塌房间坠落和神秘电梯代表链；作祟期叛徒忽略/必须结算边界也有代表链。 |
| Board 组件代表链 | `Board.foundation.test.tsx` 已有发现确认队列、火炉房结束回合提示和伤害分配、洗衣滑槽提示和反馈、倒塌房间投骰/伤害分配、神秘电梯按钮/已用禁用原因代表链。 |
| 本轮房间效果补检 | `firstScenarioRuntime.test.ts -t "礼拜堂\|书房\|图书馆\|体育馆\|储物间\|器械库\|杂物间\|火炉房\|倒塌房间\|洗衣滑槽\|神秘电梯\|房间效果\|障碍物"` 37 passed / 661 skipped；`Board.foundation.test.tsx -t "器械库\|礼拜堂\|倒塌房间\|神秘电梯\|火炉房\|洗衣滑槽\|房间障碍物\|结束回合房间效果\|房间效果按钮"` 8 passed / 169 skipped。Board 组件测试尾部仍有既有 `ECONNRESET` 噪声但退出码为 0。 |
| 房间真实入口代表链 | `npm run test:e2e:file -- e2e/betrayal/room-effect-representative.e2e.ts` 9 passed，覆盖礼拜堂、直接房间文字效果确认矩阵、火炉房、杂物间、密道楼梯、洗衣滑槽、倒塌房间、移动端横屏倒塌房间、神秘电梯。 |
| 神秘电梯状态清理补证 | 新增 `ACKNOWLEDGE_RECENT_ROLL` 正式确认独立房间投骰；`node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts --config vitest.config.core.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 --testTimeout 300000 --hookTimeout 300000 -t "神秘电梯"` 3 passed / 695 skipped；单条神秘电梯 E2E 1 passed。 |
| 截图保存稳定性 | `saveScreenshot` 改为先取截图 buffer，再临时文件写入并替换目标路径；用于解决覆盖既有中文证据文件时的 `UNKNOWN open ...jpg`，不改变截图内容和证据路径。 |
| 机器矩阵同步 | 已重新生成 `object-l0-l4-matrix.md`，带效果房间均标为“房间效果需独立审计”。 |
| 文档自检 | 已运行 `npm run audit:evidence:selfcheck -- evidence/betrayal/full-audit/room-effect-implementation-audit-2026-07-29.md`；结果 OK。 |

## 共享根因与残余范围

共享根因：旧矩阵把“房间结构已锁 / 代表链存在”与“房间效果逐项完成”放在同一行，容易把房间 atlas、楼层、门位或单一代表截图误读成 42 个房间规则都完成。

残余范围：

- 属性加点房间已补多属性领域链、发现确认队列和真实 Playwright / 截图代表链；仍需重复发现负向断言、属性上限和日志/UI 文案归属。
- 抽牌/障碍房间已补器械库真实页面代表链、杂物间真实障碍/移动代表链；仍需牌堆耗尽、非武器跳过/归位、token 持久化/清理、不同移动来源和怪物/作祟移动边界。
- 回合结束房间已补火炉房、倒塌房间、洗衣滑槽领域/Board/真实入口代表链；仍需死亡保护、天使之羽和更多重掷/替换/加值组合。
- 神秘电梯已补领域/Board/真实入口代表链和回牌桌状态清理；仍需全部骰值楼层分支、无目的地分支和更多门位/朝向边界。

## 修订记录

| 项 | 结论 |
| --- | --- |
| 旧矩阵风险 | `object-l0-l4-matrix.md` 原先多处写“family 判等 / L2 已覆盖”，容易被误读为房间效果完成。 |
| 本轮修订 | 生成器已把带效果房间统一标成“房间效果需独立审计”；本文件新增 11 个房间效果专项矩阵，并在当前续跑中补回已有领域/Board 代表链，避免把旧“需补完整链”误读成完全未实现。 |
| 房间显式效果 P0 补检 | 本轮复跑 11 个带效果房间的领域和 Board 代表链，未发现规则子句无法消费、玩家入口缺失或状态无法结算的实现阻塞。新结论为 `domain + Board component representative / partial-ui`，残余降级为真实 Playwright / 截图、自然整局、死亡保护 / 重掷 / 特殊移动组合等验证层级缺口。 |
| 房间真实入口代表链补证 | 本轮补齐 9 条 Playwright 房间代表链，神秘电梯新增正式 recentRoll 确认清理命令，移动端倒塌房间确认后进入伤害分配再换人；当前残余改为自然整局、全部骰值/无目的地和特殊组合，不再把“缺真实入口”列作这一组的默认阻塞。 |
| 当前状态 | `downstream-open`，不是完成。 |
