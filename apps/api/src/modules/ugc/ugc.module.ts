import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UgcAsset, UgcAssetSchema } from './schemas/ugc-asset.schema';
import { UgcBuilderProject, UgcBuilderProjectSchema } from './schemas/ugc-builder-project.schema';
import { UgcPackage, UgcPackageSchema } from './schemas/ugc-package.schema';
import { UgcController } from './ugc.controller';
import { UgcService } from './ugc.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: UgcPackage.name, schema: UgcPackageSchema },
            { name: UgcAsset.name, schema: UgcAssetSchema },
            { name: UgcBuilderProject.name, schema: UgcBuilderProjectSchema },
        ]),
    ],
    controllers: [UgcController],
    providers: [UgcService],
    exports: [UgcService],
})
export class UgcModule {}
