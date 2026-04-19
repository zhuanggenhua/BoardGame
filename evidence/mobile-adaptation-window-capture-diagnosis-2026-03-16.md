# 移动端适配窗口抓图诊断 2026-03-16

## 背景

当前会话继续尝试为移动端适配补截图证据。标准 `Playwright -> worker` 路径已知会被 `fork/spawn EPERM` 拦截，因此又补试了一条新的旁路：

- 不走 headless `--screenshot`
- 不依赖 `connectOverCDP()`
- 直接启动可见版 Edge 窗口
- 用 Win32 `PrintWindow` / `CopyFromScreen` 抓图

对应临时脚本：

- [test-mobile-evidence-window-capture.ps1](/D:/gongzuo/webgame/BoardGame/scripts/temp/test-mobile-evidence-window-capture.ps1)

## 本轮验证

### 1. 项目页面抓图

命令：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\temp\test-mobile-evidence-window-capture.ps1 `
  -Port 6175 `
  -Url "http://127.0.0.1:6175/play/smashup/tutorial?bgCapture=smashup-tutorial-mobile-landscape" `
  -OutputPath "D:\gongzuo\webgame\BoardGame\temp\tutorial-mobile-landscape-window-probe-no-ready.png" `
  -SkipReadyTitleCheck `
  -PostReadyDelayMs 15000
```

结果：

- 脚本返回成功
- 但落盘图片是纯白图

图片：

![tutorial-mobile-landscape-window-probe-no-ready](../temp/tutorial-mobile-landscape-window-probe-no-ready.png)

### 2. 与项目无关的对照页抓图

为了确认是不是项目页面自己白屏，再对 `https://example.com` 做完全相同的窗口抓图。

命令：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\temp\test-mobile-evidence-window-capture.ps1 `
  -Port 6178 `
  -Url "https://example.com" `
  -OutputPath "D:\gongzuo\webgame\BoardGame\temp\window-capture-example-com.png" `
  -SkipReadyTitleCheck `
  -PostReadyDelayMs 5000
```

结果：

- 脚本同样返回成功
- `example.com` 也被抓成纯白图

图片：

![window-capture-example-com](../temp/window-capture-example-com.png)

## 结论

最正确结论：

- 当前环境里，Win32 窗口抓图返回“成功”并不代表拿到了真实浏览器画面。
- 这条路线会把与项目无关的普通网页也抓成纯白图，因此它本身就是无效证据路径。
- 这不是 `smashup tutorial` 页面独有问题，也不是 `bgCapture` 自动布场逻辑单独失效。

换句话说，阻塞进一步收敛为：

1. `headless --screenshot` 路线会卡在浏览器平台通道 / 权限问题。
2. 可见窗口 + Win32 抓图路线会稳定产出无内容白图。
3. 当前环境下又少了一条可用的截图兜底方案。

## 本轮补强

为了避免后续把“纯白图”误判成成功，已给临时脚本补上空白图门禁：

- [test-mobile-evidence-window-capture.ps1](/D:/gongzuo/webgame/BoardGame/scripts/temp/test-mobile-evidence-window-capture.ps1)

新增行为：

- 抓图后会按网格采样像素
- 若整张图采样结果只有一种颜色，则直接报错
- 这样后续不会再把纯白无效图当成可交付证据

## 后续建议

当前最正确方案仍然不变：

- 切换到允许 `child_process` 且浏览器截图能力正常的本地终端或 CI runner
- 直接复跑既有移动端 E2E，刷新真实证据图

当前环境里不建议继续沿“窗口抓图”方向深挖，因为现在已经验证到：

- 这条路对 `example.com` 都是无效的
- 问题根本不在项目页面本身
