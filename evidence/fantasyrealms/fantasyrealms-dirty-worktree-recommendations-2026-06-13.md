# Fantasy Realms dirty worktree 逐文件推荐动作表（2026-06-13）

## 先纠错：`main HEAD 候选版` 不是有效候选

- 你看到的 `evidence/fantasyrealms/fantasyrealms-ui-compare-main-head-candidate-2026-06-13.png` 只有“正在准备对局 / 加载游戏模块”。
- 它不是当前根目录 `main HEAD` 的正式 Fantasy Realms UI。
- 它实际来自临时树 `temp/baseline-origin-main`，该树当前是 detached `23cba24a`，而不是根目录当前 `main HEAD 5506666f`。
- 更关键的是：`23cba24a` 里连下面这些文件都不存在：
  - `src/games/fantasyrealms/Board.tsx`
  - `design-system/games/fantasyrealms.md`
  - `public/locales/zh-CN/game-fantasyrealms.json`
- 所以那张图只证明“房间壳层进了 loading”，不能证明任何 Fantasy Realms 牌桌 UI。后续不再把它当候选真相。

## 当前推荐口径

本表的前提只有一个：

- 用户认可的通过 UI，已经锁定为 `feat/game-fantasyrealms` 的**历史已验证 committed 线**

因此这里的“推荐动作”不是在重新选基线，而是在处理 **worktree 当前未提交继续偏移**。

动作枚举：

- `保留 committed 线`：根目录先不要再吸 dirty worktree 这部分
- `可单独吸收`：和通过 UI 基线不直接冲突，但应作为独立小决策处理
- `仅保留为过程/规范文档`：不算产品实现真相，后续若保留也应单独归档

## 逐文件建议

| 文件 | dirty 变化性质 | 推荐动作 | 原因 |
| --- | --- | --- | --- |
| `src/games/fantasyrealms/Board.tsx` | 大量 UI / 交互 / 命名 / 动效 / 双人变体提示继续偏移 | `保留 committed 线` | 这是当前最大不确定源；一旦继续吸收，就等于默认承认 dirty worktree 的下一版桌面真相。 |
| `src/games/fantasyrealms/__tests__/Board.foundation.test.tsx` | 跟随 `Board.tsx` 的合同测试大改 | `保留 committed 线` | 测试完全绑定实现，不应脱离 `Board.tsx` 单独吸。 |
| `design-system/games/fantasyrealms.md` | 加了交互来源裁定、横屏命名、证据来源门禁 | `仅保留为过程/规范文档` | 有价值，但它在约束“如何判断真相”，不是通过 UI 本体；不该借这次产品并线自动吞进主实现。 |
| `docs/games/fantasyrealms/design/README.md` | 加了“交互来源表”与未通过项说明 | `仅保留为过程/规范文档` | 这是审计/规范说明，不是当前通过 UI 本体。 |
| `e2e/fantasyrealms/fantasyrealms-live-flow.e2e.ts` | topbar 尺寸门限、动效选择器改成新类名 | `保留 committed 线` | 它在验证 dirty UI，不该先于 UI 裁决落地。 |
| `e2e/fantasyrealms/fantasyrealms-online-ai-golden.e2e.ts` | `stacked` 改 `compact-layout` | `保留 committed 线` | 命名与壳层判断直接跟 dirty UI 同步。 |
| `e2e/fantasyrealms/fantasyrealms-online-ai.e2e.ts` | 把抓牌入口、紧凑横屏壳、等待态断言全切到 dirty 交互 | `保留 committed 线` | 明显绑定 dirty UI/交互。 |
| `e2e/fantasyrealms/fantasyrealms-online-basic.e2e.ts` | 新增首页真实建房全流程、大量入口与交互断言 | `保留 committed 线` | 价值高，但改动面太大，且强绑定 dirty 当前实现；应单独审。 |
| `e2e/fantasyrealms/helpers/fantasyrealmsOnlineAi.ts` | helper 改成 `compact-layout`、抓牌按钮新口径、去掉旧说明断言 | `保留 committed 线` | 这只是 dirty E2E 的底座。 |
| `public/locales/en/game-fantasyrealms.json` | 新增 deck cue / draw hint / confirm hint 文案 | `保留 committed 线` | 文案直接服务 dirty 新交互；不应先吸再反推 UI。 |
| `public/locales/zh-CN/game-fantasyrealms.json` | 同上 | `保留 committed 线` | 同上。 |
| `src/games/__tests__/fantasyrealmsManifestIntegration.test.ts` | 额外校验 thumbnail 资源存在 | `可单独吸收` | 这是独立资产入口校验，不依赖 dirty UI 主体。 |
| `src/games/fantasyrealms/domain/index.ts` | 仅额外导出 `getDeckDrawCount` | `可单独吸收` | 这是独立 barrel 导出补齐，不直接改变通过 UI；已在后续跟进里吸收。 |
| `src/games/fantasyrealms/manifest.ts` | 新增 `thumbnailPath` | `可单独吸收` | 这是独立 manifest 完整性改动，不直接改变通过 UI。 |
| `src/games/fantasyrealms/rule/幻想国度规则.md` | 补双人变体规则正文 | `可单独吸收` | 这是规则文档补全，和通过 UI 基线不冲突，但属于独立规则决策。 |

## 如果现在只做“最小风险继续收并”

可以先按下面三档执行：

1. 继续保持已并入的 **committed 线** 不动
2. 暂挂起所有 `保留 committed 线` 项
3. 下面 4 项已经证明可以独立收口，且已在后续跟进里吸收或确认一致：
   - `src/games/fantasyrealms/manifest.ts`
   - `src/games/__tests__/fantasyrealmsManifestIntegration.test.ts`
   - `src/games/fantasyrealms/domain/index.ts`
   - `src/games/fantasyrealms/rule/幻想国度规则.md`

## 当前一句话结论

真正该停住的，不是“通过 UI 基线”本身，而是 **worktree committed 线之后又继续长出来的第二层实现**；原先这 `15` 个文件里的 4 个独立小项已经收口，剩余真正需要你后续统一拍板的，是那 `11` 个会直接承认 dirty 当前 UI / 交互 / 验证链的文件。  
