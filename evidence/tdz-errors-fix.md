# TDZ 错误修复总结

## 问题描述

重启服务器后，进入游戏房间时出现白屏错误：

1. `ReferenceError: Cannot access 'isBase' before initialization`
2. `ReferenceError: locale is not defined`

## 根本原因

这是典型的 **TDZ (Temporal Dead Zone)** 错误：在 `const`/`let` 声明前使用变量。

### 为什么之前不报错？

1. **条件执行的代码**：debug 日志只在渲染特定卡牌时触发
2. **Vite HMR 缓存**：首次加载时可能缓存了正确的模块顺序
3. **重启服务器后暴露**：Vite 重新加载模块，暴露了声明顺序问题

## 修复内容

### 修复 1：`isBase` TDZ 错误

**文件**：`src/games/smashup/ui/SmashUpCardRenderer.tsx`

**问题**：第 67 行使用了 `isBase`，但第 75 行才声明

```typescript
// ❌ 错误：使用在声明之前
console.log('[Debug]', { isBase, isPodVersion, ... });
const isBase = defId ? !!getBaseDef(defId) : false;
```

**修复**：将声明移到使用之前

```typescript
// ✅ 正确：声明在使用之前
const isBase = defId ? !!getBaseDef(defId) : false;
console.log('[Debug]', { isBase, isPodVersion, ... });
```

### 修复 2：`isPodVersion`、`shouldUseEnglishAtlas`、`isEnglishVariant` TDZ 错误

**文件**：`src/games/smashup/ui/SmashUpCardRenderer.tsx`

**问题**：第 75-77 行的 debug 日志中使用了这些变量，但它们在后面才声明

**修复**：将所有变量声明移到 debug 日志之前

### 修复 3：`locale` 未定义错误

**文件**：`src/games/smashup/ui/SmashUpCardRenderer.tsx`

**问题**：
1. 函数签名使用了不存在的类型 `SmashUpCardRendererProps`
2. 应该使用 `SmashUpRendererArgs`（包含 `locale` 参数）
3. 函数参数中没有解构 `locale`

```typescript
// ❌ 错误：类型不存在 + 参数缺失
export const SmashUpCardRenderer: React.FC<SmashUpCardRendererProps> = ({
  previewRef,
  className,
  style,
}) => {
  const effectiveLocale = locale || i18n.language; // locale is not defined
}
```

**修复**：使用正确的类型并解构 `locale` 参数

```typescript
// ✅ 正确：类型正确 + 参数完整
interface SmashUpRendererArgs {
  previewRef: CardPreviewRef;
  locale?: string;
  className?: string;
  style?: CSSProperties;
}

export const SmashUpCardRenderer: React.FC<SmashUpRendererArgs> = ({
  previewRef,
  locale,
  className,
  style,
}) => {
  const effectiveLocale = locale || i18n.language;
}
```

## 验证结果

### TypeScript 检查
```bash
npm run typecheck
```
✅ 通过（0 errors）

### ESLint 检查
```bash
npx eslint src/games/smashup/ui/SmashUpCardRenderer.tsx
```
✅ 通过（0 errors, 0 warnings）

## 预防措施

为防止类似问题再次发生，已创建以下文档和工具：

### 1. 开发检查清单
- 文档：`docs/development-checklist.md`
- 内容：每次修改代码后必须执行的检查项

### 2. TDZ 错误预防指南
- 文档：`docs/how-to-prevent-tdz-errors.md`
- 内容：TDZ 错误的原因、检查方法、预防措施

### 3. Git Hooks 自动检查
- **pre-commit**：ESLint 自动检查和修复
- **pre-push**：TypeScript + ESLint + 构建 + 测试

### 4. 快速检查命令
```bash
# 快速检查（推荐每次修改后运行）
npm run check:all        # TypeScript + ESLint

# 完整检查（提交前运行）
npm run check:full       # 上面的 + 核心测试
```

## 推荐的开发流程

```bash
# 1. 修改代码后
npm run typecheck && npm run lint

# 2. 提交前
npm run check:all

# 3. Git hooks 会自动执行检查，失败会阻止提交/推送
```

## 生产环境影响

**会影响生产环境！** 这些都是运行时错误，不是编译时错误。

如果生产环境：
1. 渲染了 `innsmouth_the_locals` 卡牌 → 触发 TDZ 错误
2. 渲染了任何卡牌 → 触发 `locale is not defined` 错误

都会导致白屏崩溃。

**建议**：立即部署修复到生产环境。

## 修复时间

- 2026-03-04：发现问题
- 2026-03-04：修复完成
- 验证：TypeScript + ESLint 检查通过

## 相关文件

- `src/games/smashup/ui/SmashUpCardRenderer.tsx` - 修复的文件
- `docs/development-checklist.md` - 开发检查清单
- `docs/how-to-prevent-tdz-errors.md` - TDZ 错误预防指南
- `package.json` - 更新了检查命令和 Git hooks
