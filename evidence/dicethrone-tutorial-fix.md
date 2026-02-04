# DiceThrone 教学模式修复记录

## 问题描述
进入 DiceThrone 教学模式（`/play/dicethrone/tutorial`）后，界面一直显示"加载游戏状态"，游戏界面无法显示。

## 根本原因

### 问题链条
1. **教程模式使用本地客户端**：`TutorialClient` 使用 `playerID="0"`，所有命令都以玩家 0 执行
2. **游戏初始化创建两个玩家**：`setup` 函数创建玩家 0 和玩家 1，但都是 `unselected` 状态
3. **AI 动作只能为玩家 0 选择角色**：教程清单的 AI 动作只能以玩家 0 的身份执行，无法为玩家 1 选择角色
4. **阶段推进条件不满足**：`canAdvancePhase` 要求所有玩家都选好角色，但玩家 1 未选择，导致无法从 `setup` 推进到 `income`
5. **Board 组件卡在加载界面**：由于阶段一直是 `setup`，Board 组件显示"加载游戏状态"

### 关键代码位置
- **阶段推进条件**：`src/games/dicethrone/domain/rules.ts` 第 129-135 行
- **自动推进逻辑**：`src/games/dicethrone/game.ts` 第 318-323 行
- **英雄初始化**：`src/games/dicethrone/game.ts` 第 181-210 行

## 修复方案

### 1. 放宽教程模式的阶段推进条件
**文件**：`src/games/dicethrone/domain/rules.ts`

在 `canAdvancePhase` 函数中，检测教程模式并放宽限制：
- **教程模式**：只检查玩家 0 是否选好角色
- **正常模式**：检查所有玩家是否选好角色

```typescript
if (state.turnPhase === 'setup') {
    const isTutorialMode = typeof window !== 'undefined'
        && (window as Window & { __BG_GAME_MODE__?: string }).__BG_GAME_MODE__ === 'tutorial';
    
    if (isTutorialMode) {
        const player0Selected = state.selectedCharacters['0'] && state.selectedCharacters['0'] !== 'unselected';
        return player0Selected && state.hostStarted;
    }
    
    // 正常模式逻辑...
}
```

### 2. 自动为玩家 1 初始化默认英雄
**文件**：`src/games/dicethrone/game.ts`

在 `setup` 阶段退出时，检测教程模式并自动为玩家 1 选择默认角色（僧侣）：

```typescript
if (from === 'setup') {
    const isTutorialMode = typeof window !== 'undefined'
        && (window as Window & { __BG_GAME_MODE__?: string }).__BG_GAME_MODE__ === 'tutorial';
    
    if (isTutorialMode && (!core.selectedCharacters['1'] || core.selectedCharacters['1'] === 'unselected')) {
        core.selectedCharacters['1'] = 'monk';
    }
    
    // 为所有选好角色的玩家触发 HERO_INITIALIZED...
}
```

### 3. 简化 Board 组件的教学模式逻辑
**文件**：`src/games/dicethrone/Board.tsx`

移除了不必要的 `useEffect`，保持教学模式下的加载界面简洁。

### 4. 添加调试日志
在 Board 组件中添加日志，方便排查问题：

```typescript
React.useEffect(() => {
    console.log('[DiceThrone][Board] 教学状态', {
        isTutorialActive,
        currentPhase,
        stepId: tutorialStep?.id,
        hasAiActions: tutorialStep?.aiActions?.length ?? 0,
    });
}, [isTutorialActive, currentPhase, tutorialStep]);
```

## 修复后的流程

1. 用户进入教学模式（`/play/dicethrone/tutorial`）
2. MatchRoom 延迟 100ms 启动教学系统
3. TutorialContext 在教学步骤激活后 1 秒执行 AI 动作：
   - `SELECT_CHARACTER` (玩家 0 选择僧侣)
   - `HOST_START_GAME` (房主开始游戏)
4. `canAdvancePhase` 检测到教程模式，只检查玩家 0 是否选好角色 ✅
5. `onAutoContinueCheck` 触发自动推进
6. `setup` 阶段退出时，自动为玩家 1 选择僧侣 ✅
7. 为两个玩家触发 `HERO_INITIALIZED` 事件，初始化英雄数据
8. 阶段变为 `income`，触发 `SYS_PHASE_CHANGED` 事件
9. 教程系统自动推进到第二步
10. Board 组件重新渲染，显示游戏界面 ✅

## 相关文件
- `src/games/dicethrone/Board.tsx` - Board 组件
- `src/games/dicethrone/game.ts` - 游戏逻辑（阶段转换、英雄初始化）
- `src/games/dicethrone/domain/rules.ts` - 游戏规则（阶段推进条件）
- `src/games/dicethrone/tutorial.ts` - 教学清单
- `src/contexts/TutorialContext.tsx` - 教学系统上下文
- `src/pages/MatchRoom.tsx` - 对局房间页面
