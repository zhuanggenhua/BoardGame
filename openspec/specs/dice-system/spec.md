# Dice System Specification

## Overview
通用骰子系统，支持各类桌游骰子机制：自定义符号骰（DiceThrone）、标准数值骰（Catan, D&D）、骰子池/袋抽取（Zombie Dice）。

## Requirements

### Requirement: Dice Definition Registration
系统 SHALL 支持注册骰子定义模板，包含骰面数、各面符号/数值映射、分类标签。

#### Scenario: Register custom dice
- **GIVEN** 一个骰子定义 `{ id: 'monk-dice', sides: 6, faces: [...] }`
- **WHEN** 调用 `diceSystem.registerDefinition(definition)`
- **THEN** 定义被存储，可通过 `getDefinition('monk-dice')` 获取

### Requirement: Dice Instance Creation
系统 SHALL 支持根据定义创建骰子实例，实例包含运行时状态（当前值、是否锁定）。

#### Scenario: Create dice from definition
- **GIVEN** 已注册定义 `'monk-dice'`
- **WHEN** 调用 `diceSystem.createDie('monk-dice', { id: 0, initialValue: 1 })`
- **THEN** 返回 `Die { id: 0, definitionId: 'monk-dice', value: 1, symbol: 'fist', symbols: ['fist'], isKept: false }`

### Requirement: Dice Rolling
系统 SHALL 支持掷骰操作，返回新的骰子状态（不修改原状态），锁定的骰子不重掷。

#### Scenario: Roll unlocked dice
- **GIVEN** 一个未锁定的骰子 `{ id: 0, value: 1, isKept: false }`
- **WHEN** 调用 `diceSystem.rollDie(die)`
- **THEN** 返回新骰子，value 为随机值，symbol/symbols 根据定义解析

#### Scenario: Skip locked dice
- **GIVEN** 一个锁定的骰子 `{ id: 0, value: 3, isKept: true }`
- **WHEN** 调用 `diceSystem.rollDie(die)`
- **THEN** 返回原骰子（不变）

### Requirement: Roll Statistics
系统 SHALL 计算掷骰统计：点数总和、符号计数、点数计数、顺子判断、最大相同数。

#### Scenario: Calculate statistics
- **GIVEN** 骰子列表 `[{value:1}, {value:2}, {value:3}, {value:4}, {value:5}]`
- **WHEN** 调用 `diceSystem.calculateStats(dice)`
- **THEN** 返回 `{ total: 15, hasSmallStraight: true, hasLargeStraight: true, maxOfAKind: 1, ... }`

### Requirement: Trigger Condition Checking
系统 SHALL 支持检查多种触发条件：符号数量、点数组合、顺子、N个相同。

#### Scenario: Check symbol trigger
- **GIVEN** 骰子符号计数 `{ fist: 3, palm: 2 }`
- **WHEN** 检查触发条件 `{ type: 'symbols', required: { fist: 3 } }`
- **THEN** 返回 `true`

#### Scenario: Check straight trigger
- **GIVEN** 骰子点数 `[1, 2, 3, 4, 6]`
- **WHEN** 检查触发条件 `{ type: 'smallStraight' }`
- **THEN** 返回 `true`（有 4 个连续）

### Requirement: Multi-Symbol Support
骰面定义 SHALL 支持一面多个符号（如双符号面）。

#### Scenario: Face with multiple symbols
- **GIVEN** 骰面定义 `{ value: 6, symbols: ['lotus', 'chi'] }`
- **WHEN** 骰子掷出 6
- **THEN** `die.symbol = 'lotus'`（主符号），`die.symbols = ['lotus', 'chi']`（所有符号）

## Design Decisions

### Symbol vs Value
- `value`：数值，用于顺子判断、点数计算
- `symbol`：符号，用于技能触发、UI 展示
- 同一点数可映射到不同符号（如 Monk：1,2→fist, 4,5→taiji）

### Singleton Pattern
使用全局单例 `diceSystem`，游戏启动时注册定义，运行时复用。

## Related Specs
- `implement-domain-core-and-systems` - 引擎层架构
