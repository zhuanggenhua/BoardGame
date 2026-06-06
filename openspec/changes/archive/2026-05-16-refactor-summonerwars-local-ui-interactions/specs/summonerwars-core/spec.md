## ADDED Requirements
### Requirement: Summoner Wars 跟进交互必须走引擎交互系统
Summoner Wars SHALL 将所有“等待玩家输入”的跟进交互建模为 `sys.interaction` 中的引擎交互，而不是仅存在于客户端本地 UI mode。AI、真人 UI 与服务端诊断都必须以同一交互状态为真相源。

#### Scenario: 领域事件触发的后续选择进入 sys.interaction
- **GIVEN** 某个 Summoner Wars 能力或事件在执行后需要玩家进一步选择
- **WHEN** 领域层生成该后续交互
- **THEN** 当前对局状态中出现对应的 `sys.interaction.current` 或队列项
- **AND** 该交互不再只依赖 `useGameEvents` / `useCellInteraction` / `useEventCardModes` 的本地 mode 才可继续

#### Scenario: AI 能看见并解决跟进交互
- **GIVEN** 当前待处理交互的归属玩家为 AI
- **WHEN** AI 读取 legal actions 或交互描述符
- **THEN** AI 可以构造至少一个合法响应命令
- **AND** 若无合法业务选择，系统仍提供合法 cancel / skip / pass 收口

#### Scenario: 对手看不到不应暴露的交互细节
- **GIVEN** 某个 Summoner Wars 跟进交互仅属于一名玩家
- **WHEN** 其他玩家接收其 `playerView`
- **THEN** 对手不会看到不应暴露的候选细节
- **AND** 服务端与归属 seat 仍能诊断该交互是否阻塞对局

### Requirement: Summoner Wars 多步选择必须使用引擎多步交互或显式简单交互
Summoner Wars SHALL 将多步技能/事件卡选择链路映射为 `multistep-choice` 或一组显式 `simple-choice` 交互，不得继续把“步骤进度 + 待确认结果”仅存放在本地 React state 中。

#### Scenario: 多步技能进度由引擎交互持有
- **GIVEN** 某个技能需要先选单位，再选位置/方向/卡牌后才能确认
- **WHEN** 玩家进行该多步交互
- **THEN** 当前步骤与中间结果由引擎交互状态表示
- **AND** UI 刷新或 AI 接管时仍能读取当前进度

#### Scenario: 取消或跳过不会留下悬空本地 mode
- **GIVEN** 玩家取消或跳过某个 Summoner Wars 跟进交互
- **WHEN** 交互被系统 resolve
- **THEN** 不会遗留只存在于本地 UI 的悬空 mode 状态
- **AND** 阶段推进与后续命令恢复到一致状态
