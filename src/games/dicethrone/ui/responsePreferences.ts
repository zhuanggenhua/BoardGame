export const AUTO_RESPONSE_KEY = 'dicethrone:autoResponse';
/** 获取当前响应窗口显示设置 */
export const getAutoResponseEnabled = (): boolean => {
    // 服务端环境没有 localStorage，默认开启（显示响应窗口）
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return true;
    }
    const stored = localStorage.getItem(AUTO_RESPONSE_KEY);
    // 默认开启（显示响应窗口）
    return stored === null ? true : stored === 'true';
};
