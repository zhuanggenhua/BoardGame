## Context
当前对局进入时使用统一 LoadingScreen，但关键图片可能在棋盘渲染后才开始加载，导致首屏闪烁或空白。资源量逐步增长后，全量预加载成本过高，需要两阶段策略并支持动态资源选择。

## Goals / Non-Goals
- Goals:
  - 提供“关键图片门禁 + 暖加载后台”的两阶段预加载能力。
  - 支持静态清单与动态解析器合并生成预加载列表。
  - 仅对内置游戏启用门禁，UGC 对局保持现状。
  - 失败容忍：单个图片加载失败不阻塞进入对局。
- Non-Goals:
  - 不改变音频预加载策略（已有机制覆盖）。
  - 不对 UGC 对局做门禁与资源解析。
  - 不引入新的资源打包或压缩流程。

## Decisions
- 采用关键/暖两阶段：关键资源 await，暖资源 idle/timeout 异步预取。
- 静态清单字段定义在 GameAssets（core/types.ts）上：`criticalImages` / `warmImages`，不放在 GameManifestEntry。
- 解析器输入：对局状态（game state）与可选 locale；输出：`{ critical: string[]; warm: string[] }`，字符串为相对 /assets 的图片路径。
- 图集场景：解析器输出 atlas 对应图片路径（如 `smashup/cards/cards1`），而不是 atlasId。
- `preloadGameAssets()` 维持“全量预加载”语义，仅用于调试/特殊场景；MatchRoom/LocalMatchRoom 改为使用新的两阶段 API。
- 关键图片加载添加 5s 超时：超时后放行进入对局，避免长时间阻塞。
- 引入“关键图片解析器注册表”以解耦游戏逻辑与框架，便于新游戏接入。
- 门禁落在 MatchRoom/LocalMatchRoom 入口层，避免在各游戏 Board 内重复实现。
- 解析器输出与清单静态列表合并，解析失败回退到静态列表。

## Alternatives Considered
- 预加载全部资源：加载时间不可控，移动端风险高。
- 在 Board 组件内自行预加载：重复实现、耦合高、不利于统一门禁。
- 仅使用静态清单：无法覆盖 SmashUp 派系等动态资源。

## Risks / Trade-offs
- 关键资源过多导致等待时间变长 → 通过清单审查与动态解析精简关键集。
- 解析器依赖状态不完整 → 回退到静态清单，并允许暖加载补齐。

## Migration Plan
- 新字段可选，旧游戏不填写则保持现有行为。
- 按游戏逐步补齐清单或解析器；新增游戏优先使用解析器。

## Open Questions
- 是否需要在 LoadingScreen 上展示“关键资源加载进度”？（当前计划不实现）
