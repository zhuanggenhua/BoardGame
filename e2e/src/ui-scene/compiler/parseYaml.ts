import { parseDocument } from 'yaml';
import {
    formatSchemaIssues,
    uiSceneAssetRegistrySchema,
    uiSceneSkinCollectionSchema,
    uiSceneSourceSchema,
} from '../schema';
import type {
    UISceneAssetRegistrySource,
    UISceneCompileIssue,
    UISceneSkinCollectionSource,
    UISceneSourceDocument,
} from '../types';

export class UISceneCompileError extends Error {
    readonly issues: UISceneCompileIssue[];

    constructor(message: string, issues: UISceneCompileIssue[]) {
        super(message);
        this.name = 'UISceneCompileError';
        this.issues = issues;
    }
}

function issue(file: string, path: string, code: string, message: string, suggestion?: string): UISceneCompileIssue {
    return {
        file,
        path,
        code,
        message,
        suggestion,
    };
}

function parseYamlValue<T>(yamlText: string, file: string): T {
    const document = parseDocument(yamlText, {
        prettyErrors: false,
        strict: false,
        uniqueKeys: true,
    });

    if (document.errors.length > 0) {
        throw new UISceneCompileError(
            `${file} 解析失败`,
            document.errors.map((error, index) => issue(
                file,
                `yaml[${index}]`,
                'YAML_PARSE_ERROR',
                error.message,
                '检查缩进、重复键和冒号格式',
            )),
        );
    }

    return document.toJS() as T;
}

function parseWithSchema<TInput, TOutput>(
    yamlText: string,
    file: string,
    parser: (text: string, file: string) => TInput,
    safeParse: (value: TInput) => { success: true; data: TOutput } | { success: false; error: { issues: UISceneCompileIssue[] } },
): TOutput {
    const value = parser(yamlText, file);
    const result = safeParse(value);
    if (!result.success) {
        throw new UISceneCompileError(`${file} 校验失败`, result.error.issues);
    }

    return result.data;
}

export function parseAssetRegistryYaml(yamlText: string, file: string): UISceneAssetRegistrySource {
    return parseWithSchema(
        yamlText,
        file,
        parseYamlValue,
        (value) => {
            const result = uiSceneAssetRegistrySchema.safeParse(value);
            if (result.success) {
                return { success: true, data: result.data };
            }

            return {
                success: false,
                error: {
                    issues: formatSchemaIssues(file, result.error),
                },
            };
        },
    );
}

export function parseSkinYaml(yamlText: string, file: string): UISceneSkinCollectionSource {
    return parseWithSchema(
        yamlText,
        file,
        parseYamlValue,
        (value) => {
            const result = uiSceneSkinCollectionSchema.safeParse(value);
            if (result.success) {
                return { success: true, data: result.data };
            }

            return {
                success: false,
                error: {
                    issues: formatSchemaIssues(file, result.error),
                },
            };
        },
    );
}

export function parseSceneYaml(yamlText: string, file: string): UISceneSourceDocument {
    return parseWithSchema(
        yamlText,
        file,
        parseYamlValue,
        (value) => {
            const result = uiSceneSourceSchema.safeParse(value);
            if (result.success) {
                return { success: true, data: result.data };
            }

            return {
                success: false,
                error: {
                    issues: formatSchemaIssues(file, result.error),
                },
            };
        },
    );
}
