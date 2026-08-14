---
name: critical-image-preload
description: 关键图片预加载：critical/warm 分层、图集初始化和教程裁剪——改预加载链路时查
metadata:
  type: doc
  status: 已交付
---

# 关键图片预加载规范

> 来源：从 `.spec/knowledge/standards/asset-pipeline.md` 无损拆出。本文档承载 `criticalImageResolver`、两阶段预加载、教程模式资源裁剪和图集初始化规则；`asset-pipeline.md` 只保留入口摘要。

## 关键图片预加载规范（criticalImageResolver）

> **触发条件**：新增游戏、新增角色/派系、修改游戏 Board 中使用的图片资源时必读。

### 机制概述

项目采用**两阶段预加载**策略，防止进入对局时出现白屏/闪烁：

- **关键图片（critical）**：阻塞渲染，加载完成前显示 LoadingScreen，10 秒超时后放行
- **暖图片（warm）**：后台异步加载，不阻塞对局渲染

门禁落在 `MatchRoom` 入口层，各游戏通过 `criticalImageResolver.ts` 提供动态解析。

**locale 处理**：
- `CriticalImageGate` 从 `GameBoardProps` 提取 `locale` 参数（默认 `zh-CN`）
- 传递给 `preloadCriticalImages` 和 `preloadWarmImages`
- 预加载函数自动将路径转换为 `i18n/{locale}/` 格式
- 精灵图初始化函数（如 `initSpriteAtlases`）也需要接收 `locale` 参数并传递给 `getLocalizedAssetPath`

### 强制规则

1. **有素材不等于已接好加载链**：正式图片已经落盘、压缩、进入 manifest，只能证明资源存在；只要 Board、设置弹窗、持有区、卡牌网格、帮助面板或结算区会消费该图片，就必须同时接入 `criticalImageResolver`，否则不能按“图片已接入运行时”收口。
2. **Board 中使用的所有图片必须出现在 criticalImageResolver 中**：要么在 `critical` 列表（首屏必需），要么在 `warm` 列表（后台预取）。
3. **加载慢排查不得替换问题对象（强制）**：用户反馈“某张图 / 某类图加载慢”时，动 `critical` / `warm` 前必须先锁定实际慢的是哪一侧、哪一个玩家视角、哪类资源以及真实请求路径；没有网络请求、截图、日志或资源加载状态证据时，不得把“自己的骰子加载慢”改写成“对手骰子慢”，也不得把未命中的资源提升到 `critical` 当作修复。
4. **关闭图片占位必须有预加载证据**：`OptimizedImage` 默认 shimmer 占位不得随手关闭。只有已经进入 `critical`、进入首屏前必定加载完成，或该位置另有稳定骨架/明确空态时，才允许 `placeholder={false}`。按需打开的弹窗、规则卡网格、工具/专家牌列表、帮助页图片默认保留占位效果，即使图片也在 `warm` 中。
5. **预加载路径必须能落到真实压缩文件或 manifest 远端条目**：新增/修改 `criticalImageResolver` 时，必须有测试或脚本核对每个路径不含 `compressed/`，并能解析到本地 `compressed/*.webp`、图集配置、或已登记的远端 manifest 条目；禁止把不存在的候选路径加入 critical/warm。
6. **首屏可见的图片必须放 critical**：背景图、玩家面板、提示板、地图等进入对局立即可见的资源。
7. **按需加载的图片放 warm**：未选角色/派系的资源、非首屏展示的图集。
8. **路径格式与图片引用一致**：相对于 `/assets/`，不含 `compressed/`（预加载 API 内部自动处理）。
9. **解析器必须按游戏阶段动态返回**：选角/选派系阶段 vs 游戏进行阶段，关键资源不同。
10. **phaseKey 必须稳定**：`CriticalImageGate` 依据 `phaseKey` 判断是否重新预加载，未变化时不会重复触发。
11. **教程模式 setup 阶段跳过全量选角资源（强制）**：教程会自动执行 aiActions（SELECT_CHARACTER/SELECT_FACTION + HOST_START_GAME），用户看不到选角界面。resolver 必须检查 `state.sys?.tutorial?.active === true`，在教程 setup 阶段只返回通用资源（背景/地图等），不预加载全部角色/阵营的选角资源。等 aiActions 执行完进入 playing 阶段后，再按实际选角结果预加载。
12. **教程模式 playing 阶段只加载已选阵营/角色/派系的资源（强制）**：教程阵营/角色/派系固定，未选的永远不会出现。resolver 在教程 playing 阶段必须只加载已选项对应的图集，`warm` 为空数组，避免浪费连接和带宽。各游戏实现方式：
   - **DiceThrone**：按角色独立打包，只加载已选角色图集
   - **SummonerWars**：按阵营独立打包，只加载已选阵营图集
   - **SmashUp**：多派系共享图集，通过 `FACTION_CARD_ATLAS` / `FACTION_BASE_ATLAS` 映射表只加载包含已选派系的图集（如教程恐龙+米斯卡塔尼克 vs 机器人+巫师 → 只需 cards1/cards2/cards4 + base1/base4，跳过 cards3/base2/base3）
13. **音频预加载等待关键图片彻底完成（强制）**：`AudioManager.preloadKeys` 在每批加载前调用 `waitForCriticalImages()`（`AssetLoader` 导出的全局信号），等关键图片预加载完成后再通过 `requestIdleCallback` + 小批量（每批 2 个）空闲调度发起音频 XHR。信号由 `preloadCriticalImages` 完成时 resolve，`CriticalImageGate` 快速路径（缓存命中）和 `enabled=false` 时也会 resolve。`resetCriticalImagesSignal` 不 resolve 旧 Promise（避免音频提前开始），`preloadKeys` 每批重新获取最新信号。15s 保底超时防止异常阻塞。
14. **warm 预加载取消恢复机制（框架层保证）**：`cancelWarmPreload()` 取消当前 warm 队列时，未完成的路径会被暂存到 `_pendingWarmPaths`。下一次 `preloadWarmImages()` 调用时自动合并暂存路径（已加载的由 `preloadOptimizedImage` 内部跳过）。保证 warm 资源"延迟但不丢失"——任何游戏的 phaseKey 变化触发二次预加载时，第一轮被取消的 warm 资源会在第二轮 critical 完成后自动恢复加载。
15. **图集加载最佳实践 / 精灵图初始化（统一模式）**：
   - **均匀网格**：使用 `registerLazyCardAtlasSource(id, { image, grid: { rows, cols } })`，尺寸从 `CriticalImageGate` 预加载缓存中的 `HTMLImageElement.naturalWidth/Height` 自动解析，零配置文件、零额外网络请求。SmashUp 和 SummonerWars 均使用此模式。
   - **不规则网格**：使用 `registerCardAtlasSource(id, { image, config })`，config 从静态 JSON 文件 import（构建时内联）。DiceThrone 使用此模式（`ability-cards-common.atlas.json`）。
   - **注册时机**：所有游戏在模块顶层同步注册（`initXxxAtlases()`），确保首帧渲染时 atlas 已可用。禁止在 `useEffect` 中异步注册。
   - **SummonerWars 的 `initSpriteAtlases(locale)`**：同时注册 `cardAtlasRegistry`（懒解析）和 `globalSpriteAtlasRegistry`（即时解析），后者需要 locale 构建完整 URL，必须在组件 `useEffect` 中调用并监听 `i18n.language`。
   - **图片资源需要国际化**：图片路径通过 `getLocalizedAssetPath` 或组件自动处理 `/i18n/{locale}/` 前缀。图集注册时 `image` 字段传相对路径，渲染层（`buildLocalizedImageSet`）按语言解析 URL。

### 解析器模板

```typescript
import type { CriticalImageResolver, CriticalImageResolverResult } from '../../core/types';
import type { MatchState } from '../../engine/types';

export const <gameId>CriticalImageResolver: CriticalImageResolver = (
    gameState: unknown,
): CriticalImageResolverResult => {
    const state = gameState as MatchState<YourCoreType>;
    const core = state?.core;
    // 1. 无状态时：预加载选择界面所需资源
    // 2. 选择阶段：
    //    - 教程模式（state.sys?.tutorial?.active）→ 只返回通用资源，跳过全量选角
    //    - 正常模式 → 所有可选项的预览图为 critical
    // 3. 游戏进行中：已选项的完整资源为 critical，未选项放 warm
    return {
        critical: [...],
        warm: [...],
        phaseKey: 'setup',
    };
};
```

### 注册方式

在游戏入口 `index.ts` 中注册：

```typescript
import { registerCriticalImageResolver } from '../../core';
import { <gameId>CriticalImageResolver } from './criticalImageResolver';

registerCriticalImageResolver('<gameId>', <gameId>CriticalImageResolver);
```

### 各游戏 critical 资源清单参考

| 游戏 | 选择阶段 critical | 游戏阶段 critical |
|------|-------------------|-------------------|
| DiceThrone | 背景图、卡背、头像图集、所有角色 player-board + tip | 背景图、卡背、头像图集、已选角色 player-board + tip + ability-cards + dice + status-icons-atlas |
| SummonerWars | 地图、卡背、所有阵营 hero 图集 | 地图、卡背、传送门、骰子、已选阵营 hero + cards 图集 |
| SmashUp | 所有卡牌图集（4个） | 已选派系卡牌图集 + 已选派系基地图集（教程）；全部卡牌+基地图集（正常） |

### 新增角色/派系检查清单

- [ ] 新资源路径已加入 `criticalImageResolver.ts` 的对应阶段
- [ ] 选择阶段：预览图（player-board/hero/tip）在 critical 中
- [ ] 游戏阶段：完整资源（卡牌图集/骰子/状态图标）在 critical 中
- [ ] 教程模式 setup 阶段：检查 `sys.tutorial.active`，只返回通用资源
- [ ] 精灵图初始化函数已支持 `locale` 参数（从 Board props 提取并传递）
- [ ] 系统 A 注册时调用 `getLocalizedAssetPath` → `getOptimizedImageUrls`
- [ ] 系统 B 注册时传递原始路径（不调用 `getLocalizedAssetPath`）
- [ ] 所有 `placeholder={false}` 都有对应 `critical` 预加载、稳定骨架或明确空态证据；按需弹窗/卡牌网格默认不得关闭占位
- [ ] 测试覆盖 critical/warm 路径不含 `compressed/`，且能解析到本地压缩文件或 manifest 远端条目
- [ ] 运行相关单测：`npm test -- criticalImageResolver`

### 参考实现

- `src/games/dicethrone/criticalImageResolver.ts` — 按角色 + 游戏阶段动态解析
- `src/games/summonerwars/criticalImageResolver.ts` — 按阵营 + 游戏阶段动态解析
- `src/games/smashup/criticalImageResolver.ts` — 按派系图集分组
