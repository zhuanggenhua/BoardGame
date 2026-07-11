export const DEFAULT_FORCE_UPDATE_TITLE = '正在更新';
export const DEFAULT_FORCE_UPDATE_MESSAGE = '正在下载必要更新，请稍候';
export const ANDROID_OTA_VERSION_FLOOR = '6.0.0';

const parseVersionTriplet = (value) => {
    const match = String(value || '').trim().match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) {
        throw new Error(`非法 OTA 内部游标版本：${value || '(空)'}`);
    }
    return match.slice(1, 4).map(Number);
};

export const compareOtaVersionBase = (left, right) => {
    const leftParts = parseVersionTriplet(left);
    const rightParts = parseVersionTriplet(right);
    for (let index = 0; index < 3; index += 1) {
        if (leftParts[index] === rightParts[index]) continue;
        return leftParts[index] > rightParts[index] ? 1 : -1;
    }
    return 0;
};

export const resolveAndroidOtaVersionBase = ({
    packageVersion,
    requestedVersionBase = '',
    minimumVersionBase = ANDROID_OTA_VERSION_FLOOR,
} = {}) => {
    const requested = String(requestedVersionBase || '').trim();
    const fallback = String(packageVersion || '').trim();
    const candidate = requested || fallback;

    if (compareOtaVersionBase(candidate, minimumVersionBase) < 0) {
        if (requested) {
            throw new Error(
                `Android OTA 内部游标不能低于 ${minimumVersionBase}：收到 ${requested}。`
                + ' 历史客户端可能已记录更高游标，降低会导致强制更新也被判定为旧包。',
            );
        }
        return minimumVersionBase;
    }

    return candidate;
};

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
