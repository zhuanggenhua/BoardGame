# 托尔图加计分后海盗王移动导致卡住 Bug 分析

## Bug 报告

**提交者**：匿名用户  
**时间**：2026/2/28 16:16:55  
**反馈内容**：图尔加卡死  

## 状态快照分析

```json
{
  "phase": "scoreBases",
  "bases": [
    {
      "defId": "base_tortuga",
      "minions": [
        // 玩家0的随从（总力量 10）
        { "uid": "c22", "defId": "pirate_buccaneer", "controller": "0" },
        { "uid": "c29", "defId": "pirate_first_mate", "controller": "0" },
        { "uid": "c30", "defId": "pirate_first_mate", "controller": "0" },
        // 玩家1的随从（总力量 16）
        { "uid": "c63", "defId": "robot_warbot", "controller": "1" },
        { "uid": "c62", "defId": "robot_warbot", "controller": "1" },
        { "uid": "c44", "defId": "alien_scout", "controller": "1" },
        { "uid": "c46", "defId": "alien_scout", "controller": "1", "playedThisTurn": true }
      ]
    },
    {
      "defId": "base_ninja_dojo",
      "minions": [
        // 海盗王刚刚移动到这里
        { "uid": "c21", "defId": "pirate_king", "controller": "0", "playedThisTurn": true }
      ]
    }
  ],
  "scoringEligibleBaseIndices": [0]
}
```

## 根因分析

这是之前修复的同一个问题：**托尔图加 afterScoring 交互的随从选项缺少动态刷新机制**。

### 问题场景

1. **托尔图加达到临界点**（20 分），触发计分
2. **海盗王 beforeScoring 触发**：询问是否移动到托尔图加
   - 用户选择"移动到该基地"
   - 海盗王从忍者道场移动到托尔图加
3. **托尔图加 afterScoring 触发**：询问是否移动一个随从到替换基地
   - **问题**：交互选项是在计分前创建的，包含了海盗王在忍者道场的选项
   - 海盗王已经移动到托尔图加，但选项中仍然包含海盗王的选项
   - 框架层自动刷新选项，过滤掉已移动的海盗王
   - 如果过滤后选项列表为空（只剩"跳过"），用户应该能点击"跳过"继续
   - **但实际情况**：用户点击"移动随从"后卡住

## 框架层自动刷新机制

框架层已经实现了自动推断和刷新机制（`refreshOptionsGeneric`）：

```typescript
function refreshOptionsGeneric<T>(
    state: any,
    interaction: InteractionDescriptor,
    originalOptions: PromptOption<T>[],
): PromptOption<T>[] {
    return originalOptions.filter((opt) => {
        const val = opt.value as any;
        
        // 自动推断类型
        const inferredSource = (() => {
            if (!val || typeof val !== 'object') return 'static';
            if (val.skip || val.done || val.cancel || val.__cancel__) return 'static';
            if (val.minionUid !== undefined) return 'field'; // ← 随从选项
            if (val.baseIndex !== undefined) return 'base';
            if (val.cardUid !== undefined) return 'hand';
            return 'static';
        })();

        switch (inferredSource) {
            case 'field': {
                // 检查随从是否仍在场上
                for (const base of state.core?.bases || []) {
                    if (base.minions?.some((m: any) => m.uid === val?.minionUid)) return true;
                }
                return false; // ← 海盗王已经不在原基地，过滤掉
            }
            // ...
        }
    });
}
```

### 刷新时机

1. **交互成为 current 时**（`queueInteraction`）
2. **交互从队列弹出时**（`resolveInteraction`）
3. **状态更新时**（`refreshInteractionOptions`）

## 可能的问题

### 1. UI 层未正确响应选项更新

框架层正确过滤了已移动的随从，但 UI 层可能没有正确响应选项更新：

- **场景直选模式**：`targetType: 'minion'`
- **用户体验**：棋盘上高亮候选随从，点击随从完成选择
- **问题**：如果过滤后选项列表为空，UI 层可能没有正确显示"跳过"按钮

### 2. 智能降级逻辑的边界情况

框架层有智能降级逻辑：

```typescript
// 智能处理 multi.min 限制
// 如果过滤后无法满足最小选择数，保持原始选项（安全降级）
if (data.multi?.min && freshOptions.length < data.multi.min) {
    return state; // ← 保持原始选项
}
```

但托尔图加的 afterScoring **没有设置 `multi.min` 限制**，所以即使过滤后选项列表为空，框架层也会更新选项。

### 3. 操作选项的可达性

场景直选模式下，操作选项（skip/done/cancel）通过 **浮动按钮** 显示：

```typescript
// 随从选择浮动操作栏（跳过按钮）
{isMinionSelectPrompt && minionSelectExtraOptions.length > 0 && (
    <div className="fixed bottom-[280px] ...">
        {minionSelectExtraOptions.map(opt => (
            <SmashUpGameButton onClick={() => dispatch(INTERACTION_COMMANDS.RESPOND, { optionId: opt.id })}>
                {opt.label}
            </SmashUpGameButton>
        ))}
    </div>
)}
```

**问题**：如果 `minionSelectExtraOptions` 为空，"跳过"按钮不会显示。

## 解决方案

### 方案1：确保操作选项始终可达

修改 Board.tsx，确保操作选项（skip/done/cancel）始终显示为浮动按钮：

```typescript
const minionSelectExtraOptions = useMemo(() => {
    if (!isMinionSelectPrompt || !currentPrompt) return [];
    return currentPrompt.options.filter(opt => {
        const val = opt.value as Record<string, unknown> | undefined;
        if (!val) return true;
        // 包含 minionUid 的是随从选项，不在此显示
        if (typeof val.minionUid === 'string') return false;
        // 其余都是非随从操作选项（skip / done / cancel 等）
        return true;
    });
}, [isMinionSelectPrompt, currentPrompt]);
```

**验证**：
- 海盗王移动后，托尔图加交互的随从选项被过滤掉
- 只剩"跳过"选项
- "跳过"按钮应该显示为浮动按钮
- 用户点击"跳过"应该能继续

### 方案2：托尔图加 afterScoring 使用 optionsGenerator

修改托尔图加的 afterScoring，使用 `optionsGenerator` 动态生成选项：

```typescript
registerBaseAbility('base_tortuga', 'afterScoring', (ctx) => {
    // ...
    const interaction = createSimpleChoice(
        `base_tortuga_${ctx.now}`, runnerUpId,
        '托尔图加：选择移动一个其他基地上的随从到替换基地', 
        [], // ← 初始选项为空
        { 
            sourceId: 'base_tortuga', 
            targetType: 'minion',
        },
    );
    
    // 添加 optionsGenerator
    (interaction.data as any).optionsGenerator = (state: any) => {
        // 基于最新状态生成选项
        const otherMinions = [];
        for (let i = 0; i < state.core.bases.length; i++) {
            if (i === ctx.baseIndex) continue;
            const base = state.core.bases[i];
            for (const m of base.minions) {
                if (m.controller !== runnerUpId) continue;
                otherMinions.push({
                    uid: m.uid,
                    defId: m.defId,
                    owner: m.owner,
                    baseIndex: i,
                    label: `${def?.name ?? m.defId} (${baseDef?.name ?? '基地'}, 力量${getEffectivePower(state, m, i)})`,
                });
            }
        }
        
        const minionOptions = otherMinions.map((m, i) => ({
            id: `minion-${i}`,
            label: m.label,
            value: { minionUid: m.uid, minionDefId: m.defId, owner: m.owner, fromBaseIndex: m.baseIndex },
        }));
        
        return [
            { id: 'skip', label: '跳过', value: { skip: true } },
            ...minionOptions,
        ];
    };
    
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
});
```

## 推荐方案

**方案1**：确保操作选项始终可达（框架层已经正确实现了自动刷新，只需要确保 UI 层正确显示操作选项）。

**原因**：
- 框架层的自动刷新机制已经覆盖了 90% 的场景
- 托尔图加的问题是 UI 层的操作选项可达性问题，不是框架层的刷新问题
- 修复 UI 层的操作选项显示逻辑，可以一次性解决所有类似问题

## 验证步骤

1. 检查 Board.tsx 中 `minionSelectExtraOptions` 的计算逻辑
2. 确认"跳过"选项是否被正确提取为操作选项
3. 确认浮动按钮是否正确显示
4. 运行 E2E 测试验证修复

## 相关文档

- `docs/interaction-refresh-flow.md` - 交互刷新机制详解
- `docs/interaction-ui-modes.md` - UI 渲染模式详解
- `docs/bugs/smashup-tortuga-dynamic-options-auto-infer.md` - 之前的修复文档
