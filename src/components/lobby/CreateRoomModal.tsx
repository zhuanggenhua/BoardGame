/**
 * 创建房间配置弹窗
 * 
 * 支持配置：
 * - 房间名称
 * - 游戏人数（从 manifest.playerOptions 读取）
 * - 房间保存时间（TTL）
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import type { GameManifestEntry } from '../../games/manifest.types';

/** 保存时间选项（秒） */
const RETENTION_OPTIONS = [
    { value: 0, key: 'none' },           // 不保存
    { value: 86400, key: '1day' },        // 1 天
    { value: 259200, key: '3days' },      // 3 天
    { value: 604800, key: '7days' },      // 7 天
] as const;

export interface RoomConfig {
    roomName: string;
    numPlayers: number;
    ttlSeconds: number;
}

interface CreateRoomModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (config: RoomConfig) => void;
    gameManifest: GameManifestEntry;
    isLoading?: boolean;
}

export const CreateRoomModal = ({
    isOpen,
    onClose,
    onConfirm,
    gameManifest,
    isLoading = false,
}: CreateRoomModalProps) => {
    const { t } = useTranslation('lobby');
    
    // 人数选项：从 manifest 读取，默认 [2]
    const playerOptions = gameManifest.playerOptions ?? [2];
    const hasPlayerOptions = playerOptions.length > 1;
    
    // 状态
    const [roomName, setRoomName] = useState('');
    const [numPlayers, setNumPlayers] = useState(playerOptions[0]);
    const [ttlSeconds, setTtlSeconds] = useState(0);

    const handleConfirm = () => {
        onConfirm({ roomName: roomName.trim(), numPlayers, ttlSeconds });
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
                    {/* 背景遮罩 */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={handleBackdropClick}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[3000]"
                    />
                    
                    {/* 弹窗内容 */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="fixed inset-0 flex items-center justify-center p-4 sm:p-8 z-[3001] pointer-events-none"
                    >
                        <div 
                            className="bg-[#fcfbf9] pointer-events-auto w-full max-w-md rounded-sm shadow-[0_10px_40px_rgba(67,52,34,0.15)] border border-[#e5e0d0] relative overflow-hidden font-serif"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* 装饰性边角 */}
                            <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-[#c0a080]" />
                            <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-[#c0a080]" />
                            <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-[#c0a080]" />
                            <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-[#c0a080]" />

                            {/* 标题 */}
                            <div className="p-6 pb-4">
                                <h2 className="text-xl font-bold text-[#433422] tracking-wide text-center">
                                    {t('createRoom.title')}
                                </h2>
                            </div>

                            {/* 配置选项 */}
                            <div className="p-6 space-y-5">
                                {/* 房间名称 */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-bold text-[#433422]">
                                            {t('createRoom.roomName')}
                                        </label>
                                        <span className="text-xs text-[#8c7b64] italic">
                                            {t('createRoom.roomNameHint')}
                                        </span>
                                    </div>
                                    <input
                                        type="text"
                                        value={roomName}
                                        onChange={(e) => setRoomName(e.target.value)}
                                        placeholder={t('createRoom.roomNamePlaceholder')}
                                        maxLength={20}
                                        className="w-full px-4 py-2.5 rounded-[4px] text-sm border border-[#e5e0d0] bg-[#fcfbf9] text-[#433422] placeholder:text-[#8c7b64]/50 focus:outline-none focus:border-[#c0a080]"
                                    />
                                </div>

                                {/* 游戏人数 */}
                                {hasPlayerOptions && (
                                    <div>
                                        <label className="block text-sm font-bold text-[#433422] mb-2">
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
                                                            ? 'bg-[#433422] text-[#fcfbf9] border-[#433422]'
                                                            : 'bg-[#fcfbf9] text-[#433422] border-[#e5e0d0] hover:bg-[#f3f0e6]'
                                                        }
                                                    `}
                                                >
                                                    {t('createRoom.playerCountUnit', { count })}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 房间保存时间 - 下拉框 */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-bold text-[#433422]">
                                            {t('createRoom.retention')}
                                        </label>
                                        <span className="text-xs text-[#8c7b64] italic">
                                            {t('createRoom.retentionHint')}
                                        </span>
                                    </div>
                                    <select
                                        value={ttlSeconds}
                                        onChange={(e) => setTtlSeconds(Number(e.target.value))}
                                        className="w-full px-4 py-2.5 rounded-[4px] text-sm border border-[#e5e0d0] bg-[#fcfbf9] text-[#433422] focus:outline-none focus:border-[#c0a080] cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23433422%22%20d%3D%22M2%204l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center]"
                                    >
                                        {RETENTION_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {t(`createRoom.retentionOptions.${option.key}`)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* 按钮 */}
                            <div className="p-6 pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={isLoading}
                                    className="flex-1 py-2.5 px-4 bg-[#fcfbf9] border border-[#e5e0d0] text-[#433422] font-bold rounded-[4px] hover:bg-[#f3f0e6] transition-all cursor-pointer disabled:opacity-50"
                                >
                                    {t('actions.cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirm}
                                    disabled={isLoading}
                                    className="flex-1 py-2.5 px-4 bg-[#433422] text-[#fcfbf9] font-bold rounded-[4px] hover:bg-[#2b2114] transition-all cursor-pointer disabled:opacity-50"
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
