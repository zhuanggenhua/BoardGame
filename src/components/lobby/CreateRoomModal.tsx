/**
 * 创建房间配置弹窗
 *
 * 支持配置：
 * - 房间名称
 * - 游戏人数（从 manifest.playerOptions 读取）
 * - 房间保存时间（TTL）
 * - manifest 声明的 setupOptions（单选 / 多选）
 */

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import type { GameManifestEntry, GameSetupField, GameSetupSelectOption } from '../../games/manifest.types';
import { UI_Z_INDEX } from '../../core';
import { useHomeV2CompactLandscape } from '../../hooks/ui/useHomeV2CompactLandscape';
import type { AiDifficultyLevel, AiSeatController } from '../../engine/ai';
import {
    DEFAULT_AI_MINIMUM_ACTION_DELAY_MS,
    DEFAULT_LOCAL_AI_DIFFICULTY,
    isManualSetupSelectionEnabledForSeat,
    normalizeAiMinimumActionDelayMs,
    createDefaultLocalMatchPreferences,
    normalizeLocalMatchPreferences,
    type LocalMatchPreferences,
} from '../../engine/ai';
import {
    getDefaultSetupSelections,
    type GameSetupSelections,
} from '../../games/setupOptions';
import {
    applyCreateRoomSetupDefaultsForGame,
    resolveAllowedPlayerCountsForGame,
} from '../../games/roomSetupRegistry';
import {
    QIDAHEN_IN_MATCH_SCENARIO_VOTE_FIELD,
    QIDAHEN_PREGAME_CHOICE_FIELDS,
} from '../../games/qidahen/roomSetup';
import { SetupOptionsFields } from './SetupOptionsFields';
import { PasswordField } from '../common/PasswordField';
import { HomeV2PaperModalFrame } from '../common/overlays/HomeV2PaperModalFrame';
import {
    homeV2PaperCompactHintClassName,
    homeV2PaperCompactInputClassName,
    homeV2PaperCompactPrimaryButtonClassName,
    homeV2PaperCompactSecondaryButtonClassName,
    homeV2PaperCompactTextButtonClassName,
    homeV2PaperHintClassName,
    homeV2PaperInputClassName,
    homeV2PaperLabelClassName,
    homeV2PaperPrimaryButtonClassName,
    homeV2PaperSecondaryButtonClassName,
} from '../common/overlays/homeV2PaperModalTheme';

/** 保存时间选项（秒） */
const RETENTION_OPTIONS = [
    { value: 0, key: 'none' },
    { value: 86400, key: '1day' },
    { value: 259200, key: '3days' },
    { value: 604800, key: '7days' },
] as const;

const LOCAL_AI_DIFFICULTY_OPTIONS: AiDifficultyLevel[] = ['easy', 'normal', 'hard', 'expert'];
const AI_MINIMUM_ACTION_DELAY_OPTIONS_MS = [0, 1000, 2000, 3000] as const;

type CreateRoomVisualStyle = 'default' | 'home-v2';

export interface RoomConfig {
    roomName: string;
    numPlayers: number;
    ttlSeconds: number;
    password?: string;
    enableAi: boolean;
    minimumActionDelayMs: number;
    seatControllers: Record<string, AiSeatController>;
    setupSelections: GameSetupSelections;
}

interface CreateRoomModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (config: RoomConfig) => void;
    gameManifest: GameManifestEntry;
    initialPreferences?: LocalMatchPreferences | null;
    isLoading?: boolean;
    visualStyle?: CreateRoomVisualStyle;
}

const OWNER_PLAYER_ID = '0';

function getEnabledAiController(
    gameManifest: GameManifestEntry,
    difficulty: AiDifficultyLevel,
    manualFactionSelection: boolean,
    minimumActionDelayMs: number,
): AiSeatController {
    if (gameManifest.ai?.localAi) {
        return {
            type: 'local-ai',
            difficulty,
            minimumActionDelayMs,
            ...(manualFactionSelection
                ? {
                    manualSetupSelection: true,
                    manualFactionSelection: true,
                }
                : {}),
        };
    }
    if (gameManifest.ai?.remoteAi) {
        return {
            type: 'remote-ai',
            providerId: 'astrbot',
            minimumActionDelayMs,
            ...(manualFactionSelection
                ? {
                    manualSetupSelection: true,
                    manualFactionSelection: true,
                }
                : {}),
        };
    }
    return { type: 'human' };
}

function forceHumanOwnerSeat(seatControllers: Record<string, AiSeatController>): Record<string, AiSeatController> {
    return {
        ...seatControllers,
        [OWNER_PLAYER_ID]: { type: 'human' },
    };
}

function fillNonOwnerSeatsWithAi(args: {
    seatControllers: Record<string, AiSeatController>;
    numPlayers: number;
    gameManifest: GameManifestEntry;
    difficulty: AiDifficultyLevel;
    manualFactionSelection: boolean;
    minimumActionDelayMs: number;
    onlyMissingSeats?: boolean;
}): Record<string, AiSeatController> {
    const nextControllers = forceHumanOwnerSeat({ ...args.seatControllers });
    for (let index = 1; index < args.numPlayers; index += 1) {
        const playerId = String(index);
        const currentController = nextControllers[playerId];
        if (args.onlyMissingSeats && currentController) {
            continue;
        }
        nextControllers[playerId] = currentController?.type && currentController.type !== 'human'
            ? currentController
            : getEnabledAiController(
                args.gameManifest,
                args.difficulty,
                args.manualFactionSelection,
                args.minimumActionDelayMs,
            );
    }
    return nextControllers;
}

function countAiSeats(seatControllers: Record<string, AiSeatController>, numPlayers: number): number {
    let total = 0;
    for (let index = 0; index < numPlayers; index += 1) {
        const controller = seatControllers[String(index)];
        if (controller && controller.type !== 'human') {
            total += 1;
        }
    }
    return total;
}

function applyLocalAiDifficulty(
    seatControllers: Record<string, AiSeatController>,
    numPlayers: number,
    difficulty: AiDifficultyLevel,
): Record<string, AiSeatController> {
    const nextControllers = forceHumanOwnerSeat({ ...seatControllers });
    for (let index = 1; index < numPlayers; index += 1) {
        const playerId = String(index);
        const controller = nextControllers[playerId];
        if (controller?.type === 'local-ai') {
            nextControllers[playerId] = {
                ...controller,
                difficulty,
            };
        }
    }
    return nextControllers;
}

function applyManualFactionSelection(
    seatControllers: Record<string, AiSeatController>,
    numPlayers: number,
    enabled: boolean,
): Record<string, AiSeatController> {
    const nextControllers = forceHumanOwnerSeat({ ...seatControllers });
    for (let index = 1; index < numPlayers; index += 1) {
        const playerId = String(index);
        const controller = nextControllers[playerId];
        if (!controller || controller.type === 'human') {
            continue;
        }
        nextControllers[playerId] = enabled
            ? { ...controller, manualSetupSelection: true, manualFactionSelection: true }
            : (() => {
                const {
                    manualSetupSelection: _ignoredSetup,
                    manualFactionSelection: _ignoredFaction,
                    ...rest
                } = controller;
                return rest;
            })();
    }
    return nextControllers;
}

function applyAiMinimumActionDelay(
    seatControllers: Record<string, AiSeatController>,
    numPlayers: number,
    minimumActionDelayMs: number,
): Record<string, AiSeatController> {
    const nextControllers = forceHumanOwnerSeat({ ...seatControllers });
    const normalizedDelayMs = normalizeAiMinimumActionDelayMs(minimumActionDelayMs)
        ?? DEFAULT_AI_MINIMUM_ACTION_DELAY_MS;
    for (let index = 1; index < numPlayers; index += 1) {
        const playerId = String(index);
        const controller = nextControllers[playerId];
        if (!controller || controller.type === 'human') {
            continue;
        }
        nextControllers[playerId] = {
            ...controller,
            minimumActionDelayMs: normalizedDelayMs,
        };
    }
    return nextControllers;
}

function formatAiThinkingDelayLabel(seconds: number): string {
    return `${seconds}`;
}

export const resolveSetupFieldOptions = (
    field: GameSetupField,
    numPlayers: number,
): GameSetupSelectOption[] => {
    if (field.type !== 'select') {
        return [];
    }
    return field.optionsByPlayerCount?.[numPlayers] ?? field.options ?? [];
};

export const normalizeSetupValuesForFields = (
    setupFields: ReadonlyArray<readonly [string, GameSetupField]>,
    numPlayers: number,
    currentValues: Record<string, string> = {},
): Record<string, string> => {
    const normalized: Record<string, string> = {};
    for (const [key, field] of setupFields) {
        if (field.type !== 'select') {
            continue;
        }
        const options = resolveSetupFieldOptions(field, numPlayers);
        const currentValue = currentValues[key];
        const fallbackValue = (
            field.default && options.some((option) => option.value === field.default)
                ? field.default
                : options[0]?.value
        ) ?? '';
        const nextValue = typeof currentValue === 'string' && options.some((option) => option.value === currentValue)
            ? currentValue
            : fallbackValue;
        normalized[key] = nextValue;
    }
    return normalized;
};

const isSameSetupValues = (
    left: Record<string, string>,
    right: Record<string, string>,
) => {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
        return false;
    }
    return leftKeys.every((key) => left[key] === right[key]);
};

const isSameSetupSelections = (
    left: GameSetupSelections,
    right: GameSetupSelections,
) => {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
        return false;
    }
    return leftKeys.every((key) => Object.is(left[key], right[key]));
};

const toSelectValueRecord = (selections: GameSetupSelections): Record<string, string> => {
    const selectValues: Record<string, string> = {};
    for (const [key, value] of Object.entries(selections)) {
        if (typeof value === 'string') {
            selectValues[key] = value;
        }
    }
    return selectValues;
};

const normalizeExtendedSetupSelections = (
    selections: GameSetupSelections,
    isQidahenRoom: boolean,
): GameSetupSelections => (
    isQidahenRoom
        ? {
            ...Object.fromEntries(
                Object.entries(selections).filter(([key]) => (
                    key !== 'scenario'
                    && !QIDAHEN_PREGAME_CHOICE_FIELDS.some((field) => field.key === key)
                )),
            ),
            [QIDAHEN_IN_MATCH_SCENARIO_VOTE_FIELD]: 'enabled',
        }
        : selections
);

const normalizeCreateRoomSetupSelections = (args: {
    gameManifest: GameManifestEntry;
    setupFields: ReadonlyArray<readonly [string, GameSetupField]>;
    numPlayers: number;
    setupSelections: GameSetupSelections;
    isQidahenRoom: boolean;
}): GameSetupSelections => {
    const setupWithDefaults = applyCreateRoomSetupDefaultsForGame({
        gameManifest: args.gameManifest,
        numPlayers: args.numPlayers,
        setupSelections: args.setupSelections,
    });
    return normalizeExtendedSetupSelections({
        ...setupWithDefaults,
        ...normalizeSetupValuesForFields(
            args.setupFields,
            args.numPlayers,
            toSelectValueRecord(setupWithDefaults),
        ),
    }, args.isQidahenRoom);
};

export const CreateRoomModal = ({
    isOpen,
    onClose,
    onConfirm,
    gameManifest,
    initialPreferences,
    isLoading = false,
    visualStyle = 'default',
}: CreateRoomModalProps) => {
    const gameNamespace = `game-${gameManifest.id}`;
    const { t } = useTranslation(['lobby', gameNamespace]);
    const setupFields = useMemo(
        () => Object.entries(gameManifest.setupOptions ?? {}),
        [gameManifest.setupOptions],
    );
    const isQidahenRoom = gameManifest.id === 'qidahen';
    const rawDefaultSetupSelections = useMemo(
        () => getDefaultSetupSelections(gameManifest),
        [gameManifest],
    );
    const playerOptions = useMemo(
        () => resolveAllowedPlayerCountsForGame({
            gameManifest,
            setupData: rawDefaultSetupSelections,
        }),
        [gameManifest, rawDefaultSetupSelections],
    );
    const defaultNumPlayers = useMemo(() => (
        gameManifest.bestPlayers?.find((count) => playerOptions.includes(count))
        ?? playerOptions[0]
    ), [gameManifest.bestPlayers, playerOptions]);
    const defaultSetupSelections = useMemo(() => normalizeCreateRoomSetupSelections({
        gameManifest,
        setupFields,
        numPlayers: defaultNumPlayers,
        setupSelections: rawDefaultSetupSelections,
        isQidahenRoom,
    }), [defaultNumPlayers, gameManifest, isQidahenRoom, rawDefaultSetupSelections, setupFields]);
    const isCompactLandscape = useHomeV2CompactLandscape();
    const isHomeV2Style = visualStyle === 'home-v2';
    const isCompactHomeV2Layout = isHomeV2Style && isCompactLandscape;
    const fieldLabelClassName = isCompactHomeV2Layout ? 'mb-[3px] block text-[7.2px] font-semibold tracking-[0.04em] text-[#3f2616]' : homeV2PaperLabelClassName;
    const fieldHintClassName = isCompactHomeV2Layout ? homeV2PaperCompactHintClassName : homeV2PaperHintClassName;
    const inputClassName = isCompactHomeV2Layout ? homeV2PaperCompactInputClassName : homeV2PaperInputClassName;
    const primaryButtonClassName = isCompactHomeV2Layout ? homeV2PaperCompactPrimaryButtonClassName : homeV2PaperPrimaryButtonClassName;
    const secondaryButtonClassName = isCompactHomeV2Layout ? homeV2PaperCompactSecondaryButtonClassName : homeV2PaperSecondaryButtonClassName;

    const [roomName, setRoomName] = useState('');
    const [numPlayers, setNumPlayers] = useState(defaultNumPlayers);
    const [ttlSeconds, setTtlSeconds] = useState(0);
    const [password, setPassword] = useState('');
    const [enableAi, setEnableAi] = useState(false);
    const [aiDifficulty, setAiDifficulty] = useState<AiDifficultyLevel>(DEFAULT_LOCAL_AI_DIFFICULTY);
    const [aiMinimumActionDelayMs, setAiMinimumActionDelayMs] = useState(DEFAULT_AI_MINIMUM_ACTION_DELAY_MS);
    const [manualFactionSelection, setManualFactionSelection] = useState(false);
    const [seatControllers, setSeatControllers] = useState<Record<string, AiSeatController>>({});
    const [setupSelections, setSetupSelections] = useState<GameSetupSelections>(() => defaultSetupSelections);

    const currentPlayerOptions = useMemo(
        () => resolveAllowedPlayerCountsForGame({
            gameManifest,
            setupData: setupSelections,
        }),
        [gameManifest, setupSelections],
    );
    const hasPlayerOptions = currentPlayerOptions.length > 1;

    useEffect(() => {
        if (!isOpen) return;
        const nextPreferences = initialPreferences
            ? normalizeLocalMatchPreferences(
                gameManifest,
                initialPreferences as unknown as Record<string, unknown>,
            )
            : {
                ...createDefaultLocalMatchPreferences(gameManifest),
                numPlayers: defaultNumPlayers,
            };
        const nextSeatControllers = initialPreferences
            ? forceHumanOwnerSeat({ ...nextPreferences.seatControllers })
            : forceHumanOwnerSeat(
                Object.fromEntries(
                    Array.from({ length: nextPreferences.numPlayers }, (_, index) => [String(index), { type: 'human' } as AiSeatController]),
                ),
            );
        const inferredDifficulty = Object.values(nextSeatControllers).find(
            (controller): controller is Extract<AiSeatController, { type: 'local-ai' }> => (
                controller.type === 'local-ai' && typeof controller.difficulty === 'string'
            ),
        )?.difficulty ?? DEFAULT_LOCAL_AI_DIFFICULTY;
        const shouldManualFactionSelection = Object.values(nextSeatControllers).some(
            (controller) => isManualSetupSelectionEnabledForSeat(controller),
        );
        const nextMinimumActionDelayMs = normalizeAiMinimumActionDelayMs(nextPreferences.minimumActionDelayMs)
            ?? DEFAULT_AI_MINIMUM_ACTION_DELAY_MS;
        const shouldEnableAi = initialPreferences
            ? countAiSeats(nextSeatControllers, nextPreferences.numPlayers) > 0
            : false;
        const resolvedSeatControllers = shouldEnableAi
            ? fillNonOwnerSeatsWithAi({
                seatControllers: nextSeatControllers,
                numPlayers: nextPreferences.numPlayers,
                gameManifest,
                difficulty: inferredDifficulty,
                manualFactionSelection: shouldManualFactionSelection,
                minimumActionDelayMs: nextMinimumActionDelayMs,
            })
            : nextSeatControllers;

        setRoomName('');
        setNumPlayers(nextPreferences.numPlayers);
        setTtlSeconds(0);
        setPassword('');
        setEnableAi(shouldEnableAi);
        setAiDifficulty(inferredDifficulty);
        setAiMinimumActionDelayMs(nextMinimumActionDelayMs);
        setManualFactionSelection(shouldManualFactionSelection);
        setSeatControllers(applyAiMinimumActionDelay(
            resolvedSeatControllers,
            nextPreferences.numPlayers,
            nextMinimumActionDelayMs,
        ));
        setSetupSelections(normalizeCreateRoomSetupSelections({
            gameManifest,
            setupFields,
            numPlayers: nextPreferences.numPlayers,
            setupSelections: nextPreferences.setupSelections,
            isQidahenRoom,
        }));
    }, [defaultNumPlayers, defaultSetupSelections, gameManifest, initialPreferences, isOpen, isQidahenRoom, setupFields]);

    useEffect(() => {
        const fallbackPlayerCount = currentPlayerOptions[0];
        if (fallbackPlayerCount == null) {
            return;
        }
        setNumPlayers((current) => (
            currentPlayerOptions.includes(current)
                ? current
                : fallbackPlayerCount
        ));
    }, [currentPlayerOptions]);

    useEffect(() => {
        setSetupSelections((current) => {
            const currentSelectValues = toSelectValueRecord(current);
            const normalizedSelectValues = normalizeSetupValuesForFields(
                setupFields,
                numPlayers,
                currentSelectValues,
            );
            const nextSelections = normalizeExtendedSetupSelections({
                ...current,
                ...normalizedSelectValues,
            }, isQidahenRoom);
            if (
                isSameSetupValues(currentSelectValues, normalizedSelectValues)
                && isSameSetupSelections(current, nextSelections)
            ) {
                return current;
            }
            return nextSelections;
        });
    }, [isQidahenRoom, numPlayers, setupFields]);

    useEffect(() => {
        setSeatControllers((current) => {
            const normalized = normalizeLocalMatchPreferences(gameManifest, {
                numPlayers,
                seatControllers: current,
                minimumActionDelayMs: aiMinimumActionDelayMs,
                setupSelections,
            }).seatControllers;
            return applyAiMinimumActionDelay(
                forceHumanOwnerSeat(normalized),
                numPlayers,
                aiMinimumActionDelayMs,
            );
        });
    }, [aiMinimumActionDelayMs, gameManifest, numPlayers, setupSelections]);

    const handleSetupSelectionsChange = (nextSelections: GameSetupSelections) => {
        setSetupSelections(normalizeExtendedSetupSelections(nextSelections, isQidahenRoom));
    };

    const handlePlayerCountChange = (nextNumPlayers: number) => {
        const previousNumPlayers = numPlayers;
        setNumPlayers(nextNumPlayers);
        setSetupSelections((current) => normalizeCreateRoomSetupSelections({
            gameManifest,
            setupFields,
            numPlayers: nextNumPlayers,
            setupSelections: current,
            isQidahenRoom,
        }));
        if (enableAi && nextNumPlayers > previousNumPlayers) {
            setSeatControllers((current) => fillNonOwnerSeatsWithAi({
                seatControllers: current,
                numPlayers: nextNumPlayers,
                gameManifest,
                difficulty: aiDifficulty,
                manualFactionSelection,
                minimumActionDelayMs: aiMinimumActionDelayMs,
                onlyMissingSeats: true,
            }));
        }
    };

    const handleToggleAiEnabled = () => {
        if (!gameManifest.ai?.localAi && !gameManifest.ai?.remoteAi) {
            return;
        }

        setEnableAi((current) => {
            const nextEnabled = !current;
            if (nextEnabled) {
                setSeatControllers((existing) => fillNonOwnerSeatsWithAi({
                    seatControllers: existing,
                    numPlayers,
                    gameManifest,
                    difficulty: aiDifficulty,
                    manualFactionSelection,
                    minimumActionDelayMs: aiMinimumActionDelayMs,
                }));
                return true;
            }

            setSeatControllers((existing) => {
                const nextControllers = forceHumanOwnerSeat({ ...existing });
                for (let index = 1; index < numPlayers; index += 1) {
                    nextControllers[String(index)] = { type: 'human' };
                }
                return nextControllers;
            });
            return false;
        });
    };

    const handleToggleAiSeat = (playerId: string) => {
        if (playerId === OWNER_PLAYER_ID || !enableAi) return;
        setSeatControllers((current) => {
            const nextControllers = forceHumanOwnerSeat({ ...current });
            const currentController = nextControllers[playerId];
            nextControllers[playerId] = currentController?.type === 'human'
                ? getEnabledAiController(
                    gameManifest,
                    aiDifficulty,
                    manualFactionSelection,
                    aiMinimumActionDelayMs,
                )
                : { type: 'human' };
            return nextControllers;
        });
    };

    const handleDifficultyChange = (difficulty: AiDifficultyLevel) => {
        setAiDifficulty(difficulty);
        setSeatControllers((current) => applyLocalAiDifficulty(current, numPlayers, difficulty));
    };

    const handleManualFactionSelectionChange = (checked: boolean) => {
        setManualFactionSelection(checked);
        setSeatControllers((current) => applyManualFactionSelection(current, numPlayers, checked));
    };

    const handleAiMinimumActionDelayChange = (value: number) => {
        const nextDelayMs = normalizeAiMinimumActionDelayMs(value) ?? DEFAULT_AI_MINIMUM_ACTION_DELAY_MS;
        setAiMinimumActionDelayMs(nextDelayMs);
        setSeatControllers((current) => applyAiMinimumActionDelay(current, numPlayers, nextDelayMs));
    };

    const handleConfirm = () => {
        const normalizedSeatControllers = enableAi
            ? forceHumanOwnerSeat(
                normalizeLocalMatchPreferences(gameManifest, {
                    numPlayers,
                    seatControllers,
                    minimumActionDelayMs: aiMinimumActionDelayMs,
                    setupSelections,
                }).seatControllers,
            )
            : forceHumanOwnerSeat(
                Object.fromEntries(
                    Array.from({ length: numPlayers }, (_, index) => [String(index), { type: 'human' } as AiSeatController]),
                ),
            );
        onConfirm({
            roomName: roomName.trim(),
            numPlayers,
            ttlSeconds,
            password: password.trim(),
            enableAi,
            minimumActionDelayMs: aiMinimumActionDelayMs,
            seatControllers: normalizedSeatControllers,
            setupSelections,
        });
    };

    const handleBackdropClick = () => {
        if (!isLoading) {
            onClose();
        }
    };

    const lockedViewportHeight = 'var(--layout-viewport-height, var(--runtime-viewport-height, 100vh))';
    const lockedBottomInset = isHomeV2Style
        ? 'var(--safe-area-bottom)'
        : 'var(--runtime-modal-bottom-inset)';

    const modalLayer = (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={handleBackdropClick}
                        className={`fixed inset-0 ${isHomeV2Style ? 'bg-[rgba(18,13,9,0.56)] backdrop-blur-[2px]' : 'bg-black/50 backdrop-blur-sm'}`}
                        style={{ zIndex: UI_Z_INDEX.modalOverlay }}
                    />

                    <motion.div
                        initial={isHomeV2Style ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
                        animate={isHomeV2Style ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                        exit={isHomeV2Style ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                        transition={isHomeV2Style
                            ? { duration: 0.18, ease: 'easeOut' }
                            : { type: 'spring', stiffness: 300, damping: 30 }}
                        className={`fixed inset-0 flex justify-center p-4 sm:p-8 pointer-events-none ${isHomeV2Style ? 'items-center' : 'modal-base-container items-center'}`}
                        data-lock-layout-viewport="true"
                        style={{
                            zIndex: UI_Z_INDEX.modalContent,
                            '--modal-active-viewport-height': lockedViewportHeight,
                            '--modal-active-bottom-inset': lockedBottomInset,
                            '--modal-max-height': `calc(${lockedViewportHeight} - max(1rem, var(--safe-area-top)) - max(1rem, var(--modal-active-bottom-inset, ${lockedBottomInset})))`,
                            ...(isHomeV2Style ? {
                                top: 0,
                                right: 0,
                                bottom: 0,
                                left: 0,
                                height: lockedViewportHeight,
                                maxHeight: lockedViewportHeight,
                                overflowY: 'visible',
                            } : {}),
                            paddingTop: isHomeV2Style
                                ? 'max(1rem, var(--safe-area-top))'
                                : 'max(1rem, var(--safe-area-top))',
                            paddingRight: isHomeV2Style
                                ? 'max(1rem, var(--safe-area-right))'
                                : 'max(1rem, var(--safe-area-right))',
                            paddingBottom: isHomeV2Style
                                ? 'max(1rem, var(--modal-active-bottom-inset, var(--safe-area-bottom)))'
                                : 'max(1rem, var(--modal-active-bottom-inset, var(--runtime-modal-bottom-inset)))',
                            paddingLeft: isHomeV2Style
                                ? 'max(1rem, var(--safe-area-left))'
                                : 'max(1rem, var(--safe-area-left))',
                        }}
                    >
                        {isHomeV2Style ? (
                            <HomeV2PaperModalFrame
                                title={t('createRoom.title')}
                                onClick={(event) => event.stopPropagation()}
                                dataTestId="create-room-modal"
                                dataTextEntryAutoscroll="off"
                                surfaceClassName={clsx(
                                    'font-serif',
                                    isCompactHomeV2Layout && 'home-v2-paper-modal-compact',
                                    isCompactHomeV2Layout ? 'w-[min(16.75rem,calc(100vw-1rem))]' : 'w-[min(34rem,calc(100vw-2rem))]',
                                )}
                                surfaceStyle={{
                                    height: isCompactHomeV2Layout
                                        ? 'min(calc(var(--modal-max-height, var(--runtime-modal-max-height)) - 0.5rem), 18.75rem)'
                                        : undefined,
                                    maxHeight: isCompactHomeV2Layout
                                        ? undefined
                                        : 'min(var(--modal-max-height, var(--runtime-modal-max-height)), 42rem)',
                                }}
                                headerClassName={isCompactHomeV2Layout ? 'px-[22px] pb-[9px] pt-[13px]' : undefined}
                                titleClassName={isCompactHomeV2Layout ? 'text-[11.8px] tracking-[0.075em]' : undefined}
                                dividerClassName={isCompactHomeV2Layout ? 'mt-[7px] w-[72%] gap-1.5' : undefined}
                            >
                                <div className={clsx(
                                    'relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain',
                                    isCompactHomeV2Layout ? 'space-y-[5px] px-[20px] pb-[7px]' : 'space-y-4 px-7 pb-5',
                                )}>
                                    <div>
                                        <div className="mb-2 flex items-center justify-between gap-3">
                                            <label className={fieldLabelClassName}>
                                                {t('createRoom.roomName')}
                                            </label>
                                            <span className={fieldHintClassName}>
                                                {t('createRoom.roomNameHint')}
                                            </span>
                                        </div>
                                        <input
                                            type="text"
                                            name="roomName"
                                            value={roomName}
                                            onChange={(event) => setRoomName(event.target.value)}
                                            placeholder={t('createRoom.roomNamePlaceholder')}
                                            maxLength={20}
                                            autoComplete="off"
                                            className={inputClassName}
                                            data-testid="create-room-name-input"
                                        />
                                    </div>

                                    <div>
                                        <div className="mb-2 flex items-center justify-between gap-3">
                                            <label className={fieldLabelClassName}>
                                                {t('createRoom.password')}
                                            </label>
                                            <span className={fieldHintClassName}>
                                                {t('createRoom.passwordHint')}
                                            </span>
                                        </div>
                                        <PasswordField
                                            name="roomPassword"
                                            value={password}
                                            onChange={(event) => setPassword(event.target.value)}
                                            placeholder={t('createRoom.passwordPlaceholder')}
                                            maxLength={10}
                                            autoComplete="new-password"
                                            className={clsx(inputClassName, isCompactHomeV2Layout ? 'pr-10' : 'pr-11')}
                                            data-testid="create-room-password-input"
                                            toggleButtonTestId="create-room-password-toggle"
                                            toggleButtonClassName={isCompactHomeV2Layout ? homeV2PaperCompactTextButtonClassName : 'text-[#8b6646] hover:text-[#5a3923]'}
                                            iconSize={isCompactHomeV2Layout ? 9 : undefined}
                                        />
                                    </div>

                                    {hasPlayerOptions && (
                                        <div>
                                            <label className={fieldLabelClassName}>
                                                {t('createRoom.playerCount')}
                                            </label>
                                            <div className={isCompactHomeV2Layout ? 'flex flex-wrap gap-[6px]' : 'flex flex-wrap gap-2'}>
                                                {currentPlayerOptions.map((count) => (
                                                    <button
                                                        key={count}
                                                        type="button"
                                                        onClick={() => handlePlayerCountChange(count)}
                                                        className={`${isCompactHomeV2Layout ? 'min-w-[52px] rounded-[5px] px-[9px] py-[5px] text-[8.1px]' : 'rounded-[8px] px-4 py-2 text-sm'} cursor-pointer font-bold transition-all ${
                                                            numPlayers === count
                                                                ? 'border border-[#875b3b] bg-[#875b3b] text-[#f6e6cd]'
                                                                : 'border border-[#b6905e] bg-[rgba(247,227,191,0.64)] text-[#5b3822] hover:bg-[rgba(240,212,164,0.82)]'
                                                        }`}
                                                    >
                                                        {t('createRoom.playerCountUnit', { count })}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <div className="mb-2 flex items-center justify-between gap-3">
                                            <label className={fieldLabelClassName}>
                                                {t('createRoom.retention')}
                                            </label>
                                            <span className={fieldHintClassName}>
                                                {t('createRoom.retentionHint')}
                                            </span>
                                        </div>
                                        <select
                                            value={ttlSeconds}
                                            onChange={(event) => setTtlSeconds(Number(event.target.value))}
                                            className={clsx(inputClassName, 'cursor-pointer appearance-none bg-[right_12px_center] bg-no-repeat')}
                                            style={{
                                                backgroundImage: "url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23624630%22%20d%3D%22M2%204l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')",
                                            }}
                                        >
                                            {RETENTION_OPTIONS.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {t(`createRoom.retentionOptions.${option.key}`)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {!isQidahenRoom ? (
                                        <SetupOptionsFields
                                            gameManifest={gameManifest}
                                            selections={setupSelections}
                                            onSelectionsChange={handleSetupSelectionsChange}
                                            t={t}
                                            gameNamespace={gameNamespace}
                                            numPlayers={numPlayers}
                                        />
                                    ) : null}

                                    {(gameManifest.ai?.localAi || gameManifest.ai?.remoteAi) && (
                                        <div className={isCompactHomeV2Layout ? 'space-y-[7px] rounded-[5px] border border-[#b6905e]/36 bg-[rgba(247,227,191,0.20)] px-[10px] py-[8px]' : 'space-y-3 rounded-[8px] border border-[#b6905e]/40 bg-[rgba(247,227,191,0.22)] px-4 py-3'}>
                                            <button
                                                type="button"
                                                onClick={handleToggleAiEnabled}
                                                aria-pressed={enableAi}
                                                className={`${isCompactHomeV2Layout ? 'gap-[8px] rounded-[5px] px-[8px] py-[6px]' : 'gap-3 rounded-[8px] px-3 py-2'} flex w-full cursor-pointer items-center justify-between border text-left transition-colors ${
                                                    enableAi
                                                        ? 'border-[#875b3b] bg-[#f1d4ad]/65'
                                                        : 'border-[#b6905e] bg-[rgba(248,226,194,0.5)] hover:bg-[rgba(243,214,175,0.74)]'
                                                }`}
                                            >
                                                <span className={isCompactHomeV2Layout ? 'text-[8.3px] font-bold text-[#4f2f1c]' : 'text-sm font-bold text-[#4f2f1c]'}>
                                                    {t('createRoom.enableRoomAi')}
                                                </span>
                                                <span
                                                    className={`${isCompactHomeV2Layout ? 'px-[8px] py-[3px] text-[7px]' : 'px-3 py-1 text-xs'} shrink-0 rounded-full font-bold ${
                                                        enableAi
                                                            ? 'bg-[#875b3b] text-[#f5e4cb]'
                                                            : 'border border-[#9f6f4b]/35 bg-[#f7dfbf]/75 text-[#7a573d]'
                                                    }`}
                                                >
                                                    {enableAi ? t('createRoom.enabled') : t('createRoom.disabled')}
                                                </span>
                                            </button>

                                            {enableAi && (
                                                <>
                                                    {gameManifest.ai?.localAi && (
                                                        <div className={isCompactHomeV2Layout ? 'flex flex-wrap items-center gap-[6px]' : 'flex flex-wrap items-center gap-2'}>
                                                            <span className={isCompactHomeV2Layout ? 'text-[7.6px] font-bold text-[#5b3822]' : 'text-xs font-bold text-[#5b3822]'}>
                                                                {t('ai.difficulty')}
                                                            </span>
                                                            {LOCAL_AI_DIFFICULTY_OPTIONS.map((difficulty) => {
                                                                const active = aiDifficulty === difficulty;
                                                                return (
                                                            <button
                                                                key={difficulty}
                                                                type="button"
                                                                onClick={() => handleDifficultyChange(difficulty)}
                                                                aria-pressed={active}
                                                                className={`${isCompactHomeV2Layout ? 'rounded-[4px] px-[7px] py-[3px] text-[7.2px]' : 'rounded-[8px] px-3 py-1.5 text-xs'} border font-bold transition-all ${
                                                                    active
                                                                        ? 'cursor-pointer border-[#875b3b] bg-[#875b3b] text-[#f6e6cd]'
                                                                        : 'cursor-pointer border-[#b6905e] bg-[rgba(247,227,191,0.64)] text-[#5b3822] hover:bg-[rgba(240,212,164,0.82)]'
                                                                }`}
                                                            >
                                                                        {t(`ai.difficulties.${difficulty}`)}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    <div className={isCompactHomeV2Layout ? 'space-y-[4px]' : 'space-y-1.5'}>
                                                        <div className="flex items-center justify-between gap-3">
                                                            <span className={isCompactHomeV2Layout ? 'text-[7.6px] font-bold text-[#5b3822]' : 'text-xs font-bold text-[#5b3822]'}>
                                                                {t('createRoom.aiThinkingTime')}
                                                            </span>
                                                            <span className={fieldHintClassName}>
                                                                {t('createRoom.aiThinkingTimeHint')}
                                                            </span>
                                                        </div>
                                                        <select
                                                            value={aiMinimumActionDelayMs}
                                                            onChange={(event) => handleAiMinimumActionDelayChange(Number(event.target.value))}
                                                            className={clsx(
                                                                inputClassName,
                                                                'cursor-pointer appearance-none bg-[right_12px_center] bg-no-repeat',
                                                                isCompactHomeV2Layout && 'min-h-[24px] px-[8px] py-[4px] text-[7.5px]',
                                                            )}
                                                            style={{
                                                                backgroundImage: "url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23624630%22%20d%3D%22M2%204l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')",
                                                            }}
                                                            data-testid="create-room-ai-thinking-time-select"
                                                        >
                                                            {AI_MINIMUM_ACTION_DELAY_OPTIONS_MS.map((delayMs) => {
                                                                const seconds = delayMs / 1000;
                                                                return (
                                                                    <option key={delayMs} value={delayMs}>
                                                                        {t('createRoom.aiThinkingTimeSeconds', {
                                                                            count: seconds,
                                                                            defaultValue: `${formatAiThinkingDelayLabel(seconds)} 秒`,
                                                                        })}
                                                                    </option>
                                                                );
                                                            })}
                                                        </select>
                                                    </div>

                                                    <div className={isCompactHomeV2Layout ? 'flex flex-wrap items-center gap-[6px]' : 'flex flex-wrap items-center gap-2'}>
                                                        <span className={isCompactHomeV2Layout ? 'text-[7.6px] font-bold text-[#5b3822]' : 'text-xs font-bold text-[#5b3822]'}>
                                                            {t('createRoom.occupiedSeats')}
                                                        </span>
                                                        {Array.from({ length: numPlayers }, (_, index) => {
                                                            const playerId = String(index);
                                                            const isOwnerSeat = playerId === OWNER_PLAYER_ID;
                                                            const isAiSeat = seatControllers[playerId]?.type !== 'human';
                                                            const label = isOwnerSeat
                                                                ? t('createRoom.ownerSeatUnit', { seat: index + 1 })
                                                                : t('createRoom.occupiedSeatUnit', { seat: index + 1 });

                                                            return (
                                                                <button
                                                                    key={playerId}
                                                                    type="button"
                                                                    onClick={() => handleToggleAiSeat(playerId)}
                                                                    disabled={isOwnerSeat}
                                                                    aria-pressed={isOwnerSeat ? false : isAiSeat}
                                                                    className={`${isCompactHomeV2Layout ? 'rounded-[4px] px-[7px] py-[3px] text-[7.2px]' : 'rounded-[8px] px-3 py-1.5 text-xs'} border font-bold transition-all ${
                                                                        isOwnerSeat
                                                                            ? 'cursor-not-allowed border-[#a37a55]/25 bg-[#f2d9b8]/50 text-[#8a6649]/80'
                                                                            : isAiSeat
                                                                                ? 'cursor-pointer border-[#875b3b] bg-[#875b3b] text-[#f6e6cd]'
                                                                                : 'cursor-pointer border-[#b6905e] bg-[rgba(247,227,191,0.64)] text-[#5b3822] hover:bg-[rgba(240,212,164,0.82)]'
                                                                    }`}
                                                                >
                                                                    {label}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>

                                                    <label className={`${isCompactHomeV2Layout ? 'gap-[6px] rounded-[5px] px-[8px] py-[5px]' : 'gap-3 rounded-[8px] px-3 py-2'} flex cursor-pointer items-center border border-[#b6905e]/34 bg-[rgba(247,227,191,0.44)] text-left transition-colors hover:bg-[rgba(240,212,164,0.64)]`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={manualFactionSelection}
                                                            onChange={(event) => handleManualFactionSelectionChange(event.target.checked)}
                                                            className={isCompactHomeV2Layout ? 'h-[10px] w-[10px] cursor-pointer accent-[#875b3b]' : 'h-4 w-4 cursor-pointer accent-[#875b3b]'}
                                                            data-testid="create-room-ai-manual-faction-checkbox"
                                                        />
                                                        <span className={isCompactHomeV2Layout ? 'text-[7.6px] font-bold text-[#5b3822]' : 'text-xs font-bold text-[#5b3822]'}>
                                                            {t('createRoom.aiManualFactionSelection')}
                                                        </span>
                                                    </label>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className={clsx(
                                    'relative z-10 shrink-0 flex gap-3 border-t border-[#8c5f3e]/24 bg-transparent',
                                    isCompactHomeV2Layout ? 'px-[20px] pb-[9px] pt-[5px]' : 'px-7 pb-6 pt-4',
                                )}>
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        data-testid="create-room-cancel-button"
                                        className={clsx('flex-1', secondaryButtonClassName, isCompactHomeV2Layout && 'min-h-[27px]')}
                                        disabled={isLoading}
                                    >
                                        {t('actions.cancel')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleConfirm}
                                        className={clsx('flex-1', primaryButtonClassName, 'tracking-[0.14em]', isCompactHomeV2Layout && 'min-h-[27px]')}
                                        disabled={isLoading}
                                        data-testid="create-room-confirm-button"
                                    >
                                        {isLoading ? t('button.processing') : t('createRoom.confirm')}
                                    </button>
                                </div>
                            </HomeV2PaperModalFrame>
                        ) : (
                            <div
                                className="pointer-events-auto relative flex w-full max-w-md flex-col overflow-hidden rounded-sm border border-parchment-card-border/30 bg-parchment-card-bg font-serif shadow-parchment-card-hover"
                                onClick={(event) => event.stopPropagation()}
                                style={{
                                    maxHeight: 'min(var(--modal-max-height, var(--runtime-modal-max-height)), 42rem)',
                                }}
                                data-testid="create-room-modal"
                            >
                                <>
                                    <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-parchment-card-border/60" />
                                    <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-parchment-card-border/60" />
                                    <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-parchment-card-border/60" />
                                    <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-parchment-card-border/60" />
                                </>
                            <div className="relative z-10 shrink-0 p-6 pb-4">
                                <h2 className="text-center text-xl font-bold tracking-wide text-parchment-base-text">
                                    {t('createRoom.title')}
                                </h2>
                            </div>

                            <div className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-5 px-6 pb-4">
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-bold text-parchment-base-text">
                                            {t('createRoom.roomName')}
                                        </label>
                                        <span className="text-xs italic text-parchment-light-text">
                                            {t('createRoom.roomNameHint')}
                                        </span>
                                    </div>
                                    <input
                                        type="text"
                                        name="roomName"
                                        value={roomName}
                                        onChange={(event) => setRoomName(event.target.value)}
                                        placeholder={t('createRoom.roomNamePlaceholder')}
                                        maxLength={20}
                                        autoComplete="off"
                                        className="w-full rounded-[6px] border border-parchment-card-border/30 bg-parchment-card-bg px-3 py-2 text-base text-parchment-base-text transition-colors placeholder:text-parchment-light-text/50 focus:border-parchment-base-text focus:outline-none sm:text-sm"
                                        data-testid="create-room-name-input"
                                    />
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-bold text-parchment-base-text">
                                            {t('createRoom.password')}
                                        </label>
                                        <span className="text-xs italic text-parchment-light-text">
                                            {t('createRoom.passwordHint')}
                                        </span>
                                    </div>
                                    <PasswordField
                                        name="roomPassword"
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        placeholder={t('createRoom.passwordPlaceholder')}
                                        maxLength={10}
                                        autoComplete="new-password"
                                        className="w-full rounded-[6px] border border-parchment-card-border/30 bg-parchment-card-bg px-3 py-2 pr-9 text-base text-parchment-base-text transition-colors placeholder:text-parchment-light-text/50 focus:border-parchment-base-text focus:outline-none sm:text-sm"
                                        data-testid="create-room-password-input"
                                        toggleButtonTestId="create-room-password-toggle"
                                        toggleButtonClassName="text-parchment-light-text hover:text-parchment-base-text"
                                    />
                                </div>

                                {hasPlayerOptions && (
                                    <div>
                                        <label className="mb-2 block text-sm font-bold text-parchment-base-text">
                                            {t('createRoom.playerCount')}
                                        </label>
                                        <div className="flex gap-2 flex-wrap">
                                            {currentPlayerOptions.map((count) => (
                                                <button
                                                    key={count}
                                                    type="button"
                                                    onClick={() => handlePlayerCountChange(count)}
                                                    className={`cursor-pointer rounded-[6px] px-4 py-2 text-sm font-bold transition-all ${
                                                        numPlayers === count
                                                            ? 'bg-parchment-base-text text-parchment-card-bg border border-parchment-base-text'
                                                            : 'bg-parchment-card-bg text-parchment-base-text border border-parchment-card-border/30 hover:bg-parchment-base-bg'
                                                    }`}
                                                >
                                                    {t('createRoom.playerCountUnit', { count })}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-bold text-parchment-base-text">
                                            {t('createRoom.retention')}
                                        </label>
                                        <span className="text-xs italic text-parchment-light-text">
                                            {t('createRoom.retentionHint')}
                                        </span>
                                    </div>
                                    <select
                                        value={ttlSeconds}
                                        onChange={(event) => setTtlSeconds(Number(event.target.value))}
                                        className="w-full appearance-none rounded-[6px] border border-parchment-card-border/30 bg-parchment-card-bg px-3 py-2 text-base text-parchment-base-text cursor-pointer focus:border-parchment-base-text focus:outline-none sm:text-sm"
                                    >
                                        {RETENTION_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {t(`createRoom.retentionOptions.${option.key}`)}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {!isQidahenRoom ? (
                                    <SetupOptionsFields
                                        gameManifest={gameManifest}
                                        selections={setupSelections}
                                        onSelectionsChange={handleSetupSelectionsChange}
                                        t={t}
                                        gameNamespace={gameNamespace}
                                        numPlayers={numPlayers}
                                    />
                                ) : null}

                                {(gameManifest.ai?.localAi || gameManifest.ai?.remoteAi) && (
                                    <div className="rounded-[6px] border border-parchment-card-border/20 bg-parchment-base-bg/25 px-4 py-3 space-y-3">
                                        <button
                                            type="button"
                                            onClick={handleToggleAiEnabled}
                                            aria-pressed={enableAi}
                                            className={`flex w-full items-center justify-between gap-3 rounded-[6px] border px-3 py-2 text-left transition-colors cursor-pointer ${
                                                enableAi
                                                    ? 'border-emerald-700/20 bg-emerald-50/60'
                                                    : 'border-parchment-card-border/30 bg-parchment-base-bg/35 hover:bg-parchment-base-bg/60'
                                            }`}
                                        >
                                            <span className="text-sm font-bold text-parchment-base-text">
                                                {t('createRoom.enableRoomAi')}
                                            </span>
                                            <span
                                                className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                                                    enableAi
                                                        ? 'bg-emerald-600 text-white'
                                                        : 'bg-parchment-card-bg text-parchment-light-text border border-parchment-card-border/30'
                                                }`}
                                            >
                                                {enableAi ? t('createRoom.enabled') : t('createRoom.disabled')}
                                            </span>
                                        </button>

                                        {enableAi && (
                                            <>
                                                {gameManifest.ai?.localAi && (
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="text-xs font-bold text-parchment-base-text">
                                                            {t('ai.difficulty')}
                                                        </span>
                                                        {LOCAL_AI_DIFFICULTY_OPTIONS.map((difficulty) => {
                                                            const active = aiDifficulty === difficulty;
                                                            return (
                                                                <button
                                                                    key={difficulty}
                                                                    type="button"
                                                                    onClick={() => handleDifficultyChange(difficulty)}
                                                                        aria-pressed={active}
                                                                        className={`rounded-[4px] border px-3 py-1.5 text-xs font-bold transition-all ${
                                                                            active
                                                                                ? 'cursor-pointer border-emerald-600 bg-emerald-600 text-white shadow-sm'
                                                                                : 'cursor-pointer border-parchment-card-border/30 bg-parchment-card-bg text-parchment-base-text hover:bg-parchment-base-bg'
                                                                        }`}
                                                                    >
                                                                    {t(`ai.difficulties.${difficulty}`)}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                <div className="space-y-1.5">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="text-xs font-bold text-parchment-base-text">
                                                            {t('createRoom.aiThinkingTime')}
                                                        </span>
                                                        <span className="text-xs italic text-parchment-light-text">
                                                            {t('createRoom.aiThinkingTimeHint')}
                                                        </span>
                                                    </div>
                                                    <select
                                                        value={aiMinimumActionDelayMs}
                                                        onChange={(event) => handleAiMinimumActionDelayChange(Number(event.target.value))}
                                                        className="w-full appearance-none rounded-[6px] border border-parchment-card-border/30 bg-parchment-card-bg px-3 py-2 text-base text-parchment-base-text cursor-pointer focus:border-parchment-base-text focus:outline-none sm:text-sm"
                                                        data-testid="create-room-ai-thinking-time-select"
                                                    >
                                                        {AI_MINIMUM_ACTION_DELAY_OPTIONS_MS.map((delayMs) => {
                                                            const seconds = delayMs / 1000;
                                                            return (
                                                                <option key={delayMs} value={delayMs}>
                                                                    {t('createRoom.aiThinkingTimeSeconds', {
                                                                        count: seconds,
                                                                        defaultValue: `${formatAiThinkingDelayLabel(seconds)} sec`,
                                                                    })}
                                                                </option>
                                                            );
                                                        })}
                                                    </select>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-xs font-bold text-parchment-base-text">
                                                        {t('createRoom.occupiedSeats')}
                                                    </span>
                                                    {Array.from({ length: numPlayers }, (_, index) => {
                                                        const playerId = String(index);
                                                        const isOwnerSeat = playerId === OWNER_PLAYER_ID;
                                                        const isAiSeat = seatControllers[playerId]?.type !== 'human';
                                                        const label = isOwnerSeat
                                                            ? t('createRoom.ownerSeatUnit', { seat: index + 1 })
                                                            : t('createRoom.occupiedSeatUnit', { seat: index + 1 });

                                                        return (
                                                            <button
                                                                key={playerId}
                                                                type="button"
                                                                onClick={() => handleToggleAiSeat(playerId)}
                                                                disabled={isOwnerSeat}
                                                                aria-pressed={isOwnerSeat ? false : isAiSeat}
                                                                className={`rounded-[4px] border px-3 py-1.5 text-xs font-bold transition-all ${
                                                                    isOwnerSeat
                                                                        ? 'cursor-not-allowed border-parchment-card-border/25 bg-parchment-base-bg/55 text-parchment-light-text/80'
                                                                        : isAiSeat
                                                                            ? 'cursor-pointer border-emerald-600 bg-emerald-600 text-white shadow-sm'
                                                                            : 'cursor-pointer border-parchment-card-border/30 bg-parchment-card-bg text-parchment-base-text hover:bg-parchment-base-bg'
                                                                }`}
                                                            >
                                                                {label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                <label className="flex cursor-pointer items-center gap-3 rounded-[6px] border border-parchment-card-border/25 bg-parchment-card-bg/70 px-3 py-2 text-left transition-colors hover:bg-parchment-base-bg/45">
                                                    <input
                                                        type="checkbox"
                                                        checked={manualFactionSelection}
                                                        onChange={(event) => handleManualFactionSelectionChange(event.target.checked)}
                                                        className="h-4 w-4 cursor-pointer accent-emerald-600"
                                                        data-testid="create-room-ai-manual-faction-checkbox"
                                                    />
                                                    <span className="text-xs font-bold text-parchment-base-text">
                                                        {t('createRoom.aiManualFactionSelection')}
                                                    </span>
                                                </label>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="relative z-10 shrink-0 flex gap-3 border-t border-parchment-card-border/15 bg-parchment-card-bg/95 p-6 pt-4">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    data-testid="create-room-cancel-button"
                                    className="flex-1 cursor-pointer rounded-[6px] border border-parchment-card-border/30 bg-parchment-card-bg px-4 py-2.5 font-bold text-parchment-base-text transition-all hover:bg-parchment-base-bg"
                                    disabled={isLoading}
                                >
                                    {t('actions.cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirm}
                                    className="flex-1 cursor-pointer rounded-[6px] bg-parchment-base-text px-4 py-2.5 font-bold text-parchment-card-bg transition-all hover:bg-parchment-brown disabled:opacity-50"
                                    disabled={isLoading}
                                    data-testid="create-room-confirm-button"
                                >
                                    {isLoading ? t('button.processing') : t('createRoom.confirm')}
                                </button>
                            </div>
                        </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );

    if (typeof document === 'undefined') {
        return null;
    }

    return createPortal(modalLayer, document.body);
};
