# Smash Up 企鹅派系玩法收口证据（2026-08-06）

## 全面审计自检表

| 检查项 | 状态 | 当前证据 / 说明 |
| --- | --- | --- |
| 对象全集 | passed | 15 个唯一卡面、20 张实体牌、2 张基地已在 `src/games/smashup/data/factions/penguins.ts` 注册；派系封面格未注册成手牌。 |
| 规则子句表 | passed | 本文件按对象列出时机、主效果、分支/否定与证据；玩法层无已知未实现子句。 |
| 完整技能流程矩阵 | passed | 逐对象列出 L0/L1/L2/L3-L4 证据；复杂链路在 24 条 L2 与 7 条真实入口 E2E 中收口。 |
| L0/L1/L2/L3/L4 证据层级 | passed | L0/L1 静态与资源、L2 行为测试、L3/L4 真实入口截图链均已覆盖当前普通企鹅玩法发布口径。 |
| 命中 D 维度 | passed | 覆盖牌库顶打出/展示/放回、额外随从、基地移动、计分后、持续/天赋、可选跳过、资源 manifest 与旧结论回写。 |
| 框架消费合同矩阵 | penguin-passed / baseline-failed | 普通企鹅复用牌库顶打出、simple choice、afterScoring/base ability；反刍企鹅 generic source 已登记保留理由。完整 `interactionTargetTypeAudit` 当前仍因非企鹅基线项失败。 |
| L4 共享链判等矩阵 | passed | 同类牌库顶打出与计分后链路在代表真实入口中验证；每个对象仍有独立 L2 权威状态断言。 |
| 旧 evidence/旧结论对账回写 | passed | `SMASHUP-CARD-COUNT-AUDIT.md` 已从“未实现”回写为当前普通企鹅已接入/已验证口径。 |
| 真实入口 E2E 与截图核验 | passed | `e2e/smashup/smashup-penguins-playable.e2e.ts` 7 passed；17 张截图留存。 |
| 资源本地链路 | passed | 原图、compressed WebP、游戏级 manifest、根级 manifest 均含企鹅 card/base 键。 |
| 资源服务器主源发布 | scoped-debt | 2026-08-06 用户明确收窄当前 PR 为玩法实现；企鹅图面素材已在本地资源链中存在，远端素材主源上传不作为本 PR 门禁。 |
| 残余范围声明 | passed | 当前 PR 无已知玩法残余；远端素材主源上传按用户口径登记为范围外 scoped-debt。 |

## 当前结论

- 普通企鹅不是“未制作/未实装”。当前工作区已存在普通企鹅静态数据、能力实现、交互 handler、能力测试、集成测试和 7 条真实入口 E2E。
- 玩法实现口径：**passed**。当前普通企鹅 15 张唯一卡面、20 张实体牌、2 张基地的核心规则子句均已有 L2 权威状态验证；主要复杂链路已有 L3/L4 真实入口截图证据。
- 交付口径：**passed（玩法 PR）**。企鹅本地资源和 manifest 已接入；服务器素材主源发布经用户确认不属于本 PR 范围；全局资源校验当前因 DiceThrone atlas 基线不一致失败，不属于普通企鹅玩法范围。
- 企鹅帝皇是历史已存在泰坦，本 closeout 只验证普通企鹅可关联既有 `penguins_emperor_penguin`，不把泰坦重新包装成本轮新增成果。

## 权威来源与 intake 证据

| 来源 | 状态 | 用途 |
| --- | --- | --- |
| `openspec/changes/add-smashup-penguins-faction/proposal.md` | passed | 记录卡牌 atlas、基地 atlas、Workshop JSON 路径、尺寸、hash、row-major 与实体数量合同。 |
| `temp/smashup-penguins-intake/cut-index.json` | passed | 卡牌/基地切图索引与 row-major 录入中间证据。 |
| `temp/smashup-penguins-intake/card-metadata.json` | passed | 企鹅唯一卡面、实体数量、中文/英文名与字段录入核对。 |
| `temp/smashup-penguins-intake/base-metadata.json` | passed | 企鹅基地槽位、断点、VP 与正文录入核对。 |
| `temp/atlas-intake-20260801/penguins-crops/*.webp` | passed | 单卡/单基地裁图证据；第 16 格派系封面不注册成运行时手牌。 |

## 批次矩阵

| 范围 | 数据录入 | 资源链 | 机制实现 | 审计 | E2E | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 普通企鹅卡牌 15 unique / 20 physical | passed | passed | passed | passed | passed | passed |
| 企鹅基地：浮冰、企鹅殖民地 | passed | passed | passed | passed | passed | passed |
| 企鹅帝皇关联 | passed | 不适用 | passed | passed | passed | passed |
| 服务器素材主源 | passed | scoped-debt: 当前 PR 范围外 | 不适用 | passed | 不适用 | scoped-debt |

## 已验证命令

| 命令 | 结果 |
| --- | --- |
| `npm run i18n:check` | passed：`i18n-check: no missing keys detected.` |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/penguins.test.ts --configLoader native` | passed：24 tests |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/penguinsIntegration.test.ts --configLoader native` | passed：4 tests |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts --config vitest.config.audit.ts --configLoader native` | failed：5/8 非企鹅基线失败；普通企鹅 `penguins_regurgitating_penguin` / `_order` 已补登记，失败清单不再包含企鹅 sourceId。 |
| `npx tsc --noEmit --pretty false` | passed：exit 0 |
| `npx openspec validate add-smashup-penguins-faction --strict --no-interactive` | passed：change valid |
| `npm run assets:validate` | failed：非企鹅 DiceThrone `ability-cards-gunslinger.atlas.json` / `ability-cards-tianshi.atlas.json` hash/bytes 基线不一致。 |
| `PW_E2E_SERVICE_REUSE=isolated node scripts/infra/run-e2e-command.mjs isolated e2e/smashup/smashup-penguins-playable.e2e.ts` | passed：7 tests |
| E2E defId 预检 | passed：E2E 内 `base_ice_floe`、`base_the_colony`、企鹅卡牌/泰坦、`robot_microbot_alpha` 均能在数据/locale 中找到。 |
| `node scripts/assets/upload-to-server.js --check --asset-prefix i18n/zh-CN/smashup/cards/compressed/penguins` | 历史探针：发现远端待发布 `official/i18n/zh-CN/smashup/cards/compressed/penguins.webp`，md5 `1f5b8980fd64017b008ee96276fe21f9`；当前 PR 不要求上传。 |
| `node scripts/assets/upload-to-server.js --check --asset-prefix i18n/zh-CN/smashup/base/compressed/penguins` | 历史探针：发现远端待发布 `official/i18n/zh-CN/smashup/base/compressed/penguins.webp`，md5 `c2ad8a5ed2bd9921b3bcd7932cb75126`；当前 PR 不要求上传。 |
| `ssh -o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=20 -o ServerAliveCountMax=1 -o StrictHostKeyChecking=yes admin@8.148.71.102 true` | 历史探针：`Permission denied (publickey,gssapi-keyex,gssapi-with-mic).`；已按用户口径排除出当前玩法 PR 门禁。 |

## 资源链证据

| 资源 | 本地状态 | manifest 状态 | 远端状态 |
| --- | --- | --- | --- |
| `public/assets/i18n/zh-CN/smashup/cards/penguins.png` | passed | 根级与游戏级 manifest 含 `cards/penguins` | 不需要作为 compressed runtime 主源发布对象 |
| `public/assets/i18n/zh-CN/smashup/cards/compressed/penguins.webp` | passed | 根级与游戏级 manifest 含 `cards/compressed/penguins` | scoped-debt：当前玩法 PR 范围外 |
| `public/assets/i18n/zh-CN/smashup/base/penguins.png` | passed | 根级与游戏级 manifest 含 `base/penguins` | 不需要作为 compressed runtime 主源发布对象 |
| `public/assets/i18n/zh-CN/smashup/base/compressed/penguins.webp` | passed | 根级与游戏级 manifest 含 `base/compressed/penguins` | scoped-debt：当前玩法 PR 范围外 |

## 真实入口 E2E 覆盖

| E2E 场景 | 覆盖对象 | L4 观察 |
| --- | --- | --- |
| 冲浪企鹅、破壳而出与企鹅宝宝可经真实入口连续结算 | 冲浪企鹅、破壳而出、企鹅宝宝、乔装企鹅 | 真实打出入口进入，多段 prompt 结算后 `interaction.current` 清空，场上/手牌/牌库状态落回权威状态。 |
| 企鹅司令、时髦企鹅与水晶礼品可在真实牌库顶打出链中抽牌收口 | 企鹅司令、时髦企鹅、水晶礼品 | 牌库顶额外打出与牌库顶来源 provenance 生效，抽牌后状态收口。 |
| 秘密任务真实入口会置底多张手牌、抽等量牌并清空交互 | 秘密任务 | 多选手牌置底、等量抽牌、剩余牌库重洗后 `interaction.current` 清空。 |
| 在冰下、乔装企鹅与渴望飞翔的工作可经真实入口结算到权威状态 | 在冰下、乔装企鹅、渴望飞翔的工作、企鹅帝皇关联 | 展示/随机打出、天赋置底、企鹅帝皇进场或替代 +1 分支在真实入口中收口。 |
| 反刍企鹅真实打出后可选择展示行动并排序剩余牌库顶 | 反刍企鹅、破壳而出 | 展示牌选择、拿行动入手、剩余牌按玩家选择顺序回到牌库顶。 |
| 浮冰真实基地能力会选择己方随从置底并打出牌库顶随从 | 浮冰 | 主动基地能力从真实基地入口进入，置底随从、打出牌库顶随从、后续交互清空。 |
| 跳上船与冰滑道会在真实计分后结算到替换基地并抽牌 | 跳上船、冰滑道 | 计分后 triggerQueue / interaction 收口，替换基地打出预约随从，冰滑道抽牌不误抽跳上船预约牌。 |

## E2E 截图

- `D:\GA\BoardGame-upstream-main-dev-20260731\test-results\evidence-screenshots\smashup\smashup-penguins-playable.e2e\冲浪企鹅、破壳而出与企鹅宝宝可经真实入口连续结算\企鹅冲浪企鹅选择移动伙伴.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260731\test-results\evidence-screenshots\smashup\smashup-penguins-playable.e2e\冲浪企鹅、破壳而出与企鹅宝宝可经真实入口连续结算\企鹅破壳而出触发企鹅宝宝额外打出.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260731\test-results\evidence-screenshots\smashup\smashup-penguins-playable.e2e\冲浪企鹅、破壳而出与企鹅宝宝可经真实入口连续结算\企鹅冲浪破壳宝宝真实入口收口状态.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260731\test-results\evidence-screenshots\smashup\smashup-penguins-playable.e2e\企鹅司令、时髦企鹅与水晶礼品可在真实牌库顶打出链中抽牌收口\企鹅司令水晶礼品牌库顶链就绪.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260731\test-results\evidence-screenshots\smashup\smashup-penguins-playable.e2e\企鹅司令、时髦企鹅与水晶礼品可在真实牌库顶打出链中抽牌收口\企鹅司令时髦水晶礼品收口状态.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260731\test-results\evidence-screenshots\smashup\smashup-penguins-playable.e2e\秘密任务真实入口会置底多张手牌、抽等量牌并清空交互\企鹅秘密任务多选手牌置底.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260731\test-results\evidence-screenshots\smashup\smashup-penguins-playable.e2e\秘密任务真实入口会置底多张手牌、抽等量牌并清空交互\企鹅秘密任务结算后状态清空.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260731\test-results\evidence-screenshots\smashup\smashup-penguins-playable.e2e\在冰下、乔装企鹅与渴望飞翔的工作可经真实入口结算到权威状态\企鹅在冰下乔装渴望链就绪.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260731\test-results\evidence-screenshots\smashup\smashup-penguins-playable.e2e\在冰下、乔装企鹅与渴望飞翔的工作可经真实入口结算到权威状态\企鹅渴望飞翔选择企鹅帝皇.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260731\test-results\evidence-screenshots\smashup\smashup-penguins-playable.e2e\在冰下、乔装企鹅与渴望飞翔的工作可经真实入口结算到权威状态\企鹅在冰下乔装渴望收口状态.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260731\test-results\evidence-screenshots\smashup\smashup-penguins-playable.e2e\反刍企鹅真实打出后可选择展示行动并排序剩余牌库顶\企鹅反刍企鹅展示行动选择.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260731\test-results\evidence-screenshots\smashup\smashup-penguins-playable.e2e\反刍企鹅真实打出后可选择展示行动并排序剩余牌库顶\企鹅反刍企鹅剩余牌排序.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260731\test-results\evidence-screenshots\smashup\smashup-penguins-playable.e2e\反刍企鹅真实打出后可选择展示行动并排序剩余牌库顶\企鹅反刍企鹅结算后状态清空.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260731\test-results\evidence-screenshots\smashup\smashup-penguins-playable.e2e\浮冰真实基地能力会选择己方随从置底并打出牌库顶随从\企鹅浮冰选择置底随从.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260731\test-results\evidence-screenshots\smashup\smashup-penguins-playable.e2e\浮冰真实基地能力会选择己方随从置底并打出牌库顶随从\企鹅浮冰结算后状态清空.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260731\test-results\evidence-screenshots\smashup\smashup-penguins-playable.e2e\跳上船与冰滑道会在真实计分后结算到替换基地并抽牌\企鹅计分前跳上船与冰滑道就绪.jpg`
- `D:\GA\BoardGame-upstream-main-dev-20260731\test-results\evidence-screenshots\smashup\smashup-penguins-playable.e2e\跳上船与冰滑道会在真实计分后结算到替换基地并抽牌\企鹅计分后跳上船冰滑道收口状态.jpg`

## 对象级机制矩阵

| 对象 | 规则子句 / effect atom | L0/L1 | L2 | L3/L4 | 状态 |
| --- | --- | --- | --- | --- | --- |
| 冲浪企鹅 | 打出时可移动这里一个己方伙伴到另一个基地；有合法候选时可跳过 | passed | `冲浪企鹅可移动这里的己方伙伴到另一个合法基地，并支持跳过敌方目标` | 真实入口链“冲浪企鹅、破壳而出与企鹅宝宝” | passed |
| 跳舞企鹅 | 作为特殊/替代入口打出，替代另一个手牌伙伴并把原伙伴置底 | passed | `跳舞企鹅会替代其他手牌伙伴打出，并把原伙伴放到牌库底` | 共享手牌替代打出链，L2 已验证最终权威状态 | passed |
| 时髦企鹅 | 只有从牌库顶打出时抽两张 | passed | `时髦企鹅只有从牌库顶打出时才抽两张牌` | 真实入口链“企鹅司令、时髦企鹅与水晶礼品” | passed |
| 企鹅司令 | 展示/处理牌库顶并额外打出伙伴，不消耗普通随从额度 | passed | `企鹅司令会从牌库顶额外打出伙伴且不消耗普通出牌额度` | 真实入口链“企鹅司令、时髦企鹅与水晶礼品” | passed |
| 乔装企鹅 | 天赋：将自身置底并从牌库顶额外打出伙伴到原基地 | passed | `乔装企鹅天赋会将自身置底并从牌库顶额外打出伙伴到原基地` | 真实入口链“在冰下、乔装企鹅与渴望飞翔的工作” | passed |
| 秘密任务 | 任意数量手牌置底，抽等量，重洗剩余牌库；多选后清理 prompt | passed | `秘密任务会把选中手牌置底、抽等量牌并重洗剩余牌库` | 真实入口链“秘密任务真实入口会置底多张手牌” | passed |
| 破壳而出 | 从牌库顶额外打出伙伴，不消耗普通随从额度 | passed | `破壳而出会从牌库顶额外打出伙伴且不消耗普通出牌额度` | 真实入口链“冲浪企鹅、破壳而出与企鹅宝宝”；反刍企鹅链也触达 | passed |
| 反刍企鹅 | 展示牌库顶若干牌，可拿展示行动入手，并按玩家选择顺序放回剩余牌库顶 | passed | `反刍企鹅可拿走展示行动并按玩家顺序放回剩余牌库顶` | 真实入口链“反刍企鹅真实打出后可选择展示行动并排序剩余牌库顶” | passed |
| 企鹅宝宝 | 从牌库顶打出时可额外打出手牌中力量 3 或更少伙伴；可跳过 | passed | `企鹅宝宝从牌库顶打出时可额外打出手牌中力量 3 或更少的伙伴`、浮冰/企鹅殖民地递归触发测试 | 真实入口链“冲浪企鹅、破壳而出与企鹅宝宝” | passed |
| 渴望飞翔的工作 | 可选择打出企鹅帝皇；否则给目标基地己方伙伴本回合 +1 | passed | `渴望飞翔的工作可选择打出企鹅帝皇到目标基地`、`没有可打出企鹅帝皇时会给目标基地己方伙伴本回合 +1` | 真实入口链“在冰下、乔装企鹅与渴望飞翔的工作” | passed |
| 跳上船 | 计分后将牌库顶伙伴预约打到替换基地，不被同窗口冰滑道误抽 | passed | `跳上船会把牌库顶伙伴预约到计分后的替换基地`、`跳上船预约的牌库顶伙伴不会被同一计分窗口的冰滑道抽走` | 真实入口链“跳上船与冰滑道会在真实计分后结算到替换基地并抽牌” | passed |
| 我不能区分他们 | 洗回选中伙伴并额外打出同数量牌库顶伙伴 | passed | `我不能区分他们会洗回选中伙伴并额外打出同数量牌库顶伙伴` | 共享 simple-choice + 牌库顶额外打出链，L2 已验证最终权威状态 | passed |
| 水晶礼品 | 控制者从牌库顶把伙伴打到本基地后抽一张 | passed | `水晶礼品会在控制者从牌库顶把伙伴打到这里后抽一张牌` | 真实入口链“企鹅司令、时髦企鹅与水晶礼品” | passed |
| 在冰下 | 展示牌随机打出其中一个伙伴，剩余展示牌放到牌库底 | passed | `在冰下会随机打出展示牌中的一个伙伴，并把剩余展示牌放到牌库底` | 真实入口链“在冰下、乔装企鹅与渴望飞翔的工作” | passed |
| 冰滑道 | 计分后为从这里进入弃牌堆的己方伙伴抽牌 | passed | `冰滑道会在计分后为从这里进入弃牌堆的己方伙伴抽牌`、同窗口保护测试 | 真实入口链“跳上船与冰滑道会在真实计分后结算到替换基地并抽牌” | passed |
| 浮冰 | 主动基地能力：将这里己方伙伴置底，并从牌库顶打出伙伴到这里；打出的伙伴继续触发 onPlay | passed | `浮冰主动基地能力会置底这里的己方伙伴并从牌库顶打出伙伴到这里`、`浮冰从牌库顶打出的企鹅宝宝会继续打开宝宝手牌额外打出交互` | 真实入口链“浮冰真实基地能力会选择己方随从置底并打出牌库顶随从” | passed |
| 企鹅殖民地 | 本回合第一次打出伙伴到这里后额外打出牌库顶伙伴；打出的伙伴继续触发自身 onPlay | passed | `企鹅殖民地会在本回合第一次打出伙伴到这里后额外打出牌库顶伙伴`、`额外打出的企鹅宝宝会继续打开宝宝的手牌额外打出交互`、`额外打出的时髦企鹅会继续结算从牌库顶打出后的抽两张` | 与浮冰共享 `buildPlayTopDeckMinionResult` 正向递归触发链；L2 覆盖高风险 onPlay 递归 | passed |

## 框架消费合同矩阵

| 合同 | 消费点 | 企鹅对象 | 证据 |
| --- | --- | --- | --- |
| 牌库顶伙伴打出并保留 provenance | `buildPlayTopDeckMinionResult` / `playMinionEventFromCard` | 企鹅司令、破壳而出、乔装企鹅、企鹅宝宝、在冰下、浮冰、企鹅殖民地 | 24 条能力测试；7 条 E2E 中多条证明从牌库顶打出后继续触发自身 `onPlay`。 |
| simple-choice 交互 | `createSimpleChoice` + 企鹅 interaction handlers | 冲浪企鹅、秘密任务、反刍企鹅、企鹅宝宝、渴望飞翔的工作、我不能区分他们、浮冰 | `i18n:check` 清零；真实入口截图含 prompt 出现、选择、收口。 |
| afterScoring 触发 | `registerTrigger(..., 'afterScoring')` | 跳上船、冰滑道 | 计分后 E2E 验证 triggerQueue / interaction 清空与最终权威状态。 |
| base ability / onMinionPlayed | `registerBaseAbility` | 浮冰、企鹅殖民地 | 浮冰真实入口 E2E；企鹅殖民地 L2 正向与递归触发覆盖。 |
| generic targetType 审计 | `interactionTargetTypeAudit.test.ts` | 企鹅新增/复用 generic source | 反刍企鹅两个 generic source 已登记保留理由；完整审计仍因非企鹅基线项失败。 |

## 旧结论回写

- 旧 `SMASHUP-CARD-COUNT-AUDIT.md` 中“企鹅未实现”结论已经失效。
- 当前应读为：普通企鹅已接入，玩法实现和本地验证 passed；服务器素材主源发布不属于当前玩法 PR 范围。

## 残余范围

- 玩法实现残余：无已知未实现玩法子句。
- 本地玩法验证残余：无；当前定向能力测试、集成测试、i18n、typecheck、OpenSpec 和普通企鹅 E2E 均已通过。全局 `interactionTargetTypeAudit` 与 `assets:validate` 仍存在非企鹅基线失败，已在验证命令表中列明。
- 远端资源残余：scoped-debt。当前 PR 不上传远端素材；若后续发布环境要求远端素材主源，再使用可用 SSH key / agent / 服务器授权执行窄范围上传并做代表 URL `HEAD 200` 回查。
