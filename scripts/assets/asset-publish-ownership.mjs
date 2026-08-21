import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';

const getEffectiveUid = () => (
    typeof process.getuid === 'function' ? process.getuid() : null
);

export const shouldNormalizeAssetOwnership = ({
    platform = process.platform,
    effectiveUid = getEffectiveUid(),
    targetUid,
    targetGid,
} = {}) => (
    platform !== 'win32'
    && effectiveUid === 0
    && Number.isInteger(targetUid)
    && Number.isInteger(targetGid)
    && (targetUid !== 0 || targetGid !== 0)
);

export const formatNumericOwner = ({ uid, gid }) => `${uid}:${gid}`;

export const normalizePathOwnership = ({
    assetsRoot,
    targetPath,
    stat = statSync,
    spawn = spawnSync,
    platform = process.platform,
    effectiveUid = getEffectiveUid(),
}) => {
    const { uid, gid } = stat(assetsRoot);
    if (!shouldNormalizeAssetOwnership({
        platform,
        effectiveUid,
        targetUid: uid,
        targetGid: gid,
    })) {
        return {
            normalized: false,
            owner: formatNumericOwner({ uid, gid }),
            reason: 'not-required',
        };
    }

    const owner = formatNumericOwner({ uid, gid });
    const result = spawn('chown', ['-R', owner, targetPath], {
        encoding: 'utf8',
    });
    if (result.status !== 0) {
        throw new Error(
            `素材发布目录权限归一失败: owner=${owner} path=${targetPath} `
            + `error=${result.stderr || result.stdout || `exit ${result.status}`}`,
        );
    }

    return {
        normalized: true,
        owner,
        reason: 'root-publish-normalized',
    };
};
