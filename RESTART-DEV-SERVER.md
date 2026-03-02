# 重启开发服务器

代码已经修改完成，但需要重启开发服务器才能看到效果。

## 步骤：

1. **停止当前的开发服务器**
   - 在运行 `npm run dev` 的终端按 `Ctrl+C`

2. **清理缓存（可选但推荐）**
   ```bash
   # 清理 Vite 缓存
   rm -rf node_modules/.vite
   
   # 或者 Windows PowerShell
   Remove-Item -Recurse -Force node_modules/.vite -ErrorAction SilentlyContinue
   ```

3. **重新启动开发服务器**
   ```bash
   npm run dev
   ```

4. **清理浏览器缓存**
   - 在浏览器中按 `Ctrl+Shift+R`（硬刷新）
   - 或者打开开发者工具，右键刷新按钮，选择"清空缓存并硬性重新加载"

## 已修改的文件：

- ✅ `src/games/smashup/ui/PromptOverlay.tsx` - 卡牌选择弹窗
- ✅ `src/games/smashup/ui/RevealOverlay.tsx` - 牌库顶展示

## 预期效果：

- 行动卡/随从：8.5vw（与手牌一致）
- 基地卡：14vw（与场上基地一致）

所有展示和选择界面的卡牌都会根据类型自动使用正确的尺寸。
