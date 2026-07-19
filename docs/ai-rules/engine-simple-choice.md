# createSimpleChoice API 使用规范

## `createSimpleChoice` API 使用规范（强制）

> 所有使用 `createSimpleChoice` 创建交互的代码必须遵守。

### 函数签名

```typescript
function createSimpleChoice<T>(
    id: string,                              // 交互 ID（通常为能力 ID）
    playerId: PlayerId,                      // 做选择的玩家
    title: string,                           // 弹窗标题（i18n key）
    options: PromptOption<T>[],              // 选项列表
    sourceIdOrConfig?: string | SimpleChoiceConfig, // 第 5 参数：sourceId 字符串 或 配置对象
    timeout?: number,                        // 第 6 参数：超时（仅位置参数形式有效）
    multi?: PromptMultiConfig,               // 第 7 参数：多选配置（仅位置参数形式有效）
): InteractionDescriptor<SimpleChoiceData<T>>
```

### 两种调用约定

**约定 A：位置参数形式**（第 5 参数为 `string`）
```typescript
createSimpleChoice(id, playerId, title, options, sourceId, undefined, { min: 0, max: N })
//                                                ^^^^^^^^  ^^^^^^^^^  ^^^^^^^^^^^^^^^^^^
//                                                第5:string 第6:timeout 第7:multi
```

**约定 B：配置对象形式**（第 5 参数为 `SimpleChoiceConfig`）
```typescript
createSimpleChoice(id, playerId, title, options, {
    sourceId: 'ability_id',
    multi: { min: 0, max: N },    // ← multi 必须嵌套在 config 对象内
    autoResolveIfSingle: false,
})
```

### SimpleChoiceConfig 结构

```typescript
interface SimpleChoiceConfig {
    sourceId?: string;
    timeout?: number;
    multi?: PromptMultiConfig;        // { min?: number; max?: number }
    targetType?: 'base' | 'minion' | 'hand' | 'discard_minion' | 'generic';
    autoResolveIfSingle?: boolean;    // 兼容字段；玩家要选择对象/可放弃时禁止传 true
    autoCancelOption?: boolean;       // 自动添加取消选项
}
```

### 强制规则

- `autoResolveIfSingle` 只在**显式传 `true`** 时生效；不传值时会保留交互，不会自动代替玩家点击。
- **玩家选择语义禁止自动完成（强制）**：只要这一步的现实含义是让玩家选择卡牌、基地、随从、角色、目标、支付对象、来源、目的地、顺序、数量或是否执行，即使合法候选只有 1 个，也不得传 `autoResolveIfSingle: true`，不得在 handler 中直接取第一项代替玩家选择。必须保留交互，让玩家看到候选并点击对象或选择跳过/确认。
- **唯一允许自动收口的场景**：只有当该步骤已经没有玩家选择、没有可见对象、没有放弃/跳过语义，只剩固定机械结果时，才允许自动收口；此时应优先不创建 `simple-choice`。如果出于兼容必须使用 `autoResolveIfSingle: true`，代码附近必须说明“为什么这不是玩家选择”。

1. **"任意数量"/"any number" → 必须传 `multi: { min: 0, max: N }`**，N 为候选项总数。不传 `multi` 会导致单选模式。
2. **"恰好 N 个" → `multi: { min: N, max: N }`**。
3. **"最多 N 个" → `multi: { min: 0, max: N }` 或 `multi: { min: 1, max: N }`**（视是否可跳过）。
4. **基地/随从/手牌选择必须声明 `targetType`（强制）**：
   - `targetType: 'base'` — 选择基地（如地形改造、麦田怪圈）
   - `targetType: 'minion'` — 选择随从（如至高霸主、收集者）
   - `targetType: 'hand'` — 选择手牌（如幽灵弃牌）
   - `targetType: 'discard_minion'` — 选择弃牌堆随从（如僵尸领主）
   - `targetType: 'generic'` — 通用选择（如选择玩家、选择基地牌库中的卡）
   - **历史债务**：现有 57 个交互依赖自动检测（兼容模式），可以保持现状，修改时顺带添加 `targetType`。
5. **卡牌选项必须声明 `displayMode: 'card'`（强制）**。`PromptOption` 新增 `displayMode?: 'card' | 'button'` 字段，用于显式声明 UI 渲染模式。使用 `buildMinionTargetOptions()` 构建的选项已自动设置。手动构建卡牌选项时必须显式添加 `displayMode: 'card'`。UI 层对未设置 `displayMode` 的选项 fallback 到 `extractDefId` 猜测（向后兼容，但新代码禁止依赖此 fallback）。
6. **选项代表卡牌时，`option.value` 必须包含 `defId` 字段**。UI 层从 `defId` 查找卡牌预览图。缺少 `defId` → 即使 `displayMode: 'card'` 也无法展示预览图。
7. **配置对象形式中 `multi` 必须嵌套**：`{ sourceId, multi: { min, max } }` ✅，`{ sourceId, min, max }` ❌（`min`/`max` 作为顶层字段会被忽略）。
8. **可能跨 `BASE_CLEARED` / `BASE_REPLACED` / 基地移除后再解决的交互，禁止只传 `baseIndex`**。如果 handler 在交互解决时还需要重新定位基地，必须同时携带稳定标识（如 `baseDefId`），并在 handler 中先按稳定标识解析活体基地，再 fallback 到仍有效的 `baseIndex`。`baseIndex` 只是当时快照位置，不是跨时序稳定标识。
9. **`responseWindow` 与 `simple-choice` 可以并存，命令放行权必须归 `ResponseWindowSystem`**。当 `state.sys.interaction.current.kind === 'simple-choice'` 且同时存在活动 `state.sys.responseWindow.current` 时，`SimpleChoiceSystem` 不能一刀切拦截同玩家的普通非 `SYS_` 命令；此时命令是否合法必须交给 `ResponseWindowSystem` 裁决。只有在没有活动响应窗口时，`SimpleChoiceSystem` 才负责阻塞“请先完成当前选择”类普通命令。
10. **一个 interaction kind 只能表达一种稳定业务语义（强制）**。`simple-choice` 只保留真正的分支/按钮/数值选择；像“为当前 pendingAttack 选 defender”“选择 compare-roll 胜方”“奖励骰重掷结算确认”这类有独立业务语义的步骤，必须建 dedicated kind / dedicated reader / dedicated modal，禁止继续把不同职责塞进同一个 `simple-choice` / `selectPlayer` 壳子里。
11. **能直接消费现有交互对象时，不得再创造第二个交互对象（强制）**。如果当前 live interaction / prompt option 已经完整表达了玩家这一步要操作的业务对象（例如卡牌 `cardUid`、基地 `baseIndex`、随从 `minionUid`、已存在的 `optionId`），UI 必须优先直接让玩家点击这个现有对象，并把点击结果回送到同一个 live option / interaction；禁止再额外包一层“先选一个动作/先选一个分支/先开一个总弹窗”的二次交互壳，只是把同一批对象重新描述一遍。只有在**确实新增了一个原交互对象里不存在的新决策步骤**时，才允许创建新的 interaction kind / prompt。
11. **阻塞交互的前台承载默认走 modal stack（强制）**。如果某个前台直接拥有当前交互步骤的确认权，或它的关闭/确认会决定业务是否继续推进，那么它必须作为 modal stack entry 承载；只有纯展示、不会改变交互 ownership 的特写/放大层，才允许保留在 overlay 通道。
12. **modal stack entry 的真实可点击内容必须与 entry 同树（强制）**。一旦前台已经进栈，禁止其内部再通过 `HudPortal` / `modal-root` / 其它 portal 把主体内容挪到栈外；否则会出现“栈里的 fixed 空层拦截点击、真正内容在另一棵树里单飞”的命中错误。若同一组件既要支持 overlay 展示态、也要支持入栈阻塞态，必须提供 `usePortal=false` 这类底层开关，让栈式场景原位渲染。

### PromptOption.displayMode（渲染模式声明）

```typescript
interface PromptOption<T = unknown> {
    id: string;
    label: string;
    value: T;
    disabled?: boolean;
    /** 'card' = 卡牌预览模式，'button' | undefined = 按钮模式 */
    displayMode?: 'card' | 'button';
}
```

- **设计原则**：渲染模式由选项创建者显式声明，而非 UI 层从 `value` 字段名猜测。`defId` 是业务数据，不是 UI 渲染声明。
- **`buildMinionTargetOptions()`** 已自动设置 `displayMode: 'card'`。
- **手动构建卡牌选项**时必须显式添加：`{ id, label, value: { cardUid, defId }, displayMode: 'card' }`。
- **非卡牌选项**（跳过/完成/基地选择等）不需要设置 `displayMode`，默认为按钮。
- **向后兼容**：UI 层 `isCardOption()` 优先读 `displayMode`，未设置时 fallback 到 `extractDefId()` + `previewRef` 检查。新代码禁止依赖此 fallback。

### 反模式

```typescript
// ❌ multi 传到 timeout 位置（第 6 参数）
createSimpleChoice(id, pid, title, opts, sourceId, { min: 0, max: 3 })

// ❌ config 对象中 min/max 平铺（不在 multi 子对象内）
createSimpleChoice(id, pid, title, opts, { sourceId: 'xxx', min: 0, max: 3 })

// ❌ 描述说"任意数量"但不传 multi
createSimpleChoice(id, pid, title, opts, sourceId)  // → 单选模式

// ❌ 基地/随从选择未声明 targetType（依赖自动检测，新代码禁止）
createSimpleChoice(id, pid, '选择一个基地', baseOptions, 'ability_id')

// ❌ 选项代表卡牌但 value 缺少 defId（无法展示预览图）
options.map(c => ({ id: c.instanceId, label: c.name, value: { instanceId: c.instanceId } }))

// ❌ 卡牌选项未声明 displayMode（依赖 UI 层猜测，新代码禁止）
options.map(c => ({ id: c.uid, label: c.name, value: { cardUid: c.uid, defId: c.defId } }))

// ❌ 交互会跨基地清场/换基地，但只保存 baseIndex（基地列表收缩后会漂移）
createSimpleChoice(id, pid, title, opts, {
    sourceId: 'ability_id',
    targetType: 'minion',
})

// ❌ 玩家需要选择一个可见对象时，把唯一候选自动结算掉
createSimpleChoice(id, pid, '选择一个随从', minionOptions, {
    sourceId: 'ability_id',
    targetType: 'minion',
    autoResolveIfSingle: true,
})

// ❌ 可选效果只有一个合法候选时，直接取第一项执行，玩家看不到“跳过/不做”
const selected = candidates[0];
return selected ? applyEffect(selected) : noOp();

// ❌ simple-choice 与 responseWindow 并存时，由 SimpleChoiceSystem 直接拦截所有普通命令
if (state.sys.interaction.current?.kind === 'simple-choice') {
    return { valid: false, error: '请先完成当前选择' };
}

// ❌ 用 simple-choice 伪装“选受击者 / 选 compare-roll 结果 / 奖励骰确认”
createSimpleChoice(id, pid, title, opts, {
    sourceId: 'targeting-roll',
});

// ❌ 当前 live prompt 已经给出了 cardUid/baseIndex/optionId，
//    UI 仍再造一个“选择一个动作”的总弹窗，让用户重复选择同一批对象
showActionPicker(existingPrompt.options);

// ✅ 当前 live prompt 已经完整表达了业务对象，UI 直接消费现有对象并回送原 optionId
onCardClick(cardUid => respondCurrentPrompt({ optionId: liveOptionId }));

// ❌ 会阻塞业务推进的前台绕过 modal stack，单独走 overlay 通道
return <BonusDieOverlay open settlement={pendingSettlement} onClose={confirmAndAdvance} />;

// ✅ 位置参数形式 + multi
createSimpleChoice(id, pid, title, opts, sourceId, undefined, { min: 0, max: opts.length })

// ✅ 配置对象形式 + multi 嵌套
createSimpleChoice(id, pid, title, opts, { sourceId: 'xxx', multi: { min: 0, max: opts.length } })

// ✅ 基地选择：显式声明 targetType
createSimpleChoice(id, pid, '选择一个基地', baseOptions, { sourceId: 'ability_id', targetType: 'base' })

// ✅ 随从选择：显式声明 targetType
createSimpleChoice(id, pid, '选择一个随从', minionOptions, { sourceId: 'ability_id', targetType: 'minion' })

// ✅ 即使只有一个随从候选，也保留选择交互，必要时显式提供跳过选项
createSimpleChoice(id, pid, '选择一个随从', [createSkipOption(), ...minionOptions], {
    sourceId: 'ability_id',
    targetType: 'minion',
    autoResolveIfSingle: false,
})

// ✅ 卡牌选项：displayMode + defId
options.map(c => ({ id: c.uid, label: c.name, value: { cardUid: c.uid, defId: c.defId }, displayMode: 'card' as const }))

// ✅ 交互会跨基地清场/换基地：同时带 baseIndex + baseDefId，handler 里优先按稳定标识回找
createSimpleChoice(id, pid, '选择一个随从', minionOptions, {
    sourceId: 'ability_id',
    targetType: 'minion',
})
// option.value: { minionUid, baseIndex, baseDefId, ... }

// ✅ simple-choice 与 responseWindow 并存时，让 ResponseWindowSystem 决定是否允许出响应牌
if (
    state.sys.interaction.current?.kind === 'simple-choice' &&
    state.sys.responseWindow?.current
) {
    return validateByResponseWindow(...);
}

// ✅ 专用业务语义使用专用 interaction kind + 专用 UI reader
queueInteraction(state, {
    id: `defender-choice-${attackId}`,
    kind: 'dt:defender-choice',
    playerId: chooserPlayerId,
    data: { attackerId, chooserPlayerId, options },
});

// ⚠️ 历史接入示例：DiceThrone 曾用同步桥把既有状态挂到 modal stack。
// 新游戏不要默认模仿，优先直接围绕 openModal/closeModal 设计单一 truth source。
useSyncedModalStackEntry(currentInteraction?.kind === 'dt:bonus-dice'
    ? { id: currentInteraction.id, kind: 'dt:bonus-dice', node: <BonusDieOverlay ... /> }
    : null);
```

> 上面的 `useSyncedModalStackEntry` 仅表示“历史上已有本地/引擎前台状态时，如何临时接入 modal stack”的过渡方案，不代表新游戏推荐架构。
> **新游戏强制口径**：阻塞前台默认直接作为 modal stack entry 设计，禁止先做一层本地 modal 状态/overlay，再额外同步给 modal stack。

---

