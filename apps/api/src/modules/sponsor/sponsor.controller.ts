import { Body, Controller, Delete, Get, Inject, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { AdminGuard } from '../admin/guards/admin.guard';
import { Roles } from '../admin/guards/roles.decorator';
import { CreateSponsorDto, QueryPublicSponsorDto, QuerySponsorDto, UpdateSponsorDto } from './sponsor.dto';
import { SponsorService } from './sponsor.service';

@Controller('sponsors')
export class SponsorController {
    constructor(@Inject(SponsorService) private readonly sponsorService: SponsorService) {}

    @Get()
    async listPublic(@Query() query: QueryPublicSponsorDto) {
        return this.sponsorService.listPublic(query.page, query.limit);
    }
}

@UseGuards(JwtAuthGuard, AdminGuard)
@Roles('admin')
@Controller('admin-api/sponsors')
export class SponsorAdminController {
    constructor(@Inject(SponsorService) private readonly sponsorService: SponsorService) {}

    @Get()
    async list(@Query() query: QuerySponsorDto) {
        return this.sponsorService.listAdmin(query);
    }

    @Post()
    async create(@Body() body: CreateSponsorDto) {
        return this.sponsorService.create(body);
    }

    @Patch(':id')
    async update(@Param('id') id: string, @Body() body: UpdateSponsorDto) {
        const trimmedId = id.trim();
        if (!trimmedId) {
            throw new NotFoundException('sponsor not found');
        }
        const sponsor = await this.sponsorService.update(trimmedId, body);
        if (!sponsor) {
            throw new NotFoundException('sponsor not found');
        }
        return sponsor;
    }

    @Delete(':id')
    async remove(@Param('id') id: string) {
        const trimmedId = id.trim();
        if (!trimmedId) {
            throw new NotFoundException('sponsor not found');
        }
        const ok = await this.sponsorService.remove(trimmedId);
        if (!ok) {
            throw new NotFoundException('sponsor not found');
        }
        return { ok: true };
    }
}
