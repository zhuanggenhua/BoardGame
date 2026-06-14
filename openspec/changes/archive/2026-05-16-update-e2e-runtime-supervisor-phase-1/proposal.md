# Change: 收口 E2E 入口并建立 Supervisor Phase 1

## Why
当前 BoardGame 的 E2E 启动链存在多个并行入口：`run-e2e-command`、`run-e2e-single`、`global-setup`、runtime manager 都可能直接起服。部分入口仍使用 `detached + unref`，在 Windows / Codex / 多 worktree 并发场景下容易留下孤儿 runtime、误起 watch 服务，导致“弹窗又关闭”“后台反复重启”“registry 为空但进程仍活着”等问题。

用户明确要求支持“多个工作树或同一个目录同时多个端到端并发”，因此需要把 E2E 基础设施收敛成可追踪、可回收、入口边界清晰的运行框架，而不是继续依赖多条隐式起服链。

## What Changes
- 为项目脚本入口建立统一的 E2E supervisor 会话元数据，标记每次运行的 `sessionId`、入口来源、目标文件/用例
- 收口标准项目入口的生命周期控制：`run-e2e-command` / `run-e2e-single` 成为标准 supervisor 入口
- 修改 `e2e/global-setup.ts`：在标准项目入口下只允许附着已准备好的 managed runtime，不再自行 `detached` 起服
- 为 direct Playwright / 非标准入口保留显式逃生开关，但默认报错并指向项目脚本
- 扩展 runtime 记录与日志元数据，保证多 worktree / 同目录并发时可追踪 owner、session、source

## Impact
- Affected specs: `e2e-runtime-management`
- Affected code:
  - `scripts/infra/run-e2e-command.mjs`
  - `scripts/infra/run-e2e-single.mjs`
  - `scripts/infra/e2e-runtime-manager.mjs`
  - `scripts/infra/e2e-runtime-registry.js`
  - `e2e/global-setup.ts`
  - `e2e/global-teardown.ts`
  - 相关日志/诊断脚本
