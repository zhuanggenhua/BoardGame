# Fantasy Realms 设计稿

## 当前真相源

- 当前正式 live 方向：
  - `test-results/evidence-screenshots/fantasyrealms/fantasyrealms-online-basic.e2e/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图-ui-full-flow-opening-before-first-draw.png`
  - `test-results/evidence-screenshots/fantasyrealms/fantasyrealms-online-basic.e2e/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图-ui-full-flow-after-first-draw-before-discard.png`
  - `test-results/evidence-screenshots/fantasyrealms/fantasyrealms-online-basic.e2e/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图-ui-full-flow-first-discard-before-confirm.png`
  - `test-results/evidence-screenshots/fantasyrealms/fantasyrealms-online-basic.e2e/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图-ui-full-flow-waiting-ai-after-first-discard.png`
  - `test-results/evidence-screenshots/fantasyrealms/fantasyrealms-online-basic.e2e/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图-ui-full-flow-final-standings.png`
  - `test-results/evidence-screenshots/fantasyrealms/fantasyrealms-online-basic.e2e/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图-ui-full-flow-final-standings-review-other-player.png`
- 历史正式视觉稿候选：
  - `fantasyrealms-official-ui-design-2026-06-10.png`
  - 来源：`D:\codex-home\generated_images\019e9d4c-4891-73f3-b886-7af479b62a42\ig_0e062a1c21ef3881016a2436c6d2788191a352559b3fff4520.png`
- 分数列表参考：
  - `fantasyrealms-score-list-reference.png`
  - 来源：`D:\codex-home\generated_images\019e9bd2-735c-72a2-aa53-246346c38af8\ig_0b840a698062646a016a23fd2073748197bc2c84f0ef6a70d8.png`

## 当前口径

- 当前 live UI 的正式实现方向，现以 `fantasyrealms-online-basic.e2e` 用例 `首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图` 产出的开局 / 摸牌后 / 选牌待确认 / 等待态 / 终局榜单截图为准。
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
| `fantasyrealms-online-basic.e2e` 当前 full-flow 用例产出的 opening / after-draw / before-confirm / waiting / final-standings / review-other-player | 当前 worktree 的真实页面 E2E 证据，且可直接反查到游戏、测试文件和用例名 | 当前正式 live 真相源 |
| “摸牌阶段点左上牌库” | 当前正式 live 路线 + 项目内已收敛的牌库主入口方案 | 当前正式方向 |
| “桌面横屏 live 的统一主推进按钮复用顶部状态条里的现有 `chip` 家族，不再单独长出一颗右下/右侧漂浮按钮” | 当前 worktree 的 full-flow 真图 + 当前页面现有按钮家族审查，见 `evidence/fantasyrealms/fantasyrealms-live-primary-action-reference-2026-06-14.md` | 当前正式方向 |
| “先点手牌/公开弃牌，再用顶部状态条里的确认按钮收口” | 当前正式 live 路线 + 上面这份主推进按钮参考核对 | 当前正式方向 |
| 底部短提示横条（如 `点一张手牌，再确认弃置`） | 历史 `fr-ui-current-*` 路线 | **已退出当前桌面正式方向** |

## 当前未通过项

- 当前已经批准的是 **`fr-merge-pass2` 这一套去掉底部常驻提示横条后的 live 路线**，不是每个未来细节分支都自动批准。
- 后续若 Fantasy Realms live 再出现新的交互承接方式，仍必须证明它属于 `fr-merge-pass2` 这套正式 live 家族，不能再随手长出另一套 `rework-v*`、旧 `current` 变体或“麻将桌候选”。

## 目录边界

- 本目录只放当前仍有效的设计图本体。
- 运行截图、E2E 证据图、审计结论仍放 `evidence/fantasyrealms/`。
