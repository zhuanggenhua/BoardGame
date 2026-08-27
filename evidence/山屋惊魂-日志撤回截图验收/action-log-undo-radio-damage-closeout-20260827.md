# 山屋惊魂日志 / 撤回 / 无线电广播伤害骰截图留档（2026-08-27）

## 基本信息

- 对象：山屋惊魂操作日志、撤回入口、无线电广播低点数分支的事件结果与派生伤害骰。
- 日期：2026-08-27。
- 文档类型：`closeout`。
- 关联 evidence：`evidence/betrayal/full-audit/event-effect-implementation-audit-2026-07-29.md` 的 `event-rolled-damage-resolution` 共享流程重审回写。

## 审计范围

- 本轮覆盖的游戏 / 模块 / 对象：`src/games/betrayal` 的操作日志、撤回入口、最近投骰面板和事件结果确认链。
- 本轮覆盖的规则子句或共享链路：无线电广播 0-2 分支“受到一颗骰子的精神伤害”，以及山屋所有 `rolledDamage` 子句共享的 `event-rolled-damage-resolution` 流程。
- 本轮使用的目标入口 / 环境：Playwright 真实浏览器 E2E，路由 `/test-match-room/betrayal?players=...`，玩家名为“薇薇安”。
- 明确不在本轮范围内的对象：43 张事件逐张真实入口截图、精神 / 物理伤害的死亡保护和减伤组合、脚注音频呈现、作祟后特殊状态。

## 结论等级

结论等级：`功能实现已验证`。

判定理由：本轮证据证明日志显示真实玩家名、撤回面板可打开、无线电广播事件触发与事件结果可见、低点数分支会独立投一颗伤害骰、确认后按骰点扣精神属性，并把伤害骰结果写入操作日志。该结论只覆盖本轮锁定范围，不外推为山屋 43 张事件逐张 E2E 完成。

## 权威来源

| 类型 | 来源 | 证明内容 |
| --- | --- | --- |
| 规则配置 | `src/games/betrayal/scenarioConfig.ts` 的无线电广播配置 | 主事件投 2 颗骰子；0-2 分支是 `rolledDamage`，`dice: 1`，`damageKind: mental`。 |
| 领域结算 | `src/games/betrayal/game.ts` | 事件分支确定后物化伤害骰；确认后把 `rolls`、`total`、`appliedAmount` 写入最近投骰快照并扣最终精神属性。 |
| 玩家可见结果 | `src/games/betrayal/Board.tsx` | 最近投骰面板显示伤害骰点数、合计和实际承受伤害。 |
| 操作日志 | `src/games/betrayal/actionLog.ts` | 日志用真实触发玩家写入事件结果和伤害骰结果。 |
| 截图与 E2E | `e2e/betrayal/action-log-undo-screenshots.e2e.ts` | 真实浏览器完整覆盖日志、撤回、事件触发、事件结果、伤害骰、属性扣减和日志记录。 |

## 原子语义与实现消费

| 对象 | 原子语义断言 | 实现消费点 | 最终权威结果 | 真实入口 / 验证证据 | 缺口分类 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 操作日志玩家名 | 玩家执行移动、探索和事件结算后，日志必须显示真实玩家名，不能显示“玩家 1”占位。 | `actionLog.ts` 通过 `playerId` 参数交给 HUD 玩家映射。 | 日志记录归属到触发玩家“薇薇安”。 | E2E 断言日志包含“薇薇安”且不包含“玩家 1 / 玩家1”。 | 无 | PASS |
| 撤回入口 | 移动后必须生成可撤回操作，并能打开撤回请求面板。 | `TestMatchRoom.tsx` 的测试 HUD 接入 `GameHUD`；撤回 FAB 打开 `fab-panel-undo-request`。 | 撤回请求面板可见，保留操作记录快照。 | 截图 `02-山屋惊魂-撤回请求面板.png`；E2E 断言面板和申请按钮可见。 | 无 | PASS |
| 无线电广播事件触发 | 探索事件房间后，玩家应看到事件牌“无线电广播”、主事件骰总点数和低点数分支文案。 | `game.ts` 生成 `recentRoll`；`Board.tsx` 的发现面板与最近投骰面板展示事件。 | 事件仍处于待确认事件结果，尚未正式扣伤害。 | 截图 `02-无线电广播-低点数受伤分支.png`、`03-无线电广播-事件骰结果.png`；E2E 断言事件牌、总点数 0 和分支文案。 | 无 | PASS |
| 派生伤害骰 | “受到一颗骰子的精神伤害”必须重新投一颗伤害骰，不是固定 1 点伤害，也不能复用主事件骰点数。 | `materializeEventEffect` 对 `rolledDamage` 独立调用 `rollDicePips`；随机队列 `[0, 0, 0.99]` 使主事件骰为 0 / 0，派生伤害骰为 2。 | 最近投骰快照记录 `rolledDamageResults: [{ rolls: [2], total: 2, appliedAmount: 2 }]`。 | 截图 `04-无线电广播-追加伤害骰结果.png`；E2E 断言 `data-damage-rolls=2`、合计 2、承受 2 点精神伤害。 | 无 | PASS |
| 确认后伤害结算 | 玩家确认事件结果后，精神属性应按伤害骰合计扣减。 | `EVENT_ROLL_FINALIZED` 调用 `applyEventEffect`，再把 snapshot 写回 `recentRoll.eventEffectSnapshot`。 | 精神属性轨从 6 降到 4，知识保持 2；最终状态不再停留在待确认事件骰。 | 截图 `05-无线电广播-精神属性扣减2点.png`；E2E 断言精神总值减少 2。 | 无 | PASS |
| 伤害骰日志 | 日志必须记录无线电广播结果、伤害骰点数、合计和实际承受伤害。 | `buildEventRolledDamageEntries` 读取 `recentRoll.eventEffectSnapshot.rolledDamageResults` 并写 `actionLog.eventRolledMentalDamageResult`。 | 操作日志包含“无线电广播伤害骰：2，合计 2，承受 2 点精神伤害”。 | 截图 `06-无线电广播-日志记录伤害骰.png`；E2E 断言完整日志文本。 | 无 | PASS |

## 共享流程引用

| 本对象 | 独立语义结论 | sharedFlowId | 一致性核对 | 剩余差异 | 是否需要直测 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 无线电广播低点数分支 | 主事件骰低点数后进入一颗精神伤害骰。 | `event-rolled-damage-resolution` | 触发时机：事件分支确定后；候选生成：无额外目标候选；权限判断：沿用事件确认；交互入口：最近投骰面板；payload / command 结构：`EVENT_ROLL_FINALIZED.effect`；执行入口：`applyEventEffect`；最终权威状态：精神属性轨扣减；清理语义：待确认事件骰清空；AI 或自动推进：不引入新合法动作。 | 事件名、1 颗骰、精神伤害。 | 否：本对象已经直测，其他 12 个子句按共享流程判等。 | PASS |

## 验证证据

| 命令 / 证据 | 结果 | 证明了什么 | 没有证明什么 |
| --- | --- | --- | --- |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/actionLogUndo.test.ts --configLoader native` | 6 passed | 单元层证明操作日志、撤回相关记录、无线电广播低点数伤害骰和日志条目结构正确。 | 不证明真实浏览器截图。 |
| `npm run test:e2e:file -- e2e/betrayal/action-log-undo-screenshots.e2e.ts` | 2 passed | 浏览器入口证明日志、撤回、事件触发、事件结果、伤害骰、属性扣减和日志记录均可见。 | 不证明 43 张事件逐张截图或死亡保护 / 减伤组合。 |
| `npm run typecheck` | passed | 类型层证明本轮 TypeScript 改动没有类型错误。 | 不证明 i18n 全项目门禁；该门禁另有无关旧告警。 |
| `test-results/evidence-screenshots/betrayal/action-log-undo-radio-final/pass-manifest-20260827.json` | PASS | 最终展示图组 12 张已标记为用户可见交付图。 | 不证明范围外事件和组合。 |

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
| `test-results/evidence-screenshots/betrayal/radio-event-damage-flow/04-无线电广播-追加伤害骰结果.png` | 派生伤害骰为 2，合计 2，承受 2 点精神伤害。 |
| `test-results/evidence-screenshots/betrayal/radio-event-damage-flow/05-无线电广播-精神属性扣减2点.png` | 确认后精神属性实际扣减。 |
| `test-results/evidence-screenshots/betrayal/radio-event-damage-flow/06-无线电广播-日志记录伤害骰.png` | 操作日志记录无线电广播伤害骰、合计和承受伤害。 |

## 缺口分类与范围裁定

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞本轮结论 | 当前范围裁定 | 最小补救 |
| --- | --- | --- | --- | --- | --- |
| 43 张事件逐张真实入口截图 | 非阻塞扩展 | 否 | 否 | 当前范围外 | 另开事件全牌库截图任务。 |
| 死亡保护 / 减伤 / 兔脚等组合 | 非阻塞扩展 | 否 | 否 | 当前范围外 | 按伤害与重掷矩阵另建组合验证。 |
| 全项目 i18n 门禁旧告警 | 审计留档缺口 | 否 | 否 | 当前范围外 | 另修 Dice Throne / Smash Up 旧告警或更新基线。 |

## 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | passed | 范围锁定为日志、撤回、无线电广播低点数伤害骰和 `rolledDamage` 共享流程。 |
| 真相源状态 | passed | 无线电广播配置和当前实现均在仓内，规则子句已锁定。 |
| 原子语义断言 | passed | 上方逐项表拆出玩家名、撤回、事件触发、派生伤害骰、最终扣减和日志记录。 |
| 实现消费链 | passed | `game.ts`、`Board.tsx`、`actionLog.ts` 和 E2E 入口均已列出。 |
| 最终权威结果 | passed | E2E 断言 `rolledDamageResults` 与精神属性扣减。 |
| 交互真实入口 | passed | Playwright 真实浏览器截图组覆盖。 |
| 验证证据 | passed | 单测、E2E、typecheck 和 PASS manifest 均记录。 |
| 共享影响与代表链依据 | passed | `event-rolled-damage-resolution` 已在事件效果 evidence 中列 13 个对象。 |
| 缺口分类与范围裁定 | passed | 范围外组合和逐事件截图均归类为非阻塞扩展。 |
| 旧 evidence / 旧结论回写 | passed | 旧无线电广播 UI 代表链已在事件效果 evidence 中降级。 |
| 残余范围声明 | passed | 明确不外推为 43 张事件逐张 E2E。 |

## 修订 / 失效记录

| 项 | 结论 |
| --- | --- |
| 旧文档路径 | `evidence/betrayal/full-audit/event-effect-implementation-audit-2026-07-29.md` |
| 旧结论 | 无线电广播 Board 代表链只展示“受到一颗骰子的精神伤害”和旧式“受到 1 颗骰子的精神伤害”。 |
| 失效原因 | 旧证据没有证明派生伤害骰实际点数、合计、最终扣减和操作日志。 |
| 替代证据 | 本文 E2E 截图组和 `event-rolled-damage-resolution` 共享流程重审。 |
| 新结论 | 无线电广播派生伤害骰全流程 PASS；其他 `rolledDamage` 子句按共享流程引用通过机制族重审。 |

## 对外汇报口径

- 允许说：本轮锁定的日志、撤回、无线电广播低点数伤害骰全流程已经由真实浏览器 E2E 和截图证明为 PASS。
- 允许说：旧审计口径有缺口，已经把派生随机 / 二次骰纳入审计主规则，并回写 13 个 `rolledDamage` 子句清单。
- 禁止说：山屋 43 张事件逐张真实入口截图都完成。
- 禁止说：死亡保护、减伤、兔脚等组合矩阵都完成。
