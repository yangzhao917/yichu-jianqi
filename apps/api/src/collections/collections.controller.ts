import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CollectionsService } from './collections.service';
import { CreateCollectionDto, ProvenanceDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators';
import { AuthUser, RequestWithUser } from '../common/constants';

@Controller('collections')
export class CollectionsController {
  constructor(@Inject(CollectionsService) private readonly collections: CollectionsService) {}

  @Get()
  list(@Query('search') search?: string, @Query('category') category?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.collections.listPublic({ search, category, page: Number(page) || 1, limit: Number(limit) || 24 });
  }

  @Get('manage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor', 'reviewer')
  listManage(@Query('search') search?: string, @Query('status') status?: string, @Query('page') page?: string, @Query('limit') limit?: string, @Req() request?: RequestWithUser) {
    return this.collections.listManage({ search, status, page: Number(page) || 1, limit: Number(limit) || 50 }, request?.user as AuthUser);
  }

  @Get(':slug/qrcode')
  qr(@Param('slug') slug: string) {
    return this.collections.getQrCode(slug);
  }

  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.collections.getPublicBySlug(slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  create(@Body() dto: CreateCollectionDto, @Req() request: RequestWithUser) {
    return this.collections.create(dto, request.user as AuthUser);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  update(@Param('id') id: string, @Body() dto: UpdateCollectionDto, @Req() request: RequestWithUser) {
    return this.collections.update(id, dto, request.user as AuthUser);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  archive(@Param('id') id: string, @Req() request: RequestWithUser) {
    return this.collections.archive(id, request.user as AuthUser);
  }

  @Post(':id/provenance')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  provenance(@Param('id') id: string, @Body() dto: ProvenanceDto, @Req() request: RequestWithUser) {
    return this.collections.addProvenance(id, dto, request.user as AuthUser);
  }
}
