/** 索尔六面对应来自提示板：神锤123、当之无愧45、雷电6。 */
import type { DiceDefinition } from '../../../../engine/primitives';
import { THOR_DICE_FACE_IDS as FACE } from '../../domain/ids';

export const thorDiceDefinition: DiceDefinition = {
    id: 'thor-dice',
    name: 'config.dice.thor.name',
    sides: 6,
    category: 'hero',
    faces: [
        { value: 1, symbols: [FACE.HAMMER] },
        { value: 2, symbols: [FACE.HAMMER] },
        { value: 3, symbols: [FACE.HAMMER] },
        { value: 4, symbols: [FACE.WORTHY] },
        { value: 5, symbols: [FACE.WORTHY] },
        { value: 6, symbols: [FACE.THUNDER] },
    ],
    assets: { spriteSheet: 'dicethrone/images/thor/dice' },
};
