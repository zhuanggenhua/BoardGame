export interface LastErrorContext {
    message: string;
    name?: string;
    stack?: string;
    source?: string;
    timestamp: number;
}

type ErrorContextWindow = Window & {
    __BG_LAST_ERROR_CONTEXT__?: LastErrorContext;
    __BG_ERROR_CONTEXT_CAPTURE_INSTALLED__?: boolean;
};

const getHost = (): ErrorContextWindow | null => (
    typeof window !== 'undefined' ? (window as ErrorContextWindow) : null
);

const truncate = (value: string | undefined, max: number): string | undefined => {
    if (!value) return undefined;
    return value.length > max ? value.slice(0, max) : value;
};

export const setLastErrorContext = (context: Omit<LastErrorContext, 'timestamp'> & { timestamp?: number }) => {
    const host = getHost();
    if (!host) return;
    host.__BG_LAST_ERROR_CONTEXT__ = {
        ...context,
        message: truncate(context.message, 300) ?? 'Unknown error',
        name: truncate(context.name, 120),
        stack: truncate(context.stack, 4000),
        source: truncate(context.source, 128),
        timestamp: context.timestamp ?? Date.now(),
    };
};

export const getLastErrorContext = (): LastErrorContext | null => {
    const host = getHost();
    return host?.__BG_LAST_ERROR_CONTEXT__ ?? null;
};

export const installGlobalErrorContextCapture = () => {
    const host = getHost();
    if (!host || host.__BG_ERROR_CONTEXT_CAPTURE_INSTALLED__) return;
    host.__BG_ERROR_CONTEXT_CAPTURE_INSTALLED__ = true;

    host.addEventListener('error', (event) => {
        const error = event.error as Error | undefined;
        const source = event.filename
            ? `${event.filename}:${event.lineno ?? 0}:${event.colno ?? 0}`
            : 'window.error';
        setLastErrorContext({
            message: error?.message ?? event.message ?? 'Script error',
            name: error?.name,
            stack: error?.stack,
            source,
        });
    });

    host.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        if (reason instanceof Error) {
            setLastErrorContext({
                message: reason.message || 'Unhandled rejection',
                name: reason.name,
                stack: reason.stack,
                source: 'window.unhandledrejection',
            });
            return;
        }

        setLastErrorContext({
            message: typeof reason === 'string' ? reason : 'Unhandled rejection',
            source: 'window.unhandledrejection',
        });
    });
};
