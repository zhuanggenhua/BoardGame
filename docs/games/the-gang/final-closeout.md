# 纸牌帮 The Gang 实施中检查点

## 当前结论

- The Gang 不能沿用上一轮“只做提案/只跑 E2E 就完成”的错误口径；本轮已补齐素材录入纠偏、BGG 电子版桌面布局重做、真实页面中局满元素截图和看图验收，当前状态标记为 `in_progress`。
- 当前素材事实：用户指出的 9250x7684 牌面源图已用于 52 张普通扑克牌裁切，旧 `blocked/基础版不接入` 录入口径已纠正；基础版运行时素材已进入 Board。2026-07-05 已从 TTS Workshop JSON 和本地 Steam 缓存重建 52 张牌、牌背与 24 个基础筹码，证据为 `temp/the-gang-intake/the-gang-resource-rebuild.json`。
- 当前 UI 事实：`dom.txt` 为空不能作为排除布局真相源的理由；用户后续补充的 BGG 电子版 DOM/CSS/结算参考已成为当前 UI 真相源。`Board.tsx` 已改为 `data-layout-contract="bgg-electronic"` 的少框桌面布局，并通过桌面真实页面 E2E、中局满元素截图、PureRef 打开和 AI 复看。
- 当前不包含 7-10 人扩展、Joker、工具牌、Dealer、挑战/专家卡或其它扑克变体；这些是明确的后续扩展范围，不是基础版完成阻塞项。
- 本文只记录合并到主分支前的实施中检查点；The Gang 本轮新增的 77 个压缩资源当时已完成远端上传并回查通过；手机验收、用户桌面验收和最终完成口径仍在后续实施范围内。当前和后续资源验收统一以服务器素材主源为准，历史 R2/CDN 记录只保留为旧证据。桌面教程端到端已补齐，不再作为待打磨缺口。
- 当前工作区实况：The Gang 代码、素材接入、桌面运行时 E2E 与桌面教程 E2E 已在当前 `main` 工作区验证；桌面实施中检查点和教程规范补丁已分别进入 `HEAD`（`3caed9e6f`、`863b46431`）。旧 `.worktrees/the-gang`/`feat/the-gang` 只作为历史实施现场记录，不再作为当前执行现场。
- 外部大图素材已盘点和分类；基础版运行时已接入缩略图、52 张普通扑克牌牌面、24 个筹码、隐藏牌背、警报、金条、桌面/牌槽和规则参考，避免把来源哈希图、扩展图或 HTML/CSS 伪造元素误接入正式玩法。

## 实现验证矩阵

| 交付面 | 当前状态 | 证据 |
| --- | --- | --- |
| 基础规则 | 实现已验证 | `src/games/the-gang/domain/**`、`src/games/the-gang/__tests__/flow.test.ts`、`src/games/the-gang/__tests__/poker.test.ts` |
| Board 入口 | 实现已验证 | `src/games/the-gang/Board.tsx`、`src/games/the-gang/__tests__/Board.runtime.test.tsx` |
| manifest / 注册 | 实现已验证 | `src/games/the-gang/manifest.ts`、`src/games/manifest*.generated.*`、`src/games/the-gang/__tests__/manifest.test.ts` |
| 真实页面核心 E2E | 实现已验证 | `e2e/the-gang/the-gang-runtime.e2e.ts` 通过可见座位/筹码/推进按钮完成一次四轮抢劫，并断言公共牌、历史筹码、当前筹码图片真实加载 |
| 素材准入 | 基础版对象运行时接入已补齐并通过复验 | 52 张普通扑克牌牌面、筹码、牌背、警报、金条、桌面/牌槽已命名、落盘、压缩、manifest 并接入 Board；`temp/the-gang-intake/the-gang-resource-rebuild.json` 记录牌组、牌背、筹码源图映射；规则参考已从 TTS 脚本参考板抽取并接入默认折叠入口 |
| BGG 电子版桌面布局合同 | 桌面过程态已验证，整体仍实施中 | `docs/games/the-gang/layout-source-contract.md`、`src/games/the-gang/Board.tsx`、`test-results/evidence-screenshots/the-gang/the-gang-runtime.e2e/桌面端可通过真实-UI-完成一次四轮抢劫并显示摊牌结果/桌面中局满元素已拿新筹码待摊牌.jpg` |
| 玩家可见日志 | 实现已验证 | `src/games/the-gang/actionLog.ts`、`src/games/the-gang/__tests__/actionLog.test.ts` |
| 玩家可见本地 AI | 实现已验证 | `src/games/the-gang/ai.ts`、`src/games/the-gang/__tests__/ai.test.ts` |
| 基础教程 | 实现已验证 | `src/games/the-gang/tutorial.ts`、`src/games/the-gang/__tests__/tutorial.test.tsx` |
| 桌面教程端到端截图链 | 实现已验证 | `e2e/the-gang/the-gang-tutorial.e2e.ts` 从目标说明、读底牌、四轮筹码、公共牌推进跑到摊牌结果；关键截图已用 PureRef 打开，并断言公共牌、历史筹码、当前筹码图片真实加载 |
| 共享撤回入口 | 实现已验证 | `src/games/the-gang/Board.tsx`、`src/games/the-gang/game.ts`、`src/games/the-gang/__tests__/Board.runtime.test.tsx` |
| 整体主 spec | 已补齐并校验 | `openspec/specs/the-gang/spec.md` |

## 当前 The Gang changes 状态

| change | 实现状态 | 流程状态 | 现实含义 |
| --- | --- | --- |
| `add-the-gang-foundation` | 已实现并验证 | foundation 局部成立；不能代表整体完成 | 基础版领域逻辑、Board、manifest、i18n、缩略图和注册清单 |
| `add-the-gang-data-and-runtime-closeout` | 部分实现并通过桌面/远端资源检查点 | 仍保持 `in_progress`；本轮可合入主线继续实施 | 牌面源图录入口径已纠正；BGG 桌面少框布局、中局满元素截图、PureRef 看图、77 个压缩资源远端上传与回查已完成；手机验收、用户桌面验收和最终完成口径继续跟进；当前资源主源为服务器素材主源 |
| `add-the-gang-action-log` | 已实现并验证 | 局部能力成立；不关闭整体素材门禁 | 玩家可见日志 |
| `add-the-gang-ai-test-path` | 已实现并验证 | 局部能力成立；不关闭整体素材门禁 | 玩家可见本地 AI 与可重复人机测试路径 |
| `add-the-gang-tutorial` | 已实现并验证 | 局部能力成立；不关闭整体素材门禁 | 基础教程和 Board 高亮锚点 |
| `add-the-gang-undo-ui` | 已实现并验证 | 局部能力成立；不关闭整体素材门禁 | 共享 HUD 撤回入口和独立撤回白名单 |

## 验证命令

- `openspec validate add-the-gang-ai-test-path --strict --no-interactive`：通过。
- `openspec validate add-the-gang-undo-ui --strict --no-interactive`：通过。
- `openspec validate add-the-gang-data-and-runtime-closeout --strict --no-interactive`：2026-07-05 复验通过。
- `openspec validate the-gang --strict --no-interactive`：2026-07-05 复验通过。
- `npx vitest run src/games/the-gang --configLoader native`：2026-07-05 08:22 复验通过，8 files / 20 tests passed。
- 历史验证（2026-07-05 旧热座版本）：`node scripts/infra/run-e2e-single.mjs ci e2e/the-gang/the-gang-runtime.e2e.ts "桌面端可通过真实 UI 完成一次四轮抢劫并显示摊牌结果"` 复验通过，1 test passed；该结果保留为当时版本的桌面流程与素材证据，不再代表 2026-07-10 后的单客户端玩家视角合同。
- 历史桌面中局满元素截图：`test-results/evidence-screenshots/the-gang/the-gang-runtime.e2e/桌面端可通过真实-UI-完成一次四轮抢劫并显示摊牌结果/桌面中局满元素已拿新筹码待摊牌.jpg`；图面仍可证明历史筹码、当前红筹码、中央五张公共牌、红筹码区、底部手牌和“摊牌”入口曾同屏可见，但不得用来证明当前多人自然操作或热座合同。
- 现行交互与验证口径见 `docs/games/the-gang/user-stories/online-viewer-and-landscape-contract-2026-07-10.md`：当前玩家使用可见 UI，其它座位可在代表态测试中用状态注入补齐；多人身份、权限和同步必须另用多客户端验证。
- `npx vitest run src/games/the-gang/__tests__/tutorial.test.tsx --configLoader native`：2026-07-05 复验通过，3 tests passed。
- `node scripts/infra/run-e2e-single.mjs ci e2e/the-gang/the-gang-tutorial.e2e.ts "桌面教程覆盖读牌力、选筹码、公共牌推进和摊牌反馈"`：2026-07-05 17:06 复验通过，1 test passed；截图目录为 `test-results/evidence-screenshots/the-gang/the-gang-tutorial.e2e/桌面教程覆盖读牌力、选筹码、公共牌推进和摊牌反馈/`，且图片加载断言覆盖公共牌、历史筹码、当前筹码。
- 教程关键图已打开给用户看：`教程满元素待摊牌.jpg` 与 `教程摊牌结果反馈.jpg`；本次 PureRef 新建了 4 个进程 `21064,22068,29900,42044` 而非复用旧窗口。这证明桌面教程端到端，不等于整体最终完成。
- 历史远端定向上传：2026-07-05 已上传 `official/i18n/zh-CN/the-gang/**/compressed/*.webp` 共 77 个对象；样本包括 `cards/compressed/ace-clubs.webp`、`cards/compressed/card-back.webp`、`chips/compressed/round-4-red-3.webp`，当时远端大小均与本地一致；`npm run assets:check` 已确认 The Gang 无新增/变更差异。2026-07-11 后该证据只作为历史记录，当前验收必须回到服务器素材主源 URL 与 `X-Asset-Source: server`。
- `npx eslint src/games/the-gang --ext .ts,.tsx`：通过。
- `npm run typecheck`：通过。

## 后续范围

- 扩展和变体：7-10 人、Joker、工具牌、Dealer、挑战/专家卡、其它扑克变体，需单独 change 批准后再实现。
- 视觉与素材闭环：基础版对象已接入，桌面少框过程态已通过真实页面截图复验，The Gang 本轮新增压缩资源已完成远端发布和回查；手机验收、用户桌面验收和最终完成口径继续在 `add-the-gang-data-and-runtime-closeout` 中实施。扩展 playmat 级逐像素复刻、7-10 人、Joker、工具牌、Dealer、挑战/专家卡另建 change。
- AI 强化：当前是可见本地 baseline AI；如需强策略、难度、搜索或隐藏信息采样，另建增强 change。
