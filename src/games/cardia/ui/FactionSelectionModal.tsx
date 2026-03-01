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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg border-2 border-purple-500 shadow-2xl max-w-2xl w-full mx-4">
                {/* 标题栏 */}
                <div className="px-6 py-4 border-b border-purple-500/30">
                    <h2 className="text-2xl font-bold text-yellow-400">{title}</h2>
                    <p className="text-sm text-gray-400 mt-1">
                        {t('selectFaction')}
                    </p>
                </div>
                
                {/* 派系选项 */}
                <div className="p-6">
                    <div className="grid grid-cols-2 gap-4">
                        {factions.map(faction => (
                            <button
                                key={faction.id}
                                onClick={() => onConfirm(faction.id)}
                                className={`relative bg-gradient-to-br ${faction.color} rounded-lg p-6 border-2 border-white/20 hover:border-yellow-400 hover:scale-105 transition-all shadow-lg`}
                            >
                                <div className="text-6xl mb-3">{faction.icon}</div>
                                <div className="text-white font-bold text-xl">
                                    {t(`factions.${faction.id}`)}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
                
                {/* 取消按钮 */}
                <div className="px-6 py-4 border-t border-purple-500/30">
                    <button
                        onClick={onCancel}
                        className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
                    >
                        {t('cancel')}
                    </button>
                </div>
            </div>
        </div>
    );
};
