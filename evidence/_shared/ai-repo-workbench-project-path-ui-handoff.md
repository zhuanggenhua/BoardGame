# AI Repo Workbench `projectPath` UI 收尾记录

## 本轮完成

- 官方 Chatbot 入口补了“运行上下文”卡片，允许直接填写 **目标项目目录**。
- 该目录会持久化到浏览器 `localStorage`，刷新或 reset 后仍保留。
- 发送消息时会自动把 `项目目录: <path>` 前缀注入到聊天输入，供后续 Flowise 子流解析。
- `aiRepoWorkbenchSeed.ts` 的结构化输入解析器已新增 `projectPath` 提取逻辑，并修正素材路径兜底识别，避免把 `项目目录` 误判成 `图包路径`。
- 外部 `flowise-fork` 的本地启动脚本已修正为独立仓路径，并补齐 `node_modules` 缺失时的自动安装门禁。

## 已验证

- `npm run typecheck`：通过
- `npx eslint e2e/_shared/lobby.e2e.ts e2e/smashup/navbar.e2e.ts`：0 error
- `npx eslint ..\flowise-fork\packages\server\src\enterprise\dev\aiRepoWorkbenchSeed.ts`：0 error（仅保留文件既有 warnings）
- `npm run test:e2e:ci:file -- e2e/smashup/navbar.e2e.ts`：2 passed
  - 已验证官方聊天页存在 `目标项目目录` 输入框
  - 已验证发送时真实注入 `项目目录: D:\gongzuo\webgame\BoardGame`
  - 已验证 reset 后会话清空，但 `projectPath` 输入仍保留

## 当前仍未完全证明的点

- 目前已经证明 **UI -> prediction 请求** 这条 `projectPath` 注入链路成立。
- 但还没有单独补一条“执行器实际 cwd / 产物真实落到目标项目目录”的浏览器级证据，因此 OpenSpec 里的 `4.4` 仍建议保留为“未完全收口”。

## 下次若要继续补终证据

1. 在官方聊天页填写一个和工具仓库不同的真实目标目录。
2. 发送一次会触发实施/审计/上传阶段的请求。
3. 同步抓取执行器日志或目标目录侧的落地产物。
4. 明确证明这些阶段的 cwd 与产物路径确实落到该目录，而不是只停留在聊天输入前缀层。
