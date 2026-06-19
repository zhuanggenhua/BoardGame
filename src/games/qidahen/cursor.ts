import { createThemeFromStyle, STYLE_FUTURISTIC_TECH } from '../../core/cursor/cursorStyles';
import { registerCursorThemes } from '../../core/cursor/themes';

registerCursorThemes([
    createThemeFromStyle(STYLE_FUTURISTIC_TECH, {
        gameId: 'qidahen',
        id: 'qidahen-tactical',
        label: '七大恨',
        variantLabel: '战术',
    }),
]);

export default {};
