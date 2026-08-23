# Docker 构建优化事实

本文记录当前 Docker 构建加速点。生产发布入口见 [`deploy`](deploy.md) 与项目 [`deploy-after-ci`](../.spec/skills/deploy-after-ci/SKILL.md)。

## 当前优化

| 优化 | 位置 / 做法 | 作用 |
| --- | --- | --- |
| BuildKit cache mount | Dockerfile 中 `RUN --mount=type=cache,target=/root/.npm npm ci` | 依赖未变时复用 npm 缓存 |
| 关闭 provenance / SBOM | GitHub Actions build-push 配置 `provenance: false`、`sbom: false` | 减少构建耗时 |
| npm 镜像源 | Dockerfile 中保留注释配置 | 仅在国内构建环境按需启用 |

GitHub Actions runner 通常在海外，默认不要启用国内 npm 镜像源，避免反而变慢。

## 验证

1. 触发 Docker workflow。
2. 查看 GitHub Actions 日志里的 `npm ci` 步骤。
3. 看到 `CACHED` 或耗时明显下降，说明缓存生效。

缓存只影响构建过程，不会进入最终镜像。GitHub Actions 缓存存在容量限制，缓存失效时只会退回正常构建，不应改变运行行为。
