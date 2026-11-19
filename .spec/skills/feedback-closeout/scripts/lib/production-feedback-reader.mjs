import { spawnSync as defaultSpawnSync } from 'node:child_process';
import { DEFAULT_MONGO_COMMAND, DEFAULT_MONGO_SSH_TARGET } from './feedback-status-writer.mjs';
import { normalizeFeedbackOrigin } from '../../../../../src/lib/feedback/feedbackOrigin.mjs';

const statusesAllowed = new Set(['open', 'in_progress', 'resolved', 'closed']);

// 生产无管理员 token 时，读取真实全量状态而非匿名接口的系统摘要。
export function readProductionFeedback(statuses, ids, { spawnSync = defaultSpawnSync } = {}) {
    if (!statuses.length || statuses.some((status) => !statusesAllowed.has(status))) throw new Error('非法反馈状态');
    if (ids.some((id) => !/^[a-f0-9]{24}$/.test(id))) throw new Error('非法反馈 ID');
    const query = `const statuses=${JSON.stringify(statuses)}; const ids=${JSON.stringify(ids)};
const filter={status:{$in:statuses}}; if(ids.length) filter._id={$in:ids.map(id=>new ObjectId(id))};
const rows=db.feedbacks.find(filter,{privateReplay:0,diagnosticCaptureIds:0}).sort({createdAt:1}).toArray().map(row=>({...row,_id:String(row._id)}));
print('FEEDBACK_READ:'+JSON.stringify(rows));`;
    const result = spawnSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', DEFAULT_MONGO_SSH_TARGET, DEFAULT_MONGO_COMMAND], {
        input: query, encoding: 'utf8', timeout: 60000, maxBuffer: 128 * 1024 * 1024,
    });
    if (result.error || result.status !== 0) throw new Error('生产反馈读取失败，未生成清单');
    const line = String(result.stdout || '').split(/\r?\n/).find((entry) => entry.includes('FEEDBACK_READ:'));
    if (!line) throw new Error('生产反馈读取未返回完整结果');
    const rows = JSON.parse(line.slice(line.indexOf('FEEDBACK_READ:') + 'FEEDBACK_READ:'.length));
    if (!Array.isArray(rows) || rows.some((row) => typeof row._id !== 'string' || typeof row.content !== 'string')) {
        throw new Error('生产反馈读取缺少 ID 或原文，未生成清单');
    }
    return rows.map(normalizeFeedbackOrigin);
}
