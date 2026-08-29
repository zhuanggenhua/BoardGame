# 山屋惊魂日志 / 撤回 / 无线电广播伤害分配截图留档（2026-08-27）

## 基本信息

- 对象：山屋惊魂操作日志、撤回入口、无线电广播低点数分支的事件结果、派生重新投骰与伤害分配。
- 日期：2026-08-27；最新修订：2026-08-29 00:07 +08:00。
- 文档类型：`closeout`。
- 关联 evidence：`evidence/betrayal/full-audit/event-effect-implementation-audit-2026-07-29.md` 的事件伤害分配机制族重审回写。

## 审计范围

- 本轮覆盖的游戏 / 模块 / 对象：`src/games/betrayal` 的操作日志、撤回入口、最近投骰面板和事件结果确认链。
- 本轮覆盖的规则子句或共享链路：无线电广播 0-2 分支“受到一颗骰子的精神伤害”为直接截图验证对象；事件伤害机制族回写覆盖 31 个子句，分为 `rolledDamage` 13 个、`fixedDamage` 13 个、`generalDamageChoice` 5 个。
- 本轮使用的目标入口 / 环境：Playwright 真实浏览器 E2E，路由 `/test-match-room/betrayal?players=...`，玩家名为“薇薇安”。
- 明确不在本轮范围内的对象：43 张事件逐张真实入口截图、精神 / 物理伤害的死亡保护和减伤组合、脚注音频呈现、作祟后特殊状态。

## 结论等级

结论等级：`功能实现已验证`。

判定理由：本轮证据证明日志显示真实玩家名、撤回面板可打开、无线电广播事件触发与事件结果可见、低点数分支会独立重新投掷一颗伤害骰；派生伤害骰阶段的事件名由同屏事件牌 / 发现面板承接，不再在伤害骰面板里可见重复“无线电广播”，骰子上方也不再显示“重新投掷的伤害骰（1 颗）”标签。伤害骰面板只保留 1 颗伤害骰本体和正确的伤害骰合计；“待分配 2 点精神伤害”只在后续分配面板和操作日志里出现，不再提前占用重新投骰画面。事件总点数 0 只作为主事件分支依据出现在事件结果 / 日志语境，不再占用伤害骰主合计。主事件结果确认后先停在独立伤害骰确认画面，09 图不显示伤害分配面板；玩家确认这一颗伤害骰后，10 图才出现 2 点精神伤害分配。分配面板的事件名由同屏事件卡 / 发现面板承接，面板内只保留无障碍来源文本，不再可见重复“无线电广播”；知识 / 神志属性刻度尺卡片本体成为可点击目标和唯一可见承伤承载者，额外属性按钮行退场，选择后由目标指针、`-1步` 和 `4 -> 3` 辅助读数表达，不再显示“知识 承担 1 点 / 神志 承担 1 点”或 `×1`。玩家可在知识 / 神志之间分配，分配后才扣最终属性，并把重新投骰和分配结果写入操作日志。该结论只覆盖本轮锁定范围，不外推为山屋 43 张事件逐张 E2E 完成。

## 权威来源

| 类型 | 来源 | 证明内容 |
| --- | --- | --- |
| 规则配置 | `src/games/betrayal/scenarioConfig.ts` 的无线电广播配置 | 主事件投 2 颗骰子；0-2 分支是 `rolledDamage`，`dice: 1`，`damageKind: mental`。 |
| 领域结算 | `src/games/betrayal/game.ts` | 主事件骰先只确定分支；最后一票确认事件结果时才物化派生伤害骰，并把 `rolls`、`total`、`appliedAmount` 写入最近投骰快照并生成待分配精神伤害；玩家分配后才扣最终属性。 |
| 玩家可见结果 | `src/games/betrayal/Board.tsx` | 最近投骰面板在伤害骰阶段只保留必要可见职责：骰子本体和伤害骰合计；事件名由同屏事件卡 / 发现面板承接，不在伤害骰面板重复显示；完整重新投骰明细保留在日志里；独立伤害骰确认前隐藏伤害分配面板，确认后才给精神伤害展示知识 / 神志属性刻度尺和待分配伤害；若事件卡 / 发现面板已显示事件名，分配面板不再可见复写来源名，刻度尺卡片本体承接选择和扣减预览。 |
| 操作日志 | `src/games/betrayal/actionLog.ts` | 日志用真实触发玩家写入事件结果、重新投骰结果和伤害分配结果。 |
| 截图与 E2E | `e2e/betrayal/action-log-undo-screenshots.e2e.ts` | 真实浏览器完整覆盖日志、撤回、事件触发、事件结果、重新投骰、精神伤害分配、属性扣减和日志记录。 |

## 原子语义与实现消费

| 对象 | 原子语义断言 | 实现消费点 | 最终权威结果 | 真实入口 / 验证证据 | 缺口分类 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 操作日志玩家名 | 玩家执行移动、探索和事件结算后，日志必须显示真实玩家名，不能显示“玩家 1”占位。 | `actionLog.ts` 通过 `playerId` 参数交给 HUD 玩家映射。 | 日志记录归属到触发玩家“薇薇安”。 | E2E 断言日志包含“薇薇安”且不包含“玩家 1 / 玩家1”。 | 无 | PASS |
| 撤回入口 | 移动后必须生成可撤回操作，并能打开撤回请求面板。 | `TestMatchRoom.tsx` 的测试 HUD 接入 `GameHUD`；撤回 FAB 打开 `fab-panel-undo-request`。 | 撤回请求面板可见，保留操作记录快照。 | 截图 `02-山屋惊魂-撤回请求面板.png`；E2E 断言面板和申请按钮可见。 | 无 | PASS |
| 无线电广播事件触发 | 探索事件房间后，玩家应看到事件牌“无线电广播”、主事件骰总点数和低点数分支文案。 | `game.ts` 生成 `recentRoll`；`Board.tsx` 的发现面板与最近投骰面板展示事件。 | 事件仍处于待确认事件结果，尚未正式扣伤害；事件总点数 0 只用于选择 0-2 分支。 | 截图 `02-无线电广播-低点数受伤分支.png`、`03-无线电广播-事件骰结果.png`；E2E 断言事件牌、总点数 0 和分支文案。 | 无 | PASS |
| 派生伤害骰 | “受到一颗骰子的精神伤害”必须重新投一颗伤害骰，不是固定 1 点伤害，也不能复用主事件骰点数；重新投骰画面不能继续显示主事件的两颗大骰子，也不能把规则描述、事件牌标题或后续待分配句当作伤害骰面板标题，更不能和伤害分配面板合成同一帧；可见层不能重复复写骰种、骰数、每颗点数、同一个合计、固定 0 加值或“待分配”句。 | 主事件命令前只设置 `[0, 0]`，使主事件骰为 0 / 0；最后一名玩家确认 `FINALIZE_EVENT_ROLL` 前重新设置 `[0.99]`，由派生结算独立调用 `rollDicePips` 得到伤害骰 2。`Board.tsx` 在派生伤害结果阶段把可见骰盘切到 `event-rolled-damage`，并在伤害骰确认前阻止伤害分配面板显示；重新投骰画面只承接伤害骰本体和伤害骰合计，事件名由同屏事件牌 / 发现面板承接，待分配伤害由下一步分配面板和日志承接。 | 最近投骰快照记录 `rolledDamageResults: [{ rolls: [2], total: 2, appliedAmount: 2 }]`；重新投骰画面的伤害骰面板不显示“无线电广播”或“重新投掷的伤害骰（1 颗）”，可见骰盘 `data-dice-count=1`、`data-dice-rule-subtotal=2`，主合计为“伤害骰合计 2”；不再可见重复“待分配 2 点精神伤害 / 重新投掷 1 颗骰子 / 合计 2 / 伤害骰面合计 / 加值 0”；此时 `betrayal-damage-allocation-panel` 不存在。 | 截图 `04-无线电广播-重新投掷一颗骰子.png`；E2E 断言 `betrayal-recent-roll-outcome` 不渲染、伤害骰面板可见文本只包含“伤害骰合计 2”，不含“无线电广播 / 受到一颗骰子的精神伤害 / 重新投掷的伤害骰 / 待分配 2 点精神伤害”，且 `betrayal-recent-roll-total=伤害骰合计 2`、不显示“事件总点数 0”作为伤害骰主合计，`data-visible-dice-source=event-rolled-damage`、`data-dice-count=1`、`data-dice-rule-subtotal=2`；同时 `betrayal-recent-roll-damage-dice`、`betrayal-recent-roll-effect-damage` 和 `betrayal-recent-roll-breakdown` 均不存在，`betrayal-damage-allocation-panel` 数量为 0。 | 无 | PASS |
| 精神伤害分配 | 精神伤害必须在玩家确认独立伤害骰后才进入分配，由玩家在知识 / 神志之间分配，不能默认扣某一项，也不能出现力量 / 速度选项；同屏事件卡已经显示“无线电广播”时，分配面板不能再可见重复事件名；属性刻度尺已经表达属性身份、当前值、目标值和扣减方向时，不能再用额外按钮或 chip 复写“属性名 + 承担 N 点”或 `×N`。 | `EVENT_ROLL_FINALIZED` 后激活 `pendingDamageAllocation` 但 UI 先展示独立伤害骰确认；`ACKNOWLEDGE_RECENT_ROLL` 确认伤害骰后，`Board.tsx` 按 `allowedTraits: ["knowledge", "sanity"]` 只渲染可点击属性刻度尺卡片；面板来源文本只作为无障碍语义保留，刻度尺卡片本体承接选择、目标指针和扣减预览。 | 事件确认后属性仍是知识 4 / 神志 4；确认伤害骰后分配面板主标题显示“分配 2 点精神伤害”，只允许知识 / 神志；“无线电广播”不在分配面板里二次可见；选择后知识 / 神志卡片各自 `data-damage-selected-count=1`、目标位置低于当前位置、可见分配区不含“承担 N 点”或 `×N`。 | 截图 `05-无线电广播-精神伤害分配面板.png`；E2E 断言先点击 `betrayal-roll-continue` 并等待 `recentRoll` 清空，随后分配面板才出现，且合法属性只有知识 / 神志；断言分配来源归属为事件卡 / 发现面板并带隐藏样式；断言可点击刻度尺卡片目标指针左移，分配区不含“承担 N 点”或 `×N`。 | 无 | PASS |
| 分配后伤害结算 | 玩家选择知识和神志各分配 1 点伤害后，才扣最终精神属性。 | `RESOLVE_DAMAGE_ALLOCATION` 触发 `DAMAGE_ALLOCATION_RESOLVED`，`applyGeneralDamage` 按玩家选择扣属性并清空 pending。 | 精神总值从 8 降到 6，知识 4→3，神志 4→3；分配面板关闭。 | 截图 `06-无线电广播-分配后属性结果.png`；E2E 断言 pending 清空和属性轨结果。 | 无 | PASS |
| 重新投骰与分配日志 | 日志必须记录无线电广播结果、重新投骰点数、合计、待分配伤害和玩家最终分配到哪些属性。 | `buildEventRolledDamageEntries` 优先读取独立伤害骰事件的 `recentRoll.eventRolledDamageResults`，`buildDamageAllocationEntry` 读取分配事件。 | 操作日志包含真实玩家名“薇薇安”、“重新投掷 1 颗骰子”、“待分配 2 点精神伤害”和“将无线电广播的 2 点精神伤害分配到知识、神志”。 | 截图 `07-无线电广播-日志记录重新投骰与分配.png`；E2E 断言完整日志文本且不含“玩家 1 / 玩家1”。 | 无 | PASS |

## 共享流程引用

| 本对象 | 独立语义结论 | sharedFlowId | 一致性核对 | 剩余差异 | 是否需要直测 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 无线电广播低点数分支 | 主事件骰低点数后进入一颗精神伤害骰，先确认这颗伤害骰，再由玩家分配精神伤害。 | `event-rolled-damage-resolution` | 触发时机：主事件骰分支确定后先等待事件结果确认，最后一票 `FINALIZE_EVENT_ROLL` 才独立生成派生伤害骰；候选生成：无额外目标候选，但生成知识 / 神志伤害分配候选；权限判断：沿用事件确认，独立伤害骰由受伤玩家确认，伤害分配由受伤玩家执行；交互入口：最近投骰面板确认后才进入伤害分配面板；payload / command 结构：`EVENT_ROLL_FINALIZED.effect` + `ACKNOWLEDGE_RECENT_ROLL` + `RESOLVE_DAMAGE_ALLOCATION.traits`；执行入口：`applyEventEffectWithDeferredRolledDamage` / `ACKNOWLEDGE_RECENT_ROLL` / `DAMAGE_ALLOCATION_RESOLVED`；最终权威状态：分配后精神属性轨扣减；清理语义：待确认事件骰、伤害骰确认和待分配伤害均清空；AI 或自动推进：不引入新合法动作。 | 事件名、1 颗骰、精神伤害。 | 否：本对象已经直测；其他 `rolledDamage` 子句按同流程判等，`fixedDamage` 与 `generalDamageChoice` 使用各自共享流程在事件效果 evidence 中回写。 | PASS |

## 验证证据

| 命令 / 证据 | 结果 | 证明了什么 | 没有证明什么 |
| --- | --- | --- | --- |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/actionLogUndo.test.ts --configLoader native --reporter=json --outputFile=temp/betrayal-actionLogUndo-roll-panel-dedupe-20260828-report.json` | JSON success true / 6 passed | 单元层证明操作日志、撤回相关记录、无线电广播低点数重新投骰、确认伤害骰前不能分配、确认后待分配精神伤害仍保留、玩家分配知识 / 神志和日志条目结构正确。 | 不证明真实浏览器截图。 |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/Board.foundation.test.tsx --configLoader native --reporter=json --outputFile=temp/betrayal-board-radio-roll-panel-dedupe-20260828-report.json -t "无线电广播会在真实页面承接固定 2 骰、知识提升和精神伤害结果"` | JSON success true / 1 passed / 188 skipped | Board 代表链证明成功分支仍显示主事件 2 骰；低点数分支会把重新投骰阶段可见骰盘切为 1 颗伤害骰，伤害骰面板不渲染 outcome 标题，不显示“无线电广播 / 受到一颗骰子的精神伤害 / 重新投掷的伤害骰 / 待分配 2 点精神伤害”，主合计显示“伤害骰合计 2”；确认伤害骰前不显示伤害分配面板，确认后分配面板显示“分配 2 点精神伤害”并不再可见复写事件名，知识 / 神志可点击刻度尺卡片各自显示 1 步扣减且分配区不含“承担 N 点”或 `×N`。 | 不证明真实浏览器截图或全部事件逐张覆盖。 |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/Board.foundation.test.tsx --configLoader native --reporter=json --outputFile=temp/betrayal-board-trait-card-neighbor-20260828-report.json -t "火炉房\|脑状食品待选事件\|通用伤害能把多点分到同一条属性轨\|作祟前临界属性"` | JSON success true / 3 passed / 186 skipped | Board 相邻链证明房间伤害、通用伤害和临界属性仍能点击刻度尺卡片；同类事件选择分配区也不含“承担 N 点”或 `×N`。 | 不证明真实浏览器截图或全部事件逐张覆盖。 |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts --configLoader native --reporter=json --outputFile=temp/betrayal-firstScenarioRuntime-damage-roll-ack-20260828-report.json` | JSON success true / 695 passed | 领域层覆盖事件伤害机制族，并证明测试 helper 现在按真实确认顺序处理：翻牌说明可先确认，独立伤害骰必须确认后才分配；兔脚重掷命令只消费主事件的一颗骰，后续伤害骰在最终确认时用独立随机源生成。 | 不证明真实浏览器截图。 |
| `npm run test:e2e:file -- e2e/betrayal/action-log-undo-screenshots.e2e.ts` | 2 passed | 浏览器入口证明日志、撤回、事件触发、事件结果、重新投骰、伤害骰面板可见层不重复事件名、骰种标签和待分配句、确认伤害骰后才出现伤害分配面板、分配面板不重复可见事件名、属性刻度尺卡片是唯一可点击承伤承载者、属性扣减和日志记录均可见。 | 不证明 43 张事件逐张截图或死亡保护 / 减伤组合。 |
| `npm run test:e2e:file -- e2e/betrayal/event-choice-coverage.e2e.ts 电话铃声` | 3 passed | 同类链证明电话铃声也会把主事件骰和后续伤害骰拆成两个独立事件，并且派生伤害骰面板同样不重复事件名、骰种标签和待分配句；盔甲 / 头戴耳机链覆盖物理与精神减伤后的分配流程。 | 不证明事件全牌库逐张浏览器截图。 |
| `npm run test:e2e:file -- e2e/betrayal/trait-outcome-preview.e2e.ts` | 2 passed | 浏览器专项链证明通用伤害可连续点击同一条属性刻度尺卡片完成 2 点分配；急救包治疗预览的非交互属性轨不受影响。 | 不证明事件全牌库逐张浏览器截图。 |
| `npm run typecheck` | passed | 类型层证明本轮 TypeScript 改动没有类型错误。 | 不证明 i18n 全项目门禁；该门禁当前被 Dice Throne 无关脏改里的 3 个缺失翻译键阻断。 |
| `npm run spec:lint` | OK | 项目 AI 规范结构、索引和链接未被本轮 evidence / 规范回写破坏。 | 不证明游戏运行行为。 |
| `npm run audit:evidence:selfcheck -- evidence/betrayal/full-audit/event-effect-implementation-audit-2026-07-29.md "evidence/山屋惊魂-日志撤回截图验收/action-log-undo-radio-damage-closeout-20260827.md"` | OK | 两份审计 evidence 满足完整性自检。 | 不证明真实浏览器截图。 |
| `test-results/evidence-screenshots/betrayal/action-log-undo-radio-final/pass-manifest-separated-damage-roll-event-20260829.json` | PASS 清单已重建 | 最终展示图组使用 2026-08-28 23:05 后重拍的原图和 2026-08-29 00:07 生成的中文序号标记图；第 9 张重新投骰图证明事件名由事件牌 / 发现面板承接，伤害骰面板可见层不显示“无线电广播”“重新投掷的伤害骰”或“待分配 2 点精神伤害”，可见骰盘只有 1 颗伤害骰、主合计为“伤害骰合计 2”、不显示伤害分配面板；第 10 张才显示精神伤害分配，并要求分配面板不二次可见复写“无线电广播”、知识 / 神志刻度尺卡片是唯一可见承伤承载者，分配区不显示“承担 N 点”或 `×N`。 | 不证明范围外事件和组合。 |

## 截图索引

| 截图 | 证明内容 |
| --- | --- |
| `test-results/evidence-screenshots/betrayal/action-log-undo-screenshots/01-山屋惊魂-移动后操作日志面板.png` | 日志入口存在，玩家名不是占位。 |
| `test-results/evidence-screenshots/betrayal/action-log-undo-screenshots/02-山屋惊魂-撤回请求面板.png` | 撤回请求面板可打开。 |
| `test-results/evidence-screenshots/betrayal/action-log-undo-screenshots/03-山屋惊魂-触发事件牌.png` | 触发事件牌无线电广播。 |
| `test-results/evidence-screenshots/betrayal/action-log-undo-screenshots/04-山屋惊魂-事件结果面板.png` | 事件结果面板可见。 |
| `test-results/evidence-screenshots/betrayal/action-log-undo-screenshots/05-山屋惊魂-操作日志含事件触发与结果.png` | 操作日志含事件触发与事件结果。 |
| `test-results/evidence-screenshots/betrayal/radio-event-damage-flow/01-无线电广播-探索前玩家名与属性.png` | 伤害前玩家名与属性基线。 |
| `test-results/evidence-screenshots/betrayal/radio-event-damage-flow/02-无线电广播-低点数受伤分支.png` | 低点数分支命中“受到一颗骰子的精神伤害”。 |
| `test-results/evidence-screenshots/betrayal/radio-event-damage-flow/03-无线电广播-事件骰结果.png` | 主事件骰总点数 0。 |
| `test-results/evidence-screenshots/betrayal/radio-event-damage-flow/04-无线电广播-重新投掷一颗骰子.png` | 派生伤害骰为 2；事件名由事件牌 / 发现面板承接，伤害骰面板不再可见显示“无线电广播”“重新投掷的伤害骰”或“待分配 2 点精神伤害”，可见骰盘只显示 1 颗伤害骰，主合计为“伤害骰合计 2”；不再可见复写重新投骰、待分配、合计、骰面小计或加值 0；此时不显示伤害分配面板。 |
| `test-results/evidence-screenshots/betrayal/radio-event-damage-flow/05-无线电广播-精神伤害分配面板.png` | 确认伤害骰后才显示精神伤害分配面板，只允许知识 / 神志；事件名由事件卡承接，分配面板不再可见重复“无线电广播”；玩家直接点击知识 / 神志刻度尺卡片分配，分配区不显示“承担 N 点”或 `×N`。 |
| `test-results/evidence-screenshots/betrayal/radio-event-damage-flow/06-无线电广播-分配后属性结果.png` | 分配后知识和神志各减少 1，面板关闭。 |
| `test-results/evidence-screenshots/betrayal/radio-event-damage-flow/07-无线电广播-日志记录重新投骰与分配.png` | 操作日志记录真实玩家名、重新投骰、待分配伤害和分配结果。 |

## 缺口分类与范围裁定

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞本轮结论 | 当前范围裁定 | 最小补救 |
| --- | --- | --- | --- | --- | --- |
| 43 张事件逐张真实入口截图 | 非阻塞扩展 | 否 | 否 | 当前范围外 | 另开事件全牌库截图任务。 |
| 死亡保护 / 减伤 / 兔脚等组合 | 非阻塞扩展 | 否 | 否 | 当前范围外 | 按伤害与重掷矩阵另建组合验证。 |
| 全项目 i18n 门禁 | 审计留档缺口 | 否 | 否 | 当前范围外；`npm run i18n:check` 当前失败于 Dice Throne 吸血鬼领主改动缺少 3 个中英文翻译键：`bonusDie.effect.vampireLordMesmerizeDie`、`choices.vampireLordBloodPossessed.inflictBleed`、`choices.vampireLordBloodPossessed.gainMesmerize`。本轮山屋改动没有新增未成对的翻译键。 | 另按 Dice Throne 吸血鬼领主任务补 i18n；不在本轮山屋日志 / 撤回 / 无线电广播伤害链范围内。 |

## 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | passed | 范围锁定为日志、撤回、无线电广播低点数伤害骰；事件伤害机制族按 `rolledDamage`、`fixedDamage`、`generalDamageChoice` 三类流程回写。 |
| 真相源状态 | passed | 无线电广播配置和当前实现均在仓内，规则子句已锁定。 |
| 原子语义断言 | passed | 上方逐项表拆出玩家名、撤回、事件触发、派生重新投骰、待分配精神伤害、玩家分配、最终扣减和日志记录。 |
| 实现消费链 | passed | `game.ts`、`Board.tsx`、`actionLog.ts` 和 E2E 入口均已列出。 |
| 最终权威结果 | passed | E2E 断言 `rolledDamageResults`、`pendingDamageAllocation`、分配后 pending 清空和精神属性扣减。 |
| 交互真实入口 | passed | Playwright 真实浏览器截图组覆盖。 |
| 验证证据 | passed | 单测、E2E、typecheck 和 20260829 PASS manifest 均记录。 |
| 共享影响与代表链依据 | passed | 事件效果 evidence 已列 31 个事件伤害子句：`rolledDamage` 13 个、`fixedDamage` 13 个、`generalDamageChoice` 5 个。 |
| 缺口分类与范围裁定 | passed | 范围外组合和逐事件截图均归类为非阻塞扩展。 |
| 旧 evidence / 旧结论回写 | passed | 旧无线电广播 UI 代表链已在事件效果 evidence 中降级。 |
| 残余范围声明 | passed | 明确不外推为 43 张事件逐张 E2E。 |

## 修订 / 失效记录

| 项 | 结论 |
| --- | --- |
| 旧文档路径 | `evidence/betrayal/full-audit/event-effect-implementation-audit-2026-07-29.md` |
| 旧结论 | 无线电广播 Board 代表链只展示“受到一颗骰子的精神伤害”和旧式“受到 1 颗骰子的精神伤害”。 |
| 失效原因 | 旧证据没有证明派生伤害骰实际点数、合计、待分配状态、玩家属性分配、最终扣减和操作日志；上一版截图还把主事件两颗骰子的可见骰盘留在重新投骰画面里，随后的一颗骰修复仍把“受到一颗骰子的精神伤害”放在主标题、把事件总点数 0 放在伤害骰主合计，并把伤害骰和伤害分配压到同一帧，玩家会误读为“投出 2 但总点数 0”，也会感觉 08-09 之间少了独立伤害骰确认；再后一版只修了伤害骰结果层，没有继续审 10 图的分配面板，导致事件名“无线电广播”和内部计数 `×1` 在分配 UI 里继续影响可读性；随后把 `×1` 改成“承担 1 点”仍然没有解决刻度尺与按钮双承载者的重复问题。 |
| 替代证据 | 本文 E2E 截图组和 `event-rolled-damage-resolution` 共享流程重审。 |
| 新结论 | 无线电广播派生重新投骰与精神伤害分配全流程 PASS；31 个事件伤害子句按三类共享流程完成机制族重审回写。 |

## 对外汇报口径

- 允许说：本轮锁定的日志、撤回、无线电广播低点数重新投骰与精神伤害分配全流程已经由真实浏览器 E2E 和截图证明为 PASS。
- 允许说：旧审计口径有缺口，已经把派生随机 / 二次骰 / 待分配伤害 / 玩家承伤属性选择 / 可见信息唯一承载者纳入审计主规则，并把 31 个事件伤害子句按 `rolledDamage` 13 个、`fixedDamage` 13 个、`generalDamageChoice` 5 个回写清单。
- 禁止说：山屋 43 张事件逐张真实入口截图都完成。
- 禁止说：死亡保护、减伤、兔脚等组合矩阵都完成。
