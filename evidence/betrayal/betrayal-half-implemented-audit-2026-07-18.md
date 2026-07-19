# 山屋惊魂半实现专项审计

## 1. 本轮范围

- 对象：当前山屋惊魂实现中容易被误认为“已完整”的半实现链路。
- 日期：2026-07-18
- 目标：把半实现对象拆成“已完整实现”“已有正式门禁”“待完整实现”“暂缓/不纳入”，并把端到端或领域验证结果写回审计口径。
- 真相源：
  - `src/games/betrayal/scenarioConfig.ts`
  - `src/games/betrayal/game.ts`
  - `src/games/betrayal/Board.tsx`
  - `src/games/betrayal/ai.ts`
  - `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts`
  - `docs/games/betrayal/sources/official/betrayal-3e-secrets-of-survival-en.md`
  - `docs/games/betrayal/sources/official/betrayal-3e-traitors-tome-en.md`
  - `evidence/betrayal/full-audit/first-scenario-full-audit.md`
  - `evidence/betrayal/full-audit/object-l0-l4-matrix.md`
  - `evidence/betrayal/betrayal-event-card-ingest-2026-07-03.md`
  - `evidence/betrayal/betrayal-event-e2e-coverage-2026-07-04.md`

## 2. 结论摘要

- 作祟剧本 1 已接入正式运行链路：当前唯一 `BetrayalScenarioId` 是 `first-scenario`，配置对象为 `Crimson Jack Returns`，领域测试覆盖作祟触发、首剧本 haunt 运行态和双终局。
- 作祟剧本 3「灰尘」已从门禁推进到正式代表链：`一瓶微尘` 成功分支可进入灰尘运行态；领域测试覆盖隐藏 Sickness token、Search / Cure、英雄胜利和叛徒胜利；真实浏览器链路覆盖寻找解药、Research token、疾病交换请求与目标玩家同意。
- 作祟剧本 12「大宅饿了」已从门禁推进到正式代表链：`大宅饿了` 成功分支可进入剧本 12；领域、Board、AI 和真实浏览器链路覆盖邪教徒、尸体搬运、献祭、饥饿刻度和关键胜负推进。
- 作祟剧本 33「魔法相机」已从门禁推进到正式代表链：`说“茄子”！` 成功分支按魔法相机持有者决定叛徒，并进入魔法相机作祟牌桌；领域、Board、AI 和真实浏览器链路覆盖相机归属、Essence token、幻影摄影师、拍照 / 砸相机 / 摄影师攻击等关键动作。
- 23 张事件牌现在可以写成“已进入正式运行事件牌堆”：`BETRAYAL_IMPLEMENTED_HAUNT_CARD_NUMBERS = [1, 3, 12, 33]`，`一瓶微尘`、`大宅饿了`、`说“茄子”！` 的作祟成功分支都有真实代表链。
- 狗交易不是当前红灯：本轮复跑 `firstScenarioRuntime.test.ts` 全文件，155 条全部通过；狗交易请求、同意、拒绝、4 格远距、每回合一次和收到牌本回合不可立刻用都有领域覆盖。

## 3. 半实现矩阵

| 对象/链路 | 当前状态 | 真相源 | 当前实现入口 | 已验证证据 | 判定 | 下一步 |
| --- | --- | --- | --- | --- | --- | --- |
| 作祟剧本 1：赤红杰克归来 | 已正式实现 | `scenarioConfig.ts` 的 `first-scenario`；官方首剧本书 | `BETRAYAL_SCENARIO_CONFIGS['first-scenario']`、haunt reducer、首剧本命令 | `firstScenarioRuntime.test.ts` 定向作祟/终局通过；全文件 142 passed | 已完整实现 | 保持为首剧本基线，后续只补新增消费者或旧证据失效 |
| 作祟剧本 3：灰尘 | 已接入正式代表链 | `Secrets of Survival` Page 8-9，触发牌 `A VIAL OF DUST` / `一瓶微尘`；`openspec/changes/add-betrayal-additional-haunts/haunt-contracts.md` | `BETRAYAL_IMPLEMENTED_HAUNT_CARD_NUMBERS = [1, 3, 12, 33]`、`scenarioRuntime.dust`、`SEARCH_FOR_CURE`、`CURE_THE_DUST`、`REQUEST_SICKNESS_EXCHANGE`、`RESOLVE_SICKNESS_EXCHANGE` | `firstScenarioRuntime.test.ts` 覆盖隐藏 Sickness token、触发、Search、Cure、叛徒胜利；`Board.foundation.test.tsx` 覆盖页面寻找解药和疾病交换；`ai.test.ts` 覆盖灰尘 AI；`event-choice-coverage.e2e.ts` 灰尘代表链 1 passed，8 张截图已核对 | 正式代表链已通过；不外推山屋整游戏完成 | 后续只在旧证据失效或新增灰尘分支时补证 |
| 作祟剧本 12：大宅饿了 | 已接入正式代表链 | `Traitor's Tome` Page 12，触发牌 `The House is Hungry` / `大宅饿了`；`openspec/changes/add-betrayal-additional-haunts/haunt-contracts.md` | `scenarioRuntime.hungryHouse`、`PICK_UP_CORPSE`、`FEED_HER`、`HAUNT_ATTACK` 邪教徒目标、`CULTIST_ATTACK` | `firstScenarioRuntime.test.ts` 覆盖触发、尸体搬运 / 献祭、饥饿刻度、邪教徒攻击与胜负推进；`Board.foundation.test.tsx` 覆盖页面搬尸、献祭、攻击邪教徒；`ai.test.ts` 覆盖大宅饿了 AI；`event-choice-coverage.e2e.ts` 大宅饿了代表链 1 passed，7 张截图已核对 | 正式代表链已通过；不外推全量复杂分支 | 后续只在旧证据失效、更多边界或更完整全局验收时补证 |
| 作祟剧本 33：魔法相机 | 已接入正式代表链 | `Secrets of Survival` Page 41 与 `Traitor's Tome` Page 39，触发牌 `Say Cheese` / `说“茄子”！`；`openspec/changes/add-betrayal-additional-haunts/haunt-contracts.md` | `scenarioRuntime.magicCamera`、`TAKE_PHOTO`、`SMASH_MAGIC_CAMERA`、`PHANTOM_PHOTOGRAPHER_ATTACK`、幻影摄影师受击状态 | `firstScenarioRuntime.test.ts` 覆盖触发、相机归属、Essence、摧毁相机、击杀 / 眩晕摄影师、英雄 / 叛徒胜利；`Board.foundation.test.tsx` 覆盖页面砸相机、拍照、攻击摄影师；`ai.test.ts` 覆盖魔法相机 AI；`event-choice-coverage.e2e.ts` 魔法相机归属代表链 1 passed，6 张截图已核对 | 正式代表链已通过；不外推全量复杂分支 | 后续只在旧证据失效、更多边界或更完整全局验收时补证 |
| 事件牌 23 张合同与 23 张正式运行牌堆 | 合同完整，运行态已开放当前 4 个作祟编号 | 事件录入合同与 `BETRAYAL_IMPLEMENTED_HAUNT_CARD_NUMBERS = [1, 3, 12, 33]` | 运行时事件池过滤 `isBetrayalEventRuntimeSupported`；对应成功分支进入正式作祟运行态 | `一瓶微尘`、`大宅饿了`、`说“茄子”！` 成功分支 E2E 均通过；OpenSpec 合同 valid | 当前 23 张事件牌可进入正式运行牌堆 | 文档统一写“23 张合同、23 张正式运行事件牌堆” |
| 狗远距交易 | 当前已实现 | 预兆狗合同、交易规则 | `TRADE_POSSESSION` / `RESOLVE_TRADE_AGREEMENT`、`pendingTradeAgreement` | `firstScenarioRuntime.test.ts` 全文件 142 passed，覆盖狗交易两条用例 | 已完整实现 | 不再列为半实现；后续只在 UI/E2E 失效时补证 |
| 剧本书详情层替换 TTS 书本模型 | 暂缓 | Mods PDF/剧本书审计 | 当前仍用代码内书本式详情层 | `first-scenario-full-audit.md` 已标暂缓 | 暂缓/不纳入当前实现 | 用户重新要求前不作为半实现 bug 处理 |
| 房间背面 / 楼层板资源合同 | 独立资源缺口，不是首剧本半实现本体 | 资源 manifest、master spec | 当前首剧本运行依赖 42 间正面房间池 | 主审计把它列为更多对象真相/资源合同后续项 | 待独立审计 | 单独建资源合同和验收，不和作祟剧本实现混在一起 |

## 4. 本轮验证记录

| 验证项 | 命令 | 结果 | 说明 |
| --- | --- | --- | --- |
| 作祟剧本 1 定向链路 | `node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1 -t "一抹鲜红作祟检定成功会复用正式 haunt 触发链路|能在第三次恶兆且 haunt roll 达标后进入真实 haunt|英雄胜利|叛徒"` | 13 passed / 129 skipped | 证明首剧本 1 不是只写配置，能进入真实 haunt 与终局链 |
| 山屋领域回归 | `node scripts\infra\vitest-cli-safe.mjs run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts` | 155 passed | 覆盖狗交易、事件门禁、首剧本运行态、持有物/房间、灰尘、大宅饿了和魔法相机关键领域链路 |
| 山屋 Board 组件回归 | `node scripts\infra\vitest-cli-safe.mjs run src\games\betrayal\__tests__\Board.foundation.test.tsx` | 64 passed | 覆盖灰尘真实页面寻找解药、Research token、疾病交换请求、目标玩家同意，以及大宅饿了 / 魔法相机关键页面动作 |
| 山屋 AI 回归 | `node scripts\infra\vitest-cli-safe.mjs run src\games\betrayal\__tests__\ai.test.ts` | 31 passed | 覆盖 3/12/33 的 AI 关键动作：灰尘寻找 / 治愈 / 疾病交换，大宅搬尸 / 献祭 / 邪教徒攻击，魔法相机拍照 / 砸相机 / 摄影师攻击 |
| 山屋定向 ESLint | `npx eslint src\games\betrayal\ai.ts src\games\betrayal\__tests__\ai.test.ts e2e\betrayal\event-choice-coverage.e2e.ts` | passed | 覆盖本轮 AI 与 E2E 变更文件 |
| TypeScript | `npx tsc --noEmit --pretty false` | passed | 全仓类型检查通过 |
| 灰尘真实浏览器代表链 | `node scripts\infra\run-e2e-single.mjs ci e2e\betrayal\event-choice-coverage.e2e.ts "一瓶微尘成功进入灰尘后可寻找解药并完成疾病交换同意"` | 1 passed | `evidence/betrayal/betrayal-dust-haunt-e2e-2026-07-18.md` 已记录 8 张截图和肉眼观察 |
| 大宅饿了真实浏览器代表链 | `node scripts\infra\run-e2e-single.mjs ci e2e\betrayal\event-choice-coverage.e2e.ts "大宅饿了真实链路触发剧本12"` | 1 passed | `evidence/betrayal/betrayal-hungry-house-haunt-e2e-2026-07-18.md` 记录 7 张截图和核对结论 |
| 魔法相机真实浏览器代表链 | `node scripts\infra\run-e2e-single.mjs ci e2e\betrayal\event-choice-coverage.e2e.ts "说茄子真实链路触发作祟时由魔法相机持有者成为叛徒"` | 1 passed | `evidence/betrayal/betrayal-magic-camera-haunt-e2e-2026-07-18.md` 记录 6 张截图和核对结论 |
| 更多作祟剧本 OpenSpec 提案 | `openspec validate add-betrayal-additional-haunts --strict --no-interactive` | valid | 已建立 `openspec/changes/add-betrayal-additional-haunts/`，把剧本 3/12/33 的正式实现范围、验收和文档回写门槛写入提案；当前 3/12/33 均已推进到代表链验证 |
| 更多作祟剧本结构化合同 | `openspec validate add-betrayal-additional-haunts --strict --no-interactive` | valid | `openspec/changes/add-betrayal-additional-haunts/haunt-contracts.md` 已按官方源拆出剧本 3/12/33 的触发、setup、运行时动作、怪物/标记、胜负条件和玩家视图；当前代码和代表链已覆盖这些核心合同 |
| 更多作祟剧本实现落点审计 | `openspec validate add-betrayal-additional-haunts --strict --no-interactive` | valid | `openspec/changes/add-betrayal-additional-haunts/implementation-readiness.md` 已记录正式代码落点；当前 3/12/33 均已完成代表链，剩余边界不再作为本轮阻塞 |
| 审计文档自检 | `npm run audit:evidence:selfcheck -- evidence/betrayal/betrayal-half-implemented-audit-2026-07-18.md` | OK | 审计文档证据完整性检查通过 |

## 5. 仍未完成的实现工作

1. 当前可以说作祟剧本 3/12/33 已完成正式代表链和本轮验证，但不能说山屋惊魂整游戏已完成。
2. 当前不能把 3/12/33 的代表链通过外推成“全部作祟剧本已完成”；后续新增剧本仍要逐个录合同、接状态机、补页面动作、AI 行动和 E2E 代表链。
3. 房间背面 / 楼层板资源合同、未来新增对象、更多复杂分支和完整规则书式教程仍是独立缺口，不属于本轮 3/12/33 代表链完成证据。
