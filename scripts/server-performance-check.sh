#!/usr/bin/env bash
# 服务器性能分析脚本（增强版）
# 用法：bash scripts/server-performance-check.sh

set -euo pipefail

echo "=========================================="
echo "🔍 服务器性能分析（增强版）"
echo "=========================================="
echo "检查时间: $(date)"
echo ""

# ============================================================
# 1. 系统资源概览
# ============================================================
echo "========== 1. 系统资源概览 =========="
echo "--- CPU 信息 ---"
echo "CPU 核心数: $(nproc)"
echo "CPU 型号: $(grep 'model name' /proc/cpuinfo | head -1 | cut -d: -f2 | xargs)"
echo ""

echo "--- 负载 ---"
uptime | awk '{print "1分钟: "$8" | 5分钟: "$9" | 15分钟: "$10}'
echo ""

echo "--- 内存使用 ---"
free -h
echo ""
TOTAL_MEM=$(free -m | awk 'NR==2{print $2}')
USED_MEM=$(free -m | awk 'NR==2{print $3}')
AVAIL_MEM=$(free -m | awk 'NR==2{print $7}')
MEM_PERCENT=$(awk "BEGIN {printf \"%.2f\", ($USED_MEM/$TOTAL_MEM)*100}")
echo "内存使用率: ${MEM_PERCENT}%"
echo "可用内存: ${AVAIL_MEM}MB / ${TOTAL_MEM}MB"

SWAP_USED=$(free -m | awk 'NR==3{print $3}')
SWAP_TOTAL=$(free -m | awk 'NR==3{print $2}')
if [ "$SWAP_USED" -gt 0 ]; then
    echo "⚠️  Swap 使用: ${SWAP_USED}MB / ${SWAP_TOTAL}MB（可能影响性能）"
else
    echo "✅ Swap 未使用"
fi
echo ""

echo "--- 磁盘使用 ---"
df -h / | tail -1 | awk '{print "根分区: "$3" / "$2" ("$5" 已用)"}'
df -h /var/lib/docker 2>/dev/null | tail -1 | awk '{print "Docker: "$3" / "$2" ("$5" 已用)"}'
echo ""

# ============================================================
# 2. Docker 容器资源使用
# ============================================================
echo "========== 2. Docker 容器资源使用 =========="
if command -v docker &>/dev/null; then
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}"
else
    echo "⚠️  Docker 未安装"
fi
echo ""

# ============================================================
# 3. MongoDB 性能分析
# ============================================================
echo "========== 3. MongoDB 性能分析 =========="

if docker ps --format '{{.Names}}' | grep -q 'boardgame-mongodb'; then
    echo "--- MongoDB 连接测试 ---"
    docker compose -f ~/BoardGame/docker-compose.prod.yml exec -T mongodb mongosh --quiet --eval "db.runCommand({ping: 1})" 2>/dev/null || echo "❌ 连接失败"
    echo ""
    
    echo "--- MongoDB 服务器状态 ---"
    docker compose -f ~/BoardGame/docker-compose.prod.yml exec -T mongodb mongosh --quiet --eval "
        var status = db.serverStatus();
        print('版本: ' + status.version);
        print('运行时间: ' + Math.floor(status.uptime / 3600) + ' 小时');
        print('当前连接数: ' + status.connections.current + ' / ' + status.connections.available);
        print('');
        print('--- 内存使用 ---');
        print('常驻内存: ' + Math.round(status.mem.resident) + ' MB');
        print('虚拟内存: ' + Math.round(status.mem.virtual) + ' MB');
        print('');
        print('--- WiredTiger 缓存 ---');
        var cache = status.wiredTiger.cache;
        var cacheSize = Math.round(cache['maximum bytes configured'] / 1024 / 1024);
        var cacheUsed = Math.round(cache['bytes currently in the cache'] / 1024 / 1024);
        var cachePercent = ((cacheUsed / cacheSize) * 100).toFixed(2);
        print('缓存大小: ' + cacheUsed + ' MB / ' + cacheSize + ' MB (' + cachePercent + '%)');
        print('缓存命中率: ' + ((cache['pages read into cache'] > 0 ? (1 - cache['pages read into cache'] / (cache['pages read into cache'] + cache['pages requested from the cache'])) * 100 : 100)).toFixed(2) + '%');
        print('脏页: ' + Math.round(cache['tracked dirty bytes in the cache'] / 1024 / 1024) + ' MB');
        print('');
        print('--- 操作统计（每秒）---');
        var ops = status.opcounters;
        var uptime = status.uptime;
        print('查询: ' + (ops.query / uptime).toFixed(2));
        print('插入: ' + (ops.insert / uptime).toFixed(2));
        print('更新: ' + (ops.update / uptime).toFixed(2));
        print('删除: ' + (ops.delete / uptime).toFixed(2));
    " 2>/dev/null || echo "❌ 无法获取状态"
    echo ""
    
    echo "--- MongoDB 慢查询（>1秒）---"
    SLOW_QUERIES=$(docker compose -f ~/BoardGame/docker-compose.prod.yml exec -T mongodb mongosh --quiet --eval "
        db.currentOp({
            'active': true,
            'secs_running': {\$gte: 1}
        })
    " 2>/dev/null)
    
    if echo "$SLOW_QUERIES" | grep -q '"op"'; then
        echo "⚠️  发现慢查询:"
        echo "$SLOW_QUERIES"
    else
        echo "✅ 无慢查询"
    fi
    echo ""
    
    echo "--- MongoDB 数据库统计 ---"
    docker compose -f ~/BoardGame/docker-compose.prod.yml exec -T mongodb mongosh --quiet --eval "
        var stats = db.stats();
        print('数据大小: ' + (stats.dataSize / 1024 / 1024).toFixed(2) + ' MB');
        print('存储大小: ' + (stats.storageSize / 1024 / 1024).toFixed(2) + ' MB');
        print('索引大小: ' + (stats.indexSize / 1024 / 1024).toFixed(2) + ' MB');
        print('文档数量: ' + stats.objects);
        print('集合数量: ' + stats.collections);
    " 2>/dev/null || echo "❌ 无法获取统计"
    echo ""
    
    echo "--- MongoDB 容器资源限制 ---"
    docker inspect boardgame-mongodb --format '内存限制: {{.HostConfig.Memory}}' | awk '{print $0 / 1024 / 1024 " MB"}' 2>/dev/null || echo "未设置"
    echo ""
else
    echo "⚠️  MongoDB 容器未运行"
    echo ""
fi

# ============================================================
# 4. 网络连接分析
# ============================================================
echo "========== 4. 网络连接分析 =========="
if command -v ss &>/dev/null; then
    ESTABLISHED=$(ss -tn | grep ESTAB | wc -l)
    TIME_WAIT=$(ss -tn | grep TIME-WAIT | wc -l)
    CLOSE_WAIT=$(ss -tn | grep CLOSE-WAIT | wc -l)
    WS_CONN=$(ss -tn sport = :80 | grep ESTAB | wc -l)
    
    echo "ESTABLISHED: $ESTABLISHED"
    echo "TIME_WAIT: $TIME_WAIT"
    echo "CLOSE_WAIT: $CLOSE_WAIT"
    echo "WebSocket (80端口): $WS_CONN"
    
    if [ "$ESTABLISHED" -gt 200 ]; then
        echo "⚠️  连接数较多，可能需要优化"
    else
        echo "✅ 连接数正常"
    fi
else
    netstat -an | grep ESTABLISHED | wc -l | xargs echo "ESTABLISHED:"
fi
echo ""

# ============================================================
# 5. 应用日志错误统计
# ============================================================
echo "========== 5. 应用日志错误统计（最近 1 小时）=========="
if [ -d ~/BoardGame ]; then
    cd ~/BoardGame
    
    echo "--- web 容器错误 ---"
    WEB_ERRORS=$(docker compose -f docker-compose.prod.yml logs --since 1h web 2>/dev/null | grep -i "error" | wc -l)
    echo "错误数: $WEB_ERRORS"
    if [ "$WEB_ERRORS" -gt 10 ]; then
        echo "最近 5 条:"
        docker compose -f docker-compose.prod.yml logs --since 1h web 2>/dev/null | grep -i "error" | tail -5
    fi
    echo ""
    
    echo "--- game-server 容器错误 ---"
    GAME_ERRORS=$(docker compose -f docker-compose.prod.yml logs --since 1h game-server 2>/dev/null | grep -i "error" | wc -l)
    echo "错误数: $GAME_ERRORS"
    if [ "$GAME_ERRORS" -gt 50 ]; then
        echo "⚠️  错误较多，最近 5 条:"
        docker compose -f docker-compose.prod.yml logs --since 1h game-server 2>/dev/null | grep -i "error" | tail -5
    fi
    echo ""
fi

# ============================================================
# 6. 磁盘 I/O 分析
# ============================================================
echo "========== 6. 磁盘 I/O 分析 =========="
if command -v iostat &>/dev/null; then
    echo "--- 磁盘 I/O 统计（5秒采样）---"
    iostat -x 1 3 | tail -20
else
    echo "⚠️  iostat 未安装（需要 sysstat 包）"
fi
echo ""

# ============================================================
# 7. 性能建议
# ============================================================
echo "=========================================="
echo "📋 性能建议汇总"
echo "=========================================="

# 内存建议
if [ "$MEM_PERCENT" -gt 80 ]; then
    echo "🔴 内存使用率 ${MEM_PERCENT}% 过高"
    echo "   建议: 增加服务器内存或优化应用"
elif [ "$MEM_PERCENT" -gt 60 ]; then
    echo "🟡 内存使用率 ${MEM_PERCENT}% 偏高"
    echo "   建议: 监控内存趋势，考虑优化"
else
    echo "✅ 内存使用率 ${MEM_PERCENT}% 正常"
fi

# Swap 建议
if [ "$SWAP_USED" -gt 100 ]; then
    echo "🟡 Swap 使用 ${SWAP_USED}MB，可能影响性能"
    echo "   建议: 释放内存或增加物理内存"
fi

# MongoDB 缓存建议
if docker ps --format '{{.Names}}' | grep -q 'boardgame-mongodb'; then
    CACHE_SIZE=$(docker compose -f ~/BoardGame/docker-compose.prod.yml exec -T mongodb mongosh --quiet --eval "
        Math.round(db.serverStatus().wiredTiger.cache['maximum bytes configured'] / 1024 / 1024)
    " 2>/dev/null || echo "0")
    
    if [ "$CACHE_SIZE" -lt 512 ] && [ "$AVAIL_MEM" -gt 500 ]; then
        echo "🟡 MongoDB 缓存 ${CACHE_SIZE}MB 偏小，可用内存充足"
        echo "   建议: 考虑增加到 512MB 以提升性能"
    elif [ "$CACHE_SIZE" -ge 512 ]; then
        echo "✅ MongoDB 缓存 ${CACHE_SIZE}MB 配置合理"
    fi
fi

echo ""
echo "=========================================="
echo "✅ 分析完成"
echo "=========================================="
echo ""
echo "💡 快速操作命令:"
echo "查看实时资源: docker stats"
echo "查看容器日志: docker compose -f ~/BoardGame/docker-compose.prod.yml logs -f [service]"
echo "重启服务: docker compose -f ~/BoardGame/docker-compose.prod.yml restart [service]"
echo "MongoDB 控制台: docker compose -f ~/BoardGame/docker-compose.prod.yml exec mongodb mongosh"
echo ""
