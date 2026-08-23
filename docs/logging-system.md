# 日志系统

本文记录项目日志的当前使用入口。依赖由 `package.json` 维护，不另写安装步骤。

## 代码入口

| 文件 | 职责 |
| --- | --- |
| `server/logger.ts` | 服务端 logger 创建与格式 |
| `server/game/` | 房间、命令、联机和游戏业务日志 |
| `scripts/deploy/watch-game-server-cpu.sh` | 生产 CPU 现场留档 |
| `logs/` | 本地或生产挂载后的日志目录 |

## 环境变量

```env
LOG_DIR=./logs
LOG_LEVEL=info
NODE_ENV=development
LOG_TO_FILE=false
```

生产环境默认写文件；开发环境默认输出到控制台。敏感信息，例如密码、token、credentials，不得写入日志。

## 日志形态

生产日志以 JSON line 为主，便于 `jq`、日志收集器和脚本分析。常见含义：

| 现实含义 | 常见字段 |
| --- | --- |
| 房间或对局 | `roomId`、`gameId` |
| 玩家动作 | `playerId`、`commandType` |
| 命令失败 | `error`、`reason`、`stateVersion` |
| 性能耗时 | `durationMs`、`costMs` |

字段名只能作为证据，汇报问题时先说明它对应的现实含义。

## 查询示例

```bash
# 最新服务日志
tail -f logs/app.log

# 错误日志
tail -f logs/error.log

# 某房间全部记录
jq 'select(.roomId=="<roomId>")' logs/app.log

# 命令失败
jq 'select(.event=="command_failed" or .level=="error")' logs/app.log

# 统计命令耗时
jq 'select(.durationMs) | .durationMs' logs/app.log
```

## 保留与清理

```bash
find logs -name "*.log" -mtime +30 -delete
find logs -name "*error*.log" -mtime +90 -delete
```

正式事故、线上反馈和用户点名问题的关键日志应复制或摘录到对应 `evidence/` 或 `docs/bugs/`，不要只留在滚动日志里。

## 排查边界

- 日志安静不等于问题修复。
- `reason`、错误码、监控触发条件只能算线索；不能直接称为根因。
- 如果用户问“为什么没保存 / 没发送 / 没执行”，最终验收必须回到真实记录或真实动作结果。
- CPU 监控触发重启只算止血；根因要回到 profile、堆栈、房间和命令上下文。
