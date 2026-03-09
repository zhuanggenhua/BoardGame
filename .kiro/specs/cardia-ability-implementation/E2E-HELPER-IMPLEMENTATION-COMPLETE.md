# E2E Helper 函数实现完成报告

## 执行时间
2026-03-01

## 任务目标
实现缺失的 E2E 测试辅助函数，使 Cardia Deck1 的 E2E 测试能够正常运行。

## 已完成的工作

### 1. 实现了所有缺失的辅助函数

在 `e2e/helpers/cardia.ts` 中实现了以下函数：

#### 核心辅助函数
- ✅ `injectHandCards(page, playerId, cards)` - 注入手牌到指定玩家
- ✅ `setPhase(page, phase)` - 设置游戏阶段
- ✅ `playCard(page, index)` - 打出指定索引的手牌
- ✅ `waitForPhase(page, phase, timeout)` - 等待游戏进入指定阶段

#### 向后兼容别名
- ✅ `setupCardiaOnlineMatch(browser, baseURL)` - 兼容旧测试文件的别名
- ✅ `cleanupCardiaMatch(setup)` - 清理对局资源

### 2. 修复了 API 调用错误

#### 问题 1：`getGameServerBaseURL()` 调用错误
- **错误**：`getGameServerBaseURL(page)` - 传递了不需要的参数
- **修复**：`getGameServerBaseURL()` - 不传递参数

#### 问题 2：`guestId` 位置错误
- **错误**：`guestId` 在 HTTP header 中（`X-Guest-ID`）
- **修复**：`guestId` 在请求体的 `setupData` 中
- **影响文件**：
  - `createCardiaRoomViaAPI` - 创建房间时 `setupData: { guestId }`
  - `joinCardiaMatchViaAPI` - 加入房间时 `data: { guestId }`

#### 问题 3：`baseURL` 未定义
- **错误**：`page.context().baseURL` 返回 `undefined`
- **修复**：使用 `page.context()._options?.baseURL || process.env.VITE_FRONTEND_URL || 'http://localhost:5173'`

### 3. 测试运行状态

#### 测试环境配置
- 前端服务器：http://localhost:5173
- 游戏服务器：http://localhost:18000
- API 服务器：http://localhost:18001

#### 测试执行结果
```bash
# 运行命令
VITE_FRONTEND_URL=http://localhost:5173 PW_USE_DEV_SERVERS=true \
  npx playwright test e2e/cardia-deck1-card02-void-mage.e2e.ts
```

**测试进度**：
- ✅ 房间创建成功
- ✅ 玩家加入成功
- ✅ 游戏界面加载成功
- ✅ 第一回合：注入手牌、打出卡牌、添加修正标记 - 全部成功
- ✅ 第二回合：注入手牌、打出卡牌、进入能力阶段 - 全部成功
- ❌ **失败点**：激活虚空法师能力后，`sys.interaction.current` 为 `undefined`

**失败原因分析**：
- 测试期望虚空法师能力激活后会创建交互界面（选择目标牌）
- 实际上 `stateAfterActivate.sys?.interaction?.current` 为 `undefined`
- 这可能是以下原因之一：
  1. 虚空法师能力实现有问题（没有创建交互）
  2. 测试场景构造有问题（能力激活条件不满足）
  3. 状态读取时机有问题（交互还未创建）

## 下一步行动

### 选项 1：调试虚空法师能力实现
检查 `src/games/cardia/domain/abilities-*.ts` 中虚空法师的能力定义，确认：
- 能力是否正确创建了交互（`createSimpleChoice` 或 `createInteraction`）
- 能力激活条件是否正确
- 能力是否在正确的时机触发

### 选项 2：调整测试场景
修改测试代码，确保：
- 虚空法师能力的激活条件完全满足
- 在能力激活后等待足够的时间让交互创建
- 添加更多调试日志来追踪状态变化

### 选项 3：补充其他高优先级测试
继续实现其他高优先级测试（card09-ambusher, card10-puppeteer），看看是否有类似问题。

## 技术债务

### 需要清理的临时文件
- `run-test-temp.sh` - 临时测试脚本

### 需要移除的调试代码
- `createCardiaRoomViaAPI` 中的 `console.log` 语句

### 文档更新
- 更新 `docs/automated-testing.md` 中关于 Cardia E2E 测试的说明
- 添加 helper 函数的使用示例

## 总结

✅ **核心任务完成**：所有缺失的 helper 函数已实现，测试可以运行到能力激活阶段。

⚠️ **测试失败**：虚空法师能力测试在交互创建环节失败，需要进一步调试能力实现或测试场景。

📊 **进度**：16 个测试中，3 个高优先级测试的 helper 函数已实现，1 个测试可以运行（但失败在业务逻辑层面）。

🎯 **建议**：优先调试虚空法师能力实现，确认交互创建逻辑是否正确，然后再继续补充其他测试。
