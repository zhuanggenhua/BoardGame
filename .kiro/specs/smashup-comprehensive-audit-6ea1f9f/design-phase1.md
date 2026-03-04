# Phase 1: Critical Issues - 详细实现计划

## Overview

Phase 1 专注于修复已确认的 3 个严重问题，这些问题直接影响用户体验和游戏功能。

优先级：Highest
预计时间：2-4 小时
依赖：无

## Issue 1: 太极回合限制逻辑恢复

### Problem Description

DiceThrone 太极角色的回合限制逻辑被删除，导致玩家可以无限次使用技能。原逻辑应该限制每回合只能使用特定次数的技能。

### Investigation Steps

1. **定位相关代码**
   ```bash
   # 搜索太极相关代码
   grepSearch "太极" --includePattern "**/*.ts"
   grepSearch "taichi" --includePattern "**/*.ts"
   grepSearch "turn limit" --includePattern "**/dicethrone/**/*.ts"
   ```

2. **查看原始实现**
   ```bash
   # 查看 6ea1f9f 之前的 characters.ts
   git show 6ea1f9f^:src/games/dicethrone/domain/characters.ts
   
   # 查看具体变更
   git diff 6ea1f9f^..6ea1f9f -- src/games/dicethrone/domain/characters.ts
   ```

3. **分析删除原因**
   - 检查是否有替代实现
   - 检查是否有相关的 issue 或 PR
   - 确认删除是否为误操作

### Restoration Strategy

**Option A: 完全恢复原始代码**
- 适用场景：原始实现正确且无替代方案
- 步骤：
  1. 从 git history 提取原始代码
  2. 恢复到当前代码库
  3. 运行测试验证

**Option B: 重新实现**
- 适用场景：原始实现有问题或需要适配新架构
- 步骤：
  1. 理解原始逻辑
  2. 使用当前架构重新实现
  3. 编写测试验证

**推荐方案**：先尝试 Option A，如果有冲突或架构不兼容再考虑 Option B

### Implementation Details

**File**: `src/games/dicethrone/domain/characters.ts` 或相关文件

**Expected Code Structure**:
```typescript
// 太极角色定义
export const TAICHI_CHARACTER = {
  id: 'taichi',
  name: '太极',
  abilities: [
    {
      id: 'taichi_ability_1',
      turnLimit: 1, // 每回合限制
      // ... 其他配置
    }
  ],
  // ... 其他配置
};

// 回合限制检查逻辑
export function canUseAbility(
  character: Character,
  abilityId: string,
  state: GameState
): boolean {
  const ability = character.abilities.find(a => a.id === abilityId);
  if (!ability) return false;
  
  if (ability.turnLimit) {
    const usageCount = getAbilityUsageThisTurn(state, abilityId);
    if (usageCount >= ability.turnLimit) {
      return false;
    }
  }
  
  return true;
}
```

### Testing Strategy

**Unit Tests** (使用 GameTestRunner):
```typescript
describe('Taichi Turn Limit', () => {
  it('should limit ability usage per turn', () => {
    const runner = new GameTestRunner('dicethrone');
    runner.setup({
      player0: { character: 'taichi' },
      player1: { character: 'any' }
    });
    
    // 第一次使用应该成功
    runner.dispatch('USE_ABILITY', { abilityId: 'taichi_ability_1' });
    expect(runner.getState().lastAction).toBe('success');
    
    // 第二次使用应该失败（如果限制为 1）
    runner.dispatch('USE_ABILITY', { abilityId: 'taichi_ability_1' });
    expect(runner.getState().lastAction).toBe('invalid');
    
    // 下一回合应该重置
    runner.advanceTurn();
    runner.dispatch('USE_ABILITY', { abilityId: 'taichi_ability_1' });
    expect(runner.getState().lastAction).toBe('success');
  });
});
```

**E2E Tests** (使用 Playwright):
```typescript
test('Taichi turn limit in real game', async ({ page }) => {
  await setupOnlineMatch(page, 'dicethrone', {
    player0Character: 'taichi',
    player1Character: 'any'
  });
  
  // 使用技能
  await page.click('[data-testid="ability-taichi_ability_1"]');
  await expect(page.locator('[data-testid="action-log"]'))
    .toContainText('使用了技能');
  
  // 再次尝试使用应该被禁用
  await expect(page.locator('[data-testid="ability-taichi_ability_1"]'))
    .toBeDisabled();
});
```

### Verification Checklist

- [ ] 原始代码已定位
- [ ] 删除原因已分析
- [ ] 恢复策略已确定
- [ ] 代码已恢复/重新实现
- [ ] Unit tests 已编写并通过
- [ ] E2E tests 已编写并通过
- [ ] 手动测试已完成
- [ ] 代码审查已完成

## Issue 2: 响应窗口视角自动切换恢复

### Problem Description

响应窗口触发时不再自动切换到响应玩家视角，导致用户可能看不到需要响应的提示。

### Investigation Steps

1. **定位相关代码**
   ```bash
   # 搜索响应窗口相关代码
   grepSearch "responseWindow" --includePattern "**/*.ts"
   grepSearch "视角" --includePattern "**/*.tsx"
   grepSearch "viewMode" --includePattern "**/*.ts"
   grepSearch "perspective" --includePattern "**/*.ts"
   ```

2. **查看原始实现**
   ```bash
   # 查看可能的文件
   git show 6ea1f9f^:src/engine/systems/ResponseWindowSystem.ts
   git show 6ea1f9f^:src/components/game/framework/GameHUD.tsx
   git show 6ea1f9f^:src/hooks/useAutoSwitchPerspective.ts
   ```

3. **分析视角切换逻辑**
   - 检查是否有 useEffect 监听 responseWindow 状态
   - 检查是否有自动切换视角的函数
   - 确认删除是否为有意为之

### Restoration Strategy

**Expected Behavior**:
- 当响应窗口打开时，自动切换到响应玩家的视角
- 当响应窗口关闭时，恢复到原视角（可选）
- 用户可以手动切换视角（不受自动切换影响）

**Implementation Location**:
- Option A: 在 ResponseWindowSystem 中实现（引擎层）
- Option B: 在 GameHUD 或相关组件中实现（UI 层）
- Option C: 使用自定义 Hook（推荐）

**推荐方案**: Option C - 创建 `useAutoSwitchPerspective` Hook

### Implementation Details

**File**: `src/hooks/useAutoSwitchPerspective.ts` (新建或恢复)

**Expected Code**:
```typescript
import { useEffect } from 'react';
import { useGameState } from '../contexts/GameContext';

export function useAutoSwitchPerspective() {
  const { state, playerID, setViewMode } = useGameState();
  
  useEffect(() => {
    const responseWindow = state.sys.responseWindow?.current;
    
    if (responseWindow && responseWindow.playerId !== playerID) {
      // 自动切换到响应玩家视角
      setViewMode(responseWindow.playerId);
    }
  }, [state.sys.responseWindow, playerID, setViewMode]);
}
```

**Usage in GameHUD**:
```typescript
// src/components/game/framework/GameHUD.tsx
import { useAutoSwitchPerspective } from '../../hooks/useAutoSwitchPerspective';

export function GameHUD() {
  useAutoSwitchPerspective(); // 启用自动切换
  
  // ... 其他代码
}
```

### Testing Strategy

**E2E Tests**:
```typescript
test('Auto switch perspective on response window', async ({ page }) => {
  await setupOnlineMatch(page, 'dicethrone', {
    player0Character: 'any',
    player1Character: 'any'
  });
  
  // 触发响应窗口（例如：使用反击技能）
  await page.click('[data-testid="ability-counter"]');
  
  // 验证视角自动切换到响应玩家
  await expect(page.locator('[data-testid="current-player-indicator"]'))
    .toContainText('Player 1');
  
  // 验证响应窗口可见
  await expect(page.locator('[data-testid="response-window"]'))
    .toBeVisible();
});
```

### Verification Checklist

- [ ] 原始代码已定位
- [ ] 视角切换逻辑已理解
- [ ] Hook 已创建/恢复
- [ ] GameHUD 已集成 Hook
- [ ] E2E tests 已编写并通过
- [ ] 手动测试已完成（多个游戏）
- [ ] 用户体验已验证

## Issue 3: 变体排序逻辑恢复

### Problem Description

变体列表排序逻辑被删除，导致变体显示顺序混乱，影响用户选择体验。

### Investigation Steps

1. **定位相关代码**
   ```bash
   # 搜索变体相关代码
   grepSearch "variant" --includePattern "**/*.tsx"
   grepSearch "sort" --includePattern "**/lobby/**/*.tsx"
   grepSearch "变体" --includePattern "**/*.tsx"
   ```

2. **查看原始实现**
   ```bash
   # 查看可能的文件
   git show 6ea1f9f^:src/pages/Lobby.tsx
   git show 6ea1f9f^:src/components/lobby/VariantSelector.tsx
   git show 6ea1f9f^:src/components/lobby/GameCard.tsx
   ```

3. **分析排序逻辑**
   - 检查原始排序规则（按名称？按优先级？）
   - 确认是否有配置文件定义排序顺序
   - 检查是否影响所有游戏

### Restoration Strategy

**Expected Sorting Order**:
1. 标准模式（Standard）
2. 官方变体（按发布顺序）
3. 社区变体（按字母顺序）

**Implementation Location**:
- 大厅组件（Lobby.tsx）
- 变体选择器组件（VariantSelector.tsx）
- 游戏配置文件（game.ts）

### Implementation Details

**File**: `src/components/lobby/VariantSelector.tsx` 或相关文件

**Expected Code**:
```typescript
// 变体排序函数
function sortVariants(variants: Variant[]): Variant[] {
  return variants.sort((a, b) => {
    // 标准模式优先
    if (a.id === 'standard') return -1;
    if (b.id === 'standard') return 1;
    
    // 官方变体按优先级排序
    if (a.official && b.official) {
      return (a.priority || 0) - (b.priority || 0);
    }
    
    // 官方变体优先于社区变体
    if (a.official && !b.official) return -1;
    if (!a.official && b.official) return 1;
    
    // 社区变体按名称排序
    return a.name.localeCompare(b.name);
  });
}

// 使用排序函数
export function VariantSelector({ variants }: Props) {
  const sortedVariants = useMemo(
    () => sortVariants(variants),
    [variants]
  );
  
  return (
    <div>
      {sortedVariants.map(variant => (
        <VariantCard key={variant.id} variant={variant} />
      ))}
    </div>
  );
}
```

### Testing Strategy

**Unit Tests**:
```typescript
describe('Variant Sorting', () => {
  it('should sort standard first', () => {
    const variants = [
      { id: 'custom', name: 'Custom', official: false },
      { id: 'standard', name: 'Standard', official: true },
      { id: 'expansion', name: 'Expansion', official: true }
    ];
    
    const sorted = sortVariants(variants);
    expect(sorted[0].id).toBe('standard');
  });
  
  it('should sort official before community', () => {
    const variants = [
      { id: 'community1', name: 'Community', official: false },
      { id: 'official1', name: 'Official', official: true }
    ];
    
    const sorted = sortVariants(variants);
    expect(sorted[0].official).toBe(true);
  });
});
```

**Manual Testing**:
- 打开大厅页面
- 选择不同游戏
- 验证变体列表顺序正确
- 验证所有游戏的变体排序一致

### Verification Checklist

- [ ] 原始代码已定位
- [ ] 排序规则已理解
- [ ] 排序函数已实现
- [ ] Unit tests 已编写并通过
- [ ] 手动测试已完成（所有游戏）
- [ ] UI 显示正确

## Phase 1 Summary

### Success Criteria

- [ ] 所有 3 个严重问题已修复
- [ ] 所有相关测试已通过
- [ ] 手动测试已验证功能正确
- [ ] 代码审查已完成
- [ ] 文档已更新

### Next Steps

完成 Phase 1 后，进入 Phase 2（DiceThrone Module Audit），系统性审查 DiceThrone 的 106 个文件变更。
