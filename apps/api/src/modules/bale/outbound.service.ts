import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ChannelService } from './channel.service';
import { InlineButton } from './messenger.types';

export const OUTBOUND_QUEUE = 'OUTBOUND_QUEUE';

@Injectable()
export class OutboundService {
  constructor(private readonly prisma: PrismaService, private readonly channels: ChannelService, @Inject(OUTBOUND_QUEUE) private readonly queue: Queue) {}

  /** صف‌کردن پیام: ابتدا در DB (با کلید یکتا برای جلوگیری از ارسال تکراری) و سپس BullMQ. */
  async enqueueText(tenantId: string, connectionId: string, chatId: string, text: string, idempotencyKey: string, buttons?: InlineButton[][]) {
    try {
      const m = await this.prisma.withTenant(tenantId, (tx) => tx.outboundMessage.create({ data: { tenantId, connectionId, chatId, kind: 'text', payload: { text, buttons: buttons ?? null } as object, idempotencyKey } }));
      await this.queue.add('send', { id: m.id, tenantId }, { jobId: `out-${m.id}`, attempts: 5, backoff: { type: 'exponential', delay: 3000 }, removeOnComplete: 1000, removeOnFail: 5000 });
    } catch (e) { if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e; }
  }

  async deliver(tenantId: string, id: string) {
    const msg = await this.prisma.withTenant(tenantId, (tx) => tx.outboundMessage.findFirst({ where: { id, tenantId } }));
    if (!msg || msg.status === 'SENT') return;
    const conn = await this.prisma.system.channelConnection.findUnique({ where: { id: msg.connectionId } });
    if (!conn) return;
    const adapter = this.channels.forConnection(conn);
    const p = msg.payload as { text: string; buttons?: InlineButton[][] | null };
    try {
      const r = await adapter.sendText({ chatId: msg.chatId, text: p.text, buttons: p.buttons ?? undefined });
      await this.prisma.withTenant(tenantId, (tx) => tx.outboundMessage.update({ where: { id }, data: { status: 'SENT', sentAt: new Date(), providerMessageId: r.providerMessageId, attempts: { increment: 1 }, error: null } }));
    } catch (e) {
      await this.prisma.withTenant(tenantId, (tx) => tx.outboundMessage.update({ where: { id }, data: { status: 'FAILED', attempts: { increment: 1 }, error: String((e as Error).message).slice(0, 500) } }));
      throw e; // BullMQ تلاش مجدد را انجام می‌دهد
    }
  }
}
