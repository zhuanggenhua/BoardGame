# 大杀四方冰雪奇缘全量重审：牌面、录入与运行时对账

## 审计范围

- 本轮游戏 / 模块：Smash Up / Frozen 派系。
- 本轮对象：15 张 Frozen 卡牌 + 2 个 Frozen 基地，共 17 个对象。
- 本轮规则子句：牌面语义、静态录入、能力注册、额外随从来源与落位、基地保护、牌库 / 弃牌堆去向、交互收口和最终权威状态。
- 目标入口 / 环境：项目 Playwright Chromium E2E、Smash Up 领域行为测试、中文/英文 i18n 检查、本地 TypeScript 检查。
- 当前范围外：生产镜像发布、线上用户版本确认、其它派系的共享回归基线。

## 结论等级

- 当前结论：`当前范围已收口`。
- 判定理由：17 个对象的行为语义测试、录入检查、代表性真实入口、截图证据和本轮审计留档均已闭合；本轮发现并修复的是 E2E 对共享交互合同的漏步与错误基地选项断言，不是运行时规则缺陷。
- 生产边界：本地当前范围已收口不等于生产镜像已发布；生产发布仍是独立动作。

## 权威来源

- 主真相源：中文 Frozen 卡图、中文 Frozen 基地图、`src/games/smashup/data/factions/frozen.ts`。
- 实现消费源：`src/games/smashup/abilities/disney_four_factions.ts`、`src/games/smashup/domain/extraPlay.ts`、对应 reducer / validator / locale。
- 行为真相源：`src/games/smashup/__tests__/abilities/frozen-card-semantics.test.ts` 与 `e2e/smashup/smashup-disney-four-factions-baymax-frozen-lion-mulan.e2e.ts` 的最终状态断言。
- 合同状态：`locked`；本轮未发现牌面、录入和实现之间新的语义冲突。

### 图片合同表

| 图源 | 图面合同 | 资产清单 / 裁图依据 | SHA256 |
| --- | --- | --- | --- |
| `public/assets/i18n/zh-CN/smashup/cards/compressed/disney_four_factions.webp` | 6 x 10 图集；Frozen 卡槽 15-29；完整单卡主裁图由该槽位合同定位 | `public/assets/i18n/zh-CN/smashup/assets-manifest.json` 的 `cards/compressed/disney_four_factions` | `141E1BB8E5DE2305DA57ED51099CC7F0C97493974BA3242857E2373D1AC9E84D` |
| `public/assets/i18n/zh-CN/smashup/base/compressed/disney_four_faction_bases.webp` | Frozen 基地槽 8-9；完整单卡主裁图 / 基地裁图按该槽位合同定位 | `public/assets/i18n/zh-CN/smashup/assets-manifest.json` 的 `base/compressed/disney_four_faction_bases` | `C3A28ECF191DCC601F3FDF1D71963F40D5B863FC54C10D0BEDBEB756FBAE0214` |

## 逐项结论与实现消费

- 逐项对象结论见下方“对象级审计矩阵”；每行记录牌面原子语义、当前实现、最终状态和残余差异。
- `frozen-card-semantics.test.ts` 对象全集断言 15 张牌、2 个基地，并覆盖关键负向路径；旧测试若沿用错误旧语义，已由当前语义测试替代。
- 本轮堆雪人真实入口的实现消费链为：`buildSnowman` 生成 `specificCardUid + allowFromDiscard + playTiming=immediate`，共享 `extraPlay.ts` 生成额外随从确认、基地选择和最终 `PLAY_MINION` 执行。

## 验证证据

- 领域测试：Frozen 语义审计 `10/10 passed`。
- 真实入口：迪士尼四派系 E2E 文件 `4/4 passed`，其中艾莎天赋和堆雪人均从真实牌桌进入并完成最终落场。
- 最终权威状态：断言角色进入目标基地、指定来源牌离开手牌 / 弃牌堆、未选角色仍在弃牌堆、`sys.interaction.current` 清空。
- 交互生命周期：堆雪人实际经过“角色候选 → 立即额外随从确认 → 基地选择 → 结算”，没有残留 prompt。

## 共享影响与残余范围

### 共享流程审计

| sharedFlowId | 流程职责 | 一致性核对 |
| --- | --- | --- |
| `smashup-immediate-extra-minion` | 立即额外随从的候选生成、来源区校验、基地选择和最终打出 | 触发时机：`playTiming=immediate`；候选生成：`specificCardUid + allowFromDiscard`；权限判断：共享 `validate(PLAY_MINION)`；payload / command：`fromDiscard + discardPlaySourceId + consumesNormalLimit=false`；执行入口：`src/games/smashup/domain/extraPlay.ts`；最终权威状态：`finalState.core.bases` 与玩家来源区；清理语义：`sys.interaction.current` 清空且不新增普通随从额度 |

### 同类扩审记录

- 代表对象：艾莎天赋 `frozen_elsa` 与堆雪人 `frozen_do_you_want_to_build_a_snowman`。判等依据：两者都经过 `extraPlay.ts` 的同一“立即额外随从确认 → 基地选择 → `PLAY_MINION`”流程；差异仅在前置候选来源和 `specificCardUid / allowFromDiscard` 配置，不改变共享流程不变量。
- 横向搜索范围：`src/games/smashup/domain/extraPlay.ts`、`grantContextualExtraMinion` 调用点、`allowFromDiscard`、`smashup_immediate_extra_minion`、`smashup_immediate_extra_minion_base` 以及相关 Smash Up 交互测试。
- 命中项：共享立即额外随从链已有“选牌 → 选基地”两段合同；Frozen 堆雪人原 E2E 漏掉第一段共享确认，并错误假设基地候选只有一个。
- 漏审归因：旧 E2E 只等待中间 prompt，没有把真实交互源和最终状态一起核对；本轮已补 direct E2E 和最终状态断言。
- 残余扩审范围：其它派系共享回归基线和 R2/CDN 公开资源链仍按各自 evidence 管理，不作为 Frozen 当前 17 个对象的规则阻塞。

## 修订记录

- 旧结论：2026-09-19 曾判定 `blocked / rework_required`。
- 失效原因：后续已完成 Frozen 15 张牌、2 个基地的实现和语义测试重做，并补齐真实入口证据；旧结论不能继续代表当前代码状态。
- 替代证据：本文件 2026-09-20 / 2026-09-21 记录、Frozen 语义测试、迪士尼四派系 E2E 全文件结果和当前截图。
- 新结论：当前 Frozen 17 个对象的本地范围已收口；生产发布仍单独记录。

## 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | `passed` | 15 张牌 + 2 个基地对象全集 |
| 真相源状态 | `passed` | 中文卡图 / 基地图、数据索引、资产 manifest、SHA256 |
| 原子语义断言 | `passed` | Frozen 领域测试与对象级矩阵 |
| 实现消费链 | `passed` | `disney_four_factions.ts`、`extraPlay.ts`、validator / reducer |
| 最终权威结果 | `passed` | `finalState`、基地落位、来源区清理、交互清空 |
| 交互真实入口 | `passed` | 项目 Playwright Frozen 代表入口 |
| 验证证据 | `passed` | Vitest、E2E、i18n、TypeScript、diff、截图 |
| 共享影响与代表链依据 | `passed` | `sharedFlowId=smashup-immediate-extra-minion`、逐项一致性核对 |
| 缺口分类与范围裁定 | `passed` | E2E 合同缺口与规则缺陷已分开归类 |
| 旧 evidence / 旧结论回写 | `passed` | 旧阻塞历史保留，当前结论原地回写 |
| 残余范围声明 | `passed` | 生产发布、其它派系共享回归和公开资源链明确列为范围外 |

## 2026-09-19 重审结论

- 原始线上反馈：`冰雪奇缘的效果全是错的`。
- 生产反馈：`6aac10778e41d08302191228`，当前仍为 `in_progress`；本轮不回写终态。
- 本轮不是单点复核，而是重新对照 Frozen 的 15 张牌 + 2 个基地。
- 旧文档 `evidence/smashup/2026-09-01-frozen-closeout.md` 的“17 个对象全部 passed”结论失效，原因是它把局部测试和旧录入结果外推成整派系正确。
- 2026-09-19 当时判定：`blocked / rework_required`。牌面真相已锁定，但实现、中文/英文录入、测试和真实入口仍需按新规则重做；该结论由后续修订记录覆盖。

## 真相源与对照源

### 主真相源

- 中文 Frozen 卡图：`public/assets/i18n/zh-CN/smashup/cards/compressed/disney_four_factions.webp`，图集 6 x 10，Frozen 卡槽为 15-29。
- 中文 Frozen 基地图：`public/assets/i18n/zh-CN/smashup/base/compressed/disney_four_faction_bases.webp`，Frozen 基地槽为 8-9。
- 对应运行时对象索引：`src/games/smashup/data/factions/frozen.ts`。

### 实现与录入对照

- 运行时效果：`src/games/smashup/abilities/disney_four_factions.ts`。
- 中文/英文录入：`public/locales/zh-CN/game-smashup.json`、`public/locales/en/game-smashup.json`。
- 旧测试：`src/games/smashup/__tests__/abilities/disney-four-factions.test.ts`。
- 线上原始反馈与操作日志：`temp/feedback-closeout/20260919-continue/6aac10778e41d08302191228.md`。

## 对象级审计矩阵

状态含义：`confirmed_mismatch` = 牌面与当前录入/实现明确不一致；`partial` = 牌面与部分实现一致但仍缺完整行为验证；`blocked` = 旧证据不能继续作为放行依据。

| 对象 | 牌面规则原子 | 当前实现/录入 | 当前状态 | 最小修复范围 |
| --- | --- | --- | --- | --- |
| 迷你雪人 `frozen_snowgie` | 这里有力量 5+ 的角色时，在该角色上放置 +1 力量标记 | 当前改为选择这里任意角色并临时 +1 | `confirmed_mismatch` | 候选只保留同基地力量 5+；改为力量标记 |
| 棉花糖 `frozen_marshmallow` | 持续：如果艾莎在这里，棉花糖 +2 | 当前检查是否有敌方棉花糖并 -1 | `confirmed_mismatch` | 改为同基地己方艾莎条件 +2 |
| 雪宝 `frozen_olaf` | 天赋：查看牌库顶两张，任意数量弃置，其余任意顺序放回牌库顶 | 当前移动己方角色并抽 1 张 | `confirmed_mismatch` | 新增两张查看、逐张弃置、余牌排序 |
| 斯文 `frozen_sven` | 天赋：移动己方角色到这里，或搜索安娜/艾莎并抽取 | 当前从弃牌堆回收力量 4 或更低角色 | `confirmed_mismatch` | 新增双模式选择与指定卡搜索 |
| 安娜 `frozen_anna` | 搜索安娜/艾莎并抽取；持续保护这里其它己方角色不被其他玩家牌摧毁 | 当前只在克里斯托弗同基地时保护安娜 | `confirmed_mismatch` | 新增搜索；保护对象改为同基地其它己方角色且仅限摧毁 |
| 克里斯托弗 `frozen_kristoff` | 持续：同基地有安娜或艾莎时自身 +2；天赋搜索安娜/艾莎并抽取 | 当前仅在安娜同基地时 +2，无天赋 | `confirmed_mismatch` | 扩大条件；新增搜索天赋 |
| 艾莎 `frozen_elsa` | 天赋：从手牌/弃牌堆额外打出雪宝或迷你雪人，或把弃牌堆棉花糖拿回手牌 | 当前选择基地并压低该基地对手角色 | `confirmed_mismatch` | 改为卡牌来源与三种目标的真实选择链 |
| 真爱的行为 `frozen_act_of_true_love` | 摧毁己方角色，从弃牌堆额外打出另一个角色 | 当前抽 1 张并保护己方角色 | `confirmed_mismatch` | 先选并摧毁己方角色，再从弃牌堆额外打出角色 |
| 夏天大盛宴 `frozen_big_summer_blowout` | 丢弃一张牌，把弃牌堆一个角色拿回手牌 | 当前按基地己方角色数抽牌 | `confirmed_mismatch` | 新增弃牌选择与弃牌堆角色回手 |
| 你想和我堆个雪人吗 `frozen_do_you_want_to_build_a_snowman` | 从弃牌堆额外打出棉花糖、雪宝或迷你雪人 | 当前从牌库/弃牌堆回收至多两张迷你雪人 | `confirmed_mismatch` | 改为弃牌堆限定、三类 Frozen 角色、额外打出 |
| 冻结的港口 `frozen_frozen_port` | 持续：其他玩家若本回合能在其它基地打出角色，其第一个角色不能打到这里 | 当前拦截角色移动，不拦截正常打出 | `confirmed_mismatch` | 改为“每回合首个角色的目标基地”限制 |
| 汉斯·韦斯特加德 `frozen_hans_westergaard` | 每个玩家展示手牌中的一个角色，或展示没有角色；展示的角色洗入各自牌库 | 当前在目标基地摧毁力量 3 或更低角色 | `confirmed_mismatch` | 新增所有玩家依次展示/选择与回牌库 |
| 放手吧 `frozen_let_it_go` | 查看牌库顶三张，抽一张，剩余牌任意顺序进入弃牌堆和/或牌库顶 | 当前选择己方角色回手并获得额外行动 | `confirmed_mismatch` | 新增三张查看、抽一张、逐张去向与排序 |
| 锁上大门 `frozen_lock_the_gates` | 持续：这里的己方角色不被其他玩家牌摧毁；天赋查看牌库顶并弃掉或放回 | 当前阻止其他玩家打出力量 3 或更低角色 | `confirmed_mismatch` | 改为摧毁保护；新增天赋查看顶牌 |
| 驯鹿的心地比人好 `frozen_reindeers_are_better_than_people` | 搜索角色；牌库重洗；力量 3 以下额外打出，否则弃掉 | 实现大体接近牌面，但中文/英文 locale 仍是 +2/+4 力量旧文案 | `confirmed_mismatch` | 保留实现方向，修正文案并补边界验证 |
| 冰宫 `base_ice_palace` | 这里的角色不能被其他玩家牌摧毁或移动 | 当前有对手时角色有效力量 -1 | `confirmed_mismatch` | 改为同基地角色的摧毁/移动保护 |
| 阿伦黛尔 `base_arendelle` | 打出角色到这里后，查看牌库顶两张，抽一张，剩余放入弃牌堆 | 当前计分时角色最多玩家 +1 VP | `confirmed_mismatch` | 改为每次在此打出角色后的查看/抽牌链 |

## 当前验证边界

- 已确认：牌图文字与当前实现明显错配，且不是单个对象的局部偏差。
- 已确认：旧测试大量在验证错误的旧语义，因此“测试通过”不能作为本轮放行证据。
- 已确认：线上日志确实出现过 Frozen 的放手吧、堆雪人等牌，不是没有真实入口的抽象反馈。
- 未完成：实现重写、locale 重录、17 个对象回归测试、真实牌桌 E2E、生产部署和反馈终态回写。
- 未完成前：反馈保持 `in_progress`；旧 closeout 不再作为当前完成依据。

## 2026-09-20 继续处理记录

- 保留玩家原文：`冰雪奇缘的效果全是错的`；线上反馈 `6aac10778e41d08302191228` 已于 2026-09-20 11:25:41（北京时间）通过正式反馈写入口回写为 `resolved`。
- 本轮本地实现已完成前一阶段的 Frozen 15 张牌、2 个基地重审修正；本轮补齐艾莎真实页面 E2E 的实际交互链：模式选择 → 艾莎牌池选择 → 通用“立即打出一个额外随从” → 再次选择雪宝 → 三基地中选择落位基地。
- 本轮修正的测试问题不是新增规则：旧 E2E 错等了不存在的交互来源、漏走通用额外随从 prompt，并把三基地误写成两基地；已按运行时正式交互来源和真实画面改正。
- 真实页面验证命令：`node scripts/infra/run-e2e-single.mjs default e2e/smashup/smashup-disney-four-factions-baymax-frozen-lion-mulan.e2e.ts "冰雪奇缘艾莎天赋"`；结果：Playwright `1 passed (47.2s)`，覆盖最终雪宝落位、手牌移除和交互关闭。
- 本轮额外验证：`npx tsc --noEmit --pretty false` 通过；目标文件 `git diff --check` 通过。E2E 使用项目本地 Playwright runtime，未操作用户生产浏览器。
- 当前线上边界：反馈真实记录已为 `resolved`，本轮尚未部署生产镜像；这里的“已修复”表示代码已修正、真实入口已验证并完成线上反馈回写，不等同于生产镜像已经发布。
- 规范回代判断：项目现有 `.spec/knowledge/standards/e2e-verification.md` 已规定“正常端到端”默认走项目 Playwright runtime，禁止擅自操作用户当前浏览器；本轮没有新增规范文件，后续如要强化反馈 workflow，只需在项目反馈 skill 增加交叉指向，不重复建立第二套浏览器规则。

## 2026-09-21 当前复核与修复记录

- 当前范围：Frozen 15 张牌 + 2 个基地；本轮继续验证堆雪人真实入口，未扩大到其它派系或生产部署。
- 当前结论：`当前范围已收口`。15 张牌和 2 个基地的行为测试、中文/英文录入、代表性真实入口和 evidence 均已闭合；生产镜像仍未发布，不能把本地收口写成生产已发布。
- 本轮首次复现的真实失败不是运行时规则缺陷，而是 E2E 沿错了共享交互合同：从弃牌堆选定迷你雪人后，正式链路还会显示一次 `smashup_immediate_extra_minion` 确认；原测试直接等待基地选择，因此在确认交互处超时。
- 本轮继续发现的第二个测试缺陷是基地选项断言写死为 `[0]`。真实牌桌提供三个基地和一个放弃选项；测试现改为断言数值基地索引 `[0, 1, 2]`，并单独断言放弃入口存在。
- 修复范围仅为 `e2e/smashup/smashup-disney-four-factions-baymax-frozen-lion-mulan.e2e.ts`：补齐“选择弃牌堆角色 → 确认立即额外随从 → 选择基地 → 最终落场”的玩家路径，并保留最终弃牌堆清理、指定角色未误选和交互关闭断言。

### 当前自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | `passed` | Frozen 15 张牌 + 2 个基地；`frozen-card-semantics.test.ts` 覆盖对象全集 |
| 真相源状态 | `passed` | Frozen 卡图、基地图集与 `src/games/smashup/data/factions/frozen.ts` 已锁定 |
| 原子语义断言 | `passed` | `frozen-card-semantics.test.ts`：10 tests passed |
| 实现消费链 | `passed` | `disney_four_factions.ts` + 共享 `extraPlay.ts` 的弃牌堆额外随从链 |
| 最终权威结果 | `passed` | 行为测试与 E2E 均断言角色落基地、来源区移除、未选角色仍在弃牌堆、交互关闭 |
| 交互真实入口 | `passed` | Frozen 代表性 E2E 全文件 4/4 passed |
| 验证证据 | `passed` | Playwright 截图、Vitest、i18n、TypeScript、diff 和 evidence selfcheck 均通过 |
| 共享影响与代表链依据 | `passed` | 复用共享立即额外随从链；堆雪人补充了弃牌堆来源的 direct E2E |
| 缺口分类与范围裁定 | `passed` | 本轮两个问题均为 E2E 合同缺口，不是运行时规则缺陷 |
| 旧 evidence / 旧结论回写 | `passed` | 保留 2026-09-19 阻塞历史，并在本节写入当前结论 |
| 残余范围声明 | `passed` | 生产镜像发布不在本轮；其它派系和共享回归基线仍按各自 evidence 管理 |

### 当前验证命令与结果

- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/frozen-card-semantics.test.ts --configLoader native`：10/10 passed。
- `npm run test:e2e:file -- e2e/smashup/smashup-disney-four-factions-baymax-frozen-lion-mulan.e2e.ts`：4/4 passed；其中 Frozen 艾莎天赋与堆雪人均通过。
- `npm run i18n:check`：通过，无缺失 key。
- `npx tsc --noEmit --pretty false`：通过。
- `git diff --check`：通过；`npm run audit:evidence:selfcheck -- evidence/smashup/2026-09-19-frozen-reaudit.md`：通过。
- 当前轮关键截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-disney-four-factions-baymax-frozen-lion-mulan.e2e\冰雪奇缘堆雪人从真实页面只允许弃牌堆中的指定角色\frozen-snowman-extra-minion-confirmation.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-disney-four-factions-baymax-frozen-lion-mulan.e2e\冰雪奇缘堆雪人从真实页面只允许弃牌堆中的指定角色\frozen-snowman-resolved.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-disney-four-factions-baymax-frozen-lion-mulan.e2e\冰雪奇缘艾莎天赋必须在真实页面提供额外打出雪宝-迷你雪人或取回棉花糖\frozen-elsa-extra-minion-base-choice.jpg`

### 当前对外口径

- 允许说：Frozen 当前 17 个对象的本地实现、行为测试、代表性真实入口和审计 evidence 已闭合；本轮确认并修复了堆雪人 E2E 漏掉共享确认步骤及错误基地断言。
- 禁止说：生产镜像已经发布、线上用户已获得本轮代码，或本轮发现了 Frozen 运行时额外随从规则缺陷。
