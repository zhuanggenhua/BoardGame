# 最近 5 天反馈与修复文档对照 2026-04-05

## 范围

- 真实数据源：生产 `feedbacks` 集合
- 时间窗口：
  - UTC：`2026-03-31T00:12:42Z` ~ `2026-04-05T00:12:42Z`
  - 北京时间：`2026-03-31 08:12:42` ~ `2026-04-05 08:12:42`
- 总数：`23`

## 对照口径

- `直接证据`
  - 能直接对到 `evidence/*.md`，或在收口文档里明确写出该反馈 ID 和处理结论。
- `间接证据`
  - 没有单独 closeout/evidence，但能在 `temp/feedback-triage-*.md`、`temp/feedback-triage-summary.md`、`temp/feedback-writeback-action-list.md` 中找到该 ID 的分诊与依据。
- `缺少明确文档映射`
  - 当前仓库里没找到能直接对应该反馈 ID 的修复/收口文档；只有线上状态，或只能模糊推断。

## 逐条结果

| feedbackId | game | status | 结论 | 文档映射 |
| --- | --- | --- | --- | --- |
| `69d0d5bfccdbf2785a55af79` | `summonerwars` | `resolved` | 直接证据 | `evidence/feedback-69d0d5bfccdbf2785a55af79-closeout-2026-04-05.md` |
| `69d0b99accdbf2785a55ac7f` | `smashup` | `resolved` | 直接证据 | `evidence/feedback-recent-5day-missing-six-closeout-2026-04-05.md` |
| `69ce8ab6094b1acda250fa01` | `smashup` | `closed` | 直接证据 | `evidence/feedback-recent-5day-missing-six-closeout-2026-04-05.md` |
| `69ce88da094b1acda250f9ff` | `smashup` | `closed` | 直接证据 | `evidence/feedback-recent-5day-missing-six-closeout-2026-04-05.md` |
| `69ce86f6094b1acda250f9d3` | `smashup` | `resolved` | 直接证据 | `evidence/feedback-recent-5day-missing-six-closeout-2026-04-05.md` |
| `69ce7fc3094b1acda250f9a3` | `smashup` | `closed` | 间接证据 | `temp/feedback-triage-smashup.md`、`temp/feedback-writeback-action-list.md` |
| `69ce7d74094b1acda250f97c` | `smashup` | `closed` | 间接证据 | `temp/feedback-triage-smashup.md`、`temp/feedback-writeback-action-list.md` |
| `69ce7bbf094b1acda250f93e` | `smashup` | `resolved` | 间接证据 | `temp/feedback-triage-smashup.md`、`temp/feedback-writeback-action-list.md` |
| `69ce7ac2094b1acda250f933` | `smashup` | `resolved` | 直接证据 | `evidence/feedback-smashup-cowboys-open-recheck-2026-04-04.md`，并在 `temp/feedback-triage-smashup.md` 中挂接 |
| `69ce7589094b1acda250f8c6` | `smashup` | `resolved` | 间接证据 | `temp/feedback-triage-smashup.md` 指向 `evidence/smashup-ancient-egyptians-audit-2026-03-29.md` |
| `69ce7358094b1acda250f8ab` | `smashup` | `closed` | 直接证据 | `evidence/feedback-final-five-closeout-2026-04-04.md`、`evidence/feedback-open-writeback-2026-04-04.md` |
| `69ce7167094b1acda250f8a9` | `smashup` | `resolved` | 直接证据 | `evidence/feedback-smashup-cowboys-open-recheck-2026-04-04.md`，并在 `temp/feedback-triage-smashup.md` 中挂接 |
| `69ce6e10094b1acda250f862` | `smashup` | `closed` | 直接证据 | `evidence/feedback-recent-5day-missing-six-closeout-2026-04-05.md` |
| `69ce6dcd094b1acda250f85b` | `smashup` | `closed` | 间接证据 | `temp/feedback-triage-smashup.md`、`temp/feedback-writeback-action-list.md` |
| `69ce6ca7094b1acda250f831` | `smashup` | `resolved` | 间接证据 | `temp/feedback-triage-smashup.md`、`temp/feedback-writeback-action-list.md` |
| `69ce62f3094b1acda250f7a5` | `cardia` | `resolved` | 直接证据 | `evidence/feedback-final-five-closeout-2026-04-04.md`、`evidence/feedback-open-writeback-2026-04-04.md` |
| `69ce6242094b1acda250f790` | `cardia` | `resolved` | 直接证据 | `evidence/feedback-cardia-selection-modal-zindex-fix-2026-04-04.md`、`evidence/feedback-open-writeback-2026-04-04.md` |
| `69cca92ec3e278ba205eb091` | `smashup` | `closed` | 直接证据 | `evidence/feedback-recent-5day-missing-six-closeout-2026-04-05.md` |
| `69cca762c3e278ba205eb08f` | `smashup` | `resolved` | 直接证据 | `evidence/feedback-open-writeback-2026-04-04.md`，并在 `temp/feedback-triage-smashup.md`、`temp/feedback-writeback-action-list.md` 中挂接 |
| `69cca643c3e278ba205eb08d` | `smashup` | `closed` | 直接证据 | `evidence/feedback-final-five-closeout-2026-04-04.md`、`evidence/feedback-open-writeback-2026-04-04.md` |
| `69cc8633c3e278ba205eb020` | `smashup` | `resolved` | 直接证据 | `evidence/feedback-final-five-closeout-2026-04-04.md`、`evidence/feedback-open-writeback-2026-04-04.md`、`evidence/ai-interaction-audit-2026-04-04.md` |
| `69cbecb1d5dec909a0b74ee9` | `smashup` | `closed` | 直接证据 | `evidence/feedback-open-writeback-2026-04-04.md`，并在 `temp/feedback-triage-smashup.md`、`temp/feedback-writeback-action-list.md` 中挂接 |
| `69cba605d5dec909a0b74c9f` | `dicethrone` | `resolved` | 间接证据 | `temp/feedback-triage-dicethrone.md` 指向 `evidence/dicethrone-webview91-board-shell-fix.md` 与 `evidence/dicethrone-gunslinger-the-law-multiselect-e2e-test.md` |

## 汇总结论

- `直接证据`：`16`
- `间接证据`：`7`
- `缺少明确文档映射`：`0`

## 当前结论

- 原先缺口 `6` 条已补到：
  - `evidence/feedback-recent-5day-missing-six-closeout-2026-04-05.md`
- 因此当前不是“线上收口但文档缺口仍在”，而是：
  - 线上状态已经全部收口；
  - 文档证据闭环也已补齐最近 `5` 天范围内的全部 `23` 条。

## 建议

- 后续若再做“最近 N 天反馈已收口”的对外表述，应继续保持同一口径：
  - 先用生产真实反馈源核对状态；
  - 再为每条 feedback ID 保留至少一处可追溯的 evidence/closeout 映射。
