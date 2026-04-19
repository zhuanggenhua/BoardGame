/**
 * UUID 生成工具
 * 
 * 提供跨环境兼容的 UUID 生成函数。
 * 优先使用原生 crypto.randomUUID()，降级到自定义实现。
 */

// 降级计数器，用于减少碰撞概率
let fallbackCounter = 0;

// 尝试从 sessionStorage 恢复计数器（防止页面刷新后重置）
if (typeof sessionStorage !== 'undefined') {
    try {
        const stored = sessionStorage.getItem('uuid-fallback-counter');
        if (stored) {
            fallbackCounter = parseInt(stored, 10) || 0;
        }
    } catch (_e) {
        // sessionStorage 不可用时忽略
    }
}

/**
 * 生成 UUID v4
 * 
 * 兼容性：
 * - Node.js >= 14.17.0 / >= 16.0.0: 使用原生 crypto.randomUUID()
 * - 旧版本 Node.js / 浏览器: 使用 polyfill
 * - 最终降级: 时间戳 + 计数器 + Math.random（降低碰撞概率）
 */
export function generateUUID(): string {
    // 尝试使用原生实现
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    // Polyfill: 使用 crypto.getRandomValues (浏览器)
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        // 浏览器环境：使用 crypto.getRandomValues
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (crypto.getRandomValues(new Uint8Array(1))[0] % 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    // 最终降级：时间戳 + 计数器 + Math.random（降低碰撞概率）
    console.error('[UUID] 使用不安全的降级实现（时间戳+计数器+Math.random），建议升级 Node.js 或使用现代浏览器');
    
    // 递增计数器并持久化到 sessionStorage
    fallbackCounter = (fallbackCounter + 1) % 0xFFFF;
    if (typeof sessionStorage !== 'undefined') {
        try {
            sessionStorage.setItem('uuid-fallback-counter', fallbackCounter.toString());
        } catch (_e) {
            // sessionStorage 不可用时忽略
        }
    }
    
    const timestamp = Date.now().toString(16).padStart(12, '0');
    const counter = fallbackCounter.toString(16).padStart(4, '0');
    const random1 = Math.floor(Math.random() * 0xFFFF).toString(16).padStart(4, '0');
    const random2 = Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0');
    // 格式: timestamp(12)-counter(4)-4xxx-yxxx-random(12)
    return `${timestamp.substring(0, 8)}-${timestamp.substring(8, 12)}-4${counter.substring(1, 4)}-${((parseInt(random1.substring(0, 1), 16) & 0x3) | 0x8).toString(16)}${random1.substring(1, 4)}-${random2}`;
}
