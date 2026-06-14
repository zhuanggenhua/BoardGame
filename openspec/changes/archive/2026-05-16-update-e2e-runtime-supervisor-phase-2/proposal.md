# Change: 收口 E2E supervisor 到单 owner 直接持有服务

## Why
Phase 1 已经堵住了 `global-setup` 旁路起服，但标准入口下的 `e2e-runtime-manager` 仍通过 `detached + unref` 的 bootstrap 子进程间接起服务。这会让 registry、真实 owner、窗口行为和退出清理再次脱节，成为 Windows 下“疯狂弹窗”和 orphan runtime 的主要来源。

## What Changes
- 让标准入口的 `e2e-runtime-manager` 直接持有前端、游戏服务、API 服务
- 去掉标准路径上的 `detached bootstrap` / `unref` 设计
- 把单 worker 服务启动逻辑下沉为可复用模块，legacy 脚本仅保留兼容壳
- 调整标准入口的退出路径，优先通过 held manager 自清理，而不是外部强杀
- 更新端口隔离验证测试，兼容 shared-single 与 isolated-single 的测试端口

## Impact
- Affected specs: `e2e-runtime-management`
- Affected code:
  - `scripts/infra/e2e-runtime-manager.mjs`
  - `scripts/infra/single-worker-runtime.js`
  - `scripts/infra/start-single-worker-servers.js`
  - `scripts/infra/e2e-server-launcher.js`
  - `scripts/infra/run-e2e-command.mjs`
  - `e2e/smashup/test-port-isolation.e2e.ts`
