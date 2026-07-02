# 召唤师战争机制全面审计启动记录（2026-07-02）

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
