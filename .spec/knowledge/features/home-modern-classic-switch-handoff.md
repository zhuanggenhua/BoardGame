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
- 本轮提交：`5fb1a48b8a88470e559a5980f977db4c12a779f9`（双风格实现）、`01360bd4aabd9e39b4c60efe673ffd6fc2a3a9e4`（业务 / 视觉测试分账）、`db6b61b739950f91fef424452bf7bdccb49c5c97`（运行 manifest 缺项下载计划修复）、`a0116f957a501b94c461ad2f7e5a48e52959238a`（退役旧书本入口）、`4a6a1881791b0a0c7a66b20b29af67603bd58002`（Fate 骑乘行为场景与卡图诊断）。用户已明确授权将最终候选分支推送到 GitHub `zhuanggenhua/BoardGame` 的同名候选分支；不推 `main`、不部署，推送后核验 SHA。
- 未向 `main` 推送、未部署。未上传截图、trace、数据库、node_modules、忽略素材或密钥。

## 用户当前要求

- 首页只提供现代（当前平台首页）与经典（既有大厅）两种风格，在桌面和移动设置中切换；不新增第三套主题。
- 选择即时生效并在刷新后保留。旧 `book` 偏好迁移为现代，只改首页风格相关本地键。
- 首页仅有现代与经典两种样式。旧 `/dev/home-v2-preview` 及 `/dev/home-v2-authoring` 开发路径均重定向到当前首页，不再渲染书本首页；旧页面模块不由 App 路由加载。
- 自动化只验证行为并按 TDD；几何、颜色、尺寸、裁切等由独立人工视觉清单验收。用户把后续首页与 Fate 验收交给其它 AI；不要直接联系其它 AI。

## 实现清单

- `src/lib/homeV2Routing.ts` 使用既有 `bg_home_entry_style` 键；仅接受 `modern` / `classic`，旧 `book` 映射并迁移为 `modern`，保留原 `classic` 与其它本地偏好。
- `HomeEntry` 订阅同页 / 同源标签的偏好变化并切换当前页面；`HomeStyleSettings` 对访客和登录用户均可访问。
- 现代页继续用 `PlatformHomeSurface`；经典页复用原大厅 `CategoryPills` / `GameList` 组合。主页游戏与房间处理逻辑仍由同一 `Home` 持有。
- 移动方向门禁不再为旧书本预览切横屏；两条旧首页开发路由回到当前用户所选首页。
- `.spec/knowledge/standards/testing-tdd.md` 与 `e2e-verification.md` 明确业务自动化与视觉验收分账。`openspec/changes/add-home-style-preference/` 记录能力变更；全视觉验收仍待后续。
- Home 账户测试不再断言顶栏几何、封面 `object-fit` 或卡片尺寸；保留登录身份、通知入口、账户切换、收藏持久化 / 隔离及正式图片响应 / 解码行为。
- Fate `hand-layout-real-board.e2e.ts` 增加正式卡图请求、manifest / 本地素材映射和失败诊断；图片位置矩形仅在失败诊断中采集，不作断言。`iskandar-riding-choice.e2e.ts` 用合法官方牌实例构造确定场景，保护实付费用、无障碍费用说明、三张上限及第四张拒绝行为。两份 E2E 不新增布局几何断言，已单独提交；完整 Fate E2E 未运行、未验收。
- Fate UI 源码包含在来源候选提交 `b8f5d84e...` 中；不能据此宣称 Fate 验收通过。

## 验证结果

- TDD Red：实现前，新增的现代选择、旧 `book` 迁移及查询兼容 3 项测试如预期失败，暴露默认风格仍为经典且不识别现代值。
- Green：路由、HomeEntry、设置控件、移动方向相关 4 个测试文件共 **25/25 通过**。
- 旧 `/dev/home-v2-preview` 与 `/dev/home-v2-authoring` 的重定向行为先以两项失败测试复现，再完成实现；加上现有主题回归后，5 个测试文件 **32/32 通过**。
- 资源下载器定向 Node 测试 **3/3 通过**；证明运行时 manifest 缺失项能补入计划并按 manifest hash 校验，不执行了网络素材下载。
- 针对改动源文件的 TypeScript 诊断 **0**；只加载本次依赖图时共收集 2,501 条诊断，全部在改动文件之外；未跑全仓 typecheck。
- 改动文件 ESLint **0 错误**；已有 React hooks 警告留待后续，不因本任务扩修。
- 最后一次定向 ESLint（首页路由、相关测试和两份 Fate E2E）以 `--quiet` 检查 **0 错误**。Fate E2E 用项目 app tsconfig 派生的临时类型检查在 HEAD 基线和当前文件上均为 **29 项既有诊断**，新增改动没有增加诊断；仓库没有独立 E2E tsconfig，本次不把它们表述为类型检查通过。
- OpenSpec `add-home-style-preference` 严格校验通过。CLI 的 PostHog 遥测请求因网络 `EACCES` 失败，但不影响校验退出码。
- Home 旧主题前的 `home-20261023-behavior-02` 账户 / 投稿 / 封面 3 项 E2E **3/3 通过**，仅是主题实现前状态，不证明本次风格切换。
- 单项教程路由用例 `home-tutorial-20261023-01` 首次停在 `/play/smashup/tutorial` 并失败，自动 retry 通过；应标为 **flaky**，不要写成稳定通过。
- 本轮未对风格切换跑正式浏览器 E2E，未生成新截图，未做视觉验收。Fate、首页建房 / 第二上下文加入 / 重连 / 资料持久化也未在本轮完成验收。

## 接手后的最小步骤

1. `git fetch candidate`，核对 `candidate/home-modern-classic-20261023` 的远端 SHA，再检出候选分支；不要合并到 `main`。
2. 运行主题行为回归：

   ```powershell
   node scripts/infra/vitest-cli-safe.mjs run src/lib/__tests__/homeV2Routing.test.ts src/pages/__tests__/HomeEntry.platform.test.tsx src/components/home/__tests__/HomeStyleSettings.test.tsx src/components/common/__tests__/MobileOrientationGuard.test.tsx src/pages/__tests__/App.localRoute.test.tsx --configLoader native --pool forks --no-file-parallelism --maxWorkers 1
   ```

3. 之后由接手者在 ≥1 GiB 空闲内存和独立 runtime / Mongo 下运行正式 Home 入口验证；主题本身尚未 E2E。既有 runner 端口为 `6273/20100/21100`，数据库必须仅用 `127.0.0.1:37022` 的新库，UGC 使用唯一 `%TEMP%\boardgame-home-acceptance-<ID>\ugc`。不得连接默认 `27017`。
4. 把两套真实主页的行为结果与人工视觉审查分开记录。保留当前失败 / flaky / 未运行项；Fate 不得标为完成。

## Betrayal 实施交接（2026-10-23）

### 本轮修改

- `src/games/betrayal/eventChoiceSurface.tsx`：事件结算卡面视觉改为优先由当前事件来源与合法候选解析，当前发现记录短暂清空时仍能解析卡面；事件选择、四项检定结果、奖励选择与确认操作归入同一紧凑操作组。
- `src/games/betrayal/decisionActionDockSurface.tsx`：共享决策操作区增加 `inline` 模式，默认底栏行为保持不变。
- `src/games/betrayal/Board.tsx`：移动到房间后启动探索者的镜头/棋子过渡。
- `e2e/betrayal/event-choice-coverage.e2e.ts`：保留吊死鬼四项检定、选择奖励前知识属性不变、确认后奖励生效等核心状态断言；移除了图像像素尺寸、边界框、布局属性和滚动/停稳画面像素对比断言。截图调用仅用于后续独立视觉证据，不代表视觉通过。
- `src/games/betrayal/__tests__/eventChoiceSurface.test.tsx`：保留选择后不立即结算、确认后提交、已完成属性不能重复选择、检定未可读前禁用下一项操作等行为覆盖。此处是现有实现后的回归补测，没有伪称实现前 Red 阶段。
- `src/games/betrayal/__tests__/Board.foundation.test.tsx`：保留奖励操作的合法性与结算断言，移除底栏位置断言。
- `e2e/betrayal/basic-flow.e2e.ts`、`e2e/betrayal/first-scenario.e2e.ts`、`e2e/betrayal/natural-event-turn.e2e.ts`：更新现有场景/结局步骤和自然探索事件回合入口；移动行为核对使用核心房间状态，不断言转场几何。

### 验证状态

- 本次未启动 Betrayal E2E、未采集截图，也未做视觉验收；当前分支没有据此宣称 Betrayal 完成。
- Home 先前 3/3 是主题切换前的旧验收结果，不覆盖本次主题实现和本轮 Betrayal 改动。
- 本轮需要后续至少运行对应行为单测，并按正式入口串行执行 `event-choice-coverage.e2e.ts`、`natural-event-turn.e2e.ts` 与 `first-scenario.e2e.ts`；截图由接手者另做人工审阅。完整验收和音频仍未完成。
- 标准单文件 E2E 命令：`node scripts/infra/run-e2e-single.mjs default e2e/betrayal/event-choice-coverage.e2e.ts`。使用正式隔离 runner、唯一 Mongo 数据库名及项目要求的内存门槛；不要连接本机原有 27017 数据库，也不要用旧共享 runtime 的端口。其它文件通过 runner 的文件参数逐个串行运行。

### 未纳入候选分支

- 五份工作区显示修改的 asset manifest 未见 Betrayal 运行清单内容变化：两份真实内容变化指向其它资源，三份与 HEAD 的 JSON 语义相同。本轮全部排除，未改动素材和校验表。
- `.home-e2e-deps-vkPD7u/`、`merge-audit/` 中临时依赖与诊断输出保留在隔离工作区，不提交。
- 未修改 D 盘主工程；未提交截图、视频、trace、数据库或素材。