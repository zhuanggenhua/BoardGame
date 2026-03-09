# 组 1 能力测试拆分完成报告

## 问题回顾

原始测试文件 `abilities-group1-resources.test.ts` 在运行时卡在初始化阶段（显示 "0/14"），经过诊断发现两个根本原因：

1. **测试文件过大**：14 个测试用例在同一个文件中，导致 Vitest 初始化卡死
2. **HEIR 能力实现 bug**：使用 `while` 循环 + 固定随机数（`ctx.random()` 总是返回 0.5）导致无限循环

## 解决方案

### 1. 拆分测试文件

将原始测试文件拆分为 5 个独立的测试文件，每个文件测试一个能力：

| 测试文件 | 能力 | 测试数量 | 状态 |
|---------|------|---------|------|
| `ability-saboteur.test.ts` | 破坏者（Saboteur） | 3 | ✅ 通过 |
| `ability-revolutionary.test.ts` | 革命者（Revolutionary） | 3 | ✅ 通过 |
| `ability-ambusher.test.ts` | 伏击者（Ambusher） | 3 | ✅ 通过 |
| `ability-witch-king.test.ts` | 巫王（Witch King） | 2 | ✅ 通过 |
| `ability-heir.test.ts` | 继承者（Heir） | 3 | ✅ 通过 |

**总计**：5 个文件，14 个测试，全部通过 ✅

### 2. 修复 HEIR 能力实现

**原始代码（有 bug）**：
```typescript
const keptCardIndices = new Set<number>();
while (keptCardIndices.size < 2) {
    const randomIndex = Math.floor(ctx.random() * handCards.length);
    keptCardIndices.add(randomIndex);
}
```

**问题**：如果 `ctx.random()` 总是返回相同的值（如 0.5），`randomIndex` 会一直是同一个索引，Set 的 size 永远不会增长到 2，导致无限循环。

**修复后的代码**：
```typescript
// 使用 Fisher-Yates 洗牌算法选择 2 张保留的牌，避免无限循环
const availableIndices = Array.from({ length: handCards.length }, (_, i) => i);
const keptCardIndices: number[] = [];

for (let i = 0; i < 2; i++) {
    const randomIdx = Math.floor(ctx.random() * availableIndices.length);
    keptCardIndices.push(availableIndices[randomIdx]);
    availableIndices.splice(randomIdx, 1);
}

const keptSet = new Set(keptCardIndices);
const discardedCardIds = handCards
    .filter((_, index) => !keptSet.has(index))
    .map(card => card.uid);
```

**优点**：
- 使用 Fisher-Yates 洗牌算法，保证每次循环都会选择不同的索引
- 即使 `ctx.random()` 返回固定值，也不会导致无限循环
- 算法复杂度 O(n)，性能优秀

## 测试运行结果

```bash
npm run test -- src/games/cardia/__tests__/ability-*.test.ts --run
```

```
✓ src/games/cardia/__tests__/ability-ambusher.test.ts (3 tests) 7ms
✓ src/games/cardia/__tests__/ability-saboteur.test.ts (3 tests) 7ms
✓ src/games/cardia/__tests__/ability-witch-king.test.ts (2 tests) 8ms
✓ src/games/cardia/__tests__/ability-heir.test.ts (3 tests) 8ms
✓ src/games/cardia/__tests__/ability-revolutionary.test.ts (3 tests) 9ms

Test Files  5 passed (5)
     Tests  14 passed (14)
  Duration  2.09s
```

## 清理工作

已删除以下临时测试文件：
- ❌ `abilities-group1-resources.test.ts`（原始卡死的文件）
- ❌ `minimal-test.test.ts`（诊断用）
- ❌ `saboteur-only.test.ts`（诊断用）
- ❌ `saboteur-two-tests.test.ts`（诊断用）
- ❌ `saboteur-complete.test.ts`（诊断用）
- ❌ `with-faction-import.test.ts`（诊断用）

## 经验教训

1. **测试文件不宜过大**：单个测试文件不超过 10 个测试用例，避免 Vitest 初始化问题
2. **避免 while 循环 + 随机数**：使用 Fisher-Yates 洗牌算法等确定性算法，避免无限循环
3. **测试 mock 数据要合理**：`ctx.random()` 返回固定值（0.5）是合理的测试策略，但能力实现必须能处理这种情况
4. **逐步增加测试**：从最小化测试开始，逐步添加复杂度，及时发现问题

## 下一步

继续按照相同模式重写其他 6 个组的测试文件（group2-7），每个能力一个独立的测试文件。

## 文件清单

**新增文件**：
- `src/games/cardia/__tests__/ability-saboteur.test.ts`
- `src/games/cardia/__tests__/ability-revolutionary.test.ts`
- `src/games/cardia/__tests__/ability-ambusher.test.ts`
- `src/games/cardia/__tests__/ability-witch-king.test.ts`
- `src/games/cardia/__tests__/ability-heir.test.ts`

**修改文件**：
- `src/games/cardia/domain/abilities/group1-resources.ts`（修复 HEIR 能力的无限循环 bug）

**删除文件**：
- `src/games/cardia/__tests__/abilities-group1-resources.test.ts`
- `src/games/cardia/__tests__/minimal-test.test.ts`
- `src/games/cardia/__tests__/saboteur-only.test.ts`
- `src/games/cardia/__tests__/saboteur-two-tests.test.ts`
- `src/games/cardia/__tests__/saboteur-complete.test.ts`
- `src/games/cardia/__tests__/with-faction-import.test.ts`
