## 2026-05-12 进度：Home V2 turn.js 翻页先提交 checkpoint
- **Status:** committed_checkpoint
- **Action:** 用户确认当前插件翻页“效果还行，可以先提交一版”。本 checkpoint 保留 turn.js 插件方案、完整书本壳底层、翻页专用空白纸面 stage，不再回到序列帧或自制 CSS 纸片。
- **Decision:** 翻页中间态继续隐藏真实目录/详情业务 UI，只让 turn.js 页片承载纸面材质；稳态再恢复真实 UI。原因是把 live UI 或冻结 UI 塞进 turn.js page 后，插件会直接改写 page-wrapper 的 `position/overflow/transform/z-index`，业务组件原有的绝对定位、缩放基线、hover/按钮层和滚动容器会被重新投影到翻页局部坐标系里，肉眼表现就是 UI 乱飞、镜像、错层或被裁切。
- **Verification retained:** 本轮已跑过 `eslint`、`typecheck`、指定 E2E，并人工复看 2026/5/12 08:32 生成的正反向 `25 / 50 / 75` 六帧；书壳、书脊、封边、底部书签在翻页中保持可见。
- **Commit scope:** 只提交 Home V2 turn.js 翻页相关组件、页面接线、E2E 抓帧、证据/进度文档和本地 vendor 脚本；不提交其它工作区脏改。

## 2026-05-12 进度：Home V2 翻页回到 turn.js 插件
- **Status:** completed
- **Action:** 用户明确否定“序列帧”方案后，停止把 `page-flip-left/right` 当完成口径；将 `FoldLinePageFlipStage.tsx` 改回真实 turn.js 可见 flipbook，并让插件页只承载翻页纸面，不承载业务 UI。
- **Result:** 当前翻页态真实加载 `jquery 1.12.0` + `turn.js 4.1.0`，使用 `display: double`、`next/previous` 驱动；抓帧日志会输出插件 `page/view/animating/page-wrapper`。同时给 turn.js `turnPage` 动画加线性 easing 补丁，修掉默认 ease-out 导致 25% 只剩窄边的问题。
- **Follow-up fix:** 用户指出“翻页的时候书本消失了”后，补回 flipping state 的完整书本壳底层；turn.js 仍只覆盖内页区域，最新截图里外层封边、书脊和底部书签都保持可见。
- **Supersedes:** 2026-05-11 的“序列帧修正证据”已被用户否定，只保留为历史过程，不再作为收口依据。
- **Verification:**
  - `npx ctx7@latest library turn.js "Home V2 use turn.js plugin display double page flip page numbering events turn next previous freeze progress"`
  - `npx ctx7@latest docs /websites/turnjs "turn.js display double page numbering view next previous events turning turned options duration gradients elevation"`
  - `npx eslint src/components/home-v2/FoldLinePageFlipStage.tsx src/pages/HomeV2Draft.tsx src/pages/HomeV2.tsx e2e/lobby.e2e.ts`
  - `npm run typecheck`
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=600000 PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 BG_HOME_V2_VIEWPORT=2388x1080 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"`
- **Screenshots reviewed:**
  - `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-to-detail-25.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-to-detail-50.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-to-detail-75.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-back-to-catalog-25.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-back-to-catalog-50.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-back-to-catalog-75.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-detail-entry.png`

## 2026-05-11 进度：Home V2 翻页改为真实序列帧（已被 2026-05-12 turn.js 插件方案取代）
- **Status:** completed
- **Action:** 用户指出 CSS 纸片“明显就不像翻页”后，停止继续调透视参数，把翻页可见层改为项目已有 `page-flip-left/right` 序列帧；翻页过程中隐藏业务 UI，只显示书页背景与纸张翻动帧。
- **Result:** `FoldLinePageFlipStage.tsx` 现在按 `progress` 映射 8 帧序列图，正向用 `page-flip-left`，反向用 `page-flip-right`；并修正序列帧第一次接入时“中间小书盖大书”的比例问题。最终六帧肉眼可见页边、阴影和跨书脊翻动关系，不再是平面滑片。
- **Residual risk:** 现有序列帧素材分辨率偏低，放大到 2388x1080 后仍有颗粒感；这是素材质量风险，不是当前翻页语义错误。
- **Verification:**
  - `npx eslint src/components/home-v2/FoldLinePageFlipStage.tsx src/pages/HomeV2Draft.tsx src/pages/HomeV2.tsx e2e/lobby.e2e.ts`
  - `npm run typecheck`
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=600000 PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 BG_HOME_V2_VIEWPORT=2388x1080 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"`
- **Screenshots reviewed:**
  - `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-to-detail-25.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-to-detail-50.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-to-detail-75.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-back-to-catalog-25.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-back-to-catalog-50.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-back-to-catalog-75.png`

## 2026-05-10 进度：Home V2 多帧翻页语义收口（25/50/75）
- **Status:** completed
- **Action:** 按用户要求把翻页验收从单张 50% 扩展为正反向 `25 / 50 / 75` 六帧，并修正“两边都显示”的结构错误。
- **Result:** `FoldLinePageFlipStage.tsx` 的翻页态已改成“目标完整 spread 在底层 + 单张来源离场页片在顶层”；离场页片随进度从大到小收缩，25/50/75 不再是同一张静态左右拼接画面。
- **Cleanup:** 最终删除旧 `CornerCurlOverlay` / `FoldGeometry` / `PageViewport` / shell-stage 接口残留；清理后重新跑过静态检查与同一条多帧 E2E。
- **Verification:**
  - `npx eslint src/components/home-v2/FoldLinePageFlipStage.tsx src/pages/HomeV2Draft.tsx src/pages/HomeV2.tsx e2e/lobby.e2e.ts`
  - `npm run typecheck`
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=600000 PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 BG_HOME_V2_VIEWPORT=2388x1080 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"`
- **Screenshots reviewed:**
  - `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-to-detail-25.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-to-detail-50.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-to-detail-75.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-back-to-catalog-25.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-back-to-catalog-50.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-back-to-catalog-75.png`

## 2026-05-03 进度：Home V2 正向 50% 折页层继续增强（仍未收口）
- **Status:** in_progress
- **Action:** 继续只调 `FoldLinePageFlipStage.tsx` 的正向折页层，把翻起页片从“空白纸板”继续拉回成“带源页内容、遮挡目标 UI 的半页折起层”。
- **Result:** 已给折起层加回更强的源页内容、实纸底色和更弱的泛白高光；重新跑 2388x1080 E2E 后，`page-flip-to-detail-50.png` 肉眼可见源页列表内容比上一轮更清楚，但仍偏浅，距离可验收还差一档。
- **Verification:**
  - `npx eslint src/components/home-v2/FoldLinePageFlipStage.tsx`
  - `PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 BG_HOME_V2_VIEWPORT=2388x1080 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"`
- **Screenshots reviewed:**
  - `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2	est-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-to-detail-50.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2	est-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-back-to-catalog-50.png`
- **Next:** 继续压正向 50% 的纸面不透明度、页内容对比度和页边阴影，不再回头动 steady state。

## 2026-05-03 进度：Home V2 正向 50% 折页继续校正（未收口）
- **Status:** in_progress
- **Action:** 继续只改 `src/components/home-v2/FoldLinePageFlipStage.tsx`，围绕 `page-flip-to-detail-50.png` / `page-flip-back-to-catalog-50.png` 主动看图校正翻页层。
- **Result:** 折页层已从“空白纸板”回退为“带源页内容的半页折起层”；`page-flip-back-to-catalog-50.png` 肉眼明显比前一版更像真实翻页，但 `page-flip-to-detail-50.png` 仍过于泛白/半透明，折起层内容感不足，不能收口。
- **Verification:**
  - `npx eslint src/components/home-v2/FoldLinePageFlipStage.tsx`
  - `PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 BG_HOME_V2_VIEWPORT=2388x1080 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"`
- **Screenshots reviewed:**
  - `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2	est-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-to-detail-50.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2	est-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-back-to-catalog-50.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2	est-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-homepage-catalog.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2	est-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-detail-entry.png`
- **Next:** 继续收 `page-flip-to-detail-50.png` 的折页层不透明度、内容可读性和弧线/阴影；达标前不再把当前翻页效果写成“已收口”。

## 2026-05-02 进度：Home V2 方案 B 收口（翻页层只翻纸，不翻 UI）
- **Status:** completed
- Actions taken:
  - 用户继续指出“UI 还在纸上面”后，停止继续调折角参数，改为把 `src/components/home-v2/FoldLinePageFlipStage.tsx` 切到方案 B。
  - 删除本轮可见翻页层对 live stage 的依赖；翻页时改为只渲染纸张层、阴影层和折页高光层，底层页面内容保持静止。
  - 保留已修好的 `50%` 冻结抓帧链路，继续沿用同一条 `homeV2Draft 查询参数会切到 V2 首页并可进入详情页` E2E。
  - 主动复看 `page-flip-to-detail-50.png / page-flip-back-to-catalog-50.png / homepage-catalog.png / detail-entry.png`，确认这次不是“抓帧准了但方向还错”。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint .\src\components\home-v2\FoldLinePageFlipStage.tsx .\e2e\lobby.e2e.ts` | 0 error | 0 error | ✅ |
| Typecheck | `npm run typecheck` | 通过 | 通过 | ✅ |
| E2E-首页到详情再返回目录 | `PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 BG_HOME_V2_VIEWPORT=2388x1080 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 50% 中间帧可信，且翻页层不再承载 live UI | 通过；正反向 50% 图中翻起层均只剩纸张/阴影，首页与详情稳态未回退 | ✅ |

### Visual verdict
- `page-flip-to-detail-50.png`：右页翻起层已经不再带房间列表 UI，本轮终于变成“纸压在 UI 上面翻”。
- `page-flip-back-to-catalog-50.png`：反向同样只翻纸，不再把目录条目贴到折页层上。
- `homepage-catalog.png` / `detail-entry.png`：主态仍完整留在书页内，没有新的缩左上角、窄布局或缩略图露白边回退。

## 2026-05-02 进度：Home V2 50% 截图冻结修正
- **Status:** completed
- Actions taken:
  - 主动复看截图后确认：上一轮 `page-flip-to-detail-50.png` 实际抓成了详情稳态，证据口径不合格。
  - 在 `src/components/home-v2/FoldLinePageFlipStage.tsx` 增加测试冻结能力：`window.__BG_HOME_V2_E2E_HOLD_PROGRESS__`。
  - 在 `e2e/lobby.e2e.ts` 把 50% 截图流程改成“冻结到目标进度再截图”，避免 full-page 截图把动画吃到终态。
  - 复跑同一条 Home V2 E2E，并重新人工复看 `page-flip-to-detail-50.png` / `page-flip-back-to-catalog-50.png`。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/components/home-v2/FoldLinePageFlipStage.tsx e2e/lobby.e2e.ts` | 0 error | 0 error | ✅ |
| E2E-首页到详情再返回目录 | `PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 BG_HOME_V2_VIEWPORT=2388x1080 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 真正抓到 50% 中间帧 | 通过；最新正反向 50% 图已不再是 steady state 误抓 | ✅ |

### Visual verdict
- `page-flip-to-detail-50.png`：现在已经是可信中间帧，右页 source 内容正在翻走，目标页保持在下层静止。
- `page-flip-back-to-catalog-50.png`：现在已经是可信中间帧，左页 detail 内容正在折回目录，不再是假终态图。

## 2026-05-02 进度：Home V2 50% 半页折页收口
- **Status:** completed
- Actions taken:
  - 重新按用户最新口径裁决：废弃 25% 作为收口依据，翻页只看 50% 中间帧。
  - 在 `src/components/home-v2/FoldLinePageFlipStage.tsx` 中把可见折页层从“小角贴片”改成大面积纸张遮挡层，并保证该层压在 UI 上方。
  - 给翻页完成回调增加最短可见动画时长门槛，保证 Playwright 稳定抓到 50% 中间帧，而不是动画末帧。
  - 复跑 ESLint / Typecheck / 同一条 Home V2 E2E，并复看 `page-flip-to-detail-50.png` 与 `page-flip-back-to-catalog-50.png`。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/components/home-v2/FoldLinePageFlipStage.tsx` | 0 error | 0 error | ✅ |
| Typecheck | `npm run typecheck` | 通过 | 通过 | ✅ |
| E2E-首页到详情再返回目录 | `PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 BG_HOME_V2_VIEWPORT=2388x1080 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 50% 中间帧可稳定截图且首页/详情链路不回退 | 通过；最新 50% 中间帧已是半页折起，不再是小角贴层 | ✅ |

### Visual verdict
- `page-flip-to-detail-50.png`：目标页 UI 静止，折页层压在房间列表之上，50% 时已能直接看出半页正在翻起。
- `page-flip-back-to-catalog-50.png`：反向翻页同样是大面积纸张折回，不再是小角或跳切。
- `homepage-catalog.png` / `detail-entry.png`：steady state 仍完整在书页内，本轮没有引入新的左上角偏移或窄布局回退。

## 2026-05-01 进度：Home V2 翻页层归属修正（page-owned content）

- 已完成：
  - 复查 turn.js 官方结构，确认 page HTML 应属于各自 page element。
  - 重写 `src/components/home-v2/FoldLinePageFlipStage.tsx`：可见层从“完整 stage + curl 贴层”改为“shell + 静态页 + turning sheet front/back”。
  - 保留 `turn.js` / `jquery 1.12.0` 官方运行时接线，但不再让错误的 overlay 分层主导最终可见效果。
  - 已跑 `npm run typecheck` 与 Home V2 单条 E2E，均通过。
- 已复看的关键截图：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-to-detail-25.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-back-to-catalog-25.png`
- 当前肉眼结论：
  - 正向 25% 中间帧已经是“源页自己在翻，目标页在底下被揭开”，不再是 full detail 提前露出。
  - 反向 25% 中间帧也回到同一语义；现在剩余差距更多是质感微调，而不是分层逻辑错误。


## 2026-04-30 进度：Home V2 折角语义修正

- 已完成：
  - `FoldLinePageFlipStage.tsx` 把 flipping state 从“整页竖翻”改成“页角起卷”的局部 curl sheet。
  - 首页稳态右下角、详情稳态左下角继续保留轻折角。
  - 重新跑首页 -> 详情 E2E，并复看 `page-flip-to-detail-25.png`，确认已经能看到角落卷页，不再是整页先立起来。
- 已运行命令：
  - `npx eslint src\components\home-v2\FoldLinePageFlipStage.tsx`
  - `npm run typecheck`
  - `PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 BG_HOME_V2_VIEWPORT=2388x1080 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"`

## 2026-04-30 进度：Home V2 首页折角与翻页收口

- 已完成：
  - `src/components/home-v2/FoldLinePageFlipStage.tsx` 继续保留官方 `turn.js` / `jquery 1.12.0` 脚本接线，但把**最终可见层**切成“steady state 折角 + flipping state 整页折页 sheet”，避免官方 overlay 直接把正文压成中间小册子。
  - `src/pages/HomeV2.tsx` 的翻页页面 rect 已从正文块改成更接近整页书页的范围，翻页中间帧不再只在中间出现一个小矩形内容块。
  - `e2e/lobby.e2e.ts` 继续沿用同一条首页 -> 详情 -> 返回目录链路，复跑后新的 `homepage-catalog / page-flip-to-detail-25 / detail-entry / page-flip-back-to-catalog-25 / catalog-return-after-flip` 已生成并人工复看。
- 已运行命令：
  - `npx eslint src\components\home-v2\FoldLinePageFlipStage.tsx src\pages\HomeV2.tsx e2e\lobby.e2e.ts`
  - `npm run typecheck`
  - `PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 BG_HOME_V2_VIEWPORT=2388x1080 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"`
- 当前肉眼结论：
  - 首页 steady state 干净，右下角轻折角已稳定出现；
  - 详情 steady state 干净，左下角折角方向正确；
  - 正反向翻页中间帧都已经出现可见整页折起效果，不再是中间小册子或空白壳。

## 2026-04-30 进度：Home V2 翻页切到官方 turn.js

- 已完成：
  - 将官方 `turn.js 4.1.0` 脚本落到 `public/vendor/turnjs/turn.min.js`。
  - `src/components/home-v2/FoldLinePageFlipStage.tsx` 改为官方 turn.js wrapper，翻页态动态注入脚本并驱动 `overview <-> detail`。
  - `src/pages/HomeV2.tsx` 改为首页 / 详情共用 `bookStageLayout`，书本尺寸继续统一。
  - `e2e/lobby.e2e.ts` 的翻页证据截图改为抓取 turn.js 动画早段帧（`page-flip-to-detail-25` / `page-flip-back-to-catalog-25`）。
- 已运行命令：
  - `npx eslint src/components/home-v2/FoldLinePageFlipStage.tsx src/pages/HomeV2.tsx e2e/lobby.e2e.ts`
  - `npm run typecheck`
  - `NODE_OPTIONS=--max-old-space-size=4096 BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=900000 PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"`
- 当前证据截图：
  - `homepage-catalog.png`
  - `detail-entry.png`
  - `page-flip-to-detail-25.png`
  - `page-flip-back-to-catalog-25.png`

## Session: 2026-04-29 Home V2 翻页中间帧截图补录
- **Status:** completed
- Actions taken:
  - 在 `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2` / `feat/homepage-v2` 内继续沿用同一条首页 -> 详情 E2E，不新开第二条专用截图脚本。
  - 修改 `e2e/lobby.e2e.ts`：在点击 `dicethrone` 进入详情后，增加 `page-flip-to-detail-mid` 中间帧截图；在详情页点击“返回目录”后，增加 `page-flip-back-to-catalog-mid` 中间帧截图，并补 `catalog-return-after-flip` 落点图。
  - 重新运行 `homeV2Draft 查询参数会切到 V2 首页并可进入详情页`，确认 5 张关键图已齐：`homepage-catalog`、`page-flip-to-detail-mid`、`detail-entry`、`page-flip-back-to-catalog-mid`、`catalog-return-after-flip`。
  - 已同步回写 `evidence/_shared/home-v2-query-entry-e2e-test.md`，把翻页证据从“缺中间帧”改成“证据已齐，剩下是资源风格是否继续收口”。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| E2E-首页到详情再返回目录 | `PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 补齐目录->详情与详情->目录两段翻页中间帧截图 | 通过；新增 `page-flip-to-detail-mid.png`、`page-flip-back-to-catalog-mid.png`、`catalog-return-after-flip.png` | ✅ |

## Session: 2026-04-29 Home V2 翻页中间帧去空白壳
- **Status:** completed
- Actions taken:
  - 确认当前进度里已经接入 `src/components/home-v2/FoldLinePageFlipStage.tsx`，说明翻页体验重构已进入“真实前端折页中间帧”阶段，不再只是旧序列帧。
  - 复看 `page-flip-to-detail-50.png` 后定位到真实缺陷：翻到详情的中间帧目标页仍是空白 detail 壳，因为 `HomeV2.tsx` 在 `flippingToDetail` 时只按 `selectedGameId` 渲染 detail 内容。
  - 已在 `src/pages/HomeV2.tsx` 增加 staged detail game 逻辑：翻页进行中优先使用 pending game 渲染 detail 目标页，避免“动画翻到空白页，结束后才瞬间填内容”。
  - 已重新运行 `npx eslint src/pages/HomeV2.tsx` 和首页->详情 E2E，并复看 `page-flip-to-detail-50.png / page-flip-back-to-catalog-50.png / detail-entry.png`。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/pages/HomeV2.tsx` | 0 error | 0 error | ✅ |
| E2E-首页到详情 | `BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=900000 PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 翻页中间帧目标页不再空白，首页/详情终态不回退 | 通过；已复看 50% 翻页截图，detail 目标页已显示真实王权骰铸内容与房间表 | ✅ |

## Session: 2026-04-29 Home V2 详情页书本尺寸统一到首页标准
- **Status:** completed
- Actions taken:
  - 继续在 `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2` / `feat/homepage-v2` 内推进，不切新 worktree、不换分支。
  - 定位到 `src/pages/HomeV2.tsx` 的 detail 舞台仍沿用旧 `896x720` 基线，而首页 `overview` 早已切到 `1672x941`；这就是 detail 整本书看起来比首页小一圈的直接原因。
  - 已将 `HomeV2.tsx` 的 detail 舞台统一到首页同一套 `1672x941` stage 标准；同时保留现有 detail 内容 rect，不在本轮扩散重排左右页内容区。
  - 已重新运行单文件 ESLint 和同一条首页->详情 E2E，并复看 `homepage-catalog.png` / `detail-entry.png`，确认首页与详情页书本整体占画面比例现已一致。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/pages/HomeV2.tsx` | 0 error | 0 error | ✅ |
| E2E-首页到详情 | `BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=900000 PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 首页与详情页书本整体尺寸保持同一标准 | 通过；日志 `width=2388 height=1080`、`center=(0.500,0.500)`、`rowDelta=(0.00,0.00,0.00)` | ✅ |

## Session: 2026-04-29 Home V2 详情页参考稿收口（Dice Throne 真实链路）
- **Status:** completed
- Actions taken:
  - 继续在 `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2` / `feat/homepage-v2` 内推进，不切新 worktree、不换分支。
  - `src/components/home-v2/GameDetails.tsx` 左页改成更接近参考稿的编辑式排版：封面图改为完整显示、标题和正文提权、底部加入推荐人数块与真实教程模式按钮。
  - `src/components/home-v2/GameDetails.tsx` 右页继续收成账页式列表：加入顶部书页导航文案、搜索框、创建房间按钮、筛选 pills，并压缩表格密度，让 6 行房间在书页内完整可见。
  - `e2e/lobby.e2e.ts` 的首页->详情用例已切到点击 `dicethrone`；同时注入 6 条真实 Dice Throne 房间，其中包含 open / locked / full 混合状态，避免继续用井字棋 detail 图充当参考稿替身。
  - 已复跑 ESLint / Typecheck / 同一条 HomeV2 E2E，并人工复看 `homepage-catalog.png` 与 `detail-entry.png`。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/components/home-v2/GameDetails.tsx e2e/lobby.e2e.ts` | 0 error | 0 error | ✅ |
| Typecheck | `npm run typecheck` | 通过 | 通过 | ✅ |
| E2E-首页到详情 | `PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 首页基线不回退，详情页切到 Dice Throne 真实 detail 且 6 行房间完整可见 | 通过；日志 `width=2388 height=1080`、`center=(0.500,0.500)`、`rowDelta=(0.00,0.00,0.00)` | ✅ |

## Session: 2026-04-28 Home V2 井字棋缩略图去假收口（2388x1080）
- **Status:** completed
- Actions taken:
  - 继续在 `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2` / `feat/homepage-v2` 内清首页剩余假缩略图。
  - 确认 `tictactoe` 仍走 `NeonTicTacToeThumbnail` 前端生成图，不满足“去掉假东西”的口径。
  - 使用真实游戏截图 `evidence/tictactoe/screenshots/tictactoe.png` 生成新的 canonical 封面资源：`public/assets/i18n/zh-CN/tictactoe/thumbnails/cover.png` 与 `compressed/cover.webp`。
  - 修改 `src/games/tictactoe/manifest.ts`，补上 `thumbnailPath: 'tictactoe/thumbnails/cover'`；修改 `src/games/tictactoe/thumbnail.tsx`，统一改为 `ManifestGameThumbnail`。
  - 复跑首页 E2E，并重新查看 `homepage-catalog.png`，确认右下角井字棋缩略图已经切到真实游戏截图封面。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/games/tictactoe/manifest.ts src/games/tictactoe/thumbnail.tsx src/components/home-v2/LobbyDirectory.tsx` | 0 error | 0 error，1 warning（`LobbyDirectory` 既有 fast-refresh warning） | ✅ |
| E2E-首页目录链路 | `PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 井字棋缩略图改为真实截图后，首页目录与详情入口链路仍然通过 | 通过；日志 `width=2388 height=1080`、`center=(0.500,0.500)`、`rowDelta=(0.00,0.00,0.00)` | ✅ |

## Session: 2026-04-29 Home V2 纯前端折线翻页重构（进行中）
- **Status:** in_progress
- Actions taken:
  - 已新增 `src/components/home-v2/FoldLinePageFlipStage.tsx`，用纯前端分片几何变形替代目录/详情之间原来的序列帧表现层；当前实现基于 12 段 vertical slices、`rotateY + skewY + translate3d` 与渐变阴影伪装折线翻页。
  - 已将 `src/pages/HomeV2.tsx` 的 `overview/detail/flippingToDetail/flippingToOverview` 主链路改接到新组件；旧 `HomeSceneRenderer` 只继续承担开场动画与 rooms/tab 翻页，不再负责目录<->详情翻页。
  - 当前目录/详情的完成态仍保持现有 exact spread；本轮只替换中间态表现与完成回调，不改业务状态机语义。
  - 门禁已过：`npx eslint src/pages/HomeV2.tsx src/components/home-v2/FoldLinePageFlipStage.tsx` 通过；`npm run typecheck` 通过。
### Progress update
- `HomeV2Draft.tsx` 也已切到同一套 `FoldLinePageFlipStage`，query-entry / authoring-preview 不再继续依赖旧目录<->详情序列帧。
- 首轮 E2E 暴露的问题不是功能逻辑，而是测试定位：分片层里重复渲染了带 `data-testid="home-v2-book-stage"` 的 stage，导致 `toBeVisible()` 命中多个节点失败。
- 已修复为：`FoldLinePageFlipStage` 只在外层暴露一个稳定的 `home-v2-book-stage` 测试锚点，内部 source/target clone 禁止继续携带同名 test id。
- 回归结果：`npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` 已通过（1 passed, 27.3s）。

### Next
- 复看最新中间帧截图，判断折线翻页当前几何形态是否还要继续收曲率/阴影；若观感仍偏硬，再调 slice 数量、rotateY 深度与阴影分布。
- 补充 findings/evidence，明确“目录<->详情已不再走序列帧”的实现结论与测试口径。

## Session: 2026-04-28 Home V2 详情页 + 翻页效果完全重构（起步）
- **Status:** in_progress
- Actions taken:
  - 继续在 `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2` / `feat/homepage-v2` 内推进，不切新 worktree。
  - 已重新锁定 `D:\gongzuo\webgame\gameasset\v2首页参考` 下的参考素材，并转存到当前 agent 工作区 `out/homev2-reference/ref-01..07.png` 便于后续直接比对。
  - 已复读 `docs/mobile-adaptation.md` 与 `docs/ai-rules/ui-ux.md`，确认这轮详情页/翻页重构必须保持“移动端只条件化收敛，不影响桌面端默认视觉基线”。
  - 已复核当前 Home V2 实现差距：首页 `overview` 已切到独立 spread 渲染；但 `detail` 与翻页仍主要依赖旧 `book-idle` 壳和通用左右翻页序列，属于“首页新稿 + 后续旧稿”混合态。
  - 已把“详情页 + 翻页效果完全重构（参考图一致）”追加到 `task_plan.md / findings.md`，作为当前主任务新阶段。
  - 已在 `src/pages/HomeV2.tsx` 落第一版结构性修复：把 `detail` 状态从旧场景壳里拆出来，改成与首页同类的 **exact spread** 渲染路径；现在首页 `overview` 与详情 `detail` 都是独立按比例 fit 的固定构图舞台，只有中间态继续走翻页动画壳。
  - 详情页现已直接使用 `book-idle/1.png` 作为 detail spread 背景，并把左右页内容和书签点击热点按 artboard 百分比重新定位，避免详情态继续完全依赖旧 scene slot 壳层。
  - 已跑门禁：`npx eslint src/pages/HomeV2.tsx src/components/home-v2/GameDetails.tsx src/components/home-v2/LobbyDirectory.tsx` 通过（仅保留 `LobbyDirectory.tsx` 既有 fast-refresh warning）；`npm run typecheck` 通过；首页→详情 E2E `homeV2Draft 查询参数会切到 V2 首页并可进入详情页` 通过。
### Next
- 再补翻页中间态与详情态之间的统一感，必要时追加 detail 专用背景资源，而不是长期停在 `book-idle` 过渡资产。
- 继续收右页房间账本的版式细节，向参考稿的“表册/账页感”推进，而不只是可用列表。

## Session: 2026-04-28 Home V2 detail 左页视觉收敛
- **Status:** in_progress
- Actions taken:
  - 已将 `src/components/home-v2/GameDetails.tsx` 左页从“轻量标题 + 两个小 tag + 一段摘要”改成更接近参考稿的编辑式书页：上方小号类别眉题、大号标题、密集 badge 带、正文段落与信息卡分层。
  - 同步把右页标题区收成“上小下大”的书页标题结构，避免右页继续像普通卡片列表标题。
  - 已复跑 `npm run typecheck` 通过；首页→详情 E2E `homeV2Draft 查询参数会切到 V2 首页并可进入详情页` 再次通过，首页居中与网格基线未回归。
- Next:
  - 继续把右页房间列表本体向“账本页”质感推进。
  - 如有必要，补 detail 专用背景资源，减少当前对 `book-idle` 的过渡依赖。

## Session: 2026-04-28 Home V2 首页缩略图退步修复（2388x1080）
- **Status:** completed
- Actions taken:
  - 继续在 `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2` / `feat/homepage-v2` 内处理首页，不切分支、不换 worktree。
  - 定位当前首页退步：`LobbyDirectory` 只按 `thumbnailPath` 渲染，导致 `tictactoe` 没复用注册缩略图；`splendor/picture` 真实压缩资源缺失，导致条目变白块。
  - 修改 `src/components/home-v2/LobbyDirectory.tsx`：无 `thumbnailPath` 或图片加载失败时，优先回退到项目注册表里的 `game.thumbnail`。
  - 补齐 `public/assets/i18n/zh-CN/splendor/compressed/picture.webp`，恢复 `splendor` manifest 缩略图路径的实际资源。
  - 复跑首页 E2E，并重新查看 `homepage-catalog.png` / `detail-entry.png`，确认首页右页两张回归缩略图都已恢复显示，且首页进详情链路未断。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/components/home-v2/LobbyDirectory.tsx` | 0 error | 0 error，1 warning（既有 fast-refresh warning） | ✅ |
| E2E-首页目录链路 | `PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 2388x1080 真横屏下目录缩略图恢复显示，首页仍可进入详情页 | 通过；日志 `width=2388 height=1080`、`center=(0.500,0.500)`、`rowDelta=(0.00,0.00,0.00)` | ✅ |

## Session: 2026-04-28 Home V2 首页参考图终态收口（2388x1080）
- **Status:** completed
- Actions taken:
  - 继续在 `D:\\gongzuo\\webgame\\BoardGame\\.worktrees\\homepage-v2` / `feat/homepage-v2` 内推进首页，不切分支、不换 worktree。
  - `src/components/home-v2/LobbyDirectory.tsx` 再次收首页目录页布局：上移并放大首页 6 条目录项，继续把标题、摘要、badge、人数字号与参考图对齐。
  - 补齐首页 badge 的参考稿风格：用手工 curated badge 组合替代重复标签，`cardia / splendor / summonerwars` 等条目不再出现“同义重复 badge”。
  - 继续微调右上角账号 / 概述入口的 rect、图标尺寸、字重与底色，使其更接近参考稿位置和视觉权重。
  - 继续放大 `splendor / summonerwars` 缩略图裁切，进一步吃掉底部浅色边和偏移感。
  - 复跑首页专用 E2E，并重新查看 `homepage-catalog.png`，确认首页仍是前端真实 DOM，且目录内容完整落在书页内。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/components/home-v2/LobbyDirectory.tsx` | 0 error | 0 error，1 warning（既有 fast-refresh warning） | ✅ |
| E2E-首页目录链路 | `PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 2388x1080 真横屏下首页目录、账号入口切 rooms、返回 lobby、进入井字棋详情全部通过 | 通过；日志 `width=2388 height=1080`、`center=(0.500,0.500)`、`rowDelta=(0.00,0.00,0.00)` | ✅ |

## Session: 2026-04-07 Android 本地素材包图片加载故障
- **Status:** in_progress
- Actions taken:
  - 复核 `GamePackagePlugin` / `GamePackageForegroundRuntime` / `packageManagerService` / `AssetLoader` / `OptimizedImage` 链路，确认原生素材包会安装到 `.../current/assets`，问题不在下载落盘本身。
  - 修复 `src/features/mobile-packages/packageManagerService.ts`：`hydrateInstalledNativeGamePackages()` 在没有预注册 `fallbackCache` 时也会构造兜底 state，确保已安装包仍能把 `assetBaseUrl` 注入到 AssetLoader override。
  - 修复 `src/components/common/media/OptimizedImage.tsx`：开发态 `fetch -> blob` workaround 只保留给 public `/assets/...`，Android `/_capacitor_file_/...` 本地包路径改为直接 `<img>` 加载。
  - 修复 `src/features/mobile-packages/nativeGamePackagePlugin.ts`：原生 ack / listener 返回 `running/completed/cancelled` 时先归一化为前端合法状态，避免 `易桌游测试` 把下载按钮直接污染成灰态。
  - 补回归测试：`src/components/common/media/__tests__/CardPreview.i18n.test.tsx` 与 `src/components/lobby/__tests__/GameDetailsModalJoinConfirm.test.ts`。
  - 将包含修复的 `dist/` 覆盖到真机 `top.easyboardgame.app.debug` 当前 OTA 目录 `/data/user/0/top.easyboardgame.app.debug/files/versions/mhvPgIYOyN`，重启后确认加载新 bundle `index-wN3ZSRu0.js`。
  - 真机打开 `王权骰铸` 详情弹窗后，`安装游戏包` 按钮已恢复为可点击态；截图路径：`D:\\gongzuo\\webgame\\BoardGame\\temp\\mobile-debug\\dicethrone-modal-after-open.png`。

## Session: 2026-04-26 Home V2 首页参考图重构（首页起步）
- **Status:** completed
- Actions taken:
  - 在 `D:\\gongzuo\\webgame\\BoardGame\\.worktrees\\homepage-v2` 确认当前分支仍为 `feat/homepage-v2`，继续在该工作树推进。
  - 先同步版本号：`package.json` / `package-lock.json` 已更新到 `0.5.61`。
  - 对照 `D:\\gongzuo\\webgame\\gameasset\\v2首页参考\\首页.png`、`总览首页.png`、`background.png` 与当前 HomeV2 截图，确认首页应从“九宫格卡片目录”切到“顶部分类导航 + 双页信息流列表”。
  - `src/components/home-v2/LobbyDirectory.tsx` 已改为“顶部分类导航 + 右上角账号入口 + 双列目录列表”，并为 `splendor` 缺失缩略图补了钻石 icon fallback。
  - `src/pages/HomeV2.tsx` 继续复用原翻页状态机，但首页只走 `overview_spread_body`；`src/components/system/GlobalHUD.tsx` 对 `/?homeV2Draft=1` 与预览路由隐藏全局悬浮齿轮，避免参考图首页被额外浮层污染。
  - `e2e/lobby.e2e.ts` 收束为“首页目录验收 + 账号入口切到 rooms + 返回 lobby 后进入井字棋详情”的最小链路，移除与本轮首页无关的 rooms 表单模式切换断言。
  - 第二轮视觉压缩继续把首页往参考图收口：放大顶部分类/标题/摘要/人数字号，收紧 badge 样式，首页舞台放大到更贴近 `936x432` 横屏满高展示。
  - 新增 `public/assets/common/images/home-v2/catalog-thumbnails/`，从用户提供的 `首页.png` 裁出 `splendor` / `summonerwars` 局部缩略图并压成 WebP，只作为条目缩略图素材使用，不把整页截图重新塞回首页。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/components/system/GlobalHUD.tsx e2e/lobby.e2e.ts` | 0 error | 0 error | ✅ |
| Typecheck | `npm run typecheck` | 通过 | 通过 | ✅ |
| i18n 校验 | `npm run i18n:check` | 无缺失 key | `no missing keys detected` | ✅ |
| E2E-首页链路 | `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 首页目录、rooms 切换、返回 lobby、进入井字棋详情全部通过 | 通过；首页量测 `columns=292.45,640.52`、`rowDelta=(0.00,0.00,0.00)`、`widthRatio=0.805`、`heightRatio=0.981` | ✅ |

## Session: 2026-04-23 Home V2 认证区彻底重构（无真机）
- **Status:** completed
- Actions taken:
  - `src/components/home-v2/HomeTabPanels.tsx` 移除 `AuthModal` 依赖，重写 `HomeV2AuthFormPanel` 为页面原生认证块（登录/注册/重置三态）。
  - 认证区改为统一九宫格 frame（`border-image`），不再使用 modal 外壳视觉。
  - 保留并兼容现有 E2E 选择器（`auth-embedded-panel`、`auth-login-account-input`、`auth-register-send-code` 等），避免流程断言失效。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/components/home-v2/HomeTabPanels.tsx` | 0 error | 0 error | ✅ |
| Typecheck | `npm run typecheck` | 通过 | 通过 | ✅ |
| i18n 校验 | `npm run i18n:check` | 无缺失 key | `no missing keys detected` | ✅ |
| E2E-建房主链路 | `npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 通过 | 通过 | ✅ |
| E2E-密码入房 | `npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 详情页输入房间密码后可加入加密房间"` | 通过 | 通过 | ✅ |

## Session: 2026-04-23 Home V2 黑边回归修复
- **Status:** completed
- Actions taken:
  - 定位到底边突兀感来自两部分叠加：书本素材黑底留边 + HomeV2 背景暗部过重。
  - `src/pages/HomeV2.tsx` / `src/pages/HomeV2Draft.tsx`：背景桌面图固定 `object-cover object-top`，并降低全屏暗化层强度；手机横屏展示比例调整为 `scale=1.62`、`offsetYPct=14`。
  - `src/ugc/runtime/ui-scene/scenes/homeV2BookScene.ts`：书本主序列节点统一 `fit: 'cover'`（裁掉黑底留边，避免黑框进入可视区）。
  - `e2e/lobby.e2e.ts`：增加 Home V2 桌面背景 `objectFit/objectPosition` 校验，防止样式回退。
  - `evidence/_shared/home-v2-query-entry-e2e-test.md`：补充“禁止纯黑底边带、允许低对比桌面暗部”的验收条款。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| E2E-建房主链路 | `npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 通过 | 通过 | ✅ |

## Session: 2026-04-22 Home V2 终态收口（三次）
- **Status:** in_progress
- Actions taken:
  - 目录两排对齐修复复核：`LobbyDirectory` 改为按列统一变换，`GameList` 标题高度收敛，消除第六张卡下沉。
  - 登录页改为右页内联认证（不再弹窗）：`HomeV2/HomeV2Draft/HomeTabPanels/AuthModal` 已同步。
  - 重跑两条核心 E2E 并复看关键截图，确认“建房进局 + 密码入房”链路仍可用。
  - 回写证据文档：`evidence/_shared/home-v2-query-entry-e2e-test.md` 已改成“右页内联认证 + 网格基线量测”口径。
  - 重新打包 Android debug APK：`android/app/build/outputs/apk/debug/easyboardgame-debug.apk`。
  - 安装阻塞确认：`adb -s 10ADAU063C0010U install -r ...` 返回 `device not found`，当前未完成用户手机安装。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/components/home-v2/LobbyDirectory.tsx src/components/lobby/GameList.tsx src/components/home-v2/HomeTabPanels.tsx src/components/auth/AuthModal.tsx src/pages/HomeV2.tsx src/pages/HomeV2Draft.tsx src/ugc/runtime/ui-scene/prefabs.tsx e2e/lobby.e2e.ts` | 0 error | 0 error，3 warning（既有） | ✅ |
| Typecheck | `npm run typecheck` | 通过 | 通过 | ✅ |
| i18n 校验 | `npm run i18n:check` | 无缺失 key | `no missing keys detected` | ✅ |
| E2E-建房进局 | `npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 通过 | 通过，网格量测 `rowDelta=(0.51,0.51)`、`colGapDelta=0.00` | ✅ |
| E2E-密码入房 | `npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 详情页输入房间密码后可加入加密房间"` | 通过 | 通过 | ✅ |
| Android 打包 | `npm run mobile:android:build:debug` | 成功产出 APK | 成功 | ✅ |
| Android 安装 | `adb -s 10ADAU063C0010U install -r ...easyboardgame-debug.apk` | 成功 | `device not found` | ⚠️ |

### 当前阻塞
| Timestamp | Blocker | Impact | Next Step |
|-----------|---------|--------|-----------|
| 2026-04-22 22:47 | 用户手机序列号 `10ADAU063C0010U` 不在线 | APK 无法安装到目标手机，真机复核暂停 | 待设备重新连接后立刻重跑 `adb install -r` 并补最新真机截图 |

## Session: 2026-04-22 Home V2 细节二次收口（字/对齐/弹窗）
- **Status:** completed
- Actions taken:
  - 书签字下调：`src/ugc/runtime/ui-scene/prefabs.tsx` 从 `12px` 调整为 `11px`。
  - 书本整体上移：`src/ugc/runtime/ui-scene/scenes/homeV2BookScene.ts` 中 `offsetYPct` 从 `1` 调整到 `-0.8`。
  - 手机横屏缩放收敛：`HomeV2/HomeV2Draft` 中 `HOME_V2_PHONE_PRESENTATION_SCALE 1.42 -> 1.28`，`wideLandscapeShellScale 1.18 -> 1.14`。
  - 详情页按钮与 tag 收敛：`src/components/home-v2/GameDetails.tsx` 缩小 `tiny/compact` 按钮尺寸、缩小 meta/操作 tag，并降低“创建房间”按钮最大宽度。
  - 修复建房弹窗超视口：`src/components/lobby/CreateRoomModal.tsx` 改为 `createPortal(..., document.body)`，并加可视区高度约束与安全区内边距。
  - `e2e/lobby.e2e.ts` 增加建房弹窗可视区断言（`top >= 4` 且 `bottom <= viewportHeight - 4`）。
  - 重新打包并安装 Android debug 到用户设备 `10ADAU063C0010U`。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/ugc/runtime/ui-scene/prefabs.tsx src/ugc/runtime/ui-scene/scenes/homeV2BookScene.ts src/pages/HomeV2.tsx src/pages/HomeV2Draft.tsx src/components/home-v2/GameDetails.tsx src/components/lobby/CreateRoomModal.tsx e2e/lobby.e2e.ts` | 0 error | 0 error（CreateRoomModal 既有 warning） | ✅ |
| Typecheck | `npm run typecheck` | 通过 | 通过 | ✅ |
| i18n 校验 | `npm run i18n:check` | 无缺失 key | `no missing keys detected` | ✅ |
| E2E-首页到详情到建房 | `npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 通过 | 通过；弹窗量测 `top=25.25/bottom=419.83/viewport=432` | ✅ |
| E2E-密码入房 | `npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 详情页输入房间密码后可加入加密房间"` | 通过 | 通过 | ✅ |
| Android 打包 | `npm run mobile:android:build:debug` | 成功产出 APK | 成功 | ✅ |
| Android 安装 | `adb -s 10ADAU063C0010U install -r ...easyboardgame-debug.apk` | 成功 | `Success` | ✅ |

## Session: 2026-04-22 Home V2 登录/详情 UI 收敛
- **Status:** completed
- Actions taken:
  - `AuthModal` 增加 `placement`，HomeV2 登录入口改为右侧弹窗（不再居中压书页）。
  - 详情页左侧类型/人数 tag 改为单行小标签；右侧房间操作 tag 与座位信息同行右对齐。
  - `e2e/lobby.e2e.ts` 新增回归断言：登录弹窗中心点在右半屏、详情 tag 单行且尺寸收敛。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/components/common/overlays/ModalBase.tsx src/components/auth/AuthModal.tsx src/components/home-v2/HomeTabPanels.tsx src/components/home-v2/GameDetails.tsx e2e/lobby.e2e.ts` | 0 error | 0 error | ✅ |
| Typecheck | `npm run typecheck` | 通过 | 通过 | ✅ |
| i18n 校验 | `npm run i18n:check` | 无缺失 key | `no missing keys detected` | ✅ |
| E2E-查询入口链路 | `BG_HOME_V2_VIEWPORT=2388x1080 ... npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 通过 | 通过 | ✅ |
| E2E-加密房加入 | `BG_HOME_V2_VIEWPORT=2388x1080 ... npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 详情页输入房间密码后可加入加密房间"` | 通过 | 通过 | ✅ |

## Session: 2026-04-21 Home V2 手机端端到端修复
- **Status:** completed
- Actions taken:
  - 已完成 Home V2 手机横屏固定口径缩放修正：`HomeV2/HomeV2Draft` 在 `<=1100x520` 视口下使用 `presentationOverride.scaleMultiplier=1.2`，避免页面过小。
  - 已修复登录页重复信息与重复背景：标题保留“登录”，去掉外层额外背景框，登录/注册按钮保留素材边框。
  - 已修复详情页“房间显示不全”与“tag风格不一致”：房间卡改为纵向信息流，返回目录与 tag 全部切为素材边框。
  - 已修复密码输入“显示不全”：输入框字号/内边距收敛，占位文案改为 `输入密码`（英文 `Password`）。
  - 已打包并安装 Android debug 包：`android/app/build/outputs/apk/debug/easyboardgame-debug.apk`。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/pages/HomeV2.tsx src/pages/HomeV2Draft.tsx src/components/home-v2/GameDetails.tsx src/components/lobby/CreateRoomModal.tsx src/lib/homeV2Routing.ts src/components/home-v2/HomeTabPanels.tsx src/ugc/runtime/ui-scene/UISceneRenderer.tsx src/ugc/runtime/ui-scene/HomeSceneRenderer.tsx e2e/lobby.e2e.ts` | 0 error | 0 error（CreateRoomModal 既有 5 warning） | ✅ |
| Typecheck | `npm run typecheck` | 通过 | 通过 | ✅ |
| i18n 校验 | `npm run i18n:check` | 无缺失 | `no missing keys detected` | ✅ |
| E2E-建房链路 | `npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 通过 | 通过 | ✅ |
| E2E-密码入房 | `npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 详情页输入房间密码后可加入加密房间"` | 通过 | 通过 | ✅ |
| Android 打包 | `npm run mobile:android:build:debug` | 成功产出 APK | 成功 | ✅ |
| Android 安装 | `adb -s 10ADAU063C0010U install -r ...easyboardgame-debug.apk` | 成功 | 通过（Success） | ✅ |
| 真机复核截图 | `adb screencap + adb pull` | 首页/详情/建房弹窗整图齐全 | 已补齐（3 张） | ✅ |

### 当前阻塞
| Timestamp | Blocker | Impact | Next Step |
|-----------|---------|--------|-----------|
| 2026-04-21 23:35（已解除） | 初次安装曾被设备侧权限拦截（`INSTALL_FAILED_ABORTED`） | 一度阻塞真机闭环 | 已重试安装成功并补齐真机截图，当前无阻塞 |

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/features/mobile-packages/packageManagerService.ts src/components/common/media/OptimizedImage.tsx src/components/common/media/__tests__/CardPreview.i18n.test.tsx src/components/lobby/__tests__/GameDetailsModalJoinConfirm.test.ts` | 0 error | 0 error，`OptimizedImage.tsx` 有 1 条 `react-refresh/only-export-components` warning | ✅ |
| 图片链路回归 | `node scripts/infra/vitest-cli-safe.mjs run src/components/common/media/__tests__/CardPreview.i18n.test.tsx --configLoader native --maxWorkers 1` | 通过 | `8 passed` | ✅ |
| 启动期 hydration 回归 | `node scripts/infra/vitest-cli-safe.mjs run src/components/lobby/__tests__/GameDetailsModalJoinConfirm.test.ts -t "mobile package bootstrap hydration" --configLoader native --maxWorkers 1` | 通过 | `1 passed, 54 skipped` | ✅ |

### Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-04-07 | 启动期已安装游戏包在未注册 `fallbackCache` 时被直接跳过，资源 override 未生效 | 1 | `hydrateInstalledNativeGamePackages()` 对缺失 fallback 的游戏构造兜底 state 后继续 emit/apply override |
| 2026-04-07 | `OptimizedImage` 把 Android `/_capacitor_file_/...` 本地包路径误走开发态 fetch/blob workaround，图片停在加载态 | 1 | 将 workaround 收窄为“仅开发态 public `/assets/...`”，本地包路径直接 `<img>` 加载 |
| 2026-04-07 | 原生首次 ack 返回 `running`，旧前端把非法状态直接写进安装状态，导致下载按钮提前灰死 | 1 | `nativeGamePackagePlugin.ts` 归一化原生状态后再写入前端缓存，并已用真机新 bundle 确认按钮恢复可点 |

## Session: 2026-03-28 Dice Throne AI 审计收口
- **Status:** completed
- Actions taken:
  - 复核 `src/games/dicethrone/ai.ts`、`domain/executeTokens.ts`、`domain/commandValidation.ts`、`domain/tokenResponse.ts`，确认 Monk 太极当前规则是“单响应窗口最多 1 次合法使用”。
  - 修复 `src/games/dicethrone/domain/systems.ts` 中 `TOKEN_RESPONSE_CLOSED` 未同步清空 `sys.responseWindow.current` 的状态残留问题。
  - 更新 `src/games/dicethrone/__tests__/basic-commands-coverage.test.ts` 中的太极回归，使其断言当前真实行为：单次 token 响应后 `skip-token-response`，并在关闭窗口后恢复正常推进。
  - 继续强化太极回归，补断言验证 `skip-token-response` 后 `sys.interaction.current` 也被清空，且操作权仍回到玩家 `0`，下一拍继续返回 `advance-phase`。
  - 同型扫描 `ResponseWindowSystem` 后，补了一条锁定语义回归到 `src/games/dicethrone/__tests__/response-window-interaction-lock.test.ts`：交互创建并锁定响应窗口期间，`RESPONSE_PASS` 必须失败，且不得提前清掉 `sys.interaction.current` / `pendingInteractionId`。
  - 复跑 Dice Throne AI 关键回归，确认本地 AI 不再在太极响应链路上卡死。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| AI 基础命令覆盖 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts --configLoader native --maxWorkers 1` | 全部通过，且太极链路按当前规则关闭窗口并恢复推进 | `26 passed` | ✅ |
| Token 响应窗口回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/token-response-window.test.ts --configLoader native --maxWorkers 1` | 响应窗口开闭与交接链路稳定 | `8 passed` | ✅ |
| 响应窗口锁定回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/response-window-interaction-lock.test.ts --configLoader native --maxWorkers 1` | 交互锁定期间 `RESPONSE_PASS` 被拒绝，现有锁定/取消链路保持通过 | `7 passed` | ✅ |

### Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-03-28 | 太极响应结束后 AI 仍看到残留 response window，继续跑出 `response-pass` | 1 | 在 `TOKEN_RESPONSE_CLOSED` 路径同步清空 `sys.responseWindow.current` |
| 2026-03-28 | 旧回归仍期待“双太极再 skip”，与当前 token 规则不符 | 1 | 按当前 `getMaxTokenUseAmount` / `tokenUsageTotals` 真相改写测试，断言单次 token 后直接 `skip-token-response` |

# Progress Log

## Session: 2026-03-28

### Phase: 初始化
**Status**: Complete

- **[10:00] Action**: 检查根工作区、规划文件占用情况与相关规范
  - Result: 确认根工作区存在并行任务，且 `task_plan.md/findings.md/progress.md` 已服务其他主题；已读取资产、录入、审计、测试、OpenSpec 规范
  - Next: 创建独立 worktree 并初始化本任务规划文件

- **[10:05] Action**: 创建独立 worktree 与分支 `feat/smashup-base-faction-assets`
  - Result: 新工作目录 `D:\\gongzuo\\webgame\\BoardGame-wt-smashup-base-faction-assets` 已创建，工作区干净
  - Next: 盘点现有 Smash Up 图片接入链路和目标素材清单

### Phase: 发现与设计
**Status**: Complete

- **[10:08] Action**: 初始化 `task_plan.md`、`findings.md`、`progress.md`
  - Result: 本任务已建立独立的磁盘规划上下文，后续发现与验证可持续追加
  - Next: 扫描 `public/assets`、现有 Smash Up faction 资源与相关代码/脚本

- **[10:22] Action**: 核对原工作区 Smash Up 新原图与现有压缩产物
  - Result: `aiji_base.png` 与目标四派系基地匹配，但 `aiji.png` 实际是 Pretty Pretty 四派系卡图；旧 `cards5.webp` / `base4.webp` 不是本次目标内容
  - Next: 用 TTS / Wiki 源数据锁定四派系的正式卡牌与基地清单，判断中文 cards 原图缺口是否阻塞实现

- **[10:28] Action**: 解析 TTS 源数据 `2833984701.json`
  - Result: 已确认 Ancient Egyptians / Cowboys / Samurai / Vikings 四个 kit 均存在，且能提取对应 bases / deck / titan / CustomDeck 信息
  - Next: 按 Smash Up 专项规范运行 Wiki 爬虫，建立本次录入契约与 spec 范围

- **[10:40] Action**: 起草并校验 OpenSpec change `add-smashup-oops-faction-intake`
  - Result: `proposal.md` / `tasks.md` / `design.md` / spec delta 已创建，`openspec validate add-smashup-oops-faction-intake --strict --no-interactive` 通过
  - Next: 向用户确认 cards 原图来源；确认后再进入 apply 阶段

### Phase: 资产处理与录入
**Status**: Complete

- **[10:48] Action**: 用户修正并确认 `aiji.png` 为正确图片
  - Result: 当前 worktree 中 `public/assets/i18n/zh-CN/smashup/cards/aiji.png` 已变为 Oops, You Did It Again 四派系卡图
  - Next: 重新核定 atlas 网格、切片顺序与卡牌索引

- **[10:54] Action**: 直接查看并核对 `aiji.png` 与 `aiji_base.png`
  - Result: 已确认 `aiji.png` 为 `7x7` row-major（48 卡 + 1 尾格），`aiji_base.png` 为 `2x4` row-major（8 基地）
  - Next: 以该索引顺序生成 faction/base/card 接入清单

- **[10:58] Action**: 压缩 Smash Up 新原图
  - Result: 已生成 `cards/compressed/aiji.webp` 与 `base/compressed/aiji_base.webp`
  - Next: 在 atlasCatalog / ids / static defs 中接入新 atlas

- **[11:05] Action**: 复核 TTS `2833984701.json` 的四个目标 kit
  - Result: 已确认四派系的英文卡名、卡牌数量与基地清单，足以作为 defId / count / canonical base name 的英文来源
  - Next: 补 Wiki 抓取映射并开始正式录入

- **[11:40] Action**: 完成 Oops 四派系静态接入
  - Result: 已补 `ids.ts`、`atlasCatalog.ts`、4 个 faction 文件、8 个 base def、locale、`factionMeta.ts`，并修复 `registerPodBaseSkeletons()` 对非 POD 派系误生成 `_pod` 基地的问题
  - Next: 跑 Vitest / typecheck / E2E 并处理截图异常

### Phase: 审计与验证
**Status**: Complete

- **[12:00] Action**: 运行 Vitest、typecheck 与 OpenSpec 校验
  - Result: `CardPreview.i18n`、`criticalImageResolver`、`factionSelection`、`cardI18nIntegrity`、`typecheck`、`openspec validate` 全部通过
  - Next: 完成 E2E 证据与上传验证

- **[12:10] Action**: 排查 E2E 白板问题
  - Result: 确认根因不是 atlas 索引，而是 `AtlasCard` 用多层 `background-image` 充当 fallback，导致 Playwright 证据截图里 atlas 呈现白板
  - Next: 修复渲染策略并复跑 E2E

- **[12:25] Action**: 上传新 atlas 到 R2 并修复 `AtlasCard` 渲染策略
  - Result: `aiji.webp` 与 `aiji_base.webp` 已上传到 `official/i18n/zh-CN/smashup/...`，`HEAD` 均为 `200`；`AtlasCard` 已改为选择单个已加载成功的 URL 作为最终背景图
  - Next: 复跑 E2E 并留证

- **[12:35] Action**: 复跑 intake E2E 并自审截图
  - Result: `Oops 四派系在派系选择与注入场景中都能显示资源` 已通过，派系选择与棋盘截图均显示真实卡图/基地图
  - Next: 补 workflow / evidence 文档并回填计划文件

- **[12:50] Action**: 沉淀 workflow / contract / E2E evidence 文档
  - Result: 已新增 `docs/games/smashup/workflows/smashup-faction-intake.md`、`evidence/smashup/smashup-oops-faction-intake-contract.md`、`evidence/smashup/smashup-oops-faction-intake-e2e-test.md`
  - Next: 整理最终交付摘要

### Phase: gameplay proposal
**Status**: In Progress

- **[13:42] Action**: 为玩法补完创建 OpenSpec change `add-smashup-oops-faction-gameplay`
  - Result: `proposal.md` / `design.md` / `tasks.md` / spec delta 已落盘，范围明确为四派系正式玩法、新交互类型 UI、统一审计与 E2E
  - Next: 结合用户最新指令确认实施顺序与阶段边界

- **[13:47] Action**: 根据用户要求收敛实施顺序与收尾方式
  - Result: 已明确“一个一个派系实施，全部完成后再统一审计，然后端到端测新交互类型”；Gameplay 波次固定为 `Ancient Egyptians → Vikings → Cowboys → Samurai`
  - Next: 运行 OpenSpec 严格校验并回填 planning 文件

- **[13:49] Action**: 运行 `openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive`
  - Result: 校验通过，proposal 进入可评审状态
  - Next: 更新 `task_plan.md / findings.md / progress.md`，准备向用户汇报 proposal 核心范围与第一波实施入口

### Phase: Ancient Egyptians implementation
**Status**: In Progress

- **[14:10] Action**: 实现 Ancient Egyptians 的埋葬/翻开主链路与专属能力
  - Result: 已新增 `src/games/smashup/abilities/ancient_egyptians.ts`，接入 `Mummy / Pyramid Engineer / Priest of Anubis / Pharaoh / Lost Knowledge / Seal the Tomb / Tomb Trap / Blessing of Anubis / You Can Take It With You / Plague of Locusts / Mummy Strength / Ancient Curse`，并在 `domain/bury.ts` 增加可复用的 `buildBuryCardEvents()` / `uncoverBuriedCard()`，支持 `onUncover`、非法时机翻开 special 直接弃置、`onCardBuried / onBuriedCardUncovered` 触发。
  - Next: 完成 bury UI、同步 locale / OpenSpec，并跑相关验证。

- **[14:22] Action**: 落地 bury UI 与 Ancient Egyptians 正确文本
  - Result: `BaseZone.tsx` 已显示埋葬牌条带；控制者可见真实卡面并可检视，对手仅见隐藏占位与数量/控制者标识。`public/locales/en/game-smashup.json` 与 `public/locales/zh-CN/game-smashup.json` 已修正 Ancient Egyptians 与 `base_star_portal` 文本。
  - Next: 补最小 Vitest、复跑 typecheck / OpenSpec 校验。

- **[14:38] Action**: 补 Ancient Egyptians 最小测试并复核门禁
  - Result: 已在现有测试文件补 `buryEngine.test.ts` 与 `newBaseAbilities.test.ts`，覆盖“翻开后只结算 uncover 文本并弃置”“从场上埋葬确实离场”“Pyramids / Star Portal 基地入口”；`npx vitest run src/games/smashup/__tests__/buryEngine.test.ts src/games/smashup/__tests__/newBaseAbilities.test.ts` 通过，`npm run typecheck` 通过，`openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive` 通过。
  - Next: 回填 planning / spec 后进入 Vikings。

### Phase: Vikings implementation
**Status**: In Progress

- **[15:05] Action**: 按官方口径重建 Vikings 文本基线与能力范围
  - Result: 已确认仓库原有 Vikings locale 与 Oops 官方规则书 / Fandom 口径冲突，当前实现不再沿用旧文本；`Huscarl / Shield Maiden / Raider / Valkyrie / Viking Funeral / Ransack / Pillage / Cast the Runes / Raiding Party / Berserk / Tribute / Combat Training / Drakkar / Longhouse` 均已切到官方语义。
  - Next: 落能力文件、metadata 和基地触发实现。

- **[15:18] Action**: 接入 Vikings ability 与静态 metadata
  - Result: 已新增 `src/games/smashup/abilities/vikings.ts` 并在 `abilities/index.ts` 注册；`src/games/smashup/data/factions/vikings.ts` 已修正 `Huscarl / Raider` 为 `talent`、`Shield Maiden / Berserk` 为 `onPlay`、`Viking Funeral` 为 `ongoing` 且 `ongoingTarget: 'minion'`。
  - Next: 修正 locale、补最小行为测试并验证基地入口。

- **[15:34] Action**: 补 Vikings 最小测试并复核门禁
  - Result: 已在 `newFactionAbilities.test.ts` 覆盖 `vikings_huscarl / vikings_shield_maiden / vikings_pillage`，在 `newBaseAbilities.test.ts` 覆盖 `base_drakkar / base_longhouse`；`npx vitest run src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/newBaseAbilities.test.ts` 通过，`npm run typecheck` 通过，`openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive` 通过。
  - Next: 回填 planning 文件后进入 Cowboys。

## 5-Question Reboot Check
| Question | Answer |
| :--- | :--- |
| Current Phase? | Phase 9 收尾阶段：统一审计、gameplay E2E 与 evidence 已完成，剩余是确认门禁与向用户汇报真实残留缺口 |
| Goal? | 在已完成 intake、四派系第一轮实现的基础上，完成统一 gameplay 审计、浏览器层新交互 E2E 和证据收口，并明确真实残留风险 |
| Key Knowledge? | 统一审计已通过；共享官方 duel 内核已落地并完成 Cowboys 浏览器 full-chain 出图验证，`Stagecoach` 仍是最小移动语义；`Ancient Egyptians / Samurai` 仍主要是交互注入型 E2E |
| Last Action? | 已修复 `Deputy` 目标选择后的阶段推进 bug，并复跑 `newFactionAbilities` / `newBaseAbilities` 与 Cowboys 决斗 E2E |
| Next Step? | 向用户汇报官方 duel 收口结果、截图证据绝对路径，以及仍然真实存在的 Samurai 专项 E2E 与 `Stagecoach` 语义缺口 |

### Phase: Cowboys implementation
**Status**: In Progress

- **[16:10] Action**: 按官方口径修正 Cowboys 文本基线与 metadata
  - Result: 已将 `Deputy / Gunfighter / Pinkerton / Sheriff / Stagecoach / Run 'Em Off / Quick Draw / High Noon / Gold Strike / Gold in Them Thar Hills / Form a Posse / Dynamite Surprise / So-So Corral` 的中英文 locale 改回官方语义；`src/games/smashup/data/factions/cowboys.ts` 已补 `special / ongoing / onPlay` metadata。
  - Next: 收敛 duel MVP 实现，修复错误事件字段并补最小测试。

- **[16:24] Action**: 落地 Cowboys 第一轮 duel / move / destroy / draw 实现
  - Result: `src/games/smashup/abilities/cowboys.ts` 已接入 `Gunfighter / Quick Draw / High Noon / Run 'Em Off / Gold in Them Thar Hills / Form a Posse / Dynamite Surprise / Sheriff / Gold Strike / Saloon / So-So Corral`；同时移除了旧错误的 `Saloon` 决斗内偷触发和 `Dynamite Surprise` 伪 buff 逻辑，并改用现有 `grantExtraMinion / grantExtraAction` 契约。
  - Next: 在现有测试文件补 Cowboys 最小覆盖，并复跑门禁。

- **[16:29] Action**: 补 Cowboys 最小测试并复核门禁
  - Result: 已在 `newFactionAbilities.test.ts` 覆盖 `cowboys_gunfighter / cowboys_quick_draw / cowboys_high_noon / cowboys_gold_strike`，在 `newBaseAbilities.test.ts` 覆盖 `base_saloon / base_so_so_corral`；`npx vitest run src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/newBaseAbilities.test.ts` 通过，`npm run typecheck` 通过，`openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive` 通过。
  - Next: 回填 Cowboy 残留缺口后进入 Samurai。

### Phase: Samurai implementation
**Status**: In Progress

- **[16:54] Action**: 按官方口径修正 Samurai 文本基线与 metadata
  - Result: 已将 `Samurai-Chan / Ronin / Bushi / Shogun / Yokai Attack! / Way of the Warrior / Honorable Combat / Honor the Fallen / Honor the Ancestors / Heart of the Battle / Final Haiku / Code of Bushido / Shogun's Palace / Sakura Garden` 的中英文 locale 改回官方语义；`src/games/smashup/data/factions/samurai.ts` 已补 `special / ongoing / onPlay` metadata。
  - Next: 落地第一轮 duel / honor / destroy / ongoing draw 实现并接入注册入口。

- **[17:02] Action**: 落地 Samurai 第一轮 duel / destroy / draw / counter 实现并复核门禁
  - Result: 已新增 `src/games/smashup/abilities/samurai.ts` 并在 `abilities/index.ts` 注册，接入 `Ronin / Samurai-Chan / Bushi / Shogun / Yokai Attack! / Honorable Combat / Code of Bushido / Heart of the Battle / Honor the Fallen / base_shoguns_palace / base_sakura_garden`；已在 `newFactionAbilities.test.ts` 覆盖 `samurai_ronin / samurai_yokai_attack / samurai_honorable_combat / samurai_code_of_bushido / samurai_honor_the_fallen`，在 `newBaseAbilities.test.ts` 覆盖 `base_shoguns_palace / base_sakura_garden`；`npx vitest run src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/newBaseAbilities.test.ts` 通过，`npm run typecheck` 通过，`openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive` 通过。
  - Next: 继续补齐 Samurai 第一轮遗漏能力，再统一回填残留语义。

- **[17:10] Action**: 补完 Samurai 第一轮遗漏能力并复跑门禁
  - Result: `src/games/smashup/abilities/samurai.ts` 已继续接入 `Honor the Ancestors / Way of the Warrior(+3 分支) / Final Haiku / Sakura Garden` 的第一轮能力；`newFactionAbilities.test.ts` 已新增 `samurai_samurai_chan / samurai_honor_the_ancestors / samurai_shogun / samurai_final_haiku` 覆盖，`newBaseAbilities.test.ts` 已补 `base_shoguns_palace / base_sakura_garden` 强化断言；`npx vitest run src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/newBaseAbilities.test.ts` 通过，`npm run typecheck` 通过，`openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive` 通过。
  - Next: 转入四派系统一审计与新交互 E2E 收口。

### Phase: 统一审计与收尾
**Status**: Complete

- **[17:18] Action**: 运行四派系统一 gameplay 审计并修复显式硬错误
  - Result: 已确认默认 `vitest` 配置会排除 `*audit*.test.ts`，必须改用 `vitest.config.audit.ts`；`npx vitest run src/games/smashup/__tests__/abilityBehaviorAudit.test.ts --config vitest.config.audit.ts --configLoader native` 最终 `21 passed`。过程中额外发现 `cowboys_stagecoach` 存在 `abilityTags: ['onPlay']` 但未注册执行器的硬错误，现已补 `Stagecoach` 的 MVP 实现与 `newFactionAbilities.test.ts` 最小回归。
  - Next: 跑浏览器层新交互 E2E，并输出证据文档。

- **[17:32] Action**: 跑通三条 Oops gameplay E2E 并留存截图
  - Result: `e2e/smashup/smashup-phase-transition-simple.e2e.ts` 已新增 `Ancient Egyptians bury/uncover`、`Cowboys duel direct click`、`Samurai extra play` 三条用例；三条命令均通过，并生成对应的 before/after 显式证据截图。
  - Next: 写统一 evidence，并把真实覆盖边界回填到 planning 文件。

- **[17:40] Action**: 汇总 gameplay E2E evidence 与残留风险
  - Result: 已新增 `evidence/smashup/smashup-oops-faction-gameplay-e2e-test.md`，明确三条浏览器交互证据、截图绝对路径与限制说明；`task_plan.md`、`findings.md`、`progress.md` 已同步回填统一审计入口、`Stagecoach` MVP 范围，以及 `Ancient Egyptians / Samurai` 两条 E2E 属于“注入当前交互”而非 full-chain 的事实边界。
  - Next: 复跑最终门禁，确认本轮可交付状态。

- **[17:43] Action**: 复跑最终门禁并确认收尾状态
  - Result: `npm run typecheck` 通过，`npx openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive` 通过，`npx vitest run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native` 通过（`76 passed, 1 skipped`），`npx vitest run src/games/smashup/__tests__/abilityBehaviorAudit.test.ts --config vitest.config.audit.ts --configLoader native` 通过（`21 passed`）。
  - Next: 向用户汇报已完成范围、证据落点与仍需后续补完的官方语义缺口。

### Phase: duel official-chain validation
**Status**: Complete

- **[18:34] Action**: 将 Cowboys 决斗浏览器用例升级为官方链路并补关键截图点
  - Result: `e2e/smashup/smashup-phase-transition-simple.e2e.ts` 中的 Cowboys 用例已从“选中敌方随从后直接结算”升级为完整 `Pinkerton -> 决斗牌 -> Deputy -> 结算` 链路，并新增 `pinkerton / duel-card / deputy-card / deputy-target / resolve` 五张显式证据截图。
  - Next: 运行用例并核对画面。

- **[18:37] Action**: 借助 E2E 暴露并修复 Deputy 收尾的真实链路 bug
  - Result: 发现 `smashup_duel_deputy_target` 在推进下一阶段时使用了弃牌前旧状态，导致 `Deputy` 已弃置却又被重新排入同一玩家提示；现已在 `src/games/smashup/domain/duel.ts` 中先模拟 `CARDS_DISCARDED + addTempPower` 再推进阶段，消除重复提示并确保决斗正常收口。
  - Next: 复跑单测与 E2E。

- **[18:39] Action**: 复跑决斗门禁并人工核图
  - Result: `node .\\scripts\\infra\\vitest-cli-safe.mjs run src\\games\\smashup\\__tests__\\newFactionAbilities.test.ts src\\games\\smashup\\__tests__\\newBaseAbilities.test.ts --configLoader native` 通过；`npm run test:e2e:ci:file -- smashup-phase-transition-simple.e2e.ts "Oops Cowboys 决斗交互应按官方链路完成 Pinkerton/决斗牌/Deputy/结算"` 通过；已人工核对五张截图，确认决斗横幅、Pinkerton 按钮、决斗牌跳过按钮、Deputy 选牌/选目标与结算后敌方离场全部符合预期。
  - Next: 回填 evidence / planning 文件并向用户汇报。

- **[21:10] Action**: 收口 Cowboys 决斗链 i18n 混用
  - Result: 已确认根因是 `src/games/smashup/domain/duel.ts` 的阶段标题/跳过按钮仍是硬编码中文，而 `Board.tsx` 决斗横幅已走 locale；现已给交互选项补 `labelKey/labelParams` 渲染入口，补齐 `duel.ts` 的 locale key，并让 `PromptOverlay.tsx` 与 `Board.tsx` 的快捷按钮统一解析这些 key。`npm run typecheck` 通过，`newFactionAbilities + newBaseAbilities` 共 `123 passed, 1 skipped`，`npm run test:e2e:ci:file -- smashup-phase-transition-simple.e2e.ts "Oops Cowboys 决斗交互应按官方链路完成 Pinkerton/决斗牌/Deputy/结算"` 再次通过。
  - Next: 提交、推送并为这轮 i18n 收尾补开新 PR。

## Session: 2026-04-23 Home V2 视觉统一二次收口
- **Status:** in_progress
- Actions taken:
  - 将 `HomeV2/HomeV2Draft` 手机横屏展示参数收敛为 `scale=1.36`、`offsetYPct=1.5`，并同步背景暗化强度，避免底部硬黑边。
  - 移除 `homeV2BookScene` 的 `bookClip` 裁切链路，恢复书本壳与翻页素材原始边界，减少矩形裁切感。
  - `homeV2Compact` 游戏卡从 `background-image` 改为统一 `border-image` 九宫格；并恢复 `object-contain`，避免缩略图裁切不一致。
  - 左页目录改成固定 `6` 槽位双排骨架，保持第二排与第一排同节奏，避免第六张下沉。
  - 登录右页改为同材质九宫格容器，且 embedded Auth 取消 `autoFocus`，解决“右页顶端被吃/像弹窗漂移”。
  - 创建房间弹窗改用 `--runtime-viewport-height` 计算最大高度，并收紧间距，确保移动横屏下首屏可见底部动作按钮。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/components/auth/AuthModal.tsx src/pages/HomeV2.tsx src/pages/HomeV2Draft.tsx src/ugc/runtime/ui-scene/scenes/homeV2BookScene.ts src/components/lobby/GameList.tsx src/components/home-v2/LobbyDirectory.tsx src/components/home-v2/HomeTabPanels.tsx src/components/home-v2/GameDetails.tsx src/components/lobby/CreateRoomModal.tsx e2e/lobby.e2e.ts` | 0 error | 0 error（6 warning，均既有规则告警） | ✅ |
| Typecheck | `npm run typecheck` | 通过 | 通过 | ✅ |
| i18n 校验 | `npm run i18n:check` | 无缺失 | `no missing keys detected` | ✅ |
| E2E-查询入口链路 | `npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 通过 | 通过（重跑后稳定通过） | ✅ |
| E2E-密码入房链路 | `npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 详情页输入房间密码后可加入加密房间"` | 通过 | 通过 | ✅ |

## Session: 2026-04-26 Home V2 首页参考稿重构（首页先行）
- **Status:** in_progress
- Actions taken:
  - 在 `.worktrees\homepage-v2\` 中先执行版本更新；当前工作树版本已到 `0.5.61`。
  - 对照参考图确认首页当前主要差距：现状仍偏“书页上的卡片宫格 + 右侧书签”，目标是“顶部分类导航 + 双页目录列表 + 右上角身份/帮助入口”。
  - 首轮已把首页目录结构改成单个 spread 区内的前端排版版本：顶部分类按钮、右上角账号入口、左右两列目录条目、每条目缩略图/标题/简介/tag/人数信息。
  - 这一轮先保持旧书页舞台与右侧书签链路不动，目的是先把首页目录信息架构切到参考稿方向，下一轮再接 `background.png` 与更强的翻页/舞台背景收敛。
  - 用户进一步明确“要前端可用、移动端横屏 UI”，因此已放弃“整张首页截图直出”的误路线；现在首页回到真实 DOM 方案：`background.png` 作为书页底图，分类导航/账号入口/六个游戏条目全部由前端渲染。
  - `HomeV2.tsx` 现已在 `sceneState === overview && activeTab === lobby` 时走独立横屏舞台：按 `1672x941` 书页底图等比适配到手机横屏，不再复用旧 896x720 overview shell，也不再直接展示 `首页.png`。
  - `LobbyDirectory.tsx` 已重写为可交互目录页：顶部分类按钮为真实按钮；右上角账号入口真实可点；六个游戏条目为真实 DOM 卡片；点击仍能进入旧详情链路。
  - 为避免首页白块，`splendor` 与 `tictactoe` 缩略图改为前端绘制 fallback，而不是依赖缺失资源路径。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/components/home-v2/LobbyDirectory.tsx src/pages/HomeV2.tsx public/locales/zh-CN/lobby.json public/locales/en/lobby.json` | 0 error | 0 error，3 warning（JSON 文件未纳入 eslint + 组件文件既有 fast-refresh warning） | ✅ |
| Typecheck | `npm run typecheck` | 通过 | 通过 | ✅ |
| ESLint（exact homepage 收口） | `npx eslint src/pages/HomeV2.tsx e2e/lobby.e2e.ts` | 0 error | 0 error | ✅ |
| E2E-查询入口链路（前端可用横屏首页） | `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=600000 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 通过 | 通过；首页目录、右上角账号入口、返回 lobby、进入井字棋详情链路都通过 | ✅ |


## Session: 2026-04-27 Home V2 首页参考稿重构（2388x1080 真移动端继续收口）
- **Status:** in_progress
- Actions taken:
  - 将 `e2e/lobby.e2e.ts` 中 Home V2 首页查询入口的默认横屏视口从 `936x432` 切换到 `2388x1080`，防止后续会话回退到代理口径。
  - 按 `2388x1080` 真移动端分辨率重排 `LobbyDirectory.tsx`：放大顶部导航占位、放大六个目录条目、重新收右上角账号/工具入口，并继续收缩略图裁图脏边。
  - 初次复跑 E2E 遇到共享 single-worker 端口 `6273/20100/21100` 冲突；随后改用 `PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181` 成功跑通首页查询入口。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint（2388x1080 口径） | `npx eslint src/components/home-v2/LobbyDirectory.tsx e2e/lobby.e2e.ts` | 0 error | 0 error，1 warning（既有 `react-refresh/only-export-components`） | ✅ |
| E2E-查询入口链路（真移动端默认口径） | `npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 通过 | 首次因共享端口被占用失败；改用 `PW_E2E_SERVICE_REUSE=shared-single + 37974/30180/30181` 后通过 | ✅ |
| E2E-真分辨率量测 | 同上 | `home-v2-viewport=2388x1080` 且书页居中 | `width=2388 height=1080`；`widthRatio=0.798 heightRatio=0.993 center=(0.500,0.500)` | ✅ |

## Session: 2026-04-29 Home V2 去除旧右侧书签 steady-state 语义
- **Status:** in_progress
- Actions taken:
  - `src/pages/HomeV2.tsx` 已收掉旧 `CompiledSceneRenderer + scene tab` 在 steady state 的依赖：目录页、登录页、详情页现在全部走 exact stage / fold-line stage；`HomeSceneRenderer` 只保留开场 `open` 动画，不再进入 `tabs` 书签出现态。
  - 删除了 `sceneContext.showLegacyTabs`、`openLobbyTab/openRoomsTab`、`overview_left_page/overview_right_page` 这条旧 scene tab 驱动链路在 `HomeV2` 的运行时接线。
  - 登录页继续保留真实前端左右页：左页 `HomeV2LoginPanel`、右页 `HomeV2AuthFormPanel`；回目录只走页内 `home-v2-rooms-back-to-lobby`，不再依赖右侧书签。
  - `e2e/lobby.e2e.ts` 已补回归断言：目录页、登录页、详情页三段 steady state 都必须看不到 `home-v2-tab-* / tab_button_*` 旧右侧书签节点。
  - 首次复跑首页 E2E 因 Playwright full-page 大图截图触发 Node OOM；补充 `NODE_OPTIONS=--max-old-space-size=4096` 后同一条用例稳定通过。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint（去旧书签 steady-state） | `npx eslint src/pages/HomeV2.tsx e2e/lobby.e2e.ts` | 0 error | 0 error | ✅ |
| E2E-查询入口链路（无右侧书签 steady-state） | `NODE_OPTIONS=--max-old-space-size=4096 ... npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 通过，且目录/登录/详情 steady state 不再出现旧右侧书签节点 | 通过；`width=2388 height=1080`，`widthRatio=0.798 heightRatio=0.993 center=(0.500,0.500)`，旧书签节点断言通过 | ✅ |

## Session: 2026-04-29 Home V2 登录页 / 详情页视觉继续贴近参考稿
- **Status:** in_progress
- Actions taken:
  - `src/components/home-v2/HomeTabPanels.tsx` 已把登录页左页改成品牌页结构：大标题“易桌游” + 三条卖点说明；左页底部保留真实模式切换按钮，右页顶部增加页内登录/注册/找回密码切换条。
  - `src/components/auth/AuthModal.tsx` 新增 `showTitle`，供 Home V2 内嵌认证表单隐藏重复标题，避免右页同时出现两层标题语义。
  - `src/components/home-v2/GameDetails.tsx` 已把详情页顶部操作按钮改成深色按钮语义，并继续提高详情页正文、搜索框、房间表的对比度和字号。
  - 首页查询入口 E2E 已新增 `rooms-auth-entry` 截图，补登录页真实书页态证据。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint（登录页 / 详情页视觉批次） | `npx eslint src/components/home-v2/HomeTabPanels.tsx src/components/home-v2/GameDetails.tsx src/components/auth/AuthModal.tsx src/pages/HomeV2.tsx e2e/lobby.e2e.ts` | 0 error | 0 error | ✅ |
| Typecheck | `npm run typecheck` | 通过 | 通过 | ✅ |
| E2E-查询入口链路（补登录页截图后） | `NODE_OPTIONS=--max-old-space-size=4096 ... npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 通过并生成 `rooms-auth-entry` / `detail-entry` 最新截图 | 通过 | ✅ |

## Session: 2026-04-30 Home V2 登录页 / 详情页二次压稿（移动端横屏）
- **Status:** completed
- Actions taken:
  - 继续在 `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2` / `feat/homepage-v2` 内推进，不切新分支、不换 worktree。
  - `src/components/home-v2/HomeTabPanels.tsx`：左页账号入口从厚按钮改成文字导航；右页去掉大白卡容器，只保留页内切换条与真实内嵌认证表单。
  - `src/components/auth/AuthModal.tsx`：embedded 模式下上调表单宽度、标签字号、输入框边界与提交按钮尺寸，保留现有 `auth-*` 测试锚点。
  - `src/components/home-v2/GameDetails.tsx`：左页压缩首屏纵向节奏，确保教程按钮完整可见；右页将房间表收成更轻的账页式行列表。
  - `public/locales/zh-CN/lobby.json` / `public/locales/en/lobby.json`：补 `homeV2.tabs.rooms.accountActionLabel`，避免新文案只靠默认值兜底。
  - 复跑 ESLint、Typecheck 与同一条首页 -> rooms -> 返回 -> detail E2E，并复看最新关键截图。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/components/home-v2/HomeTabPanels.tsx src/components/home-v2/GameDetails.tsx src/components/auth/AuthModal.tsx` | 0 error | 0 error | ✅ |
| Typecheck | `npm run typecheck` | 通过 | 通过 | ✅ |
| E2E-首页到详情 | `NODE_OPTIONS=--max-old-space-size=4096 BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=900000 PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 首页、rooms/login、detail 三个 steady state 在 2388x1080 横屏下保持可用且不回退 | 通过；日志持续为 `width=2388 height=1080`、`center=(0.500,0.500)`、`rowDelta=(0.00,0.00,0.00)` | ✅ |

### Current visual verdict
- `detail-entry.png`：已摆脱教程按钮被裁切的退步，左页首屏信息完整；右页 6 行真房间仍完整留在书页内。
- `rooms-auth-entry.png`：已去掉大白卡 modal 残留，但右页输入区对比度仍比参考稿弱，后续还可以继续提可读性。

## Session: 2026-04-30 Home V2 翻页结构改为页级 rotateY（按掘金折线翻页思路）
- **Status:** completed
- Actions taken:
  - 读取用户指定参考：掘金文章《怎么实现一个3d翻书效果》`https://juejin.cn/post/6844903665216520206`；确认目标是页级 `rotateY` 翻转，不是继续调当前整张 stage 的 skew/rotate 参数。
  - 重写 `src/components/home-v2/FoldLinePageFlipStage.tsx`：引入 stage-size 与 page-rect 裁切，把翻页拆成 `sourceStage(base) + target revealed page + turning source front + turning target back`。
  - 修改 `src/pages/HomeV2.tsx`：向翻页组件显式传 `overviewStageSize/detailStageSize` 和 `leftPageRect/rightPageRect`。
  - 修改 `e2e/lobby.e2e.ts` 一处断言，避免翻页收口瞬间的重复文本触发 strict locator 误报。
  - 复跑 ESLint / Typecheck / HomeV2 E2E，并复看 50% 翻页截图。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/components/home-v2/FoldLinePageFlipStage.tsx src/pages/HomeV2.tsx e2e/lobby.e2e.ts` | 0 error | 0 error | ✅ |
| Typecheck | `npm run typecheck` | 通过 | 通过 | ✅ |
| E2E-首页到详情 | `NODE_OPTIONS=--max-old-space-size=4096 BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=900000 PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 结构改写后首页/翻页/详情链路仍通过 | 通过；日志持续为 `width=2388 height=1080`、`center=(0.500,0.500)`、`rowDelta=(0.00,0.00,0.00)` | ✅ |

### Visual verdict
- `page-flip-to-detail-50.png`：不再是整张目录/详情内容一起被压进翻页层运动，而是只剩单张纸在翻，核心问题已修掉。
- `page-flip-back-to-catalog-50.png`：反向翻页同样回到页级结构；当前剩余提升空间主要是折线层次和阴影质感，而不是错误的数据/布局绑定。



## Session: 2026-05-03 Home V2 正向 50% 折页继续压实
- **Status:** in_progress
- Actions taken:
  - 继续只改 `src/components/home-v2/FoldLinePageFlipStage.tsx` 的正向折页分支，不碰首页/详情 steady state。
  - `buildFoldGeometry('br')`：降低正向折页 `rotateY`、略增 `sheetScaleX`、加重 `underShadow` 与 `outerShadow`，让 50% 时翻起页片更宽、更像整页。
  - `CornerCurlOverlay`：为正向折页单独降低泛白 screen wash、降低纸张蒙层、提高 source 内容对比度，并补 `fold crease` 阴影。
  - 复跑 ESLint / Typecheck / 同一条 HomeV2 E2E，并主动复看正向/反向 50% 与 detail steady state 截图。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/components/home-v2/FoldLinePageFlipStage.tsx e2e/lobby.e2e.ts` | 0 error | 0 error | ✅ |
| Typecheck | `npm run typecheck` | 通过 | 通过 | ✅ |
| E2E-首页到详情 | `PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 BG_HOME_V2_VIEWPORT=2388x1080 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 继续抓到真实 50% 并保持链路可用 | 通过；日志持续出现 `page-flip-to-detail-50 => raw=0.500` 与 `page-flip-back-to-catalog-50 => raw=0.500` | ✅ |

### Current visual verdict
- `page-flip-to-detail-50.png`：正向 50% 已从“偏薄偏白的折片”继续收成“带冻结内容的一整张书页在翻”；右页缩略图、标题和人数列在翻起层中更可辨，折痕与落影也更明确。
- `page-flip-back-to-catalog-50.png`：反向 50% 维持当前较稳的纸页感，没有被这轮正向调参带坏。
- 当前仍未到最终收口：正向 50% 虽明显优于上轮，但整体仍略偏浅，只能说方向继续收紧，不应提前宣称终稿。

## Session: 2026-05-03 Home V2 正向翻页改为冻结 DOM 克隆
- **Status:** in_progress
- Actions taken:
  - 放弃“翻页当下再位图快照”的路线，改为在 steady state 预热可见 stage 的 DOM 冻结克隆。
  - `FoldLinePageFlipStage.tsx`：新增 `visibleStageCaptureRef`；`overview/detail` 稳态时缓存克隆 HTML；`flippingToDetail` 时仅让正向折页层吃冻结克隆；`flippingToOverview` 暂时保留旧 live 方案避免黑块回归。
  - 再调一轮正向纸感参数（更低 brightness、更高 contrast、更重 crease / rim shadow），只针对正向折页。
  - 复跑 ESLint 与同一条 HomeV2 E2E，并主动复看正向/反向 50% 截图。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/components/home-v2/FoldLinePageFlipStage.tsx e2e/lobby.e2e.ts` | 0 error | 0 error | ✅ |
| E2E-首页到详情 | `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=600000 PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 BG_HOME_V2_VIEWPORT=2388x1080 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 正向/反向 50% 继续可抓且链路可用 | 通过；正向 `sourceSnapshotReady=true`，反向保留 live 路线 | ✅ |

### Current visual verdict
- `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-to-detail-50.png`：正向 50% 方向已经改对，翻起层确实不再是“活的 UI 整页跟着飞”；但纸感依旧偏浅、透明感仍在，不能据此宣称完成。
- `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-back-to-catalog-50.png`：反向 50% 当前恢复到更稳的旧效果，没有黑块回归。

## Addendum（2026-05-04）：Home V2 正向 50% 的方向纠偏
- 本轮确认：前面反复不达标，根因不只是透明度/阴影，而是**页片建模方向错了**——此前更像“右页外侧卷起一片纸板”，不是“整张右页从书脊翻向左侧”。
- 实际落点：`src/components/home-v2/FoldLinePageFlipStage.tsx`
  - `buildFoldGeometry('br')`：把正向 50% 的折线目标从右页中后部直接拉回书脊侧，`transformOrigin` 回到接近 gutter；
  - 正向中间帧同步重算 `rotateY / rotateZ / sheetScaleX / sheetTranslateXPct`，不再让翻起层像竖板立在右页外侧；
  - `CornerCurlOverlay`：恢复正面 source 内容到前表面，让翻起层重新带上真实目录内容，而不是一块空白纸板。
- 本轮命令：
  - `npx eslint src/components/home-v2/FoldLinePageFlipStage.tsx e2e/lobby.e2e.ts`
  - `npm run typecheck`
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=600000 PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 BG_HOME_V2_VIEWPORT=2388x1080 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"`
- 我实际看图后的结论：
  - 正向 50%：`D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-to-detail-50.png` 已从“右侧竖板/空白硬纸片”推进为“从书脊翻出的整页”，目录标题、缩略图和按钮已实际贴在翻起层上，方向比上轮明显正确。
  - 反向 50%：`D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-back-to-catalog-50.png` 仍保持当前可接受的回翻效果，没有被这轮正向纠偏带坏。
  - 但仍未达到最终验收：正向 50% 虽然方向修正成功，但纸页厚度、背页立体感和遮挡实感还不够，仍能看出“前端假翻页”的味道，不能据此收口。

## Addendum（2026-05-08）：Home V2 正向 50% 中间帧过线
- **Status:** completed
- Actions taken:
  - 继续只收 `src/components/home-v2/FoldLinePageFlipStage.tsx` 的正向 `flippingToDetail` 中间帧纸感，不扩范围。
  - 复跑 ESLint / Typecheck / 同一条 HomeV2 E2E，并重新实际核对正向 50%、反向 50% 与稳态截图。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/components/home-v2/FoldLinePageFlipStage.tsx src/pages/HomeV2Draft.tsx e2e/lobby.e2e.ts` | 0 error | 0 error | ✅ |
| Typecheck | `npm run typecheck` | 通过 | 通过 | ✅ |
| E2E-首页到详情 | `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=600000 PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 BG_HOME_V2_VIEWPORT=2388x1080 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 抓到真实 50% 且链路可用 | 通过；日志继续出现 `page-flip-to-detail-50 => raw=0.500` / `page-flip-back-to-catalog-50 => raw=0.500` | ✅ |

### Current visual verdict
- `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-to-detail-50.png`：本轮已越过验收线；正向 50% 不再像均匀发白的半透明硬片，而是更接近单张薄纸。
- `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-back-to-catalog-50.png`：反向 50% 仍稳，没有被本轮正向继续收口带坏。
- `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-detail-entry.png` / `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-homepage-catalog.png`：详情稳态与首页基线未回退。

## Addendum（2026-05-08）：Home V2 反向 50% 去重与整页回翻修正
- **Status:** in_progress
- Actions taken:
  - 检查用户指出的 `page-flip-back-to-catalog-50.png`，确认“王权显示两个”不是错觉，而是反向链路同时绘制了 base overview + flat detail + turning detail。
  - `src/components/home-v2/FoldLinePageFlipStage.tsx`：把反向 `bl` 几何从“小角卷页”改成更接近整张左页从中缝翻回去；同时把 flat 层改为目标 overview reveal，去掉反向重复 source 叠画。
  - 复跑 ESLint / Typecheck / 同一条 HomeV2 E2E，并重新实际核对正向/反向 50% 图。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/components/home-v2/FoldLinePageFlipStage.tsx src/pages/HomeV2Draft.tsx e2e/lobby.e2e.ts` | 0 error | 0 error | ✅ |
| Typecheck | `npm run typecheck` | 通过 | 通过 | ✅ |
| E2E-首页到详情 | `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=600000 PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 BG_HOME_V2_VIEWPORT=2388x1080 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 正反 50% 继续可抓且链路可用 | 通过；日志继续出现 `page-flip-to-detail-50 => raw=0.500` / `page-flip-back-to-catalog-50 => raw=0.500` | ✅ |

### Current visual verdict
- `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-back-to-catalog-50.png`：重复“王权”已消失，反向 50% 已从乱叠层修成单张左页从中缝回翻的方向。
- `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-to-detail-50.png`：正向 50% 未被这轮反向结构修正带坏。
## Addendum（2026-05-08）：反向 50% 内容泄漏修掉并进入可验收状态
- 本轮继续沿“页面内容只在 baseStage，翻页层只做装饰纸页”的方向收口，不再把业务 DOM 塞回 `CornerCurlOverlay`。
- `src/components/home-v2/FoldLinePageFlipStage.tsx` 已清理：
  - 删除 `CornerCurlOverlay` 的 `frontStage/frontSnapshot/backStage/backSnapshot` 等失效内容参数；
  - 删除旧 `SnapshotPageFill` / DOM 克隆承载路线；
  - 隐藏 turn.js 页从真实 overview/detail 内容改成透明占位页，避免驱动层在 50% 中间帧泄漏房间列表或详情内容。
- `src/pages/HomeV2.tsx` / `src/pages/HomeV2Draft.tsx` 已同步删除不再使用的 `renderDetailShellStage` 传参与定义；`HomeV2Draft` 中旧 `toDetailPageRect/toOverviewPageRect` 传参也已清掉。
- 最新验证：
  - `npx eslint src/components/home-v2/FoldLinePageFlipStage.tsx src/pages/HomeV2.tsx src/pages/HomeV2Draft.tsx e2e/lobby.e2e.ts`：0 error
  - `npm run typecheck`：通过
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=600000 PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 BG_HOME_V2_VIEWPORT=2388x1080 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"`：通过。
- 我实际看图后的结论：
  - 反向 50% `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-back-to-catalog-50.png`：重复王权没有回归，窄缝房间列表泄漏消失，右页是目录目标页；达到本轮可验收线。
  - 正向 50% `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-to-detail-50.png`：未被反向修复带坏，仍是目标详情页 + 中缝单张纸边。
- 当前剩余：只有轻微纸张质感 polish 空间，不再是阻止验收的结构性 blocker。
