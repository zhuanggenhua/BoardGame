# FantasyRealms 当前 UI 现场审计（2026-06-12）

## 审计目标

- 锁定当前根工作区 `D:\gongzuo\webgame\BoardGame` 的真实幻想国度 UI
- 核对此前引用的 `.worktrees/fantasyrealms` 证据是否属于当前实现
- 判断“当前 UI”与“历史完成图”是否为同一套正式牌桌实现

## 当前执行现场

- cwd / worktree：`D:\gongzuo\webgame\BoardGame`
- 运行地址：`http://127.0.0.1:4275/play/fantasyrealms/local`
- 当前桌面截图目录：`evidence/fantasyrealms/current-ui-audit-2026-06-12/`

## 当前根工作区真实截图

- 桌面端 `1440x1024`：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-live-desktop-current-1440x1024.png`
- 紧凑横屏视口 `1024x768`：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-stacked-current-1024x768.png`
  - 说明：文件名里的 `stacked` 是历史命名，实际语义按“紧凑横屏”处理。

## 修复后当前根工作区真实截图

- 桌面端 `1440x1024`（双人 opening）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-live-desktop-current-1440x1024-fixed.png`
- 桌面端 `1440x1024`（六人 opening）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-live-desktop-6p-1440x1024-fixed.png`
- 紧凑横屏视口 `1024x768`（六人 opening）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-stacked-current-1024x768-fixed.png`
  - 说明：文件名里的 `stacked` 是历史命名，实际语义按“紧凑横屏”处理。

## 本轮继续收敛后的当前根工作区真实截图

- 桌面端 `1440x1024`（六人 opening，补回桌边焦点便签与中央公共河占位）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-live-desktop-6p-1440x1024-polished-2026-06-12.png`
- 紧凑横屏视口 `1024x768`（六人 opening，保持同一横屏牌桌家族）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-compact-landscape-6p-1024x768-polished-2026-06-12.png`
- 紧凑横屏视口 `1024x768`（六人 opening，焦点区回到首屏且不再压手牌）：
  - `evidence/fantasyrealms/current-ui-audit-2026-06-12/fantasyrealms-compact-landscape-6p-1024x768-focus-repositioned-2026-06-12.png`

## 历史 worktree 证据

以下截图来自兄弟 worktree `D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms`，只能作为历史候选实现，不能再当“当前 UI”：

- `D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms\evidence\fantasyrealms\fantasyrealms-minimal-live-desktop-2026-06-06.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms\evidence\fantasyrealms\fantasyrealms-6p-stacked-insight-priority-2026-06-06.png`

## 审计结论

### 1. 当前根工作区与历史 worktree 不是同一套 UI

- 根工作区 `1440x1024` 当前真实页面只剩桌面壳层，中央公共区与手牌实体卡图均未正常呈现，不能视为“已完成桌面牌桌”。
- 根工作区 `1024x768` 当前紧凑横屏视口仍在走另一套重面板样式，与桌面端 `1440x1024` 不属于同一套视觉家族。
- 历史 worktree 的 `minimal live` 截图与当前根工作区截图相比，卡牌渲染、信息密度、顶部结构、右上分数区和整体视觉语言都明显不同。

### 2. 此前“已完成”口径不能继续沿用到当前根工作区

- `evidence/fantasyrealms/fantasyrealms-foundation-completion-audit-2026-06-06.md`
- `evidence/fantasyrealms/fantasyrealms-minimal-desktop-check-2026-06-06.md`

以上文档引用的截图均指向 `.worktrees/fantasyrealms` 下的历史产物，不足以证明当前根工作区 `fantasyrealms` 已通过真实页面验收。

### 3. 当前问题不是“单个按钮摆错”

本次问题属于：

- 当前执行现场与历史证据混用
- 同一游戏桌面端与紧凑横屏端并存两套正式感 UI
- 当前根工作区真实运行时未达到既有 foundation 完成口径

因此，这不是按钮位置级别的问题，而是 `当前实现对象`、`验收对象`、`历史证据对象` 被混成一件事。

## 后续收口要求

- 后续任何“当前 UI 已修好 / 已验收 / 给我截图”汇报，必须优先引用本工作区新的真实运行时截图。
- 若继续参考 `.worktrees/fantasyrealms`，必须明确标注它只是历史候选实现，不能再直接当当前完成态。
- `fantasyrealms` 下一步应先收敛“当前正式桌面壳层是哪一套”，再进入具体 UI 修复。

## 本轮修复结果

- 当前根工作区已把 `fantasyrealms` 的桌面端与紧凑横屏视口收敛到同一套横屏牌桌壳层。
- 定向测试已通过：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/fantasyrealms --configLoader native`
- 当前 `1440` 桌面与 `1024` 紧凑横屏截图不再呈现两套不同游戏的 UI 家族。
- 当前仍保留一项后续清理：旧历史 evidence 文案与旧布局分支的彻底降级/清退还未做完，因此这条 change 还不能算全部收口。
