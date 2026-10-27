import type { RandomFn } from '../../../../engine/types';
import type { AbilityCard } from '../../domain/types';
import { COMMON_CARDS, injectCommonCardPreviewRefs, type CommonCardAtlasIndexMap } from '../../domain/commonCards';
import { DOCTOR_STRANGE_ATLAS, DOCTOR_STRANGE_SFX } from './constants';
import { strangeOperation } from './abilities';

export const DOCTOR_STRANGE_COMMON_ATLAS_INDEX: CommonCardAtlasIndexMap = {
    'card-transfer-status': 0, 'card-what-status': 1, 'card-one-throw-fortune': 2, 'card-get-away': 3,
    'card-super-double': 4, 'card-double': 5, 'card-bye-bye': 6, 'card-flick': 7, 'card-boss-generous': 8,
    'card-next-time': 9, 'card-unexpected': 10, 'card-worthy-of-me': 11, 'card-surprise': 12,
    'card-me-too': 13, 'card-i-can-again': 14, 'card-give-hand': 15, 'card-just-this': 16, 'card-play-six': 17,
};

/** 一个条目对应一张真实物理牌，双区域效果不拆分。 */
export const DOCTOR_STRANGE_SPELL_IDS = [
    'spell-flames-of-faltine', 'spell-rings-of-raggadorr', 'spell-vapors-of-valtorr',
    'spell-bolts-of-balthakk', 'spell-winds-of-watoomb', 'spell-mists-of-morpheus',
    'spell-crimson-bands-of-cyttorak', 'spell-fangs-of-farallah', 'spell-images-of-ikonn',
] as const;

const preview = (index: number) => ({ type: 'atlas' as const, atlasId: DOCTOR_STRANGE_ATLAS.CARDS, index });
const text = (id: string, field: string) => `cards.${id}.${field}`;

export const DOCTOR_STRANGE_SPELLS: AbilityCard[] = DOCTOR_STRANGE_SPELL_IDS.map((id, index) => ({
    id, name: text(id, 'name'), description: text(id, 'description'), type: 'spell', timing: 'main', cpCost: 0,
    sfxKey: DOCTOR_STRANGE_SFX, sourceAtlasIndex: index + 18, previewRef: preview(index + 18),
    spell: { starting: index === 0, index, destination: index === 0 ? 'hand' : 'discard' },
}));

const action = (id: string, index: number, cpCost: number, timing: AbilityCard['timing'], operation: string): AbilityCard => ({
    id, name: text(id, 'name'), description: text(id, 'description'), type: 'action', cpCost, timing,
    sourceAtlasIndex: index, previewRef: preview(index), sfxKey: DOCTOR_STRANGE_SFX,
    effects: [strangeOperation(operation, 'immediate')],
});

export const DOCTOR_STRANGE_CARDS: AbilityCard[] = [
    ...injectCommonCardPreviewRefs(COMMON_CARDS, DOCTOR_STRANGE_ATLAS.CARDS, DOCTOR_STRANGE_COMMON_ATLAS_INDEX)
        .map(card => {
            if (card.id === 'card-next-time') return { ...card, timing: 'roll' as const };
            if (card.id === 'card-i-can-again') {
                return { ...card, playCondition: { ...card.playCondition, phase: 'offensiveRoll' as const } };
            }
            if (card.id === 'card-worthy-of-me') {
                const playCondition = { ...card.playCondition };
                delete playCondition.requireIsRoller;
                return {
                    ...card,
                    playCondition: {
                        ...playCondition,
                        requireIsRollerOrTeammate: true,
                    },
                    effects: card.effects?.map(effect => effect.action?.type === 'custom'
                        && effect.action.customActionId === 'reroll-die-2'
                        ? { ...effect, action: { ...effect.action, target: 'select' as const } }
                        : effect),
                };
            }
            return card;
        }),
    ...DOCTOR_STRANGE_SPELLS,
    action('card-strange-see-the-future', 27, 0, 'main', 'premonition-two'),
    { ...action('card-strange-icy-tendrils', 28, 1, 'roll', 'tendrils'), isAttackModifier: true },
    { ...action('card-strange-shield-of-seraphim', 29, 1, 'roll', 'shield'),
        playCondition: { pendingDamage: { role: 'target', responseType: 'beforeDamageReceived' } } },
    { ...action('card-strange-cast-away', 30, 0, 'roll', 'cast-one'), isAttackModifier: true },
    action('card-strange-time-loop', 31, 2, 'instant', 'grant-deja-vu'),
];

export const getDoctorStrangeStartingDeck = (random: RandomFn): AbilityCard[] => random.shuffle(
    DOCTOR_STRANGE_CARDS.map(card => ({ ...card, effects: card.effects ? [...card.effects] : undefined })),
);
