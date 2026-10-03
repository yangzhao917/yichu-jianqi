import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators';
import { AuthUser, RequestWithUser } from '../common/constants';
import { B2bService } from './b2b.service';
import { CreateInteractionDto } from './dto/create-interaction.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Controller()
export class B2bController {
  constructor(private readonly b2b: B2bService) {}

  @Get('brands/:brandSlug')
  brand(@Param('brandSlug') slug: string) { return this.b2b.brand(slug); }

  @Patch('brands/me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  updateBrand(@Body() dto: UpdateBrandDto, @Req() request: RequestWithUser) { return this.b2b.updateBrand(dto, request.user as AuthUser); }

  @Get('brands/:brandSlug/products/:productSlug')
  product(@Param('brandSlug') brandSlug: string, @Param('productSlug') productSlug: string) { return this.b2b.publicProduct(brandSlug, productSlug); }

  @Get('brands/:brandSlug/products/:productSlug/qrcode')
  productQr(@Param('brandSlug') brandSlug: string, @Param('productSlug') productSlug: string) { return this.b2b.productQr(brandSlug, productSlug); }

  @Post('interactions')
  interaction(@Body() dto: CreateInteractionDto) { return this.b2b.createInteraction(dto); }

  @Get('interactions/summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor', 'reviewer')
  interactionSummary(@Req() request: RequestWithUser) { return this.b2b.interactionSummary(request.user as AuthUser); }

  @Get('analytics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor', 'reviewer')
  analytics(@Req() request: RequestWithUser) { return this.b2b.interactionSummary(request.user as AuthUser); }

  @Post('leads')
  lead(@Body() dto: CreateLeadDto) { return this.b2b.createLead(dto); }

  @Get('products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor', 'reviewer')
  products(@Query('status') status: string | undefined, @Req() request: RequestWithUser) { return this.b2b.listProducts(request.user as AuthUser, status); }

  @Post('products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  createProduct(@Body() dto: CreateProductDto, @Req() request: RequestWithUser) { return this.b2b.createProduct(dto, request.user as AuthUser); }

  @Patch('products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto, @Req() request: RequestWithUser) { return this.b2b.updateProduct(id, dto, request.user as AuthUser); }

  @Delete('products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  archiveProduct(@Param('id') id: string, @Req() request: RequestWithUser) { return this.b2b.archiveProduct(id, request.user as AuthUser); }

  @Get('leads')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor', 'reviewer')
  leads(@Query('status') status: string | undefined, @Req() request: RequestWithUser) { return this.b2b.listLeads(request.user as AuthUser, status); }

  @Patch('leads/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  updateLead(@Param('id') id: string, @Body() dto: UpdateLeadDto, @Req() request: RequestWithUser) { return this.b2b.updateLead(id, dto, request.user as AuthUser); }
}
