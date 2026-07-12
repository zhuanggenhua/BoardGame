# 山屋惊魂 Mods 反推与实现缺口矩阵

> 生成时间：2026-07-12  
> 目标：回答“脚本还有什么要反推实现、能否准备全部实现”。

## 结论

- TTS Lua 脚本仍然不是第一剧本自动结算真相源：已抽出的 31 个 Lua 文件主要覆盖骰子计算器、单骰重投、骰子归位、桌柜/桌面开合；未命中第一剧本、杰克之灵、驱魔、法阵或作祟自动结算。
- 第一剧本最小闭环已经成立：英雄线、叛徒线、杰克之灵 Speed 3 怪物移动骰、回尸体复活、复活后攻击、搜尸限制、持有物主动/被动/特殊触发摘要和核心参考页都有规则测试或真实页面证据。
- 现在还能反推并值得实现的不是“脚本自动结算”，而是三类：官方 PDF/参考卡资源接入、房间停留/结束回合效果补全、发现牌/物品/预兆边界效果补全。

## Mods 可反推项

| 类别 | Mods 证据 | 当前判断 | 实现动作 |
| --- | --- | --- | --- |
| Lua 自动结算 | scriptCount=31，Lua 文件 31 个 | 只发现骰子和桌面辅助，未发现首剧本规则引擎 | 不按 Lua 重构规则；只借鉴骰盘交互 |
| PDF/剧本书 | pdfLikeCount=18 是字段计数；实际为 9 个 CustomPDF 对象，其中 ObjectStates/163 与 166 共用 URL | 资源入口存在，但 TTS PDF 不是自动结算代码；当前剧本详情层是代码内书本式正文 | 先识别 PDF 用途，不立刻用 PDF/模型替代剧本详情层 |
| 骰子 UI | Betrayal Dice Calculator 支持 1-8 骰、单骰重投、Reset | 当前已有骰盘与兔脚重投；可继续核对通用检定重投体验 | 只补缺失的骰盘交互，不影响规则闭环 |
| 桌面收纳/模型 | Board Cabinet、Table Extension | 属于 TTS 桌面组织，不是网页规则真相源 | 只作为 UI 参考，不优先实现 |

## 当前实现覆盖

| 模块 | 覆盖状态 |
| --- | --- |
| 官方资源 manifest | official total=120，cards=26，rooms=0，explorers=26，monsters=6，markers=56 |
| 中文资源 manifest | zh-CN total=152，cards=30，rooms=16，explorers=26，monsters=6，markers=56 |
| 房间发现效果 | drawUntilWeapon, gainKnowledge1, gainMight1, gainSanity1, gainSpeed1, placeObstacleToken |
| 房间结束回合/停留效果 | moveToBasementLanding, physicalDamage1, speedCheckFallToBasement |
| 房间主动/进入效果 | mysticElevator |
| 发现牌效果模式 | allTraitChecks, chooseTraitRoll, chosenTrait, compound, drawPossession, generalDamage, generalDamageChoice, healChosenTrait, move, none, optionalEventRoll, optionalHauntRoll, placeExplorerInAdjacentRoom, placeExplorerInDiscoveredRoomByFloor, placeExplorerInDiscoveredRoomByVisualId, placeExplorerInFloorStartingRoom, placeExplorerInRoom, placeObstacleToken, placeSecretPassageToken, rolledDamage, trait；秘密通道标志物已接入真实移动连接 |
| 持有物主动效果 | 书本、急救包、奇怪的药品、地图/笔记/手稿、面具 |
| 持有物被动/特殊触发 | 头骨、狗、圣符、雕像、魔法相机、手电筒/提灯、盔甲、头戴耳机、骨制钥匙、砍刀、匕首、指环、兔脚 |

## PDF/剧本书审计补充

- `workshop-summary.json` 的 `pdfLikeCount=18` 不是 18 份 PDF，而是 9 个 `PDFUrl` + 9 个 `PDFPassword` 字段；实际 CustomPDF 对象路径为 `ObjectStates/9/ContainedObjects/0`、`ObjectStates/161`、`162`、`163`、`164`、`165`、`166`、`170`、`171`。
- `ObjectStates/9/ContainedObjects/0` 位于 `Secrets of Survival` 的袋子里，能确认是官方参考/规则书类资源；其余 8 个 PDF 对象没有可读 nickname/description，需要下载或 OCR 后再判定用途。
- `ObjectStates/163` 与 `ObjectStates/166` URL 完全相同，所以去重后只有 8 个不同 PDF URL。
- 当前实现已经接入玩家参考正反面、叛徒参考、怪物参考图片；剧本详情层是代码内书本式正文，不是 TTS PDF 原图或模型。
- `cards/reference-blue-moonlit-howl-zh` 已在资源 manifest，但看起来是另一张作祟/参考页，不应误接到《赤红杰克归来》。
- 当前结论：PDF/模型可以作为后续原文核对来源，不适合现在直接替代剧本详情层；若要替换，必须先证明 PDF 内容就是首剧本对应页，并且可读性优于现有书本式正文。

## 仍需补齐的实现清单

1. **房间停留/结束回合效果完整化**：当前已定义并接入 physicalDamage1、speedCheckFallToBasement、moveToBasementLanding、mysticElevator；已补玩家可见提示、结束回合前预告、效果后反馈和组件测试覆盖，覆盖火炉房、倒塌房间、洗衣滑槽。
2. **PDF/参考页接入审计**：Mods 有 18 条 PDF 线索，本地已有玩家参考、叛徒参考、怪物参考等素材；需要把 PDF/参考页用途、页面入口和真实素材一一对照，避免 UI 只显示摘要。
3. **发现牌 23 张边界验收**：事件牌已录入 23 张并有多种效果模式；领域层 23 张均有覆盖，真实页面层已覆盖待选事件，并新增普通投骰事件牌的牌面 + 骰盘 + 分支结果同屏承接测试；“一条秘密通道”已从放置标志物补齐为两个秘密通道标志物之间可真实移动。
4. **物品/预兆能力完整化**：主动使用、被动加值、伤害减免、死亡保护、武器、探索声明、兔脚重投和“说茄子！”相机归属已有实现；仍需要继续逐张对照官方原文，确认未录入的边界文案和图面裁定。
5. **资源模型不是首批 blocker**：TTS 模型/收纳/桌柜更像桌面体验参考；除杰克之灵、探索者、标志物这类已经影响主视图识别的素材外，不应先重构 UI。

## 首批可直接实现

- A1：房间停留/结束回合效果的玩家可见提示与组件测试已完成，包括火炉房、倒塌房间、洗衣滑槽。
- A2：参考页/PDF 资源审计已补充，确认 TTS 有 PDF 资源但不提供首剧本自动结算，也不应立刻替代当前剧本详情层。
- A3：发现牌边界 UI 验收已通过；复杂待选事件已覆盖“秘密通道、蜘蛛、上古旧宅、说茄子”等，普通投骰事件已补统一页面承接测试，并通过 `Board.foundation.test.tsx` 定向验证；秘密通道标志物已补为真实移动连接，并通过 `firstScenarioRuntime.test.ts` 定向验证。

## 不建议做的事

- 不建议用 TTS Lua 重写当前规则引擎，因为 Lua 没有首剧本自动结算逻辑。
- 不建议为了“模型更像 TTS”重构主 UI；当前优先级应是规则可玩闭环和真实页面证据。
- 不建议把第一剧本最小闭环扩大宣称为山屋整游戏完成；还缺完整房间、发现牌、物品/预兆和更多剧本验收。
