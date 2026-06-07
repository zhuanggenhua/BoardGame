# Smash Up 葫芦娃 PR 交付合同

日期：2026-05-25

## 范围与真相源

- 派系：`huluwawa` / 葫芦娃，首版仅在 `zh-CN` 派系选择界面可见；英文界面隐藏，仅保留英文 `name` 以满足全局 i18n 合同。
- 素材源：`D:/新建文件夹/huluwawa-minions-actions-atlas.png`、`D:/新建文件夹/huluwawa-bases-atlas.png`、`D:/新建文件夹/葫芦小金刚.png`。最终交付证据以仓库 manifest、资源上传/回查、测试和截图为准，不能引用本地路径冒充可交付资源。
- 资源入口：`SMASHUP_ATLAS_IDS.HULUWAWA_CARDS`、`HULUWAWA_BASES`、`HULUWAWA_TITAN`；运行时经 `atlasCatalog.ts`、`previewRef` 和 `runtimeCriticalImageResolver` 自动解析。

## 卡牌合同

| 对象 | C1 规则子句 | C2 实现入口 | C3 测试/证据 |
| --- | --- | --- | --- |
| 大娃 | 天赋使自身 +2 力量直到回合结束 | `huluwawaDaWaTalent` / `TEMP_POWER_ADDED` | `huluwawa.test.ts` 覆盖真实天赋入口、力量修正与 talentUsed |
| 二娃 | 展示牌库顶 3 张；可额外打出其中 1 张；其余牌任意顺序放回牌库顶和/或牌库底；每回合一次 | `huluwawaErWaTalent`、`huluwawaErWaPromptProgram`、`huluwawaErWaReorderProgram` | `huluwawa.test.ts` 覆盖选择并额外打出、跳过后顶/底重排；E2E 覆盖真实点击天赋入口 |
| 三娃 | 不可被其他玩家摧毁；离场时可洗回牌库替代弃牌 | `huluwawaSanWaProtection`、`huluwawaSanWaReplacement` | `huluwawa.test.ts` 覆盖其他玩家摧毁保护与弃牌替代洗回 |
| 四娃 | 打出后可摧毁这里力量 3 或更小仆从，并获得 +1 指示物 | `huluwawaSiWaOnPlay`、`huluwawaDestroyForCounterProgram` | `huluwawa.test.ts` 覆盖打出、prompt、选择、摧毁和 +1 指示物 |
| 五娃 | 其他玩家不能移动这个基地的仆从；天赋移动另一个基地力量 3 或更小仆从到这里 | `huluwawaWuWaRestriction`、`huluwawaWuWaTalent` | `huluwawa.test.ts` 覆盖天赋 prompt 与移动成功路径 |
| 六娃 | 天赋将自身初始力量临时改为 0，直到下个己方回合开始；计分前可取消 | `huluwawaLiuWaTalent`、`huluwawa_liu_wa_before_scoring` handler | `huluwawa.test.ts` 覆盖取消后移除 timed modifier 并恢复力量 |
| 七娃 | 天赋从牌库搜 1 张行动入手，若搜牌库则重洗；有附着行动时回合结束额外抽牌 | `huluwawaQiWaTalent`、`huluwawaSearchCardProgram`、`huluwawaQiWaTurnEnd` | `huluwawa.test.ts` 覆盖搜牌库后重洗剩余牌库 |
| 一根藤上七朵花 | 弃牌堆不同名仆从各 1 张洗回牌库 | `huluwawaOneVineSevenFlowers` | `huluwawa.test.ts` 覆盖不同名各取一张、重复名保留 |
| 紫金宝葫芦 | 附着到己方仆从；天赋二选一：移动小仆从到这里，或弃牌堆行动放牌库底；七娃在场可弃牌堆额外打出到其身上 | `huluwawaPurpleGoldGourdTalent`、`huluwawa_purple_gold_gourd_bottom` handler、discard action provider（目标族=随从） | `huluwawa.test.ts` 覆盖弃牌堆行动放牌库底 handler |
| 人多力量大 | 选择基地，己方每个仆从 +1 到回合结束 | `huluwawaStrengthInNumbers` | `huluwawa.test.ts` 覆盖目标基地己方临时 +1，敌方不变 |
| 妖精哪里逃 | 摧毁力量 3 或更小仆从，或移动一个仆从 | `huluwawaWhereDoYouThinkYoureGoing` | `huluwawa.test.ts` 覆盖分支 prompt 与摧毁小仆从路径 |
| 玉如意 | 从牌库/弃牌堆搜 1 张入手；若搜牌库则重洗；可额外打出行动 | `huluwawaJadeRuyi`、`huluwawaSearchCardProgram` | 搜牌库重洗逻辑与七娃共用测试覆盖 |
| 毫无存在感 | 附着仆从；计分后仆从洗回牌库替代弃牌 | `huluwawaNoPresenceReplacement` | `huluwawa.test.ts` 覆盖弃牌替代洗回 |
| 穿山甲 | 附着基地；天赋移动己方仆从进出该基地 | `huluwawaPangolinTalent` | 与五娃共用移动 prompt 程序；逐卡合同保留在实现入口，后续若 UI 入口变化需补 E2E |
| 一个一个来 | 附着基地；返回这里一个仆从，其拥有者可立即打出不同名仆从到这里 | `huluwawaOneAtATimeTalent`、`huluwawaOneAtATimePlayProgram` | `huluwawa.test.ts` 覆盖返回目标、对方 prompt、不同名仆从额外打出 |
| 碰！（葫芦裂开） | 摸 2 张牌 | `huluwawaPop` | `huluwawa.test.ts` 覆盖摸 2 张 |
| 快放了我爷爷！ | 本回合额外 2 行动；此牌放牌库底替代弃牌 | `huluwawaReleaseMyGrandpa` | `huluwawa.test.ts` 覆盖 2 个 extra action 事件与自身回牌库底 |
| 蝴蝶妹妹的帮助 | 附着仆从；摧毁附着行动替代仆从被摧毁；从场上进弃牌后抽 1 | `huluwawaButterflyProtection`、`huluwawaButterflyDrawOnDetach` | `huluwawa.test.ts` 覆盖摧毁替代 detach；抽牌入口沿相同 trigger 注册 |

## 基地与泰坦合同

| 对象 | C1 规则子句 | C2 实现入口 | C3 测试/证据 |
| --- | --- | --- | --- |
| 葫芦山 | 这里印刷力量 4 或更高仆从不受其他玩家能力影响 | `huluwawaBaseMountainProtection` | `huluwawa-bases.test.ts` 覆盖其他玩家保护与自己不保护 |
| 七彩莲蓬 | 每回合一次，在你打出一个仆从到这里后，可额外打出一个相同印刷力量仆从到这里 | `base_seven_colored_lotus` base ability + handler | `huluwawa-bases.test.ts` 覆盖 prompt、选择、权威状态改变、interaction 清空；E2E 覆盖真实打出入口与本回合一次限制 |
| 葫芦小金刚 | 可代替通常随从打到空基地；泰坦对决失败改移动；每玩家每回合一次，在你的仆从发动主动能力后，另一个仆从可复制相同主动能力 | `huluwawaLittleKingKongSpecial`、`huluwawa_little_king_kong_clash`、`huluwawa_little_king_kong_copy_talent` | 当前首版覆盖现有 minion talent 复制，不覆盖尚不存在的非 talent 手动仆从入口 |

## 残余风险

- 葫芦小金刚复制范围按当前引擎已有的仆从 `talent` 主动入口落地；若后续新增仆从 `ongoingActivation` 或 clickable special，需要在同一合同中追加 C1/C2/C3。
- 穿山甲首版已复用同一套移动 prompt 程序；当前单测覆盖同类移动程序的成功路径，若未来它的目标规则或 UI 入口独立变化，需要新增穿山甲专属 E2E。
- 本地 `pretty_pretty.webp` 与远端仍有非本轮差异；本轮没有上传该文件，也没有把它写入 PR diff。
