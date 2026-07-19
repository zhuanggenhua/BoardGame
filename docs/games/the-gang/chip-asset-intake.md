# The Gang 筹码素材录入合同

## 当前结论

- 已基于规则书基础版材料表和 TTS TwoHand 脚本锁定 36 个普通筹码：白/黄/橙/红各 0-8 星；TwoHand 按双倍人数使用 7/8 星，9-10 个排名槽时补 0 星。
- 1-6 星资源来自 `temp/the-gang-intake/asset-audit/category-sheets/chips_500.jpg` 的 AI 图面核验；0/7/8 星资源来自本地 TTS `Mods/Images`，并用 Workshop JSON 中的 `chipGUIDs` / `zeroChipGUIDs` 反查确认。
- 当前普通筹码资源已完成语义命名、正式落盘、压缩、manifest 更新，并接入 `src/games/the-gang/Board.tsx` 的筹码按钮。隐藏牌背、52 张扑克牌牌面、警报、金条、桌面/牌槽和规则参考已在规则对象素材矩阵中完成运行时接入记录。
- 2026-07-16 复核发现黄筹码 1/2 星、橙筹码 1/2 星曾误接入 0 星同色筹码，已按 500x500 源图联系表修正为 1/2 星源图，并重新生成压缩产物和 manifest。
- 2026-07-18 复核 TTS 脚本：`refreshActivePlayerCount()` 在 TwoHand 下把人数乘 2，`getActiveChipMap()` 激活 1-8 星并在超过 8 个排名槽时补 0 星，`updateNotepadRankings()` 对每名玩家插入上/下两条排名项。

## 映射表

| 规则对象 | 轮次 | 源图索引 | 正式文件 | Runtime key | 状态 |
| --- | --- | ---: | --- | --- | --- |
| 白筹码 1 星 | Round 1 / Pre-Flop | #48 | `public/assets/i18n/zh-CN/the-gang/chips/round-1-white-1.png` | `the-gang/chips/round-1-white-1` | runtime-wired-compressed-manifested |
| 白筹码 2 星 | Round 1 / Pre-Flop | #46 | `public/assets/i18n/zh-CN/the-gang/chips/round-1-white-2.png` | `the-gang/chips/round-1-white-2` | runtime-wired-compressed-manifested |
| 白筹码 3 星 | Round 1 / Pre-Flop | #15 | `public/assets/i18n/zh-CN/the-gang/chips/round-1-white-3.png` | `the-gang/chips/round-1-white-3` | runtime-wired-compressed-manifested |
| 白筹码 4 星 | Round 1 / Pre-Flop | #24 | `public/assets/i18n/zh-CN/the-gang/chips/round-1-white-4.png` | `the-gang/chips/round-1-white-4` | runtime-wired-compressed-manifested |
| 白筹码 5 星 | Round 1 / Pre-Flop | #149 | `public/assets/i18n/zh-CN/the-gang/chips/round-1-white-5.png` | `the-gang/chips/round-1-white-5` | runtime-wired-compressed-manifested |
| 白筹码 6 星 | Round 1 / Pre-Flop | #72 | `public/assets/i18n/zh-CN/the-gang/chips/round-1-white-6.png` | `the-gang/chips/round-1-white-6` | runtime-wired-compressed-manifested |
| 白筹码 7 星 | Round 1 / Pre-Flop | TTS `ed00da`; SHA `558EABF4142E` | `public/assets/i18n/zh-CN/the-gang/chips/round-1-white-7.png` | `the-gang/chips/round-1-white-7` | runtime-wired-compressed-manifested |
| 白筹码 8 星 | Round 1 / Pre-Flop | TTS `236209`; SHA `F9DDDAFF94F3` | `public/assets/i18n/zh-CN/the-gang/chips/round-1-white-8.png` | `the-gang/chips/round-1-white-8` | runtime-wired-compressed-manifested |
| 白筹码 0 星 | Round 1 / Pre-Flop | TTS `d9f6fe`/`5069d5`; SHA `E79F31914D50` | `public/assets/i18n/zh-CN/the-gang/chips/round-1-white-0.png` | `the-gang/chips/round-1-white-0` | runtime-wired-compressed-manifested |
| 黄筹码 1 星 | Round 2 / Flop | #3 | `public/assets/i18n/zh-CN/the-gang/chips/round-2-yellow-1.png` | `the-gang/chips/round-2-yellow-1` | runtime-wired-compressed-manifested |
| 黄筹码 2 星 | Round 2 / Flop | #19 | `public/assets/i18n/zh-CN/the-gang/chips/round-2-yellow-2.png` | `the-gang/chips/round-2-yellow-2` | runtime-wired-compressed-manifested |
| 黄筹码 3 星 | Round 2 / Flop | #80 | `public/assets/i18n/zh-CN/the-gang/chips/round-2-yellow-3.png` | `the-gang/chips/round-2-yellow-3` | runtime-wired-compressed-manifested |
| 黄筹码 4 星 | Round 2 / Flop | #83 | `public/assets/i18n/zh-CN/the-gang/chips/round-2-yellow-4.png` | `the-gang/chips/round-2-yellow-4` | runtime-wired-compressed-manifested |
| 黄筹码 5 星 | Round 2 / Flop | #18 | `public/assets/i18n/zh-CN/the-gang/chips/round-2-yellow-5.png` | `the-gang/chips/round-2-yellow-5` | runtime-wired-compressed-manifested |
| 黄筹码 6 星 | Round 2 / Flop | #126 | `public/assets/i18n/zh-CN/the-gang/chips/round-2-yellow-6.png` | `the-gang/chips/round-2-yellow-6` | runtime-wired-compressed-manifested |
| 黄筹码 7 星 | Round 2 / Flop | TTS `d156c8`; SHA `0FD430CF67B1` | `public/assets/i18n/zh-CN/the-gang/chips/round-2-yellow-7.png` | `the-gang/chips/round-2-yellow-7` | runtime-wired-compressed-manifested |
| 黄筹码 8 星 | Round 2 / Flop | TTS `afc838`; SHA `E5EB6357C743` | `public/assets/i18n/zh-CN/the-gang/chips/round-2-yellow-8.png` | `the-gang/chips/round-2-yellow-8` | runtime-wired-compressed-manifested |
| 黄筹码 0 星 | Round 2 / Flop | TTS `bf5d29`/`5ff3d8`; SHA `440FEA20695E` | `public/assets/i18n/zh-CN/the-gang/chips/round-2-yellow-0.png` | `the-gang/chips/round-2-yellow-0` | runtime-wired-compressed-manifested |
| 橙筹码 1 星 | Round 3 / Turn | #33 | `public/assets/i18n/zh-CN/the-gang/chips/round-3-orange-1.png` | `the-gang/chips/round-3-orange-1` | runtime-wired-compressed-manifested |
| 橙筹码 2 星 | Round 3 / Turn | #29 | `public/assets/i18n/zh-CN/the-gang/chips/round-3-orange-2.png` | `the-gang/chips/round-3-orange-2` | runtime-wired-compressed-manifested |
| 橙筹码 3 星 | Round 3 / Turn | #20 | `public/assets/i18n/zh-CN/the-gang/chips/round-3-orange-3.png` | `the-gang/chips/round-3-orange-3` | runtime-wired-compressed-manifested |
| 橙筹码 4 星 | Round 3 / Turn | #32 | `public/assets/i18n/zh-CN/the-gang/chips/round-3-orange-4.png` | `the-gang/chips/round-3-orange-4` | runtime-wired-compressed-manifested |
| 橙筹码 5 星 | Round 3 / Turn | #22 | `public/assets/i18n/zh-CN/the-gang/chips/round-3-orange-5.png` | `the-gang/chips/round-3-orange-5` | runtime-wired-compressed-manifested |
| 橙筹码 6 星 | Round 3 / Turn | #111 | `public/assets/i18n/zh-CN/the-gang/chips/round-3-orange-6.png` | `the-gang/chips/round-3-orange-6` | runtime-wired-compressed-manifested |
| 橙筹码 7 星 | Round 3 / Turn | TTS `8aba64`; SHA `53FD6E9F2F19` | `public/assets/i18n/zh-CN/the-gang/chips/round-3-orange-7.png` | `the-gang/chips/round-3-orange-7` | runtime-wired-compressed-manifested |
| 橙筹码 8 星 | Round 3 / Turn | TTS `1ac5ac`; SHA `DC18D6AFF7D3` | `public/assets/i18n/zh-CN/the-gang/chips/round-3-orange-8.png` | `the-gang/chips/round-3-orange-8` | runtime-wired-compressed-manifested |
| 橙筹码 0 星 | Round 3 / Turn | TTS `8befc3`/`17be1e`; SHA `87563ADA36DC` | `public/assets/i18n/zh-CN/the-gang/chips/round-3-orange-0.png` | `the-gang/chips/round-3-orange-0` | runtime-wired-compressed-manifested |
| 红筹码 1 星 | Round 4 / River | #79 | `public/assets/i18n/zh-CN/the-gang/chips/round-4-red-1.png` | `the-gang/chips/round-4-red-1` | runtime-wired-compressed-manifested |
| 红筹码 2 星 | Round 4 / River | #35 | `public/assets/i18n/zh-CN/the-gang/chips/round-4-red-2.png` | `the-gang/chips/round-4-red-2` | runtime-wired-compressed-manifested |
| 红筹码 3 星 | Round 4 / River | #33 | `public/assets/i18n/zh-CN/the-gang/chips/round-4-red-3.png` | `the-gang/chips/round-4-red-3` | runtime-wired-compressed-manifested |
| 红筹码 4 星 | Round 4 / River | #50 | `public/assets/i18n/zh-CN/the-gang/chips/round-4-red-4.png` | `the-gang/chips/round-4-red-4` | runtime-wired-compressed-manifested |
| 红筹码 5 星 | Round 4 / River | #85 | `public/assets/i18n/zh-CN/the-gang/chips/round-4-red-5.png` | `the-gang/chips/round-4-red-5` | runtime-wired-compressed-manifested |
| 红筹码 6 星 | Round 4 / River | #37 | `public/assets/i18n/zh-CN/the-gang/chips/round-4-red-6.png` | `the-gang/chips/round-4-red-6` | runtime-wired-compressed-manifested |
| 红筹码 7 星 | Round 4 / River | TTS `5c8122`; SHA `17724C1C334F` | `public/assets/i18n/zh-CN/the-gang/chips/round-4-red-7.png` | `the-gang/chips/round-4-red-7` | runtime-wired-compressed-manifested |
| 红筹码 8 星 | Round 4 / River | TTS `8efe19`; SHA `00252B3FCAC4` | `public/assets/i18n/zh-CN/the-gang/chips/round-4-red-8.png` | `the-gang/chips/round-4-red-8` | runtime-wired-compressed-manifested |
| 红筹码 0 星 | Round 4 / River | TTS `a98040`/`e1c372`; SHA `EC8A592ED25A` | `public/assets/i18n/zh-CN/the-gang/chips/round-4-red-0.png` | `the-gang/chips/round-4-red-0` | runtime-wired-compressed-manifested |

## 后续动作

- 普通筹码已接入运行时；后续验证需覆盖真实页面是否加载 0/7/8 图片，以及 TwoHand 四人局是否显示 8 个排名槽。
