/**
 * 引擎环境工具
 */

export const isDevEnv = (): boolean =>
    (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;

export const resolveDevFlag = (override?: boolean): boolean => {
    if (typeof override === 'boolean') return override;
    if (isDevEnv()) return true;
    return typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
};
