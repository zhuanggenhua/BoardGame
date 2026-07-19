# 召唤师战争新派系 Intake Workflow

## 适用范围

用于把 `public/assets/i18n/<locale>/summonerwars/hero/<faction>/` 中的召唤师、卡牌图集和提示板接入为完整可玩派系。该流程承接 `.codex/skill/add-new-faction/SKILL.md` 与 `.codex/skill/data-entry-workflow/SKILL.md`，不替代通用资源、审计和 E2E 门禁。

## S0：锁定输入

1. 确认当前 worktree、派系目录、运行时 faction ID 和交付范围。
2. 记录 `cards`、`hero`、`tip` 的尺寸、bytes、sha256 和用途。
3. 以完整单卡/召唤师图负责名称、数值和规则；提示板负责起始对象、位置和史诗事件数量。
4. 若提示板与单卡名称冲突，建立旧译名映射，运行时名称以完整单卡为准。

## S1：图集与对象合同

1. 先确认图集行列、单格尺寸、有效槽和空白槽，再生成 `temp/` 裁图。
2. 逐槽登记卡名、职业、费用、生命、战力、攻击类型、牌组符号、事件阶段与规则原文。
3. 每项规则拆成 C1/C2/C3 原子子句，明确时机、目标、强制/可选、消耗、主效果、否定路径和清理。
4. 建立可视合同：`slot -> 运行时对象 -> 允许状态 -> 是否可交互`；空白槽不得生成卡牌或进入卡池。
5. 起始配置必须同时锁定召唤师、10 生命城门、起始单位、位置和传奇事件 x2。

## S2：静态接入

必须同步：

- `domain/types.ts` 与 `domain/ids.ts`
- `config/symbols.ts`、`config/factions/<id>.ts`、`config/factions/index.ts`
- `config/cardRegistry.ts`、AI profile、音频能力枚举
- `ui/cardAtlas.ts`、`criticalImageResolver.ts`
- 中英文 `game-summonerwars.json`

预构筑牌组必须包含：3 名英雄、4 类士兵各 4 张、3 类普通事件各 2 张、传奇事件 2 张、普通城门 3 张；召唤师、起始城门和两名起始单位不进入普通抽牌堆。

## S3：机制实现

1. 先反查共享 resolver/system/validator 实际消费字段，再决定配置复用或新增机制。
2. 所有等待玩家输入的能力进入 `sys.interaction`；不得只写 React 本地 mode。
3. 新增 `sys.interaction` 时必须同步接入玩家可见提示：横幅或同等主交互槽位要说明当前能力、候选对象、点击后果和跳过后果；不得只接棋盘高亮或 skip 按钮。
4. 可选能力必须在合法候选存在时提供 skip，并验证 skip 不改变权威状态。
5. 攻击掷骰、伤害、推拉、额外攻击和持续事件必须验证最终状态与生命周期清理，不能停在 prompt 出现。
6. 新交互类型必须补首条 direct E2E。

## S4：资源与验证

1. 使用 runtime 模式压缩，不降采样。
2. 显式重建游戏级与根级 i18n manifest，并检查新键真实存在。
3. 单派系使用 `--asset-prefix i18n/<locale>/summonerwars/hero/<faction>` 预检、上传和 HEAD 回查。
4. L2 测试逐对象覆盖正向、负向、可选跳过和清理。
5. 真实入口 E2E 至少覆盖派系可选、开局对象正确和每类新交互的前态/交互态/结算态。
6. 新交互截图必须从玩家视角读得出：当前触发哪个能力、哪里可点、点了会发生什么、跳过会发生什么；按钮存在、测试通过或日志正确不能替代这项验收。
7. 最终 evidence 按对象列出规则子句、完整流程、L0-L4、D 维度、共享消费合同、截图核验和残余范围。
