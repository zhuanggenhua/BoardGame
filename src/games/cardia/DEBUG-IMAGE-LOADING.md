# Cardia 图片加载问题诊断指南

## 问题描述
五张卡牌有时可以加载，有时加载不出。这是典型的**异步加载竞态**或**网络不稳定**问题。

## 诊断步骤

### 1. 打开浏览器开发者工具
按 `F12` 或右键点击页面 → "检查"

### 2. 查看控制台日志
切换到 **Console** 面板，查找以下日志：

#### 正常加载的日志：
```
[CardDisplay] 加载图片: { cardUid: "...", defId: "...", imagePath: "cardia/cards/deck1/1", loaded: false, error: false }
[CardDisplay] 图片加载成功: deck_i_card_01 cardia/cards/deck1/1
```

#### 加载失败的日志：
```
[CardDisplay] 图片加载失败: deck_i_card_01 cardia/cards/deck1/1
[OptimizedImage] 图片加载失败（将尝试备选格式）: https://...
```

### 3. 查看网络请求
切换到 **Network** 面板：

1. 刷新页面
2. 在过滤器中输入 `.webp`
3. 查看所有图片请求

#### 检查项：
- **状态码**：应该全部是 `200 OK`
- **大小**：应该显示实际文件大小（如 270 KB），而不是 `(from disk cache)` 或 `(failed)`
- **时间**：加载时间应该在合理范围内（< 1s）

### 4. 识别问题类型

#### 问题 A: 部分图片 404
**症状：** Network 面板显示某些图片返回 404
**原因：** 文件路径错误或文件不存在
**解决：**
```bash
# 检查文件是否存在
ls public/assets/i18n/zh-CN/cardia/cards/deck1/compressed/
ls public/assets/i18n/zh-CN/cardia/cards/deck2/compressed/

# 运行路径验证
node scripts/test-cardia-image-paths.mjs
```

#### 问题 B: 图片加载超时
**症状：** Network 面板显示请求 pending 很久，最后失败
**原因：** 网络慢或 CDN 不可用
**解决：**
1. 检查网络连接
2. 检查是否使用了 CDN（查看 `.env` 中的 `VITE_ASSETS_BASE_URL`）
3. 如果使用 CDN，尝试切换到本地资源：
   ```bash
   # .env 文件中注释掉或删除 VITE_ASSETS_BASE_URL
   # VITE_ASSETS_BASE_URL=https://assets.easyboardgame.top/official
   ```

#### 问题 C: 随机加载失败（竞态条件）
**症状：** 
- 刷新页面后，每次失败的卡牌不同
- Console 显示 "图片加载超时（30000ms），跳过"
- Network 面板显示请求被取消（canceled）

**原因：** 浏览器并发连接数限制（HTTP/1.1 同域最多 6 个并发）
**解决：** 见下文"优化方案"

#### 问题 D: 图片闪烁或 shimmer 不消失
**症状：** 卡牌显示灰色 shimmer 动画，但图片实际已加载
**原因：** React 状态更新问题或 OptimizedImage 的 onLoad 回调未触发
**解决：** 见下文"优化方案"

## 临时调试功能

我已经在 `CardDisplay` 组件中添加了调试功能：

### 视觉指示器
- **黄色圆点**（右上角）：图片正在加载中
- **红色圆点**（右上角）：图片加载失败
- **无圆点**：图片加载成功

### 控制台日志
每张卡牌的加载状态都会输出到控制台，包括：
- `cardUid`: 卡牌实例 ID
- `defId`: 卡牌定义 ID
- `imagePath`: 图片路径
- `loaded`: 是否加载成功
- `error`: 是否加载失败

## 优化方案

### 方案 1: 预加载关键图片（推荐）

在游戏开始前预加载所有卡牌图片，避免运行时加载竞态。

**实现位置：** `src/games/cardia/manifest.ts`

需要添加 `criticalImages` 配置，列出所有需要预加载的图片路径。

### 方案 2: 增加图片加载超时时间

如果网络较慢，可以增加单张图片的加载超时时间。

**修改位置：** `src/core/AssetLoader.ts`
```typescript
// 当前值：30000ms (30秒)
const SINGLE_IMAGE_TIMEOUT_MS = 30_000;

// 可以增加到 60 秒
const SINGLE_IMAGE_TIMEOUT_MS = 60_000;
```

### 方案 3: 禁用 CDN，使用本地资源

如果 CDN 不稳定，可以临时使用本地资源。

**修改 `.env` 文件：**
```bash
# 注释掉 CDN 配置
# VITE_ASSETS_BASE_URL=https://assets.easyboardgame.top/official

# 或者改为本地路径
VITE_ASSETS_BASE_URL=/assets
```

### 方案 4: 减少并发加载数量

如果是浏览器并发限制导致的问题，可以减少同时加载的图片数量。

**实现方式：** 使用虚拟滚动或懒加载，只加载可见区域的卡牌图片。

## 快速测试命令

### 测试本地文件是否存在
```bash
# 测试所有路径
node scripts/test-cardia-image-paths.mjs

# 手动测试单个文件
curl -I http://localhost:3000/assets/i18n/zh-CN/cardia/cards/deck1/compressed/1.webp
```

### 测试 CDN 可用性（如果使用 CDN）
```bash
curl -I https://assets.easyboardgame.top/official/i18n/zh-CN/cardia/cards/deck1/compressed/1.webp
```

### 清除浏览器缓存
```
Chrome/Edge: Ctrl+Shift+Delete
Firefox: Ctrl+Shift+Delete
Safari: Cmd+Option+E
```

或者使用无痕模式测试。

## 收集诊断信息

如果问题持续存在，请收集以下信息：

1. **浏览器控制台截图**（Console 面板，显示所有日志）
2. **Network 面板截图**（筛选 .webp，显示所有请求状态）
3. **失败的图片请求详情**：
   - 请求 URL
   - 状态码
   - 响应头
   - 时间线（Timing）
4. **环境信息**：
   - 浏览器版本
   - 操作系统
   - 网络环境（本地/公司网络/移动网络）
   - 是否使用 VPN 或代理

## 常见问题 FAQ

### Q: 为什么刷新后每次失败的卡牌不同？
**A:** 这是典型的并发加载竞态问题。浏览器对同域名的并发连接数有限制（HTTP/1.1 为 6 个），当同时加载多张图片时，超出限制的请求会排队等待。如果某个请求超时，就会导致随机的卡牌加载失败。

**解决方案：** 使用预加载机制，在游戏开始前就加载好所有图片。

### Q: 为什么有时全部加载成功，有时部分失败？
**A:** 可能的原因：
1. **网络波动**：网络速度不稳定
2. **CDN 不稳定**：CDN 节点响应慢或失败
3. **浏览器缓存**：有缓存时加载快，无缓存时加载慢

**解决方案：** 
- 使用本地资源（禁用 CDN）
- 增加超时时间
- 实现预加载机制

### Q: 图片文件明明存在，为什么还是加载失败？
**A:** 可能的原因：
1. **路径大小写问题**：Linux 服务器区分大小写，Windows 不区分
2. **文件权限问题**：文件没有读取权限
3. **Vite 开发服务器缓存**：重启 Vite 服务器试试

**解决方案：**
```bash
# 检查文件权限
ls -la public/assets/i18n/zh-CN/cardia/cards/deck1/compressed/

# 重启开发服务器
# Ctrl+C 停止，然后重新运行
npm run dev
```

### Q: 生产环境和开发环境表现不同？
**A:** 开发环境使用 Vite 开发服务器，生产环境可能使用 CDN。检查：
1. `.env` 和 `.env.production` 的配置差异
2. CDN 是否已上传所有图片
3. CDN 路径是否正确

---

**最后更新：** 2026-02-27  
**相关文档：** `IMAGE-FIX-COMPLETE.md`, `HOW-TO-VERIFY-IMAGE-FIX.md`
