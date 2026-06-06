## Context

Smash Up 当前把下列不同语义挤在 `special` 一组字段与标签里：

- 牌面文案写了 `Special:`
- 场上实体存在玩家可手动点击的 `ACTIVATE_SPECIAL`
- 手牌中的牌可在 `meFirst / afterScoring` 响应窗口打出
- 弃牌区 / 牌库旁等非场上区域可手动触发
- 到时机后由 trigger 自动开出交互
- AI 将其视为“反应型牌”

当前代码中最主要的耦合点包括：

- `abilityTags.special` 被 `commands.ts` 用于 `ACTIVATE_SPECIAL`
- `Board.tsx` / `BaseZone.tsx` 基于 `validate(ACTIVATE_SPECIAL)` 产出高亮
- `game.ts` / `utils.ts` 用 `subtype === 'special'`、`responseWindowTiming`、`beforeScoringPlayable` 混合推断响应窗口内容
- `ai.ts` / `aiProfiles.ts` 把 `special` 当成 reactive 特征
- 一部分牌面写了 `Special:`，但真实入口是 `registerTrigger(...)` 或 `duel` / `discard special provider` 等外部上下文

## Goals / Non-Goals

- Goals:
  - 消除“牌面有 `Special:` 就可能被当成场上可点击 special”的错误推断
  - 让 UI 高亮、命令校验、响应窗口可响应性依赖显式入口模型，而不是文案/标签关键词
  - 允许删除错误 `special` 标签而不破坏 trigger 驱动或外部上下文驱动的真实能力
  - 为数据录入提供稳定、可审计的语义边界
- Non-Goals:
  - 不重写已有 ability executor / trigger 业务语义
  - 不重构非 Smash Up 游戏的能力系统
  - 不在本次 change 内统一清洗所有历史中文文案噪声

## Decisions

### Decision: 将“能力语义”与“可用入口语义”拆成两层

保留 `abilityTags` 用于描述能力/效果类别，不再让 `special` 直接承担运行时入口语义。

运行时入口统一改为显式入口配置，最小模型建议如下：

```ts
type SmashUpManualAbilityKind = 'special' | 'talent' | 'ongoing';
type SmashUpManualAbilityZone = 'board' | 'discard' | 'setaside';
type SmashUpResponseWindowTiming = 'beforeScoring' | 'afterScoring';

interface SmashUpManualAbilityEntry {
  kind: SmashUpManualAbilityKind;
  zone: SmashUpManualAbilityZone;
  phase?: 'playCards' | 'scoreBases';
  requiresBase?: boolean;
  limitGroup?: string;
}

interface SmashUpResponseWindowPlayEntry {
  sourceZone: 'hand';
  timing: SmashUpResponseWindowTiming;
  requiresBase?: boolean;
  limitGroup?: string;
}
```

建议先将其加到 `MinionCardDef / ActionCardDef / FusionCardDef / TitanCardDef` 的 Smash Up 消费路径上，再视后续复用情况决定是否上升到引擎通用层。

### Decision: Trigger 驱动的 `Special:` 文案不再声明为 manual special

对于 `alien_scout`、`cthulhu_chosen`、`pirate_king`、`cowboys_sheriff`、`skeletons_gravestones`、`mermaids_shipwreck_cove` 这类牌：

- 牌面可以继续写 `Special:`
- 真实入口由 `registerTrigger(...)` 或外部系统上下文驱动
- 不再通过 `abilityTags.special` 或 `manualAbilityEntry(kind='special', zone='board')` 暴露为场上可点击能力

### Decision: 响应窗口打牌统一显式建模，不再靠 subtype/标签猜测

对当前从手牌响应窗口打出的牌，统一使用 `responseWindowPlay` 入口表达，不再让下列字段在运行时承担猜测职责：

- `abilityTags.special`
- `ActionCardDef.subtype === 'special'`
- `responseWindowTiming`
- `beforeScoringPlayable`

迁移期允许这些旧字段保留，但所有新 helper 都应优先读新入口模型，旧字段仅用于兼容回退与迁移审计。

### Decision: 外部上下文入口继续留在 provider / interaction 层，不强塞回通用 special

`cowboys_deputy`、`world_champs_eh`、`skeletons_revenant` 这类卡的真实入口依赖 duel、discard provider 或其他外部上下文。

这类卡不应因为牌面写 `Special:` 就被塞回“场上 manual special”统一桶。新模型下：

- 若是通用 discard/setaside manual，可用 `manualAbilityEntry.zone`
- 若是 duel/特定上下文触发，继续由现有 provider / interaction handler 负责
- 数据层不再用 `abilityTags.special` 为这类上下文兜底

## Risks / Trade-offs

- 风险：迁移中同时存在新旧字段，容易再次出现“双入口都在读”的回归。
  - Mitigation: helper 层统一收口，新代码只读新模型；增加“新旧字段冲突即失败”的审计测试。
- 风险：部分既有测试把 `special` 误当成可点击语义，会在迁移时大面积失败。
  - Mitigation: 先补分类回归，再按类别更新测试，不按文件盲改。
- 风险：AI 评估会因为 reactive 特征来源变化而影响出牌偏好。
  - Mitigation: AI reactive 改为基于显式入口（manual / response window / trigger-reactive）重新计算，并保留对旧牌组行为的 smoke 回归。

## Migration Plan

1. 新增显式入口类型与 helper，不删旧字段。
2. 迁移 `commands.ts`、`Board.tsx`、`BaseZone.tsx` 到新 manual 入口。
3. 迁移 `game.ts`、`utils.ts`、`MeFirstOverlay`、相关响应窗口 helpers 到新 response-window 入口。
4. 迁移 AI reactive 评估。
5. 逐类迁移数据：
   - 场上 manual
   - 弃牌区/牌库旁 manual
   - 手牌响应窗口打出
   - trigger 驱动 special 文案
   - 明显脏数据
6. 删除对 `abilityTags.special` 的运行时依赖，仅在必要的迁移兼容或审计代码中保留。

## Open Questions

- `ActionCardDef.subtype === 'special'` 是否在最终态继续仅作为“规则书卡种”保留，还是也要拆成更中性的 `subtype + responseWindowPlay` 模型？
- `rulesText` 级别的 `Special:` / `Talent:` 是否需要显式静态字段用于后续审计，还是继续以 locale/牌面为真相源即可？
