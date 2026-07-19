import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { isValidPostTypeForSpace } from '../constants/post-type-rules';
import type { PostSpace, PostType } from '../schemas/post.schema';

// Custom cross-field validator — checks postType against the space
// on the SAME object (e.g. CreatePostInput)
export function IsValidPostTypeForSpace(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidPostTypeForSpace',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(postType: PostType, args: ValidationArguments) {
          // Access the sibling 'space' field on the same DTO
          const dto = args.object as Record<string, unknown>;
          const space = dto['space'] as PostSpace | undefined;

          // If space isn't set yet, let @IsEnum on space handle that error separately
          if (!space) return true;

          return isValidPostTypeForSpace(space, postType);
        },
        defaultMessage(args: ValidationArguments) {
          const dto = args.object as Record<string, unknown>;
          const space = dto['space'] as string;
          return `postType "${args.value}" is not valid for space "${space}"`;
        },
      },
    });
  };
}
