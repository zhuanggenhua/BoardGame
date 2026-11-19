import { useTranslation } from 'react-i18next';
import { QidahenArmyBlock } from './QidahenArmyBlock';
import { QidahenBattleRoster } from './QidahenBattleRoster';
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
    const targeting = input.step === 'dispatch-target';
    const back = input.options.find(option => option.id === 'back');
    const targetName = targeting ? input.options.find(option => option.id === input.selectedRegionId)?.label : undefined;
    const committed = new Set(input.committedPieceIds);
    return <section aria-labelledby="qidahen-dispatch-title" data-testid={QIDAHEN_DISPATCH_ROSTER_ID} data-tutorial-id={QIDAHEN_DISPATCH_ROSTER_ID} data-dispatch-step={input.step}
        className="pointer-events-auto absolute bottom-[13%] left-1/2 z-[85] flex w-max max-w-[min(780px,64%)] -translate-x-1/2 items-center gap-4 rounded-md border border-[#b48c58] bg-[#39291e] px-4 py-2.5 text-[#fff0d2] shadow-xl">
        <h2 id="qidahen-dispatch-title" className="shrink-0 text-lg font-black">{regionName}</h2>
        {targeting ? <div className="min-w-0">
            <QidahenBattleRoster side="attacker" tokens={tokens.filter(token => token.imageSrc && token.pieceId && committed.has(token.pieceId))} />
        </div> : <div className="flex min-w-0 items-start gap-2.5 overflow-x-auto px-1 pb-1 pt-1">
            {tokens.filter(token => token.type === 'army' && token.pieceId && eligible.has(token.pieceId) && !hidden.has(token.pieceId))
                .map(token => {
                    const ids = groupByToken.get(token.id) ?? [token.pieceId!];
                    const count = ids.filter(id => input.selectedIds.includes(id)).length;
                    const recommended = ids.some(id => recommendedIds?.includes(id));
                    const kind = token.troopKind ? t(`board.wheelRecruitTrain.${token.troopKind}`) : regionName;
                    const change = (next: number) => input.setGroupCount(ids, next);
                    const multi = ids.length > 1;
                    return <div key={token.id} className="flex w-[70px] shrink-0 flex-col items-center gap-2"
                        data-testid={`qidahen-dispatch-unit-${token.id}`} data-piece-ids={ids.join(' ')}
                        data-qidahen-dispatch-selected={count}
                        data-qidahen-dispatch-recommended={recommended ? 'true' : undefined}>
                        <button type="button" aria-label={kind} aria-pressed={count > 0}
                            data-testid={`qidahen-dispatch-pick-${token.id}`}
                            onClick={() => change(multi ? Math.min(count + 1, ids.length) : 1 - count)}
                            className={`grid size-[68px] place-items-center rounded-md border-2 p-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${count ? 'border-[#ffe485] bg-[#7b572a]' : recommended ? 'border-[#cae0a9] bg-[#4a3828]' : 'border-[#847050] bg-[#4a3828] hover:border-[#d3e0bc]'}`}>
                            {token.imageSrc ? <QidahenArmyBlock imageSrc={token.imageSrc}
                                rotation={token.rotationDeg} quantity={ids.length} className="isolate size-[60px]" /> : kind}
                        </button>
                        {multi ? <div className="grid h-7 grid-cols-[20px_30px_20px] items-center text-center text-sm font-bold tabular-nums">
                            <button type="button" aria-label={t('board.map.decreaseDispatch')} disabled={count === 0} onClick={() => change(count - 1)}
                                className="h-7 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30">−</button>
                            <span aria-label={t('board.map.dispatchCount', { count, total: ids.length })}>{count}/{ids.length}</span>
                            <button type="button" aria-label={t('board.map.increaseDispatch')} disabled={count === ids.length} onClick={() => change(count + 1)}
                                className="h-7 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30">+</button>
                        </div> : null}
                    </div>;
                })}
        </div>}
        <div className="flex shrink-0 flex-col items-start gap-1">
            {!targeting ? <span aria-live="polite" className="text-sm text-[#e1c798]">{t('board.turnChoice.selectedTroops', { units: input.selectedPieceIds.length })}</span> : null}
            {targeting && back ? <button type="button" data-testid="qidahen-turn-option-back" data-tutorial-id="qidahen-turn-option-back"
                disabled={back.disabled} onClick={() => input.choose(back.id)}
                className="min-h-9 rounded px-2 text-left text-sm font-bold text-[#f8dfad] hover:bg-white/10 disabled:opacity-40">{back.label}</button> : null}
            {!targeting || targetName ? <button type="button" data-testid="qidahen-turn-confirm" data-tutorial-id="qidahen-turn-confirm"
                disabled={!input.canConfirm} onClick={input.confirm}
                className="min-h-11 rounded border border-[#ffe49b] bg-[#e3ce9e] px-4 font-bold text-[#342612] disabled:opacity-40">
                {targetName ? t('board.turnChoice.confirmDispatchTarget', { target: targetName }) : t('board.turnChoice.chooseDispatchTarget')}
            </button> : null}
        </div>
    </section>;
}
