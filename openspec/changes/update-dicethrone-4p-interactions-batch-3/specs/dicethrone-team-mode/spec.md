## ADDED Requirements

> 本 change 只收口 DiceThrone 4 人 / 2v2 四人专项的 Batch 3：`modifyDie` / `selectDie` 多步骰子交互及其共享窗口语义，不重复 Batch 1/2 已完成的玩家目标交互。

### Requirement: Batch 3 多步骰子交互的骰池归属语义兼容
系统 SHALL 在 4 人 / 2v2 模式下，按真实当前骰池归属与观察视角驱动 `modifyDie` / `selectDie` 交互；共享 UI、文案与验证层 MUST 不得继续把“当前不是自己的骰子”压缩成泛化的“对手骰子”。

#### Scenario: 队友干预当前 roller 的骰池时仍保留正确的骰池归属语义
- **GIVEN** 4 人 / 2v2 对局中，当前存在合法的掷骰干预窗口
- **WHEN** 一名非 roller 玩家触发 `modifyDie` 或 `selectDie` 多步骰子交互
- **THEN** 系统按当前 roller 的骰池执行交互
- **AND** UI hint / 元数据不会把该骰池错误地固定描述成“对手骰子”

### Requirement: Batch 3 合法干预窗口与响应队列边界兼容
系统 SHALL 在 4 人 / 2v2 模式下，同时满足“队友可在合法掷骰窗口干预骰面”与“队友不进入同队响应队列”两条边界；共享规则层 MUST 不得把这两条规则误合并成“只有单一对手能发起骰子交互”。

#### Scenario: 队友可合法改骰但不会进入同队响应队列
- **GIVEN** 4 人 / 2v2 对局中，一名玩家正在合法掷骰窗口内操作当前骰池
- **WHEN** 其队友使用可作用于当前骰池的合法改骰效果
- **THEN** 系统允许该效果对当前骰池生效
- **AND** 同队玩家默认仍不会被加入同队 `responderQueue`

#### Scenario: self-only 骰子卡不会因 2v2 自动扩张到队友骰池
- **GIVEN** 4 人 / 2v2 对局中存在共享掷骰干预窗口
- **AND** 一张骰子卡的规则语义仅允许“修改自己的骰子”
- **WHEN** 该卡的使用者尝试把它作用到队友当前正在操作的骰池
- **THEN** 系统不得仅因 2v2 队友关系或共享响应窗口就允许该效果生效
- **AND** 这类 `self-only` 效果仍只允许作用于使用者自己的骰池

### Requirement: Batch 3 代表性多步骰子入口兼容
系统 SHALL 在 4 人 / 2v2 模式下，正确支持通用 `modifyDie/selectDie` 入口与 `shadow_thief-shadow-manipulation` 这类共享多步骰子交互；共享交互链、验证层与真实页面 MUST 对选择数量和确认语义保持一致。

#### Scenario: Shadow Manipulation 在 4 人模式下保留稳定的多步选骰语义
- **GIVEN** 4 人 / 2v2 对局中暗影盗贼触发 `Shadow Manipulation`
- **WHEN** 当前玩家拥有 `Sneak` 并进入该交互
- **THEN** 系统仍允许按 `2` 颗骰子的语义完成多步修改
- **AND** 不会因为 4 人视角或共享窗口变化而退化成错误的单骰或旧 2 人路径
