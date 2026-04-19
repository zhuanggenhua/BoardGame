# AI Repo Workbench 会话壳回归

日期：2026-04-06

## 当前收口方向

本轮不再把 `/dev/ai-repo-workbench` 做成外层运行面板。

当前目标改为：

- 外层采用接近 OpenClaw 的会话壳
- 外层只负责历史会话、继续处理、启动新会话
- 工作流配置不再放在外层表单里
- 人工决策、节点暂停、产物返回都在工作流线程内部继续
- Flowise 总控 / 模块列表只保留调试入口

## 静态检查

执行：

```powershell
pnpm exec eslint src/pages/devtools/AIRepoWorkbench.tsx
npm run typecheck
```

结果：

- 通过

## 浏览器隔离回归

本轮使用隔离实例验证，避免被共享开发端口上的旧实例污染：

- 前端：`http://127.0.0.1:4277/dev/ai-repo-workbench`
- API：`http://127.0.0.1:18021`

### 回归 0：API 真链路已打通

直接调用隔离 API：

```json
{
  "resetRuns": 0,
  "resetTurns": 0,
  "startedRuns": 1,
  "startedStatus": "waiting_decision",
  "startedDecisionCount": 1,
  "afterDecisionStatus": "completed",
  "afterDecisionDecisionOpen": 0,
  "afterDecisionArtifactCount": 1
}
```

人工结论：

- `reset` 后 runs 和 conversation turns 都归零，说明清空不是假动作。
- `start` 后立即进入 `waiting_decision`，并生成 `prompt + status + decision_request` 三类会话消息。
- `submitDecision` 后 run 真实进入 `completed`，并生成 artifact，而不是只在前端本地拼一条假消息。

### 回归 1：外层已收敛成会话壳

Playwright 实测摘要：

```json
{
  "heading": "创建派系流程",
  "hasTemplateSelect": false,
  "hasTextarea": false
}
```

人工结论：

- 页面标题已经回到 `创建派系流程`，不再是我上一版那种“工作台启动任务”大面板语义。
- 外层已经移除工作流模板下拉和任务说明大文本框，说明“工作流配置不在壳层做”已经落地。
- 主区域现在是一整块对话线程，顶部只有轻量标题，线程底部只有一个“开始新对话”输入器，没有额外运行摘要卡或外层配置卡。
- 左侧被压成会话列表和调试入口两块，调试入口已经下沉，不再与主线程抢主视角。

### 回归 2：仍可直接从会话壳启动新流程

Playwright 实测摘要：

```json
{
  "subject": "OpenClaw式会话-1775467099539",
  "hasSubject": true,
  "hasDecisionPanel": true,
  "hasTemplateSelectAfterStart": false,
  "hasTextareaAfterStart": false
}
```

人工结论：

- 在最下方 `启动会话` 卡里只输入目标对象后，可以直接发起新流程。
- 新流程启动后，页面立即进入 `选择规则来源` 的决策态，说明流程内的人审链路还在。
- 启动后页面仍然没有回退到模板选择或大文本配置面板，说明“配置留在流程里”的约束没有被破坏。
- 决策卡只展示用户需要判断的说明和选项，没有再把 payload JSON 这类配置细节直接摊在主视角里。

### 回归 3：端到端清空 / 启动 / 决策 / 产物 / 再清空

Playwright 实测摘要：

```json
{
  "afterReset": {
    "historyCount": 0,
    "turnCount": 1
  },
  "afterCompleted": {
    "artifactPanelCount": 1,
    "decisionPanelCount": 0,
    "historyCount": 1,
    "hasSelect": 0,
    "textareaCount": 0
  },
  "afterClearAgain": {
    "historyCount": 0,
    "emptyStateCount": 1,
    "inputValue": ""
  }
}
```

人工结论：

- 点击 `清空会话` 后，左侧历史会话立即归零，主线程回到空状态，说明清空链路已真实生效。
- 启动新对话并提交决策后，artifact 直接回到同一条对话线程内，左侧历史列表同步增加 1 条，不存在“跳到另一个运行面板”。
- 完成后再次点击 `清空会话`，历史会话再次归零，输入框值也被清空，说明“开始新对话”和“清空记录”可以反复工作。

## 截图证据

截图路径：

- `D:\gongzuo\webgame\BoardGame-wt-ai-repo-workbench\test-results\evidence-screenshots\_shared\flowise-ai-repo-workbench\ai-repo-workbench-conversation-shell.png`
- `D:\gongzuo\webgame\BoardGame-wt-ai-repo-workbench\test-results\evidence-screenshots\_shared\flowise-ai-repo-workbench\ai-repo-workbench-conversation-started.png`
- `D:\gongzuo\webgame\BoardGame-wt-ai-repo-workbench\test-results\evidence-screenshots\_shared\flowise-ai-repo-workbench\ai-repo-workbench-e2e-waiting-decision.png`
- `D:\gongzuo\webgame\BoardGame-wt-ai-repo-workbench\test-results\evidence-screenshots\_shared\flowise-ai-repo-workbench\ai-repo-workbench-e2e-artifact.png`
- `D:\gongzuo\webgame\BoardGame-wt-ai-repo-workbench\test-results\evidence-screenshots\_shared\flowise-ai-repo-workbench\ai-repo-workbench-e2e-cleared.png`

人工观察：

- 第一张图里，主区已经是一整块聊天线程，上半部依次是系统提示、用户消息、工作流状态消息和决策卡，底部只有一个启动输入器，视觉上已经是“对话主视角”。
- 第一张图里，左侧只保留会话列表和 Flowise 调试入口，调试入口已经明显下沉，不会把用户拉回外层配置心智。
- 第二张图里，新建的主题已经进入主线程和左侧会话列表，说明新对话是直接在同一会话壳内启动，而不是跳到另一个运行面板。
- 第二张图里，决策卡只保留选项说明和继续按钮，没有把模板选择、节点配置或 JSON 配置块重新带回主视角。
- 第三张图里，工作流停在决策态时，整页仍旧是同一条对话线程，决策卡只是线程中的一个节点，没有额外弹出外层配置页。
- 第四张图里，artifact 已经在同一主线程内展示，并带两张 E2E 图片预览，决策卡已消失，说明流程继续推进后主视图没有跳转。
- 第五张图里，清空后左侧历史为 0，主线程回到空状态，底部输入器保持可直接发起下一轮，说明“清空记录”已真正可用。

## E2E 补充说明

我尝试执行现有用例：

```powershell
npm run test:e2e:ci:file -- lobby.e2e.ts "AI 仓库工作台可从工具入口进入并完成 new-faction 纵切片"
```

结果：

- 本次没有进入页面断言阶段
- 阻塞原因是共享 single-worker E2E 端口 `6273 / 20100 / 21100` 已被其他 worktree 占用
- 这不是本页代码报错，而是测试基础设施资源冲突

因此本轮验收以：

- 静态检查通过
- 隔离前后端实例真实运行
- Playwright 浏览器脚本实际启动新会话
- 肉眼查看截图

作为当前证据闭环
