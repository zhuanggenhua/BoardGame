# 召唤师战争三项规则问题定向重审记录（2026-09-12）

- 对象：召唤师战争（`summonerwars`）三项用户点名规则问题
- 日期：2026-09-12
- 修订：2026-09-13 用户追问同类问题后追加穿越、身份筛选、当前 11 派系起始图扩审
- 作者：Codex
- 文档类型：`audit`
- 关联任务：用户反馈“草原精灵的牛能穿过传送门，牛应该只能穿过士兵；亡灵召唤师复活死灵应该只能复活亡灵，现在是可以复活地狱火教徒；先锋的初阵有问题，是骑士和牧师，而且站位是骑士在前，牧师在后这个应该要重新看图”
- 结论等级：`当前范围已收口`
- 本轮结论：三条用户点名规则点的功能实现已验证；用户追问“没有同类问题？”后，继续对穿越权限、弃牌堆身份筛选和当前 11 个派系起始提示图做同类扩审。扩审新增发现并修复 2 个同类问题：莫古起始单位误用“枯萎法师”、亡灵法师“感染”把莫古“菌袍疫病体”按名称误判为可召唤疫病体。本文不申请召唤师战争全牌库规则重审完成口径。

## 前提锁定

| 项 | 当前锁定 |
| --- | --- |
| 问题对象 | 1）草原精灵/蛮族系带“践踏”的牛/犀牛类单位移动穿越；2）亡灵召唤师“复活死灵”的弃牌堆目标；3）先锋军团起始单位与站位 |
| 真相来源 | 用户当轮原始症状；能力合同 `trample` 的 `canPassThrough: 'units'`；`revive_undead` 文案和目标过滤合同“亡灵单位”；先锋提示图 `public/assets/i18n/zh-CN/summonerwars/hero/Paladin/compressed/tip.webp` |
| 目标入口 / 环境 | 当前仓库当前代码；移动合法性入口 `canMoveToEnhanced` / `getMovePath`；复活入口 `ACTIVATE_ABILITY`、弃牌堆卡牌选择、相邻落位；起始配置入口 `createDeckByFactionId('paladin')` |
| 验收口径 | 证明三条点名问题及其直接同类扩审命中项的语义、实现消费点、最终权威状态和负向断言；同时解释旧审计为什么漏掉，并声明全牌库规则总审仍不在本轮范围 |

## 审计范围

| 范围 | 本轮状态 | 说明 |
| --- | --- | --- |
| 践踏：只穿过单位，不能穿过传送门 | covered | 覆盖 2 格直线中间格；同类扩审覆盖使用同一移动增强的更长路径和同类穿越能力测试 |
| 复活死灵：只能选择亡灵单位，不能选择地狱火教徒 | covered | 覆盖候选生成、验证、执行器、UI 快速入口和 AI 候选过滤同源亡灵判定 |
| 先锋起始阵型：城塞骑士在前、圣殿牧师在后 | covered | 回看提示图后锁定坐标，并补配置测试 |
| 当前 11 个可选派系起始提示图扩审 | covered | 合成查看 11 张中文提示图并对照 `createDeckByFactionId` 当前输出；新增发现莫古起始单位错误并修复，其余 10 个派系在起始单位名称和相对站位上未见同类错配 |
| 亡灵法师“感染”与莫古“释放菌袍/菌化变异”身份筛选扩审 | covered | 新增发现旧 `isPlagueZombieCard` 按“名称含疫病体”会误收莫古菌袍疫病体；已收窄为亡灵法师阵营内的疫病体判定，并保留莫古专用筛选 helper |
| 全牌库所有能力重新做描述到实现重审 | residual | 本轮只围绕三条已锁问题和共享影响做最小扩审 |

## 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | passed | 当前范围内每个对象已列入审计范围：践踏、复活死灵、感染、先锋初阵、莫古初阵、当前 11 派系起始图扩审；全牌库规则总审不在本轮范围 |
| 真相源状态 | passed | 权威来源表记录能力合同、提示图路径、图片 SHA256、代码对照源和合同状态 |
| 原子语义断言 | passed | 原子语义与实现消费表逐项列出“只穿单位不穿传送门”“只复活亡灵”“感染只认亡灵法师疫病体”“先锋/莫古起始图面站位” |
| 实现消费链 | passed | 实现消费链覆盖 `getUnitMoveEnhancements`、`isCellPassableForMovement`、`isUndeadCard`、`isPlagueZombieCard`、执行器、系统候选、配置生成函数 |
| 最终权威结果 | passed | 最终权威结果落到移动合法性、召唤事件、目标格是否为空、弃牌堆是否移除、起始牌组生成坐标 |
| 交互真实入口 | passed | 本轮对象属于领域规则和配置坐标；复活/感染验证覆盖正式 `ACTIVATE_ABILITY` 入口，起始图面用提示图人工核对，未申请浏览器截图验收 |
| 验证证据 | passed | 测试语义对账记录 15 个文件、770 条测试通过；保留旧测试过窄和新负向断言说明 |
| 共享影响与同类扩审依据 | passed | 共享影响表记录移动穿越、亡灵判定、疫病体判定和当前 11 派系起始图扩审的横向搜索与命中结果 |
| 缺口分类与范围裁定 | passed | 缺口分类表将已修实现问题、留档缺口和全牌库范围外扩展分开裁定 |
| 旧 evidence / 旧结论回写 | passed | 旧 evidence / 旧结论对账表说明旧 UI 链、移动审计和配置审查各自不能证明什么 |
| 残余范围声明 | passed | 残余范围声明保留全牌库规则总审、真实浏览器 E2E 和自动化图面合同三个边界 |

## 权威来源

| 规则点 | 主真相源 | 对照源 | 合同状态 | 本轮图面 / 规则观察 |
| --- | --- | --- | --- | --- |
| 践踏 | `src/games/summonerwars/domain/abilities-frost.ts:223-231` | `src/games/summonerwars/domain/helpers.ts:998-1078` | `locked` | 践踏效果写的是 `canPassThrough: 'units'`，现实含义是“中间格可以有单位”，不是“中间格可以有传送门/建筑” |
| 复活死灵 | `src/games/summonerwars/domain/abilities.ts:318-390` | `src/games/summonerwars/domain/ids.ts:140-155`、`src/games/summonerwars/domain/executors/necromancer.ts:14-39` | `locked` | 文案、目标过滤、验证错误提示都指向“亡灵单位”；地狱火教徒同属亡灵法师阵营，但自身不是亡灵单位 |
| 感染 | `src/games/summonerwars/domain/abilities.ts:574-626` | `src/games/summonerwars/domain/ids.ts:114-124`、`src/games/summonerwars/domain/executors/necromancer.ts:63-82`、`src/games/summonerwars/domain/systems.ts:2195-2204` | `locked` | 亡灵法师“感染”只应从弃牌堆召唤亡灵法师自己的疫病体；莫古“菌袍疫病体”是莫古单位，不属于这个身份筛选 |
| 先锋初阵 | `public/assets/i18n/zh-CN/summonerwars/hero/Paladin/compressed/tip.webp` | `src/games/summonerwars/config/factions/paladin.ts:326-367`、`src/games/summonerwars/__tests__/factions.test.ts:183-190` | `locked for paladin only` | 图面文字写“起始单位：圣殿牧师(▲)和城塞骑士(■)”；图上 ■ 在城门前方一排，▲ 在城门右侧同排。图片 SHA256：`8A8068F046D456A26A47CFFAD4826933DF2129B2C73E371B5A3509C45540378E` |
| 莫古初阵 | `public/assets/i18n/zh-CN/summonerwars/hero/mogu/compressed/tip.webp` | `src/games/summonerwars/config/factions/mogu.ts:307-322`、`src/games/summonerwars/__tests__/factions.test.ts:203-215` | `locked for mogu starting setup` | 图面文字写“起始单位：菌化野兽(△)、菌袍疫病体(□)”；图上 △ 在城门前方同列，□ 在城门左侧同排。图片 SHA256：`6FA1C6EB1FE5564B7F38BEF01C7BA83449FE60CC70F46E1E54CBC31A4703AB10` |

## 原子语义与实现消费

| 对象 | 原子语义断言 | 实现消费点 | 最终权威结果 | 真实入口 / 验证证据 | 缺口分类 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 草原精灵/蛮族系带践踏单位 | 移动路径中间格如果是士兵/单位，践踏单位可以通过；如果中间格是传送门/建筑，践踏不能把它当成单位穿过 | `getUnitMoveEnhancements` 把 `canPassThrough: 'units'` 转成 `canPassThrough=true`、`canPassStructures=false`；`isCellPassableForMovement` 分开检查单位和建筑；2 格移动与 BFS 都消费这两个布尔结果 | `canMoveToEnhanced` 对中间格为单位返回可移动；同一格改成传送门后返回不可移动 | `src/games/summonerwars/__tests__/abilities-barbaric.test.ts:405-433` 新增测试断言士兵可穿、传送门不可穿；同类穿越扩审测试已通过 | 旧实现为语义不一致；当前为功能实现已验证 | passed |
| 亡灵召唤师“复活死灵” | 召唤阶段发动时，只能从自己的弃牌堆选择亡灵单位；地狱火教徒即使同属亡灵法师阵营，也不应进入合法复活目标 | `isUndeadCard` 只按卡牌自身亡灵语义判定；能力 quickCheck、条件、目标过滤、系统卡牌选择、AI 候选和执行器均消费同一函数 | 非亡灵目标被验证拒绝；执行器不会造成召唤师自伤，不会召唤单位，目标格保持空 | `src/games/summonerwars/__tests__/abilities-necromancer-execute.test.ts:239-281` 断言地狱火教徒无效；`src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts:574-657` 和 `2772-2904` 保留亡灵正向链与负向链 | 旧测试已经失效；当前为功能实现已验证 | passed |
| 亡灵法师“感染” | 感染只能选择亡灵法师自己的疫病体；莫古的菌袍疫病体虽然名字包含“疫病体”，也不能进入亡灵法师感染链 | `isPlagueZombieCard` 先要求 `faction === 'necromancer'`，再按疫病体 ID / 名称识别；验证器、系统候选、执行器和条件判断都消费同一 helper | 指定莫古菌袍疫病体时，验证拒绝，执行器不生成召唤事件，目标格保持空，弃牌堆卡不被移除 | `src/games/summonerwars/__tests__/abilities-necromancer-execute.test.ts:833-874` 新增负向断言；同一文件感染正向链保持通过 | 旧 helper 为语义不一致；当前为功能实现已验证 | passed |
| 先锋军团起始阵型 | 起始单位必须是城塞骑士和圣殿牧师；站位是城塞骑士在前，圣殿牧师在后/城门右侧同排 | `createDeckByFactionId('paladin')` 返回 `startingUnits`：城塞骑士 `{ row: 3, col: 2 }`，圣殿牧师 `{ row: 2, col: 4 }` | 新开先锋牌组时，起始单位顺序和坐标与提示图一致；旧“牧师/骑士站位反了”的配置不再生成 | 本轮人工核图 `tip.webp`；`src/games/summonerwars/__tests__/factions.test.ts:183-190` 断言配置输出 | 旧配置审查真相源错误；当前为功能实现已验证 | passed |
| 莫古起始阵型 | 起始单位必须是菌化野兽和菌袍疫病体；站位是菌化野兽在城门前方同列，菌袍疫病体在城门左侧同排 | `createDeckByFactionId('mogu')` 返回 `startingUnits`：菌化野兽 `{ row: 2, col: 3 }`，菌袍疫病体 `{ row: 2, col: 2 }` | 新开莫古牌组时，不再把枯萎法师生成到起始位置 | 合成提示图 `temp/summonerwars-starting-tip-contact-20260913.jpg` 人工核图；当前配置快照；`src/games/summonerwars/__tests__/factions.test.ts:203-215` 断言配置输出 | 同类起始图面错配；当前为功能实现已验证 | passed |

## 共享影响与同类扩审

| 共享点 | 横向搜索范围 | 命中情况 | 裁定 |
| --- | --- | --- | --- |
| 移动穿越权限 | 搜索 `canPassThrough`、`canPassStructures`、`isCellPassableForMovement`、`buildPassableCheck`，并重跑同类移动测试 | 命中 `trample` 只穿单位、`climb`/结构穿越、`flying`/全穿越；移动 helper 已改成单位和建筑分权消费 | 共享抽象已覆盖到 2 格移动与 BFS；本轮不做全能力逐对象图面复核 |
| 复活死灵亡灵判定 | 搜索 `isUndeadCard` 和 `revive_undead` 的领域、系统、AI、UI 消费点 | 条件判断、quickCheck、系统卡牌候选、AI 候选、UI 点击入口和执行器均已回到 `isUndeadCard` | 共享判定同源；地狱火教徒不再因阵营相同误入候选 |
| 疫病体身份判定 | 搜索 `isPlagueZombieCard`、`isMoguSporePlagueBodyCard`、`isMoguFungalBeastCard` 及各自消费点 | 新命中旧 `isPlagueZombieCard` 会按名称误收莫古“菌袍疫病体”；莫古专用 helper 已经带 `faction === 'mogu'`，未见同类阵营串用 | 已修亡灵法师感染链并补负向测试；莫古释放菌袍、菌化变异继续使用莫古专用 helper |
| 当前 11 派系起始阵型 | 搜索 `startingUnits`、11 张 `tip.webp` 路径、配置生成快照，并合成查看中文提示图 | 新命中莫古起始单位错配：图面是“菌化野兽 + 菌袍疫病体”，配置旧写成“枯萎法师 + 菌袍疫病体”；先锋点名问题已修，其余 9 个派系在本轮图面可读范围内未见同类错配 | 当前 11 派系起始图与配置快照已做定向扩审；配置审查适配器仍不应被当作图面真相源 |

## 缺口分类与范围裁定

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞本轮定向重审口径 | 当前范围裁定 | 最小补救 |
| --- | --- | --- | --- | --- | --- |
| 践踏曾把“穿过单位”实现成“穿过任何中间格” | `语义不一致` | 否，当前已修 | 否 | 当前范围内已处理 | 保留负向测试：士兵可穿，传送门不可穿 |
| 复活死灵曾把“亡灵单位”扩大成“亡灵法师阵营单位” | `语义不一致` | 否，当前已修 | 否 | 当前范围内已处理 | 保留地狱火教徒负向测试，并让正向夹具继续使用真实亡灵单位 |
| 感染曾把“亡灵法师疫病体”扩大成“任意名称含疫病体的单位” | `语义不一致` | 否，当前已修 | 否 | 当前范围内已处理 | 保留莫古菌袍疫病体负向测试，并让莫古链路继续使用莫古专用筛选 |
| 先锋初阵曾用当前生成函数作为配置审查证据 | `审计留档缺口` | 否，当前配置已修 | 否 | 当前范围内已记录 | 后续配置审查若覆盖起始部署，应把提示图/图面合同作为主证据，不应只引用生成函数 |
| 莫古初阵旧配置把菌化野兽写成枯萎法师 | `语义不一致` | 否，当前已修 | 否 | 当前范围内已处理 | 保留莫古起始图负向回归测试 |
| 全牌库所有能力重新重审尚未执行 | `非阻塞扩展` | 否 | 否 | 当前范围外残余 | 另开全牌库审计批次，先列对象全集再逐项审计 |

## 漏审归因

这次不是单纯“维度不够”，也不是只因为旧审计版本老。更准确的归因是三类证据链断点叠加：

| 问题 | 旧审计没挡住的直接断点 | 属于哪类漏审 | 这次怎么补 |
| --- | --- | --- | --- |
| 践踏能穿过传送门 | 规则合同已经有“只穿过单位”，但旧审计停在能力字段和正向移动，没有追到移动路径消费点，也没有补“士兵 vs 传送门”的负向断言 | `证据停在中间态`、`测试断言过窄`、`共享抽象没扩审` | 把单位穿越和建筑穿越拆成两个消费权限，并补传送门负向测试 |
| 复活死灵能复活地狱火教徒 | 旧实现和旧测试共享了错误基线：把整个亡灵法师阵营近似成亡灵目标；正向测试用的假亡灵 id 也没有逼出“同阵营但非亡灵”的边界 | `旧测试已经失效`、`测试断言过窄`、`审计对象没建全集` | `isUndeadCard` 改为卡牌自身亡灵语义；补地狱火教徒负向测试；正向链改用亡灵战士 |
| 感染能误收莫古菌袍疫病体 | 旧 helper 把“疫病体”当成全局名称关键词，没有先锁亡灵法师阵营；旧负向测试只测地狱火教徒，没测“同名身份词但不同阵营”的对象 | `审计对象没建全集`、`测试断言过窄`、`共享抽象没扩审` | `isPlagueZombieCard` 改成先看亡灵法师阵营，再识别疫病体；补莫古菌袍疫病体负向测试 |
| 先锋初阵错位 | 配置审查把“起始部署坐标”的证据写成当前代码生成函数；这会让审查拿实现证明实现，无法发现图片与配置冲突 | `真相源没锁`、`审计留档缺口`、`规范落点错误` | 本轮回到提示图人工核对，并把图面观察、图片哈希和配置测试写入本文 |
| 莫古初阵单位错误 | 上一轮只修了用户点名的先锋，没有把“起始提示图 vs startingUnits”扩成当前可选派系全集；因此同类图面错配继续存在 | `审计对象没建全集`、`真相源没锁` | 本轮合成查看当前 11 派系提示图，对照配置快照，修复莫古并补测试 |

## 旧 evidence / 旧结论对账

| 旧材料 | 旧结论可继续使用的部分 | 本轮降级或补充 |
| --- | --- | --- |
| `evidence/summonerwars/summonerwars-structure-shift-revive-undead-e2e-2026-04-28.md` | 仍可证明复活死灵 `selectCard -> selectPosition` 双步 UI 链能显示并完成 | 不能证明弃牌堆候选一定只包含亡灵，也不能证明地狱火教徒被排除；本轮以领域负向测试和同源消费搜索补上这个边界 |
| `evidence/summonerwars/b7-p3-movement-and-adjacency-implementation-diff-matrix-2026-07-02.md` 及同族移动审计 | 可作为移动/邻接审计历史线索 | 若没有记录“单位穿越”和“建筑穿越”的分权消费，不能单独支撑践踏负向边界 |
| `src/games/summonerwars/config/configReviewAdapter.ts` 当前配置审查证据 | 可列出当前生成出的起始部署坐标 | `RULE_EVIDENCE.setupData` 指向 `createDeckByFactionId`，只能说明实现当前输出什么，不能替代提示图主真相源 |

## 测试语义对账与验证证据

| 命令 | 覆盖范围 | 结果 | 证明了什么 | 没有证明什么 |
| --- | --- | --- | --- | --- |
| `npx vitest run src/games/summonerwars/__tests__/factions.test.ts src/games/summonerwars/__tests__/abilities-necromancer-execute.test.ts src/games/summonerwars/__tests__/abilities-barbaric.test.ts src/games/summonerwars/__tests__/abilities-mogu.test.ts` | 点名问题 + 新命中同类问题的窄测试 | 4 files passed；143 tests passed | 践踏传送门负向、复活地狱火教徒负向、感染莫古菌袍疫病体负向、先锋和莫古起始坐标均被直接断言 | 不证明全牌库所有能力都重新审完 |
| `npx vitest run src/games/summonerwars/__tests__/abilities-frost.test.ts src/games/summonerwars/__tests__/abilities-goblin.test.ts src/games/summonerwars/__tests__/abilities-trickster.test.ts src/games/summonerwars/__tests__/entity-chain-integrity.test.ts src/games/summonerwars/__tests__/boundaryEdgeCases.test.ts` | 同类穿越和移动边界扩审 | 5 files passed；289 tests passed | 单位/建筑/全穿越共享移动 helper 没被本轮分权修复误伤 | 不替代逐张卡图规则复核 |
| `npx vitest run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts src/games/summonerwars/__tests__/abilities-advanced.test.ts src/games/summonerwars/__tests__/flow.test.ts src/games/summonerwars/__tests__/useGameEvents.test.ts src/games/summonerwars/__tests__/tutorialProperties.test.ts src/games/summonerwars/__tests__/validate.test.ts` | 复活死灵领域、交互链、AI/流程相关回归 | 6 files passed；338 tests passed | 复活死灵正向亡灵链、负向验证、流程和相关消费者测试通过；感染收窄未误伤流程测试 | 不证明每个亡灵法师单位的全部能力重新重审 |
| 上面三组当前验证合计 | 点名问题 + 直接同类扩审影响 | 15 files passed；770 tests passed | 本轮修复范围及直接扩审范围在当前代码下通过 | 不申请生产部署、截图验收或全牌库规则总审 |
| `git diff --check -- src/games/summonerwars/config/factions/mogu.ts src/games/summonerwars/domain/ids.ts src/games/summonerwars/__tests__/factions.test.ts src/games/summonerwars/__tests__/abilities-necromancer-execute.test.ts` | 本轮新增相关文件空白检查 | passed | 本轮新增 diff 没有空白错误 | 不证明玩法正确性 |

## 残余范围

- 本轮已经对当前 11 个可选派系起始提示图做人工图面扩审并对照配置快照，但还没有把提示图 OCR / 坐标合同做成自动化配置审查真相源。
- 本轮没有重做召唤师战争全牌库描述到实现总审；未点名能力只按共享影响和同族 helper 做最小扩审覆盖。
- 本轮没有做真实浏览器 E2E 或截图验收；三条问题都是领域规则和配置坐标问题，当前证据以领域测试、人工核图和代码消费链为主。
- 当前配置审查适配器仍存在留档问题：起始部署坐标的证据引用当前生成函数，不足以证明图片真相。它不阻塞三条点名规则的当前实现验证，但会影响后续“配置审查能否自动挡住起始图错位”的口径。

## 对外汇报口径

- 允许说：三条用户点名规则点及本轮扩审新增命中的两个同类问题，当前功能实现已验证。
- 允许说：用户质疑“没有同类问题”是对的；上一轮只能说“直接共享影响初查未炸”，不能说“没有同类问题”。
- 允许说：当前 11 个可选派系起始提示图已做本轮人工图面扩审；新增命中莫古，其他派系在本轮可读图面和配置快照下未见起始单位/站位错配。
- 禁止说：召唤师战争全牌库规则完成重新重审。
- 禁止说：配置审查已经能自动防止所有起始阵型图面错误。
