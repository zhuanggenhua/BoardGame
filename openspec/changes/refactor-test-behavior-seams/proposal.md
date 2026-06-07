# Change: 重构测试行为 seam 并统一测试标准

## Why
现有测试大量耦合内部状态、调用次数、镜像目录与巨型文件，导致修 bug 或重构时需要同步改测试。测试应锁公开行为，不应锁实现细节。

## What Changes
- 统一测试标准，明确哪些层用单测、集成测试、E2E、审计测试。
- 引入/强化行为级测试 seam，减少对 `sys.interaction` 内部形状、调用顺序、mock 调用次数的直接依赖。
- 收敛镜像测试与重复测试组织，避免同一行为在 `src/` 与 `e2e/src/` 两处重复维护。
- 拆分测试垃圾桶式大文件，按能力簇/交互簇/页面行为簇分层。
- 将“测试因重构变化而大面积修改”定义为需要修正测试设计或 seam 的信号，而不是默认接受的维护成本。

## Impact
- Affected spec: `testing-standards`
- Affected code: `src/engine/testing/`, `src/games/**/__tests__/`, `e2e/src/games/**/__tests__/`, `docs/testing-best-practices.md`, `docs/automated-testing.md`
