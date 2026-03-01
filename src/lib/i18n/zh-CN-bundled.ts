/**
 * 中文核心 namespace 内联打包
 *
 * 将中文翻译静态 import 进 JS bundle，中文用户（默认语言）无需任何 HTTP 请求即可使用。
 * 游戏专属 namespace（game-dicethrone 等）体积较大，仍走 HTTP backend 按需加载。
 */
import common from '../../../public/locales/zh-CN/common.json';
import lobby from '../../../public/locales/zh-CN/lobby.json';
import game from '../../../public/locales/zh-CN/game.json';
import auth from '../../../public/locales/zh-CN/auth.json';
import admin from '../../../public/locales/zh-CN/admin.json';
import review from '../../../public/locales/zh-CN/review.json';
import social from '../../../public/locales/zh-CN/social.json';
import tutorial from '../../../public/locales/zh-CN/tutorial.json';

export const zhCNBundled = {
    common,
    lobby,
    game,
    auth,
    admin,
    review,
    social,
    tutorial,
} as const;
