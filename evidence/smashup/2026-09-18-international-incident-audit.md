# 大杀四方《环游世界：国际事件》四派系批次审计回写

## 基本信息

- 对象：相扑手、火枪手、骑警、摔角手
- 日期：2026-09-18
- 主真相源：`src/games/smashup/data/factions/international_incident.ts`、`src/games/smashup/abilities/international_incident.ts`、`2026-07-15-international-incident-effect-atom-matrix.md`
- 当前状态：四派系 59 个对象的本地规则审计已按派系逐项闭合；批次整体仍为 `in_progress`，仅保留共享四派系回归基线和两个游戏级 manifest 的远端发布残余，不把这些残余混成对象规则缺陷。

## 图片与资源合同

- 完整单卡主裁图：`public/assets/i18n/zh-CN/smashup/cards/international_incident.png`，卡牌 atlas 为 7 x 8；四派系对象的 `previewRef.index` 均回指同一主裁图。
- 基地主裁图：`public/assets/i18n/zh-CN/smashup/base/international_incident_bases.png`，基地 atlas 为 4 x 4；8 座基地的 `previewRef.index` 已在资源合同中核对。
- 裁图清单 / crop manifest：`src/games/smashup/__tests__/internationalIncidentResourceContract.test.ts` 核对 atlas 类型、网格尺寸、槽位连续性、唯一槽位和基地槽位。
- SHA256 / 图片合同表：`public/assets/i18n/zh-CN/smashup/assets-manifest.json` 与 `public/assets/i18n/assets-manifest.json` 登记同一批卡牌 / 基地图 PNG 与 WebP 哈希；资源合同测试当前 5 条通过。
- 本节同时记录运行时主资源的公开回查：卡牌 WebP、基地 WebP、`2833984701.json` 与 `pod-atlas-config.json` 均为 `200`、`x-asset-source: server`，且公网大小与 SHA-256 均匹配本地；两个游戏级 manifest 仍未闭合，详见本文件末尾的资源链复查。

## 2026-09-19 相扑手单派系回写

- 相扑手已按 12 张唯一卡 + 2 张基地完成单派系逐对象审计，详见 `evidence/smashup/2026-09-19-sumo-wrestlers-audit.md`。
- 本轮确认并修复 3 类真实问题：身体猛击自动取第一位玩家 / 第一来源基地 / 第一目的基地；关胁固定第一目的地且没有跳过入口；相扑新人有手牌时被迫弃牌。
- 修复后相扑手专属真实入口 E2E 已扩为 3 条并全部通过，覆盖相扑手 14/14 对象；相扑手相关领域 / 资源 / 共享反应测试为 57 条通过。
- 当时四派系共享 E2E 的 7 条失败集中在共享选秀虚拟列表定位、其它派系计分前 / 额外行动 / 附着链；它们不命中相扑手专属入口，也不被外推为相扑手规则失败。
- 相扑手规则与逐对象真实入口已闭合；后续火枪手、骑警和摔角手也已分别完成对象级回写，当前批次残余收窄为共享基线和远端 R2 / CDN 发布链。

### 同类扩审记录

- 搜索范围：相扑手 12 张唯一卡 + 2 张基地，以及国际事件共享移动、随从效果、弃牌触发、临时力量、基地 trigger queue、保护和真实交互响应链。
- 命中项：身体猛击、关胁、相扑新人；三类问题已修复并在新的相扑手 evidence 中逐项记录。
- 未命中项：其他相扑手对象未发现同形的自动取第一项、固定错误目的地或把可选动作强制执行问题；四派系共享失败未命中相扑手专属 E2E。
- 残余扩审范围：远端 R2 / CDN 公开地址、共享 targetType 基线和其它派系 E2E 历史失败仍需单独处理；相扑手 14 个对象已完成逐一真实入口覆盖，其它三派系随后也已完成各自对象级回写。

## 审计范围

- 相扑手：12 张唯一卡 + 2 张基地，含 `sumo_wrestlers_technique_prize`、`sumo_wrestlers_performance_prize`、`sumo_wrestlers_head_butt`、`sumo_wrestlers_bulking_stew`、`sumo_wrestlers_body_slam`、`sumo_wrestlers_chikara_mizu`、`sumo_wrestlers_grasp_the_belt`、`sumo_wrestlers_fighting_spirit_prize`、`sumo_wrestlers_yokozuna`、`sumo_wrestlers_third_tier`、`sumo_wrestlers_top_tier`、`sumo_wrestlers_rookie_sumo`、`base_heya_training_stable`、`base_the_dohyo`。
- 火枪手：14 张唯一卡 + 2 张基地，含 `musketeers_on_a_roll`、`musketeers_make_way`、`musketeers_en_garde`、`musketeers_biding_time`、`musketeers_to_battle`、`musketeers_one_for_all`、`musketeers_last_stand`、`musketeers_all_for_one`、`musketeers_token_of_affection`、`musketeers_porthos`、`musketeers_athos`、`musketeers_young_musketeer`、`musketeers_dartagnan`、`musketeers_aramis`、`base_bastion_saint_gervais`、`base_the_golden_lily`。
- 骑警：12 张唯一卡 + 2 张基地，含 `mounties_eh`、`mounties_bring_em_in`、`mounties_when_calls_the_badge`、`mounties_always_get_our_man`、`mounties_battle_moose`、`mounties_power_poutine`、`mounties_move_aboot`、`mounties_haich_q`、`mounties_mountie_major`、`mounties_northern_mover`、`mounties_war_canuck`、`mounties_dudlee`、`base_strategic_syrup_reserve`、`base_great_white_north_eh`。
- 摔角手：13 张唯一卡 + 2 张基地，含 `luchadors_quick_set_up`、`luchadors_smart_set_up`、`luchadors_reversal`、`luchadors_pin`、`luchadors_powerful_set_up`、`luchadors_tag_team`、`luchadors_out_for_the_count`、`luchadors_senor_muchoslam_vs_the_monsters`、`luchadors_cheap_pop`、`luchadors_yellow_demon`、`luchadors_senor_muchoslam`、`luchadors_capa_roja`、`luchadors_flor_loca`、`base_ringside`、`base_the_squared_circle`。基地主源以 data 文件和旧 59 行矩阵为准，重复复用基地仍按对象 ID 去重。
- 总范围：旧矩阵已建立 51 张卡牌 + 8 张基地的 59 行对象表；本文件回写四派系状态与当前证据，不重写旧矩阵历史内容。
- 不在本轮范围：远端 R2 / CDN 上传、其它扩展、非代表对象逐张移动端视觉验收。

## 结论等级

结论等级：`四派系本地对象级审计已收口，批次发布仍有残余`。

- 相扑手、火枪手、骑警、摔角手均已有独立 evidence，逐对象覆盖静态合同、实现消费、最终状态、真实入口或共享流程判等。
- 当前可复跑的国际事件领域与资源测试为 68/68；骑警专属真实入口为 16/16，摔角手新增真实入口为 5/5；相扑手和火枪手的专属 / 共享入口结果已分别写入各自 evidence。
- 仍有残余的是共享四派系回归基线的历史失败和远端资源公开链；本地规则审计不因这两类发布 / 基线问题回退为“未审计”。

## 2026-09-19 火枪手单派系回写

- 火枪手 14 张唯一卡牌 + 2 张基地已完成对象级静态、领域和共享流程审计，逐项 evidence 见 `evidence/smashup/2026-09-19-musketeers-audit.md`。
- 本轮补齐并通过圣热尔韦堡垒真实入口：`廉价欢呼` 后由玩家选择己方随从，`团队标记` 后由玩家选择打出基地；额外行动成功消费，interaction / triggerQueue 清空。
- 本轮修正火枪手 7 个静态 fallback 名称与中文 locale 漂移，补资源合同测试；`international-incident.test.ts` 53 条、资源合同 5 条通过。
- 火枪手本轮列出的 4 个对象级 direct E2E 缺口已补齐：Porthos、Athos、D'Artagnan 和黄金百合花回合结束抽牌均已通过真实入口；当前 evidence 仅保留共享基线与远端资源链残余。

## 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | `passed` | 旧矩阵 59 行、data 文件四派系数组和本文件四组对象清单一致。 |
| 真相源状态 | `passed` | 本地 TS、完整单卡主裁图、裁图清单、crop manifest、SHA256 / 图片合同表和 manifest 已对账；远端公开回查另列为批次外发布残余。 |
| 原子语义断言 | `passed_scoped` | 旧矩阵逐对象记录随从效果、行动、附着、额外额度、special、基地能力与负向边界。 |
| 实现消费链 | `passed` | `international_incident.ts`、共享 prompt / trigger / ongoing / base ability handler 已在旧矩阵和当前代码中对账。 |
| 最终权威结果 | `passed_scoped` | 领域测试和 E2E 回到力量指示物、临时力量、手牌、弃牌堆、附着、额外行动、VP、triggerQueue 与 interaction 清理。 |
| 交互真实入口 | `passed_scoped` | 四派系单独 evidence 已覆盖对象级真实入口或满足条件的共享流程判等；新增骑警 16/16、摔角手 5/5 真实入口复跑通过。 |
| 验证证据 | `passed_scoped` | 当前国际事件领域 / 资源测试 68/68 通过；各派系专属与共享真实入口结果分别记录在单派系 evidence。 |
| 共享影响与代表链依据 | `passed` | `sharedFlowId` 见下表，明确配置差异与失效影响面。 |
| 缺口分类与范围裁定 | `passed` | 剩余是共享验证债务和远端资源链残余，不把它们冒充为已定位的玩法根因。 |
| 旧 evidence / 旧结论对账回写 | `passed` | 旧 2026-07-15 矩阵顶部已追加 2026-09-18 当前回写。 |
| 残余范围声明 | `passed` | 明确四派系本地对象级规则范围已完成，同时不把共享验证债务或远端资源链写成发布已完成。 |

## 共享流程审计与代表链依据

| sharedFlowId | 代表对象 | 一致性核对 | 当前裁定 |
| --- | --- | --- | --- |
| `smashup-international-minion-effect` | 技术奖、炖肉、斗志奖 | 候选生成按目标控制者 / 基地 / 随从过滤；权限判断按当前玩家和合法目标校验；触发时机、payload、力量指示物 / 临时力量、抽牌和交互清理已核对。 | 数值、目标数量和是否抽牌属于允许配置差异；失效影响面为引用该流程的行动牌。 |
| `smashup-international-extra-action` | 一为全、全为一、阿拉密斯、快速 Set-Up、圣热尔维堡垒 | 候选生成按额度、限制随从 / 基地和直接影响对象过滤；权限判断由行动合法性与当前回合控制者校验；消费方式、回合生命周期和 triggerQueue 清理已核对。 | 额度数量、限制对象和来源 reason 属于允许配置差异；失效影响面为所有额外行动消费者。 |
| `smashup-international-response-window` | 逆转、最后一搏、Capa Roja、阿拉密斯 | 候选生成按当前计分基地、响应玩家和目标过滤；权限判断由 response session 与当前窗口控制者校验；玩家提交、最终 VP / 摧毁 / 控制和窗口清空已核对。 | 响应来源、目标过滤和奖励数值属于允许配置差异；失效影响面为所有计分前响应消费者。 |
| `smashup-international-base-ability` | 方形擂台、圣热尔维堡垒、擂台边 | 候选生成按触发基地、行动控制者、随从控制者和一次 / 回合限制过滤；权限判断由基地 trigger executor 与当前阶段校验；额外额度 / 抽牌 / 回收、计分后清理已核对。 | 基地 ID、奖励类型和一次性键属于允许配置差异；失效影响面为 8 座国际事件基地的共享触发链。 |

## 原子语义与实现消费

| 派系 | 原子语义 / 实现消费 | 最终权威结果 | 直接证据 | 缺口分类 | 状态 |
| --- | --- | --- | --- | --- | --- |
| 相扑手 | 横纲 / 关胁 / 大关 / 相扑新人持续力量与天赋；技术奖、炖肉、斗志奖等力量指示物 / 抽牌 / 多选；两个基地能力。 | 选择随从、力量指示物、临时力量、手牌与基地状态均有逐对象最终状态。 | `evidence/smashup/2026-09-19-sumo-wrestlers-audit.md`；专属 E2E 3 条通过，覆盖 14/14 对象。 | 本地对象级规则范围已闭合；远端资源公开回查仍是批次外残余。 | `当前范围已收口` |
| 火枪手 | 连连获胜、让路、预备姿势、等待时间、一为全、最后一搏、全为一、阿拉密斯等多步额外行动 / special / 附着链。 | 额外额度、目标选择、附着、计分前响应、回合末清理和 VP 结果均已逐项审计。 | `evidence/smashup/2026-09-19-musketeers-audit.md`；领域 62 条与对象级 direct E2E 回写。 | 本地对象级规则范围已闭合；共享基线与远端资源链另列。 | `当前范围已收口` |
| 骑警 | 嗯？、带进来、呼叫警徽、战斗麋鹿、Haich-Q 等响应、保护、移动与基地范围链。 | 14/14 对象逐项回查目标、保护、移动、响应窗口清理和力量结果；专属 E2E 16/16 复跑通过。 | `evidence/smashup/2026-09-20-mounties-audit.md`；领域测试与 16 条 direct E2E。 | 本地对象级规则范围已闭合；共享基线与远端资源链另列。 | `当前范围已收口` |
| 摔角手 | Quick / Smart Set-Up、逆转、压制、Powerful Set-Up、Tag Team、廉价欢呼、黄色恶魔、Muchoslam 先生、点名出局、Capa Roja、Flor Loca 等附着 / special / 计分链。 | 15 个唯一对象均已回到手牌、棋盘、附着、力量徽章、额外行动、VP、摧毁、回收和 triggerQueue 清理；本轮新增五条 direct E2E 全部通过。 | `evidence/smashup/2026-09-21-luchadors-audit.md`；四派系 E2E 既有摔角手用例；`international-incident.test.ts` 62/62。 | 本地对象级规则范围已闭合；共享基线与远端资源链另列。 | `当前范围已收口` |

## 缺口分类与范围裁定

| 条目 | 分类 | 现实影响 | 最小补救 |
| --- | --- | --- | --- |
| 共享四派系 E2E 历史失败 | 共享验证债务 | 本轮主基线 `smashup-international-incident-four-factions.e2e.ts` 已复跑 24/24；其它全局 / 历史共享基线仍不由这一条命令覆盖，不能据此宣称共享审计全部关闭。 | 继续核对剩余共享基线；不回退四个单派系的对象级审计结论。 |
| 游戏级 manifest 远端发布 | 发布链阻塞 | 四个运行时主资源和两个 atlas JSON 已公开可达，但 `official/i18n/zh-CN/smashup/assets-manifest.json` 仍是旧版本，`official/smashup/assets-manifest.json` 当前为 404；不能把本地 manifest 已生成解释成线上资源索引已闭合。 | 具备有效发布授权后，只发布这两个 Smash Up manifest，再回查大小、SHA-256 和服务器来源头。 |
| 全局历史 audit property 基线 | 非本批次范围 | 旧 penguins / marvel_villains / skeletons 等失败会污染全局审计命令，但不直接证明国际事件对象失败。 | 另开共享审计基线修复，不在本批次降级国际事件对象实现。 |

## 验证证据

- `src/games/smashup/__tests__/abilities/international-incident.test.ts` + `internationalIncidentResourceContract.test.ts`：68 条通过。
- `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-mounties-audit.e2e.ts`：16 条通过。
- `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-luchadors-audit.e2e.ts`：5 条通过；相扑手和火枪手的既有专属 / 共享 E2E 结果见对应 evidence。
- `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts`：24 条通过；其中逆转按真实顺序完成两段后续强制反应，最终回到 `playCards`，interaction、resolution frame 与 triggerQueue 清空。
- `npx vitest run src/games/smashup/__tests__/abilities/international-incident.test.ts src/games/smashup/__tests__/internationalIncidentResourceContract.test.ts`：68 条通过。
- 旧矩阵继续承担对象 atom 和共享流程历史底稿；当前完成判断以四份单派系 evidence 加本回写为准，不把旧的 14 条样本统计继续当作当前全量状态。

## 修订或失效记录

- 旧矩阵中“L3/L4 只有代表链通过”的历史结论不再代表当前四派系状态；四份单派系 evidence 已逐步补齐对象级 direct E2E 或共享流程判等依据。
- 本轮仍保留四派系批次 `in_progress`，但原因已收窄为共享验证债务和 R2 / CDN 公开资源链，不再是四派系对象规则尚未审计。
- 2026-09-21：旧的“逆转用例在摧毁 Set-Up 行动后卡在计分阶段”结论已失效。真实状态诊断显示夺控、两张己方 Set-Up 入弃牌堆和目标控制权转移均已完成；阻塞来自测试遗漏了夺控后连续出现的 `smashup_reaction_choose` 强制反应。补齐 `base_ringside` 与 `musketeers_all_for_one` 两段玩家选择后，主基线 24/24 通过；未修改生产规则实现。

## 残余范围声明

本文件完成国际事件四派系当前范围、共享流程、最终状态与资源 / 证据缺口的审计分流；四派系本地对象级规则范围已收口，但批次仍保留 `in_progress`，直到共享验证债务和资源发布链分别完成。

## 2026-09-21 资源链复查

- 只读查询服务器对象清单返回 13,276 个 `official` 对象；Smash Up 本批次的四个运行时主资源和两个 atlas 配置均已存在且与本地一致：
  - `official/i18n/zh-CN/smashup/cards/compressed/international_incident.webp`：969,464 bytes，SHA-256 `c106174d...0ce685`，公网 `200`，`x-asset-source: server`。
  - `official/i18n/zh-CN/smashup/base/compressed/international_incident_bases.webp`：560,560 bytes，SHA-256 `d39752ae...921931`，公网 `200`，`x-asset-source: server`。
  - `official/atlas-configs/smashup/2833984701.json`：9,653,431 bytes，SHA-256 `97065235...889d49`，公网 `200`，`x-asset-source: server`。
  - `official/atlas-configs/smashup/pod-atlas-config.json`：4,137 bytes，SHA-256 `00162dd0...4a07a5`，公网 `200`，`x-asset-source: server`。
- `official/i18n/zh-CN/smashup/assets-manifest.json` 线上仍为 47,803 bytes / SHA-256 `172312e8...0a2b6`，本地为 48,138 bytes / SHA-256 `1b12331f...5394e`；这是线上索引落后，不是运行时主图缺失。
- `official/smashup/assets-manifest.json` 当前公网 `404`，服务器对象清单中也不存在；本地文件 `public/assets/smashup/assets-manifest.json` 已生成，但尚未进入服务器活动根。
- 本次没有执行上传。当前剩余动作是一次明确的资源发布授权：仅发布上述两个 Smash Up 游戏级 manifest，随后回查服务器清单、公开 URL、大小、SHA-256 与 `x-asset-source: server`；在此之前批次继续保持 `in_progress`。

## 2026-09-21 多语言标题修复

- AST 扫描确认国际事件共有 33 个 `createAbilityRuntimeSimpleChoice` 入口；其中 6 个共享 prompt 原先把中文标题通过 `context.title` 直存，未写入 `titleKey`，会导致英文或其他语言继续显示中文。
- 修复范围仅限 `src/games/smashup/abilities/international_incident.ts` 与中英文 Smash Up locale：6 个共享上下文改为传递 `titleKey`，补齐 19 个国际事件标题 key；不改变候选、权限、事件、力量、抽牌、移动或 triggerQueue 结算。
- 中文 locale 初次检查发现“黄色恶魔”标题残留 `Set-Up` 英文术语，已改为“布置行动”；最终 `npm run i18n:check` 无缺失 key 或新警告。
- 本轮验证：国际事件领域与资源合同测试 68/68 通过；`npx tsc --noEmit --pretty false --incremental false` 通过；AST 复查确认 33 个选择入口全部带 `titleKey`，46 个引用的 `ui.*` 标题 key 均存在于 zh-CN / en locale。

## 骑警单派系回写

- 骑警范围为 12 张唯一卡 + 2 张基地；单派系 evidence 已覆盖 14/14 对象，并复跑专属真实入口 16/16 通过。
- 已确认并修复三个真实问题：多个合法组合被自动取第一项；行动牌因抽牌阶段重洗导致回合末触发丢失；“嗯？”在第二张行动后错误暴露 special。
- 修复后，玩家选择、回合末标记来源、第一张行动时机、跨基地移动和力量结果均回到服务器权威状态；截图与生命周期证据见 `evidence/smashup/2026-09-20-mounties-audit.md`。
- 骑警本地规则审计当前范围已收口；R2 / CDN 和共享基线仍归批次残余。

## 摔角手单派系回写

- 摔角手范围为 13 张唯一卡 + 2 张基地；单派系 evidence 已覆盖 15/15 对象。
- 本轮新增的 5 条独立 direct E2E 全部通过：黄色恶魔、Muchoslam 先生、点名出局、强力 Set-Up、Flor Loca；完整结果见 `evidence/smashup/2026-09-21-luchadors-audit.md`。
- 领域回归为 62/62；新增入口均回查手牌 / 弃牌堆、附着、力量、摧毁 / 回收、interaction 和 triggerQueue 清理。
- 摔角手本地规则审计当前范围已收口；R2 / CDN 和共享基线仍归批次残余。

## 2026-09-21 共享主基线回归补充

- 原始失败：逆转选择摧毁两张己方 Set-Up 行动后，测试等待“无交互”超时并把阶段仍在 `scoreBases` 误认为生产规则卡死。
- 真实状态：`reversal-target` 已转为 0 号玩家控制，`rev-quick` / `rev-smart` 已进入 0 号玩家弃牌堆；未完成的是夺控后由 `base_ringside` 和敌方 `musketeers_all_for_one` 触发的连续强制反应选择。
- 修复范围：仅修改 `e2e/smashup/smashup-international-incident-four-factions.e2e.ts`，补齐两段 `smashup_reaction_choose` 的真实候选选择；生产实现 `src/games/smashup/abilities/international_incident.ts` 本轮未改动。
- 当前证据：完整四派系真实入口 24/24 通过；规则与资源合同测试 68/68 通过。该结果关闭本条主基线的测试缺口，不关闭其它全局历史基线或 R2 / CDN 发布链。

## 2026-10-23 续审：共享验证基线时效

- 国际事件四派系本地 59 对象规则审计结论仍由四份派系 evidence 支持；本轮没有发现国际事件对象的规则失败证据。
- 上一条四派系 E2E 的 24/24 记录来自 2026-09-21；但 `e2e/smashup/smashup-international-incident-four-factions.e2e.ts` 与 `src/games/smashup/abilities/international_incident.ts` 均在 2026-09-22 提交 `833d79ba8` 大幅更新，因此旧 24/24 不能作为当前提交的复验结果。当前入口文件有 24 个测试，待复跑。
- 对响应事务的生命周期补证据如下；该表对齐当前 `e2e/smashup/smashup-international-incident-four-factions.e2e.ts` 的“逆转”对象链。当前文件有代码断言，但本次资源门禁阻止复跑。

| 生命周期节点 | 直接证据 / 当前结论 |
| --- | --- |
| 窗口打开前（precommit） | 玩家提交“逆转”并选择 `rev-quick`、`rev-smart`；目标 `reversal-target` 已转为己方控制，两张 Set-Up 已离开附着区。上一份回归记录确认当时仍处于 `scoreBases`，这些前置效果已提交，尚有后续响应待处理。 |
| 窗口内追加（append） | 玩家依次选择 `base_ringside` 与对方 `musketeers_all_for_one` 的强制反应；不能在第一个反应后把仍在计分阶段误认成规则卡死。 |
| 同一事务累计投影 | 当前 E2E 没有在每次 append 后单独断言累计等待事务 / `ResolutionFrame` 字段；现有证据只能定位到先夺控 / 摧毁，再追加两段响应。此项仍是事务投影证据缺口，不能记为已直接验证。 |
| 窗口关闭后（closeout） | 当前测试最终断言 P0 得 4 VP、P1 为 0、两张己方 Set-Up 均在弃牌堆、棋盘上无这两张附着行动、response window / triggerQueue / interaction source 均清空；这证明最终权威结果和交互清理，不替代上一行的中间投影断言。 |

- 2026-10-23 实际运行共享 `interactionTargetTypeAudit`（完整命令及两条失败详情见 `2026-09-18-munchkin-faction-audit.md`）为 12/14。失败是全局 response chooser 静态合同片段缺失，以及 `base_uss_undertaking` / 三个 goblins sourceId 的 targetType 歧义；失败报告没有 `international_incident` 对象或文件。这是共享静态审计债务，不构成国际事件规则失败证据。
- `2026-09-21 资源链复查`里的两个 manifest URL、哈希和 404 状态是当时快照，本轮没有重新查询，也没有上传。当前只能记为“公开资源状态待只读复查”，不能把旧快照当作现状。
- 本轮 `e2e-doctor` 看到另一条 Fate of Dominion E2E 正在运行，CPU 100%、可用内存 0.46GB，且 `e2e-single.frontend` 6174 端口占用；因此没有并发启动国际事件 E2E。最小补救是运行资源释放后重跑当前四派系 24 项入口，再分别只读回查两个 manifest；发布动作仍不在本轮范围。
- 当前裁定：四派系本地对象规则审计保持已收口；批次整体仍 `in_progress`，因为 2026-09-22 源码 / E2E 更新后的共享入口基线尚未复验，公开 manifest 状态也已过时。

## 2026-10-23 四派系 E2E 当前源复跑

- 资源门禁曾显示允许启动，但另一条 Fate of Dominion E2E 同时在跑。国际事件测试使用独立 runtime（frontend 6275、gameServer 20102、apiServer 21102），启动后 `e2e-memory-watchdog` 因可用内存持续降到 0.62% 而终止 Playwright 进程树。
- Playwright 输出到 `Running 24 tests using 1 worker` 后被 watchdog 中止；没有任何用例完成结果，因此本次不计为通过，也不能据此判定规则失败。准确状态是“当前源复跑被资源 watchdog 中止，0/24 已报告完成”。
- `e2e-doctor` 随后仍看到另一条 Fate E2E 活跃、CPU 92%、可用内存约 1.9GB；不清理也不打断该任务。最小补救是该任务释放后重跑同一 24 项当前基线，再只读复查两个已过期 manifest。此前 9/21 的 24/24 仍仅作历史结果。
- 本次预检增量生成 manifest；`public/assets/i18n/assets-manifest.json` 原本已是 dirty 文件，保留其当前状态；另外两个 manifest 未产生工作树改动。
- 当前裁定更新：四派系本地对象规则审计保持已收口；共享入口基线仍待当前源 24 项跑完，公开 manifest 状态仍待只读复查，批次保持 `in_progress`。

## 2026-10-23 公网 manifest 只读刷新

- 真正线上资源根来自当前 `src/core/AssetLoader.ts`：`https://assets.easyboardgame.top/official`。本次只读 HEAD / GET，没有上传或修改外部资源。
- `official/i18n/zh-CN/smashup/assets-manifest.json` 返回 `200`、`X-Asset-Source: server`；线上为 47,803 bytes，SHA-256 `172312e8267ea7a921e9ebca93354186ef704003f096459443fb43008ea0a2b6`。当前本地 `public/assets/i18n/zh-CN/smashup/assets-manifest.json` 为 48,633 bytes，SHA-256 `869c99fcf3fe82bd85b68a5ce38044a31676164f3178502ca16383b41679576a`，与线上不一致，线上仍是旧索引。
- `official/smashup/assets-manifest.json` 返回 `404`（响应头带 `X-Asset-Source: server` 只说明由服务器响应，不能把 404 记作资源存在）。当前本地 `public/assets/smashup/assets-manifest.json` 存在，913 bytes，SHA-256 `169d3f289ca26f7d03ce27dab2d3b5930dff0873d6fa64d9d27e1fa9f2102e51`。
- 资源链审计因此仍未闭合：一份线上 manifest 陈旧，另一份线上缺失。需要资源发布操作后再次只读核对状态、大小、SHA-256 和服务器来源；本轮没有发布授权，也没有执行上传。
- 当前裁定：本地 59 个对象规则审计仍已收口；当前源四派系 E2E 被 memory watchdog 中止，0/24 已报告完成；公网资源链已确认两项未闭合。批次保持 `in_progress`。

## 2026-10-23 第二次四派系 E2E 复跑尝试

- 本次从 `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts` 入口启动。启动前 `e2e-doctor` 显示无活跃 runtime；runner 随后检测到并发 Fate of Dominion E2E 已启动，并自动为本测试分配隔离端口（frontend 6274、gameServer 20101、apiServer 21101）。
- 同一 Fate E2E 运行期间，可用内存连续三次降至 0.03%，`e2e-memory-watchdog` 终止本次 Playwright 进程树。输出停在 `Running 24 tests using 1 worker`，没有用例完成结果，记为 0/24；这不是规则失败，也不构成通过。
- 复查 `e2e-doctor` 仍报告 Fate E2E 活跃且 runtime `active-unhealthy`，故不再重试、不清理也不打断对方任务。最小补救是等该任务退出、资源恢复后，再跑同一 24 项当前源基线。
- 当前裁定：国际事件本地对象规则范围仍已收口；当前源共享入口基线仍因两次资源 watchdog 中止而待复验；公网 Smash Up i18n manifest 整体陈旧且游戏级 manifest URL 缺失。批次保持 `in_progress`，未执行上传。
