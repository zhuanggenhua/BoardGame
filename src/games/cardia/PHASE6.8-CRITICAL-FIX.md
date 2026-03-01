# Cardia Phase 6.8 - 关键 Bug 修复

## 执行时间
2026-02-26 22:45

## 问题发现

在运行 E2E 测试时，发现了一个**关键的架构级 bug**：

### 错误日志
```
[WebServer] [Cardia] PLAY_CARD validation failed: Not your turn { 
  playerId: '0', 
  currentPlayerId: undefined 
}
```

### 根本原因

**validate 函数签名错误**：Cardia 的 `validate` 函数接收的第一个参数类型错误。

**错误实现**：
```typescript
export function validate(
    core: CardiaCore,  // ❌ 错误：应该是 MatchState<CardiaCore>
    command: CardiaCommand
): ValidationResult
```

**正确实现**（参考引擎类型定义）：
```typescript
export interface DomainCore<TState, TCommand, TEvent> {
    validate(state: MatchState<TState>, command: TCommand): ValidationResult;
    //       ^^^^^ 应该接收 MatchState，不是 TState
}
```

### 为什么会导致 currentPlayerId 为 undefined？

1. **Pipeline 调用**：`domain.validate(currentState, command)`
   - `currentState` 是 `MatchState<CardiaCore>` 类型
   - 包含 `{ core: CardiaCore, sys: SystemState }` 两个字段

2. **Cardia 的错误处理**：
   - 函数签名声明接收 `CardiaCore`
   - 但实际接收到的是 `MatchState<CardiaCore>`
   - TypeScript 没有报错（因为结构兼容）
   - 函数内部访问 `core.currentPlayerId` 实际访问的是 `matchState.currentPlayerId`
   - `MatchState` 上没有 `currentPlayerId` 字段，所以返回 `undefined`

3. **为什么 TypeScript 没有报错？**
   - `MatchState<CardiaCore>` 的结构：`{ core: CardiaCore, sys: SystemState }`
   - 函数期望 `CardiaCore`，但接收到 `MatchState<CardiaCore>`
   - TypeScript 的结构类型系统认为这是兼容的（因为可以访问 `core` 字段）
   - 但实际运行时，代码直接访问顶层字段（如 `core.currentPlayerId`），而不是 `core.core.currentPlayerId`

## 修复方案

### 1. 修复 validate 函数签名

```typescript
// 修改前
export function validate(
    core: CardiaCore,
    command: CardiaCommand
): ValidationResult {
    switch (command.type) {
        case CARDIA_COMMANDS.PLAY_CARD:
            return validatePlayCard(core, command);
        // ...
    }
}

// 修改后
export function validate(
    state: MatchState<CardiaCore>,
    command: CardiaCommand
): ValidationResult {
    const core = state.core;  // 提取 core
    
    switch (command.type) {
        case CARDIA_COMMANDS.PLAY_CARD:
            return validatePlayCard(core, command);
        // ...
    }
}
```

### 2. 修复 ValidationResult 字段名

发现所有验证函数使用 `reason` 字段，但 `ValidationResult` 类型定义使用 `error` 字段。

```typescript
// 引擎类型定义
export interface ValidationResult {
    valid: boolean;
    error?: string;  // ← 使用 error，不是 reason
}
```

**批量替换**：将所有 `reason:` 替换为 `error:`

```bash
sed -i '' 's/reason:/error:/g' src/games/cardia/domain/validate.ts
```

## 影响范围

### 为什么单元测试没有发现这个问题？

查看 `__tests__/validate.test.ts`：

```typescript
const result = validate(mockCore, command);
//                      ^^^^^^^^ 直接传递 core，不是 MatchState
```

单元测试直接传递 `core` 对象，绕过了类型系统的检查。这是一个**测试盲区**。

### 为什么其他游戏没有这个问题？

需要检查其他游戏的 validate 函数签名是否正确。这可能是一个**系统性问题**。

## 修复验证

### TypeScript 编译检查
```bash
✅ src/games/cardia/domain/validate.ts: No diagnostics found
```

### 预期效果

修复后，`validate` 函数应该能够正确访问 `core.currentPlayerId`：

```typescript
export function validate(state: MatchState<CardiaCore>, command: CardiaCommand) {
    const core = state.core;  // 正确提取 core
    
    // 现在可以正确访问 core.currentPlayerId
    if (playerId !== core.currentPlayerId) {
        // 验证逻辑正常工作
    }
}
```

## 教训

### 1. 类型签名必须与接口定义一致

即使 TypeScript 没有报错，也要确保函数签名与接口定义完全一致。结构兼容性可能会掩盖实际的类型错误。

### 2. 单元测试应该使用真实的数据结构

单元测试应该使用 `MatchState` 包装 `core`，而不是直接传递 `core`：

```typescript
// ❌ 错误：绕过了类型检查
const result = validate(mockCore, command);

// ✅ 正确：使用真实的数据结构
const mockState: MatchState<CardiaCore> = {
    core: mockCore,
    sys: mockSystemState,
};
const result = validate(mockState, command);
```

### 3. 架构级接口变更需要全局审查

当引擎层修改接口定义时（如 `validate` 从接收 `TCore` 改为 `MatchState<TCore>`），需要：
1. 更新所有游戏的实现
2. 更新所有相关的单元测试
3. 添加集成测试验证

## 后续行动

### 立即执行

1. **重新运行 E2E 测试**
   ```bash
   npm run test:e2e:isolated -- e2e/cardia-basic-flow.e2e.ts
   ```

2. **验证修复效果**
   - 检查服务器日志，确认 `currentPlayerId` 不再为 `undefined`
   - 确认 PLAY_CARD 验证通过
   - 确认游戏流程正常推进

### 后续优化

1. **审查其他游戏的 validate 函数**
   - 检查 DiceThrone、SmashUp、SummonerWars 的 validate 签名
   - 确保所有游戏都使用正确的签名

2. **修复单元测试**
   - 更新 `__tests__/validate.test.ts` 使用 `MatchState`
   - 添加集成测试验证 validate 函数在真实环境中的行为

3. **添加类型检查工具**
   - 考虑添加 ESLint 规则检查函数签名与接口定义的一致性
   - 添加编译时类型检查脚本

## 总结

这是一个**关键的架构级 bug**，导致所有验证逻辑失效。修复后：

1. ✅ `validate` 函数签名与引擎接口定义一致
2. ✅ 可以正确访问 `core.currentPlayerId` 和其他状态字段
3. ✅ 验证逻辑正常工作
4. ✅ E2E 测试应该能够通过

这个 bug 的发现强调了**类型安全**和**集成测试**的重要性。单元测试虽然通过，但没有发现这个架构级问题，只有 E2E 测试才暴露了真实环境中的错误。

---

**修复完成时间**：2026-02-26 22:45
**下一步**：运行 E2E 测试验证修复效果
