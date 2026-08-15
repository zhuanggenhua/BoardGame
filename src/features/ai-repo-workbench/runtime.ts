export type WorkbenchNodeStatus =
    | 'pending'
    | 'running'
    | 'waiting_decision'
    | 'blocked'
    | 'skipped'
    | 'completed'
    | 'failed';

import {
    createLocalWorkflowOrchestrator,
    type LocalRuntime,
    type WorkflowOrchestrator,
} from './workflowServices';
import { createLangGraphWorkflowOrchestrator } from './langgraphWorkflowOrchestrator';

export type RuleSourceOptionId = 'wiki' | 'pdf' | 'document' | 'other-url';
export type WorkflowTemplateId = string;
export const DEFAULT_WORKFLOW_TEMPLATE_ID: WorkflowTemplateId = 'new-faction';

export type WorkflowNodeId =
    | 'capture-faction-intent'
    | 'select-rule-source'
    | 'acquire-rule-material'
    | 'transcribe-or-normalize-rules'
    | 'inspect-assets'
    | 'draft-faction-definition'
    | 'review-faction-definition'
    | 'run-e2e-validation'
    | 'publish-artifact-bundle';

export type OptionalWorkflowNodeId = 'run-e2e-validation';

export interface WorkflowNodeToggleDefinition {
    nodeId: OptionalWorkflowNodeId;
    label: string;
    description: string;
    defaultEnabled: boolean;
}

export interface RepoSession {
    id: string;
    sourceType: 'init-template' | 'import-local' | 'clone-remote';
    rootPath: string;
    defaultBranch: string;
    activeWorktreeId?: string;
    repoFingerprint: string;
    createdAt: string;
    metadata: {
        repoName: string;
        originUrl?: string;
        currentBranch?: string;
        productMode: 'local-first';
    };
}

export interface WorktreeTask {
    id: string;
    repoSessionId: string;
    label: string;
    branchName: string;
    worktreePath: string;
    taskKind: WorkflowTemplateId;
    status: 'ready' | 'running' | 'paused' | 'completed' | 'failed' | 'archived';
    artifactBundleIds: string[];
    managedBy: 'git-fixture' | 'journal-user' | 'git-runtime';
    lastRunId?: string;
}

export interface WorkflowRun {
    id: string;
    templateId: WorkflowTemplateId;
    templateVersion: string;
    repoSessionId: string;
    worktreeTaskId: string;
    status: 'pending' | 'running' | 'waiting_decision' | 'blocked' | 'completed' | 'failed' | 'cancelled';
    currentNodeId?: string;
    checkpointVersion: number;
    startedAt: string;
    finishedAt?: string;
    latestDecisionRequestId?: string;
    latestArtifactBundleId?: string;
    title: string;
    enabledNodeIds: WorkflowNodeId[];
    orchestrator?: {
        engine: 'local' | 'langgraph';
        threadId?: string;
        checkpointStatus: 'waiting_decision' | 'resumed' | 'fallback' | 'completed';
        lastSyncAt: string;
    };
    context: {
        gameId?: string;
        factionName?: string;
        subject: string;
        prompt: string;
    };
}

export interface NodeExecutionRecord {
    nodeId: WorkflowNodeId;
    runId: string;
    status: WorkbenchNodeStatus;
    attempt: number;
    inputRef: string;
    inputSnapshot: Record<string, unknown>;
    outputRef?: string;
    outputSnapshot?: Record<string, unknown>;
    stateRef?: string;
    stateSnapshot?: Record<string, unknown>;
    startedAt?: string;
    finishedAt?: string;
    errorCode?: string;
    errorSummary?: string;
}

export interface DecisionResolution {
    action: 'proceed' | 'reject';
    optionId?: string;
    optionLabel?: string;
    notes?: string;
    decidedAt: string;
    decidedBy: string;
}

export interface DecisionRequestOption {
    id: RuleSourceOptionId;
    label: string;
    description: string;
    payload: Record<string, unknown>;
}

export interface DecisionRequest {
    id: string;
    runId: string;
    nodeId: WorkflowNodeId;
    phase: 'rules' | 'assets' | 'definition' | 'delivery';
    kind: 'single_select' | 'form' | 'approval';
    title: string;
    summary: string;
    blocking: boolean;
    rationale?: string;
    options: DecisionRequestOption[];
    evidenceRefs: string[];
    recommendedOptionId?: RuleSourceOptionId;
    createdAt: string;
    resumeToken: string;
    allowReject?: boolean;
    allowFeedback?: boolean;
    proceedLabel?: string;
    rejectLabel?: string;
    feedbackPlaceholder?: string;
    resolution?: DecisionResolution;
}

export interface ArtifactScreenshot {
    id: string;
    title: string;
    kind: 'e2e';
    stage: 'waiting_decision' | 'completed';
    absolutePath: string;
    assetPath: string;
    alt: string;
}

export interface ArtifactBundle {
    id: string;
    runId: string;
    title: string;
    status: 'published';
    createdAt: string;
    summary: string;
    outputs: {
        ruleSourceIndex: Array<Record<string, unknown>>;
        normalizedRuleCorpus: Record<string, unknown>;
        assetChecklist: Array<Record<string, unknown>>;
        factionDefinitionSnapshot: Record<string, unknown>;
        decisionLog: Array<Record<string, unknown>>;
        screenshots?: ArtifactScreenshot[];
        e2eStatus: 'skipped' | 'passed_demo';
    };
    evidenceRefs: string[];
    keyObservations: string[];
}

export type ConversationSessionStatus = 'idle' | 'running' | 'waiting_decision' | 'completed' | 'failed';
export type ConversationTurnRole = 'user' | 'assistant' | 'system';
export type ConversationTurnKind =
    | 'prompt'
    | 'status'
    | 'decision_request'
    | 'decision_resolution'
    | 'artifact'
    | 'error';

export interface ConversationSession {
    id: string;
    repoSessionId: string;
    worktreeTaskId: string;
    templateId: WorkflowTemplateId;
    activeRunId?: string;
    status: ConversationSessionStatus;
    createdAt: string;
    updatedAt: string;
}

export interface ConversationTurn {
    id: string;
    sessionId: string;
    runId?: string;
    role: ConversationTurnRole;
    kind: ConversationTurnKind;
    content: string;
    title?: string;
    nodeId?: WorkflowNodeId;
    status?: WorkbenchNodeStatus | WorkflowRun['status'] | ConversationSessionStatus;
    decisionId?: string;
    artifactBundleId?: string;
    createdAt: string;
}

export interface WorkflowTemplateSummary {
    id: WorkflowTemplateId;
    title: string;
    description: string;
    status: 'ready';
    tags: string[];
    runnable: boolean;
    subjectLabel: string;
    subjectPlaceholder: string;
    promptPlaceholder: string;
    optionalNodeToggles: WorkflowNodeToggleDefinition[];
}

export interface WorkflowNodeDefinition {
    label: string;
    hint: string;
}

export interface WorkflowTemplateDefinition extends WorkflowTemplateSummary {
    version: string;
    flowData: EditableFlowData;
    nodeOrder: WorkflowNodeId[];
    nodeDefinitions: Record<WorkflowNodeId, WorkflowNodeDefinition>;
}

export interface EditableFlowNodeData extends Record<string, unknown> {
    id: string;
    name: string;
    label: string;
}

export interface EditableFlowNode {
    id: string;
    type: string;
    position: { x: number; y: number };
    data: EditableFlowNodeData;
}

export interface EditableFlowEdge {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
    type: string;
    animated?: boolean;
}

export interface EditableFlowData {
    nodes: EditableFlowNode[];
    edges: EditableFlowEdge[];
    viewport?: {
        x: number;
        y: number;
        zoom: number;
    };
}

export interface WorkflowDraft {
    templateId: WorkflowTemplateId;
    flowData: EditableFlowData;
    updatedAt: string;
}

export interface WorkbenchJournal {
    schemaVersion: 6;
    updatedAt: string;
    repoSession: RepoSession;
    managedWorktrees: WorktreeTask[];
    workflowDrafts: WorkflowDraft[];
    activeWorkflowId: WorkflowTemplateId;
    runs: WorkflowRun[];
    nodeRecords: NodeExecutionRecord[];
    decisions: DecisionRequest[];
    artifactBundles: ArtifactBundle[];
    conversationSessions: ConversationSession[];
    conversationTurns: ConversationTurn[];
    activeRunId?: string;
}

type WorkbenchJournalV5 = Omit<
    WorkbenchJournal,
    'schemaVersion' | 'workflowDrafts' | 'activeWorkflowId' | 'conversationSessions' | 'conversationTurns'
> & {
    schemaVersion: 5;
    workflowDrafts?: WorkflowDraft[];
    activeWorkflowId?: string;
    conversationSessions?: ConversationSession[];
    conversationTurns?: ConversationTurn[];
};

const metaEnv = (import.meta as { env?: Record<string, string | boolean | undefined> }).env ?? {};

export const AI_REPO_WORKBENCH_STORAGE_KEY = 'ai-repo-workbench:mvp-journal';
const DEFAULT_AI_REPO_WORKBENCH_REPO_PATH = '../BoardGame-wt-ai-repo-workbench';
const joinWorkbenchPath = (root: string, ...segments: string[]) => [
    root.replace(/[\\/]+$/, ''),
    ...segments.map((segment) => segment.replace(/^[\\/]+|[\\/]+$/g, '')),
].filter(Boolean).join('/');
export const AI_REPO_WORKBENCH_REPO_PATH = (metaEnv.VITE_AI_REPO_WORKBENCH_DEFAULT_PROJECT_PATH as string | undefined)
    || DEFAULT_AI_REPO_WORKBENCH_REPO_PATH;
const AI_REPO_WORKBENCH_E2E_ASSET_DIR = joinWorkbenchPath(
    AI_REPO_WORKBENCH_REPO_PATH,
    'evidence',
    '_shared',
    'assets',
    'ai-repo-workbench-e2e',
);
const AI_REPO_WORKBENCH_E2E_ASSET_ROUTE = '/devtools/ai-repo-workbench/assets/e2e';
const AI_REPO_WORKBENCH_BRANCH = (metaEnv.VITE_AI_REPO_WORKBENCH_DEFAULT_BRANCH as string | undefined)
    || 'feat/ai-repo-workbench';
const AUTO_NODE_DURATION_MS = 450;
const DEFAULT_FLOW_VIEWPORT = { x: 0, y: 0, zoom: 0.82 };
const GENERIC_NODE_COLOR = '#94a3b8';

function buildFlowNode(
    id: string,
    name: string,
    label: string,
    position: { x: number; y: number },
    options?: {
        color?: string;
        description?: string;
        hideInput?: boolean;
        inputAnchors?: Array<Record<string, unknown>>;
        outputAnchors?: Array<Record<string, unknown>>;
        outputs?: Array<Record<string, unknown>>;
    },
): EditableFlowNode {
    return {
        id,
        type: 'agentflowNode',
        position,
        data: {
            id,
            name,
            label,
            color: options?.color ?? GENERIC_NODE_COLOR,
            description: options?.description,
            hideInput: options?.hideInput ?? false,
            inputAnchors: options?.inputAnchors ?? [],
            outputAnchors: options?.outputAnchors ?? [],
            outputs: options?.outputs ?? [],
        },
    };
}

function buildFlowEdge(source: string, target: string): EditableFlowEdge {
    return {
        id: `${source}-->${target}`,
        source,
        target,
        sourceHandle: `${source}-output-0`,
        targetHandle: `${target}-input-0`,
        type: 'default',
        animated: false,
    };
}

function buildSimpleAnchors(nodeId: string, kind: 'start' | 'middle' | 'terminal') {
    const inputAnchors = kind === 'start'
        ? []
        : [{ id: `${nodeId}-input-0`, name: 'input', label: 'In', type: 'flow' }];
    const outputAnchors = kind === 'terminal'
        ? []
        : [{ id: `${nodeId}-output-0`, name: 'output', label: 'Out', type: 'flow' }];
    const outputs = kind === 'terminal'
        ? []
        : [{ label: 'Next', name: 'next', type: 'flow' }];

    return {
        inputAnchors,
        outputAnchors,
        outputs,
        hideInput: kind === 'start',
    };
}

const NEW_FACTION_NODE_ORDER: WorkflowNodeId[] = [
    'capture-faction-intent',
    'select-rule-source',
    'acquire-rule-material',
    'transcribe-or-normalize-rules',
    'inspect-assets',
    'draft-faction-definition',
    'review-faction-definition',
    'run-e2e-validation',
    'publish-artifact-bundle',
];

const NEW_FACTION_OPTIONAL_NODE_TOGGLES: WorkflowNodeToggleDefinition[] = [
    {
        nodeId: 'run-e2e-validation',
        label: '端到端验证',
        description: '在交付前补一轮截图验证。',
        defaultEnabled: false,
    },
];

const NEW_FACTION_NODE_DEFINITIONS: Record<WorkflowNodeId, WorkflowNodeDefinition> = {
    'capture-faction-intent': {
        label: '捕捉需求',
        hint: '建立本次会话上下文。',
    },
    'select-rule-source': {
        label: '选择规则来源',
        hint: '人工选择规则来源。',
    },
    'acquire-rule-material': {
        label: '获取规则材料',
        hint: '拉取规则原始材料。',
    },
    'transcribe-or-normalize-rules': {
        label: '规范化规则',
        hint: '整理成规范化规则文本。',
    },
    'inspect-assets': {
        label: '检查素材',
        hint: '检查当前素材缺口。',
    },
    'draft-faction-definition': {
        label: '生成定义草案',
        hint: '生成派系定义草案。',
    },
    'review-faction-definition': {
        label: '定义确认',
        hint: '人工确认定义结果。',
    },
    'run-e2e-validation': {
        label: '图片验证',
        hint: '生成端到端截图。',
    },
    'publish-artifact-bundle': {
        label: '交付产物',
        hint: '返回截图与交付结果。',
    },
};

function buildNewFactionFlowData(): EditableFlowData {
    const nodes: EditableFlowNode[] = [
        buildFlowNode(
            'capture-faction-intent',
            'startAgentflow',
            '捕捉需求',
            { x: 80, y: 80 },
            {
                color: '#7EE787',
                description: '建立本次会话上下文。',
                ...buildSimpleAnchors('capture-faction-intent', 'start'),
            },
        ),
        buildFlowNode(
            'select-rule-source',
            'humanInputAgentflow',
            '选择规则来源',
            { x: 420, y: 80 },
            {
                color: '#64B5F6',
                description: '人工选择规则来源。',
                ...buildSimpleAnchors('select-rule-source', 'middle'),
            },
        ),
        buildFlowNode(
            'acquire-rule-material',
            'toolAgentflow',
            '获取规则材料',
            { x: 760, y: 80 },
            {
                description: '拉取规则原始材料。',
                ...buildSimpleAnchors('acquire-rule-material', 'middle'),
            },
        ),
        buildFlowNode(
            'transcribe-or-normalize-rules',
            'customFunctionAgentflow',
            '规范化规则',
            { x: 760, y: 300 },
            {
                description: '整理成规范化规则文本。',
                ...buildSimpleAnchors('transcribe-or-normalize-rules', 'middle'),
            },
        ),
        buildFlowNode(
            'inspect-assets',
            'toolAgentflow',
            '检查素材',
            { x: 420, y: 300 },
            {
                description: '检查当前素材缺口。',
                ...buildSimpleAnchors('inspect-assets', 'middle'),
            },
        ),
        buildFlowNode(
            'draft-faction-definition',
            'agentAgentflow',
            '生成定义草案',
            { x: 80, y: 300 },
            {
                description: '生成派系定义草案。',
                ...buildSimpleAnchors('draft-faction-definition', 'middle'),
            },
        ),
        buildFlowNode(
            'review-faction-definition',
            'humanInputAgentflow',
            '定义确认',
            { x: 80, y: 520 },
            {
                description: '人工确认定义结果。',
                ...buildSimpleAnchors('review-faction-definition', 'middle'),
            },
        ),
        buildFlowNode(
            'run-e2e-validation',
            'executeFlowAgentflow',
            '图片验证',
            { x: 420, y: 520 },
            {
                description: '生成端到端截图。',
                ...buildSimpleAnchors('run-e2e-validation', 'middle'),
            },
        ),
        buildFlowNode(
            'publish-artifact-bundle',
            'directReplyAgentflow',
            '交付产物',
            { x: 760, y: 520 },
            {
                description: '返回截图与交付结果。',
                ...buildSimpleAnchors('publish-artifact-bundle', 'terminal'),
            },
        ),
    ];

    return {
        nodes,
        edges: [
            buildFlowEdge('capture-faction-intent', 'select-rule-source'),
            buildFlowEdge('select-rule-source', 'acquire-rule-material'),
            buildFlowEdge('acquire-rule-material', 'transcribe-or-normalize-rules'),
            buildFlowEdge('transcribe-or-normalize-rules', 'inspect-assets'),
            buildFlowEdge('inspect-assets', 'draft-faction-definition'),
            buildFlowEdge('draft-faction-definition', 'review-faction-definition'),
            buildFlowEdge('review-faction-definition', 'run-e2e-validation'),
            buildFlowEdge('run-e2e-validation', 'publish-artifact-bundle'),
        ],
        viewport: DEFAULT_FLOW_VIEWPORT,
    };
}

function buildConversationWorkflowFlowData(nodes: Array<{
    id: string;
    name: string;
    label: string;
    description: string;
    x: number;
    y: number;
    kind: 'start' | 'middle' | 'terminal';
}>): EditableFlowData {
    return {
        nodes: nodes.map((node) => buildFlowNode(
            node.id,
            node.name,
            node.label,
            { x: node.x, y: node.y },
            {
                description: node.description,
                ...buildSimpleAnchors(node.id, node.kind),
            },
        )),
        edges: nodes.slice(0, -1).map((node, index) => buildFlowEdge(node.id, nodes[index + 1].id)),
        viewport: DEFAULT_FLOW_VIEWPORT,
    };
}

export const WORKFLOW_TEMPLATE_REGISTRY: Record<WorkflowTemplateId, WorkflowTemplateDefinition> = {
    'new-faction': {
        id: DEFAULT_WORKFLOW_TEMPLATE_ID,
        title: '创建派系流程',
        description: '创建派系、走规则来源决策并回传产物。',
        status: 'ready',
        version: 'mvp-v1',
        tags: ['RepoSession', 'DecisionRequest', 'ArtifactBundle', 'local-first'],
        runnable: true,
        subjectLabel: '目标对象',
        subjectPlaceholder: '例如：星环游牧者',
        promptPlaceholder: '描述这次想让工作流完成什么。',
        optionalNodeToggles: NEW_FACTION_OPTIONAL_NODE_TOGGLES,
        flowData: buildNewFactionFlowData(),
        nodeOrder: NEW_FACTION_NODE_ORDER,
        nodeDefinitions: NEW_FACTION_NODE_DEFINITIONS,
    },
    'repo-orchestrator': {
        id: 'repo-orchestrator',
        title: '仓库编排流程',
        description: '围绕仓库任务做规划、执行、验证和交付。',
        status: 'ready',
        version: 'draft-v1',
        tags: ['Flow', 'Planner', 'CLI', 'Repo'],
        runnable: false,
        subjectLabel: '任务主题',
        subjectPlaceholder: '例如：修复登录白屏',
        promptPlaceholder: '直接输入你的仓库任务，让会话和 Flow 一起决定如何推进。',
        optionalNodeToggles: [],
        flowData: buildConversationWorkflowFlowData([
            { id: 'repo-start', name: 'startAgentflow', label: '接收任务', description: '进入仓库任务上下文。', x: 80, y: 120, kind: 'start' },
            { id: 'repo-plan', name: 'agentAgentflow', label: '规划步骤', description: '拆解目标并选择路径。', x: 360, y: 120, kind: 'middle' },
            { id: 'repo-exec', name: 'toolAgentflow', label: '执行命令', description: '编排 CLI / 脚本 / 子流程。', x: 640, y: 120, kind: 'middle' },
            { id: 'repo-review', name: 'humanInputAgentflow', label: '人工确认', description: '必要时停下来请求人工输入。', x: 920, y: 120, kind: 'middle' },
            { id: 'repo-delivery', name: 'directReplyAgentflow', label: '回传结果', description: '回传结果、截图、证据。', x: 1200, y: 120, kind: 'terminal' },
        ]),
        nodeOrder: [],
        nodeDefinitions: NEW_FACTION_NODE_DEFINITIONS,
    },
    'bugfix-flow': {
        id: 'bugfix-flow',
        title: 'Bug 修复流程',
        description: '定位问题、修改、验证并沉淀证据。',
        status: 'ready',
        version: 'draft-v1',
        tags: ['Bugfix', 'Tests', 'Flow'],
        runnable: false,
        subjectLabel: '缺陷标题',
        subjectPlaceholder: '例如：首页白屏',
        promptPlaceholder: '描述报错、现象和你期望的修复结果。',
        optionalNodeToggles: [],
        flowData: buildConversationWorkflowFlowData([
            { id: 'bug-start', name: 'startAgentflow', label: '接收缺陷', description: '读取现象和上下文。', x: 80, y: 160, kind: 'start' },
            { id: 'bug-diagnose', name: 'customFunctionAgentflow', label: '定位根因', description: '聚焦调用链和根因。', x: 360, y: 160, kind: 'middle' },
            { id: 'bug-fix', name: 'toolAgentflow', label: '实施修复', description: '执行修改和命令。', x: 640, y: 160, kind: 'middle' },
            { id: 'bug-verify', name: 'executeFlowAgentflow', label: '验证结果', description: '运行测试或截图验证。', x: 920, y: 160, kind: 'middle' },
            { id: 'bug-reply', name: 'directReplyAgentflow', label: '交付修复', description: '整理结论与证据。', x: 1200, y: 160, kind: 'terminal' },
        ]),
        nodeOrder: [],
        nodeDefinitions: NEW_FACTION_NODE_DEFINITIONS,
    },
    'cli-orchestration': {
        id: 'cli-orchestration',
        title: 'CLI 编排流程',
        description: '把命令行工具、子流程和人工输入编排成可保存的 Flow。',
        status: 'ready',
        version: 'draft-v1',
        tags: ['CLI', 'Agentflow', 'Automation'],
        runnable: false,
        subjectLabel: '编排目标',
        subjectPlaceholder: '例如：批量开工作窗口',
        promptPlaceholder: '描述你希望编排哪些 CLI 步骤和暂停点。',
        optionalNodeToggles: [],
        flowData: buildConversationWorkflowFlowData([
            { id: 'cli-start', name: 'startAgentflow', label: '接收编排需求', description: '读取用户目标和上下文。', x: 80, y: 220, kind: 'start' },
            { id: 'cli-tools', name: 'toolAgentflow', label: '串联工具', description: '组织命令行工具与参数。', x: 420, y: 220, kind: 'middle' },
            { id: 'cli-branch', name: 'conditionAgentflow', label: '条件分支', description: '根据结果决定走哪条路径。', x: 760, y: 220, kind: 'middle' },
            { id: 'cli-human', name: 'humanInputAgentflow', label: '人工暂停', description: '需要时等待人工确认。', x: 1100, y: 220, kind: 'middle' },
            { id: 'cli-end', name: 'directReplyAgentflow', label: '输出编排结果', description: '返回执行摘要或下步动作。', x: 1440, y: 220, kind: 'terminal' },
        ]),
        nodeOrder: [],
        nodeDefinitions: NEW_FACTION_NODE_DEFINITIONS,
    },
};

export function getWorkflowTemplateDefinition(templateId: WorkflowTemplateId): WorkflowTemplateDefinition {
    return WORKFLOW_TEMPLATE_REGISTRY[templateId] ?? WORKFLOW_TEMPLATE_REGISTRY[DEFAULT_WORKFLOW_TEMPLATE_ID];
}

export function getWorkflowTemplateSummaries(): WorkflowTemplateSummary[] {
    return Object.values(WORKFLOW_TEMPLATE_REGISTRY).map((template) => ({
        id: template.id,
        title: template.title,
        description: template.description,
        status: template.status,
        tags: template.tags,
        runnable: template.runnable,
        subjectLabel: template.subjectLabel,
        subjectPlaceholder: template.subjectPlaceholder,
        promptPlaceholder: template.promptPlaceholder,
        optionalNodeToggles: template.optionalNodeToggles,
    }));
}

export function getActiveWorkflowId(journal: WorkbenchJournal): WorkflowTemplateId {
    return journal.activeWorkflowId || DEFAULT_WORKFLOW_TEMPLATE_ID;
}

export function getWorkflowDraftForTemplate(
    journal: WorkbenchJournal,
    templateId: WorkflowTemplateId,
): WorkflowDraft | null {
    return journal.workflowDrafts.find((draft) => draft.templateId === templateId) ?? null;
}

export function getWorkflowFlowData(
    journal: WorkbenchJournal,
    templateId: WorkflowTemplateId,
): EditableFlowData {
    return getWorkflowDraftForTemplate(journal, templateId)?.flowData
        ?? getWorkflowTemplateDefinition(templateId).flowData;
}

export function setActiveWorkflow(
    journal: WorkbenchJournal,
    payload: { templateId: WorkflowTemplateId },
    now = Date.now(),
): WorkbenchJournal {
    return {
        ...journal,
        updatedAt: toIso(now),
        activeWorkflowId: getWorkflowTemplateDefinition(payload.templateId).id,
    };
}

export function saveWorkflowDraft(
    journal: WorkbenchJournal,
    payload: {
        templateId: WorkflowTemplateId;
        flowData: EditableFlowData;
    },
    now = Date.now(),
): WorkbenchJournal {
    const updatedAt = toIso(now);
    const existing = getWorkflowDraftForTemplate(journal, payload.templateId);
    const nextDraft: WorkflowDraft = {
        templateId: payload.templateId,
        flowData: payload.flowData,
        updatedAt,
    };

    return {
        ...journal,
        updatedAt,
        workflowDrafts: existing
            ? journal.workflowDrafts.map((draft) => (draft.templateId === payload.templateId ? nextDraft : draft))
            : [...journal.workflowDrafts, nextDraft],
    };
}

export function getActiveRun(journal: WorkbenchJournal): WorkflowRun | null {
    return journal.runs.find((run) => run.id === journal.activeRunId) ?? null;
}

export function getLatestRunForWorktree(journal: WorkbenchJournal, worktreeId?: string): WorkflowRun | null {
    if (!worktreeId) {
        return null;
    }
    return journal.runs
        .filter((run) => run.worktreeTaskId === worktreeId)
        .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))[0]
        ?? null;
}

export function getVisibleRunForWorktree(journal: WorkbenchJournal, worktreeId?: string): WorkflowRun | null {
    const activeRun = getActiveRun(journal);
    if (!worktreeId) {
        return activeRun;
    }
    if (activeRun?.worktreeTaskId === worktreeId) {
        return activeRun;
    }
    return getLatestRunForWorktree(journal, worktreeId);
}

export function getRunNodeRecords(journal: WorkbenchJournal, runId?: string): NodeExecutionRecord[] {
    if (!runId) {
        return [];
    }
    return journal.nodeRecords.filter((record) => record.runId === runId);
}

export function getPendingDecisionForRun(journal: WorkbenchJournal, runId?: string): DecisionRequest | null {
    if (!runId) {
        return null;
    }
    return journal.decisions.find((decision) => decision.runId === runId && !decision.resolution) ?? null;
}

export function getArtifactBundleForRun(journal: WorkbenchJournal, runId?: string): ArtifactBundle | null {
    if (!runId) {
        return null;
    }
    const run = journal.runs.find((item) => item.id === runId);
    if (!run?.latestArtifactBundleId) {
        return null;
    }
    return journal.artifactBundles.find((bundle) => bundle.id === run.latestArtifactBundleId) ?? null;
}

export function getConversationSessionForWorktree(
    journal: WorkbenchJournal,
    worktreeId?: string,
    templateId: WorkflowTemplateId = DEFAULT_WORKFLOW_TEMPLATE_ID,
): ConversationSession | null {
    if (!worktreeId) {
        return null;
    }
    return journal.conversationSessions
        .filter((session) => session.worktreeTaskId === worktreeId && session.templateId === templateId)
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0]
        ?? null;
}

export function getConversationTurnsForSession(journal: WorkbenchJournal, sessionId?: string): ConversationTurn[] {
    if (!sessionId) {
        return [];
    }
    return journal.conversationTurns
        .filter((turn) => turn.sessionId === sessionId)
        .sort(sortConversationTurns);
}

export const RULE_SOURCE_OPTIONS: DecisionRequestOption[] = [
    {
        id: 'wiki',
        label: 'Wiki（推荐）',
        description: '沿用现有 Wiki 规则来源。',
        payload: {
            sourceKind: 'wiki',
            rawSourceSet: ['smashup-fandom-faction-page'],
        },
    },
    {
        id: 'pdf',
        label: '上传 PDF',
        description: '从 PDF 规则书提取。',
        payload: {
            sourceKind: 'pdf',
            rawSourceSet: ['uploaded-rulebook.pdf'],
        },
    },
    {
        id: 'document',
        label: '上传文档',
        description: '从文档内容提取。',
        payload: {
            sourceKind: 'document',
            rawSourceSet: ['uploaded-rules.md'],
        },
    },
    {
        id: 'other-url',
        label: '其他 URL',
        description: '从网页地址抓取。',
        payload: {
            sourceKind: 'other-url',
            rawSourceSet: ['https://example.com/faction-rules'],
        },
    },
];

function createId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}

function toIso(now = Date.now()): string {
    return new Date(now).toISOString();
}

function sanitizeFactionPathSegment(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || DEFAULT_WORKFLOW_TEMPLATE_ID;
}

function createPendingNodeRecord(runId: string, nodeId: WorkflowNodeId): NodeExecutionRecord {
    return {
        nodeId,
        runId,
        status: 'pending',
        attempt: 0,
        inputRef: `${nodeId}.input.pending`,
        inputSnapshot: {},
    };
}

function createSkippedNodeRecord(
    runId: string,
    nodeId: OptionalWorkflowNodeId,
    now: number,
): NodeExecutionRecord {
    return {
        nodeId,
        runId,
        status: 'skipped',
        attempt: 0,
        inputRef: `${nodeId}.input.skipped`,
        inputSnapshot: {
            skippedByUser: true,
        },
        outputRef: `${nodeId}.output.skipped`,
        outputSnapshot: {
            reason: 'disabled-before-run',
        },
        finishedAt: toIso(now),
    };
}

function resolveEnabledNodeIds(
    templateId: WorkflowTemplateId,
    nodeToggles?: Partial<Record<OptionalWorkflowNodeId, boolean>>,
): WorkflowNodeId[] {
    const template = getWorkflowTemplateDefinition(templateId);
    return template.nodeOrder.filter((nodeId) => {
        const toggle = template.optionalNodeToggles.find((item) => item.nodeId === nodeId);
        if (!toggle) {
            return true;
        }
        return nodeToggles?.[toggle.nodeId] ?? toggle.defaultEnabled;
    });
}

function syncManagedWorktree(
    journal: WorkbenchJournal,
    worktreeId: string,
    updater: (task: WorktreeTask) => WorktreeTask,
): WorkbenchJournal {
    const managedWorktrees = journal.managedWorktrees.map((task) => (
        task.id === worktreeId ? updater(task) : task
    ));
    const activeTask = managedWorktrees.find((task) => task.id === journal.repoSession.activeWorktreeId)
        ?? managedWorktrees[0];

    return {
        ...journal,
        managedWorktrees,
        repoSession: {
            ...journal.repoSession,
            activeWorktreeId: activeTask?.id,
        },
    };
}

function getActiveWorktreeTask(journal: WorkbenchJournal): WorktreeTask | undefined {
    return journal.managedWorktrees.find((task) => task.id === journal.repoSession.activeWorktreeId)
        ?? journal.managedWorktrees[0];
}

function getRuleSourceOption(optionId: RuleSourceOptionId): DecisionRequestOption {
    return RULE_SOURCE_OPTIONS.find((option) => option.id === optionId) ?? RULE_SOURCE_OPTIONS[0];
}

function getResolvedRuleSource(decision?: DecisionRequest): RuleSourceOptionId {
    if (!decision?.resolution) {
        return 'wiki';
    }
    return decision.resolution.optionId as RuleSourceOptionId;
}

function getRunDisplaySubject(run: WorkflowRun): string {
    return run.context.subject?.trim()
        || run.context.factionName?.trim()
        || '未命名任务';
}

function getRunPromptText(run: WorkflowRun): string {
    return run.context.prompt?.trim()
        || `启动 ${run.title}`;
}

function updateNodeRecord(
    journal: WorkbenchJournal,
    runId: string,
    nodeId: WorkflowNodeId,
    updater: (record: NodeExecutionRecord) => NodeExecutionRecord,
): WorkbenchJournal {
    return {
        ...journal,
        nodeRecords: journal.nodeRecords.map((record) => (
            record.runId === runId && record.nodeId === nodeId ? updater(record) : record
        )),
    };
}

function updateRun(
    journal: WorkbenchJournal,
    runId: string,
    updater: (run: WorkflowRun) => WorkflowRun,
): WorkbenchJournal {
    return {
        ...journal,
        runs: journal.runs.map((run) => (run.id === runId ? updater(run) : run)),
    };
}

function buildAcquireRuleMaterialOutput(factionName: string, sourceId: RuleSourceOptionId) {
    const option = getRuleSourceOption(sourceId);
    return {
        sourceKind: sourceId,
        rawSourceSet: option.payload.rawSourceSet,
        acquisitionMode: 'local-first-journal',
        summary: `${factionName} 已锁定 ${option.label} 作为规则来源。`,
    };
}

function buildNormalizedRuleCorpus(factionName: string, sourceId: RuleSourceOptionId) {
    return {
        sourceKind: sourceId,
        normalizedSections: [
            `${factionName} 的核心钩子是“离场后回收并再部署”。`,
            '每张牌都需要映射到统一的 faction definition 草案结构。',
            '规则来源必须保留来源索引和规范化摘要，避免只有聊天文本。',
        ],
        sourceMapping: [
            {
                sectionId: 'overview',
                sourceRef: sourceId,
                confidence: 'demo-fixture',
            },
        ],
    };
}

function buildAssetChecklist(factionName: string) {
    return [
        {
            item: `${factionName} 中文卡图`,
            status: 'missing',
            required: true,
            recoveryPath: '先走纯规则模式',
        },
        {
            item: `${factionName} 基地图`,
            status: 'missing',
            required: true,
            recoveryPath: '补素材后继续',
        },
        {
            item: `${factionName} locale 文案骨架`,
            status: 'ready',
            required: true,
            recoveryPath: 'n/a',
        },
    ];
}

function buildFactionDefinitionSnapshot(factionName: string, sourceId: RuleSourceOptionId) {
    return {
        factionName,
        gameId: 'smashup',
        sourceKind: sourceId,
        designHook: '离场回收 + 再部署节奏',
        mechanicPillars: ['回收已打出的随从', '延迟爆发', '资源留痕'],
        cardPackageSkeleton: {
            minions: 10,
            actions: 10,
            bases: 2,
        },
        reviewMode: 'mvp-structured-stub',
    };
}

function buildArtifactScreenshots(): ArtifactScreenshot[] {
    return [
        {
            id: 'e2e-waiting-decision',
            title: '会话工作流等待决策态',
            kind: 'e2e',
            stage: 'waiting_decision',
            absolutePath: joinWorkbenchPath(AI_REPO_WORKBENCH_E2E_ASSET_DIR, 'node-graph-waiting-decision.png'),
            assetPath: `${AI_REPO_WORKBENCH_E2E_ASSET_ROUTE}/node-graph-waiting-decision.png`,
            alt: 'AI 仓库工作台等待决策态工作流截图',
        },
        {
            id: 'e2e-completed',
            title: '会话工作流完成态',
            kind: 'e2e',
            stage: 'completed',
            absolutePath: joinWorkbenchPath(AI_REPO_WORKBENCH_E2E_ASSET_DIR, 'node-graph-complete.png'),
            assetPath: `${AI_REPO_WORKBENCH_E2E_ASSET_ROUTE}/node-graph-complete.png`,
            alt: 'AI 仓库工作台完成态工作流截图',
        },
    ];
}

function buildAutoNodeOutput(
    journal: WorkbenchJournal,
    run: WorkflowRun,
    nodeId: WorkflowNodeId,
): Record<string, unknown> {
    const decision = journal.decisions.find((item) => item.id === run.latestDecisionRequestId);
    const sourceId = getResolvedRuleSource(decision);
    const subject = getRunDisplaySubject(run);

    switch (nodeId) {
        case 'acquire-rule-material':
            return buildAcquireRuleMaterialOutput(subject, sourceId);
        case 'transcribe-or-normalize-rules':
            return {
                normalizedRuleCorpus: buildNormalizedRuleCorpus(subject, sourceId),
                normalizationMode: sourceId === 'wiki' ? 'wiki-ingest-ready' : 'document-ingest-ready',
            };
        case 'inspect-assets':
            return {
                assetChecklist: buildAssetChecklist(subject),
                selectedRecoveryPath: '先走纯规则模式',
                inspectionMode: 'structured_stub_but_domain_real',
            };
        case 'draft-faction-definition':
            return {
                factionDefinitionSnapshot: buildFactionDefinitionSnapshot(subject, sourceId),
                outputShape: 'ArtifactBundle-ready',
            };
        case 'review-faction-definition':
            return {
                reviewMode: 'auto_approval_stub',
                approvalStatus: 'approved_for_demo',
                explanation: '当前演示流自动通过定义复核。',
            };
        case 'run-e2e-validation':
            return {
                e2eStatus: 'passed_demo',
                validationMode: 'workflow-node-demo',
                summary: '已执行图片型 E2E 验证。',
            };
        default:
            return {};
    }
}

function createArtifactBundle(journal: WorkbenchJournal, run: WorkflowRun, now: number): ArtifactBundle {
    const template = getWorkflowTemplateDefinition(run.templateId);
    const decision = journal.decisions.find((item) => item.id === run.latestDecisionRequestId);
    const sourceId = getResolvedRuleSource(decision);
    const sourceOption = getRuleSourceOption(sourceId);
    const subject = getRunDisplaySubject(run);
    const e2eEnabled = run.enabledNodeIds.includes('run-e2e-validation');

    return {
        id: createId('artifact'),
        runId: run.id,
        title: `${subject} ArtifactBundle`,
        status: 'published',
        createdAt: toIso(now),
        summary: `已基于 ${sourceOption.label} 完成 ${template.title}，并返回截图与交付产物。`,
        outputs: {
            ruleSourceIndex: [
                {
                    sourceKind: sourceId,
                    label: sourceOption.label,
                    rawSourceSet: sourceOption.payload.rawSourceSet,
                    decisionMode: 'human-selected',
                },
            ],
            normalizedRuleCorpus: buildNormalizedRuleCorpus(subject, sourceId),
            assetChecklist: buildAssetChecklist(subject),
            factionDefinitionSnapshot: buildFactionDefinitionSnapshot(subject, sourceId),
            decisionLog: [
                {
                    decisionId: decision?.id ?? 'missing-decision',
                    title: decision?.title ?? '规则来源选择',
                    resolution: decision?.resolution ?? null,
                },
            ],
            screenshots: buildArtifactScreenshots(),
            e2eStatus: e2eEnabled ? 'passed_demo' : 'skipped',
        },
        evidenceRefs: [
            'RepoSession.local-fixture',
            'DecisionRequest.select-rule-source',
            e2eEnabled ? 'WorkflowNode.run-e2e-validation=enabled' : 'WorkflowNode.run-e2e-validation=skipped',
        ],
        keyObservations: [
            '当前纵切片把真实人工输入收敛到规则来源选择，定义复核节点只是自动通过的工作流占位。',
            '页面已经收敛成 Flowise 主画布加会话面板，不再维护额外的状态轨和节点检查器壳。',
            e2eEnabled
                ? '本轮用户开启了 E2E 节点，因此 ArtifactBundle 记录为 passed_demo。'
                : '本轮用户关闭了 E2E 节点，因此 ArtifactBundle 明确记录为 skipped，而不是隐式缺失。',
        ],
    };
}

function createConversationSessionId(worktreeTaskId: string, templateId: WorkflowTemplateId): string {
    return `conversation-session:${worktreeTaskId}:${templateId}`;
}

function mapRunStatusToConversationStatus(status: WorkflowRun['status']): ConversationSessionStatus {
    if (status === 'completed') {
        return 'completed';
    }
    if (status === 'waiting_decision') {
        return 'waiting_decision';
    }
    if (status === 'blocked' || status === 'failed' || status === 'cancelled') {
        return 'failed';
    }
    return 'running';
}

function getWorkflowRunStatusLabel(status: WorkflowRun['status']): string {
    switch (status) {
        case 'pending':
            return '待执行';
        case 'running':
            return '进行中';
        case 'waiting_decision':
            return '等待决策';
        case 'blocked':
            return '阻塞';
        case 'completed':
            return '已完成';
        case 'failed':
            return '失败';
        case 'cancelled':
            return '已取消';
        default:
            return status;
    }
}

function getDecisionCreatedAt(
    journal: WorkbenchJournal,
    run: WorkflowRun,
    decision: DecisionRequest,
): string {
    if (decision.createdAt) {
        return decision.createdAt;
    }
    return journal.nodeRecords.find((record) => (
        record.runId === run.id && record.nodeId === decision.nodeId
    ))?.startedAt ?? run.startedAt;
}

function getTurnPriority(kind: ConversationTurnKind): number {
    switch (kind) {
        case 'prompt':
            return 0;
        case 'status':
            return 1;
        case 'decision_request':
            return 2;
        case 'decision_resolution':
            return 3;
        case 'artifact':
            return 4;
        case 'error':
            return 5;
        default:
            return 9;
    }
}

function sortConversationTurns(left: ConversationTurn, right: ConversationTurn): number {
    const timeDelta = Date.parse(left.createdAt) - Date.parse(right.createdAt);
    if (timeDelta !== 0) {
        return timeDelta;
    }
    const priorityDelta = getTurnPriority(left.kind) - getTurnPriority(right.kind);
    if (priorityDelta !== 0) {
        return priorityDelta;
    }
    return left.id.localeCompare(right.id);
}

function buildNodeStatusContent(record: NodeExecutionRecord, template: WorkflowTemplateDefinition): string {
    const label = template.nodeDefinitions[record.nodeId].label;
    const summary = typeof record.outputSnapshot?.summary === 'string'
        ? record.outputSnapshot.summary
        : undefined;

    if (record.status === 'failed' || record.status === 'blocked') {
        return `${label}失败：${record.errorSummary || '未提供失败原因。'}`;
    }
    if (record.status === 'skipped') {
        return `${label}已跳过。`;
    }
    if (summary) {
        return summary;
    }
    return `${label}已完成。`;
}

function buildDecisionResolutionContent(decision: DecisionRequest): string | null {
    const resolution = decision.resolution;
    if (!resolution) {
        return null;
    }
    if (resolution.action === 'reject') {
        return resolution.notes?.trim()
            ? `我先驳回这一轮继续执行：${resolution.notes.trim()}`
            : '我先驳回这一轮继续执行。';
    }

    const prefix = resolution.optionLabel
        ? `我确认继续，选择：${resolution.optionLabel}。`
        : '我确认继续当前流程。';
    if (!resolution.notes?.trim()) {
        return prefix;
    }
    return `${prefix} 反馈：${resolution.notes.trim()}`;
}

function buildConversationTurnsForRun(
    journal: WorkbenchJournal,
    run: WorkflowRun,
    sessionId: string,
): ConversationTurn[] {
    const template = getWorkflowTemplateDefinition(run.templateId);
    const subject = getRunDisplaySubject(run);
    const prompt = getRunPromptText(run);
    const turns: ConversationTurn[] = [
        {
            id: `conversation-turn:${run.id}:prompt`,
            sessionId,
            runId: run.id,
            role: 'user',
            kind: 'prompt',
            title: template.title,
            content: prompt === subject ? `启动 ${template.title}：${subject}` : prompt,
            createdAt: run.startedAt,
        },
    ];

    const runNodeRecords = journal.nodeRecords
        .filter((record) => record.runId === run.id)
        .sort((left, right) => {
            const leftTime = Date.parse(left.finishedAt ?? left.startedAt ?? run.startedAt);
            const rightTime = Date.parse(right.finishedAt ?? right.startedAt ?? run.startedAt);
            if (leftTime !== rightTime) {
                return leftTime - rightTime;
            }
            return template.nodeOrder.indexOf(left.nodeId) - template.nodeOrder.indexOf(right.nodeId);
        });

    for (const record of runNodeRecords) {
        if (record.nodeId === 'select-rule-source' || record.nodeId === 'publish-artifact-bundle') {
            continue;
        }
        if (!['completed', 'failed', 'blocked'].includes(record.status)) {
            continue;
        }

        turns.push({
            id: `conversation-turn:${run.id}:node:${record.nodeId}:${record.status}`,
            sessionId,
            runId: run.id,
            role: record.status === 'failed' || record.status === 'blocked' ? 'system' : 'assistant',
            kind: record.status === 'failed' || record.status === 'blocked' ? 'error' : 'status',
            title: template.nodeDefinitions[record.nodeId].label,
            content: buildNodeStatusContent(record, template),
            nodeId: record.nodeId,
            status: record.status,
            createdAt: record.finishedAt ?? record.startedAt ?? run.startedAt,
        });
    }

    const runDecisions = journal.decisions
        .filter((decision) => decision.runId === run.id)
        .sort((left, right) => (
            Date.parse(getDecisionCreatedAt(journal, run, left)) - Date.parse(getDecisionCreatedAt(journal, run, right))
        ));

    for (const decision of runDecisions) {
        turns.push({
            id: `conversation-turn:${decision.id}:request`,
            sessionId,
            runId: run.id,
            role: 'assistant',
            kind: 'decision_request',
            title: decision.title,
            content: decision.summary,
            nodeId: decision.nodeId,
            decisionId: decision.id,
            status: decision.resolution ? 'completed' : 'waiting_decision',
            createdAt: getDecisionCreatedAt(journal, run, decision),
        });

        const resolutionContent = buildDecisionResolutionContent(decision);
        if (decision.resolution && resolutionContent) {
            turns.push({
                id: `conversation-turn:${decision.id}:resolution`,
                sessionId,
                runId: run.id,
                role: 'user',
                kind: 'decision_resolution',
                content: resolutionContent,
                nodeId: decision.nodeId,
                decisionId: decision.id,
                createdAt: decision.resolution.decidedAt,
            });
        }
    }

    const artifact = getArtifactBundleForRun(journal, run.id);
    if (artifact) {
        turns.push({
            id: `conversation-turn:${artifact.id}:artifact`,
            sessionId,
            runId: run.id,
            role: 'assistant',
            kind: 'artifact',
            title: artifact.title,
            content: artifact.summary,
            artifactBundleId: artifact.id,
            status: 'completed',
            createdAt: artifact.createdAt,
        });
    } else if (run.status === 'failed' || run.status === 'blocked' || run.status === 'cancelled') {
        turns.push({
            id: `conversation-turn:${run.id}:terminal-error`,
            sessionId,
            runId: run.id,
            role: 'system',
            kind: 'error',
            content: `本次运行未完成交付，当前状态：${getWorkflowRunStatusLabel(run.status)}。`,
            status: run.status,
            createdAt: run.finishedAt ?? run.startedAt,
        });
    }

    return turns.sort(sortConversationTurns);
}

function getRunConversationUpdatedAt(journal: WorkbenchJournal, run: WorkflowRun): string {
    const candidateTimes = [
        run.startedAt,
        run.finishedAt,
        ...journal.nodeRecords
            .filter((record) => record.runId === run.id)
            .flatMap((record) => [record.startedAt, record.finishedAt]),
        ...journal.decisions
            .filter((decision) => decision.runId === run.id)
            .flatMap((decision) => [decision.createdAt, decision.resolution?.decidedAt]),
        getArtifactBundleForRun(journal, run.id)?.createdAt,
    ].filter((value): value is string => Boolean(value));

    return candidateTimes.sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? run.startedAt;
}

export function syncWorkbenchConversationProjection(journal: WorkbenchJournal): WorkbenchJournal {
    const runs = [...journal.runs].sort((left, right) => Date.parse(left.startedAt) - Date.parse(right.startedAt));
    const sessionMap = new Map<string, ConversationSession>();
    const turns: ConversationTurn[] = [];

    for (const run of runs) {
        const sessionId = createConversationSessionId(run.worktreeTaskId, run.templateId);
        const nextTurns = buildConversationTurnsForRun(journal, run, sessionId);
        const updatedAt = getRunConversationUpdatedAt(journal, run);
        const existingSession = sessionMap.get(sessionId);

        sessionMap.set(sessionId, {
            id: sessionId,
            repoSessionId: run.repoSessionId,
            worktreeTaskId: run.worktreeTaskId,
            templateId: run.templateId,
            activeRunId: existingSession && Date.parse(existingSession.updatedAt) > Date.parse(updatedAt)
                ? existingSession.activeRunId
                : run.id,
            status: existingSession && Date.parse(existingSession.updatedAt) > Date.parse(updatedAt)
                ? existingSession.status
                : mapRunStatusToConversationStatus(run.status),
            createdAt: existingSession && Date.parse(existingSession.createdAt) < Date.parse(run.startedAt)
                ? existingSession.createdAt
                : run.startedAt,
            updatedAt: existingSession && Date.parse(existingSession.updatedAt) > Date.parse(updatedAt)
                ? existingSession.updatedAt
                : updatedAt,
        });

        turns.push(...nextTurns);
    }

    return {
        ...journal,
        conversationSessions: [...sessionMap.values()].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)),
        conversationTurns: turns.sort(sortConversationTurns),
    };
}

export const LOCAL_RUNTIME: LocalRuntime = {
    pauseForDecision(journal, payload, now = Date.now()) {
        const updatedAt = toIso(now);
        const updatedJournal = {
            ...journal,
            updatedAt,
            activeRunId: payload.run.id,
            runs: [...journal.runs, payload.run],
            nodeRecords: [...journal.nodeRecords, ...payload.nodeRecords],
            decisions: [...journal.decisions, payload.decision],
            artifactBundles: journal.artifactBundles,
        };
        return syncManagedWorktree(updatedJournal, payload.run.worktreeTaskId, (task) => ({
            ...task,
            status: 'paused',
            lastRunId: payload.run.id,
        }));
    },
    resumeRun(journal, payload, now = Date.now()) {
        const decision = journal.decisions.find((item) => item.id === payload.decisionId);
        if (!decision || decision.resolution) {
            return journal;
        }

        const run = journal.runs.find((item) => item.id === decision.runId);
        if (!run) {
            return journal;
        }

        const decidedAt = toIso(now);
        const option = payload.optionId ? getRuleSourceOption(payload.optionId) : undefined;
        const resolvedDecision: DecisionRequest = {
            ...decision,
            resolution: {
                action: payload.action,
                optionId: option?.id,
                optionLabel: option?.label,
                notes: payload.feedback?.trim() || undefined,
                decidedAt,
                decidedBy: 'owner',
            },
        };

        const withDecision = {
            ...journal,
            updatedAt: decidedAt,
            decisions: journal.decisions.map((item) => (item.id === decision.id ? resolvedDecision : item)),
        };

        if (payload.action === 'reject') {
            const withBlockedWorktree = syncManagedWorktree(withDecision, run.worktreeTaskId, (task) => ({
                ...task,
                status: 'failed',
            }));

            const withBlockedNode = updateNodeRecord(withBlockedWorktree, run.id, decision.nodeId, (record) => ({
                ...record,
                status: 'blocked',
                errorSummary: payload.feedback?.trim() || '人工拒绝继续当前节点。',
                stateRef: `${decision.nodeId}.state.rejected`,
                stateSnapshot: {
                    resumeToken: decision.resumeToken,
                    action: 'reject',
                    feedback: payload.feedback?.trim() || null,
                },
                finishedAt: decidedAt,
            }));

            return updateRun(withBlockedNode, run.id, (item) => ({
                ...item,
                status: 'blocked',
                checkpointVersion: item.checkpointVersion + 1,
                currentNodeId: decision.nodeId,
            }));
        }

        if (decision.nodeId !== 'select-rule-source' || !option) {
            return updateRun(withDecision, run.id, (item) => ({
                ...item,
                status: 'running',
                checkpointVersion: item.checkpointVersion + 1,
                currentNodeId: undefined,
            }));
        }

        const withRunningWorktree = syncManagedWorktree(withDecision, run.worktreeTaskId, (task) => ({
            ...task,
            status: 'running',
        }));

        const withCompletedNode = updateNodeRecord(withRunningWorktree, run.id, 'select-rule-source', (record) => ({
            ...record,
            status: 'completed',
            outputRef: 'select-rule-source.output.selection',
            outputSnapshot: {
                selectedSource: option.id,
                selectedLabel: option.label,
                rawSourceSet: option.payload.rawSourceSet,
            },
            stateRef: 'select-rule-source.state.resolved',
            stateSnapshot: {
                resumeToken: decision.resumeToken,
                resumeMode: 'idempotent',
            },
            finishedAt: decidedAt,
        }));

        return updateRun(withCompletedNode, run.id, (item) => ({
            ...item,
            status: 'running',
            checkpointVersion: item.checkpointVersion + 1,
            currentNodeId: undefined,
        }));
    },
    runNode(journal, payload, now = Date.now()) {
        const run = journal.runs.find((item) => item.id === payload.runId);
        if (!run) {
            return journal;
        }
        const outputSnapshot = buildAutoNodeOutput(journal, run, payload.nodeId);
        const finishedAt = toIso(now);
        const completedJournal = updateNodeRecord(journal, run.id, payload.nodeId, (record) => ({
            ...record,
            status: 'completed',
            outputRef: `${record.nodeId}.output.completed`,
            outputSnapshot,
            finishedAt,
        }));

        return updateRun(completedJournal, run.id, (item) => ({
            ...item,
            checkpointVersion: item.checkpointVersion + 1,
            currentNodeId: undefined,
        }));
    },
    publishArtifactBundle(journal, payload, now = Date.now()) {
        const run = journal.runs.find((item) => item.id === payload.runId);
        if (!run) {
            return journal;
        }

        const artifact = createArtifactBundle(journal, run, now);
        const finishedAt = toIso(now);

        const withCompletedPublishNode = updateNodeRecord(journal, run.id, payload.nodeId, (record) => ({
            ...record,
            status: 'completed',
            outputRef: 'publish-artifact-bundle.output.bundle',
            outputSnapshot: {
                artifactBundleId: artifact.id,
                summary: artifact.summary,
            },
            finishedAt,
        }));

        const withCompletedRun = updateRun(withCompletedPublishNode, run.id, (item) => ({
            ...item,
            status: 'completed',
            currentNodeId: undefined,
            finishedAt,
            checkpointVersion: item.checkpointVersion + 1,
            latestArtifactBundleId: artifact.id,
        }));

        return syncManagedWorktree({
            ...withCompletedRun,
            updatedAt: finishedAt,
            artifactBundles: [...withCompletedRun.artifactBundles, artifact],
        }, run.worktreeTaskId, (task) => ({
            ...task,
            status: 'completed',
            artifactBundleIds: [...task.artifactBundleIds, artifact.id],
            lastRunId: run.id,
        }));
    },
};

const LOCAL_WORKFLOW_ORCHESTRATOR = createLocalWorkflowOrchestrator({
    autoNodeDurationMs: AUTO_NODE_DURATION_MS,
    defaultTemplateId: DEFAULT_WORKFLOW_TEMPLATE_ID,
    localRuntime: LOCAL_RUNTIME,
    createId,
    toIso,
    sanitizeFactionPathSegment,
    createPendingNodeRecord,
    createSkippedNodeRecord,
    resolveEnabledNodeIds,
    syncManagedWorktree,
    getActiveWorktreeTask,
    updateNodeRecord,
    updateRun,
    getWorkflowTemplateDefinition,
    ruleSourceOptions: RULE_SOURCE_OPTIONS,
});

const WORKFLOW_ORCHESTRATOR: WorkflowOrchestrator = createLangGraphWorkflowOrchestrator({
    localOrchestrator: LOCAL_WORKFLOW_ORCHESTRATOR,
    createThreadId: () => createId('workflow-thread'),
    toIso,
});

function createInitialWorkflowDrafts(): WorkflowDraft[] {
    const updatedAt = toIso();
    return Object.values(WORKFLOW_TEMPLATE_REGISTRY).map((template) => ({
        templateId: template.id,
        flowData: template.flowData,
        updatedAt,
    }));
}

export function createInitialWorkbenchJournal(now = Date.now()): WorkbenchJournal {
    const createdAt = toIso(now);
    const repoSessionId = createId('repo-session');
    const worktreeTaskId = createId('worktree-task');
    const initialWorktreeTask: WorktreeTask = {
        id: worktreeTaskId,
        repoSessionId,
        label: '当前 AI 工作树',
        branchName: AI_REPO_WORKBENCH_BRANCH,
        worktreePath: AI_REPO_WORKBENCH_REPO_PATH,
        taskKind: DEFAULT_WORKFLOW_TEMPLATE_ID,
        status: 'ready',
        artifactBundleIds: [],
        managedBy: 'git-fixture',
    };

    return {
        schemaVersion: 6,
        updatedAt: createdAt,
        repoSession: {
            id: repoSessionId,
            sourceType: 'import-local',
            rootPath: AI_REPO_WORKBENCH_REPO_PATH,
            defaultBranch: 'main',
            activeWorktreeId: worktreeTaskId,
            repoFingerprint: 'ai-repo-workbench-local-fixture',
            createdAt,
            metadata: {
                repoName: 'BoardGame-wt-ai-repo-workbench',
                currentBranch: AI_REPO_WORKBENCH_BRANCH,
                productMode: 'local-first',
            },
        },
        managedWorktrees: [initialWorktreeTask],
        workflowDrafts: createInitialWorkflowDrafts(),
        activeWorkflowId: DEFAULT_WORKFLOW_TEMPLATE_ID,
        runs: [],
        nodeRecords: [],
        decisions: [],
        artifactBundles: [],
        conversationSessions: [],
        conversationTurns: [],
    };
}

type WorkbenchStorage = {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
};

function getWorkbenchStorage(): WorkbenchStorage | null {
    const runtimeGlobal = globalThis as { localStorage?: WorkbenchStorage };
    return runtimeGlobal.localStorage ?? null;
}

export function hydrateWorkbenchJournal(raw?: string | null): WorkbenchJournal {
    if (!raw) {
        return createInitialWorkbenchJournal();
    }

    try {
        const parsed = JSON.parse(raw) as
            | WorkbenchJournal
            | WorkbenchJournalV5
            | ({
                schemaVersion: 1;
                updatedAt: string;
                repoSession: RepoSession;
                worktreeTask: WorktreeTask;
                templates: WorkflowTemplateSummary[];
                runs: WorkflowRun[];
                nodeRecords: NodeExecutionRecord[];
                decisions: DecisionRequest[];
                artifactBundles: ArtifactBundle[];
                activeRunId?: string;
            })
            | ({
                schemaVersion: 2;
                updatedAt: string;
                repoSession: RepoSession;
                worktreeTask: WorktreeTask;
                managedWorktrees: WorktreeTask[];
                templates: WorkflowTemplateSummary[];
                runs: WorkflowRun[];
                nodeRecords: NodeExecutionRecord[];
                decisions: DecisionRequest[];
                artifactBundles: ArtifactBundle[];
                activeRunId?: string;
            })
            | ({
                schemaVersion: 3;
                updatedAt: string;
                repoSession: RepoSession;
                managedWorktrees: WorktreeTask[];
                templates?: WorkflowTemplateSummary[];
                runs: WorkflowRun[];
                nodeRecords: NodeExecutionRecord[];
                decisions: DecisionRequest[];
                artifactBundles: ArtifactBundle[];
                activeRunId?: string;
            })
            | ({
                schemaVersion: 4;
                updatedAt: string;
                repoSession: RepoSession;
                managedWorktrees: WorktreeTask[];
                runs: WorkflowRun[];
                nodeRecords: NodeExecutionRecord[];
                decisions: Array<DecisionRequest & { createdAt?: string }>;
                artifactBundles: ArtifactBundle[];
                activeRunId?: string;
            });
        if (parsed.schemaVersion === 1) {
            const migratedWorktree = {
                ...parsed.worktreeTask,
                label: '当前 AI 工作树',
                managedBy: 'git-fixture' as const,
            };
            return syncWorkbenchConversationProjection({
                schemaVersion: 6,
                updatedAt: parsed.updatedAt,
                managedWorktrees: [migratedWorktree],
                repoSession: {
                    ...parsed.repoSession,
                    activeWorktreeId: migratedWorktree.id,
                },
                workflowDrafts: createInitialWorkflowDrafts(),
                activeWorkflowId: DEFAULT_WORKFLOW_TEMPLATE_ID,
                runs: parsed.runs,
                nodeRecords: parsed.nodeRecords,
                decisions: parsed.decisions.map((decision) => ({
                    ...decision,
                    createdAt: decision.createdAt ?? parsed.runs.find((run) => run.id === decision.runId)?.startedAt ?? parsed.updatedAt,
                })),
                artifactBundles: parsed.artifactBundles,
                conversationSessions: [],
                conversationTurns: [],
                activeRunId: parsed.activeRunId,
            });
        }
        if (parsed.schemaVersion === 2) {
            return syncWorkbenchConversationProjection({
                schemaVersion: 6,
                updatedAt: parsed.updatedAt,
                repoSession: {
                    ...parsed.repoSession,
                    activeWorktreeId: parsed.repoSession.activeWorktreeId ?? parsed.managedWorktrees[0]?.id,
                },
                managedWorktrees: parsed.managedWorktrees,
                workflowDrafts: createInitialWorkflowDrafts(),
                activeWorkflowId: DEFAULT_WORKFLOW_TEMPLATE_ID,
                runs: parsed.runs,
                nodeRecords: parsed.nodeRecords,
                decisions: parsed.decisions.map((decision) => ({
                    ...decision,
                    createdAt: decision.createdAt ?? parsed.runs.find((run) => run.id === decision.runId)?.startedAt ?? parsed.updatedAt,
                })),
                artifactBundles: parsed.artifactBundles,
                conversationSessions: [],
                conversationTurns: [],
                activeRunId: parsed.activeRunId,
            });
        }
        if (parsed.schemaVersion === 3) {
            return syncWorkbenchConversationProjection({
                schemaVersion: 6,
                updatedAt: parsed.updatedAt,
                repoSession: parsed.repoSession,
                managedWorktrees: parsed.managedWorktrees,
                workflowDrafts: createInitialWorkflowDrafts(),
                activeWorkflowId: DEFAULT_WORKFLOW_TEMPLATE_ID,
                runs: parsed.runs,
                nodeRecords: parsed.nodeRecords,
                decisions: parsed.decisions.map((decision) => ({
                    ...decision,
                    createdAt: decision.createdAt ?? parsed.runs.find((run) => run.id === decision.runId)?.startedAt ?? parsed.updatedAt,
                })),
                artifactBundles: parsed.artifactBundles,
                conversationSessions: [],
                conversationTurns: [],
                activeRunId: parsed.activeRunId,
            });
        }
        if (parsed.schemaVersion === 4) {
            return syncWorkbenchConversationProjection({
                schemaVersion: 6,
                updatedAt: parsed.updatedAt,
                repoSession: parsed.repoSession,
                managedWorktrees: parsed.managedWorktrees,
                workflowDrafts: createInitialWorkflowDrafts(),
                activeWorkflowId: DEFAULT_WORKFLOW_TEMPLATE_ID,
                runs: parsed.runs,
                nodeRecords: parsed.nodeRecords,
                decisions: parsed.decisions.map((decision) => ({
                    ...decision,
                    createdAt: decision.createdAt ?? parsed.runs.find((run) => run.id === decision.runId)?.startedAt ?? parsed.updatedAt,
                })),
                artifactBundles: parsed.artifactBundles,
                conversationSessions: [],
                conversationTurns: [],
                activeRunId: parsed.activeRunId,
            });
        }
        if (parsed.schemaVersion !== 6 && parsed.schemaVersion !== 5) {
            return createInitialWorkbenchJournal();
        }
        const nextWorkflowDrafts = 'workflowDrafts' in parsed && Array.isArray(parsed.workflowDrafts)
            ? parsed.workflowDrafts
            : createInitialWorkflowDrafts();
        const nextActiveWorkflowId = 'activeWorkflowId' in parsed && typeof parsed.activeWorkflowId === 'string'
            ? parsed.activeWorkflowId
            : DEFAULT_WORKFLOW_TEMPLATE_ID;

        return syncWorkbenchConversationProjection({
            ...parsed,
            schemaVersion: 6,
            workflowDrafts: nextWorkflowDrafts,
            activeWorkflowId: nextActiveWorkflowId,
            decisions: parsed.decisions.map((decision) => ({
                ...decision,
                createdAt: decision.createdAt ?? parsed.runs.find((run) => run.id === decision.runId)?.startedAt ?? parsed.updatedAt,
            })),
            conversationSessions: parsed.conversationSessions ?? [],
            conversationTurns: parsed.conversationTurns ?? [],
        });
    } catch {
        return createInitialWorkbenchJournal();
    }
}

export function loadWorkbenchJournal(): WorkbenchJournal {
    const storage = getWorkbenchStorage();
    if (!storage) {
        return createInitialWorkbenchJournal();
    }
    return hydrateWorkbenchJournal(storage.getItem(AI_REPO_WORKBENCH_STORAGE_KEY));
}

export function persistWorkbenchJournal(journal: WorkbenchJournal): void {
    const storage = getWorkbenchStorage();
    if (!storage) {
        return;
    }
    storage.setItem(AI_REPO_WORKBENCH_STORAGE_KEY, JSON.stringify(journal));
}

export function resetWorkbenchJournal(now = Date.now()): WorkbenchJournal {
    const fresh = createInitialWorkbenchJournal(now);
    persistWorkbenchJournal(fresh);
    return fresh;
}

export function registerManagedWorktree(
    journal: WorkbenchJournal,
    payload: {
        branchName: string;
        worktreePath: string;
        label?: string;
    },
    now = Date.now(),
): WorkbenchJournal {
    const branchName = payload.branchName.trim();
    const worktreePath = payload.worktreePath.trim();
    if (!branchName || !worktreePath) {
        return journal;
    }

    const duplicate = journal.managedWorktrees.find((task) => (
        task.branchName === branchName || task.worktreePath.toLowerCase() === worktreePath.toLowerCase()
    ));
    if (duplicate) {
        return focusManagedWorktree(journal, { worktreeId: duplicate.id }, now);
    }

    const nextTask: WorktreeTask = {
        id: createId('worktree-task'),
        repoSessionId: journal.repoSession.id,
        label: payload.label?.trim() || branchName,
        branchName,
        worktreePath,
        taskKind: DEFAULT_WORKFLOW_TEMPLATE_ID,
        status: 'ready',
        artifactBundleIds: [],
        managedBy: 'journal-user',
    };

    const updatedAt = toIso(now);
    return {
        ...journal,
        updatedAt,
        managedWorktrees: [...journal.managedWorktrees, nextTask],
        repoSession: {
            ...journal.repoSession,
            activeWorktreeId: nextTask.id,
        },
    };
}

export function focusManagedWorktree(
    journal: WorkbenchJournal,
    payload: {
        worktreeId: string;
    },
    now = Date.now(),
): WorkbenchJournal {
    const target = journal.managedWorktrees.find((task) => task.id === payload.worktreeId);
    if (!target) {
        return journal;
    }

    return {
        ...journal,
        updatedAt: toIso(now),
        repoSession: {
            ...journal.repoSession,
            activeWorktreeId: target.id,
        },
    };
}

export async function startWorkflowRun(
    journal: WorkbenchJournal,
    payload: {
        templateId: WorkflowTemplateId;
        subject: string;
        prompt: string;
        projectPath?: string;
        nodeToggles?: Partial<Record<OptionalWorkflowNodeId, boolean>>;
    },
    now = Date.now(),
): Promise<WorkbenchJournal> {
    return syncWorkbenchConversationProjection(await WORKFLOW_ORCHESTRATOR.startWorkflowRun(journal, payload, now));
}

export async function startNewFactionRun(
    journal: WorkbenchJournal,
    payload: {
        factionName: string;
        projectPath?: string;
        nodeToggles?: Partial<Record<OptionalWorkflowNodeId, boolean>>;
    },
    now = Date.now(),
): Promise<WorkbenchJournal> {
    return startWorkflowRun(journal, {
        templateId: DEFAULT_WORKFLOW_TEMPLATE_ID,
        subject: payload.factionName,
        prompt: `创建派系：${payload.factionName}`,
        projectPath: payload.projectPath,
        nodeToggles: payload.nodeToggles,
    }, now);
}

export async function submitRuleSourceDecision(
    journal: WorkbenchJournal,
    payload: {
        decisionId: string;
        optionId: RuleSourceOptionId;
    },
    now = Date.now(),
): Promise<WorkbenchJournal> {
    return await WORKFLOW_ORCHESTRATOR.submitDecision(journal, {
        decisionId: payload.decisionId,
        action: 'proceed',
        optionId: payload.optionId,
    }, now);
}

export async function submitDecision(
    journal: WorkbenchJournal,
    payload: {
        decisionId: string;
        action: 'proceed' | 'reject';
        optionId?: RuleSourceOptionId;
        feedback?: string;
    },
    now = Date.now(),
): Promise<WorkbenchJournal> {
    return syncWorkbenchConversationProjection(await WORKFLOW_ORCHESTRATOR.submitDecision(journal, payload, now));
}

export async function advanceWorkbenchJournal(journal: WorkbenchJournal, now = Date.now()): Promise<WorkbenchJournal> {
    return syncWorkbenchConversationProjection(await WORKFLOW_ORCHESTRATOR.advance(journal, now));
}
