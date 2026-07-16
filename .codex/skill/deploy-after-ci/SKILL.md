---
name: deploy-after-ci
description: "BoardGame 生产更新最短路径。用于更新部署、发生产、更新线上；默认镜像输送到服务器并 update-local + Android stable OTA，提 CI 时先查 Actions/Docker。"
---

# BoardGame CI 后部署

## 目标

把生产更新固定成两条命令路径，避免每次重新展开部署文档、手工拼 GitHub CLI、SSH 和 OTA 发布命令。

## 路径选择

- 用户只说“更新部署 / 部署生产 / 更新线上”：直接执行“镜像输送到服务器并 `update-local` + Android stable OTA”，不查 CI。
- 用户明确说“看 CI / CI 好了 / 查 CI / 等 CI”：先查远端 `origin/main` 对应的 Docker 镜像 CI；只有成功才执行服务器更新与 OTA。
- 用户明确说“只更新服务器 / 不发 OTA”：显式加 `-SkipOta`。
- 用户指定 tag：默认只建议用于服务器镜像更新；若同时要发 OTA，必须确认本地当前发布基线就是这次要发的版本。

## 直接部署

使用本 skill 的包装脚本：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .codex\skill\deploy-after-ci\scripts\deploy-prod.ps1
```

只更新服务器，不发 OTA：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .codex\skill\deploy-after-ci\scripts\deploy-prod.ps1 -SkipOta
```

指定 tag 且只更新服务器：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .codex\skill\deploy-after-ci\scripts\deploy-prod.ps1 -Tag v1.2.3 -SkipOta
```

脚本默认会先把镜像输送到服务器并执行 `update-local`，再在本地发布 Android `stable` OTA：

```powershell
node scripts/release/deploy-and-ota.mjs --skip-wait --ota-channel stable
```

其中服务器步骤默认等价于：

```powershell
node scripts/deploy/stream-images-to-server.mjs --tag latest --host admin@8.148.71.102 --remote-dir /home/admin/BoardGame --deploy
```

只有用户明确要求“服务器直接拉镜像 / 不走镜像输送”时，才传 `-DeployMode remote`，让底层改用 `deploy-image.sh update` 旧链路。

## 查 CI 后部署

使用一条包装命令：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .codex\skill\deploy-after-ci\scripts\deploy-after-ci.ps1 -CheckCi
```

指定 tag：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .codex\skill\deploy-after-ci\scripts\deploy-after-ci.ps1 -CheckCi -Tag v1.2.3 -SkipOta
```

验证流程但不执行生产更新：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .codex\skill\deploy-after-ci\scripts\deploy-after-ci.ps1 -CheckCi -DryRun
```

CI 检查口径：

- 远端分支：`origin/main`
- GitHub 仓库：`zhuanggenhua/BoardGame`
- 必须成功的 workflow：`Build & Push Docker Images`
- 必须匹配远端 `main` 当前 SHA

若 Docker 镜像 CI 仍在运行、缺失或失败，停止，不执行部署。

## 只查 CI

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .codex\skill\deploy-after-ci\scripts\check-remote-ci.ps1
```

## 强制边界

- 不要因为本地工作区有未提交改动而阻塞 `push` 后的生产更新；生产更新只基于远端镜像。
- 不要在生产机直接运行 `docker compose up -d`。
- 不要默认让生产机直拉 GHCR；默认必须走镜像输送到服务器并 `update-local`。
- “更新部署”默认包含 Android OTA；如果用户只要服务器更新，必须显式 `-SkipOta` 或口头说明“只更新服务器”。
- 指定 tag 时，不要在未确认本地发布基线与该 tag 对齐的情况下顺手发 OTA。
- 不要默认执行本地测试、lint、构建或额外审计。
- 部署失败时只报告：执行了哪个脚本、远端脚本失败位置、下一步最小补救。
