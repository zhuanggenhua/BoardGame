# 《环游世界：国际事件》四派系 intake 初始合同

## 状态

- 当前阶段：OpenSpec 提案已获批准，已进入运行时代码实施，并已完成代表性 L2 + 真实入口 L3/L4 验证。
- 录入合同状态：`in_progress`。atlas、槽位、实体数量、静态定义和本地资源链已接入；完整 59 对象规则子句表、effect atom 矩阵和对象级 L3/L4 全覆盖仍未收口。
- 机制状态：`in_progress`。已接入四派系静态数据、代表性 ability handler、持续力量修正与压制计分排除；真实入口已证明四派系代表链可结算到权威状态，但仍不是“全部卡牌/基地玩法完成”。
- 资源状态：`blocked:R2-env/CDN-404`。本地 PNG/WebP 与根级/游戏级 manifest 键已存在；定向上传曾在 R2 远程回查阶段返回 `401`，当前复核 `.env` 不存在、进程内无 R2 环境变量，两个代表 CDN URL 仍为 `404`。

## 真相源表

| 来源 | 负责字段 | 路径或定位 | SHA-256 | 状态 |
| --- | --- | --- | --- | --- |
| 用户提供卡牌 atlas | 中文卡面、卡名、类型、力量、中文效果、卡牌槽位 | `C:/Users/Dqm/Downloads/Smash Up! by Mervil (2833984701)-汉化版/Smash Up! by Mervil (2833984701)-汉化图/Mods/Images/httpssteamusercontentaakamaihdnetugc1013814147743915359FDEDF0FFA198E2214A624702AA00BF5C655A38E7.png` | `A04E696D6D3AB50A4FA5BDBC31C58C7385657E73CCBC36A3A7FDE6BA44D3CA55` | source-found |
| TTS 基地 atlas | 基地图面、基地槽位、基地中文效果待裁图核对 | `C:/Users/Dqm/Downloads/Smash Up! by Mervil (2833984701)-汉化版/Smash Up! by Mervil (2833984701)-汉化图/Mods/Images/httpssteamusercontentaakamaihdnetugc1013814147744231500252328AD5B44D4FBDE2EEBDAC57D135FB7750BC5.png` | `8D695587ADFC6FBCC64EB845D3F70D4A2CC3135B0B53F1F9A7B9E5EE4AD9B24E` | source-found |
| TTS Workshop JSON | kit 归属、CardID、实体重复数量、基地 canonical 英文名、CustomDeck 网格 | `C:/Users/Dqm/Downloads/Smash Up! by Mervil (2833984701)-汉化版/Smash Up! by Mervil (2833984701)-汉化图/Mods/Workshop/2833984701.json` | `9CB9EC26259D8BF85BFB6FA84F9B14A7D32A6E21AD075B8B6C62757BD24CFF1D` | source-found |

## Atlas 合同草案

| atlas | 尺寸 | 网格 | 使用范围 | 不注册槽位 |
| --- | ---: | --- | --- | --- |
| 卡牌 atlas | `3332 x 4096` | `8 x 7` | 槽位 `0-50` 为 51 个唯一手牌卡面 | 槽位 `51-54` 派系展示卡、槽位 `55` Smash Up 标识 |
| 基地 atlas | `4096 x 2914` | `4 x 4` | 本批次使用 CardID `6608-6615` 对应的 8 张基地 | 非本批次基地槽位 |

## 批次矩阵

| objectId | 中文名 | canonical 英文名 | 唯一卡面 | 实体牌 | 基地 | 数据录入 | 资源链 | 机制实现 | 审计 | E2E | 状态 |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- | --- |
| `sumo_wrestlers` | 相扑手 | Sumo Wrestlers | 12 | 20 | 2 | in_progress | in_progress | in_progress | in_progress | representative-passed | in_progress |
| `musketeers` | 火枪手 | Musketeers | 14 | 20 | 2 | in_progress | in_progress | in_progress | in_progress | representative-passed | in_progress |
| `mounties` | 骑警 | Mounties | 12 | 20 | 2 | in_progress | in_progress | in_progress | in_progress | representative-passed | in_progress |
| `luchadors` | 摔角手 | Luchadors | 13 | 20 | 2 | in_progress | in_progress | in_progress | in_progress | representative-passed | in_progress |

## 2026-07-14 运行时实施快照

### 已接入内容

- 本地资源：`public/assets/i18n/zh-CN/smashup/cards/international_incident.png`、`public/assets/i18n/zh-CN/smashup/cards/compressed/international_incident.webp`、`public/assets/i18n/zh-CN/smashup/base/international_incident_bases.png`、`public/assets/i18n/zh-CN/smashup/base/compressed/international_incident_bases.webp` 均存在。
- Manifest：`public/assets/i18n/zh-CN/smashup/assets-manifest.json` 与 `public/assets/i18n/assets-manifest.json` 均包含 `international_incident` / `international_incident_bases` 原图和压缩键。
- 静态注册：`ids.ts`、`atlasCatalog.ts`、`cards.ts`、`factionMeta.ts` 已出现四派系、`7 x 8` 卡牌 atlas、`4 x 4` 基地 atlas、51 张唯一卡面、80 张实体牌和 8 张基地。
- 玩法入口：`abilities/international_incident.ts` 已注册代表性相扑手、火枪手、骑警、摔角手能力；`abilities/index.ts` 已调用 `registerInternationalIncidentAbilities()`。
- 2026-07-14 扩展：新增相扑手 `头槌`、`炖肉`、`身体猛击`、`关胁`、`大关`、`相扑新人`，骑警 `总是抓住我们的人`，摔角手 `逆转`、`穆乔摔先生大战怪物`、`红披风（Capa Roja）` 的运行时入口或触发器；同时接入 8 张国际事件基地触发器。
- 2026-07-14 续跑补强：修正火枪手 `连连获胜` / `等待时机` 的所选随从限定字段，补齐骑警 `北方搬运者` 的“移动或加力”二选一分支，补强摔角手 `廉价欢呼` 在 Set-Up 基地的 +4 动态分支。
- 2026-07-14 续跑补强：相扑手 `力量满溢` 已补“可不弃牌 +2 / 弃 1 张牌改为 +4”分支；火枪手 `投入战斗！` 已通过 pending minion-play effect 将额外行动绑定到刚额外打出的随从；骑警 `战争骑警` 已改为持续到自己下个回合开始再回滚的持久力量修正。
- 2026-07-14 续跑补强：火枪手 `预备姿势` / `等待时机` 已补标准 `PLAY_ACTION.targetMinionUid` 消费合同；`投入战斗！` 后的额外行动可将 `预备姿势` 直接作用到刚额外打出的随从，并触发 `年轻的火枪手` 的同链路 +1；火枪手 `Athos`、`D'Artagnan`、`Aramis`、`年轻的火枪手` 的“行动直接影响随从”触发器已补代表性 L2 权威事件测试；`情谊信物` 已补从牌库/弃牌堆搜直接影响随从行动并授予额外行动的 L2 证据；摔角手 `黄色恶魔` 已补 Set-Up 搜牌候选过滤，`点名出局` 已补返还己方行动并消灭目标随从的 L2 证据。
- 2026-07-14 续跑补强：摔角手 `团队标记` 修正为多基地时先选择一个有己方随从的基地，再授予 `restrictToBase` 的额外随从额度；`穆乔摔先生大战怪物` 已补“回收一个可打在随从上的行动、其余行动洗入牌库”的 L2 权威状态；`聪明 Set-Up` 已补“宿主基地每回合第一次打出随从后为行动控制者抽牌 / 第二次不触发”证据；`红披风（Capa Roja）` 已补计分前按每位其他玩家消灭一个印制力量 3 或以下随从的自动触发路径；骑警 `力量肉汁薯条` 已补“至多两个”空选与双目标选择路径。
- 2026-07-14 续跑补强：国际事件基地 L2 覆盖扩展到 `训练馆`（回合开始弃牌 + 指示物）、`土俵`（首次打出随从后移动另一玩家随从）、`战略枫糖储备`（打出随从后把另一玩家随从移入）、`大白北方，嗯？`（计分前每位玩家移动并 +1）和 `擂台边`（直接影响另一玩家随从后抽牌）。至此 8 张基地均有至少一条 L2 自动路径证据，但可选/skip 与真实入口仍未补齐。
- 2026-07-14 续跑补强：相扑手 `表演奖` 已补抽 3 张牌，`斗志奖` 已补抽 2 张牌并把 2 个指示物集中给一个己方随从，`抓住腰带` 已补从有己方随从的基地移动一个随从；火枪手 `Porthos` 已补只防其他玩家行动、`最后一搏` 已补计分前 +2 并抽牌；骑警 `嗯？` 已补弃牌堆 special provider、命令激活、+1、回手与一次性消费，`带进来` 已补宿主移动后 +1 指示物，`Dudlee` / `挪过去` 已补只移动到有另一玩家随从的基地并加力，`北方搬运者` 已补 +1 分支。
- 2026-07-14 续跑补强：火枪手 `让路` 已补“移动一个己方随从 + 授予额外行动”L2 证据；骑警 `呼叫警徽` 已补 onPlay 与计分前 special 均给同基地己方随从放置指示物；摔角手 `快速 Set-Up` 已补 onPlay 额外行动授予，`廉价欢呼` 已补无 Set-Up +2 与 Set-Up 基地 +4 两条分支。
- 2026-07-14 续跑补强：摔角手 `逆转` 已补无合法 Set-Up 目标反馈与同一目标多张己方 Set-Up 行动全摧毁；骑警 `Haich-Q` 已补天赋把己方随从移入宿主基地或从宿主基地移出的 prompt 链；火枪手 `全为一` 已补“另一张直接影响宿主的行动后 +1、标记、回合末摧毁自身”持续触发。
- 2026-07-14 续跑补强：`情谊信物` 已补合法候选存在时跳过、牌库候选入手、剩余牌库重排、弃牌堆单候选仍走 prompt、无候选反馈；`黄色恶魔` 已补 Set-Up 搜牌 prompt / 跳过 / 弃牌堆回收 / 无候选反馈；`红披风（Capa Roja）` 已从自动消灭改为计分前可选多选 prompt，可跳过，且每位其他玩家至多选一个印制力量 3 或以下随从；`快速 Set-Up` 已补真实附着到另一玩家随从、忽略附着、再消费额外行动附着另一张行动；`训练馆`、`土俵`、`战略枫糖储备`、`大白北方，嗯？` 均已补合法候选存在时的 skip 与选择路径；`Aramis` 已补强制反应选择后的 immediate restricted extra action 真实消费，`一为全` 已补多基地候选只强化所选基地己方随从并授予额外行动。
- 2026-07-15 续跑补强：`炖肉` 已从自动弃牌改为任意数量手牌 prompt，并补合法候选存在时空选；`斗志奖` 已补 2 个指示物分给 2 个随从；`逆转` 已补摧毁 0-N 张己方 Set-Up 行动的 prompt、空选仍夺控与多选摧毁路径；`穆乔摔先生大战怪物` 已补弃牌堆任意数量行动选择与空选路径。
- 持续修正：`mounties_haich_q`、`mounties_mountie_major`、`luchadors_powerful_set_up`、`luchadors_flor_loca` 已接入持续力量计算；`luchadors_pin` 已排除目标随从的基地计分力量贡献。
- 注册缺口复核：非基地对象未注册清单已收敛为 `mounties_mountie_major`、`luchadors_powerful_set_up`、`luchadors_flor_loca`，三者当前均由持续力量修正链消费；8 张基地均已有触发注册。
- 2026-07-14 代表性真实入口补证：新增 `e2e/smashup/smashup-international-incident-four-factions.e2e.ts`，覆盖四派系真实选秀进入牌桌，以及相扑手 `技术奖`、火枪手 `一为全`、骑警 `嗯？` 弃牌堆 special、摔角手 `快速 Set-Up` / `聪明 Set-Up` 从真实手牌或弃牌堆入口结算到权威状态。
- 2026-07-15 代表性真实入口补证：同一 E2E 文件新增覆盖骑警 `呼叫警徽` 的计分前 Me First 响应窗口真实打出、基地选择与 +1 指示物落地，以及摔角手 `压制` 从真实手牌附着到另一玩家随从后，在真实计分选择中排除目标力量贡献并产生 `4 / 2` VP 结果。
- 2026-07-15 代表性真实入口补证：同一 E2E 文件新增覆盖相扑手 `炖肉` 从真实手牌入口打出后的任意数量手牌 prompt；空选后手牌与指示物不变，多选 2 张手牌后进入目标随从 prompt，并给相扑新人放置 +2 指示物。
- 2026-07-15 代表性真实入口补证：同一 E2E 文件新增覆盖相扑手 `斗志奖` 从真实手牌入口打出后抽 2 张牌，并把 2 个 +1 力量指示物分配给两个己方随从；敌方随从未被误加。
- 2026-07-15 代表性真实入口补证：同一 E2E 文件新增覆盖摔角手 `穆乔摔先生大战怪物` 从真实手牌入口打出后的任意数量弃牌堆行动 prompt；空选后弃牌堆原行动与牌库不变，多选 `压制` + `团队标记` 后，`压制` 回手、`团队标记` 洗回牌库。
- 2026-07-15 代表性真实入口补证：同一 E2E 文件新增覆盖摔角手 `逆转` 从真实计分前窗口打出；目标基地上玩家 0 未领先，另一玩家随从带 2 张己方 Set-Up 与 1 张对手行动，结算后玩家 0 夺控目标、摧毁所选 2 张己方 Set-Up，并通过擂台边计分获得 4 VP。
- 2026-07-15 代表性真实入口补证：同一 E2E 文件新增覆盖火枪手 `最后一搏` 从真实结束回合进入计分前 Me First 窗口后打出；己方年轻的火枪手在土俵反超计分，玩家 0 获得 3 VP，并抽到 `预备姿势`。
- 2026-07-15 代表性真实入口补证：同一 E2E 文件新增覆盖摔角手 `红披风（Capa Roja）` 从真实结束回合进入计分前 Me First 窗口后触发；选择并摧毁另一玩家印制力量 3 的年轻的火枪手，玩家 0 在擂台边获得 4 VP，响应窗与交互态清空。
- 2026-07-15 代表性真实入口补证：同一 E2E 文件新增覆盖火枪手 `阿拉密斯` 从真实手牌入口被 `预备姿势` 直接影响后出现反应窗口；选择阿拉密斯反应获得限定额外行动，并消费 `等待时机` 继续影响阿拉密斯本人，关键行动进入弃牌堆且交互态清空。
- 2026-07-15 代表性真实入口补证：同一 E2E 文件新增覆盖火枪手 `全为一` 从真实手牌入口附着到随从，触发宿主加力，并在回合结束自动脱离进入弃牌堆。
- 2026-07-15 代表性真实入口补证：同一 E2E 文件新增覆盖基地 `方形擂台` 从真实手牌入口打出随从后触发；弃牌堆唯一行动 `压制` 回到手牌，弃牌堆清空，触发队列与交互态清空。
- 2026-07-15 代表性真实入口补证：同一 E2E 文件新增覆盖基地 `圣热尔韦堡垒` 从真实手牌行动入口触发；`廉价欢呼` 直接影响该基地己方疯狂之花后授予额外行动，并成功消费该额度打出 `团队标记`，触发队列与交互态清空。
- 2026-07-15 代表性真实入口补证：同一 E2E 文件新增覆盖基地 `擂台边` 从真实手牌行动入口触发；`压制` 附着到这里另一玩家带己方 Set-Up 行动的达达尼昂后，玩家 0 抽到牌库顶 `团队标记`，牌库清空，触发队列与交互态清空。

### 定向验证

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| `npx eslint src/games/smashup/abilities/international_incident.ts src/games/smashup/data/factions/international_incident.ts src/games/smashup/__tests__/abilities/international-incident.test.ts src/games/smashup/domain/abilityHelpers.ts` | passed | 国际事件能力、静态标签、共享额外行动 helper 和新增 L2 测试 lint 通过 |
| `npx eslint src/games/smashup/__tests__/abilities/international-incident.test.ts src/games/smashup/abilities/international_incident.ts src/games/smashup/abilities/index.ts src/games/smashup/abilities/ongoing_modifiers.ts src/games/smashup/domain/ongoingModifiers.ts` | passed | 新增能力、注册、持续修正和测试文件 lint 通过 |
| `npx eslint src/games/smashup/abilities/international_incident.ts src/games/smashup/__tests__/abilities/international-incident.test.ts` | passed | 团队标记基地选择 prompt、力量肉汁薯条 `multiMin=0` 和新增 28 条 L2 测试 lint 通过 |
| `npx vitest run src/games/smashup/__tests__/abilities/international-incident.test.ts` | passed | 1 个文件、23 个测试通过；新增覆盖相扑手 `力量满溢` +2/+4 分支、火枪手 `投入战斗！` 绑定额外行动、`投入战斗！` → `预备姿势` 的目标随从消费合同、火枪手随从直接影响触发器、情谊信物搜牌/额外行动、摔角手黄色恶魔搜牌/点名出局、火枪手额外行动限定、骑警延迟摧毁/北方搬运者/战争骑警持久力量、摔角手临时控制/廉价欢呼动态分支与基地触发 |
| `npx vitest run src/games/smashup/__tests__/abilities/international-incident.test.ts` | passed | 1 个文件、28 个测试通过；在既有 23 条基础上补强摔角手 `团队标记` 基地限定额外随从、`穆乔摔先生大战怪物` 回收/洗回牌库、`聪明 Set-Up` 首次打出随从抽牌与第二次拒绝、`Capa Roja` 计分前消灭路径，以及骑警 `力量肉汁薯条` 合法候选存在时空选/双选路径 |
| `npx vitest run src/games/smashup/__tests__/abilities/international-incident.test.ts` | passed | 1 个文件、29 个测试通过；新增覆盖 5 张剩余基地的 L2 自动路径：`训练馆`、`土俵`、`战略枫糖储备`、`大白北方，嗯？`、`擂台边` |
| `npx vitest run src/games/smashup/__tests__/abilities/international-incident.test.ts src/games/smashup/__tests__/internationalIncidentResourceContract.test.ts src/games/smashup/__tests__/criticalImageResolver.test.ts src/games/smashup/__tests__/zhongguoFactionIntake.test.ts` | passed | 4 个文件、45 个测试通过，覆盖静态合同、资源合同、关键图片预加载和代表性 L2 玩法 |
| `npx vitest run src/games/smashup/__tests__/abilities/international-incident.test.ts src/games/smashup/__tests__/abilities/marvel.test.ts src/games/smashup/__tests__/abilities/frankenstein.test.ts src/games/smashup/__tests__/internationalIncidentResourceContract.test.ts` | passed | 4 个文件、68 个测试通过，覆盖国际事件新增目标消费合同、火枪手直接影响触发器、情谊信物搜牌链和摔角手 Set-Up/消灭链，并回归共享额外行动 helper 影响到的 Marvel / Frankenstein 代表链 |
| `npx vitest run src/games/smashup/__tests__/abilities/international-incident.test.ts src/games/smashup/__tests__/internationalIncidentResourceContract.test.ts src/games/smashup/__tests__/abilities/marvel.test.ts src/games/smashup/__tests__/abilities/frankenstein.test.ts` | passed | 4 个文件、73 个测试通过；包含国际事件 28 条 L2 测试与 Marvel / Frankenstein 共享 helper 回归 |
| `npx vitest run src/games/smashup/__tests__/abilities/international-incident.test.ts src/games/smashup/__tests__/internationalIncidentResourceContract.test.ts src/games/smashup/__tests__/abilities/marvel.test.ts src/games/smashup/__tests__/abilities/frankenstein.test.ts` | passed | 4 个文件、74 个测试通过；包含国际事件 29 条 L2 测试与 Marvel / Frankenstein 共享 helper 回归 |
| `npx vitest run src/games/smashup/__tests__/abilities/international-incident.test.ts --reporter=dot` | passed | 1 个文件、33 个测试通过；新增覆盖 `表演奖`、`斗志奖`、`抓住腰带`、`Porthos`、`最后一搏`、`嗯？`、`带进来`、`Dudlee`、`挪过去` 和 `北方搬运者` +1 分支 |
| `npx vitest run src/games/smashup/__tests__/abilities/international-incident.test.ts src/games/smashup/__tests__/internationalIncidentResourceContract.test.ts src/games/smashup/__tests__/abilities/marvel.test.ts src/games/smashup/__tests__/abilities/frankenstein.test.ts --reporter=dot` | passed | 4 个文件、78 个测试通过；国际事件新增 L2 用例与资源合同、Marvel / Frankenstein 共享 helper 回归均通过 |
| `npx eslint src/games/smashup/abilities/international_incident.ts src/games/smashup/__tests__/abilities/international-incident.test.ts` | passed | 骑警合法目的地过滤与 33 条国际事件 L2 测试 lint 通过 |
| `npx vitest run src/games/smashup/__tests__/abilities/international-incident.test.ts --reporter=dot` | passed | 1 个文件、35 个测试通过；新增覆盖 `呼叫警徽` onPlay/special、`快速 Set-Up` onPlay、`让路` 移动 + 额外行动和 `廉价欢呼` +2/+4 分支 |
| `npx vitest run src/games/smashup/__tests__/abilities/international-incident.test.ts src/games/smashup/__tests__/internationalIncidentResourceContract.test.ts src/games/smashup/__tests__/abilities/marvel.test.ts src/games/smashup/__tests__/abilities/frankenstein.test.ts --reporter=dot` | passed | 4 个文件、80 个测试通过；国际事件 35 条 L2 用例、资源合同与 Marvel / Frankenstein 共享 helper 回归均通过 |
| `npx eslint src/games/smashup/abilities/international_incident.ts src/games/smashup/__tests__/abilities/international-incident.test.ts` | passed | 国际事件能力与 35 条 L2 测试 lint 通过 |
| `npx vitest run src/games/smashup/__tests__/abilities/international-incident.test.ts --reporter=dot` | passed | 1 个文件、38 个测试通过；新增覆盖 `逆转` 空/多行动分支、`Haich-Q` 移入/移出和 `全为一` 持续触发/回合末销毁 |
| `npx vitest run src/games/smashup/__tests__/abilities/international-incident.test.ts src/games/smashup/__tests__/internationalIncidentResourceContract.test.ts src/games/smashup/__tests__/abilities/marvel.test.ts src/games/smashup/__tests__/abilities/frankenstein.test.ts --reporter=dot` | passed | 4 个文件、83 个测试通过；国际事件 38 条 L2 用例、资源合同与 Marvel / Frankenstein 共享 helper 回归均通过 |
| `npx eslint src/games/smashup/abilities/international_incident.ts src/games/smashup/__tests__/abilities/international-incident.test.ts` | passed | 国际事件能力与 38 条 L2 测试 lint 通过 |
| `npx vitest run src/games/smashup/__tests__/abilities/international-incident.test.ts --reporter=dot` | passed | 1 个文件、41 个测试通过；新增覆盖 `Capa Roja` 可选/跳过、`快速 Set-Up` 真实附着消费、`情谊信物` / `黄色恶魔` 搜牌跳过与空候选、四张可选基地、`Aramis` immediate restricted extra action 真实消费、`一为全` 多基地选择 |
| `npx vitest run src/games/smashup/__tests__/internationalIncidentResourceContract.test.ts --reporter=dot` | passed | 1 个文件、4 个资源合同测试通过 |
| `npx eslint src/games/smashup/abilities/international_incident.ts src/games/smashup/__tests__/abilities/international-incident.test.ts` | passed | 国际事件能力与 41 条 L2 测试 lint 通过 |
| `npx eslint e2e/smashup/smashup-international-incident-four-factions.e2e.ts` | passed | 国际事件四派系代表性真实入口 E2E lint 通过 |
| `npx tsc --noEmit --pretty false` | passed | 全局 TypeScript 类型检查通过 |
| `npm run i18n:check` | passed | i18n key 完整性检查通过，无 missing keys |
| `openspec validate add-smashup-international-incident-factions --strict --no-interactive` | passed | OpenSpec change 严格校验通过 |
| `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts` | passed | 2 个 Playwright 用例通过：真实选秀开局 + 四派系代表能力真实入口结算 |
| `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts "计分前 special 与压制可从真实入口影响最终权威状态"` | passed | 1 个 Playwright 用例通过：`呼叫警徽` 计分前响应窗口与 `压制` 真实附着 / 计分排除链 |
| `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts` | passed | 6 个 Playwright 用例通过：真实选秀开局、四派系代表能力、`炖肉` 空选/多选真实入口、`斗志奖` 抽牌与分配指示物、计分前 special 与 `压制` 计分排除、`穆乔摔先生大战怪物` 空选/多选弃牌堆行动 |
| `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts "逆转可从真实计分前窗口夺控并摧毁己方 Set-Up 行动"` | passed | 1 个 Playwright 用例通过：`逆转` 真实计分前窗口、任意数量 Set-Up 多选摧毁、夺控后擂台边 4 VP 与响应窗收口 |
| `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts "最后一搏可从真实计分前窗口反超计分并抽牌"` | passed | 1 个 Playwright 用例通过：`最后一搏` 真实计分前窗口、己方年轻的火枪手反超拿土俵 3 VP、抽到 `预备姿势`，且响应窗 / interaction / triggerQueue 收口 |
| `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts` | passed | 8 个 Playwright 用例通过：保留前 7 条代表链，并新增 `最后一搏` 真实计分前窗口反超计分 + 抽牌链 |
| `npx vitest run src/games/smashup/__tests__/abilities/international-incident.test.ts --reporter=dot` | passed | 1 个文件、42 条国际事件行为测试通过；新增 `擂台边` 识别 `压制` 真实附着事件并抽牌的 L2 回归 |
| `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts "擂台边可从真实行动影响另一玩家随从入口抽牌"` | passed | 1 个 Playwright 用例通过：`压制` 真实附着到另一玩家带己方 Set-Up 行动的达达尼昂后触发 `擂台边` 抽牌，interaction / triggerQueue 收口 |
| `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts` | passed | 14 个 Playwright 用例通过；复核截图显示 `聪明 Set-Up` 附着后由 `擂台边` 抽到 `团队标记` 与 `廉价欢呼`、`全为一` 真实附着并获得额外行动、`擂台边` 识别 `压制` 附着后抽到 `团队标记` |
| `npm run assets:validate` | passed | incremental manifest 校验通过，覆盖根级与 Smash Up 游戏级 manifest；发布门禁仍以 R2 上传和 CDN `HEAD 200` 为准 |
| `.gitignore` 资源入仓例外复核 | passed | 已新增 `international_incident.png`、`international_incident.webp`、`international_incident_bases.png`、`international_incident_bases.webp` 四个窄例外；`git status --short` 已能看到四个资源文件，满足“随 PR 入仓”路径的本地前置 |
| `node scripts/assets/upload-to-r2.js --only official/i18n/zh-CN/smashup/cards/compressed/international_incident.webp official/i18n/zh-CN/smashup/base/compressed/international_incident_bases.webp --selection-plan` | passed | 精确上传预演仅包含本批次 2 个压缩 WebP 对象 |
| `node scripts/assets/upload-to-r2.js --only official/i18n/zh-CN/smashup/cards/compressed/international_incident.webp official/i18n/zh-CN/smashup/base/compressed/international_incident_bases.webp --skip-android-package-publish` | blocked | R2 远程对象回查阶段返回 `401`；当前环境只从 `.env.example` 注入凭据 |
| CDN `HEAD`：`official/i18n/zh-CN/smashup/cards/compressed/international_incident.webp` / `official/i18n/zh-CN/smashup/base/compressed/international_incident_bases.webp` | blocked | 两个代表 URL 当前均返回 `404`，尚未达到远端资源门禁 |
| `.env` / R2 环境变量 / CDN `HEAD` 复核 | blocked | 当前 `.env` 不存在、`.env.example` 存在、进程内无 R2 相关环境变量；两个代表 CDN URL 仍为 `404` |
| `npm run assets:check` | blocked | R2 远程文件列表获取返回 `401 Unauthorized`；仍是凭据/环境 blocker，不是本地合同失败 |

## 59 对象 L0-L4 矩阵草案（2026-07-14 21:10）

> 口径：`L1` 表示静态数据 / locale / atlas / 注册结构已接入；`L2 passed/partial` 仅代表当前定向行为测试已覆盖的子句，不能外推为对象级完成；`representative-passed` 仅代表本轮首条真实入口链已补，不等于 59 对象 L3/L4 全覆盖。

| objectId | 中文名 | 类型 | 当前 L2 证据 | L3/L4 | 残余 |
| --- | --- | --- | --- | --- | --- |
| `sumo_wrestlers_technique_prize` | 技术奖 | 行动 | passed：唯一己方随从 +3 指示物 | representative-passed：真实手牌入口选择己方随从并结算 +3 指示物 | 多目标选择路径待补 |
| `sumo_wrestlers_yokozuna` | 横纲 | 随从 | partial：保护己方随从不被其他玩家移动已测 | pending | 天赋 / 自身其它子句待矩阵化 |
| `sumo_wrestlers_performance_prize` | 表演奖 | 行动 | passed：抽 3 张牌 | pending | 真实入口待补 |
| `sumo_wrestlers_head_butt` | 头槌 | 行动 | passed：移除其他玩家行动并入弃牌堆 | pending | 目标选择路径待补 |
| `sumo_wrestlers_bulking_stew` | 炖肉 | 行动 | passed：合法候选存在时可空选；选择 2 张手牌后给所选己方随从 +2 指示物 | representative-passed：真实手牌入口空选后手牌/指示物不变，多选 2 张后目标随从 +2 | 其它真实入口边界待扩展 |
| `sumo_wrestlers_body_slam` | 身体猛击 | 行动 | partial：移动同基地另一玩家随从已测 | pending | 多玩家/目标基地选择待补 |
| `sumo_wrestlers_chikara_mizu` | 力量满溢 | 行动 | passed：不弃牌 +2、弃 1 张牌 +4 | pending | 真实入口分支截图待补 |
| `sumo_wrestlers_third_tier` | 关胁 | 随从 | partial：移动低力量其他玩家随从并抽牌已测 | pending | 天赋真实入口待补 |
| `sumo_wrestlers_grasp_the_belt` | 抓住腰带 | 行动 | passed：从有己方随从的基地选择一个随从并移动到另一个基地 | pending | 其它候选/可选真实入口待补 |
| `sumo_wrestlers_fighting_spirit_prize` | 斗志奖 | 行动 | passed：抽 2 张牌；2 个指示物可集中给 1 个随从或分给 2 个随从 | representative-passed：真实手牌入口抽 2 后，把 2 个 +1 指示物分给两个己方随从，敌方随从未被误加 | 集中给 1 个随从的真实入口边界待扩展 |
| `sumo_wrestlers_top_tier` | 大关 | 随从 | passed：从手牌弃牌触发 +1 指示物 | pending | 触发边界待补 |
| `sumo_wrestlers_rookie_sumo` | 相扑新人 | 随从 | partial：弃牌给己方随从 +2 指示物已测 | pending | 天赋真实入口待补 |
| `base_heya_training_stable` | 训练馆 | 基地 | passed：可跳过；也可在回合开始弃 1 张牌并给这里己方随从 +1 指示物 | pending | 真实入口待补 |
| `base_the_dohyo` | 土俵 | 基地 | passed：可跳过；也可在首次打出随从后移动另一玩家随从到其它基地 | pending | 真实入口待补 |
| `musketeers_on_a_roll` | 连连获胜 | 行动 | passed：两个额外行动均限定所选随从 | pending | 真实额外行动消费链待补 |
| `musketeers_make_way` | 让路 | 行动 | passed：移动一个己方随从后授予额外行动 | pending | 真实入口与更多目标选择待补 |
| `musketeers_en_garde` | 预备姿势 | 行动 | passed：命令层目标随从消费、抽牌、触发年轻的火枪手 | pending | 更多触发对象待补 |
| `musketeers_biding_time` | 等待时间 | 行动 | passed：额外行动限定字段指向随从 | pending | 真实额外行动消费链待补 |
| `musketeers_to_battle` | 奋斗！ | 行动 | passed：额外随从后额外行动绑定新随从 | pending | skip/不打额外随从消费 pending effect 待补 |
| `musketeers_porthos` | Porthos | 随从 | passed：只防其他玩家行动；不防己方行动或非行动消灭 | pending | 真实入口待补 |
| `musketeers_athos` | Athos | 随从 | passed：行动直接影响同基地己方随从后加力 | pending | once/turn 边界待补 |
| `musketeers_one_for_all` | 一为全 | 行动 | passed：多基地候选中只强化所选基地己方随从并授予额外行动 | representative-passed：真实手牌入口选择目标基地，所选基地己方随从 +1 且获得额外行动 | 其它基地/边界仍待对象级扩展 |
| `musketeers_young_musketeer` | 年轻的火枪手 | 随从 | passed：行动直接影响此随从后 +1 | pending | 触发边界待补 |
| `musketeers_last_stand` | 最后一搏 | 行动 | passed：计分前给己方随从 +2 并抽 1 张牌 | representative-passed：真实计分前窗口打出后己方年轻的火枪手反超土俵计分，玩家 0 获得 3 VP 并抽到 `预备姿势` | 更多响应轮次边界待补 |
| `musketeers_dartagnan` | D'Artagnan | 随从 | passed：行动直接影响此随从后抽牌 | pending | 触发边界待补 |
| `musketeers_all_for_one` | 全为一 | 行动 | passed：打在随从上给额外行动；另一张直接影响宿主的行动后宿主 +1，并在回合末摧毁此卡 | representative-passed：真实手牌入口附着到波尔托斯后授予额外行动；`预备姿势` 直接影响宿主后宿主累计 +2 临时力量；回合结束 `全为一` 自动脱离并进入弃牌堆，interaction 清空 | 更多宿主/行动组合边界仍由 L2 覆盖 |
| `musketeers_token_of_affection` | 亲情的象征 | 行动 | passed：只搜直接影响随从的行动；可跳过；牌库候选入手并重排剩余牌库；弃牌堆单候选仍走 prompt；无候选反馈 | pending | 真实入口待补 |
| `musketeers_aramis` | 阿拉密斯 | 随从 | passed：行动直接影响此随从后通过强制反应授予 immediate restricted extra action，真实消费只能影响阿拉密斯本人 | representative-passed：真实手牌入口用 `预备姿势` 影响阿拉密斯后出现反应窗口，选择反应并消费 `等待时机`，阿拉密斯累计 +3 临时力量，关键行动进入弃牌堆，interaction 清空 | once/turn 更多边界仍由 L2 覆盖 |
| `base_bastion_saint_gervais` | 圣热尔韦堡垒 | 基地 | passed：直接影响这里己方随从后授予额外行动，且同一玩家每回合一次 | representative-passed：真实手牌入口打出 `廉价欢呼` 影响该基地己方疯狂之花后 actionLimit 提升到 2，并成功消费额外行动打出 `团队标记`，interaction / triggerQueue 清空 | 同回合第二次不触发仍由 L2 覆盖 |
| `base_the_golden_lily` | 黄金百合花 | 基地 | passed：回合结束有己方随从抽牌 | pending | 无己方随从拒绝路径待补 |
| `mounties_eh` | 嗯？ | 行动 | passed：弃牌堆 special provider 暴露合法随从目标；命令激活后 +1、回手并记录每回合一次消费 | representative-passed：真实弃牌堆 UI special 点击目标随从后 +1、回手、弃牌堆清空并记录一次性消费 | once/turn 更多边界仍待扩展 |
| `mounties_bring_em_in` | 带进来 | 行动 | passed：宿主移动到另一个基地后 +1 指示物 | pending | 真实移动事件链待补 |
| `mounties_mountie_major` | 骑警少校 | 随从 | passed：按另一位玩家最多随从数持续加力 | pending | 多玩家并列边界待补 |
| `mounties_northern_mover` | 北方搬运者 | 随从 | passed：移动另一个己方随从到其它基地；无其它基地时 +1 分支生效 | pending | 真实天赋入口待补 |
| `mounties_war_canuck` | 战争骑警 | 随从 | passed：+2 持续到自己下个回合开始 | pending | 无其他玩家随从拒绝路径待补 |
| `mounties_when_calls_the_badge` | 呼叫警徽 | 行动 | passed：onPlay 与 beforeScoring special 均给同基地己方随从放置 +1 指示物 | representative-passed：真实 Me First 计分前响应窗口中从手牌打出，选择基地后同基地两个己方随从各获得 +1 指示物 | 更多多基地/响应轮次边界待补 |
| `mounties_dudlee` | Dudlee | 随从 | passed：目的地只列有另一玩家随从的基地，移动后 +1 | pending | 真实天赋入口待补 |
| `mounties_always_get_our_man` | 总是抓住我们的人 | 行动 | passed：移动己方随从并回合结束消灭标记目标 | pending | 多候选选择待补 |
| `mounties_battle_moose` | 战斗麋鹿 | 行动 | passed：保护同基地己方随从不被其他玩家卡牌消灭 | pending | 自己来源不保护边界已测，真实入口待补 |
| `mounties_power_poutine` | 力量肉汁薯条 | 行动 | passed：合法候选存在时可空选，也可选择至多两个 +2 | pending | 目标基地命令层选择待补 |
| `mounties_move_aboot` | 挪过去 | 行动 | passed：选择其它基地己方随从，只能移到有另一玩家随从的基地并 +2 | pending | 单目标/真实入口待补 |
| `mounties_haich_q` | Haich-Q | 行动 | passed：基地持续 +1；天赋可把己方随从移入宿主基地或从宿主基地移出 | pending | 真实天赋入口待补 |
| `base_strategic_syrup_reserve` | 战略储备所 | 基地 | passed：可跳过；也可在打出随从后把另一玩家随从从有己方随从的基地移入 | pending | 真实入口待补 |
| `base_great_white_north_eh` | 伟大的白色北方，嗯？ | 基地 | passed：计分前逐玩家可跳过；选择时移动一个这里随从到其它基地并 +1 | pending | 真实计分入口待补 |
| `luchadors_quick_set_up` | 快速 Set-Up | 行动 | passed：onPlay 授予额外行动；真实附着到另一玩家随从；可忽略附着；额外行动可再附着另一张行动 | representative-passed：真实手牌入口附着到另一玩家随从并授予额外行动，随后消费额外行动继续附着 `聪明 Set-Up` | 更多 Set-Up 目标/skip 边界待补 |
| `luchadors_smart_set_up` | 聪明 Set-Up | 行动 | passed：宿主基地每回合第一次打出随从后抽牌，第二次不触发 | representative-passed：通过 `快速 Set-Up` 额外行动从真实手牌附着到同一宿主 | 真实触发抽牌链仍待补 |
| `luchadors_yellow_demon` | 黄色恶魔 | 随从 | passed：只搜 Set-Up 行动；可跳过；弃牌堆单候选仍走 prompt；无候选反馈 | pending | 真实入口待补 |
| `luchadors_reversal` | 逆转 | 行动 | passed：无合法目标反馈；计分前夺控；可空选不摧毁；也可摧毁任意数量所选己方 Set-Up 行动；回合末归还 | representative-passed：真实计分前窗口打出后，选择摧毁 2 张己方 Set-Up，夺控目标随从并让玩家 0 在擂台边获得 4 VP，responseWindow / interaction / triggerQueue 收口 | 回合末归还控制权仍由 L2 覆盖 |
| `luchadors_pin` | 压制 | 行动 | passed：取消能力并排除目标计分力量贡献 | representative-passed：真实手牌入口附着到另一玩家达达尼昂后，真实计分选择中目标力量被排除并产生 P1 +4 / AI +2 VP | 更多目标合法性与能力取消边界待补 |
| `luchadors_senor_muchoslam` | Muchoslam 先生 | 随从 | passed：回收弃牌堆行动；天赋授予额外行动 | pending | 天赋目标限制消费待补 |
| `luchadors_powerful_set_up` | 强力 Set-Up | 行动 | passed：按行动控制者给同基地己方随从 +1 | pending | suppress 边界待补 |
| `luchadors_tag_team` | 团队标记 | 行动 | passed：多基地选择有己方随从的基地并授予基地限定额外随从 | pending | 真实额外随从消费待补 |
| `luchadors_capa_roja` | 红披风（Capa Roja） | 随从 | passed：计分前可跳过；也可为每位其他玩家至多选择一个印制力量 3 或以下随从消灭 | representative-passed：真实计分前窗口选择并摧毁低印制力量随从，使玩家 0 在擂台边获得 4 VP，responseWindow / interaction / triggerQueue 清空 | skip 路径仍由 L2 覆盖，更多多玩家边界待补 |
| `luchadors_out_for_the_count` | 点名出局 | 行动 | passed：返还己方行动到手牌并消灭目标随从 | pending | 多行动选择待补 |
| `luchadors_senor_muchoslam_vs_the_monsters` | 穆乔摔先生大战怪物 | 行动 | passed：可空选；选择弃牌堆行动后回收一个可打在随从上的行动，其余所选行动洗入牌库 | representative-passed：真实手牌入口空选后弃牌堆/牌库不变，多选后 `压制` 回手、`团队标记` 洗回牌库 | 其它弃牌堆组合边界待补 |
| `luchadors_flor_loca` | Flor Loca | 随从 | passed：另一位玩家随从上有己方行动时 +2 | pending | suppress 边界待补 |
| `luchadors_cheap_pop` | 廉价欢呼 | 行动 | passed：无 Set-Up 基地给 +2，Set-Up 基地给 +4 | pending | 真实入口目标选择待补 |
| `base_ringside` | 擂台边 | 基地 | passed：直接影响这里另一玩家随从后行动控制者抽牌 | representative-passed：真实手牌入口将 `压制` 附着到这里另一玩家带己方 Set-Up 行动的达达尼昂后，玩家 0 抽到牌库顶 `团队标记`，牌库清空，interaction / triggerQueue 清空 | 更多非代表行动边界待补 |
| `base_the_squared_circle` | 方形擂台 | 基地 | passed：每回合第一次打出随从后从弃牌堆回收行动 | representative-passed：真实手牌入口将疯狂之花打到方形擂台后，弃牌堆唯一行动 `压制` 回到手牌，弃牌堆清空，interaction / triggerQueue 清空 | 无弃牌堆行动边界待补 |

### 当前残余范围

- Intake 残余：59 对象规则子句 / effect atom / 共享消费合同矩阵已补到 `evidence/smashup/2026-07-15-international-incident-effect-atom-matrix.md`；仍未把逐卡单卡裁图引用、英文资料冲突裁定和完整 `locked/blocked/disputed` intake 状态全部收口。
- 机制残余：已补更多 L2 handler、可选/skip、至多、搜索空候选、反应窗与额外行动真实消费路径，并已有四派系代表性真实入口结算证据；但仍不能判定为全部玩法完成，后续仍需补齐未覆盖对象的真实入口、反应窗截图、任意数量 UI 与 L4 finalState / triggerQueue / reaction session 证据。
- E2E 残余：代表性四派系真实入口 L3/L4 已通过并验图；`炖肉` 与 `穆乔摔先生大战怪物` 已补任意数量 prompt 的真实入口空选/多选链，`斗志奖` 已补真实入口抽牌与分配指示物链，`逆转` 已补真实计分前窗口夺控 + 多选摧毁 Set-Up 链，`最后一搏` 已补真实计分前窗口反超计分 + 抽牌链，`红披风（Capa Roja）` 已补真实计分前窗口摧毁低印制力量随从并反超计分链，`阿拉密斯` 已补真实反应窗口与限定额外行动消费链，`全为一` 已补真实附着、触发加力与回合末自毁链，基地 `方形擂台` 已补真实打出随从入口随机回收行动链，基地 `圣热尔韦堡垒` 已补真实行动影响己方随从后授予并消费额外行动链，基地 `擂台边` 已补真实行动影响另一玩家随从后抽牌链；但尚未完成 59 对象级真实入口全覆盖，后续仍需补更多 skip UI、非代表对象的计分前/计分后响应窗，以及更多 finalState / triggerQueue / reaction session 证据。
- 发布残余：已确认本批次精确上传对象为 `official/i18n/zh-CN/smashup/cards/compressed/international_incident.webp` 与 `official/i18n/zh-CN/smashup/base/compressed/international_incident_bases.webp`；精确上传在 R2 远程回查阶段返回 `401`，CDN `HEAD` 当前为 `404`，因此资源发布门禁仍 blocked。

## 代表性 L3/L4 E2E 与截图（2026-07-14 / 2026-07-15）

- E2E 文件：`e2e/smashup/smashup-international-incident-four-factions.e2e.ts`。
- 运行命令：`node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts`，当前完整结果 `14 passed`；`方形擂台`、`圣热尔韦堡垒` 与 `擂台边` 基地真实入口链已纳入完整回归。
- 截图根目录：`D:\GA\BoardGame-upstream-main-dev-20260601\test-results\evidence-screenshots\smashup\smashup-international-incident-four-factions.e2e`。
- `真实选秀能选择相扑手、火枪手、骑警、摔角手并进入牌桌\05-国际事件-真实选秀开局完成.jpg`：已实际核图；页面为真实牌桌，三张基地和底部手牌均加载本批次美术，说明四派系可从真实选秀进入游戏，不是 mock 或空白页。
- `四派系代表能力可从真实手牌或弃牌堆入口结算到权威状态\07-技术奖-力量指示物结算后.jpg`：已实际核图；`技术奖` 选择己方随从后目标随从显示力量指示物，非目标己方随从与敌方随从未被误加。
- `炖肉允许真实入口空选，也能多选手牌后给己方随从放指示物\19-炖肉-空选手牌弃置交互.jpg`：已实际核图；`炖肉` 从真实手牌入口打出后出现手牌多选交互，可见待弃手牌和空选确认路径。
- `炖肉允许真实入口空选，也能多选手牌后给己方随从放指示物\20-炖肉-空选后手牌与指示物不变.jpg`：已实际核图；空选后表演奖与年轻的火枪手仍在手牌，相扑新人没有新增指示物，证明合法候选存在时可以不做。
- `炖肉允许真实入口空选，也能多选手牌后给己方随从放指示物\21-炖肉-多选手牌弃置交互.jpg`：已实际核图；同一真实手牌入口下可选择 2 张手牌作为弃牌候选，符合“任意数量”语义。
- `炖肉允许真实入口空选，也能多选手牌后给己方随从放指示物\22-炖肉-选择承接指示物随从.jpg`：已实际核图；选择 2 张手牌后进入己方随从目标 prompt，说明弃牌选择与目标承接分段链路已接上。
- `炖肉允许真实入口空选，也能多选手牌后给己方随从放指示物\23-炖肉-多选结算后力量指示物增加.jpg`：已实际核图；表演奖进入弃牌堆，目标相扑新人显示 +2 指示物，另一个己方随从未被误加。
- `斗志奖可从真实入口抽牌并分配力量指示物\28-斗志奖-选择分配力量指示物随从.jpg`：已实际核图；`斗志奖` 从真实手牌入口打出后出现选择 0/2 的力量指示物分配 UI，两个己方随从高亮，敌方随从不是合法目标。
- `斗志奖可从真实入口抽牌并分配力量指示物\29-斗志奖-抽牌并分配指示物后.jpg`：已实际核图；牌库从 2 张变为 0，手牌新增相扑新人和力量满溢，两个己方相扑手各显示 +1 指示物，敌方随从未被误加。
- `穆乔摔先生大战怪物允许空选，也能多选弃牌堆行动后回收与洗回\24-穆乔大战怪物-空选弃牌堆行动交互.jpg`：已实际核图；`穆乔摔先生大战怪物` 从真实手牌入口打出后出现弃牌堆行动多选交互，可见空选确认路径。
- `穆乔摔先生大战怪物允许空选，也能多选弃牌堆行动后回收与洗回\25-穆乔大战怪物-空选后弃牌堆与牌库不变.jpg`：已实际核图；空选后弃牌堆仍保留原行动，牌库数量不变，证明合法候选存在时可以不回收、不洗牌。
- `穆乔摔先生大战怪物允许空选，也能多选弃牌堆行动后回收与洗回\26-穆乔大战怪物-多选弃牌堆行动交互.jpg`：已实际核图；同一真实手牌入口下可选择 `压制` 与 `团队标记` 两张弃牌堆行动，符合“任意数量”语义。
- `穆乔摔先生大战怪物允许空选，也能多选弃牌堆行动后回收与洗回\27-穆乔大战怪物-多选后回收行动并洗回其余.jpg`：已实际核图；`压制` 回到手牌，牌库数量增加且弃牌堆只剩已打出的本牌，说明其余所选行动已洗回牌库。
- `四派系代表能力可从真实手牌或弃牌堆入口结算到权威状态\09-一为全-所选基地强化后.jpg`：已实际核图；所选基地己方随从被强化，未选基地和敌方随从未被误加，并且玩家获得额外行动额度。
- `四派系代表能力可从真实手牌或弃牌堆入口结算到权威状态\11-嗯-弃牌堆special结算后.jpg`：已实际核图；`嗯？` 从弃牌堆 special 入口回到手牌，目标骑警随从显示 +1，弃牌堆已清空，牌桌布局正常。
- `四派系代表能力可从真实手牌或弃牌堆入口结算到权威状态\13-聪明Set-Up-额外行动附着后.jpg`：已实际核图；`快速 Set-Up` 授予的额外行动已消费，`聪明 Set-Up` 附着到另一玩家随从，且因擂台边直接影响另一玩家随从触发抽牌，玩家手牌新增 `团队标记` 与 `廉价欢呼`，牌库清空，流程停在可继续操作的真实牌桌。
- `计分前-special-与压制可从真实入口影响最终权威状态\14-呼叫警徽-计分前响应窗口.jpg`：已实际核图；真实牌桌处于基地计分阶段，Me First 响应窗口可见，`呼叫警徽` 在手牌中可被打出。
- `计分前-special-与压制可从真实入口影响最终权威状态\15-呼叫警徽-选择加指示物基地.jpg`：已实际核图；打出 `呼叫警徽` 后出现“选择一个基地给你的每个随从 +1 指示物”的真实基地选择提示，合法基地高亮。
- `计分前-special-与压制可从真实入口影响最终权威状态\16-呼叫警徽-计分前special结算后.jpg`：已实际核图；所选基地两个己方骑警均显示 +1 指示物，基地总力从 8 提升到 10，计分排序交互仍保持真实流程。
- `计分前-special-与压制可从真实入口影响最终权威状态\17-压制-真实附着后.jpg`：已实际核图；`压制` 从真实手牌附着到另一玩家达达尼昂，宿主旁可见附着标记，流程回到可结束回合状态。
- `计分前-special-与压制可从真实入口影响最终权威状态\18-压制-计分排除目标力量后.jpg`：已实际核图；计分提示显示 P1 获得 +4 VP、AI 获得 +2 VP，证明被 `压制` 的达达尼昂未贡献计分力量。
- `逆转可从真实计分前窗口夺控并摧毁己方-Set-Up-行动\30-逆转-计分前响应窗口.jpg`：已实际核图；真实牌桌进入基地计分阶段，擂台边达 `21/21`，玩家 0 在该基地未领先，手牌中的 `逆转` 可从 Me First 窗口打出。
- `逆转可从真实计分前窗口夺控并摧毁己方-Set-Up-行动\31-逆转-选择摧毁己方Set-Up行动.jpg`：已实际核图；打出 `逆转` 后出现“选择任意数量你的布置行动摧毁”提示，目标随从旁己方 `快速 Set-Up` / `聪明 Set-Up` 可被选择，对手行动未被列入可摧毁候选。
- `逆转可从真实计分前窗口夺控并摧毁己方-Set-Up-行动\32-逆转-夺控计分并摧毁行动后.jpg`：已实际核图；玩家 0 获得擂台边头奖 `+4 VP`，弃牌堆显示所选 Set-Up 已被摧毁，响应窗已收口并回到真实牌桌。
- `最后一搏可从真实计分前窗口反超计分并抽牌\33-最后一搏-计分前响应窗口.jpg`：已实际核图；真实牌桌进入基地计分阶段，土俵达 `17/17`，手牌中的 `最后一搏` 可从 Me First 窗口打出。
- `最后一搏可从真实计分前窗口反超计分并抽牌\34-最后一搏-反超计分并抽牌后.jpg`：已实际核图；年轻的火枪手显示加力并使玩家 0 在土俵获得 `+3 VP`，对手获得 `+2 VP`，同时手牌新增 `预备姿势`，响应窗已收口并回到真实牌桌。
- `Capa-Roja-可从真实计分前窗口摧毁低印制力量随从并反超计分\35-CapaRoja-计分前选择低印制力量随从.jpg`：已实际核图；真实牌桌进入基地计分阶段，擂台边达断点，`红披风（Capa Roja）` 提示要求选择每位其他玩家至多一个印制力量 3 或以下随从，年轻的火枪手为合法目标，跳过按钮可见。
- `Capa-Roja-可从真实计分前窗口摧毁低印制力量随从并反超计分\36-CapaRoja-摧毁目标并反超计分后.jpg`：已实际核图；年轻的火枪手被摧毁，玩家 0 通过红披风在擂台边获得 `+4 VP`，响应窗已收口并回到真实牌桌。
- `阿拉密斯可从真实反应窗口获得并消费限定额外行动\37-阿拉密斯-真实反应窗口.jpg`：已实际核图；`预备姿势` 从真实手牌入口影响阿拉密斯后，真实反应窗口出现阿拉密斯反应选项。
- `阿拉密斯可从真实反应窗口获得并消费限定额外行动\38-阿拉密斯-限定额外行动候选.jpg`：已实际核图；选择阿拉密斯反应后，`等待时机` 作为限定额外行动候选出现。
- `阿拉密斯可从真实反应窗口获得并消费限定额外行动\39-阿拉密斯-限定额外行动结算后.jpg`：已实际核图；`等待时机` 消费后阿拉密斯累计 +3 临时力量，`预备姿势` 与 `等待时机` 均进入弃牌堆，交互态清空。
- `全为一可从真实手牌附着、触发加力并在回合结束自毁\40-全为一-真实附着并获得额外行动后.jpg`：已实际核图；`全为一` 从真实手牌入口附着到波尔托斯，宿主旁可见附着行动，玩家获得额外行动额度。
- `全为一可从真实手牌附着、触发加力并在回合结束自毁\41-全为一-直接影响宿主后加力.jpg`：已实际核图；`预备姿势` 直接影响宿主后，宿主累计显示 +2 临时力量，`全为一` 仍保持附着。
- `全为一可从真实手牌附着、触发加力并在回合结束自毁\42-全为一-回合结束自毁后.jpg`：已实际核图；结束回合后 `全为一` 自动脱离并进入弃牌堆，交互态清空。
- `方形擂台可从真实打出随从入口随机回收弃牌堆行动\43-方形擂台-打出随从前弃牌堆有行动.jpg`：已实际核图；真实牌桌中方形擂台为空，玩家手牌有疯狂之花，弃牌堆存在待回收行动 `压制`。
- `方形擂台可从真实打出随从入口随机回收弃牌堆行动\44-方形擂台-回收行动并清空流程态.jpg`：已实际核图；疯狂之花已进入方形擂台，`压制` 已回到手牌，弃牌堆清空，交互态与触发队列收口。
- `圣热尔韦堡垒可从真实行动影响己方随从入口授予额外行动\45-圣热尔韦堡垒-行动影响己方随从前.jpg`：已实际核图；真实牌桌中圣热尔韦堡垒上有己方疯狂之花，手牌有 `廉价欢呼` 与 `团队标记`，行动上限为 1。
- `圣热尔韦堡垒可从真实行动影响己方随从入口授予额外行动\46-圣热尔韦堡垒-获得额外行动后.jpg`：已实际核图；`廉价欢呼` 影响己方疯狂之花后，玩家行动上限提升到 2，`团队标记` 仍在手牌可供消费额外行动。
- `圣热尔韦堡垒可从真实行动影响己方随从入口授予额外行动\47-圣热尔韦堡垒-消费额外行动后.jpg`：已实际核图；`团队标记` 成功作为第二张行动打出，手牌清空，弃牌堆包含 `廉价欢呼` 与 `团队标记`，交互态与触发队列收口。
- `擂台边可从真实行动影响另一玩家随从入口抽牌\48-擂台边-压制另一玩家随从前.jpg`：已实际核图；真实牌桌中擂台边有另一玩家达达尼昂，玩家 0 手牌有 `压制`，牌库顶有待抽行动 `团队标记`。
- `擂台边可从真实行动影响另一玩家随从入口抽牌\49-擂台边-压制附着并抽牌后.jpg`：已实际核图；`压制` 已附着到达达尼昂，玩家 0 手牌新增 `团队标记` 且牌库清空，交互态与触发队列收口。

## 卡牌清单草案

| 派系 | atlas 槽位 | CardID | 英文名 | 类型 | 实体数量 |
| --- | ---: | ---: | --- | --- | ---: |
| 相扑手 | 0 | 25800 | Technique Prize | Action | 1 |
| 相扑手 | 1 | 25801 | Yokozuna | Minion | 1 |
| 相扑手 | 2 | 25802 | Performance Prize | Action | 1 |
| 相扑手 | 3 | 25803 | Head Butt | Action | 1 |
| 相扑手 | 4 | 25804 | Bulking Stew | Action | 1 |
| 相扑手 | 5 | 25805 | Body Slam | Action | 1 |
| 相扑手 | 6 | 25806 | Chikara-Mizu | Action | 2 |
| 相扑手 | 7 | 25807 | Third Tier | Minion | 3 |
| 相扑手 | 8 | 25808 | Grasp the Belt | Action | 2 |
| 相扑手 | 9 | 25809 | Fighting Spirit Prize | Action | 1 |
| 相扑手 | 10 | 25810 | Top Tier | Minion | 2 |
| 相扑手 | 11 | 25811 | Rookie Sumo | Minion | 4 |
| 火枪手 | 12 | 25812 | On a Roll | Action | 1 |
| 火枪手 | 13 | 25813 | Make Way | Action | 1 |
| 火枪手 | 14 | 25814 | En Garde | Action | 2 |
| 火枪手 | 15 | 25815 | Biding Time | Action | 1 |
| 火枪手 | 16 | 25816 | To Battle! | Action | 1 |
| 火枪手 | 17 | 25817 | Porthos | Minion | 1 |
| 火枪手 | 18 | 25818 | Athos | Minion | 1 |
| 火枪手 | 19 | 25819 | One for All | Action | 2 |
| 火枪手 | 20 | 25820 | Young Musketeer | Minion | 5 |
| 火枪手 | 21 | 25821 | Last Stand | Action | 1 |
| 火枪手 | 22 | 25822 | D'Artagnan | Minion | 1 |
| 火枪手 | 23 | 25823 | All for One | Action | 1 |
| 火枪手 | 24 | 25824 | Token of Affection | Action | 1 |
| 火枪手 | 25 | 25825 | Aramis | Minion | 1 |
| 骑警 | 26 | 25826 | Eh? | Action | 1 |
| 骑警 | 27 | 25827 | Bring 'Em In | Action | 1 |
| 骑警 | 28 | 25828 | Mountie Major | Minion | 1 |
| 骑警 | 29 | 25829 | Northern Mover | Minion | 2 |
| 骑警 | 30 | 25830 | War Canuck | Minion | 3 |
| 骑警 | 31 | 25831 | When Calls the Badge | Action | 1 |
| 骑警 | 32 | 25832 | Dudlee | Minion | 4 |
| 骑警 | 33 | 25833 | Always Get Our Man | Action | 1 |
| 骑警 | 34 | 25834 | Battle Moose | Action | 1 |
| 骑警 | 35 | 25835 | Power Poutine | Action | 2 |
| 骑警 | 36 | 25836 | Move Aboot | Action | 2 |
| 骑警 | 37 | 25837 | Haich-Q | Action | 1 |
| 摔角手 | 38 | 25838 | Quick Set-Up | Action | 1 |
| 摔角手 | 39 | 25839 | Smart Set-Up | Action | 1 |
| 摔角手 | 40 | 25840 | Yellow Demon | Minion | 4 |
| 摔角手 | 41 | 25841 | Reversal | Action | 1 |
| 摔角手 | 42 | 25842 | Pin | Action | 2 |
| 摔角手 | 43 | 25843 | Senor Muchoslam | Minion | 1 |
| 摔角手 | 44 | 25844 | Powerful Set-Up | Action | 1 |
| 摔角手 | 45 | 25845 | Tag-Team | Action | 1 |
| 摔角手 | 46 | 25846 | Capa Roja | Minion | 2 |
| 摔角手 | 47 | 25847 | Out for the Count | Action | 1 |
| 摔角手 | 48 | 25848 | Senor Muchoslam vs the Monsters | Action | 1 |
| 摔角手 | 49 | 25849 | Flor Loca | Minion | 3 |
| 摔角手 | 50 | 25850 | Cheap Pop | Action | 1 |

## 基地清单草案

| 派系 | CardID | canonical 英文名 | 状态 |
| --- | ---: | --- | --- |
| 相扑手 | 6612 | Heya Training Stable | source-found |
| 相扑手 | 6615 | The Dohyo | source-found |
| 火枪手 | 6613 | Bastion Saint-Gervais | source-found |
| 火枪手 | 6608 | The Golden Lily | source-found |
| 骑警 | 6609 | Strategic Syrup Reserve | source-found |
| 骑警 | 6610 | Great White North, Eh? | source-found |
| 摔角手 | 6614 | Ringside | source-found |
| 摔角手 | 6611 | The Squared Circle | source-found |

## 下一步门禁

1. 基于 `evidence/smashup/2026-07-15-international-incident-effect-atom-matrix.md` 继续补未覆盖对象的 L3/L4，尤其是任意数量/skip UI、非代表对象的计分前/计分后特殊能力与反应窗/finalState 证据。
2. 继续把矩阵中 `partial` / `pending` 对象扩展到更多 L2 行为测试或真实入口证据，避免代表链外推。
3. 回补逐卡单卡裁图引用、英文资料冲突裁定和 `locked/blocked/disputed` intake handoff。
4. 使用有效 R2 凭据重新执行精确上传：`node scripts/assets/upload-to-r2.js --only official/i18n/zh-CN/smashup/cards/compressed/international_incident.webp official/i18n/zh-CN/smashup/base/compressed/international_incident_bases.webp --skip-android-package-publish`，并对 `international_incident.webp` 与 `international_incident_bases.webp` 做 CDN `HEAD 200` 回查。
5. 仅在 59 对象矩阵、E2E、远端资源和 OpenSpec closeout 全部收口后，才允许把本批次表述为“当前发布口径完成”。
