import * as fs from 'node:fs';
import * as path from 'node:path';

const DEFAULT_TEST_API_TOKEN_FILE = path.join('temp', 'e2e', 'shared-test-api-token.txt');

function normalizeToken(token: string | null | undefined): string | null {
    const trimmed = token?.trim();
    return trimmed ? trimmed : null;
}

function readTokenFile(filePath: string): string | null {
    try {
        return normalizeToken(fs.readFileSync(filePath, 'utf-8'));
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return null;
        }
        throw error;
    }
}

function writeTokenFileIfMissing(filePath: string, token: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    try {
        fs.writeFileSync(filePath, token, { encoding: 'utf-8', flag: 'wx' });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
            throw error;
        }
    }
}

function writeTokenFile(filePath: string, token: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, token, { encoding: 'utf-8' });
}

function generateTestApiToken(): string {
    return `pw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getTestApiTokenFilePath(
    env: NodeJS.ProcessEnv = process.env,
    cwd = process.cwd(),
): string {
    const configuredPath = env.TEST_API_TOKEN_FILE?.trim();
    if (configuredPath) {
        return path.isAbsolute(configuredPath)
            ? configuredPath
            : path.resolve(cwd, configuredPath);
    }
    return path.join(cwd, DEFAULT_TEST_API_TOKEN_FILE);
}

export function resolveSharedTestApiToken(
    env: NodeJS.ProcessEnv = process.env,
    cwd = process.cwd(),
): string | null {
    const filePath = getTestApiTokenFilePath(env, cwd);
    const envToken = normalizeToken(env.TEST_API_TOKEN);
    if (envToken) {
        writeTokenFile(filePath, envToken);
        return envToken;
    }
    return readTokenFile(filePath);
}

export function ensureSharedTestApiToken(
    env: NodeJS.ProcessEnv = process.env,
    cwd = process.cwd(),
): string {
    const existingToken = resolveSharedTestApiToken(env, cwd);
    if (existingToken) {
        env.TEST_API_TOKEN = existingToken;
        return existingToken;
    }

    const filePath = getTestApiTokenFilePath(env, cwd);
    const generatedToken = generateTestApiToken();
    writeTokenFileIfMissing(filePath, generatedToken);

    const finalToken = readTokenFile(filePath) ?? generatedToken;
    env.TEST_API_TOKEN = finalToken;
    return finalToken;
}
