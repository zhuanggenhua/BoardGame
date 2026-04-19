# 音频路径架构对齐 - 补充到 refactor-audio-common-layer 提案

## 背景

在修复图片路径问题时（见 `evidence/image-path-fix.md`），发现音频路径处理与图片不一致：

- **图片**：配置中不含 `compressed/`，由 `getOptimizedImageUrls()` 自动插入
- **音频**：配置中必须手动写 `compressed/`，由 `assetsPath()` 直接拼接

这种不一致导致：
1. 架构混乱：同一类资源（压缩资产）使用不同的处理方式
2. 易出错：开发者容易混淆两种规则
3. 维护性差：未来修改压缩策略需要改多处

## 解决方案

将音频路径处理对齐到图片的模式，统一由框架层自动插入 `compressed/`。

## 补充内容

已将以下内容补充到 `openspec/changes/refactor-audio-common-layer/` 提案：

### 1. 设计文档更新 (`design.md`)

**新增 Decision**：
```markdown
- Decision: 音频路径自动插入 `compressed/` 子目录（与图片一致）
  - Why: 
    - 架构一致性：图片已通过 `getOptimizedImageUrls()` 自动处理，音频应保持相同模式
    - 可维护性：压缩策略统一管理，未来修改目录结构只需改一处
    - 易用性：开发者无需记住特殊规则，配置中只写原始路径
  - 实现：新增 `getOptimizedAudioUrl()` 函数，`AudioManager` 使用该函数处理路径
```

**新增 Technical Details 章节**：
- 当前问题说明
- 解决方案代码示例
- 迁移前后对比

**更新 Migration Plan**：
- 步骤 3：实现音频路径自动处理
- 步骤 4：移除所有音频配置中的硬编码 `compressed/` 路径

### 2. 任务清单更新 (`tasks.md`)

**新增任务**：
- 1.2 实现 `getOptimizedAudioUrl()` 函数
- 1.3 修改 `AudioManager.buildAudioSrc()` 使用新函数
- 1.5 移除所有音频配置中的硬编码 `compressed/` 路径
  - `src/lib/audio/common.config.ts`
  - `src/games/dicethrone/audio.config.ts`
  - `src/games/tictactoe/audio.config.ts`
- 1.9 更新相关测试（路径断言需调整）

### 3. 详细规范文档 (`specs/audio-path-auto-compression.md`)

创建了完整的实施规范，包含：

#### 背景与问题
- 当前图片和音频的路径处理差异
- 架构问题分析

#### 设计方案
- `getOptimizedAudioUrl()` 函数实现
- `AudioManager.buildAudioSrc()` 修改
- 配置文件清理示例

#### 迁移计划
- 4 个阶段的详细步骤
- 每个阶段的验收标准

#### 测试计划
- 单元测试用例
- 集成测试用例
- 手动测试清单

#### 风险与缓解
- 3 个主要风险点
- 对应的缓解措施

#### 验收标准
- 功能验收清单
- 代码质量要求
- 文档完整性检查

#### 后续优化
- 统一 `getOptimizedUrl()` 函数
- 路径缓存优化

### 4. AGENTS.md 更新

**更新音频路径规范章节**：
- 标注当前规范为"临时"
- 说明未来规范（与图片一致）
- 引用相关提案文档

## 实施时机

建议在 `refactor-audio-common-layer` 提案的实施过程中，按以下顺序执行：

1. **阶段 1**：实现 `getOptimizedAudioUrl()` 函数（无破坏性）
2. **阶段 2**：修改 `AudioManager`（破坏性，需测试）
3. **阶段 3**：清理所有音频配置（破坏性，需全量回归）
4. **阶段 4**：更新文档

## 预期收益

1. **架构一致性**：图片和音频使用统一的路径处理模式
2. **可维护性**：压缩策略集中管理，未来修改成本低
3. **易用性**：开发者无需记住特殊规则
4. **技术债务清理**：消除历史遗留的不一致问题

## 影响范围

### 代码修改
- `src/core/AssetLoader.ts` - 新增函数
- `src/lib/audio/AudioManager.ts` - 修改路径处理
- `src/lib/audio/common.config.ts` - 移除 `compressed/`
- `src/games/dicethrone/audio.config.ts` - 移除 `compressed/`
- `src/games/tictactoe/audio.config.ts` - 移除 `compressed/`
- 相关测试文件

### 文档更新
- `AGENTS.md` - 统一资源路径规范
- 提案文档 - 补充技术细节

### 测试要求
- 单元测试：路径转换逻辑
- 集成测试：音频加载与播放
- 手动测试：全量音效回归

## 相关文档

- [图片路径修复证据](./image-path-fix.md)
- [音频路径自动压缩规范](../openspec/changes/refactor-audio-common-layer/specs/audio-path-auto-compression.md)
- [音频重构提案设计](../openspec/changes/refactor-audio-common-layer/design.md)
- [音频重构任务清单](../openspec/changes/refactor-audio-common-layer/tasks.md)

## 日期

2026-02-04
