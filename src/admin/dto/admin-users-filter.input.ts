import { InputType, Field, ID } from '@nestjs/graphql';
import { IsOptional, IsString, IsMongoId, IsEnum } from 'class-validator';
import { UserRole } from '../../users/schemas/user.schema';

@InputType()
export class AdminUsersFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  declare search?: string; // search by name or email

  @Field(() => UserRole, { nullable: true })
  @IsOptional()
  @IsEnum(UserRole)
  declare role?: UserRole;

  @Field({ nullable: true })
  @IsOptional()
  declare isActive?: boolean;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsMongoId()
  declare cursor?: string;
}
