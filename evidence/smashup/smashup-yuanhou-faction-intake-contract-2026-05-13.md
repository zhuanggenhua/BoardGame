# SmashUp yuanhou 四派系 intake 合同与验证

## 范围

- 本轮接入 `public/assets/i18n/zh-CN/smashup/cards/yuanhou.png` 与 `base/yuanhou.png` 对应的四个派系：`shapeshifters`、`cyborg_apes`、`super_spies`、`time_travelers`。
- 完成静态 intake：派系 ID、图集注册、卡牌/基地定义、locale、派系选择 metadata、manifest、R2 compressed 资源上传与 UI 入口验证。
- 本轮继续补入代表性玩法能力：`src/games/smashup/abilities/yuanhou.ts`、`ongoing_modifiers.ts` 与 `src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts`。
- UI 仍沿用项目现有 `implementationStatus: 'in_progress'` 标记口径，表示整派系后续仍可继续细化深水区规则，而不是静态资源缺失。

## 图片合同

- 卡牌图：`cards/yuanhou.png`，尺寸 `3886x4096`，按 `8 列 x 6 行 = 48 格`。
- 基地图：`base/yuanhou.png`，尺寸 `4096x1458`，按 `4 列 x 2 行 = 8 格`。
- 分块核对产物：
  - `temp/smashup-yuanhou-intake/slices/cards-yuanhou-overview-max1600.png`
  - `temp/smashup-yuanhou-intake/slices/cards-yuanhou-8x6-shapeshifters-0-11.png`
  - `temp/smashup-yuanhou-intake/slices/cards-yuanhou-8x6-cyborg-apes-12-23.png`
  - `temp/smashup-yuanhou-intake/slices/cards-yuanhou-8x6-super-spies-24-35.png`
  - `temp/smashup-yuanhou-intake/slices/cards-yuanhou-8x6-time-travelers-36-47.png`
  - `temp/smashup-yuanhou-intake/slices/base-yuanhou-0-7.png`

## 基地顺序

- `base_the_nexus` / The Nexus：index 0，breakpoint 19，VP `[3,3,2]`，`time_travelers`。
- `base_portal_room` / Portal Room：index 1，breakpoint 22，VP `[2,3,1]`，`time_travelers`。
- `base_isis_swingin_pad` / ISI's Swingin' Pad：index 2，breakpoint 21，VP `[4,2,1]`，`super_spies`。
- `base_secret_volcano_headquarters` / Secret Volcano Headquarters：index 3，breakpoint 18，VP `[4,3,2]`，`super_spies`。
- `base_the_vats` / The Vats：index 4，breakpoint 15，VP `[3,1,1]`，`shapeshifters`。
- `base_faceless_city` / Faceless City：index 5，breakpoint 20，VP `[4,2,1]`，`shapeshifters`。
- `base_primate_park` / Primate Park：index 6，breakpoint 20，VP `[3,2,1]`，`cyborg_apes`。
- `base_monkey_lab` / Monkey Lab：index 7，breakpoint 23，VP `[4,2,1]`，`cyborg_apes`。

## 运行时资源

- 本地 manifest：`node scripts/assets/generate_asset_manifests.js --validate --root public/assets/i18n/zh-CN --id smashup` 通过。
- R2 定向上传：
  - `official/i18n/zh-CN/smashup/cards/compressed/yuanhou.webp`
  - `official/i18n/zh-CN/smashup/base/compressed/yuanhou.webp`
- CDN HEAD 回查：
  - `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/yuanhou.webp` -> `200`, `image/webp`, `1018858` bytes。
  - `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/base/compressed/yuanhou.webp` -> `200`, `image/webp`, `321544` bytes。

## 验证

- `npm run test -- src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts`：35 tests passed；覆盖四派系代表能力、八个基地能力、选择/搜寻/排序交互、Copycat / Cellular Bonding 代表性代理、Cyberback 领域链路。
- `npm run test -- src/games/smashup/__tests__/yuanhouFactionIntake.test.ts src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts src/games/smashup/__tests__/cardI18nIntegrity.test.ts src/components/common/media/__tests__/CardPreview.i18n.test.tsx src/games/smashup/__tests__/criticalImageResolver.test.ts src/games/smashup/__tests__/factionSelection.test.ts`：6 files passed，133 tests passed。
- `npx vitest run src/games/smashup/__tests__/ongoingMinionTriggerAudit.test.ts --config vitest.config.audit.ts --configLoader native`：1 file passed，102 tests passed。
- `npx vitest run src/games/smashup/__tests__/abilityBehaviorAudit.test.ts --config vitest.config.audit.ts --configLoader native`：25 passed，1 failed；失败项为既有 `zombies.ts` 出现在遗留 `registerAbility` 白名单差异中，本轮 yuanhou 覆盖项通过。
- `npx vitest run src/games/smashup/__tests__/audit-ongoing-coverage.property.test.ts --config vitest.config.audit.ts --configLoader native`：失败于既有 ongoing 覆盖缺口（本次种子报 `steampunk_zeppelin_pod`），非本轮 yuanhou 新增项。
- `npx vitest run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts --config vitest.config.audit.ts --configLoader native`：失败项集中在既有 `bear_cavalry`、`tornados`、`mythic_greeks`、`vampire` 交互登记问题，非本轮 yuanhou 新增项。
- `npm run typecheck`：通过。
- `npm run i18n:check`：`no missing keys detected`。
- `node scripts/assets/generate_asset_manifests.js --validate --root public/assets/i18n/zh-CN --id smashup`：通过。
- `npm run test:e2e:ci:file -- e2e/smashup-yuanhou-factions.e2e.ts`：3 passed。
- `git diff --check`：通过，仅有 LF/CRLF 工作区提示。
- 2026-05-13 最新复跑确认：
  - 上述 6 文件测试组：6 files passed，133 tests passed。
  - `npm run typecheck`：通过。
  - `npm run i18n:check`：`no missing keys detected`。
  - `node scripts/assets/generate_asset_manifests.js --validate --root public/assets/i18n/zh-CN --id smashup`：通过。
  - `npm run test:e2e:ci:file -- e2e/smashup-yuanhou-factions.e2e.ts`：3 passed，截图已重新打开核对。

## 代表性玩法覆盖

- 变形者：`genetic_shift` 真实行动入口加临时力量；`transmogrify`、`... really?`、`gelf`、`doppelganger` 已从自动取第一候选改为玩家选择；`copycat` / `cellular_bonding` 已有 talent、保护、持续力量与关键触发代理；`shell_game` 保护、`mimic/splice` 持续力量已注册。
- 电子猿：`going_bananas` 移除基地附着行动；`missing_uplink` 从 attachedActions 回合结束抽牌；`cyberevolution/juiced_up/furious_george` 持续力量已注册；`shielding` 保护已注册；`Clyde 2.0` 会把同基地己方随从身上将进弃牌堆的行动改为进手牌；`Cyberback` 允许从弃牌堆把附着随从的持续行动打到自己身上，且多宿主时可精确选择目标。
- 超级间谍：`spy`、`operative`、`permit_to_kill`、`for_my_eyes_only` 已补查看牌库后的玩家排序/选择；`from_q_with_love` 抽三后可从旧手牌和新抽牌中选择两张弃掉；`mindraker` 行动限制、`secret_agent` 行动后触发、多个展示/弃牌/控制效果已注册。抽样语义审计同步修正 `base_isis_swingin_pad`：注册 ID 与静态基地一致，效果为赢家重排自己牌库顶三张。
- 时间旅行者：`do_over` 返回己方随从并授予同名额外打出额度；`stasis_field` 压制基地能力并在拥有者回合开始脱离；`time_is_fleeting` 已支持从基地弃牌堆多候选中选择替换基地；`time_raider`、`repeater_perfect`、`1.21_gigawatts` 已补弃牌堆多候选选择；`jumper` 离场回手、`time_walk`、`wormhole` 等代表能力已注册。

## 残余风险

- `Copycat` / `Cellular Bonding` 已不再只是 metadata：当前已覆盖代表性 talent、保护、持续力量与关键触发代理。残余风险是尚未实现完全通用的 onPlay / special / 所有 trigger 动态复制 runtime；若未来宣称“完整复制任意能力”，需要扩展 ability runtime 的通用代理机制。
- 本轮选择/搜寻/排序牌已补 L2 行为证据；Cyberback 有 L3 真实入口 E2E。若后续要求每张选择牌都达到 L3，需要继续为 `Transmogrify`、`Permit to Kill`、`For My Eyes Only` 等补真实打牌入口截图链。
- 既有审计命令失败项集中在非 yuanhou 老派系或历史白名单漂移，已记录为外部审计债务，不作为本轮四派系 intake 阻塞项。

## 截图核对

- 截图：`D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\派系选择页能看到四个新派系、实施中标记与素材卡\yuanhou-faction-selection-visible.png`
- 肉眼观察：
  - 截图中可见 `变形者`、`电子猿`、`超级间谍`、`时间旅行者` 四张新派系入口。
  - 四个新派系入口各自显示来自 `yuanhou` 图集的代表卡面，不是空白占位。
  - 四个新派系入口均有“实施中”横条，符合当前静态 intake 完成但玩法未完成的状态口径。
  - 同屏其它旧派系仍可见空白素材卡，但不属于本轮 yuanhou 接入范围；本轮四个新派系素材均已实际渲染。
- 截图：`D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\电子猿-Cyberback-可从弃牌堆真实选择持续行动并打到自己身上\yuanhou-cyberback-discard-action-visible.png`
- 肉眼观察：
  - 页面处于 P1 出牌阶段，猴子实验室上有己方 Cyberback。
  - 弃牌堆面板已展开，`Cyberevolution` 卡牌可见并高亮为可操作，证明弃牌堆行动入口真实暴露。
- 截图：`D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\电子猿-Cyberback-可从弃牌堆真实选择持续行动并打到自己身上\yuanhou-cyberback-action-attached.png`
- 肉眼观察：
  - 点击基地后 Cyberback 旁出现附着行动标记，弃牌堆计数归零。
  - 该截图与状态断言一起证明 `Cyberevolution` 从弃牌堆移动到 Cyberback 的 attachedActions，而不是只做 UI 高亮。
- 截图：`D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\电子猿-Cyberback-多宿主时可精确选择附着目标\yuanhou-cyberback-multi-target-selectable.png`
- 肉眼观察：
  - 同一基地有两只 Cyberback，`Shielding` 被选中后界面进入随从选择状态。
  - 该截图证明多宿主时没有继续自动选择第一只 Cyberback。
- 截图：`D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\电子猿-Cyberback-多宿主时可精确选择附着目标\yuanhou-cyberback-multi-target-attached-to-second.png`
- 肉眼观察：
  - `Shielding` 附着标记出现在第二只 Cyberback 旁，第一只 Cyberback 未显示该附着行动。
  - 该截图与 E2E 状态断言一起证明多宿主精确目标选择已生效。

## Addendum（2026-06-06）：Cyberback 弃牌持续行动真实入口复跑

- 触发原因：本轮用户追问“赛博守护者为什么没有效果”后，当前主工作树已补回 `Board.tsx` 的弃牌持续行动真实入口，但仍需重新拿浏览器证据证明修复。
- 首次复跑时，现役 E2E 第一条用例暴露出测试本身仍按旧路径写成“点基地收口”，与当前真实 UI 的“点高亮赛博守护者宿主”不一致；失败截图里可见绿色高亮目标明确落在 `赛博守护者` 本体上，而不是基地卡面。
- 已修正 [e2e/smashup-yuanhou-factions.e2e.ts](/D:/gongzuo/webgame/BoardGame/e2e/smashup-yuanhou-factions.e2e.ts:361)：
  - 将第一条 `Cyberback` 真实入口用例从点击 `base-zone-0` 改为点击 `[data-minion-uid="cyberback-a"]`。
- 本轮复跑结果：
  - `node scripts/infra/run-e2e-single.mjs ci e2e/smashup-yuanhou-factions.e2e.ts "电子猿 Cyberback 可从弃牌堆真实选择持续行动并打到自己身上"`：`1 passed`
  - `node scripts/infra/run-e2e-single.mjs ci e2e/smashup-yuanhou-factions.e2e.ts "电子猿 Cyberback"`：`3 passed`

### 本轮关键截图（绝对路径）

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\电子猿-Cyberback-可从弃牌堆真实选择持续行动并打到自己身上\yuanhou-cyberback-discard-action-visible.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\电子猿-Cyberback-可从弃牌堆真实选择持续行动并打到自己身上\yuanhou-cyberback-action-attached.png`

### 肉眼核图结论

- `yuanhou-cyberback-discard-action-visible.png`
  - 弃牌堆面板已经展开，`电子猿进化（Cyberevolution）` 在右下弃牌候选里真实可见，不是伪造 prompt。
  - 棋盘上的 `赛博守护者` 本体被绿色高亮，说明当前真实交互载体是“点宿主随从”，不是“点基地”。
  - 该截图达到“真实入口已暴露正确可操作对象”的验收标准。
- `yuanhou-cyberback-action-attached.png`
  - `赛博守护者` 旁已出现附着行动缩略卡，力量从 `5` 变为 `8`，左上有 `+3` 标识。
  - 右下弃牌堆按钮从 `弃牌(1)` 变为 `弃牌(0)`，说明该持续行动已从弃牌堆移出，而不是只保留高亮。
  - 该截图结合 E2E 状态断言，达到“弃牌持续行动已真实附着到己方赛博守护者并完成收口”的验收标准。
