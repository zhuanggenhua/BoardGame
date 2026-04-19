# Change: E2E runtime 自动端口回退

## Why
当前 isolated E2E runtime 固定使用同一组端口，导致同一 worktree 内已有 runtime 在运行时，新 E2E 直接失败。用户期望 runner 能自动切换到可用端口继续执行。

## What Changes
- 为 **isolated runtime** 引入自动端口回退：默认端口被占用时自动申请新的可用端口组。
- 允许同一 worktree 同时存在多个 isolated runtime（端口组互不冲突）。
- runner 在端口耗尽时给出可诊断的冲突清单（runtimeId + 端口组）。
- 清理/registry 逻辑支持动态端口组记录与回收。

## Impact
- Affected specs: e2e-runtime-management
- Affected code: scripts/infra/run-e2e-single.mjs, scripts/infra/e2e-port-config.js, scripts/infra/port-allocator.js, scripts/infra/e2e-runtime-registry.js, scripts/infra/cleanup_test_connections.js
