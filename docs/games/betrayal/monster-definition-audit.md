# 山屋惊魂怪物定义覆盖审计

> 状态：active
> 当前目标：把 50 个作祟子账本里的怪物合同和当前运行时代码逐项对齐，防止用少数代表链冒充完整怪物系统。
> 真相来源：`docs/games/betrayal/haunts/*.md`、`src/games/betrayal/game.ts`、`src/games/betrayal/scenarioConfig.ts`。
> 更新时间：2026-07-26

## 1. 当前结论

- 当前代码已新增初始 `monsterDefinitions` catalog，把 8 个官方怪物定义收口到同一张表；但这只是怪物定义底座，不等于 50 个作祟怪物完成。
- 已有真实入口代表链覆盖了杰克之灵、狂热病患、巨魔手、幻影摄影师、石像小天使，以及测试夹具里的普通怪物移动 / 攻击模式。
- 预览用狼人、幽灵只在 `createBetrayalMonsterEncounterCore` 代表态中出现，不能算任何官方作祟怪物已接入。
- 绝大多数作祟子账本已有怪物合同，但没有运行时生成、怪物卡定义、专属行动、特殊受伤 / 击杀和真实入口回归。

## 2. 状态定义

| 状态 | 含义 |
| --- | --- |
| `implemented-with-evidence` | 已有运行时代码、测试和截图证据，仍只按证据范围宣称 |
| `implemented-definition-setup-multi-placement-multi-gaze-natural-turn-peekaboo-and-endgame-e2e-representative` | 已有官方怪物定义、作祟 5 setup 自动全量放置、视线外房间不足时玩家补放石像真实房间选择 UI、缺口为 2 时同房重复补放真实入口、作祟专属视线移动覆写、英雄进入新视线伤害、怪物回合结束凝视伤害首名英雄和多英雄连续分配真实入口、揭秘者结束英雄回合后自然进入石像小天使怪物回合并在凝视收口后交给下一玩家、英雄特殊行动“玩躲猫猫”成功成对移除代表链、失败伤害分配真实入口，以及作祟 5 英雄 / 作祟胜利真实入口终局 |
| `implemented-definition-and-visibility-move-representative` | 已有官方怪物定义、真实入口代表链，并接入至少一条作祟专属移动覆写；作祟专属伤害 / 特殊行动 / 终局仍未完成 |
| `implemented-definition-and-entry-representative` | 已有官方怪物定义和一条真实入口代表链，但作祟专属目标 / 特殊行动 / 终局仍未完成 |
| `implemented-domain-only` | 已有领域状态或命令，缺真实入口 E2E 或完整 UI |
| `preview-only` | 只用于预览 / 测试夹具，不算官方作祟怪物 |
| `contract-only` | 子账本已有规则合同，但正式代码未接入 |
| `missing-contract-detail` | 子账本提到怪物或怪物压力，但怪物字段还不够实现 |

## 3. 代码已接入怪物

| 怪物 | 来源 | 当前代码入口 | 覆盖状态 | 不可外推边界 |
| --- | --- | --- | --- | --- |
| 杰克之灵 | 作祟 1 | `scenarioConfig.runtimePreview.monsters`、杰克之灵死亡 / 复活 / 移动 / 攻击相关逻辑、叛徒死亡后自然替代回合前置态 / E2E | `implemented-with-evidence` | 只代表首剧本杰克之灵、死叛徒自然回合、路径预览和攻击槽代表链；不代表其它死亡玩家变怪物、其它作祟自然怪物回合全排列、特殊移动或不可击晕怪物 |
| 狂热病患 | 作祟 3 | `addFeverishMonsterForPlayer`、`resolveFeverishMonsterMovementRoll`、死亡叛徒控怪限制、狂热病患自然怪物回合前置态 / E2E | `implemented-with-evidence` | 只代表作祟 3 死亡叛徒变狂热病患后的自然移动骰、真实房间移动、回合交接和同房英雄攻击代表链；不代表完整灰尘感染交换、研究 / 治愈、隐藏叛徒可见性、终局或其它作祟自然怪物回合 |
| 巨魔手 | 作祟 12 | `createHelpingHandsTrollHands`、巨魔手移动 / 单手攻击 / 合击 / 结束怪物回合 | `implemented-with-evidence` | 只代表 12 号巨魔手；不代表通用多怪物自然回合或全部特殊攻击 |
| 幻影摄影师 | 作祟 33 | `createMagicCameraPhantomPhotographers`、视线攻击、击晕 / 击杀、移动代表链 | `implemented-with-evidence` | 只代表 33 号魔法相机；不代表其它远程怪物、不可击晕怪物或全部摄影师终局 |
| 石像小天使 | 作祟 5 | `monsterDefinitions`、`createBetrayalMonsterFromDefinition`、`resolveBloodFromStoneSetupPlacementPlan`、作祟触发 setup 写入石像、视线内不移动 / 进入视线停步 / 英雄进入新视线伤害 / `END_BLOOD_FROM_STONE_MONSTER_TURN` / `resolveBloodFromStoneMonsterTurnEndPreview` / `pendingDamageAllocation.nextDamageAllocations` / 自然石像小天使怪物回合运行态 / `PLACE_BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS` / `PLAY_PEEKABOO` / `resolveBloodFromStonePeekabooOptions` / 真实 setup 地图 token / 真实房间补放入口 / 真实 token 移动入口 / 真实动作栏结束回合入口 / 自然怪物回合动作槽 / 真实 token 双选择入口 / 作祟 5 终局 helper | `implemented-definition-setup-multi-placement-multi-gaze-natural-turn-peekaboo-and-endgame-e2e-representative` | 只证明 setup 自动全量放置、视线外房间不足时缺口为 1 的玩家真实房间补放、缺口为 2 时玩家可重复点击同一真实房间并生成两只不同新石像 token、固定属性、不能攻击、不能被普通攻击、不能被击晕、视线内不移动、进入英雄视线后停步、英雄进入新石像视线时触发 2 骰一般伤害、怪物回合结束会按英雄视线内石像数量进入一般伤害分配并已补多英雄连续分配真实入口、揭秘者结束英雄回合后自然进入石像小天使怪物回合且凝视收口后交给下一玩家，“玩躲猫猫”同房石像 + 视线内石像真实 token 双选择、Mirror 加值成功时成对移除、移除最后两只后的英雄胜利真实入口、失败伤害分配真实入口，以及全部英雄死亡后的作祟胜利真实入口；不代表完整作祟 5 边界回归或其它自然怪物回合全排列 |
| 狼人 / 幽灵 | 预览夹具 | `MONSTER_ENCOUNTER_PREVIEW_MONSTERS` | `preview-only` | 只用于怪物预览场景；不能算作祟 15、43 或其它官方怪物实现 |
| 慢速怪物 / 快速怪物 / 测试怪物 | E2E 夹具 | `e2e/betrayal/normal-monster-*.e2e.ts` | `preview-only` | 只证明通用动作槽、移动骰组、路径和普通攻击模式；不能算官方怪物定义 |

## 4. 子账本怪物合同覆盖清单

| 作祟 | 怪物 / 怪物型对象 | 子账本已锁定合同 | 当前接入状态 | 下一步 |
| ---: | --- | --- | --- | --- |
| 1 | 杰克之灵 | 特殊怪物替代回合、叛徒死亡后生成、驱魔目标、不可击晕口径 | `implemented-with-evidence` | 已补上一名英雄结束回合后自然进入死叛徒操控杰克之灵速度 3 移动骰的真实入口代表链；仍缺完整驱魔、复活、终局和全部边界回归 |
| 3 | 狂热病患 | 死亡叛徒变怪物、固定属性、怪物回合行动、感染胜负 | `implemented-with-evidence` | 已补死亡叛徒变狂热病患后自然移动骰、真实房间移动、攻击同房英雄和回合交接代表链；证据见 `evidence/betrayal-the-dust-feverish-natural-monster-turn/e2e-test.md`；下一步补灰尘完整感染交换、研究 / 治愈和终局边界 |
| 4 | 恶魔地产经纪人 | 固定怪物、不能击晕、被伤害后可被移动、区域精神伤害 | `contract-only` | 建立怪物定义、伤害推动、区域伤害和仪式同房行动 |
| 5 | 石像小天使（Stone Cherub） | 数量随玩家、视线伤害、不能被普通攻击、成对移除 | `implemented-definition-setup-multi-placement-multi-gaze-natural-turn-peekaboo-and-endgame-e2e-representative` | 已建立怪物定义、setup 自动全量放置、视线外房间不足时玩家真实房间补放、缺口为 2 时同房重复补放真实入口、视线内不移动、进入视线停步、英雄进入新视线伤害、怪物回合结束凝视伤害首名英雄和多英雄连续分配真实入口、自然进入石像小天使怪物回合并在凝视后交给下一玩家、“玩躲猫猫”成功成对移除代表链、失败伤害分配真实入口，以及移除最后两只后的英雄胜利 / 全部英雄死亡后的作祟胜利真实入口；下一步补逐边界回归 |
| 7 | 镜中怪物（Mirror Being） | 数量随玩家、最近目标、平手由揭秘者选择、神志攻击 | `contract-only` | 建立最近目标 / 平手选择和镜中提示互斥回合 |
| 8 | 管家（Housekeeper） | 数量随玩家、最近英雄、平手目标、怪物回合末压力 | `contract-only` | 建立清洁目标进度和管家追击 / 全员伤害 |
| 12 | 巨魔手 | 两只同组移动骰、动态护符控制权、单手攻击 / 合击、不能击晕 | `implemented-with-evidence` | 补完整自然怪物回合全排列和终局 |
| 13 | 邪教徒（Cultist） | 数量随玩家、尸体 / 携带状态、仪式减值、怪物回合 | `contract-only` | 建立尸体携带和仪式进度 / 扰乱行动 |
| 14 | 活动家具（Animated Furniture） | 数量随玩家、叛徒死亡复活替身、怪物回合后施法推进 | `contract-only` | 建立家具怪物、叛徒复活和 Book 转移 |
| 15 | 幽灵 / 吸血鬼 / 狼人 | 三怪物、指定武器击杀、叛徒已死后控怪、各自特殊攻击 | `contract-only` | 建立三怪物定义和指定武器攻击声明 |
| 16 | 愤怒幽灵 | 初始 / 备用数量、遗骸生成压力、本回合可行动边界 | `contract-only` | 建立遗骸搜索、安葬和幽灵生成回合 |
| 17 | 小魔怪（Gremlin） | 3 个 Gremlin、Rune token 使其可杀、伏击压力 | `contract-only` | 建立可杀标记、手机研究和伏击攻击 |
| 19 | 复仇怨灵 | 录像带间移动、倒计时抵挡、特殊相邻 | `contract-only` | 建立录像带位置和怨灵传送 / 抵挡诅咒 |
| 21 | 恐怖小说家 / 恐怖怪 | 固定图书馆 Boss、可变恐怖怪、Book 持有人和代写表 | `contract-only` | 建立固定房间 Boss、Book 争夺和代写结果表 |
| 23 | 机器人助手 | 数量随玩家、激光攻击、机器开关击晕同区域机器人 | `contract-only` | 建立机器人定义、ON/OFF 房间和激光位移 |
| 24 | 仙灵舞者 / 黑暗女王 | 舞厅攻击限制、区域移动英雄、女王到场 | `contract-only` | 建立舞厅限定攻击和永恒之舞行动 |
| 26 | 亲族 / 长老 | 亲族数量、长老第二回合登场、暗道移动 | `contract-only` | 建立 Relative / The Elder 和三段胜利门槛 |
| 28 | 幽灵鲨 | 不可击晕、Flooded 房间传送、炸药强塞胜利 | `contract-only` | 建立淹没房间、鲨鱼目标和炸药弃置加值 |
| 29 | 仙灵（Fae） | 不可击晕、视线攻击、绑定仪式三项加值 | `contract-only` | 建立 Fae 数量 / 视线攻击 / Cold Iron 绑定 |
| 30 | 婚礼派对 | 数量随玩家、怪物回合、Ring 引诱叛徒移动 | `contract-only` | 建立婚礼派对行动和祭坛 / Ring 状态 |
| 31 | 诅咒物品 | 编号绑定物品 / 预兆、击晕后解除、可使用对应武器 | `contract-only` | 建立编号 token、卡牌绑定和解除诅咒 |
| 32 | 化猫 / 亡灵猫 | 火 token、化猫不可简化、亡灵猫诱导 / 召唤 / 区域加力 | `contract-only` | 建立火焰扩张、猫群伤害和化猫胜负 |
| 33 | 幻影摄影师 | 数量随玩家、相机 / Essence、视线理智攻击、力量杀死 | `implemented-with-evidence` | 补完整相机终局和全部摄影师自然回合 |
| 35 | 太空蛞蝓 | 数量随玩家、群攻加值、攻击后同房蛞蝓死亡、Mind Controlled | `contract-only` | 建立蛞蝓攻击后死亡和阵营转换 |
| 36 | 鬼魂 | 可变鬼魂、和解 / 吞噬、房间移动和英雄计数 | `contract-only` | 建立 Ghost token、和解计数和吞噬行动 |
| 37 | 安保机器人 | 数量随玩家、技术房间禁用、入口大厅逃离倒计时 | `contract-only` | 建立 Robot 目标、知识攻击和样本上传状态 |
| 38 | 邻居 / 宴会怪物 | 数字轨新增数量、厨房复活、食物 / 派对目标 | `missing-contract-detail` | 子账本需补齐怪物属性、数量和行动表 |
| 39 | 工蜂 / 巨蜂 | 工蜂护卫攻击后死亡、巨蜂被攻击减值、卵孵化倒计时 | `contract-only` | 建立卵、工蜂、巨蜂和巢群防御 |
| 40 | 邪恶双胞胎 | 每英雄反射怪物、指定击杀权限、属性复制 | `missing-contract-detail` | 子账本需补齐怪物属性、数量、生成和击杀合同 |
| 41 | 房屋怪物 | 不在地图移动、电子附身、扭曲走廊、陷阱 | `contract-only` | 建立无地图位置怪物和特殊行动目标选择 |
| 42 | 恶魔狗 | 不可击晕、Food token 加力、喂狗防御、驱灵阈值 | `contract-only` | 建立恶魔狗、食物池和受击反应窗口 |
| 43 | 狼人 | 隐藏 token、安抚野兽、叛徒沟通后移动并攻击 | `contract-only` | 建立隐藏状态、狼人击晕和黎明倒计时 |
| 44 | 假人 | 数量随玩家、视线移动限制、火势扩散 | `contract-only` | 建立假人怪物和燃烧房间扩散 |
| 46 | 小头发怪 / 巨型头发怪 | 真解药攻击、预兆房换位、英雄死亡生成小怪 | `contract-only` | 建立解药编号、换位和巨怪胜利判断 |
| 47 | 残酷骑士 | Trapped 状态改变攻击属性和结果 | `missing-contract-detail` | 子账本需补齐骑士 token、位置和怪物属性 |
| 48 | 房主之首 | 击败后死亡而非击晕、Skull 转移、叛徒复活房主 | `missing-contract-detail` | 子账本需补齐怪物属性和复活位置合同 |
| 49 | 恶魔 | 持有 Contract、英雄可偷合同、叛徒不能持有合同 | `contract-only` | 建立 Demon 持物、合同转移和血契仪式 |
| 50 | 构装体 | 吞尸、吞噬房屋、预兆房传送、速度数字轨、不可击晕 | `contract-only` | 建立 Construct 和 Consumed 房间状态 |

## 5. 接入顺序建议

1. 先抽通用 `monsterDefinitions` catalog，字段至少覆盖名称、数量策略、属性、token / portrait、受伤结果、移动规则、攻击规则、特殊行动、控制者策略和胜负钩子。
2. 把已实现的杰克之灵、狂热病患、巨魔手、幻影摄影师回填进 catalog，避免继续散落在独立 helper。
3. 优先补子账本已经清楚且能复用通用怪物系统的合作作祟：石像小天使、镜中怪物、管家、邪教徒、活动家具。
4. 再补复杂变体：指定武器击杀三怪物、诅咒物品、太空蛞蝓、房屋怪物、构装体。

## 6. 验收门槛

- 任一作祟怪物从 `contract-only` 升级前，必须同时补：领域定义、生成 / setup、怪物卡查看、地图 token、移动骰 / 攻击 / 特殊行动、受伤结果、目标条或进度条、至少一条真实入口 E2E。
- 预览夹具或测试怪物只能证明通用交互形态，不能把状态写成“官方怪物已接入”。
- 每次新增怪物定义后，必须回填本审计表的状态和证据路径。
