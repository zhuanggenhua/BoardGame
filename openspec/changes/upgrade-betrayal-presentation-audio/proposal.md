# Change: 小黑屋改成棋盘直选，并把房间淡出和「你的回合」做对

## Why

参考山中小屋，小黑屋现在差在玩法和 UI，不只是雾和音效。玩家要先点一排 dock 按钮才能移动或探索；参考站是战棋式点棋子、点房间，走到 `?` 就探索。房间入场有淡出/亮起，skip 只用来跳过「你的回合」片头。上一版提案把 skip 写成通用过渡快进，并把「每次轮到你」和「从别人交回来」拆成两个问题，分析错了。

## What Changes

- 移动改成棋盘本体直选：你的回合默认选中可控制棋子，点合法房间即移动。作祟后多枚可控制棋子时，先点棋子再点目的地。
- 探索改成点 `?` 格自动开始：相邻未发现门口是棋盘目的地，不再经过 dock「探索」按钮。圣符/神像等声明仍在点 `?` 之后出现。
- 行动 dock 退出移动/探索入口。交易、使用、房间效果优先落到棋子、手牌或房间本体；dock 只留结束回合和没有棋盘对象的作祟特殊行动。
- 房间淡出/入场：新房间亮起落下、棋子走出/走入、发现新房间场景层。实现用 CSS 动画和可选 2D canvas 光雾，不新建 WebGL shader 引擎。
- 「你的回合」片头：本机座位刚拿到行动权时播一次。全屏 skip 层点击后结束或加速这张片头。这不是跳过移动/攻击演出的通用按钮。
- 加厚小黑屋音频：作祟前/后 BGM、探索/攻击/作祟 stinger、环境循环、回合手铃。资源仍走 common registry，映射仍在 `audio.config.ts`。
- 教程高亮从 dock「移动/探索」改到棋子、合法房间和 `?` 格。

## Non-Goals

- 不把这套模式上提成平台默认，也不给其它游戏加开关。
- 不改七大恨、Smash Up 或其它游戏。
- 不替换 DomainCore、Pipeline、socket.io、Howler 加载链或 AI。移动/探索仍发现有 `move` / `explore` 命令。
- 不交付热座。
- 不新建平台 PresentationDirector 或 shader 运行时。
- 房主踢人另开小 change。

## Follow-up（本轮不做）

- 小黑屋效果经你确认后，再提案是否抽取可复用编排。
- 等待房踢人。

## Impact

- Affected specs: `betrayal-board-interaction`（新增）、`betrayal-presentation`（新增）
- Affected code:
  - `src/games/betrayal/Board.tsx`
  - `src/games/betrayal/actionBarReadModel.ts`
  - `src/games/betrayal/actionDockSurface.tsx`
  - `src/games/betrayal/actionCueReadModel.ts`
  - `src/games/betrayal/previewStateModel.ts`
  - `src/games/betrayal/roomMapSurface.tsx`
  - `src/games/betrayal/roomMapModel.ts`
  - `src/games/betrayal/movementReadModel.ts`
  - `src/games/betrayal/tutorial.ts`
  - `src/games/betrayal/visualTransitionSurface.tsx`
  - `src/games/betrayal/visualTiming.ts`
  - `src/games/betrayal/audio.config.ts`
  - 本游戏新增房间入场层 / 回合片头 / skip 层
- Unchanged: `audio-system` 全局合同、`ui-engine-framework`、其它 `src/games/*`
