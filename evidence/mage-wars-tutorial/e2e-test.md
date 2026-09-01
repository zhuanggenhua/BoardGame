# Mage Wars 教程与流程同步 E2E 证据

> 状态：`tutorial-desktop-flow-sync-e2e-pass / current-scope-tutorial-pass / transition-screenshots-restored / non-flow-fab-hidden-only / not-full-game-closeout`。本文件记录 2026-09-01 对 Mage Wars 教程、确认计划进度、部署过渡、地图视口和截图证据链的当前验证结果；它不是完整实体版 Mage Wars、全卡表、主黄金链、移动教程或服务器资源发布完成宣告。

## 本轮结论

- `确认计划为什么不用 x/y`：这是正式 UI 缺口。确认计划按钮已改为显示槽位进度：`确认计划 1/2`、`确认计划 2/2`，E2E 同时断言按钮进度属性和玩家可见文本。
- `5-6 怎么没有任何过渡`：旧图组证据不合格。中间操作不是没有执行，而是旧截图链漏拍了关键承接帧；新版补了确认计划后准备区、召唤目标、灰狼已召唤但未就绪、兽性觉醒目标、唤醒结果。
- `突然就完成部署`：这是旧 E2E 截图证据问题，同时教程缺少一个可见过渡步骤。新版补了己方部署让过、对手部署提示、对手法术结果、对手让过部署，之后才进入快速施法。
- `是教程有问题还是端到端有问题`：两边都有问题。教程缺少 `wolf-summoned` 过渡步骤；端到端截图链没有按玩家流程保留相邻状态证据。两边都已同步修正。

## 本轮修正范围

- 入口：`/play/mage-wars/tutorial`。若进入目录页，E2E 点击 `mage-wars-basic` 后进入正式牌桌；运行态仍使用正式 `MageWarsBoard`。
- 计划槽位：准备法术上限抽成 `MAGE_WARS_MAX_PREPARED_SPELLS = 2`，正式 UI、领域校验、测试和文案共用同一个 2 槽位事实。
- 教程步骤：在部署灰狼和兽性觉醒之间新增可见步骤 `wolf-summoned`，说明灰狼已经召唤到场上但尚未就绪。
- E2E 截图：有效截图目录切换为 `test-results/evidence-screenshots/mage-wars/tutorial-flow-sync/`，旧 `tutorial/` 目录不再作为本轮最终证据。
- E2E 隐藏范围：只允许隐藏全局非流程 FAB；不得隐藏游戏 HUD、阶段按钮、法术书、准备牌、地图、目标、确认入口、提示卡或放大入口。
- 地图截图：`00b-dragged-map-full-viewport.png` 直接设置拖拽后地图姿态，用于证明拖拽后的地图覆盖整张牌桌视口，而不是框内百分比位移；该图不冒充鼠标手势本身。

## 验证命令

```powershell
npm run i18n:check
npx vitest run src/games/mage-wars/__tests__/tutorial.test.ts src/games/mage-wars/__tests__/domain-flow.test.ts src/games/mage-wars/__tests__/Board.fx.test.tsx --reporter=dot
npm run spec:lint
npm run typecheck
npm run test:e2e:file -- e2e/mage-wars/mage-wars-tutorial.e2e.ts
```

结果：

- 语言包检查通过：`i18n-check: no missing keys detected`；仍有既有 baseline warning：`raw-prompt-option-label=1`。
- Mage Wars 教程相关单测通过：`3 passed / 261 tests passed`。输出中仍有既有 React `act(...)` warning 和命令拒绝日志；本轮退出码为 0。
- 项目规范 lint 通过：`spec-lint: OK`。
- TypeScript 通过：`tsc --noEmit` 无错误。
- Mage Wars 教程 E2E 通过：`1 passed`，用例 `单入口教程按玩家流程覆盖读局、计划、召唤、墙体、守卫、治疗和复原术`，浏览器内运行约 `42.8s`。
- 本次 E2E 启动前重任务守卫等待了 2 次后继续；这是资源排队，不是用例失败。

## 覆盖矩阵

| 玩家要学会的现实动作 / 判断 | 教程步骤 / 主教学时刻 | 正式 UI 承接物 | E2E / 截图证据 | 当前状态 |
| --- | --- | --- | --- | --- |
| 进入教程后读正式牌桌和胜利目标，不出现无职责“正式竞技场”标题 | `intro` | 正式牌桌、法师、教程浮层 | `00-intro-board-and-win.png`；E2E 断言牌桌不含“正式竞技场” | 已覆盖 |
| 地图拖拽后是整张牌桌场景，不是小框；HUD 不随地图跑 | `intro` 后视口姿态检查 | 地图视口、底部 HUD、左上眼睛 | `00b-dragged-map-full-viewport.png`；E2E 断言 viewport 与 board 几何贴合 | 已覆盖 |
| 法师 HUD 读数和提示卡可检视 | `self-hud`、`opponent-hud` | 双方法师 HUD、提示卡、放大层 | `01-read-mage-hud-life-mana-channeling.png`；Board 单测覆盖提示卡点击放大 | 已覆盖 |
| 聚魔是系统自动结算，不要求玩家点结束回合 | `channel-result` | 阶段流程、双方法力 HUD | `02-channel-result-mana-increased.png`；领域单测断言进入计划前双方都已获得法力 | 已覆盖 |
| 计划法术要显示槽位进度 x/y | `plan-wolf` | 法术书、确认计划按钮、准备槽 | `03-plan-selected-one-of-two.png`、`04-plan-selected-two-of-two-confirm.png`；E2E 断言 `1/2` 与 `2/2` | 已覆盖 |
| 确认计划后要看到己方准备牌和对手隐藏计划 | `prepared-and-hidden` | 己方准备牌、对手准备牌背 | `05-prepared-and-hidden.png`；E2E 断言己方准备牌为 2819、3403 | 已覆盖 |
| 召唤灰狼必须先看到合法区域，再看到灰狼落场且未就绪 | `deploy-wolf`、`wolf-summoned` | 准备牌、A3 目标格、场上灰狼 | `06-summon-target-zone-highlight.png`、`07-wolf-summoned-not-ready.png` | 已覆盖 |
| 兽性觉醒必须高亮灰狼本体，结算后灰狼就绪 | `rouse-wolf` | 兽性觉醒准备牌、场上灰狼、就绪状态 | `08-rouse-target-wolf-highlight.png`、`09-roused-wolf-ready-and-end-deployment.png` | 已覆盖 |
| 部署不会突然完成；己方让过后应看到对手部署窗口和对手让过 | `pass-your-deployment`、对手部署承接、`skip-initiative-quickcast` | 阶段推进按钮、对手提示、弃牌阅读 | `10-opponent-deploy-prompt.png`、`11-opponent-spell-result-and-discard-reading.png`、`12-opponent-pass-deployment.png`、`13-skip-initiative-quickcast.png` | 已覆盖 |
| 召唤、唤醒和移动仍由玩家点击真实对象 / 目标完成 | `deploy-wolf`、`rouse-wolf`、`move-wolf` | 准备牌、场上灰狼、合法区域 | `06` 到 `14` | 已覆盖 |
| 墙体来源是准备牌，目标是区域边界，结算后边界显示源墙牌 | `wall-purpose`、`cast-thorns-wall`、`wall-card-on-edge` | 荆棘之墙准备牌、A3-B3 边界、边界墙牌 | `15-wall-prepared.png` 到 `18-wall-line-of-sight-and-passage.png` | 已覆盖 |
| 守卫、治疗、生命眼睛和复原术按机制练习入口接续 | 对应机制教程 | 正式来源对象、动作按钮、目标框、结果 token / 读数 | `19-guard-action-dock.png` 到 `27-restore-burn-removed.png` | 已覆盖 |

## 当前有效截图清单

当前有效原图目录：`test-results/evidence-screenshots/mage-wars/tutorial-flow-sync/`。本轮重跑 E2E 后有效原图共 29 张：

| 顺序 | 原图 | 证据角色 |
| ---: | --- | --- |
| 00 | `00-intro-board-and-win.png` | 进入正式牌桌、胜利目标、无“正式竞技场”标题 |
| 00b | `00b-dragged-map-full-viewport.png` | 地图拖拽后整张牌桌视口姿态，HUD 不随地图移动 |
| 01 | `01-read-mage-hud-life-mana-channeling.png` | 法师 HUD 读数 |
| 02 | `02-channel-result-mana-increased.png` | 自动聚魔后的法力变化 |
| 03 | `03-plan-selected-one-of-two.png` | 计划第 1 张，确认按钮显示 `1/2` |
| 04 | `04-plan-selected-two-of-two-confirm.png` | 计划第 2 张，确认按钮显示 `2/2` |
| 05 | `05-prepared-and-hidden.png` | 确认计划后己方准备牌可见，对手计划隐藏 |
| 06 | `06-summon-target-zone-highlight.png` | 召唤目标区域高亮 |
| 07 | `07-wolf-summoned-not-ready.png` | 灰狼已召唤但未就绪 |
| 08 | `08-rouse-target-wolf-highlight.png` | 兽性觉醒高亮灰狼本体 |
| 09 | `09-roused-wolf-ready-and-end-deployment.png` | 灰狼被唤醒，己方部署窗口可让过 |
| 10 | `10-opponent-deploy-prompt.png` | 己方让过后切到对手部署提示 |
| 11 | `11-opponent-spell-result-and-discard-reading.png` | 对手法术结果与公开弃牌阅读 |
| 12 | `12-opponent-pass-deployment.png` | 对手部署窗口让过 |
| 13 | `13-skip-initiative-quickcast.png` | 进入快速施法窗口，按钮不叫结束回合 |
| 14 | `14-wolf-moved-to-a2.png` | 生物移动结果 |
| 15-18 | `15-wall-prepared.png` 到 `18-wall-line-of-sight-and-passage.png` | 墙体来源、边界目标、边界墙牌和视线说明 |
| 19-20 | `19-guard-action-dock.png`、`20-guard-token-result.png` | 守卫动作和守卫 token 结果 |
| 21-24 | `21-healing-light-action-dock.png` 到 `24-life-toggle-all-readouts.png` | 治疗、目标、结果和左上角生命眼睛 |
| 25-27 | `25-restore-action-dock.png` 到 `27-restore-burn-removed.png` | 复原术、燃烧目标和移除结果 |

## 用户可见图组

- 顺序标记源：`evidence/mage-wars-tutorial/sequence-labels-20260901-flow-sync-v2.json`。
- 用户展示 PASS 清单：`evidence/mage-wars-tutorial/pass-manifest-20260901-flow-sync-v2.json`。
- PureRef 标记图目录：`test-results/evidence-screenshots/mage-wars/tutorial-flow-sync/_labeled-for-pureref-20260901-flow-sync-v2/`。
- 标记图共 30 张：`00-sequence-index.png` + 29 张带编号流程图。

## 图面自审

```text
verdict: PASS
scope: current-user-request
checked_requirements:
  - 确认计划显示 x/y：PASS，03/04 分别证明 1/2 和 2/2。
  - 5-6 无过渡：PASS，05/06/07/08/09 补齐计划后、召唤、未就绪、唤醒目标和唤醒结果。
  - 突然完成部署：PASS，10/11/12 显示对手部署承接，13 才进入快速施法。
  - 教程与实际流程同步：PASS，E2E 使用正式教程入口和正式牌桌，聚魔自动结算，玩家真实点击计划、部署、目标和让过。
  - 端到端隐藏关键流程：PASS，本轮只隐藏非流程 FAB，关键 HUD、阶段按钮、法术书、准备牌、地图、目标、提示卡都保留。
hard_failures: []
```

## 收口口径

- 可以说：Mage Wars 桌面教程当前范围端到端已通过，且本轮用户指出的计划进度、5→6 过渡、部署承接和地图视口证据已补齐。
- 可以说：旧 `tutorial/` 图组不再作为最终证据；本轮最终证据是 `tutorial-flow-sync/` 新图组。
- 不能说：完整实体版 Mage Wars、全卡表、主黄金链、移动教程或服务器资源发布已经完成。
