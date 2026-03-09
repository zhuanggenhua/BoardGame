# 测试卡死问题最终解决方案

## 问题总结

测试在以下情况下的行为：
- ✅ **单个测试用例**：可以正常运行
- ❌ **所有测试用例**：卡死，无法完成

## 根本原因

经过深入分析，发现问题是 **`beforeEach` 中的状态污染**：

```typescript
beforeEach(() => {
  const mockCore = createMockCore({...});
  
  // ❌ 问题：直接修改 mockCore.players 的引用
  mockCore.players['player2'].deck = [...];
  
  mockContext = createMockContext({ core: mockCore });
});
```

当运行多个测试时，`beforeEach` 会被多次调用，但某些测试用例中修改了 `mockContext.core.players['player2']` 的状态（如清空 `hand` 或 `deck`），这些修改可能影响后续测试。

## 解决方案

### 方案 1：每个测试独立创建数据（推荐）

移除 `beforeEach`，在每个测试中独立创建模拟数据：

```typescript
describe('破坏者（Saboteur）', () => {
  it('应该让对手弃掉牌库顶 2 张牌', () => {
    const mockContext = createMockContext({
      core: createMockCore({
        players: {
          'player1': createPlayerWithHand('player1', [...]),
          'player2': createPlayerWithDeck('player2', [...]),
        },
      }),
    });
    
    const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.SABOTEUR);
    const result = executor!(mockContext);
    
    expect(result.events).toHaveLength(1);
  });
});
```

**优点**：
- 每个测试完全独立，无状态污染
- 测试意图更清晰（数据就在测试中）
- 更容易调试（不需要查看 `beforeEach`）

**缺点**：
- 代码略有重复（但可以通过辅助函数缓解）

### 方案 2：深拷贝 mockContext（备选）

在 `beforeEach` 中创建基础数据，在每个测试中深拷贝：

```typescript
let baseMockContext: CardiaAbilityContext;

beforeEach(() => {
  baseMockContext = createMockContext({...});
});

it('测试用例', () => {
  const mockContext = JSON.parse(JSON.stringify(baseMockContext));
  // 使用 mockContext
});
```

**优点**：
- 保留 `beforeEach` 的便利性
- 避免状态污染

**缺点**：
- 深拷贝性能开销
- 可能丢失函数引用（如 `random()`）

### 方案 3：使用 `beforeEach` + 不可变更新（备选）

在测试中需要修改状态时，创建新对象而非修改原对象：

```typescript
it('当对手手牌为空时', () => {
  const modifiedContext = createMockContext({
    ...mockContext,
    core: {
      ...mockContext.core,
      players: {
        ...mockContext.core.players,
        'player2': {
          ...mockContext.core.players['player2'],
          hand: [],
        },
      },
    },
  });
  
  // 使用 modifiedContext
});
```

**优点**：
- 保留 `beforeEach` 的便利性
- 避免状态污染
- 性能较好

**缺点**：
- 代码冗长
- 容易出错（忘记 spread）

## 推荐实施方案

**采用方案 1**：每个测试独立创建数据

### 实施步骤

1. **创建数据工厂函数**（在 `test-helpers.ts` 中）：

```typescript
export function createSaboteurTestContext(): CardiaAbilityContext {
  return createMockContext({
    core: createMockCore({
      players: {
        'player1': createPlayerWithHand('player1', [
          { defId: 'test_card_1', baseInfluence: 5, faction: 'swamp' },
        ]),
        'player2': createPlayerWithDeck('player2', [
          { defId: 'test_deck_1', baseInfluence: 5, faction: 'dynasty' },
          { defId: 'test_deck_2', baseInfluence: 3, faction: 'swamp' },
        ]),
      },
    }),
  });
}
```

2. **在测试中使用工厂函数**：

```typescript
describe('破坏者（Saboteur）', () => {
  it('应该让对手弃掉牌库顶 2 张牌', () => {
    const mockContext = createSaboteurTestContext();
    const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.SABOTEUR);
    const result = executor!(mockContext);
    expect(result.events).toHaveLength(1);
  });
  
  it('当对手牌库为空时', () => {
    const mockContext = createSaboteurTestContext();
    mockContext.core.players['player2'].deck = []; // 修改副本，不影响其他测试
    const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.SABOTEUR);
    const result = executor!(mockContext);
    expect(result.events).toHaveLength(0);
  });
});
```

## 下一步行动

1. **立即行动**：
   - 移除所有测试文件中的 `beforeEach`
   - 为每个能力组创建专用的数据工厂函数
   - 在每个测试中独立创建模拟数据

2. **验证**：
   - 运行单个测试文件：`npm run test -- src/games/cardia/__tests__/abilities-group1-resources.test.ts --run`
   - 运行所有测试：`npm run test -- src/games/cardia/__tests__/ --run`

3. **后续优化**：
   - 添加更多数据工厂函数，覆盖常见场景
   - 考虑使用 `test.each()` 减少重复代码
   - 添加测试覆盖率报告

## 时间估算

- 修复单个测试文件：~10 分钟
- 修复所有 7 个测试文件：~1 小时
- 验证和调试：~30 分钟
- **总计：~1.5 小时**

## 状态

🟡 **部分解决** - 单个测试可以运行，但需要重构测试结构以支持运行所有测试

**下一步**：实施方案 1，移除 `beforeEach`，使用数据工厂函数
