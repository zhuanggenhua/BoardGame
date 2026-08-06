# 小黑屋基础主循环与玩家交互入口审计（2026-07-29）

> 本文件只聚合当前实现、测试和 evidence 中已经存在的基础主循环 / 玩家交互入口证据。它不重新 OCR、不回图包、不新增玩法实现，也不把代表链升级成完整端到端完成证明。

## 审计范围

本文件覆盖 `src/games/betrayal` 当前基础主循环和玩家可见入口：

- 开局设置、选人、剧本卡选择和木乃伊默认首剧本入口。
- 属性轨、移动力快照、移动、探索、房间朝向、探索失败边界和探索后结束回合。
- 事件 / 物品 / 预兆发现确认、房间文字效果确认和作祟风险 / 作祟揭示。
- 普通交易、狗远距交易、交易牌面禁用原因和特殊行动预算。
- 攻击、远程视线、伤害分配、死亡保护、尸体搜刮。
- 作祟后探索、叛徒跳过事件符号、怪物移动骰组、怪物移动、怪物攻击和击晕翻正代表入口。

本文件不覆盖 74 张牌逐效果完成、42 个房间逐效果完成、50 个作祟逐条完成、木乃伊横行自然全局 E2E 或图包 / 数据录入裁定。这些仍以各专项账本和 `full-deck-data-intake-contract.md` 为准。

## 结论等级

结论等级：`core-loop-interaction-indexed / mixed-e2e-representative-verified / downstream-open`。

含义：基础主循环已有大量真实入口 E2E、截图和领域 / Board 代表证据，足以说明当前实现不是只停在静态规则或配置层；但证据分布是“切片代表链”，不是所有规则分支、所有卡牌能力、所有房间、所有作祟和所有组合状态的 L3/L4 闭环。当前只能说主循环入口已经建账并可继续消费，不能说小黑屋实现完成。

## 权威来源

| 类型 | 当前来源 |
| --- | --- |
| 基础规则书 | `src/games/betrayal/rule/山屋惊魂小黑屋第三版规则汉化整理.md:105-120` 设置、`:216-238` 作祟检定和回合流程、`:240-317` 移动 / 探索 / 抽牌 / 交易 / 特殊行动、`:318-379` 作祟开始 / 攻击 / 武器、`:380-384` 视线、`:414-476` 作祟后流程 / 怪物 / 死亡。 |
| 对象合同 | `evidence/betrayal/full-audit/full-deck-data-intake-contract.md`、`object-inventory.json`、`object-l0-l4-matrix.md`。 |
| 领域实现 | `src/games/betrayal/game.ts` 的命令 payload、validator、execute、reducer 和 read model。 |
| 页面入口 | `src/games/betrayal/Board.tsx` 的主动作栏、地图 token、持有区、发现确认、交易流、伤害分配、怪物动作槽和作祟风险条。 |
| 自动测试 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts`、`Board.foundation.test.tsx`、`e2e/betrayal/*.e2e.ts`。 |
| 真实入口证据 | `evidence/betrayal-core-interactions/**/e2e-test.md`、`evidence/betrayal-basic-flow/betrayal-basic-flow-e2e-test.md`、攻击 / 怪物 / 灰尘 / 搜尸相关 evidence。 |

## 规则顺序到当前入口

| 规则顺序 | 当前正式局先暴露对象 | 动作层级 | 当前状态 |
| --- | --- | --- | --- |
| 选角色并设置属性轨 | 角色选择页、角色板、属性轨夹子 | 开局公共推进 | `scenario-card-selection` 和 `trait-track-ui` 已有真实入口 / 截图证据；不证明所有角色边界。 |
| 团队选择剧本卡 | 剧本卡弹窗、候选剧本卡、共同确认进度 | 开局公共推进 | 七张候选、木乃伊可开局、待接入剧本不能开始已有 E2E；当前规则书整理仍写“五张”，实现已按本轮合同七张候选执行，需由数据 / 规则合同继续统一。 |
| 回合开始锁移动力 | 右上移动 HUD、当前行动者 | 一级行动前状态 | `movement-snapshot` 证明回合中速度变化不回填本回合移动力，下个玩家重新锁定。 |
| 移动 | 底部“移动”入口、地图房间本体 | 一级行动 -> 目标选择 | 基本流程和移动力快照已有代表链；障碍物 2 点成本、强制移动等仍未完整闭合。 |
| 探索新房间 | 底部“探索”、未知门位、本次新房间朝向面板 | 一级行动 -> 放置确认 -> 发现确认 | 房间朝向、区域耗尽、不匹配掩埋、封死重抽、最小调整代表链已覆盖；不代表所有桌面极端调整方案。 |
| 抽事件 / 物品 / 预兆 | 发现确认浮层、卡牌正面、确认步数 | 后续确认 / 阻塞式结算 | 普通物品、器械库、6 个房间文字效果和事件 / 预兆专项已有证据；逐卡效果仍按卡牌专项继续。 |
| 作祟检定 | 作祟风险条、预兆总数、下次骰数、最后预兆提示 | 状态可见 / 阻塞结算 | 风险条和最后预兆自动作祟已有 E2E；完整作祟编号映射与 50 个作祟不在本文件收口。 |
| 交易 | 交易流程条、持有物牌面、队友 token、接收方同意按钮 | 一级行动 -> 多选 / 双方确认 | 普通多给、多拿、每回合一次、狗远距和禁用原因有代表链；拒绝交易、空交易、所有作祟限制仍未逐项闭合。 |
| 特殊行动 | 持有物 / 房间 / 作祟主动作入口、禁用短原因 | 一级行动 / 每来源预算 | 被动不能用、刚获得下回合可用、房间已用、作祟特殊行动已用有 E2E；所有特殊行动效果仍归物品 / 预兆 / 房间 / 作祟专项。 |
| 攻击 | 攻击按钮、武器条、目标 token、视线连线、骰盘 | 一级行动 -> 武器选择 / 徒手默认 -> 目标 -> 投骰 -> 伤害分配 | 武器禁用原因、枪 / 幻影摄影师视线、十字弓相邻攻击、匕首 / 指环 / 砍刀、徒手攻击和灰尘普通攻击代表链存在；徒手、砍刀、指环、匕首、十字弓和武器禁用原因已在当前树复跑并集中写回本账本。 |
| 伤害 / 死亡 | 伤害分配面板、属性轨预览、头骨死亡保护、终局 | 后续分配 / 死亡保护 / 终局 | 属性后果预览、灰尘普通攻击致死、灰尘冲动 + 头骨有真实入口证据；所有伤害来源 / 保护物品组合未闭合。 |
| 死亡后遗物 / 搜尸 | 尸体 token、尸体持有牌选择、搜尸禁用状态 | 作祟后后续行动 | 灰尘非叛徒搜尸有真实入口代表链；全部作祟尸体规则、永久叛徒掩埋和兔脚回滚组合未闭合。 |
| 怪物回合 | 怪物移动骰按钮、怪物 token、目标房间、攻击目标、击晕标记 | 作祟后怪物行动 | 普通怪物移动 / 攻击、多怪物同组、多类型移动骰、击晕翻正有代表链；逐作祟怪物覆写和全部怪物定义未完成。 |

## 当前屏幕可见可点对象盘点

| 当前对象 | 玩家第一眼可见性 | 真实语义 | 是否当前该点 |
| --- | --- | --- | --- |
| 剧本卡弹窗中的剧本卡 | 开局确认前可见 | 开局公共推进对象；只有 implemented 剧本可开始 | 选剧本阶段该点；运行时不作为动作入口。 |
| 右侧作祟风险条 | 主牌桌常驻可见 | 风险状态与预兆总数展示，不承接作祟检定点击 | 不该点；它是状态表达。 |
| 底部主动作按钮 | 当前行动者回合可见 | 一级行动入口：移动 / 探索 / 交易 / 使用 / 攻击 / 怪物动作 | 当前规则允许时该点。 |
| 地图房间本体 | 移动 / 探索 / 怪物移动态高亮 | 目标选择对象或探索方向 | 进入对应模式后该点；默认高亮不能当已确认。 |
| 探索者 / 怪物 token | 交易 / 攻击 / 怪物选择 / 搜尸态可高亮 | 目标玩家、怪物来源、尸体来源 | 对应模式内该点；提示横幅不是交互承接者。 |
| 持有物牌面 | 持有区、交易区、使用 / 攻击武器条可见 | 物品 / 预兆来源、交易对象、攻击武器 | 交易 / 使用 / 攻击武器选择时该点；被动 / 已用 / 刚获得时应保留禁用原因。 |
| 发现确认浮层 | 探索后阻塞显示 | 后续确认 / 阅读对象 | 发现结果未确认前该点；确认后才能回到行动收口。 |
| 剧本书入口 | 作祟揭示后和运行时可见 | 阅读层入口，不是作祟横幅内第二入口 | 需要读规则时该点；不应替代主动作。 |

## 正式进行页一级入口核对表

| 规则书一级动作 | 当前正式局入口 | 当前承接物 | 当前状态 |
| --- | --- | --- | --- |
| 移动 | 底部“移动”按钮 | 地图房间本体 | 代表性玩法已验证；障碍物、强制移动、特殊连接仍 downstream-open。 |
| 探索 | 底部“探索”按钮 | 未探索门位 + 放置面板 | 朝向与失败边界代表性玩法已验证；完整调整算法和所有房间符号组合仍 downstream-open。 |
| 交易 | 底部“交易”按钮 | 持有物牌面 + 目标 token + 接收方同意 | 普通 / 狗 / 禁用原因代表性玩法已验证；拒绝 / 空交易 / 作祟特例仍 downstream-open。 |
| 使用物品 / 预兆 / 房间 / 作祟特殊行动 | 底部“使用”或具体行动按钮 | 牌面 / 房间 / 作祟目标条 | 预算与部分来源代表性玩法已验证；逐效果仍归专项矩阵。 |
| 攻击 | 底部“攻击”或作祟主动作 | 武器条 + 目标 token + 骰盘 / 伤害分配 | 徒手 / 武器 / 枪或幻影摄影师视线 / 十字弓相邻攻击 / 灰尘攻击死亡代表链存在；全部伤害组合和每个作祟覆写未闭合。 |
| 结束回合 | 底部“结束回合” | 结束按钮 + 回合末骰盘 / 灰尘冲动 / 下一玩家交接 | 探索后只剩结束回合、移动力重锁、灰尘冲动代表链存在；所有房间回合末效果和作祟后交接组合未闭合。 |
| 怪物行动 | 怪物动作槽 | 怪物移动骰、怪物 token、目标房间 / 英雄 token | 普通怪物代表链存在；逐作祟怪物和专属 AI / 自然长链仍 downstream-open。 |

## 逐项结论

| 对象/链路 | 当前实现消费 | 证据等级 | 残余范围 |
| --- | --- | --- | --- |
| 开局剧本选择 | 七张候选、木乃伊默认可开局、待接入剧本禁开始、确认后进入牌桌。 | `L3 E2E representative` | 规则书整理的“五张”与当前合同七张需继续统一；不证明各剧本运行。 |
| 属性轨与属性后果 | 属性夹子位置、重复数值、伤害分配和治疗预览用属性轨表达。 | `L3 E2E representative` | 治疗 / 伤害所有来源组合未闭合。 |
| 移动力快照 | 回合开始按速度锁定；回合中速度变化不刷新；下一行动者重锁。 | `L2 + L3 E2E` | 障碍物成本、强制移动、特殊连接未完整覆盖。 |
| 探索朝向 | 玩家选择新房间方向，`orientationTurns` 进入领域状态。 | `L2 + L3 E2E` | 全部房间堆极端调整未闭合。 |
| 探索失败边界 | 区域耗尽不消耗移动力；不匹配 / 封死房间掩埋；最后死路房需最小调整。 | `L2 + L3 E2E representative` | 仍是代表算法和代表页面，不是所有现实桌面边界。 |
| 探索后结束回合 | 放置 / 发现确认后行动区只剩结束回合，点击后交给下一位。 | `L2 + L3 E2E` | 不证明所有房间文字 / 符号组合队列。 |
| 普通发现牌确认 | 普通物品符号单步确认，器械库三步确认，12 张普通物品矩阵可进入持有区。 | `L3 E2E representative + matrix slice` | 不证明全部 22 张物品能力、全部预兆和事件逐效果。 |
| 房间文字确认 | 礼拜堂、图书馆、书房、体育馆、储物间、杂物间进入房间效果确认队列。 | `L3 E2E matrix slice` | 只覆盖 6 个直接房间文字效果；房间专项仍列 11 个显式效果对象。 |
| 作祟风险 / 最后预兆 | 作祟风险条显示预兆总数、下次骰数、最后预兆自动作祟，并随作祟开始切状态。 | `L3 E2E` | 不证明全剧本卡 × 预兆映射。 |
| 作祟揭示 | 作祟横幅只显示短溯源，剧本书由常驻入口打开，关闭横幅后释放牌桌。 | `L3 E2E representative` | 不证明全部作祟定位、叛徒选择和平局 / 自愿替代规则。 |
| 作祟后探索与叛徒跳过事件 | 作祟后仍可探索；叛徒可在探索前声明跳过事件符号，未声明时事件正常结算；作祟后不再作祟检定。 | `L3 E2E representative` | 只覆盖事件符号跳过 / 正常事件两分支，不证明全部房间符号组合、全部作祟目标或完整怪物回合。 |
| 普通交易 | 多给、多拿、不等价、双方同意、每回合一次、下回合恢复有代表链。 | `L2 + L3 E2E` | 拒绝、空交易、全部作祟交易限制仍未闭合。 |
| 狗远距交易 | 狗 4 格内远距交易、多张给出、目标 token、接收方同意、状态清空。 | `L3 E2E representative` | 不证明狗所有边界和其它作祟远距交易特例。 |
| 交易禁用原因 | 已用牌、攻击武器、狗来源限制的牌面保留、禁用并显示原因。 | `L2 + L3 E2E` | 不证明所有特殊牌交易限制。 |
| 特殊行动预算 | 被动不能主动用、刚获得下回合可用、房间效果已用、作祟特殊行动已用均有短原因。 | `L2 + L3 E2E representative` | 每个特殊行动的实际效果仍归各对象专项。 |
| 攻击武器 / 徒手 / 远程视线 / 相邻武器 | 武器选择保留刚获得和已用禁用原因；无武器时不显示武器选择条，默认徒手攻击；枪和幻影摄影师承担视线连线代表链；十字弓目标态只高亮同板块 / 相邻板块目标，不画视线线。 | `L3 E2E representative` | 徒手、砍刀、指环、匕首、十字弓和武器禁用原因当前树已复跑并集中消费；全部武器组合、怪物目标、作祟攻击、全部伤害 / 死亡保护交叉仍未闭合。 |
| 伤害 / 死亡保护 | 伤害分配属性轨、灰尘普通攻击致死、灰尘冲动 + 头骨成功 / 失败代表链。 | `L2 + L3 E2E representative` | 所有伤害来源、保护物品、减伤和死亡后处理组合未闭合。 |
| 搜尸 | 灰尘非叛徒尸体保留遗物，同房存活探索者可选尸体和具体牌，本回合限制二次搜。 | `L3 E2E representative` | 全部作祟尸体规则和永久叛徒掩埋组合未闭合。 |
| 怪物移动 | 普通怪物路径预览、多怪物同组移动、多类型移动骰组和 token 目标高亮有代表链。 | `L2 + L3 E2E representative` | 逐作祟怪物覆写、所有怪物定义和完整自然怪物回合未闭合。 |
| 怪物攻击 / 击晕 | 普通怪物攻击可从动作槽到怪物 token、同房英雄 token、攻击骰盘；击晕怪物开回合翻正并跳过。 | `L3 E2E representative` | 专属怪物攻击、视线怪物、无法击晕 / 直接杀死等仍归作祟专项。 |
| 旧“作祟后禁探索”口径 | 旧目录 `evidence/山屋惊魂-haunt阶段禁探索/` 只有截图，且与当前规则整理、当前实现和 `haunt-after-explore` E2E 冲突；当前已降级为历史旧口径。 | `旧结论失效` | 当前以“作祟后仍可探索，且不再作祟检定”为准；完整作祟限制仍按逐作祟专项继续审。 |

## 验证证据

| 证据 | 当前证明 |
| --- | --- |
| `evidence/betrayal-core-interactions/scenario-card-selection/e2e-test.md` | 七张剧本卡、木乃伊可开局、待接入剧本不能开始。 |
| `evidence/betrayal-core-interactions/movement-snapshot/e2e-test.md` | 移动力快照和回合切换重锁。 |
| `evidence/betrayal-core-interactions/room-placement-orientation/e2e-test.md` | 房间朝向由玩家旋转确认。 |
| `evidence/betrayal-core-interactions/room-discovery-failures/e2e-test.md` | 区域耗尽、不匹配、封死重抽和最小调整代表链。 |
| `evidence/betrayal-core-interactions/discovery-end-turn/e2e-test.md` | 探索后发现确认阻塞，确认后只剩结束回合。 |
| `evidence/betrayal-core-interactions/haunt-risk-status/e2e-test.md` | 作祟风险条、最后预兆自动作祟提示和状态切换。 |
| `evidence/betrayal-core-interactions/haunt-reveal-protocol/e2e-test.md` | 作祟揭示短横幅、剧本书入口和关闭横幅后释放牌桌。 |
| `e2e/betrayal/haunt-after-explore.e2e.ts` + `evidence/山屋惊魂-作祟后探索与跳过事件完整链路/` | 作祟后仍可探索；叛徒可声明跳过事件符号；未声明时事件正常结算；两条分支关闭后仍停留恶兆后牌桌。 |
| `evidence/betrayal-core-interactions/special-action-budget/e2e-test.md`、`haunt-special-action-budget/e2e-test.md` | 持有物 / 房间 / 作祟特殊行动预算和禁用短原因。 |
| `evidence/betrayal-core-interactions/trade-multi-give/e2e-test.md`、`trade-turn-limit/e2e-test.md`、`trade-card-disabled-reasons/e2e-test.md`、`evidence/山屋惊魂-狗远距交易完整链路/e2e-test.md` | 普通交易多选、同意、每回合一次、狗远距和禁用原因。 |
| `evidence/betrayal-core-interactions/trait-track-ui/e2e-test.md`、`trait-outcome-preview/e2e-test.md` | 属性轨、重复数值夹子、伤害 / 治疗后果预览。 |
| `evidence/betrayal-basic-flow/betrayal-basic-flow-e2e-test.md` | 角色选择到木乃伊阅读入口、PC / 移动横屏书本阅读、基本移动 / 使用 / 持有物放大历史链。 |
| `evidence/betrayal-item-discovery-confirmation/e2e-test.md`、`betrayal-ordinary-item-discovery-confirmation/e2e-test.md`、`betrayal-room-effect-confirmation-matrix/e2e-test.md` | 发现牌确认和直接房间文字确认矩阵切片。 |
| `evidence/山屋惊魂-攻击武器禁用原因完整链路/e2e-test.md`、`evidence/山屋惊魂-十字弓相邻攻击完整链路/`、`evidence/山屋惊魂-幻影摄影师视线攻击完整链路/e2e-test.md`、`Board.foundation.test.tsx` 中枪视线 / 十字弓相邻组件断言 | 攻击武器可见性 / 禁用原因、十字弓相邻目标高亮且不画视线线、幻影摄影师视线目标态；旧 `evidence/山屋惊魂-弩远程视线完整链路/` 只保留为历史旧口径，不再作为当前十字弓规则证据。 |
| `e2e/betrayal/non-p0-representative.e2e.ts` 用例“无武器攻击真实链路” + `evidence/山屋惊魂-无武器攻击完整链路/` | 无武器时不显示武器选择器；进入攻击目标态后叛徒 token 可直点；攻击按 4 骰生成 physical damage；伤害先进入分配面板，玩家确认分配后目标物理属性下降并回到牌桌。 |
| `evidence/betrayal-the-dust-ordinary-attack-death/e2e-test.md`、`betrayal-the-dust-skull-death-prevention/e2e-test.md`、`betrayal-the-dust-non-traitor-corpse-loot/e2e-test.md` | 灰尘普通攻击致死、头骨死亡保护、非叛徒搜尸代表链。 |
| `evidence/山屋惊魂-普通怪物路径预览完整链路/e2e-test.md`、`普通怪物攻击完整链路/e2e-test.md`、`多怪物同组移动完整链路/e2e-test.md`、`多类型怪物移动骰组真实入口/e2e-test.md`、`怪物击晕翻正完整链路/e2e-test.md` | 普通怪物移动 / 攻击、多怪物移动、多类型移动骰组、击晕翻正。 |
| `src/games/betrayal/Board.tsx:9958`、`:10014`、`:10304`、`:10520`、`:10960`、`:11111`、`:11139`、`:11324`、`:11387`、`:11676`、`:11759` | Board 正式 dispatch 发现确认、回合末骰、移动、探索、伤害分配、交易、怪物移动、作祟攻击和怪物攻击命令。 |
| `src/games/betrayal/game.ts:14281-14866`、`:15667-16098`、`:16736-18034`、`:20907-21113` | 领域层 validate / execute / reducer 覆盖同一批主循环命令。 |

### 作祟后探索与跳过事件集中证据

| 项 | 本轮证据 |
| --- | --- |
| 当前裁定 | 旧“作祟后禁探索”口径失效；当前规则、实现和 E2E 均指向“作祟后仍可探索、不再作祟检定，叛徒可跳过事件符号”。 |
| 测试命令 | `node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/haunt-after-explore.e2e.ts` |
| 测试结果 | `2 passed`；shared-single runtime 端口复用失败后自动回退 isolated runtime，Playwright 最终通过。 |
| 静态检查 | `npx eslint e2e/betrayal/haunt-after-explore.e2e.ts src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 通过，0 errors。 |
| 关键截图 | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-作祟后探索与跳过事件完整链路\01-作祟后叛徒牌桌可探索.jpg`：恶兆后仍有“探索”入口和“跳过事件”按钮。 |
| 关键截图 | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-作祟后探索与跳过事件完整链路\04-跳过事件结果可见.jpg`：跳过事件分支显示“没有抽取或结算事件卡”。 |
| 关键截图 | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-作祟后探索与跳过事件完整链路\07-未选择跳过事件时正常结算.jpg`：未跳过时事件“阴影扑面”正常结算，力量 -1。 |
| 关键截图 | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-作祟后探索与跳过事件完整链路\08-正常事件关闭后仍停留作祟牌桌.jpg`：关闭后仍在恶兆后牌桌并进入结束回合。 |
| 不外推 | 只证明作祟后探索与事件符号跳过 / 正常事件两条代表分支；不证明全部阻塞式事件 UI、全部房间符号组合、全部作祟目标、完整怪物回合或整牌库逐卡完成。 |

### 徒手攻击集中证据

| 项 | 本轮证据 |
| --- | --- |
| 当前裁定 | 徒手 / 无武器攻击不是功能未实现；当前树已证明它走正式攻击入口、无武器选择器、4 骰攻击、physical damage、伤害分配和回牌桌收口。 |
| 测试语义修正 | 首次复跑失败暴露旧断言误把“攻击后待分配伤害”当成“属性已扣完的最终态”。本轮只修正 E2E 断言语义：先验证 `pendingDamageAllocation` 和伤害分配面板，再真实选择力量承受 2 点物理伤害并确认。 |
| 测试命令 | `node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/non-p0-representative.e2e.ts "无武器攻击真实链路"` |
| 测试结果 | 修正后 `1 passed`；运行器先提示 shared-single runtime 端口复用失败并自动回退 isolated runtime，Playwright 最终通过。 |
| 静态检查 | `npx eslint e2e/betrayal/non-p0-representative.e2e.ts` 通过，0 errors。 |
| 关键截图 | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-无武器攻击完整链路\03-叛徒目标高亮.jpg`：叛徒 token 进入五边形目标高亮，右侧没有武器选择条。 |
| 关键截图 | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-无武器攻击完整链路\04-无武器4骰攻击骰盘停稳.jpg`：攻击投骰结果后进入伤害分配；截图里骰盘被分配面板遮挡，只作为投骰后续阶段辅助证据，4 骰数量以 E2E `data-dice-count=4` 断言为准。 |
| 关键截图 | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-无武器攻击完整链路\05-物理伤害结算结果可见.jpg`：伤害分配面板显示“攻击 / 2 点物理伤害”，力量被选 2 次，确认按钮可用。 |
| 关键截图 | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-无武器攻击完整链路\06-无武器攻击后回牌桌继续可操作.jpg`：伤害分配关闭后回到恶兆后牌桌，动作栏和棋盘仍可操作。 |
| 不外推 | 只证明默认徒手攻击代表链；不证明匕首 / 指环 / 砍刀全组合、所有武器禁用组合、所有伤害来源、死亡保护、减伤、搜尸或全部作祟攻击覆写。 |

### 攻击武器代表链集中证据

| 项 | 本轮证据 |
| --- | --- |
| 当前裁定 | 旧“弩 / 十字弓视线攻击”口径失效；当前牌面合同和运行时代码均按“十字弓攻击同板块或相邻板块目标，失败不反伤”消费。远程视线代表链由枪和幻影摄影师承担。 |
| 规则 / 实现证据 | `full-deck-data-intake-contract.md` 第 I13 / I14 行明确枪走视线、十字弓走同板块 / 相邻；`game.ts` 中 `LINE_OF_SIGHT_ATTACK_WEAPON_CARD_IDS` 仅含枪，`ADJACENT_ROOM_ATTACK_WEAPON_CARD_IDS` 含十字弓；`Board.tsx` 只在选中枪时绘制武器视线 overlay。 |
| 十字弓 E2E | `node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/non-p0-representative.e2e.ts "十字弓相邻攻击代表链"` -> `1 passed`；第三张截图 `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-十字弓相邻攻击完整链路\03-十字弓相邻叛徒目标高亮且无视线连线.jpg` 已核图：相邻走廊叛徒 token 高亮，页面没有视线连线。 |
| 同桶复跑 | `无武器攻击真实链路`、`砍刀攻击武器代表链`、`指环神志攻击真实链路`、`匕首攻击真实链路`、`攻击武器禁用原因真实链路` 均通过 `run-e2e-single.mjs ci e2e/betrayal/non-p0-representative.e2e.ts` 定向复跑，各 `1 passed`。 |
| 静态检查 | `npx eslint e2e/betrayal/non-p0-representative.e2e.ts src/games/betrayal/testing/firstScenarioTestUtils.ts src/games/betrayal/game.ts` -> `0 errors`；`game.ts` 仍有既存 unused warnings，未作为本轮规则修复范围。 |
| 旧测试失效 | 旧目录 `evidence/山屋惊魂-弩远程视线完整链路/` 和旧 E2E 名称只证明历史误口径曾跑通；当前不能再说“十字弓视线实现好了”。 |
| 不外推 | 这些只证明攻击武器代表链和禁用原因代表链；不证明所有武器互斥排列、怪物目标、作祟覆写、死亡保护、减伤、搜尸或全攻击组合完成。 |

## 测试语义对账

| 证据桶 | 测试断言证明的最终状态 | 不能外推的事项 |
| --- | --- | --- |
| E2E 截图链 | 从真实 `/play/betrayal` 或带 harness 的正式页面入口点击，能看到入口、目标、确认、结果反馈和部分最终状态。 | 不证明未进入截图链的其它分支、全部卡牌、全部房间和全部作祟。 |
| 领域测试 | 命令执行后移动力、房间状态、持有物、交易、伤害、死亡、怪物移动和终局状态真实变化。 | 不能替代真实页面可见入口和点击路径。 |
| Board 组件测试 | 特定夹具下按钮 / 面板 / 禁用原因 / dispatch payload 与读模型对齐。 | 不能替代自然长链 E2E，也不能证明所有负向路径。 |
| 截图产物未被总账消费 | 只能证明当前工作区有截图产物。 | 未在主审计账本或专项审计中写清验证命令、自动断言、图面核验和边界声明时，不升成已建账 L3 证据；这不是功能未实现结论。 |
| 代表链 | 能说明某个 family 的典型入口和最终状态成立。 | 只有触发时机、候选生成、payload、handler、最终权威状态完全判等时才能外推；本文件不做全量判等。 |

## 命中 D 维度

| 维度 | 本文件中的命中点 |
| --- | --- |
| D1 语义保真 | 主循环必须按规则顺序表达：移动力快照、探索结束回合、交易双方同意、武器限制、怪物击晕和死亡条件不能被 UI 简化改写。 |
| D3 数据流闭环 | 规则文档、命令 payload、validator、execute、reducer、Board 入口、测试和 evidence 必须逐入口闭环。 |
| D5 交互完整 | 移动、探索、交易、特殊行动、攻击、伤害分配、搜尸和怪物行动都是玩家决策点；必须有真实可见入口。 |
| D7 资源守恒 | 移动力、特殊行动预算、交易额度、武器已用、房间效果已用和搜尸每回合限制需要写入并消费同一状态。 |
| D8 时序正确 | 探索先房间朝向再发现确认再结束回合；攻击先目标 / 投骰再伤害分配 / 死亡保护；怪物先移动骰组再移动 / 攻击。 |
| D12 写入-消耗对称 | `turnStartSpeed`、`movesRemaining`、`pendingTradeAgreement`、`pendingDamageAllocation`、`usedCardIdsThisTurn`、怪物移动额度必须由 UI 和领域同源消费。 |
| D15 UI 状态同步 | 主动作按钮、禁用原因、进度条、属性轨和目标高亮必须与当前 core 状态一致。 |
| D18 否定路径 | 待接入剧本不能开局、区域耗尽不消耗移动力、不可交易牌不消失但禁用、刚获得武器不能攻击、击晕怪物不继续行动。 |
| D20 状态可观测性 | 作祟风险、特殊行动已用、交易禁用、移动力快照、属性轨预览和怪物击晕必须能被玩家看懂。 |
| D34 UI 渲染模式 | 作祟揭示横幅、发现确认、交易卡牌、武器条和怪物动作槽要保持各自交互模式，不能把提示层当主入口。 |
| D35/D36 延迟交互 | 发现确认队列、交易同意、伤害分配、死亡保护、攻击奖励和怪物移动骰都属于分段收口链。 |
| D55 多消费者一致性 | 同一合法动作需要 validator、Board 高亮 / 禁用、AI / 自动推进和 reducer 共同消费；代表链不能只打一层。 |

## 共享根因与残余范围

共享根因：旧材料容易把“真实入口 E2E 存在”理解成“全规则完成”。主循环证据实际是按规则切片分散建立的：有些切片有完整 E2E 说明文档，有些只有图片目录，有些是领域或 Board 代表链。若不分层，就会把移动 / 探索 / 交易 / 攻击 / 怪物的代表链外推到未覆盖的卡牌、房间和作祟分支。

残余范围：

- 仍缺完整“木乃伊横行自然长链”从开局到中段目标再到终局的真实入口 E2E。
- 仍缺 74 张牌逐效果 UI / 组合 / E2E 闭环；事件、物品、预兆已有专项但均为 downstream-open。
- 仍缺 42 房间逐效果全部真实入口；房间专项只锁 11 个显式效果对象和部分代表链。
- 仍缺完整怪物系统全排列：逐作祟专属移动 / 攻击覆写、无法击晕 / 直接死亡、特殊目标规则。
- 作祟后探索与叛徒事件符号两分支已有正式 E2E 证据；仍缺全部作祟限制、全部房间符号组合和完整阻塞式事件 UI 的逐项闭环。
- 徒手、砍刀、指环、匕首、十字弓和武器禁用原因代表链已有当前树正式 E2E 证据；枪 / 幻影摄影师承担视线代表链，旧十字弓视线证据已降级为历史旧口径；仍缺多条攻击 / 死亡组合矩阵：武器互斥全排列、怪物目标、作祟攻击、胸针、盔甲、头戴耳机、奇异护符、头骨、兔脚、死亡后搜尸、作祟终局交叉。

## 同类扩审记录

| 项 | 本轮实际范围 |
| --- | --- |
| 搜索范围 | `src/games/betrayal/rule/山屋惊魂小黑屋第三版规则汉化整理.md`、`game.ts`、`Board.tsx`、`evidence/betrayal-core-interactions/**`、`evidence/betrayal-basic-flow/**`、攻击 / 怪物 / 灰尘 / 搜尸 evidence。 |
| 根因关键词 | `MOVE_TO_ROOM`、`EXPLORE_ROOM`、`ACKNOWLEDGE_CARD_RESOLUTION`、`TRADE_POSSESSION`、`RESOLVE_TRADE_AGREEMENT`、`RESOLVE_DAMAGE_ALLOCATION`、`HAUNT_ATTACK`、`ROLL_MONSTER_MOVEMENT_GROUP`、`MOVE_MONSTER_TO_ROOM`、`MONSTER_ATTACK_HERO`、`LOOT_CORPSE`、`progressbar`。 |
| 横向命中 | 开局、移动、探索、发现确认、作祟风险、交易、特殊行动、攻击、伤害、搜尸、怪物行动均有入口证据；证据层级不一致。 |
| 漏审归因 | 旧 summary 把若干不存在的 `e2e-test.md` 路径当候选线索；当前工作区实际读取后，图片-only 目录已降级。旧“作祟后禁探索”口径已被当前规则整理和 E2E 推翻；旧“弩 / 十字弓视线”口径也被当前物品合同、运行时代码和复跑 E2E 推翻，不能继续作为当前事实。 |
| 当前裁定 | 可以继续按本账本往 downstream-open 队列补证；当前不能给“基础主循环全面完成”口径。 |

## 修订记录

| 项 | 结论 |
| --- | --- |
| 旧总入口风险 | `runtime-implementation-consumption-audit-2026-07-29.md` 已列基础机制，但缺一张把主循环入口、规则顺序、可点对象、证据层级和残余范围合并的专项表。 |
| 本轮修订 | 新增本文件，把开局、移动、探索、发现确认、作祟、交易、特殊行动、攻击、伤害、搜尸和怪物行动统一分层建账。 |
| 旧结论失效 | 旧“作祟后禁探索”只保留为历史截图口径；当前替代证据已集中写入本文件“作祟后探索与跳过事件集中证据”，命中 D1/D5/D8/D15/D18，结论改为“作祟后仍可探索、不再作祟检定，叛徒可跳过事件符号”。 |
| 本轮补检 | 徒手攻击从“截图候选 / 待总账消费”升级为“当前树 L3 代表链已验证”；同时记录旧 E2E 断言语义失效：攻击后先进入伤害分配，不应在确认分配前断言目标属性已下降。 |
| 本轮补检 | 攻击武器代表链从旧“十字弓视线”改为当前“枪 / 幻影摄影师视线 + 十字弓相邻”口径；徒手、砍刀、指环、匕首、十字弓和武器禁用原因已完成当前树定向复跑，但仍只算代表链。 |
| 自检结果 | `npm run audit:evidence:selfcheck -- evidence/betrayal/full-audit/core-loop-player-interaction-audit-2026-07-29.md evidence/betrayal/full-audit/mummy-rampage-midgame-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/event-effect-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/item-effect-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/omen-and-haunt-rule-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/room-effect-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/runtime-implementation-consumption-audit-2026-07-29.md evidence/betrayal/full-audit/full-deck-data-intake-contract.md evidence/betrayal/full-audit/object-l0-l4-matrix.md` 通过；检查 9 个审计文档，结果 OK。 |
| 当前状态 | `core-loop-interaction-indexed / mixed-e2e-representative-verified / downstream-open`，不是完成。 |
