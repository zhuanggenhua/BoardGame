/**
 * 命令代理
 * 
 * 提供直接分发游戏命令的能力，用于测试中模拟玩家操作。
 * 
 * @example
 * ```typescript
 * // E2E 测试中
 * await window.__BG_TEST_HARNESS__.command.dispatch({
 *     type: 'ROLL_DICE',
 *     playerId: '0',
 *     payload: {}
 * });
 * ```
 */

export class CommandProxy {
    private dispatchFn?: (command: any) => Promise<void> | void;

    /**
     * 注册命令分发器（由游戏引擎调用）
     */
    register(dispatch: (command: any) => Promise<void> | void) {
        this.dispatchFn = dispatch;
    }

    /**
     * 分发命令
     */
    async dispatch(command: any): Promise<void> {
        if (!this.dispatchFn) {
            throw new Error('[CommandProxy] 命令分发器未注册，请确保游戏已加载');
        }
        await this.dispatchFn(command);
    }

    /**
     * 检查命令分发器是否已注册
     */
    isRegistered(): boolean {
        return !!this.dispatchFn;
    }
}
