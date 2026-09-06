# Mage Wars 基础教程单入口自然主线 E2E 证据

> 状态：`tutorial-desktop-single-natural-flow-e2e-pass / current-scope-tutorial-pass / main-flow-images-only / card-reading-and-attack-bar-covered / no-catalog-for-single-tutorial / pure-ai-transition-hidden / non-flow-fab-hidden-only / not-full-game-closeout`。本文件记录当前 Mage Wars 基础教程的端到端主线验证结果；它不是完整实体版 Mage Wars、全卡表、墙体 / 守卫 / 治疗 / 复原术专题、移动端教程或服务器资源发布完成宣告。

## 本轮结论

- `2026-09-05 22:57 时机修正后 E2E 复核`：已按项目标准 E2E 入口重跑 Mage Wars 教程 E2E，结果 `3 passed (1.2m)`；其中单条自然主线用例结果为 `1 passed (45.4s)`。
- `卡图含义2 确实特殊，但不能提前堆文案`：`卡图含义2.png` 仍按攻击条专项图例处理；教学时刻已从首个计划决策前移到丛林灰狼真实上场后，直接承接场上灰狼的攻击条。
- `卡图含义不能漏，也不能抢跑`：首个计划决策前只教计划法术会用到的基础字段：费用、行动、范围、目标、类型、派系和等级；攻击条等战斗读数等场上对象出现后再教。
- `官方页不大段照搬`：你给的官方链接作为来源线索处理；本轮没有把长段文案复制进玩家可见教程，读牌教学以用户截图图例和当前局面短句承接。
- `重复卡图含义不重复教`：通用读牌字段只在 `spell-card-reading` 首次完整解释；之后只讲当前牌新增差异，例如“丛林灰狼是生物类法术，会进竞技场持续战斗”，“兽性觉醒是咒语类法术，结算后进弃牌堆”。
- `当前情况不需要分章节`：Mage Wars 仍只有 `mage-wars-basic` 一个基础教程，正式 `/play/mage-wars/tutorial` 直接进入牌桌，不显示目录页、推荐标签或进入按钮。
- `自然流程教完`：当前基础教程按同一玩家主线推进：胜利目标 -> 自己 HUD -> 对手 HUD / 隐藏计划 -> 回合阶段 -> 聚魔自动结算 -> 读计划法术基础字段 -> 计划 1/2 -> 计划 2/2 -> 准备区隐藏信息 -> 召唤灰狼 -> 读场上灰狼攻击条 -> 兽性觉醒 -> 对手部署与公开攻击法术自动结算 -> 观察对手公开弃牌 -> 返回自己视角 -> 让过快速施法窗口 -> 生物移动 -> 完成。
- `对手动作不再变成教程页`：`opponent-deploy`、`opponent-attack-spell` 不存在；`opponent-deployment-results`、`opponent-pass-deployment`、`opponent-pass-initiative-quickcast` 是纯自动正式动作，不显示教程浮层、不截图成玩家步骤。
- `截图不能隐藏玩家流程`：E2E 只隐藏非流程 FAB；计划确认、己方结束部署、观察对手公开区、返回自己视角、让过快速施法和移动都走正式可见控件。
- `后半代表态不进当前主线`：墙体、守卫、治疗、复原术仍可由正式玩法链或后续专题验证，但不作为这条基础教程端到端 PASS 的一部分。

## 修正范围

- 规范：`.spec/knowledge/standards/tutorial-design.md` 是教程读图面 / 图标含义、自然流程和章节边界的 canonical-source；`.spec/skills/tutorial-workflow/SKILL.md` 作为项目教程 workflow，已补强“遇到字段再教”和“玩家文案不得写设计意图 / 坐标判断 / 后续复用策略”。
- 教程结构：`src/games/mage-wars/tutorial.ts` 保留聚魔结果后的 `spell-card-reading`，但只讲计划字段；`attack-bar-reading` 已移到 `wolf-summoned` 后，场上灰狼出现时再教攻击条；仍保持单入口 `mage-wars-basic`。
- 文案：`public/locales/zh-CN/game-mage-wars.json`、`public/locales/en/game-mage-wars.json` 已去掉“攻击条比普通卡面字段更特殊 / 只按这些位置判断”等作者口吻，改成规则读法和当前灰狼承接。
- 资源 / 浮层：`public/assets/i18n/zh-CN/mage-wars/references/spell-card-legend.png`、`attack-bar-legend.png` 与压缩 WebP 已进入 manifest；`TutorialOverlay` 支持教程步骤渲染 `visual` 图片和说明。
- 单测：`src/components/tutorial/__tests__/TutorialOverlay.aiActions.test.tsx`、`src/games/mage-wars/__tests__/tutorial.test.ts` 断言图例渲染、图例资源、攻击条步骤在灰狼上场后、玩家文案没有设计意图 / 坐标判断 / 后续复用口吻。
- E2E：`e2e/mage-wars/mage-wars-tutorial.e2e.ts` 截图白名单仍为 00-27 共 28 张；单条主线标题更新为覆盖读局、读牌、计划、召唤、攻击条、公开弃牌、快速施法窗口和移动；攻击条截图现在位于灰狼上场后的 17 号图。

## 验证命令

```powershell
npm run spec:lint
npx vitest run src/games/mage-wars/__tests__/tutorial.test.ts src/components/tutorial/__tests__/TutorialOverlay.aiActions.test.tsx --reporter=dot
node scripts/infra/run-e2e-command.mjs ci e2e/mage-wars/mage-wars-tutorial.e2e.ts
```

结果：

- 项目规范结构校验通过：`spec-lint: OK`。
- 教程共享浮层 + Mage Wars 教程单测通过：`2 test files passed / 9 tests passed`。
- Mage Wars 教程单条自然主线 E2E 通过：`1 passed (45.4s)`。
- Mage Wars 教程 E2E 文件通过：`3 passed (1.2m)`，包含“单入口教程按玩家自然流程覆盖读局、读牌、计划、召唤、攻击条、公开弃牌、快速施法窗口和移动”、`1366x768` 和 `1920x1080` 两个真实卡面点击计划 / 计划槽无遮挡用例。

## 覆盖矩阵

| 玩家要学会的现实动作 / 判断 | 教程步骤 / 主教学时刻 | 正式 UI 承接物 | E2E / 截图证据 | 当前状态 |
| --- | --- | --- | --- | --- |
| 单入口进入基础教程，不出现目录页或无职责“正式竞技场”标题 | `intro` | `/play/mage-wars/tutorial`、正式牌桌、教程浮层 | `00-intro-board-and-win.png`；E2E 断言目录不存在、牌桌不含“正式竞技场” | 已覆盖 |
| 读取自己法师的生命、伤害、法力、聚魔和行动标记 | `self-hud` | 己方法师 HUD | `01-read-self-hud-life-mana-channeling.png` | 已覆盖 |
| 读取对手 HUD 和隐藏计划状态 | `opponent-hud` | 对手法师 HUD、对手准备区牌背 | `02-read-opponent-hud-hidden-plans.png` | 已覆盖 |
| 读取当前回合与阶段 | `stage` | 阶段流程 / 回合提示 | `03-read-round-stage.png` | 已覆盖 |
| 聚魔是系统自动结算，不要求玩家点结束回合 | `channel-result` | 阶段流程、双方法力 HUD | `04-channel-result-mana-increased.png`；E2E 断言法力变为 20 且计划草稿数量为 0 | 已覆盖 |
| 首局先读懂计划法术基础字段，再开始计划 | `spell-card-reading` | 法术书、用户截图法术牌图例、教程浮层 | `05-read-spell-card-legend.png`；E2E 断言 `tutorial-overlay-visual` 可见、图片 alt 包含“法术牌图例”、说明只讲计划法术基础字段、图片真实加载且资源来源包含 `spell-card-legend` | 已覆盖 |
| 计划阶段从法术书分类找生物类法术 | `plan-open-creature-category` | 法术书分类按钮 | `06-plan-open-creature-category.png` | 已覆盖 |
| 生物第一页没有目标牌时，翻页是当前真实必要动作 | `plan-creature-next-page` | 法术书下一页按钮、当前页卡牌列表 | `07-plan-creature-next-page-wolf-hidden.png`；E2E 断言第一页不含 `2819` | 已覆盖 |
| 丛林灰狼是生物类法术，进入计划槽 1/2 | `plan-select-wolf` | 法术书卡牌本体、计划槽 | `08-plan-select-wolf-visible.png`、`09-plan-wolf-in-slot-one-open-incantation-category.png`；E2E 断言翻页后可见 `2819` 且草稿为 `1/2` | 已覆盖 |
| 咒语第一页没有目标牌时，翻页是当前真实必要动作 | `plan-incantation-next-page` | 法术书下一页按钮、当前页卡牌列表 | `10-plan-incantation-next-page-rouse-hidden.png`；E2E 断言第一页不含 `3403` | 已覆盖 |
| 兽性觉醒是咒语类法术，进入计划槽 2/2 | `plan-select-rouse`、`plan-confirm` | 法术书卡牌本体、计划槽、确认计划按钮 | `11-plan-rouse-visible.png`、`12-plan-rouse-in-slot-two-confirm.png`；E2E 断言翻页后可见 `3403` 且草稿为 `2/2` | 已覆盖 |
| 确认计划后看到己方准备牌和对手隐藏计划 | `prepared-and-hidden` | 己方准备牌、对手准备牌背 | `13-prepared-and-hidden.png`；E2E 断言己方准备牌为 2819、3403 | 已覆盖 |
| 召唤灰狼必须先选择准备牌，再看到合法区域 | `deploy-select-wolf`、`deploy-target-zone` | 准备牌、A3 目标格 | `14-deploy-select-wolf-prepared-card.png`、`15-deploy-target-zone-highlight.png` | 已覆盖 |
| 召唤后灰狼落场但未就绪 | `wolf-summoned` | 场上灰狼、行动标记、单位读数 | `16-wolf-summoned-not-ready.png` | 已覆盖 |
| 卡图含义2 / 攻击条是特殊子结构，遇到场上灰狼后再教 | `attack-bar-reading` | 场上灰狼、用户截图攻击条图例、教程浮层 | `17-read-attack-bar-on-wolf.png`；E2E 断言场上灰狼可见、图片 alt 包含“攻击条图例”、说明包含“当前用场上的丛林灰狼读第一次”、图片真实加载且资源来源包含 `attack-bar-legend` | 已覆盖 |
| 兽性觉醒从准备牌结算到灰狼本体目标 | `rouse-select-spell`、`rouse-target-wolf` | 兽性觉醒准备牌、场上灰狼 | `18-rouse-select-spell-prepared-card.png`、`19-rouse-target-wolf-highlight.png` | 已覆盖 |
| 兽性觉醒结算后灰狼就绪，玩家用正式按钮结束部署 | `pass-your-deployment` | 灰狼行动标记、结束部署按钮 | `20-pass-your-deployment-wolf-ready.png` | 已覆盖 |
| 对手行动只能作为公开结果和公开信息阅读，不代替对手操作 | `opponent-deployment-results` 自动结算后进入 `opponent-public-view`、`discard-reading`、`back-to-self-view` | 对手场上对象、对手面板眼睛、同一弃牌区、返回自己视角按钮 | `21-opponent-public-view-toggle-highlight.png` 到 `23-back-to-self-view.png`；E2E 断言旧对手步骤不可见、对手弃牌在同一主弃牌槽显示 | 已覆盖 |
| 快速施法是规则时机窗口，玩家当前无快速法术时用正式按钮让过 | `skip-initiative-quickcast` | 阶段推进按钮、快速施法窗口提示 | `24-skip-initiative-quickcast.png`；E2E 断言对手让过步骤不可见并自动进入玩家窗口 | 已覆盖 |
| 生物行动阶段点击灰狼和相邻区域完成移动 | `move-wolf`、`move-target-zone`、`finish` | 场上灰狼、合法区域、教程完成提示 | `25-move-select-wolf.png` 到 `27-finish-wolf-moved-to-a2.png` | 已覆盖 |
| 墙体、守卫、治疗、复原术 | 不在当前基础自然主线 | 正式玩法链 / 后续专题 | 当前基础教程图组不得包含这些代表态图片 | 已从当前主线移除 |
| 计划态卡牌点击分流 | `plan-wolf` / 当前计划选牌族 | 法术书卡面本体、独立放大镜、计划槽 | E2E 断言放大镜只打开检视层且不改计划；卡面中心点点击进入计划槽且放大层保持关闭 | 已覆盖 |
| 1366x768 计划区无遮挡 | `plan-open-creature-category` 压力态 | 法术书、计划槽、确认计划按钮、教程卡 | `tutorial-plan-click-responsive/00-1366-plan-card-body-click-one-of-two.png`；E2E 断言中心点前景命中和无教程卡视觉相交 | 已覆盖 |

## 当前有效截图清单

当前有效原图目录：`test-results/evidence-screenshots/mage-wars/tutorial-flow-sync/`。本轮重跑 E2E 后有效原图共 28 张，只有基础自然主线图：

| 顺序 | 原图 | 证据角色 |
| ---: | --- | --- |
| 00 | `00-intro-board-and-win.png` | 直接进入正式牌桌、胜利目标、无目录页、无“正式竞技场”标题 |
| 01 | `01-read-self-hud-life-mana-channeling.png` | 读取自己法师生命、伤害、法力、聚魔和行动标记 |
| 02 | `02-read-opponent-hud-hidden-plans.png` | 读取对手 HUD 与隐藏计划 |
| 03 | `03-read-round-stage.png` | 读取回合与阶段 |
| 04 | `04-channel-result-mana-increased.png` | 自动聚魔后的法力变化 |
| 05 | `05-read-spell-card-legend.png` | 计划前只读取计划法术基础字段图例 |
| 06 | `06-plan-open-creature-category.png` | 打开生物分类 |
| 07 | `07-plan-creature-next-page-wolf-hidden.png` | 生物第一页没有丛林灰狼，翻页动作真实必要 |
| 08 | `08-plan-select-wolf-visible.png` | 丛林灰狼可见，准备选择生物法术 |
| 09 | `09-plan-wolf-in-slot-one-open-incantation-category.png` | 丛林灰狼进入计划槽 1/2，继续打开咒语分类 |
| 10 | `10-plan-incantation-next-page-rouse-hidden.png` | 咒语第一页没有兽性觉醒，翻页动作真实必要 |
| 11 | `11-plan-rouse-visible.png` | 兽性觉醒可见，准备选择咒语法术 |
| 12 | `12-plan-rouse-in-slot-two-confirm.png` | 两张法术进入计划槽 2/2，可确认计划 |
| 13 | `13-prepared-and-hidden.png` | 确认计划后己方准备牌可见，对手计划隐藏 |
| 14 | `14-deploy-select-wolf-prepared-card.png` | 部署阶段选择丛林灰狼准备牌 |
| 15 | `15-deploy-target-zone-highlight.png` | 召唤目标区域高亮 |
| 16 | `16-wolf-summoned-not-ready.png` | 灰狼已召唤但未就绪 |
| 17 | `17-read-attack-bar-on-wolf.png` | 遇到场上灰狼后读取用户截图卡图含义2 / 攻击条图例 |
| 18 | `18-rouse-select-spell-prepared-card.png` | 选择兽性觉醒准备牌 |
| 19 | `19-rouse-target-wolf-highlight.png` | 兽性觉醒高亮灰狼本体 |
| 20 | `20-pass-your-deployment-wolf-ready.png` | 灰狼就绪，玩家可结束部署 |
| 21 | `21-opponent-public-view-toggle-highlight.png` | 对手部署与公开攻击法术已自动结算，玩家切换对手公开视角 |
| 22 | `22-opponent-public-view-same-discard-pile.png` | 同一主弃牌区显示对手公开弃牌 |
| 23 | `23-back-to-self-view.png` | 返回自己视角 |
| 24 | `24-skip-initiative-quickcast.png` | 玩家用正式按钮让过快速施法 |
| 25 | `25-move-select-wolf.png` | 生物行动阶段选择灰狼 |
| 26 | `26-move-target-zone-a2.png` | 选择相邻 A2 区域 |
| 27 | `27-finish-wolf-moved-to-a2.png` | 灰狼移动后基础教程完成 |

## 当前证据图组

- 当前 PASS 清单：`evidence/mage-wars-tutorial/pass-manifest-20260905-single-natural-flow-00-27.json`。
- 当前顺序清单：`evidence/mage-wars-tutorial/sequence-labels-20260905-single-natural-flow-00-27.json`。
- 当前原始截图目录：`test-results/evidence-screenshots/mage-wars/tutorial-flow-sync/`，PASS 清单保留本轮 00-27 原始截图为 sourceImages。
- PureRef 标记图目录：`test-results/evidence-screenshots/mage-wars/tutorial-flow-sync/_labeled-for-pureref-20260905-single-natural-flow-00-27/`，用于本轮用户可见顺序展示。
- 卡牌点击 / 计划区专项 PASS 清单：`evidence/mage-wars-tutorial/pass-manifest-20260903-plan-click-hit-area.json`，只作为专项历史证据，不混入当前自然主线图组。
- 旧 `pass-manifest-20260902-*`、`pass-manifest-20260903-single-natural-flow-00-14.json`、`pass-manifest-20260903-single-natural-flow-00-16.json`、`pass-manifest-20260905-single-natural-flow-00-26.json`、`sequence-labels-20260902-*`、`sequence-labels-20260903-single-natural-flow-00-14.json`、`sequence-labels-20260903-single-natural-flow-00-16.json`、`sequence-labels-20260903-single-natural-flow-00-34.json` 和 `sequence-labels-20260905-single-natural-flow-00-26.json` 只保留为历史 / 诊断证据，不作为当前教程最终图组。

## 图面自审

```text
verdict: PASS
scope: current-user-request
checked_requirements:
  - 不需要分章节：PASS，当前 catalog 只有 mage-wars-basic，/tutorial 直接进入牌桌，E2E 图组只有 00-27 基础自然主线。
  - 卡图含义已教：PASS，计划前截图 05 只承接计划法术基础字段，不提前讲攻击条、生命或护甲。
  - 卡图含义2 / 攻击条已教：PASS，截图 17 在场上灰狼出现后承接攻击条图例，文案讲快速 / 标准行动、近战 / 远程、范围、伤害类型、攻击骰、附加效果和特性，并断言资源来源包含 attack-bar-legend。
  - 不隐藏关键玩家流程：PASS，计划、部署让过、观察对手公开弃牌、返回自己视角、快速施法让过和移动均由真实可见控件完成。
  - 法术书翻页真实必要：PASS，E2E 断言丛林灰狼和兽性觉醒在对应分类第一页不可见，点击下一页后才出现。
  - 卡面点击不假触发：PASS，计划态放大镜和卡面本体分别真实点击，前者只打开检视层，后者只进入计划槽。
  - 计划区无遮挡：PASS，1920 与 1366x768 均断言确认计划按钮和计划槽中心点前景命中，且未被教程卡视觉遮挡。
  - 对手 / 系统前置不成页：PASS，对手部署、公开攻击法术、对手让过部署、对手让过快速施法均为纯自动步骤，不进入截图主编号。
  - 不混入代表态：PASS，截图目录白名单拦截 wall / guard / heal / restore / burn / transition。
hard_failures: []
```

## 收口口径

- 可以说：Mage Wars 桌面基础教程当前范围端到端已通过，且已收敛为单入口、无章节目录 / 无隐藏续段 / 无对手过渡教程页的自然主线；“读牌 / 卡图含义”在首个计划决策前覆盖，“卡图含义2 / 攻击条”在丛林灰狼上场后覆盖。
- 不能说：墙体、守卫、治疗、复原术已经由当前基础教程教完；这些只能由正式玩法链或后续专题单独证明。
- 不能说：完整实体版 Mage Wars、全卡表、主黄金链、移动教程或服务器资源发布已经完成。
