import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IsString, Matches, MaxLength } from 'class-validator';
import { Auth, TenantId } from '../auth/auth.decorators';
import { MinRole } from '../auth/auth.guard';
import { AuthContext } from '../auth/auth.types';
import { parseRial } from '../common/money';
import { PaymentsService } from './payments.service';
class RefundDto { @IsString() paymentId!: string; @Matches(/^\d{1,15}$/, { message: 'مبلغ باید عدد صحیح و بر حسب ریال باشد' }) amount!: string; @IsString() @MaxLength(300) reason!: string; }
@Controller('payments')
export class PaymentsController {
  constructor(private readonly svc: PaymentsService) {}
  @MinRole('ADMIN') @Post('refunds') refund(@TenantId() t: string, @Auth() a: AuthContext, @Body() d: RefundDto) { return this.svc.requestRefund(t, a.userId, { paymentId: d.paymentId, amount: parseRial(d.amount), reason: d.reason }); }
  @MinRole('ADMIN') @Get('reconciliation') recon(@TenantId() t: string, @Query('from') from: string, @Query('to') to: string) { return this.svc.reconciliation(t, new Date(from), new Date(to)); }
}
