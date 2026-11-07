import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsIn, IsInt, IsString, MaxLength, Min, Max } from 'class-validator';
import { Auth, TenantId } from '../auth/auth.decorators';
import { MinRole } from '../auth/auth.guard';
import { AuthContext } from '../auth/auth.types';
import { InventoryService } from './inventory.service';
class AdjustDto { @IsString() variantId!: string; @IsString() locationId!: string; @IsInt() @Min(-1_000_000) @Max(1_000_000) delta!: number; @IsString() @MaxLength(200) reason!: string; @IsIn(['RECEIPT', 'ADJUSTMENT', 'RETURN']) type!: 'RECEIPT' | 'ADJUSTMENT' | 'RETURN'; }
@Controller('inventory')
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}
  @Get() list(@TenantId() t: string, @Query('storeId') storeId: string) { return this.svc.list(t, storeId); }
  @Get('movements/:variantId') movements(@TenantId() t: string, @Param('variantId') v: string) { return this.svc.movements(t, v); }
  @MinRole('MANAGER') @Post('adjust') adjust(@TenantId() t: string, @Auth() a: AuthContext, @Body() d: AdjustDto) { return this.svc.adjust(t, a.userId, d); }
}
