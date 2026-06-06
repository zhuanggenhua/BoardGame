## 1. Scope

- [x] 1.1 明确当前目标是“另一台 Windows 电脑复现 Unity 教程闭环工作流”，不是普通聊天接入。
- [x] 1.2 明确这条 change 只固化迁移规范，不在本仓库内直接实现 Unity/AIBridge 运行时。

## 2. Migration Bundle

- [x] 2.1 把必须带走的 MCP、LangGraph、模板、脚本和补丁文件写进 spec。
- [x] 2.2 明确 `flowise-components/dist/nodes/tools/MCP/core.js` 补丁在重新安装后会丢失，迁移时必须重补。

## 3. Workflow Shape

- [x] 3.1 把 `Agentflow V2`、`Start / Tool / Condition / DirectReply` 作为推荐节点集合写入 spec。
- [x] 3.2 明确禁止回退到 v1、单 MCP 巨型节点或“画布可见但逻辑都塞工具内部”的伪编排。
- [x] 3.3 把三轮闭环结构和独立末端分支写入 spec。

## 4. Runtime Hazards

- [x] 4.1 把 MCP 默认 60 秒超时问题和双重修复方式写入 spec。
- [x] 4.2 把 Flowise Tool 节点参数字符串化兼容策略写入 spec。
- [x] 4.3 把“多个分支不要共用同一个结束节点”的稳定性约束写入 spec。

## 5. Validation

- [x] 5.1 写入新机器必须修改的关键环境变量。
- [x] 5.2 写入推荐迁移顺序和首轮 smoke test 文案。
- [x] 5.3 写入“验证通过”的多条件门禁，避免只看接口 200。
- [x] 5.4 运行 `openspec validate add-flowise-unity-closed-loop-migration --strict --no-interactive`。
