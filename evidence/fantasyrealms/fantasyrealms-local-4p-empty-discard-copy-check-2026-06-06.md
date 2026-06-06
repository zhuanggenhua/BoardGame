# FantasyRealms 4 人首回合空弃牌堆文案核对（2026-06-06）

## 目标

核对 `FantasyRealms` 在 4 人基础版首回合、公开弃牌堆为空时，不再展示“可直接拿 1 张公开弃牌”的误导文案。

## 环境

- worktree：`D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms`
- 路径：`http://127.0.0.1:4276/play/fantasyrealms/local?players=4`
- 浏览器：Playwright / Chromium headless

## 操作

1. 打开 4 人本地页；
2. 保持首帧不操作；
3. 核对顶部阶段横幅与公开弃牌区空态文案。

## 结果

- 顶部横幅显示：`当前没有公开弃牌，只能先从牌库摸牌。`
- 未再出现旧文案：`先决定你的抓牌来源：从牌库摸牌，或直接拿 1 张公开弃牌。`
- 中间阶段摘要仍保持：`基础版首回合：弃牌堆为空，只能从牌库摸 1 张`
- 公开弃牌区空态仍保持：`当前还没有任何公开弃牌。先从牌库摸牌，弃掉的第一张牌会从这里开始累积。`

证据：

- `evidence/fantasyrealms/fantasyrealms-local-4p-empty-discard-copy-2026-06-06.png`

## 结论

4 人基础版首回合的空弃牌堆状态，顶部主提示已与真实可执行动作对齐。
