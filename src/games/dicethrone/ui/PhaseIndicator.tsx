import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TurnPhase } from '../types';
import { InfoTooltip } from '../../../components/common/overlays/InfoTooltip';
import { PhaseIndicatorSkeleton } from '../../../components/game/framework';
import type { PhaseInfo } from '../../../core/ui';
import { UI_Z_INDEX } from '../../../core';
import { resolveI18nList, type TranslateFn } from './utils';
import { useCoarsePointer } from '../../../hooks/ui/useCoarsePointer';
import './PhaseIndicator.css';

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
    const isCoarsePointer = useCoarsePointer();
    const [hoveredPhaseId, setHoveredPhaseId] = React.useState<string | null>(null);
    const [selectedPhaseState, setSelectedPhaseState] = React.useState<{
        scope: string;
        id: TurnPhase;
    } | null>(null);
    const selectionScope = `${currentPhase}:${isCoarsePointer ? 'coarse' : 'fine'}`;
    const selectedPhaseId = selectedPhaseState?.scope === selectionScope ? selectedPhaseState.id : null;

    return (
        <div
            className="dt-phase-indicator flex flex-col pointer-events-auto opacity-100 w-full"
            style={{ zIndex: UI_Z_INDEX.hud }}
            data-testid="dt-phase-indicator"
            data-tutorial-id="phase-indicator"
        >
            <h3
                className="dt-phase-indicator__title font-black text-slate-300/80 tracking-[0.2em] uppercase truncate drop-shadow-md"
            >
                {t('phase.title')}
            </h3>
            <PhaseIndicatorSkeleton
                phases={phases}
                currentPhaseId={currentPhase}
                orientation="vertical"
                className="dt-phase-indicator__list flex flex-col"
                renderPhaseItem={(phase, isActive) => {
                    const phaseWithDesc = phase as PhaseInfo & { desc: string[] };
                    const isHovered = hoveredPhaseId === phase.id;
                    const isSelected = selectedPhaseId === phase.id;
                    const isTooltipVisible = isCoarsePointer ? isSelected : isHovered;
                    return (
                        <div
                            className="relative group/phase"
                            onMouseEnter={() => {
                                if (!isCoarsePointer) setHoveredPhaseId(phase.id);
                            }}
                            onMouseLeave={() => {
                                if (!isCoarsePointer) setHoveredPhaseId(null);
                            }}
                        >
                            <div
                                data-testid={isActive ? 'dt-active-phase-indicator' : undefined}
                                data-dt-phase-item="true"
                                data-dt-phase-active={isActive ? 'true' : 'false'}
                                role={isCoarsePointer ? 'button' : undefined}
                                tabIndex={isCoarsePointer ? 0 : undefined}
                                aria-expanded={isCoarsePointer ? isSelected : undefined}
                                onClick={() => {
                                    if (!isCoarsePointer) return;
                                    setSelectedPhaseState((previous) => (
                                        previous?.scope === selectionScope && previous.id === phase.id
                                            ? null
                                            : { scope: selectionScope, id: phase.id }
                                    ));
                                }}
                                onKeyDown={(event) => {
                                    if (!isCoarsePointer || (event.key !== 'Enter' && event.key !== ' ')) return;
                                    event.preventDefault();
                                    setSelectedPhaseState({ scope: selectionScope, id: phase.id });
                                }}
                                className={`
                                    relative z-10 font-bold transition-[all] duration-300 truncate cursor-help
                                    ${isCoarsePointer ? 'cursor-pointer' : ''}
                                    ${isActive
                                        ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                                        : 'bg-slate-900/60 text-slate-400 border-slate-700/50 backdrop-blur-sm hover:bg-slate-800/80 hover:text-slate-200 hover:border-slate-500'}
                                `}
                            >
                                {phase.label}
                            </div>
                            <InfoTooltip
                                title={phase.label}
                                content={phaseWithDesc.desc}
                                isVisible={isTooltipVisible}
                                position="right"
                            />
                        </div>
                    );
                }}
            />
        </div>
    );
};
