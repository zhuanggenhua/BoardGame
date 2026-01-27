export type ReviewUserDto = {
    id: string;
    username: string;
    avatar?: string | null;
};

export type ReviewResponseDto = {
    id: string;
    user: ReviewUserDto | null;
    isPositive: boolean;
    content?: string;
    createdAt: Date;
};
