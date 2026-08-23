# 项目工具脚本索引

本文只做 `scripts/` 的稳定导航，不维护全量文件清单。查精确脚本位置用 `rg --files scripts`，查用法优先读脚本头部、`package.json` scripts 和对应专项文档。

## 目录职责

| 目录 | 职责 |
| --- | --- |
| `scripts/audio/` | 音频压缩、registry、候选目录和迁移工具 |
| `scripts/assets/` | 图片压缩、图集扫描、manifest、上传、下载和服务器资源发布 |
| `scripts/deploy/` | 服务器部署、镜像输送、部署 runner、CPU 现场留档 |
| `scripts/mobile/` | Android / iOS OTA、native、游戏包发布与移动端配置 |
| `scripts/release/` | 组合发布、版本准备、changelog 和 push 编排 |
| `scripts/infra/` | 本地开发服务器、E2E runtime、端口、架构检查、PDF 转换 |
| `scripts/verify/` | 验证类脚本和专项 guard |
| `scripts/db/` | 数据库初始化、诊断和反馈状态维护 |
| `scripts/game/`、`scripts/games/` | 游戏 manifest、卡牌本地化、单游戏辅助脚本 |
| `scripts/ugc/` | UGC 预览生成与发布 |
| `scripts/alipan_save_tool/` | 阿里云盘分享转存工具 |
| `scripts/image-viewer-mcp/` | 本地图片查看 MCP 服务 |

根目录下历史修复脚本、一次性分析脚本和专项迁移脚本不作为新任务默认入口。修改或复用前先确认它是否仍有当前职责。

## 常用入口

| 目标 | 命令 |
| --- | --- |
| 正式素材图片压缩 | `npm run compress:images -- --clean <资源根>` |
| 展示图图片压缩 | `npm run compress:display-images -- <展示图资源根>` |
| 音频压缩 | `npm run compress:audio -- --clean` |
| 资源 manifest | `npm run assets:manifest` |
| 资源校验 | `npm run assets:validate` |
| 服务器资源上传 | `npm run assets:upload` |
| 按游戏补齐服务器资源 | `npm run assets:download -- --game <gameId>` |
| 图集网格扫描 | `npm run atlas:scan -- <image> --rows <rows> --cols <cols>` |
| PDF 转 Markdown | `npm run pdf:md -- <pdf路径> -o <md路径>` |
| 模拟房主流程 | `npx tsx scripts/infra/simulate-host.ts` |
| E2E 单 worker 服务 | `node scripts/infra/start-single-worker-servers.js` |
| Android 发布 | `node scripts/mobile/release-android.mjs <ota|native|packages>` |
| 完整部署 + OTA | `node scripts/release/deploy-and-ota.mjs` |
| 结构规范校验 | `npm run spec:lint` |

## 专项主源

| 主题 | 主源 |
| --- | --- |
| 资源路径、manifest、服务器主源 | [`asset-pipeline`](../.spec/knowledge/standards/asset-pipeline.md) |
| 音频 registry、共享音频包 | [`audio-assets`](../.spec/knowledge/standards/audio-assets.md) 与 [`audio-integration`](../.spec/skills/audio-integration/SKILL.md) |
| E2E runtime、端口和截图证据 | [`automated-testing`](automated-testing.md) 与 [`e2e-verification`](../.spec/knowledge/standards/e2e-verification.md) |
| 生产部署 | [`deploy-after-ci`](../.spec/skills/deploy-after-ci/SKILL.md) 与 [`deploy`](deploy.md) |
| Android 发布 | [`android-app-release`](../.spec/skills/android-app-release/SKILL.md) 与 [`mobile-release`](mobile-release.md) |
| 临时产物归位 | [`temp-files-management`](temp-files-management.md) |

## 参数边界

- 正式对局素材默认不降采样；`runtime` 模式下设置最大边长需要用户当轮明确授权。
- 图集扫描建议对运行时实际消费的 `compressed/*.webp` 执行，避免源图与前端裁剪尺寸漂移。
- `assets:download` 默认按明确游戏下载；无目标、`--list` 和共享测试不得扩大成全站镜像。
- 临时裁图、OCR、截图、探针输出和下载样本放 `temp/` 或 `tmp/`，不要放仓库根目录。
- 项目脚本默认在仓库根目录执行。
