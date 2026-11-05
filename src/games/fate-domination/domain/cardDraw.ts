import { drawFromTop, reshuffleDiscardIntoDeck, type CardLike } from '../../../engine/primitives/zones';
import type { RandomFn } from '../../../engine/types';
/** Consume remaining top cards first, and only then reshuffle the corresponding discard. */
export function drawFateCards<T extends CardLike>(deck:T[],discard:T[],count:number,random:RandomFn):{drawn:T[];deck:T[];discard:T[]} {
 const first=drawFromTop(deck,count);const needed=count-first.drawn.length;
 if(!needed||!discard.length)return {drawn:first.drawn,deck:first.remaining,discard:[...discard]};
 const recycled=reshuffleDiscardIntoDeck(first.remaining,discard,random.shuffle);
 const second=drawFromTop(recycled.deck,needed);
 return {drawn:[...first.drawn,...second.drawn],deck:second.remaining,discard:recycled.discard};
}
