import { Body, Controller, Get, Inject, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AiRepoWorkbenchExecutorService } from './ai-repo-workbench-executor.service';
import { AiRepoWorkbenchService } from './ai-repo-workbench.service';
import { ExecuteFactionIntakeStageDto } from './dtos/execute-faction-intake-stage.dto';
import { FocusWorkbenchWorktreeDto } from './dtos/focus-worktree.dto';
import { InspectFactionAssetsDto } from './dtos/inspect-faction-assets.dto';
import { RegisterWorkbenchWorktreeDto } from './dtos/register-worktree.dto';
import { StartWorkflowRunDto } from './dtos/start-workflow-run.dto';
import { SubmitDecisionDto } from './dtos/submit-decision.dto';

@Controller('devtools/ai-repo-workbench')
export class AiRepoWorkbenchController {
    constructor(
        @Inject(AiRepoWorkbenchService) private readonly workbenchService: AiRepoWorkbenchService,
        @Inject(AiRepoWorkbenchExecutorService) private readonly executorService: AiRepoWorkbenchExecutorService,
    ) {}

    @Get('journal')
    async getJournal() {
        return this.workbenchService.getJournal();
    }

    @Post('journal/query')
    async queryJournal() {
        return this.workbenchService.getJournal();
    }

    @Get('host-catalog')
    async getHostCatalog() {
        return this.workbenchService.getHostCatalog();
    }

    @Post('reset')
    async resetJournal() {
        return this.workbenchService.resetJournal();
    }

    @Post('worktrees/register')
    async registerWorktree(@Body() body: RegisterWorkbenchWorktreeDto) {
        return this.workbenchService.registerWorktree({
            branchName: body.branchName,
            worktreePath: body.projectPath ?? body.worktreePath ?? '',
            label: body.label,
        });
    }

    @Post('worktrees/focus')
    async focusWorktree(@Body() body: FocusWorkbenchWorktreeDto) {
        return this.workbenchService.focusWorktree(body.worktreeId);
    }

    @Post('workflows/focus')
    async focusWorkflow(@Body() body: { workflowId: string }) {
        return this.workbenchService.focusWorkflow(body.workflowId);
    }

    @Post('workflows/save')
    async saveWorkflow(@Body() body: { workflowId: string; flowData: Record<string, unknown> }) {
        return this.workbenchService.saveWorkflowDraft(body.workflowId, body.flowData);
    }

    @Post('runs/start')
    async startWorkflow(@Body() body: StartWorkflowRunDto) {
        return this.workbenchService.startWorkflow({
            workflowId: body.workflowId,
            subject: body.subject,
            prompt: body.prompt,
            projectPath: body.projectPath,
            nodeToggles: body.nodeToggles as Partial<Record<'run-e2e-validation', boolean>> | undefined,
        });
    }

    @Post('decisions/submit')
    async submitDecision(@Body() body: SubmitDecisionDto) {
        return this.workbenchService.submitDecision(body);
    }

    @Post('faction-intake/inspect-assets')
    async inspectFactionAssets(@Body() body: InspectFactionAssetsDto) {
        return this.workbenchService.inspectFactionAssets(body);
    }

    @Post('faction-intake/data-entry')
    async executeDataEntry(@Body() body: ExecuteFactionIntakeStageDto) {
        return this.executorService.executeDataEntry(body as unknown as Record<string, unknown>);
    }

    @Post('faction-intake/reference-faction')
    async executeReferenceFaction(@Body() body: ExecuteFactionIntakeStageDto) {
        return this.executorService.executeReferenceFaction(body as unknown as Record<string, unknown>);
    }

    @Post('faction-intake/implementation')
    async executeImplementation(@Body() body: ExecuteFactionIntakeStageDto) {
        return this.executorService.executeImplementation(body as unknown as Record<string, unknown>);
    }

    @Post('faction-intake/audit')
    async executeAudit(@Body() body: ExecuteFactionIntakeStageDto) {
        return this.executorService.executeAudit(body as unknown as Record<string, unknown>);
    }

    @Post('faction-intake/upload')
    async executeUpload(@Body() body: ExecuteFactionIntakeStageDto) {
        return this.executorService.executeUpload(body as unknown as Record<string, unknown>);
    }

    @Post('runs/advance')
    async advance() {
        return this.workbenchService.advance();
    }

    @Get('assets/e2e/:name')
    async getE2eAsset(@Param('name') name: string, @Res() res: Response) {
        const asset = await this.workbenchService.getE2eAssetFile(name);
        res.type(asset.contentType);
        return res.sendFile(asset.filePath);
    }
}
