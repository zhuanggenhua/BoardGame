# E2E 测试状态注入指南

> 通用的 E2E 测试方案：跳过所有前置步骤，直接构造目标场景

## 🎯 核心思想

传统 E2E 测试的问题：
- ❌ 需要真实玩游戏到目标状态（耗时、不稳定）
- ❌ 依赖随机性（骰子、抽牌、洗牌）
- ❌ 前置步骤失败会导致测试失败
- ❌ 难以复现特定场景

新方案的优势：
- ✅ 直接注入目标状态（快速、稳定）
- ✅ 精确控制随机性（可预测）
- ✅ 跳过所有前置步骤（专注测试目标）
- ✅ 轻松复现任何场景

## 📦 工具集

### SmashUp 状态构造器

位置：`e2e/helpers/smashup-state-builder.ts`

提供以下工具函数：

| 函数 | 用途 | 示例 |
|------|------|------|
| `buildScene()` | 构造场景（手牌、牌库、弃牌堆） | 见下文 |
| `playCard()` | 打出指定卡牌 | `playCard(page, 'wizard_portal')` |
| `waitForInteraction()` | 等待交互出现 | `waitForInteraction(page, 'wizard_portal_pick')` |
| `getInteractionOptions()` | 获取交互选项 | `const opts = await getInteractionOptions(page)` |
| `selectInteractionOption()` | 选择交互选项 | `selectInteractionOption(page, 'minion-0')` |
| `confirmInteraction()` | 确认交互 | `confirmInteraction(page)` |
| `skipInteraction()` | 跳过交互 | `skipInteraction(page)` |
| `readGameState()` | 读取游戏状态 | `const state = await readGameState(page)` |
| `takeScreenshot()` | 截图（调试用） | `takeScreenshot(page, 'name', testInfo)` |

## 🚀 快速开始

### 1. 导入工具

```typescript
import { test, expect } from './fixtures';
import {
    buildScene,
    playCard,
    waitForInteraction,
    getInteractionOptions,
    selectInteractionOption,
    confirmInteraction,
    readGameState,
    takeScreenshot,
} from './helpers/smashup-state-builder';
```

### 2. 构造场景

```typescript
test('我的测试', async ({ smashupMatch }, testInfo) => {
    const { hostPage } = smashupMatch;

    // 构造场景：手牌中有传送门，牌库顶有 2 个随从 + 3 个行动卡
    await buildScene(hostPage, {
        playerId: 'p1',
        hand: ['wizard_portal'], // 手牌
        deck: [
            // 牌库顶 5 张
            'wizard_archmage',      // 随从 1
            'wizard_chronomage',    // 随从 2
            'action_time_loop',     // 行动卡 1
            'action_disintegrate',  // 行动卡 2
            'action_enchant',       // 行动卡 3
        ],
        currentPlayer: 'p1',
        phase: 'play', // 出牌阶段
        randomQueue: [0.5, 0.5, 0.5], // 控制随机数（可选）
    });

    // 场景构造完成，可以开始测试了！
});
```

### 3. 执行操作

```typescript
// 打出传送门
await playCard(hostPage, 'wizard_portal');

// 等待交互出现
await waitForInteraction(hostPage, 'wizard_portal_pick');

// 获取选项
const options = await getInteractionOptions(hostPage);
console.log('可选项:', options.map(o => o.label));

// 选择第一个随从
await selectInteractionOption(hostPage, 'minion-0');

// 确认选择
await confirmInteraction(hostPage);
```

### 4. 验证结果

```typescript
// 读取最终状态
const finalState = await readGameState(hostPage);

// 验证：选中的随从应该在手牌中
const p1Hand = finalState.core.players['p1'].hand;
const hasSelectedMinion = p1Hand.some((c: any) => 
    c.defId === 'wizard_archmage' || c.defId === 'wizard_chronomage'
);
expect(hasSelectedMinion).toBe(true);
```

## 📝 完整示例

### 示例 1：传送门交互测试

```typescript
test('传送门应该正确显示随从选项', async ({ smashupMatch }, testInfo) => {
    const { hostPage } = smashupMatch;

    // 步骤 1：构造场景
    await buildScene(hostPage, {
        playerId: 'p1',
        hand: ['wizard_portal'],
        deck: [
            'wizard_archmage',
            'wizard_chronomage',
            'action_time_loop',
            'action_disintegrate',
            'action_enchant',
        ],
        currentPlayer: 'p1',
        phase: 'play',
    });

    // 步骤 2：打出传送门
    await playCard(hostPage, 'wizard_portal');

    // 步骤 3：等待交互
    await waitForInteraction(hostPage, 'wizard_portal_pick');

    // 步骤 4：验证选项
    const options = await getInteractionOptions(hostPage);
    expect(options.length).toBeGreaterThanOrEqual(2);

    // 步骤 5：选择随从
    await selectInteractionOption(hostPage, 'minion-0');
    await confirmInteraction(hostPage);

    // 步骤 6：验证结果
    const finalState = await readGameState(hostPage);
    const p1Hand = finalState.core.players['p1'].hand;
    expect(p1Hand.length).toBeGreaterThan(0);
});
```

### 示例 2：测试边界情况

```typescript
test('牌库为空时应该显示反馈', async ({ smashupMatch }, testInfo) => {
    const { hostPage } = smashupMatch;

    // 构造场景：牌库为空
    await buildScene(hostPage, {
        playerId: 'p1',
        hand: ['wizard_portal'],
        deck: [], // 空牌库
        currentPlayer: 'p1',
        phase: 'play',
    });

    // 打出传送门
    await playCard(hostPage, 'wizard_portal');

    // 应该显示"牌库为空"反馈
    await hostPage.waitForSelector('text=/牌库.*空/', { timeout: 5000 });
});
```

### 示例 3：测试交互持久性（D45 问题）

```typescript
test('交互不应该一闪而过', async ({ smashupMatch }, testInfo) => {
    const { hostPage } = smashupMatch;

    // 构造场景
    await buildScene(hostPage, {
        playerId: 'p1',
        hand: ['wizard_portal'],
        deck: ['wizard_archmage', 'wizard_chronomage', 'action_time_loop'],
        currentPlayer: 'p1',
        phase: 'play',
    });

    // 打出传送门
    await playCard(hostPage, 'wizard_portal');

    // 等待交互出现
    await waitForInteraction(hostPage, 'wizard_portal_pick');

    // 等待 2 秒，确认交互仍然存在
    await hostPage.waitForTimeout(2000);

    // 再次检查交互是否仍然存在
    const stillExists = await hostPage.evaluate(() => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness.state.get();
        const current = state.sys?.interaction?.current;
        return current?.data?.sourceId === 'wizard_portal_pick';
    });

    expect(stillExists).toBe(true);
});
```

## 🎨 高级用法

### 1. 控制随机数

```typescript
await buildScene(hostPage, {
    playerId: 'p1',
    hand: ['wizard_portal'],
    deck: ['wizard_archmage'],
    randomQueue: [0.1, 0.5, 0.9], // 精确控制随机数
});
```

### 2. 构造复杂场景

```typescript
await buildScene(hostPage, {
    playerId: 'p1',
    hand: ['wizard_portal', 'wizard_familiar'], // 多张手牌
    deck: [
        // 牌库顶 10 张
        'wizard_archmage',
        'wizard_chronomage',
        'wizard_enchantress',
        'wizard_apprentice',
        'wizard_familiar',
        'action_time_loop',
        'action_disintegrate',
        'action_enchant',
        'action_polymorph',
        'action_arcane_burst',
    ],
    discard: ['wizard_elder', 'action_fireball'], // 弃牌堆
    currentPlayer: 'p1',
    phase: 'play',
});
```

### 3. 调试技巧

```typescript
// 截图保存（用于调试）
await takeScreenshot(hostPage, '01-initial-state', testInfo);

// 读取状态并打印
const state = await readGameState(hostPage);
console.log('当前状态:', JSON.stringify(state, null, 2));

// 检查交互选项
const options = await getInteractionOptions(hostPage);
console.log('可选项:', options.map(o => ({ id: o.id, label: o.label })));
```

## 🔧 扩展到其他游戏

这个方案可以轻松扩展到其他游戏（DiceThrone、SummonerWars 等）：

### 1. 创建游戏特定的状态构造器

```typescript
// e2e/helpers/dicethrone-state-builder.ts
export async function buildDTScene(page: Page, options: DTSceneOptions) {
    // 类似 buildScene，但适配 DiceThrone 的状态结构
}
```

### 2. 提供游戏特定的工具函数

```typescript
// DiceThrone 特定
export async function rollDice(page: Page, values: number[]) { ... }
export async function useAbility(page: Page, abilityId: string) { ... }

// SummonerWars 特定
export async function summonUnit(page: Page, unitDefId: string) { ... }
export async function moveUnit(page: Page, unitUid: string, targetX: number, targetY: number) { ... }
```

### 3. 复用通用工具

```typescript
// 这些工具函数是通用的，所有游戏都能用
waitForInteraction()
getInteractionOptions()
selectInteractionOption()
confirmInteraction()
readGameState()
takeScreenshot()
```

## 📊 对比：传统 vs 新方案

| 维度 | 传统 E2E | 新方案（状态注入） |
|------|----------|-------------------|
| **速度** | 慢（需要真实玩游戏） | 快（直接注入状态） |
| **稳定性** | 不稳定（依赖随机性） | 稳定（精确控制） |
| **可维护性** | 差（前置步骤多） | 好（专注测试目标） |
| **可复现性** | 难（随机性） | 易（确定性） |
| **调试难度** | 高（链路长） | 低（直接定位） |

## ✅ 最佳实践

### 1. 场景构造原则

- ✅ 只构造测试需要的最小状态
- ✅ 使用有意义的 defId（如 `wizard_portal` 而非 `card_001`）
- ✅ 添加注释说明场景含义
- ❌ 不要构造过于复杂的场景

### 2. 测试组织原则

- ✅ 一个测试只验证一个功能点
- ✅ 使用描述性的测试名称
- ✅ 添加截图辅助调试
- ❌ 不要在一个测试中验证多个不相关的功能

### 3. 断言原则

- ✅ 验证最终状态（而非中间状态）
- ✅ 使用明确的断言（`toBe`、`toEqual`）
- ✅ 添加有意义的错误消息
- ❌ 不要依赖 UI 文本（使用状态验证）

### 4. 调试原则

- ✅ 使用 `takeScreenshot()` 保存关键步骤
- ✅ 使用 `console.log()` 输出中间状态
- ✅ 使用 `page.pause()` 暂停测试（调试时）
- ❌ 不要在生产测试中保留调试代码

## 🚨 常见陷阱

### 1. 忘记等待测试工具就绪

```typescript
// ❌ 错误
await page.evaluate(() => {
    window.__BG_TEST_HARNESS__!.state.patch({ ... });
});

// ✅ 正确
await waitForTestHarness(page);
await page.evaluate(() => {
    window.__BG_TEST_HARNESS__!.state.patch({ ... });
});
```

### 2. 状态注入后没有等待

```typescript
// ❌ 错误
await buildScene(hostPage, { ... });
await playCard(hostPage, 'wizard_portal'); // 可能使用旧状态

// ✅ 正确
await buildScene(hostPage, { ... });
// buildScene 内部已经等待 500ms，无需额外等待
await playCard(hostPage, 'wizard_portal');
```

### 3. 使用错误的 defId

```typescript
// ❌ 错误（defId 不存在）
await buildScene(hostPage, {
    hand: ['wizard_portal_card'], // 错误的 defId
});

// ✅ 正确
await buildScene(hostPage, {
    hand: ['wizard_portal'], // 正确的 defId
});
```

### 4. 验证 UI 文本而非状态

```typescript
// ❌ 错误（UI 文本可能变化）
const text = await hostPage.textContent('.card-name');
expect(text).toBe('传送门');

// ✅ 正确（验证状态）
const state = await readGameState(hostPage);
const card = state.core.players['p1'].hand[0];
expect(card.defId).toBe('wizard_portal');
```

## 📚 更多资源

- [TestHarness 快速参考](./testing-tools-quick-reference.md)
- [自动化测试指南](./automated-testing.md)
- [示例测试](../e2e/smashup-wizard-portal.e2e.ts)

---

**提示**：这个方案大大提高了 E2E 测试的稳定性和可维护性。所有未来的 E2E 测试都应该使用这个方案！
