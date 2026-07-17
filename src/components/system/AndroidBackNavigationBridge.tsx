import { useEffect, useEffectEvent, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useModalStack } from '../../contexts/ModalStackContext';
import { resolveAndroidBackNavigationAction } from '../../lib/mobile/androidBackNavigation';
import { resolveInAppUrlPath } from '../../lib/mobile/appUrlRouting';
import { dispatchAppVisibilityChange } from '../../lib/mobile/appVisibility';
import { isNativeAndroidRuntime } from '../../lib/mobile/androidRuntime';
import { shouldReserveSystemBackGesture } from '../../lib/mobile/systemBackGesture';
import { isTextEntrySessionElement } from '../../lib/textEntry';

type PluginListenerHandle = {
    remove(): Promise<void>;
};

type CapacitorAppPluginModule = {
    App: {
        addListener(
            eventName: 'backButton',
            listenerFunc: () => void,
        ): Promise<PluginListenerHandle>;
        addListener(
            eventName: 'appStateChange',
            listenerFunc: (state: { isActive: boolean }) => void,
        ): Promise<PluginListenerHandle>;
        addListener(
            eventName: 'appUrlOpen',
            listenerFunc: (event: { url: string }) => void,
        ): Promise<PluginListenerHandle>;
        getState(): Promise<{ isActive: boolean }>;
        getLaunchUrl(): Promise<{ url?: string }>;
        exitApp(): Promise<void>;
    };
};

type EdgeSwipeState = {
    pointerId: number;
    startX: number;
    startY: number;
    edge: 'left' | 'right';
    triggered: boolean;
};

const EDGE_BACK_SWIPE_DISTANCE_PX = 56;
const EDGE_BACK_SWIPE_MAX_VERTICAL_DRIFT_PX = 44;

let capacitorAppPluginLoader: Promise<CapacitorAppPluginModule | null> | null = null;

const getErrorMessage = (error: unknown) => (
    error instanceof Error ? error.message : String(error)
);

const isCapacitorAppPluginUnavailableError = (error: unknown) => (
    /"app" plugin is not implemented on android/i.test(getErrorMessage(error))
);

const disableCapacitorAppPlugin = () => {
    capacitorAppPluginLoader = Promise.resolve(null);
};

const loadCapacitorAppPlugin = async (): Promise<CapacitorAppPluginModule | null> => {
    if (!isNativeAndroidRuntime()) {
        return null;
    }

    if (!capacitorAppPluginLoader) {
        capacitorAppPluginLoader = import('@capacitor/app')
            .then((module) => module as CapacitorAppPluginModule)
            .catch(() => null);
    }

    return capacitorAppPluginLoader;
};

const swallowUnavailableCapacitorAppPluginError = (error: unknown) => {
    if (!isCapacitorAppPluginUnavailableError(error)) {
        return false;
    }
    disableCapacitorAppPlugin();
    return true;
};

export const AndroidBackNavigationBridge = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { stack, closeTop } = useModalStack();
    const topEntry = stack[stack.length - 1];
    const lastHandledUrlRef = useRef<string | null>(null);
    const edgeSwipeRef = useRef<EdgeSwipeState | null>(null);

    const navigateFromAppUrl = useEffectEvent((url: string, options?: { replace?: boolean }) => {
        const resolvedPath = resolveInAppUrlPath(url);
        if (!resolvedPath) {
            return;
        }

        if (lastHandledUrlRef.current === url) {
            return;
        }
        lastHandledUrlRef.current = url;

        const currentPath = `${location.pathname}${location.search}${location.hash}`;
        if (resolvedPath === currentPath) {
            return;
        }

        navigate(resolvedPath, { replace: options?.replace ?? false });
    });

    const handleBackNavigation = useEffectEvent(async () => {
        const action = resolveAndroidBackNavigationAction({
            pathname: location.pathname,
            search: location.search,
            historyState: window.history.state,
            historyLength: window.history.length,
            modalStackDepth: stack.length,
            isTopModalClosable: topEntry?.closeOnEsc !== false,
            isTopModalBackNavigationAllowed: topEntry?.allowSystemBackNavigation === true
                || topEntry?.allowPointerThrough === true,
            hasFocusedTextEntry: isTextEntrySessionElement(document.activeElement),
        });

        if (action.type === 'dismiss-text-entry') {
            const activeElement = document.activeElement;
            if (activeElement instanceof HTMLElement) {
                activeElement.blur();
            }
            return;
        }

        if (action.type === 'close-modal') {
            closeTop();
            return;
        }

        if (action.type === 'blocked') {
            return;
        }

        if (action.type === 'history-back') {
            window.history.back();
            return;
        }

        if (action.type === 'fallback-route') {
            navigate(action.path, { replace: true });
            return;
        }

        const appPluginModule = await loadCapacitorAppPlugin();
        if (!appPluginModule) {
            return;
        }

        try {
            await appPluginModule.App.exitApp();
        } catch (error) {
            if (!swallowUnavailableCapacitorAppPluginError(error)) {
                console.warn('[android-back-nav] exitApp failed', error);
            }
        }
    });

    useEffect(() => {
        let disposed = false;
        const listenerHandles: PluginListenerHandle[] = [];

        const registerBackHandler = async () => {
            const appPluginModule = await loadCapacitorAppPlugin();
            if (!appPluginModule || disposed) {
                return;
            }

            try {
                const appState = await appPluginModule.App.getState();
                dispatchAppVisibilityChange(appState.isActive);

                const launchUrl = await appPluginModule.App.getLaunchUrl();
                if (launchUrl?.url) {
                    navigateFromAppUrl(launchUrl.url, { replace: true });
                }

                listenerHandles.push(await appPluginModule.App.addListener('appStateChange', ({ isActive }) => {
                    dispatchAppVisibilityChange(isActive);
                }));
                listenerHandles.push(await appPluginModule.App.addListener('appUrlOpen', ({ url }) => {
                    navigateFromAppUrl(url);
                }));
                listenerHandles.push(await appPluginModule.App.addListener('backButton', () => {
                    void handleBackNavigation();
                }));
            } catch (error) {
                if (!swallowUnavailableCapacitorAppPluginError(error)) {
                    console.warn('[android-back-nav] app plugin registration failed', error);
                }
            }
        };

        void registerBackHandler();

        return () => {
            disposed = true;
            for (const listenerHandle of listenerHandles) {
                void listenerHandle.remove().catch(() => {});
            }
        };
    }, []);

    useEffect(() => {
        if (!isNativeAndroidRuntime() || typeof window === 'undefined' || typeof document === 'undefined') {
            return;
        }

        const resolveViewportWidth = () => (
            Number.isFinite(window.innerWidth) && window.innerWidth > 0
                ? window.innerWidth
                : document.documentElement.clientWidth
        );

        const beginEdgeSwipe = (pointerId: number, clientX: number, clientY: number) => {
            const viewportWidth = resolveViewportWidth();
            if (!shouldReserveSystemBackGesture({ enabled: true, clientX, viewportWidth })) {
                edgeSwipeRef.current = null;
                return;
            }

            edgeSwipeRef.current = {
                pointerId,
                startX: clientX,
                startY: clientY,
                edge: clientX <= viewportWidth / 2 ? 'left' : 'right',
                triggered: false,
            };
        };

        const updateEdgeSwipe = (pointerId: number, clientX: number, clientY: number, event: Event) => {
            const edgeSwipe = edgeSwipeRef.current;
            if (!edgeSwipe || edgeSwipe.pointerId !== pointerId || edgeSwipe.triggered) {
                return;
            }

            const deltaX = clientX - edgeSwipe.startX;
            const deltaY = Math.abs(clientY - edgeSwipe.startY);
            const horizontalTravel = edgeSwipe.edge === 'left' ? deltaX : -deltaX;
            if (horizontalTravel < EDGE_BACK_SWIPE_DISTANCE_PX || deltaY > EDGE_BACK_SWIPE_MAX_VERTICAL_DRIFT_PX) {
                return;
            }

            edgeSwipe.triggered = true;
            event.preventDefault();
            event.stopPropagation();
            void handleBackNavigation();
        };

        const finishEdgeSwipe = (pointerId: number) => {
            if (edgeSwipeRef.current?.pointerId === pointerId) {
                edgeSwipeRef.current = null;
            }
        };

        const handlePointerDown = (event: PointerEvent) => {
            if (event.pointerType !== 'touch' || (event.isPrimary === false && edgeSwipeRef.current !== null)) {
                return;
            }
            beginEdgeSwipe(event.pointerId, event.clientX, event.clientY);
        };

        const handlePointerMove = (event: PointerEvent) => {
            if (event.pointerType !== 'touch') {
                return;
            }
            updateEdgeSwipe(event.pointerId, event.clientX, event.clientY, event);
        };

        const handlePointerFinish = (event: PointerEvent) => {
            finishEdgeSwipe(event.pointerId);
        };

        document.addEventListener('pointerdown', handlePointerDown, true);
        document.addEventListener('pointermove', handlePointerMove, true);
        document.addEventListener('pointerup', handlePointerFinish, true);
        document.addEventListener('pointercancel', handlePointerFinish, true);

        return () => {
            edgeSwipeRef.current = null;
            document.removeEventListener('pointerdown', handlePointerDown, true);
            document.removeEventListener('pointermove', handlePointerMove, true);
            document.removeEventListener('pointerup', handlePointerFinish, true);
            document.removeEventListener('pointercancel', handlePointerFinish, true);
        };
    }, []);

    return null;
};

export default AndroidBackNavigationBridge;
