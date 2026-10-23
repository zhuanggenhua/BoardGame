import { IsBoolean, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateFavoriteGameDto {
    @IsString()
    @MaxLength(128)
    @Matches(/^[a-zA-Z0-9_-]+$/)
    gameId!: string;

    @IsBoolean()
    favorite!: boolean;
}
