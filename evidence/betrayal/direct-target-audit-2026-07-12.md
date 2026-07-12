# 山屋惊魂直选优先审计（2026-07-12）

本轮审计对象是当前仓库 `src/games/betrayal/Board.tsx` 的真实牌桌 UI。结论按“主视图可见对象必须本体直选，辅助列表/提示不得发正式目标命令”收口。

| 入口 | 主视图真实对象 | 当前主点击 | 贴合高亮 | 辅助入口角色 | 验证证据 |
| --- | --- | --- | --- | --- | --- |
| 英雄攻击叛徒 | 地图上的叛徒玩家 token | `betrayal-room-occupant-basement-east-2` | 五边形 token 描边 `data-highlight-shape="pentagon"` | 动作栏只提示攻击；旧 `betrayal-room-focus-target` 不出现 | `first-scenario-core-interactions.e2e.ts` 核心 6 条通过 |
| 叛徒攻击英雄 | 地图上的英雄玩家 token | `betrayal-room-occupant-*` | 五边形 token 描边 | 队友列表只定位房间，不发攻击命令 | `Board.foundation.test.tsx` 42 条通过；教程攻击相关路径保留对象点击断言 |
| 交易目标 | 地图上的队友玩家 token | `betrayal-room-occupant-hallway-1` | 五边形 token 描边 | 队友卡只定位/展示状态；旧 `betrayal-trade-target-*` 不作为主路径 | `first-scenario-core-interactions.e2e.ts`、`first-scenario-trade-interaction.e2e.ts` 已改为 token 点击 |
| 搜尸目标 | 地图上的倒下玩家 token | `betrayal-room-occupant-hallway-0` | 五边形 token 描边 | 搜尸候选列表只展示状态 | `Board.foundation.test.tsx` 通过 |
| 治疗目标 | 地图上的玩家 token | `betrayal-room-occupant-entrance-hall-1` | 五边形 token 描边 | `betrayal-inventory-target-player-*` 为状态 span，不发目标命令 | `Board.foundation.test.tsx` 通过 |
| 面具移动目标 | 地图上的玩家/怪物 token | `betrayal-room-occupant-*`、`betrayal-room-monster-*` | 玩家五边形、怪物 token 描边 | `betrayal-mask-active-target-*` 只显示当前待选对象 | `Board.foundation.test.tsx` 通过 |
| 物品目标房间 | 地图房间牌 | `betrayal-room-*` | 房间牌矩形贴边 | `betrayal-inventory-target-room-*` 为状态 span | `Board.foundation.test.tsx` 通过 |
| 事件目标房间 | 地图房间牌 | `betrayal-room-*` | 房间牌矩形贴边 | `betrayal-event-choice-room-*` 为状态 span | `event-choice-coverage.e2e.ts` 12 条通过 |
| 探索目标 | 未探索房间牌 | `betrayal-room-ground-north` 等房间牌 | 房间牌探索高亮 | 动作栏只进入探索模式 | `explore-unknown-room.e2e.ts` 通过 |
| 移动目标 | 可达房间牌 | `betrayal-room-*` | 可达房间牌绿色贴边高亮 | 楼层切换只负责切层，不替代目标选择 | `Board.foundation.test.tsx`、`explore-unknown-room.e2e.ts` 通过 |
| 调查杰克 | 当前图书馆房间牌 | `betrayal-room-upper-west` | `betrayal-room-focus-card-highlight-upper-west`，`data-highlight-shape="room"` | `betrayal-room-focus-target` 只保留状态提示 `data-role="status"` | `first-scenario-core-interactions.e2e.ts` 核心 6 条通过 |
| 研究法阵 | 当前事件房间牌 | `betrayal-room-upper-north` | `betrayal-room-focus-card-highlight-upper-north`，`data-highlight-shape="room"` | 动作栏只显示可用动作，不作为 E2E 主点击 | `first-scenario-core-interactions.e2e.ts` 核心 6 条通过 |
| 驱魔杰克之灵 | 当前地下室起始点房间牌 | `betrayal-room-basement-landing` | `betrayal-room-focus-card-highlight-basement-landing`，`data-highlight-shape="room"` | `betrayal-room-focus-target` 只保留状态提示 | 核心 E2E 驱魔失败反扑通过；教程窄用例覆盖房间直选进入驱魔结算 |
| 圆形高亮例外 | 骰子 | 重掷骰子本体 | `data-highlight-shape="circle"` | 仅骰子允许圆形 | 扫描结果只剩 `Board.tsx:2258` 骰子重掷目标 |

## 关键修复结论

- 旧的 `betrayal-room-focus-target` 从可点击按钮降级为状态提示，调查杰克、研究法阵、驱魔都由当前房间牌本体承接。
- `betrayal-room-trade-shortcut` 已从运行时实现中移除，交易提示改为 `betrayal-room-trade-status-cue` 状态提示，不再是命令捷径。
- 左侧角色状态栏原本视觉上不该交互，却会遮挡图书馆房间牌点击；已改为不接收指针事件，保留原布局但不再挡住房间直选。
- 非骰子目标的圆形选中/目标圈已清掉；角色、怪物、房间、物品牌均使用贴合本体的描边或高亮。

## 验证命令

- `npx eslint src/games/betrayal/Board.tsx e2e/betrayal/first-scenario-core-interactions.e2e.ts e2e/betrayal/betrayal-tutorial.e2e.ts --quiet` 通过。
- `npm run test:e2e:file -- e2e/betrayal/first-scenario-core-interactions.e2e.ts` 通过，6 passed。
- `npm run test:e2e:file -- e2e/betrayal/event-choice-coverage.e2e.ts` 通过，12 passed。
- `npm run test:e2e:file -- e2e/betrayal/explore-unknown-room.e2e.ts` 通过，1 passed。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/Board.foundation.test.tsx --configLoader native` 通过，42 passed。

## 已知非本轮阻塞

- `betrayal-tutorial.e2e.ts` 的整链教程用例已走到“点房间本体进入驱魔结算”，但停在骰子物理源 `data-dice-physics-ready` 10 秒等待；页面快照显示驱魔骰盘、总点数和“进入终局”已经出现。该失败属于骰子物理 ready 等待，不是房间直选链路失败。
