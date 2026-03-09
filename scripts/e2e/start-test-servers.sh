#!/bin/bash
# 手动启动 E2E 测试服务器
# 用法：bash scripts/e2e/start-test-servers.sh

echo "🚀 启动 E2E 测试服务器..."

# 启动前端服务器（端口 6173）
echo "启动前端服务器（6173）..."
cross-env VITE_DEV_PORT=6173 GAME_SERVER_PORT=20000 API_SERVER_PORT=21000 npm run dev:frontend &
FRONTEND_PID=$!

# 启动游戏服务器（端口 20000）
echo "启动游戏服务器（20000）..."
cross-env USE_PERSISTENT_STORAGE=false GAME_SERVER_PORT=20000 npm run dev:game &
GAME_PID=$!

# 启动 API 服务器（端口 21000）
echo "启动 API 服务器（21000）..."
cross-env API_SERVER_PORT=21000 npm run dev:api &
API_PID=$!

echo ""
echo "✅ 测试服务器已启动"
echo "   前端: http://localhost:6173 (PID: $FRONTEND_PID)"
echo "   游戏: http://localhost:20000 (PID: $GAME_PID)"
echo "   API:  http://localhost:21000 (PID: $API_PID)"
echo ""
echo "💡 运行测试："
echo "   npm run test:e2e -- <测试文件>"
echo ""
echo "🛑 停止服务器："
echo "   npm run test:e2e:cleanup"
