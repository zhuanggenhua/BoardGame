## ADDED Requirements

### Requirement: 小黑屋房间入场带淡出
系统 SHALL 在 `betrayal` 对局中为房间发现和棋子换房提供淡出/入场表现。新放置的房间 MUST 有提亮落下。棋子离开原房间 MUST 淡出，进入目标房间 MUST 淡入。发现新房间时 MUST 播放场景层（由暗到亮）。该表现 MUST 用 CSS 动画或 2D canvas 实现，MUST NOT 引入 WebGL shader 运行时。氛围层 MUST 不拦截棋盘点击，MUST NOT 出现在其它游戏。

#### Scenario: 新房间提亮落下
- **GIVEN** 玩家完成一次探索并放下新房间
- **WHEN** 该房间首次出现在地图上
- **THEN** 房间以提亮并轻微放大后落下的方式入场
- **AND** 权威房间状态与未播放入场时相同

#### Scenario: 棋子换房淡出淡入
- **GIVEN** 探索者从房间 A 移动到房间 B
- **WHEN** 移动表现播放
- **THEN** 棋子在 A 淡出并在 B 淡入
- **AND** 最终位置是权威目标房间

#### Scenario: 发现新房间场景层
- **GIVEN** 新房间已被规则揭示
- **WHEN** 发现表现开始
- **THEN** 玩家看到该房间场景由暗到亮
- **AND** 随后仍可完成朝向或确认（若规则需要）

#### Scenario: 氛围层不抢点击
- **GIVEN** 玩家进入 `betrayal` 对局
- **WHEN** Board 完成首屏渲染
- **THEN** 小屋氛围层可见
- **AND** 点击仍落到房间、棋子和 `?` 格

#### Scenario: 作祟前后气氛可区分
- **GIVEN** 对局从作祟前进入作祟后
- **WHEN** 作祟揭示完成
- **THEN** 氛围层切换到作祟后气氛
- **AND** 规则状态仍以 Pipeline 结果为准

### Requirement: 小黑屋「你的回合」片头可跳过
系统 SHALL 在本机玩家刚获得行动权时于 `betrayal` 播放「你的回合」片头。该片头期间 MUST 提供全屏 skip 层；点击 skip MUST 结束或加速这张片头，MUST NOT 取消移动、攻击或作祟读本。该片头 MUST NOT 渲染到其它 `gameId`。系统 MUST 在本机座位成为行动者时播一次，MUST NOT 在已经处于自己回合时重播，MUST NOT 在他人回合播放本机片头。

#### Scenario: 轮到本机玩家播片头
- **GIVEN** 当前游戏为 `betrayal`
- **AND** 行动权刚交给本机玩家
- **WHEN** 回合开始表现触发
- **THEN** 玩家看到「你的回合」片头
- **AND** 听到回合提示音

#### Scenario: 点击 skip 结束片头
- **GIVEN** 「你的回合」片头正在播放
- **WHEN** 玩家点击全屏 skip 层
- **THEN** 片头结束或加速完成
- **AND** 玩家可以立即操作棋盘
- **AND** 当前移动或攻击演出不被取消

#### Scenario: 等待他人回合不播本机片头
- **GIVEN** 当前行动者不是本机玩家
- **WHEN** 对方正在行动
- **THEN** 不播放本机「你的回合」片头
- **AND** 不出现 skip 层

#### Scenario: 自己回合内不重播
- **GIVEN** 本机玩家已经是行动者且片头已结束
- **WHEN** 本机玩家继续在同一回合内移动或探索
- **THEN** 不再播放「你的回合」片头

### Requirement: 小黑屋音频层次仍走公共 registry
系统 SHALL 为小黑屋提供作祟前/作祟后 BGM、关键行动 stinger、低音量环境循环和回合提示音。资源 MUST 来自 common registry，映射 MUST 留在 `src/games/betrayal/audio.config.ts`。系统 MUST NOT 因此改写其它游戏的音效 key 或 AudioManager 总线图。

#### Scenario: 作祟后切换 BGM
- **GIVEN** 作祟已经公开
- **WHEN** 音频规则求值
- **THEN** 播放作祟后 BGM
- **AND** 仍使用 registry 中的既有或新增 key

#### Scenario: skip 片头收口回合提示音
- **GIVEN** 「你的回合」片头正在播放回合提示音
- **WHEN** 玩家 skip 该片头
- **THEN** 未完成的回合提示音停止排队
- **AND** BGM 与环境循环继续
