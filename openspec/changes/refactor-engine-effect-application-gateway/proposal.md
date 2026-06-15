# Change: Refactor engine effect application gateway

## Why
当前仓库已经有一批可复用引擎原语：

- `src/engine/primitives/effects.ts`：按 `type` 分发效果 handler
- `src/engine/primitives/tags.ts`：不可变 tag 容器
- `src/engine/primitives/modifier.ts`：不可变 modifier 栈
- `src/engine/primitives/target.ts`：目标解析框架

但这些能力目前仍然是彼此割裂的：

- `effects.ts` 只负责“找到 handler 并执行”，没有统一的 `source / target / level / tags / immunity / lifecycle` 语义。
- `tags.ts` 只是纯容器，还没有进入“效果应用前检查 / 应用后授予 / 条件失活 / 以 tag 移除效果”这条主链。
- 游戏层如果要实现“目标需要某 tag 才能吃到效果”“目标有免疫 tag 就跳过”“效果激活期间授予 tag”“某 tag 出现时移除效果”，仍然要各写各的。

这正是这次 Smash Up 暴露出来的框架性缺口：不是没有 helper，而是**没有统一、强制、可复用的效果应用主入口**。

对照用户提供的 `FantasyWord` 插件层 GAS 源码，标准做法不是“业务先手写 if 再调底层”，而是：

- 先形成统一 `GameplayEffectSpec`
- 再从唯一 Apply 入口进入
- 入口内部统一检查 required tags / immunity / stacking / ongoing activation
- tag 变化后由框架刷新效果活跃状态

本项目未来还会继续接新游戏，仅靠单个游戏各自手写 `apply / protect / block / granted tags` 会重复制造同类问题。因此需要在引擎原语层补一个**tag-aware effect application gateway**，让后续游戏至少能从同一条路接入。

## What Changes
- 在 `engine-primitives` 能力下新增“标签感知的效果规格与应用网关”能力：
  - 统一的 `EffectSpec` / `EffectApplicationContext`
  - 应用前检查：required tags / blocked tags / immunity tags
  - 持续效果激活期间的 granted tags
  - tag 变化时的 effect active/inactive 刷新
  - 以 tag 批量移除 effect 的纯函数入口
- 保持游戏语义仍由各游戏 domain 定义：
  - 引擎不预置 damage / heal / summon / destroy 语义
  - 引擎只提供“如何统一申请效果、如何统一判断 tags/lifecycle”的骨架
- 保留现有 `effects.ts` 的简单分发能力，但将其下沉为更底层 primitive；新游戏默认应优先走 spec + apply gateway。
- 为后续把 Smash Up、Dice Throne、其它新游戏迁到统一 apply seam 提供引擎级落点。

## Impact
- Affected specs:
  - `engine-primitives`
- Affected code:
  - `src/engine/primitives/effects.ts`
  - `src/engine/primitives/tags.ts`
  - `src/engine/primitives/index.ts`
  - `src/engine/primitives/__tests__/`
  - 可能新增 `src/engine/primitives/effectSpec.ts`、`effectApplication.ts` 等文件

## Non-Goals
- 本 change 不直接把所有现有游戏迁完。
- 本 change 不把每个游戏的 domain 语义硬编码进引擎。
- 本 change 不替代 `systems` 层，也不把交互/response/undo 逻辑搬进 primitive。
