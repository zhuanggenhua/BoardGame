# 🎲 桌游教学与多人联机平台

> AI 驱动的现代化桌游平台，专注于**桌游教学**与**轻量级联机对战**

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Boardgame.io](https://img.shields.io/badge/Boardgame.io-0.50-FF6B6B)](https://boardgame.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)

---

## ✨ 核心特性

- 🎮 **多游戏支持** - 模块化游戏架构，轻松添加新游戏
- 📚 **教学模式** - 分步引导系统，帮助新手快速上手
- 🌐 **实时联机** - 基于 WebSocket 的毫秒级状态同步
- 🎨 **现代化 UI** - 流畅动画、响应式设计、深色模式
- 🤖 **AI 友好** - 清晰的 DOM 结构，便于 AI 辅助开发

---

## 🚀 快速开始

### 环境要求

- **Node.js** >= 18.x
- **npm** >= 9.x（或 pnpm/yarn）

### 安装与运行

```bash
# 克隆项目
git clone <repository-url>
cd BordGame

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

开发服务器启动后，访问 http://127.0.0.1:5174

### 其他命令

```bash
# 构建生产版本
npm run build

# 预览生产构建
npm run preview

# 代码检查
npm run lint
```

---

## 📁 项目结构

```
BordGame/
├── src/
│   ├── games/              # 游戏模块（每个游戏一个文件夹）
│   │   └── default/        # 默认游戏（井字棋）
│   │       ├── game.ts     # 游戏逻辑（Boardgame.io 配置）
│   │       └── Board.tsx   # 游戏 UI 组件
│   ├── components/         # 通用 UI 组件
│   ├── contexts/           # React Context（状态管理）
│   ├── assets/             # 静态资源
│   ├── App.tsx             # 应用入口组件
│   ├── main.tsx            # React 渲染入口
│   └── index.css           # 全局样式
├── public/                 # 公共静态文件
├── server.ts               # 游戏服务器（多人联机）
├── AGENTS.md               # AI 助手指令文档
└── package.json
```

---

## 🎮 已实现的游戏

| 游戏 | 状态 | 描述 |
|------|------|------|
| 井字棋 (Tic-Tac-Toe) | ✅ 完成 | 经典的 3x3 井字棋，支持本地对战 |

### 规划中的游戏

- 五子棋 (Gomoku)
- 黑白棋 (Reversi)
- 更多卡牌/棋类游戏...

---

## 🛠️ 技术栈

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.x | UI 框架 |
| TypeScript | 5.9 | 类型安全 |
| Vite | 7.x | 构建工具 |
| Tailwind CSS | 4.x | 原子化样式 |
| Boardgame.io | 0.50 | 游戏状态管理与网络同步 |

### 后端（规划中）

| 技术 | 用途 |
|------|------|
| Node.js (Koa) | API 服务器 |
| MongoDB | 用户数据、对局记录 |
| Docker | 容器化部署 |

---

## 📖 开发指南

### 添加新游戏

1. 在 `src/games/` 下创建新文件夹，例如 `gomoku/`
2. 创建 `game.ts`，定义游戏规则：

```typescript
import { Game } from 'boardgame.io';

export const Gomoku: Game = {
  name: 'gomoku',
  setup: () => ({ /* 初始状态 */ }),
  moves: {
    placePiece: ({ G, ctx }, x, y) => { /* 落子逻辑 */ },
  },
  endIf: ({ G, ctx }) => { /* 胜负判定 */ },
};
```

3. 创建 `Board.tsx`，实现游戏界面
4. 在 `App.tsx` 中注册新游戏

### 代码规范

- 使用 **TypeScript** 严格模式
- 遵循 **ESLint** 规则
- 组件使用 **函数式组件 + Hooks**
- 样式使用 **Tailwind CSS** 原子类

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

---

## 📄 许可证

MIT License © 2026
