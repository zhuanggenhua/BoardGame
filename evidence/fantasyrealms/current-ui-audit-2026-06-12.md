# FantasyRealms 当前 UI 现场审计（2026-06-12）

## 审计目标

- 锁定当前根工作区 `D:\gongzuo\webgame\BoardGame` 的真实幻想国度 UI
- 核对此前引用的 `.worktrees/fantasyrealms` 证据是否属于当前实现
- 判断“当前 UI”与“历史完成图”是否为同一套正式牌桌实现

## 当前执行现场

- cwd / worktree：`D:\gongzuo\webgame\BoardGame`
- 运行地址：`http://127.0.0.1:4275/play/fantasyrealms/local`
- 本轮主要核对路由：`http://127.0.0.1:4275/play/fantasyrealms/local?players=6`
- 当前桌面截图目录：`evidence/fantasyrealms/current-ui-audit-2026-06-12/`

## 当前根工作区真实截图

- 桌面端 `1440x1024`：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-live-desktop-current-1440x1024.png`
- 紧凑横屏视口 `1024x768`：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-compact-landscape-current-1024x768.png`

## 修复后当前根工作区真实截图

- 桌面端 `1440x1024`（双人 opening）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-live-desktop-current-1440x1024-fixed.png`
- 桌面端 `1440x1024`（六人 opening）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-live-desktop-6p-1440x1024-fixed.png`
- 紧凑横屏视口 `1024x768`（六人 opening）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-compact-landscape-current-1024x768-fixed.png`

## 本轮继续收敛后的当前根工作区真实截图

- 桌面端 `1440x1024`（六人 opening，补回桌边焦点便签与中央公共河占位）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-live-desktop-6p-1440x1024-polished-2026-06-12.png`
- 桌面端 `1440x1024`（六人 opening，继续压缩中央空区后的稳定截图）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-live-desktop-6p-1440x1024-density-polished-stable-2026-06-12.png`
- 桌面端 `1440x1024`（六人 opening，本轮资源就绪门禁后的真实截图）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-live-desktop-6p-1440x1024-asset-ready-2026-06-13.png`
- 桌面端 `1440x1024`（六人 opening，本轮继续压缩中区留白与辅助区比例后的真实截图）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-live-desktop-6p-1440x1024-density-tuned-asset-ready-2026-06-13.png`
- 桌面端 `1440x1024`（六人 opening，本轮把中央空公共河收成公共河位占位后的真实截图）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-live-desktop-6p-river-slots-asset-ready-2026-06-13.png`
- 桌面端 `1440x1024`（六人 opening，本轮手牌改成扇形持牌后的真实截图）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-live-desktop-6p-fanned-hand-asset-ready-2026-06-13.png`
- 桌面端 `1440x1024`（六人摸牌后进入弃牌阶段）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-live-desktop-6p-after-draw-2026-06-13.png`
- 桌面端 `1440x1024`（六人摸牌后进入弃牌阶段，本轮资源就绪门禁后的真实截图）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-live-desktop-6p-after-draw-asset-ready-2026-06-13.png`
- 桌面端 `1440x1024`（六人摸牌后进入弃牌阶段，本轮继续压缩中区留白与辅助区比例后的真实截图）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-live-desktop-6p-after-draw-density-tuned-asset-ready-2026-06-13.png`
- 桌面端 `1440x1024`（六人摸牌后进入弃牌阶段，本轮公共河位化后的真实截图）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-live-desktop-6p-after-draw-river-slots-asset-ready-2026-06-13.png`
- 桌面端 `1440x1024`（六人摸牌后进入弃牌阶段，本轮手牌改成扇形持牌后的真实截图）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-live-desktop-6p-after-draw-fanned-hand-asset-ready-2026-06-13.png`
- 紧凑横屏视口 `1024x768`（六人 opening，保持同一横屏牌桌家族）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-compact-landscape-6p-1024x768-polished-2026-06-12.png`
- 紧凑横屏视口 `1024x768`（六人 opening，焦点区回到首屏且不再压手牌）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-compact-landscape-6p-1024x768-focus-repositioned-2026-06-12.png`
- 紧凑横屏视口 `1024x768`（六人摸牌后 / 当前工作区真实运行时）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-compact-landscape-6p-1024x768-asset-ready-2026-06-13.png`
- 紧凑横屏视口 `1024x768`（六人摸牌后 / 本轮继续收小焦点条后的真实运行时）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-compact-landscape-6p-1024x768-density-tuned-asset-ready-2026-06-13.png`
- 紧凑横屏视口 `1024x768`（六人摸牌后 / 本轮公共河位化后的真实运行时）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-compact-landscape-6p-river-slots-asset-ready-2026-06-13.png`
- 紧凑横屏视口 `1024x768`（六人摸牌后 / 本轮手牌改成扇形持牌后的真实运行时）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-compact-landscape-6p-fanned-hand-asset-ready-2026-06-13.png`
- 桌面端 `1440x1024`（六人摸牌后 / 本轮把右侧焦点区收成桌边便签后的真实运行时）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-live-desktop-6p-focus-note-polished-2026-06-13.png`
- 紧凑横屏视口 `1024x768`（六人摸牌后 / 本轮把焦点条上提并收成桌边便签后的真实运行时）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-compact-landscape-6p-focus-note-polished-2026-06-13.png`
- 桌面端 `1440x1024`（六人 opening / 本轮把顶部状态收回桌边牌签并把公共河上提后的真实运行时）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-live-desktop-6p-topbar-river-anchor-2026-06-13.png`
- 紧凑横屏视口 `1024x768`（六人 opening / 本轮把顶部状态收回桌边牌签并把公共河上提后的真实运行时）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-compact-landscape-6p-topbar-river-anchor-2026-06-13.png`
- 桌面端 `1440x1024`（六人弃牌待确认 / 本轮确认按钮已与手牌分离后的真实运行时）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-live-desktop-6p-discard-pending-action-separated-2026-06-13.png`
- 紧凑横屏视口 `1024x768`（六人弃牌待确认 / 本轮确认按钮已尽量从手牌主阅读区移开后的真实运行时）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-compact-landscape-6p-discard-pending-action-separated-2026-06-13.png`
- 紧凑横屏视口 `1024x768`（六人弃牌待确认 / 本轮手牌为右侧操作走廊让位后的真实运行时）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-compact-landscape-6p-discard-pending-action-lane-2026-06-13.png`
- 桌面端 `1440x1024`（六人 opening / 本轮空公共河中央补出更像桌面等待位的锚点后的真实运行时）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-live-desktop-6p-river-anchor-center-stack-2026-06-13.png`
- 紧凑横屏视口 `1024x768`（六人 opening / 本轮空公共河中央补出更像桌面等待位的锚点后的真实运行时）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-compact-landscape-6p-river-anchor-center-stack-2026-06-13.png`
- 桌面端 `1440x1024`（六人真实弃牌已形成 / 本轮右侧焦点区不再重复预览桌上同牌后的真实运行时）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-live-desktop-6p-river-focus-dedup-2026-06-13.png`
- 紧凑横屏视口 `1024x768`（六人弃牌待确认 / 本轮右侧焦点便签去掉重复说明后的真实运行时）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-compact-landscape-6p-focus-note-dedup-2026-06-13.png`
- 桌面端 `1440x1024`（六人公共河已形成 4 张牌 / 本轮多牌态密度收紧后的真实运行时）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-live-desktop-6p-river-four-card-density-2026-06-13.png`
- 紧凑横屏视口 `1024x768`（六人公共河已形成 4 张牌 / 本轮紧凑横屏多牌态不再裁边后的真实运行时）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-compact-landscape-6p-river-four-card-density-2026-06-13.png`
- 桌面端 `1440x1024`（六人公共河已形成 7 张牌 / 本轮高密度多牌态继续收紧后的真实运行时）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-live-desktop-6p-river-seven-card-density-2026-06-13.png`
- 紧凑横屏视口 `1024x768`（六人公共河已形成 7 张牌 / 本轮高密度多牌态仍保持首屏可读后的真实运行时）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-compact-landscape-6p-river-seven-card-density-2026-06-13.png`

## 历史 worktree 证据

以下截图来自兄弟 worktree `D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms`，只能作为历史候选实现，不能再当“当前 UI”：

- `D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms\evidence\fantasyrealms\fantasyrealms-minimal-live-desktop-2026-06-06.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms\evidence\fantasyrealms\fantasyrealms-6p-stacked-insight-priority-2026-06-06.png`

## 审计结论

### 1. 当前根工作区与历史 worktree 仍需严格区分，但当前根工作区已经回到正式牌桌家族

- 历史 worktree 与当前根工作区仍然不是同一执行现场，二者证据不能混用。
- 但当前根工作区 `1440x1024 / 1024x768` 真实页面，现已能稳定呈现同一套横屏牌桌家族：统一的桌面材质、牌库角标、中央公共河、底部连续手牌带和右侧焦点便签。
- 当前根工作区新的 opening / 弃牌阶段截图，已经不再是“只剩桌面壳层、没有正常卡图”的早期状态。

### 2. 此前“已完成”口径不能继续沿用到当前根工作区

- `evidence/fantasyrealms/fantasyrealms-foundation-completion-audit-2026-06-06.md`
- `evidence/fantasyrealms/fantasyrealms-minimal-desktop-check-2026-06-06.md`

以上文档引用的截图均指向 `.worktrees/fantasyrealms` 下的历史产物，不足以证明当前根工作区 `fantasyrealms` 已通过真实页面验收。

### 3. 当前问题不是“单个按钮摆错”，但问题级别已从“对象混乱”收缩到“布局密度与残余异常”

本次问题最初属于：

- 当前执行现场与历史证据混用
- 同一游戏桌面端与紧凑横屏端并存两套正式感 UI
- 当前根工作区真实运行时未达到既有 foundation 完成口径

当前这条线已经把 `当前实现对象`、`验收对象`、`历史证据对象` 基本分开；剩余问题主要收缩为：

- opening 首屏中区仍偏空，但本轮已经从“大面积空舞台”继续收缩到“公共河位已成立、仍可再增强进行中感”的级别；
- 紧凑横屏虽已继续收小焦点条，但仍可以再压一点辅助区存在感；
- 偶发黑卡面现象曾在个别抓图里出现；本轮已把卡图未就绪时的运行时表现收成稳定回退，不再直接露出空黑壳，但仍需继续留意是否还有更深层资源时序问题。

## 后续收口要求

- 后续任何“当前 UI 已修好 / 已验收 / 给我截图”汇报，必须优先引用本工作区新的真实运行时截图。
- 若继续参考 `.worktrees/fantasyrealms`，必须明确标注它只是历史候选实现，不能再直接当当前完成态。
- 当前工作区自己的紧凑横屏 evidence，也不得再沿用 `stacked / 堆叠态` 旧命名，以免把横屏牌桌误解成竖屏方案。
- `fantasyrealms` 下一步应先收敛“当前正式桌面壳层是哪一套”，再进入具体 UI 修复。

## 本轮修复结果

- 当前根工作区已把 `fantasyrealms` 的桌面端与紧凑横屏视口收敛到同一套横屏牌桌壳层。
- 定向测试已通过：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/fantasyrealms --configLoader native`
- 当前 `1440` 桌面与 `1024` 紧凑横屏截图不再呈现两套不同游戏的 UI 家族。
- 本轮又补齐了两类真实页证据：
  - `opening`：桌边焦点便签、中央公共河占位、底部手牌带同时成立；
  - `after draw / discard`：进入弃牌阶段后，`8` 张手牌与右侧焦点便签仍保留同一牌桌语法。
- 本轮又补了一层资源就绪门禁：
  - atlas 未 ready 时，手牌先回退到稳定文字卡；
  - 牌背未 ready 时，牌库堆与焦点预览先回退到稳定暖色占位，不再直接露出黑卡壳。
- 本轮还继续收了一轮横屏牌桌密度：
  - 桌面端把手牌带上提、右侧焦点便签收窄、中央空公共河改成更像桌面物件的占位；
  - 紧凑横屏把焦点条继续压窄，避免再次长成第二套侧栏。
- 本轮又把空公共河的语法从“3 张大牌背摆拍”改成了“5 个公共河位占位”：
  - opening 首屏现在更像公共牌将要落位的牌桌中央区；
  - 即使弃牌堆还没开始形成，也不会再像展示台。
- 本轮又把底部手牌从“平直卡片条”收成了“扇形持牌”：
  - 桌面端与紧凑横屏都开始更像玩家手里的一把牌；
  - 进行中感已经不再只靠木桌底板和卡牌贴图本身。
- 本轮又把右侧焦点区从“亮色 UI 小卡片”继续收成了“桌边便签”：
  - 桌面端的焦点便签更贴近桌边物件，不再像独立控制台卡片；
  - 紧凑横屏把焦点条上提并缩窄，避免再次压到手牌区。
- 本轮又把顶部与中区的结构锚点收了一轮：
  - 顶部回合状态不再裸漂在桌面上，而是回到一条轻量桌边牌签；
  - opening 空公共河整体上提，首屏从“空桌预览”更接近“公共河即将开始形成”的牌桌。
- 本轮又收了一轮弃牌待确认态：
  - 桌面端确认按钮已离开手牌本体，不再直接盖在右侧手牌上；
  - 紧凑横屏也把确认按钮与手牌主阅读区拉开，当前仍有边缘接近，但已不再压住主文本区。
- 本轮又把紧凑横屏的右侧区位从“按钮硬塞在手牌边上”收成了更明确的操作走廊：
  - 手牌在出现 `确认弃置` 时不再默认铺满到底，而是主动给右侧操作区让位；
  - 右侧现在更像“焦点便签 + 操作按钮”的一组桌边交互，而不是手牌尾部再叠一个悬浮块。
- 本轮又把空公共河中央从“纯淡化槽位”收成了更明确的桌面等待位：
  - opening 首屏中央现在有更稳定的视觉锚点，不再只是几张几乎看不见的淡化卡影；
  - 这仍然只是空公共河占位语法，不代表新增规则对象或新增交互入口。
- 本轮又收掉了一层真实运行时里的重复焦点展示：
  - 当焦点牌本来就在桌面公共河或自己手牌里可见时，右侧焦点区不再重复放一张缩略预览；
  - 紧凑横屏摘要便签也去掉了重复解释句，只保留牌名与数值，避免长成竖排说明条。
- 本轮又把公共河真实多牌态的排布参数拆成了桌面 / 紧凑横屏两套：
  - 桌面端 4 张公共牌已不再像几张大海报横向孤立摆放；
  - 紧凑横屏 4 张公共牌已不再直接冲出左右边缘，而是回到首屏可阅读范围内。
- 本轮又把高密度公共河继续往“正常牌桌”方向收了一轮：
  - 7 张公共牌时，桌面端已经从“第二排过大、过散”收回到更像公共河本体的密排；
  - 紧凑横屏 7 张公共牌也不再发生边缘裁切，二排结构仍能留在首屏可读范围里。
- 本轮还顺手把 collapsed 焦点便签进一步收短：
  - 右侧摘要态继续去掉重复解释，只保留对象名与数值；
  - 高密度场景下，桌边便签不再比公共河本身更抢眼。
- 旧历史 evidence 文案与旧布局分支的主要降级工作已做完；当前 change 未完全收口的原因，已经从“证据混乱”转为“仍有视觉密度与残余异常待继续打磨”。
