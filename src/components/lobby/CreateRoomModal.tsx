/**
 * 创建房间配置弹窗
 *
 * 支持配置：
 * - 房间名称
 * - 游戏人数（从 manifest.playerOptions 读取）
 * - 房间保存时间（TTL）
 * - manifest 声明的 setupOptions（单选 / 多选）
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, X } from 'lucide-react';
import type {
    GameManifestEntry,
    GameSetupField,
    GameSetupMultiSelectField,
    GameSetupSelectField,
} from '../../games/manifest.types';
import { UI_Z_INDEX } from '../../core';

/** 保存时间选项（秒） */
const RETENTION_OPTIONS = [
    { value: 0, key: 'none' },           // 不保存
    { value: 86400, key: '1day' },        // 1 天
    { value: 259200, key: '3days' },      // 3 天
    { value: 604800, key: '7days' },      // 7 天
] as const;

export type RoomSetupValue = string | string[];
export type RoomSetupSelections = Record<string, RoomSetupValue>;

function getDefaultSetupSelections(gameManifest: GameManifestEntry): RoomSetupSelections {
    const selections: RoomSetupSelections = {};
    const fields = gameManifest.setupOptions ?? {};

    for (const [fieldKey, field] of Object.entries(fields)) {
        if (field.type === 'multi-select') {
            selections[fieldKey] = [...(field.default ?? field.options.map((option) => option.value))];
            continue;
        }
        selections[fieldKey] = field.default ?? field.options[0]?.value ?? '';
    }

    return selections;
}

export interface RoomConfig {
    roomName: string;
    numPlayers: number;
    ttlSeconds: number;
    password?: string;
    setupSelections: RoomSetupSelections;
}

interface CreateRoomModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (config: RoomConfig) => void;
    gameManifest: GameManifestEntry;
    isLoading?: boolean;
}

function isSelectField(field: GameSetupField): field is GameSetupSelectField {
    return field.type === 'select';
}

function isMultiSelectField(field: GameSetupField): field is GameSetupMultiSelectField {
    return field.type === 'multi-select';
}

export const CreateRoomModal = ({
    isOpen,
    onClose,
    onConfirm,
    gameManifest,
    isLoading = false,
}: CreateRoomModalProps) => {
    const gameNamespace = `game-${gameManifest.id}`;
    const { t } = useTranslation(['lobby', gameNamespace]);

    // 人数选项：从 manifest 配置读取，默认 [2]
    const playerOptions = gameManifest.playerOptions ?? [2];
    const hasPlayerOptions = playerOptions.length > 1;

    // 状态
    const [roomName, setRoomName] = useState('');
    const [numPlayers, setNumPlayers] = useState(playerOptions[0]);
    const [ttlSeconds, setTtlSeconds] = useState(0);
    const [password, setPassword] = useState('');
    const [setupSelections, setSetupSelections] = useState<RoomSetupSelections>(() => getDefaultSetupSelections(gameManifest));
    const [openMultiSelectKey, setOpenMultiSelectKey] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setRoomName('');
        setNumPlayers(playerOptions[0]);
        setTtlSeconds(0);
        setPassword('');
        setSetupSelections(getDefaultSetupSelections(gameManifest));
        setOpenMultiSelectKey(null);
    }, [gameManifest, isOpen, playerOptions]);

    const resolveSetupLabel = (labelKey: string): string => {
        const setupPrefix = `games.${gameManifest.id}.setup.`;
        if (labelKey.startsWith(setupPrefix)) {
            return t(labelKey.slice(setupPrefix.length), {
                ns: gameNamespace,
                defaultValue: labelKey,
            });
        }
        return t(labelKey, { defaultValue: labelKey });
    };

    const handleConfirm = () => {
        onConfirm({
            roomName: roomName.trim(),
            numPlayers,
            ttlSeconds,
            password: password.trim(),
            setupSelections,
        });
    };

    const handleBackdropClick = () => {
        if (!isLoading) {
            onClose();
        }
    };

    const updateSelectField = (fieldKey: string, value: string) => {
        setSetupSelections((prev) => ({ ...prev, [fieldKey]: value }));
    };

    const toggleMultiSelectFieldValue = (fieldKey: string, optionValue: string) => {
        setSetupSelections((prev) => {
            const currentRaw = prev[fieldKey];
            const current = Array.isArray(currentRaw) ? currentRaw : [];
            const next = current.includes(optionValue)
                ? current.filter((value) => value !== optionValue)
                : [...current, optionValue];
            return { ...prev, [fieldKey]: next };
        });
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* 背景遮罩 */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={handleBackdropClick}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                        style={{ zIndex: UI_Z_INDEX.modalOverlay }}
                    />

                    {/* 弹窗内容 */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="fixed inset-0 flex items-center justify-center p-4 sm:p-8 pointer-events-none"
                        style={{ zIndex: UI_Z_INDEX.modalContent }}
                    >
                        <div
                            className="bg-parchment-card-bg pointer-events-auto w-full max-w-md rounded-sm shadow-parchment-card-hover border border-parchment-card-border/30 relative overflow-hidden font-serif"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* 装饰性边角 */}
                            <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-parchment-card-border/60" />
                            <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-parchment-card-border/60" />
                            <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-parchment-card-border/60" />
                            <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-parchment-card-border/60" />

                            {/* 标题 */}
                            <div className="p-6 pb-4">
                                <h2 className="text-xl font-bold text-parchment-base-text tracking-wide text-center">
                                    {t('createRoom.title')}
                                </h2>
                            </div>

                            {/* 配置选项 */}
                            <div className="p-6 space-y-5">
                                {/* 房间名称 */}
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
                                        value={roomName}
                                        onChange={(e) => setRoomName(e.target.value)}
                                        placeholder={t('createRoom.roomNamePlaceholder')}
                                        maxLength={20}
                                        className="w-full px-4 py-2.5 rounded-[4px] text-sm border border-parchment-card-border/30 bg-parchment-card-bg text-parchment-base-text placeholder:text-parchment-light-text/50 focus:outline-none focus:border-parchment-base-text transition-colors"
                                    />
                                </div>

                                {/* 房间密码（可选） */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-bold text-parchment-base-text">
                                            {t('createRoom.password')}
                                        </label>
                                        <span className="text-xs text-parchment-light-text italic">
                                            {t('createRoom.passwordHint')}
                                        </span>
                                    </div>
                                    <input
                                        type="text"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder={t('createRoom.passwordPlaceholder')}
                                        maxLength={10}
                                        className="w-full px-4 py-2.5 rounded-[4px] text-sm border border-parchment-card-border/30 bg-parchment-card-bg text-parchment-base-text placeholder:text-parchment-light-text/50 focus:outline-none focus:border-parchment-base-text transition-colors"
                                    />
                                </div>

                                {/* 游戏人数 */}
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
                                                    className={`
                                                        px-4 py-2 rounded-[4px] text-sm font-bold transition-all cursor-pointer
                                                        border
                                                        ${numPlayers === count
                                                            ? 'bg-parchment-base-text text-parchment-card-bg border-parchment-base-text'
                                                            : 'bg-parchment-card-bg text-parchment-base-text border-parchment-card-border/30 hover:bg-parchment-base-bg'
                                                        }
                                                    `}
                                                >
                                                    {t('createRoom.playerCountUnit', { count })}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 房间保存时间 */}
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
                                        onChange={(e) => setTtlSeconds(Number(e.target.value))}
                                        className="w-full px-4 py-2.5 rounded-[4px] text-sm border border-parchment-card-border/30 bg-parchment-card-bg text-parchment-base-text focus:outline-none focus:border-parchment-base-text cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23433422%22%20d%3D%22M2%204l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center]"
                                    >
                                        {RETENTION_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {t(`createRoom.retentionOptions.${option.key}`)}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {gameManifest.setupOptions && Object.keys(gameManifest.setupOptions).length > 0 && (
                                    <div className="space-y-4">
                                        {Object.entries(gameManifest.setupOptions).map(([fieldKey, field]) => {
                                            const fieldValue = setupSelections[fieldKey];

                                            if (isSelectField(field)) {
                                                const selectedValue = typeof fieldValue === 'string'
                                                    ? fieldValue
                                                    : (field.default ?? field.options[0]?.value ?? '');
                                                return (
                                                    <div key={fieldKey}>
                                                        <label className="block text-sm font-bold text-parchment-base-text mb-2">
                                                            {resolveSetupLabel(field.labelKey)}
                                                        </label>
                                                        <select
                                                            value={selectedValue}
                                                            onChange={(e) => updateSelectField(fieldKey, e.target.value)}
                                                            className="w-full px-4 py-2.5 rounded-[4px] text-sm border border-parchment-card-border/30 bg-parchment-card-bg text-parchment-base-text focus:outline-none focus:border-parchment-base-text cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23433422%22%20d%3D%22M2%204l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center]"
                                                        >
                                                            {field.options.map((option) => (
                                                                <option key={option.value} value={option.value}>
                                                                    {resolveSetupLabel(option.labelKey)}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                );
                                            }

                                            if (!isMultiSelectField(field)) {
                                                return null;
                                            }

                                            const selectedValues = Array.isArray(fieldValue)
                                                ? fieldValue
                                                : [...(field.default ?? field.options.map((option) => option.value))];
                                            const isOpenField = openMultiSelectKey === fieldKey;
                                            const selectedOptions = field.options.filter((option) => selectedValues.includes(option.value));

                                            return (
                                                <div key={fieldKey} className="relative">
                                                    <div className="flex justify-between items-center mb-2 gap-3">
                                                        <label className="text-sm font-bold text-parchment-base-text">
                                                            {resolveSetupLabel(field.labelKey)}
                                                        </label>
                                                        <span className="text-xs text-parchment-light-text italic">
                                                            {selectedValues.length > 0
                                                                ? t('createRoom.multiSelectSelected', { count: selectedValues.length })
                                                                : t('createRoom.multiSelectNone')}
                                                        </span>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => setOpenMultiSelectKey(isOpenField ? null : fieldKey)}
                                                        className="w-full px-4 py-2.5 rounded-[4px] text-sm border border-parchment-card-border/30 bg-parchment-card-bg text-parchment-base-text hover:bg-parchment-base-bg transition-colors flex items-center justify-between cursor-pointer"
                                                        aria-expanded={isOpenField}
                                                        aria-controls={`setup-multi-${fieldKey}`}
                                                    >
                                                        <span>
                                                            {selectedValues.length > 0
                                                                ? t('createRoom.multiSelectButton', { count: selectedValues.length })
                                                                : t('createRoom.multiSelectPlaceholder')}
                                                        </span>
                                                        <ChevronDown
                                                            size={16}
                                                            className={`transition-transform ${isOpenField ? 'rotate-180' : ''}`}
                                                        />
                                                    </button>

                                                    {selectedOptions.length > 0 && (
                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            {selectedOptions.map((option) => (
                                                                <span
                                                                    key={option.value}
                                                                    className="inline-flex items-center gap-1 rounded-full border border-parchment-card-border/40 bg-parchment-base-bg px-3 py-1 text-xs font-bold text-parchment-base-text"
                                                                >
                                                                    <span>{resolveSetupLabel(option.labelKey)}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleMultiSelectFieldValue(fieldKey, option.value)}
                                                                        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-parchment-base-text/70 hover:bg-parchment-card-border/20 hover:text-parchment-base-text transition-colors cursor-pointer"
                                                                        aria-label={t('createRoom.removeSelectedOption', {
                                                                            label: resolveSetupLabel(option.labelKey),
                                                                        })}
                                                                    >
                                                                        <X size={12} />
                                                                    </button>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {isOpenField && (
                                                        <div
                                                            id={`setup-multi-${fieldKey}`}
                                                            className="mt-3 rounded-[6px] border border-parchment-card-border/30 bg-parchment-card-bg p-2 shadow-md"
                                                        >
                                                            <div className="flex flex-col gap-1">
                                                                {field.options.map((option) => {
                                                                    const checked = selectedValues.includes(option.value);
                                                                    return (
                                                                        <button
                                                                            key={option.value}
                                                                            type="button"
                                                                            onClick={() => toggleMultiSelectFieldValue(fieldKey, option.value)}
                                                                            className={`flex items-center justify-between rounded-[4px] px-3 py-2 text-sm transition-colors cursor-pointer ${
                                                                                checked
                                                                                    ? 'bg-parchment-base-bg text-parchment-base-text'
                                                                                    : 'text-parchment-light-text hover:bg-parchment-base-bg/70'
                                                                            }`}
                                                                        >
                                                                            <span>{resolveSetupLabel(option.labelKey)}</span>
                                                                            <span
                                                                                className={`inline-flex h-5 min-w-5 items-center justify-center rounded border text-[11px] font-black ${
                                                                                    checked
                                                                                        ? 'border-parchment-base-text bg-parchment-base-text text-parchment-card-bg'
                                                                                        : 'border-parchment-card-border/40 text-parchment-light-text'
                                                                                }`}
                                                                            >
                                                                                {checked ? '✓' : ''}
                                                                            </span>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* 按钮 */}
                            <div className="p-6 pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={isLoading}
                                    className="flex-1 py-2.5 px-4 bg-parchment-card-bg border border-parchment-card-border/30 text-parchment-base-text font-bold rounded-[4px] hover:bg-parchment-base-bg transition-all cursor-pointer disabled:opacity-50"
                                >
                                    {t('actions.cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirm}
                                    disabled={isLoading}
                                    className="flex-1 py-2.5 px-4 bg-parchment-base-text text-parchment-card-bg font-bold rounded-[4px] hover:bg-parchment-brown transition-all cursor-pointer disabled:opacity-50"
                                >
                                    {isLoading ? t('button.processing') : t('actions.confirm')}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
