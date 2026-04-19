import { ConflictException, Inject, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { access, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { resolveFlowHostCatalog } from '../../../../../src/features/ai-repo-workbench/flowiseForkBaseline';
import {
    createInitialWorkbenchJournal,
    focusManagedWorktree,
    getWorkflowTemplateDefinition,
    hydrateWorkbenchJournal,
    registerManagedWorktree,
    saveWorkflowDraft as saveWorkflowDraftToJournal,
    setActiveWorkflow,
    syncWorkbenchConversationProjection,
    type EditableFlowData,
    type OptionalWorkflowNodeId,
    type RuleSourceOptionId,
    type WorkbenchJournal,
    type WorkflowNodeId,
    type WorktreeTask,
} from '../../../../../src/features/ai-repo-workbench/runtime';
import { AiRepoWorkbenchExecutorService } from './ai-repo-workbench-executor.service';
import { type AssetInspectionResult, NewFactionLangGraphOrchestrator } from './langgraph-orchestrator';
import { syncGraphResultToJournalPatch } from './langgraph-journal-sync';

const execFileAsync = promisify(execFile);

type GitWorktreeEntry = {
    path: string;
    branchName?: string;
    detached: boolean;
};

@Injectable()
export class AiRepoWorkbenchService {
    private readonly logger = new Logger(AiRepoWorkbenchService.name);
    private readonly repoRoot = process.cwd();
    private readonly journalPath = resolve(this.repoRoot, 'temp/ai-repo-workbench/workbench-journal.json');
    private readonly e2eAssetDir = resolve(this.repoRoot, 'evidence/_shared/assets/ai-repo-workbench-e2e');
    private readonly orchestrator: NewFactionLangGraphOrchestrator;

    constructor(@Inject(AiRepoWorkbenchExecutorService) private readonly executorService: AiRepoWorkbenchExecutorService) {
        const inspectFactionAssets = this.inspectFactionAssets.bind(this) as (
            payload: Parameters<AiRepoWorkbenchService['inspectFactionAssets']>[0]
        ) => Promise<AssetInspectionResult>;
        const executeDataEntry = this.executorService.executeDataEntry.bind(this.executorService);
        const executeReferenceFaction = this.executorService.executeReferenceFaction.bind(this.executorService);
        const executeImplementation = this.executorService.executeImplementation.bind(this.executorService);
        const executeAudit = this.executorService.executeAudit.bind(this.executorService);
        const executeUpload = this.executorService.executeUpload.bind(this.executorService);
        this.orchestrator = new NewFactionLangGraphOrchestrator({
            inspectFactionAssets,
            executeDataEntry,
            executeReferenceFaction,
            executeImplementation,
            executeAudit,
            executeUpload,
        });
    }

    async getJournal(): Promise<WorkbenchJournal> {
        return this.loadJournal();
    }

    async getHostCatalog() {
        return resolveFlowHostCatalog();
    }

    async resetJournal(now = Date.now()): Promise<WorkbenchJournal> {
        const fresh = await this.createServerInitialJournal(now);
        await this.saveJournal(fresh);
        return fresh;
    }

    async registerWorktree(
        payload: {
            branchName: string;
            worktreePath: string;
            label?: string;
        },
        now = Date.now(),
    ): Promise<WorkbenchJournal> {
        let journal = await this.loadJournal();
        const branchName = payload.branchName.trim();
        const worktreePath = resolve(payload.worktreePath.trim());
        if (!branchName || !worktreePath) {
            return journal;
        }

        const actualWorktrees = await this.listGitWorktrees();
        const discovered = actualWorktrees.find((entry) => (
            this.samePath(entry.path, worktreePath) || (!!entry.branchName && entry.branchName === branchName)
        ));

        if (!discovered) {
            await this.ensureTargetPathReady(worktreePath);
            const branchExists = await this.branchExists(branchName);
            const baseRef = journal.repoSession.defaultBranch || 'main';
            const args = branchExists
                ? ['worktree', 'add', worktreePath, branchName]
                : ['worktree', 'add', worktreePath, '-b', branchName, baseRef];
            await this.runGit(args);
        }

        journal = registerManagedWorktree(journal, {
            branchName,
            worktreePath,
            label: payload.label,
        }, now);
        journal = this.markWorktreeManagedBy(journal, journal.repoSession.activeWorktreeId, 'git-runtime');
        await this.saveJournal(journal);
        return journal;
    }

    async focusWorktree(worktreeId: string, now = Date.now()): Promise<WorkbenchJournal> {
        const journal = focusManagedWorktree(await this.loadJournal(), { worktreeId }, now);
        await this.saveJournal(journal);
        return journal;
    }

    async focusWorkflow(workflowId: string, now = Date.now()): Promise<WorkbenchJournal> {
        const journal = setActiveWorkflow(await this.loadJournal(), { templateId: workflowId }, now);
        await this.saveJournal(journal);
        return journal;
    }

    async saveWorkflowDraftForJournal(
        journal: WorkbenchJournal,
        workflowId: string,
        flowData: EditableFlowData,
        now = Date.now(),
    ): Promise<WorkbenchJournal> {
        return saveWorkflowDraftToJournal(journal, { templateId: workflowId, flowData }, now);
    }

    async saveWorkflowDraft(
        workflowId: string,
        flowData: Record<string, unknown>,
        now = Date.now(),
    ): Promise<WorkbenchJournal> {
        const journal = await this.loadJournal();
        const nextJournal = await this.saveWorkflowDraftForJournal(
            journal,
            workflowId,
            flowData as unknown as EditableFlowData,
            now,
        );
        await this.saveJournal(nextJournal);
        return nextJournal;
    }

    async startWorkflow(
        payload: {
            workflowId: string;
            subject: string;
            prompt: string;
            projectPath?: string;
            nodeToggles?: Partial<Record<OptionalWorkflowNodeId, boolean>>;
        },
        now = Date.now(),
    ): Promise<WorkbenchJournal> {
        let journal = await this.loadJournal();
        if (payload.projectPath?.trim()) {
            journal = await this.ensureManagedProjectPath(journal, payload.projectPath, now);
        }

        const activeWorktree = this.getActiveWorktreeTask(journal);
        if (!activeWorktree) {
            this.logger.warn('startWorkflow: no active worktree, returning unchanged journal');
            return journal;
        }

        const template = getWorkflowTemplateDefinition(payload.workflowId);
        if (!template.runnable) {
            throw new ConflictException(`工作流 ${template.title} 当前只开放 Flow 编辑，执行器尚未接入。`);
        }

        const enabledNodeIds = this.resolveEnabledNodeIds(template.id, payload.nodeToggles);

        try {
            const result = await this.orchestrator.startRun({
                factionName: payload.subject.trim() || '未命名任务',
                promptText: payload.prompt.trim() || payload.subject.trim() || '未命名任务',
                gameId: 'smashup',
                worktreePath: activeWorktree.worktreePath,
                branchName: activeWorktree.branchName,
                repoSessionId: journal.repoSession.id,
                worktreeTaskId: activeWorktree.id,
                enabledNodeIds,
                templateId: template.id,
            });

            const patch = syncGraphResultToJournalPatch(result);
            const nextJournal = this.applyPatchToJournal({
                ...journal,
                activeWorkflowId: template.id,
            }, patch, activeWorktree.id, payload.prompt, payload.subject);
            await this.saveJournal(nextJournal);
            this.logger.log(`startWorkflow: run ${patch.run.id} created, interrupted=${result.interrupted}, thread=${result.threadId}`);
            return nextJournal;
        } catch (error) {
            this.logger.error('startWorkflow: LangGraph execution failed', error);
            throw new InternalServerErrorException('LangGraph workflow execution failed');
        }
    }

    async submitDecision(
        payload: {
            decisionId: string;
            action: 'proceed' | 'reject';
            optionId?: RuleSourceOptionId;
            feedback?: string;
        },
        _now = Date.now(),
    ): Promise<WorkbenchJournal> {
        const journal = await this.loadJournal();
        const run = this.findRunByDecisionId(journal, payload.decisionId);
        if (!run) {
            this.logger.warn(`submitDecision: no run found for decision ${payload.decisionId}`);
            return journal;
        }

        const threadId = run.orchestrator?.engine === 'langgraph'
            ? run.orchestrator.threadId
            : undefined;

        if (!threadId) {
            this.logger.warn(`submitDecision: no LangGraph threadId for run ${run.id}`);
            return journal;
        }

        try {
            const result = await this.orchestrator.resumeDecision(threadId, {
                action: payload.action,
                optionId: payload.optionId,
                feedback: payload.feedback?.trim() || undefined,
            });

            const patch = syncGraphResultToJournalPatch(result);
            const nextJournal = this.applyPatchToJournal(journal, patch, run.worktreeTaskId);
            await this.saveJournal(nextJournal);
            this.logger.log(`submitDecision: run ${run.id} resumed, status=${patch.run.status}`);
            return nextJournal;
        } catch (error) {
            this.logger.error('submitDecision: LangGraph resume failed', error);
            throw new InternalServerErrorException('LangGraph resume failed');
        }
    }

    async advance(_now = Date.now()): Promise<WorkbenchJournal> {
        return this.loadJournal();
    }

    async inspectFactionAssets(payload: {
        ttsPackPath?: string;
        gameId?: string;
        projectPath?: string;
        factionOutline?: string;
        enableWikiComparison?: boolean;
        enableDocLookup?: boolean;
        extraDataSources?: string;
    }) {
        const rawPath = payload.ttsPackPath?.trim() || '';
        const inspectedPath = rawPath ? resolve(rawPath) : '';
        const projectRoot = payload.projectPath?.trim() ? resolve(payload.projectPath.trim()) : this.repoRoot;
        const gameId = (payload.gameId?.trim() || 'smashup').toLowerCase();
        const factionNames = this.extractFactionNames(payload.factionOutline || '');
        const imageFiles = rawPath ? await this.collectImageFiles(inspectedPath) : [];
        const workflowDocPath = resolve(projectRoot, 'docs', 'workflows', `${gameId}-faction-intake.md`);
        const ruleDirPath = resolve(projectRoot, 'src', 'games', gameId, 'rule');
        const workflowDocExists = await this.pathExists(workflowDocPath);
        const ruleDirExists = await this.pathExists(ruleDirPath);

        const notes: string[] = [];
        const decisionReasons: string[] = [];
        if (!rawPath) {
            notes.push('未提供图包路径，本轮可先按纯规则 / 文档链继续。');
        }
        if (rawPath && !imageFiles.length) {
            decisionReasons.push('目标路径下未识别到图片文件，请确认路径是否正确或素材是否尚未整理。');
        }
        if (rawPath && gameId === 'smashup') {
            const hasBaseAtlas = imageFiles.some((file) => file.name.toLowerCase().includes('base'));
            if (!hasBaseAtlas) {
                decisionReasons.push('Smash Up intake 通常至少需要一张基地 atlas，请确认图包是否完整。');
            }
            if (imageFiles.length > 0 && imageFiles.length < 2) {
                decisionReasons.push('当前只识别到 1 张图片，通常还需要成对的卡牌 / 基地图。');
            }
        }
        if (payload.enableDocLookup !== false && !workflowDocExists && !ruleDirExists) {
            notes.push(`仓库内暂未找到 ${gameId} 对应的 intake workflow 或 rule 文档目录。`);
        }

        const docHints = [
            {
                kind: 'workflow',
                exists: workflowDocExists,
                path: workflowDocPath,
            },
            {
                kind: 'ruleDir',
                exists: ruleDirExists,
                path: ruleDirPath,
            },
        ];

        const requiresDecision = decisionReasons.length > 0;
        const legacyStatus = requiresDecision ? 'needs_user_direction' : 'ready_for_next_stage';
        const summaryLines = [
            rawPath ? `检查路径：${inspectedPath}` : '检查路径：未提供（按纯规则 / 文档链继续）',
            `识别图片：${rawPath ? `${imageFiles.length} 张` : '未检查'}`,
            `目标派系：${factionNames.length ? factionNames.join('、') : '未解析到明确派系名'}`,
            `doc / rule：${docHints.filter((hint) => hint.exists).map((hint) => hint.kind).join(' + ') || '未命中'}`,
            requiresDecision
                ? `需要人工裁决：${decisionReasons.join('；')}`
                : notes.length
                ? `补充说明：${notes.join('；')}`
                : '素材检查未发现必须阻塞流程的问题，可自动继续下一阶段。',
        ];

        return {
            status: rawPath ? 'inspected' : 'skipped_optional_path',
            inspectedPath,
            gameId,
            declaredFactions: factionNames,
            imageFiles,
            docHints,
            enableWikiComparison: payload.enableWikiComparison !== false,
            enableDocLookup: payload.enableDocLookup !== false,
            extraDataSources: payload.extraDataSources?.trim() || '',
            legacyComparison: {
                status: legacyStatus,
                reasoning: requiresDecision
                    ? decisionReasons
                    : notes.length
                    ? notes
                    : ['素材检查未发现必须阻塞流程的问题。'],
            },
            requiresDecision,
            recommendedAction: requiresDecision ? 'reject' : 'proceed',
            nextStepHints: requiresDecision
                ? [
                    '确认图片是否需要重切、补图或更换 atlas 命名。',
                    '如暂时无法补素材，可决定是否先走纯规则模式。',
                    '补齐素材后可继续沿旧 intake 方式推进。',
                ]
                : [
                    '继续进入数据录入阶段。',
                    '数据录入默认优先读取 doc / rule，再按配置做 Wiki 对照。',
                    '若后续发现图片主真相源与对照源冲突，再在录入结束后统一汇总。',
                ],
            summary: summaryLines.join(' | '),
            summaryMarkdown: summaryLines.map((line) => `- ${line}`).join('\n'),
        };
    }

    async getE2eAssetFile(name: string): Promise<{ filePath: string; contentType: string }> {
        const safeName = basename(name);
        if (safeName !== name) {
            throw new NotFoundException('图片不存在');
        }

        const filePath = resolve(this.e2eAssetDir, safeName);
        if (!filePath.startsWith(this.e2eAssetDir)) {
            throw new NotFoundException('图片不存在');
        }

        try {
            await access(filePath);
        } catch {
            throw new NotFoundException(`未找到 E2E 截图：${safeName}`);
        }

        const extension = extname(filePath).toLowerCase();
        const contentType = extension === '.png'
            ? 'image/png'
            : extension === '.webp'
                ? 'image/webp'
                : extension === '.jpg' || extension === '.jpeg'
                    ? 'image/jpeg'
                    : 'application/octet-stream';

        return { filePath, contentType };
    }

    // ── LangGraph helpers ───────────────────────────────────────────────

    private getActiveWorktreeTask(journal: WorkbenchJournal): WorktreeTask | undefined {
        return journal.managedWorktrees.find((t) => t.id === journal.repoSession.activeWorktreeId)
            ?? journal.managedWorktrees[0];
    }

    private extractFactionNames(rawOutline: string): string[] {
        const normalized = rawOutline
            .replace(/<[^>]+>/g, '\n')
            .split(/[\n,，;；、]+/)
            .map((part) => part.trim())
            .filter(Boolean);

        return Array.from(new Set(normalized));
    }

    private async pathExists(targetPath: string): Promise<boolean> {
        try {
            await access(targetPath);
            return true;
        } catch {
            return false;
        }
    }

    private async collectImageFiles(targetPath: string): Promise<Array<{
        name: string;
        absolutePath: string;
        relativePath: string;
        ext: string;
        sizeBytes: number;
    }>> {
        if (!(await this.pathExists(targetPath))) {
            return [];
        }

        const targetStat = await stat(targetPath);
        const imageExts = new Set(['.png', '.jpg', '.jpeg', '.webp']);
        const files: Array<{
            name: string;
            absolutePath: string;
            relativePath: string;
            ext: string;
            sizeBytes: number;
        }> = [];

        if (targetStat.isFile()) {
            const ext = extname(targetPath).toLowerCase();
            if (!imageExts.has(ext)) {
                return [];
            }

            files.push({
                name: basename(targetPath),
                absolutePath: targetPath,
                relativePath: basename(targetPath),
                ext,
                sizeBytes: targetStat.size,
            });
            return files;
        }

        const walk = async (currentPath: string, depth: number) => {
            const entries = await readdir(currentPath, { withFileTypes: true });
            for (const entry of entries) {
                const entryPath = resolve(currentPath, entry.name);
                if (entry.isDirectory()) {
                    if (depth < 2) {
                        await walk(entryPath, depth + 1);
                    }
                    continue;
                }

                const ext = extname(entry.name).toLowerCase();
                if (!imageExts.has(ext)) {
                    continue;
                }
                const fileStat = await stat(entryPath);
                files.push({
                    name: entry.name,
                    absolutePath: entryPath,
                    relativePath: relative(targetPath, entryPath) || entry.name,
                    ext,
                    sizeBytes: fileStat.size,
                });
            }
        };

        await walk(targetPath, 0);
        return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
    }

    private findRunByDecisionId(journal: WorkbenchJournal, decisionId: string) {
        const decision = journal.decisions.find((d) => d.id === decisionId);
        if (decision) {
            return journal.runs.find((r) => r.id === decision.runId);
        }
        return journal.runs.find((r) => r.latestDecisionRequestId === decisionId);
    }

    private resolveEnabledNodeIds(
        templateId: string,
        nodeToggles?: Partial<Record<OptionalWorkflowNodeId, boolean>>,
    ): WorkflowNodeId[] {
        const template = getWorkflowTemplateDefinition(templateId);
        return template.nodeOrder.filter((nodeId) => {
            const toggle = template.optionalNodeToggles.find((t) => t.nodeId === nodeId);
            if (!toggle) return true;
            return nodeToggles?.[toggle.nodeId] ?? toggle.defaultEnabled;
        });
    }

    private applyPatchToJournal(
        journal: WorkbenchJournal,
        patch: ReturnType<typeof syncGraphResultToJournalPatch>,
        worktreeTaskId: string,
        prompt?: string,
        subject?: string,
    ): WorkbenchJournal {
        const now = new Date().toISOString();
        const existingRun = journal.runs.find((run) => run.id === patch.run.id);
        const nextSubject = subject
            ?? patch.run.context.subject
            ?? existingRun?.context.subject
            ?? patch.run.context.factionName
            ?? existingRun?.context.factionName
            ?? '未命名任务';
        const nextPrompt = prompt
            ?? patch.run.context.prompt
            ?? existingRun?.context.prompt
            ?? `启动 ${patch.run.templateId}：${nextSubject}`;
        const patchedRun = {
            ...existingRun,
            ...patch.run,
            title: patch.run.title || existingRun?.title || `${nextSubject} / ${patch.run.templateId}`,
            context: {
                ...existingRun?.context,
                ...patch.run.context,
                subject: nextSubject,
                prompt: nextPrompt,
                factionName: patch.run.context.factionName ?? existingRun?.context.factionName ?? nextSubject,
            },
        };

        const existingRunIndex = journal.runs.findIndex((r) => r.id === patch.run.id);
        const runs = existingRunIndex >= 0
            ? journal.runs.map((r, i) => (i === existingRunIndex ? patchedRun as WorkbenchJournal['runs'][number] : r))
            : [...journal.runs, patchedRun as WorkbenchJournal['runs'][number]];

        const existingNodeIds = new Set(
            journal.nodeRecords.filter((r) => r.runId === patch.run.id).map((r) => r.nodeId),
        );
        const nodeRecords = existingNodeIds.size > 0
            ? journal.nodeRecords
                .filter((r) => r.runId !== patch.run.id)
                .concat(patch.nodeRecords as WorkbenchJournal['nodeRecords'])
            : [...journal.nodeRecords, ...(patch.nodeRecords as WorkbenchJournal['nodeRecords'])];

        const existingDecisionIds = new Set(journal.decisions.map((d) => d.id));
        const newDecisions = patch.decisions.filter((d) => !existingDecisionIds.has(d.id));
        const updatedDecisions = journal.decisions.map((d) => {
            const patchVersion = patch.decisions.find((pd) => pd.id === d.id);
            return patchVersion ? (patchVersion as WorkbenchJournal['decisions'][number]) : d;
        });
        const decisions = [...updatedDecisions, ...(newDecisions as WorkbenchJournal['decisions'])];

        const artifactBundles = patch.artifactBundle
            ? [...journal.artifactBundles, patch.artifactBundle as WorkbenchJournal['artifactBundles'][number]]
            : journal.artifactBundles;

        const worktreeStatus = patch.run.status === 'completed' ? 'completed' as const
            : patch.run.status === 'waiting_decision' ? 'paused' as const
            : 'running' as const;

        const managedWorktrees = journal.managedWorktrees.map((t) =>
            t.id === worktreeTaskId
                ? { ...t, status: worktreeStatus, lastRunId: patch.run.id }
                : t,
        );

        return syncWorkbenchConversationProjection({
            ...journal,
            updatedAt: now,
            activeRunId: patch.activeRunId,
            runs,
            nodeRecords,
            decisions,
            artifactBundles,
            managedWorktrees,
        });
    }

    // ── Journal persistence ─────────────────────────────────────────────

    private async loadJournal(): Promise<WorkbenchJournal> {
        try {
            const raw = await readFile(this.journalPath, 'utf8');
            return this.normalizeJournal(hydrateWorkbenchJournal(raw));
        } catch {
            const fresh = await this.createServerInitialJournal();
            await this.saveJournal(fresh);
            return fresh;
        }
    }

    private async saveJournal(journal: WorkbenchJournal): Promise<void> {
        await mkdir(dirname(this.journalPath), { recursive: true });
        await writeFile(this.journalPath, JSON.stringify(journal, null, 2), 'utf8');
    }

    private async createServerInitialJournal(now = Date.now()): Promise<WorkbenchJournal> {
        const currentBranch = await this.getCurrentBranch();
        const gitCommonDir = await this.getGitCommonDir();
        const fresh = createInitialWorkbenchJournal(now);
        const firstWorktree = fresh.managedWorktrees[0];

        return {
            ...fresh,
            repoSession: {
                ...fresh.repoSession,
                rootPath: this.repoRoot,
                repoFingerprint: gitCommonDir,
                metadata: {
                    ...fresh.repoSession.metadata,
                    repoName: basename(this.repoRoot),
                    currentBranch,
                },
            },
            managedWorktrees: firstWorktree
                ? [{
                    ...firstWorktree,
                    branchName: currentBranch,
                    worktreePath: this.repoRoot,
                    managedBy: 'git-runtime',
                }]
                : [],
        };
    }

    private normalizeJournal(journal: WorkbenchJournal): WorkbenchJournal {
        const rootPath = journal.repoSession.rootPath || journal.managedWorktrees[0]?.worktreePath || this.repoRoot;
        return syncWorkbenchConversationProjection({
            ...journal,
            repoSession: {
                ...journal.repoSession,
                rootPath,
                metadata: {
                    ...journal.repoSession.metadata,
                    repoName: basename(rootPath),
                },
                activeWorktreeId: journal.repoSession.activeWorktreeId ?? journal.managedWorktrees[0]?.id,
            },
        });
    }

    private async ensureManagedProjectPath(
        journal: WorkbenchJournal,
        projectPath: string,
        now = Date.now(),
    ): Promise<WorkbenchJournal> {
        const resolvedProjectPath = resolve(projectPath.trim());
        if (!resolvedProjectPath) {
            return journal;
        }

        const targetStat = await stat(resolvedProjectPath).catch(() => null);
        if (!targetStat) {
            throw new NotFoundException(`目标项目目录不存在：${resolvedProjectPath}`);
        }
        if (!targetStat.isDirectory()) {
            throw new ConflictException(`目标项目路径不是目录：${resolvedProjectPath}`);
        }

        const inferredBranchName = await this.getCurrentBranchForPath(resolvedProjectPath);
        const inferredFingerprint = await this.getGitCommonDirForPath(resolvedProjectPath);
        const inferredRepoName = basename(resolvedProjectPath);
        const existingTask = journal.managedWorktrees.find((task) => this.samePath(task.worktreePath, resolvedProjectPath));

        const nextJournal = existingTask
            ? focusManagedWorktree(journal, { worktreeId: existingTask.id }, now)
            : registerManagedWorktree(journal, {
                branchName: inferredBranchName,
                worktreePath: resolvedProjectPath,
                label: inferredRepoName,
            }, now);

        return {
            ...nextJournal,
            repoSession: {
                ...nextJournal.repoSession,
                rootPath: resolvedProjectPath,
                repoFingerprint: inferredFingerprint,
                metadata: {
                    ...nextJournal.repoSession.metadata,
                    repoName: inferredRepoName,
                    currentBranch: inferredBranchName,
                },
            },
        };
    }

    private markWorktreeManagedBy(
        journal: WorkbenchJournal,
        worktreeId: string | undefined,
        managedBy: WorktreeTask['managedBy'],
    ): WorkbenchJournal {
        if (!worktreeId) {
            return journal;
        }
        return {
            ...journal,
            managedWorktrees: journal.managedWorktrees.map((task) => (
                task.id === worktreeId
                    ? {
                        ...task,
                        managedBy,
                    }
                    : task
            )),
        };
    }

    private async ensureTargetPathReady(targetPath: string): Promise<void> {
        try {
            await access(targetPath);
        } catch {
            await mkdir(dirname(targetPath), { recursive: true });
            return;
        }

        const entries = await readdir(targetPath);
        if (entries.length > 0) {
            throw new ConflictException(`目标路径已存在且非空，不能直接创建 git worktree: ${targetPath}`);
        }
    }

    private async branchExists(branchName: string): Promise<boolean> {
        try {
            await this.runGit(['show-ref', '--verify', '--quiet', `refs/heads/${branchName}`]);
            return true;
        } catch {
            return false;
        }
    }

    private async getCurrentBranch(): Promise<string> {
        return this.getCurrentBranchForPath(this.repoRoot);
    }

    private async getCurrentBranchForPath(targetPath: string): Promise<string> {
        try {
            const { stdout } = await this.runGitInPath(['rev-parse', '--abbrev-ref', 'HEAD'], targetPath);
            const branchName = stdout.trim();
            return branchName && branchName !== 'HEAD' ? branchName : basename(targetPath);
        } catch {
            return basename(targetPath);
        }
    }

    private async getGitCommonDir(): Promise<string> {
        return this.getGitCommonDirForPath(this.repoRoot);
    }

    private async getGitCommonDirForPath(targetPath: string): Promise<string> {
        try {
            const { stdout } = await this.runGitInPath(['rev-parse', '--git-common-dir'], targetPath);
            return resolve(targetPath, stdout.trim() || '.git');
        } catch {
            return resolve(targetPath);
        }
    }

    private async listGitWorktrees(): Promise<GitWorktreeEntry[]> {
        const { stdout } = await this.runGit(['worktree', 'list', '--porcelain']);
        const entries: GitWorktreeEntry[] = [];
        const blocks = stdout.split(/\r?\n\r?\n/).map((block) => block.trim()).filter(Boolean);
        for (const block of blocks) {
            const entry: GitWorktreeEntry = {
                path: '',
                detached: false,
            };
            for (const line of block.split(/\r?\n/)) {
                if (line.startsWith('worktree ')) {
                    entry.path = resolve(line.slice('worktree '.length).trim());
                } else if (line.startsWith('branch ')) {
                    entry.branchName = line.slice('branch '.length).trim().replace('refs/heads/', '');
                } else if (line === 'detached') {
                    entry.detached = true;
                }
            }
            if (entry.path) {
                entries.push(entry);
            }
        }
        return entries;
    }

    private samePath(left: string, right: string) {
        return resolve(left).toLowerCase() === resolve(right).toLowerCase();
    }

    private async runGit(args: string[]) {
        return this.runGitInPath(args, this.repoRoot);
    }

    private async runGitInPath(args: string[], cwd: string) {
        try {
            return await execFileAsync('git', args, {
                cwd,
                windowsHide: true,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'git 命令失败';
            throw new InternalServerErrorException(message);
        }
    }
}
