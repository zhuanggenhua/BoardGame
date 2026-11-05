import { createThemeFromStyle, STYLE_FUTURISTIC_TECH } from '../../core/cursor/cursorStyles';
import { registerCursorThemes } from '../../core/cursor/themes';

registerCursorThemes([
    createThemeFromStyle(STYLE_FUTURISTIC_TECH, {
        gameId: 'fate-domination',
        id: 'fate-domination-table',
        label: '宿命争霸',
        variantLabel: '圣杯战争',
    }),
]);

export default {};
