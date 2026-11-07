import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Auth, TenantId } from '../auth/auth.decorators';
import { MinRole } from '../auth/auth.guard';
import { AuthContext } from '../auth/auth.types';
import { PageQuery } from '../common/paging';
import { OrdersService } from './orders.service';
import { OrderStatus } from '../domain/order-state';

const STATUSES = ['PENDING', 'AWAITING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'REFUNDED'];
class OrderQuery extends PageQuery { @IsOptional() @IsString() storeId?: string; @IsOptional() @IsIn(STATUSES) status?: OrderStatus; @IsOptional() @IsIn(['createdAt', 'totalAmount']) sort?: 'createdAt' | 'totalAmount'; }
// توجه: PAID در گزینه‌های دستی وجود ندارد؛ فقط پرداخت تأییدشده سفارش را «پرداخت‌شده» می‌کند.
class StatusDto { @IsIn(['PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED']) status!: 'PROCESSING' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED'; @IsOptional() @IsString() @MaxLength(300) note?: string; }

@Controller('orders')
export class OrdersController {
  constructor(private readonly svc: OrdersService) {}
  @Get() list(@TenantId() t: string, @Query() q: OrderQuery) { return this.svc.list(t, q); }
  @Get(':id') get(@TenantId() t: string, @Param('id') id: string) { return this.svc.get(t, id); }
  @MinRole('STAFF') @Post(':id/status') status(@TenantId() t: string, @Auth() a: AuthContext, @Param('id') id: string, @Body() d: StatusDto) { return this.svc.changeStatus(t, id, d.status, a.userId, d.note); }
}
