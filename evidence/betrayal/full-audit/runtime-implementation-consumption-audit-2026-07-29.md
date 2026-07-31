# 小黑屋实现消费审计启动记录（2026-07-29）

> 当前权威入口：`evidence/betrayal/full-audit/current-implementation-audit.md`。
> 本文件是实现消费证据索引和历史总账；继续任务时必须先读当前权威入口，再回到本文定位证据。
> 本文件只记录“当前实现是否消费已锁规则合同”的审计进度和发现。它不是数据重录、不是图包复核，也不宣称杰克/木乃伊/整牌库/全部房间已经完成。
> 当前 S0 / S1 / S2 合同续跑使用边界：本文件只作为**下游实现消费证据索引**，不能替代 `full-deck-data-intake-contract.md` 的 74 张对象全集，也不能作为本轮 Board/UI、E2E 或截图验收证据。文内提到的 E2E、截图和 Playwright 结果只说明已有下游材料的覆盖边界；除非用户另行授权，不得据此在当前合同续跑中继续跑 E2E、补截图或宣称端到端完成。

## 前提锁定

| 项 | 本轮口径 |
| --- | --- |
| 问题对象 | `src/games/betrayal` 山屋惊魂实现：木乃伊横行首剧本、74 张游戏牌、42 个房间、作祟公共规则与基础交互 |
| 真相来源 | 已落地合同与 evidence：`object-inventory.json`、`full-deck-scope-audit.md`、`full-deck-data-intake-contract.md`、`object-l0-l4-matrix.md`；本轮不重新 OCR / 查 Wiki / 补图包 |
| 目标入口/环境 | 当前工作区 `D:\gongzuo\webgame\BoardGame`，分支 `main`，实现入口为 `src/games/betrayal/**` |
| 验收口径 | 区分 `数量/atlas 已对齐`、`领域代表链已验证`、`UI 承接已验证`、`E2E/截图闭环`；不能把前两者说成整牌库完成 |

## 审计口径修订（2026-07-31）

本总账的主问题是“规则合同是否被实现正确消费”，不是穷举所有边界组合。后续所有残余必须先分三类再进入任务队列：

- `实现正确性阻塞`：规则子句未实现、玩家没有入口、合法动作无法完成、状态没有写入 / 清理，或已锁合同与当前实现冲突。
- `验证层级缺口`：实现和代表链存在，但还缺真实入口、截图、自然整局或负向 UI 证据；这会限制对外结论等级，但不等于功能本身未实现。
- `非阻塞扩展`：更多房间特殊状态、更多伤害来源、更多死亡保护 / 兔脚 / 减伤叠加、全部组合排列；除非它命中具体规则错误或用户反馈，否则不能作为当前下一步默认任务。

## 当前对象范围

- 房间：42 个，按 `object-inventory.json` 为 ground 18 / upper 14 / basement 10。
- 游戏牌：74 张，按当前运行池为事件 43 / 物品 22 / 预兆 9；数量已对齐，但 `full-deck-scope-audit.md` 明确仍是 `partial`。
- 当前首剧本：默认剧本卡是「木乃伊横行」，`scenarioConfig.ts` 中仅它是 `implemented`；其余 6 张候选剧本卡为 `contract-pending`。
- 当前持有物全集：34 个运行持有物，含官方 22 张物品、9 张预兆和首剧本/legacy alias。

## 已命中的基础机制

| 机制 | 实现消费结论 | 证据 |
| --- | --- | --- |
| 开局剧本卡选择 | 已有角色选择阶段的剧本卡提议、确认和开始校验；未实现剧本不能开始。 | `scenarioConfig.ts:461-550`；`game.ts:15573-15603`；`Board.tsx:6610-6618`；`Board.foundation.test.tsx:1191` |
| 属性提升不等于数值必变 | 当前属性走轨道位置，提升/扣减移动的是位置；重复数值格会出现位置变但显示值不变。 | `game.ts:3383`、`game.ts:3452`、`game.ts:10397`；`firstScenarioRuntime.test.ts` 中“属性提升移动属性轨夹子”本轮通过 |
| 作祟按全员当前预兆总数 | 领域层按所有探索者当前持有预兆求和，抽预兆时用该总数派生骰数，最多 8 骰，最后一张预兆自动作祟。 | `game.ts:8549`、`game.ts:8555`、`game.ts:11980`、`game.ts:15987` |
| 作祟风险进度条 | Board 常驻展示 `betrayal-haunt-risk-status` 和 `role="progressbar"`，带总预兆数、下次骰数、进度百分比。 | `Board.tsx:17397`、`Board.tsx:17421`；`Board.foundation.test.tsx:1399` |
| 新房间方向由探索玩家决定 | 探索 UI 有旋转选择，确认时提交 `orientationTurns`；领域校验非法朝向并按所选朝向放置。 | `game.ts:11596`、`game.ts:14281`、`game.ts:14329`、`game.ts:15730`；`Board.tsx:7322`、`Board.tsx:10508`、`Board.foundation.test.tsx:3270` |

## 木乃伊横行实现状态

| 子范围 | 当前结论 | 证据与限制 |
| --- | --- | --- |
| 默认剧本与 setup | setup 代表链存在，创建木乃伊、石棺、女孩和 0/2 知识进度；本轮领域测试该项通过。 | `firstScenarioRuntime.test.ts:4562`；`game.ts:20714` |
| 英雄线 | 实现中存在找真名、学驱逐法术、驱逐木乃伊命令与 reducer；领域代表链、Board 主动作代表链和真实入口 E2E / 截图链均已通过，覆盖第 1 知识标记、第 2 知识标记和英雄终局朗读 / 结果报告。 | `game.ts:15451-15496`、`game.ts:18491-18548`；修正用例 `firstScenarioRuntime.test.ts:4605`；`e2e/betrayal/mummy-rampage-hero-actions.e2e.ts` |
| 叛徒线 | 实现中存在拾起女孩、交给木乃伊、交圣符/指环和攻击奖励偷取；本轮修正旧夹具后，领域代表链和 Board 叛徒入口代表链均通过。 | `game.ts:15502-15542`、`game.ts:18548-18581`、`Board.tsx:9019-9059`；修正用例 `firstScenarioRuntime.test.ts:4683` |
| 强制关键预兆 | 领域链和真实入口 E2E / 截图链均已通过，覆盖英雄作祟后探索预兆房强制找「书本」，以及叛徒作祟后探索预兆房强制找「圣符」或「指环」。 | `game.ts:16237`；`firstScenarioRuntime.test.ts:5037`；`e2e/betrayal/mummy-rampage-forced-omen-draw.e2e.ts`；截图说明 `evidence/山屋惊魂-木乃伊强制关键预兆真实探索/e2e-test.md` |
| 木乃伊攻击奖励 UI | Board 已显示“造成伤害或偷取”选择，并能 dispatch `RESOLVE_MUMMY_ATTACK_REWARD`。 | `Board.tsx:16746-16776`；`Board.foundation.test.tsx:1737` |
| 剧本阅读与终局朗读 UI | 本轮已把剧本流程 E2E 从旧杰克断言迁移到木乃伊：公开揭示、英雄/叛徒分册、目标承接、英雄/叛徒终局朗读均通过真实入口 Playwright；英雄终局从 `endingHeroes` 正文读取，不再显示翻译 key。 | `e2e/betrayal/scenario-flow-new-rules.e2e.ts`；截图说明 `evidence/betrayal-scenario-flow-new-rules/e2e-test.md` |
| 完整完成度 | 开局剧本卡选择与木乃伊剧本阅读/终局朗读已有 Playwright 截图链；但不能宣称木乃伊全剧本自然长链、全卡牌或房间效果 E2E/截图闭环完成。 | `evidence/betrayal-core-interactions/scenario-card-selection/e2e-test.md`；`evidence/betrayal-scenario-flow-new-rules/e2e-test.md` |

## 卡牌与房间实现状态

| 范围 | 当前结论 |
| --- | --- |
| 事件 43 张 | 已进运行池并有一批代表分支、自动分支、房间目标合法性和部分 UI 证据；仍保留剩余分支、作祟特例、UI 承接和组合测试缺口。 |
| 物品 22 张 | 发现池数量对齐；神秘秒表、天使之羽、镜子、炸药、奇异护符、幸运硬币、牙齿项链、胸针等已有领域代表链或主动入口；本轮已把灰尘主动持有牌真实页面代表链扩到 11 张，骨制钥匙穿墙移动补到真实入口 E2E / 截图代表链，炸药补到 Board 页面组件目标态代表链，恐怖玩偶补到 Board 组件全骰选择代表链，幸运硬币补到 Board 组件空白骰选择代表链，牙齿项链补到 Board 组件选择 / 跳过代表链，胸针补到 Board 组件伤害分配代表链，补木乃伊强制伤害下不适用的真实入口 / 截图边界，补灰尘普通攻击非强制物理伤害下可用的真实入口 / 截图代表链，并补指环攻击非强制精神伤害下可用的真实入口 / 截图代表链；奇异护符补到 Board 摘要 / 日志代表链；但多张仍是 `partial-ui / partial-combo`。 |
| 预兆 9 张 | 逐卡领域证据与作祟公共规则代表链已存在；书本已有成本 / 用后禁用 Board 组件代表链，狗已有交易候选 / 同意结算 / 已用禁用 / 灰尘冲突 / 风险条刷新 Board 组件代表链；仍缺逐卡真实 Playwright / 截图、作祟揭示 UI、死亡/搜尸/探索组合。 |
| 房间 42 个 | 房间结构、探索旋转、发现文字效果、结束回合房间效果和神秘电梯有实现与测试入口；仍需按房间效果矩阵逐项区分“无显式效果房间”和“有触发效果房间”，不能只按 atlas/门位收口。 |

## 本轮验证

| 命令 | 结果 | 结论 |
| --- | --- | --- |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/Board.foundation.test.tsx --config vitest.config.core.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "角色选择阶段展示七张\|房间放置\|作祟风险\|木乃伊横行"` | 1 文件通过；4 passed / 128 skipped；进程尾部有既有 `ECONNRESET` 噪声但退出码为 0 | 页面代表链仍成立 |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts --config vitest.config.core.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "设置阶段必须从七张\|木乃伊横行\|当前 9 张预兆\|当前 22 张物品\|当前运行持有牌均登记灰尘交叉规则分类\|属性提升\|作祟风险\|交易转移预兆\|抽到新预兆\|作祟检定按全员\|普通预兆触发作祟\|抽到最后一张预兆\|房间文字\|倒塌房间\|神秘电梯"` | 修正测试基线后通过；1 文件，43 passed / 646 skipped | 领域代表链恢复为可用审计门禁 |
| `npx eslint e2e/betrayal/scenario-card-selection.e2e.ts` | 通过；0 errors | 剧本选择 E2E 断言文件静态检查通过 |
| `node scripts/infra/run-e2e-single.mjs default e2e/betrayal/scenario-card-selection.e2e.ts` | 通过；1 passed。运行器先提示 shared-single runtime 端口复用失败并自动回退 isolated runtime，最终 Playwright 退出码为 0 | 真实 `/play/betrayal` 入口已保护七张候选、木乃伊可开局、杰克待接入不能开局 |
| `node --max-old-space-size=8192 node_modules/eslint/bin/eslint.js src/games/betrayal/Board.tsx e2e/betrayal/basic-flow.e2e.ts e2e/betrayal/scenario-card-selection.e2e.ts` | 通过；0 errors | Board 与两条入口 E2E 静态检查通过 |
| `node scripts/infra/run-e2e-single.mjs default e2e/betrayal/basic-flow.e2e.ts "从角色选择确认到恶兆前运行时"` | 通过；1 passed | PC 基本流程已从木乃伊默认剧本、七张候选、完整阅读进入恶兆前牌桌 |
| `node scripts/infra/run-e2e-single.mjs default e2e/betrayal/basic-flow.e2e.ts "移动端横屏角色选择包含竖向滚动、选中态和能力提示"` | 通过；1 passed | 移动横屏基本流程已从木乃伊默认剧本进入完整阅读；长正文可滚动到达底部 |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts --config vitest.config.core.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "木乃伊.*终局读模型\|首剧本英雄终局读模型\|终局读模型在作祟未完成"` | 通过；1 文件，4 passed / 687 skipped | 木乃伊英雄/叛徒终局读模型已标记 If You Win 正文可用；仍保留“代表作祟终局读模型，不代表 50 个作祟终局全部完成” |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/Board.foundation.test.tsx --config vitest.config.core.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "木乃伊.*终局朗读\|能渲染首剧本真实终局屏\|灰尘终局朗读"` | 通过；1 文件，4 passed / 130 skipped；进程尾部有既有 `ECONNRESET` 噪声但退出码为 0 | 木乃伊英雄/叛徒终局朗读显示正文，不显示翻译 key；灰尘终局路径未被打坏 |
| `node --max-old-space-size=8192 node_modules/eslint/bin/eslint.js src/games/betrayal/game.ts src/games/betrayal/Board.tsx src/games/betrayal/__tests__/firstScenarioRuntime.test.ts src/games/betrayal/__tests__/Board.foundation.test.tsx e2e/betrayal/scenario-flow-new-rules.e2e.ts` | 通过；0 errors；`game.ts` 保留 5 个既有 unused warnings | 本轮改动文件无 ESLint error；未把既有 warning 当作本轮修复范围 |
| `node scripts/infra/run-e2e-single.mjs default e2e/betrayal/scenario-flow-new-rules.e2e.ts` | 通过；2 passed。运行器先提示 shared-single runtime 端口复用失败并自动回退 isolated runtime，最终 Playwright 退出码为 0 | 木乃伊公开揭示、分阵营阅读、目标承接、英雄/叛徒结局朗读真实入口截图链通过 |
| `node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/non-p0-representative.e2e.ts "十字弓相邻攻击代表链"` | 通过；1 passed。shared runtime 端口复用失败后自动回退 isolated runtime，最终 Playwright 通过 | 十字弓按当前合同走同板块 / 相邻攻击；真实页面选中十字弓后相邻叛徒 token 高亮，且没有视线连线 |
| `node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/non-p0-representative.e2e.ts "无武器攻击真实链路"`、`"砍刀攻击武器代表链"`、`"指环神志攻击真实链路"`、`"匕首攻击真实链路"`、`"攻击武器禁用原因真实链路"` | 均通过；各 1 passed | 徒手、砍刀、指环、匕首和武器禁用原因代表链在当前树可从真实页面走到目标 / 投骰 / 伤害或禁用反馈 |
| `npx eslint e2e/betrayal/non-p0-representative.e2e.ts src/games/betrayal/testing/firstScenarioTestUtils.ts src/games/betrayal/game.ts` | 通过；0 errors；`game.ts` 仍保留既存 unused warnings | 攻击代表链 E2E、首剧本夹具和运行时旧函数名修复无 ESLint error |
| `npx eslint src/games/betrayal/testing/firstScenarioTestUtils.ts` | 通过；0 errors | 灰尘作祟测试夹具修正无 ESLint error |
| `npx tsx -e "import { createDustHauntCore } from './src/games/betrayal/testing/firstScenarioTestUtils.ts'; ..."` | 返回 `{"phase":"haunt","hasDust":true,"pendingEventChoice":false,"room":"厨房"}` | 夹具能稳定从事件房《厨房》抽到《一瓶微尘》，并收口到灰尘作祟运行态 |
| `$env:NODE_OPTIONS='--max-old-space-size=8192'; npx eslint src/games/betrayal/Board.tsx e2e/betrayal/the-dust-active-possession-ui.e2e.ts e2e/betrayal/betrayalTestHelpers.ts` | 通过；0 errors | 本轮补入的天使之羽页面数字选择、E2E 断言和灰尘主动持有牌夹具扩展无 ESLint error。 |
| `node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/the-dust-active-possession-ui.e2e.ts` | 通过；8 passed。运行器先提示 shared-single runtime 端口复用失败并自动回退 isolated runtime，最终 Playwright 通过 | 灰尘主动持有牌 UI 代表链扩到 11 张：入口全集、急救包 / 奇怪的药品 / 镜子治疗、地图类房间目标、神秘秒表额外行动、天使之羽 0-8 数字选择、书本、面具均能从真实页面走通 |
| `node --max-old-space-size=8192 ./node_modules/eslint/bin/eslint.js src/games/betrayal/Board.tsx src/games/betrayal/__tests__/Board.foundation.test.tsx`；`Board.foundation.test.tsx -t "炸药\|十字弓\|枪\|砍刀"`；`firstScenarioRuntime.test.ts -t "炸药"` | ESLint 0 errors；组件代表链 4 passed / 131 skipped；领域代表链 8 passed / 686 skipped | 炸药从“只有领域、UI 目标选择未补”更新为“领域 + Board 页面组件目标态代表链”：主动作自动选中炸药、当前 / 相邻已发现房间高亮、点击房间板块派发炸药攻击；仍未证明真实 Playwright / 截图链或全部怪物 / 作祟组合 |
| `npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "胸针"`；`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "胸针"`；`node --max-old-space-size=8192 ./node_modules/eslint/bin/eslint.js src/games/betrayal/Board.tsx src/games/betrayal/__tests__/Board.foundation.test.tsx`；`npm run test:e2e:file -- e2e/betrayal/the-dust-ordinary-attack-death.e2e.ts`；`node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/non-p0-representative.e2e.ts "胸针精神伤害真实链路"` | 组件代表链 1 passed / 136 skipped；领域代表链 6 passed / 688 skipped；ESLint 0 errors；灰尘普通攻击整文件 2 passed；指环攻击胸针精神伤害真实链路 1 passed | 胸针从“只有领域、UI 伤害改写未补”更新为“领域 + Board 组件伤害分配代表链 + 非强制物理伤害真实入口 + 非强制精神伤害真实入口”：物理 / 精神伤害分配页出现胸针开关，开启后改为通用伤害并提交 `useBrooch: true`；木乃伊强制速度/力量伤害真实入口已证明胸针不适用；灰尘普通攻击真实入口已证明非强制物理伤害可开启胸针并改为通用伤害；指环攻击真实入口已证明非强制精神伤害可开启胸针并改为通用伤害；仍未证明全部伤害来源、减伤叠加、死亡保护或作祟伤害组合 |
| `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "奇异护符"`；`npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "持有物卡片会暴露"`；`node --max-old-space-size=8192 ./node_modules/eslint/bin/eslint.js src/games/betrayal/Board.tsx src/games/betrayal/game.ts src/games/betrayal/__tests__/Board.foundation.test.tsx src/games/betrayal/__tests__/firstScenarioRuntime.test.ts scripts/games/betrayal/generate-full-audit-matrix.mjs` | 领域链 12 passed / 682 skipped；组件链 1 passed / 136 skipped，尾部有既有 `ECONNRESET` 噪声但退出码为 0；ESLint 0 errors、5 个既有 warning | 奇异护符从“领域已生效但 UI/日志提示缺口”更新为“领域 + Board 摘要 / 日志代表链”：持有区摘要明示实际承受物理伤害后 +1 神志，物理伤害分配日志显示“奇异护符使神志 +1”；仍未证明真实 Playwright / 截图链、减伤、死亡保护或作祟物理伤害组合 |
| `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "书本"`；`npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "书本\|真实 reducer 驱动下可以使用物品"`；`node --max-old-space-size=8192 ./node_modules/eslint/bin/eslint.js src/games/betrayal/game.ts src/games/betrayal/Board.tsx src/games/betrayal/__tests__/Board.foundation.test.tsx src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` | 领域链 13 passed / 682 skipped；组件链 2 passed / 136 skipped，尾部有既有 `ECONNRESET` 噪声但退出码为 0；ESLint 0 errors、5 个既有 warning | 书本从“濒死神志边界和用后禁用未补”更新为“领域成本门禁 + Board 组件代表链”：神志临界时不可免费写入非战斗替代状态，页面可展示神志不足原因；使用后再次选中显示本回合已用并禁用按钮。仍未证明真实 Playwright / 截图链、更多非战斗检定、房间检定、作祟特殊行动和替代 / 重掷组合。 |
| `npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "狗"`；`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "交易转移预兆\|狗每回合\|交易卡状态\|狗交易沿用"`；`node --max-old-space-size=8192 ./node_modules/eslint/bin/eslint.js src/games/betrayal/__tests__/Board.foundation.test.tsx` | Board 组件链 4 passed / 135 skipped；领域链 4 passed / 691 skipped；ESLint 0 errors；Board 组件测试尾部仍有既有 `ECONNRESET` 噪声但退出码为 0 | 狗从“领域已有但交易 UI / 风险条刷新未补”更新为“领域 + Board 组件代表链”：候选区可选多张、4 格目标高亮、同意结算、已用牌禁用原因、灰尘交换疾病入口不抢占、狗交易预兆后风险条仍按全员预兆总数显示。同步修正 Board 灰尘测试夹具，使其明确从事件房间触发《一瓶微尘》；仍未证明真实 Playwright / 截图链、死亡掉落、搜尸或全部作祟状态组合。 |

## 当前发现

| 严重级别 | 发现 | 现实影响 | 证据 | 建议 |
| --- | --- | --- | --- | --- |
| 已修正 | 领域测试基线有旧断言：神秘秒表、天使之羽已经接入主动效果，但“当前 22 张物品牌均登记真实能力入口”曾期望它们 `activeUseMode: null`。 | 修正前会把已实现能力误报为失败，阻塞后续把物品能力矩阵作为回归门禁。 | `possessionEffects.ts:98-104`；原失败断言 `firstScenarioRuntime.test.ts:2764`；对应领域补证 `firstScenarioRuntime.test.ts:24823`、`firstScenarioRuntime.test.ts:24880` | 已把矩阵期望同步为 `extraTurnAfterTurnEnd` 和 `nextNonCombatTraitRollTotalReplacement`；仍保留 `partial-ui / partial-combo` 缺口，不说全完成。 |
| 已修正 | 两条「木乃伊横行」领域链测试仍调用 `createCrimsonJackHauntCore()`，导致运行态不是木乃伊。 | 修正前不能用这两条测试判断木乃伊实现是否通过。 | 夹具定义 `firstScenarioTestUtils.ts:467-473`；原失败用例 `firstScenarioRuntime.test.ts:4605`、`firstScenarioRuntime.test.ts:4683` | 已改用 `createFirstScenarioHauntCore()`，同组领域回归复跑通过。 |
| 已修正 | 真实入口 E2E 仍保护旧口径：五张候选、「赤红杰克归来」为 implemented，并把确认杰克后进牌桌当作通过。 | 修正前 Playwright 会把旧规则当成回归保护，无法证明当前默认首剧本「木乃伊横行」生效。 | `e2e/betrayal/scenario-card-selection.e2e.ts`；新截图 `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\scenario-card-selection\01-七张剧本卡候选.jpg`、`D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\scenario-card-selection\02-待接入剧本卡不能开始.jpg`、`D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\scenario-card-selection\03-确认木乃伊横行后进入牌桌.jpg` | 已改为七张候选、木乃伊当前提议/implemented、杰克待接入/contract-pending；E2E 复跑通过，旧截图仅保留为历史记录。 |
| 已修正 | 基本流程 E2E 仍保护旧口径：入口期待「赤红杰克归来」、候选数 5，并读取杰克之灵/驱魔法阵页面。 | 修正前“基本流程”会在当前真实入口直接失败，且即使旧断言通过也只能证明历史杰克流程，不证明当前木乃伊首剧本。 | 首次复跑失败在 `basic-flow.e2e.ts:122`，页面实际文本为「木乃伊横行」；新截图 `D:\gongzuo\webgame\BoardGame\evidence\betrayal-basic-flow\02a-山屋惊魂-基本流程-剧本弹窗入口.jpg`、`D:\gongzuo\webgame\BoardGame\evidence\betrayal-basic-flow\02b-山屋惊魂-基本流程-书本式剧本阅读首页.jpg`、`D:\gongzuo\webgame\BoardGame\evidence\betrayal-basic-flow\02d-山屋惊魂-基本流程-书本式剧本阅读末页.jpg`、`D:\gongzuo\webgame\BoardGame\evidence\betrayal-basic-flow\09a-山屋惊魂-移动端横屏-剧本弹窗入口.jpg`、`D:\gongzuo\webgame\BoardGame\evidence\betrayal-basic-flow\09b-山屋惊魂-移动端横屏-书本式剧本阅读首页.jpg`、`D:\gongzuo\webgame\BoardGame\evidence\betrayal-basic-flow\09d-山屋惊魂-移动端横屏-书本式剧本阅读末页.jpg` | 已迁移为木乃伊、七张候选、完整规则书阅读；PC 与移动横屏各 1 条真实入口 E2E 通过。 |
| 已修正 | 开局“阅读完整剧本”的 `all` 范围只保留公共段落，木乃伊的英雄/叛徒/怪物/结局正文会被过滤掉。 | 修正前如果只把 E2E 从杰克改成木乃伊，会出现“完整阅读”只显示公开揭示、后续书页缺正文的假通过风险。 | `Board.tsx` 中 `isScenarioSectionVisibleForScope(scope === "all")`；复跑 `basic-flow.e2e.ts` PC/移动两条均通过 | 已改为 `all` 范围包含全部分册；作祟后仍由 `heroes/traitor` scope 按身份过滤秘密页。 |
| 已修正 | 终局读模型只把灰尘标为 If You Win 正文可用，木乃伊虽然已有本地剧本正文，终局来源状态仍会降级。 | 修正前木乃伊终局会被误标为缺正文，影响结局朗读来源说明。 | `game.ts` 中 `resolveBetrayalEndgameReadModel()`；新增 `firstScenarioRuntime.test.ts` 两条木乃伊终局读模型测试 | 已让木乃伊英雄/叛徒终局读模型标记正文可用；仍明确不代表全部作祟终局政策完成。 |
| 已修正 | 终局朗读 UI 对幸存者胜利统一拼 `endingSurvivors`，但木乃伊剧本正文 key 是 `endingHeroes`。 | 修正前页面把 `board.haunts.mummyRampage.reader.endingSurvivors` 翻译 key 当正文显示，即使来源状态显示“官方 If You Win 原文”。 | 首次 E2E 失败：幸存者终局收到翻译 key；修复点 `Board.tsx` 的 `resolveEndgameNarrationSectionId()`；`Board.foundation.test.tsx` 和 `scenario-flow-new-rules.e2e.ts` 复跑通过 | 已按剧本实际 section 映射终局正文；灰尘等使用 `endingSurvivors` 的作祟路径保持原行为。 |
| `disputed / representative-only` | 木乃伊旧版剧本合同触发示例依赖「女孩」，但当前 74 张牌库合同的 9 张预兆为书本、狗、面具、头骨、圣符、盔甲、雕像、指环、匕首，不含「女孩」。 | 当前运行态能代表性进入木乃伊剧本，但不能声明“木乃伊触发牌完全匹配旧版规则书”。把测试硬改回女孩会和当前牌库合同冲突；把女孩补入牌库也不能在实现审计阶段擅自做。 | 旧版木乃伊合同 `docs/games/betrayal/haunts/01-mummy-rampage.md`；当前预兆全集 `full-deck-data-intake-contract.md` 第 5 节；E2E 公开揭示图显示「触发 书本」 | E2E 现在断言真实运行触发牌「书本」，并把版本冲突保留为 `disputed / representative-only`；后续需要数据录入/版本裁定后再决定是否引入女孩或改剧本触发表。 |
| 已修正 | 旧攻击 E2E 把十字弓当成视线武器，且多个攻击代表链硬编码玩家 2 为叛徒。 | 修正前会把错误规则口径写进截图和审计；在木乃伊 / 杰克夹具下真实叛徒不是固定玩家 2 时，攻击目标断言会偏离真实剧本状态。 | 当前合同 `full-deck-data-intake-contract.md` 已锁“枪走视线、十字弓走同板块 / 相邻”；实现中 `LINE_OF_SIGHT_ATTACK_WEAPON_CARD_IDS` 仅枪，`ADJACENT_ROOM_ATTACK_WEAPON_CARD_IDS` 含十字弓；E2E 已改为读取真实 `traitorPlayerId` | 十字弓代表链改为相邻攻击且不画视线线；徒手、砍刀、指环、匕首和武器禁用原因按真实叛徒复跑通过。旧 `evidence/山屋惊魂-弩远程视线完整链路/` 降级为历史旧口径。 |
| 已修正 | 灰尘主动持有牌 E2E 的旧夹具只指定《一瓶微尘》事件牌顺序，没有指定新房间必须是事件房；当前一层默认先翻“观测台”抽预兆，导致探索后既没有事件选择，也没有 dust 运行态。 | 修正前会把主动持有牌 UI 链路全部挡在前置夹具构造处，容易被误报成“页面功能没实现”。 | 失败命令 `node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/the-dust-active-possession-ui.e2e.ts` 首轮 5 failed，错误为“山屋灰尘作祟夹具未生成事件选择或 dust 运行态”；修复点 `firstScenarioTestUtils.ts` 的 `createDustHauntCore()` 固定厨房事件房并按是否存在 `pendingEventChoice` 响应 | 已验证 `createDustHauntCore()` 进入灰尘作祟；同一 E2E 本轮扩到 8 passed / 11 张主动持有牌代表链；当前不证明整物品牌、整预兆牌或全卡牌能力完成。 |
| 已修正 | 天使之羽领域层已经要求 `replacementRollTotal` 为 0-8 整数，但 Board 原使用持有牌 payload 没有正式数字选择，也不会把选择值发给运行时。 | 修正前玩家即使在页面选中天使之羽，也无法完成符合规则的使用链；这属于实现消费缺口，不是数据录入缺口。 | 规则合同 `full-deck-data-intake-contract.md` I21；运行时校验 `game.ts` 的 `USE_POSSESSION.replacementRollTotal`；修复点 `Board.tsx` 新增替代结果选择状态、0-8 按钮、缺选择禁用原因和 payload；E2E 截图 `D:\gongzuo\webgame\BoardGame\evidence\betrayal-the-dust-active-possession-ui\14-天使之羽选择替代投骰结果.jpg`、`15-天使之羽使用后保留替代总点数.jpg` | 已验证 E2E 8 passed；当前只证明天使之羽真实页面代表链，不证明攻击/作祟边界、额外骰裁定和所有属性检定组合完成。 |
| 已修正 | 牙齿项链结束回合选择面板的“跳过”按钮被通用拒绝门控误禁用，要求玩家先选属性才能跳过。 | 修正前会把规则允许的“可以不恢复、直接结束回合”做成不可点，属于实现消费缺口，不是录入合同缺口。 | 规则合同 `full-deck-data-intake-contract.md` I08；运行时选择类型 `tooth-necklace-end-turn`；修复点 `Board.tsx` 放行牙齿项链的拒绝动作；组件测试 `Board.foundation.test.tsx -t "牙齿项链"` 和领域测试 `firstScenarioRuntime.test.ts -t "牙齿项链"` | 当前已补 Board 组件选择 / 跳过代表链；仍不证明真实 Playwright / 截图链、作祟回合、房间回合末或死亡保护组合完成。 |
| 已修正 | 胸针领域层已经能把物理 / 精神伤害改成通用伤害，但 Board 原伤害分配面板没有给玩家声明胸针的入口，也不会发送 `useBrooch: true`。 | 修正前玩家页面只能按原物理 / 精神属性分配，无法消费已锁合同里的“可以替换为通用伤害”；这属于实现消费缺口，不是录入合同缺口。 | 规则合同 `full-deck-data-intake-contract.md` I12；运行时选择字段 `RESOLVE_DAMAGE_ALLOCATION.useBrooch`；修复点 `Board.tsx` 增加胸针开关、通用伤害属性集合和 `useBrooch` payload；组件测试 `Board.foundation.test.tsx -t "胸针"`、领域测试 `firstScenarioRuntime.test.ts -t "胸针"`、灰尘普通攻击真实入口 `the-dust-ordinary-attack-death.e2e.ts -g "防御方持有胸针时"`、指环攻击真实入口 `non-p0-representative.e2e.ts -g "胸针精神伤害真实链路"` | 当前已补 Board 组件伤害分配代表链，补木乃伊强制伤害下不适用的真实入口 / 截图边界，补灰尘普通攻击非强制物理伤害下可用的真实入口 / 截图链，并补指环攻击非强制精神伤害下可用的真实入口 / 截图链；仍不证明更多伤害来源、减伤叠加、死亡保护或作祟伤害组合完成。 |
| 中 | 当前审计证据已有开局剧本选择与木乃伊剧本阅读/结局 E2E 截图链，但尚未形成木乃伊全剧本自然长链 + 全卡牌 + 房间效果的 Playwright E2E 截图闭环。 | 不能打开全剧本验收图，也不能宣称“端到端完成”。 | `evidence/betrayal-core-interactions/scenario-card-selection/e2e-test.md` 覆盖开局剧本选择；`evidence/betrayal-scenario-flow-new-rules/e2e-test.md` 覆盖剧本阅读/终局朗读；二者仍不覆盖全牌库与全部房间效果。 | 继续按事件/物品/预兆 UI、作祟揭示组合、房间效果矩阵、木乃伊中段操作链各自补真实入口 E2E。 |

## 实现审计第一轮（2026-07-29 续跑）

> 本节回答“现在是否可以开始审实现”：可以。前提已锁定，且当前不需要重新录入数据或回卡图；本轮只消费已有合同、实现、测试和 evidence。以下结论来自 `object-inventory.json`、`object-l0-l4-matrix.md`、`full-deck-data-intake-contract.md` 与 `src/games/betrayal/**` 的静态交叉检查。

| 审计面 | 当前实现消费判断 | 不能外推的事项 | 下一步审计入口 |
| --- | --- | --- | --- |
| 对象全集 | 当前运行对象数已锁：事件 43、物品 22、预兆 9、房间 42、首剧本对象 17；本轮新增的是首剧本规则对象「强制找出关键预兆」，不是新增牌库数量。 | 数量/atlas 对齐不等于机制、UI、组合和 E2E 已闭合。 | 继续按对象矩阵逐项审 L2-L4，而不是重录 S0 数据。 |
| 43 张事件 | 旧 23 张多数已有普通投骰/可选作祟/选择属性等 family 代表链；6.12 已把 20 张新增或复杂事件拆成 `partial / min-verified` 缺口桶。 | `partial` 事件不能因为能进运行池就判通过；尤其伤害/死亡保护组合、房间目标候选 UI、作祟特例和脚注/音频仍未闭合。 | 先审 6.12 点名的事件缺口桶：不可能的房间、地狱蝙蝠、断手、怪异的镜子、花团锦簇、晦暗暴风夜、技术难点、佳馔满桌、禁忌知识、可怜的尤里克、轮到约拿了、秘密升降机、神秘液体、游魂、无线电广播、摇曳灯光、一罐器官、一声呼救、着火的人等。 |
| 22 张物品 | `game.ts` 与领域测试已覆盖武器、重掷、治疗、伤害改写、减伤、额外行动、炸药、天使之羽、牙齿项链等消费者；本轮攻击桶已补当前规则代表链：枪 / 幻影摄影师承担视线，十字弓承担同板块 / 相邻，砍刀代表链复跑通过；灰尘主动持有牌 E2E 已补急救包、奇怪的药品、镜子、地图及三张 alias、神秘秒表、天使之羽的真实页面代表链；骨制钥匙当前树已补穿墙移动 UI / E2E / 截图代表链；炸药当前树已补 Board 组件目标态代表链；恐怖玩偶当前树已补 Board 组件全骰选择代表链；幸运硬币当前树已补 Board 组件空白骰选择代表链；牙齿项链当前树已补 Board 组件选择 / 跳过代表链；胸针当前树已补 Board 组件伤害分配代表链，补木乃伊强制伤害下不适用的真实入口 / 截图边界，补灰尘普通攻击非强制物理伤害下可用的真实入口 / 截图链，并补指环攻击非强制精神伤害下可用的真实入口 / 截图链；奇异护符当前树已补持有区摘要和物理伤害分配日志代表链；`possessionEffects.ts` 只承接部分主动使用牌，不是全部物品能力入口。 | 多数物品仍是 `partial-ui / partial-combo`：只有领域或组件 / E2E 代表链，不能宣称逐物品 UI 和组合验证完成；炸药真实 Playwright / 截图链、非法原因展示、重掷、死亡保护、地图移动空间组合、骨制钥匙墙体 / 门位 / 作祟地图组合，以及恐怖玩偶真实 Playwright / 截图链、作祟特殊行动属性检定通用回滚快照和更多重掷消费者组合，幸运硬币真实 Playwright / 截图链、作祟特殊行动、死亡保护和更多伤害分配组合，胸针更多伤害来源、减伤叠加、死亡保护 / 作祟伤害组合，奇异护符真实 Playwright / 截图、减伤、死亡保护和作祟物理伤害组合，牙齿项链真实 Playwright / 截图、作祟回合、房间回合末、死亡保护组合仍未全闭合，镜子 / 神秘秒表 / 天使之羽 / 骨制钥匙 / 炸药 / 恐怖玩偶 / 幸运硬币 / 牙齿项链 / 胸针 / 奇异护符也只补到代表链。 | 继续审 6.13 / 6.46 / 6.47：治疗/恢复、地图/移动、伤害改写、重掷、额外行动和炸药等跨消费者桶。 |
| 9 张预兆 | 书本、狗、面具、头骨、圣符、盔甲、雕像、指环、匕首均已有领域级最小证据或 family 承接；书本另有临界神志成本和用后禁用 Board 组件代表链；狗另有交易候选、4 格目标、同意结算、已用禁用、灰尘冲突和风险条刷新 Board 组件代表链；面具另有同板块队友 / 怪物分别选择相邻板块 Board 组件代表链；头骨另有死亡保护 3 骰骰盘、4+ 阻止死亡和头骨反馈 Board 组件代表链，并已补木乃伊攻击致死伤害触发头骨、成功阻止死亡和失败正常死亡的真实入口 E2E / 截图链；圣符 / 雕像另有探索声明、连续事件房间和刚获得限制 Board 组件代表链；盔甲另有伤害分配页原始伤害、盔甲减免和实际分配数 Board 组件代表链，并已补木乃伊攻击这一条真实入口 E2E / 截图链；作祟公共规则也已有全员预兆数、8 骰上限和最后一张自动作祟领域证据。 | 预兆仍停在 `min-domain-verified / partial-ui`：书本、狗、面具、圣符、雕像仍缺真实 Playwright / 截图；头骨只补到木乃伊攻击这一条真实入口，仍缺兔脚重掷和更多致死来源；盔甲只补到木乃伊攻击这一条真实入口，仍缺更多消费者；逐卡组合、死亡/搜尸/攻击组合、作祟揭示 UI 没有全闭合。 | 先审 6.14：逐卡 UI/组合与作祟公共规则 UI/组合分开审，不能把 9 张数量正确或书本/狗/面具/头骨/圣符/盔甲/雕像代表链当完成。 |
| 42 个房间 | 房间结构、探索旋转、发现属性加点、房间抽牌、障碍、固定连接、结束回合伤害/移动、神秘电梯均有领域或代表 UI 证据。 | 仍不能只按 atlas、门位、楼层判房间完成；带效果房间必须独立审触发、结算、清理、负向断言和玩家可见结果。 | 先补房间效果矩阵：无显式效果房间与礼拜堂/书房/图书馆/体育馆/储物间、器械库、火炉房、倒塌房间、洗衣滑槽、杂物间、神秘电梯等分开。 |
| 木乃伊横行 | setup、英雄线、叛徒线、强制关键预兆、木乃伊攻击奖励、阅读/终局朗读均有领域或代表 UI 证据；终局正文 key 问题已修正；当前已补木乃伊英雄行动真实入口 E2E / 截图链，覆盖寻找真名、学习驱逐法术和驱逐木乃伊进入英雄终局；已补木乃伊叛徒行动真实入口 E2E / 截图链，覆盖拾起女孩、交女孩、交出圣符进入叛徒终局，并覆盖指环分支；已补木乃伊怪物行动真实入口 E2E / 截图链，覆盖移动骰 0 和 1 瞬移女孩房间、移动模式“只限已发现房间 / 不能探索新房间”提示与未发现房间无目标框、已持女孩和圣符时移动回石棺触发叛徒终局、同房必须先攻击、同房攻击目标过滤、攻击后偷走地图、偷走圣符、偷走指环、夺走女孩、攻击后移动恢复、攻击奖励选择造成伤害后进入受伤英雄的木乃伊攻击伤害分配页并实际扣属性轨道格回到牌桌、木乃伊攻击这一条盔甲减伤真实入口、木乃伊攻击致死伤害触发头骨后的成功阻止死亡和失败正常死亡真实入口，以及木乃伊攻击头骨失败后的兔脚重掷阻止死亡真实入口；无可偷物品、预兆或女孩时直接进入强制伤害分配的领域 + Board 代表链已补；失效偷取目标拒绝和玩家可见提示的领域 + Board 代表链已补；0/1 移动跨楼层已发现房间目标与未发现房间拒绝领域代表链已补；已补强制关键预兆真实探索 E2E / 截图链，覆盖英雄找书本和叛徒找圣符。 | 中段自然长链仍未完全证明，所以不能说端到端完成；更多伤害来源减伤 / 死亡保护 / 兔脚组合和更多房间特殊状态组合归为非阻塞扩展，只有命中具体规则错误时才升级。 | 下一步不应默认继续补组合穷举；应先按规则子句表找真正的实现消费阻塞，或把自然整局链列为验证层级补证。 |

本轮审计结论：可以进入实现消费审计，但当前状态仍是“数据和一批领域/Board/局部真实入口代表链可消费，整游戏完成口径未收口”。下一步应优先按规则子句表找 `实现正确性阻塞`：预兆逐卡 UI 入口缺失、物品效果没有玩家入口、事件分支没有写入最终状态、房间效果未被消费等；`更多组合` 和自然整局链先登记为验证层级缺口或非阻塞扩展，不再作为默认推进主线。

## 同类扩审记录（2026-07-29 续跑）

| 项 | 本轮实际范围 |
| --- | --- |
| 搜索范围 | `object-inventory.json`、`object-l0-l4-matrix.md`、`full-deck-data-intake-contract.md`、`runtime-implementation-consumption-audit-2026-07-29.md`、`scenarioConfig.ts`、`game.ts`、`Board.tsx`、`possessionEffects.ts`、`firstScenarioRuntime.test.ts`、`Board.foundation.test.tsx` |
| 根因关键词 | `partial`、`partial-ui`、`partial-combo`、`downstream-open`、`representative-only`、`family 判等`、`L2 已覆盖`、`L3 代表链`、`作祟特例`、`UI 承接`、`组合测试` |
| 横向搜索命中 | 事件缺口桶、物品缺口桶、预兆逐卡缺口、作祟公共规则缺口、房间效果独立审计缺口、木乃伊中段真实入口缺口均仍存在；旧矩阵对部分对象使用了过宽的 “L2 已覆盖 / family 代表链” 口径。 |
| 已修订的共享调用点 | `scripts/games/betrayal/generate-full-audit-matrix.mjs` 已接入事件、物品、预兆和房间效果缺口桶；重新生成 `object-l0-l4-matrix.md` 后，矩阵会把下游开放项显式标成 `downstream-open`，并把带效果房间标成“房间效果需独立审计”。 |
| 残余扩审范围 | 机器化矩阵当前暴露 43 个 `downstream-open` 下游开放项和 11 个房间效果独立审计项；这些是后续实现/UI/E2E 审计队列，不是完成口径。 |
| 漏审归因 | 旧证据把“对象已录入 / 运行池已接入 / 领域代表链存在”与“逐对象 UI、组合、真实入口已闭合”混在同一矩阵行里，导致用户追问的卡牌、房间和剧本中段实现缺口容易被代表链掩盖。 |
| 当前修复边界 | 前序修订已收敛审计证据和机器化矩阵口径；本轮新增皮夹克 Board 组件代表链，只证明攻击复盘 UI 已消费防御额外骰，不证明全部物品、怪物攻击、作祟攻击、真实 Playwright / 截图或全组合完成。 |

## 事件牌效果专项审计入口（2026-07-29 续跑）

| 项 | 当前状态 |
| --- | --- |
| 专项文档 | `evidence/betrayal/full-audit/event-effect-implementation-audit-2026-07-29.md` |
| 覆盖对象 | 43 张官方事件牌：标本剥制、说“茄子”！、外星几何、小丑房间、咬一口！、吊死鬼、电话铃声、小机器人、嘎吱的木门、脑状食品、片刻希望、上古旧宅、肉质苔癣、夜幕众星、一抹鲜红、一瓶微尘、大宅饿了、一条秘密通道、最深的壁橱、磁带播放器、在你背后！、蜘蛛！、一种怪异的感觉、游魂、葬礼、不可能的房间、地狱蝙蝠、断手、怪异的镜子、花团锦簇、晦暗暴风夜、技术难点、佳馔满桌、禁忌知识、可怜的尤里克、轮到约拿了、秘密升降机、神秘液体、无线电广播、摇曳灯光、一罐器官、一声呼救、着火的人。 |
| 审计结论 | `event-effect-matrix-indexed / broad-domain-partial-verified / downstream-open`；43 张事件已进运行池并有通用解释器、部分领域分支和代表 UI 证据，但逐事件完整 UI、真实入口 E2E、截图、死亡保护/伤害减免/重掷/作祟特例/房间目标组合仍未闭合。 |
| 当前裁定 | 事件数量和 atlas 映射不等于事件牌效果完成；20 张新增或复杂事件必须继续按分支、UI 和组合单独审，尤其「怪异的镜子」只能算 7 号作祟代表链，不是完整作祟完成。 |

## 物品效果专项审计入口（2026-07-29 续跑）

| 项 | 当前状态 |
| --- | --- |
| 专项文档 | `evidence/betrayal/full-audit/item-effect-implementation-audit-2026-07-29.md` |
| 覆盖对象 | 22 张官方物品：魔法相机、恐怖玩偶、奇怪的药品、镜子、急救包、幸运硬币、皮夹克、牙齿项链、手电筒、头戴耳机、奇异护符、胸针、枪、十字弓、骨制钥匙、神秘秒表、地图、砍刀、电锯、炸药、天使之羽、兔脚。 |
| 审计结论 | `item-effect-matrix-indexed / mixed-domain-verified / downstream-open`；多数对象已有结构入口和领域代表链，但 UI 承接、组合扩审、作祟/死亡/交易/攻击消费者和截图链仍未闭合。 |
| 当前裁定 | 物品运行池数量对齐和领域 / UI 代表链不等于逐物品效果完成；攻击武器桶当前已修正旧十字弓视线误口径，灰尘主动持有牌桶已补 11 张代表链，骨制钥匙穿墙移动 UI 代表链已补，炸药 Board 目标态代表链已补，恐怖玩偶 Board 全骰选择代表链已补，幸运硬币 Board 空白骰选择代表链已补，牙齿项链 Board 选择 / 跳过代表链已补，胸针 Board 伤害分配代表链已补，木乃伊强制伤害下胸针不适用真实入口 / 截图边界已补，灰尘普通攻击非强制物理伤害下胸针可用真实入口 / 截图链已补，指环攻击非强制精神伤害下胸针可用真实入口 / 截图链已补，皮夹克 Board 攻击复盘代表链已补，但重掷、伤害改写组合、回合结束组合、额外行动、炸药真实入口 / 非法原因 / 怪物作祟组合、恐怖玩偶真实 Playwright / 截图、作祟特殊行动属性检定通用回滚快照和更多重掷消费者组合、幸运硬币真实 Playwright / 截图、作祟特殊行动和死亡保护组合、牙齿项链真实 Playwright / 截图和死亡保护组合、胸针更多伤害来源、减伤叠加、死亡保护 / 作祟伤害组合、皮夹克怪物 / 作祟攻击组合、地图移动空间组合和骨制钥匙墙体 / 门位 / 作祟地图组合等跨消费者桶仍必须继续独立审。 |

## 预兆与作祟公共规则专项审计入口（2026-07-29 续跑）

| 项 | 当前状态 |
| --- | --- |
| 专项文档 | `evidence/betrayal/full-audit/omen-and-haunt-rule-implementation-audit-2026-07-29.md` |
| 覆盖对象 | 9 张预兆：书本、狗、面具、头骨、圣符、盔甲、雕像、指环、匕首；作祟公共规则：抽预兆检定、全员当前持有预兆总数、5+ 作祟、最多 8 骰、最后一张预兆自动作祟、翻牌确认队列、作祟风险进度条。 |
| 审计结论 | `omen-haunt-rule-matrix-indexed / min-domain-verified / downstream-open`；逐卡领域代表链和公共规则领域链存在，但 UI 承接、组合扩审、作祟揭示 E2E 和截图链仍未闭合。 |
| 当前裁定 | 作祟公共规则不能并入任一单张预兆；9 张预兆数量正确不能替代逐卡效果实现审计。 |

## 房间效果专项审计入口（2026-07-29 续跑）

| 项 | 当前状态 |
| --- | --- |
| 专项文档 | `evidence/betrayal/full-audit/room-effect-implementation-audit-2026-07-29.md` |
| 覆盖对象 | 11 个带显式效果房间：礼拜堂、书房、图书馆、体育馆、储物间、器械库、杂物间、火炉房、倒塌房间、洗衣滑槽、神秘电梯。 |
| 审计结论 | `room-effect-matrix-indexed / downstream-open`；对象全集和实现入口已锁，但仍需补逐效果真实 UI、组合、负向断言和截图链。 |
| 自检结果 | `npm run audit:evidence:selfcheck -- evidence/betrayal/full-audit/room-effect-implementation-audit-2026-07-29.md` 通过。 |

## 木乃伊横行中段专项审计入口（2026-07-29 续跑）

| 项 | 当前状态 |
| --- | --- |
| 专项文档 | `evidence/betrayal/full-audit/mummy-rampage-midgame-implementation-audit-2026-07-29.md` |
| 覆盖对象 | 「木乃伊横行」作祟中段：setup、英雄找真名/学法术/驱逐、叛徒拾女孩/交女孩/交圣符或指环、木乃伊强制关键预兆、0/1 瞬移、同房先攻击、2 点以上偷取或伤害、英雄/叛徒终局读模型。 |
| 审计结论 | `mummy-rampage-midgame-indexed / domain-and-board-representative-verified / hero-traitor-monster-and-forced-omen-e2e-verified / downstream-open`；领域命令链、部分 Board 代表入口、剧本阅读/终局朗读代表 E2E、木乃伊英雄行动真实入口 E2E、叛徒行动真实入口 E2E、木乃伊怪物行动真实入口 E2E 和强制关键预兆真实探索 E2E 已存在；怪物行动 E2E 已覆盖移动骰 0 和 1 瞬移女孩房间、移动模式提示“只限已发现房间 / 不能探索新房间”且未发现房间无目标框、已持女孩和圣符时移动回石棺触发叛徒终局、同房先攻击、同房攻击目标过滤、攻击后移动恢复、偷地图、偷圣符、偷指环、偷女孩、造成伤害分配页入口、木乃伊攻击这一条盔甲减伤、非致死伤害实际扣属性轨道格回牌桌、木乃伊攻击致死伤害触发头骨后的成功阻止死亡与失败正常死亡，以及头骨失败后的兔脚重掷阻止死亡，以及木乃伊强制伤害下胸针不适用真实入口；领域 + Board 代表链已覆盖目标英雄没有可偷物品、预兆或女孩时不生成偷取奖励、直接进入强制伤害分配；领域 + Board 代表链已覆盖奖励 pending 后旧偷取目标失效时拒绝偷取旧目标、显示失效提示并保留造成伤害选择；另在灰尘普通攻击桶补了胸针非强制物理伤害可用真实入口，在非 P0 / 指环攻击桶补了胸针非强制精神伤害可用真实入口。更多房间特殊状态、更多伤害来源、更多死亡保护 / 兔脚叠加和同一整局自然跨回合链不再写作当前实现阻塞；分别归为非阻塞扩展或验证层级缺口。 |
| 当前裁定 | 木乃伊横行不能再只按“剧本阅读 E2E 通过”外推为完成；当前已补英雄找真名/学法术/驱逐真实入口、叛徒拾女孩/交女孩/交圣符/交指环真实入口、怪物移动骰 0/1 / 移动模式只限已发现房间提示 / 未发现房间不生成移动目标 / 自然怪物移动回石棺 / 攻击 / 同房目标过滤 / 偷地图 / 偷圣符 / 偷指环 / 偷女孩 / 攻击后移动恢复 / 造成伤害分配并实际结算回牌桌 / 木乃伊攻击盔甲减伤真实入口、木乃伊攻击头骨成功阻止死亡与失败正常死亡真实入口、头骨失败后的兔脚重掷阻止死亡真实入口、木乃伊强制伤害下胸针不适用真实入口、无可偷对象直接进入强制伤害分配代表链、失效偷取目标拒绝和玩家可见提示代表链，以及强制关键预兆真实探索入口；胸针普通攻击非强制物理伤害入口已在灰尘作祟桶补证，指环攻击非强制精神伤害入口已在非 P0 攻击桶补证。木乃伊中段残余必须分类保留：「女孩」触发牌版本冲突是数据/版本争议，同一整局自然跨回合链是验证层级缺口，更多房间/伤害/死亡保护/兔脚组合是非阻塞扩展。 |
| 自检结果 | `npm run audit:evidence:selfcheck -- evidence/betrayal/full-audit/mummy-rampage-midgame-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/event-effect-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/item-effect-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/omen-and-haunt-rule-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/room-effect-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/runtime-implementation-consumption-audit-2026-07-29.md` 通过。 |

## 基础主循环 / 玩家交互入口专项审计入口（2026-07-29 续跑）

| 项 | 当前状态 |
| --- | --- |
| 专项文档 | `evidence/betrayal/full-audit/core-loop-player-interaction-audit-2026-07-29.md` |
| 覆盖对象 | 开局剧本卡选择、属性轨、移动力快照、移动、探索、发现确认、作祟风险 / 揭示、交易、特殊行动预算、攻击、伤害 / 死亡保护、搜尸、怪物移动 / 攻击 / 击晕翻正。 |
| 审计结论 | `core-loop-interaction-indexed / mixed-e2e-representative-verified / downstream-open`；主循环入口已有多条真实入口 E2E 和领域 / Board 代表证据，但证据是切片代表链，不能外推为全规则、全牌库、全房间或全作祟完成。 |
| 当前裁定 | 主循环可以继续作为实现审计输入；作祟后探索与叛徒事件符号分支已集中写回主循环总账，旧“作祟后禁探索”口径降级为历史失效结论；徒手、砍刀、指环、匕首、十字弓相邻攻击和武器禁用原因已在当前树复跑并集中写回主循环总账，不得表述为功能未实现；木乃伊英雄行动真实入口已补，但仍需继续补木乃伊自然长链、叛徒链、逐卡效果、逐房间效果、武器 / 伤害组合和怪物专属覆写。 |
| 自检结果 | `npm run audit:evidence:selfcheck -- evidence/betrayal/full-audit/core-loop-player-interaction-audit-2026-07-29.md evidence/betrayal/full-audit/mummy-rampage-midgame-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/event-effect-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/item-effect-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/omen-and-haunt-rule-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/room-effect-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/runtime-implementation-consumption-audit-2026-07-29.md evidence/betrayal/full-audit/full-deck-data-intake-contract.md evidence/betrayal/full-audit/object-l0-l4-matrix.md` 通过；检查 9 个审计文档，结果 OK。 |

## 后续阶段入口（非当前 S0 合同续跑动作）

1. 继续按矩阵审 UI 承接：事件选择、物品主动入口未覆盖桶、预兆逐卡入口、作祟揭示、房间效果。
2. 木乃伊中段已补英雄找真名/学法术/驱逐真实入口 E2E、叛徒交女孩/圣符/指环真实入口 E2E、怪物移动骰 0/1 / 移动模式只限已发现房间提示 / 未发现房间不生成移动目标 / 自然怪物移动回石棺 / 攻击 / 同房目标过滤 / 偷地图 / 偷圣符 / 偷指环 / 偷女孩 / 攻击后移动恢复 / 造成伤害分配并实际扣属性轨道格回牌桌 / 木乃伊攻击盔甲减伤真实入口 E2E、木乃伊攻击头骨成功阻止死亡与失败正常死亡真实入口 E2E、木乃伊攻击头骨失败后的兔脚重掷阻止死亡真实入口 E2E、木乃伊强制伤害下胸针不适用真实入口 E2E 和强制关键预兆真实探索 E2E；无可偷对象直接进入强制伤害分配的领域 + Board 代表链已补；失效偷取目标拒绝和玩家可见提示的领域 + Board 代表链已补；0/1 移动跨楼层已发现房间目标与未发现房间拒绝领域代表链已补；灰尘桶另已补胸针普通攻击非强制物理伤害真实入口 E2E；非 P0 攻击桶另已补指环攻击胸针非强制精神伤害真实入口 E2E；若要提高发布级证明，可补 setup 展示和同一整局自然跨回合链；更多房间特殊状态组合、更多伤害来源减伤 / 死亡保护 / 兔脚组合只作为非阻塞扩展登记，不作为默认下一步。
3. 基础主循环已把徒手、砍刀、指环、匕首、十字弓相邻攻击和武器禁用原因代表链按当前树复跑后集中写回主循环总账；仍需把障碍物、强制移动、武器 / 伤害 / 死亡组合、怪物专属覆写继续补到 L3/L4。
4. 当前仅能说“剧本阅读与结局朗读代表链已验证”；未覆盖全牌库、全部房间效果和木乃伊自然全流程前，不得给“端到端完成”口径。
