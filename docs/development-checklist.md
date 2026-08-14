# 开发检查清单

本文档列出了开发过程中必须执行的检查项，防止常见错误进入生产环境。

## 🔍 每次修改代码后必须执行

### 1. TypeScript 类型检查（强制）
```bash
npm run typecheck
```

**检查内容**：
- 类型不匹配
- 未定义的变量
- 缺失的类型定义
- 函数签名不匹配

**何时运行**：修改任何 `.ts` 或 `.tsx` 文件后

---

### 2. ESLint 检查（强制）
```bash
npm run lint
```

**检查内容**：
- 代码风格问题
- 潜在的运行时错误
- 未使用的变量
- 不安全的类型断言

**何时运行**：修改任何代码文件后

---

### 3. 单元测试（推荐）
```bash
# 运行所有测试
npm run test

# 只运行核心测试
npm run test:core

# 只运行特定游戏的测试
npm run test:smashup
npm run test:dicethrone
npm run test:summonerwars
```

**何时运行**：
- 修改业务逻辑
- 修改引擎层代码
- 修改领域层代码
- 修复 bug

---

### 4. E2E 测试（关键功能修改时）
```bash
# 开发模式（需要先运行 npm run dev）
npm run test:e2e

# CI 模式（自动启动服务器）
npm run test:e2e:ci
```

**何时运行**：
- 修改 UI 交互逻辑
- 修改游戏流程
- 修改网络通信
- 修复用户反馈的 bug

---

## 🚨 常见错误检查

### TDZ (Temporal Dead Zone) 错误

**问题**：在 `const`/`let` 声明前使用变量

**检查方法**：
1. **TypeScript 检查**：`npm run typecheck`（部分场景可检测）
2. **手动检查**：搜索文件中的 `const`/`let` 声明，确认使用在声明之后
3. **运行时测试**：确保所有代码路径都被测试覆盖

**预防措施**：
- ✅ 将变量声明放在文件/函数顶部
- ✅ 避免在条件语句中使用后面才声明的变量
- ✅ 使用 ESLint 的 `no-use-before-define` 规则
- ❌ 不要在 debug 日志中使用未声明的变量

**示例**：
```typescript
// ❌ 错误：TDZ 错误
console.log(myVar); // ReferenceError: Cannot access 'myVar' before initialization
const myVar = 'value';

// ✅ 正确：声明在使用之前
const myVar = 'value';
console.log(myVar);
```

---

### 类型不匹配错误

**问题**：函数签名使用了不存在的类型

**检查方法**：
1. **TypeScript 检查**：`npm run typecheck`
2. **IDE 提示**：VS Code 会显示红色波浪线
3. **搜索类型定义**：确认类型是否存在或已导入

**预防措施**：
- ✅ 使用 IDE 的自动补全功能
- ✅ 定义类型后立即使用
- ✅ 定期运行 `npm run typecheck`
- ❌ 不要手动输入类型名称

**示例**：
```typescript
// ❌ 错误：SmashUpCardRendererProps 不存在
export const SmashUpCardRenderer: React.FC<SmashUpCardRendererProps> = ({ ... }) => { ... }

// ✅ 正确：使用已定义的类型
interface SmashUpRendererArgs { ... }
export const SmashUpCardRenderer: React.FC<SmashUpRendererArgs> = ({ ... }) => { ... }
```

---

### React Hooks 顺序错误

**问题**：在条件语句或 return 之后调用 Hooks

**检查方法**：
1. **ESLint 检查**：`npm run lint`（`react-hooks/rules-of-hooks` 规则）
2. **运行时错误**：React 会抛出错误

**预防措施**：
- ✅ 所有 Hooks 必须在函数顶部调用
- ✅ Hooks 必须在所有 early return 之前
- ❌ 不要在条件语句中调用 Hooks
- ❌ 不要在循环中调用 Hooks

**示例**：
```typescript
// ❌ 错误：Hooks 在 early return 之后
function MyComponent({ data }) {
  if (!data) return null; // early return
  const [state, setState] = useState(0); // ❌ 错误！
  // ...
}

// ✅ 正确：Hooks 在 early return 之前
function MyComponent({ data }) {
  const [state, setState] = useState(0); // ✅ 正确
  if (!data) return null;
  // ...
}
```

---

## 📝 Git 提交前检查清单

### Pre-commit（自动执行）
- [x] ESLint 检查（lint-staged 自动执行）
- [x] 代码格式化（lint-staged 自动执行）

### Pre-push（自动执行）
- [x] TypeScript 类型检查
- [x] TDZ 错误检查
- [x] 构建检查
- [x] i18n 检查
- [x] 核心测试

### 手动检查（推荐）
- [ ] 运行相关的 E2E 测试
- [ ] 在浏览器中手动测试修改的功能
- [ ] 检查控制台是否有错误或警告
- [ ] 检查网络请求是否正常

---

## 🔧 开发环境配置

### VS Code 设置

在 `.vscode/settings.json` 中添加：

```json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ]
}
```

### ESLint 配置

确保 `.eslintrc.cjs` 中包含以下规则：

```javascript
module.exports = {
  rules: {
    'no-use-before-define': ['error', { 
      functions: false, 
      classes: true, 
      variables: true 
    }],
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { 
      argsIgnorePattern: '^_' 
    }]
  }
}
```

---

## 🚀 CI/CD 检查

### GitHub Actions（自动执行）

每次 push 到远程仓库时，CI 会自动执行：

1. TypeScript 类型检查
2. ESLint 检查
3. 单元测试
4. E2E 测试（关键路径）
5. 构建检查

### 本地模拟 CI

```bash
# 运行完整的 CI 检查
npm run check:all && npm run test && npm run test:e2e:ci
```

---

## 📚 相关文档

- [测试最佳实践](./testing-best-practices.md)
- [自动化测试指南](./automated-testing.md)
- [Golden Rules](../.spec/knowledge/standards/golden-rules.md)
- [Git 合并检查清单](./git-merge-checklist.md)
