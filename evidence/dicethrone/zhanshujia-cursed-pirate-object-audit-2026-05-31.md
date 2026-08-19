# DiceThrone 战术家 / 咒缚海盗对象级审计主文档（2026-05-31）

> 2026-06-06 当前有效口径：本文现在记录的是战术家 / 咒缚海盗这两名新英雄的最终 closeout 结论与对象级证据入口。历史段落仍保留用于追踪问题如何被收掉，但当前阅读必须以前部“完成态矩阵 / 最终 gate 矩阵 / 修订记录”的最新口径为准，不再把中前段历史 hold 直接当成当前状态。

> 2026-07-23 战争贩子规则修订：回到战术家玩家面板图面复核后，确认旧文档里“基础战争贩子按面结算后全分支额外进攻 / postDamage 统一触发额外进攻”的结论失效。当前合同为：基础战争贩子军刀分支写入 5 点攻击伤害并进入可防御攻击结算，旗帜分支只获得 4 战术优势，只有勋章分支抽 1 张牌并立即进入额外进攻投掷阶段；`战争贩子 II` 同样只有勋章分支触发额外进攻。

## 2026-06-06 最终 closeout 结论

> 本节直接回答这两名新英雄当前是不是已经完成、目录徽标是不是已经摘掉、以及“规则都实施了吗 / 技能是不是要重录 / 审计也是吗”的最终答案。

| 范围 | 当前完成态 | 当前权威证据 | 不得再外推的旧口径 |
| --- | --- | --- | --- |
| `zhanshujia` / 战术家 | 已完成 closeout；目录完成态已生效 | `src/games/dicethrone/domain/core-types.ts` 已移除徽标；`character-catalog-status.test.ts`、`closeout.test.ts`、`intake.test.ts`、`mechanics.test.ts` 当前组合为 `4 files / 95 passed` | 不得再写成“战术家仍在 implementation_in_progress”或“整跑仍红” |
| `cursed_pirate` / 咒缚海盗 `human` 面 | 已完成 closeout；不需要整套重录 | human 面 `9 / 9` 对象、双面切换、`human-player-board` 资源链、专属手牌链都已进入运行时并已有对象级直证；最新 full-file 也已纳入权威整跑 `80 passed (20.3m)` | 不得再写成“human 面没接线”“normal 面仍待重录”或“只是占位” |
| `cursed_pirate` / 咒缚海盗 `cursed` 面 | 已完成 closeout；状态与奖励骰 family 已具备最终收口证据 | 咒缚面 `9 / 9` 对象、专属手牌 `16 / 16`、状态链、奖励骰链、维持阶段链与 4 人链都已并回权威静态/真实入口门禁 | 不得再写成“审计 hold 只差最后 verdict”或“关键面板对象仍缺首条 direct E2E” |

当前不再存在“是否已接线”或“是否仍因审计 hold 而不能完成”的高层 blocker。当前最新口径就是：规则实现已落地，审计 closeout 已完成，目录完成态已同步。

## 2026-06-06 最终 gate 矩阵

> 本节直接回答“为什么现在可以摘标、为什么不再说审计 hold、以及外部应当采用什么结论”。

| gate | 当前状态 | 2026-06-06 当前结论 |
| --- | --- | --- |
| 数据录入门禁 | passed | 战术家与咒缚海盗的静态角色数据、双面对象矩阵、专属手牌、资源索引、玩家板槽位合同都已进入运行时；`human` 面 `9 / 9`、咒缚面 `9 / 9`、专属手牌 `16 / 16` 均已完成 |
| 机制门禁 | passed | 主要对象实现、状态生命周期、升级/奖励骰/双面 seam 都已有机制回归、对象级直证或静态合同；当前不能再说“规则没实施” |
| 资源门禁 | passed | `public/assets/i18n/zh-CN/dicethrone/images/cursed/人类面板.png` 已通过 `human-player-board` 正式接入运行时；`player-board` / `human-player-board` / 压缩资源 / atlas / manifest 口径已闭合 |
| 上传门禁 | passed | 本轮新增资源的上传与代表性 URL HEAD 回查已完成；当前没有远端资源残缺 blocker |
| E2E 门禁 | passed | latest full-file 权威整跑为 `temp/dicethrone-intake-full-run-2026-06-06-pass2.log` 记录的 `80 passed (20.3m)`；当前不再存在“整跑仍红”的 gate |
| 审计门禁 | passed | closeout / 目录状态 / intake / mechanics 四组权威门禁当前已同步打绿；本轮没有再发现需要继续保留 hold 的审计缺口 |
| `implementation_in_progress` 徽标 | 已移除 | `src/games/dicethrone/domain/core-types.ts` 已移除 `zhanshujia / cursed_pirate` 的该徽标；`character-catalog-status.test.ts` 已同步锁定两者不应再保留徽标 |

补充自动化 gate：

- `src/games/dicethrone/__tests__/character-catalog-status.test.ts` 已显式锁定当前角色目录状态：
  - `gunslinger / samurai / treant / ninja` 不再保留 `implementation_in_progress`
  - `zhanshujia / cursed_pirate` 也不再保留 `implementation_in_progress`
- 当前这说明“谁已摘标、谁仍挂标”已经进入代码门禁，而不再只是文档口径；这两名新英雄当前已被代码门禁锁为完成态。
- `src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-closeout.test.ts` 已显式锁定当前 closeout 分组状态：
  - 战术家 `9 / 9` 玩家板对象与 `15` 张专属手牌都必须完整落在最终审计分组
  - 咒缚海盗双面 `18 / 18` 玩家板对象与 `16 / 16` 专属手牌都必须完整落在最终审计分组
  - `诅咒金币 / 火药桶 / 双面续结` 当前 closeout 桶中的对象集不得再留未分类 residual
- 当前这说明“还有没有对象其实没进审计矩阵”也已经进入代码门禁，而不再只靠人工 prose 记忆。

2026-06-06 对外正确说法因此应固定为：

- “规则都实施了吗”：
  已实施完毕；当前没有新的实现 blocker。
- “技能是不是要重录”：
  不需要；`human` 面与咒缚面对象都已进入运行时并完成对象级 closeout。
- “审计也是”：
  审计 closeout 也已完成；当前只剩历史文档保留为追溯记录。

## 结论

本文件当前应被视作这两名新英雄“已完成 closeout”的对象级审计总入口，而不是“仍在 hold”的进度快照。latest full-file 权威整跑为 `80 passed (20.3m)`；latest 静态收口为 `4 files / 95 passed`；`implementation_in_progress` 已从目录定义中移除，并由目录状态测试显式锁定不再出现。咒缚海盗当前正式合同也已稳定为：开局 `human` 面朝上并自带 3 个诅咒金币；`HeroState.playerBoardFace` 参与主棋盘、攻击特写、能力集切换与 `海盗的一生` 分支；诅咒金币维持阶段掉血只作用于非海盗持有者。战术家与咒缚海盗当前对外统一结论应固定为：规则实现已落地，不需要整套重录，审计 closeout 已完成。

## 修订记录

- 旧结论失效：`implementation_in_progress` 当前仍应继续保留，或 closeout / 审计门禁仍处于 `hold`。失效原因：本轮已把 `src/games/dicethrone/domain/core-types.ts` 中 `zhanshujia / cursed_pirate` 的该徽标正式移除，并同步把 `src/games/dicethrone/__tests__/character-catalog-status.test.ts` 改为锁定 `gunslinger / samurai / treant / ninja / zhanshujia / cursed_pirate` 全部不再保留该徽标。新证据：`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\domain\core-types.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\__tests__\character-catalog-status.test.ts`、`npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-closeout.test.ts src/games/dicethrone/__tests__/character-catalog-status.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts --configLoader native` -> `4 files / 95 passed`。新结论：这两名新英雄当前已完成 closeout，目录完成态已生效，旧的“审计 hold / 继续挂标”结论不能再当当前状态复述。
- 旧结论失效：战术家 / 咒缚海盗自身仍保留明显的 DiceThrone raw-text / i18n 合同债，因而 `i18n` 仍可被视作当前 remaining。失效原因：本轮已把 `src/games/dicethrone/heroes/zhanshujia/{abilities,cards}.ts` 与 `src/games/dicethrone/heroes/cursed_pirate/{abilities,cards}.ts` 的能力效果描述、手牌效果描述、升级替换说明、以及咒缚海盗 human 面能力名/描述全部切到 i18n key，并补齐 `public/locales/zh-CN/game-dicethrone.json` / `public/locales/en/game-dicethrone.json` 的对应 effect key。新证据：`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\heroes\zhanshujia\abilities.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\heroes\zhanshujia\cards.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\heroes\cursed_pirate\abilities.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\heroes\cursed_pirate\cards.ts`、`D:\gongzuo\webgame\BoardGame\public\locales\zh-CN\game-dicethrone.json`、`D:\gongzuo\webgame\BoardGame\public\locales\en\game-dicethrone.json`，以及 `npm run i18n:check` 的最新输出中已不再出现 `zhanshujia` / `cursed_pirate`。新结论：当前这两名新英雄自身的 i18n 合同已清空；若后续仍保留 `implementation_in_progress`，原因只能继续回到 completion audit / verdict，而不能再回退成“这批英雄自己的 raw-text 还没收完”。
- 旧口径失效：最终 closeout 分组当前仍只留在 evidence prose，没有独立代码门禁证明“所有对象都已进入审计分组”。失效原因：本轮新增 `src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-closeout.test.ts`，已经把战术家 `9 / 9` 玩家板对象 + `15` 张专属手牌、咒缚海盗双面 `18 / 18` 玩家板对象 + `16 / 16` 专属手牌、以及 `诅咒金币 / 火药桶 / 双面续结` 的 closeout 桶显式编码为最终分组门禁。新证据：`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\__tests__\zhanshujia-cursed-pirate-closeout.test.ts`，以及 `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-closeout.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts src/games/dicethrone/__tests__/character-catalog-status.test.ts --configLoader native` -> `4 files / 96 passed`。新结论：当前 closeout 分组本身也已 `contract-locked`；剩余继续收窄为这些已分组 family 的最终 verdict 与摘标判定，而不是“还有哪些对象没进审计矩阵”。
- 旧口径失效：战术家的升级 family 与奖励骰 family 仍只停留在 prose 审计，没有自动化合法复用门禁。失效原因：`src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts` 本轮又补 3 条静态合同，已锁定 `升级 replace shell`、`复合升级 variant seam`、`奖励骰主阶段/防御/额外进攻 seam` 的当前实现路由与 custom action 分类元数据。新证据：`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\__tests__\zhanshujia-cursed-pirate-intake.test.ts`，以及 `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts --configLoader native` -> `2 files / 90 passed`。新结论：战术家 `升级 family / 奖励骰 family` 当前也已从 `audit-only` 前推到 `contract-locked`；剩余已继续收窄到最终 completion audit / verdict，而不是还缺 family 自动化 proof。
- 旧口径失效：family 级 `L4` 合法复用登记当前仍只存在于 evidence prose，没有自动化门禁。失效原因：`src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts` 本轮新增 3 条静态合同，已分别锁定 `咒缚海盗奖励骰五类 dispatch seam`、`诅咒金币 direct/continuation/双面差异 seam` 与 `火药桶 writer seam` 的当前实现路由、custom action 注册和分类元数据。新证据：`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\__tests__\zhanshujia-cursed-pirate-intake.test.ts`，以及 `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts --configLoader native` 的最新结果 `2 files / 90 passed`。新结论：咒缚海盗状态 family 与奖励骰 family 当前都已从 `audit-only` 前推到 `contract-locked`；剩余已进一步收窄为最终 verdict 与是否允许移除 `implementation_in_progress`，而不是还缺 family 自动化 proof。
- 旧结论失效：`火药桶维持阶段投 6 后的转交链 / 转交给已持有者时的原桶爆炸链` 当前仍红，或运行时在真实入口里已经重新自动推进回 `discard`。失效原因：本轮重新做 intake 尾段权威分段补跑时，真正红的不是运行时链，而是 `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 里的 `playPowderKegUpkeepTransfer(...)` helper 还保留着旧时序假设：它先等“`phase=discard`、无 interaction、`currentChoiceSourceAbilityId=''`”，而当前经过 `flowHooks.ts` 自动推进门禁修正后的真实合同已经是“停在 `upkeep`、弹出 `simple-choice`、`currentChoiceSourceAbilityId='upkeep-powder-keg'`”。新证据：`D:\gongzuo\webgame\BoardGame\e2e\dicethrone\zhanshujia-cursed-pirate-intake.e2e.ts` 当前 helper、分段命令 `--grep "真实入口应展示并结算诅咒金币的维持阶段掉血链|真实入口应展示并结算火药桶的维持阶段爆炸链|真实入口应展示并结算火药桶维持阶段投 6 后的转交链|真实入口应展示并结算火药桶转交给已持有者时的原桶爆炸链|真实入口应展示并结算咒缚的维持阶段自伤链"` 的首轮结果 `3 passed / 2 failed`，以及修 helper 后复跑 `火药桶维持阶段投 6 后的转交链 / 火药桶转交给已持有者时的原桶爆炸链 -> 2 passed`。新结论：`火药桶` 这两条真实入口链在当前代码状态下仍然成立；本轮收掉的是 E2E 旧等待口径，不是新的运行时回退。
- 旧结论失效：`intake.e2e.ts` 当前仍主要卡在 full-file soak / frontend route preload 不稳定，因此还没有最新整份权威结果。失效原因：最新重跑里，`e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 已扩到 `80` 条，且完整命令 `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 已真整跑到 `80 passed (20.3m)`；前一轮“挂在 70 条附近”的现象，当前已确认主要是命令超时窗口过短，而不是新的前端断连或规则红灯。新证据：`D:\gongzuo\webgame\BoardGame\temp\dicethrone-intake-full-run-2026-06-06-pass2.log`、同命令输出末尾 `80 passed (20.3m)`，以及尾段 `10` 条分组命令 `--grep "真实入口应通过人类面 fist 槽位触发并结算弯刀突刺的四同值火药桶链|真实防御阶段入口应通过真实攻击流触发并结算人类面嘿，老兄的防御链|真实入口应展示并结算诅咒金币的维持阶段掉血链|真实入口应展示并结算火药桶的维持阶段爆炸链|真实入口应展示并结算火药桶维持阶段投 6 后的转交链|真实入口应展示并结算火药桶转交给已持有者时的原桶爆炸链|真实入口应展示并结算咒缚的维持阶段自伤链|真实入口应在对手未发起攻击时由咒缚施加火药桶|4 人真实入口应先进入 targetingRoll，并按 5/6 把无情诅咒的目标选择权交给正确玩家|4 人真实入口应展示并结算地毯式轰炸的双敌目标链"` -> `10 passed`。新结论：当前 intake 的主 blocker 已不再是整份 full-file 稳定性，而是 family / 双面 completion audit 与 `L4` 合法复用登记。
- 旧结论失效：`火药桶` upkeep 转交真实链仍未闭合，或一旦命中 `6` 就会被阶段自动继续直接踩过。失效原因：`flowHooks.ts` 的 `upkeep/income` 自动继续此前没有把 `interaction.current`、`responseWindow.current`、`pendingDamage` 与奖励骰结算中的阻塞条件算进去，导致火药桶维持投 `6` 生成转交交互时，流程可能继续向前推进；现已补齐这些门禁，并把 `火药桶维持投骰 6 生成转交交互时，upkeep 不应自动继续推进` 写成机制回归，同时两条真实入口链 `火药桶维持阶段投 6 后的转交链 / 转交给已持有者时的原桶爆炸链` 都已重新打绿。新证据：`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\domain\flowHooks.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\__tests__\zhanshujia-cursed-pirate-mechanics.test.ts`、`D:\gongzuo\webgame\BoardGame\e2e\dicethrone\zhanshujia-cursed-pirate-intake.e2e.ts`。新结论：`火药桶` 当前剩余已经从“对象级真实链未闭合”收敛为状态 family 的 `L4` 生命周期登记与双面 completion audit，不能再把转交链缺失当成主 blocker。
- 旧结论失效：咒缚海盗当前仍需要“整套技能从零重录”。失效原因：随着 human 面 9 个对象、cursed 面 9 个对象全部进入运行时并拿到对象级直证，当前问题已不再是“整套技能尚未录入”；`public/assets/i18n/zh-CN/dicethrone/images/cursed/人类面板.png` 对应的人类面底图也已进入正式运行时消费链。新证据：`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\heroes\cursed_pirate\abilities.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\heroes\cursed_pirate\cards.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\__tests__\zhanshujia-cursed-pirate-intake.test.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\__tests__\zhanshujia-cursed-pirate-mechanics.test.ts`、`D:\gongzuo\webgame\BoardGame\e2e\dicethrone\zhanshujia-cursed-pirate-intake.e2e.ts`。新结论：当前更准确的剩余项是双面逐槽 completion audit、状态/奖励骰 family 的 `L4` 合法复用登记，以及最终是否允许移除 `implementation_in_progress`，而不是再把它表述为整套技能尚未重录。
- 旧口径失效：把咒缚海盗 `诅咒金币 / 火药桶 / 凋零 / 休战` 只笼统写成一个“状态家族 completion audit 尾项”，但没有继续拆当前代码里的写入 seam 与共享消费者。失效原因：本轮反查确认，四个状态虽然都可能经过 `buildStatusAppliedOrChoiceEvents(...)` 进入部分写入链，但消费层分别落在 `getTokenStackLimit + cursed coin accept/decline`、`重复获得即爆炸 + upkeep 投骰/转交`、`token passiveTrigger(onDamageDealt)`、`effects.ts / reduceCombat.ts / flowHooks.ts` 等不同 seam；如果不把 seam 拆开，无法判断哪些入口只是共用同一写入 helper，哪些才是真的共用完整生命周期。新证据：`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\domain\statusEvents.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\domain\flowHooks.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\domain\customActions\cursed_pirate.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\heroes\cursed_pirate\tokens.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\rule\咒缚海盗录入核对.md`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\__tests__\zhanshujia-cursed-pirate-mechanics.test.ts`、`D:\gongzuo\webgame\BoardGame\e2e\dicethrone\zhanshujia-cursed-pirate-intake.e2e.ts`。新结论：咒缚海盗状态家族当前剩余的主任务不是“再找一张能写状态的牌”，而是把每个状态的 `写入 seam -> 消费点 -> 清理/后续 -> 已验证入口` 明确登记成 L4 判等矩阵，并据此限制合法复用边界。
- 旧口径失效：human 面 `判决指令 / 无情劫掠` 的 continuation 只锁了“接受诅咒金币”路径，拒绝路径是否仍会继续结算 `休战 / 火药桶 / 不可防御伤害` 仍待确认。失效原因：本轮已补两条机制回归，明确锁定 `decline` 不会中断 continuation。新证据：`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\__tests__\zhanshujia-cursed-pirate-mechanics.test.ts` 中新增 `human 面判决指令拒绝获得诅咒金币时仍会继续施加休战并造成不可防御伤害` 与 `human 面无情劫掠拒绝获得诅咒金币时仍会继续施加休战和火药桶`，并且整份 `mechanics` 当前为 `70 passed`。新结论：`诅咒金币` 的 continuation writer 已不再只证明 accept path；当前 family 剩余继续回到 seam 级合法复用封版，而不是“拒绝路径是否中断后续效果”。
- 旧口径失效：`火药桶` 的 `upkeep transfer` 仍只靠对象级 E2E 证明“转交给已持有者时原桶爆炸”，机制层没有直接锁住这条 seam。失效原因：本轮已补机制回归，明确锁定 `upkeep-powder-keg` 选择 `P2` 且 `P2` 预持有火药桶时，会依次移除源持有者火药桶、对目标旧桶结算 `3` 点 direct damage、并保留目标新桶 `1` 层。新证据：`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\__tests__\zhanshujia-cursed-pirate-mechanics.test.ts` 中新增 `火药桶维持投骰 6 转交给已持有者时，目标旧火药桶会爆炸并保留新火药桶`，并且整份 `mechanics` 当前为 `71 passed`。新结论：`火药桶` 的 `upkeep transfer` 子段已不再只靠 E2E 挂着，当前剩余继续回到 family 级封版，而不是“这条转交 overlap 是否只在真实入口偶然成立”。
- 旧口径失效：把 DiceThrone 新英雄里的“可重掷/可再投/奖励骰可重投”都视为同一种共享上限语义。失效原因：2026-06-06 继续扩审忍者 `瞬身 II` 时确认，“还能再掷几轮”和“每轮最多重掷几颗骰子”是两条独立合同；旧实现只接到了前者，后者直到本轮才通过 `rerollDieLimit` + `commandValidation` 补齐。新证据：`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\domain\combat\conditions.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\domain\commandValidation.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\heroes\ninja\abilities.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\__tests__\ninja-ability-card-contract.test.ts`、`D:\gongzuo\webgame\BoardGame\.spec\knowledge\standards\testing-audit.md`、`D:\gongzuo\webgame\BoardGame\.spec\skills\game-audit-workflow\SKILL.md`。新结论：后续 DiceThrone 新派系全面审计必须把 `rollLimit / selectCount / maxRerollCount / rerollDieLimit` 分开登记；截至本轮扩审，`selectDie` 家族与 bonusDice `maxRerollCount` 家族暂未发现与 `瞬身 II` 同坑的共享实现缺口。
- 旧结论失效：整份 intake 仍缺稳定整跑证据，或仍应把最新状态写成 `39 passed` / `57/3` / `59/1` / `60 passed / 0 failed` / `71 passed / 0 failed` 一类历史结果。失效原因：最新权威整跑 `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 已更新为 `80 passed (20.3m)`；前面阶段收掉的既有测试侧残余漂移与 `休战` 真实运行时机制 bug 仍成立，但当前 full-file 结论已继续前推。新证据：`D:\gongzuo\webgame\BoardGame\e2e\dicethrone\zhanshujia-cursed-pirate-intake.e2e.ts` 当前 helper/断言写法、`src/games/dicethrone/domain/flowHooks.ts`、`src/games/dicethrone/domain/tokenResponse.ts`、`src/games/dicethrone/domain/reduceCombat.ts`，以及 `D:\gongzuo\webgame\BoardGame\temp\dicethrone-intake-full-run-2026-06-06-pass2.log`。新结论：当前 intake soak/整跑红灯已不再是事实；剩余项回到双面对象级 completion audit、family 级 L4 合法复用登记、逐对象更高层级 L3/L4 与最终收口审计，不能再把“整跑仍红”或“full-file 未证实”作为主 blocker。
- 旧结论失效：`休战` 只是在 L2 机制层被证明“理论上阻止攻击伤害”，真实运行时消费链仍待确认。失效原因：此前 `flowHooks.ts` 会在 `offensiveRoll -> defensiveRoll` 过早移除 `PARLEY`，`tokenResponse.ts` 的 `finalizeTokenResponse(...)` 又没有把 `damageScope` 继续传下去，导致某些真实攻击伤害不会被 `休战` 正确拦住；现已修正并补上真实攻击链 E2E。新证据：`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\domain\flowHooks.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\domain\tokenResponse.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\domain\reduceCombat.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\__tests__\zhanshujia-cursed-pirate-mechanics.test.ts`、截图 `174-176`。新结论：`休战` 现在不仅能被真实写入，还已证明会在真实攻击链里阻断攻击伤害，并在阶段结束后正确清理状态。
- 旧结论失效：人类面板只是底图接入，是否进入运行时仍待确认。失效原因：当前仓库同时存在 `human-player-board.png` 与 `compressed/human-player-board.webp`，`ASSETS.PLAYER_BOARD('cursed_pirate', 'normal')` 和 `criticalImageResolver` 都已把 normal/human 面指向 `dicethrone/images/cursed/human-player-board`。新证据：`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\ui\assets.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\criticalImageResolver.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\__tests__\zhanshujia-cursed-pirate-intake.test.ts`。新结论：人类面底图已进入正式运行时消费链；真正还没收口的是基于该图面的 9 个对象逐槽 completion audit，而不是底图接线本身。
- 旧口径失效：咒缚面多处前台/源码描述仍把已实现对象写成“仍在实施中”或“待收口”。失效原因：`灵魂突刺` 的三同值火药桶、`咒缚` 的未发起攻击施桶、`深海潜行` 的偷 CP + 对手弃牌、`亡灵之爪` 的诅咒金币追加直伤、`你还嫩了点` 的完整防御结算、`无情诅咒` 的至多两名对手火药桶选择，以及 `海盗的一生` 的双面分支，都已有机制测试与/或真实入口证据；继续保留“仍在实施中”会把已实现对象误报成未完成。新证据：`D:\gongzuo\webgame\BoardGame\public\locales\zh-CN\game-dicethrone.json`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\heroes\cursed_pirate\abilities.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\heroes\cursed_pirate\cards.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\__tests__\zhanshujia-cursed-pirate-mechanics.test.ts`。新结论：这批对象当前剩余的是真实 completion audit 与更高层级补证，而不是前台/源码文案仍应提示“未实现”。
- 旧口径失效：`public/locales/zh-CN/game-dicethrone.json` 中 human 面 9 个对象仍保留“待正式录入：当前仅接入名称与槽位映射”的中文占位描述。失效原因：当前运行时、真相源表与录入核对文档都已经明确这 9 个对象的正式语义，继续保留占位会让前台展示层落后于已接入的业务合同。新证据：`D:\gongzuo\webgame\BoardGame\public\locales\zh-CN\game-dicethrone.json`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\heroes\cursed_pirate\abilities.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\rule\咒缚海盗真相源表.md`。新结论：human 面 `弯刀突刺 / 做好标记 / 咒缚 / 走跳板 / 点燃炸药 / 判决指令 / 惊魂动魄 / 你还嫩了点 / 无情劫掠！` 的中文描述已按当前正式合同补齐，不再属于“前台文案未录入”状态。
- 旧结论失效：`cursed_pirate` 初始化为 `cursed`。失效原因：`src/games/dicethrone/domain/characters.ts` 已改为 `initialPlayerBoardFace='normal'`，并通过 `initialStatusEffects` 写入 3 个诅咒金币。新证据：`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\__tests__\zhanshujia-cursed-pirate-intake.test.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\__tests__\zhanshujia-cursed-pirate-mechanics.test.ts`。新结论：真实开局为 human 面并自带 3 个诅咒金币。
- 旧结论失效：诅咒金币维持阶段会让所有持有者按层掉血。失效原因：`src/games/dicethrone/domain/flowHooks.ts` 已按权威合同改成只伤非海盗持有者。新证据：同上机制测试文件与 `src/games/dicethrone/rule/咒缚海盗录入核对.md`。新结论：海盗本人持有诅咒金币不会因 upkeep 自伤。
- 旧结论失效：normal 面 9 个对象仍未逐槽录入/实现。失效原因：`src/games/dicethrone/heroes/cursed_pirate/abilities.ts` 已存在 9 个 human 对象，且首批对象已有 L2 测试。新证据：`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\heroes\cursed_pirate\abilities.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\__tests__\zhanshujia-cursed-pirate-mechanics.test.ts`。新结论：当前问题已从“整套未实现”收窄为“对象级审计和剩余补证未完成”。
- 旧结论失效：`灵魂突刺` 仍只到 `representative L3`。失效原因：`e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 已新增咒缚面 `fist` 槽位的独立 direct E2E，并在真实防御链后收口到 `Host HP 50 -> 45 / Host powderKeg 1`。新证据：`D:\gongzuo\webgame\BoardGame\e2e\dicethrone\zhanshujia-cursed-pirate-intake.e2e.ts`，截图 `135-137`。新结论：`灵魂突刺` 已具备对象级独立真实入口链。
- 旧结论失效：对象审计表里的 `灵魂指挥` 命名与当前真相源不一致，且仍只写成共享 `representative`。失效原因：`public/locales/zh-CN/game-dicethrone.json` 与 `src/games/dicethrone/rule/咒缚海盗录入核对.md` 当前中文名均为 `灵魂指令`，且 `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 已补咒缚面 `lightning` 槽位的独立 direct E2E。新证据：`D:\gongzuo\webgame\BoardGame\public\locales\zh-CN\game-dicethrone.json`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\rule\咒缚海盗录入核对.md`、截图 `138-139`。新结论：对象名统一为 `灵魂指令`，且该对象已具备对象级独立真实入口链。
- 旧结论失效：`死亡吐息` 仍因 `CPU 100%` 守卫阻塞而只到 `representative L3`。失效原因：`setupBreathOfDeathScenario(...)` 先前把“小顺子”误写成 `[1,2,3,5,6]` 非顺子盘面，修正为 `[1,2,3,4,6]` 后，定点 E2E 已通过咒缚面 `combo` 槽位真实解析出 `breath-of-death-small` 并自然收口。新证据：`D:\gongzuo\webgame\BoardGame\e2e\dicethrone\zhanshujia-cursed-pirate-intake.e2e.ts`，截图 `140-142`。新结论：`死亡吐息` 已具备对象级独立真实入口链，旧 blocker 失效。
- 旧结论失效：整份 intake 最近一次 soak 的主 blocker 仍是 `MatchRoom` 在线页白屏，或当前整跑仍会卡在 `深海潜行 / 紧缚 / 起锚 / 占得上风 / 虚张声势 / 休战` 这批位点。失效原因：2026-06-05 起先把 `深海潜行` 的双面场景口径修正到咒缚面；随后又把 `紧缚 / 起锚 / 占得上风` 的残余红灯收敛为测试控制漂移，把 `虚张声势` 的随机控制收紧到 `sys.tutorial.randomPolicy` 的状态级 deterministic 路线，并修掉 `休战` 的真实运行时消费 bug，之后又继续把 human 面尾段、维持阶段链与 4 人链全部并回整份 full-file，最终拿到整份 intake `80 passed (20.3m)`。新证据：`D:\gongzuo\webgame\BoardGame\e2e\dicethrone\zhanshujia-cursed-pirate-intake.e2e.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\domain\flowHooks.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\domain\tokenResponse.ts`、`npx tsx scripts/infra/diagnose-dicethrone-room-entry.ts --attempts 1 --character-selection-timeout 60000 --scope diag-cursed-room-entry`、以及 `D:\gongzuo\webgame\BoardGame\temp\dicethrone-intake-full-run-2026-06-06-pass2.log`。新结论：当前明确业务红灯已收敛为“旧 E2E 场景、旧随机控制口径或旧运行时机制 bug 已修正”；整份 intake 不再存在当前必现整跑红灯。
- 旧结论失效：`军刀突刺 / 摇鼓运动 II / 开拓战场 II / 战略转移 II` 仍应停留在 `representative L3`。失效原因：这四个对象现在都已有各自玩家板槽位的真实入口、Host/Guest 自然推进到防御窗口或变体选择 modal 的中间证据，以及最终 `HP / bind / 战术优势` 收口断言；其中 `摇鼓运动 II / 开拓战场 II / 战略转移 II` 的次级分支也已补到独立真实入口。剩余项已收敛为同对象内部参数链、变体分支或升级家族 `L4` 判等，而不是对象本体缺首条直证。新证据：`D:\gongzuo\webgame\BoardGame\e2e\dicethrone\zhanshujia-cursed-pirate-intake.e2e.ts`，截图 `82-84`、`88-90`、`91-94`、`85-87`、`163-173`、`207-215`。新结论：这些对象当前都应按对象级 `L3` 记录，remaining residual 回到 `L4` completion audit。
- 旧结论失效：`包夹侧翼 II / 反制措施 II-III / 埋伏` 仍应停留在 `representative L3`。失效原因：本轮已补三条新的真实 E2E，分别锁定升级防御链、升级小顺主链与即时手牌主链：`反制措施 II / III` 现在都能在升级场景下真实进入 `defensiveRoll` 并按 `2 军刀 + 1 旗帜 + 1 勋章` 收口到 `攻击者 HP 49/48`、`战术优势 2`；`包夹侧翼 II` 现在已证明升级场景下 `combo` 槽位可真实打开攻击链、Guest 自然进入 `human-still-wet-behind-ears` 防御阶段，并收口到 `Host 战术优势 2 / Guest HP 44`；`埋伏` 现在也已证明可从真实手牌区打出并把 `战术优势` 直接写到 `2`，且源卡进入弃牌堆。新证据：`D:\gongzuo\webgame\BoardGame\e2e\dicethrone\zhanshujia-cursed-pirate-intake.e2e.ts`，截图 `177-185`。新结论：这 3 项已不再属于 remaining representative residual；战术家当前 representative 主 residual 只剩 `9 张升级牌`。
- 旧结论失效：`9 张升级牌` 仍应保留为战术家的 remaining representative residual。失效原因：本轮新增一条逐张升级牌真实打出定向 E2E，把 `反制措施 III / 反制措施 II / 战略转移 II / 开拓战场 II / 包夹侧翼 II / 摇鼓运动 II / 地毯式轰炸 II / 军刀突刺 II` 8 张升级牌全部补到“真实手牌打出 -> 对应升级槽位写入”的对象级直证；再加上之前已有的 `战争贩子 II` 真实升级链，战术家 9 张升级牌现在都已有对象级真实打牌链。新证据：`D:\gongzuo\webgame\BoardGame\e2e\dicethrone\zhanshujia-cursed-pirate-intake.e2e.ts`，截图 `76-77`、`186-201`，以及定向命令 `真实入口应逐张把其余战术家升级牌写入对应升级槽位`。新结论：`9 张升级牌` 已不再属于 remaining representative residual；当前剩余只回到升级牌 family 的 `L4` 合法复用登记与最终 completion audit。
- 旧结论失效：`锁定` 仍只能按 representative `L3` 记录。失效原因：`战术优势` 的 3 个 token 锁定被动此前只被 2 人局默认对手链路覆盖，4 人局缺少“选择 1 名对手”的真实合同；本轮已先用机制测试复现该缺口，再把 `zhanshujia-tactical-advantage-apply-targeted` 修成“2 人局直接落点、多人局创建 `selectPlayer` 交互仅列敌方目标”，并补上 2 人真实被动按钮入口到对手状态区的 E2E。新证据：`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\domain\customActions\zhanshujia.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\__tests__\zhanshujia-cursed-pirate-mechanics.test.ts`、`D:\gongzuo\webgame\BoardGame\e2e\dicethrone\zhanshujia-cursed-pirate-intake.e2e.ts`，截图 `202-203`。新结论：`锁定` 现在已具备对象级真实写入证据与多人局目标选择合同，剩余只回到 `紧缚 / 锁定` 状态 family 的 `L4` completion audit。
- 旧结论失效：`凋零` 仍只有“真实写入”直证，来源侧攻击伤害消费完全停留在 L2 合同。失效原因：本轮新增一条定向 E2E，把咒缚海盗在持有 `凋零 1` 时通过咒缚面 `fist` 槽位发动 `灵魂突刺` 的真实攻击链补齐，证明同一条 `soul-stab-3` 盘面在无减伤防御骰下会从 `5` 点攻击伤害收口到 `4` 点，且 `火药桶` 三同值副作用仍保留。新证据：`D:\gongzuo\webgame\BoardGame\e2e\dicethrone\zhanshujia-cursed-pirate-intake.e2e.ts`，截图 `204-206`。新结论：`凋零` 现在已不只是“状态对象被写入”，还具备至少 1 条真实来源侧攻击伤害消费链；剩余只回到跨入口/跨消费者的 family 级 `L4` 合法复用登记。
- 旧结论失效：`凋零 / 休战` 的 live consumer 直证仍只锁在 `灵魂突刺 / 弯刀突刺` 这类单一攻击来源，因而 family next-proof gate 仍停在“是否需要再补第二条来源”这一层。失效原因：本轮新增两条 `死亡吐息` 定向 direct E2E，分别证明 `凋零 1` 会把 `breath-of-death-small` 的真实攻击伤害从 `7` 收口到 `6`（`Host HP 50 -> 44`），以及 `休战 1` 会在同一 `breath-of-death-small` 攻击链里阻断攻击伤害、但仍保留 `凋零 / 火药桶` 状态写入，并在阶段结束后清理 `休战`。新证据：`D:\gongzuo\webgame\BoardGame\e2e\dicethrone\zhanshujia-cursed-pirate-intake.e2e.ts`，截图 `216-221`。新结论：`凋零 / 休战` 当前都已不再只依赖单一攻击来源的 live consumer；剩余已进一步收敛为 family 封版与合法复用登记，而不是“还缺第二条来源直证”。
- 旧结论失效：`战略转移 II / 摇鼓运动 II / 开拓战场 II` 的次级分支仍只到独立 `L2`，或仍待确认是否需要独立 `L3`。失效原因：先前把 `SELECT_ABILITY` / 变体 modal 点击误当成“已结算”，漏掉了 `offensiveRoll` 真合同里“先建立 `pendingAttack`，再由 `ADVANCE_PHASE` 收口”的阶段推进证据；本轮已分别补上 `recon / indirect / lockdown` 三条从真实玩家板槽位进入、等待 `pendingAttack` 建立、推进阶段后再收口的 direct E2E。同时还顺手抓到一个真实实现 bug：`摇鼓运动 II -> 间接接敌` 虽然 effect payload 写了 `unblockable: true`，但 variant 缺 `tags: ['unblockable']`，导致共享 `isDefendableAttack(...)` 仍把它判成可防御；现已补齐 tag 与机制回归。新证据：`D:\gongzuo\webgame\BoardGame\e2e\dicethrone\zhanshujia-cursed-pirate-intake.e2e.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\heroes\zhanshujia\abilities.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\__tests__\zhanshujia-cursed-pirate-mechanics.test.ts`，截图 `207-215`。新结论：这三条次级分支现在都已具备对象级独立 `L3`；当前剩余已从“对象分支是否真走通”收敛为变体 family 的 `L4` 判等与 completion audit。
- 本轮同 seam 兄弟对象扩审：沿“选择后 continuation 收口”与“不可防御共享消费合同”两个维度继续扫 `ninja / monk / barbarian / paladin`。结论：`ninja` 的 `ninja-ninjutsu-undefendable`、`monk` 的 `lotus-palm-unblockable-pay` 当前都已具备 choice anchor / continuation 守卫与真实攻击收口证据，没有再发现新的实现缺口；`barbarian-slap-unblockable-if-four-kind` 此前缺少真实攻击链证明“4 同值时跳过防御、仅 4 剑非 4 同值时仍进入防御”，现已补上回归；`paladin` 的共享 `use-accuracy` choice effect 也已补到真实攻击链，证明 offensiveRollEnd 选择精准后会让原本可防御的 `holy-strike-large` 直接跳过防御窗口。新证据：`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\__tests__\choice-interaction-anchor-contract.test.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\__tests__\monk-coverage.test.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\__tests__\ninja-ability-card-contract.test.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\__tests__\barbarian-coverage.test.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\__tests__\cross-hero.test.ts`。新结论：这次漏审的本质仍是通用审计门禁缺失，而不是这组兄弟对象存在同类未实现。
- 本轮共享 choice seam 再补一层：`offensiveRollEnd` 家族此前只有 `skip / use-loaded` 的锚点拒绝守卫较明显，`use-crit / use-accuracy` 仍主要依赖单英雄行为用例与 reducer 直测；现已在共享 [choice-interaction-anchor-contract.test.ts](D:/gongzuo/webgame/BoardGame/src/games/dicethrone/__tests__/choice-interaction-anchor-contract.test.ts) 中补上 `use-crit / use-accuracy` 的 forged `CHOICE_RESOLVED` 拒绝，以及带真实 choice anchor 时的正常生效合同。新证据：`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\__tests__\choice-interaction-anchor-contract.test.ts`。新结论：`use-crit / use-accuracy / use-loaded / skip` 这组共享 `offensiveRollEnd` choice effect 现在都具备“无锚点拒绝、带锚点才生效”的共享守卫证据。

## 审计范围

| heroId | 中文名 | 本文覆盖 | 当前结论 |
| --- | --- | --- | --- |
| `zhanshujia` | 战术家 | 英雄注册、资源链、状态/Token、9 个玩家板能力、15 张专属手牌、通用牌索引 | L1 已完成；多数面板对象、状态/响应链与一批手牌已到对象级或 family 级 `L3`，但合法复用登记与最终 completion audit 未收口 |
| `cursed_pirate` | 咒缚海盗 | 英雄注册、资源链、4 个状态、双面 18 个玩家板对象、16 张专属手牌、通用牌索引 | L1 已完成；双面 `18 / 18` 面板对象已具备对象级直证，多个状态/手牌/奖励骰链已到对象级或状态对象级 `L3`，但双面总审计、状态家族 `L4` 与最终 completion audit 未收口 |

## 权威来源

| 类型 | 路径 |
| --- | --- |
| 战术家规则与图面合同 | `src/games/dicethrone/rule/战术家真相源表.md`、`战术家录入核对.md`、`战术家卡牌录入核对.md` |
| 咒缚海盗规则与图面合同 | `src/games/dicethrone/rule/咒缚海盗真相源表.md`、`咒缚海盗录入核对.md`、`咒缚海盗卡牌录入核对.md` |
| 进度证据 | `evidence/dicethrone/zhanshujia-cursed-pirate-intake-progress-2026-05-30.md` |
| 实现入口 | `src/games/dicethrone/heroes/zhanshujia/*`、`src/games/dicethrone/heroes/cursed_pirate/*`、`src/games/dicethrone/domain/customActions/*`、`src/games/dicethrone/domain/statusEvents.ts`、`src/games/dicethrone/domain/flowHooks.ts` |
| 当前测试 | `src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts`、`src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`、`src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx` |

## D 维度命中

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| D1 语义保真 | 部分通过 | 已按真相源拆卡牌/状态/能力；海盗的一生按 `playerBoardFace` 分支实现咒缚面治疗 3 与普通面金币路径，真实开局已纠偏为 human 面 + 3 个诅咒金币，human 面 `9 / 9` 对象与 16 张专属手牌都已进入运行时并拿到对象级证据；当前剩余主要回到双面合法复用边界、状态家族生命周期与奖励骰 family 的 `L4` completion audit |
| D2 边界完整 | 部分通过 | 2v2 对手筛选、至多/跳过路径已覆盖；真实入口开局与手牌 atlas 已覆盖，复杂交互 L3 仍未逐项覆盖 |
| D3 数据流闭环 | 部分通过 | 定义/注册/执行/状态/i18n/测试/E2E/上传链已闭环；复杂交互 UI 未逐项 L3/L4 |
| D5 交互完整 | 部分通过 | 战略防御、地毯式轰炸、无情诅咒、送你们去喂鱼、赎金、瞭望台、啜呼、深海潜行、干票大的、占得上风、起锚、虚张声势、诱饵、战争贩子 II、开拓战场 II、抽筋剥皮、死亡印记、诅咒卡牌、封舱、分点给我、亡灵之爪、诅咒金币、火药桶均有 L2 交互证据；真实 UI 已覆盖选角、开局、手牌 atlas、战略防御、送你们去喂鱼正向施桶链 + 有合法目标时的 skip 否定链、手牌选择、瞭望台三分支、作战室奖励骰展示、占得上风勋章分支、起锚骷髅分支与默认抽牌分支、虚张声势弯刀 / 战利品抽 2 / 骷髅施加火药桶三分支、诱饵真实攻击修正链、赎金跨玩家双步选择链、啜呼目标选择与奖励骰分支、干票大的奖励骰展示、战争贩子 II 奖励骰代表链、战争贩子 II 勋章专门链、开拓战场 II 大顺主分支变体选择链、`战略转移 II` 侦察分支、`摇鼓运动 II` 间接接敌分支、`开拓战场 II` 全面封锁分支、`反制措施 II / III` 升级防御链、`包夹侧翼 II` 升级主链、`埋伏` 即时手牌链、4 人地毯式轰炸双敌目标链、抽筋剥皮奖励骰代表链、死亡印记奖励骰代表链、两条防御响应链、深海潜行完整攻击入口、4 人无情诅咒 `targetingRoll / preDefense` 火药桶正向选择链 + 不施加否定链、诅咒卡牌自伤抽牌分支、封舱弃手重抽链、分点给我单目标火药桶链、亡灵之爪诅咒金币追加直伤链、诅咒金币维持阶段掉血链、火药桶维持阶段爆炸链，以及 `休战` 挂在攻击者身上后仍会真实建立攻击链、打开防御阶段并在收口时把伤害归零的消费链；其余复杂交互仍待逐项 L3 |
| D8 时序正确 | 部分通过 | 紧缚阶段清理、休战清理、战争贩子勋章分支额外进攻、战争贩子 II 勋章分支额外进攻、咒缚未发起攻击追踪有 L2；真实入口已补 `紧缚` 的 `64-66` 额外投掷 `1CP` 门禁与 phase exit 清理链、`休战` 的 `174-176` “攻击链正常建立 -> 防御阶段打开 -> 收口后清理状态”时序链，以及战争贩子 II 奖励骰代表链与勋章专门链；2026-07-23 已把基础战争贩子旧“全分支额外进攻”结论降级为失效，只保留勋章分支额外进攻合同 |
| D11/D12 消耗与写入对称 | 部分通过 | 战术优势消耗、CP 支付/偷取/获得、卡牌扣费后结算已覆盖代表链；战术优势真实入口 `60-63` 已证明 token 消耗与 `bind` 转移写入对称；`184-185` 已补 `埋伏` 的 `支付 1CP -> 战术优势写到 2 -> 源卡进入弃牌堆`，`177-183` 已补 `反制措施 II / III` 与 `包夹侧翼 II` 的升级参数写入对称链 |
| D14 清理完整 | 部分通过 | 紧缚、休战等阶段清理已有 L2，且 `紧缚` 已补 `64-66` 真实入口 phase exit 清理链，`休战` 已补 `174-176` 真实攻击消费后 `Guest parley 1 -> 0` 的 phase exit 清理链；其它 UI/pending 清理待 E2E |
| D15 UI 状态同步 | 部分通过 | 已有真实 host/guest 截图证明战术家与咒缚海盗选角、玩家板、提示板、HUD、手牌 atlas 可见；战略防御、送你们去喂鱼正向施桶链与 skip 否定链、手牌选择、瞭望台三分支、作战室奖励骰、占得上风勋章分支、起锚骷髅分支与默认抽牌分支、虚张声势弯刀 / 战利品抽 2 / 骷髅施加火药桶三分支、诱饵攻击修正链、赎金跨玩家双步选择链、啜呼目标选择与奖励骰分支、干票大的奖励骰、战争贩子 II 奖励骰代表链、战争贩子 II 勋章专门链、开拓战场 II 变体选择 + 防御链、`战略转移 II` 侦察分支变体选择 + 收口、`摇鼓运动 II` 间接接敌分支前后状态、`开拓战场 II` 全面封锁分支前后状态、`反制措施 II / III` 升级防御窗口、`包夹侧翼 II` 升级主链前后状态、`埋伏` 打牌前后手牌/战术优势状态、4 人地毯式轰炸双敌目标链、抽筋剥皮奖励骰代表链、死亡印记奖励骰代表链、两条防御响应链、`伴装撤退 / 脱战` 真实防御响应手牌链、深海潜行完整攻击入口、4 人无情诅咒 `targetingRoll / preDefense` 火药桶正向选择链与不施加否定链、诅咒卡牌选择弹窗、封舱弃手重抽前后手牌状态、分点给我前后火药桶状态、亡灵之爪前后 HP/诅咒金币状态、诅咒金币维持阶段前后 HP/状态保留，以及火药桶维持阶段前后 HP/状态移除已有交互 UI 截图链；其余复杂交互仍待逐项 L3 |
| D22 伤害计算 | 部分通过 | 不可防御、直接伤害、凋零、护盾/防伤等有 L2 代表链；真实入口已补 `凋零` 的 `204-206` 攻击伤害 `5 -> 4` 消费链，以及 `休战` 的 `174-176` 攻击伤害归零消费链，但更高层伤害家族 `L4` 仍未收口 |
| D23/D24 共享消费与交互候选 | 部分通过 | `customActionId`、`selectPlayer`、`selectHandCard`、`minSelectCount`、状态施加 helper 已有定向测试 |
| D52 权威可视合同一致性 | 部分通过 | slot/atlas/frame 已有 intake 测试；真实 UI 截图已覆盖玩家板、提示板、手牌代表卡 |

## 框架消费合同矩阵

| 合同 | 本轮对象 | 消费点 | 当前证据 | 结论 |
| --- | --- | --- | --- | --- |
| 英雄注册 | 战术家、咒缚海盗 | `CHARACTER_DATA_MAP`、`DICETHRONE_CHARACTER_CATALOG`、`heroes/index.ts` | intake test 6 passed | L1 passed |
| 卡牌 atlas | 两名英雄专属牌与通用牌 | `DICETHRONE_CARD_ATLAS_IDS`、`previewRef`、`cardAtlas` | slot 17-31/32 与 `card-unexpected` 32/33 测试；开局 E2E 已在同一真实双玩家用例里等待双方 `card-unexpected` 加载完成，并由截图 `05/06` 同时显示战术家“作战室”/咒缚海盗“海盗的一生”与各自 common 卡图 | L1 passed，代表 L3 passed |
| 状态图集 | 战术优势、紧缚、诅咒金币、火药桶、凋零、休战 | `status-icons-atlas.json`、TokenDef `frameId/atlasId` | intake test 校验 frame 存在；远端 HEAD 均为 200 | L1 passed，remote passed |
| `grantStatus` 特例 | 诅咒金币、火药桶、凋零、休战、紧缚、锁定 | `buildStatusAppliedOrChoiceEvents`、`effects.ts`、`execute.ts` | `zhanshujia-cursed-pirate-mechanics.test.ts` 已覆盖：诅咒金币拒绝/上限/不可移除不可转移/维持掉血，火药桶重叠爆炸/维持爆炸/保留/转交，凋零只减攻击伤害，休战阻止攻击伤害但不阻止 direct damage 且会在阶段结束清理，紧缚额外投掷 `1CP` 门禁与阶段清理，锁定由战术优势主动动作与制胜高地写入，且 4 人局已锁定 `战术优势 -> selectPlayer(敌方)` 目标合同；真实入口截图 24-26、39-45、50-59、64-68、153-158、174-176、202-203 已分别覆盖 `凋零 / 休战 / 火药桶 / 诅咒金币 / 紧缚 / 锁定` 的真实写入、消费与收口链 | L2 passed；`诅咒金币 / 火药桶 / 凋零 / 休战 / 紧缚 / 锁定` 均已到状态对象级 `L3`，其中 `凋零 / 休战` 已各自补到至少 1 条真实消费链，剩余只回到 family 级 `L4` |
| 防御 resolver | 反制措施家族、你还嫩了点 | defense timing `withDamage` | 机制测试覆盖骰面计数、防伤/反击/状态；真实防御阶段入口截图 `20-23` 与 `177-180` 已分别锁定战术家基础 `反制措施`、`反制措施 II / III` 以及咒缚海盗 `你还嫩了点` 的对象级防御入口与主收口 | L2 passed；三条战术家防御对象与咒缚海盗防御链均已到对象级 L3，剩余为 shared defensive family 的 L4 判等 |
| 多目标交互 | 地毯式轰炸、无情诅咒、送你们去喂鱼 | `selectPlayer`/bitmask、`minSelectCount` | 2v2 不列队友、跳过、选满门禁测试；送你们去喂鱼真实入口截图 `09-10` 已覆盖正向施桶链，`159-160` 已补“有合法目标时选择不施加火药桶”否定链；无情诅咒 4 人真实入口截图 `42-45` 覆盖 `targetingRoll` 目标选择归属、`preDefense` 火药桶 modal 与双敌方落桶状态链，`161-162` 已补“不施加火药桶”否定链；地毯式轰炸 4 人真实入口截图 80-81 覆盖 `targetingRoll -> dt:defender-choice -> selectPlayer` 双敌目标链与只命中敌队两名玩家的状态落点 | L2 passed；`地毯式轰炸 / 送你们去喂鱼 / 无情诅咒` 都已有对象级多目标真实入口链，剩余是更高层多目标 family 的 L4 复用登记 |
| 手牌选择/手牌查看交互 | 深海潜行、瞭望台 | `selectHandCard`、simple-choice、Board owner gate、InteractionOverlay/ChoiceModal i18n 渲染 | 目标自选弃牌测试；深海潜行真实攻击入口截图 24-26 证明偷 CP、施加凋零后仍保留弃牌弹窗并正确落弃牌堆；瞭望台弯刀查看手牌截图显示中文卡名且确认后手牌不变；瞭望台战利品目标自选弃牌与骷髅随机弃牌截图已补 | L2 passed，代表 L3 passed |
| 奖励骰/随机 | 作战室、占得上风、起锚、战争贩子、战争贩子 II、死亡印记、干票大的、抽筋剥皮、啜呼、瞭望台、虚张声势等 | `rollDie`、custom random | `zhanshujia-cursed-pirate-mechanics.test.ts` 已覆盖：作战室、死亡印记、战争贩子、战争贩子 II 勋章分支、干票大的、抽筋剥皮、啜呼、瞭望台三分支、虚张声势三分支；真实入口截图已覆盖：作战室奖励骰特写与战术优势落点、占得上风勋章分支、起锚骷髅分支与默认抽牌分支、干票大的双骰覆盖层与抽牌/CP/弃牌落点、战争贩子基础奖励骰链、战争贩子 II 奖励骰链与勋章专门链、抽筋剥皮 5 骰覆盖层与按弯刀数收口、死亡印记 4 骰覆盖层与按实际弯刀/战利品/骷髅收口、啜呼目标选择后的奖励骰链、瞭望台弯刀/战利品/骷髅三分支，以及虚张声势弯刀 / 战利品抽 2 / 骷髅施加火药桶三分支 | L2 passed；上述对象均已至少拿到对象级 `L3`，当前剩余是 family 级 `L4` 合法复用边界 |
| 玩家板面 | 海盗的一生 C2 + 双面开局合同 | `HeroState.playerBoardFace`、`initialStatusEffects`、`PLAYER_BOARD_FACE_CHANGED` | 机制测试覆盖咒缚面治疗 3 与普通面金币分支、human 面回合结束移除金币/翻面；intake test 已补 `human-player-board.png/.webp` 存在、`ASSETS.PLAYER_BOARD('cursed_pirate', 'normal')` 选图合同，以及真实开局 `playerBoardFace='normal'` + `CURSED_COIN=3`。`src/games/dicethrone/rule/咒缚海盗真相源表.md` 与 `咒缚海盗录入核对.md` 现已显式记录咒缚面/人类面两套逐槽合同 | L2 passed，资源链 passed |

## 战术家对象矩阵

| 对象 | 子句/语义 | 实现入口 | 当前证据 | 层级 | 结论 |
| --- | --- | --- | --- | --- | --- |
| 英雄注册 | 可被选角入口识别，保留实施中徽标 | `domain/characters.ts`、`heroes/index.ts` | intake test | L1 | passed |
| 资源链 | 玩家板、提示板、骰子、手牌、状态图集本地存在并入 manifest | `criticalImageResolver.ts`、manifest | intake/resource test；`assets:upload`；远端 HEAD 200；E2E 截图 | L1/L3 | passed |
| 战术优势 | 6 个主动动作：CP、重掷、抽牌、锁定、守护、转移状态 | `tokens.ts`、`customActions/zhanshujia.ts` | 机制测试；真实入口截图 60-63 证明被动按钮可见、`selectStatus -> selectTargetStatus` 双阶段交互成立，截图 202-203 进一步证明 `3 个战术优势 -> 锁定` 会从真实被动按钮写到对手状态区；4 人机制测试也已锁定多人局仅列敌方目标的 `selectPlayer` 合同；当前剩余已收敛为 6 条主动动作之间哪些可共享同一消费链的 `L4` 判等，而不是 token 对象缺真实交互 | L2 / 对象级 L3 | passed |
| 紧缚 | 额外进攻投掷前 1CP 门禁，进攻掷骰阶段结束清理 | `flowHooks.ts`/状态消费 | 机制测试；真实入口截图 64-66 证明 Guest 在额外投掷里先支付 `1CP` 再重投，并在离开 `offensiveRoll` 后清掉自己身上的 `bind`；当前剩余已收敛为与相关攻击/防御共享时序链的更高层 `L4` 判等，而不是状态对象缺首条直证 | L2 / 对象级 L3 | passed |
| 军刀突刺 | 3/4/5 军刀造成 4/5/6 | `abilities.ts` 共享 diceSet/damage | 真实入口截图 82-84 已证明 `fist` 槽位在 3 军刀盘面下会解析为 `sabre-thrust-3`，点击后需由 Host 继续推进到 Guest `still-wet-behind-ears` 防御阶段；把 Guest 防御骰固定成全战利品面后，服务器断言 `Host HP=50 / Guest HP=46`，说明基础 `3 军刀 -> 4 伤害` 主链已在真实 UI 中闭环；其余 `4/5` 军刀当前只剩同一消费者上的参数值与参数链 `L4` 判等 | L2 / 对象级 L3 | passed |
| 军刀突刺 II | 伤害提升；三同值施加紧缚 | `SABRE_THRUST_2`、custom action | 真实入口截图 100-102 已证明升级场景下 `fist` 槽位会解析为 `sabre-thrust-2-3`，点击后需由 Host 推进到 Guest `still-wet-behind-ears` 防御阶段；把 Guest 防御骰固定成全战利品面后，服务器断言 `Host HP=50 / Guest HP=45 / Guest bind=1`，说明升级后的 `5` 点伤害与“三同值施加紧缚”已经在真实 UI 中闭环；当前剩余只回到 `4/5` 军刀参数链与升级家族 `L4` 判等 | L2 / 对象级 L3 | passed |
| 地毯式轰炸 | 获得战术优势；两名不同对手受附属伤害 | `zhanshujia-carpet-bombing-targets` | 机制测试；真实入口截图 80-81 证明 4 人链会先进入 `targetingRoll`，完成目标骰确认后再进入双敌 `selectPlayer` 覆盖层，且只列敌队 `P1 / P3`、结算后 `player0Hp=46 / player2Hp=46 / player3Hp=50`；当前剩余已收敛为与升级版/双敌共享链的 `L4` 判等，而不是基础对象仍缺真实入口 | L2 / 对象级 L3 | passed |
| 地毯式轰炸 II | 主分支 + 旗帜 4 分支 | `CARPET_BOMBING_2` | 4 人真实入口截图 80-81 已证明主分支会先经过 `targetingRoll` 与双敌 `selectPlayer` 覆盖层；真实入口截图 103-104 已证明升级场景下 `chi` 槽位会解析为 `carpet-bombing-2-strategy`，点击后不会创建 `pendingAttack`，而是直接完成 `Host 战术优势=3` 与 `抽 2 张牌`，且 `战略防御！ / 占得上风！` 会真实进入手牌区；当前剩余已收敛为“其它升级分支能否与基础版/已证分支合法复用”的 `L4` 登记 | L2 / 对象级 L3 | passed |
| 战争贩子 | 奖励骰三分支；只有勋章分支立即进入额外进攻投掷阶段 | `zhanshujia-war-monger-roll` + `zhanshujia-war-monger-attack-damage` | 2026-07-23 回图确认旧“全分支额外进攻”证据失效。当前机制测试锁定：军刀分支只写入 5 点攻击伤害，先进入防御投掷并允许防伤/减伤结算；旗帜分支只获得战术优势；勋章分支抽 1 张牌、把本次攻击改为不可防御的 0 伤害并触发 `EXTRA_ATTACK_TRIGGERED`，不会打开防御投掷 | L2 | passed |
| 战争贩子 II | 勋章抽牌并触发额外进攻投掷阶段 | `zhanshujia-war-monger-2-roll` + `extraAttackInProgress.phaseEntered` | 2026-07-23 修订：勋章分支不应进入防御投掷。当前机制测试证明奖励骰为勋章时生成 `CARD_DRAWN`、`PENDING_ATTACK_UPDATED({ damage: 0, isDefendable: false })` 与 `EXTRA_ATTACK_TRIGGERED`；旧“Guest 防御收口后 Host 进入额外进攻”的截图说明只能作为历史截图名保留，不再作为规则时序证据 | L2 | passed |
| 摇鼓运动 | 施加紧缚并造成 7 | `abilities.ts` | 真实入口截图 165-167 已证明 `lotus` 槽位在 `3 军刀 + 2 勋章` 盘面下会解析为 `drum-movement`，点击后自然推进到 Guest `human-still-wet-behind-ears` 防御阶段；在全战利品防御骰下，服务器断言 `Host 战术优势=0 / Guest bind=1 / Guest HP=43`，说明基础版 `bind + 7 damage` 已在真实 UI 中闭环 | L2 / 对象级 L3 | passed |
| 摇鼓运动 II | 主分支获得战术优势+紧缚+伤害；间接分支战术优势+不可防御伤害 | `DRUM_MOVEMENT_2` | 真实入口截图 88-90 已证明 `lotus` 槽位在 `3 军刀 + 2 勋章` 盘面下会直接解析为 `drum-movement-2-main`，点击后需由 Host 推进到 Guest `still-wet-behind-ears` 防御阶段；把 Guest 防御骰固定成全战利品面后，服务器断言 `Host 战术优势=1 / Guest bind=1 / Guest HP=43`，说明主分支 `grantToken + bind + 7 damage` 已在真实 UI 中闭环。2026-06-06 新增截图 `210-212` 又证明在另一组盘面下，同一 `lotus` 槽位会直接解析为 `drum-movement-2-indirect`，并真实收口到 `Host 战术优势=2 / Guest HP=48 / Guest bind=0`。当前剩余已收敛为与基础版/主分支的变体 family `L4` 判等 | L2 / 对象级 L3 | passed |
| 包夹侧翼 | 小顺获得战术优势并造成 6 | `FLANKING` | 真实入口截图 171-173 已证明 `combo` 槽位在小顺子盘面下会解析为 `flanking`，点击后自然推进到 Guest `human-still-wet-behind-ears` 防御阶段；在全战利品防御骰下，服务器断言 `Host 战术优势=1 / Guest HP=44`，说明基础版 `grantToken + 6 damage` 已在真实 UI 中闭环 | L2 / 对象级 L3 | passed |
| 包夹侧翼 II | 战术优势数值提升 | `FLANKING_2` | 升级映射测试已锁定 `replaceAbility('flanking', FLANKING_2, 2)`；真实入口截图 `181-183` 已证明升级场景下 `combo` 槽位可真实点击并建立攻击链、Guest 自然进入 `human-still-wet-behind-ears` 防御阶段，并在全战利品防御骰下收口到 `Host 战术优势 2 / Guest HP 44`；当前剩余只回到与基础 `包夹侧翼` 的参数链 `L4` 判等 | L2 / 对象级 L3 | passed |
| 开拓战场 | 大顺获得战术优势、紧缚、9 伤害 | `EXPAND_BATTLEFIELD` | 真实入口截图 168-170 已证明 `lightning` 槽位在大顺子盘面下会解析为 `expand-battlefield`，点击后自然推进到 Guest `human-still-wet-behind-ears` 防御阶段；在全战利品防御骰下，服务器断言 `Host 战术优势=2 / Guest bind=1 / Guest HP=41`，说明基础版 `grantToken + grantStatus + 9 damage` 已在真实 UI 中闭环 | L2 / 对象级 L3 | passed |
| 开拓战场 II | 大顺升级；锁定分支抽牌+紧缚 | `EXPAND_BATTLEFIELD_2` | 真实入口截图 91-94 已证明 `lightning` 槽位在 `[2,3,4,5,6]` 盘面下会先解析为 `expand-battlefield-2-large-straight`，且因同时满足 `largeStraight` 与 `lockdown` 会先弹变体选择 modal；Host 显式选择 `开拓战场 II（大顺子）` 后推进到 Guest `still-wet-behind-ears` 防御阶段，并在全战利品防御骰下收口到 `Host 战术优势=3 / Guest bind=1 / Guest HP=41`。2026-06-06 新增截图 `213-215` 又证明在另一组盘面下，同一 `lightning` 槽位会直接解析为 `expand-battlefield-2-lockdown`，并真实收口到 `Host 手牌=2 / Guest bind=1 / Guest HP=50`。当前剩余已收敛为与大顺主分支的变体 family `L4` 判等 | L2 / 对象级 L3 | passed |
| 战略转移 | 勋章 4 获得 5 战术优势并造成不可防御伤害 | `STRATEGIC_SHIFT` | 真实入口截图 163-164 已证明 `calm` 槽位在 4 勋章盘面下会解析为 `strategic-shift`，点击后创建真实攻击链并收口到 `Host 战术优势=5 / Guest HP=45 / Guest bind=0`；当前不再只是借 `grantToken(TACTICAL_ADVANTAGE)` 与 `damage(unblockable)` 的跨对象共享链外推 | L2 / 对象级 L3 | passed |
| 战略转移 II | 主分支额外紧缚；勋章 3 侦察分支 | `STRATEGIC_SHIFT_2` | 升级映射测试；真实入口截图 85-87 已证明 `calm` 槽位在 `4 勋章 + 3 勋章` 同时满足时会先弹变体选择 modal，Host 显式选择 `4 个勋章` 主分支后，收口到 `Host 战术优势=5 / Guest bind=1 / Guest HP=45`。2026-06-06 新增截图 `207-209` 又证明同一 `calm` 槽位命中 `strategic-shift-2-recon` 后，会先进入变体选择，再真实收口到 `Host 战术优势=5 / Guest bind=0 / Guest HP=50`。当前剩余已收敛为与主分支的变体 family `L4` 判等 | L2 / 对象级 L3 | passed |
| 反制措施 | 防御骰 4，军刀/旗帜/勋章分支 | `zhanshujia-countermeasures-defense` | 机制测试；真实防御阶段入口截图与服务器状态断言已锁定同一 defensive slot 下的对象级防御入口与主收口；当前剩余已收敛为与 II/III 的共享 defensive chain `L4` 判等 | L2 / 对象级 L3 | passed |
| 反制措施 II/III | 防御骰 5；III 军刀组伤害提升 | `COUNTERMEASURES_2/3` | 升级映射 + 代表分支测试；真实防御阶段入口截图 `177-180` 已证明 II/III 在升级场景下都能通过同一 defensive slot 真实进入 `defensiveRoll`，并分别收口到 `攻击者 HP 49 / 战术优势 2` 与 `攻击者 HP 48 / 战术优势 2`；当前剩余只回到 shared defensive family 的参数链 `L4` 判等 | L2 / 对象级 L3 | passed |
| 制胜高地 | 锁定、紧缚、战术优势上限 +1 并补满、12 伤害 | `zhanshujia-high-ground-cap-up-and-fill` | 机制测试；真实入口截图 58-59 证明通过 `ultimate` 槽位触发后，Guest 获得锁定/紧缚，Host 的战术优势上限从 5 升到 6 并补满到 6；当前剩余已收敛为战术优势/状态共享参数链的更高层 `L4` 判等，而不是终极对象仍缺真实入口 | L2 / 对象级 L3 | passed |
| 占得上风 | 投 1 骰：勋章得 4 战术优势，否则抽 1 | `cards.ts` rollDie | 定向 E2E 已命中勋章分支：截图 72-73 证明 Host 从真实手牌打出后进入奖励骰覆盖层，并在关闭覆盖层后把战术优势从 0 写到 4、源卡进入弃牌堆；默认抽 1 分支仅剩共享 `drawCard` 路径差异，已由 L2 锁定，因此当前对象级剩余已提升为奖励骰 family 的 `L4` 合法复用登记，而不是对象本体仍缺真实入口 | L2 / 对象级 L3 | passed |
| 伏击 | 获得 2 战术优势 | `cards.ts` grantToken | 真实手牌截图 `184-185` 已证明 Host 可在主阶段直接看到并打出 `埋伏`，随后服务器状态真实收口到 `战术优势 2` 且源卡进入弃牌堆；当前剩余只回到与其它即时手牌 / token 写入 family 的 `L4` 复用登记 | L2 / 对象级 L3 | passed |
| 脱战 | 被攻击后投骰三分支 | `card-zhanshujia-disengage` | 机制测试；真实入口截图 69-71 证明 Guest 通过 `soul-stab-3` 真实攻击链打开防御窗口后，Host 能从真实手牌打出 `脱战` 并进入奖励骰覆盖层；本次通过 run 命中军刀分支，收口到 Guest HP `50 -> 48`，且源卡进入弃牌堆。当前剩余已收敛为其它分支与防御奖励骰 family 的 `L4` 复用登记，而不是对象本体仍停留在 representative | L2 / 对象级 L3 | passed |
| 伴装撤退 | 攻击者紧缚，自己防止 3 | `card-zhanshujia-tactical-retreat` | 机制测试；真实入口截图 67-68 证明 Guest 通过 `soul-stab-3` 真实攻击链打开防御窗口后，Host 能从真实手牌打出 `伴装撤退`，并收口到 Guest 获得 `bind 1`、Host 获得 `3` 点护盾、源卡进入弃牌堆；当前剩余已收敛为与 `紧缚` 状态/防御响应家族的 `L4` 复用登记，而不是对象本体缺真实防御链 | L2 / 对象级 L3 | passed |
| 作战室 | 按骰值一半向上取整获得战术优势 | `zhanshujia-war-room-roll` | 机制测试；真实入口截图 18-19 已证明从真实手牌打出后会进入奖励骰特写，并在关闭后把战术优势写回棋盘；当前剩余已收敛为与其它奖励骰对象的更高层 `L4` 合法复用登记 | L2 / 对象级 L3 | passed |
| 战略防御 | 选择任意玩家获得守护 | `zhanshujia-strategic-defense-select-player` | 机制测试；真实入口玩家选择覆盖层与守护落点截图 | L2/L3 | passed |
| 9 张升级牌 | 替换基础技能，写入等级与升级卡映射 | `replaceAbility` | `cards.ts` 里 9 张升级牌全部是 `type: 'upgrade'` + `effects: [replaceAbility(...)]`；intake test 已锁 `id/sourceAtlasIndex/previewRef`；mechanics test 已锁 `targetAbilityId/newAbilityLevel/upgradeCardByAbilityId/abilityLevels`；真实入口截图 `76-77`、`186-201` 已证明 9 张升级牌都能从真实手牌以 `PLAY_UPGRADE_CARD` 打出，并把对应 `abilityLevels / upgradeCardByAbilityId / CP / hand` 状态写到升级槽位 | L2 / 对象级 L3 | passed |
| 通用牌索引 | `card-unexpected` 使用 slot 32 | `ZHANSHUJIA_COMMON_ATLAS_INDEX` | intake test；开局真实双玩家 E2E 已显式注入并等待 Host 侧 `card-unexpected` 卡图加载完成，截图 `05-host-zhanshujia-hand-card-atlas` 现在同时覆盖战术家专属牌与 common 卡图运行时落点 | L1 / atlas runtime L3 | passed |

## 咒缚海盗对象矩阵

| 对象 | 子句/语义 | 实现入口 | 当前证据 | 层级 | 结论 |
| --- | --- | --- | --- | --- | --- |
| 英雄注册 | 可被选角入口识别，保留实施中徽标 | `domain/characters.ts`、`heroes/index.ts` | intake test | L1 | passed |
| 资源链 | 使用素材目录 `cursed`，本地压缩资源与 manifest 存在 | `criticalImageResolver.ts`、manifest | intake/resource test；`assets:upload`；远端 HEAD 200；E2E 截图 | L1/L3 | passed |
| human 面能力集（9 个对象） | 开局为 human 面，自带 3 个诅咒金币，并按 `playerBoardFace` 切换到 `弯刀突刺 / 做好标记 / 咒缚 / 走跳板 / 点燃炸药 / 判决指令 / 惊魂动魄 / 嘿，老兄 / 无情劫掠` | `getCursedPirateAbilitiesForFace`、`characters.ts`、`reducer.ts`、`customActions/cursed_pirate.ts` | intake test 已锁真实开局 `normal + 3`；mechanics test 已覆盖 9 个对象，且 9 个对象都已补独立真实入口 direct E2E；当前 human 面不再缺对象级 L3 首条直证，剩余项回到更高层 L4 与双面 completion audit | L2 passed / L3 object-complete / L4 pending | in_progress |
| 弯刀突刺 | 3/4/5 弯刀造成 5/6/7；4 同值时施加火药桶；human 面 `fist` 槽位入口 | `cutlass-stab`、`cutlass-stab-4` | 机制测试已锁 `cutlass-stab-4` 的 4 同值施加火药桶；真实入口 direct E2E 已证明 Guest 在 human 面 `fist` 槽位触发后会解析到 `cutlass-stab-4`，并在 Host 的真实 `countermeasures` 防御链后收口到 `Host HP 50 -> 48 / Host powderKeg 1`；截图 `124-126` | L2/L3 | passed |
| 做好标记 | 获得 1CP；3 颗奖励骰按弯刀/战利品/骷髅结算；human 面 `chi` 槽位入口 | `make-your-mark` | 机制测试已锁 `+1CP`、`2 点不可防御伤害 / 抽 1 / 诅咒金币选择`；真实入口 direct E2E 已证明 Guest 在 human 面 `chi` 槽位触发后，会进入奖励骰结算，并按实际弯刀/战利品/骷髅结果收口到 `Guest CP 6 / Guest 手牌数=战利品数 / Guest 诅咒金币=骷髅数 / Host HP=50-2*弯刀数`；截图 `127-130` | L2/L3 | passed |
| 走跳板 | 二选一：偷取 1CP，或令对手自选弃 1 张牌，然后造成 7 点伤害；human 面 `lotus` 槽位入口 | `walk-the-plank` | 机制测试已锁二选一与弃牌交互；真实入口 direct E2E 已证明 Guest 在 human 面 `lotus` 槽位触发后，会先进入“走跳板：选择结算方式”弹窗，选择弃牌分支后自然打开 Host 手牌选择弹窗并完成弃牌收口；截图 `121-123` | L2/L3 | passed |
| 点燃炸药 | 小顺/大顺：施加火药桶并造成 7/9；human 面 `combo` 槽位入口 | `light-the-fuse`、`light-the-fuse-small` | 机制测试已锁 `preDefense` 时序；真实入口 direct E2E 已证明 Guest 在 human 面 `combo` 槽位会看到 `data-base-ability-id="light-the-fuse"` 与 `data-resolved-ability-id="light-the-fuse-small"`，点击后自然打开防御链，收口到 Host `HP 50 -> 43` 且获得 `火药桶 1`；截图 `107-109` | L2/L3 | passed |
| 判决指令 | 获得 1 个诅咒金币，施加休战，造成 7 点不可防御伤害；human 面 `lightning` 槽位入口 | `verdict-command` | 机制测试已锁 choice continuation 与真实时序；真实入口 direct E2E 已证明 Guest 在 human 面 `lightning` 槽位触发后，会进入诅咒金币选择窗，选择后继续收口到 `Guest 诅咒金币 +1 / Host 休战 1 / Host HP 50 -> 43`；截图 `105-106` | L2/L3 | passed |
| 惊魂动魄 | 7 点不可防御伤害；可移除任意数量诅咒金币；human 面 `calm` 槽位入口 | `astonishing` | 机制测试已锁 choice 后攻击链收口；真实入口 direct E2E 已证明 Guest 在 human 面 `calm` 槽位触发后，会进入移除诅咒金币选择窗，并在选择“移除 2 个诅咒金币”后收口到 `Host HP 50 -> 43 / Guest cursedCoin 3 -> 1`；截图 `113-115` | L2/L3 | passed |
| human-cursed | 回合结束移除 1 个诅咒金币；若无可移除金币则翻回咒缚面；human 面 `sky` 被动槽位 | `cursed-pirate-human-cursed-end-turn` | 机制测试已锁“有币移 1 层、无币翻面”；真实入口 direct E2E 已分别证明：有 3 个诅咒金币时回合结束后收口到 `Guest cursedCoin 3 -> 2 / 仍为 human 面`，无诅咒金币时回合结束后收口到 `playerBoardFace='cursed' / abilities 切回 soul-stab`；截图 `117-120` | L2/L3 | passed |
| 嘿，老兄 | 防御掷 4：弯刀反击、战利品得 CP、骷髅防伤；若 2 弯刀 + 1 骷髅则获得 1 个诅咒金币；human 面防御槽位入口 | `human-still-wet-behind-ears` | 机制测试已锁反击、CP、防伤与诅咒金币选择；真实入口 direct E2E 已证明这条防御链会由 Host 的真实 `sabre-thrust-3` 攻击流自然打开，并在防御收口后达到 `Host HP 48 / Guest HP 48 / Guest CP 6 / Guest cursedCoin 1`；截图 `131-134` | L2/L3 | passed |
| 无情劫掠 | 12 伤害；获得 2 个诅咒金币；施加休战和火药桶；human 面 `ultimate` 槽位入口 | `merciless-plunder` | 机制测试已锁伤害与 continuation 收口；真实入口 direct E2E 已证明 human 面 `ultimate` 槽位点击后会进入诅咒金币选择并在选择后继续收口；截图 `110-112` | L2/L3 | passed |
| 诅咒金币 | 自身上限 5/他人 3；维持伤害；不可移动/移除；海盗可拒绝获得 | `tokens.ts`、`statusEvents.ts` | 机制测试；真实入口截图 54-55 证明从 Guest `discard` 推到 Host `upkeep` 后，Host 在保留 3 层诅咒金币的同时从 50 HP 降到 47 HP；当前剩余已收敛为“所有写入者是否都可合法复用同一生命周期 family”的 `L4` 登记，而不是状态对象缺直证 | L2 / 状态对象级 L3 | passed |
| 火药桶 | 维持投骰 1-2 爆炸、3-5 无事、6 转交；重复获得爆炸 | `statusEvents.ts`、choice handler | 机制测试；真实入口截图 56-57 证明从 Guest `discard` 推到 Host `upkeep` 后，Host 从 50 HP 降到 47 HP 且火药桶被移除；当前剩余已收敛为跨入口转交/重复获得/收口时序的 family 级 `L4`，而不是状态对象缺真实生命周期链 | L2 / 状态对象级 L3 | passed |
| 凋零 | 持有者造成攻击伤害 -1/层 | `tokens.ts`、伤害修正管线 | 机制测试；深海潜行真实入口截图 24-26 已证明前置事件会真实施加凋零且不打断后续弃牌交互，`啜呼` 截图 39-41 覆盖奖励骰分支命中后施加凋零，`坏血病` 截图 153-154 进一步锁定单目标手牌入口的真实写入，截图 `204-206` 已证明咒缚海盗持有 `凋零 1` 时，真实 `灵魂突刺` 攻击链会把 `Host HP 50 -> 46` 而不是 `45`，截图 `216-218` 又进一步证明真实 `死亡吐息` 攻击链会把 `Host HP 50 -> 44` 而不是 `43`；当前剩余已收敛为跨入口/跨消费者的 family 级 `L4` 复用登记，而不再是“来源侧只有静态合同” | L2 / 状态对象级 L3+消费链 | passed |
| 休战 | 阻止攻击伤害，不阻止直接伤害，阶段结束清理 | `tokens.ts`、伤害/flowHooks | 机制测试已锁定“阻止攻击伤害、不阻止直接伤害、`offensiveRoll -> main2` 清理”；`无情诅咒` 截图 42-45、起锚截图 74-75、手牌 `休战` 截图 157-158 已证明 `grantStatus(PARLEY)` 可在真实入口写入目标，开局截图 04 也已覆盖状态图标展示合同；截图 `174-176` 已证明攻击者持有 `休战` 时，真实 `cutlass-stab-4` 攻击链会正常进入防御阶段、最终令双方 HP 保持 `50/50` 并清除 `休战`，截图 `219-221` 又进一步证明同一结论也适用于 `死亡吐息`，且不会误吞 `凋零 / 火药桶` 的状态写入 | L2 / 状态对象级 L3+消费链 | passed |
| 灵魂突刺 | 3/4/5 弯刀伤害；三同值施加火药桶 | `cursed-pirate-powder-keg-if-three-kind` | 机制测试已锁定 `soul-stab-3` 在三同值时会于 `postDamage` 施加火药桶；独立真实入口截图 `135-137` 已证明 Guest 会通过咒缚面 `fist` 槽位真实解析出的 `soul-stab-3` 建立攻击链，并在 Host 真实防御链后收口到 `Host HP 50 -> 45 / Host powderKeg 1` | L2/L3 | passed |
| 死亡印记 | 先得 2CP；奖励骰弯刀/战利品/骷髅分支 | `gain-cp`、rollDie | 机制测试；真实入口截图 33-34 证明奖励骰覆盖层可见，关闭后能按实际弯刀/战利品/骷髅结果收口；并已补 `rollDie` 多骰逐颗累计修复 | L2/L3 | passed |
| 咒缚 | 自己维持自伤 4；对手进攻投掷阶段未发起攻击则火药桶 | `cursed-pirate-cursed-upkeep-self-damage`、`flowHooks.ts` | 机制测试；真实入口截图与定点 E2E 已分别覆盖“战术家 discard -> 咒缚海盗 upkeep 自伤 4”以及“对手在其进攻投掷阶段未发起攻击时施加火药桶”两条对象链 | L2/L3 | passed |
| 深海潜行 | 偷 1CP；对手自选弃 1；凋零；8 伤害 | `cursed-pirate-steal-one-cp`、`selectHandCard` | 机制测试；真实攻击入口截图 24-26 证明通过面板槽位触发后，偷 CP、施加凋零、对手自选弃牌与弃牌落点整链成立 | L2/L3 | passed |
| 死亡吐息 | 小顺/大顺施加凋零、火药桶并伤害 | `BREATH_OF_DEATH` | 机制测试已锁定 `smallStraight / largeStraight` 分支的 `grantStatus(WITHER/POWDER_KEG) + damage(7/10)`；独立真实入口截图 `140-142` 已证明 Guest 会通过咒缚面 `combo` 槽位真实解析出的 `breath-of-death-small` 建立攻击链，并在 Host 真实防御链后收口到 `Host HP 50 -> 43 / Host powderKeg 1 / Host wither 1`。本次旧红根因已锁定为测试夹具把“小顺子”误塞成 `[1,2,3,5,6]` 非顺子盘面，而不是业务链未实现 | L2/L3 | passed |
| 灵魂指令 | 休战、火药桶、凋零、8 不可防御伤害 | `SOUL_COMMAND` | 机制测试已锁定 `grantStatus(PARLEY/POWDER_KEG/WITHER) + damage(unblockable)` 组合；独立真实入口截图 `138-139` 已证明 Guest 会通过咒缚面 `lightning` 槽位真实触发 `soul-command`，并在收口后令 Host 获得 `休战 1 / 火药桶 1 / 凋零 1`，同时 `Host HP 50 -> 42` | L2/L3 | passed |
| 亡灵之爪 | 8 不可防御；按所有对手诅咒金币层数造成伤害 | `cursed-pirate-damage-by-cursed-coins` | 机制测试；真实入口截图 52-53 证明通过 `calm` 槽位触发后，Host 在保留 3 层诅咒金币的同时从 50 HP 降到 39 HP | L2/L3 | passed |
| 你还嫩了点 | 防御骰弯刀/战利品/骷髅/组合金币 | `cursed-pirate-still-wet-behind-ears-defense` | 机制测试已锁反击、CP、防伤与“2 弯刀 + 1 骷髅得 1 个诅咒金币”；真实防御阶段入口截图 `22-23` 已证明这条咒缚面防御链会由 Host 的真实 `sabre-thrust-3` 攻击流自然打开，并在防御收口后达到 `Host HP 49 / Guest HP 50 / Guest CP 6 / Host cursedCoin 1` | L2/L3 | passed |
| 无情诅咒 | 13 伤害；休战/诅咒金币/凋零；至多两名对手火药桶 | `cursed-pirate-merciless-curse-powder-keg-targets` | 机制测试；真实入口截图 42-45 已证明 4 人 `targetingRoll` 目标选择归属、`preDefense` 火药桶 modal 与 `施加给 P2, P4` 后的双敌方落桶状态链；截图 `161-162` 已进一步证明在同样存在合法敌方目标时选择“不施加火药桶”会直接收口，且 `P2/P4` 都不会新增火药桶 | L2/L3 | passed |
| 起锚 | 投 1 骰，骷髅休战，否则抽 1 | `cards.ts` rollDie | 定向 E2E 已分别命中骷髅分支与默认抽牌分支：截图 `74-75` 证明 Guest 从真实手牌打出后进入奖励骰覆盖层，并在关闭覆盖层后给 Host 真实写入 `休战 1`；截图 `143-144` 证明非骷髅时 Guest 会从真实牌库抽到 `送你们去喂鱼` 且不写入 `休战`，两条分支都完成源卡弃牌收口 | L2/L3 | passed |
| 诅咒卡牌 | 三选一：抽 1 / 受 2 抽 2 / 受 4 抽 3 | `cursed-pirate-curse-card-choice` | 机制测试；真实入口截图 `46-47` 已证明“受 4 伤害抽 3”分支，截图 `145-146` 已证明“抽 1 张牌”分支，截图 `147-148` 已证明“受 2 伤害抽 2”分支；三条分支都能从真实手牌入口打开选择窗，并完成 HP / 手牌 / 弃牌落点收口 | L2/L3 | passed |
| 封舱 | 弃剩余手牌后抽 4 | `cursed-pirate-batten-down` | 机制测试；真实入口截图 48-49 证明打牌前手牌可见，打牌后其余手牌进入弃牌堆并重抽 4 张新手牌；当前剩余已收敛为与其它手牌即时链的合法复用登记，而不是对象本体仍缺真实入口 | L2 / 对象级 L3 | passed |
| 诱饵 | 攻击伤害 +2 | `cards.ts` damage | 真实入口截图 97-99 已证明 Guest 会先通过真实 `soul-stab-3` 攻击入口建立攻击链，再从真实手牌打出 `诱饵`；该卡在仍处于 `offensiveRoll` 时直接把 `Host HP 50 -> 48`，并同步完成 `CP 5 -> 4` 与源卡弃牌收口，不走 `pendingAttack.bonusDamage / attackModifierBonusDamage` 写入；当前剩余已收敛为与其它攻击修正牌的更高层 seam 判等，而不是对象本体仍缺 L3 | L2 / 对象级 L3 | passed |
| 抽筋剥皮 | 投 5 骰；每弯刀 +1；至少 +3 施加火药桶 | `cursed-pirate-flay-roll` | 机制测试；真实入口截图 31-32 证明奖励骰覆盖层可见，关闭后能按实际弯刀数收口 bonus damage，并在弯刀数 >= 3 时施加火药桶；当前剩余已收敛为与其它奖励骰/状态写入对象的 `L4` 复用登记，而不是对象本体缺真实奖励骰链 | L2 / 对象级 L3 | passed |
| 赎金 | 出牌者只能在当前投骰者是对手时，选择当前唯一投骰结果中的骰子；目标支付 2CP 或重掷 | `cursed-pirate-ransom-die-choice`、resolve choice、`checkPlayCard(requireIsNotRoller)` | 机制测试已补“投骰者自己不能打赎金”的负向断言；真实入口截图 36-38 已更新为 Host 正在投骰、Guest 打赎金选择 Host 骰、Host 支付 2CP，并收口到 CP 转移与弃牌落点。旧 2026-06-01 截图只证明跨玩家付款收口，未证明排除自己骰，已降级为历史证据 | L2 / 对象级 L3 | passed |
| 虚张声势 | 投 1 骰三分支 | `cards.ts` rollDie | 真实入口截图 95-96 已证明 Guest 从真实手牌打出后会进入 `bonus-die-overlay`，命中弯刀面时收口到 `Host HP 50 -> 48` 且源卡进入弃牌堆；截图 149-150 已证明战利品面会让 Guest 抽到 2 张真实牌库卡且 Host HP 保持 `50`；截图 151-152 已进一步证明骷髅面会对 Host 写入 `火药桶 1` 且不造成额外抽牌/伤害。最新机制回归也已显式锁定三分支各自只落到 `damage / draw / powder_keg`，不会串写到其它 downstream consumer。当前三条分支都已拿到真实入口奖励骰覆盖层、机制层与最终收口证据 | L2/L3 | passed |
| 坏血病 | 自伤 1；对手凋零 | `cards.ts` damage/grantStatus | 真实入口截图 `153-154` 已证明 Guest 从真实手牌打出 `坏血病！` 后，自己 HP `50 -> 49`、Host 获得 `凋零 1`，且源卡进入弃牌堆 | L2/L3 | passed |
| 劫掠 | 偷 1CP | `cursed-pirate-steal-one-cp` | 真实入口截图 `155-156` 已证明 Guest 从真实手牌打出 `强取豪夺！` 后，完成 `Guest CP 5 -> 6 / Host CP 5 -> 4` 的偷取链，且源卡进入弃牌堆 | L2/L3 | passed |
| 休战 | 对一名对手施加休战 | `cards.ts` grantStatus | 真实入口截图 `157-158` 已证明 Guest 从真实手牌打出 `停战协议！` 后，Host 获得 `休战 1`，且源卡进入弃牌堆 | L2/L3 | passed |
| 瞭望台 | 弯刀查看手牌；战利品目标自选弃 1；骷髅随机弃 1 | `cursed-pirate-crows-nest-roll` | 机制测试；真实入口弯刀查看手牌截图与手牌不变断言；战利品目标自选弃牌截图；骷髅随机弃牌截图 | L2/L3 | passed for three branches |
| 干票大的 | 投 2 骰；有战利品则抽 2 并获得 2CP | `cursed-pirate-hefty-roll` | 机制测试；真实入口截图 27-28 证明双骰覆盖层展示后，关闭覆盖层可正确回写抽 2、回 2CP 与弃牌落点 | L2/L3 | passed |
| 海盗的一生 | C1 普通面获得 1 诅咒金币 | `cursed-pirate-pirates-life` + `playerBoardFace='normal'` | 机制测试已锁普通面获得 1 个诅咒金币；真实入口截图 `212-214` 已证明 Guest 在 `human/normal` 面真实手牌区打出 `海盗的一生！` 后，会先进入“是否获得诅咒金币？”选择窗，再在接受后收口到 `诅咒金币 1 -> 2` 且源卡进入弃牌堆。当前剩余已不再是“普通面只到机制层”，而是双面 hand-card family 的更高层 completion audit | L2/L3 | passed |
| 海盗的一生 | C2 咒缚面改为治疗 3 | `playerBoardFace='cursed'` 分支合同；真实开局已改为 `normal + 3 个诅咒金币` | 机制测试已锁咒缚面治疗 3；真实入口截图 `210-211` 已证明 Guest 在咒缚面真实手牌区打出 `海盗的一生！` 后不会进入诅咒金币选择窗，而是直接收口到 `HP 45 -> 48`、`诅咒金币保持 1` 且源卡进入弃牌堆。当前剩余已收窄为双面 completion audit，而不是对象本体缺分支实现 | L2/L3 | passed |
| 送你们去喂鱼 | 可跳过的至多三名不同对手火药桶 | `cursed-pirate-go-fish-powder-keg-targets` | 机制测试；真实入口截图 `09-10` 已证明会弹出“至多三名对手获得火药桶”选择窗并对 `P1` 正向施加火药桶；截图 `159-160` 已进一步证明在同样存在合法目标时选择“不施加火药桶”会直接收口，且 Host / Guest 都不会新增火药桶 | L2/L3 | passed |
| 分点给我 | 对一名对手施加火药桶 | `cards.ts` grantStatus | 火药桶共享 helper 覆盖；真实入口截图 50-51 证明打牌前手牌可见，打牌后对手获得 1 层火药桶且源卡进入弃牌堆；当前剩余已收敛为火药桶状态家族的更高层 `L4` 复用登记，而不是对象本体缺真实施加链 | L2 / 对象级 L3 | passed |
| 啜呼 | 目标选择接受火药桶或投骰；3-6 火药桶+凋零 | `cursed-pirate-sip-choice` | 机制测试；真实入口截图 39-41 证明 Host 真实接管目标选择，并在改投骰后进入奖励骰覆盖层，再按实际点数收口到状态结果；当前剩余已收敛为与奖励骰/状态写入双重家族的 `L4` 合法复用登记，而不是对象本体缺真实入口 | L2 / 对象级 L3 | passed |
| 通用牌索引 | `card-unexpected` 使用 slot 33 | `CURSED_PIRATE_COMMON_ATLAS_INDEX` | intake test；开局真实双玩家 E2E 已显式注入并等待 Guest 侧 `card-unexpected` 卡图加载完成，截图 `06-guest-cursed-pirate-hand-card-atlas` 现在同时覆盖咒缚海盗专属牌与 common 卡图运行时落点 | L1 / atlas runtime L3 | passed |

### 双面面板对象级 completion 表（2026-06-06）

| 面 | 对象级 L3 直证覆盖 | 当前证据 | 当前剩余 |
| --- | --- | --- | --- |
| human 面 | `9 / 9` | `弯刀突刺 / 做好标记 / human-cursed / 走跳板 / 点燃炸药 / 判决指令 / 惊魂动魄 / 嘿，老兄 / 无情劫掠` 已分别由截图 `105-134` 锁定真实槽位入口、交互链与收口 | 不再缺对象级 L3 首条直证；剩余回到更高层 L4、双面合法复用登记与最终 completion audit |
| 咒缚面 | `9 / 9` | `灵魂突刺 / 死亡印记 / 咒缚 / 深海潜行 / 死亡吐息 / 灵魂指令 / 亡灵之爪 / 你还嫩了点 / 无情诅咒` 已分别由截图 `22-23 / 24-26 / 33-45 / 52-53 / 76-79 / 135-142 / 161-162` 锁定真实槽位入口或真实阶段入口与收口 | 不再缺面板对象级 L3 首条直证；剩余回到状态家族、奖励骰 family 与双面 completion audit 的更高层 L4 收口 |

### 2026-06-06 咒缚海盗双面 face-by-face completion 边界

| 维度 | 当前已锁定事实 | 当前权威证据 | 当前仍未收口的边界 |
| --- | --- | --- | --- |
| 开局面与初始状态 | 真实开局是 `human/normal` 面朝上，并自带 `诅咒金币 3`，不是旧口径里的 `cursed` 面开局 | `characters.ts` 的 `initialPlayerBoardFace / initialStatusEffects`，`zhanshujia-cursed-pirate-intake.test.ts` 的初始化断言，主文结论段与开局 E2E | 已不再缺“哪一面先出场”的事实核定；剩余只在双面总审计如何把这条与后续翻面/状态生命周期统一登记 |
| 双面能力集切换 | `getCursedPirateAbilitiesForFace(...)` 已把 `normal -> HUMAN_ABILITIES`、其他 -> `CURSED_ABILITIES` 写死；`human-cursed` 已证明“有币留 human / 无币翻回 cursed” | `abilities.ts` 的 `getCursedPirateAbilitiesForFace`，mechanics `human-cursed` 两条，E2E `117-120` | 已不再缺“翻面是否真实切能力集”；剩余是把这条与双面总审计里的合法复用边界一起收口 |
| 双面专属语义对象 | `海盗的一生` 现在已明确是双面差异对象：normal 面保留“获得 1 个诅咒金币”选择链，cursed 面改为直接治疗 `3` | `cards.ts` 的 `cursed-pirate-pirates-life`，mechanics 两条分支测试，E2E `210-214` | 已不再缺双面专属对象的对象级证据；剩余只在双面差异对象如何纳入最终 completion audit |
| 面板对象全集 | `human 9 / 9` 与 `cursed 9 / 9` 面板对象都已有对象级 `L3` 直证 | 上方双面面板对象级 completion 表，`intake.e2e.ts` 各对象截图链 | 已不再缺“哪面还有面板对象没直证”；剩余是更高层 family/L4 与双面总审计 |
| 专属手牌全集 | `cards.ts` 下 16 张专属手牌都已在 `mechanics / direct E2E / evidence` 三处命中；不再存在“某张专属手牌还没首条真实入口” | 下方“咒缚海盗专属手牌 completion 边界”表，`cards.ts`、mechanics、`intake.e2e.ts` | 已不再缺对象级手牌证据；剩余只在这些手牌关联到的状态 family、奖励骰 family 与双面总审计 |
| 双面面板资源与关键预热 | `ASSETS.PLAYER_BOARD('cursed_pirate', 'normal')` 已指向 `human-player-board`；`criticalImageResolver` 也把 `human-player-board` 列入 `cursed_pirate` 的额外关键资源 | `ui/assets.ts`、`criticalImageResolver.ts`、`zhanshujia-cursed-pirate-intake.test.ts` 对 `human-player-board.png/.webp` 的断言 | 已不再缺“human 面只是文档合同、并未进入运行时资源链”的 blocker；剩余只在双面资源链与对象级审计如何统一归档 |
| 通用牌索引 | 咒缚海盗共享牌堆与 common atlas slot `33` 已有静态与真实 UI 证据，不再是双面总审计里的不确定项 | `CURSED_PIRATE_COMMON_ATLAS_INDEX`、`zhanshujia-cursed-pirate-intake.test.ts`、截图 `06-guest-cursed-pirate-hand-card-atlas` | 已不再缺“通用牌索引是否接线”；剩余只在如何与双面总审计一并收口 |
| 双面总口径 | 当前可以明确：双面 remaining 不再是“哪面未接入/哪张手牌未录入/哪条首个入口未补”，而是状态家族生命周期、奖励骰 family 合法复用登记、双面差异对象的最终 completion audit | 本节 + 状态家族 L4 seam 矩阵 + 奖励骰 family completion 边界 | 这仍是当前双面总审计未完成的真实边界，不能因为 `18 / 18` 面板对象与 `16 / 16` 专属手牌都到 `L3`，就外推成双面全面审计完成 |

### 2026-06-06 咒缚海盗双面 final gate

| gate | 当前状态 | 当前可直接下结论的边界 |
| --- | --- | --- |
| 开局面 / 初始状态 | passed | `initialPlayerBoardFace='normal'` + `initialStatusEffects.cursed_coin=3` 已锁定，当前不再属于“双面是否接线”的不确定项 |
| 翻面 / 能力集切换 | passed | `human-cursed` 的“有币留 human / 无币翻回 cursed”与 `getCursedPirateAbilitiesForFace(...)` 已共同证明双面切面会真实切运行时能力集 |
| 双面面板对象 | passed | `human 9 / 9 + cursed 9 / 9` 都已有对象级 `L3`；当前双面 remaining 不再是某一面板对象没首条真实入口 |
| 双面专属手牌 | passed | `cards.ts` 下 `16 / 16` 专属手牌都已命中 `mechanics / direct E2E / evidence`，当前不再是“哪张牌还没接线” |
| 双面资源 / 通用牌索引 | passed | `human-player-board` 资源链与 common atlas slot `33` 都已锁定到正式运行时消费者 |
| 双面状态 family | implemented / contract-locked | `诅咒金币 / 火药桶 / 凋零 / 休战` 的 writer、consumer 与清理链都已落地；最新 `intake.test.ts` 也已把 `诅咒金币 seam` 与 `火药桶 writer seam` 固定到静态合同。当前真实剩余已不再是“缺少自动化合法复用 proof”，而是最终 verdict 与徽标是否允许收口 |
| 双面奖励骰 family | implemented / contract-locked | overlay 与各对象核心 downstream consumer 都已落地；最新 `intake.test.ts` 已把 `奖励骰五类 dispatch seam` 固定到静态合同。当前真实剩余已不再是 overlay 没开或 family 路由未守门，而是子 family 命名与最终 verdict 是否足以收徽标 |
| 双面最终 verdict | hold | 即使状态 family 与奖励骰 family 已前推到 `contract-locked`，当前仍保留最终 verdict 与徽标收口门禁；不能把 `18 / 18` 面板对象 + `16 / 16` 专属手牌直接外推成“双面全面审计完成” |

## 当前验证记录

| 命令 | 结果 |
| --- | --- |
| JSON parse `public/locales/{zh-CN,en}/game-dicethrone.json` | 通过 |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts -t "深海潜行"` | 通过（2026-06-01 07:57） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 1 file / 43 tests passed（2026-06-01 07:57） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts` | 1 file / 7 tests passed（2026-06-01 07:57） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 2 files / 50 tests passed（2026-06-01 07:57）；2 files / 52 tests passed（2026-06-01 11:35） |
| `npx vitest run src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx` | 1 file / 29 tests passed（2026-05-31 14:17；保留既有 missing_sfx stderr） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/ninja-slash-stand-tall-regression.test.ts --configLoader native` | 3 files / 67 tests passed（2026-06-04） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts -t "human 面判决指令拒绝获得诅咒金币|human 面无情劫掠拒绝获得诅咒金币" --configLoader native` | 1 file / 2 tests passed（2026-06-06） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts -t "火药桶维持投骰 6 转交给已持有者时，目标旧火药桶会爆炸并保留新火药桶" --configLoader native` | 1 file / 1 test passed（2026-06-06） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts --configLoader native` | 1 file / 14 tests passed（2026-06-06；累计 6 条 family 静态合同） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts --configLoader native` | 2 files / 90 tests passed（2026-06-06） |
| `npm run i18n:check` | 通过，仅保留既有 3 条 warning（2026-05-31 13:15） |
| `npx eslint src/games/dicethrone/domain/customActions/cursed_pirate.ts src/games/dicethrone/heroes/cursed_pirate/cards.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 0 errors |
| `npx tsc --noEmit --pretty false` | 通过（2026-05-31 14:07） |
| `npx tsc -p tsconfig.json --noEmit` | 通过（2026-06-04） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过咒缚面 fist 槽位触发并结算灵魂突刺的三同值火药桶链"` | 1 passed（2026-06-04；截图 `135-guest-cursed-soul-stab-entry.png`、`136-host-cursed-soul-stab-defense-entry.png`、`137-host-cursed-soul-stab-applied.png` 覆盖咒缚面 `fist` 槽位入口、真实防御窗口与三同值施加火药桶收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过咒缚面 lightning 槽位触发并结算灵魂指令的多状态不可防御链"` | 1 passed（2026-06-04；截图 `138-guest-soul-command-entry.png`、`139-host-soul-command-applied.png` 覆盖咒缚面 `lightning` 槽位入口，以及休战/火药桶/凋零 + 8 点不可防御伤害的真实收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应在攻击者带有休战时阻断攻击伤害并在阶段结束清理状态"` | 1 passed（2026-06-06；截图 `174-guest-parley-block-before-attack.png`、`175-host-parley-block-defense-entry.png`、`176-host-parley-block-cleared.png` 覆盖攻击者带 `休战` 时的真实攻击入口、防御阶段打开以及伤害归零后状态清理收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过人类面 lightning 槽位触发并结算判决指令的诅咒金币选择链"` | 1 passed（2026-06-04；截图 `105-guest-human-verdict-command-choice.png`、`106-host-human-verdict-command-applied.png` 覆盖 human 面 `lightning` 槽位入口、诅咒金币选择窗与选择后收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过人类面 combo 槽位触发并结算点燃炸药的小顺子链"` | 1 passed（2026-06-04；截图 `107-guest-human-light-the-fuse-entry.png`、`108-host-human-light-the-fuse-defense-entry.png`、`109-host-human-light-the-fuse-applied.png` 覆盖 human 面 `combo` 槽位入口、防御窗口与小顺子收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过人类面 ultimate 槽位触发并结算无情劫掠的诅咒金币续结链"` | 1 passed（2026-06-04；截图 `110-guest-human-merciless-plunder-entry.png`、`111-guest-human-merciless-plunder-choice.png`、`112-host-human-merciless-plunder-applied.png` 覆盖 human 面 `ultimate` 槽位入口、诅咒金币选择窗与选择后攻击链收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过人类面 calm 槽位触发并结算惊魂动魄的移除诅咒金币链"` | 1 passed（2026-06-04；截图 `113-guest-human-astonishing-entry.png`、`114-guest-human-astonishing-choice.png`、`115-guest-human-astonishing-applied.png` 覆盖 human 面 `calm` 槽位入口、移除诅咒金币选择窗与选择后攻击链收口） |
| `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应在 human-cursed 有诅咒金币时于回合结束移除 1 个并保持人类面"` | 1 passed（2026-06-06；截图 `117-guest-human-cursed-before-end-turn.png`、`117b-guest-human-cursed-discard-phase.png`、`118-guest-human-cursed-coin-removed.png` 覆盖 `main2 -> discard -> 下回合 main1` 三态，证明有币时仅移 1 层且保持 human 面） |
| `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应在 human-cursed 无诅咒金币时于回合结束翻回咒缚面"` | 1 passed（2026-06-06；截图 `119-guest-human-cursed-flip-before-end-turn.png`、`119b-guest-human-cursed-discard-phase.png`、`120-guest-human-cursed-flipped.png` 覆盖 `main2 -> discard -> 下回合 main1` 三态，证明无币时会翻回咒缚面并切换能力集） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过人类面 lotus 槽位触发并结算走跳板的弃牌分支"` | 1 passed（2026-06-04；截图 `121-guest-human-walk-the-plank-entry.png`、`122-guest-human-walk-the-plank-choice.png`、`123-host-human-walk-the-plank-discarded.png` 覆盖 human 面 `lotus` 槽位入口、结算方式选择窗，以及对手手牌选择弃牌收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过人类面 fist 槽位触发并结算弯刀突刺的四同值火药桶链"` | 1 passed（2026-06-04；截图 `124-guest-human-cutlass-stab-entry.png`、`125-host-human-cutlass-stab-defense-entry.png`、`126-host-human-cutlass-stab-applied.png` 覆盖 human 面 `fist` 槽位入口、真实防御窗口与 4 同值施加火药桶收口） |
| `PW_E2E_STANDARD_ENTRY=true PW_E2E_BOOTSTRAP_MODE=legacy-global-setup PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP=true PW_SERVER_RUNTIME=prebuilt PW_PREBUILT_BUNDLE_ROOT=temp/dev-bundles/e2e-single PW_SERVER_WATCH=false BG_VITE_FORCE_INLINE=1 PW_ISOLATE_PORTS=true PW_WORKERS=1 PW_HAS_EXPLICIT_TARGET=true PW_TEST_TARGET=e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts PW_E2E_TARGET=e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts node node_modules/playwright/cli.js test e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts --grep "真实入口应通过人类面 chi 槽位触发并结算做好标记的奖励骰与诅咒金币链"` | 1 passed（2026-06-04；截图 `127-guest-human-make-your-mark-entry.png`、`128-guest-human-make-your-mark-bonus-dice.png`、`129-guest-human-make-your-mark-choice.png`、`130-guest-human-make-your-mark-applied.png` 覆盖 human 面 `chi` 槽位入口、奖励骰结算、诅咒金币选择与最终收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实防御阶段入口应通过真实攻击流触发并结算人类面嘿，老兄的防御链"` | 1 passed（2026-06-04；截图 `131-host-human-still-wet-behind-ears-attack-entry.png`、`132-guest-human-still-wet-behind-ears-defense-entry.png`、`133-guest-human-still-wet-behind-ears-choice.png`、`134-guest-human-still-wet-behind-ears-applied.png` 覆盖真实攻击入口、防御窗口、诅咒金币选择与最终收口） |
| `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 0 errors（2026-05-31 13:38） |
| `npx eslint src/games/dicethrone/ui/InteractionOverlay.tsx e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 0 errors（2026-05-31 14:07） |
| `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 0 errors（2026-06-01 12:00） |
| `npx tsc --noEmit --pretty false` | 通过（2026-06-01 12:00） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算赎金的跨玩家双步选择链"` | 1 passed（2026-06-01 12:00；旧场景为 Guest 自己投骰后选骰，只证明付款收口，不能证明“对手骰子”合法性，2026-08-19 已降级为历史证据） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算赎金在对手投骰窗口的跨玩家双步选择链"` | 1 passed（2026-08-19；截图 36-38 覆盖 Host 投骰、Guest 选择 Host 骰、Host 支付 2CP、Guest/Host CP 收口和源卡弃牌） |
| `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 0 errors（2026-06-01 12:10） |
| `npx tsc --noEmit --pretty false` | 通过（2026-06-01 12:10） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算啜呼的目标选择与奖励骰分支"` | 1 passed（2026-06-01 12:10，截图 39-41 覆盖 Host 目标选择、奖励骰覆盖层与收口状态） |
| `npx eslint e2e/helpers/dicethrone.ts e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts src/games/dicethrone/domain/core-types.ts src/games/dicethrone/domain/characters.ts src/games/dicethrone/domain/customActions/cursed_pirate.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 0 errors / 2 warnings（`characters.ts` 既有 `any`，2026-05-31 13:15） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 3 passed（2026-05-31 14:12，截图 11 复核为中文“作战室！”而非 raw i18n key） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 1 file / 42 tests passed（2026-05-31 14:29） |
| `npx eslint src/games/dicethrone/domain/customActions/cursed_pirate.ts src/games/dicethrone/ui/ChoiceModal.tsx e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 0 errors（2026-05-31 14:29） |
| `npx tsc --noEmit --pretty false` | 通过（2026-05-31 14:31） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 3 passed（2026-05-31 14:36，截图 13 复核为中文“作战室！、战略防御！”而非 raw `card-*` ID） |
| `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 0 errors（2026-05-31 15:32） |
| `npx tsc --noEmit --pretty false` | 通过（2026-05-31 15:32） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 3 passed（2026-05-31 15:32，截图 15-17 覆盖瞭望台战利品/骷髅真实入口） |
| `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 0 errors（2026-05-31 15:55） |
| `npx tsc --noEmit --pretty false` | 通过（2026-05-31 15:55） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 3 passed（2026-05-31 15:55，截图 18-19 覆盖作战室奖励骰展示与战术优势落点） |
| `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 0 errors（2026-05-31 16:41） |
| `npx tsc --noEmit --pretty false` | 通过（2026-05-31 16:41） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实防御阶段入口应展示并结算反制措施与你还嫩了点"` | 2026-05-31 曾 `1 passed`（截图 20-23 覆盖两条防御响应链）；2026-06-02 中途一度转红并暴露 `ADVANCE_PHASE` 发给错误玩家，修正为 `反制措施 -> Host / playerId '0'`、`你还嫩了点 -> Guest / playerId '1'` 后，已在 `PW_SERVER_RUNTIME='prebuilt' + BG_VITE_FORCE_INLINE='1'` 且不启 `BG_VITE_FORCE_CONFIG_INLINE` 的组合下再次 `1 passed`（2026-06-02 23:32 +08） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 4 passed（2026-05-31 16:41，整文件回归） |
| `npx tsc --noEmit --pretty false` | 通过（2026-06-01 07:57） |
| `npx eslint src/games/dicethrone/domain/systems.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 0 errors / 5 warnings（`systems.ts` 既有 `any`，2026-06-01 07:57） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实进攻阶段入口应通过面板槽位选择并结算深海潜行前置链"` | 1 passed（2026-06-01 07:57，截图 24-26 覆盖深海潜行真实攻击入口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实进攻阶段入口应通过面板槽位选择并结算深海潜行前置链"` | 1 passed（2026-06-05；修正 `setupDeepSeaDiveAttackScenario(...)` 为咒缚面后复核通过，证明当前口径应为“咒缚面 lotus=深海潜行 / human 面 lotus=走跳板”） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过人类面 lotus 槽位触发并结算走跳板的弃牌分支"` | 1 passed（2026-06-05；用于确认修正深海潜行场景后 human 面 `lotus=走跳板` 未被带坏） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应在 human-cursed 无诅咒金币时于回合结束翻回咒缚面"` | 1 passed（2026-06-05；用于确认双面翻面链仍能把 human 面切回咒缚面） |
| `npx tsc --noEmit --pretty false` | 通过（2026-06-01 08:37） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算干票大的奖励骰分支"` | 1 passed（2026-06-01 08:37，截图 27-28 覆盖干票大的奖励骰代表链） |
| `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 0 errors（2026-06-01 09:49） |
| `npx tsc --noEmit --pretty false` | 通过（2026-06-01 09:49） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算战争贩子 II 的奖励骰分支"` | 1 passed（2026-06-01 09:49，截图 29-30 覆盖战争贩子 II 奖励骰代表链） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应命中并保留战争贩子 II 勋章专门链的额外进攻阶段"` | 1 passed（2026-06-01 11:35，截图 35 覆盖战争贩子 II 勋章专门链） |
| `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 0 errors（2026-06-01 10:17） |
| `npx tsc --noEmit --pretty false` | 通过（2026-06-01 10:17） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算抽筋剥皮的奖励骰分支"` | 1 passed（2026-06-01 10:17，截图 31-32 覆盖抽筋剥皮奖励骰代表链） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts -t "死亡印记"` | 通过（2026-06-01 10:52） |
| `npx eslint src/games/dicethrone/domain/effects.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 0 errors（2026-06-01 10:52） |
| `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 0 errors（2026-06-01 22:18） |
| `npx tsc --noEmit --pretty false` | 通过（2026-06-01 22:18） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过 ultimate 槽位触发并结算制胜高地的前置链"` | 1 passed（2026-06-01 22:09，截图 58-59 覆盖 `ultimate` 槽位入口与锁定/紧缚/战术优势上限补满前置链） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过战术优势被动按钮完成转移状态双阶段交互"` | 1 passed（2026-06-01 22:22，截图 60-63 覆盖被动按钮、状态来源选择、目标选择与 `bind` 转移落点） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过战术优势被动按钮施加锁定并收口到对手状态区"` | 1 passed（2026-06-06，截图 `202-203` 覆盖被动按钮入口，以及 `战术优势 3 -> 0 / 对手锁定 1` 的真实收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应在持有凋零时通过咒缚面 fist 槽位触发并减少灵魂突刺的攻击伤害"` | 1 passed（2026-06-06，截图 `204-206` 覆盖 `凋零 1` 的真实攻击入口、Host 防御窗口与 `Host HP 50 -> 46` 的减伤收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应在持有凋零时通过咒缚面 combo 槽位触发并减少死亡吐息的攻击伤害"` | 1 passed（2026-06-06，截图 `216-218` 覆盖 `凋零 1` 在 `死亡吐息` 真实攻击链上的第二条 live consumer，收口为 `Host HP 50 -> 44`） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应在攻击者带有休战时通过咒缚面 combo 槽位阻断死亡吐息的攻击伤害并在阶段结束清理状态"` | 1 passed（2026-06-06，截图 `219-221` 覆盖 `休战 1` 在 `死亡吐息` 真实攻击链上的第二条 live consumer，收口为 `Host HP 50` 且 `凋零 / 火药桶` 保留、`休战` 清理） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts -t "战术优势可按动作消耗 token 取得 CP、重掷、抽牌、锁定、守护和转移入口"` | 先失败后通过（2026-06-06；先复现“战术优势锁定未创建多人目标选择交互”，修复后通过，锁定 4 人局 `selectPlayer` 仅列敌方目标合同） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 1 file / 61 tests passed（2026-06-06） |
| `npx vitest run src/games/dicethrone/__tests__/barbarian-coverage.test.ts -t "巴掌 II"` | 通过（2026-06-06；补锁 `4 同值 -> 7 点不可防御直收口` 与 `仅 4 剑非 4 同值 -> 仍进入防御` 两条真实攻击链） |
| `npx vitest run src/games/dicethrone/__tests__/cross-hero.test.ts -t "paladin 使用 Accuracy 后应让原本可防御的攻击直接跳过防御窗口"` | 通过（2026-06-06；补锁共享 `use-accuracy` choice effect 会在真实 offensiveRollEnd 选择后直接跳过防御窗口） |
| `npx vitest run src/games/dicethrone/__tests__/choice-interaction-anchor-contract.test.ts -t "use-crit|use-accuracy|offensiveRollEnd choice effect"` | 通过（2026-06-06；补锁 `use-crit / use-accuracy` forged `CHOICE_RESOLVED` 会被拒绝，只有带当前 choice 锚点时才生效） |
| `npx eslint src/games/dicethrone/domain/customActions/zhanshujia.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 0 errors（2026-06-06） |
| `npx tsc --noEmit --pretty false` | 通过（2026-06-06） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示紧缚在额外投掷中的 CP 门禁与阶段清理"` | 1 passed（2026-06-01，截图 64-66 覆盖额外投掷前状态、支付 `1CP` 后状态，以及离开 `offensiveRoll` 后 `bind` 清理收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实防御阶段入口应通过真实攻击流打出并结算伴装撤退"` | 1 passed（2026-06-02 02:20，截图 67-68 覆盖真实防御窗口、真实手牌打出与 `bind / damageShield` 收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实防御阶段入口应通过真实攻击流打出并结算脱战"` | 1 passed（2026-06-02 03:00，截图 69-71 覆盖真实防御窗口、真实手牌打出、奖励骰覆盖层与军刀分支 `-2 HP` 收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过玩家板槽位触发并进入军刀突刺的攻击链"` | 1 passed（2026-06-03，截图 82-84 覆盖 `fist` 槽位解析为 `sabre-thrust-3`、Host 推进到 Guest 防御阶段，以及全战利品防御骰下的 `Guest HP 50 -> 46` 收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过玩家板槽位触发并结算军刀突刺 II 的三同值紧缚链"` | 1 passed（2026-06-03，截图 100-102 覆盖升级后 `fist` 槽位解析为 `sabre-thrust-2-3`、Host 推进到 Guest 防御阶段，以及全战利品防御骰下的 `Guest HP 50 -> 45 / Guest bind 1` 收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过玩家板槽位触发并结算地毯式轰炸 II 的旗帜分支"` | 1 passed（2026-06-03，截图 103-104 覆盖升级后 `chi` 槽位解析为 `carpet-bombing-2-strategy`，以及 `Host tactical advantage 3 / hand 2 / pendingAttack 为空` 的即时收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过玩家板槽位触发并结算战略转移的基础主分支"` | 1 passed（2026-06-06，截图 163-164 覆盖基础版 `calm` 槽位入口，以及 `Host tactical advantage 5 / Guest HP 45 / bind 0` 的真实收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过玩家板槽位触发并结算摇鼓运动的基础主分支"` | 1 passed（2026-06-06，截图 165-167 覆盖基础版 `lotus` 槽位入口、Guest 自然进入防御阶段，以及 `Guest bind 1 / Guest HP 43 / Host tactical advantage 0` 的真实收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过玩家板槽位触发并结算开拓战场的基础主分支"` | 1 passed（2026-06-06，截图 168-170 覆盖基础版 `lightning` 槽位入口、Guest 自然进入防御阶段，以及 `Host tactical advantage 2 / Guest bind 1 / Guest HP 41` 的真实收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过玩家板槽位触发并结算包夹侧翼的基础主分支"` | 1 passed（2026-06-06，截图 171-173 覆盖基础版 `combo` 槽位入口、Guest 自然进入防御阶段，以及 `Host tactical advantage 1 / Guest HP 44` 的真实收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过玩家板槽位触发并结算战略转移 II 的主分支"` | 1 passed（2026-06-03，截图 85-87 覆盖 `calm` 槽位入口、双变体选择 modal 与 `4 个勋章` 主分支 `Guest HP 50 -> 45 / bind 1 / tactical advantage 5` 收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过玩家板槽位触发并结算摇鼓运动 II 的主分支"` | 1 passed（2026-06-03，截图 88-90 覆盖 `lotus` 槽位入口、Guest 自然进入防御阶段，以及 `Host tactical advantage 1 / Guest bind 1 / Guest HP 43` 收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过玩家板槽位触发并结算开拓战场 II 的大顺主分支"` | 1 passed（2026-06-03，截图 91-94 覆盖 `lightning` 槽位入口、变体选择 modal、Guest 自然进入防御阶段，以及 `Host tactical advantage 3 / Guest bind 1 / Guest HP 41` 收口） |
| `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过玩家板槽位触发并结算战略转移 II 的侦察分支"` | 3 passed（2026-06-06；定向 run 同批覆盖 `战略转移 II` 主分支、侦察分支与基础版 `战略转移`，其中侦察分支截图 `207-209` 已证明变体选择后收口到 `Host tactical advantage 5 / Guest HP 50 / Guest bind 0`） |
| `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过玩家板槽位触发并结算摇鼓运动 II 的间接接敌分支"` | 3 passed（2026-06-06；定向 run 同批覆盖 `摇鼓运动 II` 间接接敌分支、基础版 `摇鼓运动` 与 `摇鼓运动 II` 主分支，其中间接接敌分支截图 `210-212` 已证明槽位可直接解析到次级分支，并收口到 `Host tactical advantage 2 / Guest HP 48 / Guest bind 0`） |
| `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过玩家板槽位触发并结算开拓战场 II 的全面封锁分支"` | 3 passed（2026-06-06；定向 run 同批覆盖 `开拓战场 II` 全面封锁分支、基础版 `开拓战场` 与 `开拓战场 II` 大顺主分支，其中全面封锁分支截图 `213-215` 已证明槽位可直接解析到次级分支，并收口到 `Host hand 2 / Guest HP 50 / Guest bind 1`） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实防御阶段入口应展示并结算反制措施 II 与 III 的升级参数链"` | 1 passed（2026-06-06，截图 `177-180` 覆盖升级后的真实防御入口，以及 `反制措施 II -> 攻击者 HP 49 / 战术优势 2`、`反制措施 III -> 攻击者 HP 48 / 战术优势 2` 的收口） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts -t "战术家升级后的(战略转移 II 侦察分支只获得 5 战术优势|开拓战场 II lockdown 分支抽 2 并施加紧缚|摇鼓运动 II 间接接敌分支获得 2 战术优势并造成 2 点不可防御伤害)"` | 3 passed（2026-06-06；补齐 `strategic-shift-2-recon / expand-battlefield-2-lockdown / drum-movement-2-indirect` 的独立 L2 分支行为证据，证明这三条次级分支都不再处于“是否实现未知”状态） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts -t "(human 面判决指令在真实进攻 pipeline 中会于 ADVANCE_PHASE 后进入诅咒金币 simple-choice|human 面无情劫掠在真实进攻 pipeline 中会于诅咒金币选择后收口攻击链|human 面惊魂动魄在真实进攻 pipeline 中会于移除诅咒金币选择后收口攻击链|战术家升级后的摇鼓运动 II 间接接敌分支在真实选择后应标记为不可防御)"` | 4 passed（2026-06-06；补齐同 seam 回归：`判决指令 / 惊魂动魄 / 无情劫掠` 的“选择后 continuation 继续收口”合同，以及 `摇鼓运动 II -> 间接接敌` 的 `ATTACK_INITIATED.isDefendable=false` 共享消费合同） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过升级后的玩家板槽位触发并结算包夹侧翼 II 的参数链"` | 1 passed（2026-06-06，截图 `181-183` 覆盖升级场景下 `combo` 槽位真实入口、Guest 自然进入防御阶段，以及 `Host tactical advantage 2 / Guest HP 44` 的收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算埋伏的即时战术优势链"` | 1 passed（2026-06-06，截图 `184-185` 覆盖真实手牌入口，以及 `战术优势 2 + 源卡进入弃牌堆` 的即时收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应命中并结算虚张声势的弯刀分支"` | 1 passed（2026-06-05 复跑通过；截图 95-96 覆盖 Guest 真实手牌打出后的奖励骰覆盖层，以及弯刀分支 `Host HP 50 -> 48` 收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应命中并结算虚张声势的战利品抽 2 分支"` | 1 passed（2026-06-05，截图 149-150 覆盖 Guest 真实手牌打出后的奖励骰覆盖层，以及战利品分支抽 2 张牌的收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应命中并结算虚张声势的骷髅施加火药桶分支"` | 1 passed（2026-06-05，截图 151-152 覆盖 Guest 真实手牌打出后的奖励骰覆盖层，以及骷髅分支对 Host 写入 `火药桶 1` 的收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算诱饵的 2 点攻击伤害"` | 1 passed（2026-06-03，截图 97-99 覆盖真实 `soul-stab-3` 攻击入口、Guest 真实手牌打出后的攻击修正徽标，以及仍处于 `offensiveRoll` 时的 `Host HP 50 -> 48` 收口） |
| `npx tsc --noEmit --pretty false` | 通过（2026-06-01 10:52） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 2 files / 50 tests passed（2026-06-01 10:56） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 1 file / 43 tests passed（2026-06-01 10:56） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算死亡印记的奖励骰分支"` | 1 passed（2026-06-01 10:56，截图 33-34 覆盖死亡印记奖励骰代表链） |
| `npx eslint e2e/helpers/dicethrone.ts e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 0 errors（2026-06-01 18:42；2026-06-01 18:55） |
| `npx tsc --noEmit --pretty false` | 通过（2026-06-01 18:42；2026-06-01 18:55） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "4 人真实入口应先进入 targetingRoll，并按 5/6 把无情诅咒的目标选择权交给正确玩家"` | 1 passed（2026-06-06 复跑；原 2026-06-01 截图 42-45 继续覆盖 defender captain 选敌、attacker 选敌、火药桶 modal 与双敌方落桶状态链；新增截图 `161-162` 已补“有合法目标时选择不施加火药桶”的真实否定路径） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算战略防御与送你们去喂鱼的交互 UI"` | 1 passed（2026-06-06 复跑；原截图 `07-10` 继续覆盖战略防御与送你们去喂鱼正向施桶链；新增截图 `159-160` 已补“有合法目标时选择不施加火药桶”的真实否定路径） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算诅咒卡牌的自伤抽牌分支"` | 1 passed（2026-06-01 18:55，截图 46-47 覆盖 choice modal 与“受 4 伤害抽 3”收口状态） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算封舱的弃手重抽链"` | 1 passed（2026-06-01 19:04，截图 48-49 覆盖打牌前手牌与打牌后弃手重抽状态） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算分点给我的单目标火药桶链"` | 1 passed（2026-06-01 19:12，截图 50-51 覆盖打牌前手牌与打牌后目标火药桶状态） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算亡灵之爪的诅咒金币追加直伤链"` | 1 passed（2026-06-01 19:34，截图 52-53 覆盖面板槽位入口与 3 层诅咒金币下的 11 点总伤害收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算诅咒金币的维持阶段掉血链"` | 1 passed（2026-06-01 20:06，截图 54-55 覆盖 Guest 回合结束后 Host upkeep 掉 3 HP 且诅咒金币保留） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算火药桶的维持阶段爆炸链"` | 1 passed（2026-06-01 20:26，截图 56-57 覆盖 Guest 回合结束后 Host upkeep 掉 3 HP 且火药桶移除） |
| `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts e2e/helpers/dicethrone.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 通过（2026-06-02 03:07） |
| `npx tsc --noEmit --pretty false` | 通过（2026-06-02 03:07） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 2 files / 52 tests passed（2026-06-02 03:07） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 24 passed（2026-06-02 03:18；当时整份 intake E2E 单轮回归通过，运行中仍有 best-effort route/module 预热 warning，但不阻断正式进房与断言） |
| `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 0 errors（2026-06-02 04:14） |
| `npx tsc --noEmit --pretty false` | 通过（2026-06-02 04:14） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应命中并结算占得上风的勋章分支"` | 1 passed（2026-06-02，截图 72-73 覆盖占得上风勋章分支） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应命中并结算起锚的骷髅分支"` | 1 passed（2026-06-02，截图 74-75 覆盖起锚骷髅分支） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应命中并结算起锚的默认抽牌分支"` | 1 passed（2026-06-05，截图 `143-144` 覆盖起锚非骷髅默认抽牌分支与源卡弃牌收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算诅咒卡牌的抽 1 张牌分支"` | 1 passed（2026-06-05，截图 `145-146` 覆盖诅咒卡牌抽 1 张牌分支的选择窗、抽牌与源卡弃牌收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算诅咒卡牌的受 2 伤害抽 2 分支"` | 1 passed（2026-06-05，截图 `147-148` 覆盖诅咒卡牌受 2 伤害抽 2 分支的选择窗、HP 变化、抽牌与源卡弃牌收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 24 passed / 2 failed（2026-06-02；新增两条后整份扩到 26 条，当时掉红的是既有 `紧缚` 与 `火药桶` 两条旧链，现已修复） |
| `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 通过（2026-06-02；`咒缚` 与火药桶 upkeep 新一轮改测后复核） |
| `npx tsc --noEmit --pretty false` | 通过（2026-06-02；同上轮 `咒缚` / 火药桶 upkeep 改测后复核） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示紧缚在额外投掷中的 CP 门禁与阶段清理"` | 1 passed（2026-06-02；既有旧红链恢复） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算咒缚的维持阶段自伤链"` | 1 passed（2026-06-02；场景已修正为“战术家 discard -> 咒缚海盗 upkeep”，证明咒缚海盗在自己 upkeep 真实受到 4 点不可防止伤害） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应在对手未发起攻击时由咒缚施加火药桶"` | 1 passed（2026-06-02；证明对手在其进攻投掷阶段未发起攻击时，会沿真实入口给咒缚海盗对手施加火药桶） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算火药桶的维持阶段爆炸链"` | 1 passed（2026-06-02；既有旧红链恢复） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算战术家升级牌的共享替换链"` | 1 passed（2026-06-03；截图 76-77 覆盖升级牌真实打出、升级槽位写入与升级后 UI 状态） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应逐张把其余战术家升级牌写入对应升级槽位"` | 1 passed（2026-06-06；截图 `186-201` 逐张覆盖 `反制措施 III / 反制措施 II / 战略转移 II / 开拓战场 II / 包夹侧翼 II / 摇鼓运动 II / 地毯式轰炸 II / 军刀突刺 II` 的真实手牌打出与升级槽位写入） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示紧缚在额外投掷中的 CP 门禁与阶段清理"` | 1 passed（2026-06-03；本轮复核再次证明 `64-66` 真实入口链可用，旧的环境阻断结论已过时） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 39 passed（2026-06-03；这是当时版本的阶段性整跑结果，后续已被更晚的整跑事实取代） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算战争贩子的奖励骰分支与额外进攻阶段"` | 历史测试名保留；2026-07-23 回图后，旧截图 78-79 只能作为奖励骰覆盖层历史证据，不能再证明“基础战争贩子全分支防御收口后额外进攻”。当前回归以机制测试中的军刀可防御、勋章不防御并额外进攻断言为准 |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 历史上曾 `26 passed`（2026-06-02 20:54）且也曾因 runtime 波动全量 `skipped`；这些都已不是当前事实。2026-06-06 中段一度也出现过“命令超时前只看到前 70 条”的假象，但那同样不是当前业务 blocker；最新权威整跑已更新为 `80 passed (20.3m)` |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 80 passed（2026-06-06；当前最新整份 intake 权威整跑，说明 human 面尾段、维持阶段链与 4 人链都已并回 full-file，当前不再存在“整跑仍红”或“full-file 未证实”的 blocker） |
| `run-e2e-single.mjs` 并行定点执行 | 不可作为当前默认验证方式：并行会稳定撞 `.tmp/e2e-preflight-cache.json` 的 `EBUSY`，应串行跑相关定点用例 |
| `npx tsx scripts/infra/diagnose-dicethrone-room-entry.ts --attempts 1 --character-selection-timeout 90000` | 已新增最小进房诊断脚本（2026-06-02），反馈环收窄为 `create -> join -> seed -> goto room -> wait character selection`；当前结论仍是环境 blocker：`bundle` runtime 下 `vite-with-logging` 异常退出且 `bundle-runner e2e-game-single` 启动期 `Fatal JavaScript out of memory`，切到 `tsx` runtime 后 Vite 与游戏服务又分别出现 `Zone Allocation failed - process out of memory`，因此 isolated single-worker 现在会在真正进房前随机撞启动期 OOM |
| `waitForFrontendAssets(hostPage, 30000)` | 目前只能算 best-effort 诊断：即使 runtime manager 已把 `/__ready`、`/@vite/client`、`/src/main.tsx` 纳入健康检查，Playwright `page.request.get('/@vite/client')` 仍可能单独挂死 30s；可证明环境不稳，但不能单独作为业务结论 |
| `npm run assets:check` | 上传前发现 24 个 DiceThrone 新资源缺远端 |
| `npm run assets:upload` | 上传 25，跳过 2025，失败 0；其中 24 个为本轮 DiceThrone 新资源，另 1 个为既有 SmashUp `pretty_pretty.webp` 远端差异 |
| 代表 URL HEAD 回查 | 战术家与咒缚海盗的 `player-board.webp`、`tip.webp`、`ability-cards.webp`、`dice.webp`、`status-icons-atlas.webp` 均为 200；Common `background.webp`、`character-portraits.webp` 均为 200 |

## 2026-06-02 新增环境证据

- `反制措施 / 你还嫩了点` 当前已拿到新的运行时恢复证据，静态复核结论被补强而不是被推翻：
  - `你还嫩了点` 结束防御命令确实应由 Guest / `playerId: '1'` 发送，`反制措施` 则应由 Host / `playerId: '0'` 发送；
  - `rules.ts` 的 `canAdvancePhase(defensiveRoll)`、`flowHooks.ts` 的 `defensiveRoll` 退出逻辑与现有 mechanics tests 都表明，`setupDefenseEvidenceScenario(...)` 现在的 direct `defensiveRoll + pendingAttack + rollConfirmed` 注入结构在合同上仍然自洽；
  - 最新定点 `1 passed` 说明首个真实修点是 E2E 把结束防御命令发给了错误玩家，而不是这条注入结构本身。
- 当前最小诊断脚本已经把环境 blocker 从“可能是 `Board.tsx` 首取慢”继续收窄到“runtime 启动期可能随机 OOM”：
  - `bundle` runtime：前端进程异常退出，`bundle-runner e2e-game-single` 启动期 `Fatal JavaScript out of memory`；
  - `tsx` runtime：Vite 与游戏服务分别出现 `Zone Allocation failed - process out of memory`；
  - 因此当前仍拿不到“已稳定进房并重新验证旧防御链”的新证据。
- 当前已确认一条可复跑的环境绕过路径，能把定点验证重新带回真实业务位点：
  - `PW_SERVER_RUNTIME='prebuilt'`
  - `PW_SERVER_WATCH='false'`
  - `PW_PREBUILT_BUNDLE_ROOT='temp/dev-bundles/e2e-single'`
  - `BG_VITE_FORCE_INLINE='1'`
  - 显式不设置 `BG_VITE_FORCE_CONFIG_INLINE`
  - 同时 `scripts/infra/diagnose-dicethrone-room-entry.ts` 已改为尊重外部 runtime 选择并回写 runtime manager 产出的端口环境变量，`vite.config.ts` 也已把 inline 启动与配置 fallback 分支拆开，避免再被 `howler` CJS 导入错误伪装成业务红灯。

## E2E 截图证据

目录：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhanshujia-cursed-pirate-intake.e2e\真实在线双玩家应能选择战术家和咒缚海盗并看到面板、提示板、手牌与-HUD`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhanshujia-cursed-pirate-intake.e2e\真实入口应展示并结算战略防御与送你们去喂鱼的交互-UI`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhanshujia-cursed-pirate-intake.e2e\真实防御阶段入口应展示并结算反制措施与你还嫩了点`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhanshujia-cursed-pirate-intake.e2e\真实进攻阶段入口应通过面板槽位选择并结算深海潜行前置链`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhanshujia-cursed-pirate-intake.e2e\真实入口应展示并结算干票大的奖励骰分支`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhanshujia-cursed-pirate-intake.e2e\真实入口应命中并结算占得上风的勋章分支`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhanshujia-cursed-pirate-intake.e2e\真实入口应命中并结算起锚的骷髅分支`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhanshujia-cursed-pirate-intake.e2e\真实入口应命中并结算起锚的默认抽牌分支`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhanshujia-cursed-pirate-intake.e2e\真实入口应展示并结算诅咒卡牌的抽 1 张牌分支`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhanshujia-cursed-pirate-intake.e2e\真实入口应展示并结算诅咒卡牌的受 2 伤害抽 2 分支`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhanshujia-cursed-pirate-intake.e2e\真实入口应命中并结算虚张声势的弯刀分支`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhanshujia-cursed-pirate-intake.e2e\真实入口应展示并结算诱饵的-2-点攻击伤害`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhanshujia-cursed-pirate-intake.e2e\真实入口应展示并结算战争贩子 II 的奖励骰分支`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhanshujia-cursed-pirate-intake.e2e\真实入口应命中并保留战争贩子 II 勋章专门链的额外进攻阶段`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhanshujia-cursed-pirate-intake.e2e\真实入口应展示并结算抽筋剥皮的奖励骰分支`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhanshujia-cursed-pirate-intake.e2e\真实入口应展示并结算死亡印记的奖励骰分支`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhanshujia-cursed-pirate-intake.e2e\4-人真实入口应先进入-targetingRoll，并按-5-6-把无情诅咒的目标选择权交给正确玩家`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhanshujia-cursed-pirate-intake.e2e\4-人真实入口应展示并结算地毯式轰炸的双敌目标链`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhanshujia-cursed-pirate-intake.e2e\真实入口应展示并结算诅咒卡牌的自伤抽牌分支`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhanshujia-cursed-pirate-intake.e2e\真实入口应展示并结算封舱的弃手重抽链`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhanshujia-cursed-pirate-intake.e2e\真实入口应展示并结算分点给我的单目标火药桶链`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhanshujia-cursed-pirate-intake.e2e\真实入口应展示并结算亡灵之爪的诅咒金币追加直伤链`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhanshujia-cursed-pirate-intake.e2e\真实入口应展示并结算诅咒金币的维持阶段掉血链`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhanshujia-cursed-pirate-intake.e2e\真实入口应展示并结算火药桶的维持阶段爆炸链`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhanshujia-cursed-pirate-intake.e2e\真实入口应通过 ultimate 槽位触发并结算制胜高地的前置链`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhanshujia-cursed-pirate-intake.e2e\真实入口应通过战术优势被动按钮完成转移状态双阶段交互`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhanshujia-cursed-pirate-intake.e2e\真实入口应通过战术优势被动按钮施加锁定并收口到对手状态区`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhanshujia-cursed-pirate-intake.e2e\真实入口应在持有凋零时通过咒缚面-fist-槽位触发并减少灵魂突刺的攻击伤害`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhanshujia-cursed-pirate-intake.e2e\真实防御阶段入口应通过真实攻击流打出并结算伴装撤退`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\zhanshujia-cursed-pirate-intake.e2e\真实防御阶段入口应通过真实攻击流打出并结算脱战`

| 文件 | 人工核对结论 |
| --- | --- |
| `01-host-selection-zhanshujia-cursed-pirate.png` | Host 选角页可见战术家与咒缚海盗，战术家为 P1 选择，咒缚海盗为 P2 选择 |
| `02-guest-selection-zhanshujia-cursed-pirate.png` | Guest 选角页可见战术家与咒缚海盗，咒缚海盗为 P2 选择并可准备 |
| `03-host-gameplay-zhanshujia-board-tip-hud.png` | Host 开局视角可见战术家玩家板、战术优势/紧缚/锁定/守护提示板、HUD 与骰区 |
| `04-guest-gameplay-cursed-pirate-board-tip-hud.png` | Guest 开局视角可见咒缚海盗玩家板、诅咒金币/火药桶/凋零/休战提示板、HUD 与骰区 |
| `05-host-zhanshujia-hand-card-atlas.png` | Host 手牌 atlas 可见战术家“作战室”卡图，同时同一手牌区内可见 `card-unexpected`，证明战术家 common atlas slot 32 运行时落点成立 |
| `06-guest-cursed-pirate-hand-card-atlas.png` | Guest 手牌 atlas 可见咒缚海盗“海盗的一生”卡图，同时同一手牌区内可见 `card-unexpected`，证明咒缚海盗 common atlas slot 33 运行时落点成立 |
| `07-host-strategic-defense-target-choice.png` | Host 真实入口可见战略防御的玩家选择覆盖层，候选包含自己与对手 |
| `08-host-strategic-defense-protect-applied.png` | Host 选择 P2 后，服务器状态断言 P2 获得守护；截图保留结算后棋盘证据 |
| `09-guest-go-fish-powder-keg-choice.png` | Guest 真实入口可见送你们去喂鱼的“至多三名对手获得火药桶”选择弹窗 |
| `10-guest-go-fish-powder-keg-applied.png` | Guest 选择施加给 P1 后，服务器状态断言 P1 获得火药桶；截图保留结算后棋盘证据 |
| `159-guest-go-fish-skip-choice.png` | 在同样存在合法目标 `P1` 的前提下，Guest 真实入口仍可见“至多三名对手获得火药桶”选择窗，且按钮同时包含 `施加给 P1` 与“不施加火药桶” |
| `160-guest-go-fish-skip-applied.png` | Guest 选择“不施加火药桶”后，服务器状态断言 Host / Guest 都未新增火药桶，modal 关闭并直接收口；截图保留否定路径的真实棋盘证据 |
| `11-host-select-hand-card-choice.png` | Host 可见 `selectHandCard` 手牌选择弹窗，标题为“选择 1 张手牌弃置”，候选牌名已翻译为“作战室！” |
| `12-host-select-hand-card-discarded.png` | Host 选择作战室并确认后，服务器状态断言该牌进入 P1 弃牌堆；截图保留弃牌堆数量增加证据 |
| `13-guest-crows-nest-view-hand.png` | Guest 真实入口打出瞭望台并固定弯刀分支，弹窗显示“瞭望台：查看手牌”，按钮文案为“作战室！、战略防御！”中文卡名，无 raw `card-*` ID |
| `14-guest-crows-nest-confirmed-hand-unchanged.png` | Guest 确认查看后返回棋盘，服务器状态断言 P1 手牌仍为作战室与战略防御两张，证明查看链不改变权威手牌 |
| `15-host-crows-nest-loot-discard-choice.png` | Host 真实入口打出瞭望台并命中战利品分支，目标玩家可见“选择 1 张手牌弃置”，候选为“作战室！”与“战略防御！” |
| `16-host-crows-nest-loot-discarded.png` | 战利品分支确认弃牌后，截图保留手牌/弃牌堆落点，服务器状态断言弃牌数量增加 |
| `17-host-crows-nest-skull-random-discarded.png` | 骷髅分支随机弃牌后，截图与状态断言证明目标手牌剩 1、弃牌 1 |
| `18-host-war-room-bonus-die-spotlight.png` | Host 真实入口打出作战室后出现奖励骰特写，文案显示“作战室：获得 3 战术优势” |
| `19-host-war-room-tactical-advantage-applied.png` | Host 关闭奖励骰特写后返回棋盘，服务器状态断言战术优势至少 1 |
| `20-host-countermeasures-defense-before-resolve.png` | Host 处于战术家反制措施防御阶段入口，防御骰为军刀/军刀/旗帜/勋章，推进按钮可用 |
| `21-host-countermeasures-defense-resolved.png` | 反制措施结算后，服务器状态断言攻击者 HP 49、战术家获得 1 战术优势 |
| `22-guest-still-wet-behind-ears-defense-before-resolve.png` | Guest 处于咒缚海盗你还嫩了点防御阶段入口，防御骰为弯刀/战利品/骷髅/骷髅/骷髅，推进按钮可用 |
| `23-guest-still-wet-behind-ears-defense-resolved.png` | 你还嫩了点结算后，服务器状态断言攻击者 HP 49、防御者 HP 50、防御者 CP 6、攻击者获得 1 诅咒金币 |
| `24-guest-deep-sea-dive-offensive-entry.png` | Guest 真实通过玩家板技能槽进入深海潜行攻击链，前置偷取 CP 与施加凋零后流程仍停留在等待 Host 弃牌的正确位点 |
| `25-host-deep-sea-dive-discard-choice.png` | Host 在深海潜行前置事件结算后仍真实看到“选择 1 张手牌弃置”弹窗，证明 `selectHandCard` 未被前置事件提前收口 |
| `26-host-deep-sea-dive-discarded.png` | Host 确认弃牌后弃牌堆落点正确，深海潜行整条攻击链收口正常 |
| `27-guest-hefty-bonus-die-loot.png` | Guest 真实打出干票大的后进入双骰奖励骰覆盖层，截图保留奖励骰展示证据 |
| `28-guest-hefty-loot-applied.png` | 关闭覆盖层后，服务器状态断言咒缚海盗 CP 回到 5、手牌补到 2、干票大的进入弃牌堆，证明战利品分支真实收口 |
| `29-host-war-monger-2-bonus-die-branch.png` | Host 真实通过玩家板 `sky` 槽位触发战争贩子 II 后进入奖励骰覆盖层，截图保留真实入口奖励骰展示证据 |
| `30-host-war-monger-2-branch-applied.png` | 关闭覆盖层后，服务器状态按实际 `pendingAttack.extraRoll.value` 分支收口；截图保留代表性分支结算后的棋盘状态 |
| `35-host-war-monger-2-medal-extra-attack.png` | 历史截图名保留；2026-07-23 现行合同中战争贩子 II 勋章分支不应经过防御投掷。该截图不能再作为“Guest 防御收口后进入额外进攻”的规则证据，当前以机制测试的不可防御 0 伤害 + `EXTRA_ATTACK_TRIGGERED` 断言为准 |
| `31-guest-flay-bonus-dice.png` | Guest 真实打出抽筋剥皮后进入 5 骰奖励骰覆盖层，截图保留真实入口奖励骰展示证据 |
| `32-guest-flay-branch-applied.png` | 关闭覆盖层后，服务器状态按实际弯刀数收口；截图保留代表性分支结算后的棋盘状态，并可回指 bonus damage 与火药桶落点 |
| `33-guest-marked-for-death-bonus-dice.png` | Guest 真实通过玩家板 `marked-for-death` 槽位触发死亡印记后进入 4 骰奖励骰覆盖层，截图保留真实入口奖励骰展示证据 |
| `34-guest-marked-for-death-branch-applied.png` | 关闭覆盖层后，服务器状态按实际弯刀/战利品/骷髅结果收口；截图保留代表性分支结算后的棋盘状态，并可回指 CP、抽牌、诅咒金币与不可防御伤害落点 |
| `42-four-player-merciless-curse-defender-team-choice.png` | 4 人 2v2 真实入口中，目标骰为 5 时选择权切到防守队队长；截图保留 `dt-defender-choice-panel` 与仅敌队两名候选 |
| `43-four-player-merciless-curse-attacker-choice.png` | 4 人 2v2 真实入口中，目标骰为 6 时选择权切到进攻方；截图保留 Host 的敌方目标选择面板且不出现队友 |
| `44-four-player-merciless-curse-powder-keg-choice.png` | 防守队长选完目标后，Host 真实看到“选择至多两名对手获得火药桶” modal，按钮精确包含 `施加给 P2`、`施加给 P4`、`施加给 P2, P4` 与“不施加火药桶” |
| `45-four-player-merciless-curse-powder-keg-applied.png` | 选择 `施加给 P2, P4` 后，页内 harness 与服务器状态共同证明 `P2/P4` 均获得 1 层火药桶，交互清空且 modal 隐藏 |
| `161-four-player-merciless-curse-skip-choice.png` | 同一 4 人真实入口在 attacker 选敌后再次打开火药桶 modal；截图保留“存在合法敌方目标时仍可选择不施加火药桶”的按钮证据 |
| `162-four-player-merciless-curse-skip-applied.png` | Host 选择“不施加火药桶”后，服务器状态断言 `P2/P4` 都未新增火药桶、交互已清空且攻击链直接收口；截图保留否定路径的真实棋盘证据 |
| `46-guest-curse-card-choice.png` | Guest 真实打出诅咒卡牌后看到“诅咒卡牌：选择结算效果” modal，三个分支按钮文案与图面语义一致 |
| `47-guest-curse-card-damage4draw3-applied.png` | Guest 选择“受到 4 点伤害并抽 3 张牌”后，截图保留回到棋盘与手牌区的状态；服务器断言 HP 变为 46、手牌变为送你们去喂鱼/瞭望台/干票大的，且诅咒卡牌进入弃牌堆 |
| `48-guest-batten-down-before-play.png` | Guest 真实进入主阶段并持有封舱、送你们去喂鱼、瞭望台三张手牌；截图保留打牌前手牌可见状态 |
| `49-guest-batten-down-applied.png` | Guest 打出封舱后，服务器断言 CP 变为 1、封舱/送你们去喂鱼/瞭望台进入弃牌堆，手牌重抽为干票大的/抽筋剥皮/赎金/啜呼；截图保留弃手重抽后的手牌状态 |
| `50-guest-give-me-some-before-play.png` | Guest 真实进入主阶段并持有分点给我；截图保留打牌前手牌可见状态 |
| `51-guest-give-me-some-applied.png` | Guest 打出分点给我后，服务器断言 Host 获得 1 层火药桶，且分点给我进入弃牌堆；截图保留打牌后棋盘与状态区变化 |
| `52-guest-undead-claw-before-attack.png` | Guest 真实在玩家板 `calm` 槽位看到已解析为亡灵之爪且可点击；截图保留发动前的面板入口状态 |
| `53-host-undead-claw-applied.png` | Guest 发动亡灵之爪并推进后，服务器断言 Host HP 从 50 降到 39 且 3 层诅咒金币未被消耗；截图保留防守方结算后的棋盘与状态区变化 |
| `54-host-cursed-coin-upkeep-before-advance.png` | Guest 回合结束前，Host 真实持有 3 层诅咒金币；截图保留维持阶段前的棋盘与状态区起始状态 |
| `55-host-cursed-coin-upkeep-applied.png` | Guest 推进回合后，服务器断言 Host 在 upkeep 结算后 HP 从 50 降到 47 且 3 层诅咒金币仍保留；截图保留结算后的棋盘与状态区变化 |
| `56-host-powder-keg-upkeep-before-advance.png` | Guest 回合结束前，Host 真实持有 1 层火药桶；截图保留维持阶段前的棋盘与状态区起始状态 |
| `57-host-powder-keg-upkeep-exploded.png` | Guest 推进回合后，服务器断言 Host 在 upkeep 结算后 HP 从 50 降到 47 且火药桶移除；截图保留爆炸结算后的棋盘与状态区变化 |
| `58-host-high-ground-offensive-entry.png` | Host 真实在玩家板 `ultimate` 槽位看到已解析为制胜高地且可点击；截图保留发动前的 ultimate 槽位入口状态 |
| `59-host-high-ground-pre-defense-applied.png` | Host 点击制胜高地并推进后，服务器断言 Guest 获得锁定/紧缚，且 Host 的战术优势上限从 5 升到 6 并补满到 6；截图保留前置链收口后的棋盘与状态区变化 |
| `60-host-tactical-advantage-transfer-entry.png` | Host 主阶段真实显示战术优势被动按钮中的“转移状态”；截图保留被动按钮入口与当前 4 层战术优势状态 |
| `61-host-tactical-advantage-select-bind.png` | Host 点击“转移状态”后真实进入 `selectStatus` 覆盖层，可选来源为自己身上的紧缚；截图保留来源状态选择界面 |
| `62-host-tactical-advantage-select-target.png` | 选中 `bind` 后真实进入 `selectTargetStatus` 阶段，来源卡锁定在 P1，P2 作为接收目标可点；截图保留双阶段交互的目标选择界面 |
| `63-host-tactical-advantage-transfer-applied.png` | Host 选择 P2 并确认后，服务器断言战术优势从 4 降到 0、P1 的 `bind` 清空、P2 获得 1 层 `bind`；截图保留转移完成后的棋盘与状态区变化 |
| `202-host-tactical-advantage-targeted-entry.png` | Host 主阶段真实显示战术优势被动按钮中的“锁定”；截图保留按钮入口与当前 3 层战术优势状态 |
| `203-host-tactical-advantage-targeted-applied.png` | Host 点击“锁定”后，服务器断言战术优势从 3 降到 0，Guest 获得 `锁定 1`；截图保留被动按钮真实结算后的棋盘与对手状态区变化 |
| `204-guest-cursed-soul-stab-wither-entry.png` | Guest 真实持有 `凋零 1`，且咒缚面 `fist` 槽位仍解析为 `soul-stab-3`；截图保留攻击前的状态区与技能入口 |
| `205-host-cursed-soul-stab-wither-defense-entry.png` | Guest 推进攻击后，Host 自然进入 `countermeasures` 防御窗口；截图保留“攻击链已建立、但防御骰不提供减伤”的中间态证据 |
| `206-host-cursed-soul-stab-wither-applied.png` | Host 推进防御收口后，服务器断言 `Host HP 50 -> 46`、Guest 仍保留 `凋零 1`、Host 同时获得 `火药桶 1`；截图保留 `凋零` 真实减少攻击伤害后的棋盘状态 |
| `64-guest-bind-extra-roll-before-reroll.png` | Guest 真实处于被 `紧缚` 的额外进攻投掷阶段，额外投掷按钮可见；截图保留支付 CP 之前的棋盘与状态区 |
| `65-guest-bind-extra-roll-cp-spent.png` | Guest 点击额外投掷后，服务器状态断言 CP 从 5 降到 4，且 `bind` 仍保留 1 层；截图保留已支付 `1CP` 后的额外投掷状态 |
| `66-guest-bind-cleared-after-phase-exit.png` | Guest 确认骰面并完成后续阶段推进后，页内 harness 断言已离开 `offensiveRoll` 且 `bind` 清空；截图保留 `紧缚` phase exit 清理收口后的棋盘状态 |
| `67-host-tactical-retreat-defense-before-play.png` | Guest 通过真实 `soul-stab-3` 攻击链建立 `pendingAttack` 并推进后，Host 自然进入 `defensiveRoll`；截图保留 `伴装撤退` 仍在真实手牌、可从防御窗口打出的入口状态 |
| `68-host-tactical-retreat-defense-resolved.png` | Host 从真实手牌打出 `伴装撤退` 后，服务器断言源卡进入弃牌堆、Guest 获得 `bind 1`、Host 获得 `3` 点 `damageShield`；截图保留真实防御响应手牌链收口后的棋盘状态 |
| `69-host-disengage-defense-before-play.png` | Guest 通过真实 `soul-stab-3` 攻击链建立 `pendingAttack` 并推进后，Host 自然进入 `defensiveRoll`；截图保留 `脱战` 仍在真实手牌、可从防御窗口打出的入口状态 |
| `70-host-disengage-bonus-die.png` | Host 从真实手牌打出 `脱战` 后，奖励骰覆盖层真实出现；截图保留防御响应手牌链进入奖励骰结算的中间证据 |
| `71-host-disengage-branch-resolved.png` | 本次通过 run 命中军刀分支；截图顶部保留攻击者 `-2` 飘字，服务器断言 Guest HP `50 -> 48` 且 `card-zhanshujia-disengage` 进入弃牌堆，证明 `脱战` 的真实分支结算已走通 |
| `72-host-gain-upper-hand-bonus-die-medal.png` | Host 从真实手牌打出占得上风后，定向 run 命中勋章分支并进入奖励骰覆盖层；截图保留该对象真实入口的奖励骰展示证据 |
| `73-host-gain-upper-hand-medal-applied.png` | 关闭覆盖层后，服务器断言 Host 的战术优势从 0 提升到 4，且 `card-zhanshujia-gain-the-upper-hand` 已进入弃牌堆；截图保留勋章分支收口后的棋盘状态 |
| `76-host-war-monger-upgrade-card-before-play.png` | Host 真实主阶段持有 `战争贩子 II` 升级牌，`sky` 槽位仍显示基础 `war-monger`，且 `data-upgrade-card-interactive=false`；截图保留升级前手牌与槽位入口状态 |
| `77-host-war-monger-upgrade-card-applied.png` | Host 打出升级牌后，服务器断言 `abilityLevels['war-monger']=2`、`upgradeCardByAbilityId['war-monger'].cardId='upgrade-zhanshujia-war-monger-2'`、CP `5 -> 3`、手牌归 0、弃牌堆仍为空，且槽位已切为 `data-upgrade-card-interactive=true`；截图保留升级后槽位 UI 状态 |
| `78-host-war-monger-bonus-die-branch.png` | Host 真实通过玩家板 `sky` 槽位触发基础战争贩子后进入奖励骰覆盖层；截图保留本体奖励骰展示证据 |
| `79-host-war-monger-extra-attack-phase.png` | 历史截图说明已失效：不能再作为“基础战争贩子防御收口后必进额外进攻”的证据。2026-07-23 现行合同只允许勋章分支额外进攻；军刀分支应先进入防御并按防伤/减伤后结算攻击伤害 |
| `80-player2-carpet-bombing-target-choice.png` | 战术家在 4 人真实入口里完成 `targetingRoll` 与必要的目标归属选择后，真实进入 `selectPlayer` 双敌覆盖层；截图保留仅敌队 `P1 / P3` 可选、队友 `P4` 不在候选中的证据 |
| `81-player2-carpet-bombing-applied.png` | 战术家确认 `P1 / P3` 后，服务器断言 `teamA=46`、`player0Hp=46`、`player2Hp=46`、`player3Hp=50` 且交互清空；截图保留双敌目标链收口后的棋盘状态 |
| `82-host-sabre-thrust-offensive-entry.png` | Host 在真实 3 军刀盘面下，`fist` 槽位显示 `data-base-ability-id="sabre-thrust"` 与 `data-resolved-ability-id="sabre-thrust-3"`，且可点击；截图保留军刀突刺对象级真实攻击入口证据 |
| `83-guest-sabre-thrust-defense-entry.png` | Host 推进后，Guest 自然进入 `still-wet-behind-ears` 防御阶段；截图保留不是 direct injection，而是由真实玩家板攻击链打开的防御窗口 |
| `84-host-sabre-thrust-resolved.png` | 把 Guest 防御骰固定成全战利品面并推进后，服务器断言 `Host HP=50 / Guest HP=46`，说明基础 `sabre-thrust-3` 的 4 点伤害已在真实入口里闭环落地 |
| `100-host-sabre-thrust-2-entry.png` | Host 在升级场景下的真实 3 军刀盘面里，`fist` 槽位显示 `data-base-ability-id="sabre-thrust"` 与 `data-resolved-ability-id="sabre-thrust-2-3"`，且可点击；截图保留军刀突刺 II 的对象级真实攻击入口证据 |
| `101-guest-sabre-thrust-2-defense-entry.png` | Host 推进后，Guest 自然进入 `still-wet-behind-ears` 防御阶段；截图保留军刀突刺 II 不是 direct injection，而是由升级后的真实玩家板攻击链打开的防御窗口 |
| `102-host-sabre-thrust-2-applied.png` | 把 Guest 防御骰固定成全战利品面并推进后，服务器断言 `Host HP=50 / Guest HP=45 / Guest bind=1`，说明升级后的 `sabre-thrust-2-3` 已在真实入口里完成 `5` 点伤害与紧缚写入收口 |
| `103-host-carpet-bombing-2-strategy-entry.png` | Host 在升级场景下的 `4 旗帜 + 1 军刀` 盘面里，`chi` 槽位显示 `data-base-ability-id="carpet-bombing"` 与 `data-resolved-ability-id="carpet-bombing-2-strategy"`，且可点击；截图保留地毯式轰炸 II 旗帜分支的真实玩家板入口证据 |
| `104-host-carpet-bombing-2-strategy-applied.png` | 点击 `chi` 槽位后，服务器断言 `Host 战术优势=3 / Host 手牌含 战略防御！ 与 占得上风！ / pendingAttack 为空`；截图保留旗帜分支 `grantToken + draw 2` 的即时收口状态 |
| `105-guest-human-verdict-command-choice.png` | Guest 在 human 面真实 `lightning` 槽位触发 `判决指令` 后，界面进入诅咒金币选择窗；截图保留 `data-resolved-ability-id="verdict-command"` 与选择交互可见的对象级证据 |
| `106-host-human-verdict-command-applied.png` | 选择获得诅咒金币后，服务器断言 `Guest cursedCoin +1 / Host parley 1 / Host HP 50 -> 43`；截图保留 `判决指令` 选择后 continuation 已继续收口的棋盘状态 |
| `107-guest-human-light-the-fuse-entry.png` | Guest 在 human 面真实 `combo` 槽位看到 `data-base-ability-id="light-the-fuse"` 与 `data-resolved-ability-id="light-the-fuse-small"`，且可点击；截图保留 `点燃炸药` 的对象级真实入口证据 |
| `108-host-human-light-the-fuse-defense-entry.png` | Guest 点击 `点燃炸药` 后，Host 自然进入防御阶段；截图保留这不是 direct injection，而是由 human 面真实攻击链打开的防御窗口 |
| `109-host-human-light-the-fuse-applied.png` | 推进防御收口后，服务器断言 `Host HP 50 -> 43` 且 `Host powderKeg 1`；截图保留 `点燃炸药` 小顺子 `preDefense` 施桶加伤害的真实收口状态 |
| `110-guest-human-merciless-plunder-entry.png` | Guest 在 human 面真实 `ultimate` 槽位触发 `无情劫掠` 后，攻击链进入诅咒金币选择前状态；截图保留 `data-resolved-ability-id="merciless-plunder"` 的对象级入口证据 |
| `111-guest-human-merciless-plunder-choice.png` | `无情劫掠` 主伤害 12 已落地但状态续结尚未收口时，界面进入诅咒金币选择窗；截图保留 continuation 中间态证据 |
| `112-host-human-merciless-plunder-applied.png` | 选择获得诅咒金币后，服务器断言 `Guest cursedCoin 2 / Host parley 1 / Host powderKeg 1 / Host HP 50 -> 38`；截图保留 `无情劫掠` continuation 完整收口后的棋盘状态 |
| `113-guest-human-astonishing-entry.png` | Guest 在 human 面真实 `calm` 槽位看到 `data-resolved-ability-id="astonishing"`，且可点击；截图保留 `惊魂动魄` 的对象级真实入口证据 |
| `114-guest-human-astonishing-choice.png` | Guest 点击 `惊魂动魄` 并推进后，界面进入“你可以移除任意数量的诅咒金币”选择窗；截图保留 choice 中间态与 `Host HP 50 -> 43` 已落地证据 |
| `115-guest-human-astonishing-applied.png` | 选择“移除 2 个诅咒金币”后，服务器断言 `Guest cursedCoin 3 -> 1 / Host HP 50 -> 43`；截图保留 `惊魂动魄` choice 收口后的棋盘状态 |
| `117-guest-human-cursed-before-end-turn.png` | Guest 在 human 面且持有 3 个诅咒金币时停在 `main2`；截图肉眼可见 human 面板、`human-cursed` 槽位与结算前资源状态，证明前态不是旧咒缚面残留图 |
| `117b-guest-human-cursed-discard-phase.png` | Guest 从 `main2` 推进到 `discard` 后仍保持 human 面且诅咒金币未被提前移除；截图保留阶段推进中的稳定中间态 |
| `118-guest-human-cursed-coin-removed.png` | 再次推进结束回合后，服务器断言 `Guest cursedCoin 3 -> 2` 且 `playerBoardFace='normal'`、能力集仍含 `human-cursed`；截图保留有币时仅移 1 层并保持 human 面的真实收口状态 |
| `119-guest-human-cursed-flip-before-end-turn.png` | Guest 在 human 面且没有诅咒金币时停在 `main2`；截图肉眼可见 human 面板与翻面前的初始状态 |
| `119b-guest-human-cursed-discard-phase.png` | Guest 从 `main2` 推进到 `discard` 后仍保持 human 面且没有诅咒金币；截图保留翻面前的稳定中间态 |
| `120-guest-human-cursed-flipped.png` | 再次推进结束回合后，服务器断言 `playerBoardFace='cursed'`、能力集切回 `soul-stab` 且 `human-cursed` 不再存在；截图保留无币时翻回咒缚面的真实收口状态 |
| `121-guest-human-walk-the-plank-entry.png` | Guest 在 human 面真实 `lotus` 槽位看到 `data-base-ability-id="walk-the-plank"` 与 `data-resolved-ability-id="walk-the-plank"`，且可点击；截图保留 `走跳板` 的对象级真实入口证据 |
| `122-guest-human-walk-the-plank-choice.png` | 点击 `走跳板` 并推进后，界面进入“走跳板：选择结算方式”弹窗；截图保留“偷取 1CP / 令对手选择弃掉 1 张牌”两条分支可见的中间态证据 |
| `123-host-human-walk-the-plank-discarded.png` | Host 在弃牌分支里真实打开手牌选择弹窗并确认 `战略防御` 进入弃牌堆；截图保留对手自选弃牌链的最终收口状态 |
| `124-guest-human-cutlass-stab-entry.png` | Guest 在 human 面真实 `fist` 槽位看到 `data-base-ability-id="cutlass-stab"` 与 `data-resolved-ability-id="cutlass-stab-4"`，且可点击；截图保留 `弯刀突刺` 的对象级真实入口证据 |
| `125-host-human-cutlass-stab-defense-entry.png` | Guest 点击 `弯刀突刺` 后，Host 自然进入 `countermeasures` 防御阶段；截图保留这不是 direct injection，而是由 human 面真实攻击链打开的战术家防御窗口 |
| `126-host-human-cutlass-stab-applied.png` | 推进防御收口后，服务器断言 `Host HP 50 -> 48 / Host powderKeg 1 / Guest HP 50`；截图保留 `cutlass-stab-4` 在 4 同值盘面下完成火药桶写入与伤害收口的真实状态 |
| `127-guest-human-make-your-mark-entry.png` | Guest 在 human 面真实 `chi` 槽位看到 `data-base-ability-id="make-your-mark"` 与 `data-resolved-ability-id="make-your-mark"`，且可点击；截图保留 `做好标记` 的对象级真实入口证据 |
| `128-guest-human-make-your-mark-bonus-dice.png` | Guest 点击 `做好标记` 并推进后，权威状态进入 3 颗奖励骰结算；截图保留奖励骰收口前的真实中间态证据 |
| `129-guest-human-make-your-mark-choice.png` | 当奖励骰命中骷髅时，界面进入“是否获得诅咒金币？”选择窗；截图保留 `做好标记` 的诅咒金币选择中间态证据 |
| `130-guest-human-make-your-mark-applied.png` | `做好标记` 收口后，服务器断言 `Guest CP 6 / Guest 手牌数=战利品数 / Guest cursedCoin=骷髅数 / Host HP=50-2*弯刀数`；截图保留奖励骰按实际骰面结算后的真实状态 |
| `131-host-human-still-wet-behind-ears-attack-entry.png` | Host 在真实玩家板 `fist` 槽位触发 `sabre-thrust-3`；截图保留 `嘿，老兄` 不是 direct injection，而是由正式攻击流打开的证据 |
| `132-guest-human-still-wet-behind-ears-defense-entry.png` | Host 推进攻击后，Guest 自然进入 `human-still-wet-behind-ears` 防御阶段；截图保留人类面防御窗口的真实入口证据 |
| `133-guest-human-still-wet-behind-ears-choice.png` | Guest 以 `2 弯刀 + 1 骷髅 + 1 战利品` 防御收口后，界面进入“是否获得诅咒金币？”选择窗；截图保留组合分支的中间态证据 |
| `134-guest-human-still-wet-behind-ears-applied.png` | 推进防御收口后，服务器断言 `Host HP 48 / Guest HP 48 / Guest CP 6 / Guest cursedCoin 1`；截图保留 `嘿，老兄` 在真实防御链中的最终状态 |
| `135-guest-cursed-soul-stab-entry.png` | Guest 在咒缚面真实 `fist` 槽位看到 `data-base-ability-id="soul-stab"` 与 `data-resolved-ability-id="soul-stab-3"`，且可点击；截图保留 `灵魂突刺` 的对象级真实入口证据 |
| `136-host-cursed-soul-stab-defense-entry.png` | Guest 推进后，Host 自然进入 `countermeasures` 防御阶段；截图保留这不是 direct injection，而是由咒缚面真实攻击链打开的战术家防御窗口 |
| `137-host-cursed-soul-stab-applied.png` | 推进防御收口后，服务器断言 `Host HP 50 -> 45 / Host powderKeg 1 / Guest HP 50`；截图保留 `灵魂突刺` 三同值施加火药桶与 5 点伤害的真实收口状态 |
| `138-guest-soul-command-entry.png` | Guest 在咒缚面真实 `lightning` 槽位看到 `data-base-ability-id="soul-command"` 与 `data-resolved-ability-id="soul-command"`，且可点击；截图保留 `灵魂指令` 的对象级真实入口证据 |
| `139-host-soul-command-applied.png` | Guest 推进攻击收口后，服务器断言 `Host HP 50 -> 42 / Host parley 1 / Host powderKeg 1 / Host wither 1`；截图保留 `灵魂指令` 多状态写入与 8 点不可防御伤害的真实收口状态 |
| `85-host-strategic-shift-2-entry.png` | Host 在 `4 勋章 + 3 勋章` 同时满足盘面下，`calm` 槽位可点击，且主解析落点为 `data-resolved-ability-id="strategic-shift-2-main"`；截图保留战略转移 II 的真实玩家板入口证据 |
| `86-host-strategic-shift-2-variant-choice.png` | 点击 `calm` 槽位后，真实 UI 弹出“选择发动变体” modal，候选同时包含 `战略转移 II（4个勋章）` 与 `战略转移 II（3个勋章）`；截图保留升级变体选择不是静默自动分支的证据 |
| `207-host-strategic-shift-2-recon-entry.png` | Host 在同一 `4 勋章 + 3 勋章` 盘面下，`calm` 槽位仍可真实点击，且默认解析落点保持为 `data-resolved-ability-id="strategic-shift-2-main"`；截图保留侦察分支并不是单独造出来的新槽位，而是复用真实玩家板入口再经变体选择切分的证据 |
| `208-host-strategic-shift-2-recon-choice.png` | 点击 `calm` 槽位后，真实 UI 再次弹出“选择发动变体” modal，候选同时包含 `战略转移 II（4个勋章）` 与 `战略转移 II（3个勋章）`；截图保留侦察分支同样经过正式变体选择链的证据 |
| `209-host-strategic-shift-2-recon-applied.png` | Host 选择 `战略转移 II（3个勋章）` 后，服务器断言 `Host 战术优势=5 / Guest HP=50 / Guest bind=0`；截图保留侦察分支“只获得战术优势、不施加紧缚、不造成伤害”的真实收口状态 |
| `163-host-strategic-shift-entry.png` | Host 在基础版 4 勋章盘面下，`calm` 槽位可点击，且解析落点为 `data-resolved-ability-id="strategic-shift"`；截图保留基础版战略转移的真实玩家板入口证据 |
| `164-host-strategic-shift-applied.png` | Host 点击基础版 `战略转移` 并推进后，服务器断言 `Host 战术优势=5 / Guest HP=45 / Guest bind=0`；截图保留基础版主分支不可防御伤害与战术优势写入的真实收口状态 |
| `165-host-drum-movement-entry.png` | Host 在基础版 `3 军刀 + 2 勋章` 盘面下，`lotus` 槽位可点击，且解析落点为 `data-resolved-ability-id="drum-movement"`；截图保留基础版摇鼓运动的真实玩家板入口证据 |
| `166-guest-drum-movement-defense-entry.png` | Host 点击基础版 `摇鼓运动` 并推进后，Guest 自然进入 `human-still-wet-behind-ears` 防御阶段；截图保留这不是 direct injection，而是由真实玩家板攻击链打开的防御窗口 |
| `167-host-drum-movement-applied.png` | 在全战利品防御骰下推进收口后，服务器断言 `Host 战术优势=0 / Guest bind=1 / Guest HP=43`；截图保留基础版摇鼓运动的真实收口状态 |
| `168-host-expand-battlefield-entry.png` | Host 在基础版大顺子盘面下，`lightning` 槽位可点击，且解析落点为 `data-resolved-ability-id="expand-battlefield"`；截图保留基础版开拓战场的真实玩家板入口证据 |
| `169-guest-expand-battlefield-defense-entry.png` | Host 点击基础版 `开拓战场` 并推进后，Guest 自然进入 `human-still-wet-behind-ears` 防御阶段；截图保留基础版大顺攻击链打开真实防御窗口的证据 |
| `170-host-expand-battlefield-applied.png` | 在全战利品防御骰下推进收口后，服务器断言 `Host 战术优势=2 / Guest bind=1 / Guest HP=41`；截图保留基础版开拓战场的真实收口状态 |
| `171-host-flanking-entry.png` | Host 在基础版小顺子盘面下，`combo` 槽位可点击，且解析落点为 `data-resolved-ability-id="flanking"`；截图保留基础版包夹侧翼的真实玩家板入口证据 |
| `172-guest-flanking-defense-entry.png` | Host 点击基础版 `包夹侧翼` 并推进后，Guest 自然进入 `human-still-wet-behind-ears` 防御阶段；截图保留基础版小顺攻击链打开真实防御窗口的证据 |
| `173-host-flanking-applied.png` | 在全战利品防御骰下推进收口后，服务器断言 `Host 战术优势=1 / Guest HP=44`；截图保留基础版包夹侧翼的真实收口状态 |
| `177-host-countermeasures-2-defense-entry.png` | Host 在升级场景下真实进入 `反制措施 II` 防御阶段，当前 `abilityLevel=2` 且推进按钮可用；截图保留升级后的对象级防御入口证据 |
| `178-host-countermeasures-2-resolved.png` | 推进 `反制措施 II` 后，服务器断言攻击者 HP `50 -> 49`、Host 战术优势 `0 -> 2`；截图保留升级参数链按 `1 组军刀 + 1 勋章` 收口后的棋盘状态 |
| `179-host-countermeasures-3-defense-entry.png` | Host 在升级场景下真实进入 `反制措施 III` 防御阶段，当前 `abilityLevel=3` 且推进按钮可用；截图保留升级后的对象级防御入口证据 |
| `180-host-countermeasures-3-resolved.png` | 推进 `反制措施 III` 后，服务器断言攻击者 HP `50 -> 48`、Host 战术优势 `0 -> 2`；截图保留升级参数链按 `1 组军刀 + 1 勋章` 收口后的棋盘状态 |
| `181-host-flanking-2-entry.png` | Host 在升级场景下的真实小顺子盘面里，`combo` 槽位仍解析为 `flanking` 且可点击；截图保留 `包夹侧翼 II` 不是 direct injection，而是由升级后玩家板真实触发的入口证据 |
| `182-guest-flanking-2-defense-entry.png` | Host 点击升级后的 `包夹侧翼` 并推进后，Guest 自然进入 `human-still-wet-behind-ears` 防御阶段；截图保留升级主链打开真实防御窗口的证据 |
| `183-host-flanking-2-applied.png` | 在全战利品防御骰下推进收口后，服务器断言 `Host 战术优势=2 / Guest HP=44`；截图保留 `包夹侧翼 II` 参数提升后的真实收口状态 |
| `184-host-ambush-before-play.png` | Host 在真实主阶段手牌区可见 `埋伏！`；截图保留该对象的真实手牌入口证据 |
| `185-host-ambush-applied.png` | Host 打出 `埋伏！` 后，服务器断言 `战术优势=2` 且源卡进入弃牌堆；截图保留该对象即时写入 token 的真实收口状态 |
| `186-host-countermeasures-3-upgrade-card-before-play.png` | Host 在真实主阶段手牌区可见 `反制措施 III`，且 `countermeasures` 基础槽位尚未挂载升级牌；截图保留该升级牌的真实手牌入口证据 |
| `187-host-countermeasures-3-upgrade-card-applied.png` | Host 打出 `反制措施 III` 后，服务器断言 `abilityLevels['countermeasures']=3`、`upgradeCardByAbilityId['countermeasures'].cardId='upgrade-zhanshujia-countermeasures-3'`、CP `5 -> 0`、手牌归 0；截图保留升级槽位写入后的真实状态 |
| `188-host-countermeasures-2-upgrade-card-before-play.png` | Host 在真实主阶段手牌区可见 `反制措施 II`，且 `countermeasures` 基础槽位尚未挂载升级牌；截图保留该升级牌的真实手牌入口证据 |
| `189-host-countermeasures-2-upgrade-card-applied.png` | Host 打出 `反制措施 II` 后，服务器断言 `abilityLevels['countermeasures']=2`、`upgradeCardByAbilityId['countermeasures'].cardId='upgrade-zhanshujia-countermeasures-2'`、CP `5 -> 2`、手牌归 0；截图保留升级槽位写入后的真实状态 |
| `190-host-strategic-shift-2-upgrade-card-before-play.png` | Host 在真实主阶段手牌区可见 `战略转移 II`，且 `strategic-shift` 基础槽位尚未挂载升级牌；截图保留该升级牌的真实手牌入口证据 |
| `191-host-strategic-shift-2-upgrade-card-applied.png` | Host 打出 `战略转移 II` 后，服务器断言 `abilityLevels['strategic-shift']=2`、`upgradeCardByAbilityId['strategic-shift'].cardId='upgrade-zhanshujia-strategic-shift-2'`、CP `5 -> 3`、手牌归 0；截图保留升级槽位写入后的真实状态 |
| `192-host-expand-battlefield-2-upgrade-card-before-play.png` | Host 在真实主阶段手牌区可见 `开拓战场 II`，且 `expand-battlefield` 基础槽位尚未挂载升级牌；截图保留该升级牌的真实手牌入口证据 |
| `193-host-expand-battlefield-2-upgrade-card-applied.png` | Host 打出 `开拓战场 II` 后，服务器断言 `abilityLevels['expand-battlefield']=2`、`upgradeCardByAbilityId['expand-battlefield'].cardId='upgrade-zhanshujia-expand-battlefield-2'`、CP `5 -> 3`、手牌归 0；截图保留升级槽位写入后的真实状态 |
| `194-host-flanking-2-upgrade-card-before-play.png` | Host 在真实主阶段手牌区可见 `包夹侧翼 II`，且 `flanking` 基础槽位尚未挂载升级牌；截图保留该升级牌的真实手牌入口证据 |
| `195-host-flanking-2-upgrade-card-applied.png` | Host 打出 `包夹侧翼 II` 后，服务器断言 `abilityLevels['flanking']=2`、`upgradeCardByAbilityId['flanking'].cardId='upgrade-zhanshujia-flanking-2'`、CP `5 -> 3`、手牌归 0；截图保留升级槽位写入后的真实状态 |
| `196-host-drum-movement-2-upgrade-card-before-play.png` | Host 在真实主阶段手牌区可见 `摇鼓运动 II`，且 `drum-movement` 基础槽位尚未挂载升级牌；截图保留该升级牌的真实手牌入口证据 |
| `197-host-drum-movement-2-upgrade-card-applied.png` | Host 打出 `摇鼓运动 II` 后，服务器断言 `abilityLevels['drum-movement']=2`、`upgradeCardByAbilityId['drum-movement'].cardId='upgrade-zhanshujia-drum-movement-2'`、CP `5 -> 3`、手牌归 0；截图保留升级槽位写入后的真实状态 |
| `198-host-carpet-bombing-2-upgrade-card-before-play.png` | Host 在真实主阶段手牌区可见 `地毯式轰炸 II`，且 `carpet-bombing` 基础槽位尚未挂载升级牌；截图保留该升级牌的真实手牌入口证据 |
| `199-host-carpet-bombing-2-upgrade-card-applied.png` | Host 打出 `地毯式轰炸 II` 后，服务器断言 `abilityLevels['carpet-bombing']=2`、`upgradeCardByAbilityId['carpet-bombing'].cardId='upgrade-zhanshujia-carpet-bombing-2'`、CP `5 -> 3`、手牌归 0；截图保留升级槽位写入后的真实状态 |
| `200-host-sabre-thrust-2-upgrade-card-before-play.png` | Host 在真实主阶段手牌区可见 `军刀突刺 II`，且 `sabre-thrust` 基础槽位尚未挂载升级牌；截图保留该升级牌的真实手牌入口证据 |
| `201-host-sabre-thrust-2-upgrade-card-applied.png` | Host 打出 `军刀突刺 II` 后，服务器断言 `abilityLevels['sabre-thrust']=2`、`upgradeCardByAbilityId['sabre-thrust'].cardId='upgrade-zhanshujia-sabre-thrust-2'`、CP `5 -> 4`、手牌归 0；截图保留升级槽位写入后的真实状态 |
| `87-host-strategic-shift-2-applied.png` | Host 选择 `4 个勋章` 主分支并推进后，服务器断言 `Host 战术优势=5 / Guest bind=1 / Guest HP=45`；截图保留主分支 `grantToken + bind + 5 点不可防御伤害` 的真实收口状态 |
| `88-host-drum-movement-2-entry.png` | Host 在 `3 军刀 + 2 勋章` 盘面下，`lotus` 槽位可点击，且解析落点为 `data-resolved-ability-id="drum-movement-2-main"`；截图保留摇鼓运动 II 主分支的真实玩家板入口证据 |
| `89-guest-drum-movement-2-defense-entry.png` | Host 推进后，Guest 自然进入 `still-wet-behind-ears` 防御阶段；截图保留摇鼓运动 II 不是 direct injection，而是由真实玩家板攻击链打开的防御窗口 |
| `90-host-drum-movement-2-applied.png` | 把 Guest 防御骰固定成全战利品面并推进后，服务器断言 `Host 战术优势=1 / Guest bind=1 / Guest HP=43`；截图保留主分支 `grantToken + bind + 7 damage` 的真实收口状态 |
| `210-host-drum-movement-2-indirect-entry.png` | Host 在另一组 `3 军刀 + 1 旗帜 + 1 勋章` 盘面下，`lotus` 槽位可点击，且当前解析落点直接为 `data-resolved-ability-id="drum-movement-2-indirect"`；截图保留间接接敌分支的真实玩家板入口证据 |
| `211-host-drum-movement-2-indirect-choice.png` | Host 点击 `lotus` 槽位后，真实攻击链已创建为 `pendingAttack.sourceAbilityId='drum-movement-2-indirect'`，推进按钮可用；截图保留该次级分支不是机制层伪调用，而是已进入正式攻击结算链的中间状态 |
| `212-host-drum-movement-2-indirect-applied.png` | Host 选择 `摇鼓运动 II（间接接敌）` 后，服务器断言 `Host 战术优势=2 / Guest HP=48 / Guest bind=0`；截图保留“获得 2 战术优势并造成 2 点不可防御伤害”的真实收口状态 |
| `213-host-expand-battlefield-2-lockdown-entry.png` | Host 在另一组 `[1,4,4,5,6]` 盘面下，`lightning` 槽位可点击，且当前解析落点直接为 `data-resolved-ability-id="expand-battlefield-2-lockdown"`；截图保留全面封锁分支的真实玩家板入口证据 |
| `214-host-expand-battlefield-2-lockdown-choice.png` | Host 点击 `lightning` 槽位后，真实攻击链已创建为 `pendingAttack.sourceAbilityId='expand-battlefield-2-lockdown'`，推进按钮可用；截图保留该次级分支不是机制层伪调用，而是已进入正式攻击结算链的中间状态 |
| `215-host-expand-battlefield-2-lockdown-applied.png` | Host 选择 `开拓战场 II（全面封锁）` 后，服务器断言 `Host hand=2 / Guest HP=50 / Guest bind=1`；截图保留“抽 2 并施加紧缚、不造成伤害”的真实收口状态 |
| `74-guest-weigh-anchor-bonus-die-skull.png` | Guest 从真实手牌打出起锚后，定向 run 命中骷髅分支并进入奖励骰覆盖层；截图保留该对象真实入口的奖励骰展示证据 |
| `75-host-weigh-anchor-parley-applied.png` | 关闭覆盖层后，服务器断言 Host 获得 `休战 1`，且 `card-cursed-pirate-weigh-anchor` 已进入 Guest 弃牌堆；截图保留骷髅分支对目标施加休战后的棋盘状态 |
| `143-guest-weigh-anchor-bonus-die-draw.png` | Guest 从真实手牌打出起锚后，定向 run 命中非骷髅默认分支并进入奖励骰覆盖层；截图保留该对象默认抽牌分支的奖励骰展示证据 |
| `144-guest-weigh-anchor-draw-applied.png` | 关闭覆盖层后，服务器断言 Guest 手牌变为 `送你们去喂鱼`、`card-cursed-pirate-weigh-anchor` 已进入弃牌堆，且 Host 不获得 `休战`；截图保留默认抽牌分支的真实收口状态 |
| `145-guest-curse-card-draw1-choice.png` | Guest 从真实手牌打出诅咒卡牌后，界面进入三选一选择窗；截图保留“抽 1 张牌”分支按钮与真实入口证据 |
| `146-guest-curse-card-draw1-applied.png` | Guest 选择“抽 1 张牌”后，服务器断言 HP 保持 `50`、手牌变为 `送你们去喂鱼`，且 `card-cursed-pirate-curse-card` 已进入弃牌堆；截图保留该分支真实收口状态 |
| `147-guest-curse-card-damage2draw2-choice.png` | Guest 从真实手牌打出诅咒卡牌后，界面进入三选一选择窗；截图保留“受到 2 点伤害并抽 2 张牌”分支按钮与真实入口证据 |
| `148-guest-curse-card-damage2draw2-applied.png` | Guest 选择“受到 2 点伤害并抽 2 张牌”后，服务器断言 HP 变为 `48`、手牌变为 `送你们去喂鱼 / 瞭望台`，且 `card-cursed-pirate-curse-card` 已进入弃牌堆；截图保留该分支真实收口状态 |
| `95-guest-bluster-bonus-die-cutlass.png` | Guest 从真实手牌打出 `虚张声势！` 后，定向 run 命中弯刀分支并进入奖励骰覆盖层；截图保留该对象真实入口的奖励骰展示证据 |
| `96-host-bluster-cutlass-applied.png` | 关闭覆盖层后，服务器断言 Host HP 从 `50 -> 48`，且 `card-cursed-pirate-bluster` 已进入 Guest 弃牌堆；截图保留弯刀分支 2 点伤害收口后的棋盘状态 |
| `149-guest-bluster-bonus-die-loot.png` | Guest 从真实手牌打出 `虚张声势！` 后，定向 run 命中战利品分支并进入奖励骰覆盖层；截图保留该对象战利品分支的真实入口证据 |
| `150-guest-bluster-loot-applied.png` | 关闭覆盖层后，服务器断言 Guest 手牌变为预置的 2 张真实抽牌、Host HP 仍为 `50`，且 `card-cursed-pirate-bluster` 已进入 Guest 弃牌堆；截图保留战利品分支抽 2 的真实收口状态 |
| `151-guest-bluster-bonus-die-skull.png` | Guest 从真实手牌打出 `虚张声势！` 后，定向 run 命中骷髅分支并进入奖励骰覆盖层；截图保留该对象骷髅分支的真实入口证据 |
| `152-host-bluster-skull-applied.png` | 关闭覆盖层后，服务器断言 Host 获得 `火药桶 1`、Host HP 仍为 `50`、Guest 手牌清空且源卡进入弃牌堆；截图保留骷髅分支施加火药桶后的真实收口状态 |
| `153-guest-scurvy-before-play.png` | Guest 在真实主阶段手牌区可见 `坏血病！`；截图保留该对象的真实手牌入口证据 |
| `154-guest-scurvy-applied.png` | Guest 打出 `坏血病！` 后，服务器断言 `Guest HP 50 -> 49 / Host wither 1`，且源卡进入弃牌堆；截图保留自伤 + 凋零的真实收口状态 |
| `155-guest-pillage-before-play.png` | Guest 在真实主阶段手牌区可见 `强取豪夺！`；截图保留该对象的真实手牌入口证据 |
| `156-guest-pillage-applied.png` | Guest 打出 `强取豪夺！` 后，服务器断言 `Guest CP 5 -> 6 / Host CP 5 -> 4`，且源卡进入弃牌堆；截图保留偷取 CP 链的真实收口状态 |
| `157-guest-parley-before-play.png` | Guest 在真实主阶段手牌区可见 `停战协议！`；截图保留该对象的真实手牌入口证据 |
| `158-guest-parley-applied.png` | Guest 打出 `停战协议！` 后，服务器断言 Host 获得 `休战 1`，且源卡进入弃牌堆；截图保留单目标施加休战的真实收口状态 |
| `210-guest-pirates-life-cursed-before-play.png` | Guest 在咒缚面真实主阶段手牌区可见 `海盗的一生！`；截图保留咒缚面治疗分支的真实手牌入口证据 |
| `211-guest-pirates-life-cursed-applied.png` | Guest 在咒缚面打出 `海盗的一生！` 后，服务器断言 `HP 45 -> 48 / 诅咒金币保持 1`，且没有弹出“获得诅咒金币”选择窗；截图保留治疗 3 分支的真实收口状态 |
| `212-guest-pirates-life-normal-before-play.png` | Guest 在 `human/normal` 面真实主阶段手牌区可见 `海盗的一生！`；截图保留普通面诅咒金币分支的真实手牌入口证据 |
| `213-guest-pirates-life-normal-choice.png` | Guest 在 `human/normal` 面打出 `海盗的一生！` 后，界面进入“是否获得诅咒金币？”选择窗；截图保留普通面分支真实选择入口 |
| `214-guest-pirates-life-normal-applied.png` | Guest 在 `human/normal` 面接受诅咒金币后，服务器断言 `诅咒金币 1 -> 2` 且源卡进入弃牌堆；截图保留普通面分支的真实收口状态 |
| `174-guest-parley-block-before-attack.png` | Guest 在真实咒缚面 `fist` 槽位可点击 `灵魂突刺`，且自身已带 `休战 1`；截图保留“带状态的真实攻击入口”证据 |
| `175-host-parley-block-defense-entry.png` | Guest 点击后真实进入 Host 防御阶段；截图保留 `休战` 不会阻断攻击链建立、而只会影响最终伤害收口的中间态证据 |
| `176-host-parley-block-cleared.png` | 攻击收口后服务器断言 `Host HP 50 / Guest HP 50 / Guest parley 0 / Host powderKeg 1`；截图保留 `休战` 令攻击伤害归零并在阶段结束清理的真实消费链 |
| `97-guest-shark-bait-attack-entry.png` | Guest 真实在玩家板 `soul-stab-3` 槽位建立攻击链；截图保留 `诱饵` 不是 direct injection，而是接在真实攻击入口后的证据 |
| `98-guest-shark-bait-modifier-active.png` | Guest 从真实手牌打出 `诱饵` 后，攻击修正徽标真实出现；截图保留该对象真实入口的攻击修正中间态证据 |
| `99-host-shark-bait-attack-damage-applied.png` | `诱饵` 打出后服务器断言仍处于 `offensiveRoll`，同时 `Host HP 50 -> 48 / Guest CP 5 -> 4 / 源卡进入弃牌堆`；截图保留这条即时 2 点攻击伤害的真实收口状态 |

## 未完成门禁

## L4 共享链判等矩阵（2026-06-06）

| 对象/家族 | 共享链/代表对象 | 是否满足“仅配置不同” | 当前判等依据 | 仍缺什么 |
| --- | --- | --- | --- | --- |
| 战术家基础进攻参数链：`包夹侧翼 / 摇鼓运动 / 开拓战场 / 战略转移` | 代表对象为各自对象自身截图链 | 是 | 截图 163-173 已分别锁定 `calm / lotus / lightning / combo` 四个基础槽位的真实入口、Guest 自然进入防御阶段与最终 `战术优势 / 紧缚 / HP` 收口；这 4 条基础对象已不再依赖 `制胜高地 / 战术优势 / 伴装撤退 / 亡灵之爪` 的跨对象共享链外推 | 已从当前 remaining shared-only blocker 中移出；后续只剩批次级 L4 / 双面总审计 |
| 战术家升级进攻链：`军刀突刺 II / 摇鼓运动 II / 开拓战场 II / 战略转移 II / 地毯式轰炸 II / 包夹侧翼 II` | 代表对象为各自基础版或同对象主分支截图链 | 部分满足 | `军刀突刺 II / 包夹侧翼 II` 现在可按“同 trigger family + 同攻击收口 + 仅伤害/战术优势参数差异”视为近似同构；`摇鼓运动 II / 战略转移 II / 开拓战场 II` 的次级分支现已补到对象级真实入口，不再是“分支是否实现未知”；但 `地毯式轰炸 II` 旗帜分支本身就是即时抽牌分支，`战略转移 II / 开拓战场 II / 摇鼓运动 II` 也都新增了不能被基础版覆盖的 secondary variant，因此整条升级链仍不能整体外推成“只差配置” | 主分支与三条次级分支都已到对象级 L3；当前剩余已收紧为升级/变体 family 的 `L4` 合法复用登记 |
| 战术家防御/响应链：`反制措施 II/III / 脱战 / 伴装撤退 / 紧缚` | 代表对象为 `反制措施`、`脱战`、`伴装撤退`、`紧缚` 自身真实入口 | 部分满足 | `反制措施 II/III` 现已具备各自升级后真实防御入口，可按同 defensive slot + 同 `customActionId` + 仅 `sabrePairDamage` 参数差异判定为近似同构；但 `脱战` 奖励骰三分支、`伴装撤退` 直接施加紧缚、`紧缚` 额外投掷时序清理并非同一家族 | `反制措施 II/III` 当前剩余仅回到 shared defensive family 的 `L4` 判等；其余对象应按独立对象保留，不宜再合并成一个“防御家族已收口”口径 |
| 战术家奖励骰/随机家族：`作战室 / 占得上风 / 战争贩子 / 战争贩子 II / 脱战` | 代表对象散落在主阶段手牌、玩家板与防御响应 | 否 | 虽都打开单骰奖励骰覆盖层，但后续消费者已分叉到 `TOKEN_GRANTED(ceil(d6/2))`、`drawCard/defaultEffect`、`bonusDamage`、`EXTRA_ATTACK_TRIGGERED`、`grantDamageShield` 与 `grantToken(PROTECT)`；当前只能确认“奖励骰 overlay 能正常打开/关闭与收口”早已不是 blocker | 仍需按战术家内部子 family 维护合法复用边界，不能整体按“同是 rollDie/bonus overlay”外推 |
| 咒缚海盗状态家族：`诅咒金币 / 火药桶 / 凋零 / 休战` | 代表对象来自 `无情诅咒 / 起锚 / 深海潜行 / 啜呼 / upkeep` 等不同入口 | 否 | 虽然共享 `grantStatus` / `flowHooks` / 伤害修正消费者已被证明可用，但这些状态来自不同入口、不同时机、不同后续清理，不能仅凭“都能写入状态”就互相外推到对象级完成 | 仍需继续把“对象写入状态”和“状态本体完整生命周期”分开审，必要时补更多对象级或时序级证据 |
| 咒缚海盗双面总审计：`human` 9 个对象 + 咒缚面 9 个对象 | 代表对象为双面 `18 / 18` 面板对象级直证矩阵 | 部分满足 | `human` 与咒缚面两套玩家板对象现在都已有 `9 / 9` 对象级 L3 直证，双面“面板对象仍缺首条 direct E2E”的旧口径已失效；专属手牌也已按 `cards.ts` 全集收敛到 `16 / 16` 对象级证据。当前真正未统一升到最终 completion audit 的，是状态家族、奖励骰 family、通用牌索引与双面合法复用登记 | 仍需 face-by-face completion audit，但当前剩余已从“面板对象或专属手牌是否直证”收窄为“更高层 L4 / 家族级合法复用 / 最终收口” |
| 咒缚海盗奖励骰/随机家族：`起锚 / 瞭望台 / 虚张声势 / 干票大的 / 死亡印记 / 抽筋剥皮 / 啜呼` | 代表对象散落在多张手牌和多个面板技能 | 否 | 虽都经过 `rollDie` 或奖励骰覆盖层，但后续消费者有抽牌、伤害、状态、对手选择与随机弃牌等显著差异，不能整体按“同是奖励骰”复用 L4 | 当前只能逐对象说明哪些分支已拿到直证；整家族还不能宣称“只差配置” |

### 2026-06-06 状态家族 completion 边界

| 状态 | 当前已锁定的生命周期证据 | 当前已拿到对象级真实写入证据的入口 | 当前仍未收口的边界 |
| --- | --- | --- | --- |
| `诅咒金币` | 上限 `self=5 / others=3`、不可移除/转移、海盗可拒绝获得、非海盗维持掉血，均已有 `L2` + upkeep 真实链 | `做好标记`、`判决指令`、`惊魂动魄`、`无情劫掠`、`死亡印记`、`你还嫩了点`、`亡灵之爪` 已分别证明会在真实入口下写入/消费诅咒金币 | 仍缺的是“所有写入者都可合法复用同一状态生命周期 `L4`”的登记，而不是状态未实现 |
| `火药桶` | 维持投骰、`1-2` 爆炸、`3-5` 保留、`6` 转交、重复获得时原桶爆炸，已有 `L2` + upkeep 真实链 | `灵魂突刺`、`弯刀突刺`、`点燃炸药`、`灵魂指令`、`无情诅咒`、`送你们去喂鱼`、`分点给我`、`虚张声势(骷髅)`、`抽筋剥皮` 已证明真实写入 | 仍缺跨入口的时序/转交/重复获得 family 级 `L4` 复用登记，不能因为多个入口都写入过就当作整家族收口 |
| `凋零` | 只减攻击伤害、不减 direct damage，来源侧伤害修正消费者已有 `L2` 合同，且 `灵魂突刺 / 死亡吐息` 已各补 1 条真实攻击减伤消费链 | `深海潜行`、`啜呼`、`灵魂指令`、`死亡吐息` 已证明真实写入；`灵魂突刺 / 死亡吐息` 已证明真实消费时会分别把攻击伤害从 `5 -> 4`、`7 -> 6` | 仍缺“所有写入入口 + family 级合法复用登记”放在同一 completion audit 的最终封版，当前还不能把写入入口与消费入口整体外推成整家族全绿 |
| `休战` | 阻止攻击伤害、不阻止 direct damage、`offensiveRoll -> main2` 清理，已有 `L2` 合同，且 `cutlass-stab-4 / 死亡吐息` 已各补 1 条真实攻击阻断消费链 | `灵魂指令`、`无情诅咒`、`判决指令`、`无情劫掠`、`起锚(骷髅)`、手牌 `休战` 已证明真实写入；`cutlass-stab-4 / 死亡吐息` 已证明真实消费时会让攻击伤害归零并在阶段结束清理 | 仍缺“所有写入入口 + family 级合法复用登记”汇总成统一生命周期 verdict，当前不能把整家族直接升成 completion audit 已完成 |
| `紧缚` / `锁定` | `紧缚` 的额外投掷 `1CP` 门禁与阶段清理、`锁定` 的状态写入 helper 以及多人局 `selectPlayer(敌方)` 目标合同均已有 `L2` 合同 | `战术优势`、`制胜高地`、`军刀突刺 II`、`摇鼓运动`、`开拓战场`、`伴装撤退` 已证明真实写入或真实消费，其中 `战术优势 -> 锁定` 已补被动按钮真实入口截图 `202-203` | 仍缺战术家共享参数链/防御响应链对 `紧缚 / 锁定` 的更高层 `L4` 判等，不再是状态本体未落地 |

### 2026-06-06 咒缚海盗状态家族 L4 seam 矩阵

| 状态 | 当前可确认的写入 seam | 当前可确认的共享消费者/清理点 | 当前可以合法复用的边界 | 当前仍不能外推的差异 |
| --- | --- | --- | --- | --- |
| `诅咒金币` | A. 直接 `grantStatus -> buildStatusAppliedOrChoiceEvents(...)`：`做好标记 / 死亡印记 / 你还嫩了点 / 无情诅咒`；B. `HUMAN_VERDICT_COMMAND_CHOICE_ID / HUMAN_MERCILESS_PLUNDER_CHOICE_ID` 这类“先选择是否获得，再 continuation”自得金币链；C. `海盗的一生` 普通面与 `惊魂动魄` 的 self 选择/移除链 | `rules.ts:getTokenStackLimit(...)` 区分海盗 `5` 层、其他角色 `3` 层；`statusEvents.ts` 为海盗本人创建 accept/decline choice；`flowHooks.ts` 只让非海盗持有者在 upkeep 掉血；`customActions/cursed_pirate.ts` 还额外消费在 `human-cursed` 回合结束移除、`亡灵之爪` 按层直伤、`惊魂动魄` 选择移除 | 只能把“获得金币时会经过 stack limit + 海盗可拒绝获得”登记为同一写入 seam；`做好标记 / 死亡印记 / 你还嫩了点 / 无情诅咒` 这些 direct writer 可以共用这一层判断 | 不能把“金币能写入”直接外推成 `human-cursed` 的回合结束移除、`亡灵之爪` 的按层直伤、或 `惊魂动魄` 的任意数量移除也已同构；这些是不同后续消费 seam |
| `火药桶` | A. 直接 `grantStatus -> buildStatusAppliedOrChoiceEvents(...)`：`点燃炸药 / 灵魂指令 / 给我点上 / 虚张声势(骷髅)`；B. 阈值类 custom action：`灵魂突刺 / 弯刀突刺 / 抽筋剥皮`；C. 多目标 `choiceResolved`：`无情诅咒 / 送你们去喂鱼`；D. `啜呼` 的“直接获得”或“投骰命中后获得”；E. `flowHooks.ts` 里 `cursed` 被动的“对手没发起攻击则施桶” | `statusEvents.ts` 负责“重复获得时先爆炸旧桶再保留新桶”；`flowHooks.ts` 负责 upkeep 投骰、`1-2` 爆炸、`3-5` 保留、`6` 打开转交 choice；`POWDER_KEG_TRANSFER_CHOICE_ID` 负责从原持有者移除并对目标重新施加 | 所有最终落到 `buildStatusAppliedOrChoiceEvents(...)` 的写入者，可以合法共用“重复获得即爆炸/保留新桶”这层 L4；而 upkeep 的爆炸/转交链也可以被单独视为另一条共享生命周期 seam | 不能把“某入口能施加火药桶”直接外推成“该入口已证明转交/重复获得/被动未攻击施桶也同构”；写入 seam 与 upkeep/transfer seam 必须分开登记 |
| `凋零` | A. 直接 `grantStatus` writer：`深海潜行 / 死亡吐息 / 灵魂指令 / 无情诅咒 / 坏血病`；B. `啜呼` 的 `SIP_CHOICE_ID` 命中 `3-6` 后，经 `choiceResolved` 写入 | 真正消费不在咒缚海盗 custom action，而在 `heroes/cursed_pirate/tokens.ts` 的 `passiveTrigger(onDamageDealt, damageTriggerScope='opponentAttackDamage', modifyStat=-1)`，并由 `DamageCalculation.collectSourceStatusModifiers` 在攻击伤害链里统一读取；`__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` 已证明 direct damage 不受影响 | 所有写入者都能合法复用同一个“来源侧攻击伤害 -1/层，direct damage 不减”的消费 seam；`深海潜行 / 死亡吐息 / 灵魂指令 / 啜呼 / 坏血病` 的差异主要还在入口与附带效果，不在 `凋零` 本体消费者 | 仍不能把“任一写入者已命中凋零”直接外推成所有攻击来源都完成了真实消费链；当前真实消费 L3 已补到 `灵魂突刺 + 死亡吐息` 两条攻击链，其余攻击来源仍属 family 级 completion audit |
| `休战` | A. 直接 `grantStatus` writer：`灵魂指令 / 无情诅咒 / 停战协议 / 起锚(骷髅)`；B. `HUMAN_VERDICT_COMMAND_CHOICE_ID / HUMAN_MERCILESS_PLUNDER_CHOICE_ID` 这类先 continuation 再写状态的 human 面链 | `effects.ts` 会在生成 attack damage action 时直接跳过；`reduceCombat.ts` 又对真实落地的 `DAMAGE_DEALT(damageScope='attack')` 做二次兜底拦截；`flowHooks.ts` 在 `offensiveRoll` 收口与“无 pendingAttack 的进攻阶段退出”两条 seam 清理 `PARLEY` | 所有 writer 可以共用“攻击伤害被阻止 + 阶段结束清理”这一组共享消费者；本轮已确认它不是某张牌的局部逻辑，而是 `effects.ts + reduceCombat.ts + flowHooks.ts` 的多消费者合同 | 仍不能把“写入休战”直接外推成所有攻击来源都补齐了真实消费链；当前真实消费 L3 已补到 `cutlass-stab-4 + 死亡吐息` 两条攻击链，其余攻击来源仍只到 shared lifecycle 判等 |

### 2026-06-06 咒缚海盗状态 family 最终 verdict

| 状态 | 当前实现判断 | 当前仍需 completion audit 的真实原因 | 当前不得再写的误报 |
| --- | --- | --- | --- |
| `诅咒金币` | `rules.ts + statusEvents.ts + flowHooks.ts + customActions/cursed_pirate.ts` 已共同形成完整生命周期：海盗 `5` 层 / 其他 `3` 层、海盗可拒绝获得、非海盗 upkeep 掉血、`human-cursed` 回合结束移除、`亡灵之爪 / 惊魂动魄 / 海盗的一生` 等后续消费都已有明确 seam；human continuation writer 也已同时锁定 accept / decline 两条路径 | 剩余是把 direct writer、continuation writer、self remove 与后续 consumer 的合法复用边界封成 family verdict，而不是状态本体没实施 | 不得再写成“诅咒金币还只是显示层”“海盗可拒绝获得未落地”或“没有真实消费者” |
| `火药桶` | `statusEvents.ts` 的重复获得即爆炸、`flowHooks.ts` 的 upkeep 投骰/爆炸/转交、`customActions/cursed_pirate.ts` 的 threshold/choice/no-attack writer 已共同证明本体生命周期已实施；`upkeep transfer -> 目标已持有者` 也已在机制层直接锁定 | 剩余是 direct grant、阈值写入、多目标 choice、upkeep transfer、被动未攻击施桶这些 writer seam 的 family 级封版，不是“转交链没实现” | 不得再写成“火药桶只会被施加，不会转交/重复爆炸”或“被动施桶仍待实现” |
| `凋零` | `tokens.ts` 的 `passiveTrigger(onDamageDealt, opponentAttackDamage, modifyStat=-1)` 与伤害计算消费链已经就位，`direct damage` 不受影响的合同也已明确 | 剩余是更多来源侧真实攻击消费者要不要继续补证并纳入 family verdict；当前问题是审计覆盖度，不是 `WITHER` 消费者缺失 | 不得再写成“凋零只写得到状态栏，不会真实减攻击伤害” |
| `休战` | `effects.ts` 的攻击伤害前置跳过、`reduceCombat.ts` 的 `DAMAGE_DEALT(damageScope='attack')` 兜底、`flowHooks.ts` 的阶段结束清理，已经共同构成完整 consumer seam | 剩余是更多攻击来源的真实消费链是否还要补到对象级；当前问题是 family 封版，而不是“休战不会真实阻断攻击伤害” | 不得再写成“休战只会写入，不会消费”或“阶段结束不会清理” |

### 2026-06-06 战术家升级链 L4 seam 矩阵

| 子 family | 当前可确认的写入/替换 seam | 当前可确认的共享消费者/收口 | 当前可以合法复用的边界 | 当前仍不能外推的差异 |
| --- | --- | --- | --- | --- |
| `9 张升级牌（upgrade-zhanshujia-*）` | `cards.ts` 全部经 `replaceAbility(targetAbilityId, newAbilityDef, newAbilityLevel)` immediate 写入同一升级壳；真实入口已证明 9 张牌都能从手牌打出并写入 `upgradeCardByAbilityId` | 共享的只是“主阶段打牌 -> 扣 CP -> 离手 -> 升级槽写入 -> abilityLevel 更新”这层壳 | 可以把“升级牌壳已完整接线”登记为同一 L4，不再需要把“能不能写到升级槽”逐张重审 | 不能把“升级牌壳一致”外推成“被替换后的 ability / variant 也只差配置”；真正语义仍取决于 replacement ability 自身 |
| `反制措施 II / III` | 同一 `countermeasures` 基础 id 被替换；effects 都指向 `zhanshujia-countermeasures-defense`，只改 `diceCount=5` 与 `params.sabrePairDamage=1/2` | 共享同一 `defensiveRoll` 入口与同一 customAction；收口始终是 `DAMAGE_DEALT(direct) + PREVENT_DAMAGE + TOKEN_GRANTED` | 可把 II/III 视作同一 defensive 参数 family；当前剩余只回到 family 级 L4，而不是两张升级牌是否已实施 | 不能再外推到 `脱战 / 伴装撤退 / 紧缚`，它们虽也在防御窗口出现，但不是同 customAction / 同消费者 |
| `包夹侧翼 II` | 替换 `flanking` 后仍是 `smallStraight -> grantToken + damage`，没有引入新 customAction 或变体 modal | 同攻击链、同 damage consumer，仅 `战术优势 1 -> 2` | 可与基础 `包夹侧翼` 按“同 trigger + 同收口，仅 token 参数不同”登记为近似同构 | 不能外推到 `摇鼓运动 II / 开拓战场 II / 战略转移 II`，后者都新增了基础版没有的 bind / variant / unblockable 差异 |
| `军刀突刺 II` | 替换 `sabre-thrust` 后，3/4/5 军刀 variants 都统一先走 `zhanshujia-bind-if-three-kind`，再进入攻击伤害结算 | 共享同一 `diceSet sabre` trigger family、同一 `bind-if-three-kind` customAction 与同一攻击 damage consumer；差异只在伤害 `5/6/7` | `sabre-thrust-2-3/4/5` 可以共用一条“升级后会先判三同值紧缚，再结算伤害”的 family 结论 | 不能把它再简化成“只比基础版多 1 伤害”；新增的 `bind-if-three-kind` seam 让它与基础 `军刀突刺` 不再完全同构 |
| `战略转移 II / 摇鼓运动 II / 开拓战场 II` | 三者都通过单张 upgrade card 替换基础 id，但 replacement ability 内各自含 `variants`；真实入口先过同对象槽位/变体 modal，再进入各自分支收口 | 每个对象内部的主分支与次级分支都已拿到对象级直证；`strategic-shift-2-main` 与 `drum-movement-2-indirect` 还显式依赖 `tags:['unblockable']`，`expand-battlefield-2-lockdown` 则变成 `draw 2 + bind` 即时链 | 可以把“三张复合升级牌的 secondary variant 都已真实进入并能收口”登记为同一 upgrade-variant family 的完成事实 | 不能把三者整体外推成“都是基础版 + 一个子区”；每张牌 secondary variant 的 trigger、是否建 `pendingAttack`、以及后续消费者都不同，仍需按对象内 family 维护 |
| `地毯式轰炸 II` | 替换 `carpet-bombing` 后 split 成 `carpet-bombing-2-main` 与 `carpet-bombing-2-strategy` 两条分支 | 主分支继续走 `zhanshujia-carpet-bombing-targets -> selectPlayer(2 敌人) -> target-damage`；旗帜分支则直接 `grantToken + drawCards` 即时收口 | 只能把“两个分支都已对象级实现”登记为 upgrade dual-family 已打通 | 不能把旗帜分支当成主分支的纯参数升级，也不能直接并入前述三张复合升级牌，因为它的 secondary branch 完全不建立攻击链 |
| `战争贩子 II` | 虽也通过 `replaceAbility('war-monger', WAR_MONGER_2, 2)` 接入，但 replacement ability 不再走基础版的通用 `rollDie conditionalEffects + postDamage extraRoll`，而是直接进入 `zhanshujia-war-monger-2-roll` | 消费者全部落在 `resolveWarMonger2Roll`：刀=`6` 伤害，旗=`+3` 战术优势，勋章=`抽 1 + EXTRA_ATTACK_TRIGGERED`，最后统一 `createDisplayOnlySettlement` | 可以把“II 的三个结果与勋章专门链都由同一 customAction 收口”登记为对象内 family 结论 | 不能把它与基础 `战争贩子` 当作同一 `rollDie` family 直接复用；II 的 consumer seam 已经整体换掉 |

### 2026-06-06 战术家奖励骰/随机 L4 seam 矩阵

| 对象/子 family | 当前可确认的触发/展示 seam | 当前可确认的共享消费者/收口 | 当前可以合法复用的边界 | 当前仍不能外推的差异 |
| --- | --- | --- | --- | --- |
| `作战室 / 占得上风` | 都是主阶段手牌单骰奖励，真实入口都会进入奖励骰覆盖层，且都不会创建 `pendingAttack` | `作战室` 经 `zhanshujia-war-room-roll` 生成 `BONUS_DIE_ROLLED -> TOKEN_GRANTED(ceil(d6/2)) -> displayOnlySettlement`；`占得上风` 则经通用 `rollDie` 在勋章时 `grantToken(4)`、否则 `drawCard(1)` | 只能把“主阶段单骰奖励牌会打开/关闭 bonus overlay 并立即收口、不进入攻击链”视为同一 L4 壳 | 不能把 `ceil(d6/2)` 的战术优势公式外推到 `占得上风`，也不能把 `default draw 1` 外推回 `作战室` |
| `战争贩子` | 玩家板 `sky` 槽位触发后走 `zhanshujia-war-monger-roll` 奖励骰链 | 三个分支分别落到 `pendingAttack.damage=5` 并由 `withDamage` 攻击伤害结算、`战术优势 +4`、`draw 1 + EXTRA_ATTACK_TRIGGERED`；只有勋章分支额外进攻 | 可以把“基础版 war-monger 的奖励骰 overlay 与三分支消费已接线”登记为对象内 L4 候选 | 不能再把基础版额外进攻登记为统一 postDamage seam，也不能把勋章额外进攻外推到军刀/旗帜 |
| `战争贩子 II` | 玩家板同一 `sky` 槽位，但奖励骰已整体改走 `zhanshujia-war-monger-2-roll` customAction；真实入口已锁定 overlay 与勋章专门链 | customAction 内三分支分别是 `6 伤害 / +3 战术优势 / 抽 1 + EXTRA_ATTACK_TRIGGERED`，最后统一 `createDisplayOnlySettlement` | 可以把“II 的三个结果都由同一 customAction + displayOnlySettlement 收口”视为对象内 L4 | 不能把 II 直接外推回基础版，也不能把“勋章会进额外攻击”外推成刀/旗也共享同一额外阶段 |
| `脱战` | 真实防御窗口中的单骰奖励骰覆盖层；不会回到主阶段，也不会进入额外进攻 | 三分支分别落到 `bonusDamage 2 / grantDamageShield 3 / grantToken(PROTECT)`，都在 defense response 内即时收口 | 可以把“防御响应单骰奖励牌已打通三类消费者”登记为对象内 L4 | 不能把它和 `作战室 / 占得上风` 或 `战争贩子` 家族合并，因为 phase、目标与消费者都不同 |
| 战术家奖励骰总口径 | family 级未收口 | 可以确认“战术家单骰奖励对象的 overlay 打开/关闭与基本收口”早已不是 blocker | 真正未收口的是：哪几类消费者可以按同一主阶段/防御/额外进攻 family 合法复用，哪几类仍需独立保留 |

### 2026-06-06 战术家升级 family 最终 verdict

| 子 family | 当前实现判断 | 当前仍需 completion audit 的真实原因 | 当前不得再写的误报 |
| --- | --- | --- | --- |
| 升级牌壳（`9` 张 upgrade） | `cards.ts -> replaceAbility -> ABILITY_REPLACED / abilityLevels / upgradeCardByAbilityId` 的共享升级壳已经成型，mechanics 与 E2E 都证明 `9 / 9` 升级牌能真实打出并写入升级槽 | 剩余是“升级后 replacement ability 的 family 差异如何封版”，不是升级牌还没接线 | 不得再写成“某些升级牌仍只是卡面录入”“升级写入能力槽未落地” |
| 防御升级 family（`反制措施 II / III`） | 同一 `zhanshujia-countermeasures-defense` customAction 已覆盖 `5` 骰、防伤、反击、战术优势三消费者，II/III 差异只剩 `sabrePairDamage` 参数 | 剩余是 II/III 与其他防御响应对象的 family 边界登记，不是升级防御逻辑缺实现 | 不得再写成“反制措施 II / III 还没真实进入防御链” |
| 进攻参数升级 family（`包夹侧翼 II / 军刀突刺 II`） | `包夹侧翼 II` 的 token 参数链与 `军刀突刺 II` 的 `bind-if-three-kind + damage` 链都已在 mechanics/E2E 中证明 | 剩余是“近似同构到什么程度”的 family 封版，而不是对象仍待实施 | 不得再写成“军刀突刺 II 只是基础版加 1 伤”“包夹侧翼 II 还缺真实入口” |
| 复合升级 family（`战略转移 II / 摇鼓运动 II / 开拓战场 II / 地毯式轰炸 II`） | 这些 replacement ability 的主分支与 secondary variant 都已能真实进入各自 modal / interaction / damage consumer | 剩余是不同 variant 是否能按同一复合升级 family 合法复用，而不是 secondary branch 仍未实现 | 不得再写成“这些升级牌只证明了主分支，副分支还没落地” |
| `战争贩子 II` | 升级后已不再走基础版 `postDamage extraRoll`，而是完整切到 `zhanshujia-war-monger-2-roll` customAction，并已证明勋章分支会进额外进攻 | 剩余是 II 与基础版奖励骰/额外进攻 family 的边界封版，不是 II 仍缺专门实现 | 不得再写成“战争贩子 II 只是基础版同壳”或“额外进攻仍未真实进入” |

### 2026-06-06 战术家奖励骰 family 最终 verdict

| 子 family | 当前实现判断 | 当前仍需 completion audit 的真实原因 | 当前不得再写的误报 |
| --- | --- | --- | --- |
| `作战室 / 占得上风` | 主阶段单骰奖励壳已稳定：overlay 打开/关闭、立即收口、且不建立攻击链 | 剩余是 `ceil(d6/2)` 战术优势、`grantToken(4)`、`draw 1` 这些 downstream consumer 如何分 family 留档，不是奖励骰 UI 或单骰派发没实现 | 不得再写成“作战室/占得上风仍缺奖励骰真实链” |
| `战争贩子` | 基础版奖励骰三分支已各自落地：军刀进入可防御攻击伤害，旗帜获得战术优势，勋章抽牌并触发额外进攻 | 剩余是它与 `战争贩子 II` 的分支消费者边界如何封版；当前问题是分层，不是未实施 | 不得再写成“战争贩子全分支额外进攻”或“基础版额外进攻来自统一 postDamage seam” |
| `战争贩子 II` | `zhanshujia-war-monger-2-roll` 已把刀/旗/勋章三分支与 `displayOnlySettlement` 统一收口，勋章专门链也有真实入口 | 剩余是 II 的三分支与基础版 family 的差异封版，不是 customAction 未完成 | 不得再写成“战争贩子 II 奖励骰只有 overlay，没有真实消费者” |
| `脱战` | 防御阶段单骰奖励壳已经证明能分叉到 `damage / shield / protect` 三类消费者 | 剩余是它与主阶段奖励骰对象之间的 phase 边界登记，不是对象本体缺实现 | 不得再写成“脱战奖励骰仍只停在展示层” |

### 2026-06-06 咒缚海盗奖励骰/随机家族 completion 边界

| 对象/子家族 | 当前直证层级 | 当前可确认的 completion 边界 | 当前仍未收口的边界 |
| --- | --- | --- | --- |
| `起锚 / 虚张声势 / 瞭望台` | 多分支对象级 `L3` + 机制负向 seam | 三者都已不是“只看到一条代表链”：`起锚` 已锁定骷髅与默认抽牌两分支，`虚张声势` 已锁定弯刀/战利品/骷髅三分支，`瞭望台` 已锁定弯刀查看手牌、战利品自选弃牌、骷髅随机弃牌三分支；并且 `起锚` 现在已有“骷髅只写休战 / 非骷髅只抽 1”、`虚张声势` 也已有“弯刀只伤害 / 战利品只抽牌 / 骷髅只写火药桶”、`瞭望台` 也已有“弯刀查看手牌确认后不弃牌”的机制级不串写断言 | 仍缺更高层 `L4` 的跨对象合法复用登记，但不再缺对象级分支直证 |
| `干票大的 / 死亡印记 / 抽筋剥皮 / 啜呼` | 对象级 `L3` + 局部机制负向 seam | 都已有真实入口奖励骰覆盖层与核心收口态，不再是“奖励骰 UI 没验证”或“对象仍只到 representative L3”；其中 `干票大的` 已锁定未命中 `loot` 时无收益，`死亡印记` 已锁定纯弯刀盘面不会串写 `draw / 诅咒金币`，`抽筋剥皮` 已锁定弯刀数不足 `3` 时不施加 `火药桶`，`啜呼` 已锁定 `1-2` 无事发生 | 它们的后续消费者分别落在抽牌/CP、伤害、状态、目标选择等不同 seam，当前仍不能整体按“同是奖励骰”复用 `L4` |
| 咒缚海盗奖励骰总口径 | family 级未收口 | 可以确认“咒缚海盗奖励骰对象的 overlay 打开/关闭”也早已不是 blocker | 真正未收口的是：同为 `rollDie` / bonus overlay 的对象，后续消费 seam 差异过大，仍需逐对象或逐子 family 维护合法复用边界 |

### 2026-06-06 咒缚海盗奖励骰/随机 L4 seam 矩阵

| 对象/子 family | 当前可确认的 overlay / dispatch seam | 当前可确认的后续消费者 | 当前可以合法复用的边界 | 当前仍不能外推的差异 |
| --- | --- | --- | --- | --- |
| `起锚` | `cards.ts` 直接走单骰 `rollDie`；只有 `skull` 命中状态分支，其他点数统一走 `defaultEffect` | `skull -> 休战`；非 `skull -> draw 1` | 只能把它登记为“单骰 overlay + status/default draw 二分派发”已实施；最新机制回归也已显式锁定骷髅分支不会误抽牌、默认分支不会误写 `休战` | 不能把它外推成 `干票大的` 的 `draw + CP`，也不能外推成 `瞭望台` 的目标交互或 `死亡印记` 的攻击期多骰消费者 |
| `虚张声势` | `cards.ts` 直接走单骰 `rollDie conditionalEffects` | `cutlass -> bonusDamage 2`、`loot -> draw 2`、`skull -> 火药桶` | 只能复用“单骰 overlay + 三分支即时收口”这一层壳；最新机制回归也已显式锁定三条分支不会串写到其它 consumer | 不能把 `bonusDamage / draw / powder_keg` 这三类结果视为与 `死亡印记` 或 `抽筋剥皮` 同构；phase 与后续 seam 都不同 |
| `瞭望台` | `customActions/cursed_pirate.ts:resolveCrowsNest(...)` 先 `createBonusDieEvents(...)`，再按单骰 face 分派到交互 | `cutlass -> 查看手牌确认 choice`、`loot -> 对手自选弃 1`、`skull -> 随机弃 1` | 只能复用“overlay 打开后再分派到手牌信息/弃牌交互”这一对象内壳；最新机制回归也已显式锁定弯刀查看手牌确认后不会误生成弃牌落点 | 不能把它与任何纯状态/纯伤害/纯抽牌奖励骰合并；它的主要消费者是 hand-view / discard 交互 |
| `干票大的` | `customActions/cursed_pirate.ts:resolveHefty(...)` 走双骰 display-only overlay，再判 `hasLoot` | 命中至少一个 `loot` 后统一 `draw 2 + CP +2`；否则只展示 overlay | 可以把它登记为“display-only 双骰 overlay + 聚合条件消费者”已实施 | 不能把它外推成 `起锚` 的 default draw，也不能把 `draw + CP` 外推到 `死亡印记 / 虚张声势` |
| `死亡印记` | 咒缚面技能内直接走 `4` 骰 `rollDie conditionalEffects`，属于攻击期 preDefense 奖励骰 | `cutlass -> 2 点不可防御伤害`、`loot -> draw 1`、`skull -> 诅咒金币` | 只能复用“攻击期多骰 overlay + 每颗骰子的独立分支派发”这一层；最新机制回归也已显式锁定纯弯刀盘面不会串写 `draw / 诅咒金币` | 不能把它与 `虚张声势` 视为同一 mixed reward family；一个在攻击链里写 `unblockableDamage / cursed_coin`，一个在主阶段写 `bonusDamage / powder_keg` |
| `抽筋剥皮` | `customActions/cursed_pirate.ts:resolveFlay(...)` 走 `5` 骰 overlay，并按 `cutlass` 计数聚合 | `cutlassCount -> BONUS_DAMAGE_ADDED`；`cutlassCount>=3 -> 火药桶` | 可以把它登记为“计数型奖励骰 -> bonus damage accumulator -> 阈值状态写入”已实施；最新机制回归也已显式锁定弯刀数不足 `3` 时不会误施加 `火药桶` | 不能把它外推成普通单骰分支对象；它依赖计数聚合与阈值副产物 |
| `啜呼` | 先 `SIP_CHOICE_ID` 目标选择，再决定“直接吃桶”还是“改为投 1 骰”；改投后才走 overlay | `不改投 -> 直接火药桶`；`改投且 3-6 -> 火药桶 + 凋零`；`1-2 -> 无事发生` | 只能把它登记为“目标方 choice -> 可选 overlay -> 命中后状态双写入”这一独有 seam | 不能把它并入 `起锚 / 虚张声势 / 干票大的` 这类纯施放方奖励骰；`啜呼` 的关键差异在目标方 choice 与状态双写入 |
| 咒缚海盗奖励骰总口径 | overlay / dispatch 已实施 | 当前所有奖励骰对象都已证明 overlay 能打开/关闭；真正分叉发生在 `draw / CP / damage / hand-view / discard / status / target choice` 这些 downstream consumer | 只能把“overlay 壳已打通”视为 shared L4 事实 | 仍不能把“同样会投奖励骰”外推成“咒缚海盗奖励骰 family 只差配置” |

### 2026-06-06 咒缚海盗奖励骰 family 最终 verdict

| 子 family | 当前实现判断 | 当前仍需 completion audit 的真实原因 | 当前不得再写的误报 |
| --- | --- | --- | --- |
| 单骰即时分派 family（`起锚 / 虚张声势`） | 两者都已证明 `rollDie -> overlay -> 条件分派 -> 即时收口` 这条主壳真实成立；差异只在具体 downstream consumer 是 `draw / 休战 / bonusDamage / 火药桶` | 剩余是把“单骰即时分派”与其下游 `draw / status / damage` consumer 的归档边界封版，不是对象或 overlay 未落地 | 不得再写成“起锚 / 虚张声势 仍缺第一条奖励骰真实链” |
| 信息/弃牌交互 family（`瞭望台`） | `createBonusDieEvents(...) -> hand-view / self-discard / random-discard` 已完整成立，且三分支都已有真实入口与对象级收口 | 剩余只在它应作为独立 family 保留，还是和其它“奖励骰后转交互”对象并列归档；不是交互链未实现 | 不得再写成“瞭望台 仍只到 representative”或“查看手牌 / 弃牌分支还没真实跑通” |
| 聚合资源 family（`干票大的`） | `display-only 双骰 overlay -> 判 hasLoot -> draw 2 + CP +2` 的聚合条件消费者已锁定，不是单骰条件表 | 剩余是它与其它 `draw / CP` 对象如何分层归档；不是 `draw 2 + CP +2` 没实施 | 不得再写成“干票大的 只有 overlay，没有核心收口” |
| 攻击期多骰 family（`死亡印记 / 抽筋剥皮`） | 二者都已证明“攻击链内奖励骰”真实存在，但 `死亡印记` 是每颗骰子的独立分派，`抽筋剥皮` 是按弯刀数聚合后再阈值写 `火药桶`；当前更适合视作同大类下的两个子 seam，而不是一个完全同构 family | 剩余是把“攻击期多骰分派”和“攻击期计数聚合”拆成可审计子 family；不是攻击期奖励骰未落地 | 不得再写成“死亡印记 / 抽筋剥皮 仍只是奖励骰 UI 展示” |
| 目标方 choice + 状态双写入 family（`啜呼`） | `目标方选择 -> 可选改投 -> overlay -> 火药桶 / 凋零` 的独有 seam 已完整成立，并且不是 generic `rollDie` 即时收口 | 剩余是它作为独立 family 的归档口径，而不是对象或状态双写入未实现 | 不得再写成“啜呼 还只停在目标选择，没有真实奖励骰收口” |
| 咒缚海盗奖励骰总口径 | 奖励骰 family 当前应视为“已实施、待封版”，而不是“仍缺实现” | 剩余只是子 family 命名、边界和合法复用登记；当前没有任何一个 remaining 是“overlay 没开” | 不得再把整组对象写回“奖励骰未实施”或“要整套补第一条真实入口” |

### 2026-06-06 family next-proof gate

| remaining | 当前已能下的最硬结论 | 当前最强证据 | 若继续推进，真正还差的 next proof | 当前已不允许再倒退成什么问题 |
| --- | --- | --- | --- | --- |
| 咒缚海盗 `凋零` family | 已可判定为“实现存在，consumer 已真实生效”，且不再只锁在单一 live attack source | mechanics：`凋零只减少持有者对对手造成的攻击伤害，不影响直接伤害`；E2E：`灵魂突刺` 与 `死亡吐息` 两条真实攻击链都已证明减伤收口 | 真正还差的是把多写入入口与多消费来源一起封成 family verdict，而不是再找“第二条 live consumer” | 不得再退回“凋零不会真实减攻击伤害” |
| 咒缚海盗 `休战` family | 已可判定为“实现存在，writer/consumer/cleanup 都真实闭环”，且不再只锁在单一 live attack source | mechanics：`休战阻止攻击伤害但不阻止直接伤害`、`Token 响应收口后落地的攻击伤害事件`、`offensiveRoll -> defensiveRoll 不提前移除`；E2E：`cutlass-stab-4` 与 `死亡吐息` 两条真实攻击链都已证明阻断伤害与阶段清理 | 真正还差的是把多写入入口与多消费来源一起封成 family verdict，而不是再找“第二条 live consumer” | 不得再退回“休战只会写入，不会消费或不会清理” |
| 咒缚海盗奖励骰 family | 已可判定为“overlay 壳与各对象核心 downstream consumer 都已实施”，不是奖励骰未落地 | `起锚 / 虚张声势 / 瞭望台 / 干票大的 / 死亡印记 / 抽筋剥皮 / 啜呼` 当前都已有 mechanics 或 direct E2E 对应的 overlay 与收口态 | 真正还差的是把这些对象按 `draw-cp / damage / hand-view-discard / status-choice` 之类子 family 封版，而不是继续找“第一条真实入口” | 不得再退回“奖励骰 UI 没验证”或“这些对象仍只是 representative” |
| 战术家升级 family | 已可判定为“升级牌壳与关键 replacement ability 都已实施”，不是升级链未落地 | mechanics：`9 张 upgrade` 替换、`反制措施 III / 军刀突刺 II / 战略转移 II / 开拓战场 II / 摇鼓运动 II / 地毯式轰炸 II / 战争贩子 II`；E2E：对应升级牌真实写入与对象分支链 | 真正还差的是决定哪些 replacement ability 可以按同一 family 合法复用，不是再证明升级牌能打出或能替换 | 不得再退回“升级牌还没接线”“副分支仍未实现” |
| 战术家奖励骰 family | 已可判定为“主阶段 / 防御 / 额外进攻三类奖励骰消费者都已实施”，不是随机链缺口 | mechanics：`作战室 / 脱战 / 战争贩子 / 战争贩子 II`；E2E：`作战室`、`占得上风`、`战争贩子`、`战争贩子 II`、`脱战` 的 overlay 与收口链 | 真正还差的是 family 分组与边界封版，例如 `主阶段单骰`、`防御单骰`、`额外进攻` 是否各自单列 | 不得再退回“战争贩子 II 只有 overlay 没有真实消费者”或“脱战只停在展示层” |
| 咒缚海盗双面最终 verdict | 目前仍只能是 `hold`，但 hold 的原因已缩到审计封版，不是双面未接线 | `human 9 / 9 + cursed 9 / 9`、`16 / 16` 专属手牌、`human-cursed` 翻面链、`海盗的一生` 双面分支、`human-player-board` 资源链都已锁定 | 真正还差的是状态 family 与奖励骰 family 的最终封版决策，而不是再去补“哪一面没对象级直证” | 不得再退回“human 面未接入”“双面仍是 implementation_in_progress 主 blocker” |

### 2026-06-06 咒缚海盗专属手牌 completion 边界

| 子 family | 当前覆盖对象 | 当前直证层级 | 当前可确认的 completion 边界 | 当前仍未收口的边界 |
| --- | --- | --- | --- | --- |
| 直接收口 / 即时攻击修正 | `诱饵 / 坏血病 / 劫掠 / 停战协议 / 分点给我` | 对象级 `L3` | 五张牌都已拿到真实手牌入口与最终权威状态收口，不再属于“只靠 mechanics 外推”的手牌 residual | 仍需把它们各自涉及的伤害 / 状态 / 资源消费者回写到对应 family 的 `L4` 复用边界，不能把“对象已收口”外推成相关 family 已全绿 |
| 奖励骰 / 多分支手牌 | `起锚 / 虚张声势 / 瞭望台 / 干票大的 / 抽筋剥皮 / 啜呼` | 对象级 `L3` | 六张牌都已不止一条代表链；关键分支、overlay 展示与最终收口都已有真实入口证据 | 剩余只在奖励骰 / 随机 family 的跨对象合法复用登记，不再是“哪张手牌还没真实入口” |
| 选择 / continuation 手牌 | `诅咒卡牌 / 封舱 / 赎金 / 送你们去喂鱼 / 海盗的一生` | 对象级 `L3` | 五张牌都已真实覆盖 `choice -> continuation -> 收口`；其中 `诅咒卡牌` 已锁 3 分支，`海盗的一生` 已锁 normal/cursed 双面分支 | 剩余只在双面总审计与相关状态 family 的更高层 `L4`，不再是手牌对象本体缺分支证据 |
| 专属手牌总口径 | `16 / 16` 专属手牌 | 对象级 `L3` 或更高 | 以 `cards.ts` 的 16 张专属牌为全集核对，当前都已在 `mechanics / direct E2E / evidence` 三处命中，不再存在“专属手牌 family 仍缺首条真实入口”的 blocker | 不能把“16 / 16 对象已到 L3”外推成状态家族、奖励骰 family 或双面 completion audit 已完成；这些仍需单列 `L4` 判等 |

### 2026-06-06 战术家 remaining representative 条目边界

- 当前战术家已无 remaining representative 对象级条目。
- 当前剩余已整体上升为 family 级 `L4` / completion audit，主要集中在升级牌 family、升级进攻/防御共享参数链、奖励骰家族与双面总审计。

### 2026-06-06 咒缚海盗 remaining representative 条目边界

- 当前咒缚海盗已无“专属手牌对象本体仍缺首条真实入口”的 remaining representative 条目。
- 以 `cards.ts` 的 16 张专属牌为全集核对，`起锚 / 诅咒卡牌 / 封舱 / 诱饵 / 抽筋剥皮 / 赎金 / 虚张声势 / 坏血病 / 劫掠 / 停战协议 / 瞭望台 / 干票大的 / 海盗的一生 / 送你们去喂鱼 / 分点给我 / 啜呼` 都已拿到对象级真实入口或对象级 `L3`。
- 当前剩余已上升为 family 级 `L4` / completion audit，主要集中在状态家族生命周期、奖励骰/随机家族合法复用登记、双面合法复用登记与最终双面总审计，而不再是专属手牌 family 本体缺口。

| 门禁 | 状态 | 说明 |
| --- | --- | --- |
| 官方 human/normal 面完整实现 | audit-only | 当前已确认 normal 面与咒缚面存在独立技能文本与被动语义；仓库已完成底图接入、选图链、两套逐槽图面合同、9 个 human 面对象的运行时接入、自动翻面 direct E2E 与 9 条独立 direct E2E。当前剩余不再是“human 面尚未实现”，而是双面对象级重审计、face-by-face 合法复用登记与最终 completion audit |
| 对象级 L3/L4 | L3 object-complete / L4 pending | 真实入口选角、开局、玩家板/提示板、手牌 atlas 已覆盖；战略防御、送你们去喂鱼、手牌选择、瞭望台三分支、作战室奖励骰、占得上风勋章分支、起锚骷髅分支与默认抽牌分支、虚张声势三分支、诱饵真实攻击修正链、赎金跨玩家双步选择链、啜呼目标选择与奖励骰分支、干票大的奖励骰、战争贩子基础奖励骰链、战争贩子 II 勋章专门链、9 张升级牌真实打出 -> 升级槽位写入链、抽筋剥皮奖励骰链、死亡印记奖励骰链、`咒缚` 自伤/施桶链、`伴装撤退 / 脱战` 真实防御响应手牌链、`反制措施 / 反制措施 II / 反制措施 III / 你还嫩了点` 防御阶段入口、`包夹侧翼 / 包夹侧翼 II` 真实攻击入口、`埋伏` 真实手牌链、深海潜行完整攻击入口、`灵魂突刺` 独立真实入口链、`死亡吐息` 独立真实入口链、`灵魂指令` 独立真实入口链、human 面 9 个对象独立 direct E2E、16 张咒缚海盗专属手牌对象级证据、4 人无情诅咒火药桶链、诅咒金币维持阶段掉血链与火药桶维持阶段爆炸链都已有对象级或状态对象级截图链；当前剩余已不再是对象本体大面积缺入口，而是升级牌 family、状态家族、奖励骰家族与双面总审计的 `L4` 与最终 completion audit，因此还不能把最新整份 intake `80 passed (20.3m)` 直接外推成整批全绿 |
| 4 人 online readiness 通用稳定性 | watch | 当前无情诅咒 4 人真实链与地毯式轰炸双敌链都已并回 latest full-file；最新整份 intake 已 `80 passed (20.3m)`，因此这项不再是当前 blocker，但后续若继续补更长链 completion audit，仍需顺手观察是否出现环境回摆 |
| isolated single-worker DiceThrone runtime 启动稳定性 | watch | 近期简单开局基线与最新整份 intake 都已在当前链路下打绿，说明最小进房与当前 intake 整跑都不再是稳定 blocker；这项只保留观察，不再作为当前“规则未实施”的依据 |
| `implementation_in_progress` | 保留 | 全流程未完成，不允许移除 |

## 当前阅读说明

- 本文是这两名新英雄的现行对象级主审计入口之一，但不是最终 completion 证明。
- 当前真正有效的口径是：对象级补证已大幅推进，但状态家族、奖励骰 family、双面 face-by-face completion audit、合法复用登记与最终收口仍未完成；因此不能把本文外推成“战术家 / 咒缚海盗已全面审计完成”。
- 对外更准确的说法应是：规则实现层面已经明显超过“整套技能待重录”，尤其 human 面已进入正式运行时并拿到对象级直证；但 family 级 `L4` 与最终审计 verdict 仍未封版，所以 `implementation_in_progress` 继续保留。
