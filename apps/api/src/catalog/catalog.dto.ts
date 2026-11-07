import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
export const MONEY = /^\d{1,15}$/;
const MONEY_MSG = 'مبلغ باید عدد صحیح و بر حسب ریال باشد';

export class StoreDto {
  @IsString() @MinLength(2, { message: 'نام فروشگاه حداقل ۲ حرف باشد' }) @MaxLength(80) name!: string;
  @IsString() @Matches(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/, { message: 'شناسه فقط حروف کوچک انگلیسی، عدد و خط تیره (۳ تا ۴۰ کاراکتر)' }) slug!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}
export class VariantDto {
  @IsString() @MinLength(1) @MaxLength(64) sku!: string;
  @IsOptional() @IsString() @MaxLength(100) title?: string;
  @IsOptional() @IsObject() options?: Record<string, string>;
  @Matches(MONEY, { message: MONEY_MSG }) priceAmount!: string;
  @IsOptional() @Matches(MONEY, { message: MONEY_MSG }) compareAtAmount?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) initialStock?: number;
}
export class ProductDto {
  @IsString() storeId!: string;
  @IsString() @MinLength(2, { message: 'نام کالا حداقل ۲ حرف باشد' }) @MaxLength(150) name!: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsIn(['DRAFT', 'ACTIVE', 'ARCHIVED']) status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => VariantDto) variants!: VariantDto[];
}
export class ProductUpdateDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) name?: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsIn(['DRAFT', 'ACTIVE', 'ARCHIVED']) status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
}
export class VariantPriceDto { @Matches(MONEY, { message: MONEY_MSG }) priceAmount!: string; @IsOptional() @IsBoolean() isActive?: boolean; }
export class CategoryDto { @IsString() storeId!: string; @IsString() @MinLength(2) @MaxLength(80) name!: string; @IsString() @Matches(/^[a-z0-9-]{2,40}$/) slug!: string; @IsOptional() @IsString() parentId?: string; }
