## Smash Up 规则引擎实现规范（给未来扩展/AI 用）

> 目标：当以后新增派系 / 基地 / 行动卡时，人或 AI 都能按同一套“事件级规则”实现，不再踩现在已经修过的坑。

### 1. Destroy / onMinionDestroyed 管线

- **主流程**（见 `domain/reducer.ts processDestroyTriggers`）：
  1. 过滤 protection（`isMinionProtected`）；
  2. 汇总本批 `MINION_DESTROYED`（按 `minionUid` 去重）；
  3. **Phase 1：replacement & 防止消灭**
     - 触发基地扩展时机 `onMinionDestroyed`（如 Nine Lives / Crypt / Tar Pits / Field of Honor）；
     - 触发 ongoing replacement 触发器：`fireTriggers(core, 'onMinionDestroyed', ..., { phase: 'replacement' })`；
     - 检测是否产生：
       - `MINION_RETURNED`（回手牌）；
       - `MINION_MOVED`（移到其他基地）；
       - `CARD_TO_DECK_TOP` / `CARD_TO_DECK_BOTTOM`（放回牌库顶/底）；
       - 或 **防止消灭交互**（`sourceId` 在 `PREVENT_DESTROY_SOURCE_IDS` 白名单内，如 `base_nine_lives_intercept`、`giant_ant_drone_prevent_destroy`、`pirate_buccaneer_move`）。
     - 若出现上述任一情况，则视为“消灭被替代/改写”，本次不再确认“已消灭”。
  4. **Phase 2：确认已消灭 → reaction & onDestroy**
     - 仅当本次 **既没有被替代，也没有 pendingSave** 时，才认为该随从“真正被消灭”；
     - 此时才：
       - 将 `onMinionDestroyed` 的 **reaction 型触发器** 入队：`collectTriggers(core, 'onMinionDestroyed', ...)`（如 `vampire_the_count`、`vampire_opportunist`、`robot_microbot_archive`、巨蚁 Worker POD 等）；
       - 执行该随从自身的 `onDestroy` 能力（通过 `resolveOnDestroy`）。
  5. 清理：对已被“替代/拯救/等待拯救”的随从 uid，从原始 `MINION_DESTROYED` 列表中剔除，保证：
     - **不会出现同一随从既“被消灭”又“被移动/回手/进牌库”的双重状态**；
     - “消灭后反应”只在 **真正确认的消灭** 上触发。

- **编码约定：新增 onMinionDestroyed 触发器时，必须先判断：**
  - 若是“防止/替代消灭”（例如：回手牌、移动走、放进牌库、完全防止消灭）：
    - 在 `registerTrigger` 时标记：`{ phase: 'replacement' }`；
    - 若通过交互询问（“你可以……改为”），要把交互 `sourceId` 加入 `PREVENT_DESTROY_SOURCE_IDS` 白名单，让 destroy 管线进入 `pendingSave` 模式；
  - 若是“消灭后反应”（例如：加指示物、抽牌、给 VP、触发额外效果）：
    - 使用默认 `phase: 'reaction'`（不传也可以）；
    - 由 destroy 管线统一通过 `collectTriggers` 入队 → 交给全局 `triggerQueue` / reaction queue 排序执行。

### 2. Reaction Queue（同时触发的排序）

- **核心数据结构**：`TriggerInstance`（见 `domain/types.ts`）
  - 关键字段：`timing`、`sourceDefId`、`ownerPlayerId`、`sourceControllerId`、`sourceBaseIndex`、`mandatory`、`witnessRequirement`、`lkiMinion` 等。
- **收集入口**：
  - `collectTriggers('onMinionMoved' | 'onMinionAffected' | 'onMinionDestroyed', ctx)`；
  - 会根据 `isSourceActive` + witness 规则检查来源是否仍在场，并为 move/affect timing 做“目的地基地 must match”的见证校验。
- **执行入口**：
  - `postProcessSystemEvents` 里，处理完一批事件后会调用 `maybeResolveReactionQueue`；
  - 单一触发时直接执行，多触发时为当前决策玩家创建 `smashup_reaction_choose` 交互，由其决定下一触发顺序。
- **编码约定：新增“After X”类持续反应时：**
  - 若是单一来源、单一触发、无同时触发排序争议，可以继续使用现有 `fireTriggers`（非 destroy/move 场景）；
  - 若存在“同时有多个来源/多名玩家都要对 X 做出反应”的场景，应优先建模为：
    - `collectTriggers` → `TriggerInstance` → reaction queue；
    - 避免在 `fireTriggers` 里直接执行，绕过排序规则。

- **基地能力也进入 reaction queue**：
  - `registerBaseAbility(baseDefId, timing, ...)` 注册的基地能力，会被队列化为 `TriggerInstance`（`sourceDefId = baseDefId`，`sourceBaseIndex = baseIndex`，并填充 `lkiBase`）。
  - 在计分/回合开始等时机，基地能力会通过 `SU_EVENTS.TRIGGER_QUEUED` 入队，并由 `maybeResolveReactionQueue` 执行；
  - 因此当基地能力与其他持续反应同时触发时，可能先出现 `smashup_reaction_choose`，再进入具体的基地/随从交互。

### 3. Witness / LKI（“卡必须看到 X 才能 After X”）

- **基础 witness 规则**：
  - 默认通过 `isSourceActive(state, sourceDefId)` 判断来源是否仍在场；
  - 对 `onMinionMoved` / `onMinionAffected`，额外要求来源必须在 **目标基地** 上（即 `located.baseIndex === ctx.baseIndex`）。
- **LKI（Last Known Information）**：
  - 在触发收集时，如有 `ctx.triggerMinion`，会记录到 `TriggerInstance.lkiMinion`；
  - reaction queue 执行时，会用这个快照重建一个只读的 `triggerMinion`，供触发器逻辑使用，即使随从已离场。
- **编码约定：当反应逻辑需要读“被毁随从/被影响随从”的状态时：**
  - 优先使用 `ctx.triggerMinion`（或 `lkiMinion`），而不是全场重新搜索；
  - 若必须搜索（例如历史原因），也要考虑卡已离场或已进弃牌堆的情况。

### 4. 事件语义约定（防止混用）

- **`CARDS_DISCARDED`**：只表示“从手牌丢到弃牌堆”。
- **`CARDS_MILLED`**：表示“从牌库顶丢到弃牌堆”（例如僵尸牌组洗牌 / 自磨牌效果）。
- **`CARD_TO_DECK_TOP` / `CARD_TO_DECK_BOTTOM`**：
  - 表示“把一个可见的牌（随从或行动）放回对应玩家的牌库顶/底”；
  - 对随从：应视为“离场”，并触发“离场弃附属”的逻辑（`reduce.ts` 已覆盖）。
- **编码约定：新增能力时若要“从牌库丢掉”或“从手牌弃掉”，不要混用事件：**
  - 从手牌 → `CARDS_DISCARDED`；
  - 从牌库 → `CARDS_MILLED`；
  - 放回牌库顶/底 → `CARD_TO_DECK_TOP/BOTTOM`。

### 5. 新增能力时的 Checklist（给未来派系/卡牌用）

新增任何会“消灭/移动/回手/改写去向”的能力时，至少要过这一套问题：

1. **它是“防止/替代消灭”还是“消灭后反应”？**
   - 防止/替代 → `onMinionDestroyed` + `phase: 'replacement'`，必要时加入 `PREVENT_DESTROY_SOURCE_IDS`；
   - 反应 → `onMinionDestroyed` 默认 phase，交给 reaction queue。
2. **是否会把随从改到另一个区域（手牌 / 其他基地 / 牌库顶底）？**
   - 是 → 必须保证原本的 `MINION_DESTROYED` 不再作为“已消灭”参与后续反应；
   - 即要么通过 replacement 阶段抑制 destroy，要么由 destroy 管线统一抑制。
3. **是否需要 witness / LKI？**
   - 需要看“当时力量/当时所在基地/当时是否有某附属”等，就用 `triggerMinion` / `lkiMinion`；
4. **是否存在多个“After X”同时触发？**
   - 有 → 倾向通过 `collectTriggers` → reaction queue 建模排序，而不是在单一 `fireTriggers` 里硬编码顺序。

> 建议：在实现新的派系/基地前，先在 `rule/wiki-rules-coverage.md` 里对该能力的 Wiki 描述做一条“事件级映射”，再按本文件的规范落代码与测试。

### 6. 示例：从 Wiki 文本到实现（完整流程）

> 这里用一个抽象、但和现有卡非常接近的例子，示范“以后加新卡时 AI 应该怎么走”。

**示例能力（伪卡牌）**：

- 文本：  
  “After another player's minion is destroyed here, you may place a +1 power counter on one of your minions here.”
- Wiki/FAQ 含义：
  - 触发条件：**“在本基地被消灭的对手随从”**；
  - timing：After → `onMinionDestroyed` reaction；
  - 多来源可能同时触发（多个此类卡牌 / 基地效果）；
  - 可选（you may），且目标要在“当时本基地”的己方随从。

#### 6.1 映射到事件 & timing

1. 触发类型：`onMinionDestroyed`（reaction，而非 replacement）；
2. 触发时上下文：
   - `ctx.baseIndex`：被消灭随从所在基地索引；
   - `ctx.playerId`：被消灭随从的拥有者；
   - `ctx.destroyerId`：消灭者；
   - `ctx.triggerMinion` / `ctx.triggerMinionDefId`：被消灭随从；
3. 行为：发出一到多个 `POWER_COUNTER_ADDED`。

#### 6.2 代码落点与写法（示意）

1. 在对应派系的 `abilities/*.ts` 中注册触发器：

```ts
registerTrigger('my_faction_example_minion', 'onMinionDestroyed', (ctx: TriggerContext) => {
  const { state, baseIndex, playerId: destroyedOwnerId, now } = ctx;
  if (baseIndex === undefined) return [];

  // 只对“对手随从被消灭”触发
  const current = ctx.playerId; // 被消灭随从的拥有者
  if (!current || current === destroyedOwnerId) return [];

  const base = state.bases[baseIndex];
  if (!base) return [];

  // 找出本基地上“你的”随从（控制者是你）
  const controllerId = destroyedOwnerId; // 或根据设计指定控制者
  const candidates = base.minions.filter(m => m.controller === controllerId);
  if (candidates.length === 0) return [];

  // 单一候选 & 无 matchState：直接给指示物
  if (!ctx.matchState && candidates.length === 1) {
    return [addPowerCounter(candidates[0].uid, baseIndex, 1, 'my_faction_example_minion', now)];
  }

  // 否则创建可选交互："you may"
  if (!ctx.matchState) return [];
  const options = candidates.map((m, i) => {
    const def = getCardDef(m.defId);
    return {
      id: `minion-${i}`,
      label: def?.name ?? m.defId,
      value: { minionUid: m.uid, baseIndex, defId: m.defId },
      _source: 'field' as const,
      displayMode: 'card' as const,
    };
  });
  const interaction = createSimpleChoice(
    `my_faction_example_minion_${now}`,
    controllerId,
    '选择一个你的随从获得 +1 力量指示物（可跳过）',
    [
      { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
      ...options,
    ],
    { sourceId: 'my_faction_example_minion', targetType: 'minion' },
  );
  return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
});
```

2. destroy 管线部分无需特殊处理：  
   - 这是一个 **reaction**，会在 `processDestroyTriggers` 的 Phase 2，通过 `collectTriggers('onMinionDestroyed', ...)` 入队；
   - 若同时存在多个类似触发，统一交给 **reaction queue** 和 `smashup_reaction_choose` 排序解决。

#### 6.3 AI 使用时的“模板步骤”

当以后你交给 AI 一个新能力（尤其是含有：

- “After a minion is destroyed …”
- “After another player's minion moves here …”
- “When this base scores … After scoring …”

时，理想流程是：

1. 在 `wiki-rules-coverage.md` 里先写一句“规则断言 → timing/事件映射”；
2. 对照本文件第 1～4 节：
   - 判断是 replacement 还是 reaction；
   - 选好 timing（`onMinionDestroyed` / `onMinionMoved` / `afterScoring` 等）；
   - 确认是否要入 reaction queue；
   - 看是否要依赖 LKI（用 `triggerMinion` / `lkiMinion`）；
3. 按上面的示例结构，落在对应的 `abilities/*.ts` 或 `baseAbilities*.ts` 里，并补一个最小单测覆盖。

只要 AI 按这个模板走，新派系/新卡基本就会自动适配你现在这套“replacement + reaction queue + witness/LKI”的规则引擎，而不是各写各的。

