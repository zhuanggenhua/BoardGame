# TDZ 运行时错误排查

TDZ（Temporal Dead Zone）是 `const` / `let` 在声明前被访问导致的运行时错误，常见报错是 `Cannot access '<name>' before initialization`。它是运行时错误，TypeScript 不能覆盖所有场景。

## 基本例子

错误：

```ts
console.log(myVar);
const myVar = 'value';
```

正确：

```ts
const myVar = 'value';
console.log(myVar);
```

## 为什么 TypeScript 可能检查不到

TypeScript 主要做编译时类型检查。以下场景可能只有代码路径真正执行时才报错：

### 条件分支

```ts
if (someCondition) {
  console.log(myVar);
}

const myVar = 'value';
```

### 函数或回调延迟执行

```ts
function readValue() {
  return myVar;
}

const myVar = 'value';
```

如果 `readValue()` 的调用时机绕过了静态分析，就可能在运行时暴露。

## 常见来源

- 调试日志写在变量声明前。
- 条件分支里提前读取后面才声明的变量。
- 回调函数引用了尚未初始化的局部变量。
- React 组件参数少解构了字段，却在函数体里直接使用。
- 类型名、变量名拼错后又被同名局部声明遮蔽。

## 典型场景

### 调试日志提前读取

错误：

```ts
console.log('[Debug]', { myVar, otherVar });
const myVar = 'value';
const otherVar = 'other';
```

正确：

```ts
const myVar = 'value';
const otherVar = 'other';
console.log('[Debug]', { myVar, otherVar });
```

### React 参数未解构

错误：

```tsx
export const MyComponent: React.FC<MyProps> = ({ name }) => {
  const effectiveLocale = locale || 'zh-CN';
  return <span>{name}</span>;
};
```

正确：

```tsx
export const MyComponent: React.FC<MyProps> = ({ name, locale }) => {
  const effectiveLocale = locale || 'zh-CN';
  return <span>{name}</span>;
};
```

### 类型或变量名不一致

错误：

```ts
export const MyComponent: React.FC<MyPropsTypo> = (props) => {
  return null;
};
```

正确：

```ts
interface MyProps {
  name: string;
}

export const MyComponent: React.FC<MyProps> = (props) => {
  return null;
};
```

## 检查顺序

```bash
npm run typecheck
npm run lint
npm run test -- <相关测试文件>
```

如果问题只在浏览器或 E2E 中出现，继续跑到真实入口：

```bash
npm run test:e2e -- e2e/<gameId>/<file>.e2e.ts
```

项目通用测试入口见 [`automated-testing`](../automated-testing.md)。

## 修复原则

- 变量先声明，再使用。
- 调试日志放到所有依赖声明之后。
- 不靠“这个分支应该不会走到”掩盖未初始化访问。
- React 组件参数需要什么就显式解构什么。
- 如果只在 E2E 才复现，先锁具体入口、触发路径和用户可见后果，再改代码。

## 开发防护

建议 IDE / VS Code 使用项目 TypeScript：

```json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

提交或推送前的具体门禁以当前 hooks 和 CI 为准。Git hook 失败时，先看它对应的现实问题：类型检查、lint、测试、构建还是 i18n，不要把所有失败都说成 TDZ。
