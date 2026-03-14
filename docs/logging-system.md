# 日志系统文档

## 概述

项目使用 Winston 作为日志库，支持结构化日志、按日期自动轮转、错误日志单独存储。

## 日志存储

- **位置**：`logs/` 目录（可通过 `LOG_DIR` 环境变量配置）
- **格式**：JSON（生产环境）/ 彩色文本（开发环境）
- **默认行为**：
  - 生产环境默认写入文件并轮转
  - 开发环境默认只输出到控制台，不写入 `logs/`
  - 如需在开发环境落盘，显式设置 `LOG_TO_FILE=true`
- **轮转策略**：
  - 普通日志：保留 30 天，单文件最大 100MB
  - 错误日志：保留 90 天，单文件最大 100MB

## 日志级别

- `error`：错误（命令失败、未捕获异常、状态同步失败）
- `warn`：警告（WebSocket 断开、作弊检测）
- `info`：信息（房间创建、命令执行、游戏结束）
- `debug`：调试（仅开发环境）

## 使用方法

### 基础日志

```typescript
import logger from './server/logger';

logger.info('服务器启动', { port: 18000 });
logger.error('数据库连接失败', { error: err.message });
```

### 游戏业务日志

```typescript
import { gameLogger } from './server/logger';

// 房间创建
gameLogger.matchCreated(matchID, 'dicethrone', ['player1', 'player2']);

// 命令执行成功
gameLogger.commandExecuted(matchID, 'ROLL_DICE', 'player1', 45);

// 命令执行失败
gameLogger.commandFailed(matchID, 'PLAY_CARD', 'player2', new Error('Invalid card'));

// 游戏结束
gameLogger.matchEnded(matchID, 'dicethrone', 'player1', 1200);

// WebSocket 连接
gameLogger.socketConnected(socketId, 'player1');

// WebSocket 断开
gameLogger.socketDisconnected(socketId, matchID, 'client_disconnect');

// 作弊检测
gameLogger.cheatDetected(matchID, 'player1', 'invalid_command_frequency', { count: 100 });

// 状态同步失败
gameLogger.stateSyncFailed(matchID, 'player1', new Error('State mismatch'));
```

## 日志格式

### JSON 格式（生产环境）

```json
{
  "timestamp": "2025-02-17 16:30:45",
  "level": "info",
  "message": "command_executed",
  "matchId": "abc123",
  "command": "ROLL_DICE",
  "playerId": "player1",
  "duration_ms": 45,
  "service": "boardgame-server",
  "environment": "production",
  "version": "1.0.0"
}
```

### 文本格式（开发环境）

```
16:30:45 info: command_executed {"matchId":"abc123","command":"ROLL_DICE","playerId":"player1","duration_ms":45}
```

## 环境变量

```bash
# 日志目录（默认：./logs）
LOG_DIR=/var/log/boardgame

# 日志级别（默认：info）
LOG_LEVEL=debug

# 环境（影响日志格式和输出）
NODE_ENV=production

# 是否写入文件
# 生产环境默认 true，开发环境默认 false
LOG_TO_FILE=true
```

## 开发环境说明

开发环境默认关闭文件日志，原因是轮转的 `maxSize` 只限制单个文件大小，不限制单日异常刷屏时的总量。
如果本地出现异常循环，继续写入 `logs/` 很容易在短时间内堆积大量分片日志。
需要保留本地文件日志时，请临时设置 `LOG_TO_FILE=true`，排查结束后再关闭。

## 日志查询

### 查看最新日志

```bash
# 所有日志
tail -f logs/app-2025-02-17.log

# 错误日志
tail -f logs/error-2025-02-17.log
```

### 搜索特定事件

```bash
# 查找特定房间的所有日志
grep "abc123" logs/app-2025-02-17.log

# 查找命令失败日志
grep "command_failed" logs/error-2025-02-17.log

# 查找作弊检测
grep "cheat_detected" logs/app-2025-02-17.log
```

### 使用 jq 解析 JSON 日志

```bash
# 统计命令执行耗时（P95）
cat logs/app-2025-02-17.log | jq -s 'map(select(.message == "command_executed")) | map(.duration_ms) | sort | .[length * 0.95 | floor]'

# 统计错误类型分布
cat logs/error-2025-02-17.log | jq -s 'group_by(.message) | map({type: .[0].message, count: length}) | sort_by(.count) | reverse'

# 查找特定玩家的所有操作
cat logs/app-2025-02-17.log | jq 'select(.playerId == "player1")'
```

## 日志清理

日志会自动轮转和清理，无需手动操作。如需手动清理：

```bash
# 删除 30 天前的普通日志
find logs/ -name "app-*.log" -mtime +30 -delete

# 删除 90 天前的错误日志
find logs/ -name "error-*.log" -mtime +90 -delete
```

## 生产环境部署

### Docker 部署

```yaml
# docker-compose.yml
services:
  game-server:
    volumes:
      - ./logs:/app/logs
    environment:
      - LOG_DIR=/app/logs
      - LOG_LEVEL=info
      - NODE_ENV=production
```

### 日志收集（可选）

如果需要集中式日志管理，可以使用：

1. **Filebeat + Elasticsearch + Kibana**
2. **Fluentd + Loki + Grafana**
3. **CloudWatch Logs（AWS）**
4. **Cloud Logging（GCP）**

配置示例（Filebeat）：

```yaml
# filebeat.yml
filebeat.inputs:
  - type: log
    enabled: true
    paths:
      - /app/logs/*.log
    json.keys_under_root: true
    json.add_error_key: true

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
```

## 性能影响

- **文件 I/O**：异步写入，不阻塞主线程
- **内存占用**：~10MB（缓冲区）
- **CPU 开销**：<1%（JSON 序列化）
- **磁盘占用**：~100MB/天（中等负载）

## 故障排查

### 日志文件未生成

1. 检查 `logs/` 目录权限
2. 检查 `LOG_DIR` 环境变量
3. 查看控制台是否有 Winston 错误

### 日志丢失

1. 检查磁盘空间
2. 检查文件轮转配置
3. 查看 `maxFiles` 设置

### 日志格式错误

1. 确认 `NODE_ENV` 设置正确
2. 检查 Winston 版本兼容性
3. 查看 `logFormat` 配置

## 最佳实践

1. **结构化日志**：使用 key-value 格式，便于查询
2. **敏感信息**：禁止记录密码、token、credentials
3. **日志级别**：生产环境使用 `info`，开发环境使用 `debug`
4. **错误堆栈**：错误日志必须包含完整堆栈
5. **上下文信息**：记录 matchID、playerID、command 等关键字段
6. **性能监控**：记录命令执行耗时，便于性能分析
7. **定期审查**：每周检查错误日志，发现潜在问题

## 示例场景

### 排查命令执行失败

```bash
# 1. 查找失败日志
grep "command_failed" logs/error-2025-02-17.log | jq 'select(.matchId == "abc123")'

# 2. 查看该房间的完整操作历史
grep "abc123" logs/app-2025-02-17.log | jq -s 'sort_by(.timestamp)'

# 3. 分析失败原因
grep "abc123" logs/error-2025-02-17.log | jq '.error'
```

### 监控作弊行为

```bash
# 统计作弊检测次数
grep "cheat_detected" logs/app-*.log | jq -s 'group_by(.playerId) | map({player: .[0].playerId, count: length}) | sort_by(.count) | reverse'
```

### 性能分析

```bash
# 统计各命令平均耗时
cat logs/app-2025-02-17.log | jq -s 'map(select(.message == "command_executed")) | group_by(.command) | map({command: .[0].command, avg_ms: (map(.duration_ms) | add / length), count: length})'
```
