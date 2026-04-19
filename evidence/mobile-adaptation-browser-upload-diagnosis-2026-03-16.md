# 移动端适配浏览器自截图诊断 2026-03-16

## 本轮新增

- 前端新增开发态自动化 agent：
  - `src/components/system/MobileEvidenceCaptureAgent.tsx`
  - 支持 `bgCapture` 场景自动推进
  - 支持 `bgForceCoarsePointer=1` 强制走粗指针分支
  - 支持在场景 ready 后尝试用 `html2canvas` 自截图并上传到本地保存服务
- 新增 Smash Up 四人局移动端场景注入 helper：
  - `src/games/smashup/mobileEvidence.ts`
- 新增临时脚本：
  - `scripts/temp/test-mobile-evidence-screenshot.ps1`
  - `scripts/temp/test-mobile-evidence-window-capture.ps1`
  - `scripts/temp/test-mobile-evidence-save-server.mjs`
  - `scripts/temp/test-mobile-evidence-browser-upload.ps1`

## 已确认可行

- `vite` 可以在当前进程 inline 模式下正常启动。
- 开发态查询参数能被前端接收，相关代码已通过：
  - `npx eslint src/hooks/ui/useCoarsePointer.ts src/games/smashup/mobileEvidence.ts src/components/system/MobileEvidenceCaptureAgent.tsx src/App.tsx`
  - `npm run typecheck`
- GUI 版 Edge 可以被脚本拉起，并能拿到主窗口句柄。

## 已确认仍失败

### 1. 浏览器自身截图仍不可用

- `msedge --headless --screenshot`
- `chrome-headless-shell --screenshot`

结论：
- 仍会落到平台通道 / sandbox / mojo 层面的权限问题，无法稳定产图。

### 2. OS 层抓屏不可用

- `CopyFromScreen`
- `PrintWindow`

结论：
- 对正常网页和本地页面都只得到空白白图，不足以作为证据图。
- 当前无效示例：
  - `D:\gongzuo\webgame\BoardGame\temp\example-window-capture.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-tutorial.e2e\手机横屏下教程浮层不应跑出视口\tutorial-mobile-landscape.png`

### 3. 页面自截图上传链路尚未闭环

尝试链路：

1. GUI Edge 打开带 `bgCapture` 的页面
2. 页面内自动推进场景
3. 页面内加载 `html2canvas`
4. 将 PNG 通过 `fetch` POST 到本地保存服务

现象：

- 本地保存服务可正常启动并监听
- 但在超时时间内没有收到浏览器上传
- 因此未生成新证据图

## 当前结论

本轮已经把“缺图难补”的问题继续往前推进了一层：

- 不再只是停留在 “Playwright child_process EPERM”
- 现在已经额外排除了：
  - 浏览器自带命令行截图
  - OS 层窗口抓屏

但在当前环境下，浏览器侧仍然没有形成可审阅的最终 PNG 输出。

## 建议后续优先级

1. 直接切回允许标准浏览器截图 / Playwright worker 的本地终端或 CI runner，复用本轮已加好的 `bgCapture` 自动化入口补图。
2. 如果仍必须留在当前环境，优先继续排浏览器页内上传为什么没有打到 `test-mobile-evidence-save-server.mjs`：
   - 浏览器是否实际执行到 `MobileEvidenceCaptureAgent`
   - 外链 `html2canvas` 是否成功加载
   - 浏览器对 `fetch(http://127.0.0.1:<port>/save)` 是否被额外策略拦截
