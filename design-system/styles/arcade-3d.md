# 街机立体风格 (Arcade 3D Style)

> **风格定位**：活泼、有趣、物理感强
> 
> **适用游戏**：休闲派对、骰子类、卡牌收集、儿童向

---

## 视觉特征

- **立体按钮**：底部阴影模拟厚度，点击下沉
- **饱和渐变**：大胆的渐变色彩
- **粗体文字**：bold/black + uppercase
- **圆润但不过圆**：rounded-lg 到 rounded-xl

---

## 颜色系统

### 主色调模板

可根据游戏主题替换，保持相同的明暗层级关系：

```css
/* 模板结构 */
--style-primary-light: /* 高光/边框 */
--style-primary-from:  /* 渐变起点 */
--style-primary-to:    /* 渐变终点 */
--style-primary-shadow: /* 底部阴影 */
```

### 预设配色

#### 琥珀金 (默认)
```css
--primary-light: #fcd34d;   /* amber-300 */
--primary-from: #fbbf24;    /* amber-400 */
--primary-to: #d97706;      /* amber-600 */
--primary-shadow: #b45309;  /* amber-700 */
```

#### 翡翠绿
```css
--primary-light: #6ee7b7;   /* emerald-300 */
--primary-from: #34d399;    /* emerald-400 */
--primary-to: #059669;      /* emerald-600 */
--primary-shadow: #047857;  /* emerald-700 */
```

#### 宝石蓝
```css
--primary-light: #93c5fd;   /* blue-300 */
--primary-from: #60a5fa;    /* blue-400 */
--primary-to: #2563eb;      /* blue-600 */
--primary-shadow: #1d4ed8;  /* blue-700 */
```

### 功能色（通用）

```css
/* 危险/攻击 */
--danger-light: #f87171;    /* red-400 */
--danger-from: #ef4444;     /* red-500 */
--danger-to: #b91c1c;       /* red-700 */
--danger-shadow: #991b1b;   /* red-800 */

/* 次要/中性 */
--secondary-bg: #334155;    /* slate-700 */
--secondary-shadow: #1e293b; /* slate-800 */
--secondary-border: #64748b; /* slate-500 */
--secondary-text: #f1f5f9;  /* slate-100 */

/* 成功 */
--success-from: #22c55e;    /* green-500 */
--success-to: #16a34a;      /* green-600 */
--success-shadow: #15803d;  /* green-700 */
```

---

## 组件样式

### 按钮

#### 结构示意
```
┌─────────────────────────┐  ← border (1px, light color)
│  ████████████████████   │  ← gradient background
│  ████████████████████   │
└─────────────────────────┘
■■■■■■■■■■■■■■■■■■■■■■■■■■■  ← bottom shadow (4px)
```

#### 主要按钮
```tsx
className={`
  bg-gradient-to-b from-[var(--primary-from)] to-[var(--primary-to)]
  border border-[var(--primary-light)]
  shadow-[0_4px_0_var(--primary-shadow)]
  active:shadow-none active:translate-y-1
  text-white font-bold uppercase tracking-wide
  hover:brightness-110
  transition-all duration-200
  rounded-xl px-6 py-3
`}
```

#### 次要按钮
```tsx
className={`
  bg-slate-700
  border border-slate-500
  shadow-[0_4px_0_#1e293b]
  active:shadow-none active:translate-y-1
  text-slate-100 font-bold uppercase tracking-wide
  hover:bg-slate-600
  transition-all duration-200
  rounded-xl px-6 py-3
`}
```

#### 危险按钮
```tsx
className={`
  bg-gradient-to-b from-red-500 to-red-700
  border border-red-400
  shadow-[0_4px_0_#991b1b]
  active:shadow-none active:translate-y-1
  text-white font-bold uppercase tracking-wide
  hover:brightness-110
  transition-all duration-200
  rounded-xl px-6 py-3
`}
```

#### 尺寸
| Size | Padding | Font | Shadow | Border Radius |
|------|---------|------|--------|---------------|
| sm | `py-2 px-3` | `text-xs` | 3px | `rounded-lg` |
| md | `py-2.5 px-5` | `text-sm` | 4px | `rounded-xl` |
| lg | `py-3 px-6` | `text-base` | 5px | `rounded-xl` |

### 面板

#### 信息面板（深色玻璃）
```tsx
className={`
  bg-black/80 backdrop-blur-sm
  border border-slate-600/50
  rounded-lg
  px-3 py-2
  shadow-lg
`}
```

#### 高亮面板（激活状态）
```tsx
className={`
  bg-gradient-to-r from-[var(--primary-from)] to-[var(--primary-to)]
  text-white
  shadow-lg shadow-[var(--primary-from)]/30
  rounded-lg
  px-3 py-2
`}
```

### 徽章/指示器

#### 数字徽章
```tsx
// 默认
className="px-2 py-0.5 rounded text-xs font-bold min-w-[1.5rem] text-center bg-slate-700 text-slate-300"

// 激活
className="px-2 py-0.5 rounded text-xs font-bold min-w-[1.5rem] text-center bg-amber-500/50 text-white"
```

#### 状态点
```tsx
// 在线/激活
className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse"

// 警告
className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"

// 离线/危险
className="w-2.5 h-2.5 rounded-full bg-red-400"
```

### 资源条

```tsx
// 容器
className="flex items-center gap-1"

// 格子
className={`
  w-3 h-3 rounded-sm
  ${filled 
    ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]' 
    : 'bg-slate-600'
  }
  transition-colors duration-200
`}
```

---

## 动画配置

### Framer Motion
```tsx
// Hover
whileHover={{ scale: 1.02, filter: "brightness(1.05)" }}

// Press
whileTap={{ scale: 0.98 }}

// 弹簧配置
transition={{ type: "spring", stiffness: 400, damping: 25 }}
```

### CSS
```css
/* 标准 */
transition: all 200ms ease-out;

/* 快速 */
transition: transform 150ms ease-out, opacity 150ms ease-out;
```

---

## 禁用状态

```tsx
className={`
  disabled:opacity-50
  disabled:pointer-events-none
  disabled:grayscale
  disabled:shadow-none
`}
```

---

## 使用示例

### 游戏引用此风格

在游戏目录创建 `design.md`：

```markdown
# DiceThrone UI 设计

> 基于：`design-system/styles/arcade-3d.md`
> 主色调：琥珀金

## 专属覆盖

- 骰子使用自定义 3D 效果
- 技能卡使用游戏专属边框
```
