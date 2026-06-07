## Context
当前图片链路分为三层但职责重叠：

- `AssetLoader` 负责资源基址、语言化路径、压缩路径、预加载缓存、后台 ready 通知。
- `OptimizedImage` 自己维护 fallbackLevel、自动重试、候选超时、开发态 blob fetch、loaded/errored 状态。
- `CardPreview` 的 atlas 分支又维护一套候选加载、in-flight 去重、retry、activeUrl、loaded 状态。

用户日志中的 `Failed to load resource: net::ERR_FILE_NOT_FOUND` 与多次 `OptimizedImage 加载失败，尝试回退`，符合“已失败 primary 被重新挂载后再次作为首选候选”的故障模式。移动端视角切换会造成玩家面板组件卸载/重挂载，因此这种重复状态机会被放大为主面板短暂空白、放大图等待数秒和帧率抖动。

## Goals
- 单一来源：候选 URL 顺序、成功候选、失败候选、重试退避统一由共享层维护。
- 稳定复用：同一逻辑资源在同一 locale/base 下，一旦某个候选成功，后续挂载必须优先使用该真实 URL。
- 可降级：远端失败时可以回退本地 `/assets` 或已安装包路径；失败不会让 UI 永久空白。
- 可验证：单测覆盖核心状态机，组件测试覆盖重新挂载和图集裁切场景。

## Non-Goals
- 不改变资源目录结构。
- 不改变现有 `src`/`previewRef` 对外 API。
- 不在游戏层为 DiceThrone 写专用图片特判。
- 不把 CSS background 装饰图强行迁移为 `OptimizedImage`，只处理关键图片/图集链路。

## Decisions
- Decision: 在 `AssetLoader` 内新增共享图片资源运行时模型，提供逻辑资源 key、候选 URL 列表、当前推荐 URL、成功记录、失败推进与 in-flight 去重。
- Decision: `markImageLoaded(logicalSrc, locale, img)` 必须同时缓存逻辑资源和真实 `currentSrc/src`，并把真实成功候选作为后续首选。
- Decision: `OptimizedImage` 应从共享层读取当前推荐 URL；自身只保留 React DOM 生命周期状态，不再决定全局候选顺序。
- Decision: `CardPreview` atlas 加载应复用共享候选加载 helper，`activeUrl` 只来自共享层命中或本次加载成功结果。
- Decision: 失败候选的自动重试必须有上限与退避，并按逻辑资源维度记忆，避免每次视角切换都重新从第一个失败候选开始。

## Risks / Trade-offs
- 风险：集中状态机修改面较广，可能影响 SmashUp/SummonerWars/Splendor 的图集显示。
  - Mitigation: 先保留现有外部 API，测试覆盖 image 与 atlas 两条消费路径。
- 风险：持久化“成功候选”可能在资源 base 变更后指向旧 URL。
  - Mitigation: cache key 必须包含逻辑资源、locale、候选相对路径或版本 hash；base/locale 变化时重新解析。
- 风险：组件内开发态 blob fetch 与共享加载状态冲突。
  - Mitigation: 将 blob fetch 限定为渲染层实现细节，成功后仍回灌共享层真实 URL。

## Migration Plan
1. 在 `AssetLoader` 增加共享候选状态 API，并为现有 `getLocalizedImageCandidateUrls`、`markImageLoaded`、`isImagePreloaded` 保持兼容。
2. 将 `OptimizedImage` 改为消费共享推荐 URL 和失败推进 API，删除会把 fallback 拉回 primary 的本地状态耦合。
3. 将 `CardPreview` atlas 分支改为复用共享候选加载与命中恢复逻辑，保留裁切计算逻辑。
4. 补单测和组件测试后，再考虑清理冗余 helper。

## Open Questions
- 是否保留 localStorage 级 ready hints，还是仅保留内存级成功候选？建议本轮保留，但必须让其只作为“跳过 shimmer 的 hint”，不能替代真实 URL 命中。
