import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TurnPhase } from '../types';
import { InfoTooltip } from '../../../components/common/overlays/InfoTooltip';
import { resolveI18nList, type TranslateFn } from './utils';

const getPhaseInfo = (t: TranslateFn): Record<TurnPhase, { label: string; desc: string[] }> => ({
    setup: { label: t('phase.setup.label') as string, desc: [] },
    upkeep: {
        label: t('phase.upkeep.label') as string,
        desc: resolveI18nList(t('phase.upkeep.desc', { returnObjects: true, defaultValue: [] })),
    },
    income: {
        label: t('phase.income.label') as string,
        desc: resolveI18nList(t('phase.income.desc', { returnObjects: true, defaultValue: [] })),
    },
    main1: {
        label: t('phase.main1.label') as string,
        desc: resolveI18nList(t('phase.main1.desc', { returnObjects: true, defaultValue: [] })),
    },
    offensiveRoll: {
        label: t('phase.offensiveRoll.label') as string,
        desc: resolveI18nList(t('phase.offensiveRoll.desc', { returnObjects: true, defaultValue: [] })),
    },
    defensiveRoll: {
        label: t('phase.defensiveRoll.label') as string,
        desc: resolveI18nList(t('phase.defensiveRoll.desc', { returnObjects: true, defaultValue: [] })),
    },
    main2: {
        label: t('phase.main2.label') as string,
        desc: resolveI18nList(t('phase.main2.desc', { returnObjects: true, defaultValue: [] })),
    },
    discard: {
        label: t('phase.discard.label') as string,
        desc: resolveI18nList(t('phase.discard.desc', { returnObjects: true, defaultValue: [] })),
    },
});

export const PhaseIndicator = ({ currentPhase }: { currentPhase: TurnPhase }) => {
    const { t } = useTranslation('game-dicethrone');
    const phaseInfo = React.useMemo(() => getPhaseInfo(t), [t]);
    const phaseOrder: TurnPhase[] = ['upkeep', 'income', 'main1', 'offensiveRoll', 'defensiveRoll', 'main2', 'discard'];
    const [hoveredPhase, setHoveredPhase] = React.useState<TurnPhase | null>(null);

    return (
        <div className="flex flex-col gap-[0.4vw] pointer-events-auto opacity-90 w-full z-[80]">
            <h3 className="text-[1.2vw] font-black text-slate-400 mb-[0.4vw] tracking-widest uppercase truncate">{t('phase.title')}</h3>
            {phaseOrder.map(pid => {
                const info = phaseInfo[pid];
                const isActive = currentPhase === pid;
                const isHovered = hoveredPhase === pid;

                return (
                    <div
                        key={pid}
                        className="relative group/phase"
                        onMouseEnter={() => setHoveredPhase(pid)}
                        onMouseLeave={() => setHoveredPhase(null)}
                    >
                        <div
                            className={`
                                relative z-10 px-[0.8vw] py-[0.4vw] text-[0.8vw] font-bold rounded-r-[0.5vw] transition-all duration-300 border-l-[0.3vw] truncate cursor-help
                                ${isActive
                                    ? 'bg-amber-600 text-white border-amber-300 translate-x-[0.5vw] shadow-[0_0_1vw_rgba(245,158,11,0.5)]'
                                    : 'bg-black/40 text-slate-500 border-slate-700 hover:bg-slate-800 hover:text-slate-300'}
                            `}
                        >
                            {info.label}
                        </div>

                        <InfoTooltip
                            title={info.label}
                            content={info.desc}
                            isVisible={isHovered}
                            position="right"
                        />
                    </div>
                );
            })}
        </div>
    );
};
