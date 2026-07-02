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
