# Mage Wars 教程单入口 E2E 证据

> 状态：`tutorial-desktop-single-entry-continuation-e2e-pass / current-scope-tutorial-pass / rules-source-text-enforced / representative-continuations-marked / not-main-golden-flow / not-full-game-closeout`。本文件证明 Mage Wars 桌面教程已经改为一个玩家可见入口：`/play/mage-wars/tutorial` 直接进入首局流程；墙体、守卫、治疗、燃烧与复原术作为隐藏续段自动串联，不再作为五个平级目录章节。它不是 Mage Wars 主黄金链完成证据，也不证明完整实体版 Mage Wars、全卡表、自由构筑、移动教程或服务器资源发布已经闭合。

## 范围

- 入口：`/play/mage-wars/tutorial`。目录不再显示五张机制卡；默认教程直接从胜利条件、牌桌和法师读数开始。
- 玩家可见主入口：`mage-wars-basic`，标题为“首局流程：读局、计划与常见结算”。
- 隐藏续段：`mage-wars-wall-and-line-of-sight -> mage-wars-guard -> mage-wars-healing -> mage-wars-restore-and-burn`。这些路由保留为代表局面续段和旧直达入口，但 `hiddenFromCatalog=true`，不再作为目录平级章节。
- 连续性边界：基础段从真实教程初始局自然推进到灰狼移动；后续墙体、守卫、治疗和复原术使用教程代表局面自动续接。每个续段内的核心动作仍由玩家点击正式 UI 完成，但整条教程不登记为主黄金链自然整局。

## 验证命令

```powershell
npm run spec:lint
npx tsc --noEmit --pretty false --skipLibCheck false --project tsconfig.json
node scripts/infra/vitest-cli-safe.mjs run src/games/mage-wars/__tests__/tutorial.test.ts src/games/mage-wars/__tests__/Board.fx.test.tsx --config vitest.config.core.ts --configLoader native
node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/useMatchRoomTutorialLifecycle.test.tsx --configLoader native
$env:PW_E2E_SERVICE_REUSE='isolated'
node scripts/infra/run-e2e-command.mjs isolated e2e/mage-wars/mage-wars-tutorial.e2e.ts
```

结果：

- 项目规范 lint 通过：`spec-lint: OK`。
- TypeScript 静态检查通过，输出为空。
- Mage Wars 教程 / Board FX 窄单测通过：`2 files / 49 tests passed`。React `act(...)` warning 为既有测试告警，不阻断本轮结论。
- 教程生命周期共享测试通过：`1 file / 16 tests passed`，覆盖默认入口与隐藏续段生命周期。
- 浏览器 E2E 独立 runtime 通过：`1 passed (53.9s)`，生成 21 张当前有效原图。

## 覆盖矩阵

| 玩家要学会的现实动作 / 判断 | 教程步骤 / 主教学时刻 | 正式 UI 承接物 | E2E / 截图证据 | 当前状态 |
| --- | --- | --- | --- | --- |
| 不是先选五个机制章节，而是从首局读局开始 | `intro` | 正式牌桌、法师和教程浮层 | `00-intro-board-and-win.png`；E2E 从 `/play/mage-wars/tutorial` 直接进入牌桌 | 已覆盖 |
| 游戏目标、生命 / 伤害 / 法力 / 聚魔 / 行动 / 快速施法读数 | `intro`、`self-hud`、`opponent-hud` | 己方法师 HUD、对手 HUD、法师实体 | `00-intro-board-and-win.png`、`01-read-mage-hud-life-mana-channeling.png`；单测断言 `mw-self-hud` / `mw-opponent-hud` 锚点 | 已覆盖 |
| 准备环节、聚魔和法力变化 | `advance-channel`、`channel-result` | 阶段条、回合结束按钮、己方法师 HUD | `02-channel-result-mana-increased.png`；E2E 断言兽王法力从 10 增至 20 | 已覆盖 |
| 计划法术、准备槽、对手隐藏计划和公开弃牌 | `plan-wolf`、`prepared-and-hidden`、`discard-reading` | 法术书、己方准备牌、对手计划牌背、弃牌堆 | `03-plan-spells.png`、`06-opponent-discard-reading.png`；E2E 断言准备牌与对手弃牌堆 | 已覆盖 |
| 召唤生物必须选择合法区域，不自动落点 | `deploy-wolf` | 准备区“丛林灰狼”、A3 合法目标整格高亮 | `04-summon-target-zone-highlight.png`；E2E 断言 `data-legal-target-zone="true"` 后点击 A3 | 已覆盖 |
| 唤醒本回合召唤的生物，并读准备区 / 弃牌结果 | `rouse-wolf`、`opponent-deploy` | 准备区“兽性觉醒”、场上丛林灰狼、弃牌堆 | `05-roused-wolf-ready.png`；E2E 断言灰狼行动可用、己方弃牌为 `3403,2819` | 已覆盖 |
| 生物行动阶段移动到相邻区域 | `move-wolf` | 场上丛林灰狼、A2 合法移动格 | `07-wolf-moved-to-a2.png`；E2E 断言灰狼移动到 A2 且行动已用 | 已覆盖 |
| 墙体来源是准备牌，目标是区域边界，结算后边界显示源墙牌 | `wall-purpose`、`cast-thorns-wall`、`wall-card-on-edge` | `25700` 荆棘之墙准备牌、A3-B3 边界、边界墙牌 | `08-wall-prepared.png`、`09-wall-edge-target-highlight.png`、`10-wall-card-on-edge.png`；E2E 断言 `data-wall-visual="spell-card"` | 已覆盖 |
| 墙体影响视线和通行伤害的规则读法 | `line-of-sight-and-passage` | 边界墙牌、教程说明 | `11-wall-line-of-sight-and-passage.png`；墙体局部玩法链另见 `evidence/mage-wars-wall-mechanics/e2e-test.md` | 已覆盖 |
| 守卫是生物快速行动；玩家点来源单位，再点中下行动条“进行守卫”，结算后才获得守卫 token | `guard-rule`、`guard-cleric`、`guard-token-result` | 阿希拉牧师、`mw-selected-unit-guard` 文本行动按钮、守卫 token rail | `12-guard-action-dock.png`、`13-guard-token-result.png`；E2E 断言守卫按钮在中下 action dock、是文本行动、无 img/svg，并断言守卫状态为 true | 已覆盖 |
| 治疗之光必须选来源、点中下动作按钮、再点合法目标 | `healing-rule`、`heal-wounded-bobcat` | 阿希拉牧师、`mw-ability-action-dock`、治疗之光按钮、野性山猫目标框 | `14-healing-light-action-dock.png`、`15-healing-target-highlight.png`、`16-healing-result-life-readout.png`；E2E 断言伤害降低 | 已覆盖 |
| 伤害 / 生命读数由眼睛控制常显 | `life-toggle` | `mw-life-toggle`、对象生命读数 | `17-life-toggle-all-readouts.png`；E2E 断言 `data-life-visible="true"` | 已覆盖 |
| 复原术必须选女祭司法师、点能力、再点燃烧目标 | `burn-rule`、`restore-burning-cleric`、`restore-result` | 女祭司法师实体、复原术按钮、燃烧牧师目标框 | `18-restore-action-dock.png`、`19-restore-burn-target-highlight.png`、`20-restore-burn-removed.png`；E2E 断言燃烧 token 被移除 | 已覆盖 |
| 玩家文案不再使用“这一章只教学”或验收话术 | 全部教程文案 | 语言包 tutorial 区块 | `src/games/mage-wars/__tests__/tutorial.test.ts` 扫描中英文 tutorial 文案 | 已覆盖 |

## 截图清单

当前有效原图目录：`test-results/evidence-screenshots/mage-wars/tutorial/`。

| 顺序 | 原图 | 肉眼观察结论 |
| ---: | --- | --- |
| 00 | `00-intro-board-and-win.png` | 教程第一张图是正式牌桌和胜利条件，不是目录卡或召唤中段。 |
| 01 | `01-read-mage-hud-life-mana-channeling.png` | 己方法师 HUD 被点名，生命、伤害、法力、聚魔、行动和快速施法读数可见。 |
| 02 | `02-channel-result-mana-increased.png` | 聚魔后兽王法力增加，玩家能看到资源变化。 |
| 03 | `03-plan-spells.png` | 法术书卡列可见，玩家在正式法术书里选择丛林灰狼和兽性觉醒。 |
| 04 | `04-summon-target-zone-highlight.png` | 丛林灰狼被选中后，A3 整个合法召唤区域高亮；玩家尚未点击区域前不会自动落点。 |
| 05 | `05-roused-wolf-ready.png` | 丛林灰狼已部署并被兽性觉醒唤醒，准备区、弃牌和场上结果可读。 |
| 06 | `06-opponent-discard-reading.png` | 对手公开弃牌堆入口被点名，教程覆盖弃牌堆读法。 |
| 07 | `07-wolf-moved-to-a2.png` | 灰狼移动后落到 A2，玩家能看到位置变化和行动已用。 |
| 08 | `08-wall-prepared.png` | 荆棘之墙在准备区可见，墙体续段从来源牌开始。 |
| 09 | `09-wall-edge-target-highlight.png` | 合法目标高亮在 A3-B3 边界带上，玩家点击边界而不是整格。 |
| 10 | `10-wall-card-on-edge.png` | A3-B3 边界出现荆棘之墙正式牌面，墙体不是泛化色条。 |
| 11 | `11-wall-line-of-sight-and-passage.png` | 墙牌仍贴在边界上，说明承接视线和通行伤害。 |
| 12 | `12-guard-action-dock.png` | 阿希拉牧师被选中后，中下行动条显示文本按钮“进行守卫”；此时守卫 token 还不是点击目标。 |
| 13 | `13-guard-token-result.png` | 守卫 token 停在单位正下方，不遮挡角色牌面。 |
| 14 | `14-healing-light-action-dock.png` | 治疗之光按钮位于屏幕中下 action dock，顶部只保留说明提示。 |
| 15 | `15-healing-target-highlight.png` | 野性山猫合法目标用贴卡本体边框表达，玩家点击目标后才结算。 |
| 16 | `16-healing-result-life-readout.png` | 治疗后有绿色治疗反馈和生命读数承接，结果不只靠日志。 |
| 17 | `17-life-toggle-all-readouts.png` | 眼睛按钮打开后，全场生命读数常显，仍贴对象本体。 |
| 18 | `18-restore-action-dock.png` | 女祭司法师被选中后，复原术按钮出现在屏幕中下 action dock。 |
| 19 | `19-restore-burn-target-highlight.png` | 燃烧目标有贴合卡牌本体的目标框，复原术没有自动选唯一目标。 |
| 20 | `20-restore-burn-removed.png` | 燃烧 token 移除，主界面停在结算结果可读状态。 |

旧文件名 `00-catalog.png`、`01-basic-intro.png` 到 `19-restore-burn-removed.png` 是历史残留，不属于本轮当前有效截图组，不能再作为教程完成口径。

## 图面自审

```text
verdict: PASS
score: 95/100
target_requirements:
  - requirement: 教程不再以五章节目录作为玩家第一步
    status: PASS
    evidence: 00 图直接进入正式牌桌；单测断言只有 mage-wars-basic 可见，四个续段 hiddenFromCatalog=true
  - requirement: 基础读数必须覆盖生命、伤害、法力、聚魔、行动和快速施法
    status: PASS
    evidence: 01 图与 selfHud 文案；单测断言 mw-self-hud / mw-opponent-hud 锚点
  - requirement: 核心机制按玩家顺序合并教学，并保留各自动作 / 结果证据
    status: PASS
    evidence: 04-20 图覆盖召唤、移动、墙体、守卫、治疗、生命眼睛和复原术
  - requirement: 目标选择不得自动代选
    status: PASS
    evidence: 04、09、15、19 均为玩家点击目标前的合法目标图，E2E 后续真实点击目标
  - requirement: 守卫用 token，伤害用受伤遮罩 + 生命读数，并有眼睛控制
    status: PASS
    evidence: 12 是守卫行动按钮，13 是结算后的守卫 token；16-17 生命读数
hard_failures: []
negative_impact_checks:
  - 法术书、准备区、对手计划、弃牌堆、法师 HUD、主棋盘和能力 action dock 仍可见，没有被新增教程承载替换。
issues: []
```

## 收口口径

- 可以说：Mage Wars 桌面教程单入口端到端已通过，当前教程截图组为 21 张有序原图。
- 可以说：教程现在按玩家流程覆盖读局、聚魔、计划、召唤、公开弃牌、移动、墙体、守卫、治疗、生命眼睛和复原术。
- 可以说：墙体、守卫、治疗和复原术是同一教程入口自动串联的隐藏续段，不再作为五个平级目录章节。
- 不能说：Mage Wars 主黄金链已完成、完整实体版 Mage Wars 已完成、全卡表已完成、移动教程已完成、服务器资源已发布。
