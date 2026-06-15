# Change: Refactor engine effect stacking and instance-owned lifecycle

## Why
当前 `engine-primitives` 已经有了第一批统一效果应用骨架：

- `EffectSpec`
- `applyEffectSpec(...)`
- `reconcileAppliedEffectInstance(...)`
- required / blocked / immunity / granted / remove-with-tags

这解决了“统一 apply 入口”和“tag-aware lifecycle 起步”两个核心缺口，但离更像正常 GAS 的默认路径还差两块关键能力：

1. **stacking policy 仍未进入框架主路径**  
   当前 persistent effect 还是“来一个 spec，就生成一个 instance”，没有统一表达：
   - 不允许叠加
   - 按 target 聚合
   - 按 source 聚合
   - 叠加时刷新持续时间 / 层数 / 周期

2. **granted tags 还不是严格的 instance-owned/source-owned 生命周期**  
   当前 granted tags 的回收主要还是“按 tag 再减回去”，还没有明确表达：
   - 哪些 granted tags 属于哪个 effect instance
   - 多个同类 effect 同时存在时，移除其中一个不能误伤另一个
   - 同一 tag 由多个 source 授予时，必须按 source/instance 精确回收

如果这两块不补，新的游戏即使走了 `EffectSpec + apply gateway`，仍然会在 stacking 和 tag ownership 上重新写各自的半套框架，最佳实践就还没真正落到引擎层。

## What Changes
- 在 `engine-primitives` 下新增第二批 effect lifecycle 能力：
  - stacking policy 原语与统一判定入口
  - source-owned / instance-owned granted tag lifecycle
  - persistent effect refresh / deactivate / remove 的更完整状态转换
- 保持游戏语义仍然留在各游戏 domain：
  - 不在引擎层内建 damage / destroy / control 等业务效果
  - 只把“如何管理 effect instance 生命周期”继续收口到 primitives
- 为后续新游戏提供更明确的默认能力，而不是只停留在“能 apply，但复杂生命周期自己处理”

## Impact
- Affected specs:
  - `engine-primitives`
- Affected code:
  - `src/engine/primitives/effectApplication.ts`
  - `src/engine/primitives/tags.ts`
  - `src/engine/primitives/index.ts`
  - `src/engine/primitives/__tests__/`

## Non-Goals
- 本 change 不直接迁移现有所有游戏到新 stacking/lifecycle。
- 本 change 不把 UI、日志、交互系统搬入 primitives。
- 本 change 不实现完整 UE/GAS 的全部功能，只补“新游戏默认路径”最关键的 lifecycle 能力。
