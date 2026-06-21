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
       - 或 **防止消灭交互**（`sourceId` 在 `PREVENT_DESTROY_SOURCE_IDS` 白名单内，如 `base_nine_lives_intercept`、`giant_ant_drone_prevent_destroy`、`pirate_buccaneer_move`、`kitty_cats_hang_in_there`）。
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
- **排序冲突判断**：
  - 新能力优先使用 `domain/effectDsl.ts` 的强类型 Effect primitive。primitive 是单一事实源：同一个定义同时生成执行事件/交互与 `ResourceFootprint`，禁止再为排序另写一份 reads/writes。
  - 兼容路径使用 `domain/reactionResources.ts` 的 `ResourceFootprint`，从真实产物推导读写：
    - 触发器/基地能力 probe 产出的 `SmashUpEvent`；
    - 创建的结构化 `Interaction` option / `continuationContext`；
    - 触发来源上下文（来源卡、基地、控制者、泰坦 uid 等）。
  - **禁止新增手写读写抽象桶作为排序依据**。新增能力应通过真实事件、结构化 option value、明确的 `sourceId/targetType/continuationContext` 暴露实际读写字段，让 resource model 自动推导。
  - 确实无法从事件/交互推导的极少数效果，必须使用带 `fallbackReason` 的 `fallbackFootprint`，并在测试里断言 fallback audit；不得把粗粒度桶重新写回卡牌配置。
- **编码约定：新增“After X”类持续反应时：**
  - 若是单一来源、单一触发、无同时触发排序争议，可以继续使用现有 `fireTriggers`（非 destroy/move 场景）；
  - 若存在“同时有多个来源/多名玩家都要对 X 做出反应”的场景，应优先建模为：
    - `collectTriggers` → `TriggerInstance` → reaction queue；
    - 避免在 `fireTriggers` 里直接执行，绕过排序规则。

- **基地能力也进入 reaction queue**：
  - `registerBaseAbility(baseDefId, timing, ...)` 注册的基地能力，会被队列化为 `TriggerInstance`（`sourceDefId = baseDefId`，`sourceBaseIndex = baseIndex`，并填充 `lkiBase`）。
  - 在计分/回合开始等时机，基地能力会通过 `SU_EVENTS.TRIGGER_QUEUED` 入队，并由 `maybeResolveReactionQueue` 执行；
  - 因此当基地能力与其他持续反应同时触发时，可能先出现 `smashup_reaction_choose`，再进入具体的基地/随从交互。

### 2.1 官方 Card Resolution Order → 当前架构映射

> 规则书里的 1-5 步不要再被简化成“触发器统一排队”一句话。当前项目实际上拆成了“本体结算层”“强制反应层”“可选响应层”三层，但只对部分场景完整落地。

#### 第 1 步：先完整结算当前打出的牌 / 当前启动的能力本体

- **当前架构落点**：
  - 命令本体：`commands.ts validate` → `execute.ts / reducer.ts` 产出基础事件；
  - 事件落地：`reduce.ts`；
  - 本体后的统一后处理：`domain/index.ts postProcessSystemEvents`。
- **当前状态**：
  - `PLAY_MINION` / `PLAY_ACTION` / `ACTIVATE_SPECIAL` 的本体链路已实现；
  - 本体执行期间创建的交互，会先阻塞流程，待交互解决后继续原链路。

#### 第 2 步：若本体中途又打出/启动了新的牌或能力，先收口较新的本体，再回来继续旧本体

- **当前架构落点**：
  - 交互处理器在 `systems.ts` 中消费 `SYS_INTERACTION_RESOLVED` 后继续产出领域事件；
  - `resolveInteraction()` 负责弹出旧交互并推进后续交互；
  - 计分链额外用 `scoreBases` resolution frame 的 `step + deferredEvents/deferredActions` 挂住被打断的外层流程。
- **当前状态**：
  - **部分已实现**：像“本体里额外打牌/选牌/移动后继续原本体”的链路大多能跑通；
  - **当前收敛口径**：复杂插队的恢复位点已经优先挂到通用 resolution frame；`reactionSession.ts` / `scoringSession.ts` 现在主要承担 SmashUp 视图投影与 helper，而不是第二套 sys 主链。

#### 第 3 步：处理被本体触发的在场强制能力，多个时由当前玩家决定顺序

- **当前架构落点**：
  - `collectTriggers(...)` 收集 `TriggerInstance`；
  - `SmashUpReactionSession.phase === 'mandatory'`；
  - 多个强制触发时通过 `smashup_reaction_choose` 让当前玩家决定顺序。
- **当前状态**：
  - **核心机制已实现**；
  - `TriggerInstance.resolutionClass` 已区分 `mandatory | optional`；
  - 当前回归重点不是“有没有排序按钮”，而是**排序候选是否仍然有效**。
- **已知问题与当前修正**：
  - 历史上 stale trigger 会继续留在排序按钮里，导致“目标/来源已不在原位还能点，点了没效果”；
  - 当前已在 `reactionSession.ts` 加入“计分相关 frame 的 stale trigger 预裁剪”，至少先避免 `beforeScoring / whenScoring / afterScoring` 里的明显无效选择继续展示。

#### 第 4 步：处理在场可选能力 + 手牌 special，按当前玩家起顺时针轮流响应，直到所有人连续 pass

- **当前架构落点**：
  - 计分前可选响应：`responseWindowType = 'meFirst'`；
  - 计分后可选响应：`responseWindowType = 'afterScoring'`；
  - `buildPlayableCardOptions()` 会把“当前响应者可打的 special / 可发动的 special”塞进 `smashup_reaction_choose`；
  - `pass -> 顺时针下一个玩家 -> 所有人连续 pass 收口` 由 `resolveSmashUpReactionChoice()` 驱动。
- **当前状态**：
  - **只对 score 相关窗口部分实现**；
  - `meFirst` / `afterScoring` 的顺时针响应循环、live 校验、base 限定校验已经有专门逻辑；
  - **并没有一个“任意事件都可打开的通用第 4 步响应窗口”**。
- **这是当前最大架构缺口**：
  - 官方第 4 步不是“只在计分时存在”，而是任何满足 `After X, you may...` / hand special 可响应的时点都应存在；
  - 当前 `responseWindowType` 只有 `'meFirst' | 'afterScoring'`，说明“非计分事件的可选响应轮询”在模型层还没有被泛化；
  - 这就是你说的“插队执行好像有 bug 直接无法执行”的主要嫌疑点之一：很多本该进入第 4 步轮询的响应，现在不是根本没窗口，就是借用了不完全匹配的 score-only 机制。

#### 第 5 步：无附着目标的 special action 结算完再弃掉

- **当前架构落点**：
  - `PLAY_ACTION` 本体先发 `ACTION_PLAYED`；
  - 非 ongoing / 非附着行动的弃牌落点由 reducer 事件链处理。
- **当前状态**：
  - **基本实现**；
  - 但若 action 在特殊窗口里“打得出来却后续无效”，要优先检查的是第 4 步窗口建模和 live 候选，而不是第 5 步弃牌。

#### 结论（必须统一口径）

- 现在不能再说“SmashUp 的官方结算顺序已经实现了”。
- 更准确的说法是：
  - **第 1 步**：已实现；
  - **第 2 步**：部分实现，复杂插队依赖交互链和局部 session 挂起，仍有一致性风险；
  - **第 3 步**：已实现核心 mandatory ordering，但 stale trigger 清理还在持续补洞；
  - **第 4 步**：仅 score 相关窗口部分实现，缺少覆盖任意事件的通用可选响应轮询；
  - **第 5 步**：基本实现。

### 2.2 Ongoing / Modifier Authoring（强制）

- **标准化持续力量牌优先写成结构化定义，不再散写单条注册。**
  - 适用形态：`附着/基地上每张该牌给目标 +N/-N`
  - authoring 入口：`registerOngoingPowerModifiers`
  - definition 应声明 `defId / location / target / delta / condition`
- **需要自定义算法时，也必须走统一 definition object，而不是回退成裸函数注册。**
  - power：`registerCustomPowerModifiers`
  - base power：`registerCustomBasePowerModifiers`
  - breakpoint：`registerCustomBreakpointModifiers`
  - definition 至少应把 `sourceDefId/defId`、`variantPolicy`（按需）、自定义 `compute(...)` 放在同一处表达
- **POD 语义是继承或覆盖，不是补充。**
  - `variantPolicy: 'inherit'`：基础版继承到 `_pod`
  - `variantPolicy: 'override'`：显式 `_pod` 定义只覆盖 POD 版本
  - `variantPolicy: 'baseOnly'`：仅基础版生效
  - POD 不得反向影响基础版
  - 基础版专属 ongoing 必须显式标为 `baseOnly`
- **borrowed / copied / POD 归一必须优先复用 runtime helper。**
  - controller 读取：`getActionControllerId(...)`
  - POD/runtime 家族匹配：`matchesRuntimeDefId(...)`
  - attached/base ongoing 计数：优先走 `PowerModifierRuntimeHelpers`
- **遇到“行动家族型规则”时，不要让 registry 再自动复制一层 `_pod` alias。**
  - 典型形态：`fairies_daisy_chain`、`fairies_enchantment`、`cyborg_apes_juiced_up`
  - 这类规则要在 custom definition 里声明 `runtimeIdentity: 'actionFamily'`
  - 原因：目标不是 source 实体本身，而是“同家族 attached/base ongoing 的运行时实例”；若仍走普通 alias，会把 base/pod 两份规则都命中到同一目标，导致双算
- **`podStrategy: 'selfManaged'` 已降级为 legacy 例外。**
  - 只有当前 shared helper 还表达不了时才允许保留
  - 新规则默认不得新增 `selfManaged`

### 2.2.1 Legacy `selfManaged` 清单（2026-06-06）

以下规则仍保留 `podStrategy: 'selfManaged'`，但不再视为默认 authoring 模式：

| 规则 | 状态 | 保留原因 / 后续方向 |
| --- | --- | --- |
| `dino_armor_stego` | 暂时保留例外 | 依赖“非己方回合 + POD 版 `talentUsed` 闸门”双语义，当前 helper 还没有对应 primitive |
| `dino_war_raptor` | 可继续迁移 | 同基地同名计数；可后续抽成 entity-family count helper |
| `robot_microbot_alpha` | 暂时保留例外 | 需要全场己方随从计数且排除自身，后续适合补 board-scan helper |
| `robot_microbot_fixer` | 暂时保留例外 | 依赖 `isMicrobot(...)` 这类跨卡族谓词，后续适合补 family predicate helper |
| `ghost_haunting` | 可继续迁移 | 规则已接近“self + hand condition”，可后续改为 custom definition |
| `ancient_egyptians_priest_of_anubis` | 可继续迁移 | 依赖 `buriedCards` 查询，后续可抽成 buried count helper |
| `mermaids_temptress` | 暂时保留例外 | 依赖 `minionsMovedToBaseThisTurn` 这类时序态，不属于当前 ongoing counting helper 覆盖面 |
| `shapeshifters_mimic` | 暂时保留例外 | 依赖全场最高印刷力量扫描；与 copied-power 家族相邻，但仍缺 shared highest-printed-power helper |
| `cyborg_apes_furious_george` | 可继续迁移 | 规则已接近“self attachment count”，可后续并入 custom definition |
| `kaiju_kaijookey` | 暂时保留例外 | 依赖“本基地 owner 维度的所有行动总数”，后续适合抽成 owner-lens action count helper |
| `base_minionPowerBonus` | 可继续迁移 | 纯基地字段读取，后续可改为 custom base/static definition |
| `base_wyrms_desolation` | 可继续迁移 | 纯基地 static debuff，后续可改为 custom base/static definition |

收口原则：
- `可继续迁移`：当前 surface 已基本足够，后续只是继续把局部逻辑从 legacy 迁到 custom/structured definition。
- `暂时保留例外`：需要先补新的 shared helper 或更明确的 domain primitive，再迁移才有意义。

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
5. **是否已经暴露真实资源读写？**
   - 新能力优先用 Effect primitive（例如 `moveMinionPrimitive`、`addPowerCounterPrimitive`、`drawCardsPrimitive`）承载实际读写字段；
   - 事件能表达的效果必须产出明确事件（例如 `MINION_MOVED`、`CARDS_DRAWN`、`VP_AWARDED`）；
   - 交互能表达的目标必须把真实字段写进 option value / continuationContext（例如 `minionUid`、`baseIndex`、`playerId`、`cardUid`）；
   - 不得为排序另写一份抽象读写桶；resource footprint 的单一真实来源是 Effect primitive / 实际事件 / 实际交互结构。

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

