# 未改写屏幕沿用证据

原图来自本轮 e2e-1792752233172-j0yf5a（手牌12、骑乘零张）及 e2e-1792751232151-9n62w4（骑乘其余3）；独立原审查记录在 temp/fate-final-visual-review-20261023.json。不是旧设计截图或历史任务勾选。

在上述原图逐张通过以后，仅有以下生产改动：

- Board移动意图分支的确认文案；地图合法地点选择层级与选中边界。原15个拟沿用画面没有移动意图或合法地点选择。
- player.eliminated派生本人/对手徽标及详情位置。原15个画面均无淘汰玩家，新增选择器不命中。
- Board准备阶段也渲染牌区、首轮推进改固定槽。原15个画面全部在前哨/行动/检视中，原来就渲染相同牌区与固定槽。
- FateHandSurface空手牌文案由手牌已全部打出改为暂无攻击手牌。因此旧空攻击手牌图不沿用，完整原手牌行为仍复跑且只定向重采empty-attack-hand，使用独立chainId。

拟沿用：手牌其余11原图、骑乘4原图。原图字节和原审查观察保留；本轮未改这些屏的实现分支，验收条件未新增覆盖它们，用户未点名它们不合格。由独立审查者核对本证据并标记carried-forward，禁止机械重复读这些未改原图。

新准备期、地图、淘汰本人/对手/详情由当前联网自然链及战后两代表态另行取证；不由上述原图证明。

实际生产源：src/games/fate-domination/Board.tsx、ui/FateHandSurface.tsx、ui/FatePlayerRail.tsx、ui/FateSelfDock.tsx、ui/playerPresentation.ts、ui/map-surface.css、ui/runtime-table.css。
