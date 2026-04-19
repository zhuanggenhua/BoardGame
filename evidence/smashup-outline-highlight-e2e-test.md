# 大杀四方描边边界验收

## 范围

- 验证基地高亮描边只作用于基地卡框，不把右上角记分 token 一起包进描边。
- 验证随从高亮描边只作用于随从卡框，不把力量徽章、附件等外置 UI 一起包进描边。

## 执行方式

- 由于项目标准 `Playwright global-setup` 在当前机器上存在独立环境故障：
  - Docker 不可用，常规 Mongo 无法启动。
  - 即使用 `mongodb-memory-server` 顶住 Mongo，标准 E2E bootstrap 仍会在 API/worker 启动阶段出现 `spawn UNKNOWN` 与 Node OOM。
- 本次验收改为直接启动：
  - `npm run dev:game:lite`
  - `npm run dev:frontend -- --host 127.0.0.1 --port 6174`
  - 随后用内联 Playwright 浏览器脚本访问 `/play/smashup?p0=aliens,pirates&p1=ninjas,dinosaurs&seed=24680`
- 浏览器脚本在页面内使用 `window.__BG_TEST_HARNESS__.state.patch(...)` 注入基地选择与随从选择交互态，并执行 DOM 断言：
  - 基地：`tokenIsOutsideHighlight === true`
  - 随从：`hasDetachedUiSiblings === true`
- 为避免外部 CDN 资源拖慢加载，脚本把 `assets.easyboardgame.top` 卡图资源替换为 1x1 占位 PNG；因此本次验收重点是布局、层级、描边边界，而不是牌面美术。

## 证据截图

- 基地描边截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\manual-smashup-outline-highlight\smashup-outline-base-highlight.png`
- 基地描边 + 放大镜截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\manual-smashup-outline-highlight\smashup-outline-base-highlight-magnifier.png`
- 随从描边截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\manual-smashup-outline-highlight\smashup-outline-minion-highlight.png`

## 肉眼观察结论

### 基地描边

- 中间基地的金色高亮只沿着白色基地卡框一圈发光，没有把右上角圆形 `/20` 记分 token 包进同一个描边轮廓。
- 右上角记分 token 明显悬浮在基地卡框外，和高亮边框之间留有间隔，不再形成“基地卡框连着记分 UI 一起描边”的视觉。
- 基地下方两个小型持续行动槽位也没有被高亮边框吞进去，说明描边确实收缩到了卡框层。
- 左侧基地左上角的放大镜按钮现在也是基地外层的悬浮兄弟节点，视觉上贴着卡面角落，但没有被金色描边包进同一轮廓。
- 针对放大镜又做了一轮 DOM 断言：`inspectOutsideHighlight === true`，说明放大镜节点和基地记分 token 一样，都已经脱离高亮卡框 DOM 子树。

### 随从描边

- 左侧基地下方的随从出现独立紫色描边，描边只贴着随从卡框，不再沿着力量徽章/附件外延去包一整块区域。
- 随从左下的力量数值徽章与顶部/侧边外置装饰都在紫色卡框描边之外，视觉上已经和“被描边主体”分离。
- 中间基地仍保持自己的金色基地高亮，说明基地描边与随从描边现在各自作用于独立卡框层，没有串成一体。

## 结果

- DOM 结构断言通过。
- 浏览器截图人工复核通过。
- 本轮用户指出的两个问题在截图中都未复现：
  - 基地描边不再连着记分 UI。
  - 随从描边不再连着外置图标/徽记。

## 残留风险

- 仓库内标准 `npm run test:e2e:ci:file` 链路当前仍受本机 bootstrap 环境问题影响，未能在这次机器状态下完成同路径复跑；问题不在本次描边修复本身，而在测试基础设施的 Mongo / worker 启动稳定性。
- 本次截图使用占位卡图，不验证真实牌面美术，只验证布局、层级和描边边界。
