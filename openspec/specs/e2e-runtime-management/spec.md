# e2e-runtime-management Specification

## Purpose
定义 BoardGame E2E runtime 的独立生命周期、worktree 隔离、健康判定与精准清理规则，确保 Windows/Codex 与多工作树场景下的测试执行稳定可控。
## Requirements
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

### Requirement: 多工作树必须相互隔离
系统 SHALL 以 `worktreeRoot + scope` 作为 runtime 隔离边界，禁止不同工作树隐式复用同一 E2E runtime。

#### Scenario: 另一个工作树占用相同共享端口
- **WHEN** 当前 worktree 请求复用共享单 worker 端口，而该端口已被其他 worktree 的 active runtime 占用
- **THEN** 系统拒绝复用
- **AND** 返回包含冲突 worktree 与 runtime 摘要的错误信息

#### Scenario: 多工作树并行使用隔离 runtime
- **WHEN** 两个工作树分别请求隔离 runtime
- **THEN** 系统为它们分配不同的端口组
- **AND** 两边的 registry 记录互不覆盖

### Requirement: Ready 状态必须基于真实健康检查
系统 SHALL 以真实端口监听与 HTTP 健康检查作为 runtime 就绪的唯一判据，不能仅依据进程仍在存活或 bootstrap 已登记。

#### Scenario: 前端进程已退出但 bootstrap 仍存活
- **WHEN** runtime owner 进程仍在，但前端端口未监听或 `/__ready` 不可访问
- **THEN** 系统将该 runtime 标记为 unhealthy 或 stale
- **AND** 后续测试执行不得把它当作可复用 runtime

#### Scenario: 服务全部健康
- **WHEN** 前端、游戏服务、API 服务端口均在监听，且 `/__ready`、`/games`、`/health` 均返回成功
- **THEN** runtime 可以被标记为 ready

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

### Requirement: Single-Worker Runtime Isolation And Reuse
系统 SHALL 在单文件 E2E 运行时，为同一 worktree 的同一目标生成稳定 runtime scope，以便复用现有 runtime；不同 worktree 即使目标文件相同，也必须获得不同 scope，避免共享同一 runtime。

#### Scenario: Same worktree reuses stable runtime
- **WHEN** 同一 worktree 连续运行相同目标的单文件 E2E
- **THEN** 系统使用相同的稳定 runtime scope
- **AND** 如现有 runtime 健康可用，则复用该 runtime

#### Scenario: Different worktrees stay isolated
- **WHEN** 不同 worktree 同时运行相同目标的单文件 E2E
- **THEN** 系统为它们生成不同 runtime scope
- **AND** 运行时记录、端口保留和预算占用彼此隔离

### Requirement: Global Heavy Task Budget
系统 SHALL 为 E2E 与其他重型本地校验任务提供全仓库共享预算，并在启动前根据预算占用、CPU、可用内存和启动冷却状态决定是否允许启动。

#### Scenario: Heavy task starts within budget
- **WHEN** 新的重型任务请求启动
- **AND** 当前共享预算尚有余量
- **AND** CPU 与可用内存满足准入阈值
- **THEN** 系统记录该任务的全局预算占用并允许启动

#### Scenario: Heavy task rejected by budget
- **WHEN** 新的重型任务请求启动
- **AND** 当前共享预算已满或动态资源门控未通过
- **THEN** 系统拒绝启动该任务
- **AND** 输出当前活跃重任务、预算占用与阻塞原因

#### Scenario: Stale global budget entries are recovered
- **WHEN** 共享预算 registry 中存在 PID 失效或租约过期的任务记录
- **THEN** 系统在新的重型任务启动前自动清理 stale 记录
- **AND** stale 记录不会继续占用预算

### Requirement: 清理必须支持精准停止
系统 SHALL 支持按 runtime 精准停止测试服务，并保证清理 registry 与端口状态一致。

#### Scenario: 精准停止指定 runtime
- **WHEN** 用户执行 stop/cleanup 并指定某个 runtime
- **THEN** 系统仅停止该 runtime 的 owner 和 service 进程
- **AND** 从共享 registry 中移除对应记录

#### Scenario: 清理共享 single-worker runtime
- **WHEN** 用户显式要求清理共享 single-worker E2E runtime
- **THEN** 系统停止该 runtime 并释放其共享端口
- **AND** 不影响其他 worktree 的隔离 runtime
