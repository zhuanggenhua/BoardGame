export const DEFAULT_FORCE_UPDATE_TITLE = '正在更新';
export const DEFAULT_FORCE_UPDATE_MESSAGE = '正在下载必要更新，请稍候';

export const resolveOtaForceUpdateOptions = ({
    noForceUpdateFlag = false,
    forceUpdateTitle = '',
    forceUpdateMessage = '',
} = {}) => {
    if (noForceUpdateFlag) {
        throw new Error('所有 OTA 已强制更新，禁止使用 --no-force-update。');
    }

    return {
        forceUpdate: true,
        forceUpdateTitle: forceUpdateTitle.trim() || DEFAULT_FORCE_UPDATE_TITLE,
        forceUpdateMessage: forceUpdateMessage.trim() || DEFAULT_FORCE_UPDATE_MESSAGE,
    };
};
