import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { Auth, TenantId } from '../auth/auth.decorators';
import { MinRole } from '../auth/auth.guard';
import { AuthContext } from '../auth/auth.types';
import { PageQuery } from '../common/paging';
import { CatalogService } from './catalog.service';
import { CategoryDto, ProductDto, ProductUpdateDto, StoreDto, VariantPriceDto } from './catalog.dto';
import { IsIn, IsOptional, IsString } from 'class-validator';

class ProductQuery extends PageQuery { @IsOptional() @IsString() storeId?: string; @IsOptional() @IsIn(['DRAFT', 'ACTIVE', 'ARCHIVED']) status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'; @IsOptional() @IsString() categoryId?: string; @IsOptional() @IsIn(['createdAt', 'name']) sort?: 'createdAt' | 'name'; }

@Controller()
export class CatalogController {
  constructor(private readonly svc: CatalogService) {}
  @Get('stores') stores(@TenantId() t: string) { return this.svc.listStores(t); }
  @MinRole('ADMIN') @Post('stores') createStore(@TenantId() t: string, @Auth() a: AuthContext, @Body() d: StoreDto) { return this.svc.createStore(t, a.userId, d); }
  @MinRole('ADMIN') @Patch('stores/:id') updateStore(@TenantId() t: string, @Auth() a: AuthContext, @Param('id') id: string, @Body() d: Partial<StoreDto> & { isActive?: boolean }) { return this.svc.updateStore(t, a.userId, id, d); }

  @Get('categories') categories(@TenantId() t: string, @Query('storeId') storeId: string) { return this.svc.listCategories(t, storeId); }
  @MinRole('MANAGER') @Post('categories') createCategory(@TenantId() t: string, @Auth() a: AuthContext, @Body() d: CategoryDto) { return this.svc.createCategory(t, a.userId, d); }

  @Get('products') products(@TenantId() t: string, @Query() q: ProductQuery) { return this.svc.listProducts(t, q); }
  @Get('products/:id') product(@TenantId() t: string, @Param('id') id: string) { return this.svc.getProduct(t, id); }
  @MinRole('MANAGER') @Post('products') createProduct(@TenantId() t: string, @Auth() a: AuthContext, @Body() d: ProductDto) { return this.svc.createProduct(t, a.userId, d); }
  @MinRole('MANAGER') @Patch('products/:id') updateProduct(@TenantId() t: string, @Auth() a: AuthContext, @Param('id') id: string, @Body() d: ProductUpdateDto) { return this.svc.updateProduct(t, a.userId, id, d); }
  @MinRole('MANAGER') @HttpCode(204) @Delete('products/:id') archive(@TenantId() t: string, @Auth() a: AuthContext, @Param('id') id: string) { return this.svc.archiveProduct(t, a.userId, id); }
  @MinRole('MANAGER') @Patch('variants/:id') variant(@TenantId() t: string, @Auth() a: AuthContext, @Param('id') id: string, @Body() d: VariantPriceDto) { return this.svc.updateVariant(t, a.userId, id, d); }
}
