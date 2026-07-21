import { Resolver, ResolveField, Parent } from '@nestjs/graphql';
import { ConfigService } from '@nestjs/config';

import { GalleryImageModel } from '../models/gallery-image.model';
import { ImageVariants } from '../models/image-variants.model';
import { buildAllVariants } from '../../common/utils/cloudinary-url.util';

// Field resolver — only fires when the GraphQL query actually asks for `variants`
// This is a huge performance win: if the client doesn't request variants,
// this code never runs at all. GraphQL resolves fields lazily.
@Resolver(() => GalleryImageModel)
export class GalleryImageResolver {
  constructor(private readonly configService: ConfigService) {}

  @ResolveField(() => ImageVariants)
  variants(@Parent() image: GalleryImageModel): ImageVariants {
    const cloudName = this.configService.get<string>('cloudinary.cloudName');

    if (!cloudName) {
      throw new Error('CLOUDINARY_CLOUD_NAME is not configured');
    }

    return buildAllVariants(cloudName, image.publicId);
  }
}
