# FantasyRealms 6 人终局文案与徽记核对（2026-06-06）

## 目标

核对 `FantasyRealms` 在 6 人基础版真实终局态下：

1. 左侧分数表不再继续给某名玩家标注 `当前行动`
2. 回合摘要与结束进度区切到终局复盘口径，不再继续重复基础版流程说明

## 环境

- worktree：`D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms`
- 路径：`http://127.0.0.1:4276/play/fantasyrealms/local?players=6`
- 浏览器：Playwright / Chromium headless
- 视口：
  - 桌面：`1440 x 1100`
  - 堆叠断点：`1024 x 768`

## 修前现象

- 对局结束后，左侧分数表仍会给旧 `currentPlayer` 保留 `当前行动`
- 回合摘要仍显示基础版抓牌/弃牌流程
- 结束进度区底部仍重复 `当前为 6 人基础版...` 这类规则说明，而不是终局说明

## 修后结果

### 桌面端

- 不再出现 `当前行动`
- 回合摘要切为：`终局已揭示全部官方总分与最终排名`
- 结束进度区底部切为：`终局已揭示全部官方总分、胜者与最终排名；当前牌桌仅保留复盘信息。`

证据：

- `evidence/fantasyrealms/fantasyrealms-6p-gameover-desktop-2026-06-06.png`

### 堆叠断点

- 不再出现 `当前行动`
- 已命中终局复盘口径
- 不再出现旧的 `当前为 6 人基础版：所有玩家起手 7 张...` 规则说明

证据：

- `evidence/fantasyrealms/fantasyrealms-6p-gameover-1024-2026-06-06.png`

## 结论

6 人终局态的左侧摘要与右侧结束进度区，已经从“仍像进行中”切回正式终局复盘口径。
