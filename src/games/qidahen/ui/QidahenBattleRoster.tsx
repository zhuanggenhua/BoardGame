import { QidahenArmyBlock } from './QidahenArmyBlock';
import type { QidahenMapToken, QidahenTroopKind } from '../domain/types';

export type QidahenBattleSide = 'attacker' | 'defender';

export function QidahenBattleRoster({ tokens, kinds, side }: {
    tokens: readonly QidahenMapToken[];
    kinds?: ReadonlySet<QidahenTroopKind>;
    side: QidahenBattleSide;
}) {
    const groups = new Map<string, QidahenMapToken[]>();
    for (const token of tokens) {
        const key = JSON.stringify([token.faction, token.troopKind, token.imageSrc, token.rotationDeg ?? 0]);
        const group = groups.get(key);
        if (group) group.push(token); else groups.set(key, [token]);
    }
    return <div className="flex min-h-[82px] shrink-0 gap-1.5 overflow-x-auto px-1.5 py-1.5 [justify-content:safe_center]"
        data-testid={`qidahen-battle-roster-${side}`}>
        {[...groups].map(([key, [token, ...rest]]) => {
            const active = kinds != null && token.troopKind != null && kinds.has(token.troopKind);
            return <div key={key} className={`relative flex w-[54px] shrink-0 flex-col items-center gap-0.5 ${kinds && !active ? 'opacity-65' : ''}`}
                data-qidahen-arena-unit={side} data-qidahen-arena-active={active ? 'true' : 'false'}
                data-piece-ids={[token, ...rest].map(piece => piece.pieceId).join(' ')}>
                <QidahenArmyBlock imageSrc={token.imageSrc!}
                    rotation={token.rotationDeg} quantity={rest.length + 1}
                    className={`isolate size-[54px] rounded-md ${active ? 'ring-2 ring-amber-200' : ''}`} />
                {rest.length ? <span className="mt-1 text-xs font-black leading-4">×{rest.length + 1}</span> : null}
            </div>;
        })}
    </div>;
}
