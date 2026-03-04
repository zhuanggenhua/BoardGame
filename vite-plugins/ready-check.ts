/**
 * Vite 插件：提供就绪检查端点
 * 
 * 在 Vite 完全就绪后才响应 /__ready 端点
 * 用于 E2E 测试等待服务器真正就绪
 */

import type { Plugin } from 'vite';

export function readyCheckPlugin(): Plugin {
  let isReady = false;

  return {
    name: 'ready-check',
    
    // 在服务器启动后设置就绪标志
    configureServer(server) {
      // 监听 Vite 的就绪事件
      server.httpServer?.once('listening', () => {
        // 等待一小段时间确保所有初始化完成
        setTimeout(() => {
          isReady = true;
          console.log('✅ Vite 服务器已就绪（/__ready 端点可用）');
        }, 1000);
      });

      // 添加就绪检查端点
      server.middlewares.use('/__ready', (req, res) => {
        if (isReady) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ready: true, timestamp: Date.now() }));
        } else {
          res.statusCode = 503; // Service Unavailable
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ready: false, message: 'Server is starting...' }));
        }
      });
    },
  };
}
