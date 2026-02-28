# 盘旋机器人调试指南

## 问题现象
- 交互弹窗显示"牌库顶是粗鲁少女1（力量3），是否作为额外随从打出？"
- 但只有 1 个选项（skip），"打出"选项丢失
- 控制台没有看到 `[robotHoverbot]` 日志

## 根本原因
**`src/games/smashup/abilities/robots.ts` 是服务端代码，修改后必须重启游戏服务器才能生效！**

## 解决步骤

### 1. 确认服务器已重启
```bash
# 停止当前服务器（Ctrl+C）
# 然后重新启动
npm run dev
```

### 2. 查找关键日志
重启后，打出盘旋机器人，应该看到以下日志（按顺序）：

#### 服务端日志（终端）
```
╔═══════════════════════════════════════════════════════════════╗
║ [robotHoverbot] FUNCTION ENTRY - SERVER SIDE CODE             ║
╚═══════════════════════════════════════════════════════════════╝
[robotHoverbot] Context: { playerId, cardUid, defId, ... }
[robotHoverbot] After peekDeckTop: { hasPeek: true, ... }
[robotHoverbot] Peek card is minion, creating interaction
[robotHoverbot] Creating interaction: { cardUid, defId, power, counter }
[robotHoverbot] Creating interaction with initial options: [...]
[robotHoverbot] Interaction created: { interactionId, optionsCount: 2, ... }
[robotHoverbot] Set continuationContext: { cardUid, defId, power }
[robotHoverbot] Returning with interaction
```

#### 客户端日志（浏览器控制台）
```
[InteractionSystem] popInteraction: No current, making new interaction current
[InteractionSystem] popInteraction: Checking optionsGenerator: { hasOptionsGenerator: true, ... }
[InteractionSystem] popInteraction: Calling optionsGenerator...
[robotHoverbot optionsGenerator] CALLED: { hasContext: true, contextCardUid, contextDefId, contextPower }
[robotHoverbot optionsGenerator] Returning options: [{ id: 'play', ... }, { id: 'skip', ... }]
[InteractionSystem] popInteraction: optionsGenerator returned: { freshOptionsCount: 2, ... }
[PromptOverlay] Props changed: { hasInteraction: true, optionsCount: 2, ... }
[PromptOverlay] Card mode decision: { cardOptionCount: 1, useCardMode: true }
```

### 3. 如果仍然没有日志

#### 检查 1：服务器是否真的重启了？
- 终端中应该看到 `[nodemon] restarting due to changes...` 或手动重启的提示
- 如果没有，手动停止（Ctrl+C）并重新运行 `npm run dev`

#### 检查 2：是否在正确的终端查看日志？
- **服务端日志**：运行 `npm run dev` 的终端窗口
- **客户端日志**：浏览器开发者工具的 Console 面板

#### 检查 3：日志是否被过滤？
- 浏览器控制台：确保没有过滤 `console.error`
- 终端：确保没有重定向输出或使用了日志过滤工具

### 4. 预期结果
- 服务端日志显示 `robotHoverbot` 函数被调用，创建了 2 个选项的交互
- 客户端日志显示 `optionsGenerator` 被调用，返回了 2 个选项
- UI 显示卡牌图片和"打出"按钮

## 技术细节

### 为什么必须重启服务器？
- `src/games/smashup/abilities/robots.ts` 在服务端运行（Node.js）
- 服务端代码不支持热重载（与前端 Vite 不同）
- 修改后必须重启 Node.js 进程才能加载新代码

### 日志链路
1. **服务端**：`robotHoverbot` 函数创建交互，设置 `optionsGenerator`
2. **传输层**：交互通过 WebSocket 发送到客户端
3. **客户端**：`InteractionSystem` 调用 `optionsGenerator` 生成最新选项
4. **UI 层**：`PromptOverlay` 渲染卡牌图片和按钮

### 为什么使用 console.error？
- `console.log` 可能被日志过滤工具忽略
- `console.error` 通常会高亮显示，更容易发现
- 醒目的边框标记帮助快速定位关键日志

## 如果问题仍然存在
1. 提供完整的服务端日志（从启动到打出盘旋机器人）
2. 提供完整的浏览器控制台日志
3. 确认是否看到 `╔═══...` 边框标记
