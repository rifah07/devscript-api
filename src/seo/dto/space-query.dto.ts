import { IsEnum } from 'class-validator';
import { PostSpace } from '../../posts/schemas/post.schema';

export class SpaceQueryDto {
  @IsEnum(PostSpace)
  declare space: PostSpace;
}
