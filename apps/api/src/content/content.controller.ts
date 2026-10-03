import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ContentService } from './content.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { ReviewContentDto } from './dto/review-content.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators';
import { AuthUser, RequestWithUser } from '../common/constants';

@Controller('content')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContentController {
  constructor(@Inject(ContentService) private readonly content: ContentService) {}

  @Get('review-queue')
  @Roles('admin', 'reviewer')
  reviewQueue(@Query('status') status: string | undefined, @Req() request: RequestWithUser) {
    return this.content.listReviewQueue(status, request.user as AuthUser);
  }

  @Get()
  @Roles('admin', 'editor', 'reviewer')
  list(@Query('status') status: string | undefined, @Req() request: RequestWithUser) {
    return this.content.listAll(status, request.user as AuthUser);
  }

  @Post('/collections/:collectionId')
  @Roles('admin', 'editor')
  create(@Param('collectionId') collectionId: string, @Body() dto: CreateContentDto, @Req() request: RequestWithUser) {
    return this.content.create(collectionId, dto, request.user as AuthUser);
  }

  @Patch(':id')
  @Roles('admin', 'editor')
  update(@Param('id') id: string, @Body() dto: UpdateContentDto, @Req() request: RequestWithUser) {
    return this.content.update(id, dto, request.user as AuthUser);
  }

  @Post(':id/submit')
  @Roles('admin', 'editor')
  submit(@Param('id') id: string, @Req() request: RequestWithUser) {
    return this.content.submit(id, request.user as AuthUser);
  }

  @Post(':id/approve')
  @Roles('admin', 'reviewer')
  approve(@Param('id') id: string, @Body() dto: ReviewContentDto, @Req() request: RequestWithUser) {
    return this.content.approve(id, request.user as AuthUser, dto.note);
  }

  @Post(':id/reject')
  @Roles('admin', 'reviewer')
  reject(@Param('id') id: string, @Body() dto: ReviewContentDto, @Req() request: RequestWithUser) {
    return this.content.reject(id, request.user as AuthUser, dto.note);
  }
}
