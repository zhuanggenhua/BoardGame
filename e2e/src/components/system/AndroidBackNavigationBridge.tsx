import { useEffect, useEffectEvent, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useModalStack } from '../../contexts/ModalStackContext';
import { resolveAndroidBackNavigationAction } from '../../lib/mobile/androidBackNavigation';
import { resolveInAppUrlPath } from '../../lib/mobile/appUrlRouting';
import { dispatchAppVisibilityChange } from '../../lib/mobile/appVisibility';
import { isNativeAndroidRuntime } from '../../lib/mobile/androidRuntime';
import { isTextEntryElement } from '../../lib/textEntry';

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

let capacitorAppPluginLoader: Promise<CapacitorAppPluginModule | null> | null = null;

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

export const AndroidBackNavigationBridge = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { stack, closeTop } = useModalStack();
    const topEntry = stack[stack.length - 1];
    const lastHandledUrlRef = useRef<string | null>(null);

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
        const appPluginModule = await loadCapacitorAppPlugin();
        if (!appPluginModule) {
            return;
        }

        const action = resolveAndroidBackNavigationAction({
            pathname: location.pathname,
            search: location.search,
            historyState: window.history.state,
            historyLength: window.history.length,
            modalStackDepth: stack.length,
            isTopModalClosable: topEntry?.closeOnEsc !== false,
            hasFocusedTextEntry: isTextEntryElement(document.activeElement),
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

        await appPluginModule.App.exitApp();
    });

    useEffect(() => {
        let disposed = false;
        const listenerHandles: PluginListenerHandle[] = [];

        const registerBackHandler = async () => {
            const appPluginModule = await loadCapacitorAppPlugin();
            if (!appPluginModule || disposed) {
                return;
            }

            const appState = await appPluginModule.App.getState().catch(() => null);
            if (appState) {
                dispatchAppVisibilityChange(appState.isActive);
            }
            const launchUrl = await appPluginModule.App.getLaunchUrl().catch(() => null);
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
        };

        void registerBackHandler();

        return () => {
            disposed = true;
            for (const listenerHandle of listenerHandles) {
                void listenerHandle.remove().catch(() => {});
            }
        };
    }, []);

    return null;
};

export default AndroidBackNavigationBridge;
