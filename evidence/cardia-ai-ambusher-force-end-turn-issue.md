# Cardia AI Ambusher 强制结束回合问题调查

## 问题描述

用户报告：AI 在触发 card09 (Ambusher) 能力时，无法正常选择派系，右上角出现 warning "AI 强制结束回合"。

## 调查过程

### 1. 代码审查（已完成 ✅）

**AI 逻辑审查**：
- ✅ AI 代码逻辑正确（单元测试通过：2/2）
- ✅ 交互转换正确（faction_selection → simple-choice）
- ✅ 在线 AI 决策触发机制存在（`OnlineAiSeatBridge` 组件）
- ✅ 其他游戏（Dice Throne, Smash Up）使用相同机制且工作正常
- ✅ Cardia 已使用相同的客户端 AI 决策机制

### 2. E2E 测试开发（已完成 ✅）

**目标**：使用 E2E 测试复现问题并调试 AI 决策链路。

**进展**：

#### 2.1 Helper 函数修复 ✅
- ✅ 修复 `e2e/helpers/cardia.ts` 中的 `buildPlayerState` 函数
  - 问题：函数期望 `PlayerScenario` 参数，但 AI-only 场景不提供
  - 解决：添加可选参数支持，允许 `player1` 和 `player2` 为 `undefined`

#### 2.2 状态初始化修复 ✅
- ✅ 修复 `currentPlayerId` 未设置问题
  - 问题：初始状态显示 `currentPlayer: undefined`
  - 解决：在 `buildStateFromScenario` 中添加默认值设置

#### 2.3 AI 座位凭据修复 ✅
- ✅ 修复 AI 座位凭据未正确设置问题
  - 问题：只有座位 1 的凭据被设置，座位 0 的凭据缺失
  - 解决：为座位 0 也设置 AI 凭据（使用 player1 的凭据）
  - 验证：日志显示 `AI 座位凭据已设置: [ '0', '1' ]` ✅

#### 2.4 Player2 创建逻辑修复 ✅
- ✅ 修复 AI vs AI 场景下 player2 创建冲突
  - 问题：AI 已占据座位 1，但仍尝试创建 player2 加入座位 1
  - 解决：当座位 1 是 AI 控制时，不创建 player2，复用 player1 的 context 和 page

#### 2.5 当前问题：AI 动作提交后无响应 ⚠️

**症状**：
```
[OnlineAiSeatBridge] Submitting AI resolution
[submitOnlineAiResolution] Submitting AI action: {playerId: 0, actionId: play-card:deck_i_card_12_..., commands: Array(1)}
```

AI 不断提交相同的动作，但从未收到确认或拒绝回调：
- ❌ 从未看到 `[submitOnlineAiResolution] Action confirmed`
- ❌ 从未看到 `[submitOnlineAiResolution] Action rejected`
- ❌ `attemptKey` 始终相同，说明状态未变化
- ❌ 游戏回合数始终为 0，说明服务器未执行命令

**根本原因推测**：
1. **AI 座位客户端未正确连接到服务器**
   - `client.sendBatch` 被调用，但回调从未触发
   - 可能是 WebSocket 连接未建立或已断开
   - 需要检查 `clientsRef.current[playerId]?.isConnected` 的实际值

2. **服务器拒绝 AI 座位的命令但未返回错误**
   - 可能是权限验证失败（credentials 不匹配）
   - 可能是服务器端 AI 座位处理逻辑有问题
   - 需要检查服务器日志

3. **Transport Client 配置问题**
   - AI 座位的 transport client 可能未正确初始化
   - 需要检查 `loadOnlineAiSeatState` 如何创建 client

**下一步调查方向**：
1. 添加日志检查 `client.isConnected` 状态
2. 添加日志检查 `client.sendBatch` 是否真的发送了请求
3. 检查服务器日志，看是否收到 AI 座位的命令
4. 检查 `loadOnlineAiSeatState` 函数，确认 client 创建逻辑
5. 参考其他游戏（Dice Throne, Smash Up）的 AI 座位 client 创建方式

## 技术细节

### AI 决策链路（当前状态）

```
OnlineAiSeatBridge (MatchRoom.tsx)
  ↓ useEffect 监听 state 变化 ✅
  ↓ 检查是否有 AI 座位 ✅
  ↓ 调用 resolveNextAiAction ✅
  ↓ 构建 AI 决策上下文 ✅
  ↓ 调用游戏 AI 实现 ✅
  ↓ 生成决策 ✅
  ↓ 提交到服务器 ✅ (client.sendBatch 被调用)
  ↓ 服务器执行命令 ❌ (回调从未触发)
  ↓ 状态更新 ❌
  ↓ 触发下一轮 AI 决策 ❌
```

### 当前断点

链路在"提交到服务器"后断了：`client.sendBatch` 的回调从未被调用。

### 文件修改记录

1. `e2e/helpers/cardia.ts`:
   - `CardiaTestScenario` 接口：`player1?` 和 `player2?` 改为可选
   - `buildPlayerState` 函数：添加 `undefined` 参数处理
   - `buildStateFromScenario` 函数：添加 `currentPlayerId` 默认值设置
   - `setupOnlineMatch` 函数：添加 AI 座位凭据设置逻辑
   - `setupOnlineMatch` 函数：添加 player2 创建条件判断
   - `cleanup` 函数：处理 AI vs AI 场景下的 context 关闭

2. `e2e/cardia-ai-opponent.e2e.ts`:
   - 添加浏览器控制台监听
   - 添加详细状态日志输出

3. `src/engine/ai/localRunner.ts`:
   - `resolveNextAiAction` 函数：添加详细调试日志

4. `src/pages/MatchRoom.tsx`:
   - `OnlineAiSeatBridge` useEffect：添加详细调试日志
   - `runAiTurn` 函数：添加每个步骤的日志

5. `src/pages/onlineAiForceSkip.ts`:
   - `submitOnlineAiResolution` 函数：添加提交、确认、拒绝日志

## 下一步行动

1. **检查 AI 座位 client 连接状态**：
   - 在 `runAiTurn` 中添加日志，输出 `client.isConnected` 的值
   - 检查 `clientsRef.current[playerId]` 是否存在且正确初始化

2. **检查服务器日志**：
   - 查看服务器是否收到 AI 座位的命令
   - 查看服务器是否返回了响应
   - 查看是否有权限验证失败的日志

3. **参考其他游戏实现**：
   - 查看 Dice Throne 或 Smash Up 的 E2E 测试
   - 对比 AI 座位 client 的创建和连接方式
   - 确认是否有特殊的初始化步骤

4. **备选方案**：
   - 如果 transport client 有问题，考虑直接使用 API 提交命令
   - 如果权限验证有问题，检查 credentials 的格式和传递方式

## 相关文件

- `src/games/cardia/ai.ts` - AI 实现
- `src/games/cardia/domain/abilities/group7-faction.ts` - Ambusher 能力
- `src/games/cardia/domain/systems.ts` - 交互转换
- `src/pages/MatchRoom.tsx` - OnlineAiSeatBridge 组件
- `src/pages/onlineAiSeats.ts` - AI 座位状态加载
- `src/engine/ai/localRunner.ts` - AI 决策引擎
- `src/engine/transport/client.ts` - Transport Client 实现
- `e2e/helpers/cardia.ts` - E2E 测试辅助函数
- `e2e/cardia-ai-opponent.e2e.ts` - E2E 测试文件
- `src/games/cardia/__tests__/ai-ambusher-interaction.test.ts` - 单元测试

## 测试命令

```bash
# 运行单元测试
npm run test -- src/games/cardia/__tests__/ai-ambusher-interaction.test.ts

# 运行 E2E 测试（带内存绕过）
BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 npm run test:e2e:ci:file -- cardia-ai-opponent.e2e.ts "AI vs AI 完整对局：验证两个 AI 能够完成完整游戏"
```

## 结论

当前问题已从"AI 座位凭据未加载"缩小到"AI 座位 client 提交命令后无响应"。AI 决策生成正常，但 transport client 的 `sendBatch` 回调从未被触发，导致游戏状态无法更新。需要继续调查 client 连接状态和服务器响应。
