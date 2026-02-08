
import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        // Here you would log to Sentry
        // Sentry.captureException(error);
    }

    private handleReload = () => {
        window.location.reload();
    };

    private handleGoHome = () => {
        window.location.href = "/";
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-parchment-base-bg text-parchment-base-text font-serif flex flex-col items-center justify-center p-6 relative overflow-hidden">
                    {/* Background Texture/Effect */}
                    <div className="absolute inset-0 opacity-5 pointer-events-none"
                        style={{
                            backgroundImage: 'radial-gradient(circle at center, #8B0000 1px, transparent 1px)',
                            backgroundSize: '24px 24px'
                        }}>
                    </div>

                    <div className="z-10 bg-parchment-card-bg border-2 border-parchment-brown/20 p-8 rounded-xl shadow-2xl max-w-lg w-full text-center relative">
                        {/* Decorative Corners */}
                        <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-parchment-brown/40"></div>
                        <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-parchment-brown/40"></div>
                        <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-parchment-brown/40"></div>
                        <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-parchment-brown/40"></div>

                        <div className="flex justify-center mb-6">
                            <div className="bg-red-500/10 p-4 rounded-full">
                                <AlertTriangle size={64} className="text-red-500/80" strokeWidth={1.5} />
                            </div>
                        </div>

                        <h1 className="text-3xl font-bold text-parchment-brown mb-2 tracking-wide">
                            Something went wrong
                        </h1>
                        <p className="text-parchment-light-text mb-6">
                            系统遇到了一点小麻烦，魔法卷轴暂时无法通过。
                            <br />
                            The scrolls are momentarily illegible.
                        </p>

                        {/* Error Details (Only in Dev) */}
                        {import.meta.env.DEV && this.state.error && (
                            <div className="text-left bg-black/5 p-4 rounded text-xs font-mono text-parchment-wax overflow-auto max-h-40 mb-6 border border-parchment-wax/20">
                                {this.state.error.toString()}
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button
                                onClick={this.handleReload}
                                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-parchment-brown text-parchment-cream font-bold rounded-sm shadow-lg hover:bg-parchment-brown/90 transition-all hover:-translate-y-0.5"
                            >
                                <RefreshCw size={18} />
                                刷新页面 Reload
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-transparent border border-parchment-brown/30 text-parchment-brown font-bold rounded-sm hover:bg-parchment-brown/5 transition-all"
                            >
                                <Home size={18} />
                                返回大厅 Home
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
