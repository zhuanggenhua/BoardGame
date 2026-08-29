/**
 * 光标主题自动注册入口
 *
 * 每个游戏在自己的 cursor.ts 中调用 registerCursorThemes() 完成自注册。
 * 本文件统一 import 触发注册。
 *
 * 新增游戏光标只需：
 * 1. 创建 src/games/<gameId>/cursor.ts，定义主题并调用 registerCursorThemes()
 * 2. 在本文件加一行 import
 * 3. 在 manifest.ts 中声明 cursorTheme: '<默认主题id>'
 */

import './smashup/cursor';
import './dicethrone/cursor';
import './summonerwars/cursor';
import './tictactoe/cursor';
import './cardia/cursor';
import './splendor/cursor';
import './fantasyrealms/cursor';
import './qidahen/cursor';
import './betrayal/cursor';
import './mage-wars/cursor';
import './the-gang/cursor';
