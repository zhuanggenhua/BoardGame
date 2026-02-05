## Context
当前音频体系以“游戏自带音效”为主，随着游戏数量增长会产生大量重复资源与配置分叉，且难以治理一致性。本次变更要求所有音频资产与配置统一收敛到 common 层，游戏层不再保留音频文件与配置。

## Goals / Non-Goals
- Goals:
  - 所有音频资源只存在于 common 层
  - 音频播放不依赖游戏层配置文件
  - 事件可通过元数据驱动音效选择，覆盖未来多游戏场景
- Non-Goals:
  - 不引入新的第三方音频库
  - 不改变现有音频播放 API 的核心使用方式（保持 AudioManager 能力）

## Decisions
- Decision: 建立统一音频注册表（common.config）作为单一权威来源
  - Why: 避免每游戏复制与命名冲突，统一资源治理
- Decision: 事件携带 audioKey / audioCategory 元数据
  - Why: 让新游戏只需在事件层声明音效语义，无需新增配置文件
- Decision: 对游戏层音频资产/配置执行硬性校验并阻止启动
  - Why: 强制维持单一来源，避免架构回退
- Decision: 音频路径自动插入 `compressed/` 子目录（与图片一致）
  - Why: 
    - 架构一致性：图片已通过 `getOptimizedImageUrls()` 自动处理，音频应保持相同模式
    - 可维护性：压缩策略统一管理，未来修改目录结构只需改一处
    - 易用性：开发者无需记住特殊规则，配置中只写原始路径
  - 实现：新增 `getOptimizedAudioUrl()` 函数，`AudioManager` 使用该函数处理路径

## Alternatives Considered
- 方案 A：允许每游戏覆盖通用音效（否）
  - 违背“全部 common”的约束，容易再次分叉
- 方案 B：保留游戏音频配置但共享资源（否）
  - 仍需维护多份配置，不利于规模化治理

## Risks / Trade-offs
- 风险：新游戏若需独特音效将受限
  - 缓解：通过扩展 common 音效集合与元数据语义来支持更多场景

## Migration Plan
1. 整理并统一所有音效资源到 `public/assets/common/audio`
2. 建立通用音效 key 与分类规范
3. 实现音频路径自动处理（`getOptimizedAudioUrl`）
4. 移除所有音频配置中的硬编码 `compressed/` 路径
5. 事件体系增加 audioKey/audioCategory
6. 移除游戏层音频配置与目录
7. 增加校验与测试，确保不回退

## Technical Details

### 音频路径自动处理

**当前问题**：
```typescript
// ❌ 当前：音频配置需要手动写 compressed/
dice_roll: { src: 'dice/compressed/Dice_Roll_Velvet_001.ogg' }

// ✅ 图片：自动插入 compressed/
thumbnailPath: 'dicethrone/thumbnails/fengm'
→ getOptimizedImageUrls() → '/assets/dicethrone/thumbnails/compressed/fengm.avif'
```

**解决方案**：
```typescript
// src/core/AssetLoader.ts
export function getOptimizedAudioUrl(src: string, basePath?: string): string {
    if (!isString(src) || !src) return '';
    if (isPassthroughSource(src)) return src;
    
    const fullPath = basePath 
        ? `${basePath.replace(/\/$/, '')}/${src.replace(/^\//, '')}`
        : src;
    
    const normalized = assetsPath(fullPath);
    const lastSlash = normalized.lastIndexOf('/');
    const dir = lastSlash >= 0 ? normalized.substring(0, lastSlash) : '';
    const filename = lastSlash >= 0 ? normalized.substring(lastSlash + 1) : normalized;
    
    return dir ? `${dir}/${COMPRESSED_SUBDIR}/${filename}` : `${COMPRESSED_SUBDIR}/${filename}`;
}

// src/lib/audio/AudioManager.ts
const buildAudioSrc = (basePath: string, src: string) => {
    if (isPassthroughSource(src)) return src;
    return getOptimizedAudioUrl(src, basePath);  // 使用新函数
};
```

**迁移后**：
```typescript
// ✅ 配置中移除 compressed/
dice_roll: { src: 'dice/Dice_Roll_Velvet_001.ogg' }
card_draw: { src: 'card/Card_Take_001.ogg' }

// 自动转换为
→ '/assets/common/audio/dice/compressed/Dice_Roll_Velvet_001.ogg'
→ '/assets/common/audio/card/compressed/Card_Take_001.ogg'
```

## Open Questions
- 通用音效 key 是否需要版本化或分组命名规范（如 group.sub.action）
