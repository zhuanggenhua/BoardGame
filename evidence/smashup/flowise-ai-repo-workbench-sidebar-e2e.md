# Flowise AI 仓库工作台侧边栏与官方聊天页验收

日期：2026-04-09

## 验收范围

- Flowise 内部侧边栏只保留一个 `AI 仓库工作台` 入口。
- 点击入口后直接进入官方聊天页 `/chatbot/0f1e2d3c-4b5a-6789-8abc-def012345670`。
- 官方聊天页顶部必须提供 `目标项目目录` 输入框，并在发送时自动把该目录注入聊天输入。
- 官方聊天页发送一条 external 会话消息后，点击右上角 `Reset Chat`，应同时满足：
  - external 本地会话键被清空
  - 服务端 external 聊天记录被删除
  - 欢迎态恢复
  - 输入框恢复为空并回到 placeholder

## 实测环境

- Flowise Server：`http://127.0.0.1:3100`
- Flowise UI：`http://127.0.0.1:3101`
- 主 flowId：`0f1e2d3c-4b5a-6789-8abc-def012345670`

## 关键链路结果

### 1. 侧边栏入口可见且直达官方聊天页

截图路径：

- `D:\gongzuo\webgame\BoardGame-wt-ai-repo-workbench\test-results\evidence-screenshots\smashup\flowise-ai-repo-workbench\左侧页签应直达-AI-Repo-Workbench-官方聊天页并支持-projectPath-+-reset-01-sidebar-entry-visible.png`
- `D:\gongzuo\webgame\BoardGame-wt-ai-repo-workbench\test-results\evidence-screenshots\smashup\flowise-ai-repo-workbench\左侧页签应直达-AI-Repo-Workbench-官方聊天页并支持-projectPath-+-reset-02-chatbot-entry-visible.png`

人工观察：

- 左侧菜单中存在单独的 `AI 仓库工作台` 项，位置在 `代理流` 下方，不再是额外自定义壳页面。
- 右侧主区域仍是官方 `代理流` 列表卡片，没有再出现外部工作台总览页。
- 点击 `AI 仓库工作台` 后，页面进入蓝顶栏的官方聊天页，而不是旧的 `/ai-repo-workbench` 自定义线程页。
- 聊天页顶部出现独立的 `运行上下文` 卡片，包含 `目标项目目录` 输入框和“恢复默认”按钮，说明 `projectPath` 已经进入官方聊天页主链路，而不是继续藏在外部自定义壳里。
- 底部输入框 placeholder 为“例如：为大杀四方新增一个海盗主题派系，并说明希望参考的派系风格。”，右上角 reset 图标可见，符合“官方聊天页 + 轻量上下文输入”的目标。

### 2. 发送后确实创建 external 会话

截图路径：

- `D:\gongzuo\webgame\BoardGame-wt-ai-repo-workbench\test-results\evidence-screenshots\smashup\flowise-ai-repo-workbench\左侧页签应直达-AI-Repo-Workbench-官方聊天页并支持-projectPath-+-reset-03-chatbot-after-send.png`

人工观察：

- 顶部 `目标项目目录` 输入框中已经回填 `D:\gongzuo\webgame\BoardGame`，说明 UI 持久化的上下文已在发送前生效。
- 右侧蓝色用户消息气泡同时出现 `项目目录: D:\gongzuo\webgame\BoardGame` 与本次 marker，说明官方聊天页发送前确实把 `projectPath` 注入到了最终问题文本。
- 底部输入框中仍可看到同样的两行内容，右上角 reset 图标处于可用状态，说明当前 external 会话已真实创建。

### 3. Reset 后 external 会话被删且欢迎态恢复

截图路径：

- `D:\gongzuo\webgame\BoardGame-wt-ai-repo-workbench\test-results\evidence-screenshots\smashup\flowise-ai-repo-workbench\左侧页签应直达-AI-Repo-Workbench-官方聊天页并支持-projectPath-+-reset-04-chatbot-after-reset.png`

人工观察：

- 发送后的蓝色用户消息气泡已经消失，页面重新回到只有欢迎语的空白聊天态。
- 底部输入框已清空，不再残留 marker，placeholder 恢复为初始引导文案。
- 右上角 reset 图标回到禁用态，对应“当前没有活跃 external 会话”的状态。
- 顶部 `目标项目目录` 输入框仍保留刚才填写的目录，说明 reset 只清会话，不会把运行上下文输入误清空。

## 自动化抓取到的关键事实

Playwright 本轮结果：

```json
{
  "beforeReset": {
    "resetDisabled": false
  },
  "afterReset": {
    "textareaValue": "",
    "placeholder": "例如：为大杀四方新增一个海盗主题派系，并说明希望参考的派系风格。",
    "resetDisabled": true
  }
}
```

请求链路命中：

```text
GET    /api/v1/public-chatbotConfig/0f1e2d3c-4b5a-6789-8abc-def012345670    -> 200
POST   /api/v1/prediction/0f1e2d3c-4b5a-6789-8abc-def012345670              -> 200
DELETE /api/v1/public-chatbotConfig/0f1e2d3c-4b5a-6789-8abc-def012345670/chatmessage?chatId=2c91982d-89d1-42ed-b52c-77bf09771cc5&chatType=EXTERNAL -> 200
GET    /api/v1/public-chatbotConfig/0f1e2d3c-4b5a-6789-8abc-def012345670    -> 200
```

人工结论：

- reset 不再调用需要后台登录权限的 `/api/v1/chatmessage/:id`，而是走公开 chatbot 自己的 external 删除接口。
- 删除接口返回 `200`，与截图中的欢迎态恢复、输入框清空一致。
- `projectPath` 通过官方聊天页 UI 直接注入到了提交问题里，说明这条链路已经不再依赖旧外壳。
- 本轮验收口径已经满足“内部只提供去 Flowise 配置的入口，外部主区域不再继续堆自定义工作台线程”。
