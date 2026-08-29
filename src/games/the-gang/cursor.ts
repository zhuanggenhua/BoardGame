import { createThemeFromStyle, STYLE_FUTURISTIC_TECH } from '../../core/cursor/cursorStyles';
import { registerCursorThemes } from '../../core/cursor/themes';

registerCursorThemes([
    createThemeFromStyle(STYLE_FUTURISTIC_TECH, {
        gameId: 'the-gang',
        id: 'the-gang-vault',
        label: 'The Gang',
        variantLabel: '金库',
    }),
]);

export default {};
