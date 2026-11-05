# 召唤师战争三项规则问题定向重审记录（2026-09-12）

- 对象：召唤师战争（`summonerwars`）三项用户点名规则问题
- 日期：2026-09-12
- 修订：2026-09-13 用户追问同类问题后追加穿越、身份筛选、当前 11 派系起始图扩审；用户纠正“疫病体”是图面单位标签后回写 Carrier 标签合同；同轮追加城塞 / Citadel 单位身份标签扩审
- 作者：Codex
- 文档类型：`audit`
- 关联任务：用户反馈“草原精灵的牛能穿过传送门，牛应该只能穿过士兵；亡灵召唤师复活死灵应该只能复活亡灵，现在是可以复活地狱火教徒；先锋的初阵有问题，是骑士和牧师，而且站位是骑士在前，牧师在后这个应该要重新看图”
- 结论等级：`当前范围已收口`
- 本轮结论：三条用户点名规则点的功能实现已验证；用户追问“没有同类问题？”后，继续对穿越权限、弃牌堆身份筛选和当前 11 个派系起始提示图做同类扩审。扩审新增发现并修复 1 个同类起始配置问题：莫古起始单位误用“枯萎法师”。同时纠正上一版 evidence 的错误结论：`Infect` 官方原文写的是 `Carrier unit`，中文卡面和规则文字把“疫病体”作为可筛选的单位身份，不能收窄成亡灵法师阵营限定；本轮已把“亡灵 / 疫病体”落成结构化单位标签并让复活、感染、莫古专用筛选共同消费该标签。用户怀疑“没有同类问题”成立：同轮又发现先锋“城塞 / Citadel”也是规则可筛选单位身份，旧实现靠卡名判断会把“城塞参谋”这类名字带城塞但不是先锋 Citadel 身份的单位误纳入城塞消费者；本轮已改为结构化 `citadel` 标签并补负向测试。本文不申请召唤师战争全牌库规则重审完成口径。

## 前提锁定

| 项 | 当前锁定 |
| --- | --- |
| 问题对象 | 1）草原精灵/蛮族系带“践踏”的牛/犀牛类单位移动穿越；2）亡灵召唤师“复活死灵”的弃牌堆目标；3）先锋军团起始单位与站位 |
| 真相来源 | 用户当轮原始症状；能力合同 `trample` 的 `canPassThrough: 'units'`；官方 `Raise the Dead` 原文“Undead unit”；官方 `Infect` 原文“Carrier unit”；官方 `Divine Shield` / `Citadel Champion` 原文里的 `Citadel unit`；本轮复核的完整单卡图 `temp/summonerwars-tag-audit-20260913/necro-plague-zombie-full.png`、`temp/summonerwars-tag-audit-20260913/necro-hellfire-cultist-full.png`、`temp/summonerwars-tag-audit-20260913/mogu-spore-plague-body-full.png`、先锋卡图 `public/assets/i18n/zh-CN/summonerwars/hero/Paladin/compressed/cards.webp`；先锋提示图 `public/assets/i18n/zh-CN/summonerwars/hero/Paladin/compressed/tip.webp` |
| 目标入口 / 环境 | 当前仓库当前代码；移动合法性入口 `canMoveToEnhanced` / `getMovePath`；复活入口 `ACTIVATE_ABILITY`、弃牌堆卡牌选择、相邻落位；感染弃牌堆选择与替换落位；城塞之力 / 城塞精锐 / 神圣护盾的城塞单位消费者；起始配置入口 `createDeckByFactionId('paladin')` |
| 验收口径 | 证明三条点名问题及其直接同类扩审命中项的语义、实现消费点、最终权威状态和负向断言；同时解释旧审计为什么漏掉、规范是否缺失，并声明全牌库规则总审仍不在本轮范围 |

## 审计范围

| 范围 | 本轮状态 | 说明 |
| --- | --- | --- |
| 践踏：只穿过单位，不能穿过传送门 | covered | 覆盖 2 格直线中间格；同类扩审覆盖使用同一移动增强的更长路径和同类穿越能力测试 |
| 复活死灵：只能选择亡灵单位，不能选择地狱火教徒 | covered | 覆盖候选生成、验证、执行器、UI 快速入口和 AI 候选过滤同源亡灵判定 |
| 先锋起始阵型：城塞骑士在前、圣殿牧师在后 | covered | 回看提示图后锁定坐标，并补配置测试 |
| 当前 11 个可选派系起始提示图扩审 | covered | 合成查看 11 张中文提示图并对照 `createDeckByFactionId` 当前输出；新增发现莫古起始单位错误并修复，其余 10 个派系在起始单位名称和相对站位上未见同类错配 |
| 亡灵法师“感染”与莫古“释放菌袍/菌化变异”身份筛选扩审 | covered | 纠正上一版错误结论：疫病体是图面单位分类标签 / Carrier tag，不是亡灵法师阵营内名称关键词；已新增 `unitTags` 字段，`复活死灵` 消费 `undead` 标签，`感染` 消费 `carrier` 标签，莫古专用筛选消费 `mogu + carrier` |
| 先锋“城塞 / Citadel”身份筛选扩审 | covered | 规则原文和先锋卡图显示城塞是可筛选单位身份；旧实现靠卡名判断，可能误收“城塞参谋”这类非先锋 Citadel 单位；已新增 `citadel` 标签并让城塞之力、城塞精锐、神圣护盾消费标签 |
| 全牌库所有能力重新做描述到实现重审 | residual | 本轮只围绕三条已锁问题和共享影响做最小扩审 |

## 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | passed | 当前范围内每个对象已列入审计范围：践踏、复活死灵、感染、先锋城塞身份、先锋初阵、莫古初阵、当前 11 派系起始图扩审；全牌库规则总审不在本轮范围 |
| 真相源状态 | passed | 权威来源表记录能力合同、提示图路径、图片 SHA256、代码对照源和合同状态 |
| 原子语义断言 | passed | 原子语义与实现消费表逐项列出“只穿单位不穿传送门”“只复活亡灵标签单位”“感染只认疫病体 / Carrier 标签单位”“先锋/莫古起始图面站位” |
| 实现消费链 | passed | 实现消费链覆盖 `getUnitMoveEnhancements`、`isCellPassableForMovement`、`unitTags`、`isUndeadCard`、`isCarrierCard`、`isFortressUnit`、执行器、系统候选、配置审查字段和配置生成函数 |
| 最终权威结果 | passed | 最终权威结果落到移动合法性、召唤事件、目标格是否为空、弃牌堆是否移除、起始牌组生成坐标；感染和复活交互响应后验证队列清空、流程收口、无残留 |
| 交互真实入口 | passed | 本轮对象属于领域规则和配置坐标；复活/感染验证覆盖正式 `ACTIVATE_ABILITY` 入口，起始图面用提示图人工核对，未申请浏览器截图验收 |
| 验证证据 | passed | 测试语义对账记录按命令列出；保留旧测试过窄、新负向断言、阶段可继续、流程收口和无残留说明 |
| 共享影响与同类扩审依据 | passed | 共享影响表记录移动穿越、亡灵判定、疫病体判定和当前 11 派系起始图扩审的横向搜索与命中结果 |
| 缺口分类与范围裁定 | passed | 缺口分类表将已修实现问题、留档缺口和全牌库范围外扩展分开裁定 |
| 旧 evidence / 旧结论回写 | passed | 旧 evidence / 旧结论对账表说明旧 UI 链、移动审计和配置审查各自不能证明什么 |
| 残余范围声明 | passed | 残余范围声明保留全牌库规则总审、真实浏览器 E2E 和自动化图面合同三个边界 |

## 权威来源

| 规则点 | 主真相源 | 对照源 | 合同状态 | 本轮图面 / 规则观察 |
| --- | --- | --- | --- | --- |
| 践踏 | `src/games/summonerwars/domain/abilities-frost.ts:223-231` | `src/games/summonerwars/domain/helpers.ts:998-1078` | `locked` | 践踏效果写的是 `canPassThrough: 'units'`，现实含义是“中间格可以有单位”，不是“中间格可以有传送门/建筑” |
| 复活死灵 | `src/games/summonerwars/domain/abilities.ts:318-390` | `src/games/summonerwars/domain/ids.ts:140-155`、`src/games/summonerwars/domain/executors/necromancer.ts:14-39` | `locked` | 文案、目标过滤、验证错误提示都指向“亡灵单位”；地狱火教徒同属亡灵法师阵营，但自身不是亡灵单位 |
| 复活死灵标签复核 | `evidence/summonerwars/b3-p2-rule-text-lock-matrix-2026-07-02.md` 中 `Raise the Dead` 原文 | `temp/summonerwars-tag-audit-20260913/necro-hellfire-cultist-full.png`、`temp/summonerwars-tag-audit-20260913/necro-plague-zombie-full.png` | `locked` | 官方原文要求 `Undead unit`；图面显示地狱火教徒是“士兵单位 · 堕落王国”，没有“亡灵”身份，不能被复活死灵选择；亡灵疫病体的卡名和规则合同共同给出 `undead` 身份 |
| 感染 | `evidence/summonerwars/b4-p2-rule-text-lock-matrix-2026-07-02.md` 中 `Infect` 原文 | `temp/summonerwars-tag-audit-20260913/necro-plague-zombie-full.png`、`temp/summonerwars-tag-audit-20260913/mogu-spore-plague-body-full.png`、`src/games/summonerwars/domain/ids.ts:109-128`、`src/games/summonerwars/domain/executors/necromancer.ts:63-82`、`src/games/summonerwars/domain/systems.ts:2193-2204` | `locked` | 官方原文要求从你的弃牌堆选择 `Carrier unit`；中文图面“亡灵疫病体”和“菌袍疫病体”都把“疫病体”作为单位身份表达，本轮实现按 `carrier` 标签筛选，不再按阵营、卡名关键词或旧测试猜 |
| 城塞单位标签复核 | `evidence/summonerwars/b5-p2-rule-text-lock-matrix-2026-07-02.md` 中 `Divine Shield` / `Citadel Champion` 原文 | `public/assets/i18n/zh-CN/summonerwars/hero/Paladin/compressed/cards.webp`、`src/games/summonerwars/config/factions/paladin.ts:141-193`、`src/games/summonerwars/config/factions/yongheng.ts:96-108` | `locked for paladin citadel consumers` | 官方原文要求 `Citadel unit`；先锋卡图显示城塞圣武士、城塞骑士、城塞弓箭手是城塞单位，圣殿牧师不是；永恒议会“城塞参谋”只有名称含城塞，本轮没有把它标成先锋 `citadel` 身份 |
| 先锋初阵 | `public/assets/i18n/zh-CN/summonerwars/hero/Paladin/compressed/tip.webp` | `src/games/summonerwars/config/factions/paladin.ts:326-367`、`src/games/summonerwars/__tests__/factions.test.ts:183-190` | `locked for paladin only` | 图面文字写“起始单位：圣殿牧师(▲)和城塞骑士(■)”；图上 ■ 在城门前方一排，▲ 在城门右侧同排。图片 SHA256：`8A8068F046D456A26A47CFFAD4826933DF2129B2C73E371B5A3509C45540378E` |
| 莫古初阵 | `public/assets/i18n/zh-CN/summonerwars/hero/mogu/compressed/tip.webp` | `src/games/summonerwars/config/factions/mogu.ts:307-322`、`src/games/summonerwars/__tests__/factions.test.ts:203-215` | `locked for mogu starting setup` | 图面文字写“起始单位：菌化野兽(△)、菌袍疫病体(□)”；图上 △ 在城门前方同列，□ 在城门左侧同排。图片 SHA256：`6FA1C6EB1FE5564B7F38BEF01C7BA83449FE60CC70F46E1E54CBC31A4703AB10` |

## 原子语义与实现消费

| 对象 | 原子语义断言 | 实现消费点 | 最终权威结果 | 真实入口 / 验证证据 | 缺口分类 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 草原精灵/蛮族系带践踏单位 | 移动路径中间格如果是士兵/单位，践踏单位可以通过；如果中间格是传送门/建筑，践踏不能把它当成单位穿过 | `getUnitMoveEnhancements` 把 `canPassThrough: 'units'` 转成 `canPassThrough=true`、`canPassStructures=false`；`isCellPassableForMovement` 分开检查单位和建筑；2 格移动与 BFS 都消费这两个布尔结果 | `canMoveToEnhanced` 对中间格为单位返回可移动；同一格改成传送门后返回不可移动 | `src/games/summonerwars/__tests__/abilities-barbaric.test.ts:405-433` 新增测试断言士兵可穿、传送门不可穿；同类穿越扩审测试已通过 | 旧实现为语义不一致；当前为功能实现已验证 | passed |
| 亡灵召唤师“复活死灵” | 召唤阶段发动时，只能从自己的弃牌堆选择带“亡灵 / Undead”标签的单位；地狱火教徒即使同属堕落王国，也不应进入合法复活目标 | `UnitCard.unitTags` 记录卡面单位标签；`isUndeadCard` 只消费 `undead` 标签；能力 quickCheck、条件、目标过滤、系统卡牌选择、AI 候选和执行器均消费同一函数 | 地狱火教徒被验证拒绝；只有 `carrier` 但没有 `undead` 的菌袍疫病体也被拒绝；执行器不会造成召唤师自伤，不会召唤单位，目标格保持空 | `src/games/summonerwars/__tests__/abilities-necromancer-execute.test.ts` 覆盖地狱火教徒负向、只有 Carrier 非 Undead 负向和亡灵正向；`src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts` 保留复活死灵真实交互链 | 旧实现缺结构化标签字段；当前为功能实现已验证 | passed |
| 亡灵法师“感染” | 本单位消灭一个单位后，可以用你弃牌堆中的一个“疫病体 / Carrier”单位替换被消灭单位；Carrier 不是亡灵法师阵营限定，也不是卡名关键词 | `UnitCard.unitTags` 记录卡面单位标签；`isCarrierCard` / 兼容旧名 `isPlagueZombieCard` 只消费 `carrier` 标签；验证器、系统候选、执行器和条件判断都消费同一 helper | 指定莫古菌袍疫病体且该卡带 `carrier` 标签时，验证通过，执行器召唤到目标格并从弃牌堆移除；非 Carrier 的地狱火教徒仍被拒绝；选牌交互响应后 `sys.interaction.queue` 清空，流程收口且无残留 | `src/games/summonerwars/__tests__/abilities-necromancer-execute.test.ts` 覆盖跨阵营 Carrier 正向与非 Carrier 负向；`src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts` 覆盖真实击杀后感染交互链、选择前后状态和无残留队列 | 上一版 evidence 误把 Carrier 收窄为亡灵法师自家疫病体；当前已纠正 | passed |
| 先锋“城塞 / Citadel”消费者 | 城塞之力、城塞精锐、神圣护盾只能统计或选择带城塞 / Citadel 身份的单位；不能仅因卡名或 id 含“城塞 / fortress”就纳入 | `UnitCard.unitTags` 记录卡面单位标签；`isFortressUnit` 只消费 `citadel` 标签；城塞之力候选、城塞精锐战力加成、神圣护盾目标判断和配置审查字段均消费同一标签 | 先锋三张城塞单位带 `citadel` 标签可被正确统计；圣殿牧师和永恒议会“城塞参谋”不带 `citadel` 标签，不能被城塞之力拿回或误计入先锋城塞消费者 | `src/games/summonerwars/__tests__/abilities-paladin.test.ts` 覆盖名字带城塞但无 Citadel 标签的城塞参谋负向；`src/games/summonerwars/__tests__/configReviewAdapter.test.ts` 覆盖先锋三张城塞单位带标签、城塞参谋不带标签；神圣护盾和战力展示测试夹具改为真实标签 | 旧实现靠名称判断；当前为功能实现已验证 | passed |
| 先锋军团起始阵型 | 起始单位必须是城塞骑士和圣殿牧师；站位是城塞骑士在前，圣殿牧师在后/城门右侧同排 | `createDeckByFactionId('paladin')` 返回 `startingUnits`：城塞骑士 `{ row: 3, col: 2 }`，圣殿牧师 `{ row: 2, col: 4 }` | 新开先锋牌组时，起始单位顺序和坐标与提示图一致；旧“牧师/骑士站位反了”的配置不再生成 | 本轮人工核图 `tip.webp`；`src/games/summonerwars/__tests__/factions.test.ts:183-190` 断言配置输出 | 旧配置审查真相源错误；当前为功能实现已验证 | passed |
| 莫古起始阵型 | 起始单位必须是菌化野兽和菌袍疫病体；站位是菌化野兽在城门前方同列，菌袍疫病体在城门左侧同排 | `createDeckByFactionId('mogu')` 返回 `startingUnits`：菌化野兽 `{ row: 2, col: 3 }`，菌袍疫病体 `{ row: 2, col: 2 }` | 新开莫古牌组时，不再把枯萎法师生成到起始位置 | 合成提示图 `temp/summonerwars-starting-tip-contact-20260913.jpg` 人工核图；当前配置快照；`src/games/summonerwars/__tests__/factions.test.ts:203-215` 断言配置输出 | 同类起始图面错配；当前为功能实现已验证 | passed |

## 共享影响与同类扩审

| 共享点 | 横向搜索范围 | 命中情况 | 裁定 |
| --- | --- | --- | --- |
| 移动穿越权限 | 搜索 `canPassThrough`、`canPassStructures`、`isCellPassableForMovement`、`buildPassableCheck`，并重跑同类移动测试 | 命中 `trample` 只穿单位、`climb`/结构穿越、`flying`/全穿越；移动 helper 已改成单位和建筑分权消费 | 共享抽象已覆盖到 2 格移动与 BFS；本轮不做全能力逐对象图面复核 |
| 复活死灵亡灵判定 | 搜索 `isUndeadCard` 和 `revive_undead` 的领域、系统、AI、UI 消费点 | 条件判断、quickCheck、系统卡牌候选、AI 候选、UI 点击入口和执行器均已回到 `isUndeadCard` | 共享判定同源；地狱火教徒不再因阵营相同误入候选 |
| 疫病体身份判定 | 搜索 `unitTags`、`isCarrierCard`、兼容旧名 `isPlagueZombieCard`、`isMoguSporePlagueBodyCard`、弃牌堆候选和执行器消费点 | 命中旧实现没有结构化单位标签，只能靠名字、阵营和专用 helper 猜；上一版 evidence 还把 `Carrier unit` 错写成亡灵法师自家疫病体 | 已补 `unitTags` 数据合同、配置审查字段和测试夹具；感染按 `carrier` 标签，复活按 `undead` 标签，莫古专用链路按 `mogu + carrier` |
| 城塞身份判定 | 搜索 `isFortressUnit`、`fortress_power`、`fortress_elite`、`divine_shield`、`Citadel unit`、`unitTags` 和名字含 `fortress` 的单位 | 命中旧实现用卡名包含“城塞 / fortress”判断，存在把永恒议会“城塞参谋”误当先锋 Citadel 单位的风险；先锋卡图和规则原文实际要求 Citadel 身份 | 已补 `citadel` 标签、配置审查字段、先锋三张城塞单位数据、城塞参谋负向测试；正式判断不再消费卡名关键词 |
| 当前 11 派系起始阵型 | 搜索 `startingUnits`、11 张 `tip.webp` 路径、配置生成快照，并合成查看中文提示图 | 新命中莫古起始单位错配：图面是“菌化野兽 + 菌袍疫病体”，配置旧写成“枯萎法师 + 菌袍疫病体”；先锋点名问题已修，其余 9 个派系在本轮图面可读范围内未见同类错配 | 当前 11 派系起始图与配置快照已做定向扩审；配置审查适配器仍不应被当作图面真相源 |

## 缺口分类与范围裁定

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞本轮定向重审口径 | 当前范围裁定 | 最小补救 |
| --- | --- | --- | --- | --- | --- |
| 践踏曾把“穿过单位”实现成“穿过任何中间格” | `语义不一致` | 否，当前已修 | 否 | 当前范围内已处理 | 保留负向测试：士兵可穿，传送门不可穿 |
| 复活死灵曾把“亡灵单位”扩大成“亡灵法师阵营单位” | `语义不一致` | 否，当前已修 | 否 | 当前范围内已处理 | 保留地狱火教徒负向测试，并让正向夹具继续使用真实亡灵单位 |
| 感染曾缺少 Carrier 标签字段，并在上一版 evidence 中被错误收窄为亡灵法师阵营限定 | `真相源字段缺失`、`旧 evidence 结论错误` | 否，当前已修 | 否 | 当前范围内已处理 | 保留跨阵营 Carrier 正向、非 Carrier 负向、只有 Carrier 非 Undead 不能被复活的测试，并让莫古链路继续使用 `mogu + carrier` 筛选 |
| 城塞 / Citadel 曾靠卡名判断，未落成结构化单位身份 | `真相源字段缺失`、`语义不一致` | 否，当前已修 | 否 | 当前范围内已处理 | 保留城塞参谋负向测试、先锋三张城塞单位正向标签测试，并让城塞消费者只消费 `citadel` 标签 |
| 先锋初阵曾用当前生成函数作为配置审查证据 | `审计留档缺口` | 否，当前配置已修 | 否 | 当前范围内已记录 | 后续配置审查若覆盖起始部署，应把提示图/图面合同作为主证据，不应只引用生成函数 |
| 莫古初阵旧配置把菌化野兽写成枯萎法师 | `语义不一致` | 否，当前已修 | 否 | 当前范围内已处理 | 保留莫古起始图负向回归测试 |
| 全牌库所有能力重新重审尚未执行 | `非阻塞扩展` | 否 | 否 | 当前范围外残余 | 另开全牌库审计批次，先列对象全集再逐项审计 |

## 漏审归因

这次不是单纯“维度不够”，也不是只因为旧审计版本老。更准确的归因是三类证据链断点叠加：

| 问题 | 旧审计没挡住的直接断点 | 属于哪类漏审 | 这次怎么补 |
| --- | --- | --- | --- |
| 践踏能穿过传送门 | 规则合同已经有“只穿过单位”，但旧审计停在能力字段和正向移动，没有追到移动路径消费点，也没有补“士兵 vs 传送门”的负向断言 | `证据停在中间态`、`测试断言过窄`、`共享抽象没扩审` | 把单位穿越和建筑穿越拆成两个消费权限，并补传送门负向测试 |
| 复活死灵能复活地狱火教徒 | 旧实现和旧测试共享了错误基线：把整个亡灵法师阵营近似成亡灵目标；正向测试用的假亡灵 id 也没有逼出“同阵营但非亡灵”的边界 | `旧测试已经失效`、`测试断言过窄`、`审计对象没建全集` | `isUndeadCard` 改为卡牌自身亡灵语义；补地狱火教徒负向测试；正向链改用亡灵战士 |
| 疫病体 / Carrier tag 被漏录并被上一版 evidence 错判 | 规则合同和图片已经要求“疫病体 / Carrier”作为单位身份；上一版审计没有回到完整卡面和官方 `Carrier unit` 原文，而是按阵营/名称猜；旧测试没有覆盖“同阵营非亡灵”“只有 Carrier 非 Undead”“跨阵营同 tag Carrier”三类边界 | `真相源没锁`、`测试断言过窄`、`旧 evidence 已经失效`、`执行失守` | 新增 `UnitCard.unitTags`；亡灵疫病体为 `undead + carrier`，菌袍疫病体为 `carrier`，地狱火教徒无标签；配置审查表暴露“单位标签”字段；复活和感染分别消费 `undead` / `carrier` |
| 城塞 / Citadel tag 被旧实现用名称猜 | 规则合同和先锋卡图已经要求“Citadel / 城塞”作为可筛选单位身份；旧实现把卡名包含“城塞 / fortress”当作规则身份，旧测试也没有“名字像但身份不是”的坏例 | `真相源没锁`、`测试断言过窄`、`共享抽象没扩审`、`执行失守` | 新增 `citadel` 标签；先锋三张城塞单位带标签，圣殿牧师和永恒议会城塞参谋不带标签；城塞之力、城塞精锐、神圣护盾统一消费 `isFortressUnit` 标签判断 |
| 先锋初阵错位 | 配置审查把“起始部署坐标”的证据写成当前代码生成函数；这会让审查拿实现证明实现，无法发现图片与配置冲突 | `真相源没锁`、`审计留档缺口`、`规范落点错误` | 本轮回到提示图人工核对，并把图面观察、图片哈希和配置测试写入本文 |
| 莫古初阵单位错误 | 上一轮只修了用户点名的先锋，没有把“起始提示图 vs startingUnits”扩成当前可选派系全集；因此同类图面错配继续存在 | `审计对象没建全集`、`真相源没锁` | 本轮合成查看当前 11 派系提示图，对照配置快照，修复莫古并补测试 |

## 规范落点裁定

- 结论：本次不是规范缺失，而是执行失守。项目数据录入规范已经要求图片 / 规则书里的特殊含义文本、图案、关系和规则原子完整登记并结构化；规则合同审计规范也已经要求图标、颜色、牌型、区域标记、阵营可见性、次数限制和规则可筛选分类落成结构化字段，缺字段时退回录入，不能用旧实现、名称或默认值顶替。
- 本轮不新增平行通用规范：按规范治理入口，已有上位规范覆盖时不应再写第二条同义规则。补救动作落在执行层和适配层：`unitTags` 成为召唤师战争单位身份的结构化字段，配置审查表暴露该字段，evidence 原地回写旧错误结论和同类扩审结果。
- 后续如果要把“全牌库所有卡面单位身份标签”做完，正确动作不是再加一条抽象规范，而是另开批量录入 / 审计任务：先列对象全集、逐张看图和规则原文，再把每个身份标签锁到正式配置。

## 旧 evidence / 旧结论对账

| 旧材料 | 旧结论可继续使用的部分 | 本轮降级或补充 |
| --- | --- | --- |
| `evidence/summonerwars/summonerwars-structure-shift-revive-undead-e2e-2026-04-28.md` | 仍可证明复活死灵 `selectCard -> selectPosition` 双步 UI 链能显示并完成 | 不能证明弃牌堆候选一定只包含亡灵，也不能证明地狱火教徒被排除；本轮以领域负向测试和同源消费搜索补上这个边界 |
| `evidence/summonerwars/b7-p3-movement-and-adjacency-implementation-diff-matrix-2026-07-02.md` 及同族移动审计 | 可作为移动/邻接审计历史线索 | 若没有记录“单位穿越”和“建筑穿越”的分权消费，不能单独支撑践踏负向边界 |
| `evidence/summonerwars/summonerwars-mechanics-audit-2026-07-02.md` 中城塞之力 / 城塞精锐旧证据 | 仍可作为城塞消费者流程和历史 E2E 线索 | 不能证明“城塞单位”身份是按卡图 / 规则标签筛选，也不能证明名字带城塞的其它派系单位会被排除；本轮以 `citadel` 标签和城塞参谋负向测试补上这个边界 |
| `src/games/summonerwars/config/configReviewAdapter.ts` 当前配置审查证据 | 可列出当前生成出的起始部署坐标 | `RULE_EVIDENCE.setupData` 指向 `createDeckByFactionId`，只能说明实现当前输出什么，不能替代提示图主真相源 |

## 测试语义对账与验证证据

| 命令 | 覆盖范围 | 结果 | 证明了什么 | 没有证明什么 |
| --- | --- | --- | --- | --- |
| `npx vitest run src/games/summonerwars/__tests__/abilities-necromancer-execute.test.ts src/games/summonerwars/__tests__/abilities-mogu.test.ts src/games/summonerwars/__tests__/validate.test.ts src/games/summonerwars/__tests__/configReviewAdapter.test.ts src/games/summonerwars/__tests__/abilities.test.ts --configLoader native` | 亡灵 / Carrier 标签消费、莫古专用筛选、配置审查字段、验证器 | 5 files passed；142 tests passed | 复活地狱火教徒负向、只有 Carrier 非 Undead 不能被复活、感染跨阵营 Carrier 正向、非 Carrier 负向、莫古释放菌袍链路、配置审查 `unitTags` 字段和 Carrier summon effect 均通过 | 不证明全牌库所有能力都重新审完 |
| `npx vitest run src/games/summonerwars/__tests__/abilities-frost.test.ts src/games/summonerwars/__tests__/abilities-goblin.test.ts src/games/summonerwars/__tests__/abilities-trickster.test.ts src/games/summonerwars/__tests__/entity-chain-integrity.test.ts src/games/summonerwars/__tests__/boundaryEdgeCases.test.ts` | 同类穿越和移动边界扩审 | 5 files passed；289 tests passed | 单位/建筑/全穿越共享移动 helper 没被本轮分权修复误伤 | 不替代逐张卡图规则复核 |
| `npx vitest run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts src/games/summonerwars/__tests__/flow.test.ts src/games/summonerwars/__tests__/tutorialProperties.test.ts src/games/summonerwars/__tests__/abilities-advanced.test.ts src/games/summonerwars/__tests__/abilities.test.ts --configLoader native` | 复活死灵、感染、AI/流程、交互链和高级技能相关回归 | 5 files passed；266 tests passed | 复活死灵正向亡灵链、负向验证、流程和相关消费者测试通过；感染改为 Carrier 标签未误伤交互链与流程测试；相关交互测试覆盖选择后队列清空、流程收口、无残留 | 不证明每个亡灵法师单位的全部能力重新重审 |
| `npx vitest run src/games/summonerwars/__tests__/abilities-paladin.test.ts src/games/summonerwars/__tests__/abilities-paladin-new.test.ts src/games/summonerwars/__tests__/abilities-paladin-execute.test.ts src/games/summonerwars/__tests__/divine-shield.test.ts src/games/summonerwars/__tests__/entity-chain-integrity.test.ts src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts src/games/summonerwars/__tests__/strength-boost-display.test.ts src/games/summonerwars/__tests__/interaction-flow-e2e.test.ts src/games/summonerwars/__tests__/configReviewAdapter.test.ts --configLoader native` | 城塞 / Citadel 标签消费、先锋能力、神圣护盾、战力展示、交互链和配置审查字段 | 9 files passed；375 tests passed | 先锋三张城塞单位带 `citadel` 标签可被城塞消费者正确使用；城塞参谋名字带城塞但无 `citadel` 标签时被拒绝；神圣护盾和圣洁审判相关测试夹具不再靠旧 `isFortress` 假字段 | 不证明全牌库所有卡面身份标签已批量录入 |
| `npx vitest run src/games/summonerwars/__tests__/abilities-paladin.test.ts src/games/summonerwars/__tests__/configReviewAdapter.test.ts --configLoader native` | 城塞参谋坏例与配置审查标签字段的窄回归 | 2 files passed；44 tests passed | 新增坏例先独立通过；随后又被完整先锋 / 城塞影响面覆盖 | 不替代完整 Summoner Wars 全量回归 |
| `npm run typecheck` | TypeScript 类型检查 | passed | `UnitTag` / `unitTags` 类型扩展、配置审查字段、测试夹具和 i18n 访问没有类型错误 | 不证明玩法正确性 |
| 当前身份标签两组验证合计 | 亡灵 / Carrier 标签修复 + 城塞 / Citadel 标签修复直接消费者 | 按命令输出合计 14 个测试文件运行、517 tests passed；其中 `configReviewAdapter.test.ts` 被两组重复覆盖 | 本轮两个单位身份标签问题及其直接消费者在当前代码下通过 | 不申请生产部署、截图验收或全牌库规则总审 |
| `npm run audit:evidence:selfcheck -- evidence/summonerwars/summonerwars-targeted-rule-reaudit-2026-09-12.md` | 审计 evidence 结构自检 | checked files: 1；audit docs: 1；OK | 本文范围、真相源、原子语义、实现消费、最终结果、缺口分类和残余声明满足 evidence 留档门禁 | 不替代规则正确性本身，规则正确性仍由上方测试和图面 / 规则证据证明 |
| `git diff --check -- src/games/summonerwars/domain/types.ts src/games/summonerwars/domain/ids.ts src/games/summonerwars/domain/abilities.ts src/games/summonerwars/domain/abilityResolver.ts src/games/summonerwars/domain/systems.ts src/games/summonerwars/domain/executors/necromancer.ts src/games/summonerwars/domain/executors/paladin.ts src/games/summonerwars/config/factions/necromancer.ts src/games/summonerwars/config/factions/mogu.ts src/games/summonerwars/config/factions/paladin.ts src/games/summonerwars/config/configReviewAdapter.ts src/pages/SummonerWarsConfigReview.tsx src/games/summonerwars/__tests__ public/locales/zh-CN/game-summonerwars.json public/locales/en/game-summonerwars.json evidence/summonerwars/summonerwars-targeted-rule-reaudit-2026-09-12.md` | 本轮新增相关文件空白检查 | passed | 本轮新增 diff 没有空白错误 | 不证明玩法正确性 |

## 残余范围

- 本轮已经对当前 11 个可选派系起始提示图做人工图面扩审并对照配置快照，但还没有把提示图 OCR / 坐标合同做成自动化配置审查真相源。
- 本轮已把亡灵 / 疫病体 / 城塞图面身份补成运行时和配置审查字段，但还没有对全牌库所有可能的图面单位标签做完整批量录入；当前只锁定了本轮直接涉及的亡灵战士、亡灵疫病体、亡灵弓箭手、地狱火教徒、菌袍疫病体、先锋三张城塞单位、圣殿牧师和永恒议会城塞参谋。
- 本轮没有重做召唤师战争全牌库描述到实现总审；未点名能力只按共享影响和同族 helper 做最小扩审覆盖。
- 本轮没有做真实浏览器 E2E 或截图验收；三条问题都是领域规则和配置坐标问题，当前证据以领域测试、人工核图和代码消费链为主。
- 当前配置审查适配器仍存在留档问题：起始部署坐标的证据引用当前生成函数，不足以证明图片真相。它不阻塞三条点名规则的当前实现验证，但会影响后续“配置审查能否自动挡住起始图错位”的口径。

## 对外汇报口径

- 允许说：三条用户点名规则点及本轮扩审新增命中的莫古起始配置问题，当前功能实现已验证；疫病体 / Carrier 和城塞 / Citadel 旧结论已纠正为结构化标签消费。
- 允许说：用户质疑“没有同类问题”是对的；上一轮只能说“直接共享影响初查未炸”，不能说“没有同类问题”。
- 允许说：规范已覆盖“必须基于图片和规则原文录入结构化字段”，这次是执行失守；本轮补的是配置字段、实现消费和 evidence，不新增平行规范。
- 允许说：当前 11 个可选派系起始提示图已做本轮人工图面扩审；新增命中莫古，其他派系在本轮可读图面和配置快照下未见起始单位/站位错配。
- 允许说：上一版把“疫病体”当成阵营/名称而不是 Carrier 标签，是执行没有按既有图片录入和规则合同规范走。
- 禁止说：召唤师战争全牌库规则完成重新重审。
- 禁止说：召唤师战争没有其它同类图面身份标签问题。
- 禁止说：配置审查已经能自动防止所有起始阵型图面错误。
