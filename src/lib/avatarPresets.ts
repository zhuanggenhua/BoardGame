/** 内置头像的唯一目录；默认与预设均复用账户现有的头像地址保存接口。 */
export const DEFAULT_AVATAR_URL = '/avatars/default.svg';
export const AVATAR_PRESETS = [
    { id: 'dice', src: '/avatars/dice.svg', labelKey: 'avatar.presets.dice' },
    { id: 'pawn', src: '/avatars/pawn.svg', labelKey: 'avatar.presets.pawn' },
    { id: 'cards', src: '/avatars/cards.svg', labelKey: 'avatar.presets.cards' },
    { id: 'gamepad', src: '/avatars/gamepad.svg', labelKey: 'avatar.presets.gamepad' },
    { id: 'puzzle', src: '/avatars/puzzle.svg', labelKey: 'avatar.presets.puzzle' },
    { id: 'planet', src: '/avatars/planet.svg', labelKey: 'avatar.presets.planet' },
] as const;
