# 波利尼西亚航海者 intake 合同（预批准阶段）

日期：2026-07-28

## 结论状态

- 数据录入合同：`locked-for-approval`。
- 运行时实现：`pending-approval`，尚未改正式代码。
- 正式资源接入：`pending-approval`，用户卡牌图集尚未复制到 `public/assets/**`。
- 服务器上传与 PR：`pending-implementation`。

本文件只记录预批准阶段可做的来源、裁图、槽位、卡牌/基地合同和 implementation handoff；正式实装仍以 OpenSpec change `add-smashup-polynesian-voyagers-faction` 批准后为准。

## 真相源表

| 来源 | 路径 / 链接 | 字段职责 | 状态 |
| --- | --- | --- | --- |
| 用户提供卡牌图集 | `C:/Users/Dqm/.codex/attachments/edfb15a2-6220-4da3-b98b-0e9be4fd8690/image-1.png` | 中文卡面、中文名、中文规则文本、卡牌图集 row-major 顺序 | locked |
| AEG 规则站 | `https://smashup-rulebook.alderac.com/wiki/Polynesian_Voyagers` | canonical 英文名、英文文本、数量、力量、基地断点/VP/英文文本对照 | locked |
| 仓库共享基地 atlas | `public/assets/i18n/zh-CN/smashup/base/polynesian_voyagers/atlas.png` | 文化冲击共享基地图集、波利尼西亚航海者基地槽位 | locked |

### 用户卡牌图集元数据

| 字段 | 值 |
| --- | --- |
| 尺寸 | `1944 x 2048` |
| 文件大小 | `11,247,201 bytes` |
| SHA-256 | `97299d31a0a98eba7e00411e75a612ad8cf3611fb1c25fec3349a73901b677d8` |
| 运行时目标 | `public/assets/i18n/zh-CN/smashup/cards/polynesian_voyagers.png`（批准后复制） |
| 运行时压缩目标 | `public/assets/i18n/zh-CN/smashup/cards/compressed/polynesian_voyagers.webp`（批准后生成） |

### 共享基地 atlas 元数据

| 字段 | 值 |
| --- | --- |
| 源图路径 | `public/assets/i18n/zh-CN/smashup/base/polynesian_voyagers/atlas.png` |
| 源图尺寸 | `2100 x 1126` |
| 源图 SHA-256 | `253dda49b347392e8657fdb2cda21a7b6ea4cfa667421e44b821d38756c6e0be` |
| 压缩图路径 | `public/assets/i18n/zh-CN/smashup/base/polynesian_voyagers/compressed/atlas.webp` |
| 压缩图 SHA-256 | `31f4179b388ed1063b20c65f9cb6c5eeb95474b352321fac756939712fa468b0` |
| 运行时 atlas id | `SMASHUP_ATLAS_IDS.POLYNESIAN_VOYAGERS_BASES` |

## 切图表

裁图只用于录入核对，全部位于 `temp/`，不进入正式资源树。

| slot | row | col | 裁图路径 | 尺寸 | 对象 | 可读性 |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | 1 | 1 | `temp/smashup-polynesian-voyagers-intake/cards/slot-00-r1c1.png` | `486 x 682` | 部落的成长 | locked |
| 1 | 1 | 2 | `temp/smashup-polynesian-voyagers-intake/cards/slot-01-r1c2.png` | `486 x 682` | 部落的知识 | locked |
| 2 | 1 | 3 | `temp/smashup-polynesian-voyagers-intake/cards/slot-02-r1c3.png` | `486 x 682` | 莫艾 | locked |
| 3 | 1 | 4 | `temp/smashup-polynesian-voyagers-intake/cards/slot-03-r1c4.png` | `486 x 682` | 蒂基 | locked |
| 4 | 2 | 1 | `temp/smashup-polynesian-voyagers-intake/cards/slot-04-r2c1.png` | `486 x 682` | 寻路者 | locked |
| 5 | 2 | 2 | `temp/smashup-polynesian-voyagers-intake/cards/slot-05-r2c2.png` | `486 x 682` | 毛伊人 | locked |
| 6 | 2 | 3 | `temp/smashup-polynesian-voyagers-intake/cards/slot-06-r2c3.png` | `486 x 682` | 海洋纹身 | locked |
| 7 | 2 | 4 | `temp/smashup-polynesian-voyagers-intake/cards/slot-07-r2c4.png` | `486 x 682` | 纹身艺术家 | locked |
| 8 | 3 | 1 | `temp/smashup-polynesian-voyagers-intake/cards/slot-08-r3c1.png` | `486 x 684` | 部落的统一 | locked |
| 9 | 3 | 2 | `temp/smashup-polynesian-voyagers-intake/cards/slot-09-r3c2.png` | `486 x 684` | 火山爆发 | locked |
| 10 | 3 | 3 | `temp/smashup-polynesian-voyagers-intake/cards/slot-10-r3c3.png` | `486 x 684` | 鲨鱼纹身 | locked |
| 11 | 3 | 4 | `temp/smashup-polynesian-voyagers-intake/cards/slot-11-r3c4.png` | `486 x 684` | 太阳纹身 | locked |

完整裁图 metadata：`temp/smashup-polynesian-voyagers-intake/crop-metadata.json`。

## 卡牌核对合同表

| 状态 | defId | 中文名 | English | 类型 | 数量 | 力量 | atlas slot | 原子子句 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| locked | `polynesian_voyagers_growth_of_the_tribes` | 部落的成长 | Growth of the Tribes | action | 1 | - | 0 | C1 选择一个你没有随从的基地；C2 立即在那里额外打出一个随从；C3 或移动一个你的随从到那里 |
| locked | `polynesian_voyagers_knowledge_of_the_tribes` | 部落的知识 | Knowledge of the Tribes | action | 1 | - | 1 | C1 每个你有随从的基地各让你抽一张牌 |
| locked | `polynesian_voyagers_moai` | 莫艾 | Mo'ai | minion | 4 | 3 | 2 | C1 持续；C2 其他玩家不能移动他们的随从到这个基地；C3 其他玩家不能移动这个随从到其他基地 |
| locked | `polynesian_voyagers_tiki` | 蒂基 | Tiki | minion | 3 | 3 | 3 | C1 持续；C2 如果这个随从身上有行动，它获得 +2 力量 |
| locked | `polynesian_voyagers_wayfinder` | 寻路者 | Wayfinder | minion | 2 | 4 | 4 | C1 天赋；C2 移动这个随从到一个你没有随从的基地；C3 放置一个 +1 力量指示物到他身上 |
| locked | `polynesian_voyagers_maui` | 毛伊人 | Maui | minion | 1 | 5 | 5 | C1 打出至多两张基地牌库顶的牌；C2 天赋；C3 移动一个你的随从到一个你没有随从的基地 |
| locked | `polynesian_voyagers_ocean_tattoo` | 海洋纹身 | Ocean Tattoo | action-on-minion | 1 | - | 6 | C1 打出到一个没有其他玩家随从的基地上的你的随从身上；C2 天赋；C3 移动这个随从到另一个基地；C4 放置一个 +1 力量指示物到他身上 |
| locked | `polynesian_voyagers_tattoo_artist` | 纹身艺术家 | Tattoo Artist | action | 1 | - | 7 | C1 搜索你的牌库和/或弃牌堆；C2 找一张可以打在随从身上的行动；C3 将其放入你的手中；C4 或作为额外行动打出 |
| locked | `polynesian_voyagers_unity_of_the_tribes` | 部落的统一 | Unity of the Tribes | action | 1 | - | 8 | C1 选择一个你拥有随从的基地；C2 每个你至少拥有一个随从的基地使该基地获得 +2 力量直到回合结束 |
| locked | `polynesian_voyagers_volcanic_uprising` | 火山爆发 | Volcanic Uprising | action | 1 | - | 9 | C1 打出基地牌库顶的牌；C2 然后你可以移动一个你的随从到那里；C3 或摧毁一个没有玩家随从的基地；C4 然后用两个基地代替 |
| locked | `polynesian_voyagers_shark_tattoo` | 鲨鱼纹身 | Shark Tattoo | action-on-minion | 2 | - | 10 | C1 打出到一个你的随从身上；C2 放置一个 +1 力量指示物到他身上；C3 持续；C4 你的回合开始时，若这里仅有你一个随从，放置一个 +1 力量指示物到这个随从身上 |
| locked | `polynesian_voyagers_sun_tattoo` | 太阳纹身 | Sun Tattoo | action-on-minion / special | 2 | - | 11 | C1 打出到一个你的随从身上；C2 持续：这个随从获得 +2 力量；C3 特殊：基地计分后，你可以将此牌打出到那里一个没有任何行动的你的随从身上；C4 移动该随从到另一个基地来代替进入弃牌堆 |

## 基地合同表

| 状态 | defId | 中文名 | English | breakpoint | VP | atlas slot | 原子子句 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| locked | `base_island_chain` | 岛链 | Island Chain | 17 | 3/1/1 | 8 | C1 这个基地计分后，打出基地牌库顶的牌作为额外基地 |
| locked | `base_island_peak` | 岛峰 | Island Peak | 23 | 4/2/1 | 9 | C1 你的回合开始时，若你在这里正好有一个随从，放置一个 +1 力量指示物到他身上 |
| locked | `base_tropical_paradise` | 热带天堂 | Tropical Paradise | 20 | 3/2/1 | 10 | C1 若每位玩家在这个基地上都有一个或更多随从，它的起始断点为 0 |

## 可视合同表

| visualRegion / slotId | 图上对象 | 运行时对象 | 允许状态 | 是否可交互 | 备注 |
| --- | --- | --- | --- | --- | --- |
| card slot 0 | 部落的成长 | `polynesian_voyagers_growth_of_the_tribes` | hand/action | 是 | 行动牌；运行时 card atlas `rows=3, cols=4` |
| card slot 1 | 部落的知识 | `polynesian_voyagers_knowledge_of_the_tribes` | hand/action | 是 | 行动牌 |
| card slot 2 | 莫艾 | `polynesian_voyagers_moai` | minion/ongoing | 是 | 持续限制影响全局移动语义 |
| card slot 3 | 蒂基 | `polynesian_voyagers_tiki` | minion/ongoing | 是 | 持续力量修正 |
| card slot 4 | 寻路者 | `polynesian_voyagers_wayfinder` | minion/talent | 是 | 天赋移动并加指示物 |
| card slot 5 | 毛伊人 | `polynesian_voyagers_maui` | minion/onPlay/talent | 是 | 额外基地与移动 |
| card slot 6 | 海洋纹身 | `polynesian_voyagers_ocean_tattoo` | attached action/talent | 是 | 附着行动，目标为己方随从 |
| card slot 7 | 纹身艺术家 | `polynesian_voyagers_tattoo_artist` | action/search | 是 | 搜索牌库/弃牌堆行动 |
| card slot 8 | 部落的统一 | `polynesian_voyagers_unity_of_the_tribes` | action/temp power | 是 | 临时力量直到回合结束 |
| card slot 9 | 火山爆发 | `polynesian_voyagers_volcanic_uprising` | action/base manipulation | 是 | 额外基地/替换基地 |
| card slot 10 | 鲨鱼纹身 | `polynesian_voyagers_shark_tattoo` | attached action/ongoing | 是 | 附着行动，回合开始触发 |
| card slot 11 | 太阳纹身 | `polynesian_voyagers_sun_tattoo` | attached action/special | 是 | 普通打出与计分后特殊共享同一卡面 |
| base slot 8 | Island Chain | `base_island_chain` | base/afterScoring | 是 | 共享文化冲击基地 atlas |
| base slot 9 | Island Peak | `base_island_peak` | base/onTurnStart | 是 | 共享文化冲击基地 atlas |
| base slot 10 | Tropical Paradise | `base_tropical_paradise` | base/breakpoint modifier | 是 | 共享文化冲击基地 atlas |

## 对照表

| 对象 | 用户图面 | AEG 规则站 | 结论 |
| --- | --- | --- | --- |
| 牌组数量 | 12 个唯一卡面，按图面数量标识组合成 20 张牌 | 1/2/3/4 与 8 种行动的数量一致 | 一致 |
| 基地数量 | 用户图未提供基地卡牌 | AEG 规则站说明该派系有 3 张基地；仓库共享基地 atlas 已含 3 个对应槽位 | 使用仓库现有共享基地 atlas |
| 中文 faction 名 | 图上未出现 faction 总名 | 既有代码有 `波利尼西亚人`，英文 canonical 为 Polynesian Voyagers | UI 主名建议 `波利尼西亚航海者`，保留旧名作为兼容口径 |
| card atlas 行列 | 用户图可见 3 行 × 4 列 | 规则站列 12 个唯一卡面 | `rows=3, cols=4` |

## 冲突待裁定表

| 冲突对象 | 真相源结论 | 对照源 / 既有实现 | 当前处理 |
| --- | --- | --- | --- |
| faction 中文名 | 用户图未提供总名 | 既有 `SMASHUP_FACTION_IDS` 显示名为 `波利尼西亚人` | 采用 `波利尼西亚航海者` 作为新 evidence 和 locale 主名；代码兼容既有 ID，不重命名 faction id |

## Implementation Handoff

批准后按以下顺序实施：

1. 复制用户卡牌图集到正式路径，并压缩为运行时 WebP。
2. 新增 `polynesian_voyagers.ts` faction data，复用已存在 `POLYNESIAN_VOYAGERS_CARDS` 和 `POLYNESIAN_VOYAGERS_BASES`。
3. 在 `cards.ts`、locale、`factionMeta.ts`、critical image resolver 中增量注册。
4. 新增 `abilities/polynesian_voyagers.ts`，优先复用 `addPowerCounter`、`buildValidatedMoveEvents`、`buildSemanticOngoingAttachEvents`、`buildStandardDrawEvents`、`registerBaseAbility`、`registerBreakpointModifier`。
5. 莫艾必须进入全局移动语义拦截或 validator，不能只过滤本派系移动。
6. 太阳纹身必须走统一 afterScoring response window，并证明不是清场后复活。
7. 完成定向 Vitest、OpenSpec validation、资源上传回查、E2E 截图与 PR。
