import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Check, Dices, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { GameButton } from './components/GameButton';
import type { Die, PlayerId, TurnPhase } from '../types';
import type { InteractionDescriptor } from '../../../engine/systems/InteractionSystem';
import type { MultistepInteractionState } from '../../../engine/systems/useMultistepInteraction';
import type { DiceModifyResult, DiceModifyStep, DiceSelectResult, DiceSelectStep } from '../domain/systems';
import { Dice3D, DiceField3D, type ProjectedDiceLayout } from './Dice3D';
import { resolveCharacterIdFromDiceDefinitionId } from './assets';
import { UI_Z_INDEX } from '../../../core';
import { DiceBoxPhysicsSource } from '../../../lib/dice-physics/DiceBoxPhysicsSource';
import {
    DICETHRONE_DICE_BOX_STYLE_PROFILE,
    DICETHRONE_MOBILE_DICE_BOX_STYLE_PROFILE,
} from './diceBoxStyleProfiles';
import { loadDiceThroneDiceBoxSkins, type DiceThroneDiceBoxSkin } from './diceThroneDiceBoxSkins';

// ============================================================================
// DiceThrone 骰子交互元数据类型
// ============================================================================

interface DtDiceModifyMeta {
    dtType: 'modifyDie';
    dieModifyConfig?: {
        mode: 'set' | 'adjust' | 'copy' | 'any';
        targetValue?: number;
        adjustRange?: { min: number; max: number };
    };
    selectCount: number;
    diceOwnerId?: PlayerId;
    targetOpponentDice: boolean;
}

interface DtDiceSelectMeta {
    dtType: 'selectDie';
    selectCount: number;
    diceOwnerId?: PlayerId;
    targetOpponentDice: boolean;
}

type DtDiceMeta = DtDiceModifyMeta | DtDiceSelectMeta;

const DICE_TRAY_WIDTH_CLASS_NAME = 'w-[5.8vw]';

const DESKTOP_DICE_TRAY_TOKENS = {
    diceSize: '4vw',
    containerClassName: `flex flex-col items-center p-[0.6vw] rounded-[1.5vw] gap-[0.5vw] ${DICE_TRAY_WIDTH_CLASS_NAME} shrink-0 relative transition-all duration-300`,
    glossClassName: 'absolute inset-0 rounded-[1.5vw] bg-gradient-to-tr from-white/0 via-white/5 to-transparent pointer-events-none',
    rimClassName: 'absolute inset-[0.1vw] rounded-[1.4vw] pointer-events-none border-[0.05vw]',
    shadowClassName: 'absolute top-0 left-0 right-0 h-[1.5vw] rounded-t-[1.5vw] bg-gradient-to-b from-black/95 to-transparent pointer-events-none',
    trayInnerClassName: 'flex flex-col gap-[0.5vw] items-center justify-center w-full p-[0.2vw]',
    rowGapClassName: 'gap-[0.3vw]',
    dieGapClassName: 'gap-[0.25vw]',
    adjustButtonClassName: 'w-[1.2vw] h-[1.2vw] text-[0.8vw]',
    lockedLabelClassName: 'min-w-max whitespace-nowrap text-[0.6vw] px-[0.4vw] py-[0.1vw]',
    selectedBadgeClassName: 'w-[1vw] h-[1vw] -top-[0.3vw] -right-[0.3vw]',
    selectedBadgeIconClassName: '',
};

const DESKTOP_DICE_ACTION_TOKENS = {
    containerClassName: 'w-[10.2vw] grid grid-cols-2 gap-[0.4vw] items-stretch h-[2.5vw]',
    buttonClassName: '!px-[0.5vw] !py-0 !min-h-0 !rounded-[0.5vw]',
    interactionTextClassName: '!text-[0.75vw]',
    rollTextClassName: '!text-[0.7vw] tracking-tighter',
    confirmTextClassName: '!text-[0.7vw]',
    dotClassName: 'w-[0.45vw] h-[0.45vw]',
    dotsContainerClassName: 'flex flex-col flex-wrap gap-[0.15vw] justify-center items-center h-[1.8vw] ml-[0.3vw] shrink-0 content-center',
};

const CENTER_DICE_ACTION_TOKENS = {
    containerClassName: 'pointer-events-auto flex items-center justify-center gap-[0.6vw] h-[3.2vw] min-h-[44px]',
    buttonClassName: '!min-h-[44px] h-[3vw] !rounded-[0.7vw] !px-[1vw] min-w-[6.8vw] shadow-[0_5px_0_rgba(0,0,0,0.45)]',
    interactionTextClassName: '!text-[0.84vw]',
    rollTextClassName: '!text-[0.82vw]',
    confirmTextClassName: '!text-[0.82vw]',
    dotClassName: 'w-[0.48vw] h-[0.48vw] min-w-[5px] min-h-[5px]',
    dotsContainerClassName: 'flex items-center gap-[0.2vw] ml-[0.35vw] shrink-0',
};

const CENTER_DICE_SCATTER_SLOTS = [
    { left: '50%', top: '30%', rotate: '10deg', zIndex: 5, world: { x: 0.08, y: -1.12, z: -0.52 } },
    { left: '26%', top: '50%', rotate: '-24deg', zIndex: 4, world: { x: -1.68, y: -1.12, z: 0.06 } },
    { left: '74%', top: '45%', rotate: '20deg', zIndex: 3, world: { x: 1.72, y: -1.12, z: -0.08 } },
    { left: '62%', top: '61%', rotate: '-12deg', zIndex: 2, world: { x: 0.98, y: -1.12, z: 0.42 } },
    { left: '38%', top: '63%', rotate: '28deg', zIndex: 1, world: { x: -0.9, y: -1.12, z: 0.34 } },
];

const BOARD_DICE_SCATTER_SLOTS = [
    { left: '23%', top: '42%', rotate: '-12deg', zIndex: 5, world: { x: -0.58, y: -1.07, z: -0.38 } },
    { left: '40%', top: '24%', rotate: '8deg', zIndex: 2, world: { x: -0.06, y: -1.07, z: -0.76 } },
    { left: '50%', top: '52%', rotate: '-4deg', zIndex: 4, world: { x: 0.02, y: -1.07, z: 0.12 } },
    { left: '67%', top: '30%', rotate: '10deg', zIndex: 1, world: { x: 0.54, y: -1.07, z: -0.34 } },
    { left: '77%', top: '56%', rotate: '-8deg', zIndex: 3, world: { x: 0.48, y: -1.07, z: 0.52 } },
];

const BOARD_OVERLAY_DICE_SIZE_MIN_PX = 42;
const BOARD_OVERLAY_DICE_SIZE_MAX_PX = 62;
const BOARD_DICE_HIT_TARGET_SIZE_PX = 44;
const BOARD_DICE_MOBILE_HIT_TARGET_SIZE_PX = 40;
const BOARD_DICE_RING_SIZE_MULTIPLIER = 1.35;
const BOARD_DICE_STAGE_Z_INDEX = UI_Z_INDEX.cardPreviewTooltip + 1;
const BOARD_DICE_OPERATION_HINT_Z_INDEX = UI_Z_INDEX.overlayRaised;
const BOARD_DICE_LOCK_LABEL_Z_INDEX = BOARD_DICE_STAGE_Z_INDEX + 2;
const BOARD_DICE_INTERACTION_ARM_DELAY_MS = 180;
const OVERLAY_DICE_ADJUST_BUTTON_CLASS_NAME = [
    'pointer-events-auto absolute top-1/2 z-40 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full',
    'border border-white/40 bg-amber-600 text-base font-black leading-none text-white shadow-[0_0_14px_rgba(245,158,11,0.65)]',
    'transition hover:scale-110 hover:bg-amber-500 disabled:cursor-not-allowed disabled:border-slate-500/40 disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none',
].join(' ');
const BOARD_DICE_OPERATION_BUTTON_CLASS_NAME = [
    'pointer-events-auto relative z-40 flex h-8 w-8 items-center justify-center rounded-full',
    'border border-white/45 bg-amber-600 text-lg font-black leading-none text-white shadow-[0_0_14px_rgba(245,158,11,0.72)]',
    'transition hover:scale-110 hover:bg-amber-500 disabled:cursor-not-allowed disabled:border-slate-500/40 disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none',
].join(' ');

function clampNumber(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function resolveBoardOverlayDiceSize(layout?: ProjectedDiceLayout): number {
    if (!layout) return 52;

    const heightProgress = clampNumber((layout.height - 46) / 120, 0, 1);
    const stretchedWidthRatio = clampNumber((layout.width / Math.max(layout.height, 1)) - 1, 0, 1.8);
    const sizeFromHeight = BOARD_OVERLAY_DICE_SIZE_MIN_PX + (heightProgress * 28);
    const widthCompression = stretchedWidthRatio * 6;

    return Math.round(
        clampNumber(
            sizeFromHeight - widthCompression,
            BOARD_OVERLAY_DICE_SIZE_MIN_PX,
            BOARD_OVERLAY_DICE_SIZE_MAX_PX,
        ),
    );
}

function resolveBoardDiceRingSize(layout?: ProjectedDiceLayout): number {
    if (!layout) return Math.round(resolveBoardOverlayDiceSize(layout) * BOARD_DICE_RING_SIZE_MULTIPLIER);

    return Math.round(Math.max(
        resolveBoardOverlayDiceSize(layout),
        layout.width,
        layout.height,
    ) * BOARD_DICE_RING_SIZE_MULTIPLIER);
}

function clampBoardOverlayCenter(value: number, size: number, fallback: number): number {
    if (!Number.isFinite(value)) return fallback;

    const halfSize = Math.max(0, size / 2);
    return clampNumber(value, halfSize, Math.max(halfSize, fallback - halfSize));
}

function resolveBoardDiceStageSize(isMobileBoardPresentation: boolean): { width: number; height: number } {
    if (typeof window === 'undefined') {
        return isMobileBoardPresentation
            ? { width: 252, height: 128 }
            : { width: 420, height: 420 };
    }

    if (isMobileBoardPresentation) {
        return {
            width: clampNumber(window.innerWidth * 0.29, 252, 282),
            height: 128,
        };
    }

    const size = clampNumber(window.innerWidth * 0.31, 360, 500);
    return { width: size, height: size };
}

function resolveDiceInteractionHint(
    t: (key: string, options?: Record<string, unknown>) => string,
    dtMeta: DtDiceMeta | undefined,
    modifyResult: DiceModifyResult | null | undefined,
    selectResult: DiceSelectResult | null | undefined,
): string | null {
    if (!dtMeta) return null;

    const isModifyMode = dtMeta.dtType === 'modifyDie';
    const isSelectMode = dtMeta.dtType === 'selectDie';
    const currentCount = isSelectMode
        ? (selectResult?.selectedDiceIds.length ?? 0)
        : (modifyResult?.modCount ?? 0);
    const maxCount = dtMeta.selectCount ?? 1;

    if (isModifyMode) {
        const config = dtMeta.dieModifyConfig;
        const mode = config?.mode;
        if (mode === 'copy') {
            if (currentCount === 0) return t('interaction.hint_copy_step1');
            if (currentCount === 1) {
                const sourceValue = Object.values(modifyResult?.modifications ?? {})[0];
                return t('interaction.hint_copy_step2', { value: sourceValue ?? '?' });
            }
            return t('interaction.hint_done');
        }
        if (mode === 'set') {
            if (currentCount >= maxCount) return t('interaction.hint_done');
            return t('interaction.hint_set', { value: config?.targetValue ?? '?' });
        }
        if (mode === 'adjust') return t('interaction.hint_adjust');
        if (mode === 'any') {
            if (currentCount >= maxCount) return t('interaction.hint_done');
            return t('interaction.hint_any');
        }
    }

    if (isSelectMode) {
        if (currentCount >= maxCount) return t('interaction.hint_done');
        const key = dtMeta.targetOpponentDice ? 'interaction.hint_select_opponent' : 'interaction.hint_select';
        return t(key, { current: currentCount, max: maxCount });
    }

    return null;
}

/** 从 multistep-choice interaction 中提取 DiceThrone 元数据 */
function getDtMeta(interaction?: InteractionDescriptor): DtDiceMeta | undefined {
    if (!interaction || interaction.kind !== 'multistep-choice') return undefined;
    const meta = (interaction.data as { meta?: DtDiceMeta } | undefined)?.meta;
    if (!meta?.dtType) return undefined;
    return meta;
}

// ============================================================================
// DiceTray 组件
// ============================================================================

export const DiceTray = ({
    dice,
    rollCount,
    onToggleLock,
    currentPhase: _currentPhase,
    canInteract,
    isRolling,
    rerollingDiceIds,
    rerollAnimationSeq,
    locale,
    interaction,
    multistepInteraction,
    isPassiveRerollMode,
    presentation = 'rail',
}: {
    dice: Die[];
    rollCount: number;
    onToggleLock: (id: number) => void;
    currentPhase: TurnPhase;
    canInteract: boolean;
    isRolling: boolean;
    rerollingDiceIds?: number[];
    rerollAnimationSeq?: number;
    locale?: string;
    /** 当前骰子交互描述符（从 sys.interaction.current 读取） */
    interaction?: InteractionDescriptor;
    /** useMultistepInteraction 返回的状态和操作 */
    multistepInteraction?: MultistepInteractionState<DiceModifyResult | DiceSelectResult>;
    /** 被动重掷选择模式（翡翠色高亮） */
    isPassiveRerollMode?: boolean;
    /** rail 用于右侧栏，center 用于中场散落舞台，board 用于玩家面板骰盘 */
    presentation?: 'rail' | 'center' | 'board';
}) => {
    const { t } = useTranslation('game-dicethrone');
    const decreaseLabel = t('decrease', { ns: 'common' });
    const increaseLabel = t('increase', { ns: 'common' });
    const isCenterPresentation = presentation === 'center';
    const isBoardPresentation = presentation === 'board';
    const isOverlayPresentation = isCenterPresentation || isBoardPresentation;
    const isMobileBoardPresentation = isBoardPresentation
        && typeof window !== 'undefined'
        && window.innerWidth <= 1023;
    const diceBoxStyleProfile = isMobileBoardPresentation
        ? DICETHRONE_MOBILE_DICE_BOX_STYLE_PROFILE
        : DICETHRONE_DICE_BOX_STYLE_PROFILE;
    const railTokens = DESKTOP_DICE_TRAY_TOKENS;
    const {
        diceSize,
        containerClassName,
        glossClassName,
        rimClassName,
        shadowClassName,
        trayInnerClassName,
        rowGapClassName,
        dieGapClassName,
        adjustButtonClassName,
        lockedLabelClassName,
        selectedBadgeClassName,
        selectedBadgeIconClassName,
    } = railTokens;
    const resolvedDiceSize = isOverlayPresentation
        ? (isBoardPresentation ? 'clamp(48px, 4.8vw, 88px)' : 'clamp(42px, 4.3vw, 82px)')
        : diceSize;
    const resolvedContainerClassName = isOverlayPresentation
        ? (isBoardPresentation
            ? 'relative h-full w-full pointer-events-auto'
            : 'relative w-[clamp(420px,38vw,620px)] h-[clamp(360px,43vw,660px)] pointer-events-auto')
        : containerClassName;
    const resolvedTrayInnerClassName = isOverlayPresentation
        ? 'relative h-full w-full'
        : trayInnerClassName;

    const dtMeta = getDtMeta(interaction);
    const isInteractionMode = Boolean(dtMeta);
    const isModifyMode = dtMeta?.dtType === 'modifyDie';
    const isSelectMode = dtMeta?.dtType === 'selectDie';
    const dieModifyConfig = isModifyMode ? (dtMeta as DtDiceModifyMeta).dieModifyConfig : undefined;
    const diceOwnerId = dtMeta?.diceOwnerId;
    const isAnyMode = dieModifyConfig?.mode === 'any';
    const isAdjustMode = dieModifyConfig?.mode === 'adjust';
    const adjustRange = dieModifyConfig?.adjustRange ?? { min: -1, max: 1 };
    const canInteractWithDie = React.useCallback((die: Die): boolean => {
        if (!isInteractionMode) return true;
        if (!diceOwnerId) return true;
        return die.ownerId === undefined || die.ownerId === diceOwnerId;
    }, [diceOwnerId, isInteractionMode]);
    // 从 multistepInteraction.result 读取当前累积结果
    const modifyResult = (isModifyMode && multistepInteraction?.result) as DiceModifyResult | null | undefined;
    const selectResult = (isSelectMode && multistepInteraction?.result) as DiceSelectResult | null | undefined;
    const totalAdjustment = modifyResult?.totalAdjustment ?? 0;
    const canAdjustDown = isAdjustMode && totalAdjustment > adjustRange.min;
    const canAdjustUp = isAdjustMode && totalAdjustment < adjustRange.max;

    const isSelected = React.useCallback((dieId: number): boolean => {
        if (isSelectMode) return selectResult?.selectedDiceIds.includes(dieId) ?? false;
        if (isModifyMode) return dieId in (modifyResult?.modifications ?? {});
        return false;
    }, [isModifyMode, isSelectMode, modifyResult?.modifications, selectResult?.selectedDiceIds]);
    const [boardInteractionArmed, setBoardInteractionArmed] = React.useState(!isBoardPresentation);
    const boardInteractionArmTimeoutRef = React.useRef<ReturnType<typeof window.setTimeout> | null>(null);

    React.useEffect(() => {
        if (!isBoardPresentation) {
            setBoardInteractionArmed(true);
            return;
        }

        if (boardInteractionArmTimeoutRef.current) {
            window.clearTimeout(boardInteractionArmTimeoutRef.current);
            boardInteractionArmTimeoutRef.current = null;
        }

        setBoardInteractionArmed(false);
        boardInteractionArmTimeoutRef.current = window.setTimeout(() => {
            boardInteractionArmTimeoutRef.current = null;
            setBoardInteractionArmed(true);
        }, BOARD_DICE_INTERACTION_ARM_DELAY_MS);

        return () => {
            if (boardInteractionArmTimeoutRef.current) {
                window.clearTimeout(boardInteractionArmTimeoutRef.current);
                boardInteractionArmTimeoutRef.current = null;
            }
        };
    }, [interaction?.id, isBoardPresentation]);

    const shouldAcceptBoardInteraction = React.useCallback((): boolean => {
        return !isBoardPresentation || boardInteractionArmed;
    }, [boardInteractionArmed, isBoardPresentation]);

    const maxSelectCount = dtMeta?.selectCount ?? 1;
    const currentSelectCount = isSelectMode
        ? (selectResult?.selectedDiceIds.length ?? 0)
        : (modifyResult?.modCount ?? 0);
    const canSelectMore = currentSelectCount < maxSelectCount;
    const canToggleDieLock = canInteract && rollCount > 0;
    const [centerDiceLayout, setCenterDiceLayout] = React.useState<Record<number, ProjectedDiceLayout>>({});
    const [diceBoxDieSkins, setDiceBoxDieSkins] = React.useState<Array<DiceThroneDiceBoxSkin | null>>([]);
    const [diceBoxDieSkinsReady, setDiceBoxDieSkinsReady] = React.useState(false);
    const fieldDice = React.useMemo(
        () => dice.map((die) => ({
            id: die.id,
            value: die.value,
            definitionId: die.definitionId,
        })),
        [dice],
    );
    const visibleOverlayDice = React.useMemo(
        () => dice,
        [dice],
    );
    const visiblePhysicsDice = React.useMemo(
        () => visibleOverlayDice.map((die) => ({
            id: die.id,
            value: die.value,
            isKept: die.isKept,
        })),
        [visibleOverlayDice],
    );
    const visibleDiceSkinKey = React.useMemo(
        () => visibleOverlayDice.map((die) => die.definitionId ?? '').join('|'),
        [visibleOverlayDice],
    );
    React.useEffect(() => {
        if (!isBoardPresentation || visibleOverlayDice.length === 0) {
            setDiceBoxDieSkins([]);
            setDiceBoxDieSkinsReady(!isBoardPresentation || visibleOverlayDice.length === 0);
            return;
        }

        let cancelled = false;
        setDiceBoxDieSkinsReady(false);
        const skinDefinitions = visibleOverlayDice.map((die) => ({
            definitionId: die.definitionId,
        }));
        void loadDiceThroneDiceBoxSkins(skinDefinitions, locale ?? 'zh-CN').then((skins) => {
            if (!cancelled) {
                setDiceBoxDieSkins(skins);
                setDiceBoxDieSkinsReady(skins.length >= visibleOverlayDice.length && skins.every(Boolean));
            }
        }).catch(() => {
            if (!cancelled) {
                setDiceBoxDieSkins([]);
                setDiceBoxDieSkinsReady(false);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [isBoardPresentation, locale, visibleDiceSkinKey, visibleOverlayDice]);
    const selectedDieIdsKey = isSelectMode
        ? (selectResult?.selectedDiceIds ?? []).join('|')
        : isModifyMode
            ? Object.keys(modifyResult?.modifications ?? {}).join('|')
            : '';
    const selectedDieIds = React.useMemo(() => {
        if (!selectedDieIdsKey) return [];
        return selectedDieIdsKey.split('|').map((dieId) => Number(dieId));
    }, [selectedDieIdsKey]);
    const handleProjectedDiceUpdate = React.useCallback((layouts: ProjectedDiceLayout[]) => {
        setCenterDiceLayout((prev) => {
            const next: Record<number, ProjectedDiceLayout> = {};
            let changed = layouts.length !== Object.keys(prev).length;
            for (const layout of layouts) {
                next[layout.id] = layout;
                const prevLayout = prev[layout.id];
                if (!prevLayout
                    || Math.abs(prevLayout.x - layout.x) > 1
                    || Math.abs(prevLayout.y - layout.y) > 1
                    || Math.abs(prevLayout.width - layout.width) > 1
                    || Math.abs(prevLayout.height - layout.height) > 1
                    || Math.abs(prevLayout.rotateX - layout.rotateX) > 0.02
                    || Math.abs(prevLayout.rotateY - layout.rotateY) > 0.02
                    || Math.abs(prevLayout.rotateZ - layout.rotateZ) > 0.02
                    || prevLayout.selected !== layout.selected
                    || Math.abs(prevLayout.minY - layout.minY) > 1
                    || Math.abs(prevLayout.maxY - layout.maxY) > 1) {
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, []);
    const handleDicePhysicsStatesChange = React.useCallback((states: DicePhysicsState[]) => {
        handleProjectedDiceUpdate(states.map((state) => ({
            ...state.layout,
            selected: selectedDieIds.includes(state.id),
            rotateX: state.motion.rotateX,
            rotateY: state.motion.rotateY,
            rotateZ: state.motion.rotateZ,
        })));
    }, [handleProjectedDiceUpdate, selectedDieIds]);
    const handleRailDieClick = (dieId: number) => {
        // 掷骰结果已进入权威状态后，允许玩家立刻锁骰，
        // 不要让本地最短动画窗口吞掉真实点击。
        if (isRolling && !isInteractionMode && rollCount === 0) return;

        if (isInteractionMode && !isAnyMode && multistepInteraction) {
            if (isSelectMode) {
                multistepInteraction.step({ action: 'toggle', dieId } as DiceSelectStep);
            } else if (isModifyMode) {
                const die = dice.find(d => d.id === dieId);
                if (!die) return;
                const alreadySelected = isSelected(dieId);
                if (alreadySelected) {
                    multistepInteraction.step({ action: 'select', dieId, dieValue: die.value } as DiceModifyStep);
                } else if (canSelectMore) {
                    multistepInteraction.step({ action: 'select', dieId, dieValue: die.value } as DiceModifyStep);
                }
            }
        } else if (canToggleDieLock) {
            onToggleLock(dieId);
        }
    };

    const handleOverlayDieClick = React.useCallback((dieId: number) => {
        if (!shouldAcceptBoardInteraction()) return;
        if (isRolling && !isInteractionMode && rollCount === 0) return;

        if (isInteractionMode && multistepInteraction) {
            if (isSelectMode) {
                multistepInteraction.step({ action: 'toggle', dieId } as DiceSelectStep);
            } else if (isModifyMode) {
                const die = dice.find(d => d.id === dieId);
                if (!die) return;
                if (isAnyMode) {
                    const currentPreview = modifyResult?.modifications[dieId] ?? die.value;
                    const nextValue = currentPreview >= 6 ? 1 : currentPreview + 1;
                    multistepInteraction.step({ action: 'setAny', dieId, newValue: nextValue } as DiceModifyStep);
                    return;
                }
                if (isAdjustMode) {
                    const currentPreview = modifyResult?.modifications[dieId] ?? die.value;
                    if (canAdjustUp && currentPreview < 6) {
                        multistepInteraction.step({ action: 'adjust', dieId, delta: 1, currentValue: die.value } as DiceModifyStep);
                    } else if (canAdjustDown && currentPreview > 1) {
                        multistepInteraction.step({ action: 'adjust', dieId, delta: -1, currentValue: die.value } as DiceModifyStep);
                    }
                    return;
                }
                const alreadySelected = isSelected(dieId);
                if (alreadySelected) {
                    multistepInteraction.step({ action: 'select', dieId, dieValue: die.value } as DiceModifyStep);
                } else if (canSelectMore) {
                    multistepInteraction.step({ action: 'select', dieId, dieValue: die.value } as DiceModifyStep);
                }
            }
        } else if (canToggleDieLock) {
            onToggleLock(dieId);
        }
    }, [
        canAdjustDown,
        canAdjustUp,
        canSelectMore,
        canToggleDieLock,
        dice,
        isAdjustMode,
        isAnyMode,
        isInteractionMode,
        isModifyMode,
        isRolling,
        isSelectMode,
        isSelected,
        modifyResult?.modifications,
        multistepInteraction,
        onToggleLock,
        rollCount,
        shouldAcceptBoardInteraction,
    ]);

    const handleAdjust = (dieId: number, delta: number, currentValue: number) => {
        if (!shouldAcceptBoardInteraction()) return;
        if (!multistepInteraction) return;

        if (isAdjustMode) {
            if (delta < 0 && !canAdjustDown) return;
            if (delta > 0 && !canAdjustUp) return;
            multistepInteraction.step({ action: 'adjust', dieId, delta, currentValue } as DiceModifyStep);
        } else if (isAnyMode) {
            // any 模式：直接设置新值（本地预览）
            const currentPreview = modifyResult?.modifications[dieId] ?? currentValue;
            const newValue = currentPreview + delta;
            if (newValue >= 1 && newValue <= 6) {
                multistepInteraction.step({ action: 'setAny', dieId, newValue } as DiceModifyStep);
            }
        }
    };

    if (!isOverlayPresentation) {
        return (
            <div
                className={`
                    ${resolvedContainerClassName}
                    border-t-[0.12vw] border-l-[0.1vw] border-b-[0.2vw] border-r-[0.12vw]
                    ${isInteractionMode
                        ? 'bg-slate-950 border-transparent ring-[0.2vw] ring-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.3)]'
                        : isPassiveRerollMode
                            ? 'bg-slate-950 border-transparent ring-[0.2vw] ring-emerald-500 shadow-[0_0_30px_rgba(52,211,153,0.3)]'
                            : 'bg-gradient-to-b from-[#1a1e36] via-[#0d0e1a] to-[#05060a] border-indigo-300/30 border-black/80 shadow-[inset_0_5px_12px_rgba(0,0,0,0.9),0_15px_30px_rgba(0,0,0,0.4)]'}
                `}
                data-tutorial-id="dice-tray"
            >
                <div className={glossClassName} />
                <div className={`${rimClassName} ${isInteractionMode ? 'border-amber-400/20' : 'border-t-white/20 border-l-white/10 border-transparent'} `} />
                <div className={shadowClassName} />

                <div className={trayInnerClassName}>
                    {dice.map((d, i) => {
                        const selected = isSelected(d.id);
                        const isModified = isModifyMode && d.id in (modifyResult?.modifications ?? {});
                        const canModifyDie = canInteractWithDie(d);
                        const showAdjustButtons = isInteractionMode && isAdjustMode && canModifyDie;
                        const showAnyModeButtons = isInteractionMode && isAnyMode && canModifyDie
                            && (isModified || currentSelectCount < maxSelectCount);
                        const isInactiveDie = isInteractionMode && !canModifyDie;
                        const clickable = isInteractionMode
                            ? (isAnyMode ? false : (!isInactiveDie && (canSelectMore || selected)))
                            : canToggleDieLock;
                        const isReadOnlyDisplayDie = !isInteractionMode && Boolean(d.displayOnly);
                        const displayValue = (isAnyMode || isAdjustMode)
                            ? (modifyResult?.modifications[d.id] ?? d.value)
                            : d.value;

                        return (
                            <div key={d.id} className={`relative flex items-center ${rowGapClassName}`}>
                                {(showAdjustButtons || showAnyModeButtons) && (
                                    <button
                                        type="button"
                                        data-testid={`die-adjust-decrement-${d.id}`}
                                        aria-label={`${decreaseLabel} ${displayValue}`}
                                        onClick={() => handleAdjust(d.id, -1, d.value)}
                                        disabled={displayValue <= 1 || (showAdjustButtons && !canAdjustDown)}
                                        className={`${adjustButtonClassName} rounded-full flex items-center justify-center font-bold transition-all duration-150 ${(displayValue <= 1 || (showAdjustButtons && !canAdjustDown))
                                            ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                            : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg hover:scale-110'
                                            }`}
                                    >
                                        −
                                    </button>
                                )}

                                <div className={`relative flex flex-col items-center ${dieGapClassName}`} data-testid="die">
                                    <div
                                        onClick={() => clickable && handleRailDieClick(d.id)}
                                        data-testid={`die-button-${d.id}`}
                                        data-selected={selected ? 'true' : 'false'}
                                        data-clickable={clickable ? 'true' : 'false'}
                                        data-display-value={displayValue}
                                        data-owner-id={d.ownerId ?? ''}
                                        data-display-only={d.displayOnly ? 'true' : 'false'}
                                        className={`
                                            relative flex-shrink-0 group transition-all duration-200
                                            ${!isInteractionMode && d.isKept ? 'opacity-80' : ''}
                                            ${!clickable && !showAdjustButtons && !showAnyModeButtons ? (isReadOnlyDisplayDie ? 'cursor-default' : 'cursor-not-allowed opacity-50') : ''}
                                            ${clickable ? 'cursor-pointer hover:scale-110' : ''}
                                            ${selected ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900 rounded-full scale-105' : ''}
                                        `}
                                    >
                                        <div className="pointer-events-none">
                                            <Dice3D
                                                value={displayValue}
                                                isRolling={(isRolling && !d.isKept) || (rerollingDiceIds?.includes(d.id) ?? false)}
                                                index={i}
                                                size={diceSize}
                                                locale={locale}
                                                variant="default"
                                                characterId={resolveCharacterIdFromDiceDefinitionId(d.definitionId)}
                                                definitionId={d.definitionId}
                                            />
                                        </div>
                                        {!isInteractionMode && d.isKept && (
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                                <div className={`${lockedLabelClassName} font-black text-white bg-black/65 rounded uppercase tracking-wider shadow-sm border border-white/20`}>
                                                    {t('dice.locked')}
                                                </div>
                                            </div>
                                        )}
                                        {selected && !showAdjustButtons && !showAnyModeButtons && (
                                            <div className={`absolute ${selectedBadgeClassName} bg-amber-500 rounded-full flex items-center justify-center z-30`}>
                                                <Check size={12} className={`text-white ${selectedBadgeIconClassName}`} strokeWidth={3} />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {(showAdjustButtons || showAnyModeButtons) && (
                                    <button
                                        type="button"
                                        data-testid={`die-adjust-increment-${d.id}`}
                                        aria-label={`${increaseLabel} ${displayValue}`}
                                        onClick={() => handleAdjust(d.id, 1, d.value)}
                                        disabled={displayValue >= 6 || (showAdjustButtons && !canAdjustUp)}
                                        className={`${adjustButtonClassName} rounded-full flex items-center justify-center font-bold transition-all duration-150 ${(displayValue >= 6 || (showAdjustButtons && !canAdjustUp))
                                            ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                            : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg hover:scale-110'
                                            }`}
                                    >
                                        +
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className={resolvedContainerClassName}>
            <div className={resolvedTrayInnerClassName}>
                {!isBoardPresentation && (
                    <DiceField3D
                        dice={fieldDice}
                        selectedDieIds={selectedDieIds}
                        isRolling={isRolling}
                        rerollingDiceIds={rerollingDiceIds}
                        rerollAnimationSeq={rerollAnimationSeq}
                        locale={locale}
                        characterId={resolveCharacterIdFromDiceDefinitionId(dice[0]?.definitionId)}
                        slots={CENTER_DICE_SCATTER_SLOTS}
                        onDieClick={handleOverlayDieClick}
                        scenePreset="spotlight"
                        onProjectedDiceUpdate={handleProjectedDiceUpdate}
                    />
                )}
                {isBoardPresentation && (
                    <div className="pointer-events-none absolute inset-0" style={{ zIndex: BOARD_DICE_STAGE_Z_INDEX - 1 }} data-testid="dicethrone-board-dice-ring-layer">
                        {visibleOverlayDice.map((d, index) => {
                            const projectedLayout = centerDiceLayout[d.id];
                            const selected = isSelected(d.id);
                            const shouldShowLockedRing = !isInteractionMode && d.isKept;

                            if (!selected && !shouldShowLockedRing) return null;

                            const scatterSlot = BOARD_DICE_SCATTER_SLOTS[index % BOARD_DICE_SCATTER_SLOTS.length];
                            const ringSize = resolveBoardDiceRingSize(projectedLayout);
                            const ringZIndex = projectedLayout
                                ? Math.max(0, Math.round(projectedLayout.maxY))
                                : scatterSlot.zIndex;

                            return (
                                <div
                                    key={d.id}
                                    className="pointer-events-none absolute rounded-full"
                                    style={{
                                        left: projectedLayout ? `${projectedLayout.x}px` : scatterSlot.left,
                                        top: projectedLayout ? `${projectedLayout.y}px` : scatterSlot.top,
                                        width: `${ringSize}px`,
                                        height: `${ringSize}px`,
                                        transform: 'translate(-50%, -50%)',
                                        zIndex: ringZIndex,
                                    }}
                                >
                                    {selected && (
                                        <div
                                            className="absolute inset-0 rounded-full bg-amber-300/10 ring-[0.2rem] ring-amber-300 shadow-[0_0_1.35rem_rgba(245,158,11,0.72)]"
                                            data-testid={`die-selected-ring-${d.id}`}
                                        />
                                    )}
                                    {shouldShowLockedRing && (
                                        <div
                                            className="absolute inset-0 rounded-full bg-black/10 ring-[0.28rem] ring-black/85 shadow-[0_0_1.15rem_rgba(0,0,0,0.78)]"
                                            data-testid={`die-locked-ring-${d.id}`}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
                {isBoardPresentation && (
                    <DiceBoxPhysicsSource
                        dice={visiblePhysicsDice}
                        isRolling={isRolling}
                        rerollingDiceIds={rerollingDiceIds}
                        rerollAnimationSeq={rerollAnimationSeq}
                        styleProfile={diceBoxStyleProfile}
                        dieSkins={diceBoxDieSkins}
                        requireDieSkins={true}
                        rendererMode="debug-visible"
                        canvasTestId="dicethrone-board-dice-box-canvas"
                        className="pointer-events-none absolute inset-0 h-full w-full"
                        style={{ zIndex: BOARD_DICE_STAGE_Z_INDEX }}
                        dataAttributes={{
                            'data-dicethrone-dice-skins-ready': diceBoxDieSkinsReady ? 'true' : 'false',
                            'data-dice-layout-profile': diceBoxStyleProfile.id ?? '',
                        }}
                        onPhysicsStatesChange={handleDicePhysicsStatesChange}
                        testId="dicethrone-board-dice-physics-source"
                    />
                )}
                {isBoardPresentation && (
                    <div
                        className="pointer-events-none absolute inset-0"
                        style={{ zIndex: BOARD_DICE_STAGE_Z_INDEX + 1 }}
                        data-testid="dicethrone-board-dice-hit-layer"
                    />
                )}
                {visibleOverlayDice.map((d, i) => {
                    const selected = isSelected(d.id);
                    const isModified = isModifyMode && d.id in (modifyResult?.modifications ?? {});
                    const canModifyDie = canInteractWithDie(d);
                    const showOverlayAdjustButtons = isInteractionMode && isAdjustMode && canModifyDie;
                    const showOverlayAnyModeButtons = isInteractionMode && isAnyMode && canModifyDie
                        && (isModified || currentSelectCount < maxSelectCount);
                    const isInactiveDie = isInteractionMode && !canModifyDie;
                    const clickable = isInteractionMode
                        ? ((isAnyMode || isAdjustMode)
                            ? !isInactiveDie && (canSelectMore || selected || isModified)
                            : (!isInactiveDie && (canSelectMore || selected)))
                        : canToggleDieLock;
                    // any/adjust 模式下使用本地预览值
                    const displayValue = (isAnyMode || isAdjustMode)
                        ? (modifyResult?.modifications[d.id] ?? d.value)
                        : d.value;
                    const scatterSlots = isBoardPresentation ? BOARD_DICE_SCATTER_SLOTS : CENTER_DICE_SCATTER_SLOTS;
                    const scatterSlot = scatterSlots[i % scatterSlots.length];
                    const projectedLayout = centerDiceLayout[d.id];
                    const boardOverlayDiceSizePx = isBoardPresentation
                        ? resolveBoardOverlayDiceSize(projectedLayout)
                        : undefined;
                    const boardDiceHitTargetSizePx = isMobileBoardPresentation
                        ? BOARD_DICE_MOBILE_HIT_TARGET_SIZE_PX
                        : BOARD_DICE_HIT_TARGET_SIZE_PX;
                    const boardDiceOperationSizePx = isBoardPresentation
                        ? (showOverlayAdjustButtons || showOverlayAnyModeButtons ? 128 : 70)
                        : boardDiceHitTargetSizePx;
                    const boardDiceStageSize = isBoardPresentation
                        ? resolveBoardDiceStageSize(isMobileBoardPresentation)
                        : null;
                    const centerX = projectedLayout && isBoardPresentation
                        ? clampBoardOverlayCenter(projectedLayout.x, boardDiceOperationSizePx, boardDiceStageSize?.width ?? 0)
                        : projectedLayout?.x ?? 0;
                    const centerY = projectedLayout && isBoardPresentation
                        ? clampBoardOverlayCenter(
                            projectedLayout.y,
                            boardDiceOperationSizePx,
                            boardDiceStageSize?.height ?? 0,
                        )
                        : projectedLayout?.y ?? 0;
                    const projectedScale = isBoardPresentation ? 0.92 : 0.78;
                    const centerWidth = projectedLayout ? Math.max(60, projectedLayout.width * projectedScale) : 88;
                    const centerHeight = projectedLayout ? Math.max(60, projectedLayout.height * projectedScale) : 88;
                    const overlayDiceSize = isBoardPresentation
                        ? `${boardOverlayDiceSizePx}px`
                        : projectedLayout
                            ? `${Math.round(Math.max(centerWidth, centerHeight))}px`
                            : resolvedDiceSize;
                    const overlayTransform = projectedLayout
                        ? `rotateX(${projectedLayout.rotateX}rad) rotateY(${projectedLayout.rotateY}rad) rotateZ(${projectedLayout.rotateZ}rad)`
                        : undefined;
                    const overlayWidth = isBoardPresentation
                        ? `${boardDiceOperationSizePx}px`
                        : projectedLayout
                            ? `${centerWidth}px`
                            : resolvedDiceSize;
                    const overlayHeight = isBoardPresentation
                        ? `${boardDiceOperationSizePx}px`
                        : projectedLayout
                            ? `${centerHeight}px`
                            : resolvedDiceSize;
                    const overlayZIndex = projectedLayout && isBoardPresentation
                        ? 20 + Math.round(projectedLayout.maxY)
                        : (scatterSlot.zIndex ?? 1) + 20;
                    const boardOperationZIndex = isBoardPresentation && (showOverlayAdjustButtons || showOverlayAnyModeButtons)
                        ? overlayZIndex + 1000
                        : overlayZIndex;

                    if (isOverlayPresentation) {
                        return (
                            <div
                                key={d.id}
                                onClick={(event) => {
                                    if (isBoardPresentation) {
                                        event.stopPropagation();
                                    }
                                    if (clickable) {
                                        handleOverlayDieClick(d.id);
                                    }
                                }}
                                data-testid={`die-button-${d.id}`}
                                data-selected={selected ? 'true' : 'false'}
                                data-clickable={clickable ? 'true' : 'false'}
                                data-display-value={displayValue}
                                data-owner-id={d.ownerId ?? ''}
                                data-display-only={d.displayOnly ? 'true' : 'false'}
                                data-render-mode={isBoardPresentation ? 'engine' : 'overlay'}
                                data-board-dice-operation-anchor={isBoardPresentation ? 'true' : 'false'}
                                data-rotate-x={projectedLayout ? projectedLayout.rotateX.toFixed(4) : ''}
                                data-rotate-y={projectedLayout ? projectedLayout.rotateY.toFixed(4) : ''}
                                data-rotate-z={projectedLayout ? projectedLayout.rotateZ.toFixed(4) : ''}
                                data-projected-width={projectedLayout ? projectedLayout.width.toFixed(2) : ''}
                                data-projected-height={projectedLayout ? projectedLayout.height.toFixed(2) : ''}
                                data-projected-visual-width={projectedLayout?.visualWidth?.toFixed(2) ?? ''}
                                data-projected-visual-height={projectedLayout?.visualHeight?.toFixed(2) ?? ''}
                                className={clsx(
                                    'absolute rounded-full transition-[left,top,width,height,transform,filter] duration-75 ease-out',
                                    isBoardPresentation
                                        ? ((showOverlayAdjustButtons || showOverlayAnyModeButtons)
                                            ? 'pointer-events-none'
                                            : (clickable ? 'pointer-events-auto' : 'pointer-events-none'))
                                        : 'pointer-events-auto',
                                    clickable && !showOverlayAdjustButtons && !showOverlayAnyModeButtons ? 'cursor-pointer' : 'cursor-default',
                                )}
                                data-board-dice-interaction-armed={boardInteractionArmed ? 'true' : 'false'}
                                style={{
                                    left: projectedLayout ? `${centerX}px` : scatterSlot.left,
                                    top: projectedLayout ? `${centerY}px` : scatterSlot.top,
                                    zIndex: boardOperationZIndex,
                                    width: overlayWidth,
                                    height: overlayHeight,
                                    transform: 'translate(-50%, -50%)',
                                }}
                            >
                                {isBoardPresentation && isInteractionMode && (
                                    <div
                                        className={clsx(
                                            'absolute right-[14%] top-[14%] z-30 flex h-6 min-w-6 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full px-1.5',
                                            'border border-amber-200/95 bg-amber-300/95 text-[13px] font-black leading-none text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.72)]',
                                            clickable && boardInteractionArmed && !showOverlayAdjustButtons && !showOverlayAnyModeButtons
                                                ? 'pointer-events-auto cursor-pointer'
                                                : 'pointer-events-none',
                                            selected || isModified
                                                ? 'ring-2 ring-amber-100 bg-amber-200'
                                                : clickable
                                                    ? 'ring-1 ring-slate-950/20'
                                                    : 'opacity-45 grayscale',
                                        )}
                                        data-testid={`die-board-visible-value-${d.id}`}
                                        data-visible-die-value={displayValue}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            if (clickable) {
                                                handleOverlayDieClick(d.id);
                                            }
                                        }}
                                    >
                                        {displayValue}
                                    </div>
                                )}
                                {!isBoardPresentation && (
                                    <div className="pointer-events-none h-full w-full">
                                        <Dice3D
                                            value={displayValue}
                                            isRolling={(isRolling && !d.isKept) || (rerollingDiceIds?.includes(d.id) ?? false)}
                                            index={i}
                                            size={overlayDiceSize}
                                            locale={locale}
                                            variant="spotlight"
                                            characterId={resolveCharacterIdFromDiceDefinitionId(d.definitionId)}
                                            definitionId={d.definitionId}
                                            enableWebgl={false}
                                            overrideTransform={overlayTransform}
                                        />
                                    </div>
                                )}
                                {selected && !isBoardPresentation && (
                                    <div className="pointer-events-none absolute inset-[-0.28rem] rounded-full ring-2 ring-amber-300 shadow-[0_0_18px_rgba(245,158,11,0.55)]" data-testid={`die-selected-ring-${d.id}`} />
                                )}
                                {selected && isBoardPresentation && (
                                    <div
                                        className="pointer-events-none absolute inset-[-0.28rem] rounded-full ring-2 ring-amber-300 shadow-[0_0_18px_rgba(245,158,11,0.55)]"
                                        data-testid={`die-selected-operation-ring-${d.id}`}
                                    />
                                )}
                                {selected && !isBoardPresentation && !isCenterPresentation && !showOverlayAdjustButtons && !showOverlayAnyModeButtons && (
                                    <div className={`absolute ${selectedBadgeClassName} bg-amber-500 rounded-full flex items-center justify-center z-30`}>
                                        <Check size={12} className={`text-white ${selectedBadgeIconClassName}`} strokeWidth={3} />
                                    </div>
                                )}
                                {!isInteractionMode && d.isKept && !isBoardPresentation && (
                                    <div className="pointer-events-none absolute inset-[-0.42rem] rounded-full ring-[0.24rem] ring-black/80 shadow-[0_0_0.8rem_rgba(0,0,0,0.75)]" data-testid={`die-locked-ring-${d.id}`} />
                                )}
                                {!isInteractionMode && d.isKept && !isBoardPresentation && (
                                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                        <div className="min-w-max whitespace-nowrap rounded bg-black/75 px-2 py-0.5 text-[0.68rem] font-black uppercase tracking-wider text-white shadow-sm ring-1 ring-white/20">
                                            {t('dice.locked')}
                                        </div>
                                    </div>
                                )}
                                {(showOverlayAdjustButtons || showOverlayAnyModeButtons) && (
                                    isBoardPresentation ? (
                                        <div
                                            className="absolute inset-x-0 bottom-1 z-40 flex items-center justify-between px-1"
                                            data-testid={`die-board-adjust-controls-${d.id}`}
                                        >
                                            <button
                                                type="button"
                                                data-testid={`die-adjust-decrement-${d.id}`}
                                                aria-label={`${decreaseLabel} ${displayValue}`}
                                                className={BOARD_DICE_OPERATION_BUTTON_CLASS_NAME}
                                                disabled={displayValue <= 1 || (showOverlayAdjustButtons && !canAdjustDown)}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    handleAdjust(d.id, -1, d.value);
                                                }}
                                            >
                                                −
                                            </button>
                                            <button
                                                type="button"
                                                data-testid={`die-adjust-increment-${d.id}`}
                                                aria-label={`${increaseLabel} ${displayValue}`}
                                                className={BOARD_DICE_OPERATION_BUTTON_CLASS_NAME}
                                                disabled={displayValue >= 6 || (showOverlayAdjustButtons && !canAdjustUp)}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    handleAdjust(d.id, 1, d.value);
                                                }}
                                            >
                                                +
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                        <button
                                            type="button"
                                            data-testid={`die-adjust-decrement-${d.id}`}
                                            aria-label={`${decreaseLabel} ${displayValue}`}
                                            className={`${OVERLAY_DICE_ADJUST_BUTTON_CLASS_NAME} -left-8`}
                                            disabled={displayValue <= 1 || (showOverlayAdjustButtons && !canAdjustDown)}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                handleAdjust(d.id, -1, d.value);
                                            }}
                                        >
                                            −
                                        </button>
                                        <button
                                            type="button"
                                            data-testid={`die-adjust-increment-${d.id}`}
                                            aria-label={`${increaseLabel} ${displayValue}`}
                                            className={`${OVERLAY_DICE_ADJUST_BUTTON_CLASS_NAME} -right-8`}
                                            disabled={displayValue >= 6 || (showOverlayAdjustButtons && !canAdjustUp)}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                handleAdjust(d.id, 1, d.value);
                                            }}
                                        >
                                            +
                                        </button>
                                        </>
                                    )
                                )}
                            </div>
                        );
                    }
                })}
                {isBoardPresentation && visibleOverlayDice.map((d, index) => {
                    const projectedLayout = centerDiceLayout[d.id];
                    if (isInteractionMode || !d.isKept) return null;

                    const scatterSlot = BOARD_DICE_SCATTER_SLOTS[index % BOARD_DICE_SCATTER_SLOTS.length];

                    return (
                        <div
                            key={`locked-label-${d.id}`}
                            className="pointer-events-none absolute flex items-center justify-center"
                            style={{
                                left: projectedLayout ? `${projectedLayout.x}px` : scatterSlot.left,
                                top: projectedLayout ? `${projectedLayout.y}px` : scatterSlot.top,
                                width: `${BOARD_DICE_HIT_TARGET_SIZE_PX}px`,
                                height: `${BOARD_DICE_HIT_TARGET_SIZE_PX}px`,
                                transform: 'translate(-50%, -50%)',
                                zIndex: BOARD_DICE_LOCK_LABEL_Z_INDEX,
                            }}
                            data-testid={`die-locked-label-layer-${d.id}`}
                        >
                            <div
                                className="min-w-max whitespace-nowrap rounded bg-black/75 px-2 py-0.5 text-[0.68rem] font-black uppercase tracking-wider text-white shadow-sm ring-1 ring-white/20"
                                data-testid={`die-locked-label-${d.id}`}
                            >
                                {t('dice.locked')}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ============================================================================
// DiceActions 组件
// ============================================================================

export const DiceActions = ({
    rollCount,
    rollLimit,
    rollConfirmed,
    onRoll,
    onConfirm,
    currentPhase,
    canInteract,
    isRolling,
    setIsRolling,
    interaction,
    multistepInteraction,
    presentation = 'rail',
}: {
    rollCount: number;
    rollLimit: number;
    rollConfirmed: boolean;
    onRoll: () => void;
    onConfirm: () => void;
    currentPhase: TurnPhase;
    canInteract: boolean;
    isRolling: boolean;
    setIsRolling: (isRolling: boolean) => void;
    /** 当前骰子交互描述符（从 sys.interaction.current 读取） */
    interaction?: InteractionDescriptor;
    /** useMultistepInteraction 返回的状态和操作 */
    multistepInteraction?: MultistepInteractionState<DiceModifyResult | DiceSelectResult>;
    /** rail 用于右侧栏，center 用于中场舞台 */
    presentation?: 'rail' | 'center';
}) => {
    const { t } = useTranslation('game-dicethrone');
    const isCenterPresentation = presentation === 'center';
    const actionTokens = isCenterPresentation ? CENTER_DICE_ACTION_TOKENS : DESKTOP_DICE_ACTION_TOKENS;
    const isRollPhase = currentPhase === 'offensiveRoll' || currentPhase === 'targetingRoll' || currentPhase === 'defensiveRoll';
    const dtMeta = getDtMeta(interaction);
    const isInteractionMode = Boolean(dtMeta);

    // 骰子动画最短播放时间保护
    // 乐观更新会瞬间产生新 rollCount，但骰子翻滚动画需要一定时间。
    // 记录 setIsRolling(true) 的时刻，rollCount 变化时检查是否已过最短时间。
    const MIN_ROLL_ANIMATION_MS = 800;
    const rollStartTimeRef = useRef<number>(0);

    // 监听 rollCount 变化停止动画
    const rollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevRollCountRef = useRef(rollCount);

    useEffect(() => {
        if (rollCount !== prevRollCountRef.current) {
            prevRollCountRef.current = rollCount;
            if (isRolling) {
                // 清理之前的安全超时
                if (rollTimeoutRef.current) {
                    clearTimeout(rollTimeoutRef.current);
                    rollTimeoutRef.current = null;
                }
                // 检查动画是否已播放足够时间
                const elapsed = Date.now() - rollStartTimeRef.current;
                const remaining = MIN_ROLL_ANIMATION_MS - elapsed;
                if (remaining <= 0) {
                    // 已过最短时间，立即停止
                    setIsRolling(false);
                } else {
                    // 延迟停止，让动画播放完
                    rollTimeoutRef.current = setTimeout(() => {
                        rollTimeoutRef.current = null;
                        setIsRolling(false);
                    }, remaining);
                }
            }
        }
    }, [rollCount, isRolling, setIsRolling]);

    // 清理定时器
    useEffect(() => {
        return () => {
            if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
        };
    }, []);

    const handleRollClick = () => {
        if (isInteractionMode) {
            multistepInteraction?.cancel();
            return;
        }
        if (!isRollPhase || !canInteract || rollConfirmed || rollCount >= rollLimit) return;
        setIsRolling(true);
        rollStartTimeRef.current = Date.now();
        onRoll();
        // 安全超时：防止服务器长时间无响应时骰子一直转
        if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
        rollTimeoutRef.current = setTimeout(() => {
            rollTimeoutRef.current = null;
            setIsRolling(false);
        }, 5000);
    };

    const handleConfirmClick = () => {
        if (isInteractionMode && multistepInteraction) {
            multistepInteraction.confirm();
            return;
        }
        onConfirm();
    };

    const renderRollDots = () => {
        const dots = [];
        for (let i = 0; i < rollLimit; i++) {
            const isUsed = i < rollCount;
            dots.push(
                <div
                    key={i}
                    className={`
                        ${actionTokens.dotClassName} rounded-full border border-black/30 shadow-sm transition-all duration-300 flex-shrink-0
                        ${isUsed ? 'bg-slate-900/60' : 'bg-white'}
                    `}
                />
            );
        }
        return (
            <div className={actionTokens.dotsContainerClassName}>
                {dots}
            </div>
        );
    };

    const leftDisabled = isInteractionMode
        ? false
        : (!isRollPhase || !canInteract || rollConfirmed || rollCount >= rollLimit);
    const leftVariant = isInteractionMode
        ? 'secondary' as const
        : (isRollPhase && canInteract && !rollConfirmed && rollCount < rollLimit ? 'primary' as const : 'secondary' as const);

    const rightDisabled = isInteractionMode
        ? !(multistepInteraction?.canConfirm ?? false)
        : (rollConfirmed || rollCount === 0 || !canInteract || isRolling);
    const rightVariant = isInteractionMode
        ? 'primary' as const
        : (rollConfirmed ? 'glass' as const : 'secondary' as const);

    const showSingleRollButton = isCenterPresentation && !isInteractionMode && rollCount === 0;
    const rollLabel = isCenterPresentation
        ? (isRolling
            ? t('dice.rolling')
            : rollCount > 0
                ? t('dice.reroll_action')
                : t('dice.roll_action'))
        : (isRolling ? t('dice.rolling') : t('dice.roll_action'));
    const rollIcon = isCenterPresentation
        ? (rollCount > 0
            ? <RotateCcw className="h-[1em] w-[1em] shrink-0" />
            : <Dices className="h-[1em] w-[1em] shrink-0" />)
        : undefined;

    return (
        <div className={actionTokens.containerClassName}>
            <GameButton
                onClick={handleRollClick}
                disabled={leftDisabled}
                variant={leftVariant}
                size="sm"
                icon={rollIcon}
                clickSoundKey={isInteractionMode ? undefined : null}
                className={clsx(
                    `!py-0 flex items-center ${isCenterPresentation ? 'justify-center' : 'justify-between'} h-full whitespace-nowrap overflow-hidden ${actionTokens.buttonClassName}`,
                    showSingleRollButton && (isCenterPresentation ? 'min-w-[8.5vw]' : 'col-span-2 w-full'),
                    !isInteractionMode && isRolling && 'animate-pulse'
                )}
                data-tutorial-id={isInteractionMode ? undefined : 'dice-roll-button'}
            >
                {isInteractionMode ? (
                    <span className={`flex-1 text-center font-black ${actionTokens.interactionTextClassName}`}>{t('common.cancel')}</span>
                ) : (
                    <>
                        <div className={`truncate ${isCenterPresentation ? '' : 'flex-1'} text-center font-black ${actionTokens.rollTextClassName}`}>
                            {rollLabel}
                        </div>
                        {!showSingleRollButton && !isRolling && renderRollDots()}
                    </>
                )}
            </GameButton>

            {!showSingleRollButton && (
                <GameButton
                    onClick={handleConfirmClick}
                    disabled={rightDisabled}
                    variant={rightVariant}
                    size="sm"
                    icon={<Check className="h-[1em] w-[1em] shrink-0" />}
                    clickSoundKey={isInteractionMode ? undefined : null}
                    className={clsx(
                        `flex items-center justify-center h-full whitespace-nowrap overflow-hidden font-black !py-0 ${actionTokens.buttonClassName} ${actionTokens.confirmTextClassName}`,
                        !isInteractionMode && rollConfirmed && '!text-white/60'
                    )}
                    data-tutorial-id={isInteractionMode ? undefined : 'dice-confirm-button'}
                >
                    {isInteractionMode
                        ? t('common.confirm')
                        : (rollConfirmed ? t('dice.confirmed') : t('dice.confirm'))}
                </GameButton>
            )}
        </div>
    );
};

export const CenterDiceStage = ({
    dice,
    rollCount,
    onToggleLock,
    currentPhase,
    canInteract,
    isRolling,
    rerollingDiceIds,
    rerollAnimationSeq,
    locale,
    interaction,
    multistepInteraction,
    isPassiveRerollMode,
}: {
    dice: Die[];
    rollCount: number;
    onToggleLock: (id: number) => void;
    currentPhase: TurnPhase;
    canInteract: boolean;
    isRolling: boolean;
    rerollingDiceIds?: number[];
    rerollAnimationSeq?: number;
    locale?: string;
    interaction?: InteractionDescriptor;
    multistepInteraction?: MultistepInteractionState<DiceModifyResult | DiceSelectResult>;
    isPassiveRerollMode?: boolean;
}) => {
    const dtMeta = getDtMeta(interaction);
    const isInteractionMode = Boolean(dtMeta);
    const shouldShowDice = rollCount > 0 || isRolling || isInteractionMode || isPassiveRerollMode;

    return (
        <div
            className="pointer-events-none absolute left-[24vw] right-[24vw] top-[5vh] bottom-[33vh] flex items-start justify-center max-[900px]:left-[16vw] max-[900px]:right-[18vw] max-[900px]:top-[-1vh] max-[900px]:bottom-[40vh]"
            style={{ zIndex: UI_Z_INDEX.overlay }}
        >
            <motion.div
                className="relative flex h-full w-full max-w-[760px] flex-col items-center justify-start"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                data-testid="dicethrone-center-dice-stage"
            >
                {shouldShowDice && (
                    <>
                        <div className="pointer-events-none absolute left-1/2 top-[52%] h-[clamp(96px,11vw,150px)] w-[clamp(330px,31vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/34 blur-2xl" />
                        <div className="pointer-events-none absolute left-1/2 top-[54%] h-[2px] w-[clamp(330px,32vw,520px)] -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-amber-300/55 to-transparent" />
                        <DiceTray
                            dice={dice}
                            rollCount={rollCount}
                            onToggleLock={onToggleLock}
                            currentPhase={currentPhase}
                            canInteract={canInteract}
                            isRolling={isRolling}
                            rerollingDiceIds={rerollingDiceIds}
                            rerollAnimationSeq={rerollAnimationSeq}
                            locale={locale}
                            interaction={interaction}
                            multistepInteraction={multistepInteraction}
                            isPassiveRerollMode={isPassiveRerollMode}
                            presentation="center"
                        />
                    </>
                )}
            </motion.div>
        </div>
    );
};

export const BoardDiceStage = ({
    dice,
    rollCount,
    onToggleLock,
    currentPhase,
    canInteract,
    isRolling,
    rerollingDiceIds,
    rerollAnimationSeq,
    locale,
    interaction,
    multistepInteraction,
    isPassiveRerollMode,
}: {
    dice: Die[];
    rollCount: number;
    onToggleLock: (id: number) => void;
    currentPhase: TurnPhase;
    canInteract: boolean;
    isRolling: boolean;
    rerollingDiceIds?: number[];
    rerollAnimationSeq?: number;
    locale?: string;
    interaction?: InteractionDescriptor;
    multistepInteraction?: MultistepInteractionState<DiceModifyResult | DiceSelectResult>;
    isPassiveRerollMode?: boolean;
}) => {
    const { t } = useTranslation('game-dicethrone');
    const dtMeta = getDtMeta(interaction);
    const isInteractionMode = Boolean(dtMeta);
    const isModifyMode = dtMeta?.dtType === 'modifyDie';
    const isSelectMode = dtMeta?.dtType === 'selectDie';
    const modifyResult = (isModifyMode && multistepInteraction?.result) as DiceModifyResult | null | undefined;
    const selectResult = (isSelectMode && multistepInteraction?.result) as DiceSelectResult | null | undefined;
    const interactionHint = React.useMemo(
        () => resolveDiceInteractionHint(t, dtMeta, modifyResult, selectResult),
        [dtMeta, modifyResult, selectResult, t],
    );
    const shouldShowDice = rollCount > 0 || isRolling || isInteractionMode || isPassiveRerollMode;

    if (!shouldShowDice) return null;

    const stage = (
        <div
            className="pointer-events-none fixed left-1/2 top-[114px] aspect-square w-[clamp(360px,31vw,500px)] max-[1023px]:top-[clamp(18px,5.2vh,24px)] max-[1023px]:h-[128px] max-[1023px]:w-[clamp(252px,29vw,282px)] max-[1023px]:aspect-auto"
            style={{
                transform: 'translateX(-50%)',
                zIndex: BOARD_DICE_STAGE_Z_INDEX,
            }}
            data-testid="dicethrone-board-dice-stage"
            data-board-magnify-ignore="true"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
        >
            {isInteractionMode && interactionHint && (
                <div
                    className="pointer-events-none fixed left-1/2 top-[82px] max-w-[min(560px,calc(100vw-32px))] -translate-x-1/2 rounded-full border border-amber-300/75 bg-slate-950/90 px-4 py-2 text-center text-[13px] font-black leading-none text-amber-100 shadow-[0_0_18px_rgba(245,158,11,0.45)] backdrop-blur-sm max-[1023px]:top-[clamp(50px,10vh,74px)] max-[1023px]:px-3 max-[1023px]:py-1.5 max-[1023px]:text-[12px]"
                    style={{ zIndex: BOARD_DICE_OPERATION_HINT_Z_INDEX }}
                    data-testid="dicethrone-board-dice-operation-hint"
                >
                    {interactionHint}
                </div>
            )}
            <DiceTray
                dice={dice}
                rollCount={rollCount}
                onToggleLock={onToggleLock}
                currentPhase={currentPhase}
                canInteract={canInteract}
                isRolling={isRolling}
                rerollingDiceIds={rerollingDiceIds}
                rerollAnimationSeq={rerollAnimationSeq}
                locale={locale}
                interaction={interaction}
                multistepInteraction={multistepInteraction}
                isPassiveRerollMode={isPassiveRerollMode}
                presentation="board"
            />
        </div>
    );

    if (typeof document === 'undefined') {
        return stage;
    }

    // 移动端棋盘外层会整体缩放；骰台必须脱离该 transform 上下文，
    // 否则 fixed 定位、可视尺寸和物理投掷范围都会被同步压缩。
    return createPortal(stage, document.getElementById('hud-root') ?? document.body);
};
