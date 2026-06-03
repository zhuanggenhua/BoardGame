# DiceThrone 战术家 / 咒缚海盗对象级审计（2026-05-31）

## 结论

本文件是对象级审计进度证据，不是完整交付证明。两名新英雄已经达到 L1 静态接入，多个机制达到 L2 行为证据；真实入口双玩家 E2E、资源上传与远端 HEAD 回查已完成。海盗的一生已按当前接入的咒缚面玩家板合同补齐治疗 3；战略防御、送你们去喂鱼、手牌选择、瞭望台弯刀/战利品/骷髅三分支交互、作战室奖励骰展示、干票大的奖励骰展示、占得上风勋章分支、起锚骷髅分支、虚张声势弯刀分支、赎金跨玩家双步选择链、啜呼目标选择与奖励骰分支、战争贩子奖励骰 + 额外进攻阶段代表链、战争贩子 II 奖励骰代表链、战争贩子 II 勋章专门链、4 人地毯式轰炸双敌目标链、抽筋剥皮奖励骰代表链、死亡印记奖励骰代表链、反制措施与你还嫩了点防御阶段入口、深海潜行完整真实攻击入口、战术家升级牌共享替换链、开拓战场 II 大顺主分支代表链、4 人无情诅咒 `targetingRoll / preDefense` 火药桶选择与落桶状态链、诅咒卡牌自伤抽牌分支、封舱弃手重抽链、分点给我单目标火药桶链、亡灵之爪的诅咒金币追加直伤链、诅咒金币维持阶段掉血链，以及火药桶维持阶段爆炸链都已补代表性真实入口截图链。当前最新对象级新增事实是：`虚张声势！` 已单跑通过并证明 Guest 从真实手牌打出后会进入奖励骰覆盖层，命中弯刀面时收口为 `Host HP 50 -> 48`；`开拓战场 II` 也已单跑通过并证明多变体同时满足时会先弹真实 variant modal，再进入大顺主分支防御链；`咒缚` 维持阶段自伤、对手未发起攻击时施加火药桶、火药桶维持阶段爆炸三条链也都已单跑通过；旧防御链 `反制措施 / 你还嫩了点` 也已在 `prebuilt + BG_VITE_FORCE_INLINE=1` 且不启 `BG_VITE_FORCE_CONFIG_INLINE` 的绕过路径下恢复单跑通过，并证明首个真实根因是 E2E 把 `ADVANCE_PHASE` 发给了错误玩家，而不是领域逻辑缺失。但“整份 intake E2E 当前为 26 passed”仍然不是现行结论：最新整跑依旧会被 online room / frontend runtime 不稳定拦住，因此当前主要剩余门禁仍是对象级彻底审计与验证环境稳定性，批次仍不得移除 `implementation_in_progress`。

## 审计范围

| heroId | 中文名 | 本文覆盖 | 当前结论 |
| --- | --- | --- | --- |
| `zhanshujia` | 战术家 | 英雄注册、资源链、状态/Token、9 个玩家板能力、15 张专属手牌、通用牌索引 | L1/L2 部分通过；真实入口选角/开局/手牌 atlas 已有 L3 截图 |
| `cursed_pirate` | 咒缚海盗 | 英雄注册、资源链、4 个状态、9 个玩家板能力、16 张专属手牌、通用牌索引 | L1/L2 部分通过；真实入口选角/开局/手牌 atlas 已有 L3 截图；海盗的一生当前素材咒缚面分支已补 L2 |

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
| D1 语义保真 | 部分通过 | 已按真相源拆卡牌/状态/能力；海盗的一生按当前唯一玩家板素材咒缚面合同实现治疗 3，未把官方 human 面猜成当前默认 |
| D2 边界完整 | 部分通过 | 2v2 对手筛选、至多/跳过路径已覆盖；真实入口开局与手牌 atlas 已覆盖，复杂交互 L3 仍未逐项覆盖 |
| D3 数据流闭环 | 部分通过 | 定义/注册/执行/状态/i18n/测试/E2E/上传链已闭环；复杂交互 UI 未逐项 L3/L4 |
| D5 交互完整 | 部分通过 | 战略防御、地毯式轰炸、无情诅咒、送你们去喂鱼、赎金、瞭望台、啜呼、深海潜行、干票大的、占得上风、起锚、虚张声势、战争贩子 II、开拓战场 II、抽筋剥皮、死亡印记、诅咒卡牌、封舱、分点给我、亡灵之爪、诅咒金币、火药桶均有 L2 交互证据；真实 UI 已覆盖选角、开局、手牌 atlas、战略防御、送你们去喂鱼、手牌选择、瞭望台三分支、作战室奖励骰展示、占得上风勋章分支、起锚骷髅分支、虚张声势弯刀分支、赎金跨玩家双步选择链、啜呼目标选择与奖励骰分支、干票大的奖励骰展示、战争贩子 II 奖励骰代表链、战争贩子 II 勋章专门链、开拓战场 II 大顺主分支变体选择链、4 人地毯式轰炸双敌目标链、抽筋剥皮奖励骰代表链、死亡印记奖励骰代表链、两条防御响应链、深海潜行完整攻击入口、4 人无情诅咒 `targetingRoll / preDefense` 火药桶选择链、诅咒卡牌自伤抽牌分支、封舱弃手重抽链、分点给我单目标火药桶链、亡灵之爪诅咒金币追加直伤链、诅咒金币维持阶段掉血链，以及火药桶维持阶段爆炸链；其余复杂交互仍待逐项 L3 |
| D8 时序正确 | 部分通过 | 紧缚阶段清理、休战清理、战争贩子额外进攻、战争贩子 II 勋章额外进攻、咒缚未发起攻击追踪有 L2；真实入口已补 `紧缚` 的 `64-66` 额外投掷 `1CP` 门禁与 phase exit 清理链，以及战争贩子 II 奖励骰代表链与勋章专门链，领域层也已补“先触发额外攻击、后于防御阶段收口时切回 offensiveRoll”的最小时序合同 |
| D11/D12 消耗与写入对称 | 部分通过 | 战术优势消耗、CP 支付/偷取/获得、卡牌扣费后结算已覆盖代表链；战术优势真实入口 `60-63` 已证明 token 消耗与 `bind` 转移写入对称 |
| D14 清理完整 | 部分通过 | 紧缚、休战等阶段清理已有 L2，且 `紧缚` 已补 `64-66` 真实入口 phase exit 清理链；其它 UI/pending 清理待 E2E |
| D15 UI 状态同步 | 部分通过 | 已有真实 host/guest 截图证明战术家与咒缚海盗选角、玩家板、提示板、HUD、手牌 atlas 可见；战略防御、送你们去喂鱼、手牌选择、瞭望台三分支、作战室奖励骰、占得上风勋章分支、起锚骷髅分支、虚张声势弯刀分支、赎金跨玩家双步选择链、啜呼目标选择与奖励骰分支、干票大的奖励骰、战争贩子 II 奖励骰代表链、战争贩子 II 勋章专门链、开拓战场 II 变体选择 + 防御链、4 人地毯式轰炸双敌目标链、抽筋剥皮奖励骰代表链、死亡印记奖励骰代表链、两条防御响应链、`伴装撤退 / 脱战` 真实防御响应手牌链、深海潜行完整攻击入口、4 人无情诅咒 `targetingRoll / preDefense` 火药桶选择链、诅咒卡牌选择弹窗、封舱弃手重抽前后手牌状态、分点给我前后火药桶状态、亡灵之爪前后 HP/诅咒金币状态、诅咒金币维持阶段前后 HP/状态保留，以及火药桶维持阶段前后 HP/状态移除已有交互 UI 截图链；其余复杂交互仍待逐项 L3 |
| D22 伤害计算 | 部分通过 | 不可防御、直接伤害、凋零、护盾/防伤等有 L2 代表链 |
| D23/D24 共享消费与交互候选 | 部分通过 | `customActionId`、`selectPlayer`、`selectHandCard`、`minSelectCount`、状态施加 helper 已有定向测试 |
| D52 权威可视合同一致性 | 部分通过 | slot/atlas/frame 已有 intake 测试；真实 UI 截图已覆盖玩家板、提示板、手牌代表卡 |

## 框架消费合同矩阵

| 合同 | 本轮对象 | 消费点 | 当前证据 | 结论 |
| --- | --- | --- | --- | --- |
| 英雄注册 | 战术家、咒缚海盗 | `CHARACTER_DATA_MAP`、`DICETHRONE_CHARACTER_CATALOG`、`heroes/index.ts` | intake test 6 passed | L1 passed |
| 卡牌 atlas | 两名英雄专属牌与通用牌 | `DICETHRONE_CARD_ATLAS_IDS`、`previewRef`、`cardAtlas` | slot 17-31/32 与 `card-unexpected` 32/33 测试；开局 E2E 已在同一真实双玩家用例里等待双方 `card-unexpected` 加载完成，并由截图 `05/06` 同时显示战术家“作战室”/咒缚海盗“海盗的一生”与各自 common 卡图 | L1 passed，代表 L3 passed |
| 状态图集 | 战术优势、紧缚、诅咒金币、火药桶、凋零、休战 | `status-icons-atlas.json`、TokenDef `frameId/atlasId` | intake test 校验 frame 存在；远端 HEAD 均为 200 | L1 passed，remote passed |
| `grantStatus` 特例 | 诅咒金币、火药桶、凋零、休战、紧缚、锁定 | `buildStatusAppliedOrChoiceEvents`、`effects.ts`、`execute.ts` | 诅咒金币拒绝/上限、火药桶重叠爆炸测试 | L2 partial |
| 防御 resolver | 反制措施、你还嫩了点 | defense timing `withDamage` | 机制测试覆盖骰面计数、防伤/反击/状态；真实防御阶段入口截图 20-23 与服务器状态断言覆盖两条代表链 | L2/L3 representative |
| 多目标交互 | 地毯式轰炸、无情诅咒、送你们去喂鱼 | `selectPlayer`/bitmask、`minSelectCount` | 2v2 不列队友、跳过、选满门禁测试；送你们去喂鱼真实入口弹窗截图与火药桶落点断言；无情诅咒 4 人真实入口截图 42-45 覆盖 `targetingRoll` 目标选择归属、`preDefense` 火药桶 modal 与双敌方落桶状态链；地毯式轰炸 4 人真实入口截图 80-81 覆盖 `targetingRoll -> dt:defender-choice -> selectPlayer` 双敌目标链与只命中敌队两名玩家的状态落点 | L2 passed；送你们去喂鱼 / 无情诅咒 / 地毯式轰炸 为 representative L3 |
| 手牌选择/手牌查看交互 | 深海潜行、瞭望台 | `selectHandCard`、simple-choice、Board owner gate、InteractionOverlay/ChoiceModal i18n 渲染 | 目标自选弃牌测试；深海潜行真实攻击入口截图 24-26 证明偷 CP、施加凋零后仍保留弃牌弹窗并正确落弃牌堆；瞭望台弯刀查看手牌截图显示中文卡名且确认后手牌不变；瞭望台战利品目标自选弃牌与骷髅随机弃牌截图已补 | L2 passed，代表 L3 passed |
| 奖励骰/随机 | 作战室、占得上风、起锚、战争贩子、战争贩子 II、死亡印记、干票大的、抽筋剥皮、啜呼、瞭望台等 | `rollDie`、custom random | 固定随机机制测试；作战室真实入口奖励骰特写与战术优势落点截图；占得上风真实入口命中勋章分支并回写 4 层战术优势；起锚真实入口命中骷髅分支并对目标施加休战；干票大的真实入口双骰覆盖层与抽牌/CP/弃牌落点截图；战争贩子 II 真实入口奖励骰覆盖层与分支无关代表性收口截图，以及勋章专门链真实回到额外进攻 `offensiveRoll` 的截图；抽筋剥皮真实入口 5 骰奖励骰覆盖层与按弯刀数结算的分支无关收口截图；死亡印记真实入口 4 骰奖励骰覆盖层与按弯刀/战利品/骷髅实际结果收口的代表性截图 | L2 partial；作战室/占得上风/起锚/干票大的/战争贩子 II/抽筋剥皮/死亡印记 为 representative L3 |
| 玩家板面 | 海盗的一生 C2 | `HeroState.playerBoardFace`，咒缚海盗当前素材初始化为 `cursed` | 机制测试覆盖咒缚面治疗 3 与普通面金币分支 | L2 passed |

## 战术家对象矩阵

| 对象 | 子句/语义 | 实现入口 | 当前证据 | 层级 | 结论 |
| --- | --- | --- | --- | --- | --- |
| 英雄注册 | 可被选角入口识别，保留实施中徽标 | `domain/characters.ts`、`heroes/index.ts` | intake test | L1 | passed |
| 资源链 | 玩家板、提示板、骰子、手牌、状态图集本地存在并入 manifest | `criticalImageResolver.ts`、manifest | intake/resource test；`assets:upload`；远端 HEAD 200；E2E 截图 | L1/L3 | passed |
| 战术优势 | 6 个主动动作：CP、重掷、抽牌、锁定、守护、转移状态 | `tokens.ts`、`customActions/zhanshujia.ts` | 机制测试；真实入口截图 60-63 证明被动按钮可见、`selectStatus -> selectTargetStatus` 双阶段交互成立，且 4 层战术优势消耗后可把 Host 的 `bind` 转移给 Guest | L2/L3 representative | passed |
| 紧缚 | 额外进攻投掷前 1CP 门禁，进攻掷骰阶段结束清理 | `flowHooks.ts`/状态消费 | 机制测试；真实入口截图 64-66 证明 Guest 在额外投掷里先支付 `1CP` 再重投，并在离开 `offensiveRoll` 后清掉自己身上的 `bind` | L2/L3 representative | passed |
| 军刀突刺 | 3/4/5 军刀造成 4/5/6 | `abilities.ts` 共享 diceSet/damage | 真实入口截图 82-84 已证明 `fist` 槽位在 3 军刀盘面下会解析为 `sabre-thrust-3`，点击后需由 Host 继续推进到 Guest `still-wet-behind-ears` 防御阶段；把 Guest 防御骰固定成全战利品面后，服务器断言 `Host HP=50 / Guest HP=46`，说明基础 `3 军刀 -> 4 伤害` 主链已在真实 UI 中闭环；其余 `4/5` 军刀仍仅差同一消费者上的参数值 | L2 / representative L3 | passed |
| 军刀突刺 II | 伤害提升；三同值施加紧缚 | `SABRE_THRUST_2`、custom action | 机制测试 | L2 | L3 pending |
| 地毯式轰炸 | 获得战术优势；两名不同对手受附属伤害 | `zhanshujia-carpet-bombing-targets` | 机制测试；真实入口截图 80-81 证明 4 人链会先进入 `targetingRoll`，完成目标骰确认后再进入双敌 `selectPlayer` 覆盖层，且只列敌队 `P1 / P3`、结算后 `player0Hp=46 / player2Hp=46 / player3Hp=50` | L2 / representative L3 | passed |
| 地毯式轰炸 II | 主分支 + 旗帜 4 分支 | `CARPET_BOMBING_2` | 2v2 主分支测试；旗帜分支为共享 grant/draw | L2 partial | 旗帜分支对象专测待补 |
| 战争贩子 | 奖励骰分支；攻击收口后额外进攻投掷阶段 | `zhanshujia-war-monger-extra-offensive-roll` | 机制测试；真实入口截图 78-79 已证明 Host 会先进入基础战争贩子的奖励骰覆盖层，并在关闭覆盖层、由 Guest 完成防御收口后真实回到额外进攻 `offensiveRoll`；分支断言同时覆盖：勋章时抽 1 张 `战略防御`，旗帜时战术优势从 `1 -> 5`，其余分支时 Guest HP 从 `50 -> 45` | L2/L3 representative | passed |
| 战争贩子 II | 勋章抽牌并触发额外进攻投掷阶段 | `zhanshujia-war-monger-2-roll` + `extraAttackInProgress.phaseEntered` | 机制测试；真实入口截图 29-30 证明奖励骰覆盖层可见，截图 35 证明 Guest 防御收口后 Host 真实进入额外进攻 `offensiveRoll` | L2 / representative L3 | passed |
| 摇鼓运动 | 施加紧缚并造成 7 | `abilities.ts` | 纯共享组合链；`伴装撤退` 截图 67-68 已证明 `grantStatus(BIND)` 在真实防御响应链里的写入/落点，`制胜高地` 截图 58-59 已证明战术家玩家板 offensive slot 的真实入口与攻击收口；本对象无私有 `customAction` / choice，仅复用同一 `CombatAbilityManager -> effects.ts(grantStatus/damage)` 消费链组合 `bind + 7 damage` | L2 / representative L3 | passed |
| 摇鼓运动 II | 主分支获得战术优势+紧缚+伤害；间接分支战术优势+不可防御伤害 | `DRUM_MOVEMENT_2` | 真实入口截图 88-90 已证明 `lotus` 槽位在 `3 军刀 + 2 勋章` 盘面下会直接解析为 `drum-movement-2-main`，点击后需由 Host 推进到 Guest `still-wet-behind-ears` 防御阶段；把 Guest 防御骰固定成全战利品面后，服务器断言 `Host 战术优势=1 / Guest bind=1 / Guest HP=43`，说明主分支 `grantToken + bind + 7 damage` 已在真实 UI 中闭环；间接分支仍只剩同一技能上的 `grantToken + unblockable damage` 参数差异 | L2 / representative L3 | passed |
| 包夹侧翼 | 小顺获得战术优势并造成 6 | `FLANKING` | 纯共享组合链；`作战室` 截图 18-19 与 `战术优势` 截图 60-63 已证明 `grantToken(TACTICAL_ADVANTAGE)` 的真实写入/读取链，`制胜高地` 截图 58-59 已证明战术家玩家板 offensive slot 的真实攻击入口与伤害收口；本对象无私有 `customAction` / choice，仅复用同一 `grantToken + damage` 组合 | L2 / representative L3 | passed |
| 包夹侧翼 II | 战术优势数值提升 | `FLANKING_2` | 升级映射测试已锁定 `replaceAbility('flanking', FLANKING_2, 2)`；与基础 `包夹侧翼` 相比，真实入口、trigger、伤害与消费者完全相同，仅 `grantToken(TACTICAL_ADVANTAGE)` 数值由 `1 -> 2`，可复用基础 `包夹侧翼` 的真实攻击入口与收口链 | L2 / representative L3 | passed |
| 开拓战场 | 大顺获得战术优势、紧缚、9 伤害 | `EXPAND_BATTLEFIELD` | 纯共享组合链；`作战室` 截图 18-19 与 `战术优势` 截图 60-63 已证明 `grantToken(TACTICAL_ADVANTAGE)`，`伴装撤退` 截图 67-68 已证明 `grantStatus(BIND)`，`制胜高地` 截图 58-59 已证明战术家玩家板 offensive slot 的真实攻击收口；本对象无私有 `customAction` / choice，仅复用 `grantToken + grantStatus + damage` 组合 | L2 / representative L3 | passed |
| 开拓战场 II | 大顺升级；锁定分支抽牌+紧缚 | `EXPAND_BATTLEFIELD_2` | 真实入口截图 91-94 已证明 `lightning` 槽位在 `[2,3,4,5,6]` 盘面下会先解析为 `expand-battlefield-2-large-straight`，且因同时满足 `largeStraight` 与 `lockdown` 会先弹变体选择 modal；Host 显式选择 `开拓战场 II（大顺子）` 后推进到 Guest `still-wet-behind-ears` 防御阶段，并在全战利品防御骰下收口到 `Host 战术优势=3 / Guest bind=1 / Guest HP=41`；`lockdown` 分支仅剩同一变体选择 UI 下的抽牌参数差异 | L2 / representative L3 | passed |
| 战略转移 | 勋章 4 获得 5 战术优势并造成不可防御伤害 | `STRATEGIC_SHIFT` | 纯共享组合链；`作战室` 截图 18-19 与 `战术优势` 截图 60-63 已证明战术家通用 `grantToken(TACTICAL_ADVANTAGE)` 写入与 UI 落点，`亡灵之爪` 截图 52-53 已证明同一 `damage(unblockable)` 消费链会在真实攻击入口里按权威状态收口；本对象无私有 `customAction` / choice，仅差 token 数值与伤害参数 | L2 / representative L3 | passed |
| 战略转移 II | 主分支额外紧缚；勋章 3 侦察分支 | `STRATEGIC_SHIFT_2` | 升级映射测试；真实入口截图 85-87 已证明 `calm` 槽位在 `4 勋章 + 3 勋章` 同时满足时会先弹变体选择 modal，Host 显式选择 `4 个勋章` 主分支后，收口到 `Host 战术优势=5 / Guest bind=1 / Guest HP=45`；`3 勋章` 侦察分支仍只剩同一变体选择 UI 下的 `grantToken` 参数差异 | L2 / representative L3 | passed |
| 反制措施 | 防御骰 4，军刀/旗帜/勋章分支 | `zhanshujia-countermeasures-defense` | 机制测试；真实防御阶段入口截图与服务器状态断言 | L2/L3 | passed representative |
| 反制措施 II/III | 防御骰 5；III 军刀组伤害提升 | `COUNTERMEASURES_2/3` | 升级映射 + III 代表分支测试；基础反制措施真实入口截图 20-21 已证明同一 defensive slot 与 `customActionId=zhanshujia-countermeasures-defense` 的 L3 闭环；II 与 III 相比仅差 `sabrePairDamage=1/2` 参数，且都由同一 5 骰 defensive trigger 消费 | L2 / representative L3 | passed |
| 制胜高地 | 锁定、紧缚、战术优势上限 +1 并补满、12 伤害 | `zhanshujia-high-ground-cap-up-and-fill` | 机制测试；真实入口截图 58-59 证明通过 `ultimate` 槽位触发后，Guest 获得锁定/紧缚，Host 的战术优势上限从 5 升到 6 并补满到 6 | L2/L3 representative | passed |
| 占得上风 | 投 1 骰：勋章得 4 战术优势，否则抽 1 | `cards.ts` rollDie | 定向 E2E 已命中勋章分支：截图 72-73 证明 Host 从真实手牌打出后进入奖励骰覆盖层，并在关闭覆盖层后把战术优势从 0 写到 4、源卡进入弃牌堆；默认抽 1 分支仅剩共享 drawCard 路径差异，已由 L2 锁定 | L2 / representative L3 | passed |
| 伏击 | 获得 2 战术优势 | `cards.ts` grantToken | 纯共享手牌 immediate 链；`作战室` 截图 18-19 已证明战术家从真实手牌打出卡牌后可在同一手牌入口回写战术优势与弃牌落点，`战术优势` 截图 60-63 已证明该 token 的真实 UI/消耗读写；本对象无私有 `customAction` / choice，仅差 token 数值 | L2 / representative L3 | passed |
| 脱战 | 被攻击后投骰三分支 | `card-zhanshujia-disengage` | 机制测试；真实入口截图 69-71 证明 Guest 通过 `soul-stab-3` 真实攻击链打开防御窗口后，Host 能从真实手牌打出 `脱战` 并进入奖励骰覆盖层；本次通过 run 命中军刀分支，收口到 Guest HP `50 -> 48`，且源卡进入弃牌堆 | L2/L3 representative | passed |
| 伴装撤退 | 攻击者紧缚，自己防止 3 | `card-zhanshujia-tactical-retreat` | 机制测试；真实入口截图 67-68 证明 Guest 通过 `soul-stab-3` 真实攻击链打开防御窗口后，Host 能从真实手牌打出 `伴装撤退`，并收口到 Guest 获得 `bind 1`、Host 获得 `3` 点护盾、源卡进入弃牌堆 | L2/L3 representative | passed |
| 作战室 | 按骰值一半向上取整获得战术优势 | `zhanshujia-war-room-roll` | 机制测试；真实入口奖励骰特写与战术优势落点截图 | L2/L3 | passed |
| 战略防御 | 选择任意玩家获得守护 | `zhanshujia-strategic-defense-select-player` | 机制测试；真实入口玩家选择覆盖层与守护落点截图 | L2/L3 | passed |
| 9 张升级牌 | 替换基础技能，写入等级与升级卡映射 | `replaceAbility` | `cards.ts` 里 9 张升级牌全部是 `type: 'upgrade'` + `effects: [replaceAbility(...)]`；intake test 已锁 `id/sourceAtlasIndex/previewRef`；mechanics test 已锁 `targetAbilityId/newAbilityLevel/upgradeCardByAbilityId/abilityLevels`；真实入口截图 76-77 已证明 `upgrade-zhanshujia-war-monger-2` 会从真实手牌以 `PLAY_UPGRADE_CARD` 打出，令 `abilityLevels['war-monger']` 从 `1 -> 2`、`upgradeCardByAbilityId['war-monger'].cardId` 写为升级牌 ID、手牌归 0、CP 从 `5 -> 3`，且升级牌不进入弃牌堆而是保留在升级槽位 | L2 / representative L3 | passed |
| 通用牌索引 | `card-unexpected` 使用 slot 32 | `ZHANSHUJIA_COMMON_ATLAS_INDEX` | intake test；开局真实双玩家 E2E 已显式注入并等待 Host 侧 `card-unexpected` 卡图加载完成，截图 `05-host-zhanshujia-hand-card-atlas` 现在同时覆盖战术家专属牌与 common 卡图运行时落点 | L1 / representative L3 | passed |

## 咒缚海盗对象矩阵

| 对象 | 子句/语义 | 实现入口 | 当前证据 | 层级 | 结论 |
| --- | --- | --- | --- | --- | --- |
| 英雄注册 | 可被选角入口识别，保留实施中徽标 | `domain/characters.ts`、`heroes/index.ts` | intake test | L1 | passed |
| 资源链 | 使用素材目录 `cursed`，本地压缩资源与 manifest 存在 | `criticalImageResolver.ts`、manifest | intake/resource test；`assets:upload`；远端 HEAD 200；E2E 截图 | L1/L3 | passed |
| 诅咒金币 | 自身上限 5/他人 3；维持伤害；不可移动/移除；海盗可拒绝获得 | `tokens.ts`、`statusEvents.ts` | 机制测试；真实入口截图 54-55 证明从 Guest `discard` 推到 Host `upkeep` 后，Host 在保留 3 层诅咒金币的同时从 50 HP 降到 47 HP | L2/L3 representative | passed |
| 火药桶 | 维持投骰 1-2 爆炸、3-5 无事、6 转交；重复获得爆炸 | `statusEvents.ts`、choice handler | 机制测试；真实入口截图 56-57 证明从 Guest `discard` 推到 Host `upkeep` 后，Host 从 50 HP 降到 47 HP 且火药桶被移除 | L2/L3 representative | passed |
| 凋零 | 持有者造成攻击伤害 -1/层 | `tokens.ts`、伤害修正管线 | 机制测试；深海潜行真实入口截图 24-26 已证明前置事件会真实施加凋零且不打断后续弃牌交互，`啜呼` 截图 39-41 也覆盖奖励骰分支命中后施加凋零的共享状态写入链 | L2 / representative L3 | passed |
| 休战 | 阻止攻击伤害，不阻止直接伤害，阶段结束清理 | `tokens.ts`、伤害/flowHooks | 机制测试已锁定“阻止攻击伤害、不阻止直接伤害、`offensiveRoll -> main2` 清理”；`无情诅咒` 截图 42-45 与手牌 `休战` 行已证明 `grantStatus(PARLEY)` 可在真实入口写入目标，开局截图 04 也已覆盖状态图标展示合同；据此可把 L3 收口限定为“真实状态写入 + UI 合同”，不外推到独立攻击阻断 E2E | L2 / representative L3 | passed |
| 灵魂突刺 | 3/4/5 弯刀伤害；三同值施加火药桶 | `cursed-pirate-powder-keg-if-three-kind` | 机制测试已锁定 `soul-stab-3` 在三同值时会于 `postDamage` 施加火药桶；真实入口截图 67-71 已证明 Guest 会通过玩家板上真实解析出的 `soul-stab-3` 攻击链自然打开防御窗口，说明基础攻击入口与收口链已走通；本对象剩余差异只在伤害数值与三同值附桶条件，均已被 L2 锁住 | L2 / representative L3 | passed |
| 死亡印记 | 先得 2CP；奖励骰弯刀/战利品/骷髅分支 | `gain-cp`、rollDie | 机制测试；真实入口截图 33-34 证明奖励骰覆盖层可见，关闭后能按实际弯刀/战利品/骷髅结果收口；并已补 `rollDie` 多骰逐颗累计修复 | L2/L3 representative | passed |
| 咒缚 | 自己维持自伤 4；对手进攻投掷阶段未发起攻击则火药桶 | `cursed-pirate-cursed-upkeep-self-damage`、`flowHooks.ts` | 机制测试；真实入口截图与定点 E2E 已分别覆盖“战术家 discard -> 咒缚海盗 upkeep 自伤 4”以及“对手在其进攻投掷阶段未发起攻击时施加火药桶”两条对象链 | L2/L3 representative | passed |
| 深海潜行 | 偷 1CP；对手自选弃 1；凋零；8 伤害 | `cursed-pirate-steal-one-cp`、`selectHandCard` | 机制测试；真实攻击入口截图 24-26 证明通过面板槽位触发后，偷 CP、施加凋零、对手自选弃牌与弃牌落点整链成立 | L2/L3 representative | passed |
| 死亡吐息 | 小顺/大顺施加凋零、火药桶并伤害 | `BREATH_OF_DEATH` | 纯共享组合链；`深海潜行` 截图 24-26 与 `啜呼` 截图 39-41 已证明 `grantStatus(WITHER)` 的真实写入链，`分点给我` 截图 50-51 与 `无情诅咒` 截图 42-45 已证明 `grantStatus(POWDER_KEG)` 的真实写入链，`深海潜行` / `亡灵之爪` 已证明咒缚海盗玩家板 offensive slot 的真实攻击收口；小顺/大顺仅差 `damage=7/10` 参数，无私有 `customAction` / choice | L2 / representative L3 | passed |
| 灵魂指挥 | 休战、火药桶、凋零、8 不可防御伤害 | `SOUL_COMMAND` | 纯共享组合链；`无情诅咒` 截图 42-45 已证明同一真实攻击链里 `grantStatus(PARLEY)` 与 `grantStatus(WITHER)` 的写入，`分点给我` 截图 50-51 与 `无情诅咒` 截图 42-45 已证明 `grantStatus(POWDER_KEG)`，`亡灵之爪` 截图 52-53 已证明不可防御伤害收口；本对象无私有 `customAction` / choice，仅复用 `grantStatus + damage(unblockable)` 组合 | L2 / representative L3 | passed |
| 亡灵之爪 | 8 不可防御；按所有对手诅咒金币层数造成伤害 | `cursed-pirate-damage-by-cursed-coins` | 机制测试；真实入口截图 52-53 证明通过 `calm` 槽位触发后，Host 在保留 3 层诅咒金币的同时从 50 HP 降到 39 HP | L2/L3 representative | passed |
| 你还嫩了点 | 防御骰弯刀/战利品/骷髅/组合金币 | `cursed-pirate-still-wet-behind-ears-defense` | 机制测试；真实防御阶段入口截图与服务器状态断言 | L2/L3 | passed representative |
| 无情诅咒 | 13 伤害；休战/诅咒金币/凋零；至多两名对手火药桶 | `cursed-pirate-merciless-curse-powder-keg-targets` | 机制测试；真实入口截图 42-45 证明 4 人 `targetingRoll` 目标选择归属、`preDefense` 火药桶 modal 与 `施加给 P2, P4` 后的双敌方落桶状态链 | L2/L3 representative | passed |
| 起锚 | 投 1 骰，骷髅休战，否则抽 1 | `cards.ts` rollDie | 定向 E2E 已命中骷髅分支：截图 74-75 证明 Guest 从真实手牌打出后进入奖励骰覆盖层，并在关闭覆盖层后给 Host 真实写入 `休战 1`、源卡进入弃牌堆；默认抽 1 分支仅剩共享 drawCard 路径差异，已由 L2 锁定 | L2 / representative L3 | passed |
| 诅咒卡牌 | 三选一：抽 1 / 受 2 抽 2 / 受 4 抽 3 | `cursed-pirate-curse-card-choice` | 机制测试；真实入口截图 46-47 证明选择弹窗可见，且“受 4 伤害抽 3”分支能回写 HP、手牌与弃牌落点 | L2/L3 representative | passed |
| 封舱 | 弃剩余手牌后抽 4 | `cursed-pirate-batten-down` | 机制测试；真实入口截图 48-49 证明打牌前手牌可见，打牌后其余手牌进入弃牌堆并重抽 4 张新手牌 | L2/L3 representative | passed |
| 诱饵 | 攻击伤害 +2 | `cards.ts` damage | 共享伤害链 + 静态定义 | L1/L2 shared | 对象专测待补 |
| 抽筋剥皮 | 投 5 骰；每弯刀 +1；至少 +3 施加火药桶 | `cursed-pirate-flay-roll` | 机制测试；真实入口截图 31-32 证明奖励骰覆盖层可见，关闭后能按实际弯刀数收口 bonus damage，并在弯刀数 >= 3 时施加火药桶 | L2/L3 representative | passed |
| 赎金 | 出牌者选骰；目标支付 2CP 或重掷 | `cursed-pirate-ransom-die-choice`、resolve choice | 机制测试；真实入口截图 36-38 证明 Guest 先选骰、Host 后支付 2CP，且收口到 CP 转移与弃牌落点 | L2/L3 representative | passed |
| 虚张声势 | 投 1 骰三分支 | `cards.ts` rollDie | 真实入口截图 95-96 已证明 Guest 从真实手牌打出后会进入 `bonus-die-overlay`，命中弯刀面时收口到 `Host HP 50 -> 48` 且源卡进入弃牌堆；战利品抽 2 与骷髅施加火药桶仍仅剩同一 `rollDie` 消费链上的参数差异 | L2 / representative L3 | passed |
| 坏血病 | 自伤 1；对手凋零 | `cards.ts` damage/grantStatus | 纯共享手牌 immediate 链；`诅咒卡牌` 截图 46-47 已证明咒缚海盗从真实手牌打出卡牌后的自伤/弃牌收口，`深海潜行` 截图 24-26 与 `啜呼` 截图 39-41 已证明 `grantStatus(WITHER)` 写入；本对象无私有 `customAction` / choice，仅复用 `direct self-damage + grantStatus(WITHER)` 组合 | L2 / representative L3 | passed |
| 劫掠 | 偷 1CP | `cursed-pirate-steal-one-cp` | 深海潜行代表链覆盖同 `customActionId=cursed-pirate-steal-one-cp`；截图 24-26 与对应服务器断言已证明该 custom action 在真实攻击入口中完成 `Guest +1CP / Host -1CP` 的共享闭环 | L2 / representative L3 | passed |
| 休战 | 对一名对手施加休战 | `cards.ts` grantStatus | 纯共享手牌 immediate 链；`分点给我` 截图 50-51 已证明咒缚海盗从真实手牌打出 main 卡牌后的 immediate 写入与弃牌收口，`无情诅咒` 截图 42-45 已证明 `grantStatus(PARLEY)` 会在真实攻击链里写入目标状态；本对象无私有 `customAction` / choice，仅差状态 ID | L2 / representative L3 | passed |
| 瞭望台 | 弯刀查看手牌；战利品目标自选弃 1；骷髅随机弃 1 | `cursed-pirate-crows-nest-roll` | 机制测试；真实入口弯刀查看手牌截图与手牌不变断言；战利品目标自选弃牌截图；骷髅随机弃牌截图 | L2/L3 | passed for three branches |
| 干票大的 | 投 2 骰；有战利品则抽 2 并获得 2CP | `cursed-pirate-hefty-roll` | 机制测试；真实入口截图 27-28 证明双骰覆盖层展示后，关闭覆盖层可正确回写抽 2、回 2CP 与弃牌落点 | L2/L3 | passed |
| 海盗的一生 | C1 普通面获得 1 诅咒金币 | `cursed-pirate-pirates-life` + `playerBoardFace='normal'` | 机制测试 | L2 | passed |
| 海盗的一生 | C2 咒缚面改为治疗 3 | `playerBoardFace='cursed'` 初始合同 | 机制测试 | L2 | passed |
| 送你们去喂鱼 | 可跳过的至多三名不同对手火药桶 | `cursed-pirate-go-fish-powder-keg-targets` | 机制测试；真实入口简单选择弹窗与火药桶落点截图 | L2/L3 | passed |
| 分点给我 | 对一名对手施加火药桶 | `cards.ts` grantStatus | 火药桶共享 helper 覆盖；真实入口截图 50-51 证明打牌前手牌可见，打牌后对手获得 1 层火药桶且源卡进入弃牌堆 | L2/L3 representative | passed |
| 啜呼 | 目标选择接受火药桶或投骰；3-6 火药桶+凋零 | `cursed-pirate-sip-choice` | 机制测试；真实入口截图 39-41 证明 Host 真实接管目标选择，并在改投骰后进入奖励骰覆盖层，再按实际点数收口到状态结果 | L2/L3 representative | passed |
| 通用牌索引 | `card-unexpected` 使用 slot 33 | `CURSED_PIRATE_COMMON_ATLAS_INDEX` | intake test；开局真实双玩家 E2E 已显式注入并等待 Guest 侧 `card-unexpected` 卡图加载完成，截图 `06-guest-cursed-pirate-hand-card-atlas` 现在同时覆盖咒缚海盗专属牌与 common 卡图运行时落点 | L1 / representative L3 | passed |

## 当前验证记录

| 命令 | 结果 |
| --- | --- |
| JSON parse `public/locales/{zh-CN,en}/game-dicethrone.json` | 通过 |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts -t "深海潜行"` | 通过（2026-06-01 07:57） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 1 file / 43 tests passed（2026-06-01 07:57） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts` | 1 file / 7 tests passed（2026-06-01 07:57） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 2 files / 50 tests passed（2026-06-01 07:57）；2 files / 52 tests passed（2026-06-01 11:35） |
| `npx vitest run src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx` | 1 file / 29 tests passed（2026-05-31 14:17；保留既有 missing_sfx stderr） |
| `npm run i18n:check` | 通过，仅保留既有 3 条 warning（2026-05-31 13:15） |
| `npx eslint src/games/dicethrone/domain/customActions/cursed_pirate.ts src/games/dicethrone/heroes/cursed_pirate/cards.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 0 errors |
| `npx tsc --noEmit --pretty false` | 通过（2026-05-31 14:07） |
| `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 0 errors（2026-05-31 13:38） |
| `npx eslint src/games/dicethrone/ui/InteractionOverlay.tsx e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 0 errors（2026-05-31 14:07） |
| `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 0 errors（2026-06-01 12:00） |
| `npx tsc --noEmit --pretty false` | 通过（2026-06-01 12:00） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算赎金的跨玩家双步选择链"` | 1 passed（2026-06-01 12:00，截图 36-38 覆盖 Guest 选骰、Host 支付 2CP、收口状态） |
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
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示紧缚在额外投掷中的 CP 门禁与阶段清理"` | 1 passed（2026-06-01，截图 64-66 覆盖额外投掷前状态、支付 `1CP` 后状态，以及离开 `offensiveRoll` 后 `bind` 清理收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实防御阶段入口应通过真实攻击流打出并结算伴装撤退"` | 1 passed（2026-06-02 02:20，截图 67-68 覆盖真实防御窗口、真实手牌打出与 `bind / damageShield` 收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实防御阶段入口应通过真实攻击流打出并结算脱战"` | 1 passed（2026-06-02 03:00，截图 69-71 覆盖真实防御窗口、真实手牌打出、奖励骰覆盖层与军刀分支 `-2 HP` 收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过玩家板槽位触发并进入军刀突刺的攻击链"` | 1 passed（2026-06-03，截图 82-84 覆盖 `fist` 槽位解析为 `sabre-thrust-3`、Host 推进到 Guest 防御阶段，以及全战利品防御骰下的 `Guest HP 50 -> 46` 收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过玩家板槽位触发并结算战略转移 II 的主分支"` | 1 passed（2026-06-03，截图 85-87 覆盖 `calm` 槽位入口、双变体选择 modal 与 `4 个勋章` 主分支 `Guest HP 50 -> 45 / bind 1 / tactical advantage 5` 收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过玩家板槽位触发并结算摇鼓运动 II 的主分支"` | 1 passed（2026-06-03，截图 88-90 覆盖 `lotus` 槽位入口、Guest 自然进入防御阶段，以及 `Host tactical advantage 1 / Guest bind 1 / Guest HP 43` 收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过玩家板槽位触发并结算开拓战场 II 的大顺主分支"` | 1 passed（2026-06-03，截图 91-94 覆盖 `lightning` 槽位入口、变体选择 modal、Guest 自然进入防御阶段，以及 `Host tactical advantage 3 / Guest bind 1 / Guest HP 41` 收口） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应命中并结算虚张声势的弯刀分支"` | 1 passed（2026-06-03，截图 95-96 覆盖 Guest 真实手牌打出后的奖励骰覆盖层，以及弯刀分支 `Host HP 50 -> 48` 收口） |
| `npx tsc --noEmit --pretty false` | 通过（2026-06-01 10:52） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 2 files / 50 tests passed（2026-06-01 10:56） |
| `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` | 1 file / 43 tests passed（2026-06-01 10:56） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算死亡印记的奖励骰分支"` | 1 passed（2026-06-01 10:56，截图 33-34 覆盖死亡印记奖励骰代表链） |
| `npx eslint e2e/helpers/dicethrone.ts e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 0 errors（2026-06-01 18:42；2026-06-01 18:55） |
| `npx tsc --noEmit --pretty false` | 通过（2026-06-01 18:42；2026-06-01 18:55） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "4 人真实入口应先进入 targetingRoll，并按 5/6 把无情诅咒的目标选择权交给正确玩家"` | 1 passed（2026-06-01 18:42，截图 42-45 覆盖 defender captain 选敌、attacker 选敌、火药桶 modal 与双敌方落桶状态链） |
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
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 24 passed / 2 failed（2026-06-02；新增两条后整份扩到 26 条，当时掉红的是既有 `紧缚` 与 `火药桶` 两条旧链，现已修复） |
| `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 通过（2026-06-02；`咒缚` 与火药桶 upkeep 新一轮改测后复核） |
| `npx tsc --noEmit --pretty false` | 通过（2026-06-02；同上轮 `咒缚` / 火药桶 upkeep 改测后复核） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示紧缚在额外投掷中的 CP 门禁与阶段清理"` | 1 passed（2026-06-02；既有旧红链恢复） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算咒缚的维持阶段自伤链"` | 1 passed（2026-06-02；场景已修正为“战术家 discard -> 咒缚海盗 upkeep”，证明咒缚海盗在自己 upkeep 真实受到 4 点不可防止伤害） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应在对手未发起攻击时由咒缚施加火药桶"` | 1 passed（2026-06-02；证明对手在其进攻投掷阶段未发起攻击时，会沿真实入口给咒缚海盗对手施加火药桶） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算火药桶的维持阶段爆炸链"` | 1 passed（2026-06-02；既有旧红链恢复） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算战术家升级牌的共享替换链"` | 1 passed（2026-06-03；截图 76-77 覆盖升级牌真实打出、升级槽位写入与升级后 UI 状态） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算战争贩子的奖励骰分支与额外进攻阶段"` | 1 passed（2026-06-03；截图 78-79 覆盖基础战争贩子奖励骰展示与防御收口后的额外进攻阶段） |
| `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` | 历史上曾 `26 passed`（2026-06-02 20:54），但该结论已被更晚回归取代：最新整跑在最前两条开局/选角用例就被 online room / frontend runtime 不稳定拦住，现象包括 `page.goto ... waitUntil "commit" timeout`、`chrome-error://chromewebdata/`、`localStorage/sessionStorage Access is denied`，随后 26 条全部 `skipped`，并伴随前端服务退出 `code=3221226505`；因此不能再把整份 intake 写成“当前全绿” |
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
| `35-host-war-monger-2-medal-extra-attack.png` | Guest 完成本次防御收口后，Host 真实回到额外进攻 `offensiveRoll`；截图保留战争贩子 II 勋章分支已进入额外进攻阶段的专门证据 |
| `31-guest-flay-bonus-dice.png` | Guest 真实打出抽筋剥皮后进入 5 骰奖励骰覆盖层，截图保留真实入口奖励骰展示证据 |
| `32-guest-flay-branch-applied.png` | 关闭覆盖层后，服务器状态按实际弯刀数收口；截图保留代表性分支结算后的棋盘状态，并可回指 bonus damage 与火药桶落点 |
| `33-guest-marked-for-death-bonus-dice.png` | Guest 真实通过玩家板 `marked-for-death` 槽位触发死亡印记后进入 4 骰奖励骰覆盖层，截图保留真实入口奖励骰展示证据 |
| `34-guest-marked-for-death-branch-applied.png` | 关闭覆盖层后，服务器状态按实际弯刀/战利品/骷髅结果收口；截图保留代表性分支结算后的棋盘状态，并可回指 CP、抽牌、诅咒金币与不可防御伤害落点 |
| `42-four-player-merciless-curse-defender-team-choice.png` | 4 人 2v2 真实入口中，目标骰为 5 时选择权切到防守队队长；截图保留 `dt-defender-choice-panel` 与仅敌队两名候选 |
| `43-four-player-merciless-curse-attacker-choice.png` | 4 人 2v2 真实入口中，目标骰为 6 时选择权切到进攻方；截图保留 Host 的敌方目标选择面板且不出现队友 |
| `44-four-player-merciless-curse-powder-keg-choice.png` | 防守队长选完目标后，Host 真实看到“选择至多两名对手获得火药桶” modal，按钮精确包含 `施加给 P2`、`施加给 P4`、`施加给 P2, P4` 与“不施加火药桶” |
| `45-four-player-merciless-curse-powder-keg-applied.png` | 选择 `施加给 P2, P4` 后，页内 harness 与服务器状态共同证明 `P2/P4` 均获得 1 层火药桶，交互清空且 modal 隐藏 |
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
| `79-host-war-monger-extra-attack-phase.png` | Guest 完成防御收口后，Host 真实回到额外进攻 `offensiveRoll`；截图保留基础战争贩子已进入额外进攻阶段的对象级证据 |
| `80-player2-carpet-bombing-target-choice.png` | 战术家在 4 人真实入口里完成 `targetingRoll` 与必要的目标归属选择后，真实进入 `selectPlayer` 双敌覆盖层；截图保留仅敌队 `P1 / P3` 可选、队友 `P4` 不在候选中的证据 |
| `81-player2-carpet-bombing-applied.png` | 战术家确认 `P1 / P3` 后，服务器断言 `teamA=46`、`player0Hp=46`、`player2Hp=46`、`player3Hp=50` 且交互清空；截图保留双敌目标链收口后的棋盘状态 |
| `82-host-sabre-thrust-offensive-entry.png` | Host 在真实 3 军刀盘面下，`fist` 槽位显示 `data-base-ability-id="sabre-thrust"` 与 `data-resolved-ability-id="sabre-thrust-3"`，且可点击；截图保留军刀突刺对象级真实攻击入口证据 |
| `83-guest-sabre-thrust-defense-entry.png` | Host 推进后，Guest 自然进入 `still-wet-behind-ears` 防御阶段；截图保留不是 direct injection，而是由真实玩家板攻击链打开的防御窗口 |
| `84-host-sabre-thrust-resolved.png` | 把 Guest 防御骰固定成全战利品面并推进后，服务器断言 `Host HP=50 / Guest HP=46`，说明基础 `sabre-thrust-3` 的 4 点伤害已在真实入口里闭环落地 |
| `85-host-strategic-shift-2-entry.png` | Host 在 `4 勋章 + 3 勋章` 同时满足盘面下，`calm` 槽位可点击，且主解析落点为 `data-resolved-ability-id="strategic-shift-2-main"`；截图保留战略转移 II 的真实玩家板入口证据 |
| `86-host-strategic-shift-2-variant-choice.png` | 点击 `calm` 槽位后，真实 UI 弹出“选择发动变体” modal，候选同时包含 `战略转移 II（4个勋章）` 与 `战略转移 II（3个勋章）`；截图保留升级变体选择不是静默自动分支的证据 |
| `87-host-strategic-shift-2-applied.png` | Host 选择 `4 个勋章` 主分支并推进后，服务器断言 `Host 战术优势=5 / Guest bind=1 / Guest HP=45`；截图保留主分支 `grantToken + bind + 5 点不可防御伤害` 的真实收口状态 |
| `88-host-drum-movement-2-entry.png` | Host 在 `3 军刀 + 2 勋章` 盘面下，`lotus` 槽位可点击，且解析落点为 `data-resolved-ability-id="drum-movement-2-main"`；截图保留摇鼓运动 II 主分支的真实玩家板入口证据 |
| `89-guest-drum-movement-2-defense-entry.png` | Host 推进后，Guest 自然进入 `still-wet-behind-ears` 防御阶段；截图保留摇鼓运动 II 不是 direct injection，而是由真实玩家板攻击链打开的防御窗口 |
| `90-host-drum-movement-2-applied.png` | 把 Guest 防御骰固定成全战利品面并推进后，服务器断言 `Host 战术优势=1 / Guest bind=1 / Guest HP=43`；截图保留主分支 `grantToken + bind + 7 damage` 的真实收口状态 |
| `74-guest-weigh-anchor-bonus-die-skull.png` | Guest 从真实手牌打出起锚后，定向 run 命中骷髅分支并进入奖励骰覆盖层；截图保留该对象真实入口的奖励骰展示证据 |
| `75-host-weigh-anchor-parley-applied.png` | 关闭覆盖层后，服务器断言 Host 获得 `休战 1`，且 `card-cursed-pirate-weigh-anchor` 已进入 Guest 弃牌堆；截图保留骷髅分支对目标施加休战后的棋盘状态 |

## 未完成门禁

| 门禁 | 状态 | 说明 |
| --- | --- | --- |
| 官方 human/normal 面完整实现 | scoped-debt | 当前素材只接入咒缚面玩家板；普通面分支已保留测试，但另一套玩家板素材与技能未在本轮素材中出现 |
| 对象级 L3/L4 | partial | 真实入口选角、开局、玩家板/提示板、手牌 atlas 已覆盖；战略防御、送你们去喂鱼、手牌选择、瞭望台三分支、作战室奖励骰、占得上风勋章分支、起锚骷髅分支、虚张声势弯刀分支、赎金跨玩家双步选择链、啜呼目标选择与奖励骰分支、干票大的奖励骰、战争贩子 II 奖励骰代表链、战争贩子 II 勋章专门链、抽筋剥皮奖励骰代表链、死亡印记奖励骰代表链、`咒缚` 自伤/施桶链、`伴装撤退 / 脱战` 真实防御响应手牌链、`反制措施 / 你还嫩了点` 防御阶段入口、深海潜行完整攻击入口、4 人无情诅咒火药桶链、诅咒卡牌自伤抽牌分支、封舱弃手重抽链、分点给我单目标火药桶链、亡灵之爪诅咒金币追加直伤链、诅咒金币维持阶段掉血链与火药桶维持阶段爆炸链都已有对象级或代表性截图链；当前 `partial` 的核心原因回到一批 `L1/L2 shared` / `representative` 对象尚未逐对象登记合法复用依据，以及整份 intake runtime 稳定性仍不足，不能把定点恢复通过外推成整批对象级全绿 |
| 4 人 online readiness 通用稳定性 | risk-watch | 当前无情诅咒 4 人真实链已通过，旧防御链也已在绕过路径下恢复；但这仍不能外推成多人或整份 intake runtime 已稳定，最新整跑仍暴露 online room / frontend runtime 波动，且尚未做重复 soak |
| isolated single-worker DiceThrone runtime 启动稳定性 | risk-watch | 最新最小进房诊断脚本已证明：当前本机在真正进房前就可能随机撞 `bundle-runner` / `vite` / `tsx` 启动期 OOM；这属于运行环境/基础设施 blocker，不应误记成 `反制措施 / 你还嫩了点` 业务回归已定位 |
| `implementation_in_progress` | 保留 | 全流程未完成，不允许移除 |
