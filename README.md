# BoardGame

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/) [![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org/) [![Game Engine](https://img.shields.io/badge/Game_Engine-自研-FF6B6B)](src/engine/) [![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1-06B6D4?logo=tailwindcss)](https://tailwindcss.com/) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

BoardGame 是桌游教学与多人联机平台，支持实时对战、本地同屏、交互式教程、社交、后台管理和素材发布。

在线体验：[easyboardgame.top](https://easyboardgame.top)

## 关键能力

- 多人房间：创建、加入、观战、重赛、行动日志和撤回。
- 教学体验：教程引擎、AI 演示和分步引导。
- 多游戏运行时：每个游戏在 `src/games/<gameId>/` 独立接入，共享引擎能力在 `src/engine/`。
- 资源链路：图片、音频、图集、语言包和资源清单统一发布。
- 后台与社交：认证、好友、消息、反馈、管理后台和系统健康检查。

## 技术栈

- 前端：React 19、TypeScript、Vite、Tailwind CSS、Framer Motion、Three.js、React Router、TanStack Query、i18next。
- 后端：Koa、Socket.IO、NestJS、MongoDB、Redis、Winston。
- 工程：Docker、GitHub Actions、Playwright、Vitest、Capacitor。

## 目录入口

| 路径 | 职责 |
| --- | --- |
| [`.spec/`](.spec/AGENTS.md) | AI 规范、skill、知识导航和硬边界 |
| [`openspec/`](openspec/AGENTS.md) | 产品规格、提案和任务编排 |
| [`src/games/`](src/games/) | 单游戏实现 |
| [`src/engine/`](src/engine/) | 共享规则引擎、传输、事件、AI 和撤回能力 |
| [`apps/api/`](apps/api/) | NestJS API 服务 |
| [`server.ts`](server.ts) | 游戏服务器入口 |
| [`scripts/`](scripts/) | 构建、资源、发布和诊断脚本 |
| [`docs/`](docs/README.md) | 项目事实资料、工具参考和历史说明 |
| [`evidence/`](evidence/README.md) | 审计证据、截图账本和收口记录 |

AI 协作先读根 [`AGENTS.md`](AGENTS.md)，再进入 [`.spec/AGENTS.md`](.spec/AGENTS.md)。`docs/` 不承载 AI 执行规范。

## 快速开始

要求：

- Node.js 24.1.0，以 [`.nvmrc`](.nvmrc)、[`.node-version`](.node-version) 和 [`package.json`](package.json) 为准。
- Git。
- Docker 可选；完整本地环境建议使用 Docker 跑 MongoDB。

```bash
git clone https://github.com/zhuanggenhua/BoardGame.git
cd BoardGame
npm install
cp .env.example .env
```

Windows 可把 `cp` 换成 `copy`。

完整开发环境：

```bash
npm run dev
```

轻量本地体验：

```bash
npm run dev:lite
```

`dev:lite` 使用内存存储并跳过 API，适合快速打开页面；认证、社交和管理后台等依赖 API 的能力不可用。

## 新增游戏

新增游戏走项目 AI 工作流，不在 README 里复制步骤。入口：

- 新游戏创建： [`.spec/skills/create-new-game/SKILL.md`](.spec/skills/create-new-game/SKILL.md)
- 数据录入： [`.spec/skills/data-entry-workflow/SKILL.md`](.spec/skills/data-entry-workflow/SKILL.md)
- 规则审计： [`.spec/skills/game-audit-workflow/SKILL.md`](.spec/skills/game-audit-workflow/SKILL.md)
- E2E 证据标准： [`.spec/knowledge/standards/e2e-verification.md`](.spec/knowledge/standards/e2e-verification.md)

给 AI 的输入优先包括：规则来源、素材来源、目标游戏范围、验收口径和是否需要联机 / AI / 教程。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动完整开发环境 |
| `npm run dev:lite` | 启动轻量本地体验 |
| `npm run build` | 构建前端 |
| `npm run typecheck` | TypeScript 检查 |
| `npm run lint` | ESLint 检查 |
| `npm test` | 全量测试 |
| `npm run test:e2e` | Playwright E2E |
| `npm run spec:lint` | AI 规范结构校验 |
| `npm run assets:manifest` | 生成资源清单 |
| `npm run compress:images` | 压缩图片资源 |
| `npm run compress:audio` | 压缩音频资源 |
| `npm run assets:upload` | 上传资源到服务器素材主源 |

新增或修改音频后，按 [`docs/audio/audio-usage.md`](docs/audio/audio-usage.md) 处理压缩、注册表和上传。

## 部署

本地 Docker 验证：

```bash
docker compose up -d
```

生产部署和回滚流程见 [`docs/deploy.md`](docs/deploy.md)。移动端发布见 [`docs/mobile-release.md`](docs/mobile-release.md)。

## 文档

- [`docs/README.md`](docs/README.md)：文档职责与入口。
- [`docs/architecture.md`](docs/architecture.md)：技术架构。
- [`docs/framework/frontend.md`](docs/framework/frontend.md)：前端框架。
- [`docs/framework/backend.md`](docs/framework/backend.md)：后端框架。
- [`docs/api/README.md`](docs/api/README.md)：API 文档。
- [`docs/automated-testing.md`](docs/automated-testing.md)：测试入口。
- [`docs/deploy.md`](docs/deploy.md)：部署入口。

## 贡献

公开仓库可以直接 clone 和本地运行。没有主仓写权限的协作者通过 fork + Pull Request 贡献；维护者或受邀协作者才直接 push 主仓。

普通代码 PR 不需要生产服务器 SSH 私钥、服务器主机指纹或部署权限。涉及发布、素材上传或远端回查时，按对应项目流程单独授权。

## 许可证

代码基于 [MIT License](LICENSE) 开源。桌游图片素材来自对应桌游官方图包和民间汉化，仅供学习交流使用，不可商用。

## 赞助

<p align="center">
  <img src="public/logos/weixin.jpg" alt="微信赞助二维码" width="250" />
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="public/logos/zhifubao.jpg" alt="支付宝赞助二维码" width="250" />
</p>
