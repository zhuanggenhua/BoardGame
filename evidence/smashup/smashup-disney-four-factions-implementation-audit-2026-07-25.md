# 大杀四方迪士尼四派系实施审计（本地 closeout + 资源版本差异）

## 2026-09-01 状态回写：冰雪奇缘本地玩法收口

- 当前状态：冰雪奇缘 `frozen` 的本地玩法对象级审计已由 `evidence/smashup/2026-09-01-frozen-closeout.md` 替代本文件 2026-08-19 的 `in_progress` 结论。
- 回写理由：新 closeout 已逐项覆盖 Frozen 15 张牌 + 2 个基地，补齐对象级行为断言、艾莎真实页面点击入口 E2E、截图核对、配置审查状态，并从 `src/games/smashup/domain/ids.ts` 的实施中列表移除 `frozen`。
- 范围边界：本次只取消 Frozen 的“实施中”；超能陆战队、狮子王、花木兰以及其它仍在 `SMASHUP_FACTION_IMPLEMENTATION_STATUS` 的派系没有因此自动完成重审。
- 旧历史保留：下面 2026-08-19 “冰雪奇缘实施中”段落是历史状态，不再代表当前 Frozen 本地玩法结论；服务器资源主源重新上传与公开 URL 回查仍属于单独范围，不能从 Frozen 本地 closeout 外推。

## 2026-08-19 状态回写：冰雪奇缘实施中

- 当前状态：`实施中` / `旧结论失效` / `仍有残余范围`。
- 回写理由：后续本地反馈已直接推翻“冰雪奇缘 passed / 本地玩法 closeout 无 blocker”的旧口径；当前 `disney-four-factions.test.ts` 只补到冰宫、冻结的港口、安娜、阿伦黛尔、棉花糖、真爱的行为等局部链路，不能证明冰雪全 15 张卡 + 2 个基地都完成对象级审计。
- 当前 UI 状态：`src/games/smashup/domain/ids.ts` 已将 `frozen` 标记为 `in_progress`，表示派系选择页应显示“实施中”，且默认自动选派 / 默认参与池不应把它当作已完成派系。
- 冰雪仍缺对象级验证的已知对象：`frozen_olaf`、`frozen_sven`、`frozen_elsa`、`frozen_big_summer_blowout`、`frozen_do_you_want_to_build_a_snowman`、`frozen_hans_westergaard`、`frozen_let_it_go`、`frozen_lock_the_gates`、`frozen_reindeers_are_better_than_people`。
- 未自动外推：超能陆战队、狮子王、花木兰目前只标记为旧四派系 closeout 口径存在代表链风险；本次没有逐对象重审三者，因此不在 UI 状态中盲降级。

### 失效原因、替代证据与同类扩审范围

- 旧结论：第 24-25 行曾把冰雪奇缘写成机制、审计、E2E 全部 `passed`；第 152 行曾写“本地玩法 closeout：passed”。
- 失效原因：用户本地反馈连续命中冰雪对象，证明旧“冰雪整派系 passed”至少把代表链证据外推到了未逐对象验证的卡牌和基地。
- 替代证据 / 新增回归：当前替代入口是 `src/games/smashup/domain/ids.ts` 的 `SMASHUP_FACTION_IMPLEMENTATION_STATUS[frozen]='in_progress'`，新增回归集中在 `src/games/smashup/__tests__/abilities/disney-four-factions.test.ts` 的冰雪局部用例；这些测试覆盖最终状态断言，例如手牌打出、有效力量、保护判断、VP 奖励和 `sys.interaction.current` 清空边界，但只证明对应对象，不替代全对象审计。
- 旧测试失效检查 / 测试语义对账：旧测试可以继续作为“代表性局部证据”，但不能再作为“冰雪全对象 passed”的证据；当前失效点不是测试全错，而是测试断言过窄、证据停在代表对象和局部最终状态，没有覆盖冰雪所有对象的规则子句、选择/可选分支、抽弃牌、移动限制和真实入口。
- 同类扩审记录：本轮横向搜索范围限定在 Disney 四派系旧 closeout、`frozen.ts` 对象全集、`disney-four-factions.test.ts` 和 `disneyFourFactionsIntake.test.ts`；命中项是冰雪 17 个对象中至少 9 个缺对象级验证。残余扩审范围是先补冰雪全对象 L2 / 必要 L3-L4，再决定是否扩到超能陆战队、狮子王、花木兰；未完成前不能宣称 Disney 四派系全面审计完成。

## 全面审计自检表

| 项目 | 状态 | 证据 / 说明 |
| --- | --- | --- |
| 对象全集 | `passed` | 已接入 4 个派系：超能陆战队、冰雪奇缘、狮子王、花木兰；每派系 15 张卡，合计 60 张卡；每派系 2 个基地，合计 8 个基地。 |
| L0/L1 静态接入 | `passed` | faction id、atlas、card/base data、locale、faction metadata、critical image preload、game/root manifest 均已接入。 |
| 规则子句表 | `representative_only` | intake 产物、静态数据与 abilityTags 覆盖 60 张卡 + 8 个基地，但本文没有按当前审计模板逐对象列出完整规则子句 / 原子语义 / 消费点 / 最终权威结果。 |
| 完整技能流程矩阵 | `representative_only` | L2 行为测试覆盖注册、真实出牌管线、力量指示物、抽牌、保护、持续修正、基地触发等代表链；冰雪至少 9 个对象没有对象级验证，不能再写完整 passed。 |
| L2 行为验证 | `representative_only` | `disney-four-factions.test.ts` 覆盖四派系能力入口和部分核心玩法链；冰雪反馈后新增局部回归，但仍不是冰雪全对象审计。 |
| L3/L4 真实入口 | `representative_only` | 已覆盖超能陆战队“升级”真实打牌入口；冰雪没有逐对象真实入口链，不能外推为冰雪全派系 L3/L4 passed。 |
| 框架消费合同矩阵 | `passed` | 覆盖 simple choice、额外出牌额度、力量指示物、保护/限制、持续修正、基地触发、真实出牌管线。 |
| L4 共享链判等矩阵 | `representative_only` | 本批次未引入独立新 UI 壳，但本文没有证明冰雪剩余对象与代表链“仅配置不同”。 |
| 旧 evidence / 旧结论对账 | `passed` | 2026-08-19 已原地回写：旧“冰雪奇缘 passed / 本地玩法 closeout”口径失效，当前冰雪标记实施中。 |
| 真实入口截图核验 | `passed` | 已人工核图：微型机器群显示 `+2`，手牌只剩迷你雪人，右侧弃牌堆显示升级，prompt 已关闭。 |
| 服务器资源主源 | `blocked_resource_sync` | 2026-08-06 公开 URL 可访问，但返回字节数仍是 PR 旧资源，和主线 #122 当前本地资源不一致。 |
| 残余范围声明 | `scoped_debt` | 冰雪对象级审计仍有残余范围；旧“本地玩法 closeout 无未解除 blocker”失效。资源发布同步仍需用主线当前资源重新上传并按字节数/哈希回查。 |

## 批次矩阵

| 对象 | 数据录入 | 本地资源链 | 机制实现 | 审计 | E2E | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 超能陆战队 | `passed` | `blocked_remote_old_resource` | `passed` | `passed` | `passed` | `blocked_resource_sync` |
| 冰雪奇缘 | `passed` | `blocked_remote_old_resource` | `scoped_debt` | `scoped_debt` | `representative_only` | `in_progress` |
| 狮子王 | `passed` | `blocked_remote_old_resource` | `passed` | `passed` | `passed` | `blocked_resource_sync` |
| 花木兰 | `passed` | `blocked_remote_old_resource` | `passed` | `passed` | `passed` | `blocked_resource_sync` |

## 范围与工作区

- OpenSpec change：`openspec/changes/add-smashup-disney-four-factions/`
- Worktree：`D:/GA/BoardGame-smashup-disney-four-factions-clean-20260725`
- 分支：`codex/smashup-disney-four-factions-clean-20260725`
- 本轮对象：超能陆战队、冰雪奇缘、狮子王、花木兰。
- 实际 push / PR：本轮 PR 合并流程执行；资源服务器发布同步仍是独立后续动作。

## 主真相源与 intake 结果

| 字段 | 值 |
| --- | --- |
| 原图路径 | `C:/Users/Dqm/.codex/attachments/11666c73-73f5-40e1-ad6c-9d72601bd77c/image-1.png` |
| 文件大小 | `41,387,810 bytes` |
| 尺寸 | `4888 x 4096` |
| SHA-256 | `4e28237e91b60a3a4faa48aa57b6c0404574cdd372017fa5104781219e1216b0` |
| 用途 | 中文卡图、中文名称、中文规则文本、row-major 顺序、四派系范围识别 |

| 产物 | 路径 | 状态 |
| --- | --- | --- |
| 轻量总览 | `temp/smashup-disney-four-factions-intake/overview-2200w.png` | `passed` |
| 单卡裁图 | `temp/smashup-disney-four-factions-intake/cards/slot-00-r1c1.png` 至 `slot-59-r6c10.png` | `passed` |
| 元数据 JSON | `temp/smashup-disney-four-factions-intake/source-and-grid-feasibility.json` | `passed` |

## 静态与资源接入

| 项目 | 文件 / 路径 | 状态 |
| --- | --- | --- |
| 派系 ID | `src/games/smashup/domain/ids.ts` | `passed` |
| card/base atlas | `src/games/smashup/domain/atlasCatalog.ts` | `passed` |
| faction data | `src/games/smashup/data/factions/big_hero_6.ts`, `frozen.ts`, `lion_king.ts`, `mulan.ts` | `passed` |
| registry imports | `src/games/smashup/data/cards.ts` | `passed` |
| gameplay handlers | `src/games/smashup/abilities/disney_four_factions.ts`, `abilities/index.ts` | `passed` |
| ongoing modifiers | `src/games/smashup/domain/ongoingModifiers.ts` | `passed` |
| faction metadata | `src/games/smashup/ui/factionMeta.ts` | `passed` |
| locale | `public/locales/zh-CN/game-smashup.json`, `public/locales/en/game-smashup.json` | `passed` |
| critical preload | `src/games/smashup/__tests__/criticalImageResolver.test.ts` | `passed` |
| game/root manifest | `public/assets/i18n/zh-CN/smashup/assets-manifest.json`, `public/assets/i18n/assets-manifest.json` | `passed_local` |

### 本地正式资源

| 资源 | 源尺寸 | 压缩尺寸 | 状态 |
| --- | --- | --- | --- |
| `public/assets/i18n/zh-CN/smashup/cards/disney_four_factions.png` | `4888 x 4096` | - | `passed` |
| `public/assets/i18n/zh-CN/smashup/cards/compressed/disney_four_factions.webp` | - | `4888 x 4096` | `passed: not downsampled` |
| `public/assets/i18n/zh-CN/smashup/base/disney_four_faction_bases.webp` | `3840 x 2160` | - | `passed` |
| `public/assets/i18n/zh-CN/smashup/base/compressed/disney_four_faction_bases.webp` | - | `3840 x 2160` | `passed: not downsampled` |

## L2 / L3 代表性玩法证据

### L2 行为测试

文件：`src/games/smashup/__tests__/abilities/disney-four-factions.test.ts`

已覆盖：

- 四派系代表性主动能力入口已注册。
- 超能陆战队：微型机器群、新来的学生、升级、团队的努力按指示物 / 额外出牌结算。
- 超能陆战队：升级从真实出牌管线打开选择后，离开手牌并进入弃牌堆。
- 冰雪奇缘：旧证据只覆盖棉花糖只压制同基地敌方角色、真爱的行为先抽牌再给所选角色临时保护；2026-08-19 追加覆盖冻结的港口、冰宫、安娜、阿伦黛尔，但仍不是全对象审计。
- 狮子王：木法沙在弃牌堆时触发弃牌条件，并让荣耀石给玩家额外力量。
- 狮子王：刀疤按目标所在基地计算有效力量，跨基地持续修正不会漏算。
- 花木兰：集体训练给己方全场角色放指示物，金宝保护己方角色不受敌方影响。

### L3/L4 真实入口 E2E

文件：`e2e/smashup/smashup-disney-four-factions.e2e.ts`

用例：`超能陆战队升级应从真实打牌入口打开 Disney 选择并给角色放力量标记`

截图：

`D:/GA/BoardGame-smashup-disney-four-factions-clean-20260725/test-results/evidence-screenshots/smashup/smashup-disney-four-factions.e2e/超能陆战队升级应从真实打牌入口打开-Disney-选择并给角色放力量标记/disney-upgrades-resolved.jpg`

人工观察：

- 微型机器群可见，并显示 `+2` 力量指示物。
- 手牌中可见迷你雪人，说明机器人实验室的“放置指示物后抽牌”副作用已触发。
- 右侧弃牌堆可见升级，说明升级从真实手牌出牌入口结算后进入弃牌堆。
- Disney 选择 prompt 已关闭，行动额外出牌提示仍可见，链路已回到可继续操作状态。

## 已运行验证

| 命令 | 结果 |
| --- | --- |
| `openspec validate add-smashup-disney-four-factions --strict --no-interactive` | `passed` |
| `npx vitest run src/games/smashup/__tests__/abilities/disney-four-factions.test.ts src/games/smashup/__tests__/disneyFourFactionsIntake.test.ts src/games/smashup/__tests__/criticalImageResolver.test.ts --reporter=dot` | `passed: 3 files / 34 tests` |
| `npm run typecheck -- --pretty false` | `passed` |
| `npm run i18n:check` | `passed` |
| `node scripts/assets/generate_asset_manifests.js --validate --root public/assets/i18n/zh-CN --id smashup` | `passed` |
| `npm run assets:validate` | `blocked`: 既有 Dice Throne atlas/i18n manifest 漂移，不属于本 PR |
| `npx eslint <touched TS/E2E files>` | `passed: 0 errors` |
| `npm run test:e2e:ci:file -- e2e/smashup/smashup-disney-four-factions.e2e.ts` | `passed` |
| `npm run test:e2e:ci:file -- e2e/smashup/smashup-disney-four-factions-baymax-frozen-lion-mulan.e2e.ts` | `passed: 1 test` |

## 资源主源发布状态

### 精确预检

命令：

```powershell
node scripts/assets/upload-to-server.js --check --asset-prefix i18n/zh-CN/smashup/cards/compressed/disney_four_factions --asset-prefix i18n/zh-CN/smashup/base/compressed/disney_four_faction_bases
```

结果：`passed`，只命中 2 个对象：

- `official/i18n/zh-CN/smashup/base/compressed/disney_four_faction_bases.webp`，`1261136 bytes`，`md5=7ac1390a0dbf7d15ba9a2615ae24bbaa`
- `official/i18n/zh-CN/smashup/cards/compressed/disney_four_factions.webp`，`8103102 bytes`，`md5=1c9bf55534a3e6a7bcbf13c2320df038`

### 实际上传 / 公开 URL 回查

历史实际上传曾在本地 SSH 环境中超时；2026-08-06 回查确认公开资源域名可访问，但它们返回的是 PR 旧资源版本，不是主线 #122 当前本地资源版本。

### 公开 URL 回查

| URL | HEAD 状态 |
| --- | --- |
| `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/disney_four_factions.webp` | `200 OK`，远端 8,103,102 bytes；本地 8,103,050 bytes |
| `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/base/compressed/disney_four_faction_bases.webp` | `200 OK`，远端 1,261,136 bytes；本地 2,646,702 bytes |

## Push / PR handoff 口径

- 本地玩法 closeout：冰雪奇缘已降级为实施中；旧 `passed` 只保留为历史代表链证据。
- 资源服务器同步：blocked_resource_sync，需要重新发布主线当前资源。
- 建议提交信息：

```text
完成大杀四方迪士尼四派系本地闭环

- 收口超能陆战队、冰雪奇缘、狮子王、花木兰玩法实现与注册
- 补齐 Disney 图集、locale、critical image、manifest，并记录远端资源版本差异
- 通过 Vitest、ESLint、typecheck、i18n、assets、OpenSpec 与真实入口 E2E
```
