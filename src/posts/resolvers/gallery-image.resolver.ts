import { Resolver, ResolveField, Parent } from '@nestjs/graphql';
import { ConfigService } from '@nestjs/config';

import { GalleryImageModel } from '../models/gallery-image.model';
import { ImageVariants } from '../models/image-variants.model';
import { buildAllVariants } from '../../common/utils/cloudinary-url.util';
import { buildDownloadUrl } from '../../common/utils/cloudinary-download.util';

// Field resolver — only fires when the GraphQL query actually asks for `variants`
// This is a huge performance win: if the client doesn't request variants,
// this code never runs at all. GraphQL resolves fields lazily.
@Resolver(() => GalleryImageModel)
export class GalleryImageResolver {
  constructor(private readonly configService: ConfigService) {}

  @ResolveField(() => ImageVariants)
  variants(@Parent() image: GalleryImageModel): ImageVariants {
    const cloudName = this.getCloudName();
    return buildAllVariants(cloudName, image.publicId);
  }

  @ResolveField(() => String)
  downloadUrl(@Parent() image: GalleryImageModel): string {
    const cloudName = this.getCloudName();
    // Use the alt text as filename if available, else fall back to publicId
    const filename =
      image.alt?.trim() || image.publicId.split('/').pop() || 'image';
    return buildDownloadUrl(cloudName, image.publicId, filename);
  }

  private getCloudName(): string {
    const cloudName = this.configService.get<string>('cloudinary.cloudName');
    if (!cloudName) throw new Error('CLOUDINARY_CLOUD_NAME is not configured');
    return cloudName;
  }
}
