# 王权骰铸 14 张英雄 FAQ 图实现核对（2026-10-20）

## 基本信息

- 对象：本轮用户提供的 14 张角色 FAQ 卡，以及前一轮咒缚海盗 FAQ 中直接关联的“未发动攻击时施加火药桶”规则。
- 当前游戏 `gameId`：`dicethrone`。
- 证据类别：`independent`。
- 日期：2026-10-20。
- 作者：Codex。
- 文档类型：`audit`。
- 关联任务：复核 Dice Throne 线上反馈，并按用户补充的 FAQ 图逐项核对当前实现。

## 审计范围

- 本轮覆盖：发明家、炽天使、女猎手、战术家、武士、枪手、树精、忍者、圣骑士、武僧、暗影贼、火法师、月精灵、野蛮人 14 张 FAQ 卡；另核咒缚海盗的火药桶被动触发判定。
- 覆盖内容：每张图中与运行时规则有关的时机、目标、资源、状态、伤害、防止、闪避、终极技能、伙伴、同队和最终结算问答。单纯发音说明（妮拉读音）记录为非运行时条目。
- 目标环境：当前本地工作树；角色机制测试、共享规则测试、状态注入后的真实领域命令链；咒缚海盗反馈另有双端浏览器 E2E。
- 不覆盖：全 26 角色的全部牌/技能、未出现在这些 FAQ 图中的规则、生产部署及线上版本效果。

### 用户提供的原图清单

根目录：`D:/gongzuo/webgame/gameasset/王权骰铸（全26中文角色）/Mods/Images/`

| 图号 | 角色 | 原图文件名 |
| --- | --- | --- |
| 1 | 发明家 | `httpssteamusercontentaakamaihdnetugc184817498168211048287E75D6DED5C45FE33DBD75062C4C1A6122BDF92.png` |
| 2 | 炽天使 | `httpssteamusercontentaakamaihdnetugc1848174981682111739800F9851C34FD1DA106E76605FCFBC3B069C0A5E.png` |
| 3 | 女猎手 | `httpssteamusercontentaakamaihdnetugc18481749816821074772323CCE97E2E669118C85930FBF8A92BA1EFEC95.png` |
| 4 | 战术家 | `httpssteamusercontentaakamaihdnetugc18481749816821055447690B8E527B361724E683348001C23EA095A9B17.png` |
| 5 | 武士 | `httpssteamusercontentaakamaihdnetugc1848174981682104426FF3DFF1979C778D88ACDF2F435EEEEC9F2A5EB85.png` |
| 6 | 枪手 | `httpssteamusercontentaakamaihdnetugc1848174981682103414264B08B81432CDC67F24C1DF000392B7653A763F.png` |
| 7 | 树精 | `httpssteamusercontentaakamaihdnetugc184817498168210249069ACAD561EC0D3ABE5AD3A49F5503BE850CAB0A4.png` |
| 8 | 忍者 | `httpssteamusercontentaakamaihdnetugc1848174981682101390343FB4F8165753D3274C226501918B8E7DF5A522.png` |
| 9 | 圣骑士 | `httpssteamusercontentaakamaihdnetugc18481749816821001774CAC47E67BC96DE3832D1A5651E201A4769A9536.png` |
| 10 | 武僧 | `httpssteamusercontentaakamaihdnetugc18481749816820990860D26E5DA586AF44D66BD00CF332A6864E1C30E83.png` |
| 11 | 暗影贼 | `httpssteamusercontentaakamaihdnetugc1848174981682097028C7C9369C751417EF3B3C95FBEB8C424DD751CD3D.png` |
| 12 | 火法师 | `httpssteamusercontentaakamaihdnetugc1848174981682092264B03DDDE094F05D97B9CFA1D488125A9149F7101A.png` |
| 13 | 月精灵 | `httpssteamusercontentaakamaihdnetugc18481749816820887082C8C8EAA3B91FD6EA2CBDC889FDF1E087AC6834B.png` |
| 14 | 野蛮人 | `httpssteamusercontentaakamaihdnetugc1848174981682086339C01B464079BE51774ED0A529833F43C5DCB07CB2.png` |

上述文件均为原始完整 FAQ 卡图，按原文件计算 SHA256，未以裁图替代：

| 图号 | SHA256 |
| --- | --- |
| 1 | `01E0801CB35DFA210E81FCD9453B86AE288DDD5A68A90FA381847C182E4DCB61` |
| 2 | `DD92715E0C83A5203B0105C0690CF054ECEA702F70B8D7EFB129513E4EBCEB4E` |
| 3 | `614B88089527B98193E1EBEA64DD14FE350388A2BE0062950129B4CE47AE543B` |
| 4 | `7B2BB340F1EAC93AB1AD67A37025D2A47307A3A6050097C9B9980D67152CE5F1` |
| 5 | `583B9459683F4FD7A0422F94BB4A9A2DDE12CFF9A3E539908239713FA0C1A3A3` |
| 6 | `325C48A4F2AEEB20B1721E61180DA96C87F340D8F3C7E13C765E921D72D6DBA2` |
| 7 | `02023C7658729E830A22216DC6DA70BAC616C2685C228238E95729E414217BC1` |
| 8 | `BB9AB467324B33955AC7421F083D27E5EAA32461B85101CF5FC50E3CDF9DFA7F` |
| 9 | `A266136A0187B27862B342CB81D452189E4668B62704005047FD9F73E7BB08E8` |
| 10 | `D81AE288CEFFFC7738CB0D41D5AE21FBC445F3DF424C2320BB5D86119EF2F500` |
| 11 | `E9FF65C28576D42977ECE9E98204CDC0BAA45BD807BDA13993859BBDD9463F4C` |
| 12 | `8EC294FCA5E27BA15B15EB0E5C4F705AC2A88CAEF579310501B437596CB93EB0` |
| 13 | `10F8F09770BF8C4EA632FAF79030A7B191E92BD17AB1CA85F444C30D35001031` |
| 14 | `979B294976FE03AEBCB5420E6D45901913075DA0FEEF1193F255B6881B473CF8` |
| 咒缚海盗前案原图 | `1B29F613C74326EC50EDDFEFC5A76C3123738502C1B216C3D69B4903AB42FE16` |

## 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | `passed` | 14 张用户原图逐张列出，另将咒缚海盗前案独立列明。 |
| 真相源状态 | `passed` | 直接核对完整 FAQ 原图；通用攻击/附属伤害边界并参考官方 [Dice Throne RulePop 规则索引](https://dice-throne.rulepop.com/)，该索引由官方商店 FAQ 链接。 |
| 原子语义断言 | `passed` | 每角色一行列出图中问答的时机、对象、数值、可选性和负向边界。 |
| 实现消费链 | `passed` | 矩阵列出真正处理规则的英雄 custom action、共享 combat/token/flow 消费者及相应领域测试。 |
| 最终权威结果 | `passed` | 定向 DiceThrone 测试 56 files / 1294 tests 通过；新增回归断言阶段、HP、Token 与攻击标志终态。 |
| 未收口事务生命周期（命中时） | `passed` | 伤害防止/闪避与响应结算按 precommit、响应追加、待结算伤害汇总、最终 HP 收口记录；见下文共享路径表。 |
| 交互真实入口 | `passed` | 咒缚海盗反馈通过双端真实入口，真实选中聚宝盆、跳过响应、推进阶段并读取火药桶终态。 |
| 验证证据 | `passed` | 角色测试、共享机制测试、状态注入全命令链和咒缚海盗 E2E 结果均记录于本文。 |
| 新交互覆盖矩阵 | `not-applicable` | 本次修改不增改按钮、选择项或操作顺序；修正已有规则结果的触发谓词。咒缚海盗原反馈已有同一真实入口结果断言。 |
| 最终截图 PASS 清单与 VIEWER_URL | `not-applicable` | 本轮没有 UI 排版/资产交付；已有 E2E 截图作为规则链辅证，不作为 UI 视觉验收或用户展示组。 |
| 共享影响与代表链依据 | `passed` | 状态响应与伤害结算引用共享消费者；角色差异保留在各英雄矩阵测试中，未由单一角色推断全角色。 |
| 缺口分类与范围裁定 | `passed` | 唯一发现的实现缺陷及修复见“缺口分类”；全 26 角色与生产发布明确排除。 |
| 旧 evidence / 旧结论回写 | `passed` | 两条线上反馈的远端终态及理由已复核；本证据记录前案语义更正和修复范围。 |
| 残余范围声明 | `passed` | 仅裁定本表 14 张 FAQ 及咒缚海盗触发规则；不宣称全英雄或生产环境完成。 |

## 结论等级

- 结论等级：`当前范围已收口`。
- 判定理由：14 张完整 FAQ 图均完成规则到当前实现的逐项核对；发现并修复火法师定向自定义伤害动作的目标元数据错误，补充无伤害技能的负向测试及咒缚海盗状态注入全命令链。其余图中规则与当前英雄处理器、共享规则消费者和定向机制测试相符。
- 证据边界：通过的是当前工作树规则消费和测试；没有证明生产已部署，也没有证明图外规则或其余角色全部完成审计。完整 DiceThrone 全套测试曾报告一个独立的 `criticalImageResolver` 图像尺寸断言失败；本轮最终定向规则测试集通过，不把这项无关失败算作规则回归，也不声称全仓全绿。

## 权威来源

- 主真相源：上表 14 张用户提供的完整角色 FAQ 原图；咒缚海盗原图为 `httpssteamusercontentaakamaihdnetugc1848174981682109745DBC47410A08672A96A2939A379D57E417208776F.png`，位置同上。
- 对照源：`src/games/dicethrone/rule/` 对应英雄规则录入表、运行时角色/状态定义、领域规则消费者和定向测试。通用攻击语义参照官方 [RulePop](https://dice-throne.rulepop.com/)；官方商店 [Dice Throne FAQ](https://shop.dicethrone.com/pages/faq) 链接到此规则索引。
- 关键规则裁定：咒缚海盗被动检查“是否发动了攻击”，不以阶段名称、已选择技能或最终 HP 是否下降代替。定向攻击被休战/防止效果归零仍是攻击；纯自我效果、纯状态效果、只造成附属伤害且没有直接对手伤害目标的技能不算攻击。状态注入后必须跑真实领域命令消费链并读最终状态。
- 合同状态：`locked`。
- 原图核对：确认用户提供的是完整角色 FAQ 卡图，表中逐个保留原始文件名。卡面问答是本次语义依据；测试只证明实现消费，不反过来定义规则。

## 逐项结论：14 张 FAQ 卡

| 对象 | 原子语义断言（按原图 FAQ） | 实现消费点 | 最终状态 / 直接验证证据 | 缺口分类 | 结论 |
| --- | --- | --- | --- | --- | --- |
| 发明家（图 1） | 机器人是伙伴而非状态；合成器动作按各自时机与免费激活条件消费；纳米爆弹在机器人激活时引爆；电能机器人加伤并入本次攻击；治疗机器人需要至少 6 点受击伤害。 | `heroes/artificer/`、`domain/customActions/artificer.ts`、`domain/damagePreventionCommit.ts`。 | `artificer-mechanics.test.ts` 等断言机器人不可移除/转移、爆弹目标与伤害、机器人费用/激活、+3 攻击伤害与受击阈值。 | 无 | 通过 |
| 炽天使（图 2） | 闪避层数与实际消费数量相同，可在获得后即时使用；不能避免终极伤害；眩光不能阻止终极技，终极技后清除；神圣降临可移除不可转移；神圣祝福防止 HP 降至 0，但不清除眩晕且后续维持伤害照常。 | `domain/customActions/tianshi.ts`、`domain/tokenResponse.ts`、`domain/statusRemoval.ts`、`domain/executeTokens.ts`。 | `tianshi-rule-matrix.test.ts`、`tianshi-behavior.test.ts`、`token-execution.test.ts`、`paladin-behavior.test.ts` 覆盖终极封锁、状态移除/转移属性、致死防止和最终 HP。 | 无 | 通过 |
| 女猎手（图 3） | 妮拉是伙伴而非玩家/对手，不能作为普通玩家目标或获得状态；只有可承受的普通攻击伤害才可转移给她；眩晕限制主动行动；妮拉之系花费与同回合即时行动、治疗/承伤边界按图结算。 | `heroes/lieren/`、`domain/customActions/lieren.ts`、`domain/statusRemoval.ts`、伤害目标解析。 | `lieren-rule-matrix.test.ts` 覆盖妮拉激活/倒下/恢复、状态目标排除、普通攻击承伤与终极技不可转移；`lieren-intake.test.ts` 覆盖对象合同。发音问答无运行时行为。 | 无 | 通过 |
| 战术家（图 4） | 战术优势在获得后可立即花费，堆叠上限时仍可消费已持有层；即时移除状态可在移除前花费，回合结束移除不能；多层守护在同一次攻击的最终结算时一起减伤；同回合新获战术优势可使用。 | `domain/customActions/zhanshujia.ts`、`domain/tokenResponse.ts`、`domain/flowHooks.ts`。 | `zhanshujia-cursed-pirate-mechanics.test.ts`、`token-execution.test.ts`、`flow.test.ts` 覆盖响应权限、阶段/回合边界与共享伤害结算。 | 无 | 通过 |
| 武士（图 5） | 羞辱不减少已发动终极技的伤害；反击能处理不可防御普通伤害但不能回应终极伤害；进攻投掷阶段至少 3 次投掷才触发荣誉，少于 3 次只给 1 荣誉；羞辱只在造成伤害的攻击后移除，2 层遇到至少 1 点攻击伤害时均移除。 | `domain/customActions/samurai.ts`、`domain/tokenResponse.ts`、共享进攻投掷计数与结算。 | 武士机制/Token/跨英雄测试、`token-execution.test.ts` 覆盖羞辱、荣誉、反击和终极防止边界。 | 无 | 通过 |
| 枪手（图 6） | 全面防止来袭伤害时仍按 FAQ 获得战斗点数；闪避可多次使用但受堆叠上限约束；终极伤害不能闪避；不可防御普通伤害仍可闪避；改骰牌按当前阶段许可；重新装弹上限为 2。 | `domain/customActions/gunslinger.ts`、`domain/tokenResponse.ts`、`domain/commandValidation.ts`。 | `gunslinger-loaded-contract.test.ts`、`gunslinger-take-cover-loaded-vs-stand-tall.test.ts`、`preventDamage.test.ts` 和 `flow.test.ts` 覆盖层数、时机、终极限制与伤害防止。 | 无 | 通过 |
| 树精（图 7） | 幼种树灵/木苗树灵按玩家回合和每种一次限制即时花费；资源上限不阻止消费已持有资源；移除树灵不返还已花费资源；自然之触按发动能力时的树灵快照算伤害；刺藤只在规定的正常进攻投掷结算时造成伤害；攻击中伤害同时结算，不能中途提前判败。 | `domain/customActions/treant.ts`、`domain/flowHooks.ts`、`domain/statusRemoval.ts`、攻击结束结算。 | `treant-token-mechanics.test.ts` 直接覆盖每回合限制、即时动作、奖励骰与普通投掷区分、刺藤伤害/移除和状态防止。 | 无 | 通过 |
| 忍者（图 8） | 烟雾弹只可在发动攻击后、进攻投掷阶段结束前用于该次攻击；奖励骰可被相应牌修改；慢性中毒等维持伤害可按图闪避；终极伤害不能被烟雾弹防止；达到堆叠上限后仍可即时花费已有烟雾弹。 | `domain/customActions/ninja.ts`、`domain/tokenResponse.ts`、`domain/commandValidation.ts`。 | `ninja-token-mechanics.test.ts`、`ninja-ability-card-contract.test.ts`、`flow.test.ts` 覆盖当前攻击修正、阶段截止、连续使用/上限、终极伤害门禁。 | 无 | 通过 |
| 圣骑士（图 9） | 教会税可在任意时点重掷任意一颗骰；暴击仅在被防止前伤害达到阈值时可用；神圣祝福防止致死但不降低终极伤害；同次攻击的多层守护在攻击结算时统一减伤；新获得守护可立即使用；守护与反弹按各自数值独立结算。 | `domain/customActions/paladin.ts`、`domain/tokenResponse.ts`、`domain/damagePreventionCommit.ts`、`domain/reduceCombat.ts`。 | `paladin-behavior.test.ts`、`paladin-tokens.test.ts`、`paladin-blessing-removable.test.ts`、`token-execution.test.ts` 覆盖 HP=1、护盾层数、触发阈值及攻击者反伤终态。 | 无 | 通过 |
| 武僧（图 10） | 气在能力结算后可花费，同回合刚获得的气按图不能提前用于该能力；不减少队友承受的伤害；可防止状态/普通不可防御伤害但不能阻止终极伤害；资源上限按收纳盒初始数量记录；闪避即时可用但不防终极伤害。 | `domain/customActions/monk.ts`、`domain/tokenResponse.ts`、`domain/damagePreventionCommit.ts`。 | `monk-faq.test.ts`、`monk-behavior.test.ts`、`monk-abilities-coverage.test.ts`、`token-execution.test.ts` 覆盖即时消费、终极限制、团队目标边界与资源结算。 | 无 | 通过 |
| 暗影贼（图 11） | 暗影不因攻击而消耗，只在持有者回合结束移除且不叠加；可按图避免中毒维持伤害和普通不可防御伤害；不能防止已成功发动的终极伤害；防御投掷后可用的其他技能受 FAQ 时机限制；技能伤害按发动时 CP 快照计算。 | `domain/customActions/shadow_thief.ts`、`domain/abilityLookup.ts`、`domain/flowHooks.ts`、`domain/tokenResponse.ts`。 | `shadow-thief-tokens.test.ts`、`shadow_thief-behavior.test.ts`、`shadow-thief-abilities.test.ts`、`monk-vs-shadow-thief-shield.test.ts` 覆盖上限、持续/消耗、终极门禁与攻击修正。 | 无 | 通过 |
| 火法师（图 12） | 2v2 全体附属伤害分别施加到对手并汇总团队生命；眩晕只因符合条件的攻击结算触发额外攻击；纯状态技能无伤害则不构成攻击；第二次进攻投掷开始时清理眩晕；流火等技能不要求先花费火焰专精。 | `heroes/pyromancer/abilities.ts`、`domain/customActions/pyromancer.ts`、`domain/abilityLookup.ts`、`domain/flowHooks.ts`。 | `pyromancer-abilities.test.ts`、`pyromancer-coverage.test.ts`、`pyromancer-behavior.test.ts`、`pyromancer-tokens.test.ts`；新增回归断言 `meteor-shower` 保留眩晕并停在 main2，无伤害/无攻击标记；咒缚海盗配对状态注入测试断言 `meteor-shower` 触发火药桶、HP 不变。 | 已修复 | 通过 |
| 月精灵（图 13） | 闪避数量与规则骰组对应；能以多个闪避尝试防止普通攻击伤害，但不能避免终极伤害；单个状态指示物按图避免维持阶段状态伤害；锁定额外伤害在进攻投掷阶段结束统一结算；分心使无伤害技能失败，终极技不受阻且分心在攻击流程收口清除。 | `domain/customActions/moon_elf.ts`、`domain/tokenResponse.ts`、`domain/flowHooks.ts`、`domain/execute.ts`。 | `token-execution.test.ts` 新增状态注入全命令链：致盲目标选择圣骑士 Holy Light 后，正式 `executePipeline` 收口到 main2，HP 不变且无攻击奖励；`flow.test.ts`、共享防止/终极边界测试覆盖时机与闪避。 | 无 | 通过 |
| 野蛮人（图 14） | 眩晕阻止持有者主动行动但不阻止队友行动；防御投掷治疗与攻击伤害在阶段收口；状态在伤害防止前后按各自时序处理；额外伤害不可防御标记与骰面条件按 FAQ 生效。 | `domain/customActions/barbarian.ts`、`domain/flowHooks.ts`、`domain/damagePreventionCommit.ts`、`domain/statusRemoval.ts`。 | `barbarian-behavior.test.ts`、`barbarian-coverage.test.ts`、`barbarian-abilities.test.ts`、`token-execution.test.ts` 覆盖防御治疗、状态防止先后、队友行动边界与伤害终态。 | 无 | 通过 |

## 咒缚海盗前案：攻击意图与火药桶被动

| 对象 | 原子语义断言 | 实现消费点 | 最终权威结果 | 验证证据 | 缺口分类 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 咒缚被动（原图：咒缚海盗 FAQ） | FAQ 区分“没有造成实际伤害”和“没有发动攻击”：被休战等效果归零的对手伤害仍算攻击；选择了不对对手造成伤害的能力不算攻击。阶段标签、技能已选或骰子已确认都不能单独决定被动。 | `domain/abilityLookup.ts` 的 `playerAbilityTargetsOpponentWithDamage` → `domain/execute.ts` 写入 `ATTACK_INITIATED.countsAsOffensiveAttackMade` → `domain/flowHooks.ts` 在阶段结束消费；Pyromancer 直接伤害 action 的目标字段在 `heroes/pyromancer/abilities.ts`。 | `cornucopia` 和纯状态 `meteor-shower` 的攻击标记为 false；定向伤害技能被标为 opponent attack。完整执行后咒缚对前两者施加火药桶，HP 不变；真实攻击即使休战/眩光令伤害为 0 也不应触发火药桶。 | `zhanshujia-cursed-pirate-mechanics.test.ts` 配对前态/反例；`pyromancer-coverage.test.ts`；`zhanshujia-cursed-pirate-intake.e2e.ts` 的真实双端命令链与前/中/后截图。 | 已修复 | 通过 |

## 共享伤害响应生命周期

FAQ 中涉及闪避、守护、伤害防止、反弹或受击响应的条款共同核对同一消费顺序，不把响应提示或中间值当作最终结果：

| 生命周期节点 | 直接证据 / 当前结论 |
| --- | --- |
| 窗口打开前（precommit） | `reduceCombat.ts` 建立本次攻击和初始伤害；`damage-settlement-boundary.test.ts` 覆盖初始攻击伤害进入待结算状态。 |
| 窗口内追加（append） | `tokenResponse.ts`、`executeTokens.ts` 与角色 custom action 按允许时机把防止/闪避/反弹写入当前消费路径；角色机制测试包含玩家和时机拒绝路径。 |
| 同一事务累计投影 | 待结算伤害状态汇总攻击伤害、防止量、不可防御及 Ultimate 限制；`preventDamage.test.ts`、`preventStatus.test.ts` 与 `damage-settlement-boundary.test.ts` 覆盖共享累计规则。 |
| 窗口关闭后（closeout） | `reduceCombat.ts` / `damagePreventionCommit.ts` 消费最终伤害并更新 HP、护盾/Token 与阶段；上述测试断言净伤害、HP、防止资源消费与状态清理。 |

共享路径不代替角色差异断言：终极伤害是否能被防止、伙伴是否接收伤害、是否仅阻止状态、每个状态的移除时机仍分别由上表角色项核对。

## 共享流程审计与引用复用

| sharedFlowId | 流程职责 | 一次性审计证据 | 流程不变量 | 允许配置差异 | 失效影响面 |
| --- | --- | --- | --- | --- | --- |
| `dt-attack-damage-response-settlement-20261020` | 攻击/受击响应的伤害、防止、闪避和 HP 最终结算 | `damage-settlement-boundary.test.ts`、`preventDamage.test.ts`、`preventStatus.test.ts`、`token-execution.test.ts` | 响应前锁定原攻击与初值；窗口内效果按顺序追加到同次结算；窗口关闭后只按最终值更新 HP/状态并清理；Ultimate 限制在共享消费点保留 | 英雄自己的代价、目标、每层数值和可用时机由上表单独断言，不视为共享流程可变字段 | 这些共享测试变化会影响所有引用本链的英雄；不能据此推断其专属条件也通过 |

共享链判等依据：代表对象是圣骑士神圣祝福致死防止和枪手闪避防止；二者的角色条件与消费数量不同，判等仅用于“伤害最终提交及状态清理”这一共享结算环节。以下逐项核对共享链：

- 触发时机：每条能力的可用时机仍由英雄逻辑检查；共享链只在相应响应 / 伤害窗口消费已提交效果。
- 候选生成：该自动伤害结算链本身不生成玩家目标候选；需选择目标的技能由各角色 custom action 独立生成和验证。
- 权限判断：实际命令仍由 `commandValidation.ts` / `tokenResponse.ts` 检查当前玩家、阶段和响应资格。
- payload / command 结构：响应命令在领域系统中消费，并将结果写入同次攻击/受击结算数据。
- 执行入口：`executeTokens.ts`、`tokenResponse.ts`、`reduceCombat.ts` 与 `damagePreventionCommit.ts`。
- 最终权威状态：最终 HP、剩余护盾/Token、攻击阶段或回合阶段。
- 清理语义：结算后清除本次响应和待结算伤害字段，不留下可被下一次攻击重复消费的效果。

| 本对象 | 独立语义结论 | sharedFlowId | 一致性核对 | 剩余差异 | 是否需要直测 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 炽天使、武士、枪手、忍者、圣骑士、武僧、暗影贼、月精灵、野蛮人 FAQ 中涉及响应/防止/闪避的条款 | 角色门槛、Ultimate 排除、层数和目标均先独立核对，再引用共享最终伤害消费 | `dt-attack-damage-response-settlement-20261020` | 对照触发时机、候选生成（不适用自动伤害收口）、权限判断、payload / command、执行入口、最终权威状态和清理语义；具体分支见上方各角色测试 | 各英雄效果数值与是否能拦截 Ultimate 不同 | 是：每个角色保留自己的机制/行为用例 | 通过 |

## 缺口分类与范围裁定

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞当前结论 | 当前范围裁定 | 最小补救 |
| --- | --- | --- | --- | --- | --- |
| 火法师若干定向自定义伤害 action 的 `target` 错写为 `self`，导致攻击意图漏判 | `功能实现阻塞`，已修复 | 是，已清除 | 否，修复与回归已通过 | 当前范围内 | 将八个定向伤害 action 修正为 `target: opponent`，并复跑角色与共享测试。 |
| 全 26 角色的 FAQ/卡牌完整性 | `非阻塞扩展` | 否 | 否 | 当前范围外 | 另立对象全集，不从这 14 张图外推。 |
| 生产版本是否包含本地修复 | `非阻塞扩展` | 否 | 否 | 当前范围外 | 发布后再查版本；本报告不称线上已生效。 |

## 验证证据

### 定向规则测试

- 结果：56 个测试文件、1294 条测试全部通过（测试耗时 91.66 秒）。
- 覆盖：14 个角色机制/Token/行为测试；共享 `flow`、`rule-consistency`、`damage-settlement-boundary`、`preventDamage`、`preventStatus`；`token-execution`；火法师攻击分类与咒缚海盗被动配对用例。
- 新增状态注入用例：
  - `pyromancer-coverage.test.ts`：选择无伤害 `meteor-shower` 后走完整攻击/阶段命令链，最终不触发额外攻击、眩晕保留、阶段为 main2。
  - `zhanshujia-cursed-pirate-mechanics.test.ts`：运行火法师无伤害技能和咒缚被动的正向终态，检查攻击标记、火药桶层数和 HP；与真实攻击已发起的最近反例分开断言。
  - `token-execution.test.ts`：月精灵致盲对 Holy Light 的无伤害技能失败，通过 `executePipeline` 后断言 HP、攻击奖励和阶段终态。
- 证明了什么：当前测试路径消费真实领域命令，能区分技能意图、攻击标记、是否造成伤害及阶段推进，并断言最终状态。
- 没有证明什么：没有证明全量 DiceThrone 套件全部通过；本轮之前完整套件曾有一个独立的 `criticalImageResolver` 图像尺寸测试失败，未将其归入游戏规则问题。

### 咒缚海盗真实入口

- E2E：`e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`，测试“真实入口应在对手未发起攻击时由咒缚施加火药桶”，1/1 passed。
- 玩家动作：当前攻击者从真实玩家板选择聚宝盆，处理响应并推进阶段。
- 前/中/后断言：发动后 `countsAsOffensiveAttackMade=false`；阶段结束前火药桶为 0；阶段结束后攻击者到 main2，目标获得 1 层火药桶，HP 不变。
- 截图 / 状态证据：`test-results/evidence-screenshots/dicethrone/zhanshujia-cursed-pirate-intake.e2e/真实入口应在对手未发起攻击时由咒缚施加火药桶/` 下 `78`、`79`、`80` 三张前/中/后截图及同目录的两份状态 JSON。
- 没有证明什么：不证明生产已部署，也不证明除反馈对象以外的所有玩家行为都已真实浏览器覆盖。

### 流程规范验证

- 修改：`.spec/skills/rule-bug-fix-workflow/SKILL.md` 新增事件语义触发谓词、真实命令链最终态断言，以及触发例/最近反例成对状态注入要求。
- `python D:/codex-home/skills/.system/skill-creator/scripts/quick_validate.py .spec/skills/rule-bug-fix-workflow`：`Skill is valid!`。
- `npm run spec:lint`：`spec-lint: OK`。
- `git diff --check -- .spec`：通过；仅显示工作树现有文件的 LF/CRLF 警告。

## 同类扩审记录

- 搜索范围：`src/games/dicethrone/domain/abilityLookup.ts`、`execute.ts`、`flowHooks.ts`、`heroes/pyromancer/abilities.ts`、`domain/customActions/pyromancer.ts`，以及本轮涉及角色的 `heroes/*/abilities.ts` 与领域机制测试。
- 搜索锚点：`playerAbilityTargetsOpponentWithDamage`、`target: 'self'`、`target: 'opponent'`、`target: 'allOpponents'`、`countsAsOffensiveAttackMade`、`meteor-resolve`、`meteor-shower`。
- 命中项：火法师八个造成定向伤害的自定义动作原先错误标为 `target: self`；已改为 `target: opponent`。纯状态 `meteor-shower` 保持无攻击意图；明确的 `allOpponents` 仅附属伤害继续不被误判为指定一名对手的攻击。
- 当前处理：修正八个动作目标元数据；配对测试覆盖“选择无伤害技能”和“定向攻击被防止为 0”两条边界；咒缚真实入口测试检查阶段退出后的最终火药桶状态。
- 残余扩审范围：未为本报告范围外的全部英雄/所有技能建立 `target` 字段对象全集；本次只对 14 张图和咒缚被动消费所需的火法师动作完成直连核对。

### 线上反馈状态复核

- 反馈“暗影贼的 匕首突刺Ⅱ 在系统中需要花费2cp”：线上当前 `closed`；`closedReason` 已写入并从真实接口复读。当前原图/诊断阶段时点不一致，历史购买前 CP 与交易事件缺失；真实手牌拖放 E2E 已证明当前购买从 4 CP 扣到 2 CP、升级到 II 且卡离手，因此当前实现没有成本 bug。
- 反馈“暗影贼对战咒符海盗，海盗翻面后，暗影贼进攻投掷阶段打出‘卡牌大师’，不属于/攻击/，但是未被海盗被动挂炸药桶”：线上当前 `resolved`；`resolvedMethod` 已写入并从真实接口复读。原反馈语义对应“被动是否触发”的实现缺陷，当前树已修正并通过咒缚机制测试 116/116、真实双端 UI E2E 1/1。
- 查询方式：对真实 `https://api.easyboardgame.top/admin-api/feedback` 分页读取 `closed` 与 `resolved` 并按两条 ID 精确筛选；本地状态板不是本项线上状态的判定依据。
- 生产边界：代码修改仍在当前工作树，本报告没有声称生产发布或线上版本已包含修复。

## 旧结论 / 修订记录

- 前案中“只要技能被选中且进入进攻投掷阶段，就算发动攻击”的推论无官方 FAQ 支持，已按咒缚海盗完整 FAQ 改为“是否对对手形成攻击意图”判定。
- `meteor-shower` 旧测试曾把“施加了眩晕状态”误当作攻击，从而期待眩晕触发额外攻击；该用例已修订为无伤害纯状态技能不构成攻击，眩晕保留并进入 main2。
- 原本把火法师 `meteor-resolve` 等自定义伤害 action 的 `target: self` 当作攻击分类依据是错误实现；现修正目标元数据并保留明确的 `allOpponents` 附属伤害语义。
- 反馈“暗影贼匕首突刺Ⅱ需要 2 CP”现况：按当前规则是非 bug，已在线上 `closed` 并写回具体理由；历史局在购买前的 CP / 购买事件缺失，不能回推其当时具体扣费。
- 反馈“未触发咒缚火药桶”现况：当前树真实规则 bug 已修复，线上记录为 `resolved` 并写回修复方式；生产发布未做。

## 对外汇报口径

- 允许说：本轮提供的 14 张 FAQ 卡与咒缚海盗被动相关实现已核对；本地发现的火法师攻击目标元数据缺陷已修复并通过定向规则测试；两条原线上反馈的终态及理由已从真实接口核实。
- 禁止说：全 26 角色审计完成、完整 DiceThrone 测试套件全绿、生产已发布或线上玩家已看到修复。
- 残余范围：图外规则与其余角色未审；生产发布及版本回查未覆盖。
