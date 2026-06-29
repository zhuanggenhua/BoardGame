# Fantasy Realms 设计稿

## 当前真相源

- 当前正式开局合同：
  - `src/games/fantasyrealms/rule/幻想国度规则.md`
  - `src/games/fantasyrealms/domain/index.ts`
  - `src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`
  - `evidence/fantasyrealms/fantasyrealms-duel-opening-real-2026-06-19.md`
- 2026-06-13 首页到终局的 full-flow 截图链：
  - `test-results/evidence-screenshots/fantasyrealms/fantasyrealms-online-basic.e2e/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图-ui-full-flow-opening-before-first-draw.png`
  - `test-results/evidence-screenshots/fantasyrealms/fantasyrealms-online-basic.e2e/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图-ui-full-flow-after-first-draw-before-discard.png`
  - `test-results/evidence-screenshots/fantasyrealms/fantasyrealms-online-basic.e2e/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图-ui-full-flow-first-discard-before-confirm.png`
  - `test-results/evidence-screenshots/fantasyrealms/fantasyrealms-online-basic.e2e/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图-ui-full-flow-waiting-ai-after-first-discard.png`
  - `test-results/evidence-screenshots/fantasyrealms/fantasyrealms-online-basic.e2e/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图-ui-full-flow-final-standings.png`
  - `test-results/evidence-screenshots/fantasyrealms/fantasyrealms-online-basic.e2e/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图-ui-full-flow-final-standings-review-other-player.png`
- 只有这一组中文命名的 full-flow E2E 截图，才可以作为“之前正常的时候”的正式对照图。
- `temp/rendered-board/*`、`temp/fr-*`、`compact-1024x768.png`、`desktop-1600x900.png`、本地运行截图，只能做辅助排查，不能替代这组 E2E 对照图。
- 用户说的“摸牌（或弃牌）那一版”，指的是 `test-results/evidence-screenshots/_shared/fantasyrealms-live-flow.e2e/终局会展示胜者与最终排名/` 这一组 live-flow 中文截图；在没把具体文件打开并确认前，不得拿别的阶段图或旧桌面图替代。
- 历史正式视觉稿候选：
  - `fantasyrealms-official-ui-design-2026-06-10.png`
  - 来源：`D:\codex-home\generated_images\019e9d4c-4891-73f3-b886-7af479b62a42\ig_0e062a1c21ef3881016a2436c6d2788191a352559b3fff4520.png`
- 分数列表参考：
  - `fantasyrealms-score-list-reference.png`
  - 来源：`D:\codex-home\generated_images\019e9bd2-735c-72a2-aa53-246346c38af8\ig_0b840a698062646a016a23fd2073748197bc2c84f0ef6a70d8.png`

## 当前口径

- 当前 live UI 的正式实现方向，不再以旧 full-flow 截图里的 `点此摸 2 张 / 点左上牌库` 引导为准；真实开局合同以规则、初始化状态、`Board.foundation` 测试和 `fantasyrealms-duel-opening-real-2026-06-19.md` 为准。
- `fantasyrealms-online-basic.e2e` 这组 full-flow 截图现在只保留“2026-06-13 当时产品链已跑通”的历史流程证据，不再作为今天的开局 UI 真相源。
- 旧 `fr-merge-pass2-*` 手工图现在只保留“当时裁定过哪条方向”的历史别名作用，不再作为当前正式截图入口。
- 若要判断“根目录 `main` 与 `fantasyrealms` worktree 到底先认哪边、哪些能双保留”，统一看 `evidence/fantasyrealms/fantasyrealms-main-vs-worktree-merge-decision-package-2026-06-14.md`。
- 若要继续看“双边差异具体分成哪几桶、哪些只能先冻结、哪些要后续单独吸收”，统一看 `evidence/fantasyrealms/fantasyrealms-dual-side-diff-buckets-2026-06-14.md`。
- `fantasyrealms-official-ui-design-2026-06-10.png` 现在降级为**历史视觉候选**，不再作为当前 live 正式实现方向。
- `fantasyrealms-score-list-reference.png` 只允许作为“分数列表样式参考”使用，不是规则真相源。
- 分数可见性、排名揭示时机、旁观者可见范围，仍以规则与实现合同为准。
- 当前不再保留 `generated/`、`implementable/`、`reference/archive/` 这类多层设计稿目录；Fantasy Realms 设计稿只保留当前这一个文件夹。

## 历史候选索引

> 下面这些名字现在仍可能在 evidence、截图路径或过程文档里出现。
> 它们都只代表**历史候选 / 历史断点命名 / 旧文件名保留**，不代表今天仍有并行正式方向。

- 旧 `fr-ui-current-*`：
  - `test-results/manual/fr-ui-current-opening-2026-06-13.png`
  - `test-results/manual/fr-ui-current-after-draw-2026-06-13.png`
  - `test-results/manual/fr-ui-current-after-select-2026-06-13.png`
  - 含义：曾经收口过一轮，但仍保留底部常驻提示横条，**已退出当前正式方向**。
- 旧 `rework-v*`：
  - `test-results/manual/fr-ui-rework-v4-opening-2026-06-13.png`
  - 以及同族 `rework-v*` 桌面候选
  - 含义：用户已明确否掉，**不是当前正式方向**。
- 旧 `stacked` 命名：
  - `fantasyrealms-6p-stacked-insight-priority-check-2026-06-06.md`
  - `fantasyrealms-stacked-compact-deck-check-2026-06-06.md`
  - 以及同批 2026-06-06 横屏断点 evidence
  - 含义：只是当时的历史断点命名，今天应统一理解为**历史横屏候选证据**，不是当前正式 `UI` 家族。

## 交互来源表

> 这张表只回答一件事：当前交互模式到底是从哪里来的。没有写明来源的，不能再默认当正式设计依据。

| 交互模式 | 当前来源 | 结论 |
| --- | --- | --- |
| 分数区进行中隐藏他人分数、终局再揭示 | 正式规则 + 当前实现合同 | 正式真相源 |
| `fantasyrealms-score-list-reference.png` 里的右上分数排行列表 | 更老的生图，只能作局部样式参考 | **不是交互真相源** |
| `fantasyrealms-online-basic.e2e` 2026-06-13 full-flow 用例产出的 opening / after-draw / before-confirm / waiting / final-standings / review-other-player | 历史真实页面链证据，能证明当时首页到终局跑通过，但其中 opening 图仍带旧提示 UI | **不是今天的开局 UI 真相源** |
| “真实双人开局空弃牌时，不停在摸牌按钮；唯一合法来源是牌库且无目标可选，因此自动摸 2 张进入弃牌阶段” | 正式规则 + 当前初始化状态 + `Board.foundation` 测试 | 当前正式方向 |
| “中盘公开弃牌已存在时，才允许同时出现 `摸牌` 与 `拿公开牌`；进入拿公开牌选牌态后，不再保留同名按钮并列” | 当前 `FantasyRealms Board` 实现 + `Board.foundation` 测试 + `fantasyrealms-direct-click-refactor-2026-06-18.md` | 当前正式方向 |
| “横幅只承担短提示，不承担确认按钮；固定单一路径动作直接落到对象本体” | 当前根目录主线的 `FantasyRealms Board` 实现 + 本轮 UI 规则收口 | 当前正式方向 |
| “牌面放大通过显式放大镜入口，而不是依赖二次点击猜测” | 当前根目录主线的 `FantasyRealms Board` 实现 + 本轮重构目标 | 当前正式方向 |
| 底部短提示横条（如 `点一张手牌，再确认弃置`） | 历史 `fr-ui-current-*` 路线 | **已退出当前桌面正式方向** |

## 当前未通过项

- 当前已经批准的是 **`fr-merge-pass2` 这一套去掉底部常驻提示横条后的 live 路线**，不是每个未来细节分支都自动批准。
- 后续若 Fantasy Realms live 再出现新的交互承接方式，仍必须证明它属于 `fr-merge-pass2` 这套正式 live 家族，不能再随手长出另一套 `rework-v*`、旧 `current` 变体或“麻将桌候选”。

## 目录边界

- 本目录只放当前仍有效的设计图本体。
- 运行截图、E2E 证据图、审计结论仍放 `evidence/fantasyrealms/`。
