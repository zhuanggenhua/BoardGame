import { createServer } from 'node:http';
import { Server } from 'socket.io';
import parser from 'socket.io-msgpack-parser';

// 纯视觉夹具：只在浏览器上下文及临时协议服务器中提供数据，不写开发库。
const date = '2026-10-30T00:00:00.000Z';
const visualToken = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from('{"sub":"111111111111111111111111","exp":4102444800}').toString('base64url')}.visual-only`;
export const visualFavorites = ['dicethrone', 'summonerwars', 'smashup', 'splendor', 'tictactoe', 'cardia'];
export const visualUser = { id: '111111111111111111111111', username: '林间晚风', email: 'visual@example.test', emailVerified: true, role: 'user', avatar: '/avatars/dice.svg', banned: false };
const external = { gameId: 'external-yuanyi-games', name: '山中小屋', url: 'https://yuanyigames.top/', author: '鸢一桑', authorProfileUrl: 'https://space.bilibili.com/31976469', category: 'uncategorized', description: '探索山林中的神秘小屋，与朋友一起解开房间里的谜题。作者主页：https://space.bilibili.com/31976469', rules: '在浏览器中开始冒险，阅读房间中的线索并完成探索。', coverUrl: '', published: true, embedStatus: 'blocked', embedCheckedUrl: 'https://yuanyigames.top/', embedReason: '此游戏暂不支持嵌入，请前往原网站游玩。', ownerUserId: null, updatedAt: date };
const submissions = ['draft', 'pending', 'rejected'].map((status, i) => ({ ...external, name: ['林间探险', '午后纸牌', '星空棋盘'][i], submissionId: `visual-submission-${i}`, status, reviewComment: status === 'rejected' ? '请补充清晰封面和完整的游玩规则。' : '', updatedAt: date }));
const changelogs = gameId => [0, 1, 2].map(i => ({ id: `visual-${gameId}-${i}`, gameId, title: ['秋日版本：全新英雄与对战体验', '对战平衡与英雄技能调整', '界面与新手教学优化'][i], versionLabel: `0.6.${47 - i}`, content: ['## 本次更新\n\n- 新增英雄与练习内容，完善技能说明。\n- 优化多人联机时的回合提示与房间信息。\n\n## 体验改进\n\n现在可以更清楚地查看英雄状态、更新内容和好友邀请。', '调整部分英雄能力的使用时机，修复对战中的文字显示问题。', '改进手机阅读与房间列表，补充新玩家操作指引。'][i], pinned: i === 0, publishedAt: `2026-10-${30 - i}T00:00:00.000Z`, createdAt: date, updatedAt: date }));

export async function createHomeVisualFixture() {
    const http = createServer();
    const io = new Server(http, { cors: { origin: true, credentials: true }, parser, path: '/lobby-socket' });
    let version = 0;
    io.on('connection', socket => {
        socket.on('lobby:subscribe', ({ gameId }) => {
            const games = gameId === 'all' ? ['dicethrone', 'summonerwars', 'smashup'] : [gameId];
            const matches = games.flatMap((gameName, gameIndex) => Array.from({ length: 5 }, (_, i) => ({ matchID: `${gameName === 'dicethrone' ? 'd1ce' : (0xab00 + gameIndex).toString(16)}${i.toString(16).padStart(4, '0')}`, gameName, roomName: ['周末轻松对战', '新手友好 · 欢迎加入', '老友切磋，来一局', '英雄练习与策略交流', '夜间休闲房'][i], totalSeats: i % 2 ? 4 : 2, players: [{ id: 0, name: ['山间晚风', '棋逢对手', '阿橙', '白夜', '麦芽'][i], isConnected: true }, ...(i === 2 ? [{ id: 1, name: '小满', isConnected: true }] : [])], createdAt: Date.now() - i * 60000, updatedAt: Date.now(), ownerType: 'guest', isLocked: i === 3, status: i === 2 ? 'playing' : 'waiting' })));
            socket.emit('lobby:update', { gameId, version: ++version, matches });
        });
    });
    await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
    return { url: `http://127.0.0.1:${http.address().port}`, close: () => new Promise(resolve => io.close(resolve)) };
}

export async function installHomeVisualData(context, { socketUrl, authenticated = false, favorites = visualFavorites } = {}) {
    const requests = [];
    await context.addInitScript(({ socketUrl, authenticated, favorites, user, visualToken }) => {
        localStorage.setItem('i18nextLng', 'zh-CN');
        localStorage.setItem('bg_home_entry_style', 'modern');
        localStorage.setItem('bg_home_entry_style_version', 'modern-default-v3');
        localStorage.setItem('bg_guest_game_library', JSON.stringify(favorites));
        window.__FORCE_GAME_SERVER_URL__ = socketUrl;
        if (authenticated) {
            localStorage.setItem('auth_token', visualToken);
            localStorage.setItem('auth_user', JSON.stringify(user));
        }
    }, { socketUrl, authenticated, favorites, user: visualUser, visualToken });
    await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        const p = url.pathname;
        let body;
        if (!/^\/(auth|ugc|game-changelogs|notifications|friends|sponsors|admin-api\/(stats|feedback)|games\/[^/]+\/(leaderboard|[a-f0-9]{8}))(\/|$)/.test(p)) return route.continue();
        requests.push({ path: p, method: route.request().method() });
        if (p === '/auth/refresh' && !authenticated) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ success: false }) });
        if (p === '/auth/me') body = { user: visualUser };
        else if (p === '/auth/refresh' || p === '/auth/login') body = { success: true, data: { token: visualToken, user: visualUser } };
        else if (p === '/auth/logout') body = { success: true };
        else if (p === '/auth/user-settings/library') body = { gameIds: favorites };
        else if (p === '/auth/profile/activity') body = { totalPlays: 128 };
        else if (p === '/auth/profile/matches') body = Array.from({ length: 6 }, (_, i) => ({ id: `visual-history-${i}`, gameId: ['dicethrone', 'summonerwars', 'smashup'][i % 3], result: i % 3 ? 'win' : 'loss', opponents: ['小满', '阿橙'].slice(0, i % 2 + 1), endedAt: date }));
        else if (/\/reviews\/[^/]+\/stats$/.test(p)) body = { gameId: 'dicethrone', total: 36, positive: 32, negative: 4, rate: 89 };
        else if (/\/reviews\/[^/]+\/mine$/.test(p)) body = null;
        else if (/\/reviews\//.test(p)) body = { items: Array.from({ length: 4 }, (_, i) => ({ _id: `visual-review-${i}`, user: { _id: `other-${i}`, username: ['小满', '阿橙', '白夜', '麦芽'][i], avatar: '/avatars/cards.svg' }, gameId: 'dicethrone', isPositive: i !== 2, content: ['英雄各有特色，投骰与卡牌配合很有趣。和朋友一起尝试不同的组合，每局都有新发现。', '上手很快，英雄技能的说明清楚，推荐先体验教程。', '希望能补充更多进阶打法说明，整体对战节奏不错。', '联机顺畅，很适合周末和朋友放松。'][i], createdAt: date, updatedAt: date })), total: 4, page: 1, limit: 10, hasMore: false };
        else if (/\/leaderboard$/.test(p)) body = { leaderboard: Array.from({ length: 6 }, (_, i) => ({ playerId: `visual-player-${i}`, name: ['山间晚风', '白夜', '麦芽', '小满', '阿橙', '林间晚风'][i], tier: 'gold', rating: 1780 - i * 60, wins: 32 - i * 2, losses: 12 + i, draws: 1, matches: 45 - i, winRate: .72 - i * .03, provisional: false })) };
        else if (/^\/games\/[^/]+\/[a-f0-9]{8}$/.test(p)) body = { matchID: p.split('/').pop(), gameName: 'dicethrone', roomName: '周末好友对战', players: [{ id: 0, name: visualUser.username, isConnected: true }, { id: 1, name: '小满', isConnected: true }], ownerKey: `user:${visualUser.id}`, ownerType: 'user', setupData: {} };
        else if (p.startsWith('/game-changelogs/')) body = { changelogs: changelogs(p.split('/').pop()) };
        else if (p === '/ugc/external-games') body = { items: [external] };
        else if (p === '/ugc/external-games/mine') body = { items: [{ ...external, ownerUserId: visualUser.id }] };
        else if (p === '/ugc/external-games/history') body = { totalSeconds: 8460, items: [{ gameId: external.gameId, name: external.name, seconds: 8460, lastPlayedAt: date }] };
        else if (p === `/ugc/external-games/${external.gameId}` || p === `/ugc/external-games/mine/${external.gameId}`) body = external;
        else if (p === '/ugc/submissions') body = { items: submissions };
        else if (p.startsWith('/ugc/submissions/')) body = submissions.find(item => p.endsWith(item.submissionId)) ?? submissions[0];
        else if (p === '/ugc/creator-claims') body = { items: [] };
        else if (p.includes('notifications') || p.includes('friends')) body = { items: [], count: 0, unreadCount: 0, friends: [], requests: [] };
        else if (p.includes('/messages/')) body = { conversations: [], messages: [], items: [], unreadCount: 0 };
        else if (p === '/admin-api/stats') body = { onlineUsers: 24, activeMatches: 12, totalUsers: 320 };
        else if (p.startsWith('/admin-api/feedback')) body = { items: [{ _id: 'visual-feedback-1', type: 'suggestion', status: 'in_progress', contentPreview: '希望增加更多好友对战的房间筛选方式。', createdAt: date, gameName: '平台' }, { _id: 'visual-feedback-2', type: 'bug', status: 'resolved', contentPreview: '手机端游戏介绍的显示已经恢复。', createdAt: date, gameName: '平台', rewardPoints: 10 }] };
        else if (p.startsWith('/sponsors')) body = { sponsors: [], items: [] };
        else if (p.includes('user-settings')) body = {};
        else if (route.request().method() !== 'GET') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '服务暂时不可用，请稍后重试。', message: '服务暂时不可用，请稍后重试。' }) });
        else return route.continue();
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    return requests;
}
