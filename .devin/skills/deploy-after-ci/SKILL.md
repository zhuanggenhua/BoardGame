---
name: deploy-after-ci
description: 用于 BoardGame 生产更新的最短路径工作流。用户说“更新部署”“部署生产”“发生产”“更新线上”时使用；若用户没有明确要求看 CI，则直接执行生产更新脚本。用户说“看下 CI 好了就更新部署”“CI 好了就部署”“查 CI 后部署”等需要先确认 GitHub Actions / Docker 镜像构建状态时使用，先查 origin/main 对应的 Build & Push Docker Images workflow，成功后再部署。
---

# BoardGame CI 后部署

## 目标

把生产更新固定成两条命令路径，避免每次重新展开部署文档、手工拼 GitHub CLI 和 SSH 命令。

## 路径选择

- 用户只说“更新部署 / 部署生产 / 更新线上”：直接部署，不查 CI。
- 用户明确说“看 CI / CI 好了 / 查 CI / 等 CI”：先查远端 `origin/main` 对应的 Docker 镜像 CI；只有成功才部署。
- 用户指定 tag：把 tag 传给部署脚本；没有 tag 默认更新 `latest`。

## 直接部署

使用本 skill 的包装脚本：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .windsurf\skills\deploy-after-ci\scripts\deploy-prod.ps1
```

指定 tag：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .windsurf\skills\deploy-after-ci\scripts\deploy-prod.ps1 -Tag v1.2.3
```

脚本会通过 SSH 在生产机执行：

```bash
cd /home/admin/BoardGame && bash scripts/deploy/deploy-image.sh update [tag]
```

## 查 CI 后部署

使用一条包装命令：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .windsurf\skills\deploy-after-ci\scripts\deploy-after-ci.ps1 -CheckCi
```

指定 tag：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .windsurf\skills\deploy-after-ci\scripts\deploy-after-ci.ps1 -CheckCi -Tag v1.2.3
```

验证流程但不执行生产更新：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .windsurf\skills\deploy-after-ci\scripts\deploy-after-ci.ps1 -CheckCi -DryRun
```

CI 检查口径：

- 远端分支：`origin/main`
- GitHub 仓库：`zhuanggenhua/BoardGame`
- 必须成功的 workflow：`Build & Push Docker Images`
- 必须匹配远端 `main` 当前 SHA

若 Docker 镜像 CI 仍在运行、缺失或失败，停止，不执行部署。

## 只查 CI

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .windsurf\skills\deploy-after-ci\scripts\check-remote-ci.ps1
```

## 强制边界

- 不要因为本地工作区有未提交改动而阻塞 `push` 后的生产更新；生产更新只基于远端镜像。
- 不要在生产机直接运行 `docker compose up -d`。
- 不要默认执行本地测试、lint、构建或额外审计。
- 部署失败时只报告：执行了哪个脚本、远端脚本失败位置、下一步最小补救。
