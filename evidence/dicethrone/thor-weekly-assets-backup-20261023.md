# 素材上传与每周备份

用户当轮要求：“上传不能有校验，无视风险直接上传，可以加一个备份功能，固定每周一次”。本轮没有追加token、人工批准或上传前扫描门禁；正式上传实际匿名成功，未要求用户提供密钥。此结论不表示已删除服务器全部校验逻辑。

## 已发布

正式主源为云服务器 `8.148.71.102` 的 `/home/admin/storage/assets/current`；服务器自动维护release及Android素材索引。定向发布索尔原尺寸WebP：player-board、tip、ability-cards、dice、status-icons-atlas，发布 `20261023104720449`；新增原始玩家板独立裁图portrait，发布 `20261023111630381`。前五项本轮远端HEAD均200且长度与本地一致；头像上传返回completed。压缩图之外的临时裁图、来源QA、原始PNG未上传。

## 每周任务

- `boardgame-asset-weekly-backup.timer` 已安装并enabled，固定 `Sun *-*-* 03:00:00 Asia/Shanghai`，Persistent=true。
- 本轮systemd实查下一次：`Sun 2026-10-25 03:00:00 CST`。
- 方向：服务器current正式源 → `r2-boardgame:boardgame-assets/weekly-server-backups/<ISO年-W周>`。
- 使用rclone copy，保留各周路径，不反向同步、不删除R2已有对象。
- 备份脚本在publish.lock内用 `cp -al` 取不可变硬链接快照，索引元数据独立复制。网络复制期间释放publish.lock；weekly-backup.lock仅阻止重复备份实例。
- service以admin运行，最长6天，避免慢速首次全量备份被4小时中断。
- 精确移除原admin crontab中每日从旧R2反向sync到服务器的单条任务。原cron留档：`/home/admin/storage/assets/scheduler-backups/crontab-before-weekly-20261023.txt`；其它cron保持。
- 源码：`scripts/assets/backup-server-assets.sh`、`scripts/deploy/boardgame-asset-weekly-backup.service`、`scripts/deploy/boardgame-asset-weekly-backup.timer`。

## 本轮执行状态

首次备份于2026-10-23 19:00 CST手动启动，并于20:31:27 CST完成。systemd日志记录 `Transferred: 4.088 GiB / 4.088 GiB`、`Transferred: 13385 / 13385`、`assetWeeklyBackup=completed week=2026-W43`，服务随后成功退出。当前timer仍为active/enabled，下次执行时间为2026-10-25 03:00 CST。该备份不依赖本地Windows或Codex保持在线。

本轮只部署素材备份调度，没有提交、推送或部署游戏代码。

## 2026-10-25 定时任务实查（2026-10-26）

只读实查云服务器 systemd 状态：timer 仍为 enabled；最近一次触发为 `Sun 2026-10-25 03:00:05 CST`，下次为 `Sun 2026-11-01 03:00:00 CST`。`boardgame-asset-weekly-backup.service` 的 `Result=success`、`ExecMainStatus=0`，执行区间为 03:00:05–03:09:33 CST。服务日志记录 `assetWeeklyBackup=completed week=2026-W43`，目标为 `r2-boardgame:boardgame-assets/weekly-server-backups/2026-W43`；本次传输 25 项、12.106 MiB。此为定时周备份运行记录，首次 4.088 GiB 全量备份仍按上节记录。

## 2026-11-12 定时任务回查

只读回查：timer 为 enabled/active，最近一次于 2026-11-08 03:00:07 CST 触发；service 为 Result=success、ExecMainStatus=0，04:03:00 退出；下一次为 2026-11-15 03:00 CST。这证明 systemd 调度及该次服务退出成功，不单独证明远端每个对象的内容校验。

2026-11-12 再次以 HTTP HEAD 回查索尔的 player-board、tip、ability-cards、dice、status-icons-atlas、portrait 六个正式压缩图地址，均返回 200；仅验证公开访问状态，不推断 CDN 上每个文件的哈希。
