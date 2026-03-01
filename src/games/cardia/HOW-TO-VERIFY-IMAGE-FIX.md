# 如何验证 Cardia 图片修复

## 快速验证步骤

### 1. 启动开发服务器
```bash
npm run dev
```

等待服务器启动完成，应该看到类似输出：
```
VITE v7.x.x  ready in xxx ms

➜  Local:   http://localhost:3000/
➜  Network: use --host to expose
```

### 2. 访问游戏
在浏览器中打开：`http://localhost:3000`

然后：
1. 点击"开始游戏"或"创建房间"
2. 选择 **Cardia** 游戏
3. 创建房间并开始游戏

### 3. 检查图片显示

**应该看到：**
- ✅ 手牌区域显示卡牌图片（不是空白或占位符）
- ✅ 战场区域显示打出的卡牌图片
- ✅ 卡牌上显示正确的影响力数值和派系颜色

**不应该看到：**
- ❌ 空白的卡牌框
- ❌ 加载中的 shimmer 动画一直不消失
- ❌ 浏览器控制台有 404 错误

### 4. 检查网络请求（可选）

打开浏览器开发者工具（F12），切换到 **Network** 面板：

1. 刷新页面
2. 在过滤器中输入 `.webp`
3. 检查所有图片请求的状态码

**期望结果：**
- 所有 `.webp` 文件请求返回 `200 OK`
- 请求 URL 格式类似：
  ```
  http://localhost:3000/assets/i18n/zh-CN/cardia/cards/deck1/compressed/1.webp
  http://localhost:3000/assets/i18n/zh-CN/cardia/cards/deck2/compressed/5.webp
  ```

## 如果图片仍然无法加载

### 检查清单

1. **确认目录结构正确**
   ```bash
   # 应该看到 16 个 .webp 文件
   ls public/assets/i18n/zh-CN/cardia/cards/deck1/compressed/
   
   # 应该看到 16 个 .webp 文件
   ls public/assets/i18n/zh-CN/cardia/cards/deck2/compressed/
   ```

2. **运行路径验证脚本**
   ```bash
   node scripts/test-cardia-image-paths.mjs
   ```
   应该显示：`✅ 通过: 35/35`

3. **检查浏览器控制台**
   - 打开开发者工具（F12）
   - 切换到 **Console** 面板
   - 查找红色错误信息
   - 特别注意 404 或图片加载失败的错误

4. **检查 Network 面板**
   - 找到失败的图片请求（状态码 404）
   - 复制完整的请求 URL
   - 对比实际文件路径

5. **清除浏览器缓存**
   ```
   Ctrl+Shift+Delete (Windows/Linux)
   Cmd+Shift+Delete (Mac)
   ```
   或者使用无痕模式（Ctrl+Shift+N / Cmd+Shift+N）

6. **重启开发服务器**
   ```bash
   # 停止服务器（Ctrl+C）
   # 重新启动
   npm run dev
   ```

## 常见问题

### Q: 图片显示为空白框，但没有 404 错误
**A:** 可能是图片正在加载中。检查：
- 网络速度是否正常
- 图片文件大小是否过大
- 是否有 CORS 错误

### Q: 部分图片显示，部分不显示
**A:** 检查：
- 哪些卡牌的图片无法显示
- 对应的文件是否存在
- 文件权限是否正确

### Q: 本地可以显示，但部署后无法显示
**A:** 检查：
- CDN 配置是否正确
- 图片是否已上传到 CDN
- CDN 路径是否与本地路径一致

## 技术支持

如果按照上述步骤仍然无法解决问题，请提供以下信息：

1. **浏览器控制台截图**（Console 面板）
2. **Network 面板截图**（筛选 .webp 文件）
3. **失败的图片请求 URL**
4. **目录结构验证结果**
   ```bash
   ls -R public/assets/i18n/zh-CN/cardia/cards/
   ```

## 相关文档

- `IMAGE-FIX-COMPLETE.md` - 详细修复文档
- `TASK-3-IMAGE-FIX-SUMMARY.md` - 修复总结
- `docs/ai-rules/asset-pipeline.md` - 资源管线规范

---

**最后更新：** 2026-02-27
