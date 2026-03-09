# 忍者渗透 E2E 测试修复

## 问题描述

测试文件 `e2e/framework-pilot-ninja-infiltrate.e2e.ts` 中的三个测试全部失败：

1. **测试 1**："应该能选择并消灭基地上的战术卡（完整流程）" - 等待交互超时（60秒）
2. **测试 2**："应该能跳过渗透交互（没有战术卡时）" - `ninja_infiltrate` 没有出现在基地上
3. **测试 3**："应该能选择多个战术卡中的一个" - 等待交互超时（60秒）

## 根本原因

测试使用了**旧的测试模式**：

```typescript
await page.goto('/play/smashup/test?p0=ninjas,aliens&p1=zombies,pirates&seed=12345');
```

这种模式会自动完成派系选择，但**不会启用新的 TestHarness 状态注入功能**。导致：

- `setupScene` 注入的状态没有生效
- 打出渗透卡后，没有创建交互（因为基地上没有战术卡）
- 渗透卡没有正确附着到基地

## 修复方案

将所有测试改为使用**新的框架模式**：

```typescript
await page.goto('/play/smashup');  // 不带 /test 和查询参数
```

新框架模式会：

1. 自动启用 TestHarness
2. 通过 `setupScene` 注入状态（包括手牌、基地、ongoing actions 等）
3. 跳过派系选择，直接进入游戏

## 修改内容

修改了三个测试用例的导航代码：

1. **测试 1**：`await page.goto('/play/smashup/test?...')` → `await page.goto('/play/smashup')`
2. **测试 2**：`await page.goto('/play/smashup/test?...')` → `await page.goto('/play/smashup')`
3. **测试 3**：`await page.goto('/play/smashup/test?...')` → `await page.goto('/play/smashup')`

## 预期结果

修复后，测试应该能够：

1. 正确注入测试场景（手牌中有渗透卡，基地上有战术卡）
2. 打出渗透卡后，正确创建交互（选择要消灭的战术卡）
3. 选择战术卡后，正确消灭目标战术卡
4. 渗透卡正确附着到基地上

## 教训

- **E2E 测试必须使用新框架模式**：`/play/<gameId>` 而不是 `/play/<gameId>/test`
- **状态注入依赖 TestHarness**：只有新框架模式才会启用 TestHarness
- **旧测试模式已废弃**：不应该再使用 `/test` 路由和查询参数

## 相关文件

- `e2e/framework-pilot-ninja-infiltrate.e2e.ts` - 修复的测试文件
- `e2e/framework/GameTestContext.ts` - setupScene 实现
- `docs/automated-testing.md` - E2E 测试框架文档
