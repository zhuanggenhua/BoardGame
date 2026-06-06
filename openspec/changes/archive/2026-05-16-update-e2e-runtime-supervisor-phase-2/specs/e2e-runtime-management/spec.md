## MODIFIED Requirements
### Requirement: E2E Runtime 生命周期必须独立于单次测试执行
系统 SHALL 提供独立的 E2E runtime 管理能力，用于显式启动、查询和停止测试服务，而不是把服务生命周期隐式绑定到每次 Playwright 命令。标准 supervisor 路径下，runtime manager 自身 MUST 成为 runtime 的唯一 owner，不能再把真正的 owner 继续转交给 detached bootstrap 守护进程。

#### Scenario: 显式启动共享 runtime
- **WHEN** 用户或 runner 请求启动当前 worktree 的共享 E2E runtime
- **THEN** 系统启动前端、游戏服务和 API 服务
- **AND** runtime manager 自身成为该 runtime 的 ownerPid
- **AND** 仅在健康检查全部通过后将该 runtime 记录为 active

#### Scenario: 查询 runtime 状态
- **WHEN** 用户或 runner 查询当前 worktree 的 E2E runtime 状态
- **THEN** 系统返回 runtime 所属 worktree、scope、ports、ownerPid、servicePids 和实时健康状态

### Requirement: 测试执行层必须只附着或显式请求 runtime
系统 SHALL 让测试执行层只负责附着到现有 runtime 或显式请求 runtime manager 启动，不能在 Windows / Codex 环境里继续引入未经验证的隐藏守护起服实验链。标准 supervisor 路径下，runner 退出时 MUST 优先通过 held runtime manager 自行清理，而不是依赖额外 detached owner 或重复强杀 stop。

#### Scenario: runner 附着共享 runtime
- **WHEN** 单文件 E2E 命令在当前 worktree 检测到健康的共享 runtime
- **THEN** runner 直接复用该 runtime
- **AND** 不重复发起新的后台起服实验

#### Scenario: runner 请求创建隔离 runtime
- **WHEN** 单文件 E2E 命令显式要求隔离运行
- **THEN** runner 通过 runtime manager 申请新的隔离 runtime
- **AND** 本次运行结束后由 held runtime manager 主动清理自己创建的 runtime
