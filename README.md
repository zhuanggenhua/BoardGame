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

## ✨ 特性

- **多人实时对战** — 基于自研游戏框架 + Socket.IO，功能有房间创建/加入/观战/重赛/日志/撤回，内置乐观更新引擎实现低延迟操作体验
- **丰富的游戏库** — 召唤之战 (Summoner Wars)、王权骰铸（Dice Throne / dicethrone / 王权）、Smash Up、井字棋等
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

**基础设施**：Docker · Docker Compose · GitHub Actions CI/CD · 服务器素材主源 / 公开资源域名

## 📦 项目结构

```
├── .spec/              # AI 规范唯一真相源（Agent / Skill / knowledge / rules）
├── openspec/           # 产品规格、提案和任务编排
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
├── docs/                # 项目事实资料、规则来源、工具参考和历史说明
├── evidence/            # 可复查证据、截图账本和审计结论
├── temp/                # 临时数据、探针输出和中间截图（不入 Git）
├── test-results/        # 测试结果和可引用测试产物（不入 Git）
└── e2e/                 # Playwright 端到端测试
```

更细的文档落点见 [`docs/README.md`](docs/README.md)；项目文档链接格式见 [`documentation-style`](.spec/knowledge/standards/documentation-style.md)。

## 🚀 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) 24.1.0（以 `.nvmrc`、`.node-version`、`package.json#engines.node` 为准）
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

`npm run dev` 会先尝试拉起本地 `mongodb` 容器；如果当前 shell 没有显式配置 `MONGO_URI`，且检测到 `127.0.0.1:27017` 有可用本地 Mongo，则会自动注入开发默认值 `mongodb://127.0.0.1:27017/boardgame`。

#### 方式二：无 Docker（纯内存模式，适合快速体验）

无需安装 Docker 和 MongoDB。该模式会让游戏服退回纯内存存储，并跳过 API 启动；重启后数据会丢失。游戏运行时素材直接读取公开资源域名，因此新 clone 不需要先下载完整素材镜像。
该模式会自动跳过排行榜归档、UGC 动态注册等依赖游戏服持久化存储的能力；认证、社交、管理后台等依赖 API 的能力在该模式下不可用。

```bash
npm run dev:lite
```

启动后访问 http://localhost:4273 即可；若该端口已被占用，启动日志会显示自动选出的本地地址。

### 环境变量

开发环境只需复制 `.env.example` 即可运行。核心变量：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `VITE_DEV_PORT` | `5173` | 前端开发端口 |
| `GAME_SERVER_PORT` | `18000` | 游戏服务端口 |
| `API_SERVER_PORT` | `18001` | API 服务端口 |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/boardgame`（推荐显式配置；`npm run dev` 在检测到本地 Mongo 时可自动注入） | 数据库连接 |
| `JWT_SECRET` | 开发默认值 | JWT 密钥（生产环境必须修改） |

完整说明见 [.env.example](.env.example)。

## 🎮 添加新游戏

项目内置了完整的 AI 辅助创建工作流，分 6 个阶段逐步完成（骨架 → 类型 → 领域逻辑 → 系统组装 → UI → 收尾）。

协作者首次配置环境时，可以展开复制下面的提示词交给自己的 AI；GitHub 会给代码块右上角提供复制按钮。

<details>
<summary>展开复制：从零配置本机环境并克隆项目</summary>

```text
请把 BoardGame 配置到本机可打开页面。用户是编程新手；环境验证完成后停止，等待具体游戏需求。

仓库：https://github.com/zhuanggenhua/BoardGame.git

执行要点：
- 用中文说明关键动作和结果，能直接执行的安装、克隆、配置、启动和验证动作就直接执行。
- 准备 Git、Node.js 24.1.0、npm 和浏览器；Node 以当前终端 `node -v` 为准。
- 克隆仓库后读取仓库入口文档，按项目规范加载本地启动和新增游戏相关入口。
- 执行 `npm install`，按 `.env.example` 创建本地 `.env`。
- 优先用 `npm run dev:lite` 验证本地页面可访问；缺 Docker 或 MongoDB 时按轻量本地启动处理。
- 范围到本地制作环境和新增游戏前置准备为止。

收尾汇报：Git / Node / npm 版本、项目路径、本地访问地址、启动模式、是否可以开始新增游戏；如遇阻塞，说清现实后果、证据和最小补救动作。
```

</details>

准备添加新游戏时，把游戏需求交给支持项目规范的 AI 编辑器即可，它会按仓库内工作流引导你完成。

数据录入使用的截图工具推荐pixpin

可以开新分支提pr，我会用ai审核

<details>
<summary>模型选择建议</summary>


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

# 手动回滚到上次成功部署版本
bash deploy.sh rollback-last

# 拉取慢时，先单独拉镜像再 update（避免 compose pull 并发抢带宽）
docker pull ghcr.io/zhuanggenhua/boardgame-game:latest
docker pull ghcr.io/zhuanggenhua/boardgame-web:latest
bash deploy.sh update
```

> 前置要求：服务器已安装 Docker 和 Docker Compose（`docker compose` 命令可用）。

详细部署文档见 [docs/deploy.md](docs/deploy.md)。

## 🛠️ 常用命令

```bash
npm run dev                # 启动完整开发环境
npm run dev:lite           # 启动纯内存快速体验模式
npm run build              # 构建前端
npm run generate:manifests # 重新生成游戏清单
npm run generate:locales   # 生成卡牌多语言文件
npm run compress:images    # 压缩图片资源
npm run compress:audio     # 压缩音频资源（wav → ogg）
npm run assets:manifest    # 生成资源清单
npm run check:arch         # 架构检查

# 音频注册表 & 资源上传（新增/修改音频文件后必须执行）
node scripts/audio/generate_common_audio_registry.js  # 重新生成音频注册表
npm run assets:download -- --game <gameId> # 按游戏从服务器下载本地运行时素材
npm run assets:upload    # 上传压缩资源到服务器素材主源

```

> **注意**：新增或修改音频文件后，需要依次执行 `compress:audio` → `generate_common_audio_registry.js` → `assets:upload`，否则服务器素材主源的 `registry.json` 缺少新 key 会导致音频无法播放。

## 🧪 测试

- **Vitest 单元测试** — 游戏领域逻辑、引擎系统、API 服务等（2500+ 测试用例，99.4% 通过率）
- **GameTestRunner** — 游戏领域专用测试运行器，输入命令序列 → 执行 pipeline → 断言最终状态
- **Playwright E2E** — 端到端集成测试

### 快速开始

```bash
# 运行所有单元测试
npm test

# 运行特定游戏的测试
npm run test:summonerwars
npm run test:smashup
npm run test:dicethrone

# 运行 E2E 测试
npm run test:e2e

# 本机没有 Playwright Chromium 时，可临时使用已安装的 Edge 或 Chrome
npx cross-env PW_BROWSER_CHANNEL=msedge npm run test:e2e
npx cross-env PW_BROWSER_CHANNEL=chrome npm run test:e2e
```

详见 [自动化测试文档](docs/automated-testing.md)。

## 📄 文档

- [**文档总入口**](docs/README.md) — 按职责说明 docs、openspec、evidence、.spec/skills 和游戏规则文档该从哪里读
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

公开仓库允许直接 clone、拉取和本地运行；fork 不是为了“看代码”，而是为了给没有主仓写权限的协作者提供一个自己可写的远端仓库。只有维护者或已受邀协作者能直推 `zhuanggenhua/BoardGame`；如果直推主仓遇到 `403` 或 `Write access to repository not granted`，这只是说明当前账号不能写上游主仓，不代表项目不可协作。

只想拉项目或本地体验时，直接 clone 主仓即可：

```bash
git clone https://github.com/zhuanggenhua/BoardGame.git
```

准备提交代码贡献时，外部协作者默认走 fork 后 Pull Request：

1. 在 GitHub 上 fork `zhuanggenhua/BoardGame` 到自己的账号。
2. Clone 自己的 fork，并添加主仓为 `upstream`：
   ```bash
   git clone https://github.com/<your-account>/BoardGame.git
   cd BoardGame
   git remote add upstream https://github.com/zhuanggenhua/BoardGame.git
   git fetch upstream
   ```
3. 从主仓最新代码创建特性分支：`git checkout -b feature/amazing-feature upstream/main`
4. 提交更改：`git commit -m "用中文准确描述改动"`
5. 推送到自己的 fork：`git push origin feature/amazing-feature`
6. 向 `zhuanggenhua/BoardGame` 的 `main` 分支创建 Pull Request。

更新主分支、同步 PR 或遇到冲突时，协作者不需要自己手动解。把现场交给 AI，让它按项目 Git 工作流处理，并用人话询问必要选择。

也可以先直接 clone 主仓再添加自己的 fork 作为可写远端；关键不是 clone 哪个仓库，而是不要把没有权限的上游主仓当作 push 目标。只有确认自己拥有主仓写权限时，才直接 push `zhuanggenhua/BoardGame`。普通代码 PR 不需要生产服务器 SSH 私钥、服务器主机指纹或部署权限；这些只属于发布、素材上传或远端回查场景。

## 📜 许可证

本项目代码基于 [MIT License](LICENSE) 开源。

游戏图片素材来自对应桌游的官方图包和民间汉化，版权归原作者所有，仅供学习交流使用，不可商用。


## 💖 赞助

如果喜欢这个项目，可以请作者喝杯咖啡。如需要，可以备注加入到赞助列表。

<p align="center">
  <img src="public/logos/weixin.jpg" alt="微信赞助二维码" width="250" />
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="public/logos/zhifubao.jpg" alt="支付宝赞助二维码" width="250" />
</p>
