import { Resolver, ResolveField, Parent } from '@nestjs/graphql';
import { ConfigService } from '@nestjs/config';

import { PostModel } from '../models/post.model';
import { ImageVariants } from '../models/image-variants.model';
import { buildAllVariants } from '../../common/utils/cloudinary-url.util';

@Resolver(() => PostModel)
export class PostCoverImageResolver {
  constructor(private readonly configService: ConfigService) {}

  @ResolveField(() => ImageVariants, { nullable: true })
  coverImageVariants(@Parent() post: PostModel): ImageVariants | null {
    if (!post.coverImageUrl) return null;

    const cloudName = this.configService.get<string>('cloudinary.cloudName');
    if (!cloudName) throw new Error('CLOUDINARY_CLOUD_NAME is not configured');

    return buildAllVariants(cloudName, post.coverImageUrl);
  }
}
