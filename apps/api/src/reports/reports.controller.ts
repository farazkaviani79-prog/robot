import { Controller, Get, Query } from '@nestjs/common';
import { TenantId } from '../auth/auth.decorators';
import { ReportsService } from './reports.service';
@Controller()
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}
  @Get('reports/dashboard') dashboard(@TenantId() t: string, @Query('storeId') s?: string) { return this.svc.dashboard(t, s); }
  @Get('customers') customers(@TenantId() t: string, @Query('q') q?: string) { return this.svc.customers(t, q); }
}
