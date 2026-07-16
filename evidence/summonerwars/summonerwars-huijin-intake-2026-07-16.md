# 召唤师战争灰烬派系录入与审计证据

日期：2026-07-16

## 审计范围

| 范围层级 | 本轮覆盖 | 当前状态 |
| --- | --- | --- |
| 新增派系 | 灰烬（`huijin`）派系选择、预构筑牌组、卡池注册、AI profile、音频枚举、关键图片预加载、图集注册 | passed |
| 录入对象全集 | 玛达莉雅女王、3 张英雄单位、4 张士兵单位、4 张事件、起始城门、通用传送门、slot 11-15 空白占位 | passed |
| 资源链 | `hero/huijin/cards.jpg`、`hero.png`、`tip.jpg` 的 runtime 压缩产物、manifest、服务器素材主源上传与公开 URL 回查 | passed |
| 机制实现 | 威势、召集护卫、怒焰召唤、点燃、护主、火焰喷吐、还击、庇护、缠门、冲撞、烈火降生、野火、快速射击、炫目光芒、灼烧、神族复仇、凤凰之魂 | passed |
| 真实入口 | 灰烬阵营入口、召集护卫、冲撞、快速射击真实在线 match E2E；其余静态/自动/共享链对象按 L2 + 共享链判等登记 | passed |
| 旧证据对账 | `evidence/summonerwars` 与本轮 OpenSpec 中灰烬/huijin 旧结论检索；旧 SummonerWars 批次结论不覆盖本新增派系 | passed |

## 结论等级

结论等级：当前代码验证口径已收口；未代表生产部署或正式发布。

判定理由：灰烬对象全集、资源链、规则子句、完整技能流程矩阵、L0-L4 层级、D 维度、可选跳过路径、真实入口代表链、共享链判等和旧 evidence 对账均已在本文留档。最终权威状态证据包括棋盘单位位置、手牌/弃牌堆归属、充能/伤害值、交互清空、阶段继续推进、远端资源 HEAD 200 与截图相册可加载。

## 批次矩阵

| objectId | 数据录入 | 资源链 | 机制实现 | 审计 | E2E | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| huijin | passed | passed | passed | passed | passed | passed |

## 全面审计自检表

| 项 | 状态 | 证据 / 说明 |
| --- | --- | --- |
| 对象全集 | passed | `图集合同` 覆盖 slot 0-10，`起始配置` 覆盖召唤师、起始城门、起始单位和史诗事件，`结构卡合同` 覆盖传送门 |
| 规则子句表 | passed | `规则子句表与逐项结论` 已按 C1/C2/C3 拆出每个技能和事件的时机、主效果、限制、分支和清理 |
| 完整技能流程矩阵 | passed | `完整技能流程矩阵` 写清触发前条件、候选/入口、命令/执行、消耗/限制、主效果、分支/否定、后续清理 |
| L0-L4 证据层级 | passed | `L0-L4 层级矩阵` 覆盖 L0 图源、L1 静态配置、L2 领域行为、L3 真实入口或 N/A/共享代表链、L4 生命周期/共享链判等 |
| 命中 D 维度 | passed | `D 维度命中记录` 登记 D1/D2/D3/D5/D7/D8/D10/D12/D15/D18/D21/D22/D23/D33/D34/D39/D52/D55 |
| 真实入口 E2E 与截图核验 | passed | 真实在线 match 覆盖灰烬入口、召集护卫、冲撞、快速射击；截图相册 `summonerwars-huijin-e2e` 11 张已核验可加载 |
| 分支/可选/数量边界 | passed | 新增 `interaction-chain-comprehensive.test.ts -t "huijin"` 覆盖召集护卫、冲撞、快速射击合法候选存在时跳过不改变最终权威状态 |
| 阶段/生命周期收口 | passed | 召集护卫跳过后可继续到魔力阶段；冲撞/快速射击跳过后 `sys.interaction.current` 清空且不产生推拉/伤害事件 |
| 残余范围声明 | passed | 当前代码验证范围内无灰烬新增派系残余；生产部署与正式发布状态由发布流程另行证明 |
| 旧 evidence / 旧结论对账回写 | passed | `旧 evidence / 旧结论对账与修订记录` 已记录：旧 SummonerWars 审计批次未覆盖灰烬；没有需要原地降级的灰烬旧收口文档 |

## 权威来源与真相源表

主真相源：用户放入的本地素材目录 `public/assets/i18n/zh-CN/summonerwars/hero/huijin`。

| 文件 | 尺寸 | 大小 | sha256 | 用途 |
| --- | ---: | ---: | --- | --- |
| `cards.jpg` | 8088x1454 | 1385543 | `fef7335504b8de3bf0bdeb7983bdd83e434330bb985e96660a3d54e81c04a30a` | 8x2 卡牌图集 |
| `hero.png` | 1038x722 | 1166017 | `d52a6c6bab57041d571aefe8a3ab8d4e559605683406306b29a32d7bc023c53b` | 召唤师单图 |
| `tip.jpg` | 786x562 | 109860 | `75b3bca1e69e1ddf08e0261f6b647373dd07fea557dd7bfde1e66e564456590a` | 派系提示图 |

临时核对图只写入：`temp/summonerwars-huijin-intake/`。这些不是正式运行时资源。

## 资源链结果

本轮正式运行时资源已按 runtime 模式压缩，不降采样。

| 本地压缩产物 | 尺寸 | bytes | 远端 URL | HEAD |
| --- | --- | ---: | --- | --- |
| `public/assets/i18n/zh-CN/summonerwars/hero/huijin/compressed/cards.webp` | 8088x1454 | 2119116 | `https://assets.easyboardgame.top/official/i18n/zh-CN/summonerwars/hero/huijin/compressed/cards.webp` | 200 |
| `public/assets/i18n/zh-CN/summonerwars/hero/huijin/compressed/hero.webp` | 1038x722 | 240600 | `https://assets.easyboardgame.top/official/i18n/zh-CN/summonerwars/hero/huijin/compressed/hero.webp` | 200 |
| `public/assets/i18n/zh-CN/summonerwars/hero/huijin/compressed/tip.webp` | 786x562 | 119044 | `https://assets.easyboardgame.top/official/i18n/zh-CN/summonerwars/hero/huijin/compressed/tip.webp` | 200 |

Manifest 状态：

- 游戏级 manifest：`public/assets/i18n/zh-CN/summonerwars/assets-manifest.json`
  - `basePrefix`: `official/i18n/zh-CN/summonerwars/`
  - 灰烬压缩资源键已登记：`hero/huijin/compressed/cards`、`hero/huijin/compressed/hero`、`hero/huijin/compressed/tip`
- 根级 i18n manifest：`public/assets/i18n/assets-manifest.json`
  - 灰烬压缩资源键已登记：`zh-CN/summonerwars/hero/huijin/compressed/cards`、`zh-CN/summonerwars/hero/huijin/compressed/hero`、`zh-CN/summonerwars/hero/huijin/compressed/tip`

上传记录：

- 预检：`node scripts/assets/upload-to-server.js --check --asset-prefix i18n/zh-CN/summonerwars/hero/huijin`，命中 3 个对象。
- 第一次上传：服务器素材主源对象发布完成，但 Android 素材包差异索引刷新因公网 fetch 超时失败；该次不作为完整资源链收口。
- 第二次上传：`node scripts/assets/upload-to-server.js --asset-prefix i18n/zh-CN/summonerwars/hero/huijin` 成功。
  - `serverPrimaryRelease=20260716153140465`
  - `serverPrimaryObjects=34`
  - 灰烬对象：3 个
  - Android `summonerwars` 差异索引已刷新：`0.6.11-summonerwars-idx-92cb026539d4`
  - `https://assets.easyboardgame.top/official/mobile-packages/android/stable/games/summonerwars.json` HEAD 200
  - `https://assets.easyboardgame.top/official/mobile-packages/android/stable/file-index/summonerwars/0.6.11-summonerwars-idx-92cb026539d4.json` HEAD 200

## 图集合同

`cards.jpg` 按 8 列 x 2 行均分，每格 1011x727。slot 0-10 为有效卡，slot 11-15 为空白占位。

| slot | 对象 | 类型 | 费用/生命 | 战力 | 攻击 | 原文要点 | 合同状态 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 0 | 赫丽丝 | 英雄单位 | 5/7 | 3 | 远程 | 怒焰召唤；点燃：相邻友方灰烬单位战力+1 | locked |
| 1 | 火焰龙兽 | 英雄单位 | 8/10 | 4 | 远程 | 护主：可召唤到召唤师相邻；火焰喷吐：攻击可穿过单位并伤害路径单位 | locked |
| 2 | 风妮莎 | 英雄单位 | 5/9 | 3 | 近战 | 还击：被相邻敌方攻击后若仍在场，对该敌方造成1伤害 | locked |
| 3 | 灰烬法师 | 士兵单位 | 1/2 | 2 | 远程 | 庇护：一回合中第一次被攻击时，该攻击最多造成1伤害 | locked |
| 4 | 皇家守卫 | 士兵单位 | 2/4 | 1 | 近战 | 缠门：相邻敌方因移动/推拉离开时受1伤；冲撞：攻击相邻敌方士兵/英雄后可推拉1格 | locked |
| 5 | 灰烬野兽 | 士兵单位 | 2/3 | 3 | 近战 | 烈火降生：可召唤到友方灰烬单位相邻；野火：移动阶段开始时对每个相邻敌方造成1伤害 | locked |
| 6 | 灰烬弓箭手 | 士兵单位 | 1/2 | 2 | 远程 | 快速射击：移动后，可指定3个直线视野格内一个单位，对目标造成1伤害 | locked |
| 7 | 炫目光芒 | 普通事件 | 1/- | - | - | 持续：召唤师或其相邻友方被攻击时，伤害按特殊标记数结算 | locked |
| 8 | 灼烧 | 普通事件 | 0/- | - | - | 指定召唤师2格以内一个士兵或英雄，造成2伤害 | locked |
| 9 | 神族复仇 | 普通事件 | 0/- | - | - | 持续：召唤师获得火凤灵光，被攻击后对该敌方造成1伤害 | locked |
| 10 | 凤凰之魂 | 传奇事件 | 0/- | - | - | 持续：友方单位技能以攻击之外方式对敌方造成伤害时，额外造成1伤害 | locked |

## 起始配置

从 `tip.jpg` 锁定：

| 项 | 图面结论 | 合同状态 |
| --- | --- | --- |
| 召唤师 | 玛达莉雅女王 | locked |
| 起始城门 | 通用 10 生命城门，位于召唤师前方 | locked |
| 起始单位 | 灰烬弓箭手、皇家守卫 | locked |
| 史诗事件 | 凤凰之魂 x2 | locked |

## 结构卡合同

| 对象 | 运行时对象 | 规则子句 | 实现入口 | 结论 |
| --- | --- | --- | --- | --- |
| 起始城门 | `huijin-starting-gate` | C1 起始结构；C2 10 生命；C3 只在起始配置放置；C4 不进入普通牌库抽取 | `STRUCTURE_CARDS_HUIJIN[0]`、`createHuijinDeck().startingGate` | passed |
| 传送门 | `huijin-portal-*` | C1 通用城门；C2 5 生命；C3 进入灰烬牌库 3 张；C4 复用现有召唤/建筑规则 | `STRUCTURE_CARDS_HUIJIN[1]`、`createHuijinDeck()` 3 次展开 | passed |
| slot 11-15 空白占位 | N/A | C1 图集空槽；C2 不生成卡牌定义；C3 不进入牌库；C4 UI 不应出现空对象 | `SPRITE_INDEX_HUIJIN` 只登记 0-10，牌组工厂只消费正式对象 | passed |

## 规则子句表与逐项结论

| 对象 | 规则子句 | 实现入口 | 共享链路 / 复用依据 | 命中维度 | 证据层级 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 玛达莉雅女王・威势 | C1 每回合一次攻击后充能；C2 充能挂在本单位；C3 不应跳过攻击行动经济 | 既有 `intimidate` 能力、`abilities-huijin.test.ts` 静态/行为覆盖 | 成熟旧能力；灰烬只复用能力 id | D1/D3/D7/D21 | L1/L2；L3 N/A，旧能力复用 | passed |
| 玛达莉雅女王・召集护卫 | C1 攻击阶段结束触发；C2 有 1 充能和手牌士兵、相邻空格时出现选择；C3 可跳过；C4 选择后消耗 1 充能并把士兵放到召唤师相邻；C5 交互结束后阶段可继续 | `execute.ts` 真实 `END_PHASE` 触发；`systems.ts` 两段 simple-choice；`executors/huijin.ts` 扣充能与召唤 | 新灰烬二段手牌/棋盘链，需 direct L3/L4 | D1/D3/D5/D7/D8/D12/D18/D21/D34/D39 | L1/L2/L3/L4 | passed |
| 赫丽丝・怒焰召唤 | C1 友方灰烬单位召唤时；C2 可放到赫丽丝相邻空格；C3 非灰烬单位不得使用该位置 | `helpers.ts` 召唤位置扩展；`abilities-huijin.test.ts` 正负验证 | 召唤位置扩展 family；与护主/烈火降生共用 helper，筛选条件不同 | D1/D2/D3/D5/D15/D23 | L1/L2；L3 复用通用召唤 UI | passed |
| 赫丽丝・点燃 | C1 相邻友方灰烬单位战力 +1；C2 非相邻不加；C3 赫丽丝自身不加 | `abilityResolver.ts` `calculateEffectiveStrength` 修正来源 | 战力修正 family；只新增来源和筛选条件 | D1/D2/D3/D4/D15/D18 | L1/L2；L3 N/A | passed |
| 火焰龙兽・护主 | C1 火焰龙兽可召唤到召唤师相邻；C2 普通单位不得复用该特殊位置 | `helpers.ts` 召唤位置扩展；`abilities-huijin.test.ts` 正负验证 | 召唤位置扩展 family；与怒焰召唤/烈火降生同 helper，筛选条件不同 | D1/D2/D3/D5/D15/D23 | L1/L2；L3 复用通用召唤 UI | passed |
| 火焰龙兽・火焰喷吐 | C1 远程攻击可穿过路径单位；C2 对路径单位造成同次攻击伤害；C3 目标仍按攻击结算 | `helpers.ts` 视线判断；`execute.ts` `DECLARE_ATTACK` 路径伤害；`abilities-huijin.test.ts` | 攻击/伤害 family；新增路径单位额外伤害来源 | D1/D2/D3/D8/D12/D18/D22/D23 | L1/L2；L3 复用真实攻击链 | passed |
| 风妮莎・还击 | C1 被相邻敌方攻击后触发；C2 风妮莎仍在场才对攻击者 1 伤；C3 非相邻或已离场不应触发 | `execute.ts` 攻击后处理；`abilities-huijin.test.ts` | 攻击后自动伤害 family；与神族复仇/凤凰之魂同伤害后处理可观测链 | D1/D2/D3/D8/D12/D18/D22 | L1/L2；L3 N/A | passed |
| 灰烬法师・庇护 | C1 一回合第一次被攻击时最多受 1 伤；C2 第二次不再限制；C3 不应作用于非攻击伤害 | `execute.ts` 攻击伤害限制；`abilities-huijin.test.ts` | 攻击伤害修正 family；来源为受攻击单位 | D1/D2/D3/D8/D12/D14/D18/D22 | L1/L2；L3 N/A | passed |
| 皇家守卫・缠门 | C1 相邻敌方移动/推拉离开时受 1 伤；C2 靠近或保持相邻不触发 | 既有 `entangle` 能力 | 成熟旧能力；灰烬只复用能力 id | D1/D3/D6/D8/D18/D33 | L1/L2；L3 复用旧能力证据 | passed |
| 皇家守卫・冲撞 | C1 攻击相邻敌方士兵/英雄后触发；C2 可跳过目标选择；C3 选目标后可跳过落点；C4 执行时目标移动到相邻空格；C5 召唤师/非相邻/占用落点无效；C6 无交互残留 | `systems.ts` 两段 simple-choice；`executors/huijin.ts` 推拉；`abilities-huijin.test.ts` 和 `interaction-chain-comprehensive.test.ts` | 新灰烬攻击后二段推拉链，需 direct L3/L4 | D1/D2/D3/D5/D8/D12/D18/D21/D34/D39 | L1/L2/L3/L4 | passed |
| 灰烬野兽・烈火降生 | C1 灰烬野兽可召唤到友方灰烬单位相邻；C2 只能作用于自身召唤；C3 非灰烬来源不得外推 | `helpers.ts` 召唤位置扩展；`abilities-huijin.test.ts` | 召唤位置扩展 family；与怒焰召唤/护主同 helper，筛选条件不同 | D1/D2/D3/D5/D15/D23 | L1/L2；L3 复用通用召唤 UI | passed |
| 灰烬野兽・野火 | C1 移动阶段开始触发；C2 每个相邻敌方受 1 伤；C3 友方/非相邻不受伤；C4 与凤凰之魂组合时可增幅 | `flowHooks.ts` 阶段触发；`execute.ts`/`execute/helpers.ts` 后处理；`abilities-huijin.test.ts` | 阶段开始自动伤害 family；与凤凰之魂共用技能伤害后处理 | D1/D2/D3/D6/D8/D12/D18/D22 | L1/L2；L3 N/A，阶段自动链 | passed |
| 灰烬弓箭手・快速射击 | C1 移动后触发；C2 3 格直线视野内一个单位；C3 可跳过；C4 执行造成 1 伤；C5 非直线/超距/阻挡无效；C6 无交互残留 | `systems.ts` afterMove simple-choice；`executors/huijin.ts` 伤害；`abilities-huijin.test.ts` 和 `interaction-chain-comprehensive.test.ts` | 新灰烬移动后目标选择链，需 direct L3/L4 | D1/D2/D3/D5/D8/D12/D15/D18/D21/D22/D34/D39 | L1/L2/L3/L4 | passed |
| 炫目光芒 | C1 召唤阶段打出为持续事件；C2 召唤师或相邻友方被攻击时按 special 数结算伤害；C3 不应扩大到非相邻友方 | `eventCards.ts` 持续事件入场；`execute.ts` 攻击命中替换；`abilities-huijin.test.ts` | 持续攻击修正 family；新修正来源但消费点为既有攻击结算 | D1/D2/D3/D8/D12/D18/D22/D23 | L1/L2；L3 复用事件打出/攻击 UI | passed |
| 灼烧 | C1 召唤阶段打出；C2 选召唤师 2 格以内士兵或英雄；C3 造成 2 伤；C4 卡进入弃牌；C5 战斗日志来源可解析 | `eventCards.ts` 事件执行；`actionLog.ts` 来源解析；`abilities-huijin.test.ts` | 事件目标伤害 family；只新增范围和来源 | D1/D2/D3/D5/D7/D8/D12/D18/D22 | L1/L2；L3 复用事件牌目标选择 UI | passed |
| 神族复仇 | C1 召唤阶段打出为持续事件；C2 召唤师被攻击且仍在场后对攻击者 1 伤；C3 不应在召唤师未被攻击时触发 | `eventCards.ts` 持续事件入场；`execute.ts` 攻击后处理；`abilities-huijin.test.ts` | 攻击后自动伤害 family；与还击共享最终伤害可观测链 | D1/D2/D3/D8/D12/D18/D22 | L1/L2；L3 复用事件打出/攻击 UI | passed |
| 凤凰之魂 | C1 召唤阶段打出为传奇持续事件；C2 友方单位技能以非攻击方式对敌方单位造成伤害时 +1；C3 不应重复增幅已带凤凰加成的伤害；C4 不应作用于普通攻击伤害 | `eventCards.ts` 持续事件入场；`execute/helpers.ts` 技能伤害后处理；`abilities-huijin.test.ts` | 技能伤害增幅 family；与野火/还击/快速射击伤害来源联动 | D1/D2/D3/D6/D8/D10/D12/D18/D22/D23 | L1/L2；L3 N/A，后处理自动链 | passed |
| 起始城门/传送门 | C1 城门结构；C2 起始城门 10 生命，普通传送门 5 生命；C3 复用召唤师战争现有建筑/召唤规则 | `config/factions/huijin.ts` 结构卡与牌组工厂 | 成熟结构卡 family；只新增派系配置 | D1/D3/D52 | L0/L1/L2；L3 由阵营入口 E2E 看到起始棋盘 | passed |

## 机制矩阵

| 对象 | 子句 | 实现口径 | 当前状态 |
| --- | --- | --- | --- |
| 玛达莉雅女王 | 威势 | 复用现有“威势/每回合一次攻击后充能”语义；`abilities-huijin.test.ts` 覆盖攻击后充能 | L2 passed |
| 玛达莉雅女王 | 召集护卫 | 攻击阶段结束时消耗1充能，把友方士兵放到召唤师相邻；`systems.ts` 已接入手牌士兵选择与落点选择，跳过会标记阶段末技能已处理；`abilities-huijin.test.ts` 覆盖成功、无充能、非士兵负例 | L2 passed |
| 赫丽丝 | 怒焰召唤 | 共享召唤位置 helper 已放行灰烬单位到赫丽丝相邻；领域验证、玩家选格 UI、AI 行动生成同源；`abilities-huijin.test.ts` 覆盖合法召唤和非灰烬负例 | L2 passed |
| 赫丽丝 | 点燃 | `calculateEffectiveStrength` 读取相邻赫丽丝；相邻友方灰烬单位 +1 战力，赫丽丝自身不加成 | L2 passed |
| 火焰龙兽 | 护主 | 共享召唤位置 helper 已放行火焰龙兽到召唤师相邻；`abilities-huijin.test.ts` 覆盖火焰龙兽合法、普通单位不可复用 | L2 passed |
| 火焰龙兽 | 火焰喷吐 | `canAttackEnhanced` 允许火焰龙兽远程攻击穿过单位，`DECLARE_ATTACK` 对路径单位造成同次攻击伤害；`abilities-huijin.test.ts` 覆盖穿透验证、目标伤害与路径伤害 | L2 passed |
| 风妮莎 | 还击 | 攻击结算后若风妮莎仍在场且攻击者相邻，对攻击者造成1伤害 | L2 passed |
| 灰烬法师 | 庇护 | 攻击结算时，灰烬法师本回合第一次被攻击最多1伤；第二次不限制 | L2 passed |
| 皇家守卫 | 缠门 | 复用现有缠斗：相邻敌方因移动离开时受1伤 | L2 passed |
| 皇家守卫 | 冲撞 | 攻击相邻敌方士兵/英雄后推拉1格；`systems.ts` 已按本次攻击目标/相邻敌方生成目标与落点两步选择；执行器和验证层均检查相邻、目标类型与空落点；`abilities-huijin.test.ts` 覆盖成功、召唤师、非相邻、占用落点负例 | L2 passed |
| 灰烬野兽 | 烈火降生 | 共享召唤位置 helper 已放行灰烬野兽到友方灰烬单位相邻；`abilities-huijin.test.ts` 覆盖领域验证 | L2 passed |
| 灰烬野兽 | 野火 | `PHASE_START_ABILITIES.move` 触发；移动阶段开始时每个相邻敌方受1伤 | L2 passed |
| 灰烬弓箭手 | 快速射击 | 移动后直线视野 3 格内目标受1伤；`systems.ts` 已在移动后生成 3 格直线视野目标选择；`abilities-huijin.test.ts` 覆盖成功、非直线、超距、路径阻挡负例 | L2 passed |
| 炫目光芒 | 持续命中替换 | `DECLARE_ATTACK` 对召唤师/相邻友方目标启用特殊标记数替换命中数；`abilities-huijin.test.ts` 覆盖召唤师受攻击替换伤害 | L2 passed |
| 灼烧 | 目标伤害 | 事件牌打出后，对召唤师2格内士兵/英雄造成2伤；战斗日志来源可解析 | L2 passed |
| 神族复仇 | 火凤灵光授予 | 持续事件在召唤师被攻击且仍在场时，对攻击者造成1伤；战斗日志来源可解析 | L2 passed |
| 凤凰之魂 | 技能伤害增幅 | 公共事件后处理对友方单位非攻击技能伤害 +1，execute 与 flowHooks 共用；`abilities-huijin.test.ts` 覆盖野火加成 | L2 passed |

## 静态运行时接入

已完成：

- 新增派系 ID：`huijin`，中文名“灰烬”。
- 新增静态牌表：`src/games/summonerwars/config/factions/huijin.ts`。
- 接入派系目录、牌组工厂、卡牌注册表、AI profile、音频枚举、关键图片预加载、图集注册。
- 新增图集合同：
  - `HUIJIN_CARDS_ATLAS`: 8088x1454，8x2，单格 1011x727。
  - `HUIJIN_HERO_ATLAS`: 1038x722，单帧。
- 新增中英文派系/技能文案。
- 新增灰烬技能 ID 元数据：`src/games/summonerwars/domain/abilities-huijin.ts`。
- 已接入 L2 机制：威势、召集护卫、缠斗、冲撞、点燃、庇护、还击、野火、快速射击、灼烧、神族复仇、怒焰召唤、护主、烈火降生、火焰喷吐、炫目光芒、凤凰之魂。
- 已补 L4 交互收口证据：召集护卫、冲撞、快速射击均覆盖成功路径、合法候选存在时跳过、最终权威状态和无交互残留。

## 真实入口 E2E 与截图核验

本轮补齐 4 条真实在线 match + 状态注入 + 页面点击 E2E：灰烬阵营入口、召集护卫、冲撞、快速射击。截图已经完成 AI 图面核验，并发布到预览相册：

- 预览相册：`http://8.148.71.102:18080/#/boardgame/summonerwars-huijin-e2e`
- 本地截图根目录：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-huijin-abilities.e2e`
- AI 核验联系表：`D:\gongzuo\webgame\BoardGame\temp\summonerwars-huijin-e2e-contact.jpg`

| 用例 | 截图 | 图面观察 | 结论 |
| --- | --- | --- | --- |
| 灰烬阵营入口 | `真实阵营选择入口可以选择灰烬并开局看到玛达莉雅女王、灰烬弓箭手和皇家守卫\01-灰烬阵营入口可见.jpg`、`02-灰烬阵营已选择.jpg`、`03-灰烬开局单位可见.jpg` | 阵营选择页能看到并选择灰烬；开局真实棋盘可见玛达莉雅女王、灰烬弓箭手、皇家守卫 | passed |
| 召集护卫 | `召集护卫：阶段结束后真实手牌选择并召唤到相邻空格\01-召集护卫-选择手牌士兵.jpg`、`02-召集护卫-选择相邻空格.jpg`、`03-召集护卫-召唤完成.jpg` | 阶段结束后出现“召集护卫：选择手牌中的士兵”弹层，候选灰烬弓箭手与“跳过”按钮可见；选择后相邻空格高亮；结算后灰烬弓箭手出现在玛达莉雅女王相邻格 | passed |
| 冲撞 | `冲撞：皇家守卫攻击后真实选择相邻敌方并推到相邻空格\01-冲撞-选择相邻敌方目标.jpg`、`02-冲撞-选择推拉落点.jpg`、`03-冲撞-推拉完成.jpg` | 皇家守卫攻击后真实棋盘出现相邻敌方目标选择和推拉落点高亮；结算后敌方单位被移到目标空格 | passed |
| 快速射击 | `快速射击：灰烬弓箭手移动后真实选择直线目标造成伤害\01-快速射击-移动后选择目标.jpg`、`02-快速射击-伤害完成.jpg` | 灰烬弓箭手移动后真实棋盘进入直线目标选择；结算后目标单位仍在棋盘位点并承受快速射击伤害 | passed |

预览站验证记录：

- 本地发布：`.\scripts\publish-artifact.ps1 -Project boardgame -Task summonerwars-huijin-e2e ...`，发布 11 张截图。
- 服务器同步：`scp -r D:\gongzuo\webgame\image-preview\data\projects\boardgame\tasks\summonerwars-huijin-e2e admin@8.148.71.102:/home/admin/image-preview/data/projects/boardgame/tasks/`。
- 服务器本机验证：`curl -fsS http://127.0.0.1:18080/health` 返回 `{"status":"ok"}`；远端 `manifest.json` 标题为“召唤师战争灰烬派系代表性真实入口 E2E”，图片数 11。
- 公网验证：`Invoke-WebRequest http://8.148.71.102:18080/#/boardgame/summonerwars-huijin-e2e` 返回 200；Playwright 移动视口打开相册并逐张右翻，11 张图片均为 1920x1080 且可加载，首图标题“灰烬阵营入口可见”，末图标题“快速射击：伤害完成”。

## 完整技能流程矩阵

| 对象 | 真相源 | 静态定义 | 候选/入口 | 命令/执行 | 消耗/限制 | 主效果 | 分支/否定 | 后续清理 | 证据层级 | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 玛达莉雅女王・威势 | 攻击后每回合一次充能 | `SUMMONER_HUIJIN.abilities` 复用 `intimidate` | 攻击后自动触发 | 成熟攻击后能力链 | 每回合一次来源仍由旧能力控制 | 给召唤师加 1 充能 | 非攻击后不应触发 | 不创建新交互，无交互残留 | L1/L2；L3 复用成熟旧链 | passed |
| 玛达莉雅女王・召集护卫 | 攻击阶段结束，可花 1 充能召唤手牌士兵到相邻空格 | `huijin_call_guards`、`payloadContract.required=['cardId','position']` | `huijin_call_guards_select_card` -> `huijin_call_guards_select_position` | `systems.ts` 二段 simple-choice，`executors/huijin.ts` 产出 `UNIT_CHARGED` 与 `UNIT_SUMMONED` | 必须有 1 充能、手牌士兵、召唤师相邻空格；成功时扣 1 充能 | 士兵从手牌进入玛达莉雅女王相邻格 | 合法候选存在时点“跳过”不应消耗充能或召唤；非士兵/无相邻空格无效 | `applyPhaseEndResolution` 标记已处理，阶段可继续到魔力阶段，`sys.interaction.current` 清空 | L1/L2/L3/L4 | passed |
| 赫丽丝・怒焰召唤 | 友方灰烬单位可召唤到赫丽丝相邻空格 | `huijin_ember_summon` | 通用召唤位置列表额外出现赫丽丝相邻空格 | `getSummonablePositions` 扩展；召唤命令仍走通用召唤链 | 只允许友方灰烬单位；非灰烬单位不应借用该位置 | 单位进入赫丽丝相邻空格 | 非灰烬负例不提供该位置 | 召唤结束后不产生额外交互 | L1/L2；L3 复用通用召唤 UI | passed |
| 赫丽丝・点燃 | 相邻友方灰烬单位战力 +1 | `huijin_ignite` | 被动，无玩家入口 | `calculateEffectiveStrength` 读取相邻赫丽丝 | 只作用相邻友方灰烬单位；赫丽丝自身和远离单位不应加成 | 有效战力 +1 | 非相邻/非灰烬/自身负例不加 | 无临时状态，无清理项 | L1/L2；L3 N/A | passed |
| 火焰龙兽・护主 | 可召唤到召唤师相邻空格 | `huijin_guard_master` | 通用召唤位置列表额外出现召唤师相邻空格 | `getSummonablePositions` 扩展；召唤命令仍走通用召唤链 | 只作用火焰龙兽自身；普通单位不应复用 | 火焰龙兽进入召唤师相邻格 | 普通单位负例不提供该位置 | 召唤后无额外交互 | L1/L2；L3 复用通用召唤 UI | passed |
| 火焰龙兽・火焰喷吐 | 远程攻击可穿过路径单位，并对路径单位造成同次攻击伤害 | `huijin_flame_breath` | 真实攻击声明入口 | `canAttackEnhanced` 放行穿越单位；`DECLARE_ATTACK` 对路径单位追加伤害事件 | 仅火焰龙兽攻击时生效；目标仍按攻击结算 | 路径单位和目标均承受本次攻击链伤害 | 无此技能时路径阻挡不应被穿过 | 攻击结算后无新交互残留 | L1/L2；L3 复用真实攻击链 | passed |
| 风妮莎・还击 | 被相邻敌方攻击后若仍在场，对攻击者 1 伤 | `huijin_counterattack` | 被攻击后自动触发 | `execute.ts` 攻击后处理产出 `UNIT_DAMAGED` | 风妮莎必须仍在场；攻击者必须相邻 | 攻击者受 1 伤 | 非相邻、风妮莎离场不应触发 | 无交互；伤害后处理继续执行 | L1/L2；L3 N/A | passed |
| 灰烬法师・庇护 | 一回合第一次被攻击最多受 1 伤 | `huijin_shelter` | 被攻击时自动生效 | `DECLARE_ATTACK` 伤害限制分支 | 只限制攻击伤害；同回合第二次被攻击不再限制 | 第一次攻击伤害上限为 1 | 第二次攻击和非攻击伤害不应被限制 | 回合攻击记录随回合清理 | L1/L2；L3 N/A | passed |
| 皇家守卫・缠门 | 相邻敌方离开时受 1 伤 | `entangle` 复用成熟能力 | 敌方移动/推拉离开相邻位自动触发 | 成熟移动后处理链 | 只作用从相邻离开的敌方 | 离开的敌方受 1 伤 | 靠近或保持相邻不应触发 | 无交互残留 | L1/L2；L3 复用旧能力证据 | passed |
| 皇家守卫・冲撞 | 攻击相邻敌方士兵/英雄后，可推拉 1 格 | `huijin_ram`、`payloadContract.required=['targetPosition','newPosition']` | `after_attack_huijin_ram_target` -> `after_attack_huijin_ram_position` | `systems.ts` 二段 simple-choice，`executors/huijin.ts` 产出 `UNIT_PUSHED` | 目标必须相邻、敌方、士兵或英雄；落点必须相邻空格 | 目标移动到玩家选择的相邻空格 | 目标选择跳过或落点选择跳过都不应移动；召唤师/建筑/非相邻目标无效 | 交互清空，不重复推拉 | L1/L2/L3/L4 | passed |
| 灰烬野兽・烈火降生 | 灰烬野兽可召唤到友方灰烬单位相邻空格 | `huijin_born_of_flame` | 通用召唤位置列表额外出现友方灰烬单位相邻空格 | `getSummonablePositions` 扩展；召唤命令仍走通用召唤链 | 只作用灰烬野兽自身；来源必须是友方灰烬单位 | 灰烬野兽进入友方灰烬单位相邻格 | 非灰烬来源不应外推 | 召唤后无额外交互 | L1/L2；L3 复用通用召唤 UI | passed |
| 灰烬野兽・野火 | 移动阶段开始时对每个相邻敌方 1 伤 | `huijin_wildfire`、`PHASE_START_ABILITIES.move` | 移动阶段开始自动触发 | `flowHooks.ts` 阶段触发，伤害后处理进入 `execute/helpers.ts` | 只作用相邻敌方；友方和非相邻单位不应受伤 | 每个相邻敌方受 1 伤，可被凤凰之魂增幅 | 无相邻敌方时不应误伤 | 自动链无交互残留，阶段继续推进 | L1/L2/L4；L3 N/A | passed |
| 灰烬弓箭手・快速射击 | 移动后，可指定 3 格直线视野内一个单位造成 1 伤 | `huijin_quick_shot`、`payloadContract.required=['targetPosition']` | `after_move_huijin_quick_shot` | `systems.ts` simple-choice，`executors/huijin.ts` 产出 `UNIT_DAMAGED` | 目标必须是其他单位、3 格内、直线、路径无遮挡 | 目标受 1 伤 | 合法候选存在时点“跳过”不应造成伤害；非直线/超距/阻挡无效 | 移动结果保留，交互清空，不重复伤害 | L1/L2/L3/L4 | passed |
| 炫目光芒 | 持续事件：召唤师或相邻友方被攻击时按特殊标记数结算伤害 | `huijin-dazzling-light` active event | 事件打出后持续生效 | `eventCards.ts` 入场；`execute.ts` 攻击命中替换 | 只作用召唤师或相邻友方；非相邻友方不应扩大 | 攻击伤害按特殊标记数量替换 | 普通命中数不应同时叠用 | 持续事件保留，无交互残留 | L1/L2；L3 复用事件打出/攻击 UI | passed |
| 灼烧 | 召唤阶段指定召唤师 2 格内士兵或英雄，造成 2 伤 | `huijin-scorch` event | 事件牌目标选择入口 | `eventCards.ts` 目标伤害，`actionLog.ts` 来源解析 | 目标必须在召唤师 2 格内且为士兵或英雄；事件打出后进弃牌 | 目标受 2 伤 | 超距/非单位目标不应生效 | 事件结算完成后无交互残留 | L1/L2；L3 复用事件目标选择 UI | passed |
| 神族复仇 | 持续事件：召唤师被攻击后对攻击者 1 伤 | `huijin-divine-revenge` active event | 事件打出后持续生效 | `eventCards.ts` 入场；`execute.ts` 攻击后处理 | 召唤师必须被攻击且仍在场 | 攻击者受 1 伤 | 召唤师未被攻击不应触发 | 无交互残留，伤害后处理继续执行 | L1/L2；L3 复用事件打出/攻击 UI | passed |
| 凤凰之魂 | 传奇持续事件：友方单位技能以非攻击方式对敌方单位造成伤害时额外 1 伤 | `huijin-phoenix-soul` active event | 事件打出后持续生效 | `execute/helpers.ts` `HUIJIN_PHOENIX_SOUL_UNIT_DAMAGE_ABILITIES` 后处理 | 只作用友方单位技能的非攻击伤害；普通攻击伤害和已带凤凰加成的伤害不应重复增幅 | 符合条件的技能伤害 +1 | 普通攻击、非单位来源、重复增幅负例不应生效 | 后处理去重，不创建交互 | L1/L2/L4；L3 N/A | passed |
| 起始城门/传送门 | 城门结构与召唤规则 | `STRUCTURE_CARDS_HUIJIN`、`createHuijinDeck()` | 起始棋盘和通用召唤建筑规则 | 牌组工厂和既有建筑规则链 | 起始城门只进起始配置；传送门进牌库 3 张 | 城门生命和召唤入口沿用现有规则 | 空白 slot 不应生成结构卡 | 无灰烬专属交互残留 | L0/L1/L2/L3 | passed |

## L0-L4 层级矩阵

| 对象/链路 | L0 图源 | L1 静态配置 | L2 领域行为 | L3 真实入口 | L4 生命周期/治理 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 派系入口与起始棋盘 | `hero.png`、`tip.jpg`、`cards.jpg` SHA256 已记录 | `huijin` 派系、起始牌局、AI profile、音频枚举、图集注册已接入 | `factions.test.ts` 和牌组工厂验证 | 灰烬阵营入口 E2E 截图看到玛达莉雅女王、灰烬弓箭手、皇家守卫 | 截图相册 11 张可加载，旧批次不覆盖本派系 | passed |
| 图集与结构卡 | slot 0-15 合同已锁定 | `SPRITE_INDEX_HUIJIN` 只登记 slot 0-10；结构卡区分起始城门/传送门 | `factions.test.ts` 覆盖定义与牌组数量 | 起始城门在开局棋盘可见 | 空白 slot 不生成对象；manifest 与远端 HEAD 200 | passed |
| 召集护卫 | 卡图和规则子句 C1-C5 已锁定 | `huijin_call_guards` 能力、执行器、二段交互类型已注册 | `abilities-huijin.test.ts` 成功/无充能/非士兵；`interaction-chain-comprehensive.test.ts` 成功与跳过 | E2E 从攻击阶段结束触发，页面点击手牌士兵和相邻空格 | finalState 证明充能扣减、手牌离开、单位上场、阶段可继续、无交互残留 | passed |
| 召唤位置扩展 family | 赫丽丝、火焰龙兽、灰烬野兽图文合同已锁定 | `huijin_ember_summon`、`huijin_guard_master`、`huijin_born_of_flame` 已挂到对应单位 | 领域测试覆盖合法位置和非灰烬/普通单位负例 | 复用通用召唤 UI；无新增 UI 控件 | 共享 helper 判等通过，差异仅为来源/目标筛选条件 | passed |
| 自动攻击/伤害 family | 火焰喷吐、还击、庇护、炫目光芒、神族复仇图文合同已锁定 | 能力/事件定义和伤害来源解析已接入 | 领域测试覆盖路径伤害、攻击后还击、首次攻击上限、持续事件伤害 | 复用真实攻击/事件打出 UI；无新增灰烬 UI 类型 | 伤害来源、攻击后处理、非攻击负例和同回合清理已覆盖 | passed |
| 阶段/移动自动 family | 野火图文合同已锁定 | `PHASE_START_ABILITIES.move` 注册 | 领域测试覆盖相邻敌方伤害与凤凰之魂组合 | 无玩家入口，L3 N/A | 阶段自动触发后流程继续，伤害后处理去重 | passed |
| 冲撞 | 皇家守卫图文合同 C1-C6 已锁定 | `huijin_ram` 能力、执行器、二段交互类型已注册 | 成功、召唤师、非相邻、占用落点、跳过目标、跳过落点均有行为证据 | E2E 从真实攻击后触发并完成推拉 | finalState 证明目标位置改变、无重复推拉、交互清空 | passed |
| 快速射击 | 灰烬弓箭手图文合同 C1-C6 已锁定 | `huijin_quick_shot` 能力、执行器、移动后交互已注册 | 成功、非直线、超距、阻挡、跳过均有行为证据 | E2E 从真实移动后触发并造成伤害 | finalState 证明移动保留、伤害落地、无重复伤害、交互清空 | passed |
| 事件牌 family | 炫目光芒、灼烧、神族复仇、凤凰之魂图文合同已锁定 | 事件定义、playPhase、isActive、日志来源已接入 | 灼烧、持续攻击替换、神族复仇、凤凰之魂均有领域行为证据 | 事件打出/目标选择 UI 为成熟共享链 | 持续事件来源归属、非攻击技能增幅和重复增幅负例已覆盖 | passed |
| 旧结论对账 | 旧 evidence 搜索未命中灰烬完成文档 | OpenSpec 只作为本轮新增变更记录 | 当前代码与测试替代旧状态判断 | 当前 E2E 截图相册为本轮真实入口证据 | 无需要原地降级的灰烬旧 evidence；生产发布另走发布流程 | passed |

## D 维度命中记录

| 维度 | 本轮命中原因 | 证据与结论 |
| --- | --- | --- |
| D1 语义保真 | 每个灰烬技能和事件都来自卡图/提示图子句 | `规则子句表与逐项结论`、`完整技能流程矩阵` 覆盖时机、目标、数值和限制，passed |
| D2 边界完整 | 召唤位置、直线视野、相邻、单位类型、非攻击技能伤害均有限定 | `abilities-huijin.test.ts` 覆盖非灰烬、普通单位、召唤师、非相邻、超距、阻挡等负例，passed |
| D3 数据流闭环 | 定义、注册、执行器、状态、UI、i18n、日志均需闭环 | `huijin.ts`、`abilities-huijin.ts`、`executors/huijin.ts`、`systems.ts`、`actionLog.ts` 与测试记录对齐，passed |
| D4 查询一致性 | 点燃修改有效战力 | `calculateEffectiveStrength` 使用统一战力修正链，赫丽丝自身/远离单位负例通过，passed |
| D5 交互完整 | 召集护卫、冲撞、快速射击是玩家选择链 | L2 行为测试和真实入口 E2E 覆盖选择、跳过、最终权威状态，passed |
| D7 资源守恒 | 召集护卫消耗充能，事件卡进弃牌，跳过不消耗 | 召集护卫成功/跳过测试分别证明扣充能和不扣充能，passed |
| D8 时序正确 | 阶段结束、移动后、攻击后、攻击结算后、持续事件后处理 | 阶段推进、攻击后处理、移动后触发、无交互残留均已验证，passed |
| D10 元数据一致 | 凤凰之魂只增幅指定技能伤害，日志来源可解析 | 伤害来源解析和 `HUIJIN_PHOENIX_SOUL_UNIT_DAMAGE_ABILITIES` 合同已覆盖，passed |
| D12 写入-消耗对称 | 交互 payload 写入字段必须被执行器消费 | `payloadContract.required` 与 `systems.ts` option value、`executors/huijin.ts` 消费字段一致，passed |
| D14 回合清理完整 | 灰烬法师庇护只限制本回合第一次攻击 | 同回合第二次攻击不再限制的行为测试通过，passed |
| D15 UI 状态同步 | 召唤位置、快速射击候选、图集 slot 与 UI 可见态需一致 | E2E 截图和图集合同验证灰烬入口、开局单位、手牌/棋盘选择，passed |
| D18 否定路径 | 可选/跳过/非法目标都需要证明不生效 | 三条新跳过测试与多条非法目标测试通过，passed |
| D21 触发频率门控 | 威势每回合一次、召集护卫阶段结束只处理一次 | 成熟威势复用和 `applyPhaseEndResolution` 收口记录覆盖，passed |
| D22 伤害计算管线配置 | 火焰喷吐、还击、庇护、野火、快速射击、事件伤害 | 攻击伤害、技能伤害、持续事件伤害均有最终状态断言，passed |
| D23 架构假设一致性 | 特殊召唤位置、穿透攻击、阶段触发不能靠硬编码 UI | 共享 helper 扩展和行为测试证明规则层到 UI 同源，passed |
| D33 跨实体同类能力实现路径一致性 | 三类召唤扩展、多个自动伤害对象复用共享链 | 共享链判等矩阵登记代表对象与差异仅配置项，passed |
| D34 交互选项 UI 渲染模式正确性 | 二段/单段 simple-choice 需要按钮与棋盘目标明确 | option value 不混入无用 defId；E2E 看到手牌、棋盘目标、跳过按钮，passed |
| D39 流程控制/阶段收口 | 阶段结束技能和移动/攻击后交互不能卡阶段 | 召集护卫跳过后阶段可继续；冲撞/快速射击交互清空，passed |
| D52 权威可视合同一致性 | `cards.jpg`、`hero.png`、`tip.jpg` 直接决定对象和 slot | 图集合同、起始配置、结构卡合同、截图核验均一致，passed |
| D55 共享合同多消费者一致性 | 召唤位置/攻击/移动后候选被 validator、AI、UI、执行器共同消费 | 候选 helper、执行器合同、L2/L3 验证对齐，passed |

## 框架消费合同矩阵

| 对象/家族 | 共享 resolver / system / helper | 消费字段或枚举 | 自动合同测试 / 行为测试 | 命中旧对象及处理结论 | 结论 |
| --- | --- | --- | --- | --- | --- |
| 召集护卫 | `SimpleChoiceSystem`、`abilityExecutorRegistry`、`applyPhaseEndResolution` | `sourceId=huijin_call_guards`、`targetType=hand/minion`、`cardId`、`position`、`skip` | `[huijin_call_guards] 真实结束阶段...`、`[huijin_call_guards] 合法手牌存在时跳过...` | 同类阶段结束技能：冰片、喂养野兽、魔古寄生虫；灰烬为新增来源，不改旧对象合同 | passed |
| 冲撞 | `SimpleChoiceSystem`、`abilityExecutorRegistry`、攻击后处理 | `sourceId=huijin_ram`、`targetType=minion`、`targetPosition`、`newPosition`、`skip` | `[huijin_ram] 合法目标存在时跳过...`；`abilities-huijin.test.ts` 冲撞成功与负例 | 同类推拉链：寒冰冲撞、心灵传动；灰烬目标筛选不同但 payload 合同同构 | passed |
| 快速射击 | `SimpleChoiceSystem`、`abilityExecutorRegistry`、移动后处理 | `sourceId=huijin_quick_shot`、`targetType=minion`、`targetPosition`、`skip` | `[huijin_quick_shot] 合法目标存在时跳过...`；快速射击直线/超距/阻挡测试 | 同类移动后选择链：抓附、结构转移；灰烬为伤害消费者，不改旧链 | passed |
| 召唤位置扩展 | `getSummonablePositions` / `helpers.ts` | `unitCard.abilities`、友方灰烬单位、召唤师相邻、赫丽丝相邻 | `abilities-huijin.test.ts` 三条召唤位置扩展正负例 | 通用召唤 UI 和 AI 行动生成同源；旧召唤对象不受灰烬筛选条件影响 | passed |
| 攻击/伤害后处理 | `DECLARE_ATTACK`、`appendHuijinPhoenixSoulEvents`、`swDamageSourceResolver` | `sourceAbilityId`、`sourcePlayerId`、`damage`、事件牌 `isActive` | 火焰喷吐、还击、庇护、炫目光芒、神族复仇、凤凰之魂领域测试 | 复用成熟攻击链；灰烬只新增来源和筛选条件 | passed |
| 资源与图集 | `CardPreview` / 图集注册 / manifest resolver | `spriteAtlas`、`spriteIndex`、manifest key、压缩资源路径 | `factions.test.ts`、manifest 校验、远端 HEAD 200、E2E 截图 | 旧 SummonerWars 图集合同不被覆盖，灰烬独立 atlas | passed |

## L4 共享链判等矩阵

| 对象 | 共享链名称 | 代表对象 | 是否仅配置不同 | 判等依据 | 剩余差异 / 残余风险 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 威势 | 成熟攻击后充能链 | 既有召唤师 `intimidate` | 是 | 灰烬只在召唤师能力数组复用旧 ability id，不新增 handler、payload 或 UI | 差异仅为持有者是玛达莉雅女王 | passed |
| 缠门 | 成熟相邻离开伤害链 | 既有 `entangle` 单位 | 是 | 皇家守卫只复用旧 ability id；移动离开事件、伤害和负例均属旧链 | 差异仅为卡牌持有者和图集 slot | passed |
| 怒焰召唤 / 护主 / 烈火降生 | 通用召唤位置扩展链 | 召唤位置 helper family | 是 | 三者均只向同一召唤位置 helper 增加来源筛选；召唤命令和 UI 仍走通用链 | 差异为来源单位、可召唤单位和相邻锚点 | passed |
| 火焰喷吐 / 庇护 / 炫目光芒 | 成熟攻击结算链 | 召唤师战争攻击结算 | 是 | 均消费 `DECLARE_ATTACK` 的攻击骰/命中/伤害事件；灰烬新增来源和替换规则，不新增 UI 类型 | 差异为伤害限制或替换公式；领域行为已覆盖 | passed |
| 还击 / 神族复仇 | 攻击后自动伤害链 | 攻击后处理 family | 是 | 均在攻击结算后检查来源和目标仍在场，再写入伤害事件 | 差异为触发宿主：风妮莎或召唤师持续事件 | passed |
| 野火 / 凤凰之魂 | 非攻击技能伤害后处理链 | 技能伤害后处理 family | 是 | 野火先产生技能伤害，凤凰之魂后处理按来源集合增幅；同一 finalState 验证伤害叠加 | 差异为自动触发时机和增幅来源 | passed |
| 灼烧 | 事件牌目标伤害链 | 成熟事件牌目标选择/伤害链 | 是 | 召唤阶段打出、目标过滤、伤害和弃牌均沿用事件牌执行框架 | 差异为 2 格范围和 2 点伤害 | passed |
| 召集护卫 | 灰烬二段阶段结束召唤链 | 自身 direct L3/L4 | 否，已做独立 direct | 新交互类型命中手牌选择 + 棋盘落点二段链，不能只借旧对象 | 成功和跳过均已单独验证 | passed |
| 冲撞 | 灰烬二段攻击后推拉链 | 自身 direct L3/L4 | 否，已做独立 direct | 攻击后目标选择 + 落点选择 + 推拉 finalState | 成功和两个跳过分支均已单独验证 | passed |
| 快速射击 | 灰烬移动后伤害链 | 自身 direct L3/L4 | 否，已做独立 direct | 移动后目标选择 + 直线视野伤害 finalState | 成功和跳过均已单独验证 | passed |

## 旧 evidence / 旧结论对账与修订记录

| 对账范围 | 检索命中 | 当前裁定 | 修订动作 |
| --- | --- | --- | --- |
| `evidence/summonerwars` | 未找到灰烬派系的旧完成文档；命中主要来自本文 | 旧 SummonerWars 审计批次不覆盖灰烬新增派系 | 无需原地降级旧灰烬文档；本文作为当前灰烬 evidence |
| `openspec/changes/add-summonerwars-huijin-faction` | 命中本轮灰烬新增变更 | OpenSpec 是新增范围记录，不替代当前 evidence 和测试结果 | 以本文矩阵和验证记录作为当前代码验证依据 |
| `rule/` 与游戏文档 | 未发现可覆盖灰烬对象级完成状态的旧结论 | 旧规则或旧批次描述不能证明灰烬当前状态 | 当前结论只基于本轮代码、测试、E2E 和资源证据 |
| 截图 evidence | 当前灰烬截图相册为本轮新产物 | 旧截图不参与灰烬收口裁定 | 本文记录本地截图根目录、联系表和公网相册验证 |

## 禁止假阳性检查

| 检查项 | 核对结果 | 结论 |
| --- | --- | --- |
| 是否把阵营选择页或静态展示当作玩法收口 | 没有；阵营入口只用于证明派系可选和起始棋盘可见，玩法收口另由召集护卫、冲撞、快速射击 direct E2E 与 L2 测试证明 | passed |
| 是否把测试中出现 id / 注册覆盖当作行为完整 | 没有；每个运行时效果都在 `abilities-huijin.test.ts` 或 `interaction-chain-comprehensive.test.ts` 有最终权威状态断言 | passed |
| 是否用注入型 interaction 直接冒充真实入口玩法证据 | 没有；E2E 使用真实 online match、状态注入到规则位点后通过页面点击触发，不直接发响应命令冒充 UI 点击 | passed |
| 是否只证明 prompt 出现、未证明最终权威状态变化 | 没有；召集护卫断言手牌/棋盘/充能/阶段，冲撞断言目标位置，快速射击断言伤害与交互清空 | passed |
| 是否用一条代表链外推全部新增交互 | 没有；三个新增灰烬交互对象分别有 direct L3/L4，静态/自动对象才登记共享链判等依据 | passed |
| 是否忽略合法候选存在时的跳过/拒绝路径 | 没有；召集护卫、冲撞、快速射击均补合法候选存在时跳过不改变最终权威状态的行为测试 | passed |

## 残余范围声明

| 边界 | 当前状态 | 说明 |
| --- | --- | --- |
| 当前代码验证范围 | passed | 灰烬新增派系对象全集、资源链、机制、L2 行为、关键 L3/L4 真实入口、共享链判等和 evidence 对账均已收口 |
| 生产部署状态 | 不属于当前代码验证范围 | 本文只证明当前仓库代码和当前资源主源证据；生产部署、正式发布、线上版本覆盖由发布流程另行证明 |
| 服务器素材主源 | passed | 三个灰烬压缩资源和 Android 差异索引均已有 HEAD 200 或上传记录 |
| 旧证据风险 | passed | 没有发现灰烬旧完成文档需要降级；旧 SummonerWars 批次结论不覆盖灰烬 |
| 未冻结风险 | 无 | 当前 evidence 没有登记需要用户冻结的灰烬对象级范围 |

## 验证记录

| 命令/检查 | 结果 |
| --- | --- |
| `npx eslint src/games/summonerwars/config/factions/huijin.ts ... src/games/summonerwars/__tests__/factions.test.ts` | 0 errors；`audio.config.ts` 存在既有未使用常量 warnings |
| `npx vitest run src/games/summonerwars/__tests__/factions.test.ts` | 17 tests passed |
| `npm run compress:images -- public/assets/i18n/zh-CN/summonerwars/hero/huijin` | 成功，3 张 WebP |
| `node scripts/assets/generate_asset_manifests.js --root public/assets/i18n/zh-CN --id summonerwars` | 成功 |
| `node scripts/assets/generate_asset_manifests.js --id i18n` | 成功 |
| `node scripts/assets/generate_asset_manifests.js --validate --root public/assets/i18n/zh-CN --id summonerwars` | 通过 |
| `node scripts/assets/generate_asset_manifests.js --validate --id i18n` | 通过 |
| `node scripts/assets/upload-to-server.js --check --asset-prefix i18n/zh-CN/summonerwars/hero/huijin` | 命中 3 个对象 |
| `node scripts/assets/upload-to-server.js --asset-prefix i18n/zh-CN/summonerwars/hero/huijin` | 第二次执行成功 |
| `npx vitest run src/games/summonerwars/__tests__/abilities-huijin.test.ts` | 16 tests passed |
| `npx vitest run src/games/summonerwars/__tests__/phase-ability-integration.test.ts src/games/summonerwars/__tests__/factions.test.ts` | 105 tests passed |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/strength-breakdown.property.test.ts --config vitest.config.audit.ts --configLoader native` | 11 tests passed |
| `npx eslint src/games/summonerwars/domain/abilities-huijin.ts src/games/summonerwars/domain/abilityResolver.ts src/games/summonerwars/domain/flowHooks.ts src/games/summonerwars/domain/execute.ts src/games/summonerwars/domain/execute/eventCards.ts src/games/summonerwars/actionLog.ts src/games/summonerwars/__tests__/abilities-huijin.test.ts src/games/summonerwars/__tests__/strength-breakdown.property.test.ts` | 0 errors；`abilityResolver.ts` 存在既有 `any`/未用类型 warnings |
| `npx vitest run src/games/summonerwars/__tests__/abilities-huijin.test.ts src/games/summonerwars/__tests__/phase-ability-integration.test.ts src/games/summonerwars/__tests__/factions.test.ts src/games/summonerwars/__tests__/validate.test.ts` | 172 tests passed |
| `npx eslint src/games/summonerwars/domain/helpers.ts src/games/summonerwars/domain/execute.ts src/games/summonerwars/domain/execute/helpers.ts src/games/summonerwars/domain/flowHooks.ts src/games/summonerwars/actionLog.ts src/games/summonerwars/__tests__/abilities-huijin.test.ts` | 0 errors；`helpers.ts` 存在既有未用私有函数 warning |
| `node -e "JSON.parse(require('fs').readFileSync('public/locales/zh-CN/game-summonerwars.json','utf8')); JSON.parse(require('fs').readFileSync('public/locales/en/game-summonerwars.json','utf8')); console.log('locale json ok')"` | locale json ok |
| `npx tsc --noEmit --pretty false` | 通过 |
| `openspec validate add-summonerwars-huijin-faction --strict --no-interactive` | valid |
| `npx vitest run src/games/summonerwars/__tests__/abilities-huijin.test.ts` | 22 tests passed |
| `npx vitest run src/games/summonerwars/__tests__/abilities-huijin.test.ts src/games/summonerwars/__tests__/phase-ability-integration.test.ts src/games/summonerwars/__tests__/factions.test.ts src/games/summonerwars/__tests__/validate.test.ts` | 182 tests passed |
| `npx eslint src/games/summonerwars/domain/abilities-huijin.ts src/games/summonerwars/domain/executors/huijin.ts src/games/summonerwars/domain/executors/index.ts src/games/summonerwars/domain/execute.ts src/games/summonerwars/domain/flowHooks.ts src/games/summonerwars/domain/systems.ts src/games/summonerwars/domain/abilityResolver.ts src/games/summonerwars/actionLog.ts src/games/summonerwars/__tests__/abilities-huijin.test.ts` | 0 errors；`abilityResolver.ts` 存在既有 `TargetRef` 未用与 `any` warnings |
| `npx vitest run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts` | 139 tests passed；stderr 为既有拒绝路径用例输出 |
| `openspec validate add-summonerwars-huijin-faction --strict --no-interactive` | valid |
| `npx tsc --noEmit --pretty false` | 通过 |
| `npx eslint src/games/summonerwars/domain/execute.ts src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts e2e/summonerwars/summonerwars-huijin-abilities.e2e.ts` | 0 errors；`interaction-chain-comprehensive.test.ts` 存在既有 unused warnings |
| `npx vitest run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts -t "huijin_call_guards"` | 1 test passed |
| `node scripts/infra/run-e2e-single.mjs ci e2e/summonerwars/summonerwars-huijin-abilities.e2e.ts "召集护卫：阶段结束后真实手牌选择并召唤到相邻空格"` | 1 passed |
| `npx vitest run src/games/summonerwars/__tests__/useGameEvents.test.ts src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts` | 176 tests passed；stderr 为既有拒绝路径用例输出 |
| `node scripts/infra/run-e2e-command.mjs ci e2e/summonerwars/summonerwars-huijin-abilities.e2e.ts` | 4 passed；包含灰烬入口、召集护卫、冲撞、快速射击 |
| `npm run audit:evidence:selfcheck -- evidence/summonerwars/summonerwars-huijin-intake-2026-07-16.md` | checked files: 1；audit docs: 1；OK |
| `npx eslint src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts` | 0 errors；7 个既有 unused warnings |
| `npx vitest run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts -t "huijin"` | 4 tests passed；139 skipped |

## Evidence 审计后自检命令记录

| 命令 | 结果 | 处理 |
| --- | --- | --- |
| `npm run audit:evidence:selfcheck -- evidence/summonerwars/summonerwars-huijin-intake-2026-07-16.md` | `[audit-evidence-completeness] OK` | 自检通过，本文可保留“当前代码验证口径已收口”口径 |

## 当前结论

录入阶段已锁定素材、图集顺序、卡名、基础数值、起始单位和规则子句。静态运行时接入、资源压缩、manifest、服务器上传与远端回查已完成。当前 L2 机制已覆盖威势、召集护卫、缠门、冲撞、点燃、庇护、还击、野火、快速射击、灼烧、神族复仇、怒焰召唤、护主、烈火降生、火焰喷吐、炫目光芒、凤凰之魂。L4 交互收口已覆盖召集护卫、冲撞、快速射击的成功路径和跳过路径。真实入口 E2E 已补齐灰烬阵营入口、召集护卫、冲撞、快速射击，并完成截图核验与预览相册发布。当前代码验证口径已收口；生产部署和正式发布仍由发布流程另行证明。
