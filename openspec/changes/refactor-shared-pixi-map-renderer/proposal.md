# 变更：建立共享 Pixi 地图渲染契约并以七大恨试点

## Why

当前棋盘地图由 DOM 图片、SVG 路线、透明 canvas 命中层、React token 和 CSS 视口共同组成。每层各自维护坐标、事件或变换，导致拖拽、缩放、教程聚焦、移动端壳层换算和对象级命中必须跨多个实现同步。高频指针输入仍会经过 React 受控状态链路，复杂地图对象继续增加时，渲染量和交互成本会一起上升。

参考实现使用 PixiJS 场景图承载地图对象、相机容器和对象级指针事件，把相机平移、缩放、惯性和命中收敛在同一个渲染坐标系中。项目需要吸收这个职责分工，但不把规则、HUD、教程状态或 React 产品壳迁入渲染器。

## What Changes

2026-10-13 实玩补充（新增部分待评审）：[两款参考的体验对照](reference-comparison.md) 区分实际试玩、用户锁定参数和我方静态风险。Old King’s Crown 的长处是场景与固定操作面板分离、动作连贯及结果可追溯；它的部署不明确和手牌遮挡不照搬。小屋动效仍由 [Betrayal change](../upgrade-betrayal-presentation-audio/proposal.md) 承接，不强制迁入 Pixi。

- **新增共享地图渲染契约**：定义场景状态、相机状态、地图坐标、对象命中意图、聚焦和资源失败语义。
- **新增 PixiJS 可选运行时**：引入 `pixi.js` 与 `@pixi/react`，作为地图 / token / 路线 / 地图 FX 的渲染后端，不替换 DomainCore、Pipeline 或 React HUD。
- **建立七大恨试点**：实现 `PixiMapScene`，先接管主地图、地区命中、路线 / 高亮和地图 token；React 保留 HUD、规则命令、教程文案、区域信息提示和命令提交。
- **收敛相机真相源**：Pixi 场景与 React 只共享一份 `MapViewportState`，高频拖拽、惯性和缩放直接更新场景，相机聚焦通过正式 handle 驱动。
- **保留迁移期间的可验证回退路径**：旧 DOM/SVG/canvas 路径在 Pixi 试点通过真实入口、移动端和教程验收前不删除；旧路径不得继续维护第二份业务状态。
- **建立性能与交互验收**：同入口对比拖拽输入延迟、帧率 / 长任务、对象命中、教程聚焦、移动端坐标和资源失败表现。
- **对齐显示帧而不只最终相机状态**：保留 DOM 地图层时必须与 Pixi 使用同一实际显示变换，不能一边显示目标 pose、一边显示平滑 pose。
- **保护玩家操作区**：满载部署时地图目标、手牌和当前任务仍可读可点；关闭详情保留镜头和合法选择。复用已有组件，禁止新增平行日志或解释性常驻面板。

## Impact

- Affected specs: `ui-engine-framework`
- Affected code: `src/engine/boardRenderer/`, `src/engine/transport/`, `src/games/qidahen/`, `src/components/game/framework/`, `package.json`
- Affected verification: `src/games/qidahen/__tests__/`, `e2e/qidahen/`, Web Performance evidence
- Migration status: architecture proposal only; no existing game renderer is removed by this proposal

## Scope Boundary

- 本 change 不迁移 Betrayal、Mage Wars、Summoner Wars 或 Smash Up。
- 本 change 不把 React HUD、规则状态、命令校验、教程状态机或无障碍语义整体迁入 Pixi。
- 本 change 不把 Pixi 当作完整游戏引擎；它只承担 2D 场景渲染和对象级输入层。
