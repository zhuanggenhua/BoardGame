## Context

这条 change 不在当前仓库里直接实现 Unity 教程闭环工作流，而是先把“另一台 Windows 电脑如何稳定复现已经跑通的工作流”写成可执行规范。

当前已知工作流对象是 `Unity 教程闭环工作流`，目标不是普通聊天，而是：

- 画布上可见的多节点编排
- MCP 承担本机真实执行
- LangGraph 承担长流程闭环
- Codex 承担改仓库
- AIBridge 承担 Unity 编辑器验证和截图

这意味着迁移时必须一起带走：

1. MCP 脚本
2. LangGraph runner
3. 重建脚本
4. Agentflow V2 模板
5. 启停与刷新配置脚本
6. `flowise-components` 里的 MCP 超时补丁

## Goals

- 把“可迁移工作流”定义成一组资产 + 运行约束，而不是单个 JSON。
- 明确这套工作流必须继续使用 `Agentflow V2` 的显式多节点形态。
- 把最容易复现失败的三个坑写成正式 requirement：
  - MCP 默认超时过短
  - Tool 节点参数类型被字符串化
  - 多个分支共用末端节点导致回复不稳定

## Non-Goals

- 不要求本 change 在当前仓库内直接实现 Unity、AIBridge 或外部 Flowise 安装目录。
- 不把这套 Unity/AIBridge 经验提升为整个仓库的全局默认。
- 不定义 Unity 业务逻辑本身，只定义工作流迁移和运行边界。

## Decisions

- Decision: 单独新建 capability，而不是继续塞进 `ai-repo-workbench`
  - Reason: 这里的 Unity、AIBridge、外部 Flowise 安装目录、Windows 迁移路径都属于专用场景，不应污染通用工作台 spec。

- Decision: `Agentflow V2 + 多节点显式编排` 是硬约束
  - Reason: 用户要的是“可见编排 + 可真实验证闭环”，不是一个内部偷偷调用 LangGraph 的单 MCP 外壳。

- Decision: 超时配置必须同时落 `.env` 和 MCP 核心补丁
  - Reason: 仅配置环境变量不足以覆盖当前踩到的长流程超时问题；迁移时必须把 SDK 请求超时一并固定。

- Decision: MCP 工具层必须兼容 Flowise Tool 节点的字符串化参数
  - Reason: 这是当前 Flowise V2 Tool 节点的实际行为，不兼容就会在新机器第一步直接挂掉。

- Decision: 结束分支必须各自独立末端节点
  - Reason: 这是当前 V2 调度稳定性的现实约束；共用末端节点会制造“中间 JSON 冒充最终结果”的假通过。

## Migration Bundle

迁移包至少必须包含：

- `diamond-digger-workflow-mcp.js`
- `diamond-digger-tutorial-graph.mjs`
- `rebuild-unity-agentflow-v2.js`
- `unity-tutorial-workflow.agentflowv2.json`
- `启动 Flowise.cmd`
- `停止 Flowise.cmd`
- `刷新 Unity 配置.cmd`
- `node_modules/flowise-components/dist/nodes/tools/MCP/core.js` 的补丁说明或补丁文件

## Recommended Canvas Shape

推荐继续保持三轮结构：

1. 开始
2. 场景测试 1
3. 教程验证 1
4. 项目快照 1
5. 结果评估 1
6. 检查 1
7. Codex 修复 1
8. 场景测试 2
9. 教程验证 2
10. 项目快照 2
11. 结果评估 2
12. 检查 2
13. Codex 修复 2
14. 场景测试 3
15. 教程验证 3
16. 项目快照 3
17. 结果评估 3
18. 截图 1 / 结果卡片 1 / 返回结果 1
19. 截图 2 / 结果卡片 2 / 返回结果 2
20. 截图 3 / 结果卡片 3 / 返回结果 3

## Migration Sequence

建议下一会话按这个顺序推进：

1. 固定 Node 20
2. 启动 Flowise 基础实例
3. 复制迁移包
4. 按新机器路径修正 `.env`
5. 重打 `MCP/core.js` timeout 补丁
6. 启动 Flowise
7. 运行 `rebuild-unity-agentflow-v2.js`
8. 打开 Agentflow V2 画布检查是否仍是多节点版
9. 先跑“只验证不实现”的 smoke test

## Validation Philosophy

验证通过不能只看 HTTP 200，至少要同时满足：

- 画布是显式多节点，不是单 MCP
- 调试窗口按节点顺序推进
- 最终回复不是中间 JSON
- 结果里带截图或截图链接
- 长耗时节点不会被 60 秒默认超时打断
