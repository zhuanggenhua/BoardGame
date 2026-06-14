## 1. Analysis
- [x] 1.1 枚举 Smash Up 当前所有 `special` 相关读点（UI、命令、AI、响应窗口、trigger、discard provider）
- [x] 1.2 输出现有卡牌迁移分型清单：场上手动 / 弃牌区手动 / 牌库旁手动 / 响应窗口打出 / trigger special / 脏数据

## 2. Runtime Model
- [x] 2.1 在 `src/games/smashup/domain/types.ts` 引入显式 activation metadata
- [x] 2.2 新增统一 helper，供 minion/action/fusion/titan 查询 activatable abilities
- [x] 2.3 将 `commands.ts`、`Board.tsx`、`BaseZone.tsx` 切到新 helper
- [x] 2.4 将 `game.ts`、`ai.ts`、`aiProfiles.ts` 切到新语义，不再依赖 `abilityTags.special`

## 3. Data Migration
- [x] 3.1 迁移所有场上手动 special / talent 到显式 activation metadata
- [x] 3.2 迁移弃牌区 / setaside special 到显式 activation metadata 或 provider 显式配置
- [x] 3.3 清理 trigger-driven printed `Special:` 的旧 `abilityTags.special`
- [x] 3.4 清理已知脏数据与 POD alias 遗留

## 4. Verification
- [x] 4.1 更新现有 Vitest，使断言依赖新入口语义而不是旧标签
- [x] 4.2 补关键 E2E：窗口响应、场上高亮、trigger special 不高亮、弃牌区 special
- [x] 4.3 补 evidence / 审计文档，明确迁移后哪些牌属于哪类入口
- [x] 4.4 运行 `openspec validate refactor-smashup-special-activation-semantics --strict --no-interactive`
