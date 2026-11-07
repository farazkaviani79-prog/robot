import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { OrdersService } from '../orders/orders.service';
import { BotFlowService } from '../modules/bale/bot-flow.service';
import { OutboundService } from '../modules/bale/outbound.service';
import { APP_ENV } from '../modules/bale/channel.service';
import type { Env } from '../config/env';
import { Q_INBOUND, Q_MAINT, Q_OUTBOUND } from './queue.constants';

export const MAINT_QUEUE = 'MAINT_QUEUE';

@Injectable()
export class WorkersService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(WorkersService.name);
  private workers: Worker[] = []; private conn!: IORedis;
  constructor(@Inject(APP_ENV) private readonly env: Env, private readonly flow: BotFlowService, private readonly outbound: OutboundService, private readonly orders: OrdersService, @Inject(MAINT_QUEUE) private readonly maint: Queue) {}

  async onModuleInit() {
    if (process.env.RUN_WORKERS === 'false') return;
    this.conn = new IORedis(this.env.redisUrl, { maxRetriesPerRequest: null });
    this.workers.push(
      new Worker(Q_INBOUND, (j) => this.flow.process(j.data.tenantId, j.data.webhookEventId), { connection: this.conn, concurrency: 5 }),
      new Worker(Q_OUTBOUND, (j) => this.outbound.deliver(j.data.tenantId, j.data.id), { connection: this.conn, concurrency: 5, limiter: { max: 25, duration: 1000 } }),
      new Worker(Q_MAINT, async (j) => { if (j.name === 'expire-reservations') { const n = await this.orders.expireStaleReservations(); if (n) this.log.log(`expired ${n} orders`); } }, { connection: this.conn }),
    );
    for (const w of this.workers) w.on('failed', (j, e) => this.log.warn(`job ${j?.id} failed: ${e.message}`));
    await this.maint.add('expire-reservations', {}, { repeat: { every: 60_000 }, jobId: 'expire-reservations', removeOnComplete: 10, removeOnFail: 50 });
  }
  async onModuleDestroy() { await Promise.all(this.workers.map((w) => w.close())); await this.conn?.quit(); }
}
