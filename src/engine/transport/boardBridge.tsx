import * as React from 'react';
import type { GameBoardProps } from './protocol';
import { useBoardProps } from './reactContext';
import { reportClientAutoFeedbackOnce } from '../../lib/feedback/clientAutoReport';

/**
 * 将 Provider 上下文转换为 props 注入到 Board 组件
 *
 * Board 组件通过 props 接收 G/dispatch 等，
 * BoardBridge 从 Context 读取并注入。
 *
 * 使用 ErrorBoundary 确保 Board 组件在渲染错误时不会崩溃整个应用。
 * 使用条件渲染确保 Board 只在 props 完全就绪时才渲染。
 *
 * ```tsx
 * <GameProvider ...>
 *   <BoardBridge board={GameBoard} />
 * </GameProvider>
 * ```
 */
export function BoardBridge<TCore = unknown>({
    board: Board,
    loading: Loading,
    remountKey,
}: {
    board: React.ComponentType<GameBoardProps<TCore>>;
    loading?: React.ReactNode;
    /**
     * 默认按 playerID 重挂载 Board，保留旧行为。
     * 传入 false 时保持同一个 Board 实例，只通过 props 更新视角。
     */
    remountKey?: React.Key | false;
}) {
    const props = useBoardProps<TCore>();

    // 确保 props 完全就绪后才渲染 Board
    // 这避免了 React 18 并发渲染可能导致的 Provider 时序问题
    if (!props) {
        return Loading ?? null;
    }

    // 默认使用 playerID 强制重挂载，调用方可在“代选/跟随视角”场景关闭。
    const stableKey = remountKey === false
        ? 'board'
        : remountKey ?? props.playerID ?? 'board';

    return (
        <BoardErrorBoundary fallback={Loading}>
            <Board key={stableKey} {...props} />
        </BoardErrorBoundary>
    );
}

export const BOARD_ERROR_BOUNDARY_MAX_RETRIES = 5;

export const isBoardRenderErrorRecoverable = (error?: Error | null) => {
    const message = error?.message ?? '';
    return message.includes('AudioProvider')
        || message.includes('useAudio')
        || message.includes('Context');
};

export const shouldShowBoardRenderFallback = ({
    error,
    retryCount,
    fallback,
}: {
    error?: Error | null;
    retryCount: number;
    fallback?: React.ReactNode;
}) => Boolean(fallback)
    && Boolean(error)
    && isBoardRenderErrorRecoverable(error)
    && retryCount < BOARD_ERROR_BOUNDARY_MAX_RETRIES;

/**
 * Board 组件的错误边界
 *
 * 捕获 Board 渲染过程中的错误，防止整个应用崩溃。
 * 常见错误包括：
 * - AudioProvider 未初始化
 * - 其他 Context Provider 缺失
 * - 组件内部逻辑错误
 *
 * 自动重试机制：
 * - 捕获错误后等待 500ms 自动重试
 * - 最多重试 5 次
 * - 重试期间显示 loading fallback
 */
class BoardErrorBoundary extends React.Component<
    { children: React.ReactNode; fallback?: React.ReactNode },
    { hasError: boolean; error?: Error; retryCount: number }
> {
    private retryTimer: NodeJS.Timeout | null = null;
    private readonly maxRetries = BOARD_ERROR_BOUNDARY_MAX_RETRIES;

    constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, retryCount: 0 };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('[BoardBridge] Board 组件渲染错误:', error, errorInfo);
        console.error('[BoardBridge] 错误堆栈:', error.stack);
        const jsStack = error.stack;
        const componentStack = errorInfo.componentStack ?? undefined;
        const stack = [jsStack ?? '', componentStack ?? ''].filter(Boolean).join('\n');
        const signature = `board-render-error:${error.name}:${error.message}`;
        void reportClientAutoFeedbackOnce(signature, {
            content: `[auto][board-render-error] ${error.message || 'Board render error'}`,
            autoReportKind: 'board-render-error',
            source: 'board-render-error',
            gameId: 'unknown',
            gameName: 'client',
            errorName: error.name || 'Error',
            errorMessage: error.message || 'Board render error',
            errorSource: 'board.error_boundary',
            stack,
            jsStack,
            componentStack,
        });

        const isRecoverable = isBoardRenderErrorRecoverable(error);

        if (isRecoverable && this.state.retryCount < this.maxRetries) {
            // 指数退避：500ms, 1000ms, 2000ms, 4000ms, 5000ms (最大)
            const delay = Math.min(500 * Math.pow(2, this.state.retryCount), 5000);

            console.warn(`[BoardBridge] 检测到可恢复错误，将在 ${delay}ms 后重试 (${this.state.retryCount + 1}/${this.maxRetries})`);

            this.retryTimer = setTimeout(() => {
                this.setState(prev => ({
                    hasError: false,
                    error: undefined,
                    retryCount: prev.retryCount + 1,
                }));
            }, delay);
        } else if (this.state.retryCount >= this.maxRetries) {
            console.error('[BoardBridge] 已达到最大重试次数，放弃重试');
        } else {
            console.error('[BoardBridge] 错误不可恢复，不进行重试');
        }
    }

    componentDidUpdate(prevProps: { children: React.ReactNode }) {
        // 如果 children 变化，重置错误状态和重试计数
        if (this.state.hasError && prevProps.children !== this.props.children) {
            this.setState({ hasError: false, error: undefined, retryCount: 0 });
        }
    }

    componentWillUnmount() {
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }
    }

    render() {
        if (this.state.hasError) {
            if (shouldShowBoardRenderFallback({
                error: this.state.error,
                retryCount: this.state.retryCount,
                fallback: this.props.fallback,
            })) {
                return this.props.fallback;
            }

            return (
                <div data-bg-friendly-screen="true" className="w-full h-full flex items-center justify-center text-red-300 text-sm p-4">
                    <div className="text-center">
                        <div className="mb-2">游戏加载失败</div>
                        <div className="text-xs text-white/50 mb-2">
                            {this.state.error?.message || '未知错误'}
                        </div>
                        {this.state.retryCount >= this.maxRetries && (
                            <div className="text-xs text-white/30">
                                已重试 {this.maxRetries} 次
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
