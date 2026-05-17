# DiceThrone Treant 全面审计 2026-05-16

## 范围

- 角色：`treant`
- 真相源：
  - `D:\gongzuo\webgame\BoardGame\public\assets\i18n\zh-CN\dicethrone\images\treant\玩家面板.png`
  - `D:\gongzuo\webgame\BoardGame\public\assets\i18n\zh-CN\dicethrone\images\treant\提示板.png`
  - `D:\gongzuo\webgame\BoardGame\public\assets\i18n\zh-CN\dicethrone\images\treant\abilitycards.png`
- 当前工作区实现入口：
  - `public/locales/zh-CN/game-dicethrone.json`
  - `src/games/dicethrone/heroes/treant/abilities.ts`
  - `src/games/dicethrone/heroes/treant/cards.ts`
  - `src/games/dicethrone/heroes/treant/tokens.ts`
  - `src/games/dicethrone/domain/customActions/treant.ts`
  - `src/games/dicethrone/domain/passiveAbility.ts`
  - `src/games/dicethrone/domain/commandValidation.ts`
  - `src/games/dicethrone/domain/flowHooks.ts`
  - `src/assets/atlas-configs/dicethrone/ability-cards-treant.atlas.json`

## 旧结论失效

- 旧文档里“Treant 只剩两个问题”已经失效。
- 旧文档里“多数只差逐卡 E2E”也已经失效。
- 旧文档里“扎根完整真实 UI/L3 已有稳定通过证据”的旧断言曾失效：旧用例用 `1,4,6` 却期待 `seedling=1 / lifeSap=1`，不符合图片规则。`2026-05-17` 已重写为 `4,5,1` 的双树叶分支和不可防御否定分支，并通过真实 UI 链路复跑。
- 更准确的当前口径是：**玩法实现与升级卡描述已明显收敛；共享 token 合同、玩家板槽位合同、`rooted` 防御链、专属主阶段卡代表链、攻击修正/掷骰卡代表链均已补到 L3；真实 UI/L3 仍未覆盖 Treant 15 张专属卡逐卡全集。**

## 2026-05-17 当前快照

- 本轮按 **8 个基础/被动/终极技能 + 5 个 token/状态 + 15 张专属卡 = 28 个对象** 重排。
- 当前结果不是“到处都错”，也不是“只剩两个点”。
- 以 **2026-05-17 当前工作区代码 + 当前图片真相源** 计：
  - `28/28`：当前已知图片语义、locale 与实现主效果已对齐，已有 L1/L2 或更高证据。
  - `0/28`：当前已知仍缺卡图完整展开描述的升级卡。
  - `0/28`：当前已知 Treant 主效果 L2 实现错误。

## 共享根因

| Finding | 图片直接结论 | 当前代码 / 数据落点 | 结论 |
|---|---|---|---|
| 树灵每回合限 1 次 | `每回合每种树灵仅限花费1次` | `treantSpiritSpentThisTurn` 已在领域状态记录；`passiveAbility.ts` / `commandValidation.ts` / `execute.ts` / `tokenResponse.ts` 共享同一可用性门禁；`dicethrone-treant-ninja-mechanics.e2e.ts` 已补木苗树灵真实入口代表链 | **L3 代表链已补；不是所有树灵动作全集 E2E** |
| 神性树灵防负面是可选响应 | `你可以在他的进攻投掷阶段结束时花费神性树灵...` | `flowHooks.ts` 已改为先生成选择；跳过保留 debuff，选择防止才消耗神性并过滤 debuff；已补 `SYS_INTERACTION_RESOLVED` 后等待 `CHOICE_RESOLVED` reduce 的时序保护，避免选择窗被旧状态重复拉起 | **L3 代表链已补；可选响应 UI 跑通** |
| 升级卡描述要按卡图录入 | 多张升级卡卡面直接印完整升级后效果 | `game-dicethrone.json` 中 5 张升级卡已从“升级某技能”补成完整效果描述 | **录入层已补齐；缺逐卡 L3** |
| 刺藤上限文案 | `每回合至多因此受到2伤害` | `flowHooks.ts` 与 `game-dicethrone.json` 均已补齐上限子句 | **L2 已补；缺 UI/L3** |
| 玩家板槽位合同 | 图片直接给出独立被动槽与右下防御槽；被动位不应冒充主动候选，防御位不应错绑到倒数第二技能 | `abilitySlotMapping.ts` 的 Treant override 已把 `quiet-cultivation -> sky`、`rooted -> meditate`，`AbilityOverlays.tsx` 也按同一合同消费；`树精小顺子高亮应落在复仇枝蔓而不是被动槽` 的真实 UI 截图证明进攻高亮不再落到被动槽；`02-rooted-defense-slot-highlight-after-showcase-dismissed.png` 证明防御特写关闭后右下 `rooted` 槽可见高亮，`sky/calm` 均未冒充入口 | **用户最初点名的两个槽位 bug 当前已修；`rooted` 完整防御 L3 已重建** |

## 对象矩阵

### 基础技能 / 被动 / 终极（8）

| 对象 | 当前判定 | 直接证据 |
|---|---|---|
| `shattering-fist` | 主效果对齐 | 图片 `5/6/7 伤害 + 可弃1树灵施加刺藤`；`abilities.ts` 现为 `treant-shattering-fist-choice + damage 5/6/7`；L2 已测。 |
| `tend-care` | 主效果对齐 | 图片 `抽1 + 养成3 + 生命源泉目标 + 刺藤目标`；`customActions/treant.ts` 已做组合选择；L2 已测。 |
| `vengeful-vines` | 主效果对齐 | 图片、locale、代码一致为 `小顺子 => 刺藤 + 7伤害`。 |
| `nature-touch` | 主效果对齐 | 图片 `养成2 + 5不可防御 + 每有1树灵 +1`；当前已按养成后树灵总数加伤；L2 已测。 |
| `quiet-cultivation` | 主效果对齐 | 图片 `维持阶段养成1树灵`；当前已改成 `treant-quiet-cultivation` 正式养成选择，不再是固定幼种；L2 已测。 |
| `wild-growth` | 主效果对齐 | 图片 `2伤害 + 至多移除2树灵各+4 + 弃生命源泉变不可防御`；当前实现与图片一致；L2 已测。 |
| `rooted` | 主效果对齐 | 图片 `防止 1×树枝 + 1×树灵 伤害；双树叶养成1；双树灵给生命源泉`；当前 3 骰/4 骰、防伤、双树叶、双树灵都已对齐；L2 已测。 |
| `forest-awakens` | 主效果对齐 | 图片 `自己和1名队友得生命源泉 + 养成5 + 刺藤 + 10伤害`；当前实现对齐；L2 已测。 |

### Token / 状态（5）

| 对象 | 当前判定 | 直接证据 |
|---|---|---|
| `treant_seedling` | 主效果对齐 | 重掷链路已通；每回合每种限 1 次已由 `treantSpiritSpentThisTurn` L2 覆盖。 |
| `treant_sapling` | 主效果对齐 | `治疗1并+1CP / 额外1CP抽1` 已通；每回合每种限 1 次与幼种共享门禁。 |
| `treant_divine` | 主效果对齐 | `+3 伤害` 正常；防负面已改为可选选择链，L2 覆盖跳过与防止两条路径。 |
| `life_sap` | 主效果对齐 | 图片、locale、实现、测试一致。 |
| `thorn` | 主效果对齐 | 代码和 locale 均已按 `每回合至多 2 伤害` 结算/描述。 |

### 专属卡（15）

| 对象 | 当前判定 | 直接证据 |
|---|---|---|
| `treant-card-trample` | 主效果对齐 | 当前已改成 `5 骰、每个树枝 +1、至少 +3 再给刺藤`；L2 已测。 |
| `upgrade-tend-care-2` | 主效果与描述对齐 | 目标能力 `TEND_CARE_2` 已对齐；升级卡描述已按卡图展开为 `抽1 + 养成4 + 生命源泉目标 + 刺藤目标`；缺逐卡真实打出 L3。 |
| `upgrade-rooted-2` | 主效果与描述对齐 | 目标能力 `ROOTED_2` 已对齐；升级卡描述已按卡图展开为 `防御掷4骰 + 防止树枝/树灵伤害 + 双树叶/双树灵分支`；缺逐卡真实打出 L3。 |
| `treant-card-drink-deep` | 主效果对齐 | 当前已改成 `选择1名玩家获得生命源泉`；L2 已测。 |
| `upgrade-shattering-fist-3` | 主效果对齐 | 描述已按图片展开，目标能力也已对齐；L2 已测。 |
| `treant-card-harvest` | 主效果对齐 | 当前已改成 `移除至多3树灵得CP；至少移除2时至多2名玩家得生命源泉`；L2 已测。 |
| `treant-card-cultivate` | 主效果对齐 | 当前已改成正式 `养成3树灵`，不再固定幼种；L2 已测。 |
| `treant-card-downpour` | 主效果对齐 | 当前已改成 `养成所有现有树灵各一次（任意顺序）`；L2 已测。 |
| `upgrade-nature-touch-2` | 主效果与描述对齐 | 目标能力 `NATURE_TOUCH_2` 已对齐；升级卡描述已按卡图展开为 `养成2 + 6不可防御 + 每树灵+1`；缺逐卡真实打出 L3。 |
| `treant-card-soulfire` | 主效果对齐 | 当前已改成 `树枝=对所有对手1附属伤害；树叶=生命源泉；树灵=养成1`；L2 已测。 |
| `treant-card-mother-tree` | 主效果对齐 | 当前已改成 `投1骰；树灵=>养成4；否则抽1`；L2 已测。 |
| `upgrade-vengeful-vines-2` | 主效果与描述对齐 | 目标能力已对齐；升级卡描述已按卡图展开为 `小顺子 + 刺藤 + 8伤害`；缺逐卡真实打出 L3。 |
| `upgrade-wild-growth-2` | 主效果与描述对齐 | 目标能力已对齐；升级卡描述已按卡图展开为 `4伤害 + 至多2树灵各+4 + 弃生命源泉不可防御`；缺逐卡真实打出 L3。 |
| `upgrade-shattering-fist-2` | 主效果对齐 | 描述已按图片展开；`sourceAtlasIndex` 已修到 `30`；L2 已测。 |
| `treant-card-planting` | 主效果对齐 | 当前已改成正式 `养成3树灵`；`sourceAtlasIndex` 已修到 `31`；L2 已测。 |

## 测试口径

| 证据 | 当前状态 | 结论 |
|---|---|---|
| `src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts` | 当前已扩到 19 条用例，覆盖 `quiet-cultivation`、`rooted/rooted-2`、`shattering-fist I/II/III`、`tend-care I/II`、`nature-touch-2`、`wild-growth-2`、`forest-awakens`、`drink-deep`、`harvest`、`planting`、`downpour`、`mother-tree`、`trample`、`soulfire` | **当前文件已不再是假阳性来源** |
| `src/games/dicethrone/__tests__/treant-token-mechanics.test.ts` | 已重写神性树灵防负面用例：先出现选择，跳过则保留 debuff，选择防止才消耗神性并阻止 debuff；新增树灵每回合每种限用 1 次用例 | **旧假阳性已降级并替换为新 L2 行为证据** |
| `npx vitest run src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts src/games/dicethrone/__tests__/treant-token-mechanics.test.ts src/games/dicethrone/__tests__/customaction-category-consistency.test.ts --configLoader native --maxWorkers 1` | 2026-05-17 实测 `38/38` 通过 | 支撑 Treant 当前 L2 口径；不代表真实 UI/L3 已完成 |
| `npx vitest run src/games/dicethrone/__tests__/treant-token-mechanics.test.ts --configLoader native --maxWorkers 1` | 2026-05-17 实测 `9/9` 通过 | 回归确认神性可选防负面与树灵每回合门禁的 L2 语义仍成立 |
| `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-treant-ninja-mechanics.e2e.ts "树精小顺子高亮应落在复仇枝蔓而不是被动槽"` | 2026-05-17 实测通过 | L3：真实攻掷阶段确认后，只高亮 `combo=vengeful-vines`，被动槽 `sky=quiet-cultivation` 未出现主动可选高亮 |
| `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-treant-ninja-mechanics.e2e.ts "树精木苗树灵主阶段按钮应短文案展示且同回合同类仅能花费一次"` | 2026-05-17 实测通过 | L3：木苗树灵主阶段入口可见，使用一次后 `treantSpiritSpentThisTurn['0'].treant_sapling=true`，HP/CP 生效，两个木苗按钮同回合隐藏 |
| `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-treant-ninja-mechanics.e2e.ts "树精神圣防负面应在阶段推进中弹出可选响应窗"` | 2026-05-17 首跑发现点击“不花费”后弹窗重复出现；修复 `flowHooks.ts` 时序保护后复跑通过 | L3：真实阶段推进会在防守方页面弹出神性树灵选择窗；跳过保留神性与慢性中毒；花费则消耗神性、阻止慢性中毒并进入防御阶段 |
| `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-treant-ninja-mechanics.e2e.ts "树精扎根防御应真实掷骰结算且不可防御时跳过"` | 2026-05-17 重建后复跑通过 | L3：真实点击“开始防御”后右下 `rooted` 槽高亮；双树叶分支弹出选择窗并结算到 `seedling=1`、防止 4 点伤害；不可防御分支跳过防御但攻击伤害照常落地 |
| `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-treant-ninja-mechanics.e2e.ts "树精专属主阶段卡应通过真实手牌完成升级与选择结算代表链"` | 2026-05-17 实测通过 | L3：`upgrade-rooted-2`、`treant-card-drink-deep`、`treant-card-cultivate` 均从真实手牌拖拽打出，覆盖升级卡、选择玩家动作卡、养成选择动作卡代表链 |
| `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-treant-ninja-mechanics.e2e.ts "树精践踏应通过真实手牌打出并在奖励骰收口后计入攻击修正"` | 2026-05-17 实测通过 | L3：`treant-card-trample` 从真实手牌拖拽打出，奖励骰可见，收口后 `bonusDamage=3`、`attackModifierBonusDamage=3`，且防守方获得 `thorn=1` |

## 2026-05-17 L3 截图观察

| 截图 | 我实际看到的内容 | 是否达到本轮验收 |
|---|---|---|
| `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精木苗树灵主阶段按钮应短文案展示且同回合同类仅能花费一次\01-sapling-short-buttons-before-use.png` | Treant 玩家板真实显示；左侧 token 区能看到幼种 `1/3`、木苗 `2/2`；右侧出现两个木苗树灵主阶段按钮“治疗+CP”和“抽牌”，生命源泉与幼种入口隐藏。 | 达标：证明木苗树灵主动入口来自真实玩家板 UI。 |
| `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精木苗树灵主阶段按钮应短文案展示且同回合同类仅能花费一次\02-sapling-after-one-use-same-type-hidden.png` | 点击“治疗+CP”后，左侧 HP 从 `35` 变为 `36`，CP 从 `1` 变为 `2`，木苗从 `2/2` 变为 `1/2`；右侧两个木苗按钮都不再出现。 | 达标：UI 与状态断言共同证明同回合同类树灵仅能花费一次。 |
| `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精小顺子高亮应落在复仇枝蔓而不是被动槽\01-vengeful-vines-highlight-on-combo-slot.png` | 左下紫色被动槽 `quiet-cultivation` 没有红色高亮；中排 `复仇枝蔓` 槽出现唯一红色可选高亮，说明小顺子候选落点已回到正确技能槽。 | 达标：直接回应用户首个截图问题，证明“被动槽冒充可选技能”已修正。 |
| `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精神圣防负面应在阶段推进中弹出可选响应窗\02-divine-choice-modal-skip-branch.png` | 阶段推进后，防守方页面出现“技能结算选择”弹窗，正文是“神性树灵：是否防止即将受到的负面状态？”，按钮为“花费神性树灵：防止该状态”和“不花费”。 | 达标：证明神性树灵防负面不是自动吞 debuff，而是真实可选响应窗。 |
| `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精神圣防负面应在阶段推进中弹出可选响应窗\03-divine-skip-keeps-debuff-and-token.png` | 点击“不花费”后，选择窗关闭，画面进入“对方发动进攻”的防御阶段特写；E2E 同时断言神性仍为 `1`，慢性中毒为 `1`。 | 达标：证明跳过分支会保留负面状态且不消耗神性。 |
| `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精神圣防负面应在阶段推进中弹出可选响应窗\05-divine-choice-modal-prevent-branch.png` | 重置同类场景后，防守方再次看到同一个神性树灵选择窗和两枚可选按钮。 | 达标：证明防止分支也从真实 UI 入口开始，不是直接注入结果。 |
| `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精神圣防负面应在阶段推进中弹出可选响应窗\06-divine-prevent-consumes-token-and-blocks-debuff.png` | 点击“花费神性树灵”后，选择窗关闭，画面进入防御阶段特写；E2E 同时断言神性为 `0`，慢性中毒为 `0`，`treantSpiritSpentThisTurn['0'].treant_divine=true`。 | 达标：证明花费分支消耗神性并阻止负面状态，且收口后可继续流程。 |
| `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精扎根防御应真实掷骰结算且不可防御时跳过\02-rooted-defense-slot-highlight-after-showcase-dismissed.png` | 攻击特写关闭后，玩家板完整可见；右下 `扎根` 防御槽有红色选中框，倒数第二 `野蛮生长` 槽没有红框，左下紫色被动槽也没有红框。 | 达标：直接回应用户第二个截图问题，证明“防御阶段高亮落错槽位”已修正。 |
| `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精扎根防御应真实掷骰结算且不可防御时跳过\03-rooted-choice-modal-after-defense-roll.png` | 防御骰结算后出现“技能结算选择”弹窗，正文为“扎根：选择额外效果”，按钮为“养成后：幼种 1”。 | 达标：证明双树叶分支不是静默改状态，而是进入真实选择 UI。 |
| `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精扎根防御应真实掷骰结算且不可防御时跳过\04-rooted-after-choice-and-resolve.png` | 选择后回到主阶段 2，Treant HP 为 `46`，幼种变为 `1/3`；E2E 同时断言攻击者 HP 保持 `30`、生命源泉仍为 `0`。 | 达标：证明 `rooted` 双树叶分支养成 1，并按树枝+树灵防止 4 点伤害。 |
| `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精扎根防御应真实掷骰结算且不可防御时跳过\06-rooted-undefendable-after-advance.png` | 不可防御分支展示“对方选中了技能”的攻击特写；E2E 断言 Treant HP 从 `50` 到 `45`，幼种和生命源泉仍为 `0`。 | 达标：证明不可防御攻击不会触发 `rooted` 防御收益，但攻击伤害仍照常结算。 |
| `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精专属主阶段卡应通过真实手牌完成升级与选择结算代表链\02-upgrade-rooted-2-after-play.png` | `upgrade-rooted-2` 从手牌打出后手牌区清空，CP 从 `5` 变为 `2`，右下 `扎根` 槽叠加升级卡图。 | 达标：证明升级卡真实手牌打出、付费、升级落点均成立。 |
| `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精专属主阶段卡应通过真实手牌完成升级与选择结算代表链\04-drink-deep-choice-modal.png` | 打出 `痛饮！` 后出现“痛饮：选择获得生命源泉的玩家”弹窗，提供 P1/P2 两个目标按钮。 | 达标：证明选择玩家动作卡走真实 UI 选择，不是直接注入目标。 |
| `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精专属主阶段卡应通过真实手牌完成升级与选择结算代表链\05-drink-deep-after-resolve.png` | 选择 P1 后弹窗关闭，左侧生命源泉 token 可见，CP 从 `5` 变为 `4`，手牌已消耗。 | 达标：证明 `痛饮！` 真实出牌后把生命源泉落到所选玩家。 |
| `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精专属主阶段卡应通过真实手牌完成升级与选择结算代表链\08-cultivate-after-resolve.png` | 打出 `培育！` 并选择“结算后：幼种 3”后，左侧幼种显示 `3/3`，CP 从 `5` 变为 `2`，手牌已消耗。 | 达标：证明养成选择动作卡通过真实手牌入口完成并落到 token。 |
| `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精践踏应通过真实手牌打出并在奖励骰收口后计入攻击修正\02-trample-bonus-dice-overlay.png` | 打出 `践踏！` 后，右侧出现攻击修正 `+3` 徽章，画面中央显示 5 个奖励骰结果；手牌区能看到打出的 `践踏！` 卡。 | 达标：证明攻击修正/掷骰卡不是只走状态注入，真实 UI 能显示奖励骰结果与修正提示。 |
| `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精践踏应通过真实手牌打出并在奖励骰收口后计入攻击修正\03-trample-after-closeout-bonus-damage-and-thorn.png` | 奖励骰收口后，`践踏！` 仍在打出区，攻击修正徽章保持 `+3`，E2E 同时断言 CP 从 `3` 变为 `2`、手牌清空、防守方刺藤为 `1`。 | 达标：证明 `践踏！` 的 +3 和“至少 +3 时施加刺藤”都落到权威状态。 |

## 结论

- Treant 当前**不能**写成“全面审计已收口”。
- 当前最硬的未收口点还有 1 类：
  1. Treant 真实 UI/L3 已补树灵主动入口、神性树灵可选响应、玩家板槽位高亮合同、`rooted` 完整防御链、专属主阶段卡代表链、攻击修正/掷骰卡代表链；但没有把 15 张专属卡逐卡全集都跑到 L3。
- 这意味着：
  - 玩法实现层已收敛到 Treant 主效果 L2 通过。
  - 用户最早点名的两个槽位 bug，当前已有真实 UI 证据证明**高亮落点修正生效**。
  - 真实入口层已新增树灵主动入口、神性防负面、技能槽位高亮、`rooted` 防御结算、主阶段专属卡代表链、攻击修正/掷骰卡代表链的 L3 证据，但不能外推成所有 Treant 对象全集 L3。
  - 数据录入层 5 张升级卡描述已补齐。
- 当前发布口径只能写成：**Treant 已完成当前已知主效果 L2 合同修正，并确认用户点名的被动槽/防御槽高亮错位、`rooted` 防御结算、主阶段专属卡代表链、攻击修正/掷骰卡代表链均已修/已补证；但仍缺 15 张专属卡逐卡全集 L3，不能宣称 Treant 全集 L3 全面完成。**
