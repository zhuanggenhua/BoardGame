import packageJson from '../../../package.json';
import type { FeedbackClientContext } from './feedbackPayload';

type FeedbackBuildInfo = Pick<
    FeedbackClientContext,
    'appVersion' | 'appCommitSha' | 'appBuildTime' | 'appReleaseChannel'
>;

type BuildInfoCandidate = {
    appVersion?: string;
    appCommitSha?: string;
    appBuildTime?: string;
    appReleaseChannel?: string;
};

type BuildInfoEnv = Record<string, string | undefined>;

const trimToUndefined = (value: unknown): string | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
};

const resolveGlobalBuildInfo = (): BuildInfoCandidate => {
    const host = globalThis as typeof globalThis & {
        __APP_VERSION__?: unknown;
        __APP_COMMIT_SHA__?: unknown;
        __APP_BUILD_TIME__?: unknown;
        __APP_RELEASE_CHANNEL__?: unknown;
    };

    return {
        appVersion: trimToUndefined(host.__APP_VERSION__),
        appCommitSha: trimToUndefined(host.__APP_COMMIT_SHA__),
        appBuildTime: trimToUndefined(host.__APP_BUILD_TIME__),
        appReleaseChannel: trimToUndefined(host.__APP_RELEASE_CHANNEL__),
    };
};

const resolveImportMetaBuildInfo = (): BuildInfoCandidate => {
    const metaEnv = (import.meta as { env?: Record<string, string | undefined> }).env;
    if (!metaEnv) {
        return {};
    }

    return {
        appVersion: trimToUndefined(metaEnv.VITE_APP_VERSION) || trimToUndefined(metaEnv.MODE),
        appCommitSha: trimToUndefined(metaEnv.VITE_APP_COMMIT_SHA),
        appBuildTime: trimToUndefined(metaEnv.VITE_APP_BUILD_TIME),
        appReleaseChannel: trimToUndefined(metaEnv.VITE_APP_RELEASE_CHANNEL),
    };
};

const resolveProcessBuildInfo = (env?: BuildInfoEnv): BuildInfoCandidate => {
    if (!env) {
        return {};
    }

    return {
        appVersion:
            trimToUndefined(env.APP_VERSION)
            || trimToUndefined(env.VITE_APP_VERSION)
            || trimToUndefined(env.npm_package_version),
        appCommitSha:
            trimToUndefined(env.APP_COMMIT_SHA)
            || trimToUndefined(env.VITE_APP_COMMIT_SHA)
            || trimToUndefined(env.GIT_COMMIT_SHA)
            || trimToUndefined(env.COMMIT_SHA)
            || trimToUndefined(env.GITHUB_SHA),
        appBuildTime:
            trimToUndefined(env.APP_BUILD_TIME)
            || trimToUndefined(env.VITE_APP_BUILD_TIME)
            || trimToUndefined(env.BUILD_TIME),
        appReleaseChannel:
            trimToUndefined(env.APP_RELEASE_CHANNEL)
            || trimToUndefined(env.VITE_APP_RELEASE_CHANNEL)
            || trimToUndefined(env.RELEASE_CHANNEL)
            || trimToUndefined(env.DEPLOY_CHANNEL)
            || trimToUndefined(env.NODE_ENV),
    };
};

export function resolveRuntimeBuildInfo(env?: BuildInfoEnv): FeedbackBuildInfo {
    const globalBuildInfo = resolveGlobalBuildInfo();
    const importMetaBuildInfo = resolveImportMetaBuildInfo();
    const processBuildInfo = resolveProcessBuildInfo(env);

    return {
        appVersion:
            globalBuildInfo.appVersion
            || processBuildInfo.appVersion
            || importMetaBuildInfo.appVersion
            || trimToUndefined(packageJson.version),
        appCommitSha:
            globalBuildInfo.appCommitSha
            || processBuildInfo.appCommitSha
            || importMetaBuildInfo.appCommitSha,
        appBuildTime:
            globalBuildInfo.appBuildTime
            || processBuildInfo.appBuildTime
            || importMetaBuildInfo.appBuildTime,
        appReleaseChannel:
            globalBuildInfo.appReleaseChannel
            || processBuildInfo.appReleaseChannel
            || importMetaBuildInfo.appReleaseChannel,
    };
}
