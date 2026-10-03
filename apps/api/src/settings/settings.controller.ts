import { Body, Controller, Get, Inject, Patch, Put, Query, Req, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators';
import { AuthUser, RequestWithUser } from '../common/constants';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Controller('settings')
export class SettingsController {
  constructor(@Inject(SettingsService) private readonly settings: SettingsService) {}

  @Get('public')
  public(@Req() request: RequestWithUser, @Query('brandSlug') brandSlug?: string) { return this.settings.publicSettings(brandSlug); }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  admin(@Req() request: RequestWithUser) { return this.settings.adminSettings(request.user as AuthUser); }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(@Body() dto: UpdateSettingsDto, @Req() request: RequestWithUser) { return this.settings.update(dto, request.user as AuthUser); }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  patch(@Body() dto: UpdateSettingsDto, @Req() request: RequestWithUser) { return this.settings.update(dto, request.user as AuthUser); }
}
