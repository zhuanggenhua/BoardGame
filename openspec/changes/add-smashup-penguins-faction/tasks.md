## 0. Approval

- [x] 0.1 用户审阅并明确批准本提案后再开始运行时代码实施。
  - 2026-08-06：用户明确要求“完成完整企鹅的玩法实现”，本轮按已批准实施推进。

## 1. Intake Contract

- [x] 1.1 将企鹅卡牌 atlas 与基地 atlas 复制到正式 Smash Up 资源源路径，并保留原始来源、尺寸、hash 与获取时间。
  - 证据：`proposal.md` Source Contract、`public/assets/i18n/zh-CN/smashup/cards/penguins.png`、`public/assets/i18n/zh-CN/smashup/base/penguins.png`。
- [x] 1.2 生成完整单卡/单基地裁图到 `temp/`，逐格记录 row-major index、TTS CardID、中文名、英文名、类型、力量、数量和可读性。
  - 证据：`temp/smashup-penguins-intake/` 与 `temp/atlas-intake-20260801/penguins-crops/`。
- [x] 1.3 建立 `evidence/smashup/*penguins*` 真相源表、切图表、卡牌/基地核对合同表、对照表和冲突待裁定表。
  - 证据：`evidence/smashup/smashup-penguins-closeout-2026-08-06.md`。
- [x] 1.4 锁定 15 张唯一卡面、20 张实体牌、2 张基地与 1 张非手牌封面格；封面格不得进入运行时手牌注册。
  - 证据：`src/games/smashup/__tests__/penguinsIntegration.test.ts` 4 passed。
- [x] 1.5 将每张卡和基地拆成 C1/C2/C3 规则子句、effect atom、可选/强制语义、跳过/空选需求和共享机制复用点。
  - 证据：closeout 对象级机制矩阵与 24 条企鹅能力 L2 行为测试。
- [x] 1.6 将 intake handoff 更新为 `locked/blocked/disputed`，满足 implementation 前置门禁。
  - 证据：closeout 批次矩阵；本地玩法与资源链为 `passed`，服务器素材主源按用户口径登记为当前 PR 范围外 scoped-debt。

## 2. Runtime Assets

- [x] 2.1 复用既有 `PENGUINS_CARDS` / `PENGUINS_BASES` atlas id，或在证据证明冲突时做最小增量修正。
- [x] 2.2 压缩企鹅 card/base runtime WebP，不降采样正式对局素材。
  - 证据：`public/assets/i18n/zh-CN/smashup/cards/compressed/penguins.webp`、`public/assets/i18n/zh-CN/smashup/base/compressed/penguins.webp`。
- [x] 2.3 重建游戏级与根级 manifest，并确认 `smashup/cards/penguins` 与 `smashup/base/penguins` 新键真实写入。
  - 证据：`public/assets/i18n/zh-CN/smashup/assets-manifest.json` 与 `public/assets/i18n/assets-manifest.json` 均包含企鹅 card/base 原图与 compressed 键。
- [x] 2.4 将 runtime WebP 的服务器素材主源发布记录为当前玩法 PR 范围外 scoped-debt。
  - scoped-debt：2026-08-06 用户明确收窄本次 PR 范围为“只做好玩法实现”，并说明企鹅图面素材已有，不要求服务器素材主源上传。本项不再作为本次玩法 PR 门禁；若后续发布环境要求远端素材主源，再单独补上传与代表 URL 回查。
- [x] 2.5 将远端上传未执行的范围边界明确写入 evidence 和最终汇报。
  - 证据：closeout 的“资源服务器主源发布”与“资源链证据”章节已记录历史探针，并明确当前玩法 PR 不要求远端上传。

## 3. Static Data And Locale

- [x] 3.1 新增 `src/games/smashup/data/factions/penguins.ts`，录入 15 个唯一卡面、20 张实体牌和 2 张基地。
- [x] 3.2 在 `src/games/smashup/data/cards.ts` 增量注册企鹅卡牌与基地，不重排无关派系。
- [x] 3.3 补齐 `public/locales/zh-CN/game-smashup.json` 与 `public/locales/en/game-smashup.json` 的 faction/card/base 文案。
  - 证据：`npm run i18n:check` passed。
- [x] 3.4 补齐 `src/games/smashup/ui/factionMeta.ts` 的企鹅派系 metadata、图标、颜色、可见性与显示顺序。
- [x] 3.5 补齐 `src/games/smashup/criticalImageResolver.ts` 中企鹅 card/base 关键图或暖加载覆盖。
- [x] 3.6 验证完整企鹅派系能关联现有 `penguins_emperor_penguin` 企鹅帝皇泰坦。
  - 证据：`src/games/smashup/__tests__/penguinsIntegration.test.ts`。

## 4. Gameplay Implementation

- [x] 4.1 实现牌库顶展示、打出、抽取、回牌库顶/底、洗牌和任意顺序放回等共享 deck helper 调用。
- [x] 4.2 实现企鹅宝宝、时髦企鹅、企鹅司令、破壳而出等牌库顶随从作为额外随从打出的效果。
- [x] 4.3 实现冲浪企鹅、冰滑道等基地间移动效果，包含目标基地合法性和可选/跳过路径。
- [x] 4.4 实现跳舞企鹅、乔装企鹅、反刍企鹅等特殊/天赋/展示/回牌库效果，逐项验证消耗、时机和最终权威状态。
- [x] 4.5 实现秘密任务、渴望飞翔的工作、跳上船、我不能区分他们、水晶礼品、在冰下等行动牌效果。
- [x] 4.6 实现浮冰与企鹅殖民地基地能力，包含计分、触发、抽牌/移动/额外随从语义。
  - 2026-08-06：企鹅殖民地额外打出牌库顶伙伴已改为复用 `buildPlayTopDeckMinionResult`，额外打出的企鹅宝宝/时髦企鹅会继续触发自身 `onPlay`。
- [x] 4.7 若新增或复用 `targetType: generic`，同步更新 generic 保留理由审计白名单。
- [x] 4.8 只在用户明确批准时登记 scoped-debt；否则每个已锁规则子句都必须实现或明确 blocked。
  - 当前无玩法 `scoped-debt`；服务器素材主源发布已按用户口径排除在本次玩法 PR 范围外。

## 5. Validation And Evidence

- [x] 5.1 添加企鹅静态组成、atlas/manifest、i18n、faction selection、泰坦关联与能力注册测试。
  - 证据：`src/games/smashup/__tests__/penguinsIntegration.test.ts` 4 passed。
- [x] 5.2 添加企鹅能力 L2 行为测试，覆盖每个 effect atom 的正路径、可选跳过/空选和关键负向路径。
  - 2026-08-06：`src/games/smashup/__tests__/abilities/penguins.test.ts` 24 passed。
- [x] 5.3 添加至少 1 条真实入口 L3/L4 E2E，覆盖派系选择、开局渲染、卡图/base 图显示和一条新的企鹅核心玩法交互。
  - 2026-08-06：`smashup-penguins-playable.e2e.ts` 已扩展并通过 7 条真实入口链，覆盖普通企鹅主要玩法链。
- [x] 5.4 对涉及 reaction session、计分后、特殊/天赋/持续能力的对象补 finalState / triggerQueue / interaction 收口证据。
  - 证据：7 条 E2E 与 closeout 的真实入口覆盖表；计分后链验证 `triggerQueue` / `interaction` 收口。
- [x] 5.5 运行定向 Vitest、相关审计测试、i18n check、typecheck、资源校验和 OpenSpec strict validation。
  - 2026-08-06：i18n check、企鹅能力 Vitest 24、企鹅集成 Vitest 4、typecheck、OpenSpec strict validation、企鹅 E2E 7 均通过；generic 审计和 assets validate 当前仅剩非企鹅基线失败，普通企鹅项已收口。
- [x] 5.6 写入 `evidence/smashup/*penguins*` closeout，包含对象级 L0/L1/L2/L3/L4 矩阵、截图路径、残余范围和旧审计回写。
  - 证据：`evidence/smashup/smashup-penguins-closeout-2026-08-06.md` 已更新为当前 24 L2 / 7 E2E / 远端资源 scoped-debt 口径。

## 6. Closeout

- [x] 6.1 回写 `evidence/smashup/SMASHUP-CARD-COUNT-AUDIT.md` 中企鹅未实现的历史结论。
- [x] 6.2 审查最终 diff，确保没有把无关历史/并行工作区改动混进本 change。
  - 2026-08-06：已审查企鹅 change 范围。当前工作区仍存在非企鹅 tracked 改动（如中国扩展、古印加与 locale 历史/并行差异），后续提交/PR 必须按本 change 文件清单分开 staging，不能直接 `git add .` 混入企鹅提交。
- [x] 6.3 若用户要求提交/PR，使用中文高信息密度提交消息，点名企鹅派系、资源和玩法实现。
  - 2026-08-06：用户已要求提交 PR；本次按普通企鹅玩法实现、资源接入与验证证据组织中文提交和 draft PR。
