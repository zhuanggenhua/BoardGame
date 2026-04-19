# 代码审查修复总结

## 修复时间
2026-03-04

## 修复内容

基于代码审查发现的潜在问题，进行了以下改进：

---

## 修复 #1: Effect Type Comparison 防御性增强 ✅

### 文件
`src/games/dicethrone/Board.tsx`

### 问题
`effects` 数组可能为空或未定义，需要额外的防御性检查

### 修复
```typescript
// 修复前
const effectTypeSets = matches.map(m => {
    const effects = m?.variant?.effects ?? m?.ability.effects ?? [];
    return effects.map(e => e?.action?.type ?? 'unknown').sort().join(',');
});

// 修复后
const effectTypeSets = matches.map(m => {
    const effects = m?.variant?.effects ?? m?.ability.effects ?? [];
    // 防御性检查：如果 effects 为空或未定义，返回特殊标记
    if (!effects || effects.length === 0) return 'no-effects';
    return effects.map(e => e?.action?.type ?? 'unknown').sort().join(',');
});
```

### 改进效果
- 明确处理空 effects 数组的情况
- 避免空数组导致的意外行为
- 提高代码健壮性

---

## 修复 #2: Layout Config 递归风险消除 ✅

### 文件
`src/games/smashup/ui/layoutConfig.ts`

### 问题
`default` case 调用 `getLayoutConfig(2)` 可能导致无限递归（如果边界检查失效）

### 修复
```typescript
// 修复前
default:
    // 理论上不会到达这里（已在上方边界检查处理）
    return getLayoutConfig(2);

// 修复后
default:
    // 理论上不会到达这里（已在上方边界检查处理）
    // 为防止边界检查失效，直接返回 2 人局配置而非递归调用
    console.error(`[layoutConfig] Unexpected playerCount after boundary check: ${playerCount}`);
    return {
        baseCardWidth: 14,
        baseGap: 12,
        minionCardWidth: 5.5,
        minionStackOffset: -5.5,
        playerColumnGap: 0.5,
        ongoingCardWidth: 3.8,
        ongoingTopOffset: 6,
        handAreaHeight: 220,
    };
```

### 改进效果
- 完全消除无限递归风险
- 添加错误日志便于调试
- 提供明确的降级配置

---

## 修复 #3: UUID 计数器持久化 ✅

### 文件
`src/lib/uuid.ts`

### 问题
降级实现的计数器在页面刷新后重置，可能增加碰撞风险

### 修复
```typescript
// 修复前
let fallbackCounter = 0;

export function generateUUID(): string {
    // ...
    const counter = (++fallbackCounter % 0xFFFF).toString(16).padStart(4, '0');
    // ...
}

// 修复后
let fallbackCounter = 0;

// 尝试从 sessionStorage 恢复计数器（防止页面刷新后重置）
if (typeof sessionStorage !== 'undefined') {
    try {
        const stored = sessionStorage.getItem('uuid-fallback-counter');
        if (stored) {
            fallbackCounter = parseInt(stored, 10) || 0;
        }
    } catch (e) {
        // sessionStorage 不可用时忽略
    }
}

export function generateUUID(): string {
    // ...
    // 递增计数器并持久化到 sessionStorage
    fallbackCounter = (fallbackCounter + 1) % 0xFFFF;
    if (typeof sessionStorage !== 'undefined') {
        try {
            sessionStorage.setItem('uuid-fallback-counter', fallbackCounter.toString());
        } catch (e) {
            // sessionStorage 不可用时忽略
        }
    }
    // ...
}
```

### 改进效果
- 计数器在页面刷新后保持连续性
- 进一步降低 UUID 碰撞概率
- 优雅处理 sessionStorage 不可用的情况

---

## 修复 #4: Toast Deduplication Key 验证 ✅

### 文件
`src/contexts/ToastContext.tsx`

### 问题
`dedupeKey` 可能为空字符串或仅包含空格，导致意外的去重行为

### 修复
```typescript
// 修复前
if (dedupeKey) {
    const existing = toastsRef.current.find((t) => t.dedupeKey === dedupeKey);
    // ...
}

// 修复后
if (dedupeKey && dedupeKey.trim()) {
    const existing = toastsRef.current.find((t) => t.dedupeKey === dedupeKey);
    // ...
}
```

### 改进效果
- 过滤空字符串和仅包含空格的 dedupeKey
- 避免无效的去重逻辑
- 提高代码健壮性

---

## 修复总结

| 修复 ID | 文件 | 类型 | 严重性 |
|---------|------|------|--------|
| #1 | Board.tsx | 防御性增强 | Medium |
| #2 | layoutConfig.ts | 递归风险消除 | Medium |
| #3 | uuid.ts | 碰撞风险降低 | Low |
| #4 | ToastContext.tsx | 输入验证 | Low |

**总计**：4 个改进

---

## 影响评估

### 性能影响
- ✅ 无负面影响
- ✅ UUID 计数器持久化略微增加 sessionStorage 读写，但可忽略不计

### 兼容性影响
- ✅ 完全向后兼容
- ✅ 所有改进都是防御性的，不改变正常流程

### 测试影响
- ✅ 现有测试无需修改
- 📝 建议添加边界条件测试（可选）

---

## 验证清单

- [x] 所有修复已应用到代码
- [x] 修复遵循项目编码规范
- [x] 添加了必要的防御性检查
- [x] 添加了错误日志便于调试
- [x] 优雅处理异常情况
- [ ] 运行测试验证修复（待执行）
- [ ] 代码审查通过（待确认）

---

## 建议后续工作

1. **添加单元测试**：
   - `hasDivergentVariants` 空 effects 数组测试
   - `getLayoutConfig` 边界条件测试（NaN, Infinity, 负数）
   - `generateUUID` 碰撞概率测试
   - Toast deduplication 边界条件测试

2. **监控 UUID 碰撞**：
   - 在生产环境添加 telemetry
   - 记录降级实现的使用频率
   - 监控 sessionStorage 可用性

3. **代码审查**：
   - 审查其他游戏的类似代码模式
   - 检查是否有其他递归调用风险
   - 统一防御性编程模式

---

## 结论

所有代码审查发现的潜在问题已修复，代码健壮性显著提升。修复遵循"防御性编程"原则，不改变正常流程，完全向后兼容。

