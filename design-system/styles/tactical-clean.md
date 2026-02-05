# 战术简洁风格 (Tactical Clean Style)

> **风格定位**：专业、清晰、信息密度高
> 
> **适用游戏**：策略对战、卡牌 TCG、棋类、军事模拟

---

## 视觉特征

- **扁平但有层次**：通过边框和微妙阴影区分层级
- **信息优先**：UI 不抢戏，突出游戏内容
- **冷色调为主**：蓝灰、深色背景
- **精确的间距**：网格对齐，视觉整洁

---

## 颜色系统

### 基础色板

```css
/* 背景层级 */
--bg-base: #0f172a;       /* slate-900 */
--bg-surface: #1e293b;    /* slate-800 */
--bg-elevated: #334155;   /* slate-700 */

/* 边框 */
--border-subtle: #334155; /* slate-700 */
--border-default: #475569; /* slate-600 */
--border-strong: #64748b; /* slate-500 */

/* 文字 */
--text-primary: #f1f5f9;  /* slate-100 */
--text-secondary: #94a3b8; /* slate-400 */
--text-muted: #64748b;    /* slate-500 */
```

### 功能色

```css
/* 主要操作 - 冷蓝 */
--primary: #3b82f6;       /* blue-500 */
--primary-hover: #60a5fa; /* blue-400 */
--primary-active: #2563eb; /* blue-600 */

/* 成功/确认 */
--success: #22c55e;       /* green-500 */
--success-muted: #166534; /* green-800 */

/* 危险/攻击 */
--danger: #ef4444;        /* red-500 */
--danger-muted: #991b1b;  /* red-800 */

/* 警告/注意 */
--warning: #f59e0b;       /* amber-500 */
--warning-muted: #92400e; /* amber-800 */

/* 信息/中性 */
--info: #06b6d4;          /* cyan-500 */
```

### 玩家颜色

```css
/* 玩家 1 - 蓝方 */
--player-1: #3b82f6;
--player-1-bg: #1e3a5f;

/* 玩家 2 - 红方 */
--player-2: #ef4444;
--player-2-bg: #5f1e1e;

/* 中立/未分配 */
--neutral: #64748b;
```

---

## 组件样式

### 按钮

#### 主要按钮
```tsx
className={`
  bg-blue-500
  hover:bg-blue-400
  active:bg-blue-600
  text-white font-medium
  px-4 py-2
  rounded-md
  transition-colors duration-150
`}
```

#### 次要按钮
```tsx
className={`
  bg-slate-700
  hover:bg-slate-600
  active:bg-slate-800
  text-slate-100 font-medium
  border border-slate-600
  px-4 py-2
  rounded-md
  transition-colors duration-150
`}
```

#### 幽灵按钮
```tsx
className={`
  bg-transparent
  hover:bg-slate-700/50
  active:bg-slate-700
  text-slate-300
  border border-slate-600
  px-4 py-2
  rounded-md
  transition-colors duration-150
`}
```

#### 危险按钮
```tsx
className={`
  bg-red-500/20
  hover:bg-red-500/30
  active:bg-red-500/40
  text-red-400
  border border-red-500/50
  px-4 py-2
  rounded-md
  transition-colors duration-150
`}
```

### 面板

#### 基础面板
```tsx
className={`
  bg-slate-800
  border border-slate-700
  rounded-lg
  p-4
`}
```

#### 悬浮面板
```tsx
className={`
  bg-slate-800
  border border-slate-600
  rounded-lg
  p-4
  shadow-xl shadow-black/50
`}
```

#### 选中面板
```tsx
className={`
  bg-slate-800
  border-2 border-blue-500
  rounded-lg
  p-4
  shadow-lg shadow-blue-500/20
`}
```

### 卡牌

#### 基础卡牌
```tsx
className={`
  bg-slate-800
  border border-slate-600
  rounded-lg
  overflow-hidden
  transition-all duration-200
  hover:border-slate-500
  hover:shadow-lg
`}
```

#### 可选中卡牌
```tsx
className={`
  bg-slate-800
  border-2 ${selected ? 'border-blue-500' : 'border-slate-600'}
  rounded-lg
  overflow-hidden
  transition-all duration-200
  cursor-pointer
  ${selected ? 'shadow-lg shadow-blue-500/30' : ''}
`}
```

### 信息栏

#### 资源显示
```tsx
className={`
  flex items-center gap-2
  bg-slate-800/80
  border border-slate-700
  rounded px-3 py-1.5
  text-sm
`}
```

#### 状态标签
```tsx
// 正面状态
className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30"

// 负面状态
className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30"

// 中性状态
className="px-2 py-0.5 rounded text-xs font-medium bg-slate-600 text-slate-300"
```

### 网格/棋盘

#### 格子
```tsx
className={`
  aspect-square
  bg-slate-800
  border border-slate-700
  transition-colors duration-150
  ${isValidTarget ? 'bg-blue-500/20 border-blue-500/50' : ''}
  ${isHovered ? 'bg-slate-700' : ''}
`}
```

#### 单位/棋子
```tsx
className={`
  w-full h-full
  flex items-center justify-center
  rounded
  ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900' : ''}
`}
```

---

## 动画配置

### 原则
- 动画简短、精确
- 避免弹跳效果（不符合战术风格）
- 使用 ease-out 或 linear

### 时长
| 场景 | 时长 |
|------|------|
| Hover 反馈 | 150ms |
| 状态切换 | 200ms |
| 面板展开 | 250ms |
| 单位移动 | 300-400ms |

### CSS
```css
/* 标准 */
transition: colors 150ms ease-out;

/* 展开 */
transition: all 250ms ease-out;
```

### Framer Motion
```tsx
// 简洁 hover
whileHover={{ backgroundColor: "rgba(51, 65, 85, 0.5)" }}

// 选中动画
animate={{ 
  borderColor: selected ? "#3b82f6" : "#475569",
  boxShadow: selected ? "0 0 20px rgba(59, 130, 246, 0.3)" : "none"
}}
transition={{ duration: 0.2 }}
```

---

## 禁用状态

```tsx
className={`
  disabled:opacity-40
  disabled:pointer-events-none
`}
```

---

## 信息层级

### 字体大小
| 用途 | 大小 | 字重 |
|------|------|------|
| 标题 | text-lg | font-semibold |
| 正文 | text-sm | font-normal |
| 标签 | text-xs | font-medium |
| 数值 | text-base | font-bold |

### 间距
| 用途 | 间距 |
|------|------|
| 组件内 | p-2 到 p-4 |
| 组件间 | gap-2 到 gap-4 |
| 区块间 | gap-4 到 gap-6 |

---

## 使用示例

### 游戏引用此风格

```markdown
# SummonerWars UI 设计

> 基于：`design-system/styles/tactical-clean.md`

## 专属配置

- 玩家 1 使用蓝色系
- 玩家 2 使用红色系
- 召唤区使用特殊高亮
```
