import { InputType, Field } from '@nestjs/graphql';
import {
  IsString,
  IsOptional,
  MaxLength,
  IsUrl,
  MinLength,
} from 'class-validator';

@InputType()
export class UpdateProfileInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  declare name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  declare bio?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsUrl({}, { message: 'Please provide a valid website URL' })
  declare website?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  declare github?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  declare leetcode?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  declare twitter?: string;
}
