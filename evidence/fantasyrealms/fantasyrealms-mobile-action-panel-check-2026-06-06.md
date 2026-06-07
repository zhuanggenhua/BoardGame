# FantasyRealms 移动端首屏行动面板核对（2026-06-06）

## 目标

核对 `FantasyRealms` 在移动端横屏首帧时，当前回合的主操作按钮是否仍落在首屏可见范围内。

## 环境

- worktree：`D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms`
- 路径：`http://127.0.0.1:4276/play/fantasyrealms/local?players=4`
- 视口：`844 x 390`
- 浏览器：Playwright / Chromium headless

## 修前现象

- 公开弃牌区和手牌区被排到首屏前部；
- 回合主按钮 `从牌库摸 1 张` 落在首屏之外；
- 实测按钮 `y = 1720.71`，明显超出 `390` 高度视口。

## 修后结果

- 首屏顶部新增移动端行动面板；
- 当前回合主按钮被提升到牌桌区之前；
- 当前 4 人基础版首回合实测按钮位置为：
  - `y = 170.02`
  - `height = 29.01`
  - 按钮底部 `199.03 <= 390`
- 结论：当前行动按钮已回到首屏可见范围。

证据：

- `evidence/fantasyrealms/fantasyrealms-mobile-action-panel-2026-06-06.png`

## 结论

移动端横屏首帧现在可以直接完成本回合主操作，不再需要先滚动到牌桌下方才能摸牌。
