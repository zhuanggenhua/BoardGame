## 1. 现状与契约

- [ ] 1.1 记录 Qidahen 当前地图 DOM/SVG/canvas/React token 的消费者与成功 / 失败 / 时序合同
- [x] 1.2 定义共享 `MapViewportState`、`MapInteractionIntent`、scene geometry 和 renderer lifecycle 类型
- [x] 1.2a 保持 `GameBoardRenderer` / `BoardBridge` 的整块 Board 语义，新增独立 `MapSceneRenderer` owner
- [ ] 1.3 明确 E2E 选择器、教程锚点、移动端坐标换算和资源失败的迁移口径

## 2. 共享运行时

- [x] 2.1 引入并锁定已验证的 `pixi.js` 与 `@pixi/react` 版本
- [x] 2.2 建立 `PixiMapSceneHost` / renderer owner，限定 Pixi 的职责为地图场景与对象级输入
- [ ] 2.3 建立 Pixi 资源加载、销毁、context/资源失败和 reduced-motion 处理
- [ ] 2.3a 将 Pixi texture ready / failure 接入 CriticalImageGate 语义，并保留 token 键盘 / ARIA accessibility bridge
- [x] 2.4 让相机只由一份 viewport contract 驱动，禁止 renderer 生成第二份业务状态

## 3. 七大恨试点

- [ ] 3.1 接入正式地图 geometry，渲染主地图和地区 hit area
- [ ] 3.2 接入路线、选中态、教程高亮和来源到目标的过程表现
- [ ] 3.3 接入地图 token、pending committed troop 和对象级点击意图
- [ ] 3.4 保留 React HUD、区域提示、教程文案和命令提交
- [ ] 3.5 完成桌面 / 移动端缩放、拖拽、惯性、聚焦与壳层坐标验收

## 4. 验证与推广门槛

- [ ] 4.1 更新 Qidahen 单测与真实入口 E2E，使断言面向行为合同而非旧 DOM 结构
- [ ] 4.1a 修正直接导入 `Board.tsx` 的移动测试，使其覆盖真实 renderer 入口或明确标注为旧路径夹具
- [ ] 4.2 采集同入口 Pixi 前后性能基线：帧率、输入延迟、长任务、React commit 与资源耗时
- [ ] 4.3 完成资源失败、教程中间帧、区域命中、token 命中和 reduced-motion 验证
- [ ] 4.4 只有所有试点门禁通过后，才删除旧 DOM/SVG/canvas renderer 中无消费者的路径
- [ ] 4.5 将已验证 contract 写入未来新游戏 renderer 模板；本轮不迁移其它既有游戏

## 5. 本轮明确不做

- [ ] 5.1 不迁移 Betrayal、Mage Wars、Summoner Wars、Smash Up
- [ ] 5.2 不把 DomainCore、Pipeline、HUD、教程状态机或完整可访问性系统迁入 Pixi
- [ ] 5.3 不把 Pixi FX、Shader 或其它外部引擎扩展为全局默认能力
