/**
 * useUIState Hook
 * 
 * 统一管理所有 UI 相关状态，包括：
 * - 弹窗状态（确认、净化、击倒移除等）
 * - 放大预览状态（图片、卡牌）
 * - 视图模式（自己/对手）
 * - 布局编辑模式
 * - 提示显示状态
 */

import { useState, useCallback } from 'react';
import type { AbilityCard } from '../domain/types';

/**
 * 放大预览状态
 */
export interface MagnifyState {
    /** 放大的图片路径 */
    image: string | null;
    /** 放大的单张卡牌 */
    card: AbilityCard | null;
    /** 放大的多张卡牌（弃牌堆预览） */
    cards: AbilityCard[];
}

/**
 * 弹窗状态
 */
export interface ModalState {
    /** 确认跳过弹窗 */
    confirmSkip: boolean;
    /** 净化弹窗 */
    purify: boolean;
    /** 确认移除击倒弹窗 */
    removeKnockdown: boolean;
    /** 多技能选择弹窗（多个不同技能同时满足条件时弹出） */
    abilityChoice: boolean;
}

/**
 * UI 状态接口
 */
export interface UIState {
    // 放大预览
    magnify: MagnifyState;
    isMagnifyOpen: boolean;
    setMagnifiedImage: (image: string | null) => void;
    setMagnifiedCard: (card: AbilityCard | null) => void;
    setMagnifiedCards: (cards: AbilityCard[]) => void;
    closeMagnify: () => void;
    
    // 弹窗
    modals: ModalState;
    openModal: (modal: keyof ModalState) => void;
    closeModal: (modal: keyof ModalState) => void;
    
    // 视图模式
    viewMode: 'self' | 'opponent';
    setViewMode: (mode: 'self' | 'opponent') => void;
    toggleViewMode: () => void;
    
    // 布局编辑
    isLayoutEditing: boolean;
    setIsLayoutEditing: (editing: boolean) => void;
    toggleLayoutEditing: () => void;
    
    // 提示显示
    isTipOpen: boolean;
    setIsTipOpen: (open: boolean) => void;
    toggleTip: () => void;
    
    // 错误提示
    headerError: string | null;
    setHeaderError: (error: string | null) => void;
    showHeaderError: (message: string, duration?: number) => void;
    
    // 动画状态
    isRolling: boolean;
    setIsRolling: (rolling: boolean) => void;
    rerollingDiceIds: number[];
    setRerollingDiceIds: (ids: number[]) => void;
    activatingAbilityId: string | undefined;
    setActivatingAbilityId: (id: string | undefined) => void;
    
    // 拖拽高亮状态
    discardHighlighted: boolean;
    setDiscardHighlighted: (highlighted: boolean) => void;
    sellButtonVisible: boolean;
    setSellButtonVisible: (visible: boolean) => void;
    coreAreaHighlighted: boolean;
    setCoreAreaHighlighted: (highlighted: boolean) => void;
    
    // 撤销相关
    lastUndoCardId: string | undefined;
    setLastUndoCardId: (id: string | undefined) => void;
}

/**
 * 管理所有 UI 状态的 Hook
 */
export function useUIState(): UIState {
    // 放大预览状态
    const [magnifiedImage, setMagnifiedImage] = useState<string | null>(null);
    const [magnifiedCard, setMagnifiedCard] = useState<AbilityCard | null>(null);
    const [magnifiedCards, setMagnifiedCards] = useState<AbilityCard[]>([]);
    
    // 弹窗状态
    const [modals, setModals] = useState<ModalState>({
        confirmSkip: false,
        purify: false,
        removeKnockdown: false,
        abilityChoice: false,
    });
    
    // 视图模式
    const [viewMode, setViewMode] = useState<'self' | 'opponent'>('self');
    
    // 布局编辑
    const [isLayoutEditing, setIsLayoutEditing] = useState(false);
    
    // 提示显示
    const [isTipOpen, setIsTipOpen] = useState(true);
    
    // 错误提示
    const [headerError, setHeaderError] = useState<string | null>(null);
    
    // 动画状态
    const [isRolling, setIsRolling] = useState(false);
    const [rerollingDiceIds, setRerollingDiceIds] = useState<number[]>([]);
    const [activatingAbilityId, setActivatingAbilityId] = useState<string | undefined>(undefined);
    
    // 拖拽高亮状态
    const [discardHighlighted, setDiscardHighlighted] = useState(false);
    const [sellButtonVisible, setSellButtonVisible] = useState(false);
    const [coreAreaHighlighted, setCoreAreaHighlighted] = useState(false);
    
    // 撤销相关
    const [lastUndoCardId, setLastUndoCardId] = useState<string | undefined>(undefined);
    
    // 计算放大预览是否打开
    const isMagnifyOpen = Boolean(magnifiedImage || magnifiedCard || magnifiedCards.length > 0);
    
    // 关闭放大预览
    const closeMagnify = useCallback(() => {
        setMagnifiedImage(null);
        setMagnifiedCard(null);
        setMagnifiedCards([]);
    }, []);
    
    // 打开弹窗
    const openModal = useCallback((modal: keyof ModalState) => {
        setModals(prev => ({ ...prev, [modal]: true }));
    }, []);
    
    // 关闭弹窗
    const closeModal = useCallback((modal: keyof ModalState) => {
        setModals(prev => ({ ...prev, [modal]: false }));
    }, []);
    
    // 切换视图模式
    const toggleViewMode = useCallback(() => {
        setViewMode(prev => prev === 'self' ? 'opponent' : 'self');
    }, []);
    
    // 切换布局编辑
    const toggleLayoutEditing = useCallback(() => {
        setIsLayoutEditing(prev => !prev);
    }, []);
    
    // 切换提示显示
    const toggleTip = useCallback(() => {
        setIsTipOpen(prev => !prev);
    }, []);
    
    // 显示头部错误（自动消失）
    const showHeaderError = useCallback((message: string, duration = 3000) => {
        setHeaderError(message);
        setTimeout(() => setHeaderError(null), duration);
    }, []);
    
    return {
        // 放大预览
        magnify: {
            image: magnifiedImage,
            card: magnifiedCard,
            cards: magnifiedCards,
        },
        isMagnifyOpen,
        setMagnifiedImage,
        setMagnifiedCard,
        setMagnifiedCards,
        closeMagnify,
        
        // 弹窗
        modals,
        openModal,
        closeModal,
        
        // 视图模式
        viewMode,
        setViewMode,
        toggleViewMode,
        
        // 布局编辑
        isLayoutEditing,
        setIsLayoutEditing,
        toggleLayoutEditing,
        
        // 提示显示
        isTipOpen,
        setIsTipOpen,
        toggleTip,
        
        // 错误提示
        headerError,
        setHeaderError,
        showHeaderError,
        
        // 动画状态
        isRolling,
        setIsRolling,
        rerollingDiceIds,
        setRerollingDiceIds,
        activatingAbilityId,
        setActivatingAbilityId,
        
        // 拖拽高亮状态
        discardHighlighted,
        setDiscardHighlighted,
        sellButtonVisible,
        setSellButtonVisible,
        coreAreaHighlighted,
        setCoreAreaHighlighted,
        
        // 撤销相关
        lastUndoCardId,
        setLastUndoCardId,
    };
}
