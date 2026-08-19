# Smash Up - 极客派系全量审计 evidence

## 1. 基本信息

- 对象：Smash Up / 大杀四方 `geeks` 极客派系。
- 日期：2026-08-19。
- 作者：Codex。
- 文档类型：`audit` / `closeout`。
- 关联范围：当前仓库中 `SMASHUP_FACTION_IDS.GEEKS` 的 13 张派系牌、2 个极客基地、能力实现、基地实现、领域测试和真实入口 E2E。

## 2. 审计范围

- 本轮覆盖的游戏 / 模块 / 对象：`src/games/smashup/data/factions/geeks.ts` 中 4 张随从、9 张行动，以及 `src/games/smashup/data/cards.ts` 中 `base_tabletop`、`base_the_con`，共 15 个对象。
- 本轮覆盖的规则子句或共享链路：极客派系打出时、手牌 special、行动反制、持续能力、防护/影响过滤、额外行动、对手手牌查看与借打、基地计分后抽弃、同派系临时力量修正。
- 本轮使用的目标入口 / 环境：领域层 `src/games/smashup/__tests__/abilities/geeks.test.ts`、真实入口 `e2e/smashup/smashup-longzu-audit.e2e.ts`、`e2e/smashup/smashup-geeks-banned-list-ui.e2e.ts`、`e2e/smashup/smashup-geeks-hand-special-and-minmaxing.e2e.ts`。
- 明确不在本轮范围内的对象：非当前 `geeks` 派系对象、其它 promo / POD 复刻、其它派系的长链红点、生产部署和远端线上观察。

## 3. 结论等级

结论等级：`当前范围已收口`。

判定理由：当前锁定范围 15 个对象全部列入对象清单；每个对象都有独立语义结论、实现消费点和最终权威状态证据。用户反馈“极客派系有人说没效果”没有复现为整派系失效；本轮实际定位并修复了 `geeks_non_infinite_loop` 重放 `geeks_banned_list` 时，玩家当前交互先弹“收入手牌”而不是先完成“禁卡表命名”的顺序回归。修复后极客领域 36 条测试、极客长链 7 条真实入口、禁卡表 UI、粉丝 / 平衡真实入口均通过。

## 4. 权威来源

- 主真相源：`src/games/smashup/data/factions/geeks.ts` 中的 13 张极客派系牌，`src/games/smashup/data/cards.ts` 中 `base_tabletop` / `base_the_con`，以及当前能力实现 `src/games/smashup/abilities/geeks.ts`、基地实现 `src/games/smashup/domain/baseAbilities_expansion.ts`。
- 对照源：`src/games/smashup/__tests__/abilities/geeks.test.ts` 中已锁的对象语义和 finalState 断言，`e2e/smashup/smashup-longzu-audit.e2e.ts` / `smashup-geeks-banned-list-ui.e2e.ts` / `smashup-geeks-hand-special-and-minmaxing.e2e.ts` 中真实入口断言。
- 关键规则原文 / 裁定：本轮不引入外部规则书改写；以仓库当前已录入的中文名、英文名、类型、触发入口和既有能力测试作为当前合同。用户反馈“有人说没效果”作为待核对输入，不直接替代规则真相。
- 合同状态：`locked`。当前 15 个对象均能从静态数据追到实现消费和测试证据；无合同冲突对象。

## 5. 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | `passed` | 当前范围为 13 张 `geeks` 派系牌 + 2 个极客基地；第 5 节完整列出 15 个对象。 |
| 真相源状态 | `passed` | 主真相源为仓库当前静态数据、能力实现、基地实现和已锁领域测试；无外部规则冲突输入。 |
| 原子语义断言 | `passed` | 第 7 节按每个对象拆出触发时机、主体、目标、可选 / 强制、最终状态和负向边界。 |
| 实现消费链 | `passed` | 第 7 节逐对象绑定 `registerAbilityProgram`、`registerTrigger`、`registerBaseAbility`、handler、validator / command 或 finalState 消费点。 |
| 最终权威结果 | `passed` | 领域测试断言 hand / deck / discard / base minions / temp power / VP / controller / interaction current / queue finalState。 |
| 交互真实入口 | `passed` | 极客长链 7 条 E2E、禁卡表 UI E2E、粉丝 / 平衡真实手牌 E2E 均通过，覆盖 prompt、optionId、点击、可见候选和无残留收口。 |
| 验证证据 | `passed` | 第 8 节记录红测、修复后 Vitest 和 E2E 命令；测试语义对账包含负向断言和旧测试过窄修正。 |
| 共享影响与代表链依据 | `passed` | 第 6 节登记 sharedFlowId；共享流程只复用触发队列 / UI 生命周期证据，不替代对象语义。 |
| 缺口分类与范围裁定 | `passed` | 第 9 节记录本轮唯一功能实现阻塞已修复；当前范围内无剩余功能阻塞、语义不一致或必要验证缺口。 |
| 旧 evidence / 旧结论对账回写 | `passed` | 第 10 节说明旧龙族交接 / 深审文档只作为历史对照；本文件成为极客当前全量 closeout 证据。 |
| 残余范围声明 | `passed` | 当前 15 对象范围内无残余范围；非极客长链红点和生产部署属于范围外。 |

## 6. 全量对象清单

| 对象 | 语义审计状态 | 覆盖方式 | sharedFlowId / 直接证据 | 一致性核对 | 剩余差异 | 当前裁定 |
| --- | --- | --- | --- | --- | --- | --- |
| `geeks_felicia_day` / 菲丽希亚 | `独立完成` | `直接验证` | `geeks.test.ts` 菲丽希亚 3 条 | 触发时机=打出；候选生成=其它基地全部随从；权限=来源玩家；payload=移动事件；执行入口=`geeksFeliciaDayProgram`；最终权威状态=基地随从归属；清理语义=同批移动不重复触发 | 无 | `passed` |
| `geeks_wil_wheaton` / 维尔 | `独立完成` | `直接验证` | `geeks.test.ts` + longzu E2E 维尔 | 触发时机=对手行动反应；候选生成=可打基地；权限=响应玩家；payload=基地目标；执行入口=reaction / onPlay；最终权威状态=维尔入场且行动无效；清理语义=reaction 收口 | 无 | `passed` |
| `geeks_game_guru` / 游戏专家 | `独立完成` | `无玩家入口` | `geeks.test.ts` 游戏专家 | 触发时机=持续能力；候选生成=其它玩家能力影响；权限=自动过滤；payload=影响来源；执行入口=ongoing protection；最终权威状态=其它玩家能力不影响，行动牌不被误挡；清理语义=持续能力随场上状态消费 | 无 | `passed` |
| `geeks_fan` / 粉丝 | `独立完成` | `直接验证` | `geeks.test.ts` + hand-special E2E | 触发时机=己方出牌阶段手牌 special；候选生成=真实手牌；权限=持有者；payload=手牌卡 uid；执行入口=`ACTIVATE_SPECIAL`；最终权威状态=粉丝进弃牌并摸 1；清理语义=不消耗普通随从 / 行动额度 | 无 | `passed` |
| `geeks_cosplay` / 角色扮演 | `独立完成` | `直接验证` | `geeks.test.ts` 角色扮演 3 条 | 触发时机=你获得 VP 后；候选生成=手牌 special；权限=获分玩家；payload=打出 / 跳过；执行入口=`geeksCosplayTrigger` + prompt；最终权威状态=额外 1 VP 或保持手牌；清理语义=响应后无残留 | 无 | `passed` |
| `geeks_force_of_wil` / 维尔的力量 | `独立完成` | `直接验证` | `geeks.test.ts` + longzu E2E 维尔的力量 | 触发时机=对手打出行动；候选生成=可反制行动；权限=响应玩家；payload=目标行动实例；执行入口=action counter；最终权威状态=标准 / 持续行动均可被无效，反制链可嵌套；清理语义=counter stack 收口 | 无 | `passed` |
| `geeks_rules_lawyer` / 规则咬定者 | `独立完成` | `直接验证` | `geeks.test.ts` + longzu E2E 规则咬定者 | 触发时机=打出标准行动；候选生成=场上持续行动；权限=行动玩家；payload=来源持续行动 + 新目标；执行入口=`geeksRulesLawyerProgram`；最终权威状态=基地持续或附着行动移动且效果跟随；清理语义=原位移除新位写入 | 无 | `passed` |
| `geeks_banned_list` / 禁卡表 | `独立完成` | `直接验证` | `geeks.test.ts` + banned-list UI E2E + longzu E2E 组合 | 触发时机=打出标准行动；候选生成=当前对局已选派系卡名；权限=行动玩家；payload=命名卡牌 defId；执行入口=`geeksBannedListProgram`；最终权威状态=目标玩家手牌同名牌到底牌，空手跳过；清理语义=多对手顺序收口 | 无 | `passed` |
| `geeks_griefer` / 嘲讽 | `独立完成` | `直接验证` | `geeks.test.ts` 嘲讽 3 条 | 触发时机=打出标准行动；候选生成=每个对手的合法效果；权限=来源玩家选择，对手作为效果主体；payload=目标对手和效果选择；执行入口=`geeksGrieferProgram`；最终权威状态=按顺序处理、目标玩家自己身份结算、无合法效果跳过；清理语义=逐对手 prompt 收口 | 无 | `passed` |
| `geeks_mulligan` / 妙力一击 | `独立完成` | `直接验证` | `geeks.test.ts` + longzu E2E 妙力一击 | 触发时机=打出标准行动；候选生成=牌库顶五；权限=行动玩家；payload=选择加入手牌的顶牌；执行入口=`geeksMulliganProgram`；最终权威状态=选择牌入手，其余手牌洗回牌库；清理语义=牌库不足时先洗弃牌堆后收口 | 无 | `passed` |
| `geeks_control_minion` / 控制仆从 | `独立完成` | `直接验证` | `geeks.test.ts` + longzu E2E 控制仆从 | 触发时机=标准行动或手牌 triggered special；候选生成=目标随从；权限=来源玩家；payload=目标随从 uid；执行入口=`geeksControlMinionProgram` / triggered prompt；最终权威状态=取得控制直到回合结束恢复；清理语义=turn-end 归还 | 无 | `passed` |
| `geeks_non_infinite_loop` / 无限循环 | `独立完成` | `直接验证` | 新增红测 + `geeks.test.ts` + longzu E2E 无限循环 | 触发时机=打出标准行动；候选生成=手牌中可额外打出的标准行动；权限=行动玩家；payload=被重放行动 uid / 目标；执行入口=`executeGeeksNonInfiniteLoopPlay` + external action continuation；最终权威状态=被重放行动先完整结算，再选择是否收入手牌；清理语义=禁卡表等多步 prompt 完成后才进入回手提示 | 无 | `passed` |
| `geeks_min_maxing` / 平衡 | `独立完成` | `直接验证` | `geeks.test.ts` + hand-special E2E | 触发时机=打出标准行动；候选生成=对手手牌行动；权限=行动玩家查看并选择；payload=目标对手、行动 uid、目标基地 / 随从；执行入口=`geeksMinMaxingProgram`；最终权威状态=可跳过、可借打无目标行动、可借打附着行动且按当前玩家身份生效；清理语义=借打行动进入拥有者弃牌 | 无 | `passed` |
| `base_tabletop` / 桌游桌 | `独立完成` | `直接验证` | `geeks.test.ts` + longzu E2E 桌游桌 | 触发时机=基地计分后；候选生成=冠军抽牌后手牌；权限=冠军；payload=弃 2 张选择；执行入口=`registerBaseAbility('base_tabletop','afterScoring')` + handler；最终权威状态=先摸 3，再弃 2；清理语义=手牌不足时直接弃全部不造卡死 prompt | 无 | `passed` |
| `base_the_con` / 展会 | `独立完成` | `无玩家入口` | `geeks.test.ts` 展会 | 触发时机=随从打到该基地；候选生成=这里其它同派系随从；权限=自动；payload=临时力量事件；执行入口=`registerBaseAbility('base_the_con','onMinionPlayed')`；最终权威状态=其它同派系本回合 +1，不影响不同派系和刚打出的随从；清理语义=临时力量生命周期随回合清理 | 无 | `passed` |

## 7. 共享流程审计与引用复用

| sharedFlowId | 流程职责 | 一次性审计证据 | 流程不变量 | 允许配置差异 | 失效影响面 |
| --- | --- | --- | --- | --- | --- |
| `SU-ability-runtime-simple-choice` | 能力 prompt 创建、optionId 响应、handler / continuation 收口 | `geeks.test.ts` 36 passed；长链 7 条 E2E；禁卡表 UI E2E；粉丝 / 平衡 E2E | 触发时机由能力注册决定；候选生成来自当前状态；权限判断来自当前决策者；payload / command 携带稳定 uid / defId；执行入口进入 handler / continuation；最终权威状态写入 finalState；清理语义为 `sys.interaction.current` 无残留 | sourceId、文案、候选数量、目标类型、卡牌 defId | prompt 生命周期 bug 需重审所有引用对象；对象语义 bug 只重审对应对象 |
| `SU-action-counter-reaction` | 行动反制和反制嵌套收口 | 维尔 / 维尔的力量领域测试与长链 E2E | 触发时机=对手行动窗口；候选生成=可响应手牌；权限判断=响应玩家；payload=目标行动实例；执行入口=action counter stack；最终权威状态=行动被无效或继续结算；清理语义=counter stack 清空 | 反制来源卡、是否自身入场、目标基地 | action counter 共享 bug 需重审反制类对象 |
| `SU-external-action-continuation` | 额外打出 / 借打行动后，先完成被打出行动的自身链路，再执行后续收口 | 新增无限循环红测；无限循环长链 E2E；平衡 E2E | 触发时机=额外行动选择后；候选生成=可打标准行动；权限判断=来源玩家；payload / command=被打出行动 uid + 目标；执行入口=`appendResolvedActionAbility` continuation；最终权威状态=被打出行动完成后再结算回手或归属；清理语义=多步 prompt 完成后无残留 | 后续动作是回手、弃牌归属或额外限制 | continuation 顺序 bug 需重审无限循环、平衡及同类额外行动 |
| `SU-base-after-scoring-choice` | 基地计分后抽牌 / 弃牌 / 多步选择 | 桌游桌领域测试与长链 E2E | 触发时机=afterScoring；候选生成=计分后最新手牌；权限判断=冠军或对应玩家；payload=弃牌 uid；执行入口=base ability handler；最终权威状态=hand / discard；清理语义=prompt 或自动分支收口 | 抽牌数、弃牌数、玩家选择范围 | 基地 afterScoring 生命周期 bug 需重审相关基地 |

引用判等表：

| 本对象 | 独立语义结论 | sharedFlowId | 一致性核对 | 剩余差异 | 是否需要直测 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 手动 prompt 类对象 | 独立完成 | `SU-ability-runtime-simple-choice` | 触发时机 / 候选生成 / 权限 / payload / 执行入口 / 最终权威状态 / 清理语义均已逐对象核对 | 仅 sourceId、文案、候选类型不同 | 是：本轮均有领域直测；关键对象有 E2E | `passed` |
| 反制类对象 | 独立完成 | `SU-action-counter-reaction` | 维尔、维尔的力量分别覆盖打出入场、无效行动、嵌套反制、持续行动被阻止 | 来源卡和目标行动不同 | 是：均有领域直测 + E2E | `passed` |
| 额外行动类对象 | 独立完成 | `SU-external-action-continuation` | 平衡和无限循环均覆盖候选生成、合法动作、payload、行动结算、后续收口；无限循环补了禁卡表多步顺序红测 | 借打来源和收口方式不同 | 是：均有领域直测 + E2E | `passed` |
| 基地触发类对象 | 独立完成 | `SU-base-after-scoring-choice` | 桌游桌覆盖 afterScoring 交互，展会覆盖 onMinionPlayed 自动触发；两者不互相替代对象语义 | 触发窗口不同 | 是：均有领域直测；桌游桌有 E2E | `passed` |

代表链 / 共享流程口径说明：本轮没有用“一个代表对象证明全派系”的抽样口径。真实入口层存在共享流程引用时，代表对象是 `geeks_banned_list`、`geeks_non_infinite_loop`、`geeks_min_maxing`、`base_tabletop` 等已直测对象；判等依据是触发时机、候选生成、权限判断、payload / command 结构、执行入口、最终权威状态和清理语义逐项一致。其余对象只有在仅配置差异、且第 6 节已有独立语义行和 finalState 证据时，才引用共享流程生命周期证据。

## 8. 原子语义与实现消费

| 对象 | 原子语义断言 | 实现消费点 | 最终权威结果 | 真实入口 / 验证证据 | 缺口分类 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| `geeks_felicia_day` | 打出时把其它基地所有随从同时移到本基地；同批移动不应让同批新进随从错误触发 | `geeksFeliciaDayProgram`、move events、move triggers | 目标基地随从集合正确，移动触发只按真实移动源发生 | `geeks.test.ts` 3 条 | 无 | `功能实现已验证` |
| `geeks_wil_wheaton` | 作为手牌 special 打到基地并无效对手行动 | reaction 入口、action counter、onPlay | 维尔入场，目标行动不结算 | `geeks.test.ts`、longzu E2E | 无 | `功能实现已验证` |
| `geeks_game_guru` | 其它玩家能力不能影响它；其它玩家行动牌不应被误拦 | ongoing protection / affect filter | 能力影响被挡，行动牌影响保留 | `geeks.test.ts` | 无 | `功能实现已验证` |
| `geeks_fan` | 出牌阶段可从真实手牌弃掉并摸 1，不消耗普通额度 | hand special metadata、`ACTIVATE_SPECIAL` | hand 获得抽牌，discard 增加粉丝，额度不变 | `geeks.test.ts`、hand-special E2E | 无 | `功能实现已验证` |
| `geeks_cosplay` | 你获得 VP 后可打出并额外得 1 VP，也可跳过 | `geeksCosplayTrigger`、runtime prompt | 打出时 VP +1 并弃牌；跳过时仍在手牌 | `geeks.test.ts` 3 条 | 无 | `功能实现已验证` |
| `geeks_force_of_wil` | 可反制对手标准 / 持续行动；被反制的反制不应阻止原行动 | action counter stack | 被反制行动不结算；嵌套反制后原行动继续 | `geeks.test.ts`、longzu E2E | 无 | `功能实现已验证` |
| `geeks_rules_lawyer` | 移动场上持续行动到另一合法目标，并保留效果 | target prompts、ongoing detach / attach | 持续行动离开原目标并在新目标生效 | `geeks.test.ts`、longzu E2E | 无 | `功能实现已验证` |
| `geeks_banned_list` | 为每个有手牌对手命名一张当前对局派系卡；同名手牌到底牌 | `geeksBannedListProgram`、card name options、deck-bottom events | 目标玩家同名手牌到底牌；空手玩家跳过 | `geeks.test.ts`、banned-list UI E2E、longzu E2E | 无 | `功能实现已验证` |
| `geeks_griefer` | 逐个对手选择其可执行效果；无合法效果对手跳过 | `geeksGrieferProgram`、per-opponent prompt | 对手按自己身份消灭 / 弃牌 / 跳过 | `geeks.test.ts` 3 条 | 无 | `功能实现已验证` |
| `geeks_mulligan` | 查看顶五，选择加入手牌，其余手牌洗回牌库；牌库不足先洗弃牌堆 | `geeksMulliganProgram`、deck inspection | 选中顶牌入手，原手牌按规则洗回 | `geeks.test.ts`、longzu E2E | 无 | `功能实现已验证` |
| `geeks_control_minion` | 控制目标随从直到回合结束，包含 triggered special 入口 | `geeksControlMinionProgram`、turn-end restoration | controller 临时变更，回合结束恢复 | `geeks.test.ts`、longzu E2E | 无 | `功能实现已验证` |
| `geeks_non_infinite_loop` | 额外打出一张标准行动；若该行动有自身多步交互，先完成它，再选择是否收入手牌 | `executeGeeksNonInfiniteLoopPlay`、`appendResolvedActionAbility` afterAction continuation | 当前交互先是被重放行动 prompt；完成后才是回手 prompt；选择回手后行动回手 | 新增红测转绿、`geeks.test.ts`、longzu E2E | 无 | `功能实现已验证` |
| `geeks_min_maxing` | 查看对手手牌并可借打一张行动；可跳过；行动按当前玩家身份生效并进拥有者弃牌 | `geeksMinMaxingProgram`、opponent hand reveal、external action play | 对手行动被借打，附着目标正确，结算后归拥有者弃牌 | `geeks.test.ts`、hand-special E2E | 无 | `功能实现已验证` |
| `base_tabletop` | 计分后冠军先摸 3，再弃 2；手牌不足时不造无法完成的交互 | `registerBaseAbility('base_tabletop','afterScoring')`、interaction handler | hand / discard 数量正确，低手牌分支自动收口 | `geeks.test.ts`、longzu E2E | 无 | `功能实现已验证` |
| `base_the_con` | 随从打到这里时，这里其它同派系随从本回合 +1；不影响不同派系和刚打出的随从 | `registerBaseAbility('base_the_con','onMinionPlayed')`、temp power events | 只有其它同派系随从获得临时力量 | `geeks.test.ts` | 无 | `功能实现已验证` |

## 9. 验证证据

- 红测命令：`node scripts\infra\vitest-cli-safe.mjs run src\games\smashup\__tests__\abilities\geeks.test.ts --configLoader native --config vitest.config.core.ts -t "无限循环重放禁卡表"`。
- 红测首跑结果：`1 failed`，失败点为当前交互现实含义“玩家当前看到并能处理的弹窗”（内部为 `sys.interaction.current`）先出现 `geeks_non_infinite_loop_return`，预期应为 `geeks_banned_list`。
- 修复后同命令结果：`1 passed`。
- 完整领域命令：`node scripts\infra\vitest-cli-safe.mjs run src\games\smashup\__tests__\abilities\geeks.test.ts --configLoader native --config vitest.config.core.ts`。
- 完整领域结果：`36 passed`。
- 长链极客真实入口命令：`node scripts\infra\run-e2e-single.mjs isolated e2e\smashup\smashup-longzu-audit.e2e.ts "极客："`。
- 长链极客真实入口结果：`7 passed`。
- 禁卡表 UI 命令：`node scripts\infra\run-e2e-single.mjs isolated e2e\smashup\smashup-geeks-banned-list-ui.e2e.ts`。
- 禁卡表 UI 结果：`1 passed`。
- 粉丝 / 平衡真实入口命令：`node scripts\infra\run-e2e-single.mjs isolated e2e\smashup\smashup-geeks-hand-special-and-minmaxing.e2e.ts`。
- 粉丝 / 平衡真实入口结果：`2 passed`。
- 测试语义对账：测试不是只看 prompt 是否存在；新增无限循环测试明确断言当前可处理交互顺序、对手手牌到底牌、回手后 hand / discard finalState。其它测试断言负向路径，包括游戏专家不误挡行动牌、粉丝不消耗普通额度、禁卡表跳过空手玩家、平衡跳过不转移、无限循环被反制不弹回手、角色扮演跳过不加分、桌游桌手牌不足不建卡死交互、展会不影响不同派系和刚打出的随从。
- 没有证明什么：没有证明非极客长链用例、生产环境部署、其它 promo / POD 复刻对象。

## 10. 缺口分类与范围裁定

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞已审计 / 已收口口径 | 当前范围裁定 | 最小补救 |
| --- | --- | --- | --- | --- | --- |
| `geeks_non_infinite_loop` 重放 `geeks_banned_list` 时先出现回手提示 | `功能实现阻塞` | 原本是 | 原本是 | 已修复并验证 | 已把回手提示挂到被重放行动完成后的 continuation，并补红测 / E2E |
| `smashup-geeks-banned-list-ui.e2e.ts` 旧选择器读不到候选卡 | `当前范围验证缺口` | 否 | 原本影响禁卡表 UI 证据 | 已修复并验证 | 已改为读取正式卡牌网格测试入口 |
| 长链文件中非极客用例失败 | `非阻塞扩展` | 否 | 否 | 当前范围外 | 另按对应派系或长链任务处理 |

根因分级：

- 现实故障现象：玩家重放禁卡表后先看到“无限循环：是否将禁卡表收入手牌？”，导致禁卡表命名交互不可作为当前操作入口。
- 触发检测条件：新增领域红测和长链 E2E 都命中当前交互顺序错误。
- 止血 / 恢复动作：不是跳过 E2E，也不是放宽等待；修复了运行时续链顺序。
- 根本机制：无限循环原先把“回手提示”作为同批后处理事件排队；后处理在被重放行动自己的 runtime continuation 之前让回手提示成为当前交互。修复后回手提示改为被重放行动完成后的 afterAction continuation，因此禁卡表这类会创建多步 prompt 的行动会先完整收口。

同类扩审记录：

- 搜索范围：`geeks_non_infinite_loop`、`ACTION_RETURN_TO_HAND_OPTION_ARMED`、`appendResolvedActionAbility`、`afterActionProgram`、`geeks_banned_list` 在 `src/games/smashup/abilities/geeks.ts`、`src/games/smashup/domain/index.ts`、`src/games/smashup/domain/externalActionPlay.ts`、`src/games/smashup/domain/actionCounter.ts`、极客领域测试和极客 E2E 中的调用点。
- 命中项：只有无限循环的无反制路径把回手提示作为同批后处理事件推入；平衡借打没有回手提示，行动反制路径在待结算行动直接执行后追加事件，未复现“后续提示抢当前交互”。
- 残余扩审范围：其它非极客额外行动若以后引入“被重放行动完成后再执行后续 prompt”的语义，应复用 `afterActionProgram` 续链，不再把后续 prompt 放入同批后处理事件。
- 漏审归因：旧测试只验证禁卡表 prompt 和回手 prompt 同时存在，没验证现实玩家当前看到并能操作的是哪个交互；本轮红测把“当前交互顺序”纳入 finalState 断言。

## 11. 修订 / 失效记录

- 旧文档路径：`evidence/smashup/smashup-longzu-implementation-handoff-2026-06-01.md`、`evidence/smashup/smashup-longzu-deep-audit-2026-06-01.md`。
- 旧结论：旧文档可作为规则摘要和历史审计线索；其中极客段不能替代 2026-08-19 当前代码状态。
- 失效原因：本轮发现旧测试只确认 `geeks_banned_list` 和回手 prompt 同时存在，没有断言“玩家当前交互顺序”；因此旧证据不足以挡住真实入口顺序回归。
- 替代旧结论的新证据：本文件第 5-9 节对象清单、红测、修复后领域测试和 E2E。
- 新结论：极客当前 15 对象全量审计已按当前范围收口。
- 是否需要修改旧文档正文中的误导行：不需要原地重写历史文档；本文件记录当前替代证据和旧证据不足点。

## 12. 对外汇报口径

- 允许说：极客全量审计已覆盖当前数据中的 13 张派系牌 + 2 个基地；本轮修复了无限循环重放禁卡表时当前交互顺序错误；修复后极客领域 36 条、极客长链 7 条、禁卡表 UI、粉丝 / 平衡真实入口均通过。
- 允许说：全量不是每个对象都重复跑 E2E；本轮每个对象都有独立语义行和 finalState 证据，真实入口由关键对象直测和共享流程判等共同支撑。
- 禁止说：所有 Smash Up 派系都已审计完成。
- 禁止说：非极客长链失败已经解决。
- 禁止说：旧 evidence 单独足以证明当前极客实现无问题。
