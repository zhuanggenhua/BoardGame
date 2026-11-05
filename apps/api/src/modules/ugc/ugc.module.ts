import { GameSubmission, GameSubmissionSchema } from './schemas/game-submission.schema';
import { GameSubmissionsService } from './game-submissions.service';
import { GameSubmissionsController } from './game-submissions.controller';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UgcAsset, UgcAssetSchema } from './schemas/ugc-asset.schema';
import { UgcBuilderProject, UgcBuilderProjectSchema } from './schemas/ugc-builder-project.schema';
import { UgcPackage, UgcPackageSchema } from './schemas/ugc-package.schema';
import { UgcController } from './ugc.controller';
import { UgcService } from './ugc.service';
import { ExternalGameRecord, ExternalGameSchema } from './schemas/external-game.schema';
import { CreatorClaimRecord, CreatorClaimSchema } from './schemas/creator-claim.schema';
import { ExternalPlayRecord, ExternalPlaySchema } from './schemas/external-play.schema';
import { ExternalGamesService } from './external-games.service';
import { CreatorClaimsService } from './creator-claims.service';
import { ExternalPlayService } from './external-play.service';
import { ExternalGamesController } from './external-games.controller';
import { CreatorClaimsController } from './creator-claims.controller';
import { CreatorReviewController } from './creator-review.controller';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { AdminGuard } from '../admin/guards/admin.guard';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: GameSubmission.name, schema: GameSubmissionSchema },
            { name: ExternalGameRecord.name, schema: ExternalGameSchema },
            { name: CreatorClaimRecord.name, schema: CreatorClaimSchema },
            { name: ExternalPlayRecord.name, schema: ExternalPlaySchema },
            { name: User.name, schema: UserSchema },
            { name: UgcPackage.name, schema: UgcPackageSchema },
            { name: UgcAsset.name, schema: UgcAssetSchema },
            { name: UgcBuilderProject.name, schema: UgcBuilderProjectSchema },
        ]),
    ],
    controllers: [UgcController, GameSubmissionsController, ExternalGamesController, CreatorClaimsController, CreatorReviewController],
    providers: [UgcService, GameSubmissionsService, ExternalGamesService, CreatorClaimsService, ExternalPlayService, AdminGuard],
    exports: [UgcService],
})
export class UgcModule {}
