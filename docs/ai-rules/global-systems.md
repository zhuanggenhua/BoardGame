# 全局系统与服务规范

> 本文档是 `AGENTS.md` 的补充，包含全局 Context 系统和实时服务层的详细规范。
> **触发条件**：使用/修改全局 Context、Toast、Modal、音频、教学、认证系统时阅读。

---

## 1. 通用 Context 系统 (`src/contexts/`)

所有全局系统均通过 Context 提供 API，**禁止**在业务组件内直接操作底层的全局 Variable。

- **Toast 通知系统 (`useToast`)**：
    - `show/success/warning/error(content, options)`。
    - 支持 `dedupeKey` 防抖，`error` 类型默认更长驻留。
- **弹窗栈系统 (`useModalStack`)**：
    - 采用类似路由的栈管理：`openModal`, `closeTop`, `replaceTop`, `closeAll`。
    - **规范**：所有业务弹窗必须通过 `openModal` 唤起，禁止自行在组件内维护独立的 `isVisible` 状态。
- **音频系统 (`useAudio` & `AudioManager`)**：
    - 统一管理 BGM 与 SFX。
    - **规范**：切换游戏时，必须通过 `stopBgm` 及 `playBgm` 重置音乐流。声音资源需经过 `compress_audio.js` 压缩。
- **教学系统 (`useTutorial`)**：
    - 基于 Manifest 的分步引导。支持 `highlightTarget` (通过 `data-tutorial-id`) 与 `aiMove` 模拟。
- **认证系统 (`useAuth`)**：
    - 管理 JWT 及 `localStorage` 同步。提供 `user` 状态与 `login/logout` 接口。
- **调试系统 (`useDebug`)**：
    - 运行时的 Player ID 模拟（0/1/Spectator）及 `testMode` 开关。

---

## 2. 实时服务层 (`src/lib/` & `src/services/`)

- **LobbySocket (`LobbySocketService`)**：
    - 独立于游戏传输层的 WebSocket 通道，用于：
        1. 大厅房间列表实时更新。
        2. 房间内成员状态（在线/离线）同步。
        3. 关键连接错误（`connect_error`）的上报。
    - **规范**：组件销毁时必须取消订阅或在 Context 层面统一维护。
- **引擎原语 (`src/engine/primitives/`)**：
    - 提供条件/效果/骰子/资源/目标/区域/表达式等通用工具，由游戏层按需组合实现具体机制。

---

## 3. 通用 UI 系统

- **GameHUD (`src/components/game/GameHUD.tsx`)**：
    - 游戏的"浮动控制中心"。整合了：
        1. 退出房间、撤销、设置。
        2. 多人在线状态显示。
        3. 音效控制入口。
    - **规范**：新游戏接入必须包含 GameHUD 或其变体。

---

## 4. 光标主题系统 (`src/core/cursor/`)

> **触发条件**：新增游戏光标主题、修改光标偏好逻辑、修改光标设置 UI 时阅读。

### 架构概览

```
src/core/cursor/
├── types.ts                     # CursorTheme / CursorPreference / CursorPreviewSvgs 类型
├── themes.ts                    # 注册表 + buildCursors + svgCursor + injectOutlineFilter
├── cursorStyles.ts              # 跨游戏共享样式模板（CursorStyleTemplate / createThemeFromStyle）
├── CursorPreferenceContext.tsx  # 全局偏好 Context（DB 持久化，仅登录用户）
├── cursorPreference.ts          # fetch/save API（GET/PUT /auth/user-settings/cursor）
├── GameCursorProvider.tsx       # 游戏内光标注入（<style> 作用域 CSS）
└── useGlobalCursor.ts           # 主页全局光标注入（<style id="global-cursor-style">）

src/games/<gameId>/cursor.ts     # 游戏自注册（调用 registerCursorThemes）
src/games/cursorRegistry.ts      # 统一 import 触发注册（在 src/main.tsx 引入）
```

### CursorPreference 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `cursorTheme` | `string` | 选中的主题 ID，`'default'` 表示系统光标 |
| `overrideScope` | `'home' \| 'all'` | 覆盖范围：仅主页 / 全部游戏 |
| `highContrast` | `boolean` | 高对比模式：注入白色外描边光晕（`injectOutlineFilter`） |
| `gameVariants` | `Record<string, string>` | 每个游戏记住的变体 ID（`gameId → themeId`），通过"更换"弹窗保存 |

### 新增游戏光标主题（强制流程）

1. 在 `src/games/<gameId>/cursor.ts` 定义 SVG + 调用 `registerCursorThemes()`
2. 在 `src/games/cursorRegistry.ts` 加一行 `import '../<gameId>/cursor'`
3. 在 `src/games/<gameId>/manifest.ts` 设置 `cursorTheme: '<themeId>'`

```typescript
// cursor.ts 最小模板（新增游戏约 10 行）
import { buildCursors, registerCursorThemes } from '../../core/cursor/themes';
const svgs = { default: `<svg .../>`, pointer: `<svg .../>` };
registerCursorThemes([{
    id: 'mygame', gameId: 'mygame', label: '我的游戏', variantLabel: '默认',
    previewSvgs: svgs, ...buildCursors(svgs),
}]);
```

多变体：在同一文件定义多个主题对象，一次性传入 `registerCursorThemes([theme1, theme2, ...])`。

### 共享样式模板

多游戏复用同一视觉风格时，在 `cursorStyles.ts` 定义 `CursorStyleTemplate`，游戏层用 `createThemeFromStyle()` 引用，不复制 SVG。

### 光标形态规范（强制）

- **default**：左上角为尖端的标准箭头，不得用对称/装饰性形状替代
- **pointer**：食指伸出的手形
- **grabbing**：握拳形状，**禁止**用火焰/闪电/准星等非手形替代；风格通过颜色/描边/装饰体现
- **zoomIn**：放大镜 + 加号
- **notAllowed**：圆形禁止符

### 设置弹窗交互逻辑（`CursorSettingsModal`）

- 点卡片 → 本地 `pending` 高亮，不保存（使用该游戏 `gameVariants` 记住的变体）
- 标题栏"更换" → 打开变体子弹窗，选变体后立即保存到 `gameVariants[gameId]`（改变该游戏的默认变体），同时更新 `pending`；若该游戏已是当前生效的，同步更新 `cursorTheme`
- "设为当前" → 保存 `cursorTheme` 到 DB（`isDirty` 时可点）
- 高对比 / 覆盖范围 → 即时保存（独立偏好，不走 pending 流程）
- 主网格卡片预览：优先显示 `gameVariants[gameId]` 记住的变体，回退到注册表第一个
