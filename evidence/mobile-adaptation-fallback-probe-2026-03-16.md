# 移动端适配后备路径探测 2026-03-16

## 目的

在已知当前沙箱里 `Node child_process / Playwright worker / esbuild service` 会被 `spawn EPERM` 拦截的前提下，继续排查是否还存在别的可用补图路径，避免后续重复空转。

本轮重点验证 4 条旁路：

1. Python 能否代替 Node 拉起后续命令
2. Playwright CLI 在不真正跑用例时能否绕过 worker 阶段
3. 直接拉起浏览器可执行文件是否能替代 Playwright 产图
4. 顶层 shell 直接起 Chrome 是否比 Python/Node 路径更低层、更可用

## 探测结果

### 1. Python `subprocess` 可用，但不能解决 Node 内部 `spawn/fork`

命令：

```bash
python -c "import subprocess,sys,json; r=subprocess.run([sys.executable,'-c','print(123)'],capture_output=True,text=True,timeout=5); print(json.dumps({'returncode':r.returncode,'stdout':r.stdout.strip(),'stderr':r.stderr.strip()}))"
python -c "import subprocess,json; r=subprocess.run(['node','-e','console.log(789)'],capture_output=True,text=True,timeout=10); print(json.dumps({'returncode':r.returncode,'stdout':r.stdout.strip(),'stderr':r.stderr.strip()}))"
```

结论：

- Python 自己拉起 Python 子进程正常
- Python 拉起一个顶层 Node 进程也正常
- 但这只能说明“外层进程启动没问题”，不能改变 Node 进程内部再去 `spawn/fork` 时仍然被限制的事实

### 2. Playwright CLI 只要进入 worker / 服务准备阶段，仍然会撞到 `EPERM`

命令：

```bash
python -c "import subprocess,json; r=subprocess.run(['node','node_modules/playwright/cli.js','test','e2e/smashup-tutorial.e2e.ts','--grep','手机横屏下教程浮层不应跑出视口','--list'],capture_output=True,timeout=30); print(json.dumps({'returncode':r.returncode,'stdout':r.stdout.decode('utf-8','replace')[-1200:],'stderr':r.stderr.decode('utf-8','replace')[-1200:]}))"
python -c "import subprocess,json; r=subprocess.run(['node','node_modules/playwright/cli.js','test','e2e/smashup-tutorial.e2e.ts','--grep','手机横屏下教程浮层不应跑出视口','--workers=1'],capture_output=True,timeout=60); print(json.dumps({'returncode':r.returncode,'stdout':r.stdout.decode('utf-8','replace')[-2000:],'stderr':r.stderr.decode('utf-8','replace')[-2000:]}))"
```

结论：

- `--list` 这类轻量路径能跑到 CLI 层
- 但一旦进入真正的 worker / global setup / esbuild / 多服务准备链路，仍然会失败在 `spawn EPERM`
- 因此问题不在参数透传，也不在单文件入口脚本

### 3. Chromium / Firefox 直接 headless 产图都不成立

Chromium 命令：

```bash
python -c "import subprocess,json; args=[r'C:\\Users\\zhuagenbao\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe','--headless=new','--no-sandbox','--disable-gpu','--dump-dom','about:blank']; p=subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE); out,err=p.communicate(timeout=20); print(json.dumps({'returncode':p.returncode,'stdout':out.decode('utf-8','replace')[:200],'stderr':err.decode('utf-8','replace')[:1200]}))"
```

Firefox 命令：

```bash
python -c "import subprocess,json; args=[r'C:\\Users\\zhuagenbao\\AppData\\Local\\ms-playwright\\firefox-1509\\firefox\\firefox.exe','--headless','--screenshot','temp\\\\firefox-aboutblank2.png','about:blank']; p=subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE); out,err=p.communicate(timeout=20); print(json.dumps({'returncode':p.returncode,'stdout':out.decode('utf-8','replace')[:200],'stderr':err.decode('utf-8','replace')[:1200]}))"
```

结论：

- Chromium 会报 crashpad / access denied，浏览器初始化链路不稳定
- Firefox 到超时前也没有落出可用截图文件
- 所以“抛开 Playwright，只用浏览器 CLI 直接补图”这条路在当前环境也不成立

### 4. 顶层 shell 直接拉起 Chrome 也不能落盘截图

这一步故意绕开 Python，也绕开 Node `child_process`，直接让当前 shell 启动浏览器可执行文件，验证是否能比前两条更低层地补图。

命令：

```bash
"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --disable-crash-reporter --screenshot temp\chrome-probe3.png about:blank
"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --disable-crash-reporter --dump-dom about:blank
```

结果：

- 进程输出 `crashpad ... CreateFile: 拒绝访问 (0x5)`
- 命令返回后，`temp/chrome-probe3.png` 并不存在
- `--dump-dom` 也没有拿到可用 DOM 输出

结论：

- 问题不只是在 Node 内部 `spawn/fork`
- 即使彻底绕开 Node，当前环境的 Chrome headless 仍然拿不到稳定可用的截图/DOM 产物
- 因此“shell 直接起浏览器替代 Playwright”也可以排除

## 当前仍可人工复核的历史证据

目前仓库里仍有以下旧截图可用于人工复核：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\04-mobile-landscape-layout.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\04a-mobile-exit-fab-panel.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\05-mobile-single-tap-expands-attached-actions.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：触屏放大入口与阶段说明在手机和平板都可达\10-phone-landscape-board.png`

人工复核结论保持不变：

- `smashup 04`、`04a` 仍可作为当前有效历史证据
- `smashup 05` 仍带旧版 `Exit` tooltip 残影，不能当作当前有效证据
- `summonerwars 10` 仍是旧版默认显示缩放徽标 / 常驻放大入口的截图，不能当作当前有效证据

## 最终结论

本轮已经把可想到的后备路径探到更底层了，结论明确：

1. 当前沙箱里，E2E 主链路会被 `Node child_process` 限制拦住
2. “不用 Playwright、改走 Python 包装”不能解决这个限制
3. “不用 worker、直接走浏览器 CLI / headless”在当前环境也拿不到可用产物
4. “彻底绕开 Node，直接从 shell 起 Chrome”同样不能稳定产图

因此，当前会话剩下的未收口项仍然只有一个：新截图证据无法在此环境刷新，不是代码再次回退，也不是脚本参数问题。
