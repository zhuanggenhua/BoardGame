# 桌游教学与多人联机平台


[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/) [![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org/) [![Custom Engine](https://img.shields.io/badge/Game_Engine-自研-FF6B6B)](src/engine/) [![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1-06B6D4?logo=tailwindcss)](https://tailwindcss.com/) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

AI 驱动的现代化桌游平台，专注于**桌游教学**与**联机对战**

支持多人实时对战、本地同屏、交互式教学，提供完整的大厅、社交、创作工具与管理后台。

> **在线体验**：[easyboardgame.top](https://easyboardgame.top)

## 📑 目录

- [✨ 特性](#-特性)
- [🏗️ 技术栈](#️-技术栈)
- [📦 项目结构](#-项目结构)
- [🚀 快速开始](#-快速开始)
- [🎮 添加新游戏](#-添加新游戏)
- [🐳 Docker 部署](#-docker-部署)
- [🛠️ 常用命令](#️-常用命令)
- [🧪 测试](#-测试)
- [📄 文档](#-文档)
- [🤝 贡献](#-贡献)
- [📜 许可证](#-许可证)
- [💖 赞助](#-赞助)

<details>
<summary>作者的话</summary>

整个项目几乎只有这里不是 AI 生成的

事情的起因只是想让不想阅读说明书的朋友能够快速入坑桌游，加上看到谷歌反重力能够自动化测试，便想着如果代价足够低，没有比直接做成游戏更好的教学方式了

于是乎开始市场调研，BGA 和其他桌游电子化平台主要覆盖的都是德式游戏，还是有一定缺口，也就意味着这件事有实现的价值

然后就是半个多月从早到晚猛蹬 AI，反重力的自动化测试确实惊艳，但也仅限于静态网页，一旦到游戏就很难覆盖，最终还是高估了 AI（笑）。框架搭建完成后，简单的游戏比如大杀四方还是要花三四天，一天实现改三天bug，离我预期的挂机就能出游戏还有些差距

期间 AI 桌游引擎的尝试算是彻底失败了，本来想着只要分层分模块将游戏的需求拆解，让 AI 达到百分百的正确率就能实现自然语言编程，结果还是不如直接生成代码方便。还是新出现的 Project Genie 和 TapTap 制造比较好，一步到位，如果未来真的有元宇宙，那么人人都能创造游戏可能就是其中的基石

废话到此为止吧，现在我得忙活自己的游戏和找工作的事情，暂时只能进行维护工作

最后是未来规划要做的游戏，如果真的有人在玩的话……（不会考虑已经存在的电子版）：
+ 召唤师战争六个新阵营+雇佣兵阵营（优先级中）
+ 法师战争（优先级中）
+ 石器时代（优先级低，至少还是要一个德式）

> 还有一个想法是爬取规则文档作为知识库，添加一个规则问答助手，就不用看繁重的QA文本，也不怕村规了，这个只有等有时间再琢磨了
</details>

## ✨ 特性

- **多人实时对战** — 基于自研游戏框架 + Socket.IO，功能有房间创建/加入/观战/重赛/日志/撤回，内置乐观更新引擎实现低延迟操作体验
- **丰富的游戏库** — 召唤之战 (Summoner Wars)、王权骰铸 (Dice Throne)、Smash Up、井字棋等
- **本地同屏模式** — 同一设备上和朋友面对面对战
- **交互式教程** — 内置 Tutorial 引擎，支持 AI 自动演示和分步引导
- **社交系统** — 好友、聊天、对局邀请、战绩查看
- **游戏工具** — 预览特效与音频，快速切图等，音频来自购买的素材包
- **~~简易原型工具（搁置）~~** — 可视化游戏原型构建器，快速验证规则想法
- **国际化 (i18n)** — 中英双语支持
- **管理后台** — 用户管理、房间监控、反馈处理、系统健康检查
- **Docker 一键部署** — 同域 / Cloudflare Pages 分离部署均可

## 🏗️ 技术栈
<details>
<summary>为什么选择前端</summary>

一者是最适宜 AI，能全自动完成和测试；二者是在不追求华丽表现的情况下游戏引擎对于桌游这类规则独特的游戏帮助不是很大；三者是完全不需要美术素材

</details>

**前端**：React 19 · TypeScript · Vite · Tailwind CSS · Framer Motion · Three.js · React Router · TanStack Query · i18next

**后端**：自研游戏引擎 (Koa + Socket.IO) · NestJS · MongoDB · Redis · Winston (日志系统)

**基础设施**：Docker · Docker Compose · GitHub Actions CI/CD · Cloudflare Pages / R2

## 📦 项目结构

```
├── src/
│   ├── games/           # 游戏实现（每个游戏一个目录）
│   ├── engine/          # 引擎层（Undo / Flow / Prompt / Tutorial / EventStream / Transport 等系统）
│   ├── components/      # UI 组件（大厅 / 对局 / 社交 / 管理后台）
│   ├── contexts/        # React Context（Auth / Audio / Social / Modal 等）
│   ├── services/        # Socket 服务（lobby / match / social）
│   ├── ugc/             # 简易原型构建工具与运行时
│   └── server/          # 服务端共享模块（DB / 存储 / 模型）
├── server/              # 服务端基础设施
│   ├── logger.ts        # Winston 日志系统
│   └── middleware/      # Koa 中间件（日志 / 错误处理）
├── logs/                # 日志文件目录（自动轮转）
├── apps/api/            # NestJS API 服务（认证 / 管理 / 社交）
├── server.ts            # 游戏服务器入口（Koa + GameTransportServer）
├── docker/              # Dockerfile 与 Nginx 配置
├── scripts/             # 构建 / 部署 / 资源处理脚本
├── docs/                # 项目文档
│   └── logging-system.md  # 日志系统文档
└── e2e/                 # Playwright 端到端测试
```

## 🚀 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) >= 18
- [Git](https://git-scm.com/)
- [Docker](https://www.docker.com/)（可选，用于 MongoDB）

### 安装与启动

```bash
# 克隆仓库
git clone https://github.com/zhuanggenhua/BoardGame.git
cd BoardGame

# 安装依赖
npm install

# 复制环境变量模板
cp .env.example .env
```

> **Windows 用户**：将 `cp` 替换为 `copy`。

#### 方式一：使用 Docker（推荐，数据持久化）

```bash
npm run dev
```

#### 方式二：无 Docker（纯内存模式，适合快速体验）

无需安装 Docker 和 MongoDB，对局数据存在内存中，重启后丢失。

```bash
npm run dev:lite
```

启动后访问 http://localhost:5173 即可。

### 环境变量

开发环境只需复制 `.env.example` 即可运行，无需额外配置。核心变量：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `VITE_DEV_PORT` | `5173` | 前端开发端口 |
| `GAME_SERVER_PORT` | `18000` | 游戏服务端口 |
| `API_SERVER_PORT` | `18001` | API 服务端口 |
| `MONGO_URI` | `mongodb://localhost:27017/boardgame` | 数据库连接 |
| `JWT_SECRET` | 开发默认值 | JWT 密钥（生产环境必须修改） |

完整说明见 [.env.example](.env.example)。

## 🎮 添加新游戏

项目内置了完整的 AI 辅助创建工作流，分 6 个阶段逐步完成（骨架 → 类型 → 领域逻辑 → 系统组装 → UI → 收尾）。

使用支持 Skill 的 AI 编辑器（或者直接扔文档），调用 `.windsurf/skills/create-new-game` 技能即可开始，AI 会引导你完成全部流程……大概。

可以开新分支提pr，我会用ai审核

<details>
<summary>模型选择建议</summary>

如果把编程比作建造高楼，那么 GPT 是坚实的地基和每层的承重柱，Claude 是建筑的设计师并能快速添砖加瓦，Gemini 就是最后的装修

- **GPT**：最听话最稳定，排查 bug 和审查代码的首选，就是太过啰嗦导致规划任务比较耗人脑，写的代码也不够整洁，慢是最大的缺点
- **Claude**：规划任务和进行决策都很出色，体感代码质量最好，但容易没有充分阅读项目就开始动手，所以还是需要 GPT 审查兜底。似乎有更高的正确性（有点不好形容，但claude的决策是需要人工干预最少的，有些让gpt死循环的问题也能给出正确答案）
- **Gemini**：前端唯一真神，识图能力强于 Claude，很适合通过规则 PDF 和卡图来生成数据（大部分情况需要手动截图不然也不准），但干其他活容易改一个出一个bug

个人的省钱组合：windsurf/warp + kiro 阉割版claude + 反重力
> 单开编辑器容易被限流，因为很多时候同时有十多条任务在跑
> 小tip：使用规范驱动开发，claude写完后gpt立刻审核一遍，每次提交再审核一遍应该能大幅减少ai错误
</details>


## 🐳 Docker 部署

### 本地验证

```bash
docker compose up -d
# 访问 http://localhost:3000
```

### 生产部署（推荐镜像部署）

服务器上只需 Docker，无需克隆仓库。脚本会自动下载 compose 文件、引导配置环境变量、拉取镜像并启动：

```bash
# 下载部署脚本并执行（首次部署会进入交互式配置向导）
curl -fsSL https://raw.githubusercontent.com/zhuanggenhua/BoardGame/main/scripts/deploy/deploy-image.sh -o deploy.sh
bash deploy.sh

# 后续更新
bash deploy.sh update
```

> 前置要求：服务器已安装 Docker 和 Docker Compose（`docker compose` 命令可用）。

详细部署文档见 [docs/deploy.md](docs/deploy.md)。

## 🛠️ 常用命令

```bash
npm run dev              # 启动完整开发环境
npm run build            # 构建前端
npm run generate:manifests  # 重新生成游戏清单
npm run generate:locales    # 生成卡牌多语言文件
npm run compress:images     # 压缩图片资源
npm run compress:audio      # 压缩音频资源（wav → ogg）
npm run assets:manifest     # 生成资源清单
npm run check:arch          # 架构检查

# 音频注册表 & 资源上传（新增/修改音频文件后必须执行）
node scripts/audio/generate_common_audio_registry.js  # 重新生成音频注册表
npm run assets:upload    # 上传压缩资源到 R2（需配置 R2_* 环境变量）
```

> **注意**：新增或修改音频文件后，需要依次执行 `compress:audio` → `generate_common_audio_registry.js` → `assets:upload`，否则远程 `registry.json` 缺少新 key 会导致音频无法播放。

## 🧪 测试

项目采用**完全隔离的测试架构**，测试环境与开发环境使用不同端口，互不干扰。

- **Vitest 单元测试** — 游戏领域逻辑、引擎系统、API 服务等（2500+ 测试用例，99.4% 通过率）
- **GameTestRunner** — 游戏领域专用测试运行器，输入命令序列 → 执行 pipeline → 断言最终状态
- **Playwright E2E** — 端到端集成测试

### 端口架构（完全隔离）

| 环境 | 前端 | 游戏服务器 | API 服务器 | 说明 |
|------|------|-----------|-----------|------|
| **开发环境** | 3000 | 18000 | 18001 | `npm run dev` |
| **E2E 测试** | 5173 | 19000 | 19001 | `npm run test:e2e` |
| **并行测试 Worker 0** | 6000 | 20000 | 20001 | `npm run test:e2e:parallel` |
| **并行测试 Worker 1** | 6100 | 20100 | 20101 | 每个 worker +100 |

**核心优势**：
- ✅ 测试与开发完全隔离，互不影响
- ✅ 可以同时运行开发服务器和测试
- ✅ 测试失败不会影响开发环境
- ✅ 支持并行测试，每个 worker 独立端口

### 快速开始

```bash
# 运行所有单元测试（~46秒）
npm test

# 运行特定游戏的测试（推荐开发时使用）
npm run test:summonerwars    # Summoner Wars (~6秒)
npm run test:smashup         # Smash Up (~8秒)
npm run test:dicethrone      # Dice Throne (~12秒)

# 运行核心框架测试
npm run test:core            # 引擎、组件、工具库 (~5秒)

# 运行所有游戏测试
npm run test:games
```

### E2E 测试（完全隔离）

**默认模式**（推荐，自动启动独立测试服务器）：

```bash
# 直接运行，会自动启动测试服务器（端口 5173, 19000, 19001）
npm run test:e2e

# 检查配置和端口占用情况
npm run test:e2e:check

# 清理测试环境端口（测试异常退出时使用）
npm run test:e2e:cleanup
```

**开发模式**（使用开发服务器，不推荐）：

```bash
# 设置环境变量使用开发服务器（端口 3000, 18000, 18001）
PW_USE_DEV_SERVERS=true npm run test:e2e
```

**并行模式**（实验性，适用于大量测试）：

```bash
# 方式 1：手动启动每个 worker 的服务器（推荐）
# 终端 1: Worker 0 (端口 6000, 20000, 20001)
npm run test:e2e:worker 0

# 终端 2: Worker 1 (端口 6100, 20100, 20101)
npm run test:e2e:worker 1

# 终端 3: 运行并行测试
npm run test:e2e:parallel

# 方式 2：自动启动（需要更多配置）
PW_WORKERS=3 npm run test:e2e:parallel

# 清理指定 worker 的端口
node scripts/infra/port-allocator.js 0  # 清理 Worker 0
node scripts/infra/port-allocator.js 1  # 清理 Worker 1
```

### 测试模式对比

| 模式 | 命令 | 端口 | 启动服务器 | 影响开发环境 | 适用场景 |
|------|------|------|-----------|-------------|----------|
| **默认模式** | `npm run test:e2e` | 5173, 19000, 19001 | ✅ 自动启动 | ❌ 不会 | 日常测试（推荐） |
| **开发模式** | `PW_USE_DEV_SERVERS=true npm run test:e2e` | 3000, 18000, 18001 | ❌ 使用已有 | ⚠️ 可能 | 调试测试代码 |
| **并行模式** | `npm run test:e2e:parallel` | 6000+, 20000+, 20001+ | ✅ 自动启动 | ❌ 不会 | 大量测试 |

### 清理命令

```bash
# 清理测试环境端口（5173, 19000, 19001）
npm run test:e2e:cleanup

# 清理开发环境端口（3000, 18000, 18001）
npm run test:e2e:cleanup -- --dev

# 清理两个环境
npm run test:e2e:cleanup -- --e2e --dev

# 清理并行测试 worker 端口
node scripts/infra/port-allocator.js 0  # Worker 0
node scripts/infra/port-allocator.js 1  # Worker 1
```

### 常见问题

- ❌ 测试超时/连接失败 → 检查测试服务器是否启动成功（查看终端日志）
- ❌ 端口被占用 → 运行 `npm run test:e2e:cleanup` 清理测试环境
- ❌ 开发服务器受影响 → 确认未设置 `PW_USE_DEV_SERVERS=true`
- ❌ WebSocket 连接失败 → 检查防火墙设置，确认端口未被其他程序占用

### 测试覆盖情况

| 模块 | 测试文件 | 测试用例 | 通过率 | 运行时间 |
|------|---------|---------|--------|---------|
| Summoner Wars | 35 | 717 | ✅ 100% | ~6s |
| Smash Up | 48 | 817 | ⚠️ 97.9% | ~8s |
| Dice Throne | 31 | 471 | ✅ 100% | ~12s |
| 核心框架 | ~30 | ~300 | ✅ 100% | ~5s |
| **总计** | **193** | **2513** | **99.4%** | **~46s** |

详见 [自动化测试文档](docs/automated-testing.md)。

## 📄 文档

- [**架构可视化**](docs/architecture-visual.svg) — 动画 SVG，一图看懂整体架构与管线流程
- [架构设计文档](docs/architecture.md) — 完整技术架构说明
- [部署指南](docs/deploy.md) — 同域 / Pages 分离 / 镜像部署完整说明
- [前端框架](docs/framework/frontend.md) — 游戏 UI 框架与组件约定
- [后端框架](docs/framework/backend.md) — API 与游戏服务架构
- [API 文档](docs/api/README.md) — 认证、社交、管理等接口说明
- [原型构建器](docs/ugc-builder.md) — 简易游戏原型工具
- [自动化测试](docs/automated-testing.md) — 测试策略与实践


## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'Add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

## 📜 许可证

本项目代码基于 [MIT License](LICENSE) 开源。

游戏图片素材来自对应桌游的官方图包和民间汉化，版权归原作者所有，仅供学习交流使用，不可商用。


## 💖 赞助

如果喜欢这个项目，可以支持一点维护服务器的钱。我会在关于中展示您的昵称信息（不需要也可以备注）。

<p align="center">
  <img src="public/logos/weixin.jpg" alt="微信赞助二维码" width="250" />
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="public/logos/zhifubao.jpg" alt="支付宝赞助二维码" width="250" />
</p>