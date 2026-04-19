/**
 * 派系选择弹窗组件
 * 
 * 用于能力执行时选择派系
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { FactionId } from '../domain/ids';
import { FACTION_IDS } from '../domain/ids';

interface FactionSelectionModalProps {
    title: string;
    onConfirm: (factionId: FactionId) => void;
    onCancel: () => void;
}

export const FactionSelectionModal: React.FC<FactionSelectionModalProps> = ({
    title,
    onConfirm,
    onCancel,
}) => {
    const { t } = useTranslation('game-cardia');
    
    const factions: Array<{ id: FactionId; icon: string; color: string }> = [
        { id: FACTION_IDS.SWAMP, icon: '🌿', color: 'from-green-600 to-green-800' },
        { id: FACTION_IDS.ACADEMY, icon: '📚', color: 'from-yellow-600 to-yellow-800' },
        { id: FACTION_IDS.GUILD, icon: '⚙️', color: 'from-red-600 to-red-800' },
        { id: FACTION_IDS.DYNASTY, icon: '👑', color: 'from-blue-600 to-blue-800' },
    ];
    
    return (
        <div
            data-testid="faction-selection-modal"
            className="fixed inset-0 z-[300] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-4"
        >
            <div className="max-h-[86vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border-2 border-purple-500 bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl sm:rounded-lg">
                {/* 标题栏 */}
                <div className="border-b border-purple-500/30 px-4 py-3 sm:px-6 sm:py-4">
                    <h2 className="text-xl font-bold text-yellow-400 sm:text-2xl">{title}</h2>
                    <p className="mt-1 text-sm text-gray-400">
                        {t('selectFaction')}
                    </p>
                </div>
                
                {/* 派系选项 */}
                <div className="p-4 sm:p-6">
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        {factions.map(faction => (
                            <button
                                key={faction.id}
                                data-testid={`faction-option-${faction.id}`}
                                onClick={() => onConfirm(faction.id)}
                                className={`relative rounded-xl border-2 border-white/20 bg-gradient-to-br ${faction.color} p-4 shadow-lg transition-all hover:scale-[1.02] hover:border-yellow-400 sm:p-6`}
                            >
                                <div className="mb-2 text-4xl sm:mb-3 sm:text-6xl">{faction.icon}</div>
                                <div className="text-base font-bold text-white sm:text-xl">
                                    {t(`factions.${faction.id}`)}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
                
                {/* 取消按钮 */}
                <div className="border-t border-purple-500/30 px-4 py-3 sm:px-6 sm:py-4">
                    <button
                        onClick={onCancel}
                        className="w-full rounded-lg bg-gray-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-700 sm:text-base"
                    >
                        {t('cancel')}
                    </button>
                </div>
            </div>
        </div>
    );
};
