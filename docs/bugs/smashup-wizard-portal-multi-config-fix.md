# 大杀四方传送门交互修复：multi 配置丢失问题

## 问题描述

用户报告传送门交互显示"暂无可选项"，UI 一闪而过，无法正常选择随从。

## 根本原因

commit `8456a70` (2026-02-18) 修改了 `createSimpleChoice` 函数签名：
- 第 5 个参数可以是 `string`（sourceId）或 `SimpleChoiceConfig` 对象
- 当传递 config 对象时，第 6 和第 7 个参数（`timeout` 和 `multi`）会被忽略

`wizard_portal_pick` 交互创建时使用了错误的参数传递方式：

```typescript
// ❌ 错误（旧代码）
const interaction = createSimpleChoice(
    `wizard_portal_pick_${ctx.now}`, ctx.playerId,
    '传送：选择要放入手牌的随从（可以不选）', options,
    { sourceId: 'wizard_portal_pick', targetType: 'hand' },  // config 对象
    undefined, { min: 0, max: minions.length },  // ❌ multi 作为第 7 个参数，被忽略
);
```

导致：
1. `multi` 配置丢失，交互变成单选而非多选
2. `Board.tsx` 的 `isHandDiscardPrompt` 检查 `currentPrompt.multi` 时返回 `undefined`
3. 多选交互被误判为单选，走了错误的 UI 渲染路径（手牌直选）
4. 手牌直选逻辑检查选项是否对应手牌，但传送门的选项对应牌库顶的卡牌
5. 所有选项被过滤掉，显示"暂无可选项"

## 调用链分析

**层级 1: Board.tsx → InteractionSystem**
- [✅] 存在性：InteractionSystem 已定义，已被 Board.tsx import
- [✅] 契约：Board.tsx 读取 `currentInteraction?.data.targetType`
- [✅] 返回值：`targetType` 正确传递（值为 `'hand'`）

**层级 2: wizards.ts → createSimpleChoice**
- [✅] 存在性：createSimpleChoice 已定义在 InteractionSystem.ts
- [❌] 契约：传递了 config 对象作为第 5 个参数，但 `multi` 作为第 7 个参数传递
- [❌] 返回值：`multi` 参数被忽略，导致交互变成单选

**层级 3: createSimpleChoice 内部**
- [✅] 存在性：函数正确处理 config 对象
- [❌] 契约：当第 5 个参数是 config 对象时，第 6 和第 7 个参数被忽略
- [✅] 返回值：`targetType` 正确传递到 `data` 中，但 `multi` 丢失

## 修复方案

将 `multi` 配置移到 config 对象内部：

```typescript
// ✅ 正确（新代码）
const interaction = createSimpleChoice(
    `wizard_portal_pick_${ctx.now}`, ctx.playerId,
    '传送：选择要放入手牌的随从（可以不选）', options,
    { sourceId: 'wizard_portal_pick', targetType: 'hand', multi: { min: 0, max: minions.length } },
);
```

## 修改文件

- `src/games/smashup/abilities/wizards.ts`：修复 `wizard_portal_pick` 交互创建

## 影响范围

检查了所有使用 `createSimpleChoice` 的地方：
- ✅ 其他使用 `multi` 配置的能力（robots、giant_ants、ghosts、cthulhu）都已使用正确格式
- ✅ DiceThrone 和 SummonerWars 使用旧签名（第 5 个参数是字符串），无影响
- ✅ 只有 `wizard_portal_pick` 一处需要修复

## 相关问题

- 占卜（Scry）交互也曾出现"暂无可选项"问题，但根因不同（动态选项刷新机制误判）
- 通用刷新机制已重构为 opt-in 模式，占卜使用 `autoRefresh: 'deck'` 显式声明

## 测试验证

- E2E 测试因测试环境问题失败（等待游戏棋盘加载超时），不是代码问题
- 需要在开发环境手动验证传送门交互是否正常工作

## 经验教训

1. **API 签名变更必须全面审查**：commit `8456a70` 修改了 `createSimpleChoice` 签名，但没有更新所有调用点
2. **调用链全面检查**：修 bug 时必须完整检查整条调用链，每一层都检查存在性、契约、返回值
3. **参数传递验证**：当函数支持多种签名时，必须验证每个参数是否正确传递到目标位置
4. **类型系统局限**：TypeScript 无法捕获"参数被忽略"的错误，需要运行时验证或更严格的类型定义

## 后续改进

1. 考虑废弃旧签名，强制使用 config 对象（破坏性变更）
2. 添加运行时警告：当第 5 个参数是 config 对象但第 6/7 个参数非空时，输出警告
3. 添加静态分析工具检查 `createSimpleChoice` 调用是否正确

## 相关文档

- `docs/bugs/smashup-jinx-dynamic-options.md`：动态选项刷新机制重构
- `AGENTS.md`：动态选项生成规范
- `src/engine/systems/InteractionSystem.ts`：`createSimpleChoice` 函数定义
