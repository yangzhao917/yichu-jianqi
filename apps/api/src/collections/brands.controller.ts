import { Controller, Get, Inject, Param } from '@nestjs/common';
import { CollectionsService } from './collections.service';

@Controller('brands')
export class BrandsController {
  constructor(@Inject(CollectionsService) private readonly collections: CollectionsService) {}

  @Get(':brandSlug')
  brand(@Param('brandSlug') brandSlug: string) {
    return this.collections.getPublicBrand(brandSlug);
  }

  @Get(':brandSlug/products/:productSlug/qrcode')
  productQr(@Param('brandSlug') brandSlug: string, @Param('productSlug') productSlug: string) {
    return this.collections.getPublicProductQr(brandSlug, productSlug);
  }

  @Get(':brandSlug/products/:productSlug')
  product(@Param('brandSlug') brandSlug: string, @Param('productSlug') productSlug: string) {
    return this.collections.getPublicProduct(brandSlug, productSlug);
  }
}
