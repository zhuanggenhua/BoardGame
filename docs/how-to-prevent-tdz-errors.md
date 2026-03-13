# 如何防止 TDZ 错误

## 什么是 TDZ 错误？

TDZ (Temporal Dead Zone) 是指在 `const`/`let` 声明前访问变量导致的运行时错误。

```typescript
// ❌ 错误：TDZ 错误
console.log(myVar); // ReferenceError: Cannot access 'myVar' before initialization
const myVar = 'value';

// ✅ 正确
const myVar = 'value';
console.log(myVar);
```

## 为什么 TypeScript 检测不到？

TypeScript 只能检测**编译时**的类型错误，但 TDZ 是**运行时**错误。以下场景 TypeScript 无法检测：

1. **条件执行的代码**：
```typescript
if (someCondition) {
  console.log(myVar); // 只有 someCondition 为 true 时才报错
}
const myVar = 'value';
```

2. **函数内部的引用**：
```typescript
function foo() {
  return myVar; // 只有调用 foo() 时才报错
}
const myVar = 'value';
```

## 如何在开发时检查？

### 方法 1：运行 TypeScript 检查（推荐）

```bash
npm run typecheck
```

虽然 TypeScript 无法检测所有 TDZ 错误，但能检测到大部分明显的问题。

### 方法 2：运行 ESLint 检查（推荐）

```bash
npm run lint
```

ESLint 的 `no-use-before-define` 规则可以检测部分 TDZ 问题。

### 方法 3：运行测试（最可靠）

```bash
# 运行所有测试
npm run test

# 运行 E2E 测试
npm run test:e2e:ci
```

测试会实际执行代码，能发现所有运行时错误。

### 方法 4：手动检查（补充）

修改代码后，手动检查：
1. 搜索文件中的 `const`/`let` 声明
2. 确认所有使用都在声明之后
3. 特别注意 debug 日志中的变量

## 开发流程建议

### 每次修改代码后

```bash
# 1. TypeScript 检查
npm run typecheck

# 2. ESLint 检查
npm run lint

# 3. 运行相关测试
npm run test:smashup  # 如果修改了 SmashUp 相关代码
```

### 提交代码前

```bash
# 运行完整检查
npm run check:all

# 运行核心测试
npm run test:games:core
```

### Git Hooks（自动执行）

项目已配置 Git hooks，会在以下时机自动检查：

- **pre-commit**：ESLint 检查（自动修复）
- **pre-push**：按改动自动选择 TypeScript / 构建 / i18n / 测试校验

如果检查失败，提交/推送会被阻止。

## 常见 TDZ 场景

### 场景 1：Debug 日志中使用未声明的变量

```typescript
// ❌ 错误
console.log('[Debug]', { myVar, otherVar });
const myVar = 'value';
const otherVar = 'other';

// ✅ 正确：先声明再使用
const myVar = 'value';
const otherVar = 'other';
console.log('[Debug]', { myVar, otherVar });
```

### 场景 2：函数参数类型不匹配

```typescript
// ❌ 错误：locale 参数未解构
export const MyComponent: React.FC<MyProps> = ({ name }) => {
  const effectiveLocale = locale || 'zh-CN'; // locale is not defined
  // ...
}

// ✅ 正确：解构所有需要的参数
export const MyComponent: React.FC<MyProps> = ({ name, locale }) => {
  const effectiveLocale = locale || 'zh-CN';
  // ...
}
```

### 场景 3：类型定义不匹配

```typescript
// ❌ 错误：使用了不存在的类型
export const MyComponent: React.FC<MyPropsTypo> = ({ ... }) => { ... }

// ✅ 正确：使用正确的类型名称
interface MyProps { ... }
export const MyComponent: React.FC<MyProps> = ({ ... }) => { ... }
```

## 预防措施

### 1. 使用 IDE 提示

VS Code 会在以下情况显示警告：
- 使用未声明的变量
- 类型不匹配
- 函数参数缺失

**配置 VS Code**：
```json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

### 2. 遵循代码规范

- ✅ 变量声明放在文件/函数顶部
- ✅ 使用前先声明
- ✅ 避免在条件语句中使用后面才声明的变量
- ✅ Debug 日志放在所有声明之后

### 3. 编写测试

- ✅ 为所有代码路径编写测试
- ✅ 测试条件分支
- ✅ 测试边界情况

### 4. Code Review

- ✅ 检查变量声明顺序
- ✅ 检查函数参数是否完整
- ✅ 检查类型定义是否存在

## 生产环境检查

### 部署前检查

```bash
# 1. 完整检查
npm run check:all

# 2. 运行所有测试
npm run test

# 3. 运行 E2E 测试
npm run test:e2e:ci

# 4. 构建检查
npm run build
```

### CI/CD 配置

GitHub Actions 会在每次 push 时自动执行：
- TypeScript 检查
- ESLint 检查
- 单元测试
- E2E 测试
- 构建检查

如果任何检查失败，部署会被阻止。

## 总结

**最可靠的方法**：
1. 运行 `npm run typecheck`（快速）
2. 运行 `npm run lint`（快速）
3. 运行 `npm run test`（可靠）
4. 运行 `npm run test:e2e:ci`（最可靠）

**开发流程**：
- 修改代码 → `npm run typecheck` → `npm run lint` → 手动测试
- 提交代码 → Git hooks 自动检查
- 推送代码 → CI/CD 自动检查

**预防措施**：
- 使用 IDE 提示
- 遵循代码规范
- 编写测试
- Code Review
