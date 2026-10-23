---
name: home-modern-classic-switch-handoff
description: 交接首页现代 / 经典风格切换实现与后续验收。
metadata:
  type: doc
  status: implementation-ready
---

# Home / Fate 实施交接

## 分支与提交

- 候选分支：`candidate/home-modern-classic-20261023`
- 本分支基于隔离快照 `0f3bf356dcd3c5787b72d6b150bdb974e804b35c`；其父图包含来源候选 `b8f5d84eacbef19e6e6bc1b6be5330b07dc5b053`，父提交 `6cf1a9178b00567e3d58c46ef17209b78016928c`。
- 本轮提交：`5fb1a48b8a88470e559a5980f977db4c12a779f9`（双风格实现）、`01360bd4aabd9e39b4c60efe673ffd6fc2a3a9e4`（业务 / 视觉测试分账）、`db6b61b739950f91fef424452bf7bdccb49c5c97`（运行 manifest 缺项下载计划修复）。远端候选分支推送待本机网络审批执行。
- 未向 `main` 推送、未部署。未上传截图、trace、数据库、node_modules、忽略素材或密钥。

## 用户当前要求

- 首页只提供现代（当前平台首页）与经典（既有大厅）两种风格，在桌面和移动设置中切换；不新增第三套主题。
- 选择即时生效并在刷新后保留。旧 `book` 偏好迁移为现代，只改首页风格相关本地键。
- 书本风格退出生产首页选择与渲染入口。内部 `/dev/home-v2-preview` 开发预览仍保留。
- 自动化只验证行为并按 TDD；几何、颜色、尺寸、裁切等由独立人工视觉清单验收。用户把后续首页与 Fate 验收交给其它 AI；不要直接联系其它 AI。

## 实现清单

- `src/lib/homeV2Routing.ts` 使用既有 `bg_home_entry_style` 键；仅接受 `modern` / `classic`，旧 `book` 映射并迁移为 `modern`，保留原 `classic` 与其它本地偏好。
- `HomeEntry` 订阅同页 / 同源标签的偏好变化并切换当前页面；`HomeStyleSettings` 对访客和登录用户均可访问。
- 现代页继续用 `PlatformHomeSurface`；经典页复用原大厅 `CategoryPills` / `GameList` 组合。主页游戏与房间处理逻辑仍由同一 `Home` 持有。
- 移动方向门禁不再按生产首页风格切到书本横屏；内部门禁预览保留。
- `.spec/knowledge/standards/testing-tdd.md` 与 `e2e-verification.md` 明确业务自动化与视觉验收分账。`openspec/changes/add-home-style-preference/` 记录能力变更；全视觉验收仍待后续。
- Home 账户测试不再断言顶栏几何、封面 `object-fit` 或卡片尺寸；保留登录身份、通知入口、账户切换、收藏持久化 / 隔离及正式图片响应 / 解码行为。
- Fate UI 源码已经包含在来源候选提交 `b8f5d84e...` 中；本轮没有宣称 Fate 验收通过。当前工作树里两份 Fate E2E 改动尚未提交，需接手者按新业务测试规范复核后决定是否保留。

## 验证结果

- TDD Red：实现前，新增的现代选择、旧 `book` 迁移及查询兼容 3 项测试如预期失败，暴露默认风格仍为经典且不识别现代值。
- Green：路由、HomeEntry、设置控件、移动方向相关 4 个测试文件共 **25/25 通过**。
- 资源下载器定向 Node 测试 **3/3 通过**；证明运行时 manifest 缺失项能补入计划并按 manifest hash 校验，不执行了网络素材下载。
- 针对改动源文件的 TypeScript 诊断 **0**；只加载本次依赖图时共收集 2,501 条诊断，全部在改动文件之外；未跑全仓 typecheck。
- 改动文件 ESLint **0 错误**；已有 React hooks 警告留待后续，不因本任务扩修。
- OpenSpec `add-home-style-preference` 严格校验通过。CLI 的 PostHog 遥测请求因网络 `EACCES` 失败，但不影响校验退出码。
- Home 旧主题前的 `home-20261023-behavior-02` 账户 / 投稿 / 封面 3 项 E2E **3/3 通过**，仅是主题实现前状态，不证明本次风格切换。
- 单项教程路由用例 `home-tutorial-20261023-01` 首次停在 `/play/smashup/tutorial` 并失败，自动 retry 通过；应标为 **flaky**，不要写成稳定通过。
- 本轮未对风格切换跑正式浏览器 E2E，未生成新截图，未做视觉验收。Fate、首页建房 / 第二上下文加入 / 重连 / 资料持久化也未在本轮完成验收。

## 接手后的最小步骤

1. `git fetch candidate`，核对 `candidate/home-modern-classic-20261023` 的远端 SHA，再检出候选分支；不要合并到 `main`。
2. 运行主题行为回归：

   ```powershell
   node scripts/infra/vitest-cli-safe.mjs run src/lib/__tests__/homeV2Routing.test.ts src/pages/__tests__/HomeEntry.platform.test.tsx src/components/home/__tests__/HomeStyleSettings.test.tsx src/components/common/__tests__/MobileOrientationGuard.test.tsx --configLoader native --pool forks --no-file-parallelism --maxWorkers 1
   ```

3. 之后由接手者在 ≥1 GiB 空闲内存和独立 runtime / Mongo 下运行正式 Home 入口验证；主题本身尚未 E2E。既有 runner 端口为 `6273/20100/21100`，数据库必须仅用 `127.0.0.1:37022` 的新库，UGC 使用唯一 `%TEMP%\boardgame-home-acceptance-<ID>\ugc`。不得连接默认 `27017`。
4. 把两套真实主页的行为结果与人工视觉审查分开记录。保留当前失败 / flaky / 未运行项；Fate 不得标为完成。
