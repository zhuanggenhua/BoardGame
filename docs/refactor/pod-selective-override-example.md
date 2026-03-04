# POD 版本选择性覆盖示例

## 核心机制

POD 自动映射支持**选择性覆盖**：
- **默认行为**：POD 版本自动复用基础版本的能力
- **显式覆盖**：如果 POD 版本规则不同，显式注册会覆盖自动映射

## 工作原理

```typescript
export function registerPodOngoingAliases(): void {
    for (const entry of triggerRegistry) {
        const { sourceDefId, timing, callback } = entry;
        
        if (sourceDefId.endsWith('_pod')) continue;
        
        const podDefId = `${sourceDefId}_pod`;
        
        // ✅ 关键：如果 POD 版本已经注册，跳过（不覆盖显式注册）
        const alreadyRegistered = triggerRegistry.some(
            e => e.sourceDefId === podDefId && e.timing === timing
        );
        if (alreadyRegistered) continue;
        
        // 只有未注册的 POD 版本才会自动映射
        triggersToAdd.push({ sourceDefId: podDefId, timing, callback });
    }
}
```

## 使用示例

### 场景 1：POD 版本与基础版本相同（自动映射）

```typescript
// ✅ 只注册基础版本
export function registerAlienAbilities(): void {
    registerTrigger('alien_scout', 'afterScoring', alienScoutAfterScoring);
    // alien_scout_pod 会自动映射到 alienScoutAfterScoring
}

export function registerZombieAbilities(): void {
    registerAbility('zombie_they_keep_coming', 'onPlay', zombieTheyKeepComing);
    // zombie_they_keep_coming_pod 会自动映射到 zombieTheyKeepComing
    
    registerTrigger('zombie_overrun', 'onTurnStart', zombieOverrunSelfDestruct);
    // zombie_overrun_pod 会自动映射到 zombieOverrunSelfDestruct
}
```

### 场景 2：POD 版本规则不同（显式覆盖）

```typescript
export function registerDinosaurAbilities(): void {
    // 基础版本：使用当前力量
    registerAbility('dino_laser_triceratops', 'onPlay', dinoLaserTriceratops);
    
    // ✅ POD 版本规则不同：使用印制力量
    // 显式注册会覆盖自动映射
    registerAbility('dino_laser_triceratops_pod', 'onPlay', dinoLaserTriceratopsPod);
}

function dinoLaserTriceratops(ctx: AbilityContext): AbilityResult {
    // 基础版：使用当前力量（包含修正）
    const power = getMinionPower(ctx.state, minion, ctx.baseIndex);
    // ...
}

function dinoLaserTriceratopsPod(ctx: AbilityContext): AbilityResult {
    // POD 版：使用印制力量（不含修正）
    const power = getMinionDef(minion.defId).power;
    // ...
}
```

### 场景 3：部分能力相同，部分不同

```typescript
export function registerWizardAbilities(): void {
    // 基础版本
    registerAbility('wizard_archmage', 'onPlay', wizardArchmage);
    registerTrigger('wizard_archmage', 'onTurnStart', wizardArchmageTurnStart);
    
    // ✅ POD 版本：onPlay 相同（自动映射），onTurnStart 不同（显式覆盖）
    registerTrigger('wizard_archmage_pod', 'onTurnStart', wizardArchmagePodTurnStart);
    // wizard_archmage_pod 的 onPlay 会自动映射到 wizardArchmage
}
```

## 注册顺序要求

**重要**：显式注册必须在 `registerPodOngoingAliases()` 调用**之前**完成。

```typescript
export function initAllAbilities(): void {
    // 1. 所有派系注册（包括显式的 POD 覆盖）
    registerAlienAbilities();
    registerDinosaurAbilities();  // 包含 dino_laser_triceratops_pod 的显式注册
    // ...
    
    // 2. 自动映射（会跳过已显式注册的 POD 版本）
    registerPodAbilityAliases();
    registerPodInteractionAliases();
    registerPodOngoingAliases();  // ✅ 在这里跳过 dino_laser_triceratops_pod
}
```

## 验证方法

### 开发时检查

在控制台查看自动映射日志：

```
[POD Ongoing Aliases] 自动映射 72 个 POD 版本的 trigger/restriction/protection
```

如果某个 POD 版本被显式注册，它不会出现在自动映射的计数中。

### 测试验证

```typescript
describe('POD 选择性覆盖', () => {
    it('相同规则：自动映射', () => {
        // alien_scout_pod 应该触发与 alien_scout 相同的逻辑
        const result = fireTriggers(core, 'afterScoring', { ... });
        expect(result.matchState?.sys.interaction?.current).toBeDefined();
    });
    
    it('不同规则：显式覆盖', () => {
        // dino_laser_triceratops_pod 应该使用印制力量，而非当前力量
        const result = execute(core, {
            type: 'PLAY_MINION',
            payload: { defId: 'dino_laser_triceratops_pod', ... }
        });
        // 验证使用的是印制力量
    });
});
```

## 优势

1. **默认复用**：90% 的 POD 卡牌与基础版本相同，自动映射减少重复代码
2. **灵活覆盖**：10% 的 POD 卡牌规则不同，显式注册即可覆盖
3. **类型安全**：编译期检查，防止注册错误
4. **易于维护**：修改基础版本时，相同规则的 POD 版本自动同步

## 实际案例

### 外星人派系（100% 自动映射）

```typescript
// 所有 POD 版本与基础版本相同，0 行显式注册
registerTrigger('alien_scout', 'afterScoring', alienScoutAfterScoring);
// alien_scout_pod 自动映射 ✅
```

### 恐龙派系（部分覆盖）

```typescript
// 大部分相同，自动映射
registerAbility('dino_augmentation', 'onPlay', dinoAugmentation);
// dino_augmentation_pod 自动映射 ✅

// 少数不同，显式覆盖
registerAbility('dino_laser_triceratops_pod', 'onPlay', dinoLaserTriceratopsPod);
// dino_laser_triceratops_pod 使用显式注册 ✅
```

### 僵尸派系（100% 自动映射）

```typescript
// 所有 POD 版本与基础版本相同
registerAbility('zombie_they_keep_coming', 'onPlay', zombieTheyKeepComing);
registerTrigger('zombie_overrun', 'onTurnStart', zombieOverrunSelfDestruct);
// 两个 _pod 版本都自动映射 ✅
```

## 总结

POD 自动映射机制完全支持选择性覆盖：
- ✅ **默认行为**：自动复用基础版本（减少重复代码）
- ✅ **显式覆盖**：规则不同时显式注册（灵活性）
- ✅ **类型安全**：编译期检查（防止错误）
- ✅ **易于维护**：修改基础版本时自动同步（一致性）
