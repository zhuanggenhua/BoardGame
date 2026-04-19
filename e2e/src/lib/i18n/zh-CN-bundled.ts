/**
 * 中文核心 namespace 内联打包
 *
 * 首页首屏高频文案保留内联，避免主页再多打一个翻译请求。
 * 其他 namespace 统一走 HTTP backend 按需加载，减轻主入口 JS 体积。
 */
import common from '../../../public/locales/zh-CN/common.json';
import lobby from '../../../public/locales/zh-CN/lobby.json';
import game from '../../../public/locales/zh-CN/game.json';
import auth from '../../../public/locales/zh-CN/auth.json';

export const zhCNBundled = {
    common,
    lobby,
    game,
    auth,
} as const;
