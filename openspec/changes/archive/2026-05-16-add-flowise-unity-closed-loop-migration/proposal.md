# Change: 固化 Flowise Unity 教程闭环工作流的迁移与复现规范

## Why

当前已经有一套在 Windows 本机跑通的 `Flowise + Custom MCP + LangGraph + Codex + AIBridge` Unity 教程闭环工作流，但真正可迁移的并不只是一个 `agentflowv2.json`。

这次经验已经暴露出几个关键事实：

- 只导入 JSON 不够，还必须同步迁移 MCP 工具脚本、LangGraph runner、重建脚本、模板、启动脚本，以及对 `flowise-components` 的 MCP timeout 补丁。
- 这套工作流必须保持 `Agentflow V2 + 多节点显式编排`，不能回退到单 MCP 巨型节点或旧版 v1 画布。
- Flowise Tool 节点会把布尔和数字参数当字符串传给 MCP；如果不在工具层兼容，迁移后会直接卡死在参数校验。
- MCP 默认 60 秒超时对教程验证和 Codex 修复远远不够；如果不在 `.env` 和 MCP 核心补丁里双重拉高超时，迁移后的长流程几乎必炸。
- V2 末端节点不能偷懒复用，否则会出现“前面都跑完了，末端结果卡片/截图/回复没触发，最后只吐中间 JSON”的假成功。

如果这些经验只留在聊天记录里，下一会话或下一台机器很容易重踩同样的坑。

## What Changes

- 新增一条专用 capability，定义 `Unity 教程闭环工作流` 在另一台 Windows 机器上的最小迁移包、迁移顺序与验收标准。
- 把 `Agentflow V2` 多节点编排、`MCP` 超时、参数类型兼容、末端分支独立、三轮修复结构写成正式 requirement。
- 把新机器必须调整的环境变量和 smoke test 标准写入 spec，避免只验证“接口 200”。

## Impact

- Affected specs: `flowise-unity-closed-loop`
- Affected code:
  - 暂无仓库内实现代码变更；本 change 当前只固化迁移规范，供下一会话和另一台机器复现时使用
  - 后续若真正落地实现，预期会涉及迁移包文档、脚本模板与外部 Flowise 目录的补丁说明
