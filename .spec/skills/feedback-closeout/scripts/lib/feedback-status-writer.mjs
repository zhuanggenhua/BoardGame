import { spawnSync as defaultSpawnSync } from 'node:child_process';

export const DEFAULT_FEEDBACK_BASE_URL = 'https://api.easyboardgame.top';
export const DEFAULT_MONGO_SSH_TARGET = 'admin@8.148.71.102';
export const DEFAULT_MONGO_COMMAND = 'docker exec -i boardgame-mongodb mongosh --quiet boardgame';

const VALID_STATUSES = new Set(['open', 'in_progress', 'resolved', 'closed']);
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

export class FeedbackStatusHttpError extends Error {
    constructor(message, { status, statusText, responseText } = {}) {
        super(message);
        this.name = 'FeedbackStatusHttpError';
        this.status = status;
        this.statusText = statusText || '';
        this.responseText = responseText || '';
    }
}

export function normalizeBaseUrl(baseUrl = DEFAULT_FEEDBACK_BASE_URL) {
    return String(baseUrl || DEFAULT_FEEDBACK_BASE_URL).replace(/\/+$/, '');
}

export function isProductionFeedbackBaseUrl(baseUrl) {
    try {
        const url = new URL(normalizeBaseUrl(baseUrl));
        return url.protocol === 'https:' && url.hostname === 'api.easyboardgame.top';
    } catch {
        return false;
    }
}

export function selectFeedbackStatusWriter({ baseUrl = DEFAULT_FEEDBACK_BASE_URL, token = '' } = {}) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    if (String(token || '').trim()) {
        return {
            writer: 'http',
            reason: 'token-provided',
            baseUrl: normalizedBaseUrl,
        };
    }

    if (isProductionFeedbackBaseUrl(normalizedBaseUrl)) {
        return {
            writer: 'mongo-ssh',
            reason: 'missing-token-production-mongo',
            baseUrl: normalizedBaseUrl,
        };
    }

    throw new Error(
        `当前反馈写入目标不是已确认的线上反馈接口（baseUrl=${normalizedBaseUrl}），且没有 Bearer 凭证；脚本不会把非线上目标自动改写到生产 Mongo。`,
    );
}

export function shouldFallbackToMongoAfterHttpFailure({ baseUrl = DEFAULT_FEEDBACK_BASE_URL, status } = {}) {
    return isProductionFeedbackBaseUrl(baseUrl) && (status === 401 || status === 403);
}

function trimOptionalText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function validateStatusRequest({ id, status, closedReason, resolvedMethod }) {
    if (!OBJECT_ID_RE.test(String(id || ''))) {
        throw new Error(`反馈 ID 不是有效的 Mongo ObjectId: ${id || '(空)'}`);
    }
    if (!VALID_STATUSES.has(status)) {
        throw new Error(`非法状态: ${status}`);
    }
    if (status === 'resolved' && !trimOptionalText(resolvedMethod)) {
        throw new Error('resolved 状态必须提供面向用户的 resolvedMethod');
    }
    if (status === 'closed' && !trimOptionalText(closedReason)) {
        throw new Error('closed 状态必须提供面向用户的 closedReason');
    }
}

function buildStatusPayload({ status, closedReason, resolvedMethod }) {
    return {
        status,
        ...(trimOptionalText(closedReason) ? { closedReason: trimOptionalText(closedReason) } : {}),
        ...(trimOptionalText(resolvedMethod) ? { resolvedMethod: trimOptionalText(resolvedMethod) } : {}),
    };
}

async function updateViaHttp({ baseUrl, token, id, status, closedReason, resolvedMethod, fetchImpl }) {
    const response = await fetchImpl(`${baseUrl}/admin-api/feedback/${id}/status`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(buildStatusPayload({ status, closedReason, resolvedMethod })),
    });

    if (!response.ok) {
        const responseText = await response.text();
        throw new FeedbackStatusHttpError(
            `HTTP 反馈状态回写失败 ${response.status} ${response.statusText}: ${id} -> ${status}; ${responseText}`,
            {
                status: response.status,
                statusText: response.statusText,
                responseText,
            },
        );
    }

    const feedback = await response.json();
    return {
        writer: 'http',
        reason: 'token-provided',
        id,
        status: feedback?.status || status,
        feedback,
    };
}

function buildMongoUpdate({ id, status, closedReason, resolvedMethod }) {
    const set = {
        status,
        updatedAt: new Date().toISOString(),
    };
    const unset = {};

    if (status === 'resolved') {
        set.resolvedMethod = trimOptionalText(resolvedMethod);
        unset.closedReason = '';
    } else if (status === 'closed') {
        set.closedReason = trimOptionalText(closedReason);
        unset.resolvedMethod = '';
        unset.aggregationActiveKey = '';
    } else {
        unset.closedReason = '';
        unset.resolvedMethod = '';
    }

    return {
        id,
        set,
        unset,
    };
}

function buildMongoScript(updateSpecs) {
    const inputs = Array.isArray(updateSpecs) ? updateSpecs : [updateSpecs];
    return `
const inputs = ${JSON.stringify(inputs)};
function applyFeedbackStatusUpdate(input) {
input.set.updatedAt = new Date(input.set.updatedAt);
const filter = { _id: ObjectId(input.id) };
const current = db.feedbacks.findOne(filter, {
  _id: 1,
  source: 1,
  reporterType: 1,
  aggregationKey: 1
});
if (!current) {
  return {
    id: input.id,
    acknowledged: true,
    matchedCount: 0,
    modifiedCount: 0,
    feedback: null
  };
}
if (
  input.set.status !== 'closed'
  && current.aggregationKey
  && (current.source === 'online-ai-watchdog' || current.reporterType === 'system')
) {
  const conflictingActive = db.feedbacks.findOne({
    _id: { $ne: ObjectId(input.id) },
    aggregationActiveKey: current.aggregationKey,
    status: { $in: ['open', 'in_progress', 'resolved'] }
  }, { _id: 1 });
  if (conflictingActive) {
    throw new Error('同一聚合键已存在活跃反馈，不能直接重新打开归档记录');
  }
  input.set.aggregationActiveKey = current.aggregationKey;
}
const update = { $set: input.set };
if (input.unset && Object.keys(input.unset).length > 0) {
  update.$unset = input.unset;
}
const result = db.feedbacks.updateOne(filter, update);
const doc = db.feedbacks.findOne(filter, {
  _id: 1,
  status: 1,
  closedReason: 1,
  resolvedMethod: 1,
  aggregationActiveKey: 1,
  updatedAt: 1
});
return {
  id: input.id,
  acknowledged: result.acknowledged,
  matchedCount: result.matchedCount,
  modifiedCount: result.modifiedCount,
  feedback: doc ? {
    _id: String(doc._id),
    status: doc.status,
    closedReason: doc.closedReason ?? null,
    resolvedMethod: doc.resolvedMethod ?? null,
    aggregationActiveKey: doc.aggregationActiveKey ?? null,
    updatedAt: doc.updatedAt
  } : null
};
}

const results = inputs.map(applyFeedbackStatusUpdate);
print(JSON.stringify({
  acknowledged: results.every((item) => item.acknowledged),
  matchedCount: results.reduce((sum, item) => sum + item.matchedCount, 0),
  modifiedCount: results.reduce((sum, item) => sum + item.modifiedCount, 0),
  results
}));
`;
}

function parseMongoResult(stdout) {
    const lines = String(stdout || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    for (const line of [...lines].reverse()) {
        const start = line.indexOf('{');
        const end = line.lastIndexOf('}');
        if (start < 0 || end <= start) continue;

        const candidate = line.slice(start, end + 1);
        try {
            return JSON.parse(candidate);
        } catch {
            // mongosh may echo non-JSON shell fragments before the final print().
        }
    }

    throw new Error(`生产 Mongo 回写没有返回 JSON 结果: ${String(stdout || '').trim()}`);
}

function updateManyViaMongoSsh({
    requests,
    reason,
    spawnSyncImpl,
    mongoSshTarget,
    mongoCommand,
}) {
    const updateSpecs = requests.map((request) => buildMongoUpdate(request));
    const script = buildMongoScript(updateSpecs);
    const sshTarget = mongoSshTarget || process.env.BOARDGAME_FEEDBACK_MONGO_SSH_TARGET || DEFAULT_MONGO_SSH_TARGET;
    const remoteCommand = mongoCommand || process.env.BOARDGAME_FEEDBACK_MONGO_COMMAND || DEFAULT_MONGO_COMMAND;
    const result = spawnSyncImpl('ssh', [sshTarget, remoteCommand], {
        input: script,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10,
    });

    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(
            [
                `生产 Mongo 回写失败，ssh 退出码 ${result.status}`,
                result.stderr ? `stderr: ${result.stderr}` : '',
                result.stdout ? `stdout: ${result.stdout}` : '',
            ].filter(Boolean).join('\n'),
        );
    }

    const payload = parseMongoResult(result.stdout);
    const results = Array.isArray(payload?.results) ? payload.results : [payload];
    if (results.length !== requests.length) {
        throw new Error(`生产 Mongo 回写结果数量不匹配: expected=${requests.length}, actual=${results.length}`);
    }

    return results.map((item, index) => {
        const request = requests[index];
        if (!item || item.matchedCount !== 1) {
            throw new Error(`生产 Mongo 未命中反馈记录: ${request.id}`);
        }

        return {
            writer: 'mongo-ssh',
            reason,
            id: request.id,
            status: item.feedback?.status || request.status,
            matchedCount: item.matchedCount,
            modifiedCount: item.modifiedCount,
            feedback: item.feedback,
        };
    });
}

function updateViaMongoSsh(options) {
    const results = updateManyViaMongoSsh({
        ...options,
        requests: [options],
    });
    return results[0];
}

function normalizeStatusRequest(options = {}) {
    return {
        baseUrl: normalizeBaseUrl(options.baseUrl || DEFAULT_FEEDBACK_BASE_URL),
        token: options.token || '',
        id: options.id || '',
        status: options.status || '',
        closedReason: options.closedReason || '',
        resolvedMethod: options.resolvedMethod || '',
        mongoSshTarget: options.mongoSshTarget,
        mongoCommand: options.mongoCommand,
    };
}

function assertRequestsCanBatch(requests) {
    const [first] = requests;
    for (const request of requests) {
        if (request.baseUrl !== first.baseUrl || request.token !== first.token) {
            throw new Error('批量反馈回写要求 baseUrl 和 token 一致');
        }
        if ((request.mongoSshTarget || '') !== (first.mongoSshTarget || '')) {
            throw new Error('批量反馈回写要求 mongoSshTarget 一致');
        }
        if ((request.mongoCommand || '') !== (first.mongoCommand || '')) {
            throw new Error('批量反馈回写要求 mongoCommand 一致');
        }
    }
}

export async function updateFeedbackStatusesViaBestAvailableWriter(optionsList, deps = {}) {
    const requests = (Array.isArray(optionsList) ? optionsList : [])
        .map((options) => normalizeStatusRequest(options));
    for (const request of requests) {
        validateStatusRequest(request);
    }
    if (requests.length === 0) {
        return {
            writer: 'none',
            reason: 'empty-request-list',
            results: [],
        };
    }
    assertRequestsCanBatch(requests);

    const spawnSyncImpl = deps.spawnSync || defaultSpawnSync;
    const selected = selectFeedbackStatusWriter(requests[0]);
    if (selected.writer === 'mongo-ssh') {
        const results = updateManyViaMongoSsh({
            requests,
            reason: selected.reason,
            spawnSyncImpl,
            mongoSshTarget: requests[0].mongoSshTarget,
            mongoCommand: requests[0].mongoCommand,
        });
        return {
            writer: 'mongo-ssh',
            reason: selected.reason,
            results,
        };
    }

    const fetchImpl = deps.fetch || globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
        throw new Error('当前 Node 环境缺少 fetch，无法执行 HTTP 反馈状态回写');
    }

    try {
        const results = [];
        for (const request of requests) {
            results.push(await updateViaHttp({
                ...request,
                fetchImpl,
            }));
        }
        return {
            writer: 'http',
            reason: selected.reason,
            results,
        };
    } catch (error) {
        if (
            error instanceof FeedbackStatusHttpError
            && shouldFallbackToMongoAfterHttpFailure({ baseUrl: requests[0].baseUrl, status: error.status })
        ) {
            const reason = `http-auth-failed-${error.status}-production-mongo`;
            const results = updateManyViaMongoSsh({
                requests,
                reason,
                spawnSyncImpl,
                mongoSshTarget: requests[0].mongoSshTarget,
                mongoCommand: requests[0].mongoCommand,
            });
            return {
                writer: 'mongo-ssh',
                reason,
                results,
            };
        }
        throw error;
    }
}

export async function updateFeedbackStatusViaBestAvailableWriter(options, deps = {}) {
    const request = normalizeStatusRequest(options);
    validateStatusRequest(request);

    const spawnSyncImpl = deps.spawnSync || defaultSpawnSync;

    const selected = selectFeedbackStatusWriter(request);
    if (selected.writer === 'mongo-ssh') {
        return updateViaMongoSsh({
            ...request,
            reason: selected.reason,
            spawnSyncImpl,
        });
    }

    const fetchImpl = deps.fetch || globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
        throw new Error('当前 Node 环境缺少 fetch，无法执行 HTTP 反馈状态回写');
    }

    try {
        return await updateViaHttp({
            ...request,
            fetchImpl,
        });
    } catch (error) {
        if (
            error instanceof FeedbackStatusHttpError
            && shouldFallbackToMongoAfterHttpFailure({ baseUrl: request.baseUrl, status: error.status })
        ) {
            return updateViaMongoSsh({
                ...request,
                reason: `http-auth-failed-${error.status}-production-mongo`,
                spawnSyncImpl,
            });
        }
        throw error;
    }
}
