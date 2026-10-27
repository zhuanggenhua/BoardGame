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

The user approved moving the current working draft into the actual runtime. Historical foundation checks above are not acceptance of this new UI. 2026-10-18历史状态为REVISE；本地最新验收结论见下方2026-10-23记录，旧双主区不覆盖最新合同。

- [x] Replace the prototype Board composition with shared Pixi camera/map, two count-aware hand regions, distinct staged/played zones, public seat drawer and adaptive full-card details.
- [x] Bind same-name skill cards by definition/entity ID, remove clickable departing copies, and test attack/skill reflow and single-confirm command-spell dispatch.
- [x] Recover and register 27 identity faces, 42 skill faces and original character tokens; preserve corrected source associations and original command-seal atlas.
- [x] Map 13 situation and 20 event slots to existing semantic source assets, including intentional duplicate event faces.
- [x] Close the current 14 servants' actual deck-face coverage (20 distinct definitions); source faces verified and manifest tests pass locally on 2026-10-19. The final three mappings are not in published v50 yet.
- [ ] Resolve the Zouken command-seal visual limitation: the declared TTS source is blank, and the CHM has no dedicated face. Do not invent substitute artwork.
- [x] 完成本轮当前真实Board的常规/受限桌面与触控、选牌/撤回/确认、空/密集手牌、玩家抽屉/详情、地图和令咒确认；35媒体独立审查及行为门禁通过，见2026-10-23报告。
- [x] 对照中文CHM核对基础明暗出牌、普通/技能混选、部署槽位/地利、准备与发牌；全量43文件229项及真实联网基础链通过。逐张全卡效果不在本项通过范围。
- [ ] Publish only through the authorized QA workflow and deliver a current official viewer link after complete visual acceptance. Neither saved Site v48 nor old rejected design screenshots satisfy this item.

Complete card-effect implementation and advanced rule windows remain the explicitly deferred mechanism work in section 6; do not describe this visual rebuild as a production-complete game.

### Runtime review update (2026-10-19)

- The actual v49 selection/withdrawal/confirmation/details chain is archived. It is problem evidence, not overall acceptance: the long rectangular player rail was rejected and the 1366px canvas height is under diagnosis.
- The root personally reviewed Old King's Crown's public observer table and expanded-player switching screenshots. Adopt the compact summary -> expanded information -> switch -> return interaction hierarchy; preserve Fate artwork, rules and identity layout. These four frames do not cover all common reference interactions; supplementary capture is running.
- Local unpublished changes: compact master/servant identity anchors, public played cards in a separate adjacent drawer, named identity switching in details, selection-order projection, cross-zone keyboard focus preservation, top-layer Escape handling and detail Tab containment. Fresh full-screen evidence is required.
- Source backup v38 preserves the main changes; later focus and logical-height fixes await the next checkpoint.

- Source audit correction: Q5/Q6 original images explicitly read Agility, not Magic. Their existing rule types remain unchanged. The retired cloud-3 download host failed; the same UGC images were retrieved via images.steamusercontent.com with TLS verification enabled. Q2 uses the original 高速移动 title and atlas frame 1.

### 用户返工锁定（2026-10-20）

2026-10-20历史状态：REVISE（最新本地结论见2026-10-23）。此前十图只作历史证据，用户否决事件牌库位置、玩家列表形态、详情滚动与手牌锚点。不得将旧 PASS 继续视为当前通过。

- [x] 回读中文 setup 原文确认 B1 为 Objectives 事件牌库槽；当前修复仍待新页面截图。
- [x] 回查 v52/v54 原图与源快照，恢复详情两排内容、较小数量令咒叠与右侧说明；当前未视觉验收。
- [x] （历史方案，已被2026-10-22攻击单主区/右侧常显技能合同取代）手牌布局以当时视口 25%/75% 为两组中心，取消向中央内收；交互仍待先王单机原始证据。
- [ ] 取证 Old King's Crown 真正私有手牌选择/取消/出牌/余牌重排；旁观公开卡牌浏览不可替代。
- [ ] 将地图普通移动入口映射到印刷移动费用与箭头白色区域；卡牌/令咒效果移动覆盖合法目标、高亮、确认、落位与取消。
- [ ] 分离常规技能攻击打出与已激活卡牌的阶段能力使用，禁止扣费空移动；保留部署后和出牌后的合法能力窗口。
- [ ] 核对并修正基础规则到界面的断口：A1/A2 和真实局势库、暗置信息投影、部署席位与地利、常规明暗出牌及技能混选、准备与御主能力入口、弃牌检视。逐张全卡效果与高级响应仍按原延期边界记录，不能宣称全部规则已实现。
- [ ] 同状态同视口复核旧/新首屏信息、卡牌大小、锚点、额外滚动和点击，独立审查直接消费用户原文与规则；任何未经授权损失都不得用局部收益抵消。
- [ ] 本轮覆盖全部通过后重建官方查看器证据；此前链接不构成当前验收完成。

### 2026-10-23 当前用户合同正式验收

- [x] 攻击单主区、技能右侧常显（含准备阶段）、推进在技能上方、合计威力紧邻暂存左侧；旧双主区及旧比例锚点退役。
- [x] 原手牌完整交互/触控回归、原骑乘4项、真实网络4项、浏览器自然11轮、战后/淘汰/终局代表态；各自按直接证据认定，未混作三浏览器全链或完整游戏。
- [x] 当前35整屏媒体、12实际行为链、独立图审及四组正式查看器已交付。未自动打开，供用户查看。
- [验收报告](../../../evidence/fate-domination/foundation-ui-acceptance-2026-10-23.md)与[证据索引](../../../evidence/fate-domination/acceptance-20261023/evidence-index.json)。
- 本轮未提交/推送/发布；Zouken素材来源、无限剑制中文语义及七类完整游戏后续范围继续保留。全仓typecheck仍未通过，详报告。

### 2026-10-24 追加教程、AI与界面纠偏

- 当前依据转为[本轮报告](../../../evidence/fate-domination/tutorial-ai-ui-acceptance-2026-10-24.md)：用户已否定整体UI/教程结论，原63图与媒体门禁只作历史。当前重新验证部署顺序、点位选择和所有前景面板提示，必须在教程内覆盖全部已实现独特UI；未恢复整体PASS。
- 保留全卡效果、高级响应、未完成角色能力、AI策略、教程角色分支、音频和资源发布各自缺口。旧日期的结果与勾选不能代替本轮证据。
- 2026-10-24当前纠偏复验：首次准备无棋子、具体点位选/取消/确认/落位、前景提示、紧凑详情与红淘汰已由主代理直接复核；最终教程两项通过（自然11轮及退出后继续），22个独特画面逐项观察和SHA见本轮报告。全部UI覆盖仍保留共享撤回协商/日志等缺项，整体不恢复PASS。


## 2026-10-25 最新基础范围复验

- [x] 当前攻击单主区、右侧技能常显、上方推进和暂存左侧威力；草稿原子确认及骑乘隔离按当前测试复核。
- [x] 当前基础自然联网、规则课程与公开/隐藏、具体部署点位、移动、令咒、战后、淘汰及终局分别有直接证据；六个 Fate E2E 文件合计 11 项通过。
- [x] 用户退回的御主资料职责已按中文原卡重做；当前 24 张独特界面、两行为链通过正式门禁并注册查看器，待用户验收。[当前报告](../../../evidence/fate-domination/foundation-tutorial-ui-acceptance-2026-10-25.md)。
- [ ] 本节不交付完整游戏；角色产生/持有/激活机制、全卡、高级响应、AI 策略、教程扩展、音频与生产发布按报告分项保留。

## 2026-10-26 用户再次退回后的重构（当前优先）

旧24图的整体视觉结论及查看器交付资格撤回，以下状态覆盖历史勾选。当前合同：[教程与交互承载重构](../../../evidence/fate-domination/tutorial-reconstruction-contract-20261026.md)。

- [x] 实际重读最新版教程标准；明确原文可追溯不代表选材必要，沿用唯一标准，不新增平行skill。
- [x] 作者学习目标/来源取舍与正式命令输入投影分离；revision 4 先读费用、基本威力、技能门槛，再支付及使用。
- [x] 首次真实收牌后承接牌的去向，再教弃牌查看；删除查看节点中无前因的“关闭攻击”和令咒整段重复。
- [x] 手牌改用源图比例、纵向完整边界与轻描边；推进组合进真实技能区；本人和对手头像消费淘汰红斜杠。
- [x] 当前真实教程、原手牌/骑乘、联网和受限桌面/触控复验；55文件285项、六个E2E文件11项本轮通过，最后地图样式返工后受影响三项再通过。24图主链与独立受限视口两图分别通过正式门禁，原查看器已更新。[当前报告](../../../evidence/fate-domination/tutorial-reconstruction-acceptance-20261026.md)。
- [ ] 全卡、高级响应、完整角色效果、AI策略、教程扩展、音频、生产资源发布仍分别未完成；共享撤回协商/日志、竖屏和七人压力态不由本基础规则课程证明。


## 2026-10-26 整段教程重审（用户最新退回，覆盖以上教程通过结论）

- [x] 原教程PASS作废：重复按钮文案、他席能力对象错误及行动因果缺口；记录在 evidence/fate-domination/tutorial-full-re-audit-20261026.md。
- [x] revision 5 正式领域复演：先移动再出牌，真实争取事件奖励，不给对手让位；不强迫取消重开、不重复终局胜负。
- [x] 全部文案、当前源真实入口、整屏视觉、刷新回退及退场新决定完成复验；2026-10-27当前56文件302测试、六个E2E文件11项、24张主链图及2张独立视口图通过。正式门禁和看图工具注册通过，待用户复核；[最新结果](../../../evidence/fate-domination/tutorial-full-re-audit-20261026.md)。七类未完成项及全UI范围边界保持。
