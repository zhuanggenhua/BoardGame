# dice-system Delta

## MODIFIED Requirements

### Requirement: Dice Definition Registration
系统 SHALL 使用由游戏层显式导出的骰子定义常量，而不是依赖全局 definition registry。

#### Scenario: Game passes definition directly
- **GIVEN** 游戏定义常量 `const MONK_DICE_DEF = { id: 'monk-dice', sides: 6, faces: [...] }`
- **WHEN** 游戏调用 `createDie(MONK_DICE_DEF, 0)` 或 `rollDie(die, MONK_DICE_DEF, random)`
- **THEN** 调用方直接传入定义对象即可，不需要预先向全局单例注册

### Requirement: Dice Instance Creation
系统 SHALL 支持根据显式传入的定义创建骰子实例，实例包含运行时状态，如当前点数、符号和保留状态。

#### Scenario: Create die from definition
- **GIVEN** 一个骰子定义和实例参数 `{ id: 0, initialValue: 1 }`
- **WHEN** 调用 `createDie(definition, 0, { initialValue: 1 })`
- **THEN** 返回包含 `definitionId`、`value`、`symbol`、`symbols` 与 `isKept` 的骰子实例

### Requirement: Dice Rolling
系统 SHALL 提供不可变的掷骰 API，支持单骰和整组骰子重掷，并保留已 `isKept` 的骰子。

#### Scenario: Roll unlocked die
- **GIVEN** 一个未保留的骰子实例和对应定义
- **WHEN** 调用 `rollDie(die, definition, random)`
- **THEN** 返回新的骰子状态，点数与符号依据定义重新计算

#### Scenario: Roll dice array while preserving kept dice
- **GIVEN** 一组骰子，其中部分骰子 `isKept = true`
- **WHEN** 调用 `rollDice(dice, definition, random)`
- **THEN** 返回新的 `dice` 列表与 `stats`，且已保留骰子保持原值

### Requirement: Roll Statistics
系统 SHALL 提供掷骰统计能力，统一输出总点数、符号计数、点数计数、顺子判定和最大同点数。

#### Scenario: Calculate statistics from rolled dice
- **GIVEN** 骰子结果 `[{value:1}, {value:2}, {value:3}, {value:4}, {value:5}]`
- **WHEN** 调用 `calculateDiceStats(results)`
- **THEN** 返回 `total`、`symbolCounts`、`valueCounts`、`hasSmallStraight`、`hasLargeStraight` 和 `maxOfAKind`

### Requirement: Trigger Condition Checking
系统 SHALL 基于统计结果提供常用触发判定辅助函数。

#### Scenario: Check symbol trigger
- **GIVEN** `symbolCounts = { fist: 3, palm: 2 }`
- **WHEN** 调用 `checkSymbolsTrigger(symbolCounts, { fist: 3 })`
- **THEN** 返回 `true`

#### Scenario: Check total trigger range
- **GIVEN** 总点数 `12`
- **WHEN** 调用 `checkTotalTrigger(12, 10, 15)`
- **THEN** 返回 `true`

### Requirement: Multi-Symbol Support
骰面定义 SHALL 支持单面包含多个符号，并在实例结果中同时暴露主符号和完整符号列表。

#### Scenario: Face with multiple symbols
- **GIVEN** 骰面定义 `{ value: 6, symbols: ['lotus', 'chi'] }`
- **WHEN** 骰子掷出该面
- **THEN** 结果中 `symbol` 为主符号，`symbols` 保留完整符号列表
