# 经典羊皮纸风格 (Classic Parchment Style)

> **风格定位**：复古、温暖、桌游实体感
> 
> **适用游戏**：经典桌游、规则书风格、复古模拟、文字冒险

---

## 视觉特征

- **暖色调**：米色、棕色、金色
- **纸质纹理**：模拟实体桌游的触感
- **衬线字体**：营造"规则书"的感觉
- **角落装饰**：模仿实体卡片的边框

---

## 颜色系统

### 羊皮纸色板

```css
/* 主色调 */
--parchment-yellow: #EBC944;
--parchment-cream: #F4ECD8;
--parchment-brown: #4A3B2A;
--parchment-gold: #D4AF37;
--parchment-green: #556B2F;
--parchment-wax: #8B0000;

/* 背景 */
--bg-base: #F4ECD8;
--bg-card: #fcfbf9;
--bg-elevated: #fff;

/* 文字 */
--text-primary: #433422;
--text-secondary: #8c7b64;
--text-muted: #a89880;

/* 边框 */
--border-default: #8c7b64;
--border-subtle: rgba(140, 123, 100, 0.3);
```

### 功能色

```css
/* 主要操作 - 香蕉黄 */
--primary: #FFE135;
--primary-text: #5D4037;

/* 成功 */
--success: #556B2F;

/* 危险 */
--danger: #8B0000;

/* 警告 */
--warning: #D4AF37;
```

---

## 组件样式

### 按钮

#### 主要按钮
```tsx
className={`
  bg-[#FFE135]
  hover:bg-[#ffe44d]
  active:bg-[#e6c82f]
  text-[#5D4037] font-bold
  px-4 py-2
  rounded
  border border-[#5D4037]/20
  transition-colors duration-200
`}
```

#### 次要按钮
```tsx
className={`
  bg-[#F4ECD8]
  hover:bg-[#ebe3cf]
  active:bg-[#e2dac6]
  text-[#433422] font-medium
  px-4 py-2
  rounded
  border border-[#8c7b64]/50
  transition-colors duration-200
`}
```

### 卡片

#### 游戏项目卡片
```tsx
className={`
  bg-[#fcfbf9]
  border border-[#8c7b64]/30
  rounded-sm
  overflow-hidden
  transition-all duration-200
  hover:shadow-[0_4px_16px_rgba(67,52,34,0.1)]
  hover:-translate-y-0.5
`}
```

#### 角落装饰卡片
```tsx
// 使用伪元素或 SVG 在四角添加装饰线条
className={`
  relative
  bg-[#fcfbf9]
  p-4
  
  before:absolute before:top-2 before:left-2 
  before:w-4 before:h-4 
  before:border-t before:border-l before:border-[#8c7b64]
  
  after:absolute after:bottom-2 after:right-2 
  after:w-4 after:h-4 
  after:border-b after:border-r after:border-[#8c7b64]
`}
```

### 面板

#### 信息面板
```tsx
className={`
  bg-[#F4ECD8]
  border border-[#8c7b64]/30
  rounded
  p-4
  shadow-[0_2px_8px_rgba(67,52,34,0.04)]
`}
```

#### 模态窗
```tsx
// 遮罩
className="fixed inset-0 bg-black/40 backdrop-blur-sm"

// 面板
className={`
  bg-[#fcfbf9]
  text-[#433422]
  border border-[#8c7b64]/30
  rounded-lg
  p-6
  shadow-xl
`}
```

### 排版

#### 标题
```tsx
className="font-serif text-[#433422] text-xl font-semibold"
// 推荐字体：Crimson Text, Playfair Display
```

#### 正文
```tsx
className="font-serif text-[#433422] text-base leading-relaxed"
```

#### 标签
```tsx
className="font-sans text-[#8c7b64] text-xs uppercase tracking-wide"
```

---

## 字体配置

### 推荐字体

```css
/* 标题 - 衬线 */
font-family: 'Crimson Text', 'Playfair Display', Georgia, serif;

/* 正文 - 衬线 */
font-family: 'Crimson Text', Georgia, serif;

/* UI 元素 - 无衬线 */
font-family: Inter, system-ui, sans-serif;

/* 像素风点缀（可选） */
font-family: 'Press Start 2P', monospace;
```

### Google Fonts 导入

```css
@import url('https://fonts.googleapis.com/css2?family=Crimson+Text:wght@400;600;700&family=Inter:wght@400;500;600&display=swap');
```

---

## 动画配置

### 原则
- 动画柔和、不突兀
- 模拟实体物品的移动感
- 避免过度现代的弹跳效果

### 时长
| 场景 | 时长 |
|------|------|
| Hover | 200ms |
| 卡片翻转 | 400ms |
| 面板展开 | 300ms |

### CSS
```css
transition: all 200ms ease;
```

---

## 禁用状态

```tsx
className={`
  disabled:opacity-50
  disabled:pointer-events-none
`}
```

---

## 设计原则

### ✅ 推荐

- 使用暖色调（米色、棕色）而非冷灰色
- 正文使用衬线字体
- 适当使用角落装饰
- 保持"印刷品"的扁平感

### ❌ 避免

- 冷灰色（gray-100 等）
- 重度渐变
- 过度毛玻璃效果
- 过于现代的动画

---

## 使用示例

```markdown
# 经典桌游 UI 设计

> 基于：`design-system/styles/classic-parchment.md`

## 专属配置

- 使用 Crimson Text 作为主字体
- 卡片使用角落装饰
- 背景添加纸质纹理
```
