/**
 * 浏览器标签页可见性恢复工具
 *
 * 现代浏览器（Chrome 88+）会对后台标签页进行 timer 节流甚至冻结 JS 执行，
 * 导致 socket.io 心跳超时 → 服务端断开连接 → 客户端未及时重连。
 *
 * 此工具在页面恢复可见时触发回调，让各 socket 服务主动重连/重新同步。
 *
 * 面向百游戏设计：通用工具，不依赖任何游戏层代码。
 */

type ResyncCallback = () => void;

/**
 * 注册 visibilitychange 监听器
 *
 * @param onVisible 页面恢复可见时的回调
 * @returns 清理函数（移除监听器）
 */
export function onPageVisible(onVisible: ResyncCallback): () => void {
    const handler = () => {
        if (!document.hidden) {
            onVisible();
        }
    };
    document.addEventListener('visibilitychange', handler);
    return () => {
        document.removeEventListener('visibilitychange', handler);
    };
}
