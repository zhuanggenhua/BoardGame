import {
    copyFileSync,
    existsSync,
    mkdirSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import path from 'node:path';

const requiredKeys = ['storeFile', 'storePassword', 'keyAlias', 'keyPassword'];

const parsePropertiesFile = (filePath) => {
    if (!existsSync(filePath)) return {};

    const entries = {};
    const content = readFileSync(filePath, 'utf8');

    for (const rawLine of content.split(/\r?\n/u)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;

        const splitIndex = line.search(/[:=]/u);
        if (splitIndex <= 0) continue;

        const key = line.slice(0, splitIndex).trim();
        const value = line.slice(splitIndex + 1).trim();
        entries[key] = value;
    }

    return entries;
};

const hasAllSigningKeys = (config) => requiredKeys.every((key) => Boolean(config[key]));

const escapePropertiesValue = (value) => (
    value
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/:/g, '\\:')
        .replace(/=/g, '\\=')
);

const resolvePathFromRoot = (rootDir, filePath) => (
    path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath)
);

export const detectAndroidReleaseSigning = ({
    rootDir,
    androidDir,
    env = process.env,
}) => {
    const propertiesPath = path.join(androidDir, 'keystore.properties');
    const existing = parsePropertiesFile(propertiesPath);
    const envHasSource = Boolean(env.ANDROID_KEYSTORE_BASE64?.trim() || env.ANDROID_KEYSTORE_PATH?.trim());
    const envHasCredentials = Boolean(
        (env.ANDROID_KEYSTORE_PASSWORD || env.ANDROID_STORE_PASSWORD)
        && env.ANDROID_KEY_ALIAS
        && env.ANDROID_KEY_PASSWORD,
    );

    if (envHasSource || envHasCredentials) {
        return {
            configured: envHasSource && envHasCredentials,
            source: 'env',
            propertiesPath,
        };
    }

    return {
        configured: hasAllSigningKeys(existing),
        source: hasAllSigningKeys(existing) ? 'properties' : 'missing',
        propertiesPath,
    };
};

export const prepareAndroidReleaseSigning = ({
    rootDir,
    androidDir,
    env = process.env,
    required = false,
}) => {
    const propertiesPath = path.join(androidDir, 'keystore.properties');
    const existing = parsePropertiesFile(propertiesPath);
    const existingConfigured = hasAllSigningKeys(existing);

    const keystoreBase64 = env.ANDROID_KEYSTORE_BASE64?.trim();
    const keystoreInputPath = env.ANDROID_KEYSTORE_PATH?.trim();
    const storePassword = env.ANDROID_KEYSTORE_PASSWORD?.trim() || env.ANDROID_STORE_PASSWORD?.trim();
    const keyAlias = env.ANDROID_KEY_ALIAS?.trim();
    const keyPassword = env.ANDROID_KEY_PASSWORD?.trim();

    if (!keystoreBase64 && !keystoreInputPath) {
        if (existingConfigured) {
            return {
                configured: true,
                reusedExisting: true,
                propertiesPath,
                keystorePath: existing.storeFile,
            };
        }

        if (required) {
            throw new Error(
                '缺少 Android release 签名配置。请提供 ANDROID_KEYSTORE_PATH 或 ANDROID_KEYSTORE_BASE64，并同时配置 ANDROID_KEYSTORE_PASSWORD、ANDROID_KEY_ALIAS、ANDROID_KEY_PASSWORD。',
            );
        }

        return {
            configured: false,
            reusedExisting: false,
            propertiesPath,
            keystorePath: null,
        };
    }

    const missingFields = [];
    if (!storePassword) missingFields.push('ANDROID_KEYSTORE_PASSWORD');
    if (!keyAlias) missingFields.push('ANDROID_KEY_ALIAS');
    if (!keyPassword) missingFields.push('ANDROID_KEY_PASSWORD');

    if (missingFields.length > 0) {
        throw new Error(`Android release 签名缺少必填项: ${missingFields.join(', ')}`);
    }

    const keystoreDir = path.join(androidDir, 'keystores');
    const outputKeystorePath = path.join(keystoreDir, 'release-upload.keystore');
    mkdirSync(keystoreDir, { recursive: true });

    if (keystoreBase64) {
        const normalizedBase64 = keystoreBase64.replace(/\s+/g, '');
        const buffer = Buffer.from(normalizedBase64, 'base64');
        if (buffer.length === 0) {
            throw new Error('ANDROID_KEYSTORE_BASE64 解析结果为空，请检查是否传入了正确的 Base64 内容。');
        }
        writeFileSync(outputKeystorePath, buffer);
    } else {
        const resolvedInputPath = resolvePathFromRoot(rootDir, keystoreInputPath);
        if (!existsSync(resolvedInputPath)) {
            throw new Error(`未找到 ANDROID_KEYSTORE_PATH 指向的文件: ${path.relative(rootDir, resolvedInputPath)}`);
        }
        copyFileSync(resolvedInputPath, outputKeystorePath);
    }

    const propertiesContent = [
        `storeFile=${escapePropertiesValue('../keystores/release-upload.keystore')}`,
        `storePassword=${escapePropertiesValue(storePassword)}`,
        `keyAlias=${escapePropertiesValue(keyAlias)}`,
        `keyPassword=${escapePropertiesValue(keyPassword)}`,
        '',
    ].join('\n');

    writeFileSync(propertiesPath, propertiesContent, 'utf8');

    return {
        configured: true,
        reusedExisting: false,
        propertiesPath,
        keystorePath: outputKeystorePath,
    };
};
