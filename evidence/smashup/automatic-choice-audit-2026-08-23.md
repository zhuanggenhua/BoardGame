# Smash Up 自动代选专项审计（进行中）

## 1. 基本信息

- 对象：Smash Up 全派系 / 基地 / 共享能力中，牌面要求玩家选择但实现自动代选的规则分支
- 日期：2026-08-23
- 作者：Codex
- 文档类型：audit
- 关联需求 / PR / 任务：用户反馈“幽灵捕手 / 彼得·文克曼 / 埃贡·斯宾格勒等效果不应由系统自动选择”，并追问“同类描述都审了吗”

## 2. 审计范围

- 本轮覆盖的游戏 / 模块 / 对象：`src/games/smashup/abilities/`、`src/games/smashup/domain/baseAbilities*.ts` 中的高风险自动代选模式
- 本轮覆盖的规则子句或共享链路：
  - `choose / 选择`
  - `up to / 至多`
  - `discard a card / 弃掉一张牌`
  - `discard two cards / 弃掉两张牌`
  - `move / transfer to another base / 移动或转移到另一个基地`
  - `destroy / 摧毁`
- 本轮使用的目标入口 / 环境：Vitest 领域测试、能力注册表、基地能力触发器、simple-choice 交互
- 明确不在本轮范围内的对象：视觉截图、线上部署、完整真实房间 E2E

## 3. 结论等级

- 结论等级：`仍有残余范围`
- 判定理由：
  - 已修复两批明确的“无交互路径自动选第一张 / 前几张 / 唯一候选 / 默认是分支”的实现。
  - 本次续审又命中并修复 `bear_cavalry_cub_scout_pod`：牌面是“是否消灭”，旧无交互路径自动选了“是”。
  - 当前 `!ctx.matchState` + 高风险事件扫描剩余命中已逐项看过，属于无交互直接返回空、有明确目标后才执行、强制自动结算，或已知非玩家选择语义。
  - 仍未建立完整全牌库对象清单，也未把所有宽泛 `.slice(0, N)` / 唯一候选旧兜底逐项写成对象级裁定，不能对外说“同类描述已全审完”。

## 4. 权威来源

- 主真相源：项目规则驱动交互标准 `.spec/knowledge/standards/rule-driven-interaction-design.md`
- 对照源：项目描述到实现审计标准 `.spec/knowledge/standards/description-to-implementation-audit.md`
- 关键裁定：
  - 牌面要求玩家选择对象、数量、顺序或是否执行时，即使只有一个合法候选，也必须保留玩家确认。
  - `choose / 选择`、`discard a card / 弃掉一张牌`、`discard two cards / 弃掉两张牌`、`up to / 至多`、`任意数量` 都属于玩家决策语义。
- 合同状态：`locked`（交互裁定已由项目标准锁定）；单张卡牌原文仍按各派系 intake / 卡牌数据逐项核对

## 5. 原子语义与实现消费

| 对象 | 原子语义断言 | 实现消费点 | 最终权威结果 | 真实入口 / 验证证据 | 缺口分类 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| `base_haunted_house_al9000` | 打出随从后，该玩家必须弃一张手牌；弃哪张由该玩家选择，只有一张也不能自动弃 | `src/games/smashup/domain/baseAbilities.ts` | 玩家响应 `base_haunted_house_al9000` 后才产生 `CARDS_DISCARDED` | `npx vitest run src/games/smashup/__tests__/bases/haunted-house-al9000-base.test.ts --configLoader native`：5 passed | 已修复 | 功能实现已验证 |
| `base_tabletop` | 冠军抽 3 后弃 2 张；若实际只有 1/2 张手牌，也要由玩家确认弃牌，不能直接全弃 | `src/games/smashup/domain/baseAbilities_expansion.ts` | 先产生抽牌事件，再挂起 `base_tabletop` 多选；响应后才弃牌 | `npx vitest run src/games/smashup/__tests__/abilities/geeks.test.ts --configLoader native --testNamePattern "桌游桌"`：2 passed | 已修复 | 功能实现已验证 |
| `beauty_and_the_beast_ever_a_surprise` | 选择至多两张弃牌堆角色洗回牌库；不能在无交互路径直接取前两张 | `src/games/smashup/abilities/beauty_and_the_beast.ts` | 玩家响应后才重排牌库 | `npx vitest run ...disney-factions-abilities.test.ts ... --testNamePattern "不断的惊喜"`：passed | 已修复 | 代表性验证 |
| `kree_prepare_to_engage` | 展示牌库顶 5 张后，选择至多两张行动加入手牌；不能自动拿前两张行动 | `src/games/smashup/abilities/marvel_villains.ts` | 无交互路径只保留展示事件；真实路径通过 runtime continuation 进入选择 | `npx vitest run src/games/smashup/__tests__/abilities/marvel-villains.test.ts --configLoader native --testNamePattern "克里"`：2 passed | 已修复 | 代表性验证 |
| `kree_proven_methods` | 从弃牌堆选择至多两张行动放到牌库顶；不能自动取前两张 | `src/games/smashup/abilities/marvel_villains.ts` | 玩家响应后才重排牌库 | 同上 | 已修复 | 代表性验证 |
| `round_table_knights_the_mists_of_avalon` | 选择至多三张弃牌堆角色放到牌库顶；不能默认取前三张 | `src/games/smashup/abilities/round_table_knights.ts` | 玩家响应后才置顶 | `npx vitest run ...round-table-knights.test.ts ... --testNamePattern "阿瓦隆迷雾"`：passed | 已修复 | 功能实现已验证 |
| `wreck_it_ralph_king_candy` / Sugar Rush 分支 | 选择目标基地和可移动随从；不能无交互时自动移动前两个随从到第一目标基地 | `src/games/smashup/abilities/wreck_it_ralph.ts` | 真实路径保留目标基地选择 | `npx vitest run ...disney-factions-abilities.test.ts ... --testNamePattern "糖果国王"`：included in focused pass | 已修复 | 代表性验证 |
| `vigilantes_shift` | 选择弃牌堆至多 2 个随从放到牌库顶；不能无交互时取前两个 | `src/games/smashup/abilities/zhongguo.ts` | 玩家响应后才置顶 | `npx vitest run ...zhongguo-new-factions.test.ts ... --testNamePattern "铁杆神探"`：passed | 已修复 | 功能实现已验证 |
| `lion_king_rafiki` | 从弃牌堆选择一张力量 2 或更低角色返回手牌；不能自动拿第一张 | `src/games/smashup/abilities/disney_four_factions.ts` | 无交互态不产生 `CARD_RECOVERED_FROM_DISCARD`，真实交互由玩家选牌 | `automatic-choice-fallback.test.ts`、`disney-four-factions.test.ts` 聚焦通过 | 已修复 | 功能实现已验证 |
| `truckers_fixin_to_fix_it` | 从弃牌堆选择一张行动返回手牌；不能自动拿第一张行动 | `src/games/smashup/abilities/zhongguo.ts` | 无交互态不产生 `CARD_RECOVERED_FROM_DISCARD` | `automatic-choice-fallback.test.ts`、`zhongguo-new-factions.test.ts` 聚焦通过 | 已修复 | 功能实现已验证 |
| `luchadors_senor_muchoslam` | 从弃牌堆选择一张行动返回手牌；不能自动拿第一张行动 | `src/games/smashup/abilities/international_incident.ts` | 无交互态不产生 `CARD_RECOVERED_FROM_DISCARD` | `automatic-choice-fallback.test.ts`、`international-incident.test.ts` 聚焦通过 | 已修复 | 功能实现已验证 |
| `disco_dancers_ul_disco_lou` | 从弃牌堆选择行动放到牌库顶；不能自动取第一张 | `src/games/smashup/abilities/zhongguo.ts` | 无交互态不产生 `CARD_TO_DECK_TOP` | `automatic-choice-fallback.test.ts`、`zhongguo-new-factions.test.ts` 聚焦通过 | 已修复 | 功能实现已验证 |
| `polynesian_voyagers_volcanic_uprising` | 插入新基地后，是否 / 哪个己方随从移动到新基地由玩家决定；不能自动移动第一个己方随从 | `src/games/smashup/abilities/polynesian_voyagers.ts` | 无交互态仍可插入新基地，但不产生 `MINION_MOVED` | `automatic-choice-fallback.test.ts`、`polynesian-voyagers.test.ts` 聚焦通过 | 已修复 | 功能实现已验证 |
| `time_travelers_its_astounding` | 从弃牌堆选择一张行动作为额外行动打出；不能自动打第一张行动 | `src/games/smashup/abilities/yuanhou.ts` | 无交互态不产生 `ACTION_PLAYED` | `automatic-choice-fallback.test.ts`、`yuanhouFactionAbilities.test.ts` 聚焦通过 | 已修复 | 功能实现已验证 |
| `time_travelers_time_is_fleeting` | 从基地弃牌堆选择基地放到基地牌库顶；不能自动取第一张基地 | `src/games/smashup/abilities/yuanhou.ts` | 无交互态不产生 `BASE_DECK_REORDERED` | `automatic-choice-fallback.test.ts`、`yuanhouFactionAbilities.test.ts` 聚焦通过 | 已修复 | 功能实现已验证 |
| `paladins_roland` / `paladins_seraphim` | Roland 可以打出 Seraphim；Seraphim 入场后摧毁哪个弱随从必须玩家确认 | `src/games/smashup/abilities/paladins.ts` | 无交互态可保留 Seraphim 入场事件，但不自动产生 `MINION_DESTROYED` | `automatic-choice-fallback.test.ts`、`paladins.test.ts` 聚焦通过 | 已修复 | 功能实现已验证 |
| `superheroes_mind_lady` | 选择另一名玩家的随从并压制能力；不能自动压制第一个对手随从 | `src/games/smashup/abilities/superheroes.ts` | 无交互态不产生 `CARD_SUPPRESSED` | `automatic-choice-fallback.test.ts`、`superheroes.test.ts` 聚焦通过 | 已修复 | 功能实现已验证 |
| `killer_plant_sprout` | 自毁可以自动发生，但从牌库选择并打出哪个合格随从必须玩家确认 | `src/games/smashup/abilities/killer_plants.ts` | 无交互态可产生自毁，不产生 `MINION_PLAYED` | `automatic-choice-fallback.test.ts`、`killer-plants.test.ts` 聚焦通过 | 已修复 | 功能实现已验证 |
| `killer_plant_venus_man_trap` | 从牌库选择力量不大于 2 的随从打出；不能自动打第一张合格随从 | `src/games/smashup/abilities/killer_plants.ts` | 无交互态不产生 `MINION_PLAYED` | `automatic-choice-fallback.test.ts`、`killer-plants.test.ts` 聚焦通过 | 已修复 | 功能实现已验证 |
| `bear_cavalry_cub_scout_pod` | 对手低力量随从移入时，POD 斥候是“是否消灭”；不能在无交互态自动选“是” | `src/games/smashup/abilities/bear_cavalry.ts` | 无交互态不产生 `MINION_DESTROYED`；有交互态创建 yes/no 确认 | `automatic-choice-fallback.test.ts`、`bear-cavalry.test.ts` 聚焦通过 | 已修复 | 功能实现已验证 |

## 6. 缺口分类与范围裁定

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞完成口径 | 当前范围裁定 | 最小补救 |
| --- | --- | --- | --- | --- | --- |
| 早段 broad scan 命中的唯一候选旧兜底 | 当前范围验证缺口 / 候选功能阻塞 | 可能 | 是 | 当前范围内 | 本轮已处理直接命中的选择语义对象；仍需生成完整对象清单并逐项留裁定 |
| 宽泛 `.slice(0, N)` / 前 N 张候选命中 | 当前范围验证缺口 | 可能 | 是 | 当前范围内 | 分成固定牌库顶顺序、玩家提交后的上限裁剪、无交互前 N 张自动代选三类 |
| `src/games/smashup/domain/actionCounter.ts` 的 `autoResolveIfSingle: true` | 非阻塞扩展候选 | 否 | 可能 | 当前范围内待复核 | 已初步看见它是“继续结算行动响应链”的纯继续按钮；仍需写一行裁定 |
| 全派系完整对象清单 | 审计留档缺口 | 否 | 是 | 当前范围内 | 生成并回写每个含选择语义对象的结论行 |

## 7. 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | `scoped_debt` | 已覆盖第一批高风险模式；未列完整全派系对象清单 |
| 真相源状态 | `passed` | 项目交互标准已明确“唯一合法候选也不能自动替玩家选择” |
| 原子语义断言 | `scoped_debt` | 已写本轮修复对象；未覆盖全部候选对象 |
| 实现消费链 | `scoped_debt` | 已追到多个能力与基地处理器；仍有候选旧兜底未逐项裁定 |
| 最终权威结果 | `scoped_debt` | 已补对应弃牌 / 置顶 / 重排测试；未全量覆盖 |
| 交互真实入口 | `representative_only` | 多个对象已有 simple-choice 领域测试；未跑真实房间 E2E |
| 验证证据 | `representative_only` | 聚焦 Vitest 已通过；未跑全量测试 |
| 共享影响与代表链依据 | `scoped_debt` | 仍需拆分 `.slice(0,N)` 三类 |
| 缺口分类与范围裁定 | `passed` | 本文第 6 节已声明残余范围 |
| 旧 evidence / 旧结论回写 | `scoped_debt` | 尚未回写旧 closeout 或 completion matrix |
| 残余范围声明 | `passed` | 本文结论为 `仍有残余范围` |

## 8. 验证证据

- 命令：`npx vitest run src/games/smashup/__tests__/bases/haunted-house-al9000-base.test.ts --configLoader native`
  - 结果：5 passed
  - 证明了什么：鬼屋只通过玩家选择弃牌，只有一张手牌也会生成选择请求
  - 没有证明什么：不证明其它基地或派系已经无自动代选
- 命令：`npx vitest run src/games/smashup/__tests__/abilities/geeks.test.ts --configLoader native --testNamePattern "桌游桌"`
  - 结果：2 passed
  - 证明了什么：桌游桌抽牌后 1 张 / 多张手牌都通过玩家选择弃牌
  - 没有证明什么：不证明全部 Geeks 行为
- 命令：`npx vitest run src/games/smashup/__tests__/abilities/disney-factions-abilities.test.ts src/games/smashup/__tests__/abilities/marvel-villains.test.ts src/games/smashup/__tests__/abilities/round-table-knights.test.ts src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --configLoader native --testNamePattern "不断的惊喜|Kree|成熟的方法|准备|阿瓦隆迷雾|铁杆神探|糖果国王"`
  - 结果：3 passed、1 skipped；4 tests passed、126 skipped
  - 证明了什么：部分对象的玩家选择路径正常
  - 没有证明什么：该命令没有命中 Kree 用例
- 命令：`npx vitest run src/games/smashup/__tests__/abilities/marvel-villains.test.ts --configLoader native --testNamePattern "克里"`
  - 结果：2 passed
  - 证明了什么：克里选择 / 回收相关测试仍通过
  - 没有证明什么：不证明漫威反派全文件所有行为
- 命令：`npx vitest run src/games/smashup/__tests__/abilities/dragons.test.ts --configLoader native`
  - 结果：23 passed
  - 证明了什么：龙派系全文件测试通过，包含“只有一个合法随从也必须等待玩家选择后才消灭”
  - 没有证明什么：不证明其它派系唯一候选兜底已清空
- 命令：`npx vitest run src/games/smashup/__tests__/abilities/international-incident.test.ts --configLoader native`
  - 结果：43 passed
  - 证明了什么：国际事件测试通过，包含相扑新人天赋不自动取第一项
  - 没有证明什么：不证明全派系都已审完
- 命令：`npx vitest run src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts --configLoader native --testNamePattern "Secret Agent|Time Raider|秘密特工|时间突袭者"`
  - 结果：6 passed、258 skipped
  - 证明了什么：秘密特工和相关时间突袭者聚焦路径仍通过
  - 没有证明什么：不证明 Yuanhou 全文件所有能力
- 命令：`npx vitest run src/games/smashup/__tests__/abilities/excellent-movies-teens.test.ts --configLoader native`
  - 结果：78 passed
  - 证明了什么：幽灵捕手 / 青少年 / 动作英雄 / 异形变体相关本文件回归测试全通过
  - 没有证明什么：不证明全派系自动代选审计完成
- 命令：`git diff --check -- <本轮相关文件>`
  - 结果：无空白错误；仅出现 LF/CRLF 换行提示
  - 证明了什么：本轮相关 diff 未引入 Git 空白错误
  - 没有证明什么：不证明类型检查或全量测试通过
- 命令：`rg -n "\b(hand|discard)\[0\]" src/games/smashup -g "*.ts"`
  - 结果：非测试实现目录无业务命中
  - 证明了什么：第一批最直接的手牌 / 弃牌堆首张代选模式已清空
  - 没有证明什么：不证明其它数组首项、前 N 张或唯一候选兜底已经清空
- 命令：`npx vitest run src/games/smashup/__tests__/automatic-choice-fallback.test.ts --configLoader native`
  - 结果：1 file passed；6 tests passed
  - 证明了什么：统一无交互回归清单覆盖牌库、弃牌堆、场上行动、基地移动、压制、Seraphim、杀手植物、POD 斥候等选择型旧兜底，不再自动取第一候选或默认“是”
  - 没有证明什么：不证明全牌库对象全集已经闭合
- 命令：`npx vitest run src/games/smashup/__tests__/abilities/bear-cavalry.test.ts --configLoader native --testNamePattern "POD 版斥候|幼熊斥候|Cub Scout|cub_scout"`
  - 结果：1 file passed；5 passed、52 skipped
  - 证明了什么：POD 版幼熊斥候无交互态不消灭；有交互态创建 yes/no 确认
  - 没有证明什么：不证明整个熊骑兵派系全量完成
- 命令：`npx vitest run src/games/smashup/__tests__/abilities/killer-plants.test.ts --configLoader native --testNamePattern "venus|sprout|嫩芽|捕蝇草|牌库搜索"`
  - 结果：1 file passed；12 passed、41 skipped
  - 证明了什么：杀手植物牌库搜索在真实交互下等待确认，无交互态不自动打出候选随从
  - 没有证明什么：不证明杀手植物全文件无其它无关问题
- 命令：`npx vitest run src/games/smashup/__tests__/abilities/paladins.test.ts src/games/smashup/__tests__/abilities/superheroes.test.ts --configLoader native --testNamePattern "Seraphim|Mind Lady|心灵女士|seraphim"`
  - 结果：2 files passed；8 passed、35 skipped
  - 证明了什么：Seraphim 摧毁弱随从、心灵女士压制目标均保留玩家选择
  - 没有证明什么：stderr 中的“能力已被压制”是测试内预期拒绝日志，不是失败
- 命令：`npx vitest run src/games/smashup/__tests__/abilities/disney-four-factions.test.ts src/games/smashup/__tests__/abilities/polynesian-voyagers.test.ts --configLoader native --testNamePattern "斯文|拉飞奇|Sven|Rafiki|火山爆发|Volcanic|volcanic"`
  - 结果：2 files passed；4 passed、23 skipped
  - 证明了什么：拉飞奇弃牌堆回收、火山爆发移动随从路径不自动代选
  - 没有证明什么：不证明迪士尼四派系和波利尼西亚航海者全量收口
- 命令：`npx vitest run src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts --configLoader native --testNamePattern "令人震惊|It's Astounding|time_travelers_its_astounding|时间流逝|time_is_fleeting"`
  - 结果：1 file passed；15 passed、250 skipped
  - 证明了什么：令人震惊、时间流逝保留弃牌堆行动 / 基地选择
  - 没有证明什么：不证明 Yuanhou 全文件所有派系全量审完
- 命令：`npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts src/games/smashup/__tests__/abilities/international-incident.test.ts --configLoader native --testNamePattern "修修补补|Fix|迪斯科·卢|Disco Lou|Muchoslam|muchoslam"`
  - 结果：2 files passed；3 passed、107 skipped
  - 证明了什么：迪斯科·卢、Muchoslam 相关弃牌堆行动路径通过聚焦回归
  - 没有证明什么：不证明中国新派系 / 国际事件全量收口
- 命令：`npx vitest run src/games/smashup/__tests__/abilities/promos-sheep-all-stars.test.ts --configLoader native --testNamePattern "令人惊叹|克苏鲁|its astounding|servitor|All-Stars|all_stars"`
  - 结果：1 file passed；2 passed、21 skipped
  - 证明了什么：令人惊叹、克苏鲁仆从不会自动拿弃牌堆第一张行动
  - 没有证明什么：不证明促销 / 羊群 / 全明星全量收口
- 命令：`npx tsc --noEmit --pretty false --skipLibCheck --noErrorTruncation`
  - 结果：`tsc_exit_code=0`；目标文件无类型错误
  - 证明了什么：本轮相关 Smash Up 能力和测试文件类型检查通过
  - 没有证明什么：不替代真实房间 E2E
- 命令：`rg -n -U '!ctx\.matchState[\s\S]{0,240}(destroyTargets\[0\]|targets\[0\]|\[target\]|recoverCardsFromDiscard|buildCardToDeckTopEvent|buildValidatedMoveEvents|buildValidatedDestroyEvents|transferBaseAction|CARD_SUPPRESSED|MINION_DESTROYED|MINION_MOVED|CARD_RECOVERED_FROM_DISCARD|CARD_TO_DECK_TOP)' src/games/smashup/abilities`
  - 结果：剩余 4 组命中，已人工核对为无交互返回空、有明确目标后执行、强制自动移动或非玩家选择语义
  - 证明了什么：本轮直接锁定的高风险无交互事件写入点没有新增未处理对象
  - 没有证明什么：不证明宽泛数组首项 / 前 N 张 / 全描述对象全集已完成

## 8.1 同类扩审记录与漏审归因

- 同类扩审搜索范围：
  - `src/games/smashup/abilities`
  - `src/games/smashup/domain`
  - `!ctx.matchState` 附近的消灭、移动、回收、置顶、压制、打出、基地替换等事件写入点
  - 数组首项模式：`targets[0]`、`candidates[0]`、`actions[0]`、`discardActions[0]`、`weakest[0]`
  - fallback / default target / first candidate 文案命中
- 命中项处理：
  - 本轮已修复 `bear_cavalry_cub_scout_pod` 无交互态默认选“是”的旧测试和实现。
  - 接续批次已修复弃牌堆回收、弃牌堆行动置顶、基地弃牌堆置顶、牌库搜索打出、压制、Seraphim 摧毁弱随从、火山爆发移动随从等同类对象。
  - 剩余直接命中已人工判定为非本缺陷：唯一最弱强制消灭、玩家已提交选择后的单项结算、随机选择、纯额度计算、明确目标后执行、无交互直接返回空。
- 残余扩审范围：
  - 尚未把所有宽泛 `.slice(0, N)`、唯一候选、first/default 文案命中逐项写成对象清单。
  - 尚未跑真实房间 E2E；当前证据主要是领域测试和静态扫描。
- 漏审归因：
  - 旧测试已经失效：`bear_cavalry_cub_scout_pod` 旧断言把“无交互直接消灭”当正确行为，实际是把“是否消灭”的玩家决策自动选成“是”。
  - 测试断言过窄：早期用例只证明事件能发生，没有同时断言“有交互态先出现 yes/no 确认、无交互态不替玩家做决定”。
  - 审计对象没建全集：此前只按部分首项代选模式补洞，未形成全牌库含选择语义对象清单。

## 9. 对外汇报口径

- 允许说：
  - “还没全审完。”
  - “这轮又扩审并修掉一批明确的自动代选点，包括 POD 版幼熊斥候这种默认选‘是’的旧兜底。”
  - “当前直接扫描命中的高风险无交互事件写入点已处理或判定非本缺陷，但还没建立全牌库完整对象清单。”
  - “仍需继续把宽泛唯一候选兜底和 `.slice(0,N)` 前 N 张候选做成逐对象裁定，才能说同类描述全审完。”
- 禁止说：
  - “全派系同类描述已经审完。”
  - “所有需要玩家选择的效果都不会自动选择。”
  - “这轮已经全部闭合。”
