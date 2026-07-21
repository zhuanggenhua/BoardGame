export const AUTO_RESPONSE_KEY = 'dicethrone:autoResponse';
export const BONUS_DICE_RESPONSE_KEY = 'dicethrone:bonusDiceResponse';

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

/** 获取当前奖励骰响应窗口显示设置 */
export const getBonusDiceResponseEnabled = (autoResponseEnabled = getAutoResponseEnabled()): boolean => {
    if (!autoResponseEnabled) {
        return false;
    }

    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return false;
    }

    const stored = localStorage.getItem(BONUS_DICE_RESPONSE_KEY);
    // 默认关闭：只有玩家明确开启，奖励骰响应窗口才停下来等手动处理。
    return stored === 'true';
};
