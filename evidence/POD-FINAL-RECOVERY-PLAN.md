# POD 提交最终恢复计划

**创建时间**: 2026-03-04  
**目标**: 恢复 POD 提交中被误删的功能

---

## 执行摘要

根据详细分析，需要恢复的功能：

### 需要恢复（3个功能）
1. **Board.tsx - taijiTokenLimit**（P1 关键）
2. **Board.tsx - autoResponse**（P2 重要）
3. **Board.tsx - 响应窗口视角自动切换**（P2 重要）

### 已完全恢复（3个文件）
1. ✅ `Matches.tsx` - MatchDetailModal
2. ✅ `baseAbilities.ts` - mootSite
3. ✅ 所有测试文件

### 需要人工审查（2个文件）
1. ⚠️ `public/locales/en/game-dicethrone.json`
2. ⚠️ `public/locales/zh-CN/game-dicethrone.json`

---

## 恢复计划

### 阶段 1: 恢复 Board.tsx 的关键功能

#### 1.1 恢复 taijiTokenLimit（P1 关键）

**原因**: 影响游戏规则正确性 - 僧侣的太极令牌规则

**恢复内容**:
```typescript
// 太极本回合限制：攻击方加伤时，可用数量 = 持有量 - 本回合获得量
const tokenUsableOverrides = React.useMemo(() => {
    if (!pendingDamage || pendingDamage.responseType !== 'beforeDamageDealt') return undefined;
    const pid = pendingDamage.responderId;
    const gainedThisTurn = G.taijiGainedThisTurn?.[pid] ?? 0;
    if (gainedThisTurn <= 0) return undefined;
    const total = G.players[pid]?.tokens[TOKEN_IDS.TAIJI] ?? 0;
    const usable = Math.max(0, total - gainedThisTurn);
    return usable < total ? { [TOKEN_IDS.TAIJI]: usable } : undefined;
}, [G, pendingDamage]);
```

**插入位置**: 在 `pendingDamage` 相关逻辑之后

**需要传递给**: `<TokenDisplay>` 或相关组件的 `tokenUsableOverrides` prop

---

#### 1.2 恢复 autoResponse（P2 重要）

**原因**: 影响用户体验 - 允许玩家自动跳过响应窗口

**恢复内容**:
```typescript
import { getAutoResponseEnabled } from './ui/AutoResponseToggle';

// 自动响应状态
const [autoResponseEnabled, setAutoResponseEnabled] = React.useState(() => getAutoResponseEnabled());

// 响应窗口状态
const responseWindow = access.responseWindow;
const isResponseWindowOpen = !!responseWindow;
const currentResponderId = responseWindow?.responderQueue[responseWindow.currentResponderIndex];
const isResponder = isResponseWindowOpen && currentResponderId === rootPid;

// 自动跳过逻辑
React.useEffect(() => {
    if (autoResponseEnabled || !isResponseWindowOpen || !isResponder) return;
    const timer = setTimeout(() => {
        engineMoves.responsePass();
    }, 300);
    return () => clearTimeout(timer);
}, [autoResponseEnabled, isResponseWindowOpen, isResponder, engineMoves]);
```

**插入位置**: 在组件顶部状态声明区域

**需要传递给**: 相关 UI 组件的 `onAutoResponseToggle={setAutoResponseEnabled}` prop

---

#### 1.3 恢复响应窗口视角自动切换（P2 重要）

**原因**: 影响用户体验 - 响应窗口打开时自动切换视角

**恢复内容**:
```typescript
// 响应窗口视角自动切换
const prevResponseWindowRef = React.useRef<boolean>(false);
React.useEffect(() => {
    const wasOpen = prevResponseWindowRef.current;
    const isOpen = isResponseWindowOpen;
    prevResponseWindowRef.current = isOpen;

    if (isOpen && isResponseAutoSwitch) {
        setViewMode('opponent');
    } else if (isOpen && !isResponseAutoSwitch) {
        setViewMode('self');
    } else if (wasOpen && !isOpen) {
        if (currentPhase !== 'defensiveRoll') {
            setViewMode('self');
        }
    }
}, [isResponseWindowOpen, isResponseAutoSwitch, currentPhase]);
```

**插入位置**: 在视角相关逻辑区域

**依赖**: 需要 `isResponseAutoSwitch` 变量（从 `computeViewModeState` 获取）

---

### 阶段 2: 验证恢复

#### 2.1 编译检查
```bash
npx tsc --noEmit
```

#### 2.2 ESLint 检查
```bash
npx eslint src/games/dicethrone/Board.tsx
```

#### 2.3 功能测试
1. 测试僧侣太极令牌限制
2. 测试自动响应功能
3. 测试响应窗口视角切换

---

### 阶段 3: i18n 文件审查（可选）

**方法**: 对比 POD 之前和当前的 i18n 文件，找出缺失的翻译 key

**命令**:
```bash
git diff 6ea1f9f~1 HEAD -- public/locales/en/game-dicethrone.json
git diff 6ea1f9f~1 HEAD -- public/locales/zh-CN/game-dicethrone.json
```

**判断标准**: 
- 如果缺失的 key 与 POD 相关 → 不恢复
- 如果缺失的 key 与 POD 无关 → 恢复

---

## 风险评估

### 高风险
- ❌ 无

### 中风险
- ⚠️ `taijiTokenLimit` - 需要确认 `tokenUsableOverrides` prop 的传递路径
- ⚠️ `autoResponse` - 需要确认 `AutoResponseToggle` 组件是否存在

### 低风险
- ✅ 响应窗口视角自动切换 - 纯 UI 逻辑，风险低

---

## 执行顺序

1. ✅ 先恢复 `taijiTokenLimit`（P1 关键，影响游戏规则）
2. ✅ 再恢复 `autoResponse`（P2 重要，影响用户体验）
3. ✅ 最后恢复响应窗口视角自动切换（P2 重要，影响用户体验）
4. ⚠️ i18n 文件审查（可选，低优先级）

---

**状态**: 📋 计划完成，等待执行

