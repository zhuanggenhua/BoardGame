# 炽天使对象级 intake 审计

## 1. 基本信息

- 对象：Dice Throne 炽天使（tianshi / Seraph）
- 日期：2026-08-05（接续审计）
- 文档类型：audit
- 当前工作树：D:\gongzuo\webgame\BoardGame，main
- 当前目标：记录炽天使本地资源、静态合同、领域行为、逐技能/逐卡真实入口和截图审计的实际证据
- 当前结论：本地 intake、逐技能/逐卡当前成功路径、代表性领域矩阵、全仓 i18n 和服务器媒体发布已通过；本轮又修正圣击、神圣惩戒 II、神圣裁决三段选择和圣刃 II / 小天使四项直接规则缺口；神圣裁决与圣刃 II / 小天使真实入口各 1/1 通过；三张神圣裁决新原始截图已逐张审计为 PASS；未覆盖组合分支仍保留为残余范围

本文件不把“24 条成功路径通过”扩写成所有规则分支穷尽。当前真实入口已覆盖九个技能和 15 张专属卡各自至少一条直接成功路径，并覆盖奖励骰、防御重投、复合升级、目标选择和神圣净化空选跳过；未覆盖的其它否定分支和组合分支仍单独列为残余范围，全仓 i18n 已通过独立命令验证。

## 2. 审计范围

### 2.1 本轮覆盖

- 炽天使玩家板、提示板、骰子、状态图标和专属卡牌的本地正式资源。
- 5 × 7 物理卡槽、slot-17 至 slot-31 专属卡映射、复合物理牌不拆分合同。
- 角色目录、六面骰面、九个技能槽、起始牌库、预加载路径和三份本地 manifest。
- 飞行、眩光、神圣降临、神圣祝福、净化以及神圣净化、天使斗篷、神圣裁决等代表性领域行为。
- 九个技能和 15 张专属卡各一条真实成功路径，覆盖奖励骰、防御重投、复合升级、目标选择和神圣净化空选跳过。
- 真实在线双玩家选角、初始化、进入牌桌、玩家板槽位命中、4 张手牌和对手视角。
- 炽天使规则矩阵当前为 17 条领域测试，覆盖技能失败否定、圣刃三档升级数值、凯旋归来 II 四面奖励骰与 8 点基础伤害、圣击圣洁吊坠/双翼否定分支、天使战术奖励骰分支、神圣惩戒 II 2 点不可防御伤害、至高圣洁成功分支、神圣裁决目标范围，以及福音临世 2 个飞行、圣刃 III 四同眩光命中/未命中。

### 2.2 明确不在本轮已证明范围内

- 九个技能全部规则组合、所有失败/不满足骰型和所有可选否定路径。
- 15 张专属卡所有奖励骰结果、所有否则分支及跨阶段组合。
- 除神圣净化空选跳过外的全部合法候选跳过/空选否定路径。

### 2.3 缺口分类与范围裁定

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞完整交付口径 | 当前范围裁定 | 后续入口 |
| --- | --- | --- | --- | --- | --- |
| 未覆盖的技能否定/组合分支 | 当前范围验证缺口 | 成功路径已证明，非成功组合未穷举 | 不阻塞本轮成功路径收口 | scoped-debt | 后续按规则子句矩阵补失败、否则和更多空选路径 |
| 未覆盖的卡牌否定/组合分支 | 当前范围验证缺口 | 15 张卡各有直接成功路径，非成功组合未穷举 | 不阻塞本轮成功路径收口 | scoped-debt | 后续按卡牌规则子句补否则分支和跨阶段组合 |
| 神圣裁决三段选择与目标范围真实入口复核 | 真实入口已复核 | 领域测试和同一官方 runner 已证明眩光、2 个飞行、净化三段选择及最终状态 | 不再阻塞当前真实入口口径 | passed | 预算释放后已重跑同一官方 runner；两张中间选择态和一张最终收口原始截图逐张审计为 PASS |
| 服务器上传和公开 URL HEAD | 发布门禁 | 10 个炽天使运行时媒体已上传，公开 URL 全部 HEAD 200 | 不再阻塞本地或线上媒体收口 | passed | 发布批次 20260804164030910；后续只需在变更资源时复查 |
| npm run i18n:check | 共享门禁 | 炽天使关键键和此前命中的 SmashUp 牧师/木精灵/法师键均已满足本地化合同 | 不阻塞当前交付 | 已通过；补齐现有按钮/提示的本地化键与木精灵共享选择提示参数 | 后续只在新增文案时复查 |

## 3. 审计自检快照

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象全集 | passed | 九个技能、五类状态/Token、15 张专属卡均有独立行；24 条真实入口用例覆盖九技能和 15 卡的直接成功路径 |
| 规则子句表 | passed_with_scoped_debt | 真相源表和录入核对表已拆分时机、主效果、分支和清理；未穷举的否定/组合分支已标为 scoped-debt |
| 完整技能流程矩阵 | passed_with_scoped_debt | 九个技能均有真实入口成功链；神圣惩戒、凯旋归来、天使斗篷奖励骰/重投和神圣净化空选路径已落证据 |
| L0-L4 证据层级 | passed_with_scoped_debt | 本地资源 L1、领域行为 L2、真实入口 L3，以及复杂交互的 L4 收口均有证据；未覆盖组合单独冻结 |
| 命中 D 维度 | passed | 覆盖资源、槽位、状态消费、玩家选择、奖励骰、防御重投、复合升级和明确跳过路径 |
| 关键组合矩阵 | passed_with_scoped_debt | 三玩家神圣降临、眩光多档、飞行进攻/防御、神圣净化两分支、奖励骰和防御重投已覆盖；其它组合不外推 |
| 真实入口 E2E 与截图核验 | current_passed_with_scoped_debt | 同一官方 runner 分组为技能/升级组 15/15、卡牌/复合组 9/9，当前合计 24/24；39 张截图作为运行产物更新，三张关键修复图已有视觉 PASS，未重新进行完整视觉评分 |
| 测试语义对账 / 旧测试失效检查 | passed | 当前新增行为测试断言最终领域状态；没有把入口测试冒充玩法测试 |
| 同类扩审记录 | passed_with_scoped_debt | 九技能和 15 专属卡已全部纳入当前矩阵；未覆盖组合以 scoped-debt 保留，不写成全部规则组合通过 |
| 缺口分类与范围裁定 | passed | 本文件 2.3 已区分功能、验证、发布和范围外阻塞 |
| 残余范围声明 | passed | 明确列出未覆盖规则组合；全仓 i18n 已单独记录为通过，远端媒体发布也已单独记录为通过 |
| 旧 evidence / 旧结论对账回写 | passed | 三份炽天使 rule 文档已回写当前 47 条领域/录入测试、当前 24/24 分组真实入口、本轮目标范围修正和 E2E 辅助竞态结论 |

## 4. 权威来源

- 玩家板：public/assets/i18n/zh-CN/dicethrone/images/tianshi/player-board.png
- 提示板：public/assets/i18n/zh-CN/dicethrone/images/tianshi/tip.png
- 卡牌整图：public/assets/i18n/zh-CN/dicethrone/images/tianshi/cards.png
- 骰子：public/assets/i18n/zh-CN/dicethrone/images/tianshi/dice.png
- 状态图标原图：public/assets/i18n/zh-CN/dicethrone/images/tianshi/ 下的四类炽天使图标
- 本地运行时媒体：public/assets/i18n/zh-CN/dicethrone/images/tianshi/compressed/
- 卡牌 atlas 配置：src/assets/atlas-configs/dicethrone/ability-cards-tianshi.atlas.json
- 当前规则合同：src/games/dicethrone/rule/炽天使真相源表.md、炽天使录入核对.md、炽天使卡牌录入核对.md
- 当前代码实现：src/games/dicethrone/heroes/tianshi/、src/games/dicethrone/domain/、src/games/dicethrone/ui/

### 4.1 玩家板图面合同

| 物理槽位 | 图上对象 | 运行时对象 | 允许状态 | 可交互 | 结论 |
| --- | --- | --- | --- | --- | --- |
| fist | 圣刃 | holy-blade | active | 是 | 一致 |
| chi | 圣洁光辉 | holy-radiance | active | 是 | 一致 |
| sky | 神圣净化 | divine-purification | active | 是 | 一致 |
| lotus | 神圣惩戒 | divine-punishment | active | 是 | 一致 |
| combo | 凯旋归来 | triumphant-return | active | 是 | 一致 |
| lightning | 无上之力 | supreme-power | active | 是 | 一致 |
| calm | 天使长之志 | archangel-resolve | active | 是 | 一致 |
| meditate | 天使斗篷 | angelic-cloak | defense | 是 | 一致 |
| ultimate | 天堂断腕斩 | heavenly-severing | ultimate | 是 | 一致 |

该表证明槽位和对象对应，不证明每个对象的主效果已完成。

## 5. 对象级结论

### 5.1 九个技能

| 对象 | 规则子句与入口 | 当前证据层级 | 当前结论 |
| --- | --- | --- | --- |
| 圣刃（holy-blade） | 真实槽位启动基础攻击，最终回到无临时攻击状态 | L1/L3 passed；L4 不适用 | 直接攻击成功链通过；其它骰型/升级组合留在矩阵 |
| 圣洁光辉（holy-radiance） | 真实槽位启动攻击并获得飞行，攻击完成 | L1/L3 passed；L4 不适用 | 直接攻击和飞行最终状态通过 |
| 神圣净化（divine-purification） | 选择自己或对手；治疗/不可防御伤害；自选后可选移除状态并允许空选确认 | L2/L3/L4 passed | 真实玩家选择、状态选择和空选跳过链通过 |
| 神圣惩戒（divine-punishment） | 真实槽位投 4 个额外骰；按结果结算伤害、飞行、净化和眩光 | L3/L4 passed | 4 个奖励骰和最终 HP/Token/状态收口通过 |
| 凯旋归来（triumphant-return） | 小顺子攻击进入奖励骰，结算后清空临时结算 | L3/L4 passed | 奖励骰展示、关闭和攻击最终状态通过 |
| 无上之力（supreme-power） | 真实槽位结算攻击、飞行、神圣降临和眩光 | L3 passed | 最终攻击和三类状态/Token 通过 |
| 天使长之志（archangel-resolve） | 真实槽位结算大顺子攻击、飞行和眩光 | L3 passed | 最终攻击和两类状态/Token 通过 |
| 天使斗篷（angelic-cloak） | 防御掷骰奖励骰；免费重投一次并锁定上限后收口 | L2/L3/L4 passed | 重投次数、免费成本、禁用上限和最终防御结果通过 |
| 天堂断腕斩（heavenly-severing） | 真实终极槽位结算攻击、飞行、神圣降临和神圣祝福 | L3 passed | 终极攻击和三类 Token 通过 |

### 5.2 状态与 Token

| 对象 | 承接语义 | 触发时机 | 最终状态证据 | 层级与结论 |
| --- | --- | --- | --- | --- |
| 飞行 | 主动消耗 Token | 进攻或防御掷骰阶段 | 消耗 1 层；进攻攻击不可防御；防御主攻击免伤 | L2 passed；L3/L4 未覆盖真实操作 |
| 眩光 | 被动状态消费 | 下次进攻掷骰阶段结束 | 1 点无效、2–3 点减半向上取整、4–6 点正常；消费 1 层 | L2 passed；L3/L4 未覆盖真实操作 |
| 神圣降临 | 阶段触发 Token | 持有者自己的维持阶段 | 对所有真实对手逐层造成直接伤害，不伤害持有者 | L2 passed；L3/L4 未覆盖真实阶段链 |
| 神圣祝福 | 致死伤害保护 | 生命值将降至 0 | 消耗标记并将生命值保留为 1 | L2 passed；L3/L4 未覆盖真实受击链 |
| 净化 | 主动选择并消费 Token | 玩家主动使用 | 进入状态选择并移除可移除负面状态 | L2 由神圣净化覆盖；L3/L4 未覆盖真实 UI |

### 5.3 15 张专属卡

| 槽位 | 中文对象 | 运行时对象 | 当前层级与结论 |
| ---: | --- | --- | --- |
| 17 | 圣击 | card-tianshi-holy-strike | L3/L4 passed：真实攻击修正、5 个奖励骰、消耗 1 CP；领域回归锁定仅圣洁吊坠触发眩光 |
| 18 | 天使战术 | card-tianshi-angelic-tactics | L3/L4 passed：真实攻击修正、奖励骰、消耗 1 CP、获得飞行 |
| 19 | 无上之力 II / 福音临世 | upgrade-tianshi-supreme-power-2-gospel-arrival | 既有 L3/L4 成功路径通过；本轮 L2 定向回归补齐神圣降临、2 飞行、2 净化和眩光 |
| 20 | 神圣惩戒 II / 神圣指令 | upgrade-tianshi-divine-punishment-2-divine-command | L3/L4 passed：消耗 2 CP、升级、目标选择、治疗与不可防御伤害 |
| 21 | 神圣净化 II | upgrade-tianshi-divine-purification-2 | L3 passed：消耗 2 CP、升级并回到无交互状态 |
| 22 | 天使长之志 II / 神圣庇护 | upgrade-tianshi-archangel-resolve-2-divine-protection | L3/L4 passed：消耗 2 CP、升级、玩家目标选择、2 飞行和 2 净化 |
| 23 | 天使斗篷 III | upgrade-tianshi-angelic-cloak-3 | L3 passed：消耗 3 CP、替换防御技能 |
| 24 | 天使斗篷 II | upgrade-tianshi-angelic-cloak-2 | L3 passed：消耗 2 CP、替换防御技能 |
| 25 | 凯旋归来 II | upgrade-tianshi-triumphant-return-2 | L3 passed：消耗 2 CP、替换技能；领域回归锁定小顺子基础伤害为 8 |
| 26 | 圣洁光辉 II / 起飞 | upgrade-tianshi-holy-radiance-2-takeoff | L3/L4 passed：消耗 2 CP、升级、目标选择、飞行与不可防御伤害 |
| 27 | 圣刃 III / 小天使 II | upgrade-tianshi-holy-blade-3-cherub-2 | 既有 L3 成功路径通过；本轮 L2 领域回归锁定四个相同数字时施加眩光 |
| 28 | 神圣裁决 | card-tianshi-divine-arbitration | L2/L3/L4 passed：消耗 4 CP、三段玩家选择、神圣降临/眩光/2 个飞行/净化收口 |
| 29 | 至高圣洁 | card-tianshi-supreme-holiness | L3/L4 passed：0 CP、奖励骰圣洁吊坠分支、2 飞行和 2 净化 |
| 30 | 飞升 | card-tianshi-ascension | L3/L4 passed：消耗 1 CP、玩家目标选择并授予飞行 |
| 31 | 圣刃 II / 小天使 | upgrade-tianshi-holy-blade-2-cherub | L3 passed：消耗 2 CP、升级到 II、只获得飞行和神圣降临，不发净化 |

## 6. 验证证据

### 6.1 L1 结构证据

- 命令/结果：tianshi-intake.test.ts，3/3 通过。
- 证明内容：角色目录、六面骰面、九个技能 ID、角色板槽位映射、33 张牌、15 个专属 atlas 槽、正式本地压缩媒体、状态 atlas JSON、5 × 7 atlas 配置、DiceThrone manifest、根级 i18n manifest、atlas manifest、中英文关键文案。
- 不能证明：逐技能/逐卡完整玩法。

### 6.2 L2 领域行为证据

- 命令/结果：tianshi-behavior.test.ts 32/32 通过；tianshi-rule-matrix.test.ts 17/17 通过；tianshi-intake.test.ts 3/3 通过，合计 52/52。
- 证明内容：飞行进攻/防御分支；眩光五种骰面和三种攻击结果；神圣降临三玩家逐层伤害；起飞与神圣降临直接伤害通过共享伤害结算触发神圣祝福致死保护；神圣净化自己/对手分支和状态移除；神圣祝福致死保护；天使斗篷免费重投一次；圣击圣洁吊坠/双翼否定分支；神圣惩戒 II 2 点不可防御伤害；神圣裁决三段选择；圣刃 II / 小天使无净化。
- 不能证明：所有规则组合、所有失败/否则分支和所有跨阶段组合；这些不从成功路径外推。

### 6.3 L3/L4 真实入口证据

- 命令：node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/tianshi-ability-card-real-entry.e2e.ts
- 修复前历史基线：24/24 通过；9 条技能成功链 + 15 条专属卡成功链。
- 本轮修正前的历史结果（2026-08-05）：同一命令 24/24 通过；其中包含神圣净化选择自己后的可选状态移除和空选跳过路径。该历史证据不覆盖本轮新增的四项卡牌规则修正。
- 本轮修正后结果：原始单次长链曾在约 244 秒和 304 秒处超时；拆分同一官方 runner 后，技能/升级组 15/15、卡牌/复合组 9/9，当前合计 24/24 通过；本轮新增神圣裁决三段选择和圣刃 II / 小天使两条用例各 1/1 通过。神圣裁决补拍重跑时，runner 先发现共享 single-worker 端口占用并自动回退 isolated runtime，实际用例为 1/1 passed；退出阶段仅留下共享端口复用提示，不是业务断言失败。首次分组暴露的唯一业务无关失败是 E2E 辅助函数等待连续卡牌特写队列清空，现场卡牌特写为 pointer-events-none 非交互层；删除该无关等待后复跑通过。该修复只调整测试收口等待，不改炽天使领域或产品 UI。
- 真实操作链：真实技能槽点击 → 攻击/奖励骰/防御重投/最终状态；以及真实手牌拖拽 → CP 消耗、升级、目标选择、奖励骰或最终 Token/状态。
- 关键否定路径：神圣净化选择自己后进入状态移除选择，确认时不选状态，成功空选跳过并回到无交互状态。
- intake 入口补充：node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/tianshi-intake.e2e.ts，1/1 通过，覆盖双玩家选角、初始化、九槽、4 张手牌和对手视角。
- 绝对截图路径：
  - D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\tianshi-intake.e2e\真实在线双玩家应完成炽天使选角初始化并进入牌桌\01-选角-炽天使与武僧.jpg
  - D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\tianshi-intake.e2e\真实在线双玩家应完成炽天使选角初始化并进入牌桌\02-牌桌-炽天使玩家板与手牌.jpg
  - D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\tianshi-intake.e2e\真实在线双玩家应完成炽天使选角初始化并进入牌桌\03-牌桌-对手视角已进入.jpg
- 截图目录：D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\tianshi-ability-card-real-entry.e2e
- 截图基线：24 个测试目录、39 张原始截图；本轮新增神圣裁决两张中间选择态和一张最终收口原始截图已在预算释放后重跑生成。
- 图面检查：神圣裁决三张新原始截图已逐张复核为 PASS；两张选择态的提示文字、玩家候选按钮和中间模态层清楚，最终图能同时看到玩家板、状态/Token、生命/CP、阶段条和手牌，无遮挡、破图或错误素材。修复前 39 张完整截图集的逐张审计基线为 PASS，综合 93/100；本组三张图作为当前新增有序截图集单独通过视觉审计，不外推为所有规则组合已完成。
- 负向影响检查：主棋盘、玩家板、状态/Token、生命/CP、骰盘、手牌、阶段条、目标选择和确认入口均能在对应压力态中找到；结算图偶尔同时捕获合法的对手卡牌展示，但没有遮住关键状态或制造空白/破图。

### 6.4 其它验证

- npm run typecheck：通过。
- 炽天使定向 ESLint：0 errors；选定文件共 31 条 warning，其中 flowHooks.ts 27 条、E2E 文件 4 条，未形成 error。
- basic-commands-coverage.test.ts：119/119 通过；InteractionOverlay.test.tsx：30/30 通过，作为共享命令/交互层回归证据。
- OpenSpec strict validate：通过。
- npm run i18n:check：通过；炽天使关键键以及此前命中的 SmashUp 牧师、木精灵和法师现有按钮/提示键均已补齐。
- 服务器上传：已执行，发布批次 20260804164030910，共 10 个炽天使运行时媒体对象。
- 公开 URL HEAD：已执行，10/10 返回 200。

## 7. 禁止假阳性检查

- 没有把选择页或入桌截图当作技能/卡牌玩法收口。
- 没有把 tianshi-intake.test.ts 的注册和资源断言当作所有机制已实现。
- 没有把 tianshi-behavior.test.ts 的代表性领域测试外推为 9 个技能和 15 张专属卡全部通过。
- 没有把 prompt、custom action 或中间奖励骰状态当作最终真实 UI 收口。
- 没有把本地资源存在当作服务器已上传。
- 全仓 npm run i18n:check 已由实际命令确认通过；该门禁通过不被外推为所有炽天使规则组合已完成。

## 8. 共享根因与残余范围

### 8.1 当前残余

1. 技能和卡牌的主要成功路径已有当前真实入口 24/24 基线证据，且本轮两条修正入口各 1/1 通过；所有未覆盖的规则失败/否则/组合分支仍按 scoped-debt 保留，不能从成功路径外推。
2. 神圣裁决已按官方卡槽补齐为眩光、2 个飞行、净化三段玩家选择；领域矩阵、真实入口链和三张新增原始截图的视觉审计均已通过。两张中间选择态曾短暂受全局预算占用影响，预算释放后已按同一入口补拍并收口。
3. 全仓 i18n 命令已通过；此前命中的 SmashUp 牧师、木精灵和法师现有按钮/提示已补齐本地化键与木精灵共享选择提示参数。这是共享门禁收口，不是炽天使规则修复。

### 8.2 后续唯一入口

- 继续前先读本文件和三份炽天使 rule 文档。
- 若继续扩审，只进入“未覆盖规则子句的失败/否则/组合路径”这一条已登记入口；新增文案时再按同一命令复查 i18n。
- 不得把本轮 24 条基线成功路径或新增两条修正入口外推为全部规则组合已证明。

## 9. 修订记录

- 旧文档：src/games/dicethrone/rule/炽天使真相源表.md、炽天使录入核对.md、炽天使卡牌录入核对.md
- 旧结论：曾记录 1/1 intake、20/20 行为测试，并把九技能/15 卡逐项真实交互写成 blocked。
- 失效原因：旧文档把修正后的真实入口停留在两次长链超时口径，尚未吸收后续对 E2E 辅助等待竞态的定位和分组复跑结果。
- 当前替代结论：本地静态接入、52/52 领域与录入测试、直接伤害共享结算与神圣祝福保护、当前 24/24 基线真实入口加本轮 2 条规则修正入口均已通过；神圣裁决三张新增原始截图已逐张视觉审计通过；未覆盖组合仍按边界保留，全仓 i18n 已通过。

## 10. 对外汇报口径

### 允许说

- 炽天使本地正式资源、状态 atlas、专属卡牌 atlas 配置和三份本地 manifest 已接入并通过合同测试。
- 炽天使九个技能和 15 张专属卡各自至少一条真实入口成功路径已通过；奖励骰、防御重投、复合升级、目标选择和神圣净化空选跳过也有直接证据。
- 原始单次长链曾超时；修正 E2E 辅助等待后，同一真实入口拆分为 15/15 + 9/9，当前合计 24/24 通过。原始截图基线逐张图面审计 PASS，综合 93/100；本轮神圣裁决新增两张中间选择态和一张最终收口原始截图已逐张审计为 PASS。
- 飞行、眩光、神圣净化、神圣降临、神圣祝福、天使斗篷奖励骰和神圣裁决已有代表性领域验证。
- 当前结论是“本地 intake 与代表性行为已验证，仍有残余范围”。

### 禁止说

- 炽天使所有规则组合、失败分支和跳过分支全部已完成。
- 15 张专属卡所有可能结果组合全部已在真实 UI 中验证。
- 炽天使完整可玩已完成。
- 全仓 npm run i18n:check 已通过；此前命中的 SmashUp 牧师、木精灵和法师本地化合同已补齐，但这不替代炽天使未覆盖规则组合的验收。
