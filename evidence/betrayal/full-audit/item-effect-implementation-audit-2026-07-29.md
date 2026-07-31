# 小黑屋物品效果实现审计（2026-07-29）

> 2026-07-29 接续边界：本文件只作为 22 张官方物品牌下游效果消费审计索引，消费 `full-deck-data-intake-contract.md` 已锁对象、当前代码和测试证据；它不替代 74 张发现牌 S0 主合同，不授权新增物品实现、Board/UI、E2E 或截图，也不能证明物品牌或整牌库完成。

## 审计范围

本文件只审 `src/games/betrayal` 当前 22 张官方物品牌的效果实现消费情况，不审预兆牌、事件牌、房间效果、木乃伊剧本中段和 UI/E2E 截图闭环。当前对象为：魔法相机、恐怖玩偶、奇怪的药品、镜子、急救包、幸运硬币、皮夹克、牙齿项链、手电筒、头戴耳机、奇异护符、胸针、枪、十字弓、骨制钥匙、神秘秒表、地图、砍刀、电锯、炸药、天使之羽、兔脚。

本文件不重新录入图包或规则来源，不新增玩法实现。当前只消费已有合同、代码、测试和 evidence。

## 结论等级

结论等级：`item-effect-matrix-indexed / mixed-domain-verified / downstream-open`。

含义：22 张物品已经进入当前运行池，且多数有 L1 结构入口和 L2 领域代表链；但逐物品 UI 承接、攻击/作祟/死亡保护/交易/房间伤害组合、真实入口 E2E 和截图链仍未闭合。不能把“22 张数量对齐”或“有领域代表链”说成整物品牌库完成。

## 权威来源

| 类型 | 当前来源 |
| --- | --- |
| 对象全集 | `evidence/betrayal/full-audit/full-deck-data-intake-contract.md` 第 4 节与 6.13；`evidence/betrayal/full-audit/object-l0-l4-matrix.md` |
| 运行池配置 | `src/games/betrayal/scenarioConfig.ts` 的 22 张 `possessions.item` |
| 主动使用定义 | `src/games/betrayal/possessionEffects.ts` 的 `POSSESSION_USE_EFFECTS` |
| 领域消费 | `src/games/betrayal/game.ts` 的治疗、移动、攻击武器、重掷、伤害替换、伤害减免、额外行动、炸药、天使之羽等消费链 |
| 页面承接 | `src/games/betrayal/Board.tsx` 的持有物说明、动作 rail、攻击武器选择、交易和目标选择承接 |
| 测试证据 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts`、`src/games/betrayal/__tests__/Board.foundation.test.tsx`、既有 E2E evidence |

## 逐项结论

| 物品 | 主要效果桶 | 当前实现消费 | 证据等级 | 残余范围 |
| --- | --- | --- | --- | --- |
| 魔法相机 | 属性检定替代、作祟 33 归属 | 已有合同和代表链；新增摄影师、作祟或属性检定消费者时需回查 | `covered-by-existing-contract / consumer-review-on-change` | 不新增消费者时不重审；新增作祟或属性检定消费者时补组合。 |
| 恐怖玩偶 | 最近属性检定全骰重掷 | 已有最近属性检定重掷入口；固定骰、攻击、作祟检定不放行；当前树 Board 组件代表链已证明选中恐怖玩偶后，最近属性检定骰盘会为全部骰子生成可重掷目标 | `partial-mechanism-covered / Board component representative / partial-ui` | 真实 Playwright / 截图链、作祟特殊行动属性检定通用回滚快照和更多重掷消费者组合未闭合。 |
| 奇怪的药品 | 埋葬后治疗力量/速度 | `POSSESSION_USE_EFFECTS` 治疗类主动使用链已承接；灰尘主动持有牌 E2E 已证明真实页面无需目标即可使用、埋葬并恢复力量/速度 | `L3 representative / partial-combo` | 死亡保护、交易限制和更多作祟状态组合仍需再审；不能外推全部治疗物品。 |
| 镜子 | 埋葬后治疗知识/神志 | 规则合同为“在你的回合内，可以埋葬此镜子；若如此做，治疗你的知识和神志”；本轮灰尘主动持有牌 E2E 已证明真实页面显示知识/神志自疗预览，使用后埋葬并恢复知识/神志 | `L3 representative / partial-combo` | 伤害后治疗、更多回合时点、作祟状态、交易限制和死亡保护组合仍待补。 |
| 急救包 | 同房治疗任意属性 | 治疗自己或同房探索者的已有消费者链；本轮灰尘主动持有牌 E2E 已证明真实页面可点同房探索者、预览治疗并在使用后埋葬 | `L3 representative / partial-combo` | 死亡保护、交易限制和更多作祟 / 受伤状态组合仍需随新增消费者审。 |
| 幸运硬币 | 空白骰重掷、空白精神伤害 | 已覆盖事件/房间属性检定空白骰重掷、空白后精神伤害、倒塌房间组合代表链；当前树 Board 组件代表链已证明选中幸运硬币后，最近属性检定骰盘只高亮空白骰，非空白骰不会生成可重掷目标 | `combo-domain-verified / Board component representative / partial-ui` | 真实 Playwright / 截图链、作祟特殊行动、死亡保护和更多伤害分配组合未闭合。 |
| 皮夹克 | 防御攻击额外 1 骰 | 防御攻击最小运行链存在；当前树 Board 组件代表链已证明真实攻击入口结算后，攻击投骰复盘显示进攻总点、防御总点和防御额外 1 骰 | `min-domain-verified / Board component representative / partial-ui` | 真实 Playwright / 截图链、怪物攻击、作祟攻击和更多攻击来源组合未闭合。 |
| 牙齿项链 | 回合结束濒死属性 +1 | 回合结束触发、濒死属性筛选、选择后提升、跳过和非法属性拒绝存在；当前树 Board 组件代表链已证明牙齿项链选择面板显示濒死属性、确认前不可提交、跳过无需先选属性，选择属性后确认会派发同一事件选择命令 | `min-domain-verified / min-ui-representative / partial-combo` | 真实 Playwright / 截图链、作祟回合、房间回合末和死亡保护组合未闭合。 |
| 手电筒 | 事件属性检定额外骰 | 事件属性检定消费者已有代表链 | `covered-by-existing-contract / consumer-review-on-change` | 新增事件属性检定消费者时逐项确认是否加骰。 |
| 头戴耳机 | 精神伤害 -1 | 精神伤害减免已有消费者链；Board 组件代表链覆盖伤害分配页显示原始精神伤害、头戴耳机减免和实际分配数。 | `covered-by-existing-contract / Board component representative / consumer-review-on-change` | 真实 Playwright / 截图链、更多精神伤害来源、死亡保护和作祟精神伤害组合待补。 |
| 奇异护符 | 承受物理伤害后获得 1 神志 | 已覆盖实际承受物理伤害后获得神志，并排除通用伤害和直接属性降低误触发；当前树 Board 摘要会明示“实际承受物理伤害后 +1 神志”，物理伤害分配日志会显示奇异护符触发 | `min-domain-verified / min-ui-representative / partial-combo` | 真实 Playwright / 截图链、减伤、死亡保护、作祟物理伤害组合未闭合。 |
| 胸针 | 物理/精神伤害替换为通用伤害 | 已覆盖物理/精神伤害改写为通用伤害、未声明仍按原伤害类型；当前树 Board 组件代表链已证明伤害分配页默认只显示原伤害属性，开启胸针后切到通用伤害并提交 `useBrooch: true`；木乃伊攻击真实入口已证明强制速度/力量伤害下胸针不适用，页面不显示胸针开关且不会把胸针记为已用；灰尘普通攻击真实入口已证明非强制物理伤害可在受伤玩家页面开启胸针并改为四属性通用伤害；指环攻击真实入口已证明非强制精神伤害可在受伤玩家页面开启胸针并改为四属性通用伤害 | `min-domain-verified / min-ui-representative / mummy-forced-damage-e2e-boundary / non-forced-physical-damage-e2e-representative / non-forced-mental-damage-e2e-representative / partial-combo` | 更多伤害来源、减伤叠加、死亡保护 / 作祟伤害组合未闭合。 |
| 枪 | 视线速度攻击，失败不反伤 | 已覆盖速度攻击、视线目标、失败不反伤和用后交易限制；当前组件断言证明枪选中后才画武器视线线 | `min-verified / partial-combo` | 视线边界、怪物目标、作祟攻击和多武器组合未闭合。 |
| 十字弓 | 同板块/相邻速度攻击，失败不反伤 | 已覆盖同板块/相邻目标、速度攻击、失败不反伤和用后交易限制；当前树 E2E 已证明相邻叛徒目标高亮且不画视线线 | `min-verified / partial-combo` | 相邻边界、怪物目标、作祟攻击和多武器组合未闭合；旧“弩 / 十字弓视线”证据只保留为历史旧口径。 |
| 骨制钥匙 | 穿墙移动并埋葬 | 规则合同为“移动时可穿过一格同层相邻墙体”；当前树领域限制已消费已发现 / 同层 / 相邻 / 非普通连门，Board 组件与真实页面 E2E 已证明打开移动模式可看到穿墙目标、点击后移动结算并回到默认牌桌 | `L3 representative / partial-combo` | 墙体 / 门位 / 同层 / 相邻限制全组合、作祟地图规则、特殊移动限制和埋葬随机分支仍待补。 |
| 神秘秒表 | 作祟后埋葬，回合结束后再行动一轮 | 规则合同为“在你的回合内，可以埋葬此秒表；若如此做，在本回合结束后再进行一轮行动；只能在作祟开始后使用”；本轮灰尘主动持有牌 E2E 已证明真实页面可使用并埋葬，写入额外行动等待状态，点击结束回合后仍回到当前玩家行动 | `L3 representative / partial-combo` | 更多作祟、怪物回合、房间回合末和额外行动交接组合未闭合。 |
| 地图 | 埋葬后移动到已发现房间 | 地图类目标选择已有代表链；本轮灰尘主动持有牌 E2E 已证明地图及 `notebook / journal / manuscript` 三个 alias 可从真实房间板块选择已发现目标；alias 不计官方 22 张独立物品 | `L3 representative / duplicate-alias-guarded / partial-combo` | 墙体/门位/跨楼层、作祟地图限制和骨制钥匙等移动消费者仍需再审。 |
| 砍刀 | 近战武器，攻击结果 +1 | 攻击武器消费者已有代表链；当前树 E2E 已复跑真实页面选择砍刀、叛徒高亮、投骰反馈和使用后状态 | `covered-by-existing-contract / partial-combo` | 多武器互斥全排列、交易限制和更多攻击来源组合未闭合。 |
| 电锯 | 攻击额外 1 骰 | 已覆盖攻击额外骰和用后交易限制 | `min-verified / partial-combo` | 攻击 UI、怪物目标和多武器互斥组合未闭合。 |
| 炸药 | 代替攻击，选当前/相邻房间，群体速度检定，埋葬 | 已覆盖代替常规攻击、目标板块、每名探索者/怪物分别速度检定、失败物理伤害和怪物受伤后端；当前树已补 Board 页面组件代表链：主动作自动选中炸药，进入当前 / 相邻已发现房间目标态，点击房间板块派发炸药攻击 | `L3 representative / partial-combo` | 真实 Playwright / 截图链、非法原因展示、更多怪物 / 作祟组合、特殊免疫和墙体 / 门位相邻边界未闭合。 |
| 天使之羽 | 埋葬后选择 0-8 作为下一次非战斗属性检定结果 | 规则合同为“当你被要求进行一次属性检定时，可以埋葬此天使之羽；选择一个 0-8 之间的数字，使用该数字作为投骰结果；仍可以应用相关属性加成”；本轮补正式页面 0-8 数字选择，E2E 已证明未选数字时使用按钮禁用，选择 6 后埋葬并写入下一次非战斗检定替代总点数 | `L3 representative / partial-combo` | 攻击/作祟检定边界、房间回合末组合、额外骰是否属于相关加值的规则裁定仍待补。 |
| 兔脚 | 最近投骰重掷 | 兔脚重掷已有跨事件、房间、攻击、死亡保护等代表消费者 | `broad-domain-covered / consumer-review-on-change` | 新增骰子消费者必须逐项确认是否允许兔脚重掷，不能默认全开。 |

## 验证证据

| 检查 | 结果 |
| --- | --- |
| 22 张物品结构入口 | `firstScenarioRuntime.test.ts` 中“当前 22 张物品牌均登记真实能力入口而不是只登记翻牌确认”覆盖主动使用、攻击武器、被动/特殊消费者入口矩阵。 |
| 主动使用链 | `possessionEffects.ts` 覆盖奇怪的药品、镜子、急救包、地图、神秘秒表、天使之羽等主动使用入口；本轮灰尘主动持有牌 E2E 已覆盖急救包、奇怪的药品、镜子、地图及三张 alias、神秘秒表、天使之羽、书本、面具的真实页面代表链；其他物品多由 `game.ts` 的攻击、重掷、伤害或作祟消费者承接。 |
| 领域代表链 | `firstScenarioRuntime.test.ts` 已覆盖恐怖玩偶、胸针、奇异护符、幸运硬币、牙齿项链、枪、十字弓、神秘秒表、炸药、天使之羽等定向领域链。 |
| 恐怖玩偶 Board 组件回归 | `Board.foundation.test.tsx -t "恐怖玩偶"`：1 passed / 143 skipped；覆盖真实页面选中恐怖玩偶后，最近属性检定骰盘为全部骰子生成重掷目标，0/1/2 三颗骰子均可选。 |
| 胸针 Board 组件回归 | `Board.foundation.test.tsx -t "胸针"`：1 passed / 136 skipped；覆盖伤害分配页出现胸针开关、默认物理伤害只显示力量/速度、开启后显示力量/速度/知识/神志、确认命令带 `useBrooch: true`。 |
| 胸针木乃伊强制伤害真实入口 | `mummy-rampage-monster-actions.e2e.ts -g "木乃伊攻击奖励造成强制伤害时，持有胸针也不能改为通用伤害"`：1 passed；截图 `30-木乃伊攻击胸针强制伤害分配页.jpg` 与 `31-木乃伊攻击胸针强制伤害结算后反馈.jpg` 证明受伤英雄持有胸针时，木乃伊强制伤害页不显示胸针开关、不开放知识/神志，结算后胸针未记为已用。 |
| 胸针灰尘普通攻击真实入口 | `the-dust-ordinary-attack-death.e2e.ts` 整文件：2 passed；其中 `防御方持有胸针时，普通攻击物理伤害可从真实页面改为通用伤害` 通过；截图 `04-普通攻击胸针通用伤害分配面板.jpg` 与 `05-普通攻击胸针通用伤害结算反馈.jpg` 证明非强制普通攻击物理伤害可在真实页面开启胸针、改为通用伤害并分配到知识后结算回牌桌。 |
| 胸针指环精神伤害真实入口 | `non-p0-representative.e2e.ts -g "胸针精神伤害真实链路"`：1 passed；截图 `01-指环攻击胸针通用伤害分配面板.jpg` 与 `02-指环攻击胸针通用伤害结算反馈.jpg` 证明非强制精神伤害可在真实页面开启胸针、改为通用伤害并结算回牌桌。 |
| 奇异护符 Board / 日志回归 | `firstScenarioRuntime.test.ts -t "奇异护符"`：12 passed / 682 skipped；`Board.foundation.test.tsx -t "持有物卡片会暴露"`：1 passed / 136 skipped；覆盖物理伤害后神志 +1、日志出现“奇异护符使神志 +1”、持有区摘要明示常规物理伤害触发。 |
| 页面承接 | `Board.tsx` 有持有物说明、攻击武器选择、动作 rail、交易/目标相关状态；但这只说明页面有承接入口，不等于逐物品真实 UI/E2E 完整闭合。 |
| 本轮新增验证 | 续跑 `non-p0-representative.e2e.ts` 中无武器、砍刀、指环、匕首、十字弓相邻攻击和武器禁用原因代表链，均定向 `1 passed`；这些证明攻击武器 UI 代表链恢复到当前规则口径，但不证明 22 张物品逐卡完成。 |
| 本轮新增验证 | `npx tsx -e "import { createDustHauntCore } from './src/games/betrayal/testing/firstScenarioTestUtils.ts'; ..."` 返回 `{"phase":"haunt","hasDust":true,"pendingEventChoice":false,"room":"厨房"}`；`$env:NODE_OPTIONS='--max-old-space-size=8192'; npx eslint src/games/betrayal/Board.tsx e2e/betrayal/the-dust-active-possession-ui.e2e.ts e2e/betrayal/betrayalTestHelpers.ts` 通过；`node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/the-dust-active-possession-ui.e2e.ts` 通过，7 passed；证明灰尘主动持有牌 UI 代表链扩展到 11 张，但不证明全部物品 / 预兆主动能力完成。 |
| 本轮新增验证 | 骨制钥匙当前树补证：`npx eslint src/games/betrayal/Board.tsx src/games/betrayal/__tests__/Board.foundation.test.tsx e2e/betrayal/first-scenario-use-possession.e2e.ts` 0 errors；`firstScenarioRuntime.test.ts -t "骨制钥匙"` 7 passed / 687 skipped；`Board.foundation.test.tsx -t "骨制钥匙\|急救包会在真实页面"` 2 passed / 132 skipped；`first-scenario-use-possession.e2e.ts` 3 passed；截图刷新 6 张。 |
| 本轮新增验证 | 炸药目标板块当前树补证：`node --max-old-space-size=8192 ./node_modules/eslint/bin/eslint.js src/games/betrayal/Board.tsx src/games/betrayal/__tests__/Board.foundation.test.tsx` 0 errors；`Board.foundation.test.tsx -t "炸药\|十字弓\|枪\|砍刀"` 4 passed / 131 skipped；`firstScenarioRuntime.test.ts -t "炸药"` 8 passed / 686 skipped。该补证证明主动作可自动进入炸药房间目标态、点击房间板块走 `dynamite-room` 结算，但不证明真实 Playwright / 截图链或全部怪物 / 作祟组合完成。 |
| 本轮关键截图 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-the-dust-active-possession-ui\01-十一张主动持有牌入口全集.jpg`：11 张主动持有牌入口可见；`D:\gongzuo\webgame\BoardGame\evidence\betrayal-the-dust-active-possession-ui\14-天使之羽选择替代投骰结果.jpg`：天使之羽显示 0-8 替代结果选择，6 被选中后可使用；`D:\gongzuo\webgame\BoardGame\evidence\betrayal-the-dust-active-possession-ui\15-天使之羽使用后保留替代总点数.jpg`：使用后回到牌桌并保留替代总点数反馈。 |
| 本轮关键截图 | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-骨制钥匙穿墙移动完整链路\03-打开移动模式看到穿墙目标.jpg`：移动模式中可见骨制钥匙穿墙目标；`D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-骨制钥匙穿墙移动完整链路\06-骨制钥匙移动后回牌桌状态清空.jpg`：结算后底部按钮回到“移动”，未停留在“取消移动”。 |

## 测试语义对账

| 消费桶 | 测试断言证明的最终状态 | 旧测试失效检查 |
| --- | --- | --- |
| 治疗/恢复类 | 使用后目标属性轨提升或恢复，消耗类物品离开持有区，非法目标被拒绝；本轮 E2E 已证明急救包同房目标选择、奇怪的药品无目标使用、镜子自疗知识/神志。 | 未发现旧测试把治疗类误当翻牌确认；死亡保护、交易限制和更多作祟组合仍未覆盖。 |
| 最近属性检定重掷类 | 重掷后原属性检定分支被回滚并按新骰重算；幸运硬币空白结果进入精神伤害分配；当前树 Board 组件代表链已证明恐怖玩偶全骰可选、幸运硬币只允许空白骰。 | 未发现旧测试失效；恐怖玩偶作祟特殊行动属性检定仍缺通用回滚快照，真实 Playwright / 截图链也未补。 |
| 攻击武器类 | 显式声明武器后进入已用列表，攻击骰/属性/伤害类型按武器改写；未声明时不自动生效；用后交易受限。 | 旧“弩 / 十字弓视线”测试口径失效，已改为“枪走视线、十字弓走同板块 / 相邻且不画视线线”；多武器互斥全排列和怪物/作祟攻击组合仍未逐项闭合。 |
| 伤害改写/减免类 | 胸针把待分配物理/精神伤害改成通用伤害；当前树 Board 组件代表链已证明玩家页面可以切换为通用伤害并提交 `useBrooch: true`；木乃伊攻击真实入口已证明强制速度/力量伤害下胸针不适用，持有胸针也不会开放通用伤害入口；灰尘普通攻击真实入口已证明非强制物理伤害可开启胸针并改为通用伤害；指环攻击真实入口已证明非强制精神伤害可开启胸针并改为通用伤害；盔甲、头戴耳机按类型减免，当前树 Board 组件代表链已证明减伤后显示原始伤害、减免来源和实际分配数；奇异护符只在实际物理伤害后加神志，且当前树已补持有区摘要与伤害日志代表链。 | 旧“胸针伤害改写 UI 仍缺”结论已失效；旧“木乃伊攻击下胸针完全未补证”口径已收窄为“木乃伊强制伤害不适用已证明”；旧“胸针非强制伤害真实入口全缺”口径已收窄为“普通攻击物理伤害入口和指环攻击精神伤害入口已证明”；旧“头戴耳机减伤提示 UI 仍缺”已失效；旧“奇异护符 UI/日志提示仍缺”已收敛为真实 Playwright / 截图与组合残余；更多伤害来源、减伤叠加、死亡保护和作祟伤害组合仍缺。 |
| 回合结束/额外行动类 | 牙齿项链能拦截回合结束并在选择/跳过后继续交接；当前树 Board 组件代表链已证明牙齿项链结束回合面板可直接跳过，也可选择濒死属性后确认；神秘秒表能在作祟后安排额外行动，本轮 E2E 已证明页面使用后结束回合仍回到当前玩家。 | 牙齿项链旧测试暴露“跳过前错误要求先选属性”的 UI 门控缺口，已补组件回归；更多真实 Playwright / 截图、作祟、怪物回合和房间回合末组合仍缺。 |
| 地图/移动类 | 地图类移动到已发现房间，骨制钥匙 / 移动限制类按合同走对应位置消费者；本轮 E2E 已证明地图 / 笔记本 / 日记 / 手稿从真实房间板块选择已发现目标，当前树 E2E 已证明骨制钥匙穿墙目标、移动结算和移动模式收口代表链；炸药已补 Board 页面组件目标态代表链。 | 未发现旧测试失效；墙体、门位、跨楼层、作祟地图规则、特殊移动限制、炸药真实 Playwright / 截图链和非法原因展示仍需重审。 |
| 炸药 | 使用后埋葬，选定目标房间内每个目标分别速度检定；失败探索者进入物理伤害分配，失败怪物走怪物受伤后端；当前树 Board 组件已证明主动作自动选中炸药并进入目标板块选择，房间板块点击后派发 `dynamite-room` 载荷。 | 旧结论“UI 目标选择仍缺”已失效；真实 Playwright / 截图链、特殊免疫、非法原因展示和更多怪物 / 作祟组合仍缺。 |
| 天使之羽 | 使用后埋葬，选择 0-8 替代下一次非战斗属性检定总点数，固定骰和攻击不消费；本轮 E2E 已补真实页面 0-8 数字选择和使用后状态写入。 | 旧结论“UI 数字选择仍缺”已失效；额外骰规则裁定、作祟 / 攻击边界和更多组合仍缺。 |
| 兔脚 | 对允许的最近投骰消费者重掷后，最终状态按新骰结果落地，并回滚旧分支副作用。 | 未发现旧测试失效；新增骰子消费者必须逐项确认准入，不能从既有消费者外推。 |

## 同类扩审记录

| 扩审面 | 搜索范围与命中项 | 本轮裁定 | 残余扩审范围 |
| --- | --- | --- | --- |
| 主动使用牌同族 | 搜索范围：`src/games/betrayal`、`e2e/betrayal`、`evidence/betrayal/full-audit`；根因关键词：`POSSESSION_USE_EFFECTS`、`selectedInventoryReplacementRollTotal`、`replacementRollTotal`、`pendingExtraTurnAfterCurrentTurn`、`UI 数字选择`、`额外行动 UI`；命中 `possessionEffects.ts`、`game.ts`、`Board.tsx`、灰尘主动持有牌 E2E 和三份审计账本。 | 急救包、奇怪的药品、镜子、地图及三张 alias、神秘秒表、天使之羽、书本、面具已经进入同一条主动牌页面代表链；牙齿项链结束回合选择已补 Board 组件代表链；旧“八张主动牌 / 天使之羽无数字选择 / 神秘秒表无额外行动 UI / 牙齿项链结束回合 UI 未承接”的结论降级为历史失效口径。 | 这仍不是全部物品主动能力完成；牙齿项链真实 Playwright / 截图、重掷 / 伤害改写 / 死亡保护组合仍需单独审。 |
| 替代投骰同族 | 搜索范围同上；命中 `nextNonCombatTraitRollTotalReplacement`、`replacementRollTotal`、`betrayal-inventory-roll-total-selector`、`betrayal-inventory-roll-total-0..8`、天使之羽领域测试和 E2E。 | 天使之羽已从“只有领域校验”补为“领域 + 页面 0-8 选择 + 使用后状态写入”代表链。 | 攻击检定、作祟检定、房间回合末属性检定、祝福 / 额外骰是否属于相关加值，仍不能由该代表链外推完成。 |
| 额外行动同族 | 搜索范围同上；命中 `pendingExtraTurnAfterCurrentTurn`、神秘秒表领域测试和灰尘主动持有牌 E2E。 | 神秘秒表已从“只有领域额外行动”补为“页面可使用并埋葬，结束回合后回到当前玩家”的代表链。 | 怪物回合、房间回合末、连续额外行动、作祟特殊行动后的回合交接仍需组合扩审。 |
| 治疗同族 | 搜索范围同上；命中镜子、急救包、奇怪的药品和治疗类主动使用链。 | 镜子不再是“UI 组合缺失”对象；已纳入治疗类真实页面代表链，和急救包 / 奇怪的药品共享主动治疗承接。 | 死亡保护、交易限制、受伤后即时治疗、作祟状态下治疗合法性仍需保留为残余。 |
| 地图/移动同族 | 搜索范围同上；根因关键词：`canUseSkeletonKeyForMove`、`useSkeletonKey`、`MOVE_TO_ROOM`、`placeExplorer`、`skeletonKeyMoveTargetRoomIds`；命中 `game.ts`、`Board.tsx`、`Board.foundation.test.tsx`、`first-scenario-use-possession.e2e.ts` 和审计总账。 | 骨制钥匙已从“UI 待补”修正为真实页面穿墙移动代表链已补；地图 / alias 主动放置代表链仍有效；炸药目标板块已补 Board 组件代表链。 | 墙体 / 门位 / 同层 / 相邻 / 作祟地图空间组合、炸药真实 Playwright / 截图链、炸药非法原因展示、地图非法原因和特殊移动限制仍需扩审。 |
| 炸药目标板块同族 | 搜索范围同上；根因关键词：`attack-room`、`dynamiteAttackWeaponCard`、`isDynamiteRoomTargetingMode`、`selectedAttackWeaponCardId`、`dynamite-room`；命中 `Board.tsx`、`Board.foundation.test.tsx`、`firstScenarioRuntime.test.ts` 和审计总账。 | 炸药已从“只有领域、UI 目标选择未补”修正为“领域 + Board 页面组件目标态代表链”：主动作可自动选中炸药，当前 / 相邻已发现房间高亮，点击房间板块进入炸药结算。 | 仍不能外推成真实 Playwright / 截图闭环、非法原因展示、特殊免疫、墙体 / 门位相邻边界或更多怪物 / 作祟组合完成。 |
| 胸针伤害改写同族 | 搜索范围同上；根因关键词：`pendingDamageAllocation`、`damageReplacement`、`useBrooch`、`brooch-general-damage`、`RESOLVE_DAMAGE_ALLOCATION`；命中 `game.ts`、`Board.tsx`、`Board.foundation.test.tsx`、`firstScenarioRuntime.test.ts`、`mummy-rampage-monster-actions.e2e.ts`、`the-dust-ordinary-attack-death.e2e.ts`、`non-p0-representative.e2e.ts` 和审计总账。 | 胸针已从“领域代表链、UI 缺口”修正为“领域 + Board 组件伤害分配代表链”：玩家页面可在物理 / 精神伤害分配时开启胸针，改成通用伤害并提交 `useBrooch: true`；木乃伊强制速度/力量伤害真实入口已证明胸针不适用；灰尘普通攻击真实入口已证明非强制物理伤害可开启胸针并改为通用伤害；指环攻击真实入口已证明非强制精神伤害可开启胸针并改为通用伤害。 | 仍不能外推成所有伤害来源、减伤叠加、死亡保护或作祟伤害组合完成。 |

## 共享根因与残余范围

共享根因：旧矩阵把“物品已在运行池 / 有一条领域代表链 / 有持有区说明”与“逐物品 UI、组合、真实入口闭合”放在同一层，容易掩盖 `partial-ui` 和 `partial-combo`。尤其攻击武器、伤害改写、死亡保护、作祟行动、房间回合末和交易限制都是跨消费者链，不能靠单个代表测试外推。

残余范围：

- 攻击类物品已有当前树 UI 代表链：徒手、砍刀、指环、匕首、十字弓相邻和武器禁用原因定向复跑通过；仍需补多武器互斥全排列、怪物目标、作祟攻击和交易限制组合。
- 重掷/替换类物品仍需补 UI 承接、原分支回滚、作祟特殊行动和新增骰子消费者准入。
- 伤害类物品中胸针 Board 组件伤害改写代表链已补，木乃伊强制伤害下胸针不适用的真实入口 / 截图链已补，灰尘普通攻击非强制物理伤害下胸针可用的真实入口 / 截图链已补，指环攻击非强制精神伤害下胸针可用的真实入口 / 截图链已补；奇异护符 Board 摘要 / 日志代表链已补；仍需补更多减伤叠加、死亡保护、作祟伤害和盔甲/奇异护符/头骨/兔脚组合。
- 回合结束类物品中牙齿项链结束回合 Board 组件代表链已补；仍需补真实 Playwright / 截图、房间回合末、怪物 / 作祟回合和死亡保护组合。
- 地图/移动类物品已有地图及三张 alias 的真实页面目标选择代表链，骨制钥匙穿墙移动真实页面代表链已补，炸药房间目标 Board 组件代表链已补；仍需补墙体 / 门位 / 楼层、作祟地图限制、炸药真实 Playwright / 截图链、非法原因展示和其它移动消费者。

## 修订记录

| 项 | 结论 |
| --- | --- |
| 旧矩阵风险 | `object-l0-l4-matrix.md` 对部分物品使用 `firstScenarioRuntime 持有物消费者覆盖` 或 `family 代表链`，容易被误读为 22 张物品逐卡完成。 |
| 本轮修订 | 本文件把 22 张物品按效果桶拆成专项实现审计，并明确当前仍是 `downstream-open`。 |
| 本轮补检 | 攻击武器桶已消费当前树 E2E 复跑结果：旧十字弓视线口径降级为历史；当前枪 / 幻影摄影师承担视线代表链，十字弓承担同板块 / 相邻代表链。 |
| 本轮补检 | 灰尘主动持有牌 UI 代表链已消费当前树 E2E：旧夹具只指定事件牌、未指定事件房，实际翻出“观测台”导致没有《一瓶微尘》事件选择；现已固定为厨房事件房并在当前页面验证急救包、奇怪的药品、镜子、地图 / 笔记本 / 日记 / 手稿、神秘秒表、天使之羽、书本、面具 11 张主动持有牌代表链。 |
| 旧结论失效 | 旧结论“天使之羽仍缺 UI 数字选择 / 神秘秒表仍缺额外行动 UI / 镜子仍缺 UI 组合”已不准确；本轮已补真实页面代表链。当前残余降级为组合和边界缺口，不能继续把三张牌写成功能未实现。 |
| 旧结论失效 | 旧结论“骨制钥匙穿墙 UI 仍缺真实入口 E2E / 截图”已不准确；当前树已补领域、组件、E2E 和 6 张截图代表链。当前残余降级为空间组合边界，不能继续写成功能未实现。 |
| 旧结论失效 | 旧结论“炸药目标板块 UI 仍缺”已不准确；当前树已补领域、Board 组件和动作 rail 到房间板块点击代表链。当前残余降级为真实 Playwright / 截图、非法原因、特殊免疫、空间边界和怪物 / 作祟组合，不能继续写成功能未实现。 |
| 旧结论失效 | 旧结论“牙齿项链结束回合 UI 仍缺”已不准确；当前树已补 Board 组件代表链，并用红测证明旧页面曾错误要求先选濒死属性才能跳过。当前残余降级为真实 Playwright / 截图、作祟回合、房间回合末和死亡保护组合，不能继续写成功能未实现。 |
| 旧结论失效 | 旧结论“胸针伤害改写 UI 仍缺”已不准确；当前树已补 Board 组件代表链，证明玩家页面可开启胸针并提交 `useBrooch: true`。当前树还补了木乃伊强制速度/力量伤害真实入口，证明该强制顺序下胸针不适用；补了灰尘普通攻击非强制物理伤害真实入口，证明普通攻击物理伤害可开启胸针改为通用伤害；补了指环攻击非强制精神伤害真实入口，证明精神伤害也可从真实页面开启胸针改为通用伤害。当前残余降级为更多伤害来源、减伤叠加、死亡保护和作祟伤害组合，不能继续写成功能未实现。 |
| 旧结论失效 | 旧结论“奇异护符 UI/日志提示仍缺”已不准确；当前树已补 Board 持有区摘要和物理伤害分配日志代表链，证明玩家能看到常规物理伤害触发规则和结算反馈。当前残余降级为真实 Playwright / 截图链、减伤、死亡保护和作祟物理伤害组合，不能继续写成玩家可见规则为空。 |
| 自检结果 | `npm run audit:evidence:selfcheck -- evidence/betrayal/full-audit/core-loop-player-interaction-audit-2026-07-29.md evidence/betrayal/full-audit/mummy-rampage-midgame-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/event-effect-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/item-effect-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/omen-and-haunt-rule-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/room-effect-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/runtime-implementation-consumption-audit-2026-07-29.md evidence/betrayal/full-audit/full-deck-data-intake-contract.md evidence/betrayal/full-audit/object-l0-l4-matrix.md` 通过；检查 9 个审计文档，结果 OK。 |
| 当前状态 | `mixed-domain-verified / partial-ui / partial-combo / downstream-open`，不是完成。 |
