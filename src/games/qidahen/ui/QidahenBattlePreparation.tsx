import { useTranslation } from 'react-i18next';
import type { QidahenPendingTargetAction } from '../domain/types';
import { QIDAHEN_REGION_BOUNDARY_TYPES } from './mapGraph';

interface Props {
    pending: QidahenPendingTargetAction;
    selectedTroops: number | undefined;
    showSelectionHint: boolean;
}

/** 战前只承接当前路径、选兵数量和已生效战术；选兵输入仍属于地图兵牌。 */
export function QidahenBattlePreparation({ pending, selectedTroops, showSelectionHint }: Props) {
    const { t } = useTranslation('game-qidahen');
    const boundary = QIDAHEN_REGION_BOUNDARY_TYPES.find(item => item.id === pending.attackBoundaryType);
    return (
        <section data-testid="qidahen-battle-preparation" className="space-y-3">
            <div className="flex items-center gap-3 text-[18px] font-black leading-6">
                <span>{pending.sourceRegionName}</span>
                <span aria-hidden="true" className="text-[#c9ae78]">→</span>
                <span>{pending.targetRegionName}</span>
            </div>
            <div className="grid grid-cols-2 gap-4 border-y border-[#d7ba81]/30 py-3">
                <div>
                    <div className="text-[12px] text-[#e5ceaa]">{t('board.actions.pendingTarget.selectedTroopsTitle')}</div>
                    <div className="mt-1 text-[20px] font-black leading-6" data-testid="qidahen-battle-committed-count">
                        {selectedTroops == null
                            ? t('board.actions.pendingTarget.chooseTroops')
                            : `${selectedTroops} / ${pending.sourceAvailableTroops}`}
                    </div>
                </div>
                <div>
                    <div className="text-[12px] text-[#e5ceaa]">{t('board.actions.pendingTarget.battleWidthTitle')}</div>
                    <div className="mt-1 text-[16px] font-black leading-6">
                        {boundary?.label} <span>{pending.battleWidth}</span>
                    </div>
                </div>
            </div>
            {showSelectionHint ? <div className="text-[14px] leading-5 text-[#f3d1a5]" data-testid="qidahen-pending-committed-troops">
                {t('board.actions.pendingTarget.selectSourceTroops', { region: pending.sourceRegionName })}
            </div> : null}
            {pending.tacticModifiers?.length ? (
                <div className="flex flex-wrap gap-2">
                    {pending.tacticModifiers.map(modifier => (
                        <span key={modifier.id} className="rounded border border-[#d7ba81]/50 px-2 py-1 text-[13px] text-[#ffe9b2]">
                            {modifier.label}{modifier.levelBonus !== 0 ? ` · ${t('board.actions.pendingTarget.tacticLevelBonus', { troop: t(`board.wheelRecruitTrain.${modifier.troopKind}`), bonus: modifier.levelBonus > 0 ? `+${modifier.levelBonus}` : modifier.levelBonus })}` : ''}
                        </span>
                    ))}
                </div>
            ) : null}
        </section>
    );
}
