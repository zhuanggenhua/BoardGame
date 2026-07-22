# 召唤师战争冰苔兽人对象级全面审计

- 日期：2026-07-18
- 对象：冰苔兽人（`shouren`）预构筑派系
- 实施现场：`D:\gongzuo\webgame\BoardGame` 根目录 `main`
- 文档类型：`audit`
- 关联变更：`openspec/changes/add-summonerwars-shouren-faction`
- 结论等级：`当前发布口径已收口`

## 全面审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象全集 | passed | 15 个运行时对象和 16 个图集槽位已全部列表 |
| 规则子句表 | passed | 本文“逐对象规则子句与实现”逐项登记 C1-C11 |
| 完整技能流程矩阵 | passed | 本文按定义、候选、命令、消耗、主效果、分支和清理登记 |
| L0-L4 证据层级 | passed | 15/15 对象均有层级裁定；自动被动明确 L3 N/A 理由 |
| 命中 D 维度 | passed | D1-D57 及 D35.1/D50.1 已逐项裁定 |
| 真实入口 E2E 与截图核验 | passed | 完整 8/8 E2E 通过；血腥急袭同位点复拍 1/1 通过；11 张最终原图已逐张人工核验 |
| 分支/可选/数量边界 | passed | 激励保留/重掷；四类位置交互执行/跳过；冻结合法/非法目标均有证据 |
| 阶段/生命周期收口 | passed | 攻击待结算状态、`sys.interaction.current` 和额外攻击额度均有最终状态断言 |
| 残余范围声明 | passed | 当前对象级范围无已知残余；本文明确不外推到其它派系或生产前端部署 |
| 旧 evidence / 旧结论对账回写 | passed | 旧 intake 只是当时录入快照，未曾声称完成；无需失效回写 |

## 审计范围

- 覆盖：派系选择、30 张预构筑牌组、起始坐标、图集、关键图片预加载、中英文文案、资源发布、Android 索引、所有冰苔兽人规则子句、玩家可见交互和收口状态。
- 必要共享链：`execute.ts`攻击结算、`systems.ts`交互创建/响应、`helpers.ts`合法性查询、`abilityResolver.ts`动态能力/战力、`useEventCardModes.ts`打牌入口、`systemInteractionAdapter.ts`/`StatusBanners.tsx`位置交互 UI。
- 不在范围：其它派系的全量重审、整个召唤师战争所有 E2E、生产前端部署。

## 权威来源与图片合同

- 主真相源：`public/assets/i18n/zh-CN/summonerwars/hero/shouren/cards.jpg` 、`hero.png`、`tip.jpg`。
- 录入合同：`evidence/summonerwars/summonerwars-shouren-intake-2026-07-18.md`。
- 原图 SHA256：`cards.jpg=4B945F...74F14`，`hero.png=F6ADB0...297D7`，`tip.jpg=E27B23...11B9`；完整值见 intake。
- 裁定：完整单卡负责名称与规则，提示板只负责起始位置；因此使用“冰苔斗士/冰霜萨满/无上荣耀”。

| visualRegion / slotId | 图上对象 | 运行时对象 | 允许状态 | 可交互 | 结论 |
| --- | --- | --- | --- | --- | --- |
| `hero` | 格鲁纳克 | `shouren-summoner` | 召唤师 | 是 | 一致 |
| `cards:0-2` | 拉格诺/塔甘/雄科 | 三张英雄 | 英雄单位 | 是 | 一致 |
| `cards:3-6` | 冰霜萨满/粉碎者/冰苔冲锋者/冰苔斗士 | 四张士兵 | 士兵单位 | 是 | 一致 |
| `cards:7-10` | 冻结/粗暴蛮力/原始狂怒/无上荣耀 | 四张持续事件 | active event | 是 | 一致 |
| `cards:11-15` | 空白 | 无 | empty/display-only | 否 | 一致 |
| `tip` | 召唤师、两起始单位、城门坐标 | `createShourenDeck()` | 起始配置 | 否 | 一致 |

## 对象全集与 L0-L4 层级

| 对象 | 类型 | L0 | L1 | L2 | L3 | L4 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 格鲁纳克 | 召唤师：恢复+激励 | passed | passed | passed | direct：开局+激励保留/重掷 | passed | passed |
| 拉格诺 | 英雄：鲜血羁绊 | passed | passed | passed | N/A：攻击后自动被动，无新交互 | passed：最终召唤师充能 | passed |
| 塔甘 | 英雄：远射+刺骨冰霜 | passed | passed | passed | N/A：共享攻击入口，无新交互壳 | passed：合法目标+有效战力 | passed |
| 雄科 | 英雄：狂乱打击 | passed | passed | passed | N/A：自动命中替换 | passed：最终伤害 | passed |
| 冰霜萨满 | 士兵：北方魔法 | passed | passed | passed | N/A：自动伤害门控 | passed：零特殊标记不伤害 | passed |
| 粉碎者 | 士兵：迟钝 | passed | passed | passed | N/A：被攻击后自动伤害 | passed：额外伤害 | passed |
| 冰苔冲锋者 | 士兵：血腥急袭 | passed | passed | passed | direct：真实召唤后位移/跳过 | passed | passed |
| 冰苔斗士 | 士兵：狂暴 | passed | passed | passed | direct：攻击后位移/跳过 | passed：额外攻击后再次按“每次攻击后”掷狂暴骰 | passed |
| 冻结 | 普通事件 | passed | passed | passed | direct：手牌打出、目标高亮、附着 | passed：持续限制/离场恢复 | passed |
| 粗暴蛮力 | 普通事件：蛮力冲击 | passed | passed | passed | direct：造成伤害后推拉/跳过 | passed：远离方向+离场移除 | passed |
| 原始狂怒 | 普通事件 | passed | passed | passed | direct：召唤师攻击后 1-2 格/跳过 | passed：额外攻击不递归 | passed |
| 无上荣耀 | 传奇事件：鲁莽打击 | passed | passed | passed | N/A：动态授予+攻击后自动自伤 | passed：0/1/>1 特殊标记分支 | passed |
| 起始城门 | 建筑 | passed | passed | passed | direct：真实开局坐标 | passed | passed |
| 传送门 | 建筑 | passed | passed | passed：牌组数量/建造共享合同 | reused：标准城门建造链 | passed | passed |

## 逐对象规则子句与实现

| 对象 | 规则子句 | 实现入口 | 最终状态/负向断言 | 维度 |
| --- | --- | --- | --- | --- |
| 格鲁纳克・恢复 | C1 移动后；C2 仅未充能；C3 自身+1充能 | `execute.ts` `MOVE_UNIT` | 已充能时不重复加 | D1 D2 D8 D18 D21 |
| 格鲁纳克・激励 | C1 己方回合；C2 3格内友方；C3 攻击/技能骰；C4 可保留；C5 重掷耗1充能；C6 重掷全部；C7 最终骰面结算 | `types.ts` 攻击待结算状态；`execute.ts` 攻击掷骰待结算/继续结算分支；`systems.ts` | 响应前无伤害/无攻击次数消耗；保留不扣充能；重掷只结算一次 | D5 D7 D8 D9 D12 D15 D18 D39 D47 D50 D54 D55 |
| 拉格诺・鲜血羁绊 | C1 攻击敌方单位后；C2 统计特殊标记；C3 召唤师等量充能 | `execute.ts` 攻击后处理 | 不会给其它对象充能 | D1 D3 D6 D8 D18 D26 |
| 塔甘・远射 | C1 直线视野；C2 最大4格 | `helpers.ts` 攻击合法性 + `ranged` | 4格可攻击，5格拒绝 | D1 D2 D4 D23 D33 |
| 塔甘・刺骨冰霜 | C1 相邻；C2 友方；C3 `droplet`；C4 战力+1 | `abilityResolver.ts` | 非相邻/非友方/无冰霜符号不加 | D1 D2 D4 D10 D18 D19 |
| 雄科・狂乱打击 | C1 攻击时；C2 统计特殊标记；C3 替代近战命中 | `execute.ts` 攻击骰面解析 | 不再叠加近战标记 | D1 D8 D16 D22 D54 |
| 冰霜萨满・北方魔法 | C1 攻击时；C2 0特殊标记；C3 伤害0 | `execute.ts` | 有特殊标记时按远程标记正常结算 | D1 D8 D16 D18 D22 |
| 粉碎者・迟钝 | C1 被攻击；C2 每特殊标记额外+1伤害 | `execute.ts` 攻击伤害 | 仅目标是粉碎者时生效 | D1 D2 D6 D22 |
| 冰苔冲锋者・血腥急袭 | C1 召唤后；C2 可跳过；C3 自伤1；C4 自身推拉1格；C5 合法空格 | `execute.ts` `after_summon`；`systems.ts`；`executors/shouren.ts` | 跳过不伤不移；无合法格不建空交互 | D5 D6 D8 D18 D24 D34 D39 D46 D51 D57 |
| 冰苔斗士・狂暴 | C1 攻击相邻敌方卡后；C2 掷1技能骰；C3 特殊标记继续；C4 可跳过；C5 自身移1格；C6 获得1额外攻击；C7 额外攻击后若仍攻击相邻敌方卡牌，会再次掷狂暴骰；C8 同一响应不重复授予 | `execute.ts` `shouren_berserk_roll`；`systems.ts` | 失败骰无交互；跳过无额度；额外攻击消耗后可再次触发新一轮狂暴骰 | D5 D8 D9 D18 D21 D24 D39 D45 D54 D56 |
| 冻结 | C1 召唤阶段；C2 3格内；C3 未充能；C4 士兵/英雄；C5 持续；C6 失去技能；C7 禁移动；C8 禁攻击；C9 禁推拉；C10 禁成为攻击目标；C11 离场恢复 | `eventCards.ts`；`helpers.ts`；`validate.ts`；`abilityResolver.ts`；`useEventCardModes.ts` | UI、AI候选和命令层不能绕过；按稳定单位实例身份附着 | D1 D2 D3 D5 D12 D14 D15 D18 D28 D31 D38 D51 D55 D57 |
| 粗暴蛮力・蛮力冲击 | C1 持续授予友方单位；C2 真实攻击伤害后；C3 可跳过；C4 目标远离来源1格；C5 合法空格；C6 离场移除 | `abilityResolver.ts`；`execute.ts`；`systems.ts` | 未造成伤害不创建交互；跳过不移目标 | D1 D4 D5 D8 D14 D18 D24 D35 D39 D51 D55 D57 |
| 原始狂怒 | C1 持续；C2 召唤师攻击相邻敌方卡后；C3 可跳过；C4 自身1-2格；C5 获得1额外攻击；C6 不递归 | `execute.ts`；`systems.ts` | 事件不在场/攻击者非召唤师不触发；跳过无额度 | D1 D2 D5 D8 D9 D14 D18 D21 D39 D56 D57 |
| 无上荣耀・鲁莽打击 | C1 持续授予友方士兵；C2 战力+2；C3 攻击统计特殊标记；C4 仅0/1个；C5 目标实际受伤；C6 自身同量伤害；C7 离场移除 | `abilityResolver.ts`；`execute.ts` | 英雄/召唤师不获得；>1特殊标记不自伤 | D1 D2 D4 D6 D8 D14 D16 D18 D19 D22 |
| 起始城门 | C1 起始建筑进入正式坐标 | `shouren.ts` `createShourenDeck`；`reduce.ts` 开局初始化 | 真实入口坐标与提示板一致 | D3 D10 D52 |
| 传送门 | C1 三张标准传送门进预构筑 | `shouren.ts` 牌组工厂 | 数量3，复用标准建造合法性，无冰苔特化分支 | D3 D10 D33 D52 |

## 完整技能流程矩阵

| 对象/家族 | 真相源 | 静态定义 | 候选/入口 | 命令/执行 | 消耗/限制 | 主效果 | 分支/否定 | 后续清理 | 证据 | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 恢复/鲜血羁绊/远射/刺骨冰霜/狂乱打击/北方魔法/迟钝 | 单卡主裁图 | `abilities-shouren.ts`+单位定义 | 共享移动/攻击入口 | `execute.ts`/`helpers.ts`/resolver | 卡面范围和骰面 | 充能/射程/战力/伤害 | 距离、归属、0特殊标记等负向 | 无新临时交互 | L1+L2+L4 | passed |
| 激励 | 召唤师主裁图 | `shouren_encourage` + 攻击待结算状态 | 攻击/技能骰后 | `RESPOND` -> 专用继续攻击命令 | 重掷耗1充能，保留0 | 以最终骰面结算 | 重掷/保留，等待时其它命令被拒 | 清攻击待结算状态和 interaction，攻击只落地一次 | L2+L3+L4 | passed |
| 血腥急袭 | 单卡主裁图 | `shouren_bloody_rush` | 真实召唤后 | `RESPOND -> executor` | 执行时自伤1 | 自身移1格 | 跳过/无合法格 | interaction 清空 | L2+L3+L4 | passed |
| 狂暴 | 单卡主裁图 | `shouren_berserk` | 每次攻击相邻敌卡后掷技能骰 | `RESPOND -> executor` | 特殊标记才继续 | 移1格+额外攻击 | 失败骰/跳过/额外攻击后再次掷骰 | 额外攻击额度消耗为0，同一响应不重复授予 | L2+L3+L4 | passed |
| 冻结 | 单卡主裁图 | active event+稳定目标实例 | 手牌卡本体->棋盘单位 | `PLAY_EVENT`/event executor | 0费，3格、未充能、士兵/英雄 | 技能清空+四类禁止 | 充能/超距离/召唤师/建筑不可选 | 事件离场即恢复 | L2+L3+L4 | passed |
| 粗暴蛮力 | 单卡主裁图 | active event 动态授予 | 造成攻击伤害后 | `RESPOND -> executor` | 远离方向合法空格 | 移动受伤目标 | 跳过/零伤害 | interaction清空，事件离场卸载技能 | L2+L3+L4 | passed |
| 原始狂怒 | 单卡主裁图 | active event 动态授予 | 召唤师攻击相邻敌卡后 | `RESPOND -> executor` | 移1-2格 | 额外攻击 | 跳过/非召唤师/无事件/不递归 | 额外额度消耗，无残留 | L2+L3+L4 | passed |
| 无上荣耀 | 单卡主裁图 | active event 动态授予 | 友方士兵攻击 | 战力 resolver+攻击结算 | 0/1特殊标记且实际伤害 | 战力+2+等量自伤 | >1特殊标记/非士兵不生效 | 事件离场卸载技能/战力 | L2+L4 | passed |

## 交互入口语义矩阵

| 对象 | 动作链 | 第一入口 | 字段/命令 | 目标归属 | 数量/可选 | 上下文携带 | 验证 | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 激励 | 攻击掷骰->重掷/保留->结算 | 两个按钮 | `interactionId+optionId` | 当前攻击者所属玩家 | 二选一 | 攻击者/目标/骰面/重掷次数 | L2+E2E | passed |
| 冻结 | 打出事件->选单位->附着 | 手牌《冻结》 | `REQUEST_EVENT_INTERACTION/PLAY_EVENT` | 任意阵营合法单位 | 精确1，打出前可取消 | 稳定 `targetUnitId` | L2+E2E | passed |
| 血腥急袭 | 召唤->选落点/跳过->自伤+移动 | 召唤卡与落点 | `optionId=pos:*|skip` | 同一召唤单位 | 0或1 | 单位实例+新坐标 | L2+E2E | passed |
| 狂暴 | 攻击->技能骰->选落点/跳过->额外攻击 | 棋盘攻击 | `optionId=pos:*|skip` | 同一冰苔斗士 | 0或1 | 来源实例+额外攻击来源 | L2+E2E | passed |
| 蛮力冲击 | 攻击伤害->选远离落点/跳过->移目标 | 棋盘攻击 | `targetPosition+newPosition` | 受伤单位 | 0或1 | 攻击者与目标稳定坐标 | L2+E2E | passed |
| 原始狂怒 | 召唤师攻击->选1-2格/跳过->额外攻击 | 棋盘攻击 | `optionId=pos:*|skip` | 己方召唤师 | 0或1 | 召唤师实例+额外攻击来源 | L2+E2E | passed |

## 框架消费合同

| 现实含义 | 声明值 | 消费点 | 证据 | 状态 |
| --- | --- | --- | --- | --- |
| 派系注册 | `shouren` | `config/factions/index.ts`+选派系 UI | 入口/选中/开局截图 | passed |
| 预构筑与起始坐标 | 30张，召唤师+斗士+萨满+城门 | `createShourenDeck`/`reduce.ts` | `factions.test.ts`+开局 E2E | passed |
| 能力注册 | `SHOUREN_ABILITIES` | `abilities.ts`/resolver/攻击结算 | 34 条领域测试 | passed |
| 攻击待结算状态 | 攻击者+目标+骰面+重掷次数 | validate/reducer/system/DiceResultOverlay/AI simple choice | 响应前无伤害，响应后一次落地 | passed |
| 事件打牌交互 | `shouren-freeze` | `useEventCardModes.ts`+事件 executor | 冻结真实手牌 E2E | passed |
| 位置选择 UI | 4个 `after_*_shouren_*` | `systemInteractionAdapter.ts`/`StatusBanners.tsx` | 4条直接 E2E+定向 UI 测试 | passed |
| 动态持续效果 | 冻结/粗暴蛮力/原始狂怒/无上荣耀 | active events + `getUnitAbilities` + strength resolver | 存续/离场 L2 | passed |
| 中英文与日志 | faction/ability/interaction/action log keys | `public/locales/zh-CN|en/game-summonerwars.json` | i18n 完整性测试 | passed |
| 图集与预加载 | `hero/cards/tip` | `cardAtlas.ts`/`criticalImageResolver.ts` | 静态测试+真实页面无破图 | passed |
| 音频/AI 可见性 | ability keys/simple choice options | `audio.config.ts`/AI legal actions | 注册覆盖+系统 interaction 描述 | passed |

## L4 共享链六项判等

| 共享链 | 对象 | 触发时机 | 候选生成 | 交互入口 | payload | resolver/handler | 最终权威状态 | 判定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 标准城门建造 | 传送门；代表对象=现有标准传送门 | 建造阶段 | 共享空格查询 | 手牌建筑->棋盘格 | 同 `cardId+position` | 同 `BUILD_STRUCTURE` | 同棋盘 structure+手牌移除 | 仅 faction/defId/图集不同，可合法复用 |
| 标准攻击入口 | 拉格诺/塔甘/雄科/萨满/粉碎者/无上荣耀 | 移动与目标选择入口同构 | 共享攻击 helper | 棋盘单位->目标 | 同 `attacker+target` | 同 `DECLARE_ATTACK`，但每个对象有独立规则分支 | 各自 L2 最终伤害/充能/战力 | 只复用入口壳，不用一个代表结果外推全部技能 |
| 召唤师系统位置交互 | 血腥急袭/狂暴/蛮力冲击/原始狂怒 | 四种触发不同 | 各自位移规则 helper | 同一棋盘高亮+跳过壳 | 均是真实 optionId，但字段不全同 | 各自 handler/executor | 各自单位、伤害、额外攻击状态 | 不判为“仅配置不同”；4/4 均补独立 L2+L3 |

## D1-D57 审计裁定

| 维度 | 现实含义 | 冰苔兽人裁定 | 状态 |
| --- | --- | --- | --- |
| D1 | 语义保真 | 单卡 C 子句与 34 条领域断言逐项对齐 | passed |
| D2 | 边界完整 | 距离、阵营、单位类型、骰面、受伤前提均有负向路径 | passed |
| D3 | 数据流闭环 | 定义->注册->执行->权威状态->UI/i18n/测试已贯通 | passed |
| D4 | 查询一致 | 刺骨冰霜、持续授予和战力均走 resolver | passed |
| D5 | 交互完整 | 激励、冻结和四类位置决策都有真实 UI | passed |
| D6 | 副作用传播 | 自伤/目标受伤/充能/位移均生成正式事件 | passed |
| D7 | 资源守恒 | 激励仅重掷扣1充能，保留和跳过不扣 | passed |
| D8 | 时序正确 | 激励先等待后伤害；攻击后技能均在最终伤害后 | passed |
| D9 | 幂等与重入 | 狂暴额外攻击会再次按“每次攻击后”触发新掷骰；同一响应不重复授予，攻击只落地一次 | passed |
| D10 | 元数据一致 | faction/symbol/phase/type/tags/atlas 与图面一致 | passed |
| D11 | Reducer 消耗路径 | 充能、额外攻击、事件牌和攻击待结算状态有对应 reducer 分支 | passed |
| D12 | 写入-消耗对称 | 攻击待结算状态/active event/extraAttacks 写入与最终消费同源 | passed |
| D13 | 多来源竞争 | 额外攻击按来源区分；本批无同一充能的多写入优先级新规则 | passed |
| D14 | 回合/阶段清理 | 持续事件离场动态失效，攻击待结算状态/interaction 解决后清空 | passed |
| D15 | UI 状态同步 | UI 读当前 interaction option 和 core 攻击待结算状态，不另造规则 | passed |
| D16 | 条件优先级 | 狂乱替代、北方魔法清零、鲁莽自伤条件分支已锁 | passed |
| D17 | 隐式依赖 | 交互携带攻击者/目标/实例/坐标，不靠“当前第一个”猜测 | passed |
| D18 | 否定路径 | 合法候选仍跳过、失败骰、无伤害、无事件、非法目标均有断言 | passed |
| D19 | 组合场景 | 激励可作用狂暴技能骰；持续授予与基础战力/攻击共存 | passed |
| D20 | 状态可观测性 | 充能、持续事件、骰面、可选格和跳过均可见 | passed |
| D21 | 触发频率 | 激励单次重掷；狂暴每次攻击后均可再掷骰；原始狂怒来源额外攻击仍按原审计口径防重入 | passed |
| D22 | 伤害计算管线 | 命中替换、额外伤害、零伤害、自伤都在正式攻击结算 | passed |
| D23 | 架构假设一致 | 远射、冻结和暂停攻击均在底层合法性/结算开口，非 UI 旁路 | passed |
| D24 | Handler 共返状态 | 四类位置交互以事件后 core 建候选，无空交互 | passed |
| D25 | MatchState 传播 | interaction system 以完整 `MatchState` 创建/解决，pipeline 测试覆盖 | passed |
| D26 | 事件设计 | 攻击掷骰待结算事件含攻击与骰面上下文；推拉含源/目标/新坐标 | passed |
| D27 | 可选参数语义 | 所有 may 语义用显式 `skip/keep`，必需字段在 handler 复核 | passed |
| D28 | 白/黑名单 | 冻结和冰苔 UI 能力 ID 已进入必要白名单且有测试 | passed |
| D29 | PPSE 事件替换 | 本批不新增 PPSE 过滤/替换路径 | N/A |
| D30 | 消灭与防止消灭 | 本批不新增防止消灭或待拯救链 | N/A |
| D31 | 效果拦截全路径 | 冻结同时拦移动、攻击者、攻击目标、推拉和技能解析 | passed |
| D32 | 替代路径后处理 | 激励的保留/重掷最终都回同一攻击结算函数 | passed |
| D33 | 跨实体同类一致 | 远射/城门/动态能力复用共享合同，冰苔特化有显式分支 | passed |
| D34 | 交互选项渲染 | 激励和跳过是按钮，位置 option 是棋盘高亮，冻结是单位选择 | passed |
| D35 | 交互上下文快照 | 激励待结算状态保存攻击/骰面，位置交互保存实例与坐标 | passed |
| D35.1 | 多系统命令门控 | 攻击待结算状态存在时只放行交互响应/专用继续命令 | passed |
| D36 | 延迟事件补发 | 本批攻击待结算链不使用 deferred/finalize 旁路，响应直接回正式结算 | N/A |
| D37 | 动态候选刷新 | resolver 响应时重查活体/坐标，冻结不依赖过时 defId | passed |
| D38 | UI 门控优先级 | 活跃系统交互时以 prompt option 高亮，其它阶段操作禁用 | passed |
| D39 | 流程标志清理 | 保留/重掷/执行/跳过后 interaction 和攻击待结算状态均无残留 | passed |
| D40 | 后处理去重 | 本批不新增死亡后处理循环；攻击只产生一次正式落地事件 | passed |
| D41 | 系统职责重叠 | 领域 execute 产生事件，interaction system 只创建/解决决策，UI 只消费 | passed |
| D42 | 事件流全链 | `DECLARE_ATTACK` -> 攻击掷骰待结算 -> `RESPOND` -> `UNIT_ATTACKED/damage` -> after-attack 已领域+E2E覆盖 | passed |
| D43 | 重构完整性 | 本批是新增派系，未用新旧双系统并行替代旧系统 | N/A |
| D44 | 测试反模式 | 高风险交互测试经 `executePipeline`，并断言最终 core/sys 而非只测内部 helper | passed |
| D45 | Pipeline 多阶段去重 | 激励只发一次正式攻击；狂暴允许新攻击生成新掷骰事件，但同一交互响应不重复授予 | passed |
| D46 | 交互显示模式声明 | 按钮/卡牌/单位/位置消费者路由清楚，跳过不被误渲染成取消 | passed |
| D47 | E2E 覆盖 | 正式入口 8/8：选派系/开局+六类关键交互 | passed |
| D48 | UI 交互渲染完整 | 卡牌选择、按钮选择、棋盘单位和位置选择四种载体均真实渲染 | passed |
| D49 | abilityTags 与触发一致 | 冰苔自动/攻击后/动态授予不靠错误 tag 推断 | passed |
| D50 | 阶段中间态 | 激励窗口中伤害未落地，其它命令禁用；响应后恢复流程 | passed |
| D50.1 | Bug/业务口径分层 | 严格按卡面“可以/攻击后/造成伤害后”裁定，未把“无意义”自行改成非法 | passed |
| D51 | 交互单一真相 | options -> UI高亮 -> optionId -> handler -> reducer 使用同一数据 | passed |
| D52 | 权威可视合同 | 8x2 槽位、空白槽、hero/tip 和真实开局截图一致 | passed |
| D53 | 入场后来源归属 | 本批无基地 played-to-base 家族；血腥急袭是召唤后自身链，来源实例显式 | N/A |
| D54 | 跨窗口结果快照 | 激励、狂暴技能骰都保存本次骰面，响应不读其它 live dice | passed |
| D55 | 共享合同多消费者 | 冻结贯通 UI/AI/validator/helper/resolver；激励贯通 validate/system/UI/AI/execute | passed |
| D56 | 直接/非攻击收口 | 失败骰、跳过、保留、重掷、无合法候选都有显式收口点 | passed |
| D57 | 对象身份/归属/去向 | 冻结绑定 `instanceId`，位移保留同一单位实例，事件保留 owner | passed |

## 验证证据

### L1 结构证据

- 派系、牌组、图集、预加载、i18n、UI 消费和领域机制联合定向回归：`7 files / 70 tests passed`，其中冰苔兽人领域机制 `34 tests`。
- 预构筑：3 英雄 + 16 士兵 + 8 事件 + 3 传送门 = 30 张。
- 入口中冰苔兽人不再显示“实施中”，莫古/灰烬状态不变。

### L2 领域行为证据

- `src/games/summonerwars/__tests__/abilities-shouren.test.ts`：`34/34 passed`。
- 覆盖每个规则子句的成功、跳过/否定、数量、距离、动态移除、狂暴额外攻击后再次掷骰和最终权威状态。

### L3 真实玩法证据

- 命令：`npm run test:e2e:file -- e2e/summonerwars/summonerwars-shouren.e2e.ts`。
- 结果：`8 passed (6.0m)`。
- 真实入口：派系目录 -> 双方选派系/就绪 -> 正式开局；交互用例均从手牌打出、召唤或真实棋盘攻击触发，不直接注入 `sys.interaction.current`。
- 页面日志中的 `splendor/picture` 加载警告属于大厅其它游戏缩略图，本次 11 张召唤师战争原图未出现破图。

### L4 治理与收口证据

- 激励：选择前 `UNIT_ATTACKED=0`、伤害=0、攻击次数=0；响应后正式攻击只有1次，攻击待结算状态清空。
- 狂暴：额外攻击额度执行后归零，但若这次额外攻击仍攻击相邻敌方卡牌，会再次创建新的狂暴掷骰交互。
- 原始狂怒：额外攻击额度执行后归零，仍按原审计口径不再创建同来源交互。
- 冻结：活跃事件存续时 UI/AI/命令/技能 resolver 一致限制，事件离场后不保留静态污染。
- 四种位置交互：执行和跳过都使 `sys.interaction.current` 收口；无候选时不创建空 prompt。

## 真实截图人工核验

- 视口：1920x1080，Chromium，当前工作区当前实现。
- 评分方式：任务清晰度 20 + 视觉层级 15 + 对象可识别 15 + 状态/动作载体 15 + 布局 15 + 素材 10 + 操作人体工学 10。

| 图 | 状态 | 图面观察 | 裁决 |
| --- | --- | --- | --- |
| 01 | 冰苔兽人入口 | 卡面清晰，无“实施中”斜带，与莫古/灰烬区分明确 | PASS 93/100 |
| 02 | 派系已选 | P1 归属、预览和就绪状态可读 | PASS 93/100 |
| 03 | 正式开局 | 召唤师、斗士、萨满、城门坐标清楚，无破图/遮挡 | PASS 93/100 |
| 04 | 激励待决 | 两颗骰子、重掷和保留按钮在同一焦点，无重叠裁切 | PASS 94/100 |
| 05 | 激励重掷后 | 骰盘已退场，伤害与充能变化可见 | PASS 93/100 |
| 06 | 冻结选目标 | 目标外框、手牌冻结和取消入口角色清楚 | PASS 94/100 |
| 07 | 冻结已附着 | 左侧持续效果可读，目标卡本体不被遮挡 | PASS 93/100 |
| 08 | 血腥急袭位移 | 同位点复拍已等待运动特效退场；单位卡面、三个合法格与跳过均清楚 | PASS 94/100 |
| 09 | 狂暴位移 | 三个候选格与跳过一眼可识别，单位/目标不被高亮遮挡 | PASS 94/100 |
| 10 | 蛮力冲击 | 仅远离方向的一个合法格可见，持续事件来源可读 | PASS 94/100 |
| 11 | 原始狂怒 | 1-2 格候选集合完整，跳过与持续来源可读 | PASS 94/100 |

## 资源发布与 Android 索引

- 服务器发布批次：`20260718161014069`。
- 运行时压缩资源：`cards.webp=2,108,970`，`hero.webp=236,436`，`tip.webp=117,962` 字节。
- 远程 HEAD：`.../shouren/compressed/cards.webp` -> 200，`Content-Length=2108970`，`Content-Type=image/webp`。
- Android stable：`0.6.12-summonerwars-idx-937cf6cbb752`，`fileCount=34`，其中冰苔兽人 3 文件；远程 `games/summonerwars.json` 与版本 file-index 已直接回查。

## 禁止假阳性检查

- 未用派系选择页代替规则验证；关键决策都有真实攻击/召唤/手牌入口。
- 未用“能力 ID 已注册”代替行为；34 条领域测试断言最终权威状态。
- 未直接注入 interaction 冒充 L3；E2E 仅使用状态夹具建立可达牌局，交互本身均由正式命令触发。
- 未停在 prompt 存在；执行/跳过/重掷/保留后均断言最终状态和清理。

## 旧 evidence 与修订对账

- 旧文档：`evidence/summonerwars/summonerwars-shouren-intake-2026-07-18.md`。
- 旧结论：录入合同 `passed`，资源、机制、审计、E2E 当时均明确记为未实施。
- 对账结论：intake 是当时快照，没有错误声称完成，不需标记“旧结论失效”；本文承接其后的实施与验证状态。
- 莫古旧审计的失效记录属于其它派系，不作为冰苔兽人的代表链或完成证据。

## 共享根因与残余范围

- 已修共享消费缺口：血腥急袭、狂暴、蛮力冲击、原始狂怒原先只有领域 interaction，UI 不能完整消费；现已统一路由棋盘位置高亮和“跳过”按钮。
- 已修冻结入口缺口：从真实手牌点击后必须进入单位选择，UI 候选与 `getValidShourenFreezeTargets` 同源。
- 当前功能对象级无已知残余缺口。
- 血腥急袭首张图的动画中间帧已通过截图前稳定等待修正；同位点 E2E `1 passed`，新原图 `PASS 94/100`。
- 边界：本结论不代表其它派系已重审，也不代表生产前端已部署；资源服务器与 Android stable 索引已独立回查。

## 对外汇报口径

- 允许说：冰苔兽人当前发布口径已收口；对象级全面审计完成，功能、资源、Android 索引、L2、正式入口 E2E 和最终截图均有直接证据。
- 禁止外推：不得把本文解释为其它派系全量重审或生产前端部署证据。

## Evidence 审计后自检

- 命令：`npm run audit:evidence:selfcheck -- evidence/summonerwars/summonerwars-shouren-full-audit-2026-07-18.md`
- 结果：`checked files: 1; audit docs: 1; OK`。
