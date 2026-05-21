# Home V2 壳体素材本地包体验证

日期：2026-04-06

## 目标

- 核查 `home-v2` 书本壳、桌面底图、书签逐帧、翻页逐帧、holder 方框是否已从包体内本地资源正确显示
- 确认这批壳体素材运行时请求的是本地 `/assets/common/images/home-v2/...`
- 把缩略图链路与 `home-v2` 壳体素材链路分开，不再混为一个问题

## 本轮改动

- `src/pages/HomeV2Draft.tsx`
  - `HOME_V2_BOOK_DESK` 使用本地 `/assets/common/images/home-v2/book-desk/1.png`
- `src/components/lobby/GameList.tsx`
  - `HOME_V2_HOLDER_BG` 使用本地 `/assets/common/images/home-v2/holders/1.png`
- `src/ugc/runtime/ui-scene/scenes/homeV2BookScene.ts`
  - `book-idle`
  - `book-open`
  - `side-tabs-static`
  - `side-tabs-appear`
  - `page-flip-right`
  - `page-flip-left`
  - 全部使用本地 `/assets/common/images/home-v2/...`

## 验证命令

```powershell
npm run typecheck
npm run build
node scripts/infra/vite-cli-safe.mjs preview --host 127.0.0.1 --port 4276 --configLoader bundle
```

## 产物

- 截图：
  - `D:\gongzuo\webgame\BoardGame-wt-home-v2\test-results\home-v2-local-desktop.png`
  - `D:\gongzuo\webgame\BoardGame-wt-home-v2\test-results\home-v2-local-detail-desktop.png`
  - `D:\gongzuo\webgame\BoardGame-wt-home-v2\test-results\home-v2-local-mobile.png`
- 网络日志：
  - `D:\gongzuo\webgame\BoardGame-wt-home-v2\test-results\home-v2-local-network.json`
- 最新包体链路截图：
  - `D:\gongzuo\webgame\BoardGame-wt-home-v2\test-results\home-v2-packaged-desktop.png`
- 最新包体链路网络日志：
  - `D:\gongzuo\webgame\BoardGame-wt-home-v2\test-results\home-v2-packaged-network.json`

## 肉眼观察

### 桌面总览

- 深色木桌背景已经出现，不再是单色暗底。
- 摊开的书本壳已经完整出现，左右页、书脊、右侧书签都可见。
- 左页 4 张卡片在书页内部，holder 方框已经出现，没有之前左上角破图图标。
- 右页目前仍为空白页，这是当前布局/交互实现状态，不是资源缺失。

### 桌面详情

- 点击第一页卡片后，仍然使用同一本书进入详情，没有再出现第二本书叠底。
- 左页详情文案与右页房间占位都在书页内部。
- 书本底图、壳体、书签仍然保持显示，没有因为状态切换掉图。

### 移动横屏

- 木桌背景与摊开书本都已显示。
- 左页 4 张卡片都在书页内，右页空白。
- 相比桌面，书本在横屏下仍明显可见，未退化成只有卡片和纯背景。

## 请求数据结论

对 `test-results/home-v2-packaged-network.json` 统计结果：

- 本地 `http://127.0.0.1:4278/assets/common/images/home-v2/...` 成功响应：`25`
- `home-v2` 远端请求数：`0`
- `requestfailed`：`0`
- `4xx/5xx`：`0`

结论：

- `home-v2` 壳体素材当前正确运行路径是包体内本地 `/assets/common/images/home-v2/...`
- 当前页面没有请求 `assets.easyboardgame.top/official/common/images/home-v2/...`
- 书本壳、桌面底图、书签逐帧、翻页逐帧、holder 方框均由包体内本地资源提供

## 还剩的相邻问题

- 游戏缩略图仍走各自原有链路，不属于这次 `home-v2` 公共素材缺失问题。
- 当前桌面总览里，`卡迪亚 / 大杀四方 / 召唤师战争` 的缩略图视觉上仍显得发白或被裁切，这是卡片内部缩略图呈现问题，不是本次 `home-v2` 本地素材请求失败。

---

## 2026-04-17 补充：丢失素材回找与重新落地

### 新发现

- 当前首页 V2 退化的根因不是 `HomeV2Draft -> HomeV2` 拆分，而是 `public/assets/common/images/home-v2/**` 本地素材整批丢失。
- `.gitignore` 之前同时忽略了：
  - `public/assets/**`
  - `**/*.png`
  - `public/**/*.webp`
- 这导致 `home-v2` 壳体素材即使恢复到本地，也不会自动进入 Git 跟踪。

### 本轮处理

- 修改 `.gitignore`，显式放行：
  - `public/assets/common/images/home-v2/`
  - `public/assets/common/images/home-v2/**`
- 通过 R2 前缀 `official/common/images/home-v2/` 回找素材，成功恢复本地 `compressed/*.webp` 共 `57` 个文件，包括：
  - `book-desk`
  - `book-idle`
  - `book-open`
  - `book-close`
  - `side-tabs-static`
  - `side-tabs-appear`
  - `page-flip-left`
  - `page-flip-right`
  - `holders`

### 本轮验证

```powershell
npm run typecheck
node scripts/infra/run-e2e-single.mjs ci e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"
```

### 本轮截图

- `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-catalog-return.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-detail-open.png`

### 本轮肉眼观察

#### 目录页

- 深色木桌背景重新出现，不再是之前那种只剩暗底和内容层的退化画面。
- 摊开的书本壳、书脊和右侧书签都已恢复，说明 `book-desk / book-idle / side-tabs-*` 链路重新接通。
- 左页的 holder 方框重新出现，说明 `holders/compressed/1.webp` 已被页面重新吃到。

#### 详情页

- 进入井字棋详情后，依旧使用同一本书的双页结构，没有退化成“纯文字 + 空白底”的状态。
- 右页房间簿容器和底部按钮装饰重新出现，说明书本底图与 detail 视图共用壳体已经恢复。
- 当前仍可看到部分游戏缩略图是白块，这是缩略图资源自身问题，不是本轮 `home-v2` 壳体素材回找失败。

### 结论

- `home-v2` 书本壳素材已经重新找回并落回本地。
- 当前首页 V2 的“书本没了”回归已被纠正。
- 这批素材现在不再被 `.gitignore` 吞掉，后续可以直接纳入 Git 跟踪。
