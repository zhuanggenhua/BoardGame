## Context
BoardGame 当前 E2E 基础设施同时承担三种目标：

- 单文件/单用例快速运行
- 多 worktree / 同目录并发运行
- Playwright 直接运行时的兜底起服

这三种目标被混在同一套 `global-setup + detached bootstrap + runtime registry` 机制里，导致生命周期边界不清。最典型的问题是：

- 标准入口已经有 runtime manager，但 `global-setup` 仍能旁路起服
- registry 记录与真实进程树可能脱节
- Windows 下 `detached + unref` 容易留下孤儿服务

## Goals / Non-Goals
- Goals:
  - 标准项目入口统一经 supervisor 会话启动
  - 标准入口下禁止 `global-setup` 自行 detached 起服
  - 每次运行都能追踪 `sessionId / source / target`
  - 退出后可以按 runtime / session 精准回收
- Non-Goals:
  - 本阶段不重写全部 Playwright 配置
  - 本阶段不一次性替换所有 multi-worker 启动细节
  - 本阶段不移除 direct Playwright 能力，只把它改成显式 opt-in

## Decisions
- Decision: 标准入口统一注入 supervisor 元数据
  - `run-e2e-command` 负责生成 `PW_E2E_SESSION_ID`、`PW_E2E_ENTRYPOINT`、`PW_E2E_STANDARD_ENTRY=true`
  - 这样 `global-setup` 可以明确区分“标准项目入口”与“裸 Playwright 入口”

- Decision: `global-setup` 在标准入口下只附着，不起服
  - 如果标准入口没有先准备好 managed runtime，则直接报错
  - 这能消除 `global-setup` 成为第二个 supervisor 的问题

- Decision: direct Playwright 走显式逃生开关
  - 默认禁止裸 `playwright test` 在 `global-setup` 里自行 detached 起服
  - 若确需保留，必须显式设置如 `PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP=true`

- Decision: runtime registry 扩展 owner/session/source 元数据
  - 记录 `sessionId`、`entrypoint`、`commandSource`
  - 诊断时可以明确回答“是谁在起这条 runtime”

## Risks / Trade-offs
- 风险: 现有某些直接调用 `playwright test` 的隐式习惯会被拦下
  - Mitigation: 报错信息明确指向项目标准入口，并保留显式逃生开关

- 风险: parallel / worker 启动链仍有历史逻辑
  - Mitigation: 本阶段先保证标准入口与 single-worker 路径稳定，parallel 路径保持兼容但补齐 metadata

## Migration Plan
1. 先增加 session / source 元数据
2. 收口标准入口与 `global-setup` 的边界
3. 更新 teardown / registry，确保退出回收一致
4. 用单文件、`--list`、并发场景做最小验证

## Open Questions
- Phase 2 是否把 parallel worker 启动也完全迁入独立 supervisor 进程
- 是否要新增统一的 `scripts/infra/e2e-supervisor.mjs` 作为后续唯一运行入口
