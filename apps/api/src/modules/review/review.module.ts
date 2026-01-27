import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { ContentFilterService } from './filters/content-filter.service';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { Review, ReviewSchema } from './schemas/review.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Review.name, schema: ReviewSchema },
            { name: User.name, schema: UserSchema },
        ]),
    ],
    controllers: [ReviewController],
    providers: [ReviewService, ContentFilterService],
    exports: [ReviewService],
})
export class ReviewModule {}
