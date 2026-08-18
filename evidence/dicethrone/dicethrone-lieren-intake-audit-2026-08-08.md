# DiceThrone 女猎手素材录入审计

## 当前目标

- 当前工作目录：`D:\gongzuo\webgame\BoardGame`
- 当前分支：`main`
- 当前对象：女猎手（`lieren` / Huntress）素材录入与后续运行时实现准备
- 当前阶段：S0/S1 `passed`；静态运行时接入、女猎手规则矩阵、妮拉运行时面板、伤害响应 / 羁绊分配和真实双玩家入口 E2E `passed`；服务器素材主源上传与公开 URL HEAD `passed`；2026-08-17 已补对象级审计留档
- 原始目标不是提交或上传；本文件记录资源、规则、清单和阻塞边界。

## 已执行

- 保留用户提供的源 PNG/JSON。
- 使用项目压缩入口生成 6 个必要的 `compressed/*.webp`，未降采样。
- 生成女猎手卡牌 5x7 atlas 配置，真实槽位 0-32；33/34 不录入。
- 生成玩家板和提示卡临时裁图，均保留在 `temp/dicethrone-intake/lieren/`。
- 记录女猎手玩家板技能、流血、妮拉之系、妮拉承伤和卡牌槽位规则。
- 明确 `tip.png` 只作规则真相源，不生成或上传 `compressed/tip.webp`。
- 注册 `lieren` 角色、骰面、九个角色板技能槽、起始牌库、卡牌 atlas、状态 atlas、除提示卡外的 critical image 预加载和中英文 i18n。
- 接入流血 upkeep 结算、女猎手攻击/卡牌分支、妮拉紧凑面板、妮拉承伤、羁绊滑杆分配和宠物激活相关门禁/测试；当前用户已要求按用户友好方案实施，不再等待 Open Design 人工验收作为运行时前置门禁。
- 修复本地环境：`npm install` 已成功；worktree hooks 问题通过 `git config --local core.hooksPath E:/agametest/BoardGame-repo/.git/hooks` + `npx simple-git-hooks` 收口。

## 资源边界

| 资源 | 本轮处理 | 上传结论 |
|---|---|---|
| `compressed/ability-cards.webp` | 运行时卡牌 atlas 输入 | manifest/validate 通过；已上传，公开 HEAD `200` / `X-Asset-Source: server` |
| `compressed/player-board.webp` | 运行时角色板输入 | manifest/validate 通过；已上传，公开 HEAD `200` / `X-Asset-Source: server` |
| `compressed/dice.webp` | 运行时骰面输入 | manifest/validate 通过；已上传，公开 HEAD `200` / `X-Asset-Source: server` |
| `compressed/status-icons-atlas.webp` + JSON | 状态图集输入 | manifest/validate 通过；媒体已上传并 HEAD `200`；JSON 本地配置消费 |
| `compressed/bleed.webp` | 独立参考图，运行时优先 status atlas frame | 已随 6 对象媒体集上传，公开 HEAD `200` |
| `compressed/nyras-bond.webp` | 妮拉之系 / 设计输入 | 已随 6 对象媒体集上传，公开 HEAD `200`；运行时 UI 不把它当独立骰子装饰 |
| `tip.png` | 本地规则真相源 | 不生成压缩版、不上传、不进入运行时图片请求 |

## 2026-08-17 补审计范围锁定

| 前提项 | 当前裁定 |
|---|---|
| 问题对象 | DiceThrone 新英雄女猎手 `lieren`，重点是野兽伙伴妮拉 / Nyra、妮拉之系、流血、女猎手专属技能与卡牌 |
| 真相来源 | `src/games/dicethrone/rule/女猎手真相源表.md`、`女猎手录入核对.md`、`女猎手卡牌录入核对.md`，以及当前实现和测试文件 |
| 目标入口 / 环境 | 当前仓库 `D:\gongzuo\webgame\BoardGame` 的 `main` 分支；只审当前已合入女猎手范围，不扩到其它 DiceThrone 英雄 |
| 验收口径 | 现有实现无功能 blocker；同一 evidence 补齐对象级矩阵、D 维度、缺口分类、旧结论回写；验证命令能复跑通过 |

本轮主目标属于 `总账收口 + 规则/数据录入审计`。截图只作为真实入口和 UI 消费证据，不反向替代素材、规则或卡牌录入合同。

### 缺口分类与范围裁定

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞“全面无死角”口径 | 当前范围裁定 | 后续入口 |
|---|---|---:|---:|---|---|
| 旧 evidence 已有测试和截图，但缺少对象级矩阵、D 维度和缺口分类表 | 审计留档缺口 | 否 | 是 | 当前范围内，已在本节回写 | 本文件 |
| 旧规则文档仍写“资源上传/HEAD 未收口” | 审计留档缺口 | 否 | 是 | 当前范围内，回写规则核对文档 | `src/games/dicethrone/rule/女猎手*.md` |
| 所有专属卡/升级分支没有逐卡真实入口 E2E | 当前范围验证缺口 | 否 | 是，若宣称逐卡 L3/L4 | 当前发布范围只声明代表性玩法；不宣称逐卡 E2E 全覆盖 | 后续用户点名卡牌或全卡真实入口审计时再补 |
| 其它 DiceThrone 老英雄资源 / 旧测试失败 | 非阻塞扩展 | 否 | 否 | 当前范围外；PR #137 冲突证据已单列 | 对应旧英雄专项 |

### 全面审计自检表

| 自检项 | 状态 | 证据 |
|---|---|---|
| 对象全集 | `passed` | 本节列出女猎手素材、9 个玩家板技能、6 张专属行动牌、9 张升级牌、2 个状态 / 伙伴入口；公共卡只审女猎手 atlas 绑定 |
| 规则子句表 | `passed` | 规则合同见 `女猎手录入核对.md` 与 `女猎手卡牌录入核对.md`；实现入口见下方对象矩阵 |
| 完整技能流程矩阵 | `representative_only` | 行为层覆盖流血、妮拉之系、妮拉承伤、奖励骰、升级壳、状态图集和代表技能；未宣称逐技能真实入口 E2E |
| L0-L4 证据层级 | `representative_only` | L0/L1/L2 以规则合同、结构测试和规则矩阵为主；L3 仅覆盖真实选角、玩家板、手牌、妮拉面板、流血图标和伤害分配 |
| 命中 D 维度 | `passed` | D1/D3/D5/D7/D8/D10/D12/D15/D18/D22/D23/D33/D48/D52/D55/D56/D58 |
| 关键组合矩阵 | `representative_only` | 覆盖妮拉承伤 vs 终极禁止、妮拉之系治疗 vs 伤害分配、流血 1-4 / 5-6、奖励骰分支；未覆盖所有牌面组合的真实入口 |
| 真实入口 E2E 与截图核验 | `representative_only` | `e2e/dicethrone/lieren-intake.e2e.ts` 及 `evidence/dicethrone/lieren-intake-e2e-test.md` |
| 测试语义对账 / 旧测试失效检查 | `passed` | `lieren-intake.test.ts`、`lieren-rule-matrix.test.ts`、`customaction-category-consistency.test.ts`、`AbilityOverlays.test.tsx` |
| 同类扩审记录 | `passed` | `lieren-kindred-bond` 已拆成专属 custom action；替换型升级 family 由 `AbilityOverlays.test.tsx` 覆盖全英雄替换型升级槽位 |
| 缺口分类与范围裁定 | `passed` | 见本节缺口分类表 |
| 残余范围声明 | `passed` | 残余是逐卡真实入口 L3/L4，不是当前功能实现 blocker |
| 旧 evidence / 旧结论对账回写 | `passed` | 本节降级“全面无死角”口径；规则文档同步更新资源发布状态 |

## 2026-08-17 对象级审计矩阵

### 定义、注册、资源和 UI 出口

| 对象 | 规则子句 / 合同 | 实现入口 | 命中维度 | 证据层级 | 结论 |
|---|---|---|---|---|---|
| 女猎手角色注册 | 可选角色、无提示卡、专属骰面、初始妮拉伙伴 | `core-types.ts`、`characters.ts`、`diceConfig.ts` | D3/D52/D15 | L1/L2/L3 | `passed` |
| 玩家板九槽 | 每个物理槽绑定女猎手图面技能 | `abilitySlotMapping.ts`、`AbilityOverlays.tsx` | D52/D3/D15 | L1/L3 representative | `passed` |
| 卡牌 atlas | 专属 slot 17-31 + 公共 `card-unexpected` slot 32，slot 33/34 不录入 | `cards.ts`、`cardAtlas.ts`、`ability-cards-lieren.atlas.json` | D52/D3/D15 | L1/L2/L3 representative | `passed` |
| 状态 / token atlas | `bleed` 与 `nyras_bond` frame 能被血条上方状态区消费 | `tokens.ts`、`characters.ts`、`status-icons-atlas.json` | D52/D3/D15/D48 | L1/L2/L3 representative | `passed` |
| 妮拉紧凑面板 | 伙伴生命、激活状态、妮拉之系、治疗按钮、伤害转移/分配入口 | `NyraCompanionPanel.tsx` | D5/D15/D20/D48 | L3 representative | `passed` |

### 玩家板技能

| 对象 | 规则子句 | 实现入口 | 共享链路 / 复用依据 | 命中维度 | 证据层级 | 结论 |
|---|---|---|---|---|---|---|
| 野性之力 / II | 长矛数量造成伤害；II 四同点施加流血 | `abilities.ts` `wild-force` / `WILD_FORCE_2` | 共享 `damage()` / `grantBleed()`；触发差异为骰面计数 | D1/D3/D22/D18 | L1；L2 representative | `representative_only` |
| 蛮荒之力 / II / 狩猎 | 基础伤害 + 奖励骰；升级狩猎施加流血并造成伤害 | `abilities.ts` `savage-force` / `SAVAGE_FORCE_2` | 共享 `rollDie` 奖励骰 settlement；后续消费者为 bonus damage / token / status | D1/D3/D8/D10/D55 | L1；L2 representative | `representative_only` |
| 猛击之力 / II | 小顺 / 大顺分别施加流血并造成伤害 | `abilities.ts` `brutal-strike` / `BRUTAL_STRIKE_2` | 共享 `grantBleed()` + `damage()`，升级只改数值 | D1/D3/D22/D18 | L1；L2 representative | `representative_only` |
| 巨兽之力 / II / 凶狠注视 | 治疗妮拉、不可防御伤害或施加流血 | `abilities.ts` `beast-force` / `BEAST_FORCE_2` | 妮拉治疗走 `lieren-nyra-effect`；不可防御走伤害管线声明层 | D1/D3/D8/D22/D55 | L1/L2 | `passed` 行为层，L3 未逐技能 |
| 生命复苏 / II | 获得妮拉之系并治疗妮拉 | `abilities.ts` `life-revival` / `LIFE_REVIVAL_2` | `lieren-nyra-effect` 统一授予 token 与伙伴治疗 | D1/D7/D12/D15 | L1/L2 | `passed` 行为层，L3 未逐技能 |
| 野兽本能 / II / 挥爪 | 获得妮拉之系，不可防御伤害；升级分支施加流血 | `abilities.ts` `beast-instinct` / `BEAST_INSTINCT_2` | token / 伤害 / 流血三条共享消费者 | D1/D3/D22/D55 | L1；L2 representative | `representative_only` |
| 追猎潜袭 / II / 割喉 | 治疗妮拉并造成伤害；升级分支施加流血 | `abilities.ts` `hunt-ambush` / `HUNT_AMBUSH_2` | 共享妮拉治疗、普通伤害和流血消费者 | D1/D3/D22/D18 | L1；L2 representative | `representative_only` |
| 情同骨肉 / II / III | 防御骰按长矛、魂之羁绊、利爪、剑齿虎结算 | `abilities.ts` `kindred-bond` / `KINDRED_BOND_2/3`、`customActions/lieren.ts` | 专属 `lieren-kindred-bond`，categories 为 defense/damage/resource | D1/D3/D8/D10/D22/D55 | L1/L2 | `passed` 行为层，L3 未逐技能 |
| 丛林狂怒！ | 终极：获得妮拉之系、施加流血、造成 12 伤害；终极不能被普通行动响应 | `abilities.ts` `jungle-fury` | `ultimate`/`uninterruptible` tags + token/status/damage 共享消费者 | D1/D3/D10/D22/D55 | L1；L2 representative | `representative_only` |

### 专属卡牌与升级壳

| 对象 | 规则子句 | 实现入口 | 共享链路 / 复用依据 | 命中维度 | 证据层级 | 结论 |
|---|---|---|---|---|---|---|
| 原始咆哮！ | 投 1 骰，剑齿虎治疗妮拉 4，否则抽 1 | `cards.ts` `primitiveRoarRoll` | 奖励骰 display-only settlement + companionHeal / drawCard | D1/D3/D8/D55 | L1/L2 | `passed` 行为层 |
| 重整旗鼓！ | 获得妮拉之系 | `cards.ts` `nyraEffect('grant-bond')` | `lieren-nyra-effect` 授予 token | D1/D7/D12 | L1/L2 | `passed` 行为层 |
| 伺机待发！ | 攻击修正奖励骰四面分支 | `cards.ts` `opportunisticStrikeRoll` | bonus damage / companionHeal shared settlement | D1/D8/D12/D15/D55 | L1/L2 | `passed` 行为层 |
| 飞扑！ | 5 颗奖励骰，长矛加伤，利爪施加流血 | `cards.ts` `pounceRoll` | 多骰 settlement 累计 bonus damage / status | D1/D8/D18/D55 | L1/L2 | `passed` 行为层 |
| 野蛮爪击！ | 指定玩家投骰，利爪或剑齿虎施加 2 流血，否则 1 流血 | `cards.ts` `savageClawRoll` | 当前实现固定作用于对手；目标选择语义未做独立 L3 | D1/D3/D5/D18 | L1/L2 | `passed` 行为层，目标选择 L3 未覆盖 |
| 血脉相承！ | 治疗妮拉 1，并按魂之羁绊 / 剑齿虎追加治疗 | `cards.ts` `bloodlineRoll` | companionHeal settlement | D1/D7/D12 | L1/L2 | `passed` 行为层 |
| 9 张升级牌 | 替换目标基础技能，复合分支不拆成独立物理卡 | `cards.ts` `replaceAbility(...)` + `abilities.ts` 升级定义 | 共享 replaceAbility 壳；被替换能力 seam 见上方技能矩阵 | D3/D23/D33/D52 | L1/L2；L3 representative | `passed` 替换壳，能力分支按上方各行 |
| 公共卡复用 | 公共卡 ID 不重复创建，`card-unexpected` 绑定女猎手 slot 32 | `cards.ts` `injectCommonCardPreviewRefs(...)` | 共享公共卡逻辑，只审 atlas / previewRef 绑定 | D3/D52/D15 | L1/L2 | `passed` |

### 语义门禁快照

| 对象 | 承接语义 | 触发时机 | 效果宿主 | 作用范围 | 触发后清理 | 不应发生什么 | 结论 |
|---|---|---|---|---|---|---|---|
| 流血 | 负面状态自动维护 | 持有者 upkeep | 持有者本人 | 1-4 受 1 点直接伤害；5-6 移除 1 层 | 伤害分支不移除；移除分支不伤害 | 不应在非持有者 upkeep 触发；不应超过上限 2 | 通过 |
| 妮拉之系 | 可消耗正面 token | 任意时机治疗；受伤响应时分配伤害 | 女猎手自己持有，作用到妮拉/女猎手 | 治疗妮拉 2，或在妮拉与女猎手间分配当前伤害 | 消耗 1 层并关闭 pendingDamage | 不应治疗女猎手；无妮拉/无 token 不应可用 | 通过 |
| 妮拉承伤 | 伙伴代替承受本次伤害 | beforeDamageReceived | 女猎手的妮拉伙伴 | 非终极攻击伤害响应 | 只扣伙伴生命并清 pendingDamage | 终极攻击不应转移；不应扣女猎手生命 | 通过 |
| 妮拉激活加伤 | 被动攻击加伤 | 女猎手自己的 withDamage 攻击伤害 | 女猎手攻击者 | 妮拉 hp > 0 时一次攻击 +2 | 单次攻击只加一次 | 妮拉倒下不应加伤；防御语境不应加伤 | 通过 |
| 情同骨肉 | 防御骰反击 / 治疗 | defensiveRoll 结算 | 女猎手防御方 | 长矛/剑齿虎伤害、魂之羁绊治疗、利爪按妮拉激活加伤 | 防御结算后进入普通伤害流程 | 不应借 `lieren-nyra-effect` 误分类；无妮拉不应生效 | 通过 |

### 窗口与来源归属快照

| 对象 | 玩家看到的入口/提示 | 真实结算窗口 | 来源归属 | 共享消费者 | 易混淆对象 | 负向断言 | 结论 |
|---|---|---|---|---|---|---|---|
| 妮拉紧凑面板 | 历史左侧伙伴面板、治疗按钮、伤害转移/分配按钮 | 普通牌桌 / pendingDamage 响应 | 女猎手自己的伙伴和 token | `USE_TOKEN`、`pendingDamage`、`TOKEN_RESPONSE_CLOSED` | 旧 `token-response-modal` | 2026-08-18 已被“玩家板图片左上空白徽章 + 居中响应弹窗”取代；本行仅保留历史语义 | 历史归档 |
| 妮拉之系治疗 | “消耗羁绊治疗妮拉”按钮 | 无 pendingDamage 时的 token 使用 | 女猎手自己持有 | `commandValidation` + `executeTokens` | 普通防御 token | 满血或无 token 时按钮/命令不应成立 | 通过 |
| 妮拉之系伤害分配 | 滑杆 + 确认分配 | beforeDamageReceived | 女猎手自己持有，分配给妮拉与女猎手 | `executeTokens` 分别写伙伴 HP 与英雄 HP | 妮拉全额承伤 | 分配量不能超过当前伤害或妮拉生命 | 通过 |
| 妮拉承伤 | “转移伤害”按钮 | beforeDamageReceived | 妮拉伙伴生命 | `executeTokens` 清理 pendingDamage | 妮拉之系分配 | 终极攻击不应允许 `nyra_redirect` | 通过 |
| 女猎手状态图标 | 血条上方状态区 | 常驻 UI 消费 | `bleed` / `nyras_bond` 定义和 atlas frame | VisualResolver / 状态容器 | 纯色 fallback | E2E 看到流血状态；合同测试验证 frame key | 通过 |

## 2026-08-17 测试语义对账

| 测试 / 证据 | 现实含义 | 证明了什么 | 不能证明什么 |
|---|---|---|---|
| `lieren-intake.test.ts` | 女猎手注册、资源、manifest、i18n、atlas、slot 合同 | L1 结构和资源合同、卡牌 atlas 绑定、提示卡不进运行时 | 不证明每张卡真实打出后的 UI 链路 |
| `lieren-rule-matrix.test.ts` | 流血、妮拉之系、妮拉承伤、奖励骰、代表卡牌行为 | L2 最终权威状态、token 消耗、伙伴生命、伤害分配、终极禁止转移 | 不证明每个技能/升级分支都有独立 E2E |
| `customaction-category-consistency.test.ts` | custom action 输出事件类型与 categories 对齐 | `lieren-kindred-bond` 不再和妮拉治疗共用一个过宽 action ID，damage/defense/resource 元数据可被共享门控消费 | 不证明玩家实际点到该技能 |
| `AbilityOverlays.test.tsx` | 升级牌与玩家板物理槽位合同 | 替换型升级牌落在正确技能槽，新增女猎手后全英雄替换型升级数量为 127 | 不证明升级牌真实打出流程和 CP 扣费 |
| `lieren-intake.e2e.ts` / `lieren-intake-e2e-test.md` | 真实在线双玩家入口 | 选角、玩家板、手牌、妮拉面板、流血状态图标、伤害响应控件可见可操作 | 不证明所有专属卡和升级分支逐卡真实入口 |

## 阻塞 / 环境状态

Open Design 环境已于 2026-08-08 重新接入：`node D:\codex-home\tools\open-design\apps\daemon\bin\od.mjs --help` 可正常输出，`codex mcp list` 可见 `open-design` MCP 配置，`npm run start:open-design` 确认 daemon 已在 `http://127.0.0.1:7456` 可达，`Invoke-WebRequest -UseBasicParsing http://127.0.0.1:7456/api/health` 返回 HTTP `200`。

历史候选稿是网页 Studio 项目 `dicethrone-lieren-pet-ui` 的 `lieren-nyra-pet-ui-v7.html`，协作入口为 `http://127.0.0.1:2552`；对应候选位图为 `docs/games/dicethrone/design/reference/lieren-pet-ui/exports/lieren-nyra-pet-ui-open-design-candidate-v7.png`。用户随后明确指出“设计稿不算通过，也不要人工验收”，本轮运行时交付改按用户友好口径实施：不保留割裂式独立宠物页面、不放无意义右侧骰子装饰，选择承伤与羁绊分配合并在既有伤害响应窗口中，妮拉常驻信息放在牌桌紧凑面板。

## 当前验证

- 早期静态接入验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/lieren-intake.test.ts src/games/dicethrone/__tests__/lieren-rule-matrix.test.ts src/games/dicethrone/__tests__/criticalImageResolver.test.ts --configLoader native`：3 files / 24 tests passed，覆盖女猎手规则、提示卡不预加载、流血和当时的妮拉宠物运行时门禁。
- `npm run i18n:check`：no missing keys detected；legacy warning baseline unchanged。
- `npm run assets:manifest`：incremental manifest generation passed。
- `npm run assets:validate`：incremental manifest validation passed。
- `node scripts/assets/upload-to-server.js --check --asset-prefix i18n/zh-CN/dicethrone/images/lieren --asset-prefix atlas-configs/dicethrone/ability-cards-lieren.atlas`：通过，仅枚举 6 个待发布对象：`compressed/ability-cards.webp`、`compressed/bleed.webp`、`compressed/dice.webp`、`compressed/nyras-bond.webp`、`compressed/player-board.webp`、`compressed/status-icons-atlas.webp`；`tip.png` 未进入发布对象。
- `npx openspec validate add-dicethrone-lieren-faction --strict --no-interactive`：passed。
- 本地发布器同源枚举：仅列出 6 个必要 `compressed/*.webp`，`contains-compressed-tip=False`，`record-source-tip=True`。
- 运行时媒体上传尝试（2026-08-10）：`node scripts/assets/upload-to-server.js --asset-prefix i18n/zh-CN/dicethrone/images/lieren --asset-prefix atlas-configs/dicethrone/ability-cards-lieren.atlas --skip-android-package-publish` 失败，`exit=255`，原因是 `No ED25519 host key is known for 8.148.71.102 and you have requested strict checking. Host key verification failed.`；脚本要求提供已独立核验的 `ASSET_SERVER_SSH_KNOWN_HOSTS_PATH`，不得用未经核验的 `ssh-keyscan` 结果冒充信任。
- 2026-08-10 再次尝试服务器上传：`node scripts/assets/upload-to-server.js --asset-prefix i18n/zh-CN/dicethrone/images/lieren` 仍枚举同一批 6 个对象，并在 `StrictHostKeyChecking=yes` 下失败，错误仍为 `No ED25519 host key is known for 8.148.71.102`；当前阻塞未变化。
- 2026-08-11 发布链路补救：本机 Git credential 可读性检查会超时，且当前仓库没有只发布素材的 GitHub Actions workflow；已新增 `.github/workflows/asset-server-upload.yml`，让远端 runner 复用仓库 `ASSET_SERVER_SSH_PRIVATE_KEY` / `ASSET_SERVER_SSH_KNOWN_HOSTS` secrets 执行 `node scripts/assets/upload-to-server.js --asset-prefix ...`，并支持发布后公开 URL HEAD 回查。该 workflow 已通过项目 `yaml` 包解析：`WORKFLOW_YAML_OK steps=8`。
- 公开 URL HEAD 回查（2026-08-10）：`ability-cards.webp`、`bleed.webp`、`dice.webp`、`nyras-bond.webp`、`player-board.webp`、`status-icons-atlas.webp` 在 `https://assets.easyboardgame.top/official/i18n/zh-CN/dicethrone/images/lieren/compressed/` 下均返回 `404`，证明服务器主源当前未收口，不能把本地截图或本地 manifest 误判为线上资源完成。
- 2026-08-11 公开 URL HEAD 回查：上述 6 个女猎手远端 URL 仍全部返回 `404`，证明新增 CI 上传入口尚未在远端执行成功，服务器素材发布仍未收口。
- 2026-08-14 HTTP 素材上传：先以 `ASSET_SERVER_UPLOAD_ALLOW_UNAUTHENTICATED=1 ASSET_SERVER_UPLOAD_URL=https://assets-upload.easyboardgame.top/asset-publish npm run assets:check -- --asset-prefix i18n/zh-CN/dicethrone/images/lieren --asset-prefix atlas-configs/dicethrone/ability-cards-lieren.atlas --skip-android-package-publish` 确认仅 6 个 `compressed/*.webp` 待发布，随后执行同参数 `npm run assets:upload` 成功；发布批次 `20260814130445100`，`serverPrimaryObjects=6`，`serverPrimaryIndexObjects=13238`，`assetBackupQueue=disabled`。
- 2026-08-14 公开 URL HEAD 回查：上述 6 个女猎手远端 URL 均返回 `200`，`Content-Length` 分别为 `2246590`、`7298`、`36856`、`13284`、`2076750`、`30164`，且 `X-Asset-Source: server`；`tip.webp` 仍未生成、未上传。
- 2026-08-14 合并冲突收口后复核：`ASSET_SERVER_UPLOAD_ALLOW_UNAUTHENTICATED=1 ASSET_SERVER_UPLOAD_URL=https://assets-upload.easyboardgame.top/asset-publish npm run assets:check -- --asset-prefix i18n/zh-CN/dicethrone/images/lieren/compressed` 成功取得服务器清单 `13242` 个 official 对象，并发现本地 6 个对象均已与远端一致；脚本按路径过滤 0 待发布防呆规则退出 `1`，随后用公开 URL HEAD 逐项复核 6 个对象均为 `200` / `X-Asset-Source: server`。
- `npx tsc --noEmit --pretty false`：passed。
- `npx eslint src/games/dicethrone/domain/core-types.ts src/games/dicethrone/criticalImageResolver.ts src/games/dicethrone/ui/CenterBoard.tsx src/games/dicethrone/ui/DiceThroneHeroSelection.tsx src/games/dicethrone/__tests__/lieren-intake.test.ts e2e/dicethrone/lieren-intake.e2e.ts`：0 errors。
- `npx playwright install chromium`：项目锁定的 Chromium、headless shell、FFmpeg 和 Winldd 已安装；此前 `mongodb-memory-server` 所需的 Microsoft Visual C++ v14 x64 运行库也已安装并验证 `Installed=1`。
- `npm run test:e2e:file -- e2e/dicethrone/lieren-intake.e2e.ts`：1 test passed / 58.8s；真实双玩家完成女猎手与武僧选角、开局、玩家板槽位、无提示卡、4 张手牌、流血状态图标和对手视角验证。
- 2026-08-10 重跑：`node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/lieren-intake.test.ts src/games/dicethrone/__tests__/lieren-rule-matrix.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 --reporter=dot`：2 files / 18 tests passed。
- 2026-08-10 重跑：`node scripts/infra/run-e2e-command.mjs ci e2e/dicethrone/lieren-intake.e2e.ts` 生成本轮截图，`test-results/playwright-artifacts/.last-run.json` 为 `{"status":"passed","failedTests":[]}`。
- 2026-08-14 冲突收口后重跑：`npm run test:e2e:file -- e2e/dicethrone/lieren-intake.e2e.ts`：1 test passed / 49.5s；真实入口验证旧 `token-response-modal` 未出现，伤害承接控件在妮拉紧凑面板内显示并可操作。
- 2026-08-10 证据自检：`npm run audit:evidence:selfcheck -- evidence/dicethrone/dicethrone-lieren-intake-audit-2026-08-08.md`：OK。
- 2026-08-17 补审计前自检：`npm run audit:evidence:selfcheck -- evidence/dicethrone/dicethrone-lieren-intake-audit-2026-08-08.md`：OK。
- 2026-08-10 构建门禁补跑：初次 `npm run build` 在 Vite `rendering chunks` 阶段因 Node 默认 2GB heap 触发 `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`，退出码 `134`；已将 `build` / `build:full` 的 Vite 进程改为 `node --max-old-space-size=8192 scripts/infra/vite-cli-safe.mjs ...`，重跑 `npm run build` 退出码 `0`，并通过 `DIST_SANITY_OK indexBytes=8493`。
- E2E 同源整屏主证据：`test-results/evidence-screenshots/dicethrone/lieren-intake.e2e/真实在线双玩家应完成女猎手选角初始化、隐藏提示卡并看到妮拉、伤害分配、玩家板、手牌与流血状态图标/01-选角-女猎手与武僧-角色板.jpg`、`02-牌桌-女猎手妮拉玩家板手牌流血.jpg`、`03-伤害响应-妮拉羁绊分配.jpg`、`04-牌桌-对手视角已进入.jpg`。
  - 选角图：女猎手角色板完整居中，右侧没有提示卡预览；选角列表和两位玩家信息同时可见。
  - 女猎手牌桌图：角色板、4 张手牌、流血状态图标和妮拉紧凑面板可见，没有提示卡区域、割裂式宠物页面或破损图片。
  - 伤害响应图：在妮拉紧凑面板内可见“由妮拉承受”、当前伤害值、羁绊滑杆、确认分配与转移伤害入口；旧 `token-response-modal` 未出现，选择伤害承受没有被拆成割裂界面。
  - 对手视角图：武僧角色板、手牌和其提示卡仍正常显示，证明女猎手的无提示卡分支没有改坏最近邻角色。

## 当前结论

- 服务器上传和 URL HEAD 验证已完成：6 个女猎手运行时媒体对象已发布到服务器主源并公开可读；`tip.webp` 仍按用户要求不生成、不上传。
- 真实选角、开局配置、无提示卡、玩家板、手牌、流血状态、妮拉面板、伤害响应/羁绊分配和双玩家对局 E2E 已通过；本轮补审只消费这些证据，不新增逐卡 E2E 结论。
- 当前可表述为“女猎手本地运行时、代表性玩法与服务器运行时媒体发布已验证；对象级审计留档已补齐到当前范围”。禁止表述为“女猎手全部卡牌逐卡真实入口已无死角”。

## 修订 / 失效记录

| 旧结论 / 旧状态 | 失效原因 | 新证据 | 新结论 |
|---|---|---|---|
| 旧文档中“提交 / PR 收口前只需最终 diff 审阅” | PR #137 已合入，当前工作在 `main`；该句已不是当前任务状态 | `evidence/merge-conflict-pr-137-2026-08-16.md`、当前 Git 历史 | 当前文档转为女猎手审计总账，不再作为 PR 待合并清单 |
| 旧规则文档写“资源上传/HEAD 尚未收口” | 2026-08-14 和 PR #137 冲突收口后均已完成服务器发布与公开回查 | 本文“资源边界”“当前验证”与 PR #137 evidence | 资源发布状态更新为 `passed` |
| 旧 evidence 只有代表性 E2E 与测试摘要 | 缺少对象全集、D 维度、缺口分类和旧结论回写，不能支撑“全面无死角” | 2026-08-17 本节对象级审计矩阵 | 允许说“代表性玩法已验证、对象级审计留档已补”；不允许说“逐卡 L3/L4 全覆盖” |
| 旧 evidence 写“左侧紧凑妮拉面板 / 控件在妮拉面板中” | 2026-08-18 用户锁定当前 UI 目标为“中间女猎手玩家板图片本身左上角空白带”和“居中承伤 / 羁绊分配弹窗” | `evidence/dicethrone/dicethrone-lieren-nyra-panel-damage-bond-e2e-2026-08-18.md`、`evidence/dicethrone/nyra-player-board-badge-center-modal-pass-manifest-2026-08-18.json` | 旧左侧面板口径只保留为历史归档，不再作为当前实现、测试或开图依据 |
