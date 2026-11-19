# Change: 小黑屋改成棋盘直选，并把房间淡出和「你的回合」做对

## Why

参考山中小屋，小黑屋现在差在玩法和 UI，不只是雾和音效。玩家要先点一排 dock 按钮才能移动或探索；参考站是战棋式点棋子、点房间，走到 `?` 就探索。房间入场有淡出/亮起，skip 只用来跳过「你的回合」片头。上一版提案把 skip 写成通用过渡快进，并把「每次轮到你」和「从别人交回来」拆成两个问题，分析错了。

## What Changes

2026-11-19 用户批准将已审阅的小黑屋 3D 棋桌接入正式对局。采用现有 TTS 房间图集和旧 3D 实验的 12 枚探索者模型，沿用对局规则、地图直选和 HUD。2026-10-13 的 [双参考对照与 12 条增量](../refactor-shared-pixi-map-renderer/reference-comparison.md) 继续约束交互与结算。

- 移动改成棋盘本体直选：你的回合默认选中可控制棋子，点合法房间即移动。作祟后多枚可控制棋子时，先点棋子再点目的地。
- 探索改成点 `?` 格自动开始：相邻未发现门口是棋盘目的地，不再经过 dock「探索」按钮。圣符/神像等声明仍在点 `?` 之后出现。
- 行动 dock 退出移动/探索入口。交易、使用、房间效果优先落到棋子、手牌或房间本体；dock 只留结束回合和没有棋盘对象的作祟特殊行动。
- Three.js 承载房间板块、探索者模型、镜头与场景动效。HUD、规则阅读和选择控件由 React 承载。现有 Pixi 棋盘提供 WebGL 2 初始化失败、上下文丢失及 3D 棋盘纹理加载失败时的可玩兼容。
- 「你的回合」片头：本机座位刚拿到行动权时播一次。全屏 skip 层点击后结束或加速这张片头。这不是跳过移动/攻击演出的通用按钮。
- 加厚小黑屋音频：作祟前/后 BGM、探索/攻击/作祟 stinger、环境循环、回合手铃。资源仍走 common registry，映射仍在 `audio.config.ts`。
- 教程高亮从 dock「移动/探索」改到棋子、合法房间和 `?` 格。
- 普通相邻移动增加单步 hop、合法路径/消耗反馈、落脚音与落地 ripple；每步由被接受的移动事实驱动，拒绝和回滚不留下成功表现。跨层/传送单独表达，不使用普通步行轨迹。
- 地图跟随以看清当前对象为目的，手动拖动优先；发现入场、光雾和音效按实际阶段启停，保留关键选择和阅读时间。
- 在现有选择、分配和日志组件上补实际缺口：稳定的当前决策区、结果位置可逆修改、贴对象的结果反馈、检视关闭后返回原局面。不是再做一套结算 UI。

## Non-Goals

- 3D 棋盘的渲染、镜头与资源属于小黑屋。其它游戏继续使用各自的地图渲染器。
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

## 批准与最新范围

2026-10-13 用户明确「理解了就开始实施」，随后指定「pixi也用到小黑屋上吧，就不分开试点了，都统一改好一个先」。本轮优先小黑屋，整体美术、字体、配色和正式房间/棋子素材保持原有体系；学习摆放、动效和交互能力，不复制参考皮肤。你的回合片头、点击跳过、棋子摆放以及已确认的体验增量均纳入实施。用户仍禁止启动 Work/Codex，只在当前云端工作区执行。
