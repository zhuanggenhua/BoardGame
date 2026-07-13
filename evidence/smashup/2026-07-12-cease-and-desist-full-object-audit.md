# Cease and Desist 四派系全对象审计（更新）

- 对象总数：65（55 张唯一卡面 / 80 张实体牌 / 8 个基地 / 2 个泰坦）
- 裁图：63/65
- 本地 runtime 注册缺口：0
- 双语规则文本缺口：0 个对象仍只有 name
- 对象级测试零引用：0
- direct E2E 零引用：0
- 审计分类：55 张卡牌 / 8 个基地 / 2 个泰坦分开统计，基地不再误归为 titan。

## 本轮已补
- 非月球：修正随机源调用为 RandomFn 对象口径。
- 联邦星舰：补齐移动 prompt continuation 的基地索引，能把其他基地己方随从移至联邦星舰。
- 中立区：补齐保护上下文 sourceBaseIndex，基地内其他玩家随从的非行动影响能被拦截。
- 审计脚本：补齐 base / titan 分类口径，证据表中的 8 个基地均按 base 统计。
- BASE_REPLACED：补齐重复归约幂等保护，反应队列后处理不再重复警告已替换基地。
- 八个基地能力对象级消费点：定向 Vitest 已跑通且无 BASE_REPLACED 警告。
- 双语规则文本：55 张卡和 8 个基地均补齐 zh-CN/en 规则文本，仅名称 locale 缺口为 0。
- 四派系 UI 文案：补齐宇宙武士、卑劣封臣、星际旅者、百变机兵 faction meta 双语 key。
- Cease 交互文案：战斗准备、宇航机器人、星际旅者回手替代选项已改为 titleKey/labelKey。
- 对象级覆盖：65 个对象均有测试引用和 direct E2E 审计矩阵引用。

## 本轮验证
- `npx vitest run src/games/smashup/__tests__/abilities/cease-and-desist.test.ts`：15/15 passed。
- `npm run typecheck`：passed。
- `npm run assets:validate`：passed。
- `npm run i18n:check`：Cease and Desist 自身 missing key / raw simple-choice warning 已清零；当前剩余报告均落在并行 Smash Up 批次。
- `openspec validate add-smashup-cease-and-desist-factions --strict --no-interactive`：valid。
- `npm run test:e2e:file -- e2e/smashup/smashup-cease-and-desist-four-factions.e2e.ts`：3/3 passed。

## E2E 截图证据
- `D:\GA\BoardGame-upstream-main-dev-20260601\test-results\evidence-screenshots\smashup\smashup-cease-and-desist-four-factions.e2e\派系选择页能看到宇宙武士、卑劣封臣、星际旅者、百变机兵\cease-and-desist-faction-selection-visible.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260601\test-results\evidence-screenshots\smashup\smashup-cease-and-desist-four-factions.e2e\四派系代表能力可从真实手牌入口打出并落到权威状态\cease-astroknights-yield-to-rage-after-power.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260601\test-results\evidence-screenshots\smashup\smashup-cease-and-desist-four-factions.e2e\四派系代表能力可从真实手牌入口打出并落到权威状态\cease-ignobles-repaying-debts-after-control.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260601\test-results\evidence-screenshots\smashup\smashup-cease-and-desist-four-factions.e2e\四派系代表能力可从真实手牌入口打出并落到权威状态\cease-star-roamers-mass-teleport-after-return.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260601\test-results\evidence-screenshots\smashup\smashup-cease-and-desist-four-factions.e2e\四派系代表能力可从真实手牌入口打出并落到权威状态\cease-changerbots-form-mergacon-after-power.jpg`

## 残余范围
- R2：用户已明确不用管，本审计不把远端资源验证列为 blocker，也不标记为完成。
- 泰坦裁图：合体机器人、漫游山岭巨人复用既有 titan atlas；不属于 Cease 卡牌/基地 atlas 缺图。
- i18n 全局报告：仍有并行 Smash Up 批次缺 key / raw 文案警告，不归入本四派系审计完成口径。

## 全对象明细
| 对象 | 类型 | locale | 注册/消费点 | 测试 | E2E | 裁图 |
| --- | --- | --- | --- | ---: | ---: | --- |
| 阻止探解（astroknights_block_the_probe） | action | full/full | simpleAbility:onPlay, simpleAbility:special | 5 | 1 | yes |
| 隐蔽基地（astroknights_hidden_base） | action | full/full | simpleAbility:ongoing, trigger:onTurnStart | 1 | 1 | yes |
| 垃圾回收（astroknights_recycle_the_trash） | action | full/full | simpleAbility:onPlay | 1 | 1 | yes |
| 狂怒支配（astroknights_yield_to_rage） | action | full/full | simpleAbility:onPlay | 1 | 2 | yes |
| 激光剑（astroknights_laser_sword） | action | full/full | powerModifier, protection:affect, simpleAbility:ongoing | 4 | 1 | yes |
| 战斗准备（astroknights_prepare_for_battle） | action | full/full | simpleAbility:onPlay | 1 | 1 | yes |
| 使用“似”原力（astroknights_use_the_fours） | action | full/full | simpleAbility:onPlay | 1 | 1 | yes |
| 这是个陷阱！（astroknights_its_a_trap） | action | full/full | simpleAbility:special | 1 | 1 | yes |
| 恼人的外星（astroknights_annoying_alien） | minion | full/full | simpleAbility:talent | 1 | 1 | yes |
| 帕伯克人（astroknights_pupoks） | minion | full/full | simpleAbility:talent | 1 | 1 | yes |
| 外星人大师（astroknights_alien_guru） | minion | full/full | trigger:onActionPlayed | 1 | 1 | yes |
| 自主地毯（astroknights_walking_carpet） | minion | full/full | simpleAbility:special | 1 | 1 | yes |
| 恶棍（astroknights_scoundrel） | minion | full/full | simpleAbility:talent | 1 | 1 | yes |
| 幽灵武士（astroknights_ghost_knight） | minion | full/full | powerModifier, protection:destroy | 4 | 1 | yes |
| 礼仪机器人（astroknights_mannersbot） | minion | full/full | simpleAbility:talent | 6 | 2 | yes |
| 太空王子（astroknights_space_prince） | minion | full/full | simpleAbility:talent | 1 | 1 | yes |
| 太空武士（astroknights_space_knight） | minion | full/full | simpleAbility:talent | 1 | 1 | yes |
| 宇航机器人（astroknights_astro_robot） | minion | full/full | simpleAbility:onPlay | 1 | 1 | yes |
| 有债必还（ignobles_repaying_debts） | action | full/full | simpleAbility:onPlay | 4 | 3 | yes |
| 宠儿的命运（ignobles_fate_of_the_favorites） | action | full/full | simpleAbility:onPlay | 1 | 1 | yes |
| 红色生日聚会（ignobles_red_birthday_party） | action | full/full | simpleAbility:onPlay | 1 | 1 | yes |
| 交换人质（ignobles_hostage_exchange） | action | full/full | simpleAbility:onPlay | 1 | 1 | yes |
| 必然的背叛（ignobles_inevitable_betrayal） | action | full/full | simpleAbility:special | 2 | 1 | yes |
| 启用间谍（ignobles_activate_the_spy） | action | full/full | simpleAbility:onPlay | 2 | 2 | yes |
| 视线之外（ignobles_out_of_sight） | action | full/full | simpleAbility:onPlay | 1 | 1 | yes |
| 家族召唤（ignobles_banner_call） | action | full/full | simpleAbility:onPlay | 1 | 1 | yes |
| 奸诈贵族（ignobles_sneaky_squire） | minion | full/full | simpleAbility:onPlay | 9 | 3 | yes |
| 未婚妻（ignobles_betrothed） | minion | full/full | simpleAbility:onPlay | 1 | 1 | yes |
| 国王之脚（ignobles_foot_of_the_king） | minion | full/full | trigger:onTurnEnd | 1 | 1 | yes |
| 龙之伯母（ignobles_aunt_of_drakes） | minion | full/full | simpleAbility:talent | 1 | 1 | yes |
| 奇异新世界（star_roamers_weird_new_worlds） | action | full/full | simpleAbility:onPlay | 3 | 1 | yes |
| 鞭绳回旋（star_roamers_whiplash_maneuver） | action | full/full | simpleAbility:ongoing, trigger:onCardReturnedToHand | 2 | 1 | yes |
| 防御力场（star_roamers_protector_fields） | action | full/full | protection:action, simpleAbility:ongoing | 2 | 1 | yes |
| 传送超额（star_roamers_teleport_overflow） | action | full/full | simpleAbility:onPlay | 1 | 1 | yes |
| 传送事故（star_roamers_teleport_error） | action | full/full | simpleAbility:onPlay | 1 | 1 | yes |
| 超高速运转（star_roamers_hyperspeed_10） | action | full/full | simpleAbility:onPlay | 1 | 1 | yes |
| 传送我上船（star_roamers_port_me_up） | action | full/full | simpleAbility:onPlay, simpleAbility:special | 2 | 1 | yes |
| 大规模传送（star_roamers_mass_teleport） | action | full/full | simpleAbility:onPlay | 4 | 3 | yes |
| 舰船工程师（star_roamers_ships_engineer） | minion | full/full | trigger:onCardReturnedToHand | 2 | 1 | yes |
| 医疗指挥官（star_roamers_medical_officer） | minion | full/full | trigger:onCardReturnedToHand | 2 | 1 | yes |
| 科学指挥官（star_roamers_science_officer） | minion | full/full | simpleAbility:talent | 4 | 2 | yes |
| 炮灰（star_roamers_ensign） | minion | full/full | powerModifier | 16 | 2 | yes |
| 舰长（star_roamers_ships_captain） | minion | full/full | simpleAbility:onPlay | 1 | 1 | yes |
| 跋扈模块（changerbots_matrix_of_bossiness） | action | full/full | powerModifier, simpleAbility:ongoing | 3 | 1 | yes |
| 重组形态（changerbots_change_into_a_gun） | action | full/full | simpleAbility:onPlay | 1 | 1 | yes |
| 乘客（changerbots_passengers） | action | full/full | simpleAbility:talent | 4 | 1 | yes |
| 触动（changerbots_the_touch） | action | full/full | simpleAbility:talent | 1 | 1 | yes |
| 飞行组件（changerbots_flighterizer） | action | full/full | simpleAbility:talent | 1 | 1 | yes |
| 变形，出发！（changerbots_change_up_and_roll_on） | action | full/full | simpleAbility:special | 2 | 1 | yes |
| 铯装甲（changerbots_cesium_armor） | action | full/full | powerModifier, protection:destroy, simpleAbility:ongoing | 3 | 1 | yes |
| 合体形态（changerbots_form_mergacon） | action | full/full | simpleAbility:onPlay | 4 | 4 | yes |
| 李德徒（changerbots_leader_two） | minion | full/full | simpleAbility:talent | 1 | 1 | yes |
| 破空（changerbots_solarshout） | minion | full/full | simpleAbility:talent | 1 | 1 | yes |
| 飞撕（changerbots_huffie） | minion | full/full | simpleAbility:talent | 7 | 3 | yes |
| 创世（changerbots_bruiser） | minion | full/full | protection:destroy, simpleAbility:talent | 3 | 3 | yes |
| 刺王座（base_spikey_chair_room） | base | full/full | baseAbility:onTurnEnd | 1 | 1 | yes |
| 非月球（base_no_moon） | base | full/full | baseAbility:beforeScoring | 4 | 2 | yes |
| 联邦星舰（base_uss_undertaking） | base | full/full | baseAbility:onTurnStart | 12 | 1 | yes |
| 宇宙大王（base_unicrave） | base | full/full | baseAbility:beforeScoring | 2 | 1 | yes |
| 雪覆城（base_wintersquashed） | base | full/full | baseAbility:onMinionPlayed | 3 | 1 | yes |
| 改造室（base_changing_room） | base | full/full | baseAbility:onTalentUsed | 4 | 2 | yes |
| 中立区（base_neutral_space） | base | full/full | protection:affect | 8 | 1 | yes |
| 渣渣和坏蛋的老巢（base_hive_of_scum_and_villainy） | base | full/full | baseAbility:onActionPlayed | 1 | 1 | yes |
| 合体机器人（changerbots_mergacon） | titan | full/full | simpleAbility:talent, trigger:onTurnStart | 1 | 1 | no |
| 漫游山岭巨人（ignobles_the_hill_that_strolls） | titan | full/full | simpleAbility:special, simpleAbility:talent, trigger:onMinionAffected | 1 | 1 | no |
