const GAME_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_ENTRIES = 20;
const MAX_TITLE_LENGTH = 160;
const MAX_CONTENT_LENGTH = 5000;
const MAX_OTA_NOTES_LENGTH = 20000;

export const resolveDeploymentChangelogApiBaseUrl = ({
    explicitUrl = '',
    env = process.env,
}) => {
    const configuredUrl = explicitUrl.trim()
        || env.BG_CHANGELOG_API_BASE_URL?.trim()
        || env.VITE_BACKEND_URL?.trim();
    if (!configuredUrl) {
        throw new Error(
            '提供 --changelog-file 时必须明确配置日志 API：传 --changelog-api-base-url，'
            + '或设置 BG_CHANGELOG_API_BASE_URL / VITE_BACKEND_URL；不会默认写入 localhost。',
        );
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(configuredUrl);
    } catch {
        throw new Error('--changelog-api-base-url 必须是绝对 HTTP(S) URL。');
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('--changelog-api-base-url 必须是绝对 HTTP(S) URL。');
    }
    if (parsedUrl.username || parsedUrl.password || parsedUrl.search || parsedUrl.hash) {
        throw new Error('--changelog-api-base-url 不能包含账号密码、查询参数或片段。');
    }

    return configuredUrl.replace(/\/+$/, '');
};

export const prepareDeploymentGameChangelog = ({
    payload,
    gameNames,
    underConstructionGameIds = [],
    defaultVersionLabel = '',
}) => {
    const entries = Array.isArray(payload) ? payload : payload?.entries;
    if (!Array.isArray(entries)) {
        throw new Error('更新日志文件必须是包含 entries 数组的 JSON 对象。');
    }
    if (entries.length > MAX_ENTRIES) {
        throw new Error(`一次部署最多发布 ${MAX_ENTRIES} 条游戏更新日志。`);
    }

    const underConstruction = new Set(underConstructionGameIds.map((id) => id.toLowerCase()));
    const seenGameIds = new Set();
    const drafts = [];
    const skippedGameIds = [];

    for (const [index, entry] of entries.entries()) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            throw new Error(`entries[${index}] 必须是对象。`);
        }

        const gameId = typeof entry.gameId === 'string' ? entry.gameId.trim().toLowerCase() : '';
        if (!GAME_ID_PATTERN.test(gameId)) {
            throw new Error(`entries[${index}].gameId 格式无效。`);
        }
        if (seenGameIds.has(gameId)) {
            throw new Error(`同一次部署不能为 ${gameId} 提供多条更新日志。`);
        }
        seenGameIds.add(gameId);
        if (!gameNames?.[gameId]) {
            throw new Error(`entries[${index}] 指定了未知游戏: ${gameId}`);
        }

        const title = typeof entry.title === 'string' ? entry.title.trim() : '';
        const content = typeof entry.content === 'string'
            ? entry.content.replace(/\r\n?/g, '\n').trim()
            : '';
        if (!title || title.length > MAX_TITLE_LENGTH) {
            throw new Error(`entries[${index}].title 必须为 1-${MAX_TITLE_LENGTH} 个字符。`);
        }
        if (!content || content.length > MAX_CONTENT_LENGTH) {
            throw new Error(`entries[${index}].content 必须为 1-${MAX_CONTENT_LENGTH} 个字符。`);
        }
        if (entry.versionLabel !== undefined && typeof entry.versionLabel !== 'string') {
            throw new Error(`entries[${index}].versionLabel 必须是字符串。`);
        }
        if (entry.published !== undefined && typeof entry.published !== 'boolean') {
            throw new Error(`entries[${index}].published 必须是布尔值。`);
        }
        if (entry.pinned !== undefined && typeof entry.pinned !== 'boolean') {
            throw new Error(`entries[${index}].pinned 必须是布尔值。`);
        }

        const versionLabel = typeof entry.versionLabel === 'string'
            ? entry.versionLabel.trim()
            : defaultVersionLabel;
        if (versionLabel.length > 80) {
            throw new Error(`entries[${index}].versionLabel 最多 80 个字符。`);
        }
        if (entry.published === false) {
            throw new Error(`entries[${index}] 不能作为草稿传入部署流程；部署日志必须公开发布。`);
        }
        if (entry.pinned === true) {
            throw new Error(`entries[${index}] 不能在部署流程中置顶更新日志。`);
        }

        if (underConstruction.has(gameId)) {
            skippedGameIds.push(gameId);
            continue;
        }

        drafts.push({
            gameId,
            title,
            versionLabel: versionLabel || defaultVersionLabel,
            content,
            published: true,
            pinned: false,
        });
    }

    return { drafts, skippedGameIds };
};

export const formatDeploymentOtaNotes = (drafts) => {
    const notes = drafts
        .map(({ title, content }) => `${title}\n\n${content}`)
        .join('\n\n')
        .trim();
    if (notes.length > MAX_OTA_NOTES_LENGTH) {
        throw new Error(`合并后的 Android OTA 更新说明不能超过 ${MAX_OTA_NOTES_LENGTH} 个字符。`);
    }
    return notes;
};
