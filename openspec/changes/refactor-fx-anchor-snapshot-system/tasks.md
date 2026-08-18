## 1. Proposal And Baseline
- [x] 1.1 审计当前 `src/engine/fx/`、共享 preset、Mage Wars FX、Smash Up FX 的坐标入口和 DOM 查询点。
- [x] 1.2 锁定最终设计为 Web 原生 `FxSurface` + `FxAnchorSnapshot`：Phaser / Godot 作为主要实现参考，Unity / Unreal 只作 one-shot 与 tracking 边界校验，不引入外部引擎。
- [x] 1.3 确认第一批迁移链路：Mage Wars 召唤 / 攻击，Smash Up 一个无地图牌桌特效。
- [x] 1.4 记录旧 `cell` / `screenPos` 兼容边界和禁止新增业务 DOM 查询的迁移规则。

## 2. Engine FX Surface And Anchor Snapshot
- [x] 2.1 新增 `FxSurfaceId`、`FxAnchorRef`、`FxAnchorSnapshot`、`FxAnchorMode` 等类型。
- [x] 2.2 新增 surface-local 坐标转换与 anchor registry hook / helper。
- [x] 2.3 在 `FxBus` 或事件消费 helper 中支持 spawn-time snapshot 输入。
- [x] 2.4 为旧 `ctx.cell` 提供 adapter，避免一次性打断现有游戏。

## 3. Shared Renderer Migration
- [x] 3.1 改 `BoardProjectilePathPreset`、`BoardProjectileAttackPreset`、`BoardBurstImpactPreset`、`BoardSummonEffectPreset` 消费 snapshot / box。
- [x] 3.2 将 renderer 里的业务 DOM 查询移到游戏 Board 的 anchor 注册 / snapshot 解析层。
- [x] 3.3 明确 tracking FX 的 API 与 lifecycle，禁止一次性 FX 默认跟随 live DOM。

## 4. Mage Wars Migration
- [x] 4.1 Mage Wars Board 注册单位、法师、附件槽和区域 anchor。
- [x] 4.2 Mage Wars `useGameEvents` 在 push FX 前生成 source / target snapshot。
- [x] 4.3 移除 Mage Wars renderer 对业务 DOM 的 querySelector 依赖。
- [x] 4.4 保留并收敛被击败目标视觉保留逻辑，使其成为 FX lifecycle / held visual 的消费方。

## 5. Smash Up Compatibility
- [x] 5.1 Smash Up Board 注册无地图牌桌 anchor，例如基地、仆从、行动卡、弃牌堆或 VP 区。
- [x] 5.2 迁移至少一条 Smash Up 特效链路到 anchor snapshot，证明不依赖 row/col。
- [x] 5.3 增加无地图场景回归：来源卡 / 目标基地 / 得分区坐标稳定，响应式重排后已生成 FX 不漂移。

## 6. Verification
- [x] 6.1 增加 `src/engine/fx/` 单测：surface-local snapshot、缺失 anchor fail-close、tracking 与 spawn 分离。
- [x] 6.2 增加 Mage Wars 单测：目标被击败后一次性攻击仍使用 spawn snapshot。
- [x] 6.3 增加 Smash Up 单测或 E2E：无地图牌桌特效使用 object anchor snapshot。
- [x] 6.4 跑 `npm run typecheck`、相关 Vitest、Mage Wars / Smash Up 聚焦 E2E。

## 7. Documentation
- [x] 7.1 更新 `.spec/knowledge/standards/animation-effects.md`：spawn snapshot vs tracking anchor。
- [x] 7.2 更新 `.spec/knowledge/standards/engine-visual-events.md`：同步结算 + 表现层坐标快照 / held visual。
- [x] 7.3 在最终回执中列明哪些游戏链路完成迁移，哪些仍走 legacy adapter。
