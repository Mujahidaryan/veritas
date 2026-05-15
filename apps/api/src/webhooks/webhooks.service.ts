import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

interface TriggerWebhookParams {
  tenantId: string;
  event: string;
  data: Record<string, unknown>;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('webhooks') private webhooksQueue: Queue,
  ) {}

  async trigger(params: TriggerWebhookParams): Promise<void> {
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        tenantId: params.tenantId,
        active: true,
        events: { has: params.event },
      },
    });

    for (const webhook of webhooks) {
      const payload = {
        id: crypto.randomUUID(),
        tenantId: params.tenantId,
        event: params.event,
        timestamp: new Date().toISOString(),
        data: params.data,
      };

      const signature = this.signPayload(JSON.stringify(payload), webhook.secret);

      const delivery = await this.prisma.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          event: params.event,
          payload,
          attempts: 0,
        },
      });

      await this.webhooksQueue.add(
        'deliver',
        { deliveryId: delivery.id, url: webhook.url, payload, signature },
        {
          attempts: 5,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
        },
      );
    }
  }

  async createWebhook(tenantId: string, url: string, events: string[]) {
    const secret = crypto.randomBytes(32).toString('hex');
    return this.prisma.webhook.create({
      data: { tenantId, url, events, secret },
      select: { id: true, url: true, events: true, active: true, createdAt: true },
    });
  }

  async listWebhooks(tenantId: string) {
    return this.prisma.webhook.findMany({
      where: { tenantId },
      select: { id: true, url: true, events: true, active: true, failCount: true, createdAt: true },
    });
  }

  async deleteWebhook(id: string, tenantId: string) {
    return this.prisma.webhook.deleteMany({ where: { id, tenantId } });
  }

  signPayload(payload: string, secret: string): string {
    return 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }
}
