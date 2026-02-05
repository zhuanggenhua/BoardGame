import React, { useEffect, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { MatchState } from '../engine/types';

interface UndoContextValue {
    G: MatchState<unknown>;
    ctx: any;
    moves: any;
    playerID: string | null;
    isGameOver: boolean;
    isLocalMode?: boolean; // 是否本地同屏模式
}
type Listener = () => void;
let undoState: UndoContextValue | null = null;
const listeners = new Set<Listener>();

const subscribe = (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

const setUndoState = (next: UndoContextValue | null) => {
    undoState = next;
    listeners.forEach((listener) => listener());
};

const getUndoState = () => undoState;

interface UndoProviderProps {
    children: ReactNode;
    value: UndoContextValue;
}

/**
 * UndoProvider - 在游戏 Board 组件中提供撤回状态
 * 
 * 使用示例：
 * ```tsx
 * <UndoProvider value={{ G, ctx, moves, playerID, isGameOver }}>
 *     {游戏界面}
 * </UndoProvider>
 * ```
 */
export const UndoProvider: React.FC<UndoProviderProps> = ({ children, value }) => {
    const lastValueRef = React.useRef<UndoContextValue | null>(null);
    useEffect(() => {
        const prev = lastValueRef.current;
        const isSame = prev
            && prev.G === value.G
            && prev.ctx === value.ctx
            && prev.moves === value.moves
            && prev.playerID === value.playerID
            && prev.isGameOver === value.isGameOver
            && prev.isLocalMode === value.isLocalMode;
        if (!isSame) {
            lastValueRef.current = value;
            setUndoState(value);
        }
    }, [value]);
    useEffect(() => () => {
        lastValueRef.current = null;
        setUndoState(null);
    }, []);
    return <>{children}</>;
};

/**
 * useUndo - 在任何组件中获取撤回状态
 * 
 * @returns 撤回状态对象，如果不在游戏中返回 null
 */
export const useUndo = (): UndoContextValue | null => {
    return useSyncExternalStore(subscribe, getUndoState, getUndoState);
};

/**
 * useUndoStatus - 获取撤回状态和红点标记
 * 
 * @returns 撤回状态类型和是否需要红点提醒
 */
export const useUndoStatus = (): {
    status: 'canRequest' | 'canReview' | 'isRequester' | null;
    hasNotification: boolean;
} => {
    const undoState = useUndo();
    
    if (!undoState || undoState.isGameOver || undoState.playerID == null) {
        return { status: null, hasNotification: false };
    }

    const { G, playerID } = undoState;
    const normalizedPlayerId = String(playerID);
    const history = G.sys?.undo?.snapshots || [];
    const request = G.sys?.undo?.pendingRequest;
    const requesterId = request?.requesterId != null ? String(request.requesterId) : null;
    
    let status: 'canRequest' | 'canReview' | 'isRequester' | null = null;
    let hasNotification = false;
    
    if (requesterId && requesterId === normalizedPlayerId) {
        // 我是申请者，等待批准
        status = 'isRequester';
        hasNotification = false; // 等待中不显示红点
    } else if (requesterId && requesterId !== normalizedPlayerId) {
        // 对方请求撤回，需要我审批
        status = 'canReview';
        hasNotification = true; // 显示红点提醒
    } else if (history.length > 0 && !request) {
        // 可以发起撤回请求
        status = 'canRequest';
        hasNotification = false;
    }
    
    return { status, hasNotification };
};
