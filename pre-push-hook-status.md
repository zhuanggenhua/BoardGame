# Pre-Push Hook 状态分析

## Pre-Push 钩子配置

```json
"pre-push": "npm run build && npm run i18n:check && npm run test:games:core"
```

## test:games:core 配置

使用 `vitest.config.core.ts`，**排除以下测试**：
- ❌ 审计测试（`**/*audit*.test.{ts,tsx}`, `**/*Audit*.test.{ts,tsx}`）
- ❌ 属性测试（`**/*.property.test.{ts,tsx}`）
- ❌ E2E 测试（`**/*.e2e.test.{ts,tsx}`）
- ❌ 调试测试（`**/*debug*.test.{ts,tsx}`）

## 本次修复的测试

✅ **audit-d31-dino-tooth-and-claw.test.ts**
- 状态：所有5个测试通过
- **是否影响 pre-push**：❌ 否（被排除，因为文件名包含 `audit`）

## 当前 Pre-Push 测试结果

运行 `npm run test:games:core` 的结果：

```
Test Files: 6 failed | 230 passed | 3 skipped (239)
Tests: 10 failed | 3048 passed | 7 skipped (3065)
```

### 失败的测试文件（非本次修复引入）

1. **ongoingModifiers.test.ts** (1个测试失败)
   - steampunk_aggromotive 两张叠加给第一个随从 +10

2. **steampunk-aggromotive-bug.test.ts** (3个测试失败)
   - TypeError: createRunner is not a function
   - 这是测试代码的问题，不是游戏逻辑问题

3. **test-alien-scout-afterscore.test.ts** (2个测试失败)
   - alien_scout afterScoring trigger 测试
   - TypeError: Cannot read properties of undefined (reading 'setup')

4. **wizard-academy-scout-afterscore.test.ts** (2个测试失败)
   - Wizard Academy + Scout afterScoring chain 测试

5. **mothership-scout-afterscore-bug.test.ts** (未在输出中显示，但之前测试时失败)

6. **miskatonic-scout-afterscore.test.ts** (未在输出中显示，但之前测试时失败)

## 结论

### ❌ Pre-Push 钩子当前会失败

**原因**：有6个测试文件（10个测试用例）失败，这些失败都是**之前就存在的问题**，不是本次修复引入的。

### ✅ 本次修复没有引入新的失败

- 我们修复的 `audit-d31-dino-tooth-and-claw.test.ts` 所有测试通过
- 该测试文件被 pre-push 钩子排除，不影响 push
- 我们修复的 `ninja_assassination` 和 `ninja_assassination_pod` 没有引入新的测试失败

### 现存问题

pre-push 钩子失败的根本原因是：
1. **steampunk_aggromotive** 相关测试失败（2个文件，4个测试）
2. **afterScoring 链测试**失败（4个文件，6个测试）

这些问题在本次修复之前就已存在，需要单独修复。

## 建议

### 选项1：修复现存的失败测试（推荐）
修复 steampunk_aggromotive 和 afterScoring 链的问题，使 pre-push 钩子通过。

### 选项2：使用 --no-verify 跳过钩子（不推荐）
```bash
git push --no-verify
```
**注意**：根据 AGENTS.md 规范，这只应在"不涉及业务逻辑变更"时使用。本次修复涉及业务逻辑（ninja_assassination 触发器），理论上不应使用 --no-verify。

### 选项3：临时修改 pre-push 钩子（不推荐）
暂时移除 `test:games:core` 检查，但这会降低代码质量保障。

## 最终建议

**优先修复 steampunk_aggromotive 和 afterScoring 链的问题**，然后再 push。这样可以确保代码库的整体质量。
