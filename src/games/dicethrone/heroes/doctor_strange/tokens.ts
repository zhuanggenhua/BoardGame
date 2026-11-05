import type { TokenDef } from '../../domain/tokenTypes';
import { DOCTOR_STRANGE_ATLAS, DOCTOR_STRANGE_TOKEN as TOKEN, DOCTOR_STRANGE_SFX } from './constants';

export const DOCTOR_STRANGE_TOKENS: TokenDef[] = [
    { id: TOKEN.CRIMSON_BANDS, stackLimit: 1, category: 'debuff', colorTheme: 'from-red-800 to-rose-500' },
    { id: TOKEN.PREMONITION, stackLimit: 3, category: 'consumable', colorTheme: 'from-green-500 to-purple-600' },
    { id: TOKEN.DEJA_VU, stackLimit: 1, category: 'consumable', colorTheme: 'from-yellow-400 to-amber-500' },
].map(token => ({
    ...token, name: `tokens.${token.id}.name`, description: `tokens.${token.id}.description` as unknown as string[],
    sfxKey: DOCTOR_STRANGE_SFX, frameId: token.id, atlasId: DOCTOR_STRANGE_ATLAS.STATUS,
})) as TokenDef[];

export const DOCTOR_STRANGE_INITIAL_TOKENS = { [TOKEN.PREMONITION]: 0, [TOKEN.DEJA_VU]: 0 };
export const DOCTOR_STRANGE_INITIAL_STATUS_EFFECTS = { [TOKEN.CRIMSON_BANDS]: 0 };
