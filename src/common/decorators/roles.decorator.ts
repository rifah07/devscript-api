import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/schemas/user.schema';
import { ROLES_KEY } from '../guards/roles.guard';

// Usage: @Roles(UserRole.ADMIN)
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
