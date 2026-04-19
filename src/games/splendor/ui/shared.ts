import type { CardTier, TokenColor } from '../domain';

export type PreviewItem =
    | { kind: 'card'; cardId: string; tier: CardTier }
    | { kind: 'noble'; nobleId: string };

export const COLOR_I18N_KEY: Record<TokenColor, string> = {
    white: 'colors.white',
    blue: 'colors.blue',
    green: 'colors.green',
    red: 'colors.red',
    black: 'colors.black',
    gold: 'colors.gold',
};
