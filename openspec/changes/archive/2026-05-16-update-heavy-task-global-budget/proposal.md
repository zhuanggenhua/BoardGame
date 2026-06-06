# Change: 为重型本地任务增加全仓库动态并发预算

## Why
当前 E2E、quality gate、开发服务在多 worktree 并行时，虽然已经有单工作树互斥和端口隔离，但仍可能因为机器资源被同时抢占而导致 CPU、内存与编译链路被打满。需要一层跨 worktree 的共享预算，在启动前做资源准入判断。

## What Changes
- 为重型本地任务新增“全仓库共享预算”机制，基于 git common dir 共享 registry 与锁文件管理
- 对 E2E 与 quality gate 引入权重、动态 CPU/内存门控、启动冷却时间与 stale 回收
- 提供诊断入口，输出当前全仓库重任务预算占用、活跃任务与资源准入状态

## Impact
- Affected specs: `e2e-runtime-management`
- Affected code: `scripts/infra/run-e2e-command.mjs`, `scripts/infra/run-changed-quality-gate.mjs`, `scripts/infra/cleanup_test_connections.js`, `scripts/infra/e2e-doctor.mjs`, 新增共享预算模块
