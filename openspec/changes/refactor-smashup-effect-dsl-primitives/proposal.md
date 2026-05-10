# Change: Smash Up 强类型 Effect DSL primitives

## Why
Smash Up 反应排序已经从手写读写合同迁到事件/交互产物推导，但这仍是“执行后反推读写”。商业级长期方案应让能力效果的 primitive 成为单一事实源：同一个 typed primitive 同时描述执行产物、资源 footprint 与交互 metadata，避免每张卡重复维护 reads/writes。

## What Changes
- 新增 Smash Up Effect DSL / effect primitive 能力层。
- primitive 必须能在同一处生成执行结果与 `SmashUpReactionResourceFootprint`。
- AbilityRuntime 支持从 program metadata 直接解析 footprint；无法解析时才回退到现有 probe。
- 迁移代表能力链路，证明普通事件、场上选择、OR/optional/sequence 可接入 DSL。
- 补单测与 E2E 证据，确保不会再因抽象桶或手写合同导致错误强制排序。

## Impact
- Affected specs: `smashup-effect-dsl`
- Affected code: `src/games/smashup/domain/abilityRuntime.ts`, `reactionResources.ts`, 新增 DSL primitives，代表能力/测试/规则文档。
