import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CollectionsService } from './collections.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators';
import { AuthUser, RequestWithUser } from '../common/constants';

/** Product-facing aliases for the legacy CollectionItem persistence model. */
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'editor', 'reviewer')
export class ProductsController {
  constructor(@Inject(CollectionsService) private readonly products: CollectionsService) {}

  @Get()
  list(@Query('search') search?: string, @Query('status') status?: string, @Query('page') page?: string, @Query('limit') limit?: string, @Req() request?: RequestWithUser) {
    return this.products.listManage({ search, status, page: Number(page) || 1, limit: Number(limit) || 50 }, request?.user as AuthUser);
  }

  @Post()
  @Roles('admin', 'editor')
  create(@Body() dto: CreateCollectionDto, @Req() request: RequestWithUser) {
    return this.products.create(dto, request.user as AuthUser);
  }

  @Patch(':id')
  @Roles('admin', 'editor')
  update(@Param('id') id: string, @Body() dto: UpdateCollectionDto, @Req() request: RequestWithUser) {
    return this.products.update(id, dto, request.user as AuthUser);
  }

  @Delete(':id')
  @Roles('admin', 'editor')
  archive(@Param('id') id: string, @Req() request: RequestWithUser) {
    return this.products.archive(id, request.user as AuthUser);
  }
}
