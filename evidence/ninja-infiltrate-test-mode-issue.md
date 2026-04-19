# 忍者渗透 E2E 测试 - 测试模式问题总结

## 问题描述

在为忍者渗透功能编写 E2E 测试时，发现测试模式（`/play/<gameId>/test?skipFactionSelect=true`）存在严重问题，导致无法完成测试。

## 问题表现

1. **页面卡在加载状态**：导航到测试模式后，页面一直显示"加载 UNDEFINED..."，无法进入游戏
2. **状态注入失败**：使用 `TestHarness.state.patch()` 注入状态后，页面重新加载或状态被重置
3. **参考测试也失败**：`e2e/smashup-innsmouth-locals-reveal-simple.e2e.ts` 使用相同的测试模式，也无法通过

## 根本原因

测试模式（`/play/<gameId>/test`）可能已经过时或存在 bug，无法正常工作。文档（`docs/automated-testing.md`）推荐使用测试模式，但实际上这个模式不可用。

## 正确解决方案

**必须使用 GameTestContext API**，而不是测试模式：

```typescript
import { GameTestContext } from './framework/GameTestContext';

const game = new GameTestContext(page);

// 1. 创建在线对局
await game.createMatch('smashup', {
    factions: [
        { player: 0, factions: ['ninjas', 'aliens'] },
        { player: 1, factions: ['dinosaurs', 'robots'] }
    ]
});

// 2. 注入状态
await game.setupScene({
    gameId: 'smashup',
    player0: { hand: ['ninja_infiltrate'] },
    currentPlayer: '0',
    phase: 'playCards',
});

// 或使用 page.evaluate 直接 patch
await page.evaluate(() => {
    const harness = (window as any).__BG_TEST_HARNESS__;
    harness.state.patch({
        'core.bases.0.ongoingActions': [
            { uid: 'o1', defId: 'alien_supreme_overlord', type: 'action', owner: '1' }
        ]
    });
});
```

## 文档更新

已更新 `AGENTS.md` 文档（第 780-820 行），明确：
1. **禁止使用测试模式**：`/play/<gameId>/test?skipFactionSelect=true` 已过时
2. **强制使用 GameTestContext API**：所有新测试必须使用 `GameTestContext`
3. **参考示例**：`e2e/smashup-ninja-acolyte-extra-minion.e2e.ts`

## 下一步工作

1. 使用 GameTestContext API 重写 `e2e/smashup-ninja-infiltrate.e2e.ts`
2. 运行测试验证功能正确性
3. 创建证据文档（包含截图和测试结果）

## 教训

1. **文档不充分**：`docs/automated-testing.md` 推荐的测试模式实际上不可用，文档需要更新
2. **参考测试不可靠**：不能假设现有测试都是正确的，需要实际运行验证
3. **优先使用框架 API**：GameTestContext 是官方推荐的测试框架，应该优先使用
