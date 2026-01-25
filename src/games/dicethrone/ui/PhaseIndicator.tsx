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
        desc: resolveI18nList(t(`phase.${pid}.desc`, { returnObjects: true, defaultValue: [] })),
    }));
};

export const PhaseIndicator = ({ currentPhase }: { currentPhase: TurnPhase }) => {
    const { t } = useTranslation('game-dicethrone');
    const phases = React.useMemo(() => buildPhases(t), [t]);
    const [hoveredPhaseId, setHoveredPhaseId] = React.useState<string | null>(null);

    return (
        <div className="flex flex-col gap-[0.4vw] pointer-events-auto opacity-90 w-full z-[80]">
            <h3 className="text-[1.2vw] font-black text-slate-400 mb-[0.4vw] tracking-widest uppercase truncate">
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
                                    relative z-10 px-[0.8vw] py-[0.4vw] text-[0.8vw] font-bold rounded-r-[0.5vw] transition-[transform,background-color,color,box-shadow] duration-300 border-l-[0.3vw] truncate cursor-help
                                    ${isActive
                                        ? 'bg-amber-600 text-white border-amber-300 translate-x-[0.5vw] shadow-[0_0_1vw_rgba(245,158,11,0.5)]'
                                        : 'bg-black/40 text-slate-500 border-slate-700 hover:bg-slate-800 hover:text-slate-300'}
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
