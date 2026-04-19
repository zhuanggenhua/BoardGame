# Cardia AI Payload Format Fix

## 概述

修复了 Cardia AI 座位提交交互命令时 payload 格式不匹配的问题。

## 问题描述

AI 座位触发 Ambusher 和 Inventor 等需要交互的卡牌能力时，提交的 `SYS_INTERACTION_RESPOND` 命令在服务器端验证失败，原因是 payload 格式不完整。

## 根本原因

`src/games/cardia/ai.ts` 的 `buildSimpleChoiceActions` 函数只提交了 `{ optionId: 'faction_swamp' }`，没有将 `option.value` 展开到 payload 中。

服务器端期望的 payload 应该包含 `option.value` 中的所有字段，例如：
- Ambusher: `{ optionId: 'faction_swamp', faction: 'swamp' }`
- Inventor: `{ optionId: 'card_123', cardUid: 'card_123' }`

## 修复内容

### 1. 添加 `buildSimpleChoicePayload` 辅助函数

```typescript
/**
 * 构建 simple-choice 交互的 payload
 * 将 option.value 展开到 payload 中，确保服务器端能够正确处理
 */
function buildSimpleChoicePayload(
    optionIds: string[],
    multi: { min?: number; max?: number } | undefined,
    mergedValue?: unknown,
): unknown {
    if (multi) {
        return { 
            optionIds, 
            ...(mergedValue && typeof mergedValue === 'object' ? mergedValue : {}) 
        };
    }
    return { 
        optionId: optionIds[0], 
        ...(mergedValue && typeof mergedValue === 'object' ? mergedValue : {}) 
    };
}
```

### 2. 修改 `buildSimpleChoiceActions` 函数

**修改前**：
```typescript
const data = interaction as {
    options?: Array<{ id?: string; label?: string; disabled?: boolean }>;
    multi?: { min?: number; max?: number };
};

const availableOptions = (data.options ?? []).filter((option): option is { id: string; label?: string } => {
    return typeof option.id === 'string' && option.disabled !== true;
});

// 单选模式
if (!data.multi) {
    return availableOptions.map((option, index) => ({
        // ...
        commands: [{
            type: 'SYS_INTERACTION_RESPOND',
            payload: { optionId: option.id },  // ❌ 只有 optionId
        }],
        // ...
    }));
}
```

**修改后**：
```typescript
const data = interaction as {
    options?: Array<{ 
        id?: string; 
        label?: string; 
        disabled?: boolean;
        value?: unknown;  // ✅ 添加 value 字段
    }>;
    multi?: { min?: number; max?: number };
};

const availableOptions = (data.options ?? []).filter((option): option is { 
    id: string; 
    label?: string;
    value?: unknown;  // ✅ 添加 value 字段
} => {
    return typeof option.id === 'string' && option.disabled !== true;
});

// 单选模式
if (!data.multi) {
    return availableOptions.map((option, index) => ({
        // ...
        commands: [{
            type: 'SYS_INTERACTION_RESPOND',
            payload: buildSimpleChoicePayload([option.id], data.multi, option.value),  // ✅ 展开 option.value
        }],
        // ...
    }));
}
```

## 修复效果

### Ambusher (faction_selection)

**修复前**：
```typescript
{
    type: 'SYS_INTERACTION_RESPOND',
    payload: {
        optionId: 'faction_swamp'
    }
}
```

**修复后**：
```typescript
{
    type: 'SYS_INTERACTION_RESPOND',
    payload: {
        optionId: 'faction_swamp',
        faction: 'swamp'  // ✅ 从 option.value 展开
    }
}
```

### Inventor (card_selection)

**修复前**：
```typescript
{
    type: 'SYS_INTERACTION_RESPOND',
    payload: {
        optionId: 'card_123'
    }
}
```

**修复后**：
```typescript
{
    type: 'SYS_INTERACTION_RESPOND',
    payload: {
        optionId: 'card_123',
        cardUid: 'card_123'  // ✅ 从 option.value 展开
    }
}
```

## 验证

- ✅ ESLint 检查通过（0 errors）
- ⏳ 待运行 Bug Condition Exploration Test 验证修复效果

## 相关文件

- `src/games/cardia/ai.ts` - 修复的文件
- `src/games/cardia/domain/systems.ts` - wrapCardiaInteraction 函数（创建 simple-choice）
- `src/games/cardia/domain/abilities/group7-faction.ts` - Ambusher 能力实现
- `src/engine/systems/InteractionSystem.ts` - 交互系统（验证 payload）
- `src/engine/systems/SimpleChoiceSystem.ts` - simple-choice 处理逻辑
- `src/games/smashup/ai.ts` - Smash Up AI 实现（参考示例）

## 下一步

运行 Bug Condition Exploration Test 验证修复效果：
```bash
BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 npm run test:e2e:ci:file -- cardia-ai-transport-bug-exploration.e2e.ts
```
