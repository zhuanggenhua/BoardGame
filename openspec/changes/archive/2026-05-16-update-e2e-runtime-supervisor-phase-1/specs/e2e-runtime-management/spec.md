## MODIFIED Requirements
### Requirement: 测试执行层必须只附着或显式请求 runtime
系统 SHALL 让测试执行层只负责附着到现有 runtime 或显式请求 runtime manager 启动，不能在 Windows / Codex 环境里继续引入未经验证的隐藏守护起服实验链。

#### Scenario: runner 附着共享 runtime
- **WHEN** 单文件 E2E 命令在当前 worktree 检测到健康的共享 runtime
- **THEN** runner 直接复用该 runtime
- **AND** 不重复发起新的后台起服实验

#### Scenario: runner 请求创建隔离 runtime
- **WHEN** 单文件 E2E 命令显式要求隔离运行
- **THEN** runner 通过 runtime manager 申请新的隔离 runtime
- **AND** 本次运行结束后只清理自己创建的 runtime

#### Scenario: 标准项目入口禁止 global-setup 旁路起服
- **WHEN** `run-e2e-command`、`run-e2e-single` 或等价标准项目入口已经标记当前运行属于 supervisor 管理
- **THEN** `global-setup` 只能附着已就绪的 managed runtime
- **AND** 不得再自行 `detached` 启动 `start-single-worker-servers` 或其他服务链

### Requirement: Runtime 与运行来源必须可追踪
系统 SHALL 为每次 E2E 运行记录稳定的 `sessionId`、入口来源与目标信息，保证并发与排障时能够明确回答“是谁启动了这条 runtime”。

#### Scenario: 标准入口发起单文件运行
- **WHEN** 用户通过项目脚本启动某条单文件 E2E
- **THEN** runtime 记录中包含本次运行的 `sessionId`、`entrypoint`、`target`
- **AND** 日志与诊断输出可以显示这些元数据

#### Scenario: 多 worktree 或同目录并发运行
- **WHEN** 两条标准入口 E2E 同时运行
- **THEN** 每条 runtime 都有独立的 `sessionId`
- **AND** 诊断信息可以区分不同来源，而不是只看到端口和 pid

### Requirement: 直接 Playwright 入口必须显式声明
系统 SHALL 将裸 `playwright test` 的自起服能力降级为显式 opt-in，而不是默认旁路 supervisor。

#### Scenario: 未声明 legacy 开关时直接执行 Playwright
- **WHEN** 用户直接执行 `playwright test`，且当前运行没有标准入口元数据
- **THEN** `global-setup` 默认拒绝 detached 起服
- **AND** 返回指向项目标准 E2E 入口的错误提示

#### Scenario: 显式启用 legacy bootstrap
- **WHEN** 用户显式设置 legacy bootstrap 开关
- **THEN** 系统允许沿用旧起服路径
- **AND** 仍记录该运行不是标准 supervisor 入口
