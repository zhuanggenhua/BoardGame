# FantasyRealms 6 人低高度横屏手牌优先级核对（2026-06-06）

## 目标

核对 `FantasyRealms` 在低高度横屏移动端下，首屏是否已经优先展示手牌，而不是继续被高回合面板和大空弃牌区挤出首屏。

## 环境

- worktree：`D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms`
- 路径：`http://127.0.0.1:4276/play/fantasyrealms/local?players=6`
- 视口：`844 x 390`
- 浏览器：Playwright / Chromium headless

## 修前现象

- 首屏几乎只看到回合面板与公开弃牌区空态
- 7 张手牌要继续下滚才看得到
- 右下全局悬浮按钮会压到最右侧手牌边缘

## 修后结果

- 低高度横屏已切到 `compact landscape` 布局
- 首屏顺序改为：
  1. 回合面板
  2. 手牌
  3. 公开弃牌堆 + 当前焦点
  4. 当前总分 + 结束进度
  5. 牌库
- 首屏可直接看到整排手牌
- 手牌行与公开弃牌区已为右下悬浮按钮预留安全边距，不再压住最后一张牌

证据：

- `evidence/fantasyrealms/fantasyrealms-6p-mobile-landscape-hand-priority-2026-06-06.png`

## 结论

低高度横屏移动端已经从“信息堆太高、手牌掉到首屏外”改成“首屏先看手牌，再看辅助区”，符合当前牌桌化移动端适配方向。
