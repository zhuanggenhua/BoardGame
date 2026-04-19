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
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import type { GameManifestEntry, GameSetupField, GameSetupSelectOption } from '../../games/manifest.types';
import { UI_Z_INDEX } from '../../core';
import type { AiDifficultyLevel, AiSeatController } from '../../engine/ai';
import {
    DEFAULT_LOCAL_AI_DIFFICULTY,
    createDefaultLocalMatchPreferences,
    normalizeLocalMatchPreferences,
    type LocalMatchPreferences,
} from '../../engine/ai';
import {
    getDefaultSetupSelections,
    type GameSetupSelections,
} from '../../games/setupOptions';
import { SetupOptionsFields } from './SetupOptionsFields';
import { PasswordField } from '../common/PasswordField';

/** 保存时间选项（秒） */
const RETENTION_OPTIONS = [
    { value: 0, key: 'none' },
    { value: 86400, key: '1day' },
    { value: 259200, key: '3days' },
    { value: 604800, key: '7days' },
] as const;

const LOCAL_AI_DIFFICULTY_OPTIONS: AiDifficultyLevel[] = ['easy', 'normal', 'hard', 'expert'];

export interface RoomConfig {
    roomName: string;
    numPlayers: number;
    ttlSeconds: number;
    password?: string;
    enableAi: boolean;
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
}

const OWNER_PLAYER_ID = '0';

function getEnabledAiController(
    gameManifest: GameManifestEntry,
    difficulty: AiDifficultyLevel,
): AiSeatController {
    if (gameManifest.ai?.localAi) {
        return { type: 'local-ai', difficulty };
    }
    if (gameManifest.ai?.remoteAi) {
        return { type: 'remote-ai', providerId: 'astrbot' };
    }
    return { type: 'human' };
}

function forceHumanOwnerSeat(seatControllers: Record<string, AiSeatController>): Record<string, AiSeatController> {
    return {
        ...seatControllers,
        [OWNER_PLAYER_ID]: { type: 'human' },
    };
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

const toSelectValueRecord = (selections: GameSetupSelections): Record<string, string> => {
    const selectValues: Record<string, string> = {};
    for (const [key, value] of Object.entries(selections)) {
        if (typeof value === 'string') {
            selectValues[key] = value;
        }
    }
    return selectValues;
};

export const CreateRoomModal = ({
    isOpen,
    onClose,
    onConfirm,
    gameManifest,
    initialPreferences,
    isLoading = false,
}: CreateRoomModalProps) => {
    const gameNamespace = `game-${gameManifest.id}`;
    const { t } = useTranslation(['lobby', gameNamespace]);
    const playerOptions = useMemo(() => gameManifest.playerOptions ?? [2], [gameManifest.playerOptions]);
    const setupFields = useMemo(
        () => Object.entries(gameManifest.setupOptions ?? {}),
        [gameManifest.setupOptions],
    );
    const hasPlayerOptions = playerOptions.length > 1;

    const [roomName, setRoomName] = useState('');
    const [numPlayers, setNumPlayers] = useState(playerOptions[0]);
    const [ttlSeconds, setTtlSeconds] = useState(0);
    const [password, setPassword] = useState('');
    const [enableAi, setEnableAi] = useState(false);
    const [aiDifficulty, setAiDifficulty] = useState<AiDifficultyLevel>(DEFAULT_LOCAL_AI_DIFFICULTY);
    const [seatControllers, setSeatControllers] = useState<Record<string, AiSeatController>>({});
    const [setupSelections, setSetupSelections] = useState<GameSetupSelections>(() => {
        const defaults = getDefaultSetupSelections(gameManifest);
        return {
            ...defaults,
            ...normalizeSetupValuesForFields(setupFields, playerOptions[0], toSelectValueRecord(defaults)),
        };
    });

    useEffect(() => {
        if (!isOpen) return;
        const nextPreferences = initialPreferences
            ? normalizeLocalMatchPreferences(
                gameManifest,
                initialPreferences as unknown as Record<string, unknown>,
            )
            : createDefaultLocalMatchPreferences(gameManifest);
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
        const shouldEnableAi = initialPreferences
            ? countAiSeats(nextSeatControllers, nextPreferences.numPlayers) > 0
            : false;

        setRoomName('');
        setNumPlayers(nextPreferences.numPlayers);
        setTtlSeconds(0);
        setPassword('');
        setEnableAi(shouldEnableAi);
        setAiDifficulty(inferredDifficulty);
        setSeatControllers(nextSeatControllers);
        setSetupSelections({
            ...nextPreferences.setupSelections,
            ...normalizeSetupValuesForFields(
                setupFields,
                nextPreferences.numPlayers,
                toSelectValueRecord(nextPreferences.setupSelections),
            ),
        });
    }, [gameManifest, initialPreferences, isOpen, playerOptions, setupFields]);

    useEffect(() => {
        setSetupSelections((current) => {
            const currentSelectValues = toSelectValueRecord(current);
            const normalizedSelectValues = normalizeSetupValuesForFields(
                setupFields,
                numPlayers,
                currentSelectValues,
            );
            if (isSameSetupValues(currentSelectValues, normalizedSelectValues)) {
                return current;
            }
            return {
                ...current,
                ...normalizedSelectValues,
            };
        });
    }, [numPlayers, setupFields]);

    useEffect(() => {
        setSeatControllers((current) => {
            const normalized = normalizeLocalMatchPreferences(gameManifest, {
                numPlayers,
                seatControllers: current,
                setupSelections,
            }).seatControllers;
            return forceHumanOwnerSeat(normalized);
        });
    }, [gameManifest, numPlayers, setupSelections]);

    const handleToggleAiEnabled = () => {
        if (!gameManifest.ai?.localAi && !gameManifest.ai?.remoteAi) {
            return;
        }

        setEnableAi((current) => {
            const nextEnabled = !current;
            if (nextEnabled) {
                setSeatControllers((existing) => {
                    const nextControllers = forceHumanOwnerSeat({ ...existing });
                    const hasAiSeat = countAiSeats(nextControllers, numPlayers) > 0;
                    if (!hasAiSeat && numPlayers > 1) {
                        nextControllers['1'] = getEnabledAiController(gameManifest, aiDifficulty);
                    }
                    return nextControllers;
                });
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
                ? getEnabledAiController(gameManifest, aiDifficulty)
                : { type: 'human' };
            return nextControllers;
        });
    };

    const handleDifficultyChange = (difficulty: AiDifficultyLevel) => {
        setAiDifficulty(difficulty);
        setSeatControllers((current) => applyLocalAiDifficulty(current, numPlayers, difficulty));
    };

    const handleConfirm = () => {
        const normalizedSeatControllers = enableAi
            ? forceHumanOwnerSeat(
                normalizeLocalMatchPreferences(gameManifest, {
                    numPlayers,
                    seatControllers,
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
            seatControllers: normalizedSeatControllers,
            setupSelections,
        });
    };

    const handleBackdropClick = () => {
        if (!isLoading) {
            onClose();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={handleBackdropClick}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                        style={{ zIndex: UI_Z_INDEX.modalOverlay }}
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="modal-base-container fixed inset-0 flex items-center justify-center p-4 sm:p-8 pointer-events-none"
                        style={{
                            zIndex: UI_Z_INDEX.modalContent,
                            paddingTop: 'max(1rem, var(--safe-area-top))',
                            paddingRight: 'max(1rem, var(--safe-area-right))',
                            paddingBottom: 'max(1rem, var(--runtime-modal-bottom-inset))',
                            paddingLeft: 'max(1rem, var(--safe-area-left))',
                        }}
                    >
                        <div
                            className="bg-parchment-card-bg pointer-events-auto relative flex w-full max-w-md flex-col overflow-hidden rounded-sm border border-parchment-card-border/30 shadow-parchment-card-hover font-serif"
                            onClick={(event) => event.stopPropagation()}
                            style={{ maxHeight: 'min(var(--runtime-modal-max-height), 42rem)' }}
                            data-testid="create-room-modal"
                        >
                            <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-parchment-card-border/60" />
                            <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-parchment-card-border/60" />
                            <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-parchment-card-border/60" />
                            <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-parchment-card-border/60" />

                            <div className="shrink-0 p-6 pb-4">
                                <h2 className="text-xl font-bold text-parchment-base-text tracking-wide text-center">
                                    {t('createRoom.title')}
                                </h2>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 space-y-5">
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-bold text-parchment-base-text">
                                            {t('createRoom.roomName')}
                                        </label>
                                        <span className="text-xs text-parchment-light-text italic">
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
                                        className="w-full px-4 py-2.5 rounded-[4px] text-base sm:text-sm border border-parchment-card-border/30 bg-parchment-card-bg text-parchment-base-text placeholder:text-parchment-light-text/50 focus:outline-none focus:border-parchment-base-text transition-colors"
                                        data-testid="create-room-name-input"
                                    />
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-bold text-parchment-base-text">
                                            {t('createRoom.password')}
                                        </label>
                                        <span className="text-xs text-parchment-light-text italic">
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
                                        className="w-full px-4 py-2.5 rounded-[4px] text-base sm:text-sm border border-parchment-card-border/30 bg-parchment-card-bg text-parchment-base-text placeholder:text-parchment-light-text/50 focus:outline-none focus:border-parchment-base-text transition-colors"
                                        data-testid="create-room-password-input"
                                        toggleButtonTestId="create-room-password-toggle"
                                        toggleButtonClassName="text-parchment-light-text hover:text-parchment-base-text"
                                    />
                                </div>

                                {hasPlayerOptions && (
                                    <div>
                                        <label className="block text-sm font-bold text-parchment-base-text mb-2">
                                            {t('createRoom.playerCount')}
                                        </label>
                                        <div className="flex gap-2 flex-wrap">
                                            {playerOptions.map((count) => (
                                                <button
                                                    key={count}
                                                    type="button"
                                                    onClick={() => setNumPlayers(count)}
                                                    className={`px-4 py-2 rounded-[4px] text-sm font-bold transition-all cursor-pointer border ${
                                                        numPlayers === count
                                                            ? 'bg-parchment-base-text text-parchment-card-bg border-parchment-base-text'
                                                            : 'bg-parchment-card-bg text-parchment-base-text border-parchment-card-border/30 hover:bg-parchment-base-bg'
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
                                        <span className="text-xs text-parchment-light-text italic">
                                            {t('createRoom.retentionHint')}
                                        </span>
                                    </div>
                                    <select
                                        value={ttlSeconds}
                                        onChange={(event) => setTtlSeconds(Number(event.target.value))}
                                        className="w-full px-4 py-2.5 rounded-[4px] text-base sm:text-sm border border-parchment-card-border/30 bg-parchment-card-bg text-parchment-base-text focus:outline-none focus:border-parchment-base-text cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23433422%22%20d%3D%22M2%204l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center]"
                                    >
                                        {RETENTION_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {t(`createRoom.retentionOptions.${option.key}`)}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <SetupOptionsFields
                                    gameManifest={gameManifest}
                                    selections={setupSelections}
                                    onSelectionsChange={setSetupSelections}
                                    t={t}
                                    gameNamespace={gameNamespace}
                                    numPlayers={numPlayers}
                                />

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
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="shrink-0 border-t border-parchment-card-border/15 bg-parchment-card-bg/95 p-6 pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 py-2.5 px-4 bg-parchment-card-bg border border-parchment-card-border/30 text-parchment-base-text font-bold rounded-[4px] hover:bg-parchment-base-bg transition-all cursor-pointer"
                                    disabled={isLoading}
                                >
                                    {t('actions.cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirm}
                                    className="flex-1 py-2.5 px-4 bg-parchment-base-text text-parchment-card-bg font-bold rounded-[4px] hover:bg-parchment-brown transition-all cursor-pointer disabled:opacity-50"
                                    disabled={isLoading}
                                    data-testid="create-room-confirm-button"
                                >
                                    {isLoading ? t('button.processing') : t('createRoom.confirm')}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
