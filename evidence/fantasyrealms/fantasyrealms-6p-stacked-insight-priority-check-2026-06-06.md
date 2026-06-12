# FantasyRealms 6 人历史 worktree 紧凑横屏信息层级重排核对（2026-06-06）

> 历史说明：本文件记录的是兄弟 worktree `D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms` 的 `2026-06-06` 候选实现；文中的 `stacked` 为旧命名，当前语义统一按“紧凑横屏”理解。

## 目标

核对 `FantasyRealms` 在 `1024 x 768` 紧凑横屏布局下，焦点牌与分数是否已经回到手牌附近，而不是继续被压到手牌区下方的深层位置。

## 环境

- worktree：`D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms`
- 路径：`http://127.0.0.1:4276/play/fantasyrealms/local?players=6`
- 视口：`1024 x 768`
- 浏览器：Playwright / Chromium headless

## 修前现象

- 紧凑横屏布局只把回合面板提到了首屏
- 焦点牌、当前总分仍跟着左右侧栏一起沉到手牌区后面
- 首屏看到的主要是回合面板与公开弃牌区，无法在同一屏直接对照焦点牌和当前得分

## 修后结果

- `当前焦点` 与 `当前总分` 已进入同一块首屏中段的 `stacked insight` 区
- 顺序变为：
  1. 回合面板
  2. 公开弃牌堆
  3. 焦点牌 + 当前总分
  4. 手牌
  5. 结束进度 + 牌库
- `结束进度` 与 `牌库` 已被压到次级辅助区，不再和焦点牌争首屏注意力

证据：

- `evidence/fantasyrealms/fantasyrealms-6p-stacked-insight-priority-2026-06-06.png`

## 结论

紧凑横屏布局的信息优先级已经改成“弃牌区 -> 焦点/分数 -> 手牌 -> 辅助区”，符合当前实体牌桌方向对首屏信息层级的要求。
