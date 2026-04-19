/**
 * 测试环境检测
 * 
 * 提供测试环境检测和启用功能。
 */

/**
 * 检测是否在测试环境
 */
export function isTestEnvironment(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(window as any).__E2E_TEST_MODE__;
}

/**
 * 启用测试模式（由 E2E 测试框架注入）
 */
export function enableTestMode() {
    if (typeof window !== 'undefined') {
        (window as any).__E2E_TEST_MODE__ = true;
    }
}

/**
 * 禁用测试模式
 */
export function disableTestMode() {
    if (typeof window !== 'undefined') {
        (window as any).__E2E_TEST_MODE__ = false;
    }
}
