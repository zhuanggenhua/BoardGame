# Mage Wars 教程与流程同步 E2E 证据

> 状态：`tutorial-desktop-flow-sync-e2e-pass / current-scope-tutorial-pass / non-flow-fab-hidden-only / viewport-map-pose-evidence / not-main-golden-flow / not-full-game-closeout`。本文件记录 2026-09-01 对 Mage Wars 教程、阶段推进、地图视口和 UI 放大入口的当前验证结果；它不是完整实体版 Mage Wars、全卡表、主黄金链、移动教程或服务器资源发布完成宣告。

## 本轮修正范围

- 入口：`/play/mage-wars/tutorial`。若进入目录页，E2E 点击 `mage-wars-basic` 后进入正式牌桌；运行态仍使用正式 `MageWarsBoard`。
- 基础教程：按真实玩家流程覆盖读局、自动聚魔、计划法术、部署 / 唤醒灰狼、公开弃牌、先手快速施法让过和生物移动。
- 机制续接：墙体、守卫、治疗、生命眼睛、燃烧与复原术通过 `nextTutorialId` 串联；这些是独立机制练习入口，允许用明确预设局面，不再写成“隐藏续段”。
- E2E 隐藏范围：只调用 `disableNonFlowFabForE2e` 隐藏全局非流程 FAB；不得隐藏游戏 HUD、阶段按钮、法术书、准备牌、地图、目标、确认入口、提示卡或放大入口。
- 地图截图：`00b-dragged-map-full-viewport.png` 直接设置地图视口 transform 生成拖拽后姿态证据；该图证明布局姿态和 scene/HUD 分离，不冒充鼠标手势可用性。

## 验证命令

```powershell
npx vitest run src/games/mage-wars/__tests__/tutorial.test.ts src/games/mage-wars/__tests__/domain-flow.test.ts src/games/mage-wars/__tests__/Board.fx.test.tsx src/components/common/__tests__/MagnifyOverlay.test.tsx --reporter=dot
npm run spec:lint
npm run test:e2e:doctor
npm run test:e2e:file -- e2e/mage-wars/mage-wars-tutorial.e2e.ts
npm run i18n:check
npm run typecheck
npx eslint src/games/mage-wars/Board.tsx src/games/mage-wars/domain/flowHooks.ts src/games/mage-wars/__tests__/Board.fx.test.tsx src/games/mage-wars/__tests__/domain-flow.test.ts src/games/mage-wars/__tests__/tutorial.test.ts src/components/common/overlays/MagnifyOverlay.tsx src/components/common/__tests__/MagnifyOverlay.test.tsx e2e/helpers/common.ts e2e/mage-wars/mage-wars-tutorial.e2e.ts e2e/mage-wars/online-runtime.e2e.ts
git diff --check -- .spec/knowledge/standards/e2e-verification.md .spec/knowledge/standards/ui-change-gates.md .spec/knowledge/standards/ui-responsive-layout.md .spec/skills/mage-wars-ui-design-memory/SKILL.md docs/games/mage-wars/design/reference/user-correction-traceability-ledger.md e2e/helpers/common.ts e2e/mage-wars/mage-wars-tutorial.e2e.ts e2e/mage-wars/online-runtime.e2e.ts src/games/mage-wars/Board.tsx src/games/mage-wars/domain/flowHooks.ts src/games/mage-wars/__tests__/Board.fx.test.tsx src/games/mage-wars/__tests__/domain-flow.test.ts src/games/mage-wars/__tests__/tutorial.test.ts src/components/common/overlays/MagnifyOverlay.tsx src/components/common/__tests__/MagnifyOverlay.test.tsx public/locales/zh-CN/game-mage-wars.json public/locales/en/game-mage-wars.json
```

结果：

- 窄单测通过：`4 passed / 262 tests passed`。
- 规范 lint 通过：`spec-lint: OK`。
- E2E doctor 通过：无活跃重任务；单 worker E2E 端口空闲；可用内存约 `10.97GB`。
- 教程 E2E 通过：`1 passed`，用例 `单入口教程按玩家流程覆盖读局、计划、召唤、墙体、守卫、治疗和复原术`，浏览器内运行约 `39.3s`。
- i18n 检查通过：`no missing keys detected`。
- TypeScript 通过：`tsc --noEmit` 无错误。
- 本轮触碰代码 ESLint 子集无错误，仍有 11 条 warning，未阻断本轮验证。
- `git diff --check` 无空白错误；只出现 Git 换行提示。

## 覆盖矩阵

| 玩家要学会的现实动作 / 判断 | 教程步骤 / 主教学时刻 | 正式 UI 承接物 | E2E / 截图证据 | 当前状态 |
| --- | --- | --- | --- | --- |
| 进入教程后先读正式牌桌和胜利目标，不显示无职责“正式竞技场”标题 | `intro` | 正式牌桌、法师、教程浮层 | `00-intro-board-and-win.png`；E2E 断言牌桌不含“正式竞技场” | 已覆盖 |
| 地图拖拽后是整张牌桌场景，不是小框；HUD 不随地图跑 | `intro` 后的视口姿态检查 | `mage-wars-arena-viewport`、底部 HUD grid、左上眼睛 | `00b-dragged-map-full-viewport.png`；E2E 断言 viewport 近似等于 board，HUD/bottom grid 拖拽前后不动 | 已覆盖 |
| 法师 HUD 读数和提示卡可检视 | `self-hud`、`opponent-hud` | 双方法师 HUD、提示卡、放大层 | `01-read-mage-hud-life-mana-channeling.png`；Board 单测覆盖提示卡点击放大 | 已覆盖 |
| 聚魔是系统自动结算，不要求玩家点结束回合 | `channel-result` | 阶段流程、双方法力 HUD | `02-channel-result-mana-increased.png`；领域单测断言进入计划前双方都从 10 加到 20 | 已覆盖 |
| 计划法术、准备槽、对手隐藏计划和弃牌阅读 | `plan-wolf`、`prepared-and-hidden`、`discard-reading` | 法术书、准备牌、对手计划牌背、弃牌堆 | `03-plan-spells.png`、`06-opponent-discard-reading.png` | 已覆盖 |
| 部署和先手快速施法是当前窗口让过，不再显示“回合结束” | `pass-your-deployment`、`skip-initiative-quickcast` | 阶段推进按钮 | `07-skip-initiative-quickcast.png`；Board 单测断言 deployment=`actions.passDeployment`、quickcast=`actions.passQuickcast` | 已覆盖 |
| 召唤、唤醒和移动仍由玩家点击真实对象 / 目标完成 | `deploy-wolf`、`rouse-wolf`、`move-wolf` | 准备牌、场上灰狼、合法区域 | `04-summon-target-zone-highlight.png`、`05-roused-wolf-ready.png`、`08-wolf-moved-to-a2.png` | 已覆盖 |
| 墙体来源是准备牌，目标是区域边界，结算后边界显示源墙牌 | `wall-purpose`、`cast-thorns-wall`、`wall-card-on-edge` | 荆棘之墙准备牌、A3-B3 边界、边界墙牌 | `09-wall-prepared.png`、`10-wall-edge-target-highlight.png`、`11-wall-card-on-edge.png` | 已覆盖 |
| 守卫、治疗、生命眼睛和复原术按机制练习入口接续 | 对应机制教程 | 正式来源对象、动作按钮、目标框、结果 token / 读数 | `13-guard-action-dock.png` 到 `21-restore-burn-removed.png` | 已覆盖 |

## 截图清单

当前有效原图目录：`test-results/evidence-screenshots/mage-wars/tutorial/`。本轮当前有效截图按文件时间为 2026-09-01 14:31 生成：

| 顺序 | 原图 | 证据角色 |
| ---: | --- | --- |
| 00 | `00-intro-board-and-win.png` | 进入正式牌桌、胜利目标、无“正式竞技场”标题 |
| 00b | `00b-dragged-map-full-viewport.png` | 地图拖拽后整张牌桌视口姿态，HUD 不随地图移动 |
| 01 | `01-read-mage-hud-life-mana-channeling.png` | 法师 HUD 读数 |
| 02 | `02-channel-result-mana-increased.png` | 自动聚魔后的法力变化 |
| 03 | `03-plan-spells.png` | 法术书和计划选择 |
| 04 | `04-summon-target-zone-highlight.png` | 召唤目标格高亮 |
| 05 | `05-roused-wolf-ready.png` | 灰狼部署并被唤醒 |
| 06 | `06-opponent-discard-reading.png` | 公开弃牌堆阅读 |
| 07 | `07-skip-initiative-quickcast.png` | 快速施法窗口让过，不叫结束回合 |
| 08 | `08-wolf-moved-to-a2.png` | 生物移动结果 |
| 09-12 | `09-wall-prepared.png` 到 `12-wall-line-of-sight-and-passage.png` | 墙体来源、边界目标、边界墙牌和视线说明 |
| 13-14 | `13-guard-action-dock.png`、`14-guard-token-result.png` | 守卫动作和守卫 token 结果 |
| 15-18 | `15-healing-light-action-dock.png` 到 `18-life-toggle-all-readouts.png` | 治疗、目标、结果和生命眼睛 |
| 19-21 | `19-restore-action-dock.png` 到 `21-restore-burn-removed.png` | 复原术、燃烧目标和移除结果 |

同目录下更早的 `00-catalog.png`、`01-basic-*`、旧 `07-*` 等文件是历史残留，不属于本轮当前有效证据。

## 图面自审

```text
verdict: PASS
score: 95/100
target_requirements:
  - requirement: 教程与实际流程同步，不能教一套玩一套
    status: PASS
    evidence: E2E 使用正式 /play/mage-wars/tutorial 和正式 MageWarsBoard；基础流程从 reset 自动到 planning，再由玩家真实计划、部署、让过、移动
  - requirement: 聚魔不能要求手动点结束回合
    status: PASS
    evidence: flowHooks 自动推进 reset/channel/upkeep；领域单测断言双方聚魔后到 planning
  - requirement: E2E 不能隐藏关键流程，只允许隐藏非流程 FAB
    status: PASS
    evidence: 只调用 disableNonFlowFabForE2e；截图仍保留 HUD、阶段按钮、法术书、准备牌、地图、目标和提示卡
  - requirement: 地图拖拽后是全牌桌视口，不是小框
    status: PASS
    evidence: 00b 图和几何断言证明 viewport ≈ board，content 覆盖 viewport
  - requirement: 阶段推进按钮按当前窗口命名，不把部署/快速施法说成回合结束
    status: PASS
    evidence: Board 单测和双语文案扫描
hard_failures: []
negative_impact_checks:
  - 法术书、准备牌、对手计划、弃牌堆、法师 HUD、地图、能力 action dock 和教程提示仍可见。
issues: []
```

## 收口口径

- 可以说：Mage Wars 桌面教程当前范围端到端已通过，且基础教程和正式游戏流程已同步到当前验证范围。
- 可以说：本轮有效截图是 22 张：`00`、`00b`、`01` 到 `21`。
- 不能说：完整实体版 Mage Wars、全卡表、主黄金链、移动教程或服务器资源发布已经完成。
