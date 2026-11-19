import { describe, expect, it, vi } from 'vitest';
import { validate } from 'class-validator';
import { CreateCreatorClaimDto } from '../src/modules/ugc/dtos/external-game.dto';
import { CreatorClaimsService } from '../src/modules/ugc/creator-claims.service';

describe('作者认领选填资料', () => {
    it('接受空资料，并在提供主页时校验网址', async () => {
        expect(await validate(Object.assign(new CreateCreatorClaimDto(), { gameId: 'g', profileUrl: '', explanation: '' }))).toHaveLength(0);
        expect((await validate(Object.assign(new CreateCreatorClaimDto(), { gameId: 'g', profileUrl: 'invalid' }))).length).toBeGreaterThan(0);
    });
    it('空资料可创建、送审，并由管理员核实作品关系后审核', async () => {
        const claim = { claimId: 'c', gameId: 'g', applicantId: 'u', profileUrl: '', explanation: '', evidenceDigest: '', hasEvidence: false, status: 'pending' };
        const claims = { exists: vi.fn().mockResolvedValue(false), create: vi.fn().mockResolvedValue(claim),
            findOneAndUpdate: vi.fn().mockResolvedValue(claim), findOne: vi.fn().mockResolvedValue(claim) };
        const games = { exists: vi.fn().mockResolvedValue(true) };
        const service = new CreatorClaimsService(claims as never, games as never, {} as never);
        await service.create('u', { gameId: 'g' });
        expect(claims.create).toHaveBeenCalledWith(expect.objectContaining({ profileUrl: '', explanation: '' }));
        await service.submit('u', 'c');
        expect(claims.findOneAndUpdate).toHaveBeenCalledWith({ claimId: 'c', applicantId: 'u', status: 'draft' }, expect.anything(), expect.anything());
        await expect(service.review('reviewer', 'c', { decision: 'approved', comment: '已核实申请人关系', evidenceDigest: '', profileControlVerified: false, gameRelationshipVerified: true })).resolves.toBe(claim);
    });
});
