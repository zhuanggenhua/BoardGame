/**
 * 状态注入器
 *
 * 仅负责读写当前前端持有的状态快照。
 * 权威联机状态的注入必须走服务端测试 API，不能复用玩家视角的客户端状态。
 */

export class StateInjector {
    private getStateFn?: () => any;
    private setStateFn?: (state: any) => void;

    /**
     * 注册状态访问器，由 Provider 在测试环境下调用。
     */
    register(getState: () => any, setState: (state: any) => void) {
        this.getStateFn = getState;
        this.setStateFn = setState;
        console.log('[StateInjector] 状态访问器已注册');
    }

    /**
     * 获取当前状态快照。
     */
    get(): any {
        if (!this.getStateFn) {
            throw new Error('[StateInjector] 状态访问器未注册，请确认游戏已加载');
        }
        const state = this.getStateFn();
        console.log('[StateInjector] 获取状态', state);
        return state;
    }

    /**
     * `read()` 是 `get()` 的异步别名，兼容现有 E2E 用法。
     */
    async read(): Promise<any> {
        return this.get();
    }

    /**
     * 完整替换当前前端状态。
     */
    async set(state: any): Promise<void> {
        if (!this.setStateFn) {
            throw new Error('[StateInjector] 状态访问器未注册，请确认游戏已加载');
        }
        console.log('[StateInjector] 设置状态', state);
        this.setStateFn(state);
    }

    /**
     * 部分更新当前前端状态。
     *
     * 支持两种格式：
     * 1. 嵌套对象格式
     * 2. 路径格式（key 中包含 `.`）
     */
    async patch(patch: any): Promise<void> {
        const current = this.get();
        let updated = current;

        const hasPathKeys = Object.keys(patch).some(key => key.includes('.'));

        if (hasPathKeys) {
            updated = JSON.parse(JSON.stringify(current));
            for (const path in patch) {
                if (Object.prototype.hasOwnProperty.call(patch, path)) {
                    this.setByPath(updated, path, patch[path]);
                }
            }
        } else {
            updated = this.deepMerge(current, patch);
        }

        await this.set(updated);
        console.log('[StateInjector] 应用补丁', patch);
    }

    private setByPath(obj: any, path: string, value: any) {
        const keys = path.split('.');
        let current = obj;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current)) {
                const nextKey = keys[i + 1];
                current[key] = /^\d+$/.test(nextKey) ? [] : {};
            }
            current = current[key];
        }

        current[keys[keys.length - 1]] = value;
    }

    private deepMerge(target: any, source: any): any {
        if (typeof target !== 'object' || target === null) return source;
        if (typeof source !== 'object' || source === null) return source;

        const result = Array.isArray(target) ? [...target] : { ...target };

        for (const key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                    result[key] = this.deepMerge(result[key], source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }

        return result;
    }

    isRegistered(): boolean {
        return !!(this.getStateFn && this.setStateFn);
    }
}
