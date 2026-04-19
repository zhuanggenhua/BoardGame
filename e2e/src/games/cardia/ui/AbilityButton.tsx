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
    let shortId = abilityId.replace(/^ability_(i|ii)_/, '');
    
    // 特殊映射：处理能力 ID 与 i18n key 不一致的情况
    const abilityNameMap: Record<string, string> = {
        'magistrate': 'judge', // 审判官的 i18n key 是 judge
    };
    shortId = abilityNameMap[shortId] || shortId;
    
    // 从 i18n 获取能力名称和描述
    const abilityName = t(`abilities.${shortId}.name`, { defaultValue: shortId });
    const abilityDescription = t(`abilities.${shortId}.description`, { defaultValue: '' });
    
    return (
        <div className="w-[min(92vw,28rem)] rounded-xl border-2 border-purple-500 bg-black/75 p-4 shadow-lg backdrop-blur-md sm:p-5">
            {/* 标题 */}
            <div className="mb-2 text-base font-bold text-yellow-400 sm:text-lg">
                ⚡ {t('abilityActivation')}
            </div>
            
            {/* 能力信息 */}
            <div className="mb-4">
                <div className="mb-1 text-base font-semibold text-white">
                    {abilityName}
                </div>
                {abilityDescription && (
                    <div className="text-sm leading-relaxed text-gray-200">
                        {abilityDescription}
                    </div>
                )}
            </div>
            
            {/* 操作按钮 */}
            <div className="flex flex-col gap-2 sm:flex-row">
                <button
                    data-testid="cardia-activate-ability-btn"
                    data-tutorial-id="cardia-activate-ability-btn"
                    onClick={onActivate}
                    disabled={disabled}
                    className="flex-1 rounded-lg bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-600 sm:text-base"
                >
                    {t('activate')}
                </button>
                <button
                    data-testid="cardia-skip-ability-btn"
                    onClick={onSkip}
                    disabled={disabled}
                    className="flex-1 rounded-lg bg-gray-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-500 sm:text-base"
                >
                    {t('skip')}
                </button>
            </div>
        </div>
    );
};
