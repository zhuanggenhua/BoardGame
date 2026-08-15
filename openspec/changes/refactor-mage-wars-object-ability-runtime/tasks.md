## 0. Approval

- [x] 0.1 用户批准继续实施 Mage Wars，但限定为先跑通初始两个派系流程，并要求技能系统考虑后续全派系扩展；本 change 不代表全量 Mage Wars 完成。

## 1. Spec and Design

- [x] 1.1 建立对象能力 runtime change，明确不继续污染已完成的两法师流程 closeout。
- [x] 1.2 在 `mage-wars` spec delta 中要求对象能力注册表和执行器 fail-close。
- [x] 1.3 记录 TagContainer / ModifierStack 状态迁移为后续债务，不在本 change 中半迁移。
- [x] 1.4 补充法术能力目录、配置 ability catalog 与执行器注册表同步合同，支撑后续派系扩展。

## 2. Runtime Refactor

- [x] 2.1 为全部当前 `MAGE_WARS_OBJECT_ABILITY_IDS` 建立 Mage Wars 对象能力定义注册表。
- [x] 2.2 建立对象能力执行器注册表和执行上下文。
- [x] 2.3 将 `USE_ARENA_OBJECT_ABILITY` 验证入口改为通过能力定义和验证器分发。
- [x] 2.4 将 `USE_ARENA_OBJECT_ABILITY` 执行入口改为通过执行器注册表分发。
- [x] 2.5 保持既有事件 payload、状态变更和两法师流程行为不变。

## 3. Tests

- [x] 3.1 补注册表完整性测试：当前对象能力 ID 全部注册，未知能力拒绝。
- [x] 3.2 补法术能力同步测试：配置 ability catalog、法术能力注册表和法术执行器注册表一致。
- [x] 3.3 保持现有对象能力领域测试通过。
- [x] 3.4 通过 Mage Wars 定向 Vitest。

## 4. Validation

- [x] 4.1 通过 `openspec validate refactor-mage-wars-object-ability-runtime --strict --no-interactive`。
- [x] 4.2 通过 `openspec validate mage-wars --strict --no-interactive`。
- [x] 4.3 通过 `node scripts/infra/run-e2e-command.mjs isolated e2e/mage-wars/online-runtime.e2e.ts`。
