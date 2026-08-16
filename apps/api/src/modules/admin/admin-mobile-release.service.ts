import { ConflictException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type {
    AndroidGamePackageReleaseDto,
    AndroidNativeReleaseDto,
    AndroidOtaReleaseDto,
    DeployRollbackExecuteDto,
    DeployRollbackPreviewDto,
    DeployUpdateExecuteDto,
    DeployUpdatePreviewDto,
} from './dtos/mobile-release.dto';

type ReleaseOutput = {
    exitCode: number;
    output: string;
    parsed: Record<string, string>;
};

type DeployRollbackTarget = {
    action: 'rollback-last' | 'rollback';
    tag?: string;
    revision?: string;
    description: string;
    currentWebRef?: string;
    currentGameRef?: string;
    targetWebRef?: string;
    targetGameRef?: string;
    stateUpdatedAt?: string;
    stateAction?: string;
};

type LatestManifest = {
    version?: string;
    versionCode?: number;
    url?: string;
    checksum?: string;
    channel?: string;
    forceUpdate?: boolean;
    publishedAt?: string;
    size?: number;
    notes?: string;
};

type LatestManifestReadResult = {
    latest: LatestManifest | null;
    failure: LatestManifestReadFailure | null;
};

type LatestManifestReadFailure = {
    reason: 'redirect' | 'http-error' | 'invalid-json' | 'network-error';
    status?: number;
    statusText?: string;
    location?: string | null;
    message?: string;
};

type DeployRunnerResponse = {
    ok?: boolean;
    mode?: string;
    jobId?: string;
    status?: 'queued' | 'running' | 'succeeded' | 'failed';
    exitCode?: number | null;
    command?: string;
    output?: string;
    parsed?: Record<string, string>;
    error?: string;
};

type DeployRunnerHealthResponse = {
    ok?: boolean;
    activeJobId?: string | null;
    scriptReady?: boolean;
    release?: {
        script?: boolean;
        nativeScript?: boolean;
        packageScript?: boolean;
        dist?: boolean;
        releaseApk?: boolean;
        serverAssetsReady?: boolean;
    };
};

type GitHubWorkflowDispatchResponse = {
    workflow_run_id?: number;
    run_url?: string;
    html_url?: string;
};

type DeployRunnerRequest = {
    action?: string;
    args?: string[];
    otaArgs?: string[];
    tag?: string;
    confirmText?: string;
};

const OUTPUT_LIMIT = 200_000;
const ANDROID_OTA_WORKFLOW_ID = 'android-ota-publish.yml';
const ANDROID_OTA_SKIP_LATEST_FORBIDDEN_MESSAGE = '正式 Android OTA 发布禁止跳过 latest.json。手机端依赖 latest.json 发现更新，跳过会导致无法更新。';
const ANDROID_NATIVE_SKIP_LATEST_FORBIDDEN_MESSAGE = '正式 Android 原生更新发布禁止跳过 latest.json。手机端依赖 latest.json 发现新版 APK，跳过会导致无法更新。';
const DEFAULT_ANDROID_CONTROL_ASSETS_BASE_URL = 'https://assets.easyboardgame.top/official';

@Injectable()
export class AdminMobileReleaseService {
    private running = false;
    private readonly rootDir = process.cwd();

    async getAndroidReleaseStatus(channel = 'stable') {
        const packageJson = this.readPackageJson();
        const otaManifestUrl = this.buildOtaManifestUrl(channel);
        const nativeManifestUrl = this.buildNativeManifestUrl(channel);
        const otaManifestResult = await this.readLatestManifest(otaManifestUrl);
        const nativeManifestResult = await this.readLatestManifest(nativeManifestUrl);
        const deployRunnerHealth = await this.fetchDeployRunnerHealth();
        const runnerReleaseReady = deployRunnerHealth?.release;
        const hasRunnerConfig = this.isDeployRunnerConfigured();
        const otaWorkflowReady = this.isGithubWorkflowDispatchConfigured();

        const localReleaseReady = {
            script: existsSync(path.join(this.rootDir, 'scripts/mobile/release-android.mjs')),
            nativeScript: existsSync(path.join(this.rootDir, 'scripts/mobile/publish-android-native-update.mjs')),
            packageScript: existsSync(path.join(this.rootDir, 'scripts/mobile/publish-android-game-packages.mjs')),
            deployScript: existsSync(path.join(this.rootDir, 'scripts/deploy/deploy-image.sh')),
            dist: existsSync(path.join(this.rootDir, 'dist/android-build-meta.json')),
            releaseApk: existsSync(path.join(this.rootDir, 'android/app/build/outputs/apk/release/easyboardgame-release.apk')),
            serverAssetsReady: existsSync(path.join(this.rootDir, 'scripts/assets/apply-server-asset-publish.mjs')),
        };
        const deployRunnerReady = Boolean(deployRunnerHealth?.ok);
        const deployScriptReady = hasRunnerConfig
            ? Boolean(deployRunnerHealth?.scriptReady)
            : localReleaseReady.deployScript;

        return {
            packageVersion: packageJson.version,
            androidVersionCode: packageJson.androidVersionCode,
            channel,
            manifestUrl: otaManifestUrl,
            latest: otaManifestResult.latest,
            latestError: otaManifestResult.failure,
            ota: {
                manifestUrl: otaManifestUrl,
                latest: otaManifestResult.latest,
                latestError: otaManifestResult.failure,
            },
            native: {
                manifestUrl: nativeManifestUrl,
                latest: nativeManifestResult.latest,
                latestError: nativeManifestResult.failure,
            },
            releaseReady: {
                script: runnerReleaseReady?.script ?? localReleaseReady.script,
                nativeScript: runnerReleaseReady?.nativeScript ?? localReleaseReady.nativeScript,
                packageScript: runnerReleaseReady?.packageScript ?? localReleaseReady.packageScript,
                deployScript: deployScriptReady,
                deployRunner: deployRunnerReady,
                otaWorkflow: otaWorkflowReady,
                dist: runnerReleaseReady?.dist ?? localReleaseReady.dist,
                releaseApk: runnerReleaseReady?.releaseApk ?? localReleaseReady.releaseApk,
                serverAssetsReady: runnerReleaseReady?.serverAssetsReady ?? localReleaseReady.serverAssetsReady,
            },
            deploy: {
                statusCommand: this.buildDeployCommand(['status']),
                updateCommand: this.buildDeployCommand(['update']),
                updateExecutionEnabled: Boolean(deployRunnerReady && deployScriptReady),
                rollbackLastCommand: this.buildDeployCommand(['rollback-last']),
                rollbackExecutionEnabled: Boolean(deployRunnerReady && deployScriptReady),
                rollbackLastTarget: await this.resolveDeployRollbackTarget({ action: 'rollback-last' }),
            },
            running: this.running || Boolean(deployRunnerHealth?.activeJobId),
        };
    }

    async getAndroidOtaStatus(channel = 'stable') {
        return this.getAndroidReleaseStatus(channel);
    }

    async publishAndroidOta(dto: AndroidOtaReleaseDto) {
        if (this.running) {
            throw new ConflictException('已有 Android OTA 发布任务正在执行');
        }

        this.running = true;
        try {
            const packageJson = this.readPackageJson();
            const args = this.buildOtaReleaseArgs(dto);
            if (this.isGithubWorkflowDispatchConfigured()) {
                return await this.dispatchAndroidOtaWorkflow(dto, packageJson.version);
            }

            const result = await this.runAndroidRelease(args);
            const manifestUrl = this.buildOtaManifestUrl(dto.channel);
            const latest = dto.dryRun ? null : await this.requireLatestManifest(manifestUrl, 'Android OTA');

            return {
                ok: true,
                mode: dto.dryRun ? 'dry-run' : 'publish',
                packageVersion: packageJson.version,
                command: ['node', 'scripts/mobile/release-android.mjs', ...args].join(' '),
                parsed: result.parsed,
                latest,
                output: result.output,
            };
        } finally {
            this.running = false;
        }
    }

    async publishAndroidNative(dto: AndroidNativeReleaseDto) {
        if (this.running) {
            throw new ConflictException('已有 Android 发布任务正在执行');
        }

        this.running = true;
        try {
            const packageJson = this.readPackageJson();
            const args = this.buildNativeReleaseArgs(dto);
            const result = await this.runAndroidRelease(args);
            const manifestUrl = this.buildNativeManifestUrl(dto.channel);
            const latest = dto.dryRun ? null : await this.requireLatestManifest(manifestUrl, 'Android 原生更新');

            return {
                ok: true,
                kind: 'native',
                mode: dto.dryRun ? 'dry-run' : 'publish',
                packageVersion: packageJson.version,
                command: ['node', 'scripts/mobile/release-android.mjs', ...args].join(' '),
                parsed: result.parsed,
                latest,
                output: result.output,
            };
        } finally {
            this.running = false;
        }
    }

    async publishAndroidGamePackage(dto: AndroidGamePackageReleaseDto) {
        if (this.running) {
            throw new ConflictException('已有 Android 发布任务正在执行');
        }

        this.running = true;
        try {
            const packageJson = this.readPackageJson();
            const args = this.buildGamePackageReleaseArgs(dto);
            const result = await this.runAndroidRelease(args);

            return {
                ok: true,
                kind: 'packages',
                mode: dto.dryRun ? 'dry-run' : 'publish',
                packageVersion: packageJson.version,
                command: ['node', 'scripts/mobile/release-android.mjs', ...args].join(' '),
                parsed: result.parsed,
                output: result.output,
            };
        } finally {
            this.running = false;
        }
    }

    async previewDeployRollback(dto: DeployRollbackPreviewDto) {
        const args = this.buildDeployRollbackArgs(dto);
        const target = await this.resolveDeployRollbackTarget(dto);
        return {
            ok: true,
            mode: 'preview',
            command: this.buildDeployCommand(args),
            target,
            output: this.isDeployRunnerConfigured()
                ? '已配置独立部署 runner。请确认目标后再执行回滚。'
                : '未配置独立部署 runner，当前只生成回滚命令预览。',
        };
    }

    async executeDeployRollback(dto: DeployRollbackExecuteDto) {
        const args = this.buildDeployRollbackArgs(dto);
        const target = await this.resolveDeployRollbackTarget(dto);
        if (!this.isDeployRunnerConfigured()) {
            throw new HttpException({
                message: '未配置独立部署 runner。请在服务器宿主机启动 deploy runner，并配置 BG_DEPLOY_RUNNER_URL 与 BG_DEPLOY_RUNNER_TOKEN。',
                error: '独立部署 runner 未配置',
                target,
            }, HttpStatus.SERVICE_UNAVAILABLE);
        }
        if (dto.confirmText !== '确认回滚') {
            throw new HttpException('请在确认框输入“确认回滚”后再执行', HttpStatus.BAD_REQUEST);
        }
        if (this.running) {
            throw new ConflictException('已有发布或部署任务正在执行');
        }

        this.running = true;
        try {
            const result = await this.callDeployRunner('/deploy/rollback/execute', dto);
            return {
                ok: result.ok ?? true,
                mode: result.mode ?? 'execute',
                jobId: result.jobId,
                command: result.command ?? this.buildDeployCommand(args),
                target,
                parsed: {},
                output: result.output ?? '部署回滚任务已提交到独立 runner。',
            };
        } finally {
            this.running = false;
        }
    }

    async previewDeployUpdate(dto: DeployUpdatePreviewDto) {
        const args = this.buildDeployUpdateArgs(dto);
        const otaArgs = this.buildDeployUpdateOtaArgs(dto);
        return {
            ok: true,
            mode: 'preview',
            command: `${this.buildDeployCommand(args)} && node scripts/mobile/release-android.mjs ${otaArgs.join(' ')}`,
            output: this.isDeployRunnerConfigured()
                ? '已配置独立部署 runner。请确认目标后再执行“更新部署 + Android OTA”。'
                : '未配置独立部署 runner，当前只生成“更新部署 + Android OTA”命令预览。',
        };
    }

    async executeDeployUpdate(dto: DeployUpdateExecuteDto) {
        const args = this.buildDeployUpdateArgs(dto);
        const otaArgs = this.buildDeployUpdateOtaArgs(dto);
        if (!this.isDeployRunnerConfigured()) {
            throw new HttpException({
                message: '未配置独立部署 runner。请在服务器宿主机启动 deploy runner，并配置 BG_DEPLOY_RUNNER_URL 与 BG_DEPLOY_RUNNER_TOKEN。',
                error: '独立部署 runner 未配置',
            }, HttpStatus.SERVICE_UNAVAILABLE);
        }
        if (dto.confirmText !== '确认部署') {
            throw new HttpException('请在确认框输入“确认部署”后再执行', HttpStatus.BAD_REQUEST);
        }
        if (this.running) {
            throw new ConflictException('已有发布或部署任务正在执行');
        }

        this.running = true;
        try {
            const result = await this.callDeployRunner('/deploy/update-and-ota/execute', {
                tag: dto.tag,
                confirmText: dto.confirmText,
                otaArgs,
            });
            return {
                ok: result.ok ?? true,
                kind: 'ota' as const,
                mode: 'execute',
                jobId: result.jobId,
                status: result.status ?? 'queued',
                exitCode: result.exitCode ?? null,
                command: result.command ?? `${this.buildDeployCommand(args)} && node scripts/mobile/release-android.mjs ${otaArgs.join(' ')}`,
                parsed: result.parsed ?? {},
                latest: null,
                output: result.output ?? '更新部署 + Android OTA 任务已提交到独立 runner。',
            };
        } finally {
            this.running = false;
        }
    }

    async getDeployJob(jobId: string) {
        const normalizedJobId = jobId.trim();
        if (!normalizedJobId || normalizedJobId.length > 120 || !/^[A-Za-z0-9._:-]+$/.test(normalizedJobId)) {
            throw new HttpException('无效的部署任务 ID', HttpStatus.BAD_REQUEST);
        }
        const result = await this.callDeployRunnerGet(`/jobs/${encodeURIComponent(normalizedJobId)}`);
        const status = result.status ?? 'queued';
        const output = result.output ?? '';
        return {
            ok: status !== 'failed',
            kind: 'ota' as const,
            mode: 'execute',
            jobId: normalizedJobId,
            status,
            exitCode: result.exitCode ?? null,
            command: result.command ?? '',
            parsed: result.parsed ?? this.parseScriptOutput(output),
            latest: null,
            output,
        };
    }

    private buildOtaReleaseArgs(dto: AndroidOtaReleaseDto) {
        this.assertAndroidOtaLatestEnabled(dto);
        const args = ['ota', '--channel', dto.channel];
        const version = dto.version?.trim();
        if (version) {
            args.push('--version', version);
        }
        const otaVersionBase = dto.otaVersionBase?.trim();
        if (otaVersionBase) {
            args.push('--ota-version-base', otaVersionBase);
        }
        args.push('--force-update');
        if (dto.dryRun) {
            args.push('--dry-run');
        }
        if (dto.skipLatest) {
            args.push('--skip-latest');
        }
        const forceUpdateTitle = dto.forceUpdateTitle?.trim();
        if (forceUpdateTitle) {
            args.push('--force-update-title', forceUpdateTitle);
        }
        const forceUpdateMessage = dto.forceUpdateMessage?.trim();
        if (forceUpdateMessage) {
            args.push('--force-update-message', forceUpdateMessage);
        }
        const notes = dto.notes?.trim();
        if (notes) {
            args.push('--notes', notes);
        }
        return args;
    }

    private async dispatchAndroidOtaWorkflow(dto: AndroidOtaReleaseDto, packageVersion: string) {
        const config = this.getGithubWorkflowDispatchConfig();
        if (!config) {
            throw new HttpException('GitHub Actions 发布入口未配置', HttpStatus.SERVICE_UNAVAILABLE);
        }

        const workflowInputs = this.buildAndroidOtaWorkflowInputs(dto, packageVersion, config.gitRef);
        const endpoint = `${config.apiBaseUrl}/repos/${config.repository}/actions/workflows/${encodeURIComponent(ANDROID_OTA_WORKFLOW_ID)}/dispatches`;
        let response: Response;
        try {
            response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    Accept: 'application/vnd.github+json',
                    Authorization: `Bearer ${config.token}`,
                    'Content-Type': 'application/json',
                    'X-GitHub-Api-Version': '2022-11-28',
                },
                body: JSON.stringify({
                    ref: config.dispatchRef,
                    inputs: workflowInputs,
                }),
            });
        } catch (error) {
            throw new HttpException({
                message: '无法连接 GitHub Actions 发布入口',
                error: error instanceof Error ? error.message : 'github actions connection failed',
            }, HttpStatus.SERVICE_UNAVAILABLE);
        }

        const data = await response.json().catch(() => null) as GitHubWorkflowDispatchResponse | { message?: string } | null;
        if (!response.ok) {
            throw new HttpException({
                message: (data as { message?: string } | null)?.message || 'GitHub Actions 发布任务触发失败',
                error: 'github workflow dispatch failed',
            }, response.status);
        }

        const result = data as GitHubWorkflowDispatchResponse | null;
        const workflowUrl = result?.html_url
            ?? `https://github.com/${config.repository}/actions/workflows/${ANDROID_OTA_WORKFLOW_ID}`;
        return {
            ok: true,
            kind: 'ota' as const,
            mode: dto.dryRun ? 'dry-run' : 'publish',
            packageVersion,
            command: `GitHub Actions workflow_dispatch ${config.repository}/${ANDROID_OTA_WORKFLOW_ID}`,
            parsed: {
                workflowRunId: result?.workflow_run_id ? String(result.workflow_run_id) : '',
                workflowUrl,
                bundleVersion: workflowInputs.version,
                version: workflowInputs.version,
                gitRef: workflowInputs.git_ref,
                channel: workflowInputs.channel,
            },
            latest: null,
            output: [
                'Android OTA 发布任务已提交到 GitHub Actions。',
                `workflow=${ANDROID_OTA_WORKFLOW_ID}`,
                `repository=${config.repository}`,
                `ref=${config.dispatchRef}`,
                `git_ref=${workflowInputs.git_ref}`,
                `channel=${workflowInputs.channel}`,
                `dry_run=${workflowInputs.dry_run}`,
                `skip_latest=${workflowInputs.skip_latest}`,
                `force_update=${workflowInputs.force_update}`,
                `expected_base_version=${workflowInputs.expected_base_version}`,
                `version=${workflowInputs.version || '(auto)'}`,
                `ota_version_base=${workflowInputs.ota_version_base || '(default)'}`,
                `url=${workflowUrl}`,
            ].join('\n'),
        };
    }

    private buildAndroidOtaWorkflowInputs(dto: AndroidOtaReleaseDto, packageVersion: string, gitRef: string) {
        this.assertAndroidOtaLatestEnabled(dto);
        const inputs: Record<string, string> = {
            channel: dto.channel,
            git_ref: gitRef,
            version: dto.version?.trim() || '',
            expected_base_version: packageVersion,
            ota_version_base: dto.otaVersionBase?.trim() || '',
            dry_run: dto.dryRun ? 'true' : 'false',
            skip_latest: dto.skipLatest ? 'true' : 'false',
            force_update: 'true',
        };
        const forceUpdateTitle = dto.forceUpdateTitle?.trim();
        if (forceUpdateTitle) {
            inputs.force_update_title = forceUpdateTitle;
        }
        const forceUpdateMessage = dto.forceUpdateMessage?.trim();
        if (forceUpdateMessage) {
            inputs.force_update_message = forceUpdateMessage;
        }
        return inputs;
    }

    private assertAndroidOtaLatestEnabled(dto: Pick<AndroidOtaReleaseDto, 'dryRun' | 'skipLatest'>) {
        if (dto.skipLatest && !dto.dryRun) {
            throw new HttpException(ANDROID_OTA_SKIP_LATEST_FORBIDDEN_MESSAGE, HttpStatus.BAD_REQUEST);
        }
    }

    private assertAndroidNativeLatestEnabled(dto: Pick<AndroidNativeReleaseDto, 'dryRun' | 'skipLatest'>) {
        if (dto.skipLatest && !dto.dryRun) {
            throw new HttpException(ANDROID_NATIVE_SKIP_LATEST_FORBIDDEN_MESSAGE, HttpStatus.BAD_REQUEST);
        }
    }

    private buildNativeReleaseArgs(dto: AndroidNativeReleaseDto) {
        this.assertAndroidNativeLatestEnabled(dto);
        const args = ['native', '--channel', dto.channel];
        if (dto.bump) {
            args.push('--bump', dto.bump);
        }
        if (dto.forceUpdate === false) {
            args.push('--no-force-update');
        }
        if (dto.dryRun) {
            args.push('--dry-run');
        }
        if (dto.skipLatest) {
            args.push('--skip-latest');
        }
        if (dto.skipBuild) {
            args.push('--skip-build');
        }
        const notes = dto.notes?.trim();
        if (notes) {
            args.push('--notes', notes);
        }
        return args;
    }

    private buildGamePackageReleaseArgs(dto: AndroidGamePackageReleaseDto) {
        const args = ['packages', '--channel', dto.channel];
        const gameId = dto.gameId?.trim();
        if (gameId) {
            args.push('--game', gameId);
        }
        if (dto.dryRun) {
            args.push('--dry-run');
        }
        if (dto.manifestOnly) {
            args.push('--manifest-only');
        }
        return args;
    }

    private runNodeScript(relativeScriptPath: string, args: string[]): Promise<ReleaseOutput> {
        const scriptPath = path.join(this.rootDir, relativeScriptPath);
        return this.runCommand(process.execPath, [scriptPath, ...args], relativeScriptPath, 'Android 发布任务失败');
    }

    private async runAndroidRelease(args: string[]): Promise<ReleaseOutput> {
        if (!this.isDeployRunnerConfigured()) {
            return this.runNodeScript('scripts/mobile/release-android.mjs', args);
        }

        const result = await this.callDeployRunner('/mobile-release/android/run', { args });
        return {
            exitCode: 0,
            output: result.output ?? '',
            parsed: result.parsed ?? this.parseScriptOutput(result.output ?? ''),
        };
    }

    private runCommand(command: string, args: string[], relativeScriptPath: string, failureMessage: string): Promise<ReleaseOutput> {
        const scriptPath = path.join(this.rootDir, relativeScriptPath);
        if (!existsSync(scriptPath)) {
            throw new HttpException(`脚本不存在: ${relativeScriptPath}`, HttpStatus.SERVICE_UNAVAILABLE);
        }

        return new Promise((resolve, reject) => {
            let output = '';
            const append = (chunk: Buffer) => {
                output += chunk.toString('utf8');
                if (output.length > OUTPUT_LIMIT) {
                    output = output.slice(output.length - OUTPUT_LIMIT);
                }
            };
            const child = spawn(command, args, {
                cwd: this.rootDir,
                env: process.env,
                windowsHide: true,
            });

            child.stdout.on('data', append);
            child.stderr.on('data', append);
            child.on('error', reject);
            child.on('exit', (code) => {
                const exitCode = code ?? 1;
                const parsed = this.parseScriptOutput(output);
                if (exitCode !== 0) {
                    reject(new HttpException({
                        message: failureMessage,
                        error: failureMessage,
                        exitCode,
                        output,
                        parsed,
                    }, HttpStatus.SERVICE_UNAVAILABLE));
                    return;
                }
                resolve({ exitCode, output, parsed });
            });
        });
    }

    private parseScriptOutput(output: string) {
        const parsed: Record<string, string> = {};
        for (const line of output.split(/\r?\n/)) {
            const match = /^([A-Za-z][A-Za-z0-9]*)=(.*)$/.exec(line.trim());
            if (match) {
                parsed[match[1]] = match[2];
            }
        }
        return parsed;
    }

    private readPackageJson() {
        const packageJsonPath = path.join(this.rootDir, 'package.json');
        return JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
            version: string;
            androidVersionCode?: number;
        };
    }

    private buildOtaManifestUrl(channel: string) {
        const baseUrl = this.resolveAndroidControlAssetsBaseUrl();
        return `${baseUrl}/app-updates/android/${channel}/latest.json`;
    }

    private buildNativeManifestUrl(channel: string) {
        const baseUrl = this.resolveAndroidControlAssetsBaseUrl();
        return `${baseUrl}/native-app-updates/android/${channel}/latest.json`;
    }

    private resolveAndroidControlAssetsBaseUrl() {
        return (
            process.env.VITE_ANDROID_CONTROL_ASSETS_BASE_URL?.trim()
            || process.env.ANDROID_CONTROL_ASSETS_BASE_URL?.trim()
            || process.env.VITE_ANDROID_OTA_CONTROL_ASSETS_BASE_URL?.trim()
            || process.env.ANDROID_OTA_CONTROL_ASSETS_BASE_URL?.trim()
            || DEFAULT_ANDROID_CONTROL_ASSETS_BASE_URL
        ).replace(/\/+$/, '');
    }

    private buildDeployCommand(args: string[]) {
        return ['bash', 'scripts/deploy/deploy-image.sh', ...args.filter(Boolean)].join(' ');
    }

    private buildDeployRollbackArgs(dto: DeployRollbackPreviewDto) {
        if (dto.action === 'rollback') {
            const tag = dto.tag?.trim();
            if (!tag) {
                throw new HttpException('按 tag 回滚必须填写镜像 tag', HttpStatus.BAD_REQUEST);
            }
            return ['rollback', tag];
        }
        return ['rollback-last'];
    }

    private buildDeployUpdateArgs(dto: DeployUpdatePreviewDto) {
        const tag = dto.tag?.trim();
        if (!tag) {
            return ['update'];
        }
        return ['update', tag];
    }

    private buildDeployUpdateOtaDto(dto: DeployUpdatePreviewDto): AndroidOtaReleaseDto {
        return {
            channel: dto.channel ?? 'stable',
            version: dto.version,
            otaVersionBase: dto.otaVersionBase,
            forceUpdate: true,
            dryRun: false,
            skipLatest: false,
        };
    }

    private buildDeployUpdateOtaArgs(dto: DeployUpdatePreviewDto) {
        return this.buildOtaReleaseArgs(this.buildDeployUpdateOtaDto(dto));
    }

    private isDeployRunnerConfigured() {
        return Boolean(this.getDeployRunnerConfig());
    }

    private isGithubWorkflowDispatchConfigured() {
        return Boolean(this.getGithubWorkflowDispatchConfig());
    }

    private getGithubWorkflowDispatchConfig() {
        const token = (
            process.env.BG_GITHUB_ACTIONS_TOKEN
            || process.env.GITHUB_ACTIONS_TOKEN
            || process.env.GH_TOKEN
            || process.env.GITHUB_TOKEN
            || ''
        ).trim();
        if (!token) {
            return null;
        }
        const repository = (
            process.env.BG_GITHUB_REPOSITORY
            || process.env.GITHUB_REPOSITORY
            || 'zhuanggenhua/BoardGame'
        ).trim();
        if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
            return null;
        }
        const dispatchRef = (process.env.BG_ANDROID_OTA_WORKFLOW_REF || 'main').trim();
        const gitRef = (process.env.BG_ANDROID_OTA_GIT_REF || dispatchRef).trim();
        const apiBaseUrl = (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/+$/, '');
        return {
            token,
            repository,
            dispatchRef,
            gitRef,
            apiBaseUrl,
        };
    }

    private getDeployRunnerConfig() {
        const url = process.env.BG_DEPLOY_RUNNER_URL?.trim();
        const token = process.env.BG_DEPLOY_RUNNER_TOKEN?.trim();
        if (!url || !token) {
            return null;
        }
        return {
            url: url.replace(/\/+$/, ''),
            token,
        };
    }

    private async callDeployRunner(pathname: string, body: DeployRunnerRequest): Promise<DeployRunnerResponse> {
        const config = this.getDeployRunnerConfig();
        if (!config) {
            throw new HttpException('独立部署 runner 未配置', HttpStatus.SERVICE_UNAVAILABLE);
        }

        let response: Response;
        try {
            response = await fetch(`${config.url}${pathname}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.token}`,
                },
                body: JSON.stringify({
                    action: body.action,
                    args: body.args,
                    otaArgs: body.otaArgs,
                    tag: body.tag,
                    confirmText: body.confirmText,
                }),
            });
        } catch (error) {
            throw new HttpException({
                message: '无法连接独立部署 runner',
                error: error instanceof Error ? error.message : 'runner connection failed',
            }, HttpStatus.SERVICE_UNAVAILABLE);
        }

        const data = await response.json().catch(() => null) as DeployRunnerResponse | null;
        if (!response.ok) {
            throw new HttpException({
                message: data?.error || data?.output || '独立部署 runner 执行失败',
                error: data?.error || 'deploy runner failed',
                output: data?.output,
            }, response.status);
        }
        return data ?? { ok: true };
    }

    private async callDeployRunnerGet(pathname: string): Promise<DeployRunnerResponse> {
        const config = this.getDeployRunnerConfig();
        if (!config) {
            throw new HttpException('独立部署 runner 未配置', HttpStatus.SERVICE_UNAVAILABLE);
        }

        let response: Response;
        try {
            response = await fetch(`${config.url}${pathname}`, {
                headers: {
                    'Authorization': `Bearer ${config.token}`,
                },
            });
        } catch (error) {
            throw new HttpException({
                message: '无法连接独立部署 runner',
                error: error instanceof Error ? error.message : 'runner connection failed',
            }, HttpStatus.SERVICE_UNAVAILABLE);
        }

        const data = await response.json().catch(() => null) as DeployRunnerResponse | null;
        if (!response.ok) {
            throw new HttpException({
                message: data?.error || data?.output || '独立部署 runner 查询失败',
                error: data?.error || 'deploy runner query failed',
                output: data?.output,
            }, response.status);
        }
        return data ?? { ok: true };
    }

    private async fetchDeployRunnerHealth(): Promise<DeployRunnerHealthResponse | null> {
        const config = this.getDeployRunnerConfig();
        if (!config) {
            return null;
        }

        try {
            const response = await fetch(`${config.url}/health`, {
                headers: {
                    'Authorization': `Bearer ${config.token}`,
                },
            });
            if (!response.ok) {
                return null;
            }
            return await response.json() as DeployRunnerHealthResponse;
        } catch {
            return null;
        }
    }

    private async resolveDeployRollbackTarget(dto: DeployRollbackPreviewDto): Promise<DeployRollbackTarget> {
        if (dto.action === 'rollback') {
            const tag = dto.tag?.trim();
            if (!tag) {
                throw new HttpException('按 tag 回滚必须填写镜像 tag', HttpStatus.BAD_REQUEST);
            }
            return this.describeDeployTag(tag);
        }

        const state = this.readDeployState();
        if (!state) {
            return {
                action: 'rollback-last',
                description: '未找到上次成功部署记录，服务器上暂时不能判断 rollback-last 的目标。',
            };
        }

        const targetTag = this.extractSharedImageTag(
            state.DEPLOY_STATE_PREVIOUS_WEB_IMAGE_REF,
            state.DEPLOY_STATE_PREVIOUS_GAME_IMAGE_REF,
        );
        const described = targetTag ? await this.describeDeployTag(targetTag) : null;
        return {
            action: 'rollback-last',
            tag: targetTag ?? undefined,
            revision: described?.revision,
            description: described?.description ?? '上次成功部署记录里的上一组镜像引用',
            currentWebRef: state.DEPLOY_STATE_CURRENT_WEB_IMAGE_REF,
            currentGameRef: state.DEPLOY_STATE_CURRENT_GAME_IMAGE_REF,
            targetWebRef: state.DEPLOY_STATE_PREVIOUS_WEB_IMAGE_REF,
            targetGameRef: state.DEPLOY_STATE_PREVIOUS_GAME_IMAGE_REF,
            stateUpdatedAt: state.DEPLOY_STATE_UPDATED_AT,
            stateAction: state.DEPLOY_STATE_ACTION,
        };
    }

    private async describeDeployTag(tag: string): Promise<DeployRollbackTarget> {
        const subject = await this.runGit(['show', '-s', '--format=%s', tag]);
        const revision = await this.runGit(['rev-parse', '--short=12', tag]);
        return {
            action: 'rollback',
            tag,
            revision: revision ?? undefined,
            description: subject ?? `镜像 tag：${tag}`,
        };
    }

    private readDeployState() {
        const statePath = path.join(this.rootDir, '.deploy-last-success.env');
        if (!existsSync(statePath)) {
            return null;
        }
        const state: Record<string, string> = {};
        for (const line of readFileSync(statePath, 'utf8').split(/\r?\n/)) {
            const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
            if (match) {
                state[match[1]] = match[2];
            }
        }
        return state;
    }

    private extractSharedImageTag(webRef?: string, gameRef?: string) {
        const webTag = this.extractImageTag(webRef);
        const gameTag = this.extractImageTag(gameRef);
        if (webTag && gameTag && webTag === gameTag) {
            return webTag;
        }
        return webTag ?? gameTag ?? null;
    }

    private extractImageTag(ref?: string) {
        if (!ref || ref.includes('@sha256:')) {
            return null;
        }
        const match = /:([^:/@]+)$/.exec(ref);
        return match?.[1] ?? null;
    }

    private runGit(args: string[]): Promise<string | null> {
        return new Promise((resolve) => {
            let output = '';
            const child = spawn('git', args, {
                cwd: this.rootDir,
                windowsHide: true,
            });
            child.stdout.on('data', (chunk: Buffer) => {
                output += chunk.toString('utf8');
            });
            child.on('error', () => resolve(null));
            child.on('exit', (code) => {
                if (code === 0) {
                    const value = output.trim();
                    resolve(value || null);
                    return;
                }
                resolve(null);
            });
        });
    }

    private async readLatestManifest(url: string): Promise<LatestManifestReadResult> {
        try {
            const response = await fetch(url, {
                headers: { 'Cache-Control': 'no-cache' },
                redirect: 'manual',
            });
            if (response.redirected || (response.status >= 300 && response.status < 400)) {
                return {
                    latest: null,
                    failure: {
                        reason: 'redirect',
                        status: response.status,
                        statusText: response.statusText,
                        location: response.headers.get('Location'),
                    },
                };
            }
            if (!response.ok) {
                return {
                    latest: null,
                    failure: {
                        reason: 'http-error',
                        status: response.status,
                        statusText: response.statusText,
                    },
                };
            }
            try {
                return {
                    latest: await response.json() as LatestManifest,
                    failure: null,
                };
            } catch (error) {
                return {
                    latest: null,
                    failure: {
                        reason: 'invalid-json',
                        message: error instanceof Error ? error.message : String(error),
                    },
                };
            }
        } catch (error) {
            return {
                latest: null,
                failure: {
                    reason: 'network-error',
                    message: error instanceof Error ? error.message : String(error),
                },
            };
        }
    }

    private async requireLatestManifest(url: string, releaseKind: string): Promise<LatestManifest> {
        const { latest, failure } = await this.readLatestManifest(url);
        const missingFields = latest
            ? (['version', 'url', 'checksum', 'size'] as const).filter((field) => latest[field] === undefined || latest[field] === null || latest[field] === '')
            : ['latest.json'];

        if (!latest || missingFields.length > 0) {
            throw new HttpException({
                message: `${releaseKind} 发布后无法确认线上 latest.json。发布不能静默成功，请先修通服务器资源入口再重试。`,
                error: 'latest manifest unavailable',
                manifestUrl: url,
                failure,
                missingFields,
            }, HttpStatus.SERVICE_UNAVAILABLE);
        }
        return latest;
    }
}
