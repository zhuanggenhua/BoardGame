import type { PassiveAbilityDef } from '../../domain/passiveAbility';
import { TOKEN_IDS } from '../../domain/ids';

/** 同伴动作复用既有主动动作栏；弃牌在正式选择提交时支付。 */
export const THOR_PASSIVE_ABILITIES: PassiveAbilityDef[] = [{
    id: 'thor-mjolnir',
    nameKey: 'passive.thor.name',
    actions: [
        {
            type: 'custom', cpCost: 0, timing: 'anytime',
            labelKey: 'passive.thor.throw', descriptionKey: 'passive.thor.throwDescription',
            customActionId: 'thor-paid-throw', requiresHandCards: 1,
            requiresTokens: [{ tokenId: TOKEN_IDS.MJOLNIR, amount: 1 }], showWhenUnavailable: true,
        },
        {
            type: 'custom', cpCost: 0, timing: 'anytime',
            labelKey: 'passive.thor.retrieve', descriptionKey: 'passive.thor.retrieveDescription',
            customActionId: 'thor-paid-retrieve', requiresHandCards: 1,
            requiresTokenBelowLimit: { tokenId: TOKEN_IDS.MJOLNIR }, showWhenUnavailable: true,
        },
    ],
}];

/** 驭电可被转移；抽牌权属于任何合法持有者，不仅属于索尔。 */
export const ELECTROKINESIS_PASSIVE: PassiveAbilityDef = {
    id: 'electrokinesis-draw', nameKey: 'tokens.electrokinesis.name',
    actions: [{
        type: 'drawCard', cpCost: 0, timing: 'ownMainPhase', drawCount: 1,
        labelKey: 'passive.thor.draw', descriptionKey: 'passive.thor.drawDescription',
        tokenCost: { tokenId: TOKEN_IDS.ELECTROKINESIS, amount: 4 },
        oncePerTurnKey: 'electrokinesis-draw', showWhenUnavailable: true,
    }],
};
