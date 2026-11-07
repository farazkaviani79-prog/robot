import { Controller, HttpCode, Inject, NotFoundException, Param, Post, Req } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { Public } from '../../auth/auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { Q_INBOUND } from '../../queue/queue.constants';
import { ChannelService } from './channel.service';

export const INBOUND_QUEUE = 'INBOUND_QUEUE';

/**
 * ورودی وب‌هوک بله. مسیر شامل کلید تصادفی و غیرقابل‌حدس (webhookKey) است؛ اعتبارسنجی هویت فرستنده
 * مبتنی بر همین راز است (مکانیزم هدر امضا در بله تأییدنشده است). پاسخ سریع ۲۰۰؛ پردازش در صف.
 * رویداد تکراری (تکرار ارسال توسط بله) با کلید یکتای (connectionId, externalEventId) نادیده گرفته می‌شود.
 */
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly prisma: PrismaService, private readonly channels: ChannelService, @Inject(INBOUND_QUEUE) private readonly queue: Queue) {}

  @Public() @HttpCode(200) @Post('bale/:key')
  async bale(@Param('key') key: string, @Req() req: any) {
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(key)) throw new NotFoundException();
    const conn = await this.prisma.system.channelConnection.findUnique({ where: { webhookKey: key } });
    if (!conn || conn.status === 'DISABLED') throw new NotFoundException();
    const body = req.body;
    const adapter = this.channels.forConnection(conn);
    const ev = adapter.parseUpdate(body);
    const externalEventId = ev.eventId || `noid-${Date.now()}`;
    try {
      const row = await this.prisma.withTenant(conn.tenantId, (tx) => tx.webhookEvent.create({ data: { tenantId: conn.tenantId, connectionId: conn.id, channel: conn.channel, externalEventId, payload: body ?? {} } }));
      await this.queue.add('process', { webhookEventId: row.id, tenantId: conn.tenantId }, { jobId: `wh-${row.id}`, attempts: 5, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 1000, removeOnFail: 5000 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return { ok: true, duplicate: true };
      throw e;
    }
    return { ok: true };
  }
}
