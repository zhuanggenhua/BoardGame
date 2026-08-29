import { createThemeFromStyle, STYLE_FUTURISTIC_TECH } from '../../core/cursor/cursorStyles';
import { registerCursorThemes } from '../../core/cursor/themes';

registerCursorThemes([
    createThemeFromStyle(STYLE_FUTURISTIC_TECH, {
        gameId: 'betrayal',
        id: 'betrayal-haunt',
        label: '山屋惊魂',
        variantLabel: '异兆',
    }),
]);

export default {};
