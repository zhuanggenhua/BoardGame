# 山屋惊魂可玩性全面重审计 Evidence（2026-07-14）

## 1. 基本信息

- 对象：山屋惊魂首剧本可玩性、haunt 阶段、圣符/作祟判定、驱魔、骰盘、物品使用、交易、事件/发现链路。
- 日期：2026-07-14
- 文档类型：`audit`
- 关联任务：用户要求“全面细致重审计重构，所有新交互端到端补完，一切以规则为准”。

## 2. 审计范围

- 本轮覆盖文件：
  - `src/games/betrayal/game.ts`
  - `src/games/betrayal/Board.tsx`
  - `src/games/betrayal/scenarioConfig.ts`
  - `src/games/betrayal/possessionEffects.ts`
  - `e2e/betrayal/*.e2e.ts`
  - `public/locales/*/game-betrayal.json`
- 本轮覆盖模块：
  - haunt 阶段探索门禁
  - 预兆《圣符》翻出后的作祟判定 UI
  - 驱魔成功/失败/死亡/终局链
  - 山屋专用骰盘与物理骰显示
  - 物品使用链
  - 交易链
  - 事件/预兆/发现阻塞链
- 明确不在本轮完成口径内：
  - 整个山屋全部扩展牌、所有官方剧本和所有素材录入全量收口，除非后续单独扩范围。

## 3. 结论等级

- 当前结论等级：`仍有残余范围`
- 判定理由：本轮已建立专项计划和端到端标准；BTR-01 haunt 阶段禁探索已补规则回归和真实页面负向 E2E，BTR-02 圣符作祟判定已补底层、Board 回归和真实页面六段 E2E，圣符探索声明已补声明、取消、重新声明、探索替换、事件结算、关闭回牌桌六段 E2E，BTR-03 房间停留效果文案与真实页面链已修正，BTR-04 驱魔失败伤害链、BTR-06 急救包物品使用链、奇怪的药品使用链和 BTR-07 交易链已补真实页面六段 E2E；狗远距交易已补“选择多张持有物 -> 切到 4 格内队友 -> 点击队友 token -> 确认 -> 结算 -> 清空回牌桌”六段链；面具移动已补“点面具本体 -> 选同板块队友 -> 选相邻房间 -> 确认 -> 队友移动结算 -> 清空回牌桌”六段链；盔甲物理减伤已补“盔甲持有可见 -> 选择未知房间 -> 电话铃声翻出 -> 物理伤害骰盘停稳 -> 减伤结算 -> 清空回牌桌”六段链；头戴耳机精神减伤已补“头戴耳机持有可见 -> 选择未知房间 -> 电话铃声翻出 -> 精神伤害骰盘停稳 -> 减伤结算 -> 清空回牌桌”六段链；手电筒/灯笼事件检定加骰已补“持有规则可见 -> 选择未知房间 -> 外星几何翻出 -> 5 骰知识检定停稳 -> 知识奖励结算 -> 清空回牌桌”双对象六段链；骨制钥匙穿墙移动已补“移动前 -> 骨制钥匙本体 -> 打开移动模式 -> 选择穿墙目标 -> 移动结算 -> 清空回牌桌”六段链；当前数据合同 23 张事件牌已逐张补齐从真实探索翻牌到关闭回牌桌的完整链，覆盖先选择属性再投检定、先投检定再选择后续效果、可选是否触发判定/作祟、自动多属性检定后选择奖励、投骰后直接结算五个时序家族；但预兆、物品全家族、骰盘全家族和最终全量自审仍未全部逐项完成 L3/L4 真实入口证据，不能写“全面审计完成”。

## 4. 权威来源

- 主真相源：当前山屋数据合同和运行时代码。
- 对照源：`docs/games/betrayal/sources/official/` 下官方规则书与剧本资料，必要时回到卡图/规则录入合同。
- 当前已锁定规则时序：
  - 蜘蛛！是先神志检定，再选择奖励属性和相邻房间。
  - 一条秘密通道是先知识检定，再选择第二个秘密通道放置房间。
  - 脑状食品是先力量检定，再按命中分支选择奖励属性或伤害属性。
  - 上古旧宅、夜幕众星是先选择属性，再投检定。
  - 大宅饿了是可选作祟家族；跳过作祟前必须先选择奖励属性，跳过后结算所选属性 +1，且不应出现作祟骰盘。
  - 外星几何是牌翻出后自动知识检定，再直接显示属性变化结算结果。
  - 电话铃声、嘎吱的木门、小机器人是牌翻出后自动投骰并直接结算，分别覆盖伤害、移动、抽物品代表结果。
  - 直接注入 `pendingEventChoice` 只能算阶段承接，不算完整端到端。

## 5. 逐项结论矩阵

| 对象               | 规则子句 / 用户断言                                                                          | 实现入口                                                                                                                                                                                                                                                 | 命中维度       | 证据层级                      | 当前结论                                                                                                                                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| haunt 阶段探索门禁 | haunt 后不应继续探索新房间                                                                   | `src/games/betrayal/game.ts` + `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` + `e2e/betrayal/haunt-no-explore.e2e.ts`                                                                                                                      | D1/D5/D8/D15   | L3 真实负向 E2E               | 已收口 BTR-01：haunt 阶段牌桌不暴露探索新房间入口，强制探索命令被规则拒绝                                                                                                                                                              |
| 圣符作祟判定       | 翻出预兆《圣符》后应立刻进行作祟检定并显示骰盘                                               | `src/games/betrayal/game.ts` + `src/games/betrayal/Board.tsx` + `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` + `src/games/betrayal/__tests__/Board.foundation.test.tsx` + `e2e/betrayal/holy-symbol-haunt-roll.e2e.ts`                    | D1/D5/D8/D55   | L3 真实六段 E2E               | 已收口 BTR-02：真实页面从探索前到圣符翻出、作祟骰盘、结果、关闭回牌桌均有截图和断言                                                                                                                                                    |
| “结算房间”文案     | 规则动作应是结束回合；房间停留效果只作为结束回合时处理的提示，不得把“结算房间”外露成玩家动作 | `public/locales/*/game-betrayal.json` + `Board.foundation.test.tsx` + `room-effect-representative.e2e.ts`                                                                                                                                                | D1/D15/D34     | L3                            | 已修正：按钮回到“结束回合”，真实页面火炉房链通过                                                                                                                                                                                       |
| 驱魔失败死亡       | 失败、伤害、死亡、终局时序必须符合剧本                                                       | `src/games/betrayal/game.ts` + `src/games/betrayal/Board.tsx` + `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` + `e2e/betrayal/first-scenario-exorcism-failure.e2e.ts`                                                                      | D1/D8/D12/D39  | L3 真实六段 E2E               | 已收口 BTR-04：真实页面从驱魔前、选择杰克之灵房间、失败骰盘、伤害结果、关闭前、关闭后回牌桌均有截图和断言；领域层同时证明 1 点身体伤害与死亡边界                                                                                       |
| 山屋骰盘           | 0/1/2 规则骰，开放式物理骰盘，不重叠                                                         | `src/games/betrayal/Board.tsx` + `src/lib/dice-box-threejs/engine.ts` + `src/lib/dice-physics/DiceBoxPhysicsSource.tsx` + `e2e/betrayal/betrayalTestHelpers.ts` + `e2e/betrayal/non-p0-representative.e2e.ts` + `e2e/betrayal/rabbit-foot-reroll.e2e.ts` | D5/D15/D34/D48 | L3 多代表链通过，整体仍有残余 | 已收口 BTR-05 代表链：普通投骰事件和砍刀攻击链均证明开放式透明物理骰盘、专用 0/1/2 骰面、多骰不重叠；兔脚重掷链证明玩家可点兔脚本体并直接点真实骰子高亮完成重掷、更新结果和收口；但骰盘全家族仍需逐项登记，不能写山屋全面完成          |
| 物品使用           | 真实物品本体可点，选择/结算/清理完整                                                         | `src/games/betrayal/Board.tsx` + `src/games/betrayal/testing/firstScenarioTestUtils.ts` + `e2e/betrayal/betrayalTestHelpers.ts` + `e2e/betrayal/first-scenario-use-possession.e2e.ts` + `public/locales/*/game-betrayal.json`                            | D1/D5/D7/D8    | L3 真实六段 E2E               | 已收口 BTR-06：真实页面从急救包本体、地图队友 token、治疗结算到状态清空回牌桌均有截图和断言；结算后治疗选择器清空，急救包从当前持有区消失                                                                                              |
| 交易               | 对象 + 目标 + 确认完整链，不能默认代点；结算后必须清空临时选择并回到可操作牌桌               | `src/games/betrayal/Board.tsx` + `e2e/betrayal/first-scenario-trade-interaction.e2e.ts`                                                                                                                                                                  | D5/D7/D8/D51   | L3 真实六段 E2E               | 已收口 BTR-07：同房间交易和狗 4 格远距交易均有真实页面六段链；狗链证明可选多张持有物、切换到 4 格内队友、点击地图队友 token、确认交易、物品转移、狗标记已用、清空状态回牌桌 |
| 事件牌完整链路     | 翻牌、选择/投骰前、选择/投骰后、结算、关闭                                                   | `event-choice-coverage.e2e.ts`                                                                                                                                                                                                                           | D5/D8/D15      | L3 23/23                      | 当前数据合同 23 张事件牌已逐张补齐真实六段链：上古旧宅、夜幕众星、蜘蛛！、一条秘密通道、脑状食品、肉质苔癣、一瓶微尘、大宅饿了、说“茄子”！、一抹鲜红、吊死鬼，以及 12 张投骰后直接结算事件牌。该结论只覆盖事件牌，不外推为山屋整体完成 |

### 5.1 预兆全家族矩阵

当前预兆数据合同来自 `BETRAYAL_DISCOVERY_POOLS.possessions.omen`，共 9 张。矩阵作用是防止把圣符、狗、头骨或雕像的代表证据外推成预兆全家族完成。

| 预兆 | 规则效果 / 交互点                                                   | 当前证据层级            | 当前结论                                               |
| ---- | ------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------ |
| 书本 | 知识检定被动 +1；可花费神志把下一次非战斗检定改用知识               | L1/L2                   | 持有区和正式预兆牌面已有基础证据；缺真实页面使用六段链 |
| 狗   | 速度检定被动 +1；可用于 4 格内远距交易                              | L3 六段链               | 已收口本对象：可选多张持有物、切到 4 格内队友、点击地图队友 token、确认交易、急救包/地图转移、狗标记已用并清空回牌桌 |
| 面具 | 速度检定被动 +1；移动同板块其他角色到相邻板块                       | L3 六段链               | 已收口本对象：可点面具本体，选择同板块队友，再选择相邻房间确认移动，结算后队友离开原房间，面具选择器和高亮清空回牌桌 |
| 头骨 | 知识检定被动 +1；死亡时投 3 骰，4+ 阻止死亡                         | L3 代表链               | 已有死亡保护代表链；仍需补未阻止死亡分支和六段收口     |
| 圣符 | 神志检定被动 +1；预兆翻出后立即作祟判定；探索声明可埋葬第一张发现板块并继续发现下一张 | L3 翻出作祟六段链 + L3 探索声明六段链 | 圣符翻出到作祟判定已收口；探索声明链已单列收口：声明、取消、重新声明、探索替换房间、事件结算、关闭回牌桌均有真实页面截图和断言 |
| 盔甲 | 受到物理伤害时减 1                                                  | L3 六段链               | 已收口本对象：真实持有区显示盔甲规则，电话铃声翻出后命中两骰物理伤害分支，伤害骰为 4 点时实际只扣 3 点身体属性，关闭后回到牌桌 |
| 雕像 | 力量检定被动 +1；探索声明可跳过事件                                 | L3 代表链不足六段       | 已有选择声明/跳过事件代表截图；缺六段完整链            |
| 指环 | 神志检定被动 +1；可用神志攻击并造成精神伤害                         | L1/L2                   | 有攻击配置；缺真实页面指环攻击链                       |
| 匕首 | 攻击多 2 骰并花费 1 速度                                            | L1/L2                   | 有攻击配置；缺真实页面匕首攻击链                       |

### 5.2 物品全家族矩阵

当前物品数据合同来自 `BETRAYAL_DISCOVERY_POOLS.possessions.item`，共 11 个条目。`地图 / 笔记本 / 日记 / 手稿`共享“放置探索者到已发现房间”效果，`手电筒 / 灯笼`共享事件检定加骰效果。急救包、奇怪的药品、兔脚、头戴耳机、手电筒/灯笼和骨制钥匙链只证明各自链路，不能证明全家族完成。

| 物品                        | 规则效果 / 交互点                            | 当前证据层级                   | 当前结论                                                                                                                                             |
| --------------------------- | -------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 魔法相机                    | 知识检定可由神志替代；可参与部分作祟归属     | L3 抽到物品链 + L1/L2 效果入口 | 说“茄子”！链证明抽到魔法相机；相机自身效果未完整跑通                                                                                                 |
| 急救包                      | 埋葬后治疗自己或同房间队友的属性             | L3 六段链                      | 已收口本对象：本体、地图队友 token、治疗结算、清空状态                                                                                               |
| 奇怪的药品                  | 埋葬后治疗自己的力量/速度                    | L3 六段链                      | 已收口本对象：本体选中、无需目标直接使用、力量/速度恢复、药品消失、清空状态回牌桌                                                                    |
| 手电筒 / 灯笼               | 事件检定额外 +2 骰                           | L3 双对象六段链                | 已收口共享效果的两个对象：真实持有区分别显示手电筒/灯笼规则，外星几何翻出后知识检定从 3 骰变 5 骰，结算知识 +1 并关闭回牌桌                         |
| 头戴耳机                    | 受到精神伤害时减 1                           | L3 六段链                      | 已收口本对象：真实持有区显示头戴耳机规则，电话铃声翻出后命中一骰精神伤害分支，伤害骰为 2 点时实际只扣 1 点精神属性，关闭后回到牌桌                |
| 地图 / 笔记本 / 日记 / 手稿 | 埋葬后把探索者放到已发现房间                 | L3 六段代表链                  | 地图已补六段链：使用前、地图本体选中、房间牌目标可选、目标已选、探索者落位、收口回牌桌；笔记本 / 日记 / 手稿仍需最终全量自审确认同源效果没有接线偏差 |
| 兔脚                        | 最近一次投骰后重掷一颗骰；也可作为普通交易物 | L3 交易链 + L3 重掷链          | 交易链已收口；重掷链已补真实页面六段：最近投骰可见、兔脚本体选中、具体骰子圆形高亮、重掷骰盘更新、结算结果可见、收口回牌桌                           |
| 骨制钥匙                    | 移动到同楼层相邻但未连门的已发现房间         | L3 六段链                      | 已收口本对象：移动前牌桌、骨制钥匙本体、打开移动模式、点击同层相邻但未连门房间、穿墙移动结算、退出移动态回牌桌                                      |
| 砍刀                        | 攻击 +1 骰                                   | L3 代表链                      | 已有攻击代表链；不外推为匕首/指环/无武器攻击完成                                                                                                     |

### 5.3 骰盘全家族矩阵

骰盘统一要求：开放式透明物理骰盘、0/1/2 山屋专用骰面、多骰不重叠、结果与玩家目标直接相连。当前通过代表链证明了实现方向，但仍要按触发家族登记覆盖范围。

| 骰盘触发家族            | 当前证据层级    | 当前结论                                                                                                     |
| ----------------------- | --------------- | ------------------------------------------------------------------------------------------------------------ |
| 事件牌检定 / 自动投骰   | L3 23/23        | 事件牌当前数据合同已逐张覆盖；纳入最终自审                                                                   |
| 可选作祟 / 可选事件投骰 | L3 多对象       | 肉质苔癣、一瓶微尘、说“茄子”！、一抹鲜红、大宅饿了等已覆盖用户点名时序                                       |
| 预兆翻出后的作祟判定    | L3 圣符         | 圣符已覆盖；其它预兆翻出作祟仍需补抽样/逐项确认                                                              |
| 房间/结束回合检定       | L3 火炉房代表链 | 速度坠落、移动类房间骰盘仍待补                                                                               |
| 攻击骰盘                | L3 砍刀代表链   | 砍刀通过；无武器、匕首、指环等攻击骰盘差异仍待补                                                             |
| 驱魔骰盘                | L3 失败链       | 失败分支已覆盖；成功分支/终局链仍待补                                                                        |
| 死亡保护骰盘            | L3 头骨代表链   | 阻止死亡已覆盖；未阻止死亡分支和六段收口仍待补                                                               |
| 兔脚重掷骰盘            | L3 六段链       | 已补真实页面链：点击兔脚本体、选择具体骰子、重掷后骰盘更新、反馈和状态消耗可见；不外推其它改骰/死亡/攻击分支 |

## 6. 验证证据

### L1 结构证据

- BTR-03 文案检索命令：`rg -n "结算房间|Resolve Room|actionCueEndTurnRoomEffect|endTurnRoomEffect" public/locales/zh-CN/game-betrayal.json public/locales/en/game-betrayal.json src/games/betrayal/__tests__/Board.foundation.test.tsx e2e/betrayal/room-effect-representative.e2e.ts docs/games/betrayal/workflows/betrayal-playability-overhaul-plan-2026-07-14.md evidence/betrayal-playability-overhaul-2026-07-14.md`
- 结果：运行时 i18n 已改为 `结束回合` / `End Turn`；“结算房间”只保留在测试负向断言、专项问题描述和 evidence 说明中。
- 结论：用户点名的无规则动作名不再从运行时按钮或主提示文案外露。

### L2 领域行为证据

- BTR-01 haunt 阶段禁探索底层：
  - 命令：`npx eslint src\games\betrayal\game.ts src\games\betrayal\__tests__\firstScenarioRuntime.test.ts`
  - 结果：0 errors，5 个既有 unused warning。
  - 命令：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "haunt 阶段即使走本地测试通道也不能继续探索新房间" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`1 passed`。
  - 结论：haunt 阶段即使走本地测试/同屏调试通道，也不能越过规则校验继续探索未知房间；这证明规则门禁，不单独证明真实页面无入口。
- BTR-02 圣符作祟底层：
  - 命令：`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "圣符|恶兆|haunt|作祟" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：通过。
  - 结论：翻出预兆《圣符》会记录本次作祟检定骰面、来源牌名、作祟检定标签和未触发/触发结果；这只证明底层规则状态，不证明真实页面完整链路。
- BTR-02 圣符 Board 显示回归：
  - 命令：`npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "圣符预兆翻出后同屏显示作祟检定骰盘" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：通过。
  - 结论：真实 Board 组件探索翻出预兆《圣符》后，同屏显示圣符发现面板与作祟检定骰盘；该层只证明组件回归，完整端到端以 L3 E2E 为准。
- BTR-04 驱魔失败 / 死亡边界领域回归：
  - 命令：`npx eslint src\games\betrayal\__tests__\firstScenarioRuntime.test.ts`
  - 结果：0 errors。
  - 命令：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "最终驱魔失败" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`3 passed`。
  - 结论：当前领域实现不是“失败就突然死亡”：失败后只对每名存活英雄造成 1 点身体伤害；安全属性英雄不死，濒死英雄只有在这 1 点身体伤害后触及当前数值模型死亡边界才死亡；只有全部英雄死亡才进入叛徒胜利终局。该层只证明底层规则，不证明真实页面六段链。
- BTR-04 驱魔失败 UI 收口回归：
  - 命令：`npx eslint src\games\betrayal\Board.tsx e2e\betrayal\first-scenario-exorcism-failure.e2e.ts src\games\betrayal\__tests__\firstScenarioRuntime.test.ts`
  - 结果：0 errors。
  - 命令：`node -e "JSON.parse(require('fs').readFileSync('public/locales/zh-CN/game-betrayal.json','utf8')); JSON.parse(require('fs').readFileSync('public/locales/en/game-betrayal.json','utf8')); console.log('locale json ok')"`
  - 结果：`locale json ok`。
  - 结论：驱魔失败骰盘现在有玩家可见的“返回牌桌”关闭动作；成功驱魔仍沿原按钮进入终局，失败驱魔关闭后回到 haunt 牌桌。

### L3 真实玩法证据

- BTR-01 haunt 阶段禁探索真实页面负向链：
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/haunt-no-explore.e2e.ts "haunt 阶段真实页面不暴露探索入口并拒绝探索命令"`
  - 结果：`1 passed`
  - 截图：`evidence/山屋惊魂-haunt阶段禁探索/01-haunt阶段-牌桌无探索入口.jpg`
  - 截图：`evidence/山屋惊魂-haunt阶段禁探索/02-haunt阶段-探索命令被拒绝.jpg`
  - 自审：目标明确为“haunt 阶段不能继续探索新房间”；流程先证明真实牌桌不再给玩家暴露探索新房间入口，再强制派发探索命令并看到规则拒绝结果；这条只证明 BTR-01，不证明驱魔、骰盘、物品或交易已收口。
- BTR-02 圣符作祟判定真实页面六段链：
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/holy-symbol-haunt-roll.e2e.ts "预兆圣符从探索翻出到作祟检定和关闭回牌桌"`
  - 结果：`1 passed`
  - 截图：`evidence/山屋惊魂-圣符作祟判定/01-圣符作祟判定-探索前.jpg`
  - 截图：`evidence/山屋惊魂-圣符作祟判定/02-圣符作祟判定-选择未知房间.jpg`
  - 截图：`evidence/山屋惊魂-圣符作祟判定/03-圣符作祟判定-圣符翻出.jpg`
  - 截图：`evidence/山屋惊魂-圣符作祟判定/04-圣符作祟判定-作祟骰盘停稳.jpg`
  - 截图：`evidence/山屋惊魂-圣符作祟判定/05-圣符作祟判定-结果可见.jpg`
  - 截图：`evidence/山屋惊魂-圣符作祟判定/06-圣符作祟判定-关闭后回牌桌.jpg`
  - AI 核图：低清联系图 `evidence/山屋惊魂-圣符作祟判定/圣符作祟判定-六段联系图-低清核验.jpg` 已确认六张图属于同一条圣符链，能看到圣符翻出、作祟骰盘停稳、结果可见、关闭后回牌桌。
  - 自审：目标明确为“预兆《圣符》翻出后立即作祟判定并关闭回牌桌”；流程从真实探索按钮和真实未知房间选择开始，不是直接注入 `pending`；这条只证明 BTR-02。BTR-01 haunt 禁探索另有独立负向链证据，其它对象必须看各自链路证据。
- 圣符探索声明真实页面六段链：
  - 命令：`npx eslint src\games\betrayal\Board.tsx e2e\betrayal\holy-symbol-explore-declaration.e2e.ts`
  - 结果：0 errors。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/holy-symbol-explore-declaration.e2e.ts "真实页面声明圣符、取消、重新声明、探索并收口"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-圣符探索声明完整链路/01-圣符声明前牌桌可操作.jpg`
  - 截图：`evidence/山屋惊魂-圣符探索声明完整链路/02-圣符探索声明已选中.jpg`
  - 截图：`evidence/山屋惊魂-圣符探索声明完整链路/03-取消圣符声明后回到未声明.jpg`
  - 截图：`evidence/山屋惊魂-圣符探索声明完整链路/04-重新声明后选择未知房间.jpg`
  - 截图：`evidence/山屋惊魂-圣符探索声明完整链路/05-圣符替换房间并结算事件.jpg`
  - 截图：`evidence/山屋惊魂-圣符探索声明完整链路/06-关闭后回牌桌继续可操作.jpg`
  - AI 核图：低清联系图 `temp/betrayal-holy-symbol-explore-declaration-contact-lowres.jpg` 已确认六张图属于同一条圣符探索声明链，能看到声明、取消、重新声明、探索、圣符替换房间并结算事件、关闭后回牌桌。
  - 自审：目标明确为“圣符探索声明必须先由玩家声明，可取消并重新声明，探索时埋葬第一张发现板块并继续发现下一张，最终事件结算后关闭回牌桌”；流程从真实牌桌按钮和真实未知房间选择开始，不是直接注入替换结果。E2E 同步断言了声明按钮热区不小于 34px、保持透明开放式且无多余背景框、取消后回到未声明、重新声明后探索、日志包含“圣符埋葬倒塌房间”和“继续发现神秘电梯”、倒塌房间坠落效果没有落到牌桌、事件《滑落阶梯》结算速度 -1、关闭后发现/事件选择清空且牌桌继续可操作。该链只证明圣符探索声明，不外推其它预兆、雕像探索声明或全家族完成。
- BTR-03 房间停留效果真实页面链：
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/room-effect-representative.e2e.ts "火炉房代表停留效果 family：真实页面提示结束回合伤害并结算反馈"`
  - 结果：`1 passed`
  - 截图：`evidence/betrayal-room-effect-representatives/03-火炉房-结束回合前提示.jpg`
  - 截图：`evidence/betrayal-room-effect-representatives/04-火炉房-结算后反馈.jpg`
  - 自审：目标明确为“结束回合时处理房间停留效果”；流程是先看到结束回合前提示，再点击结束回合，随后看到火炉房 1 点物理伤害反馈；这条只证明 BTR-03，不证明 haunt、圣符、驱魔、骰盘、物品或交易已收口。
- BTR-04 驱魔失败伤害真实页面六段链：
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/first-scenario-exorcism-failure.e2e.ts "最终驱魔失败从真实入口到伤害结算再关闭回牌桌"`
  - 结果：`1 passed`
  - 截图：`evidence/山屋惊魂-驱魔失败伤害链/01-驱魔失败伤害链-驱魔前.jpg`
  - 截图：`evidence/山屋惊魂-驱魔失败伤害链/02-驱魔失败伤害链-选择杰克之灵房间.jpg`
  - 截图：`evidence/山屋惊魂-驱魔失败伤害链/03-驱魔失败伤害链-骰盘停稳失败.jpg`
  - 截图：`evidence/山屋惊魂-驱魔失败伤害链/04-驱魔失败伤害链-失败伤害结果.jpg`
  - 截图：`evidence/山屋惊魂-驱魔失败伤害链/05-驱魔失败伤害链-关闭前.jpg`
  - 截图：`evidence/山屋惊魂-驱魔失败伤害链/06-驱魔失败伤害链-关闭后回牌桌.jpg`
  - AI 核图：低清联系图 `evidence/山屋惊魂-驱魔失败伤害链/驱魔失败伤害链-六段联系图-低清核验.jpg` 已确认六张图属于同一条驱魔失败链，能看到驱魔前、房间目标、失败骰盘、结果、关闭按钮、关闭后回牌桌。
  - 自审：目标明确为“驱魔失败不能突然误死，必须按失败伤害结算并能关闭回牌桌”；流程从真实驱魔入口和真实房间本体选择开始，不是直接注入失败结果；该链只证明 BTR-04，不证明骰盘全家族、物品使用或交易已收口。
- BTR-05 山屋骰盘代表链：
  - 根因定位：`BetrayalHouseDice3DGroup` 原先所有实例都传 `canvasTestId="betrayal-house-dice-box-canvas"`；多个 RecentRollPanel 同屏或前后残留时，E2E 可能读取旧骰盘或错误骰盘的 Three.js 调试快照。
  - 本轮修正：`RecentRollPanel` 现在按 `roll.id` 生成独立山屋骰盘 canvas 调试键；E2E helper 改为从当前 roll panel 内的 canvas / dice group 读取对应调试快照；`DiceBoxThreeEngine.destroy()` 只清理本实例注册的调试函数，避免旧实例滞留；山屋骰盘 profile 改为相机可视区内投掷和落定散布，`DiceBoxPhysicsSource` 在冻结采样前执行落定分散，`settleDiceIntoSafeSpread()` 已支持 2/3/4/5 颗骰子。
  - 静态验证：`npx eslint src\games\betrayal\Board.tsx src\lib\dice-physics\DiceBoxPhysicsSource.tsx src\lib\dice-box-threejs\engine.ts e2e\betrayal\betrayalTestHelpers.ts e2e\betrayal\non-p0-representative.e2e.ts` 通过。
  - 已通过代表链：`npm run test:e2e:ci:file -- e2e/betrayal/non-p0-representative.e2e.ts "普通投骰事件代表链：真实页面同屏展示牌面、骰盘和分支结果"` 通过；截图刷新到 `evidence/betrayal-non-p0-representatives/01-普通投骰事件-探索目标.jpg` 到 `04-普通投骰事件-牌面骰盘分支.jpg`。
  - 已通过代表链：`npm run test:e2e:ci:file -- e2e/betrayal/non-p0-representative.e2e.ts "砍刀攻击武器代表链：真实页面可选择武器并完成攻击反馈"` 通过；截图刷新到 `evidence/betrayal-non-p0-representatives/08-砍刀攻击武器-选择前.jpg` 到 `11-砍刀攻击武器-攻击反馈.jpg`。
  - AI 核图：低清联系图 `temp/betrayal-hunting-knife-chain-contact-lowres.jpg` 已确认四段属于同一条砍刀攻击链，能看到选择前、目标高亮、攻击投骰和攻击反馈；攻击投骰图里 4 颗山屋专用骰分开可辨认，不再中心塌缩或明显重叠。
  - 自审：这次不放宽开放式骰盘、多骰不重叠、专用 0/1/2 骰面门禁；修复直接作用于真实物理骰落定布局和当前面板快照读取。BTR-05 代表链已通过，但骰盘全家族和最终自审尚未全量完成，不能写山屋全面完成。
- 兔脚重掷真实页面六段链：
  - 代码/测试更新：新增 `e2e/betrayal/rabbit-foot-reroll.e2e.ts`，从最近投骰可见状态起跑，后续通过真实页面点击兔脚本体和骰子圆形命中区，不直接派发重掷命令。
  - 静态验证：`npx eslint e2e/betrayal/rabbit-foot-reroll.e2e.ts` 通过。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/rabbit-foot-reroll.e2e.ts "兔脚从最近投骰点击本体、选择骰子、重掷结算并收口"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-兔脚重掷完整链路/01-兔脚重掷前最近投骰可见.jpg`
  - 截图：`evidence/山屋惊魂-兔脚重掷完整链路/02-兔脚本体已选中.jpg`
  - 截图：`evidence/山屋惊魂-兔脚重掷完整链路/03-选择具体骰子高亮.jpg`
  - 截图：`evidence/山屋惊魂-兔脚重掷完整链路/04-重掷后骰盘更新.jpg`
  - 截图：`evidence/山屋惊魂-兔脚重掷完整链路/05-重掷结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-兔脚重掷完整链路/06-收口后回牌桌可操作.jpg`
  - 自审：目标明确为“兔脚必须作为真实物品本体介入最近投骰，玩家直接点具体骰子完成重掷，结算结果更新并清空选中态”。E2E 断言了兔脚本体 `data-roll-modifier-available=true`、选骰层 `betrayal-rabbit-foot-dice` 出现后消失、没有旧的数字按钮 `betrayal-rabbit-foot-die-1`、骰子目标为圆形命中区、重掷后骰面从 `2,0,0` 更新为 `2,2,0`、反馈显示“使用兔脚重掷第 2 颗骰子”、`usedCardIdsThisTurn` 与 `consumedRabbitFootCardIds` 记录兔脚、最终选中物品和选骰层清空回牌桌。该链只证明兔脚重掷骰盘，不证明其它改骰、死亡保护或攻击分支全部收口。
- BTR-06 物品使用真实页面六段链：
  - 代码修正：`src/games/betrayal/testing/firstScenarioTestUtils.ts` 增加急救包可用代表态；`src/games/betrayal/Board.tsx` 将治疗目标提示改为“急救包治疗”，让玩家知道目标选择属于哪张物品；`public/locales/*/game-betrayal.json` 增加对应文案。
  - 命令：`npx eslint e2e\betrayal\first-scenario-use-possession.e2e.ts`
  - 结果：通过。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/first-scenario-use-possession.e2e.ts "真实页面选择急救包、选队友目标并完成治疗收口"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-物品使用完整链路/01-使用前牌桌可操作.jpg`
  - 截图：`evidence/山屋惊魂-物品使用完整链路/02-急救包本体已选中.jpg`
  - 截图：`evidence/山屋惊魂-物品使用完整链路/03-同房间队友目标可选.jpg`
  - 截图：`evidence/山屋惊魂-物品使用完整链路/04-同房间队友目标已选中.jpg`
  - 截图：`evidence/山屋惊魂-物品使用完整链路/05-急救包结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-物品使用完整链路/06-物品使用后回牌桌状态清空.jpg`
  - AI 核图：低清联系图 `evidence/山屋惊魂-物品使用完整链路/物品使用完整链路-六段联系图-低清核验.jpg` 已确认六张图属于同一条急救包链，能看到急救包本体被选中、同房间队友 token 可选并被选中、治疗结算结果可见、使用后回到牌桌清空状态。
  - 自审：目标明确为“物品使用必须按物品本体 -> 目标 -> 结算 -> 收口走完整链”；流程从真实持有物急救包牌面和真实地图队友 token 起跑，不是侧边文字代理或直接 dispatch；结算后急救包从当前持有区消失、治疗目标选择器清空，队友若仍有高亮只能是同房间常驻候选态，不是治疗已选残留。该链只证明 BTR-06，不证明骰盘全家族已收口。
- 奇怪的药品真实页面六段链：
  - 代码/测试更新：新增 `createHolyWaterUseReadyCore` 和 `createHolyWaterUseReadyRuntimeCore`，并新增 `e2e/betrayal/holy-water-use.e2e.ts`。测试从真实页面药品本体起跑，点击 `奇怪的药品` 牌面和使用按钮，不直接派发使用命令。
  - 静态验证：`npx eslint src/games/betrayal/testing/firstScenarioTestUtils.ts e2e/betrayal/betrayalTestHelpers.ts e2e/betrayal/holy-water-use.e2e.ts` 通过。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/holy-water-use.e2e.ts "真实页面选择奇怪的药品、直接使用并恢复力量速度收口"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-奇怪的药品使用完整链路/01-药品使用前牌桌可操作.jpg`
  - 截图：`evidence/山屋惊魂-奇怪的药品使用完整链路/02-奇怪的药品本体已选中.jpg`
  - 截图：`evidence/山屋惊魂-奇怪的药品使用完整链路/03-药品无需目标可直接使用.jpg`
  - 截图：`evidence/山屋惊魂-奇怪的药品使用完整链路/04-药品结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-奇怪的药品使用完整链路/05-药品使用后回牌桌状态清空.jpg`
  - 截图：`evidence/山屋惊魂-奇怪的药品使用完整链路/06-收口后牌桌继续可操作.jpg`
  - AI 核图：低清联系图 `temp/betrayal-holy-water-use-full-chain-contact-lowres.jpg` 已确认六张图属于同一条奇怪的药品链，能看到药品本体选中、无需队友目标选择、使用后力量/速度恢复反馈、药品从持有区消失并回到可操作牌桌。该联系图只用于 AI 核图，不替代原始截图。
  - 自审：目标明确为“奇怪的药品必须作为真实物品本体使用，治疗当前探索者力量和速度并收口”。流程从真实持有物牌面起跑，不是直接 dispatch；E2E 证明了使用前按钮禁用、选中药品后不出现队友目标选择器且使用按钮可用、结算后 `usedCardIdsThisTurn` 记录药品、力量/速度恢复、药品消失、已选物品和目标选择提示清空。该链只证明奇怪的药品本对象，不外推到手电筒 / 灯笼 / 头戴耳机 / 骨制钥匙等其它物品。
- 地图物品放置探索者六段链：
  - 代码/测试更新：`e2e/betrayal/inventory-density.e2e.ts` 将“地图物品通过房间牌本体选择目标并放置探索者”从两段截图扩为六段截图，并补充使用前禁用、选物品后禁用、选目标后可用、结算后物品消失、目标选择器清空和回牌桌断言。
  - 静态验证：`npx eslint e2e/betrayal/inventory-density.e2e.ts` 通过。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/inventory-density.e2e.ts "地图物品通过房间牌本体选择目标并放置探索者"`
  - 结果：`1 passed`。
  - 截图：`evidence/betrayal-inventory-density/06-山屋惊魂-地图物品-使用前牌桌可操作.jpg`
  - 截图：`evidence/betrayal-inventory-density/07-山屋惊魂-地图物品-地图本体已选中.jpg`
  - 截图：`evidence/betrayal-inventory-density/08-山屋惊魂-地图物品-房间牌直选目标.jpg`
  - 截图：`evidence/betrayal-inventory-density/09-山屋惊魂-地图物品-房间目标已选中.jpg`
  - 截图：`evidence/betrayal-inventory-density/10-山屋惊魂-地图物品-使用后探索者落位.jpg`
  - 截图：`evidence/betrayal-inventory-density/11-山屋惊魂-地图物品-收口后回牌桌.jpg`
  - 自审：目标明确为“地图类物品必须按物品本体 -> 房间牌目标 -> 确认使用 -> 探索者落位 -> 状态清空回牌桌走完整链”。该链从真实持有物地图和真实房间牌本体起跑，不是直接 dispatch；E2E 证明了未选物品前使用禁用、已选地图但未选房间前使用仍禁用、选中上层起始点后使用可点、结算后反馈包含地图和上层起始点、探索者 token 落到上层起始点、地图从当前持有区消失、已选物品和目标选择器清空。该链只证明地图这一共享效果代表，不直接证明笔记本 / 日记 / 手稿全量无接线偏差。
- 已有代表链：
  - 上古旧宅完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/上古旧宅-完整链路-01-探索前.jpg` 到 `上古旧宅-完整链路-06-关闭后.jpg`
  - 夜幕众星完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/夜幕众星-完整链路-01-探索前.jpg` 到 `夜幕众星-完整链路-06-关闭后.jpg`
  - 蜘蛛！完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/蜘蛛-完整链路-01-探索前.jpg` 到 `蜘蛛-完整链路-06-关闭后.jpg`
  - 外星几何完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/外星几何-完整链路-01-探索前.jpg` 到 `外星几何-完整链路-06-关闭后.jpg`
  - 电话铃声完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/电话铃声-完整链路-01-探索前.jpg` 到 `电话铃声-完整链路-06-关闭后.jpg`
  - 嘎吱的木门完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/嘎吱的木门-完整链路-01-探索前.jpg` 到 `嘎吱的木门-完整链路-06-关闭后.jpg`
  - 小机器人完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/小机器人-完整链路-01-探索前.jpg` 到 `小机器人-完整链路-06-关闭后.jpg`
  - 一条秘密通道完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/一条秘密通道-完整链路-01-探索前.jpg` 到 `一条秘密通道-完整链路-06-关闭后.jpg`
  - 脑状食品完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/脑状食品-完整链路-01-探索前.jpg` 到 `脑状食品-完整链路-06-关闭后.jpg`
  - 肉质苔癣完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/肉质苔癣-完整链路-01-探索前.jpg` 到 `肉质苔癣-完整链路-06-关闭后回牌桌.jpg`
  - 一瓶微尘完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/一瓶微尘-完整链路-01-探索前.jpg` 到 `一瓶微尘-完整链路-06-关闭后回牌桌.jpg`
  - 大宅饿了完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/大宅饿了-完整链路-01-探索前.jpg` 到 `大宅饿了-完整链路-06-关闭后回牌桌.jpg`
  - 说“茄子”！完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/说茄子-完整链路-01-探索前.jpg` 到 `说茄子-完整链路-06-关闭后回牌桌.jpg`
  - 一抹鲜红完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/一抹鲜红-完整链路-01-探索前.jpg` 到 `一抹鲜红-完整链路-06-关闭后回牌桌.jpg`
  - 吊死鬼完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/吊死鬼-完整链路-01-探索前.jpg` 到 `吊死鬼-完整链路-06-关闭后回牌桌.jpg`
- 外星几何完整链路补证：
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "外星几何真实链路从探索翻牌到自动投骰结算关闭"`
  - 结果：`1 passed`
  - AI 核图：低清联系图 `temp/betrayal-alien-geometry-full-chain-contact-lowres.jpg` 已确认六张图属于同一条外星几何链，能看到探索前、选择未知房间、事件牌翻出、知识检定骰盘停稳、结算结果、关闭后回牌桌。
  - 自审：目标明确为“牌翻出来后自动投骰、直接结算并关闭回牌桌”；流程从真实探索入口和未知房间选择开始，不是直接注入 `pending`；该链只证明投骰后直接结算家族里的属性变化代表结果，不能外推到伤害、移动或抽牌代表结果。
- 电话铃声完整链路补证：
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "电话铃声伤害直接结算真实链路从探索翻牌到投骰结算关闭"`
  - 结果：`1 passed`
  - AI 核图：低清联系图 `temp/betrayal-phone-ring-direct-roll-contact-lowres.jpg` 已确认六张图属于同一条电话铃声链，能看到探索前、选择未知房间、事件牌翻出、2 颗骰子直接结算物理伤害和关闭后回牌桌。
  - 自审：目标明确为“牌翻出来后自动投骰并直接结算伤害”；流程从真实探索入口和未知房间选择开始，不是直接注入 `pending`；该链补齐投骰后直接结算家族中的伤害代表结果。
- 嘎吱的木门完整链路补证：
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "嘎吱的木门移动直接结算真实链路从探索翻牌到投骰结算关闭"`
  - 结果：`1 passed`
  - AI 核图：低清联系图 `temp/betrayal-creaking-door-direct-roll-contact-lowres.jpg` 已确认六张图属于同一条嘎吱的木门链，能看到探索前、选择未知房间、事件牌翻出、知识检定直接结算移动到上层起始点和关闭后回牌桌。
  - 自审：目标明确为“牌翻出来后自动投骰并直接结算移动”；流程从真实探索入口和未知房间选择开始，不是直接注入 `pending`；该链补齐投骰后直接结算家族中的移动代表结果。
- 小机器人完整链路补证：
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "小机器人抽物品直接结算真实链路从探索翻牌到投骰结算关闭"`
  - 结果：`1 passed`
  - AI 核图：低清联系图 `temp/betrayal-toy-monkey-direct-roll-contact-lowres.jpg` 已确认六张图属于同一条小机器人链，能看到探索前、选择未知房间、事件牌翻出、知识检定直接结算抽物品和关闭后回牌桌。
  - 自审：目标明确为“牌翻出来后自动投骰并直接结算抽物品”；流程从真实探索入口和未知房间选择开始，不是直接注入 `pending`；该链补齐投骰后直接结算家族中的抽物品代表结果。
- 一条秘密通道完整链路补证：
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "一条秘密通道真实链路从探索翻牌到检定后选房间结算关闭"`
  - 结果：`1 passed`
  - AI 核图：低清联系图 `temp/betrayal-secret-passage-full-chain-contact-lowres.jpg` 已确认六张图属于同一条一条秘密通道链，能看到探索前、选择未知房间、事件牌翻出、知识检定、选择门厅作为第二秘密通道、结算标志物和关闭后回牌桌。
  - 自审：目标明确为“牌翻出来后先知识检定，再选择第二个秘密通道房间，结算后关闭回牌桌”；流程从真实探索入口和未知房间选择开始，不是直接注入 `pendingEventChoice`；该链补齐了先检定再选择后续效果家族中的房间目标选择代表结果。
- 脑状食品完整链路补证：
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "脑状食品真实链路从探索翻牌到检定后选属性结算关闭"`
  - 结果：`1 passed`
  - 整文件复跑：新增肉质苔癣完整链路后的旧整文件计数已被后续《一瓶微尘》《大宅饿了》《说“茄子”！》《一抹鲜红》《吊死鬼》和直接结算剩余 8 张补证覆盖；新增 8 张后的当前证据以逐条定向通过为准。
  - AI 核图：低清联系图 `temp/betrayal-brain-food-full-chain-contact-lowres.jpg` 已确认六张图属于同一条脑状食品链，能看到探索前、选择未知房间、事件牌翻出、力量检定、选择速度奖励、结算结果和关闭后回牌桌。
  - 自审：目标明确为“牌翻出来后先力量检定，再选择奖励属性并结算关闭”；流程从真实探索入口和未知房间选择开始，不是直接注入 `pendingEventChoice`；该链补齐了先检定再选择后续效果家族中的奖励属性选择代表结果。
- 肉质苔癣完整链路补证：
  - 命令：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "肉质苔癣" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`2 passed`。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "肉质苔癣真实链路从探索翻牌到选择吸入投骰再选属性结算关闭"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/肉质苔癣-完整链路-01-探索前.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/肉质苔癣-完整链路-02-选择未知房间.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/肉质苔癣-完整链路-03-事件牌翻出可选择吸入.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/肉质苔癣-完整链路-04-选择吸入后骰盘停稳并出现属性选项.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/肉质苔癣-完整链路-05-选择知识奖励后结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/肉质苔癣-完整链路-06-关闭后回牌桌.jpg`
  - 自审：目标明确为“牌先翻出来，再由玩家先选择是否吸入，吸入后才投 2 颗骰，成功后才出现属性奖励选择，选择知识后结算并关闭回牌桌”；流程从真实探索入口和未知房间选择开始，不是直接注入 `pendingEventChoice`。E2E 同步断言了选择吸入前没有骰盘和属性选项、吸入后骰盘停稳且属性选项才出现、选项尺寸可读可点、事件选择面板为开放式无背景框、属性选项不是同一颜色、滚动容器滚动后目标属性仍可见、2 颗山屋物理骰分开可辨认、结算后 `pendingEventChoice` 清空并保留本次骰盘依据。该链只证明可选事件投骰家族中的《肉质苔癣》，不能外推到说“茄子”！、一抹鲜红、一瓶微尘、大宅饿了。
  - 整文件复跑：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts`
  - 结果：该轮整文件复跑已通过；新增 8 张直接结算牌后不再把该旧计数作为当前全量计数。
- 一瓶微尘完整链路补证：
  - 命令：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "一瓶微尘" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`2 passed`。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "一瓶微尘真实链路从探索翻牌到选择作祟检定投骰结算关闭"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/一瓶微尘-完整链路-01-探索前.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/一瓶微尘-完整链路-02-选择未知房间.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/一瓶微尘-完整链路-03-事件牌翻出可选择作祟检定.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/一瓶微尘-完整链路-04-选择作祟检定后骰盘停稳.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/一瓶微尘-完整链路-05-神志奖励结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/一瓶微尘-完整链路-06-关闭后回牌桌.jpg`
  - AI 核图：低清联系图 `temp/betrayal-dusty-vial-full-chain-contact-lowres.jpg` 已确认六张图属于同一条一瓶微尘链，能看到探索前、选择未知房间、事件牌翻出可选择作祟检定、选择后作祟骰盘停稳、神志奖励结算、关闭后回牌桌。
  - 自审：目标明确为“牌先翻出来，再由玩家先选择是否进行作祟检定，选择检定后才按当前预兆数投作祟骰，失败后结算神志 +1 并关闭回牌桌”；流程从真实探索入口和未知房间选择开始，不是直接注入 `pendingEventChoice`。E2E 同步断言了选择前没有最近投骰面板、两个选项尺寸可读可点、事件选择面板为开放式无背景框、选择作祟检定后骰盘点数与规则状态一致、未触发作祟时仍处于恶兆前、`pendingEventChoice` 清空、力量不变、神志 +1、关闭后回到可操作牌桌。该链只证明可选作祟事件中的《一瓶微尘》，不能外推到说“茄子”！、一抹鲜红、大宅饿了或吊死鬼。
  - 整文件复跑：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts`
  - 结果：该轮整文件复跑已通过；新增 8 张直接结算牌后不再把该旧计数作为当前全量计数。
- 大宅饿了完整链路补证：
  - 命令：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "大宅饿了" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`2 passed`。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "大宅饿了真实链路从探索翻牌到跳过作祟选择属性结算关闭"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/大宅饿了-完整链路-01-探索前.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/大宅饿了-完整链路-02-选择未知房间.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/大宅饿了-完整链路-03-事件牌翻出可选择作祟检定.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/大宅饿了-完整链路-04-选择知识奖励后准备跳过作祟.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/大宅饿了-完整链路-05-知识奖励结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/大宅饿了-完整链路-06-关闭后回牌桌.jpg`
  - AI 核图：低清联系图 `temp/betrayal-hungry-house-full-chain-contact-lowres.jpg` 已确认六张图属于同一条大宅饿了链，能看到探索前、选择未知房间、事件牌翻出可选择作祟检定、选择知识奖励后准备跳过作祟、知识奖励结算结果可见、关闭后回牌桌。
  - 自审：目标明确为“牌先翻出来，再由玩家先选择奖励属性，然后跳过作祟，结算所选属性 +1 并关闭回牌桌”；流程从真实探索入口和未知房间选择开始，不是直接注入 `pendingEventChoice`。E2E 同步断言了未选择奖励属性前跳过作祟按钮不可用、选择知识后跳过按钮可用、跳过分支不出现作祟骰盘、知识 +1、神志和力量不变、`pendingEventChoice` 清空、`phase=preHaunt`、`hauntTriggered=false`、关闭后回到可操作牌桌。该链只证明可选作祟家族中的《大宅饿了》，不能外推到说“茄子”！、一抹鲜红或吊死鬼。
  - 整文件复跑：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts`
  - 结果：该轮整文件复跑已通过；新增 8 张直接结算牌后不再把该旧计数作为当前全量计数。
- 说“茄子”！完整链路补证：
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "说茄子真实链路从探索翻牌到作祟失败抽物品关闭"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/说茄子-完整链路-01-探索前.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/说茄子-完整链路-02-选择未知房间.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/说茄子-完整链路-03-事件牌翻出可选择作祟检定.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/说茄子-完整链路-04-选择作祟检定后骰盘停稳.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/说茄子-完整链路-05-抽物品结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/说茄子-完整链路-06-关闭后回牌桌.jpg`
  - 自审：目标明确为“牌先翻出来，再由玩家选择进行作祟检定，作祟失败后抽取物品并关闭回牌桌”；流程从真实探索入口和未知房间选择开始，不是直接注入 `pendingEventChoice`。E2E 同步断言了选择前没有最近投骰面板、可选作祟按钮可见、选择后按当前预兆数投作祟骰、骰盘数量和总点数与规则状态一致、骰盘停稳且多骰分离、未触发作祟时仍处于恶兆前、`pendingEventChoice` 清空、抽到《魔法相机》、关闭后物品仍在持有区并回到可操作牌桌。该链证明说“茄子”！的可选作祟失败抽物品链，不外推到其它事件牌。
- 一抹鲜红完整链路补证：
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "一抹鲜红真实链路从探索翻牌到作祟失败速度奖励关闭"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/一抹鲜红-完整链路-01-探索前.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/一抹鲜红-完整链路-02-选择未知房间.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/一抹鲜红-完整链路-03-事件牌翻出可选择作祟检定.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/一抹鲜红-完整链路-04-选择作祟检定后骰盘停稳.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/一抹鲜红-完整链路-05-速度奖励结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/一抹鲜红-完整链路-06-关闭后回牌桌.jpg`
  - 自审：目标明确为“牌先翻出来，再由玩家选择进行作祟检定，作祟失败后结算速度 +1 并关闭回牌桌”；流程从真实探索入口和未知房间选择开始，不是直接注入 `pendingEventChoice`。E2E 同步断言了选择前没有最近投骰面板、选择后才出现作祟骰盘、骰盘数量和总点数与规则状态一致、骰盘停稳且多骰分离、未触发作祟时仍处于恶兆前、没有错误结算物理伤害、`pendingEventChoice` 清空、速度从 4 变为 5、关闭后回到可操作牌桌。该链证明一抹鲜红的可选作祟失败速度奖励链，不外推到其它事件牌。
- 吊死鬼完整链路补证：
  - 命令：`npx eslint src/games/betrayal/Board.tsx src/games/betrayal/__tests__/Board.foundation.test.tsx e2e/betrayal/event-choice-coverage.e2e.ts`
  - 结果：通过。
  - 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/Board.foundation.test.tsx --config vitest.config.core.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "吊死鬼待选事件能在真实页面选择奖励属性"`
  - 结果：`1 passed`；结束后有 `ECONNRESET/socket hang up` 噪声，但测试结果为通过。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "吊死鬼真实链路从探索翻牌到四项检定后选奖励关闭"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/吊死鬼-完整链路-01-探索前.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/吊死鬼-完整链路-02-选择未知房间.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/吊死鬼-完整链路-03-事件牌翻出四项检定全过.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/吊死鬼-完整链路-04-选择知识奖励.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/吊死鬼-完整链路-05-知识奖励结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/吊死鬼-完整链路-06-关闭后回牌桌.jpg`
  - 自审：目标明确为“牌先翻出来，自动完成四项属性检定，四项均通过后才允许选择奖励属性，选择知识后结算知识 +1 并关闭回牌桌”；流程从真实探索入口和未知房间选择开始，不是直接注入 `allPassEffect` 子效果。E2E 同步断言了牌面可见、四项检定结果均显示 `6 / 通过`、未选属性前确认按钮禁用、四个奖励属性选项可见、选择知识后确认按钮启用、结算面板显示“每项属性均通过”和“知识 +1”、`pendingEventChoice` 清空、知识从 3 变为 4、关闭后回到可操作牌桌。该链证明吊死鬼的自动多属性检定后选择奖励家族，不外推到其它事件牌。
- 投骰后直接结算剩余 8 张逐张补证：
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "标本剥制伤害和障碍物直接结算真实链路从探索翻牌到投骰结算关闭"`
  - 结果：`1 passed`。
  - 命令：顺序定向运行小丑房间、咬一口！、最深的壁橱、磁带播放器、在你背后！、一种怪异的感觉、葬礼 7 条完整链。
  - 结果：每条均为 `1 passed`，顺序脚本输出 `ALL_TARGETED_E2E_PASSED=7`。
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/标本剥制-完整链路-01-探索前.jpg` 到 `标本剥制-完整链路-06-关闭后.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/小丑房间-完整链路-01-探索前.jpg` 到 `小丑房间-完整链路-06-关闭后.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/咬一口-完整链路-01-探索前.jpg` 到 `咬一口-完整链路-06-关闭后.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/最深的壁橱-完整链路-01-探索前.jpg` 到 `最深的壁橱-完整链路-06-关闭后.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/磁带播放器-完整链路-01-探索前.jpg` 到 `磁带播放器-完整链路-06-关闭后.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/在你背后-完整链路-01-探索前.jpg` 到 `在你背后-完整链路-06-关闭后.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/一种怪异的感觉-完整链路-01-探索前.jpg` 到 `一种怪异的感觉-完整链路-06-关闭后.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/葬礼-完整链路-01-探索前.jpg` 到 `葬礼-完整链路-06-关闭后.jpg`
  - 自审：这 8 张都属于“牌翻出后自动投骰/检定并直接结算”家族，完整链必须证明没有空选择壳、结算结果落位且关闭后回牌桌。至此事件牌当前数据合同为 23/23 逐张完整链；该结论只覆盖事件牌，不覆盖预兆、物品全家族或骰盘全家族。
- 事件牌完整链整文件复跑：
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts`
  - 结果：十五条阶段为 `27 passed`；新增 8 张直接结算牌后本轮以逐条定向通过和六段截图作为 23/23 证据，未把旧 `27 passed` 计数冒充新增后的整文件全量复跑。
- 六段验收口径：每条卡牌翻出链必须同时有 `翻出前`、`翻出后`、`选择或投骰前`、`选择/投骰后`、`结算后`、`关闭后` 六类证据；缺任一类只能登记为阶段承接。
- BTR-07 交易真实页面六段链：
  - 代码修正：`src/games/betrayal/Board.tsx` 在确认交易后同时清空已选持有物和已选交易目标，避免物品已转移但目标/选中态仍残留。
  - 命令：`npx eslint src\games\betrayal\Board.tsx e2e\betrayal\first-scenario-trade-interaction.e2e.ts`
  - 结果：通过。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/first-scenario-trade-interaction.e2e.ts "真实页面可选物品、选目标并确认交易"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-交易完整链路/01-交易前牌桌可操作.jpg`
  - 截图：`evidence/山屋惊魂-交易完整链路/02-物品兔脚本体已选中.jpg`
  - 截图：`evidence/山屋惊魂-交易完整链路/03-地图队友目标已选中.jpg`
  - 截图：`evidence/山屋惊魂-交易完整链路/04-确认交易前.jpg`
  - 截图：`evidence/山屋惊魂-交易完整链路/05-交易结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-交易完整链路/06-交易后回牌桌状态清空.jpg`
  - AI 核图：低清联系图 `evidence/山屋惊魂-交易完整链路/交易完整链路-六段联系图-低清核验.jpg` 已确认六张图属于同一条交易链，能看到兔脚本体被选中、地图队友 token 被选中、确认交易、兔脚转移后主牌桌回到清空状态。
  - 自审：目标明确为“交易必须按对象 -> 目标 -> 确认 -> 结算 -> 收口走完整链”；流程从真实持有物牌面和真实地图队友 token 起跑，不是侧边文字代理或直接 dispatch；该链只证明 BTR-07，不证明物品使用链或骰盘全家族已收口。
- 狗远距交易真实页面六段链：
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/first-scenario-trade-interaction.e2e.ts "狗远距交易真实链路可选择多张持有物、4格内目标并收口"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-狗远距交易完整链路/01-狗交易前牌桌可操作.jpg`
  - 截图：`evidence/山屋惊魂-狗远距交易完整链路/02-用狗选择要送的持有物.jpg`
  - 截图：`evidence/山屋惊魂-狗远距交易完整链路/03-切到目标楼层看到4格内队友.jpg`
  - 截图：`evidence/山屋惊魂-狗远距交易完整链路/04-选择远距目标并确认前.jpg`
  - 截图：`evidence/山屋惊魂-狗远距交易完整链路/05-狗交易结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-狗远距交易完整链路/06-狗交易后回牌桌状态清空.jpg`
  - AI 核图：低清联系图 `temp/betrayal-dog-trade-full-chain-contact-lowres.jpg` 已确认六张图属于同一条狗远距交易链，能看到交易前牌桌、狗交易物选择、切到目标楼层看到 4 格内队友、点击远距队友 token、急救包和地图转移给队友、狗标记已用、交易状态清空回牌桌。
  - 自审：目标明确为“狗作为交易媒介 -> 选择多张可交易持有物 -> 选择 4 格内队友 -> 确认 -> 结算 -> 收口”。流程从真实狗交易选择器和地图队友 token 起跑，不是同房间交易、不是侧栏文字目标、不是直接 dispatch；E2E 同步断言狗本身不能被当作要送出的持有物、狗交易不退回同房间队友按钮、4 格目标有贴合 token 的五边形高亮、确认后当前玩家只剩狗、队友获得急救包和地图、`usedCardIdsThisTurn` 记录狗、狗交易选择器和远距目标高亮清空。该链只证明预兆《狗》的远距交易本对象，不外推面具、书本、盔甲、指环或匕首。
- 面具移动真实页面六段链：
  - 命令：`npx eslint src/games/betrayal/Board.tsx src/games/betrayal/testing/firstScenarioTestUtils.ts src/games/betrayal/__tests__/Board.foundation.test.tsx e2e/betrayal/betrayalTestHelpers.ts e2e/betrayal/first-scenario-use-possession.e2e.ts`
  - 结果：通过。
  - 命令：`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "面具|moveOthers|持有物" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`5 passed`。
  - 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/Board.foundation.test.tsx --config vitest.config.core.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "面具会在真实页面给同板块队友和怪物分别选择相邻板块"`
  - 结果：`1 passed`；命令尾部出现 `socket hang up / ECONNRESET` 噪声，但测试结果已通过。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/first-scenario-use-possession.e2e.ts "面具真实链路选择同房间队友、相邻房间并完成移动收口"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-面具移动完整链路/01-面具使用前牌桌可操作.jpg`
  - 截图：`evidence/山屋惊魂-面具移动完整链路/02-面具本体已选中.jpg`
  - 截图：`evidence/山屋惊魂-面具移动完整链路/03-同房间队友目标已激活.jpg`
  - 截图：`evidence/山屋惊魂-面具移动完整链路/04-选择相邻房间并确认前.jpg`
  - 截图：`evidence/山屋惊魂-面具移动完整链路/05-面具移动结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-面具移动完整链路/06-面具使用后回牌桌状态清空.jpg`
  - AI 核图：低清联系图 `temp/betrayal-mask-move-full-chain-contact-lowres.jpg` 已确认六张图属于同一条面具移动链，能看到面具使用前、选中面具、同房间队友目标激活、相邻房间高亮、确认后队友离开原房间、最后选择器和高亮清空回牌桌。
  - 自审：目标明确为“点面具本体 -> 选择同板块其他角色 -> 选择相邻已发现房间 -> 确认移动 -> 结算 -> 收口”。流程从真实持有物《面具》和地图队友 token 起跑，不是组件层直接 dispatch，不是只看目标按钮存在；E2E 同步断言同房间队友成为可选目标、相邻房间成为目标房间、确认后队友移动到相邻房间、已选面具、面具目标选择器和房间/目标高亮清空。该链只证明预兆《面具》的移动同板块角色能力，不外推书本、盔甲、指环或匕首。
- 骨制钥匙穿墙移动真实页面六段链：
  - 命令：`npx eslint src/games/betrayal/testing/firstScenarioTestUtils.ts e2e/betrayal/betrayalTestHelpers.ts e2e/betrayal/first-scenario-use-possession.e2e.ts`
  - 结果：通过。
  - 命令：`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "骨制钥匙" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`2 passed`。
  - 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/Board.foundation.test.tsx --config vitest.config.core.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "骨制钥匙会在真实页面移动模式显示穿墙目标并传入领域命令"`
  - 结果：`1 passed`；命令尾部出现 `socket hang up / ECONNRESET` 噪声，但测试结果已通过。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/first-scenario-use-possession.e2e.ts "骨制钥匙真实链路打开移动模式、选择穿墙目标并完成移动收口"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-骨制钥匙穿墙移动完整链路/01-骨制钥匙移动前牌桌可操作.jpg`
  - 截图：`evidence/山屋惊魂-骨制钥匙穿墙移动完整链路/02-骨制钥匙本体规则可见.jpg`
  - 截图：`evidence/山屋惊魂-骨制钥匙穿墙移动完整链路/03-打开移动模式看到穿墙目标.jpg`
  - 截图：`evidence/山屋惊魂-骨制钥匙穿墙移动完整链路/04-点击穿墙目标前.jpg`
  - 截图：`evidence/山屋惊魂-骨制钥匙穿墙移动完整链路/05-骨制钥匙移动结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-骨制钥匙穿墙移动完整链路/06-骨制钥匙移动后回牌桌状态清空.jpg`
  - AI 核图：低清联系图 `temp/betrayal-skeleton-key-move-full-chain-contact-lowres.jpg` 已确认六张图属于同一条骨制钥匙穿墙移动链，能看到移动前、物品本体、打开移动模式、点击穿墙目标前、移动到目标房间后的反馈、最后退出移动态并回到可操作牌桌。
  - 自审：目标明确为“骨制钥匙不是主动使用按钮，而是移动模式里的穿墙移动来源”。流程从真实骨制钥匙持有物、真实移动按钮和真实房间牌目标起跑，不是直接 dispatch；E2E 同步断言目标房间同层相邻但未连门、普通移动无效、进入移动模式后目标房间可点、点击后领域命令携带 `useSkeletonKey` 语义并写出“使用骨制钥匙穿过墙壁”反馈、当前位置和活动房间移动到图书馆、剩余移动点减少、移动目标高亮清空回牌桌。该链只证明物品《骨制钥匙》的穿墙移动能力，不外推头戴耳机、手电筒/灯笼或其它物品。
- 盔甲物理减伤真实页面六段链：
  - 命令：`npx eslint e2e\betrayal\event-choice-coverage.e2e.ts`
  - 结果：通过。
  - 命令：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "盔甲" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`4 passed`。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "盔甲真实链路从电话铃声翻牌到物理伤害减伤结算关闭"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-盔甲物理减伤完整链路/01-盔甲减伤前牌桌可操作.jpg`
  - 截图：`evidence/山屋惊魂-盔甲物理减伤完整链路/02-选择未知房间前.jpg`
  - 截图：`evidence/山屋惊魂-盔甲物理减伤完整链路/03-电话铃声翻出并显示物理伤害分支.jpg`
  - 截图：`evidence/山屋惊魂-盔甲物理减伤完整链路/04-物理伤害骰盘停稳.jpg`
  - 截图：`evidence/山屋惊魂-盔甲物理减伤完整链路/05-盔甲减伤结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-盔甲物理减伤完整链路/06-关闭后回牌桌状态清空.jpg`
  - AI 核图：低清联系图 `temp/betrayal-armor-physical-reduction-full-chain-contact-lowres.jpg` 已确认六张图属于同一条盔甲物理减伤链，能看到盔甲持有区、选择未知房间、电话铃声翻出、物理伤害骰盘停稳、减伤结算和关闭后回牌桌。
  - 自审：目标明确为“盔甲是被动物理减伤，不是主动使用牌”。流程从真实持有区《盔甲》、真实探索按钮和真实未知房间目标起跑，不是直接注入伤害结果；E2E 同步断言盔甲规则摘要可见、事件牌《电话铃声》真实翻出并命中“受到两颗骰子的物理伤害”分支、伤害骰实际为 `[2, 2]`、身体属性总和从 8 只降到 5（减 3 而不是减 4）、发现面板关闭后 `discovery/event choice` 面板清空且牌桌动作栏可见。该链只证明预兆《盔甲》的物理减伤能力，不外推头戴耳机精神减伤、头骨死亡保护、攻击武器或其它预兆能力。
- 头戴耳机精神减伤真实页面六段链：
  - 命令：`npx eslint e2e\betrayal\event-choice-coverage.e2e.ts`
  - 结果：通过。
  - 命令：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "头戴耳机" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`3 passed`。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "头戴耳机真实链路从电话铃声翻牌到精神伤害减伤结算关闭"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-头戴耳机精神减伤完整链路/01-头戴耳机减伤前牌桌可操作.jpg`
  - 截图：`evidence/山屋惊魂-头戴耳机精神减伤完整链路/02-选择未知房间前.jpg`
  - 截图：`evidence/山屋惊魂-头戴耳机精神减伤完整链路/03-电话铃声翻出并显示精神伤害分支.jpg`
  - 截图：`evidence/山屋惊魂-头戴耳机精神减伤完整链路/04-精神伤害骰盘停稳.jpg`
  - 截图：`evidence/山屋惊魂-头戴耳机精神减伤完整链路/05-头戴耳机减伤结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-头戴耳机精神减伤完整链路/06-关闭后回牌桌状态清空.jpg`
  - AI 核图：低清联系图 `temp/betrayal-radio-mental-reduction-full-chain-contact-lowres.jpg` 已确认六张图属于同一条头戴耳机精神减伤链，能看到头戴耳机持有区、选择未知房间、电话铃声翻出、精神伤害骰盘停稳、减伤结算和关闭后回牌桌。
  - 自审：目标明确为“头戴耳机是被动精神减伤，不是主动使用牌”。流程从真实持有区《头戴耳机》、真实探索按钮和真实未知房间目标起跑，不是直接注入精神伤害结果；E2E 同步断言头戴耳机规则摘要可见、事件牌《电话铃声》真实翻出并命中“受到一颗骰子的精神伤害”分支、伤害骰实际为 `[2]`、精神属性总和从 8 只降到 7（减 1 而不是减 2），知识为 3、神志为 4，发现面板关闭后 `discovery/event choice` 面板清空且牌桌动作栏可见。该链只证明物品《头戴耳机》的精神减伤能力，不外推盔甲物理减伤、头骨死亡保护、手电筒/灯笼加骰或其它物品能力。
- 手电筒/灯笼事件检定加骰真实页面六段链：
  - 命令：`npx eslint e2e\betrayal\event-choice-coverage.e2e.ts src\games\betrayal\scenarioConfig.ts`
  - 结果：通过。
  - 命令：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "手电筒" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`1 passed`。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "手电筒真实链路从外星几何翻牌到事件检定额外加骰结算关闭"`
  - 结果：`1 passed`。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "灯笼真实链路从外星几何翻牌到事件检定额外加骰结算关闭"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-手电筒事件检定加骰完整链路/01-手电筒加骰前牌桌可操作.jpg` 到 `06-关闭后回牌桌状态清空.jpg`。
  - 截图：`evidence/山屋惊魂-灯笼事件检定加骰完整链路/01-灯笼加骰前牌桌可操作.jpg` 到 `06-关闭后回牌桌状态清空.jpg`。
  - AI 核图：低清联系图 `temp/betrayal-flashlight-lantern-event-check-full-chain-contact-lowres.jpg` 已确认两行分别属于手电筒和灯笼同源加骰链，能看到各自持有区、选择未知房间、外星几何翻出、5 骰知识检定骰盘停稳、结算和关闭后回牌桌。
  - 自审：目标明确为“手电筒和灯笼是事件属性检定被动加骰，不是主动使用牌”。流程从真实持有区、真实探索按钮和真实事件牌《外星几何》起跑；E2E 对手电筒和灯笼分别断言持有区规则摘要可见、外星几何知识检定显示为 10、物理骰盘为 5 颗且 `data-dice-rule-subtotal=10`、知识从 3 升到 4，关闭后发现面板和事件选择面板清空且牌桌动作栏可见。同步修正 `lantern` 起始持有物中文名为“灯笼”，避免 UI 把两种对象都显示成“手电筒”。该链证明 `flashlight` 与 `lantern` 两个同源对象的事件检定加骰能力，不外推魔法相机替代检定、书本替代检定或其它物品能力。
- 待补链路：
  - 预兆、物品全家族、骰盘全家族和最终全量自审；事件牌当前数据合同 23/23 已逐张完整链通过，但不得外推成山屋全面完成。

### L4 治理证据

- 残余范围：见第 8 节。
- 通用端到端规范已补强：`docs/ai-rules/e2e-verification.md` 现在要求流程截图证据链按六段登记 `玩家实际动作 / 自动断言 / 截图文件 / 用户目标对应`，并要求滚动、选项尺寸、背景框、属性颜色、骰子重叠、效果触发等用户点名目标必须在同一条主链中被证明；同时新增“端到端结果必须回扣本轮问题”，要求测试名、断言、截图和 evidence 命中用户点名的现实结果。无弹层流程也必须证明临时选择/目标锁定清空和主牌桌继续可操作；缺列或缺段必须降级为待补完整链路。`docs/testing-best-practices.md` 也已同步把“完整流程 E2E”收紧为六段链，避免旧口径继续把“入口 -> 中间步骤 -> 结算”误写成完整端到端。
- 共享根因：待定位。
- 旧结论失效：事件牌阶段承接证据不得再升级为完整可玩性证据；已在专项工作流文档降级。

## 7. 禁止假阳性检查

- 是否误用 pending / 直接注入状态充当完整玩法：当前仍有残余，必须继续降级。
- 是否只证明按钮存在：待补 E2E 时必须避免。
- 是否只证明日志/文案出现：BTR-01 已补规则拒绝和真实页面负向链；BTR-03 已补真实页面点击链；BTR-02 已补底层、Board 回归和真实页面六段链；圣符探索声明已补真实声明/取消/重新声明/探索替换/事件结算/关闭回牌桌链；BTR-04 已补领域回归和真实页面六段链；BTR-06 已补急救包真实物品本体、地图目标、治疗结算和收口清理链；奇怪的药品已补真实物品本体、无需目标、治疗结算和收口清理链；BTR-07 已补真实物品本体、地图目标、确认、结算和收口清理链；狗远距交易已补多张持有物、4 格内队友 token、确认、结算和收口清理链；面具移动已补真实面具本体、同板块队友目标、相邻房间目标、移动结算和收口清理链；盔甲已补真实持有区规则、电话铃声翻出、物理伤害骰盘、减伤后属性变化和收口清理链；头戴耳机已补真实持有区规则、电话铃声翻出、精神伤害骰盘、减伤后属性变化和收口清理链；手电筒/灯笼已补真实持有区规则、外星几何翻出、5 骰知识检定骰盘、加骰后属性变化和收口清理链；骨制钥匙已补真实物品本体、移动模式、同层相邻未连门房间目标、穿墙移动结算和收口清理链；事件牌当前数据合同 23/23 已逐张完整链通过；预兆、物品全家族和骰盘全家族仍待补。
- 是否只证明骰子 DOM/canvas 存在但没有物理可读、不重叠和开放式承接：BTR-05 代表链已用真实 Three.js / dice-box canvas、专用 0/1/2 骰面、透明开放式骰区和多骰几何门禁验证；兔脚重掷链已补真实物品本体、骰子圆形命中区、重掷后骰面更新和状态消耗断言；剩余对象不得外推。

## 8. 共享根因与残余范围

- 共享根因项：已发现并修复 BTR-05 的两个骰盘根因：一是山屋多个物理骰盘实例共用同一 Three.js 调试键，且旧实例销毁时没有清理调试 registry；二是 4 颗骰子自然落定后仍可能中心塌缩，冻结采样前没有强制安全分散。当前普通投骰事件、砍刀攻击和兔脚重掷链均已通过，但骰盘全家族仍需独立登记。
- 对象级局部问题：驱魔失败死亡链已补领域回归和真实页面六段链；急救包、奇怪的药品、地图代表、兔脚重掷、头戴耳机精神减伤、手电筒/灯笼事件检定加骰和骨制钥匙穿墙移动等物品链已补真实页面六段链；同房间交易、狗远距交易、面具移动和盔甲物理减伤均已补真实页面六段链；其它骰盘分支仍待继续补证；haunt 禁探索真实页面负向链已补，圣符从翻出到作祟判定再关闭回牌桌的完整六段真实页面链已补，圣符探索声明也已补声明/取消/重新声明/探索替换/事件结算/关闭回牌桌六段链；事件牌当前数据合同 23/23 已逐张补齐完整链。
- 未审家族 / 未覆盖交互链：预兆、物品全家族、骰盘 UI / 骰盘全家族和最终全量自审；事件牌五个时序家族均已有真实翻牌完整链，但该结论不能外推到预兆、物品或骰盘全家族。
- 当前不能宣称整体收口的原因：尚未完成每个用户点名交互的 L3/L4 证据与真实截图自审。

## 9. 修订 / 失效记录

- 旧文档路径：`docs/games/betrayal/workflows/betrayal-playability-audit-2026-07-14.md`
- 旧结论：只建立事件牌家族清单并完成三条事件牌完整链路。
- 失效/降级原因：该旧结论不覆盖 haunt、圣符、驱魔、骰盘、物品、交易全量可玩性；当前文件已分对象更新，仍不得把已收口对象外推到预兆、物品全家族或骰盘全家族。
- 替代旧结论的新证据：当前事件牌完整链路已从三条扩展到当前数据合同 23/23 张逐张完整链。新增证据包含先选择属性再投检定的上古旧宅、夜幕众星；先投检定再选择后续效果的蜘蛛！、一条秘密通道、脑状食品；可选是否触发判定/作祟的肉质苔癣、一瓶微尘、大宅饿了、说“茄子”！、一抹鲜红；自动多属性检定后选择奖励的吊死鬼；以及 12 张投骰后直接结算事件牌的逐张六段截图。该结论只覆盖事件牌，不是山屋整体完成结论。

## 10. 对外汇报口径

- 允许说：当前已进入山屋可玩性全面重审计，已建立对象清单与 guard；haunt 阶段禁探索真实页面负向链已收口；当前数据合同 23/23 张事件牌已有从真实探索翻牌到关闭回牌桌的逐张完整证据，五个规则时序家族都已覆盖；圣符作祟判定从翻出到关闭回牌桌的六段真实页面链已收口；圣符探索声明已从声明、取消、重新声明、探索替换、事件结算到关闭回牌桌完成真实页面六段 E2E；驱魔失败伤害链已收口本对象；物品使用链已从急救包本体、地图队友目标、治疗结算到状态清空完成真实页面六段 E2E；交易链已从兔脚本体、地图队友目标、确认、结算到状态清空完成真实页面六段 E2E；狗远距交易已从狗交易物选择、4 格内队友 token 选择、确认、结算、清空状态完成真实页面六段 E2E；面具移动已从面具本体选择、同板块队友目标、相邻房间目标、确认移动、结算到清空状态完成真实页面六段 E2E；盔甲物理减伤已从盔甲持有规则、电话铃声翻出、物理伤害骰盘、减伤属性变化、关闭回牌桌完成真实页面六段 E2E；头戴耳机精神减伤已从头戴耳机持有规则、电话铃声翻出、精神伤害骰盘、减伤属性变化、关闭回牌桌完成真实页面六段 E2E；手电筒/灯笼事件检定加骰已从持有规则、外星几何翻出、5 骰知识检定骰盘、知识奖励结算、关闭回牌桌完成真实页面六段 E2E；骨制钥匙穿墙移动已从骨制钥匙本体、打开移动模式、穿墙目标房间、移动结算到清空状态完成真实页面六段 E2E；兔脚重掷链已从最近投骰、兔脚本体、具体骰子目标、重掷、结算更新到清空状态完成真实页面六段 E2E；骰盘 BTR-05 已完成普通投骰事件、砍刀攻击和兔脚重掷代表链，证明开放式透明物理骰盘、专用 0/1/2 骰面、多骰不重叠和真实骰子命中区。
- 禁止说：山屋已全面可玩、骰盘全家族已收口、全面审计完成。
