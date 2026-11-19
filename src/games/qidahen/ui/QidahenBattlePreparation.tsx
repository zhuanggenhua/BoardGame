import { useTranslation } from 'react-i18next';
import type { QidahenCore, QidahenPendingTargetAction } from '../domain/types';
import { getPendingActionDefenderForceSnapshot, resolvePendingBattleMode } from '../domain/battleState';
import { expandSpecialTroopStacksToCompatPieces } from '../domain/troopCompat';
import { QIDAHEN_REGION_BOUNDARY_TYPES } from './mapGraph';
import { QidahenBattleRoster } from './QidahenBattleRoster';
import { QIDAHEN_FACTION_MARKER_ASSET } from './factionSelectionCopy';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';

interface Props {
    pending: QidahenPendingTargetAction;
    selectedTroops: number | undefined;
    showSelectionHint: boolean;
    battlefield?: Pick<QidahenCore, 'factions' | 'mapTokens' | 'regions'>;
}

/** 只展示已投入的攻方和战场所属守方；没有把留守军当成参战军。 */
export function QidahenBattlePreparation({ pending, selectedTroops, showSelectionHint, battlefield }: Props) {
    const { t } = useTranslation('game-qidahen');
    const boundary = QIDAHEN_REGION_BOUNDARY_TYPES.find(item => item.id === pending.attackBoundaryType);
    const committed = pending.forceCommitments?.flatMap(force => force.selectedSpecialPieceIds ?? []) ?? [];
    const target = battlefield?.regions.find(region => !region.isLogicalRegion && region.id === pending.targetRuntimeRegionId);
    const defending = target && battlefield ? expandSpecialTroopStacksToCompatPieces(getPendingActionDefenderForceSnapshot(target, pending,
        resolvePendingBattleMode(pending, target, { defenderSortieBattle: Boolean(pending.defenderDeclaration?.defenderSortieBattle),
            defenderHoldCity: Boolean(pending.defenderDeclaration?.defenderHoldCity) })).specialTroops) : [];
    const tokens = battlefield?.mapTokens.filter(token => token.type === 'army' && token.pieceId && token.imageSrc);
    return (
        <section data-testid="qidahen-battle-preparation" className="space-y-3">
            <div className="flex items-center gap-3 text-[18px] font-black leading-6">
                <span>{pending.sourceRegionName}</span>
                <span aria-hidden="true" className="text-[#c9ae78]">→</span>
                <span>{pending.targetRegionName}</span>
            </div>
            {battlefield && tokens ? <div className="grid grid-cols-2 gap-4 border-t border-[#d7ba81]/30 pt-2">
                {(['attacker', 'defender'] as const).map(side => {
                    const factionId = side === 'attacker' ? pending.attackerFactionId : pending.defenderFactionId;
                    const ids = new Set(side === 'attacker' ? committed : defending.map(piece => piece.id));
                    return <div key={side} className="min-w-0">
                        <div className="flex items-center justify-center gap-1.5 text-sm font-bold">
                            {factionId !== 'neutral' ? <OptimizedImage src={QIDAHEN_FACTION_MARKER_ASSET[factionId]} alt=""
                                className="size-5 object-contain [clip-path:circle(48%)]" placeholder={false} /> : null}
                            {t('board.battleRoll.sideOwner', { faction: factionId === 'neutral' ? pending.defenderLabel : battlefield.factions[factionId].name, role: t(`board.battleRoll.${side}`) })}
                        </div>
                        <QidahenBattleRoster side={side} tokens={tokens.filter(token => ids.has(token.pieceId!))} />
                    </div>;
                })}
            </div> : null}
            <div className={`grid ${battlefield ? 'grid-cols-1' : 'grid-cols-2'} gap-4 border-y border-[#d7ba81]/30 py-3`}>
                {!battlefield ? <div>
                    <div className="text-[12px] text-[#e5ceaa]">{t('board.actions.pendingTarget.selectedTroopsTitle')}</div>
                    <div className="mt-1 text-[20px] font-black leading-6" data-testid="qidahen-battle-committed-count">
                        {selectedTroops == null
                            ? t('board.actions.pendingTarget.chooseTroops')
                            : `${selectedTroops} / ${pending.sourceAvailableTroops}`}
                    </div>
                </div> : null}
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
