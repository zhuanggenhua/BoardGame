# 冲突解决汇报：feat/homepage-v2

## 1. 背景
- base: `main`（合并前头部 `3f84cf73`）
- head: `feat/homepage-v2`（先补入 `da66473c`，包含主页样式切换与原生方向同步修复）
- 触发命令: `git merge feat/homepage-v2 --no-commit --no-ff`

## 2. 冲突文件
- `AGENTS.md`
- `android/app/src/main/java/top/easyboardgame/app/MainActivity.java`
- `e2e/lobby.e2e.ts`
- `e2e/smashup-faction-selection-sound.e2e.ts`
- `e2e/smashup/smashup-helpers.ts`
- `findings.md`
- `package-lock.json`
- `package.json`
- `progress.md`
- `public/assets/common/assets-manifest.json`
- `src/components/auth/AuthModal.tsx`
- `src/components/common/MobileOrientationGuard.tsx`
- `src/components/common/__tests__/MobileOrientationGuard.test.tsx`
- `src/components/common/overlays/ModalBase.tsx`
- `src/components/home-v2/GameDetails.tsx`
- `src/components/lobby/CreateRoomModal.tsx`
- `src/components/system/TextEntryAutoScrollAgent.tsx`
- `src/core/AssetLoader.ts`
- `src/pages/HomeV2.tsx`
- `task_plan.md`
- `vite.config.ts`

## 3. 解决策略

### 3.1 主分支优先
- `findings.md` / `progress.md` / `task_plan.md`：
  保留主分支版本，避免把工作树内的任务态文档覆盖主分支当前记录。
- `e2e/smashup/smashup-helpers.ts`：
  保留主分支版本；与 Home V2 无关。
- `e2e/smashup-faction-selection-sound.e2e.ts`：
  保持主分支删除结果；分支内已存在 `e2e/smashup/smashup-faction-selection-sound.e2e.ts`，不再把旧根路径文件带回。
- `src/core/AssetLoader.ts`：
  保留主分支的多候选本地化资源回退逻辑；未回退其现有 `candidateLocales + publicUrl + remote` 组合。

### 3.2 首页分支优先，并回补主分支有效修复
- `src/pages/HomeV2.tsx`：
  以首页分支的书页主页实现为准，保留当前翻页、分类与详情页结构。
- `src/components/auth/AuthModal.tsx`：
  以首页分支的纸面 modal 结构为准，补回 `ModalBase.preserveKeyboardLayout`，保留移动端键盘稳定性。
- `src/components/common/overlays/ModalBase.tsx`：
  合并两边能力，保留 Home V2 视觉分支，同时补回 `preserveKeyboardLayout` 和 `OverlayLayerProvider`。
- `src/components/lobby/CreateRoomModal.tsx`：
  以首页分支纸面弹窗为准，补回锁定视口的 modal CSS 变量和 `data-lock-layout-viewport`。
- `src/components/home-v2/GameDetails.tsx`：
  以首页分支详情页为准，补回主分支的创建房间防连点保护 `createRoomInFlightRef`。
- `src/components/common/MobileOrientationGuard.tsx`：
  以首页分支“书本横屏 / 经典竖屏”的路线为准。
- `src/components/common/__tests__/MobileOrientationGuard.test.tsx`：
  采用分支版，保留主分支原有 native 场景测试，同时带上首页方向 gate 测试。
- `android/app/src/main/java/top/easyboardgame/app/MainActivity.java`：
  保留首页分支的 `homeStyle=book|classic` 原生方向判定；不把 `homeV2DraftEnabledByBuild` 的旧横屏兜底逻辑带回。
- `src/components/system/TextEntryAutoScrollAgent.tsx`：
  合并双方意图，保留主分支“键盘已显示时不重复滚动”，同时补上分支的 `data-text-entry-autoscroll=\"off\"` 禁用开关。

### 3.3 双方都保留的配置/文档
- `AGENTS.md`：
  保留主分支已有的抽象门禁、SSH 规则和回归基线增强说明，同时补入首页分支新增的 `4.5 流程关键截图必须可继续操作`。
- `e2e/lobby.e2e.ts`：
  同时保留主分支的首页等待辅助和分支的证据截图辅助；保留主分支新增的本地房间 seatControllers 断言。
- `package.json` / `package-lock.json`：
  采用 `0.5.61`，避免把版本号回退到 `0.5.8`。
- `vite.config.ts`：
  同时保留 `forceBuiltinBundle` 与 Android `homeV2DraftEnabled` 元数据写入。
- `public/assets/common/assets-manifest.json`：
  同时保留主分支新增音频条目与首页分支的 Home V2 资源条目。

## 4. 风险评估
- Home V2 相关文件量较大，虽然冲突已裁决，但仍存在视觉细节和真机路径回归风险。
- `MainActivity` / `MobileOrientationGuard` / `HomeEntry` 组成一条 Web + Native 共享真相源链路；后续若再改单侧，容易重现方向不一致。
- 这次未跑完整 Playwright 回归和真机安装验证，仍有残余集成风险。

## 5. 回归与行为变化登记
- 原目标问题：
  - 主页样式切换需要通过悬浮球在书本/经典之间切换。
  - 书本主页默认横屏，经典主页默认竖屏，且 native 壳层与 web 路由必须一致。
- 本次额外保留的有效修复：
  - Auth / Create Room 的键盘布局稳定性。
  - 创建房间防重复提交。
  - 关键截图验收门禁补强。
- 未额外扩大范围：
  - SmashUp 旧根路径 E2E 文件不被带回。
  - 任务态 planning 文档不覆盖主分支当前记录。

## 6. 验证清单与结果
- `git diff --name-only --diff-filter=U`：通过
- `git diff --check --cached`：通过
- `npm run typecheck`：通过
- `npx vitest run src/lib/__tests__/homeV2Routing.test.ts src/components/common/__tests__/MobileOrientationGuard.test.tsx`：通过（12 tests）
- 未执行：
  - 完整 E2E 回归
  - 真机安装/方向切换复测

## 7. 最终提交信息
- merge commit: `196274f0`
- push 目标分支: `main`
