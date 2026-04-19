## 反馈

- ID: `69d71ce3932fe508b2420c18`
- 标题：适居化这张战术跳新基地可以跳额外随从，然而我跳上去，我一只2攻收集者却没了
- 结论：**非 bug，按规则正常执行**

## 审查范围

- 诊断包：`temp/feedback-closeout/2026-04-09T16-03-47-321Z/69d71ce3932fe508b2420c18.md`
- 外星人能力：`src/games/smashup/abilities/aliens.ts`
- 基地能力：`src/games/smashup/domain/baseAbilities.ts`

## 关键事实

1. 诊断包动作日志明确记录：
   - `11:26:12`：打出 `适居化`
   - `11:26:25`：`巫师学院 -> 家园`
   - `11:26:45`：打出 `外星霸主`
   - `11:26:50`：`收回随从到花千明： 收集者 -> 家园`
2. 当前状态快照里，`alien_collector` 仍然存在于玩家 0 手牌中（`uid: c9`），并非被吞掉或丢失。
3. `alienSupremeOverlord` 的实现就是“你可以将一个随从返回到其拥有者的手上”，目标可来自任意基地，也允许返回自己或己方其他随从：`src/games/smashup/abilities/aliens.ts`
4. `base_the_homeworld` 的实现只提供“额外打出一个力量≤2的随从”的额度，不会消灭或移除随从：`src/games/smashup/domain/baseAbilities.ts`

## 结论说明

用户看到的“收集者没了”，实际是：

- `适居化` 把基地替换成 `家园`
- `家园` 给了额外随从额度
- 玩家随后打出 `外星霸主`
- `外星霸主` 的 onPlay 把 `收集者` **返回到了手牌**

因此这条反馈不是“随从消失”，而是**外星霸主效果生效后，收集者被正常收回手牌**。

## 证据

- 动作日志证据：诊断包原始 action log
- 状态证据：诊断包 current snapshot 中玩家 0 手牌包含 `alien_collector`
- 规则证据：`alienSupremeOverlord` / `base_the_homeworld` 实现
