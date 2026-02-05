# Spec: 音频路径自动插入 compressed/

## 背景

### 当前问题

**图片路径**（已实现）：
```typescript
// 配置中不含 compressed/
thumbnailPath: 'dicethrone/thumbnails/fengm'

// getOptimizedImageUrls() 自动处理
→ '/assets/dicethrone/thumbnails/compressed/fengm.avif'
→ '/assets/dicethrone/thumbnails/compressed/fengm.webp'
```

**音频路径**（当前）：
```typescript
// ❌ 配置中必须手动写 compressed/
dice_roll: { src: 'dice/compressed/Dice_Roll_Velvet_001.ogg' }

// assetsPath() 直接拼接
→ '/assets/common/audio/dice/compressed/Dice_Roll_Velvet_001.ogg'
```

### 架构问题

1. **不一致**：图片自动插入 `compressed/`，音频需要手动写
2. **维护性差**：如果未来改变压缩策略（如改目录名），需要修改所有音频配置
3. **易出错**：开发者容易忘记写 `compressed/` 或与图片规则混淆
4. **技术债务**：违反 DRY 原则，压缩路径逻辑分散在配置中

---

## 目标

### 功能目标

1. **统一架构**：图片和音频使用相同的路径处理模式
2. **自动化**：配置中只写原始路径，框架自动插入 `compressed/`
3. **可维护**：压缩策略集中管理，未来修改只需改一处

### 非目标

1. 不改变音频文件的物理存储结构（仍在 `compressed/` 子目录）
2. 不改变 `AudioManager` 的核心 API（保持向后兼容）
3. 不引入新的第三方库

---

## 设计方案

### 1. 新增 `getOptimizedAudioUrl()` 函数

**位置**：`src/core/AssetLoader.ts`

**功能**：类似 `getOptimizedImageUrls()`，自动插入 `compressed/` 子目录

**实现**：
```typescript
/**
 * 获取优化音频 URL
 * 自动插入 compressed/ 子目录
 * 
 * @param src 音频相对路径（不含 compressed/）
 * @param basePath 可选的基础路径
 * @returns 完整的音频 URL
 * 
 * @example
 * getOptimizedAudioUrl('dice/Dice_Roll.ogg', 'common/audio')
 * → '/assets/common/audio/dice/compressed/Dice_Roll.ogg'
 */
export function getOptimizedAudioUrl(src: string, basePath?: string): string {
    if (!isString(src) || !src) {
        return '';
    }
    
    // 穿透源（data:/blob:/http:）直接返回
    if (isPassthroughSource(src)) {
        return src;
    }
    
    // 拼接 basePath（如果提供）
    const fullPath = basePath 
        ? `${basePath.replace(/\/$/, '')}/${src.replace(/^\//, '')}`
        : src;
    
    // 规范化为 /assets/ 路径
    const normalized = assetsPath(fullPath);
    
    // 插入 compressed/ 子目录
    const lastSlash = normalized.lastIndexOf('/');
    const dir = lastSlash >= 0 ? normalized.substring(0, lastSlash) : '';
    const filename = lastSlash >= 0 ? normalized.substring(lastSlash + 1) : normalized;
    
    return dir 
        ? `${dir}/${COMPRESSED_SUBDIR}/${filename}` 
        : `${COMPRESSED_SUBDIR}/${filename}`;
}
```

### 2. 修改 `AudioManager.buildAudioSrc()`

**位置**：`src/lib/audio/AudioManager.ts`

**修改前**：
```typescript
const buildAudioSrc = (basePath: string, src: string) => {
    if (isPassthroughSource(src)) {
        return src;
    }
    if (!basePath) {
        return assetsPath(src);  // ❌ 不处理 compressed/
    }
    const trimmed = src.startsWith('/') ? src.slice(1) : src;
    return `${basePath}${trimmed}`;
};
```

**修改后**：
```typescript
const buildAudioSrc = (basePath: string, src: string) => {
    if (isPassthroughSource(src)) {
        return src;
    }
    return getOptimizedAudioUrl(src, basePath);  // ✅ 自动处理 compressed/
};
```

### 3. 清理所有音频配置中的 `compressed/`

**影响文件**：
- `src/lib/audio/common.config.ts`
- `src/games/dicethrone/audio.config.ts`
- `src/games/tictactoe/audio.config.ts`

**修改示例**：
```typescript
// 修改前
sounds: {
    dice_roll: { src: 'dice/compressed/Dice_Roll_Velvet_001.ogg', volume: 0.8 },
    card_draw: { src: 'card/compressed/Card_Take_001.ogg', volume: 0.7 },
}

// 修改后
sounds: {
    dice_roll: { src: 'dice/Dice_Roll_Velvet_001.ogg', volume: 0.8 },
    card_draw: { src: 'card/Card_Take_001.ogg', volume: 0.7 },
}
```

---

## 迁移计划

### 阶段 1：实现新函数（无破坏性）

1. 在 `AssetLoader.ts` 中实现 `getOptimizedAudioUrl()`
2. 添加单元测试验证路径转换逻辑
3. 确保与 `getOptimizedImageUrls()` 行为一致

### 阶段 2：修改 AudioManager（破坏性）

1. 修改 `buildAudioSrc()` 使用新函数
2. 运行现有测试，确认路径生成正确
3. 手动测试音频播放功能

### 阶段 3：清理配置文件（破坏性）

1. 批量移除所有音频配置中的 `compressed/`
2. 更新相关测试的路径断言
3. 全量回归测试

### 阶段 4：文档更新

1. 更新 `AGENTS.md` 中的音频路径规范
2. 统一图片和音频的使用说明
3. 添加迁移指南（如果有外部开发者）

---

## 测试计划

### 单元测试

**测试文件**：`src/core/__tests__/AssetLoader.audio.test.ts`

```typescript
describe('getOptimizedAudioUrl', () => {
    it('应该自动插入 compressed/ 子目录', () => {
        const url = getOptimizedAudioUrl('dice/Dice_Roll.ogg', 'common/audio');
        expect(url).toBe('/assets/common/audio/dice/compressed/Dice_Roll.ogg');
    });

    it('应该处理没有 basePath 的情况', () => {
        const url = getOptimizedAudioUrl('sound.ogg');
        expect(url).toBe('/assets/compressed/sound.ogg');
    });

    it('应该直接返回穿透源', () => {
        const dataUrl = 'data:audio/ogg;base64,xxx';
        expect(getOptimizedAudioUrl(dataUrl)).toBe(dataUrl);
        
        const httpUrl = 'https://example.com/sound.ogg';
        expect(getOptimizedAudioUrl(httpUrl)).toBe(httpUrl);
    });

    it('应该处理空路径', () => {
        expect(getOptimizedAudioUrl('')).toBe('');
        expect(getOptimizedAudioUrl(null as any)).toBe('');
    });
});
```

### 集成测试

**测试文件**：`src/lib/audio/__tests__/AudioManager.path.test.ts`

```typescript
describe('AudioManager 路径处理', () => {
    it('应该正确加载通用音效', () => {
        const manager = new AudioManagerClass();
        manager.loadGameAudio('common', COMMON_AUDIO_CONFIG);
        
        // 验证内部路径是否正确
        const sound = manager['sounds'].get('dice_roll');
        expect(sound).toBeDefined();
        // 注意：Howl 内部路径不可直接访问，需要通过其他方式验证
    });
});
```

### 手动测试清单

- [ ] 通用音效播放正常（骰子、卡牌、UI）
- [ ] 游戏特定音效播放正常（DiceThrone、TicTacToe）
- [ ] BGM 播放正常
- [ ] 音频加载失败时有正确的错误提示
- [ ] 浏览器 Network 面板显示正确的请求路径

---

## 风险与缓解

### 风险 1：路径转换错误导致音频加载失败

**影响**：所有音频无法播放

**缓解**：
1. 充分的单元测试覆盖边界情况
2. 分阶段部署，先在开发环境验证
3. 保留回滚方案（Git revert）

### 风险 2：遗漏部分音频配置文件

**影响**：部分音频仍使用旧路径，导致路径重复

**缓解**：
1. 使用 `grepSearch` 全局搜索 `compressed/` 关键词
2. 添加 ESLint 规则检测音频配置中的 `compressed/`
3. 代码审查时重点检查

### 风险 3：第三方音频源（http:/data:）处理不当

**影响**：外部音频无法播放

**缓解**：
1. `isPassthroughSource()` 检测并直接返回
2. 单元测试覆盖穿透源场景

---

## 验收标准

### 功能验收

- [x] `getOptimizedAudioUrl()` 函数实现并通过单元测试
- [ ] `AudioManager` 使用新函数处理路径
- [ ] 所有音频配置移除 `compressed/` 路径
- [ ] 所有音频在浏览器中正常播放
- [ ] 浏览器 Network 面板显示正确的请求路径（含 `compressed/`）

### 代码质量

- [ ] 单元测试覆盖率 > 90%
- [ ] 无 TypeScript 类型错误
- [ ] 无 ESLint 警告
- [ ] 代码审查通过

### 文档完整性

- [ ] `AGENTS.md` 更新音频路径规范
- [ ] 函数添加 JSDoc 注释
- [ ] 迁移指南完整

---

## 后续优化

### 可选优化 1：统一 `getOptimizedUrl()` 函数

将图片和音频的路径处理逻辑合并为一个通用函数：

```typescript
export function getOptimizedUrl(
    src: string, 
    type: 'image' | 'audio',
    basePath?: string
): string | ImageUrlSet {
    // 统一处理逻辑
}
```

### 可选优化 2：路径缓存

对频繁调用的路径转换结果进行缓存，提升性能：

```typescript
const pathCache = new Map<string, string>();

export function getOptimizedAudioUrl(src: string, basePath?: string): string {
    const cacheKey = `${basePath}:${src}`;
    if (pathCache.has(cacheKey)) {
        return pathCache.get(cacheKey)!;
    }
    // ... 转换逻辑
    pathCache.set(cacheKey, result);
    return result;
}
```

---

## 参考资料

- [图片路径修复证据](../../../evidence/image-path-fix.md)
- [AssetLoader 实现](../../../src/core/AssetLoader.ts)
- [AudioManager 实现](../../../src/lib/audio/AudioManager.ts)
- [AGENTS.md 资源规范](../../../AGENTS.md#图片资源与使用规范)
