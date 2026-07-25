/**
 * 大杀四方（Smash Up）专属设置：
 * - 英文卡图中文覆盖层
 * - 点击 / 拖拽交互模式
 *
 * 游客走 localStorage；登录用户走 user-settings API。
 * 若登录后服务端尚未初始化，则会把游客本地值迁移到账号设置。
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import {
    getSmashUpPreference,
    updateSmashUpPreference,
    type SmashUpInteractionMode,
    type SmashUpPreference,
} from '../../../api/user-settings';

const OVERLAY_LS_KEY = 'smashup_overlay_zh_enabled';
const INTERACTION_MODE_LS_KEY = 'smashup_interaction_mode';

export const DEFAULT_SMASHUP_PREFERENCE: SmashUpPreference = {
    overlayEnabled: true,
    interactionMode: 'click',
};

function readLocalPreference(): SmashUpPreference {
    try {
        const overlayStored = localStorage.getItem(OVERLAY_LS_KEY);
        const interactionStored = localStorage.getItem(INTERACTION_MODE_LS_KEY);
        return {
            overlayEnabled: overlayStored === null ? true : overlayStored === 'true',
            interactionMode: interactionStored === 'drag' ? 'drag' : 'click',
        };
    } catch {
        return { ...DEFAULT_SMASHUP_PREFERENCE };
    }
}

function writeLocalPreference(preference: SmashUpPreference): void {
    try {
        localStorage.setItem(OVERLAY_LS_KEY, String(preference.overlayEnabled));
        localStorage.setItem(INTERACTION_MODE_LS_KEY, preference.interactionMode);
    } catch {
        // 忽略隐私模式或存储不可用
    }
}

interface SmashUpOverlayContextValue {
    overlayEnabled: boolean;
    interactionMode: SmashUpInteractionMode;
    toggleOverlay: () => void;
    setInteractionMode: (mode: SmashUpInteractionMode) => void;
    selectedFactions: Set<string>;
    setSelectedFactions: (factions: string[]) => void;
}

const SmashUpOverlayContext = createContext<SmashUpOverlayContextValue>({
    overlayEnabled: true,
    interactionMode: 'click',
    toggleOverlay: () => undefined,
    setInteractionMode: () => undefined,
    selectedFactions: new Set(),
    setSelectedFactions: () => undefined,
});

function areFactionSetsEqual(prev: Set<string>, next: string[]): boolean {
    const nextSet = new Set(next);
    if (prev.size !== nextSet.size) return false;
    return Array.from(nextSet).every(factionId => prev.has(factionId));
}

export function SmashUpOverlayProvider({ children }: { children: ReactNode }) {
    const { user, token } = useAuth();
    const [preference, setPreference] = useState<SmashUpPreference>(() => readLocalPreference());
    const [selectedFactions, setSelectedFactionsState] = useState<Set<string>>(new Set());
    const initUserIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!user || !token) {
            initUserIdRef.current = null;
            setPreference(readLocalPreference());
            return;
        }

        let cancelled = false;
        const localPreference = readLocalPreference();
        setPreference(localPreference);

        void getSmashUpPreference(token)
            .then(async (response) => {
                if (cancelled) return;
                if (!response.empty && response.settings) {
                    setPreference(response.settings);
                    return;
                }
                if (initUserIdRef.current === user.id) return;
                initUserIdRef.current = user.id;
                await updateSmashUpPreference(token, localPreference);
                if (cancelled) return;
                setPreference(localPreference);
            })
            .catch(() => {
                if (cancelled) return;
                setPreference(localPreference);
            });

        return () => {
            cancelled = true;
        };
    }, [user, token]);

    const toggleOverlay = useCallback(() => {
        setPreference((prev) => {
            const next = {
                ...prev,
                overlayEnabled: !prev.overlayEnabled,
            };
            if (user && token) {
                void updateSmashUpPreference(token, next).catch(() => undefined);
            } else {
                writeLocalPreference(next);
            }
            return next;
        });
    }, [user, token]);

    const setInteractionMode = useCallback((mode: SmashUpInteractionMode) => {
        setPreference((prev) => {
            const next = {
                ...prev,
                interactionMode: mode,
            };
            if (user && token) {
                void updateSmashUpPreference(token, next).catch(() => undefined);
            } else {
                writeLocalPreference(next);
            }
            return next;
        });
    }, [user, token]);

    const setSelectedFactions = useCallback((factions: string[]) => {
        setSelectedFactionsState(prev => (
            areFactionSetsEqual(prev, factions) ? prev : new Set(factions)
        ));
    }, []);

    return (
        <SmashUpOverlayContext.Provider
            value={{
                overlayEnabled: preference.overlayEnabled,
                interactionMode: preference.interactionMode,
                toggleOverlay,
                setInteractionMode,
                selectedFactions,
                setSelectedFactions,
            }}
        >
            {children}
        </SmashUpOverlayContext.Provider>
    );
}

export function useSmashUpOverlay() {
    return useContext(SmashUpOverlayContext);
}
