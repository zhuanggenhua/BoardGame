## Context
当前 single-worker isolated runtime 在同一 worktree 内共享固定端口（如 6300/20100/21100）。当已有 runtime 未退出时，新运行因端口冲突失败，影响 E2E 出图效率。

## Goals / Non-Goals
- Goals:
  - isolated runtime 自动寻找可用端口组并启动。
  - 同一 worktree 多个 isolated runtime 可并行共存。
  - 端口耗尽时给出清晰冲突信息。
- Non-Goals:
  - 不改变 shared runtime 的固定端口语义（保持 6174/20000/21000 作为共享端口组）。
  - 不改变跨 worktree 的隔离规则。

## Decisions
- Decision: isolated runtime 启动时优先使用默认端口组；若被占用则从端口池中自动分配下一个可用端口组，并将分配结果写入 registry。
- Decision: 端口池由 e2e-port-config 提供（起始端口 + 步进），通过 port-allocator 验证可用性。

## Risks / Trade-offs
- 风险: 端口池耗尽导致无法启动。
  - Mitigation: 错误信息列出占用 runtime + 端口组，提示清理方式。
- 风险: stale runtime 未被清理导致端口长期占用。
  - Mitigation: 复用现有 stale runtime 回收逻辑，启动前执行 prune。

## Migration Plan
- 无数据迁移；仅更新 runtime 启动与 registry 逻辑。

## Open Questions
- 端口池范围上限如何设置，是否需要可配置化环境变量？
