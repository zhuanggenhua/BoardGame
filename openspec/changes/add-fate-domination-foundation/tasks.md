## 1. Proposal And Intake
- [x] 1.1 Read `AGENTS.md`, `.spec/AGENTS.md`, `openspec/AGENTS.md`, project context, relevant game/UI/data/E2E standards, and current active changes.
- [x] 1.2 Inspect current registry/runtime patterns and confirm `add-fate-domination-foundation` is a unique change ID.
- [x] 1.3 Read the local Chinese rulebook and record the 11-round/four-phase/base-board rules in `design.md`.
- [x] 1.4 Inventory supplied board, card, event, master, servant, wiki-reference, and situation directories; record dimensions and missing/empty sources.
- [x] 1.5 Create the rules-object x asset matrix, source contract, permission matrix, layout contract, and attachment capability matrix.
- [x] 1.6 Validate this change with `openspec validate add-fate-domination-foundation --strict --no-interactive` after the files are authored.

## 2. Approval Gate
- [x] 2.1 Obtain explicit user approval for `add-fate-domination-foundation` and its current scope.
- [x] 2.2 Re-read approved `proposal.md`, `design.md`, and `tasks.md` immediately before implementation.

## 3. Runtime Foundation
- [x] 3.1 Create `src/games/fate-domination/` with the required manifest, domain, data/rule, UI, Board, thumbnail, tutorial/audio/debug/critical-image entry files.
- [x] 3.2 Add typed deterministic setup, state, command, event, validate, execute, reduce, playerView, and game-over/deferred end-state contracts.
- [x] 3.3 Implement the approved demonstration flow: identity assignment, preparation reveal state, deployment, two-card attack selection/confirmation, phase advance, and representative battle settlement.
- [x] 3.4 Register shared action-log and undo systems using a single business command allowlist; keep audio/tutorial/debug statuses aligned with the matrix.
- [x] 3.5 Add focused domain tests for setup, legal/illegal deployment, exactly-two-card selection, inspection without mutation, deterministic reduction, and stale entity rejection.

## 4. Asset Intake And UI
- [x] 4.1 Copy only approved runtime candidates into semantic `public/assets/i18n/zh-CN/fate-domination/**` paths, preserve source aspect ratios, compress to WebP, and generate/validate the asset manifest.
- [x] 4.2 Include the supplied 13 situation fronts and one back as real runtime candidates; keep unverified effects partial and do not create guessed card data.
- [x] 4.3 Add Chinese locale keys for title, phases, commands, statuses, and confirmed card/event labels without duplicating readable card-face rules.
- [x] 4.4 Build the single desktop-first tabletop Board with map anchors, player rail, hand/attack area, event/situation zones, pile counts, action dock, and card inspection overlay.
- [x] 4.5 Add responsive behavior for 1920x1080 desktop and 375x812 mobile, preserving object hierarchy, touch targets, internal scroll, and no-overlap rules.
- [x] 4.6 Add the game-specific visual style contract under `design-system/games/fate-domination.md` and the UI preflight/evaluator evidence required by project standards.

## 5. Real Entry Verification
- [x] 5.1 Run manifest generation and focused game tests.
- [x] 5.2 Start the local development service and open the development verification entry `/dev/fate-domination`; keep the formal product route as `/play/fate-domination/match/:matchId`.
- [x] 5.3 Verify desktop and mobile screenshots: nonblank page, board/card assets loaded, no text overflow or overlap, stable card ratios, and reachable actions.
- [x] 5.4 Exercise browser interactions for card inspection, location selection, two-card selection/confirmation, phase advance, and return from overlay; record screenshot/evidence paths.
- [x] 5.5 Run typecheck/lint and relevant asset validation; report any unrun upload/remote checks as explicit residual risk.

## 6. Explicitly Deferred In This Change
- [ ] 6.1 Full situation deck effects remain deferred until every supplied front is manually transcribed and validated against the rulebook/Wiki.
- [ ] 6.2 Complete master/servant catalog, every attack/event effect, advanced response windows, all elimination/tiebreak rules, and production scoring remain deferred to follow-up changes.
- [ ] 6.3 Full AI strategy, tutorial flow, Fate/Domination audio, and player-visible debug controls remain outside this foundation implementation.
- [ ] 6.4 Remote asset upload, server file-index, Android package, and production URL verification remain outside this local foundation change.

## 7. Current Runtime UI Rebuild (2026-10-18)

The user approved moving the current working draft into the actual runtime. Historical foundation checks above are not acceptance of this new UI. Current overall status: REVISE.

- [x] Replace the prototype Board composition with shared Pixi camera/map, two count-aware hand regions, distinct staged/played zones, public seat drawer and adaptive full-card details.
- [x] Bind same-name skill cards by definition/entity ID, remove clickable departing copies, and test attack/skill reflow and single-confirm command-spell dispatch.
- [x] Recover and register 27 identity faces, 42 skill faces and original character tokens; preserve corrected source associations and original command-seal atlas.
- [x] Map 13 situation and 20 event slots to existing semantic source assets, including intentional duplicate event faces.
- [x] Close the current 14 servants' actual deck-face coverage (20 distinct definitions); source faces verified and manifest tests pass locally on 2026-10-19. The final three mappings are not in published v50 yet.
- [ ] Resolve the Zouken command-seal visual limitation: the declared TTS source is blank, and the CHM has no dedicated face. Do not invent substitute artwork.
- [ ] Capture and personally review the actual runtime at baseline and constrained desktop sizes, including selection, play, withdrawal, small/empty hands, opponent drawer, full details, map input and command-spell confirmation.
- [ ] Reconcile rule-dependent UI gaps against the CHM: face-down normal plays, skill attacks within the normal two-card choice, deployment slot ownership/bonuses and preparation draw/setup.
- [ ] Publish only through the authorized QA workflow and deliver a current official viewer link after complete visual acceptance. Neither saved Site v48 nor old rejected design screenshots satisfy this item.

Complete card-effect implementation and advanced rule windows remain the explicitly deferred mechanism work in section 6; do not describe this visual rebuild as a production-complete game.

### Runtime review update (2026-10-19)

- The actual v49 selection/withdrawal/confirmation/details chain is archived. It is problem evidence, not overall acceptance: the long rectangular player rail was rejected and the 1366px canvas height is under diagnosis.
- The root personally reviewed Old King's Crown's public observer table and expanded-player switching screenshots. Adopt the compact summary -> expanded information -> switch -> return interaction hierarchy; preserve Fate artwork, rules and identity layout. These four frames do not cover all common reference interactions; supplementary capture is running.
- Local unpublished changes: compact master/servant identity anchors, public played cards in a separate adjacent drawer, named identity switching in details, selection-order projection, cross-zone keyboard focus preservation, top-layer Escape handling and detail Tab containment. Fresh full-screen evidence is required.
- Source backup v38 preserves the main changes; later focus and logical-height fixes await the next checkpoint.

- Source audit correction: Q5/Q6 original images explicitly read Agility, not Magic. Their existing rule types remain unchanged. The retired cloud-3 download host failed; the same UGC images were retrieved via images.steamusercontent.com with TLS verification enabled. Q2 uses the original 高速移动 title and atlas frame 1.

### 用户返工锁定（2026-10-20）

当前状态：REVISE。此前十图只作历史证据，用户否决事件牌库位置、玩家列表形态、详情滚动与手牌锚点。不得将旧 PASS 继续视为当前通过。

- [x] 回读中文 setup 原文确认 B1 为 Objectives 事件牌库槽；当前修复仍待新页面截图。
- [x] 回查 v52/v54 原图与源快照，恢复详情两排内容、较小数量令咒叠与右侧说明；当前未视觉验收。
- [x] 手牌布局以当前视口 25%/75% 为两组中心，取消向中央内收；交互仍待先王单机原始证据。
- [ ] 取证 Old King's Crown 真正私有手牌选择/取消/出牌/余牌重排；旁观公开卡牌浏览不可替代。
- [ ] 将地图普通移动入口映射到印刷移动费用与箭头白色区域；卡牌/令咒效果移动覆盖合法目标、高亮、确认、落位与取消。
- [ ] 分离常规技能攻击打出与已激活卡牌的阶段能力使用，禁止扣费空移动；保留部署后和出牌后的合法能力窗口。
- [ ] 核对并修正基础规则到界面的断口：A1/A2 和真实局势库、暗置信息投影、部署席位与地利、常规明暗出牌及技能混选、准备与御主能力入口、弃牌检视。逐张全卡效果与高级响应仍按原延期边界记录，不能宣称全部规则已实现。
- [ ] 同状态同视口复核旧/新首屏信息、卡牌大小、锚点、额外滚动和点击，独立审查直接消费用户原文与规则；任何未经授权损失都不得用局部收益抵消。
- [ ] 本轮覆盖全部通过后重建官方查看器证据；此前链接不构成当前验收完成。
