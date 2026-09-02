# Mage Wars 教程与流程同步 E2E 证据

> 状态：`tutorial-desktop-flow-sync-e2e-pass / current-scope-tutorial-pass / main-flow-images-only / plan-slot-sequence-asserted / non-flow-fab-hidden-only / not-full-game-closeout`。本文件记录 2026-09-02 对 Mage Wars 教程端到端主流程截图链的当前验证结果；它不是完整实体版 Mage Wars、全卡表、主黄金链、移动教程或服务器资源发布完成宣告。

## 本轮结论

- `02=>04 怎么验收的`：旧最终图组证据不合格。它把基础 Board 验证图和教程主流程图混在同一序号里，导致编号 02 / 04 不是同一条教程主流程的相邻动作。
- `02 为什么两个槽位都填满了`：旧 02 是 `foundation-board-runtime` 的计划选择验证图，不是教程第 02 步；它不应该放进教程最终主流程序号。
- `04 怎么又变了`：旧 04 才是教程里的计划 1/2 图，编号混排造成了流程错觉。当前 v3 图组的**原图编号**固定为 `02=聚魔结果，无计划草稿`、`03=计划 1/2`、`04=计划 2/2`；PureRef 标注图因为前面多一张 `00-sequence-index.png`，显示为 `04-labeled-03-plan-selected-one-of-two.png` 和 `05-labeled-04-plan-selected-two-of-two-confirm.png`。
- `现在不需要拖拽的截图`：已执行。教程 E2E 不再生成 `00b-dragged-map-full-viewport.png`，最终 v3 图组不含拖拽 / 缩放姿态诊断图。
- `自己验收教程全流程端到端`：已按当前主流程重新验收。E2E 从 `/play/mage-wars/tutorial` 进入正式牌桌，按玩家动作推进到计划、准备、召唤、点醒、让过、对手部署、快速施法、移动、墙体、守卫、治疗、生命眼睛和复原术收口。

## 修正范围

- 教程 E2E：测试开始先清空 `test-results/evidence-screenshots/mage-wars/tutorial-flow-sync/`，防止旧图残留进入当前证据。
- 教程 E2E：移除教程用例中的拖拽地图姿态截图；地图自由视窗继续由 `foundation-board-runtime.e2e.ts` 的专门用例验证，不占教程主流程序号。
- 计划槽位断言：`02-channel-result-mana-increased.png` 截图前必须没有计划草稿牌；`03-plan-selected-one-of-two.png` 截图前必须只有 1 张计划草稿牌，来源为 `2819` 且在第 1 槽；`04-plan-selected-two-of-two-confirm.png` 截图前必须有 2 张不同计划草稿牌，来源为 `2819` 与 `3403`，槽位分别为第 1 / 第 2 槽。
- 图组断言：教程 E2E 结尾会读取 `tutorial-flow-sync/` 当前文件列表，必须精确等于 `00` 到 `27` 的 28 张主流程图，并额外断言文件名里没有 `drag / dragged / zoom / map`。
- 证据规范：`.spec/knowledge/standards/e2e-verification.md` 新增“主流程图组不得混入辅助证据”门禁。
- 旧 / broad 清单降级：`pass-manifest-20260901-flow-sync-v2.json`、`mage-wars-current-ui-refactor-pass-20260901.json` 与 `mage-wars-current-ui-refactor-pass-20260902.json` 已标为 `SUPERSEDED`，不得继续作为当前教程开图依据。

## 验证命令

```powershell
npm run test:e2e:file -- e2e/mage-wars/mage-wars-tutorial.e2e.ts "单入口教程按玩家流程覆盖读局、计划、召唤、墙体、守卫、治疗和复原术"
```

结果：

- Mage Wars 教程 E2E 在新增 02/03/04 槽位和图组断言后通过：`1 passed`，浏览器内运行约 `41.4s`。
- 编码检查通过；仍有仓库既有可疑告警 4 条，均不在 Mage Wars 本轮改动范围内。

## 覆盖矩阵

| 玩家要学会的现实动作 / 判断 | 教程步骤 / 主教学时刻 | 正式 UI 承接物 | E2E / 截图证据 | 当前状态 |
| --- | --- | --- | --- | --- |
| 进入教程后读正式牌桌和胜利目标，不出现无职责“正式竞技场”标题 | `intro` | 正式牌桌、法师、教程浮层 | `00-intro-board-and-win.png`；E2E 断言牌桌不含“正式竞技场” | 已覆盖 |
| 法师 HUD 读数和提示卡可检视 | `self-hud`、`opponent-hud` | 双方法师 HUD、提示卡、放大层 | `01-read-mage-hud-life-mana-channeling.png`；Board 单测覆盖提示卡点击放大 | 已覆盖 |
| 聚魔是系统自动结算，不要求玩家点结束回合 | `channel-result` | 阶段流程、双方法力 HUD | `02-channel-result-mana-increased.png`；E2E 断言法力变为 20，且此时计划草稿数量为 0 | 已覆盖 |
| 计划法术要进入目标计划槽并显示 x/y | `plan-wolf` | 法术书、确认计划按钮、准备槽 | `03-plan-selected-one-of-two.png`、`04-plan-selected-two-of-two-confirm.png`；E2E 断言 `1/2`、`2/2`、草稿牌数量、来源和槽位序号 | 已覆盖 |
| 确认计划后要看到己方准备牌和对手隐藏计划 | `prepared-and-hidden` | 己方准备牌、对手准备牌背 | `05-prepared-and-hidden.png`；E2E 断言己方准备牌为 2819、3403 | 已覆盖 |
| 召唤灰狼必须先看到合法区域，再看到灰狼落场且未就绪 | `deploy-wolf`、`wolf-summoned` | 准备牌、A3 目标格、场上灰狼 | `06-summon-target-zone-highlight.png`、`07-wolf-summoned-not-ready.png` | 已覆盖 |
| 兽性觉醒必须高亮灰狼本体，结算后灰狼就绪 | `rouse-wolf` | 兽性觉醒准备牌、场上灰狼、就绪状态 | `08-rouse-target-wolf-highlight.png`、`09-roused-wolf-ready-and-end-deployment.png` | 已覆盖 |
| 部署不会突然完成；己方让过后应看到对手部署窗口和对手让过 | `pass-your-deployment`、对手部署承接、`skip-initiative-quickcast` | 阶段推进按钮、对手提示、弃牌阅读 | `10-opponent-deploy-prompt.png`、`11-opponent-spell-result-and-discard-reading.png`、`12-opponent-pass-deployment.png`、`13-skip-initiative-quickcast.png` | 已覆盖 |
| 召唤、唤醒和移动仍由玩家点击真实对象 / 目标完成 | `deploy-wolf`、`rouse-wolf`、`move-wolf` | 准备牌、场上灰狼、合法区域 | `06` 到 `14` | 已覆盖 |
| 墙体来源是准备牌，目标是区域边界，结算后边界显示源墙牌 | `wall-purpose`、`cast-thorns-wall`、`wall-card-on-edge` | 荆棘之墙准备牌、A3-B3 边界、边界墙牌 | `15-wall-prepared.png` 到 `18-wall-line-of-sight-and-passage.png` | 已覆盖 |
| 守卫、治疗、生命眼睛和复原术按机制练习入口接续 | 对应机制教程 | 正式来源对象、动作按钮、目标框、结果 token / 读数 | `19-guard-action-dock.png` 到 `27-restore-burn-removed.png` | 已覆盖 |

## 当前有效截图清单

当前有效原图目录：`test-results/evidence-screenshots/mage-wars/tutorial-flow-sync/`。本轮重跑 E2E 后有效原图共 28 张，只有教程主流程图：

| 顺序 | 原图 | 证据角色 |
| ---: | --- | --- |
| 00 | `00-intro-board-and-win.png` | 进入正式牌桌、胜利目标、无“正式竞技场”标题 |
| 01 | `01-read-mage-hud-life-mana-channeling.png` | 法师 HUD 读数 |
| 02 | `02-channel-result-mana-increased.png` | 自动聚魔后的法力变化 |
| 03 | `03-plan-selected-one-of-two.png` | 计划第 1 张，只有 1 张草稿法术进入计划槽 |
| 04 | `04-plan-selected-two-of-two-confirm.png` | 计划第 2 张，两张不同法术进入两个计划槽，确认按钮显示 `2/2` |
| 05 | `05-prepared-and-hidden.png` | 确认计划后己方准备牌可见，对手计划隐藏 |
| 06 | `06-summon-target-zone-highlight.png` | 召唤目标区域高亮 |
| 07 | `07-wolf-summoned-not-ready.png` | 灰狼已召唤但未就绪 |
| 08 | `08-rouse-target-wolf-highlight.png` | 兽性觉醒高亮灰狼本体 |
| 09 | `09-roused-wolf-ready-and-end-deployment.png` | 灰狼被唤醒，己方部署窗口可让过 |
| 10 | `10-opponent-deploy-prompt.png` | 己方让过后切到对手部署提示 |
| 11 | `11-opponent-spell-result-and-discard-reading.png` | 对手法术结果与公开弃牌阅读 |
| 12 | `12-opponent-pass-deployment.png` | 对手部署窗口让过 |
| 13 | `13-skip-initiative-quickcast.png` | 进入快速施法窗口，玩家真实选择让过 |
| 14 | `14-wolf-moved-to-a2.png` | 生物移动结果 |
| 15-18 | `15-wall-prepared.png` 到 `18-wall-line-of-sight-and-passage.png` | 墙体来源、边界目标、边界墙牌和视线说明 |
| 19-20 | `19-guard-action-dock.png`、`20-guard-token-result.png` | 守卫动作和守卫 token 结果 |
| 21-24 | `21-healing-light-action-dock.png` 到 `24-life-toggle-all-readouts.png` | 治疗、目标、结果和左上角生命眼睛 |
| 25-27 | `25-restore-action-dock.png` 到 `27-restore-burn-removed.png` | 复原术、燃烧目标和移除结果 |

## 用户可见图组

- 用户展示 PASS 清单：`evidence/mage-wars-tutorial/pass-manifest-20260902-flow-sync-v3.json`。
- PureRef 标记图目录：`test-results/evidence-screenshots/mage-wars/tutorial-flow-sync/_labeled-for-pureref-20260902-flow-sync-v3/`。
- 标记图共 29 张：`00-sequence-index.png` + 28 张带编号教程主流程图。
- 旧 `pass-manifest-20260901-flow-sync-v2.json`、`mage-wars-current-ui-refactor-pass-20260901.json`、`mage-wars-current-ui-refactor-pass-20260902.json` 和旧标注目录只保留为历史 / 诊断证据，不作为当前教程最终图组。

## 图面自审

```text
verdict: PASS
scope: current-user-request
checked_requirements:
  - 02=>04 编号混乱：PASS，v3 只保留教程主流程，原图 02=聚魔结果、03=计划 1/2、04=计划 2/2；标注图 04/05 只是因为前面有序号索引页。
  - 计划槽默认重复：PASS，E2E 断言 02 无计划草稿，03 只有 2819 且在第 1 槽，04 为 2819 与 3403 且分别在第 1 / 第 2 槽。
  - 不需要拖拽截图：PASS，教程 E2E 不再产出 00b，并在测试末尾断言图组文件名不含 drag / dragged / zoom / map。
  - 5=>6 无过渡：PASS，05/06/07/08/09 补齐确认计划后、召唤、未就绪、唤醒目标和唤醒结果。
  - 端到端隐藏关键流程：PASS，本轮只隐藏非流程 FAB，关键 HUD、阶段按钮、法术书、准备牌、地图、目标、提示卡都保留。
hard_failures: []
```

## 收口口径

- 可以说：Mage Wars 桌面教程当前范围端到端已通过，且本轮用户指出的 02=>04 编号混排、计划槽位误导、拖拽诊断图混入主流程、部署过渡缺失都已修正并重验。
- 不能说：完整实体版 Mage Wars、全卡表、主黄金链、移动教程或服务器资源发布已经完成。
