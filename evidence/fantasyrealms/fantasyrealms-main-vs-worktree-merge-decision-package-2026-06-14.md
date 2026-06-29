# Fantasy Realms main 与 worktree 收口决策包（2026-06-14）

## 一句话结论

现在不是“把两边全删成一边”的问题，而是先冻结 **FantasyRealms 正式 UI 只认 `fantasyrealms` worktree 里的 `fr-merge-pass2` 路线**；根目录 `main` 当前这批 FantasyRealms 改动不能直接并回正式 UI，因为它还带着已被否掉的底部提示体系和旧壳层语义。

> 若要继续看“这些差异具体分成哪几桶、哪些后续可以单独吸收”，统一看 [fantasyrealms-dual-side-diff-buckets-2026-06-14.md](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/evidence/fantasyrealms/fantasyrealms-dual-side-diff-buckets-2026-06-14.md)。

## 先回答三件事

1. 这是不是只能二选一：
   - **不是所有内容都只能二选一。**
   - 真正只能单选的，只有 `FantasyRealms 正式运行 UI` 这一件事。
2. 现在可以全部保留的：
   - 历史截图、历史候选、过程 evidence、审计说明、旧文件名索引，都可以继续保留。
   - 根目录 `main` 里与正式 UI 不直接绑定的 FantasyRealms 旁支改动，也可以先保留，后续逐项审。
3. 现在不能两边同时生效的：
   - `src/games/fantasyrealms/Board.tsx` 代表的正式牌桌入口
   - FantasyRealms 的正式 live 视觉合同
   - 与底部提示横条是否存在直接相关的 E2E 合同

## 你现在只需要决定的一句话

**推荐直接认定：FantasyRealms 正式 UI 继续以 `.worktrees/fantasyrealms` 的 `fr-merge-pass2` 为唯一真相源；根目录 `main` 当前这批 FantasyRealms 改动先不直接并进正式 UI。**

## 为什么我推荐这个

- worktree 这边已经有明确真相源，设计说明、批准记录和截图都统一指向 `fr-merge-pass2`，并且明确写了“底部横幅/底部提示条绝对不是要采用的一版”。
- 当前 worktree 的真实截图已经能直接看到：开局是干净牌桌，没有底部常驻横条；摸牌后要处理的牌集中承接在桌面中央；终局态也延续这套版式。
- worktree 的在线 E2E 已经把 `fantasyrealms-live-deck-cue` 写成**必须不存在**，这说明“不要底部提示体系”已经进入现行验证合同。
- 根目录 `main` 这边的 FantasyRealms 运行实现仍保留旧语义：代码里还有 `fr-stage-banner`、`fr-live-chip--cue`、`fantasyrealms-stacked-layout`，对应的旧证据也还在描述“点此摸 2 张”和底部短提示。这一边如果直接反带回正式 UI，会把已经被否掉的方向重新带回来。

## 如果改选另一边，会发生什么

- 正式牌桌会重新混入底部提示横条和旧 `stacked` 壳层语义，和当前已经批准的桌面方向冲突。
- 现有 worktree 里的设计说明、批准记录、E2E 合同会同时失真，后面每次改 UI 都会再次陷入“到底认哪套”的混乱。
- 这不是单纯的“样式偏好不同”，而是会把已经否掉的交互承接方式重新翻正。

## 附录：技术映射

- 当前正式真相源
  - `docs/games/fantasyrealms/design/README.md`
  - `design-system/games/fantasyrealms.md`
  - `evidence/fantasyrealms/fantasyrealms-current-route-approval-2026-06-13.md`
  - `test-results/manual/fr-merge-pass2-opening-2026-06-13.png`
  - `test-results/manual/fr-merge-pass2-after-draw-2026-06-13.png`
  - `test-results/manual/fr-merge-pass2-after-select-2026-06-13.png`
  - `test-results/manual/fr-merge-pass2-gameover-desktop-2026-06-14.png`

- worktree 这边说明“底部提示体系不能回来”的证据
  - `e2e/fantasyrealms/fantasyrealms-online-basic.e2e.ts`
    - `1098 / 1466 / 1581`：`fantasyrealms-live-deck-cue` 必须为 `0`
  - `src/games/fantasyrealms/Board.tsx`
    - `3523-3524`：正式紧凑横屏壳层是 `fantasyrealms-compact-layout`
    - `2518-2848`：当前 `fr-compact-layout` 对应的 live table / center / hand / action 结构

- 根目录 `main` 这边暂时不能直接翻正的证据
  - `src/games/fantasyrealms/Board.tsx`
    - `801`：仍保留 `fr-stage-banner`
    - `1080`：仍保留 `fr-live-chip--cue`
    - `3087`：仍保留 `fantasyrealms-stacked-layout`
  - `evidence/fantasyrealms/fantasyrealms-duel-opening-online-flow-2026-06-13.md`
    - 仍在描述 `点此摸 2 张` cue 与底部短提示

- 现在可以双保留但不能冒充正式方向的材料
  - `test-results/manual/fr-ui-current-*.png`
  - `test-results/manual/fr-ui-rework-v*.png`
  - `2026-06-06` 那批带 `stacked` 命名的历史 evidence

- 暂不在本轮自动裁定吸收的内容
  - 根目录 `main` 里 FantasyRealms 的旁支领域逻辑、数据、测试、AI 文件
  - 这些内容不等于正式 UI，应在后续单独做“可独立吸收项”审查，不能借这次 UI 收口一起吞并
