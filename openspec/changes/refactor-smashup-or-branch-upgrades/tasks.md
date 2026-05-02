## 1. Spec / Contract

- [x] 1.1 为 Smash Up OR 分支能力新增统一 capability 规格
- [x] 1.2 明确 `optional-both` 的真实口径是“首分支执行后再给剩余分支 + 跳过”
- [x] 1.3 明确 OR 分支选择与分支内部目标选择必须分离

## 2. Smash Up Shared Flow

- [x] 2.1 新增 branching OR builder / pending plan / resume helper
- [x] 2.2 让分支在打开子交互后仍能恢复到剩余分支 follow-up prompt
- [x] 2.3 只在玩家真的选择第二个剩余分支时消费 `Spirit of the Forest`

## 3. Fairies / Base Migration

- [x] 3.1 迁移 `fairies_titania` 等首批 Fairies OR 能力到统一抽象
- [x] 3.2 将 `fairies_enchantment` 改为遵循同语义的专用串行 continuation
- [x] 3.3 让 `base_fairy_ring` 等基础能力也接入相同的串行补选语义

## 4. Verification

- [x] 4.1 更新并通过受影响的 Smash Up Vitest
- [x] 4.2 更新并通过代表性 Smash Up E2E（Titania / Fairy Ring）
- [x] 4.3 补齐证据文档并运行 `openspec validate refactor-smashup-or-branch-upgrades --strict --no-interactive`
