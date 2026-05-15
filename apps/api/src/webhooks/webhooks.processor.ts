import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../prisma/prisma.service';

interface DeliverJob {
  deliveryId: string;
  url: string;
  payload: Record<string, unknown>;
  signature: string;
}

@Processor('webhooks')
export class WebhooksProcessor {
  private readonly logger = new Logger(WebhooksProcessor.name);

  constructor(private prisma: PrismaService) {}

  @Process('deliver')
  async handleDeliver(job: Job<DeliverJob>) {
    const { deliveryId, url, payload, signature } = job.data;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Veritas-Signature': signature,
          'X-Veritas-Event': payload['event'] as string,
          'User-Agent': 'Veritas-Webhooks/1.0',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          statusCode: response.status,
          success: response.ok,
          attempts: { increment: 1 },
          response: response.ok ? 'OK' : await response.text().catch(() => ''),
        },
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}`);
      }

      this.logger.log(`Webhook delivered to ${url} (${response.status})`);
    } catch (error) {
      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          success: false,
          attempts: { increment: 1 },
          response: (error as Error).message,
        },
      });
      throw error; // Re-throw for Bull retry logic
    }
  }

  @OnQueueFailed()
  async onFailed(job: Job<DeliverJob>, error: Error) {
    this.logger.warn(`Webhook delivery failed after ${job.attemptsMade} attempts: ${error.message}`);

    // After all retries exhausted, increment fail counter on webhook
    if (job.attemptsMade >= 5) {
      const delivery = await this.prisma.webhookDelivery.findUnique({
        where: { id: job.data.deliveryId },
        select: { webhookId: true },
      });
      if (delivery) {
        const webhook = await this.prisma.webhook.update({
          where: { id: delivery.webhookId },
          data: { failCount: { increment: 1 } },
        });
        // Auto-disable webhook after 10 consecutive failures
        if (webhook.failCount >= 10) {
          await this.prisma.webhook.update({
            where: { id: webhook.id },
            data: { active: false },
          });
          this.logger.warn(`Webhook ${webhook.id} auto-disabled after 10 failures`);
        }
      }
    }
  }
}
