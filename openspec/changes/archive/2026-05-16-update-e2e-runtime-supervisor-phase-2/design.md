## Context
当前标准 E2E 入口已经有 session/source/runtime registry，但 runtime manager 仍会把真正的服务 owner 再交给 `start-single-worker-servers.js`。当 bootstrap 采用 `detached + unref` 时，进程树与 registry 的 owner 不再稳定一一对应，最终表现为：

- 窗口会在后台 bootstrap / watcher 重启时反复闪出
- registry 空了，但实际服务树曾经继续活着
- 标准入口退出路径需要额外强杀 stop 才能勉强收口

## Goals / Non-Goals
- Goals:
  - 标准入口只保留一个真正的 runtime owner
  - 单 worker runtime 的启动逻辑只保留一份
  - runtime manager 与 registry 的 ownerPid / servicePids 精确对应
  - 退出路径优先走 held manager 自清理
- Non-Goals:
  - 本阶段不重写 parallel worker 路径
  - 本阶段不移除 legacy global-setup 兼容壳
  - 本阶段不重构所有 E2E 文档

## Decisions
- Decision: 抽出 `single-worker-runtime.js`
  - 统一承载端口解析、子服务 spawn、heartbeat 和异常退出收口
  - `start-single-worker-servers.js` 与 `e2e-runtime-manager.mjs` 共用它

- Decision: 标准 supervisor 路径改为“runtime-manager 直接 owner”
  - `ensure --hold` 创建新 runtime 时，ownerPid 记录为 `runtime-manager` 自身 PID
  - servicePids 单独记录，用于诊断与精准 stop

- Decision: 服务输出在 supervisor 模式下重定向到 runtime log
  - 避免子服务 stdout 污染 `--json` 握手协议
  - 同时保留 legacy 入口下的正常控制台输出

- Decision: `run-e2e-command` 优先优雅关闭 held manager
  - 让 manager 自己结束子服务并清理 registry
  - 只有没有 held manager 的路径才走外部 stop 兜底

## Risks / Trade-offs
- 风险: `start/ensure` 创建新 runtime 时若不使用 `--hold`，owner 会提前退出
  - Mitigation: 新行为明确报错，要求标准路径必须带 `--hold`

- 风险: shared-single 的长期驻留语义相比 detached 时代更收敛
  - Mitigation: 当前标准路径默认 isolated-single；shared-single 后续再单独规划持久化 owner 语义

## Migration Plan
1. 提取公共 single-worker runtime 模块
2. 让 runtime manager 直接持有服务并写 heartbeat
3. 收口 `run-e2e-command` 退出路径
4. 跑 `--list`、单文件实跑、并发双 runtime probe
