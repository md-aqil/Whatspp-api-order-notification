import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

let redisConnection = null;
function getRedisConnection() {
  if (!redisConnection) {
    redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });
  }
  return redisConnection;
}

let automationQueueInstance = null;
export const getAutomationQueue = () => {
  if (!automationQueueInstance) {
    automationQueueInstance = new Queue('automation-events', {
      connection: getRedisConnection(),
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
  }
  return automationQueueInstance;
}

let webhookQueueInstance = null;
export const getWebhookQueue = () => {
  if (!webhookQueueInstance) {
    webhookQueueInstance = new Queue('webhook-processing', {
      connection: getRedisConnection(),
    });
  }
  return webhookQueueInstance;
}

/**
 * Utility to add an automation event to the queue
 */
export async function enqueueAutomationEvent(event, context, integrations, userId) {
  return getAutomationQueue().add('process-event', {
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
  return getWebhookQueue().add('process-webhook', {
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
  return getAutomationQueue().add('process-delayed-step', jobData, {
    delay: delayMs,
  });
}
