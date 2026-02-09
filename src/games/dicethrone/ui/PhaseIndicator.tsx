import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TurnPhase } from '../types';
import { InfoTooltip } from '../../../components/common/overlays/InfoTooltip';
import { PhaseIndicatorSkeleton } from '../../../components/game/framework';
import type { PhaseInfo } from '../../../core/ui';
import { resolveI18nList, type TranslateFn } from './utils';

/** 构建阶段信息列表 */
const buildPhases = (t: TranslateFn): Array<PhaseInfo & { desc: string[] }> => {
    const phaseOrder: TurnPhase[] = ['upkeep', 'income', 'main1', 'offensiveRoll', 'defensiveRoll', 'main2', 'discard'];
    return phaseOrder.map(pid => ({
        id: pid,
        label: t(`phase.${pid}.label`) as string,
        desc: resolveI18nList(t(`phase.${pid}.desc`, { returnObjects: true })),
    }));
};

export const PhaseIndicator = ({ currentPhase }: { currentPhase: TurnPhase }) => {
    const { t } = useTranslation('game-dicethrone');
    const phases = React.useMemo(() => buildPhases(t), [t]);
    const [hoveredPhaseId, setHoveredPhaseId] = React.useState<string | null>(null);

    return (
        <div
            className="flex flex-col gap-[0.4vw] pointer-events-auto opacity-100 w-full z-[80]"
            data-tutorial-id="phase-indicator"
        >
            <h3 className="text-[1.0vw] font-black text-slate-300/80 mb-[0.4vw] ml-[0.3vw] tracking-[0.2em] uppercase truncate drop-shadow-md">
                {t('phase.title')}
            </h3>
            <PhaseIndicatorSkeleton
                phases={phases}
                currentPhaseId={currentPhase}
                orientation="vertical"
                className="flex flex-col gap-[0.4vw]"
                renderPhaseItem={(phase, isActive) => {
                    const phaseWithDesc = phase as PhaseInfo & { desc: string[] };
                    const isHovered = hoveredPhaseId === phase.id;
                    return (
                        <div
                            className="relative group/phase"
                            onMouseEnter={() => setHoveredPhaseId(phase.id)}
                            onMouseLeave={() => setHoveredPhaseId(null)}
                        >
                            <div
                                className={`
                                    relative z-10 px-[0.8vw] py-[0.5vw] text-[0.75vw] font-bold rounded-r-[0.6vw] transition-[all] duration-300 border-l-[0.3vw] truncate cursor-help
                                    ${isActive
                                        ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white border-amber-400 translate-x-[0.5vw] shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                                        : 'bg-slate-900/60 text-slate-400 border-slate-700/50 backdrop-blur-sm hover:bg-slate-800/80 hover:text-slate-200 hover:border-slate-500'}
                                `}
                            >
                                {phase.label}
                            </div>
                            <InfoTooltip
                                title={phase.label}
                                content={phaseWithDesc.desc}
                                isVisible={isHovered}
                                position="right"
                            />
                        </div>
                    );
                }}
            />
        </div>
    );
};
