import { z } from 'zod';
import type { UISceneCompileIssue, UISceneNodeSource } from './types';

const nonEmptyString = z.string().trim().min(1);
const safeRelativeAssetPath = z.string().trim().min(1).refine(
    (value) => !value.startsWith('/assets/') && !value.includes('/compressed/') && !value.includes('\\'),
    '资源路径必须是相对 /assets 的逻辑路径，且不能手写 /assets/ 或 compressed/',
);
const colorString = z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, '颜色必须是十六进制');

export const uiSceneRectSchema = z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().positive(),
    height: z.number().positive(),
});

export const uiSceneInsetsSchema = z.object({
    top: z.number().finite(),
    right: z.number().finite(),
    bottom: z.number().finite(),
    left: z.number().finite(),
});

const uiSceneFlowAlignSchema = z.enum(['auto', 'start', 'center', 'end', 'stretch']);

export const uiSceneFlowLayoutSchema = z.object({
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    grow: z.number().finite().optional(),
    shrink: z.number().finite().optional(),
    alignSelf: uiSceneFlowAlignSchema.optional(),
    justifySelf: uiSceneFlowAlignSchema.optional(),
});

export const uiSceneAssetEntrySchema = z.object({
    type: z.literal('image'),
    path: safeRelativeAssetPath.optional(),
    remoteUrl: z.string().url().optional(),
    preload: z.enum(['critical', 'warm']).optional(),
    upload: z.enum(['managed', 'local-only', 'remote-only']).optional(),
}).superRefine((value, ctx) => {
    if (!value.path && !value.remoteUrl) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: '资源至少需要 path 或 remoteUrl 其一',
        });
    }
});

export const uiSceneAssetRegistrySchema = z.object({
    assets: z.record(nonEmptyString, uiSceneAssetEntrySchema),
});

const nineSliceSkinSchema = z.object({
    kind: z.literal('nineSlice'),
    assetRef: nonEmptyString,
    image: z.object({
        width: z.number().positive(),
        height: z.number().positive(),
    }),
    slice: uiSceneInsetsSchema,
    contentPadding: uiSceneInsetsSchema.optional(),
    scaleMode: z.enum(['stretch', 'repeat']).optional(),
});

const backgroundImageSkinSchema = z.object({
    kind: z.literal('backgroundImage'),
    assetRef: nonEmptyString,
    contentMode: z.enum(['contain', 'cover', 'fill']).optional(),
});

const iconSkinSchema = z.object({
    kind: z.literal('icon'),
    assetRef: nonEmptyString,
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
});

const textStyleSkinSchema = z.object({
    kind: z.literal('textStyle'),
    fontToken: nonEmptyString.optional(),
    fontFamily: nonEmptyString.optional(),
    fontSize: z.number().positive(),
    lineHeight: z.union([z.number().positive(), nonEmptyString]).optional(),
    color: colorString.optional(),
    fontWeight: z.union([z.number().positive(), nonEmptyString]).optional(),
    letterSpacing: z.union([z.number().finite(), nonEmptyString]).optional(),
    textAlign: z.enum(['left', 'center', 'right']).optional(),
});

export const uiSceneSkinSchema = z.discriminatedUnion('kind', [
    nineSliceSkinSchema,
    backgroundImageSkinSchema,
    iconSkinSchema,
    textStyleSkinSchema,
]);

export const uiSceneSkinCollectionSchema = z.object({
    skins: z.record(nonEmptyString, uiSceneSkinSchema),
});

const nodeBaseSchema = z.object({
    id: nonEmptyString,
    visible: z.boolean().optional(),
    visibleIn: z.array(nonEmptyString).optional(),
    zoneRef: nonEmptyString.optional(),
    rect: uiSceneRectSchema.optional(),
    layout: uiSceneFlowLayoutSchema.optional(),
    skin: nonEmptyString.optional(),
    style: nonEmptyString.optional(),
});

const textPayloadSchema = z.object({
    text: nonEmptyString.optional(),
    textKey: nonEmptyString.optional(),
}).superRefine((value, ctx) => {
    if (!value.text && !value.textKey) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: '需要 text 或 textKey',
        });
    }
});

type NodeInput = z.input<typeof nodeBaseSchema> & {
    type?: string;
    children?: NodeInput[];
};

type NodeOutput = UISceneNodeSource;

const nodeSchema: z.ZodType<NodeOutput, NodeInput> = z.lazy(() => z.discriminatedUnion('type', [
    nodeBaseSchema.extend({
        type: z.literal('panel'),
        children: z.array(nodeSchema).optional(),
    }),
    nodeBaseSchema.extend({
        type: z.literal('stack'),
        direction: z.enum(['absolute', 'horizontal', 'vertical']),
        gap: z.number().finite().optional(),
        align: nonEmptyString.optional(),
        justify: nonEmptyString.optional(),
        padding: uiSceneInsetsSchema.optional(),
        clipContent: z.boolean().optional(),
        children: z.array(nodeSchema).optional(),
    }),
    nodeBaseSchema.extend({
        type: z.literal('grid'),
        columns: z.number().int().positive().optional(),
        rows: z.number().int().positive().optional(),
        gap: z.number().finite().optional(),
        align: nonEmptyString.optional(),
        justify: nonEmptyString.optional(),
        padding: uiSceneInsetsSchema.optional(),
        clipContent: z.boolean().optional(),
        children: z.array(nodeSchema).optional(),
    }),
    nodeBaseSchema.extend({
        type: z.literal('text'),
    }).merge(textPayloadSchema),
    nodeBaseSchema.extend({
        type: z.literal('button'),
        text: nonEmptyString.optional(),
        textKey: nonEmptyString.optional(),
        icon: nonEmptyString.optional(),
        actionId: nonEmptyString.optional(),
    }).superRefine((value, ctx) => {
        if (!value.text && !value.textKey && !value.icon && !value.actionId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'button 至少需要 text、textKey、icon 或 actionId',
            });
        }
    }),
    nodeBaseSchema.extend({
        type: z.literal('image'),
        assetRef: nonEmptyString.optional(),
        path: safeRelativeAssetPath.optional(),
        remoteUrl: z.string().url().optional(),
        contentMode: z.enum(['contain', 'cover', 'fill']).optional(),
        alt: z.string().optional(),
    }).superRefine((value, ctx) => {
        if (!value.assetRef && !value.path && !value.remoteUrl) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'image 节点至少需要 assetRef、path 或 remoteUrl',
            });
        }
    }),
    nodeBaseSchema.extend({
        type: z.literal('slot'),
        slotId: nonEmptyString,
        fallbackText: z.string().optional(),
    }),
]) as z.ZodType<NodeOutput, NodeInput>);

export const uiSceneNodeSchema = nodeSchema;

export const uiSceneSourceSchema = z.object({
    scene: z.object({
        id: nonEmptyString,
        artboard: z.object({
            width: z.number().positive(),
            height: z.number().positive(),
            background: z.object({
                assetRef: nonEmptyString.optional(),
                path: safeRelativeAssetPath.optional(),
                remoteUrl: z.string().url().optional(),
            }).optional(),
            zones: z.record(nonEmptyString, uiSceneRectSchema).optional(),
        }),
        root: uiSceneNodeSchema,
    }),
});

function formatPath(path: PropertyKey[]): string {
    if (!path.length) {
        return 'root';
    }

    return path.reduce<string>((acc, segment) => {
        if (typeof segment === 'number') {
            return `${acc}[${segment}]`;
        }
        const key = String(segment);
        return acc ? `${acc}.${key}` : key;
    }, '');
}

export function formatSchemaIssues(file: string, error: z.ZodError): UISceneCompileIssue[] {
    return error.issues.map((issue) => ({
        file,
        path: formatPath(issue.path),
        code: 'SCHEMA_INVALID',
        message: issue.message,
        suggestion: '按字段约束修正后重新编译',
    }));
}
