import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportClientAutoFeedbackOnce } from '../lib/feedback/clientAutoReport';
import { isStaleChunkError, reloadForStaleChunkOnce } from '../lib/staleChunkReloadGuard';

type HomeModalErrorBoundaryProps = {
    children: ReactNode;
    resetKey: string;
};

type HomeModalErrorBoundaryState = {
    hasError: boolean;
};

export class HomeModalErrorBoundary extends Component<HomeModalErrorBoundaryProps, HomeModalErrorBoundaryState> {
    public state: HomeModalErrorBoundaryState = {
        hasError: false,
    };

    public static getDerivedStateFromError(): HomeModalErrorBoundaryState {
        return { hasError: true };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[Home] 游戏详情弹窗渲染失败，已回退到首页', error, errorInfo);
        if (isStaleChunkError(error) && reloadForStaleChunkOnce('home-modal-error-boundary', window)) {
            return;
        }
        const jsStack = error.stack;
        const componentStack = errorInfo.componentStack ?? undefined;
        const stack = [jsStack ?? '', componentStack ?? ''].filter(Boolean).join('\n');
        const signature = `home-modal-error-boundary:${error.name}:${error.message}`;
        void reportClientAutoFeedbackOnce(signature, {
            content: `[auto][home-modal-error-boundary] ${error.message || 'Home modal render error'}`,
            autoReportKind: 'home-modal-render-error',
            source: 'home-modal-error-boundary',
            gameId: 'unknown',
            gameName: 'client',
            errorName: error.name || 'Error',
            errorMessage: error.message || 'Home modal render error',
            errorSource: 'home.modal_error_boundary',
            stack,
            jsStack,
            componentStack,
        });
    }

    public componentDidUpdate(prevProps: HomeModalErrorBoundaryProps) {
        if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
            this.setState({ hasError: false });
        }
    }

    public render() {
        if (this.state.hasError) {
            return null;
        }
        return this.props.children;
    }
}
