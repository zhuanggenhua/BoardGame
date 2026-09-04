# Mage Wars 基础教程单入口自然主线 E2E 证据

> 状态：`tutorial-desktop-single-natural-flow-e2e-pass / current-scope-tutorial-pass / main-flow-images-only / no-catalog-for-single-tutorial / pure-ai-transition-hidden / non-flow-fab-hidden-only / not-full-game-closeout`。本文件记录当前 Mage Wars 基础教程的端到端主线验证结果；它不是完整实体版 Mage Wars、全卡表、墙体 / 守卫 / 治疗 / 复原术专题、移动端教程或服务器资源发布完成宣告。

## 本轮结论

- `2026-09-03 20:44 正常 E2E 复核`：已按项目 Playwright runtime 重跑 `npm run test:e2e:file -- e2e/mage-wars/mage-wars-tutorial.e2e.ts`，隔离测试端口为 `6174 / 20000 / 21000`，结果 `2 passed (56.9s)`。本次收口不使用 `http://127.0.0.1:4273/` 用户真实浏览器路径；4273 相关截图只保留为自适应专项诊断证据，不进入当前正常端到端主图组。
- `卡牌点击不能假触发`：已补回归门禁。计划阶段先真实点击卡牌右上放大镜，断言只打开放大层且计划草稿不变；再真实点击卡牌本体中心点，断言放大层不打开、法术进入计划槽。
- `计划区不能被挡住`：已补 1366×768 压力态。E2E 对确认计划按钮和计划槽中心点做前景命中断言，并检查教程卡片没有与它们视觉相交。
- `适配不隐藏主流程`：已执行。1366×768 压力态保留法术书 6 张可见承载量，桌面 UI 按 1920×1080 基线等比缩放到约 0.71；HUD、地图、计划槽、确认计划按钮、教程卡和放大入口仍保留且可点击。
- `当前情况不需要分章节`：已执行。正式 `/play/mage-wars/tutorial` 现在直接进入 `mage-wars-basic`，不显示教程目录、推荐标签或进入按钮。
- `自然流程教完`：当前基础教程按同一玩家主线推进：胜利目标 → HUD 读数 → 聚魔自动结算 → 计划 1/2 → 计划 2/2 → 准备区隐藏信息 → 召唤灰狼 → 兽性觉醒 → 对手部署与公开攻击法术自动结算 → 观察对手公开弃牌 → 返回自己视角 → 让过快速施法窗口 → 生物移动 → 完成。
- `对手动作不再变成教程页`：`opponent-deploy`、`opponent-attack-spell` 不再存在；`opponent-deployment-results`、`opponent-pass-deployment`、`opponent-pass-initiative-quickcast` 是纯自动正式动作，不显示教程浮层、不截图成玩家步骤。
- `截图不能隐藏玩家流程`：E2E 只隐藏非流程 FAB；计划确认、己方结束部署、观察对手公开区、返回自己视角、让过快速施法和移动都走正式可见控件。
- `后半代表态不进当前主线`：墙体、守卫、治疗、复原术仍可由正式玩法链或后续专题验证，但不再作为这条基础教程端到端 PASS 的一部分。

## 修正范围

- 教程结构：`src/games/mage-wars/tutorial.ts` 只保留 `mage-wars-basic` 单入口，删除 `nextTutorialId`，并把对手 / 系统前置改成纯自动正式动作。
- 文案：`public/locales/zh-CN/game-mage-wars.json`、`public/locales/en/game-mage-wars.json` 改为承接对手自动结算后的公开结果，不再把对手施法停成玩家教程页。
- 单测：`src/games/mage-wars/__tests__/tutorial.test.ts` 断言只有单入口、无 `setup-*`、无旧专题步骤、无旧对手可见步骤，并断言纯自动步骤不会要求玩家操作或停成信息页。
- E2E：`e2e/mage-wars/mage-wars-tutorial.e2e.ts` 截图白名单改为 00-14 共 15 张，断言单教程无目录页，断言旧对手教程页不可见，拦截 `wall / guard / heal / restore / burn / transition` 专题图混入当前基础主线；本轮追加真实命中区域断言、放大镜 / 卡面本体分流断言、1366×768 计划区无遮挡断言；正常端到端主链使用项目 Playwright runtime，真实浏览器 / 开发端口只服务被点名的自适应专项。
- 运行时 UI：`src/games/mage-wars/Board.tsx` 通过桌面 UI 比例面按 1920×1080 基线等比缩放；1366×768 下仍保留 6 张法术书牌、计划槽和确认计划按钮，不用减少卡牌数量冒充适配。
- 规范：`.spec/knowledge/standards/tutorial-design.md` 是教程自然流程 canonical-source；`.spec/knowledge/standards/e2e-verification.md` 新增真实点击命中区域门禁；`.spec/knowledge/standards/ui-change-gates.md` 新增主操作与检视分区门禁；`.spec/skills/tutorial-workflow/SKILL.md` 只补 E2E 执行要求。

## 验证命令

```powershell
npx vitest run src/games/mage-wars/__tests__/tutorial.test.ts src/pages/__tests__/matchRoomStages.test.tsx src/pages/__tests__/useMatchRoomRuntimeSetup.test.ts --reporter=dot
npx vitest run src/games/mage-wars/__tests__/Board.fx.test.tsx src/games/mage-wars/__tests__/tutorial.test.ts --reporter=dot
npm run test:e2e:file -- e2e/mage-wars/mage-wars-tutorial.e2e.ts
npm run typecheck
npm run spec:lint
```

结果：

- 教程 / 目录相关单测通过：`3 test files passed / 12 tests passed`。
- Mage Wars Board / 教程相关单测通过：`2 test files passed / 57 tests passed`。
- Mage Wars 教程 E2E 通过：`2 passed`，包含“单入口教程按玩家自然流程覆盖读局、计划、召唤、公开弃牌、快速施法窗口和移动”和“1366x768 真实卡面点击计划且计划槽位不被遮挡”。
- 类型检查通过：`tsc --noEmit` 无错误。
- 项目规范结构校验通过：`spec-lint: OK`。

## 覆盖矩阵

| 玩家要学会的现实动作 / 判断 | 教程步骤 / 主教学时刻 | 正式 UI 承接物 | E2E / 截图证据 | 当前状态 |
| --- | --- | --- | --- | --- |
| 单入口进入基础教程，不出现目录页或无职责“正式竞技场”标题 | `intro` | `/play/mage-wars/tutorial`、正式牌桌、教程浮层 | `00-intro-board-and-win.png`；E2E 断言目录不存在、牌桌不含“正式竞技场” | 已覆盖 |
| 法师 HUD 读数 | `self-hud`、`opponent-hud` | 双方法师 HUD | `01-read-mage-hud-life-mana-channeling.png` | 已覆盖 |
| 聚魔是系统自动结算，不要求玩家点结束回合 | `channel-result` | 阶段流程、双方法力 HUD | `02-channel-result-mana-increased.png`；E2E 断言法力变为 20 且计划草稿数量为 0 | 已覆盖 |
| 计划法术要进入目标计划槽并显示 x/y | `plan-wolf` | 法术书、确认计划按钮、准备槽 | `03-plan-selected-one-of-two.png`、`04-plan-selected-two-of-two-confirm.png`；E2E 断言 `1/2`、`2/2`、草稿牌来源和槽位序号 | 已覆盖 |
| 确认计划后看到己方准备牌和对手隐藏计划 | `prepared-and-hidden` | 己方准备牌、对手准备牌背 | `05-prepared-and-hidden.png`；E2E 断言己方准备牌为 2819、3403 | 已覆盖 |
| 召唤灰狼必须先看到合法区域，再看到灰狼落场且未就绪 | `deploy-wolf`、`wolf-summoned` | 准备牌、A3 目标格、场上灰狼 | `06-summon-target-zone-highlight.png`、`07-wolf-summoned-not-ready.png` | 已覆盖 |
| 兽性觉醒必须高亮灰狼本体，结算后灰狼就绪 | `rouse-wolf` | 兽性觉醒准备牌、场上灰狼、就绪状态 | `08-rouse-target-wolf-highlight.png`、`09-roused-wolf-ready-and-end-deployment.png` | 已覆盖 |
| 对手行动只能作为公开结果和公开信息阅读，不代替对手操作 | `opponent-deployment-results` 自动结算后进入 `opponent-public-view`、`discard-reading`、`back-to-self-view` | 对手场上对象、对手面板眼睛、同一弃牌区、返回自己视角按钮 | `10-opponent-public-view-toggle-highlight.png` 到 `12-back-to-self-view.png`；E2E 断言旧对手步骤不可见、对手弃牌在同一主弃牌槽显示 | 已覆盖 |
| 快速施法是规则时机窗口，玩家当前无快速法术时用正式按钮让过 | `skip-initiative-quickcast` | 阶段推进按钮、快速施法窗口提示 | `13-skip-initiative-quickcast.png`；E2E 断言对手让过步骤不可见并自动进入玩家窗口 | 已覆盖 |
| 生物行动阶段点击灰狼和相邻区域完成移动 | `move-wolf`、`finish` | 场上灰狼、合法区域、教程完成提示 | `14-wolf-moved-to-a2.png` | 已覆盖 |
| 墙体、守卫、治疗、复原术 | 不在当前基础自然主线 | 正式玩法链 / 后续专题 | 当前基础教程图组不得包含这些代表态图片 | 已从当前主线移除 |
| 计划态卡牌点击分流 | `plan-wolf` | 法术书卡面本体、独立放大镜、计划槽 | E2E 断言放大镜只打开检视层且不改计划；卡面中心点点击进入计划槽且放大层保持关闭 | 已覆盖 |
| 1366×768 计划区无遮挡 | `plan-wolf` 压力态 | 法术书、计划槽、确认计划按钮、教程卡 | `tutorial-plan-click-responsive/00-1366-plan-card-body-click-one-of-two.png`；E2E 断言中心点前景命中和无教程卡视觉相交 | 已覆盖 |

## 当前有效截图清单

当前有效原图目录：`test-results/evidence-screenshots/mage-wars/tutorial-flow-sync/`。本轮重跑 E2E 后有效原图共 15 张，只有基础自然主线图：

| 顺序 | 原图 | 证据角色 |
| ---: | --- | --- |
| 00 | `00-intro-board-and-win.png` | 直接进入正式牌桌、胜利目标、无目录页、无“正式竞技场”标题 |
| 01 | `01-read-mage-hud-life-mana-channeling.png` | 法师 HUD 读数 |
| 02 | `02-channel-result-mana-increased.png` | 自动聚魔后的法力变化 |
| 03 | `03-plan-selected-one-of-two.png` | 计划第 1 张，草稿法术进入计划槽 |
| 04 | `04-plan-selected-two-of-two-confirm.png` | 计划第 2 张，两张不同法术进入两个计划槽，确认按钮显示 `2/2` |
| 05 | `05-prepared-and-hidden.png` | 确认计划后己方准备牌可见，对手计划隐藏 |
| 06 | `06-summon-target-zone-highlight.png` | 召唤目标区域高亮 |
| 07 | `07-wolf-summoned-not-ready.png` | 灰狼已召唤但未就绪 |
| 08 | `08-rouse-target-wolf-highlight.png` | 兽性觉醒高亮灰狼本体 |
| 09 | `09-roused-wolf-ready-and-end-deployment.png` | 灰狼被唤醒，己方部署窗口可让过 |
| 10 | `10-opponent-public-view-toggle-highlight.png` | 对手部署与公开攻击法术已自动结算，玩家切换对手公开视角 |
| 11 | `11-opponent-public-view-same-discard-pile.png` | 同一主弃牌区切到对手公开弃牌 |
| 12 | `12-back-to-self-view.png` | 返回自己视角 |
| 13 | `13-skip-initiative-quickcast.png` | 玩家用正式按钮让过快速施法 |
| 14 | `14-wolf-moved-to-a2.png` | 生物移动后基础教程完成 |

## 用户可见图组

- 用户展示 PASS 清单：`evidence/mage-wars-tutorial/pass-manifest-20260903-single-natural-flow-00-14.json`。
- 展示顺序清单：`evidence/mage-wars-tutorial/sequence-labels-20260903-single-natural-flow-00-14.json`。
- PureRef 标记图目录：`test-results/evidence-screenshots/mage-wars/tutorial-flow-sync/_labeled-for-pureref-20260903-single-natural-flow-00-14/`。
- 本轮卡牌点击 / 计划区专项 PASS 清单：`evidence/mage-wars-tutorial/pass-manifest-20260903-plan-click-hit-area.json`。
- 本轮卡牌点击 / 计划区专项 PureRef 标记图目录：`test-results/evidence-screenshots/mage-wars/tutorial-plan-click-responsive/_labeled-for-pureref-20260903-plan-click-hit-area/`。
- 旧 `pass-manifest-20260902-*`、`pass-manifest-20260903-single-natural-flow-00-16.json`、`sequence-labels-20260902-*`、`sequence-labels-20260903-single-natural-flow-00-16.json` 和 `sequence-labels-20260903-single-natural-flow-00-34.json` 只保留为历史 / 诊断证据，不作为当前教程最终图组。

## 图面自审

```text
verdict: PASS
scope: current-user-request
checked_requirements:
  - 不需要分章节：PASS，当前 catalog 只有 mage-wars-basic，/tutorial 直接进入牌桌，E2E 图组只有 00-14 基础自然主线。
  - 不隐藏关键玩家流程：PASS，计划、部署让过、观察对手公开弃牌、返回自己视角、快速施法让过和移动均由真实可见控件完成。
  - 卡面点击不假触发：PASS，计划态放大镜和卡面本体分别真实点击，前者只打开检视层，后者只进入计划槽。
  - 计划区无遮挡：PASS，1920 与 1366x768 均断言确认计划按钮和计划槽中心点前景命中，且未被教程卡视觉遮挡。
  - 对手 / 系统前置不成页：PASS，对手部署、公开攻击法术、对手让过部署、对手让过快速施法均为纯自动步骤，不进入截图主编号。
  - 不混入代表态：PASS，截图目录白名单拦截 wall / guard / heal / restore / burn / transition。
hard_failures: []
```

## 收口口径

- 可以说：Mage Wars 桌面基础教程当前范围端到端已通过，且已收敛为单入口、无章节目录 / 无隐藏续段 / 无对手过渡教程页的自然主线。
- 不能说：墙体、守卫、治疗、复原术已经由当前基础教程教完；这些只能由正式玩法链或后续专题单独证明。
- 不能说：完整实体版 Mage Wars、全卡表、主黄金链、移动教程或服务器资源发布已经完成。
