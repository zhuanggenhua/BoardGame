const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const resolveTimestamp = (value: string | number | Date | null | undefined) => {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.getTime();
    }
    if (typeof value === 'string' || typeof value === 'number') {
        const timestamp = new Date(value).getTime();
        return Number.isNaN(timestamp) ? null : timestamp;
    }
    return null;
};

export const getElapsedDurationMs = (startAt: string | number | Date | null | undefined, now = Date.now()) => {
    const start = resolveTimestamp(startAt);
    if (start == null) {
        return null;
    }
    return Math.max(0, now - start);
};

export const formatDurationMs = (durationMs: number | null | undefined) => {
    if (durationMs == null) {
        return '时长未知';
    }
    if (durationMs < MINUTE_MS) {
        return `${Math.max(1, Math.floor(durationMs / 1000))} 秒`;
    }

    const days = Math.floor(durationMs / DAY_MS);
    const hours = Math.floor((durationMs % DAY_MS) / HOUR_MS);
    const minutes = Math.floor((durationMs % HOUR_MS) / MINUTE_MS);

    if (days > 0) {
        return `${days} 天 ${hours} 小时`;
    }
    if (hours > 0) {
        return `${hours} 小时 ${minutes} 分`;
    }
    return `${minutes} 分`;
};

export const formatDateTime = (value: string | number | Date | null | undefined) => {
    const timestamp = resolveTimestamp(value);
    if (timestamp == null) {
        return '时间未知';
    }

    return new Date(timestamp).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
};
