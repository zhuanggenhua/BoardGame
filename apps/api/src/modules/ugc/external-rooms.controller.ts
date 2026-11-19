import { Body, Controller, Delete, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { ExternalRoomsService } from './external-rooms.service';

@Controller('ugc/external-rooms')
@UseGuards(JwtAuthGuard)
export class ExternalRoomsController {
    constructor(@Inject(ExternalRoomsService) private readonly rooms: ExternalRoomsService) {}

    @Post()
    create(@CurrentUser() user: { userId: string }, @Body() body: { gameId?: string; capacity?: number }) {
        return this.rooms.create(user.userId, typeof body?.gameId === 'string' ? body.gameId : '', body?.capacity);
    }

    @Post(':id/join')
    join(@CurrentUser() user: { userId: string }, @Param('id') roomId: string) {
        return this.rooms.join(roomId, user.userId);
    }

    @Get(':id')
    get(@CurrentUser() user: { userId: string }, @Param('id') roomId: string) {
        return this.rooms.get(roomId, user.userId);
    }

    @Post(':id/action')
    action(@CurrentUser() user: { userId: string }, @Param('id') roomId: string, @Body() body: Record<string, unknown>) {
        return this.rooms.action(roomId, user.userId, body);
    }

    @Delete(':id')
    async leave(@CurrentUser() user: { userId: string }, @Param('id') roomId: string) {
        await this.rooms.leave(roomId, user.userId);
        return { left: true };
    }
}
