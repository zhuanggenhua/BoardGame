import { DEVTOOLS_AI_REPO_WORKBENCH_API_URL } from '../config/server';
import type {
    EditableFlowData,
    OptionalWorkflowNodeId,
    RuleSourceOptionId,
    WorkbenchJournal,
} from '../features/ai-repo-workbench/runtime';
import type { WorkbenchFlowHostCatalog } from '../features/ai-repo-workbench/flowiseForkBaseline';

const resolvePath = (url: string) => {
    try {
        return new URL(url).pathname;
    } catch {
        return url;
    }
};

async function parseWorkbenchError(response: Response): Promise<string> {
    const rawText = await response.text().catch(() => '');
    if (response.status === 404) {
        const path = resolvePath(response.url || DEVTOOLS_AI_REPO_WORKBENCH_API_URL);
        return `AI 仓库工作台接口不存在（${path}），请确认 apps/api 已启动并重启。`;
    }
    if (!rawText) {
        return 'AI 仓库工作台接口调用失败';
    }
    try {
        const parsed = JSON.parse(rawText) as { error?: string; message?: string };
        return parsed.error || parsed.message || rawText;
    } catch {
        return rawText;
    }
}

async function postWorkbench<TResponse>(path: string, body?: unknown): Promise<TResponse> {
    const response = await fetch(`${DEVTOOLS_AI_REPO_WORKBENCH_API_URL}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
        throw new Error(await parseWorkbenchError(response));
    }
    return response.json() as Promise<TResponse>;
}

async function getWorkbench<TResponse>(path: string): Promise<TResponse> {
    const response = await fetch(`${DEVTOOLS_AI_REPO_WORKBENCH_API_URL}${path}`);
    if (!response.ok) {
        throw new Error(await parseWorkbenchError(response));
    }
    return response.json() as Promise<TResponse>;
}

export async function fetchWorkbenchJournal(): Promise<WorkbenchJournal> {
    return postWorkbench('/journal/query');
}

export async function fetchWorkbenchHostCatalog(): Promise<WorkbenchFlowHostCatalog> {
    return getWorkbench('/host-catalog');
}

export async function resetWorkbenchJournalRemote(): Promise<WorkbenchJournal> {
    return postWorkbench('/reset');
}

export async function registerManagedWorktreeRemote(payload: {
    branchName: string;
    projectPath: string;
    label?: string;
}): Promise<WorkbenchJournal> {
    return postWorkbench('/worktrees/register', {
        ...payload,
        worktreePath: payload.projectPath,
    });
}

export async function focusManagedWorktreeRemote(payload: {
    worktreeId: string;
}): Promise<WorkbenchJournal> {
    return postWorkbench('/worktrees/focus', payload);
}

export async function focusWorkflowRemote(payload: {
    workflowId: string;
}): Promise<WorkbenchJournal> {
    return postWorkbench('/workflows/focus', payload);
}

export async function saveWorkflowDraftRemote(payload: {
    workflowId: string;
    flowData: EditableFlowData;
}): Promise<WorkbenchJournal> {
    return postWorkbench('/workflows/save', payload);
}

export async function startWorkflowRunRemote(payload: {
    workflowId: string;
    subject: string;
    prompt: string;
    projectPath?: string;
    nodeToggles?: Partial<Record<OptionalWorkflowNodeId, boolean>>;
}): Promise<WorkbenchJournal> {
    return postWorkbench('/runs/start', payload);
}

export async function startNewFactionRunRemote(payload: {
    factionName: string;
    projectPath?: string;
    nodeToggles?: Partial<Record<OptionalWorkflowNodeId, boolean>>;
}): Promise<WorkbenchJournal> {
    return startWorkflowRunRemote({
        workflowId: 'new-faction',
        subject: payload.factionName,
        prompt: `创建派系：${payload.factionName}`,
        projectPath: payload.projectPath,
        nodeToggles: payload.nodeToggles,
    });
}

export async function submitRuleSourceDecisionRemote(payload: {
    decisionId: string;
    optionId: RuleSourceOptionId;
}): Promise<WorkbenchJournal> {
    return submitDecisionRemote({
        decisionId: payload.decisionId,
        action: 'proceed',
        optionId: payload.optionId,
    });
}

export async function submitDecisionRemote(payload: {
    decisionId: string;
    action: 'proceed' | 'reject';
    optionId?: RuleSourceOptionId;
    feedback?: string;
}): Promise<WorkbenchJournal> {
    return postWorkbench('/decisions/submit', payload);
}

export async function advanceWorkbenchJournalRemote(): Promise<WorkbenchJournal> {
    return postWorkbench('/runs/advance');
}
