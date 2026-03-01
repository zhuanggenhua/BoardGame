/**
 * 能力按钮组件
 * 
 * 显示失败方的能力按钮，包含能力名称和描述
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AbilityId } from '../domain/ids';

interface AbilityButtonProps {
    abilityId: AbilityId;
    onActivate: () => void;
    onSkip: () => void;
    disabled?: boolean;
}

export const AbilityButton: React.FC<AbilityButtonProps> = ({
    abilityId,
    onActivate,
    onSkip,
    disabled = false,
}) => {
    const { t } = useTranslation('game-cardia');
    
    // 将完整 ID 转换为简短格式（ability_i_mercenary_swordsman -> mercenary_swordsman）
    const shortId = abilityId.replace(/^ability_(i|ii)_/, '');
    
    // 从 i18n 获取能力名称和描述
    const abilityName = t(`abilities.${shortId}.name`, { defaultValue: shortId });
    const abilityDescription = t(`abilities.${shortId}.description`, { defaultValue: '' });
    
    return (
        <div className="bg-black/70 backdrop-blur-sm rounded-lg p-4 border-2 border-purple-500 shadow-lg max-w-md">
            {/* 标题 */}
            <div className="text-yellow-400 font-bold text-lg mb-2">
                ⚡ {t('abilityActivation')}
            </div>
            
            {/* 能力信息 */}
            <div className="mb-4">
                <div className="text-white font-semibold text-base mb-1">
                    {abilityName}
                </div>
                {abilityDescription && (
                    <div className="text-gray-300 text-sm leading-relaxed">
                        {abilityDescription}
                    </div>
                )}
            </div>
            
            {/* 操作按钮 */}
            <div className="flex gap-2">
                <button
                    data-testid="cardia-activate-ability-btn"
                    onClick={onActivate}
                    disabled={disabled}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                    {t('activate')}
                </button>
                <button
                    data-testid="cardia-skip-ability-btn"
                    onClick={onSkip}
                    disabled={disabled}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                    {t('skip')}
                </button>
            </div>
        </div>
    );
};
