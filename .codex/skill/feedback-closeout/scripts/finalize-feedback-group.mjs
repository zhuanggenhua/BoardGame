#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const VALID_STATUSES = new Set(['resolved', 'closed']);

function parseArgs(argv) {
    const options = {
        baseUrl: process.env.BOARDGAME_FEEDBACK_BASE_URL || 'http://127.0.0.1:3000',
        token: process.env.BOARDGAME_FEEDBACK_TOKEN || '',
        summaryPath: '',
        feedbackId: '',
        status: '',
        updateDuplicates: true,
        closedReason: '',
        resolvedMethod: '',
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
        if (arg === '--closed-reason') {
            options.closedReason = argv[++index] || '';
            continue;
        }
        if (arg === '--resolved-method') {
            options.resolvedMethod = argv[++index] || '';
            continue;
        }
        if (arg === '--keep-duplicates-open') {
            options.updateDuplicates = false;
            continue;
        }
        positional.push(arg);
    }

    options.summaryPath = positional[0] || '';
    options.feedbackId = positional[1] || '';
    options.status = positional[2] || '';

    if (!options.summaryPath) {
        throw new Error('缺少 summary.json 路径');
    }
    if (!options.feedbackId) {
        throw new Error('缺少代表项反馈 ID');
    }
    if (!VALID_STATUSES.has(options.status)) {
        throw new Error(`非法终态: ${options.status}`);
    }

    return options;
}

function normalizeBaseUrl(baseUrl) {
    return baseUrl.replace(/\/+$/, '');
}

async function updateFeedbackStatus(baseUrl, token, id, status, details = {}) {
    const closedReason = typeof details.closedReason === 'string' ? details.closedReason.trim() : '';
    const resolvedMethod = typeof details.resolvedMethod === 'string' ? details.resolvedMethod.trim() : '';
    const response = await fetch(`${baseUrl}/admin/feedback/${id}/status`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            status,
            ...(closedReason ? { closedReason } : {}),
            ...(resolvedMethod ? { resolvedMethod } : {}),
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`更新状态失败 ${response.status} ${response.statusText}: ${id} -> ${status}; ${text}`);
    }

    return response.json();
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const baseUrl = normalizeBaseUrl(options.baseUrl);
    if (!options.token) {
        throw new Error('缺少反馈管理 Bearer 凭证；请通过 --token 或 BOARDGAME_FEEDBACK_TOKEN 提供');
    }
    const resolvedSummaryPath = path.resolve(options.summaryPath);
    const raw = await fs.readFile(resolvedSummaryPath, 'utf8');
    const summary = JSON.parse(raw);
    const groups = Array.isArray(summary.groups) ? summary.groups : [];
    const group = groups.find((entry) => entry.primaryId === options.feedbackId);

    if (!group) {
        throw new Error(`summary.json 中找不到代表项: ${options.feedbackId}`);
    }

    const details = {
        closedReason: options.closedReason,
        resolvedMethod: options.resolvedMethod,
    };
    const primary = await updateFeedbackStatus(baseUrl, options.token, options.feedbackId, options.status, details);
    const duplicateResults = [];

    if (options.updateDuplicates) {
        const duplicateIds = Array.isArray(group.duplicateIds) ? group.duplicateIds : [];
        for (const duplicateId of duplicateIds) {
            const updated = await updateFeedbackStatus(baseUrl, options.token, duplicateId, options.status, details);
            duplicateResults.push({
                feedbackId: duplicateId,
                status: updated.status,
            });
        }
    }

    const result = {
        summaryPath: resolvedSummaryPath,
        feedbackId: options.feedbackId,
        finalStatus: primary.status,
        duplicateCount: Array.isArray(group.duplicateIds) ? group.duplicateIds.length : 0,
        updateDuplicates: options.updateDuplicates,
        duplicateFinalStatus: options.updateDuplicates ? options.status : null,
        duplicates: duplicateResults,
    };

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
});
