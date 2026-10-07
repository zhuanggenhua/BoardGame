import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RegisterDto {
    @IsOptional()
    @IsString()
    username?: string;

    @IsOptional()
    @IsString()
    email?: string;

    @IsOptional()
    @IsString()
    code?: string;

    @IsOptional()
    @IsString()
    password?: string;

    @IsOptional()
    @IsString()
    guestId?: string;
}

export class SendRegisterCodeDto {
    @IsOptional()
    @IsString()
    email?: string;
}

export class SendResetCodeDto {
    @IsOptional()
    @IsString()
    email?: string;
}

export class LoginDto {
    @IsOptional()
    @IsString()
    account?: string;

    @IsOptional()
    @IsString()
    password?: string;

    @IsOptional()
    @IsString()
    guestId?: string;
}

export class ChangePasswordDto {
    @IsOptional()
    @IsString()
    currentPassword?: string;

    @IsOptional()
    @IsString()
    newPassword?: string;
}

export class SendEmailCodeDto {
    @IsOptional()
    @IsString()
    email?: string;
}

export class VerifyEmailDto {
    @IsOptional()
    @IsString()
    email?: string;

    @IsOptional()
    @IsString()
    code?: string;
}

export class ResetPasswordDto {
    @IsOptional()
    @IsString()
    email?: string;

    @IsOptional()
    @IsString()
    code?: string;

    @IsOptional()
    @IsString()
    newPassword?: string;
}

export class UpdateAvatarDto {
    @IsString()
    @IsNotEmpty()
    avatar!: string;
}

export class UpdateUsernameDto {
    @IsString()
    @IsNotEmpty()
    username!: string;
}

