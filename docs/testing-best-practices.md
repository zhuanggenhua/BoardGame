# 测试最佳实践

> 本文档补充 `docs/automated-testing.md`，专注于测试编写的常见陷阱和最佳实践。

## 目录

- [核心原则](#核心原则)
- [状态对象：Core vs MatchState](#状态对象core-vs-matchstate)
- [测试工具选择](#测试工具选择)
- [常见错误模式](#常见错误模式)
- [测试辅助函数](#测试辅助函数)

---

## 核心原则

### 1. 使用正确的测试工具

| 场景 | 推荐工具 | 原因 |
|------|----------|------|
| 游戏逻辑测试 | `GameTestRunner` | 完整模拟引擎管线，自动处理状态初始化 |
| 单个能力测试 | `runCommand` (testRunner.ts) | 简化的命令执行，自动包装 MatchState |
| 基地能力测试 | `triggerBaseAbilityWithMS` (helpers.ts) | 自动注入 matchState |
| 交互处理器测试 | `callHandler` (helpers.ts) | 桥接旧测试到新签名 |
| UI 集成测试 | Playwright E2E | 端到端验证 |

### 2. 永远不要直接调用 domain 层函数

❌ **错误**：
```typescript
const core: SmashUpCore = { players: {...}, bases: [...] };
const events = SmashUpDomain.execute(core, command, random);  // 类型错误！
```

✅ **正确**：
```typescript
const core: SmashUpCore = { players: {...}, bases: [...] };
const matchState = makeMatchState(core);  // 包装为 MatchState
const events = SmashUpDomain.execute(matchState, command, random);
```

✅ **更好**：
```typescript
// 使用 testRunner 的 runCommand，自动处理状态包装
const result = runCommand(matchState, command);
```

---

## 状态对象：Core vs MatchState

### 类型定义

```typescript
// Core：游戏领域状态（玩家、基地、手牌等）
interface SmashUpCore {
    players: Record<PlayerId, PlayerState>;
    bases: BaseInPlay[];
    turnOrder: PlayerId[];
    // ... 游戏特定字段
}

// MatchState：完整对局状态（Core + 系统状态）
interface MatchState<TCore> {
    core: TCore;           // 游戏领域状态
    sys: SystemState;      // 引擎系统状态（interaction、phase、undo 等）
}

// SystemState：引擎层管理的状态
interface SystemState {
    phase: string;
    turnNumber: number;
    interaction: {
        current?: Interaction;
        queue: Interaction[];
    };
    undo: { snapshots: Snapshot[] };
    eventStream: { entries: EventEntry[] };
    actionLog: { entries: ActionEntry[] };
    responseWindow: { current?: ResponseWindow };
    // ... 其他系统状态
}
```

### 为什么需要 MatchState？

1. **引擎系统依赖 sys 字段**：
   - `InteractionSystem` 需要 `sys.interaction` 存储交互队列
   - `FlowSystem` 需要 `sys.phase` 管理阶段流转
   - `UndoSystem` 需要 `sys.undo` 存储快照

2. **能力函数需要创建交互**：
   ```typescript
   // 能力函数内部调用 queueInteraction
   const interaction = createSimpleChoice(...);
   const updatedState = queueInteraction(matchState, interaction);
   // ↑ 需要 matchState.sys.interaction
   ```

3. **防止状态不一致**：
   - 裸 `core` 对象缺少 `sys` 字段
   - 能力函数尝试访问 `state.sys.interaction` → `undefined` → 崩溃

### 何时使用哪种类型？

| 场景 | 使用类型 | 原因 |
|------|----------|------|
| 测试初始化 | `SmashUpCore` | 方便手写测试数据 |
| 传递给 domain 函数 | `MatchState<SmashUpCore>` | domain 函数签名要求 |
| 断言游戏状态 | `SmashUpCore` | 只关心游戏逻辑，不关心系统状态 |
| 检查交互 | `MatchState<SmashUpCore>` | 需要访问 `sys.interaction` |

---

## 测试工具选择

### GameTestRunner（推荐）

**适用场景**：
- 完整游戏流程测试
- 多命令序列测试
- 需要验证状态变化的测试

**优点**：
- ✅ 自动初始化 `MatchState`
- ✅ 自动执行完整管线（validate → execute → reduce → postProcess）
- ✅ 支持命令序列
- ✅ 清晰的错误信息

**示例**：
```typescript
import { GameTestRunner } from '../../../engine/testing';
import { SmashUpDomain } from '../domain';

const runner = new GameTestRunner({
    domain: SmashUpDomain,
    playerIds: ['0', '1'],
    assertFn: assertSmashUp,
});

const testCases = [
    {
        name: '打出随从',
        commands: [
            { type: 'PLAY_MINION', playerId: '0', payload: { cardUid: 'm1', baseIndex: 0 } },
        ],
        expect: { 
            minionsOnBase: [{ baseIndex: 0, count: 1 }],
        },
    },
];

runner.runAll(testCases);
```

### runCommand（简化版）

**适用场景**：
- 单命令测试
- 需要检查事件列表的测试
- 需要访问 `sys` 状态的测试

**优点**：
- ✅ 自动包装 `MatchState`
- ✅ 返回完整结果（success、events、state）
- ✅ 比 GameTestRunner 更灵活

**示例**：
```typescript
import { runCommand } from './testRunner';
import { makeMatchState, makeState } from './helpers';

const core = makeState({ /* ... */ });
const matchState = makeMatchState(core);

const result = runCommand(matchState, {
    type: 'PLAY_MINION',
    playerId: '0',
    payload: { cardUid: 'm1', baseIndex: 0 },
});

expect(result.success).toBe(true);
expect(result.events).toContainEqual(
    expect.objectContaining({ type: 'su:minion_played' })
);
```

### 直接调用 domain 函数（不推荐）

**仅在以下情况使用**：
- 测试 domain 层的纯函数（如 `reduce`、`validate`）
- 不涉及交互系统的简单测试

**必须手动包装 MatchState**：
```typescript
import { SmashUpDomain } from '../domain';
import { makeMatchState, makeState } from './helpers';

const core = makeState({ /* ... */ });
const matchState = makeMatchState(core);  // ⚠️ 必须包装

const events = SmashUpDomain.execute(matchState, command, random);
```

---

## 常见错误模式

### 错误 1：传递裸 Core 给 domain 函数

❌ **错误**：
```typescript
const core: SmashUpCore = { players: {...}, bases: [...] };
const events = SmashUpDomain.execute(core, command, random);
// TypeError: Cannot read properties of undefined (reading 'interaction')
```

**原因**：
- `domain.execute` 期望 `MatchState<SmashUpCore>`
- 传递裸 `core` 导致 `state.sys` 为 `undefined`
- 能力函数尝试访问 `state.sys.interaction` → 崩溃

✅ **修复**：
```typescript
const core: SmashUpCore = { players: {...}, bases: [...] };
const matchState = makeMatchState(core);  // 包装为 MatchState
const events = SmashUpDomain.execute(matchState, command, random);
```

### 错误 2：期望 execute 返回 { success, events }

❌ **错误**：
```typescript
const result = SmashUpDomain.execute(matchState, command, random);
console.log(result.success);  // undefined
console.log(result.events);   // undefined
```

**原因**：
- `domain.execute` 直接返回 `SmashUpEvent[]`
- 不返回包装对象

✅ **修复**：
```typescript
// 方案 1：使用 runCommand（推荐）
const result = runCommand(matchState, command);
console.log(result.success);  // true/false
console.log(result.events);   // SmashUpEvent[]

// 方案 2：直接使用返回值
const events = SmashUpDomain.execute(matchState, command, random);
console.log(events);  // SmashUpEvent[]
```

### 错误 3：不使用 helpers.ts 中的工具函数

❌ **错误**：
```typescript
// 每个测试文件重复定义
function makeMinion(uid: string, defId: string, controller: string, power: number) {
    return { uid, defId, controller, owner: controller, basePower: power, /* ... */ };
}
```

**问题**：
- 16+ 个测试文件重复定义相同函数
- 字段不一致（有的有 `powerModifier`，有的没有）
- 维护困难

✅ **修复**：
```typescript
import { makeMinion, makePlayer, makeState, makeMatchState } from './helpers';

const minion = makeMinion('m1', 'pirate_first_mate', '0', 3);
const player = makePlayer('0', { hand: [card1, card2] });
const core = makeState({ players: { '0': player }, bases: [base1] });
const matchState = makeMatchState(core);
```

### 错误 4：测试中不控制随机数

❌ **错误**：
```typescript
const result = runCommand(matchState, {
    type: 'DRAW_CARDS',
    playerId: '0',
    payload: { count: 5 },
});
// 每次运行抽到的牌不同 → 测试不稳定
```

✅ **修复**：
```typescript
// 方案 1：使用固定随机数
const random: RandomFn = {
    random: () => 0.5,
    d: () => 1,
    range: (min) => min,
    shuffle: (arr) => arr,  // 不洗牌
};

// 方案 2：使用确定性初始状态
const core = makeState({
    players: {
        '0': makePlayer('0', {
            deck: [card1, card2, card3],  // 预设牌库顺序
        }),
    },
});
```

---

## 测试辅助函数

### helpers.ts 提供的工具

位置：`src/games/smashup/__tests__/helpers.ts`

#### 状态工厂

```typescript
// 创建最小可用的 SmashUpCore（双人）
const core = makeState({
    players: { '0': player1, '1': player2 },
    bases: [base1, base2],
});

// 创建带基地列表的 SmashUpCore
const core = makeStateWithBases([base1, base2, base3]);

// 创建带疯狂牌库的 SmashUpCore
const core = makeStateWithMadness({ madnessDeck: [...] });

// 包装为 MatchState（用于 validate/execute 测试）
const matchState = makeMatchState(core);
```

#### 实体工厂

```typescript
// 创建随从（常用签名）
const minion = makeMinion('m1', 'pirate_first_mate', '0', 3);

// 创建随从（带额外字段）
const minion = makeMinion('m1', 'pirate_first_mate', '0', 3, {
    powerModifier: 2,
    talentUsed: true,
});

// 创建玩家
const player = makePlayer('0', {
    hand: [card1, card2],
    vp: 5,
});

// 创建玩家（带自定义派系）
const player = makePlayerWithFactions('0', ['pirates', 'aliens'], {
    hand: [card1],
});

// 创建卡牌实例（4 参数：uid, defId, type, owner）
const card = makeCard('c1', 'pirate_first_mate', 'minion', '0');

// 创建卡牌实例（3 参数：uid, defId, owner，默认 type='minion'）
const card = makeCard('c1', 'pirate_first_mate', '0');

// 创建基地
const base = makeBase('test_base', [minion1, minion2]);
```

#### 事件应用

```typescript
// 应用事件列表到状态（通过 reduce）
const newCore = applyEvents(core, events);
```

#### 测试桥接工具

```typescript
// 旧式 InteractionHandler 调用桥接
const events = callHandler(handler, {
    state: core,
    playerId: '0',
    selectedValue: { baseIndex: 0 },
    data: { continuationContext: {...} },
    random,
    now: Date.now(),
});

// 基地能力测试桥接（自动注入 matchState）
const result = triggerBaseAbilityWithMS('base_tortuga', 'afterScoring', {
    state: core,
    baseIndex: 0,
    playerId: '0',
    rankings: [...],
    now: Date.now(),
});

// 获取 BaseAbilityResult 中的所有 interaction
const interactions = getInteractionsFromResult(result);

// 从 MatchState 中获取所有 interaction
const interactions = getInteractionsFromMS(matchState);
```

---

## 测试编写检查清单

### 开始编写测试前

- [ ] 确定测试类型（单元测试 / 集成测试 / E2E 测试）
- [ ] 选择合适的测试工具（GameTestRunner / runCommand / E2E）
- [ ] 检查 `helpers.ts` 是否有可复用的工具函数

### 编写测试时

- [ ] 使用 `makeMatchState(core)` 包装状态（如果直接调用 domain 函数）
- [ ] 使用 `helpers.ts` 中的工厂函数（不重复定义）
- [ ] 控制随机数（使用固定值或确定性初始状态）
- [ ] 断言具体字段（不只检查 `success: true`）
- [ ] 检查交互是否创建（如果能力应该创建交互）

### 测试失败时

- [ ] 检查是否传递了裸 `core` 而非 `MatchState`
- [ ] 检查是否期望错误的返回值类型
- [ ] 检查是否使用了真随机导致不稳定
- [ ] 检查是否缺少必需的系统状态初始化
- [ ] 使用 `console.log` 输出中间状态辅助调试

---

## 迁移指南：修复旧测试

### 步骤 1：识别问题模式

搜索以下模式：
```bash
# 直接调用 domain.execute
grep -r "SmashUpDomain.execute" src/games/smashup/__tests__/

# 期望 result.success
grep -r "result.success" src/games/smashup/__tests__/

# 重复定义工厂函数
grep -r "function makeMinion" src/games/smashup/__tests__/
```

### 步骤 2：修复类型错误

```typescript
// 修复前
const core: SmashUpCore = { /* ... */ };
const events = SmashUpDomain.execute(core, command, random);

// 修复后
const core: SmashUpCore = { /* ... */ };
const matchState = makeMatchState(core);
const events = SmashUpDomain.execute(matchState, command, random);
```

### 步骤 3：使用 runCommand

```typescript
// 修复前
const events = SmashUpDomain.execute(matchState, command, random);
expect(events.length).toBeGreaterThan(0);

// 修复后
const result = runCommand(matchState, command);
expect(result.success).toBe(true);
expect(result.events.length).toBeGreaterThan(0);
```

### 步骤 4：使用 helpers.ts

```typescript
// 修复前
function makeMinion(uid: string, defId: string, controller: string, power: number) {
    return { uid, defId, controller, owner: controller, basePower: power, /* ... */ };
}

// 修复后
import { makeMinion } from './helpers';
```

---

## 总结

### 核心规则

1. **永远使用 MatchState**：传递给 domain 函数时必须包装
2. **优先使用 GameTestRunner**：完整管线测试
3. **复用 helpers.ts**：不重复定义工厂函数
4. **控制随机数**：确保测试可重复
5. **断言具体字段**：不只检查 `success: true`

### 快速参考

| 需求 | 使用工具 |
|------|----------|
| 完整流程测试 | `GameTestRunner` |
| 单命令测试 | `runCommand` |
| 创建测试状态 | `makeState` + `makeMatchState` |
| 创建测试实体 | `makeMinion` / `makePlayer` / `makeCard` |
| 检查交互 | `getInteractionsFromMS` |
| 基地能力测试 | `triggerBaseAbilityWithMS` |

### 相关文档

- `docs/automated-testing.md` - 测试框架总览
- `docs/ai-rules/engine-systems.md` - 引擎测试工具
- `src/games/smashup/__tests__/helpers.ts` - 测试辅助函数源码
- `src/games/smashup/__tests__/testRunner.ts` - runCommand 实现


---

## 测试性能和超时

### 测试套件运行时间

项目包含大量测试，不同测试套件的运行时间差异很大：

| 测试套件 | 命令 | 预计时间 | 说明 |
|---------|------|---------|------|
| 单个测试文件 | `npm run test -- <file>.test.ts` | 10-60秒 | 最快，推荐开发时使用 |
| SmashUp 核心测试 | `npm run test:smashup` | 2-3分钟 | 包含大量单元测试 |
| 所有游戏核心测试 | `npm run test:games:core` | 3-5分钟 | 排除 property/audit/E2E 测试 |
| 所有游戏测试 | `npm run test:games` | 5-10分钟 | 包含所有测试类型 |
| 完整测试套件 | `npm run test` | 10-15分钟 | 包含所有测试 |

### Property-Based 测试

项目使用 `fast-check` 进行 property-based 测试，这些测试会运行多次（通常 100-200 次）：

```typescript
// 示例：运行 200 次
fc.assert(
  fc.property(arbBaseStrength(), (baseStrength) => {
    // 测试逻辑
  }),
  { numRuns: 200 }
);
```

**位置**：
- `src/games/summonerwars/__tests__/*.property.test.ts`
- `src/games/summonerwars/__tests__/deck-*.property.test.ts`

**影响**：这些测试会显著增加测试时间，但提供了更全面的覆盖。

### 超时配置

测试超时在 `vitest.config.core.ts` 中配置：

```typescript
test: {
  testTimeout: 180000,  // 3分钟
}
```

**注意**：某些 IDE 或 CI 工具可能有自己的超时限制（如 90 秒），需要单独配置。

### 开发时的最佳实践

1. **只运行相关测试**：
   ```bash
   # 只运行你修改的文件的测试
   npm run test -- myFeature.test.ts
   
   # 只运行特定游戏的测试
   npm run test:smashup
   ```

2. **使用 watch 模式**（开发时）：
   ```bash
   npm run test:watch
   ```

3. **跳过慢速测试**（临时）：
   ```typescript
   // 使用 .skip 跳过慢速测试
   it.skip('slow property test', () => { ... });
   ```

4. **CI/CD 中运行完整测试**：
   ```bash
   # pre-push hook 会自动运行核心测试
   npm run test:games:core
   ```

### 性能优化建议

如果测试运行太慢：

1. **检查是否有无限循环**：
   - 使用 `console.log` 或调试器定位问题
   - 检查 `while` 循环的退出条件

2. **减少 property-based 测试的运行次数**（开发时）：
   ```typescript
   // 临时减少运行次数
   { numRuns: 10 }  // 而不是 200
   ```

3. **使用测试分片**（CI 中）：
   ```bash
   # 将测试分成多个并行任务
   npm run test:smashup &
   npm run test:summonerwars &
   npm run test:dicethrone &
   ```

4. **排除不必要的测试**：
   - `vitest.config.core.ts` 已排除 audit/property/E2E 测试
   - 开发时使用 `test:games:core` 而不是 `test:games`

---


---

## E2E 测试框架最佳实践

> **完整规范见 AGENTS.md**。本节仅列出关键要点和代码示例。

### 核心要求（强制）

1. **使用 GameTestContext API**：禁止直接操作 `window.__BG_TEST_HARNESS__`
2. **轮询间隔优化**：`waitForFunction` 必须使用 `{ polling: 200 }`
3. **同步等待优先**：UI 操作后先 `waitForTimeout(300)`，再按需异步等待
4. **服务器就绪检查**：Playwright 配置使用 `/__ready` 端点
5. **文件编码检查**：测试命令前运行 `check-file-encoding.mjs`

### 代码示例

```typescript
import { test, expect } from './fixtures';
import { GameTestContext } from './framework/GameTestContext';

test('wizard portal', async ({ page }) => {
  const game = new GameTestContext(page);
  
  await game.setupScene({
    gameId: 'smashup',
    player0: { hand: ['wizard_portal'], discard: ['alien_invader'] },
    currentPlayer: '0',
    phase: 'playCards'
  });
  
  await game.playCard('wizard_portal');
  await game.waitForInteraction('wizard_portal_pick');
  await game.selectOption('minion-0');
  await game.confirm();
  await game.expectCardInHand('alien_invader');
});
```

### 性能基准

- 单个测试：< 15 秒
- 服务器启动：< 20 秒
- 总耗时：< 35 秒

### 相关文档

- `docs/automated-testing.md` - 测试框架总览
- `e2e/framework/GameTestContext.ts` - API 源码
- `AGENTS.md` - 完整 E2E 测试规范
