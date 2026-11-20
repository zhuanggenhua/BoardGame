import { Body, Controller, Delete, Get, Headers, Inject, Param, Post, Query, UnauthorizedException, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../../shared/guards/optional-jwt-auth.guard';
import { ExternalRoomsService } from './external-rooms.service';

@Controller('ugc/external-rooms')
@UseGuards(OptionalJwtAuthGuard)
export class ExternalRoomsController {
    constructor(@Inject(ExternalRoomsService) private readonly rooms: ExternalRoomsService) {}

    @Get()
    list(@Query('gameId') gameId: string) {
        return this.rooms.list(typeof gameId === 'string' ? gameId : '');
    }

    @Post()
    create(@CurrentUser() user: { userId: string } | null, @Headers('x-external-room-guest') guest: string | undefined,
        @Body() body: { gameId?: string; capacity?: number; nativeName?: unknown; expectedEntry?: unknown; settings?: unknown; roomName?: unknown; password?: unknown }) {
        return this.rooms.create(roomOwner(user, guest), typeof body?.gameId === 'string' ? body.gameId : '', body ?? {});
    }

    @Post(':id/join')
    join(@CurrentUser() user: { userId: string } | null, @Headers('x-external-room-guest') guest: string | undefined,
        @Param('id') roomId: string, @Body() body: { native?: boolean; password?: unknown } | undefined) {
        return this.rooms.join(roomId, roomOwner(user, guest), body?.native === true, body?.password);
    }

    @Get(':id/entry')
    entry(@Param('id') roomId: string) {
        return this.rooms.getEntry(roomId);
    }

    @Get(':id')
    get(@CurrentUser() user: { userId: string } | null, @Headers('x-external-room-guest') guest: string | undefined, @Param('id') roomId: string) {
        return this.rooms.get(roomId, roomOwner(user, guest));
    }

    @Post(':id/action')
    action(@CurrentUser() user: { userId: string } | null, @Headers('x-external-room-guest') guest: string | undefined,
        @Param('id') roomId: string, @Body() body: Record<string, unknown>) {
        return this.rooms.action(roomId, roomOwner(user, guest), body);
    }

    @Delete(':id')
    async leave(@CurrentUser() user: { userId: string } | null, @Headers('x-external-room-guest') guest: string | undefined, @Param('id') roomId: string) {
        await this.rooms.leave(roomId, roomOwner(user, guest));
        return { left: true };
    }
}

function roomOwner(user: { userId: string } | null, guest: string | undefined) {
    if (user?.userId) return user.userId;
    if (guest && /^[a-f0-9]{64}$/.test(guest)) return 'guest:' + guest;
    throw new UnauthorizedException('未取得房间身份');
}
