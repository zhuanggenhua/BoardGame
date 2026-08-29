import { createThemeFromStyle, STYLE_FUTURISTIC_TECH } from '../../core/cursor/cursorStyles';
import { registerCursorThemes } from '../../core/cursor/themes';

registerCursorThemes([
    createThemeFromStyle(STYLE_FUTURISTIC_TECH, {
        gameId: 'mage-wars',
        id: 'mage-wars-arcane',
        label: 'Mage Wars',
        variantLabel: '奥术',
    }),
]);

export default {};
