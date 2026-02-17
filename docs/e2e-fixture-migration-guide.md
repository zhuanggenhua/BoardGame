# E2E 测试 Fixture 迁移指南

## 概述

本指南说明如何将现有的 E2E 测试迁移到使用 Playwright Fixture，以减少重复代码并提高可维护性。

## 为什么要迁移

### 问题

现有测试存在大量重复代码：
- 每个测试需要 15-20 行 setup 代码
- 每个测试需要 3-5 行 cleanup 代码
- 50+ 个测试 = 约 1000 行重复代码
- 错误处理和清理逻辑不一致

### 收益

使用 Fixture 后：
- 减少 60-70% 的代码量
- 自动管理 setup/teardown
- 统一的错误处理
- 类型安全
- 更易维护

## 迁移步骤

### 步骤 1：更新导入

**迁移前：**
```typescript
import { test, expect } from '@playwright/test';
import { setupSmashUpOnlineMatch } from './helpers/smashup';
```

**迁移后：**
```typescript
import { test, expect } from './fixtures';
// 如需自定义配置，导入工厂函数
import { createSmashUpMatch } from './fixtures';
```

### 步骤 2：使用 Fixture

#### 场景 A：使用默认配置

**迁移前：**
```typescript
test('测试名称', async ({ browser }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL;
  
  // 15+ 行 setup 代码
  const setup = await setupSmashUpOnlineMatch(browser, baseURL);
  if (!setup) {
    test.skip();
    return;
  }
  
  const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;
  
  try {
    // 测试代码
    await hostPage.click('[data-testid="play-card"]');
    await expect(hostPage.getByText('Card played')).toBeVisible();
  } finally {
    // cleanup
    await hostContext.close();
    await guestContext.close();
  }
});
```

**迁移后：**
```typescript
test('测试名称', async ({ smashupMatch }) => {
  const { hostPage, guestPage, matchId } = smashupMatch;
  
  // 测试代码
  await hostPage.click('[data-testid="play-card"]');
  await expect(hostPage.getByText('Card played')).toBeVisible();
  
  // 自动 cleanup
});
```

#### 场景 B：需要自定义配置

**迁移前：**
```typescript
test('自定义派系', async ({ browser }, testInfo) => {
  const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL, {
    hostFactions: [9, 0],
    guestFactions: [1, 2],
  });
  
  if (!setup) {
    test.skip();
    return;
  }
  
  const { hostPage, guestPage, hostContext, guestContext } = setup;
  
  try {
    // 测试代码
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
```

**迁移后：**
```typescript
test('自定义派系', async ({ browser }, testInfo) => {
  const setup = await createSmashUpMatch(browser, testInfo.project.use.baseURL, {
    hostFactions: [9, 0],
    guestFactions: [1, 2],
  });
  
  if (!setup) {
    test.skip();
    return;
  }
  
  const { hostPage, guestPage } = setup;
  
  // 测试代码
  
  // 注意：工厂函数创建的对局需要手动清理
  await setup.hostContext.close();
  await setup.guestContext.close();
});
```

### 步骤 3：删除旧的 helper 导入

迁移后，可以删除不再需要的导入：

```typescript
// 可以删除
import { setupSmashUpOnlineMatch } from './helpers/smashup';
import { setupDTOnlineMatch } from './helpers/dicethrone';
import { setupSWOnlineMatch } from './helpers/summonerwars';
```

保留需要的工具函数导入：

```typescript
// 保留
import { readCoreState, applyCoreState } from './helpers/smashup';
import { applyDiceValues, readCoreState } from './helpers/dicethrone';
```

## 可用的 Fixture

### SmashUp

```typescript
test('test', async ({ smashupMatch }) => {
  const { hostPage, guestPage, matchId, hostContext, guestContext } = smashupMatch;
  // 默认配置：Host 派系 [0,1], Guest 派系 [2,3]
});
```

### DiceThrone

```typescript
test('test', async ({ dicethroneMatch }) => {
  const { hostPage, guestPage, matchId, hostContext, guestContext } = dicethroneMatch;
  // 默认配置：Host Monk, Guest Barbarian
});
```

### SummonerWars

```typescript
test('test', async ({ summonerwarsMatch }) => {
  const { hostPage, guestPage, matchId, hostContext, guestContext } = summonerwarsMatch;
  // 默认配置：Host Necromancer, Guest Trickster
});
```

## 工厂函数（自定义配置）

### createSmashUpMatch

```typescript
import { createSmashUpMatch } from './fixtures';

const setup = await createSmashUpMatch(browser, baseURL, {
  hostFactions: [9, 0],  // 幽灵 + 海盗
  guestFactions: [1, 2], // 忍者 + 恐龙
});
```

### createDiceThroneMatch

```typescript
import { createDiceThroneMatch } from './fixtures';

const setup = await createDiceThroneMatch(browser, baseURL);
// 注意：DiceThrone 目前不支持自定义角色，使用默认配置
```

### createSummonerWarsMatch

```typescript
import { createSummonerWarsMatch } from './fixtures';

const setup = await createSummonerWarsMatch(
  browser,
  baseURL,
  'phoenix_elf',  // Host 阵营
  'goblin'        // Guest 阵营
);
```

## 迁移检查清单

- [ ] 更新导入：`from '@playwright/test'` → `from './fixtures'`
- [ ] 替换 setup 代码：使用 fixture 或工厂函数
- [ ] 删除手动 cleanup 代码（fixture 自动处理）
- [ ] 删除不再需要的 helper 导入
- [ ] 运行测试验证迁移成功
- [ ] 删除旧的测试文件（可选）

## 常见问题

### Q: 什么时候使用 fixture，什么时候使用工厂函数？

A: 
- **使用 fixture**：默认配置满足需求时（大多数情况）
- **使用工厂函数**：需要自定义派系/角色时

### Q: 工厂函数创建的对局需要手动清理吗？

A: 是的。工厂函数返回的对局需要手动调用 `close()`：

```typescript
try {
  // 测试代码
} finally {
  await setup.hostContext.close();
  await setup.guestContext.close();
}
```

### Q: 可以在一个测试中使用多个 fixture 吗？

A: 可以，但不推荐（会创建多个对局，消耗更多资源）：

```typescript
test('多个 fixture', async ({ smashupMatch, dicethroneMatch }) => {
  // 可以访问两个对局
});
```

### Q: 如何处理 fixture 创建失败？

A: Fixture 创建失败会抛出错误，测试会自动失败。如果需要 skip：

```typescript
test('test', async ({ smashupMatch }) => {
  // fixture 已经处理了失败情况，这里直接使用即可
});
```

### Q: 旧的 helper 函数还能用吗？

A: 可以，但不推荐。新测试应该使用 fixture，旧测试可以逐步迁移。

## 迁移优先级

### 高优先级（建议先迁移）

1. 简单的功能测试（只需默认配置）
2. 重复代码最多的测试文件
3. 经常修改的测试文件

### 低优先级（可以延后）

1. 需要复杂自定义配置的测试
2. 使用状态注入的测试（`setupOnlineMatch`）
3. 很少修改的稳定测试

## 示例

完整示例见：
- `e2e/example-fixture-usage.e2e.ts` - Fixture 使用示例
- `e2e/smashup-ghost-haunted-house-fixture.e2e.ts` - 实际测试迁移示例

## 相关文档

- `docs/automated-testing.md` - 测试规范主文档
- `e2e/fixtures/index.ts` - Fixture 实现
- `e2e/helpers/` - Helper 函数（仍然可用）
