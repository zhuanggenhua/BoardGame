# Cardia 胜利/失败音效区分实现

## 需求
用户反馈："失败和胜利是一个音效吗？"

## 问题分析
- 当前 Cardia 只有 `GAME_WON` 事件，使用 `stgr_action_win` 音效
- 音频注册表中存在两个音效：
  - `stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win` (胜利)
  - `stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_lose` (失败)
- 需要根据当前玩家是否为获胜方，播放不同的音效

## 实现方案
选择 **方案 B：使用 feedbackResolver 动态选择音效**

### 优势
1. **简单高效**：无需修改事件发射逻辑，只需在音频配置层处理
2. **单一事件源**：保持 `GAME_WON` 作为唯一的游戏结束事件
3. **最小改动**：只修改 `audio.config.ts` 的 `feedbackResolver`
4. **符合架构**：音效选择逻辑集中在音频配置层

### 实现细节

#### 1. 更新 `feedbackResolver` (src/games/cardia/audio.config.ts)
```typescript
feedbackResolver: (event: any, context?: any) => {
    // 处理游戏胜利/失败音效选择
    if (event.type === 'GAME_WON') {
        const winnerId = event.payload?.winnerId;
        const currentPlayerId = context?.playerId;
        
        // 如果当前玩家是获胜者，播放胜利音效；否则播放失败音效
        return winnerId === currentPlayerId
            ? 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win'
            : 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_lose';
    }
    
    // 其他事件使用基础 resolver
    const baseResolver = createFeedbackResolver(CARDIA_EVENTS);
    return baseResolver(event, context);
}
```

#### 2. 清理未完成的 `GAME_LOST` 实现
之前尝试添加 `GAME_LOST` 事件，但未完成。已清理：
- ✅ 移除 `CARDIA_EVENTS.GAME_LOST` 事件定义
- ✅ 移除 `GameLostEvent` 接口
- ✅ 移除 `CardiaEvent` 联合类型中的 `GameLostEvent`
- ✅ 移除 `reduce.ts` 中的 `GAME_LOST` case
- ✅ 移除 `reduceGameLost` 函数
- ✅ 更新 `GameOverSystem` 只监听 `GAME_WON` 事件
- ✅ 从 preload 列表中保留 `stgr_action_lose`（仍需预加载）

## 工作原理

### 音效播放流程
1. **游戏结束**：某个玩家获胜，发射 `GAME_WON` 事件
   ```typescript
   {
       type: 'GAME_WON',
       payload: {
           winnerId: '0',  // 获胜玩家ID
           reason: 'signets'
       }
   }
   ```

2. **音频系统处理**：`useGameAudio` hook 接收事件
   - 调用 `feedbackResolver(event, { playerId: currentPlayerId })`
   - `feedbackResolver` 比较 `winnerId` 和 `currentPlayerId`

3. **音效选择**：
   - 如果 `winnerId === currentPlayerId` → 播放 `stgr_action_win` (胜利)
   - 如果 `winnerId !== currentPlayerId` → 播放 `stgr_action_lose` (失败)

### 双端播放
- **获胜方**：听到胜利音效 🎉
- **失败方**：听到失败音效 😢
- 两个客户端同时播放不同的音效，各自根据自己的 `playerId` 判断

## 验证

### 静态检查
- ✅ ESLint: 0 errors (49 warnings 为既有代码)
- ✅ i18n check: passed (3 warnings 为既有代码)

### 预期行为
1. **玩家 0 获胜**：
   - 玩家 0 听到：`stgr_action_win` (胜利音效)
   - 玩家 1 听到：`stgr_action_lose` (失败音效)

2. **玩家 1 获胜**：
   - 玩家 0 听到：`stgr_action_lose` (失败音效)
   - 玩家 1 听到：`stgr_action_win` (胜利音效)

## 修改文件
- `src/games/cardia/audio.config.ts` - 更新 feedbackResolver
- `src/games/cardia/domain/events.ts` - 移除 GAME_LOST 事件定义
- `src/games/cardia/domain/reduce.ts` - 移除 GAME_LOST reducer
- `src/games/cardia/domain/systems.ts` - 更新 GameOverSystem

## 技术债务
无

## 后续建议
1. 在浏览器中测试实际音效播放
2. 确认双端音效播放正确
3. 如需调整音效音量，可在 `criticalSounds` 预加载配置中添加音量参数
