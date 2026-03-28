## 1. Core Model

- [x] 1.1 定义统一 `MatchState = { sys, core }`
- [x] 1.2 引入 `DomainCore` 契约与核心类型
- [x] 1.3 让命令、事件、归约链路走统一 pipeline

## 2. Systems Layer

- [x] 2.1 建立系统生命周期接口
- [x] 2.2 落地 Flow / Undo / Interaction / EventStream 等系统
- [x] 2.3 让系统层承担交互、撤回、日志、响应窗口等跨游戏能力

## 3. Runtime Integration

- [x] 3.1 提供适配器把 `DomainCore + Systems` 组装为运行时配置
- [x] 3.2 提供在线传输层承接同步与 player view
- [x] 3.3 提供本地运行模式复用同一套引擎执行链

## 4. Game Migration

- [x] 4.1 TicTacToe 接入新引擎基线
- [x] 4.2 DiceThrone 建立 `domain/` 结构并接入核心链路
- [x] 4.3 项目文档与规范已按现行架构更新

## 5. Scope Cleanup

- [x] 5.1 从归档范围移除 `boardgameio-adapter` 过渡命名
- [x] 5.2 从归档范围移除 `ugc-optional` 未来项
