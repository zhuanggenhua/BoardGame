import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI?.trim();
if (!MONGO_URI) {
    throw new Error('[UGC] 缺少 MONGO_URI，禁止回退到本机 Mongo。请显式配置目标数据库连接串。');
}
const PACKAGE_ID = 'doudizhu-preview';
const OWNER_ID = 'local-draft';

const draftPath = path.resolve('docs/ugc/doudizhu-preview.ugc.json');
const data = JSON.parse(fs.readFileSync(draftPath, 'utf8'));

const playerInstances = data?.instances?.player;
const playerCount = Array.isArray(playerInstances) ? playerInstances.length : undefined;
const commandTypes = Array.isArray(data?.commandTypes)
    ? data.commandTypes.filter((item) => typeof item === 'string' && item.trim())
    : [];

const manifest = {
    entryPoints: {
        rules: `ugc/${OWNER_ID}/${PACKAGE_ID}/domain.js`,
    },
    metadata: {
        id: PACKAGE_ID,
        name: data?.name || PACKAGE_ID,
        version: '0.0.1',
        type: 'rules',
        gameId: PACKAGE_ID,
        author: OWNER_ID,
        ...(playerCount ? { playerOptions: [playerCount] } : {}),
    },
    files: ['domain.js'],
    commandTypes,
    packageType: 'rules',
};

const UgcPackageSchema = new mongoose.Schema(
    {
        packageId: { type: String, required: true, unique: true, index: true },
        ownerId: { type: String, required: true, index: true },
        name: { type: String, required: true },
        description: { type: String, default: '' },
        tags: { type: [String], default: [] },
        version: { type: String, default: '' },
        gameId: { type: String, default: '' },
        coverAssetId: { type: String, default: '' },
        status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
        manifest: { type: mongoose.Schema.Types.Mixed, default: null },
        publishedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

const UgcPackageModel = mongoose.models.UgcPackage || mongoose.model('UgcPackage', UgcPackageSchema);

await mongoose.connect(MONGO_URI);

const payload = {
    packageId: PACKAGE_ID,
    ownerId: OWNER_ID,
    name: data?.name || PACKAGE_ID,
    description: data?.description || '',
    tags: Array.isArray(data?.tags) ? data.tags : [],
    version: '0.0.1',
    gameId: PACKAGE_ID,
    status: 'published',
    manifest,
    publishedAt: new Date(),
};

const record = await UgcPackageModel.findOneAndUpdate(
    { packageId: PACKAGE_ID },
    { $set: payload },
    { upsert: true, new: true, setDefaultsOnInsert: true }
);

console.log(`[UGC] published package: ${record.packageId}`);

await mongoose.disconnect();
