# 冲突解决汇报：本地部署提交合并 origin/main

## 1. 背景

- 日期：2026-07-13
- 合并提交：1b1ac6c3e7dbb85de1d907b94a329472a4a49620
- 父 1：22dde009fa88bcbae41a66c84f2390e75c450a3c（本地“优化七大恨剧本选择双页展示”，同时包含 Pages 发布素材裁剪门禁提交）
- 父 2：d01de86809231617b478ade6f55512d04e402f35（远端“实装大杀四方迷你萌宠与时间旅行者 POD 版 #91”）
- 合并基线：3157e4ac5cdb091a70ed8558cc6a765130adb806
- 合并目的：把远端 origin/main 的 Smash Up 迷你萌宠 / 时间旅行者 POD 内容并入当前本地提交，随后继续推送与部署。

## 2. 冲突文件

- Git 合并过程没有产生真实冲突标记。
- pre-push 门禁对 merge commit 做双侧重叠审计，识别到 1 个混合结果文件：
  - src/games/qidahen/Board.tsx

## 3. 双边内容

### 父 1：本地七大恨剧本选择界面

- 新增 inspectedScenarioId，用于在鼠标悬停或键盘聚焦时切换右侧剧本预览。
- 将剧本选择界面改为书页式双栏：左侧 qidahen-scenario-vote-card-rail 展示三张剧本卡，右侧 qidahen-scenario-vote-feature-card 展示大卡焦点预览。
- 保留房主点选剧本的原有 onCastScenarioVote 入口，并把不可用人数提示继续挂在对应剧本卡上。
- 将席位状态整合进右侧页面，继续展示房主、当前玩家、已选剧本和等待状态。

### 父 2：远端七大恨设置文案 i18n 修复

- QidahenSetupObjectChoice 增加 useTranslation('game-qidahen')，把“缺少正式卡图”改为 board.setup.missingOfficialCardArt。
- QidahenInMatchSetupOverlay 增加 currentSeatLabel，把“本席”改为 board.setup.currentSeat。
- 把“待完成 N 项 / 已完成”改为 board.setup.pendingItems 与 board.setup.completed，避免界面直出中文文案。

## 4. 裁决结果

- 最终 src/games/qidahen/Board.tsx 同时保留父 1 的剧本选择双页布局和父 2 的设置流程 i18n 修复。
- 没有用父 1 或父 2 整文件覆盖另一侧；重叠文件属于自动合并后的混合结果。
- 本地双页 UI 只改 QidahenScenarioVoteScreen 区域；远端 i18n 修复只改设置对象选择与前置设置面板区域，语义不互斥。
- 远端 PR91 的 Smash Up POD 资源、数据、测试和 OpenSpec 文档全部随合并保留。
- 本地 Pages 发布素材裁剪门禁与七大恨结构门禁也随合并保留。

## 5. 验证

- git diff --name-only --diff-filter=U 为空，没有遗留冲突标记文件。
- 七大恨重叠文件审计结果为“混合结果”，符合本次双边保留预期。
- 本地七大恨提交时已由提交钩子执行 lint-staged 与 tsc --noEmit 并通过。
- 首次 git push origin main 被 pre-push merge evidence 门禁拦截，原因正是缺少本文件；本文件用于补齐该审计证据后重新推送。

## 6. 结果

- 本次合并的唯一重叠文件已完成内容级裁决说明。
- 双方有效内容均保留，未删除远端 PR91 内容，也未丢弃本地七大恨与 Pages 发布门禁改动。
