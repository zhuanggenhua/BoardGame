import { useTranslation } from 'react-i18next';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import type { QidahenMapToken, QidahenPiece } from '../domain/types';
import { buildDispatchGroups, QIDAHEN_DISPATCH_ROSTER_ID } from './dispatchGroupSelection';
import type { useQidahenTurnInput } from './useQidahenTurnInput';

type Props = {
    input: ReturnType<typeof useQidahenTurnInput>;
    regionName: string;
    tokens: readonly QidahenMapToken[];
    pieces: readonly QidahenPiece[];
    trainedIds: readonly string[];
    recommendedIds?: readonly string[];
};

export function QidahenDispatchRoster({ input, regionName, tokens, pieces, trainedIds, recommendedIds }: Props) {
    const { t } = useTranslation('game-qidahen');
    const eligible = new Set(input.dispatchEligiblePieceIds);
    const grouped = buildDispatchGroups(tokens, pieces, eligible, new Set(trainedIds));
    const groupByToken = new Map(grouped.map(group => [group.tokenId, group.pieceIds]));
    const hidden = new Set(grouped.flatMap(group => group.pieceIds.slice(1)));
    return <>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[80] bg-black/45" />
        <section aria-labelledby="qidahen-dispatch-title" data-testid={QIDAHEN_DISPATCH_ROSTER_ID} data-tutorial-id={QIDAHEN_DISPATCH_ROSTER_ID}
        className="pointer-events-auto absolute left-1/2 top-[44%] z-[85] w-max max-w-[min(720px,68%)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[#b48c58] bg-[#39291e] text-[#fff0d2] shadow-2xl">
        <h2 id="qidahen-dispatch-title" className="border-b border-[#bd9860]/35 px-5 py-3 text-xl font-black">
            {regionName} <span className="font-semibold text-[#e1c798]">· {t('board.actions.pendingTarget.selectedTroopsTitle')}</span>
        </h2>
        <div className="flex max-h-[320px] flex-wrap justify-center gap-x-3 gap-y-4 overflow-auto px-5 py-4">
            {tokens.filter(token => token.type === 'army' && token.pieceId && eligible.has(token.pieceId) && !hidden.has(token.pieceId))
                .map(token => {
                    const ids = groupByToken.get(token.id) ?? [token.pieceId!];
                    const count = ids.filter(id => input.selectedIds.includes(id)).length;
                    const recommended = ids.some(id => recommendedIds?.includes(id));
                    const kind = token.troopKind ? t(`board.wheelRecruitTrain.${token.troopKind}`) : regionName;
                    const change = (next: number) => input.setGroupCount(ids, next);
                    const multi = ids.length > 1;
                    return <div key={token.id} className="flex w-[100px] flex-col items-center gap-2"
                        data-testid={`qidahen-dispatch-unit-${token.id}`} data-piece-ids={ids.join(' ')}
                        data-qidahen-dispatch-selected={count}
                        data-qidahen-dispatch-recommended={recommended ? 'true' : undefined}>
                        <button type="button" aria-label={kind} aria-pressed={count > 0}
                            data-testid={`qidahen-dispatch-pick-${token.id}`}
                            onClick={() => change(multi ? Math.min(count + 1, ids.length) : 1 - count)}
                            className={`grid size-[92px] place-items-center rounded-lg border-2 p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${count ? 'border-[#ffe485] bg-[#7b572a] ring-2 ring-[#ffe485]' : recommended ? 'border-[#cae0a9] bg-[#4a3828]' : 'border-[#9aa984] bg-[#4a3828] hover:border-[#d3e0bc]'}`}>
                            {token.imageSrc ? <OptimizedImage src={token.imageSrc} alt="" placeholder={false} draggable={false}
                                className="size-[78px] rounded-md object-contain" style={{ transform: `rotate(${token.rotationDeg ?? 0}deg)` }} /> : kind}
                        </button>
                        {multi ? <div className="grid h-8 grid-cols-[24px_32px_24px] items-center text-center text-sm font-bold tabular-nums">
                            <button type="button" aria-label={t('board.map.decreaseDispatch')} disabled={count === 0} onClick={() => change(count - 1)}
                                className="h-8 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30">−</button>
                            <span aria-label={t('board.map.dispatchCount', { count, total: ids.length })}>{count}/{ids.length}</span>
                            <button type="button" aria-label={t('board.map.increaseDispatch')} disabled={count === ids.length} onClick={() => change(count + 1)}
                                className="h-8 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30">+</button>
                        </div> : null}
                    </div>;
                })}
        </div>
        <footer className="flex items-center justify-between gap-4 border-t border-[#bd9860]/35 px-5 py-3">
            <span aria-live="polite" className="text-sm text-[#e1c798]">{t('board.turnChoice.selectedTroops', { units: input.selectedPieceIds.length })}</span>
            <button type="button" data-testid="qidahen-turn-confirm" data-tutorial-id="qidahen-turn-confirm"
                disabled={!input.canConfirm} onClick={input.confirm}
                className="min-h-11 rounded border border-[#ffe49b] bg-[#e3ce9e] px-4 font-bold text-[#342612] disabled:opacity-40">
                {t('board.turnChoice.chooseDispatchTarget')}
            </button>
        </footer>
    </section></>;
}
