import type { DiceDefinition } from '../../../../engine/primitives';
import { DOCTOR_STRANGE_FACE as FACE } from './constants';

export const doctorStrangeDiceDefinition: DiceDefinition = {
    id: 'doctor_strange-dice', name: 'config.dice.doctor_strange.name', sides: 6, category: 'hero',
    faces: [FACE.MANDALA, FACE.MANDALA, FACE.BOOK, FACE.BOOK, FACE.CLOAK, FACE.AMULET]
        .map((face, index) => ({ value: index + 1, symbols: [face] })),
    assets: { spriteSheet: 'dicethrone/images/doctor_strange/dice' },
};
