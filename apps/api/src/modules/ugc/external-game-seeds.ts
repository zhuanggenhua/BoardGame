/** 首次建库的来源记录；仅插入，不覆盖后续审核或作者编辑。未知人数/封面保持未填写。 */
export const EXTERNAL_GAME_SEEDS = [{
    gameId: 'external-yuanyi-games',
    name: '山中小屋',
    url: 'https://yuanyigames.top/',
    category: 'uncategorized',
    author: '鸢一桑',
    authorProfileUrl: 'https://space.bilibili.com/31976469',
    description: '作者：鸢一桑。作者 B 站主页：https://space.bilibili.com/31976469 。游戏网站：https://yuanyigames.top/ 。',
    rules: '', coverUrl: '', published: true,
    embedStatus: 'blocked' as const,
    embedReason: '游戏网站返回 X-Frame-Options: DENY，暂时不允许在本站嵌入。你可以前往原网站游玩。',
    embedCheckedUrl: 'https://yuanyigames.top/',
    embedCheckedAt: new Date('2026-10-27T02:21:28Z'),
}];
