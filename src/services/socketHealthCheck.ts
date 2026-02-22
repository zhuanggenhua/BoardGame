/**
 * WebSocket 健康检查工具
 * 
 * 定期检查 socket 连接状态，如果断开则主动重连
 * 解决浏览器后台节流导致 socket.io 自动重连失效的问题
 */

import type { Socket } from 'socket.io-client';

interface SocketHealthCheckConfig {
    /**
     * 检查间隔（毫秒）
     * @default 30000 (30秒)
     */
    interval?: number;
    
    /**
     * Socket 名称（用于日志）
     */
    name: string;
    
    /**
     * 获取 socket 实例的函数
     */
    getSocket: () => Socket | null;
    
    /**
     * 连接状态检查函数（可选，默认检查 socket.connected）
     */
    isConnected?: () => boolean;
}

class SocketHealthChecker {
    private timers: Map<string, number> = new Map();
    
    /**
     * 启动健康检查
     */
    start(config: SocketHealthCheckConfig): () => void {
        const { interval = 30000, name, getSocket, isConnected } = config;
        
        // 清理已有的定时器
        this.stop(name);
        
        const check = () => {
            const socket = getSocket();
            if (!socket) return;
            
            const connected = isConnected ? isConnected() : socket.connected;
            
            if (!connected) {
                console.log(`[SocketHealthCheck] ${name} 断开，尝试重连`);
                try {
                    socket.connect();
                } catch (error) {
                    console.error(`[SocketHealthCheck] ${name} 重连失败:`, error);
                }
            }
        };
        
        // 立即执行一次检查
        check();
        
        // 定期检查
        const timer = window.setInterval(check, interval);
        this.timers.set(name, timer);
        
        console.log(`[SocketHealthCheck] ${name} 健康检查已启动 (间隔: ${interval}ms)`);
        
        // 返回清理函数
        return () => this.stop(name);
    }
    
    /**
     * 停止健康检查
     */
    stop(name: string): void {
        const timer = this.timers.get(name);
        if (timer) {
            clearInterval(timer);
            this.timers.delete(name);
            console.log(`[SocketHealthCheck] ${name} 健康检查已停止`);
        }
    }
    
    /**
     * 停止所有健康检查
     */
    stopAll(): void {
        this.timers.forEach((timer, name) => {
            clearInterval(timer);
            console.log(`[SocketHealthCheck] ${name} 健康检查已停止`);
        });
        this.timers.clear();
    }
}

// 导出单例
export const socketHealthChecker = new SocketHealthChecker();
