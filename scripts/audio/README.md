# 音频注册表生成脚本

## generate-slim-registry.mjs

生成精简版音频注册表，供运行时使用。

### 性能优化

- **优化前**：~25 秒（逐个匹配 10000+ 条音效）
- **优化后**：
  - 首次生成：~0.3 秒（正则一次性提取）
  - 缓存命中：~0.1 秒（跳过生成）

### 优化策略

1. **缓存机制**：基于源码文件 mtime 和 registry.json mtime 的哈希缓存
2. **正则优化**：一次性提取所有音效 key，避免逐个 `includes()` 匹配
3. **智能跳过**：源码和 registry 未变更时直接跳过生成

### 用法

```bash
# 正常生成（自动使用缓存）
node scripts/audio/generate-slim-registry.mjs
# 或
npm run audio:slim

# 强制重新生成（忽略缓存）
node scripts/audio/generate-slim-registry.mjs --force

# 验证生成结果的正确性
node scripts/audio/verify-slim-registry.mjs
# 或
npm run audio:verify
```

### 触发时机

- `npm run dev` 前（predev hook）— **已添加**
- `npm run build` 前（prebuild hook）
- `git push` 前（pre-push hook）
- 手动运行 `npm run audio:slim`

### 性能影响

- **首次生成**：~0.3 秒（可忽略）
- **缓存命中**：~0.1 秒（几乎无感知）
- **对开发流程的影响**：微乎其微，不会拖慢 `npm run dev` 启动速度

### 缓存位置

`node_modules/.cache/audio-slim-registry.json`（已在 .gitignore 中）

### 输出

- **输入**：`src/assets/audio/registry.json`（~3.2 MB，10000+ 条）
- **输出**：`src/assets/audio/registry-slim.json`（~14 KB，~60 条）
- **缩减**：99.6%
