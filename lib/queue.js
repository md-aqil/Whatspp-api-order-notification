import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Create queues for different event types
export const automationQueue = new Queue('automation-events', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export const webhookQueue = new Queue('webhook-processing', {
  connection: redisConnection,
});

/**
 * Utility to add an automation event to the queue
 */
export async function enqueueAutomationEvent(event, context, integrations, userId) {
  return automationQueue.add('process-event', {
    event,
    context,
    integrations,
    userId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Utility to add a raw webhook to the queue for deferred processing
 */
export async function enqueueWebhook(platform, payload, headers) {
  return webhookQueue.add('process-webhook', {
    platform,
    payload,
    headers,
    timestamp: new Date().toISOString(),
  });
}
/**
 * Utility to schedule a specific automation step to be executed after a delay
 */
export async function enqueueDelayedStep(jobData, delayMs) {
  return automationQueue.add('process-delayed-step', jobData, {
    delay: delayMs,
  });
}
