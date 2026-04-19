# Android App 本地素材包图片加载/回退修复证据

## 范围
- 问题：Android App 下载素材包后，游戏页图片没有稳定优先使用本地包；当本地包缺图时，UI 会去掉 shimmer，但背景图仍指向失效的本地 `_capacitor_file_` URL，导致用户看到“加载中/空白卡面”。
- 本次验证场景：`smashup` 选派系页，模拟器 `emulator-5560`，应用 `top.easyboardgame.app.debug`。

## 根因
不是 Capacitor 不能读取 `_capacitor_file_`，而是 `AtlasCard` 的“已加载候选 URL”判定错了：

1. 图集 fallback 成功时，组件会把**逻辑 atlas key**（如 `smashup/cards/aiji`）也缓存成“已加载”。
2. 旧逻辑随后用 `isImagePreloaded`/缓存别名判断候选 URL 是否已加载。
3. 这会把**未真正加载成功的本地 `_capacitor_file_` 候选**误判成已加载。
4. 最终 shimmer 被移除，但 `background-image` 仍写成失效的本地 URL，页面表现就是空白/一直像没图。

## 修复
修改文件：
- `D:\gongzuo\webgame\BoardGame\src\components\common\media\CardPreview.tsx`
- `D:\gongzuo\webgame\BoardGame\src\components\common\media\__tests__\CardPreview.i18n.test.tsx`

修复点：
- 为 atlas 候选新增“真实已加载 URL”解析：优先读取缓存图片元素的 `currentSrc/src`，再和候选列表逐一匹配。
- 只有命中**真实加载成功的候选 URL**时，才把该 URL 作为 `background-image`。
- 这样：
  - 本地包文件真实存在 → 继续走 `_capacitor_file_`。
  - 本地包缺图 → 正确切到远端 CDN 候选，而不是误回写成失效本地 URL。

## 静态验证
### ESLint
命令：
```powershell
npx eslint src/components/common/media/CardPreview.tsx src/components/common/media/__tests__/CardPreview.i18n.test.tsx
```
结果：0 errors，只有既有 fast-refresh warnings。

### Vitest
命令：
```powershell
npx vitest run src/components/common/media/__tests__/CardPreview.i18n.test.tsx --reporter=verbose
```
结果：9 个用例全部通过。

新增关键测试：
- `图集仅命中远端回退缓存时，背景图应使用真实加载成功的候选 URL`

## Android 模拟器验证
### 构建与安装
命令：
```powershell
npm run mobile:android:build:debug
adb -s emulator-5560 install -r D:\gongzuo\webgame\BoardGame\android\app\build\outputs\apk\debug\easyboardgame-debug.apk
```

### 验证方法
- 模拟器内保留一个**故意不完整**的 `smashup` 本地包，只包含 `cards1.webp`，不包含 `aiji.webp`、`cards4.webp` 等。
- 这样可以同时验证：
  1. 本地命中的素材是否真的走 `_capacitor_file_`
  2. 本地缺失的素材是否真的切到远端 CDN，而不是空白
- 通过 WebView CDP 读取 24 个派系列表项的实际 `background-image` URL，并逐项 `fetch` 验证 HTTP 状态。

### 验证结果
产物：
- 截图：`D:\gongzuo\webgame\BoardGame\test-results\android-smashup-asset-fallback-fix\screen.png`
- DOM 检查：`D:\gongzuo\webgame\BoardGame\test-results\android-smashup-asset-fallback-fix\inspect.json`

关键结论：
- 共检查 24 个派系列表项。
- 其中：
  - 4 个条目实际使用本地包 `_capacitor_file_` URL，状态都是 `200`
  - 20 个条目实际使用远端 CDN URL，状态都是 `200`
  - 失败条目数 `0`
- 示例：
  - `pirates` / `ninjas` / `dinosaurs` / `aliens` → 本地包 `cards1.webp`，`200`
  - `ancient_egyptians` / `cowboys` / `samurai` → 远端 CDN `aiji.webp`，`200`
  - `robots` / `zombies` / `wizards` → 远端 CDN `cards4.webp`，`200`

## 结论
本轮修复后，Android App 在同一页面内已经同时证明：
1. **本地已有素材会优先走 `_capacitor_file_`**
2. **本地缺失素材会切到远端 CDN，而不是继续指向坏掉的本地 URL**
3. **24/24 个派系列表项最终背景图 URL 都返回 200，没有再出现“去掉 shimmer 但背景还是坏本地图”的情况**
