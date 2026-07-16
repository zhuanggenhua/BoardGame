# The Gang 筹码素材录入合同

## 当前结论

- 已基于规则书基础版材料表锁定 24 个基础版筹码：白/黄/橙/红各 1-6 星。
- 这些资源来自 `temp/the-gang-intake/asset-audit/category-sheets/chips_500.jpg` 的 AI 图面核验；排除了 0/7/8 星扩展筹码和红色逃跑图标。
- 当前筹码资源已完成语义命名、正式落盘、压缩、manifest 更新，并接入 `src/games/the-gang/Board.tsx` 的筹码按钮。隐藏牌背、52 张扑克牌牌面、警报、金条、桌面/牌槽和规则参考已在规则对象素材矩阵中完成运行时接入记录。
- 2026-07-16 复核发现黄筹码 1/2 星、橙筹码 1/2 星曾误接入 0 星同色筹码，已按 500x500 源图联系表修正为 1/2 星源图，并重新生成压缩产物和 manifest。

## 映射表

| 规则对象 | 轮次 | 源图索引 | 正式文件 | Runtime key | 状态 |
| --- | --- | ---: | --- | --- | --- |
| 白筹码 1 星 | Round 1 / Pre-Flop | #48 | `public/assets/i18n/zh-CN/the-gang/chips/round-1-white-1.png` | `the-gang/chips/round-1-white-1` | runtime-wired-compressed-manifested |
| 白筹码 2 星 | Round 1 / Pre-Flop | #46 | `public/assets/i18n/zh-CN/the-gang/chips/round-1-white-2.png` | `the-gang/chips/round-1-white-2` | runtime-wired-compressed-manifested |
| 白筹码 3 星 | Round 1 / Pre-Flop | #15 | `public/assets/i18n/zh-CN/the-gang/chips/round-1-white-3.png` | `the-gang/chips/round-1-white-3` | runtime-wired-compressed-manifested |
| 白筹码 4 星 | Round 1 / Pre-Flop | #24 | `public/assets/i18n/zh-CN/the-gang/chips/round-1-white-4.png` | `the-gang/chips/round-1-white-4` | runtime-wired-compressed-manifested |
| 白筹码 5 星 | Round 1 / Pre-Flop | #149 | `public/assets/i18n/zh-CN/the-gang/chips/round-1-white-5.png` | `the-gang/chips/round-1-white-5` | runtime-wired-compressed-manifested |
| 白筹码 6 星 | Round 1 / Pre-Flop | #72 | `public/assets/i18n/zh-CN/the-gang/chips/round-1-white-6.png` | `the-gang/chips/round-1-white-6` | runtime-wired-compressed-manifested |
| 黄筹码 1 星 | Round 2 / Flop | #3 | `public/assets/i18n/zh-CN/the-gang/chips/round-2-yellow-1.png` | `the-gang/chips/round-2-yellow-1` | runtime-wired-compressed-manifested |
| 黄筹码 2 星 | Round 2 / Flop | #19 | `public/assets/i18n/zh-CN/the-gang/chips/round-2-yellow-2.png` | `the-gang/chips/round-2-yellow-2` | runtime-wired-compressed-manifested |
| 黄筹码 3 星 | Round 2 / Flop | #80 | `public/assets/i18n/zh-CN/the-gang/chips/round-2-yellow-3.png` | `the-gang/chips/round-2-yellow-3` | runtime-wired-compressed-manifested |
| 黄筹码 4 星 | Round 2 / Flop | #83 | `public/assets/i18n/zh-CN/the-gang/chips/round-2-yellow-4.png` | `the-gang/chips/round-2-yellow-4` | runtime-wired-compressed-manifested |
| 黄筹码 5 星 | Round 2 / Flop | #18 | `public/assets/i18n/zh-CN/the-gang/chips/round-2-yellow-5.png` | `the-gang/chips/round-2-yellow-5` | runtime-wired-compressed-manifested |
| 黄筹码 6 星 | Round 2 / Flop | #126 | `public/assets/i18n/zh-CN/the-gang/chips/round-2-yellow-6.png` | `the-gang/chips/round-2-yellow-6` | runtime-wired-compressed-manifested |
| 橙筹码 1 星 | Round 3 / Turn | #33 | `public/assets/i18n/zh-CN/the-gang/chips/round-3-orange-1.png` | `the-gang/chips/round-3-orange-1` | runtime-wired-compressed-manifested |
| 橙筹码 2 星 | Round 3 / Turn | #29 | `public/assets/i18n/zh-CN/the-gang/chips/round-3-orange-2.png` | `the-gang/chips/round-3-orange-2` | runtime-wired-compressed-manifested |
| 橙筹码 3 星 | Round 3 / Turn | #20 | `public/assets/i18n/zh-CN/the-gang/chips/round-3-orange-3.png` | `the-gang/chips/round-3-orange-3` | runtime-wired-compressed-manifested |
| 橙筹码 4 星 | Round 3 / Turn | #32 | `public/assets/i18n/zh-CN/the-gang/chips/round-3-orange-4.png` | `the-gang/chips/round-3-orange-4` | runtime-wired-compressed-manifested |
| 橙筹码 5 星 | Round 3 / Turn | #22 | `public/assets/i18n/zh-CN/the-gang/chips/round-3-orange-5.png` | `the-gang/chips/round-3-orange-5` | runtime-wired-compressed-manifested |
| 橙筹码 6 星 | Round 3 / Turn | #111 | `public/assets/i18n/zh-CN/the-gang/chips/round-3-orange-6.png` | `the-gang/chips/round-3-orange-6` | runtime-wired-compressed-manifested |
| 红筹码 1 星 | Round 4 / River | #79 | `public/assets/i18n/zh-CN/the-gang/chips/round-4-red-1.png` | `the-gang/chips/round-4-red-1` | runtime-wired-compressed-manifested |
| 红筹码 2 星 | Round 4 / River | #35 | `public/assets/i18n/zh-CN/the-gang/chips/round-4-red-2.png` | `the-gang/chips/round-4-red-2` | runtime-wired-compressed-manifested |
| 红筹码 3 星 | Round 4 / River | #33 | `public/assets/i18n/zh-CN/the-gang/chips/round-4-red-3.png` | `the-gang/chips/round-4-red-3` | runtime-wired-compressed-manifested |
| 红筹码 4 星 | Round 4 / River | #50 | `public/assets/i18n/zh-CN/the-gang/chips/round-4-red-4.png` | `the-gang/chips/round-4-red-4` | runtime-wired-compressed-manifested |
| 红筹码 5 星 | Round 4 / River | #85 | `public/assets/i18n/zh-CN/the-gang/chips/round-4-red-5.png` | `the-gang/chips/round-4-red-5` | runtime-wired-compressed-manifested |
| 红筹码 6 星 | Round 4 / River | #37 | `public/assets/i18n/zh-CN/the-gang/chips/round-4-red-6.png` | `the-gang/chips/round-4-red-6` | runtime-wired-compressed-manifested |

## 后续动作

- 筹码已接入运行时；后续验证需覆盖真实页面是否加载这些图片。
