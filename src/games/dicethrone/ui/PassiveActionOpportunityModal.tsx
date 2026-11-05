import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import type { PassiveAbilityDef, PassiveActionDef } from '../domain/passiveAbility';
import { getPassiveActionTokenCosts } from '../domain/passiveAbility';
import { GameModal } from './components/GameModal';
import { GameButton } from './components/GameButton';

export interface PassiveActionOpportunity {
    passive: PassiveAbilityDef;
    action: PassiveActionDef;
    actionIndex: number;
    resolvedDamage: number;
}

interface PassiveActionOpportunityModalProps {
    opportunity: PassiveActionOpportunity;
    canUse: boolean;
    canSkip: boolean;
    onUse: () => void;
    onSkip: () => void;
}

export const PassiveActionOpportunityModal: React.FC<PassiveActionOpportunityModalProps> = ({
    opportunity,
    canUse,
    canSkip,
    onUse,
    onSkip,
}) => {
    const { t } = useTranslation('game-dicethrone');
    const actionLabel = t(opportunity.action.labelKey ?? opportunity.action.descriptionKey);
    const actionDescription = t(opportunity.action.descriptionKey);
    const abilityName = t(opportunity.passive.nameKey);
    const tokenCostLabel = getPassiveActionTokenCosts(opportunity.action)
        .map((cost) => `${cost.amount} ${t(`tokens.${cost.tokenId}.name`)}`)
        .join(' + ');
    const cpCostLabel = opportunity.action.cpCost > 0 ? `${opportunity.action.cpCost} CP` : '';
    const costLabel = [cpCostLabel, tokenCostLabel].filter(Boolean).join(' + ');
    const resolvedDamage = Math.max(0, opportunity.resolvedDamage);

    return (
        <GameModal
            isOpen
            title={t('passiveOpportunity.title', { abilityName })}
            width="md"
            closeOnBackdrop={false}
            footer={
                <>
                    <GameButton
                        variant="secondary"
                        onClick={onSkip}
                        disabled={!canSkip}
                        className="flex-1"
                        data-testid="dicethrone-passive-opportunity-skip-button"
                    >
                        {t('passiveOpportunity.skip')}
                    </GameButton>
                    <GameButton
                        variant="primary"
                        onClick={onUse}
                        disabled={!canUse}
                        className="flex-1"
                        icon={<Sparkles aria-hidden="true" className="h-4 w-4" />}
                        data-testid="dicethrone-passive-opportunity-use-button"
                    >
                        {t('passiveOpportunity.use', { actionLabel })}
                    </GameButton>
                </>
            }
        >
            <div
                className="flex w-full flex-col items-center gap-4"
                data-testid="dicethrone-passive-opportunity-modal"
            >
                <div className="rounded-full border border-rose-300/60 bg-rose-950/80 px-4 py-1 text-xs font-black uppercase tracking-wider text-rose-100">
                    {t('passiveOpportunity.badge')}
                </div>
                <p className="max-w-md text-base font-medium leading-relaxed text-slate-200">
                    {t('passiveOpportunity.description', {
                        damage: resolvedDamage,
                        actionLabel,
                    })}
                </p>
                <div className="grid w-full grid-cols-2 gap-3 text-left">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            {t('passiveOpportunity.damageLabel')}
                        </div>
                        <div className="mt-1 text-lg font-black text-rose-200">
                            {t('passiveOpportunity.damageValue', { damage: resolvedDamage })}
                        </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            {t('passiveOpportunity.costLabel')}
                        </div>
                        <div className="mt-1 text-lg font-black text-amber-200">
                            {costLabel || t('passiveOpportunity.noCost')}
                        </div>
                    </div>
                </div>
                <p className="text-sm leading-relaxed text-slate-400">
                    {actionDescription}
                </p>
            </div>
        </GameModal>
    );
};
