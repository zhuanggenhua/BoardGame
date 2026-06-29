import { createThemeFromStyle, STYLE_FUTURISTIC_TECH } from '../../core/cursor/cursorStyles';
import { registerCursorThemes } from '../../core/cursor/themes';

registerCursorThemes([
    createThemeFromStyle(STYLE_FUTURISTIC_TECH, {
        gameId: 'fantasyrealms',
        id: 'fantasyrealms-parchment',
        label: 'Fantasy Realms',
        variantLabel: '秘法',
    }),
]);

export default {};
