# Semantic Bypass Audit

这份审计只用于说明当前提案为什么是“框架缺口”，不是单牌漏修。

## 已有统一入口
- `src/games/smashup/domain/ongoingEffects.ts`
  - 已有保护注册/查询能力，例如 `isMinionProtected(...)`
- `src/games/smashup/domain/abilityHelpers.ts`
  - 已有目标过滤与 destroy 合法化入口，例如 `buildMinionTargetOptions(...)`、`buildValidatedDestroyEvents(...)`
- `src/games/smashup/domain/reducer.ts`
  - 已有 destroy / move 的最终保护拦截

## 仍可绕过的共享层
- `src/games/smashup/domain/ongoingModifiers.ts`
  - `filterRuntimeMatchedActions(...)` 仍直接扫 `attachedActions` / `ongoingActions`
  - 说明 modifier 层还没有统一的 material/reference selector

## 仍在业务层自管语义的代表实现
- `src/games/smashup/abilities/kitty_cats.ts`
  - 直接搜场上随从，并手写 `action` / `affect` 保护判断
- `src/games/smashup/abilities/ongoing_modifiers.ts`
  - 在 modifier 内决定哪些 attached/base ongoing 应计数
  - 并局部决定保护后是否跳过

## 结论
- 当前项目并非完全没有重构
- 真正缺的是“统一语义层的强制性”
- 因此本提案目标不是再加一个 helper，而是把已有局部统一入口收口成不可绕过的 semantic runtime
