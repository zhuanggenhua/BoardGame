/**
 * 多技能选择弹窗
 *
 * 当进攻阶段确认骰面后，多个不同 slot 的技能同时满足条件时弹出，
 * 让玩家明确选择要发动哪个技能。
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { GameModal } from './components/GameModal';
import { GameButton } from './components/GameButton';

export interface AbilityChoiceOption {
    /** 要 dispatch 的 abilityId（变体 ID 或基础 ID） */
    abilityId: string;
    /** 技能名称 i18n key（如 abilities.kidney-shot-2.name） */
    name: string;
    /** 技能描述 i18n key */
    description?: string;
    /** 所属 slot ID（用于去重） */
    slotId: string;
}

interface AbilityChoiceModalProps {
    isOpen: boolean;
    options: AbilityChoiceOption[];
    onSelect: (abilityId: string) => void;
    onSkip: () => void;
}

export const AbilityChoiceModal: React.FC<AbilityChoiceModalProps> = ({
    isOpen,
    options,
    onSelect,
    onSkip,
}) => {
    const { t } = useTranslation('game-dicethrone');

    return (
        <GameModal
            isOpen={isOpen}
            title={t('abilityChoice.title')}
            width="md"
            closeOnBackdrop={false}
        >
            <p className="text-sm text-slate-400 mb-4">
                {t('abilityChoice.description')}
            </p>
            <div className="flex flex-col gap-2">
                {options.map((opt) => (
                    <button
                        key={opt.abilityId}
                        className="w-full text-left px-4 py-3 rounded-xl border border-amber-500/30
                            bg-slate-800/80 hover:bg-amber-500/20 hover:border-amber-400/60
                            transition-all duration-150 cursor-pointer group"
                        onClick={() => onSelect(opt.abilityId)}
                    >
                        <div className="font-bold text-amber-300 group-hover:text-amber-200 text-base">
                            {t(opt.name)}
                        </div>
                        {opt.description && (
                            <div className="text-xs text-slate-400 group-hover:text-slate-300 mt-1 line-clamp-2">
                                {t(opt.description)}
                            </div>
                        )}
                    </button>
                ))}
            </div>
            <div className="mt-4 flex justify-end">
                <GameButton
                    variant="ghost"
                    size="sm"
                    onClick={onSkip}
                >
                    {t('abilityChoice.skip')}
                </GameButton>
            </div>
        </GameModal>
    );
};
