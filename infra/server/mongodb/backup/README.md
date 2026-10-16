# BoardGame MongoDB 本机备份

当前云端 MongoDB 是独立实例，尚未启用 replica set。此备份通过 `mongodump` 每日生成压缩归档，保留 14 天；它是本机可恢复备份，不等于 Acer 实时从库，也不提供自动主从切换。

## 安装

```bash
sudo install -o root -g root -m 0755 boardgame-mongodb-backup /usr/local/sbin/boardgame-mongodb-backup
sudo install -o root -g root -m 0644 boardgame-mongodb-backup.service /etc/systemd/system/boardgame-mongodb-backup.service
sudo install -o root -g root -m 0644 boardgame-mongodb-backup.timer /etc/systemd/system/boardgame-mongodb-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable --now boardgame-mongodb-backup.timer
sudo systemctl start boardgame-mongodb-backup.service
```

归档位置：`/var/backups/boardgame/mongodb/`。完成一次恢复演练并接入异机复制前，不得把此配置描述成灾备闭环。
