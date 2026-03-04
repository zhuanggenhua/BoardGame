# 提交 6ea1f9f 关键修改摘要

## 快速检查命令

```bash
# 查看 reducer.ts 的修改
git show 6ea1f9f -- src/games/smashup/domain/reducer.ts

# 查看 index.ts 的修改
git show 6ea1f9f -- src/games/smashup/domain/index.ts

# 查看能力系统修改
git show 6ea1f9f -- src/games/smashup/abilities/

# 查看类型定义修改
git show 6ea1f9f -- src/games/smashup/domain/types.ts

# 查看命令定义修改
git show 6ea1f9f -- src/games/smashup/domain/commands.ts
```

## 重点审查文件（按优先级）

### 🔴 P0 - 必须立即检查

1. **src/games/smashup/domain/reducer.ts** (320 行修改)
   - 检查点：状态更新逻辑、结构共享、事件处理
   - 命令：`git show 6ea1f9f -- src/games/smashup/domain/reducer.ts | grep -E "^\+|^-" | head -100`

2. **src/games/smashup/domain/index.ts** (331 行修改)
   - 检查点：命令执行、验证逻辑、FlowHooks
   - 命令：`git show 6ea1f9f -- src/games/smashup/domain/index.ts | grep -E "^\+|^-" | head -100`

3. **src/games/smashup/domain/reduce.ts** (86 行修改)
   - 检查点：事件 reducer、新事件处理
   - 命令：`git show 6ea1f9f -- src/games/smashup/domain/reduce.ts`

### 🟡 P1 - 高优先级

4. **src/games/smashup/abilities/ninjas.ts** (316 行修改)
5. **src/games/smashup/abilities/pirates.ts** (282 行修改)
6. **src/games/smashup/abilities/dinosaurs.ts** (217 行修改)
7. **src/games/smashup/Board.tsx** (146 行修改)
8. **src/games/smashup/ui/BaseZone.tsx** (175 行修改)

### 🟢 P2 - 中优先级

9. **src/games/smashup/domain/types.ts** (46 行修改)
10. **src/games/smashup/domain/commands.ts** (81 行修改)

## 已知 Bug 关联

### Bug 1: Power Modifier 重复应用
- **相关文件**: `src/games/smashup/domain/reducer.ts`
- **检查**: 搜索 `powerModifier` 相关代码
- **命令**: `git show 6ea1f9f -- src/games/smashup/domain/reducer.ts | grep -i "powermodifier"`

### Bug 2: 计分重复触发
- **相关文件**: `src/games/smashup/domain/index.ts`
- **检查**: 搜索 `afterScoring` 相关代码
- **命令**: `git show 6ea1f9f -- src/games/smashup/domain/index.ts | grep -i "afterscoring"`

### Bug 3: Ongoing 效果异常
- **相关文件**: `src/games/smashup/domain/ongoingModifiers.ts`
- **检查**: 搜索 ongoing 相关代码
- **命令**: `git show 6ea1f9f -- src/games/smashup/domain/ongoingModifiers.ts`

## 自动化检查脚本

创建以下脚本来快速检查常见问题：

```bash
#!/bin/bash
# check-6ea1f9f.sh

echo "=== 检查 reducer.ts 中的 powerModifier 修改 ==="
git show 6ea1f9f -- src/games/smashup/domain/reducer.ts | grep -A5 -B5 "powerModifier"

echo "\n=== 检查 index.ts 中的 afterScoring 修改 ==="
git show 6ea1f9f -- src/games/smashup/domain/index.ts | grep -A5 -B5 "afterScoring"

echo "\n=== 检查新增的命令类型 ==="
git show 6ea1f9f -- src/games/smashup/domain/commands.ts | grep "^\+.*COMMANDS"

echo "\n=== 检查新增的事件类型 ==="
git show 6ea1f9f -- src/games/smashup/domain/events.ts | grep "^\+.*:"

echo "\n=== 检查 types.ts 中的新字段 ==="
git show 6ea1f9f -- src/games/smashup/domain/types.ts | grep "^\+.*:"
```

## 测试验证

```bash
# 运行所有 SmashUp 测试
npm test -- smashup

# 运行特定的 bug 相关测试
npm test -- alien-scout-no-duplicate-scoring
npm test -- steampunk-aggromotive-fix
npm test -- ninja-acolyte-pod-consistency

# 运行 E2E 测试
npm run test:e2e -- smashup
```

## 回滚计划

如果发现严重问题：

```bash
# 方案 1: 完全回滚
git revert 6ea1f9f

# 方案 2: 创建修复分支
git checkout -b fix/6ea1f9f-critical-bugs 6ea1f9f^

# 方案 3: 选择性回滚特定文件
git checkout 6ea1f9f^ -- src/games/smashup/domain/reducer.ts
git checkout 6ea1f9f^ -- src/games/smashup/domain/index.ts
```

## 下一步

1. 运行上述检查脚本
2. 查看具体的 diff 输出
3. 识别可疑的修改模式
4. 运行测试验证
5. 创建具体的 bug 修复任务
