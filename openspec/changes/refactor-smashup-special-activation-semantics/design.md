## Context

Smash Up 当前已经存在多套与 `special` 相关的入口：

- `abilityTags.special`
- `beforeScoringPlayable`
- `specialTiming`
- `responseWindowTiming`
- `registerTrigger(..., 'beforeScoring' | 'afterScoring', ...)`
- `registerDiscardSpecialProvider(...)`
- `ACTIVATE_SPECIAL`

问题不在“有没有字段”，而在这些字段没有清晰边界：

- `abilityTags.special` 被同时拿去驱动 UI 高亮、命令校验、AI reactive 打分、审计对账
- 但大量牌的真实入口其实是：
  - `beforeScoringPlayable`（如影舞者）
  - `responseWindowTiming` / `subtype === 'special'`（如手牌特殊行动）
  - `beforeScoring/afterScoring trigger`（如 Grave­stones / Shipwreck Cove）
  - `discard special provider`（如弃牌区 special）

这导致“牌面上写了 `Special:`”经常被误当成“场上可点按能力”。

## Goals / Non-Goals

- Goals:
  - 把“牌面 special 文案”与“运行时 special 入口”拆开
  - 让场上高亮、命令校验、AI 评估都依赖显式运行时入口
  - 保留现有手牌响应窗口、触发器和弃牌区 special 的真实行为
  - 能以增量迁移方式逐批清洗现有 Smash Up 数据
- Non-Goals:
  - 不在本次重构里改写所有 ability executor 的业务逻辑
  - 不尝试统一所有游戏的能力系统；本次只收敛 Smash Up
  - 不要求把 locale 文案解析成运行时真相源

## Decisions

### Decision: `abilityTags` 不再承载 Smash Up special 的运行时入口语义

`abilityTags` 继续保留为高层行为分类，但 `special` 不再作为可激活入口的唯一来源。

保留或继续使用的标签：

- `onPlay`
- `ongoing`
- `talent`
- `extra`

`special` 将从“运行时入口判定”中退出，后续数据迁移时逐步清除不再需要的 `abilityTags.special`。

### Decision: 为 Smash Up 卡牌引入显式 activation metadata

新增一套显式入口建模，用于描述“玩家从哪里、在什么窗口、以什么方式手动使用这张牌的能力”。

建议最小模型：

```ts
type SmashUpActivationKind = 'talent' | 'special' | 'ongoing';
type SmashUpActivationZone = 'board' | 'discard' | 'setaside';
type SmashUpActivationWindow = 'playCards' | 'beforeScoring' | 'afterScoring';

interface SmashUpActivatableAbility {
  kind: SmashUpActivationKind;
  zone: SmashUpActivationZone;
  window?: SmashUpActivationWindow;
}
```

最关键的是：

- 场上手动点击 special：`{ kind: 'special', zone: 'board', window: 'beforeScoring' | 'afterScoring' | 'playCards' }`
- 弃牌区 special：`{ kind: 'special', zone: 'discard', window: 'playCards' | ... }`
- 泰坦牌库旁 special：`{ kind: 'special', zone: 'setaside', window: 'playCards' | ... }`
- 天赋：`{ kind: 'talent', zone: 'board', window: 'playCards' }`

### Decision: 响应窗口从手牌打出继续使用现有显式字段，不塞进 activatable metadata

手牌响应窗口打出已经有稳定字段，不需要再硬塞回统一 `special`：

- 随从：`beforeScoringPlayable`
- 行动牌：`subtype === 'special'`、`specialTiming`
- 非 special 行动牌：`responseWindowTiming`

因此“响应窗口从手牌打出”继续独立于 `ACTIVATE_SPECIAL`。

### Decision: trigger 驱动的 printed `Special:` 不再映射成 manual activation

如：

- `skeletons_gravestones`
- `mermaids_shipwreck_cove`
- `alien_scout`
- `cthulhu_chosen`
- `cowboys_sheriff`

这些牌牌面虽然写 `Special:`，但运行时入口是 trigger，不是玩家点卡。

因此：

- 可以保留文案语义
- 不应进入 `activatableAbilities`
- 不应驱动场上高亮
- 不应通过 `ACTIVATE_SPECIAL` 暴露

### Decision: AI 与窗口可响应性依赖显式入口字段

迁移后：

- AI 的“reactive/scoring-window”不再读 `abilityTags.special`
- `ACTIVATE_SPECIAL` 可用性只读 `activatableAbilities`
- 场上高亮只读 `activatableAbilities`
- 响应窗口是否有可打出内容，继续读 `beforeScoringPlayable` / `specialTiming` / `responseWindowTiming`

## Migration Plan

### Phase 1: 类型与 helper 落地

- 在 `domain/types.ts` 为 Smash Up 卡牌补 `activatableAbilities`
- 为 titans / minions / actions / fusion action/minion 面建立统一 helper
- 把现有 titan `activatableAbilityKinds` 迁到新 helper 兼容层，避免双轨长期并存

### Phase 2: 运行时读点切换

- `commands.ts`
  - `USE_TALENT`
  - `ACTIVATE_SPECIAL`
  - `ACTIVATE_TITAN_ONGOING`
- `Board.tsx` / `BaseZone.tsx`
  - 场上高亮
  - armed activation
- `game.ts`
  - hasRespondableContent（只保留窗口打出语义）
- `ai.ts` / `aiProfiles.ts`
  - 响应牌与 reactive 指标

### Phase 3: 数据迁移

逐类迁移现有卡牌：

- 场上手动 talent
- 场上手动 special
- 弃牌区 special
- 牌库旁 / setaside special
- 响应窗口从手牌打出
- trigger special（移除旧 `abilityTags.special`）
- 脏数据 / 可疑数据

### Phase 4: 审计与验证

- 更新现有 Vitest，不再把 `abilityTags.special` 当运行时真相
- 增补最小 E2E：
  - 窗口手牌响应 special
  - 场上 special 高亮
  - trigger special 不高亮但会触发
  - 弃牌区 special 可用

## Risks / Trade-offs

- 风险：迁移期一旦遗漏读点，容易出现“牌不亮但能用 / 会亮但不能用 / AI 忽略响应牌”
  - Mitigation：先完成 helper 与运行时读点切换，再迁数据；保留回归测试矩阵
- 风险：部分 POD / alias 版本共享能力但数据不同步
  - Mitigation：按 defId 清单迁移，并补 alias 对账测试
- 风险：历史测试写死了 `abilityTags.special`
  - Mitigation：先让测试对齐“入口语义”而不是旧字段

## Open Questions

- 是否需要单独增加 `printedAbilityLabels` 之类字段，用于录入与审计显式保留牌面 `Special:` / `Talent:` 文案分类？
- 是否把 titan 也统一迁到 `activatableAbilities`，还是先保留 titan 专用字段做兼容层？
