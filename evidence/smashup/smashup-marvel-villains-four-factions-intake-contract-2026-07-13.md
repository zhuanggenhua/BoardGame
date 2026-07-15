# 大杀四方漫威反派四派系 intake 合同（2026-07-13）

## 本轮范围

| 对象 | 结论 |
| --- | --- |
| gameId | `smashup` |
| 批次 | 漫威反派侧四派系 |
| 派系 | 九头蛇（Hydra）、克里（Kree）、邪恶大师（Masters of Evil）、邪恶六人组（Sinister Six） |
| 本轮资源 | 一张 `9 x 6` 卡牌 atlas；未包含基地 atlas |
| 当前目标 | 先完成 L0/L1 intake、资源和静态接入；玩法能力继续按派系推进 |
| 完成口径 | L1 完成不得等同于玩法完成；四派系在 L2/L3/L4 完成前保持 `implementationStatus: in_progress` |

## 来源与资源链

| 字段 | 值 |
| --- | --- |
| 原始图路径 | `C:/Users/Dqm/Downloads/Smash Up! by Mervil (2833984701)-汉化版/Smash Up! by Mervil (2833984701)-汉化图/Mods/Images/httpssteamusercontentaakamaihdnetugc162184953865180163720AEEBDBC9CD6DB431AAD40A1B6FAFE150B0815C.png` |
| 文件大小 | `33,423,555 bytes` |
| 尺寸 | `4399 x 4096` |
| SHA-256 | `44ae80f5629ad1d33a2c438a2955112a38c1ae5d7addaa2d8ae44418ef15a5fb` |
| 正式 PNG 落点 | `public/assets/i18n/zh-CN/smashup/cards/marvel_villains.png` |
| 压缩 WebP | `public/assets/i18n/zh-CN/smashup/cards/compressed/marvel_villains.webp` |
| manifest | `public/assets/i18n/zh-CN/smashup/assets-manifest.json` 与 `public/assets/i18n/assets-manifest.json` 已包含 `marvel_villains` |
| 远端 R2/CDN | `pending: follow Marvel wave-one PR handoff until published` |

## 图集合同

| 字段 | 结论 |
| --- | --- |
| 网格 | `9 x 6` |
| 索引顺序 | row-major |
| 有效卡面 | `0-48` |
| 空白 / 尾格 | `49-53` |
| 临时总览 | `temp/smashup-marvel-villains-intake/overview.png` |
| indexed contact sheet | `temp/smashup-marvel-villains-intake/contact-indexed.png` |
| 单卡裁图目录 | `temp/smashup-marvel-villains-intake/cards/` |
| 逐卡 JSON 合同 | `temp/smashup-marvel-villains-intake/card-contract.json` |

## 字段权威分工

| 字段 | 主来源 | 状态 |
| --- | --- | --- |
| `factionId / nameEn / count / power / effectTextEn` | Smash Up Wiki 四派系页 + 本地图集归属核对 | `locked-for-en-mechanics` |
| `atlas index / row / col / nameZh` | 用户提供图集与单卡裁图 | `locked` |
| `effectTextZh` | 暂由英文机制文本翻译 | `pending-exact-image-transcript` |
| 基地 | 本图不包含基地 | `out-of-scope` |

## 批次矩阵

| 派系 | 唯一卡 | 实体牌 | L0 图集/索引 | L1 静态接入 | L2 玩法行为 | L3 真实入口 | L4 流程收口 | 状态 |
| --- | ---: | ---: | --- | --- | --- | --- | --- | --- |
| 九头蛇 | 11 | 20 | passed | passed | pending | pending | pending | in_progress |
| 克里 | 12 | 20 | passed | passed | pending | pending | pending | in_progress |
| 邪恶大师 | 12 | 20 | passed | passed | pending | pending | pending | in_progress |
| 邪恶六人组 | 14 | 20 | passed | passed | pending | pending | pending | in_progress |

## 逐卡合同

| idx | 派系 | 类型 | 数量 | 力量 | defId | 中文名 | 英文名 | 机制摘要 | 状态 |
| ---: | --- | --- | ---: | ---: | --- | --- | --- | --- | --- |
| 0 | 九头蛇 | 随从 | 1 | 5 | `hydra_red_skull` | 红骷髅 | Red Skull | Ongoing: After one of your characters is destroyed, draw a card. Talent: Destroy one of your characters to draw a card. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 1 | 九头蛇 | 随从 | 1 | 4 | `hydra_baron_strucker` | 斯特拉克男爵 | Baron Strucker | Talent: Destroy one of your characters. After it is destroyed, move up to two of your characters from other bases to here. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 2 | 九头蛇 | 随从 | 1 | 4 | `hydra_madame_hydra` | 蝰蛇 | Madame Hydra | Talent: Destroy one of your characters to give this character +2 power until the end of the turn. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 3 | 九头蛇 | 随从 | 3 | 2 | `hydra_arnim_zola` | 阿尼姆·佐拉 | Arnim Zola | Ongoing: This character has +1 power for each of your other characters here with a printed power of 2 or less. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 4 | 九头蛇 | 随从 | 6 | 2 | `hydra_hydra_agent` | 九头蛇特工 | Hydra Agent | Ongoing: After this character is destroyed, play up to two extra characters of power 2 or less here. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 5 | 九头蛇 | 战术 | 1 |  | `hydra_fanatical_devotion` | 狂热的献身 | Fanatical Devotion | Base modifier. Ongoing: Your characters here each have +2 power if one or more of your characters have been destroyed here this turn. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 6 | 九头蛇 | 战术 | 1 |  | `hydra_hail_hydra` | 九头蛇万岁! | Hail Hydra! | Destroy one of your characters to draw cards equal to its power. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 7 | 九头蛇 | 战术 | 2 |  | `hydra_hour_of_destiny` | 命运之时 | Hour of Destiny | Search your deck for up to two characters of power 2 or less, reveal them, and draw them. Then shuffle your deck. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 8 | 九头蛇 | 战术 | 1 |  | `hydra_reactivate_agents` | 再次激活 | Reactivate Agents | Place up to two characters of 2 power or less from your discard pile into your hand. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 9 | 九头蛇 | 战术 | 1 |  | `hydra_secret_reserves` | 秘密储备 | Secret Reserves | Shuffle any number of characters of power 2 or less from your discard pile into your deck. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 10 | 九头蛇 | 战术 | 2 |  | `hydra_two_more_shall_take_its_place` | 取而代之 | Two More Shall Take Its Place | Destroy one of your characters. After it is destroyed, play up to two characters of power 2 or less as extra characters onto that base. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 11 | 克里 | 随从 | 1 | 5 | `kree_supreme_intelligence` | 至高智慧 | Supreme Intelligence | Ongoing: After you play an action, one of your other characters gains +1 power until the end of the turn. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 12 | 克里 | 随从 | 2 | 4 | `kree_minn_erva` | 敏-尔瓦博士 | Minn-Erva | Draw two cards. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 13 | 克里 | 随从 | 3 | 3 | `kree_ronan_the_accuser` | 指控者罗南 | Ronan the Accuser | You may play an extra action. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 14 | 克里 | 随从 | 4 | 2 | `kree_kree_sentry` | 克里人哨兵 | Kree Sentry | Ongoing: This character has +2 power if you have played two or more actions this turn. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 15 | 克里 | 战术 | 2 |  | `kree_battle_rage` | 战斗怒吼 | Battle Rage | One of your characters gains +2 power until the end of the turn. Draw a card. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 16 | 克里 | 战术 | 1 |  | `kree_call_for_backup` | 呼叫支援 | Call for Backup | Draw two cards. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 17 | 克里 | 战术 | 1 |  | `kree_it_begins` | 开始了 | It Begins | One of your characters gains +1 power until the end of the turn. Draw a card. You may play an extra action. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 18 | 克里 | 战术 | 1 |  | `kree_prepare_to_engage` | 准备作战 | Prepare to Engage | Reveal the top five cards of your deck. Place up to two revealed actions into your hand and shuffle the rest into your deck. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 19 | 克里 | 战术 | 1 |  | `kree_proven_methods` | 成熟的方法 | Proven Methods | Place up to two actions from your discard pile on top of your deck in any order. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 20 | 克里 | 战术 | 1 |  | `kree_relentless_attack` | 无情攻击 | Relentless Attack | Character modifier. Talent: Play an extra action. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 21 | 克里 | 战术 | 2 |  | `kree_righteous_fury` | 正义之怒 | Righteous Fury | Character modifier. Ongoing: This character has +3 power. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 22 | 克里 | 战术 | 1 |  | `kree_speed_up` | 加速 | Speed Up | Play up to two extra actions. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 23 | 邪恶大师 | 随从 | 1 | 5 | `masters_of_evil_baron_zemo` | 泽莫男爵 | Baron Zemo | Ongoing: After this base scores, gain 1 VP and place this character on the bottom of its owner's deck. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 24 | 邪恶大师 | 随从 | 2 | 4 | `masters_of_evil_ulysses_klaw` | 克劳 | Ulysses Klaw | Draw a card for every 4 VP you have. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 25 | 邪恶大师 | 随从 | 3 | 3 | `masters_of_evil_black_mamba` | 黑曼巴 | Black Mamba | Ongoing: This character has +1 power for every 4 VP you have. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 26 | 邪恶大师 | 随从 | 4 | 2 | `masters_of_evil_absorbing_man` | 吸收人 | Absorbing Man | Talent: Destroy this character and another Absorbing Man to gain 1 VP. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 27 | 邪恶大师 | 战术 | 1 |  | `masters_of_evil_a_portent_of_doom` | 厄运之兆 | A Portent of Doom | Base modifier. Play on a base with no player's characters. Special: When this base scores, if you have 1 or more power here gain 1 VP. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 28 | 邪恶大师 | 战术 | 2 |  | `masters_of_evil_acceptable_losses` | 可接受的损失 | Acceptable Losses | Destroy one of your characters of power 4 or more to gain 1 VP. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 29 | 邪恶大师 | 战术 | 1 |  | `masters_of_evil_ball_and_chain` | 链球 | Ball and Chain | Character modifier. Ongoing: This character has +2 power and cannot be destroyed by other players' cards. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 30 | 邪恶大师 | 战术 | 1 |  | `masters_of_evil_convergence` | 汇聚 | Convergence | Move one of your characters to another base. After it is moved, if you have four or more characters at that base, gain 1 VP. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 31 | 邪恶大师 | 战术 | 2 |  | `masters_of_evil_gain_the_upper_hand` | 取得优势 | Gain the Upper Hand | Destroy a character of power 3 or less. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 32 | 邪恶大师 | 战术 | 1 |  | `masters_of_evil_indestructible_form` | 坚不可摧的形态 | Indestructible Form | Base modifier. Ongoing: Your characters here cannot be destroyed by other players' cards. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 33 | 邪恶大师 | 战术 | 1 |  | `masters_of_evil_sonic_shockwave` | 音速冲击波 | Sonic Shockwave | Destroy another player's character with less power than your total power at its base. After it is destroyed, if that character had 5 or more power, gain 1 VP. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 34 | 邪恶大师 | 战术 | 1 |  | `masters_of_evil_world_domination` | 统治世界 | World Domination | Base modifier. Talent: One of your characters here gains +2 power until the end of the turn. Ongoing: After this base scores, move this action to another base. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 35 | 邪恶六人组 | 随从 | 1 | 4 | `sinister_six_doctor_octopus` | 章鱼博士 | Doctor Octopus | Ongoing: At the start of your turn, you may reduce this base's breakpoint by 4 until the end of the turn. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 36 | 邪恶六人组 | 随从 | 1 | 4 | `sinister_six_mysterio` | 神秘客 | Mysterio | Talent: Play a base modifier here as an extra action OR draw a card. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 37 | 邪恶六人组 | 随从 | 2 | 3 | `sinister_six_green_goblin` | 绿魔 | Green Goblin | Talent: Reduce this base's breakpoint by 3 until the end of the turn. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 38 | 邪恶六人组 | 随从 | 2 | 3 | `sinister_six_vulture` | 秃鹫 | Vulture | You may place a base modifier from your discard pile on top of your deck. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 39 | 邪恶六人组 | 随从 | 2 | 2 | `sinister_six_electro` | 电王 | Electro | Ongoing: This base's breakpoint is reduced by 2. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 40 | 邪恶六人组 | 随从 | 2 | 2 | `sinister_six_sandman` | 沙人 | Sandman | Ongoing: This character has +2 power if the breakpoint here is 19 or less. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 41 | 邪恶六人组 | 战术 | 2 |  | `sinister_six_ambush` | 伏击 | Ambush | Reduce a base's breakpoint by 4 until the end of the turn. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 42 | 邪恶六人组 | 战术 | 1 |  | `sinister_six_cover_the_exits` | 隐藏出口 | Cover the Exits | Base modifier. Ongoing: Your characters here have +1 power. After this base scores, if its breakpoint was 19 or less, shuffle up to two of your characters here into their owners' deck. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 43 | 邪恶六人组 | 战术 | 1 |  | `sinister_six_incite_panic` | 煽动恐慌 | Incite Panic | Base modifier. Ongoing: Other players' characters here have -1 power. If the breakpoint here is 19 or less, other players cannot use Special abilities while this base is scoring. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 44 | 邪恶六人组 | 战术 | 1 |  | `sinister_six_move_the_goods` | 移动货物 | Move the Goods | Move a base modifier from one base to another. Special: You may play this after a base scores. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 45 | 邪恶六人组 | 战术 | 1 |  | `sinister_six_my_master_plan` | 我的总计划 | My Master Plan | Base modifier. Talent: If the breakpoint here is 19 or less, draw a card. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 46 | 邪恶六人组 | 战术 | 1 |  | `sinister_six_pressure_from_all_sides` | 四面楚歌 | Pressure from All Sides | Base modifier. Talent: Reduce this base's breakpoint by 1 for each character on it until the end of the turn. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 47 | 邪恶六人组 | 战术 | 2 |  | `sinister_six_reroute_the_power` | 改变力量 | Reroute the Power | Base modifier. Talent: If the breakpoint here is 19 or less, give one of your characters here +3 power until the start of your next turn. | L0 locked / L1 pending / 中文正文待逐字复核 |
| 48 | 邪恶六人组 | 战术 | 1 |  | `sinister_six_witness_our_superiority` | 见证我们的优势 | Witness Our Superiority | Base modifier. Ongoing: This base's abilities are cancelled. | L0 locked / L1 pending / 中文正文待逐字复核 |

## Implementation handoff

- 九头蛇：核心机制是己方角色被摧毁后的补牌、摧毁己方角色换抽牌 / 移动 / 额外打出、低力量角色检索与弃牌堆回收。
- 克里：核心机制是行动牌连打、抽牌、行动牌回收、行动打出数量驱动的临时力量。
- 邪恶大师：核心机制是 VP 阈值、计分后得 VP、摧毁保护、摧毁 / 移动后得 VP。
- 邪恶六人组：核心机制是降低基地临界点、低临界点条件分支、基地修正移动、计分窗口 special 与基地能力取消。

## 验证记录

| 命令 | 结果 |
| --- | --- |
| `openspec validate add-smashup-marvel-villains-four-factions --strict --no-interactive` | passed |
| `npx vitest run src/games/smashup/__tests__/marvelVillainsResourceContract.test.ts` | passed：3 tests |
| `npm run test -- src/games/smashup/__tests__/marvelVillainsResourceContract.test.ts` | timed out：仓库 `test` 脚本会串行跑全量套件，非定向失败 |

## 当前未收口项

- `effectTextZh` 仍需逐字对照单卡裁图，不得标记为完全 locked。
- `public/assets/i18n/zh-CN/smashup/cards/compressed/marvel_villains.webp` 已生成。
- manifest 已包含 `marvel_villains`；远端发布后仍需 HEAD 回查。
- 四派系 L2/L3/L4 玩法实现、测试、E2E 与截图尚未完成。
- R2/CDN `HEAD 200` 尚未执行；若沿用 PR handoff，需要发布后回查。
