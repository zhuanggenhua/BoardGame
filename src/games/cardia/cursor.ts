/**
 * Cardia 光标主题自注册
 */

import { registerCursorTheme } from '../../core/cursor';

// 注册 Cardia 光标主题
registerCursorTheme({
    id: 'cardia',
    name: 'Cardia',
    gameId: 'cardia',
    default: 'url(/cursors/fantasy/sword.cur), auto',
    pointer: 'url(/cursors/fantasy/hand.cur), pointer',
    grab: 'url(/cursors/fantasy/grab.cur), grab',
    grabbing: 'url(/cursors/fantasy/grabbing.cur), grabbing',
});

export default {};
