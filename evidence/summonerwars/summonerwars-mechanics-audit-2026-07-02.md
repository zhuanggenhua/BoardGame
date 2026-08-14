# 召唤师战争机制全面审计启动记录（2026-07-02）

> 当前状态说明（2026-07-03 / C91）：本文前半部分保留 2026-07-02 审计启动和分批推进时的历史过程，早期“仍缺 / 未完成 / 下一步 / 仍为 disputed”表述不代表最新状态。继续任务时先看最新第 143-156 节、`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md`、各批次 `implementation-diff` 矩阵和 `temp/summonerwars-audit/continuation-task-state.json` 的 C91。C85 已修正 C80/C84 的来源越权口径；C86 进一步修正“审计必须回卡图/回录入层”的错误口径；C89 纠正“像是数据没录入”的错误表达；C90 明确中文录入优先中文汇报；C91 明确原文列必须填逐字原文，找不到就写“未找到原文记录”，不得用状态句顶替。

## 1. 基本信息

- 对象：召唤师战争卡牌 / 技能 / 自动触发 / 交互链机制
- 日期：2026-07-02
- 文档类型：`audit`
- 关联任务：用户要求按更新后的审计规范补审；不确定项以卡图为主

## 2. 审计范围

- 本轮覆盖文件：
  - `src/games/summonerwars/domain/abilities*.ts`
  - `src/games/summonerwars/domain/abilityResolver.ts`
  - `src/games/summonerwars/__tests__/abilities-*.test.ts`
  - `temp/summonerwars-audit/ability-risk-matrix.md`
- 本轮已建立矩阵：
  - 能力定义数：68
  - 卡牌能力挂载数：72
  - 初始高风险能力数：60
- 本轮已深审对象：
  - 雌狮「威势」（`intimidate`）
  - 贾穆德「威势」（`imposing`）
  - 城塞圣武士「裁决」（`judgment`）
  - 瑟拉·艾德温「城塞之力」（`fortress_power`）
- 明确不在本轮已收口范围内的对象：
  - 其余高风险能力仍处于待卡图逐项核对状态。
  - `rapid_fire`、`withdraw`、`high_telekinesis`、`mind_transmission`、`telekinesis` 已列为下一批 afterAttack/交互链重点，但本文件不宣称它们已通过。

## 3. 结论等级

- 结论等级：`仍有残余范围`
- 判定理由：
  - 本轮已经按新规范启动全量矩阵和第一批高风险深审。
  - 第一批发现的同类风险集中在“攻击后 enemy unit 与代码里普通 target 条件不一致”和“自动触发 usesPerTurn 记账”。
  - 当前只完成 4 个对象的卡图对照和回归测试，不能宣称召唤师战争全面审计完成。

## 4. 权威来源

- 主真相源：清晰卡图 / 官方卡图截图。
- 对照源：实现代码、测试、中文 i18n 文案、旧测试。
- 强制口径：
  - i18n、AbilityDef 描述、代码注释和旧测试只能用于定位候选对象，不作为规则真相源。
  - 若实现描述、网页文本、i18n 或旧测试与清晰卡图冲突，以卡图为准。

### 4.1 图片合同表

| visualRegion / slotId | 图上对象 | 运行时对象 | 允许状态 | 是否可交互 | 结论 |
| --- | --- | --- | --- | --- | --- |
| `lioness-text-crop` | 雌狮「Momentum」：Once per turn, after this unit attacks an enemy unit, boost this unit. | `intimidate` | 攻击敌方单位后；每回合一次；给自己充能 | 否，自动结算 | 已按卡图锁定 |
| `jarmund-text-crop` | 贾穆德「Momentum」：Once per turn, after this unit attacks an enemy unit, boost this unit. | `imposing` | 攻击敌方单位后；每回合一次；给自己充能 | 否，自动结算 | 已按卡图锁定 |
| `citadel_paladin-text-crop` | 城塞圣武士「Intercession」：After this unit attacks an enemy unit, draw cards equal to rolled special icons. | `judgment` | 攻击敌方单位后；按特殊符号抓牌；无 once per turn | 否，自动触发后抓牌 | 已按卡图锁定 |
| `sera_eldwyn-text-crop` | 瑟拉·艾德温「Intercession」：Once per turn, after this unit attacks an enemy unit, if you control Citadel units, retrieve a Citadel unit from discard. | `fortress_power` | 攻击敌方单位后；每回合一次；满足城塞单位条件后从弃牌堆拿城塞单位 | 是，需要后续选牌 | 已按卡图锁定 |

图片证据路径：

- `D:\gongzuo\webgame\BoardGame\temp\summonerwars-card-authority\lioness-text-crop.jpg`
- `D:\gongzuo\webgame\BoardGame\temp\summonerwars-card-authority\jarmund-text-crop.jpg`
- `D:\gongzuo\webgame\BoardGame\temp\summonerwars-card-authority\citadel_paladin-text-crop.jpg`
- `D:\gongzuo\webgame\BoardGame\temp\summonerwars-card-authority\sera_eldwyn-text-crop.jpg`

## 5. 逐项结论

| 对象 | 规则子句 | 实现入口 | 共享链路 / 复用依据 | 命中维度 | 证据层级 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 雌狮「威势」（`intimidate`） | C1 攻击后；C2 目标必须是敌方单位；C3 每回合一次；C4 给自己充能 | `abilities-barbaric.ts` `abilityResolver.ts` | 自动 afterAttack 直接结算；共享 `ABILITY_TRIGGERED` 记账 | D1/D5/D10/D15 | L1/L2 | 已修正并回归 |
| 贾穆德「威势」（`imposing`） | C1 攻击后；C2 目标必须是敌方单位；C3 每回合一次；C4 给自己充能 | `abilities-frost.ts` `abilityResolver.ts` | 自动 afterAttack 直接结算；共享 `ABILITY_TRIGGERED` 记账 | D1/D5/D10/D15 | L1/L2 | 已修正并回归 |
| 城塞圣武士「裁决」（`judgment`） | C1 攻击后；C2 目标必须是敌方单位；C3 按特殊符号抓牌；C4 卡图无每回合一次 | `abilities-paladin.ts` `abilities-paladin-new.test.ts` | afterAttack custom 立即抓牌 | D1/D5/D10 | L1/L2 | 已修正并回归 |
| 瑟拉·艾德温「城塞之力」（`fortress_power`） | C1 每回合一次；C2 攻击敌方单位后；C3 控制至少 1 个城塞单位；C4 从弃牌堆拿城塞单位 | `abilities-paladin.ts` `abilities-paladin.test.ts` | afterAttack 通知后进入选牌结算 | D1/D5/D8/D10/D15 | L1/L2 | 已补回归测试；实现条件需随同提交确认 |

### 5.0 语义门禁快照

| 对象 | 承接语义 | 触发时机 | 效果宿主 | 作用范围 | 触发后清理 | 不应发生什么 | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 雌狮「威势」 | 被动自动触发 | 自身完成一次对敌方单位的攻击后 | 雌狮自己 | 本单位本回合一次 | `abilityUsageCount` 写入后阻止第二次 | 不应因攻击建筑触发；不应在额外攻击中重复充能 | 通过 L2 |
| 贾穆德「威势」 | 被动自动触发 | 自身完成一次对敌方单位的攻击后 | 贾穆德自己 | 本单位本回合一次 | `abilityUsageCount` 写入后阻止第二次 | 不应因攻击建筑触发；不应在额外攻击中重复充能 | 通过 L2 |
| 城塞圣武士「裁决」 | 被动自动触发 | 自身完成一次对敌方单位的攻击后 | 城塞圣武士所属玩家手牌 | 每次满足条件的攻击后 | 无每回合次数上限 | 不应因攻击建筑触发；不应被错误限制为每回合一次 | 通过 L2 |
| 瑟拉·艾德温「城塞之力」 | 攻击后触发 + 后续选牌 | 自身完成一次对敌方单位的攻击后 | 瑟拉所属玩家弃牌堆/手牌 | 本单位本回合一次，且需要控制城塞单位 | 后续选牌结算后完成 | 不应因攻击建筑打开能力通知 | 通过 L2 切片，仍需继续核对完整选牌入口 |

### 5.0.1 窗口与来源归属快照

| 对象 | 玩家看到的入口/提示 | 真实结算窗口 | 来源归属 | 共享消费者 | 易混淆对象 | 负向断言 | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 雌狮「威势」 | 充能特效/日志 | 攻击结算后 | 技能由雌狮持有，充能落在雌狮 | 自动效果解析 + 使用次数 reducer | 贾穆德「威势」 | 缺少敌方单位目标时不应生效 | 通过 |
| 贾穆德「威势」 | 充能特效/日志 | 攻击结算后 | 技能由贾穆德持有，充能落在贾穆德 | 自动效果解析 + 使用次数 reducer | 雌狮「威势」 | 缺少敌方单位目标时不应生效 | 通过 |
| 城塞圣武士「裁决」 | 抓牌日志/能力触发 | 攻击结算后 | 技能由城塞圣武士持有，牌进入其控制者手牌 | custom 抓牌消费者 | 瑟拉·艾德温「城塞之力」 | 不应借 once-per-turn 家族误加次数限制 | 通过 |
| 瑟拉·艾德温「城塞之力」 | 能力触发提示 + 选弃牌堆城塞单位 | 攻击结算后进入选牌 | 技能由瑟拉持有，候选来自其控制者弃牌堆 | custom 选牌消费者 | 城塞圣武士「裁决」 | 攻击建筑不应打开后续选牌 | 通过 L2 切片 |

## 6. 验证证据

### L1 结构证据

- 命令：
  - `Get-Content` / `Select-String` 定位 `abilities-*.ts`、`abilityResolver.ts`、相关测试。
  - 生成矩阵：`temp/summonerwars-audit/ability-matrix.json`、`ability-risk-matrix.json`、`ability-risk-matrix.md`、`ability-test-coverage.json`。
- 结果：
  - 已列出 68 个能力定义、72 个卡牌能力挂载、60 个初始高风险能力。
  - 已把 afterAttack、usesPerTurn、custom、targetSelection、charge/resource 改写列为高风险维度。
- 结论：
  - 全量审计入口已经建立，但还没有完成所有对象的卡图深审。

### L2 领域行为证据

- 聚焦命令：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-paladin.test.ts --configLoader native --testNamePattern "城塞之力|fortress_power"`
  - 结果：1 个测试文件通过，5 个相关测试通过，28 个跳过。
- 回归切片命令：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-paladin.test.ts src/games/summonerwars/__tests__/abilities-paladin-new.test.ts src/games/summonerwars/__tests__/abilities-barbaric.test.ts src/games/summonerwars/__tests__/abilities-frost.test.ts --configLoader native --testNamePattern "城塞之力|fortress_power|威势|imposing|裁决|judgment|usesPerTurn"`
  - 结果：4 个测试文件通过，16 个相关测试通过，140 个跳过。
- 结论：
  - 第一批 4 个对象的领域级正负路径已覆盖。
  - 该测试结果不代表剩余 56 个高风险对象已完成审计。

### L3 真实玩法证据

- 当前状态：未完成。
- 原因：
  - 本轮先做卡图真相源 + 领域规则回归。
  - 涉及 UI 选牌、攻击后交互链、AI/在线重复触发的对象仍需要真实入口或 E2E 证据。

### L4 治理证据

- 当前状态：未完成。
- 残余范围：
  - 仍需逐项把 afterAttack/usesPerTurn/custom/targetSelection 族对象补到卡图子句矩阵。
  - 仍需把旧 evidence 中可能误导的旧结论改口，避免“测试里出现 id”被误当成机制审计完成。

## 7. 禁止假阳性检查

- 是否误用“测试里出现 id / registerAbility 覆盖”充当行为完整：是，旧覆盖矩阵只能证明测试命中过名字，不能证明子句一致；本轮已降级。
- 是否误用 i18n / AbilityDef 描述作为权威规则：本轮禁止；只作为候选定位。
- 是否只证明 prompt 出现、未证明最终权威状态变化：瑟拉·艾德温「城塞之力」当前补了触发/不触发切片，但完整选牌收口仍需继续补真实入口证据。
- 是否把止血当修复：本轮没有用显示上限或吞事件作为修复口径；充能点显示溢出若后续处理，只能称为显示保护，不是机制根因修复。

## 8. 共享根因与残余范围

- 共享根因项：
  - 攻击后能力的“enemy unit”在实现里容易被简化成“目标归属为敌方”，从而把建筑也当成合法触发目标。
  - 自动直接结算的 `usesPerTurn` 与需要后续确认的 custom 交互，必须分开记账；否则会出现每回合一次能力未真正消耗次数的风险。
- 对象级局部问题：
  - 第一批已覆盖 4 个对象。
- 未审家族 / 未覆盖交互链：
  - `rapid_fire`、`withdraw`、`high_telekinesis`、`mind_transmission`、`telekinesis`
  - 其他 `activated + usesPerTurn + custom` 能力
  - 事件卡与内部结算定义，例如 `ice_ram`、`mind_capture_resolve`
- 当前不能宣称整体收口的原因：
  - 高风险对象仍有 50+ 个未逐卡图拆子句。
  - 真实玩法 L3 和治理 L4 尚未完成。

## 9. 修订 / 失效记录

- 旧结论：
  - “高风险未直接命中测试数为 0”不能继续被解释为语义审计完成。
- 失效原因：
  - 直接按 ability id 搜测试只证明名字出现，不证明卡图子句、目标类型、触发次数、后续交互链全部正确。
- 替代旧结论的新证据：
  - `D:\gongzuo\webgame\BoardGame\temp\summonerwars-audit\ability-risk-matrix.md`
  - `D:\gongzuo\webgame\BoardGame\temp\summonerwars-card-authority\*.jpg`
  - 相关 Vitest 切片通过记录见本文 L2。
- 新结论：
  - 全面审计已启动；第一批高风险对象已完成 L1/L2；整体仍有残余范围。

## 10. 对外汇报口径

- 允许说：
  - “召唤师战争全面机制审计已启动。”
  - “已建立 68 个能力定义、72 个挂载、60 个高风险能力的矩阵。”
  - “第一批 afterAttack/usesPerTurn 对象已按卡图核对并补 L2 回归。”
  - “不确定项以卡图为主；未拿到卡图的对象不直接改。”
- 禁止说：
  - “召唤师战争已全面审计完成。”
  - “所有高风险技能都已通过。”
  - “测试命中 ability id 就代表该技能符合卡图。”
  - “充能点显示不溢出就代表堆叠根因修好了。”


## 11. 第二批补审启动记录

### 11.1 范围

| 对象 | 规则真相源状态 | 当前实现候选入口 | 当前处理结论 |
| --- | --- | --- | --- |
| 梅肯达·露 / 边境弓箭手「准备」（`prepare`） | 卡图已压缩读取，但规则全文未逐字锁定 | `abilities-barbaric.ts:109`，主动移动阶段，消耗移动动作并给自己充能 | 未锁定，不改机制代码 |
| 梅肯达·露 / 边境弓箭手「连续射击」（`rapid_fire`） | 卡图已压缩读取，但 afterAttack、次数、成本与效果子句未逐字锁定 | `abilities-barbaric.ts:140`，攻击后，每回合 1，消耗充能给额外攻击 | 未锁定，不改机制代码 |
| 凯鲁尊者「鼓舞」（`inspire`） | 卡图已压缩读取，但主动时机、目标范围和次数未逐字锁定 | `abilities-barbaric.ts:165`，移动阶段，给相邻友军充能 | 未锁定，不改机制代码 |
| 凯鲁尊者「撤退」（`withdraw`） | 卡图已压缩读取，但攻击后窗口、成本类型、推拉目标未逐字锁定 | `abilities-barbaric.ts:186`，攻击后，每回合 1，后续选择成本和目标 | 未锁定，不改机制代码 |
| 卡拉「高阶念力」（`high_telekinesis`） | 待读取压缩卡图 | `abilities-trickster.ts:96`，攻击后，每回合 1，选 3 格内单位推/拉 | 未锁定，不改机制代码 |
| 古尔壮「心灵传念」（`mind_transmission`） | 待读取压缩卡图 | `abilities-trickster.ts:234`，攻击后，每回合 1，选 3 格内友方士兵给额外攻击 | 未锁定，不改机制代码 |
| 清风法师「念力」（`telekinesis`） | 待读取压缩卡图 | `abilities-trickster.ts:335`，攻击后，每回合 1，选 2 格内单位推/拉 | 未锁定，不改机制代码 |

### 11.2 当前补审结论

- 第二批补审已开始，但还没有达到代码修改门槛。
- 已发现旧队列口径低估剩余范围：高风险队列实际仍有 64 个未完成对象，不能继续写成 22 个。
- 后续必须继续以卡图为主补齐子句矩阵；图上看不清的字段保持“未锁定”，不得用实现描述、i18n 或旧测试补成规则结论。

## 12. 第二批子句矩阵

- 子句矩阵文件：`D:\gongzuo\webgame\BoardGame\temp\summonerwars-audit\second-batch-clause-matrix.md`
- 覆盖对象：梅肯达·露 / 边境弓箭手「准备」「连续射击」、凯鲁尊者「鼓舞」「撤退」、卡拉「高阶念力」、古尔壮「心灵传念」、清风法师「念力」。
- 当前结论：第二批已完成“对象定位 + 卡图路径 + 实现候选 + 子句字段拆分”，但未完成“卡图原文逐字锁定”。
- 门槛：所有字段保持“未锁定”；不得据此修改机制代码。
- 下一步：继续提升单卡文字区证据质量；逐字锁定后再把每条子句映射到定义、执行、状态、消耗、验证、UI、i18n、测试八层。

## 13. 全面补审执行记录（2026-07-02 10:22:40 +08:00）

### 13.1 当前执行口径

- 用户已明确要求开始审计；本轮按“召唤师战争全面机制审计”继续，不进入机制代码修改。
- 不确定字段以卡图为主；卡图无法逐字确认时，记录为“未锁定”，不得用 i18n、AbilityDef、代码注释或旧测试补成规则结论。
- 当前 scoped status 仅显示本审计 evidence 文件有 tracked 修改；未发现召唤师战争机制代码被本轮新增修改。

### 13.2 当前总量

- 风险矩阵：68 行能力风险对象。
- 第一批已完成 L1/L2：4 个对象（雌狮「威势」、贾穆德「威势」、城塞圣武士「裁决」、瑟拉·艾德温「城塞之力」）。
- 第二批优先深审：7 个对象；目前仍处于“卡图读取/子句锁定”阶段。
- 后续剩余：第一批和第二批之外仍有 57 个对象需继续按风险族补审。

### 13.3 本轮新增卡图读取证据

| 对象 | 读取文件 | 当前读取结论 | 规则锁定状态 | 后续动作 |
| --- | --- | --- | --- | --- |
| 梅肯达·露 / 边境弓箭手「准备」 | temp/summonerwars-card-authority/audit-readable/makinda_ru-text-full-readable.jpg; temp/summonerwars-card-authority/audit-readable/frontier_archer-text-full-readable.jpg; second-batch-small/*rules*.jpg | 可确认读取的是对应卡牌文字区，但技能原文仍不能逐字可靠转写 | 未锁定 | 继续尝试更局部裁切；仍看不清则保持未锁定 |
| 梅肯达·露 / 边境弓箭手「连续射击」 | 同上 | 可确认属于同组第二批对象，但“攻击后 / 每回合一次 / 消耗充能 / 额外攻击”等子句尚不能逐字落证 | 未锁定 | 不改机制代码；只保留实现候选与风险 |

### 13.4 禁止误判

- 不能把当前图片“看起来像”描述当成权威原文。
- 不能把实现里的 prepare、rapid_fire 字段当成规则真相源。
- 不能把“边境弓箭手与梅肯达·露可能同文”当作已证实结论；两张卡都必须独立锁定。
- 第二批对象未锁卡图前，不进入代码修复、测试改写或机制重构。

## 14. 是否需要全面审计的判定（2026-07-02）

### 14.1 判定结论

- 需要对召唤师战争做全面机制审计。
- 当前不能把既有测试覆盖、旧 ability id 命中、旧 evidence 或实现描述继续当作“已审过”的证明。
- 本轮状态只能表述为：全面机制审计已启动，第一批 4 个对象已完成 L1/L2，第二批 7 个对象正在补卡图子句锁定，整体仍有残余范围。

### 14.2 为什么必须补审

- 审计规范已经明确：只要说“审计 / 全面审计 / 收口审计”，必须覆盖对象全集、规则子句、适用 D 维度、L1-L4 证据层级、共享链路判等和旧结论回写；抽样或代表链不能冒充全面审计。
- 召唤师战争当前风险矩阵已有 68 行能力风险对象，其中 60 行不是低风险静态/被动对象；第一批 + 第二批之外仍有 57 行对象待审。
- 已发现旧审计口径存在假阳性风险：测试里出现能力 id，只能证明名字被覆盖，不能证明“攻击后 / 每回合一次 / enemy unit / custom 后续选择 / 资源消耗 / 最终状态收口”等子句正确。
- 用户反馈的充能堆叠问题已经证明不能靠猜规则修代码；所有不确定字段必须回到卡图或更清晰真相源。

### 14.3 全面审计完成门槛

- 建立召唤师战争能力对象全集，并标明每个对象的卡牌、技能、触发窗口、资源、目标、最终状态和共享链路。
- 每个对象把卡图或权威规则拆成可编号子句；未能逐字锁定卡图的字段必须保持“未锁定”，不得用实现、i18n、旧测试或代码注释补成规则结论。
- 每个对象至少给出 L1 结构证据和 L2 领域行为证据；涉及真实 UI 选择、攻击后 prompt、AI/在线重复事件的对象还要补 L3。
- 涉及时序、窗口、队列、pending、每回合次数、custom 后续结算、资源消耗、状态清理、共享推拉/额外攻击链路的对象必须补 L4 治理证据。
- 所有旧 evidence 中会误导的“已覆盖 / 已通过 / 无未命中”表述必须回写为当前口径，不能只在新文档顶部声明失效。

### 14.4 分批执行口径

- P0 已完成：雌狮「威势」、贾穆德「威势」、城塞圣武士「裁决」、瑟拉·艾德温「城塞之力」。
- P1 当前批次：梅肯达·露 / 边境弓箭手「准备」「连续射击」、凯鲁尊者「鼓舞」「撤退」、卡拉「高阶念力」、古尔壮「心灵传念」、清风法师「念力」。
- P2 后续高风险：custom 结算、交互/目标选择、资源/状态改写、每回合次数、攻击后触发、充能/boost 家族。
- P3 低风险静态/被动：只有在卡图子句、共享状态或 UI 展示不涉及额外分支时，才允许较轻量审计；否则升级到 P2。

### 14.5 当前禁止事项

- 不在第二批卡图原文未逐字锁定前修改机制代码。
- 不把“看起来像”“实现里这样写”“旧测试是绿的”写成规则结论。
- 不把显示上限、动画降噪、防重复播放等止血动作称为机制根因修复。
- 不把“第一批已通过”外推成“同家族都正确”。

## 15. 第二批 OCR 与压缩图复核记录（2026-07-02 10:55:00 +08:00）

### 15.1 本轮动作

- 已按用户要求继续压缩/裁切读图，避免直接读取原始大图。
- 已查看第二批卡牌的压缩全图证据：凯鲁尊者、卡拉、古尔壮、清风法师。
- 已补跑中文+英文 OCR 辅助文件：`temp/summonerwars-card-authority/ocr/second-batch-ocr-zh-en-2026-07-02.md`。

### 15.2 当前结论

- 现有压缩卡图和 OCR 辅助结果仍不足以把第二批 7 个对象的规则原文逐字锁定。
- OCR 结果只能证明“当前图片质量不足 / 模型无法稳定识别”，不能反向证明实现正确。
- 第二批仍保持“未锁定”状态；不进入机制代码修改、不改测试断言、不把实现文案补成规则结论。

### 15.3 对全面审计的影响

- 需要继续全面审计，且必须把“真相源不可读”作为审计发现记录，而不是跳过这批对象。
- P1 后续优先动作：寻找更清晰卡图或权威规则文本；若只剩压缩 atlas，先做对象路径、风险字段和实现入口登记，不做规则判通。

## 16. 全面审计补审决策与执行队列（2026-07-02）

### 16.1 是否要全面补审

- 结论：要补审，而且不能只补雌狮「威势」这一条。
- 理由：当前审计规范已经从“能力是否注册/测试是否命中”升级为“卡图原文子句 → 实现链路 → 最终状态 → UI/交互 → 负向路径”的闭环审计；召唤师战争旧证据大多不足以支撑这个口径。
- 约束：本轮只推进审计和证据登记；未逐字锁定卡图或权威规则前，不修改机制代码、不改测试断言。
- 真相源：不确定项以卡图为主；OCR、i18n、AbilityDef、代码注释、旧测试只能作为定位线索。

### 16.2 当前对象分层

- P0 已完成 L1/L2（仍需按新规范补 L3/L4 适用性复核）：4 个对象。
  - 样例：intimidate、imposing、fortress_power、judgment
- P1 正在卡图锁定：7 个对象。
  - 样例：prepare、rapid_fire、inspire、withdraw、high_telekinesis、mind_transmission、telekinesis
- P2 高风险机制链：36 个对象。
  - 样例：ancestral_bond、speed_up、spirit_bond、structure_shift、ice_shards、greater_frost_bolt、frost_bolt、frost_axe、ice_ram、vanish、blood_rune、magic_addiction、ferocity、feed_beast、charge、immobile、grab、guidance……
- P3 状态/数值链：13 个对象。
  - 样例：gather_power、trample、slow、climb、entangle、flying、swift、evasion、rebound、blood_rage、power_boost、blood_rage_decay、sacrifice
- P4 低风险静态/被动：8 个对象。
  - 样例：power_up、life_up、cold_snap、living_gate、mobile_structure、fire_sacrifice_summon、rage、soulless

### 16.3 补审优先级

- 第一优先级：攻击后触发、每回合次数、custom 后续结算、额外攻击、推拉、召回、召唤、资源消耗、充能/boost；这些直接关联“重复触发/循环/状态堆叠/交互卡死”。
- 第二优先级：共享执行器或共享状态链，例如推拉、额外攻击、充能、能力次数、pending/interaction；同一共享链发现一个对象有风险，不能外推同家族正确。
- 第三优先级：低风险静态/被动；只有卡图子句简单且无共享状态、无交互、无阶段清理时，才允许轻量审计。

### 16.4 下一步执行门槛

- 先补完 P1 第二批 7 个对象的卡图子句锁定；看不清的继续记录“未锁定”，不猜。
- P1 任一对象一旦逐字锁定，立刻做定义、执行、状态、消耗、验证、UI、i18n、测试八层对照。
- 若发现卡图与实现冲突，先写最小失败测试，再改最小机制逻辑，再回到原始卡图子句和真实状态位点验收。
- 同步保留旧 evidence 回写任务；旧文档里“已覆盖/已通过”的句子如果不满足新规范，必须改成当前证据等级。


## 17. P1 单卡压缩复核图补充（2026-07-02 10:47:54 +08:00）

### 17.1 本轮动作

- 已按“先压缩后读取”的口径，生成 P1 单卡小尺寸复核图，避免直接读取原始 atlas 或超大长图。
- 复核图路径：`temp/summonerwars-card-authority/manual-review-sheets/p1-*-focused-review.jpg`。
- 这些图片只用于人工/视觉复核卡图文字；在逐字确认前，不作为规则断言。

### 17.2 当前处理

- 第二批 7 个对象仍维持“未锁定”。
- 下一步应逐张打开 `p1-makinda_ru-focused-review.jpg`、`p1-frontier_archer-focused-review.jpg`、`p1-kalu-focused-review.jpg`、`p1-kara-focused-review.jpg`、`p1-gulzhuang-focused-review.jpg`、`p1-wind_mage-focused-review.jpg`，只把肉眼能逐字确认的文本写入子句矩阵。
- 任何看不清、只能猜词、只能由 OCR 推测的字段，继续保留“未锁定”。

## 18. 全面审计正式启动与队列固化（2026-07-02）

### 18.1 本轮结论

- 已按用户“开始审计”的目标，把召唤师战争机制审计从单点问题扩展为全集补审队列。
- 当前动作仍是审计和证据登记，不是机制代码修复；未逐字锁定卡图/权威规则前，不修改机制逻辑和测试断言。
- 新增队列文件：`temp/summonerwars-audit/full-mechanics-audit-queue-2026-07-02.md`。

### 18.2 当前全集规模

| 项目 | 数量 |
| --- | ---: |
| 能力风险对象 | 68 |
| P0 已完成 L1/L2 复核 | 4 |
| P1 正在锁卡图原文 | 7 |
| P2 高风险机制链待补审 | 39 |
| P3 状态/数值链待补审 | 10 |
| P4 低风险静态/被动待抽查 | 8 |

### 18.3 当前审计口径

- P1 仍先处理梅肯达·露 / 边境弓箭手「准备」「连续射击」、凯鲁尊者「鼓舞」「撤退」、卡拉「高阶念力」、古尔壮「心灵传念」、清风法师「念力」。
- P2 不跳过：攻击后触发、每回合次数、custom 后续结算、目标选择、资源消耗、充能/boost、额外攻击、推拉等都列入补审。
- 旧证据中“测试命中 ability id / 交互能跑通 / i18n 文案存在”不能继续升级成“机制已审通过”。
- 不确定项以卡图为主；卡图看不清时，结论必须停在“未锁定”。

### 18.4 下一步

- 先继续 P1 卡图文字区复核；如果现有 atlas 仍不可读，登记为真相源缺口并转入查找更清晰卡图/规则文本。
- 每锁定一个对象，就补对应“原文子句 × 八层链路”矩阵，再决定是否需要测试和代码修复。

## 19. P2 高风险机制链补审启动（2026-07-02）

### 19.1 本轮新增动作

- 已新增 P2 高风险机制链子句矩阵：`temp/summonerwars-audit/p2-high-risk-clause-matrix.md`。
- P2 第一组优先覆盖资源、充能、额外动作、custom 后续结算、目标选择和状态清理链路。
- 本轮仍不修改机制代码；所有未逐字锁定卡图/权威规则的字段保持“未锁定”。

### 19.2 P2 第一组优先对象

| 对象 | 为什么先审 |
| --- | --- |
| 祖灵法师「聚能」/「魂灵纽带」 | 涉及充能堆叠、转移、次数和交互，和用户反馈的堆叠类风险同族。 |
| 野兽骑手「冲锋」/亡灵战士「嗜血」/共享「力量提升」 | 涉及充能或力量增长，必须明确上限、触发和消耗是否来自卡图。 |
| 阿布亚·石「祖灵纽带」/霜系推拉/诈术系念力替代 | 涉及 custom 后续选择、目标和移动位置，不能用共享执行器直接外推正确。 |
| 亡灵复活/转移链 | 涉及召回、放置、弃牌堆/战场状态，属于高风险最终状态链。 |

### 19.3 当前结论

- 全面审计已从 P1 卡图锁定扩展到 P2 队列登记。
- P2 尚未判通过；当前只完成“对象和风险字段入队”。
- 下一步仍按“先卡图、再子句、再八层”的顺序推进，不能因为 P2 有实现候选就开始修代码。

## 20. P2 第一组压缩卡图证据生成（2026-07-02）

### 20.1 本轮动作

- 已按“先压缩/裁切后读取”的要求，为 P2 第一组生成卡图复核图。
- 生成目录：`temp/summonerwars-card-authority/p2-first-group-review/`。
- 总览图：`temp/summonerwars-card-authority/p2-first-group-review/p2-first-group-contact-sheet.jpg`。
- 清单：`temp/summonerwars-card-authority/p2-first-group-review/manifest.json`。

### 20.2 卡图证据登记

| 对象 | 原 atlas | 压缩整卡 | 文字区增强图 | 规则锁定状态 |
| --- | --- | --- | --- | --- |
| 阿布亚·石（barbaric-summoner） | public/assets/i18n/zh-CN/summonerwars/hero/Barbaric/compressed/cards.webp | temp/summonerwars-card-authority/p2-first-group-review/barbaric-summoner-full640.jpg | temp/summonerwars-card-authority/p2-first-group-review/barbaric-summoner-text900.jpg | 未逐字锁定 |
| 祖灵法师（barbaric-spirit-mage） | public/assets/i18n/zh-CN/summonerwars/hero/Barbaric/compressed/cards.webp | temp/summonerwars-card-authority/p2-first-group-review/barbaric-spirit-mage-full640.jpg | temp/summonerwars-card-authority/p2-first-group-review/barbaric-spirit-mage-text900.jpg | 未逐字锁定 |
| 犀牛（barbaric-rhinoceros） | public/assets/i18n/zh-CN/summonerwars/hero/Barbaric/compressed/cards.webp | temp/summonerwars-card-authority/p2-first-group-review/barbaric-rhinoceros-full640.jpg | temp/summonerwars-card-authority/p2-first-group-review/barbaric-rhinoceros-text900.jpg | 未逐字锁定 |
| 野兽骑手（goblin-beast-rider） | public/assets/i18n/zh-CN/summonerwars/hero/Goblin/compressed/cards.webp | temp/summonerwars-card-authority/p2-first-group-review/goblin-beast-rider-full640.jpg | temp/summonerwars-card-authority/p2-first-group-review/goblin-beast-rider-text900.jpg | 未逐字锁定 |
| 巨食兽（goblin-glutton） | public/assets/i18n/zh-CN/summonerwars/hero/Goblin/compressed/cards.webp | temp/summonerwars-card-authority/p2-first-group-review/goblin-glutton-full640.jpg | temp/summonerwars-card-authority/p2-first-group-review/goblin-glutton-text900.jpg | 未逐字锁定 |
| 思尼克斯（goblin-summoner） | public/assets/i18n/zh-CN/summonerwars/hero/Goblin/compressed/cards.webp | temp/summonerwars-card-authority/p2-first-group-review/goblin-summoner-full640.jpg | temp/summonerwars-card-authority/p2-first-group-review/goblin-summoner-text900.jpg | 未逐字锁定 |
| 布拉夫（goblin-blarf） | public/assets/i18n/zh-CN/summonerwars/hero/Goblin/compressed/cards.webp | temp/summonerwars-card-authority/p2-first-group-review/goblin-blarf-full640.jpg | temp/summonerwars-card-authority/p2-first-group-review/goblin-blarf-text900.jpg | 未逐字锁定 |
| 寒冰锻造师（frost-ice-smith） | public/assets/i18n/zh-CN/summonerwars/hero/Frost/compressed/cards.webp | temp/summonerwars-card-authority/p2-first-group-review/frost-ice-smith-full640.jpg | temp/summonerwars-card-authority/p2-first-group-review/frost-ice-smith-text900.jpg | 未逐字锁定 |
| 丝瓦拉（frost-summoner） | public/assets/i18n/zh-CN/summonerwars/hero/Frost/compressed/cards.webp | temp/summonerwars-card-authority/p2-first-group-review/frost-summoner-full640.jpg | temp/summonerwars-card-authority/p2-first-group-review/frost-summoner-text900.jpg | 未逐字锁定 |
| 卡拉（trickster-kara） | public/assets/i18n/zh-CN/summonerwars/hero/Trickster/compressed/cards.webp | temp/summonerwars-card-authority/p2-first-group-review/trickster-kara-full640.jpg | temp/summonerwars-card-authority/p2-first-group-review/trickster-kara-text900.jpg | 未逐字锁定 |
| 清风法师（trickster-wind-mage） | public/assets/i18n/zh-CN/summonerwars/hero/Trickster/compressed/cards.webp | temp/summonerwars-card-authority/p2-first-group-review/trickster-wind-mage-full640.jpg | temp/summonerwars-card-authority/p2-first-group-review/trickster-wind-mage-text900.jpg | 未逐字锁定 |
| 泰珂露（trickster-summoner） | public/assets/i18n/zh-CN/summonerwars/hero/Trickster/compressed/cards.webp | temp/summonerwars-card-authority/p2-first-group-review/trickster-summoner-full640.jpg | temp/summonerwars-card-authority/p2-first-group-review/trickster-summoner-text900.jpg | 未逐字锁定 |
| 心灵巫女（trickster-mind-witch） | public/assets/i18n/zh-CN/summonerwars/hero/Trickster/compressed/cards.webp | temp/summonerwars-card-authority/p2-first-group-review/trickster-mind-witch-full640.jpg | temp/summonerwars-card-authority/p2-first-group-review/trickster-mind-witch-text900.jpg | 未逐字锁定 |
| 瑞特-塔鲁斯（necro-summoner） | public/assets/i18n/zh-CN/summonerwars/hero/Necromancer/compressed/cards.webp | temp/summonerwars-card-authority/p2-first-group-review/necro-summoner-full640.jpg | temp/summonerwars-card-authority/p2-first-group-review/necro-summoner-text900.jpg | 未逐字锁定 |
| 亡灵战士（necro-undead-warrior） | public/assets/i18n/zh-CN/summonerwars/hero/Necromancer/compressed/cards.webp | temp/summonerwars-card-authority/p2-first-group-review/necro-undead-warrior-full640.jpg | temp/summonerwars-card-authority/p2-first-group-review/necro-undead-warrior-text900.jpg | 未逐字锁定 |

### 20.3 当前限制

- 本轮只确认了 P2 第一组的卡图读取入口和压缩证据文件。
- 尚未逐字确认规则原文；这些对象继续保持“未锁定”。
- 后续需要逐张打开文字区增强图，只登记肉眼能逐字确认的原文；看不清的字段不得用 OCR 或实现候选补齐。

## 21. P2 第一组图片人工复核记录（2026-07-02）

### 21.1 已打开复核的压缩图

| 图 | 复核对象 | 当前结论 | 规则锁定状态 |
| --- | --- | --- | --- |
| `temp/summonerwars-card-authority/p2-first-group-review/p2-first-group-contact-sheet.jpg` | P2 第一组 15 张卡总览 | 可确认批量裁切对象入口已生成，但总览图只能确认对象与版面，不能逐字读取规则 | 未锁定 |
| `temp/summonerwars-card-authority/p2-first-group-review/barbaric-spirit-mage-text900.jpg` | 祖灵法师 | 已打开文字区增强图；当前视觉清晰度仍不足以稳定逐字抄录完整规则 | 未锁定 |
| `temp/summonerwars-card-authority/p2-first-group-review/goblin-beast-rider-text900.jpg` | 野兽骑手 | 已打开文字区增强图；当前视觉清晰度仍不足以稳定逐字抄录完整规则 | 未锁定 |
| `temp/summonerwars-card-authority/p2-first-group-review/necro-undead-warrior-text900.jpg` | 亡灵战士 | 已打开文字区增强图；当前视觉清晰度仍不足以稳定逐字抄录完整规则 | 未锁定 |

### 21.2 审计判断

- 这三张 P2 文字区图不能升级为权威规则原文。
- 当前只能证明：对应卡图路径、spriteIndex 裁切和增强图已准备好；不能证明实现正确，也不能证明实现错误。
- 祖灵法师、野兽骑手、亡灵战士继续保持 P2 高风险待补审，不进入机制代码修改。

### 21.3 下一步

- 继续逐张复核 P2 第一组剩余文字区增强图。
- 对仍不可读的对象，在矩阵中保留“未逐字锁定”。
- 若需要进一步推进，应寻找更高清卡图或改做更局部能力文本裁切；仍不得用实现字段、i18n 或 OCR 猜规则。

## 22. P2 锐化 contact sheet 复核记录（2026-07-02）

### 22.1 是否需要全面补审

- 需要补审。原因不是雌狮「威势」单点异常，而是审计规范已经把“卡图原文、触发时机、每回合次数、目标选择、custom 后续结算、状态清理、UI 表现、测试覆盖”拆成了更细门槛；旧证据里只证明 ability id 存在、测试能跑通、实现文案一致的结论，不能继续当作机制已通过。
- 当前补审范围已固化为 68 个能力风险对象；其中 P0/P1/P2 都包含可能影响重复触发、充能堆叠、额外动作、推拉、召回、召唤或交互卡死的机制链。
- 本轮仍停在审计与证据锁定阶段；没有把任何未逐字锁定的卡图内容升级成规则，也没有进入机制代码修复。

### 22.2 已复核的锐化总览图

| 图 | 复核对象 | 当前结论 | 规则锁定状态 |
| --- | --- | --- | --- |
| `temp/summonerwars-card-authority/p2-first-group-review-sharp/p2-sharp-contact-1.jpg` | P2 第一组锐化总览 1 | 可确认部分对象文字区已生成锐化图，但总览图仍不能稳定逐字读取完整能力描述 | 未锁定 |
| `temp/summonerwars-card-authority/p2-first-group-review-sharp/p2-sharp-contact-2.jpg` | P2 第一组锐化总览 2 | 可确认部分对象文字区已生成锐化图，但总览图仍不能稳定逐字读取完整能力描述 | 未锁定 |
| `temp/summonerwars-card-authority/p2-first-group-review-sharp/p2-sharp-contact-3.jpg` | P2 第一组锐化总览 3 | 可确认部分对象文字区已生成锐化图，但总览图仍不能稳定逐字读取完整能力描述 | 未锁定 |

### 22.3 证据限制

- `p2-first-group-review-sharp/` 目录没有独立 `manifest.json`；锐化图只能按文件名与原始 `p2-first-group-review/manifest.json` 对照，不能单独升级为真相源清单。
- 三张锐化 contact sheet 只能证明图片批次和对象入口已经准备好；不能证明规则原文、实现正确或实现错误。
- 不确定项继续以卡图为主；卡图看不清时登记为“未锁定”，不得用实现字段、i18n、代码注释或 OCR 补规则。

### 22.4 下一步

- 继续做更局部的单卡能力文字裁切，优先处理和用户反馈同族的充能/boost 链：祖灵法师「聚能」「魂灵纽带」、野兽骑手「冲锋」、亡灵战士「嗜血」、共享「力量提升」。
- 每张图只登记肉眼能逐字确认的子句；不能逐字确认的字段保留“未锁定”。
- 只有在卡图或权威规则锁定后，才进入“原文子句 × 八层链路”对照、失败测试和机制修复。

## 23. P2 boost focused 单卡裁切复核记录（2026-07-02）

### 23.1 本轮证据入口

- 已生成并复核 P2 充能/boost 同族的局部单卡裁切图。
- 生成目录：`temp/summonerwars-card-authority/p2-boost-focused-review/`。
- 清单：`temp/summonerwars-card-authority/p2-boost-focused-review/manifest.json`。
- 总览图：`temp/summonerwars-card-authority/p2-boost-focused-review/p2-boost-focused-contact.jpg`。

### 23.2 已打开复核的图片

| 图 | 复核对象 | 当前结论 | 规则锁定状态 |
| --- | --- | --- | --- |
| `temp/summonerwars-card-authority/p2-boost-focused-review/p2-boost-focused-contact.jpg` | P2 充能/boost 第一组总览 | 可确认对象入口与裁切批次，但不能逐字读取完整能力描述 | 未锁定 |
| `temp/summonerwars-card-authority/p2-boost-focused-review/barbaric-spirit-mage-text-all-focused.jpg` | 祖灵法师 | 图像仍存在压缩、变形和噪点，不能稳定逐字抄录「聚能」「魂灵纽带」完整描述 | 未锁定 |
| `temp/summonerwars-card-authority/p2-boost-focused-review/goblin-beast-rider-text-all-focused.jpg` | 野兽骑手 | 图像仍存在压缩、变形和噪点，不能稳定逐字抄录「冲锋」完整描述 | 未锁定 |
| `temp/summonerwars-card-authority/p2-boost-focused-review/necro-undead-warrior-text-all-focused.jpg` | 亡灵战士 | 图像仍存在压缩、变形和噪点，不能稳定逐字抄录「嗜血」及相关增强描述 | 未锁定 |
| `temp/summonerwars-card-authority/p2-boost-focused-review/goblin-blarf-text-all-focused.jpg` | 布拉夫 | 图像仍存在压缩、变形和噪点，不能稳定逐字抄录共享增强相关描述 | 未锁定 |

### 23.3 审计判断

- 这批 focused 图只能证明 P2 充能/boost 同族的卡图入口已被定位并尝试裁切；不能作为规则原文真相源。
- `gather_power`、`spirit_bond`、`charge`、`blood_rage`、`power_boost` 继续保持“未逐字锁定”。
- 当前不得用 i18n、AbilityDef、代码注释、OCR 或旧测试补全能力描述，也不得基于这些候选文本修改机制逻辑。

### 23.4 下一步

- 优先寻找更高清官方卡图或更清晰截图；若仍不可得，在矩阵中登记为真相源缺口。
- 继续按 P1 → P2 充能/boost → P2 custom/目标选择的顺序推进，不把表现层蓝点溢出当作机制根因修复证据。

## 24. P1/P2 本地真相源可用性盘点（2026-07-02）

### 24.1 本轮动作

- 已按当前审计规范补做本地真相源可用性盘点，覆盖 P1 七个对象与 P2 充能/boost 第一组。
- 检查范围：`src/games/summonerwars/rule/`、`public/locales/zh-CN/game-summonerwars.json`、`src/games/summonerwars/domain/`、`src/games/summonerwars/config/`、`evidence/summonerwars/`、`temp/summonerwars-audit/`。
- 检查目的：区分“权威规则原文”与“实现候选/旧证据/辅助定位文本”，避免再用实现文案反推规则。

### 24.2 盘点结果

| 分层 | 对象 | 中文名 | 承载卡牌 | 规则文本命中 | i18n 命中 | domain 命中 | config 命中 | evidence/temp 命中 | 当前真相源状态 |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| P1 | `prepare` | 准备 | 梅肯达·露 / 边境弓箭手 | 0 | 4 | 4 | 0 | 9 | 无本地权威规则原文；i18n/domain 仅作候选 |
| P1 | `rapid_fire` | 连续射击 | 梅肯达·露 / 边境弓箭手 | 0 | 2 | 8 | 0 | 10 | 无本地权威规则原文；i18n/domain 仅作候选 |
| P1 | `inspire` | 鼓舞 | 凯鲁尊者 | 0 | 0 | 0 | 0 | 5 | 本地只剩审计候选记录；未锁定 |
| P1 | `withdraw` | 撤退 | 凯鲁尊者 | 0 | 4 | 2 | 0 | 14 | 无本地权威规则原文；i18n/domain 仅作候选 |
| P1 | `high_telekinesis` | 高阶念力 | 卡拉 | 0 | 7 | 9 | 0 | 6 | 无本地权威规则原文；i18n/domain 仅作候选 |
| P1 | `mind_transmission` | 心灵传念 | 古尔壮 | 0 | 0 | 0 | 0 | 5 | 本地只剩审计候选记录；未锁定 |
| P1 | `telekinesis` | 念力 | 清风法师 | 0 | 14 | 13 | 0 | 14 | 无本地权威规则原文；i18n/domain 仅作候选 |
| P2 | `gather_power` | 聚能 | 祖灵法师 | 0 | 1 | 2 | 0 | 4 | 无本地权威规则原文；i18n/domain 仅作候选 |
| P2 | `spirit_bond` | 魂灵纽带 | 祖灵法师 | 0 | 0 | 0 | 0 | 4 | 本地只剩审计候选记录；未锁定 |
| P2 | `charge` | 冲锋 | 野兽骑手 | 0 | 1 | 14 | 0 | 4 | 无本地权威规则原文；i18n/domain 仅作候选 |
| P2 | `blood_rage` | 嗜血 | 亡灵战士 | 0 | 0 | 0 | 0 | 4 | 本地只剩审计候选记录；未锁定 |
| P2 | `power_boost` | 力量提升 | 布拉夫 / 亡灵战士 | 0 | 0 | 0 | 0 | 3 | 本地只剩审计候选记录；未锁定 |

### 24.3 审计判断

- `src/games/summonerwars/rule/召唤师战争规则.md` 没有命中上述 P1/P2 能力名，不能补足卡牌能力原文。
- `public/locales/zh-CN/game-summonerwars.json`、`src/games/summonerwars/domain/**`、旧测试与旧 evidence 只能说明当前实现如何命名和运行，不能作为规则真相源。
- P1 与 P2 充能/boost 第一组继续停在“对象已入队、实现候选已定位、卡图入口已尝试、规则原文未锁定”的状态。
- 现阶段不得新增机制修复、不得新增断言测试、不得把蓝点数量显示改动称为根因修复。

### 24.4 下一步

- 若继续只使用本仓库本地资料，下一步只能登记真相源缺口，并推进更高清卡图/官方截图获取。
- 若拿到更高清卡图或官方原文，优先回填 `temp/summonerwars-audit/second-batch-clause-matrix.md` 与 `temp/summonerwars-audit/p2-high-risk-clause-matrix.md` 中的“未锁定”字段。
- 对已经有运行截图或测试的对象，只能先标为“旧实现行为证据存在”；不能升级为“规则正确”。

## 25. P1/P2 压缩小图人工复核记录（2026-07-02）

### 25.1 本轮动作

- 已按“先压缩后读取，避免对话卡死”的口径，为 P1/P2 现有复核图生成小尺寸人工复核副本。
- 生成目录：`temp/summonerwars-card-authority/visual-review-small/`。
- 清单：`temp/summonerwars-card-authority/visual-review-small/manifest.tsv`。
- 已实际打开复核：
  - `temp/summonerwars-card-authority/visual-review-small/p1-rules-strip.jpg`
  - `temp/summonerwars-card-authority/visual-review-small/p2-boost-contact.jpg`

### 25.2 图片尺寸与用途

| 图 | 来源 | 小图尺寸 | 用途 | 当前结论 |
| --- | --- | ---: | --- | --- |
| `p1-rules-strip.jpg` | `manual-review-sheets/p1-rules1600-top-mid-bot.jpg` | 900 × 372 | P1 文字区拼接总览 | 不能逐字锁定完整能力描述 |
| `p2-boost-contact.jpg` | `p2-boost-focused-review/p2-boost-focused-contact.jpg` | 590 × 1200 | P2 充能/boost focused 总览 | 不能逐字锁定完整能力描述 |

### 25.3 人工复核判断

- 两张压缩小图能降低读取成本，也能确认当前图像批次和对象入口；但仍无法稳定逐字读取能力原文。
- 因此 P1 七个对象与 P2 充能/boost 第一组继续保持“未逐字锁定”。
- 这些小图不能升级为权威规则来源，不能用来判断实现正确或错误。
- 当前不能用测试绿灯、旧 evidence、i18n 或 AbilityDef 替代卡图原文。

### 25.4 下一步

- 继续寻找更高清官方卡图、官方截图或其它可逐字读取的权威来源。
- 若只能继续使用当前压缩 atlas，审计结论必须登记为真相源缺口，不进入机制修复。

## 26. 是否进入全面机制审计的结论（2026-07-02）

### 26.1 结论

- 需要对召唤师战争进入全面机制审计，不能只把雌狮「威势」或 P1/P2 当前批次当作单点问题收口。
- 原因不是已经证明所有对象都有 bug，而是新审计规范提高了门槛：机制对象必须先锁权威描述、拆原子子句、登记实现入口与风险族，再判断是否允许修代码。
- 当前已固化 68 个风险对象队列；其中 custom 结算、交互/目标选择、每回合次数、攻击后触发、充能/boost 都是高风险族，不能靠旧测试或实现文案抽样通过。

### 26.2 当前允许做的事

- 允许继续做对象全集、风险分层、卡图入口、规则原文缺口、子句矩阵和旧证据登记。
- 允许把 P0 已深审对象补到新规范要求的 L3/L4 证据维度。
- 允许继续寻找更高清卡图、官方截图或其它可逐字读取的权威来源。

### 26.3 当前禁止做的事

- 未逐字锁定卡图/权威描述前，不修改机制逻辑。
- 未逐字锁定卡图/权威描述前，不新增“应该如此”的机制断言测试。
- 不用 i18n、AbilityDef、代码注释、旧测试、OCR 或当前压缩小图替代规则真相源。
- 不把蓝点过多、动画重复或测试绿灯直接归因成根因修复；这些最多是现象或实现候选。

### 26.4 下一步执行顺序

1. 先补齐全面审计对象全集的证据状态：P0/P1/P2/P3/P4 每个对象都要有当前门槛。
2. 对 P0 已审对象补新规范缺口，尤其是在线重复事件、真实 UI 表现、自动触发次数与状态清理。
3. 对 P1/P2 继续找高清卡图；拿不到可读卡图时只登记“真相源缺口”，不判通过。
4. 只有当卡图子句与实现冲突被证据锁定后，才进入最小失败测试和最小机制修复。

## 27. P0 新规范补审启动：L3/L4 缺口盘点（2026-07-02）

### 27.1 本轮复核对象

| 对象 | 中文名 | 当前卡图状态 | 当前实现/测试状态 | 新规范缺口 |
| --- | --- | --- | --- | --- |
| `intimidate` | 雌狮「威势」 | 已锁卡图：攻击敌方单位后；每回合一次；给自己充能 | 自动攻击后结算已登记；已有攻击敌方建筑负向、额外攻击不重复充能测试 | 仍需补真实 UI/在线重复事件证据；当前不能仅凭领域测试宣称 L3/L4 完成 |
| `imposing` | 贾穆德「威势」 | 已锁卡图：攻击敌方单位后；每回合一次；给自己充能 | 自动攻击后结算已登记；实现与雌狮「威势」同族 | 仍需补真实 UI/在线重复事件证据；还需确认同族自动使用次数记账没有被 UI 重放影响 |
| `judgment` | 城塞圣武士「裁决」 | 已锁卡图：攻击敌方单位后；按特殊符号抓牌；无每回合一次 | 自动攻击后 custom 立即抓牌已登记 | 仍需补抓牌最终状态与事件流表现证据；不能只证明 ability triggered |
| `fortress_power` | 瑟拉·艾德温「城塞之力」 | 已锁卡图：每回合一次；攻击敌方单位后；控制城塞单位；从弃牌堆拿城塞单位 | 系统交互入口与 card-selector 路由已登记；已有局部测试 | 仍需补完整选牌收口、取消/无候选/重复事件不重复开交互证据 |

### 27.2 L4 共享链证据快照

| 现实语义 | 代码证据 | 当前判断 |
| --- | --- | --- |
| 自动触发的每回合一次技能需要在结算时写入使用次数 | `abilityResolver.ts` 中 `shouldConsumeAutomaticUsage` 只对无目标选择、无交互链、无 custom 的 `usesPerTurn` 自动技能消费次数；`reduce.ts` 在 `ABILITY_TRIGGERED` 且未跳过时累计次数 | 覆盖雌狮「威势」与贾穆德「威势」这类自动充能；不覆盖需要后续选择的瑟拉·艾德温「城塞之力」 |
| 后续选择类技能不能因为通知事件重复打开 UI | `execute/abilities.ts` 在实际执行技能时写 `interactionResolved=true`；`systems.ts` 与 `useGameEvents.ts` 对 `interactionResolved` 跳过再派生 | 当前是设计证据，仍需真实交互或系统测试证明瑟拉·艾德温「城塞之力」完整收口不重复 |
| 城塞之力选牌入口 | `systems.ts` 为 `fortress_power/selectCard` 创建系统交互；`useGameEvents.test.ts` 已登记 `fortress_power/selectCard` 的 UI 路由为 `card-selector` | 证明 UI 路由已登记；尚不证明玩家选牌后最终手牌/弃牌堆状态全部正确 |
| 充能特效表现 | `useGameEvents.ts` 对 `UNIT_CHARGED` 推送充能特效 | 只能证明存在表现层监听；不能证明在线事件不会重复播放，也不能替代机制正确性 |

### 27.3 当前收口判断

- P0 不是“全面通过”，只能标为“已完成 L1/L2，正在补 L3/L4”。
- 雌狮「威势」与贾穆德「威势」的领域层每回合一次逻辑已有较强证据，但在线事件重放与真实 UI 表现仍未完成。
- 城塞圣武士「裁决」与瑟拉·艾德温「城塞之力」涉及 custom/后续选择链，必须继续补最终状态与系统交互收口证据。
- 本节没有修改机制代码；只是按新规范把 P0 的残余缺口登记出来。


## 28. P0 聚焦验证结果登记（2026-07-02 11:18 +08:00）

### 28.1 执行命令

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-barbaric.test.ts src/games/summonerwars/__tests__/abilities-frost.test.ts src/games/summonerwars/__tests__/abilities-paladin.test.ts src/games/summonerwars/__tests__/abilities-paladin-new.test.ts src/games/summonerwars/__tests__/useGameEvents.test.ts --configLoader native --testNamePattern "威势|imposing|城塞之力|fortress_power|裁决|judgment|fortress_power/selectCard|card-selector|ABILITY_TRIGGERED|UNIT_CHARGED"
```

### 28.2 结果

- 5 个测试文件通过。
- 20 个聚焦测试通过，167 个未命中过滤条件的测试跳过。
- 该结果只证明 P0 当前已有领域测试和 UI 路由登记测试在当前工作区仍通过。

### 28.3 审计解释

- 这不是“全面审计通过”的证据。
- 这也不是 L3/L4 完成证据，因为本次没有跑真实 UI、在线房间、事件流重放或完整系统交互场景。
- 可以把它登记为 P0 当前状态的基线验证，用于后续补 L3/L4 前确认已有 L1/L2 切片没有退化。

### 28.4 后续门槛

- 下一步优先补「城塞之力」完整选牌收口：攻击敌方单位后打开选牌、选择弃牌堆城塞单位、手牌/弃牌堆最终状态变化、重复事件不重复打开交互。
- 再补雌狮「威势」与贾穆德「威势」的 UI/在线重复事件证据。
- 最后补城塞圣武士「裁决」抓牌最终状态与不被每回合一次误限证据。

## 29. P0「城塞之力」现有收口证据细化（2026-07-02）

### 29.1 已确认的当前证据

- 已有测试覆盖：瑟拉·艾德温「城塞之力」攻击敌方单位后产生触发通知；攻击敌方建筑后不触发。
- 已有测试覆盖：直接执行「城塞之力」时，可以把指定城塞单位从弃牌堆拿回手牌，手牌增加 1，弃牌堆减少 1。
- 已有测试覆盖：战场上没有友方城塞单位时拒绝；弃牌堆目标不是城塞单位时拒绝。
- 实现证据：执行器只在目标卡存在于弃牌堆、且目标是城塞单位时产生拿回事件；归约层把该卡从弃牌堆移入手牌。

### 29.2 仍不能升级为 L3/L4 通过的原因

- 上述证据主要覆盖“直接执行技能”的最终状态，不等于完整真实交互链。
- 仍未证明从攻击后通知到系统选牌交互、玩家选择、命令再执行、交互关闭这一整条链路在真实 UI 下完整收口。
- 仍未证明重复事件、乐观更新或服务端确认不会让「城塞之力」重复打开选牌或重复拿回同一张牌。

### 29.3 当前审计状态

- 「城塞之力」当前可登记为：L2 最终状态证据较强，L3/L4 仍未完成。
- 下一步如果继续补 P0，应优先写或运行覆盖完整系统交互队列的证据；没有这层证据前，不能把 P0 标为全面通过。

## 30. P0「城塞之力」系统交互链补证与修复（2026-07-02 11:24 +08:00）

### 30.1 发现的问题

- 新增的系统交互链测试最初失败：攻击后「城塞之力」产生了能力触发事件，但没有进入选弃牌堆城塞单位的系统交互。
- 现实含义：旧证据只覆盖了“直接执行技能能拿回牌”，没有证明真实攻击后的后续选牌入口能收口。

### 30.2 修复动作

- 在召唤师战争系统交互桥接中补上 `fortress_power_retrieve` 的能力触发处理。
- 攻击后触发「城塞之力」时，现在会为瑟拉所属玩家创建选弃牌堆城塞单位的系统交互。
- 玩家响应后继续走既有 `ACTIVATE_ABILITY` 执行器，把目标城塞单位从弃牌堆移入手牌。

### 30.3 新增验证

- 新增测试：`[fortress_power] 攻击后选牌交互应完整收口到手牌/弃牌堆最终状态`。
- 覆盖内容：
  - 攻击敌方单位后出现 `fortress_power/selectCard` 选牌交互。
  - 选中弃牌堆城塞单位后，交互关闭且队列为空。
  - 目标卡进入手牌，并从弃牌堆移除。
  - 对已关闭交互重复响应不会再次拿牌。

### 30.4 验证结果

- 聚焦命令：

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native --testNamePattern "fortress_power|城塞之力"
```

- 结果：1 个测试文件通过，1 个聚焦测试通过，88 个跳过。
- P0 聚焦命令：

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-barbaric.test.ts src/games/summonerwars/__tests__/abilities-frost.test.ts src/games/summonerwars/__tests__/abilities-paladin.test.ts src/games/summonerwars/__tests__/abilities-paladin-new.test.ts src/games/summonerwars/__tests__/useGameEvents.test.ts src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native --testNamePattern "威势|imposing|城塞之力|fortress_power|裁决|judgment|fortress_power/selectCard|card-selector|ABILITY_TRIGGERED|UNIT_CHARGED"
```

- 结果：6 个测试文件通过，21 个聚焦测试通过，255 个跳过。

### 30.5 当前状态

- 「城塞之力」系统交互链缺口已缩小：从“只有直接执行证据”推进到“攻击后系统选牌交互可完整收口”。
- 这仍不是召唤师战争全面审计完成；P0 仍缺真实 UI 截图/在线重复事件证据，P1/P2 仍缺高清卡图逐字锁定。

## 31. P0 事件流与在线重放补审（2026-07-02 11:40 +08:00）

### 31.1 本轮锁定的现实问题

- 这次补审看的不是“技能文案对不对”，而是线上/乐观更新场景下，同一批已发生事件会不会被前端再次当成新事件播放，导致充能旋涡、攻击动画、抓牌表现或选牌入口重复出现。
- 现实风险对应 P0 四个对象：
  - 雌狮「威势」/贾穆德「威势」：同一次充能事件是否会重复播放、或被误看成重复充能。
  - 城塞圣武士「裁决」：同一次抓牌事件是否会被确认状态重放成重复抓牌表现。
  - 瑟拉·艾德温「城塞之力」：同一次攻击后选牌入口是否会因事件重放重复打开，或重复拿回同一张弃牌堆城塞单位。

### 31.2 通用事件流证据

| 现实风险 | 当前证据 | 审计判断 |
| --- | --- | --- |
| 首次进入页面时不应重播历史事件 | 事件播放游标 `useEventStreamCursor` 首次调用会直接同步到当前最新事件，不返回旧事件 | 对 P0 的历史事件重播有通用保护 |
| 服务端确认乐观更新时不应把确认事件整包重播 | 同一事件播放游标默认在确认时静默同步游标，不返回事件；只有显式 `consumeOnReconcile=true` 的消费者才会消费确认事件 | 召唤师战争 `useGameEvents` 没有开启确认消费，因此确认态默认不会重播充能/抓牌/攻击表现 |
| 线上短暂空事件流不应把旧事件重新当成新事件 | 事件播放游标在事件流暂时为空时保持旧游标，不重置为“未消费” | 可降低重连、等待确认、短暂同步空窗导致的重复动画风险 |
| 乐观回滚后需要清理视觉队列 | 事件播放游标在回滚信号到来时返回 `didOptimisticRollback`，召唤师战争事件消费侧据此重置攻击队列、视觉门控和临时动画状态 | 已有通用清理路径；不是 P0 对象专属测试 |
| 同一攻击事件重复到达不应重复播放攻击动画 | 召唤师战争事件消费侧对攻击事件 id 做了二次去重窗口 | 攻击动画有对象外的额外保护 |
| 同一充能事件重复到达不应重复播放充能特效 | 充能表现目前依赖事件播放游标避免重复消费，没有像攻击事件一样做独立 id 去重 | 这是 L4 残余缺口：通用游标降低风险，但还不能宣称充能特效在所有线上重放路径下已闭环 |

### 31.3 对 P0 四个对象的影响

| 对象 | 本轮可升级的证据 | 仍不能升级的部分 |
| --- | --- | --- |
| 雌狮「威势」 | 领域层已证明每回合一次会写入使用次数；通用事件游标降低线上确认重播导致重复充能特效的风险 | 仍缺真实 UI/在线房间证据；充能特效没有对象级独立去重测试 |
| 贾穆德「威势」 | 与雌狮「威势」同族的领域使用次数和通用事件游标证据均成立 | 不能只凭同族实现判 L4 通过；仍缺真实 UI/在线房间证据 |
| 城塞圣武士「裁决」 | 卡图无每回合一次；实现定义没有 `usesPerTurn`，不会进入使用次数限制；已有测试覆盖按特殊符号抓牌和攻击建筑不触发 | 仍缺真实 UI/日志表现证据；事件流确认不重播是通用证据，不是对象级抓牌表现截图 |
| 瑟拉·艾德温「城塞之力」 | 已补攻击后系统选牌交互收口；重复响应已证明不会重复拿牌；通用事件游标降低重复打开历史交互的风险 | 仍缺真实 UI 截图和在线房间证据；重复事件不重复创建选牌入口还缺对象级负向系统测试 |

### 31.4 验证结果

- 已复跑 P0 聚焦命令：

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-barbaric.test.ts src/games/summonerwars/__tests__/abilities-frost.test.ts src/games/summonerwars/__tests__/abilities-paladin.test.ts src/games/summonerwars/__tests__/abilities-paladin-new.test.ts src/games/summonerwars/__tests__/useGameEvents.test.ts src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native --testNamePattern "威势|imposing|城塞之力|fortress_power|裁决|judgment|fortress_power/selectCard|card-selector|ABILITY_TRIGGERED|UNIT_CHARGED"
```

- 结果：6 个测试文件通过，21 个聚焦测试通过，255 个跳过。
- 本次复跑证明现有 P0 领域测试、UI 路由测试和「城塞之力」系统交互链测试没有退化。

### 31.5 当前收口判断

- P0 状态应更新为：L1/L2 已完成；「城塞之力」系统交互链 L4 缺口已缩小；通用事件流 L4 证据已补一层。
- P0 仍不能标为全面通过，因为真实 UI 截图、在线房间确认、对象级充能特效去重和对象级选牌入口去重仍未补齐。
- P1/P2 仍按原门槛推进：先找清晰卡图或权威规则，卡图看不清继续标“未锁定”，不凭实现字段猜规则。

## 32. P0「城塞之力」对象级重复入口补证（2026-07-02 12:00 +08:00）

### 32.1 本轮锁定的现实问题

- 这次补证不再回到卡图录入层；「城塞之力」的录入合同已作为本轮实现审计真相源使用。
- 现实风险是：同一次攻击后能力触发事件如果在同一轮系统处理中重复出现，不应为瑟拉·艾德温重复创建多个选弃牌堆城塞单位入口。

### 32.2 修复动作

- 在召唤师战争系统交互桥接中，对「城塞之力」攻击后选牌入口加入对象级去重。
- 去重键使用同一触发事件时间戳与来源单位实例：`sw-after-attack-fortress-power-{timestamp}-{sourceUnitId}`。
- 当当前交互或等待队列中已经存在同一键的「城塞之力」入口时，后续重复触发不再入队。

### 32.3 新增验证

- 新增测试：`[fortress_power] 同一触发事件重复处理时不应重复创建选牌入口`。
- 覆盖内容：
  - 构造同一条「城塞之力」攻击后触发事件重复进入系统处理。
  - 系统只保留一个 `fortress_power/selectCard` 当前交互。
  - 交互等待队列保持为空，证明重复事件没有再次创建入口。

### 32.4 验证结果

- 已复跑 P0 聚焦命令：

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-barbaric.test.ts src/games/summonerwars/__tests__/abilities-frost.test.ts src/games/summonerwars/__tests__/abilities-paladin.test.ts src/games/summonerwars/__tests__/abilities-paladin-new.test.ts src/games/summonerwars/__tests__/useGameEvents.test.ts src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native --testNamePattern "威势|imposing|城塞之力|fortress_power|裁决|judgment|fortress_power/selectCard|card-selector|ABILITY_TRIGGERED|UNIT_CHARGED"
```

- 结果：6 个测试文件通过，22 个聚焦测试通过，255 个跳过。

### 32.5 当前收口判断

- 「城塞之力」已从“攻击后系统选牌交互可收口”进一步推进到“同一事件重复处理不会重复创建选牌入口”。
- P0 仍不能标为全面通过：真实 UI 截图、在线房间确认、雌狮/贾穆德「威势」对象级充能特效去重、城塞圣武士「裁决」真实 UI/日志表现仍未补齐。
- P1/P2 继续保持录入合同未锁定状态；除非拿到高清卡图/官方规则，否则不把它们推进到实现修复。

## 33. P0「威势」对象级充能特效去重补证（2026-07-02 12:10 +08:00）

### 33.1 本轮锁定的现实问题

- 这次补证仍然不回到卡图录入层；雌狮「威势」与贾穆德「威势」的卡图子句已作为实现审计真相源使用。
- 现实风险是：同一条充能事件如果在重连、回滚或事件流重复进入前端消费时被重复处理，会让玩家看到重复充能旋涡，误以为「威势」重复触发或重复加了充能。

### 33.2 修复动作

- 在召唤师战争事件消费层为充能事件增加对象级事件 id 去重。
- 同一 `UNIT_CHARGED` 事件 id 只允许触发一次充能旋涡；重复进入消费层时直接跳过。
- 新增 `shouldConsumeChargeEvent` 作为可测试的去重函数，避免只靠 Hook 内部状态做不可复查判断。

### 33.3 新增验证

- 新增测试：`shouldConsumeChargeEvent` 同一充能事件 id 只消费一次。
- 覆盖内容：
  - 首次消费事件 id 返回 `true`。
  - 同一事件 id 再次进入返回 `false`。
  - 新事件 id 仍可正常消费。

### 33.4 验证结果

- 已复跑 P0 聚焦命令：

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-barbaric.test.ts src/games/summonerwars/__tests__/abilities-frost.test.ts src/games/summonerwars/__tests__/abilities-paladin.test.ts src/games/summonerwars/__tests__/abilities-paladin-new.test.ts src/games/summonerwars/__tests__/useGameEvents.test.ts src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native --testNamePattern "威势|imposing|城塞之力|fortress_power|裁决|judgment|fortress_power/selectCard|card-selector|ABILITY_TRIGGERED|UNIT_CHARGED|shouldConsumeChargeEvent"
```

- 结果：6 个测试文件通过，23 个聚焦测试通过，255 个跳过。

### 33.5 当前收口判断

- 雌狮「威势」/贾穆德「威势」已从“依赖通用事件游标降低重复风险”推进到“充能特效有对象级事件 id 去重”。
- P0 仍不能标为全面通过：真实 UI 截图、在线房间确认、城塞圣武士「裁决」真实 UI/日志表现仍未补齐。
- P1/P2 继续保持录入合同未锁定状态；除非拿到高清卡图/官方规则，否则不把它们推进到实现修复。

## 34. P0「裁决」抓牌与日志表现补证（2026-07-02 12:15 +08:00）

### 34.1 本轮锁定的现实问题

- 这次补证不回到卡图录入层；城塞圣武士「裁决」的已录入子句作为实现审计真相源使用。
- 现实风险是：「裁决」不应被误套“每回合一次”限制；同一回合内不同城塞圣武士各自攻击后，如果都掷出特殊标记，应各自按特殊标记数量抓牌。
- 另一条现实风险是：抓牌已经发生时，玩家日志必须能看到抓牌表现；不能只在领域最终状态里静默加手牌。

### 34.2 新增验证

- 新增测试：`同一回合多个城塞圣武士可各自触发裁决`。
- 覆盖内容：
  - 同一玩家同一攻击阶段内，两个城塞圣武士分别攻击敌方单位。
  - 两次攻击都掷出 3 个特殊标记。
  - 两次攻击各自产生一条来源为「裁决」的抓牌事件。
  - 最终手牌合计增加 6 张，牌库减少到 0，证明没有被每回合一次误限。
- 新增测试：`裁决触发的抓牌事件会生成抓牌日志`。
- 覆盖内容：
  - 「裁决」产生的抓牌事件会进入操作日志格式化。
  - 日志里存在抓牌条目，并带有玩家与抓牌数量参数。

### 34.3 验证结果

- 已先跑「裁决」与日志聚焦命令：

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-paladin-new.test.ts src/games/summonerwars/__tests__/actionLogFormat.test.ts --configLoader native --testNamePattern "裁决|judgment|抓牌日志|cardDrawn"
```

- 结果：2 个测试文件通过，7 个聚焦测试通过，36 个跳过。
- 已复跑 P0 聚焦命令：

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-barbaric.test.ts src/games/summonerwars/__tests__/abilities-frost.test.ts src/games/summonerwars/__tests__/abilities-paladin.test.ts src/games/summonerwars/__tests__/abilities-paladin-new.test.ts src/games/summonerwars/__tests__/useGameEvents.test.ts src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts src/games/summonerwars/__tests__/actionLogFormat.test.ts --configLoader native --testNamePattern "威势|imposing|城塞之力|fortress_power|裁决|judgment|抓牌日志|cardDrawn|fortress_power/selectCard|card-selector|ABILITY_TRIGGERED|UNIT_CHARGED|shouldConsumeChargeEvent"
```

- 结果：7 个测试文件通过，25 个聚焦测试通过，266 个跳过。

### 34.4 当前收口判断

- 城塞圣武士「裁决」已补上对象级“不被每回合一次误限”的负向证据，并补上抓牌日志表现证据。
- P0 仍不能标为全面通过：真实 UI 截图、在线房间确认仍未补齐；当前证据证明的是领域最终状态、事件流/日志表现和对象级重复风险。
- P1/P2 继续保持录入合同未锁定状态；没有高清卡图/官方规则前，只登记缺口，不进入实现修复。

## 35. 录入合同状态回写与继续规则（2026-07-02 12:20 +08:00）

### 35.1 为什么要回写

- 用户已纠偏：当前阶段不是重新录入数据，也不是无条件重新读图/OCR；数据录入阶段要先把合同状态做好，后续实现审计才不会跑偏。
- 因此本节把当前对象明确分为 `locked / blocked / disputed`，作为后续“继续”的入口规则。

### 35.2 当前合同状态

| 分层 | 对象 | 合同状态 | 当前含义 | 后续动作 |
| --- | --- | --- | --- | --- |
| P0 | 雌狮「威势」、贾穆德「威势」、瑟拉·艾德温「城塞之力」、城塞圣武士「裁决」 | `locked` | 卡图/子句已作为实现审计真相源使用；本轮不再回到读图/OCR | 继续补真实 UI、在线房间、乐观确认/重连不重复表现 |
| P1 | 梅肯达·露 / 边境弓箭手「准备」「连续射击」、凯鲁尊者「鼓舞」「撤退」、卡拉「高阶念力」、古尔壮「心灵传念」、清风法师「念力」 | `blocked` | 已有卡图入口和实现候选，但规则原文不能逐字可靠锁定 | 只登记缺口；拿到高清卡图/官方原文后再改为 `locked` 或 `disputed` |
| P2 第一组 | 祖灵法师「聚能/魂灵纽带」、野兽骑手「冲锋」、亡灵战士「嗜血」、共享「力量提升」等高风险机制链 | `blocked` | 已建立高风险对象与实现入口，但卡图/权威规则原文未逐字锁定 | 只登记缺口；不得凭实现字段、i18n、OCR 或旧测试补规则 |
| P3/P4 | 其余状态/数值链与低风险静态/被动对象 | 待建合同 | 尚未逐对象完成卡图/权威原文锁定 | 进入对应批次时先建立合同状态，不直接改机制 |

### 35.3 后续继续规则

- `locked` 对象：默认进入实现对照、测试补证、真实入口补证；除非合同缺字段、证据冲突或用户要求复核，不重新读图。
- `blocked` 对象：只能登记缺口、寻找更清晰真相源；不得写机制修复、不得写规则断言测试。
- `disputed` 对象：必须先裁定冲突，裁定前不得实施机制修复。
- 本轮 P0 已补对象级测试和证据；下一步如果继续，应优先补真实 UI/在线房间证据，而不是回到 P1/P2 猜规则。

## 36. 更新后继续执行口径（2026-07-02 12:40 +08:00）

### 36.1 本轮纠偏结论

- 当前问题不是“还要不要重新录入”，而是继续前必须把录入合同状态当成入口门禁。
- 录入合同已经 `locked` 的对象，不再因为“继续审计”自动倒回读图、OCR、裁切或重新抄规则；后续只做实现对照、测试补证、真实入口证据。
- 录入合同为 `blocked` 的对象，不能用实现字段、i18n、OCR、旧测试或旧 evidence 补成规则结论；只能登记真相源缺口，或等高清卡图/官方原文补齐后再改状态。
- 录入合同为 `待建合同` 的对象，进入该批次的第一步不是修代码，而是先建合同：对象、真相源、子句、索引/归属、对照差异、状态。

### 36.2 后续继续默认路线

| 合同状态 | 当前对象范围 | 继续时做什么 | 禁止做什么 |
| --- | --- | --- | --- |
| `locked` | P0：雌狮「威势」、贾穆德「威势」、瑟拉·艾德温「城塞之力」、城塞圣武士「裁决」 | 补真实 UI、在线房间、乐观确认/重连不重复表现；必要时补最小测试或最小实现修复 | 不重新读图、不重新 OCR、不把录入层重新当阻塞 |
| `blocked` | P1 七个对象、P2 第一组已登记对象 | 登记真相源缺口；寻找高清卡图/官方原文；拿到来源后再转 `locked` 或 `disputed` | 不写机制修复、不写规则断言测试、不靠实现字段猜规则 |
| `待建合同` | P2 剩余对象、P3/P4 对象 | 先建对象级合同，再决定是否进入实现审计 | 不直接改机制、不直接拿旧测试当规则真相 |

### 36.3 本轮继续的正确下一步

- 如果继续 P0：优先补真实入口证据，而不是再录入；重点是「城塞之力」选牌入口截图/在线链路、「威势」充能点与特效不重复、「裁决」真实抓牌/日志表现。
- 如果继续 P1/P2：只补真相源缺口或来源索引；没有高清卡图/官方原文前，状态保持 `blocked`。
- 如果继续 P3/P4：先建合同状态表；表里没有 `locked / blocked / disputed` 前，不进入实现审计。
- 这条口径用于防止后续再次把“数据录入未锁定”和“实现审计已可推进”混在一起。

## 37. P0「城塞之力」真实入口 E2E 补证完成（2026-07-02 12:45 +08:00）

### 37.1 本轮继续对象

- 继续对象：瑟拉·艾德温「城塞之力」。
- 合同状态：`locked`。
- 真相来源：本轮已锁定的 P0 卡图/子句合同，不重新读图、不重新 OCR。
- 目标入口：现有在线 E2E 用例 `e2e/summonerwars/summonerwars-paladin-discard.e2e.ts` 中的「城塞之力：攻击阶段选择弃牌堆城塞单位回手」。
- 验收口径：真实页面打开「城塞之力」选牌入口，显示 `sw-card-selector-overlay`；选择弃牌堆城塞单位后，该单位进入手牌、从弃牌堆移除，且截图落到 evidence screenshot 路径。

### 37.2 已锁定的现有 E2E 证据入口

- 现有用例已经覆盖真实在线房间路径：
  - 创建圣堂骑士对死灵在线房间。
  - 注入「城塞之力」攻击阶段状态。
  - 点击瑟拉·艾德温。
  - 点击「城塞之力」按钮。
  - 等待 `sw-card-selector-overlay` 显示。
  - 截图 `fortress-power-card-selector-visible`。
  - 点击弃牌堆城塞单位。
  - 校验该牌进入手牌、离开弃牌堆，手牌数量增加 1。
  - 截图 `fortress-power-retrieve-complete`。
- 这说明下一步不需要新增录入或新增大 E2E；优先运行现有用例并把结果回写为真实入口证据。

### 37.3 本轮运行命令与结果

```powershell
node scripts/infra/run-e2e-single.mjs default e2e/summonerwars/summonerwars-paladin-discard.e2e.ts "城塞之力：攻击阶段选择弃牌堆城塞单位回手"
```

- 第一次运行被已有同类重任务 `e2e-run` 阻塞，本轮没有绕过重任务门禁，也没有设置并发绕过变量。
- 重任务门禁释放后已复跑同一命令，进入 Playwright 用例执行阶段。
- 结果：1 个用例通过，运行时长约 59.6 秒。
- 运行过程中复用隔离测试环境端口 `6174 / 20000 / 21000`，没有影响开发环境端口。
- 生成截图：
  - `test-results/evidence-screenshots/summonerwars/summonerwars-paladin-discard.e2e/城塞之力：攻击后从弃牌堆拿取城塞单位/fortress-power-card-selector-visible.png`
  - `test-results/evidence-screenshots/summonerwars/summonerwars-paladin-discard.e2e/城塞之力：攻击后从弃牌堆拿取城塞单位/fortress-power-retrieve-complete.png`

### 37.4 当前收口判断

- 「城塞之力」已补上真实在线入口证据：页面能打开选牌入口，`sw-card-selector-overlay` 可见，选择弃牌堆城塞单位后完成回手并通过最终状态校验。
- 这次补证证明的是 P0 `locked` 对象的真实入口链路，不涉及重新录入数据。
- P0 仍不能整体标为全面通过：雌狮「威势」、贾穆德「威势」和城塞圣武士「裁决」仍缺各自真实 UI/在线房间证据。
- 后续继续仍按合同状态走：P0 继续补真实入口证据，P1/P2 保持 `blocked`，不得回到猜规则或凭实现字段修机制。

## 38. 数据录入合同门禁回写到审计流程（2026-07-02 13:05 +08:00）

### 38.1 本轮纠偏原因

- 用户明确指出：当前阶段不是重新录入数据，也不是质疑已锁定对象的录入是否正确；数据录入必须先做好合同状态，后续实现审计才不会反复跑偏。
- 本轮问题暴露的是流程承接缺口：数据录入 skill 已经有 `locked / blocked / disputed` 退出门禁，但游戏审计 skill 和通用测试审计规范还没有把该状态写成审计第零步的强制分流。

### 38.2 已更新的流程入口

- 已更新 `.spec/skills/game-audit-workflow/SKILL.md`：新增“录入合同状态先于审计路线”门禁。
- 已更新 `.spec/knowledge/standards/testing-audit.md`：在“第零步：锁定权威描述”下新增“录入合同承接门禁”。
- 新门禁明确：
  - `locked` 对象继续实现对照、测试补证、真实入口证据和 L3/L4，不重新 OCR 或重录。
  - `blocked` 对象只登记真相源缺口，不写机制修复或规则断言测试。
  - `disputed` 对象先裁定冲突，冲突未裁定前不进入机制修复。
  - 无合同对象先建对象级合同表，再决定是否进入实现审计。

### 38.3 对召唤师战争当前任务的影响

- P0 已 `locked`：雌狮「威势」、贾穆德「威势」、瑟拉·艾德温「城塞之力」、城塞圣武士「裁决」后续不再回到读图/OCR；继续补真实 UI、在线房间、乐观确认/重连等运行态证据。
- P1/P2 保持 `blocked`：只能记录高清卡图/官方原文缺口；不得靠实现字段、i18n、旧测试或 OCR 写机制修复。
- P3/P4 仍是待建合同：进入批次前先建 `locked / blocked / disputed` 合同状态表。

### 38.4 当前继续路线

- 下一步仍按第 37 节后的 P0 路线推进：优先补雌狮「威势」、贾穆德「威势」、城塞圣武士「裁决」的真实 UI/在线房间证据。
- 「城塞之力」已补真实入口 E2E，后续只剩乐观确认/重连专项证据；不再重复录入该对象规则。

## 39. P0「雌狮」威势真实入口 E2E 补证完成（2026-07-02 13:55 +08:00）

### 39.1 本轮继续对象

- 继续对象：雌狮「威势」（`intimidate`）。
- 合同状态：`locked`。
- 真相来源：第 35/36/38 节已锁定的 P0 卡图/子句合同，不重新读图、不重新 OCR。
- 目标入口：新增在线 E2E 用例 `e2e/summonerwars/summonerwars-barbaric-abilities.e2e.ts` 中的「雌狮威势：攻击敌方单位后真实 UI 只显示一次充能」。
- 验收口径：真实在线房间中，雌狮攻击敌方单位后，核心状态 `boosts=1`，玩家攻击计数为 1，雌狮已攻击；真实 UI 只显示 1 个蓝色充能点，等待后不重复显示。

### 39.2 新增 E2E 覆盖

- 新增状态准备函数 `prepareIntimidateState`：
  - 创建炽原精灵对死灵在线房间。
  - 注入攻击阶段。
  - 放置雌狮、敌方亡灵战士、双方召唤师。
  - 清空本轮使用次数，确保验证的是「威势」本次攻击后的真实表现。
- 新增用例验证：
  - 攻击前雌狮卡面无蓝色充能点。
  - 固定骰子后点击雌狮攻击敌方单位。
  - 关闭骰子结果层后读取真实核心状态。
  - 断言雌狮 `boosts=1`、本方 `attackCount=1`、雌狮 `hasAttacked=true`。
  - 断言雌狮卡面 `.bg-blue-400` 充能点数量为 1。
  - 等待 1200ms 后再次断言仍为 1，防止同一事件被 UI 重放成重复充能点。

### 39.3 本轮运行命令与结果

```powershell
node scripts/infra/run-e2e-single.mjs default e2e/summonerwars/summonerwars-barbaric-abilities.e2e.ts "雌狮威势：攻击敌方单位后真实 UI 只显示一次充能"
```

- 第一次运行进入用例后失败在整页截图：`Page.captureScreenshot` 报 `Unable to capture screenshot`；该失败是截图方式问题，不是「威势」规则或状态结算失败。
- 已把截图收窄为雌狮单卡元素截图，避免整页截图资源不足。
- 后续复跑被已有同类重任务 `e2e-run` 多次阻塞，本轮没有设置并发绕过变量，也没有绕过重任务门禁；等待正在运行的 E2E 释放后继续复跑。
- 最终结果：1 个用例通过，运行时长约 57.9 秒。
- 运行过程中复用隔离测试环境端口 `6174 / 20000 / 21000`，没有影响开发环境端口。

### 39.4 截图证据与肉眼观察

- 攻击前截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-barbaric-abilities.e2e\雌狮威势：攻击敌方单位后真实-UI-只显示一次充能\intimidate-before-attack-no-charge.png`
  - 肉眼观察：雌狮单卡可见，卡面右上角没有蓝色充能点。
- 攻击后截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-barbaric-abilities.e2e\雌狮威势：攻击敌方单位后真实-UI-只显示一次充能\intimidate-after-attack-one-charge.png`
  - 肉眼观察：雌狮单卡可见，卡面右上角只有 1 个蓝色充能点；未出现重复蓝点堆叠。

### 39.5 当前收口判断

- 「雌狮」威势已补上真实在线入口证据：攻击敌方单位后状态只增加 1 点充能，真实 UI 只显示 1 个充能点，且短等待后不重复显示。
- 这次补证证明的是 P0 `locked` 对象的运行态表现，不涉及重新录入数据。
- P0 仍不能整体标为全面通过：贾穆德「威势」和城塞圣武士「裁决」仍缺各自真实 UI/在线房间证据；雌狮「威势」和「城塞之力」后续仍缺乐观确认/重连专项证据。

## 40. P0「贾穆德」威势真实入口 E2E 补证完成（2026-07-02 14:00 +08:00）

### 40.1 本轮继续对象

- 继续对象：贾穆德「威势」（`imposing`）。
- 合同状态：`locked`。
- 真相来源：第 35/36/38 节已锁定的 P0 卡图/子句合同，不重新读图、不重新 OCR。
- 目标入口：新增在线 E2E 用例 `e2e/summonerwars/summonerwars-frost-abilities.e2e.ts` 中的「贾穆德威势：攻击敌方单位后真实 UI 只显示一次充能」。
- 验收口径：真实在线房间中，贾穆德攻击敌方单位后，核心状态 `boosts=1`，玩家攻击计数为 1，贾穆德已攻击；真实 UI 只显示 1 个蓝色充能点，等待后不重复显示。

### 40.2 新增 E2E 覆盖

- 新增状态准备函数 `prepareImposingState`：
  - 创建极地矮人对死灵在线房间。
  - 注入攻击阶段。
  - 放置贾穆德、敌方亡灵战士、双方召唤师。
  - 清空本轮使用次数，确保验证的是「威势」本次攻击后的真实表现。
- 新增用例验证：
  - 攻击前贾穆德卡面无蓝色充能点。
  - 固定骰子后点击贾穆德攻击敌方单位。
  - 关闭骰子结果层后读取真实核心状态。
  - 断言贾穆德 `boosts=1`、本方 `attackCount=1`、贾穆德 `hasAttacked=true`。
  - 断言贾穆德卡面 `.bg-blue-400` 充能点数量为 1。
  - 等待 1200ms 后再次断言仍为 1，防止同一事件被 UI 重放成重复充能点。

### 40.3 本轮运行命令与结果

```powershell
node scripts/infra/run-e2e-single.mjs default e2e/summonerwars/summonerwars-frost-abilities.e2e.ts "贾穆德威势：攻击敌方单位后真实 UI 只显示一次充能"
```

- 第一次运行被已有同类重任务 `quality-gate` 阻塞，本轮没有设置并发绕过变量，也没有绕过重任务门禁。
- 重任务进程退出后，发现 `.git/boardgame-heavy-budget/registry.lock` 仍指向已退出的进程；本轮先核实锁内进程不存在，再清理该失效预算锁。
- 最终结果：1 个用例通过，运行时长约 52.8 秒。
- 运行过程中复用隔离测试环境端口 `6174 / 20000 / 21000`，没有影响开发环境端口。

### 40.4 截图证据与肉眼观察

- 攻击前截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-frost-abilities.e2e\贾穆德威势：攻击敌方单位后真实-UI-只显示一次充能\imposing-before-attack-no-charge.png`
  - 肉眼观察：贾穆德单卡可见，卡面右上角没有蓝色充能点。
- 攻击后截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-frost-abilities.e2e\贾穆德威势：攻击敌方单位后真实-UI-只显示一次充能\imposing-after-attack-one-charge.png`
  - 肉眼观察：贾穆德单卡可见，卡面右上角只有 1 个蓝色充能点；未出现重复蓝点堆叠。

### 40.5 当前收口判断

- 「贾穆德」威势已补上真实在线入口证据：攻击敌方单位后状态只增加 1 点充能，真实 UI 只显示 1 个充能点，且短等待后不重复显示。
- 这次补证证明的是 P0 `locked` 对象的运行态表现，不涉及重新录入数据。
- P0 仍不能整体标为全面通过：城塞圣武士「裁决」仍缺真实 UI/在线房间证据；雌狮「威势」、贾穆德「威势」和「城塞之力」后续仍缺乐观确认/重连专项证据。

## 41. P0「城塞圣武士」裁决真实入口 E2E 补证完成（2026-07-02）

### 41.1 本轮继续对象

- 继续对象：城塞圣武士「裁决」（`judgment`）。
- 合同状态：`locked`。
- 真相来源：第 35/36/38 节已锁定的 P0 卡图/子句合同，不重新读图、不重新 OCR。
- 目标入口：`e2e/summonerwars/summonerwars-paladin-discard.e2e.ts` 中的「城塞圣武士裁决：攻击敌方单位后按特殊符号真实抓牌」。
- 验收口径：真实在线房间中，城塞圣武士攻击敌方单位后，事件流里本次攻击骰子包含 3 个特殊符号；玩家手牌增加 3 张、牌库减少 3 张、攻击计数为 1，城塞圣武士已攻击；真实 UI 能看到抓牌后的手牌区域。

### 41.2 新增 E2E 覆盖

- 保留 P0 `locked` 规则合同，未回退到录入层。
- 改造原测试夹具：不再用浏览器本地骰子注入假定在线服务端骰子，而是通过服务端教程随机策略固定本次在线攻击骰子为 3 个 `melee + special` 面。
- 新增/使用状态准备：
  - 创建圣堂骑士对死灵在线房间。
  - 注入攻击阶段。
  - 放置城塞圣武士、敌方英雄、双方召唤师。
  - 清空玩家 0 手牌，并放入 4 张真实圣堂骑士牌作为牌库。
- 新增断言：
  - 攻击前玩家 0 手牌为 0，牌库至少 3 张。
  - 攻击后从服务端完整状态读取事件流，确认本次城塞圣武士攻击事件 `specialCount=3`。
  - 攻击后玩家 0 手牌增加 3 张、牌库减少 3 张。
  - 攻击后玩家 0 攻击计数为 1，城塞圣武士 `hasAttacked=true`。

### 41.3 本轮运行命令与结果

```powershell
node scripts/infra/run-e2e-single.mjs default e2e/summonerwars/summonerwars-paladin-discard.e2e.ts "城塞圣武士裁决：攻击敌方单位后按特殊符号真实抓牌"
```

- 最终结果：1 个用例通过，运行时长约 50.3 秒。
- 运行过程中复用隔离测试环境端口 `6174 / 20000 / 21000`，没有影响开发环境端口。
- 这次通过证明的是「裁决」真实在线入口抓牌表现；不是数据重新录入，也不是机制代码修复。
- 运行日志里出现 `splendor/picture` 图片加载失败告警，属于无关资源告警；本轮未处理，也不作为召唤师战争「裁决」验收证据。

### 41.4 截图证据与肉眼观察

- 攻击前截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-paladin-discard.e2e\城塞圣武士裁决：攻击敌方单位后按特殊符号真实抓牌\judgment-before-attack-empty-hand.png`
  - 肉眼观察：攻击前页面处于城塞圣武士可攻击状态，当前手牌为空，用于证明后续手牌增长不是历史残留。
- 攻击后截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-paladin-discard.e2e\城塞圣武士裁决：攻击敌方单位后按特殊符号真实抓牌\judgment-after-attack-three-cards.png`
  - 肉眼观察：攻击后手牌区域可见 3 张牌，符合本次事件流 3 个特殊符号对应抓 3 张牌的验收口径。

### 41.5 当前收口判断

- 「城塞圣武士」裁决已补上真实在线入口证据：攻击敌方单位后按特殊符号数量抓牌，且 UI 能看到抓牌后的手牌区域。
- P0 四个 `locked` 对象当前均已补真实在线入口证据：雌狮「威势」、贾穆德「威势」、瑟拉·艾德温「城塞之力」、城塞圣武士「裁决」。
- P0 仍不能整体标为 L4 全面通过：四个对象后续仍缺乐观确认/重连场景专项证据。
- P1/P2 当前仍保持 `blocked`：只能登记高清卡图/官方原文缺口，不得靠实现字段、i18n、旧测试或 OCR 写机制修复。

## 42. 所有漏审对象全面补审入口固化（2026-07-02）

### 42.1 本轮纠偏结论

- 用户明确补充：目标不是只继续 P0，也不是只把数据录入流程修好，而是“所有漏审都全面补审”。
- 因此本轮把召唤师战争 68 个能力风险对象全部重新纳入补审入口，先建立全量合同状态，再按 `locked / blocked / 待建合同` 分流。
- 本节不宣布全面审计完成；它只证明“所有漏审对象已经进入补审矩阵”，后续仍要逐对象补真相源、实现对照、测试证据和 L3/L4。

### 42.2 全量补审矩阵

- 已新增总矩阵：`evidence/summonerwars/full-leak-reaudit-master-matrix-2026-07-02.md`；临时生成副本保留在 `temp/summonerwars-audit/full-leak-reaudit-master-matrix.md`。
- 矩阵来源：`temp/summonerwars-audit/ability-risk-matrix.json` 的 68 个能力风险对象。
- 当前总量：

| 分层 | 数量 | 合同状态 | 当前处理口径 |
| --- | ---: | --- | --- |
| P0 | 4 | `locked` | 已补真实在线入口；继续 L4 乐观确认/重连/重复事件专项 |
| P1 | 7 | `blocked` | 只补高清卡图/官方原文；逐字锁定前不改机制 |
| P2 | 36 | `blocked` | 高风险机制链先补对象合同和权威原文；未锁前不写规则断言测试或机制修复 |
| P3 | 13 | `待建合同` | 先建对象级合同，再决定是否进入 L2/L3/L4 |
| P4 | 8 | `待建合同` | 建轻量合同；若发现触发、状态、UI 或共享链风险则升级 |

- 当前合同汇总：`locked` 4 个、`blocked` 43 个、`待建合同` 21 个。

### 42.3 不能再漏的执行规则

- P0：雌狮「威势」、贾穆德「威势」、瑟拉·艾德温「城塞之力」、城塞圣武士「裁决」不再回录入层；下一步补 L4。
- P1/P2：只要权威原文没有逐字锁定，就保持 `blocked`；不得用实现字段、i18n、OCR、旧测试或旧 evidence 猜规则。
- P3/P4：不能继续停在“低风险/以后再说”；必须先建对象级合同，至少登记对象、承载卡牌、触发、风险字段、真相源状态、下一步。
- 全量补审完成前，后续汇报不得再说“召唤师战争已全面审计完成”，只能说“某一层/某一批次已补到哪个证据等级”。

### 42.4 下一步执行入口

1. 已把 P3/P4 的 21 个 `待建合同` 对象落到 `evidence/summonerwars/p3-p4-contract-matrix-2026-07-02.md`，避免低风险对象继续漏审。
2. 已把 P2 的 36 个 `blocked` 对象按风险族拆到 `evidence/summonerwars/p2-risk-family-batches-2026-07-02.md`，不再只保留第一组。
3. P0 另开 L4 专项矩阵，补乐观确认、重连和重复事件回放证据。
4. 任一对象从 `blocked` 转 `locked` 或 `disputed`，必须回写本 evidence，再进入测试或代码修复。


## 43. P0 L4 专项补审入口（2026-07-02）

### 43.1 本轮新增动作

- 已新增 P0 L4 专项矩阵：`evidence/summonerwars/p0-l4-special-audit-matrix-2026-07-02.md`。
- 目的：防止把 P0 四个 `locked` 对象的 L3 真实在线入口证据误报成 L4 全面通过。
- 覆盖对象：雌狮「威势」、贾穆德「威势」、瑟拉·艾德温「城塞之力」、城塞圣武士「裁决」。

### 43.2 L4 仍缺的证据

| 对象 | 已有证据 | L4 缺口 |
| --- | --- | --- |
| 雌狮「威势」 | 攻击后 1 个充能点，UI 稳定不重复 | 乐观确认/重连后不重复充能 |
| 贾穆德「威势」 | 攻击后 1 个充能点，UI 稳定不重复 | 对象级重连/回放证据，不能只外推雌狮 |
| 瑟拉·艾德温「城塞之力」 | 选牌入口和回手完成已通过 | 重连后入口恢复正确；完成后不重复回手 |
| 城塞圣武士「裁决」 | 固定服务端随机后抓 3 张牌已通过 | 回放/重连后不重复抓牌，日志不重复追加 |

### 43.3 当前结论

- P0 已有 L3，但 L4 仍未完成。
- 下一步优先补「裁决」重连/回放，因为现有服务端随机夹具最接近 L4 验收入口。
- 该专项仍不涉及重新录入数据，也不允许回到 OCR/读图层。

## 44. P0「城塞圣武士」裁决 L4 重连/回放补证完成（2026-07-02）

### 44.1 本轮继续对象

- 继续对象：城塞圣武士「裁决」（`judgment`）。
- 合同状态：`locked`。
- 真相来源：沿用已锁定 P0 卡图/子句合同，不重新读图、不重新 OCR。
- 本轮目标：补 L4 中的“刷新/重连后不重复抓牌、事件不重复追加、日志/状态不重复回放”证据。

### 44.2 新增 L4 断言

- 在 `e2e/summonerwars/summonerwars-paladin-discard.e2e.ts` 的「城塞圣武士裁决：攻击敌方单位后按特殊符号真实抓牌」用例中新增刷新/重连段。
- 攻击后先锁定本次证据：特殊符号 3 个、`judgment` 抓牌事件 1 条、抓牌数 3、手牌 +3、牌库 -3、攻击计数 1、城塞圣武士已攻击。
- 随后执行 `hostPage.reload({ waitUntil: 'domcontentloaded' })` 回到同一在线房间，等待召唤师战争 UI 恢复后再次读取服务端完整状态。
- 重连后再次断言同一证据完全不变：抓牌事件仍为 1 条、抓牌数仍为 3、手牌仍为 +3、牌库仍为 -3；证明刷新/重连不会重复结算「裁决」。

### 44.3 本轮运行命令与结果

```powershell
node scripts/infra/run-e2e-single.mjs default e2e/summonerwars/summonerwars-paladin-discard.e2e.ts "城塞圣武士裁决：攻击敌方单位后按特殊符号真实抓牌"
```

- 结果：1 个用例通过，运行时长约 57.2 秒；Playwright 总耗时约 1.1 分钟。
- 运行环境：隔离测试端口 `6174 / 20000 / 21000`，未占用开发环境端口。
- 运行日志中的 `splendor/picture` 图片加载失败仍是无关资源告警，不作为召唤师战争验收证据。

### 44.4 截图证据

- 攻击前空手牌：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-paladin-discard.e2e\城塞圣武士裁决：攻击敌方单位后按特殊符号真实抓牌\judgment-before-attack-empty-hand.png`
- 攻击后抓 3 张牌：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-paladin-discard.e2e\城塞圣武士裁决：攻击敌方单位后按特殊符号真实抓牌\judgment-after-attack-three-cards.png`
- 刷新/重连后仍为 3 张牌：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-paladin-discard.e2e\城塞圣武士裁决：攻击敌方单位后按特殊符号真实抓牌\judgment-after-reload-still-three-cards.png`

### 44.5 当前收口判断

- 城塞圣武士「裁决」已从 L3 真实入口补到 L4 的重连/回放负向证据：同一在线房间刷新后不会重复抓牌，也不会重复追加 `judgment` 抓牌事件。
- P0 整体仍不能标 L4 全面通过：雌狮「威势」、贾穆德「威势」、瑟拉·艾德温「城塞之力」仍缺各自 L4 专项证据。
- 本轮没有重新录入数据，也没有回到 OCR/读图层。

## 45. 数据录入规则更新后的继续口径（2026-07-02）

### 45.1 为什么不能继续重读已锁对象

- 用户已明确指出：当前阶段不是重新录入数据，也不是重新质疑已锁定的卡图合同；数据录入要做扎实，是为了后续审计不跑偏。
- 因此本轮后续执行必须先看对象的录入合同状态，再决定路线：
  - `locked`：不再重新读图、不重新 OCR、不重新录入；直接进入实现对照、真实入口、L3/L4、重连/回放或残余缺口登记。
  - `blocked`：只补高清卡图、官方原文、索引或缺失真相源；不能写规则断言测试，不能改机制。
  - `disputed`：先裁定冲突；冲突没裁定前不能判通过，也不能修机制。
  - `待建合同`：先建对象级数据录入合同，至少登记对象、承载卡、主真相源、对照源、原子子句、索引/归属、合同状态。

### 45.2 当前 68 个漏审对象的继续路线

| 合同状态 | 数量 | 当前对象范围 | 下一步 |
| --- | ---: | --- | --- |
| `locked` | 4 | 雌狮「威势」、贾穆德「威势」、瑟拉·艾德温「城塞之力」、城塞圣武士「裁决」 | 不回录入层；继续 P0 L4 专项补证 |
| `blocked` | 43 | P1 7 个、P2 36 个 | 只补真相源缺口；逐字锁定前不写机制测试或代码修复 |
| `待建合同` | 21 | P3 13 个、P4 8 个 | 先建对象级合同，再决定是否进入审计 |

### 45.3 本轮继续动作与阻塞记录

- 已按 `locked` 路线修改威势族 E2E：雌狮「威势」和贾穆德「威势」用例新增刷新/重连后仍只有 1 个充能点的断言。
- 贾穆德「威势」已生成刷新后截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-frost-abilities.e2e\贾穆德威势：攻击敌方单位后真实-UI-只显示一次充能\imposing-after-reload-still-one-charge.png`。
- 但由于本机同时存在其他 E2E 重任务，后续重跑被重任务门禁拦截；本轮没有设置 `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1`，也没有绕过门禁。
- 因此当前不能把雌狮「威势」或贾穆德「威势」写成 L4 已通过；只能记录为“L4 断言已补，仍待独立 E2E 命令通过后回写矩阵”。

### 45.4 下一步顺序

1. 等同类 E2E 重任务释放后，单独重跑雌狮「威势」L4 用例。
2. 单独重跑贾穆德「威势」L4 用例，拿到明确命令通过输出后再把 P0 矩阵改成 L4 已补。
3. 再补瑟拉·艾德温「城塞之力」L4：未完成选择时刷新/重连恢复同一选牌入口，完成选择后刷新/重连不重复回手。
4. P0 L4 未清空前，不推进 P1/P2 机制修复；P1/P2 只允许补真相源缺口。
5. P3/P4 继续从对象级数据录入合同开始，不再让低风险对象停留在“以后再说”。


## 46. 数据录入图源索引补齐（2026-07-02）

### 46.1 本轮动作

- 已新增/刷新数据录入真相源索引：`evidence/summonerwars/data-entry-source-map-2026-07-02.md`。
- 覆盖 68 个能力风险对象，展开为 74 条对象-卡牌图源行。
- 本轮只锁定“对象 -> 卡牌 -> 本地图集 -> sprite 帧/裁切区域”入口；不把图源入口等同于规则文字 locked。

### 46.2 当前结果

- 图源状态：image_source_located=74。
- 已补齐两个先前未映射的内部 continuation 归属：`ice_ram` 归属寒冰冲撞，`mind_capture_resolve` 归属泰珂露「心灵捕获」确认分支。
- 合同状态仍按总矩阵分流：`locked` 4 个对象继续 L3/L4；`blocked` 43 个对象只补高清卡图/官方原文；`待建合同` 21 个对象先建对象级合同。
- 这一步解决的是“后续从哪里读卡图/裁图、哪张卡属于哪个对象”的录入入口问题，不是机制修复，也不是规则锁定完成。

### 46.3 继续口径

1. P0：不回录入层，继续 L4 补证。
2. P1/P2：使用本图源索引生成清晰单卡/局部裁图；只有逐字子句锁定后才允许进入实现对照。
3. P3/P4：用本索引补对象级合同，不能再让低风险对象停留在未建合同状态。


## 47. 数据录入裁图清单补齐（2026-07-02）

### 47.1 本轮动作

- 已新增数据录入裁图清单：`evidence/summonerwars/data-entry-crop-manifest-2026-07-02.md`。
- 已从本地图集生成 49 张唯一卡牌的完整单卡裁图和文字区辅助裁图。
- 裁图只写入 `temp/summonerwars-audit/card-crops-2026-07-02/`，没有写入运行时资源目录，也没有改变游戏资源。

### 47.2 当前意义

- 这一步把“后续该读哪张图”落到可打开的单卡裁图，避免后续继续在整张 atlas 或实现字段里猜。
- `blocked` 对象仍不是 locked；下一步要逐张用完整单卡 + 文字区裁图锁原子子句。
- `locked` 对象不因裁图存在而回到录入层；仍按 P0 L4 继续补证。

### 47.3 下一步

1. P1/P2 从这些裁图里逐张锁规则文字；看不清就保持 `blocked` 并登记缺口。
2. P3/P4 用这些裁图补对象级合同，不能再停留在“待建合同”。
3. P0 等 E2E 重任务释放后继续 L4 补证，不走重录路线。


## 48. P3/P4 对象级合同入口补齐（2026-07-02）

### 48.1 本轮动作

- 已更新 `evidence/summonerwars/p3-p4-contract-matrix-2026-07-02.md`，把 P3/P4 的 21 个待建合同对象从“总队列占位”推进到对象级合同入口。
- 每个对象已补齐：承载卡牌、主图源/图集帧、完整单卡裁图、文字区裁图、实现入口、当前实现摘要、仍缺的合同字段。
- 本轮没有重录 P0 locked 对象，没有使用 OCR 结论替代规则原文，也没有改机制代码。

### 48.2 当前分流结果

| 范围 | 本轮推进 | 当前状态 |
| --- | --- | --- |
| P3 13 个状态/数值链对象 | 已补主图源、裁图路径、实现入口和实现效果摘要 | 仍为 `待建合同-入口已补`，缺逐字卡图原文和原子子句 |
| P4 8 个低风险候选对象 | 已补轻量合同入口；发现部分对象不是纯静态 | 仍不能判通过，需继续逐字锁原文并决定是否升级 |
| 充能/数值家族 | 已识别 `blood_rage`、`blood_rage_decay`、`power_boost`、`power_up`、`life_up`、`gather_power` 为共享状态家族 | 下一步统一审“写入、读取、清理、上限、回放重复” |
| 低风险可疑对象 | `fire_sacrifice_summon`、`living_gate`、`mobile_structure` 出现外部命令/helper 消费迹象 | 不得继续按纯 P4 放过，下一步优先升级复核 |

### 48.3 不能误判的边界

- 本轮补齐的是“对象级合同入口”，不是规则文字 `locked`。
- `待建合同-入口已补` 仍不能写规则断言测试，不能改机制，也不能说对象已审完。
- 下一步应继续从这些入口裁图锁逐字规则；看不清仍保持缺口，不拿实现摘要倒推规则。

## 49. P2 blocked 对象合同入口补齐（2026-07-02）

### 49.1 本轮动作

- 已新增 `evidence/summonerwars/p2-blocked-contract-entry-matrix-2026-07-02.md`。
- P2 36 个 blocked 能力对象已从风险族名单推进到对象级合同入口：承载卡牌、主图源/帧、完整单卡裁图、文字区裁图、风险族、实现入口摘要和下一步缺口均已登记。
- 本轮没有把任何 P2 对象改成 `locked`，也没有写规则断言测试或机制代码。

### 49.2 当前分流结果

| 范围 | 本轮推进 | 当前状态 |
| --- | --- | --- |
| P2 36 个唯一能力对象 | 已补对象级合同入口 | 全部仍为 `blocked-入口已补` |
| P2 对象-卡牌图源行 | 已覆盖 37 行图源入口 | 仍需逐字锁规则原文 |
| P2 裁图入口 | 36 / 36 已匹配完整单卡和文字区裁图 | 裁图只作为真相源入口，不等于规则 locked |
| P2 实现入口 | 36 / 36 已定位能力定义或 continuation 定义 | 实现摘要只能辅助对照，不能倒推规则 |

### 49.3 下一步优先级

1. 先处理目标/交互选择族与每回合次数族：这些对象最容易引发卡死、重复结算、取消路径缺失。
2. 再处理 custom 后续结算族：必须追到最终状态和共享消费者，不能只看入口 actionId。
3. `ice_ram` 和 `mind_capture_resolve` 只算承载卡归属已补，仍要锁事件卡/召唤师卡原文和 continuation 确认分支。
4. 每个对象只有逐字规则原文和原子子句锁定后，才能从 `blocked-入口已补` 转为 `locked` 或 `disputed`。

## 50. 总矩阵状态回写：P2/P3/P4 入口合同已补（2026-07-02）

### 50.1 本轮动作

- 已同步更新 `evidence/summonerwars/full-leak-reaudit-master-matrix-2026-07-02.md`。
- P2 36 个对象从 `blocked` 的风险族名单推进为 `blocked-入口已补`：对象级合同入口已补，但规则原文仍未 locked。
- P3/P4 21 个对象从 `待建合同` 推进为 `待建合同-入口已补`：对象级合同入口已补，但仍缺逐字原文、原子子句、最终状态和负向断言。

### 50.2 当前不能误判

- 这次是“入口合同补齐”，不是“规则锁定完成”。
- P2/P3/P4 仍不能写规则断言测试，不能改机制代码，不能宣称对象已审完。
- 下一步继续按合同状态推进：P0 做 L4；P1/P2 锁权威原文；P3/P4 从入口合同继续锁原文并决定是否升级。

## 51. 总矩阵状态精确修正（2026-07-02）

### 51.1 本轮动作

- 已精确修正 `evidence/summonerwars/full-leak-reaudit-master-matrix-2026-07-02.md` 的状态列与汇总行。
- P2 行状态统一为 `blocked-入口已补`；P3/P4 行状态统一为 `待建合同-入口已补`。
- 该修正只同步入口合同状态，不把任何对象升级为 `locked`。

### 51.2 继续边界

- P1 仍是 `blocked`，因为只定位图源入口，尚未补对象级合同入口。
- P2/P3/P4 只是入口合同已补，仍缺逐字规则原文和原子子句。
- 后续继续补审时不得再重复建 P2/P3/P4 入口表，应直接进入逐字规则锁定或缺口登记。

## 52. P1 blocked 对象合同入口补齐（2026-07-02）

### 52.1 本轮动作

- 已新增 `evidence/summonerwars/p1-blocked-contract-entry-matrix-2026-07-02.md`。
- P1 7 个 blocked 能力对象已从第二批名单推进到对象级合同入口：承载卡牌、主图源/帧、完整单卡裁图、文字区裁图、风险族、实现入口摘要和下一步缺口均已登记。
- 已同步更新总矩阵：P1/P2 的 blocked 对象均进入 `blocked-入口已补`，但规则原文仍未 locked。

### 52.2 当前不能误判

- P1 仍不能写规则断言测试，不能改机制代码，不能按实现摘要倒推规则。
- P1 下一步不是重新找入口，而是从已登记的完整单卡和文字区裁图逐字锁规则；看不清则继续保持 blocked 缺口。
- 至此 P1/P2/P3/P4 的对象级入口合同均已补齐，后续应进入逐字规则锁定、缺口登记、P0 L4 补证。

## 53. 逐字规则锁定批次队列建立（2026-07-02）

### 53.1 本轮动作

- 已新增 `evidence/summonerwars/rule-text-lock-batch-queue-2026-07-02.md`。
- P1/P2/P3/P4 已不再停留在“入口还没建”的阶段；下一步统一进入逐字规则锁定批次。
- 批次按风险排序：P1 攻击后与额外攻击、P1 充能准备、P2 目标交互与每回合次数、P2 攻击窗口与召唤转移、P2 custom/continuation、P3 充能与数值共享链、P3 移动穿越与相邻离开、P4 疑似升级对象。

### 53.2 当前不能误判

- 该队列只是下一阶段执行入口，不代表规则文字已经 locked。
- 后续不能再重复建 P1/P2/P3/P4 入口合同；应直接逐字锁规则原文，锁不住就登记缺口。
- 未逐字锁定前，仍不能写规则断言测试、不能修机制代码、不能宣称对应对象已审完。

## 54. P0「威势」族 L4 重连/回放补证完成（2026-07-02）

### 54.1 本轮动作

- 已回写 `evidence/summonerwars/p0-l4-special-audit-matrix-2026-07-02.md`：雌狮「威势」和贾穆德「威势」均从 L3 真实入口证据推进为 L4 重连/回放已补。
- 本轮没有重新读取 P0 卡图、没有重录数据、没有用 OCR 或实现字段反推规则；P0 仍沿用已 locked 的卡图子句合同。
- 本轮也没有修改机制代码；只把已通过的真实在线 E2E 结果回写到正式 evidence。

### 54.2 雌狮「威势」L4 证据

- 通过命令：`node scripts/infra/run-e2e-single.mjs default e2e/summonerwars/summonerwars-barbaric-abilities.e2e.ts "雌狮威势：攻击敌方单位后真实 UI 只显示一次充能"`。
- 断言覆盖：攻击后状态为 `{ boosts: 1, attackCount: 1, hasAttacked: true }`；真实 UI 只显示 1 个充能点；刷新/重连后状态仍为 `{ boosts: 1, attackCount: 1, hasAttacked: true }`；刷新后 UI 仍只显示 1 个充能点。
- 截图证据：
  - `test-results/evidence-screenshots/summonerwars/summonerwars-barbaric-abilities.e2e/雌狮威势：攻击敌方单位后真实-UI-只显示一次充能/intimidate-before-attack-no-charge.png`
  - `test-results/evidence-screenshots/summonerwars/summonerwars-barbaric-abilities.e2e/雌狮威势：攻击敌方单位后真实-UI-只显示一次充能/intimidate-after-attack-one-charge.png`
  - `test-results/evidence-screenshots/summonerwars/summonerwars-barbaric-abilities.e2e/雌狮威势：攻击敌方单位后真实-UI-只显示一次充能/intimidate-after-reload-still-one-charge.png`

### 54.3 贾穆德「威势」L4 证据

- 通过命令：`node scripts/infra/run-e2e-single.mjs default e2e/summonerwars/summonerwars-frost-abilities.e2e.ts "贾穆德威势：攻击敌方单位后真实 UI 只显示一次充能"`。
- 断言覆盖：攻击后状态为 `{ boosts: 1, attackCount: 1, hasAttacked: true }`；真实 UI 只显示 1 个充能点；刷新/重连后状态仍为 `{ boosts: 1, attackCount: 1, hasAttacked: true }`；刷新后 UI 仍只显示 1 个充能点。
- 截图证据：
  - `test-results/evidence-screenshots/summonerwars/summonerwars-frost-abilities.e2e/贾穆德威势：攻击敌方单位后真实-UI-只显示一次充能/imposing-before-attack-no-charge.png`
  - `test-results/evidence-screenshots/summonerwars/summonerwars-frost-abilities.e2e/贾穆德威势：攻击敌方单位后真实-UI-只显示一次充能/imposing-after-attack-one-charge.png`
  - `test-results/evidence-screenshots/summonerwars/summonerwars-frost-abilities.e2e/贾穆德威势：攻击敌方单位后真实-UI-只显示一次充能/imposing-after-reload-still-one-charge.png`

### 54.4 继续边界

- P0 已完成 L4 的对象：雌狮「威势」、贾穆德「威势」、城塞圣武士「裁决」。
- P0 仍未完成 L4 的对象：瑟拉·艾德温「城塞之力」。
- 下一步继续审「城塞之力」的两个真实在线恢复场景：未完成选择时刷新/重连恢复同一选牌入口；完成选择后刷新/重连不重复回手。
- P1/P2/P3/P4 仍按第 53 节队列推进逐字规则锁定；入口合同已补不等于 locked。

## 55. P0「城塞之力」L4 重连/回放补证完成（2026-07-02）

### 55.1 本轮动作

- 已扩展 `e2e/summonerwars/summonerwars-paladin-discard.e2e.ts` 中「城塞之力：攻击阶段选择弃牌堆城塞单位回手」用例。
- 本轮没有重新读取「城塞之力」卡图、没有重录数据、没有用实现字段反推规则；该对象继续沿用已 locked 的卡图子句合同。
- 本轮修改的是真实在线 E2E 断言：补未完成选择刷新恢复入口、完成选择后刷新不重复回手。

### 55.2 通过命令

`node scripts/infra/run-e2e-single.mjs default e2e/summonerwars/summonerwars-paladin-discard.e2e.ts "城塞之力：攻击阶段选择弃牌堆城塞单位回手"`

结果：1 passed。

### 55.3 断言覆盖

- 触发「城塞之力」后，真实页面打开 `sw-card-selector-overlay` 选牌入口，候选卡包含目标弃牌堆城塞单位。
- 未完成选择时刷新同一在线房间，页面恢复棋盘和手牌 UI，且同一 `sw-card-selector-overlay` 选牌入口仍可见，候选卡仍是同一张弃牌堆城塞单位。
- 完成选择后，该城塞单位进入手牌、从弃牌堆移除，手牌数量只增加 1。
- 完成选择后再次刷新同一在线房间，选牌入口不再出现；该城塞单位仍只在手牌中，弃牌堆仍不包含该卡，手牌数量仍只增加 1。

### 55.4 截图证据

- `test-results/evidence-screenshots/summonerwars/summonerwars-paladin-discard.e2e/城塞之力：攻击后从弃牌堆拿取城塞单位/fortress-power-card-selector-visible.png`
- `test-results/evidence-screenshots/summonerwars/summonerwars-paladin-discard.e2e/城塞之力：攻击后从弃牌堆拿取城塞单位/fortress-power-card-selector-after-reload.png`
- `test-results/evidence-screenshots/summonerwars/summonerwars-paladin-discard.e2e/城塞之力：攻击后从弃牌堆拿取城塞单位/fortress-power-retrieve-complete.png`
- `test-results/evidence-screenshots/summonerwars/summonerwars-paladin-discard.e2e/城塞之力：攻击后从弃牌堆拿取城塞单位/fortress-power-after-reload-still-retrieved-once.png`

### 55.5 P0 收口与继续边界

- P0 四个 locked 对象的 L4 重连/回放专项均已补：雌狮「威势」、贾穆德「威势」、瑟拉·艾德温「城塞之力」、城塞圣武士「裁决」。
- 已同步更新 `evidence/summonerwars/p0-l4-special-audit-matrix-2026-07-02.md` 和 `evidence/summonerwars/full-leak-reaudit-master-matrix-2026-07-02.md`。
- P0 不代表召唤师战争全面审计完成；P1/P2/P3/P4 仍按第 53 节队列继续逐字锁规则原文。
- 下一步从 `evidence/summonerwars/rule-text-lock-batch-queue-2026-07-02.md` 的 B1 开始，只做规则文字锁定和缺口登记；未 locked 前不写规则断言测试、不改机制代码。

## 56. B1 P1 攻击后与额外攻击规则原文锁定（2026-07-02）

### 56.1 本轮动作

- 已新增 `evidence/summonerwars/b1-p1-rule-text-lock-matrix-2026-07-02.md`。
- B1 五个对象完成官方英文原文和原子子句锁定：`rapid_fire`、`withdraw`、`high_telekinesis`、`mind_transmission`、`telekinesis`。
- 本轮没有重读 P0，没有改机制代码，没有写规则断言测试；只做数据录入合同的逐字规则锁定。

### 56.2 权威来源

- 官方站点静态包：`https://summonerwars.plaidhatgames.com/static/js/main.610e76c5.chunk.js`。
- 抽取字段：能力名的 `|TEXT` / `|DIGITAL` 条目。
- 对照入口：`evidence/summonerwars/data-entry-crop-manifest-2026-07-02.md` 中的完整单卡裁图和文字区裁图。

### 56.3 已锁对象

| 对象 | 官方能力名 | 锁定结论 |
| --- | --- | --- |
| `rapid_fire` | Swift Shot | 每回合一次；本单位攻击后；可消耗 1 充能；若消耗则本单位结算一次额外攻击 |
| `withdraw` | Withdraw | 本单位攻击后；可消耗 1 充能或 1 魔力；若消耗则强制移动本单位 1 或 2 格 |
| `high_telekinesis` | Greater Push | 本单位攻击后或代替攻击；可目标 3 格内士兵或英雄；强制移动目标 1 格 |
| `mind_transmission` | Telepathic Command | 本单位攻击敌方卡牌后；可目标 3 格内友方士兵；目标结算一次额外攻击 |
| `telekinesis` | Push | 本单位攻击后或代替攻击；可目标 2 格内士兵或英雄；强制移动目标 1 格 |

### 56.4 状态回写

- 已同步更新 `evidence/summonerwars/full-leak-reaudit-master-matrix-2026-07-02.md`：B1 五个对象从 `blocked-入口已补` 推进为 `locked-规则原文已锁`。
- P1 仍有两个对象未按 B2 正式收口：`prepare`、`inspire`。
- P1/P2/P3/P4 仍未全面完成；B1 下一步是实现对照，不是直接修机制。

### 56.5 继续边界

- B1 对象已可进入实现对照；如果实现与第 56.3 节原子子句冲突，先转 `disputed`，再写最小失败测试和最小修复。
- B2 继续锁 `prepare`、`inspire` 的规则原文；虽然官方包中已出现相关文本，本轮仍不把 B2 直接判完成。
- 后续不得再用实现摘要、i18n、旧测试或 OCR 倒推 B1 规则。

## 57. 录入质量与继续审计边界纠偏（2026-07-02）

### 57.1 本轮纠偏

- 用户明确纠偏：当前阶段不是反复重新读图或重新录入已锁对象；但数据录入必须先做扎实，否则后续实现审计会继续跑偏。
- 已同步更新 `.spec/skills/data-entry-workflow/SKILL.md`、`.spec/skills/game-audit-workflow/SKILL.md` 和 `.spec/knowledge/standards/testing-audit.md`。
- 更新后的口径是：`locked` 不是跳过录入质量，而是录入质量已达标后的承接状态；后续继续时进入实现对照、测试补证或缺口登记。

### 57.2 继续规则

- 对 B1 已 `locked-规则原文已锁` 的五个对象，不再回到 OCR、裁图重读或实现字段倒推；下一步直接做实现对照。
- 若实现对照发现合同缺字段、来源冲突或对象归属不清，先把对象回写为 `blocked` 或 `disputed` 并补齐合同；不得在实现审计中临时猜规则。
- 对仍为 `blocked-入口已补` 或 `待建合同-入口已补` 的对象，继续补规则原文和原子子句；未逐字锁定前不写规则断言测试、不改机制代码。

## 58. B1 P1 实现对照启动与差异分流（2026-07-02）

### 58.1 本轮动作

- 已新增 `evidence/summonerwars/b1-p1-implementation-diff-matrix-2026-07-02.md`。
- 本轮没有重新读图、没有重新 OCR、没有重录 B1 数据；直接沿用第 56 节已锁官方原文和原子子句。
- 对照范围只覆盖 B1 五个对象：`rapid_fire`、`withdraw`、`high_telekinesis`、`mind_transmission`、`telekinesis`。

### 58.2 历史分流结论（当前以第 59 节为准）

本小节保留当时启动实现对照时的历史分流；第 59 节已经补齐三个疑点的最小验证，当前状态不再按本表的 `suspected-gap` 执行。

| 对象 | 中文承载卡 | 历史分流 | 当前状态 |
| --- | --- | --- | --- |
| `rapid_fire` | 梅肯达·露、边境弓箭手 | `match-领域链已对齐` | 攻击后触发、每回合一次、确认后消耗 1 充能并授予本单位额外攻击，与官方原文对齐 |
| `withdraw` | 凯鲁尊者 | `match-with-rule-note` | 攻击后可选、消耗 1 充能或 1 魔力、移动自身 1-2 格对齐；直线/路径为空属于通用 Force 细则，后续补规则来源 |
| `high_telekinesis` | 卡拉 | `suspected-gap`（历史） | 第 59 节已回写为 `match-with-type-proof` |
| `mind_transmission` | 古尔壮 | `suspected-gap`（历史） | 第 59 节已回写为 `match-with-trigger-proof` |
| `telekinesis` | 清风法师 | `suspected-gap`（历史） | 第 59 节已回写为 `match-with-type-proof` |

### 58.3 继续边界

- 本节的 `suspected-gap` 为历史启动状态，不是当前待办；第 59 节已经完成最小验证并回写。
- `rapid_fire`、`withdraw` 不回录入层，后续进入真实入口 L3/L4 补证。
- 若最小验证证明规则原文与实现冲突，再把对应对象转 `disputed`，并按“失败测试 → 最小修复 → evidence 回写”推进。

## 59. B1 P1 实现疑点最小验证回写（2026-07-02）

### 59.1 本轮动作

- 本轮继续承接第 56 节已 locked 的 B1 录入合同，没有重新读图、没有 OCR、没有重录规则原文。
- 已在 `src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts` 补最小验证，覆盖第 58 节中三个 `suspected-gap` 对象：古尔壮「心灵传念」、卡拉「高阶念力」、清风法师「念力」。
- 本轮没有因为疑点直接改机制逻辑；验证结果用于把疑点回写为可证明状态。

### 59.2 验证命令

`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "fortress_power|telekinesis|high_telekinesis|mind_transmission"`

结果：1 个测试文件通过；16 passed、78 skipped。

### 59.3 分流回写

| 对象 | 中文承载卡 | 原疑点 | 最小验证结果 | 回写状态 |
| --- | --- | --- | --- | --- |
| `mind_transmission` | 古尔壮 | “攻击敌方卡牌后”缺显式实现证据，需确认敌方建筑与非敌方目标 | 攻击敌方建筑后生成心灵传念选择；普通攻击友方目标可结算，但因不属于“敌方卡牌”不生成传念入口 | `match-with-trigger-proof` |
| `high_telekinesis` | 卡拉 | 目标过滤只显式排除召唤师，需确认是否会纳入建筑/非士兵英雄 | 建筑目标验证失败；系统候选只遍历 `cell.unit`，建筑是 `BoardStructure`；`UnitClass` 只有召唤师/英雄/士兵 | `match-with-type-proof` |
| `telekinesis` | 清风法师 | 同上 | 建筑目标验证失败；系统候选只遍历 `cell.unit`，建筑是 `BoardStructure`；`UnitClass` 只有召唤师/英雄/士兵 | `match-with-type-proof` |

### 59.4 继续边界

- B1 五个 locked 对象本轮不再停留在“实现证据不足”的首轮疑点状态。
- `rapid_fire`、`mind_transmission` 后续仍需补真实入口 L3/L4：确认后只授予一次额外攻击，刷新/回放不重复授予。
- `withdraw`、`high_telekinesis`、`telekinesis` 后续需补通用 Force / 稳固规则来源；若通用规则来源与当前实现冲突，再降级为 `disputed`。
- P1 剩余 `prepare`、`inspire` 仍未完成正式 B2 锁定；未 locked 前仍不能写规则断言测试或改机制代码。

## 60. B2 P1 充能准备规则原文锁定（2026-07-02）

### 60.1 本轮动作

- 已新增 `evidence/summonerwars/b2-p1-rule-text-lock-matrix-2026-07-02.md`。
- B2 两个对象完成官方英文原文和原子子句锁定：梅肯达·露/边境弓箭手「准备」、凯鲁尊者「鼓舞」。
- 本轮只推进数据录入合同锁定，没有重新质疑 B1 已 locked 数据，没有写规则断言测试，没有改机制代码。

### 60.2 权威来源

- 官方站点静态包：`https://summonerwars.plaidhatgames.com/static/js/main.610e76c5.chunk.js`。
- 本地缓存：`temp/summonerwars-audit/official-cache/main.610e76c5.chunk.js`。
- 命中字段：`Prepare|TEXT` / `Prepare|DIGITAL`、`Inspire|TEXT` / `Inspire|DIGITAL`。

### 60.3 已锁对象

| 对象 | 中文承载卡 | 官方能力名 | 锁定结论 |
| --- | --- | --- | --- |
| `prepare` | 梅肯达·露、边境弓箭手 | Prepare | 代替本单位移动；可选；给本单位 1 个充能；卡面未写每回合一次 |
| `inspire` | 凯鲁尊者 | Inspire | 本单位移动后；给每个相邻友方单位 1 个充能；卡面未写可选、每回合一次或士兵/英雄限制 |

### 60.4 状态回写

- 已同步更新 `evidence/summonerwars/full-leak-reaudit-master-matrix-2026-07-02.md`：`prepare`、`inspire` 从 `blocked-入口已补` 推进为 `locked-规则原文已锁`。
- 已同步更新 `evidence/summonerwars/rule-text-lock-batch-queue-2026-07-02.md`：B2 从待锁定推进为已锁定。
- P1 七个对象现在均已完成规则原文 locked；下一步是 P1 实现对照和真实入口补证，不回录入层。

### 60.5 继续边界

- `prepare` 的 `usesPerTurn=1` 是当前实现事实，不是卡面原文子句；实现对照时必须区分“代替移动”的行动经济与额外次数限制。
- `inspire` 官方原文是强制口径：“After this unit moves, boost each friendly adjacent unit.” 后续不得把它误读成可选或只限士兵。
- 后续若发现实现与第 60.3 节冲突，先转 `disputed`，再按失败测试和最小修复推进。

## 61. B2 P1 实现对照启动与差异分流（2026-07-02）

### 61.1 本轮动作

- 已新增 `evidence/summonerwars/b2-p1-implementation-diff-matrix-2026-07-02.md`。
- 本轮继续承接第 60 节已 locked 的 B2 录入合同，没有重新读图、没有 OCR、没有重录规则原文。
- 对照范围只覆盖两个已锁对象：梅肯达·露/边境弓箭手「准备」（`prepare`）、凯鲁尊者「鼓舞」（`inspire`）。

### 61.2 历史分流结论（当前以第 62 节为准）

本小节保留 B2 首轮实现对照启动时的待补证状态；第 62 节已经完成最小验证，当前不再按本表的 `proof-needed` 执行。

| 对象 | 中文承载卡 | 历史分流 | 当前状态 |
| --- | --- | --- | --- |
| `prepare` | 梅肯达·露、边境弓箭手 | `match-with-economy-proof-needed`（历史） | 第 62 节已回写为 `match-with-economy-proof` |
| `inspire` | 凯鲁尊者 | `match-with-auto-proof-needed`（历史） | 第 62 节已回写为 `match-with-auto-proof` |

### 61.3 继续边界

- B2 当前没有确认 bug，也不改机制代码。
- 本节的待补证状态为历史启动状态；第 62 节已经证明「准备」的行动经济等价，以及「鼓舞」移动后自动结算的目标全集与负向场景。
- 若最小验证失败，再把对应对象转 `disputed`，并按“失败测试 → 最小修复 → evidence 回写”推进。

## 62. B2 P1 最小验证回写（2026-07-02）

### 62.1 本轮动作

- 本轮继续承接第 60 节已 locked 的 B2 录入合同和第 61 节实现对照矩阵，没有重新读图、没有 OCR、没有重录规则原文。
- 已在 `src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts` 补两个最小验证：
  - `[prepare] 准备后应等价消耗移动并给自身1个充能`
  - `[inspire] 凯鲁尊者移动后应强制充能每个相邻友方单位`
- 本轮没有改机制代码；测试只用于证明已锁规则合同与当前实现是否对齐。

### 62.2 验证命令

`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "prepare|inspire"`

结果：1 个测试文件通过；7 passed、89 skipped。

### 62.3 分流回写

| 对象 | 中文承载卡 | 原疑点 | 最小验证结果 | 回写状态 |
| --- | --- | --- | --- | --- |
| `prepare` | 梅肯达·露、边境弓箭手 | `usesPerTurn=1` 需要证明不是额外改写卡面规则，而是行动经济保护 | 未移动时可准备；准备后自身 +1 充能且 `hasMoved=true`；准备后不能再移动 | `match-with-economy-proof` |
| `inspire` | 凯鲁尊者 | 需证明移动后强制充能每个相邻友方单位，且敌方/非相邻不误中 | 移动后两个相邻友方分别 +1；敌方相邻单位不变；非相邻友方不变；无交互入口参与 | `match-with-auto-proof` |

### 62.4 继续边界

- B2 两个对象首轮实现对照已从 `proof-needed` 回写为 `proof`，当前不进入机制修复。
- 下一步不再回到 B2 录入层；应继续 P1 的真实入口/L3-L4 补证，或转入 B3-P2 逐字规则锁定。
- 若后续真实入口、刷新/回放或 UI 入口证据与本节状态冲突，再把对应对象降级为 `disputed`。

## 63. B3 P2 目标交互与每回合次数规则原文锁定（2026-07-02）

### 63.1 本轮动作

- 已新增 `evidence/summonerwars/b3-p2-rule-text-lock-matrix-2026-07-02.md`。
- B3 十二个对象完成官方英文原文和原子子句锁定：巨食兽「喂食巨食兽」、雷塔勒斯「复活亡灵」、阿布亚·石「魂灵纽带」、思尼克斯「狡黠」、布拉夫「血符文」、寒冰锻造师「寒冰斧」、部落抓附手「抓附」、圣殿牧师「治疗」、城塞弓箭手「光之箭」、心灵巫女「拟态」、斯瓦拉「结构变换」、祖灵法师「祖灵交流」。
- 本轮只推进数据录入合同锁定，没有写规则断言测试，没有改机制代码。

### 63.2 命名映射裁定

- 阿布亚·石「魂灵纽带」（`ancestral_bond`）对应官方 `Spirit Bond`。
- 祖灵法师「祖灵交流」（`spirit_bond`）对应官方 `Commune with Spirits`。
- 心灵巫女「拟态」（`illusion`）对应官方 `Mimic`，不是官方 `Illusions`。
- 思尼克斯「狡黠」（`vanish`）对应官方 `Sly`；部落抓附手「抓附」（`grab`）对应官方 `Cling`。

### 63.3 状态回写

- 已同步更新 `evidence/summonerwars/full-leak-reaudit-master-matrix-2026-07-02.md`：B3 十二个 P2 对象从 `blocked-入口已补` 推进为 `locked-规则原文已锁`。
- 已同步更新 `evidence/summonerwars/rule-text-lock-batch-queue-2026-07-02.md`：P2 顶部基线改为 B3 12 个 locked、其余 24 个仍 blocked；B3 行改为已锁。
- B3 下一步是实现对照和最小验证分流，不回录入层。

### 63.4 继续边界

- B3 当前没有确认 bug，也不改机制代码。
- 若实现对照发现官方子句与实现冲突，先转 `disputed`，再按“失败测试 → 最小修复 → evidence 回写”推进。
- 其余 P2/P3/P4 仍需继续逐字锁定；不得把 B3 locked 外推成 P2 全量完成。

## 64. 当前数据录入合同基线与旧章节覆盖说明（2026-07-02）

### 64.1 当前基线

- P0：4 个对象为 `locked-L4已补`。
- P1：7 个对象均为 `locked-规则原文已锁`；B1/B2 已完成首轮实现对照，B1/B2 的最小验证已回写。
- P2：36 个对象中，B3 十二个对象 + B4 五个对象 + B5 十八个对象为 `locked-规则原文已锁`；`ferocity` 为 `disputed-对象归属待裁定`。
- P3/P4：21 个对象为 `待建合同-入口已补`，仍需逐字锁规则原文。

### 64.2 旧章节覆盖关系

- 本文件是时间序列 evidence；早期章节里“P1 正在锁定 / P1 未锁定 / P2 36 个仍 blocked / P2 第一组未锁定”的描述，是当时状态，不再代表当前基线。
- 当前继续任务时，以第 60-64 节、`full-leak-reaudit-master-matrix-2026-07-02.md`、`rule-text-lock-batch-queue-2026-07-02.md` 和对应 B1/B2/B3 矩阵为准。
- 已 locked 的对象不再回到 OCR、裁图重读或旧实现字段倒推；只有发现合同缺字段、来源冲突或对象归属错误，才回写降级为 `blocked` 或 `disputed`。
- 未 locked 的对象仍只补数据合同或冲突裁定；不得写规则断言测试、不得改机制代码、不得把实现摘要当规则原文。

### 64.3 下一步

- 若继续实现审计：优先从 B3 十二个已 locked 对象建实现对照矩阵，逐项分流为 `match / proof-needed / disputed`。
- 若继续数据录入：优先处理 P2 剩余的 `ferocity` 对象归属争议，再转入 P3/P4 逐字锁定。
- 两条路线都不得重录 B1/B2/B3/B4 已 locked 数据，除非出现合同冲突证据。

## 65. B4 P2 攻击窗口与召唤转移规则原文锁定（2026-07-02）

### 65.1 本轮动作

- 已新增 `evidence/summonerwars/b4-p2-rule-text-lock-matrix-2026-07-02.md`。
- B4 五个对象完成官方英文原文和原子子句锁定：亡灵疫病体「感染」、德拉戈斯「生命吸取」、亡灵弓箭手「灵魂转移」、卡拉「高阶念力：代替攻击分支」、清风法师「念力：代替攻击分支」。
- 本轮只推进数据录入合同锁定，没有写规则断言测试，没有改机制代码。

### 65.2 权威来源

- 官方站点静态包缓存：`temp/summonerwars-audit/official-cache/main.610e76c5.chunk.js`。
- 命中条目：`Infect|TEXT`、`Life Drain|TEXT`、`Soul Shift|TEXT`、`Greater Push|TEXT`、`Push|TEXT`。
- 本轮没有回到低清 OCR；完整单卡和文字区裁图只作为合同入口与对象归属证据，逐字规则以官方静态包文本为主。

### 65.3 命名映射裁定

- 亡灵疫病体「感染」（`infection`）对应官方 `Infect`。
- 德拉戈斯「生命吸取」（`life_drain`）对应官方 `Life Drain`。
- 亡灵弓箭手「灵魂转移」（`soul_transfer`）对应官方 `Soul Shift`。
- 卡拉「高阶念力：代替攻击分支」（`high_telekinesis_instead`）对应官方 `Greater Push`，与 B1 的 `high_telekinesis` 共用同一条官方原文。
- 清风法师「念力：代替攻击分支」（`telekinesis_instead`）对应官方 `Push`，与 B1 的 `telekinesis` 共用同一条官方原文。

### 65.4 状态回写

- 已同步更新 `evidence/summonerwars/full-leak-reaudit-master-matrix-2026-07-02.md`：B4 五个 P2 对象从 `blocked-入口已补` 推进为 `locked-规则原文已锁`。
- 已同步更新 `evidence/summonerwars/rule-text-lock-batch-queue-2026-07-02.md`：P2 顶部基线改为 B3 12 个 + B4 5 个 locked，其余 19 个仍 blocked；B4 行改为已锁。
- 当前 P2 基线：36 个对象中 17 个 `locked-规则原文已锁`，19 个 `blocked-入口已补`。

### 65.5 继续边界

- B4 当前没有确认 bug，也不改机制代码。
- B4 下一步是实现对照和最小验证分流，不回录入层。
- 若实现对照发现官方子句与实现冲突，先转 `disputed`，再按“失败测试 → 最小修复 → evidence 回写”推进。
- 剩余 P2 19 个、P3/P4 21 个仍需继续逐字锁定；不得把 B4 locked 外推成全量完成。

## 66. B5 P2 custom 与 continuation 规则原文锁定（2026-07-02）

### 66.1 本轮动作

- 已新增 `evidence/summonerwars/b5-p2-rule-text-lock-matrix-2026-07-02.md`。
- B5 十八个对象完成官方英文原文和原子子句锁定：葛拉克「浮空术」、野兽骑手「冲锋」、科琳·布莱顿「神圣护盾」、瓦伦蒂娜·斯托哈特「城塞精锐」、冰霜法师「冰霜飞弹」、纳蒂亚娜「高阶冰霜飞弹」、城塞骑士「守卫」、瓦伦蒂娜·斯托哈特「指引」、寒冰冲撞、贾穆德「寒冰碎屑」、部落抓附手「禁足」、史米革「魔力成瘾」、泰珂露「心灵捕获」、泰珂露「心灵捕获确认分支」、雅各布·艾德温「辉光射击」、清风弓箭手「远射」、犀牛「速度强化」、卡拉「稳固」。
- 本轮只推进数据录入合同锁定，没有写规则断言测试，没有改机制代码。

### 66.2 分流对象

| 对象 | 中文承载对象 | 分流状态 | 原因 |
| --- | --- | --- | --- |
| `ferocity` | 史米革、部落投石手 | `disputed-对象归属待裁定` | 官方缓存中 `Relentless|TEXT` 可解释史米革的额外攻击能力，但未证明部落投石手也承载该能力；本地同一能力同时挂在两个对象上，需先裁定归属。 |

### 66.3 状态回写

- 已同步更新 `evidence/summonerwars/full-leak-reaudit-master-matrix-2026-07-02.md`：B5 十八个 P2 对象推进为 `locked-规则原文已锁`，`ferocity` 转为 `disputed-对象归属待裁定`。
- 已同步更新 `evidence/summonerwars/rule-text-lock-batch-queue-2026-07-02.md`：P2 顶部基线改为 B3 12 + B4 5 + B5 18 locked，另有 B5 1 disputed。
- 当前 P2 基线：36 个对象中 35 个 `locked-规则原文已锁`，1 个 `disputed-对象归属待裁定`。

### 66.4 继续边界

- B5 当前没有确认实现 bug，也不改机制代码。
- B5 locked 对象下一步是实现对照和最小验证分流，不回录入层。
- `ferocity` 必须先裁定部落投石手对象归属。
- P2 未收口前不得宣称 P2 全量审计完成；P3/P4 21 个对象仍需继续逐字锁定。

## 67. B6 充能与数值录入合同锁定（2026-07-02）

本轮没有重新读卡图/OCR，也没有改机制代码。按用户纠偏，已 locked 或可由官方缓存锁定的数据录入对象直接走官方静态包原文合同，不再在图片录入层反复打转。

- 新增 `b6-p3-p4-charge-and-stat-rule-text-lock-matrix-2026-07-02.md`。
- 七个对象转为 `locked-规则原文已锁`：`blood_rage`、`blood_rage_decay`、`gather_power`、`power_boost`、`power_up`、`life_up`、`rage`。
- 使用的真相源是官方缓存 `main.610e76c5.chunk.js` 中的 `Blood Fury|TEXT`、`Charged|TEXT`、`Imbued Strength|TEXT`、`Imbued Life|TEXT`、`Wrath|TEXT`。
- `blood_rage` 与 `blood_rage_decay` 记录为同一官方 Blood Fury 的写入/清理共享合同；后续实现对照不能拆成互不相干的能力猜测。
- `power_boost` 与 `power_up` 均按官方 Imbued Strength 录入；后续要裁定的是本地命名和承载差异，不是规则原文。
- `ferocity` 继续保持 `disputed-对象归属待裁定`：官方 Relentless 原文只锁到史米革邻近条目，本地部落投石手也挂 `ferocity`，在对象归属未裁定前不得写断言测试或改机制。

当前总矩阵状态应为：4 个 `locked-L4已补`，49 个 `locked-规则原文已锁`，1 个 `disputed-对象归属待裁定`，14 个 `待建合同-入口已补`。下一步继续 B7/B8，把剩余 P3/P4 对象补成 locked/disputed/blocked，不宣称全面完成。

## 68. B7 移动穿越与相邻离开录入合同锁定（2026-07-02）

本轮继续按“数据录入合同先稳住”的口径推进，没有重新读图片/OCR，也没有改机制代码。

- 新增 `b7-p3-movement-and-adjacency-rule-text-lock-matrix-2026-07-02.md`。
- 七个对象转为 `locked-规则原文已锁`：`climb`、`evasion`、`flying`、`rebound`、`slow`、`swift`、`trample`。
- 使用的真相源是官方缓存 `main.610e76c5.chunk.js` 中的 `Climb|TEXT`、`Stupefy|TEXT`、`Flight|TEXT`、`Engage|TEXT`、`Slow|TEXT`、`Swift|TEXT`、`Trample|TEXT`。
- `entangle` 转为 `disputed-对象归属待裁定`：本地城塞骑士承载该能力，但官方缓存中城塞骑士邻近只锁到 Protect，无法证明城塞骑士也承载 Engage/Entangle。
- `evasion` 与 `rebound` 当前按官方 Deceiver 邻近的 Stupefy / Engage 原文录入；后续实现对照阶段需要核对本地掷术师命名和官方 Deceiver 的承载映射。

当前总矩阵状态应为：4 个 `locked-L4已补`，56 个 `locked-规则原文已锁`，2 个 `disputed-对象归属待裁定`，6 个 `待建合同-入口已补`。下一步继续 B8 和剩余 `sacrifice`，不要把 B7 locked 结果倒回图片录入层。

## 69. B8 静态、召唤与死亡录入合同锁定（2026-07-02）

本轮继续按“数据录入合同先稳住”的口径推进，没有重新读图片/OCR，也没有改机制代码。

- 新增 `b8-p3-p4-static-summon-and-death-rule-text-lock-matrix-2026-07-02.md`。
- 六个对象转为 `locked-规则原文已锁`：`sacrifice`、`cold_snap`、`fire_sacrifice_summon`、`living_gate`、`mobile_structure`、`soulless`。
- 使用的真相源是官方缓存 `main.610e76c5.chunk.js` 中的 `Immolate|TEXT`、`Cold Snap|TEXT`、`Summoned by Fire|TEXT`、`Living Gate|TEXT`、`Mobile Structure|TEXT`、`Soulless|TEXT`。
- `cold_snap` 官方原文没有范围限制；后续实现对照要重点核对本地范围光环是否冲突。
- `fire_sacrifice_summon`、`living_gate`、`mobile_structure` 虽然本地 ability effects 为空或很轻，但合同已证明它们需要进入召唤/建筑/移动消费者链路审计，不能按空能力放过。

当前数据录入合同阶段状态：68 个风险对象已全部完成入口合同分流，其中 4 个 `locked-L4已补`，62 个 `locked-规则原文已锁`，2 个 `disputed-对象归属待裁定`，0 个 `待建合同-入口已补`。下一阶段是实现对照；两个 disputed（`ferocity`、`entangle`）先裁定对象归属，未裁定前不得写规则断言测试或改机制代码。

## 70. 实现对照阶段入口建立（2026-07-02）

数据录入合同已经收口，本轮开始进入实现对照预筛，但仍未改机制代码、未写规则断言测试。

- 新增 `implementation-audit-entry-2026-07-02.md`，作为 locked 对象进入实现对照的入口。
- 第一批预筛对象：`cold_snap`、`fire_sacrifice_summon`、`living_gate`、`mobile_structure`、`sacrifice`、`blood_rage`、`rebound`、`evasion`。
- 预筛只登记“合同原文 vs 当前实现块”的可疑差异，不直接判定修复完成。
- `ferocity`、`entangle` 仍保持对象归属争议，未裁定前不写规则断言测试、不改机制代码。

## 71. 实现对照第一批链路索引（2026-07-02）

本轮继续从数据录入合同转入实现审计，但仍未改机制代码、未写规则断言测试。

- 新增 `implementation-audit-first-pass-index-2026-07-02.md`。
- 第一批只锁链路入口：`cold_snap`、`fire_sacrifice_summon`、`living_gate`、`mobile_structure`、`sacrifice`、`blood_rage`、`rebound`、`evasion`。
- 当前只是实现对照入口，不确认 bug 已修复；看到 ability effects 为空也不能直接判错，必须查真实消费者。
- 下一步读召唤命令、移动合法性、死亡事件、单位死亡事件、相邻离开/攻击事件的实际消费链。

## 72. 实现对照第一批发现登记（2026-07-02）

本轮继续实现审计，仍未改机制代码、未写规则断言测试。

- 新增 `implementation-audit-first-pass-findings-2026-07-02.md`。
- 已锁第一批真实消费者链：`fire_sacrifice_summon`、`living_gate`、`mobile_structure`、`sacrifice`、`blood_rage`、`rebound`、`evasion`。
- `cold_snap` 出现高风险差异：官方合同没有范围文字，本地实现和旧测试都固定 3 格范围，下一步应优先进入最小失败测试候选。
- `blood_rage` 不能只看 AbilityDef 的 `always` 判错；真实消费者链按当前回合玩家遍历，但仍缺对手回合不充能负向断言。
- 空 effects 对象已找到真实消费者链，不能按空能力直接判错或判通过。

## 73. cold_snap 最小修复登记（2026-07-02）

本轮对已 locked 的 `cold_snap` 做了第一项实现对照修复。

- 已锁官方合同：`Cold Snap|TEXT` 为 `Friendly structures have +1 life.`，没有范围限制。
- 原实现差异：本地 `cold_snap` 定义为 `auraStructureLife` 且带 `range: 3`，有效生命计算按距离过滤；旧测试也断言超出 3 格不生效。
- 最小修复：移除 `cold_snap` 的范围限制，把 `auraStructureLife.range` 改为可选；生命计算在 `range` 缺省时视为全局友方建筑加成。
- 测试同步：把旧的“超出 3 格不生效”断言改为“远处友方建筑仍获得 +1 有效生命”。
- 仍未处理：`ferocity`、`entangle` 继续保持对象归属争议；其他实现对照对象仍需逐项审计。

### cold_snap 验证补记

- 已运行目标测试：`npx vitest run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts --testNamePattern "cold_snap"`。
- 结果：1 个测试文件通过，5 个 cold_snap 相关测试通过，85 个非目标测试跳过。
- 说明：此前误用 `npm test -- --run ...` 触发了全量测试并超时，不作为本轮 cold_snap 目标验证结果。

## 74. blood_rage 负向断言补证（2026-07-02）

本轮继续实现对照第一批，对已 locked 的 `blood_rage` 补负向测试，仍未改机制实现。

- 已锁官方合同：`Blood Fury|TEXT` 限定 `Each time a unit is destroyed on your turn`，也就是只在该血腥狂怒单位控制者自己的回合内响应单位死亡。
- 实现链路：`emitDestroyWithTriggers` 中 `onUnitDestroyed` 遍历 `opts.playerId` 当前回合玩家单位；不能只看 AbilityDef 里的 `condition: always` 就判错。
- 新增断言：玩家1回合击杀单位时，玩家0的亡灵战士（`blood_rage`）不会获得充能。
- 待验证：运行 `--testNamePattern "blood_rage"` 的目标测试。



### blood_rage 验证补记

- 已运行目标测试：`npx vitest run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts --testNamePattern "blood_rage"`。
- 结果：1 个测试文件通过，8 个 blood_rage 相关测试通过，83 个非目标测试跳过。
- 说明：新增负向断言验证“对手回合单位死亡不会给非当前玩家血腥狂怒单位充能”。

## 75. fire_sacrifice_summon 实现对照补证（2026-07-02）

本轮按已 locked 录入合同继续实现对照，没有重新读图片/OCR，也没有修改机制实现。

- 已锁官方合同：`Summoned by Fire|TEXT` 要求伊路特-巴尔召唤时消灭一个己方非召唤师单位，并将伊路特-巴尔放到该单位所在格。
- 实现链路：`SUMMON_UNIT` 校验要求提供 `sacrificeUnitId`，拒绝找不到的牺牲品、敌方单位、召唤师；执行时先消灭牺牲品，再把召唤位置替换为牺牲品位置。
- 既有覆盖：已覆盖任意位置友方单位可作为牺牲品、未提供牺牲品拒绝、牺牲召唤师拒绝、召唤后落到牺牲品位置。
- 新增补证：补了“找不到牺牲品拒绝”和“牺牲敌方单位拒绝”两个负向断言，证明当前实现覆盖合同边界。
- 验证：`npx vitest run src/games/summonerwars/__tests__/abilities-necromancer-execute.test.ts --testNamePattern "火祭召唤|fire_sacrifice_summon"` 通过，6 个目标测试通过，11 个非目标测试跳过。
- Lint：`npx eslint src/games/summonerwars/__tests__/abilities-necromancer-execute.test.ts` 为 0 errors，保留 3 个既有 unused warnings。
- 下一步：继续审 `living_gate`、`mobile_structure`、`sacrifice`、`rebound`、`evasion`；两个 disputed（`ferocity`、`entangle`）仍不进入机制修复流。

## 76. living_gate / mobile_structure 实现对照补证（2026-07-02）

本轮继续按已 locked 录入合同做实现对照，没有重新读图片/OCR，也没有修改机制实现。

- 已锁官方合同：`Living Gate|TEXT` 为 `This card is a gate.`；`Mobile Structure|TEXT` 为 `This card may move.`。
- 实现链路：召唤位置 helper 会把己方 `living_gate` 单位相邻空格加入合法召唤位置；移动校验仍把寒冰魔像作为单位移动，不按普通建筑禁止移动。
- 既有覆盖：寒冰魔像已在冰霜飞弹、寒冰碎屑、结构变换、寒冰冲撞等链路中作为活体结构参与建筑消费者链。
- 新增补证：补了“己方活体传送门提供召唤位置”“敌方活体传送门不提供己方召唤位置”“活体结构仍可按单位移动”三个断言。
- 验证：`npx vitest run src/games/summonerwars/__tests__/abilities-frost.test.ts --testNamePattern "活体传送门|活体结构|living_gate|mobile_structure"` 通过，8 个目标测试通过，29 个非目标测试跳过。
- Lint：`npx eslint src/games/summonerwars/__tests__/abilities-frost.test.ts` 为 0 errors，保留 2 个既有 unused warnings。
- 下一步：继续审 `sacrifice`、`rebound`、`evasion` 的边界断言；两个 disputed（`ferocity`、`entangle`）仍不进入机制修复流。

## 77. sacrifice 实现对照补证（2026-07-02）

本轮继续按已 locked 录入合同做实现对照，没有重新读图片/OCR，也没有修改机制实现。

- 已锁官方合同：`Immolate|TEXT` 为 `After this unit is destroyed, add 1 damage to each enemy unit that was adjacent to it.`。
- 实现链路：死亡触发通过 `emitDestroyWithTriggers` 传入被摧毁单位的死亡前位置，`adjacentEnemies` 目标解析用该位置寻找相邻敌方单位。
- 既有覆盖：已有献祭单位被消灭时相邻敌方受 1 点伤害、无额外相邻敌方时只伤害相邻攻击者、献祭伤害继续触发后续单位死亡链。
- 新增补证：补了“只伤害死亡前相邻敌方，不伤害相邻友方或非相邻敌方”的边界断言。
- 验证：`npx vitest run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts --testNamePattern "sacrifice|献祭"` 通过，4 个目标测试通过，88 个非目标测试跳过。
- Lint：`npx eslint src/games/summonerwars/__tests__/entity-chain-integrity.test.ts` 为 0 errors，0 warnings。
- 下一步：继续审 `rebound`、`evasion` 的强制移动、任意卡攻击、减伤作用对象和最小伤害边界；两个 disputed（`ferocity`、`entangle`）仍不进入机制修复流。

## 78. rebound / evasion 实现对照补证（2026-07-02）

本轮继续按已 locked 录入合同做实现对照，没有重新读图片/OCR，也没有修改机制实现。

- `rebound` 已锁官方合同：`Engage|TEXT` 要求相邻敌方单位移动或被强制离开本单位时，对该敌方单位加 1 点伤害。
- `evasion` 已锁官方合同：`Stupefy|TEXT` 要求相邻敌人攻击任意卡牌且掷出 1 个或更多特殊面时，该次攻击少加 1 点伤害。
- 实现链路：`rebound` 通过普通移动分支和推拉后处理分支覆盖“移动 / forced away”；`evasion` 在攻击掷骰后检查攻击者相邻敌方迷魂单位，并直接减少本次命中伤害。
- 既有覆盖：已有普通移动离开、靠近不触发、多缠斗单位叠加、推拉强制离开后在新位置受伤、相邻单位攻击触发迷魂、无特殊面不触发、不相邻不触发、幻化复制后迷魂生效。
- 新增补证：补了“敌方攻击相邻建筑并掷出特殊面时，迷魂仍减少该次攻击伤害”的断言，覆盖官方“攻击任意卡牌”的单位/建筑边界。
- 验证：`npx vitest run src/games/summonerwars/__tests__/abilities-trickster.test.ts --testNamePattern "迷魂|缠斗|evasion|rebound"` 通过，10 个目标测试通过，33 个非目标测试跳过。
- Lint：`npx eslint src/games/summonerwars/__tests__/abilities-trickster.test.ts` 为 0 errors，0 warnings。
- 第一批实现对照对象当前状态：`cold_snap` 已最小修复；`blood_rage`、`fire_sacrifice_summon`、`living_gate`、`mobile_structure`、`sacrifice`、`rebound`、`evasion` 已完成首轮实现补证。下一步继续从总矩阵选择下一个 locked 批次；`ferocity`、`entangle` 保持 disputed，仍不进入机制修复流。

## 79. B3 P2 实现对照首轮历史分流（2026-07-02；当前以第 80-85 节为准）

本轮按已 locked 录入合同继续实现对照，没有重新读图片/OCR，也没有修改机制实现。

- 新增 evidence：`evidence/summonerwars/b3-p2-implementation-diff-matrix-2026-07-02.md`。
- 续接口径：B3 十二个对象已是 `locked-规则原文已锁`，后续继续默认进入实现对照、测试补证、真实入口证据或 L3/L4 补证；除非合同缺字段、来源冲突或对象归属不清，不再回录入层。
- 历史 `match-with-proof`：巨食兽「喂养巨食兽」（`feed_beast`）、阿布亚·石「魂灵纽带」（`ancestral_bond`）、思尼克斯「狡黠」（`vanish`）、部落抓附手「抓附」（`grab`）、圣殿牧师「治疗」（`healing`）、斯瓦拉「结构变换」（`structure_shift`）。
- 历史 `proof-needed`：雷塔勒斯「复活死灵」（`revive_undead`）、布拉夫「鲜血符文」（`blood_rune`）、城塞弓箭手「圣光箭」（`holy_arrow`）、心灵巫女「拟态」（`illusion`）、祖灵法师「祖灵交流」（`spirit_bond`）；第 81-85 节已逐项回写，当前 B3 已清空待补证。
- 历史 `suspected-gap`：寒冰锻造师「冰霜战斧」（`frost_axe`）；第 80 节已最小修复并回写为 `fixed-with-proof`。
- 当前状态：B3 十二个对象首轮实现对照已收口，继续时不回录入层，也不再从本节旧待办继续。

## 80. 寒冰锻造师「冰霜战斧」最小修复回写（2026-07-02）

本轮按 B3 已 locked 合同继续实现对照，没有重新读图片/OCR。

- 已锁官方合同：寒冰锻造师「冰霜战斧」（`frost_axe`）附加路径为 `spend 1 boost`，也就是只花 1 个充能。
- 失败信号：新增最小断言后，`frost_axe` 目标测试失败，2 个充能执行附加路径时收到 `delta = -2`，证明当前实现清空全部充能。
- 最小修复：`src/games/summonerwars/domain/executors/frost.ts` 中附加路径的充能消耗从 `newValue: 0, delta: -charges` 改为 `delta: -1`。
- 测试补证：`src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts` 的附加路径断言现在验证多充能时只消耗 1 个，且不写 `newValue` 清空值。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "frost_axe"` 通过，9 passed / 87 skipped。
- 相邻回归：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-frost.test.ts --configLoader native -t "冰霜战斧|frost_axe"` 通过，1 passed / 36 skipped。
- B3 矩阵状态：`frost_axe` 从 `suspected-gap` 回写为 `fixed-with-proof`；下一步继续处理 `revive_undead`、`blood_rune`、`holy_arrow`、`illusion`、`spirit_bond` 的 `proof-needed` 项。

## 81. 雷塔勒斯「复活死灵」最小修复回写（2026-07-02）

本轮按 B3 已 locked 合同继续实现对照，没有重新读图片/OCR。

- 已锁官方合同：雷塔勒斯「复活死灵」（`revive_undead`）要求每回合一次、召唤阶段、可选、给自身加 2 伤害、从己方弃牌堆取一个亡灵单位，并放到本单位相邻格。
- 失败信号：新增最小断言后，执行器在收到非亡灵目标、非相邻位置或非空格时仍先产生 `UNIT_DAMAGED` 自伤事件；验证层还把有建筑的格子误判为空格。
- 最小修复：`src/games/summonerwars/domain/executors/necromancer.ts` 在自伤前先防御校验目标卡存在、是单位、是亡灵、目标格相邻且为空；`src/games/summonerwars/domain/abilities.ts` 的验证层改用完整 `isCellEmpty`，同时拒绝单位和建筑占格。
- 测试补证：`src/games/summonerwars/__tests__/abilities-necromancer-execute.test.ts` 新增执行器防御断言，覆盖非亡灵、非相邻、非空格均不自伤不召唤；`src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts` 新增验证层断言，覆盖非亡灵、非相邻、有单位或建筑占格均拒绝。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-necromancer-execute.test.ts --configLoader native -t "revive_undead|复活死灵|非亡灵|非相邻|非空"` 通过，5 passed / 15 skipped。
- 相邻回归：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "revive_undead"` 通过，6 passed / 93 skipped。
- B3 矩阵状态：`revive_undead` 从 `proof-needed` 回写为 `fixed-with-proof`；下一步继续处理 `blood_rune`、`holy_arrow`、`illusion`、`spirit_bond` 的 `proof-needed` 项。

## 82. 布拉夫「鲜血符文」实现对照补证（2026-07-02）

本轮按 B3 已 locked 合同继续实现对照，没有重新读图片/OCR，也没有修改机制实现。

- 已锁官方合同：布拉夫「鲜血符文」（`blood_rune`）要求攻击阶段开始时强制二选一：花 1 魔力给本单位充能，或给本单位加 1 伤害；卡面未写 may，按强制处理。
- 实现链路：`src/games/summonerwars/domain/flowHooks.ts` 在攻击阶段进入时触发 `blood_rune`；`src/games/summonerwars/domain/systems.ts` 创建 `on_phase_start_blood_rune` 选择，魔力不足时不提供 charge 选项，并因单选项自动结算 damage；`src/games/summonerwars/domain/executors/goblin.ts` 分别结算自伤或花魔力充能。
- 既有覆盖：已有直接执行 damage / charge、魔力不足时 charge 验证拒绝、damage 路径可用等测试。
- 新增补证：补了“进入攻击阶段时应创建强制二选一交互”和“无魔力时阶段开始只保留自伤选项并自动结算”两个断言，覆盖官方强制二选一与无魔力分支。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "blood_rune"` 通过，4 passed / 97 skipped。
- B3 矩阵状态：`blood_rune` 从 `proof-needed` 回写为 `match-with-proof`；下一步继续处理 `holy_arrow`、`illusion`、`spirit_bond` 的 `proof-needed` 项。

## 83. 城塞弓箭手「圣光箭」最小修复回写（2026-07-02）

本轮按 B3 已 locked 合同继续实现对照，没有重新读图片/OCR。这里消费的是已锁定的规则合同，不是重新做数据录入。

- 已锁官方合同：城塞弓箭手「圣光箭」（`holy_arrow`）要求本单位攻击前展示并弃置任意数量互不相同的单位牌；每弃 1 张获得 1 魔力，且本单位仅在本次攻击中每张 +1 战力。
- 失败信号：新增最小断言后，直接激活路径仍产生 `UNIT_CHARGED` 并让单位留下 `boosts`；攻击路径旧测试也把“圣光箭本次攻击加成”和“永久充能加成”叠在一起，导致存在双算/残留风险。
- 最小修复：`src/games/summonerwars/domain/executors/paladin.ts` 移除圣光箭直接激活路径的 `UNIT_CHARGED` 写入；`src/games/summonerwars/domain/execute.ts` 保留攻击前分支的 `beforeAttackBonus`，只影响本次攻击骰数。
- 测试补证：`src/games/summonerwars/__tests__/abilities-paladin-execute.test.ts` 改为断言圣光箭弃牌只加魔力、不产生永久充能、不残留 `boosts`，并用只有圣光箭的城塞弓箭手验证攻击骰数只加一次。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-paladin-execute.test.ts --configLoader native -t "holy_arrow|圣光箭"` 通过，4 passed / 2 skipped。
- B3 矩阵状态：`holy_arrow` 从 `proof-needed` 回写为 `fixed-with-proof`；B3 剩余 `proof-needed` 为心灵巫女「拟态」（`illusion`）和祖灵法师「祖灵交流」（`spirit_bond`）。

## 84. 心灵巫女「拟态」实现对照补证（2026-07-02）

本轮按 B3 已 locked 合同继续实现对照，没有重新读图片/OCR，也没有修改机制实现。

- 已锁官方合同：心灵巫女「拟态」（`illusion`）要求在你的移动阶段开始时，可选择 3 格内一个士兵；本单位获得目标能力直到本回合结束。
- 实现链路：`src/games/summonerwars/domain/abilities-trickster.ts` 定义移动阶段开始触发、士兵/3 格/非自身校验；`src/games/summonerwars/domain/systems.ts` 在移动阶段开始创建可跳过的目标士兵选择；`src/games/summonerwars/domain/executors/trickster.ts` 写入 `ABILITIES_COPIED`；`src/games/summonerwars/domain/reduce.ts` 在回合切换时清理 `tempAbilities`。
- 既有覆盖：已有复制 3 格内士兵技能、拒绝召唤师/英雄、拒绝超距、拒绝非移动阶段、回合切换清除临时能力、临时能力合并/去重等断言。
- 新增补证：补了“进入移动阶段时应创建可跳过的士兵目标选择交互”，确认真实阶段入口只列入 3 格内士兵，排除远处士兵和英雄/冠军，并提供跳过选项。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts src/games/summonerwars/__tests__/abilities-trickster-execute.test.ts --configLoader native -t "illusion|拟态|幻化"` 通过，9 passed / 125 skipped。
- B3 矩阵状态：`illusion` 从 `proof-needed` 回写为 `match-with-proof`；B3 剩余 `proof-needed` 为祖灵法师「祖灵交流」（`spirit_bond`）。

## 85. 祖灵法师「祖灵交流」最小修复回写（2026-07-02）

本轮按 B3 已 locked 合同继续实现对照，没有重新读图片/OCR。这里修的是已锁合同和实现入口的直接冲突。

- 已锁官方合同：祖灵法师「祖灵交流」（`spirit_bond`）要求本单位移动后执行二选一：给自身 1 充能，或花 1 充能给 3 格内友方单位 1 充能；卡面未写 may，按强制二选一登记。
- 失败信号：`src/games/summonerwars/domain/systems.ts` 的移动后交互除 self / transfer 外，还额外提供 `skip` 跳过选项，与“卡面未写 may”的合同冲突。
- 最小修复：移除祖灵交流移动后交互里的 skip 选项，保留 self 和满足条件时的 transfer 目标选项。
- 测试补证：`src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts` 新增“移动后应强制二选一且不提供跳过”断言，确认有充能且 3 格内有友方目标时，交互只提供自充和转移，不提供跳过。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts src/games/summonerwars/__tests__/abilities-barbaric.test.ts --configLoader native -t "spirit_bond|祖灵交流"` 通过，13 passed / 149 skipped。
- B3 矩阵状态：`spirit_bond` 从 `proof-needed` 回写为 `fixed-with-proof`；B3 本批 12 个对象首轮实现对照已清空 `proof-needed`。

## 86. 亡灵弓箭手「灵魂转移」最小修复回写（2026-07-02）

本轮按 B4 已 locked 合同继续实现对照，没有重新读图片/OCR。这里修的是已锁官方合同和实现触发入口的直接冲突。

- 已锁官方合同：亡灵弓箭手「灵魂转移」（`soul_transfer`）要求在你的回合中，距离本单位 3 格内的一个单位被摧毁后，可用本单位替换被摧毁单位；官方原文写的是 `a unit within 3 spaces of this unit is destroyed during your turn`，不限定被摧毁单位归属，也不要求亡灵弓箭手亲自击杀。
- 失败信号：旧测试明确写成“非击杀者不应触发灵魂转移请求”，当前实现也把 `soul_transfer` 放在 `onKill`，导致只有亡灵弓箭手自己击杀时才会触发，和已锁合同冲突。
- 最小修复：`src/games/summonerwars/domain/abilities.ts` 将 `soul_transfer` 触发入口从 `onKill` 改为 `onUnitDestroyed`；`src/games/summonerwars/domain/abilityResolver.ts` 让 `isInRange(victim)` 优先使用被摧毁位置 `victimPosition` 判断距离，并排除本单位自毁错误触发。
- 测试补证：`src/games/summonerwars/__tests__/abilities-advanced.test.ts` 把旧的“非击杀者不触发”断言改为合同正向断言：当前玩家回合中，亡灵弓箭手范围内单位被其他单位击杀时，也应产生 `SOUL_TRANSFER_REQUESTED`，且请求来源是亡灵弓箭手，目标位置是被摧毁单位位置。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-advanced.test.ts --configLoader native -t "soul_transfer|灵魂转移"` 通过，4 passed / 9 skipped。
- B4 矩阵状态：新增 `evidence/summonerwars/b4-p2-implementation-diff-matrix-2026-07-02.md`，`soul_transfer` 回写为 `fixed-with-proof`；B4 剩余 `proof-needed` 为亡灵疫病体「感染」（`infection`）、德拉戈斯「生命吸取」（`life_drain`）、卡拉「高阶念力：代替攻击分支」（`high_telekinesis_instead`）、清风法师「念力：代替攻击分支」（`telekinesis_instead`）。

## 87. 亡灵疫病体「感染」执行器防御最小修复回写（2026-07-02）

本轮继续消费 B4 已 locked 合同，没有重新读图片/OCR。这里修的是验证层合同与直接执行器之间的防御缺口。

- 已锁官方合同：亡灵疫病体「感染」（`infection`）要求本单位摧毁一个单位后，可用你弃牌堆中的一个疫病体单位替换被摧毁单位位置；目标来源必须是己方弃牌堆里的疫病体，落点必须是被摧毁单位位置。
- 失败信号：`src/games/summonerwars/domain/abilities.ts` 的验证层已拒绝非疫病体，但 `src/games/summonerwars/domain/executors/necromancer.ts` 的直接执行器只校验“弃牌堆里存在单位牌”，未再次防御 `isPlagueZombieCard`，且未防御目标格被占用。
- 最小修复：`src/games/summonerwars/domain/executors/necromancer.ts` 在发出 `UNIT_SUMMONED` 前补充两道防御：目标卡必须是疫病体，目标格必须为空。
- 测试补证：`src/games/summonerwars/__tests__/abilities-necromancer-execute.test.ts` 新增“执行器拒绝非疫病体或占用格，避免绕过感染合同”断言，确认非疫病体不会被召唤，占用格不会被覆盖。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-necromancer-execute.test.ts --configLoader native -t "infection|感染"` 通过，3 passed / 18 skipped。
- B4 矩阵状态：`infection` 回写为 `fixed-with-proof`；B4 剩余 `proof-needed` 为德拉戈斯「生命吸取」（`life_drain`）、卡拉「高阶念力：代替攻击分支」（`high_telekinesis_instead`）、清风法师「念力：代替攻击分支」（`telekinesis_instead`）。

## 88. 德拉戈斯「生命吸取」实现对照补证（2026-07-02）

本轮继续消费 B4 已 locked 合同，没有重新读图片/OCR，也没有修改机制实现。

- 已锁官方合同：德拉戈斯「生命吸取」（`life_drain`）要求本单位攻击前可摧毁 2 格内一个友方单位；若摧毁成功，则本次攻击中特殊符号等同普通近战命中；未支付摧毁成本时不获得符号替换。
- 实现链路：`src/games/summonerwars/domain/execute.ts` 在攻击前处理 `life_drain`，成功找到并摧毁友方目标后才设置 `beforeAttackSpecialCountsAsMelee`，并仅在本次攻击命中计算里把 special 计为近战命中；`src/games/summonerwars/domain/validate.ts` 已校验目标是 2 格内友方单位。
- 旧证据缺口：既有测试主要证明“不会翻倍战力”和“会摧毁成本单位”，没有直接证明 special 面被本次攻击转换为近战命中，也没有聚焦证明未支付成本时 special 不生效。
- 新增补证：`src/games/summonerwars/__tests__/abilities-necromancer-execute.test.ts` 把旧“翻倍战力”口径改为 special-only 骰面断言：支付牺牲成本后，2 个 special 面造成 2 点近战伤害并摧毁 2 生命目标；未提供牺牲目标时，同样的 special-only 骰面不造成近战命中。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-necromancer-execute.test.ts --configLoader native -t "life_drain|吸取生命"` 通过，4 passed / 18 skipped。
- B4 矩阵状态：`life_drain` 回写为 `match-with-proof`；B4 剩余 `proof-needed` 为卡拉「高阶念力：代替攻击分支」（`high_telekinesis_instead`）和清风法师「念力：代替攻击分支」（`telekinesis_instead`）。

## 89. 卡拉「高阶念力」/清风法师「念力」代替攻击补证（2026-07-02）

本轮继续消费 B4 已 locked 合同，没有重新读图片/OCR，也没有修改机制实现。这里补的是两个代替攻击分支的行动经济证据。

- 已锁官方合同：卡拉「高阶念力：代替攻击分支」（`high_telekinesis_instead`）要求代替攻击，推拉 3 格内一个士兵或英雄 1 格；清风法师「念力：代替攻击分支」（`telekinesis_instead`）要求代替攻击，推拉 2 格内一个士兵或英雄 1 格；两者都不能选择召唤师或建筑。
- 实现链路：`src/games/summonerwars/domain/abilities-trickster.ts` 为两个分支声明 `costsAttackAction: true`，并分别限制 3 格/2 格、已攻击拒绝、攻击次数满拒绝、目标不能是召唤师；`src/games/summonerwars/domain/execute/abilities.ts` 在主动技能执行后根据 `costsAttackAction` 发出 `ATTACK_ACTION_CONSUMED`；`src/games/summonerwars/domain/reduce.ts` 将源单位标记为已攻击并增加玩家攻击次数。
- 既有覆盖：B1 已补念力/高阶念力目标类型与建筑排除证明；清风法师代替攻击已有已攻击拒绝、攻击次数满拒绝、超 2 格拒绝、召唤师拒绝；卡拉代替攻击已有成功推拉和已攻击拒绝。
- 新增补证：`src/games/summonerwars/__tests__/abilities-trickster-execute.test.ts` 在清风法师代替攻击成功推拉后，新增断言源单位 `hasAttacked=true` 且玩家 `attackCount=1`；`src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts` 在卡拉代替攻击成功推拉后，新增断言产生 `ATTACK_ACTION_CONSUMED`。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-trickster-execute.test.ts src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "telekinesis_instead|high_telekinesis_instead|念力代替|高阶念力"` 通过，9 passed / 126 skipped。
- B4 矩阵状态：`high_telekinesis_instead`、`telekinesis_instead` 回写为 `match-with-proof`；B4 五个对象首轮实现对照已清空 `proof-needed`。后续仍可补真实 UI 二段选择和刷新不重复消耗的 L4 证据，但不阻塞 B4 首轮收口。

## 90. 野兽骑手「冲锋」本回合战力生命周期最小修复回写（2026-07-02）

本轮继续消费 B5 已 locked 合同，没有重新读图片/OCR。这里修的是已锁官方合同和当前实现链路的直接冲突。

- 已锁官方合同：野兽骑手「冲锋」（`charge`）允许本单位只沿一个方向移动时最多额外移动 2 格；若本单位移动 3 格或更多且只沿一个方向，本回合获得 +1 战力。
- 失败信号：新增最小断言后，野兽骑手直线移动 3 格后的 +1 战力在 `TURN_CHANGED` 后仍然生效，回合结束后仍按 4 点战力计算；根因是旧实现把“本回合 +1 战力”写入真实充能 `boosts`。
- 最小修复：`src/games/summonerwars/domain/execute.ts` 将冲锋移动后的事件改为 `UNIT_CHARGE_BONUS_GAINED`；`src/games/summonerwars/domain/types.ts` 为单位增加 `chargeBonusThisTurn` 临时字段；`src/games/summonerwars/domain/abilityResolver.ts` 只用该临时字段计算冲锋战力；`src/games/summonerwars/domain/reduce.ts` 在回合切换时清除该字段，真实充能 `boosts` 不再被冲锋占用。
- 测试补证：`src/games/summonerwars/__tests__/abilities-goblin.test.ts` 新增“冲锋战力加成只持续到本回合结束”断言，并更新旧用例，确认 3 格直线移动只写临时战力，不写真实充能。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-goblin.test.ts --configLoader native -t "冲锋|charge"` 通过，7 passed / 44 skipped；`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/strength-breakdown.property.test.ts --config vitest.config.audit.ts --configLoader native -t "冲锋加成|baseStrength"` 通过，3 passed / 8 skipped，确认战力拆解不再把真实充能 `boosts` 当作冲锋来源。
- B5 矩阵状态：`charge` 从 `proof-needed` 回写为 `fixed-with-proof`；B5 剩余 `proof-needed` 为城塞骑士「守护」（`guardian`）、瓦伦蒂娜·斯托哈特「指引」（`guidance`）、寒冰冲撞（`ice_ram`）、贾穆德「冰片」（`ice_shards`）、史米革「魔力成瘾」（`magic_addiction`）、泰珂露「心灵捕获」（`mind_capture` / `mind_capture_resolve`）和清风弓箭手「远程」（`ranged`）。

## 91. 瓦伦蒂娜·斯托哈特「指引」召唤阶段入口补证（2026-07-02）

本轮继续消费 B5 已 locked 合同，没有重新读图片/OCR，也没有修改机制实现。这里补的是「召唤阶段开始时强制抽 2 张牌」的真实阶段入口证据。

- 已锁官方合同：瓦伦蒂娜·斯托哈特「指引」（`guidance`）要求在你的召唤阶段开始时强制抽 2 张牌。
- 实现链路：`src/games/summonerwars/domain/flowHooks.ts` 在进入 summon 阶段时触发 `guidance`；`src/games/summonerwars/domain/executors/paladin.ts` 按牌库实际剩余数量最多抽 2 张；`CARD_DRAWN` 事件由 reducer 写入玩家手牌并移除牌库顶部牌。
- 既有覆盖：`src/games/summonerwars/__tests__/abilities-paladin-execute.test.ts` 已覆盖直接激活的牌库为空拒绝和非召唤阶段拒绝，但缺少真实阶段推进入口。
- 新增补证：`src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts` 新增“从玩家 1 抽牌阶段推进到玩家 0 召唤阶段时，玩家 0 的瓦伦蒂娜自动抽 2 张”断言；该测试同步设置 core 阶段和系统阶段为 `draw`，避免只改 core 导致 FlowSystem 仍从默认 summon 推进。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts src/games/summonerwars/__tests__/abilities-paladin-execute.test.ts --configLoader native -t "guidance|指引"` 通过，2 个测试文件通过，3 passed / 107 skipped。
- B5 矩阵状态：`guidance` 从 `proof-needed` 回写为 `match-with-proof`；B5 剩余 `proof-needed` 为城塞骑士「守护」（`guardian`）、寒冰冲撞（`ice_ram`）、贾穆德「冰片」（`ice_shards`）、史米革「魔力成瘾」（`magic_addiction`）、泰珂露「心灵捕获」（`mind_capture` / `mind_capture_resolve`）和清风弓箭手「远程」（`ranged`）。

## 92. 史米革「魔力成瘾」回合结束入口最小修复回写（2026-07-02）

本轮继续消费 B5 已 locked 合同，没有重新读图片/OCR。这里修的是已锁官方合同和真实阶段入口的直接冲突。

- 已锁官方合同：史米革「魔力成瘾」（`magic_addiction`）要求回合结束时强制处理：花 1 魔力或弃置本单位；若没有魔力，则必须弃置本单位。
- 失败信号：新增真实回合结束入口测试后，从玩家 0 抽牌阶段推进阶段时，`magic_addiction_check` 只落到通用能力触发通知，没有产生花费魔力事件，也没有产生弃置本单位事件；直接执行器已有同语义，但真实 onTurnEnd 链路没有消费者。
- 最小修复：`src/games/summonerwars/domain/customActionHandlers.ts` 注册 `magic_addiction_check`，在回合结束自动触发路径中按当前玩家魔力直接生成 `MAGIC_CHANGED delta=-1`，无魔力时生成 `UNIT_DESTROYED reason='magic_addiction'`；既有直接执行器保留同语义。
- 测试补证：`src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts` 新增两个真实阶段入口断言，分别覆盖有 1 魔力时自动花 1 魔力并保留史米革、无魔力时自动弃置史米革。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts src/games/summonerwars/__tests__/abilities-goblin.test.ts --configLoader native -t "magic_addiction|魔力成瘾"` 先红后绿，修复后 2 个测试文件通过，5 passed / 152 skipped。
- B5 矩阵状态：`magic_addiction` 从 `proof-needed` 回写为 `fixed-with-proof`；B5 剩余 `proof-needed` 为城塞骑士「守护」（`guardian`）、寒冰冲撞（`ice_ram`）、贾穆德「冰片」（`ice_shards`）、泰珂露「心灵捕获」（`mind_capture` / `mind_capture_resolve`）和清风弓箭手「远程」（`ranged`）。

## 93. 城塞骑士「守护」多守卫目标边界补证（2026-07-02）

本轮继续消费 B5 已 locked 合同，没有重新读图片/OCR，也没有修改机制实现。这里补的是「相邻敌方攻击时必须攻击守卫单位」的多目标边界证据。

- 已锁官方合同：城塞骑士「守护」（`guardian`）要求相邻敌方攻击时，攻击目标必须是有守护能力的单位。
- 实现链路：`src/games/summonerwars/domain/validate.ts` 在声明攻击时检查攻击者四邻是否存在可被攻击的敌方守卫；若目标本身不是守卫且相邻存在合法守卫目标，则拒绝本次攻击。
- 既有覆盖：`src/games/summonerwars/__tests__/abilities-paladin.test.ts` 与 `src/games/summonerwars/__tests__/boundaryEdgeCases.test.ts` 已覆盖单个相邻守卫强制、攻击守卫本身可通过、守卫不相邻时不强制、相邻无守卫时可自由攻击。
- 新增补证：`src/games/summonerwars/__tests__/abilities-paladin.test.ts` 新增“多个相邻守卫时可攻击任一守卫但不能攻击非守卫”断言，覆盖多个守卫目标集合和非守卫目标拒绝。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-paladin.test.ts src/games/summonerwars/__tests__/boundaryEdgeCases.test.ts --configLoader native -t "guardian|守卫"` 通过，2 个测试文件通过，7 passed / 65 skipped。
- B5 矩阵状态：`guardian` 从 `proof-needed` 回写为 `match-with-proof`；B5 剩余 `proof-needed` 为寒冰冲撞（`ice_ram`）、贾穆德「冰片」（`ice_shards`）、泰珂露「心灵捕获」（`mind_capture` / `mind_capture_resolve`）和清风弓箭手「远程」（`ranged`）。

## 94. 寒冰冲撞目标类型过滤最小修复回写（2026-07-02）

本轮继续消费 B5 已 locked 合同，没有重新读图片/OCR。这里修的是已锁官方合同和真实目标选择/执行器边界的直接冲突。

- 已锁官方合同：寒冰冲撞（`ice_ram`）要求在友方建筑移动或被强制移动后，可选择相邻士兵或英雄，加 1 伤害并可 Force 1 格；目标范围不包含召唤师或建筑。
- 失败信号：新增真实移动友方活体结构触发测试后，`ice_ram_target` 目标列表同时包含相邻普通单位和相邻召唤师，说明目标选择层只按“有单位”过滤；执行器同样只判断目标存在，会允许对召唤师造成 `ice_ram` 伤害。
- 最小修复：`src/games/summonerwars/domain/systems.ts` 的 `ice_ram_trigger` 目标列表只纳入 `common`/`champion`；`src/games/summonerwars/domain/abilityValidation.ts` 对 `ice_ram` 激活补充士兵/英雄限制；`src/games/summonerwars/domain/executors/frost.ts` 在造成伤害前同样防御非士兵/英雄目标。
- 测试补证：`src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts` 新增“目标选择和执行器应排除召唤师”断言，先走真实移动友方活体结构触发目标选择，再直接验证执行器不会对召唤师产生 `UNIT_DAMAGED reason='ice_ram'`。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "ice_ram|寒冰冲撞"` 先红后绿，修复后 1 个测试文件通过，3 passed / 104 skipped。
- B5 矩阵状态：`ice_ram` 从 `proof-needed` 回写为 `fixed-with-proof`；B5 剩余 `proof-needed` 为贾穆德「冰片」（`ice_shards`）、泰珂露「心灵捕获」（`mind_capture` / `mind_capture_resolve`）和清风弓箭手「远程」（`ranged`）。

## 95. 贾穆德「寒冰碎屑」攻击阶段自动结算覆盖（2026-07-17 更新）

本节原 2026-07-02 结论写的是“建造阶段结束可花 1 充能”和“确认/跳过路径证据”。该结论已被 2026-07-17 当前用户故事覆盖，不再作为当前实现真相。

- 当前用户故事：`docs/games/summonerwars/user-stories/ice-shards-attack-start-auto-2026-07-17.md`。
- 当前规则口径：贾穆德「寒冰碎屑」（`ice_shards`）在攻击阶段开始时自动触发；消耗 1 充能；对每个与己方建筑相邻的敌方单位造成 1 伤害；多建筑相邻不重复；不出现确认/跳过选择。
- 当前实现链路：`src/games/summonerwars/domain/flowHooks.ts` 在 attack 阶段开始触发；`src/games/summonerwars/domain/systems.ts` 收到 `ice_shards_damage` 后直接执行 `ACTIVATE_ABILITY(ice_shards)`；`src/games/summonerwars/domain/executors/frost.ts` 负责扣充能和去重伤害；`Board.tsx` / `StatusBanners.tsx` 不再展示寒冰碎屑确认/跳过 UI。
- 当前测试补证：`interaction-chain-comprehensive.test.ts` 覆盖自动结算、无交互、充能不足不创建选择、多贾穆德同阶段自动结算；`summonerwars-ice-shards-minimal.e2e.ts` 覆盖真实页面无选择 UI、敌方伤害 1、贾穆德充能 2→1。
- 当前证据入口：`evidence/summonerwars/summonerwars-ice-shards-e2e-test.md`。

## 96. 泰珂露「心灵捕获」真实交互桥接补证（2026-07-02）

本轮继续消费 B5 已 locked 合同，没有重新读图片/OCR，也没有修改机制实现。这里补的是“致命攻击后可忽略伤害并获得目标控制权”的真实攻击交互闭环。

- 已锁官方合同：泰珂露「心灵捕获」（`mind_capture`）要求本单位攻击敌方单位时，若本次将加入的伤害足以摧毁目标，可改为忽略该伤害并获得目标控制权；`mind_capture_resolve` 只是内部确认分支，承接控制或保留伤害选择，不是独立卡面能力。
- 实现链路：`src/games/summonerwars/domain/execute.ts` 在致命攻击敌方单位时生成 `MIND_CAPTURE_REQUESTED`，不立即发 `UNIT_DAMAGED`；`src/games/summonerwars/domain/systems.ts` 将请求转成控制/伤害二选一交互；`src/games/summonerwars/domain/executors/trickster.ts` 在选择 control 时发 `CONTROL_TRANSFERRED`，不发伤害；`src/games/summonerwars/domain/execute/abilities.ts` 在 `mind_capture_resolve` 后才触发攻击后能力。
- 先红信号：新增测试第一次失败，是测试夹具把泰珂露攻击类型写成错误枚举 `range`，导致命中数为 0，没有生成心灵捕获交互；修正为真实枚举 `ranged` 后进入合同对应分支。这不是录入问题，也不是机制实现冲突。
- 测试补证：`src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts` 新增真实桥接断言：致命攻击后生成 `mind_capture` 二选一交互，请求阶段目标仍归敌方且伤害为 0；选择 control 后交互清空、目标 owner 变为攻击方、目标伤害仍为 0，且攻击后能力在决策后才触发。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts src/games/summonerwars/__tests__/abilities-trickster.test.ts src/games/summonerwars/__tests__/abilities-trickster-execute.test.ts --configLoader native -t "mind_capture|心灵捕获"` 先红后绿，修正测试夹具后 3 个测试文件通过，11 passed / 174 skipped。
- B5 矩阵状态：`mind_capture`、`mind_capture_resolve` 从 `proof-needed` 回写为 `match-with-proof`；B5 剩余 `proof-needed` 只剩清风弓箭手「远程」（`ranged`）。`ferocity` 继续保持 `disputed-skip`，不进入机制修复或规则断言测试。

## 97. 清风弓箭手「远射」攻击范围补证（2026-07-02）

本轮继续消费 B5 已 locked 合同，没有重新读图片/OCR，也没有修改机制实现。这里补的是“最多 4 个清晰直线格攻击卡牌”的目标类型与路径边界证据。

- 已锁官方合同：清风弓箭手「远射」（`ranged`，官方 `Far Shot`）要求本单位可攻击最多 4 个 clear straight spaces away 的 cards；合同明确目标是 cards，不只限单位，并要求清晰直线路径。
- 实现链路：`src/games/summonerwars/domain/helpers.ts` 的 `getEffectiveAttackRange` 在单位具有 `ranged` 能力时返回 4；`canAttackEnhanced` 允许敌方单位或建筑作为目标，要求距离不超过有效范围、目标在直线上，并通过 `isRangedPathClear` 拒绝中间格存在单位或建筑的路径。
- 既有覆盖：`src/games/summonerwars/__tests__/abilities-trickster.test.ts` 已覆盖 4 格单位目标可攻击、超过 4 格拒绝，以及 `getEffectiveAttackRangeBase` 对远射返回 4、普通远程返回卡牌基础范围。
- 新增补证：同一测试文件新增三条合同边界断言：4 格清晰直线外的敌方建筑可被攻击；路径中间有卡牌阻挡时不可攻击；4 格内但非直线的目标不可攻击。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-trickster.test.ts --configLoader native -t "ranged|远射"` 通过，1 个测试文件通过，8 passed / 38 skipped。
- B5 矩阵状态：`ranged` 从 `proof-needed` 回写为 `match-with-proof`；B5 的 18 个 `locked` 对象首轮实现对照已清空 `proof-needed`。`ferocity` 继续保持 `disputed-skip`，不进入机制修复或规则断言测试。

## 98. B6 充能与数值对象实现对照收口（2026-07-02）

本轮继续消费 B6 已 locked 合同，没有重新读图片/OCR，也没有修改机制实现。这里收口的是 7 个充能写入、充能读取、伤害读取和回合末清理对象的首轮实现对照。

- 已锁合同来源：`evidence/summonerwars/b6-p3-p4-charge-and-stat-rule-text-lock-matrix-2026-07-02.md`，包含亡灵战士「血腥狂怒」（`blood_rage` / `blood_rage_decay`）、祖灵法师「聚能」（`gather_power`）、布拉夫/亡灵战士「力量强化」（`power_boost`）、蒙威尊者「力量强化」（`power_up`）、雌狮「生命强化」（`life_up`）、古尔-达斯「暴怒」（`rage`）。
- 实现链路：`src/games/summonerwars/domain/abilities.ts` / `abilities-barbaric.ts` 定义对应能力；`abilityResolver.ts` 统一读取充能、伤害和 `maxBonus`；`execute.ts` 处理召唤后聚能；`flowHooks.ts` 在回合结束触发 `blood_rage_decay`；`reduce.ts` 对 `UNIT_CHARGED` 做非负夹取。
- 既有证明：`abilities-barbaric.test.ts` 覆盖 `power_up`、`life_up`、`gather_power`；`abilities-goblin.test.ts` 覆盖布拉夫 `power_boost`；`abilities-necromancer-execute.test.ts` 覆盖亡灵战士真实攻击击杀后 `blood_rage` 状态充能；`entity-chain-integrity.test.ts` 覆盖 `rage`、`blood_rage`、`gather_power`、`blood_rage_decay` 正负路径。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts src/games/summonerwars/__tests__/abilities-barbaric.test.ts src/games/summonerwars/__tests__/abilities-goblin.test.ts src/games/summonerwars/__tests__/abilities-necromancer-execute.test.ts --configLoader native -t "rage|blood_rage|blood_rage_decay|gather_power|power_boost|power_up|life_up|暴怒|血腥狂怒|聚能|力量强化|生命强化"` 通过，4 个测试文件通过，28 passed / 196 skipped。
- B6 矩阵状态：`blood_rage`、`blood_rage_decay`、`gather_power`、`power_boost`、`power_up`、`life_up`、`rage` 均已升级为 `match-with-L4-proof`；B6 当前没有 `match-with-proof`、`proof-needed` 或 `fixed-with-proof` 残留。
- 续跑边界：B6 收口不代表全量补审完成；下一步继续后续 locked 批次实现对照，不回录入层。只有发现合同缺字段、来源冲突或对象归属不清时，才允许把对象降级为 `blocked` / `disputed` 后补录入合同。

## 99. B7 移动穿越与相邻离开对象实现对照收口（2026-07-02）

本轮继续消费 B7 已 locked 合同，没有重新读图片/OCR，也没有修改机制实现。这里收口的是 7 个移动距离、穿越卡牌/建筑、攻击相邻减伤、离开相邻伤害对象的首轮实现对照。

- 已锁合同来源：`evidence/summonerwars/b7-p3-movement-and-adjacency-rule-text-lock-matrix-2026-07-02.md`，包含部落攀爬手「攀爬」（`climb`）、掷术师「迷魂」（`evasion`）、葛拉克「飞行」（`flying`）、掷术师「缠斗」（`rebound`）、寒冰魔像「缓慢」（`slow`）、清风弓箭手「迅捷」（`swift`）、蒙威尊者/犀牛/熊骑兵「践踏」（`trample`）。城塞骑士「缠绕/缠斗」（`entangle`）仍为对象归属争议。
- 实现链路：`abilities-goblin.ts`、`abilities-frost.ts`、`abilities-trickster.ts` 定义移动与相邻能力；`helpers.ts` 的 `getUnitMoveEnhancements` / `canMoveToEnhanced` / `getEntangleUnits` / `getEvasionUnits` 消费移动距离、穿越和相邻单位集合；`execute.ts` 在移动、推拉和攻击结算中发出践踏伤害、缠斗伤害和迷魂减伤。
- 既有证明：`abilities-goblin.test.ts` 覆盖攀爬额外移动、穿越建筑、不能穿越单位；`abilities-trickster.test.ts` 覆盖飞行额外移动、穿越卡牌、迅捷额外移动且不能穿越卡牌；`abilities-frost.test.ts` 覆盖缓慢移动距离和践踏致死后续；`entity-chain-integrity.test.ts` 覆盖践踏、迷魂、缠斗的正负路径；`abilities-trickster-execute.test.ts` 覆盖推拉导致远离缠斗单位时伤害落点。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts src/games/summonerwars/__tests__/abilities-frost.test.ts src/games/summonerwars/__tests__/abilities-goblin.test.ts src/games/summonerwars/__tests__/abilities-trickster.test.ts src/games/summonerwars/__tests__/abilities-trickster-execute.test.ts --configLoader native -t "climb|evasion|flying|rebound|slow|swift|trample|攀爬|迷魂|飞行|缠斗|缓慢|迅捷|践踏"` 通过，5 个测试文件通过，41 passed / 217 skipped。
- B7 矩阵状态：`climb`、`evasion`、`flying`、`rebound`、`slow`、`swift`、`trample` 均已升级为 `match-with-L4-proof`；`entangle` 继续保持 `disputed-skip`，未裁定对象归属前不进入机制修复或规则断言测试。
- 续跑边界：B7 收口不代表全量补审完成；下一步继续后续 locked 批次实现对照，不回录入层。只有发现合同缺字段、来源冲突或对象归属不清时，才允许把对象降级为 `blocked` / `disputed` 后补录入合同。

## 100. B8 静态、召唤与死亡对象实现对照收口（2026-07-02）

本轮继续消费 B8 已 locked 合同，没有重新读图片/OCR，也没有新增机制修复。这里收口的是 6 个静态生命光环、召唤替换、活体传送门/结构、死亡伤害和击杀不获魔法对象的首轮实现对照。

- 已锁合同来源：`evidence/summonerwars/b8-p3-p4-static-summon-and-death-rule-text-lock-matrix-2026-07-02.md`，包含地狱火教徒「献祭」（`sacrifice`）、奥莱格「寒流」（`cold_snap`）、伊路特-巴尔「火祀召唤」（`fire_sacrifice_summon`）、寒冰魔像「活体传送门」（`living_gate`）、寒冰魔像「活体结构」（`mobile_structure`）、亡灵疫病体「无魂」（`soulless`）。
- 实现链路：`abilities.ts` / `abilities-frost.ts` 定义 B8 能力；`helpers.ts` 消费活体传送门召唤位置和活体结构移动；`execute.ts` / `execute/helpers.ts` 处理火祀召唤替换、死亡触发和无魂跳过魔法奖励标记；`reduce.ts` 在 `UNIT_DESTROYED` 中按 `skipMagicReward` 决定是否给击杀者魔法；`abilityResolver.ts` 消费寒流建筑生命加成。
- 既有证明：`implementation-audit-first-pass-findings-2026-07-02.md` 已记录 `cold_snap` 最小修复、`fire_sacrifice_summon` 负向补证、`living_gate` / `mobile_structure` 消费者链补证、`sacrifice` 死亡前相邻集合补证；`abilities-advanced.test.ts` 覆盖火祀召唤和无魂；`abilities-frost.test.ts` 覆盖活体传送门/活体结构与践踏致死触发献祭；`entity-chain-integrity.test.ts` 覆盖寒流与献祭；`reduce.test.ts` 覆盖 `skipMagicReward` 不给魔法。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts src/games/summonerwars/__tests__/abilities-advanced.test.ts src/games/summonerwars/__tests__/abilities-frost.test.ts src/games/summonerwars/__tests__/reduce.test.ts --configLoader native -t "cold_snap|fire_sacrifice_summon|living_gate|mobile_structure|sacrifice|soulless|寒流|火祀召唤|火祭召唤|活体传送门|活体结构|献祭|无魂"` 通过，3 个测试文件通过、1 个测试文件被目标过滤跳过，23 passed / 168 skipped。
- B8 矩阵状态：`cold_snap` 为 `fixed-with-proof`；`sacrifice`、`fire_sacrifice_summon`、`living_gate`、`mobile_structure`、`soulless` 均为 `match-with-proof`。
- 续跑边界：B8 收口不代表全量补审完成；下一步继续后续 locked 对象或更高层 L3/L4 补证，不回录入层。只有发现合同缺字段、来源冲突或对象归属不清时，才允许把对象降级为 `blocked` / `disputed` 后补录入合同。

## 101. 全量首轮实现对照后的 L3/L4 残余队列（2026-07-02）

本轮只更新续跑口径和残余补证入口，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。当前数据录入合同已经形成 `4 L4 + 62 locked + 2 disputed + 0 待建合同`，所以普通续跑必须消费已锁合同，而不是回到卡图层重复录入。

- 总矩阵回写：`evidence/summonerwars/full-leak-reaudit-master-matrix-2026-07-02.md` 的“分流规则 / 下一批执行入口”已修正，移除过期的 `P2 blocked`、`P3/P4 待建合同` 口径，改为 locked 合同后的 L3/L4 补证入口。
- 新增队列：`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 建立首轮实现对照后的残余补证队列，分为必须优先补的 L4、可按代表链合并的补证、以及 disputed 归属裁定。
- 优先顺序：先补梅肯达·露/边境弓箭手「连续射击」（`rapid_fire`）和古尔壮「心灵传念」（`mind_transmission`）的额外攻击真实入口与刷新/回放不重复；再补感染、灵魂转移、吸取生命、念力代替攻击等真实交互闭环；随后补阶段推进类。
- disputed 边界：史米革/部落投石手「凶猛」（`ferocity`）和城塞骑士「缠绕/缠斗」（`entangle`）仍只做归属裁定；未裁定前不得写规则断言测试、不得修机制、不得判通过。
- 数据录入边界：只有 L3/L4 对照中发现 locked 合同缺字段、来源冲突或对象归属不清，才允许把对象回写为 `blocked` 或 `disputed` 并回录入层补合同；否则不得因为“担心录入质量”无故重新读图。

## 102. 「连续射击」/「心灵传念」额外攻击 L4 补证（2026-07-02）

本轮继续消费 B1 已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是 L4-01 与 L4-02 的真实入口和重复响应负向证据。

- 梅肯达·露/边境弓箭手「连续射击」（`rapid_fire`）：新增真实攻击后确认交互断言，确认后只消耗 1 充能并授予本单位 1 次额外攻击；交互收口后重复响应同一 interaction 会被拒绝，且不会再次消耗充能或再次授予额外攻击。
- 古尔壮「心灵传念」（`mind_transmission`）：新增攻击敌方建筑后生成友方士兵选择、选择后只授予目标 1 次额外攻击的真实入口断言；交互收口后重复响应同一 interaction 会被拒绝，且不会二次授予目标额外攻击。
- 矩阵回写：`evidence/summonerwars/b1-p1-implementation-diff-matrix-2026-07-02.md` 中 `rapid_fire` 与 `mind_transmission` 回写为 `match-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已新增“已完成 L4 补证”并调整续跑顺序。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "rapid_fire|mind_transmission|连续射击|心灵传念"` 通过，1 个测试文件通过，7 passed / 105 skipped。
- 后续边界：若后续发现 UI eventStream 刷新/回放会重复打开确认或选择，再追加 UI 层专项；当前已补的是真实交互确认和重复响应不二次结算。

## 103. 数据录入合同更新后的续跑口径（2026-07-02）

本轮用户再次纠偏：当前阶段不是重新读图片、重新 OCR 或重新录入；“数据录入要做好”指的是 `locked` 之前必须把合同字段做扎实，`locked` 之后普通续跑必须直接消费合同。这里回写后续执行口径，防止审计继续时倒退到录入层。

- 当前阶段：召唤师战争全量补审已经形成 `4 L4 + 62 locked + 2 disputed + 0 待建合同`；普通续跑入口是 `evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md`。
- 录入质量门槛：对象标为 `locked` 前，必须已经登记主真相源、完整单对象图/可读裁图、对象归属、规则原文、原子子句、索引入口、对照差异和未决项；这些字段缺一时不能靠实现审计阶段临时补猜。
- `locked` 后的继续动作：只做实现对照、真实入口补证、刷新/回放不重复、重复消费防御、行动经济、共享链和最小修复；不得无故重读卡图/OCR，也不得把“担心录入质量”当成普通续跑理由。
- 降级条件：若消费 `locked` 合同时发现字段缺失、来源冲突或对象归属不清，必须先把对象回写为 `blocked` 或 `disputed`，再回录入层补合同；不能在实现审计里边猜边改。
- `disputed` 边界：史米革/部落投石手「凶猛」（`ferocity`）和城塞骑士「缠绕/缠斗」（`entangle`）只做归属裁定；归属未定前不得写规则断言测试、不得修机制、不得判通过。
- 下一步执行：继续按残余队列推进 `infection`、`soul_transfer`、`life_drain`、`high_telekinesis_instead`、`telekinesis_instead` 等真实交互闭环；只有补证过程中暴露合同缺口，才回到录入层。

## 104. B4 攻击窗口与召唤转移真实交互 L4 补证（2026-07-02）

本轮继续消费 B4 已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是 `infection`、`life_drain`、`soul_transfer`、`high_telekinesis_instead`、`telekinesis_instead` 的真实交互闭环和重复响应负向证据。

- 亡灵疫病体「感染」（`infection`）：新增真实击杀后生成选弃牌堆疫病体交互、选择后从弃牌堆召唤到被摧毁单位位置、交互收口后重复响应不再次召唤的断言。
- 德拉戈斯「吸取生命」（`life_drain`）：新增攻击前生成牺牲选择、选择 2 格内友方单位后只摧毁一次、交互收口后重复响应不再次牺牲的断言。
- 亡灵弓箭手「灵魂转移」（`soul_transfer`）：新增确认移动交互断言，确认后源位置清空、本单位落到被摧毁单位位置，重复响应不再次移动。
- 清风法师「念力」代替攻击（`telekinesis_instead`）：新增真实 UI 二段选择断言，先选目标、再选方向，成功后目标推拉落位并只产生一次攻击行动消耗；重复响应不再次消耗攻击行动。
- 卡拉「高阶念力」代替攻击（`high_telekinesis_instead`）：与清风法师「念力」代替攻击共用二段选择系统；高阶 3 格范围与行动经济已有直接断言，本轮按共享二段系统代表链补证，不单独回录入层。
- 矩阵回写：`evidence/summonerwars/b4-p2-implementation-diff-matrix-2026-07-02.md` 已将 B4 五个对象回写为 L4 proof 状态；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已把 L4-10 至 L4-14 移入已完成补证。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "infection|soul_transfer|life_drain|telekinesis_instead|感染|灵魂转移|吸取生命|念力"` 通过，1 个测试文件通过，6 passed / 110 skipped。
- 后续边界：本轮补的是系统真实交互链和重复响应不二次结算；若后续发现 UI eventStream 刷新/回放会重复打开选择或确认，再追加 UI 层专项。2026-07-17 后，`ice_shards` 已从此类可确认/跳过阶段交互中移除，当前按攻击阶段开始自动结算证据入口收口；下一步继续阶段推进类 `feed_beast`、`magic_addiction`、`guidance`、`blood_rune`，仍不回录入层。

## 105. 巨食兽「喂养野兽」阶段结束 L4 补证（2026-07-02）

本轮继续消费巨食兽「喂养野兽」（`feed_beast`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是攻击阶段结束真实入口、重复响应不二次弃置和阶段继续推进证据。

- 真实入口：新增攻击阶段结束推进断言；当巨食兽本回合未摧毁单位且存在相邻友方单位时，阶段推进会停在「喂养野兽」二选一交互。
- 强制结算：选择吞噬相邻友方后，只弃置该友方单位，巨食兽保留在棋盘上。
- 重复响应：同一个已收口交互再次响应会被拒绝，不会二次弃置同一个友方单位，也不会改写已完成结算。
- 阶段推进：结算后再次推进阶段会进入 magic，且不残留「喂养野兽」交互。
- 矩阵回写：`evidence/summonerwars/b3-p2-implementation-diff-matrix-2026-07-02.md` 已将 `feed_beast` 回写为 `match-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已将 L4-03 标为完成。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "feed_beast|喂养野兽"` 通过，1 个测试文件通过，4 passed / 113 skipped。
- 后续边界：本轮只补系统真实阶段推进和重复响应证据；若后续发现 UI eventStream 刷新/回放层重复打开同一选择，再追加 UI 层专项。下一步继续 `ice_shards`、`magic_addiction`、`guidance`、`blood_rune`，仍不回录入层。

## 106. 贾穆德「冰片」多来源阶段结束 L4 补证（2026-07-02）

本轮继续消费贾穆德「冰片」（`ice_shards`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是多个贾穆德在同一建造阶段结束时的顺序边界、阶段收口和提前推进门禁。

- 单来源入口：既有真实建造阶段结束断言已覆盖确认路径和跳过路径；确认时花 1 充能并对同一敌方单位只造成 1 次伤害，跳过时不消耗充能、不造成伤害。
- 多来源顺序：新增两个贾穆德同在建造阶段结束触发的断言；系统会排出两个「冰片」交互，并按来源单位逐个收口。
- 提前推进门禁：第一个「冰片」确认后，第二个交互未响应前尝试推进阶段会被拒绝，不会重复发射「冰片」触发事件，也不会重复造成伤害。
- 阶段收口：第二个「冰片」确认后，两个来源单位各消耗 1 充能，目标敌方单位累计受到 2 次来自两个来源的伤害；所有交互清空后再次推进进入 attack 阶段。
- 矩阵回写：`evidence/summonerwars/b5-p2-implementation-diff-matrix-2026-07-02.md` 已将 `ice_shards` 回写为 `match-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已将 L4-15 标为完成。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "ice_shards|冰片|寒冰碎屑"` 通过，1 个测试文件通过，3 passed / 115 skipped。
- 后续边界：本轮只补系统真实阶段推进和多来源收口证据；若后续发现 UI eventStream 刷新/回放层重复打开同一选择，再追加 UI 层专项。下一步继续 `magic_addiction`、`guidance`、`blood_rune`，仍不回录入层。

## 107. 史米革「魔力成瘾」多来源回合结束 L4 修复与补证（2026-07-02）

本轮继续消费史米革「魔力成瘾」（`magic_addiction`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则。这里补的是多个史米革同一回合结束时共享魔力资源的顺序消费边界。

- 已锁合同：史米革「魔力成瘾」要求回合结束时强制处理；有魔力则花 1 魔力，没有魔力则弃置本单位。
- 失败信号：新增两个史米革、玩家只有 1 点魔力的真实回合结束测试后，两个来源都读取触发前同一份 `magic=1` 快照，产生 2 个扣魔力事件，没有让第二个史米革按合同弃置。
- 根因定位：`flowHooks.ts` 在抽牌阶段结束时使用批量触发，所有回合结束能力先基于同一份 core 快照收集事件；`magic_addiction_check` 依赖共享魔力状态，因此不能等整批事件收集完再归约。
- 最小修复：`flowHooks.ts` 新增回合结束自动技能顺序触发路径，每个单位产生的事件立即进入临时 core，再用更新后的状态判断下一个单位；范围限定在回合结束自动技能链，避免扩大改动到阶段确认技能或交互技能。
- 测试补证：`src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts` 新增“多个史米革回合结束时应按顺序消费魔力，不共享同一份魔力快照”断言，确认只产生 1 个扣魔力事件、1 个 `magic_addiction` 弃置事件，最终只保留 1 个史米革。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "magic_addiction|魔力成瘾"` 通过，1 个测试文件通过，3 passed / 116 skipped。
- 相邻回归：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-goblin.test.ts --configLoader native -t "magic_addiction|魔力成瘾"` 通过，1 个测试文件通过，3 passed / 48 skipped；`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "magic_addiction|guidance|blood_rune|ice_shards|feed_beast|魔力成瘾|指引|血符文|冰片|喂养野兽"` 通过，1 个测试文件通过，15 passed / 104 skipped。
- 矩阵回写：`evidence/summonerwars/b5-p2-implementation-diff-matrix-2026-07-02.md` 已将 `magic_addiction` 升级为 `fixed-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已将 L4-19 标为完成。
- 后续边界：本轮修复的是系统回合结束多来源共享资源顺序消费；若后续发现 UI eventStream 刷新/回放层重复触发同一回合结束能力，再追加 UI 层专项。下一步继续 `guidance`、`blood_rune`，仍不回录入层。

## 108. 瓦伦蒂娜「指引」召唤阶段入口 L4 补证（2026-07-02）

本轮继续消费瓦伦蒂娜「指引」（`guidance`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是召唤阶段真实入口和牌库不足边界。

- 已锁合同：瓦伦蒂娜「指引」要求你的召唤阶段开始时强制抽 2 张牌。
- 真实入口：既有补证已覆盖从对手抽牌阶段推进到玩家 0 召唤阶段时，玩家 0 的瓦伦蒂娜自动抽 2 张。
- 本轮新增边界：新增牌库不足真实入口断言，确认召唤阶段开始时若牌库不足 2 张，只抽实际剩余牌数，不越界、不重复抽。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "guidance|指引"` 通过，1 个测试文件通过，2 passed / 118 skipped。
- 矩阵回写：`evidence/summonerwars/b5-p2-implementation-diff-matrix-2026-07-02.md` 已将 `guidance` 升级为 `match-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已将 L4-20 标为完成。
- 后续边界：本轮补的是系统真实阶段入口和牌库不足边界；若后续发现 UI eventStream 回放重复抽牌，再追加 UI 层专项。

## 109. 布拉夫「血符文」多来源攻击阶段开始 L4 修复与补证（2026-07-02）

本轮继续消费布拉夫「血符文」（`blood_rune`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则。这里补的是多个布拉夫同一攻击阶段开始时共享魔力状态的顺序消费边界。

- 已锁合同：布拉夫「血符文」要求你的攻击阶段开始时强制二选一：花 1 魔力给本单位 1 充能，或给本单位 1 伤害。没有魔力时，只能走自伤路径。
- 失败信号：新增两个布拉夫、玩家只有 1 点魔力的真实攻击阶段开始测试后，第一个布拉夫花唯一魔力充能，第二个布拉夫仍保留入队时旧 `charge` 选项。
- 根因定位：`systems.ts` 创建 `blood_rune_choice` 时把选项按当时魔力静态写入队列；多个来源同阶段触发时，后续交互弹出前已有响应改变魔力，但队列里的选项没有刷新。
- 最小修复：`systems.ts` 抽出血符文选项生成 helper，并给血符文 simple-choice 写入 `optionsGenerator`，让交互成为 current 时按最新 core 魔力重算选项；当前没有魔力时只剩自伤选项，并由既有 `autoResolveIfSingle` 自动结算。
- 测试补证：`src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts` 新增“多个布拉夫阶段开始时应按响应后的魔力状态处理后续选择”断言，确认第一个布拉夫充能后魔力归 0，第二个布拉夫自动自伤且不残留交互。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "blood_rune|血符文"` 通过，1 个测试文件通过，5 passed / 116 skipped。
- 相邻回归：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-goblin.test.ts --configLoader native -t "blood_rune|血符文"` 通过，1 个测试文件通过，3 passed / 48 skipped；`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "guidance|blood_rune|magic_addiction|指引|血符文|魔力成瘾"` 通过，1 个测试文件通过，10 passed / 111 skipped。
- 矩阵回写：`evidence/summonerwars/b3-p2-implementation-diff-matrix-2026-07-02.md` 已将 `blood_rune` 升级为 `fixed-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已将 L4-21 标为完成。
- 后续边界：本轮修复的是系统阶段开始多来源共享资源顺序消费；若后续发现 UI eventStream 回放层重复打开同一阶段开始选择，再追加 UI 层专项。下一步继续剩余高风险 L4 队列，仍不回录入层。

## 110. 雷塔勒斯「复活亡灵」真实交互链 L4 补证（2026-07-02）

本轮继续消费雷塔勒斯「复活亡灵」（`revive_undead`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是系统真实交互链、成本落点、召唤落位和重复响应不二次执行。

- 已锁合同：雷塔勒斯「复活亡灵」要求召唤阶段每回合一次；可给本单位 2 伤害，从己方弃牌堆选择亡灵单位，并放到本单位相邻空格。
- 已有实现基础：`systems.ts` 在直接发动但缺少目标牌/位置时先创建选弃牌堆亡灵交互，再创建相邻空格选择；`executors/necromancer.ts` 在执行前校验亡灵、相邻、空格，随后产生自伤和从弃牌堆召唤事件。
- 本轮新增证据：`interaction-chain-comprehensive.test.ts` 新增真实交互链断言，覆盖发动技能后进入弃牌堆选牌、选择相邻空格、源单位自伤 2、目标亡灵落位、弃牌堆移除该牌、交互清空，以及同一已收口交互重复响应被拒绝且不二次自伤/召唤。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "revive_undead|复活亡灵"` 通过，1 个测试文件通过，7 passed / 115 skipped。
- 相邻回归：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-necromancer-execute.test.ts --configLoader native -t "revive_undead|复活亡灵"` 通过，1 个测试文件通过，5 passed / 17 skipped。
- 矩阵回写：`evidence/summonerwars/b3-p2-implementation-diff-matrix-2026-07-02.md` 已将 `revive_undead` 升级为 `fixed-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已将 L4-04 标为完成。
- 后续边界：本轮补的是系统真实交互链和重复响应不二次结算；若后续发现 UI eventStream 回放层重复打开选牌或选格，再追加 UI 层专项。下一步继续 `ancestral_bond`、`frost_axe`、`healing`、`holy_arrow`、`structure_shift` 等剩余高风险 L4 队列，仍不回录入层。

## 111. 阿布亚·石「祖灵纽带」移动后真实入口 L4 补证（2026-07-02）

本轮继续消费阿布亚·石「祖灵纽带」（`ancestral_bond`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是移动后真实入口、目标过滤、充能转移落地和重复响应不二次执行。

- 已锁合同：阿布亚·石「祖灵纽带」要求移动后可选；选择 3 格内友方单位；目标获得 1 充能，并把阿布亚·石自身所有充能转移给该目标。
- 已有实现基础：`systems.ts` 在单位移动后为 `ancestral_bond` 创建目标选择交互，并提供跳过选项；`executors/barbaric.ts` 在确认目标后给目标 +1 充能，再把来源单位当前全部充能从来源转移到目标。
- 本轮新增证据：`interaction-chain-comprehensive.test.ts` 新增移动后真实入口断言，覆盖移动后生成 `after_move_ancestral_bond` 交互、交互包含跳过选项、只列入 3 格内友方目标且排除远处友方/敌方、确认后来源充能归 0、目标从 1 充能变为 5 充能、事件中包含目标 +1、来源 -3、目标 +3，以及同一已收口交互重复响应被拒绝且不二次转移。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "ancestral_bond|祖灵纽带|祖灵羁绊"` 通过，1 个测试文件通过，4 passed / 119 skipped。
- 相邻回归：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-barbaric.test.ts --configLoader native -t "ancestral_bond|祖灵纽带|祖灵羁绊"` 通过，1 个测试文件通过，5 passed / 54 skipped。
- 矩阵回写：`evidence/summonerwars/b3-p2-implementation-diff-matrix-2026-07-02.md` 已将 `ancestral_bond` 升级为 `match-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已将 L4-05 标为完成。
- 后续边界：本轮补的是系统真实移动入口和重复响应不二次结算；若后续发现 UI eventStream 回放层重复打开同一移动后选择，再追加 UI 层专项。下一步继续 `frost_axe`、`healing`、`holy_arrow`、`structure_shift` 等剩余高风险 L4 队列，仍不回录入层。

## 112. 寒冰锻造师「寒冰战斧」移动附加与攻击消费 L4 补证（2026-07-02）

本轮继续消费寒冰锻造师「寒冰战斧」（`frost_axe`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有新增机制修复。这里补的是移动后真实交互附加、1 充能消耗、附加落地，以及被附加士兵攻击时 special 按 2 个命中结算。

- 已锁合同：寒冰锻造师「寒冰战斧」要求移动后可选：自身充能，或花 1 充能附加到 3 格内友方士兵；被附加士兵攻击时，特殊面等于两个普通命中。
- 已有实现基础：`systems.ts` 在单位移动后创建 `after_move_frost_axe` 交互，包含自充能、可附加目标和跳过选项；`executors/frost.ts` 在 attach 路径消耗 1 充能并产生附加事件；`execute.ts` 在攻击结算时检查攻击者是否有寒冰战斧附加，并把 special 按 2 个命中计入。
- 本轮新增证据：`interaction-chain-comprehensive.test.ts` 新增真实链路断言，覆盖移动后生成寒冰战斧选择、选择附加到友方士兵、来源寒冰锻造师从棋盘移除并进入目标附加列表、只消耗 1 充能、随后被附加士兵进入攻击阶段并用全 special 骰面攻击，最终命中数等于骰子数乘以 2，目标伤害等于该命中数。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "frost_axe|寒冰战斧|冰霜战斧"` 通过，1 个测试文件通过，10 passed / 114 skipped。
- 相邻回归：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-frost.test.ts --configLoader native -t "frost_axe|寒冰战斧|冰霜战斧"` 通过，1 个测试文件通过，1 passed / 36 skipped。
- 矩阵回写：`evidence/summonerwars/b3-p2-implementation-diff-matrix-2026-07-02.md` 已将 `frost_axe` 升级为 `fixed-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已将 L4-06 标为完成。
- 后续边界：本轮补的是系统真实移动附加和攻击消费链；若后续发现 UI eventStream 回放层重复打开同一移动后选择，再追加 UI 层专项。下一步继续 `healing`、`holy_arrow`、`structure_shift` 等剩余高风险 L4 队列，仍不回录入层。

## 113. 圣殿牧师「治疗」攻击前真实入口与清理 L4 补证（2026-07-02）

本轮继续消费圣殿牧师「治疗」（`healing`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是攻击前真实选牌、弃牌成本、治疗落地、攻击后清理和重复响应不二次执行。

- 已锁合同：圣殿牧师「治疗」要求攻击友方士兵或英雄前可弃 1 张手牌；若支付，本次攻击不造成伤害，而是按普通命中和特殊面治疗。
- 已有实现基础：`systems.ts` 在声明攻击前创建 `before_attack_healing` 选牌/跳过交互；`executors/paladin.ts` 弃牌并设置治疗模式；`execute.ts` 治疗模式独立路径治疗友方目标并避免造成伤害；`reduce.ts` 在 `UNIT_ATTACKED` 后清理攻击者治疗模式。
- 本轮新增证据：`interaction-chain-comprehensive.test.ts` 新增真实入口断言，覆盖攻击前生成治疗选牌交互、交互含可跳过选项、选择手牌后弃牌、设置治疗模式、本次攻击治疗友方目标且不产生伤害、攻击后 `healingMode` 清理、攻击者标记已攻击，以及同一已收口交互重复响应被拒绝且不二次治疗/弃牌。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "healing|治疗"` 通过，1 个测试文件通过，2 passed / 123 skipped。
- 相邻回归：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-paladin-new.test.ts --configLoader native -t "healing|治疗"` 通过，1 个测试文件通过，6 passed / 25 skipped；`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/healing-friendly-attack.test.ts --configLoader native -t "healing|治疗"` 通过，1 个测试文件通过，4 passed。
- 矩阵回写：`evidence/summonerwars/b3-p2-implementation-diff-matrix-2026-07-02.md` 已将 `healing` 升级为 `match-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已将 L4-07 标为完成。
- 后续边界：本轮补的是系统真实攻击前选牌到治疗后清理链；若后续发现 UI eventStream 回放层重复打开同一攻击前选牌，再追加 UI 层专项。下一步继续 `holy_arrow`、`structure_shift` 等剩余高风险 L4 队列，仍不回录入层。

## 114. 城塞弓箭手「圣光箭」真实多选与临时加成 L4 补证（2026-07-02）

本轮继续消费城塞弓箭手「圣光箭」（`holy_arrow`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有改机制实现。这里补的是攻击前真实多选、同名候选去重、本次攻击临时加成、不写永久充能和重复响应不二次执行。

- 已锁合同：城塞弓箭手「圣光箭」要求攻击前展示并弃任意数量互不相同单位牌；每弃 1 张获得 1 魔力，且本次攻击 +1 战力。
- 已有实现基础：`systems.ts` 在声明攻击前创建 `before_attack_holy_arrow` 多选手牌交互，并按卡名去重、排除与攻击者同名单位和非单位牌；`execute.ts` 攻击前分支只对本次攻击累加 `beforeAttackBonus`，并产生加魔力和弃牌事件；直接激活路径已移除永久充能写入。
- 本轮新增证据：`interaction-chain-comprehensive.test.ts` 新增真实多选断言，覆盖同名候选只显示一个、事件卡和同名自身不进入候选、确认两张不同名单位牌后只弃这两张、魔力 +2、攻击骰数按本次攻击临时 +2、不产生 `UNIT_CHARGED`、攻击者不残留永久 `boosts`，以及同一已收口交互重复响应被拒绝且不二次弃牌/加成。
- 旧测试回写：`abilities-paladin.test.ts` 中两条旧断言仍期待「圣光箭」写永久战力，已改为当前合同口径：只获得魔力，不产生永久充能；本次攻击加成由攻击命令路径验证。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "holy_arrow|圣光箭"` 通过，1 个测试文件通过，1 passed / 125 skipped。
- 相邻回归：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-paladin-execute.test.ts --configLoader native -t "holy_arrow|圣光箭"` 通过，1 个测试文件通过，4 passed / 2 skipped；`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-paladin.test.ts --configLoader native -t "holy_arrow|圣光箭"` 通过，1 个测试文件通过，5 passed / 29 skipped。
- 矩阵回写：`evidence/summonerwars/b3-p2-implementation-diff-matrix-2026-07-02.md` 已将 `holy_arrow` 升级为 `fixed-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已将 L4-08 标为完成。
- 后续边界：本轮补的是系统真实攻击前多选和临时加成链；若后续发现 UI eventStream 回放层重复打开同一攻击前选牌，再追加 UI 层专项。下一步继续 `structure_shift` 等剩余高风险 L4 队列，仍不回录入层。

## 115. 斯瓦拉「结构迁移」移动后两步真实入口 L4 补证（2026-07-02）

本轮继续消费斯瓦拉「结构迁移」（`structure_shift`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是移动后真实两步入口、Force 1 相邻空格候选、建筑移动落地和重复响应不二次移动。

- 已锁合同：斯瓦拉「结构迁移」要求移动后可选；选择 3 格内友方建筑；Force 该目标 1 格。
- 已有实现基础：`systems.ts` 在单位移动后为 `structure_shift` 创建友方建筑目标选择交互，并提供跳过选项；确认目标后进入相邻空格选择；`executors/frost.ts` 在确认位置后校验友方建筑/活体结构、3 格内、目标相邻且空，再产生 `UNIT_PUSHED` 事件；`helpers.ts` 已记录普通 Force 可上/下/左/右选择且被单位和建筑阻挡。
- 本轮新增证据：`interaction-chain-comprehensive.test.ts` 新增移动后两步真实入口断言，覆盖移动后生成 `after_move_structure_shift_target` 交互、交互含跳过选项、只列入 3 格内友方建筑且排除远处友方建筑/敌方建筑、二步生成 `after_move_structure_shift_direction` 交互、只列入相邻空格且排除占用格、确认后原建筑格清空且目标格出现己方建筑、`UNIT_PUSHED` 仅产生 1 次，以及同一已收口交互重复响应被拒绝且不二次移动。
- 旧测试回写：`interaction-chain-comprehensive.test.ts` 中旧的完整 payload 断言曾期待「结构迁移」产生 `ATTACK_ACTION_CONSUMED`，已修正为当前合同口径：结构迁移是移动后能力，应产生强制移动事件，不应消耗攻击行动。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "structure_shift|结构迁移|结构变换"` 通过，1 个测试文件通过，7 passed / 120 skipped。
- 矩阵回写：`evidence/summonerwars/b3-p2-implementation-diff-matrix-2026-07-02.md` 已将 `structure_shift` 升级为 `match-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已将 L4-09 标为完成。
- 后续边界：本轮补的是系统真实移动后两步交互和重复响应不二次结算；若后续发现 UI eventStream 回放层重复打开目标选择或位置选择，再追加 UI 层专项。下一步继续后续残余代表链，仍不回录入层。

## 116. 泰珂露「心灵捕获」伤害选择真实入口 L4 补证（2026-07-02）

本轮继续消费泰珂露「心灵捕获」（`mind_capture` / `mind_capture_resolve`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是控制/伤害二选一中的伤害选择真实入口，以及重复响应不二次伤害。

- 已锁合同：泰珂露「心灵捕获」要求攻击敌方单位且本次伤害足以摧毁目标时，可忽略该伤害并获得该单位控制权；若不选择控制，则保留原本伤害结算。
- 已有实现基础：`execute.ts` 在致命攻击时生成 `MIND_CAPTURE_REQUESTED`，请求阶段不立即伤害目标；`systems.ts` 将请求转换为 control / damage 二选一；`executors/trickster.ts` 的 `mind_capture_resolve` 对 control 分支转移控制权，对 damage 分支补发伤害并在致死时触发摧毁；`execute/abilities.ts` 在该分支决策后再触发攻击后能力。
- 本轮新增证据：`interaction-chain-comprehensive.test.ts` 新增 damage 选择断言，覆盖致命攻击后进入 `mind_capture` 二选一交互、请求阶段目标未受伤且攻击后能力未触发、选择 damage 后目标被伤害并摧毁、没有控制权转移、攻击后能力在决策后触发，以及同一已收口交互重复响应被拒绝且不二次伤害/摧毁。
- 既有控制分支证据：同文件已有 control 选择断言，覆盖选择控制后目标不受伤、控制权转移、攻击后能力在决策后触发。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "mind_capture|心灵捕获"` 通过，1 个测试文件通过，3 passed / 125 skipped。
- 矩阵回写：`evidence/summonerwars/b5-p2-implementation-diff-matrix-2026-07-02.md` 已将 `mind_capture`、`mind_capture_resolve` 升级为 `match-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已将 L4-16 标为完成。
- 后续边界：本轮补的是系统真实攻击后二选一和重复响应不二次结算；若后续发现 UI eventStream 回放层重复打开同一心灵捕获选择，再追加 UI 层专项。下一步继续 `sacrifice`、`cold_snap` 等剩余残余队列，仍不回录入层。

## 117. 地狱火教徒「献祭」连锁死亡重复消费 L4 补证（2026-07-02）

本轮继续消费地狱火教徒「献祭」（`sacrifice`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是死亡后处理链里“同一死亡对象被重复致死伤害命中时，不重复注入献祭连锁”的 L4 证据。

- 已锁合同：地狱火教徒「献祭」要求本单位被摧毁后，对每个死亡前相邻敌方单位造成 1 伤害；不影响友方或非相邻单位。
- 已有实现基础：`abilities.ts` 定义 `onDeath`；`execute/helpers.ts` 的 `emitDestroyWithTriggers` 使用死亡前位置触发 `onDeath`；`abilityTargets.ts` 解析死亡前相邻敌方；`postProcessDeathChecks` 在伤害致死时注入完整死亡触发链，并用已摧毁单位集合避免同一 `instanceId` 重复注入死亡链。
- 本轮新增证据：`entity-chain-integrity.test.ts` 新增 `[sacrifice/L4] 重复致死伤害后处理只注入一次献祭连锁`，构造同一地狱火教徒被两条致死伤害事件命中，断言地狱火教徒只产生 1 条摧毁事件；相邻敌方只受到 1 次献祭伤害、只被摧毁 1 次；血腥狂怒只因连锁死亡充能 1 次。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts --configLoader native -t "sacrifice|献祭|连锁"` 通过，1 个测试文件通过，5 passed / 88 skipped。
- 矩阵回写：`evidence/summonerwars/b8-p3-p4-static-summon-and-death-implementation-diff-matrix-2026-07-02.md` 已将 `sacrifice` 升级为 `match-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已将 L4-17 标为完成。
- 后续边界：本轮补的是领域层死亡后处理与连锁重复消费，不是 UI eventStream 重连展示专项；若后续发现 UI 层重复展示同一死亡链，再追加 UI 重连专项。下一步继续 `cold_snap` 动态重算，不回录入层。

## 118. 奥莱格「寒流」动态重算 L4 补证（2026-07-02）

本轮继续消费奥莱格「寒流」（`cold_snap`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是建筑进出场、归属变化和奥莱格离场后的有效生命动态重算证据。

- 已锁合同：奥莱格「寒流」要求友方建筑获得 +1 生命；官方原文没有 3 格范围限制。
- 已有实现基础：`abilities-frost.ts` 定义 `passive auraStructureLife value=1`；`abilityResolver.ts` 的 `getEffectiveStructureLife` 每次按当前棋盘重新遍历建筑拥有者的友方单位并读取光环效果，不把加成写死到建筑状态上；旧 3 格范围限制已在先前实现对照中移除。
- 本轮新增证据：`entity-chain-integrity.test.ts` 新增 `[cold_snap/L4] 建筑进出场与归属变化按当前状态动态重算`，覆盖奥莱格在场时新建筑进场立即获得 +1；移除一座建筑后另一座建筑仍按当前状态获得加成；建筑归属改为敌方后不再获得奥莱格加成；奥莱格离场后友方建筑回到基础生命。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts --configLoader native -t "cold_snap|寒流"` 通过，1 个测试文件通过，6 passed / 88 skipped。
- 矩阵回写：`evidence/summonerwars/b8-p3-p4-static-summon-and-death-implementation-diff-matrix-2026-07-02.md` 已将 `cold_snap` 升级为 `fixed-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已将 L4-18 标为完成。
- 后续边界：本轮补的是领域层有效生命动态计算，不是 UI 展示层即时刷新专项；若后续发现 UI 生命显示没有跟随重算，再追加 UI 层专项。P0 残余 L4-17/L4-18 已清空，下一步继续 P1 代表链或 disputed 归属裁定，不回录入层。

## 119. 卡拉「稳固」Force 代表链补证（2026-07-02）

本轮继续消费卡拉「稳固」（`stable`）、卡拉「高阶念力」（`high_telekinesis`）、清风法师「念力」（`telekinesis`）和寒冰冲撞（`ice_ram`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是“稳固目标不能被 Force”在多个 Force 消费者中的代表链证据。

- 已锁合同：卡拉「稳固」要求本单位不能被 Force；高阶念力/念力要求强制移动士兵或英雄 1 格；寒冰冲撞要求对友方建筑相邻士兵/英雄造成 1 伤害，并可 Force 1 格。
- 已有实现基础：念力系候选生成与执行链在目标过滤和推拉前检查稳固；寒冰冲撞执行器对伤害和后续推拉分开处理，稳固目标仍可承受伤害但不会进入强制移动落位。
- 本轮新增证据：`abilities-trickster-execute.test.ts` 新增“高阶念力不能推动稳固目标”，确认稳固目标位置不变，且不产生推拉事件；`abilities-frost.test.ts` 新增“稳固目标仍受1点伤害但不会被寒冰冲撞强制移动”，确认目标生命下降 1、位置不变，且不产生推拉事件。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-trickster-execute.test.ts src/games/summonerwars/__tests__/abilities-frost.test.ts --configLoader native -t "稳固|stable|高阶念力|寒冰冲撞|ice_ram|high_telekinesis"` 通过，2 个测试文件通过，6 passed / 65 skipped。
- 矩阵回写：`evidence/summonerwars/b1-p1-implementation-diff-matrix-2026-07-02.md` 已将 `high_telekinesis`、`telekinesis` 的稳固残余补证收口为代表链覆盖；`evidence/summonerwars/b5-p2-implementation-diff-matrix-2026-07-02.md` 已将 `stable` 升级为 `match-with-representative-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已新增 P1 Force / 稳固代表链记录。
- 后续边界：本轮补的是已 locked 合同后的实现代表链，不回录入层；`withdraw` 的“直线/路径为空”仍只是通用 Force 细则规则书核对项，不因稳固代表链直接判通。如果后续规则书与当前 Force 细则冲突，再把对应细则降级处理。

## 120. 部落抓附手「抓附」移动后真实入口 L4 补证（2026-07-03）

本轮继续消费部落抓附手「抓附」（`grab` / 官方 `Cling`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是友方单位从抓附手相邻格开始移动后，系统真实生成跟随选择、确认后跟随落位，以及重复响应不二次移动。

- 已锁合同：部落抓附手「抓附」要求友方单位从与本单位相邻处开始移动；该移动之后，可将本单位放到该友方单位相邻格。
- 已有实现基础：`execute.ts` 在友方单位从抓附手相邻格开始移动后发 `GRAB_FOLLOW_REQUESTED`；`systems.ts` 将请求转换为 `grab_follow` 位置选择交互并提供跳过；`executors/goblin.ts` 在确认后校验目标格为空并发出 `UNIT_MOVED`。
- 本轮新增证据：`interaction-chain-comprehensive.test.ts` 新增 `[grab] 友方从相邻处移动后应生成跟随选择且重复响应不二次移动`，覆盖友方单位从相邻格移动后生成 `grab_follow` 交互、候选包含友方移动后相邻空格和跳过选项、确认后抓附手只移动到目标格一次、交互收口，以及同一已收口交互重复响应被拒绝且不二次移动。
- 验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "grab|抓附"` 通过，1 个测试文件通过，1 passed / 128 skipped。
- 矩阵回写：`evidence/summonerwars/b3-p2-implementation-diff-matrix-2026-07-02.md` 已将 `grab` 升级为 `match-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已新增移动后选择代表链补证记录。
- 后续边界：本轮补的是系统真实移动后跟随选择和重复响应不二次结算，不是 UI eventStream 重连展示专项；若后续发现 UI 回放层重复打开同一抓附选择，再追加 UI 层专项。下一步继续移动后/静态/相邻链剩余代表补证，不回录入层。

## 121. 思尼克斯「狡黠」攻击阶段真实入口 L4 补证（2026-07-03）

本轮继续消费思尼克斯「狡黠」（`vanish` / 官方 `Sly`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是攻击阶段无目标发动后的真实选目标入口、目标过滤、交换落位、重复响应不二次交换，以及每回合一次门禁。

- 已锁合同：思尼克斯「狡黠」要求每回合一次、你的攻击阶段、可选，与一个友方 0 费用单位交换位置。
- 已有实现基础：`abilities-goblin.ts` 定义 `usesPerTurn: 1` 与选目标；`systems.ts` 在 `ACTIVATE_ABILITY vanish` 未带目标时生成 `activated_ability_target` 选目标交互，只列入友方 0 费用单位；`executors/goblin.ts` 在确认后发出 `UNITS_SWAPPED`。
- 本轮新增证据：`interaction-chain-comprehensive.test.ts` 新增 `[vanish] 真实入口应选择0费友方并在重复响应时不二次交换`，覆盖无目标发动后生成选目标交互、候选包含友方 0 费用单位、排除非 0 费用友方和敌方 0 费用单位、确认后双方位置交换、交互收口、重复响应被拒绝且不二次交换，以及同回合二次使用被 `usesPerTurn` 门禁拒绝。
- 验证：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "vanish|狡黠|神出鬼没"` 通过，1 个测试文件通过，5 passed / 125 skipped。
- 矩阵回写：`evidence/summonerwars/b3-p2-implementation-diff-matrix-2026-07-02.md` 已将 `vanish` 升级为 `match-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已新增主动选目标代表链补证记录。
- 后续边界：本轮补的是系统真实攻击阶段选目标和重复响应不二次结算，不是 UI eventStream 重连展示专项；若后续发现 UI 回放层重复打开同一狡黠选择，再追加 UI 层专项。下一步继续静态数值、移动穿越或召唤/死亡奖励链剩余代表补证，不回录入层。

## 122. 心灵巫女「幻象」与祖灵法师「祖灵交流」真实入口 L4 补证（2026-07-03）

本轮继续消费心灵巫女「幻象」（`illusion` / 官方 `Mimic`）和祖灵法师「祖灵交流」（`spirit_bond` / 官方 `Commune with Spirits`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有新增机制实现。这里补的是移动阶段开始/移动后真实入口、交互收口和重复响应不二次结算。

- 已锁合同：「幻象」要求你的移动阶段开始时，可选择 3 格内士兵，本单位获得目标能力直到本回合结束；「祖灵交流」要求本单位移动后，在自身 +1 充能或花 1 充能给 3 格内友方单位 +1 充能之间二选一，卡面未写可跳过。
- 已有实现基础：`systems.ts` 在移动阶段开始为 `illusion` 创建可跳过士兵目标选择，并在响应后调用执行器复制能力；`systems.ts` 在移动后为 `spirit_bond` 创建 self / transfer 强制选择且不提供 skip；`executors/trickster.ts` 复制目标当前有效能力；`executors/barbaric.ts` 执行自身充能或转移充能。
- 本轮新增证据：`interaction-chain-comprehensive.test.ts` 新增「幻象」确认复制与重复响应断言，覆盖进入移动阶段生成 `on_phase_start_illusion`、选择 3 格内士兵后复制 `evasion`、交互收口、重复响应被拒绝且不二次复制；新增「祖灵交流」移动后真实入口断言，覆盖移动后生成 `after_move_spirit_bond`、不提供跳过、transfer 候选指向 3 格内友方、确认后来源 -1 充能且目标 +1 充能、交互收口、重复响应被拒绝且不二次转移。
- 验证：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "illusion|spirit_bond|幻象|祖灵交流"` 通过，1 个测试文件通过，9 passed / 123 skipped。
- 矩阵回写：`evidence/summonerwars/b3-p2-implementation-diff-matrix-2026-07-02.md` 已将 `illusion` 升级为 `match-with-L4-proof`，将 `spirit_bond` 升级为 `fixed-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已新增 L4-22 / L4-23，并更新移动后可选/强制选择代表链。
- 后续边界：本轮补的是领域系统真实入口和重复响应不二次结算，不是 UI eventStream 重连展示专项；若后续发现 UI 回放层重复打开同一选择，再追加 UI 层专项。下一步继续 `prepare` / `inspire` 低风险边界、静态数值、移动穿越或召唤/死亡奖励链剩余代表补证，不回录入层。

## 123. 梅肯达·露/边境弓箭手「准备」与凯鲁尊者「鼓舞」完整管线 L4 补证（2026-07-03）

本轮继续消费「准备」（`prepare`）和凯鲁尊者「鼓舞」（`inspire`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是「准备」完整管线行动经济和「鼓舞」移动后目标全集边界。

- 已锁合同：「准备」要求代替本单位移动，可给本单位 1 个充能；「鼓舞」要求本单位移动后，给每个相邻友方单位 1 个充能，卡面未写可选。
- 已有实现基础：`abilities-barbaric.ts` 将 `prepare` 定义为移动阶段直接执行并设置 `costsMoveAction`；`execute.ts` 在单位移动后自动处理 `inspire`，遍历移动后四向相邻友方单位并发 `UNIT_CHARGED`。
- 本轮新增证据：`interaction-chain-comprehensive.test.ts` 新增「准备」完整管线断言，确认准备不打开交互、只产生 1 次准备充能、自身 `hasMoved=true`，且随后移动被拒绝、不二次充能；新增「鼓舞」完整管线断言，确认凯鲁尊者移动后不打开交互，只充能移动后相邻友方，不充能自身、敌方相邻单位、只在移动前相邻但移动后非相邻的友方单位。
- 验证：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "prepare|inspire|准备|鼓舞|启悟"` 通过，1 个测试文件通过，9 passed / 125 skipped。输出中“该单位本回合已移动”是准备后移动被拒绝的负向路径日志，不是测试失败。
- 矩阵回写：`evidence/summonerwars/b2-p1-implementation-diff-matrix-2026-07-02.md` 已将 `prepare`、`inspire` 升级为 `match-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已新增 L4-24 / L4-25，并将移动后可选/强制选择代表链标为当前 L4 完成。
- 后续边界：本轮补的是领域管线和状态落地，不是 UI eventStream 展示专项；若后续发现 UI 回放层重复展示准备/鼓舞事件，再追加 UI 层专项。下一步继续静态数值、移动穿越或召唤/死亡奖励链剩余代表补证，不回录入层。

## 124. 静态数值读取代表链 L4 补证与录入续跑门槛补强（2026-07-03）

本轮响应“数据录入就要做好，后面才不会出问题”的纠偏，先把 `locked` 前最小字段清单写回数据录入与审计 workflow，然后继续消费已 `locked` 合同做实现补证；没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。

- 规则更新：`.spec/skills/data-entry-workflow/SKILL.md`、`.spec/skills/game-audit-workflow/SKILL.md`、`.spec/knowledge/standards/data-entry.md` 已补强 `locked` 最小字段清单：对象/实体标识、主真相源定位、完整单对象图或可读裁图、对象归属、规则原文、原子子句、索引/atlas/槽位入口、对照源差异、未决项和状态。缺任一项不得标 `locked`，后续续跑也不得用实现字段、旧测试或 OCR 临时补规则结论。
- 已锁合同：静态数值读取代表链继续消费 `life_up`、`radiant_shot`、`frost_bolt`、`greater_frost_bolt`、`fortress_elite` 的已锁合同；`power_boost`、`power_up`、`rage` 保留 B6 首轮证明，不因本轮代表链重做录入。
- 本轮新增证据：`entity-chain-integrity.test.ts` 新增静态数值 L4 断言，覆盖「寒冰箭」只统计相邻友方建筑，敌方建筑和非相邻建筑不计入；「高阶寒冰箭」只统计 2 格内友方建筑，敌方建筑和超 2 格友方建筑不计入；「城塞精英」只统计 2 格内友方城塞单位，敌方城塞、超距城塞和非城塞友方不计入；「光辉射击」当前魔力 5 只 +2、当前魔力 1 不加成；「生命强化」按当前充能动态读取有效生命且最多 +5。
- 验证：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts --configLoader native -t "radiant_shot|frost_bolt|greater_frost_bolt|fortress_elite|life_up|静态数值|辉光射击|寒冰箭|高阶寒冰箭|城塞精英|生命强化"` 通过，1 个测试文件通过，9 passed / 90 skipped。
- 矩阵回写：`evidence/summonerwars/b5-p2-implementation-diff-matrix-2026-07-02.md` 已将 `fortress_elite`、`frost_bolt`、`greater_frost_bolt`、`radiant_shot` 升级为 `match-with-L4-proof`；`evidence/summonerwars/b6-p3-p4-charge-and-stat-implementation-diff-matrix-2026-07-02.md` 已将 `life_up` 升级为 `match-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已新增静态数值代表链记录。
- 后续边界：本轮补的是领域层数值读取和边界过滤，不是 UI 展示层或战力 breakdown 专项；若后续发现显示层与领域数值分叉，再追加 UI/展示专项。下一步继续移动穿越或召唤/死亡奖励链剩余代表补证，不回录入层。

## 125. 移动穿越与相邻通用链 L4 代表链补证（2026-07-03）

本轮继续消费 B7 已 `locked` 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是移动与相邻通用链在真实移动入口中的路径、阻挡、伤害落点和非触发边界。

- 已锁合同：部落攀爬手「攀爬」可额外移动并穿越建筑；葛拉克「飞行」可额外移动并穿越卡牌；清风弓箭手「迅捷」只额外移动不穿越；寒冰魔像「缓慢」减少移动距离；践踏单位移动穿越单位后造成 1 伤害；掷术师「缠斗」只在相邻敌方移动或被强制离开本单位时造成 1 伤害。
- 已有实现基础：`helpers.ts` 的 `canMoveToEnhanced` 统一读取移动增强、路径阻挡、建筑穿越和单位穿越；`execute.ts` 的 `MOVE_UNIT` 路径发 `UNIT_MOVED`，随后按 `getPassedThroughUnitPositions` 发践踏伤害，并按移动前后与缠斗单位距离判断是否触发缠斗伤害。
- 本轮新增证据：`entity-chain-integrity.test.ts` 新增 `[movement/L4]` 断言，确认攀爬可穿建筑但不能穿单位；飞行可穿单位和建筑；迅捷可走 3 格空路径但不能穿单位；缓慢可移动 1 格但不能移动 2 格。新增 `[onMove/trample/L4]` 断言，确认真实移动只伤害路径中间被穿越单位，不伤害移动终点外的单位。新增 `[onAdjacentEnemyLeave/rebound/L4]` 断言，确认敌方靠近或移动后仍相邻时不触发缠斗伤害。
- 验证：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts --configLoader native -t "movement|trample|rebound|climb|flying|swift|slow|移动|践踏|缠斗|攀爬|飞行|迅捷|缓慢"` 通过，1 个测试文件通过，13 passed / 89 skipped。
- 矩阵回写：`evidence/summonerwars/b7-p3-movement-and-adjacency-implementation-diff-matrix-2026-07-02.md` 已将 `climb`、`flying`、`rebound`、`slow`、`swift`、`trample` 升级为 `match-with-L4-proof`；后续第 141 节又将 `evasion` 升级为 `match-with-L4-proof`；`entangle` 继续 `disputed-skip`，不写规则断言测试、不修机制。
- 后续边界：本轮补的是领域层移动路径和相邻触发，不是 UI 移动动画、eventStream 重放或攻击展示专项；若后续发现这些展示层分叉，再追加专项。下一步继续召唤/死亡奖励链或其它低风险剩余代表链，不回录入层。

## 126. 活体传送门与聚能召唤入口 L4 代表链补证（2026-07-03）

本轮继续消费寒冰魔像「活体传送门」（`living_gate`）和祖灵法师「聚能」（`gather_power`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是特殊召唤入口是否会绕过 `SUMMON_UNIT` 后续，以及召唤入口归属边界。

- 已锁合同：「活体传送门」要求寒冰魔像作为传送门语义被召唤位置消费者识别；「聚能」要求祖灵法师被召唤后本单位 +1 充能，不是任意友方单位充能。
- 已有实现基础：`helpers.ts:getValidSummonPositions` 把己方带 `living_gate` 的单位加入召唤位置来源，并排除敌方活体传送门；`execute.ts` 的 `SUMMON_UNIT` 在单位召唤事件后检查被召唤卡是否带 `gather_power`，向召唤落点发出 `UNIT_CHARGED delta=1`。
- 本轮新增证据：`entity-chain-integrity.test.ts` 新增 `[gather_power/living_gate/L4]` 断言，覆盖己方活体传送门相邻空格可作为召唤位、敌方活体传送门不为己方提供召唤位、从活体传送门召唤祖灵法师后只产生 1 次 `gather_power` 充能，且充能位置就是被召唤单位位置。
- 验证：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts --configLoader native -t "gather_power|living_gate|聚能|活体传送门"` 通过，1 个测试文件通过，3 passed / 100 skipped。
- 矩阵回写：`evidence/summonerwars/b8-p3-p4-static-summon-and-death-implementation-diff-matrix-2026-07-02.md` 已将 `living_gate` 升级为 `match-with-L4-proof`；`evidence/summonerwars/b6-p3-p4-charge-and-stat-implementation-diff-matrix-2026-07-02.md` 已将 `gather_power` 升级为 `match-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已新增 L4-26 并更新召唤/死亡奖励链代表链。
- 后续边界：本轮补的是领域层召唤入口和后续充能，不是 UI 召唤选择面板、资源展示或死亡奖励专项；若后续发现火祀召唤、无魂死亡奖励或活体结构展示层存在特殊入口绕过，再追加专项。`ferocity`、`entangle` 仍为 disputed，不纳入本轮补证。

## 127. 亡灵疫病体「无魂」死亡奖励最终状态 L4 补证（2026-07-03）

本轮继续消费亡灵疫病体「无魂」（`soulless`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是从“攻击事件带跳过奖励标记”升级到“真实击杀后最终魔力状态正确”。

- 已锁合同：「无魂」要求本单位摧毁敌方单位时不获得魔法。
- 已有实现基础：`execute.ts` 在攻击结算时读取攻击者是否带 `soulless`，致死伤害和 `UNIT_DESTROYED` 事件携带 `skipMagicReward`；`reduce.ts` 在处理 `UNIT_DESTROYED` 时只有 `killerPlayerId` 存在、击杀者不是被摧毁单位拥有者、且没有 `skipMagicReward` 时才给击杀者 +1 魔力。
- 本轮新增证据：`entity-chain-integrity.test.ts` 新增 `[soulless/L4]` 断言，将真实攻击事件逐条归约为最终状态，确认无魂单位击杀敌方后玩家魔力保持 0；同场景换成普通单位击杀敌方后玩家魔力变为 1。
- 验证：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts --configLoader native -t "soulless|无魂"` 通过，1 个测试文件通过，3 passed / 101 skipped。
- 矩阵回写：`evidence/summonerwars/b8-p3-p4-static-summon-and-death-implementation-diff-matrix-2026-07-02.md` 已将 `soulless` 升级为 `match-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已新增 L4-27 并更新召唤/死亡奖励链代表链。
- 后续边界：本轮补的是领域层死亡奖励最终状态，不是 UI 魔力显示刷新、感染交互或 eventStream 回放专项；若后续发现展示层或交互层分叉，再追加专项。`ferocity`、`entangle` 仍为 disputed，不纳入本轮补证。

## 128. 伊路特-巴尔「火祀召唤」真实交互与重复响应 L4 补证（2026-07-03）

本轮继续消费伊路特-巴尔「火祀召唤」（`fire_sacrifice_summon`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是从“可完成牺牲召唤”升级到“真实交互候选、最终状态和重复响应边界正确”。

- 已锁合同：「火祀召唤」要求支付召唤费用时额外摧毁一个友方单位，并用伊路特-巴尔替换该被摧毁单位的位置；不能牺牲敌方单位或召唤师。
- 已有实现基础：`systems.ts` 在未带 `sacrificeUnitId` 的 `SUMMON_UNIT` 上生成火祀召唤选择交互，只列入当前玩家的非召唤师单位；`validate.ts` 在真正执行召唤时要求牺牲品存在、属于当前玩家且不是召唤师；`execute.ts` 先扣召唤费用，再摧毁牺牲品，并把召唤位置改为牺牲品原位置。
- 本轮新增证据：`interaction-chain-comprehensive.test.ts` 将原有火祀召唤入口测试升级为 `[fire_sacrifice_summon/L4]`，覆盖候选列表包含己方普通单位、排除己方召唤师和敌方普通单位；确认后交互收口，玩家魔力从 10 降到 8，伊路特-巴尔落到牺牲品原位置，原召唤位保持空，手牌移除；同一交互重复响应被拒绝，且不二次扣费、牺牲或召唤。
- 验证：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "fire_sacrifice_summon|火祀|伊路特"` 通过，1 个测试文件通过，1 passed / 133 skipped。
- 矩阵回写：`evidence/summonerwars/b8-p3-p4-static-summon-and-death-implementation-diff-matrix-2026-07-02.md` 已将 `fire_sacrifice_summon` 升级为 `match-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已新增 L4-28 并更新召唤/死亡奖励链代表链。
- 后续边界：本轮补的是领域层真实交互和重复响应，不是 UI 召唤选择面板或 eventStream 重连展示专项；若后续发现展示层重复打开同一火祀召唤选择，再追加 UI 层专项。`ferocity`、`entangle` 仍为 disputed，不纳入本轮补证。

## 129. 寒冰魔像「活体结构」移动后结构消费者 L4 补证（2026-07-03）

本轮继续消费寒冰魔像「活体结构」（`mobile_structure`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是活体结构移动后，结构消费者是否读取新位置、旧位置是否不残留。

- 已锁合同：「活体结构」要求寒冰魔像可移动，同时在结构相关消费者里按建筑语义被识别；不是普通不能移动的建筑。
- 已有实现基础：`helpers.ts:canMoveToEnhanced` 只禁止真实建筑移动，不禁止带 `mobile_structure` 的单位移动；`execute.ts` 的 `MOVE_UNIT` 产生 `UNIT_MOVED` 并移动棋盘单位；`abilityResolver.ts` 的寒冰箭/高阶寒冰箭/寒流等消费者按当前棋盘判断友方活体结构单位。
- 本轮新增证据：`abilities-frost.test.ts` 新增 `[mobile_structure/L4]`，覆盖寒冰魔像移动前给旧相邻冰霜法师提供结构加成、不影响新相邻冰霜法师；移动后只产生 1 个 `UNIT_MOVED`，旧位置清空，新位置有寒冰魔像；旧相邻冰霜法师加成消失，新相邻冰霜法师获得结构加成。
- 验证：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-frost.test.ts --configLoader native -t "mobile_structure|活体结构|寒冰魔像"` 通过，1 个测试文件通过，11 passed / 28 skipped。
- 矩阵回写：`evidence/summonerwars/b8-p3-p4-static-summon-and-death-implementation-diff-matrix-2026-07-02.md` 已将 `mobile_structure` 升级为 `match-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已新增 L4-29 并更新召唤/死亡奖励链代表链。
- 后续边界：本轮补的是领域层移动后结构消费者状态，不是 UI 移动动画、资源展示或 eventStream 重连专项；若后续发现展示层分叉，再追加 UI 层专项。`ferocity`、`entangle` 仍为 disputed，不纳入本轮补证。

## 130. 犀牛「速度强化」移动上限 L4 补证（2026-07-03）

本轮继续消费犀牛「速度强化」（`speed_up`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是超过 5 充能时仍最多只提供 +5 移动的负向边界。

- 已锁合同：「速度强化」要求每个充能可额外移动 1 格，最多 +5。
- 已有实现基础：`abilities-barbaric.ts` 的 `speed_up` 定义 `speed_up_extra_move`，参数 `maxBonus: 5`；`helpers.ts:getUnitMoveEnhancements` 按当前充能读取移动增强，并用 `Math.min(boosts, maxBonus)` 限制上限。
- 本轮新增证据：`abilities-barbaric.test.ts` 在既有 8 充能上限用例中补充 8 格移动拒绝断言，确认 8 充能时 7 格移动可行，但 8 格移动不可行，不能把 8 充能误当作 +8 移动。
- 验证：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-barbaric.test.ts --configLoader native -t "speed_up|速度强化|犀牛"` 通过，1 个测试文件通过，3 passed / 56 skipped。
- 矩阵回写：`evidence/summonerwars/b5-p2-implementation-diff-matrix-2026-07-02.md` 已将 `speed_up` 升级为 `match-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已新增 L4-30 并更新静态数值/资源读取代表链。
- 后续边界：本轮补的是领域层移动距离上限，不是 UI 移动力展示或路径动画专项；若后续发现展示层把 8 充能显示成 +8，再追加 UI 展示专项。`ferocity`、`entangle` 仍为 disputed，不纳入本轮补证。

## 131. 清风弓箭手「远射」真实声明攻击命令 L4 补证（2026-07-03）

本轮继续消费清风弓箭手「远射」（`ranged`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是从 helper 层攻击范围判断升级到真实 `DECLARE_ATTACK` 声明攻击入口是否同样执行 4 格清晰直线、建筑目标和路径阻挡合同。

- 已锁合同：「远射」要求本单位最多可攻击 4 个清晰直线格内的卡牌。
- 已有实现基础：`helpers.ts:getEffectiveAttackRange` 对 `ranged` 返回 4；`helpers.ts:canAttackEnhanced` 允许攻击敌方单位或敌方建筑，要求直线、距离不超过有效射程且路径无遮挡；`validate.ts` 的 `DECLARE_ATTACK` 使用 `canAttackEnhanced` 作为真实攻击声明门禁。
- 本轮新增证据：`abilities-trickster.test.ts` 新增 `[ranged/L4] 真实声明攻击命令沿用4格清晰直线和阻挡规则`，覆盖 4 格清晰直线敌方建筑作为攻击目标时 `DECLARE_ATTACK` 放行，路径中间有卡牌阻挡时 `DECLARE_ATTACK` 拒绝，4 格内但非直线目标时 `DECLARE_ATTACK` 拒绝。
- 验证：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-trickster.test.ts --configLoader native -t "ranged|远射|清风弓箭手"` 通过，1 个测试文件通过，11 passed / 36 skipped。
- 矩阵回写：`evidence/summonerwars/b5-p2-implementation-diff-matrix-2026-07-02.md` 已将 `ranged` 升级为 `match-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已新增 L4-31。
- 后续边界：本轮补的是领域层真实声明攻击门禁，不是 UI 攻击目标高亮、攻击动画或 eventStream 回放专项；若后续发现展示层与领域门禁分叉，再追加 UI 层专项。`ferocity`、`entangle` 仍为 disputed，不纳入本轮补证。

## 132. 科琳·布莱顿「神圣护盾」目标归属与本次攻击 L4 补证（2026-07-03）

本轮继续消费科琳·布莱顿「神圣护盾」（`divine_shield`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是从既有攻击结算证明，升级到真实 `DECLARE_ATTACK` 声明攻击入口下的目标归属边界和本次攻击临时减攻边界。

- 已锁合同：「神圣护盾」要求 3 格内友方城塞成为敌方攻击目标时掷 2 骰；每个特殊使攻击者本次攻击 -1，最低 1。
- 已有实现基础：`execute.ts` 在攻击结算中扫描目标所有者一侧 3 格内带 `divine_shield` 的单位；只在目标是城塞单位时投 2 个护盾骰，并用局部 `effectiveStrength` 降低本次攻击骰数。
- 本轮新增证据：`abilities-paladin-new.test.ts` 新增 `[divine_shield/L4]` 两条断言，覆盖科琳不为敌方城塞目标触发护盾，以及第一次攻击减攻后，下一次独立攻击重新按攻击者原始战力掷骰，不残留前一次减攻。
- 验证：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-paladin-new.test.ts --configLoader native -t "divine_shield|神圣护盾|科琳"` 通过，1 个测试文件通过，6 passed / 27 skipped。
- 矩阵回写：`evidence/summonerwars/b5-p2-implementation-diff-matrix-2026-07-02.md` 已将 `divine_shield` 升级为 `match-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已新增 L4-32。
- 后续边界：本轮补的是领域层真实攻击入口，不是 UI 防护提示、攻击动画或 eventStream 回放专项；若后续发现展示层与领域结算分叉，再追加 UI 层专项。`ferocity`、`entangle` 仍为 disputed，不纳入本轮补证。

## 133. 葛拉克「浮空术」友方士兵与真实移动入口 L4 补证（2026-07-03）

本轮继续消费葛拉克「浮空术」（`aerial_strike`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是从移动增强 helper 证明，升级到真实 `MOVE_UNIT` 移动入口下的友方士兵归属边界和本次移动穿越边界。

- 已锁合同：「浮空术」要求任何友方士兵在开始移动时处于葛拉克 2 格内，该次移动期间获得 Flight。
- 已有实现基础：`helpers.ts:getUnitMoveEnhancements` 只在移动单位是士兵时扫描 2 格内同 owner 且带 `aerial_strike` 的单位；命中后增加移动距离并允许穿越单位和建筑；`validate.ts` 的 `MOVE_UNIT` 真实移动门禁使用 `canMoveToEnhanced`。
- 本轮新增证据：`abilities-trickster.test.ts` 新增 `[aerial_strike/L4]` 两条断言，覆盖敌方士兵在葛拉克 2 格内不获得浮空术，以及友方士兵从 2 格内开始移动时，真实 `MOVE_UNIT` 入口允许本次移动穿越路径中间卡牌并成功落位。
- 验证：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-trickster.test.ts --configLoader native -t "aerial_strike|浮空术|葛拉克"` 通过，1 个测试文件通过，8 passed / 41 skipped。
- 矩阵回写：`evidence/summonerwars/b5-p2-implementation-diff-matrix-2026-07-02.md` 已将 `aerial_strike` 升级为 `match-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已新增 L4-33。
- 后续边界：本轮补的是领域层真实移动入口，不是 UI 移动目标高亮、移动动画或 eventStream 回放专项；若后续发现展示层与领域移动门禁分叉，再追加 UI 层专项。`ferocity`、`entangle` 仍为 disputed，不纳入本轮补证。

## 134. 城塞骑士「守卫」建筑目标绕过门禁最小修复与 L4 补证（2026-07-03）

本轮继续消费城塞骑士「守卫」（`guardian`）已 locked 合同，没有重新读图片/OCR，也没有重新录入规则。这里发现的是已锁合同和真实攻击声明入口的直接冲突：相邻敌方守卫存在时，旧实现只在目标是单位时检查守卫，导致攻击者可以改攻建筑绕过守卫。

- 已锁合同：「守卫」要求相邻敌方单位攻击时，该次攻击的目标必须是有 Protect 能力的单位。
- 失败证据：`abilities-paladin.test.ts` 新增 `[guardian/L4] 相邻守卫存在时不能改攻建筑`，修复前失败，表现为攻击者相邻有城塞骑士「守卫」时仍可声明攻击敌方建筑。
- 最小修复：`validate.ts` 的 `DECLARE_ATTACK` 守卫门禁不再只包在 `targetUnit` 分支里；只要目标不是带 `guardian` 的单位，就检查攻击者相邻是否有可攻击的敌方守卫，若有则拒绝当前攻击目标。这样建筑目标也不能绕过守卫。
- 验证：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-paladin.test.ts --configLoader native -t "guardian|守卫|城塞骑士"` 通过，1 个测试文件通过，7 passed / 28 skipped。
- 矩阵回写：`evidence/summonerwars/b5-p2-implementation-diff-matrix-2026-07-02.md` 已将 `guardian` 升级为 `fixed-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已新增 L4-34。
- 后续边界：本轮修的是领域层攻击声明门禁，不是 UI 目标高亮、攻击动画或 eventStream 回放专项；若后续发现展示层仍把建筑作为可点攻击目标，再追加 UI 层专项。`ferocity`、`entangle` 仍为 disputed，不纳入本轮补证。

## 135. 部落抓附手「禁足」普通移动入口 L4 补证（2026-07-03）

本轮继续消费部落抓附手「禁足」（`immobile`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是普通移动入口证据；强制移动/放置是否等同“移动”仍需要通用规则合同，本轮不硬判。

- 已锁合同：「禁足」要求本单位不能移动。
- 已有实现基础：`helpers.ts:isImmobile` 和 `getUnitMoveEnhancements` 识别 `immobile` 后返回不可移动；`canMoveToEnhanced` 因 `isImmobileUnit` 返回 false；`validate.ts` 的 `MOVE_UNIT` 入口直接拒绝带 `immobile` 的单位普通移动。
- 本轮新增证据：`abilities-goblin.test.ts` 新增 `[immobile/L4]` 断言，确认禁足单位普通移动目标清单为空，真实 `MOVE_UNIT` 命令被禁足门禁拒绝，且同场其它非禁足单位普通移动不受影响。
- 验证：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-goblin.test.ts --configLoader native -t "immobile|禁足|部落抓附手"` 通过，1 个测试文件通过，9 passed / 43 skipped。
- 矩阵回写：`evidence/summonerwars/b5-p2-implementation-diff-matrix-2026-07-02.md` 已将 `immobile` 升级为 `match-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已新增 L4-35。
- 后续边界：本轮补的是领域层普通移动门禁，不是强制移动、放置、UI 可移动目标高亮或 eventStream 回放专项；若后续锁定通用规则说明“强制移动/放置也属于移动”，再单独补审，不从当前合同外推。`ferocity`、`entangle` 仍为 disputed，不纳入本轮补证。

## 136. 亡灵战士「血腥狂怒」真实击杀与事件回放 L4 补证（2026-07-03）

本轮继续消费亡灵战士「血腥狂怒」（`blood_rage`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是从首轮实现对照证明，升级到真实攻击击杀入口只结算一次充能，以及事件流回放不会让同一充能反馈重复消费。

- 已锁合同：「血腥狂怒」要求你的回合每有一个单位被消灭时，本单位 +1 充能。
- 已有实现基础：`abilities.ts` 定义 `blood_rage` 为 `onUnitDestroyed` + `addCharge self 1`；死亡后触发入口只扫描当前玩家单位；`abilityResolver.ts` 产生 `UNIT_CHARGED sourceAbilityId='blood_rage'`；`reduce.ts` 将充能事件落到目标单位 boosts；`useGameEvents.ts` 的 `shouldConsumeChargeEvent` 按事件 id 去重 UI 充能反馈。
- 本轮新增证据：`abilities-necromancer-execute.test.ts` 新增 `[blood_rage/L4] 真实攻击击杀只给亡灵战士结算一次充能`，确认真实 `DECLARE_ATTACK` 击杀敌方单位后，只产生 1 条目标死亡事件、1 条 `blood_rage` 充能事件，且最终亡灵战士 boosts=1。
- 本轮新增证据：`useGameEvents.test.ts` 新增 `[blood_rage/L4] 事件流回放时同一充能事件不会重复消费`，确认事件流回滚返回同一批事件时，已消费过的充能事件 id 不会再次进入反馈消费。
- 验证：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-necromancer-execute.test.ts src/games/summonerwars/__tests__/useGameEvents.test.ts --configLoader native -t "blood_rage|血腥狂怒|shouldConsumeChargeEvent"` 通过，2 个测试文件通过，4 passed / 52 skipped。
- 矩阵回写：`evidence/summonerwars/b6-p3-p4-charge-and-stat-implementation-diff-matrix-2026-07-02.md` 已将 `blood_rage` 升级为 `match-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已新增 L4-36。
- 后续边界：本轮补的是领域层真实攻击入口和 UI 充能反馈去重 helper，不是完整浏览器重连 E2E、动画帧播放或服务器事件持久化专项；若后续发现真实页面回放仍重复播放动画，再追加 UI/E2E 专项。`ferocity`、`entangle` 仍为 disputed，不纳入本轮补证。

## 137. 亡灵战士「血腥狂怒」回合末清理真实阶段入口 L4 补证（2026-07-03）

本轮继续消费亡灵战士「血腥狂怒」回合末清理（`blood_rage_decay`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是从直接 `onTurnEnd` 触发证明，升级到真实抽牌阶段结束的阶段推进入口。

- 已锁合同：「血腥狂怒」同一张卡还要求你的回合结束时移除本单位 2 充能；无充能不触发；1 充能时由 reducer 夹到 0。
- 已有实现基础：`abilities.ts` 定义 `blood_rage_decay` 为 `onTurnEnd` + `hasCharge >= 1` + `removeCharge self 2`；`flowHooks.ts` 在 draw 阶段退出时触发当前玩家 `onTurnEnd`；`reduce.ts` 对 `UNIT_CHARGED delta=-2` 做非负夹取。
- 本轮新增证据：`interaction-chain-comprehensive.test.ts` 新增 `[blood_rage_decay/L4] 真实抽牌阶段结束时按当前充能清理亡灵战士`，确认真实 `ADVANCE_PHASE` 从 draw 退出后切到下一玩家 summon，并为 3 充能与 1 充能亡灵战士各发 1 条 `blood_rage_decay` 衰减事件，0 充能单位不触发。
- 最终状态证据：3 充能单位最终 boosts=1；1 充能单位最终 boosts=0；0 充能单位保持 boosts=0 且仍在原位。
- 验证：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "blood_rage_decay|血腥狂怒"` 通过，1 个测试文件通过，1 passed / 134 skipped。
- 矩阵回写：`evidence/summonerwars/b6-p3-p4-charge-and-stat-implementation-diff-matrix-2026-07-02.md` 已将 `blood_rage_decay` 升级为 `match-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已新增 L4-37。
- 后续边界：本轮补的是领域层真实阶段推进入口，不是完整浏览器重连 E2E、回合结束动画或事件持久化专项；若后续发现真实页面回放重复播放清理反馈，再追加 UI/E2E 专项。`ferocity`、`entangle` 仍为 disputed，不纳入本轮补证。

## 138. 亡灵战士「力量强化」数值读取与上限 L4 补证（2026-07-03）

本轮继续消费布拉夫 / 亡灵战士「力量强化」（`power_boost`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是首轮矩阵指出的“亡灵战士专属数值断言”缺口，确保同一 `power_boost` 能力不只在布拉夫承载上有证明。

- 已锁合同：「力量强化」要求每 1 充能 +1 战力，最多 +5；布拉夫与亡灵战士都承载该能力。
- 已有实现基础：`abilities.ts` 定义 `power_boost` 为 `onDamageCalculation` 下的 `modifyStrength attr=charge maxBonus=5`；`abilityResolver.ts:calculateEffectiveStrength` 按当前单位 boosts 读取充能值，执行 `maxBonus` 上限，并在 modifiers 中记录来源能力。
- 既有证明：`abilities-goblin.test.ts` 已覆盖布拉夫 0/3/8 充能下的战力与 +5 上限。
- 本轮新增证据：`abilities-necromancer-execute.test.ts` 新增 `[power_boost/L4] 亡灵战士按当前充能获得战力且最多只加5`，确认亡灵战士 0 充能时最终战力为基础 2 且无 `power_boost` modifier；3 充能时最终战力为 5 且 modifier 来源为 `power_boost`、值为 3；8 充能时最终战力为 7 且 modifier 来源为 `power_boost`、值被封顶为 5。
- 验证：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-necromancer-execute.test.ts --configLoader native -t "power_boost|力量强化|亡灵战士"` 通过，1 个测试文件通过，3 passed / 21 skipped。
- 矩阵回写：`evidence/summonerwars/b6-p3-p4-charge-and-stat-implementation-diff-matrix-2026-07-02.md` 已将 `power_boost` 升级为 `match-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已新增 L4-38。
- 后续边界：本轮补的是领域层数值读取和 breakdown 来源，不是 UI 战力展示、动画或攻击完整 E2E；若后续发现页面展示与领域值分叉，再追加 UI/E2E 专项。`ferocity`、`entangle` 仍为 disputed，不纳入本轮补证。

## 139. 蒙威尊者「力量强化」数值读取与上限 L4 补证（2026-07-03）

本轮继续消费蒙威尊者「力量强化」（`power_up`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是从首轮最终战力证明，升级到 `calculateEffectiveStrength` 的来源拆解和 +5 上限证明。

- 已锁合同：「力量强化」要求每 1 充能 +1 战力，最多 +5；蒙威尊者承载本地 `power_up`。
- 已有实现基础：`abilities-barbaric.ts` 定义 `power_up` 为 `onDamageCalculation` 下的 `modifyStrength attr=charge maxBonus=5`；`abilityResolver.ts:calculateEffectiveStrength` 按当前单位 boosts 读取充能值，执行 `maxBonus` 上限，并在 modifiers 中记录来源能力。
- 既有证明：`abilities-barbaric.test.ts` 已覆盖蒙威尊者 0/3/8 充能下的最终战力；`interaction-flow-e2e.test.ts` 已覆盖祖灵交流转移充能后攻击战力提升。
- 本轮新增证据：`abilities-barbaric.test.ts` 新增 `[power_up/L4] 按当前充能获得战力并在拆解中记录+5上限`，确认蒙威尊者 0 充能时最终战力为基础 1 且无 `power_up` modifier；3 充能时最终战力为 4 且 modifier 来源为 `power_up`、值为 3；8 充能时最终战力为 6 且 modifier 来源为 `power_up`、值被封顶为 5。
- 验证：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-barbaric.test.ts --configLoader native -t "power_up|力量强化|蒙威尊者"` 通过，1 个测试文件通过，5 passed / 55 skipped。
- 矩阵回写：`evidence/summonerwars/b6-p3-p4-charge-and-stat-implementation-diff-matrix-2026-07-02.md` 已将 `power_up` 升级为 `match-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已新增 L4-39。
- 后续边界：本轮补的是领域层数值读取和 breakdown 来源，不是 UI 战力展示、动画或攻击完整 E2E；若后续发现页面展示与领域值分叉，再追加 UI/E2E 专项。`ferocity`、`entangle` 仍为 disputed，不纳入本轮补证。

## 140. 古尔-达斯「暴怒」数值读取与来源拆解 L4 补证（2026-07-03）

本轮继续消费古尔-达斯「暴怒」（`rage`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是从真实攻击骰数证明，升级到 `calculateEffectiveStrength` 的当前伤害读取和来源拆解证明。

- 已锁合同：「暴怒」要求每 1 伤害 +1 战力；古尔-达斯承载本地 `rage`。
- 已有实现基础：`abilities.ts` 定义 `rage` 为 `onDamageCalculation` 下的 `modifyStrength attr=damage`；`abilityResolver.ts:calculateEffectiveStrength` 按当前单位 damage 读取已受伤害，并在 modifiers 中记录来源能力。
- 既有证明：`entity-chain-integrity.test.ts` 已覆盖 2 伤害古尔-达斯真实声明攻击时，攻击骰数为基础 2 + 伤害 2。
- 本轮新增证据：`entity-chain-integrity.test.ts` 新增 `[onDamageCalculation/rage/L4] 按当前伤害获得战力并在拆解中记录来源`，确认 0 伤害时最终战力为基础 2 且无 `rage` modifier；3 伤害时最终战力为 5 且 modifier 来源为 `rage`、值为 3。
- 验证：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts --configLoader native -t "onDamageCalculation/rage|暴怒"` 通过，1 个测试文件通过，2 passed / 103 skipped。
- 矩阵回写：`evidence/summonerwars/b6-p3-p4-charge-and-stat-implementation-diff-matrix-2026-07-02.md` 已将 `rage` 升级为 `match-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已新增 L4-40。
- 后续边界：本轮补的是领域层数值读取和 breakdown 来源，不是 UI 战力展示、动画或攻击完整 E2E；若后续发现页面展示与领域值分叉，再追加 UI/E2E 专项。`ferocity`、`entangle` 仍为 disputed，不纳入本轮补证。

## 141. 掷术师「迷魂」真实攻击最终伤害 L4 补证（2026-07-03）

本轮继续消费掷术师「迷魂」（`evasion`）已 locked 合同，没有重新读图片/OCR，没有重新录入规则，也没有修改机制实现。这里补的是从“产生减伤事件”升级到真实攻击中最终伤害确实减少。

- 已锁合同：「迷魂」要求相邻敌方攻击任意卡牌时，若本次攻击掷出 1 个或更多 special 面，该次攻击减少 1 点伤害。
- 已有实现基础：`abilities-trickster.ts` 定义 `evasion` 为相邻敌方攻击触发的 `reduceDamage value=1 condition='onSpecialDice'`；`execute.ts` 在攻击命中计算中检查攻击者相邻敌方 `evasion` 单位，special 面存在时减少 hits，并发 `DAMAGE_REDUCED sourceAbilityId='evasion'`。
- 既有证明：`entity-chain-integrity.test.ts` 已覆盖 special 面正向产生 `DAMAGE_REDUCED`、无 special 不减伤、迷魂单位不相邻不触发。
- 本轮新增证据：`entity-chain-integrity.test.ts` 新增 `[onAdjacentEnemyAttack/evasion/L4] special 面触发迷魂后最终伤害减少1`，用固定 special 骰面对照有/无迷魂两条真实 `DECLARE_ATTACK`，确认有迷魂时最终 hits 少 1，`UNIT_DAMAGED.damage` 也少 1，并产生 `DAMAGE_REDUCED value=1 sourceAbilityId='evasion'`。
- 验证：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts --configLoader native -t "evasion|迷魂"` 通过，1 个测试文件通过，4 passed / 102 skipped。
- 矩阵回写：`evidence/summonerwars/b7-p3-movement-and-adjacency-implementation-diff-matrix-2026-07-02.md` 已将 `evasion` 升级为 `match-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已新增 L4-41。
- 后续边界：本轮补的是领域层真实攻击最终伤害，不是 UI 伤害数字展示、动画或 eventStream 回放专项；若后续发现展示层与领域伤害分叉，再追加 UI/E2E 专项。`ferocity`、`entangle` 仍为 disputed，不纳入本轮补证。

## 142. B5「冲锋 / 寒冰冲撞 / 稳固」L4 补证收口（2026-07-03）

本节继续消费 B5 已 `locked` 合同，没有重新读图片/OCR，没有重新录入规则。这里补的是 B5 中仍停留在 `fixed-with-proof` 或代表链状态的实现层边界。

- 野兽骑手「冲锋」：在既有生命周期修复基础上，新增真实 `MOVE_UNIT` 门禁断言，确认非直线 3 格移动被拒绝，且不会产生本回合冲锋战力。
- 寒冰冲撞：在既有召唤师目标过滤修复基础上，新增建筑目标负向断言，确认建筑不进入目标候选，直接执行也不会对建筑产生 `ice_ram` 伤害；同时沿用稳固目标只受 1 伤、不被强制移动的代表链证据。
- 卡拉「稳固」：在既有念力/高阶念力/寒冰冲撞 Force 免疫代表链基础上，新增普通移动断言，确认稳固不是移动限制，卡拉仍可正常移动。
- 新增/更新测试：
  - `src/games/summonerwars/__tests__/abilities-goblin.test.ts`：`冲锋非直线3格移动会被真实移动门禁拒绝`。
  - `src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts`：`[ice_ram] 目标选择和执行器应排除召唤师` 同步扩展建筑目标负向。
  - `src/games/summonerwars/__tests__/abilities-trickster.test.ts`：`稳固不影响本单位普通移动`。
- 验证：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-goblin.test.ts src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts src/games/summonerwars/__tests__/abilities-trickster.test.ts --configLoader native -t "冲锋|charge|ice_ram|寒冰冲撞|stable|稳固"` 通过，3 个测试文件、16 passed / 222 skipped。
- 矩阵回写：`evidence/summonerwars/b5-p2-implementation-diff-matrix-2026-07-02.md` 已将 `charge`、`ice_ram` 升级为 `fixed-with-L4-proof`，将 `stable` 升级为 `match-with-L4-proof`；`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 已新增 L4-42。
- 后续边界：本轮补的是领域层与交互系统边界，不是 UI 动画或 eventStream 回放专项；`withdraw` 的 Force 直线/空格细则仍只保留规则书核对，不因稳固代表链硬判。`ferocity`、`entangle` 仍为 disputed，不纳入本轮补证。

## 143. 更新后续跑边界确认（2026-07-03）

本节回应“数据录入要做好，后面才不会出问题”的纠偏：录入质量门禁必须发生在合同进入 `locked` 之前；对象已经 `locked` 且正式实现矩阵存在后，普通续跑不得重新读图片、不得 OCR、不得重新录入，只能先做合同字段完整性检查，再进入实现层补证。

- 本轮未重新读图、未 OCR、未 atlas 裁图、未重新抄录规则；只核对了规范、正式矩阵和续跑状态。
- 已更新并核对的规范入口：`.spec/skills/game-audit-workflow/SKILL.md`、`.spec/skills/data-entry-workflow/SKILL.md`、`.spec/skills/safe-image-reading/SKILL.md`、`.spec/knowledge/standards/data-entry.md` 均已写入 `locked` 后续跑不得无故回录入层的规则。
- 当前正式矩阵扫描结果：`evidence/summonerwars/*implementation-diff-matrix-2026-07-02.md` 中非 L4 的正式矩阵行为 0。
- 原保留争议已在第 147 节裁定并最小修复：史米革保留「凶猛」（`ferocity`），部落投石手不承载；城塞骑士只承载「守卫」（`guardian`），不承载 `entangle`。
- 后续续跑口径：若继续召唤师战争审计，优先从正式矩阵或残余队列中找已 `locked/已裁定` 且需要真实入口/UI/eventStream 证据的对象；不得把“数据录入要做好”解释成对已 `locked/已裁定` 对象重读图片。

## 144. UI/eventStream 回放保护现状复核（2026-07-03）

本节继续消费已 `locked` 合同后的实现层证据，没有重新读图片/OCR，没有重新录入规则，也没有修改机制代码。当时正式实现矩阵中非 L4 且非 `disputed-skip` 的矩阵行为为 0；第 147 节已进一步把原 `disputed-skip` 对象裁定并修复。

- 通用事件游标：`src/engine/hooks/useEventStreamCursor.ts` 已覆盖首次挂载跳过历史事件、Undo/乐观回滚、`visibilitychange`/断线重连空事件流、reconcile 空事件流不重播历史事件等边界。
- 召唤师战争事件消费侧：`src/games/summonerwars/ui/useGameEvents.ts` 对攻击事件使用 `processedAttackEventIdsRef` 防止同一攻击事件重播攻击动画；对充能事件使用 `processedChargeEventIdsRef` / `shouldConsumeChargeEvent` 防止同一充能事件重复播放充能反馈；回滚或重置时清理攻击队列、骰子状态、死亡临时态、伤害缓冲和视觉门控。
- 已有测试证据：`useEventStreamCursor.test.ts` 覆盖重连、回滚、reconcile、旧事件恢复不重播；`useGameEvents.test.ts` 覆盖同一充能事件 id 只消费一次，以及血腥狂怒回放场景下不重复消费充能事件；`useGameEvents.rollback.test.tsx` 覆盖乐观回滚后旧攻击事件不重播、后续新攻击事件正常消费；`useMovementTrails.rollback.test.tsx` 覆盖移动轨迹回滚清理。
- 本轮验证命令：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/engine/hooks/__tests__/useEventStreamCursor.test.ts src/games/summonerwars/__tests__/useGameEvents.test.ts src/games/summonerwars/__tests__/useGameEvents.rollback.test.tsx src/games/summonerwars/__tests__/useMovementTrails.rollback.test.tsx --configLoader native`。
- 验证结果：4 个测试文件通过，41 passed。
- 收口边界：这证明当前已有通用 UI/eventStream 回放保护和关键代表链测试，不能据此回头重录数据，也不能把候选展示风险升级成机制 bug。若后续发现某个具体对象在真实页面、动画帧或在线重连中仍重复打开选择/重复播放动画，应另开对象级 UI/E2E 专项，用该真实症状作为前提；在没有具体症状前，不继续补同类领域层测试。

## 145. B1 续跑状态口径修正（2026-07-03）

本节回应“现在不是重新录入数据”的纠偏：B1 五个已 `locked` 对象继续消费现有合同，不重新读图片/OCR，不重新抄录卡图，也不修改机制代码。本轮只修正实现矩阵里的状态口径，避免后续脚本或人工续跑把旧的中间态误判为待重审、待重录或待修复。

- 已更新矩阵：`evidence/summonerwars/b1-p1-implementation-diff-matrix-2026-07-02.md`。
- 状态修正：凯鲁尊者「撤退」（`withdraw`）、卡拉「高阶念力」（`high_telekinesis`）、清风法师「念力」（`telekinesis`）均按当前实现层证据归入 `match-with-L4-proof`；梅肯达·露/边境弓箭手「连续射击」（`rapid_fire`）与古尔壮「心灵传念」（`mind_transmission`）原本已是 `match-with-L4-proof`。
- 现实含义：B1 当前没有对象需要回录入层；也没有对象因 B1 矩阵状态需要进入机制修复。
- Force 细则边界：凯鲁尊者「撤退」、卡拉「高阶念力」、清风法师「念力」涉及的 `Force` 直线/空格约束，只保留为“通用规则来源专项”注记；若后续找到权威规则来源证明当前通用 Force 实现不符，再单独开 Force 细则专项，不得把这解释成已 `locked` 对象需要重新看图或重新录入。
- 续跑入口：普通继续时先看 `implementation-diff` 矩阵、`l3-l4-residual-proof-queue-2026-07-02.md`、本文件第 143-145 节和 `temp/summonerwars-audit/continuation-task-state.json`；只有发现合同字段缺失、来源冲突或对象归属不清，才回到录入层。

## 146. Force 通用规则来源专项边界复核（2026-07-03）

本节继续执行“数据录入做好，但 locked 后不重录”的口径：本轮没有读取图片、没有 OCR、没有 atlas 裁图，也没有修改机制代码。这里只复核 Force 通用规则来源专项，防止它被误当成 B1/B3 已 locked 对象的重录入口或机制 bug。

- 本地实现层证据：`src/games/summonerwars/domain/helpers.ts` 的 `isForceMovePathClear` 记录普通 Force 路径必须同一行/列，路径含终点都必须为空；`getForceDestinations` 记录玩家可选择上/下/左/右任意方向，与来源单位位置无关，普通 Force 不穿过单位，单位和建筑都阻挡。
- 本地旧 helper 边界：`getPushPullDirection`、`getPushPullAxes` 已标注为 deprecated，原因是 Force 不应按 source 位置推断方向；新路径应使用 `getForceDestinations`。
- 证据强度裁定：这些是本地实现与注释证据，只能证明当前实现口径，不足以替代官方 Force 规则真相源。
- 当前状态：凯鲁尊者「撤退」（`withdraw`）、卡拉「高阶念力」（`high_telekinesis`）、清风法师「念力」（`telekinesis`）、斯瓦拉「结构迁移」（`structure_shift`）在各自实现矩阵中继续按已补 L4 处理；Force 通用规则来源保持为独立专项缺口。
- 后续边界：只有找到官方规则来源并证明“普通 Force 方向/阻挡/空格”与本地实现冲突时，才单独降级 Force 细则，进入最小失败测试和最小修复；不得因为这个专项未锁官方来源而把已 locked 对象送回图片/OCR/重新录入。

## 147. disputed 归属裁定与配置误挂最小修复（2026-07-03）

本节继续执行“数据录入要做好，但 locked/已裁定后不重录”的口径：本轮没有重新读取图片、没有 OCR、没有 atlas 裁图。处理对象只限前文保留的两个 `disputed` 归属项，并使用官方在线文本包作为归属裁定来源。

- 史米革「凶猛」（`ferocity`）：官方在线文本包中 `Smeg` 邻近同时出现 `Magic Junkie|TEXT` 和 `Relentless|TEXT`；`Relentless` 原文为 “You may choose this unit as an extra attacking unit during your Attack Phase.”。`Horde Slinger` 邻近只锁到单位名/简称，未出现 Relentless/Ferocity 能力文本。裁定结果：史米革承载 `ferocity`，部落投石手不承载。
- 城塞骑士误挂「缠斗」（`entangle`）：官方在线文本包中 `Citadel Knight` 邻近只出现 `Protect|TEXT`；`Engage|TEXT` 出现在掷术师/Deceiver 邻近，原文为 “Each time an adjacent enemy unit moves or is forced away from this unit, add 1 damage to that enemy.”。裁定结果：城塞骑士只承载 `guardian`/Protect，不承载 Engage/Entangle；官方 Engage 继续由掷术师「缠斗」（`rebound`）合同承载。
- 最小配置修复：`src/games/summonerwars/config/factions/goblin.ts` 移除部落投石手误挂的 `ferocity`，保留史米革 `magic_addiction` + `ferocity`；`src/games/summonerwars/config/factions/paladin.ts` 移除城塞骑士误挂的 `entangle`，保留 `guardian`。
- 未扩大范围：没有删除 `abilities-goblin.ts` 中的 `ferocity` 定义，因为史米革仍使用；没有删除 `abilities-paladin.ts` 中的 `entangle` 定义，只标注为未挂载兼容定义，避免把配置误挂修复扩大成共享机制重构。
- 回归测试：已修正 `abilities-goblin.test.ts` 和 `abilities-paladin.test.ts`，覆盖史米革承载 `ferocity`、部落投石手不承载 `ferocity`、城塞骑士只承载 `guardian`、敌方远离城塞骑士不触发缠斗伤害。
- 验证命令：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-goblin.test.ts src/games/summonerwars/__tests__/abilities-paladin.test.ts src/games/summonerwars/__tests__/abilities-trickster.test.ts src/games/summonerwars/__tests__/entity-chain-integrity.test.ts --configLoader native -t "ferocity|凶猛|凶残|guardian|守卫|entangle|缠斗|rebound"`。
- 验证结果：4 个测试文件通过，17 passed / 227 skipped。
- 当前状态：`ferocity` 与 `entangle` 均已出 `disputed`；68 个风险对象当前为 `4 L4 + 64 locked/已裁定 + 0 disputed + 0 待建合同`。后续继续只消费已锁/已裁定合同做实现层残余补证，不回图片/OCR/重新录入。

## 148. implementation 矩阵清点口径修正（2026-07-03）

本节继续执行“数据录入做好，但 locked/已裁定后不重录”的口径：本轮没有读取图片、没有 OCR、没有 atlas 裁图，没有新增机制修复。这里处理的是续跑清点脚本发现的两个假缺口，避免后续把矩阵格式问题误判成真实机制审计缺口。

- B2 假缺口：`evidence/summonerwars/b2-p1-implementation-diff-matrix-2026-07-02.md` 的“已锁规则基线”是规则合同摘要，不是实现对照矩阵；其中 `prepare`、`inspire` 已在下方正式实现对照矩阵中标为 `match-with-L4-proof`。本轮将规则基线表中的对象 ID 改为非反引号格式，并新增说明，避免脚本把规则基线误扫成 implementation row。
- B4 假缺口：`evidence/summonerwars/b4-p2-implementation-diff-matrix-2026-07-02.md` 中卡拉「高阶念力」代替攻击（`high_telekinesis_instead`）已由高阶目标范围/行动经济直接断言 + 清风法师「念力」代替攻击（`telekinesis_instead`）二段选择代表链覆盖。本轮将其分流状态统一为 `match-with-L4-proof`，并保留“代表链已补”的说明。
- 当前清点结果：8 个正式 `implementation-diff` 矩阵共 68 行正式实现对象，非 L4 行为 0。这里的 68 行不含 P0 四个专项对象；P0 四个对象已在 `p0-l4-special-audit-matrix-2026-07-02.md` 和本文件第 143-147 节补到对象级 L4。
- 验证命令：使用 PowerShell 读取 `evidence/summonerwars/*implementation-diff-matrix-2026-07-02.md`，仅把以 ``| `对象ID` `` 开头的正式实现行纳入扫描，并检查状态是否包含 `match-with-L4-proof`、`fixed-with-L4-proof`、`L4 已补` 或 `disputed`。
- 验证结果：`TOTAL_NON_L4=0`；`temp/summonerwars-audit/continuation-task-state.json` JSON 解析通过，最新 note 为 C82。
- 后续边界：普通续跑不再从 B2 `prepare/inspire`、B4 `high_telekinesis_instead` 或 P0 乐观确认/重连缺口继续；若后续出现具体真实页面、事件回放、UI 展示或官方规则来源冲突，再按真实症状或合同降级单独开专项。

## 149. 当前实现矩阵与定向回归验证（2026-07-03）

本节验证 C82 后的当前实现层状态，没有读取图片、没有 OCR、没有重新录入规则，也没有新增机制修复。

- 当前矩阵状态：8 个正式 `implementation-diff` 矩阵共 68 行正式实现对象，非 L4 行为 0；P0 四个专项对象已由 `p0-l4-special-audit-matrix-2026-07-02.md` 和本文件第 143-148 节覆盖。
- 验证命令：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-barbaric.test.ts src/games/summonerwars/__tests__/abilities-goblin.test.ts src/games/summonerwars/__tests__/abilities-necromancer-execute.test.ts src/games/summonerwars/__tests__/abilities-paladin.test.ts src/games/summonerwars/__tests__/abilities-trickster.test.ts src/games/summonerwars/__tests__/entity-chain-integrity.test.ts src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts src/games/summonerwars/__tests__/useGameEvents.test.ts --configLoader native`。
- 验证结果：8 个测试文件通过，496 passed。
- 运行时提示：测试输出中出现的 “无法攻击该目标” 和 “该单位本回合已移动” 是负向断言用例预期触发的验证失败日志；2026-07-17 起“友方目标不可攻击”旧口径已失效，友方攻击合法性需按当前规则合同单独判断。
- 当前续跑结论：现有召唤师战争实现矩阵和本轮相关测试已经对齐；普通继续不再从已清零的 implementation 矩阵、P0 乐观/重连缺口、B2 `prepare/inspire` 或 B4 `high_telekinesis_instead` 续跑。后续只有出现具体真实页面症状、事件回放症状、UI 展示分叉、官方规则来源冲突或新的合同字段缺口时，才按对象降级或另开专项。

## 150. C84 残余队列续跑入口收口（2026-07-03）

本节回应“数据录入就要做好，后面才不会出问题”的纠偏：C84 不回图片/OCR/atlas 裁图，也不重新录入规则；这里只把残余队列从旧的常规待办入口收口为已完成索引和条件性专项入口。

- 已更新文件：`evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md`。
- 当前状态：该文件顶部已明确改为“已完成残余补证索引 + 条件性专项入口”；C83 的 8 个正式 implementation-diff 矩阵、68 行正式实现对象、`TOTAL_NON_L4=0` 和 8 个测试文件 496 passed 仍是当前基线。
- 录入边界：数据录入质量必须发生在对象进入 `locked` / 已裁定之前；进入 `locked` 后，普通续跑只消费合同做实现审计、补证、最小修复和 evidence 回写。
- 回录入条件：只有发现合同字段缺失、来源互相冲突、对象归属不清，才把该对象降级为 `blocked` 或 `disputed` 并回写 evidence；没有这类证据时，不得把已锁对象送回图片/OCR/重新录入。
- 后续入口：只有出现具体真实页面症状、事件回放症状、UI 展示分叉、官方规则来源冲突或新的合同字段缺口，才另开对象级专项；旧 notes、旧矩阵和旧 evidence 里的“下一步 / 待执行 / 仍缺”只能作为历史过程，不代表当前常规待办。

## 151. C85 在线文本包越权裁定纠正（2026-07-03）

本节纠正第 147 节和 C80 的错误口径：官方在线文本包、Wiki、网页文本或旧脚本 bundle 不能在实现审计阶段高于本地清晰卡图/已锁录入合同；这类来源只能作为录入阶段的对照源或候选线索。此前把官方在线文本包用于直接裁定史米革/部落投石手「凶猛」（`ferocity`）和城塞骑士「缠斗」（`entangle`）归属，并据此写成“已裁定/已修复”，属于审计阶段越权。

- 规范回写：已更新 `.spec/skills/game-audit-workflow/SKILL.md`、`.spec/skills/data-entry-workflow/SKILL.md` 和 `.spec/knowledge/standards/testing-audit.md`，明确审计阶段不得临时查 Wiki、网页资料、在线文本包、旧脚本 bundle 或第三方数据库来裁定卡面规则、对象归属，且不得把这些来源排到本地清晰卡图之上。
- 状态纠正：`ferocity` 与 `entangle` 不再按“官方在线文本包已裁定”计为已锁/已裁定对象；当前应降回 `disputed-待本地卡图合同裁定`。
- 代码边界：`goblin.ts`、`paladin.ts`、`abilities-goblin.ts`、`abilities-paladin.ts`、`validate.ts` 中相关改动不能继续汇报为已证实修复；在本地清晰卡图/已锁合同未裁定前，只能视为待裁定候选改动。
- 后续要求：若要重新确认这两项，只对史米革/部落投石手「凶猛」（`ferocity`）和城塞骑士「缠斗」（`entangle`）做**定向合同裁定**：用本地清晰卡图、完整单对象图、用户当轮截图或用户明确指定的权威来源裁定对象归属。这里不是全量重新录入，也不是让普通续跑退回图片/OCR；裁定前不得写“修复已完成”或把测试通过当作规则归属证明。

## 152. C86 审计与录入边界再纠正（2026-07-03）

本节纠正 C85 后仍残留的错误表达：把 `ferocity` / `entangle` 写成“必须回本地卡图合同裁定”，仍然会让后续执行者误以为每次审计都要重新读图或重新录入。正确边界如下：

- 普通机制审计不要求重新录入数据，也不默认要求卡图；继续审计时先消费当前已有规则文档、配置、实现、测试、evidence、矩阵和状态文件。
- 若审计发现来源不足或对象归属冲突，只能登记 `blocked/disputed` 缺口，不能在审计流程里临时查 Wiki、在线文本包、网页文本、卡图或 OCR 来补成权威结论。
- `ferocity` / `entangle` 当前状态不是“需要马上看卡图”，而是“不能把 C80/C84 的在线文本包裁定当作已证实修复”。是否启动对象归属复核，必须由用户明确进入数据录入/归属裁定任务。
- 已有相关代码改动仍只能视为待裁定候选改动；普通审计续跑不得基于它们宣称已修复，也不得为了它们自动启动图片读取。

## 153. C88 修复汇报必须同时附规则原文和现有实现（2026-07-03）

本节再次纠正 C87 的错误口径：“能力描述/现有实现描述”不够，后续汇报必须拆成两列：**规则原文/已消费合同原文** 与 **现有实现行为**。只有两者并列，用户才能判断修复是否对齐规则；规则原文未锁定时，不得把实现描述当作原文，也不得报“已证实修复”。

本轮已有相关候选改动对应能力如下：

| 对象 | 能力 | 规则原文/已消费合同原文 | 现有实现行为 | 本轮改动 | 当前状态 |
|---|---|---|---|---|---|
| 史米革 / 部落投石手 | 凶猛（`ferocity`） | 规则原文/归属未锁定；C80/C84 的在线文本包裁定已撤销，不能当作审计阶段权威原文 | `ferocity` 当前实现语义为“可作为额外攻击单位” | `goblin.ts` 中部落投石手移除 `ferocity`；`abilities-goblin.ts` 注释改为史米革承载 | 待裁定候选改动，不能汇报为已证实修复 |
| 城塞骑士 | 缠斗（`entangle`） | 规则原文/归属未锁定；C80/C84 的在线文本包裁定已撤销，不能当作城塞骑士归属证明 | `entangle` 当前实现语义为“相邻敌方远离时造成 1 伤害” | `paladin.ts` 中城塞骑士移除 `entangle`；`abilities-paladin.ts` 改为未挂载兼容定义 | 待裁定候选改动，不能汇报为已证实修复 |
| 城塞骑士 | 守卫（`guardian`） | 已消费合同原文/子句：相邻敌方攻击时，攻击目标必须是有守卫能力的单位 | `validate.ts` 在声明攻击时检查攻击者相邻敌方守卫；若目标不是守卫且存在可攻击守卫目标，则拒绝攻击 | `validate.ts` 将守卫门禁扩到非守卫目标，包括建筑目标；城塞骑士配置保留 `guardian` | 实现层修复候选/已验证链路的一部分；对外汇报必须同时附规则原文、现有实现和验证证据 |

## 154. C89 已录入合同检索纠正（2026-07-03）

本节纠正 C88 汇报里“像是数据没录入”的错误表达：当前不是用户没有录入数据，而是我没有先把既有录入合同入口查全，就把 `blocked/disputed` 误说成“原文/归属未锁定导致要回录入”。后续继续审计必须先查既有录入合同，不得默认要求重新录入。

- 已找到的录入入口：`evidence/summonerwars/data-entry-source-map-2026-07-02.md` 与 `evidence/summonerwars/data-entry-crop-manifest-2026-07-02.md` 已登记史米革、部落投石手、城塞骑士、掷术师的 atlas 图源、spriteIndex、裁图入口和合同状态。
- 已找到的规则原文矩阵：`b5-p2-rule-text-lock-matrix-2026-07-02.md` 已锁城塞骑士「守卫」（`guardian`）官方 `Protect` 原文；`b7-p3-movement-and-adjacency-rule-text-lock-matrix-2026-07-02.md` 已锁掷术师「缠斗」（`rebound`）官方 `Engage` 原文。
- 当前正确结论：史米革/部落投石手「凶猛」（`ferocity`）和城塞骑士「缠斗」（`entangle`）不是“没录入”，而是已有录入入口和候选线索，但合同状态仍为对象归属争议；普通机制审计不得把它们自动拉回重录，也不得把候选改动汇报成已证实修复。
- 规范回写：`.spec/skills/game-audit-workflow/SKILL.md` 与 `.spec/knowledge/standards/testing-audit.md` 已新增“先查已有录入合同，不得默认判没录入”门禁。

## 155. C90 中文录入优先中文汇报（2026-07-03）

本节补齐 C89 后的汇报口径：召唤师战争录入和本地对象命名以中文为主，后续审计与修复汇报必须优先给用户可直接核对的中文对象、中文能力名和中文规则描述/合同原文；英文官方名、英文原文、能力 id 与代码标识只能作为附证或定位。

- 规范回写：`.spec/skills/game-audit-workflow/SKILL.md` 与 `.spec/knowledge/standards/testing-audit.md` 已新增“中文录入优先中文汇报”门禁。
- 汇报格式：表格默认列为“对象 / 能力 / 中文规则描述或合同状态 / 英文附证 / 现有实现 / 本轮改动 / 状态”，不得只列英文或 id。
- 本轮适用对象：史米革/部落投石手「凶猛」、城塞骑士「缠斗」、城塞骑士「守卫」、掷术师「缠斗」。

## 156. C91 原文列不得用状态句顶替（2026-07-03）

本节纠正 C90 表格仍使用“已有录入入口 / 合同未锁定 / 是否承载未锁成可修复合同”这类状态句顶替原文的问题。后续表格中凡列名包含“规则原文 / 合同原文 / 中文规则描述 / 能力描述”，只能填逐字原文；没有找到逐字原文就写“未找到原文记录”，再另列合同状态和已查入口。

- 规范回写：`.spec/skills/game-audit-workflow/SKILL.md` 与 `.spec/knowledge/standards/testing-audit.md` 已新增“原文列必须填原文，不得用状态句顶替”门禁。
- 本轮表格重列口径：史米革/部落投石手「凶猛」若在现有合同中没有逐字中文原文，原文列写“未找到中文原文记录”；英文候选 `Relentless` 原文只能放在英文附证列，不能冒充中文原文或归属裁定。
- 城塞骑士「守卫」和掷术师「缠斗」已有英文原文；中文规则描述必须根据已锁子句给出，不得只贴英文或 id。
