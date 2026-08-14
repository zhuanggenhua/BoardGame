# Dice Throne 武士（Samurai）D1–D49 补审记录（2026-04-11，2026-04-12 回写）

> 2026-05-19 范围澄清：本文件只覆盖 `samurai` 单英雄补审。当前整批“新英雄补审”总范围统一按 `gunslinger / samurai / treant / ninja` 四位理解；总范围与跨英雄汇总口径请以 `evidence/dicethrone/dicethrone-new-factions-full-cycle-audit-2026-05-15.md` 和 `evidence/dicethrone/dicethrone-new-factions-reaudit-wiki-diff-2026-05-17.md` 为准。
>
> 2026-05-19 本轮补审回写：已把“`Stand Tall` 完全挡住伤害时仍错误开启 `Back Strike` 响应窗”从文档风险升级为真实共享逻辑 bug，随后在 `effects.ts` 修掉“开窗判定仍看护盾前伤害”的问题，并用武士专属回归与跨英雄护盾回归重新验证。
>
> 2026-06-05 当前有效口径：本文仍是武士单英雄主审计入口；其中各对象级 E2E/专项文档只能作为子证据，不得反向外推整英雄之外的批次结论。当前若要判断新英雄整批残余与发布口径，应以 `evidence/dicethrone/dicethrone-new-factions-full-cycle-audit-2026-05-15.md`、`evidence/dicethrone/dicethrone-new-factions-reaudit-wiki-diff-2026-05-17.md` 与对应对象级回写文档的最新口径为准。`Honor / Shame` 超上限授予现已具备真实主阶段手牌 `L3 clamp` 证据，`samurai_retribution` 超上限授予已具备 L2 clamp 断言与 `Zanshin` 真实 E2E 的 `L3 clamp` 证据，`Back Strike` 对非攻击 `direct damage` 不开窗也已具备专属真实在线 `L3` 证据。因此武士当前**不再单列对象级 residual**；后续若仍谈“未完成项”，只应落在四英雄批次级 `L4` 治理、旧文档统一回写与最终发布口径统一，不得再把武士对象级证据缺口当作当前主残余。

## 审计范围
- 角色板能力 / 终极技：太刀斩、胁差、武士道、肃穆之仪、武道、叶隐之心、正宗、昂首无畏、征夷大将军！
- 提示板状态 / 骰面说明：耻辱、荣誉、反击、骰面说明
- 专属卡组：升级卡、行动卡、攻击修正卡
- 关键实现入口：
  - `src/games/dicethrone/heroes/samurai/abilities.ts`
  - `src/games/dicethrone/heroes/samurai/cards.ts`
  - `src/games/dicethrone/heroes/samurai/tokens.ts`
  - `src/games/dicethrone/heroes/samurai/diceConfig.ts`
  - `src/games/dicethrone/domain/customActions/samurai.ts`
  - `src/games/dicethrone/domain/tokenResponse.ts`
  - `src/games/dicethrone/domain/effects.ts`
  - `src/games/dicethrone/domain/attack.ts` / `reduceCombat.ts` / `reducer.ts`
- 关联测试 / 证据入口（本文 2026-06-05 回写额外纳入 2 份对象级 E2E evidence；若“验证证据”段落未给出命令与截图路径，则仍按静态/历史证据入口理解，不冒充本轮复跑）：
  - `src/games/dicethrone/__tests__/cross-hero.test.ts`
  - `src/games/dicethrone/__tests__/token-execution.test.ts`
  - `src/games/dicethrone/__tests__/token-fix-coverage.test.ts`
  - `evidence/dicethrone/dicethrone-new-passives-e2e-test-2026-04-06.md`
  - `evidence/dicethrone/dicethrone-samurai-token-response-e2e-test.md`
  - `evidence/dicethrone/dicethrone-samurai-token-clamp-real-hand-e2e-2026-06-05.md`
  - `evidence/dicethrone/dicethrone-samurai-direct-damage-no-back-strike-e2e-2026-06-05.md`
  - `evidence/dicethrone/dicethrone-samurai-cross-hero-attack-modifier-e2e.md`
  - `evidence/dicethrone/dicethrone-hero-ability-cards-e2e-test.md`（2026-04-12 补充：Stand Tall II / Masamune II 成功链路截图）
  - `evidence/dicethrone/dicethrone-gunslinger-samurai-4p-targeted-cards-e2e-test.md`
- 不含：除“验证证据”段落明确列出的命令与截图链外，本文不新增资源清理与历史裁图治理

## 权威来源
- `src/games/dicethrone/rule/武士真相源表.md`
- `src/games/dicethrone/rule/武士录入核对.md`
- `src/games/dicethrone/rule/武士卡牌录入核对.md`
- 汉化原图路径（见真相源表中的 `player-board.webp` / `tip.webp` / `ability-cards.webp`）
- Wiki/英文图仅作对照，不覆盖汉化图结论
- **裁决优先级（本轮显式回写）**：卡牌 / 技能 / token 自身描述 > 规则文档 > 历史实现 / 默认裁定。`Righteousness!` / `Zanshin!` 属于“掷骰即得该骰面效果”；`Wild West` 属于“挂载到 Loaded 奖励骰收口后的追加效果”，两者不得混审。

## 成熟旧对象对照（共享契约）
- 参照 `武士卡牌录入核对.md` 中“与老派系升级合同逐张对照”段落，
  以 Monk / Paladin / Barbarian 等成熟角色升级合同作为基线。
- 结论：武士升级卡遵守“升级卡 → 基础技能”合同，复合升级位不拆成独立手牌。

## 逐项结论

### 角色板能力 / 终极技
| 能力 | 权威描述要点（汉化图） | 实现入口 | 维度 | 结论 |
| --- | --- | --- | --- | --- |
| 太刀斩（katana-slice） | 3/4/5 katana → 5/6/7 伤害 | `abilities.ts` KATANA_SLICE | D1/D3 | ✅ 一致 |
| 胁差（wakizashi） | +1 反击 +3 不可防御伤害 | `abilities.ts` WAKIZASHI | D1/D3 | ✅ 一致 |
| 武士道（bushido） | 开局 +1 荣誉；若本回合攻掷 < 3 次，回合末再 +1 荣誉 | `abilities.ts` + `customActions/samurai.ts` | D1/D8 | ✅ 静态定义、状态级测试与历史 UI 证据一致 |
| 肃穆之仪（solemnity） | +1 耻辱 +7 伤害 | `abilities.ts` SOLEMNITY | D1/D3 | ✅ 一致 |
| 武道（budo） | 小顺；+1 荣誉 +6 伤害 | `abilities.ts` BUDO | D1/D3 | ✅ 一致 |
| 叶隐之心（hagakure） | +1 荣誉 +1 反击 +1 耻辱 +5 不可防御伤害 | `abilities.ts` SAMURAI_SLOT_06 | D1/D3 | ✅ 一致 |
| 正宗（masamune） | 固定 7 伤害 + 额外掷 5 骰按图标结算 | `abilities.ts` MASAMUNE + `customActions/samurai.ts` | D1/D3/D8 | ✅ 主语义一致；`Masamune II` 的 6 骰奖励骰特写 UI 已补“出现→关闭→最终态”成功链路证据（见 `dicethrone-hero-ability-cards-e2e-test.md` §10） |
| 昂首无畏（stand-tall） | 防御技：katana 反击 1 点**不可防御**伤害；helm 抵挡 1；rising_sun 抵挡 2；若无盾则自得耻辱 | `abilities.ts` + `customActions/samurai.ts` | D1/D5/D8/D10 | ✅ 基础版语义、不可防御标记与 metadata 已一致 |
| 征夷大将军！（ultimate） | +1 荣誉 +2 耻辱 +13 不可防御伤害 | `abilities.ts` ULTIMATE | D1/D3 | ✅ 一致 |

### 提示板状态 / 骰面说明
| 状态 | 权威描述要点（汉化图） | 实现入口 | 维度 | 结论 |
| --- | --- | --- | --- | --- |
| 耻辱（shame） | 计算攻击伤害时按层数递减；堆叠限制 2 | `tokens.ts` + 战斗结算链路 + locale | D1/D3/D7 | ✅ 当前实现已按真相源收紧为 `stackLimit=2`，并同步收紧消耗选择为 `allowedConsumeAmounts: [1,2]`；2026-06-05 已通过 `你真可耻！` 真实主阶段手牌链路补齐“已有 1 层再施加 2 层，最终仍为 2”的对象级 `L3 clamp` 证据 |
| 荣誉（honor） | 1 层 = +1；2 层 = +3；堆叠限制 2 | `tokens.ts` + 伤害结算 + locale | D1/D3/D7 | ✅ 当前实现已按真相源设置 `stackLimit=2`；tooltip 的“双档加伤”规则与实现一致，2026-06-05 已通过 `武士荣耀！` 真实主阶段手牌链路补齐对象级 `L3 clamp` 证据 |
| 反击（samurai_retribution） | 受攻击时消耗并掷 1 骰；结果 / 2 向上取整返还伤害；堆叠限制 1 | `tokens.ts` + `customActions/samurai.ts` + `tokenResponse.ts` | D1/D3/D5/D8 | ✅ 当前实现已按真相源设置 `stackLimit=1`，并在 token 定义 / 响应门禁中显式写入“仅攻击伤害可用”；`Zanshin` 已补“超上限授予最终仍为 1”的对象级 `L3 clamp`，`Knife Fan` 真实在线链路也已补齐“非攻击 `direct damage` 不开窗”的对象级 `L3` |
| 骰面说明 | 1~3 katana / 4~5 helm / 6 rising_sun | `diceConfig.ts` | D1/D3 | ✅ 一致 |

### 专属卡牌 / 升级卡 / 攻击修正卡
| 卡牌ID | 汉化卡名 / 类别 | 权威描述要点 | 实现入口 | 维度 | 结论 |
| --- | --- | --- | --- | --- | --- |
| upgrade-katana-slice-2 | 太刀斩 II / 升级 | 6/7/8 伤害；≥4 同点数 → 耻辱 | `cards.ts` + `abilities.ts` | D1/D3 | ✅ 一致 |
| upgrade-katana-slice-3 | 太刀斩 III / 升级 | 6/7/8 伤害；≥3 同点数 → 耻辱 | `cards.ts` + `abilities.ts` | D1/D3 | ✅ 一致 |
| upgrade-wakizashi-2 | 胁差 II / 升级 | +1 反击 +4 不可防御伤害 | `cards.ts` + `abilities.ts` | D1/D3 | ✅ 一致 |
| upgrade-wakizashi-3 | 胁差 III / 升级 | +1 反击 +1 耻辱 +4 不可防御伤害 | `cards.ts` + `abilities.ts` | D1/D3 | ✅ 一致 |
| upgrade-solemnity-2 | 肃穆之仪 II / 复合升级 | 升级肃穆之仪；下半区为变体 | `cards.ts` + `abilities.ts` | D1/D3 | ✅ 作为单张升级卡接线 |
| upgrade-budo-2 | 武道 II / 升级 | +1 荣誉 +8 伤害 | `cards.ts` + `abilities.ts` | D1/D3 | ✅ 一致 |
| upgrade-masamune-2 | 正宗 II / 复合升级 | 升级正宗；下半区为变体 | `cards.ts` + `abilities.ts` | D1/D3/D8 | ✅ 静态合同与状态级回归一致；既有 `dicethrone-hero-ability-cards-e2e-test.md` §10 已覆盖 6 骰收口成功链 |
| upgrade-slot-06-2 | 叶隐之心 II / 复合升级 | 升级叶隐之心；下半区为变体 | `cards.ts` + `abilities.ts` | D1/D3 | ✅ 作为单张升级卡接线 |
| upgrade-stand-tall-2 | 昂首无畏 II / 升级 | 防御掷骰数由 `3` 提升到 `4`，且不再有“无盾自吃 shame”分支 | `cards.ts` + `abilities.ts` + `customActions/samurai.ts` | D1/D3/D8/D18 | ✅ 静态合同一致；既有 `dicethrone-hero-ability-cards-e2e-test.md` §9 已覆盖“4 骰且无盾时不自加 Shame”的成功链 |
| card-samurai-honor | 武士荣耀！/ 行动 | 获得 2 荣誉 | `cards.ts` | D1/D7 | ✅ 一致 |
| card-you-should-be-ashamed | 你真可耻！/ 行动 | 施加 2 耻辱（多人局选敌） | `cards.ts` + `customActions/samurai.ts` | D1/D5/D8 | ✅ 状态级测试与历史 4P 真实点击 E2E 一致 |
| card-no-retreat | 不退缩！/ 行动 | 获得 1 反击 | `cards.ts` | D1/D7 | ✅ 一致 |
| card-righteousness | 舍生取义！/ 攻击修正 | 额外掷 1 骰：katana +2 伤害 / helm 2 耻辱 / rising_sun +1 反击 | `cards.ts` + `customActions/samurai.ts` | D1/D7/D8 | ✅ 2026-04-12 真实复跑 E2E 已证明“单骰特写出现 → 最终文案可见 → 特写关闭”；按卡牌自身描述，该牌属于“掷骰即得效果”，不按 Wild West 的延迟加伤口径审计 |
| card-zanshin | 残心！/ 攻击修正 | 额外掷 5 骰按图标结算 | `cards.ts` + `customActions/samurai.ts` | D1/D7/D8 | ✅ 2026-04-12 真实复跑 E2E 已证明“5 骰特写出现 → 汇总文案可见 → 特写关闭”；2026-06-05 又通过同链路回写 `samurai_retribution` 超上限授予最终仍被 clamp 到 `1` 的对象级 `L3` |

### 通用卡区（slot-00 ~ slot-17）
> 依据 `武士卡牌录入核对.md` 的结论，slot-00~17 与 COMMON_CARDS 顺序对齐。

| slot | cardId | 汉化卡名 | 结论 |
| --- | --- | --- | --- |
| 00 | card-transfer-status | 移转！ | ✅ |
| 01 | card-what-status | 效果指示物是啥？ | ✅ |
| 02 | card-one-throw-fortune | 来赌一场吧！ | ✅ |
| 03 | card-get-away | 赶走它！ | ✅ |
| 04 | card-super-double | 三倍抽取！ | ✅ |
| 05 | card-double | 加倍抽取！ | ✅ |
| 06 | card-bye-bye | 拜啦！ | ✅ |
| 07 | card-flick | 乔一下！ | ✅ |
| 08 | card-boss-generous | 拿点报酬！ | ✅ |
| 09 | card-next-time | 这次不算！ | ✅ |
| 10 | card-unexpected | 两倍费用！ | ✅ |
| 11 | card-worthy-of-me | 来，再试一次！ | ✅ |
| 12 | card-surprise | 让它变万用！ | ✅ |
| 13 | card-me-too | 同调！ | ✅ |
| 14 | card-i-can-again | 再来一次！ | ✅ |
| 15 | card-give-hand | 帮一把！ | ✅ |
| 16 | card-just-this | 下次会更好！ | ✅ |
| 17 | card-play-six | 666！ | ✅ |

## 通用“时机正确性语义核对（四问）”
> 本轮按 `.spec/knowledge/standards/testing-audit.md` 的 D8 口径，统一追问四个问题：
> 1) 触发/宣告时点对不对？
> 2) 消耗/结算窗口对不对？
> 3) 状态写入后是否还在可消费窗口，没有被提前清掉？
> 4) 交互 / 特写 / 响应窗口收口后，流程是否恢复推进？

| 对象 | Q1 触发 / 宣告时点 | Q2 消耗 / 结算窗口 | Q3 写入是否仍在消费窗口 | Q4 收口后流程恢复 | 结论 |
| --- | --- | --- | --- | --- | --- |
| `Bushido` | `abilities.ts:194-210` 把“开局 upkeep / 回合末 discard”显式建模成两个 passive variant；`customActions/samurai.ts:204-220` 再做起始玩家与 `<3 次攻掷` 门控 | 开局分支在 `turnNumber === 1 && attackerId === startingPlayerId` 时立即发 `Honor`；回合末分支在 `offensiveRollAttemptsThisTurn < 3` 时发 `Honor` | 历史 E2E `dicethrone-new-passives-e2e-test-2026-04-06.md` 证明首回合 `Honor=1`、回合切换后 `Honor=2`，且 `offensiveRollCountThisTurn` 已清空 | 历史 E2E 已证明 `discard -> turn changed` 后 UI 进入下一回合 | ✅ 四问已闭环 |
| `Honor / Shame / Back Strike` token | `tokens.ts` 把时机固定在 `beforeDamageDealt` / `beforeDamageReceived`，`samurai_retribution` 额外显式声明 `requiresAttackDamage` | `Honor` 双档消耗、`Shame` 按层减伤、`Back Strike` 不减伤只反打；`customActions/samurai.ts` 把反打来源/目标写死为防御方→原攻击方 | 历史 E2E 已覆盖 `Honor` 同一窗口连点两次到 `+3`（且第三次被禁止）；`samurai_retribution` 超上限授予已有 L2 clamp 断言与 `Zanshin` 真实 `L3`；`Back Strike` 的静态 / 单测入口已覆盖“无攻击上下文时不应开窗”与 `direct damage` 负路径 | 历史 E2E 已记录 `TOKEN_RESPONSE_CLOSED`、`Back Strike` 真实点击后返回正常结算；2026-06-05 又补 `Honor / Shame` 真实主阶段手牌 clamp 与 `Knife Fan` 非攻击 `direct damage` 真实在线负路径 | ✅ 真相源要求的堆叠上限（`honor=2`、`shame=2`、`back strike=1`）与 attack-only 门禁均已有对象级 `L3` 证据；武士当前不再把 token 对象级证据缺口列为主 residual |
| `You Should Be Ashamed` | `cards.ts:176-188` 为主阶段即时 action；`customActions/samurai.ts:371-393` 在多人局先发 `selectPlayer`，单敌方时直接落 token | 目标筛选基于 `getOpponents`，不再沿用默认目标推断 | `cross-hero.test.ts:1048-1112` 已证明 4 人队伍模式只给敌方 `1/3`，并把 2 层 `Shame` 写到所选敌方 | 历史 E2E `dicethrone-gunslinger-samurai-4p-targeted-cards-e2e-test.md` 已证明从真实手牌点击进入、选择、确认、结算回到正常局面 | ✅ 四问已闭环（但本轮未复跑，仅引用历史证据） |
| `Stand Tall / Stand Tall II` | `abilities.ts:389-416` 明确挂在 `defensiveRoll`；`customActions/samurai.ts:124-182` 先取回原攻击方，再按 `katana / helm / rising_sun` 结算 | 基础版顺序为“不可防御反伤 → 防御减伤 → 无盾自得 Shame”；II 级通过 `suppressSelfShame=true` 关掉最后一支 | `cross-hero.test.ts:1963-1998` 已证明基础版反伤/减伤链路与不误加 `Shame` 的正向案例；`stand-tall fully prevents the attack without opening back-strike mitigation window` 已补共享回归 | `Stand Tall II` 的成功链路已由 `dicethrone-hero-ability-cards-e2e-test.md` §9 覆盖；基础版 `Stand Tall` 的领域回归已证明完全格挡时不再误开窗 | ✅ `Stand Tall` 共享 bug 已闭环；当前不再把它列为武士主 residual，后续若补专属截图仅属证据加厚而非实现缺口 |
| `Masamune / Masamune II / Righteousness / Zanshin` | `abilities.ts:340-381` 使 `Masamune` 先落固定伤害，再触发奖励骰 custom action；`cards.ts:201-239` 让两张攻击修正卡在 `roll` 窗口即时触发 | `customActions/samurai.ts:223-368` 先写 `BONUS_DIE_ROLLED`/`displayOnlySettlement`，再分发 `BONUS_DAMAGE_ADDED`/`TOKEN_GRANTED` | `cross-hero.test.ts:2001-2288` 证明 `Righteousness`、`Zanshin`、`Masamune II` 的状态写入仍留在 `pendingAttack` / token 消费窗口内；E2E 已覆盖 `Righteousness/Zanshin` 成功路径截图链 | ✅ `Righteousness` / `Zanshin` 已有“徽章→特写→关闭→settled→最终态”的连续证据；✅ `Masamune II` 已补 6 骰奖励骰特写“出现→关闭→最终态”成功链（见 `dicethrone-hero-ability-cards-e2e-test.md` §10） | ✅ 四问闭环已补齐（不再把 `Masamune II` 作为证据缺口） |

## 本轮新增 Findings（2026-04-12 回写）

### Finding A：旧审计遗漏了 token 堆叠上限这一条高优先级真相源语义（D1 / D7 / D43，现已补齐对象级 L3）
- 真相源 `public/assets/i18n/zh-CN/dicethrone/images/samurai/compressed/tip.webp` 已可直接肉眼确认：
  - `honor` 堆叠限制 `2`
  - `shame` 堆叠限制 `2`
  - `samurai_retribution / Back Strike` 堆叠限制 `1`
- 旧审计把它写成“OCR 不稳定 / 不影响闭环”属于过宽结论。
- 当前代码已在 `src/games/dicethrone/heroes/samurai/tokens.ts` 落地对应 `stackLimit`，且 2026-06-05 已分别通过 `武士荣耀！`、`你真可耻！` 与 `Zanshin` 链路补齐 `Honor / Shame / samurai_retribution` 的对象级 `L3 clamp` 证据，因此该 finding 当前保留为“旧审计方法曾漏掉该子句”的历史记录，不再构成对象级残余。

### Finding B：`Stand Tall` 的防御减伤同步时序风险已被本轮动态回归坐实并修复（D8 / D15 / D23）
- 风险点不是“技能描述错”，而是：即便 `defenseEvents` 已同步进状态，只要 `shouldOpenTokenResponse` 仍看护盾前伤害，`Back Strike` 仍会在本应被完全格挡的场景下错误开窗。
- 本轮已用 `cross-hero.test.ts` 新增回归把这条风险坐实为真实 bug，随后在 `src/games/dicethrone/domain/effects.ts` 增加“既有护盾吸收后的有效伤害”门禁估算，只把它用于 token 开窗判定，避免改坏 reducer 的真实扣盾职责。

### Finding C：旧审计没有把 `Back Strike` 的“仅攻击伤害可用”门禁列为显式审查项（D1 / D5 / D8，现已补齐对象级 L3）
- 当前实现已在 `src/games/dicethrone/heroes/samurai/tokens.ts` 通过 `requiresAttackDamage: true`、并在 `src/games/dicethrone/domain/tokenResponse.ts` 通过 `damageScope` 过滤落地静态门禁。
- 但主审计此前缺少这条 finding，容易把 `Back Strike` 和普通 `beforeDamageReceived` token 混审。
- 2026-06-05 已通过忍者 `Knife Fan` 真实在线双页业务链补齐“非攻击 `direct damage` 不开 `Back Strike` 响应”的专属动态证据，因此该 finding 当前保留为“旧审计矩阵曾缺该门禁”的历史记录，不再构成对象级残余。

## 验证证据
- **当前可逐条追溯的动态复验证据**包括 2026-04-12 的 `Righteousness!` / `Zanshin!` 两条攻击修正 E2E，以及 2026-06-05 的 `Honor / Shame` 主阶段手牌 clamp 与 `Back Strike` 非攻击 `direct damage` 不开窗两条对象级 E2E。若下列证据未给出命令与截图路径，则一律按“历史 / 静态引用”处理，不再冒充本轮复跑。
- 规则 / 真相源：
  - `src/games/dicethrone/rule/武士真相源表.md:71-84`
  - `src/games/dicethrone/rule/武士录入核对.md:30-88`
  - `src/games/dicethrone/rule/武士卡牌录入核对.md:32-133`
- 本轮静态核对入口：
  - `src/games/dicethrone/heroes/samurai/abilities.ts:194-434`
  - `src/games/dicethrone/heroes/samurai/cards.ts:164-239`
  - `src/games/dicethrone/heroes/samurai/tokens.ts:11-82`
  - `src/games/dicethrone/domain/customActions/samurai.ts:88-434`
  - `src/games/dicethrone/domain/attack.ts`
  - `src/games/dicethrone/domain/tokenResponse.ts`
- 既有状态级 / 逻辑级证据入口（本轮未新增执行，仅作静态 / 历史证据入口引用）：
  - `src/games/dicethrone/__tests__/cross-hero.test.ts:1048-1112`（`You Should Be Ashamed` 四人队伍模式敌方过滤 + resolve）
  - `src/games/dicethrone/__tests__/cross-hero.test.ts:1852-1929`（`Bushido` 开局 / 回合末 / 恰好 3 掷否定路径）
  - `src/games/dicethrone/__tests__/cross-hero.test.ts:1963-1998`（`Stand Tall` 基础版反伤 + 减伤）
  - `src/games/dicethrone/__tests__/cross-hero.test.ts:2001-2169`（`Righteousness` / `Zanshin`）
  - `src/games/dicethrone/__tests__/cross-hero.test.ts:2172-2288`（`Masamune II` 两分支）
  - `src/games/dicethrone/__tests__/cross-hero.test.ts:2498-2514`（`samurai_retribution` 超上限授予时应被 clamp 到 `1`）
  - `src/games/dicethrone/__tests__/token-execution.test.ts:1198-1209`（`samurai_retribution` 能打开 `defenderMitigation`）
  - `src/games/dicethrone/__tests__/token-execution.test.ts:1211-1219`（无 `pendingAttack` 时不应打开 `defenderMitigation`）
  - `src/games/dicethrone/__tests__/token-execution.test.ts:1326-1336`（`Back Strike` 对非攻击 `direct damage` 不应打开 `defenderMitigation`）
  - `src/games/dicethrone/__tests__/token-fix-coverage.test.ts:541-580`（多层反击使用时仍按“当前伤害一半向上取整”反打）
- 本轮已确认复跑 E2E / 截图证据（2026-04-12）：
  - 命令：`npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "samurai zanshin should settle 5 bonus dice and synchronize effects against paladin"`
  - 关键截图（成功链路，绝对路径）：
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin\10-samurai-zanshin-bonus-die-overlay.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin\10-samurai-zanshin-bonus-die-closed.png`
  - 命令：`npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "samurai righteousness should resolve a valid branch against monk"`
  - 关键截图（成功链路，绝对路径）：
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-righteousness-should-resolve-a-valid-branch-against-monk\09-samurai-righteousness-bonus-die-overlay.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-righteousness-should-resolve-a-valid-branch-against-monk\09-samurai-righteousness-bonus-die-closed.png`
- 2026-06-05 本轮新增对象级 E2E / 截图证据：
  - 命令：`npm run test:e2e:ci:file -- e2e/dicethrone/temp-dicethrone-ability-atlas-regression.e2e.ts "samurai 荣誉与耻辱主阶段手牌在接近上限时应 clamp 到 stackLimit"`
  - 关键截图（成功链路，绝对路径）：
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-hero-ability-cards-e2e\samurai-honor-clamp-after-play.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-hero-ability-cards-e2e\samurai-shame-clamp-after-play.png`
  - 专项 evidence：`evidence/dicethrone/dicethrone-samurai-token-clamp-real-hand-e2e-2026-06-05.md`
  - 命令：`npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "online ninja knife fan should not open samurai retribution response window on direct damage"`
  - 关键截图（成功链路，绝对路径）：
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\online-ninja-knife-fan-should-not-open-samurai-retribution-response-window-on-direct-damage\32-online-ninja-knife-fan-before-play.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\online-ninja-knife-fan-should-not-open-samurai-retribution-response-window-on-direct-damage\33-online-samurai-no-back-strike-on-direct-damage.png`
  - 专项 evidence：`evidence/dicethrone/dicethrone-samurai-direct-damage-no-back-strike-e2e-2026-06-05.md`
- 2026-05-19 本轮新增动态回归（代码级复验，不冒充 E2E）：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/cross-hero.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "stand-tall fully prevents the attack without opening back-strike mitigation window"`，`1 passed`
    - 结论：`Stand Tall` 完全格挡 6 点攻击时，`shouldOpenTokenResponse` 现已读取“护盾后有效伤害 0”，不会再错误打出 `defenderMitigation / Back Strike` 响应窗。
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/cross-hero.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "stand-tall reflects 1 and prevents 3 on defense"`，`1 passed`
    - 结论：基础版 `Stand Tall` 的“反伤 1 + 抵挡 3”既有正向链路仍成立，没有因为本次开窗门禁修补而退化。
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/token-execution.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "direct damage 不应打开 defenderMitigation"`，`1 passed`
    - 结论：`Back Strike` 的 attack-only / direct-damage 负路径仍保持成立，本次修补没有把 `damageScope` 门禁打坏。
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/gunslinger-take-cover-loaded-vs-stand-tall.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`，`1 passed`
    - 结论：`Stand Tall` 与枪手 Loaded 奖励骰叠加时，护盾后剩余 1 点伤害仍能正常落地，没有被本次门禁修补吞成 0。
- 既有历史 E2E / 截图证据（本轮未复跑，仅引用）：
  - `evidence/dicethrone/dicethrone-new-passives-e2e-test-2026-04-06.md`（`Bushido` 开局 / 回合末真实 UI）
  - `evidence/dicethrone/dicethrone-gunslinger-samurai-4p-targeted-cards-e2e-test.md`（`You Should Be Ashamed` 4P 真点击选敌与结算）
  - `evidence/dicethrone/dicethrone-hero-ability-cards-e2e-test.md`（`Stand Tall II` / `Masamune II` 的既有成功链路）

## 本轮补审 / 进度记录（2026-04-12）
1. **新增统一“四问”核对，不再只写 D8 总评**
   - 把 `Bushido`、token 响应、`You Should Be Ashamed`、`Stand Tall`、`Masamune/Righteousness/Zanshin` 全部按“触发点 / 结算窗口 / 写入可消费性 / 收口后推进”四问重查，避免继续把“静态看起来像对”直接写成“时序已完成”。
2. **区分 `Stand Tall II` 已有证据与基础版 `Stand Tall` 新风险**
   - 旧文把“`Stand Tall II` 的否定路径”与“基础版 `Stand Tall` 的防御减伤同步风险”混写在一起，导致问题边界不清。
   - 本轮改为：**`Stand Tall II` 继续引用既有成功链路；真正新增并仍待复验的风险改为基础版 `Stand Tall` 的减伤同步时序。**
3. **把“历史有证据”和“本轮已复跑”彻底拆开**
   - 旧文验证段落写有“本轮已复跑 DiceThrone 单测”“本轮已复跑并通过”等口径，但未能对应实际执行产物。
   - 本轮改为：**只有 `Righteousness!` / `Zanshin!` 两条 E2E 明确绑定到命令与截图路径；其余保持历史 / 静态证据引用，不冒充本轮动态验证**。
4. **细化武士 E2E 覆盖缺口，不再笼统写“武士线缺关键 E2E”**
   - 既有历史 E2E 已覆盖：`Bushido`、`Honor`、`Back Strike`、`You Should Be Ashamed`，以及 `Stand Tall II` / `Masamune II` 的既有成功链路。
   - 后续新增确认复跑：`Righteousness!`、`Zanshin!`、`Honor / Shame` clamp、`Back Strike` 非攻击 `direct damage` 负路径。
   - 当前对象级主证据缺口已清空；剩余只保留四英雄批次级 `L4` 治理与旧文档统一回写。
5. **回写规则证据口径冲突**（已修复并回写）
   - 旧问题：规则文档残留“堆叠上限 OCR 不稳定/不影响闭环”的表述，会误导审计与实现边界。
   - 本轮已回写：`src/games/dicethrone/rule/武士真相源表.md` 与 `武士录入核对.md` 均已改为“已肉眼确认堆叠限制 2/2/1”，并要求实现侧尊重该上限。
6. **补记两条此前未显式登记的审计焦点**
   - `Stand Tall` 的真正风险点是“防御减伤是否同步进后续伤害 / 响应窗口判断”，而不是仅仅看技能描述是否像对。
   - `Back Strike` 必须显式审 attack-only 语义；当前不仅有 `requiresAttackDamage` + `damageScope` 静态门禁，也已补齐 `Knife Fan` 非攻击 `direct damage` 真实在线负路径，因此该焦点当前转为“审计方法补强项”，不再是对象级残余。

## 旧结论失效与修复回写
1. **`Stand Tall` 不可防御语义**（旧结论失效，运行时已修复）
   - 当前事实：`handleStandTall` 生成的 `DAMAGE_DEALT` 事件已显式写入 `payload.unblockable = true`。
   - 证据：`src/games/dicethrone/domain/customActions/samurai.ts:134-148`。
2. **`samurai-stand-tall*` metadata 漏 `damage`**（旧结论失效，运行时已修复）
   - 当前事实：`samurai-stand-tall` / `samurai-stand-tall-2` 的 `categories` 已包含 `damage`。
   - 证据：`src/games/dicethrone/domain/customActions/samurai.ts:406-413`。
3. **`Honor` tooltip 不完整 / `Shame` 仅单层消费**（旧结论失效，运行时已修复）
   - 当前事实：`Honor` 已支持 `1 -> +1 / 2 -> +3`；`Shame` 已支持按层数消耗并逐层减伤。
   - 证据：`src/games/dicethrone/heroes/samurai/tokens.ts:11-54`、`public/locales/zh-CN/game-dicethrone.json:244-259`、`public/locales/en/game-dicethrone.json:245-260`。
4. **“武士验证已在本轮复跑”**（旧结论曾缺证据，本轮已补齐）
   - 旧问题：此前文档口径与实际执行产物不绑定，容易把“历史可复查证据”误写成“本轮已复跑”。
   - 新结论：本轮只新增确认 2 条 E2E 复跑——`Righteousness!` 与 `Zanshin!`（见本文件“验证证据”段落的命令与截图路径）；其余一律按历史 / 静态引用处理。
5. **`Stand Tall II` 动态证据缺口**（已补齐成功链路）
   - 当前事实：`Stand Tall II` 的“4 骰防御 & 无盾不自加 Shame”已补 E2E 成功链路证据，见 `evidence/dicethrone/dicethrone-hero-ability-cards-e2e-test.md` §9。
   - 因此不再将其作为角色级“缺关键动态证据”的残余重复登记。
6. **`samurai_retribution` / `Honor` / `Shame` 堆叠上限被旧审计低估**（旧结论失效，当前已补齐对象级 L3）
   - 旧问题：此前把 `tip.webp` 的堆叠上限写成“OCR 不稳定 / 不影响闭环”，属于 D1 / D43 过宽结论。
   - 当前事实：真相源已可肉眼确认 `shame=2`、`honor=2`、`retribution=1`，并已在 `src/games/dicethrone/heroes/samurai/tokens.ts` 落地对应 `stackLimit`。
   - 新证据：`evidence/dicethrone/dicethrone-samurai-token-clamp-real-hand-e2e-2026-06-05.md` 与 `evidence/dicethrone/dicethrone-samurai-token-response-e2e-test.md` / `Zanshin` 真实 E2E。
   - 新结论：`Honor / Shame / samurai_retribution` 的上限语义已全部具备对象级 `L3 clamp` 证据，不再把“token 上限最终态”列为武士残余。
7. **`Stand Tall` 防御减伤未同步进后续伤害判断**（旧风险已坐实并修复）
   - 旧风险：旧审计一度把问题简化成“`attack.ts` 是否同步 `DAMAGE_SHIELD_GRANTED`”；但本轮补审发现，即便护盾已同步进状态，只要 `effects.ts` 里的 token 开窗判定仍看护盾前伤害，`Back Strike` 依然会在完全格挡时误开响应窗。
   - 当前事实：`src/games/dicethrone/domain/effects.ts` 已新增“既有护盾吸收后的有效伤害”估算，只用于 `shouldOpenTokenResponse` 的 gating；真正的扣盾/扣血仍留给 reducer，避免双重结算。
   - 新证据：`src/games/dicethrone/__tests__/cross-hero.test.ts` 中的 `stand-tall fully prevents the attack without opening back-strike mitigation window`、`stand-tall reflects 1 and prevents 3 on defense`，以及 `src/games/dicethrone/__tests__/gunslinger-take-cover-loaded-vs-stand-tall.test.ts`。
8. **`Back Strike` 未限制“仅攻击伤害”**（旧风险已修复，当前已补齐专属负路径证据）
   - 旧风险：旧审计没有把 attack-only 门禁作为显式 finding，`tokenResponse` 若只按 timing / 持有量判断，容易把 `Back Strike` 与普通受伤 token 混审。
   - 当前事实：`samurai_retribution` 已在 token 定义中标注 `requiresAttackDamage`，token 响应侧也已加入 `damageScope` 过滤。
   - 新证据：`src/games/dicethrone/heroes/samurai/tokens.ts`、`src/games/dicethrone/domain/tokenResponse.ts`、`evidence/dicethrone/dicethrone-samurai-direct-damage-no-back-strike-e2e-2026-06-05.md`。
   - 新结论：`Back Strike` 的 attack-only 语义现已具备静态门禁、L2 断言与真实在线 `L3` 负路径，不再把该对象级证据缺口列为残余。

## 未覆盖风险 / 待确认
1. **组合场景回归不足**：`Honor + Shame + Back Strike` 同回合叠加、多人局与防御时序叠加，本轮仍未新增代表性组合验证。
2. **批次级 L4 治理仍未完成**：武士对象级主证据缺口虽已清空，但四英雄总补审仍需继续处理跨英雄判等矩阵、旧文档统一回写与最终发布口径统一。

## D1–D49 全量审计表（2026-04-12 补审回写）
- **D1 语义保真**：✅ 角色板能力、升级卡、攻击修正卡、提示板 token 主语义已对齐；本轮补记了此前漏审的 token 堆叠上限与 `Back Strike` attack-only 语义。
- **D2 边界完整**：✅ `Stand Tall`（基础版）的“完全格挡不应再开 `Back Strike` 响应窗”已由动态回归坐实并修复；`Back Strike` 对非攻击 `direct damage` 不开窗也已有真实在线 `L3` 证据。当前剩余只落在批次级 `L4` 治理，而不是武士对象级边界缺口。
- **D3 数据流闭环**：✅ 真相源 → abilities/cards/tokens/customActions → locales → 测试 / evidence 路径已闭环；`Stand Tall` 的防御减伤同步、token 上限终态与 `Back Strike` 负路径都已补到对象级证据。
- **D4 查询一致性**：✅ 未发现应走统一查询入口的动态数值被直接绕过读取。
- **D5 交互完整**：✅ `You Should Be Ashamed`、`Honor`、`Back Strike` 均已有真实交互证据；其中 `Back Strike` 的 attack-only 也已补齐“非攻击 `direct damage` 不开窗”的专属动态负路径。
- **D6 副作用传播**：✅ `Honor` / `Shame` / `Back Strike` 均能进入既有伤害与 token 结算链。
- **D7 资源守恒**：✅ `Honor` / `Shame` / `Back Strike` 的堆叠上限与消耗规则已与真相源对齐；`Honor / Shame / samurai_retribution` 均已有对象级 `L3 clamp` 证据。
- **D8 时序正确**：✅ `Bushido`、`Honor`、`Back Strike`、`You Should Be Ashamed` 有静态 + 历史链路证据；`Righteousness!` / `Zanshin!` 已在 2026-04-12 真实复跑 E2E 中补齐“特写出现 → 文案可见 → 关闭收口”；`Stand Tall`（基础版）“完全格挡不再开窗”与 `Back Strike` attack-only 的 `direct damage` 负路径也都已补齐对象级证据。
- **D9 幂等与重入**：⚠️ 未做“重复进入防御交互 / 重复消费 Back Strike / 连续打开奖励骰结算”的专项回归，本轮只看到单次链路正确。
- **D10 元数据一致**：✅ `samurai-stand-tall*` 已声明 `damage`；未发现“输出 `DAMAGE_DEALT` 但 `categories` 不含 `damage`”的现存问题。
- **D11 Reducer 消耗路径**：✅ `Honor` / `Shame` / `Back Strike` 均通过 token activeUse 进入正确的消耗路径。
- **D12 写入-消耗对称**：✅ 授予 `Honor` / `Shame` / `Back Strike` 的路径都能被后续消费链读取。
- **D13 多来源竞争**：⚠️ 多来源同时授予 `Honor` / `Shame` / `Back Strike` 的组合场景未做专项复验。
- **D14 回合清理完整**：✅ `Bushido` 历史 E2E 已说明 `TURN_CHANGED` 后攻掷计数被清空；未发现武士专属临时字段跨回合泄漏。
- **D15 UI 状态同步**：✅ `Righteousness!` / `Zanshin!` 已在 2026-04-12 真实复跑中补齐成功链路；`Stand Tall II` 与 `Masamune II` 的既有成功链路仍可引用 `dicethrone-hero-ability-cards-e2e-test.md` §9、§10；`Honor / Shame` 上限终态与 `Back Strike` 非攻击 `direct damage` 负路径也已补齐专属截图链。
- **D16 条件优先级**：✅ `Stand Tall` 中“先反伤、再减伤、最后按条件自加 Shame”的分支顺序与描述一致。
- **D17 隐式依赖**：⚠️ `Stand Tall` / `Back Strike` 依赖 defensiveRoll 上下文中的 attacker/defender 角色约定；静态看已处理，缺少组合回归进一步压实。
- **D18 否定路径**：⚠️ 已有 `Bushido`“恰好 3 次攻掷不再加 Honor”、`You Should Be Ashamed` 不选队友等否定路径；`Stand Tall II`“无盾也不自加 Shame”已补 E2E 成功链路（见 `dicethrone-hero-ability-cards-e2e-test.md` §9）。
- **D19 组合场景**：⚠️ `Honor + Shame` 对冲、`Back Strike + 防御减伤` 等组合场景本轮未复验。
- **D20 状态可观测性**：✅ `Righteousness!` / `Zanshin!` 已通过复跑补齐“可见性 + 收口”截图链；`Masamune II` 可继续引用既有 6 骰特写闭环；`Honor / Shame` 上限终态与 `Back Strike` 非攻击负路径也都已具备专属真实业务链。
- **D21 触发频率门控**：✅ `Bushido` 起手与回合末触发都有明确门控；`Back Strike` 以单个 token 主动消费，不存在一枚多次触发的静态迹象。
- **D22 伤害计算管线配置**：✅ `Stand Tall` / `Back Strike` 都通过 `createDamageCalculation` 生成伤害事件，`Stand Tall` 额外显式标记 `unblockable`。
- **D23 架构假设一致性**：✅ 武士的“防御反伤 + token 反弹”仍落在 customAction + damage pipeline 合同内，没有继续回落到旁路特判。
- **D24 Handler 共返状态一致性**：N/A（未发现同时返回 `events + interaction` 且依赖 reduce 后新状态计算后续选项的武士 handler）。
- **D25 MatchState 传播完整性**：N/A（武士 custom action 未依赖 `matchState` 透传）。
- **D26 事件设计完整性**：✅ `Masamune` / `Righteousness` / `Back Strike` 的事件都携带了结算所需的 face / target / source 信息。
- **D27 可选参数语义**：✅ `samurai-masamune` 的 `diceCount` 可选参数有默认值 `5`，升级变体再显式覆盖为 `6`。
- **D28 白名单 / 黑名单完整性**：N/A（本轮未命中相关白名单 / 黑名单机制）。
- **D29 PPSE 事件替换完整性**：N/A。
- **D30 消灭流程时序与白名单**：N/A。
- **D31 效果拦截路径完整性**：N/A。
- **D32 替代路径后处理对齐**：N/A。
- **D33 跨实体同类能力一致性**：✅ 武士复合升级卡继续遵守“升级卡 → 基础技能”的成熟旧对象合同，没有把下半区变体拆成独立手牌。
- **D34 交互选项 UI 渲染模式正确性**：✅ `You Should Be Ashamed` 使用 `selectPlayer` 交互，四人队伍模式敌我过滤已有状态级 + 历史真实点击证据。
- **D35 交互上下文快照完整性**：N/A。
- **D35.1 多系统命令门控职责清晰**：N/A。
- **D36 延迟事件补发健壮性**：N/A。
- **D37 交互选项动态刷新完整性**：N/A（未命中动态刷新型多步交互）。
- **D38 UI 门控系统优先级冲突**：⚠️ 缺少武士专属 UI 门控 / 浮层冲突复核；当前只能引用历史通过截图。
- **D39 流程控制标志清除完整性**：N/A。
- **D40 后处理循环事件去重完整性**：N/A。
- **D41 系统职责重叠检测**：✅ 本轮未见武士实现继续走旧旁路特判。
- **D42 事件流全链路审计**：⚠️ 仓库中已有多份历史 E2E / 截图证据；本轮已新增 `Stand Tall II` / `Masamune II` 的 UI 成功链路证据，但尚未补“UI → eventStream”的专项截图/断言。
- **D43 重构完整性检查**：✅ 运行时代码侧本轮未见新的结构残缺；旧审计对 token 上限与 `Back Strike` attack-only 的过宽结论已通过对象级 `L3` 证据与正文回写纠偏。
- **D44 测试设计反模式检测**：✅ 当前武士证据以状态级 / E2E 混合承担；本轮已补基础版 `Stand Tall` 的对位回归用例，能直接卡住“完全格挡仍误开 `Back Strike` 响应窗”的共享回归。
- **D45 Pipeline 多阶段调用去重**：N/A。
- **D46 交互选项 UI 渲染模式声明完整性**：N/A。
- **D47 E2E 覆盖完整性**：⚠️ `Righteousness!` / `Zanshin!`、`Honor / Shame` clamp、`Back Strike` 非攻击 `direct damage` 负路径都已有对象级真实 E2E；当前未完成项只剩组合场景与四英雄批次级 `L4` 治理，不再是武士对象级 E2E 缺口。
- **D48 UI 交互渲染模式完整性**：N/A。
- **D49 abilityTags 与触发机制一致性**：N/A（DiceThrone 此处不依赖 `abilityTags` 作为核心合同）。

## 维度复核（本轮新增 / 修订焦点）
- `Bushido` 开局与回合末双时点：D8 / D14 / D21
- `Honor` / `Shame` / `Back Strike` token 响应窗口：D7 / D8 / D11 / D12 / D15
- `You Should Be Ashamed` 多人局选敌与 resolve 收口：D5 / D8 / D18 / D34
- `Stand Tall` 共享 bug 已由动态回归闭环，不再列入当前主 residual：D2 / D8 / D23 / D44
- `Honor / Shame / Back Strike` 上限与 attack-only 门禁已补齐对象级证据；后续只随四英雄总补审处理组合/L4 治理：D1 / D2 / D7 / D43

## 修订记录
- 2026-04-11：初版审计文档归档，把多项对象误记为“✅ 一致”。
- 2026-04-11（晚）：补审后确认旧结论失效，并补入先前未覆盖维度项：`Stand Tall` 不可防御语义未实现、`Stand Tall` metadata 漏 `damage`、`Honor/Shame` tooltip 与规则不一致、`Shame` 单层消费未收口、`反击` 堆叠上限未闭环等问题（该上限问题已于 2026-04-12 修复）。
- 2026-04-12（早些时候）：代码侧已补齐 `Stand Tall` 的 `unblockable` 与 categories、`Honor/Shame` locale 与 token 规则。
- 2026-04-12（本轮补审）：
  - 新增通用“时机正确性语义核对（四问）”小节，逐条回看 `Bushido`、token 响应、选敌交互、防御技、奖励骰结算。
  - 撤销“本轮大范围已复跑”的过宽口径，改为：只有 `Righteousness!` / `Zanshin!` 两条 E2E 绑定到本轮命令与截图，其余明确标注为历史 / 静态引用。
  - 改写 `Stand Tall` 相关口径：`Stand Tall II` 继续引用既有成功链路；基础版 `Stand Tall` 单独登记为“减伤同步时序仍需动态复验”。
  - 回写此前漏审的 3 条焦点：token 堆叠上限、`Stand Tall` 防御减伤同步、`Back Strike` attack-only 门禁。
  - 把武士 E2E 覆盖范围拆细为“本轮新复跑”“可继续引用的历史链路”“仍待补的专属链路”，避免继续笼统表述。
- 2026-05-19（`Stand Tall` / `Back Strike` 共享 bug 回写）：
  - 旧结论：`Stand Tall` 的防御减伤同步“已修复，待动态复验”。
  - 失效原因：这条口径只盯住了 `attack.ts` 是否把 `DAMAGE_SHIELD_GRANTED` 同步进状态，漏掉了 `effects.ts` 在 token 开窗门禁上仍读取护盾前伤害，导致 `Stand Tall` 完全格挡时依旧误开 `Back Strike`。
  - 新证据路径：`src/games/dicethrone/__tests__/cross-hero.test.ts` 新增 `stand-tall fully prevents the attack without opening back-strike mitigation window`，以及 `src/games/dicethrone/__tests__/gunslinger-take-cover-loaded-vs-stand-tall.test.ts`。
  - 新结论：这条风险已被动态回归坐实并修复；当时口径曾把残余下调为“基础版 `Stand Tall` 仍缺专属 UI 连续截图链”，该口径已在 2026-06-05 进一步失效并继续收缩。
- 2026-06-05（武士 residual 收缩回写）：
  - 旧结论：武士残余仍包含“基础版 `Stand Tall` 专属截图链”与“`Back Strike` attack-only 仅有静态门禁”。
  - 失效原因：现有证据已明确包含 `Stand Tall` 的共享回归、`samurai_retribution` 超上限 clamp 的 L2 断言，以及 `Back Strike` 对非攻击 `direct damage` 不开窗的 L2 负路径断言；旧主审计没有把这些新旧证据合并回当前 residual 口径。
  - 新证据路径：`src/games/dicethrone/__tests__/cross-hero.test.ts:2498-2514`、`src/games/dicethrone/__tests__/token-execution.test.ts:1326-1336`
  - 新结论：当前武士主残余收敛为 `honor / shame` 溢出 clamp 的专属 L3 终态，以及 `Back Strike` 非攻击 `direct damage` 的专属真实业务链 L3；`samurai_retribution` clamp 与 `Stand Tall` 都不再列为当前主 residual。
- 2026-06-05（武士对象级 residual 清零回写）：
  - 旧结论：武士仍保留 `honor / shame` 溢出 clamp 终态与 `Back Strike` 非攻击 `direct damage` 不开窗两条对象级证据缺口。
  - 失效原因：`dicethrone-samurai-token-clamp-real-hand-e2e-2026-06-05.md` 已补齐 `Honor / Shame` 的真实主阶段手牌 `L3 clamp`；`dicethrone-samurai-direct-damage-no-back-strike-e2e-2026-06-05.md` 已补齐 `Knife Fan` 真实在线双页负路径 `L3`。
  - 新证据路径：`evidence/dicethrone/dicethrone-samurai-token-clamp-real-hand-e2e-2026-06-05.md`、`evidence/dicethrone/dicethrone-samurai-direct-damage-no-back-strike-e2e-2026-06-05.md`
  - 新结论：武士当前不再单列对象级 residual；若仍有未完成项，只能落在四英雄批次级 `L4` 治理、旧文档统一回写与最终发布口径统一。
