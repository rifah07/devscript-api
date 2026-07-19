import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { CategoriesService } from './categories.service';
import { CategoryModel } from './models/category.model';
import { CreateCategoryInput } from './dto/create-category.input';
import { UpdateCategoryInput } from './dto/update-category.input';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { PostSpace } from '../posts/schemas/post.schema';

@Resolver(() => CategoryModel)
export class CategoriesResolver {
  constructor(private readonly categoriesService: CategoriesService) {}

  // Public — anyone can browse categories
  @Query(() => [CategoryModel], { name: 'categories' })
  async getCategories(
    @Args('space', { type: () => PostSpace, nullable: true }) space?: PostSpace,
  ): Promise<CategoryModel[]> {
    return space
      ? this.categoriesService.findAllBySpace(space)
      : this.categoriesService.findAll();
  }

  @Query(() => CategoryModel, { name: 'category' })
  async getCategoryBySlug(@Args('slug') slug: string): Promise<CategoryModel> {
    return this.categoriesService.findBySlug(slug);
  }

  // Admin only — create/edit/delete
  @Mutation(() => CategoryModel)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async createCategory(
    @Args('input') input: CreateCategoryInput,
  ): Promise<CategoryModel> {
    return this.categoriesService.create(input);
  }

  @Mutation(() => CategoryModel)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateCategory(
    @Args('input') input: UpdateCategoryInput,
  ): Promise<CategoryModel> {
    return this.categoriesService.update(input);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteCategory(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.categoriesService.remove(id);
  }
}
