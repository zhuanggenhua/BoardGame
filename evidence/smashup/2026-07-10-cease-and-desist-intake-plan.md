# 大杀四方 Cease and Desist 四派系 intake 状态（2026-07-10）

## 当前边界

- gameId：`smashup`
- 当前 worktree：`D:\GA\BoardGame-upstream-main-dev-20260601`
- 当前分支：`codex/upstream-main-dev-20260707`
- 本轮交付级别：四派系完整 intake、资源接入、玩法实现、审计与真实入口 E2E。
- 审批状态：用户于 `2026-07-10` 明确回复“批准四派系整体实施”，implementation 门禁已解除。
- 根 `task_plan.md / findings.md / progress.md` 正在服务《七大恨》任务，本文件是本批次独立状态入口。

## 批次对象

| 中文名 | canonical 英文名 | objectId | 实体牌数 | 唯一牌图数 | 基地数 | 泰坦 |
| --- | --- | --- | ---: | ---: | ---: | --- |
| 宇宙武士 | Astroknights | `astroknights` | 20 | 18 | 2 | 无 |
| 卑劣封臣 | Ignobles | `ignobles` | 20 | 12 | 2 | 漫步山丘 |
| 星际旅者 | Star Roamers | `star_roamers` | 20 | 13 | 2 | 无 |
| 百变机兵 | Changerbots | `changerbots` | 20 | 12 | 2 | 合体机器人 |

说明：中文派系名以用户提供汉化图的卡面脚注为当前主真相源。仓库历史 evidence 使用过“星际骑士 / 卑鄙者 / 星际漫游者 / 变形机器人”等译名，后续必须进入对照与冲突表，不能静默覆盖当前图面。

## 真相源表

| 来源 | 绝对路径 / URL | 大小 | 尺寸 | SHA-256 | 当前用途 | 状态 |
| --- | --- | ---: | --- | --- | --- | --- |
| 中文卡牌 atlas | `C:\Users\Dqm\Downloads\Smash Up! by Mervil (2833984701)-汉化版\Smash Up! by Mervil (2833984701)-汉化图\Mods\Images\httpssteamusercontentaakamaihdnetugc779607575817998614CAB18606A3248EE1EE6E115EB54E0A55712A111D.png` | 40,703,873 bytes | `3332 x 4096` | `4A09DAEC2938CDF54417DE3C5AA27EA138C2DFD51A6B8B5999888B4F1E1F144B` | 中文卡面、派系名、效果、cards 索引 | `source-found` |
| 中文基地 atlas | `C:\Users\Dqm\Downloads\Smash Up! by Mervil (2833984701)-汉化版\Smash Up! by Mervil (2833984701)-汉化图\Mods\Images\httpssteamusercontentaakamaihdnetugc779607575813643843C2FB43B67A3A289E39BBF4D7487EFACBF973A34D.png` | 16,473,573 bytes | `2878 x 4096` | `CE1B3446CA94AF3ABE3C0A3E88D14B7DD5228A408BC05D9F2EFDB7D3507E4B00` | 中文基地卡面、bases 索引 | `source-found` |
| 泰坦 atlas | `C:\Users\Dqm\Downloads\Smash Up! by Mervil (2833984701)-汉化版\Smash Up! by Mervil (2833984701)-汉化图\Mods\Images\httpssteamusercontentaakamaihdnetugc17873602896357179238C94C46F97554D53D42E3FEFAEC5EA120A22109B.png` | 23,674,169 bytes | `1824 x 7000` | `0584DE5873D93E19292EC60A346CEB4EFBE73F42766645F2D34036BCAA60F981` | 漫步山丘、合体机器人图面与既有 atlas 对照 | `source-found` |
| TTS save | `C:\Users\Dqm\Downloads\Smash Up! by Mervil (2833984701)-汉化版\Smash Up! by Mervil (2833984701)-汉化图\Mods\Workshop\2833984701.json` | 9,660,973 bytes | JSON | `9CB9EC26259D8BF85BFB6FA84F9B14A7D32A6E21AD075B8B6C62757BD24CFF1D` | kit identity、CardID、count、base、breakpoint、titan provenance | `source-found` |

发现/核对日期：`2026-07-10`。采集方式：用户本地 Mod 素材 + 本地结构化 JSON 扫描 + 轻量预览人工核图。

## 临时读图产物

所有预览只服务 intake，不进入正式资源树：

- `temp/smashup-cease-desist-intake/overview.png`
- `temp/smashup-cease-desist-intake/row-01.png` 至 `row-07.png`

原图触发大图门禁：单边超过 `2500px`、总像素超过 `8MP`、文件超过 `8MB`。2026-07-12 回写：55 张完整单卡裁图与 8 张完整基地裁图已生成并纳入完成矩阵；当前本地裁图合同已闭合，R2 远端验证按用户指示不纳入本轮。

## Cards atlas 可视合同

| index 范围 | 图上对象 | 运行时对象 | 允许状态 | 可交互 | 当前结论 |
| --- | --- | --- | --- | --- | --- |
| `0-17` | 宇宙武士 18 个唯一牌图 | `astroknights` cards | card | 是 | 已锁范围，逐卡字段待录 |
| `18-29` | 卑劣封臣 12 个唯一牌图 | `ignobles` cards | card | 是 | 已锁范围，逐卡字段待录 |
| `30-42` | 星际旅者 13 个唯一牌图 | `star_roamers` cards | card | 是 | 已锁范围，逐卡字段待录 |
| `43-54` | 百变机兵 12 个唯一牌图 | `changerbots` cards | card | 是 | 已锁范围，逐卡字段待录 |
| `55` | 宇宙武士展示图 | 无 card def | display-only | 否 | 禁止进入 card registry |

TTS deck 路径：

- 星际旅者：`ObjectStates[238].ContainedObjects[25]`
- 卑劣封臣：`ObjectStates[238].ContainedObjects[67]`
- 百变机兵：`ObjectStates[238].ContainedObjects[89]`
- 宇宙武士：`ObjectStates[238].ContainedObjects[96]`

## Bases atlas 可视合同

| index | canonical 名称 | breakpoint | 派系 |
| ---: | --- | ---: | --- |
| `0` | Spikey Chair Room | 20 | 卑劣封臣 |
| `1` | No-Moon | 25 | 宇宙武士 |
| `2` | USS Undertaking | 22 | 星际旅者 |
| `3` | Unicrave | 19 | 百变机兵 |
| `4` | Wintersquashed | 16 | 卑劣封臣 |
| `5` | Changing Room | 22 | 百变机兵 |
| `6` | Neutral Space | 18 | 星际旅者 |
| `7` | Hive of Scum and Villainy | 18 | 宇宙武士 |

2026-07-12 回写：VP、breakpoint、基地效果文本已在 `src/games/smashup/data/factions/cease_and_desist.ts`、`public/locales/{zh-CN,en}/game-smashup.json` 与 `evidence/smashup/2026-07-12-cease-and-desist-completion-matrix.md` 中锁定；当前基地对象本地状态为 `passed-local`，R2 远端验证按用户指示不纳入本轮。

## 泰坦复用结论

- `ignobles_the_hill_that_strolls`：当前代码已存在静态定义、能力、交互、locale 与测试；本批次已通过全对象矩阵和 direct E2E 引用验证复用合同。
- `changerbots_mergacon`：当前代码已存在静态定义、能力、交互、locale 与测试；本批次已通过全对象矩阵和 direct E2E 引用验证复用合同。
- 本批次不建立第二套泰坦逻辑；派系 registry/set-aside 联动、当前合同对账和所属派系 direct E2E 证据见 `evidence/smashup/2026-07-12-cease-and-desist-completion-matrix.md`。
- 2026-07-12 回写：`src/games/smashup/rule/泰坦机制与卡牌抄录.md` 与 `src/games/smashup/rule/泰坦数据录入核对表.md` 中关于合体机器人、漫游山岭巨人的历史“未纳入运行时”口径已失效；当前以本段和完成矩阵为准。

## 批次矩阵

| objectId | 数据录入 | 资源链 | 机制实现 | 审计 | E2E | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| `astroknights` | `passed` | `local-passed / r2-scoped-out` | `passed` | `passed` | `passed` | `passed-local` |
| `ignobles` | `passed` | `local-passed / r2-scoped-out` | `passed` | `passed` | `passed` | `passed-local` |
| `star_roamers` | `passed` | `local-passed / r2-scoped-out` | `passed` | `passed` | `passed` | `passed-local` |
| `changerbots` | `passed` | `local-passed / r2-scoped-out` | `passed` | `passed` | `passed` | `passed-local` |

2026-07-12 回写：原始 intake 记录中的早期进行中/代表性通过/待处理状态为历史快照；当前批次状态以 `evidence/smashup/2026-07-12-cease-and-desist-completion-matrix.md` 的批次状态矩阵为准。

## 当前实现与验证记录（2026-07-11）

### 静态接入

- 新增静态数据文件：`src/games/smashup/data/factions/cease_and_desist.ts`。
- 已接入共享注册入口：`src/games/smashup/domain/ids.ts`、`src/games/smashup/domain/atlasCatalog.ts`、`src/games/smashup/data/cards.ts`、`src/games/smashup/ui/factionMeta.ts`。
- 已补双语 locale：`public/locales/zh-CN/game-smashup.json`、`public/locales/en/game-smashup.json`。
  - 本轮全量审计补齐四派系 55 张卡 + 8 个基地共 63 个 `cards.<id>.name` 双语 key。
- 2026-07-12 回写：完整 `abilityText/effectText` 已按 Wiki MediaWiki API 来源补齐到 zh-CN/en locale；逐卡原文矩阵见 `evidence/smashup/2026-07-12-cease-and-desist-completion-matrix.md`。
- 当前静态合同：55 张唯一卡面、80 张实体牌、8 张基地；cards atlas slot `55` 保持 `display-only`，未进入 card registry。

### 能力模块

- 新增能力模块：`src/games/smashup/abilities/cease_and_desist.ts`。
- 已在 `src/games/smashup/abilities/index.ts` 注册 `registerCeaseAndDesistAbilities()`。
- 宇宙武士已覆盖代表链：阻止探解目标选择 +2、隐蔽基地回合开始抽牌、外星人大师力量指示物、幽灵武士/激光剑持续修正与保护等第一版实现。
- 卑劣封臣已覆盖代表链：有债必还交出控制权后抽牌与额外随从、基础控制转移/夺回控制链第一版实现。
- 星际旅者已覆盖代表链：大规模传送回手、奇异新世界插入新基地并授予基地限定额外随从、传送类移动/回手第一版实现。
- 百变机兵已覆盖代表链：合体形态己方随从 +1、跋扈模块、铯装甲、部分变形/移动/消灭链第一版实现。
- 本轮修正：
  - 医疗指挥官触发结算改回使用反应队列实际传入的 `ctx.playerId`，确认己方随从回手后能抽 1 张牌。
  - 乘客不再依赖测试手写兜底字段；`MINION_MOVED` 现在会给带乘客的宿主记录本回合原基地，回合开始清理该临时元数据。
  - 持续修正/保护消费点补测：激光剑、幽灵武士、防御力场、跋扈模块、铯装甲均进入对象级 L2 断言。
  - 保留旧记录：舰长额外随从额度改用 `powerMax: 3`，移除无效 `specificCardUid`；持续/占位能力反馈改用已有 `feedback.ability_not_implemented`；奇异新世界改为插入新基地而不是错误地 `keepCards` 替换不存在的基地。

### 自动化验证

- 新增定向测试：`src/games/smashup/__tests__/abilities/cease-and-desist.test.ts`。
- 覆盖内容：静态数量、slot `55` display-only + registry 缺席、四派系核心能力注册、宇宙武士阻止探解、卑劣封臣有债必还、星际旅者大规模传送、星际旅者奇异新世界、百变机兵合体形态、宇宙武士持续牌与被动件、星际旅者防御力场、医疗指挥官回手触发、百变机兵持续装备与乘客移动链。
- 已运行并通过：

```powershell
npx vitest run src/games/smashup/__tests__/abilities/cease-and-desist.test.ts
```

结果：`1 passed / 11 tests passed`。

- 已运行双语 locale 覆盖脚本：

```powershell
node -e "<parse public/locales/{zh-CN,en}/game-smashup.json and assert all 63 Cease and Desist card/base ids exist under cards>"
```

结果：`zh-CN missing 0 / en missing 0`。注意：该脚本只验证名称 key 存在，不验证完整规则文本。

- 新增真实入口 E2E：`e2e/smashup/smashup-cease-and-desist-four-factions.e2e.ts`。
- 覆盖内容：
  - 派系选择页可见：宇宙武士、卑劣封臣、星际旅者、百变机兵。
  - 真实手牌入口代表链：宇宙武士的狂怒支配、卑劣封臣的有债必还、星际旅者的大规模传送、百变机兵的合体形态。
  - 真实运行中发现并修复通用点击阻塞：`src/index.css` 的 `.atlas-shimmer` 现在不再拦截指针事件。
  - 测试 helper 对选随从模式下的同列叠放卡牌使用上半部点击，避免相邻随从覆盖中心点。
- 已运行并通过：

```powershell
node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-cease-and-desist-four-factions.e2e.ts
```

结果：

- `2026-07-10`：`2 passed`，运行时间约 `39.0s`。
- `2026-07-11` 全量审计复跑：`2 passed`，运行时间 `34.6s`。

复跑命令：

```powershell
node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-cease-and-desist-four-factions.e2e.ts
```

复跑附带环境检查：编码检查通过；可疑告警仍来自既有非本批次文件 `apps/api/src/modules/admin/admin.service.ts`、`src/engine/transport/__tests__/server.test.ts`、`src/games/dicethrone/__tests__/cross-hero.test.ts`、`src/pages/TestMatchRoom.tsx`，不属于 Cease and Desist 本体。

代表截图由 Playwright 写入本次运行的 `test-results/playwright-artifacts/` 输出目录；测试内截图名包括：

- `cease-and-desist-faction-selection-visible`
- `cease-astroknights-yield-to-rage-after-power`
- `cease-ignobles-repaying-debts-after-control`
- `cease-star-roamers-mass-teleport-after-return`
- `cease-changerbots-form-mergacon-after-power`

### 资源链验证

- 已复制正式运行时资源：
  - `public/assets/smashup/cards/cease_and_desist.png`
  - `public/assets/smashup/base/cease_and_desist.png`
- 已生成本地压缩 WebP：
  - `public/assets/smashup/cards/compressed/cease_and_desist.webp`，`887,820 bytes`
  - `public/assets/smashup/base/compressed/cease_and_desist.webp`，`441,940 bytes`
- 已运行：

```powershell
npm run compress:images -- public/assets/smashup/cards
npm run compress:images -- public/assets/smashup/base
npm run assets:manifest:full
npm run assets:validate:full
```

- `public/assets/smashup/assets-manifest.json` 已包含：
  - `base/cease_and_desist`
  - `base/compressed/cease_and_desist`
  - `cards/cease_and_desist`
  - `cards/compressed/cease_and_desist`
- 已做 Cease and Desist 定向 manifest 校验：上述四个 `public/assets/smashup/assets-manifest.json.files` 资源键的本地文件均存在，`sha256` 与 `bytes` 均匹配 manifest。
- R2 上传预演通过：

```powershell
node scripts/assets/upload-to-r2.js --only public/assets/smashup/cards/compressed/cease_and_desist.webp public/assets/smashup/base/compressed/cease_and_desist.webp --selection-plan
```

- R2 实际上传仍阻塞：同一 `--only` WebP 上传返回 `401 UnknownError`。这是凭据/环境问题，不是本批次代码或资源路径问题。
- PNG 原图未上传是预期门禁：上传脚本只允许 compressed WebP/OGG 或 SVG。
- `npm run assets:validate:full` 当前仍失败，但失败点落在全局 `public/assets/i18n/assets-manifest.json` 的其他并行批次缺失/多余键，以及 3 个 Dice Throne status-icons json 的 hash/bytes 差异；Cease and Desist 的 Smash Up 资源键已通过定向校验。

### 全量审计快照（2026-07-11 追加）

| 范围 | 总数 | 当前已闭合 | 对象级补审状态 |
| --- | ---: | ---: | --- |
| 静态卡牌定义 | 55 | 55 | 0 |
| 静态基地定义 | 8 | 8 | 0 |
| 双语名称 key | 63 | 63 | 0 |
| 能力/持续/保护 L2 测试触达对象 | 55 张卡 + 8 个基地 + 2 个复用泰坦 | 全对象测试矩阵与 E2E 矩阵已命中 | 已由 2026-07-12 子句矩阵校准 |
| noOp 外壳但已有系统消费点 | 6 | 激光剑、防御力场、跋扈模块、铯装甲、隐蔽基地、鞭绳回旋已在框架消费合同中标注 | 已由完成矩阵记录实际消费点/测试 |

2026-07-12 回写后的残余：

- 规则文本：63 个卡/基地对象已补完整双语 `abilityText/effectText`，`localeNameOnly=0`。
- 原子子句矩阵：55 张卡、8 个基地、2 个复用泰坦已生成到 `evidence/smashup/2026-07-12-cease-and-desist-completion-matrix.md`。
- 铯装甲：Wiki/POD errata 明确为 `+2`，当前实现与 locale 使用 `+2`；旧图面 `+1` 判断降级为历史争议记录。
- 星际旅者持续/替代链：鞭绳回旋、舰船工程师、炮灰均已进入 runtime 注册/消费矩阵；当前无本地 runtime 零消费点。
- R2 远端仍按用户指示不作为当前 blocker，但不能标记远端资源验证完成。

### 当前完成口径（2026-07-12 回写）

- 资源链本地链路已完成；R2/CDN 上传与远端 URL 回查按用户明确指示排除，不标记完成，也不作为本地 blocker。
- 55 张卡、8 个基地、2 个复用泰坦的规则子句矩阵、完整技能流程矩阵、框架消费矩阵和批次状态矩阵已生成。
- E2E 已完成四派系选择页、代表能力真实入口，以及 65 对象 direct E2E 审计矩阵唯一覆盖。
- 审计证据以 `evidence/smashup/2026-07-12-cease-and-desist-full-object-audit.md` 与 `evidence/smashup/2026-07-12-cease-and-desist-completion-matrix.md` 为准。

## 当前门禁与下一步

1. 若后续用户重新要求 R2，则补有效 R2 凭据后上传 WebP、做代表 URL 回查。
2. 若后续需要从“本地完整”升级到“逐对象真实 UI 全链演示”，可继续把每个对象从 direct E2E 引用矩阵扩展成独立可视化交互用例。
3. 当前 canonical 英文文本冲突已在完成矩阵记录；铯装甲采用 Wiki/POD errata `+2`。
