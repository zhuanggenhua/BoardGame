#!/usr/bin/env node
const VALID_STATUSES = new Set(['open', 'in_progress', 'resolved', 'closed']);

function parseArgs(argv) {
    const options = {
        baseUrl: process.env.BOARDGAME_FEEDBACK_BASE_URL || 'http://127.0.0.1:3000',
        token: process.env.BOARDGAME_FEEDBACK_TOKEN || '',
        id: '',
        status: '',
    };

    const positional = [];
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--base-url') {
            options.baseUrl = argv[++index] || options.baseUrl;
            continue;
        }
        if (arg === '--token') {
            options.token = argv[++index] || options.token;
            continue;
        }
        positional.push(arg);
    }

    options.id = positional[0] || '';
    options.status = positional[1] || '';

    if (!options.id) {
        throw new Error('缺少反馈 ID');
    }
    if (!VALID_STATUSES.has(options.status)) {
        throw new Error(`非法状态: ${options.status}`);
    }
    return options;
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const baseUrl = options.baseUrl.replace(/\/+$/, '');
    if (!options.token) {
        throw new Error('缺少反馈管理 Bearer 凭证；请通过 --token 或 BOARDGAME_FEEDBACK_TOKEN 提供');
    }
    const response = await fetch(`${baseUrl}/admin/feedback/${options.id}/status`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${options.token}`,
        },
        body: JSON.stringify({ status: options.status }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`更新失败 ${response.status} ${response.statusText}: ${text}`);
    }

    const payload = await response.json();
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
});
