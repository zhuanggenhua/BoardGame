# Task Plan: DiceThrone 战术家与咒缚海盗新增英雄接入（2026-05-30）

> 当前正式计划入口。下方 `TDD 行为 seam 与测试结构重构` 及更早内容均为历史上下文，不作为本轮任务入口。

## Goal

遵循 `.windsurf/skills/add-new-faction/SKILL.md` 与 `docs/games/dicethrone/workflows/dicethrone-hero-intake.md`，把 DiceThrone 新英雄战术家（`zhanshujia`）与咒缚海盗（`cursed_pirate`，素材目录 `cursed`）从本地素材接入到可验证的角色数据、资源链、规则文档、机制实现、审计 evidence 与真实入口 E2E。若遇到必须人工裁定的图面/规则不确定项，立即停止 goal 并汇报阻塞点。

## Constraints

- 不创建、切换、删除分支或 worktree。
- 不回滚或整理当前工作区其它未提交改动；本轮只定向修改 DiceThrone 新英雄、资源、文档、测试和 evidence。
- 图片优先于 Wiki；图面看不清或素材语义无法唯一裁定时停止，不猜。
- 战术家的锁定与守护复用既有 `STATUS_IDS.TARGETED` 和 `TOKEN_IDS.PROTECT`，不新增同义状态。
- 不覆盖 DiceThrone 既有共享头像、卡牌 atlas 或其它老英雄资源合同；新英雄素材不一致时按英雄分流。
- 新英雄未完整完成前保留 `implementation_in_progress` 徽标，不宣称全流程完成。

## Batch Matrix

| heroId | 中文名 | 素材目录 | 数据录入 | 资源链 | 机制实现 | 审计 | E2E | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zhanshujia` | 战术家 | `public/assets/i18n/zh-CN/dicethrone/images/zhanshujia` | `in_progress` | `in_progress` | `in_progress` | `pending` | `pending` | `in_progress` |
| `cursed_pirate` | 咒缚海盗 | `public/assets/i18n/zh-CN/dicethrone/images/cursed` | `in_progress` | `in_progress` | `in_progress` | `pending` | `pending` | `in_progress` |

## Phases

- [x] S0 锁定范围与计划：确认素材目录、代码 ID、共享 token 复用口径、旧任务不混写。
- [x] S1 建立规则文档：为两个英雄补真相源表、录入核对、卡牌录入核对、玩家板图面合同。
- [x] S2 资源链接入：生成正式英文运行时资源、状态图集、卡牌 atlas JSON，重建 manifest。
- [x] S3 静态英雄接入：新增英雄目录、骰面、Token、能力、卡牌、i18n、注册表、关键图片 resolver。
- [ ] S4 机制实现：逐子句实现战术优势/紧缚/诅咒金币/火药桶/凋零/休战及面板技能。当前战术优势、紧缚、制胜高地、战争贩子额外进攻投掷阶段、灵魂突刺三同值火药桶、深海潜行偷 CP、死亡印记 2CP 与弯刀不可防御伤害、亡灵之爪金币伤害、诅咒金币、凋零、休战已补 L2 机制；火药桶、防御精确 resolver、深海潜行弃牌交互、专属手牌仍未收口。
- [ ] S5 测试与审计：补静态注册、资源、机制行为测试，写 evidence，跑相关验证。当前已新增机制单测，审计 evidence / E2E 仍未完成。
- [ ] S6 端到端与上传：真实在线双玩家 E2E、截图核验、资源上传、代表 URL HEAD 回查。

## Current Notes

- 2026-05-30 16:48:43：已确认 active goal 为本批次；现有 `task_plan.md` 未记录本批次关键词，旧计划视为历史上下文。
- 2026-05-30 16:48:43：已确认素材目录存在；战术家状态图只有战术优势、紧缚；咒缚海盗状态图包含凋零、休战、炸药、诅咒金币。
- 2026-05-30 16:48:43：代码注册点包括 `domain/core-types.ts`、`domain/ids.ts`、`domain/characters.ts`、`domain/index.ts`、`heroes/index.ts`、`ui/cardAtlas.ts`、`criticalImageResolver.ts`、`public/locales/*/game-dicethrone.json`。
- 2026-05-30 17:20：已完成本地正式资源生成、状态图集生成、manifest 增量生成与 DiceThrone 范围 manifest 校验。
- 2026-05-30 17:20：已完成两个英雄 L1 静态接入与部分 L2 基础技能结算；复杂机制、英雄专属手牌逐卡录入、审计、E2E、上传仍未完成。
- 2026-05-30 17:48：已补战术优势 6 个主动动作、紧缚额外进攻投掷 CP 门禁与阶段清理、诅咒金币差异上限/不可移除/维持伤害、凋零攻击伤害减值、休战阻止攻击伤害与阶段清理，并新增机制测试。
- 2026-05-30 18:00：继续补制胜高地战术优势上限+补满、死亡印记先获得 2CP、亡灵之爪按诅咒金币层数造成直接伤害；火药桶仍因爆炸伤害数值与转交选择语义未有足够证据，未猜测实现。
- 2026-05-30 18:05：继续补灵魂突刺三同值施加火药桶、深海潜行偷取 1CP；火药桶重叠爆炸与深海潜行弃牌交互仍待后续机制。
- 2026-05-30 18:15：继续补死亡印记弯刀分支为独立不可防御伤害，补战争贩子攻击收口后触发额外进攻投掷阶段；深海潜行弃牌因缺少现成手牌选择交互仍未实现。

# Task Plan: TDD 行为 seam 与测试结构重构（2026-05-16）

> 当前正式计划入口。下方旧计划均为历史上下文，不作为本轮任务入口。

## Goal

把 SmashUp 遗留巨型派系测试逐步迁到按能力簇命名的聚焦文件，并把交互链测试从 `sys.interaction` / `prompt.data.options` / `SYS_INTERACTION_RESPOND` 这类内部结构耦合迁到稳定 prompt facade，降低实现重构时同步改测试的成本。

## Constraints

- 不创建、切换、删除分支或 worktree。
- 不清理工作区无关脏改；只处理测试规范、测试门禁、SmashUp 测试 facade 与本轮迁移文件。
- `src/games/**/__tests__` 是权威测试目录；`e2e/src` 只按 Junction 镜像债务处理，不作为新增测试入口。
- 新增/迁出的游戏行为测试不得使用 skip，不得裸读 `getInteractionsFromMS`、`prompt.data.options`、`SYS_INTERACTION_RESPOND`、`sys.interaction.current`。

## Acceptance Checklist

- [x] S0 吸收并安装 TDD / grill-with-docs 等必要 skill，补项目 TDD skill。
- [x] S1 写入测试分层、行为 seam、测试接口门禁与结构守卫。
- [x] S2 建立 SmashUp prompt facade，并修复 handler resolution 保留原 `sys` 的测试接口。
- [x] S3 迁出 Vampires / Frankenstein / Werewolves / Princesses / Mermaids / Fairies / Skeletons / Giant Ants / Samurai 到 `src/games/smashup/__tests__/abilities/`。
- [x] S4 验证迁出文件不含禁用内部耦合模式，并运行聚焦组合回归。
- [x] S5 迁出剩余 `Samurai abilities` 与 `巨蚁派系能力`，并让 `newFactionAbilities.test.ts` 退出新增入口。

## Current Status

- [x] `src/games/smashup/__tests__/expansionBaseAbilities.test.ts` 已拆出 `10th Anniversary bases` 到 [bases/anniversary-bases.test.ts](</D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/bases/anniversary-bases.test.ts:1>)。这一步不是机械搬运：`base_mermaid_pool` / `base_ossuary` / `base_arena` / `base_hall_of_fame` 不再和 Cthulhu / AL9000 / Pretty Pretty / stale 回归混在一个旧聚合入口里。验证：`anniversary-bases.test.ts` 5 passed，`expansionBaseAbilities.test.ts` 45 passed，eslint 0 errors，`npm run test:structure -- --all` OK。
- [x] `src/games/smashup/__tests__/scoreBases-auto-continue.test.ts` 已抽出一组独立 AI 枚举合同到 [ai-interaction-choice-enumeration.test.ts](</D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/ai-interaction-choice-enumeration.test.ts:1>)。这一步不是按文件名拆：迁出的 5 条都在锁 `optional multi / ordered multi / exact multi / emergency skip` 的 AI 候选枚举，不属于 `scoreBases` 自动推进本身。验证：`scoreBases-auto-continue.test.ts` 31 passed，`ai-interaction-choice-enumeration.test.ts` 5 passed，eslint 0 errors，`npm run test:structure -- --all` OK。
- [x] `src/games/smashup/__tests__/afterscoring-window-skip-base-clear.test.ts` 已收成 [scoreBases-deferred-finalization.test.ts](</D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/scoreBases-deferred-finalization.test.ts:1>)。这不是单纯改名：已经删掉 `base_greenhouse` / `base_tortuga` 的重复 happy-path 入口，保留的是延迟清场、替换后基地落点、`base_the_mothership` / `base_pirate_cove` 链式最终化、`base_temple_of_goju_tiebreak` 以及 `scoreBases` 收尾门禁的系统合同。验证：`scoreBases-deferred-finalization.test.ts` 11 passed，`scoreBases-flowHalted-recovery.test.ts` 2 passed，`scoreBases-auto-continue.test.ts` 36 passed，eslint 0 errors，`npm run test:structure -- --all` OK。
- [x] `src/games/smashup/__tests__/afterScoring-rescoring.test.ts` 里两条 `smashup_immediate_extra_minion` 测试已并回 [abilities/immediate-extra-action.test.ts](</D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/abilities/immediate-extra-action.test.ts:1>)。它们本质上是“立即额外打出”系统合同，不属于 afterScoring 统一反应入口；现在 `afterScoring-rescoring.test.ts` 只保留统一反应入口与 afterScoring 响应窗口语义。验证：`afterScoring-rescoring.test.ts + abilities/immediate-extra-action.test.ts` 为 `12 passed`，eslint 0 errors，`npm run test:structure -- --all` OK。
- [x] `src/games/smashup/__tests__/turnTransitionInteractionBug.test.ts` 已拆成两个正式系统入口：[startTurn-base-rlyeh-recovery.test.ts](</D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/startTurn-base-rlyeh-recovery.test.ts:1>) 与 [scoreBases-base-tortuga-recovery.test.ts](</D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/scoreBases-base-tortuga-recovery.test.ts:1>)。这不是改表象：前者只锁 `startTurn -> base_rlyeh prompt -> playCards` 的回合切换恢复，后者只锁 `scoreBases -> base_tortuga afterScoring prompt -> playCards` 的计分恢复。验证：这 2 个新文件共 `2 passed`，与 `architecture-duplicate-processing.test.ts` / 相关系统入口一起 `9 passed`，eslint 0 errors，旧路径 `False` / 新路径 `True`，`npm run test:structure -- --all` OK。
- [x] `src/games/smashup/__tests__/multi-base-afterscoring-bug.test.ts` 已确认为真实系统合同并改名为 [scoreBases-multi-base-chain-recovery.test.ts](</D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/scoreBases-multi-base-chain-recovery.test.ts:1>)。这一步不是表面换标签：文件锁的是 `scoreBases` 在多基地同时达到 breakpoint 时，遇到 `afterScoring / Me First!` 链式交互后如何恢复后续基地计分、避免重复计分与提前清场。验证：`scoreBases-multi-base-chain-recovery.test.ts + scoreBases-auto-continue.test.ts` 为 `44 passed`，eslint 0 errors，旧路径 `False` / 新路径 `True`，`npm run test:structure -- --all` OK。
- [x] `src/games/smashup/__tests__/igor-rlyeh-double-trigger.test.ts` 已确认为真实系统合同并改名为 [base-rlyeh-destroy-trigger-idempotency.test.ts](</D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/base-rlyeh-destroy-trigger-idempotency.test.ts:1>)。它和 `destroy-trigger-prompt-coexistence.test.ts` 不是一回事：这里锁的是 `base_rlyeh onTurnStart -> destroy -> frankenstein_igor onDestroy` 这条真实链的幂等性，而不是基地 prompt 与 Igor prompt 并存。验证：`base-rlyeh-destroy-trigger-idempotency.test.ts + destroy-trigger-prompt-coexistence.test.ts + architecture-duplicate-processing.test.ts` 为 `9 passed`，eslint 0 errors，旧路径 `False` / 新路径 `True`，`npm run test:structure -- --all` OK。
- [x] `src/games/smashup/__tests__/baseFactionOngoing.test.ts` 中的 `机器人 ongoing 回归 / 机器人 ongoing 能力` 已并回 [robots.test.ts](</D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/abilities/robots.test.ts:1>)，大文件里的机器人段已删除。迁移过程中已把旧大文件隐藏的关键前提显式化：`Archive` 测试现在不再依赖本地默认夹具，而是显式提供机器人派系与非空牌库。验证：`robots.test.ts + baseFactionOngoing.test.ts` 为 `95 passed`，eslint 0 errors，`test:structure -- --all` OK。
- [x] `src/games/smashup/__tests__/baseFactionOngoing.test.ts` 中的 `wizard_archmage` ongoing 时机段已并回 [wizards.test.ts](</D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/abilities/wizards.test.ts:1>)，大文件里的巫师段已删除。验证：`wizards.test.ts + baseFactionOngoing.test.ts` 为 `83 passed`，eslint 0 errors，`test:structure -- --all` OK。
- [x] `src/games/smashup/__tests__/onDestroyAbilities.test.ts` 已退场。共享 `onDestroy` 基础设施已拆到 [on-destroy-mechanics.test.ts](</D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/abilities/on-destroy-mechanics.test.ts:1>)，`robot_nukebot` 已并回 [robots.test.ts](</D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/abilities/robots.test.ts:1>)，`trickster_gremlin` / `trickster_gremlin_pod` 已并回 [tricksters.test.ts](</D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/abilities/tricksters.test.ts:1>)。`bear_cavalry_general_ivan destroy 保护` 两条弱测试未机械迁移，因为它们不是稳定行为合同。验证：3 files / 40 tests passed，eslint 0 errors，`Test-Path src\games\smashup\__tests__\onDestroyAbilities.test.ts` -> `False`，`npm run test:structure -- --all` OK。
- [x] `src/games/smashup/__tests__/abilities/elder-things.test.ts` 已收成远古之物单一行为入口；`elder-things-ongoing.test.ts` 已删除。关键不是“ongoing 改名”，而是把 Dunwich Horror 附着、Price of Power special、Elder Thing 保护/onPlay、Shoggoth 打出限制这些本来就属于同一派系合同的测试并回单入口，避免远古之物后续继续在两个文件里分裂维护。验证：`elder-things.test.ts` 为 `41 passed`，eslint 0 errors，`Test-Path ...\\elder-things-ongoing.test.ts` -> `False`，`npm run test:structure -- --all` OK。
- [x] `src/games/smashup/__tests__/expansionOngoing.test.ts` 已彻底退场，不再作为扩展派系 ongoing 聚合入口。先把 `Steampunks` 并回现有 [steampunks.test.ts](</D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/abilities/steampunks.test.ts:1>)，再把剩余 `Innsmouth` / `Miskatonic` 拆成新增专项文件 [innsmouth.test.ts](</D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/abilities/innsmouth.test.ts:1>) 与 [miskatonic.test.ts](</D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/abilities/miskatonic.test.ts:1>)，最后删除旧文件。聚焦验证 `steampunks.test.ts + innsmouth.test.ts + miskatonic.test.ts` 为 `40 passed`，eslint 0 errors，`Test-Path src\games\smashup\__tests__\expansionOngoing.test.ts` -> `False`，`npm run test:structure -- --all` OK。
- [x] `src/games/smashup/__tests__/abilities/madness-mechanics.test.ts` 已退场，而且不是表面改名。这个旧壳同时混放了跨派系 `extra play timing` 合同、`Cthulhu / Miskatonic / Innsmouth` 业务行为，以及一部分旧 helper/seam。现已按真实边界拆成：共享时序合同落到 [extra-play-timing-mechanics.test.ts](</D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/abilities/extra-play-timing-mechanics.test.ts:1>)，派系行为分别并回 [cthulhu.test.ts](</D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/abilities/cthulhu.test.ts:1>)、[miskatonic.test.ts](</D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/abilities/miskatonic.test.ts:1>)、[innsmouth.test.ts](</D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/abilities/innsmouth.test.ts:1>)。迁移后的行为测试继续走真实 `PLAY_ACTION -> prompt facade -> respondToPrompt(Option)` / `finalState`，不再保留 `postProcessSystemEvents(...)`、`lastMatchState`、手工后处理这类旧壳入口。最后一处红灯只是 `cthulhu.test.ts` 漏引 `getPromptOption`，补齐后 `4 files / 110 tests passed`，eslint 0 errors，`Test-Path src\games\smashup\__tests__\abilities\madness-mechanics.test.ts` -> `False`，`npm run test:structure -- --all` OK。
- [x] `expansionOngoing.test.ts` 中已迁出的 `Killer Plants` 段完成实质收口：`killer_plant_water_lily` 的 3 条红灯并非实现回归，而是迁移到共享 `helpers.makeState` 后默认牌库变空，导致“抽牌”前提被隐式拿掉。现已在 `src/games/smashup/__tests__/abilities/killer-plants.test.ts` 为 `water_lily` 用例补上显式牌库夹具 `makeWaterLilyState(...)`，让测试锁定公开行为前提而不是依赖旧本地 helper 的隐藏默认值；组合验证 `abilities/killer-plants.test.ts + expansionOngoing.test.ts` 为 `73 passed`，eslint 0 errors，`npm run test:structure -- --all` OK。
- [x] `scripts/infra/testing-structure-guard.mjs` 已补强为“测试接口门禁”而不只是 prompt field 门禁：新增阻止游戏行为测试继续引入 `console.log/warn/error/debug` 调试壳层，并阻止新增测试直接导入/调用 `resolveAbility`、`getInteractionHandler`、`getAbilityRuntimePromptHandler` 这类原始 registry/handler 入口。中途验证发现“禁止任何 `abilityRegistry` 导入”会误伤 `clearRegistry` 等合法用法，已收窄为只拦真正的问题入口；`npm run test:structure -- --all` 再次通过。文档也已同步到 `docs/testing-best-practices.md` 与 `docs/automated-testing.md`，把“禁止调试日志、禁止业务测试直摸 registry/handler”的规则写成公开规范。
- [x] `src/games/smashup/__tests__/interactionDisplayModeAudit.test.ts` 已从“只看字面量 object”提升为“按真实 TypeScript value shape 审计”：现在会识别 `satisfies/as`、`value: card/choice/action` 这类已带类型信息的选项，避免为了让 audit 绿而扭曲业务代码。与此同时收掉 4 个真实缺口：`alien_scout_return` 的 yes 分支改回 `displayMode: 'button'`；`bear_cavalry_bear_necessities` 显式补 `displayMode: 'card'`；`bear_cavalry_commission_move_minion` 的 skip 选项改成纯 button payload，不再伪装成随从目标；`tornados_ripped_off` 为挂在随从上的持续行动补齐 `minionDefId`；`shayu_common.ts` 的 `asCardOptions` 补上可渲染卡面 value 合同。验证：`interactionDisplayModeAudit.test.ts` 5 passed；`bear-cavalry.test.ts -t "bear_necessities|Commission|委任|Bear Necessities"` 3 passed；`interactionChainE2E.test.ts -t "commission|委任"` 3 passed；`alien-scout-pod-afterscore.test.ts` 4 passed；`promptResponseChain.test.ts -t "alien_scout_return|侦察兵回手"` 1 passed。
- [x] 继续把“业务回归里的调试壳层”改成真实合同，而不是只删日志：`wizard-neophyte-actionlog.test.ts` 现已精确断言 ActionLog 序列 + 最终手牌/牌库；`turnTransitionInteractionBug.test.ts` 已把托尔图加场景改成有合法目标的真实 afterScoring 暂停/响应/恢复链；`multi-base-afterscoring-bug.test.ts` 已把 handler 打印改成事件序列 + 后续多基地候选断言；`sleep-spores-e2e.test.ts` 已去掉力量分析打印。验证：4 个文件定点 `vitest` 通过，`eslint` 0 errors / 0 warnings，`npm run test:structure` OK。全仓 `console.*` 命中已从 `52` 进一步降到 `22`。
- [x] `src/games/smashup/__tests__/baseFactionOngoing.test.ts` 的 `ninja_hidden_ninja consumesNormalLimit` 红灯已收口：不再手工拼 fake prompt current，而是复用真实 `resolveAbility('ninja_hidden_ninja', 'special')` 产出的 prompt，再走 `respondToPrompt(...)`。同时补齐本地 `triggerBrownieFromEvent(...)` helper，对齐 reducer 的 `affectEvent + affectBatchTargets` 传递方式；`trickster_brownie` 针对 `control_change` 改为按 `MINION_CONTROL_CHANGED.payload.fromControllerId` 判断“被对手影响”的受害方。验证：`baseFactionOngoing.test.ts -t "consumesNormalLimit"` 5 passed，整文件 81 passed，`npm run test:structure` OK。
- [x] `src/games/smashup/__tests__/abilities/bear-cavalry.test.ts` 已把 `bear_cavalry_bear_rides_you_pod_choose_base` 从直调 handler 迁成真实命令链：`PLAY_ACTION` -> 选己方随从 -> 选目标基地 -> 断言 `choose_suppress` prompt 候选。`bear_cavalry_superiority_pod_talent` 两处保留为显式低层合同。验证：整文件 21 passed，eslint 0 errors。
- [x] 全仓 `getInteractionHandler` / `getAbilityRuntimePromptHandler` 命中已从 `44` 降到 `43`；当前剩余高优先级候选主要是 `baseFactionOngoing.test.ts` 的 `trickster_flame_trap_pod_bp`、`abilities/bear-cavalry.test.ts` 的 2 条 `superiority_pod_talent` 低层合同，以及 `temple-firstmate-afterscore.test.ts` 的 2 条 `pirate_first_mate_choose_base` stale/baseDefId 合同。
- [x] `src/games/smashup/__tests__/smashup.smoke.test.ts` 的 Hill give-minion -> counter 红灯已收口：测试不再手工 `resolveAffectedMinions(...)` 重放触发链，而是直接消费 `respondToPromptOption(...)` 的真实 `finalState`；同时修复 `src/games/smashup/domain/affect.ts` 对 `MINION_CONTROL_CHANGED` 的 affect 快照，`onMinionAffected(control_change)` 现在会看到变更后的控制者。验证：单测定点 1 passed，整文件 133 passed，`eslint` 0 errors，`npm run test:structure` OK。
- [x] `src/games/smashup/__tests__/smashup.smoke.test.ts` 的 `major_ursa` 三段链已迁成真实命令链：`USE_TALENT` -> `choose_destination` -> `smashup_reaction_choose` -> `choose_minion` -> `choose_base`，不再手工喂 continuation 或直调 3 个 handler。验证：定点 1 passed，整文件 133 passed，`eslint` 0 errors，`npm run test:structure` OK。当前 `smoke` 剩余 direct handler 只剩 `titan_penguins_emperor_penguin_play` 低层合同 + `big_funny_giant` 注册表断言。
- [x] `src/games/smashup/__tests__/abilities/pirates-ongoing.test.ts` 已收掉 `smashup_reaction_choose` + `pirate_first_mate_choose_base` 直调：afterScoring 链改为 `resolveSmashUpReactionChoice(...)` 驱动 reaction session，再用 `respondToPromptOption(...)` 响应业务 prompt。验证：整文件 19 passed，`eslint` 0 errors。
- [x] `src/games/smashup/__tests__/igor-ondestroy-idempotency.test.ts` 的九命之屋 skipped 块已恢复；单文件 4 tests passed，目标模式 0 命中，eslint 0 errors，`npm run test:structure` OK。
- [x] `src/games/smashup/__tests__/interactionChainE2E.test.ts` 最后一个 `it.skip` 已按当前 Alien Probe 规则恢复；整文件 55 tests passed，eslint 0 errors，`npm run test:structure` OK。
- [x] `src/games/smashup/__tests__/wizard-archmage-debug.test.ts` 与 `src/games/smashup/__tests__/steampunk-aggromotive-bug.test.ts` 已作为已覆盖的调试/旧 bug skip 文件删除；对应现行测试 3 passed + 8 passed，`npm run test:structure` OK。
- [x] `src/games/smashup/__tests__/vampireBuffetE2E.test.ts` 已作为过期整文件 skip 删除；当前有效覆盖由 `newOngoingAbilities.test.ts`（126 passed）与 `abilities/giant-ants.test.ts`（22 passed）证明，`npm run test:structure` OK。
- [x] `src/games/smashup/__tests__/wizard-archmage-zombie-interaction.test.ts` 已从历史 `it.skip` 恢复为可运行行为回归；验证 `zombie_they_keep_coming` 从弃牌堆打出大法师后触发额外行动，单文件 1 test passed，eslint 0 errors，`npm run test:structure` OK。
- [x] `src/games/smashup/__tests__/ninja-hidden-ninja-interaction-bug.test.ts` 已从历史 `it.skip` 恢复为可运行行为回归；验证 Me First! 窗口中打出便衣忍者后创建手牌随从选择 prompt，单文件 1 test passed，eslint 0 errors，`npm run test:structure` OK。
- [x] `src/games/smashup/__tests__/abilities/skeletons.test.ts` 已迁出，19 tests passed。
- [x] `src/games/smashup/__tests__/abilities/giant-ants.test.ts` 已迁出，22 tests passed。
- [x] `src/games/smashup/__tests__/abilities/samurai.test.ts` 已迁出，28 tests passed。
- [x] `src/games/smashup/__tests__/newFactionAbilities.test.ts` 已从实际文件树删除，旧泛名入口不再承载新增派系测试。
- [x] 迁移相关组合回归：9 files passed / 118 tests passed。
- [x] `npm run test:structure` 通过；仅保留 Junction 和删除 diff 中旧大文件债务 warning。
- [x] `src/games/smashup/__tests__/archmageE2E.test.ts` 已把“无 prompt”断言从 `sys.interaction.current` 改为 `expectNoPrompt`，单文件 9 tests passed。
- [x] `src/games/smashup/__tests__/turnCycle.test.ts` 已把“无 prompt”断言从 `sys.interaction.current` 改为 `expectNoPrompt`，单文件 22 tests passed。
- [x] `src/games/smashup/__tests__/specialInteractionChain.test.ts` 已把 SimpleChoice 读取从 `asSimpleChoice(sys.interaction.current)` 改为 `getSimpleChoicePrompt` / `getFirstPrompt`，单文件 24 tests passed。
- [x] `src/games/smashup/__tests__/killer-plant-pod-verification.test.ts` 已把 Sprout prompt 与响应链改为 `getSimpleChoicePrompt` / `getPromptOption` / `respondToPrompt`，单文件 11 tests passed。
- [x] `src/games/smashup/__tests__/shayuEntryConsumption.test.ts` 已把第一入口专项 prompt 断言改为 `getSimpleChoicePrompt` / `getPromptOptions` / `expectNoPrompt`，单文件 6 tests passed。
- [x] `src/games/smashup/__tests__/promptSystem.test.ts` 与 `promptResponseChain.test.ts` 已把底层 prompt 系统无交互断言改为 `expectNoPrompt`，组合 22 tests passed。
- [x] `src/games/smashup/__tests__/reactionQueueBaseReplaceLki.test.ts` 与 `reactionQueueOrdering.test.ts` 已把 reaction queue 的 prompt/source/options 读取改为 `getSimpleChoicePrompt` / `getPromptOptions` / `getPromptOption`，并新增 `withoutCurrentPrompt` helper 收起底层清 prompt 细节；组合 27 tests passed。
- [x] `src/games/smashup/__tests__/afterscoring-response-window-execution.test.ts`、`mulligan.test.ts`、`baseAbilityIntegration.test.ts` 已继续迁移 prompt source/options 读取；`getSimpleChoicePrompt(state, sourceId)` 已增强为可在 current + queue 中按 sourceId 查找，组合验证通过。
- [x] `src/games/smashup/__tests__/ninja-hidden-ninja-no-minions.test.ts`、`temple-firstmate-afterscore.test.ts`、`wizard-neophyte-actionlog.test.ts` 已继续迁移 prompt source/响应读取；组合 11 tests passed。
- [x] `src/games/smashup/__tests__/pirate-broadside-d1-audit.test.ts` 与 `scoringEligibleLock.test.ts` 已继续迁移 prompt source/options 读取；audit 文件用 `vitest.config.audit.ts` 验证，scoring 文件单测验证通过。
- [x] `src/games/smashup/__tests__/wizard-neophyte-ongoing.test.ts` 与 `ninja-hidden-ninja-interaction-bug-repro.test.ts` 已继续迁移 prompt source/options/响应读取；组合 3 tests passed。
- [x] `src/games/smashup/__tests__/reactionQueueOnBaseRevealed.test.ts`、`reactionQueueOnMinionDiscardedFromBase.test.ts`、`reactionQueueOnMinionPlayed.test.ts` 已把统一反应 prompt 读取改为 `getReactionPrompt`；组合 4 tests passed。
- [x] `src/games/smashup/__tests__/pirate-cove-chain-fix.test.ts` 与 `turnTransitionInteractionBug.test.ts` 已继续收敛 prompt source 与响应命令 seam；组合 5 tests passed。
- [x] `src/games/smashup/__tests__/duplicateInteractionRespond.test.ts`、`elder-thing-multi-select.test.ts`、`turnCycle.test.ts` 已继续收敛无 prompt 断言、prompt options/source/target 与 handler source 读取；组合 27 tests passed。
- [x] `npm run test:structure` 已通过；旧泛名 `pirate-cove-chain-fix.test.ts` 本轮保持净删减，未继续给旧泛名文件加体量。
- [x] `src/games/smashup/__tests__/igor-big-gulp-double-trigger.test.ts`、`igor-rlyeh-double-trigger.test.ts`、`shoggoth-destroy-choice.test.ts` 已继续收敛 prompt source/handler data/队列查询 seam；组合 8 tests passed。
- [x] `src/games/smashup/__tests__/ancientEgyptiansMummyStrength.feedback-regression.test.ts`、`madMonsterPartyPreventedDestroy.test.ts`、`audit-d1-d8-d33-dino-survival-of-the-fittest.test.ts`、`choice-audit-fixes.test.ts` 已继续收敛 prompt source/options/no-prompt/handler data seam；普通组合 2 tests passed，audit 组合 18 tests passed。
- [x] `src/games/smashup/__tests__/ui-interaction-manual.test.ts` 已把 UI 手动验证中的 `asSimpleChoice(sys.interaction.current)` 收敛为 `getSimpleChoicePrompt`；单文件 14 tests passed，目标模式 0 命中。
- [x] `src/games/smashup/__tests__/igor-big-gulp-two-igors.test.ts`、`igor-double-trigger-bug.test.ts`、`igor-two-igors-one-destroyed.test.ts` 已继续收敛 Big Gulp / Crypt / Igor onDestroy prompt source、options、player 与响应命令 seam；组合 3 files / 4 tests passed，目标模式 0 命中。
- [x] `src/games/smashup/__tests__/response-window-skip.test.ts` 已把响应窗口跳过测试的 current 读取、cancel 命令与 Hidden Ninja 子交互 options 读取改为 prompt facade；单文件 5 tests passed，目标模式 0 命中。
- [x] `src/games/smashup/__tests__/reactionQueueOnTurnStart.test.ts` 已把 onTurnStart/onTurnEnd 统一反应 prompt 断言改为 `getReactionPrompt`；单文件 2 tests passed，目标模式 0 命中。
- [x] `src/games/smashup/__tests__/robot-hoverbot-chain.test.ts` 已把 Hoverbot 链式响应命令和刷新后 live prompt options 读取收进 facade；单文件 3 tests passed，目标模式 0 命中。
- [x] `src/games/smashup/__tests__/robotAbilities.test.ts` 已把 Microbot Reclaimer 的 prompt source、multi 最小值、动态 options、handler data 与 optionIds 响应收进 facade；单文件 11 tests passed，目标模式 0 命中。
- [x] `src/games/smashup/__tests__/trickster-mark-of-sleep-self-target.test.ts` 已把 Mark of Sleep / POD 的 prompt title、options、source 与三处响应命令改为 prompt facade；单文件 9 tests passed，目标模式 0 命中。
- [x] `src/games/smashup/__tests__/afterscoring-window-skip-base-clear.test.ts` 已把可迁移的 reaction prompt、immediate extra minion prompt 与无 prompt 断言改为 facade；单文件 15 tests passed，剩余命中属于系统状态构造暂不硬藏。
- [x] `src/games/smashup/__tests__/alien-scout-pod-afterscore.test.ts` 已把 Scout afterScoring 的 current/queue/source/options/handler data 改为 prompt facade；单文件 4 tests passed，目标模式 0 命中。
- [x] `src/games/smashup/__tests__/expansionAbilities.test.ts` 已把 Bear Hug、Ghost、Commission、Scrap Diving 的 prompt source/options、current+queue 查询与响应命令改为 prompt facade；单文件 32 tests passed，目标模式 0 命中。
- [x] `src/games/smashup/__tests__/reactionQueueBaseAbilities.test.ts` 已把 unified reaction prompt、options、handler data、无 prompt 与真实基地 prompt 断言改为 prompt facade；单文件 6 tests passed，目标模式 0 命中。
- [x] `src/games/smashup/__tests__/frankensteinFaq.test.ts` 已把 Blitzed / It’s Alive! 的 prompt source/options 与响应命令改为 prompt facade；单文件 3 tests passed，目标模式 0 命中。
- [x] `src/games/smashup/__tests__/reactionQueueBaseOptionalClockwise.test.ts` 已把 optional reaction prompt 的 player/options/handler data 与清 current 过渡改为 prompt facade；单文件 2 tests passed，目标模式 0 命中。
- [x] `src/games/smashup/__tests__/pirate-broadside-self-target.test.ts` 已把 Broadside / Saucy Wench 的 prompt source/title/options 与响应命令改为 prompt facade；单文件 6 tests passed，目标模式 0 命中。
- [x] `src/games/smashup/__tests__/wildlifePreserveProtection.test.ts` 已把 Seeing Stars / Unfathomable Goals 的 prompt 出现、候选过滤、响应命令、无 prompt 与错误来源读取改为 prompt facade；单文件 15 tests passed，目标模式 0 命中。
- [x] `src/games/smashup/__tests__/buryEngine.test.ts` 已把埋葬翻开 prompt 的 source、cardUid 候选查询与响应命令改为 prompt facade；单文件 9 tests passed，目标模式 0 命中。
- [x] `src/games/smashup/__tests__/pirate-cove-repeat-trigger-bug.test.ts` 已把海盗湾 afterScoring prompt 统计与无 prompt 断言改为 `getPromptsBySourceId` / `expectNoPrompt`；单文件 3 tests passed，扩展目标模式 0 命中。
- [x] `src/games/smashup/__tests__/pirate-king-afterscoring-window.test.ts` 已把海盗王 afterScoring prompt 与响应命令改为 `getSimpleChoicePrompt` / `getPromptOption` / `respondCommand`；单文件 1 test passed，扩展目标模式 0 命中。
- [x] `src/games/smashup/__tests__/promptE2E.test.ts` 已把 Cannon / Powderkeg / Grave Digger / Crop Circles 的 prompt source 与无 prompt 断言改为 prompt facade；单文件 12 tests passed，目标模式 0 命中。
- [x] `src/games/smashup/__tests__/afterScoring-rescoring.test.ts` 已把当前 simple-choice 读取与测试 setup 中的 current prompt 构造收进 `getOptionalSimpleChoicePrompt` / `withCurrentPrompt`；单文件 8 tests passed，目标模式 0 命中。
- [x] `src/games/smashup/__tests__/baseAbilities.test.ts` 已把 ability runtime prompt 断言从 `asSimpleChoice(sys.interaction.current)` 改为 `getFirstPrompt` / `getPromptSourceId` / `getPromptHandlerData`；单文件 11 tests passed，扩展目标模式 0 命中。
- [x] `src/games/smashup/__tests__/bigGulpDroneIntercept.test.ts` 已把 Big Gulp / Drone prompt 的 player/source/options、响应命令和无 prompt 断言改为 prompt facade；单文件 2 tests passed，扩展目标模式 0 命中。
- [x] `src/games/smashup/__tests__/robot-hoverbot-stable.test.ts` 已把 Hoverbot prompt options、响应命令、无 prompt 与基地选择 prompt 读取改为 prompt facade；单文件 3 tests passed，扩展目标模式 0 命中。
- [x] `src/games/smashup/__tests__/cthulhu-chosen-display-mode.test.ts` 已把神选者确认 prompt 的 target/source/options、queued prompt player/options 读取改为 prompt facade；单文件 4 tests passed，扩展目标模式 0 命中。
- [x] `src/games/smashup/__tests__/robot-hoverbot-button-disabled.test.ts` 已把 Hoverbot 按钮交互的 title/source/options/optionsGenerator 与无 prompt 断言改为 prompt facade；单文件 3 tests passed，扩展目标模式 0 命中。
- [x] `src/games/smashup/__tests__/duplicateInteractionRespond.test.ts` 已把重复 respond 回归的系统响应命令形状改为 `respondCommand`；单文件 2 tests passed，扩展目标模式 0 命中。
- [x] `src/games/smashup/__tests__/specialInteractionChain.test.ts` 已把本地 `respond()` helper 的系统响应命令形状改为 `respondCommand`；单文件 24 tests passed，扩展目标模式 0 命中。
- [x] `src/games/smashup/__tests__/promptSystem.test.ts` 与 `promptResponseChain.test.ts` 已把“无 Prompt 时响应”的手写 `INTERACTION_COMMANDS.RESPOND` 命令改为 `respondCommand`；组合 22 tests passed，eslint 0 errors，目标扩展扫描仅保留 AI fallback / event 常量这类底层合同断言。
- [x] `src/games/smashup/__tests__/reactionQueueOrdering.test.ts`、`scoringEligibleLock.test.ts`、`tortuga-pirate-king-flowhalted-fix.test.ts` 已继续清理小尾巴：handler data 注入改为 `withPromptHandlerData`，无 prompt / 有 prompt 断言改为 facade，未使用 `INTERACTION_COMMANDS` import 删除；组合 40 tests passed，扩展目标扫描 0 命中。
- [x] `src/games/smashup/__tests__/ancientEgyptiansMummyStrength.feedback-regression.test.ts` 与 `pirate-broadside-d1-audit.test.ts` 已把手写 `INTERACTION_COMMANDS.RESPOND` 改为 `respondCommand`；普通单测 1 passed，audit 专用单测 3 passed，目标扩展扫描 0 命中。
- [x] `src/games/smashup/__tests__/elder-thing-multi-select.test.ts` 已把 `interaction.data.title/multi` 读取改为 `getPromptTitle` / `getPromptMulti`，并新增 `getPromptMulti` helper；单文件 3 tests passed，扩展目标扫描 0 命中。
- [x] `src/games/smashup/__tests__/alien-scout-no-duplicate-scoring.test.ts` 已把 afterScoring 触发与确认的手写 `INTERACTION_COMMANDS.RESPOND` 改为 `respondCommand`；单文件 2 tests passed，扩展目标扫描 0 命中。
- [x] `src/games/smashup/__tests__/audit-d11-d12-d14-dino-rampage.test.ts` 已把 prompt current/source/options 读取改为 `getFirstPrompt` / `getPromptSourceId` / `getPromptOption`，响应命令改为 `runner.resolveInteraction`；audit 专用 6 tests passed，目标扩展扫描 0 命中。
- [x] `src/games/smashup/__tests__/alienAuditFixes.test.ts` 已把 Aliens 审计回归中的 prompt source/options/no-prompt 与响应 helper 改为 facade；audit 专用 14 tests passed，目标扩展扫描 0 命中。
- [x] `src/games/smashup/__tests__/afterscoring-window-skip-base-clear.test.ts` 已把 current 清理/注入、continuationContext 注入、interactionData 读取与 immediate extra 响应命令改为 prompt facade；单文件 15 tests passed，目标扩展扫描 0 命中。
- [x] `src/games/smashup/__tests__/scoreBases-auto-continue.test.ts` 已把 multi-base scoring prompt 读取、AI respond 命令断言与 resolutionFrameId setup 改为 prompt/command facade；单文件 36 tests passed，目标扩展扫描 0 命中。
- [x] `src/games/smashup/__tests__/elderThingAbilities.test.ts` 已把 Elder Thing prompt source/target/handler data 与响应命令改为 prompt facade；单文件 25 tests passed，目标扩展扫描 0 命中。
- [x] `src/games/smashup/__tests__/ongoingE2E.test.ts` 已把 Shanghai prompt 链、Buccaneer/First Mate POD prompt source 与响应命令改为 prompt facade；单文件 14 tests passed，目标扩展扫描 0 命中。
- [x] `src/games/smashup/__tests__/runtimeEvidenceIssues.test.ts` 已把两个 runtime evidence 复现从裸 `getInteractionsFromMS` / `data.options` / `INTERACTION_COMMANDS.RESPOND` 改为 prompt facade；同时补强 Fledgling Vampire POD 链路，旧测试从“跑完但不证明 bury prompt”改为 Big Gulp 目标选择 -> Fledgling 反应选择 -> bury source prompt 出现，单文件 2 tests passed，目标扩展扫描 0 命中。
- [x] `src/games/smashup/__tests__/talentAbilities.test.ts` 已把 Cthulhu Star Spawn / Servitor 天赋 prompt 读取、候选读取与取消响应命令改为 `getSimpleChoicePrompt` / `getPromptOptions` / `respondCommand`；单文件 20 tests passed，目标扩展扫描 0 命中，eslint 0 errors。
- [x] `src/games/smashup/__tests__/baseAbilityIntegrationE2E.test.ts` 已把基地能力完整链路中的 prompt presence、reaction queue 响应、Shoggoth -> Asylum 二段 prompt 读取改为 prompt facade；单文件 23 tests passed，目标扩展扫描 0 命中，eslint 0 errors。
- [x] `src/games/smashup/__tests__/meFirst.test.ts` 已把 Me First! 响应窗口的 pass/play/选随从/选抽牌数链路改为 `respondCommand` / `getSimpleChoicePrompt` / `getPromptOption` / `expectNoPrompt`；单文件 13 tests passed，目标扩展扫描 0 命中，eslint 0 errors。
- [x] `src/games/smashup/__tests__/madnessPromptAbilities.test.ts` 已把 Madness prompt / Book of Iter / Thing on the Doorstep 链路的 source/options/multi/handler data/响应命令改为 prompt facade；单文件 26 tests passed，目标扩展扫描 0 命中，eslint 0 errors。
- [x] `src/games/smashup/__tests__/madnessAbilities.test.ts` 已把 Madness 能力、Librarian POD、Corruption、Mandatory Reading 与 Innsmouth Recruitment 的 prompt/handler data/响应读取改为 prompt facade；单文件 32 tests passed，目标扩展扫描 0 命中，eslint 0 errors。
- [x] `src/games/smashup/__tests__/architecture-duplicate-processing.test.ts` 已把 Big Gulp / Igor 重复触发链中的 current prompt 读取、目标 option 查找、响应命令和 current+queue 统计改为 prompt facade；单文件 7 tests passed，目标扩展扫描 0 命中，eslint 0 errors。
- [x] `src/games/smashup/__tests__/baseFactionOngoing.test.ts` 已把 Infiltrate / Hidden Ninja / Acolyte -> Gunfighter / Flame Trap POD / Mark of Sleep 的 prompt source、target、options、响应命令与同 source prompt 查询改为 prompt facade；单文件 81 tests passed，目标扩展扫描 0 命中，eslint 0 errors。
- [x] `src/games/smashup/__tests__/reactionQueueDestroyerId.test.ts` 已把 reaction prompt 选择、POD play prompt 查询与 displayCard 上下文断言改为 prompt facade；单文件 2 tests passed，目标扩展扫描 0 命中，eslint 0 errors。
- [x] `src/games/smashup/__tests__/zombieWizardAbilities.test.ts` 已把僵尸/巫师能力 prompt source、target、displayCard 与 handler data 传递改为 prompt facade；单文件 23 tests passed，目标扩展扫描 0 命中，eslint 0 errors。
- [x] `src/games/smashup/__tests__/cthulhuExpansionAbilities.test.ts` 已把 Miskatonic 多步选择、Recruit by Force 与 It Begins Again 的 prompt source/options/multi/no-prompt/handler data 改为 prompt facade；单文件 32 tests passed，目标扩展扫描 0 命中，eslint 0 errors。
- [x] `src/games/smashup/__tests__/giantAntsPod.test.ts` 已把巨蚁 POD 的防消灭、转移指示物、双随从加指示物、基地选择与检索链路改为 prompt facade；单文件 6 tests passed，目标扩展扫描 0 命中，eslint 0 errors。
- [x] `src/games/smashup/__tests__/zombieInteractionChain.test.ts` 已把僵尸 22 条交互链从 `asSimpleChoice(sys.interaction.current)`、手写 `INTERACTION_COMMANDS.RESPOND` 与裸 options 读取改为 prompt/command facade；单文件 22 tests passed，目标扩展扫描 0 命中，eslint 0 errors。
- [x] `src/games/smashup/__tests__/elderThingsPod.test.ts` 已把 Elder Things POD / Shoggoth / Price of Power / Spreading Horror / base Elder Thing prompt source、displayCard、options、响应命令与无 prompt 断言改为 prompt/command facade；单文件 13 tests passed，目标扩展扫描 0 命中，eslint 0 errors。
- [x] `src/games/smashup/__tests__/multi-base-afterscoring-bug.test.ts` 已把多基地计分、海盗王/托尔图加/大副/便衣忍者/四人压力 afterScoring 链路的 active prompt 获取、option 查询与响应命令改为 prompt/command facade；单文件 8 tests passed，目标扩展扫描 0 命中，eslint 0 errors。
- [x] `src/games/smashup/__tests__/query6Abilities.test.ts` 已把海盗/忍者/巫师/外星人第 6 批能力测试的 prompt source、options、multi、无 prompt 与 `wizard_scry` 响应命令改为 prompt/command facade；单文件 30 tests passed，目标扩展扫描 0 命中，eslint 0 errors。
- [x] `src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts` 已把基础基地 prompt 的 source/options/title/player 与旧 handler data 传递改为 prompt facade；单文件 33 tests passed，目标扩展扫描 0 命中，eslint 0 errors。
- [x] `src/games/smashup/__tests__/igor-ondestroy-idempotency.test.ts` 已把 3 个实际运行用例的 current+queue 手工拼接与 `data.sourceId` 过滤改为 `getPromptsBySourceId`；单文件 3 passed / 1 skipped，eslint 0 errors。跳过块按历史债务保留未硬改。
- [x] `src/games/smashup/__tests__/ongoingTalent.test.ts` 已把 Zeppelin 二段移动、Hideout POD 交换链、Pixie POD runtime prompt 链的 prompt 查询、options 与 handler data 传递改为 prompt facade；单文件 27 tests passed，目标扩展扫描 0 命中，eslint 0 errors。
- [x] `src/games/smashup/__tests__/newOngoingAbilities.test.ts` 已把 First Mate/Buccaneer/Elder Thing/Shoggoth/Killer Plant/Full Sail/Madness/基础基地/Igor/Bear Rides You POD 等剩余 prompt 读取、options 与 handler data 传递改为 prompt facade；单文件 126 tests passed，目标扩展扫描 0 命中，eslint 0 errors。
- [x] `src/games/smashup/__tests__/expansionOngoing.test.ts` 已把 Steampunk / Killer Plant / Innsmouth / Miskatonic ongoing prompt source/options/target、二段 prompt、handler data 与无 prompt 分支改为 prompt facade；单文件 67 tests passed，目标扩展扫描 0 命中，eslint 0 errors。
- [x] `src/games/smashup/__tests__/expansionBaseAbilities.test.ts` 已把扩展基地 prompt source/options/target/player、reaction 二段 prompt、stale handler data 与 scoring continuation data 改为 prompt facade；单文件 50 tests passed，目标扩展扫描 0 命中，eslint 0 errors。
- [x] `src/games/smashup/__tests__/factionAbilities.test.ts` 已把 Trickster / Pirates / Ninjas / Dinosaurs / Robots / Wizards / immediate extra action / Aliens 旧 prompt 读取、options/optionsGenerator、响应命令与无 prompt 断言改为 prompt facade；单文件 46 tests passed，目标扩展扫描 0 命中，eslint 0 errors。
- [x] `src/games/smashup/__tests__/PromptOverlay.interactions.test.tsx` 已把 UI 组件提交响应命令从直接 import `INTERACTION_COMMANDS` 改为复用 `respondCommand('discard')` 的稳定命令 facade；单文件 6 tests passed，eslint 0 errors，目标扫描 0 命中。
- [x] `src/games/smashup/__tests__/vampiresPod.test.ts` 已把 Big Gulp / WWTLF / Drone / Fledgling / Nine Lives / The Count / Dinner Date / Wolf Pact 的 prompt 获取、source/options、响应命令、无 prompt 断言改为 prompt facade；单文件 11 tests passed，eslint 0 errors，目标扫描 0 命中。
- [x] `src/games/smashup/__tests__/newBaseAbilities.test.ts` 已把基础/扩展基地旧大文件中的 Haunted House AL9000、Microbot Guard、Pyramids、Crypt、Castle Blood、Drakkar、Longhouse、Cowboys、Samurai、reaction choose 链路从内部 prompt/current/data/RESPOND 迁到 prompt/command facade；单文件 60 tests passed，eslint 0 errors，目标扫描 0 命中。
- [x] `src/games/smashup/__tests__/interactionChainE2E.test.ts` 已把多步交互链 E2E 从 `asSimpleChoice(sys.interaction.current)`、手写 `INTERACTION_COMMANDS.RESPOND`、无 prompt 裸断言和 prompt data 读取迁到 prompt/command facade；单文件 54 passed / 1 skipped，eslint 0 errors，目标扫描 0 命中。
- [x] `src/games/smashup/__tests__/smashup.smoke.test.ts` 已把泰坦、基地、AI、Pecos Bill、Kraken/First Mate 等 smoke 行为链中的 prompt source/options、reaction choose、handler data 与响应命令从内部 `current/data/RESPOND` 迁到 prompt/command facade；单文件 133 tests passed，eslint 0 errors，目标扫描 0 命中。
- [x] `src/games/smashup/__tests__/shayuFactionAbilities.test.ts` 已把真实入口 shayu 行为测试里的 prompt option 查找、source/target/player 断言与无 prompt 断言迁到 prompt facade；单文件 21 tests passed，eslint 0 errors，目标扫描 0 命中。
- [x] `src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` 已把 shayu L2 综合审计行为测试中的 prompt source/options/player、trigger option 查询、Hades prompt 读取和无 prompt 断言迁到 prompt facade；单文件 14 tests passed，eslint 0 errors，目标扫描 0 命中。
- [x] `src/games/smashup/__tests__/shayuFactionAbilities.test.ts` 已按派系边界退场：鲨鱼 / 龙卷风 / 神话希腊代表性玩法分别归入 `src/games/smashup/__tests__/abilities/sharks.test.ts`、`tornados.test.ts`、`mythic-greeks.test.ts`；聚焦验证 `21 passed`、eslint 0 errors、`npm run test:structure -- --all` OK，旧入口 `Test-Path ...\\shayuFactionAbilities.test.ts` -> `False`。
- [x] `src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` 已按真实归宿拆除，而不是继续保留 “shayu 综合行为” 混装入口：派系 L2 行为并入 `abilities/sharks.test.ts`、`abilities/tornados.test.ts`、`abilities/mythic-greeks.test.ts`，基地行为拆到 `bases/the-deep-base.test.ts`、`bases/trailer-park-base.test.ts`、`bases/tornado-alley-base.test.ts`；聚焦验证 `35 passed`、eslint 0 errors、`npm run test:structure -- --all` OK，旧入口 `Test-Path ...\\shayuComprehensiveBehavior.test.ts` -> `False`。
- [x] `src/games/smashup/__tests__/expansionAbilities.test.ts` 的幽灵段已退到单一派系入口：`ghost_ghost / ghost_seance / ghost_shady_deal / ghost_ghostly_arrival` 已并入 `src/games/smashup/__tests__/abilities/ghosts.test.ts`，`expansionAbilities.test.ts` 不再同时承担幽灵业务簇与其它扩展派系；聚焦验证 `abilities/ghosts.test.ts + expansionAbilities.test.ts` 为 `40 passed`、eslint 0 errors、`npm run test:structure -- --all` OK。
- [x] `src/games/smashup/__tests__/audit-d1-alien-crop-circles.test.ts` 已把 Crop Circles audit 的 prompt source/options/target/multi、响应命令与无 prompt 断言迁到 prompt/command facade，并把手写随从夹具改为 `makeMinion` 以补齐领域默认字段；audit 专用配置 3 tests passed，eslint 0 errors，目标扫描 0 命中。
- [x] 剩余目标命中已完成第一轮分类：`mothership-scout-afterscore-bug.test.ts`、`miskatonic-scout-afterscore.test.ts`、`wizard-academy-scout-afterscore.test.ts`、`elder-thing-multi-select-integration.test.ts`、`test-alien-scout-afterscore.test.ts`、`ninja-hidden-ninja-interaction-bug.test.ts`、`wizard-archmage-zombie-interaction.test.ts`、`vampireBuffetE2E.test.ts` 均为全文件或用例级 `.skip` 历史复现；`igor-ondestroy-idempotency.test.ts` 剩余命中也只在 `it.skip` 块；`promptSystem.test.ts` 剩余 `INTERACTION_COMMANDS` 是 AI fallback 的底层合同断言。
- [x] `docs/testing-best-practices.md` 的测试辅助函数/快速参考已同步 TDD seam 口径：业务交互测试默认使用 prompt facade，`getInteractionsFromMS` 仅作为系统契约/queue 存储测试的低层兼容工具。
- [x] `docs/testing-best-practices.md` / `docs/automated-testing.md` 已收紧 skip 口径：不再建议用 `it.skip` 优化慢速游戏行为测试；E2E 动态 `test.skip()` 仅限环境/房间初始化前置失败，不得隐藏业务断言失败。
- [x] `src/games/smashup/__tests__/helpers/auditUtils.ts` 已删除 `getInteractionsFromMS` 兼容重导出；全目录查询确认除核心 `helpers.ts` 本体外无外部引用，防止新 audit 测试继续绕过 prompt facade。
- [x] `src/games/smashup/__tests__/elder-thing-multi-select-integration.test.ts` 已从无效 `describe.skip` 死代码恢复为真实 `PLAY_MINION` 命令链集成测试：打出远古之物 -> 选择消灭 -> 两步选择己方随从 -> 验证只消灭所选目标；单文件 1 test passed，eslint 0 errors，结构门禁 OK。
- [x] `src/games/smashup/__tests__/test-alien-scout-afterscore.test.ts` 已从旧 Runner `describe.skip` 恢复为可运行 afterScoring trigger 回归：验证 `alien_scout_return` prompt 出现、选回手后侦察兵进入控制者手牌并离开基地；单文件 2 tests passed，eslint 0 errors，结构门禁 OK。
- [x] `src/games/smashup/__tests__/newOngoingAbilities.test.ts`、`newBaseAbilities.test.ts`、`bases/base-ability-contracts.test.ts`、`bases/samurai-bases.test.ts`、`bases/base-core-effects.test.ts`、`bases/first-minion-bases.test.ts`、`bases/base-scoring-effects.test.ts` 与 `bases/interaction-base-abilities.test.ts` 均已退出；基地能力测试已按业务对象/行为簇拆到 `bases/` 主题文件。
- [x] `first-minion-bases.test.ts` 未停留在“相似机制集合”层面，已继续拆为 `laboratorium-base.test.ts` 与 `moot-site-base.test.ts`；聚焦验证 2 files / 9 tests passed，`bases` 目录 22 files / 101 tests passed，结构门禁 OK，禁用 seam 扫描 0 命中。
- [x] `base-scoring-effects.test.ts` 已拆为 `haunted-house-scoring-base.test.ts`、`temple-of-goju-base.test.ts`、`great-library-base.test.ts`、`ritual-site-base.test.ts`；聚焦验证 4 files / 10 tests passed，结构门禁 OK。
- [x] `interaction-base-abilities.test.ts` 已拆除；鬼屋 AL9000 交互并入 `haunted-house-al9000-base.test.ts`，其余拆为 `rlyeh-base.test.ts`、`mountains-of-madness-base.test.ts`、`homeworld-base.test.ts`、`mothership-base.test.ts`、`ninja-dojo-base.test.ts`。聚焦验证 6 files / 15 tests passed，`bases` 目录 29 files / 100 tests passed，结构门禁 OK，禁用 seam 扫描 0 命中。
- [x] `samurai-sakura-garden-bases.test.ts` 已按普通 `base_sakura_garden` 与 POD 版 `base_sakura_garden_pod` 拆为 `sakura-garden-base.test.ts` / `sakura-garden-pod-base.test.ts`；聚焦验证 2 files / 6 tests passed，`bases` 目录 30 files / 100 tests passed，结构门禁 OK，禁用 seam 扫描 0 命中。
- [x] `laboratorium-base.test.ts` 已进一步按基础首随从合同与大法师/旧持久化队列恢复拆为 `laboratorium-base.test.ts` / `laboratorium-archmage-queue.test.ts`；聚焦验证 2 files / 6 tests passed，`bases/*.ts` 分批精确验证 26 files / 77 tests passed，结构门禁 OK，禁用 seam 扫描 0 命中。
- [x] `pod-base-reuse.test.ts` 已删除，Cowboys POD 复用合同并入 `cowboys-bases.test.ts`，Vikings POD 复用合同先并入后继续按 `drakkar-base.test.ts` / `longhouse-base.test.ts` 拆分；聚焦验证 2 files / 6 tests passed，`bases/*.ts` 分批精确验证 25 files / 77 tests passed，结构门禁 OK，禁用 seam 扫描 0 命中。
- [x] `src/games/smashup/__tests__/ninja-hidden-ninja-interaction-bug-repro.test.ts` 已删除。它不是新的行为入口，只是重复 `ninja-hidden-ninja-interaction-bug.test.ts` 已覆盖的不变量：Me First! 窗口打出 `ninja_hidden_ninja` 后必须创建手牌随从选择 prompt，并记录 `specialLimitUsed`。验证：删除前 `npx vitest run ninja-hidden-ninja-interaction-bug.test.ts ninja-hidden-ninja-interaction-bug-repro.test.ts` -> `2 files / 2 tests passed`；删除后 `ninja-hidden-ninja-interaction-bug.test.ts + baseAbilitiesPrompt.test.ts` 仍为 `2 files / 34 tests passed`，eslint 0 errors，`Test-Path ...\\ninja-hidden-ninja-interaction-bug-repro.test.ts` -> `False`，`npm run test:structure -- --all` OK。
- [x] `src/games/smashup/__tests__/pirate-cove-repeat-trigger-bug.test.ts` 已删除。它前两条合同已被 `baseAbilitiesPrompt.test.ts` 的 `base_pirate_cove` 专项承接：非冠军有随从时只生成 1 个 prompt，冠军不生成 prompt；第三条仍是空 `TODO`，不是有效测试资产。验证：删除前 `npx vitest run baseAbilitiesPrompt.test.ts pirate-cove-repeat-trigger-bug.test.ts` -> `2 files / 36 tests passed`；删除后 `baseAbilitiesPrompt.test.ts` 继续通过，eslint 0 errors，`Test-Path ...\\pirate-cove-repeat-trigger-bug.test.ts` -> `False`，`npm run test:structure -- --all` OK。
- [x] `src/games/smashup/__tests__/mothership-scout-afterscore-bug.test.ts` 未被机械删除，而是重命名为 `src/games/smashup/__tests__/afterScoring-chain-propagation.test.ts`。原因是它锁的不是“母舰又出 bug 了”这种一次性复现，而是 `基地 afterScoring -> 后续 scout/first mate prompt -> 延迟清场` 的系统顺序合同。验证：`npx vitest run src/games/smashup/__tests__/afterScoring-chain-propagation.test.ts` -> `1 file / 3 tests passed`，eslint 0 errors，`Test-Path ...\\mothership-scout-afterscore-bug.test.ts` -> `False`，`Test-Path ...\\afterScoring-chain-propagation.test.ts` -> `True`，`npm run test:structure -- --all` OK。
- [x] `src/games/smashup/__tests__/ninja-special-limit-fix.test.ts` 已并回 `src/games/smashup/__tests__/abilities/ninjas.test.ts` 并退场。它锁的是忍者卡牌自己的 `specialLimitGroup` 元数据合同，不是系统修复入口。验证：删除前 `npx vitest run abilities/ninjas.test.ts ninja-special-limit-fix.test.ts` -> `2 files / 39 tests passed`；删除后 `abilities/ninjas.test.ts` -> `1 file / 37 tests passed`，eslint 0 errors，`Test-Path ...\\ninja-special-limit-fix.test.ts` -> `False`，`npm run test:structure -- --all` OK。
- [x] `src/games/smashup/__tests__/alien-probe-bug.test.ts` 已并回 `src/games/smashup/__tests__/abilities/aliens.test.ts` 并退场。它锁的不是一个独立 bug 框架，而是 `alien_probe` 的完整公开行为矩阵：单/多对手选择、禁用非随从、无随从直接结束、选中后弃牌。验证：删除前 `npx vitest run abilities/aliens.test.ts alien-probe-bug.test.ts` -> `2 files / 16 tests passed`；删除后 `abilities/aliens.test.ts` -> `1 file / 16 tests passed`，eslint 0 errors，`Test-Path ...\\alien-probe-bug.test.ts` -> `False`，`npm run test:structure -- --all` OK。
- [x] `src/games/smashup/__tests__/afterscoring-timing-verification.test.ts` 已删除。它不是测试资产，只是一个 `expect(true).toBe(true)` 的占位壳；真正的 afterScoring 时序不变量已由 `afterScoring-rescoring.test.ts` 和 `afterscoring-window-skip-base-clear.test.ts` 这类真实链路文件承接。验证：对照跑 `3 files / 24 tests passed`，删除后结构门禁继续 OK。
- [x] `src/games/smashup/__tests__/pirate-cove-chain-fix.test.ts` 未被删除，而是重命名为 `src/games/smashup/__tests__/scoreBases-mefirst-window.test.ts`。原因是它锁的不是海盗湾业务细节，而是 `scoreBases / Me First! / afterScoring` 的窗口门禁链。验证：重命名前与 `scoreBases-auto-continue.test.ts` 组合为 `2 files / 39 tests passed`；重命名后同组合仍为 `2 files / 39 tests passed`，eslint 0 errors，`Test-Path` 证明旧文件已退场、新文件存在，`npm run test:structure -- --all` OK。

## Next

- 继续保持新增/迁出测试复用 prompt/command facade；不允许把旧内部访问原样搬进新文件。
- `shayuFactionAbilities.test.ts` 与 `shayuComprehensiveBehavior.test.ts` 都已退场；下一步优先看根目录剩余测试里是否还有“按历史来源/扩展批次/多派系混装”的旧入口，避免新增回归继续找不到自然归宿。
- `expansionAbilities.test.ts` 已先收掉 `Ghost` 双入口；下一步继续评估其中 `黑熊骑兵 / 蒸汽朋克 / 食人花` 是否已有稳定专项文件可继续迁出，优先消除“已有专项文件但仍保留扩展包双入口”的情况。
- `smashup.smoke.test.ts` 里普通业务 direct handler 已基本清空；下一步优先评估 `titan_penguins_emperor_penguin_play` 是否仍应保留为“resolve 时再次检查己方是否已有泰坦在场”的显式低层合同，若保留则转向其它大文件而不是继续硬清 `smoke`。
- 全仓 `getInteractionHandler` / `getAbilityRuntimePromptHandler` 命中已降到 `43`；`abilities/bear-cavalry.test.ts` 里普通业务链只剩 2 条 `superiority_pod_talent` 低层合同，`temple-firstmate-afterscore.test.ts` 的 `pirate_first_mate_choose_base` 仍应按 stale/baseDefId/index drift 合同审视，避免把系统合同误迁成 facade。
- 当前目标扫描（排除 `helpers.ts` / `helpers/**`）对旧 `new*` 入口、旧集合文件、裸 prompt seam 与 `.skip` 均为 0 命中；后续工作重点从“清旧入口”转为审查剩余较大文件是否仍有可拆的自然业务边界。
- 若继续深化，优先审计 `field-of-honor-base.test.ts` 与 `laboratorium-archmage-queue.test.ts`：只有确认一个文件混有多个独立业务对象或行为簇时才拆；不要为了压行数牺牲可读性。
- 下一步优先审查其余仍带 `bug/fix/repro` 语义的根目录文件，继续按三类分流：重复壳直接删、真实业务回专项、系统顺序合同改成明确的系统入口。
- 下一步优先继续复核剩余根目录里的系统合同候选，如 `tortuga-pirate-king-flowhalted-fix.test.ts`、`multi-base-afterscoring-bug.test.ts`、`igor-double-trigger-bug.test.ts`。它们更可能走“保留/改名为系统入口”而不是并回派系。

## Errors Encountered

| 时间 | 错误 | 处置 |
| --- | --- | --- |
| 2026-05-16 | 清理 `expansionAbilities.test.ts` 未使用 `events` warning 时，模糊替换误删了仍被后续断言使用的 `events` 赋值，导致单文件测试短暂失败。 | 改为按具体用例上下文定点恢复需要的 `const events = ...`，只清理 Ghost/Scrap Diving prompt 存在性用例的未使用赋值；复跑后 32 tests passed，eslint 0 warnings。 |
| 2026-05-16 | 迁移 `robot-hoverbot-stable.test.ts` 时误用 `getPromptOptionById`，该 helper 只覆盖 `prompt.options`，未覆盖历史 `data.options`，导致首个用例找不到 `play` option。 | 改用已兼容两种形状的 `getPromptOption`，保持行为断言不变；复跑后 3 tests passed，eslint 0 errors。 |
| 2026-05-16 | 补强 `runtimeEvidenceIssues.test.ts` 的 Fledgling Vampire POD bury prompt 断言时，第一次直接断言 bury source prompt 失败，实际当前 prompt 仍是 `smashup_reaction_choose`；第二次用固定玩家 `0` 响应 reaction prompt 又失败为“不是你的选择回合”。 | 改为显式先选择 `vampire_fledgling_vampire_pod` 的 reaction option，并让 `respondToPrompt` 使用 prompt 自身 playerId；复跑后单文件 2 tests passed。 |
| 2026-05-16 | 迁移 `reactionQueueDestroyerId.test.ts` 时第一次误用 `getReactionPromptOptionBySourceDefId`，漏传 prompt 参数，导致两个用例报 “Expected reaction option for undefined”。 | 改为按 helper 签名传入 `(state, prompt, sourceDefId)`；复跑后单文件 2 tests passed。 |
| 2026-05-16 | 迁移 `query6Abilities.test.ts` 时把“无抽牌事件但应创建排序 prompt”的 `wizard_portal` 用例机械加上 `expectNoPrompt`，导致单文件短暂失败。 | 回到用例语义：保留 `getSimpleChoicePrompt(matchState, 'wizard_portal_order')` 作为正向行为断言，只在真正无交互分支使用 `expectNoPrompt`；复跑后 30 tests passed。 |
| 2026-05-16 | 清理 `factionAbilities.test.ts` 未使用变量 warning 时，第一次误删了两个仍需要传给 facade 的 `matchState` 绑定，导致 `dino_natural_selection` 两个用例短暂 ReferenceError。 | 按失败行恢复需要的 `matchState`，只清理真正未使用的 swashbuckling/howl/survival 等用例绑定；复跑后 46 tests passed，eslint 0 errors。 |
| 2026-05-16 | 删除 `auditUtils` 的低层重导出后跑 8 个 audit 入口，4 个文件红灯；失败点是既有业务审计债务：`zombies.ts` 遗留注册白名单、`sharks_mako` special 注册、古埃及 buried special 语义、`werewolf_leader_of_the_pack_pod` ongoing 注册。 | 不把全 audit 说成通过；本轮只用 `rg getInteractionsFromMS` 无外部引用和 `npm run test:structure` 通过证明出口删除本身，四个 audit 红灯登记为后续业务修复候选。 |
| 2026-05-16 | 迁移 `smashup.smoke.test.ts` 的 Hill give-minion -> counter 链时，第一次沿用 `resolveAffectedMinions(...)` 手工重放触发，导致同一个 `onMinionAffected` trigger 被重复入队；进一步实跑真实链路后又发现 `MINION_CONTROL_CHANGED` 的 affect 快照仍保留旧 controller，第一次 reaction 消费时不会弹出 counter prompt。 | 测试侧改为直接消费 `giveResult.finalState`，不再补跑触发链；领域侧在 `buildAffectRecords()` 的 `MINION_CONTROL_CHANGED` 分支把 `triggerMinion.controller` 修正为 `toControllerId`，让真实反应链看到变更后的控制权。 |
| 2026-05-16 | 收口 `ninja_hidden_ninja consumesNormalLimit` 后复跑 `baseFactionOngoing.test.ts`，暴露 `trickster_brownie` 的 `control_change` 用例红灯。根因不是新测试本身，而是 Brownie helper 只手工传了 `triggerMinion` / `affectType`，没像 reducer 一样传 `affectEvent + affectBatchTargets`；同时 Brownie 的 `control_change` 语义需要看 `fromControllerId`，不能只看变更后的 `triggerMinion.controller`。 | 测试侧让 `triggerBrownieFromEvent(...)` 对齐 reducer 传参；实现侧在 `trickster_brownie` 的 `onMinionAffected` 对 `control_change` 特判读取 `MINION_CONTROL_CHANGED.payload.fromControllerId`。复跑后 `baseFactionOngoing.test.ts` 81 passed。 |

---

# Task Plan: 反馈真实链路与 AI 自动反馈复核（2026-05-15）

> 当前正式计划入口。下方旧计划均为历史上下文，不作为本轮任务入口。

## Goal

确认“最近都没有反馈”是否来自反馈系统自身故障：用端到端真实链路验证用户反馈从前端弹窗提交到本地 API/Mongo 再到后台反馈页可见；同步复核在线 AI 自动反馈是否仍有足够诊断证据，不足则重构自动反馈诊断 payload，而不是只做 mock 展示测试。

## Constraints

- 不创建、切换、删除分支或 worktree。
- 当前工作区已有大量历史/用户脏改，本轮只触碰反馈链路、AI 自动反馈诊断、E2E/API 测试与对应 evidence/计划文件。
- 生产侧默认只读；不部署、不重启、不回写反馈状态，除非用户后续明确授权。
- 若最终回复声称 E2E 通过，必须给出本轮实际核对过的截图绝对路径。

## Acceptance Checklist

- [x] S0 读取反馈相关规范、历史计划与关键代码，锁定真实链路缺口。
- [x] S1 只读确认生产当前反馈盘面，判断是否真的是 open/in_progress 为 0。
- [x] S2 建立并运行真实用户反馈 E2E：前端弹窗提交 -> API 写入 -> 后台反馈页可见。
- [x] S3 复核 AI 自动反馈测试和 payload 证据字段；证据不足则重构并补回归。
- [x] S4 运行聚焦验证，实际查看截图并写 evidence。
- [x] S5 更新 progress/findings，明确是否需要后续部署或生产状态动作。

## Current Status

- [x] 已读取 `diagnose` / `fullstack-dev` / `planning-with-files` workflow。
- [x] 已确认现有 mock 后台 E2E 不足以证明真实反馈提交链路。
- [x] 已补真实链路 E2E 并复跑通过。
- [x] 已只读确认生产并非反馈断流：最近 14 天 45 条记录，当前 `open/in_progress=2`。
- [x] 已修复最新 open AI 自动反馈指向的 Splendor 未开局 watchdog 误代发动作问题。

## Errors Encountered

| 时间 | 错误 | 处置 |
| --- | --- | --- |
| 2026-05-15 | `session-catchup.py` 提示 Codex 原生 session 解析未实现。 | 记录为无可同步上下文，继续按当前对话与项目文件推进。 |

---

# Task Plan: 线上 AI 自动反馈排查与修复（2026-05-13）

> 当前正式计划入口。下方旧计划均为历史上下文，不作为本轮任务入口。

## Goal

只读拉取生产反馈真源，确认当前是否存在 `online-ai-watchdog` / 系统 AI 自动反馈的 `open` 或 `in_progress` 项；若有可定位根因则修复并验证，若单条反馈信息不足以定位，则对对应自动反馈/恢复链路做结构化重构，提升后续可诊断性与收口能力。

## Constraints

- 不创建、切换、删除分支或 worktree。
- 生产侧先只读查询；不做状态回写、部署、重启或数据修改，除非后续获得明确授权或本轮修复验证已经形成可回写证据。
- 人类反馈仍高于系统反馈；本轮用户点名 `ai自动反馈`，所以先聚焦系统自动反馈。
- 如果线上反馈不足以定位，重构方向应落在诊断信息、聚合指纹、恢复链路边界或错误分类，不用猜测性业务补丁冒充修复。

## Acceptance Checklist

- [x] S0 读取根规范、部署/服务器入口、历史反馈处理流程与规划 skill。
- [x] S1 生产只读拉取当前 `open/in_progress` 自动反馈，保存关键事实。
- [x] S2 对每条 AI 自动反馈提取 gameId、matchId、incidentKind、reason、stateSnapshot/log 线索并归类。
- [x] S3 有明确根因时修复；无法从反馈定位时重构反馈诊断/恢复链路。
- [x] S4 跑相关聚焦验证；涉及 UI 才补 E2E 和截图证据。
- [x] S5 更新 evidence / progress，说明线上状态与是否需要回写或部署。

## Current Status

- [x] 已读取根 `AGENTS.md`、服务器入口文档、`docs/deploy.md` 与 planning-with-files skill。
- [x] 已确认现有 `task_plan.md` 顶部 shayu 任务已完成，本轮新建顶部计划。
- [x] 已拉取生产当前 AI 自动反馈真源并完成归类。
- [x] 已重构 watchdog 失败诊断：补足 command type 与真实失败原因透传。
- [x] 已完成聚焦 eslint / vitest 验证。
- [ ] 生产 `open` 状态如需回写，等待明确授权后再执行。

## Addendum（2026-05-14 23:38 +08）：人类线上反馈 Twister 可选语义

- [x] 已核实生产反馈 `6a055d1429cd213e03bfd3e9`：`twister实现完全错误`，状态仍按生产库实际值处理，本轮未擅自标 resolved。
- [x] 已以正式 shayu 卡图为真相源复核：Twister / Monster Tornado 是“你可以”移动，合法候选存在时也必须允许跳过。
- [x] 已修复 `tornados_twister` / `tornados_monster_tornado` 共用 push/pull helper：加入 skip，禁用可选 prompt 单候选自动结算，skip 后不改变权威状态。
- [x] 已补 L2、审计门禁与 L3 真实入口 E2E，并实际打开截图核对。
- [x] 已回写 evidence：`evidence/smashup/smashup-feedback-6a055d1429-twister-closeout-2026-05-14.md` 与 shayu 全面审计覆盖矩阵。
- [ ] 未完成：本地修复尚未提交、push、部署；线上反馈状态尚未回写 resolved。

## Addendum（2026-05-15 09:20 +08）：shayu 长描述复杂对象抽样全链路审计

- [x] 已按中文描述长度与动作链复杂度抽样复核：`sharks_megalodon`、`mythic_greeks_argonaut`、`sharks_blood_in_the_water`、`tornados_not_in_kansas`、`mythic_greeks_favor_of_dionysus`。
- [x] 已发现并修复 `mythic_greeks_argonaut` 两个真实缺口：缺少替代行动额度打出入口，以及 Argonaut 触发 action 后能力时漏掉 Jason。
- [x] 已补 L2 行为测试与 L3 真实入口 E2E：随从额度已满、行动额度可用时打出 Argonaut，并串联 Odysseus / Heracles / Spartan / Jason。
- [x] 已新增 evidence：`evidence/smashup/smashup-shayu-long-text-sample-audit-2026-05-15.md`。
- [x] 已把漏审根因升级为通用规范：审计必须逐句/逐子句核销规则文本，任一子句缺实现或证据时整对象不得标 `passed`；已更新 `docs/ai-rules/testing-audit.md` 和项目 skill，并回写旧 evidence 失效结论。
- [ ] 未完成：本轮修复尚未提交、push、部署；该抽样不替代 shayu 45 对象全面审计矩阵。

## Errors Encountered

| 时间 | 错误 | 处置 |
| --- | --- | --- |
| 2026-05-13 | `session-catchup.py` 提示 Codex 原生 session 解析未实现。 | 记录为无可同步上下文，继续按当前对话与项目文件推进。 |

---

# Task Plan: SmashUp shayu 三派系通用入口矩阵补强与全量重审（2026-05-12）

> 当前正式计划入口。下方旧计划均为历史上下文，不作为本轮任务入口。

## Goal

把“交互入口语义审计”从一句通用原则补强成可执行的通用审计矩阵，并按新矩阵对 SmashUp shayu 三派系（sharks / tornados / mythic_greeks）39 张卡 + 6 张基地做 P0/P1 全量重审；发现问题必须修复或显式登记，旧 evidence 失效结论必须回写。

## Constraints

- 不创建/切换/删除分支或 worktree；在当前工作树既有脏改基础上推进。
- 不把抽样审计说成全量；全量必须有对象清单逐项状态。
- 通用规范只写通用矩阵，不写 shayu / 飞鲨 / 单卡特例。
- 结论按 L1/L2/L3/L4 分层；没有新增 E2E 截图时不得宣称 L3 已补齐。
- 使用 completion guard：`temp/smashup-shayu-full-audit-2026-05-12.json`。

## Acceptance Checklist

- [x] S0 读取规范与项目 skill：game-audit-workflow、add-new-faction、testing-audit、engine-systems、testing-best-practices、automated-testing、data-entry。
- [x] S1 补强 `docs/ai-rules/testing-audit.md`：交互入口语义矩阵、目标归属、数量/可选、动作链、上下文携带、自动执行 vs 玩家选择。
- [x] S2 建立 shayu 39 卡 + 6 基地对象清单，标 L0-L4 与 P0/P1 风险。
- [x] S3 对每个对象做 P0/P1 重审：描述动作链、第一入口、数据字段、UI/validator/handler/reducer 链路、上下文与可选/数量语义。
- [x] S4 修复或登记发现项；同步测试与旧 evidence 回写。
- [x] S5 运行相关验证并更新 completion guard，不满足则不得宣称完成。
- [x] S6 再次抽样调查 L1/残余高风险对象；发现并修复 `mythic_greeks_favor_of_zeus` 二次基地选择缺口，补 L2 行为测试与 evidence。

## Current Status

- [x] 已确认根 `task_plan.md` 旧当前任务为七大恨 intake，已 completed；本轮在顶部切换为 shayu 全量重审计划并保留历史。
- [x] 已创建 completion guard 状态文件。
- [x] 已读取 OpenSpec 指引：本轮属于现有审计/bug 修复/证据补强，不先创建新 OpenSpec proposal。
- [x] 已补强通用规范、完成全量审计清单与验证。
- [x] 再次抽样调查完成：5 个高风险对象 L2 抽查通过；`favor_of_zeus` 入口重复 prompt 已修复。

## Errors Encountered

| 时间 | 错误 | 处置 |
| --- | --- | --- |
| 2026-05-12 | planning-with-files session-catchup 提示原生 Codex session 解析未实现。 | 记录为无可同步上下文，继续按当前对话与项目文件推进。 |
| 2026-05-12 | PowerShell `Select-Object -Index 90..120` 写法被当成字符串，读取片段失败。 | 改用 Python 按 UTF-8 读取并输出行号。 |
| 2026-05-12 | 输出 `domain/index.ts` 时遇到 GBK 无法编码特殊字符。 | 改用 Python `stdout.buffer.write(...encode('utf-8'))` 输出。 |

---

# Task Plan: 七大恨新游戏前置 intake 与可行性分析（2026-05-11）

> 当前正式计划入口。下方旧计划均为历史上下文，不作为本轮任务入口。

## Goal

基于 `D:\gongzuo\webgame\gameasset\七大恨 中文mod\七大恨规则.pdf` 与 `D:\gongzuo\webgame\gameasset\七大恨 中文mod\Images`，先完成新游戏前置 intake：把规则 PDF 转成易读 Markdown，把需要用到的图片放入项目正式资源目录并规范命名，随后分析“七大恨”接入本项目的实现可行性与风险；同时记录现有 create-new-game skill 的缺口，形成后续 skill 优化建议。

## Constraints

- 不擅自创建、切换、重建或删除分支；`create-new-game` 的正式建游戏分支要求等待用户明确授权。
- 本轮先做规则/资源/可行性前置，不直接创建完整游戏骨架。
- 主真相源：用户提供的中文规则 PDF 与中文 mod 图片目录。
- 图片正式资源必须遵循 `docs/ai-rules/asset-pipeline.md`：运行时资源落 `public/assets/i18n/zh-CN/<gameId>/...` 或过渡期等价路径，路径语义化，后续代码引用不写 `compressed/`。
- 录入中间产物、OCR/核对图、识别清单放 `temp/`，不混入正式资源树。

## Acceptance Checklist

- [x] S0 规划与规范读取：已读取 AGENTS、OpenSpec、planning-with-files、create-new-game、asset-pipeline、data-entry、temp-files-management。
- [x] S1 规则转档：将 `七大恨规则.pdf` 转为易读 Markdown，落到项目内新游戏 `rule/` 或前置文档目录，并保留转换方式与质量说明。
- [x] S2 素材盘点：列出 `Images` 下素材清单、尺寸、文件类型、疑似用途与命名依据。
- [x] S3 资源入库：把可裁定用途的正式图片复制到项目规范目录，采用语义化命名；不确定用途只登记，不强行命名。
- [x] S4 资源压缩/清单：对正式入库图片执行最小必要压缩或记录阻塞原因。
- [x] S5 可行性分析：基于规则文档与素材盘点分析核心机制、引擎映射、UI/资源复杂度、MVP 切分与风险。
- [x] S6 skill 优化建议：记录 create-new-game 对“PDF 转 MD + 素材 intake + 可行性评估”阶段的可补强点。

## Current Status

- [x] 已确认本轮不创建分支，先执行新游戏前置 intake。
- [x] 已读取项目根 AGENTS 与 OpenSpec 指引。
- [x] 已读取 planning-with-files 与 create-new-game skill。
- [x] 已读取图片资源、数据录入、临时文件管理规范。
- [x] 已完成规则转档核验、素材规范入库、压缩、manifest 校验、R2 上传、远端抽查、可行性分析与 skill 补强。

## Errors Encountered

| 时间 | 错误 | 处置 |
| --- | --- | --- |
| 2026-05-11 | planning-with-files session-catchup 提示原生 Codex session 解析未实现。 | 记录为无可同步上下文，继续按当前对话与项目文件推进。 |

---

# Task Plan: DiceThrone 新增 Treant / Ninja 两个英雄（2026-05-09）

> 当前正式计划入口。下方历史计划来自创建 worktree 时的主线文件，仅保留为历史上下文，不作为本轮任务入口。

## Goal

在独立 worktree `.worktrees/dicethrone-treant-ninja` 中，基于用户提供的两组中文图片素材新增 Dice Throne `treant` 与 `ninja` 两个英雄，完成三方图片规格对比、资源接入、静态数据与必要机制实现、审计文档、测试/E2E、截图与资源链路收口。

## Scope

- 主真相源：
  - `public/assets/i18n/zh-CN/dicethrone/images/treant`
  - `public/assets/i18n/zh-CN/dicethrone/images/ninja`
- 参考对象：成熟旧英雄与新英雄 `gunslinger`，必要时对照 `samurai` / `moon_elf` 等复合升级与 atlas 接线。
- 工作现场：`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja`
- 分支状态：detached HEAD，未新建分支。

## Acceptance Checklist

- [x] S0 合同层：锁定两英雄真相源、素材清单、图片规格差异、可复用项/谨慎项、冲突待裁定项。
- [x] S0 裁图层：生成单对象可读裁图/核对图，临时图放 `temp/`，正式资源与核对中间产物分层登记。
- [x] S0 文档层：为两个英雄创建/更新真相源表、录入核对、卡牌录入核对。
- [x] S1 资源层：压缩正式资源，重建 manifest，确认 `compressed/` 和 atlas 引用合同。
- [x] S1 配置层：接入英雄注册、骰面、token、能力、卡牌、critical images、locale。
- [x] S2 机制层：实现无法直接复用的 token / 被动 / 技能 / 卡牌机制，优先复用旧英雄共享逻辑。
- [x] S2 共享契约对比：至少与 `gunslinger` 和一个成熟复合升级英雄做并排核对。
- [x] S3 验证层：补/更新现有测试文件，跑相关 Vitest、eslint/typecheck，必要时跑真实入口 E2E。
- [x] S3 截图层：若涉及 UI/卡图展示，必须实际看截图并写 evidence。
- [x] S4 审计层：在 `evidence/` 落两个英雄审计与端到端证据文档，结论按 L1-L4 分层。
- [x] S4 资源远端层：运行资源上传并抽查代表性 URL；若受环境阻塞，明确列未上传资源与影响。

## Current Status

- [x] 已创建 detached worktree：`.worktrees/dicethrone-treant-ninja`
- [x] 已确认主工作树有大量无关脏改，本轮不在主工作树继续。
- [x] 已把用户给出的 `treant` / `ninja` 图片目录复制进新 worktree。
- [x] 已完成 S0-S4：新增 treant/ninja，完成资源、配置、规则文档、审计证据、测试/E2E、R2 回查。

## Reopened Scope（2026-05-10 用户复盘）

- [x] 重新按 `dicethrone-hero-intake` 新门禁复核，不再把选角 E2E 视为全流程完成。
- [x] 建立 treant/ninja 批次矩阵：数据录入、机制、资源上传、E2E、审计逐格证明。
- [x] 逐项核对两个角色的技能、Token、卡牌是否只有 L1/L2，列出未实现项。
- [x] 修订 evidence，明确哪些是真完成、哪些是 scoped-debt。
- [x] 如果要宣称彻底完成，必须补齐 L2/L3/L4 缺口；否则不得收口。


## Restart Contract（2026-05-10 重来口径）

> 用户明确要求“新增派系是通用 skill，没有就加，给我重来”。本节覆盖上方旧 Closeout Snapshot；旧 `S0-S4 已完成` 只能视为上一轮误收口历史，不作为当前完成证明。

### 新增派系/角色通用 skill

| 项 | 状态 | 证据 |
|---|---|---|
| 项目通用 skill `.windsurf/skills/add-new-faction/SKILL.md` | passed | `PYTHONUTF8=1 python D:\codex-home\skills\.system\skill-creator\scripts\quick_validate.py .windsurf\skills\add-new-faction` -> `Skill is valid!` |
| `data-entry-workflow` 路由到通用新增派系 skill | passed | `.windsurf/skills/data-entry-workflow/SKILL.md` 已包含“通用新增派系 / 新增角色 / 新增英雄”路由 |
| DiceThrone hero intake 门禁补强 | passed | `docs/games/dicethrone/workflows/dicethrone-hero-intake.md` 已增加禁止提前收口、批次矩阵、L0-L4 与资源/E2E/审计门禁 |

### Treant / Ninja 重审批次矩阵（当前真状态）

| objectId | 数据录入 | 资源链 | 机制实现 | 审计 | E2E | 状态 |
|---|---|---|---|---|---|---|
| `treant` | passed | passed | passed | passed | passed | passed |
| `ninja` | passed | passed | passed | passed | passed | passed |

上表已经在 2026-05-10 20:16 +08 全部核销为 `passed`；本轮可以使用“完成/收口”口径，但必须同时引用 evidence、测试命令和截图路径。

### 重审缺口核销结果

以下清单是 2026-05-10 18:49 +08 重新打开时的待审/待修项，20:16 +08 后不再作为阻塞项保留；逐项实现状态、L2/L3 证据与剩余风险以 `evidence/dicethrone/dicethrone-treant-ninja-intake-audit-2026-05-10.md` 为准。

- Treant：`seedling` / `sapling` / `divine` / `life_sap` / `thorn` 已完成机制复核；生命源泉另有真实入口 E2E 截图链证明主阶段奖励骰治疗可触发、可展示、可收口。
- Ninja：`delayed_poison` / `smoke_bomb` / `ninjutsu` 已完成机制复核；忍术另有真实入口 E2E 截图链证明 beforeDamageDealt 奖励骰加伤可触发、可展示、可收口。
- 旧问题“按钮可见但 custom 被动不派发命令”已修在 `src/games/dicethrone/Board.tsx`。
- 旧问题“beforeDamageDealt token 加伤只更新 pendingDamage，不同步 pendingAttack.bonusDamage”已修在 `src/games/dicethrone/domain/reduceCombat.ts`。

## Closeout Snapshot

- 2026-05-10 20:16 +08：按通用新增派系 skill 重来后，Treant / Ninja 的数据录入、资源链、机制 L2、真实入口 E2E、审计 evidence 已全部重新核销为 passed。
- 旧 16:20 收口只证明选角/静态接入，已在 evidence 中明确标记为失效结论。
- 证据文档：`evidence/dicethrone/dicethrone-treant-ninja-intake-audit-2026-05-10.md`。
- 机制 E2E 命令：`PW_PORT=6473 / PW_GAME_SERVER_PORT=20300 / PW_API_SERVER_PORT=21300 / PW_WORKERS=1 npm run test:e2e:ci -- e2e/dicethrone/dicethrone-treant-ninja-mechanics.e2e.ts` -> 4 passed。
- 关键截图：
  - `test-results/evidence-screenshots/dicethrone/dicethrone-treant-ninja-mechanics.e2e/树精生命源泉应在主阶段触发奖励骰治疗并收口/03-life-sap-after-close.png`
  - `test-results/evidence-screenshots/dicethrone/dicethrone-treant-ninja-mechanics.e2e/忍者忍术应在伤害前掷骰加伤并回到可收口状态/02-ninjutsu-bonus-die-overlay.png`
  - `test-results/evidence-screenshots/dicethrone/dicethrone-treant-ninja-mechanics.e2e/忍者忍术应在伤害前掷骰加伤并回到可收口状态/03-ninjutsu-after-bonus-closeout.png`
  - `test-results/evidence-screenshots/dicethrone/dicethrone-treant-ninja-mechanics.e2e/树精木苗树灵两个主阶段按钮应短文案展示并真实结算/01-sapling-short-buttons-before-use.png`
  - `test-results/evidence-screenshots/dicethrone/dicethrone-treant-ninja-mechanics.e2e/忍者忍术6点应弹出分支选择并能施加慢性中毒/02-ninjutsu-6-choice-modal.png`


## Errors Encountered

| 时间 | 错误 | 处置 |
| --- | --- | --- |
| 2026-05-09 | 首次复制素材时用 `Copy-Item -LiteralPath ...\*`，PowerShell 将 `*` 当字面量导致找不到路径。 | 改用 `Copy-Item -Path ...\*` 后复制成功。 |

---

# Task Plan: 线上反馈持续修复（2026-05-03）

> 来源：线上反馈源（生产 API + 生产 Mongo）
> 说明：本节是当前正式计划入口；下方旧任务计划仅保留为历史记录，不再作为本轮任务入口。

## Goal
> 持续清空当前线上 `open` 反馈，默认以**人类反馈优先**为主线推进；系统自动反馈只作为补现场、补根因或止血支线处理。对仍在持续刷新的 watchdog，可并行止血，但不得再覆盖人类反馈的主优先级。

## Priority Rule

- [x] 已按 2026-05-05 新口径更新本任务优先级
  - 默认顺序：`人类反馈 > 系统自动反馈`
  - `watchdog` / `unsatisfiable-interaction-auto-skipped` / `force-end-turn-*` 仅在两类情况下提前处理：
    - 为某条人类反馈补现场或补根因；
    - 正在持续制造新故障、刷屏或资源风险，需要并行止血。
  - 后续汇报必须区分“人类反馈主线”与“系统反馈止血支线”，不得再混成单一优先级口径。

## Current Snapshot

- [x] 2026-05-10 命令执行异常全链路已完成本地修复与聚焦验证
  - 后端 batch 失败不再固定折叠为 `command_failed`，会透传领域错误码或 `pipeline_error: <message>`
  - 前端不再静默 `command_failed`，非 `stale_state` 的 batch rejection 会进入错误展示路径
  - 已补证据：`evidence/transport-command-error-full-chain-fix-2026-05-10.md`
  - 已通过聚焦 transport / MatchRoom helper 测试与 `npm run typecheck`
  - `长舟` 已按用户澄清重新定位为 SmashUp `base_drakkar`（德拉卡尔号 / Drakkar），不是 SummonerWars；根因是 2026-05-08 引入的运行时 `effectContract` 漏 `playLimits` / `discardState` / `opensInteraction` 后误拦截合法基地能力
  - 已补 `PLAY_MINION -> base_drakkar` 真实触发链回归，聚焦 `base_drakkar` 测试 4 passed
- [x] 审计流程已按“执行层级不够深”的复盘结论升级
  - 已更新 `docs/ai-rules/testing-audit.md`，新增“深度审计流程（强制）”
  - 已把对象清单、完整链路、真实入口、共享根因扩审、旧结论失效回写，改成统一深审门禁
  - 已明确把 `D37` 与 `D40` 标为本轮漏审复盘中的高风险专项
- [x] 生产反馈真源已恢复可读
  - 2026-05-03 生产 `Mongo` 因根盘打满 + `FTDC diagnostic.data` 异常重启，导致 `/admin/feedback` 返回 `500`
  - 已截断 `boardgame-game-server` 的 `13G` Docker 日志，根盘从 `100%` 降到 `68%`
  - 已确认 `boardgame-mongodb` 恢复为正常启动，`GET /admin/feedback?status=open` 恢复可读
- [x] 当前线上盘面已快照到本地
  - `temp/feedback-online/current-open-20260503.json`
  - `temp/feedback-online/current-in-progress-20260503.json`
- [x] `splendor` watchdog 本地止血补丁已完成并通过最小回归
  - `src/engine/transport/onlineAiRecovery.ts` / `src/engine/transport/server.ts`
  - 已验证：`splendor` 不再生成/执行裸 `ADVANCE_PHASE` recovery，manifest 明确禁用 AI 时 watchdog 会忽略残留 AI seat metadata
- [x] `dicethrone` 当前 watchdog / defensiveRoll 主链已完成本地聚焦验证
  - 已通过：`basic-commands-coverage`、`response-window-interaction-lock`、`flow.test.ts` 中 `targetingRoll / defensive / displayOnly / bonus` 相关聚焦用例
- [x] `smashup` 当前 `visible-interaction` / `scoreBases` 主链已完成本地聚焦验证
  - 已通过：transport `visible-interaction / recover-interaction` 相关回归 + `scoreBases-auto-continue`
- [x] `69f7ac9d...` 对应的 `smashup_reaction_choose` 重复 special 候选已完成本地最小修复验证
  - 已定位线上快照特征：同一 prompt 中重复出现 `activate_special:titan:titan_2_wizards_arcane_protector:3`
  - 已在 `reactionSession` 增加按 `option.id / reaction value` 去重，并补 `scoreBases-auto-continue` 三条聚焦回归通过
  - 已补最小兼容修复：`src/games/smashup/abilities/innsmouth.ts` / `e2e/src/games/smashup/abilities/innsmouth.ts` 缺失 `registerInteractionHandler` import，修复后 transport 聚焦套件可再次编译
- [x] `smashup` watchdog transport 闭环证明已补齐
  - 已新增并跑通：`src/engine/transport/__tests__/server.test.ts` 中 “`smashup` 持久化 stale reaction choice 走 watchdog 恢复时，不应落成 `blocker_persisted`”
  - 2026-05-04 已再次复跑通过：`stale reaction choice` / `visible-interaction action` / `follow-up advance` 三条 watchdog 聚焦用例
- [x] `splendor` 线上 orphan watchdog 已完成生产止血
  - 先确认 `/internal/rooms` 已为空但 `boardgame-game-server` 单进程仍持续对 `Nh_5xVWO0km` 执行 `ADVANCE_PHASE -> unknownCommand`
  - 已执行最小生产操作：重启 `boardgame-game-server`
  - 复核：`69f6c4bc9ec13b96d710e10d` 停在 `occurrenceCount = 417` / `lastOccurredAt = 2026-05-03T17:40:12.626Z`，重启后 1 分钟日志不再出现该 `matchID`
- [x] `69f5be8c9ec13b96d710baa4` 已完成线上状态回写
  - 2026-05-04 生产 Mongo 直查先确认该条仍为 `open`，且现场仍对应 human `main1` 残留 AI 枪手 `displayOnly` 奖励骰孤儿态
  - 已按现有 transport/watchdog 修复证据执行最小回写：`matched=1`、`modified=1`
  - 回写后复核：`temp/feedback-online/post-69f5be-resolved-summary-20260504.json` 显示该条已为 `resolved`，当前 `openTotal = 20`，`dicethrone|feedback-modal` 从 `7` 降到 `6`
- [x] `69f7ac9d9ec13b96d710fded` 已按“本地已修即 resolved”口径完成线上状态回写
  - 该条对应 `smashup_reaction_choose` 中重复的 `arcane protector` special 候选；本地 runtime + watchdog 聚焦回归已通过
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
  - 回写后复核：当前 `openTotal = 19`，`smashup|online-ai-watchdog` 从 `4` 降到 `3`
- [x] `69f4acdf9ec13b96d7109f30` 已按“本地已修即 resolved”口径完成线上状态回写
  - 该条用户反馈“头晕目眩无法使用”；现场权威态显示 Barbarian 在 `main2` 手里持有 `card-dizzy`，但攻击后响应链未被用户正常使用
  - 本地已有 `card-dizzy` 的领域回归与真实 E2E 证据：攻击结算后 `afterAttackResolved` 响应窗真实出现，`card-dizzy` 可打出并对目标施加 `Concussion`
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] `69f5c17f9ec13b96d710bb03` 已按“本地已修即 resolved”口径完成线上状态回写
  - 该条属于 `smashup_reaction_choose` 的 `scoreBases` / `visible-interaction:recover-interaction:blocker_persisted` 聚合项
  - 本地已有 transport 闭环补测，证明持久化 stale reaction choice 走 watchdog 恢复时会先按当前 live 语义收口，不再落成 `blocker_persisted`
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] `69f423585cacc4e6b5cdbdbf` 已按“本地已修即 resolved”口径完成线上状态回写
  - 该条是 `69f5c17f...` 的更早同类 `scoreBases` / `smashup_reaction_choose` 聚合项
  - 2026-05-04 按同一 transport/runtime 证据链通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 新一轮回写后盘面已降到 `openTotal = 16`
  - 聚类更新为：`dicethrone|feedback-modal = 5`、`dicethrone|online-ai-watchdog = 2`、`smashup|feedback-modal = 7`、`smashup|online-ai-watchdog = 1`、`splendor|online-ai-watchdog = 1`
- [x] `69f479c69ec13b96d71099e3` 已按“本地已修即 resolved”口径完成线上状态回写
  - 该条是最后 1 条 `smashup|online-ai-watchdog open`，根因不是 `scoreBases` stale reaction，而是 `endTurn` mandatory 顺序交互收口后，watchdog 没把 SmashUp `endTurn` 纳入 follow-up `ADVANCE_PHASE` fallback
  - 已补本地 transport 修复：`src/engine/transport/server.ts` 允许 SmashUp `endTurn` 在 legal action 耗尽后继续 fallback `ADVANCE_PHASE`
  - 已补并跑通聚焦回归：`watchdog falls back to first trigger respond for smashup onTurnEnd mandatory reaction ordering`
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 15`
  - 聚类更新为：`dicethrone|feedback-modal = 5`、`dicethrone|online-ai-watchdog = 2`、`smashup|feedback-modal = 7`、`splendor|online-ai-watchdog = 1`
- [x] `69f21b05ab54eadcc2bb2b9e` 已按“本地已修即 resolved”口径完成线上状态回写
  - 该条现场不是泛化 AI 发呆，而是 DiceThrone 枪手 `targetingRoll -> Loaded token -> bonus die` 收口链脱节：末尾事件已走到 `BONUS_DICE_REROLL_REQUESTED`，但系统最终落成 `sys.phase=targetingRoll`、`flowHalted=true`、`interaction.queue=[]`
  - 根因簇与已回写 `69f5be8c...` 的 `displayOnly / pendingBonusDiceSettlement / hidden response` 修复链一致，也共享 `69f04210...` 的 `targetingRoll` 推进缺口
  - 已复跑并通过本地聚焦回归：`src/games/dicethrone/__tests__/flow.test.ts` 4 条 `targetingRoll` 用例、`src/engine/transport/__tests__/server.test.ts` 5 条 `displayOnly / hidden interaction / watchdog` 用例
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 14`
  - 聚类更新为：`dicethrone|feedback-modal = 4`、`dicethrone|online-ai-watchdog = 2`、`smashup|feedback-modal = 7`、`splendor|online-ai-watchdog = 1`
- [x] `69f2a81c5cacc4e6b5cdb4e5` 已按“本地已修即 resolved”口径完成线上状态回写
  - 该条生产快照并非卡死终态，而是已经完整收口到 `main2`：末尾事件顺序为 `TOKEN_RESPONSE_REQUESTED -> TOKEN_USED -> TOKEN_RESPONSE_CLOSED -> ATTACK_RESOLVED -> SYS_PHASE_CHANGED(defensiveRoll -> main2)`
  - 终态同时满足：`flowHalted=false`、`interaction.queue=[]`、`pendingAttack=null`
  - 该条与 DiceThrone `pendingInteractionId / hidden response / token response` 修复簇一致，按已修未回写处理
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 13`
  - 聚类更新为：`dicethrone|feedback-modal = 3`、`dicethrone|online-ai-watchdog = 2`、`smashup|feedback-modal = 7`、`splendor|online-ai-watchdog = 1`
- [x] `69f31c695cacc4e6b5cdb992` 已按“本地已修即 resolved”口径完成线上状态回写
  - 项目现有专项审计已直接点名同一时间戳、同一反馈原文“再来点这张卡自己整个回合都用不了”
  - 根因是 4 人 `targetingRoll` 自动目标窗口里攻击修正卡误死绑 `pendingAttack.defenderId`
  - 2026-05-04 已复跑并通过聚焦回归：`攻击修正卡可在 defenderId 写回前直接结算到自动目标`、`Loaded token 的奖励骰特写应命中自动目标`
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 12`
  - 聚类更新为：`dicethrone|feedback-modal = 2`、`dicethrone|online-ai-watchdog = 2`、`smashup|feedback-modal = 7`、`splendor|online-ai-watchdog = 1`
- [x] `69f18ca4ab54eadcc2bb2322` 已按“本地已修即 resolved”口径完成线上状态回写
  - 线上现场仍处于 `defensiveRoll`，且底层骰子数据存在；问题位点对齐到共享骰面可见性修复簇 `69cba605...`
  - 已复跑共享 fallback 单测通过；fresh E2E 尝试因测试 runtime 启动失败未进入业务断言
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 新一轮回写后盘面已降到 `openTotal = 11`
  - 聚类更新为：`dicethrone|feedback-modal = 1`、`dicethrone|online-ai-watchdog = 2`、`smashup|feedback-modal = 7`、`splendor|online-ai-watchdog = 1`
- [x] `69f1978dab54eadcc2bb24b0` 已按“本地已修即 resolved”口径完成线上状态回写
  - 该条缺少 `stateSnapshot` / `errorContext`，按明确推断并入同日 DiceThrone 全局 HUD 加载失败簇 `69f1f938...` / `69f1f943...`
  - 已重跑同簇本地验证：`chatSelectionLogic.test.ts` 14 通过，`npm run build` 成功
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 10`
  - 聚类更新为：`smashup|feedback-modal = 7`、`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
  - `dicethrone|feedback-modal` 已清零
- [x] `69f27faaab54eadcc2bb2c77` 已按“本地已修即 resolved”口径完成线上状态回写
  - 线上反馈原文：`蒸汽朋克卡牌差分机可以无限抽牌`
  - 根因不是 `Difference Engine` 自身递归，而是 `endTurn` 恢复态再次重复 `collectTriggers('onTurnEnd')`，把同一帧 `turn-end:1:9:0` trigger 重新入队
  - 已补本地修复：`src/games/smashup/domain/index.ts` 为 `from === 'endTurn'` 的恢复态加闸，避免收口后再次重排同一组 `onTurnEnd` trigger
  - 已复跑并通过：`turnCycle.test.ts` 中新增最小复现 + `expansionOngoing.test.ts` 中 `steampunk_difference_engine` 聚焦回归
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 9`
  - 聚类更新为：`smashup|feedback-modal = 6`、`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
  - 最新快照已落盘：`temp/feedback-online/current-open-20260504-after-batch9.json`
- [x] `69f27a5dab54eadcc2bb2c75` 已按“本地已修即 resolved”口径完成线上状态回写
  - 线上反馈原文：`因为忍者侍从打出的随从无法触发打出效果`
  - 根因不是 `ninja_acolyte_play` 没产出 `MINION_PLAYED`，而是 `afterEvents` 轮里产出的 `MINION_PLAYED` 在 `postProcessSystemEvents()` 触发 `onPlay` 前还没先 reduce 进临时 `core`，导致 `cowboys_gunfighter` 看不到自己已在场上，决斗交互直接短路
  - 已补本地修复：`src/games/smashup/domain/index.ts` 先把该 `MINION_PLAYED` 临时 reduce 到 `tempCore`，再触发 `fireMinionPlayedTriggers()`
  - 已复跑并通过：`baseFactionOngoing.test.ts` 新增最小回归 + `newFactionAbilities.test.ts` 枪手原始 `onPlay` 聚焦回归
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 8`
  - 聚类更新为：`smashup|feedback-modal = 5`、`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
  - 最新快照已落盘：`temp/feedback-online/current-open-20260504-after-batch10.json`
- [x] `69f385d75cacc4e6b5cdbd4a` 已按“本地已修即 resolved”口径完成线上状态回写
  - 线上反馈原文：`大杀四方  小妖精的泰坦效果没有触发  效果是触发有或者的效果时  一回合一次能两个效果全部触发   但我只能选择一个触发`
  - 当前仓库已有与该反馈直接同构的精确回归：`fairies_puck 在丛林之灵在场时会先执行已选分支，再给剩余分支与跳过`
  - 本轮已复跑并通过：`newFactionAbilities.test.ts` 的 `Puck + Spirit of the Forest` 聚焦回归，以及 `commandsValidation.test.ts` 的 Titan 额度守门回归
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 7`
  - 聚类更新为：`smashup|feedback-modal = 4`、`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
  - 最新快照已落盘：`temp/feedback-online/current-open-20260504-after-batch11.json`
- [x] `69f544f99ec13b96d710ae00` 已按“本地已修即 resolved”口径完成线上状态回写
  - 线上反馈原文：`为什么出现了选择反应，然后选择轮回者又没效果，然后之前还有选择名人堂和大法师结算顺序，有什么意义`
  - 线上当前权威态已显示《轮回者》最终确实埋进《名人堂》下方，且链路已收口；仓库现有 E2E 证据也明确说明《轮回者》打出后先进入 `smashup_reaction_choose` 再收口是当前真实语义
  - 关于《名人堂 + 大法师》的另一半诉求，仓库已有 `archmageE2E` 精确回归证明应自动收口，不弹无意义排序交互
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 6`
  - 聚类更新为：`smashup|feedback-modal = 3`、`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
  - 最新快照已落盘：`temp/feedback-online/current-open-20260504-after-batch12.json`
- [x] `69f387a35cacc4e6b5cdbd4c` 已按“本地已修即 resolved”口径完成线上状态回写
  - 线上反馈原文：`按效果我应该加2战力  而不是减2`
  - 线上当前权威态显示：`fairies_tinx` 当前控制者是 `0`，其身上的《雏菊花环 / Daisy Chain》拥有者是 `2`
  - 当前仓库中英文本地化文案与 `ongoing_modifiers.ts` 现有实现都明确要求：`ownerId === controller` 才是 `+2`，否则就是 `-2`
  - 本条不是“实现把正负号写反了”，而是用户把附着牌拥有者与当前随从控制者的关系看反了；本轮无需改代码
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 5`
  - 聚类更新为：`smashup|feedback-modal = 2`、`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
  - 最新快照已落盘：`temp/feedback-online/current-open-20260504-after-batch13.json`
- [x] `69f01fd49b68d90ee983669d` 已按“本地已修即 resolved”口径完成线上状态回写
  - 线上反馈原文：`没法选择打出斯芬克斯`
  - 线上当前权威态不是“系统没给可选目标”，而是已经进入 `titan_sphinx_start_turn` 真实交互；当前候选位点在基地下方埋葬牌区域，不是单独一个 “Sphinx” 按钮
  - 本轮已复跑并通过：`src/games/smashup/__tests__/smashup.smoke.test.ts` 中 `狮身人面像会在你的回合开始时创建回收埋葬牌并进场的交互|狮身人面像在其所在基地计分后会创建回收该基地埋葬牌的交互`
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 4`
  - 聚类更新为：`smashup|feedback-modal = 1`、`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
  - 最新快照已落盘：`temp/feedback-online/current-open-20260504-after-batch14.json`
- [x] `69f5469a9ec13b96d710ae26` 已按“本地已修即 resolved”口径完成线上状态回写
  - 线上反馈原文：`着魔没效果，目标随从没有附加行动卡`
  - 线上 action log 已直接记录多次《着魔》真实附着：`附加持续战术： 着魔 -> c24 / c6`
  - 当前终态看不到宿主身上仍挂着《着魔》，是因为链路已经继续推进到宿主与《着魔》都离场后的更后拍，不等于前面没有附着成功
  - 本轮已复跑并通过：`src/games/smashup/__tests__/newFactionAbilities.test.ts` 中 `world_champs_bewitched 离场转移交互可把持续行动从弃牌堆重新附着`
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 3`
  - 聚类更新为：`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
  - `smashup|feedback-modal` 已清零
  - 最新快照已落盘：`temp/feedback-online/current-open-20260504-after-batch15.json`
- [x] `69f471da9ec13b96d7109902`、`69f73be49ec13b96d710f1c2` 已按“本地已修即 resolved”口径完成线上状态回写
  - 两条都是同一类 DiceThrone watchdog 系统单：`force-end-turn-failed active-turn-legal-only:follow-up-advance:legal_action_unavailable`
  - 线上当前只剩 watchdog 聚合摘要，已无可继续复核的真实残局；当前 `occurrenceCount` 分别停在 `2563` 与 `2`
  - 本轮 fresh transport 聚焦回归已通过：
    - `DiceThrone 非战斗阶段遗留 displayOnly 奖励骰时，应直接代 AI 收口而不是放任残留`
    - `dicethrone: human main1 遗留 AI displayOnly pendingBonusDiceSettlement 时，watchdog 应直接替 AI 确认收口`
    - `online AI watchdog 在 pendingInteractionId 锁住 response window 时，应优先执行 hidden interaction 收口`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 1`
  - 聚类更新为：`splendor|online-ai-watchdog = 1`
  - 最新快照已落盘：`temp/feedback-online/current-open-20260504-after-batch16.json`
- [x] `69f6c4bc9ec13b96d710e10d` 已按“本地已修即 resolved”口径完成线上状态回写
  - 该条是本轮最早优先止血的 Splendor watchdog 聚合项：`force-end-turn-failed active-turn:follow-up-advance:command_failed`
  - 当前本地修复已明确覆盖：Splendor 不再生成裸 `ADVANCE_PHASE` fallback，且 manifest `localAi=false` 时 watchdog 会忽略残留 AI seat metadata
  - 本轮 fresh 聚焦回归已通过：
    - `Splendor 即使残留了 AI seat metadata，也不得生成裸 ADVANCE_PHASE fallback`
    - `online AI watchdog 对 manifest 明确禁用 AI 的 splendor 应忽略残留 seatControllers`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 0`
  - `inProgressTotal = 0`
  - 聚类已清空：`{}`
  - 最新快照已落盘：`temp/feedback-online/current-open-20260504-after-batch17.json`
- [x] 当前 `open` 反馈 20 条全部完成分类
- [x] 当前仍在刷新的 watchdog 问题完成止血
- [x] 用户反馈逐条修复、验证、留证并回写状态

## Phases

- [x] **Phase 0: 恢复线上反馈源**
  - [x] 读取生产环境入口与反馈规则
  - [x] 通过 SSH / 生产容器确认反馈源异常根因
  - [x] 恢复 `Mongo` 与 `/admin/feedback` 可读性
- [x] **Phase 1: 线上 open 盘面收敛**
  - [x] 拉取 `open / in_progress` 最新快照
  - [x] 生成去重后的问题簇与优先级
  - [x] 把“重复 watchdog 聚合项 / 真正用户反馈”拆开处理
- [ ] **Phase 2: 生产止血**
  - [x] 本地修复 `splendor` watchdog `command_failed` 死循环，避免再生成裸 `ADVANCE_PHASE`
  - [x] 本地验证 `dicethrone` watchdog `legal_action_unavailable` / 防御窗口链路主路径
  - [x] 本地验证 `smashup` watchdog `visible-interaction` 主路径
  - [x] 补齐 `smashup` transport 闭环测试，证明持久化 stale `smashup_reaction_choose` 不会再落成 `blocker_persisted`
  - [x] 为 `69f7ac9d...` 补 `reaction option` 去重与 stale special 正规化回归，锁定 `smashup_reaction_choose` 重复 special 候选不再原样外露
  - [x] 通过重启 `boardgame-game-server` 清掉生产 orphan room，确认 `splendor` 聚合项停止新增
  - [x] 评估并执行最小风险热补发布路径：在远端源码仓库同步 `engine/transport` 修复与最小依赖，借 `Node 24` 容器编出 `temp/prod-bundles/game/server.mjs`
  - [x] 将热补 bundle 覆盖到生产 `boardgame-game-server:/app/server.mjs` 并重启复核，确认 `/health` 正常且 `cWGQSaUXt1B` 不再继续刷日志
  - [x] 当前任务口径下已完成止血与反馈清盘；正式镜像发布路径保留为后续非阻塞事项
- [x] **Phase 3: 用户反馈逐条修复**
  - [x] Dice Throne `feedback-modal`
  - [x] Smash Up 2 条 `feedback-modal`
  - [x] 与 watchdog 重复描述的用户反馈合并验证，避免重复劳动
- [x] **Phase 4: 验证、证据、回写**
  - [x] 每个已修项补对应测试 / E2E / 证据文档
  - [x] 线上反馈状态回写为 `resolved` / `closed`
  - [x] 复查是否还有新增 `open` 项在继续产生

## Priority Queue

1. 当前 open / in_progress 已清零
   - 最新快照：`temp/feedback-online/post-20260504-resolved-batch-17-summary.json`
2. 若后续需要继续推进
   - 可把 Splendor 热补进一步收敛到正式镜像发布路径，但这不是本轮 `resolved=本地已修好` 口径的阻塞项

## Constraints

- 当前工作区已存在大量未提交改动，默认视为既有工作基线；修复线上反馈时不得回滚或覆盖这些改动。
- `C:\Users\zhuagenbao\.codex\.omx\ralph-loop.local.md` 当前被另一条长期任务占用；本任务改用仓库计划文件 + 独立 JSON state 持续推进，不抢占现有 loop。
- 当前工作区包含大量并行 dirty 改动；任何生产发布前都必须先确认不会把未验证的无关改动一并带上生产。

# Task Plan: Smash Up Oops 四派系接入与玩法实施

## Addendum（2026-04-07）：Android 本地素材包图片加载故障

### Goal
> 修复 App 端“素材包已下载但进入游戏后图片仍全部加载中”的问题，确保前端能在未走大厅包管理 hook 的情况下接住已安装游戏包，并且不会把 Android `/_capacitor_file_/...` 本地路径误套进开发态图片 fetch/blob workaround。

### Phase

- [x] **Phase A: 链路排查与根因确认**
  - [x] 复核原生安装目录、前端 asset override 注入点、MatchRoom 关键图片加载链路
  - [x] 确认启动期 hydration 会跳过“未预注册 fallbackState 的已安装包”
  - [x] 确认 `OptimizedImage` 会把 `/_capacitor_file_/...` 本地包路径误走开发态 `fetch -> blob` workaround

- [x] **Phase B: 修复与回归**
  - [x] 修复 `hydrateInstalledNativeGamePackages()` 对已安装包的兜底 hydration
  - [x] 收窄 `OptimizedImage` 的 blob-fetch workaround，只保留开发态 public `/assets/...`
  - [x] 补定向测试并完成 eslint / vitest 校验

## Goal
> 分两阶段完成 Smash Up `Oops, You Did It Again` 四个派系（埃及、牛仔、武士、维京人）的完整交付：先完成图片 intake、可复刻工作流与静态接入；再按 `Ancient Egyptians → Vikings → Cowboys → Samurai` 的顺序逐派系实施正式玩法、补齐 UI、新交互类型 E2E、统一审计与证据留档。

## Phases

- [x] **Phase 1: 发现与设计（intake）**
  - [x] 阅读 AGENTS、OpenSpec、资产/录入/测试/审计规范
  - [x] 创建独立 worktree 与任务分支
  - [x] 盘点现有 Smash Up 图片接入链路、脚本、数据结构与目标素材
  - [x] 创建 OpenSpec proposal/tasks/design/spec delta

- [x] **Phase 2: 资产处理与录入（intake）**
  - [x] 锁定权威来源与图片清单，建立 Markdown 核对契约
  - [x] 完成图片压缩、图集/切片配置与资源落盘
  - [x] 完成 i18n / 静态数据 / atlas / faction metadata 的同步录入
  - [x] 沉淀“给一批图片即可录入”的复刻工作流文档

- [x] **Phase 3: 审计与验证（intake）**
  - [x] 对照描述、资源路径、加载链路做 intake 审计
  - [x] 运行相关 Vitest / 审计脚本
  - [x] 编写并运行相关 E2E，用截图留证
  - [x] 汇总 evidence、结果与残留风险

- [x] **Phase 4: 玩法提案与实施设计（gameplay）**
  - [x] 创建 `add-smashup-oops-faction-gameplay` OpenSpec 变更
  - [x] 明确用户要求的实施顺序：逐派系实现，全部完成后统一审计与 E2E
  - [x] 将 bury UI 与新交互类型纳入正式 scope
  - [x] 运行 `openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive`
  - [x] 等待用户确认 proposal 后进入 `Ancient Egyptians`

- [x] **Phase 5: Ancient Egyptians**
  - [x] 补齐 card defs 元数据与 `abilityTags`
  - [x] 实现埋葬、翻开、替代去向与相关 base/action/minion ability
  - [x] 补齐 owner-visible bury UI 与对手隐藏占位
  - [x] 补领域测试与统一 E2E 证据收口

- [x] **Phase 6: Vikings**
  - [x] 按官方规则书 / Fandom 口径修正 defs、locale 与 ability metadata
  - [x] 实现 deck-top / discard / steal / extra-action 联动与相关基地能力
  - [x] 补领域测试并完成增量门禁验证
  - [x] 统一 E2E 与更严格语义收口已在四派系统一审计阶段完成

- [x] **Phase 7: Cowboys**
  - [x] 实现官方 duel 内核、move / destroy / ongoing draw 与相关 metadata
  - [x] 补决斗/目标选择最小交互断言
  - [x] 补完整 duel 浏览器 E2E 与证据收口

- [x] **Phase 8: Samurai**
  - [x] 按官方规则书 / Fandom 口径修正 defs、locale 与 ability metadata
  - [x] 实现 honor / duel / destroy / temporary-buff / ongoing draw 与相关基地能力
  - [x] Samurai 专项浏览器 E2E、临时触发精细语义与更严格审计已在统一审计阶段完成

- [x] **Phase 9: 统一审计与收尾**
  - [x] 四派系完成后再统一做 gameplay 审计
  - [x] 运行相关 Vitest / typecheck / OpenSpec 校验
  - [x] 运行覆盖新交互类型的 E2E 并留证
  - [x] 汇总最终 evidence、残留风险与后续扩展点

## Technical Decisions
| Decision | Rationale | Status |
| :--- | :--- | :--- |
| 使用独立 worktree `feat/smashup-base-faction-assets` | 根工作区已有并行任务与规划文件，隔离当前任务避免串改 | Approved |
| 使用 OpenSpec + planning-with-files 双轨记录 | 本次既要落地实现，也要沉淀可复刻流程和验收证据 | Approved |
| 以用户提供图片作为当前任务的直接权威来源 | 符合数据录入规范第 3 优先级，可直接用于资源与索引录入 | Approved |
| Smash Up 规则文本与审计必须走 Wiki 爬虫 | 项目专用强制规范，不能只凭图片或记忆录入 | Approved |
| 本轮 scope 以 intake/静态接入为准 | 用户要求整条资源接入链路，但 OpenSpec 已收束为图片、atlas、静态数据、文档、测试、E2E；不在本 change 内补完四派系完整 gameplay ability | Approved |
| `aiji.png` 按 `7x7`、`aiji_base.png` 按 `2x4` row-major 切片 | 已通过直接看图确认 48 张卡 + 1 尾格、8 张基地；后续 atlas/index 以此为唯一切片基准 | Approved |
| 武士基地 defId 使用 canonical 英文名，图面英文差异写入证据文档 | 图面为 `Kyuden Konbini / Sakura Shigemi`，TTS / Wiki canonical 为 `Shogun's Palace / Sakura Garden`；运行时名称与来源说明必须分离 | Approved |
| 先完整录入 locale 文本，再最小化卡牌结构标签 | 为避免把“未实现玩法”误录成“已实现 ability”，本轮卡牌 defs 仅承载图片、数量、力量、所属派系与最小结构，详细文本放入 locale | Approved |
| gameplay 以独立 OpenSpec change 推进，而不与 intake 混写 | intake 已完成并可单独验收；玩法补完涉及新交互类型、UI 与审计范围，必须单独建模 | Approved |
| gameplay 实施顺序固定为 `Ancient Egyptians → Vikings → Cowboys → Samurai` | 先打通 bury 主链路与 UI，再做 duel / movement / replacement，更容易收敛和审计 | Approved |
| bury UI 必须纳入 Ancient Egyptians 第一波范围 | 用户已指出吸血鬼 pod 时 bury 体系只有领域逻辑，没有正式 UI；若继续只做逻辑会重复留下未完成实现 | Approved |

## Critical Errors / Blockers
| Error | Impact | Resolution |
| :--- | :--- | :--- |
| 根工作区 `task_plan.md/findings.md/progress.md` 已服务其他任务 | 不能在原工作区继续维护本次计划 | 新建独立 worktree 承载本任务 |

## Addendum（2026-04-22）：lane-S2R SmashUp 卡牌效果/文本偏差反馈修复

### Goal
> 核对并最小修复 7 条线上 human open 反馈：世界冠军/美人鱼效果、436-1337工厂计分、疯狂山脉抽牌、缅怀先祖、天守阁决斗、武士进弃牌堆加攻击力链路；补测试、运行验证，并产出 vidence/smashup/2026-04-22 逐条证据。

### Phase
- [x] Phase A: 读取规范、锁权威基线与现有实现
- [x] Phase B: 最小修复反馈相关实现与文本
- [x] Phase C: 补现有测试文件中的回归用例并运行验证
- [x] Phase D: 写 evidence/smashup/2026-04-22 逐条结论与最终汇报

### 2026-04-30 复核结论
- 本 Addendum 实际已完成，原未勾选属于 planning 回填遗漏，不再代表“仍未做完”。
- 对应证据并非只落在单一 `evidence/smashup/2026-04-22/*` 路径，而是分布在：
  - `evidence/feedback-closeout/smashup-human-open14-closeout-2026-04-22.md`
  - `evidence/smashup/smashup-feedback-69e61a97-world-champs-card-index-fix-2026-04-25.md`
  - `evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md`
  - `evidence/smashup/smashup-10th-anniversary-final-closeout-20260419.md`
- 其中 `69e61a97` 旧关闭结论曾在 2026-04-25 被判定失效，但同日已按“世界冠军 cards7 图集索引错位”根因重新修复并补齐新证据；截至 2026-04-30，lane-S2R 范围内 7 条反馈已具备重新收口依据。

### Scope Control
- 只改 SmashUp 反馈相关文件和 evidence。
- 不触碰当前工作区已有的非本轮改动；已发现 src/games/smashup/domain/index.ts 与 src/games/smashup/__tests__/smashup.smoke.test.ts 存在他人改动，本轮除非必要不修改。

## Addendum（2026-04-22）：SmashUp 10 周年三派系审计复审

### Goal
> 持续验证 `mermaids / skeletons / world_champs` 三派系在当前主线上的实现稳定性，并补齐审计维度（D1-D49）与横幅统一样式证据，确保“实施中”文案与样式收敛后无回归。

### Phase
- [x] 复跑三派系能力与审计门禁（newFactionAbilities + 4 个 audit suite）
- [x] 复跑三派系统一斜向横幅 E2E 并更新截图证据
- [x] 删除中英文 locale 里的 `faction_implementation_in_progress_hint`，只保留“实施中”主文案
- [x] 在 `evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md` 补齐 D1-D49 维度
- [x] 按“配置直通 / 新机制 / 新 UI-E2E”补齐主回归文件三派系能力覆盖缺口（静态比对为 0）
- [x] 回写通用 workflow：新增 `targetType: 'generic'` 双登记门禁（实现 + 审计理由）避免后续派系重复踩坑
- [x] 2026-04-24 再次复跑并同步最新口径：`newFactionAbilities = 168 passed / 1 skipped`、4 审计套件全绿、`smashup.e2e.ts = 3 passed`、横幅截图时间更新为 `2026-04-24 09:08`
- [x] 2026-04-24 追加静态覆盖复核：`registerAbility` 对照 `newFactionAbilities.test.ts`，三派系总计 `40` 条能力、缺口 `0`
- [x] 2026-04-24 复跑 OpenSpec + R2 回查：`openspec validate add-smashup-oops-faction-gameplay` 通过，`wangling.webp / wangling_base.webp` HEAD 均为 `200`
- [x] 2026-04-24 强化通用工作流：更新 `.windsurf/skills/data-entry-workflow/SKILL.md` 与 `docs/games/smashup/workflows/smashup-faction-implementation.md`，新增“长期任务连续执行”强制规则
- [x] 2026-04-24 同步两条 watchdog 反馈审计文档复核补记（`69db57c`、`69daa51e`），与主线 E2E `3 passed` 口径对齐
- [x] 2026-04-24 同步 Android 内置 SmashUp locale：删除 `faction_implementation_in_progress_hint`，并复跑 `assets:upload`（上传 `0` / 跳过 `530` / 失败 `0`）
- [x] 2026-04-25 完成两条 watchdog 反馈定向 E2E 复测：`69db57c` 1 条、`69daa51e` 2 条，均通过并回写证据截图路径
- [x] 2026-04-25 修订 `mermaids_toll_bay` 审计口径：旧“触发窗口标记”结论失效，按卡面语义统一为“即时抽牌”；`newFactionAbilities` 为 `170 passed / 1 skipped`，并复跑 4 审计套件 + i18n + `smashup.e2e.ts` 全绿
- [x] 2026-04-25 补跑 `smashup.smoke.test.ts`（`121 passed`）确认三派系修复未引入主流程烟测回归
- [x] 2026-04-25 追加全量 SmashUp 回归（`146 files passed / 9 skipped`，`1962 passed / 19 skipped`）与 R2 二次 HEAD 复核（`wangling.webp` / `wangling_base.webp` 均 `200`）
- [x] 2026-04-25 修复“巨石阵附着天赋二次发动”回归：`USE_TALENT(ongoingCardUid)` 补巨石阵双才能例外，复跑 `talentAbilities(22 passed)`、`smashup-gameplay.e2e(7 passed)`、`smashup.e2e(3 passed)`、`newFactionAbilities(174 passed/1 skipped)`、`smoke(121 passed)`、4 审计套件（`36 passed`）与 `i18n:check` 全绿
- [x] 2026-04-25 去重 `talentAbilities` 重复新增 case 并全链路复跑：`talentAbilities(20 passed)`、`newFactionAbilities(179 passed/1 skipped)`、`smoke(122 passed)`、`smashup-gameplay.e2e(7 passed)`、`smashup.e2e(3 passed)`、4 审计套件（`36 passed`）与 `i18n:check` 全绿
- [x] 2026-04-25 补齐数据录入基操脚本：`scrape-wiki-with-descriptions.mjs` 纳入 `skeletons/mermaids/world_champs`，`final-wiki-code-comparison.mjs` 补单双引号与弯直引号归一化并声明“仅校验 name/count”；复核 `skeletons` 抓取 `12/20`、对比 `1 正确/0 问题`、脚本 `eslint` 全绿
- [x] 2026-04-29 补《快如闪电 / 女主角 / 阿拉密斯》联合反应窗 L3，并回写旧“女主角实现正确”结论失效：根因确认为 `smashup_reaction_choose` 双 reduce + `Aramis` 触发范围缺口，补齐 `finalState / triggerQueue / reaction session / 真实入口 E2E` 审计维度
- [x] 2026-04-29 补《人鱼女王 / 安静的海岸》L3：把 `Mermaids` 的“模式选择 / 场上持续牌天赋迁移”从 L2 扩到浏览器级真实入口，并同步回写累计对象证据口径
- [x] 2026-04-29 补《塞壬的歌声 / 他们出来了》L3：把 `Mermaids` 的“来源基地过滤 + 逐段移动”与 `Skeletons` 的“选基地后多张挖掘”补到浏览器级真实入口，并显式修掉一次 E2E 场景误用不存在 card def 的低级错误
- [x] 2026-04-29 补《墓园》L3：把 `Skeletons` 的“场上持续牌天赋 -> 挖掘 -> 可选 +1 指示物”从 L2 扩到浏览器级真实入口，并同步回写累计对象证据口径
- [x] 2026-04-29 补《骸骨之王》L3：把 `Skeletons` 的“场上 minion 天赋 -> 挖掘这里任意埋葬牌 -> 先经 reaction session 再进 +1 后续交互”从 L2 扩到浏览器级真实入口，并同步回写累计对象证据口径
- [x] 2026-04-29 回写长期任务 / 派系重审 workflow 门禁：把“批量派系重审批次清单”“E2E 场景 defId 预检”“L0-L4 分层验收”“reaction session 抽样门禁”补进 `.windsurf/skills/data-entry-workflow/SKILL.md`、`docs/games/smashup/workflows/smashup-faction-implementation.md`、`docs/ai-rules/testing-audit.md`
- [x] 2026-04-30 收口《墓地爆发》L3，并修复 `scoreBases` 交互事件在 reduce 前被提前计分的时序缺口；定向 E2E `1 passed`，回归 Vitest `2 passed`
- [x] 2026-04-30 补《塞壬 / 诱惑者 / 无人岛》L3，并修复 `BaseZone` 分数徽章绕过 `getPlayerEffectivePowerOnBase(...)` 的 UI 口径缺口；3 条定向 E2E、`ongoingModifiers` 聚焦回归 `6 passed`、`typecheck` 全绿
- [x] 2026-04-30 补《武士 陈》正路径 L3，并收口 `World Champs` 最后一个对象级冻结点；定向 E2E `1 passed`，聚焦 Vitest `2 passed`

### Current Remaining Batch（强制继续，未清空前不得按“收口”停下）
- [x] 明确枚举 `World Champs / 世界冠军` 剩余未到发布级门禁的对象/链路，补到对象级 L3 或明确降级理由
- [x] 明确枚举 `Skeletons / 骷髅` 剩余未到发布级门禁的对象/链路，补到对象级 L3 或明确降级理由
- [x] 对三派系当前已补对象做一轮“卡图口径 vs UI真实出口 vs reaction session”交叉抽检，防止再出现“领域对 / UI错”型漏审
- [x] 回写总审计文档里所有仍写着泛化“已完成专项审计与回归验证”的旧高层口径，避免旧结论继续误导
- [x] 只有当上面 4 项全部勾完，且总审计文档的“仍有残余范围”被逐条消解或显式冻结，才允许进入最终收口汇报


## Addendum（2026-04-22）：线上 Dicethrone critical 反馈收口补强（69c3c83e / 69cba605）

### Goal
> 对 `69c3c83e`（黑屏）与 `69cba605`（骰面不可见）做当前代码基线复核；对仍存在前端兜底缺口的骰面链路做最小修复并补回归证据。

### Phase
- [x] Phase A: 复核反馈上下文与当前实现入口
- [x] Phase B: 最小修复 `Dice3D` 无 sprite 可见性兜底
- [x] Phase C: 补现有测试断言并运行验证
- [x] Phase D: 产出 evidence 文档并回填 planning 文件

### Scope Control
- 仅修改 `src/games/dicethrone/ui/Dice3D.tsx` 与对应现有测试文件。
- 黑屏链路仅做兼容修复有效性复核，不引入额外架构改动。

## Addendum（2026-04-26）：SmashUp 三派系审计续跑（_pod alias + 横幅复核）

### Goal
> 继续执行三派系审计批次：修复 `_pod` alias 审计误报，对齐 Mermaid 新语义断言，并复核统一斜向“实施中”横幅链路是否持续稳定。

### Phase
- [x] 修复 `interactionCompletenessAudit` 的 `_pod` alias 孤儿误报
- [x] 对齐 `Mermaids` 争议用例语义并复跑 `newFactionAbilities`
- [x] 复跑四项审计套件 + i18n 门禁
- [x] 复测横幅 E2E 并完成截图核图
- [x] 继续补齐 `World Champs` 关键链路 L3（`斗志奖杯`、`鼠、鸟与香肠`）并回写专项证据
- [x] 收敛 `smashup.e2e.ts` 中“3 人房座位状态”join 超时稳定性（`3 人房`用例增加 `test.setTimeout(120000)`，复跑 `smashup.e2e.ts` 全绿）
- [x] 收敛全量 `src/games/smashup` 回归失败簇（afterScoring/onDestroy/validation 共 14 条，已收敛为 0）
- [x] 修复 `bear_cavalry_bear_necessities` 交互 stale 目标兜底，并对齐新旧测试语义（“随从或行动卡”）
- [x] 收敛横幅 E2E 的服务就绪抖动：`ensureGameServerAvailable` 改为 45s 轮询，避免误判 skip
- [x] 2026-04-29 补《沉船湾 / 轮回者 / 诡异。可怕。 / 墓碑》L3，并回写两类场景错误：`轮回者` 的旧“直接无交互”假设失效；`沉船湾 / 墓碑` 的旧在线场景未满足计分阈值，根因属于 E2E 注入错误而非实现错误

## 2026-05-05 Follow-up
- [x] 复核当前线上人类 open 反馈并锁定主故障为房间加入失败
- [x] 确认生产 game-server 仍跑旧 join 协议（join 强制要求 playerID）
- [x] 使用生产部署脚本更新 latest 镜像并完成生产 create/claim-seat/join 复测
- [x] 将 69f86b739ec13b96d71107d4 / 69f86c159ec13b96d7110804 按证据链回写为 resolved，并同步 status-board
- [x] 锁定 Android `AppUpdate` 缺插件对应的正式原生壳版本：`0.5.0`（以及更早壳）；首个确认带 `AppUpdatePlugin` 的正式包为 `0.5.1.apk`
- [ ] 视发布窗口决定是否将 Android AppUpdate 缺插件兜底补丁随下一次正式发布带上生产

## Addendum（2026-05-05）：SmashUp 并列计分口径修复
- 用户给出的当前产品口径：`大杀四方战斗力相等时，应取第二位/更低位分，不取并列名次的高位分`。
- 已定位根因：`src/games/smashup/domain/index.ts` 的 `buildBaseRankings()` 之前按“并列沿用当前 rankSlot”发分，导致并列第一仍拿第一位分、并列第二仍拿第二位分。
- 已落修复：改为按并列组占据的最低名次发分（例如并列第一拿第二位分，并列第二拿第三位分）。
- 一致性补充：同步修正 `src/games/smashup/ai.ts` 的基地 VP 估值逻辑，避免 AI 仍按旧口径评估。
- 已补测试：`src/games/smashup/__tests__/baseScoring.test.ts`
  - `scoreOneBase 在并列第一时给并列玩家第二位分`
  - `scoreOneBase 在并列第二时给并列玩家第三位分`
- 已验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/baseScoring.test.ts --configLoader native --maxWorkers 1`
  - `npm run typecheck`

## Addendum（2026-05-05 23:35 +08）：人类反馈优先续跑

### Goal
> 按“人类反馈优先”新口径，先收敛 SmashUp 剩余 3 条人工反馈：并列计分、熊泰坦额外随从、多人观战异常。

### Phase
- [x] 把 `人类反馈 > 系统自动反馈` 回写到 `.windsurf/skills/feedback-closeout/SKILL.md` 与本计划
- [x] `69f96a734590ce09779a7205` 并列计分：确认本地已修并复跑定向回归
- [x] `69f9623c4590ce09779a715f` 熊的泰坦不能用额外随从打出：完成共享修复与回归
- [x] `69f961ca4590ce09779a715a` 多人观战有 bug 看不了其他人：完成多视角修复、真实 E2E 与收口截图

### Notes
- `69f9623c4590ce09779a715f` 的共享根因已确认不是熊专属逻辑，而是 `smashup_immediate_extra_minion` 候选只枚举手牌随从，没有纳入 `playAsKinds=['minion']` 的 `setaside` 泰坦。
- `69f961ca4590ce09779a715a` 的真实根因已收敛到 `SmashUpBoard` 的二元视角模型：旧实现只能在“自己 / 第一个对手”之间切换，多人局无法点谁看谁。
- 本轮新增本地收口证据：
  - `evidence/smashup/smashup-feedback-69f96a734590ce09779a7205-tied-base-scoring-local-closeout-2026-05-05.md`
  - `evidence/smashup/smashup-feedback-69f9623c4590ce09779a715f-extra-minion-titan-local-closeout-2026-05-05.md`
  - `evidence/smashup/smashup-feedback-69f961ca4590ce09779a715a-multi-opponent-view-local-closeout-2026-05-05.md`
- 本地状态板当前还是旧 `remote-human-unresolved-20260421-163730.json` 衍生快照，这 3 条新人工反馈尚未进入板子；在拿到最新 human summary 或正式远端写入口前，不伪造状态板条目。

## Addendum（2026-05-06 07:42 +08）：SmashUp 三条人工反馈正式状态回写

- [x] 核对 HTTP 反馈接口当前不可作为正式写入口：`GET /feedback/open?...` 返回 `404`
- [x] 通过生产 `feedbacks` 集合直连确认 3 条目标反馈回写前均为 `open`
- [x] 已把 `69f96a734590ce09779a7205 / 69f9623c4590ce09779a715f / 69f961ca4590ce09779a715a` 正式回写为 `resolved`
- [x] 已把本地 `temp/feedback-closeout/status-board.json` 同步补入并校验通过
- [x] 线上人类未收口反馈最终已清零；最后两条 `69fa23e04590ce09779a7c52 / 69fa0bd74590ce09779a7bd6` 已在后续批次完成正式回写

## Addendum（2026-05-06 08:10 +08）：SmashUp 最后两条人工反馈回写与人类未收口清零

- [x] 继续沿用 `人类反馈 > 系统自动反馈` 口径处理最后两条 `smashup|feedback-modal`
- [x] `69fa23e04590ce09779a7c52` 已按“已修未回写”回写为 `resolved`
- [x] `69fa0bd74590ce09779a7bd6` 已按“非 bug / 规则符合”回写为 `closed`
- [x] 本地 `status-board.json` 已与这两条最终状态对齐，并通过 `feedback-status: ok`
- [x] 已通过生产 `feedbacks` 复核：`reporterType=user && status in [open,in_progress]` 当前 `count=0`

### Notes

- 正式证据文档：
  - `evidence/feedback-closeout/smashup-human-final-two-writeback-2026-05-06.md`
- 关键快照：
  - `temp/feedback-closeout/query-feedback-69fa23e0-69fa0bd7-before-writeback-20260506.raw.txt`
  - `temp/feedback-closeout/update-feedback-status-20260506-smashup-human-remaining-two.raw.txt`
  - `temp/feedback-closeout/query-feedback-69fa23e0-69fa0bd7-after-writeback-20260506.raw.txt`
  - `temp/feedback-closeout/query-human-open-inprogress-after-final-writeback-20260506.raw.txt`

## Addendum（2026-05-07 00:20 +08）：SmashUp 新人工反馈 `69faac614590ce09779a7d8f` 宗教圆环发不了效果

- [x] 重新核对线上真源，确认当前人类反馈新增 1 条 `smashup|feedback-modal`
- [x] 锁定目标反馈：`69faac614590ce09779a7d8f`，原文 `宗教圆环发不了效果`
- [x] 结合生产快照与用户截图定位到前端根因，不是领域校验失败
  - 新补 E2E 首轮直接卡在点击 `[data-ongoing-uid="oa-sacred-circle"]`
  - Playwright 明确报错为透明 `absolute inset-0 z-60` 层拦截点击
- [x] 已做最小修复
  - `src/games/smashup/ui/BaseZone.tsx`
  - `e2e/src/games/smashup/ui/BaseZone.tsx`
  - 桌面端基地 ongoing 放大镜包裹层改为 `pointer-events-none`
- [x] 已补最小 UI 复现
  - `e2e/smashup/smashup-base-minion-selection.e2e.ts`
  - 场景覆盖：点击《宗教圆环》 -> 进入已用态 -> 选择手牌《本地人》 -> 成功打到巫师学院
- [x] 已完成本地 E2E 收口并补证据
  - `evidence/smashup/smashup-feedback-69faac614590ce09779a7d8f-sacred-circle-click-fix-e2e-2026-05-07.md`
- [x] 已按 2026-05-07 新口径补充 workflow：反馈只要完成修复验证，就应立刻回写远端正式状态，不再默认停在本地 resolved
- [x] 已完成远端反馈状态回写与生产复核
  - `temp/feedback-closeout/query-feedback-69faac61-before-writeback-20260507.raw.txt`
  - `temp/feedback-closeout/update-feedback-status-20260507-69faac61-to-resolved.raw.txt`
  - `temp/feedback-closeout/query-feedback-69faac61-after-writeback-20260507.raw.txt`
  - `temp/feedback-closeout/query-human-open-inprogress-after-20260507.raw.txt`
  - 线上 `reporterType=user && status in [open,in_progress]` 当前 `count=0`
- [x] 全量线上反馈已清零
  - `temp/feedback-closeout/update-feedback-status-20260507-final-watchdog-batch.raw.txt`
  - `temp/feedback-closeout/query-all-open-inprogress-after-final-watchdog-batch-20260507.raw.txt`
  - `temp/feedback-closeout/query-all-open-inprogress-current-20260507.raw.txt`
  - 截至 `2026-05-07 21:25 +08`，生产真源 `open/in_progress = 0`
  - 本轮最后 `21` 条 watchdog 系统单已完成正式回写：`resolved = 9`、`closed = 12`
  - 当前可以正式宣称“线上人类反馈已清零，系统反馈也已清零，所有反馈都已修好”

## Addendum（2026-05-07 21:25 +08）：最后 21 条 watchdog 系统反馈正式清零

- [x] 生产真源回写前盘面核对完成
  - 回写前真实待清批次是 `21` 条，另有 `69fb3fde... / 69fc6298...` 已在本轮更早一拍单独回写
  - 这 `21` 条全部来自 `reporterType=system`、`source=online-ai-watchdog`
- [x] 判定口径已落地
  - `force-end-turn-failed ...` 与 `unsatisfiable-interaction-auto-skipped empty-options` 按 `resolved`
  - `force-end-turn-success ...` 按 `closed`
- [x] 最后一批生产正式回写完成
  - 回写时间：`2026-05-07 21:08:22 +08`
  - 回写结果：`resolved.matchedCount=9 / modifiedCount=9`，`closed.matchedCount=12 / modifiedCount=12`
- [x] 本地状态板已同步补入并准备校验
  - `temp/feedback-closeout/status-board.json`
- [x] 最终复核已确认线上全量清零
  - `temp/feedback-closeout/query-all-open-inprogress-current-20260507.raw.txt`
  - 截至 `2026-05-07 21:25 +08`：`totalOpenOrInProgress=0`、`humanOpen=0`

## Addendum（2026-05-07 21:52 +08）：`69fc6298` 短暂重开后再次清零

- [x] `69fc62984a37805e1526f6d9` 在生产真源短暂回到 `open`
  - fresh 生产直查结果：`totalOpenOrInProgress=1`、`humanOpen=0`
- [x] 复核同局 `bSJjqanl8rO` 的日志后确认这是同一系统聚合项的再刷
  - watchdog 已继续把局面从 `scoreBases -> draw -> playCards` 推进收口
  - 这条仍按失败类系统单回写 `resolved`
- [x] 生产再次回写成功
  - `matchedCount=1 / modifiedCount=1`
  - 目标：`69fc62984a37805e1526f6d9`
- [x] 最新复核再次确认全量清零
  - `totalOpenOrInProgress=0`
  - `humanOpen=0`
  - 当前最终口径仍是“所有反馈已清零”

## Addendum（2026-05-07 22:00 +08）：fresh 生产直查仍为全量清零

- [x] 最新生产直查结果
  - `ts=2026-05-07T14:00:21.653Z`
  - `totalOpenOrInProgress=0`
  - `humanOpen=0`
- [x] 当前最终口径再次确认不变
  - 线上人类反馈已清零
  - 系统 watchdog 反馈已清零
  - 所有反馈已清零

## Addendum（2026-05-09 23:58 +08）：新一批人工反馈继续处理

- [x] 生产 Mongo 重新拉取人工 open/in_progress
  - 截至 `2026-05-09 20:40:30 +08`：8 条人工未收口。
  - 本地状态板：`temp/feedback-closeout/status-board.json` 已补入新批次。
- [x] 优先修复 3 条 SmashUp critical 扩展基地反馈
  - `69feca4bf0a61f28ba015d7e`：印斯茅斯弃牌区为空时无法发动/跳过。
  - `69fecbb9f0a61f28ba015d9e`：印斯茅斯效果触发不了。
  - `69fec94df0a61f28ba015d49`：温室无法执行。
  - 根因：queued reaction 执行器 effect contract 缺少 `controllerState`，运行时读取 `state.players.*` 时抛错。
- [x] 已补修复与验证
  - `src/games/smashup/domain/baseAbilities_expansion.ts`
  - `src/games/smashup/__tests__/expansionBaseAbilities.test.ts`
  - 证据：`evidence/smashup/smashup-feedback-20260509-expansion-base-effect-contract.md`
- [x] 已回写 3 条生产反馈为 `resolved`
  - `69fec94df0a61f28ba015d49` 本轮脚本实际 `matched=1 / modified=1`
  - `69feca4bf0a61f28ba015d7e`、`69fecbb9f0a61f28ba015d9e` 回写前已是 `resolved`
- [x] 已修复 `69feac13f0a61f28ba015c93` 巫师空牌库抽牌/揭示反馈
  - `wizard_neophyte` 空牌库走 `peekDeckTop`，POD 学徒可先洗弃牌堆再揭示。
  - `wizard_enchantress`、`wizard_mystic_studies`、`wizard_sacrifice` 改走 `buildStandardDrawEvents`，避免空牌库时只记录抽牌但最终手牌未增加。
  - 验证：`factionAbilities.test.ts -t "69feac13"` 3 passed；整文件 46 passed；eslint 0 errors。
  - 证据：`evidence/smashup/smashup-wizard-neophyte-empty-deck-feedback-2026-05-09.md`
- [x] 已回写 `69feac13f0a61f28ba015c93` 生产反馈为 `resolved` 并复查剩余未收口数量
- [x] 已修复并回写 `69feede0f0a61f28ba0163df` 泰坦场下询问反馈
  - 根因：`werewolves_great_wolf_spirit` 的 `onTurnStart` 被错误登记为 `global`，场下 setaside 泰坦也会被 `collectTriggers()` 放入 reaction queue。
  - 修复：移除巨狼之灵 `global` 触发注册，删除重复注册块，同步 `e2e/src` 镜像。
  - 验证：`turnCycle -t 线上反馈 69feede0` 1 passed；`smashup.smoke -t Great Wolf Spirit creates a start-of-turn move interaction` 1 passed；eslint 0 errors。
  - 证据：`evidence/smashup/smashup-great-wolf-spirit-setaside-feedback-2026-05-09.md`
  - 生产回写：`matched=1 / modified=1`
- [x] 最新生产剩余人工/反馈弹窗队列已重新拉取并同步状态板
  - 截至 `2026-05-10 02:55 +08`：`remainingHumanOrModalOpenInProgress.count = 5`
  - 新增两条：`69ff7291f0a61f28ba0189b9` 实验工坊有bug；`69ff720cf0a61f28ba01897d` 非常多bug，海盗的bug很多。
- [x] 继续处理剩余 5 条：Cardia 教程、SmashUp AI/卡住、实验工坊、海盗反馈等。
- [x] 已修复并回写 `69ff7291f0a61f28ba0189b9` 实验工坊反馈
  - 根因：实验工坊/同类基地把“本回合该基地已打出随从次数”放在 queued trigger 执行期读取，并声明 `playLimits`，与大法师写 `playLimits` 误判为强制触发排序冲突。
  - 修复：基地能力支持 `canTrigger` 入队前预筛；实验工坊/集会场/名人堂不再在 queued 执行期读取出牌计数字段，避免残留 `triggerQueue` 或弹无意义排序窗口。
  - 验证：`archmageE2E` 聚焦 `69ff7291` 1 passed，整文件 9 passed；`newBaseAbilities` 实验工坊/集会场 7 passed；`expansionBaseAbilities` 名人堂 1 passed；eslint 0 errors。
  - 证据：`evidence/smashup/smashup-laboratorium-archmage-feedback-2026-05-09.md`
  - 生产 Mongo 回写：`matchedCount=1 / modifiedCount=1`；回写后剩余人工/反馈弹窗 open/in_progress 为 4 条。
- [x] 已补充 `69ff7291f0a61f28ba0189b9` 旧生产持久化队列兼容复核
  - 发现：生产快照中的 `base_laboratorium` trigger 已持久化旧 `effectContract.reads`，需要证明旧局也能恢复。
  - 补充：`reactionOrdering` 物化排序 contract 时兼容旧版实验工坊/集会场首随从基地触发；新增旧队列回归。
  - 验证：生产快照只读灌入 `maybeResolveReactionQueue` 后 `triggerQueueLength=0 / currentInteractionSourceId=null / archmagePowerCounters=1 / actionLimit=2`；`newBaseAbilities` 59 passed；`reactionQueueOrdering` 18 passed。
  - 证据已修订：`evidence/smashup/smashup-laboratorium-archmage-feedback-2026-05-09.md`
- [x] 已回写 `69ff720cf0a61f28ba01897d` 海盗泛反馈为同根因 `resolved`
  - 现场：用户描述泛称海盗 bug，但快照实际为 `robot_hoverbot` 打到 `base_laboratorium` 后残留旧实验工坊 trigger。
  - 验证：生产快照只读灌入 `maybeResolveReactionQueue` 后 `triggerQueueLength=0 / currentInteractionSourceId=null / hoverbotPowerCounters=1 / consumedEvents=1`。
  - 证据：`evidence/smashup/smashup-laboratorium-archmage-feedback-2026-05-09.md`
  - 生产 Mongo 回写：`matchedCount=1 / modifiedCount=1`；fresh 后剩余人工/反馈弹窗 open/in_progress 为 3 条。

## Addendum（2026-05-10 05:36 +08）：5/10 本批人工反馈清零

- [x] 剩余 3 条人工/反馈弹窗 open 已全部收口并回写生产 Mongo。
  - `69ff0e90f0a61f28ba016a4d` Cardia 教程反馈：`resolved`，证据 `evidence/cardia/cardia-tutorial-full-flow-e2e-test.md`
  - `69ff0cd0f0a61f28ba0169e9` SmashUp AI 出牌阶段卡死：`resolved`，回写产物 `temp/feedback-closeout/update-feedback-status-20260510-69ff0cd0-ai-playcards-stalled-to-resolved.raw.txt`，`matched=1 / modified=1`
  - `69ff0310f0a61f28ba0167d6` SmashUp 天选之人确认交互卡住：`resolved`，回写产物 `temp/feedback-closeout/update-feedback-status-20260510-69ff0310-cthulhu-chosen-confirm-to-resolved.raw.txt`，`matched=1 / modified=1`
- [x] 已补齐 69ff0310 浏览器 UI 证据链。
  - E2E：`npm run test:e2e:ci:file -- e2e/smashup/smashup-cthulhu.e2e.ts "线上反馈 69ff0310：旧天选之人确认交互应显示按钮弹层并可关闭"` -> `1 passed`
  - 截图 1：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-cthulhu.e2e\线上反馈-69ff0310：旧天选之人确认交互应显示按钮弹层并可关闭\69ff0310-chosen-confirm-button-overlay.png`
  - 截图 2：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-cthulhu.e2e\线上反馈-69ff0310：旧天选之人确认交互应显示按钮弹层并可关闭\69ff0310-chosen-confirm-after-no.png`
- [x] 已补充 69ff0cd0 最新回归验证。
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts --configLoader native --maxWorkers 1 -t "69ff0cd0|base_the_mothership"` -> `6 passed`
- [x] 本地状态板已更新并通过校验。
  - `node scripts/verify/verify-feedback-status.mjs temp/feedback-closeout/status-board.json` -> `feedback-status: ok`
- [x] fresh 生产真源清零核对完成。
  - 查询产物：`temp/feedback-closeout/query-open-human-final-20260510.raw.txt`
  - 截至 `2026-05-10 05:35 +08`，生产 Mongo 人工/feedback-modal `open/in_progress`：`count=0`

## Addendum（2026-05-12 08:38 +08）：shayu 第一入口直接消费专项重审

- [x] 承认并修正审计缺口：此前全量矩阵偏静态，没有强制检查“payload/UI 已确定第一入口后 handler 是否直接消费”。
- [x] 通用规范补强：`docs/ai-rules/testing-audit.md` 新增“第一入口已确定时不得二次创建同 targetType prompt”的最低门禁。
- [x] 专项全量清单已落地：`evidence/smashup/smashup-shayu-entry-consumption-audit-2026-05-12.md` 覆盖 39 卡 + 6 基地的入口来源、第一入口、handler 消费结论与证据等级。
- [x] 已修复 3 个本轮发现项：宙斯的恩惠二次 base prompt、卷走二次 minion prompt、不在堪萨斯替换后误触发新基地 onActionPlayed。
- [x] 已补 L2 验证：新增 `shayuEntryConsumption.test.ts`，并更新 `shayuFactionAbilities.test.ts` 的卷走真实入口用例。
- [ ] 未完成/不得宣称：本轮追加复跑 3 条高风险真实入口 E2E；仍不能宣称 45 对象逐项 L3 E2E；Argonaut 跨派系 action-trigger 泛化仍是后续专项。


## Addendum（2026-05-12 08:46 +08）：shayu 高风险入口 E2E 复跑

- [x] 已修正 `e2e/smashup-shayu-factions.e2e.ts` 中 `tornados_carried_away` 旧流程：不再等待二次 minion prompt，直接等待 `tornados_carried_away_dest` 目标基地 prompt。
- [x] 已复跑 3 条真实入口 E2E：Carried Away 真实手牌入口、Not in Kansas 基地替换、Tornado Alley 首次/二次移入。
- [x] 已实际打开截图核对，并回写 `evidence/smashup/smashup-shayu-entry-consumption-audit-2026-05-12.md`。
- [ ] 仍不得宣称：这不是 45 对象逐项 L3 E2E，只是高风险入口链追加 L3。

## Addendum（2026-05-12）：审计默认口径升级为全面审计

- [x] 已更新 `docs/ai-rules/testing-audit.md`：未限定的“审计”默认等于全面审计；抽样/专项/L1 必须显式标注，不得简称“已审计”。
- [x] 已建立 shayu 全面审计 guard：`temp/smashup-shayu-comprehensive-audit-2026-05-12.json`。
- [x] 已建立 45 对象覆盖矩阵：`evidence/smashup/smashup-shayu-comprehensive-audit-coverage-2026-05-12.md`。
- [ ] 当前仍未完成：全量 L2、全交互 L3、全部时序/窗口/队列 L4 还要继续补。


## Addendum（2026-05-12 22:50 +08）：shayu 全面审计 L2 补强批次

- [x] 扩展 `src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` 到 12 条 L2 行为测试。
- [x] 新增覆盖：`sharks_chum`、`base_the_deep`、`mythic_greeks_favor_of_hades`、`base_trailer_park`、`base_tornado_alley`。
- [x] 验证：`npx vitest run src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` → 12 passed；`npx eslint src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` → 0 errors。
- [x] 已回写 comprehensive coverage 矩阵与 guard evidence。
- [ ] 仍未完成：C3 45 对象逐行 L2 核销、C4 全交互 L3/代表链、C5 全时序/窗口/队列 L4、C6 旧 evidence 全部降级回写。


## Addendum（2026-05-12 23:50 +08）：L3 真实入口补强批次

- 已补强并实际看图核对 2 条高风险 E2E：
  - Sharks：大白鲨结算辅助、飞鲨真实入口、激光束真实入口。
  - Mythic Greeks / Tornados：哈迪斯、宙斯、雅典娜、信风真实入口。
- 本批新截图与肉眼结论已回写总入口：`evidence/smashup/smashup-shayu-comprehensive-audit-coverage-2026-05-12.md`。
- 重要限定：`sharks_great_white` 这次仍由 test harness dispatch 触发天赋，只能算结算辅助证据，不算完整真实 UI 天赋入口 L3。
- 当前可升级为 L3 的对象：`sharks_air_jaws`、`sharks_freakin_laser_beam`、`mythic_greeks_favor_of_hades`、`mythic_greeks_favor_of_zeus`、`mythic_greeks_favor_of_athena`、`tornados_trade_winds`。
- 当前仍不得宣称全面审计完成：45 对象全量 L2 核销、全部 L3 代表链、全部 L4 时序治理仍未完成。


### 2026-05-13 00:03 +08 全文件 E2E 回归补充

- 补跑整文件：`$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; npm run test:e2e:ci -- e2e/smashup-shayu-factions.e2e.ts` → 14 passed。
- 说明：第一次整文件复跑被同类 E2E heavy-task guard 拦截；确认使用隔离 runtime 后显式允许并发并通过。
- 该结果证明 `e2e/smashup-shayu-factions.e2e.ts` 当前 14 条代表性真实入口/时序链没有被本轮测试修正破坏；仍不等于 45 对象全量 L3/L4 完成。


## Addendum（2026-05-13 00:16 +08）：C3 全量 L2 核销

- 新增 `tornados_twister` 旋风 push/pull L2 行为测试。
- `shayuComprehensiveBehavior.test.ts` 当前 13 passed；`npx eslint src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` 0 errors。
- 已在全面审计总入口逐对象写清 45/45 的 L2 行为证据来源；C3 可标 pass。
- 仍未完成：C4 全交互 L3/代表链截图归档、C5 全部时序/窗口/队列 L4、C6 最终修复/旧 evidence 全量回写。


## Addendum（2026-05-13 00:55 +08）：全面审计 C4/C5/C6 回写

- 总入口仍是 `evidence/smashup/smashup-shayu-comprehensive-audit-coverage-2026-05-12.md`。
- `sharks_great_white` 已重新用真实 UI 点击随从触发天赋，旧“仅 harness 辅助”结论失效。
- C4 已逐对象归档：所有真实 UI 交互入口均为独立 L3 或等价代表链；无用户入口对象显式标记 C4 不适用。
- C5 已逐家族归档：beforeScoring、afterScoring、base replace、once/turn、action-trigger、base trigger、destroy trigger、multi/order/continuationContext 均有 L4 或系统代表链证据。
- C6 已完成回写；最终是否 COMPLETE 以 `temp/smashup-shayu-comprehensive-audit-2026-05-12.json` 与 guard 检查为准。


## 2026-05-13 01:03 +08 最终回归验证

- `npx eslint e2e/smashup-shayu-factions.e2e.ts src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` → 0 errors。
- `npx vitest run src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` → 13 passed。
- `$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; npm run test:e2e:ci -- e2e/smashup-shayu-factions.e2e.ts` → 14 passed。
- 本轮实际核对截图包括：
  - `D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Sharks-高风险链覆盖大白鲨天赋结算、飞鲨与激光束真实入口\shayu-sharks-great-white-talent-destination-open.png`
  - `D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Sharks-高风险链覆盖大白鲨天赋结算、飞鲨与激光束真实入口\shayu-sharks-great-white-after-move-destroy.png`
  - `D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-随风而逝从-afterScoring-窗口打出并让随从逃离清场\shayu-tornados-gone-with-the-wind-after-scoring-open.png`
  - `D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornado-Alley-基地能力在本回合首次移入时触发，第二次移入不重复触发\shayu-tornado-alley-trigger-open.png`

## Addendum（2026-05-15 08:13 +08）：Twister 后 shayu 完整技能流程再审计

- [x] 已建立并完成 post-Twister 防早停 guard：`temp/smashup-shayu-post-twister-loop-2026-05-15.json`。
- [x] 已新增完整技能流程矩阵：`evidence/smashup/smashup-shayu-post-twister-complete-flow-audit-2026-05-15.md`，覆盖 Sharks 12 + Tornados 12 + Mythic Greeks 15 + shayu 基地 6，共 45 对象。
- [x] 已把 Twister 反馈新增的不变量应用回全集：凡“你可以 / 至多 / 任意数量”必须有拒绝/空选证据，或明确说明可选性由激活入口承载。
- [x] 已完成 3 条不同机制家族全链路抽查：Twister 可选跳过、Athena/Trade Winds 多步链、Gone with the Wind afterScoring 链。
- [x] 本轮未发现新的实现错误；因此没有触发 Twister 可选否定路径之外的新规范升级。
- [ ] 未执行提交、push、部署，也未把生产反馈状态改为 resolved。

## Addendum（2026-05-16 14:15 +08）：afterScoring skip 历史治理

- [x] `mothership-scout-afterscore-bug.test.ts` 不再是 `describe.skip`；已重写为 3 条当前规则下的可运行行为回归。
- [x] 新回归覆盖：母舰 + 侦察兵、母舰 + 两侦察兵 + 大副、巫师学院 + 侦察兵，均通过真实 `ADVANCE_PHASE` / prompt facade / 最终状态断言验证。
- [x] 删除过期历史文件：`miskatonic-scout-afterscore.test.ts`（当前密大基地是 `onMinionPlayed`，不是 afterScoring）与 `wizard-academy-scout-afterscore.test.ts`（已合并进可运行链式回归）。
- [x] `audit-d1-base-tortuga.test.ts` 的 `data.options` / `playerId` 裸读已迁到 prompt facade。
- [x] 验证：母舰链单文件 3 passed；Tortuga audit 专用配置 7 passed；eslint 0 errors；`npm run test:structure` OK。
- [x] 全 `src/games/smashup/__tests__` skip 扫描 0 命中；内部 prompt 结构 broad scan 只剩 `helpers.ts` 这一层。

## Addendum（2026-05-16 14:25 +08）：旧泛名 ongoing 文件继续拆分

- [x] 从 `newOngoingAbilities.test.ts` 迁出 Bear Cavalry 保护/触发簇到 `abilities/bear-cavalry.test.ts`，15 tests passed。
- [x] 从 `newOngoingAbilities.test.ts` 迁出 Dinosaurs `dino_upgrade` / `dino_tooth_and_claw` 簇到 `abilities/dinosaurs.test.ts`，3 tests passed。
- [x] 从 `newOngoingAbilities.test.ts` 迁出 Cthulhu `cthulhu_altar` / `cthulhu_furthering_the_cause` 簇到 `abilities/cthulhu.test.ts`，7 tests passed。
- [x] `newOngoingAbilities.test.ts` 从 126 条降到 101 条，复跑 101 passed。
- [x] 迁出文件 + 源文件 eslint 0 errors；`npm run test:structure` OK。
- [ ] `test:structure` 仍警告 `newOngoingAbilities.test.ts` 与 `newBaseAbilities.test.ts` 是旧泛名债务；后续继续按能力/基地簇迁出。

## Addendum（2026-05-16 14:46 +08）：继续拆 `newOngoingAbilities`，避免只改表象

- [x] 从 `newOngoingAbilities.test.ts` 迁出完整 Killer Plants 簇到 `abilities/killer-plants.test.ts`。
  - 覆盖 `killer_plant_overgrowth` / POD、`killer_plant_entangled`、`killer_plant_venus_man_trap`、`killer_plant_budding`、`killer_plant_deep_roots`、`killer_plant_choking_vines`。
  - 迁出时把 `killer_plant_budding` 从裸读 `result.matchState.sys.interaction.current` 改为 `getSimpleChoicePrompt` / `getPromptSourceId` / `getPromptTargetType` facade。
  - 新文件验证：18 tests passed。
- [x] 从 `newOngoingAbilities.test.ts` 迁出 Elder Things ongoing / onPlay 簇到 `abilities/elder-things-ongoing.test.ts`。
  - 覆盖 `elder_thing_dunwich_horror`、`elder_thing_the_price_of_power`、`elder_thing_elder_thing` 保护与 onPlay prompt、`elder_thing_shoggoth` 打出限制与 onPlay prompt。
  - 新文件验证：16 tests passed。
- [x] `newOngoingAbilities.test.ts` 已从 101 条继续降到 67 条，使用 `NODE_OPTIONS=--max-old-space-size=4096` 复跑 67 passed。
- [x] `npx eslint` 针对 `abilities/killer-plants.test.ts`、`abilities/elder-things-ongoing.test.ts` 与 `newOngoingAbilities.test.ts` 0 errors。
- [x] `npm run test:structure` OK。
- [ ] `test:structure` 仍警告 `newOngoingAbilities.test.ts` / `newBaseAbilities.test.ts` 是旧泛名债务；该任务仍未完成，后续继续迁出 Pirates / Ancient Egyptians / Bases 等剩余簇。

## Addendum（2026-05-16 14:58 +08）：继续迁出 Cthulhu/Madness 与 Bear Cavalry POD

- [x] 迁出 Cthulhu / Madness 剩余簇到 `abilities/cthulhu.test.ts`。
  - 新增覆盖：`cthulhu_chosen` beforeScoring、`cthulhu_complete_the_ritual`、`special_madness` onPlay、疯狂卡 VP 统计。
  - `cthulhu_chosen` 的有 `matchState` 用例已从“只检查 matchState 存在”强化为检查 `cthulhu_chosen_confirm` prompt source/target。
  - 验证：`abilities/cthulhu.test.ts` 20 tests passed。
- [x] 迁出 Bear Cavalry POD 尾部簇到 `abilities/bear-cavalry.test.ts`。
  - 新增覆盖：`bear_necessities_pod` 限制、`superiority_pod` protect/draw、`bear_rides_you_pod` 新基地压制候选项。
  - 验证：`abilities/bear-cavalry.test.ts` 21 tests passed。
- [x] `newOngoingAbilities.test.ts` 已继续降到 48 tests，复跑 48 passed。
- [x] 相关文件 eslint 0 errors；`npm run test:structure` OK；业务测试裸 prompt seam 扫描无命中。
- [ ] 剩余旧泛名债务：`newOngoingAbilities.test.ts` 还剩 Pirates / Alien Jammed Signal / BASE_REPLACED / Bases / Frankenstein / Vampires；`newBaseAbilities.test.ts` 尚未开始拆。

## Addendum（2026-05-16 15:03 +08）：迁出 Frankenstein / Vampires 剩余簇

- [x] 迁出 `frankenstein_igor` 基地结算弃置触发簇到 `abilities/frankenstein.test.ts`。
  - 覆盖非 Igor 不触发、Igor/POD 自身被弃、同基地候选、多个候选 prompt、giant_ant_drone 不误触发。
  - 验证：`abilities/frankenstein.test.ts` 11 tests passed。
- [x] 迁出 `vampire_buffet afterScoring` 到 `abilities/vampires.test.ts`。
  - 覆盖赢家获得全场己方 +1 指示物、非赢家不触发加指示物。
  - 验证：`abilities/vampires.test.ts` 8 tests passed。
- [x] `newOngoingAbilities.test.ts` 已继续降到 40 tests，复跑 40 passed。
- [x] 相关文件 eslint 0 errors；`npm run test:structure` OK；业务测试裸 prompt seam 扫描无命中。
- [ ] 剩余旧泛名债务：`newOngoingAbilities.test.ts` 还剩 Pirates / Alien Jammed Signal / BASE_REPLACED / Ancient Egyptians / Bases；`newBaseAbilities.test.ts` 尚未开始拆。

## Addendum（2026-05-16 15:20 +08）：清空并删除 `newOngoingAbilities`

- [x] 迁出 Pirates ongoing 簇到 `abilities/pirates-ongoing.test.ts`，验证 19 tests passed。
- [x] 迁出 `alien_jammed_signal` 基地能力压制到 `abilities/aliens.test.ts`，验证 2 tests passed。
- [x] 迁出 `ancient_egyptians_plague_of_locusts` onPlay prompt 到 `abilities/ancient-egyptians.test.ts`，验证 1 test passed。
- [x] 迁出 `BASE_REPLACED` keepCards / scoring 标记 / titan 离场合同到 `bases/base-replacement.test.ts`，验证 4 tests passed。
- [x] 迁出 Haunted House / R'lyeh / Mountains of Madness / Homeworld / Mothership / Ninja Dojo 基地交互到 `bases/interaction-base-abilities.test.ts`，验证 14 tests passed。
- [x] 迁出时把多条 `getInteractionHandler(...)` 直调改为“触发基地能力 -> prompt facade 找 option -> `respondToPrompt` 响应 -> 断言目标业务事件”，避免测试继续绑定 handler 参数签名。
- [x] 删除旧泛名文件 `src/games/smashup/__tests__/newOngoingAbilities.test.ts`。
- [x] 组合验证：4 个新迁出文件 21 tests passed；`npx eslint` 针对 4 个新文件 0 errors；`npm run test:structure` OK。
- [x] `rg` 扫描确认 `newOngoingAbilities` 引用、业务测试裸 prompt seam 与 skip 模式在 `src/games/smashup/__tests__`（排除 helper 层）无命中。
- [x] `newBaseAbilities.test.ts` 已移入 `bases/base-ability-contracts.test.ts`，根级 `new*` 旧入口退出；移动后 60 tests passed，eslint 0 errors。
- [x] `npm run test:structure` 当前 OK 且无旧泛名 warning。
- [x] 全目录扫描确认 `newOngoingAbilities` / `newBaseAbilities` 引用、skip、业务测试裸 prompt seam 在 `src/games/smashup/__tests__`（排除 helper 层）无命中。
- [x] `bases/base-ability-contracts.test.ts` 继续拆分并删除，旧 2705 行集合文件不再存在。
- [x] 现有基地合同覆盖按簇拆为 `base-core-effects.test.ts`、`base-scoring-effects.test.ts`、`ancient-egyptian-bases.test.ts`、`first-minion-bases.test.ts`、`optional-trigger-bases.test.ts`、`vikings-bases.test.ts`、`cowboys-bases.test.ts`、`samurai-bases.test.ts`，共享夹具收敛到 `base-contract-helpers.ts`。
- [x] 验证：拆分后的 8 个新基地文件 60 tests passed；整个 `src/games/smashup/__tests__/bases` 目录 15 files / 101 tests passed；相关 eslint 0 errors；`npm run test:structure` OK。
- [x] `samurai-bases.test.ts` 继续拆为 `samurai-shoguns-palace-bases.test.ts`、`samurai-sakura-garden-bases.test.ts` 与 `pod-base-reuse.test.ts`，旧 707 行文件不再存在。
- [x] 当前 `src/games/smashup/__tests__/bases` 最大测试文件为 `base-core-effects.test.ts`（约 556 行），不再有 700+ 或 2700 行级别基地集合文件。
- [ ] 后续质量债：`base-core-effects.test.ts` 仍是相对较大的基础效果文件，但已按核心基地效果主题收敛；后续新增场景应优先继续拆分，不回退到集合文件。

## Addendum（2026-05-16 16:25 +08）：Field of Honor / Crypt 消灭管线 seam 收敛

- [x] 复核用户“是不是只改表象”的质疑后，继续审计 `field-of-honor-base.test.ts`：该文件混合了基础基地合同、FAQ batch、真实 `robot_microbot_guard` 命令链和缺 `destroyerId` 管线兜底，不能只用“单一基地对象”理由保留在一起。
- [x] 新增 `resolveDestroyedMinions` / `makeMinionDestroyedEvent` 到 `bases/base-contract-helpers.ts`，把 `processDestroyTriggers` reducer 细节收进测试 facade；业务测试只表达“这些随从被消灭，由当前玩家结算”。
- [x] 拆出 `field-of-honor-destroy-processing.test.ts`，保留 `field-of-honor-base.test.ts` 只覆盖 `base_the_field_of_honor` 自身 `onMinionDestroyed` 合同。
- [x] 同类 `crypt-base-effects.test.ts` 已改走 `resolveDestroyedMinions`，避免 Field of Honor 收敛后 Crypt 仍裸调 reducer。
- [x] 验证：Field/Crypt 聚焦组合 3 files / 10 tests passed；相关 eslint 0 errors；`bases` 业务测试旧 seam 扫描 0 命中；`npm run test:structure` OK。
- [x] 分批低并发验证 `bases/*.ts`：27 个业务测试文件均已跑过，合计 77 tests passed。期间一次 Vite/esbuild transform 服务退出，单独复跑 Sakura 两文件后 6 tests passed；不计作业务失败。
- [ ] 后续质量债：`bases/base-contract-helpers.ts` 仍重导出低层 `processDestroyTriggers` 以兼容目录外旧测试；后续应按能力/派系测试逐步迁到语义 helper，再考虑移除该出口。

## Addendum（2026-05-16 16:40 +08）：消灭后处理 reducer seam 收到全局 helper

- [x] 不再只处理 `bases` 目录：把通用 `src/games/smashup/__tests__/helpers.ts` 也补上 `makeMinionDestroyedEvent` / `resolveDestroyedMinions`，让目录外能力与 smoke 测试可通过稳定语义端口表达“这些随从被消灭，由当前玩家结算”。
- [x] 已迁移目录外 `processDestroyTriggers` 裸调用：`abilities/giant-ants.test.ts`、`giantAntsPod.test.ts`、`abilities/samurai.test.ts`、`abilities/princesses.test.ts`、`igor-double-trigger-bug.test.ts`、`madMonsterPartyPreventedDestroy.test.ts`、`baseProtection.test.ts`、`igor-ondestroy-idempotency.test.ts`、`onDestroyAbilities.test.ts`、`smashup.smoke.test.ts`。
- [x] 最新扫描确认业务测试不再直连 `processDestroyTriggers(`；允许剩余仅在 helper 层：`src/games/smashup/__tests__/helpers.ts` 与 `src/games/smashup/__tests__/bases/base-contract-helpers.ts`。
- [x] 验证：`onDestroyAbilities.test.ts` 14 tests passed；`smashup.smoke.test.ts` 133 tests passed；相关 eslint 0 errors；`npm run test:structure` OK。
- [ ] 后续质量债：`processAffectTriggers` / `processMoveTriggers` / `processReturnToHandTriggers` 等同类后处理入口仍需分类审计；当前命中集中在 `reactionQueueOrdering.test.ts` 与 `smashup.smoke.test.ts`。不能机械清零，优先把普通业务测试迁到语义 helper，底层系统合同测试可保留低层断言。

## Addendum（2026-05-16 16:50 +08）：move/affect/return 后处理业务 seam 收到 helper

- [x] `helpers.ts` 新增 `makeMinionMovedEvent` / `resolveMovedMinions` / `resolveAffectedMinions` / `resolveCardsReturnedToHand`，让普通业务测试按“移动/受影响/回手”语义表达后处理，而不是直接调 reducer 内部函数。
- [x] `smashup.smoke.test.ts` 中硕大圆石移动触发、漫游山岭巨人控制变化后 affect 触发、时间盒子弃牌回手触发均已改走上述 facade。
- [x] 最新扫描确认 `processMoveTriggers(` / `processAffectTriggers(` / `processReturnToHandTriggers(` 的业务 smoke 命中已清零；剩余 4 处全部在 `reactionQueueOrdering.test.ts`，该文件显式验证 frameId/sourceEventId 后处理合同，暂作为有意底层例外保留。
- [x] 验证：`smashup.smoke.test.ts` 133 tests passed；`reactionQueueOrdering.test.ts` 26 tests passed；helper/smoke eslint 0 errors；`npm run test:structure` OK。
- [x] `processDeckInspectionTriggers(` 已审计：唯一命中在 `reactionQueueOrdering.test.ts`，直接断言 deck-inspected 的 `sourceEventId` / `frameId`，属于底层后处理合同例外，不迁移到业务 facade。
- [ ] 后续质量债：当前 `process*Triggers(` 普通业务测试裸调已清零；剩余命中是 helper 层与 `reactionQueueOrdering.test.ts` 后处理合同测试。下一步应转向其他高频耦合形态，例如业务测试裸读 `sys.interaction.current` / `queue` / `data.options`，而不是继续追求后处理入口扫描全清零。

## Addendum（2026-05-16 16:58 +08）：`smashup.smoke` prompt seam 收敛

- [x] `smashup.smoke.test.ts` 继续清理同一批泰坦链路中的裸 prompt 读取：六足死神 special、硕大圆石 move prompt、后续 destroy prompt 已改为 `getSimpleChoicePrompt` / `getOptionalSimpleChoicePrompt` / `getPromptSourceId` / `getPromptPlayerId` / `getPromptHandlerData`。
- [x] 最新扫描确认 `smashup.smoke.test.ts` 内 `sys.interaction.current` / `sys.interaction.queue` / `data.options` / `asSimpleChoice(` 目标模式 0 命中。
- [x] 验证：`smashup.smoke.test.ts` 133 tests passed；`npx eslint` 针对 `helpers.ts` 与 `smashup.smoke.test.ts` 0 errors；`npm run test:structure` checked files: 89，OK。
- [ ] 后续质量债：全 `src/games/smashup/__tests__` 仍有少量裸 prompt 状态读写，下一步应按文件语义分批处理，优先普通业务测试，系统 prompt 合同测试单独分类。

## Addendum（2026-05-16 17:02 +08）：`scoreBases-auto-continue` 局部 sourceId seam

- [x] `scoreBases-auto-continue.test.ts` 中 Hoverbot stale top 用例不再裸读 `played.finalState.sys.interaction.current.data.sourceId`，改为 `getSimpleChoicePrompt(..., 'robot_hoverbot')` + `getPromptSourceId`。
- [x] 验证：精准用例 `盘旋机器人揭示的牌已不再位于牌库顶时，AI 应只保留 skip，不再尝试 stale play` 1 passed；该文件 eslint 0 errors。
- [ ] 保留 `resolved.state.sys.interaction?.current === undefined` 原断言：它只证明 current 清空，不等价于 queue 也为空；本轮不机械升级为 `expectNoPrompt`，避免改变测试合同。

## Addendum（2026-05-16 17:05 +08）：afterScoring response window 交互存在断言收敛

- [x] `afterscoring-response-window-execution.test.ts` 两处 `state.sys.interaction?.queue?.length > 0 || !!state.sys.interaction?.current` 已改为 `getSimpleChoicePrompt(state)`，保持“创建了交互”语义但隐藏 current/queue 存储位置。
- [x] 验证：精准用例名 `我们乃最强` 跑过 2 passed / 2 skipped；该文件 eslint 0 errors；目标裸 prompt 扫描 0 命中；`npm run test:structure` checked files: 97，OK（仅既有 `e2e/dicethrone/legacy-root` 警告）。
- [ ] 全文件直接跑曾触发 Node memory allocation 失败；当前以精准用例验证本轮改动，不把全文件 OOM 当业务失败或通过。

## Addendum（2026-05-16 17:14 +08）：`turnCycle` 无 prompt 断言收敛

- [x] `turnCycle.test.ts` 中 `endTurn 无冲突 trigger 会自动收口` 用例从 `sys.interaction.current === undefined` 改为文件内既有 `expectNoPrompt(...)`，该文件其他用例已使用同一语义，属于等价收敛。
- [x] 验证：精准用例 `endTurn 无冲突 trigger 会自动收口` 1 passed / 21 skipped；该文件 eslint 0 errors；`turnCycle.test.ts` 目标裸 prompt 扫描 0 命中。
- [ ] 全文件直接跑曾触发 Node OOM；当前以精准用例验证本轮改动。

## Addendum（2026-05-16 17:18 +08）：`baseAbilityIntegrationE2E` 无 prompt 断言收敛

- [x] `baseAbilityIntegrationE2E.test.ts` 两处 `sys.interaction.current === undefined` 已改为 `expectNoPrompt`；其中 `maybeResolveReactionQueue` 可能返回 `undefined` 的用例保留原可选语义，只在返回 state 时检查无 prompt。
- [x] 验证：精准匹配 `base_innsmouth_base|实验工坊` 跑过 3 passed / 20 skipped；该文件 eslint 0 errors；目标裸 prompt 扫描 0 命中。

## Addendum（2026-05-16 17:20 +08）：`igor-two-igors-one-destroyed` prompt 数量断言收敛

- [x] `igor-two-igors-one-destroyed.test.ts` 的 `sys.interaction.queue.length === 0` 已改为 `getPromptsBySourceId(..., 'frankenstein_igor')` 长度为 1；测试目标从“queue 容器为空”回到“只触发一个 Igor prompt”。
- [x] 验证：单文件 1 test passed；该文件 eslint 0 errors；目标裸 prompt 扫描 0 命中。

## Addendum（2026-05-16 17:30 +08）：普通业务测试 prompt 内部 seam 阶段性清零

- [x] `multi-base-afterscoring-bug.test.ts` 的计分链收口断言从 `sys.interaction.current/queue` 改为 `expectNoPrompt(finalState)`；该文件仍验证阶段、VP、基地替换和大副移动结果，不再绑定 InteractionSystem 存储形状。
- [x] `helpers.ts` 新增 `withoutQueuedPrompts` / `withOnlyCurrentPrompt`，把“构造只有当前 prompt、无队列 prompt 的边界状态”收进测试 facade；`afterscoring-window-skip-base-clear.test.ts` 不再手写 `state.sys.interaction.queue = []`。
- [x] `scoreBases-auto-continue.test.ts` 中持久化 stale special 收口用例改为 `withoutQueuedPrompts(withoutCurrentPrompt(...))` 构造运行态，并以 `expectNoPrompt` 断言收口结果。
- [x] `promptSystem.test.ts` / `promptResponseChain.test.ts` 删除已被 `expectNoPrompt` 覆盖的冗余 `queue === []` 内部断言。
- [x] 最新扫描确认 `src/games/smashup/__tests__` 普通测试内 `sys.interaction.current` / `sys.interaction.queue` / `data.options` / `asSimpleChoice(` 目标模式已清零；剩余命中仅为 `bases/base-contract-helpers.ts` helper 层和 `reactionQueueOrdering.test.ts` 后处理系统合同。
- [x] 验证：`multi-base-afterscoring-bug.test.ts` 8 tests passed；`afterscoring-window-skip-base-clear.test.ts` 15 tests passed；`promptSystem.test.ts` + `promptResponseChain.test.ts` 22 tests passed；`scoreBases-auto-continue.test.ts` 精准用例 1 passed / 35 skipped；相关 eslint 0 errors；`npm run test:structure` checked files: 102，OK（仅既有 legacy-root 警告）。
- [ ] 后续质量债：下一轮不应继续追求 scan 数字绝对清零，而应转向“可运行测试是否仍直接依赖 reducer/handler/private data”的逐类审计；底层合同测试需保留低层断言但应持续与普通业务测试分层。

## Addendum（2026-05-16 17:35 +08）：prompt options 外壳读取收敛

- [x] `afterScoring-rescoring.test.ts` 的本地 `findOptionId` / `findQueuedTriggerOptionId` 从 `choice.options` 改为 `getPromptOptions(choice)`，保留同一业务链路和错误信息。
- [x] `specialInteractionChain.test.ts` 的 `findOption`、Laseratops POD 目标枚举、Cthulhu Chosen generic 按钮断言均改走 `getPromptOptions`。
- [x] `interactionChainE2E.test.ts` 中 Alien Invasion 受 action 保护过滤断言、`trickster_block_the_path_pod` 派系组合枚举改走 `getPromptOptions`。
- [x] 最新扫描确认 `src/games/smashup/__tests__` 普通测试内 `choice.options` / `prompt.options` / `data.options` / `asSimpleChoice(` 目标模式 0 命中。
- [x] 验证：`afterScoring-rescoring.test.ts` 8 tests passed；`specialInteractionChain.test.ts` 24 tests passed；`interactionChainE2E.test.ts` 精准用例 2 passed / 53 skipped；相关 eslint 0 errors；`npm run test:structure` checked files: 104，OK（仅既有 legacy-root 警告）。
- [ ] 后续质量债：`getInteractionHandler(...)` 直调仍大量存在，下一步应按“注册表合同测试 / handler 单元测试 / 可替换为真实命令链的业务测试”分层治理，不能一刀切删除。

## Addendum（2026-05-16 17:40 +08）：`baseAbilitiesPrompt` handler 参数签名收拢

- [x] `baseAbilitiesPrompt.test.ts` 新增本地 `resolvePromptAgainstCore(...)`，把 `getInteractionHandler(sourceId)`、`getPromptHandlerData(prompt)`、随机数和 handler 参数顺序集中到一个 facade。
- [x] 文件内 7 处 stale prompt 回归用例不再分别手写 handler 名与 handler 调用参数；测试体只表达“用当前 prompt 在指定 core 上解析这个选择”。
- [x] 最新扫描确认 `baseAbilitiesPrompt.test.ts` 内 `getInteractionHandler(` 只剩本地 facade 一处，`getPromptHandlerData(` 只剩 facade 与一处显式检查 continuationContext 的合同断言。
- [x] 验证：`baseAbilitiesPrompt.test.ts` 33 tests passed；该文件 eslint 0 errors；`npm run test:structure` checked files: 104，OK（仅既有 legacy-root 警告）。
- [ ] 后续质量债：该文件仍是 handler-level stale 防护测试，不宜直接宣称已变成完整黑盒 E2E；下一步应继续区分哪些 handler 测试可升级为真实命令链，哪些应作为低层合同保留。

## Addendum（2026-05-16 17:45 +08）：注册 handler 响应 facade 上提到共享 helper

- [x] `helpers.ts` 新增 `resolvePromptViaRegisteredHandler(...)`，集中处理 prompt sourceId -> registered handler、prompt playerId、handler data、random 和 timestamp 参数。
- [x] `baseAbilitiesPrompt.test.ts` 改用共享 `resolvePromptViaRegisteredHandler`，删除本地 `resolvePromptAgainstCore`，避免同类 helper 在不同文件继续复制。
- [x] `reactionQueueDestroyerId.test.ts` 中两处 `smashup_reaction_choose` 直调改为 `resolvePromptViaRegisteredHandler`；测试仍验证 vampire POD prompt 的 `displayCard` 语义。
- [x] 最新扫描确认上述两个业务测试文件内不再直接出现 `getInteractionHandler(`；注册表访问只在 `helpers.ts` 的共享 facade 一处。
- [x] 验证：`baseAbilitiesPrompt.test.ts` + `reactionQueueDestroyerId.test.ts` 2 files / 35 tests passed；相关 eslint 0 errors；`npm run test:structure` checked files: 104，OK（仅既有 legacy-root 警告）。
- [ ] 后续质量债：剩余 `getInteractionHandler` 命中应优先迁到 `resolvePromptViaRegisteredHandler`，但注册表本身的合同测试与无 prompt 对象的低层 handler 单元测试仍需保留或单独封装。

## Addendum（2026-05-16 17:50 +08）：reaction queue prompt handler 响应收敛

- [x] `reactionQueueBaseAbilities.test.ts`、`reactionQueueBaseOptionalClockwise.test.ts`、`reactionQueueOrdering.test.ts` 中已有 prompt 对象的 `smashup_reaction_choose` handler 直调已改为 `resolvePromptViaRegisteredHandler`。
- [x] 保留 `reactionQueueOrdering.test.ts` 中 `processMoveTriggers` / `processAffectTriggers` / `processDeckInspectionTriggers` 低层后处理合同；本轮只收 prompt handler 参数 seam，不掩盖 frameId/sourceEventId 合同测试目的。
- [x] 最新扫描确认上述 3 个 reaction queue 文件不再散落 `getInteractionHandler(` / `getPromptHandlerData(` 直调；只保留 `resolvePromptViaRegisteredHandler` 调用。
- [x] 验证：3 files / 34 tests passed；相关 eslint 0 errors；`npm run test:structure` checked files: 107，OK（仅既有 legacy-root 警告）。
- [ ] 后续质量债：继续处理其他“已有 prompt 对象”的 handler 直调；对无 prompt 对象的 handler 边界测试，优先新建/复用更明确的 handler-level facade，而不是强行命令链化。

## Addendum（2026-05-16 17:55 +08）：Cthulhu / Elder Thing prompt handler 响应收敛

- [x] `abilities/cthulhu.test.ts` 中 `special_madness` 两条 prompt 响应用 `resolvePromptViaRegisteredHandler` 替换 handler 直调；仍保留 `displayCard` 合同断言。
- [x] `elderThingAbilities.test.ts` 中 `elder_thing_mi_go` 的“对手抽疯狂卡 / 拒绝后施法者抽牌”两条 prompt 响应用共享 helper 替换 handler 直调。
- [x] 最新扫描确认两个文件内不再出现 `getInteractionHandler(`；`getPromptHandlerData(` 只剩 `cthulhu.test.ts` 中验证 prompt displayCard 的合同断言。
- [x] 验证：直接 Vitest 入口 2 files / 45 tests passed；相关 eslint 0 errors；`npm run test:structure` checked files: 109，OK（仅既有 legacy-root 警告）。曾有一次 `vitest-cli-safe` spawn 检测失败，随后用直接 Vitest CLI 入口完成验证。
- [ ] 后续质量债：继续迁移小文件中明确已有 prompt 的 handler 响应；大文件如 `smashup.smoke.test.ts` 应分簇处理，避免一次性大改。

## Addendum（2026-05-16 18:00 +08）：选择审计旧泛名文件迁出并收敛 prompt handler

- [x] 旧泛名 `choice-audit-fixes.test.ts` 已迁为聚焦文件 `elder-thing-choice-goju-tiebreak.test.ts`，避免继续往旧“audit fixes”垃圾桶加改动。
- [x] Elder Thing 选择链中已有 prompt 对象的 handler 直调改为 `resolvePromptViaRegisteredHandler`，覆盖 destroy / deckbottom / 两步 destroy / stale deckbottom 场景。
- [x] 保留 `base_temple_of_goju_tiebreak` 一处 `getInteractionHandler`：该测试没有 prompt 对象，当前是在直接验证 handler-level 平局处理合同，不属于本轮 prompt handler facade 迁移对象。
- [x] 验证：`elder-thing-choice-goju-tiebreak.test.ts` 10 tests passed；eslint 0 errors；`npm run test:structure` checked files: 111，OK（仅既有 legacy-root 警告）。
- [ ] 后续质量债：继续清理旧泛名/审计文件时，若结构门禁提示“旧泛名净新增”，优先迁出为聚焦文件，而不是只在旧文件上做 facade 替换。

## Addendum（2026-05-16 18:08 +08）：交互响应从 handler 直调升级到命令链 facade

- [x] `helpers.ts` 新增 `respondToPromptOption(...)`，用业务 option predicate 找到 prompt 选项后通过 `SYS_INTERACTION_RESPOND` 跑完整 `executePipeline`，避免业务测试直接依赖 handler 位置参数、`getPromptHandlerData` 和手动清理 current。
- [x] `shoggoth-destroy-choice.test.ts` 6 条用例从 `getInteractionHandler(...)` + `withoutCurrentPrompt(...)` + `getPromptHandlerData(...)` 改为 `respondToPromptOption(...)`；同时 `triggerShoggothOnPlay` 改用 `makeMatchState`，不再手写 `sys.interaction` 结构。
- [x] `turnCycle.test.ts` 中“蘑菇王国与 Invisible Ninja 同回合开始”用例不再手动调用 handler / `advanceSmashUpReactionSession`；通过真实命令响应后直接断言下一个 `titan_ninjas_invisible_ninja_start_turn` prompt 已出现。
- [x] 验证：`shoggoth-destroy-choice.test.ts` 6 tests passed；`turnCycle.test.ts` 22 tests passed；3 个修改文件 eslint 0 errors；`rg` 确认这两个测试文件不再出现 `getInteractionHandler(` / `getPromptHandlerData(` / `withoutCurrentPrompt(` / `advanceSmashUpReactionSession` / `resolveInteraction(`；`npm run test:structure` checked files: 113，OK（仅既有 legacy-root 警告）。
- [ ] 后续质量债：`respondToPromptOption` 应作为普通业务测试的默认 prompt 响应接口；`resolvePromptViaRegisteredHandler` 只用于刻意绕开命令管线的 handler-level / stale 边界合同测试。

## Addendum（2026-05-16 18:14 +08）：runtime prompt 响应继续命令链化

- [x] `test-alien-scout-afterscore.test.ts` 中 Alien Scout 回手响应从 `getAbilityRuntimePromptHandler(...)` + `getPromptHandlerData(prompt)` 改为 `respondToPromptOption(...)`，并直接断言命令管线后的 `finalState.core`。
- [x] `alien-scout-pod-afterscore.test.ts` 的 stale 离场场景不再直调 runtime handler；现在用 `withOnlyCurrentPrompt(makeMatchState(staleCore), oldPrompt)` 构造“旧 prompt + 新 core”的运行态，再通过 `respondToPromptOption(...)` 验证不会产生 `MINION_RETURNED`。
- [x] `robotAbilities.test.ts` 中 Microbot Reclaimer 的空选择跳过 / 选择 `mb1` 洗回牌库改为 `respondToPromptOptions(...)`；不再导入 `getAbilityRuntimePromptHandler`，事件断言改为查找业务 `DECK_REORDERED`。
- [x] 验证：Alien Scout 两文件 6 tests passed；`robotAbilities.test.ts` 11 tests passed；3 个文件 eslint 0 errors（首次低内存 eslint OOM 后用 `NODE_OPTIONS=--max-old-space-size=8192` 复跑通过）；目标扫描只剩 `robotAbilities.test.ts` 一处 `getPromptHandlerData(prompt)`，用于动态 `optionsGenerator` 刷新合同，不是 handler 参数直调；`npm run test:structure` checked files: 115，OK（仅既有 legacy-root 警告）。
- [ ] 后续质量债：继续清理 runtime prompt handler 直调时，优先区分“真实玩家响应”与“动态候选刷新合同”；前者走 `respondToPromptOption(s)`，后者可保留 `getPromptHandlerData` 作为 prompt contract 数据输入。

## Addendum（2026-05-16 18:18 +08）：Pirates prompt 响应分层试点

- [x] `abilities/pirates-ongoing.test.ts` 中 `pirate_full_sail_choose_minion` 的“完成”响应从无 prompt 的 handler 直调改为真实 `pirate_full_sail` special 触发后通过 `respondToPromptOption(...)` 响应 done option。
- [x] `pirate_first_mate afterScoring` 的手工 reaction session 尝试命令链化时发现没有可见 prompt 可响应；该用例是在直接验证 `startSmashUpReactionSession` + reaction handler 的低层合同，因此保留 direct handler，并在 findings 记录为不应强行迁移的例外。
- [x] 保留 `pirate_buccaneer_move` 注册检查：该断言目标就是注册表合同，不属于普通业务 prompt 响应。
- [x] 验证：`abilities/pirates-ongoing.test.ts` 19 tests passed；eslint 0 errors；`npm run test:structure` 首次 4096MB 进程异常 exit 1 且无门禁错误输出，8192MB 复跑 checked files: 115，OK（仅既有 legacy-root 警告）。
- [ ] 后续质量债：对 `getInteractionHandler` 命中不能一刀切；先确认是否真的有 prompt 对象/命令入口。没有 prompt 的 session/registry 合同测试应保留低层入口或另建明确的低层 helper。

## Addendum（2026-05-16 18:22 +08）：Zombie/Wizard runtime prompt 响应命令链化

- [x] `zombieWizardAbilities.test.ts` 中 `zombie_outbreak_choose_base` 响应从 `getAbilityRuntimePromptHandler(...)` + `getPromptHandlerData(current)` 改为 `respondToPromptOption(...)`，仍验证选择空基地后产生 `LIMIT_MODIFIED` 且 `restrictToBase` 正确。
- [x] `zombie_mall_crawl` 选择卡名响应改为 `respondToPromptOption(...)`，最终状态直接取命令管线的 `finalState.core`，不再手动 handler 后 `applyEvents`。
- [x] 验证：`zombieWizardAbilities.test.ts` 23 tests passed；eslint 0 errors；扫描确认该文件不再有 `getAbilityRuntimePromptHandler(` / `getInteractionHandler(` / `handler!(`，只剩一处 `getPromptHandlerData(current)` 用于 `displayCard` prompt 合同断言；`npm run test:structure` checked files: 115，OK（仅既有 legacy-root 警告）。
- [ ] 后续质量债：`displayCard`、`continuationContext` 等 prompt 合同断言可保留 `getPromptHandlerData`；传给 handler 的参数读取应继续迁移到命令链或共享 resolver。

## Addendum（2026-05-16 18:25 +08）：Frankenstein stale prompt 回归命令链化

- [x] `abilities/frankenstein.test.ts` 中 `frankenstein_angry_mob` stale 回归删除 `getAbilityRuntimePromptHandler`、`resolveCurrentPromptHandlerWithCore`、`resolveInteraction`，改为通过 `respondToPromptOption(...)` 依次响应选随从与选手牌。
- [x] stale 分支用 `withOnlyCurrentPrompt(makeMatchState(staleCore), chooseCardPrompt)` 表达“旧二段 prompt 仍存在，但权威 core 中目标手牌已离开”，再通过真实响应命令验证不会产生 `CARD_TO_DECK_BOTTOM` / `POWER_COUNTER_ADDED`。
- [x] 验证：`abilities/frankenstein.test.ts` 11 tests passed；eslint 0 errors；扫描确认该文件不再有 runtime handler / handler bridge / manual `resolveInteraction` 命中；`npm run test:structure` checked files: 115，OK（仅既有 legacy-root 警告）。
- [ ] 后续质量债：stale prompt 回归优先复用 “旧 prompt + 新 core + respond” 模式；只有无 prompt 或专测 handler 函数时才保留低层入口。

## Addendum（2026-05-16 18:28 +08）：Big Gulp / Igor bug 复现命令链化

- [x] `igor-big-gulp-double-trigger.test.ts` 从 `execute(...)` + `getAbilityRuntimePromptHandler('vampire_big_gulp')` + 手动 `processDestroyMoveCycle(...)` 改为 `runCommand(PLAY_ACTION)` + `respondToPromptOption(...)`，通过真实管线验证 Igor onDestroy prompt 只出现一次。
- [x] 移除该文件中的 handler data 传参、手动 destroy cycle 和调试 `console.log`；测试名同步改为“Big Gulp 消灭 Igor 后 Igor onDestroy 只触发一次”，避免继续声明内部函数步骤。
- [x] 验证：`igor-big-gulp-double-trigger.test.ts` 1 test passed；eslint 0 errors；扫描确认 `getAbilityRuntimePromptHandler` / `getPromptHandlerData` / `processDestroyMoveCycle` / `execute(` / `console.log` / `handler!(` 0 命中；`npm run test:structure` checked files: 116，OK（仅既有 legacy-root 警告）。
- [ ] 后续质量债：历史 bug 复现文件如果能通过真实命令链覆盖，就应优先移除手动 reducer/handler 分步；只有专测 reducer 后处理合同时才保留 `process*` 低层调用。

## Addendum（2026-05-16 18:33 +08）：Zeppelin runtime prompt 分步响应命令链化

- [x] `ongoingTalent.test.ts` 中 `steampunk_zeppelin_choose_minion` 三处 runtime handler 直调改为 `respondToPromptOption(...)`，分别覆盖 stale 第二步、从其他基地选择随从、从齐柏林所在基地选择随从。
- [x] stale 第二步使用 `withOnlyCurrentPrompt(makeMatchState(staleCore), chooseBaseInteraction)` 挂旧 destination prompt，再通过真实响应命令验证目标离场时不会产生 `MINION_MOVED`。
- [x] 验证：`ongoingTalent.test.ts` 首次 4096MB Vitest worker OOM，8192MB 复跑 27 tests passed；eslint 0 errors；扫描确认该文件 `getAbilityRuntimePromptHandler(` 清零，剩余 `getPromptHandlerData` 为其它 handler/contract 点；`npm run test:structure` checked files: 116，OK（仅既有 legacy-root 警告）。
- [ ] 后续质量债：`ongoingTalent.test.ts` 剩余 `getPromptHandlerData` 集中在 Trickster 等非 runtime prompt handler 直调；下一步应按同样标准判断是否有真实 prompt 可响应。

## Addendum（2026-05-16 18:47 +08）：Expansion ongoing stale/live 断言口径对齐真实响应语义

- [x] `expansionOngoing.test.ts` 中 `steampunk_mechanic` / `steampunk_change_of_venue` 的 4 条 runtime handler 迁移已完成，其中 3 条二段 stale/live 用例补齐了真实命令链下的正确断言口径。
- [x] `steampunk_mechanic_target` 在对手 `ornate_dome` 封锁后，不再沿用 direct handler 的“空事件”口径；现在先用 `optionsGenerator` 证明 live 刷新后 `base-0` 已失效，再断言 `respondToPromptOption(...)` 返回 `无效的选择`。
- [x] `steampunk_mechanic_target` / `steampunk_change_of_venue_choose_base` 的“待附着牌已不在手牌”场景，改为断言不会产生 `ACTION_PLAYED` / `ONGOING_ATTACHED` / `LIMIT_MODIFIED` 这些业务事件，并验证最终状态仍未附着、手牌为空；不再把 `SYS_INTERACTION_RESOLVED` 误当成业务副作用。
- [x] `killer_plant_venus_man_trap_search` 的成功路径也已改为 `respondToPromptOption(...)`；该测试继续验证 `MINION_PLAYED` 带出 `baseIndex/baseDefId`，但不再依赖 runtime handler 参数。
- [x] 同文件继续迁移 `innsmouth_return_to_the_sea`、`miskatonic_researcher_pod`、`miskatonic_field_trip_pod`、`miskatonic_things_best_not_known_pod_draw`、`miskatonic_librarian_pod` 到 `respondToPromptOption(s)`；目前只剩 `steampunk_mechanic` 两条明显 handler-level 非法值合同保留 direct runtime handler。
- [x] `killer_plant_sprout_search` / `killer_plant_venus_man_trap_search` 的 stale deck-search 回归也已改看真实命令链：当前公开语义是不重复打出、deck 不变，但旧 prompt 仍留在当前交互里；这与 direct handler 的反馈/洗牌合同不同，已在 findings 单独记录。
- [x] 验证：`src/games/smashup/__tests__/expansionOngoing.test.ts` 67 tests passed；eslint 0 errors；`npm run test:structure` checked files: 1，OK。
- [ ] 后续质量债：继续清理剩余 runtime prompt 直调时，要先区分“live 失效应拒绝响应”和“响应可收口但不产生产务事件”两类语义，不能机械把旧 handler 的 `events.length === 0` 搬到命令链测试里。

## Addendum（2026-05-16 19:02 +08）：Madness prompt 业务响应命令链化

- [x] `madnessAbilities.test.ts` 中 `innsmouth_recruitment` 的即时额外随从、抽 3 张、reduce 验证、疯狂牌库不足 3 张等业务响应，已从 direct handler 改为 `respondToPromptOption(...)`。
- [x] 同文件 `miskatonic_librarian_pod` 的 extra 模式与二段 `play_madness` 响应已改走真实 prompt 链，并继续验证 `special_madness` follow-up prompt 出现。
- [x] “疯狂牌库不足 3 张” 的测试语义已从非法 value clamp 改为公开行为：prompt 不暴露 `count=3` 选项，用户选择 `count=2` 后按 2 张疯狂卡 / 2 个额外随从结算。
- [x] 验证：`src/games/smashup/__tests__/madnessAbilities.test.ts` 32 tests passed；eslint 0 errors；`npm run test:structure` checked files: 2，OK。
- [ ] 后续质量债：继续清点 `madnessAbilities.test.ts` 里剩余低层合同，只保留明确的 off-phase handler / live prompt contract；普通按钮响应不再回退到 direct handler。

## Addendum（2026-05-16 19:06 +08）：Mandatory Reading draw 按钮响应命令链化

- [x] `madnessAbilities.test.ts` 中 `miskatonic_mandatory_reading_draw` 的 4 条普通按钮响应用例，已从 `getInteractionHandler(...)` + `getPromptHandlerData(...)` 改为真实 `respondToPromptOption(...)`。
- [x] “抽 2 张疯狂卡后产生抽牌与力量加成事件”继续断言 `MADNESS_DRAWN(count=2)` 与 `PERMANENT_POWER_ADDED(amount=4)`，但不再依赖 handler 参数顺序。
- [x] “跳过”“抽 3 张后最终状态”“多张疯狂卡 UID 唯一”三条用例改为直接观察命令链 `events` 与 `finalState.core`，不再手动 `applyEvents` 模拟调用方职责。
- [x] 同文件剩余 `getInteractionHandler(...)` 只剩 `miskatonic_those_meddling_kids_pod_mode` 的 off-phase immediate 合同；`getPromptHandlerData(...)` 只剩 live `responseValidationMode` 合同。
- [x] 验证：`src/games/smashup/__tests__/madnessAbilities.test.ts` 32 tests passed；eslint 0 errors；`npm run test:structure` checked files: 2，OK。

## Addendum（2026-05-16 21:26 +08）：Madness 残留清理与九命之屋真实响应链

- [x] `madnessAbilities.test.ts` 的 `miskatonic_those_meddling_kids_pod_mode` 已从“半迁移”收口为完整命令链测试：删除残留的 `getInteractionHandler(...)` 断言后，off-phase immediate 仍通过真实 prompt 响应证明；文件内 direct handler / runtime prompt handler 命中已为 0。
- [x] `baseProtection.test.ts` 的 `base_nine_lives_intercept` 三条业务测试已从 direct handler 改为真实 `resolveDestroyedMinions(...)` -> `base_nine_lives_intercept` prompt -> `respondToPromptOption(...)` 链；“选择移动”“目标 stale 不再移动旧目标”“选择不移动恢复销毁”都改为断言真实响应结果，而非 handler 位置参数。
- [x] 这批迁移后，全仓 `getInteractionHandler(...)` / `getAbilityRuntimePromptHandler(...)` 命中从 `42` 降到 `38`；`baseProtection.test.ts` 文件内命中已为 0。
- [x] 验证：`src/games/smashup/__tests__/madnessAbilities.test.ts` 32 tests passed，`src/games/smashup/__tests__/baseProtection.test.ts` 19 tests passed，两个文件 eslint 均为 0 errors，`npm run test:structure` OK。

## Addendum（2026-05-16 21:41 +08）：基地/海盗业务链继续退出 direct handler

- [x] `baseAbilityNeutralProtection.test.ts` 已从直接调用 `base_mushroom_kingdom` handler 改为真实 `onTurnStart` 基地能力触发 -> `base_mushroom_kingdom` prompt -> `respondToPromptOption(...)`；继续验证的是“基地能力归因中立后，Deep Roots / Infiltrate 对 move 保护过滤是否正确”，而不是 handler 位置参数。
- [x] `igor-rlyeh-double-trigger.test.ts` 已从“直调 `base_rlyeh` handler + 手工 `processDestroyMoveCycle(...)`”改成真实 `triggerBaseAbilityWithMS('base_rlyeh')` -> 选择 Igor -> 检查 `frankenstein_igor` prompt 只出现一次。
- [x] `elder-thing-choice-goju-tiebreak.test.ts` 的 Goju tie-break 响应已改为真实 `triggerBaseAbility('base_temple_of_goju')` 产出 prompt 后，通过 `respondToPromptOption(...)` 选择并验证 `CARD_TO_DECK_BOTTOM`，不再显式调用 `base_temple_of_goju_tiebreak` handler。
- [x] `buccaneer-pod-limit.test.ts` 两条 `baseDefId/stale` 合同已改为真实 replacement prompt 响应：先通过 `fireTriggers(..., { phase: 'replacement' })` 产出 `pirate_buccaneer_move`，再在“基地索引漂移后”或“目标基地已失效”的 stale core 上响应 prompt，验证 live `baseDefId` 重定位与失效时不回退旧索引。
- [x] `abilities/pirates-ongoing.test.ts` 中“`pirate_buccaneer_move` handler 已注册”的冗余断言已删除；注册表存在性继续由专门的 `abilityInteractionRegistry.test.ts` 承担，业务文件只保留行为测试。
- [x] `smashup.smoke.test.ts` 中 `big_funny_giant` 的两条注册断言已删除；同文件已有多条真实行为链覆盖，保留 `abilityTags` 断言即可。
- [x] 这批迁移后，全仓 `getInteractionHandler(...)` / `getAbilityRuntimePromptHandler(...)` 命中从 `38` 降到 `29`；当前剩余主要集中在：
  - `abilityInteractionRegistry.test.ts` 注册表合同
  - `promptSystem.test.ts` / `promptResponseChain.test.ts` 系统合同
  - `expansionOngoing.test.ts` 的 `steampunk_mechanic` runtime prompt 非法值合同
  - `bear-cavalry.test.ts`、`expansionBaseAbilities.test.ts`、`temple-firstmate-afterscore.test.ts` 的少量低层/score-session/stale 合同
  - `smashup.smoke.test.ts` 的 `titan_penguins_emperor_penguin_play` resolve-time 二次校验合同
- [x] 验证：`baseAbilityNeutralProtection.test.ts` 2 passed，`igor-rlyeh-double-trigger.test.ts` 1 passed，`elder-thing-choice-goju-tiebreak.test.ts` 10 passed，`buccaneer-pod-limit.test.ts` 8 passed，`abilities/pirates-ongoing.test.ts` 18 passed，`smashup.smoke.test.ts` 133 passed；对应 eslint 全部 0 errors，`npm run test:structure` OK。

## Addendum（2026-05-16 19:16 +08）：Cthulhu expansion 多步交互链命令链化

- [x] `cthulhuExpansionAbilities.test.ts` 中 `miskatonic_those_meddling_kids` 的 3 条多步点击链，不再手动直调 base-select / card-select handler；现在统一改为 `respondToPromptOption(...)` 按真实 prompt 逐步选择。
- [x] 同文件 `cthulhu_recruit_by_force` 与 `cthulhu_it_begins_again` 的“选多张”“选跳过”“最终状态”用例，已从 direct handler 改为 `respondToPromptOptions(...)`，并把 reduce 验证收口为直接观察 `finalState.core`。
- [x] 这批迁移后，文件内不再出现 `getInteractionHandler(...)` / `getPromptHandlerData(...)`；保留的断言集中在 prompt source、多选约束、业务事件与最终权威状态。
- [x] 验证：`src/games/smashup/__tests__/cthulhuExpansionAbilities.test.ts` 32 tests passed；eslint 0 errors；`npm run test:structure` checked files: 3，OK。

## Addendum（2026-05-16 19:17 +08）：Mushroom Kingdom POD 基地能力链收口

- [x] `baseAbilityIntegration.test.ts` 中 `base_mushroom_kingdom_pod` 的“两段选随从 -> 选目标基地”链，已从 direct handler 改为两次 `respondToPromptOption(...)`。
- [x] 同文件现已清除 `getInteractionHandler(...)` / `getPromptHandlerData(...)` 仅为这条业务链服务的残留，同时顺手删掉未使用的旧测试死代码，恢复 eslint 干净状态。
- [x] 验证：`src/games/smashup/__tests__/baseAbilityIntegration.test.ts` 25 tests passed；eslint 0 errors；`npm run test:structure` checked files: 4，OK。

## Addendum（2026-05-16 19:21 +08）：Ongoing talent 业务链命令链化

- [x] `ongoingTalent.test.ts` 中 `trickster_hideout_pod_swap` 的手牌/牌库交换链，已从 direct handler 改为 `respondToPromptOption(...)`，并直接观察后续 `trickster_hideout_pod_destroy` prompt。
- [x] 同文件 `trickster_pixie_pod` 的 minion / destroy / counters 三段 runtime 链，已改为 `respondToPromptOptions(...)` 与 `respondToPromptOption(...)` 的组合；不再手工喂 handler 参数。
- [x] 这批迁移后，`getInteractionHandler(...)` 清零，只保留 `getPromptHandlerData(...)` 的 prompt 合同断言（`autoResolveIfSingle`）。
- [x] 验证：`src/games/smashup/__tests__/ongoingTalent.test.ts` 27 tests passed；eslint 0 errors；`npm run test:structure` checked files: 5，OK。

## Addendum（2026-05-16 19:29 +08）：Madness prompt 三段业务链收口

- [x] `madnessPromptAbilities.test.ts` 中 `cthulhu_madness_unleashed` 的“跳过 / 选多张 / POD 版”已从 direct handler 改为 `respondToPromptOption(s)`；“跳过”不再断言 `events.length === 0`，改为断言没有 `MADNESS_RETURNED` / `CARDS_DRAWN` / `LIMIT_MODIFIED` 业务事件，并直接观察 `finalState.core`。
- [x] 同文件 `miskatonic_book_of_iter_the_unseen` 的“手牌返回 1 张 / 跳过”已改成真实 prompt 响应；不再使用本地 `resolveInteraction(...)` 或手动 `applyEvents(...)` 模拟调用方职责。
- [x] `miskatonic_thing_on_the_doorstep` 的并列最高力量场景已改用 `getFirstPrompt` / `getPromptOptions` / `respondToPromptOption(...)`；不再裸读 `sys.interaction` 或直调 handler。
- [x] 当前文件对 `getInteractionHandler(...)` / `getPromptHandlerData(...)` / `resolveInteraction(...)` / `sys.interaction` / `interaction.data.options` 的目标扫描已清零。
- [x] 验证：`src/games/smashup/__tests__/madnessPromptAbilities.test.ts` 26 tests passed；eslint 0 errors；`npm run test:structure` checked files: 6，OK。

## Addendum（2026-05-16 19:36 +08）：Expansion base abilities 业务 prompt 批量命令链化

- [x] `expansionBaseAbilities.test.ts` 中 `base_mermaid_pool`、`base_ossuary`、`base_arena`、`base_miskatonic_university_base` 的业务响应，已从 direct handler 改为 `respondToPromptOption(...)`。
- [x] 同文件 `base_the_asylum` 的“两段手牌 -> 随从”链，已改成两次真实 prompt 响应；不再手动把 `option.value` 喂给 `base_the_asylum` / `base_the_asylum_choose_minion` handler。
- [x] 这批迁移后，原本基于 direct handler 的 `events.length` / 固定事件下标断言，已统一改成按业务事件 `find/filter` 或直接观察 `finalState.core`，避免命令链附带系统事件时出现假红。
- [x] 当前文件剩余 `getInteractionHandler(...)` 主要集中在 stale 回归、reaction queue、queued prompt follow-up 与少量明确 handler-level 合同；这批保留为下一轮按分层继续判断的低层入口。
- [x] 验证：`src/games/smashup/__tests__/expansionBaseAbilities.test.ts` 50 tests passed；eslint 0 errors；`npm run test:structure` checked files: 7，OK。

## Addendum（2026-05-16 19:44 +08）：Interaction chain E2E 熊骑兵 stale 回归命令链化

- [x] `interactionChainE2E.test.ts` 中 4 条熊骑兵 stale 回归，已从 direct handler 改为 `withOnlyCurrentPrompt(makeFullMatchState(staleCore), oldPrompt)` + 本地 `respond(...)`，覆盖 `bear_cavalry_commission_move_dest`、`bear_cavalry_bear_cavalry_choose_base`、`bear_cavalry_youre_screwed_choose_dest`、`bear_cavalry_bear_rides_you_choose_base`。
- [x] 该文件的本地 `respond(...)` 返回 `GameTestRunner` 结构，不是 `success/events` 直返；断言口径统一改看 `steps[0]?.success` 与 `finalState`，避免把别的 helper 结果形状硬套进来。
- [x] 同轮顺手恢复 `getPromptHandlerData` import，删除未使用的 `handlerRandom` / `RandomFn`，保持文件内部接口干净。
- [x] 验证：`src/games/smashup/__tests__/interactionChainE2E.test.ts` 55 tests passed；eslint 0 errors；`npm run test:structure` OK；扫描确认该文件 `getInteractionHandler(...)` 已清零，仅保留 prompt contract 读取与 4 处 `withOnlyCurrentPrompt(...)`。

## Addendum（2026-05-16 19:49 +08）：Expansion base stale 回归继续命令链化

- [x] `expansionBaseAbilities.test.ts` 中 `base_land_of_balance`、`base_sheep_shrine`、`base_the_pasture`、`base_innsmouth_base_choose_card`、`base_cat_fanciers_alley`、`base_inventors_salon` 的 stale 回归，已从 direct handler 改为 `withOnlyCurrentPrompt(makeMatchState(staleCore), oldPrompt)` + `respondToPromptOption(...)`。
- [x] 这批用例不再断言 `events.length === 0`；统一改成“命令链响应成功，但不产生目标业务事件”，分别检查 `MINION_MOVED` / `CARD_TO_DECK_BOTTOM` / `MINION_DESTROYED` / `CARDS_DRAWN` / `CARD_RECOVERED_FROM_DISCARD` 不出现。
- [x] 当前文件剩余 `getInteractionHandler(...)` 只剩 `base_greenhouse` 2 处，且都明确在测 scoring-session / replacement follow-up 合同，不再把它们误当成普通业务 prompt。
- [x] 验证：`src/games/smashup/__tests__/expansionBaseAbilities.test.ts` 50 tests passed；eslint 0 errors；`npm run test:structure` checked files: 8，OK。

## Addendum（2026-05-16 19:52 +08）：Smoke 中 Sphinx 业务 prompt 收口

- [x] `smashup.smoke.test.ts` 中 `titan_sphinx_start_turn`、`titan_sphinx_after_scoring`、`titan_sphinx_talent` 三条，已从 direct handler 改为 `respondToPromptOption(...)`，直接断言 `finalState.core`。
- [x] 这三条都属于“已有真实 prompt、用户只是点一张可见卡牌”的普通业务链，不再保留 `getPromptHandlerData(...)` + 手动 reduce 事件的内部合同。
- [x] 验证：`src/games/smashup/__tests__/smashup.smoke.test.ts` 133 tests passed；eslint 0 errors；全仓重扫 `getInteractionHandler(` / `getAbilityRuntimePromptHandler(` 当前剩余 76 条，主要集中在注册表合同、session/stale 例外与 `smashup.smoke.test.ts` 其他 titan 簇。

## Addendum（2026-05-16 20:06 +08）：Smoke 中 Kraken 红灯修复并继续收 Mergacon / Gorgodzolla

- [x] `smashup.smoke.test.ts` 的 `titan_pirates_the_kraken_talent` 已修回绿：这条 prompt 响应不仅产出业务事件，还会在 `state.core` 写入 `timedPowerModifiers`。测试不再用 `response.events.reduce(...)` 手搓后态，而是改用 `resolved.finalState.core` 作为权威状态，再验证 `TURN_STARTED` 时 debuff 会在你下回合开始恢复。
- [x] 同文件 `titan_changerbots_mergacon_play`、`titan_changerbots_mergacon_talent`、`titan_kaiju_gorgodzolla_draw` 3 条普通 titan prompt，已从 direct handler 改为真实 `respondToPromptOption(...)`。
- [x] `titan_changerbots_mergacon_play` 现在先走真实 `onTurnStart` trigger 拿 prompt，再点击基地选项；不再手动伪造 continuationContext 直调 handler。
- [x] `titan_kaiju_gorgodzolla_draw` 改走真实 respond 后，事件流会附带 `SYS_INTERACTION_RESOLVED`；断言口径已从 `toEqual([CARDS_DRAWN])` 调整为“包含 `CARDS_DRAWN` + 最终手牌变化正确”。
- [x] 验证：`src/games/smashup/__tests__/smashup.smoke.test.ts` 133 tests passed；eslint 0 errors；`npm run test:structure` OK；全仓重扫 `getInteractionHandler(` / `getAbilityRuntimePromptHandler(` 当前剩余 66 条。
- [ ] 下一轮优先继续 `smashup.smoke.test.ts` 里“已有真实 prompt、只差一步点击”的 titan 小簇，如 `time_box_play`、`moon_zero_three`、`walking_castle` 等；继续避开明显的 registry / session / replacement 合同。

## Addendum（2026-05-16 20:13 +08）：Smoke 中 Walking Castle / Time Box / Moon Zero Three / Megabot 收口

- [x] `smashup.smoke.test.ts` 中 `titan_magical_girls_walking_castle_choose_base` + `choose_minions` 的二段链，已从 direct handler 改为 `respondToPromptOption(...)` + `respondToPromptOptions(...)`。
- [x] `titan_time_travelers_time_box_play` 已改走真实 `respondToPromptOption(...)`；断言不再锁 `enteredAt=113` 这种旧 handler 时代手喂 timestamp 的细节，只保留“进到目标基地 + 计数清零”的公开行为。
- [x] `titan_super_spies_moon_zero_three_choose_player` + `resolve` 两段链，已改走真实 `respondToPromptOption(...)`；不再手动 `postProcessSystemEvents(...)` 拼接中间状态。
- [x] `titan_mega_troopers_megabot_move` 已从 direct handler 改为真实 `respondToPromptOption(...)`，直接断言 `finalState.core` 中泰坦已移动到计分基地。
- [x] 验证：`src/games/smashup/__tests__/smashup.smoke.test.ts` 133 tests passed；eslint 0 errors；`npm run test:structure` OK；全仓重扫 `getInteractionHandler(` / `getAbilityRuntimePromptHandler(` 当前剩余 60 条。
- [ ] `smashup.smoke.test.ts` 下一批候选缩小为：`creampuff_man` 两段链、`major_ursa` 三段链、`rainboroc` 两段链、`very_large_boulder` 两段链、`hill_that_strolls` 三段链；`big_funny_giant` 当前只剩注册表暴露断言，可保留。

## Addendum（2026-05-16 20:18 +08）：Smoke 中 Creampuff / Rainboroc 再收两条二段链

- [x] `smashup.smoke.test.ts` 中 `titan_ghosts_creampuff_man_discard` + `play` 已从 direct handler 改为两次真实 `respondToPromptOption(...)`。
- [x] 同文件 `titan_itty_critters_rainboroc_choose_discard` + `choose_base` 已从 direct handler 改为两次真实 `respondToPromptOption(...)`。
- [x] `creampuff_man` 现在直接从第一次响应的 `finalState` 里拿第二段 prompt；不再需要 `withCurrentPrompt(...)` 手工拼当前交互。
- [x] `rainboroc` 的“洗回牌库 + 继续移动”断言已改为直接观察 `finalState.core`，不再手动 `reduce(events)` 拼中间 core。
- [x] 验证：`src/games/smashup/__tests__/smashup.smoke.test.ts` 133 tests passed；eslint 0 errors；`npm run test:structure` OK；全仓重扫 `getInteractionHandler(` / `getAbilityRuntimePromptHandler(` 当前剩余 56 条。
- [ ] `smashup.smoke.test.ts` 剩余普通多段链进一步缩小为：`major_ursa`、`very_large_boulder`、`hill_that_strolls`；另有 `titan_penguins_emperor_penguin_play` 与 `big_funny_giant` 两条显式合同断言保留。

## Addendum（2026-05-16 22:03 +08）：Smoke 中 Emperor Penguin resolve-time recheck 修回真实链

- [x] `smashup.smoke.test.ts` 的 `titan_penguins_emperor_penguin_play` resolve-time recheck 用例已修回绿，并继续保留真实 `fireTriggers(...)` -> `getSimpleChoicePrompt(...)` -> `respondToPromptOption(...)` 链。
- [x] 根因不是 handler 或 respond 逻辑坏了，而是测试前置局面不满足 Emperor Penguin 的真实 special 资格：`onTurnStart` 只会在你某个基地已有至少 3 个己方随从时产出 `titan_penguins_emperor_penguin_play` prompt。
- [x] 修复方式是给 `promptCore` 与 `staleCore` 都补上真实可触发的基地场景，再在 stale core 中额外放入另一只己方 live titan，证明 resolve 时 `canControllerPlayTitan(...)` 仍会二次拦截，不产生 `TITAN_PLAYED`。
- [x] 这条现在锁的是稳定业务合同：`trigger` 侧真实建 prompt，`resolve` 侧真实复验“同一控制者不能同时有第二只 live titan”；不再是直调 handler 的内部参数合同。
- [x] 验证：`smashup.smoke.test.ts` 定点 1 passed；整文件 133 passed；eslint 0 errors；`npm run test:structure` checked files: 3，OK。
- [x] 全仓重扫 `getInteractionHandler(` / `getAbilityRuntimePromptHandler(` 当前剩余 24 条；现存命中主要集中在注册表合同、prompt 系统合同、少量 runtime prompt 合同与明确保留的低层能力合同。
- [ ] 下一步不再机械追求把 24 清零；先按“系统/注册表/低层合同”与“仍属普通业务链”重新分层，再决定是否继续迁 `bear_cavalry_superiority_pod_talent` / `steampunk_mechanic` 这类剩余项。

## Addendum（2026-05-16 22:08 +08）：把 handler 直调分层固化进结构门禁

- [x] `scripts/infra/testing-structure-guard.mjs` 已新增 direct handler 门禁：游戏行为测试新增 `getInteractionHandler(...)` / `getAbilityRuntimePromptHandler(...)` 时会失败。
- [x] 例外范围已显式收窄为三类：`interaction/prompt` 系统合同命名文件、`abilityInteractionRegistry.test.ts` 注册表合同、通过 helper 封装的低层能力合同。
- [x] `docs/testing-best-practices.md` 已同步写明这条 seam 规范：业务测试默认走真实 `trigger -> prompt -> respond` 或命令入口，不再用 handler 直调兜底。
- [x] 验证：`npm run test:structure` OK；`node scripts/infra/testing-structure-guard.mjs --all` OK；`eslint scripts/infra/testing-structure-guard.mjs` 0 errors。
- [x] 这意味着后续重构即使不继续立刻改掉剩余 24 条，新增业务测试也不会再把 direct handler 债务写回来。
- [ ] 下一步应优先审视“允许列表”是否还存在可继续收回到真实链的普通业务片段，而不是继续放大 allowlist。

## Addendum（2026-05-16 22:21 +08）：低层合同也改走 helper，取消文件级 allowlist

- [x] `helpers.ts` 已新增 `invokeRegisteredInteractionHandlerContract(...)` 与 `invokeRegisteredRuntimePromptHandlerContract(...)`，用于显式承载少量低层合同测试。
- [x] `abilities/bear-cavalry.test.ts` 与 `expansionOngoing.test.ts` 已从 raw `getInteractionHandler(...)` / `getAbilityRuntimePromptHandler(...)` 改为走上述 helper；低层合同仍保留，但不再在测试体里直接摸注册表 API。
- [x] 因为这两份文件已不再含 raw handler 查询，`testing-structure-guard.mjs` 的文件 allowlist 已删除；guard 现在只认系统合同命名文件与 helper 封装这两类出口。
- [x] 全仓 `getInteractionHandler(` / `getAbilityRuntimePromptHandler(` 在 `src/games/smashup/__tests__` 中已从 24 降到 22；剩余 raw 命中只在 `abilityInteractionRegistry.test.ts`、`promptSystem.test.ts`、`promptResponseChain.test.ts` 与 `helpers.ts`。
- [x] 验证：`bear-cavalry.test.ts` + `expansionOngoing.test.ts` 88 tests passed；相关 eslint 0 errors；`npm run test:structure` OK。

## Addendum（2026-05-16 22:26 +08）：系统合同样板 helper 化，raw 命中收口到注册表测试

- [x] `helpers.ts` 已新增 `findRegisteredPromptContinuationContract(...)`、`expectRegisteredInteractionHandlerContract(...)`、`expectRegisteredRuntimePromptHandlerContract(...)`、`expectRegisteredPromptContinuationContract(...)`，把系统合同里的“handler 已注册”样板统一收口。
- [x] `promptResponseChain.test.ts` 与 `promptSystem.test.ts` 已改用这些 helper，不再在测试体里直接 `getInteractionHandler(...)` / `getAbilityRuntimePromptHandler(...)`。
- [x] `helpers.ts` 内部也已继续去重：公开 helper 全部复用两处单一查找函数 `lookupRegisteredInteractionHandler(...)` / `lookupRegisteredRuntimePromptHandler(...)`。
- [x] 全仓 `getInteractionHandler(` / `getAbilityRuntimePromptHandler(` 在 `src/games/smashup/__tests__` 中已从 22 降到 11；现在只剩 `abilityInteractionRegistry.test.ts` 的注册表语义断言，以及 `helpers.ts` 里两处底层查找函数。
- [x] 验证：`promptResponseChain.test.ts` + `promptSystem.test.ts` 22 tests passed；`helpers.ts` eslint 0 errors；`npm run test:structure` OK。

## Addendum（2026-05-16 22:35 +08）：开始治理 resolvePromptViaRegisteredHandler 隐性耦合

- [x] `testing-structure-guard.mjs` 已新增门禁：业务测试新增 `resolvePromptViaRegisteredHandler(...)` 也会被拦下，不允许再用 helper 把 registered handler 直调藏回测试体。
- [x] `abilities/cthulhu.test.ts` 与 `elderThingAbilities.test.ts` 中显然属于真实点击路径的场景，已从 `resolvePromptViaRegisteredHandler(...)` 迁为 `respondToPromptOption(...)`。
- [x] `elder-thing-choice-goju-tiebreak.test.ts` 已按语义拆分：
  - 真实可点击的 destroy / deckbottom / 二段选择链改为 `respondToPromptOption(...)`
  - “强行提交非法 destroy choice 也应兜底”这条保留为低层合同，但改走 `invokeRegisteredInteractionHandlerContract(...)`，不再直接依赖 `resolvePromptViaRegisteredHandler(...)`
- [x] 全仓 `resolvePromptViaRegisteredHandler(` 在 `src/games/smashup/__tests__` 中当前剩余 15 条；已集中到 `baseAbilitiesPrompt.test.ts`、`reactionQueue*.test.ts` 和 `helpers.ts`。这说明剩余问题已从“分散业务测试耦合”收敛成“少量 prompt/base contract 文件待分层”。
- [x] 验证：`cthulhu.test.ts` + `elderThingAbilities.test.ts` 45 tests passed；`elder-thing-choice-goju-tiebreak.test.ts` 10 tests passed；相关 eslint 0 errors；`npm run test:structure` OK。

## Addendum（2026-05-16 22:50 +08）：reaction queue 当前 prompt 场景改走真实 respond

- [x] `reactionQueueBaseOptionalClockwise.test.ts` 的 optional cycle 场景，已从 `resolvePromptViaRegisteredHandler(...)` 改为真实 `respondToPromptOption(...)`；`pass -> player2 acts -> player1 仍可继续行动` 现在通过真实 prompt 响应推进，而不是手工清 current 后直调 handler。
- [x] `reactionQueueOrdering.test.ts` 的“当前玩家决定 mandatory simultanous triggers 顺序”，已从 registered handler 直调改为真实 `respondToPromptOption(...)`；断言同步从 `events[0]` 收口为“事件流包含 `TRIGGER_CONSUMED` + 目标业务事件”。
- [x] `reactionQueueBaseAbilities.test.ts` 的基地反应排序选择，同样改为真实 `respondToPromptOption(...)`，不再把 reaction prompt 的 continuation handler 当成业务入口。
- [x] `reactionQueueDestroyerId.test.ts` 的 `smashup_reaction_choose -> vampire_*_play` 链，已改为真实 `respondToPrompt(...)`；这样仍能证明 destroyerId 上下文会穿过 reaction queue 保留到后续业务 prompt。
- [x] 这批迁移后，全仓 `resolvePromptViaRegisteredHandler(` 在 `src/games/smashup/__tests__` 中已从 `15` 降到 `1`；剩余唯一命中只在 `helpers.ts` 的 helper 定义本体。
- [x] 验证：4 files / 36 tests passed；对应 eslint 0 errors；`npm run test:structure` OK。

## Addendum（2026-05-16 22:58 +08）：删除已无调用方的旧 handler 桥接 helper

- [x] `helpers.ts` 中的 `resolvePromptViaRegisteredHandler(...)` 已删除；它在测试体内已无任何调用方，继续保留只会制造“系统合同还能用这条旧 seam”的错误暗示。
- [x] 同轮继续删除 `callHandler(...)` 与 `resolveCurrentPromptHandlerWithCore(...)` 两个旧桥接 helper；当前代码里已无测试调用，只剩历史记录和文档示例。
- [x] `helpers/auditUtils.ts` 已同步取消 `callHandler` 的转发导出，避免审计工具继续暴露这层旧接口。
- [x] `docs/testing-best-practices.md` 已同步收紧：低层合同示例改为 `invokeRegisteredInteractionHandlerContract(...)` / `invokeRegisteredRuntimePromptHandlerContract(...)`，不再把 `callHandler` 或 registered-handler 直调桥接当成推荐工具。
- [x] 验证：`helpers.ts` + `helpers/auditUtils.ts` eslint 0 errors；`npm run test:structure` OK；`rg -n "\\bcallHandler\\b|\\bresolveCurrentPromptHandlerWithCore\\b" src/games/smashup/__tests__` 与 `rg -n "resolvePromptViaRegisteredHandler\\(" src/games/smashup/__tests__` 都已无命中。

## Addendum（2026-05-16 23:05 +08）：开始把小样本 `resolveAbility(...)` 直调收回真实命令入口

- [x] `ninja-infiltrate-pod-talent.test.ts` 已从 `resolveAbility('ninja_infiltrate_pod', 'talent') + applyEvents(...)` 改为真实 `runCommand(... SU_COMMANDS.USE_TALENT ...)`；该测试现在直接观察 `finalState.core` 中基地能力抑制状态，而不是测试手工 reduce 事件后的假后态。
- [x] `abilities/ancient-egyptians.test.ts` 已从 `resolveAbility('ancient_egyptians_plague_of_locusts', 'onPlay')` 改为真实 `runCommand(... SU_COMMANDS.PLAY_ACTION ...)`；验证的仍是“打出后会创建基地选择 prompt”，但不再手工构造 `AbilityContext`。
- [x] 这两条样本证明：哪怕测试现在还在用 `resolveAbility(...)`，只要目标是用户真实能执行的出牌/天赋链，就应优先回到 `PLAY_ACTION` / `USE_TALENT` / `PLAY_MINION` 这类公开命令端口，而不是继续把执行器当作默认入口。
- [x] 验证：两个文件定向 vitest 全绿，eslint 0 errors，`npm run test:structure` OK；全仓 `resolveAbility(` 在 `src/games/smashup/__tests__` 中当前为 `100`。

## Addendum（2026-05-16 23:17 +08）：继续把 `resolveAbility(...)` 的普通 onPlay 行为链收回 `PLAY_ACTION`

- [x] `ancientEgyptiansMummyStrength.feedback-regression.test.ts` 已从 `resolveAbility('ancient_egyptians_mummy_strength', 'onPlay') + 自建 runner/respond` 改为真实 `runCommand(... SU_COMMANDS.PLAY_ACTION ...)` + `respondToPromptOption(...)`；测试继续覆盖“先选目标随从，再完成加成”的真实响应链，但不再从 executor 中途插入。
- [x] `abilities/cthulhu.test.ts` 中 `special_madness` 的 3 条 `onPlay` 场景，已从 `resolveAbility(...)` 改为真实 `PLAY_ACTION`：打出后创建二选一 prompt、选择抽牌、选择返回牌堆，全部通过真实出牌链与真实 prompt 响应完成。
- [x] 这轮明确了一个新的分层边界：`special_madness` 属于标准行动卡 onPlay，应该回到真实命令入口；`wizard_time_loop` / `killer_plant_insta_grow` 这类 off-phase `playTiming=immediate` 合同仍属于执行器/时序层，不应机械混入同一批“业务出牌链”迁移。
- [x] 验证：`ancientEgyptiansMummyStrength.feedback-regression.test.ts` 1 passed；`cthulhu.test.ts -t "special_madness onPlay 与终局 VP"` 5 passed；对应 eslint 0 warnings/errors；`npm run test:structure` OK。
- [x] 全仓 `resolveAbility(` 在 `src/games/smashup/__tests__` 中已从 `96` 降到 `92`。

## Addendum（2026-05-16 23:31 +08）：把 `innsmouth_recruitment` 的 reduce 验证收回真实 `PLAY_ACTION`

- [x] `madnessAbilities.test.ts` 中 `innsmouth_recruitment（招募）` 的“状态正确（reduce 验证）”，已从 `resolveAbility('innsmouth_recruitment', 'onPlay') + 手工补 ACTION_PLAYED` 改为真实 `runCommand(PLAY_ACTION)` 起链，再用 `respondToPromptOption(...)` 选择 `count === 3`。
- [x] 这条现在仍保留 reducer 合同本身：继续用 `applyEvents(state, [...playResult.events, ...respond.events])` 验证手牌拿到 3 张疯狂卡、`minionLimit` 从 `1 -> 4`、`madnessDeck` 减少 3 张；但测试入口不再绕过真实命令层。
- [x] 这一轮进一步确认：同一能力簇里，哪怕只有 1 条“状态正确 / reduce 验证”还卡在旧执行器入口，也应该收回到真实 `PLAY_ACTION`，避免同一文件里一半测真实入口、一半测历史夹具。
- [x] 验证：`madnessAbilities.test.ts -t "状态正确（reduce 验证）"` 7 passed；eslint 0 errors；`npm run test:structure` OK。
- [x] 全仓 `resolveAbility(` 在 `src/games/smashup/__tests__` 中已从 `92` 降到 `91`。

## Addendum（2026-05-16 23:37 +08）：`ninja_infiltrate` 业务 onPlay 链整组回到 `PLAY_ACTION`

- [x] `baseFactionOngoing.test.ts` 中 `ninja_infiltrate / ninja_infiltrate_pod` 的 4 条业务 onPlay 用例，已从 `resolveAbility(...)` 改为真实 `runCommand(PLAY_ACTION)`：
  - 多目标时创建 `destroy` prompt
  - POD 版只暴露基地上的战术目标
  - 单目标时自动消灭
  - 无目标时不产生额外效果
- [x] 这批迁移后，该组测试继续验证原业务语义，但不再自建 `matchState` 把命令层、出牌校验和 `ACTION_PLAYED` 后处理绕开。
- [x] 同时也验证了一个边界：这组 onPlay 用例走回真实命令后，自动消灭/无目标两条并没有暴露能力逻辑差异；唯一红灯只是测试体漏引入 `expectNoPrompt` helper，补齐后恢复通过，说明真正依赖的是旧入口而不是旧行为。
- [x] 验证：`baseFactionOngoing.test.ts -t "渗透"` 7 passed；eslint 0 errors；`npm run test:structure` OK。
- [x] 全仓 `resolveAbility(` 在 `src/games/smashup/__tests__` 中已从 `91` 降到 `87`。

## Addendum（2026-05-16 23:55 +08）：继续把双形态 onPlay 与手工假壳测试收回真实命令链

- [x] `ongoingTalent.test.ts` 中 `trickster_pixie_pod` 的两条 onPlay 业务链，已从 `resolveAbility('trickster_pixie_pod', 'onPlay')` 改为真实命令入口：
  - 随从形态：`runCommand(PLAY_MINION)`
  - 战术形态：`runCommand(PLAY_ACTION)`
- [x] 这轮迁移不只是换成 `runCommand(...)`。测试夹具已同步改成真实 `fusion` 手牌卡，而不是把 executor 当成“已打出后”的假入口；同时把“可选随从顺序”断言从固定数组顺序收敛为业务集合，避免继续锁内部遍历顺序。
- [x] `baseFactionOngoing.test.ts` 中 `trickster_mark_of_sleep` 的“单目标时创建 Interaction”，已从手工捏 `matchState` + `resolveAbility(onPlay)` 改为真实 `runCommand(PLAY_ACTION)`；这条同时暴露并修掉了旧 `extraPlayers` 夹具会把玩家对象打残的问题。
- [x] 这说明更深的治理价值不只是“把 helper 名称换掉”，而是让测试数据本身重新满足真实出牌前置：牌要真的在手里，融合牌要真的以 `fusion` 形态进手牌，玩家状态也要能走完整 reducer/pipeline。
- [x] 验证：
  - `ongoingTalent.test.ts -t "trickster_pixie_pod"` -> 2 passed
  - `baseFactionOngoing.test.ts -t "trickster_mark_of_sleep"` -> 2 passed
  - `eslint baseFactionOngoing.test.ts ongoingTalent.test.ts` -> 0 errors
  - `npm run test:structure` -> OK
  - 全仓 `resolveAbility(` 已从 `87` 降到 `84`

## Addendum（2026-05-17 00:01 +08）：把 `miskatonic_lost_knowledge` 的业务 talent 测试收回 `USE_TALENT`

- [x] `madnessAbilities.test.ts` 中 `miskatonic_lost_knowledge` 的 3 条业务测试，已从 `resolveAbility('miskatonic_lost_knowledge', 'talent')` 改为真实 `runCommand(USE_TALENT)`。
- [x] 这轮同步把测试数据收紧到真实入口所需形状：基地上显式放入 `uid = ongoing-card` 的 ongoing action 实例，而不是只给 executor 一个 `defId` 假上下文。
- [x] 保留 1 条低层边界测试：`baseIndex: undefined` 时仍给额外随从。这条没有稳定公开命令入口，继续显式作为执行器合同保留，不和业务 talent 链混写。
- [x] 验证：
  - `madnessAbilities.test.ts -t "miskatonic_lost_knowledge"` -> 4 passed
  - `eslint madnessAbilities.test.ts` -> 0 errors
  - `npm run test:structure` -> OK
  - `rg -n "resolveAbility\\(" src/games/smashup/__tests__/madnessAbilities.test.ts` -> 从 7 处降到 6 处
  - 全仓 `resolveAbility(` 已从 `84` 降到 `83`

## Addendum（2026-05-17 00:06 +08）：把 `miskatonic_librarian_pod` 的业务 talent 链收回 `PLAY_MINION -> USE_TALENT`

- [x] `madnessAbilities.test.ts` 中 `miskatonic_librarian_pod extra mode queues the Madness onPlay interaction`，已从 `resolveAbility('miskatonic_librarian_pod', 'talent')` 改为真实两步公开链：
  - `runCommand(PLAY_MINION)` 先把图书管理员打到基地
  - `runCommand(USE_TALENT)` 再触发 talent
  - 后续继续用真实 prompt 响应选择 `extra` 与指定疯狂卡
- [x] 这条迁移把一个旧假设清掉了：之前测试默认“图书管理员不用先在场上也能直接点 talent”。真实链要求它先上场，这正是公开接口要保护的业务前置。
- [x] 验证：
  - `madnessAbilities.test.ts -t "miskatonic_librarian_pod extra mode queues the Madness onPlay interaction|miskatonic_lost_knowledge"` -> 5 passed
  - `eslint madnessAbilities.test.ts` -> 0 errors
  - `npm run test:structure` -> OK
  - `rg -n "resolveAbility\\(" src/games/smashup/__tests__/madnessAbilities.test.ts` -> 从 6 处降到 5 处
  - 全仓 `resolveAbility(` 已从 `83` 降到 `82`

## Addendum（2026-05-17 00:25 +08）：把 `ninja_acolyte` special 收回 `ACTIVATE_SPECIAL`，并明确 `hidden_ninja` 仍无公开命令入口

- [x] `baseFactionOngoing.test.ts` 中 `ninja_acolyte` 的业务 special 测试，已从 `resolveAbility('ninja_acolyte', 'special')` 改为真实 `runCommand(ACTIVATE_SPECIAL)`：
  - 成功激活时返回手牌并创建 `ninja_acolyte_play` prompt
  - `consumesNormalLimit=false` 的 extra-play 链继续通过真实 prompt 响应验证
- [x] 这轮不是单纯替换 helper，而是把“阻止路径”的合同也收回公开命令层：
  - 当同基地本回合已使用同组 special 时，`ACTIVATE_SPECIAL` 会在命令校验阶段直接失败
  - 因此原来“success=true 且 events=[]”的旧执行器断言，已改为“`success=false` + 明确错误消息 + 无事件”
- [x] 同时确认了一个需要保留的边界：`ninja_hidden_ninja` 目前没有可用的公开命令入口，`ACTIVATE_SPECIAL` 只接受场上随从/泰坦，拿手牌 action special 会触发“基地上没有该随从”校验失败；因此该组测试继续显式保留在执行器 special 合同层，不强行伪装成命令链。
- [x] 这轮之后，`baseFactionOngoing.test.ts` 里剩余 `resolveAbility(` 已收敛为：
  - 注册断言：`ninja_acolyte` / `ninja_hidden_ninja` / `trickster_mark_of_sleep`
  - 无公开命令入口的 `ninja_hidden_ninja` special 合同
  - off-phase immediate 合同：`trickster_enshrouding_mist`
- [x] 验证：
  - `baseFactionOngoing.test.ts -t "ninja_acolyte|ninja_hidden_ninja|consumesNormalLimit|specialLimitGroup"` -> 15 passed
  - `eslint baseFactionOngoing.test.ts` -> 0 errors
  - `npm run test:structure` -> OK
  - `rg -n "resolveAbility\\(" src/games/smashup/__tests__/baseFactionOngoing.test.ts` -> 从 12 处降到 7 处
  - 全仓 `resolveAbility(` 已从 `82` 降到 `76`

## Addendum（2026-05-17 00:36 +08）：继续把标准 onPlay 链从执行器收回真实出牌命令

- [x] `expansionOngoing.test.ts` 中 `ghost_make_contact / ghost_make_contact_pod` 的 3 条业务 onPlay 测试，已从 `resolveAbility(...)` 改为真实 `runCommand(PLAY_ACTION)`：
  - 唯一手牌时控制权转移
  - 非唯一手牌时命令校验失败
  - POD 版正常打出时也保留控制权转移合同
- [x] 这轮把旧测试里两个假前置清掉了：
  - 旧测试把“真实出牌会同时产生 `ACTION_PLAYED` 等系统事件”简化成“只有 1 个业务事件”；现在改为在真实事件流中定位 `MINION_CONTROL_CHANGED`
  - 旧 POD 测试甚至把牌从手牌里拿掉后还直调 executor；改回 `PLAY_ACTION` 后，测试必须让牌真的在手里
- [x] `expansionOngoing.test.ts` 中 `miskatonic_researcher`、`miskatonic_field_trip`、`miskatonic_researcher_pod` 的 5 条业务 onPlay 测试，已分别改为真实 `PLAY_MINION` / `PLAY_ACTION`：
  - `researcher`：先在手牌放入真实随从实例，再通过 `PLAY_MINION` 创建确认 prompt
  - `field_trip`：先在手牌放入真实行动卡，再通过 `PLAY_ACTION` 创建手牌选择 prompt
  - `researcher_pod`：通过 `PLAY_MINION` 驱动 draw -> choose minion -> +1 counter 链
- [x] 这轮进一步确认：很多旧执行器测试不只绕过了命令层，还绕过了“打出这张牌后手里是否还剩其他候选牌”这个公开行为前置。`field_trip` 第一次迁移红灯正是因为把自己打出去后，手里已经没有可选牌了；补回额外手牌后，prompt 才真实出现。
- [x] 这轮之后，`expansionOngoing.test.ts` 里剩余 `resolveAbility(` 已收敛为：
  - 注册断言：`miskatonic_researcher` / `miskatonic_field_trip`
  - 更复杂的 runtime/stale/low-level 合同：`steampunk_mechanic`、`venus_man_trap`、`return_to_the_sea`、`things_best_not_known_pod` 等
- [x] 验证：
  - `expansionOngoing.test.ts -t "ghost_make_contact|miskatonic_researcher|miskatonic_field_trip|researcher pod"` -> 11 passed
  - `eslint expansionOngoing.test.ts` -> 0 errors
  - `npm run test:structure` -> OK
  - `rg -n "resolveAbility\\('ghost_make_contact|resolveAbility\\('ghost_make_contact_pod|resolveAbility\\('miskatonic_researcher'|resolveAbility\\('miskatonic_field_trip'|resolveAbility\\('miskatonic_researcher_pod'" src/games/smashup/__tests__/expansionOngoing.test.ts` -> 只剩注册断言 2 处
  - 全仓 `resolveAbility(` 已从 `76` 降到 `68`

## Addendum（2026-05-17 00:44 +08）：继续收 `expansionOngoing` 的公开 talent / pod 行为链

- [x] `expansionOngoing.test.ts` 中 `steampunk_captain_ahab` 的 2 条业务 talent 测试，已从 `resolveAbility('steampunk_captain_ahab', 'talent')` 改为真实 `runCommand(USE_TALENT)`：
  - 多候选基地时创建 `steampunk_captain_ahab` base prompt
  - 唯一候选基地时直接移动且无 prompt
- [x] `miskatonic_field_trip_pod` 的 2 条业务 onPlay 测试，已从 `resolveAbility(...)` 改为真实 `runCommand(PLAY_ACTION)`：
  - 选项中保留 Madness 卡
  - 空选择时仍抽 1 张
- [x] `killer_plant_venus_man_trap` 的 3 条业务 talent 测试，已从 `resolveAbility(...)` 改为真实 `runCommand(USE_TALENT)`：
  - 唯一候选时自动抽牌/加额外随从/打出随从
  - 多候选时 prompt 响应继续保留基地上下文
  - stale deck 场景下，不会把已离开牌库的旧目标重复打出
- [x] 这轮进一步确认：真实 talent / action 命令会稳定带出 `TALENT_USED`、`DECK_REORDERED` 等系统事件，旧执行器测试如果继续锁“只有业务事件”或“固定事件条数”，仍然是在测旧壳层而不是公开行为。
- [x] 这轮之后，`expansionOngoing.test.ts` 里剩余 `resolveAbility(` 继续收敛为：
  - 注册断言：`steampunk_captain_ahab`、`miskatonic_researcher`、`miskatonic_field_trip`
  - 复杂 runtime/stale/afterScoring 合同：`steampunk_mechanic`、`steampunk_change_of_venue`、`innsmouth_return_to_the_sea`、`miskatonic_things_best_not_known_pod`、`miskatonic_librarian_pod`
- [x] 验证：
  - `expansionOngoing.test.ts -t "steampunk_captain_ahab|miskatonic_field_trip_pod"` -> 3 passed
  - `expansionOngoing.test.ts -t "venus man trap|力量≤2随从时产生搜索结果"` -> 3 passed
  - `eslint expansionOngoing.test.ts` -> 0 errors
  - `npm run test:structure` -> OK
  - `rg -n "resolveAbility\\('steampunk_captain_ahab|resolveAbility\\('miskatonic_field_trip_pod|resolveAbility\\('killer_plant_venus_man_trap" src/games/smashup/__tests__/expansionOngoing.test.ts` -> 只剩各自的注册断言
  - 全仓 `resolveAbility(` 已从 `68` 降到 `61`

## Addendum（2026-05-17 01:00 +08）：继续把 `expansionOngoing` 的真实出牌/响应窗口入口收回公开命令

- [x] `steampunk_mechanic` 的 8 条业务/运行时测试已不再从 `resolveAbility('steampunk_mechanic', 'onPlay')` 起步：
  - 普通业务链统一改为真实 `runCommand(PLAY_MINION)` 产出 prompt
  - 两条非法值/二次合法性检查继续保留 runtime prompt handler 合同，但前置 prompt 改由真实出牌链创建
- [x] `steampunk_change_of_venue` 的 stale-hand 用例已从执行器改为真实 `runCommand(PLAY_ACTION)` 起链，再走 live prompt 响应
- [x] `miskatonic_librarian_pod extra mode only plays Madness and marks extra action` 已从 talent executor 改为真实 `PLAY_MINION -> USE_TALENT -> respond`
- [x] `miskatonic_things_best_not_known_pod` 已确认存在稳定公开入口：在 beforeScoring 响应窗口里走真实 `PLAY_ACTION`，不再手工直喂 `special` executor
- [x] `innsmouth_return_to_the_sea` 已确认存在稳定 afterScoring 公开入口：通过真实 afterScoring response window `PLAY_ACTION` 打出后立即进入 `innsmouth_return_to_the_sea` prompt，不再手工直喂 `special` executor
- [x] 这轮同时修正了一条旧测试语义：`steampunk_mechanic` 下原“无合法基地”断言其实依赖“机械师本人尚未真正上场”的假世界。切回真实 `PLAY_MINION` 后，`requireOwnMinion` 约束会因为机械师已在基地而变真，因此该用例已改写为真实公开行为断言，而不是继续保护旧 executor 壳层
- [x] 这轮之后，`expansionOngoing.test.ts` 里的剩余 `resolveAbility(` 已收敛到 6 处：
  - 注册断言：`steampunk_captain_ahab`、`killer_plant_venus_man_trap`、`innsmouth_return_to_the_sea`、`miskatonic_researcher`、`miskatonic_field_trip`
  - 仍待判断的业务 onPlay：`killer_plant_blossom`
- [x] 验证：
  - `expansionOngoing.test.ts -t "steampunk_mechanic|steampunk_change_of_venue|innsmouth_return_to_the_sea|things best not known pod|librarian pod extra mode"` -> 13 passed
  - `expansionOngoing.test.ts` -> 67 passed
  - `eslint expansionOngoing.test.ts` -> 0 errors
  - `npm run test:structure` -> OK
  - `rg -n "resolveAbility\\(" src/games/smashup/__tests__/expansionOngoing.test.ts` -> 6
  - 全仓 `resolveAbility(` 已从 `61` 降到 `49`

## Addendum（2026-05-17 01:06 +08）：`expansionOngoing` 的业务型 executor seam 已收干净

- [x] `killer_plant_blossom` 已从 `resolveAbility('killer_plant_blossom', 'onPlay')` 改为真实 `runCommand(PLAY_ACTION)`：
  - 不再只锁内部返回的 3 条 `LIMIT_MODIFIED`
  - 改为锁公开行为：`ACTION_PLAYED` 存在、无 prompt、`sameNameMinionRemaining === 3`、`sameNameMinionDefId === null`、行动已离手进弃牌、`actionsPlayed === 1`
- [x] 这轮后 `expansionOngoing.test.ts` 中剩余 `resolveAbility(` 已全部收敛为“注册表存在性合同”：
  - `steampunk_captain_ahab`
  - `killer_plant_venus_man_trap`
  - `innsmouth_return_to_the_sea`
  - `miskatonic_researcher`
  - `miskatonic_field_trip`
- [x] 因此该文件下一步不该再机械追求 `resolveAbility(` 归零；应转去别的测试文件继续收割“业务行为却直调 executor”的剩余热点，把纯注册合同单独视为低层存在性断言。
- [x] 验证：
  - `expansionOngoing.test.ts -t "killer_plant_blossom"` -> 1 passed
  - `eslint expansionOngoing.test.ts` -> 0 errors
  - `expansionOngoing.test.ts` -> 67 passed
  - `npm run test:structure` -> OK
  - `rg -n "resolveAbility\\(" src/games/smashup/__tests__/expansionOngoing.test.ts` -> 5
  - 全仓 `resolveAbility(` 已从 `49` 降到 `48`

## Addendum（2026-05-17 01:19 +08）：`elder-things-ongoing` 的 beforeScoring special 已收回真实公开入口

- [x] `src/games/smashup/__tests__/abilities/elder-things-ongoing.test.ts` 中 `elder_thing_the_price_of_power` 的 3 条 special 测试，已从 `resolveAbility('elder_thing_the_price_of_power', 'special')` 改为真实 `runCommand(PLAY_ACTION)` + Me First! beforeScoring response window：
  - 新增 `attachBeforeScoringWindow(...)`，用真实 `startSmashUpReactionSession(...)` 构造 `score-before` 窗口。
  - 基地夹具从默认 `test_base` 改成真实 `base_the_jungle`，避免真实 `scoreOneBase` 继续推进时因缺少 `vpAwards` 崩掉。
  - 对手手牌夹具同步改成真实已注册行动卡 / Madness 定义，不再用不存在的 `test_card`。
- [x] 这轮还暴露并纠正了 1 条旧语义：`对手在此基地无随从` 不是“命令层拒绝打出”，而是“可以打出，但没有额外 reveal / 加指示物效果”。测试现已改为锁公开结果，而不是继续保护旧 executor 预过滤。
- [x] 这轮后 `elder-things-ongoing.test.ts` 中 `resolveAbility(` 已归零；该文件当前不再保留业务型 executor seam。
- [x] 验证：
  - `elder-things-ongoing.test.ts -t "elder_thing_the_price_of_power special"` -> 3 passed
  - `elder-things-ongoing.test.ts` -> 16 passed
  - `eslint elder-things-ongoing.test.ts` -> 0 errors
  - `npm run test:structure` -> OK
  - `rg -n "resolveAbility\\(" src/games/smashup/__tests__/abilities/elder-things-ongoing.test.ts` -> 0 命中
  - 全仓 `resolveAbility(` 已从 `48` 降到 `41`

## Addendum（2026-05-17 01:26 +08）：继续收掉 `elderThing` 系列的普通 onPlay 行为测试

- [x] `src/games/smashup/__tests__/elderThingAbilities.test.ts` 中 `elder_thing_mi_go` 的 3 条业务 onPlay 测试，已从 `resolveAbility('elder_thing_mi_go', 'onPlay')` 改为真实 `runCommand(PLAY_MINION)`：
  - 打出后创建对手选择 prompt
  - 对手选择抽 Madness
  - 对手拒绝后施法者抽牌
- [x] `src/games/smashup/__tests__/elder-thing-choice-goju-tiebreak.test.ts` 中复用的 `triggerElderThingOnPlay(...)` helper 已从 fake `matchState + resolveAbility(...)` 改为真实 `runCommand(PLAY_MINION)`，整组 `elder_thing_elder_thing_choice` 行为测试随之回到公开入口：
  - 选择 destroy 后的第一步/第二步多段选择
  - 仅 2 个目标时的自动消灭
  - 选择 deckbottom 的 live / stale 合同
- [x] 这轮后：
  - `elderThingAbilities.test.ts` 只剩 2 条 off-phase extra-timing 合同
  - `elder-thing-choice-goju-tiebreak.test.ts` 的 `resolveAbility(` 已归零
  - 全仓 `resolveAbility(` 已从 `41` 降到 `38`
- [x] 验证：
  - `elderThingAbilities.test.ts -t "elder_thing_mi_go（米-格：对手抽疯狂卡或你抽牌）"` -> 3 passed
  - `elderThingAbilities.test.ts` -> 25 passed
  - `elder-thing-choice-goju-tiebreak.test.ts -t "远古之物：消灭两个随从选择权"` -> 6 passed
  - `elder-thing-choice-goju-tiebreak.test.ts` -> 10 passed
  - `eslint elderThingAbilities.test.ts elder-thing-choice-goju-tiebreak.test.ts` -> 0 errors
  - `npm run test:structure` -> OK

## Addendum（2026-05-17 01:39 +08）：把低层 ability executor 合同也收进统一 helper，而不是继续裸露 `resolveAbility(...)`

- [x] 在 [src/games/smashup/__tests__/helpers.ts](D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/helpers.ts) 新增：
  - `expectRegisteredAbilityContract(defId, tag)`
  - `invokeRegisteredAbilityContract(defId, tag, ctx)`
- [x] 这轮不把剩余 off-phase / 无公开入口场景硬改成业务命令链，而是把它们显式标记为“低层能力合同测试入口”。
- [x] 已切换到新 helper 的文件：
  - `madnessAbilities.test.ts`
  - `elderThingAbilities.test.ts`
  - `factionAbilities.test.ts`
  - `zombieWizardAbilities.test.ts`
  - `abilities/killer-plants.test.ts`
  - `madnessPromptAbilities.test.ts`
- [x] 这使测试分层更清楚：
  - 真实玩家业务链继续优先 `runCommand(...)`
  - 只有确实要测 off-phase extra-timing / special 无公开命令入口 / 低层能力边界时，才走 `invokeRegisteredAbilityContract(...)`
  - 测试体不再直接从注册表拿 executor 再手调
- [x] 最新统计：`src/games/smashup/__tests__` 中裸 `resolveAbility(` 已收敛到 `25` 处，且最新分布只剩：
  - `baseFactionOngoing.test.ts` 7
  - `abilityRegistry.test.ts` 5
  - `expansionOngoing.test.ts` 5
  - `properties/coreProperties.test.ts` 4
  - `elderThingsPod.test.ts` 1
  - `expansionAbilities.test.ts` 1
  - `helpers.ts` 1
  - `shoggoth-destroy-choice.test.ts` 1
- [x] 验证：
  - `madnessAbilities.test.ts` -> 32 passed
  - `elderThingAbilities.test.ts factionAbilities.test.ts zombieWizardAbilities.test.ts abilities/killer-plants.test.ts madnessPromptAbilities.test.ts` -> 138 passed
  - `eslint helpers.ts madnessAbilities.test.ts elderThingAbilities.test.ts factionAbilities.test.ts zombieWizardAbilities.test.ts abilities/killer-plants.test.ts madnessPromptAbilities.test.ts` -> 0 errors
  - `npm run test:structure` -> OK

## Addendum（2026-05-17 01:46 +08）：把剩余业务/能力文件中的裸 `resolveAbility(...)` 清到只剩注册表/属性合同

- [x] `baseFactionOngoing.test.ts`
  - 删除 3 条局部冗余的能力已注册断言：`ninja_acolyte` / `ninja_hidden_ninja` / `trickster_mark_of_sleep`
  - `ninja_hidden_ninja` 的 3 条 low-level special 合同统一改走 `invokeRegisteredAbilityContract(...)`
  - `trickster_enshrouding_mist` 的 off-phase immediate 合同改走 `invokeRegisteredAbilityContract(...)`
- [x] `expansionOngoing.test.ts`
  - 删除 5 条局部冗余的能力已注册断言：`steampunk_captain_ahab` / `killer_plant_venus_man_trap` / `innsmouth_return_to_the_sea` / `miskatonic_researcher` / `miskatonic_field_trip`
  - 该文件内裸 `resolveAbility(` 已归零
- [x] 单点 low-level ability 合同统一改 helper：
  - `elderThingsPod.test.ts`：`elder_thing_touch_of_madness_pod`
  - `expansionAbilities.test.ts`：`killer_plant_insta_grow`
  - `shoggoth-destroy-choice.test.ts`：`elder_thing_shoggoth`
- [x] 测试规范已同步补强：
  - [docs/testing-best-practices.md](D:/gongzuo/webgame/BoardGame/docs/testing-best-practices.md)
  - [docs/automated-testing.md](D:/gongzuo/webgame/BoardGame/docs/automated-testing.md)
  - 明确 low-level ability / interaction / runtime resolver 合同应优先通过 `__tests__/helpers.ts` 的显式 contract helper 进入
- [x] 最新分布已收敛到只剩 3 个预期文件：
  - `abilityRegistry.test.ts` 5
  - `properties/coreProperties.test.ts` 4
  - `helpers.ts` 1
- [x] 验证：
  - `baseFactionOngoing.test.ts expansionOngoing.test.ts elderThingsPod.test.ts expansionAbilities.test.ts shoggoth-destroy-choice.test.ts` -> 191 passed
  - `eslint baseFactionOngoing.test.ts expansionOngoing.test.ts elderThingsPod.test.ts expansionAbilities.test.ts shoggoth-destroy-choice.test.ts` -> 0 errors
  - `npm run test:structure` -> OK
  - 全仓 `resolveAbility(` -> `10`

## Addendum（2026-05-17 01:50 +08）：删掉 `coreProperties` 里的局部 onPlay 注册噪音，剩余命中全部变成预期低层合同

- [x] `src/games/smashup/__tests__/properties/coreProperties.test.ts`
  - 删除 `Property 5` 中“所有已知 onPlay 随从都已注册能力”这条局部重复断言。
  - 保留 `Property 4` 的 3 处 `resolveAbility(...)`，因为它们本身就在测注册表往返一致性与未注册返回 `undefined`。
- [x] 这一步把最后边界彻底拉清：
  - `abilityRegistry.test.ts`：注册表本体合同
  - `properties/coreProperties.test.ts`：注册表属性合同
  - `helpers.ts`：统一 low-level ability contract 入口
- [x] 同步收掉 `coreProperties.test.ts` 的 2 条 eslint warning（未使用类型导入、未使用局部变量），避免留下“测试绿了但文件仍脏”的尾巴。
- [x] 最新统计：
  - 全仓 `resolveAbility(` -> `9`
  - 剩余分布：
    - `abilityRegistry.test.ts` 5
    - `properties/coreProperties.test.ts` 3
    - `helpers.ts` 1
- [x] 验证：
  - `coreProperties.test.ts` -> 53 passed
  - `eslint coreProperties.test.ts` -> 0 errors / 0 warnings
  - `npm run test:structure` -> OK

## Addendum（2026-05-17 01:56 +08）：把 `resolveAbility(...)` 的 seam 约束固化进结构门禁，并顺手清理近期测试日志残留

- [x] `scripts/infra/testing-structure-guard.mjs`
  - 新增 `resolveAbility(...)` 门禁：非白名单游戏测试文件不得新增裸 `resolveAbility(...)`。
  - 当前白名单只保留：
    - `src/games/smashup/__tests__/abilityRegistry.test.ts`
    - `src/games/smashup/__tests__/properties/coreProperties.test.ts`
  - 统一要求业务/能力测试改走真实命令入口，low-level ability 合同改走 `invokeRegisteredAbilityContract(...)`。
- [x] 规范文档同步：
  - [docs/testing-best-practices.md](D:/gongzuo/webgame/BoardGame/docs/testing-best-practices.md)
  - [docs/automated-testing.md](D:/gongzuo/webgame/BoardGame/docs/automated-testing.md)
- [x] 清掉两处近期已经不再需要的测试调试日志：
  - `src/games/smashup/__tests__/elderThingsPod.test.ts`
  - `src/games/smashup/__tests__/ninja-hidden-ninja-interaction-bug-repro.test.ts`
- [x] 验证：
  - `npm run test:structure` -> OK
  - `node scripts/infra/testing-structure-guard.mjs coreProperties.test.ts expansionOngoing.test.ts baseFactionOngoing.test.ts abilityRegistry.test.ts` -> OK
  - `eslint scripts/infra/testing-structure-guard.mjs elderThingsPod.test.ts ninja-hidden-ninja-interaction-bug-repro.test.ts` -> 0 errors
  - `elderThingsPod.test.ts ninja-hidden-ninja-interaction-bug-repro.test.ts` -> 14 passed

## Addendum（2026-05-17 02:38 +08）：收掉 SmashUp 测试目录最后 4 处 `console.*`，并把 audit 失败信息直接提升为断言消息

- [x] `src/games/smashup/__tests__/interactionDefIdAudit.test.ts`
  - 删除 4 处 `console.log(...)`。
  - 新增 `expectNoViolations(...)`，把违规清单直接拼进失败消息，不再先打印再失败。
  - 审计逻辑本身不变，仍然逐项检查 `defId/minionDefId/baseDefId` 与 shorthand 变量解析。
- [x] `src/games/smashup/__tests__` 中测试文件级 `console.*` 已降到 `0`：
  - `rg -n "console\\.(log|warn|error|debug)\\(" src/games/smashup/__tests__` -> 0 命中
- [x] 验证口径已拆开：
  - `npm run test:games:audit -- src/games/smashup/__tests__/interactionDefIdAudit.test.ts` 会把整套 audit 一起跑起，当前存在大量仓内既有红灯，不能用来判断本次单文件改动是否正确。
  - `node scripts/infra/vitest-cli-safe.mjs run --config vitest.config.audit.ts --configLoader native src/games/smashup/__tests__/interactionDefIdAudit.test.ts` 已定点验证目标文件。
- [x] 当前定点结果：
  - `interactionDefIdAudit.test.ts` 共 2 条，`value shorthand` 审计通过。
  - `defId` 审计仍按预期失败，但失败信息已直接带出当前真实违规清单：
    - `vampires.ts:594` 缺 `minionDefId/baseDefId`
    - `vampires.ts:1168` 缺 `minionDefId/baseDefId`
- [ ] 下一步不再是清日志，而是判断是否继续修 `vampires.ts` 这 4 个真实审计红灯，以及是否顺带收敛其它 SmashUp interaction audit 红灯。

## Addendum（2026-05-17 02:41 +08）：把 `interactionDefIdAudit` 的真实红灯一并收口

- [x] `src/games/smashup/abilities/vampires.ts`
  - `vampire_heavy_drinker`
  - `vampire_heavy_drinker_pod`
  - 两处选项 value 现已显式补齐 `minionDefId` 与 `baseDefId`，同时保留 `defId/baseIndex` 兼容当前 `onResolve`。
  - `onResolve` 已改为优先消费 `minionDefId`，并回退兼容旧 `defId`。
- [x] `src/games/smashup/__tests__/interactionDefIdAudit.test.ts` 已从“输出更干净但仍红”推进到真正定点转绿：
  - `node scripts/infra/vitest-cli-safe.mjs run --config vitest.config.audit.ts --configLoader native src/games/smashup/__tests__/interactionDefIdAudit.test.ts` -> 2 passed
- [x] 行为回归：
  - `npx vitest run src/games/smashup/__tests__/abilities/vampires.test.ts -t "vampire_heavy_drinker|海量酒鬼|Heavy Drinker"` -> 1 passed / 7 skipped
- [x] 当前状态：
  - `src/games/smashup/__tests__` 中 `console.*` 仍保持 `0`
  - `interactionDefIdAudit` 已收口
- [ ] 下一步候选：
  - 继续处理更大范围的 `interactionDisplayModeAudit.test.ts`
  - 或 `interactionTargetTypeAudit.test.ts`
  - 这两批已不再是“测试壳层清理”，而是统一 interaction option 元数据规范的另一条收口线

## Addendum（2026-05-17 02:59 +08）：继续把 interaction metadata audit 从“局部绿”推进到结构化收口

- [x] `interactionTargetTypeAudit.test.ts` 已定点收口：
  - `bear_cavalry_superiority_pod_talent`
  - `bear_cavalry_general_ivan_pod_trigger`
  - `bear_cavalry_high_ground_pod_trigger`
  - 三处按钮分支从 `targetType: 'generic'` 改为 `button`
  - `tornados_ripped_off_target` 拆成 `tornados_ripped_off_target_base` / `tornados_ripped_off_target_minion`，解除一号多义
  - `APPROVED_GENERIC_SOURCE_REASONS` 已补齐 `mythic_greeks_favor_of_athena_order/pick`、`tornados_ripped_off`、`vampire_crack_of_dusk_pod`，并删掉已不再 generic 的熊骑兵登记项
  - 验证：`node scripts/infra/vitest-cli-safe.mjs run --config vitest.config.audit.ts --configLoader native src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts` -> 7 passed
- [x] `interactionDisplayModeAudit.test.ts` 已从 4 个失败项压到只剩 1 个失败项：
  - 已收口：
    - `按钮语义选项必须显式声明 button displayMode`
    - `实体卡牌/基地选项必须显式声明 card displayMode`
  - 本轮改动：
    - `bear_cavalry.ts`：补齐多处按钮 skip/yes/no 的 `displayMode: 'button'`
    - `ghosts.ts`：`ghost_spirit_confirm` 补齐按钮 `displayMode`
    - `pirates.ts`：`pirate_first_mate_choose_base` 基地选项补齐 `displayMode: 'card'`
    - `abilityHelpers.ts`：`buildMinionTargetOptions(...)` 统一补齐 `minionDefId/baseDefId`
    - `vampires.ts`：补齐 Dinner Date / Cull the Weak / The Count / Fledgling / Wolf Pact 等直接卡面选项的 `defId/minionDefId/baseDefId`
    - `fairies.ts`、`innsmouth.ts`、`tricksters.ts`、`titans.ts`、`baseAbilities_expansion.ts`：继续补齐直接字面量 option value 的可渲染 id 字段
  - 当前定点结果：
    - `所有卡牌选项都包含 defId 字段` -> 已通过
    - `显式 card displayMode 的选项必须提供可渲染 defId` -> 仍失败，剩余 9 个点位
- [x] 行为回归已覆盖这批 metadata 改动的真实链路：
  - `src/games/smashup/__tests__/abilities/bear-cavalry.test.ts` -> 3 passed（聚焦熊骑兵相关 prompt 分支）
  - `src/games/smashup/__tests__/abilities/pirates-ongoing.test.ts` -> 2 passed（聚焦大副基地选择）
  - `src/games/smashup/__tests__/abilities/vampires.test.ts` -> 8 passed
  - `src/games/smashup/__tests__/expansionOngoing.test.ts -t "innsmouth_return_to_the_sea|回归大海"` -> 1 passed
  - `src/games/smashup/__tests__/expansionBaseAbilities.test.ts -t "base_mermaid_pool|base_the_asylum_choose_minion|人鱼水池|庇护所"` -> 1 passed
- [ ] 当前下一步最合理：
  - 继续清 `interactionDisplayModeAudit.test.ts` 最后剩余 9 个点位
  - 剩余主要集中在：
    - `aliens.ts`
    - `mythic_greeks.ts`
    - `shayu_common.ts`
    - `titans.ts`（Sphinx）
    - `tornados.ts`

## Addendum（2026-05-17 03:31 +08）：继续把巨型派系测试按能力簇迁出，先收掉 Aliens

- [x] `src/games/smashup/__tests__/abilities/aliens.test.ts` 已从“只有 `alien_jammed_signal` 基地压制”扩成完整 `Aliens` 能力簇入口文件：
  - 保留原有 `alien_jammed_signal` 基地/扩展基地压制回归。
  - 新迁入 `alien_invader`、`alien_collector`、`alien_supreme_overlord`、`alien_disintegrator`、`alien_crop_circles`。
  - 新测试统一走真实 `PLAY_MINION` / `PLAY_ACTION` + prompt facade / `respondCommand(...)`，不回退到旧执行器入口。
- [x] `src/games/smashup/__tests__/factionAbilities.test.ts` 已删除整段 `外星人派系能力`：
  - 泛名大文件继续瘦身，只保留尚未拆出的能力簇。
  - 同时清理迁出后残留的 `respondCommand` 无用 import，避免“逻辑拆走了，壳层垃圾还留着”。
- [x] 本阶段验证完成：
  - `npx vitest run src/games/smashup/__tests__/abilities/aliens.test.ts` -> 8 passed
  - `npx vitest run src/games/smashup/__tests__/abilities/aliens.test.ts src/games/smashup/__tests__/factionAbilities.test.ts` -> 37 passed
  - `npx eslint src/games/smashup/__tests__/abilities/aliens.test.ts src/games/smashup/__tests__/factionAbilities.test.ts` -> 0 errors / 0 warnings
  - `npm run test:structure -- --all` -> checked files: 48，OK
- [ ] 下一步继续按同一原则处理剩余巨型派系簇：
  - 优先选同一 describe 内仍混有真实出牌链 + 历史夹具入口的能力簇。
  - 目标不是把 `factionAbilities.test.ts` 机械拆小，而是让每个能力簇都收口到更稳定的公开行为 seam。

## Addendum（2026-05-17 03:37 +08）：继续收掉恐龙 action 簇，并优先并入现有专项文件

- [x] `src/games/smashup/__tests__/abilities/dinosaurs.test.ts` 已吸收原 `factionAbilities.test.ts` 的恐龙 action 回归：
  - 新迁入 `dino_rampage`
  - `dino_augmentation`
  - `dino_howl`
  - `dino_natural_selection`
  - `dino_survival_of_the_fittest`
  - 仍统一走真实 `PLAY_ACTION` + prompt facade，不回退旧执行器入口。
- [x] `src/games/smashup/__tests__/factionAbilities.test.ts` 已删除整段 `恐龙派系能力`：
  - 泛名大文件从 29 tests 进一步降到 20 tests。
  - 同时清理迁移后残留的 `getPromptOptions` / `expectNoPrompt` 无用 import。
- [x] 本阶段验证完成：
  - `npx vitest run src/games/smashup/__tests__/abilities/dinosaurs.test.ts src/games/smashup/__tests__/factionAbilities.test.ts` -> 32 passed
  - `npx eslint src/games/smashup/__tests__/abilities/dinosaurs.test.ts src/games/smashup/__tests__/factionAbilities.test.ts` -> 0 errors / 0 warnings
  - `npm run test:structure -- --all` -> checked files: 49，OK
- [ ] 下一步候选：
  - 继续挑 `factionAbilities.test.ts` 中剩余且自然成簇的派系段落。
  - 优先级上，已有专项文件可吸收的，优先并到现有文件；只有没有稳定归宿时才新开文件。

## Addendum（2026-05-17 03:49 +08）：连续迁出海盗 / 巫师 / 机器人 / 立即额外行动，`factionAbilities.test.ts` 基本只剩尾项

- [x] `src/games/smashup/__tests__/abilities/pirates-ongoing.test.ts` 已吸收原 `factionAbilities.test.ts` 的海盗 action 回归：
  - `pirate_broadside`
  - `pirate_cannon`
  - `pirate_swashbuckling`
  - 虽然文件名还是 `pirates-ongoing`，但内容本来就已含 `pirate_full_sail special`，继续作为单一海盗专项边界是合理的。
- [x] 新增 `src/games/smashup/__tests__/abilities/wizards.test.ts`：
  - 迁入 `wizard_neophyte`
  - `wizard_neophyte_pod`
  - `wizard_enchantress`
  - `wizard_mystic_studies`
  - 作为巫师通用能力簇入口，和已有更窄的 `wizard-neophyte-actionlog.test.ts` / `wizard-neophyte-ongoing.test.ts` / `wizard-archmage-*.test.ts` 并存，不互相吞职责。
- [x] 新增 `src/games/smashup/__tests__/abilities/robots.test.ts`：
  - 迁入 `robot_zapbot`
  - `robot_tech_center`
  - `robot_microbot_fixer + base_the_homeworld`
- [x] 新增 `src/games/smashup/__tests__/abilities/immediate-extra-action.test.ts`：
  - 迁出原本混在派系文件中的共享“立即额外行动”交互组
  - 这个块本质不是某个派系，而是跨能力共享交互，不应继续留在 `factionAbilities.test.ts`
- [x] `src/games/smashup/__tests__/factionAbilities.test.ts` 当前只剩 2 条尾项：
  - `ghost extra timing audit`
  - `ninja_seeing_stars`
  - 说明这份历史泛名文件已经从“能力大杂烩”压到“待归宿的零散尾项”。
- [x] 验证完成：
  - `npx vitest run src/games/smashup/__tests__/abilities/pirates-ongoing.test.ts src/games/smashup/__tests__/factionAbilities.test.ts` -> 38 passed
  - `npx vitest run src/games/smashup/__tests__/abilities/wizards.test.ts src/games/smashup/__tests__/factionAbilities.test.ts` -> 16 passed
  - `npx vitest run src/games/smashup/__tests__/abilities/robots.test.ts src/games/smashup/__tests__/factionAbilities.test.ts` -> 11 passed
  - `npx vitest run src/games/smashup/__tests__/abilities/immediate-extra-action.test.ts src/games/smashup/__tests__/factionAbilities.test.ts` -> 6 passed
  - 上述对应 `eslint` 均为 `0 errors / 0 warnings`
  - `npm run test:structure -- --all` 最新为 checked files: 52，OK
- [ ] 下一步候选：
  - 给 `ninja_seeing_stars` 找归宿，评估是否新开 `abilities/ninjas.test.ts`
  - 重新安置 `ghost extra timing audit`，避免它继续挂在“派系能力”旧壳里
  - 然后再评估是否可以彻底删除或改名 `factionAbilities.test.ts`

## Addendum（2026-05-17 03:54 +08）：`factionAbilities.test.ts` 已完成退场

- [x] 新增 `src/games/smashup/__tests__/abilities/ninjas.test.ts`
  - 承接原尾项 `ninja_seeing_stars`
- [x] `src/games/smashup/__tests__/expansionAbilities.test.ts`
  - 已把 `ghost_ghostly_arrival` 的 off-phase `playTiming === 'immediate'` 合同断言并入幽灵专项块
- [x] `src/games/smashup/__tests__/factionAbilities.test.ts`
  - 已删除文件本体，不再保留这份历史泛名壳
- [x] 本阶段验证完成：
  - `npx vitest run src/games/smashup/__tests__/abilities/ninjas.test.ts src/games/smashup/__tests__/expansionAbilities.test.ts` -> 34 passed
  - `npx eslint src/games/smashup/__tests__/abilities/ninjas.test.ts src/games/smashup/__tests__/expansionAbilities.test.ts` -> 0 errors / 0 warnings
  - `npm run test:structure -- --all` -> checked files: 52，OK
- [ ] 下一步候选：
  - 扫描 SmashUp 里剩余仍承担“多能力簇 / 多语义壳层”的历史测试文件
  - 优先挑那些还在混放行为回归、prompt 链、contract 断言的老文件继续拆

## Addendum（2026-05-17 04:04 +08）：`query6Abilities.test.ts` 已完成退场

- [x] `src/games/smashup/__tests__/abilities/ninjas.test.ts`
  - 已继续吸收原 `query6Abilities.test.ts` 的忍者簇：
  - `ninja_way_of_deception`
  - `ninja_disguise`
- [x] `src/games/smashup/__tests__/abilities/pirates-ongoing.test.ts`
  - 已吸收原 `query6Abilities.test.ts` 的海盗 action/prompt 回归：
  - `pirate_dinghy`
  - `pirate_shanghai`
  - `pirate_sea_dogs`
  - `pirate_powderkeg`
  - 文件名虽然保留 `pirates-ongoing`，但该文件现在已稳定承担“海盗专项行为入口”，比继续留在“第6批混装文件”更准确。
- [x] `src/games/smashup/__tests__/abilities/wizards.test.ts`
  - 已吸收原 `query6Abilities.test.ts` 的巫师簇：
  - `wizard_mass_enchantment`
  - `wizard_portal`
  - `wizard_portal_order`
  - `wizard_scry`
  - `wizard_sacrifice`
  - `wizard_winds_of_change`
  - 这些用例继续统一走真实 `PLAY_ACTION` / `PLAY_MINION`、prompt facade 与 `refreshInteractionOptions`，不是回退到旧 helper 形状。
- [x] `src/games/smashup/__tests__/abilities/aliens.test.ts`
  - 已吸收原 `query6Abilities.test.ts` 的 `alien_scout`
- [x] `src/games/smashup/__tests__/query6Abilities.test.ts`
  - 已删除文件本体，不再保留这份按“第6批”混装的历史壳
- [x] 本阶段验证完成：
  - `npx vitest run src/games/smashup/__tests__/abilities/ninjas.test.ts src/games/smashup/__tests__/query6Abilities.test.ts` -> 31 passed（忍者迁移完成后、文件删除前）
  - `npx eslint src/games/smashup/__tests__/abilities/ninjas.test.ts src/games/smashup/__tests__/query6Abilities.test.ts` -> 0 errors / 0 warnings（文件删除前）
  - `npx vitest run src/games/smashup/__tests__/abilities/pirates-ongoing.test.ts src/games/smashup/__tests__/abilities/wizards.test.ts src/games/smashup/__tests__/abilities/aliens.test.ts` -> 59 passed
  - `npx eslint src/games/smashup/__tests__/abilities/pirates-ongoing.test.ts src/games/smashup/__tests__/abilities/wizards.test.ts src/games/smashup/__tests__/abilities/aliens.test.ts` -> 0 errors / 0 warnings
  - `npm run test:structure -- --all` -> checked files: 52，OK
- [ ] 下一步候选：
  - 继续扫描 SmashUp 中仍然按“批次 / 杂项 / 大而泛”组织的历史测试文件
  - 优先选择那些还混着多个派系行为、prompt 链与合同断言的文件继续拆

## Addendum（2026-05-17 04:09 +08）：`robotAbilities.test.ts` 已完成退场

- [x] `src/games/smashup/__tests__/abilities/robots.test.ts`
  - 已继续吸收原 `robotAbilities.test.ts` 的机器人簇：
  - `robot_microbot_reclaimer`
  - `robot_microbot_fixer`
  - `robot_microbot_reclaimer onPlay extra play`
  - 包括动态 `optionsGenerator` 刷新、AI legal actions 过期候选防线，以及“先解交互再使用额外随从额度”的真实链路。
- [x] `src/games/smashup/__tests__/robotAbilities.test.ts`
  - 已删除文件本体，不再保留“根目录机器人旧入口”和 `abilities/robots.test.ts` 双入口并存状态
- [x] 本阶段验证完成：
  - `npx vitest run src/games/smashup/__tests__/robotAbilities.test.ts src/games/smashup/__tests__/abilities/robots.test.ts` -> 16 passed（删除前基线）
  - `npx eslint src/games/smashup/__tests__/robotAbilities.test.ts src/games/smashup/__tests__/abilities/robots.test.ts` -> 0 errors / 0 warnings（删除前基线）
  - `npx vitest run src/games/smashup/__tests__/abilities/robots.test.ts` -> 16 passed
  - `npx eslint src/games/smashup/__tests__/abilities/robots.test.ts` -> 0 errors / 0 warnings
  - `npm run test:structure -- --all` -> checked files: 52，OK
  - `Test-Path src\\games\\smashup\\__tests__\\robotAbilities.test.ts` -> False
- [ ] 下一步候选：
  - 优先检查 `zombieWizardAbilities.test.ts` 这类仍把 reducer 合同、僵尸能力和巫师能力混在一起的文件
  - 判断是继续拆到 `abilities/wizards.test.ts` / 新建 `abilities/zombies.test.ts`，还是把 reducer 合同先独立出去

## Addendum（2026-05-17 04:19 +08）：`ghostsAbilities.test.ts` 已完成退场

- [x] 新增 `src/games/smashup/__tests__/abilities/ghosts.test.ts`
  - 已承接原 `ghostsAbilities.test.ts` 的幽灵普通行为入口：
  - `ghost_make_contact`
  - `ghost_make_contact_pod`
  - 继续统一走真实 `PLAY_ACTION` 命令链，而不是保留根目录旧入口壳层。
- [x] `src/games/smashup/__tests__/ghostsAbilities.test.ts`
  - 已删除文件本体，不再保留“根目录幽灵旧入口”和其它幽灵专项文件并存的状态
- [x] 本阶段验证完成：
  - `npx vitest run src/games/smashup/__tests__/abilities/ghosts.test.ts src/games/smashup/__tests__/expansionAbilities.test.ts` -> 41 passed
  - `npx eslint src/games/smashup/__tests__/abilities/ghosts.test.ts src/games/smashup/__tests__/expansionAbilities.test.ts` -> 0 errors / 0 warnings
  - `npm run test:structure -- --all` -> checked files: 54，OK
  - `Test-Path src\\games\\smashup\\__tests__\\ghostsAbilities.test.ts` -> False
- [ ] 下一步候选：
  - 优先继续扫描根目录仍按旧口径挂着的单派系/临时整合入口，例如 `shayuFactionAbilities.test.ts`
  - `zombieInteractionChain.test.ts` 虽然体量大，但已经更接近“派系 + 交互链”专项文件，优先级低于明显旧入口
  - `expansionAbilities.test.ts` / `expansionOngoing.test.ts` 体量仍大，但属于扩展包聚合文件，后续要按行为边界谨慎拆，不急着硬切

## Addendum（2026-05-17 07:40 +08）：`shayuFactionAbilities.test.ts` 已完成按三派系拆分并退场

- [x] 新增 `src/games/smashup/__tests__/abilities/sharks.test.ts`
  - 已承接原 `shayuFactionAbilities.test.ts` 的鲨鱼代表性行为：
  - `sharks_torn_apart`
  - `sharks_feeding_frenzy`
  - `sharks_air_jaws`
  - `sharks_freakin_laser_beam`
  - `sharks_week_of_sharks`
  - `sharks_dangerous_waters`
- [x] 新增 `src/games/smashup/__tests__/abilities/tornados.test.ts`
  - 已承接龙卷风代表性行为：
  - `tornados_carried_away`
  - `tornados_monster_tornado`
  - `tornados_whirlwinds`
  - `tornados_trade_winds`
  - `tornados_cyclone`
- [x] 新增 `src/games/smashup/__tests__/abilities/mythic-greeks.test.ts`
  - 已承接神话希腊代表性行为与基地抽样复审：
  - `mythic_greeks_favor_of_apollo / hera / poseidon / athena / dionysus / hermes / zeus`
  - `mythic_greeks_argonaut`
  - `base_oracle_at_delphi`
  - `base_wooden_horse`
- [x] `src/games/smashup/__tests__/shayuFactionAbilities.test.ts`
  - 已删除文件本体，不再保留“三派系混装代表性玩法”旧入口
- [x] 本阶段验证完成：
  - `npx vitest run src/games/smashup/__tests__/abilities/sharks.test.ts src/games/smashup/__tests__/abilities/tornados.test.ts src/games/smashup/__tests__/abilities/mythic-greeks.test.ts` -> 21 passed
  - `npx eslint src/games/smashup/__tests__/abilities/sharks.test.ts src/games/smashup/__tests__/abilities/tornados.test.ts src/games/smashup/__tests__/abilities/mythic-greeks.test.ts` -> 0 errors / 0 warnings
  - `npm run test:structure -- --all` -> checked files: 57，OK
  - `Test-Path src\\games\\smashup\\__tests__\\shayuFactionAbilities.test.ts` -> False
- [ ] 下一步候选：
  - 继续扫描仍按“扩展包聚合 / 代表性混装 / 根目录旧入口”组织的 SmashUp 测试文件
  - 优先评估 `expansionAbilities.test.ts`、`expansionOngoing.test.ts` 是否已有可安全拆出的单一行为簇

## Addendum（2026-05-17 08:01 +08）：`expansionAbilities.test.ts` 已继续瘦身，`Killer Plants` 双入口退场

- [x] `src/games/smashup/__tests__/abilities/killer-plants.test.ts`
  - 已吸收原 `expansionAbilities.test.ts` 的 `Killer Plants` 普通行为簇：
  - `killer_plant_insta_grow`
  - `killer_plant_weed_eater`
  - 同时把新增断言优先落到真实 `finalState`，减少对本地 `applyEvents/reduce` 回放的依赖。
- [x] `src/games/smashup/__tests__/expansionAbilities.test.ts`
  - 已删除整段 `食人花派系能力`
  - 并顺手把仍残留的两条“手工 `applyEvents` 看状态”旧测试改为直接断言真实 `runCommand(...).finalState`
- [x] 本阶段验证完成：
  - `npx vitest run src/games/smashup/__tests__/abilities/killer-plants.test.ts src/games/smashup/__tests__/expansionAbilities.test.ts` -> 38 passed
  - `npx eslint src/games/smashup/__tests__/abilities/killer-plants.test.ts src/games/smashup/__tests__/expansionAbilities.test.ts` -> 0 errors / 0 warnings
  - `npm run test:structure -- --all` -> checked files: 61，OK
- [ ] 下一步候选：
  - 优先处理 `expansionAbilities.test.ts` 中剩余已有专项归宿的 `Bear Cavalry`，消掉同派系双入口
  - 再评估 `Steampunk` 是否应新开稳定专项文件，还是暂留在扩展聚合入口

## Addendum（2026-05-17 08:06 +08）：`Bear Cavalry` 已并回专项，`expansionAbilities.test.ts` 只剩明确尾项

- [x] `src/games/smashup/__tests__/abilities/bear-cavalry.test.ts`
  - 已吸收原 `expansionAbilities.test.ts` 的 `Bear Cavalry` 普通行为与交互回归：
  - `bear_cavalry_bear_hug`（含 tie-choice 回归）
  - `bear_cavalry_commission`
- [x] `src/games/smashup/__tests__/expansionAbilities.test.ts`
  - 已删除 `bear cavalry interaction regressions`
  - 已删除整段 `黑熊骑兵派系能力`
  - 当前只剩 `Steampunk` 与 `cthulhu_complete_the_ritual` 这类仍未迁走的明确尾项
- [x] 本阶段验证完成：
  - `npx vitest run src/games/smashup/__tests__/abilities/bear-cavalry.test.ts src/games/smashup/__tests__/expansionAbilities.test.ts` -> 36 passed
  - `npx eslint src/games/smashup/__tests__/abilities/bear-cavalry.test.ts src/games/smashup/__tests__/expansionAbilities.test.ts` -> 0 errors / 0 warnings
  - `npm run test:structure -- --all` -> checked files: 62，OK
- [ ] 下一步候选：
  - 评估是否为 `Steampunk` 新开单一专项文件，把 `steampunk_scrap_diving` 从扩展聚合入口迁走
  - 继续扫描 `expansionOngoing.test.ts` 是否也存在“已有归宿却仍挂聚合文件”的段落

## Addendum（2026-05-17 08:14 +08）：`expansionAbilities.test.ts` 已彻底退场，`expansionOngoing.test.ts` 开始继续拆壳

- [x] 新增 `src/games/smashup/__tests__/abilities/steampunks.test.ts`
  - 承接 `steampunk_scrap_diving`
- [x] `src/games/smashup/__tests__/abilities/cthulhu.test.ts`
  - 已吸收 `cthulhu_complete_the_ritual` 的打出约束
- [x] `src/games/smashup/__tests__/expansionAbilities.test.ts`
  - 文件本体已删除，旧扩展聚合入口完成退场
- [x] `src/games/smashup/__tests__/abilities/ghosts.test.ts`
  - 已继续吸收 `expansionOngoing.test.ts` 中的幽灵 ongoing/低层合同：
  - `ghost_incorporeal`
  - `ghost_make_contact` 的显式控制权事件与 detach affect 记录合同
- [x] `src/games/smashup/__tests__/expansionOngoing.test.ts`
  - 已删除整段 `幽灵 ongoing 能力`
- [x] 本阶段验证完成：
  - `npx vitest run src/games/smashup/__tests__/abilities/steampunks.test.ts src/games/smashup/__tests__/abilities/cthulhu.test.ts` -> 27 passed
  - `Test-Path src\\games\\smashup\\__tests__\\expansionAbilities.test.ts` -> False
  - `npx vitest run src/games/smashup/__tests__/abilities/ghosts.test.ts src/games/smashup/__tests__/expansionOngoing.test.ts` -> 81 passed
  - `npx eslint ...上述文件...` -> 0 errors / 0 warnings
  - `npm run test:structure -- --all` -> checked files: 65，OK
- [ ] 下一步候选：
  - 优先评估 `expansionOngoing.test.ts` 中 `Killer Plants` 是否继续并回 `abilities/killer-plants.test.ts`
  - 其次再看 `Innsmouth` / `Miskatonic` 是否已有足够明确的专项归宿

## Addendum（2026-05-17 09:00 +08）：`cthulhuExpansionAbilities.test.ts` 已按派系并回专项并退场

- [x] `src/games/smashup/__tests__/abilities/cthulhu.test.ts`
  - 已吸收原 `cthulhuExpansionAbilities.test.ts` 的克苏鲁之仆普通行为：
  - `cthulhu_recruit_by_force`
  - `cthulhu_it_begins_again`
  - `cthulhu_fhtagn`
- [x] `src/games/smashup/__tests__/abilities/innsmouth.test.ts`
  - 已吸收原混装文件中的印斯茅斯普通行为：
  - `innsmouth_the_deep_ones`
  - `innsmouth_new_acolytes`
  - `innsmouth_mysteries_of_the_deep`
- [x] `src/games/smashup/__tests__/abilities/miskatonic.test.ts`
  - 已吸收原混装文件中的米斯卡塔尼克普通行为：
  - `miskatonic_those_meddling_kids`
- [x] `src/games/smashup/__tests__/cthulhuExpansionAbilities.test.ts`
  - 文件本体已删除，不再保留“按扩展包把三个派系普通行为混在一起”的旧入口
- [x] 本阶段验证完成：
  - `npx vitest run src/games/smashup/__tests__/abilities/cthulhu.test.ts src/games/smashup/__tests__/abilities/innsmouth.test.ts src/games/smashup/__tests__/abilities/miskatonic.test.ts` -> `3 files / 69 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/cthulhu.test.ts src/games/smashup/__tests__/abilities/innsmouth.test.ts src/games/smashup/__tests__/abilities/miskatonic.test.ts` -> `0 errors / 0 warnings`
  - `Test-Path src\\games\\smashup\\__tests__\\cthulhuExpansionAbilities.test.ts` -> `False`
  - `npm run test:structure -- --all` -> `checked files: 6, OK`
- [ ] 下一步候选：
  - 优先拆 `baseFactionOngoing.test.ts` 中剩余的 `诡术师 ongoing 能力`
  - 再评估 `忍者 ongoing/special 能力` 是否已适合拆回 `ninjas.test.ts`，还是仍需保留一段 shared special/ongoing 合同
  - 再扫描 `pirates-ongoing.test.ts` 是否只是历史命名问题，还是还混着多个应回专项的行为簇

## Addendum（2026-05-17 09:45 +08）：`baseFactionOngoing.test.ts` 的 `诡术师 ongoing` 已并回专项并退场

- [x] `src/games/smashup/__tests__/abilities/tricksters.test.ts`
  - 已吸收原 `baseFactionOngoing.test.ts` 的整段 `诡术师 ongoing 能力`：
  - `trickster_flame_trap`
  - `trickster_brownie`
  - `trickster_block_the_path`
  - `trickster_hideout`
  - `trickster_pay_the_piper`
  - `trickster_enshrouding_mist`
  - `trickster_leprechaun`
  - `trickster_mark_of_sleep`
- [x] 这次不是机械搬 `describe`：
  - 迁移后先暴露出 `makeBase` 漏 import，说明专项文件确实脱离了旧大文件局部作用域，必须自己站稳。
  - 随后两条红灯 `trickster_brownie_pod` / `trickster_pay_the_piper` 证明旧 `baseFactionOngoing.test.ts` 本地 `makeState(...)` 的默认手牌/牌库前提曾被隐式依赖；现已在专项文件中把“玩家 0 有牌可抽、玩家 1 有手牌可弃”显式写进测试状态。
- [x] `src/games/smashup/__tests__/baseFactionOngoing.test.ts`
  - 已删除整段 `诡术师 ongoing 能力`
  - 并清理退场后残留的 `registerTricksterAbilities`、`interceptEvent`、`isOperationRestricted`、`buildAffectRecords`、`getPromptsBySourceId`、`respondToPromptOption`、`withOnlyCurrentPrompt` 等废 import
  - 文件头说明也已改成只描述仍保留的忍者/牛仔覆盖，避免旧口径继续误导
- [x] 本阶段验证完成：
  - `npx vitest run src/games/smashup/__tests__/abilities/tricksters.test.ts` -> `1 file / 46 tests passed`
  - `npx vitest run src/games/smashup/__tests__/abilities/tricksters.test.ts src/games/smashup/__tests__/baseFactionOngoing.test.ts` -> `2 files / 74 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/tricksters.test.ts src/games/smashup/__tests__/baseFactionOngoing.test.ts` -> `0 errors / 0 warnings`
  - `npm run test:structure -- --all` -> `checked files: 13, OK`
- [ ] 下一步候选：
  - 优先评估 `baseFactionOngoing.test.ts` 剩余的忍者 / 牛仔段，判断是否还能继续按派系专项收口
  - 再检查 `pirates-ongoing.test.ts` 是否只是历史命名问题，还是仍混着多个不该共存的行为簇

## Addendum（2026-05-17 09:54 +08）：`baseFactionOngoing.test.ts` 已整体退场，剩余忍者/牛仔段并回 `ninjas.test.ts`

- [x] `src/games/smashup/__tests__/abilities/ninjas.test.ts`
  - 已继续吸收原 `baseFactionOngoing.test.ts` 剩余的忍者 ongoing/special 合同：
  - `ninja_smoke_bomb`
  - `ninja_assassination`
  - `ninja_infiltrate`
  - `ninja_shinobi`
  - `ninja_acolyte`
  - `ninja_hidden_ninja`
  - `specialLimitGroup`
  - `consumesNormalLimit`
  - 以及 `ninja_acolyte` 额外打出 `cowboys_gunfighter` 后继续接管交互的跨派系续链
- [x] 这次不是把旧文件局部 helper 原封不动搬过去：
  - 在 `ninjas.test.ts` 新增显式 `makeNinjaOngoingState(...)` / `makeNinjaOngoingMinion(...)`
  - 把旧 `baseFactionOngoing.test.ts` 本地默认的手牌、牌库、派系和 turn meta 收口成专项文件自己的显式前提
  - 避免以后再因为共享 `helpers.makeState(...)` 默认值变化而让这批忍者测试集体误红
- [x] `src/games/smashup/__tests__/baseFactionOngoing.test.ts`
  - 文件本体已删除
  - 说明这份历史“基础派系 ongoing/special”壳已经没有保留价值，SmashUp 不再通过第二入口维护忍者 special/ongoing
- [x] 本阶段验证完成：
  - `npx vitest run src/games/smashup/__tests__/abilities/ninjas.test.ts` -> `1 file / 35 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/ninjas.test.ts` -> `0 errors / 0 warnings`
  - `Test-Path src\\games\\smashup\\__tests__\\baseFactionOngoing.test.ts` -> `False`
  - `npm run test:structure -- --all` -> `checked files: 13, OK`
- [ ] 下一步候选：
  - `pirates-ongoing.test.ts` 初看更像“文件名遗留”而不是多语义混装，优先级下调
  - 继续扫描根目录仍按泛化技术主题或历史阶段组织的 SmashUp 测试文件，优先找真正还在混放多个行为边界的旧壳

## Addendum（2026-05-17 10:05 +08）：`talentAbilities.test.ts` 已按“派系 talent / 共享 talent 机制”拆分并退场

- [x] `src/games/smashup/__tests__/abilities/miskatonic.test.ts`
  - 已吸收 `miskatonic_professor` 的派系 talent 行为：
  - `手中有疯狂卡时：弃疯狂卡 + 额外行动 + 额外随从`
  - `手中无疯狂卡时无效果`
- [x] `src/games/smashup/__tests__/abilities/cthulhu.test.ts`
  - 已吸收克苏鲁系 talent 行为：
  - `cthulhu_star_spawn`
  - `cthulhu_servitor`
  - 其中保留真实 `USE_TALENT -> prompt -> respond` 链，而不是继续挂在“talent 总入口”里测 prompt 外壳。
- [x] 新增 `src/games/smashup/__tests__/talent-mechanics.test.ts`
  - 承接共享 talent 合同：
  - `无注册 talent 时只生成 TALENT_USED`
  - `目标不存在时返回空事件`
  - `execute 层不负责 talentUsed 校验`
  - `standing stones` 双天赋名额与 `ongoingCardUid` 分支
  - `被压制随从仍可手动发动天赋`
- [x] `src/games/smashup/__tests__/talentAbilities.test.ts`
  - 文件本体已删除，不再保留“米斯卡塔尼克 + 克苏鲁 + 巨石阵 + 压制规则”混在一起的旧壳
- [x] 本阶段验证完成：
  - `npx vitest run src/games/smashup/__tests__/abilities/miskatonic.test.ts` -> `1 file / 17 tests passed`
  - `npx vitest run src/games/smashup/__tests__/abilities/cthulhu.test.ts` -> `1 file / 51 tests passed`
  - `npx vitest run src/games/smashup/__tests__/talent-mechanics.test.ts` -> `1 file / 8 tests passed`
  - `npx vitest run src/games/smashup/__tests__/abilities/miskatonic.test.ts src/games/smashup/__tests__/abilities/cthulhu.test.ts src/games/smashup/__tests__/talent-mechanics.test.ts` -> `3 files / 76 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/miskatonic.test.ts src/games/smashup/__tests__/abilities/cthulhu.test.ts src/games/smashup/__tests__/talent-mechanics.test.ts` -> `0 errors / 0 warnings`
  - `Test-Path src\\games\\smashup\\__tests__\\talentAbilities.test.ts` -> `False`
  - `npm run test:structure -- --all` -> `checked files: 16, OK`
- [ ] 下一步候选：
  - 继续扫描仍按“技术主题总入口 / 历史聚合”承载多派系行为与共享合同的旧文件
  - 对已经只剩单派系行为的旧文件，优先并回现有专项，不再新建多余壳层

## Addendum（2026-05-17 10:19 +08）：`ongoingTalent.test.ts` 已按“共享 ongoing talent 合同 / 各派系专项”拆分并退场

- [x] `src/games/smashup/__tests__/talent-mechanics.test.ts`
  - 已吸收共享 ongoing talent 合同：
  - `ongoingCardUid` 的 validate 规则
  - `ongoing talentUsed` / `TURN_STARTED` 重置
  - `minionUid vs ongoingCardUid` 的 TALENT_USED 记录边界
- [x] `src/games/smashup/__tests__/abilities/steampunks.test.ts`
  - 已吸收 `steampunk_zeppelin` 的 ongoing talent 交互链
  - 并把“无可移动目标”收正为公开命令入口的真实拒绝合同，而不是继续锁 execute 内层反馈
- [x] `src/games/smashup/__tests__/abilities/innsmouth.test.ts`
  - 已吸收 `innsmouth_sacred_circle` 的 ongoing talent 行为与额度消费合同
  - 同样把“无同名目标”收正为公开命令入口拒绝合同
- [x] `src/games/smashup/__tests__/abilities/tricksters.test.ts`
  - 已吸收 `trickster_hideout_pod`
  - 已吸收 `trickster_pixie_pod`
- [x] `src/games/smashup/__tests__/ongoingTalent.test.ts`
  - 文件本体已删除，不再保留“米大 + 蒸汽朋克 + 印斯茅斯 + 诡术师 + talent 基础设施”混装入口
- [x] 本阶段验证完成：
  - `npx vitest run src/games/smashup/__tests__/talent-mechanics.test.ts src/games/smashup/__tests__/abilities/steampunks.test.ts src/games/smashup/__tests__/abilities/innsmouth.test.ts src/games/smashup/__tests__/abilities/tricksters.test.ts` -> `4 files / 118 tests passed`
  - `npx eslint src/games/smashup/__tests__/talent-mechanics.test.ts src/games/smashup/__tests__/abilities/steampunks.test.ts src/games/smashup/__tests__/abilities/innsmouth.test.ts src/games/smashup/__tests__/abilities/tricksters.test.ts` -> `0 errors / 0 warnings`
  - `Test-Path src\\games\\smashup\\__tests__\\ongoingTalent.test.ts` -> `False`
  - `npm run test:structure -- --all` -> `checked files: 18, OK`
- [ ] 下一步候选：
  - `actionAndTalent.test.ts` 当前更像共享生命周期合同，优先级下调
  - `abilities/madness-mechanics.test.ts` 明显仍混放 `Cthulhu/Miskatonic/Innsmouth` 业务与 timing/handler 合同，作为下一批真混装壳优先评估
  - 继续优先处理那些仍混放多派系业务与共享机制、且没有单一自然入口的文件

## Addendum（2026-05-17 11:01 +08）：`madness-prompt-mechanics.test.ts` 已并回 `cthulhu / miskatonic` 专项并退场

- [x] `src/games/smashup/__tests__/abilities/cthulhu.test.ts`
  - 已吸收 `cthulhu_madness_unleashed` 的整组行为合同：
  - 多选/单选 prompt 创建
  - `min=0` + skip
  - 待决阶段不提前弃牌或改额度
  - 弃多张疯狂卡后的即时抽牌与额外行动额度
  - POD 版分支
  - 额外行动额度被后续疯狂卡逐次消耗
- [x] `src/games/smashup/__tests__/abilities/miskatonic.test.ts`
  - 已吸收 `miskatonic_it_might_just_work`
  - 已吸收 `miskatonic_book_of_iter_the_unseen`
  - 已吸收 `miskatonic_thing_on_the_doorstep`
- [x] `src/games/smashup/__tests__/abilities/madness-prompt-mechanics.test.ts`
  - 文件本体已删除，不再保留“Cthulhu + Miskatonic + prompt 壳层”混装旧入口
- [x] 这次不是只删旧文件名：
  - 旧 seam `postProcessSystemEvents(...)`、`lastMatchState`、`getLastPrompt(...)`、`getLastPromptsBySourceId(...)` 已从这批迁移后的专项文件里退场
  - 新用例统一走真实 `PLAY_ACTION / runCommand(...)`
  - 真实 prompt facade：`getSimpleChoicePrompt`、`respondToPromptOption(...)`、`respondToPromptOptions(...)`
  - 真实结果入口：`finalState`
  - `miskatonic_thing_on_the_doorstep` 的 special 最终状态明确按 `result.events.reduce(reduce, state)` 验证，不再借旧壳读错状态出口
- [x] 本阶段验证完成：
  - `Test-Path src\\games\\smashup\\__tests__\\abilities\\madness-prompt-mechanics.test.ts` -> `False`
  - `rg -n "postProcessSystemEvents|lastMatchState|getLastPrompt|getLastPromptsBySourceId" src/games/smashup/__tests__/abilities/cthulhu.test.ts src/games/smashup/__tests__/abilities/miskatonic.test.ts` -> `0 命中`
  - `npx vitest run src/games/smashup/__tests__/abilities/extra-play-timing-mechanics.test.ts src/games/smashup/__tests__/abilities/cthulhu.test.ts src/games/smashup/__tests__/abilities/miskatonic.test.ts src/games/smashup/__tests__/abilities/innsmouth.test.ts` -> `4 files / 136 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/extra-play-timing-mechanics.test.ts src/games/smashup/__tests__/abilities/cthulhu.test.ts src/games/smashup/__tests__/abilities/miskatonic.test.ts src/games/smashup/__tests__/abilities/innsmouth.test.ts` -> `0 errors / 0 warnings`
  - `npm run test:structure -- --all` -> `checked files: 20, OK`
- [ ] 下一步候选：
  - 继续扫描仍残留 `lastMatchState / postProcessSystemEvents` 的旧文件，但先区分“共享系统合同”与“普通业务回归”
  - `abilities/elder-things.test.ts`、`ongoingE2E.test.ts` 是下一批高概率候选，但不能机械迁；先判断它们是在锁公开行为，还是在锁系统内层合同

## Addendum（2026-05-17 11:03 +08）：`elder-things.test.ts` 与 `ongoingE2E.test.ts` 已继续拔掉业务测试里的旧 interaction 壳

- [x] `src/games/smashup/__tests__/abilities/elder-things.test.ts`
  - `elder_thing_begin_the_summoning` 的“单个弃牌堆随从时创建 Prompt”
  - `elder_thing_unfathomable_goals` 的“多随从时创建 Prompt”
  - 已从 `lastMatchState + getLastInteractions()` 改为直接断言 `runCommand(...).finalState` 上的 `getSimpleChoicePrompt(...)`
- [x] `src/games/smashup/__tests__/ongoingE2E.test.ts`
  - `pirate_shanghai` 业务链已从 `lastMatchState + getLastInteractions()` 改为直接消费 `postProcessSystemEvents(...).matchState`
  - 只收业务 prompt 链；后面显式在测 `replacement / afterScoring / postProcessSystemEvents` 的系统合同暂不机械迁
- [x] 这次不是为了降命中乱改：
  - `elder-things.test.ts` 扫描后已无 `lastMatchState|getLastInteractions|interaction.current|interaction.queue`
  - `ongoingE2E.test.ts` 扫描后已无 `lastMatchState|getLastInteractions`
  - 但文件内保留了明确在锁系统后处理链的 `postProcessSystemEvents(...)` 调用
- [x] 本阶段验证完成：
  - `npx vitest run src/games/smashup/__tests__/abilities/elder-things.test.ts` -> `1 file / 41 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/elder-things.test.ts` -> `0 errors / 0 warnings`
  - `npx vitest run src/games/smashup/__tests__/ongoingE2E.test.ts` -> `1 file / 14 tests passed`
  - `npx eslint src/games/smashup/__tests__/ongoingE2E.test.ts` -> `0 errors / 0 warnings`
  - `npm run test:structure -- --all` -> `checked files: 22, OK`
- [ ] 下一步候选：
  - 剩余 `postProcessSystemEvents` 命中主要集中在 `smashup.smoke.test.ts`、`reactionQueueBaseAbilities.test.ts`、`afterscoring-window-skip-base-clear.test.ts`、`wizard-portal-d45.test.ts`
  - 下一步先判定这些命中里哪些仍是普通业务测试借系统壳，哪些已经是明确的系统合同；优先继续拔前者

## Addendum（2026-05-17 11:09 +08）：`smashup.smoke.test.ts` 已清掉最后一处裸 `prompt.data.options` 兜底

- [x] `src/games/smashup/__tests__/smashup.smoke.test.ts`
  - `身体改造在回合开始给己方随从加指示物时应触发 The Bride 抽 1（线上反馈 69ec35a1）`
  - reaction chain fallback 已从 `prompt?.data?.options?.[0]?.id` 改为 facade `getPromptOptions(prompt)[0]?.id`
- [x] 这次不是功能改写，只是把最后一处业务测试的 prompt 选项读取收回 facade
- [x] 本阶段验证完成：
  - `npx vitest run src/games/smashup/__tests__/smashup.smoke.test.ts -t "身体改造在回合开始给己方随从加指示物时应触发 The Bride 抽 1"` -> `1 passed`
  - `npx eslint src/games/smashup/__tests__/smashup.smoke.test.ts` -> `0 errors / 0 warnings`
  - `rg -n "prompt\\?\\.data\\?\\.options|prompt\\.data\\.options" src/games/smashup/__tests__ --glob '!**/helpers.ts' --glob '!**/helpers/**'` -> `0 命中`
  - `npm run test:structure -- --all` -> `checked files: 24, OK`
- [ ] 下一步候选：
  - 继续从 `smashup.smoke.test.ts` 和其它混合文件里找“业务借 `postProcessSystemEvents` 壳”的具体段落
  - 对 `reactionQueueBaseAbilities.test.ts`、`wizard-portal-d45.test.ts` 这类更明显的系统合同保持谨慎，不为了降命中乱迁

## Addendum（2026-05-17 11:17 +08）：`giantAntsPod.test.ts` 已并回 `abilities/giant-ants.test.ts` 并退场

- [x] `src/games/smashup/__tests__/abilities/giant-ants.test.ts`
  - 已吸收原 `giantAntsPod.test.ts` 中专项文件还未承接的巨蚁 POD 行为：
  - `giant_ant_drone_pod` talent 抽牌
  - `giant_ant_drone_pod` 防止消灭
  - `giant_ant_soldier_pod`
  - `giant_ant_gimme_the_prize_pod`
  - `giant_ant_we_will_rock_you_pod`
  - `giant_ant_who_wants_to_live_forever_pod`
- [x] `src/games/smashup/__tests__/giantAntsPod.test.ts`
  - 文件本体已删除，不再保留“根目录巨蚁 POD 旧入口 + abilities/giant-ants.test.ts”双入口并存状态
- [x] 这次不是机械搬整份：
  - 先确认 `abilities/giant-ants.test.ts` 已经存在 `drone_pod` 相关覆盖，避免把已有段落再复制一遍
  - 只补专项文件里缺的 POD 行为簇
  - 顺手清理专项文件里的废 import / 废变量，确保新的单一入口本身是干净的
- [x] 本阶段验证完成：
  - `npx vitest run src/games/smashup/__tests__/abilities/giant-ants.test.ts src/games/smashup/__tests__/giantAntsPod.test.ts` -> `2 files / 34 tests passed`（删除前组合基线）
  - `npx eslint src/games/smashup/__tests__/abilities/giant-ants.test.ts src/games/smashup/__tests__/giantAntsPod.test.ts` -> `0 errors / 0 warnings`（删除前组合基线）
  - `npx vitest run src/games/smashup/__tests__/abilities/giant-ants.test.ts` -> `1 file / 28 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/giant-ants.test.ts` -> `0 errors / 0 warnings`
  - `Test-Path src\\games\\smashup\\__tests__\\giantAntsPod.test.ts` -> `False`
  - `npm run test:structure -- --all` -> `checked files: 26, OK`
- [ ] 下一步候选：
  - 继续扫描根目录仍残留的“单派系旧入口 + abilities 专项已存在”双入口文件
  - 候选优先看 `elderThingsPod.test.ts`、`vampiresPod.test.ts`、`zombieInteractionChain.test.ts` 这类是否仍在制造第二入口，再区分是否真该并回专项

## Addendum（2026-05-17 11:27 +08）：`elderThingsPod.test.ts` 已并回 `abilities/elder-things.test.ts` 并退场

- [x] `src/games/smashup/__tests__/abilities/elder-things.test.ts`
  - 已吸收原 `elderThingsPod.test.ts` 中应由远古之物专项承接的 POD 行为：
  - `elder_thing_elder_thing_pod`
  - `elder_thing_unfathomable_goals_pod`
  - `elder_thing_insanity_pod`
  - `elder_thing_mi_go_pod`
  - `elder_thing_shoggoth_pod`
  - `elder_thing_dunwich_horror_pod`
  - `elder_thing_the_price_of_power_pod`
  - `elder_thing_spreading_horror_pod`
  - `elder_thing_touch_of_madness_pod`
- [x] `src/games/smashup/__tests__/elderThingsPod.test.ts`
  - 文件本体已删除，不再保留“根目录远古之物 POD 旧入口 + abilities/elder-things.test.ts”双入口并存状态
- [x] 这次不是机械搬整份：
  - 旧文件里的 `elder_things (base): Elder Thing` 只是基础版 FAQ 重复覆盖，没有再搬进专项文件制造重复合同
  - 本轮只保留真正缺失、且应由远古之物长期专项入口维护的 POD 行为簇
- [x] 本阶段验证完成：
  - `npx vitest run src/games/smashup/__tests__/abilities/elder-things.test.ts` -> `1 file / 53 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/elder-things.test.ts` -> `0 errors / 0 warnings`
  - `Test-Path src\\games\\smashup\\__tests__\\elderThingsPod.test.ts` -> `False`
  - `npm run test:structure -- --all` -> `checked files: 26, OK`
- [ ] 下一步候选：
  - 继续扫描根目录仍残留的“单派系旧入口 + abilities 专项已存在”双入口文件
  - 优先评估 `vampiresPod.test.ts` 是否同样只是业务第二入口；`zombieInteractionChain.test.ts` 先判断是否仍承载独特交互链合同，再决定是否并回专项

## Addendum（2026-05-17 11:33 +08）：`vampiresPod.test.ts` 已并回 `abilities/vampires.test.ts` 并退场

- [x] `src/games/smashup/__tests__/abilities/vampires.test.ts`
  - 已吸收原 `vampiresPod.test.ts` 的吸血鬼 POD 行为：
  - `vampire_nightstalker_pod`
  - `vampire_buffet_pod`
  - `vampire_the_count_pod`
  - `vampire_dinner_date_pod`
  - `vampire_wolf_pact_pod`
- [x] `src/games/smashup/__tests__/vampiresPod.test.ts`
  - 文件本体已删除，不再保留“根目录吸血鬼 POD 旧入口 + abilities/vampires.test.ts”双入口并存状态
- [x] 这次不是机械改名：
  - 先验证 `abilities/vampires.test.ts + vampiresPod.test.ts` 组合基线为 `2 files / 30 tests passed`
  - 再把 POD 行为并到吸血鬼专项，删除后单跑专项确认 `1 file / 19 tests passed`
  - 保留 `vampire_wolf_pact_pod_action` 的低层 `resolveOnPlay(...)` 合同，但它现在归吸血鬼专项，不再挂在旧根目录入口
- [x] 本阶段验证完成：
  - `npx vitest run src/games/smashup/__tests__/abilities/vampires.test.ts src/games/smashup/__tests__/vampiresPod.test.ts` -> `2 files / 30 tests passed`（删除前组合基线）
  - `npx eslint src/games/smashup/__tests__/abilities/vampires.test.ts src/games/smashup/__tests__/vampiresPod.test.ts` -> `0 errors / 0 warnings`（删除前组合基线）
  - `npx vitest run src/games/smashup/__tests__/abilities/vampires.test.ts` -> `1 file / 19 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/vampires.test.ts` -> `0 errors / 0 warnings`
  - `Test-Path src\\games\\smashup\\__tests__\\vampiresPod.test.ts` -> `False`
  - `npm run test:structure -- --all` -> `checked files: 27, OK`
- [ ] 下一步候选：
  - 继续扫描根目录仍残留的“单派系旧入口 + abilities 专项已存在”双入口文件
  - `zombieInteractionChain.test.ts` 先判断是否还在锁独特交互链合同；如果不是，再考虑并回专项

## Addendum（2026-05-17 11:42 +08）：`zombieInteractionChain.test.ts` 已并回 `abilities/zombies.test.ts` 并退场

- [x] `src/games/smashup/__tests__/abilities/zombies.test.ts`
  - 已吸收原 `zombieInteractionChain.test.ts` 的僵尸交互链业务行为：
  - `zombie_grave_digger` 取回 / 跳过
  - `zombie_walker` 弃掉 / 保留牌库顶
  - `zombie_grave_robbing` 取回弃牌堆卡
  - `zombie_not_enough_bullets` 取回同名组
  - `zombie_lend_a_hand` 空提交 / 洗回牌库
  - `zombie_lord` 循环选择 / 完成
  - `zombie_tenacious_z` 从弃牌堆打出、每回合一次、不消耗正常额度
  - `zombie_theyre_coming_to_get_you` 只允许打到附着基地且消耗正常额度
  - `zombie_overrun` 限制对手打随从 + onTurnStart 自收口 reactionQueue 合同
- [x] `src/games/smashup/__tests__/zombieInteractionChain.test.ts`
  - 文件本体已删除，不再保留“根目录僵尸交互链旧入口 + abilities/zombies.test.ts”双入口并存状态
- [x] 这次不是只删文件名：
  - 旧文件主体是僵尸业务交互链，不是共享系统合同文件
  - 迁移后不再依赖旧文件里的自建 `GameTestRunner` 壳，而是收回到专项文件现有的 `runCommand`、prompt facade、`collectTriggers` / `maybeResolveReactionQueue`
  - 唯一偏低层的 `zombie_overrun` reactionQueue 自收口合同也已并回僵尸专项，不再作为旧根目录文件的存活理由
- [x] 本阶段验证完成：
  - `npx vitest run src/games/smashup/__tests__/abilities/zombies.test.ts src/games/smashup/__tests__/zombieInteractionChain.test.ts` -> `2 files / 46 tests passed`（删除前组合基线）
  - `npx eslint src/games/smashup/__tests__/abilities/zombies.test.ts src/games/smashup/__tests__/zombieInteractionChain.test.ts` -> `0 errors / 0 warnings`（删除前组合基线）
  - `npx vitest run src/games/smashup/__tests__/abilities/zombies.test.ts` -> `1 file / 24 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/zombies.test.ts` -> `0 errors / 0 warnings`
  - `Test-Path src\\games\\smashup\\__tests__\\zombieInteractionChain.test.ts` -> `False`
  - `npm run test:structure -- --all` -> `checked files: 27, OK`
- [ ] 下一步候选：
  - 继续扫描根目录仍残留的“单派系旧入口 + abilities 专项已存在”双入口文件
  - 对残留历史文件先区分“共享系统合同”与“派系业务第二入口”，再决定是否并回专项

## Addendum（2026-05-17 11:47 +08）：`frankensteinFaq.test.ts` 已并回 `abilities/frankenstein.test.ts` 并退场

- [x] `src/games/smashup/__tests__/abilities/frankenstein.test.ts`
  - 已吸收原 `frankensteinFaq.test.ts` 的 FAQ/行为合同：
  - `frankenstein_blitzed`
  - `frankenstein_uberserum`
  - `frankenstein_its_alive`
- [x] `src/games/smashup/__tests__/frankensteinFaq.test.ts`
  - 文件本体已删除，不再保留“根目录弗兰肯斯坦 FAQ 旧入口 + abilities/frankenstein.test.ts”双入口并存状态
- [x] 这次不是机械搬 FAQ 标签：
  - 三条测试都属于弗兰肯斯坦派系业务合同，不是共享 FAQ 机制文件
  - 迁移后继续走专项文件自己的 `runCommand`、prompt facade 与事件断言，而不是保留第二入口
- [x] 本阶段验证完成：
  - `npx vitest run src/games/smashup/__tests__/abilities/frankenstein.test.ts src/games/smashup/__tests__/frankensteinFaq.test.ts` -> `2 files / 17 tests passed`（删除前组合基线）
  - `npx eslint src/games/smashup/__tests__/abilities/frankenstein.test.ts src/games/smashup/__tests__/frankensteinFaq.test.ts` -> `0 errors / 0 warnings`（删除前组合基线）
  - `npx vitest run src/games/smashup/__tests__/abilities/frankenstein.test.ts` -> `1 file / 14 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/frankenstein.test.ts` -> `0 errors / 0 warnings`
  - `Test-Path src\\games\\smashup\\__tests__\\frankensteinFaq.test.ts` -> `False`
  - `npm run test:structure -- --all` -> `checked files: 28, OK`
- [ ] 下一步候选：
  - 继续扫描根目录残留历史文件，优先找“单派系旧入口 + abilities 专项已存在”的下一份候选
  - 对文件名带 `interaction/faq/abilities` 的历史入口先判断其主体是否仍是业务第二入口，而不是仅凭名字下刀

## Addendum（2026-05-17 11:51 +08）：`steampunk-pod-verification.test.ts` 已并回 `abilities/steampunks.test.ts` 并退场

- [x] `src/games/smashup/__tests__/abilities/steampunks.test.ts`
  - 已吸收原 `steampunk-pod-verification.test.ts` 的 POD 低层合同：
  - `steampunk_ornate_dome_pod`
  - `steampunk_escape_hatch_pod`
- [x] `src/games/smashup/__tests__/steampunk-pod-verification.test.ts`
  - 文件本体已删除，不再保留“根目录蒸汽朋克 POD 验证壳 + abilities/steampunks.test.ts”双入口并存状态
- [x] 这次不是机械复制：
  - 两条测试都落回现有 `steampunk_ornate_dome` / `steampunk_escape_hatch` 专项块
  - 继续保留为蒸汽朋克专项自己的低层合同，而不是让根目录验证壳靠两条 POD 测试单独存活
- [x] 本阶段验证完成：
  - `npx vitest run src/games/smashup/__tests__/abilities/steampunks.test.ts src/games/smashup/__tests__/steampunk-pod-verification.test.ts` -> `2 files / 36 tests passed`（删除前组合基线）
  - `npx eslint src/games/smashup/__tests__/abilities/steampunks.test.ts src/games/smashup/__tests__/steampunk-pod-verification.test.ts` -> `0 errors / 0 warnings`（删除前组合基线）
  - `npx vitest run src/games/smashup/__tests__/abilities/steampunks.test.ts` -> `1 file / 34 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/steampunks.test.ts` -> `0 errors / 0 warnings`
  - `Test-Path src\\games\\smashup\\__tests__\\steampunk-pod-verification.test.ts` -> `False`
  - `npm run test:structure -- --all` -> `checked files: 28, OK`
- [ ] 下一步候选：
  - 继续扫描根目录残留历史文件，优先找“单派系旧入口 + abilities 专项已存在”的下一份候选
  - 重点筛那些只剩 1-3 条派系专项合同、却还挂在根目录验证壳上的文件

## Addendum（2026-05-17 11:54 +08）：`bearCavalry-youre-screwed-pod-breakpoint.test.ts` 已并回 `abilities/bear-cavalry.test.ts` 并退场

- [x] `src/games/smashup/__tests__/abilities/bear-cavalry.test.ts`
  - 已吸收原 `bearCavalry-youre-screwed-pod-breakpoint.test.ts` 的 3 条 POD 爆破点合同：
  - 默认每个玩家 `+2 breakpoint`
  - 本回合曾把对手随从移动到此基地时改为每个玩家 `-2 breakpoint`
  - 被压制时不再修改爆破点
- [x] `src/games/smashup/__tests__/bearCavalry-youre-screwed-pod-breakpoint.test.ts`
  - 文件本体已删除，不再保留“根目录熊骑兵 POD breakpoint 旧入口 + abilities/bear-cavalry.test.ts”双入口并存状态
- [x] 这次不是只收文件名：
  - 这 3 条都属于 `bear_cavalry_bearing_down_pod` 自己的专项合同
  - 迁移后直接落回熊骑兵专项，而不是继续放在一个历史命名与当前卡牌名都不对齐的小壳里
- [x] 本阶段验证完成：
  - `npx vitest run src/games/smashup/__tests__/abilities/bear-cavalry.test.ts src/games/smashup/__tests__/bearCavalry-youre-screwed-pod-breakpoint.test.ts` -> `2 files / 35 tests passed`（删除前组合基线）
  - `npx eslint src/games/smashup/__tests__/abilities/bear-cavalry.test.ts src/games/smashup/__tests__/bearCavalry-youre-screwed-pod-breakpoint.test.ts` -> `0 errors / 0 warnings`（删除前组合基线）
  - `npx vitest run src/games/smashup/__tests__/abilities/bear-cavalry.test.ts` -> `1 file / 32 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/bear-cavalry.test.ts` -> `0 errors / 0 warnings`
  - `Test-Path src\\games\\smashup\\__tests__\\bearCavalry-youre-screwed-pod-breakpoint.test.ts` -> `False`
  - `npm run test:structure -- --all` -> `checked files: 29, OK`
- [ ] 下一步候选：
  - 继续扫描根目录残留历史文件，优先找“单派系旧入口 + abilities 专项已存在”的下一份候选
  - 重点看那些名字仍带 `verification / faq / interaction / breakpoint`、但主体只剩派系专项合同的小壳

## Addendum（2026-05-17 12:01 +08）：`wizard-neophyte-ongoing.test.ts` 已并回 `abilities/wizards.test.ts` 并退场

- [x] `src/games/smashup/__tests__/abilities/wizards.test.ts`
  - 已吸收原 `wizard-neophyte-ongoing.test.ts` 的 2 条学徒行为合同：
  - `wizard_neophyte` 打出 `zombie_overrun` 时先选基地再附着 ongoing 行动
  - `wizard_neophyte` 打出 `wizard_summon` 这类 standard 行动时不需要基地选择，并正确增加随从额度
- [x] `src/games/smashup/__tests__/wizard-neophyte-ongoing.test.ts`
  - 文件本体已删除，不再保留“根目录学徒 ongoing bug 壳 + abilities/wizards.test.ts”双入口并存状态
- [x] 这次不是机械搬到专项：
  - 旧文件虽然用了 `zombie_overrun` 这个跨派系 ongoing 行动做场景，但真正锁的是 `wizard_neophyte` 自己“额外打出牌库顶行动卡”的行为边界
  - 因此它不是共享 ongoing 机制文件，也不是僵尸专项文件，而是巫师专项里的学徒行为合同
  - 迁移后继续走 `execPlayMinion -> getSimpleChoicePrompt -> respondToPrompt` 的真实行为链，不再保留单独的局部注册/夹具入口
- [x] 本阶段验证完成：
  - `npx vitest run src/games/smashup/__tests__/abilities/wizards.test.ts src/games/smashup/__tests__/wizard-neophyte-ongoing.test.ts` -> `2 files / 28 tests passed`（删除前组合基线）
  - `npx eslint src/games/smashup/__tests__/abilities/wizards.test.ts src/games/smashup/__tests__/wizard-neophyte-ongoing.test.ts` -> `0 errors / 0 warnings`（删除前组合基线）
  - `npx vitest run src/games/smashup/__tests__/abilities/wizards.test.ts` -> `1 file / 28 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/wizards.test.ts` -> `0 errors / 0 warnings`
  - `Test-Path src\\games\\smashup\\__tests__\\wizard-neophyte-ongoing.test.ts` -> `False`
  - `npm run test:structure -- --all` -> `checked files: 29, OK`
- [ ] 下一步候选：
  - 继续扫描根目录残留历史文件，优先找“单派系旧入口 + abilities 专项已存在”的下一份候选
  - 优先复核 `cthulhu-chosen-display-mode.test.ts`、`wizard-archmage-discard-play.test.ts` 这类名字像历史 bug 壳、但可能只剩单派系专项合同的小文件

## Addendum（2026-05-17 12:04 +08）：`cthulhu-chosen-display-mode.test.ts` 已并回 `abilities/cthulhu.test.ts` 并退场

- [x] `src/games/smashup/__tests__/abilities/cthulhu.test.ts`
  - 已吸收原 `cthulhu-chosen-display-mode.test.ts` 的显示合同：
  - `cthulhu_chosen_confirm` 选项应是 `displayMode: 'button'`
  - 选项 value 不应携带 `baseDefId`
  - 多实例排队时第二个 `cthulhu_chosen_confirm` 也保持 button displayMode 与正确玩家归属
- [x] `src/games/smashup/__tests__/cthulhu-chosen-display-mode.test.ts`
  - 文件本体已删除，不再保留“根目录神选者 display bug 壳 + abilities/cthulhu.test.ts”双入口并存状态
- [x] 这次不是只收 bug 文件名：
  - `cthulhu.test.ts` 原本就已经有 `cthulhu_chosen beforeScoring` 主体块
  - 根目录旧文件剩下的只是同一能力的 UI 选项合同与排队显示合同
  - 迁移后这些断言直接附着在现有 `cthulhu_chosen` 专项块，不再保留一份本地手搓 `makeMS` / `makePlayer` 的独立壳层
- [x] 本阶段验证完成：
  - `npx vitest run src/games/smashup/__tests__/abilities/cthulhu.test.ts src/games/smashup/__tests__/cthulhu-chosen-display-mode.test.ts` -> `2 files / 74 tests passed`（删除前组合基线）
  - `npx eslint src/games/smashup/__tests__/abilities/cthulhu.test.ts src/games/smashup/__tests__/cthulhu-chosen-display-mode.test.ts` -> `0 errors / 0 warnings`（删除前组合基线）
  - `npx vitest run src/games/smashup/__tests__/abilities/cthulhu.test.ts` -> `1 file / 71 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/cthulhu.test.ts` -> `0 errors / 0 warnings`
  - `Test-Path src\\games\\smashup\\__tests__\\cthulhu-chosen-display-mode.test.ts` -> `False`
  - `npm run test:structure -- --all` -> `checked files: 29, OK`
- [ ] 下一步候选：
  - 继续扫描根目录残留历史文件，优先找“单派系旧入口 + abilities 专项已存在”的下一份候选
  - `wizard-archmage-discard-play.test.ts` 需要先判断它到底是巫师专项第二入口，还是在锁自定义 discard provider / runner 壳的特殊合同

## Addendum（2026-05-17 12:12 +08）：`wizard-archmage-discard-play.test.ts` 已判定为历史自定义 provider 壳并退场

- [x] `src/games/smashup/__tests__/wizard-archmage-discard-play.test.ts`
  - 文件本体已删除，不再保留“根目录大法师 discard-play 测试壳”
- [x] 这次不是并回专项，而是直接退场：
  - 旧文件的两条合同分别是：
  - “从弃牌堆打出大法师应获得额外行动”
  - “从手牌打出大法师应获得额外行动（对照组）”
  - 但它们本身不是通过真实现行业务入口覆盖，而是靠测试内临时 `registerDiscardPlayProvider({ id: 'test_archmage_discard_play', ... })` + 自建 `GameTestRunner` 壳去喂 `fromDiscard: true`
  - 当前真实覆盖已经存在：
  - [`wizard-archmage-zombie-interaction.test.ts`](</D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/wizard-archmage-zombie-interaction.test.ts:1>) 已用真实 `zombie_they_keep_coming` 链路覆盖“从弃牌堆打出大法师应获得额外行动”
  - [`archmageE2E.test.ts`](</D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/archmageE2E.test.ts:172>) 已覆盖“从手牌打出大法师当回合仍可获得额外行动”
  - 因此保留旧文件只是在重复维护一份测试专用 provider 壳，而不是保护新的业务不变量
- [x] 本阶段轻量验证完成：
  - `Test-Path src\\games\\smashup\\__tests__\\wizard-archmage-discard-play.test.ts` -> `False`
  - `npx eslint src/games/smashup/__tests__/wizard-archmage-zombie-interaction.test.ts src/games/smashup/__tests__/archmageE2E.test.ts` -> `0 errors / 0 warnings`
  - `npm run test:structure -- --all` -> `checked files: 30, OK`
- [ ] 额外说明：
  - 本轮尝试对 `wizard-archmage-discard-play.test.ts + wizard-archmage-zombie-interaction.test.ts + archmageE2E.test.ts` 做组合 `vitest` 基线时，运行环境因剩余可用内存仅约 `1.23 GB` 发生 Node / PowerShell OOM，当前不把这类 OOM 当作代码红灯
  - 等环境内存恢复后，可再补一次这组三文件的定点回归，作为删除冗余壳后的强验证
- [ ] 下一步候选：
  - 继续扫描根目录残留历史文件，优先找“真正的业务第二入口”与“仅剩测试壳/临时 provider 壳”这两类对象
  - `wizard-archmage-zombie-interaction.test.ts` 需要继续判断是否应并回 `abilities/wizards.test.ts`，还是保留为跨派系真实链路回归

## Addendum（2026-05-17 12:13 +08）：`wizard-archmage-zombie-interaction.test.ts` 已并回 `abilities/wizards.test.ts` 并退场

- [x] `src/games/smashup/__tests__/abilities/wizards.test.ts`
  - 已吸收原 `wizard-archmage-zombie-interaction.test.ts` 的真实链路合同：
  - `wizard_archmage` 通过 `zombie_they_keep_coming` 从弃牌堆打出时，仍按 `onMinionPlayed` 授予额外行动
- [x] `src/games/smashup/__tests__/wizard-archmage-zombie-interaction.test.ts`
  - 文件本体已删除，不再保留“根目录大法师 + 僵尸交互 bug 壳”
- [x] 这次不是机械删壳：
  - 这条测试虽然场景用了僵尸行动卡，但真正变化的行为是 `wizard_archmage` 自己“被真实打出后是否获得额外行动”
  - 因此它更适合并到 `wizards.test.ts` 现有 `wizard_archmage` 专项块，而不是继续挂在根目录 bug 文件里
  - 同时，之前已删掉的 `wizard-archmage-discard-play.test.ts` 属于测试专用 provider 壳；本轮保留的是走真实 `zombie_they_keep_coming -> prompt -> 从弃牌堆打出` 链路的现行业务覆盖
- [x] 本阶段验证完成：
  - `npx eslint src/games/smashup/__tests__/abilities/wizards.test.ts` -> `0 errors / 0 warnings`
  - `npx vitest run src/games/smashup/__tests__/abilities/wizards.test.ts` -> `1 file / 29 tests passed`
  - `Test-Path src\\games\\smashup\\__tests__\\wizard-archmage-zombie-interaction.test.ts` -> `False`
  - `npm run test:structure -- --all` -> `checked files: 30, OK`
- [ ] 下一步候选：
  - 继续扫描根目录残留历史文件，优先找“单派系业务行为已经有专项入口，但根目录仍保留历史 bug/interaction/pod 壳”的下一份候选
  - `killer-plant-pod-verification.test.ts` 仍需谨慎复核边界，不能因为名字像小壳就机械处理

## Addendum（2026-05-17 12:20 +08）：`killer-plant-pod-verification.test.ts` 已并回 `abilities/killer-plants.test.ts` 并退场

- [x] `src/games/smashup/__tests__/abilities/killer-plants.test.ts`
  - 已吸收原 `killer-plant-pod-verification.test.ts` 中专项文件尚未承接的 POD 合同：
  - POD 牌表数量：`killer_plant_sleep_spores_pod` / `killer_plant_budding_pod`
  - `killer_plant_weed_eater_pod` 不继承原版进场 debuff，且控制者回合开始获得 +2 力量
  - `killer_plant_sprout_pod` 被 `General Ivan POD` 保护时仍继续完成检索
  - `playCards` 阶段不应回补 `sprout_pod` 的 `startTurn` 触发
  - `sprout_pod -> water_lily_pod` 同窗口立即抽牌、链式 `sprout_pod` 保持 `startTurn` 直到链结束
  - 爆破点压到 0 后进入计分阶段只产生一次 `BASE_SCORED`
- [x] `src/games/smashup/__tests__/killer-plant-pod-verification.test.ts`
  - 文件本体已删除，不再保留“根目录 Killer Plants POD verification 壳 + abilities/killer-plants.test.ts”双入口并存状态
- [x] 这次不是机械整份复制：
  - `killer_plant_overgrowth_pod` 降爆破点这类已在专项文件中存在等价覆盖的内容没有重复搬运
  - 只把专项文件尚未承接、且仍属于杀人植物 POD 行为边界的合同并回
  - 同时把旧文件里乱码/临时说明风格的标题收回成可维护的专项语义
- [x] 迁移中的真实问题已收口：
  - 第一次单跑 `killer-plants.test.ts` 出现 3 条红灯，不是实现回归，而是本文件前半段 `beforeEach` 把全局注册表收窄到 `registerKillerPlantAbilities()`，导致新增 POD 段吃到半初始化状态
  - 已为 `killer_plants POD 数据与特殊回归` 补独立 `beforeEach`：`clearRegistry/clearBaseAbilityRegistry/clearPowerModifierRegistry/clearOngoingEffectRegistry/clearInteractionHandlers/resetAbilityInit/initAllAbilities`
  - 补完后专项单文件恢复全绿
- [x] 本阶段验证完成：
  - `npx vitest run src/games/smashup/__tests__/abilities/killer-plants.test.ts src/games/smashup/__tests__/killer-plant-pod-verification.test.ts` -> `2 files / 48 tests passed`（删除前组合基线）
  - `npx eslint src/games/smashup/__tests__/abilities/killer-plants.test.ts src/games/smashup/__tests__/killer-plant-pod-verification.test.ts` -> `0 errors / 0 warnings`（删除前组合基线）
  - `npx vitest run src/games/smashup/__tests__/abilities/killer-plants.test.ts` -> `1 file / 47 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/killer-plants.test.ts` -> `0 errors / 0 warnings`
  - `Test-Path src\\games\\smashup\\__tests__\\killer-plant-pod-verification.test.ts` -> `False`
  - `npm run test:structure -- --all` -> `checked files: 31, OK`
- [ ] 下一步候选：
  - 继续扫描根目录残留历史文件，优先找“内容仍属于单派系专项，但测试名仍挂着 bug/verification/pod 壳”的下一份候选
  - 重点复核 `ninja-hidden-ninja-interaction-bug-repro.test.ts`、`pirate-cove-repeat-trigger-bug.test.ts`、`mothership-scout-afterscore-bug.test.ts` 这类文件是专项第二入口，还是应保留的跨系统/跨派系真实链路回归

## Addendum（2026-05-17 14:08 +08）：`expansionBaseAbilities.test.ts` 继续按基地簇瘦身

- [x] `src/games/smashup/__tests__/bases/mountains-of-madness-base.test.ts`
  - 已吸收 `base_mountains_of_madness` 的更完整合同，明确 Trade 场景下疯狂卡归随从拥有者
- [x] `src/games/smashup/__tests__/bases/al9000-bases.test.ts`
  - 已承接 `base_greenhouse` / `base_secret_garden` / `base_inventors_salon` 三个 AL9000 基地合同
- [x] `src/games/smashup/__tests__/expansionBaseAbilities.test.ts`
  - 已删掉整段 AL9000 测试入口，当前保留 35 条非 AL9000 合同
- [x] 本阶段验证完成：
  - `npx vitest run src/games/smashup/__tests__/bases/mountains-of-madness-base.test.ts src/games/smashup/__tests__/bases/al9000-bases.test.ts src/games/smashup/__tests__/expansionBaseAbilities.test.ts` -> `3 files / 46 tests passed`
  - `npx eslint src/games/smashup/__tests__/bases/mountains-of-madness-base.test.ts src/games/smashup/__tests__/bases/al9000-bases.test.ts src/games/smashup/__tests__/expansionBaseAbilities.test.ts` -> `0 errors / 0 warnings`
  - `npm run test:structure -- --all` -> `checked files: 55, OK`

## Addendum（2026-05-17 14:45 +08）：继续收缩基地测试入口

- [x] `src/games/smashup/__tests__/bases/move-minion-bases.test.ts`
  - 已修正 `makeBase` 调用合同，`other_base` 统一改成 `makeBase({ defId, minions })`
  - 6 条 move-minion 基地合同通过
- [x] `src/games/smashup/__tests__/bases/plateau-of-leng-base.test.ts`
  - 已新增独立专项文件，承接 `base_plateau_of_leng` 的即时分支与同名随从额度合同
  - 6 条用例通过
- [x] `src/games/smashup/__tests__/abilities/fairies.test.ts`
  - 已吸收 `base_fairy_ring` 的非首次打出回归
  - `expansionBaseAbilities.test.ts` 中对应的重复旧段已删除
- [x] 本阶段验证完成：
  - `npx vitest run src/games/smashup/__tests__/bases/move-minion-bases.test.ts src/games/smashup/__tests__/bases/plateau-of-leng-base.test.ts src/games/smashup/__tests__/abilities/fairies.test.ts src/games/smashup/__tests__/expansionBaseAbilities.test.ts` -> `4 files / 45 tests passed`
  - `npx eslint src/games/smashup/__tests__/bases/plateau-of-leng-base.test.ts src/games/smashup/__tests__/abilities/fairies.test.ts src/games/smashup/__tests__/expansionBaseAbilities.test.ts` -> `0 errors / 0 warnings`
  - `npm run test:structure -- --all` -> `checked files: 60, OK`

## Addendum（2026-05-17 14:53 +08）：`expansionBaseAbilities.test.ts` 整体退场

- [x] `src/games/smashup/__tests__/bases/the-asylum-base.test.ts`
  - 新增独立基地专项，承接疯人院的手牌放盒子 / 选随从加指示物合同
- [x] `src/games/smashup/__tests__/bases/innsmouth-base.test.ts`
  - 新增独立基地专项，承接印斯茅斯的两步交互与 stale 卡底合同
- [x] `src/games/smashup/__tests__/bases/miskatonic-university-base.test.ts`
  - 新增独立基地专项，承接密大基地的首次打出分支合同
- [x] `src/games/smashup/__tests__/expansionBaseAbilities.test.ts`
  - 文件本体已删除，不再作为基地能力聚合入口
- [x] 本阶段验证完成：
  - `npx vitest run src/games/smashup/__tests__/bases/the-asylum-base.test.ts src/games/smashup/__tests__/bases/innsmouth-base.test.ts src/games/smashup/__tests__/bases/miskatonic-university-base.test.ts src/games/smashup/__tests__/bases/mountains-of-madness-base.test.ts src/games/smashup/__tests__/bases/plateau-of-leng-base.test.ts` -> `5 files / 19 tests passed`
  - `npx eslint src/games/smashup/__tests__/bases/the-asylum-base.test.ts src/games/smashup/__tests__/bases/innsmouth-base.test.ts src/games/smashup/__tests__/bases/miskatonic-university-base.test.ts src/games/smashup/__tests__/bases/mountains-of-madness-base.test.ts src/games/smashup/__tests__/bases/plateau-of-leng-base.test.ts` -> `0 errors / 0 warnings`
  - `npm run test:structure -- --all` -> `checked files: 62, OK`
